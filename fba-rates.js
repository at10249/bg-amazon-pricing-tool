// US non-apparel, non-dangerous goods. Base rates exclude the fuel factor.
// Source and coverage metadata accompany the full versioned table below.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FBA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CARD = {
  "scope": "Amazon US FBA non-apparel, non-dangerous goods base fulfillment rates; excludes SIPP adjustments, low-inventory fees, overmax handling and other charges",
  "retrieved_utc": "2026-10-01",
  "source_url": "https://sellercentral.amazon.com/help/hub/reference/external/GABBX6GZPA8MSZGW?itemid=211&locale=en-us",
  "retrieval_method": "Official Amazon page content surfaced in web search index; direct open returned JavaScript shell. All numeric rows obtained, not inferred from average increases.",
  "currency": "USD",
  "price_bands": [
    {
      "key": "lt10",
      "min": 0,
      "max_exclusive": 10
    },
    {
      "key": "10to50",
      "min_inclusive": 10,
      "max_inclusive": 50
    },
    {
      "key": "gt50",
      "min_exclusive": 50
    }
  ],
  "fuel_surcharge": {
    "rate": 0.035,
    "effective_start": "2026-04-17",
    "included_in_tables": false,
    "applies_to_peak": true
  },
  "periods": {
    "nonpeak": {
      "start": "2026-01-15",
      "end_inclusive": "2026-10-14"
    },
    "peak": {
      "start": "2026-10-15",
      "end_inclusive": "2027-01-14"
    }
  },
  "fee_timing": "Shipment departure from fulfillment center, not order date",
  "increment_rule": "base + increment_usd * max(0, ceil((shipping_weight_lb - increment_above_lb) / increment_lb)); fixed brackets use strict lower / inclusive upper bounds",
  "size_tiers": [
    {
      "tier": "small_standard",
      "max_weight_lb": 1,
      "max_sides_in": [
        15,
        12,
        0.75
      ],
      "weight_basis": "unit_weight"
    },
    {
      "tier": "large_standard",
      "max_weight_lb": 20,
      "max_sides_in": [
        18,
        14,
        8
      ],
      "weight_basis": "max(unit_weight,dimensional_weight)"
    },
    {
      "tier": "small_bulky",
      "max_weight_lb": 50,
      "max_sides_in": [
        37,
        28,
        20
      ],
      "max_length_plus_girth_in": 130,
      "weight_basis": "max(unit_weight,dimensional_weight)"
    },
    {
      "tier": "large_bulky",
      "max_weight_lb": 50,
      "max_sides_in": [
        59,
        33,
        33
      ],
      "max_length_plus_girth_in": 130,
      "weight_basis": "max(unit_weight,dimensional_weight)"
    }
  ],
  "size_tier_source": "https://sellercentral.amazon.com/help/hub/reference/external/GG5KW835AHDJCH8W?locale=tr-TR",
  "weight_notes": [
    "Dimensions refer to fully packaged unit; sort longest, median, shortest. Length plus girth = longest + 2*(median+shortest).",
    "Dimensional weight pounds = cubic inches / 139; bulky and extra-large use at least 2 inches for width and height.",
    "Fee weight: unit weight only for small_standard and extra_large_150_plus; otherwise greater of unit and dimensional weight.",
    "Use specific dimensional-weight page criteria: Small standard uses unit weight <= 16 oz for tier selection; other size tiers use max(unit,dimensional). Generic product-tier table footnote says max weight, but the specific page explicitly states the small-standard exception.",
    "No per-dimension rounding instruction was verified; do not import old forum packaging-weight add-ons."
  ],
  "cautions": [
    "As of Oct 1 nonpeak is effective, but October month crosses Oct 15 peak transition. Preserve agreed runbook rate assumption; evaluate peak separately if site is static.",
    "Fee Preview and Revenue Calculator already reflect surcharge and offer peak preview. Do not blindly multiply a surcharge-inclusive export by 1.035.",
    "SIPP program discounts standard certified products and adds charges for non-certified bulky products; those adjustments need separate status/rates.",
    "Extra-large up to 150 lb exceeding 96 inches longest side or 130 inches length plus girth incurs separate overmax fee.",
    "The ratecard supplies base fees only. It does not establish that a seller-specific fee equals the base tariff."
  ],
  "dimensional_weight_source": "https://sellercentral.amazon.com/help/hub/reference/external/G53Z9EKF8VVZVH29?locale=es-ES",
  "rounding_verification": "The 2026 source examples confirm ceil to 4 oz interval above 3 lb for non-apparel large standard (3.35 lb => 2 intervals), and ceil to lb for bulky (7.9 lb => 7 intervals above first lb). No per-dimension rounding was verified.",
  "rates": [
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.0,"weight_lb_lte":0.125,"base_fees":[2.43,3.32,3.58]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.125,"weight_lb_lte":0.25,"base_fees":[2.49,3.42,3.68]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.25,"weight_lb_lte":0.375,"base_fees":[2.56,3.45,3.71]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.375,"weight_lb_lte":0.5,"base_fees":[2.66,3.54,3.8]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.5,"weight_lb_lte":0.625,"base_fees":[2.77,3.68,3.94]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.625,"weight_lb_lte":0.75,"base_fees":[2.82,3.78,4.04]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.75,"weight_lb_lte":0.875,"base_fees":[2.92,3.91,4.17]},
    {"period":"nonpeak","tier":"small_standard","weight_lb_gt":0.875,"weight_lb_lte":1.0,"base_fees":[2.95,3.96,4.22]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":0.0,"weight_lb_lte":0.25,"base_fees":[2.91,3.73,3.99]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":0.25,"weight_lb_lte":0.5,"base_fees":[3.13,3.95,4.21]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":0.5,"weight_lb_lte":0.75,"base_fees":[3.38,4.2,4.46]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":0.75,"weight_lb_lte":1.0,"base_fees":[3.78,4.6,4.86]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":1.0,"weight_lb_lte":1.25,"base_fees":[4.22,5.04,5.3]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":1.25,"weight_lb_lte":1.5,"base_fees":[4.6,5.42,5.68]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":1.5,"weight_lb_lte":1.75,"base_fees":[4.75,5.57,5.83]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":1.75,"weight_lb_lte":2.0,"base_fees":[5.0,5.82,6.08]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":2.0,"weight_lb_lte":2.25,"base_fees":[5.1,5.92,6.18]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":2.25,"weight_lb_lte":2.5,"base_fees":[5.28,6.1,6.36]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":2.5,"weight_lb_lte":2.75,"base_fees":[5.44,6.26,6.52]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":2.75,"weight_lb_lte":3.0,"base_fees":[5.85,6.67,6.93]},
    {"period":"nonpeak","tier":"large_standard","weight_lb_gt":3,"weight_lb_lte":20,"base_fees":[6.15,6.97,7.23],"increment_usd":0.08,"increment_lb":0.25,"increment_above_lb":3},
    {"period":"nonpeak","tier":"small_bulky","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[6.78,7.55,7.55],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"nonpeak","tier":"large_bulky","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[8.58,9.35,9.35],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"nonpeak","tier":"extra_large_0_50","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[25.56,26.33,26.33],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"nonpeak","tier":"extra_large_50_70","weight_lb_gt":50,"weight_lb_lte":70,"base_fees":[36.55,37.32,37.32],"increment_usd":0.75,"increment_lb":1,"increment_above_lb":51},
    {"period":"nonpeak","tier":"extra_large_70_150","weight_lb_gt":70,"weight_lb_lte":150,"base_fees":[50.55,51.32,51.32],"increment_usd":0.75,"increment_lb":1,"increment_above_lb":71},
    {"period":"nonpeak","tier":"extra_large_150_plus","weight_lb_gt":150,"weight_lb_lte":null,"base_fees":[194.18,194.95,194.95],"increment_usd":0.19,"increment_lb":1,"increment_above_lb":151},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.0,"weight_lb_lte":0.125,"base_fees":[2.62,3.51,3.77]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.125,"weight_lb_lte":0.25,"base_fees":[2.68,3.61,3.87]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.25,"weight_lb_lte":0.375,"base_fees":[2.76,3.65,3.91]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.375,"weight_lb_lte":0.5,"base_fees":[2.86,3.74,4.0]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.5,"weight_lb_lte":0.625,"base_fees":[2.98,3.89,4.15]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.625,"weight_lb_lte":0.75,"base_fees":[3.03,3.99,4.25]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.75,"weight_lb_lte":0.875,"base_fees":[3.14,4.13,4.39]},
    {"period":"peak","tier":"small_standard","weight_lb_gt":0.875,"weight_lb_lte":1.0,"base_fees":[3.17,4.18,4.44]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":0.0,"weight_lb_lte":0.25,"base_fees":[3.15,3.97,4.23]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":0.25,"weight_lb_lte":0.5,"base_fees":[3.39,4.21,4.47]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":0.5,"weight_lb_lte":0.75,"base_fees":[3.66,4.48,4.74]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":0.75,"weight_lb_lte":1.0,"base_fees":[4.07,4.89,5.15]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":1.0,"weight_lb_lte":1.25,"base_fees":[4.52,5.34,5.6]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":1.25,"weight_lb_lte":1.5,"base_fees":[4.91,5.73,5.99]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":1.5,"weight_lb_lte":1.75,"base_fees":[5.07,5.89,6.15]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":1.75,"weight_lb_lte":2.0,"base_fees":[5.33,6.15,6.41]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":2.0,"weight_lb_lte":2.25,"base_fees":[5.47,6.29,6.55]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":2.25,"weight_lb_lte":2.5,"base_fees":[5.67,6.49,6.75]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":2.5,"weight_lb_lte":2.75,"base_fees":[5.84,6.66,6.92]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":2.75,"weight_lb_lte":3.0,"base_fees":[6.26,7.08,7.34]},
    {"period":"peak","tier":"large_standard","weight_lb_gt":3,"weight_lb_lte":20,"base_fees":[6.69,7.51,7.77],"increment_usd":0.08,"increment_lb":0.25,"increment_above_lb":3},
    {"period":"peak","tier":"small_bulky","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[7.82,8.59,8.59],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"peak","tier":"large_bulky","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[9.62,10.39,10.39],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"peak","tier":"extra_large_0_50","weight_lb_gt":0,"weight_lb_lte":50,"base_fees":[28.29,29.06,29.06],"increment_usd":0.38,"increment_lb":1,"increment_above_lb":1},
    {"period":"peak","tier":"extra_large_50_70","weight_lb_gt":50,"weight_lb_lte":70,"base_fees":[39.36,40.13,40.13],"increment_usd":0.75,"increment_lb":1,"increment_above_lb":51},
    {"period":"peak","tier":"extra_large_70_150","weight_lb_gt":70,"weight_lb_lte":150,"base_fees":[54.97,55.74,55.74],"increment_usd":0.75,"increment_lb":1,"increment_above_lb":71},
    {"period":"peak","tier":"extra_large_150_plus","weight_lb_gt":150,"weight_lb_lte":null,"base_fees":[202.69,203.46,203.46],"increment_usd":0.19,"increment_lb":1,"increment_above_lb":151}
  ]
};
  // Register future cards explicitly; seasonal recurrence never authorizes reusing old prices.
  const CARDS = [CARD];
  const TIER = {ss:'small_standard', ls:'large_standard', sb:'small_bulky', lb:'large_bulky'};
  function validDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  }
  function season(s) {
    if (!validDate(s)) return null;
    const md = s.slice(5);
    return md >= '10-15' || md <= '01-14' ? 'peak' : 'nonpeak';
  }
  function windowFor(s) {
    if (!validDate(s)) return null;
    for (const card of CARDS) for (const [period, dates] of Object.entries(card.periods)) {
      if (s >= dates.start && s <= dates.end_inclusive) return {card, period, ...dates};
    }
    return null;
  }
  function periodCoverage(start, end) {
    if (!validDate(start) || !validDate(end) || start > end) return {error:'Enter a valid sale start and end date.', windows:[]};
    const windows = [];
    let cursor = start;
    while (cursor <= end) {
      const w = windowFor(cursor);
      if (!w) return {error:`No verified FBA rate coverage for ${cursor} (${season(cursor)}). Add an official dated rate card before planning.`, windows};
      const last = end < w.end_inclusive ? end : w.end_inclusive;
      windows.push({...w, start:cursor, end_inclusive:last});
      const next = new Date(last); next.setUTCDate(next.getUTCDate()+1);
      cursor = next.toISOString().slice(0,10);
    }
    return {windows, error:null};
  }
  function dimensions(inputs) {
    const d = inputs.dimensions;
    return Array.isArray(d) && d.length === 3 && d.every(v=>Number.isFinite(v) && v>0) ? [...d].sort((a,b)=>b-a) : null;
  }
  function sizeTier(d, oz) {
    if (!Array.isArray(d) || d.length!==3 || !d.every(v=>Number.isFinite(v)&&v>0) || !(oz>0)) return null;
    const [l,w,h] = [...d].sort((a,b)=>b-a), unit=oz/16;
    if (l<=15 && w<=12 && h<=0.75 && unit<=1) return 'ss';
    const standardWeight=Math.max(unit,l*w*h/139);
    if (l<=18 && w<=14 && h<=8 && standardWeight<=20) return 'ls';
    const bulkyWeight=Math.max(unit,l*Math.max(w,2)*Math.max(h,2)/139);
    if (l<=37 && w<=28 && h<=20 && l+2*(w+h)<=130 && bulkyWeight<=50) return 'sb';
    if (l<=59 && w<=33 && h<=33 && l+2*(w+h)<=130 && bulkyWeight<=50) return 'lb';
    return 'xl';
  }
  function physical(inputs) {
    const unit = inputs.weight/16, d=dimensions(inputs);
    if (Array.isArray(inputs.dimensions) && inputs.dimensions.some(v=>v>0) && !d) return {error:'Complete all three positive packaged dimensions.'};
    if (!Number.isFinite(unit) || unit<=0) return {error:'Missing packaged unit weight.'};
    if (!TIER[inputs.sizetier] && inputs.sizetier!=='xl') return {error:'Unsupported FBA size tier.'};
    if (!d && inputs.sizetier!=='ss') return {error:'Missing packaged dimensions; dimensional weight cannot be verified.'};
    // A reported standard tier still needs dimensions to be physically consistent when supplied.
    const tier=d ? sizeTier(d,inputs.weight) : inputs.sizetier;
    const dim = tier==='ss' ? null : d[0]*(tier==='ls'?d[1]:Math.max(d[1],2))*(tier==='ls'?d[2]:Math.max(d[2],2))/139;
    let weight = tier==='ss' ? unit : Math.max(unit,dim);
    let key = TIER[tier];
    if (tier==='xl') {
      // The 150+ unit-weight exception only applies when the unit is itself over 150lb.
      if (unit>150) {key='extra_large_150_plus'; weight=unit;}
      else if (weight<=50) key='extra_large_0_50';
      else if (weight<=70) key='extra_large_50_70';
      else if (weight<=150) key='extra_large_70_150';
      else return {error:'Dimensional weight exceeds supported extra-large 150lb coverage.'};
      if (unit<=150 && (d[0]>96 || d[0]+2*(d[1]+d[2])>130)) return {error:'Overmax handling fee requires a separate verified quote.'};
    }
    return {tier,key,unitWeightLb:unit,dimensionalWeightLb:dim,shippingWeightLb:weight,error:null};
  }
  function quote(inputs, price, date) {
    const w=windowFor(date);
    if (!w) return {error:`No verified FBA rate coverage for ${date || 'unknown date'}.`};
    const p=physical(inputs);
    if (p.error) return p;
    if (!(price>=0) || !Number.isFinite(price)) return {error:'Invalid selling price.'};
    const row=w.card.rates.find(r=>r.period===w.period && r.tier===p.key && p.shippingWeightLb>r.weight_lb_gt &&
      (r.weight_lb_lte===null || p.shippingWeightLb<=r.weight_lb_lte));
    if (!row) return {error:'Weight outside verified rate tier.'};
    const band=price<10?0:price<=50?1:2;
    const steps=row.increment_lb ? Math.max(0,Math.ceil((p.shippingWeightLb-row.increment_above_lb)/row.increment_lb-1e-10)) : 0;
    const base=row.base_fees[band]+steps*(row.increment_usd||0);
    const fuelFactor=inputs.surcharge && date>=w.card.fuel_surcharge.effective_start ? 1+w.card.fuel_surcharge.rate : 1;
    return {...p,base,fuel:base*(fuelFactor-1),total:base*fuelFactor,fuelFactor,band,period:w.period,
      effectiveFrom:w.start,effectiveThrough:w.end_inclusive,source:w.card.source_url,error:null};
  }
  function describe(coverage) {
    if (coverage.error) return coverage.error;
    return coverage.windows.map(w=>`${w.period} ${w.start} → ${w.end_inclusive}`).join('; ') +
      '. Base rates exclude fuel; 3.5% fuel/logistics applies once from 2026-04-17 when enabled. Fees follow FC shipment departure; allow for shipping after the sale ends. Storage is separate.';
  }
  return {CARD,CARDS,validDate,season,windowFor,periodCoverage,sizeTier,physical,quote,describe};
});
