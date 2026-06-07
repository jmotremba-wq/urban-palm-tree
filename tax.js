// tax.js
// Tax Projector: income summary, federal bracket waterfall, under-withholding
// alert, and year-end balance estimate. All derived from state — no real data
// ever committed; user fills in actual figures locally.

import { state, saveNow } from "./state.js";
import { formatDollars, formatPercent } from "./utils.js";

/* ------------------------------------------------------------------ *
 * MFJ Federal brackets by year
 * Each entry is [rate, upperBound] — the lower bound is the previous upper.
 * ------------------------------------------------------------------ */

const BRACKETS = {
  2024: [
    [0.10,  23200],
    [0.12,  94300],
    [0.22, 201050],
    [0.24, 383900],
    [0.32, 487450],
    [0.35, 731200],
    [0.37, Infinity],
  ],
  2025: [
    [0.10,  23850],
    [0.12,  96950],
    [0.22, 206700],
    [0.24, 394600],
    [0.32, 501050],
    [0.35, 751600],
    [0.37, Infinity],
  ],
  2026: [
    [0.10,  24300],
    [0.12,  98800],
    [0.22, 210300],
    [0.24, 401900],
    [0.32, 510000],
    [0.35, 765600],
    [0.37, Infinity],
  ],
};

// Compute federal tax for a given taxable income using the year's brackets.
function calcTax(taxableIncome, year) {
  const tiers = BRACKETS[year] || BRACKETS[2025];
  let lower = 0;
  let totalTax = 0;
  let marginalRate = 0;
  const rows = tiers.map(([rate, upper]) => {
    const inBracket = Math.max(0, Math.min(taxableIncome, upper) - lower);
    const taxInBracket = inBracket * rate;
    totalTax += taxInBracket;
    if (inBracket > 0) marginalRate = rate;
    const row = { rate, lower, upper, inBracket, taxInBracket };
    lower = upper;
    return row;
  });
  return { rows, totalTax, marginalRate };
}

/* ------------------------------------------------------------------ *
 * Pure compute — reads state, returns all derived numbers
 * ------------------------------------------------------------------ */

function compute() {
  const inc = state.inputs.income;
  const year = state.taxYear || 2025;

  const nameA = inc.earnerAName || "Earner A";
  const nameB = inc.earnerBName || "Earner B";
  const earnerABase         = Number(inc.earnerABase || 0);
  const earnerABonusPct     = Number(inc.earnerABonusPct || 0);
  const earnerABonus        = earnerABase * earnerABonusPct / 100;
  const bonusWithholdingPct = Number(inc.earnerABonusWithholdingPct || 22);
  const earnerBBase         = Number(inc.earnerBBase || 0);
  const earnerBTotalComp    = Number(inc.earnerBTotalComp || 0);
  const earnerBExtra        = earnerBTotalComp - earnerBBase;
  const stdDeduction        = Number(inc.standardDeduction || 0);

  const grossIncome   = earnerABase + earnerABonus + earnerBTotalComp;
  const taxableIncome = Math.max(0, grossIncome - stdDeduction);

  const { rows: bracketRows, totalTax, marginalRate } = calcTax(taxableIncome, year);
  const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0;

  // Tax attributable to Earner A bonus — marginal slice
  const taxWithoutBonus = calcTax(Math.max(0, taxableIncome - earnerABonus), year).totalTax;
  const taxDueToBonus   = totalTax - taxWithoutBonus;

  // Withholding estimates
  // Base salaries assumed withheld at the MFJ effective rate (simplified)
  const baseWithheld    = effectiveRate * (earnerABase + earnerBBase);
  const bonusWithheld   = earnerABonus * bonusWithholdingPct / 100;
  const totalWithheld   = baseWithheld + bonusWithheld;

  const bonusUnderWithheld = taxDueToBonus - bonusWithheld;
  const yearEndBalance     = totalTax - totalWithheld;

  return {
    year, nameA, nameB,
    earnerABase, earnerABonusPct, earnerABonus,
    bonusWithholdingPct,
    earnerBBase, earnerBTotalComp, earnerBExtra,
    stdDeduction, grossIncome, taxableIncome,
    bracketRows, totalTax, marginalRate, effectiveRate,
    taxDueToBonus, bonusUnderWithheld,
    baseWithheld, bonusWithheld, totalWithheld,
    yearEndBalance,
  };
}

/* ------------------------------------------------------------------ *
 * Section renderers
 * ------------------------------------------------------------------ */

function buildYearBar(c) {
  const wrap = document.createElement("div");
  wrap.className = "tax-year-bar";
  wrap.innerHTML = `
    <label for="tax-yr">Tax Year</label>
    <select id="tax-yr">
      <option value="2024"${c.year === 2024 ? " selected" : ""}>2024</option>
      <option value="2025"${c.year === 2025 ? " selected" : ""}>2025</option>
      <option value="2026"${c.year === 2026 ? " selected" : ""}>2026 (est.)</option>
    </select>
    <span style="color:var(--muted);font-size:12px;font-family:var(--font-data)">
      Federal only &middot; Married Filing Jointly &middot; simplified estimate
    </span>
  `;
  wrap.querySelector("#tax-yr").addEventListener("change", (e) => {
    state.taxYear = Number(e.target.value);
    saveNow();
    renderTax();
  });
  return wrap;
}

function buildKPIs(c) {
  const wrap = document.createElement("div");
  wrap.className = "tax-grid-3";
  const kpis = [
    { label: "Federal Tax Owed",  val: formatDollars(c.totalTax),                              hero: true },
    { label: "Effective Rate",    val: formatPercent(c.effectiveRate * 100, { decimals: 1 }) },
    { label: "Marginal Rate",     val: formatPercent(c.marginalRate * 100, { decimals: 0 })  },
  ];
  wrap.innerHTML = kpis.map((k) => `
    <div class="kpi${k.hero ? " kpi-hero" : ""}">
      <span class="kpi-label">${k.label}</span>
      <span class="kpi-value">${k.val}</span>
    </div>
  `).join("");
  return wrap;
}

function buildIncomeCard(c) {
  const rows = [
    { label: `${c.nameA} — Base`,             val: formatDollars(c.earnerABase) },
    { label: `${c.nameA} — Bonus (${formatPercent(c.earnerABonusPct)} of base)`,
                                               val: formatDollars(c.earnerABonus) },
    { label: `${c.nameB} — Base`,             val: formatDollars(c.earnerBBase) },
    { label: `${c.nameB} — Variable Comp`,    val: formatDollars(c.earnerBExtra) },
    { label: "Gross Income",                  val: formatDollars(c.grossIncome),   total: true },
    { label: "Standard Deduction",            val: `(${formatDollars(c.stdDeduction)})` },
    { label: "Federal Taxable Income",        val: formatDollars(c.taxableIncome), total: true },
  ];
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-title">Income Summary</div>
    <div class="income-rows">
      ${rows.map((r) => `
        <div class="income-row${r.total ? " total-row" : ""}">
          <span class="row-label">${r.label}</span>
          <span class="row-value mono">${r.val}</span>
        </div>
      `).join("")}
    </div>
  `;
  return card;
}

function buildYearEndCard(c) {
  const isOwe    = c.yearEndBalance > 0;
  const isRefund = c.yearEndBalance < 0;
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-title">Year-End Estimate</div>
    <div class="yeb-grid">
      <div class="yeb-item">
        <div class="yeb-label">Tax Owed</div>
        <div class="yeb-value">${formatDollars(c.totalTax)}</div>
      </div>
      <div class="yeb-item">
        <div class="yeb-label">Est. Withheld</div>
        <div class="yeb-value">${formatDollars(c.totalWithheld)}</div>
        <div class="yeb-sub">${formatDollars(c.baseWithheld)} base + ${formatDollars(c.bonusWithheld)} bonus</div>
      </div>
      <div class="yeb-item" style="grid-column:span 2;${
        isOwe    ? "border-color:rgba(255,77,109,0.4);background:rgba(255,77,109,0.07)" :
        isRefund ? "border-color:rgba(0,212,170,0.4);background:rgba(0,212,170,0.06)" : ""
      }">
        <div class="yeb-label">${isOwe ? "Est. Balance Due" : "Est. Refund"}</div>
        <div class="yeb-value" style="${isOwe ? "color:var(--danger)" : isRefund ? "color:var(--accent)" : ""}">${
          formatDollars(Math.abs(c.yearEndBalance))
        }</div>
        <div class="yeb-sub">${isOwe ? "May owe at filing" : "Estimated refund at filing"}</div>
      </div>
    </div>
  `;
  return card;
}

function buildAlerts(c) {
  const frag = document.createDocumentFragment();

  if (c.earnerABonus > 0 && c.bonusUnderWithheld > 500) {
    const div = document.createElement("div");
    div.className = "tax-alert tax-alert--warn";
    div.innerHTML = `
      <span class="alert-icon">&#9888;</span>
      <div class="alert-body">
        <strong>Bonus under-withheld ~${formatDollars(c.bonusUnderWithheld)}</strong>
        ${c.nameA}'s bonus used the ${formatPercent(c.bonusWithholdingPct)} supplemental rate, but
        the marginal federal rate is ${formatPercent(c.marginalRate * 100, { decimals: 0 })}.
        Consider an estimated tax payment (Q4) to avoid an underpayment penalty.
      </div>
    `;
    frag.appendChild(div);
  }

  if (c.yearEndBalance > 2000) {
    const div = document.createElement("div");
    div.className = "tax-alert tax-alert--neutral";
    div.innerHTML = `
      <span class="alert-icon">&#8203;</span>
      <div class="alert-body">
        <strong>Withholding estimate is simplified</strong>
        Base salary withholding is modeled at the MFJ effective rate. Actual W-4
        elections may differ — validate with your payroll if the gap is large.
      </div>
    `;
    frag.appendChild(div);
  }

  if (c.yearEndBalance < -3000) {
    const div = document.createElement("div");
    div.className = "tax-alert tax-alert--info";
    div.innerHTML = `
      <span class="alert-icon">&#8617;</span>
      <div class="alert-body">
        <strong>Possible over-withholding ~${formatDollars(Math.abs(c.yearEndBalance))}</strong>
        Adjusting W-4 allowances could improve monthly cash flow by
        ~${formatDollars(Math.abs(c.yearEndBalance) / 12)}/mo.
      </div>
    `;
    frag.appendChild(div);
  }

  return frag;
}

function buildBracketCard(c) {
  const maxTax = Math.max(...c.bracketRows.map((r) => r.taxInBracket), 1);
  const card = document.createElement("div");
  card.className = "card";

  const bodyRows = c.bracketRows.map((b) => {
    const isActive = b.inBracket > 0 && b.rate === c.marginalRate;
    const pct = (b.taxInBracket / maxTax * 100).toFixed(1);
    const maxLabel = b.upper === Infinity ? "+" : formatDollars(b.upper);
    return `
      <tr${isActive ? ' class="active-bracket"' : ""}>
        <td class="label-col">${formatPercent(b.rate * 100, { decimals: 0 })}</td>
        <td class="num">${formatDollars(b.lower)} &ndash; ${maxLabel}</td>
        <td class="num">${b.inBracket > 0 ? formatDollars(b.inBracket) : "&mdash;"}</td>
        <td class="bracket-fill-cell">
          <div class="bracket-bar-track">
            <div class="bracket-bar-fill" style="width:${pct}%"></div>
          </div>
        </td>
        <td class="num">${b.taxInBracket > 0 ? formatDollars(b.taxInBracket, { decimals: 0 }) : "&mdash;"}</td>
      </tr>
    `;
  }).join("");

  card.innerHTML = `
    <div class="card-title">Federal Bracket Waterfall &mdash; ${c.year}</div>
    <table class="bracket-table">
      <thead>
        <tr>
          <th>Rate</th>
          <th class="num">Bracket</th>
          <th class="num">In Bracket</th>
          <th></th>
          <th class="num">Tax</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr>
          <td class="label-col" colspan="2">Total</td>
          <td class="num">${formatDollars(c.taxableIncome)}</td>
          <td></td>
          <td class="num">${formatDollars(c.totalTax, { decimals: 0 })}</td>
        </tr>
        <tr>
          <td class="label-col" colspan="4">Effective Rate</td>
          <td class="num">${formatPercent(c.effectiveRate * 100, { decimals: 2 })}</td>
        </tr>
      </tfoot>
    </table>
  `;
  return card;
}

/* ------------------------------------------------------------------ *
 * Main render entry point
 * ------------------------------------------------------------------ */

export function renderTax() {
  const sec = document.getElementById("tab-tax");
  if (!sec) return;
  sec.innerHTML = "";

  const c = compute();
  const wrap = document.createElement("div");
  wrap.className = "dash-stagger";

  wrap.appendChild(buildYearBar(c));
  wrap.appendChild(buildKPIs(c));

  const grid = document.createElement("div");
  grid.className = "dash-grid-2";
  grid.style.marginBottom = "18px";
  grid.appendChild(buildIncomeCard(c));
  grid.appendChild(buildYearEndCard(c));
  wrap.appendChild(grid);

  wrap.appendChild(buildAlerts(c));
  wrap.appendChild(buildBracketCard(c));

  sec.appendChild(wrap);
}
