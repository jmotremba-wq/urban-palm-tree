// app.js
// Application shell: wires top-level tab navigation and the Inputs sub-tab nav,
// restores the last-active tab/sub-tab from persisted state, and renders the
// functional Inputs forms on demand. The non-Inputs tabs are static placeholder
// cards already present in index.html.

import { state, saveNow } from "./state.js";
import { renderSubTab } from "./inputs.js";
import { renderDashboard } from "./dashboard.js";
import { renderTax } from "./tax.js";
import { renderRetirement } from "./retirement.js";
import { renderScenarios } from "./scenarios.js";
import { renderExport } from "./export.js";

// Maps a top-level tab key to its section element id.
const TAB_SECTIONS = {
  dashboard: "tab-dashboard",
  inputs: "tab-inputs",
  tax: "tab-tax",
  retirement: "tab-retirement",
  scenarios: "tab-scenarios",
  export: "tab-export",
};

const VALID_SUBTABS = ["income", "liquid", "alternatives", "realestate", "debt", "military"];

// Track which sub-tabs have been rendered so we don't rebuild needlessly.
const renderedSubTabs = new Set();

/* ------------------------------------------------------------------ *
 * Top-level tabs
 * ------------------------------------------------------------------ */

function showTab(tab) {
  if (!TAB_SECTIONS[tab]) tab = "inputs";
  state.activeTab = tab;

  // Toggle nav buttons.
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  // Toggle sections.
  for (const [key, id] of Object.entries(TAB_SECTIONS)) {
    const sec = document.getElementById(id);
    if (sec) sec.classList.toggle("active", key === tab);
  }

  // Re-render on every visit so Inputs edits are reflected.
  if (tab === "dashboard")  renderDashboard();
  if (tab === "tax")        renderTax();
  if (tab === "retirement") renderRetirement();
  if (tab === "scenarios")  renderScenarios();
  if (tab === "export")     renderExport();

  // Lazily render the active Inputs sub-tab when entering the Inputs tab.
  if (tab === "inputs") showSubTab(state.inputsSubTab);

  saveNow();
}

/* ------------------------------------------------------------------ *
 * Inputs sub-tabs
 * ------------------------------------------------------------------ */

function showSubTab(sub) {
  if (!VALID_SUBTABS.includes(sub)) sub = "income";
  state.inputsSubTab = sub;

  document.querySelectorAll(".subtab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.subtab === sub);
  });

  const idMap = {
    income: "sub-income",
    liquid: "sub-liquid",
    alternatives: "sub-alternatives",
    realestate: "sub-realestate",
    debt: "sub-debt",
    military: "sub-military",
  };
  for (const [key, id] of Object.entries(idMap)) {
    const node = document.getElementById(id);
    if (node) node.classList.toggle("active", key === sub);
  }

  // Render once on first reveal.
  if (!renderedSubTabs.has(sub)) {
    renderSubTab(sub);
    renderedSubTabs.add(sub);
  }

  saveNow();
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

function init() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  document.querySelectorAll(".subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => showSubTab(btn.dataset.subtab));
  });

  // Restore last-active sub-tab first (so it's ready), then the tab.
  showSubTab(state.inputsSubTab);
  showTab(state.activeTab);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
