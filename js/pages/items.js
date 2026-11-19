"use strict";
/* OnigiriDex — item list and item page (drops, shops, boxes, recipes, dissolution) */
// ---------------------------------------------------------------- items
function viewItems(){
  setCrumbs([["Items"]]);
  const st = load("od2-ifilter", {q:"", kind:0, onlyDrop:true});
  app.innerHTML = `${ph({title:"Items", sub:"Every item with its best drop chance. Press Farm to find the best place to get it."})}
  <div class="toolbar">
    <input type="text" id="iq" placeholder="Item name (English or Japanese)…" value="${esc(st.q)}">
    <select id="ik"><option value="0">All types</option>${[...new Set(ITEMS.map(i => i[2]))].sort((a, b) => a - b).map(k => `<option value="${k}" ${st.kind == k ? "selected" : ""}>${esc(KIND[k] || k)}</option>`).join("")}</select>
    <label><input type="checkbox" id="io" ${st.onlyDrop ? "checked" : ""}> only items that drop</label>
    <span class="sp"></span>${partySeg()}
  </div>
  <div class="wrap"><table class="tbl" id="it"><thead><tr><th>Item</th><th>Type</th><th class="r">Req. Lv</th><th class="r">Sources</th><th class="r">Best chance</th><th></th></tr></thead><tbody></tbody></table></div>
  <button class="more" id="imore">Show more</button>`;
  let limit = PAGE;
  const src = itemSources(S.party);
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    const list = ITEMS.map((it, i) => i).filter(i => (!st.kind || ITEMS[i][2] == st.kind) && (!st.onlyDrop || src[i]) && (!q || (ITEMS[i][0] + " " + ITEMS[i][1]).toLowerCase().includes(q)));
    list.sort((a, b) => (ITEMS[b][4] - ITEMS[a][4]) || ITEMS[a][0].localeCompare(ITEMS[b][0]));
    $("#it tbody").innerHTML = list.slice(0, limit).map(i => { const it = ITEMS[i]; const b = bestAny(src, i);
      return `<tr><td>${itemLink(i)}<div class="jp jp-under">${esc(it[1])}</div></td><td class="mute">${esc(KIND[it[2]] || "")}</td><td class="r num">${it[6] > 1 ? it[6] : ""}</td>
        <td class="r num">${src[i]?.length || "—"}</td><td class="r">${b ? pct(b.p) : "—"}</td><td class="r">${src[i] ? `<button class="btn sm" data-farm="${i}">Farm</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="6">${emptyState("No items match")}</td></tr>`;
    $("#imore").style.display = list.length > limit ? "" : "none";
    $$("[data-farm]").forEach(b => b.onclick = () => farmGo([+b.dataset.farm]));
    store("od2-ifilter", st);
  };
  $("#iq").oninput = e => { st.q = e.target.value; limit = PAGE; draw(); };
  $("#ik").onchange = e => { st.kind = +e.target.value; draw(); };
  $("#io").onchange = e => { st.onlyDrop = e.target.checked; draw(); };
  $("#imore").onclick = () => { limit += 100; draw(); };
  draw();
}

// ---------------------------------------------------------------- shops & lucky boxes
const SHOPS = D.shops || [], BOXES = D.boxes || [];
const SHOP_SELL = {}, SHOP_CUR = {}, BOX_FROM = {}, BOX_OF = {};
SHOPS.forEach((sh, si) => sh.it.forEach(([it, cost], k) => { (SHOP_SELL[it] ||= []).push([si, k]); cost.forEach(([c]) => (SHOP_CUR[c] ||= []).push([si, k])); }));
BOXES.forEach((b, bi) => { BOX_OF[b.b] = bi; b.p.forEach(([p, its]) => its.forEach(([it, n]) => (BOX_FROM[it] ||= []).push([bi, p, n]))); });
const shopName = sh => `${esc(sh.n)}${sh.ev ? ` <span class="badge b-elite" title="Event exchange: only while the event runs">EVENT</span>` : ""}`;
const costTxt = cost => cost.length ? cost.map(([c, n]) => `<span class="cost">×${fmt(n)} ${itemLink(c)}</span>`).join(" ") : `<span class="mute">ryou</span>`;

// short "how to get it" summary for any item
function howToGet(i){
  const parts = [], b = bestAny(itemSources(S.party), i);
  if (b) parts.push(`drop ${pct(b.p)}${b.did ? ` <span class="mute">${esc(DUNBY[b.did].n)}</span>` : ""}`);
  const sh = (SHOP_SELL[i] || []).length; if (sh) parts.push(`<a href="#/item/${i}?tab=shops">${sh} shop${sh > 1 ? "s" : ""}</a>`);
  const bx = (BOX_FROM[i] || []).length; if (bx) parts.push(`<a href="#/item/${i}?tab=shops">${bx} box${bx > 1 ? "es" : ""}</a>`);
  if (typeof RCP_MAKE != "undefined" && RCP_MAKE[i]) parts.push(`<a href="#/item/${i}">craft</a>`);
  return parts.join(" · ") || `<span class="faint">event / quest / cash</span>`;
}

// ---------------------------------------------------------------- crafting recipes
const RECIPES = D.recipes || [];
const RCP_MAKE = {}, RCP_USE = {}, RCP_SCROLL = {};
RECIPES.forEach((r, k) => { (RCP_MAKE[r.i] ||= []).push(k); r.m.forEach(([m]) => { (RCP_USE[m] ||= new Set()).add(k); }); if (r.r != null) RCP_SCROLL[r.r] = k; });
// in one dungeon + difficulty: how many spawned monsters can drop the item (per monster and in total) and the smallest party where it drops
const DROPINFO = new Map();
function dropInfo(did, diff, item, partyOverride){
  const d = DUNBY[did], L = d && d.L[diff]; if (!L) return null;
  const fixed = L.fp > 0, party = fixed ? L.fp : (partyOverride || S.party), key = did + "|" + diff + "|" + party;
  let info = DROPINFO.get(key);
  if (!info){
    info = {fixed, party, mobs: new Map(), byMon: new Map(), minP: new Map()};
    dungeonFloors(d, diff, party).forEach(fl => fl.mons.forEach(m => { if (!m.drop) return; const tm = tableMap(m.v[9]); if (!tm) return;
      for (const [it] of tm){ info.mobs.set(it, (info.mobs.get(it) || 0) + m.pops); const k = it + "|" + m.eid; info.byMon.set(k, (info.byMon.get(k) || 0) + m.pops); } }));
    if (!fixed) for (let pp = 5; pp >= 1; pp--) dungeonFloors(d, diff, pp).forEach(fl => fl.mons.forEach(m => { if (!m.drop) return; const tm = tableMap(m.v[9]); if (tm) for (const [it] of tm) info.minP.set(it, pp); }));
    DROPINFO.set(key, info);
  }
  return {fixed, party, mobs: info.mobs.get(item) || 0, minP: fixed ? L.fp : info.minP.get(item), mon: eid => info.byMon.get(item + "|" + eid) || 0};
}
const playersCell = x => !x ? "—" : x.fixed ? `<span class="mute" title="This difficulty always uses a party of ${x.minP}">${x.minP} (fixed)</span>` : x.minP == null ? "—" : x.minP == 1 ? "1+" : `<b class="meh">${x.minP}+</b>`;

function boxContents(box){
  const prizeTxt = its => its.map(([it, n]) => `${itemLink(it)}${n > 1 ? ` <b>×${fmt(n)}</b>` : ""}`).join(" + ");
  // group prizes that share the same chance and item type (e.g. "1 of 52 magatama")
  const groups = new Map();
  for (const pr of BOX_SORT(box)){ const [p, its] = pr; const k = p.toFixed(6) + "|" + (its.length == 1 ? ITEMS[its[0][0]][2] : "x"); (groups.get(k) || groups.set(k, []).get(k)).push(pr); }
  const rows = [];
  for (const list of groups.values()){
    if (list.length < 4){ list.forEach(([p, its]) => rows.push({p, html: `<tr><td>${prizeTxt(its)}</td><td class="r">${pct(p)}${oneIn(p)}</td></tr>`})); continue; }
    const tot = list.reduce((a, [p]) => a + p, 0), kind = KIND[ITEMS[list[0][1][0][0]][2]] || "items";
    rows.push({p: tot, html: `<tr class="boxgrp"><td colspan="2"><details><summary><span>1 of these <b>${list.length}</b> ${esc(kind)}</span><span class="r">${pct(tot)} total · ${pct(list[0][0])} each</span></summary>
      <div class="boxlist">${list.map(([p, its]) => `<div>${prizeTxt(its)}</div>`).join("")}</div></details></td></tr>`});
  }
  rows.sort((a, b) => b.p - a.p);
  return `<h2 style="margin-top:0">Box contents <span class="count">one prize per box · ${box.p.length} possible prizes</span></h2>
    <div class="wrap" style="margin-bottom:18px"><table class="tbl"><thead><tr><th>Prize</th><th class="r">Chance per box</th></tr></thead><tbody>${rows.map(r => r.html).join("")}</tbody></table></div>`;
}
const BOX_SORT = box => box.p.slice().sort((a, b) => b[0] - a[0]);

function recipeCard(k, opts = {}){
  const r = RECIPES[k], src = itemSources(S.party);
  const srcTxt = i => { const b = bestAny(src, i); return b ? `<span class="mute">best ${pct(b.p)}</span>` : (RCP_MAKE[i] ? `<span class="mute">craftable</span>` : `<span class="faint">no drop</span>`); };
  return `<div class="rcp">
    <div class="rcp-h">${opts.showProduct ? `${itemLink(r.i)}${r.n > 1 ? ` <b>×${r.n}</b>` : ""}` : `<b>Recipe${opts.idx != null ? " " + (opts.idx + 1) : ""}</b>`}
      <span class="rcp-meta"><span class="chip" title="Crafting cost">${fmt(r.p)} ryou</span><span class="chip" title="Required crafting level">Craft Lv <b>${r.lv}</b></span></span></div>
    ${r.r != null ? `<div class="rcp-need">Needs ${itemLink(r.r)} ${srcTxt(r.r)}</div>` : `<div class="rcp-need mute">No recipe item needed</div>`}
    <ul class="rcp-mats">${r.m.map(([i, n]) => `<li><span class="q">×${fmt(n)}</span>${itemLink(i)}${srcTxt(i)}</li>`).join("")}</ul>
  </div>`;
}

function viewItem(i, qs){
  const it = ITEMS[i]; if (!it) return notFound();
  setCrumbs([["Items", "#/items"], [KIND[it[2]] || "Item"], [it[0]]]);
  remember(`#/item/${i}`, it[0], KIND[it[2]] || "Item");
  const all = itemSources(S.party);
  const src = (all[i] || []).slice();
  const mons = src.filter(r => r.t == "m"), ranks = src.filter(r => r.t == "r"), fields = src.filter(r => r.t == "f"), unk = src.filter(r => r.t == "u");
  const keyed = new Map();
  for (const r of mons){ const k = r.eid + "|" + r.did + "|" + r.diff; const c = keyed.get(k); if (!c || r.p > c.p) keyed.set(k, r); }
  // also places where it only drops with a bigger party
  for (let pp = 1; pp <= 5; pp++){ if (pp == S.party) continue;
    for (const r of (itemSources(pp)[i] || [])){ if (r.t != "m") continue; const k = r.eid + "|" + r.did + "|" + r.diff; if (!keyed.has(k)) keyed.set(k, Object.assign({}, r, {otherParty: true})); } }
  const fdiff = qs.get("d") != null ? +qs.get("d") : -1;
  const rows = [...keyed.values()].filter(r => fdiff < 0 || r.diff == fdiff).sort((a, b) => b.p - a.p);
  const unkContents = it[2] == 13 ? D.unk[it[3]] : null;
  // best places (per full clear)
  const best = src.length ? farmRows([i], S.party).sort((a, b) => ((1 - b.per[0].none) - (1 - a.per[0].none)) || (b.per[0].exp - a.per[0].exp)).slice(0, 6) : [];
  const makes = RCP_MAKE[i] || [], usedIn = [...(RCP_USE[i] || [])], scroll = RCP_SCROLL[i];
  const sells = SHOP_SELL[i] || [], fromBox = BOX_FROM[i] || [], buys = SHOP_CUR[i] || [], boxIdx = BOX_OF[i];
  const disFrom = typeof disSources == "function" ? disSources(i, DUI.lv) : [];
  const disSelf = typeof DIS_BY != "undefined" ? DIS_BY[i] : undefined;   // this item is a magatama that can be dissolved
  const groups = new Map();   // dungeon + difficulty -> monsters that drop it
  for (const r of rows){ const k = r.did + "|" + r.diff; if (!groups.has(k)) groups.set(k, {did:r.did, diff:r.diff, mons:[]}); groups.get(k).mons.push(r); }
  const tabs = [groups.size || !(sells.length || fromBox.length || disFrom.length || ranks.length || fields.length || usedIn.length) ? {id:"monsters", label:"Dungeons", n:groups.size} : null, sells.length + fromBox.length ? {id:"shops", label:"Shops & boxes", n:sells.length + fromBox.length} : null,
    buys.length ? {id:"spend", label:"Exchange it for", n:buys.length} : null, disFrom.length ? {id:"dissolve", label:"From dissolution", n:disFrom.length} : null, disSelf != null ? {id:"dissolveinto", label:"Dissolves into"} : null, usedIn.length ? {id:"usedin", label:"Used to craft", n:usedIn.length} : null, unk.length ? {id:"identify", label:"From ??? weapons", n:unk.length} : null,
    unkContents ? {id:"contents", label:"Identifies into", n:unkContents.length} : null, fields.length ? {id:"fields", label:"Field maps", n:fields.length} : null,
    ranks.length ? {id:"ranks", label:"Clear rewards", n:ranks.length} : null];
  const tab = qs.get("tab") || (rows.length ? "monsters" : unkContents ? "contents" : unk.length ? "identify" : ranks.length ? "ranks" : fields.length ? "fields" : (sells.length || fromBox.length) ? "shops" : buys.length ? "spend" : usedIn.length ? "usedin" : "monsters");
  const base = `#/item/${i}`;
  let body = "";
  if (tab == "shops"){
    const srcAll = itemSources(S.party);
    body = `${sells.length ? `<h3 class="sub-h">Exchange shops <span class="count">${sells.length}</span></h3>
      <div class="wrap" style="margin-bottom:16px"><table class="tbl"><thead><tr><th>Shop</th><th>Price</th></tr></thead><tbody>${sells.map(([si, k]) => { const sh = SHOPS[si];
        return `<tr><td>${shopName(sh)}</td><td>${costTxt(sh.it[k][1])}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
      ${fromBox.length ? `<h3 class="sub-h">Lucky boxes <span class="count">${fromBox.length}</span></h3>
      <div class="wrap"><table class="tbl"><thead><tr><th>Box</th><th class="r">Amount</th><th class="r">Chance per box</th><th>Where to get the box</th></tr></thead><tbody>${fromBox.sort((a, b) => b[1] - a[1]).map(([bi, p, n]) => { const b = BOXES[bi], bb = bestAny(srcAll, b.b), bs = (SHOP_SELL[b.b] || []).length;
        return `<tr><td>${itemLink(b.b)}</td><td class="r num">×${fmt(n)}</td><td class="r">${pct(p)}${oneIn(p)}</td>
          <td>${bb ? (bb.eid ? enemyLink(bb.eid) + " · " : "") + (bb.did ? dunLink(bb.did) + ` <span class="chip d${bb.diff}"><b>${DIFFS[bb.diff]}</b></span> ${pct(bb.p)}` : "") : ""}${bs ? `${bb ? " · " : ""}<span class="mute">${bs} shop${bs > 1 ? "s" : ""}</span>` : ""}${!bb && !bs ? `<span class="faint">event / quest / cash</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : ""}`;
  } else if (tab == "dissolve"){
    const how = x => x.how == "recipe" ? `<span class="chip">recipe ×${fmt(x.q)}</span>` : x.how == "pool" ? `<span class="chip" title="No recipe: one material out of ${x.n} is picked">random 1 of ${x.n}${x.q > 1 ? ` · ×${x.q}` : ""}</span>`
      : `<span class="chip faint" title="Only when nothing of the recipe comes back: one material out of ${x.n}">consolation 1 of ${x.n}</span>`;
    const nR = disFrom.filter(x => x.how == "recipe").length, nP = disFrom.filter(x => x.how == "pool").length, nC = disFrom.filter(x => x.how == "cons").length;
    body = `<div class="hint" style="margin:0 0 8px">Dissolution skill level <b>${DUI.lv}</b> (change it in <a href="#/dissolve" style="color:var(--accent2)">Magatama Dissolution</a>) ·
        ${[[nR, "from the recipe"], [nP, "from the random pool of magatama without recipe"], [nC, "as consolation"]].filter(([n]) => n).map(([n, t]) => `<b>${n}</b> ${t}`).join(" · ")}</div>
      <div class="wrap"><table class="tbl"><thead><tr><th>Dissolve this magatama</th><th class="r">Lv</th><th>How</th><th class="r"><span class="tip" title="Average amount of this item per dissolve">Expected</span></th><th class="r">Chance per dissolve</th><th>Chance of each amount</th><th>How to get the magatama</th><th></th></tr></thead><tbody>
      ${disFrom.slice(0, 250).map(x => { const d = DIS[x.k]; return `<tr><td>${itemLink(d.c)}</td><td class="r num">${d.lv}</td><td>${how(x)}${d.ba ? ` <span class="badge b-elite">ALL</span>` : ""}</td>
        <td class="r num"><b>${x.exp >= 10 ? fmt(Math.round(x.exp)) : x.exp >= 0.01 ? x.exp.toFixed(2) : x.exp.toFixed(4)}</b></td><td class="r">${pct(x.any)}</td><td class="qds">${qtyDist(x.q, x.pp, x.scale)}</td>
        <td style="font-size:12.5px">${howToGet(d.c)}</td><td class="r"><a class="btn sm" href="#/dissolve" data-dsel="${d.c}">Details</a></td></tr>`; }).join("")}</tbody></table></div>
      ${disFrom.length > 250 ? `<div class="mute" style="margin-top:6px">Showing the best 250 of ${disFrom.length}.</div>` : ""}`;
  } else if (tab == "dissolveinto" && disSelf != null){
    body = `<div class="toolbar"><span class="ctl">Dissolution skill (解体) level</span>
        <div class="seg" id="idlv">${[1,2,3,4,5,6,7,8,9,10].map(l => `<button data-l="${l}" class="${DUI.lv == l ? "on" : ""}">${l}</button>`).join("")}</div>
        <span class="mute" style="font-size:12.5px">Per unit: <b>${(disUnitChance(DUI.lv) * 100).toFixed(0)}%</b></span><span class="sp"></span>
        <a class="btn sm" href="#/dissolve" data-dsel="${i}">Open in Dissolution</a></div>
      <div class="pnl">${disResultHtml(disSelf, DUI.lv)}</div>`;
  } else if (tab == "spend"){
    body = `<div class="wrap"><table class="tbl"><thead><tr><th>You get</th><th>Shop</th><th>Full price</th></tr></thead><tbody>${buys.map(([si, k]) => { const sh = SHOPS[si], [it, cost] = sh.it[k];
      return `<tr><td>${itemLink(it)}</td><td>${shopName(sh)}</td><td>${costTxt(cost)}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (tab == "usedin"){
    body = `<div class="wrap"><table class="tbl"><thead><tr><th>Makes</th><th>Type</th><th class="r">Needs</th><th class="r">Craft cost</th><th class="r">Craft Lv</th></tr></thead><tbody>${usedIn
      .sort((a, b) => ITEMS[RECIPES[b].i][6] - ITEMS[RECIPES[a].i][6]).map(k => { const r = RECIPES[k]; const q = r.m.filter(([m]) => m == i).reduce((a, [, n]) => a + n, 0);
      return `<tr><td>${itemLink(r.i)}</td><td class="mute">${esc(KIND[ITEMS[r.i][2]] || "")}</td><td class="r num"><b>×${fmt(q)}</b></td><td class="r num">${fmt(r.p)}</td><td class="r num">${r.lv}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (tab == "identify"){
    const rowsU = unk.map(r => ({r, d: bestDirect(all, r.from)})).sort((a, b) => (b.d ? b.d.p * b.r.p : 0) - (a.d ? a.d.p * a.r.p : 0));
    body = `<div class="wrap"><table class="tbl"><thead><tr><th>"???" weapon</th><th class="r">Becomes this</th><th>Best place to get the ???</th><th class="r">Total chance</th></tr></thead><tbody>${rowsU.map(({r, d}) => `<tr><td>${itemLink(r.from)}</td><td class="r">${pct(r.p)}</td>
      <td>${d ? (d.eid ? enemyLink(d.eid) + " · " : "") + (d.did ? dunLink(d.did) + ` <span class="chip d${d.diff}"><b>${DIFFS[d.diff]}</b></span> <span class="mute">${pct(d.p)}</span>` : d.sid ? `<a href="#/field/${d.sid}">${esc(ST[d.sid].n)}</a>` : "") : `<span class="mute">doesn't drop</span>`}</td>
      <td class="r">${d ? pct(d.p * r.p) + oneIn(d.p * r.p) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab == "contents" && unkContents){
    body = `<div class="wrap" style="max-width:760px"><table class="tbl"><thead><tr><th>Weapon</th><th class="r">Chance</th></tr></thead><tbody>${unkContents.slice().sort((a, b) => b[0] - a[0]).map(([p, wi]) => `<tr><td>${itemLink(wi)}</td><td class="r">${pct(p)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab == "fields"){
    body = `<div class="wrap"><table class="tbl"><thead><tr><th>Monster</th><th>Map</th><th class="r">Chance / kill</th></tr></thead><tbody>${fields.sort((a, b) => b.p - a.p).map(r => `<tr><td>${enemyLink(r.eid)}</td><td><a href="#/field/${r.sid}">${esc(ST[r.sid].n)}</a></td><td class="r">${pct(r.p)}${oneIn(r.p)}</td></tr>`).join("")}</tbody></table></div>`;
  } else if (tab == "ranks"){
    body = `<div class="wrap"><table class="tbl"><thead><tr><th>Dungeon</th><th>Difficulty</th><th>Rank</th><th class="r">Chance</th></tr></thead><tbody>${ranks.sort((a, b) => b.p - a.p).slice(0, 200).map(r => `<tr><td>${dunLink(r.did)}</td><td><span class="chip d${r.diff}"><b>${DIFFS[r.diff]}</b></span></td><td>${esc(r.rank)}</td><td class="r">${pct(r.p)}</td></tr>`).join("")}</tbody></table></div>`;
  } else {
    body = `<div class="ctlbar"><div class="seg diff">${[-1,0,1,2,3].map(dd => `<a class="${dd == fdiff ? "on" : ""}" style="padding:5px 12px;border-radius:7px;font-weight:600;font-size:12.5px;color:${dd == fdiff ? "var(--ink)" : "var(--mute)"};${dd == fdiff ? "background:var(--card2)" : ""}" href="${base}?tab=monsters&d=${dd}">${dd < 0 ? "All" : DIFFS[dd]}</a>`).join("")}</div></div>
      ${groups.size ? `<div class="wrap"><table class="tbl dgtbl"><thead><tr><th>Dungeon</th><th>Difficulty</th><th class="r">Rec. Lv</th>
        <th class="r"><span class="tip" title="Monsters in one full clear that can drop it. Hover for the list, click to open it.">Mobs</span></th>
        <th class="r"><span class="tip" title="Smallest party where it can drop (monster versions change with the party size)">Players</span></th>
        <th class="r">Best / kill</th><th class="r"><span class="tip" title="Chance to get at least one in a full clear">≥1 per run</span></th></tr></thead><tbody>
      ${[...groups.values()].map(g => { let di = dropInfo(g.did, g.diff, i); const gated = di && !di.fixed && di.minP > S.party; if (gated) di = dropInfo(g.did, g.diff, i, di.minP);
          const dd = DUNBY[g.did]; let none = 1, best = 0;
          const mons = g.mons.map(r => { const c = di ? di.mon(r.eid) : 0; none *= Math.pow(1 - r.p, Math.max(c, 1)); best = Math.max(best, r.p); return {r, c}; }).sort((a, b) => b.r.p - a.r.p);
          return {g, di, gated, dd, mons, per: 1 - none, best}; }).sort((a, b) => b.per - a.per).slice(0, 250).map(({g, di, gated, dd, mons, per, best}, n) => {
          const tip = mons.map(({r, c}) => `${E[r.eid]?.n || "#" + r.eid} ×${c} · ${(r.p * 100).toFixed(r.p < 0.01 ? 2 : 1)}%`).join("\n");
          return `<tr class="${gated ? "needp" : ""}" ${gated ? `title="Only drops with ${di.minP}+ players"` : ""}>
            <td class="name">${dunLink(g.did)}${gated ? ` <span class="badge b-needp" title="Your party has ${S.party} player${S.party > 1 ? "s" : ""}; this drop only happens with ${di.minP} or more">NEEDS ${di.minP}+ PLAYERS</span>` : ""}<div class="jp">${esc(dd.gn || "")}</div></td><td><span class="chip d${g.diff}"><b>${DIFFS[g.diff]}</b></span></td>
            <td class="r num">${dd.L[g.diff]?.lv > 0 ? dd.L[g.diff].lv : "—"}</td>
            <td class="r"><button class="mobbtn" data-mobs="${n}" title="${esc(tip)}" aria-expanded="false">${di && di.mobs ? fmt(di.mobs) : `<i class="rare" title="Only from a rare spawn">rare</i>`} <span>▾</span></button></td>
            <td class="r num">${playersCell(di)}${gated ? `<div class="needp-sub">party of ${S.party} is too small</div>` : ""}</td><td class="r">${pct(best)}</td><td class="r">${pct(per)}${oneIn(per)}</td></tr>
          <tr class="mobrow" data-mobrow="${n}" hidden><td colspan="7"><div class="moblist">${mons.map(({r, c}) => `<div class="mobi">${enemyLink(r.eid)}${r.boss ? ` <span class="badge b-boss">BOSS</span>` : ""}${r.metal ? ` <span class="badge b-metal">RARE</span>` : ""}
              <span class="mute">×${fmt(c)} per run</span><span class="mobp">${pct(r.p)} / kill</span></div>`).join("")}</div></td></tr>`; }).join("")}
      </tbody></table></div>${groups.size > 250 ? `<div class="mute" style="margin-top:6px">Showing 250 of ${groups.size}.</div>` : ""}` : emptyState("No monster drops this", fdiff >= 0 ? "on this difficulty" : "")}`;
  }
  app.innerHTML = `${ph({k: esc(KIND[it[2]] || "Item"), icon: icon(it), title: `<span class="rk-${it[4]}"><span class="nm">${esc(it[0])}</span></span>`, jp: it[1],
      chips: `${it[4] >= 0 ? `<span class="chip">Rank <b>${"CBAS"[it[4]]}</b></span>` : ""}${it[6] > 1 ? `<span class="chip">Req. Lv <b>${it[6]}</b></span>` : ""}${[[groups.size, "dungeon"], [fields.length, "field map"], [ranks.length, "clear reward"], [sells.length, "shop"], [fromBox.length, "box", "es"], [disFrom.length, "dissolution", "s"], [makes.length, "recipe"]].filter(([n]) => n).map(([n, w, pl]) => `<span class="chip"><b>${n}</b> ${w}${n > 1 ? (pl || "s") : ""}</span>`).join("") || `<span class="chip">no known source</span>`}`,
      actions: src.length ? `${partySeg()}<button class="btn pri" id="farmThis">Open in Farm Finder</button>` : ""})}
    ${it[7] && !/^[A-Za-z]+\[/.test(it[7]) ? `<div class="note" style="white-space:pre-line;margin:0 0 14px">${esc(it[7])}</div>` : ""}
    ${best.length ? `<h2 style="margin-top:0">Best places to farm <span class="count">one full clear · party of ${S.party}</span></h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));margin-bottom:6px">${best.map(r => { const p = 1 - r.per[0].none; const runs = p >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - p));
        return `<a class="dcard" href="#/dungeon/${r.d.id}" data-godiff="${r.diff}"><div class="t">${esc(r.d.n)}</div><div class="boss">${esc(r.d.gn || "")}</div>
          <div class="lvpills"><span class="lvpill d${r.diff}">${DIFFS[r.diff]}${r.L.lv > 0 ? ` <b>${r.L.lv}</b>` : ""}</span>${(di => di ? `<span class="lvpill" title="Monsters per run that can drop it">${di.mobs ? `${fmt(di.mobs)} mob${di.mobs == 1 ? "" : "s"}` : "rare spawn"}</span><span class="lvpill" title="Smallest party where it drops">${di.fixed ? `party ${di.minP} (fixed)` : di.minP ? `${di.minP}+ player${di.minP > 1 ? "s" : ""}` : ""}</span>` : "")(dropInfo(r.d.id, r.diff, i))}</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline"><span>${pct(p)} <span class="mute" style="font-size:12px">per run</span></span><span class="mute" style="font-size:12px">${isFinite(runs) ? `~${fmt(runs)} runs for 90%` : ""}</span></div></a>`; }).join("")}</div>` : ""}
    ${makes.length ? `<h2 style="margin-top:0">How to craft <span class="count">${makes.length} recipe${makes.length > 1 ? "s" : ""}</span></h2>
      <div class="rcp-grid">${makes.map((k, n) => recipeCard(k, {idx: makes.length > 1 ? n : null})).join("")}</div>` : ""}
    ${boxIdx != null ? boxContents(BOXES[boxIdx]) : ""}
    ${scroll != null ? `<h2 style="margin-top:0">This recipe makes</h2><div class="rcp-grid">${recipeCard(scroll, {showProduct: true})}</div>` : ""}
    ${tabsBar(tabs, tab, base)}
    ${body}`;
  if ($("#farmThis")) $("#farmThis").onclick = () => farmGo([i]);
  $$("#idlv button").forEach(b => b.onclick = () => { DUI.lv = +b.dataset.l; store("od2-dis", DUI); route(); });
  $$("[data-dsel]").forEach(a => a.addEventListener("click", () => { DUI.sel = +a.dataset.dsel; store("od2-dis", DUI); }));
  $$("[data-mobs]").forEach(b => b.onclick = () => { const row = document.querySelector(`[data-mobrow="${b.dataset.mobs}"]`); if (!row) return;
    row.hidden = !row.hidden; b.setAttribute("aria-expanded", String(!row.hidden)); b.classList.toggle("open", !row.hidden); });
  $$("[data-godiff]").forEach(a => a.addEventListener("click", () => { S.diff = +a.dataset.godiff; saveS(); }));
}
