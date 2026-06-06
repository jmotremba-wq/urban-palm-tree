/* ============================================================
   Retirement Calculator — calculator.js  (v2)
   Multi-account | Precious metals | Tax modeling | Active-duty pension
   localStorage persistence | Portfolio breakdown bar
   ============================================================ */

'use strict';

// ── Number formatting ─────────────────────────────────────────

function formatDollars(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

// ── Financial math ────────────────────────────────────────────

/**
 * Fisher equation: real rate given nominal + inflation (both as decimals).
 */
function realAnnualRate(nominal, inflation) {
  return (1 + nominal) / (1 + inflation) - 1;
}

/**
 * Future value of a lump sum using real annual rate, n years.
 * FV = PV * (1 + r)^n
 */
function futureValueLumpSum(pv, annualRate, years) {
  return pv * Math.pow(1 + annualRate, years);
}

/**
 * Future value of end-of-period monthly annuity using the real monthly rate.
 * FV = PMT * [(1 + r_m)^months - 1] / r_m
 * Degenerate case (r_m ≈ 0): FV = PMT * months.
 */
function futureValueAnnuity(monthlyPayment, annualRate, years) {
  const months = years * 12;
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  if (Math.abs(r) < 1e-10) return monthlyPayment * months;
  return monthlyPayment * (Math.pow(1 + r, months) - 1) / r;
}

/**
 * Maximum monthly withdrawal that exhausts a portfolio over retirementYears.
 * PMT = PV * r_m / (1 - (1+r_m)^-n)
 */
function maxMonthlyWithdrawal(portfolioValue, annualRealRate, retirementYears) {
  const months = retirementYears * 12;
  const r = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  if (Math.abs(r) < 1e-10) return portfolioValue / months;
  return portfolioValue * r / (1 - Math.pow(1 + r, -months));
}

// ── Navy Reserve / Active-Duty pay table ──────────────────────
// Approximate 2025 monthly base pay (USD).  [minYOS, monthlyPay]
const OFFICER_BASE_PAY = {
  'O-3': [[0,4857],[2,5484],[3,5905],[4,6193],[6,6605],[8,7207]],
  'O-4': [[0,5517],[2,6370],[3,6789],[4,7112],[6,7601],[8,7983],[10,8230]],
  'O-5': [[0,6394],[2,7196],[3,7694],[4,8105],[6,8443],[8,8758],[10,9021],[12,9304],[14,9557]],
  'O-6': [[0,7648],[2,8399],[3,8932],[4,9365],[6,9818],[8,10276],[10,10776],[12,11185],[14,11613],[16,11820],[18,11945]],
  'O-7': [[0,11469],[2,11894],[4,12193],[6,12492]],
  'O-8': [[0,13892],[2,14395],[4,14651],[6,15172]],
};

function lookupBasePayMonthly(grade, yos) {
  const brackets = OFFICER_BASE_PAY[grade];
  if (!brackets) return 0;
  let pay = brackets[0][1];
  for (const [minYos, amount] of brackets) {
    if (yos >= minYos) pay = amount;
  }
  return pay;
}

// Reserve retirement: (points / 360) × system_rate × base_pay
function calcReservePension(totalPoints, basePayMonthly, useBRS) {
  return (totalPoints / 360) * (useBRS ? 0.02 : 0.025) * basePayMonthly;
}

// ── Savings duration simulation ───────────────────────────────

/**
 * Simulate how many years savings last.
 * grossMonthlyNeeded is the gross withdrawal required to net the target after tax.
 * Pension and SS reduce the required portfolio draw directly.
 * Returns Infinity if balance never reaches zero.
 */
function simSavingsYears(
  portfolioValue, annualRealRate,
  grossNeededFuture, ssFuture, pensionFuture, pensionStartAge, retirementAge
) {
  if (portfolioValue <= 0) return 0;
  const r = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  let balance = portfolioValue;

  for (let yr = 0; yr < 100; yr++) {
    const age = retirementAge + yr;
    // Pension and SS are already net income, reduce gross needed from portfolio
    const pension = (pensionFuture > 0 && age >= pensionStartAge) ? pensionFuture : 0;
    const netPortfolioNeeded = Math.max(0, grossNeededFuture - ssFuture - pension);

    if (netPortfolioNeeded <= 0) return Infinity;

    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) - netPortfolioNeeded;
      if (balance <= 0) return yr + m / 12;
    }
  }
  return Infinity;
}

// ── Chart ─────────────────────────────────────────────────────

let chartInstance = null;

/**
 * Build year-by-year balance data for accumulation + decumulation phases.
 * Chart shows TOTAL portfolio (all accounts + metals combined).
 */
function buildChartData(inputs) {
  const {
    currentAge,
    retirementAge,
    // per-account starting balances + monthly contributions at today's real value
    tradBal, tradContrib,
    rothBal, rothContrib,
    taxableBal, taxableContrib,
    goldBal, silverBal,
    realReturn,          // real annual return for investment accounts
    realGoldReturn,      // real annual for gold
    realSilverReturn,    // real annual for silver
    grossMonthlyFuture,  // gross monthly needed from portfolio (future $)
    ssFuture,
    pensionFuture,
    pensionStartAge,
    maxSimYears,
  } = inputs;

  const realMonthly        = Math.pow(1 + realReturn, 1 / 12) - 1;
  const realGoldMonthly    = Math.pow(1 + realGoldReturn, 1 / 12) - 1;
  const realSilverMonthly  = Math.pow(1 + realSilverReturn, 1 / 12) - 1;

  const labels = [];
  const accum  = [];
  const decum  = [];

  // ── Accumulation phase ────────────────────────────────────
  let trad    = tradBal;
  let roth    = rothBal;
  let taxable = taxableBal;
  let gold    = goldBal;
  let silver  = silverBal;

  const yearsToRetirement = retirementAge - currentAge;

  for (let yr = 0; yr <= yearsToRetirement; yr++) {
    labels.push(String(currentAge + yr));
    const total = trad + roth + taxable + gold + silver;

    if (yr === 0) {
      accum.push(total);
      decum.push(null);
    } else {
      for (let m = 0; m < 12; m++) {
        trad    = trad    * (1 + realMonthly)       + tradContrib;
        roth    = roth    * (1 + realMonthly)       + rothContrib;
        taxable = taxable * (1 + realMonthly)       + taxableContrib;
        gold    = gold    * (1 + realGoldMonthly);
        silver  = silver  * (1 + realSilverMonthly);
      }
      accum.push(trad + roth + taxable + gold + silver);
      decum.push(null);
    }
  }

  // ── Decumulation phase ─────────────────────────────────────
  let retiredBal = trad + roth + taxable + gold + silver;
  decum[decum.length - 1] = retiredBal; // overlap at retirement age

  for (let yr = 1; yr <= maxSimYears; yr++) {
    const age = retirementAge + yr;
    labels.push(String(age));
    accum.push(null);

    const pension = (pensionFuture > 0 && age >= pensionStartAge) ? pensionFuture : 0;
    const netPortfolioNeeded = Math.max(0, grossMonthlyFuture - ssFuture - pension);

    for (let m = 0; m < 12; m++) {
      retiredBal = retiredBal * (1 + realMonthly) - netPortfolioNeeded;
    }

    const floored = Math.max(0, retiredBal);
    decum.push(floored);
    if (retiredBal <= 0) { retiredBal = 0; break; }
  }

  return { labels, accum, decum };
}

function renderChart(chartData) {
  const ctx = document.getElementById('savingsChart').getContext('2d');

  const base = {
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2.5,
    tension: 0.35,
    fill: false,
  };

  const datasets = [
    { ...base, label: 'Accumulation',       data: chartData.accum, borderColor: '#2ecc71', pointHoverBackgroundColor: '#2ecc71', spanGaps: false },
    { ...base, label: 'Retirement drawdown', data: chartData.decum, borderColor: '#e67e22', pointHoverBackgroundColor: '#e67e22', spanGaps: false },
  ];

  if (chartInstance) {
    chartInstance.data.labels = chartData.labels;
    chartInstance.data.datasets[0].data = datasets[0].data;
    chartInstance.data.datasets[1].data = datasets[1].data;
    chartInstance.update('none');
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: chartData.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.parsed.y;
              if (v === null) return null;
              return ctx.dataset.label + ': ' + formatDollars(v);
            },
            title(items) { return 'Age ' + items[0].label; },
          },
          filter(item) { return item.parsed.y !== null; },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            maxTicksLimit: 12,
            callback(value, index) {
              const label = this.getLabelForValue(index);
              return parseInt(label, 10) % 5 === 0 ? label : '';
            },
          },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            callback(value) {
              if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
              if (value >= 1_000)     return '$' + (value / 1_000).toFixed(0) + 'K';
              return '$' + value;
            },
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ── Portfolio breakdown bar ───────────────────────────────────

const BUCKET_META = [
  { key: 'trad',    label: 'Trad 401k', color: '#3498db' },
  { key: 'roth',    label: 'Roth',      color: '#2ecc71' },
  { key: 'taxable', label: 'Taxable',   color: '#9b59b6' },
  { key: 'gold',    label: 'Gold',      color: '#f39c12' },
  { key: 'silver',  label: 'Silver',    color: '#95a5a6' },
];

function renderBreakdown(buckets) {
  // buckets = { trad, roth, taxable, gold, silver } — retirement-day values
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  const barEl    = document.getElementById('breakdownBar');
  const legendEl = document.getElementById('breakdownLegend');
  barEl.innerHTML    = '';
  legendEl.innerHTML = '';

  if (total <= 0) return;

  BUCKET_META.forEach(({ key, label, color }) => {
    const val = buckets[key] || 0;
    if (val <= 0) return;
    const pct = (val / total) * 100;

    // Bar segment
    const seg = document.createElement('div');
    seg.className = 'breakdown-segment';
    seg.style.flex = String(pct);
    seg.style.background = color;
    seg.title = label + ': ' + formatDollars(val) + ' (' + pct.toFixed(1) + '%)';
    barEl.appendChild(seg);

    // Legend item
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML =
      `<span class="legend-swatch" style="background:${color}"></span>` +
      `<span>${label} ${formatDollars(val)}</span>`;
    legendEl.appendChild(item);
  });
}

// ── localStorage persistence ──────────────────────────────────

const STORAGE_KEY = 'retirementCalcV2';

function saveInputs() {
  const data = {};
  document.querySelectorAll('#inputs-card input, #inputs-card select').forEach(el => {
    if (el.id) data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

function loadInputs() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.entries(data).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') { el.checked = val; }
      else { el.value = val; }
    });
  } catch(e) {}
}

// ── Error helpers ─────────────────────────────────────────────

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorMessage').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorBanner').classList.add('hidden');
}

// ── Helper: read a numeric field ──────────────────────────────

function num(id, fallback) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? (fallback !== undefined ? fallback : 0) : v;
}

// ── Main calculation ──────────────────────────────────────────

function calculate() {
  // ── Read all inputs ────────────────────────────────────────
  const currentAge    = num('currentAge');
  const retirementAge = num('retirementAge');

  // Investment accounts
  const tradBal       = num('tradBalance');
  const tradContrib   = num('tradContrib');
  const rothBal       = num('rothBalance');
  const rothContrib   = num('rothContrib');
  const taxableBal    = num('taxableBalance');
  const taxableContrib = num('taxableContrib');

  // Precious metals
  const goldBal      = num('goldBalance');
  const goldReturnPct = num('goldReturn', 7);
  const silverBal    = num('silverBalance');
  const silverReturnPct = num('silverReturn', 5);

  // Assumptions
  const nominalReturnPct = num('annualReturn', 7);
  const inflationPct     = num('inflationRate', 3);

  // Tax rates
  const tradTaxRatePct  = num('tradTaxRate', 22);
  const capGainsRatePct = num('capGainsRate', 15);

  // Goals
  const desiredIncomeToday  = num('desiredIncome');
  const socialSecurityToday = num('socialSecurity');

  // Convert rates
  const nominalReturn  = nominalReturnPct  / 100;
  const inflation      = inflationPct      / 100;
  const goldNominal    = goldReturnPct     / 100;
  const silverNominal  = silverReturnPct   / 100;
  const tradTaxRate    = tradTaxRatePct    / 100;
  const capGainsRate   = capGainsRatePct   / 100;

  // ── Validate ───────────────────────────────────────────────
  if (isNaN(currentAge) || isNaN(retirementAge) || currentAge <= 0) {
    showError('Please enter valid values for current age and retirement age.');
    return;
  }
  if (retirementAge <= currentAge) {
    showError('Retirement age must be greater than current age.');
    return;
  }
  if (nominalReturn < 0 || inflation < 0) {
    showError('Return and inflation rates cannot be negative.');
    return;
  }

  hideError();

  const years = retirementAge - currentAge;

  // ── Real rates ─────────────────────────────────────────────
  const realReturn       = realAnnualRate(nominalReturn, inflation);
  const realGoldReturn   = realAnnualRate(goldNominal,   inflation);
  const realSilverReturn = realAnnualRate(silverNominal, inflation);

  // ── Accumulate each account to retirement ─────────────────
  const tradFV    = futureValueLumpSum(tradBal,    realReturn,       years)
                  + futureValueAnnuity(tradContrib, realReturn,       years);
  const rothFV    = futureValueLumpSum(rothBal,    realReturn,       years)
                  + futureValueAnnuity(rothContrib, realReturn,       years);
  const taxableFV = futureValueLumpSum(taxableBal, realReturn,       years)
                  + futureValueAnnuity(taxableContrib, realReturn,   years);
  const goldFV    = futureValueLumpSum(goldBal,    realGoldReturn,   years);
  const silverFV  = futureValueLumpSum(silverBal,  realSilverReturn, years);
  const totalFV   = tradFV + rothFV + taxableFV + goldFV + silverFV;

  // ── Tax blending ───────────────────────────────────────────
  // Roth fraction contributes 0% tax; trad & taxable/metals have their own rates
  const rothFraction      = totalFV > 0 ? rothFV / totalFV : 0;
  const tradFraction      = totalFV > 0 ? tradFV / totalFV : 0;
  const taxMetalFraction  = totalFV > 0 ? (taxableFV + goldFV + silverFV) / totalFV : 0;

  // Weighted blended tax rate on withdrawal
  const blendedTaxRate    = tradFraction * tradTaxRate + taxMetalFraction * capGainsRate;
  const afterTaxMultiplier = Math.max(0, 1 - blendedTaxRate);

  // ── Income in future (retirement-day) dollars ─────────────
  const inflationFactor   = Math.pow(1 + inflation, years);
  const desiredFuture     = desiredIncomeToday  * inflationFactor;
  const ssFuture          = socialSecurityToday * inflationFactor;

  // ── Military pension ───────────────────────────────────────
  const reserveEnabled = document.getElementById('reserveEnabled').checked;
  let pensionToday     = 0;
  let pensionStartAge  = retirementAge;

  if (reserveEnabled) {
    const activeDutyYears = num('activeDutyYears', 0);
    const activeDutyPts   = activeDutyYears * 365;
    const reservePts      = num('reservePoints', 0);
    const totalPoints     = activeDutyPts + reservePts;
    const grade           = document.getElementById('reserveGrade').value;
    const yos             = num('reserveYOS', 0);
    const useBRS          = document.getElementById('reserveSystem').value === 'brs';
    pensionStartAge       = num('reservePensionAge', 60);

    // Update computed display lines
    document.getElementById('activeDutyPointsDisplay').textContent =
      'Active duty points: ' + formatNumber(activeDutyPts);
    document.getElementById('totalPointsDisplay').textContent =
      'Total retirement points: ' + formatNumber(totalPoints);

    const basePay = lookupBasePayMonthly(grade, yos);
    pensionToday  = calcReservePension(totalPoints, basePay, useBRS);

    document.getElementById('reserveEstimate').textContent =
      'Estimated pension: ' + formatDollars(pensionToday) + '/mo (today\'s dollars)';
  }

  const pensionFuture    = pensionToday * inflationFactor;
  const pensionAtRetire  = (pensionStartAge <= retirementAge) ? pensionFuture : 0;

  // ── After-tax income from portfolio (25-yr horizon) ────────
  const retirementHorizon = 25;
  const grossMonthlyFromSavings = maxMonthlyWithdrawal(totalFV, realReturn, retirementHorizon);
  const afterTaxMonthly         = grossMonthlyFromSavings * afterTaxMultiplier;

  // Total monthly income at retirement day (all sources)
  const totalMonthlyIncome = afterTaxMonthly + ssFuture + pensionAtRetire;

  // ── Gross needed to produce desired net income from portfolio ─
  // Net income covered by SS + pension; remainder comes from portfolio gross up
  const grossNeededFuture = afterTaxMultiplier > 0
    ? desiredFuture / afterTaxMultiplier
    : desiredFuture;  // fallback if somehow 0 multiplier

  // ── How long savings last ──────────────────────────────────
  const savingsYears = simSavingsYears(
    totalFV, realReturn,
    grossNeededFuture, ssFuture, pensionFuture, pensionStartAge, retirementAge
  );

  // ── Update stat cards ──────────────────────────────────────
  document.getElementById('projectedSavings').textContent   = formatDollars(totalFV);
  document.getElementById('yearsToRetirement').textContent  = years + ' yrs';
  document.getElementById('affordableIncome').textContent   = formatDollars(afterTaxMonthly) + '/mo';
  document.getElementById('totalMonthlyIncome').textContent = formatDollars(totalMonthlyIncome) + '/mo';
  document.getElementById('totalIncomeLabel').textContent   =
    reserveEnabled ? ' (incl. SS + pension)' : ' (incl. SS)';

  // ── Portfolio breakdown bar ────────────────────────────────
  renderBreakdown({ trad: tradFV, roth: rothFV, taxable: taxableFV, gold: goldFV, silver: silverFV });

  // ── Goal indicator ─────────────────────────────────────────
  const goalIndicator = document.getElementById('goalIndicator');
  goalIndicator.classList.remove('hidden', 'on-track', 'shortfall');
  const goalTitle  = document.getElementById('goalTitle');
  const goalDetail = document.getElementById('goalDetail');
  const goalIcon   = document.getElementById('goalIcon');

  if (totalMonthlyIncome >= desiredFuture) {
    goalIndicator.classList.add('on-track');
    goalIcon.textContent  = '✔';
    goalTitle.textContent = 'Goal Met — You\'re On Track!';
    const surplus = totalMonthlyIncome - desiredFuture;
    goalDetail.textContent =
      'Your projected total income exceeds your goal by ' + formatDollars(surplus) +
      '/mo (in future dollars). Blended tax rate: ' + (blendedTaxRate * 100).toFixed(1) + '%.';
  } else {
    goalIndicator.classList.add('shortfall');
    goalIcon.textContent  = '⚠';
    goalTitle.textContent = 'Shortfall — Adjust Your Plan';
    const gap = desiredFuture - totalMonthlyIncome;
    goalDetail.textContent =
      'You\'re projected to fall short by ' + formatDollars(gap) +
      '/mo (future dollars). Blended tax rate: ' + (blendedTaxRate * 100).toFixed(1) + '%. Consider saving more or retiring later.';
  }

  // ── Savings duration ───────────────────────────────────────
  const savingsDurationEl = document.getElementById('savingsDuration');
  if (!isFinite(savingsYears)) {
    const fullyPassive = ssFuture + pensionFuture >= desiredFuture;
    savingsDurationEl.textContent = fullyPassive
      ? 'No withdrawals needed from portfolio'
      : 'Will never run out (portfolio grows faster than withdrawals)';
  } else {
    const yrs = Math.floor(savingsYears);
    const mos = Math.round((savingsYears - yrs) * 12);
    let label = '';
    if (yrs > 0) label += yrs + ' yr' + (yrs !== 1 ? 's' : '');
    if (yrs > 0 && mos > 0) label += ', ';
    if (mos > 0) label += mos + ' mo' + (mos !== 1 ? 's' : '');
    savingsDurationEl.textContent = label || '< 1 month';
  }

  // ── Chart ──────────────────────────────────────────────────
  const maxSimYears = isFinite(savingsYears) ? Math.min(Math.ceil(savingsYears) + 2, 60) : 40;

  const chartData = buildChartData({
    currentAge,
    retirementAge,
    tradBal,    tradContrib,
    rothBal,    rothContrib,
    taxableBal, taxableContrib,
    goldBal,    silverBal,
    realReturn,
    realGoldReturn,
    realSilverReturn,
    grossMonthlyFuture: grossNeededFuture,
    ssFuture,
    pensionFuture,
    pensionStartAge,
    maxSimYears,
  });

  renderChart(chartData);
}

// ── Wire up events ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Restore saved inputs before first calculation
  loadInputs();

  // Show/hide reserve section based on restored checkbox state
  const reserveCheckbox = document.getElementById('reserveEnabled');
  document.getElementById('reserveSection').classList.toggle('hidden', !reserveCheckbox.checked);

  // Run initial calculation
  calculate();

  // Wire all number inputs
  document.querySelectorAll('#inputs-card input[type="number"]').forEach(el => {
    el.addEventListener('input', () => { saveInputs(); calculate(); });
  });

  // Wire all selects
  document.querySelectorAll('#inputs-card select').forEach(el => {
    el.addEventListener('change', () => { saveInputs(); calculate(); });
  });

  // Wire reserve toggle
  reserveCheckbox.addEventListener('change', () => {
    document.getElementById('reserveSection').classList.toggle('hidden', !reserveCheckbox.checked);
    saveInputs();
    calculate();
  });
});
