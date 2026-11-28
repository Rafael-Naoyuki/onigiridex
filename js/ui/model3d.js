"use strict";
/* OnigiriDex — 3D weapon model viewer. three.js is loaded only when a page shows a model. */
const modelOf = i => (window.WEAPON_MODELS || {})[D.wid?.[i]];
let _three = null;
function loadThree(){
  if (_three) return _three;
  const add = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  return _three = add("vendor/three/three.min.js").then(() => Promise.all([add("vendor/three/GLTFLoader.js"), add("vendor/three/OrbitControls.js")]));
}
const modelPanel = i => modelOf(i) ? `<div class="m3d" id="m3d" data-model="${modelOf(i)}">
  <div class="m3d-stage"><div class="m3d-load">Loading 3D model…</div></div>
  <div class="m3d-bar"><span class="m3d-hint">Drag to rotate · scroll to zoom</span><span class="sp"></span>
    <button type="button" class="btn sm" data-m3d="spin" aria-pressed="true">Auto-rotate</button><button type="button" class="btn sm" data-m3d="reset">Reset view</button></div></div>` : "";
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
    const ctl = new T.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 2;
    let home = null, alive = true;
    new T.GLTFLoader().load(`models/${box.dataset.model}.glb`, g => {
      if (!alive) return;
      const m = g.scene; m.rotation.x = Math.PI / 2;                   // the game's long axis is Z; stand it up
      const b = new T.Box3().setFromObject(m), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3());
      m.position.sub(c); scene.add(m);
      const d = Math.max(s.x, s.y, s.z) / (2 * Math.tan(cam.fov * Math.PI / 360)) * 1.15;
      home = [new T.Vector3(d * 0.55, d * 0.15, d * 0.85)]; cam.position.copy(home[0]); cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix();
      ctl.target.set(0, 0, 0); ctl.update();
      stage.innerHTML = ""; stage.appendChild(r.domElement);
    }, undefined, () => { stage.innerHTML = `<div class="m3d-load">Could not load the model.</div>`; });
    const loop = () => { if (!alive) return; if (!box.isConnected){ _m3dStop && _m3dStop(); _m3dStop = null; return; } ctl.update(); r.render(scene, cam); requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => { r.setSize(w(), h()); cam.aspect = w() / h(); cam.updateProjectionMatrix(); }); ro.observe(stage);
    box.querySelector('[data-m3d="spin"]').onclick = e => { ctl.autoRotate = !ctl.autoRotate; e.currentTarget.setAttribute("aria-pressed", ctl.autoRotate); e.currentTarget.classList.toggle("on", ctl.autoRotate); };
    box.querySelector('[data-m3d="reset"]').onclick = () => { if (home){ cam.position.copy(home[0]); ctl.target.set(0, 0, 0); ctl.update(); } };
    box.querySelector('[data-m3d="spin"]').classList.add("on");
    _m3dStop = () => { alive = false; ro.disconnect(); ctl.dispose(); r.dispose(); r.forceContextLoss?.(); };
  }).catch(() => { stage.innerHTML = `<div class="m3d-load">3D viewer not available.</div>`; });
}
