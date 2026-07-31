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
const STOCKOUT_RISK_DAYS   = 30;
const REORDER_SOON_DAYS    = 90;
const AGED_INVENTORY_DAYS  = 181;
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

function getInventoryStatus(inventoryUnits, unitsSold, periodDays) {
  if (inventoryUnits === undefined || inventoryUnits === null) return null;
  const days = periodDays > 0 ? periodDays : 30;
  const velocity = (unitsSold || 0) / days;
  if (velocity <= 0) {
    return { velocity: 0, daysOfCover: null, status: inventoryUnits > 0 ? 'no_sales' : 'unknown' };
  }
  const daysOfCover = inventoryUnits / velocity;
  let status;
  if (daysOfCover < STOCKOUT_RISK_DAYS) status = 'stockout_risk';
  else if (daysOfCover < REORDER_SOON_DAYS) status = 'reorder_soon';
  else if (daysOfCover > AGED_INVENTORY_DAYS) status = 'overstock';
  else status = 'healthy';
  return { velocity, daysOfCover, status };
}

function amazonSizeTierToAppTier(raw) {
  const s = (raw || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[-_]+/g, ' ');
  if (/small.+standard|standard.+small/.test(s)) return 'ss';
  if (/large.+standard|standard.+large/.test(s)) return 'ls';
  if (/bulky/.test(s)) return 'lb';
  if (/small.+oversize|oversize.+small/.test(s)) return 'lb';
  if (/medium.+oversize|oversize.+medium/.test(s)) return 'lb';
  if (/large.+oversize|oversize.+large/.test(s)) return 'xl';
  if (/special.+oversize|oversize.+special/.test(s)) return 'xl';
  return null;
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

const BACKUP_NUDGE_DAYS  = 30;
const BACKUP_SNOOZE_DAYS = 7;

function shouldShowBackupNudge(lastExportIso, snoozedUntilIso, oldestProductIso, nowMs) {
  if (!oldestProductIso) return false;
  if (snoozedUntilIso && nowMs < new Date(snoozedUntilIso).getTime()) return false;
  const ref = lastExportIso || oldestProductIso;
  return (nowMs - new Date(ref).getTime()) / 86400000 > BACKUP_NUDGE_DAYS;
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

// ── Amazon report + Sale Planner + XLSX (mirrored from app) ──────────────────
function parseCSVRow(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur);
  return cols;
}
function normalizeHeaders(rawHdrs) {
  return rawHdrs.map(h => h.trim().toLowerCase().replace(/[()\-_]+/g, ' ').replace(/\s+/g, ' ').trim());
}
function parseAmzNum(s) {
  if (s === undefined || s === null) return 0;
  const cleaned = String(s).replace(/^="?/, '').replace(/"$/, '').replace(/[$%,\s"]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
function _amzCell(s) { return (s || '').trim().replace(/^="?/, '').replace(/"$/, ''); }
function detectAmazonReport(hdrs) {
  const has = h => hdrs.indexOf(h) !== -1;
  const inc = s => hdrs.some(h => h.includes(s));
  if (inc('ordered product sales')) return 'business';
  if (has('advertised product id') || (inc('spend') && (inc('acos') || inc('7 day total sales')))) return 'ads';
  const invQty = has('available') || inc('afn fulfillable quantity') || inc('fulfillable quantity') ||
                 inc('sellable quantity') || inc('available quantity');
  if ((has('asin') || has('sku')) && invQty) return 'inventory';
  return null;
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function endOfMonthYmd(d) { return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
// RULE: default sale end rolls to NEXT month's end when fewer than 3 days (incl. today) remain.
function defaultSaleEndYmd(d) {
  const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const remainingDays = eom.getDate() - d.getDate() + 1;
  if (remainingDays < 3) return ymd(new Date(d.getFullYear(), d.getMonth() + 2, 0));
  return ymd(eom);
}
const _AMZ_MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
function parseDateRangeStr(s) {
  if (!s) return null;
  const clean = _amzCell(s);
  const parts = clean.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;
  const parseOne = str => {
    const m = str.trim().match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (!m) return null;
    const mo = _AMZ_MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    return new Date(m[3] * 1, mo, m[2] * 1);
  };
  const start = parseOne(parts[0]), end = parseOne(parts[1]);
  if (!start || !end) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return { start: ymd(start), end: ymd(end), days };
}
function parseBusinessReport(lines, periodDays, fileName) {
  const hdrs = normalizeHeaders(parseCSVRow(lines[0]));
  const idx = (...names) => { for (const n of names) { const i = hdrs.indexOf(n); if (i !== -1) return i; } return -1; };
  const asinC = idx('child asin', 'asin');
  const revC  = idx('ordered product sales');
  const unitsC= idx('units ordered');
  const sessC = idx('sessions total', 'sessions');
  const cvrC  = idx('unit session percentage');
  const skuC  = idx('sku');
  const byAsin = {};
  let rowCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (asinC === -1) break;
    const cols = parseCSVRow(lines[i]);
    const asin = _amzCell(cols[asinC]).toUpperCase();
    if (!asin || asin.length < 5 || asin === 'TOTAL') continue;
    if (!byAsin[asin]) byAsin[asin] = { revenue: 0, units: 0, sessions: 0, cvr: 0, cvrSeen: false, sku: '' };
    const d = byAsin[asin];
    if (revC   !== -1) d.revenue  += parseAmzNum(cols[revC]);
    if (unitsC !== -1) d.units    += parseAmzNum(cols[unitsC]);
    if (sessC  !== -1) d.sessions += parseAmzNum(cols[sessC]);
    if (cvrC   !== -1) { const v = parseAmzNum(cols[cvrC]); if (v > 0) { d.cvr = v; d.cvrSeen = true; } }
    if (skuC   !== -1 && !d.sku) d.sku = _amzCell(cols[skuC]);
    rowCount++;
  }
  for (const a in byAsin) { const d = byAsin[a]; if (!d.cvrSeen && d.sessions > 0) d.cvr = +(d.units / d.sessions * 100).toFixed(2); }
  return { kind: 'business', fileName, periodDays: periodDays || 30, byAsin, rowCount };
}
function parseAdsReport(lines, fileName) {
  const hdrs = normalizeHeaders(parseCSVRow(lines[0]));
  const idx = (...names) => { for (const n of names) { const i = hdrs.indexOf(n); if (i !== -1) return i; } return -1; };
  const asinC  = idx('advertised product id', 'advertised asin', 'asin');
  const spendC = idx('total cost', 'spend');
  const revC   = idx('sales', '7 day total sales');
  const unitsC = idx('units sold', '7 day total units', '7 day total orders');
  const skuC   = idx('advertised product sku', 'sku');
  const dateC  = idx('date range');
  const byAsin = {};
  let rowCount = 0, overallStart = null, overallEnd = null;
  for (let i = 1; i < lines.length; i++) {
    if (asinC === -1) break;
    const cols = parseCSVRow(lines[i]);
    const asin = _amzCell(cols[asinC]).toUpperCase();
    if (!asin || asin.length < 5 || asin === 'TOTAL') continue;
    if (!byAsin[asin]) byAsin[asin] = { spend: 0, adRev: 0, adUnits: 0, sku: '', start: null, end: null };
    const d = byAsin[asin];
    if (spendC !== -1) d.spend   += parseAmzNum(cols[spendC]);
    if (revC   !== -1) d.adRev   += parseAmzNum(cols[revC]);
    if (unitsC !== -1) d.adUnits += parseAmzNum(cols[unitsC]);
    if (skuC   !== -1 && !d.sku) d.sku = _amzCell(cols[skuC]);
    if (dateC !== -1) {
      const r = parseDateRangeStr(cols[dateC]);
      if (r) {
        if (!d.start || r.start < d.start) d.start = r.start;
        if (!d.end   || r.end   > d.end)   d.end   = r.end;
        if (!overallStart || r.start < overallStart) overallStart = r.start;
        if (!overallEnd   || r.end   > overallEnd)   overallEnd   = r.end;
      }
    }
    rowCount++;
  }
  let periodDays = 30;
  if (overallStart && overallEnd) periodDays = Math.round((new Date(overallEnd).getTime() - new Date(overallStart).getTime()) / 86400000) + 1;
  return { kind: 'ads', fileName, periodDays, byAsin, rowCount, start: overallStart, end: overallEnd };
}
function parseInventoryReport(lines, fileName) {
  const hdrs = normalizeHeaders(parseCSVRow(lines[0]));
  const idx = (...names) => { for (const n of names) { const i = hdrs.indexOf(n); if (i !== -1) return i; } return -1; };
  const incIdx = frag => hdrs.findIndex(h => h.includes(frag));
  const asinC = idx('asin');
  const skuC  = idx('sku');
  let availC  = idx('available');
  if (availC === -1) availC = [incIdx('afn fulfillable quantity'), incIdx('fulfillable quantity'), incIdx('sellable quantity'), incIdx('available quantity')].find(i => i !== -1);
  if (availC === undefined) availC = -1;
  const inbC  = idx('inbound quantity');
  const ypC   = idx('your price');
  const spC   = idx('sales price');
  const snapC = idx('snapshot date');
  const u7C = idx('units shipped t7'), u30C = idx('units shipped t30'), u60C = idx('units shipped t60'), u90C = idx('units shipped t90');
  const s7C = idx('sales shipped last 7 days'), s30C = idx('sales shipped last 30 days'), s60C = idx('sales shipped last 60 days'), s90C = idx('sales shipped last 90 days');
  const byAsin = {};
  let rowCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (asinC === -1) break;
    const cols = parseCSVRow(lines[i]);
    const asin = _amzCell(cols[asinC]).toUpperCase();
    if (!asin || asin.length < 5 || asin === 'TOTAL') continue;
    if (!byAsin[asin]) byAsin[asin] = { sku: '', available: 0, inboundQty: 0, yourPrice: 0, salesPrice: 0, snapshotDate: '',
      u7: 0, u30: 0, u60: 0, u90: 0, s7: 0, s30: 0, s60: 0, s90: 0 };
    const d = byAsin[asin];
    if (skuC  !== -1 && !d.sku) d.sku = _amzCell(cols[skuC]);
    if (availC !== -1) d.available += parseAmzNum(cols[availC]);
    if (inbC   !== -1) d.inboundQty += parseAmzNum(cols[inbC]);
    if (ypC !== -1 && d.yourPrice <= 0)  { const v = parseAmzNum(cols[ypC]); if (v > 0) d.yourPrice = v; }
    if (spC !== -1 && d.salesPrice <= 0) { const v = parseAmzNum(cols[spC]); if (v > 0) d.salesPrice = v; }
    if (snapC !== -1 && !d.snapshotDate) d.snapshotDate = _amzCell(cols[snapC]);
    if (u7C  !== -1) d.u7  += parseAmzNum(cols[u7C]);
    if (u30C !== -1) d.u30 += parseAmzNum(cols[u30C]);
    if (u60C !== -1) d.u60 += parseAmzNum(cols[u60C]);
    if (u90C !== -1) d.u90 += parseAmzNum(cols[u90C]);
    if (s7C  !== -1) d.s7  += parseAmzNum(cols[s7C]);
    if (s30C !== -1) d.s30 += parseAmzNum(cols[s30C]);
    if (s60C !== -1) d.s60 += parseAmzNum(cols[s60C]);
    if (s90C !== -1) d.s90 += parseAmzNum(cols[s90C]);
    rowCount++;
  }
  return { kind: 'inventory', fileName, byAsin, rowCount };
}
const SALE_LADDER = [ { cover: 365, off: 0.20 }, { cover: 240, off: 0.15 }, { cover: 180, off: 0.12 }, { cover: 120, off: 0.08 } ];
const SALE_MIN_RUNWAY_DAYS = 45;
const SALE_MIN_OFF = 0.05;
const PLANNER_COVER_THRESHOLD_DEFAULT = 120;
function roundSaleEnding(x) {
  if (!(x > 0)) return +(x).toFixed(2);
  const candidate = Math.floor(x) - 0.10;
  if (candidate < 1) return +(x).toFixed(2);
  return +candidate.toFixed(2);
}
function suggestSalePrice(o) {
  const yourPrice = o.yourPrice, available = o.available, daysOfCover = o.daysOfCover;
  const threshold = o.coverThreshold > 0 ? o.coverThreshold : PLANNER_COVER_THRESHOLD_DEFAULT;
  const be = (o.breakEvenPrice !== undefined && o.breakEvenPrice !== null) ? o.breakEvenPrice : null;
  const realizedPrice = (o.realizedPrice !== undefined && o.realizedPrice !== null) ? o.realizedPrice : null;
  if (!(yourPrice > 0)) return { action: 'no_data', reason: 'no_price' };
  if (!(available > 0)) return { action: 'skip', reason: 'no_stock' };
  if (be !== null && yourPrice < be) return { action: 'skip', reason: 'loss_leader' };
  if (be !== null && realizedPrice !== null && realizedPrice > 0 && realizedPrice < be && yourPrice >= be)
    return { action: 'skip', reason: 'below_breakeven_promo' };
  const decisionCover = (o.pipelineCover !== undefined && o.pipelineCover !== null) ? o.pipelineCover : daysOfCover;
  if (decisionCover === null || decisionCover === undefined) return { action: 'no_data', reason: 'no_velocity' };
  if (decisionCover <= threshold) return { action: 'keep', reason: 'healthy' };
  if (daysOfCover !== null && daysOfCover !== undefined && daysOfCover < SALE_MIN_RUNWAY_DAYS)
    return { action: 'wait', reason: 'thin_stock_inbound' };
  let off = SALE_MIN_OFF;
  for (const rung of SALE_LADDER) { if (decisionCover >= rung.cover) { off = rung.off; break; } }
  const cap = +(yourPrice * (1 - SALE_MIN_OFF)).toFixed(2);
  let price = roundSaleEnding(yourPrice * (1 - off));
  if (price > cap) price = cap;
  const reason = decisionCover === Infinity ? 'no_sales' : 'overstock';
  if (be !== null) {
    if (price < be) {
      const floored = +Math.max(be, 0).toFixed(2);
      if (floored > cap) return { action: 'blocked', reason: 'floor_above_5pct', off, floor: floored };
      return { action: 'sale', reason, off, price: floored, floor: be };
    }
    return { action: 'sale', reason, off, price, floor: be };
  }
  return { action: 'sale', reason, off, price };
}

// ── XLSX writer (mirrored from app) ──
function xmlEscapeXlsx(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function colIndexToRef(i) {
  let s = ''; i = i + 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
function sheetXmlFromRows(rows) {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r], rowNum = r + 1;
    let rowXml = `<row r="${rowNum}">`;
    for (let c = 0; c < cells.length; c++) {
      const val = cells[c];
      if (val === '' || val === null || val === undefined) continue;
      const ref = colIndexToRef(c) + rowNum;
      if (typeof val === 'number') rowXml += `<c r="${ref}"><v>${val}</v></c>`;
      else rowXml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscapeXlsx(val)}</t></is></c>`;
    }
    xml += rowXml + '</row>';
  }
  return xml + '</sheetData></worksheet>';
}
const _CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); tbl[n] = c >>> 0; }
  return tbl;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function _strToBytesXlsx(str) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
  return Uint8Array.from(Buffer.from(str, 'utf8'));
}
function zipStore(files) {
  const enc = files.map(f => ({ nameBytes: _strToBytesXlsx(f.name), data: f.data, crc: crc32(f.data) }));
  const chunks = []; let offset = 0; const localOffsets = [];
  const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  for (const f of enc) {
    localOffsets.push(offset);
    const h = Uint8Array.from([].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(f.crc), u32(f.data.length), u32(f.data.length), u16(f.nameBytes.length), u16(0)));
    chunks.push(h, f.nameBytes, f.data);
    offset += h.length + f.nameBytes.length + f.data.length;
  }
  const cdStart = offset;
  for (let i = 0; i < enc.length; i++) {
    const f = enc[i];
    const c = Uint8Array.from([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(f.crc), u32(f.data.length), u32(f.data.length), u16(f.nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffsets[i])));
    chunks.push(c, f.nameBytes);
    offset += c.length + f.nameBytes.length;
  }
  const eocd = Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(enc.length), u16(enc.length),
    u32(offset - cdStart), u32(cdStart), u16(0)));
  chunks.push(eocd);
  let total = 0; for (const c of chunks) total += c.length;
  const out = new Uint8Array(total); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
const PQ_SETTINGS_ROW1 = 'settings=feedType=256&timestamp=2026-06-30T22%3A06%3A04.523Z&contributorId=amzn1.cr.o.AODBV7DB6KCBN&primaryMarketplaceId=amzn1.mp.o.ATVPDKIKX0DER&contentLanguageTag=en_US&templateIdentifier=39e0163e-fe4b-436f-b663-6bed17e81396&headerLanguageTag=en_US&labelRow=4&attributeRow=5&dataRow=7&flavor=seller-price-quantity&isProcessingSummary=false&isEdit=false&productTypeRequirement=LISTING_OFFER_ONLY&listingsItemRequirement=LISTING_OFFER_ONLY&reportProvenance=false&settingsHasAllDelocalizationData=true&ptds=UFJPRFVDVA%3D%3D&ptdToNamespaceMap=eyJQUk9EVUNUIjoiaW5nZXN0aW9uIn0%3D&browseClassifications=W3sicHJvZHVjdFR5cGUiOiJQUk9EVUNUIiwiYnJvd3NlQ2xhc3NpZmljYXRpb25LZXlzIjpbXX1d&vendorCodes=W10%3D&AttributeDefaultValues=eyJwcm9kdWN0X3R5cGUjMS52YWx1ZSI6IlBST0RVQ1QiLCJyZWNvcmRfYWN0aW9uIzEudmFsdWUiOiJwYXJ0aWFsX3VwZGF0ZSJ9&attributeSettings=W3siYXR0cmlidXRlIjoicHJvZHVjdF90eXBlIzEudmFsdWUiLCJhbGlhc2VzIjp7IlBST0RVQ1QiOiJQUk9EVUNUIn19LHsiYXR0cmlidXRlIjoiZnVsZmlsbG1lbnRfYXZhaWxhYmlsaXR5IzEuaXNfaW52ZW50b3J5X2F2YWlsYWJsZSIsImFsaWFzZXMiOnsiRW5hYmxlZCI6InRydWUiLCJEaXNhYmxlZCI6ImZhbHNlIn19LHsiYXR0cmlidXRlIjoicHVyY2hhc2FibGVfb2ZmZXJbbWFya2V0cGxhY2VfaWQ9QVRWUERLSUtYMERFUl1bYXVkaWVuY2U9QjJCXSMxLnF1YW50aXR5X2Rpc2NvdW50X3BsYW4jMS5zY2hlZHVsZSMxLmRpc2NvdW50X3R5cGUiLCJhbGlhc2VzIjp7IlBlcmNlbnQiOiJwZXJjZW50IiwiRGVsZXRlIFF1YW50aXR5IERpc2NvdW50cyI6ImFtem4xLnZvbHQuY3YuZGVsZXRlX3VtcF90b3BfbGV2ZWxfZmllbGQiLCJGaXhlZCI6ImZpeGVkIn19LHsiYXR0cmlidXRlIjoibWVyY2hhbnRfc2hpcHBpbmdfZ3JvdXAjMS52YWx1ZSIsImFsaWFzZXMiOnsiTWlncmF0ZWQgVGVtcGxhdGUiOiJsZWdhY3ktdGVtcGxhdGUtaWQifX0seyJhdHRyaWJ1dGUiOiJwdXJjaGFzYWJsZV9vZmZlclttYXJrZXRwbGFjZV9pZD1BVFZQREtJS1gwREVSXVthdWRpZW5jZT1BTExdIzEub3VyX3ByaWNlIzEuc2NoZWR1bGUjMS52YWx1ZV93aXRoX3RheCIsImFsaWFzZXMiOnsiRGVsZXRlIE9mZmVyIChTZWxsIG9uIEFtYXpvbikiOiJhbXpuMS52b2x0LmN2LmRlbGV0ZV91bXBfdmFyaWFudCJ9fSx7ImF0dHJpYnV0ZSI6InB1cmNoYXNhYmxlX29mZmVyW21hcmtldHBsYWNlX2lkPUFUVlBES0lLWDBERVJdW2F1ZGllbmNlPUFMTF0jMS5hdXRvbWF0ZWRfcHJpY2luZ19tZXJjaGFuZGlzaW5nX3J1bGVfcGxhbiMxLm1lcmNoYW5kaXNpbmdfcnVsZS5ydWxlX2lkIiwiYWxpYXNlcyI6eyJObyBQcmljZSBSdWxlIjoiZW1wdHlfdmFsdWVfbGFiZWwiLCJDb21wZXRpdGl2ZSBQcmljZSBSdWxlIGJ5IEFtYXpvbiI6IjUxMTM0MTU0MTIyLUNPTVBFVElUSVZFX0JVWUJPWCJ9fSx7ImF0dHJpYnV0ZSI6InB1cmNoYXNhYmxlX29mZmVyW2F1ZGllbmNlPUIyQl0jMS5jdXJyZW5jeSIsImFsaWFzZXMiOnsiRkpEIjoiRkpEIiwiTVhOIjoiTVhOIiwiU0NSIjoiU0NSIiwiTFZMIjoiTFZMIiwiQ0RGIjoiQ0RGIiwiR1RRIjoiR1RRIiwiQkJEIjoiQkJEIiwiQ0xQIjoiQ0xQIiwiVUdYIjoiVUdYIiwiSE5MIjoiSE5MIiwiWkFSIjoiWkFSIiwiVE5EIjoiVE5EIiwiU1ROIjoiU1ROIiwiU0xMIjoiU0xMIiwiQlNEIjoiQlNEIiwiU0RHIjoiU0RHIiwiSVFEIjoiSVFEIiwiR01EIjoiR01EIiwiQ1VQIjoiQ1VQIiwiVFdEIjoiVFdEIiwiUlNEIjoiUlNEIiwiRE9QIjoiRE9QIiwiS01GIjoiS01GIiwiTVlSIjoiTVlSIiwiRktQIjoiRktQIiwiWE9GIjoiWE9GIiwiR0VMIjoiR0VMIiwiVVlVIjoiVVlVIiwiTUFEIjoiTUFEIiwiQ1ZFIjoiQ1ZFIiwiVE9QIjoiVE9QIiwiUEdLIjoiUEdLIiwiT01SIjoiT01SIiwiQVpOIjoiQVpOIiwiU0VLIjoiU0VLIiwiS0VTIjoiS0VTIiwiVUFIIjoiVUFIIiwiQlROIjoiQlROIiwiR05GIjoiR05GIiwiTVpOIjoiTVpOIiwiRVJOIjoiRVJOIiwiU1ZDIjoiU1ZDIiwiQVJTIjoiQVJTIiwiUUFSIjoiUUFSIiwiSVJSIjoiSVJSIiwiWFBGIjoiWFBGIiwiVVpTIjoiVVpTIiwiVEhCIjoiVEhCIiwiQ05ZIjoiQ05ZIiwiTVJVIjoiTVJVIiwiQkRUIjoiQkRUIiwiTFlEIjoiTFlEIiwiQk1EIjoiQk1EIiwiUEhQIjoiUEhQIiwiS1dEIjoiS1dEIiwiUlVCIjoiUlVCIiwiUFlHIjoiUFlHIiwiSk1EIjoiSk1EIiwiSVNLIjoiSVNLIiwiQkVGIjoiQkVGIiwiRVNQIjoiRVNQIiwiQ09QIjoiQ09QIiwiVVNEIjoiVVNEIiwiTUtEIjoiTUtEIiwiRFpEIjoiRFpEIiwiUEFCIjoiUEFCIiwiU0dEIjoiU0dEIiwiR0dQIjoiR0dQIiwiRVRCIjoiRVRCIiwiSkVQIjoiSkVQIiwiVlVWIjoiVlVWIiwiVkVGIjoiVkVGIiwiU09TIjoiU09TIiwiS0dTIjoiS0dTIiwiTEFLIjoiTEFLIiwiQk5EIjoiQk5EIiwiWEFGIjoiWEFGIiwiTFJEIjoiTFJEIiwiSVRMIjoiSVRMIiwiSFJLIjoiSFJLIiwiQ0hGIjoiQ0hGIiwiQVRTIjoiQVRTIiwiREpGIjoiREpGIiwiQUxMIjoiQUxMIiwiWk1XIjoiWk1XIiwiVkVTIjoiVkVTIiwiVFpTIjoiVFpTIiwiVk5EIjoiVk5EIiwiQVVEIjoiQVVEIiwiSUxTIjoiSUxTIiwiS1BXIjoiS1BXIiwiR1lEIjoiR1lEIiwiR0hTIjoiR0hTIiwiTURMIjoiTURMIiwiS0hSIjoiS0hSIiwiQk9CIjoiQk9CIiwiSURSIjoiSURSIiwiS1lEIjoiS1lEIiwiQU1EIjoiQU1EIiwiVFJZIjoiVFJZIiwiU0hQIjoiU0hQIiwiQldQIjoiQldQIiwiTEJQIjoiTEJQIiwiVEpTIjoiVEpTIiwiSk9EIjoiSk9EIiwiUldGIjoiUldGIiwiSEtEIjoiSEtEIiwiQUVEIjoiQUVEIiwiRVVSIjoiRVVSIiwiTFNMIjoiTFNMIiwiREtLIjoiREtLIiwiQ0FEIjoiQ0FEIiwiQkdOIjoiQkdOIiwiTU1LIjoiTU1LIiwiRUVLIjoiRUVLIiwiU1lQIjoiU1lQIiwiTk9LIjoiTk9LIiwiTVVSIjoiTVVSIiwiSU1QIjoiSU1QIiwiR0lQIjoiR0lQIiwiUk9OIjoiUk9OIiwiTEtSIjoiTEtSIiwiTkdOIjoiTkdOIiwiQ1pLIjoiQ1pLIiwiQ1JDIjoiQ1JDIiwiUEtSIjoiUEtSIiwiWENEIjoiWENEIiwiR1JEIjoiR1JEIiwiSFRHIjoiSFRHIiwiQU5HIjoiQU5HIiwiQkhEIjoiQkhEIiwiUFRFIjoiUFRFIiwiU1pMIjoiU1pMIiwiU1JEIjoiU1JEIiwiS1pUIjoiS1pUIiwiVFREIjoiVFREIiwiU0FSIjoiU0FSIiwiTFRMIjoiTFRMIiwiWUVSIjoiWUVSIiwiTVZSIjoiTVZSIiwiQUZOIjoiQUZOIiwiSU5SIjoiSU5SIiwiTlBSIjoiTlBSIiwiS1JXIjoiS1JXIiwiQVdHIjoiQVdHIiwiTU5UIjoiTU5UIiwiSlBZIjoiSlBZIiwiUExOIjoiUExOIiwiQU9BIjoiQU9BIiwiU0JEIjoiU0JEIiwiR0JQIjoiR0JQIiwiQ1NEIjoiQ1NEIiwiQllOIjoiQllOIiwiSFVGIjoiSFVGIiwiQllSIjoiQllSIiwiTFVGIjoiTFVGIiwiQklGIjoiQklGIiwiTVdLIjoiTVdLIiwiTUdBIjoiTUdBIiwiRklNIjoiRklNIiwiREVNIjoiREVNIiwiQlpEIjoiQlpEIiwiQkFNIjoiQkFNIiwiTU9QIjoiTU9QIiwiRUdQIjoiRUdQIiwiTkFEIjoiTkFEIiwiU1NQIjoiU1NQIiwiU0tLIjoiU0tLIiwiTklPIjoiTklPIiwiUEVOIjoiUEVOIiwiV1NUIjoiV1NUIiwiTlpEIjoiTlpEIiwiVE1UIjoiVE1UIiwiRlJGIjoiRlJGIiwiQlJMIjoiQlJMIn19LHsiYXR0cmlidXRlIjoibWVyY2hhbnRfc2hpcHBpbmdfZ3JvdXBbbWFya2V0cGxhY2VfaWQ9QVRWUERLSUtYMERFUl0jMS52YWx1ZSIsImFsaWFzZXMiOnsiTWlncmF0ZWQgVGVtcGxhdGUiOiJsZWdhY3ktdGVtcGxhdGUtaWQifX0seyJhdHRyaWJ1dGUiOiJwdXJjaGFzYWJsZV9vZmZlclttYXJrZXRwbGFjZV9pZD1BVFZQREtJS1gwREVSXVthdWRpZW5jZT1CMkJdIzEub3VyX3ByaWNlIzEuc2NoZWR1bGUjMS52YWx1ZV93aXRoX3RheCIsImFsaWFzZXMiOnsiRGVsZXRlIE9mZmVyIChBbWF6b24gQnVzaW5lc3MgKEIyQikpIjoiYW16bjEudm9sdC5jdi5kZWxldGVfdW1wX3ZhcmlhbnQifX0seyJhdHRyaWJ1dGUiOiJwdXJjaGFzYWJsZV9vZmZlclthdWRpZW5jZT1CMkJdIzEucXVhbnRpdHlfZGlzY291bnRfcGxhbiMxLnNjaGVkdWxlIzEuZGlzY291bnRfdHlwZSIsImFsaWFzZXMiOnsiUGVyY2VudCI6InBlcmNlbnQiLCJGaXhlZCI6ImZpeGVkIn19LHsiYXR0cmlidXRlIjoicHVyY2hhc2FibGVfb2ZmZXJbYXVkaWVuY2U9QUxMXSMxLmF1dG9tYXRlZF9wcmljaW5nX21lcmNoYW5kaXNpbmdfcnVsZV9wbGFuIzEubWVyY2hhbmRpc2luZ19ydWxlLnJ1bGVfaWQiLCJhbGlhc2VzIjp7Ik5vIFByaWNlIFJ1bGUiOiJlbXB0eV92YWx1ZV9sYWJlbCIsIkNvbXBldGl0aXZlIFByaWNlIFJ1bGUgYnkgQW1hem9uIjoiNTExMzQxNTQxMjItQ09NUEVUSVRJVkVfQlVZQk9YIn19LHsiYXR0cmlidXRlIjoiZnVsZmlsbG1lbnRfYXZhaWxhYmlsaXR5IzEuZnVsZmlsbG1lbnRfY2hhbm5lbF9jb2RlIiwiYWxpYXNlcyI6eyJBTUFaT05fVVMyTVhfUkFGTiI6IkFNQVpPTl9VUzJNWF9SQUZOIiwiRnVsZmlsbG1lbnQgYnkgTWVyY2hhbnQgKERlZmF1bHQpIjoiREVGQVVMVCIsIjhjZDZhZTEzLTlhNGQtNDBhMS1iOGZmLTBkZjg0ZWQyYTRiZCI6IjhjZDZhZTEzLTlhNGQtNDBhMS1iOGZmLTBkZjg0ZWQyYTRiZCIsIkZ1bGZpbGxtZW50IGJ5IEFtYXpvbiAoTkEpIjoiQU1BWk9OX05BIn19LHsiYXR0cmlidXRlIjoicHVyY2hhc2FibGVfb2ZmZXJbYXVkaWVuY2U9QUxMXSMxLmN1cnJlbmN5IiwiYWxpYXNlcyI6eyJGSkQiOiJGSkQiLCJNWE4iOiJNWE4iLCJTQ1IiOiJTQ1IiLCJMVkwiOiJMVkwiLCJDREYiOiJDREYiLCJHVFEiOiJHVFEiLCJCQkQiOiJCQkQiLCJDTFAiOiJDTFAiLCJVR1giOiJVR1giLCJITkwiOiJITkwiLCJaQVIiOiJaQVIiLCJUTkQiOiJUTkQiLCJTVE4iOiJTVE4iLCJTTEwiOiJTTEwiLCJCU0QiOiJCU0QiLCJTREciOiJTREciLCJJUUQiOiJJUUQiLCJHTUQiOiJHTUQiLCJDVVAiOiJDVVAiLCJUV0QiOiJUV0QiLCJSU0QiOiJSU0QiLCJET1AiOiJET1AiLCJLTUYiOiJLTUYiLCJNWVIiOiJNWVIiLCJGS1AiOiJGS1AiLCJYT0YiOiJYT0YiLCJHRUwiOiJHRUwiLCJVWVUiOiJVWVUiLCJNQUQiOiJNQUQiLCJDVkUiOiJDVkUiLCJUT1AiOiJUT1AiLCJQR0siOiJQR0siLCJPTVIiOiJPTVIiLCJBWk4iOiJBWk4iLCJTRUsiOiJTRUsiLCJLRVMiOiJLRVMiLCJVQUgiOiJVQUgiLCJCVE4iOiJCVE4iLCJHTkYiOiJHTkYiLCJNWk4iOiJNWk4iLCJFUk4iOiJFUk4iLCJTVkMiOiJTVkMiLCJBUlMiOiJBUlMiLCJRQVIiOiJRQVIiLCJJUlIiOiJJUlIiLCJYUEYiOiJYUEYiLCJVWlMiOiJVWlMiLCJUSEIiOiJUSEIiLCJDTlkiOiJDTlkiLCJNUlUiOiJNUlUiLCJCRFQiOiJCRFQiLCJMWUQiOiJMWUQiLCJCTUQiOiJCTUQiLCJQSFAiOiJQSFAiLCJLV0QiOiJLV0QiLCJSVUIiOiJSVUIiLCJQWUciOiJQWUciLCJKTUQiOiJKTUQiLCJJU0siOiJJU0siLCJCRUYiOiJCRUYiLCJFU1AiOiJFU1AiLCJDT1AiOiJDT1AiLCJVU0QiOiJVU0QiLCJNS0QiOiJNS0QiLCJEWkQiOiJEWkQiLCJQQUIiOiJQQUIiLCJTR0QiOiJTR0QiLCJHR1AiOiJHR1AiLCJFVEIiOiJFVEIiLCJKRVAiOiJKRVAiLCJWVVYiOiJWVVYiLCJWRUYiOiJWRUYiLCJTT1MiOiJTT1MiLCJLR1MiOiJLR1MiLCJMQUsiOiJMQUsiLCJCTkQiOiJCTkQiLCJYQUYiOiJYQUYiLCJMUkQiOiJMUkQiLCJJVEwiOiJJVEwiLCJIUksiOiJIUksiLCJDSEYiOiJDSEYiLCJBVFMiOiJBVFMiLCJESkYiOiJESkYiLCJBTEwiOiJBTEwiLCJaTVciOiJaTVciLCJWRVMiOiJWRVMiLCJUWlMiOiJUWlMiLCJWTkQiOiJWTkQiLCJBVUQiOiJBVUQiLCJJTFMiOiJJTFMiLCJLUFciOiJLUFciLCJHWUQiOiJHWUQiLCJHSFMiOiJHSFMiLCJNREwiOiJNREwiLCJLSFIiOiJLSFIiLCJCT0IiOiJCT0IiLCJJRFIiOiJJRFIiLCJLWUQiOiJLWUQiLCJBTUQiOiJBTUQiLCJUUlkiOiJUUlkiLCJTSFAiOiJTSFAiLCJCV1AiOiJCV1AiLCJMQlAiOiJMQlAiLCJUSlMiOiJUSlMiLCJKT0QiOiJKT0QiLCJSV0YiOiJSV0YiLCJIS0QiOiJIS0QiLCJBRUQiOiJBRUQiLCJFVVIiOiJFVVIiLCJMU0wiOiJMU0wiLCJES0siOiJES0siLCJDQUQiOiJDQUQiLCJCR04iOiJCR04iLCJNTUsiOiJNTUsiLCJFRUsiOiJFRUsiLCJTWVAiOiJTWVAiLCJOT0siOiJOT0siLCJNVVIiOiJNVVIiLCJJTVAiOiJJTVAiLCJHSVAiOiJHSVAiLCJST04iOiJST04iLCJMS1IiOiJMS1IiLCJOR04iOiJOR04iLCJDWksiOiJDWksiLCJDUkMiOiJDUkMiLCJQS1IiOiJQS1IiLCJYQ0QiOiJYQ0QiLCJHUkQiOiJHUkQiLCJIVEciOiJIVEciLCJBTkciOiJBTkciLCJCSEQiOiJCSEQiLCJQVEUiOiJQVEUiLCJTWkwiOiJTWkwiLCJTUkQiOiJTUkQiLCJLWlQiOiJLWlQiLCJUVEQiOiJUVEQiLCJTQVIiOiJTQVIiLCJMVEwiOiJMVEwiLCJZRVIiOiJZRVIiLCJNVlIiOiJNVlIiLCJBRk4iOiJBRk4iLCJJTlIiOiJJTlIiLCJOUFIiOiJOUFIiLCJLUlciOiJLUlciLCJBV0ciOiJBV0ciLCJNTlQiOiJNTlQiLCJKUFkiOiJKUFkiLCJQTE4iOiJQTE4iLCJBT0EiOiJBT0EiLCJTQkQiOiJTQkQiLCJHQlAiOiJHQlAiLCJDU0QiOiJDU0QiLCJCWU4iOiJCWU4iLCJIVUYiOiJIVUYiLCJCWVIiOiJCWVIiLCJMVUYiOiJMVUYiLCJCSUYiOiJCSUYiLCJNV0siOiJNV0siLCJNR0EiOiJNR0EiLCJGSU0iOiJGSU0iLCJERU0iOiJERU0iLCJCWkQiOiJCWkQiLCJCQU0iOiJCQU0iLCJNT1AiOiJNT1AiLCJFR1AiOiJFR1AiLCJOQUQiOiJOQUQiLCJTU1AiOiJTU1AiLCJTS0siOiJTS0siLCJOSU8iOiJOSU8iLCJQRU4iOiJQRU4iLCJXU1QiOiJXU1QiLCJOWkQiOiJOWkQiLCJUTVQiOiJUTVQiLCJGUkYiOiJGUkYiLCJCUkwiOiJCUkwifX1d&TemplateType=unified&Version=2026.0630&TemplateSignature=UFJPRFVDVA==&umpVersion=MS41Mi40NQ==';
const PQ_INSTRUCTION_ROW2 = '     Use ENGLISH to fill this template. DO NOT modify or delete the colored header rows. To expand all optional columns, click the "2" button on the top left.';
const PQ_GROUP_ROW3 = ['Listing Identity', 'Offer (US) - (Sell on Amazon), (US) - (Amazon Business (B2B))'];
const PQ_LABELS_ROW4 = ['SKU','Fulfillment Channel Code (US)','Quantity (US)','Handling Time (US)','Restock Date (US)','Inventory Always Available (US)','Your Price USD (Sell on Amazon, US)','Pricing Rule (Sell on Amazon, US)','Minimum Seller Allowed Price (Sell on Amazon, US)','Maximum Seller Allowed Price (Sell on Amazon, US)','Sale Price USD (Sell on Amazon, US)','Sale Start Date (Sell on Amazon, US)','Sale End Date (Sell on Amazon, US)','Offering Release Date (Sell on Amazon, US)','Stop Selling Date (Sell on Amazon, US)','Your Price USD (Amazon Business (B2B), US)','Minimum Seller Allowed Price (Amazon Business (B2B), US)','Maximum Seller Allowed Price (Amazon Business (B2B), US)','Offering Release Date (Amazon Business (B2B), US)','Stop Selling Date (Amazon Business (B2B), US)','Quantity Price Type (Amazon Business (B2B), US)','Quantity Threshold (Lower Bound, Amazon Business (B2B), US)','Quantity Price (Fixed Price/Percentage Discount, Amazon Business (B2B), US)','Quantity Threshold (Lower Bound, Amazon Business (B2B), US)','Quantity Price (Fixed Price/Percentage Discount, Amazon Business (B2B), US)','Quantity Threshold (Lower Bound, Amazon Business (B2B), US)','Quantity Price (Fixed Price/Percentage Discount, Amazon Business (B2B), US)','Quantity Threshold (Lower Bound, Amazon Business (B2B), US)','Quantity Price (Fixed Price/Percentage Discount, Amazon Business (B2B), US)','Quantity Threshold (Lower Bound, Amazon Business (B2B), US)','Quantity Price (Fixed Price/Percentage Discount, Amazon Business (B2B), US)','Shipping Template (US)'];
const PQ_ATTR_ROW5 = ['contribution_sku#1.value','fulfillment_availability#1.fulfillment_channel_code','fulfillment_availability#1.quantity','fulfillment_availability#1.lead_time_to_ship_max_days','fulfillment_availability#1.restock_date','fulfillment_availability#1.is_inventory_available','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.our_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.automated_pricing_merchandising_rule_plan#1.merchandising_rule.rule_id','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.minimum_seller_allowed_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.maximum_seller_allowed_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.discounted_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.discounted_price#1.schedule#1.start_at','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.discounted_price#1.schedule#1.end_at','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.start_at.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.end_at.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.our_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.minimum_seller_allowed_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.maximum_seller_allowed_price#1.schedule#1.value_with_tax','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.start_at.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.end_at.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.discount_type','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#1.lower_bound','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#1.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#2.lower_bound','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#2.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#3.lower_bound','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#3.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#4.lower_bound','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#4.value','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#5.lower_bound','purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=B2B]#1.quantity_discount_plan#1.schedule#1.levels#5.value','merchant_shipping_group[marketplace_id=ATVPDKIKX0DER]#1.value'];
const PQ_NCOLS = 32;
function _padPQRow(arr) { const r = arr.slice(); while (r.length < PQ_NCOLS) r.push(''); return r; }
function buildPriceFeedXlsx(items, startYmd, endYmd) {
  const rows = [ _padPQRow([PQ_SETTINGS_ROW1]), _padPQRow([PQ_INSTRUCTION_ROW2]), _padPQRow(PQ_GROUP_ROW3),
    _padPQRow(PQ_LABELS_ROW4), _padPQRow(PQ_ATTR_ROW5), _padPQRow([]) ];
  for (const it of items) {
    const r = new Array(PQ_NCOLS).fill('');
    r[0] = String(it.sku); r[10] = Number(it.price); r[11] = startYmd; r[12] = endYmd;
    rows.push(r);
  }
  const sheetXml = sheetXmlFromRows(rows);
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Template" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  return zipStore([
    { name: '[Content_Types].xml', data: _strToBytesXlsx(contentTypes) },
    { name: '_rels/.rels', data: _strToBytesXlsx(rootRels) },
    { name: 'xl/workbook.xml', data: _strToBytesXlsx(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: _strToBytesXlsx(workbookRels) },
    { name: 'xl/styles.xml', data: _strToBytesXlsx(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: _strToBytesXlsx(sheetXml) }
  ]);
}

// ── XLSX reader (mirrored from app) ──
function _zU16(dv, o) { return dv.getUint16(o, true); }
function _zU32(dv, o) { return dv.getUint32(o, true); }
async function _amzInflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function unzip(arrayBuffer) {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minPos = Math.max(0, bytes.length - 65536 - 22);
  for (let i = bytes.length - 22; i >= minPos; i--) { if (_zU32(dv, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd === -1) throw new Error('Not a valid ZIP (EOCD not found) — is this really an .xlsx file?');
  const count = _zU16(dv, eocd + 10);
  const cdOffset = _zU32(dv, eocd + 16);
  const entries = {};
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (_zU32(dv, p) !== 0x02014b50) throw new Error('ZIP central directory corrupt');
    const method = _zU16(dv, p + 10);
    const compSize = _zU32(dv, p + 20);
    const nameLen = _zU16(dv, p + 28);
    const extraLen = _zU16(dv, p + 30);
    const commentLen = _zU16(dv, p + 32);
    const localOff = _zU32(dv, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (_zU32(dv, localOff) !== 0x04034b50) throw new Error('ZIP local header corrupt');
    const lNameLen = _zU16(dv, localOff + 26);
    const lExtraLen = _zU16(dv, localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    entries[name] = { method, slice: bytes.subarray(dataStart, dataStart + compSize) };
    p += 46 + nameLen + extraLen + commentLen;
  }
  const result = {};
  for (const name in entries) {
    const { method, slice } = entries[name];
    if (method === 0) result[name] = slice.slice();
    else if (method === 8) result[name] = await _amzInflateRaw(slice);
    else throw new Error('Unsupported ZIP compression method ' + method + ' for ' + name);
  }
  return result;
}
function _xmlUnescape(s) {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function parseXlsxSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml)) !== null) {
    let text = '';
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm;
    while ((tm = tRe.exec(m[1])) !== null) text += _xmlUnescape(tm[1]);
    strings.push(text);
  }
  return strings;
}
function _colRefToIndex(ref) {
  const m = ref.match(/^([A-Z]+)/);
  if (!m) return 0;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}
function parseXlsxSheet(sheetXml, sharedStrings) {
  const ss = sharedStrings || [];
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let rm;
  while ((rm = rowRe.exec(sheetXml)) !== null) {
    const inner = rm[1] || '';
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const attrs = cm[1] || '', bodyc = cm[2] || '';
      const refM = attrs.match(/r="([A-Z]+\d+)"/);
      const tM = attrs.match(/t="([^"]+)"/);
      const type = tM ? tM[1] : 'n';
      const colIdx = refM ? _colRefToIndex(refM[1]) : cells.length;
      let val = '';
      if (type === 's') {
        const vM = bodyc.match(/<v>([\s\S]*?)<\/v>/);
        if (vM) { const si = parseInt(_xmlUnescape(vM[1]), 10); val = ss[si] !== undefined ? ss[si] : ''; }
      } else if (type === 'inlineStr') {
        let txt = ''; const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm;
        while ((tm = tRe.exec(bodyc)) !== null) txt += _xmlUnescape(tm[1]);
        val = txt;
      } else if (type === 'str') {
        const vM = bodyc.match(/<v>([\s\S]*?)<\/v>/); val = vM ? _xmlUnescape(vM[1]) : '';
      } else if (type === 'b') {
        const vM = bodyc.match(/<v>([\s\S]*?)<\/v>/); val = vM && vM[1].trim() === '1' ? 'TRUE' : 'FALSE';
      } else {
        const vM = bodyc.match(/<v>([\s\S]*?)<\/v>/); val = vM ? _xmlUnescape(vM[1]) : '';
      }
      while (cells.length < colIdx) cells.push('');
      cells[colIdx] = val;
    }
    rows.push(cells);
  }
  return rows;
}
async function readXlsxFirstSheet(arrayBuffer) {
  const files = await unzip(arrayBuffer);
  const dec = new TextDecoder();
  let sheetName = null;
  if (files['xl/worksheets/sheet1.xml']) sheetName = 'xl/worksheets/sheet1.xml';
  else {
    const names = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => (+a.match(/sheet(\d+)/)[1]) - (+b.match(/sheet(\d+)/)[1]));
    if (names.length) sheetName = names[0];
  }
  if (!sheetName) throw new Error('No worksheet found inside the .xlsx file.');
  const sharedStrings = files['xl/sharedStrings.xml'] ? parseXlsxSharedStrings(dec.decode(files['xl/sharedStrings.xml'])) : [];
  return parseXlsxSheet(dec.decode(files[sheetName]), sharedStrings);
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

// ─── 15. shouldShowBackupNudge ───────────────────────────────────────────────
describe('shouldShowBackupNudge — export reminder decision');

const NOW = Date.now();
is(!shouldShowBackupNudge(null, null, null, NOW), 'no products → no nudge');
is( shouldShowBackupNudge(null, null, daysAgo(40), NOW), 'never exported, oldest product 40d old → nudge');
is(!shouldShowBackupNudge(null, null, daysAgo(10), NOW), 'never exported, oldest product 10d old → no nudge yet');
is(!shouldShowBackupNudge(null, null, daysAgo(30), NOW), 'exactly 30 days → no nudge (strictly greater)');
is(!shouldShowBackupNudge(daysAgo(5),  null, daysAgo(100), NOW), 'exported 5d ago → no nudge');
is( shouldShowBackupNudge(daysAgo(31), null, daysAgo(100), NOW), 'exported 31d ago → nudge');
is(!shouldShowBackupNudge(daysAgo(31), daysAgo(-3), daysAgo(100), NOW), 'snoozed until 3d from now → no nudge');
is( shouldShowBackupNudge(daysAgo(31), daysAgo(1),  daysAgo(100), NOW), 'snooze expired yesterday → nudge again');
is( shouldShowBackupNudge(null, daysAgo(1), daysAgo(40), NOW), 'expired snooze does not suppress never-exported nudge');

// ─── 16. getInventoryStatus — sales velocity & days of cover ────────────────
describe('getInventoryStatus');

is(getInventoryStatus(undefined, 30) === null, 'No inventory data → null (not yet checked in)');
is(getInventoryStatus(null, 30) === null, 'Null inventory → null');

const stockout = getInventoryStatus(100, 300); // 10 units/day velocity, 10 days of cover
eq(stockout.velocity, 10, 'Velocity: 300 units / 30 days = 10/day');
eq(stockout.daysOfCover, 10, 'Days of cover: 100 units / 10/day = 10 days');
eq(stockout.status, 'stockout_risk', `10 days < ${STOCKOUT_RISK_DAYS} → stockout_risk`);

const reorderSoon = getInventoryStatus(600, 300); // 10/day velocity, 60 days of cover
eq(reorderSoon.daysOfCover, 60, 'Days of cover: 600 / 10 = 60 days');
eq(reorderSoon.status, 'reorder_soon', `60 days is between ${STOCKOUT_RISK_DAYS} and ${REORDER_SOON_DAYS} → reorder_soon`);

const healthy = getInventoryStatus(1500, 300); // 10/day velocity, 150 days of cover
eq(healthy.daysOfCover, 150, 'Days of cover: 1500 / 10 = 150 days');
eq(healthy.status, 'healthy', `150 days is between ${REORDER_SOON_DAYS} and ${AGED_INVENTORY_DAYS} → healthy`);

const overstock = getInventoryStatus(6000, 300); // 10/day velocity, 600 days of cover
eq(overstock.status, 'overstock', `600 days > ${AGED_INVENTORY_DAYS} → overstock`);

const noSales = getInventoryStatus(200, 0);
eq(noSales.velocity, 0, 'Zero units sold → zero velocity');
is(noSales.daysOfCover === null, 'Zero velocity → days of cover cannot be computed (null, not Infinity)');
eq(noSales.status, 'no_sales', 'Inventory present but zero sales → no_sales (stagnant, not a stockout)');

const emptyAndNoSales = getInventoryStatus(0, 0);
eq(emptyAndNoSales.status, 'unknown', 'Zero inventory AND zero sales → unknown (never launched, not stagnant)');

const zeroInventory = getInventoryStatus(0, 300);
eq(zeroInventory.daysOfCover, 0, 'Zero inventory with real velocity → 0 days of cover (actual stockout)');
eq(zeroInventory.status, 'stockout_risk', 'Zero units in stock with sales history → stockout_risk');

// Boundary checks — thresholds are exclusive on the "healthy" side, matching checkKillSignals conventions
const atStockoutBoundary = getInventoryStatus(300, 300); // 30 days of cover exactly
eq(atStockoutBoundary.status, 'reorder_soon', `Exactly ${STOCKOUT_RISK_DAYS} days is NOT stockout_risk (threshold is strictly less-than)`);
const atReorderBoundary = getInventoryStatus(900, 300); // 90 days of cover exactly
eq(atReorderBoundary.status, 'healthy', `Exactly ${REORDER_SOON_DAYS} days is NOT reorder_soon (threshold is strictly less-than)`);
const atAgedBoundary = getInventoryStatus(1810, 300); // 181 days of cover exactly
eq(atAgedBoundary.status, 'healthy', `Exactly ${AGED_INVENTORY_DAYS} days is NOT overstock (threshold is strictly greater-than)`);

// F3 — flexible period: the SAME units over a LONGER window halve velocity / double cover.
const p30 = getInventoryStatus(600, 300, 30);
const p60 = getInventoryStatus(600, 300, 60);
eq(p30.velocity, 10, '300 units / 30d = 10/day');
eq(p60.velocity, 5, '300 units / 60d = 5/day (longer window → slower velocity)');
eq(p30.daysOfCover, 60, '600 / 10 = 60 days of cover (30d window)');
eq(p60.daysOfCover, 120, '600 / 5 = 120 days of cover (60d window → doubled)');
eq(getInventoryStatus(600, 300).daysOfCover, 60, 'omitted periodDays defaults to 30 (backward compatible)');
eq(getInventoryStatus(600, 300, 0).daysOfCover, 60, 'periodDays 0 falls back to 30');

// ─── 17. amazonSizeTierToAppTier — real Amazon export → app tier mapping ────
describe('amazonSizeTierToAppTier — real-world Amazon FBA size tier strings');

eq(amazonSizeTierToAppTier('UsSmallStandardSize'), 'ss', 'Real CIF export value: UsSmallStandardSize → ss');
eq(amazonSizeTierToAppTier('UsLargeStandardSize'), 'ls', 'Real CIF export value: UsLargeStandardSize → ls');
eq(amazonSizeTierToAppTier('SmallBulky'), 'lb', 'Real CIF export value: SmallBulky → lb (was silently falling through to null before the fix)');
eq(amazonSizeTierToAppTier('LargeBulky'), 'lb', 'LargeBulky → lb (this app has no separate large-bulky bucket)');
eq(amazonSizeTierToAppTier('Small Oversize'), 'lb', 'Legacy term: Small Oversize → lb');
eq(amazonSizeTierToAppTier('Medium Oversize'), 'lb', 'Legacy term: Medium Oversize → lb');
eq(amazonSizeTierToAppTier('Large Oversize'), 'xl', 'Legacy term: Large Oversize → xl');
eq(amazonSizeTierToAppTier('Special Oversize'), 'xl', 'Legacy term: Special Oversize → xl');
is(amazonSizeTierToAppTier('Unknown Tier XYZ') === null, 'Unrecognised string → null (caller falls back to a default)');
is(amazonSizeTierToAppTier('') === null, 'Empty string → null');
is(amazonSizeTierToAppTier(undefined) === null, 'Undefined → null (missing column value)');

// ─── 18. Amazon report fixtures (REAL header + data lines from the sample files) ─
const FX_bizHdr = "﻿(Parent) ASIN,(Child) ASIN,Title,SKU,Sessions - Total,Sessions - Total - B2B,Session Percentage - Total,Session Percentage - Total - B2B,Page Views - Total,Page Views - Total - B2B,Page Views Percentage - Total,Page Views Percentage - Total - B2B,Featured Offer (Buy Box) Percentage,Featured Offer (Buy Box) Percentage - B2B,Units Ordered,Units Ordered - B2B,Unit Session Percentage,Unit Session Percentage - B2B,Ordered Product Sales,Ordered Product Sales - B2B,Total Order Items,Total Order Items - B2B";
const FX_bizRow = "B0CKPQNSHN,B096MCMDPL,\"BasicGear Cast Net, Zinc Iron, 3ft Radius, 3/8 in Mesh, for Bait Fish\",5K-SC4U-PO06,\"12,131\",261,12.02%,9.85%,\"17,004\",336,12.57%,9.28%,99.80%,100.00%,683,5,5.63%,1.92%,\"$12,905.25\",$94.50,668,5";
const FX_adsHdr = "﻿Budget currency,Date range,Advertiser account ID,Advertiser account name,Portfolio ID,Portfolio name,Campaign ID,Campaign name,Ad group ID,Ad group name,Advertised product ID,Advertised product name,Advertised product parent ID,Advertised product brand,Advertised product category,Advertised product subcategory,Advertised product group,Advertised product SKU,Advertised product marketplace,Impressions,Clicks,CTR,Total cost,Purchases,Sales,Units sold,Cost per purchase,Purchase rate,ROAS,Purchases (promoted),Sales (promoted),Units sold (promoted),Cost per purchase (promoted),Purchase rate (promoted),ROAS (promoted),Purchases (halo),Sales (halo),Units sold (halo),Purchases (new to brand),Sales (new to brand),Units sold (new to brand),Cost per purchase (new to brand),Purchase rate (new to brand),ROAS (new to brand),Detail page views,Cost per detail page view,Detail page view rate";
const FX_adRow1 = "USD,\"Jul 06, 2026 - Jul 29, 2026\",\"=\"\"amzn1.ads-account.g.vgaf40no2wdzrxol9ycnbs55\"\"\",FishersCove,228547447293264,New Pliers HQ - Focus on top competitors - m19 - NI9AVFf1YbGU0YNz,\"=\"\"254927681919372\"\"\",\"SP - Knives, Pliers, Scissors, Carabiners, Tool Set - New Pliers HQ - Focus on top competitors -  - ZhLGEbJ7wPVzZHV2\",\"=\"\"5546739244741\"\"\",B0GWCDX3HY_product,B0GWCDX3HY,\"BasicGear Fishing Pliers, 17-4 PH Steel, 6.3 in Compact, Orange\",B0GWCY2NMC,BasicGear,31000 Professional Medical,31131 Pliers & Tweezers,Biss,BSCGRFT-PLIER-1PC-ITEM030163-ORANGE,AMAZON.COM,9582,100,1.0436%,108.61,11,180.90,11,9.87364,0.1148%,1.66559,8,127.20,8,13.57625,0.0835%,1.17116,3,53.70,3,,,,,,,,,";
const FX_adRow2 = "USD,\"Jul 01, 2026 - Jul 30, 2026\",\"=\"\"amzn1.ads-account.g.vgaf40no2wdzrxol9ycnbs55\"\"\",FishersCove,209409462944401,Fishing Pliers - m19 - uTSC5Ff1YbGrTfZX,\"=\"\"185952517318547\"\"\",\"SP - Knives, Pliers, Scissors, Carabiners, Tool Set - Fishing Pliers -  - auto - m19 - ZVb1EFKmOjELf+7y\",\"=\"\"481498426639588\"\"\",B0GWCDX3HY_auto,B0GWCDX3HY,\"BasicGear Fishing Pliers, 17-4 PH Steel, 6.3 in Compact, Orange\",B0GWCY2NMC,BasicGear,31000 Professional Medical,31131 Pliers & Tweezers,Biss,BSCGRFT-PLIER-1PC-ITEM030163-ORANGE,AMAZON.COM,1595,11,0.6897%,7.23,1,15.90,1,7.23000,0.0627%,2.19917,1,15.90,1,7.23000,0.0627%,2.19917,0,0.00,0,,,,,,,,,";
const FX_invHdr = "﻿\"snapshot-date\",\"sku\",\"fnsku\",\"asin\",\"product-name\",\"condition\",\"available\",\"fc-transfer\",\"pending-removal-quantity\",\"inv-age-0-to-90-days\",\"inv-age-91-to-180-days\",\"inv-age-181-to-270-days\",\"inv-age-271-to-365-days\",\"inv-age-366-to-455-days\",\"inv-age-456-plus-days\",\"currency\",\"units-shipped-t7\",\"units-shipped-t30\",\"units-shipped-t60\",\"units-shipped-t90\",\"alert\",\"your-price\",\"sales-price\",\"lowest-price-new-plus-shipping\",\"lowest-price-used\",\"recommended-action\",\"DEPRECATED healthy-inventory-level\",\"recommended-sales-price\",\"recommended-sale-duration-days\",\"recommended-removal-quantity\",\"estimated-cost-savings-of-recommended-actions\",\"sell-through\",\"item-volume\",\"volume-unit-measurement\",\"storage-type\",\"storage-volume\",\"marketplace\",\"product-group\",\"sales-rank\",\"days-of-supply\",\"estimated-excess-quantity\",\"weeks-of-cover-t30\",\"weeks-of-cover-t90\",\"featuredoffer-price\",\"sales-shipped-last-7-days\",\"sales-shipped-last-30-days\",\"sales-shipped-last-60-days\",\"sales-shipped-last-90-days\",\"inv-age-0-to-30-days\",\"inv-age-31-to-60-days\",\"inv-age-61-to-90-days\",\"inv-age-181-to-330-days\",\"inv-age-331-to-365-days\",\"estimated-storage-cost-next-month\",\"inbound-quantity\",\"inbound-working\",\"inbound-shipped\",\"inbound-received\",\"no-sale-last-6-months\",\"Total Reserved Quantity\",\"unfulfillable-quantity\",\"quantity-to-be-charged-ais-181-210-days\",\"estimated-ais-181-210-days\",\"quantity-to-be-charged-ais-211-240-days\",\"estimated-ais-211-240-days\",\"quantity-to-be-charged-ais-241-270-days\",\"estimated-ais-241-270-days\",\"quantity-to-be-charged-ais-271-300-days\",\"estimated-ais-271-300-days\",\"quantity-to-be-charged-ais-301-330-days\",\"estimated-ais-301-330-days\",\"quantity-to-be-charged-ais-331-365-days\",\"estimated-ais-331-365-days\",\"quantity-to-be-charged-ais-366-455-days\",\"estimated-ais-366-455-days\",\"quantity-to-be-charged-ais-456-plus-days\",\"estimated-ais-456-plus-days\",\"historical-days-of-supply\",\"fba-minimum-inventory-level\",\"fba-inventory-level-health-status\",\"Recommended ship-in quantity\",\"Recommended ship-in date\",\"Last updated date for Historical Days of Supply\",\"Exempted from Low-Inventory-Level fee?\",\"Low-Inventory-Level fee applied in current week?\",\"Short term historical days of supply\",\"Long term historical days of supply\",\"Inventory age snapshot date\",\"Inventory Supply at FBA\",\"Reserved FC Processing\",\"Reserved Customer Order\",\"Reserved Staging\",\"Total Days of Supply (including units from open shipments)\",\"supplier\",\"is-seasonal-in-next-3-months\",\"season-name\",\"season-start-date\",\"season-end-date\"";
const FX_invRow1 = "\"2026-07-31\",\"BSCGRSNT108\",\"X004MM14RB\",\"B0F315F9P2\",\"BasicGear Professional Seine Net, 6' x 20'\",\"\",\"0\",\"0\",\"0\",\"3\",\"0\",\"0\",\"0\",\"0\",\"0\",\"USD\",\"2\",\"18\",\"47\",\"59\",\"\",\"0.0\",\"0.0\",\"0.0\",\"0.0\",\"NoRestockExcessActionRequired\",\"\",\"\",\"0\",\"0\",\"\",\"6.56\",\"0.518913\",\"cubic feet\",\"Standard\",\"0.0\",\"US\",\"gl_sports\",\"12185\",\"366\",\"0\",\"41\",\"40\",\"49.99\",\"99.98\",\"899.82\",\"2349.53\",\"2949.41\",\"3\",\"0\",\"0\",\"0\",\"0\",\"\",\"186\",\"0\",\"186\",\"0\",\"\",\"2\",\"0\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"19.0\",\"27\",\"Out of stock\",\"\",\"\",\"2026-07-27\",\"Yes\",\"No\",\"13.3\",\"19.0\",\"2026-07-28\",\"186\",\"1\",\"1\",\"0\",\"366\",\"unassigned\",\"N\",\"\",\"\",\"\"";
const FX_invRow24 = "\"2026-07-31\",\"LANDINGNET-BAITWELLNET-01-24INCH\",\"X004TU68DV\",\"B0FQ2HP3Z9\",\"BasicGear Medium Baitwell Landing Net, 8x10 in Hoop, 24 in\",\"New\",\"165\",\"0\",\"0\",\"177\",\"0\",\"0\",\"0\",\"0\",\"0\",\"USD\",\"31\",\"153\",\"340\",\"373\",\"\",\"24.95\",\"22.9\",\"22.9\",\"0.0\",\"NoExcessInventory\",\"\",\"0.0\",\"0\",\"0\",\"0.0\",\"1.68\",\"0.210729\",\"cubic feet\",\"Oversize\",\"34.770285\",\"US\",\"gl_sports\",\"9430\",\"248\",\"0\",\"17\",\"23\",\"22.9\",\"709.9\",\"3507.8\",\"7940.47\",\"8732.64\",\"41\",\"136\",\"0\",\"0\",\"0\",\"23.95\",\"500\",\"0\",\"500\",\"0\",\"\",\"3\",\"1\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"53.8\",\"139\",\"Healthy\",\"\",\"\",\"2026-07-27\",\"No\",\"No\",\"44.6\",\"53.8\",\"2026-07-28\",\"665\",\"3\",\"0\",\"0\",\"249\",\"unassigned\",\"N\",\"\",\"\",\"\"";

describe('detectAmazonReport — real header rows + fallbacks');
eq(detectAmazonReport(normalizeHeaders(parseCSVRow(FX_bizHdr))), 'business', 'real Business header → business');
eq(detectAmazonReport(normalizeHeaders(parseCSVRow(FX_adsHdr))), 'ads', 'real Advertised-product header → ads');
eq(detectAmazonReport(normalizeHeaders(parseCSVRow(FX_invHdr))), 'inventory', 'real Inventory Health header → inventory');
eq(detectAmazonReport(['spend', '7 day total sales', 'advertised asin']), 'ads', 'old-format ads (spend + 7 day total sales) → ads');
eq(detectAmazonReport(['spend', 'acos', 'child asin']), 'ads', 'old-format ads (spend + acos) → ads');
eq(detectAmazonReport(['asin', 'afn fulfillable quantity', 'title']), 'inventory', 'old-format inventory (afn fulfillable quantity) → inventory');
eq(detectAmazonReport(['sku', 'sellable quantity']), 'inventory', 'old-format inventory (sellable quantity) → inventory');
eq(detectAmazonReport(['foo', 'bar', 'baz']), null, 'unrelated headers → null (unrecognized)');

describe('parseBusinessReport — real child-ASIN row');
const biz1 = parseBusinessReport([FX_bizHdr, FX_bizRow], 30, 'biz.csv');
const bd = biz1.byAsin['B096MCMDPL'];
is(!!bd, 'child ASIN B096MCMDPL parsed (not the parent B0CKPQNSHN)');
eq(bd.revenue, 12905.25, 'Ordered Product Sales "$12,905.25" → 12905.25 (strips $ and comma)');
eq(bd.units, 683, 'Units Ordered 683 (non-B2B column, not the B2B 5)');
eq(bd.sessions, 12131, 'Sessions - Total "12,131" → 12131');
eq(bd.cvr, 5.63, 'Unit Session Percentage 5.63% → 5.63');
eq(bd.sku, '5K-SC4U-PO06', 'SKU column captured');
eq(biz1.periodDays, 30, 'periodDays passed through');
// CVR recompute path (report missing Unit Session Percentage → units/sessions*100)
const bizNoCvr = parseBusinessReport(['child asin,sessions - total,units ordered,ordered product sales', 'B012345678,200,20,100'], 30, 'x');
eq(bizNoCvr.byAsin['B012345678'].cvr, 10, 'no CVR column → recompute 20/200*100 = 10');

describe('parseAdsReport — aggregate 2 campaign rows for one ASIN + guard/date tolerance');
const ads1 = parseAdsReport([FX_adsHdr, FX_adRow1, FX_adRow2], 'ads.csv');
const ad = ads1.byAsin['B0GWCDX3HY'];
is(!!ad, 'Advertised product ID B0GWCDX3HY parsed (plain, no guard)');
eq(+ad.spend.toFixed(2), 115.84, 'Total cost aggregated across 2 campaigns: 108.61 + 7.23');
eq(+ad.adRev.toFixed(2), 196.80, 'Sales aggregated: 180.90 + 15.90');
eq(ad.adUnits, 12, 'Units sold aggregated: 11 + 1 (not the promoted/halo variants)');
eq(ad.sku, 'BSCGRFT-PLIER-1PC-ITEM030163-ORANGE', 'Advertised product SKU captured');
eq(ad.start, '2026-07-01', 'min start across the two Date range values');
eq(ad.end, '2026-07-30', 'max end across the two Date range values');
eq(ads1.periodDays, 30, 'overall period = 2026-07-01 → 2026-07-30 inclusive = 30 days');
eq(ads1.start, '2026-07-01', 'overall min start');

describe('parseInventoryReport — real rows: prices, t-horizons, sku, inbound');
const inv1 = parseInventoryReport([FX_invHdr, FX_invRow1, FX_invRow24], 'inv.csv');
const iv = inv1.byAsin['B0FQ2HP3Z9'];
is(!!iv, 'ASIN B0FQ2HP3Z9 parsed');
eq(iv.sku, 'LANDINGNET-BAITWELLNET-01-24INCH', 'sku captured');
eq(iv.available, 165, 'available 165');
eq(iv.yourPrice, 24.95, 'your-price 24.95 (first > 0)');
eq(iv.salesPrice, 22.9, 'sales-price 22.9 (active sale wins later)');
eq(iv.u30, 153, 'units-shipped-t30 = 153');
eq(iv.s30, 3507.8, 'sales-shipped-last-30-days = 3507.80');
eq(iv.u90, 373, 'units-shipped-t90 = 373');
eq(iv.inboundQty, 500, 'inbound-quantity = 500');
eq(iv.snapshotDate, '2026-07-31', 'snapshot-date captured');
// your-price/sales-price 0.0 means "none"
const iv0 = inv1.byAsin['B0F315F9P2'];
eq(iv0.yourPrice, 0, 'your-price "0.0" → 0 (treated as none)');
eq(iv0.salesPrice, 0, 'sales-price "0.0" → 0 (treated as none)');
eq(iv0.available, 0, 'available "0" → 0');
// F5 addendum: realized transaction price = s30/u30 captures deals/coupons
eq(+(iv.s30 / iv.u30).toFixed(2), 22.93, 'realized30 = s30/u30 = 3507.80/153 ≈ 22.93 (captures the active sale)');

describe('parseDateRangeStr — inclusive day count + invalid');
const dr = parseDateRangeStr('Jul 06, 2026 - Jul 29, 2026');
eq(dr.start, '2026-07-06', 'start parsed');
eq(dr.end, '2026-07-29', 'end parsed');
eq(dr.days, 24, 'Jul 06 → Jul 29 inclusive = 24 days');
is(parseDateRangeStr('garbage') === null, 'unparseable → null');
is(parseDateRangeStr('') === null, 'empty → null');
eq(parseDateRangeStr('"Jul 01, 2026 - Jul 30, 2026"').days, 30, 'quoted range still parses (30 days)');

describe('endOfMonthYmd — month/year boundaries incl. leap Feb');
eq(endOfMonthYmd(new Date(2026, 6, 20)), '2026-07-31', 'mid-July → 2026-07-31');
eq(endOfMonthYmd(new Date(2026, 11, 5)), '2026-12-31', 'December → 2026-12-31 (year boundary)');
eq(endOfMonthYmd(new Date(2026, 0, 15)), '2026-01-31', 'January → 2026-01-31');
eq(endOfMonthYmd(new Date(2028, 1, 10)), '2028-02-29', 'Feb 2028 (leap) → 2028-02-29');
eq(endOfMonthYmd(new Date(2027, 1, 10)), '2027-02-28', 'Feb 2027 (non-leap) → 2027-02-28');

describe('defaultSaleEndYmd — rolls to next month when <3 days remain');
eq(defaultSaleEndYmd(new Date(2026, 6, 20)), '2026-07-31', 'mid-July → end of July');
eq(defaultSaleEndYmd(new Date(2026, 6, 29)), '2026-07-31', 'Jul 29 (3 days left) → still end of July');
eq(defaultSaleEndYmd(new Date(2026, 6, 30)), '2026-08-31', 'Jul 30 (2 days left) → end of August');
eq(defaultSaleEndYmd(new Date(2026, 6, 31)), '2026-08-31', 'Jul 31 (last day) → end of August');
eq(defaultSaleEndYmd(new Date(2026, 11, 31)), '2027-01-31', 'Dec 31 → end of January (year boundary)');
eq(defaultSaleEndYmd(new Date(2027, 1, 27)), '2027-03-31', 'Feb 27 non-leap (2 days left) → end of March');
eq(ymd(new Date(2026, 6, 3)), '2026-07-03', 'ymd pads month/day and never shifts by timezone');

describe('roundSaleEnding — promo prices end in .90 with $1 floor');
eq(roundSaleEnding(21.21), 20.90, '21.21 → 20.90');
eq(roundSaleEnding(19.00), 18.90, '19.00 → 18.90');
eq(roundSaleEnding(2.30), 1.90, '2.30 → 1.90');
eq(roundSaleEnding(1.05), 1.05, '1.05 → 1.05 (floor-0.10 would be 0.90 < $1, so fall back)');
eq(roundSaleEnding(0.50), 0.50, '0.50 → 0.50 (fallback for sub-$1 values)');

describe('suggestSalePrice — every action branch');
const S = suggestSalePrice;
eq(S({ yourPrice: 0, available: 10, daysOfCover: 400 }).reason, 'no_price', 'no Your Price → no_data/no_price');
eq(S({ yourPrice: 20, available: 0, daysOfCover: 400 }).reason, 'no_stock', 'no stock → skip/no_stock');
eq(S({ yourPrice: 10, available: 5, daysOfCover: 400, breakEvenPrice: 12 }).reason, 'loss_leader', 'Your Price below break-even → skip/loss_leader');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 400, breakEvenPrice: 15, realizedPrice: 12 }).reason, 'below_breakeven_promo', 'realized < break-even while YP ≥ break-even → skip/below_breakeven_promo');
eq(S({ yourPrice: 20, available: 5, daysOfCover: null }).reason, 'no_velocity', 'no velocity → no_data/no_velocity');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 90, coverThreshold: 120 }).reason, 'healthy', 'cover ≤ threshold → keep/healthy');
const sInf = S({ yourPrice: 20, available: 5, daysOfCover: Infinity });
eq(sInf.action, 'sale', 'no sales + stock → sale'); eq(sInf.off, 0.20, 'Infinity cover → 20% rung'); eq(sInf.reason, 'no_sales', 'reason no_sales'); eq(sInf.price, 15.90, 'price 20×0.80 → 15.90');
const s400 = S({ yourPrice: 20, available: 5, daysOfCover: 400 });
eq(s400.off, 0.20, '400d cover ≥ 365 → 20% rung'); eq(s400.reason, 'overstock', 'reason overstock');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 200 }).off, 0.12, '200d cover ≥ 180 but < 240 → 12% rung');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 250 }).off, 0.15, '250d cover ≥ 240 → 15% rung');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 130 }).off, 0.08, '130d cover ≥ 120 → 8% rung');
// 5% badge cap: a sale price is always ≥5% below Your Price
const s130 = S({ yourPrice: 20, available: 5, daysOfCover: 130 });
is((20 - s130.price) / 20 >= 0.05, `sale price ${s130.price} is ≥5% off Your Price (badge qualifies)`);
// break-even floor RAISES the sale price rather than selling at a loss
const sFloor = S({ yourPrice: 20, available: 5, daysOfCover: 400, breakEvenPrice: 17 });
eq(sFloor.action, 'sale', 'floor case still a sale'); eq(sFloor.price, 17, 'ladder 15.90 < break-even 17 → floored up to 17');
// blocked when the break-even floor exceeds the 5%-off cap
const sBlocked = S({ yourPrice: 20, available: 5, daysOfCover: 400, breakEvenPrice: 19.5 });
eq(sBlocked.action, 'blocked', 'break-even 19.5 > 5%-cap 19.0 → blocked'); eq(sBlocked.reason, 'floor_above_5pct', 'reason floor_above_5pct'); eq(sBlocked.floor, 19.5, 'returns the floor');

describe('suggestSalePrice — pipeline-aware cover + runway guard');
// backward compat: pipelineCover absent → decisionCover falls back to daysOfCover, identical results
eq(S({ yourPrice: 20, available: 5, daysOfCover: 400 }).off, 0.20, 'no pipelineCover: 400d → 20% (unchanged)');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 400 }).reason, 'overstock', 'no pipelineCover: reason overstock (unchanged)');
eq(S({ yourPrice: 20, available: 5, daysOfCover: 90, coverThreshold: 120 }).reason, 'healthy', 'no pipelineCover: 90 ≤ 120 → healthy (unchanged)');
// fat pipeline promotes a sellable-healthy row to a sale, ladder read from pipeline cover
const sPipe = S({ yourPrice: 20, available: 100, daysOfCover: 100, pipelineCover: 400 });
eq(sPipe.action, 'sale', 'sellable 100d healthy alone, pipeline 400d → sale'); eq(sPipe.off, 0.20, 'ladder rung from pipelineCover 400 → 20%');
// thin sellable stock behind a fat pipeline → wait for inbound, do not discount now
const sWait = S({ yourPrice: 20, available: 5, daysOfCover: 30, pipelineCover: 300, coverThreshold: 120 });
eq(sWait.action, 'wait', 'sellable 30d < 45 runway but pipeline 300d qualifies → wait'); eq(sWait.reason, 'thin_stock_inbound', 'reason thin_stock_inbound');
// guard must NOT fire when pipeline itself is healthy (≤ threshold)
eq(S({ yourPrice: 20, available: 5, daysOfCover: 30, pipelineCover: 100 }).reason, 'healthy', 'thin sellable but pipeline 100 ≤ 120 → keep/healthy (guard not reached)');
// infinite pipeline (no velocity all through the pipe) still lands a 20% no_sales sale
const sPipeInf = S({ yourPrice: 20, available: 200, daysOfCover: 200, pipelineCover: Infinity });
eq(sPipeInf.action, 'sale', 'pipelineCover Infinity → sale'); eq(sPipeInf.off, 0.20, 'Infinity pipeline → 20% rung'); eq(sPipeInf.reason, 'no_sales', 'reason no_sales'); eq(sPipeInf.price, 15.90, 'price 20×0.80 → 15.90');
// loss_leader gate runs before any cover logic — big pipeline cannot override it
eq(S({ yourPrice: 10, available: 5, daysOfCover: 30, pipelineCover: 400, breakEvenPrice: 12 }).reason, 'loss_leader', 'Your Price < break-even wins over fat pipeline → skip/loss_leader');
// boundary: decisionCover exactly at threshold → keep (not a sale)
eq(S({ yourPrice: 20, available: 5, daysOfCover: 120, pipelineCover: 120, coverThreshold: 120 }).action, 'keep', 'decisionCover == threshold → keep (boundary)');

describe('ZIP structural sanity + CRC-32');
eq(crc32(_strToBytesXlsx('hello')) >>> 0, 0x3610a686, 'CRC-32 of "hello" = 0x3610a686 (known value)');
eq(crc32(new Uint8Array(0)) >>> 0, 0, 'CRC-32 of empty input = 0');
const zbytes = zipStore([{ name: 'a.txt', data: _strToBytesXlsx('one') }, { name: 'b.txt', data: _strToBytesXlsx('two') }]);
is(zbytes[0] === 0x50 && zbytes[1] === 0x4b, 'ZIP starts with PK local-file signature');
// EOCD is the last 22 bytes: check its signature 0x06054b50 and entry count = 2
const zdv = new DataView(zbytes.buffer, zbytes.byteOffset, zbytes.byteLength);
eq(zdv.getUint32(zbytes.length - 22, true), 0x06054b50, 'EOCD signature present at end');
eq(zdv.getUint16(zbytes.length - 22 + 10, true), 2, 'EOCD records 2 entries');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY (async tail — XLSX round-trip needs await; summary/exit runs after it)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  describe('buildPriceFeedXlsx — round-trip through unzip + parseXlsxSheet');
  try {
    const xbytes = buildPriceFeedXlsx([{ sku: 'TEST-1', price: 18.9 }, { sku: 'A&B<2>', price: 9.9 }], '2026-07-31', '2026-07-31');
    is(xbytes.length > 0, 'buildPriceFeedXlsx produced bytes');
    const files = await unzip(xbytes.buffer);
    is(!!files['xl/worksheets/sheet1.xml'], 'unzip found xl/worksheets/sheet1.xml');
    is(!!files['[Content_Types].xml'] && !!files['xl/workbook.xml'] && !!files['xl/styles.xml'], 'all required package parts present');
    const rows = parseXlsxSheet(new TextDecoder().decode(files['xl/worksheets/sheet1.xml']), []);
    is(rows[0][0].indexOf('settings=feedType=256') === 0, 'A1 is the verbatim settings string (dataRow=7 layout)');
    is(rows[0][0].indexOf('labelRow=4&attributeRow=5&dataRow=7') !== -1, 'settings string preserves labelRow=4&attributeRow=5&dataRow=7');
    eq(rows[3][0], 'SKU', 'label row 4, col A = "SKU"');
    eq(rows[4][0], 'contribution_sku#1.value', 'attribute row 5, col A = contribution_sku#1.value');
    eq(rows[4][10], 'purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.discounted_price#1.schedule#1.value_with_tax', 'attribute row 5, col K = Sale Price attribute');
    eq(rows[6][0], 'TEST-1', 'data row 7, col A = SKU');
    eq(rows[6][10], '18.9', 'data row 7, col K = Sale Price (numeric round-trips as "18.9")');
    eq(rows[6][11], '2026-07-31', 'data row 7, col L = Sale Start Date');
    eq(rows[6][12], '2026-07-31', 'data row 7, col M = Sale End Date');
    eq(rows[7][0], 'A&B<2>', 'data row 8, col A round-trips XML-escaped chars (& < >)');
    eq(rows[7][10], '9.9', 'data row 8, col K = 9.9');
  } catch (e) {
    is(false, 'XLSX round-trip threw: ' + e.message);
  }

  const total = passed + failed;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${total} tests  ·  ${passed} passed  ·  ${failed} failed`);
  if (failed === 0) {
    console.log('  All tests passed ✓\n');
  } else {
    console.log(`  ${failed} test(s) FAILED ✗\n`);
    process.exit(1);
  }
})();
