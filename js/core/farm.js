"use strict";
/* OnigiriDex — farm planning logic (chance per full clear) */
// ---------------------------------------------------------------- views
const app = $("#app");
const PAGE = 60;

const isPlayable = d => /\S/.test(d.n) && !/test|テスト|debug/i.test(d.n + d.j) && d.L.some(L => L && L.f.some(f => ST[f]?.g.length));
const FARM = load("od2-farm", {items:[], maxLv:"", diffs:[0,1,2,3], sort:"score", hideAra:false, showFields:true});
function farmGo(items){ FARM.items = [...new Set(items)]; store("od2-farm", FARM); location.hash = "#/farm"; }
function farmRows(items, party){
  const out = [];
  const want = new Set(items);
  for (const d of DUN){
    if (!isPlayable(d)) continue;
    d.L.forEach((L, diff) => {
      if (!L) return;
      const per = items.map(() => ({exp:0, none:1, best:null}));
      let kills = 0;
      for (const fl of dungeonFloors(d, diff, party)) for (const m of fl.mons){
        kills += m.pops;
        if (!m.drop) continue;
        const tm = tableMap(m.v[9]); if (!tm) continue;
        items.forEach((it, k) => {
          const p = tm.get(it); if (!p) return;
          const r = per[k]; r.exp += p * m.pops; r.none *= Math.pow(1 - p, m.pops);
          if (!r.best || p > r.best.p) r.best = {eid:m.eid, p, boss:m.boss, metal:!!m.metal};
        });
      }
      if (L.rr?.ALL) for (const ref of L.rr.ALL){ const tm = tableMap(ref); if (!tm) continue;
        items.forEach((it, k) => { const p = tm.get(it); if (p){ per[k].exp += p; per[k].none *= 1 - p; per[k].rank = (per[k].rank||0) + p; if (!per[k].best) per[k].best = {rank:true, p}; } }); }
      if (!per.some(r => r.exp > 0)) return;
      const score = per.reduce((s, r) => s + (1 - r.none), 0);
      const expSum = per.reduce((s, r) => s + r.exp, 0);
      out.push({d, diff, L, per, kills, score, expSum});
    });
  }
  return out;
}
function fieldFarm(items){
  const rows = [];
  for (const sid of D.fields) for (const m of fieldMons(sid)){
    if (!m.drop) continue; const tm = tableMap(m.v[9]); if (!tm) continue;
    items.forEach(it => { const p = tm.get(it); if (p) rows.push({sid, m, it, p}); });
  }
  if (!rows.length) return "";
  rows.sort((a,b) => b.p - a.p);
  return `<h2>Field maps (respawning, per kill) <span class="count">${rows.length}</span></h2><div class="wrap"><table class="tbl"><thead><tr><th>Item</th><th>Monster</th><th>Map</th><th class="r">Lv</th><th class="r">Chance / kill</th></tr></thead><tbody>
    ${rows.slice(0, 40).map(r => `<tr><td>${itemLink(r.it)}</td><td>${enemyLink(r.m.eid)}</td><td><a href="#/field/${r.sid}">${esc(ST[r.sid].n)}</a></td><td class="r num">${r.m.v[0]}</td><td class="r">${pct(r.p)}${oneIn(r.p)}</td></tr>`).join("")}</tbody></table></div>`;
}
