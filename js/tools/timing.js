"use strict";
/* OnigiriDex — Timing Helper: fill the sheet's missing RT / CBT faster.
   Shows what each skill script says, the user confirms or corrects it, and copies blocks ready to paste in the sheet.
   Confirmed values stay in this browser and are used by Rotation DPS. The sheet itself is never changed here. */
const TIM_ROWS = window.ONIGIRI_TIMING || [];
const TIM = load("od2-timing", {done: {}, sheet: "Bow", show: "todo", q: ""});
const saveTim = () => store("od2-timing", TIM);
const TIM_BY_ID = {}; TIM_ROWS.forEach(o => o.ids.forEach(id => TIM_BY_ID[id] = o));
function timingOverride(sk){ const o = TIM_BY_ID[sk.id]; return o ? TIM.done[o.k] || null : null; }
const sec3 = ms => +(ms / 1000).toFixed(3);

// candidates from the script. Combo: each step until its cancel point, the last one included in RT
function timSuggest(o){
  if (!o.st) return {rt: null, cbt: null, rts: [o.t], cbts: [], combo: false};
  const combo = o.st.length > 1, last = o.st[o.st.length - 1], before = o.st.slice(0, -1);
  const lastHit = s => s[2].length ? s[2][s[2].length - 1] : 0;
  const cbtCancel = before.reduce((a, s) => a + s[0], 0), cbtHit = before.reduce((a, s) => a + Math.max(s[0], lastHit(s)), 0);
  const clamp = v => Math.min(sec3(v), o.t);
  const a = clamp(cbtCancel + last[0]), b = clamp(cbtHit + Math.max(last[0], lastHit(last)));
  return {rt: b, cbt: combo ? sec3(cbtHit) : null, rts: [...new Set([a, b, o.t])], cbts: combo ? [...new Set([sec3(cbtCancel), sec3(cbtHit)])] : [], combo};
}
function timBar(o){
  if (!o.st) return `<span class="faint">script not readable: measure in game</span>`;
  let at = 0, html = "";
  const total = Math.max(o.t * 1000, o.st.reduce((a, s, i) => a + (i < o.st.length - 1 ? s[0] : s[1]), 0)) || 1, pc = v => (v / total * 100).toFixed(2) + "%";
  o.st.forEach((s, i) => {
    const w = i < o.st.length - 1 ? s[0] : s[1];
    html += `<i class="ts s${i % 2}" style="left:${pc(at)};width:${pc(w)}"></i>` + s[2].map(h => `<i class="th" style="left:${pc(at + h)}" title="Hit at ${sec3(at + h)}s"></i>`).join("")
      + `<i class="tc" style="left:${pc(at + s[0])}" title="Cancel opens at ${sec3(at + s[0])}s"></i>`;
    at += s[0];
  });
  return `<div class="tbar">${html}<i class="tt" style="left:${pc(o.t * 1000)}" title="T = ${o.t}s"></i></div>`;
}
function timBlocks(rows){
  // contiguous confirmed rows, so a block can be pasted at one cell without touching anything else
  const out = [];
  rows.filter(o => TIM.done[o.k]).sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row).forEach(o => {
    const p = out[out.length - 1];
    // some blocks have an untitled CBT column (V) right before RT (W)
    const cc = o.cc || (o.rc == "W" ? "V" : null);
    if (p && p.sheet == o.sheet && p.last + 1 == o.row && p.cc == cc && p.rc == o.rc){ p.rows.push(o); p.last = o.row; }
    else out.push({sheet: o.sheet, first: o.row, last: o.row, cc, rc: o.rc, rows: [o]});
  });
  return out;
}
const timBlockText = b => b.rows.map(o => { const d = TIM.done[o.k]; return b.cc ? `${d.cbt || "/"}\t${d.rt}` : `${d.rt}`; }).join("\n");

function viewTiming(){
  setCrumbs([["Tools"], ["Timing Helper"]]);
  const sheets = [...new Set(TIM_ROWS.map(o => o.sheet))];
  if (!sheets.includes(TIM.sheet)) TIM.sheet = sheets[0];
  app.innerHTML = `${ph({title:"Timing Helper", sub:"Fill the missing RT and CBT faster: check what the game script says, confirm it, and paste the result in the sheet."})}
  <div class="toolbar tim-tb">
    <div class="seg" id="tsheet" role="group" aria-label="Sheet">${sheets.map(s => `<button data-s="${esc(s)}" class="${TIM.sheet == s ? "on" : ""}">${esc(s)}</button>`).join("")}</div>
    <input type="text" id="tq" placeholder="Filter skills…" aria-label="Filter skills" value="${esc(TIM.q)}">
    <div class="seg" id="tshow" role="group" aria-label="Show"><button data-v="todo" class="${TIM.show == "todo" ? "on" : ""}">To do</button><button data-v="done" class="${TIM.show == "done" ? "on" : ""}">Confirmed</button><button data-v="all" class="${TIM.show == "all" ? "on" : ""}">All</button></div>
  </div>
  <div id="tprog"></div>
  <div class="tim-legend"><span><i class="l-c"></i>Cancel opens</span><span><i class="l-h"></i>Hit</span><span><i class="l-t"></i>T</span><span class="mute">Enter confirms and jumps to the next skill. RT can never be above T.</span></div>
  <div class="wrap"><table class="tbl tim-tbl"><thead><tr><th>Skill</th><th class="r">Row</th><th class="r">T</th><th>Script timeline</th><th>CBT</th><th>RT</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div>
  <section class="card tim-out" id="tout"></section>`;
  $$("#tsheet button").forEach(b => b.onclick = () => { TIM.sheet = b.dataset.s; saveTim(); viewTiming(); });
  $$("#tshow button").forEach(b => b.onclick = () => { TIM.show = b.dataset.v; saveTim(); viewTiming(); });
  $("#tq").oninput = e => { TIM.q = e.target.value; saveTim(); drawTimRows(); };
  drawTimRows();
}
function drawTimRows(){
  const inSheet = TIM_ROWS.filter(o => o.sheet == TIM.sheet), q = TIM.q.trim().toLowerCase();
  const list = inSheet.filter(o => (!q || o.n.toLowerCase().includes(q)) && (TIM.show == "all" || (TIM.show == "done") == !!TIM.done[o.k]));
  $("#tbody").innerHTML = list.slice(0, 150).map(o => { const g = timSuggest(o), d = TIM.done[o.k];
    return `<tr data-k="${esc(o.k)}" class="${d ? "tdone" : ""}"><td class="name"><b>${esc(o.n)}</b>${g.combo ? ` <span class="badge b-ougi">COMBO ${o.st.length}</span>` : ""}<div class="jp">${esc(o.sec)}</div></td>
      <td class="r num">${o.row}</td><td class="r num">${o.t}</td><td class="tbar-c">${timBar(o)}</td>
      <td>${g.combo ? `<input class="tcbt" type="number" step="0.001" min="0" value="${d?.cbt ?? g.cbt ?? ""}" aria-label="CBT"><div class="tcs">${g.cbts.map(v => `<button data-f="cbt" data-v="${v}">${v}</button>`).join("")}</div>` : `<span class="faint">/</span>`}</td>
      <td><input class="trt" type="number" step="0.001" min="0" max="${o.t}" value="${d?.rt ?? g.rt ?? ""}" aria-label="RT"><div class="tcs">${g.rts.map(v => `<button data-f="rt" data-v="${v}" title="${v == o.t ? "Same as T" : "From the script"}">${v}</button>`).join("")}</div></td>
      <td class="r"><button class="addbtn ${d ? "on" : ""}" data-ok>${d ? "✓ Undo" : "Confirm"}</button></td></tr>`; }).join("")
    || `<tr><td colspan="7">${emptyState(TIM.show == "todo" ? "All done here ✓" : "Nothing here", "")}</td></tr>`;
  $$("#tbody tr[data-k]").forEach(tr => {
    const o = TIM_ROWS.find(x => x.k == tr.dataset.k), rt = tr.querySelector(".trt"), cbt = tr.querySelector(".tcbt");
    const confirm = () => {
      if (TIM.done[o.k]){ delete TIM.done[o.k]; saveTim(); drawTimRows(); return; }
      const r = +rt.value, c = cbt ? +cbt.value : 0;
      if (!(r > 0) || r > o.t || (cbt && !(c > 0 && c <= r))){ tr.classList.add("terr"); rt.title = "RT must be above 0 and at most T; CBT at most RT"; return; }
      const next = tr.nextElementSibling?.dataset.k;
      TIM.done[o.k] = cbt ? {rt: r, cbt: c} : {rt: r}; saveTim(); drawTimRows();
      if (next) document.querySelector(`tr[data-k="${CSS.escape(next)}"] ${o.st && o.st.length > 1 ? ".tcbt, .trt" : ".trt"}`)?.focus();
    };
    tr.querySelector("[data-ok]").onclick = confirm;
    tr.querySelectorAll("input").forEach(i => i.onkeydown = e => { if (e.key == "Enter"){ e.preventDefault(); confirm(); } });
    tr.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { (b.dataset.f == "rt" ? rt : cbt).value = b.dataset.v; tr.classList.remove("terr"); });
  });
  const n = inSheet.filter(o => TIM.done[o.k]).length, pctDone = inSheet.length ? n / inSheet.length * 100 : 0;
  $("#tprog").innerHTML = `<div class="tprog"><b>${n} of ${inSheet.length}</b> confirmed in ${esc(TIM.sheet)}<div class="bar"><i style="width:${pctDone.toFixed(1)}%"></i></div></div>`;
  const blocks = timBlocks(inSheet);
  $("#tout").innerHTML = `<div class="sim-head"><h3>Paste in the sheet</h3><div class="sim-head-ctl"><button class="btn sm" id="tcsv" ${n ? "" : "disabled"}>Download CSV</button></div></div>
    ${blocks.length ? `<div class="hint">Click the first cell shown, then paste. Blocks only cover confirmed rows in a row, so nothing else is overwritten.</div><div class="tblocks">${blocks.map((b, i) => `<button class="tblock" data-b="${i}"><b>${b.cc || b.rc}${b.first}</b><span>${b.rows.length} row${b.rows.length > 1 ? "s" : ""} · ${b.cc ? "CBT + RT" : "RT only"}</span><em>Copy</em></button>`).join("")}</div>` : `<div class="hint">Confirm a skill and its block shows up here.</div>`}`;
  $$("[data-b]").forEach(btn => btn.onclick = async () => { const em = btn.querySelector("em");
    try { await navigator.clipboard.writeText(timBlockText(blocks[+btn.dataset.b])); em.textContent = "Copied ✓"; } catch(e){ em.textContent = "Copy failed"; } });
  if ($("#tcsv")) $("#tcsv").onclick = () => {
    const lines = ["Sheet,Row,Skill,CBT,RT", ...TIM_ROWS.filter(o => TIM.done[o.k]).map(o => `${o.sheet},${o.row},"${o.n.replace(/"/g, '""')}",${TIM.done[o.k].cbt || "/"},${TIM.done[o.k].rt}`)];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], {type: "text/csv"})); a.download = "onigiri-timing.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
}
