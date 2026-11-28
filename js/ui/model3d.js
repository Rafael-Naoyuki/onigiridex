"use strict";
/* OnigiriDex — 3D weapon model viewer. three.js is loaded only when a page shows a model.
   Each .glb carries the weapon's look from the game scripts (tools/weapon_models.py, scm_fx.py, kfx.py):
   - material extras {unlit, add, nodepth}
   - script timelines {init, ev, loop, len}; events:
       [t, "d", mat, rgb, ms] diffuse fade · [t, "e", mat, from, to, ms] glow · [t, "uv", mat, u, v] scroll per second
       [t, "uvto", mat, u, v, ms] scroll to · [t, "rot", h, p, b] spin deg/s · [t, "rotto", h, p, b] turn to
       [t, "zoom", x, y, z, ms] scale to · [t, "zoomat", x, y, z] scale per second · [t, "bb"] faces the camera
       [t, "add"|"unlit"|"nodepth", mat] material mode
   - scene extras.fx: the weapon's own script
   - node extras.efx: an effect mesh from the weapon's .kfx {t0, t1, speed, fin, fout, per, fx}
   - scene extras.ptc: particle systems from .pt2 files {t0, t1, speed, per, m (4x4), mats, emit} */
const modelOf = i => (window.WEAPON_MODELS || {})[D.wid?.[i]];
const M3D = load("od2-m3d", {spin: true, anim: false});
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
    ${m3dBtn("spin", "Rotate", M3D.spin, "Turn the weapon around by itself")}${m3dBtn("anim", "Effects", M3D.anim, "Glow and effects from the game (loads more data)")}
    <button type="button" class="btn sm" data-m3d="reset" title="Back to the starting view">Reset</button></div></div>` : "";

// additive glow that leaves the canvas alpha alone: the canvas is transparent, so adding to alpha would paint dark halos
function addBlend(T, m){ m.blending = T.CustomBlending; m.blendEquation = T.AddEquation; m.blendSrc = T.SrcAlphaFactor; m.blendDst = T.OneFactor;
  m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor; m.transparent = true; m.depthWrite = false; }

// ---- script timeline: state of every track at time tau (ms)
function fxState(fx, tau){
  const st = {d: {}, e: {}, uv: {}, uvto: {}, rot: null, rotto: null, zoom: null, zoomat: null, bb: false};
  const lerp = (a, b, k) => a.map((x, n) => x + (b[n] - x) * k);
  const at = (tr, t) => tr ? (tr.ms > 0 ? lerp(tr.from, tr.to, Math.min(1, Math.max(0, (t - tr.t) / tr.ms))) : tr.to) : null;
  const run = (list, t, shift) => { for (const e of list){ const te = e[0] + shift; if (te > t) break;
    switch (e[1]){
      case "d": st.d[e[2]] = {t: te, from: at(st.d[e[2]], te) || [1, 1, 1], to: e[3], ms: e[4]}; break;
      case "e": st.e[e[2]] = {t: te, from: e[3], to: e[4], ms: e[5]}; break;
      case "uv": st.uv[e[2]] = [e[3], e[4]]; break;
      case "uvto": st.uvto[e[2]] = {t: te, from: at(st.uvto[e[2]], te) || [0, 0], to: [e[3], e[4]], ms: e[5]}; break;
      case "rot": st.rot = [e[2], e[3], e[4]]; break;
      case "rotto": st.rotto = [e[2], e[3], e[4]]; break;
      case "zoom": st.zoom = {t: te, from: at(st.zoom, te) || [1, 1, 1], to: [e[2], e[3], e[4]], ms: e[5]}; break;
      case "zoomat": st.zoomat = [e[2], e[3], e[4]]; break;
      case "bb": st.bb = true; break;
    } } };
  run(fx.init || [], 0, 0);
  const ev = fx.ev || [], L = fx.loop;
  if (L && L[1] > L[0] && tau >= L[1]){
    const len = L[1] - L[0], k = Math.floor((tau - L[0]) / len), local = tau - k * len;
    run(ev.filter(e => e[0] < L[0]), Infinity, 0);
    const lap = ev.filter(e => e[0] >= L[0]);
    run(lap, L[1] + (k - 1) * len, (k - 1) * len);
    run(lap, local + k * len, k * len);
    tau = local + k * len;
  } else run(ev, tau, 0);
  const out = {d: {}, e: {}, uv: st.uv, uvto: {}, rot: st.rot, rotto: st.rotto, zoom: at(st.zoom, tau), zoomat: st.zoomat, bb: st.bb};
  for (const k in st.d) out.d[k] = at(st.d[k], tau);
  for (const k in st.e) out.e[k] = at(st.e[k], tau);
  for (const k in st.uvto) out.uvto[k] = at(st.uvto[k], tau);
  return out;
}
// where an effect is in its .kfx at weapon time t: null = not showing
function efxTime(tl, t){
  const kt = tl.per > 0 ? t % tl.per : t;
  if (kt < tl.t0 || kt > tl.t1 + (tl.fout || 0)) return null;
  let a = 1;
  if (tl.fin && kt < tl.t0 + tl.fin) a = (kt - tl.t0) / tl.fin;
  if (kt > tl.t1) a = tl.fout ? 1 - (kt - tl.t1) / tl.fout : 0;
  return {st: (kt - tl.t0) * (tl.speed || 1), a: Math.max(0, Math.min(1, a))};
}

// ---- particles (.pt2): bursts of textured points, simulated on the CPU, drawn as one THREE.Points per system
const PT_MAX = 600;
function curve(list, k, n){   // 10-step colour or scale curve with gaps (null) -> value at life k (0..1)
  if (!list || !list.length) return null;
  const keys = []; list.forEach((v, i) => { if (v != null) keys.push([list.length > 1 ? i / (list.length - 1) : 0, v]); });
  if (!keys.length) return null;
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]){
    const [a, va] = keys[i - 1], [b, vb] = keys[i], f = (k - a) / (b - a || 1);
    return n ? va.map((x, j) => x + (vb[j] - x) * f) : va + (vb - va) * f; }
  return keys[keys.length - 1][1];
}
function makeParticles(T, def, scene){
  const groups = def.mats.map((m, mi) => {
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(PT_MAX * 3), col = new Float32Array(PT_MAX * 4), size = new Float32Array(PT_MAX);
    geo.setAttribute("position", new T.BufferAttribute(pos, 3)); geo.setAttribute("color", new T.BufferAttribute(col, 4)); geo.setAttribute("size", new T.BufferAttribute(size, 1));
    const add = /ADD/.test(m.blend);
    const mat = new T.ShaderMaterial({
      uniforms: {map: {value: null}, uScale: {value: 400}, uHas: {value: 0}},
      vertexShader: "attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(-mv.z, 0.01); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform sampler2D map; uniform float uHas; varying vec4 vC; void main(){ vec4 t = uHas > 0.5 ? texture2D(map, gl_PointCoord) : vec4(1.0, 1.0, 1.0, 1.0 - smoothstep(0.3, 0.5, length(gl_PointCoord - 0.5))); vec4 c = t * vC; if (c.a < 0.01) discard; gl_FragColor = c; }",
      transparent: true, depthWrite: false, blending: T.NormalBlending});
    addBlend(T, mat);   // weapon effects only add light
    if (m.tex) new T.TextureLoader().load(`models/ptc/${m.tex}`, t => { mat.uniforms.map.value = t; mat.uniforms.uHas.value = 1; });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
    return {m, mat, pts, geo, pos, col, size, live: []};
  });
  return {def, groups, fired: new Set(), lastSt: -1};
}
const rnd = r => (Math.random() * 2 - 1) * r;
function stepParticles(T, ps, t, dt, world, alpha){
  const tl = efxTime(ps.def, t);
  if (tl){
    if (tl.st < ps.lastSt) ps.fired.clear();             // the .kfx looped: the bursts can fire again
    ps.lastSt = tl.st;
    ps.def.emit.forEach((e, i) => {
      if (ps.fired.has(i) || tl.st < e.t) return;
      ps.fired.add(i);
      const g = ps.groups[e.m] || ps.groups[0]; if (!g) return;
      const n = Math.max(0, Math.round(e.n + Math.random() * (e.rn || 0)));
      const R = new T.Matrix4().extractRotation(world), sc = new T.Vector3().setFromMatrixScale(world), s = (sc.x + sc.y + sc.z) / 3;
      for (let k = 0; k < n && g.live.length < PT_MAX; k++){
        const p = new T.Vector3(e.pos[0] + rnd(e.rpos[0]), e.pos[1] + rnd(e.rpos[1]), e.pos[2] + rnd(e.rpos[2])).applyMatrix4(world);
        const h = (e.dir[0] + rnd(e.rdir[0])) * Math.PI / 180, pi = (e.dir[1] + rnd(e.rdir[1])) * Math.PI / 180, b = (e.dir[2] + rnd(e.rdir[2])) * Math.PI / 180;
        const d = new T.Vector3(0, 1, 0).applyEuler(new T.Euler(pi, h, b, "YXZ")).applyMatrix4(R).normalize();
        const v = d.multiplyScalar(Math.max(0, e.v + rnd(e.rv)) * s);
        g.live.push({p, v, age: 0, life: Math.max(0.05, e.life + rnd(e.rlife)), size: Math.max(0.005, e.size + rnd(e.rsize)) * s, g: e.g * s});
      }
    });
  } else if (ps.lastSt >= 0){ ps.fired.clear(); ps.lastSt = -1; }
  for (const g of ps.groups){
    let n = 0;
    g.live = g.live.filter(q => (q.age += dt) < q.life);
    for (const q of g.live){
      q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt);
      const k = q.age / q.life, c = curve(g.m.color, k, true) || [1, 1, 1, 1], sc = curve(g.m.scale, k, false) ?? 1;
      g.pos[n * 3] = q.p.x; g.pos[n * 3 + 1] = q.p.y; g.pos[n * 3 + 2] = q.p.z;
      g.col[n * 4] = c[0]; g.col[n * 4 + 1] = c[1]; g.col[n * 4 + 2] = c[2]; g.col[n * 4 + 3] = c[3] * alpha;
      g.size[n] = q.size * sc; n++;
    }
    g.geo.setDrawRange(0, n);
    g.geo.attributes.position.needsUpdate = g.geo.attributes.color.needsUpdate = g.geo.attributes.size.needsUpdate = true;
  }
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
    let home = null, alive = true, groups = [], systems = [], period = 0, clock = 0, last = performance.now(), root = null;
    const pxScale = () => r.getPixelRatio() * h() / (2 * Math.tan(cam.fov * Math.PI / 360));
    const loader = new T.GLTFLoader(), assets = {}, mdl = box.dataset.model;
    const hasFx = (window.WEAPON_FX || []).includes(mdl);
    // one group per script: the weapon itself, then each effect
    const mk = (obj, fx, tl) => {
      const modes = {};
      for (const e of (fx?.init || []).concat(fx?.ev || [])) if (["add", "unlit", "nodepth"].includes(e[1])) (modes[e[2]] = modes[e[2]] || {})[e[1]] = 1;
      const gr = {obj, fx, tl, mats: [], base: {pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone()}, spin: new T.Euler()};
      obj.traverse(o => {
        if (!o.isMesh) return;
        let mt = o.material; const x = Object.assign({}, mt.userData || {}, modes[mt.name] || {}, modes["*"] || {});
        if (x.unlit || x.add || tl){
          const b = new T.MeshBasicMaterial({map: mt.map, color: mt.color.clone(), side: T.DoubleSide, transparent: true, alphaTest: mt.alphaTest});
          b.name = mt.name; mt = b;
        }
        // effect meshes: the additive ones are the glows seen in game; the normal-blend ones (dark auras, smoke) are left out
        if (tl && (!x.add || (!x.tex && !mt.map))){ o.visible = false; o.userData.skip = 1; return; }   // also effect meshes whose texture is missing in the game files (they would be solid shells)
        // in the game the weapon effects only add light (no dark smoke or shadows), so every effect mesh is additive
        if (x.add || tl) addBlend(T, mt);
        if (tl && x.tex) mt.map = fxTex(x.tex);   // effect textures are shared files, loaded once
        if (mt.map && (fx || tl)){ mt.map = mt.map.clone(); mt.map.wrapS = mt.map.wrapT = T.RepeatWrapping; mt.map.needsUpdate = true; }
        if (mt.emissive && !mt.emissiveMap) mt.emissive.setRGB(0, 0, 0);
        if (tl) o.renderOrder = 2;
        o.material = mt;
        gr.mats.push({mt, name: mt.name, base: mt.color.clone(), add: !!(x.add || tl)});
      });
      groups.push(gr); return gr;
    };
    const texCache = {};
    const fxTex = n => { if (!texCache[n]){ const t = texCache[n] = new T.TextureLoader().load(`models/fx/tex/${n}`); t.flipY = false; t.encoding = T.sRGBEncoding; } return texCache[n]; };
    const asset = src => assets[src] || (assets[src] = src.endsWith(".json")
      ? fetch(`models/fx/${src}`).then(r => r.json())
      : fetch(`models/fx/${src}`).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => new T.GLTFLoader().parse(ab, "models/fx/", ok, no))));
    let fxOn = false, fxObjs = [];
    async function loadFx(){
      if (fxOn || !hasFx || !root) return; fxOn = true;
      const man = await fetch(`models/${mdl}.fx.json`).then(r => r.json()).catch(() => null);
      if (!man || !fxOn || !alive) return;
      groups[0].fx = man.fx || null;
      await Promise.all((man.e || []).map(async e => {
        const tl = {t0: e.t0, t1: e.t1, speed: e.speed, fin: e.fin, fout: e.fout, per: e.per};
        const a = await asset(e.src).catch(() => null);
        if (!a || !fxOn || !alive) return;
        if (e.src.endsWith(".json")){ systems.push(makeParticles(T, Object.assign({}, a, tl, {m: e.m}), scene)); return; }
        const obj = new T.Group(); obj.applyMatrix4(new T.Matrix4().fromArray(e.m));
        const c = a.scene.clone(true); obj.add(c); root.add(obj); fxObjs.push(obj);
        let fx = null; c.traverse(o => { if (!fx && o.userData?.fx) fx = o.userData.fx; });
        mk(obj, fx, tl);
      }));
      period = Math.max(1, ...groups.map(g => g.tl?.per || 0), ...systems.map(p => p.def.per || 0), groups[0].fx?.loop?.[1] || groups[0].fx?.len || 0);
      clock = 0;
    }
    function unloadFx(){
      fxOn = false;
      for (const o of fxObjs) o.parent?.remove(o);
      for (const ps of systems) for (const g of ps.groups){ scene.remove(g.pts); g.geo.dispose(); g.mat.dispose(); }
      fxObjs = []; systems = []; groups = groups.slice(0, 1);
      const w0 = groups[0]; if (w0){ w0.fx = null; for (const m of w0.mats){ m.mt.color.copy(m.base); if (m.mt.emissive && !m.mt.emissiveMap) m.mt.emissive.setRGB(0, 0, 0); } }
    }
    // framing: on the weapon alone, or on the character holding it
    let wpos = null, wsize = 1;
    const frame = (center, size, side) => {
      const d = size / (2 * Math.tan(cam.fov * Math.PI / 360)) * 1.15;
      home = side ? new T.Vector3(center.x + d * 0.25, center.y + d * 0.05, center.z - d * 0.97) : new T.Vector3(d * 0.55, d * 0.15, d * 0.85).add(center);
      cam.position.copy(home); cam.near = d / 100; cam.far = d * 20; cam.updateProjectionMatrix();
      ctl.target.copy(center); ctl.update();
    };
    loader.load(`models/${mdl}.glb`, g => {
      if (!alive) return;
      const m = root = g.scene; m.rotation.x = Math.PI / 2;               // the game's long axis is Z; stand it up
      mk(m, null, null);
      const b = new T.Box3().setFromObject(m), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3());
      wpos = c.clone().negate(); wsize = Math.max(s.x, s.y, s.z);
      m.position.copy(wpos); scene.add(m); m.updateMatrixWorld(true);
      frame(new T.Vector3(), wsize);
      stage.innerHTML = ""; stage.appendChild(r.domElement);
      const fb = box.querySelector('[data-m3d="anim"]'); if (fb) fb.hidden = !hasFx;
      if (M3D.anim && hasFx) loadFx().catch(() => {});
    }, undefined, () => { stage.innerHTML = `<div class="m3d-load">Could not load the model.</div>`; });
    function apply(t, dt){
      for (const gr of groups){
        let st = t, a = 1;
        if (gr.tl){ const et = efxTime(gr.tl, t); gr.obj.visible = !!et; if (!et) continue; st = et.st; a = et.a; }
        if (!gr.fx){ if (gr.tl) for (const m of gr.mats){ if (m.add) m.mt.color.setRGB(m.base.r * a, m.base.g * a, m.base.b * a); else { m.mt.opacity = a; m.mt.transparent = true; } } continue; }
        const s = fxState(gr.fx, st), get = (o, n) => o[n] !== undefined ? o[n] : o["*"];
        for (const m of gr.mats){
          const d = get(s.d, m.name) || [1, 1, 1], f = gr.tl ? a : 1;
          if (gr.tl && !m.add){   // blended effect mesh: the script colour is how visible it is (black = gone), not a tint
            const v = Math.max(d[0], d[1], d[2]);
            m.mt.color.setRGB(m.base.r * Math.min(1, d[0] / (v || 1)), m.base.g * Math.min(1, d[1] / (v || 1)), m.base.b * Math.min(1, d[2] / (v || 1)));
            m.mt.opacity = v * f; m.mt.transparent = true;
          } else if (s.d[m.name] || s.d["*"] || gr.tl) m.mt.color.setRGB(m.base.r * d[0] * f, m.base.g * d[1] * f, m.base.b * d[2] * f);
          const e = get(s.e, m.name); if (e && m.mt.emissive && !m.add) m.mt.emissive.setRGB(e[0], e[1], e[2]);
          if (m.mt.map){
            const to = get(s.uvto, m.name); if (to){ m.mt.map.offset.set(to[0], to[1]); }
            const uv = get(s.uv, m.name); if (uv && dt){ m.mt.map.offset.x += uv[0] * dt; m.mt.map.offset.y += uv[1] * dt; }
          }
        }
        const o = gr.obj;
        if (gr.tl){
          const z = s.zoom || [1, 1, 1];
          if (s.zoomat && dt){ gr.za = (gr.za || [0, 0, 0]).map((x, i) => x + s.zoomat[i] * dt); } else if (!dt) gr.za = [0, 0, 0];
          const za = gr.za || [0, 0, 0];
          o.scale.set(gr.base.scale.x * Math.max(z[0] + za[0], 0.001), gr.base.scale.y * Math.max(z[1] + za[1], 0.001), gr.base.scale.z * Math.max(z[2] + za[2], 0.001));
        }
        if (s.rot && dt){ gr.spin.y += s.rot[0] * Math.PI / 180 * dt; gr.spin.x += s.rot[1] * Math.PI / 180 * dt; gr.spin.z += s.rot[2] * Math.PI / 180 * dt; }
        if (s.rot || s.rotto){
          const rt = s.rotto ? new T.Euler(s.rotto[1] * Math.PI / 180, s.rotto[0] * Math.PI / 180, s.rotto[2] * Math.PI / 180, "YXZ") : new T.Euler();
          const q = new T.Quaternion().setFromEuler(rt).multiply(new T.Quaternion().setFromEuler(gr.spin));
          if (gr.tl) o.quaternion.copy(gr.base.quat).multiply(q);
          else o.children.forEach(c => c.isMesh || c.isGroup ? c.quaternion.copy(q) : 0);
        }
        if (s.bb && gr.tl && o.parent){   // face the camera
          const pq = new T.Quaternion(); o.parent.getWorldQuaternion(pq);
          o.quaternion.copy(pq.invert().multiply(cam.quaternion));
        }
      }
      if (root) root.updateMatrixWorld(true);
      for (const ps of systems){
        const et = efxTime(ps.def, t);
        stepParticles(T, ps, t, dt, root.matrixWorld.clone().multiply(new T.Matrix4().fromArray(ps.def.m)), et ? et.a : 1);
      }
    }
    function warm(t){   // run the particles up to time t so a still frame has particles in it
      const from = Math.max(0, t - 1500);
      for (let x = from; x < t; x += 33) apply(x, 0.033);
    }
    const loop = now => {
      if (!alive) return;
      if (!box.isConnected){ _m3dStop && _m3dStop(); _m3dStop = null; return; }
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (fxOn){ clock += dt * 1000; apply(clock, dt); }
      for (const ps of systems) for (const g of ps.groups) g.mat.uniforms.uScale.value = pxScale();
      ctl.update(); r.render(scene, cam); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { r.setSize(w(), h()); cam.aspect = w() / h(); cam.updateProjectionMatrix(); }); ro.observe(stage);
    const tog = (k, fn) => { const b = box.querySelector(`[data-m3d="${k}"]`); b.onclick = () => { M3D[k] = !M3D[k]; store("od2-m3d", M3D);
      b.classList.toggle("on", M3D[k]); b.setAttribute("aria-pressed", M3D[k]); fn(M3D[k]); }; };
    tog("spin", on => ctl.autoRotate = on);
    tog("anim", on => on ? loadFx() : unloadFx());
    box.querySelector('[data-m3d="reset"]').onclick = () => { if (home){ cam.position.copy(home); ctl.target.set(0, 0, 0); ctl.update(); } };
    _m3dStop = () => { alive = false; ro.disconnect(); ctl.dispose(); r.dispose(); r.forceContextLoss?.(); };
  }).catch(() => { stage.innerHTML = `<div class="m3d-load">3D viewer not available.</div>`; });
}
