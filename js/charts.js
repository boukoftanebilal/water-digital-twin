/* Canvas charts: overview strip of the whole evaluation period, live score chart, sensor traces, lab detectors */
'use strict';

TW.Canvas = class {
  constructor(host, h) {
    this.c = TW.h('canvas', { class: 'chart' });
    this.c.style.height = h + 'px';
    host.appendChild(this.c);
    this.ctx = this.c.getContext('2d');
    this.h = h;
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.c.clientWidth || 600;
    if (this.w === w && this.dpr === dpr) return false;
    this.w = w; this.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }
};

/* ------------------------------------------------------------------ overview strip */
TW.Overview = class extends TW.Canvas {
  constructor(host, ds, onSeek) {
    super(host, 74);
    this.ds = ds; this.onSeek = onSeek;
    this.c.classList.add('overview');
    let drag = false;
    const seek = e => {
      const r = this.c.getBoundingClientRect();
      const x = TW.clamp((e.clientX - r.left) / r.width, 0, 1);
      onSeek(x * (ds.N - 1));
    };
    this.c.addEventListener('pointerdown', e => { drag = true; this.c.setPointerCapture(e.pointerId); seek(e); });
    this.c.addEventListener('pointermove', e => { if (drag) seek(e); this.hoverX = e.offsetX; });
    this.c.addEventListener('pointerup', () => { drag = false; });
    this.c.addEventListener('pointerleave', () => { this.hoverX = null; });
    this.bg = null;
  }
  setRun(scores, scale, R) { this.scores = scores; this.scale = scale; this.R = R; this.bg = null; }
  setLab(lab) { this.lab = lab; this.bg = null; }
  renderBg() {
    const { ctx, w, h, ds } = this;
    const N = ds.N;
    const cv = document.createElement('canvas');
    cv.width = this.c.width; cv.height = this.c.height;
    const g = cv.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#0b1322'; g.fillRect(0, 0, w, h);
    const X = i => (i / (N - 1)) * w;
    // records
    ds.segList.forEach((sg, k) => {
      if (ds.segList.length > 1) {
        g.fillStyle = k % 2 ? '#0e182a' : '#0b1322';
        g.fillRect(X(sg.tlStart), 0, X(sg.tlStart + sg.n) - X(sg.tlStart), h);
      }
      // calibration prefix
      let a = -1;
      for (let i = sg.tlStart; i < sg.tlStart + sg.n; i++) if (!ds.scored[i]) { if (a < 0) a = i; } else if (a >= 0) break;
      if (a >= 0) {
        let b = a; while (b < sg.tlStart + sg.n && !ds.scored[b]) b++;
        g.fillStyle = 'rgba(127,140,166,0.18)'; g.fillRect(X(a), 0, Math.max(1, X(b) - X(a)), h);
      }
    });
    // events
    ds.events.forEach(e => {
      if (e.labStart < 0) return;
      const x0 = X(e.labStart), x1 = X(e.labEnd + 1);
      g.fillStyle = 'rgba(255,59,78,0.30)'; g.fillRect(x0, 0, Math.max(2, x1 - x0), h);
      g.fillStyle = '#ff3b4e'; g.fillRect(x0, h - 6, Math.max(2, x1 - x0), 6);
    });
    // score envelope (max per pixel)
    if (this.scores) {
      const sc = this.scale, top = 6, bot = h - 14;
      const Y = v => bot - TW.clamp(sc.f(v), 0, 1.05) * (bot - top);
      g.beginPath();
      const px = Math.max(1, Math.floor(w));
      for (let x = 0; x < px; x++) {
        const i0 = Math.floor((x / px) * N), i1 = Math.max(i0 + 1, Math.floor(((x + 1) / px) * N));
        let m = -Infinity;
        for (let i = i0; i < i1; i++) { const p = ds.scorePos[i]; if (p >= 0 && this.scores[p] > m) m = this.scores[p]; }
        if (m === -Infinity) continue;
        if (x === 0) g.moveTo(x, Y(m)); else g.lineTo(x, Y(m));
      }
      g.strokeStyle = 'rgba(160,190,235,0.75)'; g.lineWidth = 1; g.stroke();
      const ty = Y(this.R.thr);
      g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,193,69,0.8)'; g.beginPath(); g.moveTo(0, ty); g.lineTo(w, ty); g.stroke(); g.setLineDash([]);
      // flagged windows
      g.fillStyle = 'rgba(255,193,69,0.85)';
      for (let i = 0; i < N; i++) if (this.R.flags[i]) g.fillRect(X(i), h - 12, Math.max(1, w / N), 5);
    }
    // lab injections
    if (this.lab) for (const inj of this.lab.injections) {
      const x0 = X(inj.start), x1 = X(Math.min(N - 1, inj.start + inj.dur));
      g.fillStyle = 'rgba(176,107,255,0.35)'; g.fillRect(x0, 0, Math.max(2, x1 - x0), h);
    }
    this.bg = cv;
  }
  draw(T) {
    if (this.resize()) this.bg = null;
    if (!this.bg) this.renderBg();
    const { ctx, w, h, ds } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.bg, 0, 0, w, h);
    const x = (T / (ds.N - 1)) * w;
    ctx.fillStyle = 'rgba(57,182,255,0.12)'; ctx.fillRect(0, 0, x, h);
    ctx.strokeStyle = '#e8eefc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    if (this.hoverX !== null && this.hoverX !== undefined) {
      const i = Math.round((this.hoverX / w) * (ds.N - 1));
      ctx.fillStyle = 'rgba(232,238,252,0.9)'; ctx.font = '11px Inter, system-ui, sans-serif';
      const label = TW.clock(ds.t0[TW.clamp(i, 0, ds.N - 1)], ds);
      const tw = ctx.measureText(label).width;
      const lx = TW.clamp(this.hoverX + 8, 2, w - tw - 6);
      ctx.fillStyle = 'rgba(8,13,24,0.85)'; ctx.fillRect(lx - 4, 2, tw + 8, 16);
      ctx.fillStyle = '#e8eefc'; ctx.fillText(label, lx, 14);
    }
  }
};

/* ------------------------------------------------------------------ live score chart */
TW.LiveChart = class extends TW.Canvas {
  constructor(host, ds, h = 150) {
    super(host, h);
    this.ds = ds; this.span = 240;
  }
  setRun(scores, scale, R, colour, label) { Object.assign(this, { scores, scale, R, colour, label }); }
  setTraces(chs) { this.traces = chs; }
  setLab(lab) { this.lab = lab; }
  draw(T, injVals) {
    this.resize();
    const { ctx, w, h, ds } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1322'; ctx.fillRect(0, 0, w, h);
    const span = Math.min(this.span, ds.N);
    const t1 = Math.max(span - 1, Math.min(ds.N - 1, Math.floor(T) + Math.floor(span * 0.15)));
    const t0 = Math.max(0, t1 - span + 1);
    const X = i => ((i - t0) / (span - 1)) * (w - 52) + 4;
    const lanes = this.traces && this.traces.length ? 2 : 1;
    const top = 8, laneH = (h - 22) / lanes;
    // events and flags
    for (const e of ds.events) {
      if (e.labEnd < t0 || e.labStart > t1) continue;
      ctx.fillStyle = 'rgba(255,59,78,0.22)';
      ctx.fillRect(X(Math.max(t0, e.labStart)), 0, Math.max(2, X(Math.min(t1, e.labEnd) + 1) - X(Math.max(t0, e.labStart))), h - 14);
    }
    if (this.lab) for (const inj of this.lab.injections) {
      const a = inj.start, b = inj.start + inj.dur;
      if (b < t0 || a > t1) continue;
      ctx.fillStyle = 'rgba(176,107,255,0.22)';
      ctx.fillRect(X(Math.max(t0, a)), 0, Math.max(2, X(Math.min(t1, b)) - X(Math.max(t0, a))), h - 14);
    }
    // score lane
    if (this.scores) {
      const y0 = top, y1 = top + laneH - 6;
      const Y = v => y1 - TW.clamp(this.scale.f(v), -0.02, 1.08) * (y1 - y0);
      for (let i = t0; i <= t1; i++) if (this.R.flags[i]) { ctx.fillStyle = 'rgba(255,193,69,0.16)'; ctx.fillRect(X(i), y0, Math.max(1.5, (w - 52) / span), y1 - y0); }
      const ty = Y(this.R.thr);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffc145'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, ty); ctx.lineTo(w - 48, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffc145'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText('θ', w - 44, ty + 3);
      ctx.beginPath(); let started = false;
      for (let i = t0; i <= Math.min(T, t1); i++) {
        const p = ds.scorePos[i]; if (p < 0) { started = false; continue; }
        const x = X(i), y = Y(this.scores[p]);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = this.colour || '#39b6ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#8ea0bf'; ctx.fillText(this.label || 'score', 8, y0 + 10);
    }
    // sensor lane
    if (lanes === 2) {
      const y0 = top + laneH + 2, y1 = top + 2 * laneH - 6;
      const cols = ['#39b6ff', '#2fd38a', '#ff8a3d', '#c792ea'];
      this.traces.forEach((j, k) => {
        const ch = ds.meta.channels[j];
        const vals = injVals || ds;
        let lo = Infinity, hi = -Infinity;
        for (let i = t0; i <= t1; i++) { const v = vals.value(i, j); if (v < lo) lo = v; if (v > hi) hi = v; }
        if (hi - lo < 1e-9) { hi = lo + 1; lo -= 1; }
        const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
        const Y = v => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
        ctx.beginPath();
        for (let i = t0; i <= Math.min(T, t1); i++) { const x = X(i), y = Y(vals.value(i, j)); if (i === t0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.strokeStyle = cols[k % cols.length]; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = cols[k % cols.length]; ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillText(ch.short + (ch.unit ? ' [' + ch.unit + ']' : ''), 8 + k * 120, y0 + 10);
      });
    }
    // cursor and time axis
    const xc = X(T);
    ctx.strokeStyle = 'rgba(232,238,252,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, 0); ctx.lineTo(xc, h - 14); ctx.stroke();
    ctx.fillStyle = '#6f7f9c'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText(TW.clock(ds.t0[t0], ds), 4, h - 3);
    const lab = TW.clock(ds.t0[t1], ds); ctx.fillText(lab, w - 48 - ctx.measureText(lab).width, h - 3);
  }
};

/* ------------------------------------------------------------------ lab detector chart */
TW.LabChart = class extends TW.Canvas {
  constructor(host, ds, h = 120) { super(host, h); this.ds = ds; this.span = 240; }
  draw(T, lab) {
    this.resize();
    const { ctx, w, h, ds } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1322'; ctx.fillRect(0, 0, w, h);
    if (!lab || !lab.scores) return;
    const span = Math.min(this.span, ds.N);
    const t1 = Math.max(span - 1, Math.min(ds.N - 1, Math.floor(T) + Math.floor(span * 0.15)));
    const t0 = Math.max(0, t1 - span + 1);
    const X = i => ((i - t0) / (span - 1)) * (w - 10) + 4;
    const y0 = 8, y1 = h - 16;
    const Y = r => y1 - (Math.log10(1 + 9 * TW.clamp(r, 0, 4)) / Math.log10(37)) * (y1 - y0);
    for (const e of ds.events) {
      if (e.labEnd < t0 || e.labStart > t1) continue;
      ctx.fillStyle = 'rgba(255,59,78,0.18)';
      ctx.fillRect(X(Math.max(t0, e.labStart)), 0, Math.max(2, X(Math.min(t1, e.labEnd) + 1) - X(Math.max(t0, e.labStart))), h - 14);
    }
    for (const inj of lab.injections) {
      const a = inj.start, b = inj.start + inj.dur;
      if (b < t0 || a > t1) continue;
      ctx.fillStyle = 'rgba(176,107,255,0.25)';
      ctx.fillRect(X(Math.max(t0, a)), 0, Math.max(2, X(Math.min(t1, b)) - X(Math.max(t0, a))), h - 14);
    }
    const ty = Y(1);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffc145'; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(w, ty); ctx.stroke(); ctx.setLineDash([]);
    lab.detectors.forEach(d => {
      const sc = lab.scores[d.id]; if (!sc) return;
      ctx.beginPath();
      for (let i = t0; i <= Math.min(T, t1); i++) { const x = X(i), y = Y(sc[i] / d.thr); if (i === t0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = d.colour; ctx.lineWidth = 1.8; ctx.stroke();
    });
    const xc = X(T);
    ctx.strokeStyle = 'rgba(232,238,252,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, 0); ctx.lineTo(xc, h - 14); ctx.stroke();
    ctx.fillStyle = '#6f7f9c'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('score / threshold (log scale) — dashed line = alarm level', 6, h - 3);
  }
};

/* sparkline of one channel for the inspector */
TW.spark = function (canvas, ds, j, T, span = 240, vals) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 60;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1322'; ctx.fillRect(0, 0, w, h);
  const src = vals || ds;
  const t1 = Math.min(ds.N - 1, Math.floor(T)), t0 = Math.max(0, t1 - span + 1);
  let lo = Infinity, hi = -Infinity;
  for (let i = t0; i <= t1; i++) { const v = src.value(i, j); if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 1e-9) { hi = lo + 1; lo -= 1; }
  const X = i => ((i - t0) / Math.max(1, span - 1)) * (w - 4) + 2, Y = v => h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
  ctx.beginPath();
  for (let i = t0; i <= t1; i++) { if (i === t0) ctx.moveTo(X(i), Y(src.value(i, j))); else ctx.lineTo(X(i), Y(src.value(i, j))); }
  ctx.strokeStyle = '#39b6ff'; ctx.lineWidth = 1.5; ctx.stroke();
};
