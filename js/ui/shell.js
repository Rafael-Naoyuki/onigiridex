"use strict";
/* OnigiriDex — theme switch and router */
// ---------------------------------------------------------------- theme
function applyTheme(){ if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; }
$("#theme").onclick = () => { S.theme = (S.theme || "dark") == "dark" ? "light" : "dark"; saveS(); applyTheme(); };
applyTheme();
$("#builtAt").innerHTML = `Data ${esc(D.built || "")}<br>made by <b>Naoyuki</b>`;

// ---------------------------------------------------------------- router
const SECTION = {bestiary:"bestiary", dungeon:"dungeons", monster:"monsters", item:"items", field:"fields", skill:"sim"};
function route(){
  const h = location.hash.slice(1) || "/";
  const [path, query] = h.split("?");
  const qs = new URLSearchParams(query || "");
  const parts = path.split("/").filter(Boolean);
  const k = parts[0] || "";
  $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.k == k || a.dataset.k == SECTION[k] || (k == "" && a.dataset.k == "home")));
  const keepScroll = route.last == path; route.last = path;
  document.body.classList.toggle("full", k == "build" || k == "sim");
  document.body.classList.remove("navopen");
  const tb = document.querySelector(".topbar"); if (tb) document.documentElement.style.setProperty("--hdr", tb.offsetHeight + "px");
  try {
    if (k == "") viewHome();
    else if (k == "dungeons") viewDungeons(parts[1]);
    else if (k == "dungeon") viewDungeon(+parts[1], qs);
    else if (k == "monsters") viewMonsters();
    else if (k == "bestiary") parts[1] ? viewBestiaryCard(+parts[1]) : viewBestiary();
    else if (k == "monster") viewMonster(+parts[1], qs);
    else if (k == "items") viewItems();
    else if (k == "item") viewItem(+parts[1], qs);
    else if (k == "gear") viewGear(parts[1]);
    else if (k == "farm") viewFarm();
    else if (k == "plan") viewPlan();
    else if (k == "dissolve") viewDissolve();
    else if (k == "sim"){ setCrumbs([["Tools"], ["Boss Simulator"]]); viewSim(); }
    else if (k == "build"){ setCrumbs([["Tools"], ["Build Planner"]]); viewBuild(); }
    else if (k == "skill") viewSkill(+parts[1]);
    else if (k == "fields") viewFields();
    else if (k == "field") viewField(+parts[1], qs);
    else notFound();
  } catch (err) {
    console.error(err);
    app.innerHTML = emptyState("Something went wrong on this page", esc(err.message));
  }
  if (!keepScroll) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
let lastWide = null;
window.addEventListener("resize", () => { clearTimeout(route.rt); route.rt = setTimeout(() => {
  const w = isWide(); if (lastWide !== null && w !== lastWide && /^#\/(monster|dungeon|field)\//.test(location.hash)){ const y = scrollY; route(); scrollTo(0, y); } lastWide = w; }, 150); });
window.addEventListener("DOMContentLoaded", route);
