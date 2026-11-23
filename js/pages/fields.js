"use strict";
/* OnigiriDex — skill page, field maps, not found */
// ---------------------------------------------------------------- skills / fields
function viewSkill(id){
  const sk = SKBY[id]; if (!sk) return notFound();
  setCrumbs([["Boss Simulator", "#/sim"], [CATS[sk.c]], [sk.n]]);
  remember(`#/skill/${id}`, sk.n, "Skill");
  const tg = targetStats(), r = calcSkill(sk, tg, SIM), x = sk.x || {};
  app.innerHTML = `${ph({k: `${esc(CATS[sk.c])} ${sk.o ? "ougi" : "skill"}`, title: esc(sk.n) + (sk.o ? ` <span class="badge b-ougi">OUGI</span>` : ""), jp: sk.j + " · ID " + sk.id, sub: sk.d ? esc(sk.d) : "", chips: skillAttrChips(sk.a)})}
    <div class="tiles">${tile("Rank", sk.r, "", "hl")}${tile("Skill power", fmt(sk.p1), `Lv 1: ${fmt(sk.p0)}`)}${tile("Cooldown", (sk.ct / 1000).toFixed(1) + "s")}${tile("SP", sk.sp)}${tile("MHC rate", sk.mh)}${tile("Hits", x.rates?.length ? x.rates.length : "?", x.rateText ? `<span title="${esc(x.rateText)}">${esc(x.rateText.length > 26 ? x.rateText.slice(0, 26) + "…" : x.rateText)}</span>` : "no hit data")}${tile("Cast time", x.time ? x.time + "s" : "?")}${x.rDmg ? tile("Rating", esc(x.rDmg)) : ""}</div>
    <div class="two">
      <div><h2 style="margin-top:0">Vs ${esc(tg.name)} <span class="count">${esc(tg.sub)}</span></h2>
        <div class="wrap"><table class="tbl"><thead><tr><th>Hit</th><th class="r">Rate</th><th class="r">ATK after cuts</th><th class="r">Defense eff.</th><th class="r">Damage</th></tr></thead><tbody>
        ${r.hits.map((h, i) => `<tr><td>#${i + 1}</td><td class="r num">${h.rate}</td><td class="r num">${fmt(h.atk)}</td><td class="r num">${(h.att * 100).toFixed(1)}%</td><td class="r num"><b>${fmt(h.dmg)}</b></td></tr>`).join("")}
        <tr><td colspan="4"><b>Total per cast</b></td><td class="r num"><b>${fmt(r.total)}</b></td></tr></tbody></table></div>
        <div class="note">Skill Force +${r.sf}% (rank ${sk.r}) · skill power ×${r.power.toFixed(2)} · element ×${r.mix.toFixed(3)} · crit ${(r.cri * 100).toFixed(0)}% × ${r.critF.toFixed(2)} · cooldown ${r.cd.toFixed(1)}s</div></div>
      <div><h2 style="margin-top:0">Community data <span class="count">by ikzki</span></h2>
        ${sk.x ? `<div class="wrap"><table class="tbl"><tbody>
          ${x.rDmg ? `<tr><td class="mute">Damage rating</td><td><b>${esc(x.rDmg)}</b></td></tr>` : ""}${x.rDps ? `<tr><td class="mute">DPS rating</td><td><b>${esc(x.rDps)}</b></td></tr>` : ""}
          ${x.dmg ? `<tr><td class="mute">Measured damage</td><td>${x.dmg}M${x.dmgMhc ? ` · ${x.dmgMhc}M vs MHC 90` : ""}</td></tr>` : ""}${x.dps ? `<tr><td class="mute">Measured DPS</td><td>${x.dps}M</td></tr>` : ""}
          ${x.fx ? `<tr><td class="mute">Effects</td><td>${esc(x.fx)}</td></tr>` : ""}${x.obtain ? `<tr><td class="mute">How to get</td><td>${esc(x.obtain)}</td></tr>` : ""}${x.note ? `<tr><td class="mute">Notes</td><td>${esc(x.note)}</td></tr>` : ""}
        </tbody></table></div>` : emptyState("Not in the spreadsheet")}</div>
    </div>`;
}
function viewFields(){
  setCrumbs([["Field maps"]]);
  // only maps with monsters, sorted by level; seasonal / event maps in their own section
  const isEvent = st => /event|chocolate|halloween|christmas|valentine|summer|new year|anniversary/i.test(st.n) || /イベント|ちょこ|チョコ|ハロウィン|クリスマス|バレンタイン|夏祭|正月|周年/.test(st.j);
  const maps = D.fields.map(sid => { const ms = fieldMons(sid), lvs = ms.map(m => m.v[0]); return {sid, ms, lo: lvs.length ? Math.min(...lvs) : 0, hi: lvs.length ? Math.max(...lvs) : 0}; })
    .filter(m => m.ms.length && !/\btest\b|^[?？\s]+$/i.test(ST[m.sid].n) && !/テスト/.test(ST[m.sid].j)).sort((a, b) => a.lo - b.lo || a.hi - b.hi || ST[a.sid].n.localeCompare(ST[b.sid].n));
  const card = m => `<a class="dcard" href="#/field/${m.sid}"><div class="t">${esc(ST[m.sid].n)}</div><div class="jp">${esc(ST[m.sid].j)}</div><div class="lvpills"><span class="lvpill">Lv <b>${m.lo == m.hi ? m.lo : m.lo + "–" + m.hi}</b></span><span class="lvpill"><b>${m.ms.length}</b> monster${m.ms.length > 1 ? "s" : ""}</span>${m.ms.some(x => x.drop) ? "" : `<span class="lvpill faint">no drops</span>`}</div></a>`;
  const reg = maps.filter(m => !isEvent(ST[m.sid])), ev = maps.filter(m => isEvent(ST[m.sid]));
  app.innerHTML = `${ph({title:"Field maps", sub:`Open areas outside dungeons where monsters keep respawning — ${maps.length} maps with monsters, by level.`})}
  <div class="grid">${reg.map(card).join("")}</div>
  ${ev.length ? `<h2 class="home-h">Event maps <span class="count">${ev.length}</span></h2><div class="grid">${ev.map(card).join("")}</div>` : ""}`;
}
function viewField(sid, qs){
  const st = ST[sid]; if (!st) return notFound();
  setCrumbs([["Field maps", "#/fields"], [st.n]]);
  remember(`#/field/${sid}`, st.n, "Field");
  const ms = fieldMons(sid), tab = qs.get("tab") || "monsters";
  const fDrops = () => `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${ms.filter(m => m.drop).map(m => `<div class="card"><h3 style="margin-bottom:8px">${enemyLink(m.eid)} <span class="mute" style="font-weight:500">Lv ${m.v[0]}</span></h3>${dropList(m.v[9])}</div>`).join("")}</div>`;
  app.innerHTML = `${ph({k:"Field map", title:esc(st.n), jp:st.j})}
    ${isWide() ? pane("Monsters", monTable(ms, {field:true}), ms.length) + pane("Drops", fDrops()) : tabsBar([{id:"monsters", label:"Monsters", n:ms.length}, {id:"drops", label:"Drops"}], tab, `#/field/${sid}`) + (tab == "drops" ? fDrops() : monTable(ms, {field:true}))}`;
}
function notFound(){ setCrumbs([["Not found"]]); app.innerHTML = emptyState("Not found", `<a href="#/" style="color:var(--accent)">Back home</a>`); }
