'use strict';

function formatDollars(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function realAnnualRate(nominal, inflation) {
  return (1 + nominal) / (1 + inflation) - 1;
}

function futureValueLumpSum(pv, annualRate, years) {
  return pv * Math.pow(1 + annualRate, years);
}

function futureValueAnnuity(monthlyPayment, annualRate, years) {
  const months = years * 12;
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  if (Math.abs(r) < 1e-10) return monthlyPayment * months;
  return monthlyPayment * (Math.pow(1 + r, months) - 1) / r;
}

function maxMonthlyWithdrawal(portfolioValue, annualRealRate, retirementYears) {
  const months = retirementYears * 12;
  const r = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  if (Math.abs(r) < 1e-10) return portfolioValue / months;
  return portfolioValue * r / (1 - Math.pow(1 + r, -months));
}

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

function calcReservePension(totalPoints, basePayMonthly, useBRS) {
  return (totalPoints / 360) * (useBRS ? 0.02 : 0.025) * basePayMonthly;
}

function simSavingsYears(portfolioValue, annualRealRate, grossNeededFuture, ssFuture, pensionFuture, pensionStartAge, retirementAge) {
  if (portfolioValue <= 0) return 0;
  const r = Math.pow(1 + annualRealRate, 1 / 12) - 1;
  let balance = portfolioValue;
  for (let yr = 0; yr < 100; yr++) {
    const age = retirementAge + yr;
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

let chartInstance = null;

function buildChartData(inputs) {
  const { currentAge, retirementAge, tradBal, tradContrib, rothBal, rothContrib, taxableBal, taxableContrib, goldBal, silverBal, realReturn, realGoldReturn, realSilverReturn, grossMonthlyFuture, ssFuture, pensionFuture, pensionStartAge, maxSimYears } = inputs;
  const realMonthly = Math.pow(1 + realReturn, 1 / 12) - 1;
  const realGoldMonthly = Math.pow(1 + realGoldReturn, 1 / 12) - 1;
  const realSilverMonthly = Math.pow(1 + realSilverReturn, 1 / 12) - 1;
  const labels = [], accum = [], decum = [];
  let trad = tradBal, roth = rothBal, taxable = taxableBal, gold = goldBal, silver = silverBal;
  const yearsToRetirement = retirementAge - currentAge;
  for (let yr = 0; yr <= yearsToRetirement; yr++) {
    labels.push(String(currentAge + yr));
    if (yr === 0) {
      accum.push(trad + roth + taxable + gold + silver);
      decum.push(null);
    } else {
      for (let m = 0; m < 12; m++) {
        trad = trad * (1 + realMonthly) + tradContrib;
        roth = roth * (1 + realMonthly) + rothContrib;
        taxable = taxable * (1 + realMonthly) + taxableContrib;
        gold = gold * (1 + realGoldMonthly);
        silver = silver * (1 + realSilverMonthly);
      }
      accum.push(trad + roth + taxable + gold + silver);
      decum.push(null);
    }
  }
  let retiredBal = trad + roth + taxable + gold + silver;
  decum[decum.length - 1] = retiredBal;
  for (let yr = 1; yr <= maxSimYears; yr++) {
    const age = retirementAge + yr;
    labels.push(String(age));
    accum.push(null);
    const pension = (pensionFuture > 0 && age >= pensionStartAge) ? pensionFuture : 0;
    const netPortfolioNeeded = Math.max(0, grossMonthlyFuture - ssFuture - pension);
    for (let m = 0; m < 12; m++) {
      retiredBal = retiredBal * (1 + realMonthly) - netPortfolioNeeded;
    }
    decum.push(Math.max(0, retiredBal));
    if (retiredBal <= 0) { retiredBal = 0; break; }
  }
  return { labels, accum, decum };
}

function renderChart(chartData) {
  const ctx = document.getElementById('savingsChart').getContext('2d');
  const base = { pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5, tension: 0.35, fill: false };
  const datasets = [
    { ...base, label: 'Accumulation', data: chartData.accum, borderColor: '#2ecc71', pointHoverBackgroundColor: '#2ecc71', spanGaps: false },
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
            label(ctx) { const v = ctx.parsed.y; if (v === null) return null; return ctx.dataset.label + ': ' + formatDollars(v); },
            title(items) { return 'Age ' + items[0].label; },
          },
          filter(item) { return item.parsed.y !== null; },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, maxTicksLimit: 12, callback(value, index) { const label = this.getLabelForValue(index); return parseInt(label, 10) % 5 === 0 ? label : ''; } } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback(value) { if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M'; if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K'; return '$' + value; } }, beginAtZero: true },
      },
    },
  });
}

const BUCKET_META = [
  { key: 'trad',    label: 'Trad 401k', color: '#3498db' },
  { key: 'roth',    label: 'Roth',      color: '#2ecc71' },
  { key: 'taxable', label: 'Taxable',   color: '#9b59b6' },
  { key: 'gold',    label: 'Gold',      color: '#f39c12' },
  { key: 'silver',  label: 'Silver',    color: '#95a5a6' },
];

function renderBreakdown(buckets) {
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  const barEl = document.getElementById('breakdownBar');
  const legendEl = document.getElementById('breakdownLegend');
  barEl.innerHTML = '';
  legendEl.innerHTML = '';
  if (total <= 0) return;
  BUCKET_META.forEach(({ key, label, color }) => {
    const val = buckets[key] || 0;
    if (val <= 0) return;
    const pct = (val / total) * 100;
    const seg = document.createElement('div');
    seg.className = 'breakdown-segment';
    seg.style.flex = String(pct);
    seg.style.background = color;
    seg.title = label + ': ' + formatDollars(val) + ' (' + pct.toFixed(1) + '%)';
    barEl.appendChild(seg);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${label} ${formatDollars(val)}</span>`;
    legendEl.appendChild(item);
  });
}

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
      if (el.type === 'checkbox') { el.checked = val; } else { el.value = val; }
    });
  } catch(e) {}
}

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorMessage').textContent = msg;
  banner.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorBanner').classList.add('hidden');
}

function num(id, fallback) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? (fallback !== undefined ? fallback : 0) : v;
}

function calculate() {
  const currentAge = num('currentAge');
  const retirementAge = num('retirementAge');
  const tradBal = num('tradBalance'), tradContrib = num('tradContrib');
  const rothBal = num('rothBalance'), rothContrib = num('rothContrib');
  const taxableBal = num('taxableBalance'), taxableContrib = num('taxableContrib');
  const goldBal = num('goldBalance'), goldReturnPct = num('goldReturn', 7);
  const silverBal = num('silverBalance'), silverReturnPct = num('silverReturn', 5);
  const nominalReturnPct = num('annualReturn', 7), inflationPct = num('inflationRate', 3);
  const tradTaxRatePct = num('tradTaxRate', 22), capGainsRatePct = num('capGainsRate', 15);
  const desiredIncomeToday = num('desiredIncome'), socialSecurityToday = num('socialSecurity');

  const nominalReturn = nominalReturnPct / 100, inflation = inflationPct / 100;
  const goldNominal = goldReturnPct / 100, silverNominal = silverReturnPct / 100;
  const tradTaxRate = tradTaxRatePct / 100, capGainsRate = capGainsRatePct / 100;

  if (isNaN(currentAge) || isNaN(retirementAge) || currentAge <= 0) { showError('Please enter valid values for current age and retirement age.'); return; }
  if (retirementAge <= currentAge) { showError('Retirement age must be greater than current age.'); return; }
  if (nominalReturn < 0 || inflation < 0) { showError('Return and inflation rates cannot be negative.'); return; }
  hideError();

  const years = retirementAge - currentAge;
  const realReturn = realAnnualRate(nominalReturn, inflation);
  const realGoldReturn = realAnnualRate(goldNominal, inflation);
  const realSilverReturn = realAnnualRate(silverNominal, inflation);

  const tradFV = futureValueLumpSum(tradBal, realReturn, years) + futureValueAnnuity(tradContrib, realReturn, years);
  const rothFV = futureValueLumpSum(rothBal, realReturn, years) + futureValueAnnuity(rothContrib, realReturn, years);
  const taxableFV = futureValueLumpSum(taxableBal, realReturn, years) + futureValueAnnuity(taxableContrib, realReturn, years);
  const goldFV = futureValueLumpSum(goldBal, realGoldReturn, years);
  const silverFV = futureValueLumpSum(silverBal, realSilverReturn, years);
  const totalFV = tradFV + rothFV + taxableFV + goldFV + silverFV;

  const rothFraction = totalFV > 0 ? rothFV / totalFV : 0;
  const tradFraction = totalFV > 0 ? tradFV / totalFV : 0;
  const taxMetalFraction = totalFV > 0 ? (taxableFV + goldFV + silverFV) / totalFV : 0;
  const blendedTaxRate = tradFraction * tradTaxRate + taxMetalFraction * capGainsRate;
  const afterTaxMultiplier = Math.max(0, 1 - blendedTaxRate);

  const inflationFactor = Math.pow(1 + inflation, years);
  const desiredFuture = desiredIncomeToday * inflationFactor;
  const ssFuture = socialSecurityToday * inflationFactor;

  const reserveEnabled = document.getElementById('reserveEnabled').checked;
  let pensionToday = 0, pensionStartAge = retirementAge;
  if (reserveEnabled) {
    const activeDutyYears = num('activeDutyYears', 0);
    const activeDutyPts = activeDutyYears * 365;
    const reservePts = num('reservePoints', 0);
    const totalPoints = activeDutyPts + reservePts;
    const grade = document.getElementById('reserveGrade').value;
    const yos = num('reserveYOS', 0);
    const useBRS = document.getElementById('reserveSystem').value === 'brs';
    pensionStartAge = num('reservePensionAge', 60);
    document.getElementById('activeDutyPointsDisplay').textContent = 'Active duty points: ' + formatNumber(activeDutyPts);
    document.getElementById('totalPointsDisplay').textContent = 'Total retirement points: ' + formatNumber(totalPoints);
    const basePay = lookupBasePayMonthly(grade, yos);
    pensionToday = calcReservePension(totalPoints, basePay, useBRS);
    document.getElementById('reserveEstimate').textContent = 'Estimated pension: ' + formatDollars(pensionToday) + '/mo (today\'s dollars)';
  }

  const pensionFuture = pensionToday * inflationFactor;
  const pensionAtRetire = (pensionStartAge <= retirementAge) ? pensionFuture : 0;

  const grossMonthlyFromSavings = maxMonthlyWithdrawal(totalFV, realReturn, 25);
  const afterTaxMonthly = grossMonthlyFromSavings * afterTaxMultiplier;
  const totalMonthlyIncome = afterTaxMonthly + ssFuture + pensionAtRetire;

  const grossNeededFuture = afterTaxMultiplier > 0 ? desiredFuture / afterTaxMultiplier : desiredFuture;

  const savingsYears = simSavingsYears(totalFV, realReturn, grossNeededFuture, ssFuture, pensionFuture, pensionStartAge, retirementAge);

  document.getElementById('projectedSavings').textContent = formatDollars(totalFV);
  document.getElementById('yearsToRetirement').textContent = years + ' yrs';
  document.getElementById('affordableIncome').textContent = formatDollars(afterTaxMonthly) + '/mo';
  document.getElementById('totalMonthlyIncome').textContent = formatDollars(totalMonthlyIncome) + '/mo';
  document.getElementById('totalIncomeLabel').textContent = reserveEnabled ? ' (incl. SS + pension)' : ' (incl. SS)';

  renderBreakdown({ trad: tradFV, roth: rothFV, taxable: taxableFV, gold: goldFV, silver: silverFV });

  const goalIndicator = document.getElementById('goalIndicator');
  goalIndicator.classList.remove('hidden', 'on-track', 'shortfall');
  const goalTitle = document.getElementById('goalTitle');
  const goalDetail = document.getElementById('goalDetail');
  const goalIcon = document.getElementById('goalIcon');

  if (totalMonthlyIncome >= desiredFuture) {
    goalIndicator.classList.add('on-track');
    goalIcon.textContent = '✔';
    goalTitle.textContent = 'Goal Met — You\'re On Track!';
    const surplus = totalMonthlyIncome - desiredFuture;
    goalDetail.textContent = 'Your projected total income exceeds your goal by ' + formatDollars(surplus) + '/mo (future dollars). Blended tax rate: ' + (blendedTaxRate * 100).toFixed(1) + '%.';
  } else {
    goalIndicator.classList.add('shortfall');
    goalIcon.textContent = '⚠';
    goalTitle.textContent = 'Shortfall — Adjust Your Plan';
    const gap = desiredFuture - totalMonthlyIncome;
    goalDetail.textContent = 'You\'re projected to fall short by ' + formatDollars(gap) + '/mo (future dollars). Blended tax rate: ' + (blendedTaxRate * 100).toFixed(1) + '%. Consider saving more or retiring later.';
  }

  const savingsDurationEl = document.getElementById('savingsDuration');
  if (!isFinite(savingsYears)) {
    savingsDurationEl.textContent = (ssFuture + pensionFuture >= desiredFuture) ? 'No withdrawals needed from portfolio' : 'Will never run out (portfolio grows faster than withdrawals)';
  } else {
    const yrs = Math.floor(savingsYears);
    const mos = Math.round((savingsYears - yrs) * 12);
    let label = '';
    if (yrs > 0) label += yrs + ' yr' + (yrs !== 1 ? 's' : '');
    if (yrs > 0 && mos > 0) label += ', ';
    if (mos > 0) label += mos + ' mo' + (mos !== 1 ? 's' : '');
    savingsDurationEl.textContent = label || '< 1 month';
  }

  const maxSimYears = isFinite(savingsYears) ? Math.min(Math.ceil(savingsYears) + 2, 60) : 40;
  const chartData = buildChartData({ currentAge, retirementAge, tradBal, tradContrib, rothBal, rothContrib, taxableBal, taxableContrib, goldBal, silverBal, realReturn, realGoldReturn, realSilverReturn, grossMonthlyFuture: grossNeededFuture, ssFuture, pensionFuture, pensionStartAge, maxSimYears });
  renderChart(chartData);
}

document.addEventListener('DOMContentLoaded', () => {
  loadInputs();
  const reserveCheckbox = document.getElementById('reserveEnabled');
  document.getElementById('reserveSection').classList.toggle('hidden', !reserveCheckbox.checked);
  calculate();
  document.querySelectorAll('#inputs-card input[type="number"]').forEach(el => {
    el.addEventListener('input', () => { saveInputs(); calculate(); });
  });
  document.querySelectorAll('#inputs-card select').forEach(el => {
    el.addEventListener('change', () => { saveInputs(); calculate(); });
  });
  reserveCheckbox.addEventListener('change', () => {
    document.getElementById('reserveSection').classList.toggle('hidden', !reserveCheckbox.checked);
    saveInputs();
    calculate();
  });
});