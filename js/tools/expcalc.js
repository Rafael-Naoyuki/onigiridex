"use strict";
/* OnigiriDex — EXP Calculator. Levels up to 140 come from the game (systemSetting expMap);
   141-150 are an estimate (each level = previous x 1.3).
   Per level: tickets = ceil(EXP / ticket value), OC = ceil(tickets / tickets per run x energy / (level - 1)) x OC per restore */
const EXPC = load("od2-expc", {from:125, to:140, into:0, ticket:10000000, perRun:43, diff:65, boost:50, oc:10, own:[0, 0, 0, 0]});
const saveExpc = () => store("od2-expc", EXPC);
const EXP_TICKETS = [["EXP Ticket I", 100000], ["EXP Ticket II", 2000000], ["EXP Ticket III", 10000000], ["EXP Ticket IV", 10000000]];
const EXP_DIFFS = [["Normal", 25], ["Hard", 50], ["Hell", 65]];
const EXP_MARKS = {130:"m1", 133:"m1", 135:"m1", 138:"m2", 140:"m3"};
const EXP_MAX = 150;
const EXP_TABLE = (() => { const t = {...(D.expTable || {})}; if (t[140]) for (let l = 141; l <= EXP_MAX; l++) t[l] = Math.floor(t[140] * Math.pow(1.3, l - 140)); return t; })();
const expLevels = Object.keys(EXP_TABLE).map(Number).sort((a, b) => a - b);
const expMin = expLevels[0] || 1;

function expCalc(c){
  const tv = Math.max(1, +c.ticket), run = Math.max(1, +c.perRun), ocr = Math.max(1, +c.oc);
  let bank = EXP_TICKETS.reduce((a, [, v], i) => a + (+c.own[i] || 0) * v, 0) + (+c.into || 0), tot = {exp:0, tickets:0, runs:0, oc:0, ocb:0};
  const rows = [];
  for (let L = c.from + 1; L <= c.to; L++){
    const full = EXP_TABLE[L] - EXP_TABLE[L - 1], used = Math.min(bank, full), need = full - used; bank -= used;
    const tickets = Math.ceil(need / tv), runs = tickets / run;
    const oc = Math.ceil(runs * c.diff / (L - 1)) * ocr, ocb = Math.ceil(runs * c.boost / (L - 1)) * ocr;
    tot.exp += need; tot.tickets += tickets; tot.runs += runs; tot.oc += oc; tot.ocb += ocb;
    rows.push({L, total: EXP_TABLE[L], full, need, tickets, oc, ocb, sumT: tot.tickets, sumO: tot.oc, sumB: tot.ocb, est: L > 140});
  }
  tot.runs = Math.ceil(tot.runs);
  return {rows, tot, spare: bank};
}
function viewExp(){
  setCrumbs([["Tools"], ["EXP Calculator"]]);
  const lvOpts = (v, lo, hi) => expLevels.filter(l => l >= lo && l <= hi).map(l => `<option value="${l}" ${l == v ? "selected" : ""}>${l}${l > 140 ? " (estimated)" : ""}</option>`).join("");
  EXPC.from = Math.max(expMin, Math.min(EXP_MAX - 1, EXPC.from)); EXPC.to = Math.max(EXPC.from + 1, Math.min(EXP_MAX, EXPC.to));
  app.innerHTML = `${ph({title:"EXP Calculator", sub:"How many EXP tickets, runs and OC you need to reach a level."})}
  <div class="exp-main">
    <aside class="card exp-side">
      <h3>Your level</h3>
      <div class="sim-grid2">
        <label class="sim-f"><span>Current level</span><select id="xfrom">${lvOpts(EXPC.from, expMin, EXP_MAX - 1)}</select></label>
        <label class="sim-f"><span>Target level</span><select id="xto">${lvOpts(EXPC.to, EXPC.from + 1, EXP_MAX)}</select></label>
      </div>
      <label class="sim-f"><span>EXP already in this level</span><input type="number" min="0" id="xinto" value="${EXPC.into || ""}" placeholder="0"></label>
      <h3>Tickets you own</h3>
      <div class="sim-grid2">${EXP_TICKETS.map(([n, v], i) => `<label class="sim-f"><span>${n.replace("EXP Ticket ", "Ticket ")} <i>${fmtM(v)}</i></span><input type="number" min="0" data-own="${i}" value="${EXPC.own[i] || ""}" placeholder="0"></label>`).join("")}</div>
      <h3>Farming</h3>
      <div class="seg" id="xdiff" role="group" aria-label="Difficulty">${EXP_DIFFS.map(([n, e]) => `<button data-e="${e}" class="${EXPC.diff == e ? "on" : ""}">${n} <small>${e}</small></button>`).join("")}</div>
      <div class="sim-grid2">
        <label class="sim-f"><span>Ticket to farm</span><select id="xticket">${[[100000, "I · 100k"], [2000000, "II · 2M"], [10000000, "III / IV · 10M"]].map(([v, n]) => `<option value="${v}" ${EXPC.ticket == v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="sim-f"><span>Tickets per run</span><input type="number" min="1" data-x="perRun" value="${EXPC.perRun}"></label>
        <label class="sim-f"><span>Boosted energy</span><input type="number" min="1" data-x="boost" value="${EXPC.boost}"></label>
        <label class="sim-f"><span>OC per restore</span><input type="number" min="1" data-x="oc" value="${EXPC.oc}"></label>
      </div>
    </aside>
    <div class="exp-out" id="xout"></div>
  </div>`;
  const redraw = () => { saveExpc(); drawExp(); };
  $("#xfrom").onchange = e => { EXPC.from = +e.target.value; EXPC.into = 0; if (EXPC.to <= EXPC.from) EXPC.to = EXPC.from + 1; saveExpc(); viewExp(); };
  $("#xto").onchange = e => { EXPC.to = +e.target.value; redraw(); };
  $("#xinto").oninput = e => { EXPC.into = Math.max(0, +e.target.value || 0); redraw(); };
  $("#xticket").onchange = e => { EXPC.ticket = +e.target.value; redraw(); };
  $$("[data-own]").forEach(i => i.oninput = () => { EXPC.own[+i.dataset.own] = Math.max(0, +i.value || 0); redraw(); });
  $$("[data-x]").forEach(i => i.oninput = () => { const v = +i.value; if (v > 0){ EXPC[i.dataset.x] = v; redraw(); } });
  $$("#xdiff button").forEach(b => b.onclick = () => { EXPC.diff = +b.dataset.e; $$("#xdiff button").forEach(x => x.classList.toggle("on", x == b)); redraw(); });
  drawExp();
}
function drawExp(){
  const c = expCalc(EXPC), t = c.tot, hasEst = EXPC.to > 140;
  $("#xout").innerHTML = `<section class="card">
    <div class="sim-kpis">
      <div class="sim-kpi main"><span>OC needed</span><b>${fmt(t.oc)}</b></div>
      <div class="sim-kpi"><span>OC during boost</span><b>${fmt(t.ocb)}</b></div>
      <div class="sim-kpi"><span>Tickets to farm</span><b>${fmt(t.tickets)}</b></div>
      <div class="sim-kpi"><span>Runs</span><b>${fmt(t.runs)}</b></div>
      <div class="sim-kpi"><span>EXP missing</span><b title="${fmt(t.exp)}">${t.exp >= 1e9 ? (t.exp / 1e9).toFixed(1) + "B" : fmtM(t.exp)}</b></div>
    </div>
    ${c.spare > 0 ? `<div class="rot-note"><span class="ok">Your tickets already cover this level, with ${fmt(c.spare)} EXP to spare.</span></div>` : ""}
    ${hasEst ? `<div class="covnote exp-note"><b>Estimate.</b> Levels above 140 are not in the game yet: each one is the previous level × 1.3.</div>` : ""}
  </section>
  <section class="card"><div class="wrap exp-wrap"><table class="tbl exp-tbl"><thead><tr><th>Level</th><th class="r">Total EXP</th><th class="r">EXP to get</th><th class="r">Tickets</th><th class="r">OC</th><th class="r">OC boost</th><th class="r">Tickets total</th><th class="r">OC total</th><th class="r">Boost total</th></tr></thead><tbody>
    ${c.rows.map(r => `<tr class="${EXP_MARKS[r.L] || ""} ${r.est ? "est" : ""}"><td><b>${r.L}</b>${r.est ? ` <span class="mute">est.</span>` : ""}</td><td class="r num">${fmt(r.total)}</td><td class="r num">${fmt(r.need)}</td><td class="r num">${fmt(r.tickets)}</td><td class="r num">${fmt(r.oc)}</td><td class="r num">${fmt(r.ocb)}</td><td class="r num">${fmt(r.sumT)}</td><td class="r num"><b>${fmt(r.sumO)}</b></td><td class="r num">${fmt(r.sumB)}</td></tr>`).join("")}
  </tbody></table></div>
  <details class="note sim-how"><summary>How it is calculated</summary>For each level: tickets = EXP ÷ ticket value, rounded up. OC = (tickets ÷ tickets per run × energy per run ÷ energy per restore), rounded up, × OC per restore. One restore gives (level − 1) energy. EXP up to level 140 comes from the game files.</details></section>`;
}
