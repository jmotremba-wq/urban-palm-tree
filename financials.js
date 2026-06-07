// financials.js
// Single source of derived numbers. Every function here is pure: it reads from
// the shared `state` object (the same one inputs.js mutates) and returns plain
// numbers — no DOM, no side effects. Downstream sections (Dashboard, Tax,
// Retirement) should consume these instead of recomputing from raw inputs.

import { state } from "./state.js";

/* ------------------------------------------------------------------ *
 * Liquid accounts
 * ------------------------------------------------------------------ */

// Sum of every liquid investment account balance.
export function liquidTotal() {
  return state.inputs.accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
}

// Sum of just the Cash / Banking accounts (a subset of liquidTotal).
// The Inputs account-type for cash is the literal string "Cash-Banking".
export function cashTotal() {
  return state.inputs.accounts
    .filter((a) => a.type === "Cash-Banking")
    .reduce((s, a) => s + Number(a.balance || 0), 0);
}

// Non-cash liquid (brokerage, retirement, HSA, etc.) — liquid minus cash.
export function liquidInvestmentsTotal() {
  return liquidTotal() - cashTotal();
}

/* ------------------------------------------------------------------ *
 * Real estate (same equity formulas the Real Estate inputs tab shows)
 * ------------------------------------------------------------------ */

// Sum of current values across primary + rental + farm.
export function realEstateValue() {
  const re = state.inputs.realEstate;
  return (
    Number(re.primary.value || 0) +
    Number(re.rental.value || 0) +
    Number(re.farm.value || 0)
  );
}

// Sum of equity (value − loan balances) across all three properties.
// Primary/rental: value − mortgageBalance. Farm: value − (CFD A + CFD B).
export function realEstateEquity() {
  const re = state.inputs.realEstate;
  const primaryEquity = Number(re.primary.value || 0) - Number(re.primary.mortgageBalance || 0);
  const rentalEquity = Number(re.rental.value || 0) - Number(re.rental.mortgageBalance || 0);
  const farmCfd = Number(re.farm.cfdBalanceA || 0) + Number(re.farm.cfdBalanceB || 0);
  const farmEquity = Number(re.farm.value || 0) - farmCfd;
  return primaryEquity + rentalEquity + farmEquity;
}

/* ------------------------------------------------------------------ *
 * Alternative & illiquid assets
 * ------------------------------------------------------------------ */

// Private units placeholder value + private fund deployed + gold (oz×price) +
// silver (oz×price) + bitcoin. Reward points are intentionally excluded from
// dollar net worth (they are not a cash-equivalent asset).
export function alternativesTotal() {
  const a = state.inputs.alternatives;
  const gold = Number(a.goldOunces || 0) * Number(a.goldPrice || 0);
  const silver = Number(a.silverOunces || 0) * Number(a.silverPrice || 0);
  return (
    Number(a.privateUnitsValue || 0) +
    Number(a.fundDeployed || 0) +
    gold +
    silver +
    Number(a.bitcoin || 0)
  );
}

/* ------------------------------------------------------------------ *
 * Debt
 * ------------------------------------------------------------------ */

// Sum of all debt balances (the canonical liability list).
export function totalDebt() {
  return state.inputs.debt.reduce((s, d) => s + Number(d.balance || 0), 0);
}

// Sum of monthly payments across all debts.
export function totalMonthlyDebtService() {
  return state.inputs.debt.reduce((s, d) => s + Number(d.payment || 0), 0);
}

// Annualized debt service.
export function totalAnnualDebtService() {
  return totalMonthlyDebtService() * 12;
}

// Balance-weighted average interest rate across debts with a positive balance.
// Returns 0 when there is no outstanding balance.
export function weightedAvgDebtRate() {
  let weighted = 0;
  let balance = 0;
  for (const d of state.inputs.debt) {
    const b = Number(d.balance || 0);
    if (b > 0) {
      weighted += b * Number(d.rate || 0);
      balance += b;
    }
  }
  return balance > 0 ? weighted / balance : 0;
}

/* ------------------------------------------------------------------ *
 * Roll-ups
 * ------------------------------------------------------------------ */

// Gross asset value (informational): liquid + full real-estate value + alts.
export function totalAssets() {
  return liquidTotal() + realEstateValue() + alternativesTotal();
}

// Total liabilities = the canonical Debt-tab balance list.
export function totalLiabilities() {
  return totalDebt();
}

// Net worth.
//
// Real-estate mortgages are usually entered BOTH on the Real Estate tab (as
// mortgageBalance / CFD balances) AND on the Debt tab. To avoid double-counting
// those liabilities we base net worth on real-estate EQUITY (value − loans),
// NOT on full value minus the Debt-tab total. The Debt tab remains the canonical
// liability list and is surfaced separately (totalDebt) for the debt summary.
//   netWorth = liquid + realEstateEquity + alternatives
export function netWorth() {
  return liquidTotal() + realEstateEquity() + alternativesTotal();
}

/* ------------------------------------------------------------------ *
 * Concentration risk
 * ------------------------------------------------------------------ */

const CONCENTRATION_THRESHOLD_PCT = 15;

// Total dollar value across the concentration holdings list.
export function concentrationTotal() {
  return state.inputs.concentration.reduce((s, h) => s + Number(h.value || 0), 0);
}

// Each holding annotated with its % of liquid assets and an over-threshold flag.
// Returns [{ id, holding, value, pctOfLiquid, flagged }].
export function concentrationBreakdown() {
  const liquid = liquidTotal();
  return state.inputs.concentration.map((h) => {
    const value = Number(h.value || 0);
    const pctOfLiquid = liquid > 0 ? (value / liquid) * 100 : 0;
    return {
      id: h.id,
      holding: h.holding,
      value,
      pctOfLiquid,
      flagged: pctOfLiquid > CONCENTRATION_THRESHOLD_PCT,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Amortization
 * ------------------------------------------------------------------ */

// Estimated years to pay off a single debt at its current fixed payment.
//   balance  current principal
//   rate     annual interest rate as a percent (e.g. 4 = 4%)
//   payment  monthly payment
// months = -ln(1 - r*balance/p) / ln(1+r), where r = monthly rate.
// Guards:
//   - payment <= interest accruing each month => never amortizes => Infinity
//   - zero rate => simple balance / payment
export function payoffYears(balance, rate, payment) {
  const b = Number(balance || 0);
  const p = Number(payment || 0);
  if (b <= 0) return 0;
  if (p <= 0) return Infinity;

  const r = Number(rate || 0) / 100 / 12;
  if (r === 0) return b / p / 12;

  // If the payment can't cover the monthly interest, the loan never pays down.
  if (p <= r * b) return Infinity;

  const months = -Math.log(1 - (r * b) / p) / Math.log(1 + r);
  return months / 12;
}

// Per-debt payoff estimate for every debt with a positive balance.
// Returns [{ id, name, balance, rate, payment, years }].
export function debtPayoffEstimates() {
  return state.inputs.debt
    .filter((d) => Number(d.balance || 0) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: Number(d.balance || 0),
      rate: Number(d.rate || 0),
      payment: Number(d.payment || 0),
      years: payoffYears(d.balance, d.rate, d.payment),
    }));
}
