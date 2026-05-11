import "./styles.css";

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

const form = document.querySelector("#application-form");
const statusEl = document.querySelector("#status");
let successFxTimer = null;

function renderForm() {
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

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
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
  const submitBtn = form.querySelector('button[type="submit"]');
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
      credentials: "same-origin",
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

renderForm();
form.addEventListener("submit", submitForm);
