"use strict";
/* OnigiriDex — Bestiary (monster cards) */
/* OnigiriDex — Bestiary: the game's monster guide (monster cards) with art, lore, weaknesses and the card collection. */
const BEST = D.bestiary || [];
const BEST_BY = {}; BEST.forEach(b => BEST_BY[b.id] = b);
const BEST_OF_ENEMY = {}; BEST.forEach(b => b.e.forEach(e => (BEST_OF_ENEMY[e] ||= b)));
const LV_TXT = {3:"Very weak", 2:"Weak", 1:"Slightly weak", 0:"Unknown", "-1":"Slightly resistant", "-2":"Resistant", "-3":"Very resistant"};
const LV_CUT = {3:"none", 2:"low", 1:"slight", 0:"unknown", "-1":"slight", "-2":"high", "-3":"very high"};
const bestArt = (b, cls = "") => b.img ? `<img class="bart ${cls}" src="bestiary/${b.img}.webp" alt="${esc(b.n)}" loading="lazy" width="256" height="256">` : `<div class="bart none ${cls}">${esc((b.j || b.n).slice(0, 2))}</div>`;
function bestAttrName(a){ return a === "crit" ? "Critical cut" : a === "mhc" ? "Multi-hit cut" : ATTRS[a][0]; }
function bestChip(a, lv){
  if (a === "crit" || a === "mhc") return `<span class="bchip cut" title="${bestAttrName(a)}: ${LV_CUT[lv]}">${a === "crit" ? "Crit cut" : "MH cut"} ${LV_CUT[lv]}</span>`;
  const cls = lv > 0 ? "weak" : lv < 0 ? "res" : "unk";
  return `<span class="bchip ${cls} l${Math.abs(lv)}" title="${ATTRS[a][0]}: ${LV_TXT[lv]}">${elemTag(a)}<i>${lv > 0 ? "+".repeat(lv) : lv < 0 ? "−".repeat(-lv) : "?"}</i></span>`;
}
// first lines of the guide text without the "Shizuka's Bestiary:" header
function loreSnippet(b){ const d = (b.d || "").split(/\n/).slice(1).join(" ").replace(/^"|"$/g, "").trim() || b.d || ""; return d.length > 220 ? d.slice(0, 220) + "…" : d; }
const bestNature = b => { const e = b.e.map(id => E[id]).find(Boolean); return e ? NATURES[e.na]?.[0] || "" : ""; };
const bestPlaced = b => b.e.some(id => enemyLoc[id]?.size);

// ---------------------------------------------------------------- list
function viewBestiary(){
  setCrumbs([["Bestiary"]]);
  const st = load("od2-bfilter", {q:"", weak:-1, sort:"id", nat:-1});
  app.innerHTML = `${ph({title:"Bestiary", sub:`The game's monster guide: ${BEST.length} monster cards with their art, lore, weaknesses and the card collection reward.`})}
  <div class="toolbar">
    <input type="text" id="bq" placeholder="Search a monster…" value="${esc(st.q)}" aria-label="Search the bestiary">
    <div class="seg" id="bnat"><button data-n="-1" class="${st.nat < 0 ? "on" : ""}">All</button>${NATURES.map((n, i) => `<button data-n="${i}" class="${st.nat == i ? "on" : ""}">${n[0]}</button>`).join("")}</div>
    <select id="bweak" aria-label="Weak to"><option value="-1">Weak to: any</option>${[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => `<option value="${i}" ${st.weak == i ? "selected" : ""}>Weak to ${ATTRS[i][0]}</option>`).join("")}</select>
    <select id="bsort" aria-label="Sort"><option value="id" ${st.sort == "id" ? "selected" : ""}>Guide order</option><option value="n" ${st.sort == "n" ? "selected" : ""}>Name</option><option value="lv" ${st.sort == "lv" ? "selected" : ""}>Level</option></select>
    <span class="sp"></span><span class="mute" id="bcount"></span>
  </div>
  <div class="bgrid" id="bgrid"></div>`;
  const lvOf = b => Math.min(...b.e.flatMap(id => Object.values(E[id]?.v || {}).map(v => v[0])), 999);
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    let list = BEST.filter(b => (!q || (b.n + " " + b.j).toLowerCase().includes(q) || b.e.some(id => (E[id]?.n || "").toLowerCase().includes(q)))
      && (st.weak < 0 || b.a.some(([a, lv]) => a == st.weak && lv > 0))
      && (st.nat < 0 || b.e.some(id => E[id]?.na == st.nat)));
    if (st.sort == "n") list.sort((a, b) => a.n.localeCompare(b.n));
    else if (st.sort == "lv") list.sort((a, b) => lvOf(a) - lvOf(b));
    $("#bcount").textContent = `${list.length} of ${BEST.length}`;
    $("#bgrid").innerHTML = list.map(b => {
      const weak = b.a.filter(([a, lv]) => lv > 0 && typeof a == "number").sort((x, y) => y[1] - x[1]);
      const res = b.a.filter(([a, lv]) => lv < 0 && typeof a == "number").sort((x, y) => x[1] - y[1]);
      return `<a class="bcard" href="#/bestiary/${b.id}">
        <div class="bcard-art">${bestArt(b)}<span class="bno">No.${String(b.id).padStart(3, "0")}</span></div>
        <div class="bcard-b"><b>${esc(b.n)}</b><div class="jp">${esc(b.j)}${bestNature(b) ? ` · ${bestNature(b)}` : ""}</div>
          <div class="bchips">${weak.map(([a, lv]) => bestChip(a, lv)).join("")}${res.length && weak.length ? `<span class="bsep"></span>` : ""}${res.map(([a, lv]) => bestChip(a, lv)).join("")}</div></div></a>`;
    }).join("") || emptyState("No monster matches");
    store("od2-bfilter", st);
  };
  $("#bq").oninput = e => { st.q = e.target.value; draw(); };
  $("#bweak").onchange = e => { st.weak = +e.target.value; draw(); };
  $("#bsort").onchange = e => { st.sort = e.target.value; draw(); };
  $$("#bnat button").forEach(b => b.onclick = () => { st.nat = +b.dataset.n; $$("#bnat button").forEach(x => x.classList.toggle("on", x == b)); draw(); });
  draw();
}

// ---------------------------------------------------------------- one card
function viewBestiaryCard(id){
  const b = BEST_BY[id]; if (!b) return notFound();
  setCrumbs([["Bestiary", "#/bestiary"], [b.n]]);
  remember(`#/bestiary/${id}`, b.n, "Bestiary");
  const src = itemSources(S.party);
  const cardBest = b.card != null ? bestAny(src, b.card) : null;
  const all = [3,4,5,6,7,8,9,10,11,12,0,1,2];
  const lvl = a => { const f = b.a.find(x => x[0] === a); return f ? f[1] : null; };
  const attrRow = a => { const lv = lvl(a);
    return `<div class="batt ${lv == null ? "none" : lv > 0 ? "weak" : lv < 0 ? "res" : "unk"}">${elemTag(a)}<span class="n">${ATTRS[a][0]}</span>
      <span class="meter">${[-3,-2,-1,1,2,3].map(k => `<i class="${lv != null && ((lv > 0 && k > 0 && k <= lv) || (lv < 0 && k < 0 && k >= lv)) ? "on" : ""} ${k > 0 ? "w" : "r"}"></i>`).join("")}</span>
      <b>${lv == null ? "Normal" : LV_TXT[lv]}</b></div>`; };
  const cuts = b.a.filter(([a]) => a === "crit" || a === "mhc");
  const mons = b.e.filter(eid => E[eid]);
  app.innerHTML = `
  <div class="ph"><div class="ph-main"><div><div class="ph-k">Bestiary · No.${String(b.id).padStart(3, "0")}</div><h1>${esc(b.n)}</h1><div class="jp">${esc(b.j)}${bestNature(b) ? ` · ${bestNature(b)}` : ""}</div></div></div>
    <div class="ph-actions">${BEST_BY[id - 1] ? `<a class="btn" href="#/bestiary/${id - 1}">← Prev</a>` : ""}${BEST_BY[id + 1] ? `<a class="btn" href="#/bestiary/${id + 1}">Next →</a>` : ""}</div></div>
  <div class="bdetail">
    <div class="bd-art">${bestArt(b, "big")}</div>
    <div class="bd-main">
      ${b.d ? `<blockquote class="blore">${esc(b.d).replace(/\n/g, "<br>")}</blockquote>` : ""}
      <h2>Weaknesses <span class="count">from the guide</span></h2>
      <div class="battgrid">${all.map(attrRow).join("")}</div>
      ${cuts.length ? `<div class="chips" style="margin-top:10px">${cuts.map(([a, lv]) => `<span class="chip">${bestAttrName(a)} <b>${LV_CUT[lv]}</b></span>`).join("")}</div>` : ""}
    </div>
    <div class="bd-side">
      <section class="pnl">
        <h3 class="sect">Card collection</h3>
        ${b.card != null ? `<div class="bcol">${itemLink(b.card)}</div>
          <div class="kvr"><span>Cards to complete</span><b>${b.c || "—"}</b></div>
          <div class="kvr"><span>Best drop</span><b>${cardBest ? `${pct(cardBest.p)} <span class="mute">${cardBest.did ? esc(DUNBY[cardBest.did].n) : ""}</span>` : `<span class="mute">—</span>`}</b></div>
          <a class="btn sm" href="#/item/${b.card}" style="margin-top:8px">Where to get the card</a>` : `<div class="mute">No card item.</div>`}
        ${b.r.length ? `<h3 class="sect" style="margin-top:16px">Completion reward</h3><ul class="rcp-mats">${b.r.map(([i, n]) => `<li><span class="q">×${fmt(n)}</span>${itemLink(i)}</li>`).join("")}</ul>` : ""}
      </section>
      <section class="pnl">
        <h3 class="sect">Monsters in this card <span class="mute">(${mons.length})</span></h3>
        <div class="bmons">${mons.map(eid => { const e = E[eid], vs = Object.values(e.v), lo = Math.min(...vs.map(v => v[0])), hi = Math.max(...vs.map(v => v[0])), loc = enemyLoc[eid]?.size || 0;
          return `<a href="#/monster/${eid}"><b>${esc(e.n)}</b><span class="mute">Lv ${lo == hi ? lo : lo + "–" + hi}</span><span class="${loc ? "" : "faint"}">${loc ? `${loc} place${loc > 1 ? "s" : ""}` : "not placed"}</span></a>`; }).join("") || `<div class="mute">—</div>`}</div>
      </section>
    </div>
  </div>`;
}
