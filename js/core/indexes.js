"use strict";
/* OnigiriDex — lookup tables built from data.js (dungeons, drops, item sources) */
// ---------------------------------------------------------------- indexes
const E = D.enemies, ST = D.stages, ITEMS = D.items, DROPS = D.drops, SKILLS = D.skills || [];
// drop tables sometimes name items the client does not have ("Item 11:365013"): they can never drop, so they are left out
const isGhostIdx = i => /^(Item \d+:\d+|#\d+:\d+)$/.test(ITEMS[i]?.[0] || "");
for (let t = 0; t < DROPS.length; t++){
  if (!DROPS[t]) continue;
  DROPS[t] = DROPS[t].map(ent => Array.isArray(ent[1]) ? [ent[0], ent[1].filter(g => !isGhostIdx(g[1])), ...ent.slice(2)] : ent)
    .filter(ent => Array.isArray(ent[1]) ? ent[1].length : !isGhostIdx(ent[1]));
}
const DUN = D.dungeons; const DUNBY = {}; DUN.forEach(d => DUNBY[d.id] = d);
const SKBY = {}; SKILLS.forEach(s => SKBY[s.id] = s);
const ITEMKEY = {}; ITEMS.forEach((it, i) => ITEMKEY[it[2] + ":" + it[3]] = i);
const itemIndexOf = (k, id) => ITEMKEY[k + ":" + id];
// var row: [lv,hp,atk,pdef,mdef,attrs[13],exp,money,stun,dropIdx,phases,cri,pavo,mavo,critAvoid,atkCut,mhc,critCut]

function resolveVar(e, vn, diff, n){
  if (!e) return null;
  if (diff == null || diff < 0) return e.v[vn] ? [vn, e.v[vn]] : firstVar(e);
  let nm = vn + "_" + diff + "_" + n;
  if (!e.v[nm] && diff == 3) nm = vn + "_2_" + n;
  if (e.v[nm]) return [nm, e.v[nm]];
  if (e.v[vn]) return [vn, e.v[vn]];
  return null;
}
function firstVar(e){ const k = Object.keys(e.v)[0]; return k ? [k, e.v[k]] : null; }
// how many units the game really spawns for a group with `places` pop places (SystemSetting.getNumEnemyPop)
function popCount(places, diff, n, ara){
  if (!places) return 0;
  if (ara && META.araPop) return META.araPop[Math.min(places, 40) - 1] ?? places;
  if (!META.pop || diff == null || diff < 0) return places;
  const row = META.pop[diff]?.[n-1]; if (!row) return places;
  return places <= 40 ? row[places-1] : places;
}

// monsters of a dungeon level, grouped by floor (with real spawn counts)
const floorCache = new Map();
function dungeonFloors(d, diff, party){
  const key = d.id + "|" + diff + "|" + party;
  if (floorCache.has(key)) return floorCache.get(key);
  const L = d.L[diff]; if (!L){ floorCache.set(key, []); return []; }
  const n = L.fp > 0 ? Math.min(L.fp, 5) : party;
  const bosses = new Set(L.b || []);
  const elite = new Set(L.el || []), last = new Set(L.la || []);
  const out = L.f.map(sid => {
    const st = ST[sid]; if (!st) return {sid, st:null, mons:[]};
    const map = new Map();
    for (const [eid, vn, places, repop, minP, gname, drop] of st.g){
      if (minP && n < minP) continue;
      const e = E[eid]; const rv = resolveVar(e, vn, diff, n); if (!rv) continue;
      const k = eid + "|" + rv[0];
      const cur = map.get(k) || {eid, e, vname:rv[0], v:rv[1], pops:0, places:0, boss:bosses.has(eid), elite:false, last:false, repop:false, drop:false};
      cur.places += places; cur.pops += popCount(places, diff, n, d.ara);
      cur.elite ||= elite.has(gname); cur.last ||= last.has(gname); cur.repop ||= !!repop; cur.drop ||= !!drop;
      map.set(k, cur);
    }
    if (st.m){
      const [eid, vn, rate, lim] = st.m; const e = E[eid]; const rv = resolveVar(e, vn, diff, n);
      if (rv) map.set("metal|"+eid, {eid, e, vname:rv[0], v:rv[1], pops:rate * lim, places:lim, metal:rate, boss:false, drop:true});
    }
    const mons = [...map.values()].sort((a,b) => (b.boss - a.boss) || (b.v[1] - a.v[1]));
    return {sid, st, mons};
  });
  floorCache.set(key, out);
  return out;
}
function fieldMons(sid){
  const st = ST[sid]; const map = new Map();
  for (const [eid, vn, pops, repop, minP, gname, drop] of st.g){
    const e = E[eid]; const rv = resolveVar(e, vn, -1, 1); if (!rv) continue;
    const k = eid + "|" + rv[0];
    const cur = map.get(k) || {eid, e, vname:rv[0], v:rv[1], pops:0, repop:false, drop:false};
    cur.pops += pops; cur.repop ||= !!repop; cur.drop ||= !!drop; map.set(k, cur);
  }
  return [...map.values()].sort((a,b) => a.v[0] - b.v[0]);
}

// per drop table: Map(itemIdx -> chance per kill)
const tableMapCache = [];
function tableMap(ti){
  if (ti == null || ti < 0) return null;
  if (tableMapCache[ti]) return tableMapCache[ti];
  const m = new Map();
  for (const ent of DROPS[ti]){
    if (Array.isArray(ent[1])){ for (const [sh, it] of ent[1]){ const p = Math.min(1, ent[0]*sh*(ent[2]||1)); m.set(it, 1 - (1 - (m.get(it)||0)) * (1 - p)); } }
    else m.set(ent[1], 1 - (1 - (m.get(ent[1])||0)) * (1 - ent[0]));
  }
  return tableMapCache[ti] = m;
}

// item -> sources (lazy per party size)
const itemSrcCache = {};
function itemSources(party){
  if (itemSrcCache[party]) return itemSrcCache[party];
  const idx = {};
  const add = (it, rec) => { (idx[it] ||= []).push(rec); };
  const scan = (ti, base) => { const m = tableMap(ti); if (m) for (const [it, p] of m) add(it, Object.assign({p}, base)); };
  for (const d of DUN){
    d.L.forEach((L, diff) => {
      if (!L) return;
      const seen = new Set();
      for (const fl of dungeonFloors(d, diff, party)) for (const m of fl.mons){
        if (!m.drop) continue;
        const k = m.eid + "|" + m.vname; if (seen.has(k)) continue; seen.add(k);
        scan(m.v[9], {t:"m", eid:m.eid, did:d.id, diff, boss:m.boss, metal:!!m.metal});
      }
      if (L.rr) for (const [rank, refs] of Object.entries(L.rr)) refs.forEach(r => scan(r, {t:"r", did:d.id, diff, rank}));
    });
  }
  for (const sid of D.fields) for (const m of fieldMons(sid)) if (m.drop) scan(m.v[9], {t:"f", eid:m.eid, sid});
  for (const [uid, list] of Object.entries(D.unk)){
    const ui = itemIndexOf(13, +uid); if (ui == null) continue;
    for (const [sh, wi] of list) add(wi, {t:"u", from:ui, p:sh});
  }
  return itemSrcCache[party] = idx;
}
function bestDirect(src, i){ let b = null; for (const r of (src[i] || [])) if (r.t != "u" && (!b || r.p > b.p)) b = r; return b; }
function bestAny(src, i){
  let b = bestDirect(src, i), via = null;
  for (const r of (src[i] || [])) if (r.t == "u"){ const d = bestDirect(src, r.from); if (d && (!b || d.p * r.p > b.p)){ b = Object.assign({}, d, {p: d.p * r.p}); via = r.from; } }
  return b ? Object.assign({via}, b) : null;
}

// enemy -> locations
const enemyLoc = {};
DUN.forEach(d => d.L.forEach(L => { if (!L) return; L.f.forEach(sid => { const st = ST[sid]; if (!st) return;
  st.g.forEach(g => (enemyLoc[g[0]] ||= new Map()).set("d"+d.id, {t:"d", did:d.id}));
  if (st.m) (enemyLoc[st.m[0]] ||= new Map()).set("d"+d.id, {t:"d", did:d.id, metal:true});
}); }));
D.fields.forEach(sid => ST[sid].g.forEach(g => (enemyLoc[g[0]] ||= new Map()).set("f"+sid, {t:"f", sid})));
