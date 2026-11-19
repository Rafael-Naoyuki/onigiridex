"use strict";
/* OnigiriDex — damage engine ported from the game + rotation simulation */
// ---------------------------------------------------------------- damage engine (ported from the game: DamageCalculator / StageCharaModel)
function atten(atk, def){ if (atk <= 0) return 0; const r = def / atk; return Math.max(0.3263 * Math.pow(0.55, r) + (Math.atan(3.8 - r * 4.5) + Math.PI/2) / 6.5 + 0.23, 0.45); }
// StageCharaModel.cutAttackPower: attack cut + multi-hit cut (count = hits already landed by this skill use)
function cutAttack(val, atkCut, mhc, mhcr, count){
  val -= atkCut; if (val < 10) return 10;
  if (mhc <= 0 || mhcr <= 0 || count <= 0) return val;
  const v2 = val / (count * (mhc * 0.01) + 1.0);
  const w = Math.min(Math.max(mhcr * 0.01, 0), 1);
  return Math.floor(val + (v2 - val) * w);
}
function targetStats(){
  const t = SIM.tgt;
  if (t.t == "enemy"){
    const e = E[t.eid]; const v = e?.v[t.vname];
    if (v){
      const d = t.did != null ? DUNBY[t.did] : null, L = d && t.diff != null ? d.L[t.diff] : null;
      const fix = {}; (L?.rules || []).forEach(o => { if (o.p == "SecondaryStatusFixed") fix[o.statusType] = o.fixedValue; });
      const sub = d ? `${d.n} · ${DIFFS[t.diff]} · Lv ${v[0]}` : `${describeVar(t.vname)} · Lv ${v[0]}`;
      return {name:e.n, sub, hp:v[1], def:v[3], res:v[5], cav:v[14]||0, atkCut:v[15]||0, mhc:v[16]||0, crc:v[17]||0, phases:v[10], eid:t.eid, vname:t.vname,
        did:t.did, diff:t.diff, fix, rules:L?.rules || [], timeLimit:L ? (L.tl || d.tl || 0) : 0};
    }
  }
  const d = SIM.dummy;
  return {name:"Test dummy", sub:"Custom target", hp:+d.hp||1, def:+d.def||0, res:Array(13).fill(+d.res||0), cav:+d.cav||0, atkCut:0, mhc:+d.mhc||0, crc:+d.crc||0, dummy:true};
}
function skillRates(sk){ return sk.x?.rates?.length ? sk.x.rates : null; }
// expected damage of one cast of `sk` against target `tg` with build `b`
function calcSkill(sk, tg, b, capBuff){
  const measured = skillRates(sk);
  const rates = measured || [1];
  const FB = b.useBuild && b.fromBuild && b.cat == sk.c ? b.fromBuild : null;
  const sf = FB && FB.sfRank ? (FB.sfRank[sk.r] || 0) : (+b.sf || 0);
  const power = (b.lvMax ? sk.p1 : sk.p0) / 100 * (1 + Math.min(sf, META.skillPowerMax||500) / 100);
  const cap = MAX_DMG + (FB ? FB.extraCap || 0 : 0) + (capBuff != null ? capBuff : capBuffSum(capList(b)));
  const dexCrit = FB ? FB.dexCrit || 0 : 0;
  // attribute mix (DamageCalculator._calcDamage)
  let mix = 0, allImmune = true;
  for (const [a, ratio] of sk.a){
    const def = tg.res[a] || 0; if (def < 100) allImmune = false;
    mix += ratio / 100 * Math.max(1 + (+b.el[a]||0) / 100, 0.1) * Math.max(1 - def / 100, 0.005);
  }
  if (allImmune) mix = 0;
  // critical (DamageCalculator.checkCriticalHit + crit cut)
  const FX = tg.fix || {};
  const cri = Math.min(1, Math.max(0, (FX[12] != null ? FX[12] : (+b.cri||0)) / 100 * (1 - (tg.cav||0) / 100)));
  const crd = FX[13] != null ? FX[13] : (+b.crd || 170);
  const critF = (crd - Math.floor((crd - 100) * (tg.crc||0) * 0.01)) / 100;
  const atk = +b.atk || 0;
  const hits = [];
  let total = 0;
  const bonusOnHit = d => { let x = 0; if (FB && FB.onHit) for (const h of FB.onHit) x += h.proc / 100 * Math.min(Math.max(d * h.rate * 0.01 * h.value, 100), h.limit); return x; };
  rates.forEach((hr, i) => {
    const a = cutAttack(atk, tg.atkCut||0, tg.mhc||0, sk.mh ?? 50, i);
    const att = atten(a, tg.def);
    const base = Math.floor(a * att) * hr * power * mix;
    // critical hits add the DEX bonus to the attack before the cuts (StageCharaModel dexcarryupdamage)
    const ac = cutAttack(atk + dexCrit, tg.atkCut||0, tg.mhc||0, sk.mh ?? 50, i);
    const baseC = Math.floor(ac * atten(ac, tg.def)) * hr * power * mix;
    let nc = Math.min(base, cap), cr = Math.min(baseC * critF, cap);
    nc += bonusOnHit(nc); cr += bonusOnHit(cr);
    let dmg = cri * cr + (1 - cri) * nc;
    if (b.bdaP && b.bdaL) dmg += (+b.bdaP / 100) * Math.min(dmg, +b.bdaL);
    hits.push({rate:hr, atk:a, att, dmg});
    total += dmg;
  });
  // "Damage against <monster>" bonuses from the planner build
  const vsRate = FB && FB.vsCard && tg.eid != null ? FB.vsCard.filter(v => v.eids.includes(+tg.eid)).reduce((a, v) => a + v.rate, 0) : 0;
  if (vsRate){ total *= 1 + vsRate / 100; hits.forEach(h => h.dmg *= 1 + vsRate / 100); }
  const time = sk.x?.time || null;
  const cd = (sk.ct / 1000) * (1 - Math.min(+b.cdc||0, 95) / 100);
  const castT = time || +SIM.defaultTime || 1.5;
  return {total, hits, measured:!!measured, time, castT, cd, mix, critF, cri, power, sf, vsRate,
    burst: total / castT, sustained: total / Math.max(castT, cd), casts: total > 0 ? Math.ceil(tg.hp / total) : Infinity};
}
// greedy rotation: always cast the ready skill with the best damage per second of cast time
// basic combos of a weapon category (b=1, no cooldown) - used as filler between skills
function basicSkills(cat){ return SKILLS.filter(s => s.c == cat && s.b).sort((x, y) => x.id - y.id); }
function simFiller(b){
  const list = basicSkills(b.cat); if (!list.length || b.filler === 0) return null;
  return list.find(s => s.id == b.filler) || list[0];
}
// players sharing the boss: explicit setting, else the party size encoded in the variation name (..._diff_party)
function simPlayers(tg, b){
  if (+b.players > 0) return Math.min(+b.players, 5);
  const m = /_(\d)$/.exec(tg.vname || ""); return m ? Math.max(1, +m[1]) : 1;
}
function simulateRotation(ids, tg, b, limit=3600, share=1){
  const always = capList(b), base = capBuffSum(always);
  const cache = new Map();
  const res = (sk, buff) => { const k = sk.id + ":" + buff; if (!cache.has(k)) cache.set(k, calcSkill(sk, tg, b, buff)); return cache.get(k); };
  const sks = ids.map(id => SKBY[id]).filter(Boolean).map(sk => ({sk, r:res(sk, base), ready:0, casts:0, dmg:0}));
  if (!sks.length) return null;
  const until = new Map(); let buffTime = 0;           // ougi id -> buff end time (only ougi not already counted as always-on)
  const curBuff = t => base + [...until.entries()].reduce((a, [id, u]) => a + (t < u ? capBuffOf(id) : 0), 0);
  const buffOff = sk => sk.dl && !always.includes(sk.id) && !(t0 => (until.get(sk.id) || -1) > t0)(curT);
  let curT = 0;
  const fsk = simFiller(b), fr = fsk ? calcSkill(fsk, tg, b) : null;
  const fill = fsk && fr.total > 0 ? {sk:fsk, r:fr, casts:0, dmg:0, filler:true} : null;
  const hp0 = tg.hp / share;
  let t = 0, hp = hp0, idle = 0; const timeline = [];
  while (hp > 0 && t < limit){
    const ready = sks.filter(s => s.ready <= t + 1e-9 && s.r.total > 0);
    if (!ready.length){
      const next = Math.min(...sks.filter(s => s.r.total > 0).map(s => s.ready));
      if (!isFinite(next)) break;
      if (fill){ // basic attacks until the next skill comes back (damage pro-rated by time)
        const d = next - t, rate = fill.r.total / fill.r.castT;
        if (rate * d >= hp){ const dt = hp / rate; fill.dmg += hp; fill.casts += dt / fill.r.castT; timeline.push({sk:fill.sk, t, d:dt}); t += dt; hp = 0; break; }
        fill.dmg += rate * d; fill.casts += d / fill.r.castT; hp -= rate * d;
        timeline.push({sk:fill.sk, t, d}); t = next; continue;
      }
      idle += next - t; timeline.push({idle:true, t, d:next - t}); t = next; continue;
    }
    curT = t; const cb = curBuff(t);
    ready.forEach(s => s.cur = res(s.sk, cb));
    // a cap-buff ougi that is ready and not already active goes first
    ready.sort((x, y) => (buffOff(y.sk) ? 1 : 0) - (buffOff(x.sk) ? 1 : 0) || y.cur.total / y.cur.castT - x.cur.total / x.cur.castT);
    const s = ready[0], rr = s.cur;
    s.ready = t + rr.cd; s.casts++; s.dmg += Math.min(rr.total, hp); hp -= rr.total;
    timeline.push({sk:s.sk, t, d:rr.castT, buffed: cb > base}); t += rr.castT;
    if (s.sk.dl && !always.includes(s.sk.id)){ until.set(s.sk.id, t + s.sk.dl[1] / 1000); buffTime += s.sk.dl[1] / 1000; }
  }
  const all = fill && fill.casts ? [...sks, fill] : sks;
  return {time: hp <= 0 ? t : null, dealt: hp0 - Math.max(hp, 0), hp0, share, idle, sks:all, timeline, limit, buffTime: Math.min(buffTime, t), hasBuff: sks.some(s => s.sk.dl), dps: (hp0 - Math.max(hp,0)) / Math.max(t, 0.001)};
}
