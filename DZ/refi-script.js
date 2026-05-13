
function installRefiLinkedSliders(){
  const configs = [
    {id:"currentRate", min:0.5, max:9, step:0.05, label:"Rychlá změna současné sazby", suffix:" %"},
    {id:"ownBankRate", min:1, max:10, step:0.05, label:"Rychlá změna sazby stávající banky", suffix:" %"},
    {id:"refiSameRate", min:1, max:10, step:0.05, label:"Rychlá změna sazby jiné banky", suffix:" %"},
    {id:"refiChangedRate", min:1, max:10, step:0.05, label:"Rychlá změna sazby při změně splatnosti", suffix:" %"},
    {id:"changedTermMonths", min:12, max:420, step:12, label:"Rychlá změna nové splatnosti", suffix:" měs."},
    {id:"fixMonths", min:12, max:120, step:12, label:"Rychlá změna délky fixace", suffix:" měs."},
    {id:"stressAdd", min:0, max:3, step:0.25, label:"Rychlá změna stress testu", suffix:" p. b.", optional:true},
    {id:"partialPrepay", min:0, max:2000000, step:50000, label:"Rychlá změna mimořádné splátky", money:true, optional:true},
    {id:"partialRate", min:1, max:10, step:0.05, label:"Rychlá změna sazby varianty 4", suffix:" %", optional:true}
  ];

  const format = (value, cfg) => {
    if((value === "" || value === null || value === undefined) && cfg.optional) return "nevyplněno";
    const n = Number(String(value || "").replace(",", "."));
    if(!Number.isFinite(n)) return cfg.optional ? "nevyplněno" : String(value || "");
    if(cfg.money) return money(n);
    return String(n).replace(".", ",") + (cfg.suffix || "");
  };

  const placeSlider = (input, slider) => {
    const split = input.closest(".split");
    if(split && split.parentElement){
      split.insertAdjacentElement("afterend", slider);
      return;
    }
    input.insertAdjacentElement("afterend", slider);
  };

  configs.forEach(cfg => {
    const input = el(cfg.id);
    if(!input || input.dataset.sliderInstalled === "1") return;
    input.dataset.sliderInstalled = "1";
    const rawValue = String(input.value || "").replace(",", ".");
    const current = Number(rawValue);
    const max = Number.isFinite(current) && current > cfg.max ? current : cfg.max;
    const slider = document.createElement("div");
    slider.className = "linked-range";
    slider.innerHTML = `
      <div class="linked-range-head"><span>${cfg.label}</span><output>${format(input.value, cfg)}</output></div>
      <input class="linked-range-input" type="range" min="${cfg.min}" max="${max}" step="${cfg.step}" value="${Number.isFinite(current) ? current : cfg.min}" aria-label="${cfg.label}">
      <div class="linked-range-foot"><span>${format(cfg.min, cfg)}</span><span>${format(max, cfg)}</span></div>
    `;
    placeSlider(input, slider);
    const range = slider.querySelector("input");
    const out = slider.querySelector("output");

    range.addEventListener("input", () => {
      input.value = range.value;
      out.textContent = format(input.value, cfg);
      input.dispatchEvent(new Event("input", {bubbles:true}));
      input.dispatchEvent(new Event("change", {bubbles:true}));
    });

    input.addEventListener("input", () => {
      const value = Number(String(input.value || "").replace(",", "."));
      out.textContent = format(input.value, cfg);
      if(Number.isFinite(value)){
        if(value > Number(range.max)) range.max = String(value);
        range.value = String(value);
      }
    });
  });
}


const CZK = new Intl.NumberFormat('cs-CZ', { style:'currency', currency:'CZK', maximumFractionDigits:0 });
let lastResult = null;

const ids = [
  'balance','currentPayment','remainingMonths','currentRate',
  'ownBankRate','refiSameRate','refiChangedRate','changedTermMonths',
  'fixMonths','changeCosts','income','expenses','otherDebts','minReserve',
  'cashReserve','stressAdd','partialPrepay','partialRate'
];

const requiredLabels = {
  balance: 'aktuální zůstatek hypotéky',
  currentPayment: 'současná měsíční splátka',
  remainingMonths: 'zbývající splatnost',
  ownBankRate: 'sazba stávající banky',
  refiSameRate: 'sazba jiné banky',
  refiChangedRate: 'sazba při změně splatnosti',
  changedTermMonths: 'nová splatnost varianty 3',
  fixMonths: 'délka nové fixace',
  changeCosts: 'náklady změny',
  income: 'čistý příjem domácnosti',
  expenses: 'pravidelné výdaje domácnosti',
  otherDebts: 'další měsíční splátky'
};

function el(id){ return document.getElementById(id); }
function raw(id){ const node = el(id); return node ? String(node.value ?? '').trim() : ''; }
function val(id){ const v = Number(raw(id).replace(',', '.')); return Number.isFinite(v) ? v : NaN; }
function optVal(id, fallback = 0){ const r = raw(id); if(r === '') return fallback; const v = Number(r.replace(',', '.')); return Number.isFinite(v) ? v : fallback; }
function sval(id){ const node = el(id); return node ? node.value : ''; }
function money(n){ return CZK.format(Math.round(Number(n) || 0)); }
function monthsTxt(n){ return n === null || Number.isNaN(n) ? 'nevychází' : (n === 0 ? 'ihned' : n + ' měs.'); }
function iso(d){ return d.toISOString().slice(0,10); }

function setDefaultDates(){
  const today = el('todayDate');
  const change = el('changeDate');
  const now = new Date();
  if(today && !today.value) today.value = iso(now);
  const f = new Date(now);
  f.setMonth(f.getMonth() + 6);
  if(change && !change.value) change.value = iso(f);
}

function monthsBetween(a,b){
  const d1 = new Date(a), d2 = new Date(b);
  if(isNaN(d1) || isNaN(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / (1000*60*60*24*30.4375)));
}

function pmt(P, rate, months){
  P = Math.max(0, Number(P) || 0);
  months = Math.max(1, Math.round(Number(months) || 1));
  const r = (Number(rate) || 0) / 100 / 12;
  if(r === 0) return P / months;
  return P * r / (1 - Math.pow(1 + r, -months));
}

function amort(P, rate, months, limit){
  months = Math.max(1, Math.round(Number(months) || 1));
  limit = Math.min(Math.max(1, Math.round(Number(limit || months))), months);
  const payment = pmt(P, rate, months);
  const r = (Number(rate) || 0) / 100 / 12;
  let balance = Math.max(0, Number(P) || 0), interest = 0, principalPaid = 0;

  for(let i = 0; i < limit; i++){
    const int = balance * r;
    const prin = Math.min(balance, payment - int);
    interest += int;
    principalPaid += prin;
    balance = Math.max(0, balance - prin);
    if(balance <= 0) break;
  }

  return { payment, interest, principalPaid, remaining: balance, cash: payment * limit, months: limit };
}

function activeLayer(){ return 'single'; }

function getData(){
  const d = {};
  ids.forEach(id => d[id] = val(id));
  ['balanceStatus','ownBankStatus','refiStatus','costStatus','todayDate','changeDate'].forEach(id => d[id] = sval(id));
  // normalize optional advanced fields so blank values do not skew the basic model
  d.income = optVal('income', 0);
  d.expenses = optVal('expenses', 0);
  d.otherDebts = optVal('otherDebts', 0);
  d.minReserve = optVal('minReserve', 0);
  d.cashReserve = optVal('cashReserve', 0);
  d.stressAdd = optVal('stressAdd', 0);
  d.partialPrepay = optVal('partialPrepay', 0);
  d.partialRate = optVal('partialRate', 0);
  d.monthsToChange = monthsBetween(d.todayDate, d.changeDate);
  return d;
}

function clearInputErrors(){
  document.querySelectorAll('.input-error').forEach(x => x.classList.remove('input-error'));
}

function markMissing(fieldIds){
  clearInputErrors();
  fieldIds.forEach(id => {
    const node = el(id);
    if(node) node.classList.add('input-error');
  });
}

function missing(d){
  const missingItems = [];
  const missingFields = [];

  function req(id, condition){
    if(condition){
      missingItems.push(requiredLabels[id] || id);
      missingFields.push(id);
    }
  }

  req('balance', raw('balance') === '' || !Number.isFinite(d.balance) || d.balance <= 0);
  req('currentPayment', raw('currentPayment') === '' || !Number.isFinite(d.currentPayment) || d.currentPayment <= 0);
  req('remainingMonths', raw('remainingMonths') === '' || !Number.isFinite(d.remainingMonths) || d.remainingMonths <= 0);
  req('ownBankRate', raw('ownBankRate') === '' || !Number.isFinite(d.ownBankRate) || d.ownBankRate <= 0);
  req('refiSameRate', raw('refiSameRate') === '' || !Number.isFinite(d.refiSameRate) || d.refiSameRate <= 0);
  req('refiChangedRate', raw('refiChangedRate') === '' || !Number.isFinite(d.refiChangedRate) || d.refiChangedRate <= 0);
  req('changedTermMonths', raw('changedTermMonths') === '' || !Number.isFinite(d.changedTermMonths) || d.changedTermMonths <= 0);
  req('fixMonths', raw('fixMonths') === '' || !Number.isFinite(d.fixMonths) || d.fixMonths <= 0);
  req('changeCosts', raw('changeCosts') === '' || !Number.isFinite(d.changeCosts) || d.changeCosts < 0);

  if(!d.todayDate){
    missingItems.push('datum porovnání');
    missingFields.push('todayDate');
  }

  if(!d.changeDate){
    missingItems.push('datum možné změny / refixace');
    missingFields.push('changeDate');
  }

  if(d.todayDate && d.changeDate && new Date(d.changeDate) < new Date(d.todayDate)){
    missingItems.push('datum možné změny nesmí být před datem porovnání');
    missingFields.push('changeDate');
  }


  return { items: missingItems, fields: missingFields };
}

function showMissingModal(items){
  const modal = el('missingModal');
  const list = el('missingModalList');
  if(!modal || !list) return;
  list.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  modal.hidden = false;
}

function closeMissingModal(){
  const modal = el('missingModal');
  if(modal) modal.hidden = true;
}


function updateOptionalPrepayVisibility(hasPrepay){
  const card = el('variant4InfoCard');
  const note = el('variant4OptionalNote');

  if(card){
    card.hidden = !hasPrepay;
  }

  if(note){
    note.hidden = hasPrepay;
  }
}

function variant(name, P, rate, months, fixMonths, fees, basePay, extra = {}){
  const full = amort(P, rate, months, months);
  const fix = amort(P, rate, months, Math.min(fixMonths, months));
  const delta = basePay - full.payment;
  let breakEven = null;

  if(delta > 0 && fees > 0) breakEven = Math.ceil(fees / delta);
  else if(delta > 0 && fees === 0) breakEven = 0;

  return {
    name,
    principal: P,
    rate,
    months,
    fees,
    prepay: extra.prepay || 0,
    note: extra.note || '',
    payment: full.payment,
    monthlyDelta: delta,
    fixCash: fix.cash + fees + (extra.prepayCash ? (extra.prepay || 0) : 0),
    fullCash: full.cash + fees + (extra.prepayCash ? (extra.prepay || 0) : 0),
    interestFees: full.interest + fees,
    interestOnly: full.interest,
    breakEven,
    extended: extra.extended || false
  };
}

function calculate(showModal = false){
  const d = getData();
  const miss = missing(d);
  markMissing(miss.fields);

  if(showModal && miss.items.length){
    showMissingModal(miss.items);
  }

  const commonCash = (Number.isFinite(d.currentPayment) ? d.currentPayment : 0) * d.monthsToChange;
  const currentRate = Number.isFinite(d.currentRate) && d.currentRate > 0 ? d.currentRate : d.ownBankRate;
  const commonInterest = amort(d.balance || 0, currentRate || 0, Math.max(d.remainingMonths || 1, 1), Math.max(d.monthsToChange, 1)).interest;
  const remaining = Math.max(1, (d.remainingMonths || 1) - d.monthsToChange);
  const basePay = pmt(d.balance || 0, d.ownBankRate || 0, remaining);
  const fees = Math.max(0, Number.isFinite(d.changeCosts) ? d.changeCosts : 0);

  const hasPrepay = Number.isFinite(d.partialPrepay) && d.partialPrepay > 0;

  const vars = [
    variant('1. Stávající banka / nová fixace', d.balance || 0, d.ownBankRate || 0, remaining, d.fixMonths || 1, 0, basePay, { note:'Referenční varianta' }),
    variant('2. Jiná banka / stejná splatnost', d.balance || 0, d.refiSameRate || 0, remaining, d.fixMonths || 1, fees, basePay, { note:'Refinancování bez prodloužení splatnosti' }),
    variant('3. Jiná banka / změna splatnosti', d.balance || 0, d.refiChangedRate || 0, d.changedTermMonths || remaining, d.fixMonths || 1, fees, basePay, { note:'Nižší splátka může znamenat vyšší náklad', extended:(d.changedTermMonths || remaining) > remaining })
  ];

  if(hasPrepay){
    vars.push(
      variant('4. Mimořádná splátka + nová sazba', Math.max(0, (d.balance || 0) - d.partialPrepay), d.partialRate || d.refiSameRate || 0, remaining, d.fixMonths || 1, fees, basePay, { note:'Mimořádná splátka je použití vlastních peněz, ne náklad', prepay:d.partialPrepay, prepayCash:true })
    );
  }

  updateOptionalPrepayVisibility(hasPrepay);

  const baseline = vars[0];
  vars.forEach(v => {
    v.totalToFixationFromToday = commonCash + v.fixCash;
    v.totalToEndFromToday = commonCash + v.fullCash;
    v.interestFeesFromToday = commonInterest + v.interestFees;
    v.netEffect = baseline.interestFees - v.interestFees;
  });

  const candidates = vars.slice(1);
  const best = candidates.reduce((a,b) => b.netEffect > a.netEffect ? b : a, candidates[0]);
  const lowest = vars.reduce((a,b) => b.payment < a.payment ? b : a, vars[0]);
  const confirmed = ['balanceStatus','ownBankStatus','refiStatus','costStatus'].filter(k => d[k] === 'confirmed').length;
  const quality = Math.max(0, Math.min(100, Math.round((confirmed / 4) * 60 + (miss.items.length ? 0 : 40))));

  let verdict = 'Bez silného závěru';
  let cls = 'warning';

  if(miss.items.length || quality < 70){
    verdict = 'Stop / pouze orientačně';
    cls = 'bad';
  }else if(best.netEffect > fees && best.breakEven !== null && best.breakEven <= d.fixMonths){
    verdict = 'Má smysl dál ověřit';
    cls = 'good';
  }else if(best.netEffect > 0){
    verdict = 'Slabý signál';
    cls = 'warning';
  }

  lastResult = {
    inputs: d,
    variants: vars,
    best,
    lowest,
    quality,
    missing: miss.items,
    missingFields: miss.fields,
    verdict,
    cls,
    commonCash,
    commonInterest,
    remainingAfterChange: remaining
  };

  render();
  return miss.items.length === 0;
}


function clientVariantLabel(name){
  if(name.startsWith('1.')){
    return {
      title:'Stávající banka / nová fixace',
      note:'Základní varianta pro srovnání. Ukazuje, co by se stalo, kdybyste zůstali u současné banky.'
    };
  }
  if(name.startsWith('2.')){
    return {
      title:'Jiná banka bez prodloužení splatnosti',
      note:'Čistší porovnání refinancování. Splácíte stejně dlouho, takže rozdíl nevzniká natažením úvěru.'
    };
  }
  if(name.startsWith('3.')){
    return {
      title:'Jiná banka se změnou splatnosti',
      note:'Může snížit měsíční splátku, ale často mění celkový náklad. Tady je nutná opatrnost.'
    };
  }
  if(name.startsWith('4.')){
    return {
      title:'Mimořádná splátka + nová sazba',
      note:'Modelově může vyjít dobře, ale používá vaše vlastní peníze. Je nutné hlídat rezervu.'
    };
  }
  return { title:name, note:'' };
}


function render(){
  const r = lastResult;
  if(!r) return;

  if(el('dataQualityMetric')) el('dataQualityMetric').textContent = r.quality + ' %';
  if(el('bestEffect')) el('bestEffect').textContent = money(r.best.netEffect);
  if(el('bestEffectHint')) el('bestEffectHint').textContent = r.best.name;
  if(el('lowestPayment')) el('lowestPayment').textContent = money(r.lowest.payment);
  if(el('lowestPaymentHint')) el('lowestPaymentHint').textContent = r.lowest.extended ? 'Nejnižší splátka vzniká prodloužením splatnosti.' : r.lowest.name;
  if(el('toolVerdict')) el('toolVerdict').textContent = r.verdict;

  const stop = el('stopBox');
  if(stop){
    if(r.missing.length){
      stop.hidden = false;
      stop.innerHTML = '<strong>Stop pravidlo:</strong> Silný závěr není poctivý. Chybí: ' + r.missing.join(', ') + '.';
    }else{
      stop.hidden = true;
    }
  }

  const tbody = document.querySelector('#resultsTable tbody');
  if(tbody){
    tbody.innerHTML = '';
    r.variants.forEach(v => {
      const cls = v.netEffect > 0 ? 'good' : v.netEffect < 0 ? 'bad' : 'muted';
      const isBest = r.best && v.name === r.best.name;
      const isLowest = r.lowest && v.name === r.lowest.name;
      const isBaseline = v.name.startsWith('1.');
      const effectText = isBaseline ? 'referenční varianta' : (v.netEffect >= 0 ? '+' + money(v.netEffect) + ' výhoda' : money(v.netEffect) + ' nevýhoda');
      const breakEvenText = isBaseline ? 'neřeší se' : monthsTxt(v.breakEven);
      const rowLabel = clientVariantLabel(v.name);
      const badges = [
        isBest ? '<span class="row-badge best">modelově nejlepší</span>' : '',
        isLowest && !isBest ? '<span class="row-badge low">nejnižší splátka</span>' : '',
        v.extended ? '<span class="row-badge warn">mění splatnost</span>' : ''
      ].join('');
      const tr = document.createElement('tr');
      tr.className = [
        isBest ? 'best-row' : '',
        v.extended ? 'extended-row' : '',
        isBaseline ? 'baseline-row' : ''
      ].join(' ').trim();
      tr.innerHTML = `<td><strong>${rowLabel.title}</strong>${badges}<br><span class="muted">${rowLabel.note}</span></td>
        <td><strong>${money(v.payment)}</strong></td>
        <td><span class="${v.monthlyDelta >= 0 ? 'good' : 'bad'}">${v.monthlyDelta >= 0 ? '+' : ''}${money(v.monthlyDelta)} měsíčně</span></td>
        <td>${money(v.totalToFixationFromToday)}</td>
        <td>${money(v.totalToEndFromToday)}</td>
        <td>${money(v.interestFeesFromToday)}</td>
        <td><span class="${cls}">${effectText}</span></td>
        <td>${breakEvenText}</td>`;
      tbody.appendChild(tr);
    });
  }

  renderRecommendation();
  renderStress();
  renderReport();
}

function renderRecommendation(){
  const r = lastResult, d = r.inputs;
  const badge = el('recommendationBadge');
  const text = el('recommendationText');
  const summary = el('recommendationSummary');
  const why = el('recommendWhy');
  const watch = el('recommendWatch');
  const next = el('recommendNext');

  if(!badge || !text || !why || !watch || !next) return;

  why.innerHTML = '';
  watch.innerHTML = '';
  next.innerHTML = '';

  const setSummary = (headline, body) => {
    if(summary){
      summary.innerHTML = '<strong>' + headline + '</strong><span>' + body + '</span>';
    }
  };

  const add = (target, msg) => {
    if(!target || !msg) return;
    const normalized = msg.trim().replace(/\s+/g, ' ');
    const existing = Array.from(target.querySelectorAll('li')).map(li => li.textContent.trim().replace(/\s+/g, ' '));
    if(existing.includes(normalized)) return;
    const li = document.createElement('li');
    li.textContent = msg;
    target.appendChild(li);
  };

  if(r.missing.length){
    badge.textContent = 'Neúplná data';
    text.textContent = 'Zatím nejde poctivě říct, která varianta je nejlepší. Některé údaje chybí, takže by výsledek mohl být zavádějící.';
    setSummary(
      'Nejdřív doplnit chybějící údaje',
      'Bez nich by závěr mohl vypadat přesněji, než ve skutečnosti je. Nástroj proto záměrně nevydává silné doporučení.'
    );
    r.missing.forEach(m => add(watch, 'Doplnit: ' + m + '.'));
    add(next, 'Doplňte chybějící údaje a spusťte výpočet znovu.');
    add(next, 'Teprve potom má smysl porovnávat varianty.');
    return;
  }

  const best = r.best;
  const bestName = best.name;
  const positive = best.netEffect > 0;
  const be = best.breakEven === null ? 'bod zvratu podle zadaných údajů nevychází' : monthsTxt(best.breakEven);
  const bestEffect = (best.netEffect >= 0 ? '+' : '') + money(best.netEffect);

  if(!positive){
    badge.textContent = 'Změna zatím nevychází jasně';
    text.textContent = 'Model zatím neukazuje dostatečně silný finanční důvod pro změnu banky nebo podmínek.';
    setSummary(
      'Zatím bych nespěchal se změnou',
      'Podle zadaných čísel není vidět jasná modelová výhoda. Nejdřív bych ověřil skutečné náklady změny a zkusil vyjednat lepší nabídku u stávající banky.'
    );
    add(why, 'Nejlepší porovnávaná varianta nemá kladnou výhodu proti stávající bance.');
    add(watch, 'Může jít o situaci, kdy náklady změny převáží přínos nižší sazby.');
    add(next, 'Ověřte přesné náklady změny a zkuste vyjednat lepší nabídku u stávající banky.');
    return;
  }

  if(bestName.includes('Mimořádná')){
    badge.textContent = 'Modelově nejlepší, ale používá rezervu';
    text.textContent = 'Podle modelu vychází nejlépe mimořádná splátka kombinovaná s novou sazbou. To může dávat smysl, ale jen pokud po použití vlastních peněz zůstane domácnosti bezpečná rezerva.';
    setSummary(
      'Nejde jen o levnější hypotéku. Část výsledku vzniká použitím vlastních peněz.',
      'Pokud máte dostatečnou rezervu i po mimořádné splátce, stojí tato varianta za ověření. Pokud by vám rezerva klesla moc nízko, je bezpečnější porovnat hlavně stávající banku a refinancování bez prodloužení splatnosti.'
    );
    add(why, 'Modelová výhoda proti stávající bance je ' + bestEffect + '.');
    add(why, 'Náklady změny se podle modelu začnou vracet přibližně za ' + be + '.');
    add(why, 'Nová měsíční splátka by byla ' + money(best.payment) + '.');
    add(watch, 'Výhoda nevzniká jen lepší sazbou, ale i tím, že do úvěru vložíte vlastní peníze.');
    add(watch, 'Po mimořádné splátce musí zůstat rezerva na běžný život a nečekané výdaje.');
    add(watch, 'Pokud je mimořádná splátka příliš vysoká vůči vaší rezervě, varianta může být riziková i přes dobrý modelový výsledek.');
    add(next, 'Ověřte, kolik rezervy vám zůstane po mimořádné splátce.');
    add(next, 'Současně si nechte potvrdit sazbu, náklady změny a podmínky banky.');
    add(next, 'Pošlete mi výsledek a zkontroluji praktickou průchodnost varianty.');
  }else if(bestName.includes('stejná')){
    badge.textContent = 'Nejčistší úspora';
    text.textContent = 'Nejlépe vychází refinancování do jiné banky při stejné zbývající splatnosti. To je silnější signál než pouhé snížení splátky prodloužením úvěru.';
    setSummary(
      'Tohle je nejčistší pozitivní signál.',
      'Výhoda nevzniká natažením úvěru na delší dobu. Pokud se potvrdí sazba a náklady změny, tuto variantu bych řešil jako první.'
    );
    add(why, 'Modelová výhoda proti stávající bance je ' + bestEffect + '.');
    add(why, 'Splatnost se neprodlužuje, takže porovnání je čistší.');
    add(why, 'Bod zvratu vychází přibližně za ' + be + '.');
    add(watch, 'Je nutné potvrdit skutečné náklady změny.');
    add(watch, 'Sazba jiné banky musí být reálně dostupná pro vaši situaci.');
    add(watch, 'Pokud banka přidá další podmínky nebo poplatky, výsledek se může změnit.');
    add(next, 'Pošlete mi výsledek a zkontroluji, jestli čísla dávají smysl v praxi.');
    add(next, 'Dává smysl ověřit, zda současná banka nabídku dorovná, nebo jestli má změna banky reálný přínos.');
  }else if(bestName.includes('změna')){
    badge.textContent = 'Lepší měsíční rozpočet, nutná kontrola celku';
    text.textContent = 'Nejlépe vychází varianta se změnou splatnosti. To může pomoci měsíčnímu rozpočtu, ale nemusí to být nejlevnější řešení za celou dobu úvěru.';
    setSummary(
      'Měsíčně to může vypadat dobře, ale hlídejte celkovou cenu.',
      'Tato varianta je vhodná hlavně tehdy, když potřebujete snížit měsíční zatížení. Pokud je cílem nejnižší celkové přeplacení, je potřeba ji porovnat velmi opatrně.'
    );
    add(why, 'Měsíční splátka klesá výrazněji než u ostatních variant.');
    add(why, 'Modelová výhoda proti stávající bance je ' + bestEffect + '.');
    add(watch, 'Nižší splátka může vzniknout hlavně prodloužením splatnosti.');
    add(watch, 'Vždy kontrolujte částku „Zaplatíte celkem do konce úvěru“.');
    add(watch, 'Nižší měsíční splátka sama o sobě neznamená skutečnou úsporu.');
    add(next, 'Použijte tuto variantu hlavně tehdy, pokud je prioritou měsíční rozpočet.');
    add(next, 'Nechte si vysvětlit rozdíl mezi měsíční úlevou a celkovým přeplacením.');
  }else{
    badge.textContent = 'Spíše vyjednat stávající banku';
    text.textContent = 'Podle zadaných údajů zatím dává největší smysl řešit nabídku u stávající banky a změnu banky nepovažovat za automaticky výhodnou.';
    setSummary(
      'Změna zatím nevypadá jako jasná výhra.',
      'Než řešit převod jinam, dává smysl vyjednat lepší nabídku u stávající banky a ověřit přesné náklady změny.'
    );
    add(why, 'Změna banky zatím nepřináší dostatečně jasný rozdíl.');
    add(watch, 'Finální výsledek se může změnit po potvrzení nákladů a sazeb.');
    add(next, 'Nejdřív zkuste vyjednat lepší nabídku u stávající banky.');
  }

  if(d.costStatus !== 'confirmed'){
    add(watch, 'Náklady změny jsou zatím odhad. Před rozhodnutím je potřeba je potvrdit.');
  }

  if(d.refiStatus !== 'confirmed' || d.ownBankStatus !== 'confirmed'){
    add(watch, 'Některé sazby jsou označené jako odhad. Po potvrzení bankou se výsledek může změnit.');
  }

  if(raw('income') === '' || raw('expenses') === '' || raw('otherDebts') === ''){
    add(watch, 'Rozpočet domácnosti není vyplněný. Tabulka porovnává hypotéku, ale sama neříká, jestli je splátka bezpečná pro váš měsíční rozpočet.');
    add(next, 'Pro posouzení bezpečnosti doplňte příjem, výdaje a další splátky domácnosti.');
  }
}

function renderStress(){
  const r = lastResult, d = r.inputs;
  const hasBudgetData = raw('income') !== '' && raw('expenses') !== '' && raw('otherDebts') !== '';
  const hasAnyBudgetData = raw('income') !== '' || raw('expenses') !== '' || raw('otherDebts') !== '' || raw('minReserve') !== '';
  const hasStress = raw('stressAdd') !== '';

  const pay = r.best.payment;
  const reserve = (d.income || 0) - (d.expenses || 0) - (d.otherDebts || 0) - pay;
  const load = d.income ? ((pay + (d.otherDebts || 0)) / d.income * 100) : 0;
  const stress = hasStress ? pmt(r.best.principal, r.best.rate + (d.stressAdd || 0), r.best.months) : null;

  el('reserveAfter').textContent = hasBudgetData ? money(reserve) : 'chybí data';
  el('debtLoad').textContent = hasBudgetData ? load.toFixed(1) + ' %' : 'chybí data';
  el('stressPayment').textContent = hasStress ? money(stress) : 'chybí data';

  let text = 'chybí data';
  if(hasBudgetData){
    text = (reserve >= (d.minReserve || 0) && load < 40) ? 'působí udržitelně' : reserve >= 0 ? 'hraniční' : 'rizikové';
  }else if(hasAnyBudgetData){
    text = 'doplňte příjem, výdaje a splátky';
  }

  el('sustainability').textContent = text;
}

function safeNumber(n){
  return Number.isFinite(Number(n)) ? Number(n) : null;
}

function line(label, value){
  const clean = (value === null || value === undefined || value === '') ? 'neuvedeno' : value;
  return String(label).replace(/\s+/g,' ').trim().padEnd(42, ' ') + ': ' + clean;
}

function buildFullDataPackage(){
  if(!lastResult){
    return {
      text: 'Kalkulace zatím nebyla spuštěna.',
      json: JSON.stringify({ error:'Kalkulace zatím nebyla spuštěna.' }, null, 2)
    };
  }

  const r = lastResult;
  const d = r.inputs;
  const activeLayerName = activeLayer();

  const variants = r.variants.map(v => ({
    varianta: v.name,
    sazba_pct: safeNumber(v.rate),
    jistina_kc: Math.round(v.principal || 0),
    splatnost_mesicu: Math.round(v.months || 0),
    nova_mesicni_splatka_kc: Math.round(v.payment || 0),
    zmena_mesicniho_cashflow_kc: Math.round(v.monthlyDelta || 0),
    platby_do_konce_fixace_kc: Math.round(v.totalToFixationFromToday || 0),
    platby_do_konce_uveru_kc: Math.round(v.totalToEndFromToday || 0),
    urok_plus_naklady_kc: Math.round(v.interestFeesFromToday || 0),
    cisty_efekt_vs_stavajici_banka_kc: Math.round(v.netEffect || 0),
    bod_zvratu_mesice: v.breakEven,
    poznamka: v.note || ''
  }));

  const best = r.best ? {
    varianta: r.best.name,
    nova_mesicni_splatka_kc: Math.round(r.best.payment || 0),
    cisty_efekt_kc: Math.round(r.best.netEffect || 0),
    bod_zvratu_mesice: r.best.breakEven
  } : null;

  const reserveAfter = d.income ? Math.round((d.income || 0) - (d.expenses || 0) - (d.otherDebts || 0) - (r.best?.payment || 0)) : null;
  const debtLoadPct = d.income ? Number((((r.best?.payment || 0) + (d.otherDebts || 0)) / d.income * 100).toFixed(1)) : null;
  const stressPayment = r.best ? Math.round(pmt(r.best.principal, r.best.rate + (d.stressAdd || 0), r.best.months)) : null;

  const packageObject = {
    typ: 'RefiCheck – kalkulace refinancování hypotéky',
    datum_odeslani: new Date().toISOString(),
    url_stranky: window.location.href,
    aktivni_vrstva: activeLayerName,
    zaver_nastroje: r.verdict,
    kvalita_dat_pct: r.quality,
    doporucena_varianta: best,
    chybejici_udaje: r.missing || [],
    pokrocila_vrstva_vyplnena: raw('income') !== '' || raw('expenses') !== '' || raw('otherDebts') !== '' || raw('partialPrepay') !== '',
    vstupy: {
      aktualni_zustatek_kc: safeNumber(d.balance),
      aktualni_zustatek_stav: d.balanceStatus,
      soucasna_mesicni_splatka_kc: safeNumber(d.currentPayment),
      zbyvajici_splatnost_mesicu: safeNumber(d.remainingMonths),
      soucasna_sazba_pct: safeNumber(d.currentRate),
      datum_porovnani: d.todayDate,
      datum_mozne_zmeny: d.changeDate,
      mesicu_do_zmeny: safeNumber(d.monthsToChange),
      sazba_stavajici_banka_pct: safeNumber(d.ownBankRate),
      sazba_stavajici_banka_stav: d.ownBankStatus,
      sazba_jina_banka_stejna_splatnost_pct: safeNumber(d.refiSameRate),
      sazba_jina_banka_stav: d.refiStatus,
      sazba_jina_banka_zmena_splatnosti_pct: safeNumber(d.refiChangedRate),
      nova_splatnost_varianta_3_mesicu: safeNumber(d.changedTermMonths),
      delka_fixace_mesicu: safeNumber(d.fixMonths),
      naklady_zmeny_kc: safeNumber(d.changeCosts),
      naklady_zmeny_stav: d.costStatus,
      cisty_prijem_domacnosti_kc: safeNumber(d.income),
      pravidelne_vydaje_kc: safeNumber(d.expenses),
      dalsi_mesicni_splatky_kc: safeNumber(d.otherDebts),
      minimalni_rezerva_po_splatce_kc: safeNumber(d.minReserve),
      financni_rezerva_domacnosti_kc: safeNumber(d.cashReserve),
      stress_test_prirazka_pct_bodu: safeNumber(d.stressAdd),
      mimoradna_splatka_kc: safeNumber(d.partialPrepay),
      sazba_po_mimoradne_splatce_pct: safeNumber(d.partialRate)
    },
    vysledky_variant: variants,
    stress_test: {
      rezerva_po_splatce_kc: reserveAfter,
      splatkove_zatizeni_pct: debtLoadPct,
      stress_splatka_kc: stressPayment,
      slovni_udrzitelnost: el('sustainability') ? el('sustainability').textContent : null
    },
    upozorneni: [
      'Výsledek je orientační model.',
      'Nejde o schválení úvěru ani závazné doporučení.',
      'Náklady změny, sazby a procesní podmínky je nutné ověřit u banky nebo poradce.',
      'Nižší měsíční splátka automaticky neznamená skutečnou úsporu.'
    ]
  };

  const lines = [];
  lines.push('KOMPLETNÍ BALÍČEK DAT Z KALKULAČKY REFINANCOVÁNÍ HYPOTÉKY');
  lines.push('==========================================================');
  lines.push('');
  lines.push(line('Typ', packageObject.typ));
  lines.push(line('Datum odeslání', packageObject.datum_odeslani));
  lines.push(line('URL stránky', packageObject.url_stranky));
  lines.push(line('Aktivní vrstva', packageObject.aktivni_vrstva));
  lines.push(line('Závěr nástroje', packageObject.zaver_nastroje));
  lines.push(line('Kvalita dat', packageObject.kvalita_dat_pct + ' %'));
  lines.push('');

  lines.push('DOPORUČENÁ / NEJVÝRAZNĚJŠÍ VARIANTA');
  lines.push('-----------------------------------');
  if(best){
    lines.push(line('Varianta', best.varianta));
    lines.push(line('Nová měsíční splátka', money(best.nova_mesicni_splatka_kc)));
    lines.push(line('Modelová výhoda / nevýhoda', money(best.cisty_efekt_kc)));
    lines.push(line('Bod zvratu', monthsTxt(best.bod_zvratu_mesice)));
  }else{
    lines.push('neuvedeno');
  }
  lines.push('');

  const inputLabels = {
    balance: 'Aktuální zůstatek hypotéky',
    currentPayment: 'Současná měsíční splátka',
    remainingMonths: 'Zbývající splatnost',
    currentRate: 'Současná sazba do změny',
    todayDate: 'Datum porovnání',
    changeDate: 'Datum možné změny',
    ownBankRate: 'Sazba stávající banky',
    refiSameRate: 'Sazba jiné banky při stejné splatnosti',
    refiChangedRate: 'Sazba jiné banky při změně splatnosti',
    changedTermMonths: 'Nová splatnost varianty 3',
    fixMonths: 'Délka nové fixace',
    changeCosts: 'Náklady změny',
    income: 'Čistý příjem domácnosti',
    expenses: 'Pravidelné výdaje domácnosti',
    otherDebts: 'Další měsíční splátky',
    minReserve: 'Minimální požadovaná rezerva',
    cashReserve: 'Současná hotovostní rezerva',
    stressAdd: 'Stress test – přirážka k sazbě',
    partialPrepay: 'Mimořádná splátka',
    partialRate: 'Sazba po mimořádné splátce',
    balanceStatus: 'Přesnost zůstatku hypotéky',
    ownBankStatus: 'Přesnost nabídky stávající banky',
    refiStatus: 'Přesnost nabídky jiné banky',
    costStatus: 'Přesnost nákladů změny'
  };

  lines.push('VSTUPY KLIENTA');
  lines.push('--------------');
  Object.entries(packageObject.vstupy).forEach(([k,v]) => {
    lines.push(line(inputLabels[k] || k, v));
  });
  lines.push('');

  lines.push('VÝSLEDKY VARIANT');
  lines.push('----------------');
  variants.forEach(v => {
    lines.push('');
    lines.push(v.varianta);
    lines.push(line('Sazba', v.sazba_pct !== null ? v.sazba_pct + ' %' : null));
    lines.push(line('Jistina', money(v.jistina_kc)));
    lines.push(line('Splatnost', v.splatnost_mesicu + ' měsíců'));
    lines.push(line('Nová měsíční splátka', money(v.nova_mesicni_splatka_kc)));
    lines.push(line('Rozdíl v měsíčním rozpočtu', money(v.zmena_mesicniho_cashflow_kc)));
    lines.push(line('Platby do konce fixace', money(v.platby_do_konce_fixace_kc)));
    lines.push(line('Platby do konce úvěru', money(v.platby_do_konce_uveru_kc)));
    lines.push(line('Úrok + náklady', money(v.urok_plus_naklady_kc)));
    lines.push(line('Modelová výhoda / nevýhoda vs. stávající banka', money(v.cisty_efekt_vs_stavajici_banka_kc)));
    lines.push(line('Bod zvratu', monthsTxt(v.bod_zvratu_mesice)));
    lines.push(line('Poznámka', v.poznamka));
  });
  lines.push('');

  lines.push('STRESS TEST A UDRŽITELNOST');
  lines.push('--------------------------');
  lines.push(line('Rezerva po splátce', reserveAfter !== null ? money(reserveAfter) : null));
  lines.push(line('Splátkové zatížení', debtLoadPct !== null ? debtLoadPct + ' %' : null));
  lines.push(line('Stress splátka', stressPayment !== null ? money(stressPayment) : null));
  lines.push(line('Slovní udržitelnost', packageObject.stress_test.slovni_udrzitelnost));
  lines.push('');

  lines.push('CHYBĚJÍCÍ ÚDAJE / STOP PRAVIDLA');
  lines.push('-------------------------------');
  if(packageObject.chybejici_udaje.length){
    packageObject.chybejici_udaje.forEach(x => lines.push('- ' + x));
  }else{
    lines.push('Základní stop pravidla jsou splněná. Procesní a bankovní podmínky je stále nutné ověřit.');
  }
  lines.push('');

  lines.push('UPOZORNĚNÍ');
  lines.push('----------');
  packageObject.upozorneni.forEach(x => lines.push('- ' + x));

  return {
    text: lines.join('\n'),
    json: JSON.stringify(packageObject, null, 2)
  };
}

function normalizePackageText(text){
  return String(text || '').replace(/\\n/g, '\n');
}

function renderReport(){
  const packageData = buildFullDataPackage();

  const preview = el('calculationPreview');
  const field = el('calculationDataField');
  const fullField = el('fullDataPackageField');
  const jsonField = el('calculationJsonField');
  const recommended = el('recommendedVariantField');

  if(preview) preview.textContent = normalizePackageText(packageData.text);
  if(field) field.value = normalizePackageText(packageData.text);
  if(fullField) fullField.value = normalizePackageText(packageData.text);
  if(jsonField) jsonField.value = packageData.json;

  if(recommended && lastResult && lastResult.best){
    recommended.value = lastResult.best.name;
  }
}

function setLayer(layerName){
  document.querySelectorAll('.advanced-block').forEach(block => {
    block.style.display = '';
  });
  calculate(false);
}

function initCalculator(){
  setDefaultDates();
  installRefiLinkedSliders();
const recalculate = el('recalculate');
  if(recalculate){
    recalculate.addEventListener('click', () => calculate(true));
  }

  const reset = el('resetExample');
  if(reset){
    reset.addEventListener('click', () => location.reload());
  }

    const form = el('refiContactForm');
  if(form){
    form.addEventListener('submit', event => {
      const ok = calculate(true);
      renderReport();
      if(!ok){
        event.preventDefault();
      }
    });
  }

  const modalClose = el('missingModalClose');
  const modalOk = el('missingModalOk');
  const modal = el('missingModal');

  if(modalClose) modalClose.addEventListener('click', closeMissingModal);
  if(modalOk) modalOk.addEventListener('click', closeMissingModal);
  if(modal){
    modal.addEventListener('click', event => {
      if(event.target === modal) closeMissingModal();
    });
  }

  ids.concat(['balanceStatus','ownBankStatus','refiStatus','costStatus','todayDate','changeDate']).forEach(id => {
    const node = el(id);
    if(node){
      node.addEventListener('input', () => {
        if(lastResult) calculate(false);
      });
      node.addEventListener('change', () => {
        if(lastResult) calculate(false);
      });
    }
  });

  calculate(false);
}


function initFloatingTooltips(){
  const tooltip = document.createElement('div');
  tooltip.className = 'floating-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let active = null;

  function positionTooltip(trigger){
    const text = trigger.getAttribute('data-tooltip') || trigger.getAttribute('aria-label') || '';
    if(!text) return;

    tooltip.textContent = text;
    tooltip.hidden = false;

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const maxWidth = Math.min(420, window.innerWidth - 24);
    tooltip.style.maxWidth = maxWidth + 'px';

    const tt = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tt.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tt.width - margin));

    let top = rect.top - tt.height - 12;
    if(top < margin){
      top = rect.bottom + 12;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function show(trigger){
    active = trigger;
    positionTooltip(trigger);
  }

  function hide(){
    active = null;
    tooltip.hidden = true;
  }

  document.querySelectorAll('.info-tip').forEach(tip => {
    tip.addEventListener('mouseenter', () => show(tip));
    tip.addEventListener('focus', () => show(tip));
    tip.addEventListener('mouseleave', hide);
    tip.addEventListener('blur', hide);
    tip.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if(active === tip && !tooltip.hidden) hide();
      else show(tip);
    });
  });

  window.addEventListener('scroll', () => {
    if(active && !tooltip.hidden) positionTooltip(active);
  }, { passive:true });

  window.addEventListener('resize', () => {
    if(active && !tooltip.hidden) positionTooltip(active);
  });

  document.addEventListener('click', event => {
    if(!event.target.closest('.info-tip')) hide();
  });
}

function initHeaderMenu(){
  const header = document.querySelector('.header');
  const toggle = document.querySelector('.menu-toggle');
  if(!header || !toggle) return;

  toggle.addEventListener('click', function(){
    const isOpen = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', function(event){
    if(!header.contains(event.target)){
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded','false');
    }
  });

  document.querySelectorAll('.main-nav a').forEach(function(link){
    link.addEventListener('click', function(){
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded','false');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeaderMenu();
  initCalculator();
  initFloatingTooltips();
});
