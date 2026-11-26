"use strict";
/* OnigiriDex — home page */
// ---------------------------------------------------------------- home
function viewHome(){
  setCrumbs([["Home"]]);
  const nDun = DUN.filter(isPlayable).length, nMon = Object.values(E).filter(e => e.used).length;
  let recent = []; try { recent = JSON.parse(localStorage.getItem("od2-recent") || "[]"); } catch(e){}
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("od2-builds") || "{}"); } catch(e){}
  const plan = typeof PLAN != "undefined" ? PLAN.targets.filter(t => ITEMS[t.i]) : [];
  // same order and icons as the sidebar
  const explore = [
    ["#/dungeons", "dungeon", "Dungeons", "Every dungeon by region, with the endgame raids in their own tab."],
    ["#/monsters", "monster", "Monsters", "HP phases, element weaknesses and drops of every version."],
    ["#/bestiary", "book", "Bestiary", "The game's monster guide: art, lore and card rewards."],
    ["#/items", "item", "Items", "Every item and how to get it: drops, crafting, shops, boxes."],
    ["#/gear", "gear", "Equipment", "Weapons, magatama and accessories with stats and sources."],
    ["#/partners", "partners", "Partners", "Partners, mounts, supports and yokai, and how to unlock them."],
    ["#/fields", "map", "Field maps", "Open areas with respawning monsters and their drops."],
  ];
  const tools = [
    ["#/farm", "farm", "Farm Finder", "Pick items: the best dungeon, difficulty and runs needed."],
    ["#/plan", "plan", "Farm Planner", "Pick what to make: the whole crafting tree and what to farm."],
    ["#/dissolve", "drop", "Dissolution", "What each magatama gives back, with the chance of every amount."],
    ["#/build", "build", "Build Planner", "Exact stats for weapons, magatama, ornaments and status points."],
    ["#/sim", "sim", "Boss Simulator <span class='badge b-wip' title='Work in progress: numbers are still being tuned'>WIP</span>", "Damage per skill and kill time against any boss."],
    ["#/exp", "plan", "EXP Calculator", "Tickets, runs and OC needed to reach any level."],
    ["#/rotation", "plan", "Rotation DPS", "Order 5 skills and see the RT, CBT and cooldown timeline."],
  ];
  const cards = (list, cls) => `<div class="toolcards ${cls}">${list.map(([h, ic, t, s]) => `<a class="toolcard" href="${h}"><div class="ti">${svg(ic)}</div><div><b>${t}</b><span>${s}</span></div></a>`).join("")}</div>`;
  // "continue" strip: only what the user actually has (recent pages, saved builds, a farm plan)
  const cont = [];
  if (plan.length) cont.push(`<a class="cont" href="#/plan"><span class="cont-k">Farm Planner</span><b>${plan.slice(0, 2).map(t => esc(ITEMS[t.i][0])).join(", ")}${plan.length > 2 ? ` +${plan.length - 2}` : ""}</b></a>`);
  Object.keys(saved).sort().slice(0, 3).forEach(n => cont.push(`<a class="cont" href="#/build" data-loadbuild="${esc(n)}"><span class="cont-k">Saved build · Lv ${saved[n].lv || "?"}</span><b>${esc(n)}</b></a>`));
  app.innerHTML = `
  <section class="hero has-logo">
    <img class="hero-logo" src="img/logo.png" alt="鬼斬" width="240" height="240">
    <h1>OnigiriDex <span class="jp" style="font-size:18px">鬼斬 図鑑</span></h1>
    <div class="byline">by <b>Naoyuki</b></div>
    <p>Dungeons, monsters, drop tables and crafting for Onigiri, read straight from the game files — plus an exact build calculator, a farm planner and a boss simulator.</p>
    <div class="bigsearch" id="homeSearch" role="button" tabindex="0" aria-label="Search">${svg("search")}<span>Search dungeons, monsters, items, skills…</span><kbd style="margin-left:auto">Ctrl K</kbd></div>
    <div class="kpis">
      <div><b>${fmt(nDun)}</b><span>Dungeons</span></div><div><b>${fmt(nMon)}</b><span>Monsters</span></div>
      <div><b>${fmt(ITEMS.length)}</b><span>Items</span></div><div><b>${fmt(SKILLS.length)}</b><span>Player skills</span></div>
      <div><b>${META.levelCap || "—"}</b><span>Level cap</span></div>
    </div>
  </section>
  ${cont.length ? `<h2 class="home-h">Continue</h2><div class="conts">${cont.join("")}</div>` : ""}
  <h2 class="home-h">Tools</h2>${cards(tools, "tc-3")}
  <h2 class="home-h">Explore</h2>${cards(explore, "tc-3")}
  ${recent.length ? `<h2 class="home-h">Recently viewed <button class="linkbtn" data-clear-recent>Clear</button></h2>
    <div class="card" style="padding:6px"><div class="recent home-recent">${recent.map(r => `<a href="${r.h}"><span>${esc(r.n)}</span><span class="tag">${esc(r.t)}</span><button class="rmx" data-rm-recent="${esc(r.h)}" title="Remove from recent" aria-label="Remove ${esc(r.n)} from recent">✕</button></a>`).join("")}</div></div>` : ""}
  <p class="faint" style="font-size:12px;margin-top:26px">Data built ${esc(D.built)}. Drop chances are base rates (events and boosts can multiply them). Skill data: "Onigiri Skill Database" by <b class="credit">ikzki</b>.</p>`;
  const hs = $("#homeSearch"); hs.onclick = () => $("#q").focus(); hs.onkeydown = e => { if (e.key == "Enter" || e.key == " "){ e.preventDefault(); $("#q").focus(); } };
  $$("[data-loadbuild]").forEach(a => a.onclick = () => { try { BUILD = normalizeBuild(JSON.parse(JSON.stringify(saved[a.dataset.loadbuild]))); store("od2-build", BUILD); } catch(e){} });
}
