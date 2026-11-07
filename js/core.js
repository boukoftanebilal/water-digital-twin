/* Water Digital Twin — core utilities and dataset loading */
'use strict';
const TW = (window.TW = window.TW || {});

TW.$ = (s, r = document) => r.querySelector(s);
TW.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* element builder: h('div', {class: 'x', onclick: fn, style: {...}}, children...) */
TW.h = function (tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
};

const SVGNS = 'http://www.w3.org/2000/svg';
TW.s = function (tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c) e.appendChild(c);
  return e;
};

TW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
TW.lerp = (a, b, t) => a + (b - a) * t;
TW.smooth = (cur, target, dt, rate = 8) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

TW.fmt = function (v, digits) {
  if (v === null || v === undefined || !isFinite(v)) return '–';
  const a = Math.abs(v);
  if (digits === undefined) digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4;
  if (a >= 100000) return v.toExponential(2);
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
TW.pct = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? '–' : (100 * v).toFixed(d) + '%');
TW.dur = function (s) {
  if (!isFinite(s)) return '–';
  s = Math.round(s);
  if (s < 90) return s + ' s';
  if (s < 3600) return (s / 60).toFixed(s < 600 ? 1 : 0) + ' min';
  if (s < 86400 * 2) return (s / 3600).toFixed(1) + ' h';
  return (s / 86400).toFixed(1) + ' d';
};
TW.clock = function (t, ds) {
  // timestamps are local clock times stored as UTC seconds; WDSEventDB records have synthetic clocks
  if (ds && ds.meta.id === 'wdsevent') {
    const seg = ds.segOfTime(t);
    const rel = Math.max(0, t - (seg ? seg.rec_start : t));
    const hh = String(Math.floor(rel / 3600)).padStart(2, '0');
    const mm = String(Math.floor((rel % 3600) / 60)).padStart(2, '0');
    const ss = String(Math.floor(rel % 60)).padStart(2, '0');
    return (seg ? seg.name + ' · ' : '') + hh + ':' + mm + ':' + ss;
  }
  const d = new Date(t * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

TW.colorDev = function (z) {
  const a = Math.abs(z);
  if (!isFinite(a)) return '#5b6b85';
  if (a < 2) return '#2fd38a';
  if (a < 4) return '#ffc145';
  return '#ff4d5e';
};

TW.hexToRgb = function (hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
TW.mix = function (h1, h2, t) {
  const a = TW.hexToRgb(h1), b = TW.hexToRgb(h2);
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * TW.clamp(t, 0, 1)));
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
};

TW.fetchJSON = async function (url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
};
TW.fetchBin = async function (url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  if (!onProgress || !r.body || !r.headers.get('content-length')) return r.arrayBuffer();
  const total = +r.headers.get('content-length');
  const reader = r.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got); got += value.length;
    onProgress(got / total);
  }
  return out.buffer;
};

TW.quantile = function (arr, q) {
  const a = Float64Array.from(arr).sort();
  if (!a.length) return NaN;
  const p = (a.length - 1) * q, i = Math.floor(p), f = p - i;
  return i + 1 < a.length ? a[i] * (1 - f) + a[i + 1] * f : a[i];
};

/* ------------------------------------------------------------------ dataset */
TW.datasets = ['hai', 'skab', 'smartfarm', 'wdsevent', 'gecco'];
TW._dsCache = {};

TW.loadDataset = async function (id, onProgress) {
  if (TW._dsCache[id]) return TW._dsCache[id];
  const meta = await TW.fetchJSON(`data/${id}.json`);
  const buf = await TW.fetchBin(`data/${id}_sensors.bin`, onProgress);
  const ds = new TW.Dataset(meta, new Uint16Array(buf));
  TW._dsCache[id] = ds;
  return ds;
};

TW.Dataset = class {
  constructor(meta, q) {
    this.meta = meta;
    const C = (this.C = meta.channels.length);
    this.R = q.length / C;                                  // rows: all ticks of all blocks
    const S = (this.S = new Float32Array(q.length));
    meta.channels.forEach((ch, j) => {
      const lo = ch.lo, span = ch.hi - ch.lo || 1;
      for (let i = j; i < q.length; i += C) S[i] = lo + (q[i] / 65535) * span;
      ch.idx = j;
      ch.short = TW.shortName(meta.id, ch.id);
      const lo2 = isFinite(ch.p01) ? ch.p01 : ch.lo, hi2 = isFinite(ch.p99) ? ch.p99 : ch.hi;
      ch.dlo = lo2; ch.dhi = hi2 > lo2 ? hi2 : lo2 + (Math.abs(lo2) || 1);
      ch.scale = ch.sd && ch.sd > 1e-9 ? ch.sd : 1;
    });
    this.chIndex = Object.fromEntries(meta.channels.map((c, j) => [c.id, j]));
    const tl = meta.timeline;
    this.N = tl.n;
    this.t0 = Float64Array.from(tl.t0);
    this.seg = Int32Array.from(tl.seg);
    this.split = Int8Array.from(tl.split);
    this.y = Int8Array.from(tl.y);
    this.frac = Float32Array.from(tl.frac);
    this.evOf = Int32Array.from(tl.event);
    this.scorePos = Int32Array.from(tl.score_pos);
    this.nScored = this.scorePos.reduce((a, p) => a + (p >= 0 ? 1 : 0), 0);
    this.win = meta.time.win_s; this.hop = meta.time.hop_s; this.tol = meta.time.tol_s;
    // rows of the sensor matrix for every timeline tick, and pre-roll rows per segment
    this.row = new Int32Array(this.N);
    this.segInfo = {};
    const blocks = meta.blocks;
    let tlStart = 0;
    for (let b = 0; b < blocks.length; b++) {
      const bl = blocks[b];
      if (bl.kind === 'fit') this.fitBlock = bl;
      if (bl.kind !== 'eval') continue;
      const sg = meta.segments.find(s => s.name === bl.seg);
      const pre = b > 0 && blocks[b - 1].kind === 'pre' ? blocks[b - 1] : null;
      for (let i = 0; i < bl.n; i++) this.row[tlStart + i] = bl.start + i;
      this.segInfo[sg.idx] = Object.assign({}, sg, { tlStart, rowStart: bl.start, preRow: pre ? pre.start : bl.start, preN: pre ? pre.n : 0 });
      tlStart += bl.n;
    }
    this.segList = meta.segments.map(s => this.segInfo[s.idx]);
    this.segList.forEach(s => { s.rec_start = s.t_start; });
    // events of the evaluation period
    this.events = meta.events.filter(e => e.role === 'eval').sort((a, b) => a.start - b.start);
    this.eventById = Object.fromEntries(meta.events.map(e => [e.id, e]));
    this.models = meta.models;
    this.modelById = Object.fromEntries(meta.models.map(m => [m.id, m]));
    this._scores = {};
    TW.prepareEvents(this);
  }
  segOfTime(t) {
    for (const s of this.segList) if (t >= s.t_start - 1 && t <= s.t_end + 1) return s;
    return this.segList[0];
  }
  segOfTick(i) { return this.segInfo[this.seg[i]]; }
  value(i, j) { return this.S[this.row[i] * this.C + j]; }
  async loadModel(mid, onProgress) {
    if (this._scores[mid]) return this._scores[mid];
    const m = this.modelById[mid];
    const buf = await TW.fetchBin(`data/${m.file}`, onProgress);
    const all = new Float32Array(buf);
    const n = this.nScored;
    const runs = m.runs.map((r, i) => all.subarray(i * n, (i + 1) * n));
    this._scores[mid] = runs;
    return runs;
  }
  runIndex(mid, k, seed) {
    const m = this.modelById[mid];
    let i = m.runs.findIndex(r => r.k === k && r.seed === seed);
    if (i < 0) i = m.runs.findIndex(r => r.k === k);
    if (i < 0) i = 0;
    return i;
  }
};

TW.shortName = function (ds, id) {
  if (ds === 'hai') return id.replace(/^P[1-4]_/, '').replace(/^x(\d{4})_/, 'DCS$1·');
  const map = {
    'Accelerometer1RMS': 'Accel 1', 'Accelerometer2RMS': 'Accel 2', 'Volume Flow RateRMS': 'Flow',
    'WaterPumpToTank': 'Fill pump', 'WaterPumpFromTank': 'Irrig. pump', 'WaterLevel': 'Level', 'WaterTemperature': 'Water T',
    'LightIntensity': 'Light int.', 'SoilHumidity1': 'Soil 1', 'SoilHumidity2': 'Soil 2', 'AirQuality': 'Air q.', 'HeatIndex': 'Heat idx',
    'Pressure 1 Out': 'P1 out', 'Pressure 2 Out': 'P2 out', 'Pressure 3 In': 'P3 in', 'Pressure 4 In': 'P4 in',
    'Water Flow 1': 'Flow 1', 'Water Flow 2': 'Flow 2', 'Water Flow 3': 'Flow 3', 'Water Flow 4': 'Flow 4',
    'Analog Valve 1': 'Valve 1', 'Analog Valve 2': 'Valve 2', 'Trueb': 'Turbidity', 'Leit': 'Conduct.', 'Tp': 'Temp',
    'Cl': 'ClO₂ MS1', 'Cl_2': 'ClO₂ MS2', 'Fm': 'Flow L1', 'Fm_2': 'Flow L2',
  };
  return map[id] || id;
};
