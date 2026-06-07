// financials.js
// Single source of derived numbers. Every function here is pure: it reads from
// the shared `state` object (the same one inputs.js mutates) and returns plain
// numbers — no DOM, no side effects. Downstream sections (Dashboard, Tax,
// Retirement) should consume these instead of recomputing from raw inputs.

import { state } from "./state.js";

export function liquidTotal() {
  return state.inputs.accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
}

export function cashTotal() {
  return state.inputs.accounts
    .filter((a) => a.type === "Cash-Banking")
    .reduce((s, a) => s + Number(a.balance || 0), 0);
}

export function liquidInvestmentsTotal() {
  return liquidTotal() - cashTotal();
}

export function realEstateValue() {
  const re = state.inputs.realEstate;
  return Number(re.primary.value || 0) + Number(re.rental.value || 0) + Number(re.farm.value || 0);
}

export function realEstateEquity() {
  const re = state.inputs.realEstate;
  const primaryEquity = Number(re.primary.value || 0) - Number(re.primary.mortgageBalance || 0);
  const rentalEquity  = Number(re.rental.value || 0)  - Number(re.rental.mortgageBalance || 0);
  const farmCfd       = Number(re.farm.cfdBalanceA || 0) + Number(re.farm.cfdBalanceB || 0);
  const farmEquity    = Number(re.farm.value || 0) - farmCfd;
  return primaryEquity + rentalEquity + farmEquity;
}

export function alternativesTotal() {
  const a = state.inputs.alternatives;
  const gold   = Number(a.goldOunces || 0)   * Number(a.goldPrice || 0);
  const silver = Number(a.silverOunces || 0) * Number(a.silverPrice || 0);
  return Number(a.privateUnitsValue || 0) + Number(a.fundDeployed || 0) + gold + silver + Number(a.bitcoin || 0);
}

export function totalDebt() {
  return state.inputs.debt.reduce((s, d) => s + Number(d.balance || 0), 0);
}

export function totalMonthlyDebtService() {
  return state.inputs.debt.reduce((s, d) => s + Number(d.payment || 0), 0);
}

export function totalAnnualDebtService() {
  return totalMonthlyDebtService() * 12;
}

export function weightedAvgDebtRate() {
  let weighted = 0, balance = 0;
  for (const d of state.inputs.debt) {
    const b = Number(d.balance || 0);
    if (b > 0) { weighted += b * Number(d.rate || 0); balance += b; }
  }
  return balance > 0 ? weighted / balance : 0;
}

export function totalAssets() {
  return liquidTotal() + realEstateValue() + alternativesTotal();
}

export function totalLiabilities() {
  return totalDebt();
}

// Net worth uses real-estate equity (not full value) to avoid double-counting
// mortgage balances that are also listed in the Debt tab.
export function netWorth() {
  return liquidTotal() + realEstateEquity() + alternativesTotal();
}

const CONCENTRATION_THRESHOLD_PCT = 15;

export function concentrationTotal() {
  return state.inputs.concentration.reduce((s, h) => s + Number(h.value || 0), 0);
}

export function concentrationBreakdown() {
  const liquid = liquidTotal();
  return state.inputs.concentration.map((h) => {
    const value = Number(h.value || 0);
    const pctOfLiquid = liquid > 0 ? (value / liquid) * 100 : 0;
    return { id: h.id, holding: h.holding, value, pctOfLiquid, flagged: pctOfLiquid > CONCENTRATION_THRESHOLD_PCT };
  });
}

export function payoffYears(balance, rate, payment) {
  const b = Number(balance || 0), p = Number(payment || 0);
  if (b <= 0) return 0;
  if (p <= 0) return Infinity;
  const r = Number(rate || 0) / 100 / 12;
  if (r === 0) return b / p / 12;
  if (p <= r * b) return Infinity;
  return -Math.log(1 - (r * b) / p) / Math.log(1 + r) / 12;
}

export function debtPayoffEstimates() {
  return state.inputs.debt
    .filter((d) => Number(d.balance || 0) > 0)
    .map((d) => ({
      id: d.id, name: d.name,
      balance: Number(d.balance || 0),
      rate:    Number(d.rate    || 0),
      payment: Number(d.payment || 0),
      years:   payoffYears(d.balance, d.rate, d.payment),
    }));
}