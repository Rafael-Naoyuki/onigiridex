"use strict";
/* OnigiriDex — dungeon list and dungeon page */
// ---------------------------------------------------------------- dungeons
function dungeonCard(d){
  const L0 = d.L.find(Boolean);
  const bosses = L0 ? [...new Set(L0.b)].map(b => E[b]?.n).filter(Boolean).slice(0, 2).join(", ") : "";
  return `<a class="dcard" href="#/dungeon/${d.id}"><div class="t">${esc(d.n)} ${d.ara ? `<span class="badge b-ara">ARAMITAMA</span>` : ""}</div>
    <div class="jp">${esc(d.j)}</div>${bosses ? `<div class="boss">Boss · ${esc(bosses)}</div>` : ""}<div class="lvpills">${lvPills(d)}</div></a>`;
}
function viewDungeons(){
  setCrumbs([["Dungeons"]]);
  const st = load("od2-dfilter", {q:"", ev:false, sort:"region", maxLv:""});
  app.innerHTML = `${ph({title:"Dungeons", sub:"Grouped by the town or field where the entrance is, ordered by level."})}
  <div class="toolbar">
    <input type="text" id="dq" placeholder="Filter by dungeon or region…" value="${esc(st.q)}">
    <label>Max level <input type="number" id="dlv" min="1" max="200" placeholder="any" value="${esc(st.maxLv)}" style="width:80px"></label>
    <label><input type="checkbox" id="dev" ${st.ev ? "checked" : ""}> include empty / test</label>
    <span class="sp"></span>
    <div class="seg" id="dsort"><button data-s="region" class="${st.sort=="region"?"on":""}">By region</button><button data-s="lv" class="${st.sort=="lv"?"on":""}">By level</button></div>
  </div>
  <div id="dlist"></div>`;
  const draw = () => {
    const q = st.q.trim().toLowerCase(), maxLv = +st.maxLv || 0;
    let list = DUN.filter(d => d.L.some(Boolean));
    if (!st.ev) list = list.filter(isPlayable);
    if (q) list = list.filter(d => (d.n + " " + d.j + " " + d.gn + " " + d.gj).toLowerCase().includes(q));
    if (maxLv) list = list.filter(d => d.L.some(L => L && L.lv > 0 && L.lv <= maxLv));
    const minLvOf = d => Math.min(...d.L.filter(L => L && L.lv > 0).map(L => L.lv), 9999);
    let html;
    if (st.sort == "lv"){
      list.sort((a, b) => minLvOf(a) - minLvOf(b));
      html = `<div class="grid">${list.map(dungeonCard).join("")}</div>`;
    } else {
      const OTHER = "Other / events / quests", EXPD = "Experience dungeons";
      const reg = new Map();
      list.forEach(d => { const k = d.gn ? d.gn : /Experience/i.test(d.n) || /体験/.test(d.j) ? EXPD : OTHER; (reg.get(k) || reg.set(k, []).get(k)).push(d); });
      const minLv = ds => Math.min(...ds.map(minLvOf));
      const rank = k => k == OTHER ? 2 : k == EXPD ? 1 : 0;
      const regs = [...reg.entries()].map(([k, ds]) => [k, ds.sort((a, b) => minLvOf(a) - minLvOf(b))]).sort((a, b) => rank(a[0]) - rank(b[0]) || minLv(a[1]) - minLv(b[1]));
      html = `<div class="dlayout"><nav class="regnav">${regs.map(([n, ds], i) => `<a href="#reg${i}" data-jump="reg${i}">${esc(n)}<span>${ds.length}</span></a>`).join("")}</nav>
        <div>${regs.map(([n, ds], i) => { const ml = minLv(ds); return `<section class="region" id="reg${i}"><div class="region-h"><h2>${esc(n)}</h2><span class="jp">${esc(ds[0].gn ? ds[0].gj : "")}</span><span class="count mute" style="font-size:12px">${ds.length} dungeons${ml < 9999 ? ` · from Lv ${ml}` : ""}</span></div>
          <div class="grid">${ds.map(dungeonCard).join("")}</div></section>`; }).join("")}</div></div>`;
    }
    $("#dlist").innerHTML = list.length ? html : emptyState("No dungeons match", "Try another name or level.");
    $$("[data-jump]").forEach(a => a.onclick = ev => { ev.preventDefault(); document.getElementById(a.dataset.jump)?.scrollIntoView({behavior:"smooth"}); });
    store("od2-dfilter", st);
  };
  $("#dq").oninput = e => { st.q = e.target.value; draw(); };
  $("#dlv").oninput = e => { st.maxLv = e.target.value; draw(); };
  $("#dev").onchange = e => { st.ev = e.target.checked; draw(); };
  $$("#dsort button").forEach(b => b.onclick = () => { st.sort = b.dataset.s; $$("#dsort button").forEach(x => x.classList.toggle("on", x == b)); draw(); });
  draw();
}

function viewDungeon(id, qs){
  const d = DUNBY[id]; if (!d) return notFound();
  let diff = S.diff; if (!d.L[diff]) diff = d.L.findIndex(Boolean);
  const L = d.L[diff];
  const fixed = L.fp > 0;
  const floors = dungeonFloors(d, diff, S.party);
  const tab = qs.get("tab") || "monsters";
  setCrumbs([["Dungeons", "#/dungeons"], [d.gn || "Other"], [d.n]]);
  remember(`#/dungeon/${id}`, d.n, "Dungeon");
  const allMons = floors.flatMap(fl => fl.mons);
  const kills = allMons.reduce((s, m) => s + (m.metal ? 0 : m.pops), 0);
  const boss = bossOf(d, diff);
  // drops per run
  const agg = new Map();
  floors.forEach(fl => fl.mons.forEach(m => {
    if (!m.drop) return; const tm = tableMap(m.v[9]); if (!tm) return;
    for (const [it, p] of tm){
      const cur = agg.get(it) || {it, p:0, exp:0, none:1, eid:m.eid, mobs:0};
      cur.exp += p * m.pops; cur.none *= Math.pow(1 - p, m.pops); cur.mobs += m.pops;
      if (p > cur.p){ cur.p = p; cur.eid = m.eid; }
      agg.set(it, cur);
    }
  }));
  // smallest party that can drop each item (monster versions change with party size)
  const minParty = new Map();
  if (!fixed) for (let pp = 5; pp >= 1; pp--) dungeonFloors(d, diff, pp).forEach(fl => fl.mons.forEach(m => { if (!m.drop) return; const tm = tableMap(m.v[9]); if (tm) for (const [it] of tm) minParty.set(it, pp); }));
  const drops = [...agg.values()].sort((a, b) => (ITEMS[b.it][4] - ITEMS[a.it][4]) || ((1 - b.none) - (1 - a.none)));
  const base = `#/dungeon/${id}`;
  let body = "";
  const dDrops = () => `<div class="toolbar"><input type="text" id="dropq" placeholder="Filter drops…"><span class="sp"></span><span class="mute" style="font-size:12px">≥1 per run = chance in one full clear (party of ${fixed ? L.fp : S.party})</span></div>
      <div class="wrap"><table class="tbl" id="droptbl"><thead><tr><th>Item</th><th>Type</th><th>Best from</th><th class="r"><span class="tip" title="Monsters in one full clear (party of ${fixed ? L.fp : S.party}) that can drop it">Mobs</span></th><th class="r"><span class="tip" title="Smallest party where it can drop (monster versions change with the party size)">Players</span></th><th class="r">Per kill</th><th class="r">≥1 per run</th><th class="r">Avg / run</th></tr></thead><tbody>
      ${drops.map(x => `<tr data-n="${esc((ITEMS[x.it][0] + " " + ITEMS[x.it][1]).toLowerCase())}"><td>${itemLink(x.it)}</td><td class="mute">${esc(KIND[ITEMS[x.it][2]] || "")}</td>
        <td>${enemyLink(x.eid)}</td><td class="r num">${fmt(x.mobs)}</td><td class="r num">${fixed ? `<span class="mute" title="This difficulty always uses a party of ${L.fp}">${L.fp} (fixed)</span>` : minParty.has(x.it) ? (minParty.get(x.it) == 1 ? "1+" : `<b class="meh">${minParty.get(x.it)}+</b>`) : "—"}</td><td class="r">${pct(x.p)}</td><td class="r">${pct(1 - x.none)}</td><td class="r num mute">${x.exp >= 10 ? fmt(x.exp) : x.exp.toFixed(x.exp < 0.01 ? 4 : 2)}</td></tr>`).join("")}
      </tbody></table></div>`;
  const dRewards = () => `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${Object.entries(L.rr || {}).map(([rank, refs]) => `<div class="card"><h3 style="margin-bottom:8px">Rank ${esc(rank)}</h3>${refs.map(r => dropList(r)).join("")}</div>`).join("")}</div>`;
  const dFloors = () => floors.map((fl, i) => `<div class="floor"><div class="floor-h"><span class="idx">${i + 1}</span><span class="n">${esc(fl.st?.n || "Stage " + fl.sid)}</span><span class="jp">${esc(fl.st?.j || "")}</span></div>${monTable(fl.mons)}</div>`).join("");
  const wide = isWide();
  if (wide) body = pane("Floors & monsters", dFloors(), allMons.length) + `<div class="panes ${L.rr ? "d-panes" : ""}">${pane("Drops", dDrops(), drops.length)}${L.rr ? pane("Clear rewards", dRewards(), Object.keys(L.rr).length) : ""}</div>`;
  else body = tab == "drops" ? dDrops() : tab == "rewards" && L.rr ? dRewards() : dFloors();
  app.innerHTML = `${ph({k: esc(d.gn || "Dungeon"), title: esc(d.n) + (d.ara ? ` <span class="badge b-ara">ARAMITAMA</span>` : ""), jp: d.j, sub: d.desc ? esc(d.desc) : "",
      actions: `${boss ? `<button class="btn pri" data-sim="${boss.eid}|${esc(boss.vname)}|${d.id}|${diff}">Simulate boss</button>` : ""}`})}
    <div class="ctlbar">${diffSeg(diff, d.L.map((x, i) => x ? i : -1).filter(i => i >= 0), i => `${DIFFS[i]} · ${d.L[i].lv > 0 ? "Lv " + d.L[i].lv : "—"}`)}${fixed ? `<span class="chip">Fixed party of <b>${L.fp}</b></span>` : partySeg()}</div>
    <div class="tiles">
      ${tile("Recommended Lv", L.lv > 0 ? L.lv : "—", "", "hl")}${tile("Floors", L.f.length)}${tile("Kills / clear", fmt(kills), "real spawn count")}
      ${tile("Boss", boss ? `<a href="#/monster/${boss.eid}?v=${encodeURIComponent(boss.vname)}">${esc(boss.e.n)}</a>` : "—", boss ? `${fmtM(boss.v[1])} HP · DEF ${fmtM(boss.v[3])}` : "", "wide")}
      ${L.st ? tile("Stamina", L.st) : ""}${L.dl ? tile("Daily limit", L.dl + "×") : ""}${(L.tl || d.tl) ? tile("Time limit", Math.round((L.tl || d.tl) / 60) + " min") : ""}${L.cl >= 0 ? tile("Revives", L.cl) : ""}
    </div>
    ${L.rules?.length ? `<div class="callout"><b>Rules for you:</b> ${L.rules.map(ruleText).filter(Boolean).join(" · ")}</div>` : ""}
    ${wide ? "" : tabsBar([{id:"monsters", label:"Floors & monsters", n:allMons.length}, {id:"drops", label:"Drops", n:drops.length}, L.rr ? {id:"rewards", label:"Clear rewards", n:Object.keys(L.rr).length} : null], tab, base)}
    ${body}`;
  if ($("#dropq")) $("#dropq").oninput = e => { const q = e.target.value.toLowerCase(); $$("#droptbl tbody tr").forEach(tr => tr.style.display = tr.dataset.n.includes(q) ? "" : "none"); };
}
