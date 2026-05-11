/**
 * Cursor sintético con movimiento; el clic ocurre al pulsar «Siguiente».
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureFakeCursor() {
  let el = document.getElementById("geFakeCursor");
  if (!el) {
    el = document.createElement("div");
    el.id = "geFakeCursor";
    el.className = "ge-fake-cursor";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<span class="ge-fake-cursor__ring"></span><span class="ge-fake-cursor__dot"></span>';
    document.body.appendChild(el);
  }
  el.classList.add("ge-fake-cursor--visible");
  return el;
}

function hideFakeCursor() {
  document.getElementById("geFakeCursor")?.classList.remove("ge-fake-cursor--visible");
}

function hideSyntheticCaption() {
  const el = document.getElementById("geTourSyntheticCaption");
  if (el) {
    el.classList.remove("ge-tour-synthetic-caption--visible");
    el.textContent = "";
  }
}

/** Sincroniza posición sin animar (p. ej. siguiendo el swiper cada frame). */
export function setTourCursorClient(x, y) {
  const el = ensureFakeCursor();
  el.style.transition = "none";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  void el.offsetHeight;
  el.style.removeProperty("transition");
}

export async function moveTourCursorToClient(x, y, durationMs = 520) {
  const el = ensureFakeCursor();
  el.style.transition = `left ${durationMs}ms ease-out, top ${durationMs}ms ease-out`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  await sleep(durationMs + 50);
}

export async function moveTourCursorToElementCenter(el, opts = {}) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  await moveTourCursorToClient(
    r.left + r.width / 2 + (opts.dx || 0),
    r.top + r.height / 2 + (opts.dy || 0),
    opts.durationMs ?? 520,
  );
}

export async function moveTourCursorMidpointOfElements(elements, durationMs = 520) {
  if (!elements?.length) return;
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (const node of elements) {
    const r = node.getBoundingClientRect();
    minL = Math.min(minL, r.left);
    minT = Math.min(minT, r.top);
    maxR = Math.max(maxR, r.right);
    maxB = Math.max(maxB, r.bottom);
  }
  await moveTourCursorToClient((minL + maxR) / 2, (minT + maxB) / 2, durationMs);
}

export function hideTourFakeCursor() {
  hideFakeCursor();
}

/**
 * @returns {boolean}
 */
export async function prepareBarrioPickForTour() {
  const tour = window.__geniusNdviBarriosTour;
  if (!tour?.beforeMap || !tour.layerBeforeYear) return false;
  document.querySelectorAll(".maplibregl-popup").forEach((p) => p.remove());
  const pick = pickBarrioScreenPixel(tour.beforeMap, tour.layerBeforeYear);
  if (!pick) {
    delete window.__geniusTourBarrioPick;
    return false;
  }
  const canvas = tour.beforeMap.getCanvas();
  const crect = canvas.getBoundingClientRect();
  window.__geniusTourBarrioPick = { ...pick, map: tour.beforeMap };
  await moveTourCursorToClient(crect.left + pick.px, crect.top + pick.py, 560);
  return true;
}

async function pulseClick() {
  const el = document.getElementById("geFakeCursor");
  if (!el) return;
  el.classList.add("ge-fake-cursor--click");
  await sleep(160);
  el.classList.remove("ge-fake-cursor--click");
}

export async function pulseClickTourTarget(target) {
  if (!target) return;
  await pulseClick();
  if (typeof target.click === "function") target.click();
  else
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
  await sleep(280);
}

async function waitForNdviBarriosMaps(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const tour = window.__geniusNdviBarriosTour;
    if (
      tour?.beforeMap &&
      tour.beforeMap.getLayer?.("vectorLayerBeforeYear") &&
      window.compareInstance &&
      document.getElementById("beforeYearSelector")
    ) {
      await sleep(200);
      return true;
    }
    await sleep(120);
  }
  return false;
}

function applyDistinctYearPair() {
  const yl = document.getElementById("beforeYearSelector");
  const yr = document.getElementById("afterYearSelector");
  if (!yl || !yr || yl.options.length < 2) return;
  const ys = Array.from(yl.options).map((o) => o.value);
  let i = Math.max(0, ys.length - 3);
  let j = ys.length - 1;
  yl.value = ys[i];
  yr.value = ys[j];
  if (yl.value === yr.value && ys.length > 1) yr.value = ys[ys.length - 2];
  yl.dispatchEvent(new Event("change", { bubbles: true }));
  yr.dispatchEvent(new Event("change", { bubbles: true }));
}

let compareAnimRaf = null;
function stopCompareSweep() {
  if (compareAnimRaf) {
    cancelAnimationFrame(compareAnimRaf);
    compareAnimRaf = null;
  }
}

function syncCompareCursorToSwiper(p04) {
  const swiper = p04?.querySelector(".compare-swiper-vertical");
  if (swiper) {
    const r = swiper.getBoundingClientRect();
    setTourCursorClient(r.left + r.width / 2, r.top + r.height / 2);
  }
}

/** Animación del comparador; el puntero sigue el asa del swiper. */
export function runCompareSweepWithCursorFollow(shouldAbort) {
  stopCompareSweep();
  const cmp = window.compareInstance;
  const p04 = document.getElementById("p04");
  if (!cmp || !p04 || typeof cmp.setSlider !== "function") return;
  ensureFakeCursor();
  let start = null;
  const dur = 3600;
  function loop(ts) {
    if (shouldAbort()) {
      compareAnimRaf = null;
      return;
    }
    if (!start) start = ts;
    const u = Math.min(1, (ts - start) / dur);
    const tri = u < 0.5 ? u * 2 : 2 - u * 2;
    const w = p04.getBoundingClientRect().width;
    const x = Math.max(12, Math.min(w - 12, w * (0.1 + tri * 0.8)));
    cmp.setSlider(x);
    syncCompareCursorToSwiper(p04);
    if (u < 1) compareAnimRaf = requestAnimationFrame(loop);
    else {
      compareAnimRaf = null;
      cmp.setSlider(Math.max(12, w * 0.5));
      syncCompareCursorToSwiper(p04);
    }
  }
  syncCompareCursorToSwiper(p04);
  compareAnimRaf = requestAnimationFrame(loop);
}

function pickBarrioScreenPixel(map, layerId) {
  const c = map.getContainer();
  const w = c.clientWidth;
  const h = c.clientHeight;
  for (let gy = 0; gy < 12; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      const px = 0.12 * w + (gx / 16) * 0.76 * w;
      const py = 0.1 * h + (gy / 12) * 0.8 * h;
      try {
        const feats = map.queryRenderedFeatures([px, py], { layers: [layerId] });
        if (feats?.length) return { px, py };
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function clickMapCanvasAt(map, px, py) {
  const canvas = map.getCanvas();
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + px;
  const clientY = rect.top + py;
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };
  canvas.dispatchEvent(new MouseEvent("mousedown", opts));
  canvas.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
  canvas.dispatchEvent(new MouseEvent("click", opts));
}

export function cleanupSyntheticTourUi() {
  stopCompareSweep();
  hideFakeCursor();
  hideSyntheticCaption();
  delete window.__geniusTourBarrioPick;
}

function makeBail() {
  return async () => {
    stopCompareSweep();
    hideFakeCursor();
    hideSyntheticCaption();
  };
}

export const syntheticTourSegments = {
  async clickAreasVerdes({ shouldAbort }) {
    const bail = makeBail();
    if (shouldAbort()) return bail();
    const avImg = document.querySelector('.ge-plank img[alt="Áreas verdes"]');
    if (avImg) await pulseClickTourTarget(avImg);
    else if (typeof window.toggleNDVIButtons === "function") window.toggleNDVIButtons();
    await sleep(200);
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },

  async clickBarriosAndWaitMaps({ shouldAbort }) {
    const bail = makeBail();
    const btnBarrios = document.getElementById("ndviButtonB");
    if (!btnBarrios) {
      await sleep(400);
      return bail();
    }
    if (shouldAbort()) return bail();
    await pulseClickTourTarget(btnBarrios);
    const ok = await waitForNdviBarriosMaps(28000);
    if (!ok || shouldAbort()) return bail();
    await sleep(150);
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },

  async applyYearSelectorsTour({ shouldAbort }) {
    const bail = makeBail();
    if (shouldAbort()) return bail();
    await pulseClick();
    applyDistinctYearPair();
    await sleep(400);
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },

  async compareSweep({ shouldAbort }) {
    const bail = makeBail();
    if (shouldAbort()) return bail();
    runCompareSweepWithCursorFollow(shouldAbort);
    await sleep(4000);
    stopCompareSweep();
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },

  async expandChartDock({ shouldAbort }) {
    const bail = makeBail();
    const pill = document.getElementById("geChartDockPill");
    if (!pill) return bail();
    if (shouldAbort()) return bail();
    await pulseClickTourTarget(pill);
    document.body.classList.remove("genius-explorer--tour-chart-pill-anchor");
    await sleep(480);
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },

  async barrioClickOpenModal({ shouldAbort }) {
    const bail = makeBail();
    const pick = window.__geniusTourBarrioPick;
    if (!pick?.map) return bail();
    if (shouldAbort()) return bail();
    await pulseClick();
    clickMapCanvasAt(pick.map, pick.px, pick.py);
    await sleep(650);
    if (shouldAbort()) return bail();
    let exploreBtn = document.querySelector(".maplibregl-popup .popup-explore-btn");
    if (!exploreBtn) {
      await sleep(400);
      exploreBtn = document.querySelector(".maplibregl-popup .popup-explore-btn");
    }
    if (exploreBtn) await pulseClickTourTarget(exploreBtn);
    await sleep(600);
    if (shouldAbort()) return bail();
    hideSyntheticCaption();
  },
};
