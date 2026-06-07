// dashboard.js
// Renders the Dashboard section: KPI bar, net worth breakdown donut chart,
// debt summary with payoff bars, concentration risk pie, and retirement
// progress tracker with inline-editable targets.

import { state, save } from "./state.js";
import {
  netWorth, totalAssets, totalLiabilities,
  liquidTotal, cashTotal, liquidInvestmentsTotal,
  realEstateEquity, alternativesTotal,
  totalDebt, totalMonthlyDebtService, totalAnnualDebtService,
  weightedAvgDebtRate, concentrationBreakdown, debtPayoffEstimates,
} from "./financials.js";
import { formatDollars, formatPercent, parseNumber } from "./utils.js";

/* ─── Segment palette — muted to avoid competing with the accent ── */
const DONUT_COLORS = {
  investments: "#00d4aa",   // teal accent
  cash:        "#4a7ab5",   // steel blue
  realestate:  "#9a7a30",   // muted gold
  alts:        "#5a5a72",   // muted slate
};

const PIE_COLORS = [
  "#00d4aa","#4a7ab5","#9a7a30","#7a5ab5","#c05070",
  "#309090","#6a8a30","#b06030","#805090","#2a7a7a",
];

function fmtShort(n) {
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return formatDollars(n);
}

/* ─── Inline SVG charts ───────────────────────────────────── */

// Donut chart using stroke-dasharray on overlapping circles.
// Each segment starts where the previous one ended, rotated to begin at 12 o'clock.
// Pass center = { value: string, label: string } to render text in the ring hole.
function buildDonut(segments, size = 160, center = null) {
  const total = segments.reduce((s, g) => s + Math.max(0, g.value), 0);
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.375;   // ring radius
  const sw = size * 0.155;   // stroke width (ring thickness)
  const C  = 2 * Math.PI * r;

  const centerSvg = center ? `
    <text x="${cx}" y="${cy - 7}" text-anchor="middle"
      font-family="'DM Mono', monospace" font-size="13" fill="#e8e8f0"
      font-variant-numeric="tabular-nums">${center.value}</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle"
      font-family="'Syne', sans-serif" font-size="8" fill="#6b7280"
      letter-spacing="0.08em">${center.label}</text>` : "";

  if (!total) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e2e" stroke-width="${sw}"/>
      ${centerSvg}
    </svg>`;
  }

  let cumulative = 0;
  const circles = segments.filter(s => s.value > 0).map(s => {
    const len    = (s.value / total) * C;
    // C/4 offset starts the first segment at 12 o'clock; subtract cumulative
    // previous lengths to place each subsequent segment immediately after.
    const offset = (C / 4) - cumulative;
    cumulative  += len;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${s.color}" stroke-width="${sw}"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e2e" stroke-width="${sw}"/>
    ${circles.join("\n    ")}
    ${centerSvg}
  </svg>`;
}

// Pie chart using SVG path arcs. Each wedge is a filled path from center.
function buildPie(segments, size = 160) {
  const total = segments.reduce((s, g) => s + Math.max(0, g.value), 0);
  const cx = size / 2, cy = size / 2, r = size * 0.45;

  if (!total) {
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1e1e2e"/>
    </svg>`;
  }

  const toXY = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let angle = -Math.PI / 2;   // start at 12 o'clock

  const paths = segments.filter(s => s.value > 0).map(s => {
    const sweep = (s.value / total) * 2 * Math.PI;
    const end   = angle + sweep;
    const [x1, y1] = toXY(angle);
    const [x2, y2] = toXY(end);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} `
            + `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    angle = end;
    return `<path d="${d}" fill="${s.color}" stroke="#12121a" stroke-width="1.5"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${paths.join("")}</svg>`;
}

/* ─── Small HTML helpers ──────────────────────────────────── */

function signClass(n) {
  return n < 0 ? "value-neg" : n > 0 ? "value-pos" : "";
}

function dollarSigned(n) {
  const cls = signClass(n);
  const fmt = formatDollars(n);
  return cls ? `<span class="${cls}">${fmt}</span>` : fmt;
}

/* ─── Section renderers ───────────────────────────────────── */

function renderKPIBar() {
  const nw      = netWorth();
  const assets  = totalAssets();
  const liab    = totalLiabilities();
  const liquid  = liquidTotal();
  const reEq    = realEstateEquity();
  const annDebt = totalAnnualDebtService();
  const alts    = alternativesTotal();

  const kpi = (label, val) => `
    <div class="kpi">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${formatDollars(val)}</span>
    </div>`;

  return `
    <div class="nw-hero">
      <span class="nw-label">Net Worth</span>
      <span class="nw-value">${formatDollars(nw)}</span>
      <span class="nw-sub">${formatDollars(assets)} total assets &nbsp;·&nbsp; ${formatDollars(liab)} liabilities</span>
    </div>
    <div class="kpi-bar">
      ${kpi("Liquid Assets", liquid)}
      ${kpi("Real Estate Equity", reEq)}
      ${kpi("Alternatives", alts)}
      ${kpi("Total Liabilities", liab)}
      ${kpi("Annual Debt Service", annDebt)}
    </div>`;
}

function renderNetWorthBreakdown() {
  const cash    = cashTotal();
  const invest  = liquidInvestmentsTotal();
  const reEq    = realEstateEquity();
  const alts    = alternativesTotal();
  const total   = invest + cash + reEq + alts;

  const segments = [
    { label: "Investments",        value: invest, color: DONUT_COLORS.investments },
    { label: "Cash",               value: cash,   color: DONUT_COLORS.cash },
    { label: "Real Estate Equity", value: reEq,   color: DONUT_COLORS.realestate },
    { label: "Alternatives",       value: alts,   color: DONUT_COLORS.alts },
  ].filter(s => s.value > 0);

  const legend = segments.map(s => {
    const pct = total > 0 ? (s.value / total * 100).toFixed(1) : "0.0";
    return `<div class="donut-legend-row">
      <span class="legend-swatch" style="background:${s.color}"></span>
      <span class="legend-label">${s.label}</span>
      <span class="legend-val mono">${formatDollars(s.value)}</span>
      <span class="legend-pct mono">${pct}%</span>
    </div>`;
  }).join("");

  const center = total > 0 ? { value: fmtShort(total), label: "NET WORTH" } : null;

  return `<div class="card">
    <h3 class="card-title">Net Worth Breakdown</h3>
    <div class="donut-wrap">
      <div class="donut-svg">${buildDonut(segments, 160, center)}</div>
      <div class="donut-legend">${legend || '<p class="muted-note">No data yet.</p>'}</div>
    </div>
  </div>`;
}

function renderRetirementProgress() {
  const d      = state.dashboard;
  const nw     = netWorth();
  const target = Number(d.targetNetWorth) || 0;
  const progress = target > 0 ? Math.min(100, (nw / target) * 100) : 0;
  const yearsLeft = Math.max(0, Number(d.targetAge) - Number(d.currentAge));
  const gap    = target - nw;

  return `<div class="card">
    <h3 class="card-title">Progress to Retirement</h3>
    <div class="form-grid">
      <div class="field">
        <label>Current Age</label>
        <input type="number" class="dash-field" data-dash="currentAge" value="${d.currentAge}" min="1" max="120"/>
      </div>
      <div class="field">
        <label>Target Retirement Age</label>
        <input type="number" class="dash-field" data-dash="targetAge" value="${d.targetAge}" min="1" max="120"/>
      </div>
      <div class="field span-2">
        <label>Target Net Worth</label>
        <input type="number" class="dash-field" data-dash="targetNetWorth" value="${target}" min="0"/>
      </div>
    </div>
    <div class="progress-section">
      <div class="progress-meta">
        <span class="progress-years-txt"><span class="progress-years-val mono">${yearsLeft}</span> yrs to target</span>
        <span class="progress-gap ${signClass(gap)}">${gap > 0 ? formatDollars(gap) + " gap" : "Target reached"}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${progress.toFixed(1)}%"></div>
      </div>
      <div class="progress-labels">
        <span class="progress-cur-val mono">${formatDollars(nw)}</span>
        <span class="progress-tgt-val mono">${formatDollars(target)}</span>
      </div>
    </div>
  </div>`;
}

function renderDebtSummary() {
  const estimates = debtPayoffEstimates();
  const totalBal  = totalDebt();
  const wadr      = weightedAvgDebtRate();
  const monthly   = totalMonthlyDebtService();
  const annual    = totalAnnualDebtService();

  const finiteYears = estimates.filter(e => isFinite(e.years)).map(e => e.years);
  const maxYears    = finiteYears.length > 0 ? Math.max(...finiteYears) : 1;

  const bars = estimates.map(e => {
    const display = isFinite(e.years) ? `${e.years.toFixed(1)} yrs` : "∞";
    const pct     = isFinite(e.years) ? Math.min(100, (e.years / maxYears) * 100).toFixed(1) : "100";
    return `<div class="debt-bar-row">
      <span class="debt-bar-name" title="${e.name}">${e.name}</span>
      <div class="debt-bar-track">
        <div class="debt-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="debt-bar-bal mono">${formatDollars(e.balance)}</span>
      <span class="debt-bar-yrs mono">${display}</span>
    </div>`;
  }).join("");

  return `<div class="card">
    <h3 class="card-title">Debt Summary</h3>
    <div class="stat-row">
      <div class="stat">
        <div class="stat-label">Total Debt</div>
        <div class="stat-value">${formatDollars(totalBal)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Wtd Avg Rate</div>
        <div class="stat-value">${formatPercent(wadr, { decimals: 2 })}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Monthly Service</div>
        <div class="stat-value">${formatDollars(monthly)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Annual Service</div>
        <div class="stat-value">${formatDollars(annual)}</div>
      </div>
    </div>
    ${estimates.length > 0
      ? `<div class="debt-bars">${bars}</div>`
      : `<p class="muted-note">No debts entered.</p>`}
  </div>`;
}

function renderConcentration() {
  const breakdown = concentrationBreakdown();
  const liquid    = liquidTotal();

  if (breakdown.length === 0) {
    return `<div class="card">
      <h3 class="card-title">Concentration Risk</h3>
      <p class="muted-note">No concentration holdings entered — add them in Inputs → Liquid Investments.</p>
    </div>`;
  }

  const flagged = breakdown.filter(h => h.flagged);

  const segments = breakdown.map((h, i) => ({
    label: h.holding,
    value: h.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const rows = breakdown.map((h, i) => {
    const color  = PIE_COLORS[i % PIE_COLORS.length];
    const pctLiq = liquid > 0 ? (h.value / liquid * 100).toFixed(1) + "%" : "—";
    const flag   = h.flagged ? `<span class="conc-flag">⚠ &gt;15%</span>` : "";
    return `<tr>
      <td>
        <span class="swatch-sm" style="background:${color}"></span>
        ${h.holding}${flag}
      </td>
      <td class="num mono">${formatDollars(h.value)}</td>
      <td class="num mono${h.flagged ? " value-neg" : ""}">${pctLiq}</td>
    </tr>`;
  }).join("");

  const concTotal    = breakdown.reduce((s, h) => s + h.value, 0);
  const concTotalPct = liquid > 0 ? (concTotal / liquid * 100).toFixed(1) + "%" : "—";

  const alertHtml = flagged.length > 0
    ? `<div class="conc-alert conc-alert--warn">⚠ ${flagged.map(h => h.holding).join(", ")} exceed${flagged.length === 1 ? "s" : ""} 15% of liquid assets</div>`
    : `<div class="conc-alert conc-alert--ok">No single holding exceeds 15% of liquid assets</div>`;

  return `<div class="card">
    <h3 class="card-title">Concentration Risk</h3>
    ${alertHtml}
    <div class="conc-layout">
      <div class="conc-pie">${buildPie(segments)}</div>
      <div class="conc-table-wrap">
        <table>
          <thead><tr>
            <th>Holding</th>
            <th class="num">Value</th>
            <th class="num">% of Liquid</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td class="label">Total</td>
            <td class="num mono">${formatDollars(concTotal)}</td>
            <td class="num mono">${concTotalPct}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;
}

/* ─── §121 home-sale exclusion alert ──────────────────────── */

function render121Alert() {
  const p = state.inputs.realEstate.primary;
  if (!p || !p.value || !p.purchasePrice) return "";

  const adjustedBasis  = Number(p.purchasePrice) + Number(p.improvements || 0);
  const unrealizedGain = Number(p.value) - adjustedBasis;
  if (unrealizedGain <= 0) return "";

  const MFJ_EXCLUSION = 500000;
  const taxableGain   = unrealizedGain - MFJ_EXCLUSION;
  const held = new Date().getFullYear() - Number(p.purchaseYear || 0);

  if (taxableGain > 0) {
    return `<div class="ctx-alert ctx-alert--warn">
      <div>
        <strong>§121 Exclusion Cap Exceeded</strong> — Primary residence has
        <strong>${formatDollars(unrealizedGain)}</strong> unrealized gain on an adjusted basis of
        ${formatDollars(adjustedBasis)} (${formatDollars(p.purchasePrice)} purchase +
        ${formatDollars(p.improvements || 0)} improvements, ${held} yr${held !== 1 ? "s" : ""} held).
        MFJ §121 covers $500K — roughly <strong>${formatDollars(taxableGain)}</strong> would be
        taxable on a sale at current value. Consider timing, additional improvements, or planning
        for capital-gains exposure.
      </div>
    </div>`;
  }

  if (unrealizedGain >= MFJ_EXCLUSION * 0.75) {
    return `<div class="ctx-alert ctx-alert--caution">
      <div>
        <strong>§121 Approaching Cap</strong> — ${formatDollars(unrealizedGain)} unrealized gain,
        ${formatDollars(MFJ_EXCLUSION - unrealizedGain)} remaining before the $500K MFJ exclusion is exceeded.
        Track additional improvements to maximize adjusted basis.
      </div>
    </div>`;
  }

  return "";
}

/* ─── Main export ─────────────────────────────────────────── */

export function renderDashboard() {
  const container = document.getElementById("tab-dashboard");
  if (!container) return;

  // Full re-render each time the tab is shown so edits in Inputs are reflected.
  container.innerHTML = `
    <h2 class="section-title">Dashboard</h2>
    <p class="section-sub">Live snapshot — updates automatically from your Inputs data.</p>
    <div class="dash-stagger">
      ${renderKPIBar()}
      ${render121Alert()}
      <div class="dash-grid-2">
        ${renderNetWorthBreakdown()}
        ${renderRetirementProgress()}
      </div>
      ${renderDebtSummary()}
      ${renderConcentration()}
    </div>`;

  // Wire inline dashboard-settings fields. Using "change" (fires on blur/Enter)
  // instead of "input" to avoid re-render while the user is still typing.
  container.querySelectorAll(".dash-field").forEach(input => {
    input.addEventListener("change", e => {
      const key = e.target.dataset.dash;
      state.dashboard[key] = parseNumber(e.target.value);
      save();
      renderDashboard();   // re-render to update progress display
    });
  });
}
