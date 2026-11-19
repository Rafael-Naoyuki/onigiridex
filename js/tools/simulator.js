"use strict";
/* OnigiriDex — Boss Simulator (views) */
// ---------------------------------------------------------------- helpers
function ruleText(o){
  if (o.p == "SecondaryStatusFixed"){ const names = {0:"HP",1:"SP",2:"ATK",12:"crit rate",13:"crit damage",18:"cooldown cut"}; return `${names[o.statusType] || "stat " + o.statusType} fixed at ${fmt(o.fixedValue)}${o.statusType == 12 || o.statusType == 13 || o.statusType == 18 ? "%" : ""}`; }
  if (o.p == "Fixed" && (o.type == 67 || o.type == 68)) return o.type == 67 ? "no HP regen" : "no SP regen";
  return o.p ? o.p.replace(/([a-z])([A-Z])/g, "$1 $2") : "";
}
const SIM_COLORS = ["#e2563b","#6fa8ff","#5cc8a1","#e8c26a","#b48cff","#f08a5d","#7fd3ff","#c98b4f","#ff9fc7","#9fe36b"];
const SIM_SLOTS = 10;
// Skill Force shown as a range when it comes per rank from the Build Planner
function simSfText(linked){
  if (!linked) return SIM.sf + "%";
  const v = (SIM.fromBuild.sfRank || []).filter(x => x != null);
  if (!v.length) return "per rank";
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo == hi ? lo + "%" : `${lo}–${hi}%`;
}
// open/closed state of the left panel sections survives re-renders
const simSecOpen = (k, def) => SIM.secs && k in SIM.secs ? SIM.secs[k] : def;
const simSec = (k, title, def, body, extra = "") => `<details class="sim-sec" data-sec="${k}" ${simSecOpen(k, def) ? "open" : ""}><summary><span>${title}</span>${extra}</summary><div class="sim-sec-b">${body}</div></details>`;

// dungeon -> difficulty -> monster picker for the simulator target
function dungeonTargetPicker(){
  const pd = SIM.pickDun; if (!pd) return "";
  const d = DUNBY[pd.did]; if (!d) return "";
  const diff = d.L[pd.diff] ? pd.diff : d.L.findIndex(Boolean);
  const L = d.L[diff];
  const mons = dungeonFloors(d, diff, S.party).flatMap(fl => fl.mons).filter((m, i, a) => a.findIndex(x => x.eid == m.eid && x.vname == m.vname) == i)
    .sort((a, b) => (b.boss || 0) - (a.boss || 0) || b.v[1] - a.v[1]).slice(0, 12);
  return `<div class="dpick">
    <div class="kv"><b>${esc(d.n)}</b><button class="linkbtn" id="pclose" aria-label="Close dungeon picker">close</button></div>
    <div class="seg" style="margin:6px 0">${d.L.map((L2, i) => L2 ? `<button class="${i == diff ? "on" : ""}" data-pdiff="${i}">${DIFFS[i]} ${L2.lv > 0 ? L2.lv : ""}</button>` : "").join("")}</div>
    ${L.rules?.length ? `<div class="rules">${L.rules.map(ruleText).filter(Boolean).join(" · ")}</div>` : ""}
    <div class="dmons">${mons.map(m => `<button class="dmon ${SIM.tgt.eid == m.eid && SIM.tgt.vname == m.vname && SIM.tgt.diff == diff && SIM.tgt.did == d.id ? "on" : ""}" data-pmon="${m.eid}|${esc(m.vname)}">
      <span>${esc(m.e.n)} ${m.boss ? `<span class="badge b-boss">BOSS</span>` : ""}</span><span class="mute">Lv ${m.v[0]} · ${fmtM(m.v[1])} HP</span></button>`).join("") || `<div class="mute">No monsters.</div>`}</div>
  </div>`;
}

// ---------------------------------------------------------------- page
function viewSim(){
  const tg = targetStats();
  const FX = tg.fix || {};
  const effCri = FX[12] != null ? FX[12] : SIM.cri, effCrd = FX[13] != null ? FX[13] : SIM.crd;
  const linked = SIM.useBuild && SIM.fromBuild;
  const cap = MAX_DMG + (linked ? SIM.fromBuild.extraCap || 0 : 0) + capBuffSum(capList(SIM));
  const isDummy = tg.eid == null;

  const targetBody = `
    <div class="picker"><input type="text" id="tq" placeholder="Search a dungeon or monster…" aria-label="Search a dungeon or monster" autocomplete="off"><div class="sugg" id="tsugg"></div></div>
    ${SIM.pickDun ? dungeonTargetPicker() : `<div class="hint">Pick a dungeon to choose the difficulty (Oni included) and its boss.</div>`}
    ${!isDummy ? `<label class="sim-f"><span>Monster version</span>
        <select id="tvar">${Object.keys(E[tg.eid].v).sort((a,b)=>E[tg.eid].v[a][0]-E[tg.eid].v[b][0]).map(nm => `<option value="${esc(nm)}" ${nm==tg.vname?"selected":""}>Lv ${E[tg.eid].v[nm][0]} · ${esc(describeVar(nm))}</option>`).join("")}</select></label>
        <div class="sim-btns"><a class="btn sm" href="#/monster/${tg.eid}?v=${encodeURIComponent(tg.vname)}">Monster page</a><button class="btn sm" id="toDummy">Use test dummy</button></div>` : `
        <div class="sim-grid2">
          <label class="sim-f"><span>HP</span><input type="number" data-dm="hp" value="${SIM.dummy.hp}" step="1000000"></label>
          <label class="sim-f"><span>Defense</span><input type="number" data-dm="def" value="${SIM.dummy.def}"></label>
          <label class="sim-f"><span>Resist (all elem.)</span><input type="number" data-dm="res" value="${SIM.dummy.res}"></label>
          <label class="sim-f"><span>Crit res.</span><input type="number" data-dm="crc" value="${SIM.dummy.crc}"></label>
          <label class="sim-f"><span>Multi-hit cut</span><input type="number" data-dm="mhc" value="${SIM.dummy.mhc}"></label>
        </div>`}`;

  const buildBody = `
    ${linked ? `<div class="sim-link"><div><b>${esc(SIM.fromBuild.name || "Build")}</b><span class="mute">from the Build Planner${SIM.fromBuild.onHit?.length ? ` · ${SIM.fromBuild.onHit.length} bonus-damage effect(s)` : ""}</span></div>
        <div class="sim-btns"><a class="btn sm" href="#/build">Edit</a><button class="btn sm" id="unlink">Use manual values</button></div></div>`
      : `<div class="hint">Tip: make your build in the <a href="#/build">Build Planner</a> and press “Simulate vs boss” to fill everything in.</div>`}
    <div class="seg sim-cats" id="catSeg" role="group" aria-label="Weapon type">${Object.entries(CATS).map(([k,n]) => `<button data-c="${k}" class="${SIM.cat==k?"on":""}" aria-pressed="${SIM.cat==k}">${esc(n)}</button>`).join("")}</div>
    <div class="sim-grid2">
      <label class="sim-f"><span title="Average of your min/max attack">Attack</span><input type="number" data-b="atk" value="${SIM.atk}" step="1000"></label>
      <label class="sim-f"><span title="Skill Force % for this weapon type (cap 500)">Skill Force %</span>${linked ? `<input type="text" value="${esc(simSfText(true))} (by rank)" disabled>` : `<input type="number" data-b="sf" value="${SIM.sf}" min="0" max="500">`}</label>
      <label class="sim-f"><span>Crit rate %</span><input type="number" data-b="cri" value="${SIM.cri}" min="0" max="100"></label>
      <label class="sim-f"><span>Crit damage %</span><input type="number" data-b="crd" value="${SIM.crd}" min="100"></label>
      <label class="sim-f"><span title="80 means cooldowns are 20% of the base">Cooldown cut %</span><input type="number" data-b="cdc" value="${SIM.cdc}" min="0" max="95"></label>
      <label class="sim-f"><span>Skill level</span><select data-b="lvMax"><option value="1" ${SIM.lvMax?"selected":""}>Max (mastered)</option><option value="0" ${!SIM.lvMax?"selected":""}>Lv 1</option></select></label>
    </div>`;

  const capBody = `<div class="hint">Every buff switched on counts as always active and they add up like in the game. Ougi in your rotation also give their buff for 20s after being cast.</div>
    ${capBuffPicker("data-scap", capList(SIM), SIM.loadout)}`;

  const elemBody = `<div class="elgrid">${ATTRS.slice(0,13).map((a,i) => `<label style="color:${ATTR_COLORS[i]}">${a[0]}<input type="number" data-el="${i}" value="${SIM.el[i]||0}"></label>`).join("")}</div>
    <div class="sim-btns"><input type="number" id="elAll" placeholder="set all" aria-label="Value for all elements" style="width:90px"><button class="btn sm" id="elAllBtn">Apply to all</button></div>
    <div class="sim-grid2">
      <label class="sim-f"><span title="Applied per hit as chance × min(hit, limit)">Bonus dmg chance %</span><input type="number" data-b="bdaP" value="${SIM.bdaP}" min="0" max="100"></label>
      <label class="sim-f"><span>Bonus dmg limit</span><input type="number" data-b="bdaL" value="${SIM.bdaL}" min="0" step="100000"></label>
    </div>`;

  app.innerHTML = `
  <div class="bp-top sim-top">
    <div class="bp-title"><h1>Boss Simulator <span class="badge b-wip">WIP</span></h1>
      <details class="sim-wip"><summary>Uses the game's damage formula and the community spreadsheet's hit data. Still being tuned — what's not modeled yet?</summary>
        <div>Kill time splits the boss HP between the players in the party and uses basic combos while skills are on cooldown. Buffs, partners, debuffs, movement and boss invulnerability phases are not modeled yet. Use it mainly to compare skills and builds.</div></details></div>
    <div class="bp-actions">
      <a class="btn" href="#/build">Build Planner</a>
      <button class="btn" id="presetSheet" title="150k ATK, 500 SF, 250 element, 100% crit, 300% crit damage vs a dummy with 50 res and 90 crit res">Spreadsheet test build</button>
    </div>
  </div>
  <div class="sim-vs">
    <div class="sim-who foe">
      <div class="vs-k">Target</div>
      <div class="vs-name">${esc(tg.name)}</div>
      <div class="vs-sub">${esc(tg.sub)}</div>
      <div class="sim-pills">
        <span><i>HP</i><b>${fmtM(tg.hp)}</b></span><span><i>DEF</i><b>${fmtM(tg.def)}</b></span>
        <span><i>Multi-hit cut</i><b>${tg.mhc}</b></span><span><i>Crit res.</i><b>${tg.crc}</b></span>
        ${tg.atkCut ? `<span><i>ATK cut</i><b>${fmtM(tg.atkCut)}</b></span>` : ""}
      </div>
      <div class="sim-res">${resStrip(tg.res, tg.cov)}</div>${tg.cov ? `<div class="covnote">${covBadge()} Only skills with <b>2+ elements</b> do full damage here; one element = 10%. Already included in the numbers below.</div>` : ""}
      ${tg.rules && tg.rules.length ? `<div class="rules">${tg.rules.map(ruleText).filter(Boolean).join(" · ")}${tg.timeLimit ? ` · ${Math.round(tg.timeLimit/60)} min limit` : ""}</div>` : ""}
    </div>
    <div class="sim-vs-mid" aria-hidden="true">VS</div>
    <div class="sim-who me">
      <div class="vs-k">You · ${linked ? `<a href="#/build">${esc(SIM.fromBuild.name || "build")}</a>` : "manual values"}</div>
      <div class="vs-name">${esc(CATS[SIM.cat] || "")}</div>
      <div class="vs-sub">${linked ? `ATK ${fmt(SIM.fromBuild.minAtk)} – ${fmt(SIM.fromBuild.maxAtk)}` : `ATK ${fmt(SIM.atk)}`}</div>
      <div class="sim-pills">
        <span><i>ATK used</i><b>${fmtM(SIM.atk)}</b></span><span><i>Skill Force</i><b>${simSfText(linked)}</b></span>
        <span><i>Crit</i><b class="${FX[12] != null ? "bad" : ""}">${effCri}%</b></span><span><i>Crit dmg</i><b>${effCrd}%</b></span>
        <span><i>CT cut</i><b>${SIM.cdc}%</b></span><span title="Per hit"><i>Damage cap</i><b>${fmt(cap)}</b></span>
      </div>
      ${FX[12] != null ? `<div class="rules">Crit is fixed to ${FX[12]}% in this dungeon level.</div>` : ""}
    </div>
  </div>
  <div class="sim-main">
    <aside class="sim-side" id="buildPanel">
      ${simSec("tgt", "Target", true, targetBody, `<span class="mute">${esc(isDummy ? "Test dummy" : tg.name)}</span>`)}
      ${simSec("you", "Your build", true, buildBody, `<span class="mute">${esc(CATS[SIM.cat] || "")}</span>`)}
      ${simSec("cap", "Damage cap buffs", capList(SIM).length > 0, capBody, capList(SIM).length ? `<span class="pos">+${fmtM(capBuffSum(capList(SIM)))}</span>` : "")}
      ${simSec("elem", "Elements & bonus damage", false, elemBody)}
    </aside>
    <div id="simOut" class="sim-out"></div>
  </div>`;
  bindSimPanel();
  drawSimResults();
}

function bindSimPanel(){
  $$(".sim-sec").forEach(d => d.ontoggle = () => { SIM.secs = Object.assign({}, SIM.secs, {[d.dataset.sec]: d.open}); saveSim(); });
  $$("#catSeg button").forEach(b => b.onclick = () => { SIM.cat = +b.dataset.c; if (SIM.fromBuild && SIM.cat != SIM.fromBuild.cat) SIM.useBuild = false; saveSim(); viewSim(); });
  $$("[data-b]").forEach(inp => inp.oninput = () => {
    const k = inp.dataset.b; SIM[k] = k == "lvMax" ? inp.value == "1" : +inp.value; saveSim();
    clearTimeout(bindSimPanel.t); bindSimPanel.t = setTimeout(drawSimResults, 200);
  });
  $$("[data-scap]").forEach(b => b.onclick = () => { const id = +b.dataset.scap, l = capList(SIM); SIM.capBuffs = l.includes(id) ? l.filter(x => x != id) : [...l, id]; delete SIM.capBuff; saveSim(); viewSim(); });
  $$("[data-el]").forEach(inp => inp.oninput = () => { SIM.el[+inp.dataset.el] = +inp.value; saveSim(); clearTimeout(bindSimPanel.t); bindSimPanel.t = setTimeout(drawSimResults, 200); });
  $("#elAllBtn").onclick = () => { const v = +$("#elAll").value; for (let i = 0; i < 11; i++) SIM.el[i] = v; saveSim(); viewSim(); };
  $$("[data-dm]").forEach(inp => inp.oninput = () => { SIM.dummy[inp.dataset.dm] = +inp.value; saveSim(); clearTimeout(bindSimPanel.t); bindSimPanel.t = setTimeout(() => viewSim(), 400); });
  if ($("#toDummy")) $("#toDummy").onclick = () => { SIM.tgt = {t:"dummy"}; saveSim(); viewSim(); };
  if ($("#unlink")) $("#unlink").onclick = () => { SIM.useBuild = false; saveSim(); viewSim(); };
  if ($("#tvar")) $("#tvar").onchange = e => { SIM.tgt.vname = e.target.value; delete SIM.tgt.did; delete SIM.tgt.diff; saveSim(); viewSim(); };
  $$("[data-pdiff]").forEach(b => b.onclick = () => { SIM.pickDun.diff = +b.dataset.pdiff; saveSim(); viewSim(); });
  $$("[data-pmon]").forEach(b => b.onclick = () => { const [eid, vn] = b.dataset.pmon.split("|"); SIM.tgt = {t:"enemy", eid:+eid, vname:vn, did:SIM.pickDun.did, diff:SIM.pickDun.diff}; saveSim(); viewSim(); });
  if ($("#pclose")) $("#pclose").onclick = () => { SIM.pickDun = null; saveSim(); viewSim(); };
  $("#presetSheet").onclick = () => {
    Object.assign(SIM, {atk:150000, sf:500, cri:100, crd:300, cdc:0, lvMax:true, bdaP:0, bdaL:0, el:[250,250,250,250,250,250,250,250,250,250,250,0,0], tgt:{t:"dummy"}, dummy:{res:50, def:0, crc:90, mhc:0, hp:100000000, cav:0}});
    saveSim(); viewSim();
  };
  // target search: dungeons first, then monsters
  const tq = $("#tq"), box = $("#tsugg");
  tq.oninput = () => {
    const q = tq.value.trim().toLowerCase();
    if (q.length < 2){ box.classList.remove("show"); return; }
    const dres = DUN.filter(d => isPlayable(d) && (d.n+" "+d.j).toLowerCase().includes(q)).slice(0, 10);
    const res = Object.entries(E).filter(([id,e]) => e.used && (e.n+" "+e.j).toLowerCase().includes(q)).slice(0, 10);
    box.innerHTML = dres.map(d => `<a data-td="${d.id}"><span><b>${esc(d.n)}</b> <span class="jp">${esc(d.j)}</span></span><span class="tag">Dungeon · ${d.L.map((L,i)=>L?DIFFS[i][0]:"").join("")}</span></a>`).join("")
      + res.map(([id,e]) => `<a data-t="${id}"><span><b>${esc(e.n)}</b> <span class="jp">${esc(e.j)}</span></span><span class="tag">Monster · ${Object.keys(e.v).length} versions</span></a>`).join("") || `<div class="empty" style="padding:12px">Nothing found</div>`;
    box.classList.add("show");
    box.querySelectorAll("[data-td]").forEach(a => a.onclick = () => { const d = DUNBY[a.dataset.td]; SIM.pickDun = {did:d.id, diff: d.L[S.diff] ? S.diff : d.L.findIndex(Boolean)}; saveSim(); viewSim(); });
    box.querySelectorAll("[data-t]").forEach(a => a.onclick = () => {
      const e = E[a.dataset.t]; const names = Object.keys(e.v);
      const vn = names.find(n => n.endsWith("_" + S.diff + "_" + S.party)) || names.sort((x,y) => e.v[y][0] - e.v[x][0])[0];
      SIM.tgt = {t:"enemy", eid:+a.dataset.t, vname:vn}; saveSim(); viewSim();
    });
  };
}

// ---------------------------------------------------------------- results
function drawSimResults(){
  const out = $("#simOut"); if (!out) return;
  const tg = targetStats();
  const sks = SKILLS.filter(s => s.c == SIM.cat && !s.b);
  const res = sks.map(sk => ({sk, r: calcSkill(sk, tg, SIM)}));
  const q = (SIM.q||"").toLowerCase();
  let list = res.filter(x => (!q || (x.sk.n+" "+x.sk.j).toLowerCase().includes(q)) && (SIM.ougi < 0 || (SIM.ougi == 1 ? x.sk.o > 0 : x.sk.o == 0)) && (SIM.elem < 0 || x.sk.a.some(([a]) => a == SIM.elem)) && (!SIM.measuredOnly || x.r.measured));
  const sorters = {sdps:(a,b)=>b.r.sustained-a.r.sustained, bdps:(a,b)=>b.r.burst-a.r.burst, dmg:(a,b)=>b.r.total-a.r.total, cd:(a,b)=>a.r.cd-b.r.cd, n:(a,b)=>a.sk.n.localeCompare(b.sk.n)};
  list.sort(sorters[SIM.sort] || sorters.sdps);
  const maxS = Math.max(1, ...list.map(x => x.r.sustained));
  const loadout = SIM.loadout.filter(id => SKBY[id] && SKBY[id].c == SIM.cat);
  const players = simPlayers(tg, SIM);
  const rot = loadout.length ? simulateRotation(loadout, tg, SIM, 3600, players) : null;
  if (rot) rot.solo = players > 1 ? simulateRotation(loadout, tg, SIM, 3600, 1) : rot;
  const basics = basicSkills(SIM.cat), fsk = simFiller(SIM);
  const elemsUsed = [...new Set(sks.flatMap(s => s.a.map(a => a[0])))];
  const colorOf = new Map(loadout.map((id, i) => [id, SIM_COLORS[i % SIM_COLORS.length]]));
  const full = loadout.length >= SIM_SLOTS;
  const sortTh = (k, label, tip, cls = "r") => `<th class="${cls} s" data-s="${k}" aria-sort="${SIM.sort == k ? "descending" : "none"}">${tip ? `<span class="tip" title="${tip}">${label}</span>` : label}</th>`;

  out.innerHTML = `
  <section class="card sim-rot">
    <div class="sim-head">
      <h3>Rotation</h3>
      <div class="sim-head-ctl">
        <label><span class="tip" title="Boss HP is scaled for the party size. The fight is split evenly: each player is assumed to deal the same DPS as you.">Players</span>
          <select id="splayers"><option value="0">Auto (${simPlayers(tg, {})})</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${+SIM.players==n?"selected":""}>${n}</option>`).join("")}</select></label>
        <label><span class="tip" title="Basic combo used while all skills are on cooldown (no hit data: 1 hit, ${(+SIM.defaultTime).toFixed(1)}s per combo)">Filler</span>
          <select id="sfiller"><option value="0" ${SIM.filler===0?"selected":""}>None (wait)</option>${basics.map(s => `<option value="${s.id}" ${fsk && fsk.id==s.id?"selected":""}>${esc(s.n)} (${s.p1}%)</option>`).join("")}</select></label>
        ${loadout.length ? `<button class="btn sm" id="clearLoad">Clear</button>` : ""}
      </div>
    </div>
    ${loadout.length ? `<div class="sim-slots" aria-label="Skills in the rotation">${loadout.map((id, i) => { const sk = SKBY[id];
      return `<button class="sim-slot on" data-unpick="${id}" style="--c:${colorOf.get(id)}" title="Remove ${esc(sk.n)}"><i>${i + 1}</i><span>${esc(sk.n.replace(/^Ougi /, ""))}</span>${sk.o ? `<em>OUGI</em>` : ""}<b aria-hidden="true">✕</b></button>`; }).join("")}
      ${full ? "" : `<button class="sim-slot add" id="toList"><i>+</i><span class="mute">${loadout.length}/${SIM_SLOTS} · add from the list</span></button>`}</div>` : ""}
    ${rot ? rotationView(rot, colorOf) : `<div class="sim-empty">Press <b>+ Add</b> on the skills you have on your weapon (up to ${SIM_SLOTS}) to simulate a fight against ${esc(tg.name)}.</div>`}
  </section>

  <section class="card sim-list">
    <div class="sim-head">
      <h3>Skills <span class="mute">${list.length}</span></h3>
      <div class="sim-head-ctl">
        <input type="text" id="sq" placeholder="Filter skills…" aria-label="Filter skills" value="${esc(SIM.q||"")}">
        <select id="sougi" aria-label="Skill type"><option value="-1">Skills + Ougi</option><option value="0" ${SIM.ougi==0?"selected":""}>Skills only</option><option value="1" ${SIM.ougi==1?"selected":""}>Ougi only</option></select>
        <select id="selem" aria-label="Element"><option value="-1">Any element</option>${elemsUsed.sort((a,b)=>a-b).map(i => `<option value="${i}" ${SIM.elem==i?"selected":""}>${ATTRS[i][0]}</option>`).join("")}</select>
        <label class="chk"><input type="checkbox" id="smeas" ${SIM.measuredOnly?"checked":""}> measured hit data only</label>
      </div>
    </div>
    <div class="wrap sim-tblwrap"><table class="tbl sim-tbl" id="stbl"><thead><tr>
      <th class="c"></th>${sortTh("n", "Skill", "", "")}<th>Elements</th><th class="r">Hits</th>${sortTh("dmg", "Dmg / cast")}<th class="r">Cast</th>${sortTh("cd", "Cooldown")}
      ${sortTh("bdps", "Burst DPS", "Damage ÷ cast time (spamming with no cooldown)")}${sortTh("sdps", "Sustained", "Damage ÷ max(cast time, cooldown) — if you only used this skill")}<th class="r"><span class="tip" title="Casts of this skill alone to kill the target">Casts</span></th></tr></thead><tbody>
      ${list.slice(0, 200).map(({sk, r}) => { const inRot = loadout.includes(sk.id); return `<tr class="${inRot ? "picked" : ""}" ${inRot ? `style="--c:${colorOf.get(sk.id)}"` : ""}>
        <td class="c"><button class="addbtn ${inRot ? "on" : ""}" data-pick="${sk.id}" ${!inRot && full ? "disabled" : ""} aria-pressed="${inRot}" title="${inRot ? "Remove from rotation" : full ? "Rotation is full" : "Add to rotation"}">${inRot ? "✓" : "+ Add"}</button></td>
        <td class="name"><a href="#/skill/${sk.id}"><b>${esc(sk.n)}</b></a> ${sk.o?`<span class="badge b-ougi">${sk.o==2?"SKILL/OUGI":"OUGI"}</span>`:""} ${tg.cov && r.covF <= 0.1 ? `<span class="badge b-cov1" title="Covenant: this skill has one usable element, so it deals only 10%">×0.1</span> ` : ""}${r.measured?"":`<span class="badge b-est" title="No hit data in the spreadsheet: assumed 1 hit at 100% and ${SIM.defaultTime}s cast">≈</span>`}${sk.x?.rDmg?` <span class="chip" title="Community damage rating">${esc(sk.x.rDmg)}</span>`:""}<div class="jp">${esc(sk.j)}</div></td>
        <td>${skillAttrChips(sk.a)}</td><td class="r num">${r.hits.length}</td><td class="r num"><b>${fmtM(r.total)}</b></td>
        <td class="r num">${r.time ? r.time.toFixed(2)+"s" : `<span class="mute">${(+SIM.defaultTime).toFixed(1)}s?</span>`}</td><td class="r num">${r.cd.toFixed(1)}s</td>
        <td class="r num">${fmtM(r.burst)}</td><td class="r sim-sus"><b class="num">${fmtM(r.sustained)}</b><div class="bar"><i style="width:${(r.sustained/maxS*100).toFixed(1)}%"></i></div></td>
        <td class="r num">${isFinite(r.casts)?fmt(r.casts):"immune"}</td></tr>`; }).join("") || `<tr><td colspan="10" class="empty">No skills match.</td></tr>`}
    </tbody></table></div>
    ${list.length > 200 ? `<div class="mute" style="margin-top:6px">Showing 200 of ${list.length}. Use the filters to narrow it down.</div>` : ""}
  </section>
  <details class="note sim-how"><summary>How the damage is computed</summary>Per hit, in the same order as the server: <code>ATK − ATK cut</code> → multi-hit cut <code>ATK ÷ (hit# × MHC% + 1)</code> blended by the skill's MHC rate → defense curve → × hit rate × skill power × (1 + Skill Force%) → × Σ element% × (1 + your element%) × (1 − boss resist%) → expected critical (crit damage reduced by crit res.) → capped at ${fmtM(MAX_DMG)} per hit. Checked against the spreadsheet's measured damage: median error ≈ 0%, typical spread ≈ 6%.</details>`;

  $$("#stbl th.s").forEach(th => { th.classList.toggle("sorted", th.dataset.s == SIM.sort); th.onclick = () => { SIM.sort = th.dataset.s; saveSim(); drawSimResults(); }; });
  $$("[data-pick]").forEach(c => c.onclick = () => {
    const id = +c.dataset.pick;
    if (SIM.loadout.includes(id)) SIM.loadout = SIM.loadout.filter(x => x != id);
    else { if (loadout.length >= SIM_SLOTS) return; SIM.loadout = [...new Set([...SIM.loadout, id])]; }
    saveSim(); drawSimResults();
  });
  $$("[data-unpick]").forEach(c => c.onclick = () => { SIM.loadout = SIM.loadout.filter(x => x != c.dataset.unpick); saveSim(); drawSimResults(); });
  if ($("#toList")) $("#toList").onclick = () => { $(".sim-list").scrollIntoView({behavior: "smooth", block: "start"}); setTimeout(() => $("#sq")?.focus({preventScroll: true}), 350); };
  if ($("#clearLoad")) $("#clearLoad").onclick = () => { SIM.loadout = SIM.loadout.filter(id => SKBY[id]?.c != SIM.cat); saveSim(); drawSimResults(); };
  $("#sq").oninput = e => { SIM.q = e.target.value; saveSim(); clearTimeout(drawSimResults.t); drawSimResults.t = setTimeout(() => { drawSimResults(); const i = $("#sq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $("#sougi").onchange = e => { SIM.ougi = +e.target.value; saveSim(); drawSimResults(); };
  $("#selem").onchange = e => { SIM.elem = +e.target.value; saveSim(); drawSimResults(); };
  $("#splayers").onchange = e => { SIM.players = +e.target.value; saveSim(); drawSimResults(); };
  $("#sfiller").onchange = e => { SIM.filler = +e.target.value; saveSim(); drawSimResults(); };
  $("#smeas").onchange = e => { SIM.measuredOnly = e.target.checked; saveSim(); drawSimResults(); };
}

function rotationView(rot, colorOf){
  const col = s => s.filler ? "var(--faint)" : colorOf.get(s.sk.id) || "#777";
  const total = rot.timeline.reduce((a, x) => a + x.d, 0) || 1;
  const ticks = [0, .25, .5, .75, 1].map(f => `<span style="left:${f * 100}%">${fmtS(total * f)}</span>`).join("");
  const rows = rot.sks.slice().sort((a, b) => b.dmg - a.dmg);
  const share = s => s.dmg / Math.max(rot.dealt, 1) * 100;
  return `<div class="sim-kpis">
      <div class="sim-kpi main"><span class="tip" title="Boss HP split between ${rot.share} player(s) with your DPS (WIP)">Kill time · party of ${rot.share}</span><b>${rot.time != null ? fmtS(rot.time) : "> " + fmtS(rot.limit)}</b></div>
      ${rot.share > 1 ? `<div class="sim-kpi"><span class="tip" title="Only you hitting the full boss HP">Kill time · solo</span><b>${rot.solo.time != null ? fmtS(rot.solo.time) : "> " + fmtS(rot.solo.limit)}</b></div>` : ""}
      <div class="sim-kpi"><span>Your average DPS</span><b>${fmtM(rot.dps)}</b></div>
      <div class="sim-kpi ${rot.idle > 0.5 ? "warn" : ""}"><span class="tip" title="Time spent waiting because everything was on cooldown (pick a filler to use basic attacks instead)">Idle</span><b>${fmtS(rot.idle)}</b></div>
    </div>
    <div class="sim-tl"><div class="tl" role="img" aria-label="Fight timeline">${rot.timeline.slice(0, 400).map(x => `<i style="width:${(x.d/total*100).toFixed(3)}%;background:${x.idle ? "transparent" : col(rot.sks.find(s => s.sk.id == x.sk.id) || {sk: x.sk})}" title="${x.idle ? "waiting" : esc(x.sk.n)} @ ${x.t.toFixed(1)}s"></i>`).join("")}</div>
      <div class="sim-ticks">${ticks}</div></div>
    <table class="sim-share"><thead><tr><th>Skill</th><th class="r">Casts</th><th>Share of damage</th><th class="r">Damage</th></tr></thead><tbody>
      ${rows.map(s => `<tr><td><i class="dot" style="background:${col(s)}"></i>${esc(s.sk.n)}${s.filler ? ` <span class="mute">(filler ≈)</span>` : ""}</td>
        <td class="r num">${s.filler ? fmtS(s.casts * s.r.castT) : s.casts + "×"}</td>
        <td><div class="sharebar"><i style="width:${share(s).toFixed(1)}%;background:${col(s)}"></i></div><span class="num">${share(s).toFixed(0)}%</span></td>
        <td class="r num">${fmtM(s.dmg)}</td></tr>`).join("")}
    </tbody></table>
    <div class="hint">${rot.hasBuff ? `Damage-limit ougi in the rotation is cast first and raises the cap for its duration (active ${fmtS(rot.buffTime)} of the fight). ` : ""}Greedy rotation: always casts the ready skill with the most damage per second of animation, basic combo while everything is on cooldown.</div>`;
}
