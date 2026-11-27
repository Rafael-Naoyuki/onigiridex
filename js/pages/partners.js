"use strict";
/* OnigiriDex — Partners: partners (Vanguard Swap), mounts, supports and yokai partners, with how to unlock each one */
const PARTNERS = D.partners || [];
const PT_TABS = [
  {id:"partners", t:0, label:"Partners", sub:"Characters you swap in with the Vanguard Swap key."},
  {id:"mounts", t:1, label:"Mounts", sub:"Mounts you ride into battle."},
  {id:"supports", t:2, label:"Supports", sub:"Support characters that fight next to you and level up with gifts."},
  {id:"yokai", t:3, label:"Yokai", sub:"Yokai partners from summon cards, in every colour variant."},
];
const PT_GROUPS = [["Original", "Onigiri characters"], ["Collab", "Characters from other series"], ["Gacha", "Gacha and event characters"]];
const PT_RANKS = {1: "Platinum", 2: "Gold"};
const PT_STATS = ["STR", "VIT", "INT", "MND", "DEX"];
const PT_BY = {}; PARTNERS.forEach(p => PT_BY[p.t + ":" + p.id] = p);
const ptImg = key => key ? `img/partners/${key.split("/").pop().replace(/\.[^.]+$/, "")}.webp` : "";
const ptPortrait = (p, cls = "") => `<div class="pt-img ${cls} rk${p.rk}">${p.img ? `<img src="${ptImg(p.img)}" alt="${esc(p.n)}" loading="lazy" onerror="this.remove()">` : ""}</div>`;
const PT_ONE = ["partner", "mount", "support", "yokai"];
// variant name from the summon card made for it, e.g. "30021青一反木綿召喚札" -> "Blue"
// in reading order, so "黒かぼちゃ" -> "Black Pumpkin" and "素直ボイス" -> "Gentle voice"
const PT_COLORS = {"通常":"Normal", "ダウナー":"Downer", "素直":"Gentle", "勇敢":"Brave", "強気":"Bold", "臆病":"Timid", "青":"Blue", "黒":"Black", "クロ":"Black", "赤":"Red", "白":"White", "緑":"Green", "黄":"Yellow",
  "ピンク":"Pink", "金":"Gold", "銀":"Silver", "紫":"Purple", "ハロウィン":"Halloween", "かぼちゃ":"Pumpkin", "クリスマス":"Christmas", "娘":"Girl", "ボイス":"voice"};
const ptIdCard = i => /^\d{4,}/.test(ITEMS[i]?.[1] || ITEMS[i]?.[0] || "");
function ptVariant(v, p){
  const own = (v.ys || []).find(s => ptIdCard(s[0]));
  if (!own) return "Normal";
  const left = (ITEMS[own[0]][1] || "").replace(/^\d+/, "").replace("召喚札", "").replace(p.j, "").trim();
  return left ? (PT_COLORS[left] || Object.entries(PT_COLORS).filter(([k]) => left.includes(k)).map(([, e]) => e).join(" ") || left) : "Normal";
}
// what players confirmed where the game text is wrong
const PT_HOW = {"0:20": "Obtained from a shop and a quest.", "0:22": "Obtained from a shop and a quest."};
const ptCount = t => PARTNERS.filter(p => p.t == t).length;
// card text: intro lines, then one block per awakening level
function ptAwaken(text){
  const out = {intro: [], lv: []};
  for (const raw of (text || "").split("\n")){
    const line = raw.replace(/^[●・]\s*/, "").trim();
    if (!line) continue;
    const m = line.match(/^(?:Awakening level|Awaken(?:ing)? Lv\.?|覚醒レベル|Using)\s*(\d+)(?:\s*(?:or greater|or more|copies|個使用時))?\s*:?\s*(.*)$/i) || line.match(/^(\d+)個使用時\s*:?\s*(.*)$/);
    if (m){ out.lv.push({n: +m[1], fx: m[2] ? [m[2].replace(/^「|」$/g, "")] : []}); continue; }
    const clean = line.replace(/^「|」$/g, "");
    if (out.lv.length) out.lv[out.lv.length - 1].fx.push(clean); else out.intro.push(clean);
  }
  return out;
}
const ptBadges = p => [
  PT_RANKS[p.rk] && p.t < 3 && !(p.t == 0 && p.g == 0) ? `<span class="pt-rk rk${p.rk}">${PT_RANKS[p.rk]}</span>` : "",
  p.t == 0 && PT_GROUPS[p.g] ? `<span class="chip">${PT_GROUPS[p.g][0]}</span>` : "",
  p.t == 2 && p.mc?.length ? `<span class="chip">${p.mc.map(c => esc(CATS[c] || "?")).join(" / ")}</span>` : "",
  p.t == 3 && p.v?.length > 1 ? `<span class="chip">${p.v.length} variants</span>` : "",
].join("");

function viewPartners(tabId){
  const tab = PT_TABS.find(t => t.id == tabId) || PT_TABS[0];
  setCrumbs(tab.t ? [["Partners", "#/partners"], [tab.label]] : [["Partners"]]);
  const st = load("od2-partners", {q: "", g: -1, rk: 0});
  app.innerHTML = `${ph({title: "Partners", sub: tab.sub})}
  <nav class="tabs pt-tabs">${PT_TABS.map(t => `<a href="#/partners/${t.id}" class="${t.id == tab.id ? "on" : ""}">${t.label}<span class="n">${ptCount(t.t)}</span></a>`).join("")}</nav>
  <div class="toolbar">
    <input type="text" id="ptq" placeholder="Search ${tab.label.toLowerCase()}…" aria-label="Search ${tab.label.toLowerCase()}" value="${esc(st.q)}">
    ${tab.t == 0 ? `<div class="seg" id="ptg" role="group" aria-label="Group"><button data-v="-1" class="${st.g == -1 ? "on" : ""}">All</button>${PT_GROUPS.map(([n, tip], i) => `<button data-v="${i}" title="${tip}" class="${st.g == i ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
    ${tab.t < 3 ? `<div class="seg" id="ptr" role="group" aria-label="Rank"><button data-v="0" class="${!st.rk ? "on" : ""}">Any rank</button><button data-v="1" class="${st.rk == 1 ? "on" : ""}">Platinum</button><button data-v="2" class="${st.rk == 2 ? "on" : ""}">Gold</button></div>` : ""}
    <span class="sp"></span><span class="mute" id="ptn"></span>
  </div>
  <div class="pt-grid" id="ptgrid"></div>`;
  const draw = () => {
    const q = searchNorm(st.q);
    const list = PARTNERS.filter(p => p.t == tab.t && (tab.t != 0 || st.g < 0 || p.g == st.g) && (tab.t == 3 || !st.rk || p.rk == st.rk)
      && (!q || searchNorm(p.n + " " + p.j).includes(q)));
    $("#ptn").textContent = `${list.length} of ${ptCount(tab.t)}`;
    $("#ptgrid").innerHTML = list.map(p => `<a class="pt-card" href="#/partner/${p.t}/${p.id}">${ptPortrait(p).slice(0, -6) + (p.img ? zoomBtn() : "") + "</div>"}
      <div class="pt-meta"><b>${esc(p.n)}</b>${p.j && p.j != p.n ? `<span class="jp">${esc(p.j)}</span>` : ""}<div class="pt-badges">${ptBadges(p)}</div></div></a>`).join("")
      || emptyState("Nothing found", "Try another name or filter.");
  };
  const save = () => { store("od2-partners", st); draw(); };
  $("#ptq").oninput = e => { st.q = e.target.value; save(); };
  $$("#ptg button").forEach(b => b.onclick = () => { st.g = +b.dataset.v; $$("#ptg button").forEach(x => x.classList.toggle("on", x == b)); save(); });
  $$("#ptr button").forEach(b => b.onclick = () => { st.rk = +b.dataset.v; $$("#ptr button").forEach(x => x.classList.toggle("on", x == b)); save(); });
  draw();
}

function viewPartner(t, id){
  const p = PT_BY[t + ":" + id], tab = PT_TABS.find(x => x.t == t);
  if (!p || !tab) return notFound();
  setCrumbs(t ? [["Partners", "#/partners"], [tab.label, `#/partners/${tab.id}`], [p.n]] : [["Partners", "#/partners"], [p.n]]);
  remember(`#/partner/${t}/${id}`, p.n, tab.label);
  const aw = ptAwaken(p.cd);
  const card = p.c != null ? ITEMS[p.c] : null;
  const srcs = p.c != null ? gearSources(p.c) : [];
  const stats = p.sc ? `<section class="card"><h3>Stat growth</h3><div class="pt-stats">${PT_STATS.map((n, i) => { const v = p.sc[i] || 0, mx = Math.max(...p.sc, 0.01);
      return `<div class="pt-stat"><span>${n}</span><i><u style="width:${(v / mx * 100).toFixed(1)}%"></u></i><b>×${v}</b></div>`; }).join("")}</div>
      <div class="hint">How much each stat grows per point, compared with its other stats.</div></section>` : "";
  const unlock = t < 3 ? `<section class="card"><h3>How to unlock</h3>
      ${card ? `<div class="pt-unlock">${itemLink(p.c)}${srcs.length ? gearChips(p.c, srcs) : ""}</div>` : `<div class="hint">There is no unlock item for this ${PT_ONE[t]} in the game files.</div>`}
      ${PT_HOW[t + ":" + id] ? `<div class="pt-how">${PT_HOW[t + ":" + id]}</div>` : p.how ? `<div class="pt-how">${esc(p.how).replace(/\n/g, "<br>")}</div>` : ""}
      ${aw.intro.length ? `<div class="pt-intro">${aw.intro.map(esc).join("<br>")}</div>` : ""}</section>` : "";
  const awaken = aw.lv.length ? `<section class="card"><h3>Awakening</h3><div class="hint">Use more copies of the unlock item to awaken it.</div>
      <ol class="pt-aw">${aw.lv.map(l => `<li><b>Lv ${l.n}</b><div>${l.fx.map(f => `<span>${esc(f)}</span>`).join("")}</div></li>`).join("")}</ol></section>` : "";
  const variants = t == 3 ? `<section class="card"><h3>Variants and summon cards</h3><div class="wrap"><table class="tbl"><thead><tr><th>Variant</th><th>Summon card</th><th class="r">Chance</th></tr></thead><tbody>
      ${!p.v.some(v => (v.ys || []).length) ? `<tr><td colspan="3" class="faint">No summon card in the game files${p.v.length > 1 ? ` (${p.v.length} variants)` : ""}</td></tr>` : p.v.map(v => { const label = ptVariant(v, p), rows = (v.ys || []).filter(s => !ptIdCard(s[0])).sort((a, b) => b[1] - a[1]);
        return rows.length ? rows.map((s, j) => `<tr>${j ? "" : `<td rowspan="${rows.length}"><b>${esc(label)}</b></td>`}<td>${itemLink(s[0])}</td><td class="r num">${s[1]}%</td></tr>`).join("")
          : `<tr><td><b>${esc(label)}</b></td><td class="faint" colspan="2">No summon card in the game files</td></tr>`; }).join("")}
      </tbody></table></div></section>` : "";
  const weapon = p.w != null ? `<div class="pt-kv"><span>Starting weapon</span>${itemLink(p.w)}</div>` : "";
  const cats = t == 2 ? `<div class="pt-kv"><span>Main weapon</span><b>${(p.mc || []).map(c => esc(CATS[c] || "?")).join(" / ") || "—"}</b></div><div class="pt-kv"><span>Sub weapon</span><b>${(p.sc2 || []).map(c => esc(CATS[c] || "?")).join(" / ") || "—"}</b></div>` : "";
  const stam = p.st ? `<div class="pt-kv"><span>Base stamina</span><b>${fmt(p.st)}</b></div>` : "";
  app.innerHTML = `<div class="pt-detail">
    <aside class="pt-side">${ptPortrait(p, "big")}
      <div class="pt-side-meta"><h1>${esc(p.n)}</h1>${p.j && p.j != p.n ? `<div class="jp">${esc(p.j)}</div>` : ""}<div class="pt-badges">${ptBadges(p)}</div>
      ${weapon}${cats}${stam}</div></aside>
    <div class="pt-body">${unlock}${awaken}${variants}${stats}
      ${p.p ? `<section class="card"><h3>Profile</h3><div class="pt-profile">${esc(p.p).split(/\n{2,}/).map(par => `<p>${par.replace(/\n/g, " ")}</p>`).join("")}</div></section>` : ""}</div>
  </div>`;
}
