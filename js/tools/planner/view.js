"use strict";
/* OnigiriDex — planner layout, drawer, item browser, events, link to the simulator */
// ---------------------------------------------------------------- item browser (modal)
const CAT_ICON = {};
function catIcon(c){
  if (CAT_ICON[c] !== undefined) return CAT_ICON[c];
  const base = ["sword","sword_l","sword_w","spear","axe","bow","staff","wand"][c];
  const name = ICONS[base] ? base : (BDB.weapons.find(w => w.c == c && ICONS[w.ic])?.ic || null);
  return CAT_ICON[c] = name;
}
function pickerModal(){
  const P = UI.pick; if (!P) return "";
  const isW = P.t == "w", kind = !isW && P.i >= 4 ? 26 : 9;
  const title = isW ? `Weapon ${P.i + 1}` : kind == 9 ? `Magatama ${P.i + 1}` : `Accessory ${P.i - 3}`;
  return `<div class="modal-bg" id="pkbg"><div class="modal">
    <div class="modal-h"><b>Choose · ${title}</b><button class="xbtn" id="pkclose">✕</button></div>
    ${isW ? `<div class="cattabs"><button data-pkc="-1" class="${P.cat < 0 ? "on" : ""}">All</button>${Object.entries(CATS).map(([c, n]) => `<button data-pkc="${c}" class="${P.cat == c ? "on" : ""}">${catIcon(+c) ? iconOf(catIcon(+c)) : ""}${esc(n)}</button>`).join("")}</div>` : ""}
    <div class="cattabs elf"><button data-pke="-1" class="${P.el == null || P.el < 0 ? "on" : ""}">Any element</button>${[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => `<button data-pke="${i}" class="${P.el == i ? "on" : ""}"><span class="elb" style="--ec:${ATTR_COLORS[i]}">${ATTRS[i][1]}</span>${ATTRS[i][0]}</button>`).join("")}</div>
    <div class="pkf"><input type="text" id="pkq" placeholder="Search by name or effect…" value="${esc(P.q || "")}" autocomplete="off">
      <select id="pksort"><option value="lv" ${P.sort=="lv"?"selected":""}>Level</option><option value="name" ${P.sort=="name"?"selected":""}>Name</option>${isW ? `<option value="atk" ${P.sort=="atk"?"selected":""}>ATK</option>` : `<option value="cost" ${P.sort=="cost"?"selected":""}>Cost</option>`}</select>
      <label><input type="checkbox" id="pklv" ${UI.lvOk ? "checked" : ""}> up to Lv ${BUILD.lv}</label></div>
    <div class="pklist" id="pklist"></div>
  </div></div>`;
}
const wAtkMax = x => BuildCalc.weaponAttack(x, 100, x.enh ? BuildCalc.enhanceCap(x, 0) : 0, 0, BDB.smelt);
function drawPickList(){
  const P = UI.pick, box = $("#pklist"); if (!P || !box) return;
  const isW = P.t == "w", kind = !isW && P.i >= 4 ? 26 : 9;
  const q = (P.q || "").toLowerCase();
  const txt = x => (x.n + " " + x.j + " " + (q.length > 2 ? x.o.map(o => optText(o).replace(/<[^>]+>/g, "")).join(" ") : "")).toLowerCase();
  let list = isW ? BDB.weapons.filter(x => P.cat < 0 || x.c == P.cat) : BDB.crys.filter(x => x.k == kind);
  if (UI.lvOk) list = list.filter(x => x.lv <= BUILD.lv);
  if (q) list = list.filter(x => txt(x).includes(q));
  if (P.el >= 0) list = list.filter(x => itemElems(x).includes(P.el));
  const pop = n => POPULAR_ORN.some(p => n.toLowerCase().startsWith(p));
  const sorters = {lv: (a, b) => b.lv - a.lv || a.n.localeCompare(b.n), name: (a, b) => a.n.localeCompare(b.n),
    atk: (a, b) => wAtkMax(b).max - wAtkMax(a).max, cost: (a, b) => b.cost - a.cost};
  list.sort(sorters[P.sort] || sorters.lv);
  const curId = isW ? BUILD.weapons[P.i]?.id : BUILD.crys[P.i]?.id;
  box.innerHTML = list.slice(0, 150).map(x => {
    const a = isW ? wAtkMax(x) : null;
    const prev = x.o.slice(0, 3).map(o => `<li class="${optClass(o)}">${optText(o)}</li>`).join("");
    return `<button class="pkrow ${x.id == curId ? "cur" : ""}" data-pkid="${x.id}">
      ${iconOf(x.ic)}<span class="nm"><b class="rk-${x.r}">${elemBadge(x)}${esc(x.n)}</b><span class="jp">${esc(x.j)}</span>${prev ? `<ul class="optl">${prev}${x.o.length > 3 ? `<li class="neu">+${x.o.length - 3} more</li>` : ""}</ul>` : ""}</span>
      <span class="meta">${isW ? `<span class="chip">${esc(CATS[x.c])}</span>` : `<span class="chip">cost ${x.cost}</span>${x.sl ? `<span class="chip" title="Ornament slots">◇${x.sl}</span>` : ""}`}<span class="chip">Lv ${x.lv}</span>
        ${isW ? `<b class="num">${fmt(a.min)}–${fmt(a.max)}</b>` : `<b class="num" title="P.DEF / M.DEF">${fmt(x.pd)} / ${fmt(x.md)}</b>`}</span></button>`;
  }).join("") + (list.length > 150 ? `<div class="mute" style="padding:8px 12px">Showing 150 of ${list.length} — type to narrow down.</div>` : "") || `<div class="empty" style="padding:16px">Nothing found.</div>`;
  box.querySelectorAll("[data-pkid]").forEach(b => b.onclick = () => {
    const id = +b.dataset.pkid;
    if (isW){
      const x = WBY[id], old = BUILD.weapons[P.i];
      BUILD.weapons[P.i] = {id, grade:100, smelt: x.enh ? BDB.smelt.length : 0, enh: x.enh ? BuildCalc.enhanceCap(x, BDB.smelt.length) : 0, extra:[],
        skills: old && WBY[old.id]?.c == x.c ? old.skills : (x.sk || []).slice(0, SKILL_SLOTS), ougi: old && WBY[old.id]?.c == x.c ? old.ougi : (x.ek || []).slice(0, OUGI_SLOTS)};
      if (!BUILD.weapons[BUILD.active]) BUILD.active = P.i;
      UI.drawer = {t:"w", i:P.i}; UI.skp = null;
    } else {
      BUILD.crys[P.i] = {k:kind, id, grade:100, extra:[], cost:0, orn:[]};
      UI.drawer = {t:"c", i:P.i};
    }
    UI.pick = null; saveUI(); saveBuild(); viewBuild();
  });
}

// =====================================================================
// Build Planner v8 — clean layout
//   summary bar · [character | equipment | details tabs] · editor drawer
// =====================================================================
const STAT_GAME = ["Pow","Vit","Wis","Mnd","Dex"];
const DTABS = [["fx","Effects"],["stats","Stats"],["elem","Elements"],["sf","Skill Force"],["wp","Affinity"]];
const buildCaps = () => buildOugi().filter(id => SKBY[id].dl);
const buildOugi = () => [...new Set(BUILD.weapons.flatMap(w => w ? (w.ougi || []) : []).filter(id => SKBY[id]))];

// ---------------------------------------------------------------- equipment cards
function weaponCard(wi){
  const W = BUILD.weapons[wi], x = W ? WBY[W.id] : null;
  if (!x) return `<button class="eqc empty wrow" data-pk="w|${wi}"><span class="plus">+</span><span>Add weapon ${wi + 1}</span></button>`;
  const act = wi == BUILD.active, open = UI.drawer?.t == "w" && UI.drawer.i == wi;
  const a = BuildCalc.weaponAttack(x, W.grade, W.enh, W.smelt, BDB.smelt);
  const sk = (W.skills || []).filter(id => SKBY[id]), og = (W.ougi || []).filter(id => SKBY[id]);
  const skChip = (id, o) => `<span class="skc ${o ? "o" : ""} ${SKBY[id].dl ? "cap" : ""}" title="${esc(SKBY[id].n)}">${esc(SKBY[id].n.replace(/^Ougi:? /, ""))}</span>`;
  return `<div class="eqc w ${act ? "act" : ""} ${open ? "open" : ""}" data-open="w|${wi}" title="Click to edit · double-click to make it the active weapon">
    <div class="eqc-top row">
      <button class="star ${act ? "on" : ""}" data-act="${wi}" title="${act ? "Active weapon: its stats count" : "Make this the active weapon"}" aria-label="${act ? "Active weapon" : "Set as active weapon"}">${act ? "★" : "☆"}</button>
      <span class="eqc-ico">${iconOf(x.ic)}</span>
      <div class="eqc-nm"><b class="rk-${x.r}" title="${esc(x.n)}">${esc(x.n)}</b><small>${elemBadge(x)}${esc(CATS[x.c])} · Lv ${x.lv}${x.enh ? ` · +${W.enh || 0}` : ""}${W.smelt ? ` · S${W.smelt}` : ""}</small></div>
      <div class="eqc-sk">${sk.length || og.length ? sk.map(id => skChip(id, false)).join("") + og.map(id => skChip(id, true)).join("") : `<span class="mute">No skills chosen</span>`}</div>
      <div class="eqc-val"><b>${fmt(Math.round((a.min + a.max) / 2))}</b><small>ATK</small></div>
    </div>
  </div>`;
}
function crysCard(i, r){
  const c = BUILD.crys[i], kind = i >= 4 ? 26 : 9, set = c ? CBY[kind + ":" + c.id] : null;
  const label = kind == 9 ? `Magatama ${i + 1}` : `Accessory ${i - 3}`;
  if (!set) return `<button class="eqc empty sm wrow" data-pk="c|${i}"><span class="plus">+</span><span>${label}</span></button>`;
  const st = r.slots.find(s => s.slot == i), off = st && !st.active, open = UI.drawer?.t == "c" && UI.drawer.i == i;
  const orn = (c.orn || []).filter(os => os && OBY[os.id]).length;
  const prev = set.o.slice(0, 3).map(o => `<span class="${optClass(o)}">${optText(Object.assign({}, o, {if: null}))}</span>`).join("");
  return `<div class="eqc c ${off ? "off" : ""} ${open ? "open" : ""}" data-open="c|${i}" title="Click to edit">
    <div class="eqc-top row">
      <span class="eqc-ico">${iconOf(set.ic)}</span>
      <div class="eqc-nm"><b class="rk-${set.r}" title="${esc(set.n)}">${esc(set.n)}</b><small>${elemBadge(set)}Lv ${set.lv}${set.sl ? ` · ${"◆".repeat(orn)}${"◇".repeat(Math.max(0, set.sl - orn))}` : ""}${off ? ` · <span class="bad">no capacity</span>` : ""}</small></div>
      <div class="eqc-prev">${prev}${set.o.length > 3 ? `<span class="pmore">+${set.o.length - 3} more</span>` : ""}</div>
      <div class="eqc-val"><b>${st ? st.cost : set.cost}</b><small>cost</small></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- editor drawer
function drawerHtml(r){
  const D = UI.drawer; if (!D) return "";
  let body = "", title = "";
  if (D.t == "w"){
    const wi = D.i, eW = BUILD.weapons[wi], ew = eW && WBY[eW.id]; if (!ew) return "";
    const smeltMax = BDB.smelt.length, enhCap = BuildCalc.enhanceCap(ew, eW.smelt);
    const a = BuildCalc.weaponAttack(ew, eW.grade, eW.enh, eW.smelt, BDB.smelt);
    title = `Weapon ${wi + 1}`;
    body = `
      <div class="dr-id">${iconOf(ew.ic)}<div><b class="rk-${ew.r}">${elemBadge(ew)}${esc(ew.n)}</b><div class="jp">${esc(ew.j)}</div>
        <div class="dr-meta">${rankBadge(ew.r)}<span class="chip">${esc(CATS[ew.c])}</span><span class="chip">Lv ${ew.lv}</span><span class="chip">ATK <b>${fmt(a.min)} – ${fmt(a.max)}</b></span></div></div></div>
      <div class="dr-actions">${wi == BUILD.active ? `<span class="badge b-elite">★ ACTIVE WEAPON</span>` : `<button class="btn sm" data-act="${wi}">☆ Make active</button>`}
        <button class="btn sm" data-pk="w|${wi}">Change weapon</button><button class="btn sm ghost" id="wclear">Unequip</button></div>
      <h4 class="dr-h">Upgrade</h4>
      <div class="dr-row">
        <label>Quality<input type="number" min="0" max="100" id="wgrade" value="${eW.grade ?? 100}"></label>
        ${ew.enh ? `<label>Refine<input type="number" min="0" max="${enhCap}" id="wenh" value="${eW.enh || 0}"></label>
        <label title="Over-refining: raises the refine cap and adds bonuses">Smelt<input type="number" min="0" max="${smeltMax}" id="wsmelt" value="${eW.smelt || 0}"></label>
        ${eW.smelt < smeltMax || eW.enh < enhCap ? `<button class="btn sm" id="wmax">Max</button>` : `<span class="chip ok">maxed</span>`}` : `<span class="mute">This weapon can't be refined.</span>`}
      </div>
      <h4 class="dr-h">Skills</h4>
      <div class="skgrid">${[0,1,2].map(k => skillSlotBtn(wi, "skill", k, (eW.skills || [])[k])).join("")}</div>
      <h4 class="dr-h">Ougi</h4>
      <div class="skgrid">${[0,1].map(k => skillSlotBtn(wi, "ougi", k, (eW.ougi || [])[k])).join("")}</div>
      <h4 class="dr-h">Effects ${eW.smelt ? `<span class="mute">(weapon + smelt ${eW.smelt}, ${ew.o.length + BDB.smelt.slice(0, eW.smelt).reduce((a, x) => a + x.o.length, 0)} lines)</span>` : ""} ${wi == BUILD.active ? "" : `<span class="mute">· only the active weapon's count</span>`}</h4>
      ${optList([...ew.o, ...BDB.smelt.slice(0, eW.smelt || 0).flatMap(sm => sm.o)], wi == BUILD.active)}
      ${extraEditor("w" + wi, eW.extra || [])}`;
  } else {
    const i = D.i, c = BUILD.crys[i]; if (!c) return "";
    const kind = i >= 4 ? 26 : 9, set = CBY[kind + ":" + c.id]; if (!set) return "";
    const st = r.slots.find(s => s.slot == i), off = st && !st.active;
    title = kind == 9 ? `Magatama ${i + 1}` : `Accessory ${i - 3}`;
    body = `
      <div class="dr-id">${iconOf(set.ic)}<div><b class="rk-${set.r}">${elemBadge(set)}${esc(set.n)}</b><div class="jp">${esc(set.j)}</div>
        <div class="dr-meta">${rankBadge(set.r)}<span class="chip">Lv ${set.lv}</span><span class="chip" title="${st && st.ornCost ? `${set.cost} + ornaments ${st.ornCost}` : ""}">Cost <b>${st ? st.cost : set.cost}</b></span>
        ${off ? `<span class="badge b-boss" title="Over the magatama capacity: gives nothing">NO CAPACITY</span>` : ""}</div></div></div>
      <div class="dr-actions"><button class="btn sm" data-pk="c|${i}">Change</button><button class="btn sm ghost" data-clear="${i}">Unequip</button></div>
      <div class="dr-row">
        <label>Quality<input type="number" min="0" max="100" value="${c.grade ?? 100}" data-cg="${i}"></label>
        <label title="Any other extra cost">Extra cost<input type="number" min="0" max="99" value="${c.cost || 0}" data-cc="${i}"></label>
      </div>
      <h4 class="dr-h">Effects</h4>
      ${optListShort(set.o, !off, 10)}
      ${kind == 9 ? ornamentBlock(i, c, set) : ""}
      ${extraEditor("c" + i, c.extra || [])}`;
  }
  return `<div class="drawer-bg" id="drbg"></div><aside class="drawer" role="dialog" aria-label="${esc(title)}">
    <div class="dr-head"><span class="ph-k">${esc(title)}</span><button class="xbtn" id="drclose" aria-label="Close editor" title="Close (Esc)">✕</button></div>
    <div class="dr-body">${body}</div></aside>
    ${D.t == "w" && UI.skp && UI.skp.w == D.i ? skillPickerPanel(WBY[BUILD.weapons[D.i].id].c) : ""}`;
}

// ---------------------------------------------------------------- details tabs
function detailsPanel(r){
  const sec = r.sec, cat = r.cat, tab = UI.dtab || "fx";
  let body = "";
  if (tab == "fx") body = effectPanel(r);
  else if (tab == "stats"){
    // in-game "Status Details" window: Status · Boost · Element (values at the game's limit in green)
    const LIM = {4:50, 13:300, 15:500, 16:500, 17:500, 18:80, 19:80, 20:85};
    const st = (k, i, unit = "", t = "") => { const v = sec[i] || 0, cap = LIM[i] != null && v >= LIM[i];
      return `<div class="gs-row" ${t ? `title="${esc(t)}"` : ""}><span>${k}</span><b class="${cap ? "cap" : v < 0 ? "neg" : "pos"}">${fmt(v)}${unit}</b>${LIM[i] != null ? `<i>max ${LIM[i]}</i>` : ""}</div>`; };
    const el = i => { const v = sec[ATTR_SEC[i]] || 0; return `<div class="gs-el ${v >= 250 ? "cap" : v > 0 ? "pos" : v < 0 ? "neg" : "zero"}" title="${ATTRS[i][0]} ${v}">${elemTag(i)}<b>${v}</b></div>`; };
    body = `<div class="gs">
      <div class="gs-col">
        <h4 class="gs-h">Status</h4>
        ${st("P. Atk Spd", 4)}${st("Critical Force", 13, "", "Critical damage %")}${st("HP Recovery", 16)}${st("SP Recovery", 17)}
        ${st("Cooldown Cut", 18)}${st("SP Reduction", 19)}${st("Movement Spd", 20)}${st("Rear Attack", 15)}
        <div class="gs-row" title="Bonus ATK on critical hits from DEX"><span>Crit bonus (DEX)</span><b class="pos">+${fmt(r.dexCrit)}</b></div>
        <h4 class="gs-h">Boost</h4>
        ${st("EXP Gain", 34)}${st("Ryou Gain", 35)}${st("Drop Gain", 36)}${st("Skill EXP", 37)}
      </div>
      <div class="gs-col el">
        <h4 class="gs-h">Element</h4>
        <div class="gs-els">${[3,4,5,6,7,8,9,10,11,12].map(el).join("")}</div>
        <div class="gs-els phys">${[0,1,2].map(el).join("")}</div>
      </div>
    </div>`;
  } else if (tab == "elem"){
    const ecell = i => { const v = sec[ATTR_SEC[i]] || 0, cap = v >= 250;
      const w = v >= 0 ? Math.min(v, 250) / 250 * 71.4 : Math.max(v, -100) / -100 * 28.6;
      return `<div class="ecell2 ${v > 0 ? "pos" : v < 0 ? "neg" : "zero"} ${cap ? "cap" : ""}" title="${ATTRS[i][0]} ${v > 0 ? "+" : ""}${v}% (limits −100 / +250)">
        ${elemTag(i)}<span class="en">${ATTRS[i][0]}</span><b>${v > 0 ? "+" : ""}${v}</b>
        <span class="ebar"><i style="${v >= 0 ? `left:28.6%;width:${w}%` : `left:${28.6 - w}%;width:${w}%`}"></i></span></div>`; };
    body = `<div class="esub">Physical</div><div class="egrid2">${[0,1,2].map(ecell).join("")}</div>
      <div class="esub">Elemental</div><div class="egrid2">${[3,4,5,6,7,8,9,10,11,12].map(ecell).join("")}</div>`;
  } else if (tab == "sf"){
    // in-game Skill Force window: every weapon type x rank 1-8 (500 = cap, shown in green)
    const cats = Object.keys(CATS).map(Number);
    body = `<div class="sfx-wrap"><table class="sfx"><thead><tr><th>Weapon type</th>${[1,2,3,4,5,6,7,8].map(k => `<th>R${k}</th>`).join("")}</tr></thead><tbody>
      ${cats.map(c => `<tr class="${c == cat ? "on" : ""}"><td>${catIcon(c) ? iconOf(catIcon(c)) : ""}${esc(CATS[c])}${c == cat ? ` <span class="badge b-elite">★</span>` : ""}</td>${[1,2,3,4,5,6,7,8].map(k => { const v = r.skillPow[c][k] || 0, cap = v >= 500;
        return `<td class="${cap ? "cap" : v ? "pos" : "zero"}" title="${esc(CATS[c])} rank ${k}: ${v}%${v > 500 ? " (capped at 500)" : ""}">${cap ? 500 : v}</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div>
      <div class="hint">Skill Force % by weapon type and skill rank (Sublime ougi = rank 8). Green = at the 500% cap. ★ = your active weapon.</div>`;
  } else if (tab == "wp"){
    body = `<div class="wpgrid">${Object.keys(CATS).map(c => { const v = r.wp[c], on = +c == cat;
      return `<div class="wpr ${on ? "on" : ""}" title="${esc(CATS[c])} affinity">${catIcon(+c) ? iconOf(catIcon(+c)) : ""}<span class="wpn">${esc(CATS[c])}</span><b class="${v >= r.wpLimit ? "ok" : ""}">${fmt(v)}</b></div>`; }).join("")}</div>
      <div class="hint">Max ${fmt(r.wpLimit)} at Lv ${r.lv}. The active weapon's type is highlighted.</div>`;
  }
  return `<section class="pnl dpanel">
    <div class="dtabs" role="tablist">${DTABS.map(([id, n]) => `<button role="tab" aria-selected="${tab == id}" class="${tab == id ? "on" : ""}" data-dtab="${id}">${n}</button>`).join("")}</div>
    <div class="dbody">${body}</div></section>`;
}

// ---------------------------------------------------------------- view
function viewBuild(){
  if (!BDB){ app.innerHTML = `<div class="empty">Build data missing — run File → Update game data.</div>`; return; }
  ensureFxTip();
  const r = calcBuild();
  const P = r.pers, sec = r.sec;
  if (UI.drawer && ((UI.drawer.t == "w" && !BUILD.weapons[UI.drawer.i]) || (UI.drawer.t == "c" && !BUILD.crys[UI.drawer.i]))) UI.drawer = null;
  if (UI.skp && !(UI.drawer?.t == "w" && UI.skp.w == UI.drawer.i)) UI.skp = null;
  if (UI.drawer?.t == "w") UI.editW = UI.drawer.i;
  const caps = buildCaps(), capSum = capBuffSum(caps);
  const dmgCap = MAX_DMG + r.extraDmgLimit + capSum;
  const ptsCls = r.ptsLeft < 0 ? "bad" : r.ptsLeft == 0 ? "" : "good";

  // status rows
  const statRows = STATS.map((s, i) => {
    const cur = P.base[i] + BUILD.alloc[i], atCap = cur >= STAT_CAP;
    const next = !atCap && cur + 1 < P.req.length ? P.req[cur + 1][i] - P.req[cur][i] : null;
    const cant = atCap || next > r.ptsLeft;
    return `<div class="st8">
      <span class="k" title="${STAT_LONG[i]}">${STAT_GAME[i]}</span>
      <button class="sb" data-st="${i}" data-d="-1" aria-label="${STAT_GAME[i]} −1">−</button>
      <input type="number" min="${P.base[i]}" max="${STAT_CAP}" value="${cur}" data-al="${i}" aria-label="${STAT_LONG[i]} points" title="Base ${P.base[i]} + ${BUILD.alloc[i]} allocated (max ${STAT_CAP})">
      <button class="sb" data-st="${i}" data-d="1" ${cant ? "disabled" : ""} aria-label="${STAT_GAME[i]} +1">+</button>
      <button class="sb mx" data-max="${i}" ${cant ? "disabled" : ""} title="As many as possible, up to ${STAT_CAP}">max</button>
      <span class="bonus" title="Level bonus + equipment">+${r.statusBonus[i]}</span>
      <b class="tot">${r.total[i]}</b>
      <span class="nx ${atCap ? "ok" : next > r.ptsLeft ? "bad" : ""}" title="Points for the next +1">${atCap ? "cap" : next}</span>
    </div>`;
  }).join("");

  const sets = BUILD.sets || [];
  const sum = (k, v, s = "", cls = "", tip = "") => `<div class="sm8 ${cls}" ${tip ? `title="${esc(tip)}"` : ""}><span>${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ""}</div>`;

  app.innerHTML = `<div class="bp8-page">
  <div class="ph bp8-head">
    <div><h1>Build Planner</h1><div class="sub">Exact game formulas, checked against the engine.</div></div>
    <div class="bp-actions">
      <input type="text" id="bname" value="${esc(BUILD.name || "")}" placeholder="Build name" aria-label="Build name">
      <select id="bload" aria-label="Load a saved build"><option value="">Load… (${Object.keys(SAVED).length})</option>${Object.keys(SAVED).sort().map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>
      <button class="btn" id="bsave">Save</button>
      <details class="menu"><summary class="btn" aria-label="More actions">More ▾</summary><div class="menu-list">
        <button id="bnew">New empty build</button><button id="bexport">Export (copy text)</button><button id="bimport">Import from text</button><button id="bdel" class="bad">Delete saved build</button></div></details>
      <button class="btn pri" id="bsim" ${r.weapon ? "" : "disabled"}>Simulate vs boss →</button>
    </div>
  </div>

  <div class="sum8">
    ${sum("Attack", fmt(sec[2]), r.weapon ? `${fmt(r.minAtk)} – ${fmt(r.maxAtk)}` : "no active weapon", "big")}
    ${sum("Max HP", fmt(sec[0]))}${sum("P. Def", fmt(sec[3]))}${sum("M. Def", fmt(sec[7]))}
    ${sum("Critical", sec[12] + "%")}${sum("Crit dmg", sec[13] + "%")}${sum("CT cut", sec[18] + "%")}
    ${sum("Damage cap", fmtM(dmgCap), capSum ? `incl. +${fmtM(capSum)} from ${caps.length} ougi` : "no cap ougi equipped", "cap",
        `${fmtM(MAX_DMG)} base + ${fmtM(r.extraDmgLimit)} gear${caps.map(id => ` + ${fmtM(SKBY[id].dl[0])} ${SKBY[id].n}`).join("")}`)}
    ${sum("Points left", fmt(r.ptsLeft), `of ${fmt(r.ptsTotal)}`, "pts " + ptsCls)}
    ${sum("Capacity", `${r.used}/${r.capacity}`, r.used > r.capacity ? "over capacity" : "magatama", r.used > r.capacity ? "pts bad" : "")}
  </div>

  <div class="bp8">
    <!-- character -->
    <div class="bp8-col">
      <section class="pnl">
        <h3 class="sect">Character</h3>
        <div class="f2">
          <label>Level<input type="number" id="blv" min="1" max="${BDB.cap}" value="${BUILD.lv}"></label>
          <label>Type<select id="bpers">${BDB.pers.map(p => `<option value="${p.id}" ${p.id == BUILD.pers ? "selected" : ""}>${esc(p.n)}</option>`).join("")}</select></label>
          <label title="+3 magatama capacity per level"><span>Nigimitama <i>(max 8)</i></span><input type="number" id="bnigi" min="0" max="8" value="${BUILD.nigi || 0}"></label>
          <label title="10 + Nigimitama quests Lv2-8"><span>Quest points <i>(max 260)</i></span><input type="number" id="bbonus" min="0" max="260" value="${BUILD.bonusPts || 0}"></label>
        </div>
        <label class="xsel" title="Succession (襲名) title: its bonuses count like equipment"><span>Succession</span>
          <select id="bsyu"><option value="">None</option>${SYU.slice().sort((a, b) => a.n.localeCompare(b.n)).map(x => `<option value="${x.id}" ${x.id == BUILD.syumei ? "selected" : ""}>${esc(x.n)} · ${esc(x.o.map(o => optText(o).replace(/<[^>]+>/g, "")).join(", ").slice(0, 70))}</option>`).join("")}</select></label>
        ${SYU_BY[BUILD.syumei] ? `<div class="xopts">${optList(SYU_BY[BUILD.syumei].o)}</div>` : ""}
        <label class="xsel" title="Sake buffs you drink (each one counts while active)"><span>Sake <i>(${buildSakes().length})</i></span>
          <select id="bsake"><option value="">+ Add a sake…</option>${SAKE.slice().sort((a, b) => a.n.localeCompare(b.n)).filter(x => !buildSakes().includes(x.id)).map(x => `<option value="${x.id}">${esc(x.n)} · ${esc(x.o.map(o => optText(o).replace(/<[^>]+>/g, "")).join(", ").slice(0, 70))}</option>`).join("")}</select></label>
        ${buildSakes().length ? `<div class="chips xchips">${buildSakes().map(id => `<span class="chip x" data-rmsake="${id}" title="${esc(SAKE_BY[id].o.map(o => optText(o).replace(/<[^>]+>/g, "")).join(" · "))}">${esc(SAKE_BY[id].n)} ✕</span>`).join("")}</div>` : ""}
      </section>
      <section class="pnl">
        <div class="kv"><h3 class="sect">Status points</h3><button class="btn sm ghost" id="breset">Reset</button></div>
        <div class="pts8 ${ptsCls}"><b>${fmt(r.ptsLeft)}</b><span>left of ${fmt(r.ptsTotal)}</span></div>
        <div class="capbar"><i style="width:${Math.min(100, r.spent / Math.max(1, r.ptsTotal) * 100)}%"></i></div>
        <div class="st8-list">${statRows}</div>
        <details class="grp"><summary>Manual stat bonus (titles etc.)</summary>
          <div class="f5">${STATS.map((s, i) => `<label>${STAT_GAME[i]}<input type="number" data-ex="${i}" value="${BUILD.extra[i] || 0}"></label>`).join("")}</div></details>
      </section>
    </div>

    <!-- equipment -->
    <div class="bp8-col main">
      <section class="pnl">
        <div class="kv eq8-h"><h3 class="sect">Equipment</h3>
          <div class="sets8"><span class="mute">Set</span>${Array.from({length: SET_N}, (_, n) => `<button data-set="${n}" class="${n == (BUILD.set | 0) ? "on" : ""} ${n != (BUILD.set | 0) && setFilled(sets[n]) ? "has" : ""}" aria-label="Equipment set ${n + 1}">${n + 1}</button>`).join("")}
            <details class="menu"><summary class="btn sm" aria-label="Set actions">⋯</summary><div class="menu-list">
              <button id="setcopy">Copy this set</button><button id="setpaste" ${SET_CLIP ? "" : "disabled"}>Paste set here</button><button id="setclear" class="bad">Unequip everything</button></div></details></div>
        </div>
        <div class="eq8-lbl">Weapons <span class="mute">★ = active weapon (its stats count; all 4 count for "N+ equipped")</span></div>
        <div class="eq8-w">${[0,1,2,3].map(weaponCard).join("")}</div>
        <div class="eq8-lbl">Magatama <span class="${r.used > r.capacity ? "bad" : "ok"}">${r.used} / ${r.capacity} capacity</span></div>
        <div class="eq8-w">${[0,1,2,3].map(i => crysCard(i, r)).join("")}</div>
        <div class="eq8-lbl">Accessories</div>
        <div class="eq8-w">${[4,5].map(i => crysCard(i, r)).join("")}</div>
      </section>
    </div>

    <!-- details -->
    <div class="bp8-col side">${detailsPanel(r)}</div>
  </div></div>
  ${drawerHtml(r)}
  ${pickerModal()}`;
  bindBuild(r);
}

// ---------------------------------------------------------------- events
function bindBuild(r){
  const re = () => { saveBuild(); saveUI(); const y = window.scrollY, dy = $(".dr-body")?.scrollTop; viewBuild(); window.scrollTo(0, y); if (dy && $(".dr-body")) $(".dr-body").scrollTop = dy; };
  let t; const later = () => { saveBuild(); clearTimeout(t); t = setTimeout(re, 350); };
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el[ev] = fn; };
  const P = r.pers;
  // character + status
  on("#blv", "oninput", e => { BUILD.lv = Math.max(1, Math.min(BDB.cap, +e.target.value || 1)); later(); });
  on("#bpers", "onchange", e => { BUILD.pers = +e.target.value; re(); });
  on("#bnigi", "oninput", e => { BUILD.nigi = Math.max(0, Math.min(NIGI_MAX, +e.target.value || 0)); later(); });
  on("#bbonus", "oninput", e => { BUILD.bonusPts = Math.max(0, Math.min(QUEST_PTS_MAX, +e.target.value || 0)); later(); });
  const capOf = i => STAT_CAP - P.base[i];
  const addPoints = (i, n) => { let left = r.ptsLeft;
    for (let k = 0; k < n; k++){ const cur = P.base[i] + BUILD.alloc[i]; if (cur >= STAT_CAP || cur + 1 >= P.req.length) break;
      const cost = P.req[cur + 1][i] - P.req[cur][i]; if (cost > left) break; left -= cost; BUILD.alloc[i]++; } };
  $$("[data-al]").forEach(inp => inp.oninput = () => { const i = +inp.dataset.al; BUILD.alloc[i] = Math.max(0, Math.min(capOf(i), (+inp.value || 0) - P.base[i])); later(); });
  $$("[data-st]").forEach(b => b.onclick = () => { const i = +b.dataset.st, d = +b.dataset.d; if (d < 0) BUILD.alloc[i] = Math.max(0, BUILD.alloc[i] + d); else addPoints(i, d); re(); });
  $$("[data-max]").forEach(b => b.onclick = () => { addPoints(+b.dataset.max, 999); re(); });
  $$("[data-ex]").forEach(inp => inp.oninput = () => { BUILD.extra[+inp.dataset.ex] = +inp.value || 0; later(); });
  on("#breset", "onclick", () => { BUILD.alloc = [0,0,0,0,0]; re(); });
  on("#bsyu", "onchange", e => { BUILD.syumei = e.target.value ? +e.target.value : null; re(); });
  on("#bsake", "onchange", e => { if (!e.target.value) return; BUILD.sakes = [...buildSakes(), +e.target.value]; re(); });
  $$("[data-rmsake]").forEach(c => c.onclick = () => { BUILD.sakes = buildSakes().filter(id => id != c.dataset.rmsake); re(); });
  // situation (effects tab)
  on("#chp", "oninput", e => { BUILD.cond.hpPct = +e.target.value; later(); });
  on("#csp", "oninput", e => { BUILD.cond.spPct = +e.target.value; later(); });
  on("#cpois", "onchange", e => { BUILD.cond.poison = e.target.value == "1"; re(); });
  on("#cstig", "onchange", e => { BUILD.cond.stigma = +e.target.value; re(); });
  on("#cdrunk", "oninput", e => { BUILD.cond.drunk = e.target.value === "" ? null : +e.target.value; later(); });
  on("#sealToggle", "onclick", () => { const ws = weaponSeal(); if (!ws) return; BUILD.cond.stigma = BUILD.cond.stigma == ws.v ? 0 : ws.v; re(); });
  $$("[data-ctest]").forEach(b => b.onclick = () => { Object.assign(BUILD.cond, FXCONDS[+b.dataset.ctest]); re(); });
  on("#creset", "onclick", () => { Object.assign(BUILD.cond, {hpPct:100, spPct:100, poison:false, stigma:0, drunk:null}); re(); });
  $$("[data-fxm]").forEach(b => b.onclick = () => { UI.fxMode = b.dataset.fxm; re(); });
  $$("[data-fxo]").forEach(b => b.onclick = () => { UI.fxOpen ||= {}; const g = b.dataset.fxo; UI.fxOpen[g] = !UI.fxOpen[g]; re(); });
  $$("[data-fxg]").forEach(b => b.onclick = () => { UI.fxClosed ||= {}; const g = b.dataset.fxg; UI.fxClosed[g] = !UI.fxClosed[g]; re(); });
  $$("[data-dtab]").forEach(b => b.onclick = () => { UI.dtab = b.dataset.dtab; re(); });
  // equipment cards
  $$("[data-open]").forEach(el => {
    el.onclick = ev => { if (ev.target.closest("button")) return; const [tp, i] = el.dataset.open.split("|"); UI.drawer = {t:tp, i:+i}; UI.skp = null; re(); };
    if (el.dataset.open[0] == "w") el.ondblclick = ev => { if (ev.target.closest("button")) return; BUILD.active = +el.dataset.open.split("|")[1]; re(); };
  });
  $$("[data-act]").forEach(b => b.onclick = ev => { ev.stopPropagation(); BUILD.active = +b.dataset.act; re(); });
  $$("[data-pk]").forEach(el => el.onclick = ev => { ev.stopPropagation(); const [tp, i] = el.dataset.pk.split("|"); const W = tp == "w" ? BUILD.weapons[+i] : null;
    UI.pick = {t:tp, i:+i, q:"", sort: (UI.pick && UI.pick.sort) || "lv", cat: W ? WBY[W.id]?.c ?? -1 : (r.cat >= 0 && tp == "w" ? r.cat : -1)}; re(); });
  // sets
  $$("[data-set]").forEach(b => b.onclick = () => { switchSet(+b.dataset.set); UI.drawer = null; UI.skp = null; re(); });
  on("#setcopy", "onclick", () => { SET_CLIP = JSON.parse(JSON.stringify({weapons:BUILD.weapons, active:BUILD.active, crys:BUILD.crys})); re(); });
  on("#setpaste", "onclick", () => { if (!SET_CLIP) return; const c = JSON.parse(JSON.stringify(SET_CLIP)); BUILD.weapons = c.weapons; BUILD.active = c.active; BUILD.crys = c.crys; syncSet(); re(); });
  on("#setclear", "onclick", () => { if (!confirm(`Unequip everything in set ${(BUILD.set | 0) + 1}?`)) return; BUILD.weapons = [null,null,null,null]; BUILD.active = 0; BUILD.crys = [null,null,null,null,null,null]; UI.drawer = null; syncSet(); re(); });
  // cap buffs
  // drawer
  const closeDrawer = () => { UI.drawer = null; UI.skp = null; re(); };
  on("#drclose", "onclick", closeDrawer);
  on("#drbg", "onclick", closeDrawer);
  if (!bindBuild.esc){ bindBuild.esc = true; document.addEventListener("keydown", e => {
    if (e.key == "Escape" && location.hash.startsWith("#/build") && UI.drawer && !UI.pick){ UI.drawer = null; UI.skp = null; saveUI(); viewBuild(); } }); }
  const eW = UI.drawer?.t == "w" ? BUILD.weapons[UI.drawer.i] : null;
  on("#wclear", "onclick", () => { const wi = UI.drawer.i; BUILD.weapons[wi] = null; if (BUILD.active == wi) BUILD.active = Math.max(0, BUILD.weapons.findIndex(Boolean)); UI.drawer = null; re(); });
  if (eW){
    on("#wgrade", "oninput", e => { eW.grade = Math.max(0, Math.min(100, +e.target.value)); later(); });
    on("#wenh", "oninput", e => { eW.enh = Math.max(0, +e.target.value); later(); });
    on("#wsmelt", "oninput", e => { eW.smelt = Math.max(0, Math.min(BDB.smelt.length, +e.target.value)); eW.enh = Math.min(eW.enh, BuildCalc.enhanceCap(WBY[eW.id], eW.smelt)); later(); });
    on("#wmax", "onclick", () => { maxWeapon(eW); re(); });
  }
  $$("[data-skp]").forEach(b => b.onclick = () => { const [w, kind, k] = b.dataset.skp.split("|");
    const same = UI.skp && UI.skp.w == +w && UI.skp.kind == kind && UI.skp.k == +k;
    UI.skp = same ? null : Object.assign({sort:"rating", el:null, rk:null, q:"", meas:false}, UI.skp || {}, {w:+w, kind, k:+k}); re(); });
  $$("[data-skx]").forEach(b => b.onclick = () => { const [w, kind, k] = b.dataset.skx.split("|"); const W = BUILD.weapons[+w]; if (!W) return;
    const arr = kind == "ougi" ? (W.ougi ||= []) : (W.skills ||= []); arr[+k] = null; re(); });
  if (UI.skp && $("#sklist")){
    const cat = WBY[BUILD.weapons[UI.skp.w]?.id]?.c;
    drawSkillList(cat);
    on("#skq", "oninput", e => { UI.skp.q = e.target.value; saveUI(); drawSkillList(cat); });
    on("#sksort", "onchange", e => { UI.skp.sort = e.target.value; saveUI(); drawSkillList(cat); });
    on("#skmeas", "onchange", e => { UI.skp.meas = e.target.checked; saveUI(); drawSkillList(cat); });
    $$("[data-skel]").forEach(c => c.onclick = () => { UI.skp.el = c.dataset.skel === "" ? null : +c.dataset.skel; re(); });
    $$("[data-skrk]").forEach(c => c.onclick = () => { UI.skp.rk = c.dataset.skrk === "" ? null : +c.dataset.skrk; re(); });
    $$("[data-skclose]").forEach(a => a.onclick = () => { UI.skp = null; re(); });
    $$("[data-skcap]").forEach(b => b.onclick = () => { UI.skp.cap = b.dataset.skcap == "1"; re(); });
  }
  // magatama / accessories (drawer)
  $$("[data-clear]").forEach(b => b.onclick = () => { BUILD.crys[+b.dataset.clear] = null; UI.drawer = null; re(); });
  $$("[data-cg]").forEach(inp => inp.oninput = () => { BUILD.crys[+inp.dataset.cg].grade = Math.max(0, Math.min(100, +inp.value)); later(); });
  $$("[data-cc]").forEach(inp => inp.oninput = () => { BUILD.crys[+inp.dataset.cc].cost = Math.max(0, +inp.value || 0); later(); });
  $$("[data-orn]").forEach(sel => sel.onchange = () => { const [i, k] = sel.dataset.orn.split("|").map(Number); const c = BUILD.crys[i]; c.orn ||= []; c.orn[k] = sel.value ? {id:+sel.value} : null; re(); });
  $$("[data-oon]").forEach(cb => cb.onchange = () => { const [i, k, j] = cb.dataset.oon.split("|").map(Number); const os = BUILD.crys[i].orn[k]; const O = OBY[os.id];
    os.on = BuildCalc.ornamentOn(O, os).slice(); os.on[j] = cb.checked; re(); });
  $$("[data-oval]").forEach(inp => inp.oninput = () => { const [i, k, j] = inp.dataset.oval.split("|").map(Number); const os = BUILD.crys[i].orn[k]; os.val ||= []; os.val[j] = inp.value === "" ? null : +inp.value; later(); });
  // rolled options
  $$(".xadd").forEach(row => {
    fillExtraSelect(row);
    row.querySelector(".xt").onchange = () => fillExtraSelect(row);
    row.querySelector(".xok").onclick = () => {
      const tp = row.querySelector(".xt").value, sv = row.querySelector(".xs").value, v = +row.querySelector(".xv").value;
      if (!v) return;
      let o;
      if (tp == "s") o = {t:"s", s:+sv, v, g:0}; else if (tp == "sp") o = {t:"s", s:+sv, v, g:1}; else if (tp == "b") o = {t:"b", s:+sv, v};
      else if (tp == "k"){ const [c, rk] = sv.split("|"); o = {t:"k", w:+c, r:+rk, m:-1, v}; } else o = {t:"w", w:+sv, v};
      const list = extraTarget(row.dataset.key); if (!list) return; list.push(o); re();
    };
  });
  $$("[data-xdel]").forEach(a => a.onclick = () => { const [key, k] = a.dataset.xdel.split("|"); const list = extraTarget(key); if (list){ list.splice(+k, 1); re(); } });
  // item browser
  if (UI.pick){
    drawPickList();
    const close = () => { UI.pick = null; re(); };
    on("#pkclose", "onclick", close);
    on("#pkbg", "onclick", e => { if (e.target.id == "pkbg") close(); });
    const q = $("#pkq"); if (q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length);
      q.oninput = () => { UI.pick.q = q.value; clearTimeout(bindBuild.t); bindBuild.t = setTimeout(drawPickList, 120); }; }
    on("#pksort", "onchange", e => { UI.pick.sort = e.target.value; drawPickList(); });
    on("#pklv", "onchange", e => { UI.lvOk = e.target.checked; saveUI(); drawPickList(); });
    $$("[data-pke]").forEach(b => b.onclick = () => { UI.pick.el = +b.dataset.pke; re(); });
    $$("[data-pkc]").forEach(b => b.onclick = () => { UI.pick.cat = +b.dataset.pkc; re(); });
  }
  // save / load / share
  on("#bname", "oninput", e => { BUILD.name = e.target.value; saveBuild(); });
  on("#bsave", "onclick", () => { const n = (BUILD.name || "My build").trim(); SAVED[n] = JSON.parse(JSON.stringify(BUILD)); try { localStorage.setItem("od2-builds", JSON.stringify(SAVED)); } catch(e){} re(); });
  on("#bload", "onchange", e => { const n = e.target.value; if (n && SAVED[n]){ BUILD = normalizeBuild(JSON.parse(JSON.stringify(SAVED[n]))); UI.drawer = null; re(); } });
  on("#bdel", "onclick", () => { const n = BUILD.name; if (SAVED[n] && confirm(`Delete saved build "${n}"?`)){ delete SAVED[n]; try { localStorage.setItem("od2-builds", JSON.stringify(SAVED)); } catch(e){} re(); } else if (!SAVED[n]) alert(`No saved build named "${n}". Load it first, then delete.`); });
  on("#bnew", "onclick", () => { if (confirm("Start a new empty build? (unsaved changes are lost)")){ BUILD = DEFAULT_BUILD(); UI.drawer = null; re(); } });
  on("#bexport", "onclick", async () => {
    const txt = "ODX1:" + btoa(unescape(encodeURIComponent(JSON.stringify(BUILD))));
    try { await navigator.clipboard.writeText(txt); alert("Build copied to the clipboard. Send it to a friend and they can use Import."); } catch(e){ prompt("Copy this text:", txt); } });
  on("#bimport", "onclick", () => { const txt = prompt("Paste a build exported from OnigiriDex:"); if (!txt) return;
    try { BUILD = normalizeBuild(JSON.parse(decodeURIComponent(escape(atob(txt.trim().replace(/^ODX1:/, "")))))); UI.drawer = null; re(); } catch(e){ alert("That doesn't look like an OnigiriDex build."); } });
  on("#bsim", "onclick", () => { applyBuildToSim(r); location.hash = "#/sim"; });
}

// copy the computed build into the simulator settings (stats + the active weapon's skills as the rotation)
function applyBuildToSim(r){
  SIM.cat = r.cat;
  SIM.atk = Math.round((r.minAtk + r.maxAtk) / 2);
  SIM.cri = r.sec[12]; SIM.crd = r.sec[13]; SIM.cdc = r.sec[18];
  SIM.el = ATTR_SEC.map(i => r.sec[i] || 0);
  SIM.fromBuild = {name: BUILD.name, cat: r.cat, sfRank: r.skillPow[r.cat], dexCrit: r.dexCrit, extraCap: r.extraDmgLimit,
    onHit: r.onHit.map(h => ({attr: ATTR_ENUM[h.attr], proc: h.proc, rate: h.rate, limit: h.limit, value: r.sec[ATTR_SEC[ATTR_ENUM[h.attr]]] || 0})),
    minAtk: r.minAtk, maxAtk: r.maxAtk,
    vsCard: r.effects.filter(o => o.p == "IncreaseDamageToEnemy" && CARDS[o.monsterCardID]).map(o => ({rate: o.increaseRate, name: CARDS[o.monsterCardID][0], eids: CARDS[o.monsterCardID][1]}))};
  const W = BUILD.weapons[BUILD.active];
  const ids = W ? [...(W.skills || []), ...(W.ougi || [])].filter(id => SKBY[id]) : [];
  if (ids.length) SIM.loadout = ids;
  SIM.capBuffs = buildCaps(); delete SIM.capBuff;
  SIM.useBuild = true;
  saveSim();
  const ma = $("#myAtk"); if (ma) ma.value = SIM.atk;
}
