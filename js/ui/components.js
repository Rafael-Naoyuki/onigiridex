"use strict";
/* OnigiriDex — shared page components (headers, tabs, tiles, crumbs, recent) */
/* OnigiriDex — UI layer: shell, shared components, pages and router.
   Data + game formulas live in app.js; the Build Planner page lives in build.js. */

// ---------------------------------------------------------------- icons (stroke svg)
const SVG = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  dungeon:'<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/>',
  monster:'<path d="M5 20c0-6 3-10 7-10s7 4 7 10"/><circle cx="9.5" cy="14" r="1"/><circle cx="14.5" cy="14" r="1"/><path d="M8 7l-2-4M16 7l2-4"/>',
  item:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  farm:'<path d="M12 21V11"/><path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 14c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
  build:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  sim:'<path d="M4 20L20 4"/><path d="M14 4h6v6"/><path d="M4 10l6 6"/><path d="M3 21l3-3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  theme:'<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const svg = (n, cls="") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${SVG[n] || ""}</svg>`;

// ---------------------------------------------------------------- shared components
function ph({k="", title="", jp="", sub="", icon:ic="", chips="", actions=""}){
  return `<header class="ph">
    <div class="ph-main">${ic ? `<div class="ph-ico">${ic}</div>` : ""}
      <div style="min-width:0">${k ? `<div class="ph-k">${k}</div>` : ""}<h1>${title}</h1>${jp ? `<div class="jp" style="font-size:13px">${esc(jp)}</div>` : ""}
        ${sub ? `<div class="sub">${sub}</div>` : ""}${chips ? `<div class="chips">${chips}</div>` : ""}</div></div>
    ${actions ? `<div class="ph-actions">${actions}</div>` : ""}
  </header>`;
}
function diffSeg(cur, avail=[0,1,2,3], label=d=>DIFFS[d]){
  return `<div class="seg diff">${avail.map(d => `<button class="${d == cur ? "on" : ""}" data-setdiff="${d}">${label(d)}</button>`).join("")}</div>`;
}
function partySeg(){ return `<span class="ctl">Party <div class="seg">${[1,2,3,4,5].map(n => `<button class="${S.party == n ? "on" : ""}" data-setparty="${n}">${n}</button>`).join("")}</div></span>`; }
// wide screens show every panel at once instead of tabs
const WIDE_MIN = 1500;
const isWide = () => window.innerWidth >= WIDE_MIN;
function pane(title, html, n){ return `<section class="pane"><h2 class="pane-h">${title}${n != null ? ` <span class="count">${n}</span>` : ""}</h2>${html}</section>`; }
function tabsBar(list, active, base){
  return `<nav class="tabs">${list.filter(Boolean).map(t => `<a href="${base}${base.includes("?") ? "&" : "?"}tab=${t.id}" class="${t.id == active ? "on" : ""}">${t.label}${t.n != null ? `<span class="n">${t.n}</span>` : ""}</a>`).join("")}</nav>`;
}
function tile(k, v, s="", cls=""){ return `<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`; }
function emptyState(title, text){ return `<div class="empty"><b>${title}</b>${text || ""}</div>`; }
function setCrumbs(list){
  const el = $("#crumbs"); if (!el) return;
  el.innerHTML = list.map((c, i) => (i ? `<span class="sep">/</span>` : "") + (c[1] ? `<a href="${c[1]}">${esc(c[0])}</a>` : `<span>${esc(c[0])}</span>`)).join("");
}
function remember(h, n, t){
  try {
    let r = JSON.parse(localStorage.getItem("od2-recent") || "[]").filter(x => x.h != h);
    r.unshift({h, n, t}); localStorage.setItem("od2-recent", JSON.stringify(r.slice(0, 12)));
  } catch(e){}
}
const lvPills = d => d.L.map((L, i) => L ? `<span class="lvpill d${i}">${DIFFS[i]}${L.lv > 0 ? ` <b>${L.lv}</b>` : ""}</span>` : "").join("");
const bossOf = (d, diff) => { const L = d.L[diff]; if (!L) return null; for (const fl of dungeonFloors(d, diff, S.party)) for (const m of fl.mons) if (m.boss || m.last) return m; return null; };
