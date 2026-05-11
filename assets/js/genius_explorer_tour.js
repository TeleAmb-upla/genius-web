/**
 * Recorrido guiado: máscara con 1 o 2 recortes; puntero animado; «Siguiente» ejecuta el clic.
 */

import {
  syntheticTourSegments,
  cleanupSyntheticTourUi,
  moveTourCursorToClient,
  moveTourCursorToElementCenter,
  moveTourCursorMidpointOfElements,
  hideTourFakeCursor,
  prepareBarrioPickForTour,
} from "./genius_explorer_tour_synthetic.js";

const STORAGE_KEY = "genius_explorer_tour_v1_done";

async function closeNdviZonalExplorerForTour() {
  try {
    const m = await import("./ndvi/ndvi_zonal_explorer.js");
    m.closeNdviZonalExplorer();
  } catch (e) {
    /* ignore */
  }
}

const STEPS = [
  {
    id: "ge-tour-header",
    placement: "bottom",
    title: "Bienvenida",
    text: "Explorador **GENIUS**: en cada paso el **puntero se desplaza** hasta el control indicado; con **Siguiente** se reproduce el **clic** (u otra acción) sobre ese objetivo.",
    showBrand: true,
    cursor: { type: "none" },
  },
  {
    id: "ge-tour-plank",
    placement: "right",
    title: "Catálogo de capas",
    text: "Puntero sobre **Áreas verdes**. **Siguiente** lo activa.",
    syntheticAfterNext: "clickAreasVerdes",
    cursor: { type: "selector", selector: '.ge-plank img[alt="Áreas verdes"]' },
  },
  {
    id: "ge-tour-scale",
    placement: "right",
    title: "Escala del mapa",
    text: "Sobre **Barrios**. **Siguiente** carga el comparador.",
    syntheticAfterNext: "clickBarriosAndWaitMaps",
    cursor: { type: "id", id: "ndviButtonB" },
  },
  {
    highlightIds: ["beforeYearSelector", "afterYearSelector"],
    spotlightMode: "separate",
    placement: "bottom",
    title: "Selectores de año",
    text: "Cada **Año** tiene su propio recorte. **Siguiente** asigna dos años distintos.",
    syntheticAfterNext: "applyYearSelectorsTour",
    cursor: { type: "midpointIds", ids: ["beforeYearSelector", "afterYearSelector"] },
    scrollIntoView: false,
  },
  {
    id: "geTourMapOpacityPanel",
    placement: "top",
    title: "Transparencia de la capa",
    text: "Deslizador **Opacidad capa**: ajusta cuánto se ve el NDVI vectorial sobre el mapa base. **Siguiente** para el comparador.",
    cursor: { type: "id", id: "geTourMapOpacityPanel" },
    scrollIntoView: false,
    spotlightDelayMs: 200,
  },
  {
    highlightIds: ["before", "after"],
    spotlightMode: "union",
    placement: "bottom",
    title: "Solo el mapa comparativo",
    text: "El área clara son los dos lienzos (años); el **catálogo** a la izquierda queda sombreado. **Siguiente**: el puntero **sigue la cortina** central.",
    syntheticAfterNext: "compareSweep",
    cursor: { type: "compareSwiper" },
    scrollIntoView: false,
  },
  {
    id: "geChartDockPill",
    placement: "left",
    chartPillFixedRight: true,
    title: "Mostrar gráficos",
    text: "La píldora queda a la **derecha** junto al carril. **Siguiente** despliega con animación el panel de gráficos (CSV urbano).",
    syntheticAfterNext: "expandChartDock",
    cursor: { type: "id", id: "geChartDockPill" },
  },
  {
    highlightIds: ["p05", "p06"],
    spotlightMode: "separate",
    placement: "left",
    title: "Gráficos urbanos (CSV)",
    text: "**Arriba (p05)**: serie **anual** agregada ciudad. **Abajo (p06)**: vista **mensual** u otra serie del mismo bloque. **Siguiente** para el ejemplo por barrio.",
    cursor: { type: "midpointIds", ids: ["p05", "p06"] },
    scrollIntoView: false,
    spotlightDelayMs: 350,
    reflowSpotlightMs: 400,
  },
  {
    id: "main",
    placement: "inside",
    scrollIntoView: false,
    title: "Clic en el barrio",
    text: "Puntero sobre un polígono. **Siguiente**: clic en mapa y **Explorar series**.",
    syntheticAfterNext: "barrioClickOpenModal",
    cursor: { type: "barrioPick" },
  },
  {
    highlightIds: ["ndvi-explorer-annual", "ndvi-explorer-monthly"],
    spotlightMode: "separate",
    placement: "bottom",
    title: "Gráficos del barrio",
    text: "**Anual** (arriba): tendencia e incertidumbre. **Mensual** (abajo): estacionalidad respecto a la climatológica de la unidad.",
    cursor: { type: "midpointIds", ids: ["ndvi-explorer-annual", "ndvi-explorer-monthly"] },
    scrollIntoView: false,
    spotlightDelayMs: 400,
    reflowSpotlightMs: 500,
  },
];

function ensureChartsCollapsedForTour() {
  const pill = document.getElementById("geChartDockPill");
  if (!pill || pill.getAttribute("aria-expanded") !== "true") return;
  pill.click();
}

function getStepHighlightIds(s) {
  if (s.highlightIds?.length) return s.highlightIds;
  if (s.id) return [s.id];
  return [];
}

function getHighlightElements(s) {
  const ids = getStepHighlightIds(s);
  const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (els.length) return els;
  if (s.id === "geTourMapOpacityPanel") {
    const alt = document.querySelector(".map-ui-opacity-panel");
    if (alt) return [alt];
  }
  return [];
}

function getUnionClientRectFromElements(elements) {
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    minL = Math.min(minL, r.left);
    minT = Math.min(minT, r.top);
    maxR = Math.max(maxR, r.right);
    maxB = Math.max(maxB, r.bottom);
  }
  if (!Number.isFinite(minL)) {
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }
  return {
    left: minL,
    top: minT,
    width: maxR - minL,
    height: maxB - minT,
    right: maxR,
    bottom: maxB,
  };
}

/** Rectángulos para la máscara (1 unión o 2 recortes independientes). */
function getSpotlightRectsForStep(s, highlightEls) {
  if (!highlightEls.length) return [];
  if (s.spotlightMode === "separate" && highlightEls.length >= 2) {
    return highlightEls.map((el) => el.getBoundingClientRect());
  }
  return [getUnionClientRectFromElements(highlightEls)];
}

function unionOfRects(rects) {
  if (!rects.length) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (const r of rects) {
    minL = Math.min(minL, r.left);
    minT = Math.min(minT, r.top);
    maxR = Math.max(maxR, r.right);
    maxB = Math.max(maxB, r.bottom);
  }
  return {
    left: minL,
    top: minT,
    width: maxR - minL,
    height: maxB - minT,
    right: maxR,
    bottom: maxB,
  };
}

function resetOnboardingMaskHole() {
  for (const hid of ["geOnboardingMaskHole", "geOnboardingMaskHole2", "geOnboardingMaskHoleCard"]) {
    const hole = document.getElementById(hid);
    if (hole) {
      hole.setAttribute("x", "0");
      hole.setAttribute("y", "0");
      hole.setAttribute("width", "0");
      hole.setAttribute("height", "0");
    }
  }
}

function setMaskHole(el, rect, pad) {
  if (!el || !rect || rect.width <= 0 || rect.height <= 0) {
    el?.setAttribute("width", "0");
    el?.setAttribute("height", "0");
    return;
  }
  el.setAttribute("x", String(Math.max(0, rect.left - pad)));
  el.setAttribute("y", String(Math.max(0, rect.top - pad)));
  el.setAttribute("width", String(Math.max(0, rect.width + pad * 2)));
  el.setAttribute("height", String(Math.max(0, rect.height + pad * 2)));
  el.setAttribute("rx", "12");
  el.setAttribute("ry", "12");
}

function updateSpotlightFromRects(rects, card) {
  const hole = document.getElementById("geOnboardingMaskHole");
  const hole2 = document.getElementById("geOnboardingMaskHole2");
  const holeCard = document.getElementById("geOnboardingMaskHoleCard");
  const svg = document.getElementById("geOnboardingShadeSvg");
  if (!hole || !hole2 || !svg) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  const pad = 4;
  const r0 = rects[0];
  const r1 = rects[1];
  setMaskHole(hole, r0, pad);
  setMaskHole(hole2, r1 && rects.length > 1 ? r1 : null, pad);
  if (holeCard && card) {
    const cr = card.getBoundingClientRect();
    holeCard.setAttribute("x", String(cr.left));
    holeCard.setAttribute("y", String(cr.top));
    holeCard.setAttribute("width", String(Math.max(0, cr.width)));
    holeCard.setAttribute("height", String(Math.max(0, cr.height)));
    holeCard.setAttribute("rx", "12");
    holeCard.setAttribute("ry", "12");
  } else if (holeCard) {
    holeCard.setAttribute("width", "0");
    holeCard.setAttribute("height", "0");
  }
}

function positionCardFromRect(card, rect, placement) {
  const gap = 24;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cr = card.getBoundingClientRect();
  const w = cr.width || 320;
  const h = cr.height || 120;
  const centerY = rect.top + rect.height / 2;
  let left;
  let top;
  if (placement === "inside") {
    top = rect.top + 20;
    left = rect.left + 20;
  } else if (placement === "right") {
    top = centerY - h / 2;
    left = rect.right + gap;
  } else if (placement === "left") {
    top = centerY - h / 2;
    left = rect.left - w - gap;
  } else if (placement === "bottom") {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2 - w / 2;
  } else if (placement === "top") {
    top = rect.top - h - gap;
    left = rect.left + rect.width / 2 - w / 2;
  } else {
    top = centerY - h / 2;
    left = rect.right + gap;
  }
  left = Math.max(12, Math.min(left, vw - w - 12));
  top = Math.max(12, Math.min(top, vh - h - 12));
  card.style.position = "fixed";
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.right = "auto";
  card.style.bottom = "auto";
}

function renderStepText(textEl, raw) {
  if (!textEl || !raw) return;
  const esc = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const html = esc(raw).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  textEl.innerHTML = html;
}

async function placeCursorFromStepConfig(s, highlightEls, unionRect) {
  const c = s.cursor;
  if (!c || c.type === "none") {
    hideTourFakeCursor();
    return;
  }
  if (c.type === "id") {
    await moveTourCursorToElementCenter(document.getElementById(c.id), { durationMs: 520 });
  } else if (c.type === "selector") {
    await moveTourCursorToElementCenter(document.querySelector(c.selector), { durationMs: 520 });
  } else if (c.type === "midpointIds") {
    const els = c.ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (els.length) await moveTourCursorMidpointOfElements(els, 520);
  } else if (c.type === "unionCenter") {
    await moveTourCursorToClient(
      unionRect.left + unionRect.width / 2,
      unionRect.top + unionRect.height / 2,
      520,
    );
  } else if (c.type === "compareSwiper") {
    const p04 = document.getElementById("p04");
    const sw = p04?.querySelector(".compare-swiper-vertical");
    if (sw) await moveTourCursorToElementCenter(sw, { durationMs: 560 });
    else {
      const els = [document.getElementById("before"), document.getElementById("after")].filter(Boolean);
      if (els.length) await moveTourCursorMidpointOfElements(els, 560);
    }
  } else if (c.type === "barrioPick") {
    const ok = await prepareBarrioPickForTour();
    if (!ok) hideTourFakeCursor();
  }
}

function initGeniusExplorerTour() {
  const overlay = document.getElementById("geOnboardingOverlay");
  const card = document.getElementById("geOnboardingCard");
  const titleEl = document.getElementById("geOnboardingTitle");
  const textEl = document.getElementById("geOnboardingText");
  const progressEl = document.getElementById("geOnboardingProgress");
  const nextBtn = document.getElementById("geOnboardingNext");
  const skipBtn = document.getElementById("geOnboardingSkip");
  const brandEl = document.getElementById("geOnboardingBrand");
  const trigger = document.getElementById("geTourTrigger");
  if (!overlay || !card || !titleEl || !textEl || !progressEl || !nextBtn || !skipBtn) {
    console.warn(
      "[GENIUS tour] Falta markup del onboarding; recorrido desactivado.",
      {
        geOnboardingOverlay: Boolean(overlay),
        geOnboardingCard: Boolean(card),
        geOnboardingTitle: Boolean(titleEl),
        geOnboardingText: Boolean(textEl),
        geOnboardingProgress: Boolean(progressEl),
        geOnboardingNext: Boolean(nextBtn),
        geOnboardingSkip: Boolean(skipBtn),
      },
    );
    return;
  }

  let step = 0;
  let refreshRaf = null;
  let tourSyntheticAborted = false;

  function clearHighlight() {
    document.querySelectorAll(".ge-onboarding-highlight").forEach((el) => {
      el.classList.remove("ge-onboarding-highlight");
    });
  }

  async function layoutStepSpotlightAndCursor() {
    const s = STEPS[step];
    if (!s) return;
    const highlightEls = getHighlightElements(s);
    if (!highlightEls.length) return;
    const spotlightRects = getSpotlightRectsForStep(s, highlightEls);
    if (!spotlightRects.length) return;
    const union = unionOfRects(spotlightRects);
    positionCardFromRect(card, union, s.placement || "right");
    updateSpotlightFromRects(spotlightRects, card);
    await placeCursorFromStepConfig(s, highlightEls, union);
  }

  function refreshSpotlight() {
    if (!overlay.classList.contains("ge-onboarding-overlay--active")) return;
    if (refreshRaf) cancelAnimationFrame(refreshRaf);
    refreshRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void layoutStepSpotlightAndCursor();
        refreshRaf = null;
      });
    });
  }

  function closeTour() {
    tourSyntheticAborted = true;
    document.body.classList.remove("genius-explorer--tour-chart-pill-anchor");
    cleanupSyntheticTourUi();
    void closeNdviZonalExplorerForTour();
    overlay.classList.remove("ge-onboarding-overlay--active");
    overlay.setAttribute("aria-hidden", "true");
    card.classList.remove("ge-onboarding-card--visible");
    brandEl?.classList.remove("ge-onboarding-brand--visible");
    clearHighlight();
    nextBtn.disabled = false;
    resetOnboardingMaskHole();
    window.removeEventListener("resize", refreshSpotlight);
    document.removeEventListener("scroll", refreshSpotlight, true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) {
      /* ignore */
    }
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeTour();
  }

  async function showStep(idx) {
    step = idx;
    card.classList.add("ge-onboarding-card--visible");
    clearHighlight();
    document.body.classList.remove("genius-explorer--tour-chart-pill-anchor");

    if (idx >= STEPS.length) {
      closeTour();
      return;
    }
    const s = STEPS[idx];
    if (s.chartPillFixedRight) {
      document.body.classList.add("genius-explorer--tour-chart-pill-anchor");
      ensureChartsCollapsedForTour();
    }

    const highlightEls = getHighlightElements(s);
    if (!highlightEls.length) {
      await showStep(idx + 1);
      return;
    }

    highlightEls.forEach((el) => el.classList.add("ge-onboarding-highlight"));
    brandEl?.classList.toggle("ge-onboarding-brand--visible", Boolean(s.showBrand));

    if (idx > 0 && s.scrollIntoView !== false) {
      highlightEls[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    titleEl.textContent = s.title;
    renderStepText(textEl, s.text);
    progressEl.textContent = `${idx + 1} / ${STEPS.length}`;
    nextBtn.textContent = idx === STEPS.length - 1 ? "Entendido" : "Siguiente";

    const baseDelay = idx === 0 ? 50 : 400;
    const delay = baseDelay + (typeof s.spotlightDelayMs === "number" ? s.spotlightDelayMs : 0);

    window.setTimeout(async () => {
      await layoutStepSpotlightAndCursor();
      if (typeof s.reflowSpotlightMs === "number") {
        window.setTimeout(() => {
          void layoutStepSpotlightAndCursor();
        }, s.reflowSpotlightMs);
      }
      nextBtn.focus();
    }, delay);
  }

  async function advanceFromCurrentStep() {
    if (step >= STEPS.length - 1) {
      closeTour();
      return;
    }
    const cur = STEPS[step];
    const segKey = cur.syntheticAfterNext;
    if (segKey) {
      const runner = syntheticTourSegments[segKey];
      if (typeof runner !== "function") {
        console.warn("[GENIUS tour] syntheticAfterNext desconocido:", segKey);
      } else {
        card.classList.remove("ge-onboarding-card--visible");
        brandEl?.classList.remove("ge-onboarding-brand--visible");
        clearHighlight();
        resetOnboardingMaskHole();
        nextBtn.disabled = true;
        tourSyntheticAborted = false;
        try {
          await runner({ shouldAbort: () => tourSyntheticAborted });
        } catch (e) {
          console.warn("[GENIUS tour] segmento sintético:", e);
        }
        cleanupSyntheticTourUi();
        nextBtn.disabled = false;
        if (tourSyntheticAborted) return;
      }
    }
    await showStep(step + 1);
  }

  function startTour() {
    tourSyntheticAborted = false;
    overlay.classList.add("ge-onboarding-overlay--active");
    overlay.setAttribute("aria-hidden", "false");
    window.addEventListener("resize", refreshSpotlight);
    document.addEventListener("scroll", refreshSpotlight, true);
    document.addEventListener("keydown", onKeydown);
    void showStep(0);
  }

  window.__geniusStartExplorerTour = startTour;

  nextBtn.addEventListener("click", () => {
    void advanceFromCurrentStep();
  });
  skipBtn.addEventListener("click", closeTour);
  trigger?.addEventListener("click", () => startTour());

}

if (document.body.classList.contains("genius-explorer")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initGeniusExplorerTour(), { once: true });
  } else {
    initGeniusExplorerTour();
  }
}
