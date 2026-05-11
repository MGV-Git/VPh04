import "./styles.css";
import { startPublicBehaviorMetrics } from "./behaviorMetrics.js";
import { renderCursorHeatmapFromTelemetry } from "./cursorHeatmap.js";

const FIELD_CONFIG = [
  { name: "first_name", label: "Имя", required: true, type: "text", maxLength: 200 },
  { name: "last_name", label: "Фамилия", required: true, type: "text", maxLength: 200 },
  { name: "patronymic", label: "Отчество", type: "text", maxLength: 200 },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Телефон", type: "tel", maxLength: 64 },
  {
    name: "business_info",
    label: "Кратко о бизнесе",
    required: true,
    type: "textarea",
    maxLength: 16000,
    rows: 4,
  },
  { name: "business_niche", label: "Ниша бизнеса", type: "text", maxLength: 2000 },
  { name: "company_size", label: "Размер компании", type: "text", maxLength: 500 },
  { name: "task_volume", label: "Объем задачи", type: "text", maxLength: 500 },
  { name: "role_in_company", label: "Ваша роль в компании", type: "text", maxLength: 200 },
  { name: "business_size", label: "Масштаб бизнеса", type: "text", maxLength: 500 },
  { name: "need_volume", label: "Потребность/нагрузка", type: "text", maxLength: 500 },
  { name: "result_deadline", label: "Желаемый срок результата", type: "text", maxLength: 500 },
  { name: "task_type", label: "Тип задачи", type: "text", maxLength: 500 },
  { name: "product_of_interest", label: "Интересующий продукт", type: "text", maxLength: 500 },
  { name: "budget", label: "Бюджет", required: true, type: "text", maxLength: 200 },
  { name: "preferred_contact_method", label: "Предпочитаемый способ связи", type: "text", maxLength: 200 },
  { name: "convenient_contact_time", label: "Удобное время для связи", type: "text", maxLength: 200 },
  { name: "comments", label: "Дополнительные комментарии", type: "textarea", rows: 3, maxLength: 16000 },
];

const appRoot = document.querySelector("#app-root");
let successFxTimer = null;
const ADMIN_TOKEN_KEY = "admin_jwt_token";

/** Редактируемый список услуг (элементы — объекты, строки из API нормализуются). */
let adminServicesDraft = [];
let adminSelectedServiceIndex = -1;
let servicesPersistTimer = null;
/** Поля `ui_options` кроме `formNotes` (сохраняем при редактировании одной строки). */
let adminUiOptionsExtras = {};

let adminLeadsList = [];
let adminLeadEditingId = null;

/** Пагинация таблицы телеметрии (админка → Статистика). */
let telemetryPageLimit = 40;
let telemetryPageOffset = 0;

function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

async function apiFetch(url, options = {}, { requiresAuth = false } = {}) {
  const headers = { ...(options.headers || {}) };
  if (requiresAuth) {
    const token = getAdminToken();
    if (!token) {
      throw new Error("Нет токена авторизации");
    }
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  return response;
}

function renderLayout(content, { title, subtitle, eyebrow, showAdminLink }) {
  document.title = title;
  appRoot.innerHTML = `
    <main class="page">
      <section class="hero">
        <div class="top-nav">
          <a class="nav-link" href="/">Форма заявки</a>
          ${showAdminLink ? '<a class="nav-link" href="/admin">Админка</a>' : ""}
        </div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
      </section>
      <section class="card">${content}</section>
    </main>
  `;
}

function getStatusEl() {
  return document.querySelector("#status");
}

function setStatus(message, type) {
  const statusEl = getStatusEl();
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function renderForm() {
  const form = document.querySelector("#application-form");
  if (!form) return;
  const fields = FIELD_CONFIG.map((field) => {
    const attrs = [
      `name="${field.name}"`,
      `id="${field.name}"`,
      field.required ? "required" : "",
      field.maxLength ? `maxlength="${field.maxLength}"` : "",
      field.type && field.type !== "textarea" ? `type="${field.type}"` : "",
      'autocomplete="off"',
    ]
      .filter(Boolean)
      .join(" ");

    const control =
      field.type === "textarea"
        ? `<textarea ${attrs} rows="${field.rows ?? 4}"></textarea>`
        : `<input ${attrs} />`;

    return `
      <label class="field" for="${field.name}">
        <span>${field.label}${field.required ? " *" : ""}</span>
        ${control}
      </label>
    `;
  }).join("");

  form.innerHTML = `
    <div class="form-grid">${fields}</div>
    <button class="submit-btn" type="submit">Отправить заявку</button>
  `;
}

function getPayload() {
  const form = document.querySelector("#application-form");
  if (!form) return {};
  const payload = {};
  const fd = new FormData(form);

  for (const field of FIELD_CONFIG) {
    const value = (fd.get(field.name) || "").toString().trim();
    payload[field.name] = value.length === 0 ? null : value;
  }

  // Required fields on backend default to empty string but should remain explicit in UI.
  payload.first_name = payload.first_name || "";
  payload.last_name = payload.last_name || "";
  payload.business_info = payload.business_info || "";
  payload.budget = payload.budget || "";

  return payload;
}

function playSuccessFx(button) {
  button.classList.remove("success-burst");
  void button.offsetWidth;
  button.classList.add("success-burst");

  if (successFxTimer) {
    window.clearTimeout(successFxTimer);
  }

  successFxTimer = window.setTimeout(() => {
    button.classList.remove("success-burst");
  }, 1100);
}

async function submitForm(event) {
  event.preventDefault();

  setStatus("", "");
  const form = document.querySelector("#application-form");
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  submitBtn.disabled = true;

  const payload = getPayload();

  if (!payload.first_name || !payload.last_name || !payload.business_info || !payload.budget) {
    setStatus("Заполните обязательные поля: имя, фамилия, информация о бизнесе и бюджет.", "error");
    submitBtn.disabled = false;
    return;
  }

  try {
    const response = await fetch("/api/v1/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось отправить заявку");
    }

    const created = await response.json();
    form.reset();
    setStatus(`Заявка отправлена. ID: ${created.id}`, "success");
    playSuccessFx(submitBtn);
  } catch (error) {
    console.error(error);
    setStatus("Ошибка отправки. Попробуйте еще раз через минуту.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

function renderLeadFormPage() {
  renderLayout(
    `
      <form id="application-form" class="form" novalidate></form>
      <p id="status" class="status" role="status" aria-live="polite"></p>
    `,
    {
      title: "Заявка на персональный разбор бизнеса",
      subtitle:
        "Заполните форму, и мы подготовим персональный разбор задачи с рекомендациями по масштабированию.",
      eyebrow: "Private Strategy Form",
      showAdminLink: true,
    },
  );

  const form = document.querySelector("#application-form");
  renderForm();
  form.addEventListener("submit", submitForm);

  const stopBehaviorMetrics = startPublicBehaviorMetrics();
  window.addEventListener(
    "pagehide",
    () => {
      stopBehaviorMetrics();
    },
    { once: true },
  );
}

function parseJsonField(value, fallback) {
  if (!value || value.trim() === "") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Ошибка разбора JSON: проверьте кавычки, запятые и фигурные скобки { }.");
  }
}

function formatJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

/** Показ диапазона бюджета: свободный текст в `range` или полный JSON. */
function formatBudgetRangeForDisplay(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return "";
  }
  const keys = Object.keys(cfg);
  if (keys.length === 0) {
    return "";
  }
  if (keys.length === 1 && typeof cfg.range === "string") {
    return cfg.range;
  }
  return formatJson(cfg);
}

/** В API всегда объект: либо распарсенный JSON-объект, либо `{ range: "текст" }`. */
function parseBudgetRangeField(raw) {
  const text = (raw || "").trim();
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* не JSON — свободный текст, как в примере «900к–1,5кк» */
  }
  return { range: text };
}

function absorbUiOptionsExtrasFromServer(ui) {
  const o = ui && typeof ui === "object" && !Array.isArray(ui) ? { ...ui } : {};
  const line = typeof o.formNotes === "string" ? o.formNotes : "";
  delete o.formNotes;
  adminUiOptionsExtras = o;
  return line;
}

function buildUiOptionsFromFormNotesInput(raw) {
  const line = (raw || "").trim();
  const out = { ...adminUiOptionsExtras };
  if (line) {
    out.formNotes = line;
  } else {
    delete out.formNotes;
  }
  return out;
}

function normalizeServicesInput(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((entry) => {
    if (typeof entry === "string") {
      return { title: entry };
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return { ...entry };
    }
    return { title: String(entry ?? "") };
  });
}

function isServiceRowEmpty(o) {
  if (!o || typeof o !== "object") {
    return true;
  }
  return !Object.keys(o).some((key) => {
    const value = o[key];
    if (value == null) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  });
}

function cloneServicesForApi() {
  return adminServicesDraft.map((row) => JSON.parse(JSON.stringify(row))).filter((row) => !isServiceRowEmpty(row));
}

/** Не отправлять на сервер «пустой» список, пока в таблице есть незаполненные черновики строк — иначе PATCH затирает услуги. */
function wouldAutoPersistWipeDraftWithEmptyRows() {
  return adminServicesDraft.length > 0 && cloneServicesForApi().length === 0;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scheduleServicesPersist() {
  const form = document.querySelector("#admin-config-form");
  if (!form) return;
  const id = form.querySelector("#config-id")?.value?.trim();
  if (!id) return;
  if (wouldAutoPersistWipeDraftWithEmptyRows()) {
    if (servicesPersistTimer) {
      window.clearTimeout(servicesPersistTimer);
      servicesPersistTimer = null;
    }
    return;
  }
  if (servicesPersistTimer) {
    window.clearTimeout(servicesPersistTimer);
  }
  servicesPersistTimer = window.setTimeout(() => {
    servicesPersistTimer = null;
    void flushServicesPersist();
  }, 700);
}

async function flushServicesPersist() {
  const form = document.querySelector("#admin-config-form");
  if (!form) return;
  const id = form.querySelector("#config-id")?.value?.trim();
  if (!id) {
    setStatus("Сначала сохраните конфигурацию целиком, чтобы получить ID — затем список услуг можно синхронизировать с сервером.", "error");
    return;
  }
  if (wouldAutoPersistWipeDraftWithEmptyRows()) {
    return;
  }
  setStatus("Сохранение услуг…", "");
  try {
    const response = await apiFetch(
      `/api/v1/admin-config/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services_offered: cloneServicesForApi() }),
      },
      { requiresAuth: true },
    );
    if (response.status === 401) {
      setAdminToken("");
      throw new Error("UNAUTHORIZED");
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось сохранить список услуг");
    }
    const saved = await response.json();
    adminServicesDraft = normalizeServicesInput(saved.services_offered);
    if (adminSelectedServiceIndex >= adminServicesDraft.length) {
      adminSelectedServiceIndex = adminServicesDraft.length - 1;
    }
    renderServicesEditor();
    setStatus("Список услуг обновлён на сервере.", "success");
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      await renderAdminAuthPage();
      setStatus("Сессия истекла. Войдите снова.", "error");
      return;
    }
    setStatus(error?.message || "Ошибка сохранения услуг", "error");
  }
}

function bindServicesEditorEvents() {
  const root = document.querySelector("#admin-services-editor");
  if (!root) return;

  root.addEventListener("click", (event) => {
    const tr = event.target.closest("tr[data-service-index]");
    if (!tr) return;
    const idx = Number(tr.getAttribute("data-service-index"));
    if (!Number.isFinite(idx)) return;
    adminSelectedServiceIndex = idx;
    root.querySelectorAll("tr[data-service-index]").forEach((row) => {
      row.classList.toggle("is-selected", Number(row.getAttribute("data-service-index")) === adminSelectedServiceIndex);
    });
  });

  root.addEventListener("input", (event) => {
    const el = event.target;
    const idx = Number(el.getAttribute("data-service-idx"));
    const field = el.getAttribute("data-service-field");
    if (!Number.isFinite(idx) || !field) return;
    const row = adminServicesDraft[idx];
    if (!row || typeof row !== "object") return;
    row[field] = el.value;
    scheduleServicesPersist();
  });
}

function renderServicesEditor() {
  const tbody = document.querySelector("#admin-services-editor [data-services-tbody]");
  if (!tbody) return;

  const rowsHtml = adminServicesDraft
    .map((row, index) => {
      const titleVal = escapeHtml(row.title != null ? String(row.title) : "");
      const selected = index === adminSelectedServiceIndex ? " is-selected" : "";
      const displayId = index + 1;
      return `
        <tr data-service-index="${index}" class="${selected.trim()}">
          <td class="admin-svc-id-cell">${displayId}</td>
          <td>
            <input
              type="text"
              class="admin-svc-title-input"
              data-service-idx="${index}"
              data-service-field="title"
              value="${titleVal}"
              placeholder="Название услуги"
              autocomplete="off"
            />
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML =
    rowsHtml ||
    `<tr class="admin-services-empty"><td colspan="2">Услуг пока нет — нажмите «+ Добавить» справа.</td></tr>`;

  tbody.querySelectorAll("tr[data-service-index]").forEach((row) => {
    const idx = Number(row.getAttribute("data-service-index"));
    row.classList.toggle("is-selected", idx === adminSelectedServiceIndex);
  });
}

function focusSelectedServiceTitle() {
  const root = document.querySelector("#admin-services-editor");
  if (!root || adminSelectedServiceIndex < 0) return;
  const input = root.querySelector(
    `.admin-svc-title-input[data-service-idx="${adminSelectedServiceIndex}"][data-service-field="title"]`,
  );
  if (input) {
    input.focus();
    input.select?.();
  }
}

function wireServicesToolbar() {
  const root = document.querySelector("#admin-services-toolbar");
  if (!root) return;

  root.querySelector("[data-action=service-add]")?.addEventListener("click", () => {
    adminServicesDraft.push({ title: "" });
    adminSelectedServiceIndex = adminServicesDraft.length - 1;
    renderServicesEditor();
    focusSelectedServiceTitle();
  });

  root.querySelector("[data-action=service-edit]")?.addEventListener("click", () => {
    if (adminSelectedServiceIndex < 0 || adminSelectedServiceIndex >= adminServicesDraft.length) {
      setStatus("Выберите строку в таблице (клик по строке), затем нажмите «Редактировать».", "error");
      return;
    }
    focusSelectedServiceTitle();
  });

  root.querySelector("[data-action=service-delete-selected]")?.addEventListener("click", () => {
    if (adminSelectedServiceIndex < 0 || adminSelectedServiceIndex >= adminServicesDraft.length) {
      setStatus("Выберите строку в таблице, затем «Удалить».", "error");
      return;
    }
    adminServicesDraft.splice(adminSelectedServiceIndex, 1);
    adminSelectedServiceIndex = Math.min(adminSelectedServiceIndex, adminServicesDraft.length - 1);
    renderServicesEditor();
    scheduleServicesPersist();
  });
}

function setLeadSectionStatus(message, type) {
  const el = document.querySelector("#admin-leads-status");
  if (!el) return;
  el.textContent = message || "";
  if (type) {
    el.dataset.type = type;
  } else {
    delete el.dataset.type;
  }
}

function formatLeadTableDate(iso) {
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso || "—";
  }
}

function formatTelemetryCompactDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "—";
  }
}

function previewField(value, maxLen) {
  if (value == null || String(value).trim() === "") {
    return "—";
  }
  const t = String(value).replace(/\s+/g, " ").trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

async function fetchLeadApplications() {
  const response = await apiFetch("/api/v1/applications?limit=100&offset=0", {}, { requiresAuth: true });
  if (response.status === 401) {
    setAdminToken("");
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    throw new Error("Не удалось загрузить заявки");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function setTelemetrySectionStatus(message, type) {
  const el = document.querySelector("#admin-telemetry-status");
  if (!el) return;
  el.textContent = message || "";
  if (type) {
    el.dataset.type = type;
  } else {
    delete el.dataset.type;
  }
}

async function fetchPageBehaviorTelemetry() {
  const q = new URLSearchParams({
    limit: String(telemetryPageLimit),
    offset: String(telemetryPageOffset),
  });
  const response = await apiFetch(`/api/v1/page-behavior-telemetry?${q}`, {}, { requiresAuth: true });
  if (response.status === 401) {
    setAdminToken("");
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    const text = await response.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j?.detail) {
        msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      }
    } catch {
      /* оставляем сырое тело ответа */
    }
    throw new Error(msg || "Не удалось загрузить статистику");
  }
  return response.json();
}

function updateTelemetryPagerUi(total, pageItemsLen) {
  const info = document.querySelector("#admin-telemetry-page-info");
  const prev = document.querySelector("#admin-telemetry-prev");
  const next = document.querySelector("#admin-telemetry-next");
  const sizeSel = document.querySelector("#admin-telemetry-page-size");
  if (sizeSel && String(sizeSel.value) !== String(telemetryPageLimit)) {
    sizeSel.value = String(telemetryPageLimit);
  }
  const t = Math.max(0, Number(total) || 0);
  const from = t === 0 ? 0 : telemetryPageOffset + 1;
  const to = telemetryPageOffset + pageItemsLen;
  if (info) {
    info.textContent =
      t === 0 ? "В базе 0 записей" : `Записи ${from}–${to} из ${t} · страница ${Math.floor(telemetryPageOffset / telemetryPageLimit) + 1}`;
  }
  if (prev) prev.disabled = telemetryPageOffset <= 0;
  if (next) next.disabled = t === 0 || telemetryPageOffset + pageItemsLen >= t;
}

async function renderTelemetryTable(payload) {
  const tbody = document.querySelector("#admin-telemetry-tbody");
  if (!tbody) return;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total) || 0;
  if (items.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan=\"5\" class=\"admin-leads-empty\">На этой странице пусто. Перейдите назад или откройте главную форму для новых снимков.</td></tr>";
    setTelemetrySectionStatus(
      total ? `Всего в базе: ${total}. Смещение ${telemetryPageOffset} — записей нет.` : "Всего записей в базе: 0",
      total ? "success" : "",
    );
    updateTelemetryPagerUi(total, 0);
    await renderCursorHeatmapFromTelemetry(
      document.querySelector("#admin-cursor-heatmap"),
      document.querySelector("#admin-heatmap-placeholder"),
      [],
      { stack: document.querySelector("#admin-heatmap-stack") },
    );
    return;
  }
  tbody.innerHTML = items
    .map((row) => {
      const id = escapeHtml(String(row.id));
      const dt = escapeHtml(formatTelemetryCompactDate(row.received_at));
      const sec = escapeHtml(Number(row.time_on_page_seconds).toFixed(1));
      const btnFull = String(row.buttons_clicked || "");
      const curFull = String(row.cursor_positions || "");
      const btnPrev = escapeHtml(previewField(btnFull, 22));
      const curPrev = escapeHtml(previewField(curFull, 32));
      const titleBtn = escapeHtml(btnFull.slice(0, 2000));
      const titleCur = escapeHtml(curFull.slice(0, 4000));
      return `
        <tr class="admin-telemetry-row">
          <td class="admin-telemetry-col-id">${id}</td>
          <td class="admin-telemetry-col-time">${dt}</td>
          <td class="admin-telemetry-col-sec">${sec}</td>
          <td class="admin-stats-cell-mono admin-telemetry-col-json" title="${titleBtn}">${btnPrev}</td>
          <td class="admin-stats-cell-mono admin-telemetry-col-json" title="${titleCur}">${curPrev}</td>
        </tr>
      `;
    })
    .join("");
  setTelemetrySectionStatus("Данные загружены.", "success");
  updateTelemetryPagerUi(total, items.length);
  await renderCursorHeatmapFromTelemetry(
    document.querySelector("#admin-cursor-heatmap"),
    document.querySelector("#admin-heatmap-placeholder"),
    items,
    { stack: document.querySelector("#admin-heatmap-stack") },
  );
}

async function refreshTelemetrySection() {
  let data = await fetchPageBehaviorTelemetry();
  const total = Number(data?.total) || 0;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0 && total > 0 && telemetryPageOffset >= total) {
    const lastStart = Math.max(0, (Math.ceil(total / telemetryPageLimit) - 1) * telemetryPageLimit);
    telemetryPageOffset = lastStart;
    data = await fetchPageBehaviorTelemetry();
  }
  await renderTelemetryTable(data);
}

function wireAdminTelemetrySection() {
  document.querySelector("#admin-telemetry-refresh-btn")?.addEventListener("click", async () => {
    setTelemetrySectionStatus("Загрузка…", "");
    try {
      telemetryPageOffset = 0;
      await refreshTelemetrySection();
    } catch (error) {
      console.error(error);
      if (error?.message === "UNAUTHORIZED") {
        await renderAdminAuthPage();
        setStatus("Сессия истекла. Войдите снова.", "error");
        return;
      }
      setTelemetrySectionStatus(
        error?.message || "Ошибка загрузки. Проверьте, что в базе есть таблица page_behavior_telemetry.",
        "error",
      );
    }
  });

  document.querySelector("#admin-telemetry-page-size")?.addEventListener("change", async (ev) => {
    const v = parseInt(ev.target.value, 10);
    if (!Number.isFinite(v) || v < 1) return;
    telemetryPageLimit = Math.min(200, v);
    telemetryPageOffset = 0;
    setTelemetrySectionStatus("Загрузка…", "");
    try {
      await refreshTelemetrySection();
    } catch (error) {
      console.error(error);
      setTelemetrySectionStatus(error?.message || "Ошибка загрузки", "error");
    }
  });

  document.querySelector("#admin-telemetry-prev")?.addEventListener("click", async () => {
    if (telemetryPageOffset <= 0) return;
    telemetryPageOffset = Math.max(0, telemetryPageOffset - telemetryPageLimit);
    setTelemetrySectionStatus("Загрузка…", "");
    try {
      await refreshTelemetrySection();
    } catch (error) {
      console.error(error);
      setTelemetrySectionStatus(error?.message || "Ошибка загрузки", "error");
    }
  });

  document.querySelector("#admin-telemetry-next")?.addEventListener("click", async () => {
    telemetryPageOffset += telemetryPageLimit;
    setTelemetrySectionStatus("Загрузка…", "");
    try {
      await refreshTelemetrySection();
    } catch (error) {
      console.error(error);
      telemetryPageOffset = Math.max(0, telemetryPageOffset - telemetryPageLimit);
      setTelemetrySectionStatus(error?.message || "Ошибка загрузки", "error");
    }
  });
}

async function fetchLeadApplication(applicationId) {
  const response = await apiFetch(`/api/v1/applications/${applicationId}`, {}, { requiresAuth: true });
  if (response.status === 401) {
    setAdminToken("");
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Заявка не найдена");
  }
  return response.json();
}

function renderLeadsTable() {
  const tbody = document.querySelector("#admin-leads-tbody");
  if (!tbody) return;
  if (adminLeadsList.length === 0) {
    tbody.innerHTML = "<tr><td colspan=\"7\" class=\"admin-leads-empty\">Заявок пока нет.</td></tr>";
    return;
  }
  tbody.innerHTML = adminLeadsList
    .map((row) => {
      const sel = row.id === adminLeadEditingId ? " is-selected" : "";
      const fn = escapeHtml(row.first_name || "");
      const ln = escapeHtml(row.last_name || "");
      const em = escapeHtml(row.email || "—");
      const ph = escapeHtml(row.phone || "—");
      const bg = escapeHtml(previewField(row.budget, 40));
      const dt = escapeHtml(formatLeadTableDate(row.created_at));
      return `
        <tr data-lead-id="${row.id}" class="${sel.trim()}">
          <td class="admin-leads-id">${row.id}</td>
          <td>${dt}</td>
          <td>${fn}</td>
          <td>${ln}</td>
          <td>${em}</td>
          <td>${ph}</td>
          <td>${bg}</td>
        </tr>
      `;
    })
    .join("");
  tbody.querySelectorAll("tr[data-lead-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = Number(tr.getAttribute("data-lead-id"));
      if (Number.isFinite(id)) {
        void openLeadEditor(id);
      }
    });
  });
}

function buildLeadEditorFormHtml(app) {
  const fieldsHtml = FIELD_CONFIG.map((field) => {
    const val = app[field.name] != null ? String(app[field.name]) : "";
    const escapedVal = escapeHtml(val);
    const attrs = [
      `id="lead-edit-${field.name}"`,
      `name="${field.name}"`,
      field.maxLength ? `maxlength="${field.maxLength}"` : "",
      field.type && field.type !== "textarea" ? `type="${field.type}"` : "",
      'autocomplete="off"',
    ]
      .filter(Boolean)
      .join(" ");
    const control =
      field.type === "textarea"
        ? `<textarea ${attrs} rows="${field.rows ?? 4}">${escapedVal}</textarea>`
        : `<input ${attrs} value="${escapedVal}" />`;
    const req = field.required ? " *" : "";
    return `
      <label class="field" for="lead-edit-${field.name}">
        <span>${field.label}${req}</span>
        ${control}
      </label>
    `;
  }).join("");

  const created = escapeHtml(formatLeadTableDate(app.created_at));
  const updated = escapeHtml(formatLeadTableDate(app.updated_at));

  return `
    <div class="admin-lead-detail-inner">
      <div class="admin-lead-meta">
        <span>Заявка № <strong>${app.id}</strong></span>
        <span>Создана: ${created}</span>
        <span>Обновлена: ${updated}</span>
      </div>
      <form id="admin-lead-edit-form" class="form" novalidate>
        <div class="form-grid">${fieldsHtml}</div>
        <div class="admin-lead-actions">
          <button class="submit-btn admin-btn admin-btn--primary" type="submit">Сохранить изменения</button>
          <button type="button" class="admin-btn admin-btn--danger-sm" id="admin-lead-delete-btn">Удалить заявку</button>
          <button type="button" class="admin-btn admin-btn--ghost" id="admin-lead-close-btn">Закрыть</button>
        </div>
      </form>
    </div>
  `;
}

function collectLeadEditPayload(form) {
  const out = {};
  for (const field of FIELD_CONFIG) {
    const el = form.querySelector(`#lead-edit-${field.name}`);
    let raw = el ? el.value : "";
    if (field.type === "textarea") {
      raw = raw.replace(/\r\n/g, "\n").trimEnd();
    } else {
      raw = raw.trim();
    }
    if (field.name === "email") {
      out.email = raw === "" ? null : raw;
    } else if (!field.required && raw === "") {
      out[field.name] = "";
    } else {
      out[field.name] = raw;
    }
  }
  return out;
}

function closeLeadEditor() {
  adminLeadEditingId = null;
  const wrap = document.querySelector("#admin-lead-detail");
  if (wrap) {
    wrap.innerHTML = "";
    wrap.setAttribute("hidden", "hidden");
  }
  renderLeadsTable();
}

async function openLeadEditor(applicationId) {
  adminLeadEditingId = applicationId;
  renderLeadsTable();
  const wrap = document.querySelector("#admin-lead-detail");
  if (!wrap) return;
  wrap.removeAttribute("hidden");
  wrap.innerHTML = "<p class=\"status\">Загрузка заявки…</p>";
  try {
    const app = await fetchLeadApplication(applicationId);
    wrap.innerHTML = buildLeadEditorFormHtml(app);
    wireLeadEditorForm();
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      await renderAdminAuthPage();
      setStatus("Сессия истекла. Войдите снова.", "error");
      return;
    }
    wrap.innerHTML = `<p class="status" data-type="error">${escapeHtml(error?.message || "Ошибка загрузки")}</p>`;
    setLeadSectionStatus(error?.message || "Не удалось открыть заявку", "error");
  }
}

function wireLeadEditorForm() {
  const form = document.querySelector("#admin-lead-edit-form");
  const delBtn = document.querySelector("#admin-lead-delete-btn");
  const closeBtn = document.querySelector("#admin-lead-close-btn");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLeadSectionStatus("", "");
    const id = adminLeadEditingId;
    if (!id) return;
    const payload = collectLeadEditPayload(form);
    if (!payload.first_name || !payload.last_name || !payload.business_info || !payload.budget) {
      setLeadSectionStatus("Имя, фамилия, блок о бизнесе и бюджет обязательны.", "error");
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const response = await apiFetch(
        `/api/v1/applications/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        { requiresAuth: true },
      );
      if (response.status === 401) {
        setAdminToken("");
        throw new Error("UNAUTHORIZED");
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Сохранение не удалось");
      }
      const saved = await response.json();
      const idx = adminLeadsList.findIndex((r) => r.id === id);
      if (idx >= 0) {
        adminLeadsList[idx] = saved;
      }
      const detailEl = document.querySelector("#admin-lead-detail");
      if (detailEl) {
        detailEl.innerHTML = buildLeadEditorFormHtml(saved);
        wireLeadEditorForm();
      }
      renderLeadsTable();
      setLeadSectionStatus("Заявка сохранена.", "success");
      setStatus("Заявка обновлена.", "success");
    } catch (error) {
      console.error(error);
      if (error?.message === "UNAUTHORIZED") {
        await renderAdminAuthPage();
        setStatus("Сессия истекла. Войдите снова.", "error");
        return;
      }
      setLeadSectionStatus(error?.message || "Ошибка сохранения", "error");
    } finally {
      const sb = document.querySelector("#admin-lead-edit-form button[type=\"submit\"]");
      if (sb) sb.disabled = false;
    }
  });

  delBtn?.addEventListener("click", async () => {
    const id = adminLeadEditingId;
    if (!id) return;
    if (!window.confirm(`Удалить заявку № ${id}? Действие необратимо.`)) {
      return;
    }
    setLeadSectionStatus("", "");
    try {
      const response = await apiFetch(`/api/v1/applications/${id}`, { method: "DELETE" }, { requiresAuth: true });
      if (response.status === 401) {
        setAdminToken("");
        throw new Error("UNAUTHORIZED");
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Удаление не удалось");
      }
      adminLeadsList = adminLeadsList.filter((r) => r.id !== id);
      closeLeadEditor();
      renderLeadsTable();
      setLeadSectionStatus("Заявка удалена.", "success");
      setStatus("Заявка удалена.", "success");
    } catch (error) {
      console.error(error);
      if (error?.message === "UNAUTHORIZED") {
        await renderAdminAuthPage();
        setStatus("Сессия истекла. Войдите снова.", "error");
        return;
      }
      setLeadSectionStatus(error?.message || "Ошибка удаления", "error");
    }
  });

  closeBtn?.addEventListener("click", () => {
    closeLeadEditor();
    setLeadSectionStatus("", "");
  });
}

async function refreshLeadApplications() {
  setLeadSectionStatus("Загрузка заявок…", "");
  try {
    adminLeadsList = await fetchLeadApplications();
    renderLeadsTable();
    setLeadSectionStatus(`Загружено заявок: ${adminLeadsList.length}`, "success");
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      throw error;
    }
    adminLeadsList = [];
    renderLeadsTable();
    setLeadSectionStatus(error?.message || "Ошибка загрузки заявок", "error");
  }
}

function wireAdminLeadsSection() {
  document.querySelector("#admin-leads-refresh-btn")?.addEventListener("click", () => {
    void refreshLeadApplications();
  });
}

async function fetchLatestAdminConfig() {
  const response = await apiFetch(
    "/api/v1/admin-config?limit=1&offset=0&sort=desc",
    {},
    { requiresAuth: true },
  );
  if (response.status === 401) {
    setAdminToken("");
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    throw new Error("Не удалось загрузить настройки сайта");
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0];
}

async function fetchAdmins() {
  const response = await apiFetch("/api/v1/admins?limit=200&offset=0", {}, { requiresAuth: true });
  if (!response.ok) {
    throw new Error("Не удалось загрузить список админов");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function refreshAdminList() {
  const listEl = document.querySelector("#admins-list");
  if (!listEl) return;
  try {
    const admins = await fetchAdmins();
    if (admins.length === 0) {
      listEl.innerHTML = "<p class=\"admin-list-empty\">Администраторы пока не заведены.</p>";
      return;
    }
    listEl.innerHTML = admins
      .map(
        (admin) => `
        <div class="admin-user-row">
          <span class="admin-user-row__meta">id ${admin.id} · <span class="admin-user-row__login">${escapeHtml(admin.login)}</span></span>
          <button type="button" class="admin-btn admin-btn--danger-sm" data-admin-delete="${admin.id}">Удалить</button>
        </div>
      `,
      )
      .join("");
    listEl.querySelectorAll("[data-admin-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const adminId = btn.getAttribute("data-admin-delete");
        btn.disabled = true;
        try {
          const response = await apiFetch(`/api/v1/admins/${adminId}`, { method: "DELETE" }, { requiresAuth: true });
          if (!response.ok) {
            throw new Error("Удаление админа не удалось");
          }
          await refreshAdminList();
          setStatus("Админ удален", "success");
        } catch (error) {
          setStatus(error?.message || "Ошибка удаления админа", "error");
          btn.disabled = false;
        }
      });
    });
  } catch (error) {
    listEl.innerHTML = "<p class=\"admin-list-empty\" data-type=\"error\">Ошибка загрузки списка администраторов.</p>";
  }
}

async function submitAdminConfig(event) {
  event.preventDefault();
  setStatus("", "");
  const form = document.querySelector("#admin-config-form");
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  submitBtn.disabled = true;

  try {
    const idValue = form.querySelector("#config-id").value.trim();
    const budgetRaw = form.querySelector("#budget_slider_config").value;
    const uiLine = form.querySelector("#ui_options").value;

    const payload = {
      services_offered: cloneServicesForApi(),
      budget_slider_config: parseBudgetRangeField(budgetRaw),
      ui_options: buildUiOptionsFromFormNotesInput(uiLine),
    };

    if (!Array.isArray(payload.services_offered)) {
      throw new Error("Внутренняя ошибка: список услуг должен быть массивом.");
    }
    if (
      typeof payload.budget_slider_config !== "object" ||
      payload.budget_slider_config === null ||
      Array.isArray(payload.budget_slider_config)
    ) {
      throw new Error(
        "«Диапазон бюджета»: если это JSON, должен быть объект { }; иначе введите обычный текст (например 900к–1,5кк).",
      );
    }
    if (
      typeof payload.ui_options !== "object" ||
      payload.ui_options === null ||
      Array.isArray(payload.ui_options)
    ) {
      throw new Error("Внутренняя ошибка: настройки интерфейса должны быть объектом.");
    }

    const isPatch = idValue.length > 0;
    const url = isPatch ? `/api/v1/admin-config/${idValue}` : "/api/v1/admin-config";
    const method = isPatch ? "PATCH" : "POST";

    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, { requiresAuth: true });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Сохранение не удалось");
    }

    const saved = await response.json();
    form.querySelector("#config-id").value = saved.id;
    adminServicesDraft = normalizeServicesInput(saved.services_offered);
    renderServicesEditor();
    form.querySelector("#budget_slider_config").value = formatBudgetRangeForDisplay(saved.budget_slider_config);
    form.querySelector("#ui_options").value = absorbUiOptionsExtrasFromServer(saved.ui_options);
    setStatus(`Конфигурация сохранена. ID: ${saved.id}`, "success");
    playSuccessFx(submitBtn);
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "Ошибка сохранения настроек сайта", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function submitCreateAdmin(event) {
  event.preventDefault();
  const form = document.querySelector("#admin-create-form");
  if (!form) return;
  const login = form.querySelector("#new-admin-login").value.trim().toLowerCase();
  const password = form.querySelector("#new-admin-password").value;
  if (!login || !password) {
    setStatus("Введите логин и пароль нового администратора", "error");
    return;
  }
  try {
    const response = await apiFetch(
      "/api/v1/admins",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      },
      { requiresAuth: true },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Создать администратора не удалось");
    }
    form.reset();
    await refreshAdminList();
    setStatus("Новый администратор создан", "success");
  } catch (error) {
    setStatus(error?.message || "Ошибка создания администратора", "error");
  }
}

function logoutAdmin() {
  setAdminToken("");
  window.location.href = "/admin";
}

async function renderAdminPanel() {
  renderLayout(
    `
      <header class="admin-page-header">
        <nav class="admin-toc" aria-label="Разделы страницы">
          <a class="admin-toc__link" href="#admin-section-leads">Заявки</a>
          <a class="admin-toc__link" href="#admin-section-stats">Статистика</a>
          <a class="admin-toc__link" href="#admin-section-site">Сайт</a>
          <a class="admin-toc__link" href="#admin-section-team">Команда</a>
        </nav>
        <button type="button" class="admin-btn admin-btn--ghost" id="logout-btn">Выйти</button>
      </header>
      <p id="status" class="status admin-status-banner" role="status" aria-live="polite"></p>

      <article class="admin-panel" id="admin-section-leads">
        <section class="admin-block admin-block--leads" aria-labelledby="admin-leads-heading">
        <div class="admin-leads-head-row">
          <div>
            <h2 id="admin-leads-heading" class="admin-block__title">Заявки на персональный разбор бизнеса</h2>
            <p class="admin-block__subtitle">Те же поля, что на публичной форме заявки. Выберите строку таблицы, чтобы открыть карточку: правка, сохранение или удаление.</p>
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" id="admin-leads-refresh-btn">Обновить список</button>
        </div>
        <p id="admin-leads-status" class="status admin-leads-status" role="status" aria-live="polite"></p>
        <div class="admin-services-table-wrap admin-leads-table-wrap">
          <table class="admin-services-table admin-leads-table" aria-label="Заявки с формы">
            <thead>
              <tr>
                <th class="admin-leads-col-id">ID</th>
                <th>Создана</th>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Бюджет</th>
              </tr>
            </thead>
            <tbody id="admin-leads-tbody"></tbody>
          </table>
        </div>
        <div id="admin-lead-detail" class="admin-lead-detail" hidden></div>
        </section>
      </article>

      <article class="admin-panel" id="admin-section-stats">
        <section class="admin-block admin-block--stats" aria-labelledby="admin-stats-heading">
          <div class="admin-leads-head-row">
            <div>
              <h2 id="admin-stats-heading" class="admin-block__title">Статистика посещений формы</h2>
              <p class="admin-block__subtitle">
                Снимки с главной страницы (сек на странице, клики, курсор раз в секунду). POST <code>/api/behavior-metrics/</code> →
                <code>page_behavior_telemetry</code>. Таблица с пагинацией; полный JSON в подсказке при наведении на ячейку.
              </p>
            </div>
            <button type="button" class="admin-btn admin-btn--secondary" id="admin-telemetry-refresh-btn">Обновить</button>
          </div>
          <p id="admin-telemetry-status" class="status admin-leads-status" role="status" aria-live="polite"></p>
          <div class="admin-telemetry-toolbar" id="admin-telemetry-toolbar">
            <div class="admin-telemetry-toolbar__left">
              <label class="admin-telemetry-pagesize">
                <span>Строк</span>
                <select id="admin-telemetry-page-size" aria-label="Число строк на странице">
                  <option value="25">25</option>
                  <option value="40" selected>40</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span id="admin-telemetry-page-info" class="admin-telemetry-page-info"></span>
            </div>
            <div class="admin-telemetry-toolbar__nav">
              <button type="button" class="admin-btn admin-btn--ghost admin-telemetry-nav" id="admin-telemetry-prev">Назад</button>
              <button type="button" class="admin-btn admin-btn--ghost admin-telemetry-nav" id="admin-telemetry-next">Вперёд</button>
            </div>
          </div>
          <div class="admin-services-table-wrap admin-leads-table-wrap admin-stats-table-scroll">
            <table class="admin-services-table admin-stats-table admin-telemetry-table" aria-label="Телеметрия с формы заявки">
              <thead>
                <tr>
                  <th class="admin-telemetry-col-id">ID</th>
                  <th class="admin-telemetry-col-time">Время</th>
                  <th class="admin-telemetry-col-sec">Сек.</th>
                  <th>Кнопки</th>
                  <th>Курсор</th>
                </tr>
              </thead>
              <tbody id="admin-telemetry-tbody"></tbody>
            </table>
          </div>
        </section>
        <section class="admin-block admin-block--heatmap" aria-labelledby="admin-heatmap-heading">
          <h3 id="admin-heatmap-heading" class="admin-block__title admin-heatmap-title">Карта активности курсора (Heatmap)</h3>
          <p class="admin-block__subtitle admin-heatmap-sub">
            Подложка — живая главная страница этого же сайта в iframe (масштаб под блок). Если iframe недоступен — <code>/form-heatmap-bg.png</code> или <code>/form-heatmap-bg.svg</code>. Точки нормируются по размеру документа; heatmap по строкам <strong>текущей страницы</strong> таблицы; шкала логарифмическая.
          </p>
          <p id="admin-heatmap-placeholder" class="admin-heatmap-placeholder" hidden></p>
          <div id="admin-heatmap-stack" class="admin-heatmap-stack">
            <iframe
              class="admin-heatmap-live-frame"
              title="Подложка heatmap: главная страница"
            ></iframe>
            <canvas
              id="admin-cursor-heatmap"
              class="admin-heatmap-canvas admin-heatmap-canvas-overlay"
              width="960"
              height="540"
              role="img"
              aria-label="Тепловая карта позиций курсора на странице формы"
            ></canvas>
          </div>
          <div class="admin-heatmap-legend" aria-hidden="true">
            <span>реже</span>
            <div class="admin-heatmap-legend-bar"></div>
            <span>чаще</span>
          </div>
        </section>
      </article>

      <article class="admin-panel" id="admin-section-site">
        <h2 class="admin-panel__title">Настройки сайта</h2>
        <p class="admin-panel__lead">Каталог услуг, подпись диапазона бюджета и короткий текст на странице заявки.</p>
      <form id="admin-config-form" class="form admin-site-form" novalidate>
        <div class="admin-config-id-row">
          <label class="field admin-field-compact" for="config-id">
            <span>ID конфигурации</span>
            <input id="config-id" name="config-id" type="text" readonly class="admin-input-readonly" />
          </label>
        </div>
        <section class="admin-block admin-block--services" aria-labelledby="admin-services-heading">
          <header class="admin-block__head">
            <h2 id="admin-services-heading" class="admin-block__title">Услуги</h2>
            <p class="admin-block__subtitle">Управление списком услуг</p>
            <p class="admin-services-hint admin-services-hint--tight">Данные хранятся в <code>site_admin_config.services_offered</code>. В таблице — порядковый <strong>ID</strong> и <strong>название</strong>; остальные поля в JSON услуги (если были) сохраняются при сохранении конфигурации.</p>
          </header>
          <div id="admin-services-editor" class="admin-services-editor">
            <div class="admin-services-layout">
              <div class="admin-services-table-wrap">
                <table class="admin-services-table" aria-label="Список услуг">
                  <thead>
                    <tr>
                      <th class="admin-svc-col-id">ID</th>
                      <th>Название услуги</th>
                    </tr>
                  </thead>
                  <tbody data-services-tbody></tbody>
                </table>
              </div>
              <aside id="admin-services-toolbar" class="admin-services-toolbar" aria-label="Действия со списком услуг">
                <button type="button" class="admin-tool admin-tool--add" data-action="service-add">+ Добавить</button>
                <button type="button" class="admin-tool admin-tool--edit" data-action="service-edit">✎ Редактировать</button>
                <button type="button" class="admin-tool admin-tool--delete" data-action="service-delete-selected">✖ Удалить</button>
                <p class="admin-toolbar-footnote">При наличии ID конфигурации список синхронизируется с сервером после ввода названия (не раньше — пустая строка не отправляется, чтобы не сбрасывать список).</p>
              </aside>
            </div>
          </div>
        </section>
        <section class="admin-block admin-block--budget" aria-labelledby="admin-budget-heading">
          <h2 id="admin-budget-heading" class="admin-block__title">Диапазон бюджета</h2>
          <p id="budget-slider-hint" class="admin-block__subtitle">Одна строка с подписью для сайта (при необходимости ниже можно вставить JSON с настройками слайдера).</p>
          <textarea
            id="budget_slider_config"
            name="site_budget_label"
            rows="3"
            spellcheck="true"
            class="admin-budget-textarea"
            placeholder="например: 900 тыс. – 1,5 млн"
            aria-describedby="budget-slider-hint"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
          ></textarea>
        </section>
        <section class="admin-block admin-block--extra" aria-labelledby="admin-ui-heading">
          <h2 id="admin-ui-heading" class="admin-block__title">Текст на странице заявки</h2>
          <p id="ui-options-hint" class="admin-block__subtitle">Короткая подпись для посетителей (сохраняется в настройках сайта).</p>
          <input
            id="ui_options"
            name="ui_options"
            type="text"
            class="admin-form-notes-input"
            maxlength="2000"
            spellcheck="true"
            placeholder="Ответ в течение рабочего дня"
            aria-describedby="ui-options-hint"
            autocomplete="off"
          />
        </section>
        <div class="admin-form-actions">
          <button class="submit-btn admin-btn admin-btn--primary" type="submit">Сохранить настройки сайта</button>
        </div>
      </form>
      </article>

      <article class="admin-panel" id="admin-section-team">
        <h2 class="admin-panel__title">Администраторы</h2>
        <p class="admin-panel__lead">Новый логин и пароль — кнопка ниже; список существующих — с аккуратным удалением.</p>
      <form id="admin-create-form" class="form admin-team-form" novalidate>
        <div class="form-grid admin-team-grid">
        <label class="field" for="new-admin-login">
          <span>Логин нового админа</span>
          <input id="new-admin-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
        </label>
        <label class="field" for="new-admin-password">
          <span>Пароль нового админа</span>
          <input id="new-admin-password" type="password" minlength="6" maxlength="200" required />
        </label>
        </div>
        <div class="admin-form-actions admin-form-actions--tight">
          <button class="submit-btn admin-btn admin-btn--secondary-solid" type="submit">Добавить администратора</button>
        </div>
      </form>
      <div id="admins-list" class="admin-admin-list"></div>
      </article>
    `,
    {
      title: "Заявки и настройки сайта",
      subtitle:
        "Заявки с формы; раздел «Статистика» — телеметрия с главной страницы; ниже — услуги, бюджет, текст для формы и администраторы.",
      eyebrow: "Админ-панель",
      showAdminLink: false,
    },
  );

  document.querySelector(".page")?.classList.add("page--admin");
  document.querySelector(".card")?.classList.add("admin-card");

  const form = document.querySelector("#admin-config-form");
  form.addEventListener("submit", submitAdminConfig);
  document.querySelector("#logout-btn").addEventListener("click", logoutAdmin);
  document.querySelector("#admin-create-form").addEventListener("submit", submitCreateAdmin);

  bindServicesEditorEvents();
  wireServicesToolbar();
  wireAdminLeadsSection();
  wireAdminTelemetrySection();
  closeLeadEditor();

  try {
    const config = await fetchLatestAdminConfig();
    if (config) {
      form.querySelector("#config-id").value = config.id;
      adminServicesDraft = normalizeServicesInput(config.services_offered);
      adminSelectedServiceIndex = -1;
      renderServicesEditor();
      form.querySelector("#budget_slider_config").value = formatBudgetRangeForDisplay(config.budget_slider_config);
      form.querySelector("#ui_options").value = absorbUiOptionsExtrasFromServer(config.ui_options);
      setStatus(`Загружена конфигурация ID: ${config.id}`, "success");
    } else {
      adminServicesDraft = [];
      adminSelectedServiceIndex = -1;
      renderServicesEditor();
      form.querySelector("#budget_slider_config").value = "";
      adminUiOptionsExtras = {};
      form.querySelector("#ui_options").value = "";
      setStatus("Конфигурация пока не создана. Нажмите сохранить для создания.", "success");
    }
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      await renderAdminAuthPage();
      setStatus("Сессия истекла или токен недействителен. Войдите снова.", "error");
      return;
    }
    setStatus("Не удалось загрузить настройки сайта. Проверьте доступность API и базы данных.", "error");
  }
  await refreshAdminList();
  try {
    await refreshLeadApplications();
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      await renderAdminAuthPage();
      setStatus("Сессия истекла или токен недействителен. Войдите снова.", "error");
      return;
    }
    setLeadSectionStatus(error?.message || "Не удалось загрузить заявки", "error");
  }

  try {
    await refreshTelemetrySection();
  } catch (error) {
    console.error(error);
    if (error?.message === "UNAUTHORIZED") {
      await renderAdminAuthPage();
      setStatus("Сессия истекла или токен недействителен. Войдите снова.", "error");
      return;
    }
    setTelemetrySectionStatus(
      error?.message || "Не удалось загрузить статистику (проверьте таблицу page_behavior_telemetry).",
      "error",
    );
  }
}

async function loginAdmin(event) {
  event.preventDefault();
  const form = document.querySelector("#admin-login-form");
  if (!form) return;
  const login = form.querySelector("#admin-login").value.trim().toLowerCase();
  const password = form.querySelector("#admin-password").value;
  if (!login || !password) {
    setStatus("Введите логин и пароль", "error");
    return;
  }
  try {
    const response = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Неверные учетные данные");
    }
    const data = await response.json();
    setAdminToken(data.token);
    await renderAdminPanel();
  } catch (error) {
    setStatus(error?.message || "Ошибка входа", "error");
  }
}

async function registerFirstAdmin(event) {
  event.preventDefault();
  const form = document.querySelector("#admin-register-form");
  if (!form) return;
  const login = form.querySelector("#register-login").value.trim().toLowerCase();
  const password = form.querySelector("#register-password").value;
  if (!login || !password) {
    setStatus("Введите логин и пароль для регистрации", "error");
    return;
  }
  try {
    const response = await apiFetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Регистрация недоступна");
    }
    const data = await response.json();
    setAdminToken(data.token);
    await renderAdminPanel();
  } catch (error) {
    setStatus(error?.message || "Ошибка регистрации", "error");
  }
}

async function renderAdminAuthPage() {
  let hasAdmins = true;
  let bootstrapOk = false;
  try {
    const response = await apiFetch("/api/v1/auth/bootstrap");
    if (response.ok) {
      bootstrapOk = true;
      const payload = await response.json();
      hasAdmins = Boolean(payload.has_admins);
    } else {
      // Не удалось узнать состояние (404/5xx и т.д.): показываем регистрацию —
      // бэкенд вернёт 403 «registration closed», если админы уже есть.
      hasAdmins = false;
    }
  } catch (error) {
    console.error(error);
    hasAdmins = false;
  }

  const registerHint =
    hasAdmins && bootstrapOk
      ? `<p class="status">Регистрация скрыта: в базе уже есть хотя бы один администратор. Войдите под существующим логином.</p>`
      : !bootstrapOk
        ? `<p class="status">Не удалось проверить наличие админов. Если вы первый администратор, используйте форму ниже; иначе сервер отклонит регистрацию.</p>`
        : "";

  renderLayout(
    `
      ${registerHint}
      <form id="admin-login-form" class="form" novalidate>
        <label class="field" for="admin-login">
          <span>Логин</span>
          <input id="admin-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
        </label>
        <label class="field" for="admin-password">
          <span>Пароль</span>
          <input id="admin-password" type="password" minlength="6" maxlength="200" required />
        </label>
        <button class="submit-btn" type="submit">Войти</button>
      </form>
      ${
        !hasAdmins
          ? `
        <hr />
        <form id="admin-register-form" class="form" novalidate>
          <label class="field" for="register-login">
            <span>Логин первого администратора</span>
            <input id="register-login" type="text" minlength="3" maxlength="128" autocomplete="off" required />
          </label>
          <label class="field" for="register-password">
            <span>Пароль</span>
            <input id="register-password" type="password" minlength="6" maxlength="200" required />
          </label>
          <button class="submit-btn" type="submit">Зарегистрироваться</button>
        </form>
      `
          : ""
      }
      <p id="status" class="status" role="status" aria-live="polite"></p>
    `,
    {
      title: "Вход в админ-панель",
      subtitle: "Авторизация выполняется по логину и паролю с выдачей JWT токена.",
      eyebrow: "Вход администратора",
      showAdminLink: false,
    },
  );
  document.querySelector("#admin-login-form").addEventListener("submit", loginAdmin);
  if (!hasAdmins) {
    document.querySelector("#admin-register-form").addEventListener("submit", registerFirstAdmin);
  }
}

async function initAdminRoute() {
  if (!getAdminToken()) {
    await renderAdminAuthPage();
    return;
  }
  try {
    const response = await apiFetch(
      "/api/v1/admin-config?limit=1&offset=0&sort=desc",
      {},
      { requiresAuth: true },
    );
    if (response.status === 401) {
      setAdminToken("");
      await renderAdminAuthPage();
      setStatus("Сессия недействительна. Войдите снова.", "error");
      return;
    }
  } catch (error) {
    console.error(error);
    setAdminToken("");
    await renderAdminAuthPage();
    return;
  }
  await renderAdminPanel();
}

function bootstrap() {
  if (window.location.pathname.startsWith("/admin")) {
    void initAdminRoute();
    return;
  }
  renderLeadFormPage();
}

bootstrap();
