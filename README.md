# Amazon FBA Pricing Tool

A self-contained, single-file web app for Amazon FBA sellers to calculate pricing tiers,
track product lifecycles, manage advertising stages (m19 compatible), and decide when to
kill or continue products.

No server required. No build step. No dependencies. Open `index.html` in any browser.

Release history: see **[CHANGELOG.md](CHANGELOG.md)**.

---

## Fable Edit — 2026-07-07

### Round 2 (Fable Edit 1.1)

Ten improvements shipped in a second round (still a single dependency-free `index.html`):

- **Fee waterfall** — cascading cost bars from Your Price down to net profit,
  every segment labelled in dollars (referral, FBA, fuel surcharge, COGS,
  logistics, PPC, returns/overhead); net margin green/red
- **What-if solver** — lock price + margin to solve the max allowable COGS
  (with gap vs your current COGS), or lock COGS + margin to solve the min price
- **CSV import validation report** — malformed rows are no longer skipped
  silently: "Imported X · Skipped Z" summary with an expandable per-row error
  list (row number, field, reason)
- **Kill signals in plain language** — full reason sentences with the actual
  numbers and the RULE threshold that fired, not just a badge
- **Sample product badging** — the empty-state sample is clearly marked SAMPLE
  with one-click removal
- **Tier comparison table** — List / Your Price / Sale / Clearance side by side
  with per-tier net profit $ and margin %
- **Sidebar search** — filter products by name/ASIN (appears at 6+ products)
- **Dark/light theme toggle** — persisted, follows your OS setting on first visit
- **Auto-backup nudge** — reminds you to Export JSON after 30 days without a backup
- **Versioned fee schedule** — all FBA fee numbers in one dated `FEE_SCHEDULE`
  block; future Amazon rate changes are a single block swap (LOGIC.md §1.4)

Tests: 213 → 302 (`npm test`).

### Round 1 (Fable Edit 1.0)

Seven Near-Term roadmap items shipped (still a single dependency-free `index.html`):

- **Mobile responsiveness (< 640px)** — sidebar becomes a hamburger drawer, form grids
  stack to one column, the product modal goes full-screen with sticky footer buttons,
  the stage timeline scrolls horizontally, and all tap targets are ≥ 44px
- **Keyboard shortcut `N`** — opens the Add Product modal (ignored while typing or
  when a modal is already open)
- **Modal focus management** — Tab is trapped inside open modals, Escape closes them,
  and focus returns to the triggering element
- **Undo for check-ins** — deleting (or adding) a check-in shows an 8-second Undo
  toast instead of a confirm dialog; undo restores the record at its original position
- **Price sensitivity table** — profit $ and margin % at Your Price −$2…+$2, with fees
  recomputed per row so the $10/$50 FBA band cliffs are visible; current row highlighted
- **Break-even units/month** — fixed monthly overheads ÷ contribution margin per unit
- **Landed cost calculator** — CNY unit price + exchange rate + duty % + freight →
  USD landed cost inside the product modal; "Use as COGS" fills goods+duty into COGS
  and freight into Inbound Shipping

All new logic is documented in LOGIC.md (Sections 8 and 15) with `// RULE:` comments,
covered by tests (`npm test` — 213 tests), and fully bilingual (EN/ZH).

---

## Quick Start

1. Download or clone this repo
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge)
3. That's it

---

## Features

- **Pricing calculator** — calculates all four price tiers (List Price, Your Price, Sale Price,
  Clearance Price) from your costs and target margin, using real 2026 Amazon fee tables
- **Full cost model** — referral fees by category, FBA fees by size/weight/price band,
  fuel surcharge, plus all hidden costs (inbound shipping, prep, storage, PPC, returns, Vine, etc.)
- **Multi-product tracker** — add multiple ASINs with a sidebar tab per product
- **Lifecycle stages** — tracks each product through Pre-Launch → Stage 1 → Stage 2 →
  Stage 3 → Stable → Kill Review
- **m19 advertising engine** — stage-by-stage guidance for Force Product Visibility,
  Monthly Budget, and ACoS Target modes, with graduation checklists and Vine-aware logic
- **Periodic check-ins** — record current price, ACoS, ad sales, revenue; tool labels
  current price vs tiers and tracks progress over time
- **Kill/continue signals** — automatic flags when products hit kill thresholds,
  with documented reasoning
- **Manufacturer mode** — enter landed cost + margin to see minimum viable Amazon price
  and all price tiers; share with your supplier to align on unit pricing
- **CSV import** — upload a sheet of ASINs with product data to bulk-add products
- **Export/Import JSON** — portable data backup; copy between devices
- **English / Chinese UI** — toggle between languages with one click
- **USD / CNY display** — toggle currency display (all calculations stay in USD)

---

## Data Storage

Your data is saved automatically in your browser's **localStorage**. This means:

- Data persists between browser sessions on the same device
- Data is NOT shared between different browsers or devices
- Clearing browser data / cookies will erase it

**To back up or move your data:**
1. Click **Export JSON** in the top bar
2. Save the downloaded file somewhere safe
3. On a new device: click **Import JSON** and select the file

**Data schema version:** v1. If the schema changes in future versions, a migration
function will be added. Your export files are always readable.

---

## CSV Import

To bulk-add products, prepare a CSV with these columns:

**Required:**
```
name, asin, category, size_tier, weight_oz, cogs, target_margin
```

**Optional** (omit column = use default typical values):
```
inbound_shipping, inbound_placement, prep_labelling, storage, q4_storage,
ppc_per_unit, returns_allowance, vine_enrolled, vine_units, other_overhead,
target_acos, launch_acos, cvr, notes
```

**Category values:** `home`, `beauty`, `grocery`, `apparel`, `shoes`, `electronics`,
`computers`, `camera`, `pc`, `appliances`, `jewelry`, `watches`, `giftcards`,
`amazon_accessories`, `books`

**Size tier values:** `ss` (small standard), `ls` (large standard), `lb` (large bulky), `xl` (extra-large)

A template file `products-template.csv` is included in this repo.

---

## Modifying Business Rules

All business logic is documented in **LOGIC.md** with exact code locations.

If you need to update fee tables, change stage thresholds, switch ad platforms, or adjust
kill criteria, either:

1. Edit `index.html` directly using LOGIC.md as your guide
2. Paste the relevant section of LOGIC.md into an LLM with the instruction:
   *"Update index.html to reflect this change: [your change]"*

The code uses `// RULE:` comments throughout so you can `Ctrl+F RULE:` to find every
decision point.

---

## Using with a Different Ad Platform

The advertising stage engine is built for **m19** but the logic applies to any AI bid
optimiser with equivalent modes. See LOGIC.md Section 5 for how to swap platform names
and adjust stage logic without changing the underlying graduation criteria.

---

## Contributing

This is designed to be forked and modified. A few guidelines:

- Keep it as a single `index.html` file — this makes it easy to share and run anywhere
- Document any new business rules in LOGIC.md with the same format
- Use `// RULE:` comments for any new decision constants
- If you change the data schema, increment the version in `STORAGE_KEY` and add a migration function

---

## Fee Table Sources

- Amazon referral fees: [Seller Central Fee Schedule](https://sellercentral.amazon.com/help/hub/reference/external/G200336920)
- FBA fulfillment fees: [Seller Central FBA Fees](https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW)
- Fuel surcharge: Amazon announcement effective April 17, 2026
- All rates confirmed as of June 2026. Amazon may update fees mid-year — check Seller Central.

---

## License

MIT — do whatever you want with it.
