"use strict";
/* OnigiriDex — Magatama Dissolution */
/* OnigiriDex — Magatama Dissolution: what dissolving a magatama gives back (rules ported from the server's handleCrystalBreakUp). */
const DIS = D.dissolve || [];
const DIS_BY = {}; DIS.forEach((d, k) => DIS_BY[d.c] = k);
const GEM_TABLE = {0:[7,8,9], 1:[1,5,6], 2:[3,4,6], 3:[2,5,9], 4:[0,1,7], 10:[0,1,2,3,4,5,6,7,8,9]};
const GEM_IDX = {}; ITEMS.forEach((it, i) => { if (it[2] == 14) GEM_IDX[it[3]] = i; });
const DIS_FROM = {};   // material -> magatama that give it back
DIS.forEach((d, k) => { if (d.r >= 0 && !d.ub) RECIPES[d.r].m.forEach(([m]) => (DIS_FROM[m] ||= []).push(k)); });
const DUI = load("od2-dis", {q:"", lv:1, sel:null, show:"all"});

// per-unit return chance for the NPC's dissolution skill level (server: rate = 45 + level*5, a unit comes back when rnd(100) >= rate)
const disUnitChance = lv => Math.max(0, Math.min(1, (100 - (45 + lv * 5)) / 100));
function disGems(d, lv){
  const t = Math.floor(d.lv / 10);
  const min = Math.min(t - 1, lv - 1), max = Math.min(t, ((lv - 1) * 2) || 1);
  const n = Math.max(0, max - min + 1), vals = []; for (let v = min; v <= max; v++) vals.push(v);
  const pos = vals.filter(v => v > 0);
  return {min: Math.max(0, min), max, chance: n ? pos.length / n : 0, avg: n ? pos.reduce((a, b) => a + b, 0) / n : 0, dist: [...new Set(pos)].map(c => [c, pos.filter(v => v == c).length / n]), types: (GEM_TABLE[d.et] || GEM_TABLE[10]).map(g => GEM_IDX[g]).filter(i => i != null)};
}
function disStatus(d){ return d.ub ? ["ub", "Can't be dissolved"] : d.ba ? ["ba", "Returns every material"] : d.r < 0 ? ["nr", "No recipe: random material"] : ["ok", "Recipe materials"]; }

// server getMaterialsAroundLV(lv): materials with drop level in [lv-30, lv] (lv at least 20), highest 20 drop levels, one picked at random
const MATLV = D.matlv || [];
function matPool(lv){
  lv = Math.max(lv, 20);
  return MATLV.filter(([, dl]) => dl <= lv && dl >= lv - 30).sort((a, b) => b[1] - a[1] || ITEMS[a[0]][3] - ITEMS[b[0]][3]).slice(0, 20);
}
function binom(n, p){
  const out = new Array(n + 1).fill(0); let c = 1;
  for (let k = 0; k <= n; k++){ out[k] = c * Math.pow(p, k) * Math.pow(1 - p, n - k); c = c * (n - k) / (k + 1); }
  return out;
}
// chips "×k chance" for getting exactly k (scale = chance this item is the one picked at all)
function qtyDist(n, p, scale = 1){
  if (n <= 0) return "";
  if (p >= 1) return `<span class="qd"><b>×${fmt(n)}</b> ${pct(scale)}</span>`;
  const b = binom(n, p).map(x => x * scale);
  let ks = []; for (let k = 1; k <= n; k++) ks.push(k);
  if (n > 6){ ks = ks.sort((x, y) => b[y] - b[x]).slice(0, 5).sort((x, y) => x - y); }
  return ks.map(k => `<span class="qd" title="Exactly ${k}: ${(b[k] * 100).toFixed(b[k] < 0.01 ? 3 : 1)}%"><b>×${fmt(k)}</b> ${pct(b[k])}</span>`).join("") + (n > 6 ? `<span class="qd faint" title="Other amounts are less likely">…</span>` : "");
}
function poolHtml(lv, title, per, qtyHtml){
  const pool = matPool(lv);
  if (!pool.length) return `<div class="mute">No material in range.</div>`;
  const each = per != null ? per / pool.length : 1 / pool.length;
  return `<details class="grp pool" open><summary>${title} · <b>${pool.length}</b> materials · each <b>${pct(each)}</b> per dissolve</summary>
    ${qtyHtml ? `<div class="poolq">Amount when a material is picked: ${qtyHtml}</div>` : ""}
    <div class="poolgrid">${pool.map(([i, dl]) => `<div class="pooli">${itemLink(i)}<span class="mute">drop Lv ${dl} · ${pct(each)}</span></div>`).join("")}</div></details>`;
}

// all magatama that can give item i when dissolved, at dissolution skill level lv
//   recipe: unit chance per recipe unit · pool: no-recipe magatama pick 1 of their random pool · consolation: recipe magatama that returned nothing
const POOL_CACHE = new Map();
const poolOf = lv => { lv = Math.max(lv, 20); if (!POOL_CACHE.has(lv)) POOL_CACHE.set(lv, matPool(lv).map(([m]) => m)); return POOL_CACHE.get(lv); };
const disQty = lv => lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
function disSources(i, lv){
  const p = disUnitChance(lv), rows = [];
  (DIS_FROM[i] || []).forEach(k => { const d = DIS[k], q = RECIPES[d.r].m.filter(([m]) => m == i).reduce((a, [, n]) => a + n, 0), pp = d.ba ? 1 : p;
    rows.push({k, how: "recipe", q, pp, scale: 1, exp: q * pp, any: 1 - Math.pow(1 - pp, q)}); });
  DIS.forEach((d, k) => {
    if (d.ub || d.ba) return;
    if (d.r < 0){
      const pool = poolOf(d.lv + 2); if (!pool.includes(i)) return;
      const q = disQty(lv), n = pool.length;
      rows.push({k, how: "pool", n, q, pp: p, scale: 1 / n, exp: q * p / n, any: (1 - Math.pow(1 - p, q)) / n});
    } else {
      const pool = poolOf(d.lv - 15); if (!pool.includes(i)) return;
      const none = RECIPES[d.r].m.reduce((a, [, n]) => a * Math.pow(1 - p, n), 1);
      rows.push({k, how: "cons", n: pool.length, q: 1, pp: 1, scale: none / pool.length, exp: none / pool.length, any: none / pool.length});
    }
  });
  return rows.sort((a, b) => b.exp - a.exp);
}

// what a magatama gives back, as small icons + names for the list
function disGivesShort(d){
  if (d.ub) return `<span class="dgl">Lv ${d.lv}</span><span class="bad">Can't be dissolved</span>`;
  if (d.r < 0) return `<span class="dgl">Lv ${d.lv}</span><span class="faint">1 of ${matPool(d.lv + 2).length} random materials (drop Lv ${Math.max(20, d.lv + 2) - 30}–${Math.max(20, d.lv + 2)})</span>`;
  const m = RECIPES[d.r].m, show = m.slice(0, 3);
  return `<span class="dgl">Lv ${d.lv}</span>` + show.map(([i, n]) => `<span class="dg" title="${esc(ITEMS[i][0])}${n > 1 ? " ×" + n : ""}">${icon(ITEMS[i])}<span>${n > 1 ? n + "× " : ""}${esc(ITEMS[i][0])}</span></span>`).join("")
    + (m.length > 3 ? `<span class="dgm">+${m.length - 3}</span>` : "");
}

function disResultHtml(k, lv){
  const d = DIS[k], p = disUnitChance(lv), r = d.r >= 0 ? RECIPES[d.r] : null, g = disGems(d, lv);
  const mats = r && !d.ub ? r.m.map(([m, n]) => { const pp = d.ba ? 1 : p; return {m, n, exp: n * pp, any: 1 - Math.pow(1 - pp, n)}; }) : [];
  const pNothing = mats.length ? mats.reduce((a, x) => a * (1 - x.any), 1) : 1;
  return `${d.ub ? `<div class="callout"><span>This magatama is marked as <b>unbreakable</b> in the game: the NPC refuses to dissolve it.</span></div>` : `
      <h3 class="sub-h" style="margin-top:14px">Materials ${d.ba ? `<span class="count">all of them come back</span>` : r ? `<span class="count">each unit: ${(p * 100).toFixed(0)}%</span>` : ""}</h3>
      ${r ? `<div class="wrap"><table class="tbl"><thead><tr><th>Material</th><th class="r">In the recipe</th><th class="r">Expected back</th><th class="r">At least 1</th><th>Chance of each amount</th></tr></thead><tbody>
        ${mats.map(x => `<tr><td>${itemLink(x.m)}</td><td class="r num">×${fmt(x.n)}</td><td class="r num"><b>${x.exp >= 10 ? fmt(Math.round(x.exp)) : x.exp.toFixed(2)}</b></td><td class="r">${pct(x.any)}</td><td class="qds">${qtyDist(x.n, d.ba ? 1 : p)}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="hint">Recipe: <a href="#/item/${r.i}" style="color:var(--accent2)">${esc(ITEMS[r.i][0])}</a> · ${fmt(r.p)} ryou to craft.${!d.ba && pNothing > 0.0005 ? ` If nothing comes back (${(pNothing * 100).toFixed(pNothing < .01 ? 2 : 1)}%), you get 1 random material instead:` : ""}</div>
        ${!d.ba && pNothing > 0.0005 ? poolHtml(d.lv - 15, `Consolation pool (drop Lv ${Math.max(20, d.lv - 15) - 30}–${Math.max(20, d.lv - 15)})`, pNothing, `<span class="qd"><b>×1</b> always</span>`).replace("<details class=\"grp pool\" open>", "<details class=\"grp pool\">") : ""}`
      : `<div class="note">No crafting recipe: you get <b>${lv >= 6 ? 3 : lv >= 3 ? 2 : 1}× one random material</b>${lv >= 8 ? " plus 1 more (different) random material" : ""} from the pool below; each unit still has the ${(p * 100).toFixed(0)}% chance to come back.</div>
         ${poolHtml(d.lv + 2, `Random material pool (drop Lv ${Math.max(20, d.lv + 2) - 30}–${Math.max(20, d.lv + 2)})`, 1 - Math.pow(1 - p, disQty(lv)), qtyDist(disQty(lv), p))}`}
      ${!d.ba ? `<h3 class="sub-h" style="margin-top:16px">Gemstones</h3>
        ${g.chance > 0 ? `<div class="gemline"><span><b>${pct(g.chance)}</b> chance of gems · avg ${g.avg.toFixed(2)} per dissolve</span><span class="qds">${g.dist.map(([c, pc]) => `<span class="qd"><b>×${c}</b> ${pct(pc)}</span>`).join("")}</span></div>
          <div class="chips" style="margin-top:6px">${g.types.map(i => `<span class="chip">${itemLink(i)}</span>`).join("")}</div><div class="hint">One gem type per dissolve, picked at random: each type ${pct(g.chance / g.types.length)} per dissolve.</div>`
          : `<div class="mute" style="font-size:12.5px">No gems at this level (needs a magatama of Lv 10+${lv == 1 ? " or a higher dissolution level" : ""}).</div>`}` : ""}`}`;
}

function viewDissolve(){
  setCrumbs([["Tools"], ["Magatama Dissolution"]]);
  const lv = DUI.lv;
  app.innerHTML = `${ph({title:"Magatama Dissolution", sub:"What you get back when you dissolve a magatama at the NPC. Rules taken from the server code: each unit of the recipe has its own chance to come back, plus random gemstones."})}
  <div class="toolbar">
    <span class="ctl">Dissolution skill (解体) level</span>
    <div class="seg" id="dlv">${[1,2,3,4,5,6,7,8,9,10].map(l => `<button data-l="${l}" class="${lv == l ? "on" : ""}">${l}</button>`).join("")}</div>
    <span class="mute" style="font-size:12.5px">Per unit: <b class="${disUnitChance(lv) >= .4 ? "ok" : "meh"}">${(disUnitChance(lv) * 100).toFixed(0)}%</b> chance to get it back</span>
  </div>
  <div class="dis">
    <aside class="pnl dis-list">
      <input type="text" id="dq" placeholder="Search a magatama…" value="${esc(DUI.q)}" aria-label="Search a magatama">
      <div class="seg sm" id="dshow" style="margin:8px 0"><button data-s="all" class="${DUI.show == "all" ? "on" : ""}">All</button><button data-s="ok" class="${DUI.show == "ok" ? "on" : ""}">With recipe</button><button data-s="ba" class="${DUI.show == "ba" ? "on" : ""}">Return all</button><button data-s="it" class="${DUI.show == "it" ? "on" : ""}" title="Magatama whose dissolution gives materials or quest items (not other magatama)">Give items</button></div>
      <div id="dlist" class="dlist"></div>
    </aside>
    <section id="dout" class="dis-out"></section>
  </div>`;
  const drawList = () => {
    const q = DUI.q.trim().toLowerCase();
    const list = DIS.map((d, k) => k).filter(k => { const d = DIS[k], it = ITEMS[d.c];
      return (!q || (it[0] + " " + it[1]).toLowerCase().includes(q)) && (DUI.show == "all" || (DUI.show == "ok" ? d.r >= 0 && !d.ub && !d.ba : DUI.show == "it" ? d.r >= 0 && !d.ub && RECIPES[d.r].m.some(([m]) => ![8, 9, 26].includes(ITEMS[m][2])) : d.ba)); })
      .sort((a, b) => DIS[a].ub - DIS[b].ub || DIS[b].lv - DIS[a].lv || ITEMS[DIS[a].c][0].localeCompare(ITEMS[DIS[b].c][0]));
    $("#dlist").innerHTML = list.slice(0, 300).map(k => { const d = DIS[k], it = ITEMS[d.c], [cls, txt] = disStatus(d);
      return `<button class="drow ${DUI.sel == d.c ? "on" : ""}" data-dk="${d.c}">${icon(it)}<span class="nm"><b>${esc(it[0])}</b><span class="dgives">${disGivesShort(d)}</span></span><span class="dst ${cls}" title="${txt}">${{ub:"✕", ba:"ALL", nr:"?", ok:""}[cls]}</span></button>`; }).join("")
      + (list.length > 300 ? `<div class="mute" style="padding:8px">Showing 300 of ${list.length}, search to narrow down.</div>` : "") || emptyState("Nothing found");
    $$("[data-dk]").forEach(b => b.onclick = () => { DUI.sel = +b.dataset.dk; store("od2-dis", DUI); drawList(); drawOut(); });
  };
  const drawOut = () => {
    const out = $("#dout"), k = DIS_BY[DUI.sel];
    if (k == null){ out.innerHTML = `<div class="pnl">${emptyState("Pick a magatama", "Choose one on the left to see what it gives back.")}</div>`; return; }
    const d = DIS[k], it = ITEMS[d.c], [cls, txt] = disStatus(d), p = disUnitChance(lv), r = d.r >= 0 ? RECIPES[d.r] : null, g = disGems(d, lv);
    const mats = r && !d.ub ? r.m.map(([m, n]) => { const pp = d.ba ? 1 : p; return {m, n, exp: n * pp, any: 1 - Math.pow(1 - pp, n)}; }) : [];
    const pNothing = mats.length ? mats.reduce((a, x) => a * (1 - x.any), 1) : 1;
    out.innerHTML = `<div class="pnl">
      <div class="dis-head">${icon(it)}<div><a href="#/item/${d.c}" class="rk-${it[4]}"><b class="nm">${esc(it[0])}</b></a><div class="jp">${esc(it[1])} · Lv ${d.lv}</div></div>
        <span class="badge dst-b ${cls}">${txt.toUpperCase()}</span></div>
      <div class="kvr" style="margin-top:10px"><span>How to get this magatama</span><b style="font-weight:500">${howToGet(d.c)}</b></div>
      ${disResultHtml(k, lv)}
    </div>`;
  };
  $("#dq").oninput = e => { DUI.q = e.target.value; store("od2-dis", DUI); drawList(); };
  $$("#dshow button").forEach(b => b.onclick = () => { DUI.show = b.dataset.s; store("od2-dis", DUI); $$("#dshow button").forEach(x => x.classList.toggle("on", x == b)); drawList(); });
  $$("#dlv button").forEach(b => b.onclick = () => { DUI.lv = +b.dataset.l; store("od2-dis", DUI); viewDissolve(); });
  if (DUI.sel == null || DIS_BY[DUI.sel] == null){ const f = DIS.find(d => d.r >= 0 && !d.ub); DUI.sel = f ? f.c : null; }
  drawList(); drawOut();
  const on = $(".drow.on"); if (on) on.scrollIntoView({block: "nearest"});
}
