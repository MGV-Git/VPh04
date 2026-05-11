/**
 * Heatmap: подложка — живой iframe с главной страницей (/) того же сайта;
 * поверх canvas — тепло (lighter). Запас: PNG → SVG по URL → встроенный data-URL.
 */

const MAX_POINTS = 120_000;
const GRID_COLS = 140;
const GRID_ROWS = 80;

const RAW_BASE = import.meta.env.BASE_URL || "/";
const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;
const BG_PNG = `${BASE}form-heatmap-bg.png`;
const BG_SVG = `${BASE}form-heatmap-bg.svg`;

/** Если сеть и iframe недоступны — заметный фон (не «чистый чёрный»). */
const EMBEDDED_BG_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2418"/><stop offset="1" stop-color="#15120c"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><rect x="48" y="72" width="864" height="396" rx="14" fill="none" stroke="rgba(248,215,143,0.45)" stroke-width="2"/><text x="480" y="44" fill="#f8cc6f" font-size="16" text-anchor="middle" font-family="system-ui,sans-serif">Подложка (офлайн)</text></svg>`,
)}`;

function parseCursorSamplesFromRow(cursorPositionsRaw) {
  const raw = String(cursorPositionsRaw || "").trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const p of arr) {
      if (!p || typeof p !== "object") continue;
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({ x, y });
    }
    return out;
  } catch {
    return [];
  }
}

function collectPoints(items) {
  const points = [];
  for (const row of items || []) {
    points.push(...parseCursorSamplesFromRow(row.cursor_positions));
  }
  if (points.length > MAX_POINTS) {
    const step = Math.ceil(points.length / MAX_POINTS);
    const sampled = [];
    for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
    return sampled;
  }
  return points;
}

function boundsOfPoints(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }
  return { minX, maxX, minY, maxY };
}

function colorForIntensityOverlay(t) {
  const h = 205 - t * 205;
  const a = 0.12 + t * 0.58;
  return `hsla(${h}, 100%, 62%, ${a})`;
}

function smoothGrid2D(grid, cols, rows) {
  const out = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          s += grid[yy * cols + xx];
          n += 1;
        }
      }
      out[y * cols + x] = s / n;
    }
  }
  return out;
}

function loadImageUrl(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

async function loadRasterBackground() {
  let im = await loadImageUrl(BG_PNG);
  if (!im) im = await loadImageUrl(BG_SVG);
  if (!im) im = await loadImageUrl(EMBEDDED_BG_DATA_URI);
  return im;
}

function readIframeDocumentSize(iframe) {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;
    const se = doc.documentElement;
    const b = doc.body;
    const w = Math.max(
      se?.scrollWidth || 0,
      b?.scrollWidth || 0,
      se?.offsetWidth || 0,
      b?.offsetWidth || 0,
      se?.clientWidth || 0,
    );
    const h = Math.max(
      se?.scrollHeight || 0,
      b?.scrollHeight || 0,
      se?.offsetHeight || 0,
      b?.offsetHeight || 0,
      se?.clientHeight || 0,
    );
    /** Не требовать 320×400: у iframe по умолчанию ширина 300px — иначе вечный отказ. */
    if (w < 2 || h < 2) return null;
    return { w, h };
  } catch {
    return null;
  }
}

async function waitForIframeDocumentSize(iframe, maxAttempts = 90) {
  for (let i = 0; i < maxAttempts; i++) {
    const sz = readIframeDocumentSize(iframe);
    if (sz) return sz;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

const HEATMAP_CANVAS_BASE_W = 960;

function resetHeatmapStackAndCanvas(stack, canvas) {
  stack.style.width = "";
  stack.style.height = "";
  canvas.width = HEATMAP_CANVAS_BASE_W;
  canvas.height = 540;
}

/**
 * Контейнер и bitmap canvas с тем же соотношением сторон, что и документ формы,
 * чтобы «contain» давал крупную подложку, а не кляксу в 16:9.
 */
function fitStackAndCanvasToDocument(stack, canvas, docW, docH) {
  const dw = Math.max(docW, 1);
  const dh = Math.max(docH, 1);
  const maxW = 960;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const maxH = Math.min(Math.round(vh * 0.88), 2400);
  const ar = dw / dh;
  let boxW = maxW;
  let boxH = Math.round(boxW / ar);
  if (boxH > maxH) {
    boxH = maxH;
    boxW = Math.round(boxH * ar);
  }
  boxW = Math.max(280, boxW);
  boxH = Math.max(240, boxH);
  stack.style.width = `${boxW}px`;
  stack.style.height = `${boxH}px`;

  const ch = Math.min(4000, Math.max(320, Math.round((HEATMAP_CANVAS_BASE_W * dh) / dw)));
  canvas.width = HEATMAP_CANVAS_BASE_W;
  canvas.height = ch;
}

function layoutIframeToStack(iframe, docW, docH, stack) {
  const rect = stack.getBoundingClientRect();
  const viewW = Math.max(1, rect.width);
  const viewH = Math.max(1, rect.height);
  iframe.style.display = "block";
  iframe.style.width = `${docW}px`;
  iframe.style.height = `${docH}px`;
  const s = Math.min(viewW / docW, viewH / docH);
  const ox = (viewW - docW * s) / 2;
  const oy = (viewH - docH * s) / 2;
  iframe.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
  iframe.style.transformOrigin = "0 0";
  return { viewW, viewH, docW, docH, scale: s, ox, oy };
}

function refDocumentSize(points, iframeSize) {
  const { minX, maxX, minY, maxY } = boundsOfPoints(points);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  if (iframeSize) {
    return {
      refW: Math.max(iframeSize.w, maxX * 1.02, 960),
      refH: Math.max(iframeSize.h, maxY * 1.02, 800),
    };
  }
  return {
    refW: Math.max(spanX * 1.08, 960),
    refH: Math.max(spanY * 1.08, 800),
  };
}

/** Координаты pageX/pageY — совпадают с размером документа во iframe. */
function fillHeatGridFromDocNorm(grid, points, refW, refH) {
  const rw = Math.max(refW, 1);
  const rh = Math.max(refH, 1);
  for (const { x, y } of points) {
    const u = Math.min(1, Math.max(0, x / rw));
    const v = Math.min(1, Math.max(0, y / rh));
    const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(u * GRID_COLS)));
    const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(v * GRID_ROWS)));
    grid[cy * GRID_COLS + cx] += 1;
  }
}

/** Статичный фон / нет размера документа — растягиваем по min/max выборки, чтобы не схлопываться в угол. */
function fillHeatGridFromBoundsNorm(grid, points) {
  const { minX, maxX, minY, maxY } = boundsOfPoints(points);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const pad = 0.03;
  const spanU = 1 - 2 * pad;
  const spanV = 1 - 2 * pad;
  for (const { x, y } of points) {
    const u = pad + spanU * ((x - minX) / spanX);
    const v = pad + spanV * ((y - minY) / spanY);
    const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(u * GRID_COLS)));
    const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(v * GRID_ROWS)));
    grid[cy * GRID_COLS + cx] += 1;
  }
}

function paintHeatCells(ctx, w, h) {
  const cellW = w / GRID_COLS;
  const cellH = h / GRID_ROWS;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let cy = 0; cy < GRID_ROWS; cy++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const c = ctx.__heatSmooth?.[cy * GRID_COLS + cx];
      if (!c || c <= 0) continue;
      const logMax = ctx.__heatLogMax || 1;
      const t = logMax > 0 ? Math.log(1 + c) / logMax : 0;
      ctx.fillStyle = colorForIntensityOverlay(t);
      const pad = 1.15;
      ctx.fillRect(cx * cellW - pad, cy * cellH - pad, cellW + pad * 2, cellH + pad * 2);
    }
  }
  ctx.restore();
}

/**
 * @param {HTMLCanvasElement | null} canvas
 * @param {HTMLElement | null} placeholder
 * @param {unknown[]} items
 * @param {{ stack?: HTMLElement | null }} [opts]
 */
export async function renderCursorHeatmapFromTelemetry(canvas, placeholder, items, opts = {}) {
  const stack = opts.stack || null;
  const iframe = stack?.querySelector?.(".admin-heatmap-live-frame") ?? null;

  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const points = collectPoints(items);
  if (placeholder) {
    placeholder.hidden = points.length > 0;
    placeholder.textContent =
      points.length === 0
        ? "Нет координат курсора в загруженных записях — откройте главную форму и подвигайте мышью."
        : "";
  }

  let iframeSize = null;
  let usedLive = false;

  if (iframe && stack) {
    iframe.style.display = "block";
    /** Даём внутреннему документу нормальную область вёрстки до измерения scrollHeight. */
    iframe.style.width = "1280px";
    iframe.style.height = "2400px";
    const base = window.location.origin || "";
    const target = `${base}/`;
    if (iframe.getAttribute("src") !== target) {
      iframe.setAttribute("src", target);
    }
    await new Promise((resolve) => {
      if (iframe.contentDocument?.readyState === "complete") {
        resolve();
        return;
      }
      iframe.addEventListener("load", () => resolve(), { once: true });
      iframe.addEventListener("error", () => resolve(), { once: true });
      setTimeout(resolve, 12000);
    });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    iframeSize = await waitForIframeDocumentSize(iframe);
    if (iframeSize) {
      usedLive = true;
    } else {
      iframe.style.display = "none";
    }
  } else if (iframe) {
    iframe.style.display = "none";
  }

  if (usedLive && iframeSize && stack && iframe) {
    fitStackAndCanvasToDocument(stack, canvas, iframeSize.w, iframeSize.h);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    layoutIframeToStack(iframe, iframeSize.w, iframeSize.h, stack);
  } else if (stack) {
    resetHeatmapStackAndCanvas(stack, canvas);
  }

  const w = canvas.width;
  const h = canvas.height;

  const { refW, refH } = refDocumentSize(points, iframeSize);

  const grid = new Float32Array(GRID_COLS * GRID_ROWS);
  if (usedLive && iframeSize) {
    fillHeatGridFromDocNorm(grid, points, refW, refH);
  } else {
    fillHeatGridFromBoundsNorm(grid, points);
  }
  const smoothed = smoothGrid2D(grid, GRID_COLS, GRID_ROWS);
  let maxVal = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > maxVal) maxVal = smoothed[i];
  }
  const logMax = Math.log(1 + maxVal);
  ctx.__heatSmooth = smoothed;
  ctx.__heatLogMax = logMax;

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);

  if (!usedLive) {
    const bg = await loadRasterBackground();
    if (bg) {
      ctx.drawImage(bg, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#0f0d09";
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (points.length === 0) {
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 240, 210, 0.8)";
    ctx.fillText(usedLive ? "Нет точек — показана живая главная страница." : "Нет точек для heatmap.", 16, 36);
    delete ctx.__heatSmooth;
    delete ctx.__heatLogMax;
    return;
  }

  paintHeatCells(ctx, w, h);

  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 248, 220, 0.92)";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;
  const mode = usedLive ? "живая страница" : "статичный фон";
  const norm = usedLive && iframeSize ? "по документу" : "по min–max точек";
  const cap = `точек: ${points.length} · ${mode} · ${norm} · ref ${Math.round(refW)}×${Math.round(refH)} px`;
  ctx.strokeText(cap, 10, h - 10);
  ctx.fillText(cap, 10, h - 10);

  delete ctx.__heatSmooth;
  delete ctx.__heatLogMax;
}
