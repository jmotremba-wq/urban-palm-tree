// inputs.js
// Renders the six Inputs sub-tabs. Every field is bound to the shared `state`
// object and persists via the debounced save(). Dynamic tables (accounts,
// concentration, debt) support add/delete with stable ids, and all auto-calc
// fields update live.

import { state, save, saveNow } from "./state.js";
import {
  formatDollars,
  formatPercent,
  parseNumber,
  applySignClass,
  uid,
} from "./utils.js";

/* ------------------------------------------------------------------ *
 * Small DOM helpers
 * ------------------------------------------------------------------ */

// Create an element with attributes and children.
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && v !== false) {
      node.setAttribute(k, v === true ? "" : v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// A labelled form field wrapping a control.
function field(label, control, { span2 = false, note = null } = {}) {
  const wrap = el("div", { class: "field" + (span2 ? " span-2" : "") });
  const lab = el("label", { text: label });
  wrap.appendChild(lab);
  wrap.appendChild(control);
  if (note) wrap.appendChild(el("div", { class: "field-note", text: note }));
  return wrap;
}

/* ------------------------------------------------------------------ *
 * Bound input factories
 *
 * Each returns an <input>/<select> wired to a getter/setter into state.
 * `kind` controls formatting:
 *   "dollar"  -> $ + commas on blur, raw number stored
 *   "percent" -> N% on blur, raw number stored
 *   "number"  -> plain number
 *   "text"    -> string
 * `onCommit` fires after the value is written, for live recalcs.
 * ------------------------------------------------------------------ */

function displayValue(kind, raw) {
  if (kind === "dollar") return formatDollars(raw);
  if (kind === "percent") return formatPercent(raw);
  return raw == null ? "" : String(raw);
}

function boundInput(kind, get, set, { onCommit = null, attrs = {} } = {}) {
  const input = el("input", {
    type: "text",
    class: kind === "text" ? "" : "data-num",
    ...attrs,
  });
  input.value = displayValue(kind, get());

  // While focused, show the bare numeric value for easy editing.
  input.addEventListener("focus", () => {
    if (kind === "dollar" || kind === "percent") {
      const n = get();
      input.value = n === 0 || n == null ? "" : String(n);
    }
    input.select();
  });

  const commit = () => {
    let val;
    if (kind === "text") {
      val = input.value;
    } else {
      val = parseNumber(input.value);
    }
    set(val);
    input.value = displayValue(kind, val);
    save();
    if (onCommit) onCommit();
  };

  input.addEventListener("blur", commit);
  input.addEventListener("change", commit);
  return input;
}

function boundSelect(options, get, set, { onCommit = null, attrs = {} } = {}) {
  const sel = el("select", attrs);
  const current = String(get());
  for (const opt of options) {
    const value = typeof opt === "object" ? opt.value : opt;
    const label = typeof opt === "object" ? opt.label : opt;
    const o = el("option", { value }, label);
    if (String(value) === current) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    set(sel.value);
    save();
    if (onCommit) onCommit();
  });
  return sel;
}

// A read-only computed display line (label + value).
function readonlyField(label, initialText) {
  const out = el("div", { class: "readonly-line" });
  out.innerHTML = label + " <span class='accent'></span>";
  const span = out.querySelector(".accent");
  span.textContent = initialText;
  return { node: out, set: (t) => (span.textContent = t) };
}

/* ================================================================== *
 * SUB-TAB 1: Income
 * ================================================================== */

function renderIncome(root) {
  const inc = state.inputs.income;
  root.innerHTML = "";

  // Resolve the (possibly renamed) earner labels, falling back to generics.
  const nameA = inc.earnerAName || "Earner A";
  const nameB = inc.earnerBName || "Earner B";

  const card = el("div", { class: "card stagger" });
  card.appendChild(el("h3", { class: "card-title", text: "Income" }));

  // Re-render this sub-tab so renamed labels propagate immediately.
  const rerender = () => renderIncome(root);

  // ---- Names (renamed locally only — defaults stay generic) ----
  const nameGrid = el("div", { class: "form-grid" });
  nameGrid.appendChild(
    field(
      "Earner A — Display Name",
      boundInput("text", () => inc.earnerAName, (v) => (inc.earnerAName = v), {
        onCommit: rerender,
      }),
      { note: "Stored only in this browser; the saved default stays generic." }
    )
  );
  nameGrid.appendChild(
    field(
      "Earner B — Display Name",
      boundInput("text", () => inc.earnerBName, (v) => (inc.earnerBName = v), {
        onCommit: rerender,
      }),
      { note: "Stored only in this browser; the saved default stays generic." }
    )
  );
  card.appendChild(nameGrid);

  const grid = el("div", { class: "form-grid" });

  // Earner A bonus auto-calc display.
  const bonusOut = readonlyField(
    `${nameA} bonus amount:`,
    formatDollars(inc.earnerABase * (inc.earnerABonusPct / 100))
  );
  const recalcBonus = () =>
    bonusOut.set(
      formatDollars(inc.earnerABase * (inc.earnerABonusPct / 100))
    );

  grid.appendChild(
    field(
      `${nameA} — W-2 Base Salary`,
      boundInput("dollar", () => inc.earnerABase, (v) => (inc.earnerABase = v), {
        onCommit: recalcBonus,
      })
    )
  );
  grid.appendChild(
    field(
      `${nameA} — Annual Bonus (%)`,
      boundInput(
        "percent",
        () => inc.earnerABonusPct,
        (v) => (inc.earnerABonusPct = v),
        { onCommit: recalcBonus }
      )
    )
  );
  grid.appendChild(field(`${nameA} — Bonus (auto-calc)`, bonusOut.node, { span2: false }));
  grid.appendChild(
    field(
      `${nameA} — Bonus Withholding Rate (%)`,
      boundInput(
        "percent",
        () => inc.earnerABonusWithholdingPct,
        (v) => (inc.earnerABonusWithholdingPct = v)
      )
    )
  );
  grid.appendChild(
    field(
      `${nameB} — W-2 Base Salary`,
      boundInput("dollar", () => inc.earnerBBase, (v) => (inc.earnerBBase = v))
    )
  );
  grid.appendChild(
    field(
      `${nameB} — Total Annual Comp`,
      boundInput(
        "dollar",
        () => inc.earnerBTotalComp,
        (v) => (inc.earnerBTotalComp = v)
      )
    )
  );
  grid.appendChild(
    field(
      "Federal Marginal Tax Rate (%)",
      boundInput(
        "percent",
        () => inc.fedMarginalPct,
        (v) => (inc.fedMarginalPct = v)
      )
    )
  );
  grid.appendChild(
    field(
      "Filing Status",
      boundSelect(
        ["Married Filing Jointly"],
        () => inc.filingStatus,
        (v) => (inc.filingStatus = v),
        { attrs: { disabled: true } }
      )
    )
  );
  grid.appendChild(
    field(
      "Standard Deduction (MFJ)",
      boundInput(
        "dollar",
        () => inc.standardDeduction,
        (v) => (inc.standardDeduction = v)
      )
    )
  );

  card.appendChild(grid);

  const medicare = el("div", {
    class: "readonly-line",
    html:
      "Additional Medicare Tax: <span class='accent'>0.9%</span> on earned income above $250,000 (MFJ)",
  });
  medicare.style.marginTop = "16px";
  card.appendChild(medicare);

  root.appendChild(card);
}

/* ================================================================== *
 * SUB-TAB 2: Liquid Investments
 * ================================================================== */

const ACCOUNT_TYPES = [
  "Taxable Brokerage",
  "Traditional 401(k)",
  "Roth IRA",
  "HSA",
  "Deferred Comp",
  "Cash-Banking",
  "529 Education",
];

function renderLiquid(root) {
  root.innerHTML = "";
  const wrap = el("div", { class: "stagger" });

  // ---- Accounts table ----
  const card = el("div", { class: "card" });
  card.appendChild(el("h3", { class: "card-title", text: "Liquid Investment Accounts" }));

  const table = el("table");
  table.appendChild(
    el("thead", {}, el("tr", {}, [
      el("th", { text: "Account Name" }),
      el("th", { text: "Owner" }),
      el("th", { text: "Account Type" }),
      el("th", { class: "num", text: "Current Balance" }),
      el("th", { text: "Notes" }),
      el("th", { text: "" }),
    ]))
  );
  const tbody = el("tbody");
  table.appendChild(tbody);

  const totalCell = el("span", { class: "amount", text: "" });
  const tfoot = el(
    "tfoot",
    {},
    el("tr", {}, [
      el("td", { class: "label", colspan: 3, text: "Total Liquid" }),
      el("td", { class: "num" }, totalCell),
      el("td", { colspan: 2 }),
    ])
  );
  table.appendChild(tfoot);

  // Tax-bucket breakdown: Taxable / Tax-Deferred / Tax-Free+HSA
  const TAXABLE_TYPES   = ["Taxable Brokerage", "Cash-Banking"];
  const DEFERRED_TYPES  = ["Traditional 401(k)", "Traditional IRA", "SEP IRA", "SIMPLE IRA", "Solo 401(k)"];
  const FREE_TYPES      = ["Roth IRA", "Roth 401(k)", "HSA"];

  const bucketTaxable  = el("div", { class: "bucket-value" });
  const bucketDeferred = el("div", { class: "bucket-value" });
  const bucketFree     = el("div", { class: "bucket-value" });
  const bucketTaxableP  = el("div", { class: "bucket-pct" });
  const bucketDeferredP = el("div", { class: "bucket-pct" });
  const bucketFreeP     = el("div", { class: "bucket-pct" });

  const refreshTotal = () => {
    const total = state.inputs.accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    totalCell.textContent = formatDollars(total);
    const taxable  = state.inputs.accounts.filter(a => TAXABLE_TYPES.includes(a.type)).reduce((s,a) => s + Number(a.balance||0), 0);
    const deferred = state.inputs.accounts.filter(a => DEFERRED_TYPES.includes(a.type)).reduce((s,a) => s + Number(a.balance||0), 0);
    const free     = state.inputs.accounts.filter(a => FREE_TYPES.includes(a.type)).reduce((s,a) => s + Number(a.balance||0), 0);
    const denom    = taxable + deferred + free || 1;
    bucketTaxable.textContent  = formatDollars(taxable);
    bucketDeferred.textContent = formatDollars(deferred);
    bucketFree.textContent     = formatDollars(free);
    bucketTaxableP.textContent  = (taxable  / denom * 100).toFixed(0) + "%";
    bucketDeferredP.textContent = (deferred / denom * 100).toFixed(0) + "%";
    bucketFreeP.textContent     = (free     / denom * 100).toFixed(0) + "%";
  };

  const addAccountRow = (acct) => {
    const tr = el("tr");
    tr.appendChild(el("td", {}, boundInput("text", () => acct.name, (v) => (acct.name = v))));
    tr.appendChild(el("td", {}, boundInput("text", () => acct.owner, (v) => (acct.owner = v))));
    tr.appendChild(
      el("td", {}, boundSelect(ACCOUNT_TYPES, () => acct.type, (v) => (acct.type = v)))
    );
    tr.appendChild(
      el("td", { class: "num" }, boundInput("dollar", () => acct.balance, (v) => (acct.balance = v), {
        onCommit: refreshTotal,
      }))
    );
    tr.appendChild(el("td", {}, boundInput("text", () => acct.notes, (v) => (acct.notes = v))));
    const del = el("td", {}, el("button", {
      class: "btn-del",
      title: "Delete account",
      text: "\u{1F5D1}",
      onclick: () => {
        state.inputs.accounts = state.inputs.accounts.filter((a) => a.id !== acct.id);
        tr.remove();
        refreshTotal();
        saveNow();
      },
    }));
    tr.appendChild(del);
    tbody.appendChild(tr);
  };

  state.inputs.accounts.forEach(addAccountRow);
  refreshTotal();

  card.appendChild(table);
  card.appendChild(
    el("button", {
      class: "btn btn-add",
      text: "+ Add Account",
      onclick: () => {
        const acct = { id: uid(), name: "", owner: "", type: ACCOUNT_TYPES[0], balance: 0, notes: "" };
        state.inputs.accounts.push(acct);
        addAccountRow(acct);
        refreshTotal();
        saveNow();
      },
    })
  );

  // Tax-bucket summary bar
  const bucketLabel = el("div", { class: "field-note", text: "Tax Treatment Breakdown", style: "margin-top:16px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.07em;font-family:var(--font-head);" });
  const bucketBar = el("div", { class: "bucket-bar" });
  const makeBucket = (labelText, valueEl, pctEl) => {
    const b = el("div", { class: "bucket" });
    b.appendChild(el("div", { class: "bucket-label", text: labelText }));
    b.appendChild(valueEl);
    b.appendChild(pctEl);
    return b;
  };
  bucketBar.appendChild(makeBucket("Taxable",        bucketTaxable,  bucketTaxableP));
  bucketBar.appendChild(makeBucket("Tax-Deferred",   bucketDeferred, bucketDeferredP));
  bucketBar.appendChild(makeBucket("Tax-Free / HSA", bucketFree,     bucketFreeP));
  card.appendChild(bucketLabel);
  card.appendChild(bucketBar);

  wrap.appendChild(card);

  // ---- Taxable Concentration (collapsible) ----
  const details = el("details", { open: true });
  details.appendChild(el("summary", { text: "Taxable Concentration" }));
  const body = el("div", { class: "details-body" });

  const ctable = el("table");
  ctable.appendChild(
    el("thead", {}, el("tr", {}, [
      el("th", { text: "Holding" }),
      el("th", { class: "num", text: "Current Value" }),
      el("th", { class: "num", text: "% of Total" }),
      el("th", { text: "Notes" }),
      el("th", { text: "" }),
    ]))
  );
  const cbody = el("tbody");
  ctable.appendChild(cbody);

  const ctotalCell = el("span", { class: "amount", text: "" });
  ctable.appendChild(
    el("tfoot", {}, el("tr", {}, [
      el("td", { class: "label", text: "Total" }),
      el("td", { class: "num" }, ctotalCell),
      el("td", { colspan: 3 }),
    ]))
  );

  // Each row keeps a reference to its percent cell so we can re-distribute live.
  const pctCells = new Map();

  const refreshConcentration = () => {
    const total = state.inputs.concentration.reduce((s, h) => s + Number(h.value || 0), 0);
    ctotalCell.textContent = formatDollars(total);
    for (const h of state.inputs.concentration) {
      const cell = pctCells.get(h.id);
      if (!cell) continue;
      const pct = total > 0 ? (Number(h.value || 0) / total) * 100 : 0;
      cell.textContent = formatPercent(pct, { decimals: 1 });
    }
  };

  const addHoldingRow = (h) => {
    const tr = el("tr");
    tr.appendChild(el("td", {}, boundInput("text", () => h.holding, (v) => (h.holding = v))));
    tr.appendChild(
      el("td", { class: "num" }, boundInput("dollar", () => h.value, (v) => (h.value = v), {
        onCommit: refreshConcentration,
      }))
    );
    const pctCell = el("td", { class: "num col-pct", text: "" });
    pctCells.set(h.id, pctCell);
    tr.appendChild(pctCell);
    tr.appendChild(el("td", {}, boundInput("text", () => h.notes, (v) => (h.notes = v))));
    tr.appendChild(el("td", {}, el("button", {
      class: "btn-del",
      title: "Delete holding",
      text: "\u{1F5D1}",
      onclick: () => {
        state.inputs.concentration = state.inputs.concentration.filter((x) => x.id !== h.id);
        pctCells.delete(h.id);
        tr.remove();
        refreshConcentration();
        saveNow();
      },
    })));
    cbody.appendChild(tr);
  };

  state.inputs.concentration.forEach(addHoldingRow);
  refreshConcentration();

  body.appendChild(ctable);
  body.appendChild(
    el("button", {
      class: "btn btn-add",
      text: "+ Add Holding",
      onclick: () => {
        const h = { id: uid(), holding: "", value: 0, notes: "" };
        state.inputs.concentration.push(h);
        addHoldingRow(h);
        refreshConcentration();
        saveNow();
      },
    })
  );
  details.appendChild(body);
  wrap.appendChild(details);

  root.appendChild(wrap);
}

/* ------------------------------------------------------------------ *
 * Spot-price fetch helper (metals.live — free, no API key, CORS-open)
 * Falls back gracefully: user can always type the price manually.
 * ------------------------------------------------------------------ */

async function fetchSpotPrice(metal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.metals.live/v1/spot", { signal: controller.signal });
    if (!res.ok) throw new Error("http " + res.status);
    const data = await res.json();
    // Response shape: [{"gold": 2345.6, "silver": 29.4, ...}]
    const price = Array.isArray(data) ? data[0]?.[metal] : data[metal];
    if (typeof price !== "number" || price <= 0) throw new Error("no price");
    return Math.round(price * 100) / 100;
  } finally {
    clearTimeout(timeout);
  }
}

// Returns a small "↻ Live" button that fetches and calls onPrice(price).
function makeFetchBtn(metal, onPrice) {
  const btn = el("button", { type: "button", class: "btn-fetch", text: "↻ Live" });
  btn.addEventListener("click", async () => {
    btn.textContent = "…";
    btn.disabled = true;
    try {
      const price = await fetchSpotPrice(metal);
      onPrice(price);
      btn.textContent = "✓";
    } catch {
      btn.textContent = "✗";
    } finally {
      setTimeout(() => { btn.textContent = "↻ Live"; btn.disabled = false; }, 1800);
    }
  });
  return btn;
}

// Wraps an input + fetch button in a flex row.
function priceRow(input, fetchBtn) {
  const row = el("div", { class: "fetch-row" });
  row.appendChild(input);
  row.appendChild(fetchBtn);
  return row;
}

/* ================================================================== *
 * SUB-TAB 3: Alternative & Illiquid Assets
 * ================================================================== */

function renderAlternatives(root) {
  root.innerHTML = "";
  const alt = state.inputs.alternatives;
  const card = el("div", { class: "card stagger" });
  card.appendChild(el("h3", { class: "card-title", text: "Alternative & Illiquid Assets" }));

  const grid = el("div", { class: "form-grid" });

  grid.appendChild(field("Private Units — Placeholder Value",
    boundInput("dollar", () => alt.privateUnitsValue, (v) => (alt.privateUnitsValue = v))));
  grid.appendChild(field("Units Owned",
    boundInput("number", () => alt.unitsOwned, (v) => (alt.unitsOwned = v))));
  grid.appendChild(field("Distribution Threshold / unit",
    boundInput("dollar", () => alt.distributionThreshold, (v) => (alt.distributionThreshold = v))));

  // Private Fund + unfunded auto-calc
  const unfunded = readonlyField("Remaining Unfunded:",
    formatDollars(alt.fundCommitment - alt.fundDeployed));
  const recalcUnfunded = () =>
    unfunded.set(formatDollars(alt.fundCommitment - alt.fundDeployed));

  grid.appendChild(field("Private Fund — Deployed Capital",
    boundInput("dollar", () => alt.fundDeployed, (v) => (alt.fundDeployed = v), { onCommit: recalcUnfunded })));
  grid.appendChild(field("Private Fund — Total Commitment",
    boundInput("dollar", () => alt.fundCommitment, (v) => (alt.fundCommitment = v), { onCommit: recalcUnfunded })));
  grid.appendChild(field("Private Fund — Remaining Unfunded (auto-calc)", unfunded.node));

  // Gold
  const goldValDisplay = readonlyField("Gold Value:", formatDollars(alt.goldOunces * alt.goldPrice));
  const recalcGold = () => goldValDisplay.set(formatDollars(alt.goldOunces * alt.goldPrice));

  const goldPriceInput = boundInput("dollar", () => alt.goldPrice, (v) => { alt.goldPrice = v; recalcGold(); });
  const goldBtn = makeFetchBtn("gold", (price) => {
    alt.goldPrice = price;
    goldPriceInput.value = formatDollars(price);
    recalcGold();
    save();
  });

  grid.appendChild(field("Physical Gold — Ounces",
    boundInput("number", () => alt.goldOunces, (v) => (alt.goldOunces = v), { onCommit: recalcGold })));
  grid.appendChild(field("Gold Spot Price / oz", priceRow(goldPriceInput, goldBtn),
    { note: "↻ Live fetches current spot from metals.live" }));
  grid.appendChild(field("Gold Annual Growth Rate (%)",
    boundInput("percent", () => alt.goldGrowthPct, (v) => (alt.goldGrowthPct = v)),
    { note: "Used in Retirement Modeler projection" }));
  grid.appendChild(field("Gold Value (auto-calc)", goldValDisplay.node, { note: "Collectibles tax rate: 28%" }));

  // Silver
  const silverValDisplay = readonlyField("Silver Value:", formatDollars(alt.silverOunces * alt.silverPrice));
  const recalcSilver = () => silverValDisplay.set(formatDollars(alt.silverOunces * alt.silverPrice));

  const silverPriceInput = boundInput("dollar", () => alt.silverPrice, (v) => { alt.silverPrice = v; recalcSilver(); });
  const silverBtn = makeFetchBtn("silver", (price) => {
    alt.silverPrice = price;
    silverPriceInput.value = formatDollars(price);
    recalcSilver();
    save();
  });

  grid.appendChild(field("Physical Silver — Ounces",
    boundInput("number", () => alt.silverOunces, (v) => (alt.silverOunces = v), { onCommit: recalcSilver })));
  grid.appendChild(field("Silver Spot Price / oz", priceRow(silverPriceInput, silverBtn),
    { note: "↻ Live fetches current spot from metals.live" }));
  grid.appendChild(field("Silver Annual Growth Rate (%)",
    boundInput("percent", () => alt.silverGrowthPct, (v) => (alt.silverGrowthPct = v)),
    { note: "Used in Retirement Modeler projection" }));
  grid.appendChild(field("Silver Value (auto-calc)", silverValDisplay.node, { note: "Collectibles tax rate: 28%" }));

  // Bitcoin
  grid.appendChild(field("Bitcoin / Crypto",
    boundInput("dollar", () => alt.bitcoin, (v) => (alt.bitcoin = v))));
  grid.appendChild(field("Bitcoin Annual Growth Rate (%)",
    boundInput("percent", () => alt.bitcoinGrowthPct, (v) => (alt.bitcoinGrowthPct = v)),
    { note: "Used in Retirement Modeler projection" }));
  grid.appendChild(field("Reward Points",
    boundInput("number", () => alt.rewardPoints, (v) => (alt.rewardPoints = v))));

  card.appendChild(grid);
  root.appendChild(card);
}

/* ================================================================== *
 * SUB-TAB 4: Real Estate
 * ================================================================== */

// A reusable computed-stat strip; returns the row + a setter keyed by label.
function statStrip(items) {
  const row = el("div", { class: "stat-row" });
  const setters = {};
  for (const it of items) {
    const valEl = el("div", { class: "stat-value", text: it.value });
    if (it.sign != null) applySignClass(valEl, it.sign);
    const stat = el("div", { class: "stat" }, [
      el("div", { class: "stat-label", text: it.label }),
      valEl,
    ]);
    row.appendChild(stat);
    setters[it.key] = (text, sign) => {
      valEl.textContent = text;
      if (sign != null) applySignClass(valEl, sign);
    };
  }
  return { node: row, setters };
}

function renderRealEstate(root) {
  root.innerHTML = "";
  const re = state.inputs.realEstate;
  const wrap = el("div", { class: "stagger" });

  // ---- Primary Residence ----
  {
    const p = re.primary;
    const details = el("details", { open: true });
    details.appendChild(el("summary", { text: "Primary Residence" }));
    const body = el("div", { class: "details-body" });
    const grid = el("div", { class: "form-grid" });

    const strip = statStrip([
      { key: "gain", label: "Unrealized Gain", value: "" },
      { key: "taxable", label: "Taxable Gain at Sale", value: "" },
      { key: "equity", label: "Equity", value: "" },
    ]);
    const recalc = () => {
      const gain = p.value - p.purchasePrice - p.improvements;
      const taxable = Math.max(0, gain - 500000);
      const equity = p.value - p.mortgageBalance;
      strip.setters.gain(formatDollars(gain), gain);
      strip.setters.taxable(formatDollars(taxable), taxable === 0 ? 0 : -1);
      strip.setters.equity(formatDollars(equity), equity);
    };

    grid.appendChild(field("Label / Nickname",
      boundInput("text", () => p.label, (v) => (p.label = v), { attrs: { class: "" } })));
    grid.appendChild(field("Estimated Current Value",
      boundInput("dollar", () => p.value, (v) => (p.value = v), { onCommit: recalc })));
    grid.appendChild(field("Purchase Price",
      boundInput("dollar", () => p.purchasePrice, (v) => (p.purchasePrice = v), { onCommit: recalc })));
    grid.appendChild(field("Purchase Year",
      boundInput("number", () => p.purchaseYear, (v) => (p.purchaseYear = v))));
    grid.appendChild(field("Capital Improvements",
      boundInput("dollar", () => p.improvements, (v) => (p.improvements = v), { onCommit: recalc })));
    grid.appendChild(field("Mortgage Balance",
      boundInput("dollar", () => p.mortgageBalance, (v) => (p.mortgageBalance = v), { onCommit: recalc })));
    grid.appendChild(field("Interest Rate (%)",
      boundInput("percent", () => p.interestRate, (v) => (p.interestRate = v))));
    grid.appendChild(field("Monthly P&I",
      boundInput("dollar", () => p.monthlyPI, (v) => (p.monthlyPI = v))));
    grid.appendChild(field("Annual Property Tax",
      boundInput("dollar", () => p.annualPropertyTax, (v) => (p.annualPropertyTax = v))));

    body.appendChild(grid);
    const note = el("div", { class: "readonly-line", html: "§121 exclusion (MFJ): <span class='accent'>$500,000</span>" });
    note.style.marginTop = "16px";
    body.appendChild(note);
    body.appendChild(strip.node);
    recalc();
    details.appendChild(body);
    wrap.appendChild(details);
  }

  // ---- Rental ----
  {
    const r = re.rental;
    const details = el("details");
    details.appendChild(el("summary", { text: "Rental Property" }));
    const body = el("div", { class: "details-body" });
    const grid = el("div", { class: "form-grid" });

    const strip = statStrip([
      { key: "net", label: "Annual Net Rental Income", value: "" },
      { key: "equity", label: "Equity", value: "" },
    ]);
    const recalc = () => {
      const net = r.annualGrossRent * (1 - r.mgmtFeePct / 100);
      const equity = r.value - r.mortgageBalance;
      strip.setters.net(formatDollars(net), net);
      strip.setters.equity(formatDollars(equity), equity);
    };

    grid.appendChild(field("Label / Nickname",
      boundInput("text", () => r.label, (v) => (r.label = v))));
    grid.appendChild(field("Estimated Current Value",
      boundInput("dollar", () => r.value, (v) => (r.value = v), { onCommit: recalc })));
    grid.appendChild(field("Mortgage Balance",
      boundInput("dollar", () => r.mortgageBalance, (v) => (r.mortgageBalance = v), { onCommit: recalc })));
    grid.appendChild(field("Interest Rate (%)",
      boundInput("percent", () => r.interestRate, (v) => (r.interestRate = v))));
    grid.appendChild(field("Monthly P&I",
      boundInput("dollar", () => r.monthlyPI, (v) => (r.monthlyPI = v))));
    grid.appendChild(field("Annual Gross Rental Income",
      boundInput("dollar", () => r.annualGrossRent, (v) => (r.annualGrossRent = v), { onCommit: recalc })));
    grid.appendChild(field("Property Management Fee (%)",
      boundInput("percent", () => r.mgmtFeePct, (v) => (r.mgmtFeePct = v), { onCommit: recalc })));

    body.appendChild(grid);
    body.appendChild(strip.node);
    recalc();
    details.appendChild(body);
    wrap.appendChild(details);
  }

  // ---- Farm ----
  {
    const f = re.farm;
    const details = el("details");
    details.appendChild(el("summary", { text: "Farm Land" }));
    const body = el("div", { class: "details-body" });
    const grid = el("div", { class: "form-grid" });

    const strip = statStrip([
      { key: "cfd", label: "Total CFD Balance", value: "" },
      { key: "pmt", label: "Total Monthly CFD Payment", value: "" },
      { key: "equity", label: "Equity", value: "" },
    ]);
    const recalc = () => {
      const cfd = Number(f.cfdBalanceA) + Number(f.cfdBalanceB);
      const pmt = Number(f.monthlyPaymentA) + Number(f.monthlyPaymentB);
      const equity = f.value - cfd;
      strip.setters.cfd(formatDollars(cfd), -1);
      strip.setters.pmt(formatDollars(pmt));
      strip.setters.equity(formatDollars(equity), equity);
    };

    grid.appendChild(field("Label / Nickname",
      boundInput("text", () => f.label, (v) => (f.label = v))));
    grid.appendChild(field("Total Acres",
      boundInput("number", () => f.acres, (v) => (f.acres = v))));
    grid.appendChild(field("Estimated Current Value",
      boundInput("dollar", () => f.value, (v) => (f.value = v), { onCommit: recalc })));
    grid.appendChild(field("CFD Balance A",
      boundInput("dollar", () => f.cfdBalanceA, (v) => (f.cfdBalanceA = v), { onCommit: recalc })));
    grid.appendChild(field("CFD Rate A (%)",
      boundInput("percent", () => f.cfdRateA, (v) => (f.cfdRateA = v))));
    grid.appendChild(field("Monthly Payment A",
      boundInput("dollar", () => f.monthlyPaymentA, (v) => (f.monthlyPaymentA = v), { onCommit: recalc })));
    grid.appendChild(field("CFD Balance B",
      boundInput("dollar", () => f.cfdBalanceB, (v) => (f.cfdBalanceB = v), { onCommit: recalc })));
    grid.appendChild(field("CFD Rate B (%)",
      boundInput("percent", () => f.cfdRateB, (v) => (f.cfdRateB = v))));
    grid.appendChild(field("Monthly Payment B",
      boundInput("dollar", () => f.monthlyPaymentB, (v) => (f.monthlyPaymentB = v), { onCommit: recalc })));
    grid.appendChild(field("Annual Farm Expenses",
      boundInput("dollar", () => f.annualExpenses, (v) => (f.annualExpenses = v))));
    grid.appendChild(field("Annual Farm Income",
      boundInput("dollar", () => f.annualIncome, (v) => (f.annualIncome = v))));

    body.appendChild(grid);
    body.appendChild(strip.node);
    recalc();
    details.appendChild(body);
    wrap.appendChild(details);
  }

  root.appendChild(wrap);
}

/* ================================================================== *
 * SUB-TAB 5: Debt
 * ================================================================== */

function renderDebt(root) {
  root.innerHTML = "";
  const card = el("div", { class: "card stagger" });
  card.appendChild(el("h3", { class: "card-title", text: "Debt" }));

  const table = el("table");
  table.appendChild(
    el("thead", {}, el("tr", {}, [
      el("th", { text: "Debt Name" }),
      el("th", { text: "Lender" }),
      el("th", { class: "num", text: "Balance" }),
      el("th", { class: "num", text: "Rate" }),
      el("th", { class: "num", text: "Monthly Payment" }),
      el("th", { text: "" }),
    ]))
  );
  const tbody = el("tbody");
  table.appendChild(tbody);

  const totalBalCell = el("span", { class: "amount", text: "" });
  const totalMoCell = el("span", { class: "amount", text: "" });
  const totalYrCell = el("span", { class: "amount", text: "" });
  table.appendChild(
    el("tfoot", {}, [
      el("tr", {}, [
        el("td", { class: "label", colspan: 2, text: "Total Debt" }),
        el("td", { class: "num" }, totalBalCell),
        el("td", {}),
        el("td", {}),
        el("td", {}),
      ]),
      el("tr", {}, [
        el("td", { class: "label", colspan: 2, text: "Total Monthly Debt Service" }),
        el("td", {}),
        el("td", {}),
        el("td", { class: "num" }, totalMoCell),
        el("td", {}),
      ]),
      el("tr", {}, [
        el("td", { class: "label", colspan: 2, text: "Total Annual Debt Service" }),
        el("td", {}),
        el("td", {}),
        el("td", { class: "num" }, totalYrCell),
        el("td", {}),
      ]),
    ])
  );

  const refreshTotals = () => {
    const bal = state.inputs.debt.reduce((s, d) => s + Number(d.balance || 0), 0);
    const mo = state.inputs.debt.reduce((s, d) => s + Number(d.payment || 0), 0);
    totalBalCell.textContent = formatDollars(bal);
    totalMoCell.textContent = formatDollars(mo);
    totalYrCell.textContent = formatDollars(mo * 12);
  };

  const addDebtRow = (d) => {
    const tr = el("tr");
    tr.appendChild(el("td", {}, boundInput("text", () => d.name, (v) => (d.name = v))));
    tr.appendChild(el("td", {}, boundInput("text", () => d.lender, (v) => (d.lender = v))));
    tr.appendChild(el("td", { class: "num" },
      boundInput("dollar", () => d.balance, (v) => (d.balance = v), { onCommit: refreshTotals })));
    tr.appendChild(el("td", { class: "num" },
      boundInput("percent", () => d.rate, (v) => (d.rate = v))));
    tr.appendChild(el("td", { class: "num" },
      boundInput("dollar", () => d.payment, (v) => (d.payment = v), { onCommit: refreshTotals })));
    tr.appendChild(el("td", {}, el("button", {
      class: "btn-del",
      title: "Delete debt",
      text: "\u{1F5D1}",
      onclick: () => {
        state.inputs.debt = state.inputs.debt.filter((x) => x.id !== d.id);
        tr.remove();
        refreshTotals();
        saveNow();
      },
    })));
    tbody.appendChild(tr);
  };

  state.inputs.debt.forEach(addDebtRow);
  refreshTotals();

  card.appendChild(table);
  card.appendChild(el("button", {
    class: "btn btn-add",
    text: "+ Add Debt",
    onclick: () => {
      const d = { id: uid(), name: "", lender: "", balance: 0, rate: 0, payment: 0 };
      state.inputs.debt.push(d);
      addDebtRow(d);
      refreshTotals();
      saveNow();
    },
  }));
  root.appendChild(card);
}

/* ================================================================== *
 * SUB-TAB 6: Military & Benefits
 * ================================================================== */

// 2025 DoD monthly base pay table: { grade: [[minYOS, monthlyPay], ...] }
const MIL_PAY_2025 = {
  "E-1": [[0, 2058]],
  "E-2": [[0, 2309]],
  "E-3": [[0, 2432], [2, 2504], [3, 2633]],
  "E-4": [[0, 2613], [3, 2742], [4, 2903], [6, 3017]],
  "E-5": [[0, 2847], [3, 2949], [4, 3065], [6, 3191], [8, 3278], [10, 3384], [12, 3520]],
  "E-6": [[0, 3345], [8, 3491], [10, 3618], [12, 3770], [14, 3907], [16, 4037], [18, 4186], [20, 4329], [22, 4470]],
  "E-7": [[0, 3862], [8, 3945], [10, 4144], [12, 4344], [14, 4432], [16, 4597], [18, 4719], [20, 4904], [22, 5066], [24, 5223], [26, 5349]],
  "E-8": [[0, 4985], [12, 5069], [14, 5136], [16, 5197], [18, 5324], [20, 5497], [22, 5703], [24, 5888], [26, 5993]],
  "E-9": [[0, 5997], [18, 6146], [20, 6356], [22, 6662], [24, 6869], [26, 7158]],
  "W-1": [[0, 3788], [4, 4205], [6, 4601], [8, 4838], [10, 5085], [12, 5375], [14, 5614], [16, 5863], [18, 5993], [20, 6132], [22, 6278], [24, 6427]],
  "W-2": [[0, 4374], [4, 4775], [6, 5087], [8, 5328], [10, 5558], [12, 5845], [14, 6079], [16, 6316], [18, 6492], [20, 6623], [22, 6755], [24, 6891]],
  "W-3": [[0, 4958], [4, 5277], [6, 5612], [8, 5921], [10, 6241], [12, 6563], [14, 6889], [16, 7219], [18, 7454], [20, 7684], [22, 7854], [24, 8028]],
  "W-4": [[0, 5468], [4, 5841], [6, 6175], [8, 6512], [10, 6861], [12, 7198], [14, 7537], [16, 7875], [18, 8208], [20, 8543], [22, 8810], [24, 9075]],
  "W-5": [[20, 9049], [22, 9312], [24, 9575], [26, 9837]],
  "O-1": [[0, 3835], [4, 4985]],
  "O-2": [[0, 4416], [4, 6042], [6, 7028]],
  "O-3": [[0, 5122], [4, 5809], [6, 6242], [8, 6534], [10, 6822], [12, 6985]],
  "O-4": [[0, 5837], [4, 6741], [6, 7183], [8, 7531], [10, 7997], [12, 8441], [14, 8882]],
  "O-5": [[0, 6756], [4, 7558], [6, 7920], [8, 8225], [10, 8971], [12, 9426], [14, 9870], [16, 10315], [18, 10577], [20, 10835]],
  "O-6": [[0, 8139], [4, 8946], [6, 9264], [8, 9581], [10, 9905], [14, 11323], [16, 11834], [18, 12346], [20, 12855], [22, 13356], [26, 14076]],
  "O-7": [[0, 12165], [4, 12406], [6, 12651], [8, 13219], [10, 13484], [20, 14817], [22, 15340]],
  "O-8": [[0, 14620], [4, 14877], [6, 15392], [8, 15674], [10, 16224], [20, 18053]],
  "O-9": [[0, 19659]],
  "O-10": [[0, 20588]],
};

const MIL_GRADES = Object.keys(MIL_PAY_2025);
const MIL_YOS_OPTIONS = ["0","2","4","6","8","10","12","14","16","18","20","22","24","26","28","30"];

function lookupMonthlyPay(grade, yos) {
  const steps = MIL_PAY_2025[grade];
  if (!steps || !steps.length) return 0;
  let pay = steps[0][1];
  for (const [minYos, monthlyPay] of steps) {
    if (yos >= minYos) pay = monthlyPay;
  }
  return pay;
}

const SS_FACTORS = { 62: 0.7, 67: 1.0, 70: 1.24 };

function renderMilitary(root) {
  root.innerHTML = "";
  const m = state.inputs.military;
  const nameA = state.inputs.income.earnerAName || "Earner A";
  const nameB = state.inputs.income.earnerBName || "Earner B";
  const card = el("div", { class: "card stagger" });
  card.appendChild(el("h3", { class: "card-title", text: "Military & Benefits" }));

  const grid = el("div", { class: "form-grid" });

  // Pension auto-calc
  const pensionOut = readonlyField("Estimated Annual Pension:",
    formatDollars(m.high3 * (m.pensionMultiplierPct / 100)));
  const recalcPension = () =>
    pensionOut.set(formatDollars(m.high3 * (m.pensionMultiplierPct / 100)));

  // High-3 pay input (auto-populated by grade/YOS but still manually editable)
  const high3Input = boundInput("dollar", () => m.high3, (v) => (m.high3 = v), { onCommit: recalcPension });

  // Pay Grade dropdown — auto-populates high3 from 2025 pay table
  const gradeOptions = ["(manual)", ...MIL_GRADES];
  const gradeSelect = boundSelect(gradeOptions,
    () => m.high3PayGrade || "(manual)",
    (v) => {
      m.high3PayGrade = v === "(manual)" ? "" : v;
      if (m.high3PayGrade) {
        m.high3 = lookupMonthlyPay(m.high3PayGrade, m.high3Yos) * 12;
        high3Input.value = formatDollars(m.high3);
        recalcPension();
      }
      save();
    }
  );

  // Years of Service dropdown — re-looks up pay when grade is set
  const yosSelect = boundSelect(MIL_YOS_OPTIONS,
    () => String(m.high3Yos),
    (v) => {
      m.high3Yos = Number(v);
      if (m.high3PayGrade) {
        m.high3 = lookupMonthlyPay(m.high3PayGrade, m.high3Yos) * 12;
        high3Input.value = formatDollars(m.high3);
        recalcPension();
      }
      save();
    }
  );

  grid.appendChild(field("Pension Multiplier (%)",
    boundInput("percent", () => m.pensionMultiplierPct, (v) => (m.pensionMultiplierPct = v), { onCommit: recalcPension })));
  grid.appendChild(field("Pay Grade (2025 table)", gradeSelect));
  grid.appendChild(field("Years of Service", yosSelect));
  grid.appendChild(field("High-3 Annual Base Pay", high3Input,
    { note: "2025 pay table · select grade above or type to override" }));
  grid.appendChild(field("Estimated Annual Pension (auto-calc)", pensionOut.node));
  grid.appendChild(field("Pension Start Age",
    boundInput("number", () => m.pensionStartAge, (v) => (m.pensionStartAge = v))));
  grid.appendChild(field("VA Disability Rating (%)",
    boundInput("percent", () => m.vaRatingPct, (v) => (m.vaRatingPct = v))));
  grid.appendChild(field("Annual VA Disability — tax-free",
    boundInput("dollar", () => m.vaAnnual, (v) => (m.vaAnnual = v))));

  // CRDP toggle
  const toggle = el("div", { class: "toggle-group" });
  const yesBtn = el("button", { type: "button", text: "Yes" });
  const noBtn = el("button", { type: "button", text: "No" });
  const syncToggle = () => {
    yesBtn.classList.toggle("active", m.crdpEligible === true);
    noBtn.classList.toggle("active", m.crdpEligible === false);
  };
  yesBtn.addEventListener("click", () => { m.crdpEligible = true; syncToggle(); save(); });
  noBtn.addEventListener("click", () => { m.crdpEligible = false; syncToggle(); save(); });
  toggle.appendChild(yesBtn);
  toggle.appendChild(noBtn);
  syncToggle();
  grid.appendChild(field("CRDP Eligible", toggle,
    { note: "Concurrent Retirement & Disability Pay — eliminates the dollar-for-dollar VA offset against retirement pay. Requires 20+ yrs service and VA rating ≥ 50%. At 70% VA you qualify." }));

  // ---- Social Security: Earner A ----
  const ssABreakeven = () => {
    // Age at which delaying to 70 breaks even vs. claiming at 67
    // Extra monthly benefit = (1.24 - 1.0) * monthly67; foregone months = 36
    // Breakeven months = foregone / extra = 36 / 0.24 ≈ 150 months = 12.5 yrs → age 82.5
    if (!m.ssAFull67) return "";
    const monthly67 = m.ssAFull67 / 12;
    const monthly62 = monthly67 * 0.70;
    const monthly70 = monthly67 * 1.24;
    // Delay 67→70: give up 36 months × monthly67, gain (monthly70-monthly67)/mo after
    const be67to70 = 67 + (36 * monthly67) / (monthly70 - monthly67) / 12;
    // Claim 62→67: give up 60 months × monthly62, gain (monthly67-monthly62)/mo after
    const be62to67 = 67 + (60 * monthly62) / (monthly67 - monthly62) / 12;
    return `Break-even: claim 62 vs 67 → age ${be62to67.toFixed(1)} · claim 67 vs 70 → age ${be67to70.toFixed(1)}`;
  };

  const ssAOut = readonlyField(`Adjusted annual benefit (age ${m.ssAClaimAge}):`,
    formatDollars(m.ssAFull67 * SS_FACTORS[m.ssAClaimAge]));
  const recalcSSA = () => {
    ssAOut.set(formatDollars(m.ssAFull67 * (SS_FACTORS[m.ssAClaimAge] || 1)));
    ssABreakevenNote.textContent = ssABreakeven();
  };

  const ssABreakevenNote = el("div", { class: "field-note", text: ssABreakeven() });

  const ssAFull67Field = field(`${nameA} — Full Benefit at 67 (FRA)`,
    boundInput("dollar", () => m.ssAFull67, (v) => (m.ssAFull67 = v), { onCommit: recalcSSA }),
    { note: "Enter your Primary Insurance Amount from ssa.gov/myaccount — based on your earnings history." });
  grid.appendChild(ssAFull67Field);

  const ssAClaimField = field(`${nameA} — Claiming Age`,
    boundSelect(["62", "67", "70"], () => m.ssAClaimAge, (v) => (m.ssAClaimAge = Number(v)), { onCommit: recalcSSA }));
  ssAClaimField.appendChild(ssABreakevenNote);
  grid.appendChild(ssAClaimField);
  grid.appendChild(field(`${nameA} — Benefit (auto-calc)`, ssAOut.node));

  // ---- Social Security: Earner B ----
  const ssBBreakeven = () => {
    if (!m.ssBFull67) return "";
    const monthly67 = m.ssBFull67 / 12;
    const monthly62 = monthly67 * 0.70;
    const monthly70 = monthly67 * 1.24;
    const be67to70 = 67 + (36 * monthly67) / (monthly70 - monthly67) / 12;
    const be62to67 = 67 + (60 * monthly62) / (monthly67 - monthly62) / 12;
    return `Break-even: claim 62 vs 67 → age ${be62to67.toFixed(1)} · claim 67 vs 70 → age ${be67to70.toFixed(1)}`;
  };

  const ssBOut = readonlyField(`Adjusted annual benefit (age ${m.ssBClaimAge}):`,
    formatDollars(m.ssBFull67 * SS_FACTORS[m.ssBClaimAge]));
  const recalcSSB = () => {
    ssBOut.set(formatDollars(m.ssBFull67 * (SS_FACTORS[m.ssBClaimAge] || 1)));
    ssBBreakevenNote.textContent = ssBBreakeven();
  };

  const ssBBreakevenNote = el("div", { class: "field-note", text: ssBBreakeven() });

  const ssBFull67Field = field(`${nameB} — Full Benefit at 67 (FRA)`,
    boundInput("dollar", () => m.ssBFull67, (v) => (m.ssBFull67 = v), { onCommit: recalcSSB }),
    { note: "Enter the Primary Insurance Amount from ssa.gov/myaccount." });
  grid.appendChild(ssBFull67Field);

  const ssBClaimField = field(`${nameB} — Claiming Age`,
    boundSelect(["62", "67", "70"], () => m.ssBClaimAge, (v) => (m.ssBClaimAge = Number(v)), { onCommit: recalcSSB }));
  ssBClaimField.appendChild(ssBBreakevenNote);
  grid.appendChild(ssBClaimField);
  grid.appendChild(field(`${nameB} — Benefit (auto-calc)`, ssBOut.node));

  card.appendChild(grid);
  root.appendChild(card);
}

/* ================================================================== *
 * Sub-tab registry + dispatcher
 * ================================================================== */

const RENDERERS = {
  income: ["sub-income", renderIncome],
  liquid: ["sub-liquid", renderLiquid],
  alternatives: ["sub-alternatives", renderAlternatives],
  realestate: ["sub-realestate", renderRealEstate],
  debt: ["sub-debt", renderDebt],
  military: ["sub-military", renderMilitary],
};

// Render one sub-tab into its container (idempotent — clears first).
export function renderSubTab(key) {
  const entry = RENDERERS[key];
  if (!entry) return;
  const [containerId, renderer] = entry;
  const root = document.getElementById(containerId);
  if (root) renderer(root);
}
