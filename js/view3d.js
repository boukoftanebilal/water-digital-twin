/* 3D view of a plant (three.js r128): the 2D plan is laid on the floor and every component is extruded into a
   3D model driven by the same bindings as the schematic. */
'use strict';

TW.View3D = class {
  constructor(host, ds, plant, opts = {}) {
    this.ds = ds; this.p = plant; this.opts = opts; this.host = host;
    this.anim = []; this.pickables = []; this.runState = {}; this.labelSprites = [];
    const [W, H] = plant.vb;
    this.S = 40; this.cx = W / 2; this.cy = H / 2;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(r.domElement);
    r.domElement.classList.add('plant3d');
    const sc = (this.scene = new THREE.Scene());
    sc.background = new THREE.Color('#0a1020');
    sc.fog = new THREE.Fog('#0a1020', 40, 110);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    const span = Math.max(W, H) / this.S;
    this.camera.position.set(0, span * 0.56, span * 0.72);
    this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.42; this.controls.minDistance = 4; this.controls.maxDistance = span * 2.2;
    this.controls.target.set(0, 0, 0.3);
    sc.add(new THREE.HemisphereLight(0xc8dcff, 0x101828, 0.55));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 0.85));
    sun.position.set(-span * 0.4, span * 0.9, span * 0.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sh = sun.shadow.camera; sh.left = -span; sh.right = span; sh.top = span; sh.bottom = -span; sh.far = span * 4;
    sc.add(sun);
    this.alarmLight = new THREE.PointLight(0xff2a3a, 0, span * 2);
    this.alarmLight.position.set(0, span * 0.35, 0);
    sc.add(this.alarmLight);
    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 4, span * 4), new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
    sc.add(ground);
    const grid = new THREE.GridHelper(span * 2.2, 44, 0x1a2a44, 0x131f33);
    grid.position.y = -0.01; sc.add(grid);
    this.flowTex = this.makeFlowTexture();
    (plant.zones || []).forEach(z => this.zone(z));
    (plant.pipes || []).forEach(pp => this.pipe(pp));
    (plant.comps || []).forEach(c => this.comp(c));
    (plant.tags || []).forEach(t => this.tag(t));
    this.beacon();
    this.raycaster = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    r.domElement.addEventListener('click', e => this.onClick(e));
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(host);
  }

  P(x, y, h = 0) { return new THREE.Vector3((x - this.cx) / this.S, h, (y - this.cy) / this.S); }
  L(px) { return px / this.S; }
  mat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.35 }, o)); }
  mesh(geo, m, pos, cast = true) {
    const me = new THREE.Mesh(geo, m);
    if (pos) me.position.copy(pos);
    me.castShadow = cast; me.receiveShadow = true;
    return me;
  }
  bind(b) { return TW.View2D.prototype.bind.call(this, b); }
  val(bd, st) { return TW.View2D.prototype.val.call(this, bd, st); }

  makeFlowTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, 64, 8);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, 0, 22, 8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  textSprite(text, opts = {}) {
    const c = document.createElement('canvas');
    const W = opts.w || 512, H = opts.h || 128;
    c.width = W; c.height = H;
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const draw = (lines, border) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, W, H);
      if (opts.box !== false) {
        g.fillStyle = 'rgba(10,17,30,0.86)';
        g.strokeStyle = border || 'rgba(120,150,200,0.6)'; g.lineWidth = 6;
        const r = 22;
        g.beginPath(); g.moveTo(r, 3); g.lineTo(W - r, 3); g.quadraticCurveTo(W - 3, 3, W - 3, r); g.lineTo(W - 3, H - r); g.quadraticCurveTo(W - 3, H - 3, W - r, H - 3);
        g.lineTo(r, H - 3); g.quadraticCurveTo(3, H - 3, 3, H - r); g.lineTo(3, r); g.quadraticCurveTo(3, 3, r, 3); g.closePath(); g.fill(); g.stroke();
      }
      const L = Array.isArray(lines) ? lines : [lines];
      g.textAlign = 'center'; g.textBaseline = 'middle';
      L.forEach((t, i) => {
        g.fillStyle = i === 0 && L.length > 1 ? '#9fb0cc' : (opts.color || '#e8eefc');
        g.font = (i === 0 && L.length > 1 ? '600 ' + Math.round(H * 0.3) : '700 ' + Math.round(H * (L.length > 1 ? 0.36 : 0.42))) + 'px Inter, system-ui, sans-serif';
        g.fillText(t, W / 2, L.length > 1 ? H * (0.32 + i * 0.38) : H / 2);
      });
      tex.needsUpdate = true;
    };
    draw(text);
    sp.userData.draw = draw;
    const sx = opts.scale || 1.6;
    sp.scale.set(sx, (sx * H) / W, 1);
    return sp;
  }

  /* ---------------------------------------------------------------- zones and pipes */
  zone(z) {
    const g = new THREE.Group();
    const w = this.L(z.w), d = this.L(z.h);
    const slab = this.mesh(new THREE.BoxGeometry(w, 0.06, d), this.mat(0x111b2d, { roughness: 0.95, metalness: 0 }), this.P(z.x + z.w / 2, z.y + z.h / 2, 0.03), false);
    g.add(slab);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.06, d)), new THREE.LineBasicMaterial({ color: new THREE.Color(z.col || '#2a3a55') }));
    edge.position.copy(slab.position); g.add(edge);
    const lab = this.textSprite(z.label, { scale: 4.4, h: 96, w: 640, color: TW.mix(z.col || '#cfd8ea', '#ffffff', 0.4) });
    lab.position.copy(this.P(z.x + z.w * 0.5, z.y + 10, 0.9));
    g.add(lab);
    this.scene.add(g);
  }

  pipe(pp) {
    if (pp.k === 'signal') {
      const pts = pp.pts.map(p => this.P(p[0], p[1], 0.12));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x7f8ca6, dashSize: 0.25, gapSize: 0.18 }));
      line.computeLineDistances();
      this.scene.add(line);
      return;
    }
    const h = pp.k === 'power' ? 0.7 : pp.k === 'shaft' ? 0.55 : 0.32;
    const rad = this.L(pp.w || (pp.k === 'power' ? 3 : 6)) * 0.55;
    const path = new THREE.CurvePath();
    const pts = pp.pts.map(p => this.P(p[0], p[1], h));
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) { path.add(new THREE.LineCurve3(pts[i], pts[i + 1])); len += pts[i].distanceTo(pts[i + 1]); }
    const seg = Math.max(8, Math.round(len * 6));
    const col = new THREE.Color(TW.FLUID[pp.k] || '#39b6ff');
    const body = this.mesh(new THREE.TubeGeometry(path, seg, rad, 10, false), this.mat(pp.k === 'power' ? 0x5a4a1a : 0x33435e, { metalness: 0.6, roughness: 0.35 }));
    this.scene.add(body);
    if (pp.k === 'power') {
      // transmission poles
      for (let i = 0; i < pts.length; i++) {
        const pole = this.mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6), this.mat(0x6d5a2a), pts[i].clone().setY(0.35));
        this.scene.add(pole);
      }
    }
    const tex = this.flowTex.clone(); tex.needsUpdate = true;
    tex.repeat.set(len * 2.2, 1);
    const flowMat = new THREE.MeshBasicMaterial({ color: col, map: tex, transparent: true, opacity: 0.9, depthWrite: false });
    const flow = new THREE.Mesh(new THREE.TubeGeometry(path, seg, rad * 1.12, 10, false), flowMat);
    this.scene.add(flow);
    const fb = this.bind(pp.f);
    const tint = pp.tint ? this.ds.chIndex[pp.tint] : undefined;
    this.anim.push((st, dt) => {
      const v = this.val(fb, st);
      tex.offset.x -= dt * (0.2 + 2.6 * v) * (v > 0.02 ? 1 : 0);
      flowMat.opacity = 0.2 + 0.75 * Math.min(1, v * 1.4);
      if (tint !== undefined) {
        const ch = this.ds.meta.channels[tint];
        const tt = TW.clamp((st.vals[tint] - ch.dlo) / (ch.dhi - ch.dlo || 1), 0, 1.5);
        flowMat.color.set(TW.mix('#39b6ff', '#c9a86a', TW.clamp((tt - 0.6) * 1.2, 0, 1)));
      }
    });
  }

  /* ---------------------------------------------------------------- components */
  comp(c) {
    const fn = this['m_' + c.t];
    if (!fn) return;
    const g = new THREE.Group();
    fn.call(this, c, g);
    this.scene.add(g);
    const chs = new Set(c.chs || []);
    ['op', 'lv', 'run', 'spd', 'pow', 'load', 'moist', 'on', 'int'].forEach(k => { if (c[k] && c[k].ch) chs.add(c[k].ch); });
    (c.rows || []).forEach(r => r.chs.forEach(x => chs.add(x)));
    (c.items || []).forEach(it => chs.add(it.ch));
    const list = [...chs];
    g.traverse(o => { if (o.isMesh) { o.userData.pick = { chs: list, label: c.label || c.id }; this.pickables.push(o); } });
    const idx = list.map(x => this.ds.chIndex[x]).filter(j => j !== undefined);
    if (idx.length && !['greenhouse', 'lamp'].includes(c.t)) {
      // deviation / event glow ring on the floor
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      const rr = Math.min(1.5, Math.max(0.35, Math.max(size.x, size.z) * 0.55));
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.12, 40),
        new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      const ctr = box.getCenter(new THREE.Vector3());
      ring.position.set(ctr.x, 0.08, ctr.z);
      this.scene.add(ring);
      this.anim.push(st => {
        let m = 0, ev = false, inj = false;
        for (const j of idx) { const a = Math.abs(st.z[j]); if (a > m) m = a; if (st.evTop === j) ev = true; if (st.inj && st.inj.has(j)) inj = true; }
        ring.material.opacity = ev ? 0.55 + 0.35 * Math.sin(st.t * 6) : inj ? 0.6 : m >= 4 ? 0.5 : m >= 2 ? 0.25 : 0;
        ring.material.color.set(ev ? '#ff3b4e' : inj ? '#b06bff' : TW.colorDev(m));
      });
    }
    if (c.label && !['node', 'lamp', 'greenhouse', 'sun'].includes(c.t)) {
      const box = new THREE.Box3().setFromObject(g);
      const lab = this.textSprite(c.label, { scale: 1.9, h: 72, w: 512, box: false, color: '#c8d4ea' });
      lab.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.32, (box.min.z + box.max.z) / 2);
      lab.material.opacity = 0.85;
      this.scene.add(lab);
    }
  }

  m_tank(c, g) {
    const rad = Math.min(1.7, this.L(c.w) * 0.5), hgt = Math.min(3.2, Math.max(0.8, this.L(c.h) * 0.85));
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, 0);
    const glass = this.mesh(new THREE.CylinderGeometry(rad, rad, hgt, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x9ec8ff, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false }), pos.clone().setY(hgt / 2), false);
    const rim = this.mesh(new THREE.TorusGeometry(rad, 0.035, 8, 40), this.mat(0x8ea0bf, { metalness: 0.8 }), pos.clone().setY(hgt));
    rim.rotation.x = Math.PI / 2;
    const base = this.mesh(new THREE.CylinderGeometry(rad * 1.04, rad * 1.04, 0.08, 40), this.mat(0x3a4862), pos.clone().setY(0.04));
    const liqCol = c.liq === 'hot' ? 0xff8a3d : c.liq === 'nutrient' ? 0x4fd18a : 0x2f9be6;
    const water = this.mesh(new THREE.CylinderGeometry(rad * 0.94, rad * 0.94, 1, 40), new THREE.MeshPhysicalMaterial({ color: liqCol, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1, emissive: liqCol, emissiveIntensity: 0.12 }), pos.clone(), false);
    g.add(base, water, glass, rim);
    if (c.heater) {
      const coil = this.mesh(new THREE.TorusGeometry(rad * 0.6, 0.05, 8, 30), this.mat(0xff5a2a, { emissive: 0xff3a10, emissiveIntensity: 1.2 }), pos.clone().setY(0.18));
      coil.rotation.x = Math.PI / 2; g.add(coil);
      this.anim.push(st => { coil.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(st.t * 3); });
    }
    const lb = typeof c.lv === 'number' ? { c: c.lv } : this.bind(c.lv);
    let cur = 0.6;
    this.anim.push((st, dt) => {
      cur = TW.smooth(cur, lb ? this.val(lb, st) : 0.6, dt, 5);
      const l = Math.max(0.04, 0.04 + 0.92 * cur) * (hgt - 0.1);
      water.scale.y = l; water.position.y = 0.08 + l / 2;
    });
  }

  m_pump(c, g) {
    const r = Math.max(0.18, this.L(c.r) * 0.9);
    const pos = this.P(c.x, c.y, r + 0.05);
    const volute = this.mesh(new THREE.CylinderGeometry(r, r, r * 0.9, 28), this.mat(0x4a6fa5, { metalness: 0.6, roughness: 0.35 }), pos);
    volute.rotation.x = Math.PI / 2;
    const motor = this.mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 1.6, 24), this.mat(0x2b3a54, { metalness: 0.5 }), pos.clone().add(new THREE.Vector3(0, 0, -r * 1.25)));
    motor.rotation.x = Math.PI / 2;
    const fan = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const b = this.mesh(new THREE.BoxGeometry(r * 0.16, r * 1.3, 0.03), this.mat(0xc9d6ee, { metalness: 0.7 }));
      b.rotation.z = (k * Math.PI) / 4; fan.add(b);
    }
    fan.position.copy(pos.clone().add(new THREE.Vector3(0, 0, r * 0.48)));
    const led = this.mesh(new THREE.SphereGeometry(r * 0.16, 12, 12), new THREE.MeshStandardMaterial({ color: 0x2fd38a, emissive: 0x2fd38a, emissiveIntensity: 1 }), pos.clone().add(new THREE.Vector3(0, r * 1.05, 0)));
    const foot = this.mesh(new THREE.BoxGeometry(r * 2, 0.06, r * 3.2), this.mat(0x1c2638), this.P(c.x, c.y, 0.03).add(new THREE.Vector3(0, 0, -r * 0.6)));
    g.add(foot, volute, motor, fan, led);
    const rb = c.run ? this.bind(c.run) : null, sb = c.spd ? this.bind(c.spd) : null;
    let spd = 0;
    this.anim.push((st, dt) => {
      let on;
      if (rb) on = rb.j !== undefined ? (st.vals[rb.j] > 0.5 ? 1 : 0) : 1;
      else if (sb) on = this.val(sb, st);
      else on = 1;
      this.runState[c.id] = on > 0.02 ? Math.max(on, rb ? 1 : 0.15) : 0;
      spd = TW.smooth(spd, on, dt, 3);
      fan.rotation.z += dt * 14 * spd;
      led.material.color.set(on > 0.02 ? '#2fd38a' : '#3b475c');
      led.material.emissive.set(on > 0.02 ? '#2fd38a' : '#000000');
    });
  }

  m_valve(c, g) {
    const k = this.L((c.s || 1) * 9) * 1.2;
    const h = c.o !== 'v';
    const pos = this.P(c.x, c.y, 0.32);
    const m = this.mat(0x39b6ff, { metalness: 0.5 });
    const c1 = this.mesh(new THREE.ConeGeometry(k, k * 1.4, 20), m), c2 = this.mesh(new THREE.ConeGeometry(k, k * 1.4, 20), m);
    if (h) { c1.rotation.z = Math.PI / 2; c2.rotation.z = -Math.PI / 2; c1.position.copy(pos).add(new THREE.Vector3(-k * 0.7, 0, 0)); c2.position.copy(pos).add(new THREE.Vector3(k * 0.7, 0, 0)); }
    else { c1.rotation.x = Math.PI / 2; c2.rotation.x = -Math.PI / 2; c1.position.copy(pos).add(new THREE.Vector3(0, 0, -k * 0.7)); c2.position.copy(pos).add(new THREE.Vector3(0, 0, k * 0.7)); }
    const stem = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, k * 2.2, 8), this.mat(0x9fb0cc), pos.clone().add(new THREE.Vector3(0, k * 1.1, 0)));
    const wheel = this.mesh(new THREE.TorusGeometry(k * 0.75, 0.04, 8, 24), this.mat(0xff5a5a, { metalness: 0.3 }), pos.clone().add(new THREE.Vector3(0, k * 2.2, 0)));
    wheel.rotation.x = Math.PI / 2;
    g.add(c1, c2, stem, wheel);
    const ob = this.bind(c.op);
    let cur = 1;
    this.anim.push((st, dt) => {
      let target = ob ? this.val(ob, st) : 1;
      if (c.evClose && st.evSeg && st.evSeg.startsWith(c.evClose)) target = 0.12;
      const prev = cur;
      cur = TW.smooth(cur, target, dt, 2);
      wheel.rotation.z += (cur - prev) * 12;
      m.color.set(TW.mix('#3a465c', '#39b6ff', cur));
    });
  }

  m_hx(c, g) {
    const w = this.L(c.w), d = this.L(c.h);
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, 0.45);
    const shell = this.mesh(new THREE.CylinderGeometry(d * 0.42, d * 0.42, w, 28), this.mat(0x6b7d99, { metalness: 0.7, roughness: 0.3 }), pos);
    shell.rotation.z = Math.PI / 2;
    const band1 = this.mesh(new THREE.TorusGeometry(d * 0.43, 0.04, 8, 28), this.mat(0xff8a3d, { emissive: 0xff6a20, emissiveIntensity: 0.6 }), pos.clone().add(new THREE.Vector3(-w * 0.3, 0, 0)));
    const band2 = band1.clone(); band2.position.copy(pos).add(new THREE.Vector3(w * 0.3, 0, 0));
    band1.rotation.y = Math.PI / 2; band2.rotation.y = Math.PI / 2;
    const legs = [-0.35, 0.35].map(f => this.mesh(new THREE.BoxGeometry(0.08, 0.45, d * 0.5), this.mat(0x2b364a), pos.clone().add(new THREE.Vector3(w * f, -0.22, 0))));
    g.add(shell, band1, band2, ...legs);
  }

  m_cooler(c, g) {
    const w = this.L(c.w), d = this.L(c.h) * 1.4;
    const box = this.mesh(new THREE.BoxGeometry(w, 0.6, d), this.mat(0x3a4862), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.3));
    const fan = new THREE.Group();
    for (let k = 0; k < 3; k++) { const b = this.mesh(new THREE.BoxGeometry(d * 0.8, 0.02, 0.1), this.mat(0x68e0ff, { emissive: 0x2a8fb0, emissiveIntensity: 0.4 })); b.rotation.y = (k * Math.PI) / 3; fan.add(b); }
    fan.position.copy(this.P(c.x + c.w / 2, c.y + c.h / 2, 0.62));
    g.add(box, fan);
    this.anim.push((st, dt) => { fan.rotation.y += dt * 6; });
  }

  m_motor(c, g) {
    const w = this.L(c.w), d = this.L(c.h);
    const body = this.mesh(new THREE.CylinderGeometry(d * 0.5, d * 0.5, w, 24), this.mat(0x2b3a54, { metalness: 0.6 }), this.P(c.x + c.w / 2, c.y + c.h / 2, d * 0.55));
    body.rotation.z = Math.PI / 2;
    for (let k = -3; k <= 3; k++) {
      const fin = this.mesh(new THREE.TorusGeometry(d * 0.52, 0.02, 6, 24), this.mat(0x5b6b86), body.position.clone().add(new THREE.Vector3((k * w) / 8, 0, 0)));
      fin.rotation.y = Math.PI / 2; g.add(fin);
    }
    g.add(body);
  }

  m_gauge(c, g) {
    const post = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), this.mat(0x9fb0cc), this.P(c.x, c.y, 0.3));
    const dial = this.mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), this.mat(0xe8eefc, { metalness: 0.2 }), this.P(c.x, c.y, 0.7));
    dial.rotation.x = Math.PI / 2;
    g.add(post, dial);
  }
  m_fm(c, g) {
    g.add(this.mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), this.mat(0x1f9e89, { metalness: 0.4 }), this.P(c.x, c.y, 0.35)));
  }
  m_probe(c, g) {
    g.add(this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), this.mat(0x9fb0cc), this.P(c.x, c.y, 0.35)),
      this.mesh(new THREE.SphereGeometry(0.1, 12, 12), this.mat(0xffc145), this.P(c.x, c.y, 0.72)));
  }
  m_analyser(c, g) {
    g.add(this.mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), this.mat(0x18263d), this.P(c.x, c.y - 16, 0.4)),
      this.mesh(new THREE.PlaneGeometry(0.42, 0.22), new THREE.MeshBasicMaterial({ color: 0x1f9e89 }), this.P(c.x, c.y - 16, 0.55).add(new THREE.Vector3(0, 0, 0.18))));
  }
  m_dcs(c, g) {
    const w = this.L(c.w), d = this.L(c.h);
    const cab = this.mesh(new THREE.BoxGeometry(w * 0.9, 1.2, 0.5), this.mat(0x101a2c), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.6));
    const scr = this.mesh(new THREE.PlaneGeometry(w * 0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0x14365c }), cab.position.clone().add(new THREE.Vector3(0, 0.1, 0.26)));
    g.add(cab, scr);
    const leds = c.rows.map((r, i) => {
      const led = this.mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshStandardMaterial({ color: 0x2fd38a, emissive: 0x2fd38a, emissiveIntensity: 1 }), cab.position.clone().add(new THREE.Vector3(-w * 0.32 + i * 0.3, -0.42, 0.27)));
      g.add(led); return { led, idx: r.chs.map(x => this.ds.chIndex[x]) };
    });
    this.anim.push(st => leds.forEach(l => {
      let m = 0, ev = false; for (const j of l.idx) { m = Math.max(m, Math.abs(st.z[j])); if (st.evTop === j) ev = true; }
      const col = ev ? '#ff3b4e' : TW.colorDev(m); l.led.material.color.set(col); l.led.material.emissive.set(col);
    }));
  }
  m_lamps(c, g) {
    const items = c.items.map((it, i) => {
      const led = this.mesh(new THREE.SphereGeometry(0.11, 14, 14), new THREE.MeshStandardMaterial({ color: 0x1b2434, emissive: 0x000000 }), this.P(c.x + 12 + i * 38, c.y, 0.5));
      const post = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), this.mat(0x5b6b86), this.P(c.x + 12 + i * 38, c.y, 0.2));
      g.add(led, post);
      return { led, j: this.ds.chIndex[it.ch], bad: it.bad };
    });
    this.anim.push(st => items.forEach(it => {
      const on = st.vals[it.j] > 0.5, col = on ? (it.bad ? '#ff4d5e' : '#2fd38a') : '#1b2434';
      it.led.material.color.set(col); it.led.material.emissive.set(on ? col : '#000000');
    }));
  }
  m_rotor(c, g) {
    const y = c.y + c.h / 2;
    const plate = this.mesh(new THREE.BoxGeometry(this.L(c.w), 0.08, 1.1), this.mat(0x1c2638), this.P(c.x + c.w / 2, y, 0.04));
    const motor = this.mesh(new THREE.BoxGeometry(this.L(64), 0.7, 0.7), this.mat(0x2b3a54, { metalness: 0.6 }), this.P(c.x + 40, y, 0.43));
    const shaftLen = this.L(c.w - 94);
    const shaft = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, shaftLen, 12), this.mat(0xb9c6dc, { metalness: 0.9, roughness: 0.2 }), this.P(c.x + 84 + (c.w - 94) / 2, y, 0.45));
    shaft.rotation.z = Math.PI / 2;
    g.add(plate, motor, shaft);
    [0.38, 0.86].forEach(f => g.add(this.mesh(new THREE.BoxGeometry(0.28, 0.5, 0.5), this.mat(0x3a4862), this.P(c.x + c.w * f, y, 0.3))));
    const discs = [0.55, 0.7].map(f => {
      const d = new THREE.Group();
      const disc = this.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 32), this.mat(0x8ea0bf, { metalness: 0.9, roughness: 0.25 }));
      disc.rotation.z = Math.PI / 2;
      const mark = this.mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.mat(0xff8a3d, { emissive: 0xff6a20, emissiveIntensity: 0.6 }), new THREE.Vector3(0.05, 0.3, 0));
      d.add(disc, mark); d.position.copy(this.P(c.x + c.w * f, y, 0.45)); g.add(d);
      return d;
    });
    const sb = this.bind(c.spd);
    this.anim.push((st, dt) => { const v = this.val(sb, st); discs.forEach(d => { d.rotation.x += dt * 30 * v; }); });
  }
  m_turbine(c, g) {
    const w = this.L(c.w), d = this.L(c.h);
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, d * 0.5);
    const housing = c.hydro
      ? this.mesh(new THREE.CylinderGeometry(d * 0.48, d * 0.48, w * 0.6, 28), this.mat(0x355c7d, { metalness: 0.5 }), pos)
      : this.mesh(new THREE.CylinderGeometry(d * 0.3, d * 0.5, w, 28), this.mat(0x6b7d99, { metalness: 0.7 }), pos);
    housing.rotation.z = Math.PI / 2;
    const rot = new THREE.Group();
    for (let k = 0; k < 6; k++) { const b = this.mesh(new THREE.BoxGeometry(0.04, d * 0.8, 0.12), this.mat(0xe6edf8, { metalness: 0.8 })); b.rotation.x = (k * Math.PI) / 3; rot.add(b); }
    rot.position.copy(pos).add(new THREE.Vector3(w * 0.52, 0, 0));
    g.add(housing, rot);
    const sb = this.bind(c.spd);
    this.anim.push((st, dt) => { rot.rotation.x += dt * (1 + 10 * this.val(sb, st)); });
  }
  m_gen(c, g) {
    const r = this.L(c.r);
    const body = this.mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, r * 1.4, 28), this.mat(0x3a4862, { metalness: 0.6, emissive: 0xffb300, emissiveIntensity: 0.1 }), this.P(c.x, c.y, r * 0.85));
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const pb = this.bind(c.pow);
    this.anim.push(st => { body.material.emissiveIntensity = 0.05 + 0.7 * this.val(pb, st); });
  }
  m_bus(c, g) {
    g.add(this.mesh(new THREE.BoxGeometry(0.2, 1.4, this.L(c.h)), this.mat(0xffd166, { emissive: 0xffb300, emissiveIntensity: 0.35 }), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.7)));
  }
  m_city(c, g) {
    const widths = [26, 18, 30, 22, 28, 20, 24];
    let x = c.x;
    const mats = [];
    widths.forEach((w, i) => {
      const hgt = 0.6 + ((i * 37) % 60) / 30;
      const m = this.mat(0x1b2638, { emissive: 0xffd166, emissiveIntensity: 0.1, roughness: 0.8 });
      const b = this.mesh(new THREE.BoxGeometry(this.L(w), hgt, this.L(w)), m, this.P(x + w / 2, c.y + c.h / 2 + ((i % 3) - 1) * 18, hgt / 2));
      g.add(b); mats.push(m); x += w + 2;
    });
    const lb = this.bind(c.load);
    this.anim.push(st => { const v = this.val(lb, st); mats.forEach((m, i) => { m.emissiveIntensity = 0.02 + 0.22 * v * (0.6 + 0.4 * ((i * 7) % 5) / 5); }); });
  }
  m_reservoir(c, g) {
    const w = this.L(c.w), d = this.L(c.h);
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, 0);
    const wallM = this.mat(0x3a465c, { roughness: 0.9, metalness: 0.1 });
    [[w, 0.6, 0.08, 0, -d / 2], [w, 0.6, 0.08, 0, d / 2], [0.08, 0.6, d, -w / 2, 0], [0.08, 0.6, d, w / 2, 0]].forEach(([a, b, cc, ox, oz]) => {
      g.add(this.mesh(new THREE.BoxGeometry(a, b, cc), wallM, pos.clone().add(new THREE.Vector3(ox, 0.3, oz))));
    });
    const water = this.mesh(new THREE.BoxGeometry(w * 0.97, 0.45, d * 0.97), new THREE.MeshPhysicalMaterial({ color: 0x2f9be6, transparent: true, opacity: 0.8, roughness: 0.1 }), pos.clone().setY(0.24), false);
    g.add(water);
    if (c.dam) g.add(this.mesh(new THREE.BoxGeometry(0.4, 1.1, d * 1.1), this.mat(0x6d7f9f, { roughness: 0.9 }), pos.clone().add(new THREE.Vector3(w / 2 + 0.2, 0.55, 0))));
    this.anim.push(st => { water.position.y = 0.24 + 0.02 * Math.sin(st.t * 1.5); });
  }
  m_building(c, g) {
    const w = this.L(c.w), d = this.L(c.h) * 0.9;
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, 0);
    const body = this.mesh(new THREE.BoxGeometry(w, 1.1, d), this.mat(0x1d2b45, { roughness: 0.8 }), pos.clone().setY(0.55));
    const roof = this.mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 0.55, 4), this.mat(0x2d3c57), pos.clone().setY(1.38));
    roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    g.add(body, roof);
    for (let k = 0; k < 4; k++) g.add(this.mesh(new THREE.PlaneGeometry(w / 6, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7 }), pos.clone().add(new THREE.Vector3(-w * 0.35 + k * w / 4.4, 0.7, d / 2 + 0.01))));
    if (c.rack) for (let k = 0; k < 5; k++) g.add(this.mesh(new THREE.BoxGeometry(w / 7, 0.7, 0.2), this.mat(0x1f9e89, { emissive: 0x0f5c50, emissiveIntensity: 0.6 }), pos.clone().add(new THREE.Vector3(-w * 0.36 + k * w / 5.6, 0.45, d / 2 + 0.12))));
  }
  m_town(c, g) {
    for (let k = 0; k < 6; k++) {
      const pos = this.P(c.x + (k % 3) * 26 + 10, c.y + Math.floor(k / 3) * 38 + 30, 0);
      g.add(this.mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), this.mat(0x1b2638, { emissive: 0xffd166, emissiveIntensity: 0.12 }), pos.clone().setY(0.2)));
      const roof = this.mesh(new THREE.ConeGeometry(0.38, 0.3, 4), this.mat(0x7a3b3b), pos.clone().setY(0.55)); roof.rotation.y = Math.PI / 4; g.add(roof);
    }
  }
  m_source(c, g) {
    g.add(this.mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.6, 20), this.mat(0x3a465c), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.3)),
      this.mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0x39b6ff }), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.61)));
  }
  m_sun(c, g) {
    const s = this.mesh(new THREE.SphereGeometry(0.7, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffcf4a }), this.P(c.x, c.y - 60, 7), false);
    g.add(s);
    const ib = this.bind(c.int);
    this.anim.push(st => { const v = this.val(ib, st); this.sun.intensity = 0.35 + 0.8 * v; s.material.color.set(TW.mix('#5b5f6b', '#ffcf4a', 0.25 + 0.75 * v)); });
  }
  m_greenhouse(c, g) {
    const w = this.L(c.w), d = this.L(c.h), hgt = 2.4;
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2, 0);
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xbfeedd, transparent: true, opacity: 0.08, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), glassM); box.position.copy(pos).setY(hgt / 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, hgt, d)), new THREE.LineBasicMaterial({ color: 0x7cc4a0, transparent: true, opacity: 0.6 }));
    edges.position.copy(box.position);
    const roofShape = new THREE.Shape(); roofShape.moveTo(-d / 2, 0); roofShape.lineTo(0, 0.9); roofShape.lineTo(d / 2, 0); roofShape.lineTo(-d / 2, 0);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: w, bevelEnabled: false }), glassM);
    roof.rotation.y = Math.PI / 2; roof.position.copy(pos).add(new THREE.Vector3(-w / 2, hgt, 0));
    const redges = new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), new THREE.LineBasicMaterial({ color: 0x7cc4a0, transparent: true, opacity: 0.6 }));
    redges.rotation.copy(roof.rotation); redges.position.copy(roof.position);
    g.add(box, edges, roof, redges);
  }
  m_lamp(c, g) {
    const w = this.L(c.w);
    const pos = this.P(c.x + c.w / 2, c.y + 80, 2.1);
    const bar = this.mesh(new THREE.BoxGeometry(w, 0.08, 0.25), new THREE.MeshStandardMaterial({ color: 0x4b5568, emissive: 0x000000 }), pos, false);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.55, 1.9, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.copy(pos).add(new THREE.Vector3(0, -0.95, 0)); cone.rotation.y = Math.PI / 4;
    g.add(bar, cone);
    const ob = this.bind(c.on);
    this.anim.push(st => { const on = st.vals[ob.j] > 0.5; cone.material.opacity = on ? 0.12 : 0; bar.material.emissive.set(on ? '#ffe08a' : '#000000'); });
  }
  m_bed(c, g) {
    const w = this.L(c.w), d = this.L(c.h) * 1.4;
    const pos = this.P(c.x + c.w / 2, c.y + c.h / 2 - 20, 0);
    const soilM = this.mat(0x6b4a2f, { roughness: 1, metalness: 0 });
    g.add(this.mesh(new THREE.BoxGeometry(w, 0.3, d), soilM, pos.clone().setY(0.15)));
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) {
      const pl = this.mesh(new THREE.ConeGeometry(0.16, 0.5, 6), this.mat(0x3fbf5a, { roughness: 0.8, metalness: 0 }), pos.clone().add(new THREE.Vector3(-w / 2 + (i + 0.5) * (w / 6), 0.55, (k - 0.5) * d * 0.5)));
      g.add(pl);
    }
    const mb = this.bind(c.moist);
    this.anim.push(st => soilM.color.set(TW.mix('#9a7445', '#2a1a0e', this.val(mb, st))));
  }
  m_envbox(c, g) {
    g.add(this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), this.mat(0x9fb0cc), this.P(c.x + c.w / 2, c.y + c.h / 2, 0.7)),
      this.mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), this.mat(0xe8eefc, { metalness: 0.1 }), this.P(c.x + c.w / 2, c.y + c.h / 2, 1.5)));
  }
  m_node(c, g) { g.add(this.mesh(new THREE.SphereGeometry(0.16, 16, 16), this.mat(0x39b6ff, { metalness: 0.5 }), this.P(c.x, c.y, 0.32))); }

  /* ---------------------------------------------------------------- sensors */
  tag(t) {
    const j = this.ds.chIndex[t.ch];
    if (j === undefined) return;
    const ch = this.ds.meta.channels[j];
    const pos = this.P(t.x, t.y, 0);
    const post = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), this.mat(0x5b6b86), pos.clone().setY(0.5), false);
    const ball = this.mesh(new THREE.SphereGeometry(0.11, 16, 16), new THREE.MeshStandardMaterial({ color: 0x2fd38a, emissive: 0x2fd38a, emissiveIntensity: 0.8 }), pos.clone().setY(1.02), false);
    const sp = this.textSprite([t.label || ch.short, ''], { scale: 1.7, w: 384, h: 140 });
    sp.position.copy(pos).setY(1.62);
    this.scene.add(post, ball, sp);
    [post, ball, sp].forEach(o => { o.userData.pick = { chs: [ch.id], label: ch.id }; this.pickables.push(o); });
    let last = '', lastBorder = '', acc = 0;
    const unit = ch.binary ? '' : ch.unit;
    this.anim.push((st, dt) => {
      const z = st.z[j], ev = st.evTop === j, inj = st.inj && st.inj.has(j);
      const col = ev ? '#ff3b4e' : inj ? '#b06bff' : TW.colorDev(z);
      ball.material.color.set(col); ball.material.emissive.set(col);
      ball.scale.setScalar(ev ? 1.3 + 0.3 * Math.sin(st.t * 8) : 1);
      acc += dt;
      if (acc < 0.2) return;
      acc = 0;
      const v = st.vals[j];
      const txt = ch.binary && (ch.unit === 'on/off' || ch.unit === 'bool') ? (v > 0.5 ? 'ON' : 'OFF') : TW.fmt(v) + (unit ? ' ' + unit : '');
      const border = ev ? '#ff3b4e' : inj ? '#b06bff' : st.sel && st.sel.has(j) ? '#36d6e7' : '';
      if (txt !== last || border !== lastBorder) { sp.userData.draw([(t.label || ch.short) + (ev ? '  ⚠' : inj ? '  ⚡' : ''), txt], border || undefined); last = txt; lastBorder = border; }
    });
  }

  beacon() {
    const [W] = this.p.vb;
    const pos = this.P(W - 40, 40, 0);
    const pole = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), this.mat(0x5b6b86), pos.clone().setY(1.2));
    const lamp = this.mesh(new THREE.SphereGeometry(0.22, 18, 18), new THREE.MeshStandardMaterial({ color: 0x3b2026, emissive: 0x000000 }), pos.clone().setY(2.5));
    this.scene.add(pole, lamp);
    this.anim.push(st => {
      const on = st.alarm;
      const k = on ? 0.5 + 0.5 * Math.sin(st.t * 10) : 0;
      lamp.material.color.set(on ? '#ff2a3a' : '#3b2026');
      lamp.material.emissive.set(on ? '#ff2a3a' : '#000000');
      lamp.material.emissiveIntensity = 0.6 + k;
      this.alarmLight.intensity = on ? 0.6 + 0.8 * k : 0;
    });
  }

  onClick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (hit && this.opts.onPick) {
      const p = hit.object.userData.pick;
      this.opts.onPick(p.chs.map(x => this.ds.chIndex[x]).filter(j => j !== undefined), p.label);
    }
  }

  resize() {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  update(st, dt) {
    for (const f of this.anim) f(st, dt);
    if (this.autoRotate) {
      const a = dt * 0.12, p = this.camera.position, tg = this.controls.target;
      const x = p.x - tg.x, z = p.z - tg.z;
      p.x = tg.x + x * Math.cos(a) - z * Math.sin(a); p.z = tg.z + x * Math.sin(a) + z * Math.cos(a);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this._ro.disconnect();
    this.renderer.dispose();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    this.renderer.domElement.remove();
  }
};
