/* 2D SCADA-style schematic of a plant (SVG), animated from the replayed values */
'use strict';

TW.View2D = class {
  constructor(host, ds, plant, opts = {}) {
    this.ds = ds; this.p = plant; this.opts = opts;
    this.anim = []; this.tagEls = {}; this.compEls = {}; this.runState = {};
    const [W, H] = plant.vb;
    const s = TW.s;
    this.svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plant2d', preserveAspectRatio: 'xMidYMid meet' });
    this.svg.appendChild(this.defs());
    this.gZones = s('g'); this.gPipes = s('g'); this.gComps = s('g'); this.gTags = s('g'); this.gFx = s('g');
    this.svg.append(this.gZones, this.gPipes, this.gComps, this.gTags, this.gFx);
    (plant.zones || []).forEach(z => this.zone(z));
    (plant.pipes || []).forEach(pp => this.pipe(pp));
    (plant.comps || []).forEach(c => this.comp(c));
    (plant.tags || []).forEach(t => this.tag(t));
    this.alarmFrame = s('rect', { x: 3, y: 3, width: W - 6, height: H - 6, rx: 14, class: 'alarm-frame' });
    this.gFx.appendChild(this.alarmFrame);
    host.appendChild(this.svg);
  }

  defs() {
    const s = TW.s;
    const lg = (id, stops, x2 = 0, y2 = 1) => s('linearGradient', { id, x1: 0, y1: 0, x2, y2 },
      stops.map(([o, c, a]) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': a === undefined ? 1 : a })));
    return s('defs', null,
      lg('gMetal', [[0, '#5b6b86'], [0.5, '#34425a'], [1, '#222c3d']]),
      lg('gMetalH', [[0, '#3a4862'], [0.5, '#64748f'], [1, '#2b364a']], 1, 0),
      lg('gGlass', [[0, '#1c2b44', 0.95], [1, '#101a2c', 0.95]], 1, 0),
      lg('gWater', [[0, '#5cc8ff'], [1, '#1166b8']]),
      lg('gHot', [[0, '#ffb070'], [1, '#c4511f']]),
      lg('gNutrient', [[0, '#79e3a5'], [1, '#1f8a54']]),
      lg('gZone', [[0, '#121c2e', 0.92], [1, '#0d1524', 0.92]]),
      lg('gSoil', [[0, '#6b4a2f'], [1, '#3a2717']]),
      lg('gSky', [[0, '#173055', 0.35], [1, '#0d1524', 0]]),
      s('filter', { id: 'fGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
        s('feGaussianBlur', { stdDeviation: 4, result: 'b' }),
        s('feMerge', null, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
      s('filter', { id: 'fSoft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 6 })),
    );
  }

  bind(b) {
    if (b === undefined || b === null) return null;
    if (typeof b === 'number') return { c: b };
    if (b.run) return { run: b.run };
    const j = this.ds.chIndex[b.ch];
    if (j === undefined) return null;
    const ch = this.ds.meta.channels[j];
    const lo = b.lo !== undefined ? b.lo : ch.dlo, hi = b.hi !== undefined ? b.hi : ch.dhi;
    return { j, lo, hi: hi > lo ? hi : lo + 1, ch };
  }
  val(bd, st) {
    if (!bd) return 0;
    if (bd.c !== undefined) return bd.c;
    if (bd.run) return this.runState[bd.run] || 0;
    return TW.clamp((st.vals[bd.j] - bd.lo) / (bd.hi - bd.lo), 0, 1);
  }
  pick(chs, label) {
    if (!this.opts.onPick) return;
    const idx = (chs || []).map(c => this.ds.chIndex[c]).filter(j => j !== undefined);
    this.opts.onPick(idx, label);
  }

  /* ---------------------------------------------------------------- zones */
  zone(z) {
    const s = TW.s;
    const g = s('g', { class: 'zone' });
    g.append(
      s('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 12, fill: 'url(#gZone)', stroke: z.col || '#2a3a55', 'stroke-opacity': 0.55, 'stroke-width': 1.2 }),
      s('rect', { x: z.x, y: z.y, width: 5, height: z.h, rx: 2, fill: z.col || '#2a3a55', opacity: 0.0 }),
      s('text', { x: z.x + 14, y: z.y + 19, class: 'zone-title', fill: z.col ? TW.mix(z.col, '#ffffff', 0.45) : '#cfd8ea', text: z.label }),
      s('text', { x: z.x + z.w - 12, y: z.y + 18, class: 'zone-sub', 'text-anchor': 'end', text: z.sub || '' }));
    this.gZones.appendChild(g);
  }

  /* ---------------------------------------------------------------- pipes */
  pipe(pp) {
    const s = TW.s;
    const d = 'M' + pp.pts.map(p => p.join(',')).join(' L');
    const w = pp.w || (pp.k === 'signal' ? 1.6 : pp.k === 'power' ? 4 : pp.k === 'shaft' ? 5 : 6);
    const col = TW.FLUID[pp.k] || '#39b6ff';
    const g = s('g', { class: 'pipe pipe-' + pp.k });
    if (pp.k === 'signal') {
      const line = s('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-dasharray': '4 5', opacity: 0.7 });
      g.appendChild(line);
      if (pp.label) {
        const p0 = pp.pts[0];
        g.appendChild(s('text', { x: p0[0] + 6, y: p0[1] + 12, class: 'pipe-label', text: pp.label }));
      }
      this.gPipes.appendChild(g);
      return;
    }
    const base = s('path', { d, fill: 'none', stroke: '#0a111d', 'stroke-width': w + 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const body = s('path', { d, fill: 'none', stroke: pp.k === 'power' ? '#4a3f1a' : '#2b3a54', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const flow = s('path', { d, fill: 'none', stroke: col, 'stroke-width': Math.max(1.5, w - 3), 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'stroke-dasharray': pp.k === 'power' ? '3 9' : '7 11', opacity: 0.9 });
    g.append(base, body, flow);
    if (pp.drip) {
      const [a, b] = [pp.pts[pp.pts.length - 2], pp.pts[pp.pts.length - 1]];
      const drops = s('g', { class: 'drips' });
      for (let x = a[0] + 30; x < b[0] - 10; x += 34) {
        drops.appendChild(s('circle', { cx: x, cy: a[1] + 6, r: 2.2, fill: TW.FLUID.nutrient }));
      }
      g.appendChild(drops);
      this.anim.push((st, dt) => {
        const on = this.val(fb, st);
        drops.style.opacity = on > 0.5 ? 0.9 : 0.12;
        const ph = (st.t * 2) % 1;
        drops.setAttribute('transform', `translate(0,${on > 0.5 ? ph * 12 : 0})`);
      });
    }
    this.gPipes.appendChild(g);
    const fb = this.bind(pp.f);
    let off = 0;
    const tint = pp.tint ? this.ds.chIndex[pp.tint] : undefined;
    this.anim.push((st, dt) => {
      const v = this.val(fb, st);
      off -= dt * (8 + 70 * v) * (v > 0.02 ? 1 : 0);
      flow.setAttribute('stroke-dashoffset', off.toFixed(1));
      flow.setAttribute('opacity', (0.25 + 0.7 * Math.min(1, v * 1.4)).toFixed(2));
      if (tint !== undefined) {
        const ch = this.ds.meta.channels[tint];
        const tt = TW.clamp((st.vals[tint] - ch.dlo) / (ch.dhi - ch.dlo || 1), 0, 1.5);
        flow.setAttribute('stroke', TW.mix('#39b6ff', '#c9a86a', TW.clamp((tt - 0.6) * 1.2, 0, 1)));
      }
    });
  }

  /* ---------------------------------------------------------------- components */
  comp(c) {
    const s = TW.s;
    const g = s('g', { class: 'comp comp-' + c.t, 'data-id': c.id });
    const halo = this.haloFor(c);
    if (halo) g.appendChild(halo);
    const fn = this['c_' + c.t];
    if (fn) fn.call(this, c, g);
    if (c.chs || c.op || c.lv || c.run || c.spd) {
      const chs = new Set(c.chs || []);
      ['op', 'lv', 'run', 'spd', 'pow', 'load', 'moist', 'on', 'int'].forEach(k => { if (c[k] && c[k].ch) chs.add(c[k].ch); });
      c._chs = [...chs];
      g.style.cursor = 'pointer';
      g.addEventListener('click', ev => { ev.stopPropagation(); this.pick(c._chs, c.label || c.id); });
      g.appendChild(s('title', { text: (c.label || c.id) + (c._chs.length ? ' — ' + c._chs.join(', ') : '') }));
      const idx = c._chs.map(x => this.ds.chIndex[x]).filter(j => j !== undefined);
      if (halo && idx.length) {
        this.anim.push(st => {
          let m = 0, ev = false, inj = false;
          for (const j of idx) {
            const a = Math.abs(st.z[j]); if (a > m) m = a;
            if (st.evTop === j) ev = true;
            if (st.inj && st.inj.has(j)) inj = true;
          }
          const op = ev ? 0.55 + 0.35 * Math.sin(st.t * 6) : m >= 4 ? 0.5 : m >= 2 ? 0.25 : 0;
          halo.setAttribute('opacity', op.toFixed(2));
          halo.setAttribute('fill', ev ? '#ff3b4e' : inj ? '#b06bff' : TW.colorDev(m));
        });
      }
    }
    this.compEls[c.id] = g;
    this.gComps.appendChild(g);
  }

  haloFor(c) {
    const s = TW.s;
    if (c.t === 'node' || c.t === 'greenhouse' || c.t === 'sun' || c.t === 'bus') return null;
    const pad = 10;
    if (c.r) return s('circle', { cx: c.x, cy: c.y, r: c.r + pad, opacity: 0, filter: 'url(#fSoft)' });
    const w = c.w || 40, h = c.h || 40;
    const x = c.w ? c.x : c.x - 20, y = c.h ? c.y : c.y - 20;
    return s('rect', { x: x - pad, y: y - pad, width: w + 2 * pad, height: h + 2 * pad, rx: 14, opacity: 0, filter: 'url(#fSoft)' });
  }

  label(g, x, y, text, cls = 'comp-label', anchor = 'middle') {
    if (!text) return;
    g.appendChild(TW.s('text', { x, y, class: cls, 'text-anchor': anchor, text }));
  }

  c_tank(c, g) {
    const s = TW.s;
    const clipId = 'clip_' + this.ds.meta.id + '_' + c.id;
    const liq = c.liq === 'hot' ? 'url(#gHot)' : c.liq === 'nutrient' ? 'url(#gNutrient)' : 'url(#gWater)';
    g.append(
      s('clipPath', { id: clipId }, s('rect', { x: c.x + 3, y: c.y + 3, width: c.w - 6, height: c.h - 6, rx: 8 })),
      s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 10, fill: 'url(#gGlass)', stroke: '#5d6f8f', 'stroke-width': 1.6 }));
    const water = s('rect', { x: c.x + 3, y: c.y + c.h * 0.3, width: c.w - 6, height: c.h * 0.7, fill: liq, opacity: 0.88, 'clip-path': `url(#${clipId})` });
    const wave = s('path', { d: '', fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 1.4, 'clip-path': `url(#${clipId})` });
    g.append(water, wave);
    for (let k = 1; k < 4; k++) g.appendChild(s('line', { x1: c.x + c.w - 9, x2: c.x + c.w - 3, y1: c.y + (c.h * k) / 4, y2: c.y + (c.h * k) / 4, stroke: '#8fa1c2', 'stroke-width': 1, opacity: 0.6 }));
    if (c.heater) {
      const hz = s('path', { d: `M${c.x + 10},${c.y + c.h - 14} l6,-8 l6,8 l6,-8 l6,8 l6,-8 l6,8 l6,-8`, fill: 'none', stroke: '#ff5a2a', 'stroke-width': 2.4, filter: 'url(#fGlow)' });
      g.appendChild(hz);
      this.anim.push(st => hz.setAttribute('opacity', (0.65 + 0.3 * Math.sin(st.t * 3)).toFixed(2)));
    }
    const pctTxt = s('text', { x: c.x + c.w / 2, y: c.y + (c.lab === 'in' ? 30 : 16), class: 'tank-pct', 'text-anchor': 'middle', text: '' });
    g.appendChild(pctTxt);
    if (c.lab === 'in') this.label(g, c.x + c.w / 2, c.y + 16, c.label, 'comp-label sm');
    else this.label(g, c.x + c.w / 2, c.y + c.h + 14, c.label);
    let sw = null;
    if (c.sw) {
      const hi = this.ds.chIndex[c.sw.hi], lo = this.ds.chIndex[c.sw.lo];
      const lh = s('circle', { cx: c.x - 7, cy: c.y + 10, r: 4 }), ll = s('circle', { cx: c.x - 7, cy: c.y + c.h - 10, r: 4 });
      g.append(lh, ll, s('text', { x: c.x - 13, y: c.y + 13, class: 'tiny', 'text-anchor': 'end', text: 'H' }),
        s('text', { x: c.x - 13, y: c.y + c.h - 7, class: 'tiny', 'text-anchor': 'end', text: 'L' }));
      sw = st => {
        lh.setAttribute('fill', st.vals[hi] > 0.5 ? '#ffc145' : '#2a3448');
        ll.setAttribute('fill', st.vals[lo] > 0.5 ? '#ffc145' : '#2a3448');
      };
    }
    const lb = typeof c.lv === 'number' ? { c: c.lv } : this.bind(c.lv);
    let cur = lb && lb.c !== undefined ? lb.c : 0.5;
    this.anim.push((st, dt) => {
      const target = lb ? this.val(lb, st) : 0.6;
      cur = TW.smooth(cur, target, dt, 6);
      const lvl = 0.04 + 0.92 * cur;
      const top = c.y + c.h - 3 - (c.h - 6) * lvl;
      water.setAttribute('y', top.toFixed(1));
      water.setAttribute('height', (c.y + c.h - 3 - top).toFixed(1));
      const ph = st.t * 2;
      let d = `M${c.x + 3},${top}`;
      for (let x = c.x + 3; x <= c.x + c.w - 3; x += 6) d += ` L${x},${(top + 1.6 * Math.sin(x / 7 + ph)).toFixed(1)}`;
      wave.setAttribute('d', d);
      if (lb && lb.j !== undefined) {
        const txt = TW.fmt(st.vals[lb.j]) + (lb.ch.unit ? ' ' + lb.ch.unit : '');
        if (pctTxt.textContent !== txt) pctTxt.textContent = txt;
      }
      if (sw) sw(st);
    });
  }

  c_pump(c, g) {
    const s = TW.s;
    const r = c.r;
    const ring = s('circle', { cx: c.x, cy: c.y, r: r + 2.5, fill: 'none', 'stroke-width': 2.5 });
    const body = s('circle', { cx: c.x, cy: c.y, r, fill: 'url(#gMetal)', stroke: '#8a9bb8', 'stroke-width': 1.2 });
    const imp = s('g');
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      imp.appendChild(s('path', { d: `M${c.x},${c.y} q${(r * 0.55 * Math.cos(a + 0.6)).toFixed(1)},${(r * 0.55 * Math.sin(a + 0.6)).toFixed(1)} ${(r * 0.8 * Math.cos(a)).toFixed(1)},${(r * 0.8 * Math.sin(a)).toFixed(1)}`, fill: 'none', stroke: '#c9d6ee', 'stroke-width': Math.max(1.4, r / 10), 'stroke-linecap': 'round' }));
    }
    imp.appendChild(s('circle', { cx: c.x, cy: c.y, r: Math.max(2, r / 6), fill: '#c9d6ee' }));
    g.append(ring, body, imp);
    this.label(g, c.x, c.y + r + 14, c.label);
    const rb = c.run ? this.bind(c.run) : null, sb = c.spd ? this.bind(c.spd) : null;
    let ang = 0, spd = 0;
    this.anim.push((st, dt) => {
      let on;
      if (rb) on = rb.j !== undefined ? (st.vals[rb.j] > 0.5 ? 1 : 0) : 1;
      else if (sb) on = this.val(sb, st);
      else on = 1;
      this.runState[c.id] = on > 0.02 ? Math.max(on, rb ? 1 : 0.15) : 0;
      spd = TW.smooth(spd, on, dt, 3);
      ang = (ang + dt * 520 * spd) % 360;
      imp.setAttribute('transform', `rotate(${ang.toFixed(1)} ${c.x} ${c.y})`);
      ring.setAttribute('stroke', on > 0.02 ? '#2fd38a' : '#3b475c');
    });
  }

  c_valve(c, g) {
    const s = TW.s;
    const k = (c.s || 1) * 9;
    const h = c.o !== 'v';
    const tri = h
      ? `M${c.x - k * 1.4},${c.y - k} L${c.x},${c.y} L${c.x - k * 1.4},${c.y + k} Z M${c.x + k * 1.4},${c.y - k} L${c.x},${c.y} L${c.x + k * 1.4},${c.y + k} Z`
      : `M${c.x - k},${c.y - k * 1.4} L${c.x},${c.y} L${c.x + k},${c.y - k * 1.4} Z M${c.x - k},${c.y + k * 1.4} L${c.x},${c.y} L${c.x + k},${c.y + k * 1.4} Z`;
    const body = s('path', { d: tri, stroke: '#9fb0cc', 'stroke-width': 1.2, fill: '#39b6ff' });
    const stem = h ? s('line', { x1: c.x, y1: c.y, x2: c.x, y2: c.y - k * 1.6, stroke: '#9fb0cc', 'stroke-width': 1.4 })
      : s('line', { x1: c.x, y1: c.y, x2: c.x + k * 1.6, y2: c.y, stroke: '#9fb0cc', 'stroke-width': 1.4 });
    const act = h ? s('rect', { x: c.x - k * 0.8, y: c.y - k * 2.3, width: k * 1.6, height: k * 0.8, rx: 2, fill: '#2b3a54', stroke: '#9fb0cc', 'stroke-width': 1 })
      : s('rect', { x: c.x + k * 1.6, y: c.y - k * 0.8, width: k * 0.8, height: k * 1.6, rx: 2, fill: '#2b3a54', stroke: '#9fb0cc', 'stroke-width': 1 });
    const txt = s('text', { x: h ? c.x : c.x + k * 2.9, y: h ? c.y + k + 12 : c.y + 4, class: 'valve-pct', 'text-anchor': h ? 'middle' : 'start', text: '' });
    g.append(body, stem, act, txt);
    if (c.label) {
      if (h) this.label(g, c.x, c.y - k * 2.3 - 5, c.label, 'comp-label sm');
      else this.label(g, c.x + k * 2.9, c.y - 8, c.label, 'comp-label sm', 'start');
    }
    const ob = this.bind(c.op);
    let cur = 1;
    this.anim.push((st, dt) => {
      let target = ob ? this.val(ob, st) : 1;
      let closing = false;
      if (c.evClose && st.evSeg && st.evSeg.startsWith(c.evClose)) { target = 0.12; closing = true; }
      cur = TW.smooth(cur, target, dt, closing ? 1.2 : 4);
      body.setAttribute('fill', TW.mix('#3a465c', '#39b6ff', cur));
      const t = closing ? 'closing' : ob ? Math.round(cur * 100) + '%' : 'open';
      if (txt.textContent !== t) txt.textContent = t;
      txt.setAttribute('fill', closing ? '#ffc145' : '#8ea0bf');
    });
  }

  c_hx(c, g) {
    const s = TW.s;
    g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 12, fill: 'url(#gMetalH)', stroke: '#8a9bb8', 'stroke-width': 1.3 }));
    let d = `M${c.x + 8},${c.y + c.h / 2}`;
    for (let x = c.x + 8, k = 0; x < c.x + c.w - 8; x += 10, k++) d += ` L${x + 5},${c.y + (k % 2 ? c.h * 0.28 : c.h * 0.72)}`;
    const coil = s('path', { d, fill: 'none', stroke: '#ff8a3d', 'stroke-width': 2.2, opacity: 0.85 });
    g.appendChild(coil);
    g.appendChild(s('text', { x: c.x + c.w / 2, y: c.y + 14, class: 'tiny', 'text-anchor': 'middle', text: 'shell · tube' }));
    this.label(g, c.x + c.w / 2, c.y + c.h + 14, c.label);
    this.anim.push(st => coil.setAttribute('stroke-dashoffset', (-st.t * 20).toFixed(1)));
    coil.setAttribute('stroke-dasharray', '14 4');
  }

  c_cooler(c, g) {
    const s = TW.s;
    g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 6, fill: 'url(#gMetal)', stroke: '#8a9bb8' }));
    const fan = s('g');
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2, r = Math.min(c.w, c.h) * 0.36;
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3;
      fan.appendChild(s('ellipse', { cx: cx + r * 0.5 * Math.cos(a), cy: cy + r * 0.5 * Math.sin(a), rx: r * 0.55, ry: r * 0.22, fill: '#68e0ff', opacity: 0.8, transform: `rotate(${(a * 180) / Math.PI} ${cx + r * 0.5 * Math.cos(a)} ${cy + r * 0.5 * Math.sin(a)})` }));
    }
    g.appendChild(fan);
    this.label(g, cx, c.y + c.h + 13, c.label, 'comp-label sm');
    let ang = 0;
    this.anim.push((st, dt) => { ang = (ang + dt * 240) % 360; fan.setAttribute('transform', `rotate(${ang.toFixed(1)} ${cx} ${cy})`); });
  }

  c_motor(c, g) {
    const s = TW.s;
    g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 6, fill: 'url(#gMetal)', stroke: '#8a9bb8' }));
    for (let x = c.x + 10; x < c.x + c.w - 6; x += 9) g.appendChild(s('line', { x1: x, x2: x, y1: c.y + 5, y2: c.y + c.h - 5, stroke: '#1b2434', 'stroke-width': 2 }));
    g.appendChild(s('line', { x1: c.x + c.w / 2, x2: c.x + c.w / 2, y1: c.y - 6, y2: c.y, stroke: '#9aa7bd', 'stroke-width': 4 }));
    g.appendChild(s('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + 5, class: 'motor-m', 'text-anchor': 'middle', text: 'M' }));
    this.label(g, c.x + c.w / 2, c.y + c.h + 13, c.label, 'comp-label sm');
  }

  c_gauge(c, g) {
    const s = TW.s;
    const r = 15;
    g.append(s('line', { x1: c.x, y1: c.y, x2: c.x, y2: c.y - 10, stroke: '#9fb0cc', 'stroke-width': 2 }),
      s('circle', { cx: c.x, cy: c.y - 22, r, fill: '#0e1726', stroke: '#9fb0cc', 'stroke-width': 1.4 }));
    const needle = s('line', { x1: c.x, y1: c.y - 22, x2: c.x, y2: c.y - 33, stroke: '#ffc145', 'stroke-width': 2, 'stroke-linecap': 'round' });
    g.append(needle, s('circle', { cx: c.x, cy: c.y - 22, r: 2, fill: '#ffc145' }));
    const b = this.bind({ ch: c.chs[0] });
    this.anim.push(st => {
      const a = -120 + 240 * this.val(b, st);
      needle.setAttribute('transform', `rotate(${a.toFixed(1)} ${c.x} ${c.y - 22})`);
    });
  }

  c_fm(c, g) {
    const s = TW.s;
    g.append(s('rect', { x: c.x - 16, y: c.y - 12, width: 32, height: 24, rx: 6, fill: '#0e1726', stroke: '#9fb0cc', 'stroke-width': 1.4 }),
      s('text', { x: c.x, y: c.y + 4, class: 'tiny b', 'text-anchor': 'middle', text: 'FM' }));
    this.label(g, c.x, c.y + 26, c.label, 'comp-label sm');
  }

  c_probe(c, g) {
    const s = TW.s;
    g.append(s('line', { x1: c.x, y1: c.y, x2: c.x, y2: c.y - 18, stroke: '#9fb0cc', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      s('circle', { cx: c.x, cy: c.y - 22, r: 6, fill: '#0e1726', stroke: '#9fb0cc', 'stroke-width': 1.4 }),
      s('text', { x: c.x, y: c.y - 19.5, class: 'tiny', 'text-anchor': 'middle', text: c.label === 'lux' ? '☀' : '' }));
  }

  c_analyser(c, g) {
    const s = TW.s;
    g.append(s('line', { x1: c.x, y1: c.y, x2: c.x, y2: c.y - 12, stroke: '#9fb0cc', 'stroke-width': 2 }),
      s('rect', { x: c.x - 18, y: c.y - 34, width: 36, height: 24, rx: 4, fill: '#18263d', stroke: '#9fb0cc' }),
      s('rect', { x: c.x - 13, y: c.y - 30, width: 26, height: 10, rx: 2, fill: '#1f9e89', opacity: 0.8 }),
      s('text', { x: c.x, y: c.y + 14, class: 'comp-label sm', 'text-anchor': 'middle', text: c.label }));
  }

  c_dcs(c, g) {
    const s = TW.s;
    g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 10, fill: '#0b1322', stroke: '#33507d', 'stroke-width': 1.2 }));
    g.appendChild(s('text', { x: c.x + 10, y: c.y + 17, class: 'comp-label sm', text: c.label }));
    const rows = c.rows.map((r, i) => {
      const y = c.y + 38 + i * 24;
      const idx = r.chs.map(x => this.ds.chIndex[x]);
      const t = s('text', { x: c.x + c.w - 10, y, class: 'dcs-val', 'text-anchor': 'end', text: '' });
      const dot = s('circle', { cx: c.x + 14, cy: y - 4, r: 4, fill: '#2fd38a' });
      g.append(dot, s('text', { x: c.x + 24, y, class: 'dcs-lab', text: r.label }), t);
      return { idx, t, dot };
    });
    c.chs = c.rows.flatMap(r => r.chs);
    this.anim.push(st => {
      for (const r of rows) {
        // compact values (2.66k rather than 2,656.6) so that three set-points fit next to the row label
        const txt = r.idx.map(j => { const v = st.vals[j]; return Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + 'k' : TW.fmt(v, 1); }).join(' · ');
        if (r.t.textContent !== txt) r.t.textContent = txt;
        let m = 0, ev = false;
        for (const j of r.idx) { m = Math.max(m, Math.abs(st.z[j])); if (st.evTop === j) ev = true; }
        r.dot.setAttribute('fill', ev ? '#ff3b4e' : TW.colorDev(m));
      }
    });
  }

  c_lamps(c, g) {
    const s = TW.s;
    const step = 38;
    const items = c.items.map((it, i) => {
      const x = c.x + 12 + i * step;
      const lamp = s('circle', { cx: x, cy: c.y, r: 6.5, stroke: '#5b6b86', 'stroke-width': 1 });
      g.append(lamp, s('text', { x, y: c.y + 17, class: 'tiny', 'text-anchor': 'middle', text: it.label }));
      return { j: this.ds.chIndex[it.ch], lamp, bad: it.bad };
    });
    c.chs = c.items.map(i => i.ch);
    this.label(g, c.x, c.y - 14, c.label, 'comp-label sm', 'start');
    this.anim.push(st => {
      for (const it of items) {
        const on = st.vals[it.j] > 0.5;
        it.lamp.setAttribute('fill', on ? (it.bad ? '#ff4d5e' : '#2fd38a') : '#1b2434');
        it.lamp.setAttribute('filter', on ? 'url(#fGlow)' : '');
      }
    });
  }

  c_rotor(c, g) {
    const s = TW.s;
    const y = c.y + c.h / 2;
    g.appendChild(s('rect', { x: c.x, y: c.y + c.h - 8, width: c.w, height: 8, rx: 3, fill: '#1c2638', stroke: '#33435e' }));
    g.appendChild(s('rect', { x: c.x + 8, y: y - 22, width: 64, height: 44, rx: 6, fill: 'url(#gMetal)', stroke: '#8a9bb8' }));
    g.appendChild(s('text', { x: c.x + 40, y: y + 5, class: 'motor-m', 'text-anchor': 'middle', text: 'M' }));
    g.appendChild(s('rect', { x: c.x + 72, y: y - 7, width: 12, height: 14, rx: 2, fill: '#5b6b86' }));
    const shaft = s('line', { x1: c.x + 84, y1: y, x2: c.x + c.w - 10, y2: y, stroke: '#b9c6dc', 'stroke-width': 4 });
    g.appendChild(shaft);
    const bear = [0.38, 0.86].map(f => c.x + c.w * f);
    bear.forEach(bx => g.append(s('rect', { x: bx - 9, y: y - 14, width: 18, height: 28 + 14, rx: 3, fill: '#2b364a', stroke: '#8a9bb8' }),
      s('path', { d: `M${bx - 4},${y - 30} l4,8 l4,-8 Z`, fill: '#ffc145' }),
      s('path', { d: `M${bx - 4},${y + 36} l4,-8 l4,8 Z`, fill: '#ffc145' })));
    const discs = [0.55, 0.7].map(f => {
      const dx = c.x + c.w * f;
      const dg = s('g');
      dg.appendChild(s('ellipse', { cx: dx, cy: y, rx: 7, ry: 26, fill: 'url(#gMetalH)', stroke: '#c9d6ee', 'stroke-width': 1 }));
      const mark = s('line', { x1: dx - 6, y1: y, x2: dx + 6, y2: y, stroke: '#ff8a3d', 'stroke-width': 3 });
      dg.appendChild(mark);
      g.appendChild(dg);
      return { dx, mark };
    });
    this.label(g, c.x + c.w / 2, c.y + c.h + 12, c.label, 'comp-label sm');
    const sb = this.bind(c.spd);
    let ph = 0;
    const rpmTxt = s('text', { x: c.x + 40, y: y - 28, class: 'tiny b', 'text-anchor': 'middle', text: '' });
    g.appendChild(rpmTxt);
    this.anim.push((st, dt) => {
      const v = this.val(sb, st);
      ph += dt * 30 * v;
      discs.forEach((d, i) => {
        const yy = y + 22 * Math.sin(ph + i * 1.3);
        d.mark.setAttribute('y1', yy.toFixed(1)); d.mark.setAttribute('y2', yy.toFixed(1));
        d.mark.setAttribute('opacity', (0.35 + 0.65 * Math.abs(Math.cos(ph + i * 1.3))).toFixed(2));
      });
      const t = Math.round(st.vals[sb.j]) + ' rpm';
      if (rpmTxt.textContent !== t) rpmTxt.textContent = t;
    });
  }

  c_turbine(c, g) {
    const s = TW.s;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    if (c.hydro) {
      g.appendChild(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 12, fill: 'url(#gMetalH)', stroke: '#8a9bb8' }));
    } else {
      g.appendChild(s('path', { d: `M${c.x},${c.y + 12} L${c.x + c.w},${c.y} L${c.x + c.w},${c.y + c.h} L${c.x},${c.y + c.h - 12} Z`, fill: 'url(#gMetalH)', stroke: '#8a9bb8' }));
    }
    const rot = s('g');
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      rot.appendChild(s('line', { x1: cx, y1: cy, x2: cx + 19 * Math.cos(a), y2: cy + 19 * Math.sin(a), stroke: c.hydro ? '#68e0ff' : '#e6edf8', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    }
    rot.appendChild(s('circle', { cx, cy, r: 4, fill: '#e6edf8' }));
    g.appendChild(rot);
    this.label(g, cx, c.y + c.h + 13, c.label, 'comp-label sm');
    const sb = this.bind(c.spd);
    let ang = 0;
    this.anim.push((st, dt) => {
      const v = this.val(sb, st);
      ang = (ang + dt * (60 + 600 * v)) % 360;
      rot.setAttribute('transform', `rotate(${ang.toFixed(1)} ${cx} ${cy})`);
    });
  }

  c_gen(c, g) {
    const s = TW.s;
    const glow = s('circle', { cx: c.x, cy: c.y, r: c.r + 6, fill: '#ffd166', opacity: 0.2, filter: 'url(#fSoft)' });
    g.append(glow, s('circle', { cx: c.x, cy: c.y, r: c.r, fill: 'url(#gMetal)', stroke: '#ffd166', 'stroke-width': 1.6 }),
      s('text', { x: c.x, y: c.y + 6, class: 'gen-g', 'text-anchor': 'middle', text: 'G' }));
    this.label(g, c.x, c.y + c.r + 14, c.label, 'comp-label sm');
    const pb = this.bind(c.pow);
    this.anim.push(st => glow.setAttribute('opacity', (0.1 + 0.6 * this.val(pb, st)).toFixed(2)));
  }

  c_bus(c, g) {
    const s = TW.s;
    g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 3, fill: '#ffd166', opacity: 0.85 }),
      s('text', { x: c.x + c.w / 2, y: c.y - 6, class: 'comp-label sm', 'text-anchor': 'middle', text: c.label }));
  }

  c_city(c, g) {
    const s = TW.s;
    const bld = [];
    const widths = [26, 18, 30, 22, 28, 20, 24];
    let x = c.x;
    widths.forEach((w, i) => {
      const h = 40 + ((i * 37) % 60);
      const yb = c.y + c.h - h;
      g.appendChild(s('rect', { x, y: yb, width: w, height: h, fill: '#1b2638', stroke: '#33435e' }));
      for (let wy = yb + 6; wy < c.y + c.h - 6; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) {
        const win = s('rect', { x: wx, y: wy, width: 3.5, height: 4, fill: '#ffd166', opacity: 0.1 });
        g.appendChild(win); bld.push({ win, r: ((wx * 13.7 + wy * 7.3) % 1 + 1) % 1 });
      }
      x += w + 2;
    });
    this.label(g, c.x + c.w / 2, c.y + c.h + 13, c.label, 'comp-label sm');
    const lb = this.bind(c.load);
    let last = -1;
    this.anim.push(st => {
      const v = this.val(lb, st);
      const q = Math.round(v * 20);
      if (q === last) return; last = q;
      bld.forEach(b => b.win.setAttribute('opacity', b.r < 0.25 + 0.7 * v ? 0.85 : 0.08));
    });
  }

  c_reservoir(c, g) {
    const s = TW.s;
    g.append(s('path', { d: `M${c.x},${c.y} L${c.x + 8},${c.y + c.h} L${c.x + c.w - 8},${c.y + c.h} L${c.x + c.w},${c.y}`, fill: '#0e1726', stroke: '#5d6f8f', 'stroke-width': 1.4 }));
    const water = s('path', { d: '', fill: 'url(#gWater)', opacity: 0.85 });
    g.appendChild(water);
    if (c.dam) g.appendChild(s('path', { d: `M${c.x + c.w - 4},${c.y - 6} L${c.x + c.w + 10},${c.y - 6} L${c.x + c.w + 16},${c.y + c.h} L${c.x + c.w - 6},${c.y + c.h} Z`, fill: '#3a465c', stroke: '#6d7f9f' }));
    this.label(g, c.x + c.w / 2, c.y + c.h + 14, c.label, 'comp-label sm');
    this.anim.push(st => {
      const top = c.y + c.h * 0.22;
      let d = `M${c.x + 3},${top}`;
      for (let x = c.x + 3; x <= c.x + c.w - 3; x += 6) d += ` L${x},${(top + 1.8 * Math.sin(x / 8 + st.t * 1.6)).toFixed(1)}`;
      d += ` L${c.x + c.w - 9},${c.y + c.h - 2} L${c.x + 9},${c.y + c.h - 2} Z`;
      water.setAttribute('d', d);
    });
  }

  c_building(c, g) {
    const s = TW.s;
    g.append(s('rect', { x: c.x, y: c.y + 18, width: c.w, height: c.h - 18, rx: 4, fill: '#16233a', stroke: '#5d6f8f', 'stroke-width': 1.3 }),
      s('path', { d: `M${c.x - 6},${c.y + 20} L${c.x + c.w / 2},${c.y} L${c.x + c.w + 6},${c.y + 20} Z`, fill: '#22324d', stroke: '#5d6f8f' }));
    if (!c.rack) for (let k = 0; k < 3; k++) g.appendChild(s('rect', { x: c.x + 14 + k * ((c.w - 28) / 3), y: c.y + 34, width: (c.w - 28) / 3 - 8, height: 22, rx: 2, fill: '#ffd166', opacity: 0.25 }));
    if (!c.rack) g.appendChild(s('circle', { cx: c.x + c.w - 22, cy: c.y + c.h - 24, r: 12, fill: 'url(#gWater)', opacity: 0.8 }));
    g.appendChild(s('text', { x: c.x + c.w / 2, y: c.y + c.h + 14, class: 'comp-label', 'text-anchor': 'middle', text: c.label }));
    if (c.sub) g.appendChild(s('text', { x: c.x + c.w / 2, y: c.y + c.h + 27, class: 'tiny', 'text-anchor': 'middle', text: c.sub }));
  }

  c_town(c, g) {
    const s = TW.s;
    for (let k = 0; k < 6; k++) {
      const x = c.x + (k % 3) * 26, y = c.y + Math.floor(k / 3) * 38 + 16;
      g.append(s('rect', { x, y: y + 10, width: 20, height: 18, fill: '#1b2638', stroke: '#5d6f8f' }),
        s('path', { d: `M${x - 3},${y + 11} L${x + 10},${y} L${x + 23},${y + 11} Z`, fill: '#2d3c57', stroke: '#5d6f8f' }),
        s('rect', { x: x + 7, y: y + 15, width: 5, height: 5, fill: '#ffd166', opacity: 0.6 }));
    }
    this.label(g, c.x + 36, c.y + c.h + 12, c.label, 'comp-label sm');
  }

  c_source(c, g) {
    const s = TW.s;
    g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 8, fill: '#0e1726', stroke: '#5d6f8f' }),
      s('path', { d: `M${c.x + c.w / 2},${c.y + 12} q-12,16 0,24 q12,-8 0,-24`, fill: '#39b6ff' }));
    this.label(g, c.x + c.w / 2, c.y + c.h + 13, c.label, 'comp-label sm');
  }

  c_sun(c, g) {
    const s = TW.s;
    const glow = s('circle', { cx: c.x, cy: c.y, r: c.r * 1.8, fill: '#ffd166', opacity: 0.2, filter: 'url(#fSoft)' });
    const core = s('circle', { cx: c.x, cy: c.y, r: c.r, fill: '#ffcf4a' });
    const rays = s('g');
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      rays.appendChild(s('line', { x1: c.x + (c.r + 6) * Math.cos(a), y1: c.y + (c.r + 6) * Math.sin(a), x2: c.x + (c.r + 16) * Math.cos(a), y2: c.y + (c.r + 16) * Math.sin(a), stroke: '#ffcf4a', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    }
    g.append(glow, rays, core);
    const ib = this.bind(c.int);
    this.anim.push(st => {
      const v = this.val(ib, st);
      glow.setAttribute('opacity', (0.05 + 0.5 * v).toFixed(2));
      core.setAttribute('fill', TW.mix('#5b5f6b', '#ffcf4a', 0.25 + 0.75 * v));
      rays.setAttribute('opacity', (0.15 + 0.85 * v).toFixed(2));
    });
  }

  c_greenhouse(c, g) {
    const s = TW.s;
    const r = c.y + 70;
    g.append(s('path', { d: `M${c.x},${c.y + c.h} L${c.x},${r} L${c.x + c.w / 4},${c.y} L${c.x + c.w / 2},${r} L${c.x + (3 * c.w) / 4},${c.y} L${c.x + c.w},${r} L${c.x + c.w},${c.y + c.h} Z`,
      fill: 'url(#gSky)', stroke: '#7cc4a0', 'stroke-opacity': 0.6, 'stroke-width': 1.5 }));
    for (let x = c.x + 40; x < c.x + c.w; x += 40) g.appendChild(s('line', { x1: x, y1: r + 4, x2: x, y2: c.y + c.h, stroke: '#7cc4a0', 'stroke-opacity': 0.12 }));
    g.appendChild(s('text', { x: c.x + c.w - 12, y: c.y + c.h - 8, class: 'comp-label sm', 'text-anchor': 'end', text: c.label }));
  }

  c_lamp(c, g) {
    const s = TW.s;
    const cone = s('path', { d: `M${c.x + 10},${c.y + 6} L${c.x - 10},${c.y + 140} L${c.x + c.w + 10},${c.y + 140} L${c.x + c.w - 10},${c.y + 6} Z`, fill: '#ffe08a', opacity: 0 });
    const bar = s('rect', { x: c.x, y: c.y, width: c.w, height: 7, rx: 3, fill: '#4b5568', stroke: '#8a9bb8' });
    g.append(s('line', { x1: c.x + 20, y1: c.y - 40, x2: c.x + 20, y2: c.y, stroke: '#5b6b86' }),
      s('line', { x1: c.x + c.w - 20, y1: c.y - 40, x2: c.x + c.w - 20, y2: c.y, stroke: '#5b6b86' }), cone, bar);
    const ob = this.bind(c.on);
    this.anim.push(st => {
      const on = st.vals[ob.j] > 0.5;
      cone.setAttribute('opacity', on ? 0.18 : 0);
      bar.setAttribute('fill', on ? '#ffe08a' : '#4b5568');
    });
  }

  c_bed(c, g) {
    const s = TW.s;
    const soil = s('rect', { x: c.x, y: c.y + 26, width: c.w, height: c.h - 26, rx: 6, stroke: '#5d4630' });
    g.appendChild(soil);
    for (let x = c.x + 18; x < c.x + c.w - 8; x += 30) {
      g.append(s('line', { x1: x, y1: c.y + 28, x2: x, y2: c.y + 6, stroke: '#3f9d55', 'stroke-width': 2.2 }),
        s('ellipse', { cx: x - 6, cy: c.y + 12, rx: 7, ry: 3.5, fill: '#4fc26b', transform: `rotate(-30 ${x - 6} ${c.y + 12})` }),
        s('ellipse', { cx: x + 6, cy: c.y + 8, rx: 7, ry: 3.5, fill: '#5fd37a', transform: `rotate(30 ${x + 6} ${c.y + 8})` }));
    }
    this.label(g, c.x + c.w / 2, c.y + c.h + 13, c.label, 'comp-label sm');
    const mb = this.bind(c.moist);
    this.anim.push(st => soil.setAttribute('fill', TW.mix('#9a7445', '#2a1a0e', this.val(mb, st))));
  }

  c_envbox(c, g) {
    const s = TW.s;
    g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 8, fill: '#16233a', stroke: '#7cc4a0', 'stroke-opacity': 0.7 }),
      s('text', { x: c.x + c.w / 2, y: c.y + 26, class: 'tiny', 'text-anchor': 'middle', text: '🌡 💧 ☁' }),
      s('text', { x: c.x + c.w / 2, y: c.y + 46, class: 'comp-label sm', 'text-anchor': 'middle', text: c.label }));
  }

  c_node(c, g) {
    g.appendChild(TW.s('circle', { cx: c.x, cy: c.y, r: 6, fill: '#39b6ff', stroke: '#0a111d', 'stroke-width': 2 }));
  }

  /* ---------------------------------------------------------------- sensor badges */
  tag(t) {
    const s = TW.s;
    const j = this.ds.chIndex[t.ch];
    if (j === undefined) return;
    const ch = this.ds.meta.channels[j];
    const sm = !!(t.sm || this.p.sm);
    const w = sm ? 80 : 94, h = sm ? 28 : 32;
    const g = s('g', { class: 'tag', transform: `translate(${t.x - w / 2},${t.y - h / 2})` });
    const box = s('rect', { width: w, height: h, rx: 7, class: 'tag-box' });
    const dot = s('circle', { cx: 9, cy: h / 2, r: 3.6, fill: '#2fd38a' });
    const name = s('text', { x: 17, y: sm ? 11 : 12.5, class: 'tag-name', text: t.label || ch.short });
    const val = s('text', { x: 17, y: sm ? 23 : 26, class: 'tag-val', text: '' });
    const mark = s('text', { x: w - 5, y: 12, class: 'tag-mark', 'text-anchor': 'end', text: '' });
    g.append(box, dot, name, val, mark, s('title', { text: `${ch.id}${ch.unit ? ' [' + ch.unit + ']' : ''}\n${ch.desc}` }));
    g.style.cursor = 'pointer';
    g.addEventListener('click', ev => { ev.stopPropagation(); this.pick([ch.id], ch.id); });
    this.gTags.appendChild(g);
    this.tagEls[j] = g;
    let lastTxt = '';
    const unit = ch.binary ? '' : ch.unit;
    this.anim.push(st => {
      const v = st.vals[j];
      const txt = ch.binary && (ch.unit === 'on/off' || ch.unit === 'bool') ? (v > 0.5 ? 'ON' : 'OFF') : TW.fmt(v) + (unit ? ' ' + unit : '');
      if (txt !== lastTxt) { val.textContent = txt; lastTxt = txt; }
      const z = st.z[j];
      dot.setAttribute('fill', TW.colorDev(z));
      const ev = st.evTop === j, inj = st.inj && st.inj.has(j), sel = st.sel && st.sel.has(j);
      box.setAttribute('class', 'tag-box' + (ev ? ' ev' : '') + (inj ? ' inj' : '') + (sel ? ' sel' : ''));
      const m = ev ? (st.evIcon || '!') : inj ? '⚡' : '';
      if (mark.textContent !== m) mark.textContent = m;
    });
  }

  update(st, dt) {
    for (const f of this.anim) f(st, dt);
    this.alarmFrame.setAttribute('class', 'alarm-frame' + (st.alarm ? ' on' : ''));
  }
  destroy() { this.svg.remove(); }
};
