"use strict";
/* OnigiriDex — home page */
// ---------------------------------------------------------------- home
function viewHome(){
  setCrumbs([["Home"]]);
  const nDun = DUN.filter(isPlayable).length, nMon = Object.values(E).filter(e => e.used).length;
  let recent = []; try { recent = JSON.parse(localStorage.getItem("od2-recent") || "[]"); } catch(e){}
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("od2-builds") || "{}"); } catch(e){}
  const tools = [
    ["#/farm","farm","Farm Finder","Pick items → best dungeon, difficulty and runs needed."],
    ["#/build","build","Build Planner","Weapons, magatama, ornaments, accessories and status points."],
    ["#/sim","sim","Boss Simulator <span class='badge b-wip' title='Work in progress: numbers are still being tuned'>WIP</span>","Work in progress — damage per skill and kill time are still being tuned."],
    ["#/dissolve","item","Dissolution","What each magatama gives back when dissolved, with the chance of every amount."],
    ["#/dungeons","dungeon","Dungeons","Every dungeon by region with level, bosses and drops."],
    ["#/items","item","Items","Drops, shops, lucky boxes, recipes and dissolution for every item."],
    ["#/gear","item","Equipment","Weapons, magatama and accessories with how to craft or get each one."],
    ["#/monsters","monster","Monsters","Stats, weaknesses, multi-hit cut and drops of every version."],
    ["#/bestiary","monster","Bestiary","The game's monster guide: art, lore, weaknesses and card rewards."],
  ];
  app.innerHTML = `
  <section class="hero has-logo">
    <img class="hero-logo" src="img/logo.png" alt="鬼斬" width="240" height="240">
    <h1>OnigiriDex <span class="jp" style="font-size:18px">鬼斬 図鑑</span></h1>
    <div class="byline">by <b>Naoyuki</b></div>
    <p>Everything from your server, read by the game's own engine: dungeons, monsters, real drop tables, an exact build calculator and a boss simulator.</p>
    <div class="bigsearch" id="homeSearch">${svg("search")}<span>Search dungeons, monsters, items, skills…</span><kbd style="margin-left:auto">Ctrl K</kbd></div>
    <div class="kpis">
      <div><b>${fmt(nDun)}</b><span>Dungeons</span></div><div><b>${fmt(nMon)}</b><span>Monsters</span></div>
      <div><b>${fmt(ITEMS.length)}</b><span>Items</span></div><div><b>${fmt(SKILLS.length)}</b><span>Player skills</span></div>
      <div><b>${META.levelCap || "—"}</b><span>Level cap</span></div>
    </div>
  </section>
  <h2>Tools</h2>
  <div class="toolcards">${tools.map(([h, ic, t, s]) => `<a class="toolcard" href="${h}"><div class="ti">${svg(ic)}</div><div><b>${t}</b><span>${s}</span></div></a>`).join("")}</div>
  <div class="two" style="margin-top:8px">
    <div><h2>Recently viewed ${recent.length ? `<button class="linkbtn" data-clear-recent>Clear</button>` : ""}</h2>
      <div class="card" style="padding:6px">${recent.length ? `<div class="recent">${recent.map(r => `<a href="${r.h}"><span>${esc(r.n)}</span><span class="tag">${esc(r.t)}</span><button class="rmx" data-rm-recent="${esc(r.h)}" title="Remove from recent" aria-label="Remove ${esc(r.n)} from recent">✕</button></a>`).join("")}</div>` : emptyState("Nothing yet", "Pages you open show up here.")}</div></div>
    <div><h2>Saved builds</h2>
      <div class="card" style="padding:6px">${Object.keys(saved).length ? `<div class="recent">${Object.keys(saved).sort().map(n => `<a href="#/build" data-loadbuild="${esc(n)}"><span>${esc(n)}</span><span class="tag">Lv ${saved[n].lv || "?"}</span></a>`).join("")}</div>` : emptyState("No saved builds", `Make one in the <a href="#/build" style="color:var(--accent)">Build Planner</a>.`)}</div></div>
  </div>
  <p class="faint" style="font-size:12px;margin-top:26px">Data built ${esc(D.built)}. Drop chances are base rates (events/boosts can multiply them). Skill hit data: community "Onigiri Skill Database" spreadsheet.</p>`;
  $("#homeSearch").onclick = () => $("#q").focus();
  $$("[data-loadbuild]").forEach(a => a.onclick = () => { try { BUILD = normalizeBuild(JSON.parse(JSON.stringify(saved[a.dataset.loadbuild]))); store("od2-build", BUILD); } catch(e){} });
}
