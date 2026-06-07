// export.js
// Client-side data export: full JSON backup and CSV exports for accounts,
// debts, net worth snapshot, and the retirement year-by-year projection.
// Everything runs in the browser — no data leaves this device.

import { state } from "./state.js";
import { compute } from "./retirement.js";
import { formatDollars } from "./utils.js";
import {
  netWorth, totalAssets, totalLiabilities,
  liquidTotal, realEstateEquity, alternativesTotal,
} from "./financials.js";

/* ------------------------------------------------------------------ *
 * Download helpers
 * ------------------------------------------------------------------ */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(rows) {
  return rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Export actions
 * ------------------------------------------------------------------ */

function exportFullJSON() {
  const json = JSON.stringify(state, null, 2);
  triggerDownload(new Blob([json], { type: "application/json" }), `finance-backup-${today()}.json`);
}

function exportAccountsCSV() {
  const rows = [
    ["Name", "Owner", "Type", "Balance", "Notes"],
    ...state.inputs.accounts.map((a) => [a.name, a.owner, a.type, a.balance, a.notes || ""]),
  ];
  triggerDownload(new Blob([toCSV(rows)], { type: "text/csv" }), `accounts-${today()}.csv`);
}

function exportDebtsCSV() {
  const rows = [
    ["Name", "Lender", "Balance", "Rate (%)", "Monthly Payment"],
    ...state.inputs.debt.map((d) => [d.name, d.lender, d.balance, d.rate, d.payment]),
  ];
  triggerDownload(new Blob([toCSV(rows)], { type: "text/csv" }), `debts-${today()}.csv`);
}

function exportNetWorthCSV() {
  const totalDebt = state.inputs.debt.reduce((s, d) => s + Number(d.balance || 0), 0);
  const rows = [
    ["Date", "Category", "Value"],
    [today(), "Net Worth",            netWorth()],
    [today(), "Total Assets",         totalAssets()],
    [today(), "Total Liabilities",    totalLiabilities()],
    [today(), "Liquid Assets",        liquidTotal()],
    [today(), "Real Estate Equity",   realEstateEquity()],
    [today(), "Alternatives",         alternativesTotal()],
    [today(), "Total Debt",           totalDebt],
  ];
  triggerDownload(new Blob([toCSV(rows)], { type: "text/csv" }), `net-worth-${today()}.csv`);
}

function exportRetirementCSV() {
  const c = compute();
  const rows = [
    ["Age", "Portfolio Balance (today's $)", "Phase", "Guaranteed Income (today's $)", "Portfolio Draw (today's $)"],
    ...c.series.map((p) => {
      const gi   = c.guaranteedAtAge(p.age);
      const draw = p.age >= c.retireAge ? Math.max(0, c.desiredSpending - gi) : 0;
      return [
        p.age,
        Math.round(p.balance),
        p.age < c.retireAge ? "Accumulation" : "Drawdown",
        Math.round(gi),
        Math.round(draw),
      ];
    }),
  ];
  triggerDownload(new Blob([toCSV(rows)], { type: "text/csv" }), `retirement-projection-${today()}.csv`);
}

function exportConcentrationCSV() {
  const liquid = liquidTotal();
  const rows = [
    ["Holding", "Value", "% of Liquid Assets", "Notes"],
    ...state.inputs.concentration.map((h) => [
      h.holding,
      h.value,
      liquid > 0 ? (h.value / liquid * 100).toFixed(1) + "%" : "—",
      h.notes || "",
    ]),
  ];
  triggerDownload(new Blob([toCSV(rows)], { type: "text/csv" }), `concentration-${today()}.csv`);
}

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */

const EXPORTS = [
  {
    group: "Full Backup",
    items: [
      {
        action: "json",
        title:  "Complete State — JSON",
        desc:   "All inputs, accounts, debts, real estate, alternatives, assumptions, and scenarios in one file. Restore by re-entering the data — JSON import not yet supported.",
        label:  "↓ Download JSON",
      },
    ],
  },
  {
    group: "Data Tables — CSV",
    items: [
      {
        action: "accounts",
        title:  "Liquid Accounts",
        desc:   "All investment and cash accounts: name, owner, type, current balance.",
        label:  "↓ Accounts CSV",
      },
      {
        action: "debts",
        title:  "Debt Schedule",
        desc:   "All debt entries: lender, outstanding balance, interest rate, monthly payment.",
        label:  "↓ Debts CSV",
      },
      {
        action: "concentration",
        title:  "Taxable Concentration",
        desc:   "Concentrated stock and ETF holdings with value and percentage of liquid assets.",
        label:  "↓ Concentration CSV",
      },
      {
        action: "networth",
        title:  "Net Worth Snapshot",
        desc:   "Point-in-time net worth breakdown: total assets, liabilities, liquid, real estate equity, alternatives.",
        label:  "↓ Net Worth CSV",
      },
    ],
  },
  {
    group: "Projections — CSV",
    items: [
      {
        action: "retirement",
        title:  "Retirement Year-by-Year Projection",
        desc:   "Portfolio balance at every age from now through life expectancy — accumulation phase then drawdown — in today's real dollars. Includes guaranteed income and portfolio draw columns.",
        label:  "↓ Projection CSV",
      },
    ],
  },
];

export function renderExport() {
  const sec = document.getElementById("tab-export");
  if (!sec) return;

  const groupHtml = EXPORTS.map((g) => `
    <div class="card">
      <h3 class="card-title">${g.group}</h3>
      ${g.items.map((item) => `
        <div class="export-item">
          <div class="export-info">
            <div class="export-item-title">${item.title}</div>
            <div class="export-item-desc">${item.desc}</div>
          </div>
          <button class="btn export-btn" data-action="${item.action}">${item.label}</button>
        </div>
      `).join("")}
    </div>
  `).join("");

  sec.innerHTML = `
    <h2 class="section-title">Export</h2>
    <p class="section-sub">All data is local to this browser. Export backups regularly — clearing browser storage will erase your data.</p>
    <div class="dash-stagger">
      ${groupHtml}
    </div>`;

  const HANDLERS = {
    json:          exportFullJSON,
    accounts:      exportAccountsCSV,
    debts:         exportDebtsCSV,
    concentration: exportConcentrationCSV,
    networth:      exportNetWorthCSV,
    retirement:    exportRetirementCSV,
  };

  sec.querySelectorAll(".export-btn").forEach((btn) => {
    btn.addEventListener("click", () => HANDLERS[btn.dataset.action]?.());
  });
}
