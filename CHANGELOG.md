# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases are named after the edit round rather than semantic versions. The app
remains a single self-contained `index.html` — vanilla JS, no dependencies,
no build step.

## [Import & Guardrails Round] — 2026-08-30

### Changed (2026-08-30)
- **Sale Planner guide modal is now actionable** — every step in `#planner-howto-modal`
  that names a button carries a small `topbar-btn` that performs it: step 1 **Import
  CSV/XLSX** (`#csv-file`) + **⚡ Load bundled catalog** (`loadBundledCatalog()`), step 2
  **⬆ Import Amazon Reports** (`#amz-report-file`), step 3 **⬆ Import Inventory**
  (`#fba-preview-file`), step 4 **Import shipments xlsx** (`#shipments-file`). Each picker
  closes the modal before opening the OS file dialog so the dialog is never stacked under
  the overlay.
- **Direct Seller-Central report links in the guide** — steps that require a download link
  straight to the report (step 2 → Business / Ads / Inventory Health, step 3 → Fee
  Preview). The anchors are populated from the single `AMZ_REPORT_LINKS` constant in
  `openModalEl()` (via a `data-amzlink` key), so URLs never drift from the app's other uses.
- **Step-1 NOTE spells out the floorless lesson** — the bundled seed covers products up to
  2026-07-18; a CIF workbook only covers products existing at its export date; import BOTH
  (bundled seed first, newest workbook on top) and request a fresh CIF export whenever the
  floorless warning names products.
- **Warning banners now carry their remedy** — the floorless planner banner gained an inline
  **⚡ Load bundled catalog** button plus "then re-import the team's newest CIF workbook —
  see ❓ How to use"; the stale / missing Inventory-snapshot banners gained a direct
  **↗ Open Inventory Health report** link; and the floorless export `confirm()` appends
  "Fix: load the bundled catalog (⚡) and import the newest CIF workbook, then re-open the
  planner." (all bilingual). After a real incident where an April-only CIF import left 29
  sale rows floorless and the warning offered no way out.

### Added (2026-08-30)
- **Sale Planner "❓ How to use" guide** — a button in the Sale Planner header opens an
  in-app modal with the step-by-step monthly SOP (costs → three reports → FBA Fee Preview
  → optional shipments → review → export), bilingual and quoting the exact UI button
  names, reusing the existing "? Guide" flow-modal styling; footer links to 📐 Pricing
  Rules for the full spec.
- **Fee Preview import updates existing products** — size tier and weight are now
  backfilled onto catalog products (including report-created stubs that carried the
  default ss/8oz), fixing understated break-even floors; the import summary reports
  created / updated / skipped.
- **Product / CIF import accepts `.xlsx` and `.xlsm`** — the `#csv-file` input now takes
  workbooks as well as CSVs, read with the existing zero-dependency `readXlsxFirstSheet()`
  (**first sheet only**; the partner file's sheets 2-3 are unrelated reference data).
  Both formats funnel through one shared importer, `importProductRows()`, so validation,
  defaults and the post-import report are identical either way.
- **Header aliases for the partner CIF workbook** — new pure `aliasProductHeaders()` +
  `PRODUCT_HEADER_ALIASES` map its real sheet-1 headers
  (`Merchant SKU, ASIN, FNSKU, model_name, CIF`) onto app columns: `CIF` → `cogs`,
  `model_name` → `name`, `Merchant SKU` → a new optional `sku` column, `ASIN` → `asin`;
  `FNSKU` is ignored. RULE: cogs arriving via the `CIF` alias also forces
  `inbound_shipping = 0` (`headersCarryCIF()`) — CIF is a landed cost that already
  includes freight, so the $0.50 default would count it twice.
- **Stale-inventory guard (Sale Planner + export)** — new pure `inventorySnapshotAge()`
  reports the newest Inventory Health `snapshotDate` and its age in days. The planner
  shows a warning banner when the snapshot is missing or more than `INVENTORY_STALE_DAYS`
  (7) old, and `exportPriceFile()` prepends the warning to the export summary **and**
  requires a `confirm()` before building the file. Fixes the silent path that produced a
  price plan off a 29-day-old snapshot.
- **No-cost-floor guard** — new pure `floorlessCount()` counts rows selected for export
  whose product has `cogs <= 0` (no break-even floor). The planner banners them, and the
  export lists the affected SKUs in the summary behind a `confirm()` naming the count.
  Deliberately not a hard block — easy mode stays supported — but floorless rows can no
  longer ship unseen.
- **Fee Preview misfile is named explicitly** — new pure `looksLikeFeePreview()` detects an
  FBA Fee Preview export dropped into the weekly report import (headers compared in
  `normalizeHeaders()` form) and the summary now says the file contains no stock or
  velocity data and points at **⬆ Import Inventory** plus the Inventory Health report.
  Previously it vanished into a generic "unrecognized" line.

### Changed (2026-08-30)
- **Month-end roll threshold 3 → 7 days** (`defaultSaleEndYmd`) — a sale window shorter
  than a week is never the intent of a month-end sale plan; with fewer than 7 days left
  the user is planning NEXT month. An Aug 29 export previously produced a 3-day
  Aug 29 → Aug 31 sale.
- README documents Inventory Health as **required** for the planner, the direct CIF-xlsx
  import, and the two export confirms. LOGIC.md gains §11.0 (file formats + aliases), the
  Fee Preview note in §18.2, and §19.5 (export guards); §11.2, §19.1.6 and §19.3 updated.

Tests: 519 → **573** (`npm test`).

## [Pricing Rules Round] — 2026-08-06

### Added (2026-08-06) — Pricing Rules viewer & edit loop
- **📐 Pricing Rules viewer** — a new modal (`rules-modal`) that shows, in plain
  language, every rule behind the price/sale calculations: how a sale price is
  decided, the discount ladder, the guardrails (break-even floor, loss-leader /
  promo-eroded exclusions, runway guard, sale window), inventory status thresholds,
  price-tier derivations, and fee assumptions. Opened from the Sale Planner controls
  card (next to 📄 Review Report) and from the Strategy Guide "2026 Rules" sub-panel.
  Bilingual (follows the app language).
- **Truth-by-construction** — `rulesLiveData()` reads the *actual* live constants
  (`SALE_LADDER`, `PLANNER_COVER_THRESHOLD_DEFAULT`, the live `state.planner.coverThreshold`,
  `FEE_SCHEDULE`, the price-tier constants, …), never a hardcoded copy, and feeds them to
  the pure renderer `buildRulesHtml()` — so the in-app summary can never drift from what
  the engine actually does.
- **Downloadable rules document (the edit loop)** — the modal fetches and renders
  `LOGIC.md` (relative path first, `raw.githubusercontent` fallback — mirrors
  `loadRoadmap()`), with **⬇ Download rules document** (saves `pricing-rules-LOGIC.md`)
  and **↗ View on GitHub** buttons. The workflow: download → edit thresholds/rules in
  plain language → hand the edited file to Claude (or any coding agent) with the
  instruction to update `index.html` to match (every rule carries a CODE LOCATION
  reference). The proposal report's methodology now points at the same viewer.
- New pure function `buildRulesHtml()` is mirrored + tested; `rulesLiveData()`,
  `openRulesModal()`, `downloadRulesDoc()`, and `fetchRulesDoc()` read state/DOM/network
  and are (deliberately) not mirrored.

Tests: 501 → **519** (`npm test`).

## [Weekly Ops Round] — 2026-07-31

### Added
- **Direct report links** — the three weekly Amazon exports (Business Report,
  Advertising "Advertised product", Inventory Health) are now one click away
  from the import card and the Sale Planner; the step-by-step navigation guide
  is kept as a collapsible backup in case Amazon changes the URLs.
- **Multi-select Amazon report import** — select all 3 CSVs in one file dialog;
  each file's type is auto-detected from its real 2026 export headers
  (`(Child) ASIN`/`Ordered Product Sales`, `Advertised product ID`/`Total cost`,
  `your-price`/`units-shipped-tN`). One merged check-in per product per batch.
  Old single-report formats still import.
- **Flexible report dates** — the Advertising report's per-row `Date range` is
  parsed (min start / max end across campaigns); Business Reports carry no dates
  so the app asks how many days the range covers (default 30); check-ins store
  `periodDays` and velocity/days-of-cover are computed over the real window.
- **Price auto-fill from Inventory Health** — `your-price` / active `sales-price`
  now pre-fill the check-in price (the old "price is never in any export" note
  was true only of the legacy inventory file). ASIN→SKU mapping is captured for
  the price-feed export and shipments matching.
- **Realized-price tracking** — average actual transaction price per 7/30/60/90-day
  window (`sales-shipped ÷ units-shipped`) shown as a trend in the Sale Planner;
  flags products selling below Your Price with no sale set ("deal/coupon?") and
  refuses to deepen discounts on anything already selling below break-even via promos.
- **Optional incoming-shipments import** — the team's 总体控制表 `.xlsx` uploads
  directly (zero-dependency ZIP/XLSX reader using `DecompressionStream`); matched
  by Merchant SKU; feeds the planner's inbound-pipeline column and the
  recommended-action hints.
- **Sale Planner** — new top-bar view: per-product Your Price, realized price
  trend, velocity, stock, days of cover, inbound pipeline, margin; suggests
  month-end sale prices anchored on Your Price with a days-of-cover discount
  ladder (5% > 120d cover up to 20% > 365d / no-sales), floored at break-even
  when COGS is known (easy mode = no COGS: ladder only). Loss leaders
  (Your Price below break-even) are excluded by default. Prices/inclusion
  editable per row; threshold configurable.
- **Amazon price-feed export** — generates a real `.xlsx` (zero-dependency
  STORED-zip writer) cloning the PriceAndQuantity template byte-for-byte
  (settings row, label row 4 / attribute row 5 / data row 7): SKU + Sale Price
  + start/end dates, ready for Seller Central → Add Products via Upload.
  Sale end defaults to the last day of the current month — rolling to next
  month's end when fewer than 3 days remain.
- **Cost-data record** — the latest products/CIF CSV import (filename, date,
  rows) is recorded and displayed in the Sale Planner freshness row.

### Added (2026-08-02) — zero-setup catalog bootstrap
- **Auto-create missing products from reports** — the weekly import now offers to
  create products for ASINs it can't match (names/SKUs come straight from the
  reports' `Title` / `product-name` columns; COGS starts at 0 so the Sale Planner
  runs them in easy mode until CIF costs are imported). An empty catalog no longer
  blocks the weekly routine.
- **⚡ Load my catalog** — one-click button (empty state, import card, Sale Planner)
  that loads the bundled CIF seed CSV shipped with the app (works on the deployed
  site; falls back to Import CSV guidance when opened from disk).
- **Fee Preview catalog-export link** — direct Seller Central link (Report Central →
  Fee Preview) surfaced in the import card, Workflows catalog setup, the planner
  empty state, and the import summary's unmatched-ASIN section, feeding the existing
  ⬆ Import Inventory stub-creation flow.

### Changed
- `getInventoryStatus()` takes a `periodDays` argument (default 30); check-in
  history and CSV export show the actual period.

### Changed (same day)
- **Pipeline-aware Sale Planner cover** — the sale decision now reads *pipeline
  cover* `(sellable + inbound + AWD) ÷ velocity`, not just on-hand stock, so
  fat-inbound items are no longer under-discounted (real-data analysis missed
  ~31 candidates). The discount ladder rung is chosen from pipeline depth.
- **Runway guard (`SALE_MIN_RUNWAY_DAYS` = 45)** — a row that only qualifies for
  a sale because of its inbound pipeline but has under 45 days of *on-hand*
  sellable stock now gets a new `wait/thin_stock_inbound` action ("wait for
  inbound, then discount") instead of being discounted into a stockout. The
  Cover column shows an `+inbound: Nd` line, there's an amber WAIT badge and a
  "wait for inbound" summary chip, and wait rows sort just below sale candidates.
  Rows with no inbound pipeline are byte-identical to the previous model.

### Added (2026-08-03) — Sale Proposal review report
- **📄 Review Report** — every price plan now generates a polished, self-contained
  HTML "Month-End Sale Proposal" document (light professional palette, stat strip,
  striped tables, human-judgment callouts, print CSS). It explains the three prices
  (normal / past / new), the discount ladder and four guardrails (all parameterised
  from the code constants so the doc never drifts), the full proposals table with
  per-row reasoning (at-cost floors, "manually adjusted" overrides, "⚠ above the
  currently running sale price"), the "wait for inbound" hold list, freshness of every
  data source, and the monthly routine. A print toolbar (hidden when printing) offers
  🖨 Save as PDF. Bilingual (follows the app language).
- **Auto-report on export** — `exportPriceFile()` also produces the review report:
  it opens in a new tab next to the `.xlsx` download (a second programmatic download
  in the same click is silently dropped by Chromium's multiple-download policy, so
  the tab is the reliable channel; a download of
  `PriceUpdate-Sale-<end>-report.html` is the fallback when popups are blocked).
- **`collectPlanItems()`** — a single shared source of truth for which rows ship and at
  what effective price, used by both the `.xlsx` export and the report model, so the two
  can never describe a different set of SKUs. `exportPriceFile()` was refactored onto it
  (behaviour identical).
- New pure functions `escHtml()` and `buildProposalReportHtml()` are mirrored + tested;
  `buildProposalModel()` assembles them from state.

Tests: 466 → **501** (`npm test`).

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
