// retirement.js
// Retirement Modeler (Simple View): projects investable portfolio growth to the
// retirement age, layers guaranteed income (pension / VA / Social Security /
// rental), and tests whether desired spending is sustainable. All figures are
// modeled in today's (real) dollars so the user reads them at face value.

import { state, save } from "./state.js";
import {
  liquidTotal, alternativesTotal, realEstateEquity,
} from "./financials.js";
import {
  formatDollars, formatPercent, parseNumber,
  futureValue, futureValueAnnuity,
} from "./utils.js";

const SS_FACTORS = { 62: 0.7, 67: 1.0, 70: 1.24 };

/* ------------------------------------------------------------------ *
 * Compute — pure, reads state, returns all derived numbers
 * ------------------------------------------------------------------ */

export function compute() {
  const r   = state.retirement;
  const m   = state.inputs.military;
  const inc = state.inputs.income;
  const re  = state.inputs.realEstate;

  const currentAge = Number(state.dashboard.currentAge) || 0;
  // Canonical retire age lives on the Dashboard; r.retireAge is kept in sync as
  // a fallback for users with older saved state that hasn't been updated yet.
  const retireAge = Number(state.dashboard.targetAge) || Number(r.retireAge) || currentAge;
  const lifeExpectancy = Math.max(retireAge + 1, Number(r.lifeExpectancy) || 90);
  const yearsToRetire  = Math.max(0, retireAge - currentAge);

  // Real (inflation-adjusted) return via the Fisher relation.
  const nominal    = Number(r.nominalReturn) / 100;
  const inflation  = Number(r.inflation) / 100;
  const realReturn = (1 + nominal) / (1 + inflation) - 1;
  const wr         = Number(r.withdrawalRate) / 100;

  // Metals are projected at their own growth rates (real terms); everything
  // else grows at the portfolio real return.
  const alt = state.inputs.alternatives;
  const goldNominalRate    = Number(alt.goldGrowthPct    || 0) / 100;
  const silverNominalRate  = Number(alt.silverGrowthPct  || 0) / 100;
  const bitcoinNominalRate = Number(alt.bitcoinGrowthPct || 0) / 100;
  const goldRealRate    = (1 + goldNominalRate)    / (1 + inflation) - 1;
  const silverRealRate  = (1 + silverNominalRate)  / (1 + inflation) - 1;
  const bitcoinRealRate = (1 + bitcoinNominalRate) / (1 + inflation) - 1;

  const goldCurrent    = Number(alt.goldOunces   || 0) * Number(alt.goldPrice   || 0);
  const silverCurrent  = Number(alt.silverOunces || 0) * Number(alt.silverPrice || 0);
  const bitcoinCurrent = Number(alt.bitcoin || 0);

  // Hard assets are projected at their own rates; everything else at the portfolio rate.
  const nonHardAssetInvestable =
    liquidTotal() +
    (alternativesTotal() - goldCurrent - silverCurrent - bitcoinCurrent) +
    (r.includeRealEstate ? realEstateEquity() : 0);

  const investable = nonHardAssetInvestable + goldCurrent + silverCurrent + bitcoinCurrent;

  const annualContribution = Number(r.annualContribution) || 0;
  const desiredSpending    = Number(r.desiredSpending) || 0;

  // Guaranteed income sources (today's dollars) with their start ages.
  const pension   = Number(m.high3 || 0) * (Number(m.pensionMultiplierPct || 0) / 100);
  const va        = Number(m.vaAnnual || 0);
  const rentalNet = Number(re.rental.annualGrossRent || 0) * (1 - Number(re.rental.mgmtFeePct || 0) / 100);
  const ssA       = Number(m.ssAFull67 || 0) * (SS_FACTORS[m.ssAClaimAge] || 1);
  const ssB       = Number(m.ssBFull67 || 0) * (SS_FACTORS[m.ssBClaimAge] || 1);

  const nameA = inc.earnerAName || "Earner A";
  const nameB = inc.earnerBName || "Earner B";

  const sources = [
    { label: "Military Pension",         amount: pension,   startAge: Number(m.pensionStartAge) || retireAge },
    { label: "VA Disability (tax-free)", amount: va,        startAge: 0 },
    { label: "Rental Net Income",        amount: rentalNet, startAge: 0 },
    { label: `${nameA} Social Security`, amount: ssA,       startAge: Number(m.ssAClaimAge) || 67 },
    { label: `${nameB} Social Security`, amount: ssB,       startAge: Number(m.ssBClaimAge) || 67 },
  ].filter((s) => s.amount > 0);

  // Sum of guaranteed income that has begun by a given age.
  const guaranteedAtAge = (age) =>
    sources.reduce((sum, s) => sum + (age >= s.startAge ? s.amount : 0), 0);

  const guaranteedAtRetire = guaranteedAtAge(retireAge);
  const portfolioDraw      = Math.max(0, desiredSpending - guaranteedAtRetire);
  const requiredPortfolio  = wr > 0 ? portfolioDraw / wr : 0;

  // Portfolio value at retirement (real $).
  // Metals grow at their own real rates; everything else at the portfolio rate.
  const balanceAtRetirement =
    futureValue(nonHardAssetInvestable, realReturn, yearsToRetire) +
    futureValueAnnuity(annualContribution, realReturn, yearsToRetire) +
    futureValue(goldCurrent, goldRealRate, yearsToRetire) +
    futureValue(silverCurrent, silverRealRate, yearsToRetire) +
    futureValue(bitcoinCurrent, bitcoinRealRate, yearsToRetire);

  const surplus           = balanceAtRetirement - requiredPortfolio;
  const sustainableIncome = balanceAtRetirement * wr + guaranteedAtRetire;
  const incomeSurplus     = sustainableIncome - desiredSpending;

  // ---- Year-by-year simulation for the growth chart ----
  // Accumulation: contributions + growth until retirement.
  // Drawdown: growth minus the portfolio draw needed each year (guaranteed
  // income may rise as Social Security begins, lowering the draw).
  const series = [];
  let balance = investable;  // investable = all assets combined
  let depletedAge = null;
  for (let age = currentAge; age <= lifeExpectancy; age++) {
    series.push({ age, balance: Math.max(0, balance) });
    if (age < retireAge) {
      balance = balance * (1 + realReturn) + annualContribution;
    } else {
      const draw = Math.max(0, desiredSpending - guaranteedAtAge(age));
      balance = balance * (1 + realReturn) - draw;
      if (balance <= 0 && depletedAge == null) depletedAge = age + 1;
    }
  }

  return {
    currentAge, retireAge, lifeExpectancy, yearsToRetire,
    nominal, inflation, realReturn, wr,
    investable, annualContribution, desiredSpending,
    sources, guaranteedAtRetire, portfolioDraw, requiredPortfolio,
    balanceAtRetirement, surplus, sustainableIncome, incomeSurplus,
    series, depletedAge, guaranteedAtAge,
  };
}

/* ------------------------------------------------------------------ *
 * Inline SVG line/area chart
 * ------------------------------------------------------------------ */

function buildAreaChart(series, retireAge, { w = 640, h = 220 } = {}) {
  const padL = 8, padR = 8, padT = 14, padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const ages = series.map((p) => p.age);
  const minAge = ages[0], maxAge = ages[ages.length - 1];
  const maxBal = Math.max(...series.map((p) => p.balance), 1);

  const x = (age) => padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * innerW;
  const y = (bal) => padT + innerH - (bal / maxBal) * innerH;

  const linePts = series.map((p) => `${x(p.age).toFixed(1)},${y(p.balance).toFixed(1)}`).join(" ");
  const areaPts = `${x(minAge).toFixed(1)},${(padT + innerH).toFixed(1)} ${linePts} ${x(maxAge).toFixed(1)},${(padT + innerH).toFixed(1)}`;

  const retX = x(retireAge).toFixed(1);

  // Y-axis hint labels (max + midpoint).
  const yLabel = (bal, txt) =>
    `<text x="${padL + 2}" y="${(y(bal) - 3).toFixed(1)}" fill="#6b7280" font-size="10" font-family="monospace">${txt}</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" class="ret-chart">
    <defs>
      <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00d4aa" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#00d4aa" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <line x1="${retX}" y1="${padT}" x2="${retX}" y2="${padT + innerH}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${retX}" y="${padT - 3}" fill="#f59e0b" font-size="10" font-family="monospace" text-anchor="middle">retire ${retireAge}</text>
    <polygon points="${areaPts}" fill="url(#retFill)"/>
    <polyline points="${linePts}" fill="none" stroke="#00d4aa" stroke-width="2"/>
    ${yLabel(maxBal, formatDollars(maxBal))}
    <text x="${padL + 2}" y="${(padT + innerH - 3).toFixed(1)}" fill="#6b7280" font-size="10" font-family="monospace">age ${minAge}</text>
    <text x="${(w - padR).toFixed(1)}" y="${(padT + innerH - 3).toFixed(1)}" fill="#6b7280" font-size="10" font-family="monospace" text-anchor="end">age ${maxAge}</text>
  </svg>`;
}

/* ------------------------------------------------------------------ *
 * Section renderers
 * ------------------------------------------------------------------ */

function signClass(n) {
  return n < 0 ? "value-neg" : n > 0 ? "value-pos" : "";
}

function renderKPIs(c) {
  const kpi = (label, val, cls = "", hero = false) => `
    <div class="kpi${hero ? " kpi-hero" : ""}">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value ${cls}">${val}</span>
    </div>`;

  const depletionVal = c.depletedAge != null
    ? `<span class="value-neg">age ${c.depletedAge}</span>`
    : `age ${c.lifeExpectancy}+`;

  return `<div class="kpi-bar ret-kpi-bar">
    ${kpi("Projected at Retirement", formatDollars(c.balanceAtRetirement), "", true)}
    ${kpi("Required Portfolio", formatDollars(c.requiredPortfolio))}
    ${kpi(c.surplus >= 0 ? "Portfolio Surplus" : "Portfolio Gap",
          formatDollars(Math.abs(c.surplus)), signClass(c.surplus))}
    ${kpi("Sustainable Income", formatDollars(c.sustainableIncome))}
    <div class="kpi">
      <span class="kpi-label">Portfolio Lasts Until</span>
      <span class="kpi-value">${depletionVal}</span>
    </div>
  </div>`;
}

function renderAssumptions(c) {
  const r = state.retirement;
  const numField = (label, key, suffix = "") => `
    <div class="field">
      <label>${label}</label>
      <input type="number" class="ret-field" data-ret="${key}" value="${r[key]}" step="any"/>
      ${suffix ? `<div class="field-note">${suffix}</div>` : ""}
    </div>`;

  const retireAge = state.dashboard.targetAge || r.retireAge;

  return `<div class="card">
    <h3 class="card-title">Assumptions</h3>
    <div class="form-grid">
      <div class="field">
        <label>Retirement Age</label>
        <input type="number" class="ret-age-field" value="${retireAge}" min="1" max="120"/>
        <div class="field-note">Synced with Dashboard — ${c.yearsToRetire} yr${c.yearsToRetire !== 1 ? "s" : ""} away</div>
      </div>
      ${numField("Life Expectancy", "lifeExpectancy")}
      ${numField("Nominal Return (%)", "nominalReturn", `Real return ≈ ${formatPercent(c.realReturn * 100, { decimals: 2 })} after inflation`)}
      ${numField("Inflation (%)", "inflation")}
      ${numField("Annual Contribution (today's $)", "annualContribution")}
      ${numField("Desired Annual Spending (today's $)", "desiredSpending")}
      ${numField("Safe Withdrawal Rate (%)", "withdrawalRate")}
    </div>
    <label class="ret-toggle">
      <input type="checkbox" class="ret-check" data-ret="includeRealEstate" ${r.includeRealEstate ? "checked" : ""}/>
      Include real-estate equity (${formatDollars(realEstateEquity())}) as investable
    </label>
    <div class="readonly-line" style="margin-top:14px">
      Starting investable portfolio: <span class="accent">${formatDollars(c.investable)}</span>
      &middot; ${c.yearsToRetire} yr${c.yearsToRetire !== 1 ? "s" : ""} to retirement
    </div>
  </div>`;
}

function renderIncomeLayers(c) {
  const rows = c.sources.map((s) => {
    const active = c.retireAge >= s.startAge;
    const startTxt = s.startAge === 0 ? "now" : `age ${s.startAge}`;
    return `<tr${active ? "" : ' style="opacity:0.5"'}>
      <td>${s.label}</td>
      <td class="num mono">${formatDollars(s.amount)}</td>
      <td class="num mono">${startTxt}${active ? "" : " (not yet)"}</td>
    </tr>`;
  }).join("");

  const draw = `<tr>
      <td>Portfolio Draw (${formatPercent(c.wr * 100)})</td>
      <td class="num mono">${formatDollars(c.balanceAtRetirement * c.wr)}</td>
      <td class="num mono">at retirement</td>
    </tr>`;

  const verdict = c.incomeSurplus >= 0
    ? `<div class="tax-alert tax-alert--info"><span class="alert-icon">&#10003;</span>
        <div class="alert-body"><strong>On track</strong>
        Sustainable income of ${formatDollars(c.sustainableIncome)} covers your
        ${formatDollars(c.desiredSpending)} target with
        ${formatDollars(c.incomeSurplus)} to spare.</div></div>`
    : `<div class="tax-alert tax-alert--warn"><span class="alert-icon">&#9888;</span>
        <div class="alert-body"><strong>Shortfall ~${formatDollars(Math.abs(c.incomeSurplus))}/yr</strong>
        Sustainable income of ${formatDollars(c.sustainableIncome)} falls short of your
        ${formatDollars(c.desiredSpending)} target. Increase contributions, delay
        retirement, or trim spending.</div></div>`;

  const depleted = c.depletedAge != null
    ? `<p class="muted-note">⚠ At this spending level the portfolio depletes around age ${c.depletedAge}.</p>`
    : `<p class="muted-note">Portfolio sustains spending through age ${c.lifeExpectancy}.</p>`;

  // Identify the "income bridge" — years where the portfolio must cover the full
  // spending need because guaranteed income hasn't started yet.
  const bridgeEndAge = c.sources.length > 0
    ? Math.max(...c.sources.map((s) => s.startAge === 0 ? c.retireAge : s.startAge))
    : null;
  const bridgeYears = bridgeEndAge != null ? Math.max(0, bridgeEndAge - c.retireAge) : 0;
  const bridgeDraw   = c.desiredSpending - c.guaranteedAtAge(c.retireAge);
  const bridgeAlert = bridgeYears > 1
    ? `<div class="ctx-alert ctx-alert--caution">
        <div>
          <strong>Income Bridge Gap — ${bridgeYears} yr${bridgeYears !== 1 ? "s" : ""}</strong><br/>
          From retirement (age ${c.retireAge}) until all income sources start (age ${bridgeEndAge}),
          the portfolio must cover <strong>${formatDollars(bridgeDraw)}/yr</strong> before
          pension and Social Security phase in.
        </div>
       </div>`
    : "";

  return `<div class="card">
    <h3 class="card-title">Retirement Income Layering</h3>
    ${verdict}
    ${bridgeAlert}
    <table>
      <thead><tr>
        <th>Source</th>
        <th class="num">Annual (today's $)</th>
        <th class="num">Starts</th>
      </tr></thead>
      <tbody>
        ${rows || ""}
        ${draw}
      </tbody>
      <tfoot><tr>
        <td class="label">Sustainable Total</td>
        <td class="num mono">${formatDollars(c.sustainableIncome)}</td>
        <td class="num mono ${signClass(c.incomeSurplus)}">${
          c.incomeSurplus >= 0 ? "+" : "−"}${formatDollars(Math.abs(c.incomeSurplus))}</td>
      </tr></tfoot>
    </table>
    ${depleted}
  </div>`;
}

function renderChart(c) {
  return `<div class="card">
    <h3 class="card-title">Portfolio Projection (today's $)</h3>
    ${buildAreaChart(c.series, c.retireAge)}
    <p class="muted-note">
      Accumulation through age ${c.retireAge}, then draw-down to age ${c.lifeExpectancy}.
      Real return ${formatPercent(c.realReturn * 100, { decimals: 2 })}.
    </p>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Main render entry point
 * ------------------------------------------------------------------ */

export function renderRetirement() {
  const sec = document.getElementById("tab-retirement");
  if (!sec) return;

  const c = compute();
  sec.innerHTML = `
    <h2 class="section-title">Retirement Modeler</h2>
    <p class="section-sub">Simple projection in today's dollars — updates from your Inputs and assumptions.</p>
    <div class="dash-stagger">
      ${renderKPIs(c)}
      ${renderChart(c)}
      <div class="dash-grid-2">
        ${renderAssumptions(c)}
        ${renderIncomeLayers(c)}
      </div>
    </div>`;

  // Retirement age field — writes to both dashboard and retirement state so they
  // stay in sync regardless of which tab the user edits the value from.
  const retAgeField = sec.querySelector(".ret-age-field");
  if (retAgeField) {
    retAgeField.addEventListener("change", (e) => {
      const v = parseNumber(e.target.value);
      state.dashboard.targetAge = v;
      state.retirement.retireAge = v;
      save();
      renderRetirement();
    });
  }

  // All other assumption fields.
  sec.querySelectorAll(".ret-field").forEach((input) => {
    input.addEventListener("change", (e) => {
      state.retirement[e.target.dataset.ret] = parseNumber(e.target.value);
      save();
      renderRetirement();
    });
  });
  sec.querySelectorAll(".ret-check").forEach((input) => {
    input.addEventListener("change", (e) => {
      state.retirement[e.target.dataset.ret] = e.target.checked;
      save();
      renderRetirement();
    });
  });
}
