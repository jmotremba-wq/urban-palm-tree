// scenarios.js
// Save and compare named retirement assumption snapshots in localStorage.
// Each scenario captures the full assumption set and the computed outcomes at
// save time so comparisons are instant and don't require a live recalculation.

import { state, saveNow } from "./state.js";
import { uid, formatDollars } from "./utils.js";
import { compute } from "./retirement.js";

function signClass(n) {
  return n < 0 ? "value-neg" : n > 0 ? "value-pos" : "";
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function saveCurrentScenario(name) {
  const c = compute();
  const id = uid();
  state.scenarios[id] = {
    id,
    name: name || `Scenario ${Object.keys(state.scenarios).length + 1}`,
    savedAt: Date.now(),
    assumptions: {
      retireAge:           c.retireAge,
      lifeExpectancy:      c.lifeExpectancy,
      nominalReturn:       state.retirement.nominalReturn,
      inflation:           state.retirement.inflation,
      annualContribution:  c.annualContribution,
      desiredSpending:     c.desiredSpending,
      withdrawalRate:      state.retirement.withdrawalRate,
      includeRealEstate:   state.retirement.includeRealEstate,
    },
    snapshot: {
      currentAge:           c.currentAge,
      investable:           c.investable,
      yearsToRetire:        c.yearsToRetire,
      balanceAtRetirement:  c.balanceAtRetirement,
      requiredPortfolio:    c.requiredPortfolio,
      surplus:              c.surplus,
      sustainableIncome:    c.sustainableIncome,
      incomeSurplus:        c.incomeSurplus,
      depletedAge:          c.depletedAge,
      lifeExpectancy:       c.lifeExpectancy,
    },
  };
  saveNow();
}

function loadScenario(id) {
  const s = state.scenarios[id];
  if (!s) return;
  Object.assign(state.retirement, s.assumptions);
  state.dashboard.targetAge = s.assumptions.retireAge;
  saveNow();
}

function deleteScenario(id) {
  delete state.scenarios[id];
  saveNow();
}

export function renderScenarios() {
  const sec = document.getElementById("tab-scenarios");
  if (!sec) return;

  const sorted = Object.values(state.scenarios || {})
    .sort((a, b) => b.savedAt - a.savedAt);

  // ---- Current snapshot preview (read-only summary of live state) ----
  const c = compute();
  const previewHtml = `
    <div class="card">
      <h3 class="card-title">Current State — Live Preview</h3>
      <p class="section-sub" style="margin:0 0 14px">
        This is what will be saved. Adjust assumptions in the Retirement Modeler, then save a named snapshot here.
      </p>
      <div class="scen-preview-grid">
        <div class="scen-preview-item">
          <div class="scen-preview-label">Retire Age</div>
          <div class="scen-preview-value">${c.retireAge}</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Years Away</div>
          <div class="scen-preview-value">${c.yearsToRetire}</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Nominal Return</div>
          <div class="scen-preview-value">${state.retirement.nominalReturn}%</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Inflation</div>
          <div class="scen-preview-value">${state.retirement.inflation}%</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Annual Contribution</div>
          <div class="scen-preview-value">${formatDollars(c.annualContribution)}</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Desired Spending</div>
          <div class="scen-preview-value">${formatDollars(c.desiredSpending)}</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">Portfolio at Retirement</div>
          <div class="scen-preview-value value-pos">${formatDollars(c.balanceAtRetirement)}</div>
        </div>
        <div class="scen-preview-item">
          <div class="scen-preview-label">${c.surplus >= 0 ? "Surplus" : "Gap"}</div>
          <div class="scen-preview-value ${signClass(c.surplus)}">${c.surplus >= 0 ? "+" : "−"}${formatDollars(Math.abs(c.surplus))}</div>
        </div>
      </div>
      <div class="scen-save-row">
        <input type="text" id="scenNameInput" placeholder="Name this scenario…" style="flex:1;min-width:160px" />
        <button class="btn scen-save-btn">Save Snapshot</button>
      </div>
    </div>`;

  // ---- Comparison table ----
  let comparisonHtml;
  if (sorted.length === 0) {
    comparisonHtml = `<div class="card">
      <h3 class="card-title">Saved Scenarios</h3>
      <p style="color:var(--muted);text-align:center;padding:40px 0;font-size:13px">
        No scenarios saved yet. Configure retirement assumptions and save a snapshot above.
      </p>
    </div>`;
  } else {
    const rows = sorted.map((s) => {
      const n = s.snapshot;
      const a = s.assumptions;
      const depVal = n.depletedAge != null
        ? `<span class="value-neg">age ${n.depletedAge}</span>`
        : `age&nbsp;${n.lifeExpectancy}+`;
      return `<tr>
        <td>
          <div style="font-weight:600;font-family:var(--font-head)">${s.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${fmtDate(s.savedAt)}</div>
        </td>
        <td class="num mono">${a.retireAge}</td>
        <td class="num mono">${a.nominalReturn}%</td>
        <td class="num mono">${a.inflation}%</td>
        <td class="num mono">${formatDollars(a.annualContribution)}</td>
        <td class="num mono">${formatDollars(a.desiredSpending)}</td>
        <td class="num mono">${formatDollars(n.balanceAtRetirement)}</td>
        <td class="num mono ${signClass(n.surplus)}">${n.surplus >= 0 ? "+" : "−"}${formatDollars(Math.abs(n.surplus))}</td>
        <td class="num mono">${formatDollars(n.sustainableIncome)}</td>
        <td class="num">${depVal}</td>
        <td>
          <div class="scen-actions">
            <button class="btn scen-load-btn" data-id="${s.id}">Load</button>
            <button class="btn-del scen-del-btn" data-id="${s.id}">✕</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    comparisonHtml = `<div class="card">
      <h3 class="card-title">Saved Scenarios (${sorted.length})</h3>
      <div class="scen-table-wrap">
        <table class="scen-table">
          <thead><tr>
            <th>Name</th>
            <th class="num">Retire</th>
            <th class="num">Return</th>
            <th class="num">Infl.</th>
            <th class="num">Contrib.</th>
            <th class="num">Spending</th>
            <th class="num">Portfolio</th>
            <th class="num">Surplus/Gap</th>
            <th class="num">Sust. Income</th>
            <th class="num">Lasts Until</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  sec.innerHTML = `
    <h2 class="section-title">Scenarios</h2>
    <p class="section-sub">Save named snapshots of retirement assumptions and compare projected outcomes side by side.</p>
    <div class="dash-stagger">
      ${previewHtml}
      ${comparisonHtml}
    </div>`;

  // Save
  sec.querySelector(".scen-save-btn").addEventListener("click", () => {
    const name = (sec.querySelector("#scenNameInput").value || "").trim();
    saveCurrentScenario(name);
    renderScenarios();
  });

  // Load → navigate to Retirement Modeler
  sec.querySelectorAll(".scen-load-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadScenario(btn.dataset.id);
      document.querySelector('.nav-btn[data-tab="retirement"]')?.click();
    });
  });

  // Delete
  sec.querySelectorAll(".scen-del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteScenario(btn.dataset.id);
      renderScenarios();
    });
  });
}
