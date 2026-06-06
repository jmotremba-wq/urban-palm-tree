# urban-palm-tree — Personal Finance Dashboard

A vanilla HTML/CSS/JS personal finance dashboard. **No build step, no
frameworks, no npm** — just static files served directly (open `index.html`
locally or host on GitHub Pages).

## Status

This is the foundation pass: the app shell/navigation plus a fully functional
**Inputs hub**. The other five sections (Dashboard, Tax Projector, Retirement
Modeler, Scenarios, Export) are on-theme "Coming soon" placeholders to be built
in future passes.

### Inputs hub (functional)

Six sub-tabs, each a form bound to a single state object:

- **Income** — salaries, bonus (with auto-calc), withholding, marginal rate,
  filing status, standard deduction.
- **Liquid Investments** — dynamic accounts table with live "Total Liquid", plus
  a collapsible Taxable Concentration table with live per-holding %.
- **Alternative & Illiquid** — private units/funds, gold/silver (auto-calc
  value), bitcoin, reward points.
- **Real Estate** — three collapsible property cards (Primary / Rental / Farm)
  with auto-calc equity, gains, and net income.
- **Debt** — dynamic debt table with live total balance / monthly / annual
  service footers.
- **Military & Benefits** — pension, VA disability, CRDP, and Social Security
  with claiming-age auto-calc.

## Data & privacy

- All data is **local-only**: it persists to your browser's `localStorage` under
  the key `financeApp_v1`, written as one debounced JSON object. Nothing leaves
  your machine and there is no backend.
- All seeded values are **generic placeholders** ("Earner A", "Primary
  Residence", "Taxable Brokerage", round example numbers) — not real data.

## File structure

| File          | Purpose                                                        |
| ------------- | ------------------------------------------------------------- |
| `index.html`  | Markup, nav scaffolding, placeholder sections, font links.    |
| `styles.css`  | Dark finance-terminal theme (CSS variables, fade-in stagger). |
| `utils.js`    | Formatting + financial-math helpers (`futureValue`, etc.).    |
| `state.js`    | Single source-of-truth state, seed defaults, load/save.       |
| `inputs.js`   | Renders the six Inputs sub-tabs and dynamic tables.           |
| `app.js`      | Shell: tab + sub-tab navigation, persistence, bootstrap.      |

## Running

Open `index.html` directly in a browser, or serve the directory statically
(e.g. GitHub Pages). ES modules are used, so when serving locally use a static
server (`python3 -m http.server`) rather than the `file://` protocol if your
browser blocks module loads from disk.
