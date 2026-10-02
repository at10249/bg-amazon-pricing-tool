// Regression tests use the shipped rate module and actual functions from index.html.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const FBA = require('./fba-rates');
const html = fs.readFileSync('index.html','utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]); // entire inline app parses
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ '+name); }
function near(a,b) { assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`); }
function source(name) {
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,name);
  const lineEnd=html.indexOf('\n',start);
  const end=html.slice(start,lineEnd).trim().endsWith('}') ? lineEnd : html.indexOf('\n}',start)+2;
  return html.slice(start,end);
}
const nodes={}; const alerts=[];
// "Today" is pinned so planner date rules (stale-date fallback, start clamp, expiry warning)
// are deterministic. new Date() / Date.now() return TODAY; explicit constructor args are untouched.
let TODAY=new Date(2026,9,2);
class FixedDate extends Date { constructor(...a){ super(...(a.length?a:[TODAY.getTime()])); } static now(){ return TODAY.getTime(); } }
const context=vm.createContext({FBA,console,Date:FixedDate,Math,Number,String,Object,Array,alert:s=>alerts.push(s),
  document:{getElementById:id=>nodes[id] || null},
  state:{products:[],planner:{startDate:'2026-10-01',endDate:'2026-10-31',overrides:{}},reportData:{byAsin:{}}},
  saveToStorage:()=>{},renderSalePlanner:()=>{},renderAll:()=>{}, t:s=>s,
  // Synchronous FileReader stand-in so the real importFBAFeePreview() can be driven from a string.
  FileReader:class{readAsText(f){this.onload({target:{result:f.text}});}}});
const constants=['FBA_EXPIRY_WARN_FROM','S3_KILL_DAYS','S2_KILL_DAYS','S1_KILL_DAYS','S2_AD_SALES_TARGET','VINE_WINDOW_DAYS','STALE_DAYS','K4_SPEND_RATIO','VINE_COST','PRICE_YOUR_END','PRICE_LIST_END','PRICE_SALE_END','PRICE_DISC_END','SALE_DISCOUNT','CLEARANCE_DISCOUNT','LIST_PREMIUM','SALE_LADDER','SALE_MIN_RUNWAY_DAYS','SALE_MIN_OFF','SALE_END_ROLL_DAYS','PLANNER_COVER_THRESHOLD_DEFAULT'];
for(const name of constants) vm.runInContext(html.match(new RegExp('const '+name+'\\s*=[^;]+;'))[0],context);
for(const name of ['ymd','defaultSaleEndYmd','fbaCoverageEnd','fbaExpiryWarning','fbaCalibration','fbaQuote','fbaCalibrationText','needsDimsText','saleFeeDates','salePeriodNet','feeJumpSafePrice','csvDimensions','parseAmazonFeeEstimate','checkKillSignals','parseCSVRow','createDefaultProduct','importFBAFeePreview','feeDate','baseFBA','totalFBA','getReferralFee','solveMinPriceRaw','salePeriodFloor','salePeriodMargin','feeWaterfall','roundEnd','calcPrices','saleFeeWindow','roundSaleEnding','suggestSalePrice','plannerRows','_plannerEnsure','plannerSetDate','collectPlanItems','exportPriceFile','amazonSizeTierToAppTier','sizeTierFromDims']) vm.runInContext(source(name),context);
const inputs={sizetier:'ls',weight:3.35*16,dimensions:[5,5,5],surcharge:true,category:'15',cogs:9,
  margin:0,inbound:0,placement:0,prep:0,storage:0,q4storage:0,ppc:0,returns:0,other:0,vine:false,annualUnits:500,tacos:25,lacos:60,cvr:12};
const quote=(i,p=30,d='2026-10-14')=>FBA.quote(i,p,d);
test('all 54 rows retain authoritative JSON metadata and values',()=>assert.deepEqual(FBA.CARD,JSON.parse(fs.readFileSync('rates/amazon-us-2026.json'))));
test('all 54 rate rows and three bands select the expected base plus ceiling intervals',()=>{
  const map={small_standard:'ss',large_standard:'ls',small_bulky:'sb',large_bulky:'lb'};
  for(const row of FBA.CARD.rates){
    const lb=row.tier==='small_bulky'||row.tier==='large_bulky'?7.9 : row.weight_lb_lte===null?160 : (row.weight_lb_gt+row.weight_lb_lte)/2;
    const tier=map[row.tier]||'xl';
    const dimensions=tier==='ss'?null:tier==='ls'?[2,2,1]:tier==='sb'?[20,2,2]:tier==='lb'?[38,2,2]:[60,10,2];
    for(const [band,price] of [9.99,10,50.01].entries()){
      const q=quote({sizetier:tier,weight:lb*16,dimensions},price,row.period==='peak'?'2026-10-15':'2026-10-14');
      assert.equal(q.error,null,JSON.stringify(row));
      const steps=row.increment_lb?Math.max(0,Math.ceil((lb-row.increment_above_lb)/row.increment_lb)):0;
      near(q.base,row.base_fees[band]+steps*(row.increment_usd||0));
    }
  }
});
test('Oct 14/15 select nonpeak/peak and published 3.35lb example',()=>{near(quote(inputs).base,7.13); near(quote(inputs,30,'2026-10-15').base,7.67);});
test('Jan 14 peak covered; Jan 15 new year rates unknown',()=>{assert.equal(FBA.windowFor('2027-01-14').period,'peak'); assert.equal(FBA.windowFor('2027-01-15'),null); assert.equal(FBA.season('2027-01-15'),'nonpeak');});
test('Jan 14/15 2026 boundary does not reuse prior peak prices',()=>{assert.equal(FBA.windowFor('2026-01-14'),null); assert.equal(FBA.windowFor('2026-01-15').period,'nonpeak');});
test('recurring seasons never imply future rate coverage',()=>{assert.equal(FBA.season('2028-10-15'),'peak');assert.equal(FBA.windowFor('2028-10-15'),null);});
for(const [start,end,count] of [['2026-10-14','2026-10-14',1],['2026-10-15','2026-10-15',1],['2026-10-01','2026-10-31',2],['2026-10-15','2027-01-14',1]]) test(`coverage ${start}–${end}`,()=>{const c=FBA.periodCoverage(start,end);assert.equal(c.error,null);assert.equal(c.windows.length,count);});
for(const [a,b] of [['','2026-10-31'],['2026-02-30','2026-10-31'],['2026-10-31','2026-10-01'],['2026-10-01','2027-01-15'],['2027-01-15','2027-01-15']]) test(`unknown/invalid period ${a}–${b}`,()=>assert.ok(FBA.periodCoverage(a,b).error));
test('exact $10 and $50 inclusive middle band',()=>{const i={sizetier:'ss',weight:8};[9.99,10,50,50.01].forEach((p,n)=>near(quote(i,p).base,[2.66,3.54,3.54,3.80][n]));});
test('peak price band boundaries',()=>{const i={sizetier:'ss',weight:8};[9.99,10,50,50.01].forEach((p,n)=>near(quote(i,p,'2026-10-15').base,[2.86,3.74,3.74,4][n]));});
test('3.5% applied exactly once to both base tables',()=>{for(const d of ['2026-10-14','2026-10-15']){const q=quote(inputs,30,d);near(q.total,q.base*1.035);near(q.fuel,q.base*.035);}});
test('independent fuel start date and opt-out',()=>{near(quote(inputs,30,'2026-04-16').total,7.13);near(quote(inputs,30,'2026-04-17').total,7.13*1.035);near(quote({...inputs,surcharge:false}).total,7.13);});
test('small standard uses unit weight despite higher dimensional weight',()=>{const q=quote({sizetier:'ss',weight:8,dimensions:[15,12,.75]});assert.equal(q.tier,'ss');near(q.shippingWeightLb,.5);near(q.base,3.54);});
test('large standard bills dimensional weight and does not mutate unit weight',()=>{const i={...inputs,weight:16,dimensions:[18,14,8]};const q=quote(i);near(q.shippingWeightLb,18*14*8/139);near(q.base,6.97+Math.ceil((18*14*8/139-3)/.25)*.08);assert.equal(i.weight,16);});
test('sort sides, include length plus girth and split small/large bulky',()=>{assert.equal(FBA.sizeTier([10,18,37],16),'sb');assert.equal(FBA.sizeTier([38,2,2],32),'lb');assert.equal(FBA.sizeTier([59,33,33],16),'xl');});
test('bulky two-inch minimum',()=>{const q=quote({sizetier:'lb',weight:16,dimensions:[38,10,1]});near(q.dimensionalWeightLb,38*10*2/139);});
test('small bulky published 7.9lb example',()=>{const i={sizetier:'sb',weight:7.9*16,dimensions:[24,7.5,6]};near(quote(i).base,10.21);near(quote(i,60,'2026-10-15').base,11.25);});
test('extra-large unit >150lb uses unit fee weight',()=>{const q=quote({sizetier:'xl',weight:151*16,dimensions:[90,30,30]});near(q.shippingWeightLb,151);near(q.base,194.95);});
test('extra-large correct weight brackets and increments',()=>{for(const [lb,expected] of [[50,26.33+49*.38],[51,37.32],[70,37.32+19*.75],[71,51.32],[150,51.32+79*.75]]) near(quote({sizetier:'xl',weight:lb*16,dimensions:[60,10,2]}).base,expected);});
test('missing dimensions, invalid weight/tier and overmax never guess',()=>{for(const i of [{sizetier:'ls',weight:16},{sizetier:'ss',weight:0},{sizetier:'wat',weight:16},{sizetier:'xl',weight:16,dimensions:[100,2,2]},{sizetier:'ss',weight:32}]) assert.ok(quote(i).error);});
test('reported SmallBulky and ExtraLarge tiers map correctly',()=>{assert.equal(context.amazonSizeTierToAppTier('SmallBulky'),'sb');assert.equal(context.amazonSizeTierToAppTier('UsExtraLarge'),'xl');});
test('same-day floor uses that day; crossing uses max peak floor',()=>{const non=context.salePeriodFloor(inputs,'2026-10-14','2026-10-14');const peak=context.salePeriodFloor(inputs,'2026-10-15','2026-10-15');const cross=context.salePeriodFloor(inputs,'2026-10-01','2026-10-31');near(non.floor,(9+7.13*1.035)/.85);near(peak.floor,(9+7.67*1.035)/.85);near(cross.floor,peak.floor);assert.ok(cross.floor>non.floor);});
test('whole-period fuel boundary chooses higher floor',()=>{const c=context.salePeriodFloor(inputs,'2026-04-16','2026-04-17');near(c.floor,(9+7.13*1.035)/.85);});
test('unknown future dates and missing dimensions have no floor',()=>{assert.equal(context.salePeriodFloor(inputs,'2026-10-14','2027-01-15').floor,null);assert.equal(context.salePeriodFloor({...inputs,dimensions:null},'2026-10-01','2026-10-31').floor,null);});
test('actual calculator/waterfall apply fuel once and storage stays separate',()=>{const i={...inputs,feeDate:'2026-10-15',q4storage:1};const wf=context.feeWaterfall(i,30);near(wf.segments.find(s=>s.key==='fba').amount,7.67);near(wf.segments.find(s=>s.key==='fuel').amount,7.67*.035);near(wf.net,30-9-4.5-7.67*1.035-1);near(context.calcPrices(i).ypF.fba,7.67*1.035);});
test('band discontinuity solver returns safe floor near $10 and $50',()=>{for(const cogs of [2.7,3,37,38,39,40]){const i={...inputs,sizetier:'ss',weight:8,dimensions:null,cogs,feeDate:'2026-10-15'};const p=context.solveMinPriceRaw(i);assert.ok(Number.isFinite(p));assert.ok(context.feeWaterfall(i,p).net>=-1e-7);}});
test('whole-period margin reports lowest seasonal margin',()=>near(context.salePeriodMargin(inputs,30,'2026-10-01','2026-10-31'),(30-9-4.5-7.67*1.035)/30*100));
function fixture(i=inputs){context.state.products=[{id:'fixture',name:'Sanitized test item',sku:'TEST-ONLY',asin:'TESTASIN',inputs:i,checkins:[]}];context.state.reportData.byAsin={TESTASIN:{yourPrice:30,available:500,u30:30,s30:900}};context.state.planner={startDate:'2026-10-01',endDate:'2026-10-31',overrides:{}};}
test('actual planner suggestions are whole-period safe and retain .90/5% rules',()=>{fixture();const r=context.plannerRows()[0];assert.equal(r.sug.action,'sale');assert.ok(r.sug.price>=r.breakEvenPrice);assert.ok(r.sug.price<=28.5);near(r.sug.price%1,.9);});
test('changing planner dates persists and recalculates floor',()=>{fixture();context.plannerSetDate('endDate','2026-10-14');const non=context.plannerRows()[0].breakEvenPrice;context.plannerSetDate('endDate','2026-10-15');assert.ok(context.plannerRows()[0].breakEvenPrice>non);});
test('missing costs retain floorless semantics; missing fee data blocks suggestions',()=>{fixture({...inputs,cogs:0});assert.equal(context.plannerRows()[0].breakEvenPrice,null);fixture({...inputs,dimensions:null});assert.equal(context.plannerRows()[0].sug.action,'blocked');});
test('manual under-floor override is rejected before file creation',()=>{fixture();context.state.planner.overrides.fixture={include:true,price:10};nodes['sp-start']={value:'2026-10-01'};nodes['sp-end']={value:'2026-10-31'};context.exportPriceFile();assert.match(alerts.pop(),/whole-period floor/);});
test('unknown coverage is rejected even for manual row selections',()=>{fixture();context.state.planner.overrides.fixture={include:true,price:30};nodes['sp-end'].value='2027-01-15';context.exportPriceFile();assert.match(alerts.pop(),/No verified FBA rate coverage/);});
test('blank planner date is rejected rather than replaced with today',()=>{nodes['sp-start'].value='';context.exportPriceFile();assert.match(alerts.pop(),/start date/);});
// ── PR #1 review fixes ──────────────────────────────────────────────────────
const probe={sizetier:'ss',weight:8,dimensions:null,surcharge:true,category:'15',cogs:5.20,
  margin:0,inbound:0,placement:0,prep:0,storage:0,q4storage:0,ppc:0,returns:0,other:0,vine:false,annualUnits:500,tacos:25,lacos:60,cvr:12};
test('reviewer probe: floor $9.36 but $10.00 nets −$0.36 (fee-jump hole exists)',()=>{const f=context.salePeriodFloor(probe,'2026-10-02','2026-10-14');assert.equal(+f.floor.toFixed(2),9.36);near(+context.salePeriodNet(probe,10,'2026-10-02','2026-10-14').toFixed(2),-0.36);});
test('feeJumpSafePrice steps a losing price to the next .90 ending',()=>assert.equal(context.feeJumpSafePrice(probe,10,20,'2026-10-02','2026-10-14'),10.90));
test('feeJumpSafePrice falls back to cents when the next .90 exceeds the cap',()=>{const p=context.feeJumpSafePrice(probe,10,10.50,'2026-10-02','2026-10-14');assert.equal(p,10.43);assert.ok(context.salePeriodNet(probe,p,'2026-10-02','2026-10-14')>=0);assert.ok(context.salePeriodNet(probe,10.42,'2026-10-02','2026-10-14')<0);});
test('feeJumpSafePrice returns null when nothing up to the cap is profitable',()=>assert.equal(context.feeJumpSafePrice(probe,10,10.40,'2026-10-02','2026-10-14'),null));
test('feeJumpSafePrice keeps an already-profitable price unchanged',()=>assert.equal(context.feeJumpSafePrice(probe,9.90,20,'2026-10-02','2026-10-14'),9.90));
test('fee-jump check covers every fee class: nonpeak-safe price losing in peak is stepped up',()=>{const w=['2026-10-02','2026-10-31'];const i={...probe,cogs:5.50};assert.ok(context.salePeriodNet({...i},9.90,'2026-10-02','2026-10-14')>=0);assert.ok(context.salePeriodNet(i,9.90,...w)<0);assert.ok(context.salePeriodNet(i,context.feeJumpSafePrice(i,9.90,20,...w),...w)>=0);});
function jumpFixture(cogs,yourPrice,available,threshold){context.state.products=[{id:'jump',name:'Fee jump item',sku:'JUMP-1',asin:'JUMPASIN',inputs:{...probe,cogs},checkins:[]}];context.state.reportData.byAsin={JUMPASIN:{yourPrice,available,u30:30,s30:yourPrice*30}};context.state.planner={startDate:'2026-10-02',endDate:'2026-10-14',overrides:{},coverThreshold:threshold};}
test('planner: ladder price $10.90 above a $9.94 floor loses money → stepped to $11.90',()=>{jumpFixture(5.70,13.95,500,120);const r=context.plannerRows()[0];assert.ok(r.breakEvenPrice<10);assert.equal(r.sug.action,'sale');assert.equal(r.sug.feeJumpFrom,10.90);assert.equal(r.sug.price,11.90);assert.ok(context.salePeriodNet(r.p.inputs,r.sug.price,'2026-10-02','2026-10-14')>=0);});
test('planner: no profitable price within the 5%-off cap → blocked fee_jump',()=>{jumpFixture(5.70,11.50,100,60);const r=context.plannerRows()[0];assert.equal(r.sug.action,'blocked');assert.equal(r.sug.reason,'fee_jump');});
test('export rejects a manual override that is above the floor but loses money on a date',()=>{jumpFixture(5.20,13.95,500,120);context.state.planner.overrides.jump={include:true,price:10};nodes['sp-start']={value:'2026-10-02'};nodes['sp-end']={value:'2026-10-14'};context.exportPriceFile();const msg=alerts.pop();assert.match(msg,/lose money/);assert.match(msg,/JUMP-1 @ \$10\.00/);});
test('stale saved planner dates fall back to today → default month end and are re-saved',()=>{context.state.planner={startDate:'2026-08-01',endDate:'2026-08-31',overrides:{}};const w=context.saleFeeWindow();assert.deepEqual({...w},{start:'2026-10-02',end:'2026-10-31'});assert.equal(context.state.planner.startDate,'2026-10-02');assert.equal(context.state.planner.endDate,'2026-10-31');});
test('a past saved start date is clamped to today; a future end date is kept',()=>{context.state.planner={startDate:'2026-09-20',endDate:'2026-10-20',overrides:{}};const w=context.saleFeeWindow();assert.equal(w.start,'2026-10-02');assert.equal(w.end,'2026-10-20');});
test('export never writes a past start date',()=>{fixture();context.state.planner.overrides.fixture={include:false};nodes['sp-start']={value:'2026-09-01'};nodes['sp-end']={value:'2026-10-14'};context.exportPriceFile();alerts.pop();assert.equal(context.state.planner.startDate,'2026-10-02');assert.equal(context.state.planner.endDate,'2026-10-14');});
test('FBA rate-card expiry warning starts 2026-12-15 and names 2027-01-14',()=>{assert.equal(context.fbaExpiryWarning('2026-12-14'),null);assert.equal(context.fbaExpiryWarning('2026-12-15'),'2027-01-14');assert.equal(context.fbaCoverageEnd(),'2027-01-14');});
const calInputs={...inputs,dimensions:[5,5,5],weight:3.35*16};
test('Amazon calibration (negative): engine above Amazon is pulled down to Amazon at the import price/date',()=>{const i={...calInputs,feeDate:'2026-10-01',amazonFee:{fee:7.15,price:30,date:'2026-10-01'}};const c=context.fbaCalibration(i);near(c.amount,7.15-7.13*1.035);near(context.totalFBA(i,30),7.15);});
test('Amazon calibration (positive): engine below Amazon is raised to Amazon',()=>{const i={...calInputs,feeDate:'2026-10-01',amazonFee:{fee:9.00,price:30,date:'2026-10-01'}};assert.ok(context.fbaCalibration(i).amount>0);near(context.totalFBA(i,30),9.00);});
test('Amazon calibration keeps the peak-table seasonal delta',()=>{const a={fee:7.15,price:30,date:'2026-10-01'};const non=context.totalFBA({...calInputs,feeDate:'2026-10-01',amazonFee:a},30);const peak=context.totalFBA({...calInputs,feeDate:'2026-10-15',amazonFee:a},30);near(peak-non,(7.67-7.13)*1.035);});
test('calibration folds into base so fuel stays the engine 3.5%',()=>{const i={...calInputs,feeDate:'2026-10-15',amazonFee:{fee:7.15,price:30,date:'2026-10-01'}};const wf=context.feeWaterfall(i,30);near(wf.segments.find(s=>s.key==='fuel').amount,7.67*.035);near(wf.segments.find(s=>s.key==='fba').amount+wf.segments.find(s=>s.key==='fuel').amount,context.totalFBA(i,30));});
test('no amazonFee (or uncovered import date) → engine as-is',()=>{near(context.totalFBA({...calInputs,feeDate:'2026-10-01'},30),7.13*1.035);assert.equal(context.fbaCalibration({...calInputs,amazonFee:{fee:7,price:30,date:'2025-12-01'}}),null);});
test('calibrated fees raise the whole-period floor when Amazon charges more',()=>{const base=context.salePeriodFloor(calInputs,'2026-10-02','2026-10-31').floor;const cal=context.salePeriodFloor({...calInputs,amazonFee:{fee:9,price:30,date:'2026-10-02'}},'2026-10-02','2026-10-31').floor;assert.ok(cal>base);});
test('parseAmazonFeeEstimate needs numeric fee and price ("--" ignored)',()=>{assert.deepEqual({...context.parseAmazonFeeEstimate('7.32','29.95','2026-10-02')},{fee:7.32,price:29.95,date:'2026-10-02'});assert.equal(context.parseAmazonFeeEstimate('--','29.95','2026-10-02'),null);assert.equal(context.parseAmazonFeeEstimate('7.32','','2026-10-02'),null);});
const feeCsv=['"sku","fnsku","asin","amazon-store","product-name","product-group","brand","fulfilled-by","your-price","sales-price","longest-side","median-side","shortest-side","length-and-girth","unit-of-dimension","item-package-weight","unit-of-weight","product-size-tier","currency","estimated-fee-total","estimated-referral-fee-per-unit","expected-fulfillment-fee-per-unit","expected-future-fulfillment-fee-per-unit"',
  '"TEST-A","X0","TESTASIN01","US","Synthetic A","Sports","B","Amazon","29.95","29.95","7.64","7.4","7.4","37.24","inches","3.81","pounds","UsLargeStandardSize","USD","11.81","4.49","7.32","--"',
  '"TEST-B","X1","TESTASIN02","US","Synthetic B","Sports","B","Amazon","19.99","19.99","50.8","25.4","2.54","106.68","centimeters","500","grams","UsLargeStandardSize","USD","9.00","3.00","--","8.00"'].join('\r\n');
test('Fee Preview import: real unit-of-dimension/unit-of-weight headers, dimensions and Amazon fee estimate',()=>{context.state.products=[];const ev={target:{files:[{text:feeCsv}],value:'x'}};context.importFBAFeePreview(ev);const [a,b]=context.state.products;near(a.inputs.weight,3.81*16);assert.deepEqual([...a.inputs.dimensions],[7.64,7.4,7.4]);assert.deepEqual({...a.inputs.amazonFee},{fee:7.32,price:29.95,date:'2026-10-02'});near(b.inputs.weight,500/28.349523125);near(b.inputs.dimensions[0],20);assert.equal(b.inputs.amazonFee,undefined);near(context.totalFBA({...a.inputs,feeDate:'2026-10-02'},29.95),7.32);});
test('NaN guard: missing dimensions → calcPrices.fbaError, no numeric guess',()=>{const r=context.calcPrices({...inputs,dimensions:null});assert.ok(r.fbaError);assert.ok(Number.isNaN(r.yp));assert.equal(context.calcPrices({...inputs,feeDate:'2026-10-01'}).fbaError,null);});
const s3=(i,acos)=>({lifecycle:'STAGE_3',inputs:i,stageStartDates:{STAGE_3:new Date(2026,5,1).toISOString()},checkins:[{date:new Date(2026,9,1).toISOString(),currentAcos:acos}],createdAt:new Date(2026,0,1).toISOString()});
test('K3 kill signal is skipped when break-even ACoS is unverifiable (no false kill)',()=>{assert.ok(!context.checkKillSignals(s3({...inputs,dimensions:null},5)).signals.some(x=>x.code==='K3'));assert.ok(context.checkKillSignals(s3({...inputs,margin:20},99)).signals.some(x=>x.code==='K3'));});
test('products CSV dimensions are stored only when all three are positive',()=>{assert.deepEqual([...context.csvDimensions({length_in:'10',width_in:'8',height_in:'4'})],[10,8,4]);assert.equal(context.csvDimensions({length_in:'10',width_in:'',height_in:'4'}),null);});
console.log(`${passed} shipped-code FBA regression tests passed; full inline application syntax checked.`);
