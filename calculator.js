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
    monthlyWithdrawalFuture,      // in future (retirement-day) dollars
    socialSecurityFuture,          // in future dollars
    pensionMonthlyFuture = 0,      // reserve pension in future dollars (0 if disabled)
    pensionStartAge = Infinity,    // age when pension begins
    maxSimYears,                   // how many years post-retirement to simulate (cap at 60)
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
  // Start the decumulation series at the same balance as the last accumulation point
  decum[decum.length - 1] = balance; // overlap point at retirement age

  let retired = balance;
  for (let yr = 1; yr <= maxSimYears; yr++) {
    const age = retirementAge + yr;
    labels.push(String(age));
    accum.push(null);

    // Pension reduces portfolio draw once it starts
    const pension = (pensionMonthlyFuture > 0 && age >= pensionStartAge) ? pensionMonthlyFuture : 0;
    const netMonthlyWithdrawal = Math.max(0, monthlyWithdrawalFuture - socialSecurityFuture - pension);

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
 * Simulate how many years savings last, accounting for a pension that may start
 * at a different age than retirement. Runs month-by-month for up to 100 years.
 * Returns Infinity if the balance never reaches zero.
 */
function simSavingsYears(portfolioValue, annualRealRate,
                          desiredFuture, ssFuture, pensionFuture, pensionStartAge,
                          retirementAge) {
  if (portfolioValue <= 0) return 0;
  const realMonthly = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  let balance = portfolioValue;

  for (let yr = 0; yr < 100; yr++) {
    const age = retirementAge + yr;
    const pension = (pensionFuture > 0 && age >= pensionStartAge) ? pensionFuture : 0;
    const netWithdrawal = Math.max(0, desiredFuture - ssFuture - pension);

    if (netWithdrawal <= 0) return Infinity;

    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + realMonthly) - netWithdrawal;
      if (balance <= 0) return yr + m / 12;
    }
  }
  return Infinity;
}

// ── Navy Reserve Officer Pay Table (approximate 2025 monthly base pay, USD) ──
// Each entry: [minYearsOfService, monthlyBasePay]
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

// Reserve retirement formula: (points / 360) × system_rate × base_pay
function calcReservePension(totalPoints, basePayMonthly, useBRS) {
  return (totalPoints / 360) * (useBRS ? 0.02 : 0.025) * basePayMonthly;
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
  const desiredIncomeFuture  = desiredIncomeToday  * Math.pow(1 + inflation, yearsToRetirement);
  const socialSecurityFuture = socialSecurityToday * Math.pow(1 + inflation, yearsToRetirement);

  // ── Reserve pension ─────────────────────────────────────────
  const reserveEnabled = document.getElementById('reserveEnabled').checked;
  let pensionMonthlyToday = 0;
  let pensionStartAge = retirementAge;

  if (reserveEnabled) {
    const grade   = document.getElementById('reserveGrade').value;
    const yos     = parseFloat(document.getElementById('reserveYOS').value) || 0;
    const points  = parseFloat(document.getElementById('reservePoints').value) || 0;
    const useBRS  = document.getElementById('reserveSystem').value === 'brs';
    pensionStartAge = parseFloat(document.getElementById('reservePensionAge').value) || 60;

    const basePayMonthly = lookupBasePayMonthly(grade, yos);
    pensionMonthlyToday  = calcReservePension(points, basePayMonthly, useBRS);

    document.getElementById('reserveEstimate').textContent =
      'Estimated pension: ' + formatDollars(pensionMonthlyToday) + '/mo (today\'s dollars)';
  }

  // Pension converted to retirement-day dollars
  const pensionFuture = pensionMonthlyToday * Math.pow(1 + inflation, yearsToRetirement);

  // Pension active on day-1 of retirement only if it starts at or before retirement age
  const pensionAtRetire = (pensionStartAge <= retirementAge) ? pensionFuture : 0;

  // ── Affordable income from savings + all day-1 income sources ──
  const retirementHorizon = 25;
  const affordableFromSavings = maxMonthlyWithdrawal(totalAtRetire, realReturn, retirementHorizon);
  const totalMonthlyIncome    = affordableFromSavings + socialSecurityFuture + pensionAtRetire;

  // How long savings last — simulation accounts for pension-start-age gap
  const savingsYears = simSavingsYears(
    totalAtRetire, realReturn,
    desiredIncomeFuture, socialSecurityFuture, pensionFuture, pensionStartAge, retirementAge
  );

  // Net withdrawal at day-1 of retirement (used for "no withdrawals needed" check)
  const netWithdrawalAtRetire = Math.max(0, desiredIncomeFuture - socialSecurityFuture - pensionAtRetire);

  // ── Update stat cards ───────────────────────────────────────
  document.getElementById('projectedSavings').textContent   = formatDollars(totalAtRetire);
  document.getElementById('yearsToRetirement').textContent  = yearsToRetirement + ' yrs';
  document.getElementById('affordableIncome').textContent   = formatDollars(affordableFromSavings) + '/mo';
  document.getElementById('totalMonthlyIncome').textContent = formatDollars(totalMonthlyIncome) + '/mo';
  document.getElementById('totalIncomeLabel').textContent   =
    reserveEnabled ? ' (incl. SS + pension)' : ' (incl. Social Security)';

  // ── Goal indicator ──────────────────────────────────────────
  goalIndicator.classList.remove('hidden', 'on-track', 'shortfall');
  const goalTitle  = document.getElementById('goalTitle');
  const goalDetail = document.getElementById('goalDetail');
  const goalIcon   = document.getElementById('goalIcon');

  if (totalMonthlyIncome >= desiredIncomeFuture) {
    goalIndicator.classList.add('on-track');
    goalIcon.textContent  = '✔';
    goalTitle.textContent = 'Goal Met — You\'re On Track!';
    const surplus = totalMonthlyIncome - desiredIncomeFuture;
    goalDetail.textContent =
      'Your projected total income exceeds your goal by ' + formatDollars(surplus) +
      '/mo (in future dollars).';
  } else {
    goalIndicator.classList.add('shortfall');
    goalIcon.textContent  = '⚠';
    goalTitle.textContent = 'Shortfall — Adjust Your Plan';
    const gap = desiredIncomeFuture - totalMonthlyIncome;
    goalDetail.textContent =
      'You\'re projected to fall short by ' + formatDollars(gap) +
      '/mo (in future dollars). Consider saving more or retiring later.';
  }

  // ── Savings duration ────────────────────────────────────────
  const savingsDurationEl = document.getElementById('savingsDuration');
  if (!isFinite(savingsYears)) {
    const covered = socialSecurityFuture + pensionFuture >= desiredIncomeFuture;
    savingsDurationEl.textContent = covered
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
    pensionMonthlyFuture: pensionFuture,
    pensionStartAge,
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
  document.querySelectorAll('input[type="number"]').forEach(el => el.addEventListener('input', calculate));
  document.querySelectorAll('select').forEach(el => el.addEventListener('change', calculate));

  const reserveCheckbox = document.getElementById('reserveEnabled');
  reserveCheckbox.addEventListener('change', () => {
    document.getElementById('reserveSection').classList.toggle('hidden', !reserveCheckbox.checked);
    calculate();
  });

  calculate();
});
