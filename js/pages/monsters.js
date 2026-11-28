"use strict";
/* OnigiriDex — monster list and monster page */
// ---------------------------------------------------------------- monsters
function viewMonsters(){
  setCrumbs([["Monsters"]]);
  const st = load("od2-mfilter2", {q:"", all:true, nat:-1, sort:"lv"});
  app.innerHTML = `${ph({title:"Monsters", sub:"Every monster in the game files with its level range and toughest version. Open one to see each difficulty."})}
  <div class="toolbar">
    <input type="text" id="mq" placeholder="Filter monsters…" value="${esc(st.q)}">
    <div class="seg" id="mnat"><button data-n="-1" class="${st.nat<0?"on":""}">All</button>${NATURES.map((n,i) => `<button data-n="${i}" class="${st.nat==i?"on":""}">${n[0]}</button>`).join("")}</div>
    <label title="Monsters that are not placed in any dungeon or field map (events, summons, unused)"><input type="checkbox" id="mall" ${st.all?"checked":""}> include monsters not placed anywhere</label>
  </div>
  <div class="wrap"><table class="tbl" id="mt"><thead><tr><th class="s" data-s="n">Monster</th><th>Nature</th><th>Size</th><th class="r s" data-s="lv">Lv range</th><th class="r s" data-s="hp">Max HP</th><th><span class="tip" title="The 2 elements that hurt it most (toughest version). Color by its resistance: green 30 or less, yellow 31-69, red 70+">Best elements</span></th><th class="r s" data-s="loc">Locations</th></tr></thead><tbody></tbody></table></div>
  <button class="more" id="mmore">Show more</button>`;
  let limit = PAGE;
  const rows = Object.entries(E).map(([id, e]) => {
    const vs = Object.values(e.v), lvs = vs.map(v => v[0]), hps = vs.map(v => v[1]);
    const top = vs.reduce((a, v) => !a || v[1] > a[1] ? v : a, null);
    return {id:+id, e, lo: lvs.length ? Math.min(...lvs) : 0, hi: lvs.length ? Math.max(...lvs) : 0, hp: hps.length ? Math.max(...hps) : 0, loc: enemyLoc[id]?.size || 0, res: top ? top[5] : null, cov: top ? !!top[18] : false};
  });
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    const list = rows.filter(r => (st.all || r.loc) && (st.nat < 0 || r.e.na == st.nat) && (!q || (r.e.n + " " + r.e.j).toLowerCase().includes(q)));
    list.sort((a, b) => (b.loc ? 1 : 0) - (a.loc ? 1 : 0) || (st.sort == "n" ? a.e.n.localeCompare(b.e.n) : st.sort == "hp" ? b.hp - a.hp : st.sort == "loc" ? b.loc - a.loc : a.lo - b.lo));
    $$("#mt th.s").forEach(th => th.classList.toggle("sorted", th.dataset.s == st.sort));
    $("#mt tbody").innerHTML = list.slice(0, limit).map(r => `<tr class="rowlink" data-href="#/monster/${r.id}"><td class="name"><b>${esc(r.e.n)}</b> <span class="mid" title="Monster ID (several monsters share a name)">#${r.id}</span>${r.loc ? "" : ` <span class="badge b-est" title="Not placed in any dungeon or field map (event, summon or unused)">NOT PLACED</span>`}<div class="jp">${esc(r.e.j)}</div></td><td>${natureTag(r.e)}</td><td class="mute">${SIZES[r.e.sz] || ""}</td>
      <td class="r num">${!r.hi ? "—" : r.lo == r.hi ? r.lo : r.lo + "–" + r.hi}</td><td class="r num">${r.hp ? fmtM(r.hp) : "—"}</td><td class="mbest">${r.res ? bestElems(r.res, r.cov, 2).map(([i, c]) => `<span class="band-${resBand(r.res[i])}"><i style="color:${ATTR_COLORS[i]}">${ATTRS[i][1]}</i> ${ATTRS[i][0]} ${chgLabel(c)}%</span>`).join("") + (r.cov ? covBadge() : "") : "—"}</td><td class="r num">${r.loc || "—"}</td></tr>`).join("") || `<tr><td colspan="7">${emptyState("No monsters match")}</td></tr>`;
    $("#mmore").style.display = list.length > limit ? "" : "none";
    store("od2-mfilter2", st);
  };
  $("#mq").oninput = e => { st.q = e.target.value; limit = PAGE; draw(); };
  $$("#mnat button").forEach(b => b.onclick = () => { st.nat = +b.dataset.n; $$("#mnat button").forEach(x => x.classList.toggle("on", x == b)); draw(); });
  $("#mall").onchange = e => { st.all = e.target.checked; draw(); };
  $("#mmore").onclick = () => { limit += 100; draw(); };
  $$("#mt th.s").forEach(th => th.onclick = () => { st.sort = th.dataset.s; draw(); });
  draw();
}

function viewMonster(id, qs){
  const e = E[id]; if (!e) return notFound();
  const names = Object.keys(e.v);
  if (!names.length){   // listed in the game data but never spawned with stats (cutscene or unused monster)
    setCrumbs([["Monsters", "#/monsters"], [e.n]]);
    app.innerHTML = `${ph({k: "Monster", title: esc(e.n), jp: e.j})}${emptyState("No stats in the game data", "This monster has no level, drops or spawn data. It may only appear in a cutscene or not be used.")}`;
    return;
  }
  let sel = qs.get("v");
  if (!sel || !e.v[sel]) sel = names.find(n => n.endsWith("_" + S.diff + "_" + S.party)) || names[0];
  const v = e.v[sel];
  const tab = qs.get("tab") || "drops";
  const locs = [...(enemyLoc[id]?.values() || [])];
  setCrumbs([["Monsters", "#/monsters"], [e.n]]);
  remember(`#/monster/${id}`, e.n, "Monster");
  // versions grouped by base name
  const groups = new Map();
  names.forEach(nm => { const base = nm.replace(/_\d_\d$/, ""); (groups.get(base) || groups.set(base, []).get(base)).push(nm); });
  const verSel = `<select id="vsel">${[...groups.entries()].map(([b, ns]) => `<optgroup label="${esc(b)}">${ns.sort((x, y) => e.v[x][0] - e.v[y][0]).map(nm => `<option value="${esc(nm)}" ${nm == sel ? "selected" : ""}>Lv ${e.v[nm][0]} · ${esc(describeVar(nm))}</option>`).join("")}</optgroup>`).join("")}</select>`;
  const base = `#/monster/${id}?v=${encodeURIComponent(sel)}`;
  let body;
  const mWhere = () => locs.length ? `<div class="grid">${locs.map(l => l.t == "d" ? `<a class="dcard" href="#/dungeon/${l.did}"><div class="t">${esc(DUNBY[l.did].n)} ${l.metal ? `<span class="badge b-metal">RARE</span>` : ""}</div><div class="boss">${esc(DUNBY[l.did].gn || "")}</div><div class="lvpills">${lvPills(DUNBY[l.did])}</div></a>`
      : `<a class="dcard" href="#/field/${l.sid}"><div class="t">${esc(ST[l.sid].n)} <span class="badge b-repop">FIELD</span></div><div class="jp">${esc(ST[l.sid].j)}</div></a>`).join("")}</div>` : emptyState("No known location", "Event, summon or unused monster.");
  const mDrops = () => dropList(v[9]);
  const wide = isWide();
  if (wide) body = `<div class="panes m-panes">${pane("Drops", mDrops())}<div class="pane-col">${pane("Where to find", mWhere(), locs.length)}</div></div>`;
  else body = tab == "where" ? mWhere() : `<div style="max-width:820px">${mDrops()}</div>`;
  app.innerHTML = `${ph({k:"Monster", title:esc(e.n), jp:e.j, chips:`<span class="chip">${natureTag(e)}</span><span class="chip">${SIZES[e.sz] || "?"}</span><span class="chip">ID <b>${id}</b></span>${v[18] ? covBadge() : ""}`,
      actions:`<span class="ctl">Version ${verSel}</span><button class="btn pri" data-sim="${id}|${esc(sel)}">Simulate my build</button>`})}
    <div class="tiles">
      ${tile("Level", v[0], "", "hl")}${tile("HP", fmtM(v[1]), v[10] ? (v[10].length > 1 ? `${v[10].length} phases` : `${v[10][0].length} HP bars`) : "")}${tile("ATK", fmtM(v[2]))}${tile("DEF", fmtM(v[3]))}
      ${tile("Multi-hit cut", v[16] || 0)}${tile("Crit res.", v[17] || 0)}${v[15] ? tile("ATK cut", fmtM(v[15])) : ""}
      ${v[6] > 0 ? tile("EXP", fmt(v[6])) : ""}${v[7] > 0 ? tile("Ryou", fmt(v[7])) : ""}${v[8] > 0 ? tile("Stun", fmt(v[8])) : ""}
    </div>
    <div class="mon-sum">${resPanel(v[5], v[18])}${hpPanel(v)}</div>
    ${(bc => bc ? `<a class="bmini" href="#/bestiary/${bc.id}">${bestArt(bc)}<div><span class="ph-k">Bestiary · No.${String(bc.id).padStart(3, "0")}</span><b>${esc(bc.n)}</b><p>${esc(loreSnippet(bc))}</p></div></a>` : "")(BEST_OF_ENEMY[id])}
    ${wide ? "" : tabsBar([{id:"drops", label:"Drops"}, {id:"where", label:"Where to find", n:locs.length}], tab, base)}
    ${body}`;
  $("#vsel").onchange = ev => { location.hash = `#/monster/${id}?v=${encodeURIComponent(ev.target.value)}&tab=${tab}`; };
}
