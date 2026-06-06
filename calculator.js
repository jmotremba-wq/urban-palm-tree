/* ============================================================
   Retirement Calculator — calculator.js
   All calculations and DOM updates live here.
   ============================================================ */

'use strict';

// ── Helpers ──────────────────────────────────────────────────

/**
 * Format a number as a USD dollar string, rounded to the nearest dollar.
 * e.g. 1234567.89 → "$1,234,568"
 */
function formatDollars(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

/**
 * Return the real annual return given nominal annual return and inflation rate.
 * Fisher equation: realRate = (1 + nominal) / (1 + inflation) - 1
 */
function realAnnualRate(nominalRate, inflationRate) {
  return (1 + nominalRate) / (1 + inflationRate) - 1;
}

/**
 * Future value of a lump sum.
 * FV = PV * (1 + r)^n
 */
function futureValueLumpSum(pv, annualRate, years) {
  return pv * Math.pow(1 + annualRate, years);
}

/**
 * Future value of a monthly annuity (end-of-period payments) using the
 * real monthly rate so that contributions are also inflation-adjusted.
 * FV = PMT * [(1 + r_monthly)^(n_months) - 1] / r_monthly
 * When r_monthly === 0 the formula degenerates to PMT * n_months.
 */
function futureValueAnnuity(monthlyPayment, annualRate, years) {
  const months = years * 12;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  if (Math.abs(monthlyRate) < 1e-10) {
    return monthlyPayment * months;
  }
  return monthlyPayment * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
}

/**
 * Compute the maximum monthly withdrawal that exhausts a portfolio over a
 * finite number of months, given a monthly investment return.
 * This is the standard present-value-of-annuity rearranged for the payment:
 *   PMT = PV * r / (1 - (1+r)^-n)
 * If the real return is 0, PMT = PV / n.
 */
function maxMonthlyWithdrawal(portfolioValue, annualRealRate, retirementYears) {
  const months = retirementYears * 12;
  const monthlyRate = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  if (Math.abs(monthlyRate) < 1e-10) {
    return portfolioValue / months;
  }
  return portfolioValue * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

/**
 * Build year-by-year balance data for both the accumulation and
 * decumulation phases.
 *
 * Returns an object:
 * {
 *   labels: string[],         // ages, one per year
 *   accum: (number|null)[],   // balances during accumulation (null in retirement)
 *   decum: (number|null)[],   // balances during decumulation (null before retirement)
 * }
 */
function buildChartData(inputs) {
  const {
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    nominalAnnualRate,
    inflationRate,
    monthlyWithdrawalFuture, // in future (retirement-day) dollars
    socialSecurityFuture,    // in future dollars
    maxSimYears,             // how many years post-retirement to simulate (cap at 60)
  } = inputs;

  const realAnnual = realAnnualRate(nominalAnnualRate, inflationRate);
  const realMonthly = Math.pow(1 + realAnnual, 1 / 12) - 1;

  const labels = [];
  const accum = [];
  const decum = [];

  // ── Accumulation phase (current age → retirement age) ──────
  let balance = currentSavings;
  const yearsToRetirement = retirementAge - currentAge;

  for (let yr = 0; yr <= yearsToRetirement; yr++) {
    const age = currentAge + yr;
    labels.push(String(age));

    if (yr === 0) {
      accum.push(balance);
      decum.push(null);
    } else {
      // Grow existing balance for 12 months and add contributions
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + realMonthly) + monthlyContribution;
      }
      accum.push(balance);
      decum.push(null);
    }
  }

  // ── Decumulation phase (retirement age → depletion or cap) ──
  // Net monthly withdrawal needed from portfolio = total desired - social security
  const netMonthlyWithdrawal = Math.max(0, monthlyWithdrawalFuture - socialSecurityFuture);

  // Start the decumulation series at the same balance as the last accumulation point
  decum[decum.length - 1] = balance; // overlap point at retirement age

  let retired = balance;
  for (let yr = 1; yr <= maxSimYears; yr++) {
    const age = retirementAge + yr;
    labels.push(String(age));
    accum.push(null);

    for (let m = 0; m < 12; m++) {
      retired = retired * (1 + realMonthly) - netMonthlyWithdrawal;
    }

    const floored = Math.max(0, retired);
    decum.push(floored);

    if (retired <= 0) {
      retired = 0;
      break;
    }
  }

  return { labels, accum, decum };
}

/**
 * How many years do savings last given a real monthly rate and net withdrawal?
 * Returns Infinity when real return >= withdrawal rate (balance never drops).
 * Returns 0 when balance is already 0 or withdrawal is 0 with no balance.
 */
function yearsSavingsLast(portfolioValue, realAnnualRate, netMonthlyWithdrawal) {
  if (portfolioValue <= 0) return 0;
  if (netMonthlyWithdrawal <= 0) return Infinity;

  const realMonthly = Math.pow(1 + realAnnualRate, 1 / 12) - 1;

  // If monthly return * balance >= withdrawal, the portfolio grows forever
  if (realMonthly > 0 && portfolioValue * realMonthly >= netMonthlyWithdrawal) {
    return Infinity;
  }

  if (Math.abs(realMonthly) < 1e-10) {
    // Zero real return: simple division
    return portfolioValue / netMonthlyWithdrawal / 12;
  }

  // Present value of annuity formula rearranged for n:
  // n = -ln(1 - PV * r / PMT) / ln(1 + r)  [in months]
  const ratio = portfolioValue * realMonthly / netMonthlyWithdrawal;
  if (ratio >= 1) return Infinity; // edge case guard
  return -Math.log(1 - ratio) / Math.log(1 + realMonthly) / 12;
}

// ── Chart instance ────────────────────────────────────────────

let chartInstance = null;

function renderChart(chartData) {
  const ctx = document.getElementById('savingsChart').getContext('2d');

  const baseDatasetOptions = {
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2.5,
    tension: 0.35,
    fill: false,
  };

  const datasets = [
    {
      ...baseDatasetOptions,
      label: 'Accumulation',
      data: chartData.accum,
      borderColor: '#2ecc71',
      pointHoverBackgroundColor: '#2ecc71',
      spanGaps: false,
    },
    {
      ...baseDatasetOptions,
      label: 'Retirement drawdown',
      data: chartData.decum,
      borderColor: '#e67e22',
      pointHoverBackgroundColor: '#e67e22',
      spanGaps: false,
    },
  ];

  if (chartInstance) {
    chartInstance.data.labels = chartData.labels;
    chartInstance.data.datasets[0].data = datasets[0].data;
    chartInstance.data.datasets[1].data = datasets[1].data;
    chartInstance.update('none'); // skip animation on updates for responsiveness
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: chartData.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const val = context.parsed.y;
              if (val === null) return null;
              return context.dataset.label + ': ' + formatDollars(val);
            },
            title(items) {
              return 'Age ' + items[0].label;
            },
          },
          filter(item) {
            return item.parsed.y !== null;
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            maxTicksLimit: 12,
            callback(value, index) {
              // Show label at every 5-year mark and at the first/last labels
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
              if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
              return '$' + value;
            },
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ── Main calculation ──────────────────────────────────────────

function calculate() {
  // Read inputs
  const currentAge          = parseFloat(document.getElementById('currentAge').value);
  const retirementAge       = parseFloat(document.getElementById('retirementAge').value);
  const currentSavings      = parseFloat(document.getElementById('currentSavings').value) || 0;
  const monthlyContribution = parseFloat(document.getElementById('monthlyContribution').value) || 0;
  const nominalReturn       = parseFloat(document.getElementById('annualReturn').value) / 100;
  const inflation           = parseFloat(document.getElementById('inflationRate').value) / 100;
  const desiredIncomeToday  = parseFloat(document.getElementById('desiredIncome').value) || 0;
  const socialSecurityToday = parseFloat(document.getElementById('socialSecurity').value) || 0;

  // DOM references
  const errorBanner     = document.getElementById('errorBanner');
  const errorMessage    = document.getElementById('errorMessage');
  const goalIndicator   = document.getElementById('goalIndicator');

  // ── Validate ────────────────────────────────────────────────
  if (isNaN(currentAge) || isNaN(retirementAge)) {
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

  // ── Core numbers ────────────────────────────────────────────
  const yearsToRetirement = retirementAge - currentAge;

  // Real annual return (Fisher equation)
  const realReturn = realAnnualRate(nominalReturn, inflation);

  // Projected portfolio at retirement
  const fvLumpSum     = futureValueLumpSum(currentSavings, realReturn, yearsToRetirement);
  const fvContribs    = futureValueAnnuity(monthlyContribution, realReturn, yearsToRetirement);
  const totalAtRetire = fvLumpSum + fvContribs;

  // Desired income expressed in retirement-day dollars
  const desiredIncomeFuture   = desiredIncomeToday  * Math.pow(1 + inflation, yearsToRetirement);
  const socialSecurityFuture  = socialSecurityToday * Math.pow(1 + inflation, yearsToRetirement);

  // Assume a 25-year retirement horizon for the "affordable income" figure
  const retirementHorizon = 25;
  const affordableFromSavings = maxMonthlyWithdrawal(totalAtRetire, realReturn, retirementHorizon);
  const totalMonthlyIncome    = affordableFromSavings + socialSecurityFuture;

  // Net withdrawal from portfolio (total desired minus social security)
  const netWithdrawal = Math.max(0, desiredIncomeFuture - socialSecurityFuture);

  // How long savings last given net withdrawal
  const savingsYears = yearsSavingsLast(totalAtRetire, realReturn, netWithdrawal);

  // ── Update stat cards ───────────────────────────────────────
  document.getElementById('projectedSavings').textContent  = formatDollars(totalAtRetire);
  document.getElementById('yearsToRetirement').textContent = yearsToRetirement + ' yrs';
  document.getElementById('affordableIncome').textContent  = formatDollars(affordableFromSavings) + '/mo';
  document.getElementById('totalMonthlyIncome').textContent = formatDollars(totalMonthlyIncome) + '/mo';

  // ── Goal indicator ──────────────────────────────────────────
  goalIndicator.classList.remove('hidden', 'on-track', 'shortfall');
  const goalTitle  = document.getElementById('goalTitle');
  const goalDetail = document.getElementById('goalDetail');
  const goalIcon   = document.getElementById('goalIcon');

  if (totalMonthlyIncome >= desiredIncomeFuture) {
    goalIndicator.classList.add('on-track');
    goalIcon.textContent  = '✔'; // checkmark
    goalTitle.textContent = 'Goal Met — You\'re On Track!';
    const surplus = totalMonthlyIncome - desiredIncomeFuture;
    goalDetail.textContent =
      'Your projected total income exceeds your goal by ' + formatDollars(surplus) +
      '/mo (in future dollars).';
  } else {
    goalIndicator.classList.add('shortfall');
    goalIcon.textContent  = '⚠'; // warning
    goalTitle.textContent = 'Shortfall — Adjust Your Plan';
    const gap = desiredIncomeFuture - totalMonthlyIncome;
    goalDetail.textContent =
      'You\'re projected to fall short by ' + formatDollars(gap) +
      '/mo (in future dollars). Consider saving more or retiring later.';
  }

  // ── Savings duration ────────────────────────────────────────
  const savingsDurationEl = document.getElementById('savingsDuration');
  if (netWithdrawal <= 0) {
    savingsDurationEl.textContent = 'No withdrawals needed';
  } else if (!isFinite(savingsYears)) {
    savingsDurationEl.textContent = 'Will never run out (portfolio grows faster than withdrawals)';
  } else {
    const yrs = Math.floor(savingsYears);
    const mos = Math.round((savingsYears - yrs) * 12);
    let label = '';
    if (yrs > 0) label += yrs + ' yr' + (yrs !== 1 ? 's' : '');
    if (yrs > 0 && mos > 0) label += ', ';
    if (mos > 0) label += mos + ' mo' + (mos !== 1 ? 's' : '');
    savingsDurationEl.textContent = label || '< 1 month';
  }

  // ── Chart ───────────────────────────────────────────────────
  const maxSimYears = isFinite(savingsYears) ? Math.min(Math.ceil(savingsYears) + 2, 60) : 40;

  const chartData = buildChartData({
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    nominalAnnualRate: nominalReturn,
    inflationRate: inflation,
    monthlyWithdrawalFuture: desiredIncomeFuture,
    socialSecurityFuture,
    maxSimYears,
  });

  renderChart(chartData);
}

// ── Error display helpers ─────────────────────────────────────

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorMessage').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorBanner').classList.add('hidden');
}

// ── Wire up events ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(input => input.addEventListener('input', calculate));

  // Run once on load with the default values
  calculate();
});
