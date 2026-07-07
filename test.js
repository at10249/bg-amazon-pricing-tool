// ─────────────────────────────────────────────────────────────────────────────
// BG Amazon Pricing Tool — Logic & Calculation Tests
// Run with: npm test  (or: node test.js)
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants (mirrored from app — update here when changing app constants) ──
const VINE_COST            = 200;
const VINE_WINDOW_DAYS     = 30;
const S1_MIN_DAYS          = 3;
const S1_KILL_DAYS         = 14;
const S2_MIN_DAYS          = 30;
const S2_AD_SALES_TARGET   = 40;
const S2_KILL_DAYS         = 60;
const S3_ACOS_BUFFER       = 3;
const S3_KILL_DAYS         = 90;
const K4_SPEND_RATIO       = 1.5;
const STALE_DAYS           = 21;
const PRICE_LIST_END       = 0.99;
const PRICE_YOUR_END       = 0.95;
const PRICE_SALE_END       = 0.90;
const PRICE_DISC_END       = 0.97;
const SALE_DISCOUNT        = 0.94;
const CLEARANCE_DISCOUNT   = 0.91;
const LIST_PREMIUM         = 1.10;
const PRICE_MATCH_TOLERANCE= 0.02;
const SENSITIVITY_OFFSETS  = [-2, -1, 0, 1, 2];

// ── Functions (mirrored from app) ────────────────────────────────────────────
function getReferralFee(catKey, price) {
  const m = (r) => Math.max(0.30, price * r);
  switch(catKey) {
    case '15':   return m(0.15);
    case '15b':  return Math.max(0.30, price < 10  ? price*0.08 : price*0.15);
    case '15c':  return Math.max(0.30, price < 15  ? price*0.08 : price*0.15);
    case '17':   return price<=15 ? m(0.05) : price<=20 ? m(0.10) : m(0.17);
    case '15s':  return price<=75 ? m(0.05) : price<=150 ? m(0.10) : m(0.15);
    case '8':    case '8c': case '8cam': return m(0.08);
    case '6p':   return m(0.06);
    case '6':    return m(0.075);
    case '20j':  return price<=250 ? m(0.20) : Math.max(0.30, 250*0.20+(price-250)*0.05);
    case '16w':  return price<=1500 ? Math.max(2.00,price*0.16) : Math.max(2.00,1500*0.16+(price-1500)*0.03);
    case '20':   return price*0.20;
    case '45':   return m(0.45);
    case '12':   return m(0.15) + 1.80;
    default:     return m(0.15);
  }
}

const SS_TABLE = [
  [2,2.43,3.32,3.58],[4,2.49,3.42,3.68],[6,2.56,3.45,3.71],[8,2.66,3.54,3.80],
  [10,2.77,3.68,3.94],[12,2.82,3.78,4.04],[14,2.92,3.91,4.17],[16,2.95,3.96,4.22]
];
const LS_TABLE = [
  [4,2.91,3.73,3.99],[8,3.13,3.95,4.21],[12,3.38,4.20,4.46],[16,3.78,4.60,4.86],
  [20,4.22,5.04,5.30],[24,4.60,5.42,5.68],[28,4.75,5.57,5.83],[32,5.00,5.82,6.08],
  [36,5.10,5.92,6.18],[40,5.28,6.10,6.36],[44,5.44,6.26,6.52],[48,5.85,6.67,6.93]
];

function getFBAFee(tier, wOz, price) {
  const b = price < 10 ? 0 : price <= 50 ? 1 : 2;
  if (tier === 'ss') {
    for (const r of SS_TABLE) if (wOz <= r[0]) return r[b+1];
    return SS_TABLE[SS_TABLE.length-1][b+1];
  }
  if (tier === 'ls') {
    if (wOz > 48) { const bases=[6.15,6.97,7.23]; return bases[b]+Math.ceil((wOz-48)/4)*0.08; }
    for (const r of LS_TABLE) if (wOz <= r[0]) return r[b+1];
    return 6.97;
  }
  if (tier === 'lb') return [9.61,10.10,10.84][b];
  if (tier === 'xl') return [26.33,27.12,28.01][b];
  return 3.96;
}

function roundEnd(raw, cents) {
  let c = Math.floor(raw) + cents;
  while (c < raw) c += 1;
  return c;
}

function calcPrices(inputs) {
  const { category, sizetier, weight, cogs, margin, inbound, placement, prep,
    storage, q4storage, ppc, returns, vine, vineUnits, annualUnits, other,
    tacos, lacos, cvr, surcharge } = inputs;
  const vinePerUnit = vine ? (VINE_COST / Math.max(annualUnits, 1)) : 0;
  const otherCosts = inbound + placement + prep + storage + q4storage + ppc + returns + other + vinePerUnit;
  const totalFixed = cogs + otherCosts;
  let yp = totalFixed / (1 - margin/100);
  for (let i = 0; i < 12; i++) {
    const fbaB = getFBAFee(sizetier, weight, yp);
    const fba  = fbaB * (surcharge ? 1.035 : 1.0);
    const ref  = getReferralFee(category, yp);
    yp = (totalFixed + fba + ref) / (1 - margin/100);
  }
  yp = roundEnd(yp - (1 - PRICE_YOUR_END), PRICE_YOUR_END);
  const getAll = (price) => {
    const fbaB = getFBAFee(sizetier, weight, price);
    const fba  = fbaB * (surcharge ? 1.035 : 1.0);
    const ref  = getReferralFee(category, price);
    const profit = price - cogs - fba - ref - otherCosts;
    return { fba, ref, profit, pct: profit/price*100, otherCosts };
  };
  const listP = roundEnd(yp * LIST_PREMIUM - (1 - PRICE_LIST_END), PRICE_LIST_END);
  const saleP = roundEnd(yp * SALE_DISCOUNT - (1 - PRICE_SALE_END), PRICE_SALE_END);
  // Guard: for cheap products (<~$8), rounding can push discP above saleP — step down one dollar
  let discP = roundEnd(saleP * CLEARANCE_DISCOUNT - (1 - PRICE_DISC_END), PRICE_DISC_END);
  if (discP >= saleP) discP -= 1;
  const ypF    = getAll(yp);
  const listF  = getAll(listP);
  const saleF  = getAll(saleP);
  const discF  = getAll(discP);
  const maxCPC = yp * (tacos/100) * (cvr/100);
  const beAcos = ypF.pct;
  return { yp, listP, saleP, discP, ypF, listF, saleF, discF,
    cogs, otherCosts, vinePerUnit, maxCPC, beAcos,
    targetRoas: 100/tacos, launchRoas: 100/lacos,
    maxCPClaunch: yp * (lacos/100) * (cvr/100) };
}

function priceSensitivity(inputs, basePrice) {
  const vinePerUnit = inputs.vine ? (VINE_COST / Math.max(inputs.annualUnits, 1)) : 0;
  const otherCosts = inputs.inbound + inputs.placement + inputs.prep + inputs.storage
    + inputs.q4storage + inputs.ppc + inputs.returns + inputs.other + vinePerUnit;
  return SENSITIVITY_OFFSETS.map(offset => {
    const price = +(basePrice + offset).toFixed(2);
    if (price <= 0) return { offset, price, fba: NaN, ref: NaN, profit: NaN, pct: NaN, valid: false, isCurrent: offset === 0 };
    const fba = getFBAFee(inputs.sizetier, inputs.weight, price) * (inputs.surcharge ? 1.035 : 1.0);
    const ref = getReferralFee(inputs.category, price);
    const profit = price - inputs.cogs - fba - ref - otherCosts;
    return { offset, price, fba, ref, profit, pct: profit / price * 100, valid: true, isCurrent: offset === 0 };
  });
}

function breakEvenUnits(monthlyOverheads, profitPerUnit) {
  if (!(monthlyOverheads > 0)) return 0;
  if (!(profitPerUnit > 0)) return null;
  return Math.ceil(monthlyOverheads / profitPerUnit);
}

function landedCostUSD(cnyPrice, rate, dutyPct, freightPerUnit) {
  if (!(cnyPrice > 0) || !(rate > 0)) return null;
  const goodsDuty = (cnyPrice / rate) * (1 + (dutyPct > 0 ? dutyPct : 0) / 100);
  const freight = freightPerUnit > 0 ? freightPerUnit : 0;
  return { goodsDuty, freight, total: goodsDuty + freight };
}

const FUEL_SURCHARGE = 1.035;

function feeWaterfall(inputs, price) {
  if (!(price > 0)) return null;
  const vinePerUnit = inputs.vine ? (VINE_COST / Math.max(inputs.annualUnits, 1)) : 0;
  const fbaBase = getFBAFee(inputs.sizetier, inputs.weight, price);
  const fuel = inputs.surcharge ? fbaBase * (FUEL_SURCHARGE - 1) : 0;
  const ref = getReferralFee(inputs.category, price);
  const logistics = inputs.inbound + inputs.placement + inputs.prep + inputs.storage + inputs.q4storage;
  const returnsOverhead = inputs.returns + inputs.other + vinePerUnit;
  const net = price - ref - fbaBase - fuel - inputs.cogs - logistics - inputs.ppc - returnsOverhead;
  return {
    price,
    segments: [
      { key: 'referral',        amount: ref },
      { key: 'fba',             amount: fbaBase },
      { key: 'fuel',            amount: fuel },
      { key: 'cogs',            amount: inputs.cogs },
      { key: 'logistics',       amount: logistics },
      { key: 'ppc',             amount: inputs.ppc },
      { key: 'returnsOverhead', amount: returnsOverhead },
      { key: 'net',             amount: net }
    ],
    net,
    netPct: net / price * 100
  };
}

function solveMaxCOGS(inputs, targetPrice, targetMarginPct) {
  if (!(targetPrice > 0) || !(targetMarginPct < 100)) return null;
  const vinePerUnit = inputs.vine ? (VINE_COST / Math.max(inputs.annualUnits, 1)) : 0;
  const otherCosts = inputs.inbound + inputs.placement + inputs.prep + inputs.storage
    + inputs.q4storage + inputs.ppc + inputs.returns + inputs.other + vinePerUnit;
  const fba = getFBAFee(inputs.sizetier, inputs.weight, targetPrice) * (inputs.surcharge ? FUEL_SURCHARGE : 1);
  const ref = getReferralFee(inputs.category, targetPrice);
  const maxCogs = targetPrice * (1 - targetMarginPct / 100) - fba - ref - otherCosts;
  return { maxCogs, fba, ref, otherCosts, gap: maxCogs - inputs.cogs };
}

function solveMinPriceRaw(inputs) {
  if (!(inputs.margin < 100)) return null;
  const vinePerUnit = inputs.vine ? (VINE_COST / Math.max(inputs.annualUnits, 1)) : 0;
  const otherCosts = inputs.inbound + inputs.placement + inputs.prep + inputs.storage
    + inputs.q4storage + inputs.ppc + inputs.returns + inputs.other + vinePerUnit;
  const totalFixed = inputs.cogs + otherCosts;
  let yp = totalFixed / (1 - inputs.margin / 100);
  for (let i = 0; i < 40; i++) {
    const fba = getFBAFee(inputs.sizetier, inputs.weight, yp) * (inputs.surcharge ? FUEL_SURCHARGE : 1);
    const ref = getReferralFee(inputs.category, yp);
    yp = (totalFixed + fba + ref) / (1 - inputs.margin / 100);
  }
  return yp;
}

function classifyPrice(currentPrice, prices) {
  if (!currentPrice || currentPrice <= 0) return null;
  const tol = PRICE_MATCH_TOLERANCE;
  const within = (a, b) => Math.abs(a - b) / b <= tol;
  if (within(currentPrice, prices.listP))   return { label: 'At List Price / MSRP', cls: 'pm-above' };
  if (within(currentPrice, prices.yp))      return { label: 'At Your Price (normal)', cls: 'pm-normal' };
  if (within(currentPrice, prices.saleP))   return { label: 'Running Sale Price', cls: 'pm-sale' };
  if (within(currentPrice, prices.discP))   return { label: 'Running Clearance Price', cls: 'pm-clearance' };
  if (currentPrice > prices.listP)          return { label: 'Above List Price — check', cls: 'pm-above' };
  if (currentPrice < prices.discP)          return { label: 'Below Clearance — urgent', cls: 'pm-below' };
  return { label: 'Custom price', cls: '' };
}

const CAT_MAP = { home:'15',beauty:'15b',grocery:'15c',apparel:'17',shoes:'15s',
  electronics:'8',computers:'8c',camera:'8cam',pc:'6p',appliances:'6',
  jewelry:'20j',watches:'16w',giftcards:'20',amazon_accessories:'45',books:'12' };
const VALID_SIZE_TIERS = ['ss','ls','lb','xl'];

function validateCSVRow(row, isUpdate) {
  const errors = [];
  const v = f => (row[f] ?? '').toString().trim();
  const badNum = f => v(f) !== '' && isNaN(Number(v(f)));
  if (!isUpdate && !v('name') && !v('asin')) errors.push({ field: 'name/asin', code: 'missing_required' });
  if (!isUpdate && !v('cogs'))               errors.push({ field: 'cogs', code: 'missing_required' });
  if (badNum('cogs'))          errors.push({ field: 'cogs', code: 'not_numeric', value: v('cogs') });
  if (badNum('target_margin')) errors.push({ field: 'target_margin', code: 'not_numeric', value: v('target_margin') });
  if (badNum('weight_oz'))     errors.push({ field: 'weight_oz', code: 'not_numeric', value: v('weight_oz') });
  if (v('category') && !CAT_MAP[v('category').toLowerCase()])
    errors.push({ field: 'category', code: 'unknown_category', value: v('category') });
  if (v('size_tier') && !VALID_SIZE_TIERS.includes(v('size_tier').toLowerCase()))
    errors.push({ field: 'size_tier', code: 'bad_size_tier', value: v('size_tier') });
  return errors;
}

function checkKillSignals(product) {
  const signals = [];
  const warnings = [];
  const lc = product.lifecycle;
  const now = Date.now();
  const daysSince = (iso) => iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : 0;
  const lastCheckin = product.checkins[product.checkins.length - 1];
  if (lastCheckin) {
    const staleDays = daysSince(lastCheckin.date);
    if (staleDays > STALE_DAYS) warnings.push(`Stale: ${staleDays} days`);
  }
  if (lc === 'STAGE_1') {
    const daysInS1 = daysSince(product.stageStartDates.STAGE_1);
    const inVineWindow = product.inputs.vine && daysInS1 <= VINE_WINDOW_DAYS;
    if (daysInS1 >= S1_KILL_DAYS && !inVineWindow) {
      const hasAnySales = product.checkins.some(c => (c.adSales || 0) > 0);
      if (!hasAnySales) signals.push('Kill Signal 1');
    }
  }
  if (lc === 'STAGE_2') {
    const daysInS2 = daysSince(product.stageStartDates.STAGE_2);
    const vineEnd = product.inputs.vine
      ? new Date(new Date(product.stageStartDates.STAGE_1 || product.createdAt).getTime() + VINE_WINDOW_DAYS * 86400000)
      : new Date(0);
    const postVineSales = product.checkins
      .filter(c => new Date(c.date) > vineEnd)
      .reduce((sum, c) => sum + (c.adSales || 0), 0);
    if (daysInS2 >= S2_KILL_DAYS && postVineSales < S2_AD_SALES_TARGET) {
      signals.push('Kill Signal 2');
    }
  }
  if (lc === 'STAGE_3') {
    const prices = calcPrices(product.inputs);
    const daysInS3 = daysSince(product.stageStartDates.STAGE_3);
    if (daysInS3 >= S3_KILL_DAYS) {
      const everBelowBE = product.checkins.some(c => c.currentAcos !== undefined && c.currentAcos < prices.beAcos);
      const organicGrowing = product.checkins.slice(-3).some(c => c.organicGrowing === 'yes');
      if (!everBelowBE && !organicGrowing) signals.push('Kill Signal 3');
    }
  }
  const totalRev   = product.checkins.reduce((s,c) => s+(c.totalRevenue||0), 0);
  const totalSpend = product.checkins.reduce((s,c) => s+(c.totalAdSpend||0), 0);
  if (totalRev > 0 && totalSpend > totalRev * K4_SPEND_RATIO) signals.push('Kill Signal 4');
  return { signals, warnings };
}

function explainSignal(sig, lang = 'en') {
  const pick = (en, zh) => lang === 'zh' ? zh : en;
  const p = sig.params || {};
  switch (sig.code) {
    case 'K1': return {
      title: pick('Kill Signal 1 — Stage 1 zero sales', '终止信号1 — 阶段1零销售'),
      text: pick(
        `No ad-attributed sales after ${p.daysInS1} days in Stage 1 — past the ${p.thresholdDays}-day threshold${p.vineEnrolled ? ', and the Vine window has closed' : ''}. The product may have fundamental discoverability issues.`,
        `阶段1已进行${p.daysInS1}天仍无广告归因销售 — 已超过${p.thresholdDays}天阈值${p.vineEnrolled ? '，且Vine窗口已关闭' : ''}。产品可能存在根本性的曝光问题。`),
      rule: `K1_DAYS = ${p.thresholdDays}`
    };
    case 'K2': return {
      title: pick('Kill Signal 2 — Stage 2 insufficient velocity', '终止信号2 — 阶段2销售速度不足'),
      text: pick(
        `Only ${p.postVineSales} post-Vine ad sales after ${p.daysInS2} days in Stage 2 — the target is ${p.target} sales within ${p.thresholdDays} days. Demand may be too weak to support the advertising investment.`,
        `阶段2已进行${p.daysInS2}天，Vine后广告销售仅${p.postVineSales}笔 — 目标是${p.thresholdDays}天内达到${p.target}笔。需求可能不足以支撑广告投入。`),
      rule: `S2_AD_SALES_TARGET = ${p.target} · S2_KILL_DAYS = ${p.thresholdDays}`
    };
    case 'K3': return {
      title: pick('Kill Signal 3 — persistent unprofitability', '终止信号3 — 持续不盈利'),
      text: pick(
        `${p.latestAcos !== undefined ? `ACoS ${p.latestAcos}% has exceeded break-even ACoS ${p.beAcos}%` : `ACoS has never dropped below break-even ACoS ${p.beAcos}%`} for ${p.daysInS3} days in Stage 3 (threshold: ${p.thresholdDays} days), and organic sales are not growing. The unit economics may be structurally broken — price too low, competition too high, or wrong keywords.`,
        `${p.latestAcos !== undefined ? `ACoS ${p.latestAcos}%持续高于盈亏平衡ACoS ${p.beAcos}%` : `ACoS从未低于盈亏平衡ACoS ${p.beAcos}%`}，阶段3已进行${p.daysInS3}天（阈值：${p.thresholdDays}天），且自然销售没有增长。单位经济模型可能存在结构性问题 — 价格过低、竞争过强或关键词不对。`),
      rule: `S3_KILL_DAYS = ${p.thresholdDays} · beAcos = ${p.beAcos}%`
    };
    case 'K4': return {
      title: pick('Kill Signal 4 — ad spend money pit', '终止信号4 — 广告支出无底洞'),
      text: pick(
        `Cumulative ad spend $${p.totalSpend} is ${p.ratioPct}% of cumulative revenue $${p.totalRev} — above the ${p.thresholdPct}% danger threshold. The product could still recover if organic sales start, but review it now.`,
        `累计广告支出$${p.totalSpend}已达累计收入$${p.totalRev}的${p.ratioPct}% — 超过${p.thresholdPct}%的危险阈值。若自然销售启动仍有机会恢复，但请立即审查。`),
      rule: `K4_SPEND_RATIO = ${(p.thresholdPct / 100).toFixed(1)}`
    };
    case 'STALE': return {
      title: pick('Stale check-in', '检查记录过期'),
      text: pick(
        `No check-in recorded for ${p.staleDays} days — past the ${p.thresholdDays}-day threshold. Last check-in: ${p.lastDate}.`,
        `已有${p.staleDays}天未记录检查 — 超过${p.thresholdDays}天阈值。最近一次检查：${p.lastDate}。`),
      rule: `STALE_DAYS = ${p.thresholdDays}`
    };
    default: return { title: sig.code, text: '', rule: '' };
  }
}

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, section = '';

function describe(name) {
  section = name;
  console.log(`\n━━━ ${name} ━━━`);
}

function eq(got, expected, label, tol = 0) {
  const ok = tol ? Math.abs(got - expected) <= tol : got === expected;
  if (ok) { console.log(`  ✓  ${label}`); passed++; }
  else    { console.error(`  ✗  ${label}\n     Expected: ${JSON.stringify(expected)}\n     Got:      ${JSON.stringify(got)}`); failed++; }
}

function is(condition, label) {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// ─── 1. getReferralFee ───────────────────────────────────────────────────────
describe('getReferralFee');

eq(getReferralFee('15', 20),    3.00,  'Home 15%: $20 → $3.00');
eq(getReferralFee('15',  1),    0.30,  'Home 15%: $1 → $0.30 minimum');
eq(getReferralFee('8',  50),    4.00,  'Electronics 8%: $50 → $4.00');
eq(getReferralFee('8c', 50),    4.00,  'Computers 8%: $50 → $4.00');
eq(getReferralFee('8cam',25),   2.00,  'Camera 8%: $25 → $2.00');
eq(getReferralFee('6p',200),   12.00,  'PC 6%: $200 → $12.00');
eq(getReferralFee('6', 100),    7.50,  'Appliances 7.5%: $100 → $7.50');
eq(getReferralFee('45', 10),    4.50,  'Accessories 45%: $10 → $4.50');

// Apparel — three tiers: ≤$15=5%, ≤$20=10%, >$20=17%
eq(getReferralFee('17', 10),    0.50,  'Apparel ≤$15 = 5%: $10 → $0.50');
eq(+getReferralFee('17',17).toFixed(2), 1.70, 'Apparel ≤$20 = 10%: $17 → $1.70');
eq(+getReferralFee('17',30).toFixed(2), 5.10, 'Apparel >$20 = 17%: $30 → $5.10');

// Shoes — three tiers: ≤$75=5%, ≤$150=10%, >$150=15%
eq(getReferralFee('15s', 50),   2.50,  'Shoes ≤$75 = 5%: $50 → $2.50');
eq(getReferralFee('15s',100),  10.00,  'Shoes ≤$150 = 10%: $100 → $10.00');
eq(getReferralFee('15s',200),  30.00,  'Shoes >$150 = 15%: $200 → $30.00');

// Beauty — <$10=8%, ≥$10=15%
eq(getReferralFee('15b',  8),   0.64,  'Beauty <$10 = 8%: $8 → $0.64');
eq(getReferralFee('15b', 20),   3.00,  'Beauty ≥$10 = 15%: $20 → $3.00');

// Jewelry — ≤$250=20%, >$250 adds 5% on excess
eq(getReferralFee('20j',100),  20.00,  'Jewelry ≤$250 = 20%: $100 → $20.00');
eq(getReferralFee('20j',300),  52.50,  'Jewelry tiered: $300 → ($250×20%) + ($50×5%) = $52.50');

// Watches — ≤$1500=16% (min $2.00), >$1500 adds 3% on excess
eq(getReferralFee('16w', 10),   2.00,  'Watches: $10 → $2.00 minimum');
eq(getReferralFee('16w',100),  16.00,  'Watches 16%: $100 → $16.00');
eq(getReferralFee('16w',2000),255.00,  'Watches tiered: $2000 → ($1500×16%) + ($500×3%) = $255.00');

// Gift cards, books
eq(getReferralFee('20',  50),  10.00,  'Gift cards 20%: $50 → $10.00');
eq(getReferralFee('12',  10),   3.30,  'Books 15% + $1.80 closing: $10 → $3.30');

// ─── 2. getFBAFee ────────────────────────────────────────────────────────────
describe('getFBAFee — Small Standard (all bands)');

// Price band assignment: <$10 = band 0, $10–$50 = band 1, >$50 = band 2
eq(getFBAFee('ss', 2,  5), 2.43, 'SS 2oz / <$10 band');
eq(getFBAFee('ss', 2, 20), 3.32, 'SS 2oz / $10-50 band');
eq(getFBAFee('ss', 2, 60), 3.58, 'SS 2oz / >$50 band');
eq(getFBAFee('ss', 8,  5), 2.66, 'SS 8oz / <$10 band');
eq(getFBAFee('ss', 8, 20), 3.54, 'SS 8oz / $10-50 band');
eq(getFBAFee('ss', 8, 60), 3.80, 'SS 8oz / >$50 band');
eq(getFBAFee('ss',16,  5), 2.95, 'SS 16oz (max table row) / <$10 band');
eq(getFBAFee('ss',16, 20), 3.96, 'SS 16oz / $10-50 band');
eq(getFBAFee('ss',16, 60), 4.22, 'SS 16oz / >$50 band');
eq(getFBAFee('ss',20, 20), 3.96, 'SS 20oz (above max 16oz) → last row');

describe('getFBAFee — price band boundaries');
// $10.00 is in the $10–50 band (not <$10); $9.99 is <$10
eq(getFBAFee('ss', 8, 10),    3.54, 'SS price=10.00 → $10-50 band');
eq(getFBAFee('ss', 8,  9.99), 2.66, 'SS price=9.99 → <$10 band');
// $50.00 is in $10–50 band; $50.01 is >$50
eq(getFBAFee('ss', 8, 50),    3.54, 'SS price=50.00 → $10-50 band');
eq(getFBAFee('ss', 8, 50.01), 3.80, 'SS price=50.01 → >$50 band');

describe('getFBAFee — Large Standard');
eq(getFBAFee('ls',  4,  5), 2.91, 'LS 4oz / <$10 band');
eq(getFBAFee('ls',  4, 20), 3.73, 'LS 4oz / $10-50 band');
eq(getFBAFee('ls',  4, 60), 3.99, 'LS 4oz / >$50 band');
eq(getFBAFee('ls', 48, 20), 6.67, 'LS 48oz (last table row) / $10-50 band');
// >48oz: bases[band] + ceil((oz-48)/4) × $0.08
eq(getFBAFee('ls', 50, 20), 7.05, 'LS 50oz / $10-50: 6.97 + ceil(2/4)×0.08 = $7.05');
eq(getFBAFee('ls', 52, 20), 7.05, 'LS 52oz / $10-50: 6.97 + ceil(4/4)×0.08 = $7.05');
eq(getFBAFee('ls', 56, 20), 7.13, 'LS 56oz / $10-50: 6.97 + ceil(8/4)×0.08 = $7.13');
eq(getFBAFee('ls', 50,  5), 6.23, 'LS 50oz / <$10: 6.15 + 0.08 = $6.23');
eq(+getFBAFee('ls',50, 60).toFixed(2), 7.31, 'LS 50oz / >$50: 7.23 + 0.08 = $7.31');

describe('getFBAFee — Large Bulky & Extra-Large (flat by band)');
eq(getFBAFee('lb', 100,  5),  9.61, 'LB / <$10');
eq(getFBAFee('lb', 100, 25), 10.10, 'LB / $10-50');
eq(getFBAFee('lb', 100, 60), 10.84, 'LB / >$50');
eq(getFBAFee('xl', 200,  5), 26.33, 'XL / <$10');
eq(getFBAFee('xl', 200, 25), 27.12, 'XL / $10-50');
eq(getFBAFee('xl', 200, 60), 28.01, 'XL / >$50');

// 3.5% fuel surcharge applied externally
eq(+(getFBAFee('ss',16,20) * 1.035).toFixed(2), 4.10, 'SS 16oz $20 + 3.5% surcharge = $4.10');

// ─── 3. roundEnd ─────────────────────────────────────────────────────────────
describe('roundEnd');
eq(roundEnd(14.23, 0.95), 14.95, 'roundEnd(14.23, .95) = 14.95');
eq(roundEnd(14.95, 0.95), 14.95, 'roundEnd(14.95, .95) = 14.95 (exact, no bump)');
eq(roundEnd(14.96, 0.95), 15.95, 'roundEnd(14.96, .95) = 15.95 (bumps up one dollar)');
eq(roundEnd(15.10, 0.99), 15.99, 'roundEnd(15.10, .99) = 15.99');
eq(roundEnd(15.99, 0.99), 15.99, 'roundEnd(15.99, .99) = 15.99 (exact)');
eq(roundEnd(16.00, 0.99), 16.99, 'roundEnd(16.00, .99) = 16.99 (bumps)');
eq(roundEnd(0.50,  0.97),  0.97, 'roundEnd(0.50, .97) = 0.97');
eq(roundEnd(0.97,  0.97),  0.97, 'roundEnd(0.97, .97) = 0.97 (exact)');
eq(roundEnd(0.98,  0.97),  1.97, 'roundEnd(0.98, .97) = 1.97 (bumps)');
eq(roundEnd(0,     0.90),  0.90, 'roundEnd(0, .90) = 0.90');

// ─── 4. calcPrices — exact dollar amounts ────────────────────────────────────
describe('calcPrices — standard SS product (exact amounts)');

// Hand-verified scenario: SS 8oz, 30% margin, home category
// otherCosts = inbound+placement+prep+storage+q4storage+ppc+returns+other
//            = 0.50+0+0.25+0.10+0+1.50+0.30+0.20 = $2.85
// Solver converges to yp=$20.95; FBA=$3.66 (3.54×1.035), ref=$3.14 (20.95×0.15)
// profit = 20.95 - 5.00 - 3.66 - 3.14 - 2.85 = $6.29 → margin=30.04%
const base = {
  category: '15', sizetier: 'ss', weight: 8,
  cogs: 5.00, margin: 30,
  inbound: 0.50, placement: 0, prep: 0.25,
  storage: 0.10, q4storage: 0, ppc: 1.50, returns: 0.30, other: 0.20,
  vine: false, vineUnits: 20, annualUnits: 500,
  tacos: 25, lacos: 60, cvr: 12, surcharge: true
};
const p = calcPrices(base);

eq(p.yp,    20.95, 'yp = $20.95');
eq(p.listP, 23.99, 'listP = $23.99  (yp×1.10 → $23.99)');
eq(p.saleP, 19.90, 'saleP = $19.90  (yp×0.94 → $19.90)');
eq(p.discP, 18.97, 'discP = $18.97  (saleP×0.91 → $18.97)');

eq(+p.ypF.fba.toFixed(2),  3.66,  'FBA at yp: $3.54 × 1.035 = $3.66');
eq(+p.ypF.ref.toFixed(2),  3.14,  'Referral at yp: $20.95 × 15% = $3.14');
eq(+p.ypF.profit.toFixed(2), 6.29,'Profit at yp = $6.29');
is(Math.abs(p.ypF.pct - 30) < 1,  `Margin ≈ 30% (got ${p.ypF.pct.toFixed(2)}%)`);

eq(+p.maxCPC.toFixed(4), +(p.yp * 0.25 * 0.12).toFixed(4), 'maxCPC = yp × 25% × 12%');
eq(+p.maxCPClaunch.toFixed(4), +(p.yp * 0.60 * 0.12).toFixed(4), 'maxCPClaunch = yp × 60% × 12%');
eq(+p.targetRoas.toFixed(4),   +(100/25).toFixed(4), 'targetRoas = 100/25 = 4.00');
eq(+p.launchRoas.toFixed(4),   +(100/60).toFixed(4), 'launchRoas = 100/60 = 1.67');
eq(+p.beAcos.toFixed(4), +p.ypF.pct.toFixed(4), 'beAcos = margin at yp');

describe('calcPrices — high-price SS product (>$50 band)');

// Hand-verified: SS 8oz, 35% margin, cogs=$20, other=$3.00
// Solver converges to yp=$53.95 (>$50 band, FBA band flips)
// FBA at >$50 band: 3.80 × 1.035 = $3.933
// ref: 53.95 × 0.15 = $8.09
// profit = 53.95 - 20 - 3.933 - 8.093 - 3 = $18.92 → margin=35.08%
const highP = calcPrices({
  ...base, cogs: 20, margin: 35,
  inbound: 0.60, placement: 0, prep: 0.30,
  storage: 0.20, q4storage: 0, ppc: 1.50, returns: 0.40, other: 0.00,
  tacos: 20, lacos: 70, cvr: 10
});

is(highP.yp > 50, `yp ($${highP.yp}) > $50 — in >$50 FBA band`);
eq(+(highP.yp % 1).toFixed(2), 0.95, 'yp ends in .95');
is(highP.ypF.fba > 3.80, `FBA fee ($${highP.ypF.fba.toFixed(2)}) uses >$50 rate (>$3.80 base)`);
is(Math.abs(highP.ypF.pct - 35) < 2, `Margin ≈ 35% (got ${highP.ypF.pct.toFixed(2)}%)`);
is(highP.ypF.profit > 0, `Profit positive at yp ($${highP.ypF.profit.toFixed(2)})`);

describe('calcPrices — Large Standard product');

// LS 32oz, 28% margin: FBA band $10-50, LS_TABLE at 32oz → $5.82
// 5.82 × 1.035 = $6.02 with surcharge
const ls = calcPrices({
  ...base, sizetier: 'ls', weight: 32,
  cogs: 8, margin: 28,
  inbound: 0.80, placement: 0.20, prep: 0.25,
  storage: 0.15, q4storage: 0, ppc: 1.50, returns: 0.40, other: 0.20
});

is(ls.yp > 0,         'LS: yp is positive');
is(ls.ypF.fba > 5.82, `LS: FBA fee ($${ls.ypF.fba.toFixed(2)}) exceeds base $5.82 (32oz, +surcharge)`);
is(Math.abs(ls.ypF.pct - 28) < 2, `LS: margin ≈ 28% (got ${ls.ypF.pct.toFixed(2)}%)`);
is(ls.yp > p.yp, `LS yp ($${ls.yp}) > SS yp ($${p.yp}) — higher FBA cost`);

describe('calcPrices — price ordering invariants');

// All 4 price points must be strictly ordered: listP > yp > saleP > discP > 0
for (const [label, inputs] of [
  ['standard SS 30% margin', base],
  ['high-price >$50 SS',     {...base, cogs:20, margin:35}],
  ['large standard LS',      {...base, sizetier:'ls', weight:32, cogs:8, margin:28}],
  ['large bulky LB',         {...base, sizetier:'lb', weight:120, cogs:12, margin:32}],
  ['extra-large XL',         {...base, sizetier:'xl', weight:300, cogs:25, margin:30}],
  ['cheap SS <$10 band',     {...base, cogs:1, margin:20, inbound:0.10, ppc:0.30, prep:0.10, returns:0.10, storage:0.05, other:0.05}],
  ['Vine enrolled',          {...base, vine:true, annualUnits:500}],
  ['no fuel surcharge',      {...base, surcharge:false}],
  ['electronics 8% ref',     {...base, category:'8', cogs:15, margin:25}],
]) {
  const q = calcPrices(inputs);
  is(q.listP > q.yp,    `[${label}] listP ($${q.listP}) > yp ($${q.yp})`);
  is(q.yp    > q.saleP, `[${label}] yp ($${q.yp}) > saleP ($${q.saleP})`);
  is(q.saleP > q.discP, `[${label}] saleP ($${q.saleP}) > discP ($${q.discP})`);
  is(q.discP > 0,       `[${label}] discP > 0`);
}

describe('calcPrices — price endings');

for (const [label, inputs] of [
  ['base case',          base],
  ['high price >$50',    {...base, cogs:20, margin:35}],
  ['cheap product',      {...base, cogs:1, margin:20, inbound:0.10, ppc:0.30, prep:0.10, returns:0.10, storage:0.05, other:0.05}],
]) {
  const q = calcPrices(inputs);
  eq(+(q.yp    % 1).toFixed(2), 0.95, `[${label}] yp ends in .95`);
  eq(+(q.listP % 1).toFixed(2), 0.99, `[${label}] listP ends in .99`);
  eq(+(q.saleP % 1).toFixed(2), 0.90, `[${label}] saleP ends in .90`);
  eq(+(q.discP % 1).toFixed(2), 0.97, `[${label}] discP ends in .97`);
}

describe('calcPrices — Vine amortisation');
const pVine = calcPrices({...base, vine:true, annualUnits:500});
eq(+pVine.vinePerUnit.toFixed(4), +(200/500).toFixed(4), 'Vine: $200/500 units = $0.40/unit');
is(pVine.yp > p.yp, `Vine enrolled → higher yp ($${pVine.yp} vs $${p.yp})`);

const pVine100 = calcPrices({...base, vine:true, annualUnits:100});
eq(+pVine100.vinePerUnit.toFixed(4), +(200/100).toFixed(4), 'Vine: $200/100 units = $2.00/unit');
is(pVine100.yp > pVine.yp, `Fewer annual units → higher vine cost → higher yp`);

describe('calcPrices — sale price qualifies for Amazon badge');
// Amazon Price Discount badge requires ≥5% off; SALE_DISCOUNT = 0.94 (6% off)
is((p.yp - p.saleP) / p.yp >= 0.05, `Sale is ${(((p.yp-p.saleP)/p.yp)*100).toFixed(1)}% off yp — qualifies for badge (≥5%)`);

describe('calcPrices — cheap product discP guard (regression)');
// Bug fixed: for products with yp < ~$8, roundEnd was pushing discP above saleP.
// Guard: if discP >= saleP after rounding, subtract $1 (maintains .97 ending).
const cheapInputs = {...base, cogs:1, margin:20, inbound:0.10, ppc:0.30, prep:0.10, returns:0.10, storage:0.05, other:0.05};
const cheap = calcPrices(cheapInputs);
is(cheap.discP < cheap.saleP, `Cheap product: discP ($${cheap.discP}) < saleP ($${cheap.saleP})`);
is(cheap.saleP < cheap.yp,   `Cheap product: saleP ($${cheap.saleP}) < yp ($${cheap.yp})`);
eq(+(cheap.discP % 1).toFixed(2), 0.97, 'Cheap product: discP still ends in .97 after guard');

describe('calcPrices — misc edge cases');
// Zero COGS should not crash
const z = calcPrices({...base, cogs:0});
is(z.yp > 0 && z.ypF.profit > 0, 'Zero COGS: yp positive, profit positive');
// No surcharge → lower yp
const noS = calcPrices({...base, surcharge:false});
is(p.yp >= noS.yp, 'Surcharge on → yp ≥ surcharge off');
// Break-even ACoS equals margin at Your Price
is(Math.abs(p.beAcos - p.ypF.pct) < 0.001, 'beAcos === margin at yp (by definition)');
// Profit at all tiers is positive (base case)
is(p.ypF.profit   > 0, `Profit at yp: $${p.ypF.profit.toFixed(2)}`);
is(p.listF.profit > 0, `Profit at listP: $${p.listF.profit.toFixed(2)}`);
is(p.saleF.profit > 0, `Profit at saleP: $${p.saleF.profit.toFixed(2)}`);
is(p.discF.profit > 0, `Profit at discP: $${p.discF.profit.toFixed(2)}`);

// ─── 5. classifyPrice ────────────────────────────────────────────────────────
describe('classifyPrice');

const prices = { listP: 24.99, yp: 21.95, saleP: 20.90, discP: 19.97 };

eq(classifyPrice(21.95, prices)?.label, 'At Your Price (normal)',  'Exact yp match');
eq(classifyPrice(24.99, prices)?.label, 'At List Price / MSRP',   'Exact listP match');
eq(classifyPrice(20.90, prices)?.label, 'Running Sale Price',      'Exact saleP match');
eq(classifyPrice(19.97, prices)?.label, 'Running Clearance Price', 'Exact discP match');

// Within 2% tolerance
eq(classifyPrice(22.00, prices)?.label, 'At Your Price (normal)',  'yp +0.23% within tolerance');
eq(classifyPrice(21.90, prices)?.label, 'At Your Price (normal)',  'yp -0.23% within tolerance');

// Just outside 2% tolerance
eq(classifyPrice(21.50, prices)?.label, 'Custom price', 'yp -2.05% outside tolerance → Custom');

// Out of range
eq(classifyPrice(30.00, prices)?.label, 'Above List Price — check', 'Above listP');
eq(classifyPrice(15.00, prices)?.label, 'Below Clearance — urgent', 'Below discP');

// Edge cases
is(classifyPrice(0,  prices) === null, 'Zero price → null');
is(classifyPrice(-1, prices) === null, 'Negative price → null');
eq(classifyPrice(23.00, prices)?.label, 'Custom price', 'Between yp and listP → Custom');

// ─── 6. checkKillSignals ─────────────────────────────────────────────────────
describe('checkKillSignals — Kill Signal 1 (Stage 1 no sales)');

const baseProduct = (overrides) => ({
  lifecycle: 'STAGE_1',
  inputs: { ...base, vine: false },
  stageStartDates: { STAGE_1: daysAgo(15) },
  checkins: [],
  createdAt: daysAgo(15),
  ...overrides
});

is(checkKillSignals(baseProduct()).signals.includes('Kill Signal 1'),
  'K1 fires: 15 days S1, no sales, no Vine');
is(!checkKillSignals(baseProduct({ checkins: [{ date: daysAgo(5), adSales: 10 }] })).signals.includes('Kill Signal 1'),
  'K1 suppressed when ad sales exist');
is(!checkKillSignals(baseProduct({ stageStartDates: { STAGE_1: daysAgo(3) } })).signals.includes('Kill Signal 1'),
  'K1 suppressed: only 3 days in S1 (below 14-day threshold)');

describe('checkKillSignals — Kill Signal 1 Vine window');

const vineProduct = (daysInS1) => ({
  lifecycle: 'STAGE_1',
  inputs: { ...base, vine: true },
  stageStartDates: { STAGE_1: daysAgo(daysInS1) },
  checkins: [],
  createdAt: daysAgo(daysInS1)
});

is(!checkKillSignals(vineProduct(10)).signals.includes('Kill Signal 1'),
  'K1 suppressed: day 10 of 30-day Vine window');
is(!checkKillSignals(vineProduct(29)).signals.includes('Kill Signal 1'),
  'K1 suppressed: day 29 of 30-day Vine window (last day)');
is(checkKillSignals(vineProduct(35)).signals.includes('Kill Signal 1'),
  'K1 fires: day 35 — Vine window expired, still no sales');

describe('checkKillSignals — Kill Signal 2 (Stage 2 velocity)');

const s2Product = (daysInS2, salesArr) => ({
  lifecycle: 'STAGE_2',
  inputs: { ...base, vine: false },
  stageStartDates: { STAGE_1: daysAgo(70), STAGE_2: daysAgo(daysInS2) },
  checkins: salesArr.map((n, i) => ({ date: daysAgo(daysInS2 - i * 10), adSales: n })),
  createdAt: daysAgo(70)
});

is(checkKillSignals(s2Product(61, [10, 10])).signals.includes('Kill Signal 2'),
  'K2 fires: 61 days S2, only 20 ad sales (target 40)');
is(!checkKillSignals(s2Product(61, [25, 25])).signals.includes('Kill Signal 2'),
  'K2 suppressed: 61 days S2, 50 ad sales (≥40 target)');
is(!checkKillSignals(s2Product(25, [5,  5])).signals.includes('Kill Signal 2'),
  'K2 suppressed: only 25 days in S2 (below 60-day threshold)');

describe('checkKillSignals — Kill Signal 4 (ad spend money pit)');

const spendProduct = (revenue, spend) => ({
  lifecycle: 'STAGE_2',
  inputs: base,
  stageStartDates: { STAGE_1: daysAgo(30), STAGE_2: daysAgo(10) },
  checkins: [{ date: daysAgo(5), totalRevenue: revenue, totalAdSpend: spend }],
  createdAt: daysAgo(30)
});

is( checkKillSignals(spendProduct(100, 160)).signals.includes('Kill Signal 4'),
   'K4 fires: spend $160 > 1.5× revenue $100 (ratio=1.60)');
is(!checkKillSignals(spendProduct(100, 149)).signals.includes('Kill Signal 4'),
   'K4 clear: spend $149 < 1.5× revenue $100 (ratio=1.49)');
is(!checkKillSignals(spendProduct(100, 150)).signals.includes('Kill Signal 4'),
   'K4 clear: spend $150 = exactly 1.5× (threshold is strictly greater)');
is(!checkKillSignals(spendProduct(0,   100)).signals.includes('Kill Signal 4'),
   'K4 suppressed when zero revenue (guard against division by zero)');

describe('checkKillSignals — stale check-in warning');

const withCheckin = (daysAgoCI) => ({
  lifecycle: 'STAGE_2',
  inputs: base,
  stageStartDates: { STAGE_2: daysAgo(10) },
  checkins: [{ date: daysAgo(daysAgoCI) }],
  createdAt: daysAgo(10)
});

is( checkKillSignals(withCheckin(22)).warnings.length > 0, `Stale warning: last check-in 22 days ago (>${STALE_DAYS})`);
is(!checkKillSignals(withCheckin(21)).warnings.length > 0, `No stale warning: last check-in exactly 21 days ago (=${STALE_DAYS})`);
is(!checkKillSignals(withCheckin(5)).warnings.length > 0,  'No stale warning: last check-in 5 days ago');

// ─── 7. Known pricing gotcha — $9.99 vs $10.00 FBA band ─────────────────────
describe('Price band boundary — $9.99 vs $10.00 (critical Amazon gotcha)');

const fee_999  = getFBAFee('ss', 8,  9.99);
const fee_1000 = getFBAFee('ss', 8, 10.00);
is(fee_999 < fee_1000,
  `FBA at $9.99 ($${fee_999}) < FBA at $10.00 ($${fee_1000}) — band boundary works`);
eq(fee_999,  2.66, 'FBA at $9.99: <$10 band → $2.66');
eq(fee_1000, 3.54, 'FBA at $10.00: $10-50 band → $3.54');
// This $0.88 difference has a real margin impact — the solver accounts for it
const pAt999  = calcPrices({...base, cogs:2, margin:25,
  inbound:0.30, ppc:0.50, prep:0.10, returns:0.10, storage:0.05, other:0.05});
is(pAt999.ypF.fba < fee_1000 * 1.035 || pAt999.yp > 10,
  `Solver lands product at yp=$${pAt999.yp} — FBA band choice is consistent`);

// ─── 8. priceSensitivity ─────────────────────────────────────────────────────
describe('priceSensitivity — ±$2 margin table');

const sens = priceSensitivity(base, p.yp);
eq(sens.length, 5, '5 rows: −$2, −$1, current, +$1, +$2');
is(sens[2].isCurrent, 'centre row flagged as current');
is(!sens[0].isCurrent && !sens[4].isCurrent, 'outer rows not flagged as current');
eq(sens[2].price, p.yp, 'centre row price = Your Price');
eq(sens[0].price, +(p.yp - 2).toFixed(2), 'first row = yp − $2');
eq(sens[4].price, +(p.yp + 2).toFixed(2), 'last row = yp + $2');
eq(+sens[2].profit.toFixed(2), +p.ypF.profit.toFixed(2), 'centre row profit matches calcPrices profit at yp');
eq(+sens[2].pct.toFixed(4), +p.ypF.pct.toFixed(4), 'centre row margin matches calcPrices margin at yp');
// Within one FBA band, 15% referral: +$1 price → +$0.85 profit exactly
eq(+(sens[3].profit - sens[2].profit).toFixed(2), 0.85, '+$1 price → +$0.85 profit (15% ref, same FBA band)');
is(sens[4].pct > sens[2].pct && sens[2].pct > sens[0].pct, 'margin % increases with price within one band');

// FBA band cliff: rows straddling $10 recompute fees per-row
const cliff = priceSensitivity(base, 11.95); // rows at 9.95, 10.95, 11.95, 12.95, 13.95
eq(+cliff[0].fba.toFixed(2), +(2.66 * 1.035).toFixed(2), 'row at $9.95 uses <$10 FBA band ($2.66 base)');
eq(+cliff[1].fba.toFixed(2), +(3.54 * 1.035).toFixed(2), 'row at $10.95 uses $10–50 FBA band ($3.54 base)');
is(cliff[1].profit < cliff[0].profit, 'crossing the $10 band: +$1 price yields LOWER profit (cliff visible)');

// Guard: offsets that push price ≤ 0 are marked invalid, no crash
is(!priceSensitivity(base, 1.50)[0].valid, 'price ≤ 0 row marked invalid (base $1.50, offset −$2)');
is(priceSensitivity(base, 1.50)[2].valid, 'centre row still valid at base $1.50');

// ─── 9. breakEvenUnits ───────────────────────────────────────────────────────
describe('breakEvenUnits — fixed overheads ÷ contribution margin');

eq(breakEvenUnits(500, 5),     100, '$500 ÷ $5.00/unit = 100 units');
eq(breakEvenUnits(500, 6.29),   80, '$500 ÷ $6.29/unit = 79.49 → rounds UP to 80');
eq(breakEvenUnits(1, 1000),      1, 'Tiny overhead still needs ≥1 whole unit');
eq(breakEvenUnits(0, 5),         0, 'Zero overheads → 0 units needed');
eq(breakEvenUnits(-10, 5),       0, 'Negative overheads treated as none');
eq(breakEvenUnits(500, 0),    null, 'Zero contribution margin → null (never breaks even)');
eq(breakEvenUnits(500, -2),   null, 'Negative contribution margin → null (never breaks even)');

// ─── 10. landedCostUSD ───────────────────────────────────────────────────────
describe('landedCostUSD — CNY → USD landed cost');

const lc1 = landedCostUSD(43.5, 7.25, 0, 0);
eq(+lc1.goodsDuty.toFixed(2), 6.00, '¥43.50 @ 7.25 = $6.00 goods (no duty)');
eq(lc1.freight, 0,                  'No freight → $0');
eq(+lc1.total.toFixed(2), 6.00,     'Total = $6.00');

const lc2 = landedCostUSD(72.5, 7.25, 10, 0);
eq(+lc2.goodsDuty.toFixed(2), 11.00, '¥72.50 @ 7.25 + 10% duty = $11.00');

const lc3 = landedCostUSD(72.5, 7.25, 10, 1);
eq(+lc3.goodsDuty.toFixed(2), 11.00, 'Duty applies to goods value only…');
eq(lc3.freight, 1,                   '…freight kept separate ($1.00)');
eq(+lc3.total.toFixed(2), 12.00,     'Total = goods+duty $11.00 + freight $1.00 = $12.00');

is(landedCostUSD(0, 7.25, 0, 0)  === null, 'Zero CNY price → null');
is(landedCostUSD(-5, 7.25, 0, 0) === null, 'Negative CNY price → null');
is(landedCostUSD(10, 0, 0, 0)    === null, 'Zero exchange rate → null (no division by zero)');
eq(+landedCostUSD(72.5, 7.25, -5, 0).goodsDuty.toFixed(2), 10.00, 'Negative duty treated as 0%');

// ─── 11. feeWaterfall ────────────────────────────────────────────────────────
describe('feeWaterfall — price decomposition to net profit');

const wf = feeWaterfall(base, p.yp);
eq(wf.segments.length, 8, '8 segments: referral, FBA, fuel, COGS, logistics, PPC, returns/overhead, net');
eq(wf.segments[wf.segments.length - 1].key, 'net', 'last segment is net profit');

const segSum = wf.segments.reduce((s, x) => s + x.amount, 0);
eq(+segSum.toFixed(6), +wf.price.toFixed(6), 'segments sum exactly to the price');
eq(+wf.net.toFixed(2), +p.ypF.profit.toFixed(2), 'net matches calcPrices profit at Your Price');
eq(+wf.netPct.toFixed(4), +p.ypF.pct.toFixed(4), 'netPct matches calcPrices margin at Your Price');

const seg = k => wf.segments.find(s => s.key === k).amount;
eq(+seg('fuel').toFixed(4), +(seg('fba') * 0.035).toFixed(4), 'fuel segment = 3.5% of FBA base fee');
eq(+seg('referral').toFixed(2), +getReferralFee(base.category, p.yp).toFixed(2), 'referral recomputed at the given price');
eq(+seg('logistics').toFixed(2), +(base.inbound + base.placement + base.prep + base.storage + base.q4storage).toFixed(2),
  'logistics = inbound + placement + prep + storage + Q4');
eq(+seg('returnsOverhead').toFixed(2), +(base.returns + base.other).toFixed(2), 'returns/overhead = returns + other (no Vine)');
eq(seg('cogs'), base.cogs, 'COGS segment = input COGS');
eq(seg('ppc'), base.ppc, 'PPC segment = input PPC');

// Surcharge off → fuel segment is zero, sum still equals price
const wfNoSur = feeWaterfall({ ...base, surcharge: false }, p.yp);
eq(wfNoSur.segments.find(s => s.key === 'fuel').amount, 0, 'surcharge off → $0 fuel segment');
eq(+wfNoSur.segments.reduce((s, x) => s + x.amount, 0).toFixed(6), +p.yp.toFixed(6), 'sum invariant holds without surcharge');

// Vine amortisation flows into returns/overhead
const wfVine = feeWaterfall({ ...base, vine: true, annualUnits: 500 }, p.yp);
eq(+wfVine.segments.find(s => s.key === 'returnsOverhead').amount.toFixed(2),
   +(base.returns + base.other + 200 / 500).toFixed(2), 'Vine $0.40/unit included in returns/overhead');

// Unprofitable price → negative net, sum invariant still holds
const wfLoss = feeWaterfall(base, 5.00);
is(wfLoss.net < 0, `net negative at $5.00 (got $${wfLoss.net.toFixed(2)})`);
eq(+wfLoss.segments.reduce((s, x) => s + x.amount, 0).toFixed(6), 5, 'sum invariant holds when net is negative');

// Guards
is(feeWaterfall(base, 0)  === null, 'price 0 → null');
is(feeWaterfall(base, -3) === null, 'negative price → null');

// ─── 12. What-if inverse solver ──────────────────────────────────────────────
describe('solveMaxCOGS — lock price + margin, solve max COGS');

// Hand-verified: base inputs, otherCosts = $2.85
// P=$20, m=30%: FBA = 3.54×1.035 = $3.6639, ref = 20×15% = $3.00
// maxCogs = 20×0.70 − 3.6639 − 3.00 − 2.85 = $4.4861
const mc = solveMaxCOGS(base, 20, 30);
eq(+mc.maxCogs.toFixed(4), 4.4861, 'P=$20 m=30% → maxCogs = $4.4861');
eq(+mc.ref.toFixed(2), 3.00,       'referral computed at target price');
eq(+mc.fba.toFixed(4), 3.6639,     'FBA (incl. surcharge) computed at target price');
eq(+mc.otherCosts.toFixed(2), 2.85,'other per-unit costs unchanged');
eq(+mc.gap.toFixed(4), +(4.4861 - base.cogs).toFixed(4), 'gap = maxCogs − current COGS');

// Impossible target: fees alone exceed price × (1−margin)
const mcNeg = solveMaxCOGS(base, 8, 50);
is(mcNeg.maxCogs < 0, `impossible target → negative maxCogs ($${mcNeg.maxCogs.toFixed(2)})`);

// Guards
is(solveMaxCOGS(base, 0, 30)    === null, 'price 0 → null');
is(solveMaxCOGS(base, -5, 30)   === null, 'negative price → null');
is(solveMaxCOGS(base, 20, 100)  === null, 'margin 100% → null');
is(solveMaxCOGS(base, 20, 150)  === null, 'margin >100% → null');

describe('solveMinPriceRaw — unrounded fixed-point solver');

const rawP = solveMinPriceRaw(base);
is(rawP > 0, `raw price positive ($${rawP.toFixed(2)})`);
is(rawP <= p.yp, `raw price ($${rawP.toFixed(2)}) ≤ rounded Your Price ($${p.yp})`);
is(p.yp - rawP < 1, 'rounded price is within $1 above the raw solution (.95 round-up)');
// At the fixed point, margin is exactly the target
{
  const fba = getFBAFee(base.sizetier, base.weight, rawP) * FUEL_SURCHARGE;
  const ref = getReferralFee(base.category, rawP);
  const profit = rawP - base.cogs - 2.85 - fba - ref;
  eq(+(profit / rawP * 100).toFixed(3), 30, 'margin at raw price = exactly 30%');
}
is(solveMinPriceRaw({ ...base, margin: 100 }) === null, 'margin 100% → null');

describe('What-if round-trip property — COGS↔price invert within $0.01');

// solveMaxCOGS(P, m) → cogs, then solveMinPriceRaw(cogs, m) must return P
for (const [P, m] of [[24.95, 30], [12.95, 35], [45.50, 25], [72.95, 40], [19.95, 20]]) {
  const cogs = solveMaxCOGS(base, P, m).maxCogs;
  const back = solveMinPriceRaw({ ...base, cogs, margin: m });
  is(Math.abs(back - P) < 0.01, `P=$${P} m=${m}% → cogs=$${cogs.toFixed(2)} → back to $${back.toFixed(4)} (Δ<$0.01)`);
}
// Reverse direction: price from COGS, then max COGS at that price returns the COGS
for (const [c, m] of [[4.00, 30], [9.50, 25], [1.25, 40]]) {
  const P = solveMinPriceRaw({ ...base, cogs: c, margin: m });
  const back = solveMaxCOGS({ ...base, cogs: c }, P, m).maxCogs;
  is(Math.abs(back - c) < 0.01, `cogs=$${c} m=${m}% → P=$${P.toFixed(2)} → back to $${back.toFixed(4)} (Δ<$0.01)`);
}

// ─── 13. validateCSVRow ──────────────────────────────────────────────────────
describe('validateCSVRow — CSV import row validation');

const goodRow = { name: 'Widget', asin: 'B01ABCDE01', category: 'home', size_tier: 'ss', weight_oz: '8', cogs: '6.00', target_margin: '30' };
eq(validateCSVRow(goodRow, false).length, 0, 'fully valid create row → no errors');
eq(validateCSVRow({ name: 'Widget', cogs: '6' }, false).length, 0, 'minimal create row (name + cogs) → no errors');
eq(validateCSVRow({ asin: 'B01ABCDE01', cogs: '6' }, false).length, 0, 'ASIN-only identity accepted');

// Missing required fields (create rows)
const eNoId = validateCSVRow({ cogs: '6' }, false);
is(eNoId.some(e => e.code === 'missing_required' && e.field === 'name/asin'), 'no name and no ASIN → missing_required(name/asin)');
const eNoCogs = validateCSVRow({ name: 'Widget' }, false);
is(eNoCogs.some(e => e.code === 'missing_required' && e.field === 'cogs'), 'no COGS → missing_required(cogs)');

// Update rows may omit required create fields
eq(validateCSVRow({ name: 'Widget' }, true).length, 0, 'update row without COGS → no errors');
eq(validateCSVRow({ asin: 'B01ABCDE01', target_margin: '25' }, true).length, 0, 'update row with only margin → no errors');

// Non-numeric values
is(validateCSVRow({ ...goodRow, cogs: 'abc' }, false).some(e => e.code === 'not_numeric' && e.field === 'cogs'), 'cogs "abc" → not_numeric');
is(validateCSVRow({ ...goodRow, cogs: '12x' }, false).some(e => e.code === 'not_numeric' && e.field === 'cogs'), 'cogs "12x" → not_numeric (strict Number parse)');
is(validateCSVRow({ ...goodRow, target_margin: 'high' }, false).some(e => e.code === 'not_numeric' && e.field === 'target_margin'), 'target_margin "high" → not_numeric');
is(validateCSVRow({ ...goodRow, weight_oz: 'heavy' }, false).some(e => e.code === 'not_numeric' && e.field === 'weight_oz'), 'weight_oz "heavy" → not_numeric');
eq(validateCSVRow({ ...goodRow, cogs: '  6.50 ' }, false).length, 0, 'whitespace-padded number accepted');

// Unknown category / bad size tier
is(validateCSVRow({ ...goodRow, category: 'gadgets' }, false).some(e => e.code === 'unknown_category'), 'category "gadgets" → unknown_category');
eq(validateCSVRow({ ...goodRow, category: 'ELECTRONICS' }, false).length, 0, 'category is case-insensitive');
is(validateCSVRow({ ...goodRow, size_tier: 'xxl' }, false).some(e => e.code === 'bad_size_tier'), 'size_tier "xxl" → bad_size_tier');
eq(validateCSVRow({ ...goodRow, size_tier: 'LS' }, false).length, 0, 'size_tier is case-insensitive');
eq(validateCSVRow({ ...goodRow, category: '', size_tier: '' }, false).length, 0, 'empty optional fields → no errors (defaults apply)');

// Multiple errors accumulate on one row
const multi = validateCSVRow({ cogs: 'abc', category: 'gadgets', size_tier: 'huge' }, false);
eq(multi.length, 4, 'bad row collects all errors (identity + numeric + category + tier)');

// Error objects carry the offending value for reporting
eq(validateCSVRow({ ...goodRow, category: 'gadgets' }, false).find(e => e.code === 'unknown_category').value, 'gadgets', 'error carries the bad value');

// ─── 14. explainSignal ───────────────────────────────────────────────────────
describe('explainSignal — plain-language kill-signal explanations');

const exK1 = explainSignal({ code: 'K1', params: { daysInS1: 16, thresholdDays: 14, vineEnrolled: false } });
is(exK1.text.includes('16 days'), 'K1 text contains actual days in Stage 1 (16)');
is(exK1.text.includes('14-day threshold'), 'K1 text names the 14-day threshold');
is(!exK1.text.includes('Vine'), 'K1 without Vine does not mention the Vine window');
eq(exK1.rule, 'K1_DAYS = 14', 'K1 rule names the RULE constant and value');

const exK1v = explainSignal({ code: 'K1', params: { daysInS1: 35, thresholdDays: 14, vineEnrolled: true } });
is(exK1v.text.includes('Vine window has closed'), 'K1 with Vine mentions the closed Vine window');

const exK2 = explainSignal({ code: 'K2', params: { postVineSales: 20, target: 40, daysInS2: 61, thresholdDays: 60 } });
is(exK2.text.includes('Only 20 post-Vine ad sales'), 'K2 text contains actual sales count');
is(exK2.text.includes('61 days') && exK2.text.includes('40 sales'), 'K2 text contains days and target');
is(exK2.rule.includes('S2_AD_SALES_TARGET = 40') && exK2.rule.includes('S2_KILL_DAYS = 60'), 'K2 rule names both thresholds');

// Spec example shape: "ACoS 42% has exceeded break-even ACoS 31% for N days"
const exK3 = explainSignal({ code: 'K3', params: { beAcos: 31, daysInS3: 95, thresholdDays: 90, latestAcos: 42 } });
is(exK3.text.includes('ACoS 42% has exceeded break-even ACoS 31%'), 'K3 leads with actual vs break-even ACoS');
is(exK3.text.includes('95 days'), 'K3 text contains days in Stage 3');
is(exK3.rule.includes('S3_KILL_DAYS = 90'), 'K3 rule names S3_KILL_DAYS');

const exK3n = explainSignal({ code: 'K3', params: { beAcos: 31, daysInS3: 95, thresholdDays: 90 } });
is(exK3n.text.includes('never dropped below break-even ACoS 31%'), 'K3 without a recorded ACoS falls back to "never dropped below"');

const exK4 = explainSignal({ code: 'K4', params: { totalSpend: 160, totalRev: 100, ratioPct: 160, thresholdPct: 150 } });
is(exK4.text.includes('$160') && exK4.text.includes('$100'), 'K4 text contains spend and revenue dollars');
is(exK4.text.includes('160%') && exK4.text.includes('150%'), 'K4 text contains actual ratio and threshold');
eq(exK4.rule, 'K4_SPEND_RATIO = 1.5', 'K4 rule names the ratio constant');

const exStale = explainSignal({ code: 'STALE', params: { staleDays: 25, thresholdDays: 21, lastDate: '6/1/2026' } });
is(exStale.text.includes('25 days') && exStale.text.includes('21-day'), 'STALE text contains actual and threshold days');
is(exStale.text.includes('6/1/2026'), 'STALE text contains last check-in date');

// Bilingual: zh variant is Chinese and carries the same numbers
const exK3zh = explainSignal({ code: 'K3', params: { beAcos: 31, daysInS3: 95, thresholdDays: 90, latestAcos: 42 } }, 'zh');
is(/[一-鿿]/.test(exK3zh.text), 'zh explanation contains Chinese characters');
is(exK3zh.text.includes('42%') && exK3zh.text.includes('31%'), 'zh explanation keeps the actual numbers');

// Unknown code degrades gracefully
eq(explainSignal({ code: 'K9', params: {} }).title, 'K9', 'unknown code → code as title, no crash');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${'─'.repeat(56)}`);
console.log(`  ${total} tests  ·  ${passed} passed  ·  ${failed} failed`);
if (failed === 0) {
  console.log('  All tests passed ✓\n');
} else {
  console.log(`  ${failed} test(s) FAILED ✗\n`);
  process.exit(1);
}
