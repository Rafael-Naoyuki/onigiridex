"use strict";
/* OnigiriDex — Farm Planner: pick items to make, see the whole crafting tree and the raw materials to farm */
const PLAN = load("od2-plan", {targets: [], own: {}, nocraft: {}, rsel: {}, view: "list"});
const savePlan = () => store("od2-plan", PLAN);
function planAdd(i, q = 1){
  const t = PLAN.targets.find(x => x.i == i);
  if (t) t.q += q; else PLAN.targets.push({i, q});
  savePlan();
}

// crafting tree with a shared "already have" pool, so an item you own is only counted once
function planCompute(){
  const pool = Object.assign({}, PLAN.own);
  const raw = new Map(), recipes = new Map(), gross = new Map(), choices = new Map();
  let crafts = 0, ryou = 0, nodes = 0;
  const visit = (i, qty, depth, seen) => {
    nodes++;
    const take = Math.min(pool[i] || 0, qty); if (take) pool[i] -= take;
    const rest = qty - take, list = RCP_MAKE[i] || [];
    const n = {i, qty, have: take, rest, kids: [], canCraft: list.length > 0, alt: list.length};
    const craft = n.canCraft && !PLAN.nocraft[i] && !seen.has(i) && depth < 14 && nodes < 6000;
    if (rest > 0 && craft){
      const rk = list[recipeSel(i)], r = RECIPES[rk];
      if (list.length > 1) choices.set(i, (choices.get(i) || 0) + Math.ceil(rest / (r.n || 1)));
      n.crafting = true; n.rk = rk; n.crafts = Math.ceil(rest / (r.n || 1)); n.ryou = n.crafts * (r.p || 0);
      crafts += n.crafts; ryou += n.ryou;
      if (r.r != null) recipes.set(r.r, (recipes.get(r.r) || 0) + n.crafts);
      const s2 = new Set(seen).add(i);
      n.kids = r.m.map(([m, c]) => visit(m, c * n.crafts, depth + 1, s2));
    } else if (!(n.canCraft && !PLAN.nocraft[i] && rest == 0)){
      // raw material (or something you chose to get ready-made): gross need and what is still missing
      const g = gross.get(i) || {need: 0, rest: 0}; g.need += qty; g.rest += rest; gross.set(i, g);
      if (rest > 0) raw.set(i, (raw.get(i) || 0) + rest);
    }
    return n;
  };
  const roots = PLAN.targets.filter(t => ITEMS[t.i]).map(t => visit(t.i, Math.max(1, t.q | 0), 0, new Set()));
  return {roots, raw, gross, recipes, crafts, ryou, choices};
}

// short description of a recipe, so two recipes of the same item can be told apart
function recipeLabel(rk, long = false){
  const r = RECIPES[rk], m = r.m;
  if (long) return m.map(([i, n]) => `${ITEMS[i][0]} ×${fmt(n)}`).join(", ") + (r.r != null ? ` · needs ${ITEMS[r.r][0]}` : "") + ` · ${fmtM(r.p)} ryou`;
  return `${ITEMS[m[0][0]][0]} ×${fmt(m[0][1])}${m.length > 1 ? ` +${m.length - 1}` : ""}${r.r != null ? " · scroll" : ""}`;
}
const recipeSel = i => (PLAN.rsel[i] || 0) % (RCP_MAKE[i] || [1]).length;

// ---- items of the plan that can be made in more than one way: shown first so you pick before reading the tree
function planChoices(choices){
  if (!choices.size) return "";
  const src = itemSources(S.party);
  const mat = ([m, n]) => { const b = bestAny(src, m); return `<li>${itemLink(m)}<span class="q">×${fmt(n)}</span>${b ? `<span class="pc-src">${pct(b.p)}</span>` : RCP_MAKE[m] ? `<span class="pc-src faint">craft</span>` : ""}</li>`; };
  const undecided = [...choices.keys()].filter(i => PLAN.rsel[i] == null).length;
  return `<details class="card plan-choose" id="pchoose" ${PLAN.showChoose !== false ? "open" : ""}>
    <summary class="sim-head"><h3>Choose a recipe <span class="mute">${choices.size} item${choices.size > 1 ? "s" : ""} in your plan can be made in more than one way${undecided ? ` · <b class="pc-und">${undecided} still on the default</b>` : " · all chosen ✓"}</span></h3><span class="plan-rec-t">${PLAN.showChoose !== false ? "Hide" : "Show"}</span></summary>
    <div class="pc-list">${[...choices.keys()].map(i => `<div class="pc-item">
      <div class="pc-name">${itemLink(i)}<span class="mute">${PLAN.rsel[i] != null ? `<span class="ok">✓ chosen</span>` : "default: recipe 1"}</span></div>
      <div class="pc-opts">${RCP_MAKE[i].map((rk, k) => { const r = RECIPES[rk], on = recipeSel(i) == k;
        return `<div class="pc-opt ${on ? "on" : ""}" data-rpick="${i}|${k}" role="button" tabindex="0" aria-pressed="${on}">
          <div class="pc-oh"><b>Recipe ${k + 1}</b>${on ? `<span class="pc-use">✓ in use</span>` : `<span class="pc-use off">use this</span>`}</div>
          <ul>${r.m.map(mat).join("")}</ul>
          <div class="pc-meta"><span>${fmtM(r.p)} ryou</span>${r.r != null ? `<span>needs ${esc(ITEMS[r.r][0])}</span>` : `<span>no scroll needed</span>`}</div>
        </div>`; }).join("")}</div></div>`).join("")}</div>
  </details>`;
}

// ---- list view (indented rows)
const PLAN_OPEN = new Map();   // tree path -> open, kept while re-rendering
function planNode(n, depth, path){
  const it = ITEMS[n.i];
  const haveIn = `<label class="pn-have" title="How many you already have"><span>have</span><input type="number" min="0" data-own="${n.i}" value="${PLAN.own[n.i] || ""}" placeholder="0"></label>`;
  const status = n.rest == 0 ? `<span class="pn-ok">✓ have enough</span>`
    : n.crafting ? `<span class="pn-craft">Craft ×${fmt(n.crafts)}${n.ryou ? ` · ${fmtM(n.ryou)} ryou` : ""}</span>`
    : `<span class="pn-need">Get ×${fmt(n.rest)}</span>`;
  const ctl = n.canCraft ? `<button class="pn-tog ${PLAN.nocraft[n.i] ? "" : "on"}" data-nocraft="${n.i}" title="${PLAN.nocraft[n.i] ? "Craft it from its materials" : "Don't craft — I'll get it ready-made"}">${PLAN.nocraft[n.i] ? "Get it" : "Craft it"}</button>
` : "";
  // two or more recipes: pick one, each button says what it needs
  const recipes = n.canCraft && n.alt > 1 && !PLAN.nocraft[n.i] ? `<div class="pn-recipes"><span>Recipe</span>${RCP_MAKE[n.i].map((rk, k) => `<button class="pn-rb ${recipeSel(n.i) == k ? "on" : ""}" data-rpick="${n.i}|${k}" title="${esc(recipeLabel(rk, true))}" aria-pressed="${recipeSel(n.i) == k}"><b>${k + 1}</b>${esc(recipeLabel(rk))}</button>`).join("")}</div>` : "";
  const head = `<div class="pn-row ${n.rest == 0 ? "done" : ""}"><span class="pn-q">×${fmt(n.qty)}</span>${itemLink(n.i)}<span class="pn-kind">${esc(KIND[it[2]] || "")}</span>
    <span class="pn-sp"></span>${status}${ctl}${haveIn}</div>${recipes}`;
  if (!n.kids.length) return `<div class="pn leaf">${head}</div>`;
  const open = PLAN_OPEN.has(path) ? PLAN_OPEN.get(path) : depth < 1;
  return `<details class="pn" data-path="${path}" ${open ? "open" : ""}><summary>${head}</summary><div class="pn-kids">${n.kids.map((k, x) => planNode(k, depth + 1, path + "." + x)).join("")}</div></details>`;
}

// ---- tree diagram (boxes joined by lines, left to right)
const PLAN_DOPEN = new Map();  // diagram path -> open
let PLAN_DDEF = null;          // null = default depth, true / false after "expand / collapse all"
function diaNode(n, depth, path){
  const has = n.kids.length > 0;
  const open = has && (PLAN_DOPEN.has(path) ? PLAN_DOPEN.get(path) : PLAN_DDEF != null ? PLAN_DDEF : depth < 1);
  const cls = n.rest == 0 ? "ok" : n.crafting ? "craft" : "get";
  let info;
  if (n.rest == 0) info = `<b>✓ have ${fmt(n.have)}</b>`;
  else if (n.crafting) info = `<b>Craft ×${fmt(n.crafts)}</b>${n.ryou ? `<span>${fmtM(n.ryou)} ryou</span>` : ""}`;
  else { const s = gearSources(n.i)[0]; info = `<b>Get ×${fmt(n.rest)}</b>${s ? `<span class="gs-${s.k}">${esc(s.label)}</span>` : `<span class="faint">event / quest</span>`}`; }
  return `<li><div class="tgn ${cls}" title="${esc(ITEMS[n.i][0])}${n.have ? ` · you have ${n.have}` : ""}">
      <div class="tgn-top"><span class="tgq">×${fmt(n.qty)}</span>${itemLink(n.i)}</div>
      <div class="tgn-i">${info}${n.alt > 1 && n.canCraft ? `<button class="tgr" data-rcycle="${n.i}" title="${n.alt} recipes — click to switch:\n${esc(RCP_MAKE[n.i].map((rk, k) => `${recipeSel(n.i) == k ? "▶" : "  "} Recipe ${k + 1}: ${recipeLabel(rk, true)}`).join("\n"))}">⇄ ${recipeSel(n.i) + 1}/${n.alt}</button>` : ""}${has ? `<button class="tgt" data-dtog="${path}" aria-expanded="${open}" title="${open ? "Hide" : "Show"} its ${n.kids.length} materials">${open ? "−" : "+" + n.kids.length}</button>` : ""}</div>
    </div>${open ? `<ul>${n.kids.map((k, x) => diaNode(k, depth + 1, path + "." + x)).join("")}</ul>` : ""}</li>`;
}

// raw materials grouped by type (weapons first, then magatama, materials, gems...); finished rows go to the end of each group
const PLAN_KIND_ORDER = [8, 13, 9, 26, 1, 14, 18, 11];
function planGroups(gross){
  const byKind = new Map();
  for (const [i, g] of gross){ const k = ITEMS[i][2]; (byKind.get(k) || byKind.set(k, []).get(k)).push([i, g]); }
  const rank = k => { const x = PLAN_KIND_ORDER.indexOf(k); return x < 0 ? 99 : x; };
  const kinds = [...byKind.keys()].sort((a, b) => rank(a) - rank(b) || a - b);
  if (!kinds.length) return `<tr><td colspan="5">${emptyState("Nothing to farm", "Everything in this plan is crafted from items you already have.")}</td></tr>`;
  return kinds.map(k => {
    const rows = byKind.get(k).sort((a, b) => (a[1].rest == 0) - (b[1].rest == 0) || b[1].rest - a[1].rest || ITEMS[a[0]][0].localeCompare(ITEMS[b[0]][0]));
    const left = rows.filter(r => r[1].rest > 0).length;
    return `<tr class="pl-grp"><td colspan="5">${esc(KIND[k] || "Other")}<span>${left ? `${left} to get` : "all done ✓"}</span></td></tr>` +
      rows.map(([i, g]) => `<tr class="${g.rest == 0 ? "pl-done" : ""}"><td class="name">${itemLink(i)}</td><td class="r num">${fmt(g.need)}</td>
        <td class="r"><input class="pl-have" type="number" min="0" data-own="${i}" value="${PLAN.own[i] || ""}" placeholder="0" aria-label="Have"></td>
        <td class="r num">${g.rest ? `<b>${fmt(g.rest)}</b>` : `<span class="ok">✓</span>`}</td>
        <td>${g.rest ? gearChips(i, gearSources(i)) : ""}</td></tr>`).join("");
  }).join("");
}

// ---- "What to farm" grouped by place: a dungeon that drops several of your materials becomes one card
function planPlaces(gross){
  const need = [...gross.entries()].filter(([, g]) => g.rest > 0).map(([i, g]) => ({i, rest: g.rest, need: g.need}));
  const done = [...gross.entries()].filter(([, g]) => g.rest == 0).map(([i, g]) => ({i, need: g.need}));
  if (!need.length && !done.length) return emptyState("Nothing to farm", "Everything in this plan is crafted from items you already have.");
  const items = need.map(x => x.i);
  const rows = items.length ? farmRows(items, S.party) : [];
  // best chance per full clear for each material, and the places that are "good enough" (>= half of its best)
  const bestIn = list => items.map((_, k) => Math.max(0, ...list.map(r => 1 - r.per[k].none)));
  const bestNormal = bestIn(rows.filter(r => !r.d.ara)), bestAll = bestIn(rows);
  const ok = (r, k) => { const ref = !r.d.ara && bestNormal[k] > 0 ? bestNormal[k] : bestAll[k];
    return r.per[k].exp > 0 && ref > 0 && (1 - r.per[k].none) >= ref * 0.5; };
  const left = new Set(items.map((_, k) => k)), groups = [];
  // normal dungeons first; Aramitama (random monsters) only for what drops nowhere else
  for (const pool of [rows.filter(r => !r.d.ara), rows]) while (true){
    let pick = null, pickN = 0, pickS = 0;
    for (const r of pool){
      let n = 0, s = 0;
      for (const k of left) if (ok(r, k)){ n++; s += 1 - r.per[k].none; }
      if (n > pickN || (n == pickN && n && s > pickS)){ pick = r; pickN = n; pickS = s; }
    }
    if (!pick) break;
    const ks = [...left].filter(k => ok(pick, k));
    ks.forEach(k => left.delete(k));
    groups.push({r: pick, ks});
  }
  // what does not drop in dungeons: fields, shops, boxes, appraise, events
  const other = new Map();
  for (const k of left){
    const i = items[k], src = gearSources(i);
    const f = (itemSources(S.party)[i] || []).filter(r => r.t == "f").sort((a, b) => b.p - a.p)[0];
    const key = f ? "f:" + f.sid : src.find(s => s.k == "reward") ? "reward" : src.find(s => s.label == "Appraise") ? "appraise" : src.find(s => s.k == "shop") ? "shop" : src.find(s => s.k == "box") ? "box" : "none";
    (other.get(key) || other.set(key, []).get(key)).push(k);
  }
  const haveIn = i => `<input class="pl-have" type="number" min="0" data-own="${i}" value="${PLAN.own[i] || ""}" placeholder="0" aria-label="Have">`;
  const runsTxt = (rest, exp) => exp > 0 ? Math.ceil(rest / exp) : Infinity;
  const card = (title, sub, cls, body, extra = "") => `<div class="pf-card ${cls}"><div class="pf-h"><div class="pf-t">${title}</div>${extra}</div>${sub ? `<div class="pf-sub">${sub}</div>` : ""}${body}</div>`;
  let html = groups.map(({r, ks}) => {
    const runs = Math.max(...ks.map(k => runsTxt(need[k].rest, r.per[k].exp)));
    const body = `<table class="pf-tbl"><thead><tr><th>Item</th><th class="r">Missing</th><th class="r"><span class="tip" title="Chance to get at least one in one full clear">Per run</span></th><th class="r"><span class="tip" title="Average runs to collect what is missing">Runs</span></th><th class="r">Have</th></tr></thead><tbody>
      ${ks.sort((a, b) => runsTxt(need[b].rest, r.per[b].exp) - runsTxt(need[a].rest, r.per[a].exp)).map(k => { const x = need[k], p = r.per[k], rn = runsTxt(x.rest, p.exp);
        return `<tr><td class="name">${itemLink(x.i)}${p.best?.eid != null ? `<div class="pf-mob">${esc(E[p.best.eid]?.n || "")}${p.best.boss ? " · boss" : ""}</div>` : p.best?.rank ? `<div class="pf-mob">clear reward</div>` : ""}</td>
          <td class="r num"><b>${fmt(x.rest)}</b></td><td class="r">${pct(1 - p.none)}</td><td class="r num">${isFinite(rn) ? "~" + fmt(rn) : "—"}</td><td class="r">${haveIn(x.i)}</td></tr>`; }).join("")}</tbody></table>`;
    return card(`${dunLink(r.d.id)} <span class="chip d${r.diff}"><b>${DIFFS[r.diff]}</b></span>`, [r.d.gn ? esc(r.d.gn) : "", r.L.lv > 0 ? `Lv ${r.L.lv}` : "", `<b>${ks.length}</b> item${ks.length > 1 ? "s" : ""} here`, isFinite(runs) ? `~${fmt(runs)} runs for all` : ""].filter(Boolean).join(" · "), "dun", body,
      `<button class="btn sm" data-pfgo="${ks.map(k => items[k]).join(",")}" title="Compare with other dungeons in the Farm Finder">Farm Finder</button>`);
  }).join("");
  const OTHER_T = {reward: ["Clear rewards", "From finishing a dungeon with a given rank"], appraise: ["Appraise unidentified weapons", "Comes from appraising ??? weapons"], shop: ["Shops & exchanges", "Buy or trade for it"], box: ["Lucky boxes", "Comes out of lucky boxes"], none: ["Events, quests or cash shop", "No drop, shop or box found in the game data"]};
  const order = k => k.startsWith("f:") ? 0 : ["reward", "appraise", "shop", "box", "none"].indexOf(k) + 1;
  html += [...other.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([key, ks]) => {
    const t = key.startsWith("f:") ? [`<a href="#/field/${key.slice(2)}">${esc(ST[key.slice(2)]?.n || "Field")}</a> <span class="chip">FIELD</span>`, "Respawning field monsters"] : OTHER_T[key];
    const body = `<table class="pf-tbl"><thead><tr><th>Item</th><th class="r">Missing</th><th>How to get</th><th class="r">Have</th></tr></thead><tbody>
      ${ks.map(k => { const x = need[k]; return `<tr><td class="name">${itemLink(x.i)}</td><td class="r num"><b>${fmt(x.rest)}</b></td><td>${gearChips(x.i, gearSources(x.i))}</td><td class="r">${haveIn(x.i)}</td></tr>`; }).join("")}</tbody></table>`;
    return card(t[0], t[1] + ` · <b>${ks.length}</b> item${ks.length > 1 ? "s" : ""}`, key.startsWith("f:") ? "field" : key, body);
  }).join("");
  if (done.length) html += `<details class="pf-card done"><summary class="pf-h"><div class="pf-t">Already have <span class="ok">✓</span></div><span class="mute">${done.length} item${done.length > 1 ? "s" : ""}</span></summary>
    <table class="pf-tbl"><tbody>${done.map(x => `<tr><td class="name">${itemLink(x.i)}</td><td class="r num">${fmt(x.need)}</td><td class="r">${haveIn(x.i)}</td></tr>`).join("")}</tbody></table></details>`;
  return `<div class="pf-grid">${html}</div>`;
}

// ---- browse every weapon / magatama / accessory
const PLAN_BROWSE = [{id:"weapons", label:"Weapons", kind:8}, {id:"magatama", label:"Magatama", kind:9}, {id:"accessories", label:"Accessories", kind:26}];
const PB = {q:"", cat:-1, craft:true, limit:60};
function browseList(){
  const b = PLAN_BROWSE.find(x => x.id == PLAN.browse); if (!b) return [];
  const q = PB.q.trim().toLowerCase();
  const lvOf = i => gearRec(i)?.lv || ITEMS[i][6] || 0;
  return ITEMS.map((it, i) => i).filter(i => {
    const it = ITEMS[i];
    if (!it || it[2] != b.kind || isTestItem(it)) return false;
    if (PB.craft && !RCP_MAKE[i]) return false;
    if (b.kind == 8 && PB.cat >= 0 && gearRec(i)?.c != PB.cat) return false;
    return !q || (it[0] + " " + it[1]).toLowerCase().includes(q);
  }).sort((a, b2) => lvOf(b2) - lvOf(a) || ITEMS[a][0].localeCompare(ITEMS[b2][0]));
}
function drawBrowse(){
  const box = $("#pblist"); if (!box) return;
  const list = browseList(), inPlan = new Map(PLAN.targets.map(t => [t.i, t.q]));
  $("#pbcount").textContent = `${fmt(list.length)} ${PB.craft ? "craftable" : ""}`;
  box.innerHTML = list.slice(0, PB.limit).map(i => { const x = gearRec(i), q = inPlan.get(i);
    return `<div class="pb-row">${itemLink(i)}<span class="pb-meta">${x?.c != null && ITEMS[i][2] == 8 ? esc(CATS[x.c]) + " · " : ""}Lv ${x?.lv || ITEMS[i][6] || "—"}${RCP_MAKE[i] ? "" : ` · <span class="faint">no recipe</span>`}</span>
      <button class="addbtn ${q ? "on" : ""}" data-padd="${i}" title="Add one to the plan">${q ? `✓ ×${q}` : "+ Add"}</button></div>`; }).join("")
    + (list.length > PB.limit ? `<button class="more" id="pbmore">Show more (${fmt(list.length - PB.limit)})</button>` : "")
    || emptyState("Nothing matches", "");
  box.querySelectorAll("[data-padd]").forEach(a => a.onclick = () => { planAdd(+a.dataset.padd); planRerender(); });
  const m = $("#pbmore"); if (m) m.onclick = () => { PB.limit += 60; drawBrowse(); };
}

function viewPlan(){
  setCrumbs([["Tools"], ["Farm Planner"]]);
  const res = planCompute();
  const rawList = [...res.raw.entries()].sort((a, b) => ITEMS[a[0]][0].localeCompare(ITEMS[b[0]][0]));
  const farmable = rawList.filter(([i]) => (itemSources(S.party)[i] || []).length).map(([i]) => i);
  const recList = [...res.recipes.entries()];
  const dia = PLAN.view == "tree";
  const br = PLAN_BROWSE.find(x => x.id == PLAN.browse);
  app.innerHTML = `${ph({title:"Farm Planner", sub:"Pick what you want to make: see every sub-item down to the raw materials, and what to farm."})}
  <section class="card plan-pick">
    <div class="plan-pick-row">
      <div class="picker"><input type="text" id="pq" placeholder="Search an item to make (e.g. Revolt, Sin, magatama)…" aria-label="Add an item" autocomplete="off"><div class="sugg" id="psugg"></div></div>
      <div class="seg plan-browse-btns" role="group" aria-label="Browse"><span class="mute">or browse</span>${PLAN_BROWSE.map(b => `<button data-pbrowse="${b.id}" class="${PLAN.browse == b.id ? "on" : ""}" aria-pressed="${PLAN.browse == b.id}">${b.label}</button>`).join("")}</div>
    </div>
    ${br ? `<div class="plan-browse">
      <div class="toolbar pb-tb"><input type="text" id="pbq" placeholder="Filter ${br.label.toLowerCase()}…" value="${esc(PB.q)}" aria-label="Filter">
        <label class="chk"><input type="checkbox" id="pbcraft" ${PB.craft ? "checked" : ""}> only craftable</label><span class="sp"></span><span class="mute" id="pbcount"></span>
        <button class="linkbtn" id="pbclose">Close</button></div>
      ${br.kind == 8 ? `<div class="seg gear-cats" id="pbcat">${[["-1", "All"], ...Object.entries(CATS)].map(([k, n]) => `<button data-c="${k}" class="${PB.cat == +k ? "on" : ""}">${+k >= 0 && catIcon(+k) ? iconOf(catIcon(+k)) : ""}${esc(n)}</button>`).join("")}</div>` : ""}
      <div class="pb-list" id="pblist"></div></div>` : ""}
    ${PLAN.targets.length ? `<div class="plan-targets">${PLAN.targets.map((t, k) => ITEMS[t.i] ? `<div class="pt">
      ${itemLink(t.i)}<div class="pt-q"><button data-tq="${k}|-1" aria-label="One less">−</button><input type="number" min="1" data-tqv="${k}" value="${t.q}" aria-label="Quantity"><button data-tq="${k}|1" aria-label="One more">+</button></div>
      <button class="pt-x" data-tdel="${k}" aria-label="Remove ${esc(ITEMS[t.i][0])}">✕</button></div>` : "").join("")}
      <button class="linkbtn" id="pclear">Clear all</button></div>` : `<div class="hint">Search an item or browse the lists. Items with a recipe come first.</div>`}
  </section>
  ${PLAN.targets.length ? `
  <div class="plan-kpis">
    <div class="sim-kpi main"><span>Raw materials to get</span><b>${fmt(rawList.length)}</b></div>
    <div class="sim-kpi"><span>Crafts</span><b>${fmt(res.crafts)}</b></div>
    <div class="sim-kpi"><span>Crafting cost</span><b>${fmtM(res.ryou)} <small>ryou</small></b></div>
    <div class="sim-kpi"><span>Recipes needed</span><b>${fmt(recList.length)}</b></div>
  </div>
  ${planChoices(res.choices)}
  <div class="plan-main ${dia ? "dia" : ""}">
    <section class="card plan-tree">
      <div class="sim-head"><h3>Crafting tree</h3><div class="sim-head-ctl">
        <div class="seg" role="group" aria-label="View"><button data-pview="list" class="${dia ? "" : "on"}">List</button><button data-pview="tree" class="${dia ? "on" : ""}">Tree</button></div>
        ${dia ? `<div class="seg" role="group" aria-label="Tree direction"><button data-pdir="v" class="${PLAN.dir == "h" ? "" : "on"}" title="Top to bottom">↓</button><button data-pdir="h" class="${PLAN.dir == "h" ? "on" : ""}" title="Left to right">→</button></div>` : ""}
        <button class="btn sm" id="pexp">Expand all</button><button class="btn sm" id="pcol">Collapse</button></div></div>
      ${dia ? `<div class="hint">Each box shows how many you need. Gold = craft it, green = farm / get it, faded = you already have it. Use the + / − buttons to open a branch.</div>
        <div class="tg ${PLAN.dir == "h" ? "h" : "v"}" id="tg"><ul class="tg-root">${res.roots.map((n, x) => diaNode(n, 0, n.i + ":" + x)).join("")}</ul></div>`
      : `<div class="hint">“Craft it” breaks an item into its materials. Switch to “Get it” if you'd rather farm or buy it ready-made. “have” is subtracted everywhere.</div>
        <div class="pn-root">${res.roots.map((n, x) => planNode(n, 0, n.i + ":" + x)).join("")}</div>`}
    </section>
    <section class="card plan-list">
      <div class="sim-head"><h3>What to farm</h3><div class="sim-head-ctl">
        <div class="seg" role="group" aria-label="Group by"><button data-pgrp="type" class="${PLAN.grp == "place" ? "" : "on"}" title="One table grouped by item type">By type</button><button data-pgrp="place" class="${PLAN.grp == "place" ? "on" : ""}" title="One card per dungeon: everything you can get there together">By place</button></div>
        ${farmable.length ? `<button class="btn pri sm" id="pfarm" title="Best dungeons for every raw material that drops">Open ${farmable.length} in Farm Finder</button>` : ""}</div></div>
      ${PLAN.grp != "place" ? `<div class="wrap"><table class="tbl plan-tbl"><thead><tr><th>Item</th><th class="r">Need</th><th class="r">Have</th><th class="r">Missing</th><th>How to get</th></tr></thead><tbody>
        ${planGroups(res.gross)}
      </tbody></table></div>` : `<div class="hint">Materials are grouped by the dungeon where you get the most of them at once (party of ${S.party}). “Runs” is the average number of full clears to collect what is missing.</div>${planPlaces(res.gross)}`}
      ${recList.length ? `<details class="plan-rec" id="precs" ${PLAN.showRec ? "open" : ""}><summary><h3 class="plan-sub">Recipes needed <span class="mute">${recList.length}</span></h3><span class="plan-rec-t">${PLAN.showRec ? "Hide" : "Show"}</span></summary>
      <div class="wrap"><table class="tbl plan-tbl"><thead><tr><th>Recipe</th><th class="r">Crafts</th><th>How to get</th></tr></thead><tbody>
        ${recList.map(([i, c]) => `<tr><td class="name">${itemLink(i)}</td><td class="r num">${fmt(c)}</td><td>${gearChips(i, gearSources(i))}</td></tr>`).join("")}
      </tbody></table></div></details>` : ""}
    </section>
  </div>` : ""}`;
  bindPlan(farmable);
  drawBrowse();
  if (!planRerender.busy) planCenterTree();
}

// top-to-bottom tree: start scrolled so the main item is in the middle
function planCenterTree(){
  const tg = $("#tg"); if (!tg || PLAN.dir == "h") return;
  const root = tg.querySelector(".tg-root > li > .tgn"); if (!root) return;
  const r = root.getBoundingClientRect(), t = tg.getBoundingClientRect();
  tg.scrollLeft = Math.max(0, tg.scrollLeft + (r.left + r.width / 2) - (t.left + tg.clientWidth / 2));
}
// re-render keeping the page and the diagram scrolled where they were
function planRerender(){
  savePlan();
  const y = window.scrollY, tg = $("#tg"), tl = tg ? tg.scrollLeft : 0, tt = tg ? tg.scrollTop : 0;
  planRerender.busy = true; viewPlan(); planRerender.busy = false;
  window.scrollTo(0, y);
  const t2 = $("#tg"); if (t2){ t2.scrollLeft = tl; t2.scrollTop = tt; }
}

function bindPlan(farmable){
  const re = planRerender;
  // item search: craftable items first
  const pq = $("#pq"), box = $("#psugg");
  pq.oninput = () => {
    const q = pq.value.trim().toLowerCase();
    if (q.length < 2){ box.classList.remove("show"); return; }
    const hits = [];
    for (let i = 0; i < ITEMS.length && hits.length < 400; i++){ const it = ITEMS[i]; if (it && !isTestItem(it) && (it[0] + " " + it[1]).toLowerCase().includes(q)) hits.push(i); }
    hits.sort((a, b) => (RCP_MAKE[b] ? 1 : 0) - (RCP_MAKE[a] ? 1 : 0) || ITEMS[b][4] - ITEMS[a][4] || ITEMS[a][0].localeCompare(ITEMS[b][0]));
    box.innerHTML = hits.slice(0, 14).map(i => `<a data-padd="${i}"><span>${icon(ITEMS[i])} <b>${esc(ITEMS[i][0])}</b> <span class="jp">${esc(ITEMS[i][1])}</span></span><span class="tag">${esc(KIND[ITEMS[i][2]] || "")}${RCP_MAKE[i] ? " · recipe" : ""}</span></a>`).join("") || `<div class="empty" style="padding:12px">Nothing found</div>`;
    box.classList.add("show");
    box.querySelectorAll("[data-padd]").forEach(a => a.onclick = () => { planAdd(+a.dataset.padd); re(); setTimeout(() => $("#pq")?.focus(), 0); });
  };
  // browse panel
  $$("[data-pbrowse]").forEach(b => b.onclick = () => { PLAN.browse = PLAN.browse == b.dataset.pbrowse ? null : b.dataset.pbrowse; PB.limit = 60; PB.cat = -1; re(); });
  if ($("#pbclose")) $("#pbclose").onclick = () => { PLAN.browse = null; re(); };
  if ($("#pbq")) $("#pbq").oninput = e => { PB.q = e.target.value; PB.limit = 60; drawBrowse(); };
  if ($("#pbcraft")) $("#pbcraft").onchange = e => { PB.craft = e.target.checked; PB.limit = 60; drawBrowse(); };
  $$("#pbcat button").forEach(b => b.onclick = () => { PB.cat = +b.dataset.c; $$("#pbcat button").forEach(x => x.classList.toggle("on", x == b)); PB.limit = 60; drawBrowse(); });
  // targets
  $$("[data-tq]").forEach(b => b.onclick = () => { const [k, d] = b.dataset.tq.split("|").map(Number); PLAN.targets[k].q = Math.max(1, PLAN.targets[k].q + d); re(); });
  $$("[data-tqv]").forEach(inp => inp.onchange = () => { PLAN.targets[+inp.dataset.tqv].q = Math.max(1, +inp.value || 1); re(); });
  $$("[data-tdel]").forEach(b => b.onclick = () => { PLAN.targets.splice(+b.dataset.tdel, 1); re(); });
  if ($("#pclear")) $("#pclear").onclick = () => { PLAN.targets = []; re(); };
  // list view
  $$(".plan-tree details").forEach(d => d.ontoggle = () => PLAN_OPEN.set(d.dataset.path, d.open));
  $$(".pn-have").forEach(l => l.onclick = e => { e.preventDefault(); e.stopPropagation(); l.querySelector("input").focus(); });
  $$("[data-own]").forEach(inp => { inp.onclick = e => e.stopPropagation(); inp.onchange = () => { const v = Math.max(0, +inp.value || 0); if (v) PLAN.own[inp.dataset.own] = v; else delete PLAN.own[inp.dataset.own]; re(); }; });
  $$("[data-nocraft]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const i = b.dataset.nocraft; if (PLAN.nocraft[i]) delete PLAN.nocraft[i]; else PLAN.nocraft[i] = 1; re(); });
  $$("[data-rsel]").forEach(s => { s.onclick = e => { e.preventDefault(); e.stopPropagation(); }; s.onchange = () => { PLAN.rsel[s.dataset.rsel] = +s.value; re(); }; });
  // diagram view
  $$("[data-pview]").forEach(b => b.onclick = () => { PLAN.view = b.dataset.pview; re(); planCenterTree(); });
  $$("[data-pdir]").forEach(b => b.onclick = () => { PLAN.dir = b.dataset.pdir; re(); planCenterTree(); });
  $$("[data-rpick]").forEach(b => b.onkeydown = e => { if (e.key == "Enter" || e.key == " "){ e.preventDefault(); b.click(); } });
  $$("[data-rpick]").forEach(b => b.onclick = e => { if (e.target.closest("a")) return; e.preventDefault(); e.stopPropagation(); const [i, k] = b.dataset.rpick.split("|").map(Number); PLAN.rsel[i] = k; re(); });
  $$("[data-rcycle]").forEach(b => b.onclick = e => { e.preventDefault(); const i = b.dataset.rcycle; PLAN.rsel[i] = (recipeSel(i) + 1) % RCP_MAKE[i].length; re(); });
  $$("[data-dtog]").forEach(b => b.onclick = e => { e.preventDefault(); const p = b.dataset.dtog; PLAN_DOPEN.set(p, b.getAttribute("aria-expanded") != "true"); re(); });
  if ($("#pexp")) $("#pexp").onclick = () => { if (PLAN.view == "tree"){ PLAN_DOPEN.clear(); PLAN_DDEF = true; re(); } else $$(".plan-tree details").forEach(d => d.open = true); };
  if ($("#pcol")) $("#pcol").onclick = () => { if (PLAN.view == "tree"){ PLAN_DOPEN.clear(); PLAN_DDEF = false; re(); } else $$(".plan-tree details").forEach(d => d.open = false); };
  if ($("#pfarm")) $("#pfarm").onclick = () => farmGo(farmable);
  $$("[data-pgrp]").forEach(b => b.onclick = () => { PLAN.grp = b.dataset.pgrp; re(); });
  $$("[data-pfgo]").forEach(b => b.onclick = () => farmGo(b.dataset.pfgo.split(",").map(Number)));
  if ($("#pchoose")) $("#pchoose").ontoggle = e => { PLAN.showChoose = e.target.open; savePlan(); const t = $("#pchoose .plan-rec-t"); if (t) t.textContent = PLAN.showChoose ? "Hide" : "Show"; };
  if ($("#precs")) $("#precs").ontoggle = e => { PLAN.showRec = e.target.open; savePlan(); $(".plan-rec-t").textContent = PLAN.showRec ? "Hide" : "Show"; };
}
