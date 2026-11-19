"use strict";
/* OnigiriDex — small render helpers (icons, item links, chances, chips) */
// ---------------------------------------------------------------- render helpers
function icon(it){ const p = ICONS[it[5]]; return p ? `<span class="ico" style="background-position:-${p[0]}px -${p[1]}px"></span>` : `<span class="ico none"></span>`; }
function itemLink(i, extra=""){ const it = ITEMS[i]; return `<a class="it rk-${it[4]}" href="#/item/${i}" title="${esc(KIND[it[2]]||"")}${it[1] && it[1]!=it[0] ? " · "+esc(it[1]) : ""}">${icon(it)}<span class="nm">${esc(it[0])}</span>${extra}</a>`; }
function enemyLink(eid, label){ const e = E[eid]; return `<a href="#/monster/${eid}">${esc(label || (e ? e.n : "#"+eid))}</a>`; }
function dunLink(did){ const d = DUNBY[did]; return `<a href="#/dungeon/${did}">${esc(d ? d.n : "#"+did)}</a>`; }
function pct(p){
  const v = p * 100; const cls = v >= 30 ? "p-hi" : v >= 5 ? "p-mid" : v >= 0.5 ? "p-lo" : "p-vlo";
  const s = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4);
  return `<span class="pct ${cls}">${s}%</span>`;
}
function oneIn(p){ if (p <= 0) return ""; const n = 1 / p; return n < 1.5 ? "" : `<span class="mute" style="font-size:11.5px"> · 1 in ${n < 100 ? n.toFixed(0) : fmt(n)}</span>`; }
function attrChips(res, max=4){
  const out = [];
  res.forEach((val, i) => { if (i < 12 && val <= -10) out.push(`<span class="at weak" title="Takes ${-val}% more damage">${ATTRS[i][0]} +${-val}%</span>`); });
  res.forEach((val, i) => { if (i < 12 && val >= 30) out.push(`<span class="at res" title="Resists ${Math.min(val,100)}%">${ATTRS[i][0]} −${Math.min(val,100)}%</span>`); });
  if (!out.length) return `<span class="mute">—</span>`;
  const extra = out.length > max ? `<span class="at neu" title="${esc(out.slice(max).map(x => x.replace(/<[^>]+>/g,"")).join(", "))}">+${out.length-max}</span>` : "";
  return `<div class="attrs">${out.slice(0, max).join("")}${extra}</div>`;
}
function skillAttrChips(a){ return `<div class="attrs">${a.map(([i, r]) => `<span class="at neu" style="color:${ATTR_COLORS[i]}">${r}% ${ATTRS[i][0]}</span>`).join("")}</div>`; }
function natureTag(e){ const n = NATURES[e.na]; return n ? `${n[0]} <span class="jp">${n[1]}</span>` : "—"; }
function describeVar(nm){ const m = nm.match(/^(.*)_(\d)_(\d)$/); return m ? `${DIFFS[m[2]]||m[2]} · ${m[3]}P` : nm; }
// quick "100% hit" with My ATK
function recAtk(v){ return 2 * v[3]; }
function atkCell(v){
  const rec = recAtk(v), atk = +SIM.atk; let cls = "";
  if (atk){ cls = atk >= rec ? "ok" : atk >= rec/2 ? "meh" : "bad"; }
  return `<span class="atkpill ${cls}" title="Recommended ATK = 2× defense (≈87% of your attack goes through). Half of it ≈56%.">${fmtM(rec)}</span>`;
}
function hitsCell(v){
  const atk = +SIM.atk; if (!atk) return `<span class="mute">—</span>`;
  const a = cutAttack(atk, v[15]||0, 0, 0, 0); const dmg = Math.max(1, Math.floor(a * atten(a, v[3])));
  return `<span class="num" title="Plain 100% hit with your ATK (no skill power / elements): ${fmt(dmg)}">${fmt(Math.ceil(v[1] / dmg))}</span>`;
}

function dropList(ti){
  if (ti == null || ti < 0) return `<div class="mute">No drops.</div>`;
  const rows = [];
  for (const ent of DROPS[ti]){
    if (Array.isArray(ent[1])){
      const g = ent[1], n = ent[2] || 1;
      if (g.length <= 4) g.forEach(([sh, it, num]) => rows.push({p: Math.min(1, ent[0]*sh*n), it, num}));
      else rows.push({p: ent[0], group: g, n, label: n > 1 ? `${n} of these` : `1 of these ${g.length}`});
    } else rows.push({p: ent[0], it: ent[1], num: ent[2]});
  }
  rows.sort((a,b) => b.p - a.p);
  return `<table class="tbl"><thead><tr><th>Item</th><th class="r">Chance</th></tr></thead><tbody>${rows.map(r => {
    if (r.group){
      const inner = r.group.slice().sort((a,b)=>b[0]-a[0]).map(([sh,it,num]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0">${itemLink(it, num>1?` <span class="mute">×${num}</span>`:"")}<span class="mute num" style="font-size:12px">${(r.p*sh*r.n*100).toFixed(4)}%</span></div>`).join("");
      return `<tr><td><details class="grp"><summary>${r.label} <span class="mute">(${esc(KIND[ITEMS[r.group[0][1]][2]]||"items")}…)</span></summary><div class="group">${inner}</div></details></td><td class="r">${pct(r.p)}</td></tr>`;
    }
    return `<tr><td>${itemLink(r.it, r.num>1?` <span class="mute">×${r.num}</span>`:"")}</td><td class="r">${pct(r.p)}${oneIn(r.p)}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function monTable(mons, opts={}){
  if (!mons.length) return `<div class="note">No monsters on this floor (cutscene, scripted boss or reward room).</div>`;
  return `<div class="wrap"><table class="tbl"><thead><tr>
    <th>Monster</th><th class="r">Lv</th><th class="r">HP</th><th class="r">ATK</th><th class="r">DEF</th>
    <th class="r"><span class="tip" title="Recommended ATK (2× defense)">Rec. ATK</span></th>
    <th class="r"><span class="tip" title="Plain 100% hits to kill with My ATK">Hits</span></th>
    <th>Weak / Resist</th><th class="r"><span class="tip" title="Multi-hit cut">MHC</span></th><th class="r">EXP</th><th class="r">Ryou</th><th class="r"><span class="tip" title="Units that actually spawn for this difficulty / party size">Spawns</span></th><th></th></tr></thead><tbody>
    ${mons.map(m => { const v = m.v, e = m.e;
      const badges = [m.boss?`<span class="badge b-boss">BOSS</span>`:"", m.elite?`<span class="badge b-elite">ELITE</span>`:"", m.metal?`<span class="badge b-metal" title="Rare spawn: ${(m.metal*100).toFixed(0)}% per floor">RARE ${(m.metal*100).toFixed(0)}%</span>`:"", (opts.field && m.repop)?`<span class="badge b-repop">RESPAWNS</span>`:""].join(" ");
      return `<tr><td class="name"><a href="#/monster/${m.eid}?v=${encodeURIComponent(m.vname)}"><b>${esc(e.n)}</b></a> ${badges}<div class="jp">${esc(e.j)} · ${NATURES[e.na]?.[0]||""}</div></td>
      <td class="r num">${v[0]}</td><td class="r num">${fmtM(v[1])}${v[10]?` <span class="mute" title="HP bars">(${v[10].reduce((a,b)=>a+b.length,0)}×)</span>`:""}</td>
      <td class="r num">${fmtM(v[2])}</td><td class="r num">${fmtM(v[3])}</td>
      <td class="r num">${atkCell(v)}</td><td class="r">${hitsCell(v)}</td>
      <td>${attrChips(v[5])}</td><td class="r num">${v[16]||"—"}</td><td class="r num">${fmt(v[6])}</td><td class="r num">${fmt(v[7])}</td>
      <td class="r num mute">${m.metal ? "≤"+m.places : (m.pops % 1 ? m.pops.toFixed(1) : m.pops)}</td>
      <td><button class="btn sm" data-sim="${m.eid}|${esc(m.vname)}" title="Simulate your build against this monster">Sim</button></td></tr>`; }).join("")}
  </tbody></table></div>`;
}
function bindSimButtons(root=document){
  root.querySelectorAll("[data-sim]").forEach(b => b.onclick = () => {
    const [eid, vname] = b.dataset.sim.split("|");
    SIM.tgt = {t:"enemy", eid:+eid, vname}; saveSim(); location.hash = "#/sim";
  });
}
