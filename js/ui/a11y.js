"use strict";
/* OnigiriDex — keyboard access, recent pages, names for icon buttons */
/* OnigiriDex — easy access: recent pages in the sidebar, Alt+1..8 shortcuts, keyboard support for
   clickable rows/cards, names for icon-only buttons and unlabeled fields. Runs after every render. */
(function(){
  const NAV_KEYS = ["home", "dungeons", "monsters", "items", "fields", "farm", "build", "sim", "bestiary"];
  const TYPE_TAG = {Bestiary:"card", Dungeon:"dun", Monster:"mon", Item:"item", Field:"map", Skill:"skill"};

  // ---- recent pages (the router's remember() list) ----
  function drawRecent(){
    const box = document.getElementById("navRecent"); if (!box) return;
    let r = []; try { r = JSON.parse(localStorage.getItem("od2-recent") || "[]"); } catch(e){}
    const cur = location.hash || "#/";
    r = r.filter(x => x && x.h && x.h != cur).slice(0, 6);
    const btn = document.getElementById("recentClear"); if (btn) btn.hidden = !r.length;
    box.innerHTML = r.length ? r.map(x => `<a href="${esc(x.h)}" title="${esc(x.n)}"><span>${esc(x.n)}</span><i>${esc(TYPE_TAG[x.t] || x.t || "")}</i><button class="rmx" data-rm-recent="${esc(x.h)}" title="Remove from recent" aria-label="Remove ${esc(x.n)} from recent">✕</button></a>`).join("")
                             : `<div class="none">Pages you open show up here.</div>`;
  }

  // ---- make every clickable thing reachable and named ----
  const CLICKABLE = "[data-sel], div[data-pk], .eqrow.empty, .chip.x, .chip[data-unpick], [data-skel], [data-skrk]";
  function enhance(root){
    root = root || document;
    root.querySelectorAll(CLICKABLE).forEach(el => {
      if (el.tagName == "BUTTON" || el.tagName == "A") return;
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    });
    root.querySelectorAll("tr.rowlink").forEach(tr => { if (!tr.hasAttribute("tabindex")){ tr.tabIndex = 0; tr.setAttribute("role", "link"); } });
    // icon-only buttons get their title (or a sensible word) as name
    root.querySelectorAll("button:not([aria-label])").forEach(b => {
      const t = (b.textContent || "").trim();
      if (t && /[A-Za-z0-9぀-鿿]{2,}/.test(t)) return;
      const name = b.title || ({"✕":"Remove", "⇄":"Change", "☆":"Set as active weapon", "★":"Active weapon"})[t] || "";
      if (name) b.setAttribute("aria-label", name);
    });
    // fields without a visible label get one for screen readers
    root.querySelectorAll("input:not([type=hidden]):not([aria-label]), select:not([aria-label])").forEach(f => {
      if (f.closest("label") || (f.id && document.querySelector(`label[for="${f.id}"]`))) return;
      const prev = f.previousElementSibling;
      const name = f.placeholder || f.title || (prev && prev.textContent.trim()) || f.name || "";
      if (name) f.setAttribute("aria-label", name.replace(/…$/, ""));
    });
  }

  // Enter / Space activate role=button and table row links
  document.addEventListener("keydown", e => {
    const t = e.target;
    if ((e.key == "Enter" || e.key == " ") && t && t.matches && t.matches('[role="button"], tr.rowlink') && !/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(t.tagName)){
      e.preventDefault(); t.click();
    }
    // Alt+1..8: jump to a section
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)){
      const k = NAV_KEYS[+e.key - 1];
      const a = document.querySelector(`#nav a[data-k="${k}"]`);
      if (a){ e.preventDefault(); location.hash = a.getAttribute("href"); }
    }
  });
  // menu button reports its state
  document.addEventListener("click", () => setTimeout(() => {
    const b = document.getElementById("navToggle"); if (b) b.setAttribute("aria-expanded", document.body.classList.contains("navopen") ? "true" : "false");
  }));
  // active nav item is announced as the current page
  function markCurrent(){
    document.querySelectorAll("#nav a").forEach(a => { if (a.classList.contains("on")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }

  // re-run after every render of the page (views replace #app's content)
  let queued = false;
  const run = () => { queued = false; enhance(document.getElementById("app")); enhance(document.querySelector(".topbar")); markCurrent(); };
  const app = document.getElementById("app");
  if (app) new MutationObserver(() => { if (!queued){ queued = true; requestAnimationFrame(run); } }).observe(app, {childList:true, subtree:true});
  window.addEventListener("hashchange", () => setTimeout(() => { drawRecent(); markCurrent(); }, 0));
  window.addEventListener("DOMContentLoaded", () => { drawRecent(); run(); });
  // clear all / remove one recent page (sidebar + home)
  document.addEventListener("click", e => {
    const one = e.target.closest("[data-rm-recent]"), all = e.target.closest("[data-clear-recent]");
    if (!one && !all) return;
    e.preventDefault(); e.stopPropagation();
    let r = []; try { r = JSON.parse(localStorage.getItem("od2-recent") || "[]"); } catch(_){}
    r = all ? [] : r.filter(x => x.h != one.dataset.rmRecent);
    try { localStorage.setItem("od2-recent", JSON.stringify(r)); } catch(_){}
    drawRecent();
    if ((location.hash || "#/") == "#/" && typeof route == "function") route();
  }, true);
  // skip link: move focus into the page
  document.addEventListener("click", e => { if (e.target.closest(".skip")){ e.preventDefault(); const m = document.getElementById("app"); if (m) m.focus(); } });
})();
