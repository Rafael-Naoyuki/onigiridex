"use strict";
/* OnigiriDex — current-effect panel (sources, totals, conditions, seal) */
// ---------------------------------------------------------------- effect sources (who gives what)
const PCT_SEC = new Set([4,5,6,8,9,10,12,13,14,15,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,39,41,42]);
const weaponOpts = W => { const x = WBY[W.id]; return [...x.o, ...BDB.smelt.slice(0, W.smelt || 0).flatMap(sm => sm.o), ...(W.extra || [])]; };
function effectSources(r, withInactive){
  const src = [...extraSources()];
  BUILD.weapons.forEach((W, wi) => {
    const ew = W && WBY[W.id]; if (!ew) return;
    const act = wi == BUILD.active;
    if (!act && !withInactive) return;
    src.push({name: ew.n, kind: act ? `Active weapon${W.smelt ? ` · smelt ${W.smelt}` : ""}` : "Not active (stats don't count)", ic: ew.ic, opts: weaponOpts(W), off: !act, weapon: true});
  });
  for (const id of buildCaps()){ const sk = SKBY[id]; src.push({name: `${sk.n} (ougi buff, ${sk.dl[1] / 1000}s)`, kind: "Ougi buff", opts: [{t:"e", p:"ExtraDamageLimit", extraDmgLimit: sk.dl[0]}]}); }
  if (r.cat == 4) src.push({name: "Axe (weapon type)", kind: "Weapon", opts: [{t:"s", s:12, v:5, g:1}]});
  for (const st of r.slots.slice().sort((a, b) => a.slot - b.slot)){
    const c = BUILD.crys[st.slot], set = st.set, kind = set.k == 26 ? "Accessory" : "Magatama";
    const off = !st.active;
    src.push({name: set.n, kind, ic: set.ic, opts: set.o, off});
    for (const os of (c.orn || []).slice(0, set.sl || 0)){
      const O = os && OBY[os.id]; if (!O) continue;
      const on = BuildCalc.ornamentOn(O, os), opts = [];
      O.L.forEach((ln, k) => { if (!on[k]) return; const o = Object.assign({}, ln.o); if (ln.k && os.val && os.val[k] != null && os.val[k] !== "") o[ln.k] = +os.val[k]; opts.push(o); });
      src.push({name: `${O.n} (on ${set.n})`, kind: "Ornament", ic: set.ic, opts, off});
    }
    if (c.extra?.length) src.push({name: `${set.n} · rolled`, kind: "Rolled", ic: set.ic, opts: c.extra, off});
  }
  return src;
}
function fxKey(o){
  const cond = o.if ? "|if:" + condText(o.if) : "";
  switch (o.t){
    case "b": return {key: "b" + o.s + cond, grp: "Status", label: STATS[o.s], unit: ""};
    case "s": {
      const el = o.s >= 21 && o.s <= 33;
      const nm = (SEC_NAMES[o.s] || "stat " + o.s) + (o.g == 1 && !PCT_SEC.has(o.s) ? " %" : "");
      return {key: `s${o.s}|${o.g}` + cond, grp: el ? "Elements" : "Combat", label: el ? elemTag(ATTR_SEC.indexOf(o.s)) + esc(nm) : nm, html: el, unit: o.g == 1 || PCT_SEC.has(o.s) ? "%" : ""};
    }
    case "k": return {key: `k${o.w}|${o.r}|${o.m}` + cond, grp: "Skill Force", label: `${o.w >= 0 ? CATS[o.w] : "All weapons"} · ${rankText(o.r, o.m)}`, unit: "%"};
    case "w": return {key: "w" + o.w + cond, grp: "Affinity", label: o.w >= 0 ? CATS[o.w] : "none", unit: "%"};
    case "e": {
      const {if: _c, ...rest} = o;
      const S = SE_SUM[o.p];
      if (S) return {key: `e:${o.p}:${S[4] ? S[4](o) : ""}` + cond, grp: S[2], label: S[3](o), unit: S[1], val: o[S[0]] || 0, html: true};
      return {key: "e" + JSON.stringify(rest) + cond, grp: "Special", label: optText(rest), unit: "", count: true, html: true};
    }
  }
  return {key: "?" + JSON.stringify(o), grp: "Other", label: optText(o), unit: "", count: true};
}
const FX_GROUPS = ["Status", "Combat", "Elements", "Skill Force", "Affinity", "Vs monsters", "Special", "Conditional", "Other"];
let FXCONDS = [];
let FXROWS = [];
function effectTotals(r, src){
  const map = new Map();
  for (const s of src) for (const o of s.opts || []){
    const k = fxKey(o);
    let row = map.get(k.key);
    if (!row){ row = Object.assign({}, k, {total: 0, n: 0, from: [], cond: o.if || null, met: o.if ? BuildCalc.checkCond(o.if, r.ctx) : true}); map.set(k.key, row); }
    const val = k.val != null ? k.val : (o.v || 0);
    if (!s.off){ row.total += k.count ? 1 : val; row.n++; }
    row.from.push({name: s.name, kind: s.kind, v: k.count ? null : val, off: s.off});
  }
  const rows = [...map.values()];
  rows.forEach(x => { if (x.cond) x.grp = "Conditional"; });
  return rows;
}
function fxRow(x){
  const id = FXROWS.push(x) - 1; const dead = !x.n || !x.met;
  return `<div class="fx ${dead ? "dead" : ""} ${x.count ? "eff" : (x.total < 0 ? "neg" : "")}" data-fx="${id}">
    <span class="n">${x.html ? x.label : esc(x.label)}</span>
    <b>${fxValue(x)}</b>${x.n > 1 && !x.count ? `<span class="cnt" title="${x.n} sources">${x.n}</span>` : ""}</div>`;
}
// conditional effects: one block per condition, active ones first
function condGroups(list){
  const by = new Map();
  for (const x of list){ const k = condText(x.cond); if (!by.has(k)) by.set(k, {cond: x.cond, met: x.met, rows: []}); by.get(k).rows.push(x); }
  const groups = [...by.entries()].sort((a, b) => b[1].met - a[1].met || a[0].localeCompare(b[0]));
  const open = !(UI.fxClosed || {}).Conditional;
  const nOn = groups.filter(([, g]) => g.met).length;
  return `<div class="fxg ${open ? "" : "shut"}"><button class="fxh" data-fxg="Conditional"><i></i>Conditional<span>${nOn} of ${groups.length} active</span></button>
    ${open ? groups.map(([txt, g]) => {
      const patch = condSatisfy(g.cond); const ci = patch ? FXCONDS.push(patch) - 1 : -1;
      return `<div class="cdg ${g.met ? "on" : ""}"><div class="cdh"><span class="ic">${g.met ? "✓" : "✗"}</span><span class="t">If ${esc(txt)}</span>
          ${g.met ? `<span class="st">active</span>` : ci >= 0 ? `<button class="btn sm" data-ctest="${ci}" title="Change the situation so this is true">Test</button>` : `<span class="st" title="Depends on your stats, level or equipped weapons">not met</span>`}</div>
        ${g.rows.map(fxRow).join("")}</div>`;
    }).join("") : ""}</div>`;
}
function fxValue(x){
  if (x.count) return x.n > 1 ? "×" + x.n : "";
  if (x.grp == "Elements" && x.total > 250) return `+250%<small class="capd" title="Elements cap at 250% (items give ${x.total}%)"> (${x.total})</small>`;
  return signed(x.total) + x.unit;
}
function effectPanel(r){
  const src = effectSources(r);
  const mode = UI.fxMode || "total";
  let body = "";
  FXROWS = [];
  if (mode == "total"){
    const rows = effectTotals(r, src);
    FXCONDS = [];
    for (const g of FX_GROUPS){
      const list = rows.filter(x => x.grp == g); if (!list.length) continue;
      if (g == "Conditional"){ body += condGroups(list); continue; }
      list.sort((a, b) => (b.n > 0) - (a.n > 0) || (g == "Skill Force" ? a.label.localeCompare(b.label) : 0));
      const open = !(UI.fxClosed || {})[g];
      body += `<div class="fxg ${open ? "" : "shut"}"><button class="fxh" data-fxg="${esc(g)}"><i></i>${esc(g)}<span>${list.length}</span></button>
        ${open ? list.map(fxRow).join("") : ""}</div>`;
    }
  } else {
    for (const s of effectSources(r, true).sort((x, y) => (x.off && x.weapon ? 1 : 0) - (y.off && y.weapon ? 1 : 0))){
      const g = s.name, inact = s.off && s.weapon;
      const open = inact ? !!(UI.fxOpen || {})[g] : !(UI.fxClosed || {})["s:" + g];
      body += `<div class="fxg ${open ? "" : "shut"} ${s.off ? "off" : ""}"><button class="fxh" ${inact ? `data-fxo="${esc(g)}"` : `data-fxg="s:${esc(g)}"`}><i></i>${s.ic ? iconOf(s.ic) : ""}<span class="t">${esc(s.name)}</span><span>${s.kind}${s.off && !s.weapon ? " · no capacity" : ""}</span></button>
        ${open ? `<div class="fxsrc">${optList(s.opts, !s.off)}</div>` : ""}</div>`;
    }
  }
  return `<section class="pnl fxpanel">
    <div class="kv"><h3 class="sect">Current effect</h3>
      <div class="seg sm"><button data-fxm="total" class="${mode == "total" ? "on" : ""}">Totals</button><button data-fxm="src" class="${mode == "src" ? "on" : ""}">By item</button></div></div>
    ${situationBar()}
    <div class="fxlist">${body || `<div class="mute" style="font-size:12.5px">Equip something to see its effects.</div>`}</div>
    ${mode == "total" ? `<div class="hint">Same effects are added together. Hover a line to see where it comes from. Gray = condition not met or slot without capacity.</div>` : ""}
  </section>`;
}
function weaponSeal(){
  const W = BUILD.weapons[BUILD.active], x = W && WBY[W.id]; if (!x) return null;
  const cnt = {}, walk = c => { if (!c) return; if (c.k == "stigma") cnt[c.v] = (cnt[c.v] || 0) + 1; walk(c.and); walk(c.or); };
  [...x.o, ...BDB.smelt.slice(0, W.smelt || 0).flatMap(sm => sm.o)].forEach(o => walk(o.if));
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return best ? {v: +best[0], n: best[1], name: sealName(+best[0])} : null;
}
function sealBar(){
  const ws = weaponSeal(); if (!ws) return "";
  const on = BUILD.cond.stigma == ws.v;
  return `<div class="sealbar ${on ? "on" : ""}">
    <button class="sealsw" id="sealToggle" role="switch" aria-checked="${on}" title="Seal of ${ws.name}: ${ws.n} effect${ws.n > 1 ? "s" : ""} of the active weapon need it">
      <span class="sw"><i></i></span><span>Weapon seal <b>${elemTag(ATTR_ENUM[ws.v])}Seal of ${ws.name}</b></span></button>
    <span class="mute">${on ? `ON · its ${ws.n} seal effect${ws.n > 1 ? "s" : ""} count in the stats` : `OFF · ${ws.n} effect${ws.n > 1 ? "s" : ""} not counted`}</span></div>`;
}
function situationBar(){
  const C = BUILD.cond, normal = C.hpPct == 100 && C.spPct == 100 && !C.poison && !C.stigma && (C.drunk == null || C.drunk === "");
  return `${sealBar()}<div class="situ"><span class="mute" title="Used to check conditional effects">Situation</span>
    <label>HP<input type="number" id="chp" min="1" max="100" value="${C.hpPct}">%</label>
    <label>SP<input type="number" id="csp" min="0" max="100" value="${C.spPct}">%</label>
    <label><select id="cstig"><option value="0">No seal</option>${Object.entries(ATTR_ENUM).filter(([e]) => e <= 10).map(([e, i]) => `<option value="${e}" ${C.stigma == e ? "selected" : ""}>Seal: ${ATTRS[i][0]}</option>`).join("")}</select></label>
    <label><select id="cpois"><option value="0">Not poisoned</option><option value="1" ${C.poison ? "selected" : ""}>Poisoned</option></select></label>
    <label title="Drunkenness (empty = no sake)">Drunk<input type="number" id="cdrunk" min="0" placeholder="—" value="${C.drunk ?? ""}"></label>
    ${normal ? "" : `<button class="btn sm" id="creset" title="Full HP/SP, no seal, not poisoned, sober">Reset</button>`}</div>`;
}
function fxTipHtml(x){
  return `<div class="tt-h">${x.html ? x.label : esc(x.label)}</div>${x.from.map(f => `<div class="tt-r ${f.off ? "off" : ""}"><span>${esc(f.name)}<small>${f.kind}${f.off ? " · no capacity" : ""}</small></span><b>${f.v == null ? "" : signed(f.v) + x.unit}</b></div>`).join("")}
    ${x.from.length > 1 && !x.count ? `<div class="tt-t"><span>Total</span><b>${signed(x.total) + x.unit}</b></div>` : ""}
    ${x.cond ? `<div class="tt-c">${x.met ? "✓" : "✗"} ${esc(condText(x.cond))}</div>` : ""}`;
}
// one floating tooltip for the whole page
function ensureFxTip(){
  let tip = document.getElementById("fxtip");
  if (tip) return tip;
  tip = document.createElement("div"); tip.id = "fxtip"; document.body.appendChild(tip);
  document.addEventListener("mouseover", e => {
    const el = e.target.closest && e.target.closest("[data-fx]");
    if (!el || !FXROWS[+el.dataset.fx]){ tip.classList.remove("show"); return; }
    tip.innerHTML = fxTipHtml(FXROWS[+el.dataset.fx]);
    const b = el.getBoundingClientRect(); tip.classList.add("show");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = b.left - w - 10; if (x < 8) x = Math.min(b.right + 10, innerWidth - w - 8);
    tip.style.left = x + "px"; tip.style.top = Math.max(8, Math.min(b.top, innerHeight - h - 8)) + "px";
  });
  document.addEventListener("scroll", () => tip.classList.remove("show"), true);
  document.addEventListener("keydown", e => { if (e.key == "Escape" && UI.pick && document.getElementById("pkbg")){ UI.pick = null; saveUI(); viewBuild(); } });
  return tip;
}


// ---------------------------------------------------------------- element look of an item (cosmetic only, no effect on the math)
// ATTRS index: 3 Fire 4 Ice 5 Thunder 6 Dark 7 Water 8 Earth 9 Wind 10 Holy 11 Poison
const ELEM_JP = {"焔":3,"炎":3,"火":3,"冰":4,"氷":4,"雷":5,"渾":6,"闇":6,"暗":6,"水":7,"海":7,"地":8,"土":8,"風":9,"聖":10,"毒":11};
const ELEM_EN = [[3,/^(flame|blaze|fire|inferno|hell flame|burn)/i],[4,/^(ice|frost|sleet|glacier)/i],[5,/^(thunder|bolt|levin|lightning)/i],
  [6,/^(shadow|dark|chaos|gloom|abyss)/i],[7,/^(water|ocean|aqua|tide)/i],[8,/^(earth|rock|stone)/i],[9,/^(wind|gale)/i],[10,/^(holy|light)/i],[11,/^(poison|venom)/i],[12,/^(fly|flying|wing)/i]];
const ELEM_CACHE = new Map();
function itemElems(x){
  if (!x) return [];
  const key = (x.k || "w") + ":" + x.id;
  if (ELEM_CACHE.has(key)) return ELEM_CACHE.get(key);
  const sum = {};
  for (const o of x.o || []) if (o.t == "s" && !o.if && o.g != 1 && o.v > 0){ const i = ATTR_SEC.indexOf(o.s); if (i >= 0 && i <= 12) sum[i] = (sum[i] || 0) + o.v; }
  let els = Object.entries(sum).sort((a, b) => b[1] - a[1]).map(e => +e[0]);
  // magic elements first (in order of size), then the physical one
  els = [...els.filter(i => i >= 3), ...els.filter(i => i < 3)].slice(0, 3);
  if (!els.some(i => i >= 3)){ // no element bonus: guess from the name (焔/Flame -> Fire ...)
    let el = ELEM_JP[(x.j || "")[0]] ?? -1;
    if (el < 0) for (const [i, re] of ELEM_EN) if (re.test(x.n || "")) { el = i; break; }
    if (el >= 0) els = [el, ...els].slice(0, 3);
  }
  ELEM_CACHE.set(key, els);
  return els;
}
const elemTag = (i, title) => `<span class="elb" style="--ec:${ATTR_COLORS[i]}" title="${esc(title || ATTRS[i][0])}">${ATTRS[i][1]}</span>`;
const elemBadge = x => itemElems(x).map(i => elemTag(i)).join("");
