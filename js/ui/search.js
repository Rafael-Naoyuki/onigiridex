"use strict";
/* OnigiriDex — global search (Ctrl+K) */
// ---------------------------------------------------------------- global search (grouped, Ctrl+K)
const SEARCH = [];
DUN.forEach(d => { if (d.L.some(Boolean)) SEARCH.push({g:"Dungeons", n:d.n, j:d.j, h:`#/dungeon/${d.id}`, s:(d.n + " " + d.j).toLowerCase(), t:d.gn || "Dungeon"}); });
Object.entries(E).forEach(([id, e]) => { if (e.used) SEARCH.push({g:"Monsters", n:e.n, j:e.j, h:`#/monster/${id}`, s:(e.n + " " + e.j).toLowerCase(), t:NATURES[e.na]?.[0] || "Monster"}); });
ITEMS.forEach((it, i) => SEARCH.push({g:"Items", n:it[0], j:it[1], h:`#/item/${i}`, s:(it[0] + " " + it[1]).toLowerCase(), t:KIND[it[2]] || "Item", i}));
SKILLS.forEach(sk => SEARCH.push({g:"Skills", n:sk.n, j:sk.j, h:`#/skill/${sk.id}`, s:(sk.n + " " + sk.j).toLowerCase(), t:CATS[sk.c] || "Skill"}));
D.fields.forEach(sid => SEARCH.push({g:"Field maps", n:ST[sid].n, j:ST[sid].j, h:`#/field/${sid}`, s:(ST[sid].n + " " + ST[sid].j).toLowerCase(), t:"Field"}));
[["Home", "#/", "start dashboard"], ["Dungeons", "#/dungeons", "list regions"], ["Monsters", "#/monsters", "list enemies"], ["Bestiary", "#/bestiary", "monster guide cards"],
 ["Items", "#/items", "list"], ["Field maps", "#/fields", "fields"], ["Farm Finder", "#/farm", "farm drops best dungeon"], ["Dissolution", "#/dissolve", "magatama dissolve break up"],
 ["Build Planner", "#/build", "planner build equip status"], ["Boss Simulator", "#/sim", "simulator damage dps kill time"]]
  .forEach(([n, h, kw]) => SEARCH.push({g:"Pages", n, j:"", h, s:(n + " " + kw).toLowerCase(), t:"Page"}));
(D.bestiary || []).forEach(b => SEARCH.push({g:"Bestiary", n:b.n, j:b.j, h:`#/bestiary/${b.id}`, s:(b.n + " " + b.j).toLowerCase(), t:`No.${String(b.id).padStart(3, "0")}`}));
let suggSel = -1, suggItems = [];
function runSearch(q){
  const box = $("#sugg");
  if (q.length < 2){ box.classList.remove("show"); return; }
  const order = ["Pages", "Dungeons", "Monsters", "Bestiary", "Items", "Skills", "Field maps"];
  const hits = SEARCH.filter(x => x.s.includes(q)).sort((a, b) => (a.s.startsWith(q) ? 0 : 1) - (b.s.startsWith(q) ? 0 : 1) || a.n.length - b.n.length);
  suggItems = [];
  let html = "";
  for (const g of order){
    const gs = hits.filter(x => x.g == g).slice(0, g == "Items" ? 6 : 4); if (!gs.length) continue;
    html += `<div class="sg-h">${g}</div>` + gs.map(x => { suggItems.push(x); return `<a href="${x.h}" data-k="${suggItems.length - 1}">${x.i != null ? icon(ITEMS[x.i]) : ""}<span><b>${esc(x.n)}</b> <span class="jp">${esc(x.j)}</span></span><span class="tag">${esc(x.t)}</span></a>`; }).join("");
  }
  suggSel = -1;
  box.innerHTML = html || `<div class="empty" style="padding:16px">Nothing found</div>`;
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
