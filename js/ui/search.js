"use strict";
/* OnigiriDex — global search (Ctrl+K) */
// ---------------------------------------------------------------- global search (grouped, Ctrl+K)
const SEARCH = [];
DUN.forEach(d => { if (d.L.some(Boolean)) SEARCH.push({g:"Dungeons", n:d.n, j:d.j, h:`#/dungeon/${d.id}`, s:(d.n + " " + d.j).toLowerCase(), t:d.gn || "Dungeon"}); });
Object.entries(E).forEach(([id, e]) => { if (e.used) SEARCH.push({g:"Monsters", n:e.n, j:e.j, h:`#/monster/${id}`, s:(e.n + " " + e.j).toLowerCase(), t:NATURES[e.na]?.[0] || "Monster"}); });
ITEMS.forEach((it, i) => it && !isGhostItem(it) && SEARCH.push({g:"Items", n:it[0], j:it[1], h:`#/item/${i}`, s:(it[0] + " " + it[1]).toLowerCase(), t:KIND[it[2]] || "Item", i}));
SKILLS.forEach(sk => SEARCH.push({g:"Skills", n:sk.n, j:sk.j, h:`#/skill/${sk.id}`, s:(sk.n + " " + sk.j).toLowerCase(), t:CATS[sk.c] || "Skill"}));
D.fields.forEach(sid => SEARCH.push({g:"Field maps", n:ST[sid].n, j:ST[sid].j, h:`#/field/${sid}`, s:(ST[sid].n + " " + ST[sid].j).toLowerCase(), t:"Field"}));
[["Home", "#/", "start dashboard"], ["Dungeons", "#/dungeons", "list regions"], ["Endgame dungeons", "#/dungeons/endgame", "purgatorium raids dullahan cursect princess delirium gloomveil 獄"], ["Monsters", "#/monsters", "list enemies"], ["Bestiary", "#/bestiary", "monster guide cards"],
 ["Items", "#/items", "list"], ["Weapons", "#/gear/weapons", "equipment weapon sword bow staff craft"], ["Magatama list", "#/gear/magatama", "equipment magatama craft"], ["Accessories", "#/gear/accessories", "equipment accessory craft"], ["Field maps", "#/fields", "fields"], ["Farm Finder", "#/farm", "farm drops best dungeon"], ["Farm Planner", "#/plan", "plan craft recipe tree materials shopping list"], ["Dissolution", "#/dissolve", "magatama dissolve break up"],
 ["Build Planner", "#/build", "planner build equip status"], ["Boss Simulator", "#/sim", "simulator damage dps kill time"], ["EXP Calculator", "#/exp", "exp level tickets oc energy planner xp"], ["Timing Helper", "#/timing", "rt cbt recovery time combo fill spreadsheet"], ["Rotation DPS", "#/rotation", "rotation combo skill chain timeline cooldown cbt rt weighted"]]
  .forEach(([n, h, kw]) => SEARCH.push({g:"Pages", n, j:"", h, s:(n + " " + kw).toLowerCase(), t:"Page"}));
(D.bestiary || []).forEach(b => SEARCH.push({g:"Bestiary", n:b.n, j:b.j, h:`#/bestiary/${b.id}`, s:(b.n + " " + b.j).toLowerCase(), t:`No.${String(b.id).padStart(3, "0")}`}));
// ignores case, accents and punctuation: "dullahan purg", "L.End" and "end of days l" all work
const searchNorm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-_.,:;'’"()\[\]!·/]+/g, " ").replace(/\s+/g, " ").trim();
SEARCH.forEach(x => { x.nn = searchNorm(x.n); x.jn = searchNorm(x.j); x.kw = searchNorm(x.s); x.words = x.nn.split(" "); });
function searchDist(a, b, max){   // edit distance, stops early
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++){ const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++){ cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1] ? 1 : 0)); low = Math.min(low, cur[j]); }
    if (low > max) return max + 1; prev = cur; }
  return prev[b.length];
}
function searchScore(x, toks, fuzzy){
  let score = 0;
  for (const t of toks){
    let s = 0;
    if (x.words.includes(t)) s = 60;
    else if (x.words.some(w => w.startsWith(t))) s = 45;
    else if (x.nn.includes(t) || x.jn.includes(t)) s = 25;
    else if (x.kw.includes(t)) s = 12;
    else if (fuzzy && t.length >= 4){ const max = t.length >= 7 ? 2 : 1; if (x.words.some(w => searchDist(t, w.slice(0, t.length + 1), max) <= max)) s = 8; }
    if (!s) return 0;
    score += s;
  }
  const whole = toks.join(" ");
  if (x.nn == whole || x.jn == whole) score += 200; else if (x.nn.startsWith(whole)) score += 80;
  if (x.g == "Pages") score += 15;
  return score;
}
function searchMark(name, toks){   // highlights what was typed
  const safe = toks.filter(t => t.length > 1).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!safe.length) return esc(name);
  const re = new RegExp("(" + safe.join("|") + ")", "ig");
  return String(name).split(re).map((p, i) => i % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join("");
}
let suggSel = -1, suggItems = [];
function runSearch(q){
  const box = $("#sugg");
  if (q.length < 2 && !/[^\x00-\x7f]/.test(q)){ box.classList.remove("show"); return; }   // one kanji is enough
  const toks = searchNorm(q).split(" ").filter(Boolean);
  if (!toks.length){ box.classList.remove("show"); return; }
  let scored = [], fuzzy = false;
  for (const x of SEARCH){ const sc = searchScore(x, toks, false); if (sc > 0) scored.push([sc, x]); }
  if (!scored.length){ fuzzy = true; for (const x of SEARCH){ const sc = searchScore(x, toks, true); if (sc > 0) scored.push([sc, x]); } }
  scored.sort((a, b) => b[0] - a[0] || a[1].n.length - b[1].n.length);
  // groups ordered by their best match, so the most likely result is always on top
  const groups = new Map();
  for (const [sc, x] of scored){ if (!groups.has(x.g)) groups.set(x.g, {best: sc, list: []}); groups.get(x.g).list.push(x); }
  suggItems = [];
  let html = fuzzy ? `<div class="sg-fuzzy">No exact match. Did you mean:</div>` : "";
  for (const [g, o] of groups){
    const max = g == "Items" ? 6 : 4, gs = o.list.slice(0, max);
    html += `<div class="sg-h">${g}${o.list.length > max ? ` <span>${fmt(o.list.length)}</span>` : ""}</div>` + gs.map(x => { suggItems.push(x); return `<a href="${x.h}" data-k="${suggItems.length - 1}">${x.i != null ? icon(ITEMS[x.i]) : ""}<span><b>${searchMark(x.n, toks)}</b> <span class="jp">${esc(x.j)}</span></span><span class="tag">${esc(x.t)}</span></a>`; }).join("");
  }
  suggSel = suggItems.length ? 0 : -1;
  box.innerHTML = html || `<div class="empty" style="padding:16px">Nothing found</div>`;
  box.querySelector("a")?.classList.add("sel");
  box.classList.add("show");
}
$("#q").addEventListener("input", e => runSearch(e.target.value.trim().toLowerCase()));
$("#q").addEventListener("keydown", e => {
  const box = $("#sugg"); if (!box.classList.contains("show")) return;
  if (e.key == "ArrowDown" || e.key == "ArrowUp"){ e.preventDefault(); suggSel = Math.max(0, Math.min(suggItems.length - 1, suggSel + (e.key == "ArrowDown" ? 1 : -1))); box.querySelectorAll("a").forEach((a, k) => a.classList.toggle("sel", k == suggSel)); box.querySelector("a.sel")?.scrollIntoView({block:"nearest"}); }
  if (e.key == "Enter" && suggItems.length){ location.hash = suggItems[Math.max(0, suggSel)].h; box.classList.remove("show"); e.target.value = ""; e.target.blur(); }
  if (e.key == "Escape"){ box.classList.remove("show"); e.target.blur(); }
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "k"){ e.preventDefault(); $("#q").focus(); $("#q").select(); }
  else if (e.key == "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")){ e.preventDefault(); $("#q").focus(); }
});
document.addEventListener("click", e => {
  $$(".sugg.show").forEach(box => { if (!box.parentElement.contains(e.target) || e.target.closest(".sugg a")) box.classList.remove("show"); });
  if (e.target.closest(".sugg a")) { const q = $("#q"); if (q) q.value = ""; }
  // shared controls (event delegation)
  const sd = e.target.closest("[data-setdiff]"); if (sd){ S.diff = +sd.dataset.setdiff; saveS(); route(); return; }
  const sp = e.target.closest("[data-setparty]"); if (sp){ S.party = +sp.dataset.setparty; saveS(); route(); return; }
  const sim = e.target.closest("[data-sim]");
  if (sim){ const [eid, vname, did, diff] = sim.dataset.sim.split("|"); SIM.tgt = {t:"enemy", eid:+eid, vname}; if (did) { SIM.tgt.did = +did; SIM.tgt.diff = +diff; SIM.pickDun = {did:+did, diff:+diff}; } saveSim(); location.hash = "#/sim"; return; }
  const rl = e.target.closest("tr.rowlink"); if (rl && !e.target.closest("a,button")){ location.hash = rl.dataset.href; return; }
  if (e.target.closest("#navToggle")) document.body.classList.toggle("navopen");
  else if (!e.target.closest(".sidebar")) document.body.classList.remove("navopen");
});
