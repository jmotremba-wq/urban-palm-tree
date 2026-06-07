// state.js
// Single source-of-truth application state with localStorage persistence.
// Everything the UI edits lives on `state`; mutations call save() which writes
// one debounced JSON blob under the "financeApp_v1" key.

import { uid, debounce } from "./utils.js";

const STORAGE_KEY = "financeApp_v1";

/* ------------------------------------------------------------------ *
 * Default seed (GENERIC PLACEHOLDER values only — no real data)
 * ------------------------------------------------------------------ */

function seedDefaults() {
  return {
    activeTab: "inputs",
    inputsSubTab: "income",
    inputs: {
      income: {
        // Generic placeholder names. Users rename these locally; the renamed
        // values live only in this browser's localStorage, never in the repo.
        earnerAName: "Earner A",
        earnerBName: "Earner B",
        earnerABase: 300000,
        earnerABonusPct: 14,
        earnerABonusWithholdingPct: 22,
        earnerBBase: 130000,
        earnerBTotalComp: 210000,
        fedMarginalPct: 35,
        filingStatus: "Married Filing Jointly",
        standardDeduction: 29200,
      },
      accounts: [
        { id: uid(), name: "Taxable Brokerage", owner: "Earner A", type: "Taxable Brokerage", balance: 540000, notes: "" },
        { id: uid(), name: "Legacy 401(k)", owner: "Earner A", type: "Traditional 401(k)", balance: 300000, notes: "" },
        { id: uid(), name: "Roth IRA", owner: "Earner A", type: "Roth IRA", balance: 290000, notes: "" },
        { id: uid(), name: "HSA", owner: "Earner A", type: "HSA", balance: 25000, notes: "" },
        { id: uid(), name: "Taxable Brokerage", owner: "Earner B", type: "Taxable Brokerage", balance: 230000, notes: "" },
        { id: uid(), name: "Cash / Banking", owner: "Joint", type: "Cash-Banking", balance: 37000, notes: "" },
      ],
      concentration: [
        { id: uid(), holding: "STOCK-A", value: 195000, notes: "" },
        { id: uid(), holding: "STOCK-B", value: 79000, notes: "" },
        { id: uid(), holding: "ETF-A", value: 18000, notes: "" },
      ],
      alternatives: {
        privateUnitsValue: 1300000,
        unitsOwned: 4000,
        distributionThreshold: 11465,
        fundDeployed: 100000,
        fundCommitment: 200000,
        goldOunces: 11,
        goldPrice: 2400,
        goldGrowthPct: 4,
        silverOunces: 50,
        silverPrice: 30,
        silverGrowthPct: 5,
        bitcoin: 14000,
        rewardPoints: 7876,
      },
      realEstate: {
        primary: {
          label: "Primary Residence",
          value: 2250000,
          purchasePrice: 1500000,
          purchaseYear: 2020,
          improvements: 91000,
          mortgageBalance: 1280000,
          interestRate: 2.25,
          monthlyPI: 5200,
          annualPropertyTax: 18500,
        },
        rental: {
          label: "Rental Property",
          value: 555000,
          mortgageBalance: 193913,
          interestRate: 3.75,
          monthlyPI: 1532.1,
          annualGrossRent: 0,
          mgmtFeePct: 10,
        },
        farm: {
          label: "Farm Land",
          acres: 145,
          value: 650000,
          cfdBalanceA: 111232,
          cfdRateA: 4,
          monthlyPaymentA: 1038.52,
          cfdBalanceB: 102576,
          cfdRateB: 4,
          monthlyPaymentB: 1278.18,
          annualExpenses: 0,
          annualIncome: 0,
        },
      },
      debt: [
        { id: uid(), name: "Primary Mortgage", lender: "Lender A", balance: 1280000, rate: 2.25, payment: 5200 },
        { id: uid(), name: "Rental Mortgage", lender: "Lender B", balance: 193913, rate: 3.75, payment: 1532.1 },
        { id: uid(), name: "Farm Land Contract", lender: "Private", balance: 213808, rate: 4, payment: 2316.7 },
        { id: uid(), name: "Vehicle Loan", lender: "Bank C", balance: 183000, rate: 7.99, payment: 2500 },
        { id: uid(), name: "Auto Loan", lender: "Credit Union", balance: 15588, rate: 3.34, payment: 750 },
      ],
      military: {
        pensionMultiplierPct: 36,
        high3: 0,
        pensionStartAge: 60,
        vaRatingPct: 70,
        vaAnnual: 24000,
        crdpEligible: true,
        ssAFull67: 0,
        ssAClaimAge: 67,
        ssBFull67: 0,
        ssBClaimAge: 67,
      },
    },
    dashboard: {
      currentAge: 41,
      targetAge: 53,
      targetNetWorth: 5000000,
    },
    retirement: {
      retireAge: 55,
      lifeExpectancy: 90,
      nominalReturn: 6.5,
      inflation: 2.5,
      annualContribution: 60000,
      desiredSpending: 180000,
      withdrawalRate: 4,
      includeRealEstate: false,
    },
    taxYear: 2026,
    retirementMode: "simple",
    scenarios: {},
  };
}

/* ------------------------------------------------------------------ *
 * Load / save
 * ------------------------------------------------------------------ */

// Shallow-merge persisted data over fresh defaults so newly-added default
// keys still appear for users with older saved blobs.
function hydrate(saved, defaults) {
  if (!saved || typeof saved !== "object") return defaults;
  const savedInputs = saved.inputs || {};
  return {
    ...defaults,
    ...saved,
    inputs: {
      ...defaults.inputs,
      ...savedInputs,
      // Deep-merge the keyed sub-objects so newly-added default fields (e.g.
      // earner names) appear for users with older saved blobs.
      income: { ...defaults.inputs.income, ...(savedInputs.income || {}) },
      military: { ...defaults.inputs.military, ...(savedInputs.military || {}) },
      alternatives: { ...defaults.inputs.alternatives, ...(savedInputs.alternatives || {}) },
    },
    dashboard: { ...defaults.dashboard, ...(saved.dashboard || {}) },
    retirement: { ...defaults.retirement, ...(saved.retirement || {}) },
  };
}

export function load() {
  const defaults = seedDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return hydrate(JSON.parse(raw), defaults);
  } catch (err) {
    console.warn("Failed to read state, seeding defaults:", err);
    return defaults;
  }
}

// The live state object. Import this and mutate it directly, then call save().
export const state = load();

function writeNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist state:", err);
  }
}

// Debounced (~300ms) persistence used by all field handlers.
export const save = debounce(writeNow, 300);

// Immediate persistence for structural changes (add/delete row, tab switch).
export const saveNow = writeNow;
