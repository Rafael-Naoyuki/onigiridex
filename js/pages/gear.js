"use strict";
/* OnigiriDex — Equipment: weapons, magatama and accessories, each with how to craft or get it */
const GEAR_TABS = [
  {id:"weapons", label:"Weapons", kind:8, ic:"sword"},
  {id:"magatama", label:"Magatama", kind:9, ic:"magatama_attack07"},
  {id:"accessories", label:"Accessories", kind:26, ic:"acce_yellow"},
];
const GEAR_SRC = [["any", "Any known source"], ["craft", "Craft"], ["drop", "Drop"], ["reward", "Clear reward"], ["shop", "Shop"], ["box", "Lucky box"], ["all", "Everything (incl. unknown)"]];
const isTestItem = it => /test|alpha|beta|debug/i.test(it[0]) || /テスト|デバッグ/.test(it[1]);
// build-planner record of an equipment item (weapon stats, magatama cost / defense / effects)
function gearRec(i){
  const it = ITEMS[i];
  if (it[2] == 8) return WBY[it[3]] || null;
  return CBY[it[2] + ":" + it[3]] || null;
}
// every way to get item i, best first
function gearSources(i){
  const src = itemSources(S.party)[i] || [], out = [];
  const best = (list) => list.reduce((a, r) => !a || r.p > a.p ? r : a, null);
  if (RCP_MAKE[i]) out.push({k:"craft", label:"Craft", tip:`${RCP_MAKE[i].length} recipe${RCP_MAKE[i].length > 1 ? "s" : ""}`});
  const dm = best(src.filter(r => r.t == "m"));
  if (dm) out.push({k:"drop", label:`Drop ${fmtPct(dm.p)}`, sub: DUNBY[dm.did]?.n, tip:`Best: ${E[dm.eid]?.n || "monster"} in ${DUNBY[dm.did]?.n || ""} (${DIFFS[dm.diff]})`});
  const df = best(src.filter(r => r.t == "f"));
  if (df) out.push({k:"drop", label:`Field ${fmtPct(df.p)}`, sub: ST[df.sid]?.n, tip:`${E[df.eid]?.n || "monster"} in ${ST[df.sid]?.n || "a field"}`});
  const rw = best(src.filter(r => r.t == "r"));
  if (rw) out.push({k:"reward", label:"Clear reward", sub: DUNBY[rw.did]?.n, tip:`Rank ${rw.rank} reward in ${DUNBY[rw.did]?.n || ""} (${DIFFS[rw.diff]}): ${fmtPct(rw.p)}`});
  if (src.some(r => r.t == "u")) out.push({k:"drop", label:"Appraise", tip:"Comes from appraising an unidentified weapon"});
  const sh = (SHOP_SELL[i] || []).length;
  if (sh) out.push({k:"shop", label:sh > 1 ? `${sh} shops` : "Shop", tip:[...new Set(SHOP_SELL[i].map(([si]) => SHOPS[si].n))].slice(0, 4).join(", ")});
  const bx = (BOX_FROM[i] || []).length;
  if (bx) out.push({k:"box", label:bx > 1 ? `${bx} lucky boxes` : "Lucky box", tip:[...new Set(BOX_FROM[i].map(([b]) => ITEMS[BOXES[b].b]?.[0]).filter(Boolean))].slice(0, 4).join(", ")});
  return out;
}
const fmtPct = p => { const v = p * 100; return (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3)) + "%"; };
const gearChips = (i, srcs) => srcs.length
  ? `<div class="gsrc">${srcs.map(s => `<a class="gs gs-${s.k}" href="#/item/${i}${s.k == "shop" || s.k == "box" ? "?tab=shops" : ""}" title="${esc(s.tip || "")}"><b>${esc(s.label)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ""}</a>`).join("")}</div>`
  : `<span class="faint">Event / quest / cash shop</span>`;
const gearFx = (x, max = 3) => {
  const o = (x?.o || []).filter(o => !o.if);
  if (!o.length) return `<span class="faint">—</span>`;
  const txt = o.map(q => optText(q).replace(/<[^>]+>/g, ""));
  return `<div class="gfx" title="${esc(txt.join("\n"))}">${txt.slice(0, max).map(t => `<span>${esc(t)}</span>`).join("")}${txt.length > max ? `<em>+${txt.length - max} more</em>` : ""}</div>`;
};

function viewGear(tabId){
  const tab = GEAR_TABS.find(t => t.id == tabId) || GEAR_TABS[0];
  setCrumbs([["Equipment", "#/gear"], [tab.label]]);
  const st = load("od2-gear2-" + tab.id, {q:"", src:"any", cat:-1, sort: tab.kind == 8 ? "atk" : tab.kind == 9 ? "lv" : "n"});
  // candidates: real equipment items with planner data
  const all = ITEMS.map((it, i) => i).filter(i => ITEMS[i][2] == tab.kind && !isTestItem(ITEMS[i]) && gearRec(i));
  const srcOf = new Map(all.map(i => [i, gearSources(i)]));
  const counts = Object.fromEntries(GEAR_TABS.map(t => [t.id, ITEMS.filter((it, i) => it[2] == t.kind && !isTestItem(it) && gearRec(i)).length]));
  const smeltN = BDB.smelt.length;
  const atkOf = new Map(tab.kind == 8 ? all.map(i => { const w = gearRec(i); return [i, BuildCalc.weaponAttack(w, 100, w.enh ? BuildCalc.enhanceCap(w, smeltN) : 0, w.enh ? smeltN : 0, BDB.smelt).max]; }) : []);

  app.innerHTML = `${ph({title:"Equipment", sub:"Weapons, magatama and accessories with every way to craft or get them."})}
  <nav class="tabs gear-tabs">${GEAR_TABS.map(t => `<a href="#/gear/${t.id}" class="${t.id == tab.id ? "on" : ""}">${iconOf(t.ic)}<span>${t.label}</span><span class="n">${counts[t.id]}</span></a>`).join("")}</nav>
  <div class="toolbar gear-tb">
    <input type="text" id="gq" placeholder="Search ${tab.label.toLowerCase()}…" aria-label="Search" value="${esc(st.q)}">
    <select id="gsrc" aria-label="Source">${GEAR_SRC.map(([k, n]) => `<option value="${k}" ${st.src == k ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select id="gsort" aria-label="Sort"><option value="lv" ${st.sort == "lv" ? "selected" : ""}>Highest level</option>${tab.kind == 8 ? `<option value="atk" ${st.sort == "atk" ? "selected" : ""}>Highest ATK</option>` : ""}<option value="n" ${st.sort == "n" ? "selected" : ""}>Name</option></select>
    <span class="sp"></span><span class="mute" id="gcount"></span>
  </div>
  ${tab.kind == 8 ? `<div class="seg gear-cats" id="gcat" role="group" aria-label="Weapon type"><button data-c="-1" class="${st.cat < 0 ? "on" : ""}">All</button>${Object.entries(CATS).map(([k, n]) => `<button data-c="${k}" class="${st.cat == k ? "on" : ""}">${catIcon(+k) ? iconOf(catIcon(+k)) : ""}${esc(n)}</button>`).join("")}</div>` : ""}
  <div class="wrap"><table class="tbl gear-tbl"><thead><tr>${
    tab.kind == 8 ? `<th>Weapon</th><th>Type</th><th class="r">Lv</th><th class="r"><span class="tip" title="Grade 100, smelt and refine at max">Max ATK</span></th><th>Effects</th>`
    : tab.kind == 9 ? `<th>Magatama</th><th class="r">Lv</th><th class="r">Cost</th><th class="r">P.DEF / M.DEF</th><th class="r">Slots</th><th>Effects</th>`
    : `<th>Accessory</th><th class="r">Lv</th><th>Effects</th>`}<th>How to get</th></tr></thead><tbody id="gbody"></tbody></table></div>
  <button class="more" id="gmore">Show more</button>`;

  let limit = 80;
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    let list = all.filter(i => {
      const it = ITEMS[i], s = srcOf.get(i);
      if (q && !(it[0] + " " + it[1]).toLowerCase().includes(q)) return false;
      if (tab.kind == 8 && st.cat >= 0 && gearRec(i).c != st.cat) return false;
      if (st.src == "any") return s.length > 0;
      if (st.src == "all") return true;
      return s.some(x => x.k == st.src);
    });
    const lvOf = i => gearRec(i).lv || ITEMS[i][6] || 0;
    list.sort(st.sort == "n" ? (a, b) => ITEMS[a][0].localeCompare(ITEMS[b][0])
      : st.sort == "atk" ? (a, b) => (atkOf.get(b) || 0) - (atkOf.get(a) || 0)
      : (a, b) => lvOf(b) - lvOf(a) || ITEMS[b][4] - ITEMS[a][4] || ITEMS[a][0].localeCompare(ITEMS[b][0]));
    $("#gcount").textContent = `${fmt(list.length)} of ${fmt(all.length)} ${tab.label.toLowerCase()}`;
    $("#gbody").innerHTML = list.slice(0, limit).map(i => {
      const it = ITEMS[i], x = gearRec(i), name = `<td class="name">${itemLink(i)}<div class="jp jp-under">${esc(it[1])}</div></td>`, how = `<td>${gearChips(i, srcOf.get(i))}</td>`;
      if (tab.kind == 8) return `<tr>${name}<td class="gcat">${catIcon(x.c) ? iconOf(catIcon(x.c)) : ""}${esc(CATS[x.c] || "")} <span class="gel">${elemBadge(x)}</span></td><td class="r num">${x.lv}</td><td class="r num">${atkOf.get(i) > 0 ? `<b title="Grade 100 with smelt and refine at max">${fmt(atkOf.get(i))}</b>` : `<span class="faint">—</span>`}</td><td>${gearFx(x, 2)}</td>${how}</tr>`;
      if (tab.kind == 9) return `<tr>${name}<td class="r num">${x.lv}</td><td class="r num">${x.cost}</td><td class="r num">${fmt(x.pd)} / ${fmt(x.md)}</td><td class="r num">${x.sl}</td><td>${gearFx(x)}</td>${how}</tr>`;
      return `<tr>${name}<td class="r num">${x.lv}</td><td>${gearFx(x)}</td>${how}</tr>`;
    }).join("") || `<tr><td colspan="8">${emptyState("Nothing matches", "Try another name or source.")}</td></tr>`;
    $("#gmore").style.display = list.length > limit ? "" : "none";
    store("od2-gear2-" + tab.id, st);
  };
  $("#gq").oninput = e => { st.q = e.target.value; limit = 80; draw(); };
  $("#gsrc").onchange = e => { st.src = e.target.value; limit = 80; draw(); };
  $("#gsort").onchange = e => { st.sort = e.target.value; draw(); };
  $$("#gcat button").forEach(b => b.onclick = () => { st.cat = +b.dataset.c; $$("#gcat button").forEach(x => x.classList.toggle("on", x == b)); limit = 80; draw(); });
  $("#gmore").onclick = () => { limit += 80; draw(); };
  draw();
}
