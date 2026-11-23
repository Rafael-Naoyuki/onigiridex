"use strict";
/* OnigiriDex — Rotation DPS: 5-skill timeline from the community sheet (T, CBT, RT, cooldown).
   Sheet values are never changed. Rules:
   - skill chain: every skill except index 0 has T, CBT and RT cut in half
   - the next skill starts at the previous skill's RT
   - rCD = cooldown x (1 - cooldown cut); it starts at the skill start, or at CBT for combo skills
   - rotation time = max(sum of RT, longest CBT + rCD) */
const ROT = load("od2-rot", {cat:0, ids:{}, mode:0, cut:80, cycles:2, edgeCd:true, tab:"s"});
const saveRot = () => store("od2-rot", ROT);
const ROT_MODES = ["DMG", "DMG + BDA", "MHC DMG", "MHC + BDA"];
const ROT_COLORS = ["#e2563b", "#6fa8ff", "#5cc8a1", "#e8c26a", "#b48cff"];
const n2 = v => (+v).toFixed(2) + "s";
// Bow, Wand and Staff have no RT in the sheet yet: estimated from the game's skill script (single-step skills), else T
const rotOf = sk => { const r = sk?.x?.rot; if (!(r && r.d[0] != null && r.t && r.cd)) return null; if (r.rt) return r;
  const own = timingOverride(sk); if (own) return {...r, rt: own.rt, cbt: own.cbt || 0};
  return ROT.useScript !== false && r.rtEst ? {...r, rt: r.rtEst, est: "script"} : {...r, rt: r.t, est: "t"}; };
const rotDmg = (r, mode) => r.d[mode] ?? r.d[0];

// the friend's "Weighted DPS" (cooldown-affected, spamming one skill); AB-AE are empty in the sheet, so it is computed
function rotWeighted(r, mode, cdMul){
  const D = rotDmg(r, mode), T = r.t, RT = r.rt, rCD = r.cd * cdMul, W = Math.pow(T / ((r.cbt || 0) + rCD), 0.8);
  if (rCD <= RT) return D / T;
  return T > RT ? D / ((RT + T) / 2) * W : D / T * W;
}
// one rotation in the given order
function rotCalc(list, mode, cdMul){
  let at = 0, dmg = 0;
  const rows = list.map((sk, i) => {
    const r = rotOf(sk), ch = i > 0 ? 0.5 : 1, T = r.t * ch, CBT = (r.cbt || 0) * ch, RT = r.rt * ch, rCD = r.cd * cdMul;
    const row = {sk, i, D: rotDmg(r, mode), T, CBT, RT, rCD, start: at, cdStart: at + CBT, ready: at + CBT + rCD, need: CBT + rCD};
    at += RT; dmg += row.D; return row;
  });
  const sumRT = at, maxNeed = Math.max(0, ...rows.map(x => x.need)), L = Math.max(sumRT, maxNeed);
  return {rows, sumRT, L, dmg, dps: L ? dmg / L : 0, idle: L - sumRT, limiter: maxNeed > sumRT ? rows.find(x => x.need == maxNeed) : null};
}
function rotPerms(a){ return a.length < 2 ? [a] : a.flatMap((x, i) => rotPerms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])); }
// best order; optionally the longest-cooldown skill must be first or last
function rotBest(list, mode, cdMul, edge){
  const maxCd = Math.max(...list.map(s => rotOf(s).cd));
  let best = null;
  for (const p of rotPerms(list)){
    if (edge && p.length > 1 && rotOf(p[0]).cd != maxCd && rotOf(p[p.length - 1]).cd != maxCd) continue;
    const c = rotCalc(p, mode, cdMul);
    if (!best || c.dps > best.c.dps + 1e-9) best = {p, c};
  }
  return best;
}
function rotCanAdd(list, sk){
  if (list.length >= 5 || list.includes(sk)) return false;
  const all = [...list, sk], a = all.filter(s => s.o == 0).length, b = all.filter(s => s.o == 1).length;
  return a <= 3 && b <= 2;
}
const rotList = () => (ROT.ids[ROT.cat] || []).map(id => SKBY[id]).filter(s => s && rotOf(s));

function viewRotation(){
  setCrumbs([["Tools"], ["Rotation DPS"]]);
  app.innerHTML = `${ph({title:"Rotation DPS", sub:"Build a 5-skill rotation (3 skills + 2 ougi) and see when each skill ends and comes back."})}
  <div class="rot-main">
    <aside class="card rot-side">
      <div class="seg sim-cats" id="rcat" role="group" aria-label="Weapon type">${Object.entries(CATS).map(([k, n]) => `<button data-c="${k}" class="${ROT.cat == k ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
      <input type="text" id="rq" placeholder="Filter skills…" aria-label="Filter skills">
      <div class="seg" id="rtab" role="group" aria-label="Skill type"><button data-t="s" class="${ROT.tab == "s" ? "on" : ""}">Skills</button><button data-t="o" class="${ROT.tab == "o" ? "on" : ""}">Ougi</button></div>
      <div class="rot-pick" id="rpick"></div>
    </aside>
    <div id="rout" class="rot-out"></div>
  </div>`;
  $$("#rcat button").forEach(b => b.onclick = () => { ROT.cat = +b.dataset.c; saveRot(); viewRotation(); });
  $$("#rtab button").forEach(b => b.onclick = () => { ROT.tab = b.dataset.t; $$("#rtab button").forEach(x => x.classList.toggle("on", x == b)); saveRot(); drawRotPick(); });
  $("#rq").oninput = drawRotPick;
  drawRotPick(); drawRot();
}
function drawRotPick(){
  const q = ($("#rq")?.value || "").trim().toLowerCase(), list = rotList(), cdMul = 1 - ROT.cut / 100;
  const rows = SKILLS.filter(s => s.c == ROT.cat && !s.b && rotOf(s) && (ROT.tab == "o" ? s.o > 0 : s.o != 1) && (!q || (s.n + " " + s.j).toLowerCase().includes(q)))
    .map(s => ({s, w: rotWeighted(rotOf(s), ROT.mode, cdMul)})).sort((a, b) => b.w - a.w);
  $("#rpick").innerHTML = rows.map(({s, w}) => { const on = list.includes(s), can = on || rotCanAdd(list, s), r = rotOf(s);
    return `<button class="rp ${on ? "on" : ""}" data-rp="${s.id}" ${can ? "" : "disabled"} aria-pressed="${on}" title="T ${r.t}s · RT ${r.rt}s${r.cbt ? ` · CBT ${r.cbt}s` : ""} · CD ${r.cd}s"><span>${esc(s.n)}</span><em>${w.toFixed(1)}M</em><b>${on ? "✓" : "+"}</b></button>`; }).join("") || emptyState("No skills", "Nothing with complete timing data.");
  $$("[data-rp]").forEach(b => b.onclick = () => { const id = +b.dataset.rp, cur = ROT.ids[ROT.cat] || []; ROT.ids[ROT.cat] = cur.includes(id) ? cur.filter(x => x != id) : [...cur, id]; saveRot(); drawRotPick(); drawRot(); });
}
function drawRot(){
  const out = $("#rout"), list = rotList(), cdMul = 1 - ROT.cut / 100;
  const controls = `<div class="rot-ctl">
    <div class="seg" id="rmode" role="group" aria-label="Damage column">${ROT_MODES.map((m, i) => `<button data-m="${i}" class="${ROT.mode == i ? "on" : ""}">${m}</button>`).join("")}</div>
    <label>Cooldown cut <input type="number" id="rcut" min="0" max="95" value="${ROT.cut}">%</label>
    <label>Cycles <select id="rcyc">${[1, 2, 3, 4].map(n => `<option ${ROT.cycles == n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
  </div>`;
  if (!list.length){ out.innerHTML = `<section class="card">${controls}<div class="sim-empty">Add up to 3 skills and 2 ougi from the list. The first skill never gets the skill chain; every other one has T, CBT and RT cut in half.</div></section>`; bindRot(list); return; }
  const c = rotCalc(list, ROT.mode, cdMul), best = rotBest(list, ROT.mode, cdMul, ROT.edgeCd), maxCd = Math.max(...list.map(s => rotOf(s).cd));
  const edgeOk = list.length < 2 || rotOf(list[0]).cd == maxCd || rotOf(list[list.length - 1]).cd == maxCd;
  const span = Math.max(c.L * ROT.cycles, ...c.rows.map(x => x.ready + c.L * (ROT.cycles - 1))), pc = v => (v / span * 100).toFixed(3) + "%";
  const ticks = Array.from({length: 6}, (_, i) => `<span style="left:${i * 20}%">${(span * i / 5).toFixed(1)}s</span>`).join("");
  const lanes = c.rows.map(x => { let bars = "";
    for (let k = 0; k < ROT.cycles; k++){ const o = k * c.L;
      bars += `<i class="tb cd" style="left:${pc(o + x.cdStart)};width:${pc(x.rCD)}" title="Cooldown ${n2(o + x.cdStart)} → ${n2(o + x.ready)}"></i>`
        + (x.T > x.RT ? `<i class="tb tail" style="left:${pc(o + x.start + x.RT)};width:${pc(x.T - x.RT)}" title="Last hit lands at ${n2(o + x.start + x.T)} (after you can cancel)"></i>` : "")
        + `<i class="tb cast" style="left:${pc(o + x.start)};width:${pc(x.RT)}" title="${esc(x.sk.n)}: ${n2(o + x.start)} → ${n2(o + x.start + x.RT)}"></i>`
        + (x.CBT ? `<i class="tb cbt" style="left:${pc(o + x.cdStart)}" title="CBT: cooldown starts at ${n2(o + x.cdStart)}"></i>` : ""); }
    return `<div class="tl-row" style="--c:${ROT_COLORS[x.i]}"><span>${x.i + 1}. ${esc(x.sk.n.replace(/^Ougi:? /, ""))}</span><div class="tl-track">${bars}</div></div>`; }).join("");
  const marks = Array.from({length: ROT.cycles + 1}, (_, k) => `<i style="left:${pc(k * c.L)}"></i>`).join("");
  const nEst = list.filter(s => rotOf(s).est).length; const nScript = list.filter(s => rotOf(s).est == "script").length;
  out.innerHTML = `<section class="card">${controls}
    ${nEst ? `<div class="covnote"><b>Estimate.</b> ${nEst} of these skills ha${nEst > 1 ? "ve" : "s"} no RT or CBT in the sheet. ${nScript} use${nScript == 1 ? "s" : ""} the RT read from the game's skill script, ${nEst - nScript} use${nEst - nScript == 1 ? "s" : ""} T.
      <label class="chk rot-est"><input type="checkbox" id="ruse" ${ROT.useScript !== false ? "checked" : ""}> use game script RT</label></div>` : ""}
    <div class="rot-slots">${c.rows.map(x => `<div class="rs" style="--c:${ROT_COLORS[x.i]}"><div class="rs-t"><b>${x.i + 1}</b><span>${esc(x.sk.n.replace(/^Ougi:? /, ""))}</span>${x.sk.o ? "<em>OUGI</em>" : ""}</div>
      <div class="rs-b"><button data-mv="${x.i}|-1" ${x.i ? "" : "disabled"} aria-label="Move earlier">←</button><button data-mv="${x.i}|1" ${x.i < c.rows.length - 1 ? "" : "disabled"} aria-label="Move later">→</button><button data-rm="${x.sk.id}" aria-label="Remove">✕</button></div></div>`).join("")}</div>
    <div class="sim-kpis">
      <div class="sim-kpi main"><span>Rotation DPS</span><b>${c.dps.toFixed(2)}M</b></div>
      <div class="sim-kpi"><span>Rotation time</span><b>${n2(c.L)}</b></div>
      <div class="sim-kpi"><span>Damage per rotation</span><b>${c.dmg.toFixed(2)}M</b></div>
      <div class="sim-kpi ${c.idle > 0.01 ? "warn" : ""}"><span>Waiting on cooldown</span><b>${n2(c.idle)}</b></div>
    </div>
    <div class="rot-note">${c.limiter ? `Limited by <b>${esc(c.limiter.sk.n)}</b>: its cooldown needs ${n2(c.limiter.need)}, the casts take ${n2(c.sumRT)}.` : `Limited by the casts: all cooldowns are back before the rotation ends (${n2(c.sumRT)}).`}
      ${edgeOk ? "" : ` <span class="bad">The longest-cooldown skill is not first or last.</span>`}
      ${best && best.c.dps > c.dps + 1e-6 ? `<button class="btn sm" id="rbest">Use best order (+${((best.c.dps / c.dps - 1) * 100).toFixed(1)}%)</button>` : `<span class="ok">Best order for this rule ✓</span>`}
      <label class="chk"><input type="checkbox" id="redge" ${ROT.edgeCd ? "checked" : ""}> keep longest cooldown first or last</label></div>
  </section>
  <section class="card"><div class="sim-head"><h3>Timeline</h3><div class="tl-legend"><span><i class="cast"></i>Cast (until RT)</span><span><i class="tail"></i>Until last hit (T)</span><span><i class="cd"></i>Cooldown</span><span><i class="cbt"></i>CBT</span></div></div>
    <div class="rot-tl"><div class="tl-marks">${marks}</div>${lanes}<div class="tl-axis"><div>${ticks}</div></div></div></section>
  <section class="card"><div class="wrap"><table class="tbl"><thead><tr><th>#</th><th>Skill</th><th class="r">Damage</th><th class="r">T</th><th class="r">CBT</th><th class="r">RT</th><th class="r">rCD</th><th class="r">Starts</th><th class="r">Ready at</th><th class="r"><span class="tip" title="Cooldown-affected DPS if you spammed only this skill (computed with ikzki's formula)">Weighted</span></th></tr></thead><tbody>
    ${c.rows.map(x => `<tr><td>${x.i + 1}${x.i ? "" : ` <span class="mute" title="The first skill gets no skill chain">full</span>`}</td><td class="name"><a href="#/skill/${x.sk.id}">${esc(x.sk.n)}</a></td><td class="r num">${x.D.toFixed(2)}M</td><td class="r num">${n2(x.T)}</td><td class="r num">${x.CBT ? n2(x.CBT) : "—"}</td><td class="r num">${rotOf(x.sk).est ? `<span title="${rotOf(x.sk).est == "script" ? "No RT in the sheet: read from the game script" : "No RT in the sheet: using T"}">≈</span>` : ""}${n2(x.RT)}</td><td class="r num">${n2(x.rCD)}</td><td class="r num">${n2(x.start)}</td><td class="r num">${n2(x.ready)}</td><td class="r num">${rotWeighted(rotOf(x.sk), ROT.mode, cdMul).toFixed(2)}M</td></tr>`).join("")}
  </tbody></table></div>
  ${sheetCredit()}<details class="note sim-how"><summary>How it is calculated</summary>Skill 1 keeps its full T, CBT and RT; skills 2–5 have them halved by the skill chain. Each skill starts at the previous skill's RT. rCD = cooldown × (1 − cooldown cut), starting at the skill start or at CBT for combo skills. Rotation time = max(sum of RT, longest CBT + rCD). Rotation DPS = total damage ÷ rotation time. Damage, T, CBT, RT and cooldown come unchanged from ikzki's Onigiri Skill Database. The rotation rules and the Weighted DPS formula were proposed by ikzki.</details></section>`;
  bindRot(list, best);
}
function bindRot(list, best){
  const re = () => { saveRot(); drawRotPick(); drawRot(); };
  $$("#rmode button").forEach(b => b.onclick = () => { ROT.mode = +b.dataset.m; re(); });
  $("#rcut").onchange = e => { ROT.cut = Math.max(0, Math.min(95, +e.target.value || 0)); re(); };
  $("#rcyc").onchange = e => { ROT.cycles = +e.target.value; re(); };
  if ($("#ruse")) $("#ruse").onchange = e => { ROT.useScript = e.target.checked; re(); };
  if ($("#redge")) $("#redge").onchange = e => { ROT.edgeCd = e.target.checked; re(); };
  if ($("#rbest")) $("#rbest").onclick = () => { ROT.ids[ROT.cat] = best.p.map(s => s.id); re(); };
  $$("[data-rm]").forEach(b => b.onclick = () => { ROT.ids[ROT.cat] = list.map(s => s.id).filter(id => id != b.dataset.rm); re(); });
  $$("[data-mv]").forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split("|").map(Number), a = list.map(s => s.id); [a[i], a[i + d]] = [a[i + d], a[i]]; ROT.ids[ROT.cat] = a; re(); });
}
