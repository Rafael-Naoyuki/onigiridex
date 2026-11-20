"use strict";
/* OnigiriDex — Farm Planner: pick items to make, see the whole crafting tree and the raw materials to farm */
const PLAN = load("od2-plan", {targets: [], own: {}, nocraft: {}, rsel: {}});
const savePlan = () => store("od2-plan", PLAN);
function planAdd(i, q = 1){
  const t = PLAN.targets.find(x => x.i == i);
  if (t) t.q += q; else PLAN.targets.push({i, q});
  savePlan();
}

// crafting tree with a shared "already have" pool, so an item you own is only counted once
function planCompute(){
  const pool = Object.assign({}, PLAN.own);
  const raw = new Map(), recipes = new Map(), gross = new Map();
  let crafts = 0, ryou = 0, nodes = 0;
  const visit = (i, qty, depth, seen) => {
    nodes++;
    const take = Math.min(pool[i] || 0, qty); if (take) pool[i] -= take;
    const rest = qty - take, list = RCP_MAKE[i] || [];
    const n = {i, qty, have: take, rest, kids: [], canCraft: list.length > 0, alt: list.length};
    const craft = n.canCraft && !PLAN.nocraft[i] && !seen.has(i) && depth < 14 && nodes < 6000;
    if (rest > 0 && craft){
      const rk = list[Math.min(PLAN.rsel[i] || 0, list.length - 1)], r = RECIPES[rk];
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
  return {roots, raw, gross, recipes, crafts, ryou};
}

// ---- view
const PLAN_OPEN = new Map();   // tree path -> open, kept while re-rendering
function planNode(n, depth, path){
  const it = ITEMS[n.i];
  const haveIn = `<label class="pn-have" title="How many you already have"><span>have</span><input type="number" min="0" data-own="${n.i}" value="${PLAN.own[n.i] || ""}" placeholder="0"></label>`;
  const status = n.rest == 0 ? `<span class="pn-ok">✓ have enough</span>`
    : n.crafting ? `<span class="pn-craft">Craft ×${fmt(n.crafts)}${n.ryou ? ` · ${fmtM(n.ryou)} ryou` : ""}</span>`
    : `<span class="pn-need">Get ×${fmt(n.rest)}</span>`;
  const ctl = n.canCraft ? `<button class="pn-tog ${PLAN.nocraft[n.i] ? "" : "on"}" data-nocraft="${n.i}" title="${PLAN.nocraft[n.i] ? "Craft it from its materials" : "Don't craft — I'll get it ready-made"}">${PLAN.nocraft[n.i] ? "Get it" : "Craft it"}</button>
      ${n.alt > 1 ? `<select data-rsel="${n.i}" title="Recipe">${RCP_MAKE[n.i].map((rk, k) => `<option value="${k}" ${(PLAN.rsel[n.i] || 0) == k ? "selected" : ""}>Recipe ${k + 1}</option>`).join("")}</select>` : ""}` : "";
  const head = `<div class="pn-row ${n.rest == 0 ? "done" : ""}"><span class="pn-q">×${fmt(n.qty)}</span>${itemLink(n.i)}<span class="pn-kind">${esc(KIND[it[2]] || "")}</span>
    <span class="pn-sp"></span>${status}${ctl}${haveIn}</div>`;
  if (!n.kids.length) return `<div class="pn leaf">${head}</div>`;
  const open = PLAN_OPEN.has(path) ? PLAN_OPEN.get(path) : depth < 1;
  return `<details class="pn" data-path="${path}" ${open ? "open" : ""}><summary>${head}</summary><div class="pn-kids">${n.kids.map((k, x) => planNode(k, depth + 1, path + "." + x)).join("")}</div></details>`;
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

function viewPlan(){
  setCrumbs([["Tools"], ["Farm Planner"]]);
  const res = planCompute();
  const rawList = [...res.raw.entries()].sort((a, b) => ITEMS[a[0]][0].localeCompare(ITEMS[b[0]][0]));
  const farmable = rawList.filter(([i]) => (itemSources(S.party)[i] || []).length).map(([i]) => i);
  const recList = [...res.recipes.entries()];
  app.innerHTML = `${ph({title:"Farm Planner", sub:"Pick what you want to make: see every sub-item down to the raw materials, and what to farm."})}
  <section class="card plan-pick">
    <div class="picker"><input type="text" id="pq" placeholder="Add an item to make (e.g. Revolt, Sin, magatama)…" aria-label="Add an item" autocomplete="off"><div class="sugg" id="psugg"></div></div>
    ${PLAN.targets.length ? `<div class="plan-targets">${PLAN.targets.map((t, k) => ITEMS[t.i] ? `<div class="pt">
      ${itemLink(t.i)}<div class="pt-q"><button data-tq="${k}|-1" aria-label="One less">−</button><input type="number" min="1" data-tqv="${k}" value="${t.q}" aria-label="Quantity"><button data-tq="${k}|1" aria-label="One more">+</button></div>
      <button class="pt-x" data-tdel="${k}" aria-label="Remove ${esc(ITEMS[t.i][0])}">✕</button></div>` : "").join("")}
      <button class="linkbtn" id="pclear">Clear all</button></div>` : `<div class="hint">Search an item above. Items with a recipe come first.</div>`}
  </section>
  ${PLAN.targets.length ? `
  <div class="plan-kpis">
    <div class="sim-kpi main"><span>Raw materials to get</span><b>${fmt(rawList.length)}</b></div>
    <div class="sim-kpi"><span>Crafts</span><b>${fmt(res.crafts)}</b></div>
    <div class="sim-kpi"><span>Crafting cost</span><b>${fmtM(res.ryou)} <small>ryou</small></b></div>
    <div class="sim-kpi"><span>Recipes needed</span><b>${fmt(recList.length)}</b></div>
  </div>
  <div class="plan-main">
    <section class="card plan-tree">
      <div class="sim-head"><h3>Crafting tree</h3><div class="sim-head-ctl"><button class="btn sm" id="pexp">Expand all</button><button class="btn sm" id="pcol">Collapse</button></div></div>
      <div class="hint">“Craft it” breaks an item into its materials. Switch to “Get it” if you'd rather farm or buy it ready-made. “have” is subtracted everywhere.</div>
      <div class="pn-root">${res.roots.map((n, x) => planNode(n, 0, n.i + ":" + x)).join("")}</div>
    </section>
    <section class="card plan-list">
      <div class="sim-head"><h3>What to farm</h3><div class="sim-head-ctl">${farmable.length ? `<button class="btn pri sm" id="pfarm" title="Best dungeons for every raw material that drops">Open ${farmable.length} in Farm Finder</button>` : ""}</div></div>
      <div class="wrap"><table class="tbl plan-tbl"><thead><tr><th>Item</th><th class="r">Need</th><th class="r">Have</th><th class="r">Missing</th><th>How to get</th></tr></thead><tbody>
        ${planGroups(res.gross)}
      </tbody></table></div>
      ${recList.length ? `<h3 class="plan-sub">Recipes needed</h3>
      <div class="wrap"><table class="tbl plan-tbl"><thead><tr><th>Recipe</th><th class="r">Crafts</th><th>How to get</th></tr></thead><tbody>
        ${recList.map(([i, c]) => `<tr><td class="name">${itemLink(i)}</td><td class="r num">${fmt(c)}</td><td>${gearChips(i, gearSources(i))}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
    </section>
  </div>` : ""}`;
  bindPlan(farmable);
}

function bindPlan(farmable){
  const re = () => { savePlan(); const y = window.scrollY; viewPlan(); window.scrollTo(0, y); };
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
  $$("[data-tq]").forEach(b => b.onclick = () => { const [k, d] = b.dataset.tq.split("|").map(Number); PLAN.targets[k].q = Math.max(1, PLAN.targets[k].q + d); re(); });
  $$("[data-tqv]").forEach(inp => inp.onchange = () => { PLAN.targets[+inp.dataset.tqv].q = Math.max(1, +inp.value || 1); re(); });
  $$("[data-tdel]").forEach(b => b.onclick = () => { PLAN.targets.splice(+b.dataset.tdel, 1); re(); });
  if ($("#pclear")) $("#pclear").onclick = () => { PLAN.targets = []; re(); };
  $$(".plan-tree details").forEach(d => d.ontoggle = () => PLAN_OPEN.set(d.dataset.path, d.open));
  $$(".pn-have").forEach(l => l.onclick = e => { e.preventDefault(); e.stopPropagation(); l.querySelector("input").focus(); });
  $$("[data-own]").forEach(inp => { inp.onclick = e => e.stopPropagation(); inp.onchange = () => { const v = Math.max(0, +inp.value || 0); if (v) PLAN.own[inp.dataset.own] = v; else delete PLAN.own[inp.dataset.own]; re(); }; });
  $$("[data-nocraft]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const i = b.dataset.nocraft; if (PLAN.nocraft[i]) delete PLAN.nocraft[i]; else PLAN.nocraft[i] = 1; re(); });
  $$("[data-rsel]").forEach(s => { s.onclick = e => { e.preventDefault(); e.stopPropagation(); }; s.onchange = () => { PLAN.rsel[s.dataset.rsel] = +s.value; re(); }; });
  if ($("#pexp")) $("#pexp").onclick = () => $$(".plan-tree details").forEach(d => d.open = true);
  if ($("#pcol")) $("#pcol").onclick = () => $$(".plan-tree details").forEach(d => d.open = false);
  if ($("#pfarm")) $("#pfarm").onclick = () => farmGo(farmable);
}
