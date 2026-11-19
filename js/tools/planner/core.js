"use strict";
/* OnigiriDex — planner state, option texts, pickers, skill picker, ornaments, sets */
/* OnigiriDex — Build Planner page. Uses BuildCalc (buildcalc.js) and helpers from app.js. */
const BDB = D.build;
const STATS = ["Pow","Vit","Wis","Mnd","Dex"];
const STAT_LONG = ["Power (STR)","Vitality","Wisdom (INT)","Mind","Dexterity"];
const SEC_NAMES = ["HP","SP","ATK","P.DEF","Attack speed","P.Accuracy","P.Evasion","M.DEF","Cast speed","M.Accuracy","M.Evasion","Healing",
  "Crit rate","Crit damage","Crit evasion","Back attack","HP regen","SP regen","Cooldown cut","SP cost cut","Move speed",
  "Fire","Ice","Thunder","Dark","Water","Earth","Wind","Holy","Poison","Flying","Slash","Strike","Pierce",
  "EXP boost","Ryou boost","Drop boost","Proficiency boost","ATK cut","Multi-hit cut","Crit border","Crit res.","Stamina use"];
const CMP_TXT = ["=","≠","<","≤",">","≥"];
// game Attr enum -> our ATTRS index ; sec index of each ATTRS entry
const ATTR_ENUM = {11:0,12:1,13:2,1:3,2:4,3:5,4:6,5:7,6:8,7:9,8:10,9:11,10:12};
const ATTR_SEC = [31,32,33,21,22,23,24,25,26,27,28,29,30];
const WBY = {}; BDB?.weapons.forEach(w => WBY[w.id] = w);
const CBY = {}; BDB?.crys.forEach(c => CBY[c.k + ":" + c.id] = c);
const OBY = {}; BDB?.orn?.forEach(o => OBY[o.id] = o);
// Amaterasu Nigimitama: 8 levels (+3 magatama capacity each, no stats); quest status point rewards: 10+25+30+35+40x4 = 260
const NIGI_MAX = 8, QUEST_PTS_MAX = 260;
const STAT_CAP = 100;   // personality base + allocated points (PersonalitySetting.request has 101 rows)
const WEAPON_SLOTS = 4, SKILL_SLOTS = 3, OUGI_SLOTS = 2;
// ornaments most players use, shown first (name prefixes, every tier)
const POPULAR_ORN = ["surrounding water", "returning heavens forge", "lion skull", "root of golden alchemy", "confining terror", "fated contractor"];

const emptyWeapon = () => null;
const DEFAULT_BUILD = () => ({name:"My build", lv: Math.min(BDB?.cap||140, 100), pers: BDB?.pers[0]?.id ?? 0, alloc:[0,0,0,0,0], extra:[0,0,0,0,0],
  nigi:NIGI_MAX, bonusPts:QUEST_PTS_MAX, weapons:[null,null,null,null], active:0, crys:[null,null,null,null,null,null],
  cond:{hpPct:100, spPct:100, poison:false, stigma:0, drunk:null}});
// bring older saved builds to the current shape
function normalizeBuild(b){
  b = Object.assign(DEFAULT_BUILD(), b || {});
  if (!Array.isArray(b.weapons)) b.weapons = [b.weapon || null, null, null, null];
  while (b.weapons.length < WEAPON_SLOTS) b.weapons.push(null);
  b.weapons = b.weapons.slice(0, WEAPON_SLOTS).map(w => w && WBY[w.id] ? Object.assign({grade:100, enh:0, smelt:0, extra:[], skills:[], ougi:[]}, w) : null);
  delete b.weapon;
  if (!(b.active >= 0 && b.active < WEAPON_SLOTS) || !b.weapons[b.active]) b.active = Math.max(0, b.weapons.findIndex(Boolean));
  if (!Array.isArray(b.crys)) b.crys = [null,null,null,null,null,null];
  while (b.crys.length < 6) b.crys.push(null);
  b.crys = b.crys.map(c => c ? Object.assign({grade:100, extra:[], cost:0, orn:[]}, c) : null);
  b.cond = Object.assign({hpPct:100, spPct:100, poison:false, stigma:0, drunk:null}, b.cond || {});
  if (!Array.isArray(b.sets)) b.sets = Array(10).fill(null);
  if (!(b.set >= 0 && b.set < 10)) b.set = 0;
  return b;
}
let BUILD = normalizeBuild(load("od2-build", {}));
let SAVED = (() => { try { return JSON.parse(localStorage.getItem("od2-builds") || "{}"); } catch(e){ return {}; } })();
try { if (!localStorage.getItem("od2-maxed")){ BUILD.nigi = NIGI_MAX; BUILD.bonusPts = QUEST_PTS_MAX; for (const k in SAVED){ SAVED[k].nigi = NIGI_MAX; SAVED[k].bonusPts = QUEST_PTS_MAX; } localStorage.setItem("od2-builds", JSON.stringify(SAVED)); localStorage.setItem("od2-maxed", "1"); } } catch(e){}
const saveBuild = () => { syncSet(); store("od2-build", BUILD); };
// refine + smelt always maxed (one-time upgrade of builds made before this default)
function maxWeapon(w){ const x = w && WBY[w.id]; if (x && x.enh){ w.smelt = BDB.smelt.length; w.enh = BuildCalc.enhanceCap(x, w.smelt); } return w; }
function maxAllWeapons(b){ (b.weapons || []).forEach(maxWeapon); (b.sets || []).forEach(st => st && (st.weapons || []).forEach(maxWeapon)); }
try { if (!localStorage.getItem("od2-maxsmelt")){ maxAllWeapons(BUILD); for (const k in SAVED) maxAllWeapons(SAVED[k]);
  localStorage.setItem("od2-builds", JSON.stringify(SAVED)); store("od2-build", BUILD); localStorage.setItem("od2-maxsmelt", "1"); } } catch(e){}
const UI = load("od2-bui", {editW:0, wcat:-1, lvOk:true});
const saveUI = () => store("od2-bui", UI);

// computed build: the active weapon gives stats; every equipped weapon counts for "N+ <type> equipped" conditions
const SYU = BDB?.syumei || [], SAKE = BDB?.sake || [];
const SYU_BY = {}; SYU.forEach(x => SYU_BY[x.id] = x);
const SAKE_BY = {}; SAKE.forEach(x => SAKE_BY[x.id] = x);
const buildSakes = () => (BUILD.sakes || []).filter(id => SAKE_BY[id]);
function extraSources(){
  const out = [];
  if (SYU_BY[BUILD.syumei]) out.push({name: `Succession: ${SYU_BY[BUILD.syumei].n}`, kind: "Succession", opts: SYU_BY[BUILD.syumei].o});
  buildSakes().forEach(id => out.push({name: `Sake: ${SAKE_BY[id].n}`, kind: "Sake", opts: SAKE_BY[id].o}));
  return out;
}
function calcBuild(){
  const eq = {};
  BUILD.weapons.forEach(w => { if (w && WBY[w.id]) { const c = WBY[w.id].c; eq[c] = (eq[c] || 0) + 1; } });
  const b = Object.assign({}, BUILD, {weapon: BUILD.weapons[BUILD.active] || null, cond: Object.assign({}, BUILD.cond, {eq}), extraSources: extraSources().map(x => x.opts)});
  return BuildCalc.compute(b, BDB);
}

// ---------------------------------------------------------------- option text
// comparison in words: "below 50%", "60% or more"...
function cmpWords(cmp, v, unit = ""){
  const x = fmt(v) + unit;
  return [`exactly ${x}`, `not ${x}`, `below ${x}`, `${x} or less`, `above ${x}`, `${x} or more`][cmp] || `${CMP_TXT[cmp] || "?"} ${x}`;
}
const CAT_PLURAL = c => (CATS[c] || "?").replace(/(Sword|Spear|Axe|Bow|Staff|Wand|Odachi)$/, m => m == "Staff" ? "Staves" : m + "s");
const sealName = v => ATTRS[ATTR_ENUM[v]]?.[0] || "#" + v;
function condText(c){
  if (!c) return "";
  let t;
  switch (c.k){
    case "hp": t = `HP ${cmpWords(c.cmp, c.v, "%")}`; break;
    case "sp": t = `SP ${cmpWords(c.cmp, c.v, "%")}`; break;
    case "lv": t = `Level ${cmpWords(c.cmp, c.v)}`; break;
    case "bs": t = `${STATS[c.s]} ${cmpWords(c.cmp, c.v)}`; break;
    case "ss": t = `${SEC_NAMES[c.s] || "stat " + c.s} ${cmpWords(c.cmp, c.v, PCT_SEC.has(c.s) ? "%" : "")}`; break;
    case "aw": t = `using a ${CATS[c.c] || "?"}`; break;
    case "eq": t = c.cmp == 5 ? `${c.v}+ ${CAT_PLURAL(c.c)} equipped` : `${CAT_PLURAL(c.c)} equipped ${cmpWords(c.cmp, c.v)}`; break;
    case "poison": t = "while poisoned"; break;
    case "stigma": t = `Seal of ${sealName(c.v)} active`; break;
    case "drunk": t = c.cmp == 0 && c.v == 0 ? "when not drunk" : `drunkenness ${cmpWords(c.cmp, c.v)}`; break;
    case "partner": t = "partner summoned"; break;
    default: t = c.k;
  }
  if (c.and) t += " and " + condText(c.and);
  if (c.or) t += " or " + condText(c.or);
  return t;
}
// patch for BUILD.cond that makes a condition true (null when it depends on gear/level)
function condSatisfy(c, patch = {}){
  if (!c) return patch;
  const pick = (cmp, v, lo, hi) => Math.max(lo, Math.min(hi, [v, v == hi ? v - 1 : v + 1, v - 1, v, v + 1, v][cmp] ?? v));
  switch (c.k){
    case "hp": patch.hpPct = pick(c.cmp, c.v, 1, 100); break;
    case "sp": patch.spPct = pick(c.cmp, c.v, 0, 100); break;
    case "poison": patch.poison = true; break;
    case "stigma": patch.stigma = c.v; break;
    case "drunk": patch.drunk = pick(c.cmp, c.v, 0, 999); break;
    default: return null;
  }
  if (c.and && !condSatisfy(c.and, patch)) return null;
  return patch;
}
const signed = v => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
function rankText(r, m){
  if ((r == null || r < 0) && (m == null || m < 0)) return "all ranks";
  const lo = r >= 0 ? r : 0, hi = m >= 0 ? m : 10;
  if (lo == 0 && hi >= 10) return "all ranks";
  if (lo == hi) return `rank ${lo}`;
  return hi >= 10 ? `rank ${lo}+` : `rank ${lo}–${hi}`;
}
// monster cards (targets of "damage against X" effects)
const CARDS = BDB?.cards || {};
function cardRef(id){
  const c = CARDS[id]; if (!c) return `monster #${id}`;
  const names = [...new Set(c[1].map(e => E[e]?.n).filter(Boolean))];
  const tip = names.length ? `${names.length} monster${names.length > 1 ? "s" : ""}: ${names.slice(0, 25).join(", ")}${names.length > 25 ? "…" : ""}` : "";
  return `<span class="cardref" title="${esc(tip)}">${esc(c[0])}</span>`;
}
const elName = a => ATTRS[ATTR_ENUM[a]]?.[0] || "?";
const secs = ms => (ms / 1000).toFixed(ms % 1000 ? 1 : 0) + "s";
const SE_TEXT = {
  ExtraDamageLimit: o => `Damage limit +${fmt(o.extraDmgLimit)}`,
  AttributeDamageOnHit: o => `${o.proc}% chance on hit: adds ${o.rate}× your ${elName(o.attributeType)}% of the damage as ${elName(o.attributeType)} damage (max ${fmtM(o.limitValue)})`,
  AttributeDamageBackHit: o => `Back attack: ${o.proc}% chance to add ${o.rate}× your ${elName(o.type)}% of the damage as ${elName(o.type)} damage (max ${fmtM(o.limit)})`,
  AttributeDamageOnCritical: o => `Critical hit: adds ${o.rate}× of the damage as ${elName(o.attributeType)} damage (max ${fmt(o.limitValue)})`,
  ProbabilityUpAttributeDamageOnHit: o => `Bonus ${elName(o.attributeType)} damage on hit: ${o.proc}% chance, +${o.procUp}% for every 1% of max HP lost (max ${fmtM(o.limitValue)})`,
  ProbabilityUpProcPerAttributeDamageOnHit: o => `Bonus ${elName(o.attributeType)} damage on hit: +${o.procUp}% chance for every ${o.procPer}% of max HP lost (max ${fmtM(o.limitValue)})`,
  ProbabilityDownProcPerAttributeDamageOnHit: o => `Bonus ${elName(o.attributeType)} damage on hit: ${o.proc}% chance, −${o.procDown}% for every ${o.procPer}% of max HP lost (max ${fmtM(o.limitValue)})`,
  ProbabilityDamage: o => `${o.rate}% chance to deal ${fmt(o.damage)} fixed damage`,
  IncreaseDamageToEnemy: o => `Damage against ${cardRef(o.monsterCardID)} +${o.increaseRate}%`,
  EnemyDamageReduction: o => `Damage taken from ${cardRef(o.monsterCardId)} −${o.reductionRate}%`,
  ConsumeTolerance: o => o.toleranceRate >= 0 ? `Weapon durability loss −${o.toleranceRate}%` : `Weapon durability loss +${-o.toleranceRate}%`,
  ChanceToAvoid: o => `${o.avoidRate}% chance to dodge physical attacks`,
  ChanceToMiss: o => `${o.missRate ?? o.rate}% chance to miss physical attacks`,
  AvoidOnCriticalDamage: o => `${o.avoidRate}% chance to dodge critical damage`,
  AntiCritical: () => `Immune to critical hits`,
  HealUpItem: o => `HP recovery items ${signed(o.upRate)}%`,
  SpHealUpItem: o => `SP recovery items ${signed(o.upRate)}%`,
  HealingPer: o => `Recover ${o.healRate}% HP every ${secs(o.remainingIntervalTime || 1000)} (max ${fmt(o.limitValue)})`,
  SPHealingPer: o => `Recover ${o.healRate}% SP every ${secs(o.remainingIntervalTime || 1000)} (max ${fmt(o.limitValue)})`,
  Rest: o => `Recover ${fmt(o.heal)} HP while seated`,
  LifeOnCriticalHit: o => `${o.healingRate}% of critical damage absorbed as HP`,
  RatioMyLifeOnCriticalHit: o => `Restore ${o.healingRate}% of max HP on a critical hit`,
  BackAttackLifeRecovery: o => `Restore ${o.recoveryRate}% of max HP on a back attack (doesn't stack)`,
  ReflectDamage: o => `Reflect ${o.reflectRate}% of damage taken (max ${fmtM(o.maxValue)})`,
  SlipDamageOver: o => `Lose ${o.isPercent ? o.damage + "% of max HP" : fmt(o.damage) + " HP"} every ${secs(o.INTERVAL || o.remainingIntervalTime || 1000)}${o.endure ? " (can't drop below 1 HP)" : ""}`,
  LastStand: o => `Gets stronger for every ${o.hpPer}% of max HP lost`,
  Undead: () => `Survives a fatal blow`,
  SimpleStateOver: o => `Special state #${o.key}`,
  JustGuardSuccess: o => `Just Guard grants a buff for ${secs(o.errorTime)} (doesn't stack)`,
  CPBoost: o => `Vanguard gauge +${o.value}%`,
  SecondaryStatusFixed: o => `${SEC_NAMES[o.statusType] || "stat"} fixed at ${fmt(o.fixedValue)}`,
  BaseStatusFixed: o => `${STATS[o.statusType] || "stat"} fixed at ${fmt(o.fixedValue)}`,
  Slow: o => `Run speed ${signed(o.changeValue)}`,
  Protection: o => `Status ailment immunity${o.num > 0 ? ` (${o.num}×)` : ""}`,
  SakeAddHeal: o => `Recover ${o.heal} HP${o.spHeal ? ` and ${o.spHeal} SP` : ""} from sake`,
  DrunkenessHealUp: o => `Sober up ${o.healValue}% faster`,
  AlcoholTolerance: o => o.addValue ? `Drunkenness ${signed(o.addValue)}` : `Alcohol tolerance ${signed(o.toleranceRate)}%`,
  IncreaseApparentLevel: o => `Weapon level requirement −${o.increaseLvl}`,
  IncreaseGuardDmgCutRate: o => `Guard: damage taken −${o.increaseRate}%`,
  IncreaseEffectiveArea: o => `Gather distance +${o.increaseRange}m`,
  PurifyStateError: o => `Cures status ailments every ${secs(o.interval)}`,
};
// effects whose values add up (key param, unit, group)
const SE_SUM = {
  IncreaseDamageToEnemy: ["increaseRate", "%", "Vs monsters", o => `Damage against ${cardRef(o.monsterCardID)}`, o => o.monsterCardID],
  EnemyDamageReduction: ["reductionRate", "%", "Vs monsters", o => `Less damage from ${cardRef(o.monsterCardId)}`, o => o.monsterCardId],
  ExtraDamageLimit: ["extraDmgLimit", "", "Special", () => "Damage limit"],
  ChanceToAvoid: ["avoidRate", "%", "Special", () => "Dodge physical attacks (chance)"],
  AvoidOnCriticalDamage: ["avoidRate", "%", "Special", () => "Dodge critical damage (chance)"],
  HealUpItem: ["upRate", "%", "Special", () => "HP recovery items"],
  SpHealUpItem: ["upRate", "%", "Special", () => "SP recovery items"],
  CPBoost: ["value", "%", "Special", () => "Vanguard gauge"],
  IncreaseEffectiveArea: ["increaseRange", "m", "Special", () => "Gather distance"],
  ConsumeTolerance: ["toleranceRate", "%", "Special", () => "Weapon durability resistance"],
};
function optText(o){
  let t;
  switch (o.t){
    case "b": t = `${signed(o.v)} ${STATS[o.s]}`; break;
    case "s": t = `${o.g == 1 ? signed(o.v) + "%" : signed(o.v)} ${SEC_NAMES[o.s] || "stat " + o.s}`; break;
    case "k": t = `${signed(o.v)}% Skill Force (${o.w >= 0 ? CATS[o.w] : "all weapons"}, ${rankText(o.r, o.m)})`; break;
    case "w": t = `${signed(o.v)}% Affinity (${o.w >= 0 ? CATS[o.w] : "none"})`; break;
    case "e": t = (SE_TEXT[o.p] ? SE_TEXT[o.p](o) : o.p.replace(/([a-z])([A-Z])/g, "$1 $2")); break;
    default: t = o.c || "?";
  }
  return t + (o.if ? ` <span class="mute">— ${esc(condText(o.if))}</span>` : "");
}
function optClass(o){ if (o.t == "e") return "neu"; const v = o.v || 0; return v < 0 ? "res" : "weak"; }
function optList(opts, active=true){
  if (!opts?.length) return `<div class="mute" style="font-size:12px">No effects.</div>`;
  return `<ul class="optl ${active ? "" : "off"}">${opts.map(o => `<li class="${optClass(o)}">${optText(o)}</li>`).join("")}</ul>`;
}

// ---------------------------------------------------------------- pickers
function itemPicker(id, placeholder, list, onPick, render){
  return {
    html: `<div class="picker"><input type="text" id="${id}" placeholder="${esc(placeholder)}" style="width:100%" autocomplete="off"><div class="sugg" id="${id}-s"></div></div>`,
    bind(){
      const inp = $("#" + id), box = $("#" + id + "-s");
      if (!inp) return;
      inp.oninput = () => {
        const q = inp.value.trim().toLowerCase();
        if (q.length < 2){ box.classList.remove("show"); return; }
        const res = list().filter(x => (x.n + " " + x.j).toLowerCase().includes(q)).slice(0, 25);
        box.innerHTML = res.map((x, k) => `<a data-i="${k}">${render(x)}</a>`).join("") || `<div class="empty" style="padding:12px">Nothing found</div>`;
        box.classList.add("show");
        box.querySelectorAll("[data-i]").forEach(a => a.onclick = () => { box.classList.remove("show"); onPick(res[+a.dataset.i]); });
      };
    }
  };
}
const iconOf = name => { const p = ICONS[name]; return p ? `<span class="ico" style="background-position:-${p[0]}px -${p[1]}px"></span>` : `<span class="ico none"></span>`; };
const rankBadge = r => r >= 0 ? `<span class="chip" style="padding:0 6px">${"CBAS"[r] || "?"}</span>` : "";


// ---------------------------------------------------------------- small render helpers
function optListShort(opts, active=true, max=6){
  if (!opts?.length) return `<div class="mute" style="font-size:12px">No built-in effects.</div>`;
  const li = o => `<li class="${optClass(o)}">${optText(o)}</li>`;
  if (opts.length <= max + 1) return `<ul class="optl ${active ? "" : "off"}">${opts.map(li).join("")}</ul>`;
  return `<ul class="optl ${active ? "" : "off"}">${opts.slice(0, max).map(li).join("")}</ul>
    <details class="more-opts"><summary>+${opts.length - max} more</summary><ul class="optl ${active ? "" : "off"}">${opts.slice(max).map(li).join("")}</ul></details>`;
}
function hudTile(label, value, sub, cls=""){
  return `<div class="hud-t ${cls}"><div class="k">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
}
// skills: ranks I–VII ; ougi: ranks IV–VII and Sublime (rank 8)
const ROMAN = ["0","I","II","III","IV","V","VI","VII","Sublime / VIII","IX","X"];
const SKILL_RANKS = [7,6,5,4,3,2,1], OUGI_RANKS = [8,7,6,5,4];
const skillsOf = (cat, ougi) => SKILLS.filter(s => s.c == cat && !s.b && (ougi ? s.o > 0 && OUGI_RANKS.includes(s.r) : s.o != 1 && SKILL_RANKS.includes(s.r)));
// community rating -> sortable score (S+ best ... E- worst)
function ratingScore(r){ if (!r) return -1; const m = String(r).trim().match(/^([SABCDE])([+-]?)/i); if (!m) return -1;
  return ("EDCBAS".indexOf(m[1].toUpperCase())) * 3 + (m[2] == "+" ? 2 : m[2] == "-" ? 0 : 1); }
// slot button: shows the chosen skill, opens the filtered picker
function skillSlotBtn(wi, kind, k, cur){
  const sk = cur ? SKBY[cur] : null;
  const open = UI.skp && UI.skp.w == wi && UI.skp.kind == kind && UI.skp.k == k;
  return `<div class="skslot ${open ? "open" : ""}">
    <button class="skbtn" data-skp="${wi}|${kind}|${k}">
      <span class="lbl">${kind == "ougi" ? "Ougi" : "Skill"} ${k + 1}</span>
      ${sk ? `<span class="nm">${esc(sk.n)}</span><span class="els">${sk.a.map(([a, r]) => `<i style="background:${ATTR_COLORS[a]}" title="${r}% ${ATTRS[a][0]}"></i>`).join("")}</span>${sk.x?.rDmg ? `<span class="rt">${esc(sk.x.rDmg)}</span>` : ""}`
           : `<span class="nm mute">choose…</span>`}
    </button>${sk ? `<button class="xbtn" data-skx="${wi}|${kind}|${k}" title="Clear">✕</button>` : ""}</div>`;
}
function skillPickerPanel(cat){
  const P = UI.skp; if (!P) return "";
  const ougi = P.kind == "ougi";
  const ranks = ougi ? OUGI_RANKS : SKILL_RANKS;
  const all = skillsOf(cat, ougi);
  const elems = [...new Set(all.flatMap(s => s.a.map(a => a[0])))].sort((a, b) => a - b);
  const nCap = all.filter(s => s.dl).length;
  return `<aside class="sheet skpick" role="dialog" aria-label="Choose ${ougi ? "ougi" : "skill"} ${P.k + 1}">
    <div class="dr-head"><span class="ph-k">Choose ${ougi ? "ougi" : "skill"} ${P.k + 1} · ${esc(CATS[cat] || "")}</span><button class="xbtn" data-skclose aria-label="Close" title="Close">✕</button></div>
    <div class="sheet-body">
    ${nCap ? `<div class="seg sm skcapseg" role="group" aria-label="Filter"><button data-skcap="0" class="${P.cap ? "" : "on"}">All ${ougi ? "ougi" : "skills"}</button><button data-skcap="1" class="${P.cap ? "on" : ""}">Raises damage cap <b>${nCap}</b></button></div>` : ""}
    <div class="skf">
      <input type="text" id="skq" placeholder="Search…" value="${esc(P.q || "")}">
      <select id="sksort"><option value="rating" ${P.sort=="rating"?"selected":""}>Best rating</option><option value="rank" ${P.sort=="rank"?"selected":""}>Rank</option><option value="name" ${P.sort=="name"?"selected":""}>Name</option><option value="dmg" ${P.sort=="dmg"?"selected":""}>Measured damage</option></select>
      <label><input type="checkbox" id="skmeas" ${P.meas ? "checked" : ""}> rated only</label>
    </div>
    <div class="chips skchips"><span class="chip x ${P.el == null ? "on" : ""}" data-skel="">All elements</span>${elems.map(a => `<span class="chip x ${P.el == a ? "on" : ""}" data-skel="${a}" style="border-color:${ATTR_COLORS[a]}">${ATTRS[a][0]}</span>`).join("")}</div>
    <div class="chips skchips"><span class="chip x ${P.rk == null ? "on" : ""}" data-skrk="">All ranks</span>${ranks.map(r => `<span class="chip x ${P.rk == r ? "on" : ""}" data-skrk="${r}">${ROMAN[r]}</span>`).join("")}</div>
    <div id="sklist" class="sklist2"></div>
  </div></aside>`;
}
function drawSkillList(cat){
  const P = UI.skp, box = $("#sklist"); if (!P || !box) return;
  const q = (P.q || "").toLowerCase();
  let list = skillsOf(cat, P.kind == "ougi").filter(s => (P.el == null || s.a.some(a => a[0] == P.el)) && (P.rk == null || s.r == P.rk) && (!q || (s.n + " " + s.j).toLowerCase().includes(q)) && (!P.meas || s.x?.rDmg) && (!P.cap || s.dl));
  const sorters = {rating:(a,b) => ratingScore(b.x?.rDmg) - ratingScore(a.x?.rDmg) || b.r - a.r, rank:(a,b) => b.r - a.r || a.n.localeCompare(b.n), name:(a,b) => a.n.localeCompare(b.n), dmg:(a,b) => (b.x?.dmg||0) - (a.x?.dmg||0)};
  list.sort(sorters[P.sort] || sorters.rating);
  const W = BUILD.weapons[P.w]; const cur = W ? (P.kind == "ougi" ? W.ougi : W.skills) || [] : [];
  box.innerHTML = list.slice(0, 150).map(s => `<button class="skopt ${cur.includes(s.id) ? "taken" : ""}" data-skpick="${s.id}">
      <span class="nm">${esc(s.n)}${s.dl ? ` <span class="badge b-cap" title="Raises the damage cap by ${fmt(s.dl[0])} for ${s.dl[1] / 1000}s">CAP +${fmtM(s.dl[0])}</span>` : ""}<span class="jp"> ${esc(s.j)}</span></span>
      <span class="att">${skillAttrChips(s.a)}</span>
      <span class="rk">${ROMAN[s.r]}</span>
      <span class="rt" title="Community damage rating">${s.x?.rDmg ? esc(s.x.rDmg) : "—"}</span>
      <span class="dm mute" title="Measured damage, spreadsheet test build">${s.x?.dmg ? s.x.dmg + "M" : ""}</span>
      <span class="cd mute">${(s.ct/1000).toFixed(1)}s</span></button>`).join("") || `<div class="empty" style="padding:14px">No skills match.</div>`;
  box.querySelectorAll("[data-skpick]").forEach(b => b.onclick = () => {
    const W2 = BUILD.weapons[P.w]; if (!W2) return;
    const arr = P.kind == "ougi" ? (W2.ougi ||= []) : (W2.skills ||= []);
    arr[P.k] = +b.dataset.skpick; UI.skp = null; saveUI(); saveBuild(); const y = window.scrollY, dy = document.querySelector(".dr-body")?.scrollTop; viewBuild(); window.scrollTo(0, y); if (dy && document.querySelector(".dr-body")) document.querySelector(".dr-body").scrollTop = dy;
  });
}
function skillSelect(wi, kind, k, cat, cur){
  const ougi = kind == "ougi";
  const list = skillsOf(cat, ougi);
  const groups = (ougi ? OUGI_RANKS : SKILL_RANKS).map(r => {
    const g = list.filter(s => s.r == r).sort((a, b) => a.n.localeCompare(b.n));
    return g.length ? `<optgroup label="Rank ${ROMAN[r]}">${g.map(s => `<option value="${s.id}" ${s.id == cur ? "selected" : ""}>${esc(s.n)}${s.x?.rDmg ? " · " + esc(s.x.rDmg) : ""}</option>`).join("")}</optgroup>` : "";
  }).join("");
  return `<select class="sksel" data-sk="${wi}|${kind}|${k}"><option value="">— ${ougi ? "Ougi" : "Skill"} ${k + 1} (${ougi ? "IV–VII, Sublime" : "I–VII"}) —</option>${groups}</select>`;
}
function extraEditor(key, list){
  return `<details class="grp xed" ${list.length ? "open" : ""}><summary>Rolled options${list.length ? ` (${list.length})` : ""}</summary>
    ${list.length ? `<ul class="optl">${list.map((o, k) => `<li class="${optClass(o)}">${optText(o)} <a class="mute" data-xdel="${key}|${k}" style="cursor:pointer" title="Remove">✕</a></li>`).join("")}</ul>` : ""}
    <div class="xadd" data-key="${key}">
      <select class="xt"><option value="s">Stat +</option><option value="sp">Stat %</option><option value="b">Base stat</option><option value="k">Skill Force %</option><option value="w">Affinity %</option></select>
      <select class="xs"></select><input type="number" class="xv" placeholder="value"><button class="btn sm xok">Add</button>
    </div></details>`;
}
function fillExtraSelect(row){
  const t = row.querySelector(".xt").value, s = row.querySelector(".xs");
  let opts;
  if (t == "s" || t == "sp") opts = [2,0,1,3,7,12,13,18,19,4,20,15,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(i => [i, SEC_NAMES[i]]);
  else if (t == "b") opts = STATS.map((n, i) => [i, n]);
  else if (t == "k") opts = [[-1,"All weapons"], ...Object.entries(CATS)].flatMap(([c, n]) => [[`${c}|-1`, `${n}, all ranks`], ...[1,2,3,4,5,6,7,8].map(r => [`${c}|${r}`, `${n}, rank ${r}+`])]);
  else opts = Object.entries(CATS);
  s.innerHTML = opts.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("");
}
function extraTarget(key){
  if (key[0] == "w"){ const w = BUILD.weapons[+key.slice(1)]; return w && (w.extra ||= []); }
  const i = +key.slice(1); return BUILD.crys[i] && (BUILD.crys[i].extra ||= []);
}

// ornaments of one magatama slot
function ornamentBlock(i, c, set){
  const n = set.sl || 0;
  if (!n) return "";
  const list = BuildCalc.ornamentsFor(set, BDB).sort((a, b) => b.lv - a.lv || a.n.localeCompare(b.n));
  const popular = POPULAR_ORN.flatMap(name => list.filter(o => o.n.toLowerCase().startsWith(name)).sort((a, b) => b.lv - a.lv));
  const optOf = (o, O) => `<option value="${o.id}" ${O && o.id == O.id ? "selected" : ""}>${esc(o.n)} · cost ${o.cost}</option>`;
  const rows = [];
  for (let k = 0; k < n; k++){
    const os = (c.orn || [])[k];
    const O = os && OBY[os.id];
    const on = O ? BuildCalc.ornamentOn(O, os) : null;
    const picked = on ? on.filter(Boolean).length : 0;
    rows.push(`<div class="orn">
      <select data-orn="${i}|${k}"><option value="">Ornament slot ${k + 1}: empty</option>
        ${popular.length ? `<optgroup label="★ Most used">${popular.map(o => optOf(o, O)).join("")}</optgroup>` : ""}
        <optgroup label="All ornaments">${list.map(o => optOf(o, O)).join("")}</optgroup></select>
      ${O ? `<div class="orn-meta">${O.pick ? `<span class="${picked > O.pick ? "bad" : "mute"}">pick ${O.pick} of ${O.L.length} (${picked} selected)</span>` : `<span class="mute">each line rolls separately</span>`}
          · cost +${O.cost}${O.pd[1] ? ` · P.DEF +${O.pd[1]}` : ""}${O.md[1] ? ` · M.DEF +${O.md[1]}` : ""}</div>
        <div class="orn-lines">${O.L.map((ln, j) => `<label class="ol ${on[j] ? "" : "off"}">
          <input type="checkbox" data-oon="${i}|${k}|${j}" ${on[j] ? "checked" : ""}>
          <span class="ot">${optText(Object.assign({}, ln.o, ln.k && os.val && os.val[j] != null && os.val[j] !== "" ? {[ln.k]: +os.val[j]} : {}))}</span>
          ${ln.lo != null ? `<input type="number" class="ov" data-oval="${i}|${k}|${j}" min="${ln.lo}" max="${ln.hi}" value="${os.val && os.val[j] != null && os.val[j] !== "" ? os.val[j] : ln.o[ln.k]}" title="Rolls ${ln.lo} to ${ln.hi}"><span class="orng">${ln.lo}~${ln.hi}</span>` : ""}
          <span class="op" title="${O.pick ? "Weight when picking" : "Chance to appear"}">${O.pick ? "w" : ""}${ln.p}${O.pick ? "" : "%"}</span>
        </label>`).join("")}</div>` : ""}
    </div>`);
  }
  return `<details class="grp ornd" ${(c.orn || []).some(Boolean) ? "open" : ""}><summary>Ornaments (${n} slot${n > 1 ? "s" : ""})</summary>${rows.join("")}</details>`;
}

// one magatama / accessory card
function slotCard(i, r){
  const kind = i >= 4 ? 26 : 9;
  const c = BUILD.crys[i];
  const set = c ? CBY[kind + ":" + c.id] : null;
  const st = r.slots.find(s => s.slot == i);
  const pk = itemPicker("cq" + i, kind == 9 ? "Search a magatama…" : "Search an accessory…",
    () => BDB.crys.filter(x => x.k == kind && (!UI.lvOk || x.lv <= BUILD.lv)).sort((a,b) => b.lv - a.lv),
    x => { BUILD.crys[i] = {k:kind, id:x.id, grade:100, extra:[], cost:0, orn:[]}; saveBuild(); viewBuild(); },
    x => `${iconOf(x.ic)}<span><b>${esc(x.n)}</b> <span class="jp">${esc(x.j)}</span></span><span class="tag">cost ${x.cost} · Lv ${x.lv}</span>`);
  const label = `<span class="slot-lbl">${kind == 9 ? "Magatama " + (i + 1) : "Accessory " + (i - 3)}</span>`;
  if (!set) return {pk, html: `<div class="bslot empty">${label}${pk.html}</div>`};
  const off = st && !st.active;
  return {pk, html: `<div class="bslot ${off ? "inactive" : ""}">
    <div class="bslot-h">${iconOf(set.ic)}
      <div class="nm"><b title="${esc(set.n)}">${esc(set.n)}</b><div class="jp">${esc(set.j)}</div></div>
      <button class="xbtn" data-clear="${i}" title="Remove">✕</button></div>
    <div class="bslot-meta">${label}${rankBadge(set.r)}<span class="chip">Lv ${set.lv}</span><span class="chip" title="${st && st.ornCost ? `${set.cost} + ornaments ${st.ornCost}` : ""}">Cost <b>${st ? st.cost : set.cost}</b></span>
      ${off ? `<span class="badge b-boss" title="Over the magatama capacity: gives nothing">NO CAPACITY</span>` : ""}</div>
    <div class="bslot-ctl"><label>Quality <input type="number" min="0" max="100" value="${c.grade ?? 100}" data-cg="${i}"></label>
      <label title="Any other extra cost">+Cost <input type="number" min="0" max="99" value="${c.cost||0}" data-cc="${i}"></label>
      <details class="chg"><summary>Change</summary>${pk.html}</details></div>
    ${optListShort(set.o, !off, 5)}
    ${kind == 9 ? ornamentBlock(i, c, set) : ""}
    ${extraEditor("c" + i, c.extra || [])}
  </div>`};
}

// ---------------------------------------------------------------- equipment sets (like the in-game 1..10 tabs)
const SET_N = 10;
function syncSet(){ BUILD.sets ||= Array(SET_N).fill(null); BUILD.sets[BUILD.set|0] = {weapons:BUILD.weapons, active:BUILD.active, crys:BUILD.crys}; }
function switchSet(n){
  syncSet();
  const s = BUILD.sets[n];
  BUILD.set = n;
  const tmp = normalizeBuild(Object.assign({}, BUILD, s ? JSON.parse(JSON.stringify(s)) : {weapons:[null,null,null,null], active:0, crys:[null,null,null,null,null,null]}));
  BUILD.weapons = tmp.weapons; BUILD.active = tmp.active; BUILD.crys = tmp.crys;
  syncSet();
}
const setFilled = s => s && ((s.weapons || []).some(Boolean) || (s.crys || []).some(Boolean));
let SET_CLIP = null;
