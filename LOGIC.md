# Amazon FBA Pricing Tool — Business Logic Documentation

This file documents every business rule, threshold, and decision in the application.
It is written for LLM modification. If a rule changes (e.g. Amazon updates fee tables,
you switch ad platforms, or thresholds need tuning), paste the relevant section into
an LLM with the instruction "update this rule in index.html" and it will find the
correct location using the CODE LOCATION references.

---

## 1. FEE TABLES

### 1.1 Amazon Referral Fees by Category
**Source:** Amazon Seller Central, confirmed frozen for 2025 and 2026.
**CODE LOCATION:** `index.html` → function `getReferralFee(catKey, price)`
**Last verified:** April 2026

Rules:
- Most categories: flat 15% of selling price, minimum $0.30
- Beauty & Personal Care: 8% if price < $10, else 15%
- Grocery & Gourmet: 8% if price < $15, else 15%
- Apparel & Accessories: 5% if ≤$15, 10% if $15–$20, 17% if >$20
- Shoes & Handbags: 5% if ≤$75, 10% if $75–$150, 15% if >$150
- Electronics: 8%
- Computers: 8%
- Camera & Photo: 8%
- Personal Computers: 6%
- Major Appliances: 7.5%
- Jewelry: 20% on first $250, 5% on amount above $250, minimum $0.30
- Watches: 16% up to $1,500, 3% above $1,500, minimum $2.00
- Gift Cards: 20% (no minimum)
- Amazon Device Accessories: 45%, minimum $0.30
- Books/Media: 15% + $1.80 per-item closing fee

**TO UPDATE:** Find `getReferralFee` in index.html and modify the switch-case.
If adding a new category, add a new `case` with the category key and rate logic.

---

### 1.2 FBA Fulfillment Fees — Standard Size (2026 rate card)
**Source:** Amazon Seller Central fee schedule, effective January 15, 2026
**CODE LOCATION:** `index.html` → versioned constant `FEE_SCHEDULE` (all FBA fee numbers), aliases `SS_TABLE`/`LS_TABLE`, function `getFBAFee(tier, wOz, price)`
**Last verified:** April 2026

Structure: fees are indexed by [max_weight_oz, price_band_<$10, price_band_$10-$50, price_band_>$50]

Small Standard (up to 16oz, fits in a shoebox):
| Max oz | <$10  | $10–$50 | >$50  |
|--------|-------|---------|-------|
| 2      | $2.43 | $3.32   | $3.58 |
| 4      | $2.49 | $3.42   | $3.68 |
| 6      | $2.56 | $3.45   | $3.71 |
| 8      | $2.66 | $3.54   | $3.80 |
| 10     | $2.77 | $3.68   | $3.94 |
| 12     | $2.82 | $3.78   | $4.04 |
| 14     | $2.92 | $3.91   | $4.17 |
| 16     | $2.95 | $3.96   | $4.22 |

Large Standard (up to 20lb):
| Max oz | <$10  | $10–$50 | >$50  |
|--------|-------|---------|-------|
| 4      | $2.91 | $3.73   | $3.99 |
| 8      | $3.13 | $3.95   | $4.21 |
| 12     | $3.38 | $4.20   | $4.46 |
| 16     | $3.78 | $4.60   | $4.86 |
| 20     | $4.22 | $5.04   | $5.30 |
| 24     | $4.60 | $5.42   | $5.68 |
| 28     | $4.75 | $5.57   | $5.83 |
| 32     | $5.00 | $5.82   | $6.08 |
| 36     | $5.10 | $5.92   | $6.18 |
| 40     | $5.28 | $6.10   | $6.36 |
| 44     | $5.44 | $6.26   | $6.52 |
| 48     | $5.85 | $6.67   | $6.93 |
| 3lb+   | $6.15 + $0.08/4oz above 48oz | $6.97 + $0.08/4oz | $7.23 + $0.08/4oz |

Large Bulky (was Oversize Small/Medium): $9.61 / $10.10 / $10.84 by price band
Extra-Large (<50lb): $26.33 / $27.12 / $28.01 by price band

**TO UPDATE:** See Section 1.4 — all FBA fee numbers live in the single `FEE_SCHEDULE` block.

---

### 1.3 Fuel & Logistics Surcharge
**Source:** Amazon announcement, effective April 17, 2026
**CODE LOCATION:** `index.html` → constant `FUEL_SURCHARGE` (read from `FEE_SCHEDULE.tables.FUEL_SURCHARGE`), applied everywhere as `surcharge ? FUEL_SURCHARGE : 1.0` on top of the FBA base fee
**Rate:** 3.5% on top of all FBA fulfillment fees (multiplier `1.035`)

**TO UPDATE:** Change `FUEL_SURCHARGE` inside the `FEE_SCHEDULE` block (Section 1.4).
E.g. if the surcharge becomes 4%, set it to `1.04`.

---

### 1.4 Fee Schedule Versioning — how to update rates
**CODE LOCATION:** `index.html` → constant `FEE_SCHEDULE`

All FBA fulfillment fee numbers are wrapped in ONE dated structure:

```js
const FEE_SCHEDULE = {
  effectiveFrom: '2026-01-15',              // rate card effective date
  fuelSurchargeEffectiveFrom: '2026-04-17', // surcharge start date
  tables: {
    SS: [...],                  // Small Standard rows: [max_oz, <$10, $10–$50, >$50]
    LS: [...],                  // Large Standard rows (same shape)
    LS_OVER_48OZ_BASES: [...],  // 3lb+ base fee by price band
    LS_OVER_48OZ_STEP: 0.08,    // added per 4oz above 48oz
    LB: [...],                  // Large Bulky flat rates by price band
    XL: [...],                  // Extra-Large flat rates by price band
    FUEL_SURCHARGE: 1.035       // multiplier on every FBA fee
  }
};
```

**Update procedure when Amazon changes rates:**
1. Get the new rate card from Seller Central (see README "Fee Table Sources").
2. Replace the entire `FEE_SCHEDULE` block with the new numbers and set
   `effectiveFrom` to the new rate card's effective date.
3. Do NOT edit fee numbers anywhere else — `getFBAFee()`, the price solver and
   the fuel surcharge all read exclusively from this block (via the aliases
   `SS_TABLE`, `LS_TABLE`, `FUEL_SURCHARGE`).
4. Update the mirrored tables at the top of `test.js` and the expected dollar
   amounts in its fee tests, then run `npm test`.
5. Update Sections 1.2 / 1.3 of this document.

Referral fees (Section 1.1) are percentage rules, not tables — they stay in
`getReferralFee()`.

---

## 2. PRICE TIER CALCULATION

### 2.1 Your Price (primary selling price)
**CODE LOCATION:** `index.html` → function `calc()`, iterative price solver loop
**Rule:** Solved iteratively (12 iterations) from target margin. Formula each iteration:
  `yourPrice = (totalCosts + fbaFee + referralFee) / (1 - targetMargin/100)`
  Iterative because referralFee and fbaFee both depend on price itself.
**Rounding:** `roundEnd(raw - 0.05, 0.95)` → always ends in .95
  Why .95: psychological pricing convention signalling "standard retail price".
  The -0.05 offset ensures we round UP to next .95 rather than staying below cost.

### 2.2 List Price (MSRP / strike-through anchor)
**CODE LOCATION:** `index.html` → `const listP = roundEnd(yp * 1.10 - 0.09, 0.99)`
**Rule:** 10% above Your Price, rounded up to next .99
  Why 10%: gives a meaningful strike-through without being so high Amazon can't verify it.
  Why .99: universal MSRP/RRP psychological signal.
  **IMPORTANT (Apr 23 2026 rule):** List Price must be verified by Amazon. Either the product
  must have been sold at that price on Amazon, or another retailer must stock it at that price.
  If you have a DTC website, set it to match the List Price.

### 2.3 Sale Price (Price Discount / Was→Now badge)
**CODE LOCATION:** `index.html` → `const saleP = roundEnd((yp * 0.94) - 0.10, 0.90)`
**Rule:** 6% below Your Price (chosen because Amazon requires minimum ~5% for badge to show,
  6% gives a safe margin above that threshold), rounded to next .90
  Why .90: signals "promotional price" to customers. Even number ending.
  Max campaign duration: 30 days via Price Discount tool (free in Seller Central).

### 2.4 Clearance / Discount Price (one-off irregular price)
**CODE LOCATION:** `index.html` → `const discP = roundEnd((saleP * 0.91) - 0.97, 0.97)`
**Rule:** ~9% below Sale Price, rounded to next .97
  Why .97: irregular ending signals "this is a one-off special price, not our normal price".
  Other valid endings: .88, .77. These are seller convention, NOT Amazon policy.
  Use sparingly — each use at this price level erodes the "Was" price anchor.

**TO UPDATE price tier discounts:** Find the multipliers (0.94 for sale, 0.91 for clearance)
and adjust as needed. The rounding endings (.99/.95/.90/.97) are conventions — change them
in the `roundEnd` calls if your pricing strategy uses different signals.

---

## 3. COST INPUTS & TYPICAL VALUES

**CODE LOCATION:** `index.html` → input fields with id prefix (no prefix = seller mode, `m_` = manufacturer mode)

All "typical value" hints are set as `placeholder` and `value` attributes on input elements.
**TO UPDATE typical values:** search for the input id (e.g. `id="inbound"`) and update `value=""`.

| Cost                     | Typical Value | Notes                                          |
|--------------------------|---------------|------------------------------------------------|
| COGS                     | $6.00         | Manufacturing cost only, excluding freight     |
| Inbound Shipping         | $0.50/unit    | Sea freight China→FBA. Air = $2–$5/unit       |
| Inbound Placement Fee    | $0.30/unit    | Only if not using Amazon-optimised splits      |
| Prep & Labelling         | $0.25/unit    | FNSKU labelling + polybag if needed            |
| Monthly Storage          | $0.10/unit    | Assumes ~45-day average sell-through          |
| Q4 Storage Surcharge     | $0.30/unit    | Oct–Dec only. $2.40/cu ft vs $0.87 rest of yr |
| PPC / Advertising        | $1.50/unit    | Blended rate: total ad spend ÷ units sold     |
| Returns Allowance        | $0.30/unit    | ~3% return rate × avg $10 loss per return     |
| Amazon Vine              | $200 flat     | Per ASIN, amortised over expected units        |
| Coupon (if used)         | varies        | $5 flat + 2.5% of attributed sales            |
| Other / Overhead         | $0.20/unit    | Tools, photography, brand registry amortised  |

---

## 4. VINE PROGRAMME LOGIC

**CODE LOCATION:** `index.html` → Vine checkbox `id="vine_enrolled"`, cost field `id="vine_units"`,
  and the lifecycle stage engine functions `getStageStatus()` and `checkKillSignals()`

**Rules:**
- Vine costs $200 per ASIN flat fee (CODE: `VINE_COST = 200`)
- Target: minimum 20 reviews (configurable in UI)
- Vine runs for approximately 30 days after enrollment (CODE: `VINE_WINDOW_DAYS = 30`)
- During the Vine window (days 0–30 of product lifecycle):
  - Ad sales count is suppressed for Stage 2 graduation — Vine reviewers are not real buyers
  - Vine-period ad sales do NOT count toward the 40–50 ad sales Stage 2 graduation criterion
  - Zero organic sales during Vine window does NOT trigger a kill signal
  - The Vine cost is amortised: `vine_cost_per_unit = 200 / expectedUnitsPerYear`
- After Vine window closes (~Day 30): normal rules apply
- Vine requires Brand Registry. Product must be new (not used/refurbished).

**ADVERTISING TOOL NOTE:** m19 Stage 1 and Stage 2 overlap with Vine. The ACoS will appear
very high during Vine because Vine reviewers click ads but don't "convert" in the traditional
sense. This is expected and should not trigger alarm.

**TO UPDATE:** If Vine cost changes from $200, find `VINE_COST` constant.
If Vine window changes from 30 days, find `VINE_WINDOW_DAYS` constant.

---

## 5. ADVERTISING STAGE ENGINE (m19 / compatible tools)

This section documents the three-stage advertising ramp used with m19 (or any AI bid
optimisation tool with equivalent modes). The stage names and mode names are specific to m19
but the underlying logic applies to any platform with similar capabilities.

**CODE LOCATION:** `index.html` → function `getStageGuidance(product)` and stage display in tracker view

**TO UPDATE for a different ad platform:** Find `getStageGuidance()` and replace the m19-specific
mode names ("Force Product Visibility", "Monthly Budget", "ACOS Target") with the equivalent
modes in your platform. The graduation criteria and timing logic stay the same.

---

### Stage 1: Force Product Visibility
**m19 mode:** Force Product Visibility
**Duration:** Day 0 → approximately Day 3–7 (or until first sales recorded)
**Goal:** Generate impressions, clicks, first sales. Pure data collection for the AI.
**ACoS expectation:** Can exceed 100%. This is NORMAL and EXPECTED. Do not optimise.
**Daily budget rule:** Set based on niche competitiveness.
  - Low competition: $10–$20/day
  - Medium competition: $20–$40/day
  - High competition: $40–$80/day
  These are starting recommendations. Adjust based on category CPC data.
  CODE: `STAGE1_BUDGET_LOW=15`, `STAGE1_BUDGET_MED=30`, `STAGE1_BUDGET_HIGH=60`
**Bid:** $1–$2 suggested. Adjust higher for competitive niches.
**Important:** Create a DEDICATED strategy/campaign for this ASIN. Never mix new ASINs
  with established products in the same campaign.
**Vine interaction:** If Vine enrolled, Stage 1 runs concurrently. Vine reviewers may
  appear as "sales" — this is fine. The graduation criterion is real ad-attributed sales.

**Graduation criteria (ALL must be met):**
1. At least 3 days have passed (hard minimum — CODE: `S1_MIN_DAYS = 3`)
2. Vine window has not yet closed (if enrolled) OR first real ad sales are recorded
3. At least 1 ad-attributed sale recorded

---

### Stage 2: Monthly Budget
**m19 mode:** Monthly Budget
**Duration:** Week 1 → approximately Month 1 (until 40–50 ad sales achieved)
**Goal:** Build sales volume. Let the AI optimise bids with accumulated data.
**ACoS expectation:** Still elevated. Do NOT set ACoS targets yet. Volume is the metric.
**Monthly budget rule:**
  - Baseline: $500/month (CODE: `STAGE2_BUDGET_BASELINE = 500`)
  - Adjust based on niche: competitive niches may need $1,000–$2,000/month
  - Set a budget you can sustain for 30 days without reacting to daily fluctuations
**Important:** The AI needs 1–2 weeks to learn. Do NOT make frequent changes.
  Avoid changing bids, budget, or targeting more than once per week.
**Vine interaction:** If Vine window is still active (days 0–30), do NOT count
  Vine-period sales toward the 40–50 graduation criterion. Only count ad sales
  recorded AFTER the Vine window closes. The effective start of Stage 2 counting
  is `max(stageStartDate, vineWindowEndDate)`.
  CODE: effective ad sales count = total ad sales since `max(s2Start, vineEnd)`

**Graduation criteria (ALL must be met):**
1. At least 30 days in Stage 2 (CODE: `S2_MIN_DAYS = 30`)
2. 40–50 ad-attributed sales in the last 30 days, counting only post-Vine sales
   (CODE: `S2_AD_SALES_TARGET = 40`)
3. Sales trend is stable or growing (subjective — flagged as a manual check in UI)

---

### Stage 3: ACoS Target
**m19 mode:** ACOS Target
**Duration:** Month 1+ → ongoing (this is the steady state)
**Goal:** Shift from volume to profitability. Gradually reduce ACoS to target floor.
**Starting ACoS target:** Use the ACTUAL historical ACoS from Stage 2 (not the theoretical target).
  Do not start too aggressive. If Stage 2 averaged 55% ACoS, start Stage 3 at 55%.
**Step-down rule:** Reduce ACoS target in small steps only.
  Recommended step size: 3 percentage points at a time (CODE: `S3_ACOS_STEP = 3`)
  Minimum wait between steps: 5 days (CODE: `S3_STEP_WAIT_DAYS = 5`)
  Never make a drop larger than 5pp at once — this can crash impressions.
**ACoS floor:** Break-even ACoS = net margin % at Your Price.
  (e.g. if margin is 30%, break-even ACoS is 30%. Going below this means ads lose money.)
  CODE: `beAcos = netMarginPct` — this is calculated from the pricing inputs.
  The floor is the absolute minimum. Target ACoS should stay 3–5pp ABOVE the floor
  to leave a buffer. CODE: `S3_ACOS_BUFFER = 3`
**Portfolio merge:** Once consistently profitable and stable for 60+ days, the ASIN
  can be merged into a broader portfolio strategy with products of similar margins.

---

## 6. PRODUCT LIFECYCLE STAGES

**CODE LOCATION:** `index.html` → `LIFECYCLE_STAGES` constant object, function `getLifecycleStage(product)`

Stages and their meanings:
1. **PRE_LAUNCH** — Product set up in tool but not yet live on Amazon
2. **STAGE_1** — m19 Force Product Visibility (Day 0–7)
3. **STAGE_2** — m19 Monthly Budget (~Week 1–Month 1)
4. **STAGE_3** — m19 ACoS Target (Month 1+)
5. **STABLE** — Consistently profitable, ACoS below target, organic growing
6. **KILL_REVIEW** — One or more kill signals triggered; manual review required
7. **KILLED** — Manually marked as discontinued

Stage transitions are MANUAL — the tool recommends graduation but the user confirms.
This prevents automatic decisions on insufficient data.

**STABLE graduation criteria (ALL must be met):**
- In Stage 3 for at least 60 days (CODE: `STABLE_MIN_S3_DAYS = 60`)
- ACoS consistently below break-even + buffer for last 30 days
- Organic sales growing or stable (manual flag)
- No kill signals active

---

## 7. KILL / CONTINUE DECISION ENGINE

**CODE LOCATION:** `index.html` → functions `checkKillSignals(product)` and `explainSignal(signal, lang)`

These thresholds are SUGGESTIONS, not automatic decisions. The tool shows a "Kill Review"
badge and explains why. The user decides. All thresholds documented here for easy LLM tuning.

**Structured signals + plain-language explanations:**
`checkKillSignals()` returns structured objects — `{signals: [{code, params}],
warnings: [{code, params}]}` — where `params` carries the ACTUAL numbers that
fired the threshold (days elapsed, sales counts, ACoS values, spend/revenue).
Codes: `K1`–`K4` for kill signals, `STALE` for the check-in warning.

`explainSignal(signal, lang)` is a pure function that renders a signal into
`{title, text, rule}`:
- `text` — full plain-language sentence with the real numbers, e.g.
  *"ACoS 42% has exceeded break-even ACoS 31% for 95 days in Stage 3
  (threshold: 90 days), and organic sales are not growing…"*
- `rule` — names the RULE constant(s) responsible, e.g. `S3_KILL_DAYS = 90`.
- `lang` is `'en'` or `'zh'`; both variants keep the same numbers.

The UI renders `title` + `text` + a monospace `RULE:` tag per signal.
**TO ADD a new signal:** push a new `{code, params}` in `checkKillSignals()`
and add a matching case in `explainSignal()` (EN + ZH).

### Kill Signal 1: Stage 1 Zero Sales
**Trigger:** Zero ad-attributed sales after DAY_THRESHOLD days in Stage 1
**Day threshold:** 14 days (CODE: `K1_DAYS = 14`)
**Vine exception:** If Vine enrolled AND Vine window still open, this signal is SUPPRESSED.
  Rationale: Vine reviewers place orders but they may not show as "ad sales". Zero ad sales
  during Vine is expected. Wait until Vine window closes before applying this signal.
**Action on trigger:** Show "Kill Review" with message: "No ad sales after 14 days in Stage 1.
  If Vine window has closed, this product may have fundamental discoverability issues."

### Kill Signal 2: Stage 2 Insufficient Velocity
**Trigger:** Fewer than S2_AD_SALES_TARGET ad sales after S2_KILL_DAYS days in Stage 2
**Ad sales target:** 40 (CODE: `S2_AD_SALES_TARGET = 40`)
**Day threshold:** 60 days (double the expected Stage 2 window) (CODE: `S2_KILL_DAYS = 60`)
**Vine adjustment:** Only count ad sales after the Vine window end date.
**Action on trigger:** Show "Kill Review" with message: "Fewer than 40 ad sales after 60 days
  in Stage 2. The product may not have sufficient demand to support the advertising investment."

### Kill Signal 3: Stage 3 Persistent Unprofitability
**Trigger:** BOTH of these conditions are true after S3_KILL_DAYS days in Stage 3:
  a) ACoS has never dropped below break-even ACoS (netMarginPct) at any check-in
  b) Organic sales are not growing (manual flag set at last check-in)
**Day threshold:** 90 days (CODE: `S3_KILL_DAYS = 90`)
**Rationale:** 90 days is enough time for an AI bid optimiser to find efficiency. If it
  hasn't reached break-even after 90 days AND organic isn't growing, the unit economics
  are likely structurally broken (price too low, competition too high, or wrong keywords).
**Action on trigger:** Show "Kill Review" with detailed breakdown of cumulative spend vs revenue.

### Kill Signal 4: Ad Spend Ratio (Money Pit Alert)
**Trigger:** Cumulative ad spend > SPEND_RATIO_THRESHOLD × cumulative total revenue
**Threshold:** 1.5× (150%) (CODE: `K4_SPEND_RATIO = 1.5`)
**Why 150%:** If you've spent more on ads than 150% of all revenue generated, the product
  is almost certainly not recoverable without a fundamental restructure. This catches products
  where revenue is growing slowly but ad spend is outpacing it.
**Note:** This is a "danger flag" not an immediate kill signal. The product could still recover
  if organic sales start. Show as amber warning, not red kill signal.
**Vine exception:** Exclude Vine period revenue from this calculation (Vine reviewers may
  inflate early "revenue" that isn't real market demand).

### Kill Signal 5: Stale Check-in
**Trigger:** No check-in recorded for more than STALE_DAYS days
**Day threshold:** 21 days (CODE: `STALE_DAYS = 21`)
**Action:** Show amber "Needs Review" badge. Not a kill signal — just a prompt to check in.

---

## 8. PERIODIC CHECK-IN SYSTEM

**CODE LOCATION:** `index.html` → function `recordCheckin(productId, data)`, check-in history display

A check-in records the current state of a product at a point in time.
Check-ins are stored in the product's `checkins` array in localStorage.

**Check-in fields:**
- `date`: ISO timestamp (auto-set)
- `currentPrice`: Current public price on Amazon (manual entry)
- `currentAcos`: ACoS % from ad platform (manual entry)
- `adSales`: Ad-attributed sales in last 30 days (manual entry, key: `adSales` on the object)
- `totalRevenue`: Total revenue (paid + organic) last 30 days (manual entry)
- `totalAdSpend`: Total ad spend last 30 days (manual entry)
- `organicGrowing`: 'yes' / 'stable' / 'no' — is organic traffic/sales growing? (manual flag)
- `inventoryUnits`: Current FBA sellable inventory, in units (manual entry or Inventory Report import)
- `unitsSold30`: Total units sold (organic + paid) last 30 days (manual entry or Business Report import)
- `notes`: Free text

**Price tier classification (CODE: function `classifyPrice(currentPrice, tiers)`):**
Compare currentPrice to calculated tiers with a tolerance of ±2%:
- Within 2% of listPrice → "List Price / MSRP"
- Within 2% of yourPrice → "Your Price (normal)"
- Within 2% of salePrice → "Running Sale / Price Discount"
- Within 2% of discPrice → "Running Clearance / Discount"
- Below discPrice → "Below Clearance — check urgently"
- Above listPrice → "Above List Price — possible error"
- None match → "Custom price — compare manually"

**TACoS calculation (CODE: in check-in display):**
TACoS = totalAdSpendLast30 / totalRevenueLast30 × 100
Target: below 10% for healthy organic-to-paid ratio.

**Inventory & sales velocity (CODE: function `getInventoryStatus(inventoryUnits, unitsSold30)`):**
Computed fresh on every render from the two check-in fields above — nothing is stored pre-computed.
- `velocity` = unitsSold30 ÷ 30 (units sold per day)
- `daysOfCover` = inventoryUnits ÷ velocity
- Status thresholds (CODE: constants `STOCKOUT_RISK_DAYS`, `REORDER_SOON_DAYS`, `AGED_INVENTORY_DAYS`):
  - `daysOfCover < 30` → **stockout_risk** — "Reorder now" (red badge)
  - `30 ≤ daysOfCover < 90` → **reorder_soon** — "Plan reorder" (amber badge). 90 days accounts
    for typical China manufacturing + sea freight lead time on a reorder placed today.
  - `90 ≤ daysOfCover ≤ 181` → **healthy** — no badge
  - `daysOfCover > 181` → **overstock** — "Overstock risk" (gray badge). 181 days matches the
    Amazon aged-inventory storage surcharge cutoff already referenced elsewhere in the UI.
  - `unitsSold30 === 0` and `inventoryUnits > 0` → **no_sales** — "No sales — stagnant" (gray badge).
    Velocity is 0 so days-of-cover cannot be computed (shown as `null`, never `Infinity`).
  - `inventoryUnits === 0` and `unitsSold30 === 0` → **unknown** (no badge) — distinguishes a
    product that's never launched from one that's actually stagnant.
- If `inventoryUnits` was never entered for a check-in, `getInventoryStatus` returns `null` and
  the UI shows "—" rather than guessing.
- This is a display/monitoring signal only — it is NOT wired into `checkKillSignals()`. Running
  low on stock is an operational reorder problem, not a reason to kill a product.

**TO UPDATE inventory thresholds:** Find `STOCKOUT_RISK_DAYS` / `REORDER_SOON_DAYS` /
`AGED_INVENTORY_DAYS` constants and adjust. If your supply chain lead time changes
(e.g. switching from sea to air freight), `REORDER_SOON_DAYS` is the one to tune.

**Undo / soft delete (CODE: `deleteCheckin()`, `recordCheckin()`, `showUndoToast()`):**
Deleting a check-in shows no confirm dialog — it is a soft delete. A toast with an
Undo button appears for `UNDO_WINDOW_MS` (8,000 ms; CODE: `UNDO_WINDOW_MS = 8000`).
Undo restores the check-in at its original position in the `checkins` array.
Saving a new check-in shows the same toast; Undo removes the just-added record.
**TO UPDATE the undo window:** change the `UNDO_WINDOW_MS` constant.

---

## 9. ADVERTISING BUDGET RECOMMENDATIONS

**CODE LOCATION:** `index.html` → function `getAdBudgetRecommendation(product, stage)`

Stage 1 daily budget (CODE constants):
- `STAGE1_BUDGET_LOW = 15` ($15/day for low-competition niches, CPC typically <$0.50)
- `STAGE1_BUDGET_MED = 30` ($30/day for medium-competition, CPC $0.50–$1.50)
- `STAGE1_BUDGET_HIGH = 60` ($60/day for high-competition, CPC >$1.50)
How to choose: estimated by category. Electronics/Computers = high. Home/Kitchen = med.
Grocery/Beauty = low-med. Jewelry/Watches = high.

Stage 2 monthly budget:
- `STAGE2_BUDGET_BASELINE = 500` ($500/month default)
- Adjust: multiply by competition factor (1× low, 1.5× med, 2.5× high)

Stage 3: No fixed budget recommendation. Budget is determined by ACoS target + max CPC.
The tool shows max CPC as a bidding ceiling. Budget should be set to allow full daily
expression of that CPC across expected impression volume.

---

## 10. DATA PERSISTENCE

**CODE LOCATION:** `index.html` → functions `saveToStorage()`, `loadFromStorage()`, `exportJSON()`, `importJSON()`

**localStorage key:** `amazon_pricing_tool_v1`
  (CODE: `STORAGE_KEY = 'amazon_pricing_tool_v1'`)
  The `_v1` suffix allows future migrations — if the data schema changes, increment to `_v2`
  and write a migration function.

**Data structure:**
```json
{
  "version": 1,
  "lang": "en",
  "currency": "USD",
  "products": [
    {
      "id": "uuid",
      "name": "Product Name",
      "asin": "B0XXXXXXXXX",
      "createdAt": "ISO date",
      "lifecycle": "STAGE_2",
      "inputs": { ... all calculator inputs ... },
      "checkins": [ { ... check-in records ... } ],
      "notes": "free text"
    }
  ]
}
```

**JSON export/import:** Full data dump as `amazon-pricing-tool-export-YYYY-MM-DD.json`.
  Import replaces ALL data (with confirmation prompt). For merging, manual editing of the
  JSON file is required (documented in README.md).

---

## 11. CSV IMPORT FORMAT

**CODE LOCATION:** `index.html` → function `importCSV(event)`

Required columns (header row must match exactly, case-insensitive):
`name, asin, category, size_tier, weight_oz, cogs, target_margin`

Optional columns (omit = use default values from section 3):
`inbound_shipping, inbound_placement, prep_labelling, storage, q4_storage,
ppc_per_unit, returns_allowance, vine_enrolled, vine_units, annual_units, other_overhead,
target_acos, launch_acos, cvr, notes`

Category values: `home`, `beauty`, `grocery`, `apparel`, `shoes`, `electronics`,
  `computers`, `camera`, `pc`, `appliances`, `jewelry`, `watches`, `giftcards`,
  `amazon_accessories`, `books`

Size tier values: `ss` (small standard), `ls` (large standard), `lb` (large bulky), `xl` (extra-large)

**Template file:** `products-template.csv` (included in repo)

### 11.1 Row Validation & Import Report
**CODE LOCATION:** `index.html` → function `validateCSVRow(row, isUpdate)`, report UI in `showImportReport()` / `csvErrorText()`, modal `#import-report-modal`

Rows are validated BEFORE import; a row with any error is **skipped entirely**
(never partially imported or silently coerced) and listed in the post-import
report ("Imported X · Updated Y · Skipped Z" with an expandable per-row error
list showing row number, field, and reason).

Validation rules (error codes):
- `missing_required` — create rows must have a `name` or `asin`, and a `cogs` value.
  Update rows (matched to an existing product by ASIN or name) are exempt — they
  may carry only the columns being updated.
- `not_numeric` — `cogs`, `target_margin`, `weight_oz` present but not parseable
  as a number (strict `Number()` parse: `"12x"` is rejected).
- `unknown_category` — `category` present but not a key of `CAT_MAP`.
- `bad_size_tier` — `size_tier` present but not `ss`/`ls`/`lb`/`xl` (case-insensitive).

Empty optional fields are NOT errors — defaults from Section 3 apply.

**TO UPDATE validation rules:** edit `validateCSVRow()` and add a matching
entry to `csvErrorText()` for any new error code.

### 11.2 Importing a landed-cost/CIF figure as `cogs`
If your cost data is a CIF (Cost, Insurance, Freight) or other all-in landed-cost figure
that already includes inbound freight, set `cogs` = that figure AND `inbound_shipping = 0`
in the CSV. Otherwise inbound freight gets counted twice (once inside the landed cost,
once in the tool's separate inbound_shipping field), silently inflating total cost and
understating margin. CIF terms typically stop at the destination port — verify separately
whether US customs duty and last-mile drayage to the FBA warehouse still need to be added
via `inbound_placement` or `other_overhead`.

---

## 12. CURRENCY CONVERSION

**CODE LOCATION:** `index.html` → constant `CNY_RATE`, function `fmtC(usd)`

`CNY_RATE = 7.25` (approximate USD → CNY rate as of June 2026)
This is a STATIC rate baked into the tool. It does not update automatically.
**TO UPDATE:** Find `CNY_RATE` constant and change the value.
Note: All internal calculations are in USD. CNY is display-only.

---

## 13. LANGUAGE SUPPORT

**CODE LOCATION:** `index.html` → function `setLang(l)`, `data-en` and `data-zh` HTML attributes

Supported languages: English (`en`), Simplified Chinese (`zh`)
**TO ADD a new language:**
1. Add `data-[lang]` attributes to all elements that have `data-en` and `data-zh`
2. Add a new language button in the header
3. Update `setLang()` to handle the new language code
4. Add the language to the select options in any language-dependent UI elements

---

## 14. MANUFACTURER MODE

**CODE LOCATION:** `index.html` → function `calcMfg()`, manufacturer view HTML (id="mfg-view")

Logic:
1. Manufacturer enters landed cost (factory + freight + duties + prep to FBA door)
2. Manufacturer enters their own margin target
3. Quote price to seller = landedCost / (1 - mfgMargin/100)
4. Seller's COGS = quote price
5. Tool solves for minimum viable Amazon price using same iterative solver as seller calc
6. Output shows: quote price, manufacturer profit, seller's minimum Amazon price, all four price tiers, seller's margin at each tier

This helps manufacturers understand whether their pricing leaves the seller viable.
If seller margin < 15% at minimum viable price, the quote is likely too high for
the Amazon channel.

---

## 15. CALCULATOR EXTRAS

### 15.1 Price Sensitivity Table
**CODE LOCATION:** `index.html` → constant `SENSITIVITY_OFFSETS`, function `priceSensitivity(inputs, basePrice)`, rendered in `renderCalcTab()`

Shows net profit ($/unit) and net margin (%) at Your Price −$2, −$1, current, +$1, +$2.
- Offsets: `SENSITIVITY_OFFSETS = [-2, -1, 0, 1, 2]` (dollar amounts relative to Your Price)
- FBA and referral fees are **recomputed at each price point**, so FBA price-band cliffs
  ($10 and $50 boundaries) are visible in the table — a $1 price increase across the $10
  boundary can *reduce* profit because the FBA fee jumps ~$0.88.
- The current-price row is highlighted. Rows where price ≤ 0 are suppressed.
- Margin colour coding: green ≥ `LOW_MARGIN_WARNING` (20%), amber 0–20%, red < 0%.

**TO UPDATE:** change `SENSITIVITY_OFFSETS` to widen/narrow the range (e.g. `[-5,-2,0,2,5]`).

### 15.2 Break-even Units / Month
**CODE LOCATION:** `index.html` → function `breakEvenUnits(monthlyOverheads, profitPerUnit)`, UI in `renderBreakevenCalc(p)`, input persisted as `p.inputs.monthlyOverhead`

**Rule:** `units = ceil(fixedMonthlyOverheads ÷ contributionMarginPerUnit)`
- Contribution margin per unit = net profit at Your Price (from `calcPrices().ypF.profit`),
  i.e. after COGS, FBA, referral, and all per-unit costs. Overheads must therefore be
  genuinely *fixed* costs (software, warehousing rent, salaries) — not per-unit costs,
  which are already inside the margin.
- Rounded UP to whole units (you cannot sell a fraction of a unit).
- Returns `null` when contribution margin ≤ $0 (product can never cover overheads) —
  the UI shows a red alert in that case. Returns `0` when overheads are 0 or unset.
- The overhead input is stored per product in `inputs.monthlyOverhead` and preserved
  when the product is edited via the modal (see `saveProduct()`).

### 15.3 Landed Cost Calculator (CNY → USD)
**CODE LOCATION:** `index.html` → function `landedCostUSD(cnyPrice, rate, dutyPct, freightPerUnit)`, UI in the Add/Edit Product modal (`#landed-calc`), functions `calcLanded()` / `applyLandedCost()`

**Rule:** `goodsDuty = (cnyPrice ÷ exchangeRate) × (1 + dutyPct/100)`; `total = goodsDuty + freightPerUnit`
- Duty is applied to the **goods value only**, not to freight (quick-estimate convention).
- Default exchange rate = `CNY_RATE` (7.25, see Section 12); editable per calculation.
- **"Use as COGS" applies the result in two parts** to keep the cost model of Section 3
  intact: goods + duty fills the COGS field, freight fills the Inbound Shipping field.
  This avoids double-counting freight, since COGS is defined as manufacturing cost only.
- Returns `null` for non-positive CNY price or exchange rate; negative duty is treated as 0.

### 15.4 Fee Waterfall
**CODE LOCATION:** `index.html` → function `feeWaterfall(inputs, price)`, rendered by `waterfallHtml()` in the Calculator tab (above the sensitivity table)

**Rule:** Decomposes a selling price into ordered cost segments down to net profit:
`referral → FBA base fee → fuel surcharge → COGS → inbound/prep/storage → PPC → returns + overhead (+ Vine amortisation) → net`
- All fees are **recomputed at the given price** (same band logic as the solver).
- The fuel surcharge is shown as its own segment: `fbaBase × (FUEL_SURCHARGE − 1)`,
  so users can see exactly what the April 2026 surcharge costs them per unit.
- Invariant: segment amounts always sum exactly to the price. Net can be negative
  (rendered red); positive net renders green.
- Returns `null` for non-positive prices.
- The UI draws cascading bars: each cost bar starts where the previous one ended,
  and the remainder is the net margin. Pure CSS, no canvas or libraries.

### 15.5 What-if Solver (inverse pricing)
**CODE LOCATION:** `index.html` → functions `solveMaxCOGS(inputs, targetPrice, targetMarginPct)` and `solveMinPriceRaw(inputs)`, UI in `renderWhatIf()` / `calcWhatIf()` (Calculator tab, "What-if Solver" card)

Two inversion modes, selectable via tabs:

**Mode A — lock price + margin, solve max COGS:**
`maxCogs = price × (1 − margin/100) − FBA(price) − referral(price) − otherPerUnitCosts`
- Direct formula, no iteration — the fees depend only on the price, which is locked.
- All other per-unit costs (inbound, prep, storage, PPC, returns, overhead, Vine
  amortisation) are taken from the product's current inputs.
- Output includes `gap = maxCogs − current COGS` (positive = sourcing headroom,
  negative = current supplier is too expensive for this price/margin combo).
- Returns `null` for non-positive price or margin ≥ 100%. `maxCogs` can be
  negative (impossible target) — the UI shows a red alert in that case.

**Mode B — lock COGS + margin, solve min price:**
Reuses the main iterative solver, exposed as `solveMinPriceRaw()` — identical
fixed-point iteration to `calcPrices()` but WITHOUT the .95 rounding, run for
40 iterations. The UI shows both the exact break-point price and the rounded
Your Price (via `calcPrices`), with the margin achieved at the rounded price.

**Round-trip property (tested):** solving max COGS from a price, then solving
the raw price back from that COGS, returns the original price within $0.01
(and vice versa). This holds because both directions solve the same equation
`price × (1 − m) = COGS + fees(price) + otherCosts`.

## 16. AUTO-BACKUP NUDGE

**CODE LOCATION:** `index.html` → constants `BACKUP_NUDGE_DAYS` / `BACKUP_SNOOZE_DAYS`, pure function `shouldShowBackupNudge()`, UI in `renderBackupNudge()` / `snoozeBackupNudge()`, banner container `#backup-nudge`

All data lives in browser localStorage (Section 10) — clearing browser data
erases it. The nudge reminds users to export a JSON backup.

Rules:
- Show a dismissible amber banner when there is at least one product AND no
  JSON export for more than `BACKUP_NUDGE_DAYS` (30) days.
- Reference date = `state.lastExportAt` (stamped by `exportJSON()`), falling
  back to the **oldest product's `createdAt`** when the user has never exported.
- The comparison is strictly greater-than: exactly 30 days does not fire.
- Dismissing ("Later") sets `state.backupSnoozedUntil` = now + `BACKUP_SNOOZE_DAYS`
  (7) days; the banner stays hidden until then.
- `state.lastExportAt` is written BEFORE serialising the export, so the backup
  file itself records when it was made.

**TO UPDATE:** change `BACKUP_NUDGE_DAYS` (nudge threshold) or
`BACKUP_SNOOZE_DAYS` (snooze length).

## 17. THEME (DARK / LIGHT)

**CODE LOCATION:** `index.html` → CSS variable blocks `:root` / `html.light` (top of `<style>`), constant `THEME_KEY`, functions `applyTheme()` / `toggleTheme()` / `initTheme()`, toggle button `#btn-theme`

Rules:
- Every component color reads a CSS variable `var(--c-XXXXXX)`, named after its
  dark-mode hex value. The dark palette is defined on `:root`, the light palette
  on `html.light`. Components are NEVER forked per theme — switching themes is a
  single class toggle on `<html>`.
- The chosen theme persists in localStorage under `THEME_KEY`
  (`amazon_pricing_theme`) — separate from app data so Import JSON cannot
  change the user's theme.
- **First visit** (no saved choice): follows the OS `prefers-color-scheme`.
  After the first manual toggle, the explicit choice always wins.
- `color-scheme: dark|light` is set per theme so native form controls match.

**TO UPDATE a color:** change the variable value in `:root` (dark) and/or
`html.light` (light). **TO ADD a color:** add it to both blocks and reference
it as `var(--c-...)` — never hardcode a hex in a component style.

---

## 18. AMAZON REPORT & FBA FEE PREVIEW IMPORT

Two separate importers read real Amazon export files (distinct from the app's own
`products-template.csv` format in Section 11).

### 18.1 FBA Fee Preview / Inventory stub import
**CODE LOCATION:** `index.html` → function `importFBAFeePreview(event)`

Reads an Amazon "FBA Fee Preview" report or "Manage All Inventory" download (tab- or
comma-delimited) and creates NEW product stubs — one per unmatched ASIN. `cogs` is
deliberately set to `0` to trigger the app's incomplete-setup banner; the user must open
Edit and fill in COGS, margin and other costs before the pricing is trustworthy.

Column matching is fuzzy (substring match on lower-cased, `-`/`_`-stripped headers):
ASIN, product name, product size tier, unit weight. Weight units are auto-detected from
the column header (grams / oz / assumes lbs otherwise).

Size tier strings from Amazon (e.g. `UsLargeStandardSize`, `SmallBulky`) are mapped to
this app's 4 buckets via `amazonSizeTierToAppTier()` — see Section 18.3.

### 18.2 Weekly check-in import (Business / Advertising / Inventory reports)
**CODE LOCATION:** `index.html` → function `importAmazonReport(event)`

Auto-detects one of three report types by column presence and creates a check-in for
each ASIN that already matches an existing product (does NOT create new products):

| Report type   | Detected by column(s)                          | Fills into check-in |
|---------------|--------------------------------------------------|----------------------|
| Business      | "Ordered Product Sales"                          | `totalRevenue`, `unitsSold30` (from "Units Ordered"), `cvr` (on the product) |
| Advertising   | "Spend" + ("ACoS" or "7 Day Total Sales")         | `currentAcos`, `totalAdSpend`, `adSales` (from "7 Day Total Units/Orders") |
| Inventory     | a fulfillable/sellable/available quantity column, and NOT Business or Advertising | `inventoryUnits` |

Multiple rows per ASIN are aggregated (summed for $/units, averaged for ACoS/CVR) —
advertising reports have one row per campaign, inventory reports can have one row per FC.

`currentPrice` is never present in any Amazon export and must always be entered manually
(see the check-in form's price field).

### 18.3 Size tier string mapping
**CODE LOCATION:** `index.html` → function `amazonSizeTierToAppTier(raw)`

Maps Amazon's various size-tier export strings to this app's 4 buckets (`ss`/`ls`/`lb`/`xl`).
Handles two real-world quirks:
1. Amazon exports size tiers as concatenated camelCase with no separator
   (e.g. `UsSmallStandardSize`) — the function inserts a space at every
   lowercase→uppercase boundary before pattern-matching, otherwise a naive
   `/small.+standard/` regex never matches (zero characters between the words).
2. "Bulky" is Amazon's current term for what used to be called "Oversize" on
   Small/Medium items (e.g. `SmallBulky`, `LargeBulky`) — both map to this app's `lb`.

Returns `null` for unrecognised strings; callers fall back to a default tier rather
than guessing. Covered by `test.js` against real values pulled from an actual Amazon
FBA Fee Preview export.

---

*Last updated: July 2026*
*To update this document after modifying the code, ask an LLM: "Update LOGIC.md to reflect the change I made to [function/constant name]"*
