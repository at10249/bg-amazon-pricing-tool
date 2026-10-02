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

### 1.2 Dated US non-apparel FBA rates

**CODE LOCATION:** `fba-rates.js` (`FBA.quote`, `FBA.physical`, `FBA.periodCoverage`); authoritative data and citations in `rates/amazon-us-2026.json`.
**Verified:** October 2, 2026 against official Amazon search-index content; direct help-page opens return a JavaScript shell.

- All 54 published base rows cover nonpeak January 15–October 14, 2026 and holiday peak October 15, 2026–January 14, 2027.
- Price bands are `<10`, inclusive `10–50`, and `>50`. Incremental weight intervals round up; no packaging-weight add-on or dimension rounding is assumed.
- Small standard uses actual packaged unit weight. Other supported tiers use the greater of unit and dimensional weight (`L×W×H / 139`); bulky and extra-large width/height have a 2-inch minimum. Extra-large 150+ uses unit fee weight when the unit itself exceeds 150lb.
- Dimensions are sorted longest/median/shortest; size classification checks **length plus girth**, not girth alone. Small bulky and large bulky have distinct 2026 rates. Extra-large uses separate weight brackets and interval charges. Overmax is blocked pending a separate verified fee.
- Save actual unit ounces and three packaged dimensions in inches; never overwrite actual weight with dimensional weight. Fee Preview imports dimensions and units (`unit-of-dimension`, `unit-of-weight`) and Amazon's per-SKU fee estimate — the estimate is never a new *base* fee, it calibrates the engine (§1.5). Existing rows without dimensions require re-import/edit before a dimensional floor can be claimed. Known small-standard unit fees remain usable without dimensions.
- **Missing / unverifiable fee → explicit error, never NaN.** `calcPrices()` returns `fbaError` (string) when the FBA quote fails (missing dimensions, overmax, no rate coverage). Every consumer — Portfolio table, products CSV export, check-ins, coupon, break-even volume, What-if, stage guidance, Calculator — shows **"needs dimensions" / 需要尺寸** (`fmtC` / `fmtPctOrDims` / `fbaErrorAlertHtml`) instead of "$NaN". Kill Signal 3 is skipped unless `Number.isFinite(beAcos)` (§7). **CODE LOCATION:** `index.html` → `calcPrices` (`fbaError`), `fmtC`, `fmtPctOrDims`, `fbaErrorAlertHtml`, `needsDimsText`.
- These are non-apparel, non-dangerous-goods base rates. SIPP, low inventory, storage, inbound placement, returns and other charges are outside the rate card and must be accounted for separately.

### 1.3 Separate fuel and storage costs

`FBA.quote` applies the optional fuel/logistics multiplier **once**, from April 17, 2026, to either nonpeak or peak base fees. Tables exclude it. Fee Preview estimates already include the surcharge; they are not used as base fees — only as a calibration offset (§1.5).

The existing `surcharge` checkbox continues to control the factor. `q4storage` is a separate storage cost, retains its saved value (including zero), and must not contain manual fulfillment peak or fuel fees. The UI labels that distinction explicitly; no legacy cost is silently removed or reclassified.

### 1.4 Coverage, sale windows and rate updates

**CODE LOCATION:** `fba-rates.js` → `FBA.season`, `FBA.windowFor`, `FBA.periodCoverage`; `index.html` → `saleFeeDates`, `salePeriodFloor`, `salePeriodMargin`, `salePeriodNet`, `FBA_EXPIRY_WARN_FROM`, `fbaCoverageEnd`, `fbaExpiryWarning`.

**Peak / nonpeak windows (registered card):**

| Window | Dates (inclusive) | Table |
|---|---|---|
| Nonpeak 2026 | 2026-01-15 → 2026-10-14 | nonpeak rows |
| Holiday peak 2026 | 2026-10-15 → 2027-01-14 | peak rows |
| Fuel/logistics 3.5% | from 2026-04-17, applied once to either table | — |

`FBA.season` describes recurring seasonal boundaries, while `FBA.windowFor` requires an explicitly registered, dated official card. January 15, 2027 and future holiday seasons have **no assumed prices**. Invalid/blank/reversed dates or coverage gaps block safe sale planning and file generation.

**Highest floor across the window.** One sale price runs for the whole sale window, so `salePeriodFloor` computes break-even at one representative date per *fee class* in the window (`saleFeeDates`: every rate period it touches plus the fuel effective date) and uses the **highest** floor. A sale from Oct 1–31 is floored at the peak break-even even though half of it is nonpeak. The solver works inside price/referral bands to avoid fixed-point oscillation at fee jumps. Planner/proposal margins (`salePeriodMargin`) use the lowest margin across the same dates.

**Fee-jump rule.** Break-even is *not* monotonic — a price just above the floor can still lose money after an FBA band ($10 / $50) or referral step. See §19.8: suggestions are stepped up past the jump, and exports reject any losing price.

The existing coupon/promo erosion checks, `.90` suggestion rounding, minimum 5% discount, at-cost cent ceiling, inventory guards and named missing-COGS confirmation remain in place. Missing fee inputs block suggestions even when COGS are absent; missing COGS still means no cost floor. Sale-window dates never go stale (§19.7).

Quote timing is FC shipment departure, not order date: sellers should extend the planning window if shipments may depart after the sale ends.

**Expiry warning.** From `FBA_EXPIRY_WARN_FROM` = **2026-12-15**, the Sale Planner and Calculator show a banner that FBA rate coverage ends **2027-01-14** (`fbaCoverageEnd()` — the latest registered `end_inclusive`) and a new rate card must be added. After that date every sale window is blocked until the next card is registered.

**Rate-update procedure:**
1. Obtain the official, complete next rate card (all tiers, all three price bands, nonpeak and peak).
2. Add it as an explicit, non-overlapping entry in `CARDS` in `fba-rates.js`; update the companion JSON in `rates/` and its provenance (source URL, retrieval date).
3. Move `FBA_EXPIRY_WARN_FROM` in `index.html` to ~one month before the new card's last covered day.
4. Update the test mirror: add rows/dates for the new card to **`test-fba.js`** (it asserts every row against the JSON) and adjust any pinned dates in `test.js` (`FEE_DATE`) if the old window no longer applies.
5. Re-import the newest FBA Fee Preview so per-SKU Amazon calibration (§1.5) is refreshed.
6. Run `npm test` (both `test.js` and `test-fba.js`).

Never copy 2026 numbers into a future year on the basis of seasonal recurrence. `test.js` loads the shipped fee functions from `index.html` (no hand-copied fee engine); `test-fba.js` loads `fba-rates.js` and the actual app functions.

### 1.5 Amazon-calibrated fees (Fee Preview estimate is the authority)

**CODE LOCATION:** `index.html` → `parseAmazonFeeEstimate`, `importFBAFeePreview` (stores `inputs.amazonFee`), `fbaCalibration`, `fbaQuote`, `baseFBA`, `totalFBA`, `fbaCalibrationText`.

Compared with Amazon's own per-SKU estimate (`expected-fulfillment-fee-per-unit` in the Oct 1 2026 Fee Preview, fuel included), the published-rate engine matched 62/128 SKUs to the cent, ran 1.5–3% **high** on 65 (e.g. large-standard over 3 lb consistently +$0.22 base) and ran **$1.62 low** on one small-bulky SKU — unsafe. Amazon's per-SKU figure is therefore the authority for current fees:

- **Import:** when the Fee Preview's `expected-fulfillment-fee-per-unit` and `your-price` are both numeric, the product stores `inputs.amazonFee = { fee, price, date }` (date = local import date, `ymd()`). `"--"` (no estimate) stores nothing. `expected-future-fulfillment-fee-per-unit` is never used.
- **Calibration:** `calibration = amazonFee.fee − engine.total(inputs, amazonFee.price, amazonFee.date)`.
- **Every quote:** `fee(price, date) = engine.total(inputs, price, date) + calibration`. Amazon's actual offsets **both** nonpeak and peak; the peak table still supplies the seasonal delta. The calibration is folded into the base fee so the fuel segment stays the engine's 3.5%.
- **No `amazonFee`** (or the engine cannot quote the import date) → engine as-is.
- Shown in the Calculator rate-card banner (tooltip) and the Sale Planner suggestion tooltip: *"Calibrated to Amazon Fee Preview of <date>: ±$x"*.
- Verified 2026-10-02: through the real import + fee path, all 129 Fee Preview rows with an estimate reproduce Amazon's figure within $0.01.

---

## 2. PRICE TIER CALCULATION

### 2.1 Your Price (primary selling price)
**CODE LOCATION:** `index.html` → function `calcPrices()` → `solveMinPriceRaw()`
**Rule:** the lowest price where
  `price × (1 − targetMargin/100) − totalCosts − fbaFee(price) − referralFee(price) ≥ 0`.
  Because the FBA fee (price bands <$10 / $10–50 / >$50) and referral fee (category steps) both
  jump with price, `solveMinPriceRaw` bisects **inside each band** (edges 10, 15, 20, 50, 75, 150,
  250, 1500) and returns the first band's solution — no fixed-point iteration, so it cannot
  oscillate across a fee jump. The same solver drives the planner floor and Manufacturer Mode.
  Unverifiable FBA fee → `fbaError`, no price (§1.2).
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
**Guard:** skipped entirely unless `Number.isFinite(beAcos)` — a product with an unverifiable
  FBA fee (missing dimensions → `fbaError`) has `beAcos = NaN`, and `acos < NaN` is always false,
  which would otherwise raise a FALSE kill signal. (CODE: `checkKillSignals`, Stage 3 branch)

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

## 11. PRODUCT / CIF IMPORT FORMAT (.csv and .xlsx)

**CODE LOCATION:** `index.html` → `importCSV(event)`, `importProductsCSVText(text, filename)`,
`importProductsXlsxRows(rows, filename)`, `importProductRows(headers, rowObjs, filename, cifCogs)`,
`aliasProductHeaders(headers)`, `headersCarryCIF(rawHeaders)`, `PRODUCT_HEADER_ALIASES`

Required columns (header row must match, case-insensitive, whitespace-trimmed):
`name, asin, category, size_tier, weight_oz, cogs, target_margin`

Optional columns (omit = use default values from section 3):
`sku, inbound_shipping, inbound_placement, prep_labelling, storage, q4_storage,
ppc_per_unit, returns_allowance, vine_enrolled, vine_units, annual_units, other_overhead,
target_acos, launch_acos, cvr, notes, length_in, width_in, height_in`

`length_in, width_in, height_in` are the **packaged** dimensions in inches. When all three are
positive numbers they are stored as `inputs.dimensions` (the fee engine's dimensional weight —
`csvDimensions()`) and, when `size_tier` is absent, also pick the tier. The products CSV export
(`exportCSV`) and `products-template.csv` carry the same three columns so dimensions round-trip.

`sku` is the Amazon **Merchant SKU** — the join key used by the shipments import and the
price-feed export. It is set on create and on update; a blank cell never clears an
existing SKU (Amazon's Inventory Health import remains the other source of truth for it).

### 11.0 File formats and header aliases
**CODE LOCATION:** `index.html` → `importCSV(event)`, `aliasProductHeaders(headers)`

The `#csv-file` input accepts **`.csv`, `.xlsx` and `.xlsm`**. RULE: only the **FIRST
SHEET** of a workbook is read (via the zero-dependency `readXlsxFirstSheet()`, Section
20.1) — the partner's real CIF workbook carries unrelated reference data on sheets 2-3.
The first row containing any non-empty cell is the header row; fully blank rows are
skipped. Both formats are converted to the same row-object shape and then run through
**one** shared importer (`importProductRows`) → `validateCSVRow` → `showImportReport`, so
the two paths can never diverge in validation, defaults or reporting.

RULE: headers are alias-mapped (case-insensitive, trimmed) so the partner's CIF workbook
imports with no manual re-typing. Its sheet-1 headers are exactly
`Merchant SKU, ASIN, FNSKU, model_name, CIF`:

| File header | App column | Note |
|---|---|---|
| `CIF` | `cogs` | landed cost — also forces `inbound_shipping = 0`, see 11.2 |
| `model_name` (or `model name`) | `name` | listing name |
| `Merchant SKU` (or `merchant_sku`, `seller sku`) | `sku` | Amazon seller SKU |
| `ASIN` | `asin` | already matches once lowercased |
| `FNSKU` | *(none)* | no app field — falls through as an unknown column and is ignored |

**TO ADD an alias:** add one lowercase key to `PRODUCT_HEADER_ALIASES` (mirrored in
`test.js`) — nothing else changes.

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
**CODE LOCATION:** `index.html` → `headersCarryCIF(rawHeaders)` + the `cifCogs` branches in
`importProductRows()`

RULE: when `cogs` arrives through the **`CIF` header alias** and the row supplies no
`inbound_shipping` of its own, `inbound_shipping` is set to **0** automatically (on create
*and* on update) — CIF is a landed cost that already includes freight, so leaving the
$0.50 default in place would count freight twice, inflating total cost and understating
margin. This is the same convention as the bundled CIF seed CSV. A row that *does* carry
an `inbound_shipping` value always wins.

If your cost data is a CIF (Cost, Insurance, Freight) or other all-in landed-cost figure
that already includes inbound freight but the column is *not* named `CIF`, set `cogs` =
that figure AND `inbound_shipping = 0` yourself in the file. Otherwise inbound freight gets counted twice (once inside the landed cost,
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
5. Tool solves for minimum viable Amazon price using the same solver as product pricing (`solveMinPriceRaw`, §2.1); packaged dimensions are required for non-small-standard tiers
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
- Unverifiable FBA fee (missing dimensions) → the card shows "needs dimensions",
  never a false "no COGS can hit this margin".

**Mode B — lock COGS + margin, solve min price:**
Reuses the main solver, `solveMinPriceRaw()` — the band-aware bisection behind
`calcPrices()` (§2.1) but WITHOUT the .95 rounding. The UI shows both the exact
break-point price and the rounded Your Price (via `calcPrices`), with the margin
achieved at the rounded price. `fbaError` → "needs dimensions".

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

RULE (added 2026-08-30): rows whose ASIN already exists in the catalog are no longer
skipped — their **size tier, weight, packaged dimensions and Amazon fee estimate
(`inputs.amazonFee`, §1.5) are updated** from the report (nothing else is touched). Amazon is the source of truth for physical attributes; a stub auto-created by
the weekly import carries the default `ss`/8oz, which silently understates FBA fees and
therefore the Sale Planner's break-even floor. Re-importing the Fee Preview after a
weekly import corrects every floor. The summary reports created / updated / skipped.

Column matching is fuzzy (substring match on lower-cased, `-`/`_`-stripped headers):
ASIN, product name, product size tier, item package weight, longest/median/shortest side.
Units come from the real per-row columns **`unit-of-weight`** (pounds / ounces / grams /
kilograms) and **`unit-of-dimension`** (inches / centimeters); without them weight falls back
to the header (grams / oz / assumes lbs). `expected-fulfillment-fee-per-unit` + `your-price`
(exact header match — never the `expected-future-…` column) → `inputs.amazonFee` when both
are numeric.

Size tier strings from Amazon (e.g. `UsLargeStandardSize`, `SmallBulky`) are mapped to
this app's 5 buckets (ss/ls/sb/lb/xl) via `amazonSizeTierToAppTier()` — see Section 18.3.

### 18.2 Weekly check-in import (Business / Advertising / Inventory Health reports)
**CODE LOCATION:** `index.html` → `importAmazonReport(event)`, `detectAmazonReport(hdrs)`,
`parseBusinessReport()`, `parseAdsReport()`, `parseInventoryReport()`, `applyAmazonReports()`

The file input is **multi-select**: the user picks all three CSVs in one dialog. Each
file's type is auto-detected from its headers (2026 formats first, legacy formats as
fallbacks), and the whole batch produces **one merged check-in per matched product**
(never one per file). Files of the same kind apply in selection order (later wins
field-by-field). Direct links to each report live in `AMZ_REPORT_LINKS`; the
step-by-step guide in the import card is the backup if Amazon changes URLs.

| Report type   | Detected by                                       | Fills |
|---------------|---------------------------------------------------|-------|
| Business      | "Ordered Product Sales"                           | `totalRevenue`, `unitsSold30` ("Units Ordered"), `cvr` (product), `periodDays` (user-prompted, default 30 — the file carries no dates) |
| Advertising   | "Advertised product ID" (2026) or "Spend"+"ACoS" (legacy) | `currentAcos` = Σ Total cost ÷ Σ Sales × 100 (per ASIN across campaign rows), `totalAdSpend`, `adSales`; period parsed from the per-row "Date range" column (min start / max end) |
| Inventory Health | exact `asin`/`sku` + `available` (2026) or legacy fulfillable-quantity columns | `inventoryUnits`, **`currentPrice`** (`sales-price` when > 0, else `your-price`), plus per-ASIN report data: SKU, inbound qty, snapshot date, units/sales shipped at 7/30/60/90d |

RULE: the active `sales-price` wins over `your-price` for `currentPrice` because it is
what buyers actually see. RULE: Amazon is the source of truth for SKU — `p.sku` is
always overwritten from the Inventory Health import (it is the join key for the
shipments import and the price-feed export).

All parsed per-ASIN data is also merged into `state.reportData.byAsin` (flat record;
only fields present in the batch are overwritten) — this feeds the Sale Planner
(Section 19). Dates are formatted with a local `ymd()` helper, never
`toISOString()` (timezone-shift bug).

**Auto-create of missing products (zero-setup path).** The parsers also capture the
product name per ASIN (Business `Title`, Inventory Health `product-name` — inventory
wins). RULE: an empty catalog must never block the weekly import — when the batch
contains ASINs with no matching product, the user is asked once (`confirm()`) whether
to add them automatically. On OK, `buildReportStub(asin, rd)` creates one product per
ASIN via `createDefaultProduct()` with the report's name/SKU/ASIN and `cogs: 0` —
the zero COGS deliberately triggers the incomplete-setup banner as the nudge to import
CIF costs later. Stubs are created BEFORE the check-in loop so the same batch also
gives them their first check-in. If the user declines, the import summary lists the
unmatched ASINs alongside three recovery actions: the Fee Preview catalog-export link
(`AMZ_REPORT_LINKS.feePreview`), the "⬆ Import Inventory" flow (18.1), and the
bundled-catalog loader (`loadBundledCatalog()` — fetches the CIF seed CSV shipped
next to index.html; works over http(s), not file://).

**Fee Preview dropped into the weekly import (the misfile warning).**
**CODE LOCATION:** `index.html` → `looksLikeFeePreview(hdrs)`, the `else if` branch in
`importAmazonReport()`, rendering in `showAmzImportReport()`

RULE: a file that `detectAmazonReport()` cannot identify must never disappear into a
generic line. The FBA Fee Preview export is the file most often dropped into this import
by mistake — it looks inventory-shaped but has **no stock or velocity columns**, so the
Sale Planner ignores it entirely. `looksLikeFeePreview(hdrs)` recognises it (headers
compared in `normalizeHeaders()` form, i.e. hyphens/underscores already collapsed to
spaces) when they contain `estimated fee total`, OR `expected fulfillment fee per unit`,
OR (`product size tier` AND `your price` AND NOT `available`). The import summary then
names the file explicitly and points at the two flows that *do* consume it: **⬆ Import
Inventory** (sizes/weights, Section 18.1) and the Inventory Health report (the planner).
Any other unrecognised file still gets the generic "unrecognized report" line with its
filename.

### 18.3 Size tier string mapping
**CODE LOCATION:** `index.html` → function `amazonSizeTierToAppTier(raw)`

Maps Amazon's various size-tier export strings to this app's 5 buckets (`ss`/`ls`/`sb`/`lb`/`xl`).
Handles two real-world quirks:
1. Amazon exports size tiers as concatenated camelCase with no separator
   (e.g. `UsSmallStandardSize`) — the function inserts a space at every
   lowercase→uppercase boundary before pattern-matching, otherwise a naive
   `/small.+standard/` regex never matches (zero characters between the words).
2. "Bulky" is Amazon's current term for what used to be called "Oversize" on
   Small/Medium items. 2026 has distinct small-bulky and large-bulky rates, so
   `SmallBulky` → `sb` and `LargeBulky` → `lb`; `UsExtraLarge…` → `xl`. Legacy
   Small/Medium Oversize → `lb`, Large/Special Oversize → `xl` (dimensions decide the
   charged tier in the engine anyway).

Returns `null` for unrecognised strings; callers fall back to a default tier rather
than guessing. Covered by `test.js` against real values pulled from an actual Amazon
FBA Fee Preview export.

---

## 19. SALE PLANNER

**CODE LOCATION:** `index.html` → `renderSalePlanner()`, `plannerRows()`,
`suggestSalePrice(o)`, `roundSaleEnding(x)`, `SALE_LADDER`, `SALE_MIN_RUNWAY_DAYS`,
`SALE_MIN_OFF`, `PLANNER_COVER_THRESHOLD_DEFAULT`, `defaultSaleEndYmd(d)`, `exportPriceFile()`

Portfolio-wide view (top bar) answering: *which ASINs need faster sales in the next
month, and at what sale price?*

### 19.1 HOW A SUGGESTED SALE PRICE IS DECIDED — complete specification

This is the definitive, reviewable spec for the number in the planner's "Sale Price"
column. It lists every input variable (source column, fallback chain, decision
boundaries), the gates in exact evaluation order, the price arithmetic, a worked
example from real data, and what the model deliberately ignores. Edit any boundary
here and hand this file to an LLM agent to change the app's behaviour.

**RULE (the anchor):** every suggestion is a discount off **Your Price** — the standard
listing price. Cost data only adds guardrails; nothing else ever moves the anchor.

#### 19.1.1 Input variables

**V1 · Your Price (the anchor)**
- Source: Inventory Health `your-price` (first value > 0 per ASIN).
- Fallback: most recent check-in *Current Price*. No value → no suggestion (Gate 1).
- Used for: the base of every discount; the loss-leader test (V7).

**V2 · Sellable stock (units on hand)**
- Source: Inventory Health `available` (summed across rows per ASIN).
- Fallback: latest check-in *Current Inventory*.
- Boundaries: `≤ 0` → skip, nothing to sell (Gate 2). Numerator of sellable cover (V5).

**V3 · Sales velocity (units/day)**
- Source priority: ① Inventory Health `units-shipped-t30 ÷ 30` (fixed trailing 30-day
  window) → ② Business Report `Units Ordered ÷ periodDays` (window entered at import,
  default 30) → ③ latest check-in `Units Sold ÷ periodDays`.
- Boundary: velocity `≤ 0` while stock exists → cover is treated as **∞** (maximal
  overstock → deepest ladder rung).

**V4 · Inbound pipeline (units on the way)**
- Source: team shipments xlsx `Inbound + AWD Inbound + AWD Available`, joined by
  Merchant SKU (the ASIN↔SKU bridge comes from the Inventory Health import).
- Fallback: Inventory Health `inbound-quantity`.
- DELIBERATE BOUNDARY: quantities only — per-batch ETA date columns in the shipments
  sheet are **not parsed**. Arrival timing is proxied by the 45-day runway guard (V5/G7)
  instead of per-shipment dates. If you want date-aware logic, edit this rule.

**V5 · Sellable cover (days)** = V2 ÷ V3 — how long on-hand stock lasts at current speed.
- Boundary: `< 45` (`SALE_MIN_RUNWAY_DAYS`) → a sale cannot start now (Gate 7 → `wait`),
  because a ~31-day sale window at accelerated velocity would stock out before inbound lands.

**V6 · Pipeline cover (days)** = (V2 + V4) ÷ V3 — how long ALL known stock lasts. This is
the **decision cover**: both the "needs faster sales?" test and the ladder rung read it
(falls back to V5 when no pipeline data exists; behaviour is then identical to the
pre-pipeline model).
- Boundaries: `≤ 120` (threshold, editable per session in the planner; default
  `PLANNER_COVER_THRESHOLD_DEFAULT`) → healthy, no sale. Ladder rungs at
  `>120 / ≥180 / ≥240 / ≥365-or-∞`.
- RULE: 120 because Amazon's aged-inventory surcharge starts at 181 days — act before it.

**V7 · Break-even price (the floor)**
- Source: `solveMinPriceRaw` at margin 0 — CIF landed COGS + inbound shipping + placement +
  prep + storage + Q4 storage + PPC + returns + overhead + Vine per-unit cost (200 ÷ annual
  units when Vine is on) + live FBA & referral fees + fuel surcharge, solved
  iteratively because the fees depend on the price (Sections 1–2).
- Absent (COGS blank/0, e.g. report-created stubs) → **easy mode**: no floor and Gates
  3–4 are skipped; ladder only.
- Boundaries: Your Price `<` break-even → loss leader, excluded (Gate 3). Candidate sale
  price `<` break-even → raised to break-even, rounded UP to the cent (sells at cost, never below). Raised floor `>` the 5%
  cap → `blocked` (Gate 8/P4 — no profitable sale exists).

**V8 · Realized price, trailing 30d** = `sales-shipped-last-30-days ÷ units-shipped-t30`
— the average price buyers actually paid.
- Boundary: realized `<` break-even while Your Price `≥` break-even → excluded
  (Gate 4: promos are already selling below water; do not deepen).
- Display boundary: realized `< 97% ×` Your Price with no active sale-price set → amber
  "selling below Your Price — deal/coupon?" badge (informational only).
- Captures price discounts and deals; does NOT capture coupon clip rebates — deliberately
  out of scope (confirmed not SOP).

**V9 · Sale window** — start = today; end = last day of the current month, rolling to
next month-end when fewer than 7 days (including today) remain (`SALE_END_ROLL_DAYS`,
`defaultSaleEndYmd`). Both editable.

#### 19.1.2 Decision gates — exact evaluation order (`suggestSalePrice`)

| # | Condition | Outcome |
|---|-----------|---------|
| G1 | V1 Your Price ≤ 0 / missing | `no_data / no_price` — cannot anchor |
| G2 | V2 sellable stock ≤ 0 | `skip / no_stock` |
| G3 | V7 exists AND Your Price < break-even | `skip / loss_leader` — deliberate, never deepen |
| G4 | V7 exists AND V8 realized < break-even ≤ Your Price | `skip / below_breakeven_promo` |
| G5 | V6 decision cover unknowable (no velocity/stock data) | `no_data / no_velocity` |
| G6 | V6 decision cover ≤ threshold (120) | `keep / healthy` — no sale needed |
| G7 | V5 sellable cover < 45 (pipeline promoted the row) | `wait / thin_stock_inbound` — discount after inbound lands |
| G8 | otherwise | `sale` → price arithmetic below (or `blocked`, P4) |

#### 19.1.3 Price arithmetic (only when G8 is reached)

- **P1 — ladder rung** from V6 decision cover: ≥ 365d or ∞ → **20%** · ≥ 240d → **15%**
  · ≥ 180d → **12%** · ≥ 120d → **8%** · (> threshold when threshold set below 120 → 5%).
- **P2 — promo rounding**: candidate = `roundSaleEnding(YourPrice × (1 − rung))` →
  the highest `.90` ending at or below x: `floor(x) + 0.90`, minus $1 if that exceeds x
  (22.954 → 22.90, 31.92 → 31.90, 26.31 → 25.90; never below $1). Fixed 2026-10-01 — the
  previous `floor(x) − 0.10` dropped a whole extra dollar whenever x's cents were ≥ .90.
- **P3 — badge cap**: candidate may not exceed `YourPrice × 0.95` (`SALE_MIN_OFF` —
  Amazon shows no sale badge under 5% off).
- **P4 — cost floor**: if candidate < V7 break-even → raise to break-even rounded UP to
  the next cent (an "at cost" sale: moves stock, never sells below break-even; e.g. 12.1626
  → 12.17). If the raised price exceeds the P3 cap →
  `blocked / floor_above_5pct` — no profitable badge-worthy sale exists; a human decides.

#### 19.1.4 Worked example (real row, August 2026 plan)

4ft Zinc cast net `LY-QQ62-JS2I`: Your Price **$24.95**, 804 sellable, 469 sold/30d
→ velocity 15.63/day → sellable cover 804 ÷ 15.63 = **51.4d**; +1,504 inbound → pipeline
cover (804 + 1,504) ÷ 15.63 = **147.6d**.
G1–G5 pass · G6: 147.6 > 120 → needs faster sales · G7: 51.4 ≥ 45 → no wait ·
P1: 120 ≤ 147.6 < 180 → 8% rung → candidate 24.95 × 0.92 = 22.954 → P2
`roundSaleEnding(22.954)` = **$22.90** (highest .90 at or below) · P3 cap $23.70 ok ·
P4: break-even **$23.2884** > 22.90 → raised and rounded up to **$23.29 (at cost)**.
Shipped exactly so in the 2026-08 upload.

#### 19.1.5 What the model deliberately does NOT use

- **Shipment ETA dates** — quantity only; timing proxied by the 45-day runway guard.
- **Coupons / promotion rebates** — invisible in transaction data; confirmed not SOP.
- **Competitor / featured-offer price** — `featuredoffer-price` exists in the Inventory
  Health export but is unused; suggestions never chase the buy box.
- **Ad spend / ACoS** — shown in check-ins and reports, not a pricing input.
- **Seasonality** — no month-of-year adjustments; the Strategy Guide calendar is advice,
  not automation.

Any of these can be promoted to a rule: edit this section to say what should matter and
with what boundaries, then hand the file to an agent.

#### 19.1.6 Where each boundary lives (for edits)

| Boundary | Constant / function | Current value |
|----------|--------------------|---------------|
| Needs-faster-sales threshold | `PLANNER_COVER_THRESHOLD_DEFAULT` (+ planner input) | 120 days |
| Discount ladder | `SALE_LADDER` | 365/240/180/120 → 20/15/12/8% |
| Minimum discount (badge) | `SALE_MIN_OFF` | 5% |
| On-hand runway guard | `SALE_MIN_RUNWAY_DAYS` | 45 days |
| Promo price ending | `roundSaleEnding()` | highest .90 at or below the discounted price |
| Sale window default | `defaultSaleEndYmd()` | month-end, <7 days → next month |
| Sale-window roll threshold | `SALE_END_ROLL_DAYS` (used by `defaultSaleEndYmd()` + 📐 viewer) | 7 days (incl. today) |
| Inventory staleness | `INVENTORY_STALE_DAYS` | 7 days (see 19.5) |
| Break-even floor | `solveMinPriceRaw(margin 0)`, rounded up to the cent in `suggestSalePrice` | from CIF + fee tables |

### 19.2 Overrides

Products auto-created from Amazon reports (18.2 stubs, `cogs: 0`) run in easy mode until
CIF costs are imported. Per-row price and inclusion overrides persist in
`state.planner.overrides[productId]`; default inclusion = `action === 'sale'`.

### 19.3 Price-feed export
`exportPriceFile()` collects checked rows (requires a SKU — rows without one are
listed as skipped), validates start ≤ end, and downloads
`PriceUpdate-Sale-<end>.xlsx` built by `buildPriceFeedXlsx()` (Section 20.2).
RULE: sale end defaults to the **last day of the current month** regardless of upload
date (`defaultSaleEndYmd`) — but rolls to the end of NEXT month when fewer than **7 days**
(including today) remain. A sale window shorter than a week is never the intent of a
month-end sale plan: the price feed takes a day to process and shoppers need time to see
the badge, so with fewer than 7 days left the user is planning NEXT month. (Threshold
raised from 3 to 7 on 2026-08-30 after an Aug-29 export produced a 3-day Aug 29 → Aug 31
sale.) The date field stays editable either way.
Rows discounted <5% are exported but the summary warns Amazon may not show a badge.

### 19.5 Export guards — stale inventory & missing cost floors
**CODE LOCATION:** `index.html` → `inventorySnapshotAge(byAsin, todayYmd)`,
`INVENTORY_STALE_DAYS`, `floorlessCount(rows)`, banners in `renderSalePlanner()`,
`confirm()` gates + summary lines in `exportPriceFile()`

Two silent failure modes once produced a bad price plan on the same day: the planner ran
on a **29-day-old** Inventory Health snapshot, and **every** product had `cogs = 0` so no
break-even floor applied anywhere. Both are now visible in the planner and both gate the
export.

**Staleness (F2).** `inventorySnapshotAge()` returns the **newest** `snapshotDate` found in
`state.reportData.byAsin` plus its age in whole days, or `null` when no snapshot exists at
all. Day counts go through `Date.UTC()` on the plain `YYYY-MM-DD` strings, so a European
clock change can never shift the answer by a day. Boundary: an age **strictly greater
than** `INVENTORY_STALE_DAYS` (7) is stale — exactly 7 days old is still fine.

- Planner (`renderSalePlanner`) shows a warning banner above the table:
  *"No Inventory Health snapshot imported — the planner is using old or fallback data."*
  when null, or *"Inventory data is N days old (snapshot YYYY-MM-DD). Download a fresh
  Inventory Health report before uploading prices."* when stale.
- `exportPriceFile()` prepends the same warning to the export summary **and** requires a
  `confirm()` ("Inventory data is N days old — export anyway?") before the file is built.
  Cancel = no file, no report.

**No cost floor (F3).** `floorlessCount(rows)` counts rows whose product has `cogs <= 0`
(missing or unparseable COGS counts as floorless — an unreadable cost is not protection).
Those rows run in easy mode: the ladder still suggests a price but nothing stops it going
below landed cost.

- Planner shows: *"N of M sale rows have no cost data (COGS) — no break-even floor
  protects them. Import CIF costs first."* over the rows currently ticked for export.
- `exportPriceFile()` lists the affected **SKUs** in the summary and requires a `confirm()`
  naming the count before proceeding.

RULE: easy mode is a documented feature (Section 19.2) so neither guard is a hard block —
but it must be **impossible** to export floorless rows, or to export off stale inventory,
without seeing exactly which rows and how old the data is.

**Remedies live in the guards themselves (2026-08-30).** A warning that offers no way out
is what let the original incident ship, so each guard now names its fix inline:
- The stale / missing-snapshot banners carry a direct **↗ Open Inventory Health report**
  link (`AMZ_REPORT_LINKS.inventory`, `target="_blank"`) so a fresh snapshot is one click
  away. The `confirm()` gate stays text-only (a native dialog cannot hold a link).
- The floorless banner is one coherent block that also carries a **⚡ Load bundled catalog**
  button (`loadBundledCatalog()`) plus *"then re-import the team's newest CIF workbook — see
  ❓ How to use."*
- The floorless export `confirm()` appends the remedy sentence *"Fix: load the bundled
  catalog (⚡) and import the newest CIF workbook, then re-open the planner."* before
  "Export anyway?".

### 19.4 Proposal review report
**CODE LOCATION:** `index.html` → `collectPlanItems()`, `buildProposalModel()`,
`buildProposalReportHtml()`, `escHtml()`, `openProposalReport()`

Every price plan ships with a polished, self-contained HTML **Month-End Sale Proposal**
document that a human reviews or shares.

RULE: `collectPlanItems()` is the **single source of truth** for which planner rows ship
and at what effective price — effective include = `override.include ?? (suggestion action
is 'sale')`, effective price = `override.price ?? (suggested price || break-even floor)`.
Both the `.xlsx` export (`exportPriceFile`) and the report (`buildProposalModel`) derive
their item list from it, so the report can never describe a different set of SKUs than the
upload file. It reads state, so it is not a pure function and is not mirrored in `test.js`
(the include/price rule it encodes is covered through the `suggestSalePrice` + XLSX
round-trip tests).

`buildProposalModel(start, end)` (impure, untested) assembles a plain model from state:
`window`, `generatedAt`, `lang`, `threshold`, `ladder`/`minRunwayDays`/`minOffPct` (copied
from the code constants so the document never drifts), `included` (per shipped row: sku,
name, yourPrice, activeSale, realized30, newPrice — the effective post-override price —
offPct, marginAtNew via `feeWaterfall` when COGS>0 else null, coverSellable, coverPipeline,
inbound, and the flags `floored` / `overridden` / `aboveActiveSale` / `atCost` /
`reasonRung`), `waits` (rows with `wait` action), `excludedCounts` + `excludedExamples`
(loss-leader / promo-eroded / blocked / healthy / no-data buckets, ≤5 example SKUs each),
`freshness` (business/ads/inventory dates + optional shipments and CIF file+date), plus
counts and `avgOffPct`.

`buildProposalReportHtml(model)` is **PURE** (mirrored + tested): it returns a complete
standalone `<!doctype html>` document string. Report language follows `model.lang` via a
local `L(en, zh)` dictionary — the app's `t()` is **not** called inside it. All user data
(product names, SKUs) is escaped through `escHtml()` (`& < > " '`). The document embeds the
reference palette CSS (stat strip, striped tables, callouts, print CSS). RULE: **hex colours
are allowed inside this returned string** — it is a standalone exported artifact, not app UI,
so the "colours via `var(--c-*)` only" house rule does not apply to the report; the report's
own `:root` defines `--ink/--acc/--mut/…`. A sticky print **toolbar** (🖨 Save as PDF →
`window.print()`, hidden by `@media print`) is the delivery mechanism to PDF.

**Delivery.** Shared helper `deliverProposalReport(html, fileName)`: opens the report
via `URL.createObjectURL(new Blob([html],{type:'text/html'}))` + `window.open(url,'_blank')`
from the direct user gesture (not popup-blocked); if `window.open` returns null it falls
back to an anchor download of `PriceUpdate-Sale-<end>-report.html`. Blob URLs are revoked
on a 60s timer so the new tab can finish loading. RULE: `exportPriceFile()` must use the
tab (not a download) for the report — a second programmatic download in the same click as
the `.xlsx` is silently dropped by Chromium's multiple-download policy (observed in
testing: the alert claimed a file that never arrived). The summary alert words the
delivery accordingly ('opened in a new tab' vs 'also saved'). Callers:
`openProposalReport()` (📄 Review Report button) and `exportPriceFile()`. The planner
**empty state** shows no report button (nothing to report).

### 19.6 Sale Planner how-to modal
The Sale Planner is an order-dependent monthly workflow (costs → three reports → FBA Fee
Preview → optional shipments → review → export) and users get the sequence wrong. A
**"❓ How to use"** button in the planner header opens a modal with the six-step SOP,
bilingual, quoting the exact UI button names so users can match them. It reuses the
`flow-modal` shell/styling of the top-bar "? Guide" for consistency, and its footer
points to the 📐 Pricing Rules viewer (Section 21) for the full decision spec.

**Actionable steps (2026-08-30).** Every step that names a button now carries a small
`topbar-btn` that performs it directly, so the guide is a control panel rather than a
description. Each picker button first `closeModalEl('planner-howto-modal')` and only then
`.click()`s the hidden file input, so the OS file dialog is never stacked under the modal
overlay: step 1 → **Import CSV/XLSX** (`#csv-file`) + **⚡ Load bundled catalog**
(`loadBundledCatalog()`); step 2 → **⬆ Import Amazon Reports** (`#amz-report-file`); step 3
→ **⬆ Import Inventory** (`#fba-preview-file`); step 4 → **Import shipments xlsx**
(`#shipments-file`). Step 6 keeps text only — the export button lives in the planner itself.

Wherever a report must be downloaded the step also shows a direct Seller-Central link
(`<a target="_blank" rel="noopener">`): step 2 → Business / Ads / Inventory Health, step 3
→ Fee Preview. Those anchors carry a `data-amzlink` key (`business` / `ads` / `inventory` /
`feePreview`) and their `href` is populated from the single `AMZ_REPORT_LINKS` constant in
`openModalEl()` when the modal opens, so a URL edit never has to be duplicated in the static
markup. Step 1's NOTE spells out the real lesson: the bundled seed covers products up to
**2026-07-18**, any CIF workbook only covers products existing at its export date, so import
BOTH (bundled seed first, newest workbook on top) and ask the team for an updated CIF export
whenever the floorless warning names products.

**CODE LOCATION:** `index.html` → the `❓ How to use` button rendered in the header block
of `renderSalePlanner()` (calls `openModalEl('planner-howto-modal')`), the static modal
`#planner-howto-modal` (a `.flow-modal-overlay`) with its inline step buttons and
`a[data-amzlink]` links, and the `id === 'planner-howto-modal'` link-population branch in
`openModalEl()`.

### 19.7 Sale window dates never go stale
**CODE LOCATION:** `index.html` → `saleFeeWindow()`, `plannerSetDate()`, `exportPriceFile()`,
`openProposalReport()`

The planner persists `state.planner.startDate` / `endDate`. Saved dates used to be reused
forever, so a plan opened weeks later floored and exported a window that had already passed.
RULE (all dates local `ymd()`, never `toISOString`):
- saved end date **before today** → the window falls back to **today → `defaultSaleEndYmd(today)`**
  and the saved dates are updated;
- the start date is always **clamped to today** — the start shown in the planner and written to
  the price feed is never in the past (export and the review report normalise through
  `saleFeeWindow()` after validating the typed dates).

### 19.8 Fee-jump guard (break-even is not monotonic)
**CODE LOCATION:** `index.html` → `salePeriodNet()`, `feeJumpSafePrice()`, post-processing in
`plannerRows()`, export check in `exportPriceFile()`; reason key `fee_jump` in `REASON_TXT`.

`solveMinPriceRaw` returns the **lowest** profitable price, but FBA price bands ($10 / $50) and
referral steps mean a price just **above** that floor can lose money. Reviewer probe:
small-standard 8 oz, fixed costs $5.20 → floor **$9.36**, yet **$10.00 nets −$0.36** (the $10
band adds $0.91 of FBA fee).

- **Suggestions.** `suggestSalePrice` is unchanged. Afterwards, for rows with a cost floor,
  `plannerRows` checks the suggested price nets ≥ $0 on **every fee class in the window**
  (`salePeriodNet` over `saleFeeDates`). If not, `feeJumpSafePrice` steps up to the next **.90**
  ending, then (if no .90 fits) by cents, until profitable on all dates. Nothing profitable at
  or below the 5%-off cap (`yourPrice × 0.95`) → `blocked` / `fee_jump`. A stepped-up row keeps
  `sug.feeJumpFrom` and says so in its tooltip.
- **Export.** `exportPriceFile` rejects every row with costs whose **final** price — including a
  manual override — loses money on any date in the window, listing `SKU @ $price`. No file is
  built.
- Floorless rows (no COGS) are not checked: they have no cost to protect (§19.5 still names them).

## 20. ZERO-DEPENDENCY XLSX READ / WRITE

### 20.1 Reader (incoming shipments, F4)
**CODE LOCATION:** `index.html` → `unzip()`, `parseXlsxSharedStrings()`,
`parseXlsxSheet()`, `readXlsxFirstSheet()`, `importShipmentsXlsx(event)`

Parses the team's 总体控制表 `.xlsx` in the browser with no libraries: manual ZIP
central-directory walk (EOCD scan over the last 64KB), DEFLATE entries inflated via
the native `DecompressionStream('deflate-raw')` (browsers + Node 18+, so `test.js`
exercises the same code), worksheet XML parsed with regex (no DOMParser — Node-testable),
shared strings with rich-text runs concatenated. Header row is located by the exact
cell `Merchant SKU`; `Inbound` is matched exactly (substring would collide with
`AWD Inbound`). Result stored as `state.shipments.bySku` — the file has **no ASIN
column**, so SKU (captured by the Inventory Health import) is the join key.

### 20.2 Writer (Amazon price feed, F5)
**CODE LOCATION:** `index.html` → `buildPriceFeedXlsx()`, `zipStore()`, `crc32()`,
`sheetXmlFromRows()`, plus the embedded `PQ_TEMPLATE_*` header constants

Emits a real `.xlsx` cloning Amazon's PriceAndQuantity template: the verbatim
`settings=feedType=256…` string in A1 (declares `labelRow=4&attributeRow=5&dataRow=7`),
label/attribute header rows reproduced byte-for-byte, data from row 7 with SKU (col A),
Sale Price as a number (col K), Sale Start/End as `YYYY-MM-DD` strings (cols L/M).
ZIP entries are **STORED** (method 0) so no compression API is needed; inline strings
avoid sharedStrings. Round-tripped in `test.js` through the Section 20.1 reader and
validated externally with openpyxl against the original template.

## 21. RULES VIEWER & EDIT LOOP

**CODE LOCATION:** `index.html` → `rulesLiveData()`, `buildRulesHtml(data)`,
`openRulesModal()`, `downloadRulesDoc()`, `fetchRulesDoc()`, and the `rules-modal` markup.
Entry points: the 📐 Pricing Rules button in the Sale Planner controls card (next to
📄 Review Report) and in the Strategy Guide `sg-rules` ("2026 Rules") sub-panel.

The in-app **📐 Pricing Rules** modal shows, in plain language, every rule behind the
price/sale calculations (how a sale price is decided, the discount ladder, the guardrails,
inventory status thresholds, price-tier derivations, fee assumptions) and lets the user
download this file for editing.

**Truth by construction.** `rulesLiveData()` reads the *actual* live constants
(`SALE_LADDER`, `SALE_MIN_OFF`, `PLANNER_COVER_THRESHOLD_DEFAULT`, the live
`state.planner.coverThreshold`, `SALE_MIN_RUNWAY_DAYS`, `STOCKOUT_RISK_DAYS`,
`REORDER_SOON_DAYS`, `AGED_INVENTORY_DAYS`, `SALE_END_ROLL_DAYS`, `FEE_SCHEDULE` +
`FUEL_SURCHARGE`, and the price-tier constants `LIST_PREMIUM`/`SALE_DISCOUNT`/`CLEARANCE_DISCOUNT` +
`PRICE_*_END`) — never a hardcoded copy — and passes them to `buildRulesHtml(data)`.
`buildRulesHtml` is **PURE** (mirrored + tested in `test.js`); it renders bilingually via a
local `L(en, zh)` (not the app `t()`) and uses only `var(--c-*)` palette colours (it is app
UI, so the colours-via-vars house rule applies — unlike the standalone proposal report).
Because every *number* in the summary comes from the same live constants the engine uses
(since 2026-10-01 the sale-window line too, via `SALE_END_ROLL_DAYS`), re-tuning a value
cannot make the summary drift. The prose around those numbers is still hand-written, so
changing *how* a rule works — not just its value — still means editing `buildRulesHtml()`.
`rulesLiveData()`/`openRulesModal()`/`downloadRulesDoc()`/`fetchRulesDoc()` read
state/DOM/network and are not mirrored.

**Fetch fallback chain (`fetchRulesDoc`).** `LOGIC.md` is fetched lazily once per session
and cached in the module-level `_rulesDocMd`: relative `LOGIC.md?t=<ts>` first (works on the
deployed site and localhost), then `https://raw.githubusercontent.com/at10249/bg-amazon-pricing-tool/main/LOGIC.md?t=<ts>`
(works from `file://` with internet) — the same resilience pattern as `loadRoadmap()`. It is
rendered with `mdToHtml()`; total failure shows the GitHub link.

**The edit loop.** `downloadRulesDoc()` saves this file as `pricing-rules-LOGIC.md`. **THIS
FILE is the download artifact.** The intended workflow: user downloads it → edits any
threshold, ladder step, guardrail, or fee assumption in plain language → hands the edited
file to an LLM/coding agent with *"Update index.html to match this edited LOGIC.md — every
rule has a CODE LOCATION reference. Mirror changed constants in test.js and run npm test."*
The proposal report's methodology (Section 19.4) points at the same viewer.

**TO UPDATE:** the viewer needs no maintenance when a constant changes — `rulesLiveData()`
picks up the new value automatically. Only edit `buildRulesHtml()` (and its `test.js` mirror)
when adding or removing a *rule*, not when re-tuning an existing number.

---

*Last updated: August 2026*
*To update this document after modifying the code, ask an LLM: "Update LOGIC.md to reflect the change I made to [function/constant name]"*
