# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases are named after the edit round rather than semantic versions. The app
remains a single self-contained `index.html` — vanilla JS, no dependencies,
no build step.

## [Fable Edit 1.1] — 2026-07-07

### Added
- **Fee waterfall breakdown** — pure-CSS cascading bars decomposing Your Price
  into referral fee → FBA base fee → fuel surcharge → COGS → inbound/prep/storage
  → PPC → returns/overhead → net margin, each labelled with its dollar amount;
  the net segment renders green (profit) or red (loss). Backed by a
  `feeWaterfall()` pure function with a sum-to-price invariant.
- **What-if solver** — inverts the pricing solver: lock a desired selling price
  and target margin to solve the maximum allowable COGS (with headroom / over-budget
  gap vs current COGS), or lock COGS + margin to solve the minimum viable price
  (reusing the main solver, plus a new unrounded `solveMinPriceRaw()`). The
  round-trip property (COGS from price, then price from that COGS, returns the
  original within $0.01) is covered by tests in both directions.
- **CSV import validation report** — rows are validated before import
  (`validateCSVRow()`): missing required fields, non-numeric COGS/margin/weight,
  unknown category, bad size tier. Malformed rows are skipped and reported in a
  post-import modal — "Imported X · Updated Y · Skipped Z" with an expandable
  per-row error list — instead of being silently dropped.
- **Plain-language kill-signal explanations** — `checkKillSignals()` now returns
  structured signals and a new pure `explainSignal()` renders the full reason
  sentence with the actual numbers ("ACoS 42% has exceeded break-even ACoS 31%
  for 95 days in Stage 3 (threshold: 90 days)…") plus a `RULE:` tag naming the
  threshold constant that fired.
- **Sample product badging** — the empty-state "Load sample product" (cast-net
  product with 5 historical check-ins) is clearly badged SAMPLE in the sidebar
  and product view, with one-click removal (no confirm; reversible via the
  standard Undo toast).
- **Side-by-side tier comparison** — one table comparing List / Your Price /
  Sale / Clearance: price, delta vs Your Price, net profit $/unit and net
  margin % per tier, fees recomputed at each tier price.
- **Sidebar product search** — filter by name or ASIN as you type, with a live
  "X of Y products" count; Escape clears; appears only at 6+ products.
- **Dark/light theme toggle** — all 58 component colors converted to CSS
  variables swapped on a root class (`html.light`); persisted in localStorage
  and following `prefers-color-scheme` on first visit. No component styles forked.
- **Auto-backup nudge** — a dismissible banner suggests Export JSON when there
  are products and no export for 30 days (`BACKUP_NUDGE_DAYS`); dismissing
  snoozes it for 7 days (`BACKUP_SNOOZE_DAYS`).

### Changed
- **Fee-table versioning** — all FBA fee numbers (weight tables, oversize flat
  rates, over-48oz formula, 3.5% fuel surcharge) now live in one dated
  `FEE_SCHEDULE` structure (`effectiveFrom: "2026-01-15"`); future Amazon rate
  changes are a single block swap (procedure in LOGIC.md §1.4). Structural
  only — **no fee values changed**.

Tests: 213 → **302** (`npm test`).

## [Fable Edit 1.0] — 2026-07-07

### Added
- **Mobile responsiveness (<640px)** — sidebar becomes a hamburger drawer, form
  grids stack to one column, the product modal goes full-screen with a sticky
  footer, the stage timeline scrolls horizontally, and all tap targets are ≥44px.
- **Keyboard shortcut `N`** — opens the Add Product modal (ignored while typing
  or when a modal is open).
- **Modal focus management** — Tab is trapped inside open modals, Escape closes
  them, and focus returns to the triggering element.
- **Undo for check-ins** — deleting (or adding) a check-in shows an 8-second
  Undo toast instead of a confirm dialog; undo restores the record at its
  original position.
- **Price sensitivity table** — profit $ and margin % at Your Price −$2…+$2 with
  fees recomputed per row, making the $10/$50 FBA price-band cliffs visible.
- **Break-even units/month** — fixed monthly overheads ÷ contribution margin
  per unit.
- **CNY→USD landed cost calculator** — CNY unit price + exchange rate + duty % +
  freight → USD landed cost, with "Use as COGS" filling goods+duty into COGS and
  freight into Inbound Shipping.

Tests: 180 → **213**.
