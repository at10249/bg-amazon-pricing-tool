# Amazon FBA Pricing Tool

A self-contained, single-file web app for Amazon FBA sellers to calculate pricing tiers,
track product lifecycles, manage advertising stages (m19 compatible), and decide when to
kill or continue products.

No server required. No build step. No dependencies. Open `index.html` in any browser.

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
- **Periodic check-ins** — record current price, ACoS, ad sales, revenue, current inventory
  and units sold; tool labels current price vs tiers and tracks progress over time
- **Inventory & sales velocity tracking** — enter current stock + units sold per check-in and
  the tool computes sales velocity (units/day) and days of inventory cover, with reorder-now /
  plan-reorder / overstock-risk badges
- **Kill/continue signals** — automatic flags when products hit kill thresholds,
  with documented reasoning
- **Manufacturer mode** — enter landed cost + margin to see minimum viable Amazon price
  and all price tiers; share with your supplier to align on unit pricing
- **CSV import** — upload a sheet of ASINs with product data to bulk-add products
- **Amazon report import** — upload a Business Report, Advertising Report, or Inventory
  Report from Seller Central; the tool auto-detects the type and fills in a weekly check-in
  by matching ASIN
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
ppc_per_unit, returns_allowance, vine_enrolled, vine_units, annual_units, other_overhead,
target_acos, launch_acos, cvr, notes
```

**Category values:** `home`, `beauty`, `grocery`, `apparel`, `shoes`, `electronics`,
`computers`, `camera`, `pc`, `appliances`, `jewelry`, `watches`, `giftcards`,
`amazon_accessories`, `books`

**Size tier values:** `ss` (small standard), `ls` (large standard), `lb` (large bulky), `xl` (extra-large)

A template file `products-template.csv` is included in this repo.

**Seeding from a CIF / landed-cost file:** if your cost data is a CIF (Cost, Insurance,
Freight) figure that already includes inbound freight, set `cogs` to that figure and
`inbound_shipping` to `0` — otherwise freight gets counted twice. See LOGIC.md Section 11
for the full note on what CIF terms typically do and don't cover.

---

## Amazon Report Import (weekly check-ins)

For the recurring weekly routine — pricing, inventory and sales velocity — use **Import
Amazon Report CSV** in the Check-ins tab instead of re-typing everything by hand. The tool
auto-detects which of these three reports you uploaded and matches rows to products by ASIN:

| Report | Where to export it | Fills |
|---|---|---|
| Business Report | Seller Central → Reports → Business Reports → Detail Page Sales and Traffic by ASIN | Total Revenue, Units Sold (velocity), CVR |
| Advertising Report | Advertising Console → Reports → Create Report → Sponsored Products → Advertised Product | ACoS, Ad Spend, Ad Sales |
| Inventory Report | Seller Central → Inventory → Manage All Inventory → Download Inventory File (or FBA Fee Preview) | Current Inventory (units) |

Import all three before recording a check-in so every field is pre-filled. **Current
price is never in any Amazon export** — read it off the live listing and enter it manually.

Once a check-in has both `Current Inventory` and `Units Sold`, the tool computes sales
velocity (units/day) and days of inventory cover, and flags stockout risk, reorder-soon,
or overstock in the check-in history.

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
