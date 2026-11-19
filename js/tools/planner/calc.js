"use strict";
/* OnigiriDex — exact status formulas (port of FinalPlayerCharaStatus) */
/* OnigiriDex build calculator — a port of the game's FinalPlayerCharaStatus.updateFinalStatus
 * (no buffs / sake / partner control), validated against the real engine with random builds.
 * Works in the browser (window.BuildCalc) and in node (module.exports). */
(function (root) {
"use strict";
const T = Math.trunc;
// SecondaryStatus enum indices
const SS = {HP:0, SP:1, ATK:2, P_DEF:3, P_ATKSPD:4, P_ACCUR:5, P_AVO:6, M_DEF:7, M_ATKSPD:8, M_ACCUR:9, M_AVO:10, CURE:11, CRI:12, CRIDMG:13, CRIAVO:14,
  BACK_ATK:15, HP_HEALSPD:16, SP_HEALSPD:17, CT_CUT_PER:18, SP_CUT_PER:19, RUN_SPD:20, FIRE:21, ICE:22, ELEC:23, DARK:24, WATER:25, EARTH:26, WIND:27,
  HOLY:28, POISON:29, FLY:30, SLASH:31, STRIKE:32, THRUST:33, EXP_BOOST:34, DROPMONEY_BOOST:35, DROPITEM_BOOST:36, PROFICIENCY_BOOST:37, ATK_CUT:38,
  MULTIHIT_CUT:39, CRIUP_BORDER:40, CRITICAL_CUT:41, STAMINA_MODIFIER:42};
const N_SS = 43;
const ATTR_MAX = 250, ATTR_MIN = -100, STATUS_LIMIT = 65535;
// CharaSecondaryStatus limitsForPlayer
const LIMITS = {0:[1,50000], 1:[0,3000], 2:[0,200000], 3:[0,60000], 4:[-80,50], 7:[0,60000], 11:[0,200], 12:[0,100], 13:[0,300], 14:[0,100],
  16:[0,500], 17:[0,500], 18:[-100,80], 19:[-100,80], 20:[-85,85], 15:[0,500], 42:[-75,300],
  34:[-100,STATUS_LIMIT], 35:[-100,STATUS_LIMIT], 36:[-100,STATUS_LIMIT], 37:[-100,STATUS_LIMIT]};
for (let i = 21; i <= 33; i++) LIMITS[i] = [ATTR_MIN, ATTR_MAX];
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const F = Math.fround;
const fpow = (a, b) => F(Math.pow(F(a), F(b)));

function weaponPowerByStat(x){ return T(F(fpow(1.01, x - 1) * F(20 + (x - 1) * 6.0))); }
function bonusAttack(str){ const t = [0,9,21,41,69,105,149,201,261,329,405]; return str < 10 ? 0 : t[Math.min(10, T(str / 10))]; }
function defBonus(vit){ const t = [0,8,17,32,53,80,113,152,197,248,305]; return vit < 10 ? 0 : t[Math.min(10, T(vit / 10))]; }
function dexCritBonus(dex){ const t = [0,50,110,180,260,350,450,560,680,810,950]; return dex < 10 ? 0 : t[Math.min(10, T(dex / 10))]; }
function weaponPowerLimit(lv){ return lv <= 100 ? 3000 : lv >= 111 ? 4000 + (lv - 110) * 400 : 3000 + (lv - 100) * 100; }
function crystalCapacity(lv, nigi){
  const add = lv > 99 ? 20 : lv > 89 ? 18 : lv > 79 ? 16 : lv > 69 ? 14 : lv > 59 ? 12 : lv > 49 ? 10 : lv > 39 ? 8 : lv > 29 ? 6 : lv > 19 ? 4 : lv > 9 ? 2 : 0;
  const lvcap = lv < 80 ? lv + 20 : 100 + T((lv - 80) / 2);
  return T(lvcap + (nigi||0) * 3 + add);
}
function calcHP(lv, str, vit){ return T(F(F(fpow(1.01, lv - 1) * (100 + (lv - 1) * 20)) * F(1 + F((str + vit * 2) / 300.0)))); }
function calcSP(lv, int, mnd){ return T(F(F(fpow(1.01, lv - 1) * (100 + (lv - 1) * 2)) + fpow(T(int / 2) + mnd, 1.2))); }

// FinalCharaStatus.calcSecondaryStatus
function secondaryFromBase(lv, s){
  const [str, vit, int, mnd, dex] = s;
  const v = new Array(N_SS).fill(0);
  v[SS.HP] = calcHP(lv, str, vit);
  v[SS.SP] = calcSP(lv, int, mnd);
  const pDef = F(fpow(1.001, vit - 1) * (25 + (vit - 1) * 6));
  const mDef = F(fpow(1.001, mnd - 1) * (25 + (mnd - 1) * 6));
  v[SS.P_DEF] = T(F(pDef + F(mDef * F(0.3))));
  v[SS.M_DEF] = T(F(mDef + F(pDef * F(0.3))));
  v[SS.P_ATKSPD] = T((dex + 2 * str) / 24);
  v[SS.P_ACCUR] = 100; v[SS.P_AVO] = 100;
  v[SS.M_ATKSPD] = T(int / 8);
  v[SS.M_ACCUR] = 100; v[SS.M_AVO] = 100;
  v[SS.CURE] = 100;
  v[SS.CRI] = 5 + T((int + 2 * dex) / 24);
  v[SS.CRIDMG] = 170;
  v[SS.BACK_ATK] = 100;
  v[SS.HP_HEALSPD] = 100 + T(vit / 2);
  v[SS.SP_HEALSPD] = T(F(100 + F(mnd + T(int / 2) + fpow(int, 1.2))));
  v[SS.CT_CUT_PER] = T((mnd + 2 * dex) / 24);
  return v;
}

// ---------------------------------------------------------------- conditions
function cmp(op, a, b){ switch (op){ case 0: return a == b; case 1: return a != b; case 2: return a < b; case 3: return a <= b; case 4: return a > b; case 5: return a >= b; } return false; }
function checkCond(c, ctx){
  if (!c) return true;
  const me = checkOne(c, ctx);
  if (c.and) return me && checkCond(c.and, ctx);
  if (c.or) return me || checkCond(c.or, ctx);
  return me;
}
function checkOne(c, ctx){
  switch (c.k){
    case "lv": return cmp(c.cmp, ctx.lv, c.v);
    case "bs": return cmp(c.cmp, ctx.base ? ctx.base[c.s] : 0, c.v);
    case "ss": return ctx.sec ? cmp(c.cmp, ctx.sec[c.s] || 0, c.v) : false;
    case "hp": return ctx.sec ? cmp(c.cmp, ctx.hpPct, c.v) : false;
    case "sp": return ctx.sec ? cmp(c.cmp, ctx.spPct, c.v) : false;
    case "aw": return ctx.cat === c.c;
    case "eq": return cmp(c.cmp, (ctx.eq && ctx.eq[c.c]) || 0, c.v);
    case "poison": return !!ctx.poison;                       // PoisonCondition ignores the comparison: "while poisoned"
    case "stigma": return c.v == (ctx.stigma || 0);            // StigmaCondition: exact attribute match
    case "drunk": return ctx.drunk == null ? false : cmp(c.cmp, ctx.drunk, c.v);  // needs active sake
    case "partner": return !!ctx.partner;
    default: return !!(ctx.unknown && ctx.unknown[c.k]);
  }
}
// does this condition (or chain) depend on HP/SP?
function hasHPSP(c){ return !!c && (c.k == "hp" || c.k == "sp" || hasHPSP(c.and) || hasHPSP(c.or)); }

// ---------------------------------------------------------------- weapon attack (WeaponItemData._setupWeaponPower / _calcEnhancedAttackPower)
function weaponAttack(w, grade, enh, smeltN, smelt){
  const fGrade = (grade == null ? 100 : grade) / 100;
  const baseAtk = F(w.cap * F(F(0.9) + F(F(fGrade) * F(0.2))));
  const disp = F(w.tend / 100);
  const maxBase = T(F(baseAtk + F(baseAtk * disp)));
  const minBase = Math.max(1, T(F(maxBase - F(F(F(maxBase * disp) * w.tr) * F(0.01)))));
  let smeltLv = 0;
  for (let i = 0; i < (smeltN||0) && smelt && i < smelt.length; i++) smeltLv += smelt[i].b[1];
  const rate = w.er || 1;
  const lvBonus = w.enh ? T(F(F(rate) * (enh||0))) : 0, smBonus = T(F(F(rate) * smeltLv));
  return {min: minBase + lvBonus + smBonus, max: maxBase + lvBonus + smBonus, minBase, maxBase};
}
function enhanceCap(w, smeltN){ const caps = w.caps || [10]; return caps[Math.min(smeltN||0, caps.length - 1)] ?? 1; }

// ornament line selection: explicit `on` array, else all lines (or the first `pick` lines for pick-N ornaments)
function ornamentOn(O, os){
  if (os && Array.isArray(os.on) && os.on.length == O.L.length) return os.on;
  return O.L.map((_, k) => O.pick ? k < O.pick : true);
}
function ornamentsFor(set, DB){
  return (DB.orn || []).filter(o => o.ty.includes(set.et) && o.lv <= (set.cl ?? 99));
}

// ---------------------------------------------------------------- main
/**
 * build = {lv, pers, alloc:[5], extra:[5], nigi, bonusPts,
 *          weapon:{id, grade, enh, smelt, extra:[opts]}, crys:[{id, grade, extra:[opts], cost:+n}...], (accessories are crystals with k=26)
 *          cond:{hpPct, spPct, poison, stigma, drunk, eq:{cat:count}, partner}}
 */
function compute(build, DB){
  const lv = clamp(build.lv|0 || 1, 1, DB.cap || 140);
  const P = DB.pers.find(p => p.id == build.pers) || DB.pers[0];
  const alloc = (build.alloc || [0,0,0,0,0]).map(x => Math.max(0, x|0));
  const extra = (build.extra || [0,0,0,0,0]).map(x => x|0);
  const persBase = P.base;
  const persBonus = P.bonus[lv > 0 && lv < P.bonus.length ? lv : P.bonus.length - 1] || [0,0,0,0,0];
  // status points
  const req = P.req;
  const reqAt = (s, p) => (p > 0 && p <= req.length - 1) ? req[p][s] : (p <= 0 ? 0 : Infinity);
  let spent = 0, overStat = false;
  for (let s = 0; s < 5; s++){
    const from = persBase[s], to = persBase[s] + alloc[s];
    if (to > req.length - 1) overStat = true;
    spent += reqAt(s, to) - reqAt(s, from);
  }
  const ptsTotal = (DB.pts[lv] || 0) + (build.bonusPts|0);
  // equipment
  const WBY = DB._wby || (DB._wby = Object.fromEntries(DB.weapons.map(w => [w.id, w])));
  const CBY = DB._cby || (DB._cby = Object.fromEntries(DB.crys.map(c => [c.k + ":" + c.id, c])));
  const OBY = DB._oby || (DB._oby = Object.fromEntries((DB.orn || []).map(o => [o.id, o])));
  const wsel = build.weapon && WBY[build.weapon.id];
  const cat = wsel ? wsel.c : -1;
  const weaponOpts = [];
  if (wsel){
    weaponOpts.push(...wsel.o);
    for (let i = 0; i < (build.weapon.smelt||0) && i < DB.smelt.length; i++) weaponOpts.push(...DB.smelt[i].o);
    weaponOpts.push(...(build.weapon.extra || []));
  }
  const capacity = crystalCapacity(lv, build.nigi|0);
  const slots = (build.crys || []).map((c, i) => {
    if (!c || c.id == null) return null;
    const set = CBY[(c.k || (i >= 4 ? 26 : 9)) + ":" + c.id]; if (!set) return null;
    // ornaments (装飾) in the magatama's option slots: their options, + cost, + extra defense
    const ornOpts = []; let ornCost = 0, xpd = 0, xmd = 0; const orns = [];
    for (const os of (c.orn || []).slice(0, set.sl || 0)){
      const O = os && OBY[os.id]; if (!O) continue;
      ornCost += O.cost || 0; xpd += (O.pd && O.pd[1]) || 0; xmd += (O.md && O.md[1]) || 0;
      const on = ornamentOn(O, os);
      O.L.forEach((ln, k) => { if (!on[k]) return; const o = Object.assign({}, ln.o);
        if (ln.k && os.val && os.val[k] != null && os.val[k] !== "") o[ln.k] = +os.val[k];
        ornOpts.push(o); });
      orns.push(O);
    }
    return {slot:i, set, grade: c.grade == null ? 100 : c.grade, cost: set.cost + ornCost + (c.cost|0), ornCost, xpd, xmd, orns,
            opts: [...set.o, ...ornOpts, ...(c.extra || [])]};
  }).filter(Boolean);
  // CrystalCollection: sorted by cost (desc, stable), cumulative cost must fit the capacity
  const sorted = slots.slice().sort((a, b) => b.cost - a.cost);
  let used = 0; const active = [];
  for (const c of sorted){ used += c.cost; c.active = used <= capacity; if (c.active) active.push(c); }
  const extraSrc = (build.extraSources || []).filter(a => a && a.length);   // succession title, sake
  const equipOpts = [...weaponOpts, ...active.flatMap(c => c.opts), ...extraSrc.flat()];

  // ---- base status
  const ctx = {lv, cat, hpPct: build.cond?.hpPct ?? 100, spPct: build.cond?.spPct ?? 100, poison: !!build.cond?.poison, stigma: build.cond?.stigma|0,
    drunk: build.cond?.drunk == null || build.cond?.drunk === "" ? null : +build.cond.drunk, eq: build.cond?.eq || (cat >= 0 ? {[cat]: Math.max(1, Math.min(4, build.cond?.eqSame || 1))} : {}), partner: !!build.cond?.partner, unknown: build.cond?.unknown || {}, sec: null};
  const statusBonus = persBonus.map((v, i) => v + extra[i]);
  ctx.base = alloc.map((v, i) => v + persBase[i] + statusBonus[i]);
  for (const o of equipOpts) if (o.t == "b" && checkCond(o.if, ctx)) statusBonus[o.s] += o.v|0;
  const total = alloc.map((v, i) => v + persBase[i] + statusBonus[i]);
  ctx.base = total;

  // ---- secondary status from base
  const sec = secondaryFromBase(lv, total);
  ctx.sec = sec;

  // ---- weapon power
  const [str, vit, int, mnd, dex] = total;
  const ab = bonusAttack(str);
  const wp = new Array(8).fill(0);
  wp[0] = weaponPowerByStat(str) + ab; wp[2] = weaponPowerByStat(dex) + ab; wp[1] = wp[0]; wp[4] = wp[0];
  wp[3] = weaponPowerByStat(vit) + ab; wp[5] = wp[2]; wp[6] = weaponPowerByStat(mnd); wp[7] = weaponPowerByStat(int);
  const WPL = 30000;
  const wpb = new Array(8).fill(0);
  const sources = [weaponOpts, ...active.map(c => c.opts), ...extraSrc];
  for (const src of sources){
    const acc = new Array(8).fill(0);
    for (const o of src) if (o.t == "w" && o.w >= 0 && o.w < 8 && checkCond(o.if, ctx)) acc[o.w] = clamp(acc[o.w] + (o.v|0), 0, WPL);
    for (let i = 0; i < 8; i++) wpb[i] = clamp(wpb[i] + acc[i], 0, WPL);
  }
  const wpLimit = weaponPowerLimit(lv);
  for (let i = 0; i < 8; i++) wp[i] = clamp(T(F(wp[i] * F(1.0 + F(wpb[i] / 100.0)))), 0, wpLimit);

  // ---- secondary options (non HP/SP conditions)
  const bonus = new Array(N_SS).fill(0);
  for (const o of equipOpts) if (o.t == "s" && !o.if){ if (o.g == 1) bonus[o.s] += o.v|0; else sec[o.s] += o.v|0; }
  if (cat == 4) bonus[SS.CRI] += 5;  // axe
  for (const o of equipOpts) if (o.t == "s" && o.if && !hasHPSP(o.if) && checkCond(o.if, ctx)){ if (o.g == 1) bonus[o.s] += o.v|0; else sec[o.s] += o.v|0; }
  // crystal defence + VIT bonus
  let pdefC = 0, mdefC = 0;
  for (const c of active){ const r = F(F(0.7) + F(F(c.grade / 100) * F(0.6))); pdefC += T(F(c.set.pd * r)) + (c.xpd|0); mdefC += T(F(c.set.md * r)) + (c.xmd|0); }
  if (wsel || active.length){ sec[SS.P_DEF] += pdefC + defBonus(vit); sec[SS.M_DEF] += mdefC; }
  let addAtk = sec[SS.ATK], sumAtk = bonus[SS.ATK];
  for (let i = 0; i < N_SS; i++) sec[i] = T(F(sec[i] * F(F(bonus[i] * F(0.01)) + 1.0)));
  // HP/SP conditioned options
  const clampAll = () => { for (const k in LIMITS){ const [a, b] = LIMITS[k]; sec[k] = clamp(sec[k], a, b); } };
  clampAll();
  const bonus2 = new Array(N_SS).fill(0); let add2Atk = 0;
  for (const o of equipOpts) if (o.t == "s" && o.if && hasHPSP(o.if) && checkCond(o.if, ctx)){
    if (o.g == 1) bonus2[o.s] += o.v|0; else { sec[o.s] += o.v|0; if (o.s == SS.ATK) add2Atk += o.v|0; }
  }
  addAtk += add2Atk; sumAtk += bonus2[SS.ATK];
  for (let i = 0; i < N_SS; i++) sec[i] = T(F(sec[i] * F(F(bonus2[i] * F(0.01)) + 1.0)));

  // ---- attack (FinalPlayerCharaStatus._calcAttackPower)
  let minAtk = 0, maxAtk = 0, watk = null;
  if (wsel){
    watk = weaponAttack(wsel, build.weapon.grade, build.weapon.enh, build.weapon.smelt, DB.smelt);
    const center = T((watk.min + watk.max) / 2);
    const power = wp[cat];
    const rate = F(1.0 + F(sumAtk * F(0.01)));
    sec[SS.ATK] = Math.max(1, T(F(F(center + power) * rate)));
    minAtk = clamp(Math.max(1, T(F(F(watk.min + addAtk + power) * rate))), 0, 200000);
    maxAtk = clamp(Math.max(1, T(F(F(watk.max + addAtk + power) * rate))), 0, 200000);
  } else sec[SS.ATK] = 0;
  if (sec[SS.HP] < 1) sec[SS.HP] = 1;
  if (sec[SS.SP] < 0) sec[SS.SP] = 0;
  clampAll();
  // getLimitedSecondaryStatusValue: stats without a player limit read as 0
  const raw = sec.slice();
  for (let i = 0; i < N_SS; i++) if (!(i in LIMITS)) sec[i] = 0;

  // ---- skill force per weapon category & skill rank (CharaSkillPower), conditions checked with final status
  const skillPow = Array.from({length: 8}, () => new Array(11).fill(0));
  for (const o of equipOpts){
    if (o.t != "k" || !checkCond(o.if, ctx)) continue;
    const cats = o.w < 0 ? [0,1,2,3,4,5,6,7] : [o.w];
    // CharaSkillPower.addSkillPowerValueUntilMaxRank: rank r applies to ranks r..maxRank (maxRank -1 = 10)
    const maxR = (o.m == null || o.m === -1) ? 10 : o.m;
    for (const ci of cats){
      const arr = skillPow[ci];
      if (o.r >= 0 && o.r <= 10){ for (let r = o.r; r <= maxR; r++) arr[r] += o.v|0; }
      else for (let r = 0; r <= 10; r++){ if (r <= maxR) arr[r] += o.v|0; }
    }
  }
  // ---- special effects (state errors granted by equipment)
  let extraDmgLimit = 0; const onHit = [], effects = [];
  for (const o of equipOpts){
    if (o.t != "e" || !checkCond(o.if, ctx)) continue;
    if (o.p == "ExtraDamageLimit") extraDmgLimit += o.extraDmgLimit || 0;
    else if (o.p == "AttributeDamageOnHit") onHit.push({attr:o.attributeType, proc:o.proc, rate:o.rate, limit:o.limitValue});
    effects.push(o);
  }
  return {
    lv, pers:P, total, alloc, persBase, statusBonus, spent, ptsTotal, ptsLeft: ptsTotal - spent, overStat,
    sec, raw, minAtk, maxAtk, atk: sec[SS.ATK], watk, wp, wpLimit, cat, weapon:wsel,
    capacity, used, slots, active, skillPow, extraDmgLimit, onHit, effects, dexCrit: dexCritBonus(dex), equipOpts, ctx
  };
}

const API = {compute, ornamentOn, ornamentsFor, SS, weaponAttack, enhanceCap, crystalCapacity, checkCond, secondaryFromBase, weaponPowerLimit, dexCritBonus};
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.BuildCalc = API;
})(typeof window !== "undefined" ? window : globalThis);
