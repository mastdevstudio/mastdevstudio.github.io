const $ = id => document.getElementById(id);
const money = v => new Intl.NumberFormat("cs-CZ",{style:"currency",currency:"CZK",maximumFractionDigits:0}).format(Number.isFinite(v)?v:0).replace(",00","");
const num = id => Number(($(id)?.value || "0").toString().replace(/\s/g,"").replace(",", ".")) || 0;
const set = (id, value) => { const el=$(id); if(el) el.textContent = value; };
const gapText = v => v <= 1 ? "Modelově sníženo" : money(v);
let lastPensionResult = null;

function pensionCostsTotal(){
  return num("housingCosts") + num("livingCosts") + num("healthCosts") + num("leisureCosts");
}

function syncTargetIncomeFromCosts(){
  const target = $("targetIncome");
  if(!target) return;
  target.readOnly = true;
  target.setAttribute("aria-readonly", "true");
  target.value = String(Math.round(pensionCostsTotal()));
}
const monthlyRate = annual => Math.pow(1+annual,1/12)-1;

function futureValue(principal, monthly, years, annual){
  const months = Math.max(0, Math.round(years*12));
  const r = monthlyRate(annual);
  const fp = principal*Math.pow(1+r,months);
  const fm = r===0 ? monthly*months : monthly*((Math.pow(1+r,months)-1)/r);
  return fp+fm;
}

function annuity(capital, months, annual){
  const r = monthlyRate(annual);
  if(months<=0) return 0;
  if(r===0) return capital/months;
  return (capital*r)/(1-Math.pow(1+r,-months));
}

function presentValue(monthlyNeed, months, annual){
  const r = monthlyRate(annual);
  if(months<=0) return 0;
  if(r===0) return monthlyNeed*months;
  return monthlyNeed*((1-Math.pow(1+r,-months))/r);
}

function requiredMonthly(targetCapital, currentCapital, years, annual){
  const months = Math.max(0, Math.round(years*12));
  const r = monthlyRate(annual);
  if(months<=0) return targetCapital;
  const currentFuture = currentCapital*Math.pow(1+r,months);
  const missing = Math.max(0, targetCapital-currentFuture);
  if(r===0) return missing/months;
  return missing/((Math.pow(1+r,months)-1)/r);
}

function estimatePension(netIncome, age){
  const base = netIncome*0.43;
  const adj = age<35 ? -1200 : age>55 ? 1200 : 0;
  return Math.min(Math.max(base+adj,14500),34000);
}

function setWidth(id, pct){
  const el = $(id);
  if(el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function stackHtml(statePct, regularPct, savingsPct, gapPct){
  return `
    <span class="seg state" style="width:${Math.max(0,statePct)}%"></span>
    <span class="seg regular" style="width:${Math.max(0,regularPct)}%"></span>
    <span class="seg savings" style="width:${Math.max(0,savingsPct)}%"></span>
    <span class="seg gap" style="width:${Math.max(0,gapPct)}%"></span>`;
}

document.addEventListener('DOMContentLoaded',()=>{ const targetIncome=document.getElementById('targetIncome'); if(targetIncome){ targetIncome.readOnly = true; targetIncome.setAttribute('aria-readonly','true'); } });

function calculate(){
  syncTargetIncomeFromCosts();
  const age = num("age");
  const retAge = Math.min(Math.max(num("retAge"),55),75);
  const years = Math.max(0, retAge-age);
  const netIncome = num("netIncome");
  const target = num("targetIncome");
  const manualPension = num("statePension");
  const pensionKnown = manualPension > 0;
  const state = pensionKnown ? manualPension : estimatePension(netIncome, age);
  document.body.classList.toggle("has-cssz-pension", pensionKnown);
  document.body.classList.toggle("missing-cssz-pension", !pensionKnown);

  const housing = num("housingCosts");
  const living = num("livingCosts");
  const health = num("healthCosts");
  const leisure = num("leisureCosts");
  const need = Math.max(target, housing+living+health+leisure);

  const currentSavings = num("currentSavings");
  const monthlySaving = num("monthlySaving");
  const regularIncome = num("regularIncome");
  const employer = num("employer");
  const drawAge = Math.min(Math.max(num("drawAge"),80),100);
  const scenario = document.querySelector('input[name="scenario"]:checked')?.value || "middle";
  const scenarioRates = { careful: 1, middle: 2.5, dynamic: 4 };
  const selectedReturn = scenarioRates[scenario] ?? 2.5;
  if($("returnRate")) $("returnRate").value = String(selectedReturn);
  if($("drawReturnRate")) $("drawReturnRate").value = String(selectedReturn / 2);
  const annual = selectedReturn/100;
  const drawAnnual = (selectedReturn/2)/100;

  const currentMonthly = monthlySaving + employer;
  const currentCapital = futureValue(currentSavings, currentMonthly, years, annual);
  const drawMonths = Math.max(1,(drawAge-retAge)*12);
  const currentDraw = annuity(currentCapital, drawMonths, drawAnnual);

  const needFromSavings = Math.max(0, need - state - regularIncome);
  const currentGap = Math.max(0, need - state - regularIncome - currentDraw);

  const targetCapital = presentValue(needFromSavings, drawMonths, drawAnnual);
  const recommendedTotalMonthly = requiredMonthly(targetCapital, currentSavings, years, annual);
  const calculatedOwnMonthly = Math.max(0, recommendedTotalMonthly - employer);

  // Modelová varianta nesmí klientovi "doporučit" snížit dnešní spoření.
  // Pokud je současný stav už modelově dostatečný, modelová varianta zůstává stejná jako dnešní stav.
  const recommendedOwnMonthly = currentGap > 1 ? Math.max(monthlySaving, calculatedOwnMonthly) : monthlySaving;
  const extra = Math.max(0, recommendedOwnMonthly - monthlySaving);

  const recommendedMonthly = recommendedOwnMonthly + employer;
  const recommendedCapital = futureValue(currentSavings, recommendedMonthly, years, annual);
  const recommendedDraw = annuity(recommendedCapital, drawMonths, drawAnnual);
  const recommendedGap = Math.max(0, need - state - regularIncome - recommendedDraw);

  const retirementYear = new Date().getFullYear()+years;

  set("heroPension", money(state));
  set("heroNeed", money(need));
  set("heroGap", gapText(currentGap));
  set("heroLifetimeGap", money(currentGap * drawMonths));
  set("sideGap", gapText(currentGap));
  set("outRetAge", `${retAge} let`);
  set("outRetYear", `cca rok ${retirementYear}`);
  set("outPension", money(state));
  set("outPensionSource", pensionKnown ? "údaj z Informativní důchodové aplikace" : "hrubý odhad podle dnešního příjmu – doplňte ČSSZ / IDA");
  set("outNeed", money(need));
  set("outGap", gapText(currentGap));
  set("outRecommended", money(recommendedOwnMonthly));

  set("verdictGap", currentGap <= 1 ? "0 Kč / měsíc" : money(currentGap) + " / měsíc");
  set("overviewTargetIncome", money(need) + " / měsíc");
  set("overviewCurrentIncome", money(Math.max(0, need - currentGap)) + " / měsíc");
  set("verdictModelGap", recommendedGap <= 1 ? "Modelově sníženo" : money(recommendedGap));
  set("verdictRecommendedSaving", money(recommendedOwnMonthly) + " / měsíc");

  const formGap = $("formGap");
  if(formGap) formGap.value = gapText(currentGap);
  const formRecommendedSaving = $("formRecommendedSaving");
  if(formRecommendedSaving) formRecommendedSaving.value = money(recommendedOwnMonthly) + " / měsíc";
  const formNeed = $("formNeed");
  if(formNeed) formNeed.value = money(need);
  const formPension = $("formPension");
  if(formPension) formPension.value = money(state);

  set("extraSavingBadge", `Modelové navýšení: +${money(extra)} / měsíc`);
  set("cmpCurrentGap", gapText(currentGap));
  set("cmpRecommendedGap", gapText(recommendedGap));
  set("cmpCurrentDraw", money(currentDraw));
  set("cmpRecommendedDraw", money(recommendedDraw));
  set("cmpCurrentCapital", money(currentCapital));
  set("cmpRecommendedCapital", money(recommendedCapital));

  set("baCurrentSaving", money(monthlySaving));
  set("baRecommendedSaving", money(recommendedOwnMonthly));
  set("baCurrentGap", gapText(currentGap));
  set("baRecommendedGap", gapText(recommendedGap));
  set("baCurrentDraw", money(currentDraw));
  set("baRecommendedDraw", money(recommendedDraw));
  set("baCurrentCapital", money(currentCapital));
  set("baRecommendedCapital", money(recommendedCapital));

  set("diffGap", money(Math.max(0, currentGap - recommendedGap)) + " / měsíc");
  set("diffDraw", money(Math.max(0, recommendedDraw - currentDraw)) + " / měsíc");
  set("diffCapital", money(Math.max(0, recommendedCapital - currentCapital)));

  const impact = currentGap <= 1
    ? `Současné nastavení se podle zadaných údajů blíží požadovanému příjmu v penzi.`
    : extra > 0
      ? `Modelové navýšení o ${money(extra)} měsíčně by podle výpočtu mohlo snížit orientační rozdíl o ${money(Math.max(0, currentGap - recommendedGap))} měsíčně.`
      : `Při současném měsíčním spoření vychází orientační rozdíl ${money(currentGap)}. Výsledek je vhodné projít podle reality rozpočtu.`;
  set("impactSentence", impact);
  const humanSummary = !pensionKnown
    ? "Výsledek je zatím hrubý odhad, protože chybí údaj z ČSSZ / IDA. Nejprve má smysl doplnit tento údaj a potom teprve hodnotit konkrétní modelovou částku."
    : currentGap <= 1
      ? "Podle zadaných údajů se současné nastavení blíží vašemu cíli. Přesto má smysl výpočet čas od času aktualizovat."
      : `Podle zadaných údajů vychází orientační rozdíl ${money(currentGap)} měsíčně. Dává smysl ověřit vstupy a projít, zda je modelová částka realistická pro váš rozpočet.`;
  set("pensionHumanSummaryText", humanSummary);

  set("legPension", money(state));
  set("legRegular", money(regularIncome));
  set("legDraw", money(currentDraw));
  set("legGap", gapText(currentGap));
  set("chartStartAge", `${age} let`);
  set("chartEndAge", `${retAge} let`);
  set("chartCurrentEndLabel", "Dnes: " + money(currentCapital));
  set("chartRecommendedEndLabel", "Model: " + money(recommendedCapital));

  const coverage = needFromSavings <= 0 ? 1 : currentDraw/needFromSavings;
  let status = "Rozdíl stojí za řešení";
  let text = "Výsledek ukazuje, že má smysl plán řešit včas. Nejde o paniku, ale o konkrétní číslo, se kterým se dá pracovat.";
  if(!pensionKnown){
    status = "Doplňte údaj z ČSSZ";
    text = "Kalkulačka teď používá hrubý odhad starobního důchodu podle dnešního příjmu. Pro přesnější výhled doplňte údaj z IDA nebo mi výsledek pošlete a pomohu vám ho ověřit.";
  } else if(coverage>=0.95){
    status="Jste na dobré cestě";
    text="Současné nastavení se blíží požadovanému příjmu. Dává smysl výpočet pravidelně aktualizovat.";
  }
  else if(coverage>=0.65){
    status="Pomohlo by doplnit plán";
    text="Současné penzijní spoření pomáhá, ale pro klidnější penzi bude vhodné postupně navýšit měsíční odkládání.";
  }
  set("heroStatus", status);
  const rec = $("recommendation");
  if(rec) rec.innerHTML = `<strong>${status}</strong><p>${text}</p>`;
  set("tipSaving", extra>0 ? `Modelově by bylo potřeba navýšit měsíční spoření přibližně o ${money(extra)}.` : "Současné měsíční spoření se blíží zadanému cíli.");

  const total = Math.max(need, 1);
  const statePct = Math.min(100, state/total*100);
  const regularPct = Math.min(100, regularIncome/total*100);
  const remainingAfterStateAndRegular = Math.max(0, need - state - regularIncome);
  const currentDrawUsed = Math.min(currentDraw, remainingAfterStateAndRegular);
  const recommendedDrawUsed = Math.min(recommendedDraw, remainingAfterStateAndRegular);
  const currentDrawPct = Math.min(100, currentDrawUsed/total*100);
  const currentGapPct = Math.max(0, 100-statePct-regularPct-currentDrawPct);
  const recommendedDrawPct = Math.min(100, recommendedDrawUsed/total*100);
  const recommendedGapPct = Math.max(0, 100-statePct-regularPct-recommendedDrawPct);

  setWidth("heroStatePart", statePct);
  setWidth("heroRegularPart", regularPct);
  setWidth("heroSavingsPart", currentDrawPct);
  setWidth("heroGapPart", currentGapPct);

  const stackCurrent = $("incomeStackCurrent");
  if(stackCurrent) stackCurrent.innerHTML = stackHtml(statePct, regularPct, currentDrawPct, currentGapPct);

  const stackRecommended = $("incomeStackRecommended");
  if(stackRecommended) stackRecommended.innerHTML = stackHtml(statePct, regularPct, recommendedDrawPct, recommendedGapPct);


  lastPensionResult = {
    type: "Důchodová kalkulačka",
    createdAt: new Date().toISOString(),
    url: window.location.href,
    dataQuality: pensionKnown ? "vyšší – použit údaj z ČSSZ / IDA" : "nižší – chybí údaj z ČSSZ / IDA, použit hrubý odhad podle příjmu",
    flags: {
      pensionKnown,
      missingCsszPension: !pensionKnown,
      resultIsOnlyEstimate: !pensionKnown
    },
    inputs: {
      age,
      retirementAge: retAge,
      yearsToRetirement: years,
      netMonthlyIncome: netIncome,
      targetMonthlyBudget: need,
      statePensionInput: manualPension,
      statePensionUsed: state,
      pensionSource: pensionKnown ? "ČSSZ / IDA" : "hrubý odhad podle dnešního příjmu",
      regularIncomeInRetirement: regularIncome,
      currentSavings,
      monthlySaving,
      employerContribution: employer,
      currentMonthlySavingTotal: currentMonthly,
      housingCosts: housing,
      livingCosts: living,
      healthCosts: health,
      leisureCosts: leisure,
      drawAge,
      scenario,
      selectedRealReturnPercent: selectedReturn,
      drawRealReturnPercent: selectedReturn / 2
    },
    outputs: {
      estimatedRetirementYear: retirementYear,
      targetMonthlyBudget: need,
      statePensionUsed: state,
      needFromSavings,
      currentCapital,
      currentDraw,
      currentGap,
      targetCapital,
      recommendedOwnMonthly,
      recommendedMonthlyTotal: recommendedMonthly,
      extraMonthlySaving: extra,
      recommendedCapital,
      recommendedDraw,
      recommendedGap,
      drawMonths
    },
    notes: [
      "Výpočet je orientační a pracuje v dnešních cenách.",
      "Zhodnocení je modelový reálný výnos po zohlednění inflace, nikoliv garance.",
      pensionKnown ? "Starobní důchod byl zadán klientem z ČSSZ / IDA." : "Starobní důchod nebyl zadán z ČSSZ / IDA; použit je pouze hrubý odhad podle dnešního příjmu."
    ]
  };
  updatePensionLeadPackage(lastPensionResult);

  updateLine("portfolioLineCurrent", currentSavings, currentMonthly, years, annual, currentCapital, currentCapital, recommendedCapital);
  updateLine("portfolioLineRecommended", currentSavings, recommendedMonthly, years, annual, recommendedCapital, currentCapital, recommendedCapital);
}

function updateLine(id, principal, monthly, years, annual, endValue, currentCapital, recommendedCapital){
  const line = $(id);
  if(!line) return;
  const max = Math.max(currentCapital, recommendedCapital, principal, 1);
  const points = [];
  for(let i=0;i<=6;i++){
    const y = years*(i/6);
    const value = futureValue(principal, monthly, y, annual);
    const x = 60 + i*(640/6);
    const yy = 230 - Math.min(205, (value/max)*205);
    points.push(`${x.toFixed(0)},${yy.toFixed(0)}`);
  }
  line.setAttribute("points", points.join(" "));

  const finalPoint = points[points.length - 1].split(",").map(Number);
  if(id === "portfolioLineCurrent"){
    const label = $("chartCurrentEndLabel");
    if(label){
      label.setAttribute("x", Math.min(530, finalPoint[0] - 160));
      label.setAttribute("y", Math.max(46, finalPoint[1] - 10));
    }
  }
  if(id === "portfolioLineRecommended"){
    const label = $("chartRecommendedEndLabel");
    if(label){
      label.setAttribute("x", Math.min(500, finalPoint[0] - 190));
      label.setAttribute("y", Math.max(24, finalPoint[1] - 10));
    }
  }
}


function installPensionLinkedSliders(){
  const configs = [
    {id:"age", min:18, max:65, step:1, label:"Rychlá změna věku", suffix:" let"},
    {id:"retAge", min:55, max:75, step:1, label:"Rychlá změna odchodu do penze", suffix:" let"},
    {id:"monthlySaving", min:0, max:30000, step:500, label:"Rychlá změna měsíčního spoření", money:true},
    {id:"employer", min:0, max:15000, step:250, label:"Rychlá změna příspěvku zaměstnavatele", money:true},
    {id:"drawAge", min:70, max:105, step:1, label:"Rychlá změna doby čerpání", suffix:" let"}
  ];

  const format = (value, cfg) => {
    if(value === "" || value === null || value === undefined) return "nevyplněno";
    const n = Number(value);
    if(!Number.isFinite(n)) return String(value);
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
    const input = $(cfg.id);
    if(!input || input.dataset.sliderInstalled === "1") return;
    input.dataset.sliderInstalled = "1";

    const current = Number(String(input.value || "").replace(",", "."));
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

installPensionLinkedSliders();

document.querySelectorAll("input").forEach(input => input.addEventListener("input", calculate));
document.querySelectorAll('input[name="scenario"]').forEach(input => input.addEventListener("change", calculate));
$("pensionForm")?.addEventListener("submit", e => {
  e.preventDefault();
  calculate();
  $("vysledek")?.scrollIntoView({behavior:"smooth", block:"start"});
});
set("year", new Date().getFullYear());
calculate();



function formatPensionDataPackage(data){
  if(!data) return "Zatím bez výpočtu.";
  const i = data.inputs;
  const o = data.outputs;
  const yesNo = value => value ? "ano" : "ne";
  return `KOMPLETNÍ BALÍČEK DAT Z DŮCHODOVÉ KALKULAČKY
===============================================

Typ: ${data.type}
Datum odeslání: ${data.createdAt}
URL stránky: ${data.url}
Kvalita dat: ${data.dataQuality}

HLAVNÍ ZÁVĚR
------------
Cílový měsíční rozpočet v penzi: ${money(o.targetMonthlyBudget)}
Očekávaný / použitý starobní důchod: ${money(o.statePensionUsed)}
Zdroj starobního důchodu: ${i.pensionSource}
Orientační měsíční rozdíl při současném nastavení: ${o.currentGap <= 1 ? "modelově sníženo" : money(o.currentGap)}
Modelová pravidelná částka klienta: ${money(o.recommendedOwnMonthly)} / měsíc
Modelové navýšení oproti dnešku: ${money(o.extraMonthlySaving)} / měsíc
Orientační rozdíl po modelové variantě: ${o.recommendedGap <= 1 ? "modelově sníženo" : money(o.recommendedGap)}

KONTROLA DAT
------------
Údaj z ČSSZ / IDA vyplněn: ${yesNo(data.flags.pensionKnown)}
Výsledek je pouze hrubý odhad: ${yesNo(data.flags.resultIsOnlyEstimate)}

VSTUPY KLIENTA
--------------
Věk dnes: ${i.age}
Plánovaný věk odchodu do penze: ${i.retirementAge}
Let do penze: ${i.yearsToRetirement}
Dnešní čistý měsíční příjem: ${money(i.netMonthlyIncome)}
Cílový měsíční rozpočet v penzi: ${money(i.targetMonthlyBudget)}
Očekávaný starobní důchod zadaný klientem: ${i.statePensionInput > 0 ? money(i.statePensionInput) : "nevyplněno"}
Použitý starobní důchod ve výpočtu: ${money(i.statePensionUsed)}
Další pravidelný příjem v penzi: ${money(i.regularIncomeInRetirement)}

NÁKLADY V PENZI
---------------
Bydlení: ${money(i.housingCosts)}
Běžné životní náklady: ${money(i.livingCosts)}
Zdraví a rezerva: ${money(i.healthCosts)}
Volný čas / cestování: ${money(i.leisureCosts)}

SOUČASNÉ SPOŘENÍ A ÚSPORY
-------------------------
Současné úspory na penzi: ${money(i.currentSavings)}
Vlastní měsíční spoření: ${money(i.monthlySaving)}
Příspěvek zaměstnavatele: ${money(i.employerContribution)}
Celkové měsíční spoření dnes: ${money(i.currentMonthlySavingTotal)}

MODELOVÉ PŘEDPOKLADY
--------------------
Zvolený scénář: ${i.scenario}
Modelový reálný výnos ve fázi spoření: ${i.selectedRealReturnPercent} % p.a.
Modelový reálný výnos ve fázi čerpání: ${i.drawRealReturnPercent} % p.a.
Do kolika let peníze rozpočítat: ${i.drawAge}
Počet měsíců čerpání: ${o.drawMonths}

VÝSTUPY VÝPOČTU
---------------
Orientační rok odchodu do penze: ${o.estimatedRetirementYear}
Potřeba krytá z vlastních úspor / renty: ${money(o.needFromSavings)}
Odhad úspor v době penze při dnešním nastavení: ${money(o.currentCapital)}
Renta z úspor při dnešním nastavení: ${money(o.currentDraw)} / měsíc
Orientační rozdíl při dnešním nastavení: ${o.currentGap <= 1 ? "modelově sníženo" : money(o.currentGap)}
Cílový kapitál pro modelovou rentu: ${money(o.targetCapital)}
Odhad úspor v době penze při modelové variantě: ${money(o.recommendedCapital)}
Renta z úspor při modelové variantě: ${money(o.recommendedDraw)} / měsíc
Orientační rozdíl po modelové variantě: ${o.recommendedGap <= 1 ? "modelově sníženo" : money(o.recommendedGap)}

UPOZORNĚNÍ
----------
${data.notes.map(note => "- " + note).join("\n")}
`;
}

function updatePensionLeadPackage(data){
  const packageText = formatPensionDataPackage(data);
  const summary = data
    ? `Důchodová kalkulačka: rozdíl ${data.outputs.currentGap <= 1 ? "modelově snížen" : money(data.outputs.currentGap) + " / měsíc"}, modelová částka ${money(data.outputs.recommendedOwnMonthly)} / měsíc, ČSSZ / IDA: ${data.flags.pensionKnown ? "vyplněno" : "chybí"}`
    : "Důchodová kalkulačka: zatím bez výpočtu.";

  const leadResult = $("pension-lead-result");
  if(leadResult) leadResult.value = summary;

  const fullData = $("pension-full-data");
  if(fullData) fullData.value = packageText;

  const jsonData = $("pension-json-data");
  if(jsonData) jsonData.value = data ? JSON.stringify(data, null, 2) : "";

  const preview = $("pension-data-preview");
  if(preview) preview.textContent = packageText;
}



document.addEventListener("submit", event => {
  if(event.target && event.target.classList && event.target.classList.contains("pension-lead-form")){
    if(lastPensionResult) updatePensionLeadPackage(lastPensionResult);
  }
});

