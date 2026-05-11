/**
 * Сбор метрик на публичной форме: время на странице, клики по кнопкам,
 * позиции курсора раз в секунду (для последующей hit-map).
 * Отправка POST /api/behavior-metrics/ раз в секунду.
 */

const BEHAVIOR_ENDPOINT = "/api/behavior-metrics/";

function describeButtonTarget(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
  const tag = el.tagName.toLowerCase();
  const isButton =
    tag === "button" ||
    tag === "input" ||
    el.getAttribute("role") === "button";
  if (!isButton) return null;
  if (tag === "input") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type !== "submit" && type !== "button" && type !== "reset") return null;
  }
  const id = el.id?.trim();
  if (id) return `id:${id}`;
  const name = el.getAttribute("name")?.trim();
  if (name) return `name:${name}`;
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return `aria:${aria.slice(0, 120)}`;
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (text) return `text:${text}`;
  return `${tag}`;
}

function resolveClickableButton(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(
    'button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]',
  );
}

function onDocumentClick(ev) {
  const el = resolveClickableButton(ev.target);
  const key = describeButtonTarget(el);
  if (!key) return;
  const counts = onDocumentClick._counts || (onDocumentClick._counts = {});
  counts[key] = (counts[key] || 0) + 1;
}

function getButtonCounts() {
  return onDocumentClick._counts ? { ...onDocumentClick._counts } : {};
}

export function startPublicBehaviorMetrics() {
  const wallStart = Date.now();
  const perfStart = performance.now();
  const cursorSamples = [];
  let lastPointer = { x: 0, y: 0 };

  function onPointerMove(e) {
    lastPointer = { x: Math.round(e.pageX), y: Math.round(e.pageY) };
  }

  document.addEventListener("click", onDocumentClick, true);
  document.addEventListener("pointermove", onPointerMove, { passive: true });

  function buildPayload() {
    const timeOnPage = (performance.now() - perfStart) / 1000;
    const buttonsClicked = JSON.stringify(getButtonCounts());
    const cursorPositions = JSON.stringify(cursorSamples);
    return {
      application_id: 0,
      time_on_page: timeOnPage,
      buttons_clicked: buttonsClicked,
      cursor_positions: cursorPositions,
      return_frequency: 0,
    };
  }

  async function send() {
    const body = buildPayload();
    try {
      const res = await fetch(BEHAVIOR_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
        keepalive: true,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn("[behavior-metrics] POST failed:", res.status, errText.slice(0, 500));
      }
    } catch (e) {
      console.warn("[behavior-metrics] POST error:", e);
    }
  }

  const tick = () => {
    const t = (Date.now() - wallStart) / 1000;
    cursorSamples.push({ t, x: lastPointer.x, y: lastPointer.y });
    void send();
  };

  const intervalId = window.setInterval(tick, 1000);

  function teardown() {
    window.clearInterval(intervalId);
    document.removeEventListener("click", onDocumentClick, true);
    document.removeEventListener("pointermove", onPointerMove);
    onDocumentClick._counts = {};
  }

  function flushBeacon() {
    try {
      const body = buildPayload();
      navigator.sendBeacon(
        BEHAVIOR_ENDPOINT,
        new Blob([JSON.stringify(body)], { type: "application/json" }),
      );
    } catch {
      /* ignore */
    }
  }

  window.addEventListener("pagehide", flushBeacon, { once: true });

  return teardown;
}
