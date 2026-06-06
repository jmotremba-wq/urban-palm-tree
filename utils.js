// utils.js
// Formatting helpers + financial-math primitives.
// The financial helpers (futureValue, etc.) are preserved here for reuse by the
// future Retirement Modeler section.

/* ------------------------------------------------------------------ *
 * Number / currency formatting
 * ------------------------------------------------------------------ */

// Format a raw number as a US dollar string, e.g. 1280000 -> "$1,280,000".
// Decimals are kept only when the value has a fractional part.
export function formatDollars(value, { decimals = null } = {}) {
  const n = Number(value);
  if (!isFinite(n)) return "$0";
  const hasFraction = n % 1 !== 0;
  const fractionDigits = decimals != null ? decimals : hasFraction ? 2 : 0;
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

// Format a number as a percent string, e.g. 22 -> "22%".
export function formatPercent(value, { decimals = null } = {}) {
  const n = Number(value);
  if (!isFinite(n)) return "0%";
  const hasFraction = n % 1 !== 0;
  const fractionDigits = decimals != null ? decimals : hasFraction ? 2 : 0;
  return (
    n.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }) + "%"
  );
}

// Strip $, commas, %, and spaces from a user-entered string and return a Number.
// Empty / invalid input becomes 0.
export function parseNumber(raw) {
  if (typeof raw === "number") return isFinite(raw) ? raw : 0;
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/[$,%\s]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

// Apply the sign-based color class to a number-displaying element.
// Positive -> .value-pos, negative -> .value-neg, zero -> neither.
export function applySignClass(el, n) {
  el.classList.remove("value-pos", "value-neg");
  if (n > 0) el.classList.add("value-pos");
  else if (n < 0) el.classList.add("value-neg");
}

/* ------------------------------------------------------------------ *
 * Identity helpers
 * ------------------------------------------------------------------ */

// Stable unique id for dynamic table rows.
let _idCounter = 0;
export function uid(prefix = "row") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  _idCounter += 1;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

/* ------------------------------------------------------------------ *
 * Timing helpers
 * ------------------------------------------------------------------ */

// Generic debounce: returns a wrapped function that delays invocation.
export function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ------------------------------------------------------------------ *
 * Financial math (preserved for the future Retirement Modeler)
 * ------------------------------------------------------------------ */

// Future value of a single present sum compounded annually.
//   pv    present value
//   rate  annual rate as a decimal (0.06 = 6%)
//   years number of years
export function futureValue(pv, rate, years) {
  return pv * Math.pow(1 + rate, years);
}

// Future value of a series of equal periodic contributions (annuity).
//   pmt   contribution per period
//   rate  rate per period (decimal)
//   n     number of periods
export function futureValueAnnuity(pmt, rate, n) {
  if (rate === 0) return pmt * n;
  return pmt * ((Math.pow(1 + rate, n) - 1) / rate);
}

// Present value of a future sum discounted annually.
export function presentValue(fv, rate, years) {
  return fv / Math.pow(1 + rate, years);
}

// Fixed monthly payment for an amortizing loan.
//   principal    loan amount
//   annualRate   annual interest rate as a decimal
//   months       term in months
export function monthlyPayment(principal, annualRate, months) {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
