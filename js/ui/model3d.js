"use strict";
/* OnigiriDex — 3D weapon model viewer. three.js is loaded only when a page shows a model.
   Each .glb carries the weapon script's look (tools/weapon_models.py + scm_fx.py):
   material extras {unlit, add, nodepth, ke} and scene extras.fx {init, ev, loop, len} with events
   [t, "d", mat, rgb, ms] diffuse fade · [t, "e", mat, from, to, ms] glow · [t, "uv", mat, u, v] scroll/s · [t, "rot", h, p, b] spin deg/s
   [t, "add"|"unlit"|"nodepth", mat] material mode */
const modelOf = i => (window.WEAPON_MODELS || {})[D.wid?.[i]];
const M3D = load("od2-m3d", {spin: true, anim: true});
let _three = null;
function loadThree(){
  if (_three) return _three;
  const add = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  return _three = add("vendor/three/three.min.js").then(() => Promise.all([add("vendor/three/GLTFLoader.js"), add("vendor/three/OrbitControls.js")]));
}
const m3dBtn = (k, label, on, tip) => `<button type="button" class="btn sm m3d-t ${on ? "on" : ""}" data-m3d="${k}" aria-pressed="${on}" title="${tip}">${label}</button>`;
const modelPanel = i => modelOf(i) ? `<div class="m3d" id="m3d" data-model="${modelOf(i)}">
  <div class="m3d-stage"><div class="m3d-load">Loading 3D model…</div></div>
  <div class="m3d-bar"><span class="m3d-hint">Drag to rotate · scroll to zoom</span><span class="sp"></span>
    ${m3dBtn("spin", "Rotate", M3D.spin, "Turn the weapon around by itself")}${m3dBtn("anim", "Effects", M3D.anim, "Glow, colour and texture animations from the game's weapon script")}
    <button type="button" class="btn sm" data-m3d="reset" title="Back to the starting view">Reset</button></div></div>` : "";

// ---- effect timeline
function fxState(fx, tau){
  // value of every track at time tau (ms): diffuse colour, glow, uv speed, spin
  const st = {d: {}, e: {}, uv: {}, rot: null}, lerp = (a, b, k) => a.map((x, n) => x + (b[n] - x) * k);
  const at = (tr, t) => tr ? (tr.ms > 0 ? lerp(tr.from, tr.to, Math.min(1, Math.max(0, (t - tr.t) / tr.ms))) : tr.to) : null;
  const run = (list, t, shift) => { for (const e of list){ const te = e[0] + shift; if (te > t) break;
    if (e[1] == "d"){ const cur = at(st.d[e[2]], te) || [1, 1, 1]; st.d[e[2]] = {t: te, from: cur, to: e[3], ms: e[4]}; }
    else if (e[1] == "e") st.e[e[2]] = {t: te, from: e[3], to: e[4], ms: e[5]};
    else if (e[1] == "uv") st.uv[e[2]] = [e[3], e[4]];
    else if (e[1] == "rot") st.rot = [e[2], e[3], e[4]]; } };
  run(fx.init || [], 0, 0);
  const ev = fx.ev || [], L = fx.loop;
  if (L && L[1] > L[0] && tau >= L[1]){
    const len = L[1] - L[0], k = Math.floor((tau - L[0]) / len), local = tau - k * len;
    run(ev.filter(e => e[0] < L[0]), Infinity, 0);                     // intro
    run(ev.filter(e => e[0] >= L[0]), L[1], (k - 1) * len);              // previous lap, so fades carry over
    run(ev.filter(e => e[0] >= L[0]), local + k * len, k * len);
    tau = local + k * len;
  } else run(ev, tau, 0);
  const out = {d: {}, e: {}, uv: st.uv, rot: st.rot};
  for (const k in st.d) out.d[k] = at(st.d[k], tau);
  for (const k in st.e) out.e[k] = at(st.e[k], tau);
  return out;
}

let _m3dStop = null;
function mountModel(){
  if (_m3dStop){ _m3dStop(); _m3dStop = null; }
  const box = document.getElementById("m3d"); if (!box) return;
  const stage = box.querySelector(".m3d-stage");
  loadThree().then(() => {
    if (!box.isConnected) return;
    const T = window.THREE, w = () => stage.clientWidth, h = () => stage.clientHeight;
    const r = new T.WebGLRenderer({antialias: true, alpha: true});
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(w(), h()); r.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(35, w() / h(), 0.01, 100);
    scene.add(new T.HemisphereLight(0xffffff, 0x444455, 1.1));
    const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(3, 4, 5); scene.add(key);
    const rim = new T.DirectionalLight(0xffd9a0, 0.6); rim.position.set(-4, 2, -3); scene.add(rim);
    const ctl = new T.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.autoRotate = M3D.spin; ctl.autoRotateSpeed = 2;
    let home = null, alive = true, fx = null, mats = [], parts = [], clock = 0, last = performance.now();
    new T.GLTFLoader().load(`models/${box.dataset.model}.glb`, g => {
      if (!alive) return;
      const m = g.scene; m.rotation.x = Math.PI / 2;                    // the game's long axis is Z; stand it up
      fx = g.scene.userData?.fx || g.scenes?.[0]?.userData?.fx || null;
      const modes = {};
      for (const e of (fx?.init || []).concat(fx?.ev || [])) if (["add", "unlit", "nodepth"].includes(e[1])) (modes[e[2]] = modes[e[2]] || {})[e[1]] = 1;
      m.traverse(o => {
        if (!o.isMesh) return;
        parts.push(o);
        let mt = o.material; const x = Object.assign({}, mt.userData || {}, modes[mt.name] || {}, modes["*"] || {});
        if (x.unlit || x.add){
          const b = new T.MeshBasicMaterial({map: mt.map, color: mt.color, side: T.DoubleSide, transparent: mt.transparent, alphaTest: mt.alphaTest});
          b.name = mt.name; mt = b;
        }
        if (x.add){ mt.blending = T.AdditiveBlending; mt.transparent = true; mt.depthWrite = false; }
        if (x.nodepth) mt.depthWrite = false;
        if (mt.map && fx){ mt.map = mt.map.clone(); mt.map.wrapS = mt.map.wrapT = T.RepeatWrapping; mt.map.needsUpdate = true; }
        const ke = [0, 0, 0];   // the material Ke is not a plain glow in this engine (often white): only the script glow is used
        if (mt.emissive && !mt.emissiveMap) mt.emissive.setRGB(ke[0], ke[1], ke[2]);
        o.material = mt;
        mats.push({mt, name: mt.name, base: mt.color.clone(), ke, add: !!x.add});
      });
      const b = new T.Box3().setFromObject(m), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3());
      m.position.sub(c); scene.add(m);
      const d = Math.max(s.x, s.y, s.z) / (2 * Math.tan(cam.fov * Math.PI / 360)) * 1.15;
      home = new T.Vector3(d * 0.55, d * 0.15, d * 0.85); cam.position.copy(home); cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix();
      ctl.target.set(0, 0, 0); ctl.update();
      if (!fx) box.querySelector('[data-m3d="anim"]').hidden = true;
      // effects paused: show the weapon at the brightest moment of its script, not with the effect meshes switched off
      if (fx){ let best = 0, bestV = -1; const len = Math.max(fx.loop?.[1] || fx.len || 0, 1);
        for (let t = 0; t <= len; t += Math.max(len / 60, 16)){ const s = fxState(fx, t); let v = 0;
          for (const k in s.d) v += s.d[k] ? s.d[k][0] + s.d[k][1] + s.d[k][2] : 0; for (const k in s.e) v += s.e[k] ? (s.e[k][0] + s.e[k][1] + s.e[k][2]) * 0.3 : 0;
          if (v > bestV){ bestV = v; best = t; } }
        fx.still = best; }
      stage.innerHTML = ""; stage.appendChild(r.domElement);
      apply(M3D.anim ? 0 : fx?.still || 0, 0);
    }, undefined, () => { stage.innerHTML = `<div class="m3d-load">Could not load the model.</div>`; });
    function apply(t, dt){
      if (!fx) return;
      const s = fxState(fx, t), get = (o, n) => o[n] !== undefined ? o[n] : o["*"];
      for (const m of mats){
        const d = get(s.d, m.name); if (d) m.mt.color.setRGB(m.base.r * d[0], m.base.g * d[1], m.base.b * d[2]);
        const e = get(s.e, m.name); if (e && m.mt.emissive && !m.add) m.mt.emissive.setRGB(m.ke[0] + e[0], m.ke[1] + e[1], m.ke[2] + e[2]);
        const uv = get(s.uv, m.name); if (uv && m.mt.map && dt){ m.mt.map.offset.x += uv[0] * dt; m.mt.map.offset.y += uv[1] * dt; }
      }
      if (s.rot && dt) for (const p of parts){ p.rotation.y += s.rot[0] * Math.PI / 180 * dt; p.rotation.x += s.rot[1] * Math.PI / 180 * dt; p.rotation.z += s.rot[2] * Math.PI / 180 * dt; }
    }
    const loop = now => {
      if (!alive) return;
      if (!box.isConnected){ _m3dStop && _m3dStop(); _m3dStop = null; return; }
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (M3D.anim && fx){ clock += dt * 1000; apply(clock, dt); }
      ctl.update(); r.render(scene, cam); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { r.setSize(w(), h()); cam.aspect = w() / h(); cam.updateProjectionMatrix(); }); ro.observe(stage);
    const tog = (k, fn) => { const b = box.querySelector(`[data-m3d="${k}"]`); b.onclick = () => { M3D[k] = !M3D[k]; store("od2-m3d", M3D);
      b.classList.toggle("on", M3D[k]); b.setAttribute("aria-pressed", M3D[k]); fn(M3D[k]); }; };
    tog("spin", on => ctl.autoRotate = on);
    tog("anim", on => { if (!fx) return; if (on) clock = 0; else apply(fx.still || 0, 0); });
    box.querySelector('[data-m3d="reset"]').onclick = () => { if (home){ cam.position.copy(home); ctl.target.set(0, 0, 0); ctl.update(); } };
    _m3dStop = () => { alive = false; ro.disconnect(); ctl.dispose(); r.dispose(); r.forceContextLoss?.(); };
  }).catch(() => { stage.innerHTML = `<div class="m3d-load">3D viewer not available.</div>`; });
}
