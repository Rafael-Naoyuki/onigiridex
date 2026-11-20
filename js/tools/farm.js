"use strict";
/* OnigiriDex — Farm Finder */
// ---------------------------------------------------------------- farm finder
function viewFarm(){
  setCrumbs([["Tools"], ["Farm Finder"]]);
  const party = S.party;
  const chosen = FARM.items.filter(i => ITEMS[i]);
  app.innerHTML = `${ph({title:"Farm Finder", sub:"Add the items you want: every dungeon and difficulty is ranked by the chance to get them in one full clear, with the server's real spawn counts.", actions: partySeg()})}
  <div class="card" style="margin-bottom:14px">
    <div class="picker" style="max-width:620px;position:relative"><input type="text" id="fq" placeholder="Add an item… (type 2+ letters)" style="width:100%" autocomplete="off"><div class="sugg" id="fsugg"></div></div>
    <div class="chips" id="fchips" style="margin-top:10px">${chosen.map(i => `<span class="chip x" data-rm="${i}" title="Remove">${icon(ITEMS[i])} <b>${esc(ITEMS[i][0])}</b> ✕</span>`).join("") || `<span class="mute" style="font-size:12.5px">No items yet — add some above, or press "Farm" on any item.</span>`}</div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--mute)">
      <label style="display:flex;gap:6px;align-items:center">My level <input type="number" id="fmax" min="1" max="200" value="${esc(FARM.maxLv)}" placeholder="any" style="width:80px"></label>
      ${DIFFS.map((n, i) => `<label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-fd="${i}" ${FARM.diffs.includes(i) ? "checked" : ""}> ${n}</label>`).join("")}
      <label style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="fara" ${FARM.hideAra ? "checked" : ""}> hide Aramitama</label>
      ${chosen.length ? `<button class="btn sm" id="fclear">Clear items</button>` : ""}
    </div>
  </div>
  <div id="fres"></div>`;
  const fq = $("#fq"), box = $("#fsugg");
  const srcAll = itemSources(party);
  fq.oninput = () => {
    const q = fq.value.trim().toLowerCase();
    if (q.length < 2){ box.classList.remove("show"); return; }
    const res = ITEMS.map((it, i) => i).filter(i => srcAll[i] && (ITEMS[i][0] + " " + ITEMS[i][1]).toLowerCase().includes(q)).slice(0, 15);
    box.innerHTML = res.map(i => `<a data-add="${i}">${icon(ITEMS[i])}<span><b>${esc(ITEMS[i][0])}</b> <span class="jp">${esc(ITEMS[i][1])}</span></span><span class="tag">${esc(KIND[ITEMS[i][2]] || "")}</span></a>`).join("") || `<div class="empty" style="padding:12px">No droppable item found</div>`;
    box.classList.add("show");
    box.querySelectorAll("[data-add]").forEach(a => a.onclick = () => { FARM.items = [...new Set([...FARM.items, +a.dataset.add])]; store("od2-farm", FARM); viewFarm(); });
  };
  $$("[data-rm]").forEach(c => c.onclick = () => { FARM.items = FARM.items.filter(x => x != c.dataset.rm); store("od2-farm", FARM); viewFarm(); });
  $$("[data-fd]").forEach(c => c.onchange = () => { FARM.diffs = $$("[data-fd]").filter(x => x.checked).map(x => +x.dataset.fd); store("od2-farm", FARM); drawRes(); });
  $("#fmax").oninput = e => { FARM.maxLv = e.target.value; store("od2-farm", FARM); clearTimeout(viewFarm.t); viewFarm.t = setTimeout(drawRes, 250); };
  $("#fara").onchange = e => { FARM.hideAra = e.target.checked; store("od2-farm", FARM); drawRes(); };
  if ($("#fclear")) $("#fclear").onclick = () => { FARM.items = []; store("od2-farm", FARM); viewFarm(); };
  function drawRes(){
    const out = $("#fres");
    if (!chosen.length){
      let rec = []; try { rec = JSON.parse(localStorage.getItem("od2-recent") || "[]").filter(x => /^#\/item\/\d+/.test(x.h)).map(x => +x.h.split("/")[2]).filter(i => ITEMS[i]); } catch(e){}
      // raw materials of the Farm Planner that drop somewhere: one click to rank dungeons for all of them
      let planMats = [];
      try { if (typeof planCompute == "function" && PLAN.targets.length){ const src = itemSources(party); planMats = [...planCompute().raw.keys()].filter(i => (src[i] || []).length); } } catch(e){}
      const hasPick = rec.length || planMats.length;
      out.innerHTML = emptyState("Pick at least one item", hasPick ? "Type a name above, press “Farm” on any item page, or start from here:" : "Type a name above, or press “Farm” on any item page. Tip: the Farm Planner can send every material of a recipe here in one click.")
        + (planMats.length ? `<div class="quickpick"><span class="mute">From your Farm Planner</span><button class="btn pri sm" id="qplan">Rank dungeons for ${planMats.length} material${planMats.length > 1 ? "s" : ""}</button></div>` : "")
        + (rec.length ? `<div class="quickpick"><span class="mute">Recently viewed</span>${rec.slice(0, 8).map(i => `<button class="chip x" data-qadd="${i}">${icon(ITEMS[i])} ${esc(ITEMS[i][0])}</button>`).join("")}</div>` : "")
        + (!hasPick ? `<div class="quickpick"><a class="btn sm" href="#/plan">Open the Farm Planner</a><a class="btn sm" href="#/items">Browse items</a></div>` : "");
      $$("[data-qadd]").forEach(b => b.onclick = () => { FARM.items = [...new Set([...FARM.items, +b.dataset.qadd])]; store("od2-farm", FARM); viewFarm(); });
      if ($("#qplan")) $("#qplan").onclick = () => { FARM.items = planMats; store("od2-farm", FARM); viewFarm(); };
      return;
    }
    const maxLv = +FARM.maxLv || 0;
    let rows = farmRows(chosen, party).filter(r => FARM.diffs.includes(r.diff) && (!maxLv || !(r.L.lv > 0) || r.L.lv <= maxLv) && !(FARM.hideAra && r.d.ara));
    const key = FARM.sort;
    const sorters = {score:(a, b) => (b.score - a.score) || (b.expSum - a.expSum), avg:(a, b) => b.expSum - a.expSum, lv:(a, b) => (a.L.lv || 999) - (b.L.lv || 999)};
    if (key.startsWith("i")){ const k = +key.slice(1); rows.sort((a, b) => ((1 - b.per[k].none) - (1 - a.per[k].none)) || (b.per[k].exp - a.per[k].exp)); } else rows.sort(sorters[key] || sorters.score);
    const top = rows.slice(0, 150), multi = chosen.length > 1;
    out.innerHTML = `<h2 style="margin-top:0">Best places <span class="count">${rows.length} dungeon/difficulty combos · party of ${party}</span></h2>
    ${rows.length ? `<div class="wrap"><table class="tbl" id="ftbl"><thead><tr>
      <th>Dungeon</th><th>Difficulty</th><th class="r s" data-k="lv">Rec. Lv</th><th class="r">Stamina</th><th class="r"><span class="tip" title="Monsters killed in a full clear">Kills</span></th>
      ${chosen.map((ci, k) => `<th class="r s" data-k="i${k}" title="${esc(ITEMS[ci][0])}"><span style="display:inline-flex;align-items:center;gap:5px">${icon(ITEMS[ci])}${multi ? "" : " ≥1 / run"}</span></th>`).join("")}
      ${multi ? `<th class="r s" data-k="score"><span class="tip" title="Sum of the ≥1-per-run chances of all items">Combined</span></th>` : `<th class="r s" data-k="avg">Avg / run</th><th class="r">Runs (90%)</th><th>Best source</th>`}
    </tr></thead><tbody>
    ${top.map(r => `<tr><td class="name"><a href="#/dungeon/${r.d.id}" data-godiff="${r.diff}"><b>${esc(r.d.n)}</b></a> ${r.d.ara ? `<span class="badge b-ara">ARA</span>` : ""}<div class="jp">${esc(r.d.gn || "")}</div></td>
      <td><span class="chip d${r.diff}"><b>${DIFFS[r.diff]}</b></span></td><td class="r num">${r.L.lv > 0 ? r.L.lv : "—"}</td><td class="r num">${r.L.st || "—"}</td><td class="r num mute">${Math.round(r.kills)}</td>
      ${r.per.map(x => `<td class="r">${x.exp ? pct(1 - x.none) : `<span class="mute">—</span>`}</td>`).join("")}
      ${multi ? `<td class="r"><b>${r.score.toFixed(2)}</b></td>` : (() => { const p = 1 - r.per[0].none; const runs = p >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - p)); const b = r.per[0].best, ex = r.per[0].exp;
        return `<td class="r num"><b>${ex >= 10 ? fmt(ex) : ex.toFixed(ex < 0.01 ? 4 : 2)}</b></td><td class="r num">${isFinite(runs) ? fmt(runs) : "—"}</td><td>${b?.rank ? "Clear reward" : b ? enemyLink(b.eid) + ` <span class="mute">${pct(b.p)}/kill</span>${b.boss ? ` <span class="badge b-boss">BOSS</span>` : ""}${b.metal ? ` <span class="badge b-metal">RARE</span>` : ""}` : ""}</td>`; })()}
    </tr>`).join("")}
    </tbody></table></div>${rows.length > 150 ? `<div class="mute" style="margin-top:6px">Showing the best 150.</div>` : ""}` : emptyState("Nothing found", "No dungeon gives these items with the current filters.")}
    ${fieldFarm(chosen)}
    <div class="note">"≥1 / run" = chance of at least one in a full clear where every spawned monster is killed. Weapons from "???" boxes aren't counted here — see the item page.</div>`;
    $$("#ftbl th.s").forEach(th => { th.classList.toggle("sorted", th.dataset.k == FARM.sort); th.onclick = () => { FARM.sort = th.dataset.k; store("od2-farm", FARM); drawRes(); }; });
    $$("[data-godiff]").forEach(a => a.addEventListener("click", () => { S.diff = +a.dataset.godiff; saveS(); }));
  }
  drawRes();
}
