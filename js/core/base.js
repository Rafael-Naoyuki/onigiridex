"use strict";
/* OnigiriDex — constants, helpers and saved state */
/* OnigiriDex — app logic. Data comes from data.js (exported with the game engine). */
const D = window.ONIGIRI_DATA, ICONS = window.ONIGIRI_ICONS || {};
const META = D.meta || {};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US");
const fmtM = n => n == null || !isFinite(n) ? "—" : n >= 1e6 ? (n/1e6).toFixed(n >= 1e8 ? 0 : 2) + "M" : n >= 1e4 ? (n/1e3).toFixed(1) + "k" : fmt(n);
const fmtS = s => s == null || !isFinite(s) ? "—" : s < 60 ? s.toFixed(1) + "s" : Math.floor(s/60) + "m " + Math.round(s%60) + "s";
const DIFFS = ["Normal","Hard","Hell","Oni"];
const DIFF_JP = ["仁","皇","神","鬼"];
const NATURES = [["Spirit","霊"],["Monster","化"],["Phantom","妖"],["Beast","獣"]];
const SIZES = ["Huge","Large","Medium","Small","Tiny"];
// attribute order in data: slash strike thrust fire ice elec dark water earth wind holy poison fly
const ATTRS = [["Slash","斬"],["Strike","衝"],["Pierce","突"],["Fire","炎"],["Ice","氷"],["Thunder","雷"],["Dark","闇"],["Water","雨"],["Earth","山"],["Wind","風"],["Holy","天"],["Poison","毒"],["Flying","飛"]];
const ATTR_COLORS = ["#b9c0cf","#c9a27a","#9fb0c9","#ff7a59","#7fd3ff","#ffd84d","#a77bff","#4fa3ff","#c98b4f","#6fdc8c","#fff2a8","#b77bd1","#8fe3d6"];
const KIND = {1:"Material",2:"Quest item",3:"Outfit",4:"Body",5:"Arms",6:"Legs",7:"Head",8:"Weapon",9:"Magatama",10:"Potion",11:"Recipe",12:"Sake",13:"Unidentified weapon",14:"Gemstone",15:"Key",16:"Sake order",17:"Bottle order",18:"Enhance material",19:"Item set",20:"Misc",21:"Monster card",22:"Skill card",23:"Revive item",24:"Partner item",25:"Premium ticket",26:"Accessory",27:"Bazaar",28:"Transform",29:"Lucky box",30:"Partner card",31:"Hair ticket",32:"Yokai card",33:"Voice ticket",34:"Mount card",35:"Support card",36:"Face ticket",37:"Furniture"};
const CATS = META.cats || {0:"Sword",1:"Odachi",2:"Twin Sword",3:"Spear",4:"Axe",5:"Bow",6:"Staff",7:"Wand"};
// damage cap per hit on the live (Steam) server; the local test server files use 15,000,000 (META.maxDamage)
const MAX_DMG = 9999999;
// ougi that grant a damage-limit buff (EXTRA_DMG_LIMIT self buff, s.dl = [amount, ms])
let CAP_SK = null;
const capSkills = () => CAP_SK || (CAP_SK = SKILLS.filter(s => s.dl).sort((x, y) => y.dl[0] - x.dl[0] || x.c - y.c));
const capBuffOf = id => (id && SKBY[id] && SKBY[id].dl) ? SKBY[id].dl[0] : 0;
// <select> of cap-buff ougi; `mine` = ids to list first (equipped / in loadout)
// list of chosen cap ougi (old saves stored one id in capBuff)
const capList = b => [...new Set((Array.isArray(b.capBuffs) ? b.capBuffs : b.capBuff ? [b.capBuff] : []).filter(id => SKBY[id] && SKBY[id].dl))];
const capBuffSum = ids => ids.reduce((a, id) => a + capBuffOf(id), 0);
// chips to switch cap ougi on/off; `mine` = ougi on your weapons (listed first, ★)
function capBuffPicker(attr, chosen, mine = []){
  const own = capSkills().filter(s => mine.includes(s.id)), rest = capSkills().filter(s => !mine.includes(s.id));
  const chip = s => `<button class="capchip ${chosen.includes(s.id) ? "on" : ""} ${mine.includes(s.id) ? "mine" : ""}" ${attr}="${s.id}" aria-pressed="${chosen.includes(s.id)}" title="${esc(s.n)} (${esc(CATS[s.c] || "")}) · +${fmt(s.dl[0])} for ${s.dl[1] / 1000}s">
      ${mine.includes(s.id) ? "★ " : ""}${esc(s.n.replace(/^Ougi /, ""))}<b>+${fmtM(s.dl[0])}</b></button>`;
  return `<div class="capchips">${own.map(chip).join("")}${own.length ? `<span class="capsep"></span>` : ""}${rest.map(chip).join("")}</div>`;
}

// ---------------------------------------------------------------- persistent state
function load(k, def){ try{ const v = JSON.parse(localStorage.getItem(k) || "null"); return v ? Object.assign({}, def, v) : Object.assign({}, def); }catch(e){ return Object.assign({}, def); } }
function store(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
const S = load("od2-state", {diff:0, party:1, theme:null});
const SIM = load("od2-sim", {
  cat:0, atk:150000, sf:500, el:[250,250,250,250,250,250,250,250,250,250,250,0,0], cri:100, crd:300, cdc:0,
  lvMax:true, bdaP:0, bdaL:0, tgt:{t:"dummy"}, dummy:{res:50, def:0, crc:90, mhc:0, hp:100000000, cav:0},
  loadout:[], sort:"sdps", q:"", ougi:-1, elem:-1, measuredOnly:true, defaultTime:1.5
});
const saveS = () => store("od2-state", S), saveSim = () => store("od2-sim", SIM);
