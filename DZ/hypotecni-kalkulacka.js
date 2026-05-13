(function(){
  const CZK = new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0});
  const number = (id) => Math.max(0, Number((document.getElementById(id)?.value || '').toString().replace(',', '.')) || 0);
  const value = (id) => document.getElementById(id)?.value || '';
  const setText = (id, text) => { const el=document.getElementById(id); if(el) el.textContent=text; };
  const show = (id, visible=true) => { const el=document.getElementById(id); if(el) el.classList.toggle('calc-hidden', !visible); };
  const money = (n) => CZK.format(Math.max(0, Math.round(n || 0)));
  const pct = (n) => (Number.isFinite(n) ? Math.round(n) : 0) + ' %';
  const DEFAULT_RATE = 5.29;
  const fmtRate = (n) => (Number.isFinite(n) ? n.toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—') + ' %';
  const diffText = (n) => { const rounded=Math.round(n||0); if(!rounded) return '0 Kč'; return (rounded>0?'+':'−') + money(Math.abs(rounded)); };

  let mortgageLevel = 'basic';
  let mortgageCalculated = false;

  function payment(loan, rate, years){
    loan = Math.max(0, loan||0); years = Math.max(1, years||30); rate = Math.max(0, rate||DEFAULT_RATE)/100/12;
    const months = years*12;
    if(!loan) return 0;
    if(!rate) return loan/months;
    return loan*rate/(1-Math.pow(1+rate,-months));
  }

  function targetLtv(){
    const purpose=value('m-purpose');
    const age=number('m-age');
    const useType=value('m-use-type');
    if(useType==='rent') return 70;
    if(['construction','renovation','purchase_renovation','settlement','other_housing'].includes(purpose)) return 80;
    if(age>0 && age<36) return 90;
    return 80;
  }

  function payoffDebtBalance(){
    let sum=0;
    document.querySelectorAll('[data-debt-row]').forEach(row=>{
      const balance=Number(row.querySelector('[data-debt-balance]')?.value||0);
      const source=row.querySelector('[data-debt-source]')?.value;
      if(source==='mortgage_refinance' || source==='consolidation') sum += Math.max(0,balance);
    });
    return sum;
  }

  function payoffMonthlyRelief(){
    let sum=0;
    document.querySelectorAll('[data-debt-row]').forEach(row=>{
      const monthly=Number(row.querySelector('[data-debt-payment]')?.value||0);
      const certainty=row.querySelector('[data-debt-certainty]')?.value;
      if(certainty==='sure') sum += Math.max(0,monthly);
    });
    return sum;
  }

  function precision(){
    if(!mortgageCalculated) return {score:null,label:'Nejdřív spočítáme základní odhad'};
    const basic=[number('m-price')>0, number('m-own')>=0, number('m-income')>0, number('m-years')>0, number('m-age')>0, !!value('m-purpose')].filter(Boolean).length;
    const extended=[value('m-has-debts')!=='', value('m-payoff')!=='', number('m-adults')>0, !!value('m-income-type'), value('m-valuation-known')==='yes'?number('m-valuation')>0:value('m-valuation-known')!=='', value('m-collateral')!=='', value('m-applicants')==='two'?number('m-income-second')>0:true].filter(Boolean).length;
    const advanced=[!!value('m-case-type'), !!value('m-employment-length'), !!value('m-drawdown'), !!value('m-own-source'), value('m-repayment-problems')!==''||value('m-execution')!==''||value('m-overdue')!=='', !!value('m-fixation'), number('m-preferred-payment')>0||number('m-requested-loan')>0].filter(Boolean).length;
    if(mortgageLevel==='basic') return {score:Math.min(45,35+Math.round(basic/6*10)),label:'Základní odhad'};
    if(mortgageLevel==='extended') return {score:Math.min(70,55+Math.round(extended/7*15)),label:'Zpřesněný odhad'};
    return {score:Math.min(90,75+Math.round(advanced/7*15)),label:'Detailní orientační odhad'};
  }

  function updateRateScenarios(loan, baseRate, years, basePayment){
    const rows = [
      { suffix:'base', rate:baseRate, diff:0 },
      { suffix:'up1', rate:baseRate+1, diff:1 },
      { suffix:'up2', rate:baseRate+2, diff:2 },
      { suffix:'down05', rate:Math.max(0, baseRate-0.5), diff:-0.5 },
      { suffix:'down1', rate:Math.max(0, baseRate-1), diff:-1 },
    ];
    rows.forEach(item=>{
      const scenarioPayment = payment(loan, item.rate, years);
      setText('scenario-'+item.suffix+'-rate', item.suffix==='base' ? fmtRate(item.rate) : fmtRate(item.rate) + ' (' + (item.diff>0?'+':'') + item.diff.toString().replace('.', ',') + ' %)');
      setText('scenario-'+item.suffix+'-payment', money(scenarioPayment));
      if(item.suffix !== 'base') setText('scenario-'+item.suffix+'-diff', diffText(scenarioPayment - basePayment));
    });
    const fixation = value('m-fixation');
    const note = document.getElementById('fixation-note');
    if(note) note.classList.toggle('calc-hidden', !fixation);
  }


  function setList(id, items){
    const list = document.getElementById(id);
    if(!list) return;
    list.innerHTML = '';
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function collectMortgageInputs(){
    const labelMap = {
      'm-purpose':'Účel financování',
      'm-price':'Cena / částka k řešení',
      'm-own':'Vlastní peníze',
      'm-income':'Čistý měsíční příjem domácnosti',
      'm-years':'Doba splácení',
      'm-age':'Věk hlavního žadatele',
      'm-rate':'Zadaná úroková sazba',
      'm-purchase-price':'Kupní cena nemovitosti',
      'm-use-type':'Využití nemovitosti',
      'm-land-owned':'Pozemek je již vlastněn',
      'm-land-value':'Hodnota pozemku',
      'm-construction-budget':'Rozpočet výstavby',
      'm-future-value':'Očekávaná hodnota po dokončení',
      'm-construction-reserve':'Rezerva na výstavbu',
      'm-build-stages':'Počet čerpání / etap',
      'm-build-completion':'Plánované dokončení',
      'm-current-property-value':'Současná hodnota nemovitosti',
      'm-renovation-budget':'Rozpočet rekonstrukce',
      'm-after-renovation-value':'Hodnota po rekonstrukci',
      'm-renovation-reserve':'Rezerva na rekonstrukci',
      'm-renovation-drawdown':'Čerpání rekonstrukce',
      'm-pr-purchase-price':'Kupní cena',
      'm-pr-renovation-budget':'Rozpočet rekonstrukce',
      'm-pr-after-value':'Hodnota po rekonstrukci',
      'm-pr-reserve':'Rezerva na rekonstrukci',
      'm-pr-drawdown':'Čerpání rekonstrukce',
      'm-settlement-type':'Typ vypořádání',
      'm-settlement-property-value':'Hodnota vypořádávané nemovitosti',
      'm-payout-amount':'Částka k vyplacení',
      'm-current-share':'Současný vlastnický podíl',
      'm-final-share':'Vlastnický podíl po vypořádání',
      'm-existing-mortgage':'Existující hypotéka na nemovitosti',
      'm-existing-mortgage-balance':'Zůstatek existující hypotéky',
      'm-current-debtor':'Současný dlužník',
      'm-other-housing-description':'Popis jiné situace',
      'm-other-needed-amount':'Potřebná částka',
      'm-other-collateral-value':'Hodnota zajištění',
      'm-adults':'Počet dospělých v domácnosti',
      'm-children':'Počet dětí v domácnosti',
      'm-marital':'Rodinný stav',
      'm-applicants':'Počet žadatelů',
      'm-income-second':'Příjem druhého žadatele',
      'm-age-second':'Věk druhého žadatele',
      'm-has-debts':'Máte další závazky',
      'm-other-payments':'Měsíční splátky ostatních závazků',
      'm-other-balance':'Zůstatek ostatních závazků',
      'm-cards':'Kreditní karty / kontokorenty',
      'm-alimony':'Výživné',
      'm-other-mandatory':'Jiné povinné platby',
      'm-payoff':'Doplacení závazků z hypotéky',
      'm-valuation-known':'Znáte hodnotu nemovitosti',
      'm-valuation':'Odhadní hodnota nemovitosti',
      'm-collateral':'Další nemovitost do zástavy',
      'm-collateral-value':'Hodnota další zástavy',
      'm-collateral-owner':'Vlastník další zástavy',
      'm-income-type':'Typ příjmu',
      'm-employment-months':'Délka zaměstnání / podnikání',
      'm-probation':'Zkušební doba',
      'm-fixed-term':'Pracovní smlouva na dobu určitou',
      'm-foreign-income':'Příjem ze zahraničí',
      'm-registers':'Záznamy v registrech',
      'm-preferred-payment':'Preferovaná maximální splátka',
      'r-months':'Cílová rezerva po zaplacení hypotéky'
    };

    const groupMap = {
      'm-purpose':'1. Účel a základ',
      'm-price':'1. Účel a základ',
      'm-purchase-price':'1. Účel a základ',
      'm-use-type':'1. Účel a základ',
      'm-land-owned':'1. Účel a základ',
      'm-land-value':'1. Účel a základ',
      'm-construction-budget':'1. Účel a základ',
      'm-future-value':'1. Účel a základ',
      'm-construction-reserve':'1. Účel a základ',
      'm-build-stages':'1. Účel a základ',
      'm-build-completion':'1. Účel a základ',
      'm-current-property-value':'1. Účel a základ',
      'm-renovation-budget':'1. Účel a základ',
      'm-after-renovation-value':'1. Účel a základ',
      'm-renovation-reserve':'1. Účel a základ',
      'm-renovation-drawdown':'1. Účel a základ',
      'm-pr-purchase-price':'1. Účel a základ',
      'm-pr-renovation-budget':'1. Účel a základ',
      'm-pr-after-value':'1. Účel a základ',
      'm-pr-reserve':'1. Účel a základ',
      'm-pr-drawdown':'1. Účel a základ',
      'm-settlement-type':'1. Účel a základ',
      'm-settlement-property-value':'1. Účel a základ',
      'm-payout-amount':'1. Účel a základ',
      'm-current-share':'1. Účel a základ',
      'm-final-share':'1. Účel a základ',
      'm-existing-mortgage':'1. Účel a základ',
      'm-existing-mortgage-balance':'1. Účel a základ',
      'm-current-debtor':'1. Účel a základ',
      'm-other-housing-description':'1. Účel a základ',
      'm-other-needed-amount':'1. Účel a základ',
      'm-other-collateral-value':'1. Účel a základ',
      'm-income':'2. Domácnost a příjmy',
      'm-age':'2. Domácnost a příjmy',
      'm-adults':'2. Domácnost a příjmy',
      'm-children':'2. Domácnost a příjmy',
      'm-marital':'2. Domácnost a příjmy',
      'm-applicants':'2. Domácnost a příjmy',
      'm-income-second':'2. Domácnost a příjmy',
      'm-age-second':'2. Domácnost a příjmy',
      'm-income-type':'2. Domácnost a příjmy',
      'm-employment-months':'2. Domácnost a příjmy',
      'm-probation':'2. Domácnost a příjmy',
      'm-fixed-term':'2. Domácnost a příjmy',
      'm-foreign-income':'2. Domácnost a příjmy',
      'm-registers':'2. Domácnost a příjmy',
      'm-own':'3. Vlastní zdroje a zajištění',
      'm-valuation-known':'3. Vlastní zdroje a zajištění',
      'm-valuation':'3. Vlastní zdroje a zajištění',
      'm-collateral':'3. Vlastní zdroje a zajištění',
      'm-collateral-value':'3. Vlastní zdroje a zajištění',
      'm-collateral-owner':'3. Vlastní zdroje a zajištění',
      'm-has-debts':'4. Závazky a rozpočet',
      'm-other-payments':'4. Závazky a rozpočet',
      'm-other-balance':'4. Závazky a rozpočet',
      'm-cards':'4. Závazky a rozpočet',
      'm-alimony':'4. Závazky a rozpočet',
      'm-other-mandatory':'4. Závazky a rozpočet',
      'm-payoff':'4. Závazky a rozpočet',
      'm-preferred-payment':'4. Závazky a rozpočet',
      'r-months':'4. Závazky a rozpočet',
      'm-years':'5. Nastavení hypotéky',
      'm-rate':'5. Nastavení hypotéky'
    };

    const alwaysShow = new Set(['m-purpose','m-price','m-own','m-income','m-years','m-age','m-rate']);
    const seen = new Set();
    const groups = {};

    const readableValue = field => {
      if(field.tagName.toLowerCase() === 'select'){
        const option = field.options[field.selectedIndex];
        return option ? option.textContent.trim() : field.value;
      }
      if(field.type === 'checkbox') return field.checked ? 'ano' : 'ne';
      return field.value || '';
    };

    document.querySelectorAll('#mortgage-calculator input, #mortgage-calculator select, #mortgage-calculator textarea').forEach(field => {
      if(field.closest('#lead-block')) return;
      if(field.type === 'hidden' || field.type === 'range') return;
      const id = field.id || field.name || '';
      if(!id || seen.has(id)) return;
      seen.add(id);

      const value = readableValue(field);
      if(!alwaysShow.has(id) && (value === '' || value === null || value === undefined)) return;

      const wrap = field.closest('.calc-field');
      const rawLabel = wrap?.querySelector('label')?.childNodes?.[0]?.textContent?.trim() || id;
      const label = labelMap[id] || rawLabel || id;
      const group = groupMap[id] || '6. Ostatní údaje';

      if(!groups[group]) groups[group] = [];
      groups[group].push({id, label, value: value || 'neuvedeno'});
    });

    return groups;
  }

  function buildMortgageDataPackage(data){
    const groupedInputs = collectMortgageInputs();
    const clean = value => (value === null || value === undefined || value === '' ? 'neuvedeno' : value);
    const line = (label, value, width = 42) => String(label).replace(/\s+/g,' ').trim().padEnd(width, ' ') + ': ' + clean(value);
    const moneySafe = value => Number.isFinite(Number(value)) ? money(value) : 'neuvedeno';
    const pctSafe = value => Number.isFinite(Number(value)) ? pct(value) : 'neuvedeno';

    const rateBase = Number.isFinite(Number(data.rate)) ? Number(data.rate) : 0;
    const loanBase = Number.isFinite(Number(data.loan)) ? Number(data.loan) : 0;
    const yearsBase = Number.isFinite(Number(data.years)) ? Number(data.years) : 0;

    const packageObject = {
      typ:'Hypoteční kalkulačka',
      datum_odeslani:new Date().toISOString(),
      url_stranky:window.location.href,
      ucel_financovani:data.purposeName || data.purpose,
      orientacni_zaver:{
        status:data.status,
        poznamka:data.note,
        poznamka_k_vypoctu:data.derivedNote || ''
      },
      klicovy_vysledek:{
        orientacni_vyse_uveru_kc:Math.round(data.loan||0),
        orientacni_mesicni_splatka_kc:Math.round(data.monthly||0),
        chybejici_vlastni_penze_kc:Math.round(data.ownNeeded||0),
        ltv_pct:Number.isFinite(data.ltv)?Number(data.ltv.toFixed(1)):null,
        zatizeni_dnes_pct:Number.isFinite(data.currentRatio)?Number(data.currentRatio.toFixed(1)):null,
        zatizeni_po_hypotece_pct:Number.isFinite(data.futureRatio)?Number(data.futureRatio.toFixed(1)):null
      },
      pouzite_predpoklady:{
        sazba_pct:data.rate,
        doba_splaceni_let:data.years,
        cilove_ltv_pct:data.targetLtv
      },
      zadane_udaje:groupedInputs,
      scenare_sazby:{
        zakladni_splatka_kc:Math.round(data.monthly||0),
        sazba_plus_1_pb_kc:Math.round(payment(loanBase, rateBase+1, yearsBase)||0),
        sazba_plus_2_pb_kc:Math.round(payment(loanBase, rateBase+2, yearsBase)||0),
        sazba_minus_0_5_pb_kc:Math.round(payment(loanBase, Math.max(0,rateBase-0.5), yearsBase)||0),
        sazba_minus_1_pb_kc:Math.round(payment(loanBase, Math.max(0,rateBase-1), yearsBase)||0)
      },
      upozorneni:[
        'Výsledek je orientační model.',
        'Nejde o schválení úvěru ani závaznou nabídku banky.',
        'Finální možnosti závisí na doložených příjmech, odhadu nemovitosti, registrech, závazcích a pravidlech banky.'
      ]
    };

    const lines = [];
    const addSection = title => {
      lines.push('');
      lines.push(title);
      lines.push('-'.repeat(title.length));
    };

    lines.push('KOMPLETNÍ BALÍČEK DAT Z HYPOTEČNÍ KALKULAČKY');
    lines.push('============================================');

    addSection('1. RYCHLÝ SOUHRN');
    lines.push(line('Účel financování', data.purposeName || data.purpose));
    lines.push(line('Orientační závěr', data.status));
    lines.push(line('Poznámka', data.note));
    if(data.derivedNote) lines.push(line('Poznámka k výpočtu', data.derivedNote));
    lines.push(line('Datum odeslání', packageObject.datum_odeslani));
    lines.push(line('URL stránky', packageObject.url_stranky));

    addSection('2. KLÍČOVÝ VÝSLEDEK');
    lines.push(line('Orientační výše úvěru', moneySafe(data.loan)));
    lines.push(line('Orientační měsíční splátka', moneySafe(data.monthly)));
    lines.push(line('Chybějící vlastní peníze', moneySafe(data.ownNeeded)));
    lines.push(line('LTV', pctSafe(data.ltv)));
    lines.push(line('Zatížení dnes', pctSafe(data.currentRatio)));
    lines.push(line('Zatížení po hypotéce', pctSafe(data.futureRatio)));

    addSection('3. POUŽITÉ PŘEDPOKLADY');
    lines.push(line('Použitá sazba', fmtRate(data.rate)));
    lines.push(line('Doba splácení', yearsBase ? yearsBase + ' let' : 'neuvedeno'));
    lines.push(line('Cílové LTV', pctSafe(data.targetLtv)));

    addSection('4. ZADANÉ ÚDAJE KLIENTA');
    Object.keys(groupedInputs).sort().forEach(group => {
      const items = groupedInputs[group];
      if(!items || !items.length) return;
      lines.push('');
      lines.push(group);
      items.forEach(item => lines.push(line(item.label, item.value)));
    });

    addSection('5. SCÉNÁŘE ZMĚNY SAZBY');
    lines.push(line('Základní splátka', moneySafe(data.monthly)));
    lines.push(line('Sazba +1 procentní bod', moneySafe(payment(loanBase, rateBase+1, yearsBase))));
    lines.push(line('Sazba +2 procentní body', moneySafe(payment(loanBase, rateBase+2, yearsBase))));
    lines.push(line('Sazba -0,5 procentního bodu', moneySafe(payment(loanBase, Math.max(0,rateBase-0.5), yearsBase))));
    lines.push(line('Sazba -1 procentní bod', moneySafe(payment(loanBase, Math.max(0,rateBase-1), yearsBase))));

    addSection('6. CO JE POTŘEBA OVĚŘIT');
    packageObject.upozorneni.forEach(x => lines.push('- ' + x));
    lines.push('- Bonitu, hodnotu zajištění, registry, závazky a metodiku konkrétní banky je nutné ověřit individuálně.');

    return {
      text: lines.join('\n'),
      json: JSON.stringify(packageObject, null, 2)
    };
  }

  function updateMortgageRecommendation(data){
    const badge = document.getElementById('mortgage-rec-badge');
    const text = document.getElementById('mortgage-rec-text');
    if(!badge || !text) return;

    const why = [];
    const watch = [];
    const next = [];

    if(!(data.price > 0) || !(data.loan > 0)){
      badge.textContent = 'Chybí základní údaje';
      text.textContent = 'Zatím nejde výsledek rozumně vyhodnotit. Nejdřív doplňte částky potřebné pro účel: ' + (data.purposeName || 'hypotéka') + '.';
      watch.push('Bez ceny nebo částky úvěru by výsledek působil přesněji, než ve skutečnosti je.');
      next.push('Doplňte cenu nemovitosti, vlastní peníze a dobu splácení.');
    }else if(data.ownNeeded > 0){
      badge.textContent = 'Nejdřív řešit vlastní zdroje';
      text.textContent = 'Model ukazuje, že pro bezpečnější poměr úvěru k hodnotě zajištění bude potřeba doplnit vlastní peníze, snížit úvěr nebo upravit zajištění.';
      why.push('Účel financování: ' + (data.purposeName || 'hypotéka') + '.');
      if(data.derivedNote) why.push(data.derivedNote);
      why.push('Orientační splátka vychází na ' + money(data.monthly) + '.');
      why.push('Chybějící vlastní peníze vychází přibližně na ' + money(data.ownNeeded) + '.');
      why.push('Hypotéka by pokrývala přibližně ' + pct(data.ltv) + ' hodnoty zajištění.');
      watch.push('Vyšší LTV může znamenat horší dostupnost nebo přísnější podmínky banky.');
      watch.push('Další zástava může výsledek zlepšit, ale musí dávat smysl i právně a rodinně.');
      next.push('Ověřte, zda lze doplnit vlastní zdroje, snížit kupní cenu nebo použít další zajištění.');
      next.push('Pošlete mi výsledek a projdu, která varianta je reálně průchodná.');
    }else if(data.totalIncome <= 0){
      badge.textContent = 'Splátka spočítaná, rozpočet chybí';
      text.textContent = 'Splátka a vlastní zdroje jsou orientačně spočítané, ale bez příjmu domácnosti nejde posoudit bezpečnost splácení.';
      why.push('Orientační splátka vychází na ' + money(data.monthly) + '.');
      why.push('Orientační výše úvěru je ' + money(data.loan) + '.');
      watch.push('Bez příjmu domácnosti nelze vyhodnotit, zda je splátka bezpečná pro rozpočet.');
      next.push('Doplňte čistý příjem domácnosti a případné další splátky.');
    }else if(data.risk || data.complexIncome || data.purpose === 'investment'){
      badge.textContent = 'Individuální posouzení';
      text.textContent = 'Čísla mohou dávat smysl, ale typ příjmu, investiční účel nebo rizikový faktor vyžadují přesnější ověření.';
      why.push('Orientační splátka vychází na ' + money(data.monthly) + '.');
      why.push('Zatížení po transakci vychází přibližně na ' + pct(data.futureRatio) + '.');
      watch.push('OSVČ, zahraniční příjem, investiční nemovitost nebo záznamy v registrech banky posuzují individuálně.');
      next.push('Dává smysl poslat data a ověřit, která banka by takový případ mohla umět.');
    }else if(data.futureRatio > 55 || data.ltv > data.targetLtv + 10){
      badge.textContent = 'V této podobě slabší';
      text.textContent = 'Výsledek ukazuje vyšší zatížení nebo příliš vysoký poměr úvěru k hodnotě zajištění. Pravděpodobně bude potřeba upravit strukturu.';
      why.push('Zatížení po transakci vychází přibližně na ' + pct(data.futureRatio) + '.');
      why.push('Hypotéka by pokrývala přibližně ' + pct(data.ltv) + ' hodnoty zajištění.');
      watch.push('Banka může požadovat nižší úvěr, vyšší vlastní zdroje nebo dalšího žadatele.');
      next.push('Zvažte vyšší vlastní zdroje, spolužadatele, doplacení závazků nebo další zástavu.');
    }else if(data.futureRatio > 45 || data.ltv > data.targetLtv){
      badge.textContent = 'Hraniční, stojí za ověření';
      text.textContent = 'Výsledek nevypadá špatně, ale je potřeba ověřit slabší místa: zatížení rozpočtu, vlastní zdroje nebo hodnotu zajištění.';
      why.push('Orientační splátka vychází na ' + money(data.monthly) + '.');
      why.push('Zatížení po transakci vychází přibližně na ' + pct(data.futureRatio) + '.');
      watch.push('Výsledek může být citlivý na sazbu, odhad nemovitosti nebo další závazky.');
      next.push('Nechte si ověřit konkrétní průchodnost u bank a možnosti zlepšení.');
    }else{
      badge.textContent = 'Dává smysl dál ověřit';
      text.textContent = 'Základní čísla působí rozumně. Neznamená to schválení úvěru, ale stojí za to ověřit konkrétní nabídky a podmínky bank.';
      why.push('Orientační splátka vychází na ' + money(data.monthly) + '.');
      why.push('Zatížení po transakci vychází přibližně na ' + pct(data.futureRatio) + '.');
      why.push('Poměr úvěru k hodnotě zajištění vychází přibližně na ' + pct(data.ltv) + '.');
      watch.push('Finální výsledek závisí na odhadu nemovitosti, doložení příjmů, registrech a metodice konkrétní banky.');
      next.push('Pošlete mi výsledek. Ověřím, co je potřeba doplnit a jaký další krok dává smysl.');
    }

    if(data.rateUsedDefault){
      watch.push('Sazba nebyla vyplněná. Výpočet používá orientační výchozí sazbu.');
    }

    setList('mortgage-rec-why', why);
    setList('mortgage-rec-watch', watch);
    setList('mortgage-rec-next', next);
  }


  function updatePurposeFields(){
    const purpose = value('m-purpose') || 'purchase';
    document.querySelectorAll('[data-purpose-panel]').forEach(panel => {
      panel.classList.toggle('calc-hidden', panel.dataset.purposePanel !== purpose);
    });

    const priceLabel = document.getElementById('m-price-label');
    const priceHelper = document.getElementById('m-price-helper');
    const labels = {
      purchase: ['Cena / hodnota nemovitosti', 'U běžné koupě zadejte kupní cenu. Pokud vyplníte pole Kupní cena výše, použije se pro výpočet.'],
      construction: ['Celková orientační hodnota projektu', 'U výstavby se částka může dopočítat z pozemku, rozpočtu stavby a budoucí hodnoty.'],
      renovation: ['Hodnota nemovitosti / celkový rámec rekonstrukce', 'U rekonstrukce se výpočet opírá hlavně o současnou hodnotu, rozpočet a hodnotu po rekonstrukci.'],
      purchase_renovation: ['Celková potřeba: koupě + rekonstrukce', 'Pokud vyplníte kupní cenu a rozpočet rekonstrukce, kalkulačka je použije pro přesnější výpočet.'],
      settlement: ['Hodnota nemovitosti nebo částka k vypořádání', 'U vypořádání zadejte níže hodnotu celé nemovitosti a částku k vyplacení.'],
      other_housing: ['Potřebná částka nebo hodnota zajištění', 'U jiného případu popište situaci a zadejte potřebnou částku nebo hodnotu zajištění.']
    };
    if(priceLabel && labels[purpose]) priceLabel.textContent = labels[purpose][0];
    if(priceHelper && labels[purpose]) priceHelper.textContent = labels[purpose][1];

    const caseType = document.getElementById('m-case-type');
    if(caseType && Array.from(caseType.options).some(o => o.value === purpose)){
      caseType.value = purpose;
    }
  }

  function getPurposeModel(basePrice, own){
    const purpose = value('m-purpose') || 'purchase';
    let totalNeed = basePrice;
    let collateralValue = basePrice;
    let loanBase = Math.max(0, basePrice - own);
    let derivedNote = '';

    if(purpose === 'purchase'){
      const purchasePrice = number('m-purchase-price') || basePrice;
      totalNeed = purchasePrice;
      collateralValue = purchasePrice;
      loanBase = Math.max(0, purchasePrice - own);
      derivedNote = 'Výpočet vychází z kupní ceny a vlastních zdrojů.';
    }

    if(purpose === 'construction'){
      const landValue = number('m-land-value');
      const budget = number('m-construction-budget');
      const futureValue = number('m-future-value');
      const reserve = number('m-construction-reserve');
      const landOwned = value('m-land-owned') !== 'no';
      totalNeed = (landOwned ? 0 : landValue) + budget + reserve;
      collateralValue = futureValue || (landValue + budget);
      loanBase = Math.max(0, totalNeed - own);
      derivedNote = 'Výpočet u výstavby vychází z rozpočtu stavby, případné ceny pozemku, rezervy a budoucí hodnoty.';
    }

    if(purpose === 'renovation'){
      const currentValue = number('m-current-property-value');
      const budget = number('m-renovation-budget');
      const afterValue = number('m-after-renovation-value');
      const reserve = number('m-renovation-reserve');
      totalNeed = budget + reserve;
      collateralValue = afterValue || (currentValue + budget);
      loanBase = Math.max(0, totalNeed - own);
      derivedNote = 'Výpočet u rekonstrukce vychází z rozpočtu rekonstrukce, rezervy a hodnoty po rekonstrukci.';
    }

    if(purpose === 'purchase_renovation'){
      const purchasePrice = number('m-pr-purchase-price');
      const renovationBudget = number('m-pr-renovation-budget');
      const afterValue = number('m-pr-after-value');
      const reserve = number('m-pr-reserve');
      totalNeed = purchasePrice + renovationBudget + reserve;
      collateralValue = afterValue || (purchasePrice + renovationBudget);
      loanBase = Math.max(0, totalNeed - own);
      derivedNote = 'Výpočet odděluje kupní cenu, rozpočet rekonstrukce a rezervu.';
    }

    if(purpose === 'settlement'){
      const propertyValue = number('m-settlement-property-value') || basePrice;
      const payout = number('m-payout-amount');
      const existingMortgage = value('m-existing-mortgage') === 'yes' ? number('m-existing-mortgage-balance') : 0;
      totalNeed = payout + existingMortgage;
      collateralValue = propertyValue;
      loanBase = Math.max(0, totalNeed - own);
      derivedNote = 'Výpočet u vypořádání vychází z částky k vyplacení a případného zůstatku současné hypotéky.';
    }

    if(purpose === 'other_housing'){
      const needed = number('m-other-needed-amount') || basePrice;
      const collateral = number('m-other-collateral-value') || basePrice;
      totalNeed = needed;
      collateralValue = collateral;
      loanBase = Math.max(0, needed - own);
      derivedNote = 'Jiný případ je orientační a vyžaduje individuální kontrolu.';
    }

    if(totalNeed <= 0){
      totalNeed = basePrice;
      loanBase = Math.max(0, basePrice - own);
    }
    if(collateralValue <= 0){
      collateralValue = basePrice || totalNeed || 1;
    }

    return { purpose, totalNeed, collateralValue, loanBase, derivedNote };
  }

  function purposeClientName(purpose){
    return {
      purchase:'koupě nemovitosti',
      construction:'výstavba domu',
      renovation:'rekonstrukce',
      purchase_renovation:'koupě + rekonstrukce',
      settlement:'vypořádání / převod podílu',
      other_housing:'jiné řešení bydlení'
    }[purpose] || 'hypotéka';
  }

  function calculateMortgage(){
    const basePrice=number('m-price');
    const own=number('m-own');
    const requested=number('m-requested-loan');
    const purpose=value('m-purpose');
    const model=getPurposeModel(basePrice, own);
    const price=model.totalNeed || basePrice;
    const rate=number('m-rate') || DEFAULT_RATE;
    const years=number('m-years') || 30;
    const autoLoan = Math.max(0, model.loanBase + payoffDebtBalance());
    const loan = requested > 0 ? requested : autoLoan;
    const monthly=payment(loan, rate, years);
    updateRateScenarios(loan, rate, years, monthly);
    const secondIncome = value('m-applicants')==='two' ? number('m-income-second') : 0;
    const totalIncome=number('m-income') + secondIncome + number('m-other-income');
    const currentLoad = number('m-other-payments') + number('m-cards') + number('m-alimony') + number('m-other-mandatory');
    const futureLoad = Math.max(0,currentLoad-payoffMonthlyRelief()) + monthly;
    const baseCollateral = value('m-valuation-known')==='yes' && number('m-valuation')>0 ? number('m-valuation') : model.collateralValue;
    const additionalCollateral = value('m-collateral')==='yes' ? Math.max(0, number('m-collateral-value') - (value('m-collateral-debt-yes')==='yes'?number('m-collateral-debt'):0)) : 0;
    const collateral=Math.max(1,baseCollateral+additionalCollateral);
    const ltv=loan/collateral*100;
    const tLtv=targetLtv();
    const allowableLoanByCollateral = collateral * (tLtv/100);
    const ownNeeded=Math.max(0, loan - allowableLoanByCollateral);
    const currentRatio=totalIncome>0 ? currentLoad/totalIncome*100 : 0;
    const futureRatio=totalIncome>0 ? futureLoad/totalIncome*100 : 0;
    const complexIncome=['self_employed','foreign','combined'].includes(value('m-income-type'));
    const risk=value('m-repayment-problems')==='yes'||value('m-execution')==='yes'||value('m-overdue')==='yes';
    const helpful=value('m-applicants')==='two'||value('m-collateral')==='yes'||value('m-payoff')==='yes';

    let status='Bude potřeba doplnit údaje', statusClass='needs';
    let note='Doplňte cenu, vlastní peníze a příjem domácnosti.';
    if(price>0 && totalIncome>0 && loan>0){
      if(risk || complexIncome || value('m-use-type')==='rent'){
        status='Vyžaduje individuální posouzení'; statusClass='review'; note='Neznamená to stopku. Jen je potřeba podívat se na strukturu případu přesněji.';
      } else if(ltv>tLtv+10 || futureRatio>55){
        status=helpful?'Vypadá reálně s podmínkou':'Bude potřeba jiné řešení'; statusClass=helpful?'condition':'different'; note=helpful?'Pomoci může spolužadatel, další zástava nebo doplacení závazků.':'V této podobě to vychází slaběji. Smysl dává upravit částku, vlastní zdroje nebo strukturu.';
      } else if(ltv>tLtv || futureRatio>45){
        status=mortgageLevel==='basic'?'Spíš hraniční případ':'Vypadá reálně s podmínkou'; statusClass='condition'; note='Výsledek není špatný, ale bude dobré doplnit údaje a ověřit slabší místa.';
      } else {
        status='Vypadá reálně'; statusClass='ok'; note='Základní čísla dávají smysl. Finální výsledek ale závisí na bance, odhadu a doložených údajích.';
      }
    }

    setText('sum-payment', money(monthly));
    setText('sum-loan', money(loan));
    setText('sum-own-needed', money(ownNeeded));
    setText('sum-ltv', pct(ltv));
    show('manual-loan-warning', requested > 0);
    setText('sum-status', status);
    setText('sum-note', note);
    setText('sum-current-load', pct(currentRatio));
    setText('sum-future-load', pct(futureRatio));
    setText('mobile-payment', money(monthly));
    setText('mobile-own-needed', money(ownNeeded));
    setText('mobile-status', status);
    show('mobile-result-bar', mortgageCalculated);
    document.getElementById('mobile-result-bar')?.classList.toggle('is-visible', mortgageCalculated);
    document.getElementById('requested-loan-field-warning')?.classList.toggle('is-visible', requested > 0);
    updateStepUI();
    const prec=precision();
    setText('precision-label', prec.label);
    setText('precision-score', prec.score===null?'—':prec.score+' %');
    const bar=document.getElementById('precision-bar'); if(bar) bar.style.width=(prec.score||0)+'%';

    const mortgageData = {price, own, requested, purpose, purposeName:purposeClientName(purpose), totalNeed:model.totalNeed, collateralValue:model.collateralValue, derivedNote:model.derivedNote, rate, years, loan, monthly, ownNeeded, ltv, targetLtv:tLtv, currentRatio, futureRatio, totalIncome, currentLoad, futureLoad, status, statusClass, note, complexIncome, risk, rateUsedDefault:!(number('m-rate')>0), level:mortgageLevel};
    updateMortgageRecommendation(mortgageData);
    const packageData = buildMortgageDataPackage(mortgageData);
    const hidden=document.getElementById('lead-result');
    const full=document.getElementById('mortgage-full-data');
    const json=document.getElementById('mortgage-json-data');
    const preview=document.getElementById('mortgage-data-preview');
    if(hidden) hidden.value = packageData.text;
    if(full) full.value = packageData.text;
    if(json) json.value = packageData.json;
    if(preview) preview.textContent = packageData.text;
  }

  const FIELD_INFO = {

    'm-purchase-price':'Uveďte kupní cenu nemovitosti. Pokud ji vyplníte, použije se pro přesnější výpočet.',
    'm-use-type':'Vlastní bydlení má obvykle jinou logiku posouzení než investiční nemovitost k pronájmu.',
    'm-land-owned':'U výstavby je důležité, zda už pozemek vlastníte, nebo ho také potřebujete financovat.',
    'm-land-value':'Orientační hodnota nebo cena pozemku. Vstupuje do hodnoty zajištění i celkové potřeby peněz.',
    'm-construction-budget':'Odhad celkových nákladů na stavbu domu.',
    'm-future-value':'Očekávaná hodnota domu po dokončení. Pomáhá posoudit poměr úvěru k hodnotě zajištění.',
    'm-construction-reserve':'Rezerva na zdražení stavby nebo vícepráce. U výstavby je prakticky nutná.',
    'm-build-stages':'Kolikrát se bude přibližně čerpat úvěr během výstavby.',
    'm-build-completion':'Orientační termín dokončení stavby.',
    'm-current-property-value':'Současná hodnota nemovitosti před rekonstrukcí.',
    'm-renovation-budget':'Odhad nákladů na rekonstrukci.',
    'm-after-renovation-value':'Očekávaná hodnota nemovitosti po dokončení rekonstrukce.',
    'm-renovation-reserve':'Rezerva na vícepráce a zdražení materiálu.',
    'm-renovation-drawdown':'Vyberte, zda se bude rekonstrukce financovat najednou, nebo postupně.',
    'm-pr-purchase-price':'Kupní cena nemovitosti při kombinaci koupě a rekonstrukce.',
    'm-pr-renovation-budget':'Samostatný rozpočet rekonstrukce. Neměl by být schovaný v kupní ceně.',
    'm-pr-after-value':'Očekávaná hodnota po dokončení rekonstrukce.',
    'm-pr-reserve':'Rezerva na navýšení rekonstrukčních nákladů.',
    'm-pr-drawdown':'Zda se část na rekonstrukci bude čerpat najednou, nebo postupně.',
    'm-settlement-type':'Vyberte, zda jde o podíl, rozvod, dědictví nebo jinou situaci.',
    'm-settlement-property-value':'Hodnota celé nemovitosti, ze které se vypořádání odvozuje.',
    'm-payout-amount':'Částka, kterou je potřeba vyplatit druhé straně.',
    'm-current-share':'Současný vlastnický podíl klienta.',
    'm-final-share':'Vlastnický podíl po vypořádání.',
    'm-existing-mortgage':'Zda už na nemovitosti existuje hypotéka.',
    'm-existing-mortgage-balance':'Zůstatek současné hypotéky, pokud se má řešit v nové struktuře.',
    'm-current-debtor':'Kdo je dnes dlužníkem současného úvěru.',
    'm-other-housing-description':'Stručně popište situaci, pokud nespadá do běžných kategorií.',
    'm-other-needed-amount':'Částka, kterou u jiného řešení bydlení potřebujete financovat.',
    'm-other-collateral-value':'Hodnota nemovitosti nebo zajištění u jiného případu.',

    'm-purpose':'Vyberte situaci, která nejlépe odpovídá tomu, co právě řešíte.',
    'm-price':'Zadejte kupní cenu nemovitosti nebo částku, kterou potřebujete řešit.',
    'm-own':'Sem patří úspory nebo jiné vlastní prostředky, které chcete do řešení vložit.',
    'm-income':'Zadejte měsíční čistý příjem domácnosti. U druhého žadatele lze příjem doplnit níže.',
    'm-years':'Zadejte, za jak dlouho byste chtěli hypotéku splatit. Nejčastěji 20 až 30 let.',
    'm-age':'Věk může ovlivnit maximální možnou dobu splácení.',
    'm-rate':'Pokud sazbu neznáte, nechte pole prázdné a použije se orientační výchozí sazba.',
    'm-adults':'Kolik dospělých tvoří vaši domácnost.',
    'm-children':'Kolik nezaopatřených dětí je v domácnosti.',
    'm-marital':'Vyberte, co je vám nejbližší. Pomáhá to lépe pochopit strukturu domácnosti.',
    'm-applicants':'Vyberte, jestli budete o hypotéku žádat sami, nebo společně s druhým žadatelem.',
    'm-income-second':'Čistý měsíční příjem druhého žadatele.',
    'm-age-second':'Věk druhého žadatele může ovlivnit celkovou splatnost.',
    'm-has-debts':'Zahrňte ostatní půjčky nebo úvěry, které už dnes splácíte.',
    'm-other-payments':'Součet měsíčních splátek ostatních úvěrů a půjček.',
    'm-other-balance':'Celkový zbývající dluh u ostatních úvěrů.',
    'm-cards':'Uveďte orientační zatížení z kreditních karet nebo kontokorentů.',
    'm-alimony':'Pokud platíte výživné, zadejte jeho měsíční výši.',
    'm-other-mandatory':'Jiné pravidelné povinné platby, které zatěžují rodinný rozpočet.',
    'm-payoff':'Vyberte, jestli se mají některé současné závazky doplatit v rámci nové struktury.',
    'm-valuation-known':'Pokud už máte odhad nebo orientační hodnotu od makléře, můžete ji použít.',
    'm-valuation':'Zadejte odhadní hodnotu nemovitosti, pokud ji znáte.',
    'm-collateral':'Další nemovitost na ručení může pomoci snížit poměr úvěru k hodnotě zajištění.',
    'm-collateral-value':'Orientační hodnota další nemovitosti, kterou by bylo možné použít k ručení.',
    'm-collateral-owner':'Napište, komu další nemovitost patří, například vám, partnerovi nebo rodičům.',
    'm-collateral-debt-yes':'Vyberte, jestli už na této nemovitosti není jiný úvěr nebo zástava.',
    'm-collateral-debt':'Pokud na další nemovitosti zůstává dluh, napište jeho orientační výši.',
    'm-income-type':'Vyberte hlavní typ příjmu. Některé typy vyžadují přesnější posouzení.',
    'm-foreign-country':'Pokud máte příjem ze zahraničí, napište stát, odkud plyne.',
    'm-foreign-currency':'Měna, ve které příjem dostáváte, například EUR nebo USD.',
    'm-case-type':'Vyberte variantu, která je vašemu případu nejbližší.',
    'm-employment-type':'Například zaměstnanec, OSVČ nebo kombinace více typů příjmů.',
    'm-employment-length':'Jak dlouho už pracujete nebo podnikáte v současném režimu.',
    'm-contract':'Vyberte, jestli máte smlouvu na dobu určitou nebo neurčitou.',
    'm-probation':'Vyberte, jestli jste momentálně ve zkušební době.',
    'm-seasonal':'Pokud příjem výrazně kolísá během roku, označte to zde.',
    'm-average-income':'Průměrný čistý příjem za posledních 6 až 12 měsíců.',
    'm-other-income':'Další pravidelné příjmy, které se dají zohlednit, například nájem.',
    'm-drawdown':'Vyberte, jestli potřebujete peníze najednou, nebo postupně.',
    'm-drawdown-months':'Jak dlouho přibližně bude čerpání probíhat.',
    'm-stages':'Kolik etap čerpání předpokládáte.',
    'm-completion':'Kdy přibližně očekáváte dokončení stavby nebo rekonstrukce.',
    'm-own-source':'Odkud budou pocházet vaše vlastní prostředky.',
    'm-sale-price':'Orientační cena, za kterou očekáváte prodej jiné nemovitosti.',
    'm-sale-when':'Kdy by měly být peníze z prodeje k dispozici.',
    'm-bridge':'Vyberte, jestli potřebujete období do prodeje překlenout jiným řešením.',
    'm-repayment-problems':'Stačí orientační informace. Slouží jen pro přesnější posouzení situace.',
    'm-execution':'Pokud v minulosti proběhla exekuce nebo insolvence, uveďte to.',
    'm-overdue':'Vyberte, jestli jsou některé závazky po splatnosti.',
    'm-fixation':'Vyberte, na jak dlouho byste si chtěli sazbu orientačně zafixovat.',
    'm-requested-loan':'Nechte prázdné pro automatický výpočet. Vyplňte jen tehdy, pokud chcete výši úvěru zadat ručně.',
    'm-preferred-payment':'Pokud máte hranici, přes kterou nechcete jít, zadejte ji sem.',
    'm-longer':'Zapne i orientační variantu s delší splatností a nižší splátkou.',
    'lead-name':'Vaše jméno použiji jen pro zpětný kontakt k výpočtu.',
    'lead-phone':'Telefon se hodí pro rychlé a pohodlné spojení.',
    'lead-email':'E-mail je vhodný pro poslání shrnutí nebo doplňujících informací.',
    'lead-note':'Můžete stručně napsat, co chcete prověřit nebo co je pro vás důležité.',
    'r-expenses':'Součet běžných měsíčních výdajů domácnosti.',
    'r-income':'Čistý měsíční příjem domácnosti.',
    'r-current':'Kolik máte aktuálně odloženo bokem jako rezervu.',
    'r-months':'Na kolik měsíců chcete mít rezervu vytvořenou.',
    'i-expenses':'Součet měsíčních výdajů, které by bylo nutné dál hradit.',
    'i-savings':'Peníze, které máte v rezervě rychle k dispozici.',
    'i-benefit':'Například nemocenská, renta nebo jiný náhradní příjem při výpadku.'
  };

  const LABEL_INFO = {
    'Počet dětí':'Kolik nezaopatřených dětí je v domácnosti.',
    'Rodinný stav':'Vyberte variantu, která je vám nejbližší.',
    'Typ závazku':'Například spotřebitelský úvěr, leasing nebo jiný závazek.',
    'Měsíční splátka':'Kolik za tento závazek platíte měsíčně.',
    'Zůstatek':'Kolik z tohoto závazku ještě zbývá doplatit.',
    'Způsob doplacení':'Vyberte, jak má být závazek splacen v nové struktuře.',
    'Jistota doplacení':'Označte, jak jisté je, že k doplacení opravdu dojde.',
    'Země příjmu':'Stát, odkud plyne zahraniční příjem.',
    'Měna příjmu':'Měna, ve které příjem dostáváte.',
    'Očekávaný termín dokončení':'Kdy přibližně bude stavba nebo rekonstrukce hotová.',
    'Kdy budou peníze k dispozici?':'Kdy očekáváte, že budete mít peníze k dispozici.',
    'Jméno a příjmení':'Vaše jméno použiji jen pro zpětný kontakt k výpočtu.',
    'Telefon':'Telefon se hodí pro rychlé a pohodlné spojení.',
    'E-mail':'E-mail je vhodný pro shrnutí nebo domluvu dalšího postupu.'
  };

  function tooltipTextForField(field){
    if(!field) return '';
    if(field.dataset.info) return field.dataset.info;
    const helper = field.querySelector('.helper');
    if(helper && helper.textContent.trim()) {
      helper.classList.add('tooltip-source');
      return helper.textContent.trim();
    }
    const input = field.querySelector('input,select,textarea');
    if(input && FIELD_INFO[input.id]) return FIELD_INFO[input.id];
    const label = field.querySelector('label,.label');
    if(label){
      const txt = label.textContent.replace(/\s+/g,' ').trim();
      return LABEL_INFO[txt] || '';
    }
    return '';
  }

  function enhanceField(field){
    if(!field || field.dataset.infoEnhanced==='1') return;
    const label = field.querySelector('label,.label');
    if(!label) return;
    const text = tooltipTextForField(field);
    if(!text) return;
    field.dataset.infoEnhanced='1';
    label.classList.add('label-with-info');
    const tip = document.createElement('span');
    tip.className = 'info-tip';
    tip.innerHTML = '<button type="button" class="info-button" aria-label="Více informací">i</button><span class="info-popover" role="tooltip"></span>';
    tip.querySelector('.info-popover').textContent = text;
    const btn = tip.querySelector('.info-button');
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.info-tip.open').forEach(el=>{ if(el!==tip) el.classList.remove('open'); });
      tip.classList.toggle('open');
    });
    label.appendChild(tip);
  }

  function initFieldInfo(root=document){
    root.querySelectorAll('.calc-field').forEach(enhanceField);
  }

  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.info-tip')){
      document.querySelectorAll('.info-tip.open').forEach(el=>el.classList.remove('open'));
    }
  });

  function syncConditionals(){
    show('second-applicant-fields', value('m-applicants')==='two');
    show('debt-fields', value('m-has-debts')==='yes');
    show('payoff-fields', value('m-payoff')==='yes');
    show('valuation-field', value('m-valuation-known')==='yes');
    show('collateral-fields', value('m-collateral')==='yes');
    show('collateral-debt-field', value('m-collateral-debt-yes')==='yes');
    show('foreign-income-fields', value('m-income-type')==='foreign');
    show('drawdown-fields', value('m-drawdown')==='gradual');
    show('sale-property-fields', value('m-own-source')==='sale_property');
  }


  function track(eventName, data={}){
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({event:eventName, calculator:'mortgage', ...data});
    if(window.console) console.info('analytics:event', eventName, data);
  }


  function updateStepUI(){
    const order=['basic','extended','advanced','contact'];
    const currentIndex = mortgageLevel==='advanced' ? 2 : mortgageLevel==='extended' ? 1 : 0;
    document.querySelectorAll('#mortgage-stepper .step-pill').forEach((pill)=>{
      const idx=order.indexOf(pill.dataset.step);
      pill.classList.toggle('active', idx===currentIndex);
      pill.classList.toggle('done', idx<currentIndex || (pill.dataset.step==='contact' && document.getElementById('lead-block')?.classList.contains('active')));
    });
  }

  document.querySelectorAll('.calc-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.calculator-shell').forEach(el=>el.classList.remove('active'));
      document.getElementById(btn.dataset.target)?.classList.add('active');
      document.getElementById(btn.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });

  document.getElementById('m-calculate')?.addEventListener('click',()=>{ mortgageCalculated=true; mortgageLevel='basic'; calculateMortgage(); document.getElementById('after-basic')?.classList.remove('calc-hidden'); track('mortgage_first_calculation',{level:'basic'}); });
  document.getElementById('m-extend')?.addEventListener('click',()=>{ track('mortgage_open_extended',{level:'extended'}); mortgageCalculated=true; mortgageLevel='extended'; document.getElementById('extended-section')?.classList.remove('calc-hidden'); document.getElementById('after-basic')?.classList.add('calc-hidden'); document.getElementById('after-extended')?.classList.remove('calc-hidden'); calculateMortgage(); });
  document.getElementById('m-advanced')?.addEventListener('click',()=>{ track('mortgage_open_advanced',{level:'advanced'}); mortgageCalculated=true; mortgageLevel='advanced'; document.getElementById('advanced-section')?.classList.remove('calc-hidden'); document.getElementById('after-extended')?.classList.add('calc-hidden'); calculateMortgage(); });
  document.querySelectorAll('[data-open-lead]').forEach(btn=>btn.addEventListener('click',()=>{ track('mortgage_cta_click',{status:document.getElementById('sum-status')?.textContent||''}); document.getElementById('lead-block')?.classList.add('active'); updateStepUI(); document.getElementById('lead-block')?.scrollIntoView({behavior:'smooth',block:'start'}); }));
  document.querySelectorAll('[data-open-summary]').forEach(btn=>btn.addEventListener('click',()=>{ document.getElementById('mortgage-summary')?.scrollIntoView({behavior:'smooth',block:'start'}); }));

  document.getElementById('add-debt')?.addEventListener('click',()=>{
    const list=document.getElementById('debt-list'); if(!list) return;
    const row=document.createElement('div'); row.className='debt-row'; row.setAttribute('data-debt-row','');
    row.innerHTML=`<div class="calc-field"><label>Typ závazku</label><input value="Spotřebitelský úvěr"></div><div class="calc-field"><label>Měsíční splátka</label><input type="number" data-debt-payment placeholder="0"></div><div class="calc-field"><label>Zůstatek</label><input type="number" data-debt-balance placeholder="0"></div><div class="calc-field"><label>Způsob doplacení</label><select data-debt-source><option value="mortgage_refinance">Refinancování úvěru na bydlení</option><option value="consolidation">Konsolidace</option><option value="own_money">Z vlastních peněz</option><option value="sale_other_property">Z prodeje jiné nemovitosti</option></select><select data-debt-certainty><option value="sure">Jistě</option><option value="likely">Pravděpodobně</option></select></div><button type="button" class="remove-debt">Smazat</button>`;
    list.appendChild(row);
    row.querySelector('.remove-debt').addEventListener('click',()=>{ row.remove(); calculateMortgage(); });
    row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calculateMortgage));
    initFieldInfo(row);
  });


  function installMortgageLinkedSliders(){
    const configs = [
      {id:"m-years", min:5, max:35, step:1, label:"Rychlá změna doby splácení", suffix:" let"},
      {id:"m-rate", min:1, max:10, step:0.05, label:"Rychlá změna úrokové sazby", suffix:" %", optional:true},
      {id:"m-own", min:0, max:5000000, step:50000, label:"Rychlá změna vlastních peněz", money:true},
      {id:"m-preferred-payment", min:0, max:80000, step:1000, label:"Rychlá změna maximální splátky", money:true, optional:true},
      {id:"r-months", min:1, max:24, step:1, label:"Rychlá změna měsíců rezervy", suffix:" měs."}
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
      const input = document.getElementById(cfg.id);
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

  installMortgageLinkedSliders();

  document.querySelectorAll('#mortgage-calculator input,#mortgage-calculator select,#mortgage-calculator textarea').forEach(el=>{
    el.addEventListener('input',()=>{ updatePurposeFields(); syncConditionals(); if(mortgageCalculated) calculateMortgage(); });
    el.addEventListener('change',()=>{ updatePurposeFields(); syncConditionals(); if(mortgageCalculated) calculateMortgage(); });
  });

  function calcReserve(){
    const expenses=number('r-expenses'), income=number('r-income'), months=number('r-months')||6;
    const target=expenses*months;
    const gap=Math.max(0,target-number('r-current'));
    setText('r-target', money(target));
    setText('r-gap', money(gap));
    setText('r-note', income>0 && expenses/income>0.8 ? 'Výdaje jsou vůči příjmu vysoké. Rezerva je tím důležitější.' : 'Výsledek je orientační. Smysl je mít rezervu dostupnou a oddělenou od běžné útraty.');
  }
  document.querySelectorAll('#reserve-calculator input,#reserve-calculator select').forEach(el=>el.addEventListener('input',calcReserve));
  document.getElementById('r-calculate')?.addEventListener('click',calcReserve);

  function calcIncomeGap(){
    const expenses=number('i-expenses'), savings=number('i-savings'), benefit=number('i-benefit');
    const monthlyGap=Math.max(0,expenses-benefit);
    const months=monthlyGap>0 ? savings/monthlyGap : 99;
    setText('i-gap', money(monthlyGap));
    setText('i-months', months>=99 ? 'více než 8 let' : Math.floor(months)+' měsíců');
    setText('i-note', months<6 ? 'Domácnost by při výpadku příjmu měla jen krátký časový polštář.' : 'Výsledek působí klidněji, ale záleží na délce výpadku a dalších závazcích.');
  }
  document.querySelectorAll('#income-calculator input').forEach(el=>el.addEventListener('input',calcIncomeGap));
  document.getElementById('i-calculate')?.addEventListener('click',calcIncomeGap);


  document.querySelector('#lead-block form')?.addEventListener('submit',()=>{
    mortgageCalculated = true;
    calculateMortgage();
  });

  updatePurposeFields();
  initFieldInfo();
  syncConditionals();
  updateStepUI();
  calculateMortgage();
  track('mortgage_calculator_view');
})();
