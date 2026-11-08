/* What-if lab: fault injection into the replayed sensor stream and three detectors that run in the browser.
   Every point is referenced the same way as in the benchmark: a causal level (median of the preceding window of the same
   record, or the mean of the record's first minutes for short experiment records) and the scale of normal operation;
   the detectors are fitted on the normal record that precedes the evaluation period and alarm at their 99th
   percentile there (a 1% false-alarm budget). */
'use strict';

TW.Lab = class {
  constructor(ds) {
    this.ds = ds;
    const C = (this.C = ds.C), N = (this.N = ds.N);
    this.X = new Float32Array(N * C);
    for (let i = 0; i < N; i++) this.X.set(ds.S.subarray(ds.row[i] * C, ds.row[i] * C + C), i * C);
    this.Z = new Float32Array(N * C);
    this.injections = [];
    this.refMode = 'causal';
    this.detectors = [
      { id: 'point', label: 'Point deviation', sub: 'largest |z| of any point', colour: '#39b6ff' },
      { id: 'pca', label: 'PCA residual', sub: 'squared prediction error', colour: '#2fd38a' },
      { id: 'graph', label: 'Process-graph residual', sub: 'each point predicted from its graph neighbours', colour: '#ff8a3d' },
    ];
    this.injSet = new Set();
    this.fit();
    this.computeAll();
  }
  value(i, j) { return this.X[i * this.C + j]; }

  /* causal level of one channel over a record (pre-roll rows first), z of the record's ticks */
  levels(vals, policy) {
    const n = vals.length, out = new Float32Array(n);
    const ref = this.ds.meta.reference;
    if (policy === 'prefix') {
      const P = Math.max(1, ref.prefix_ticks);
      let s = 0;
      for (let t = 0; t < n; t++) {
        if (t < P) { s += vals[t]; out[t] = s / (t + 1); } else out[t] = s / P;
      }
      return out;
    }
    const W = Math.max(2, ref.level_ticks);
    const win = new Float64Array(W + 2); let m = 0;
    const ins = v => { let lo = 0, hi = m; while (lo < hi) { const md = (lo + hi) >> 1; if (win[md] < v) lo = md + 1; else hi = md; } win.copyWithin(lo + 1, lo, m); win[lo] = v; m++; };
    const del = v => { let lo = 0, hi = m; while (lo < hi) { const md = (lo + hi) >> 1; if (win[md] < v) lo = md + 1; else hi = md; } win.copyWithin(lo, lo + 1, m); m--; };
    for (let t = 0; t < n; t++) {
      out[t] = m ? (m % 2 ? win[(m - 1) >> 1] : 0.5 * (win[m / 2 - 1] + win[m / 2])) : vals[t];
      ins(vals[t]);
      if (m > W) del(vals[t - W]);
    }
    return out;
  }

  fit() {
    const ds = this.ds, C = this.C, fb = ds.fitBlock, n = fb.n;
    const use = ds.meta.fit.use;
    const Zf = new Float32Array(n * C);
    const col = new Float32Array(n);
    for (let j = 0; j < C; j++) {
      const ch = ds.meta.channels[j];
      for (let i = 0; i < n; i++) col[i] = ds.S[(fb.start + i) * C + j];
      const lv = this.refMode === 'fixed' ? null : this.levels(col, 'trailing');
      for (let i = 0; i < n; i++) Zf[i * C + j] = (col[i] - (lv ? lv[i] : ch.mu)) / ch.scale;
    }
    const rows = []; for (let i = 0; i < n; i++) if (use[i] && i > 20) rows.push(i);
    // channels that move in normal operation
    const mean = new Float64Array(C), sd = new Float64Array(C);
    for (const i of rows) for (let j = 0; j < C; j++) mean[j] += Zf[i * C + j];
    for (let j = 0; j < C; j++) mean[j] /= rows.length;
    for (const i of rows) for (let j = 0; j < C; j++) { const d = Zf[i * C + j] - mean[j]; sd[j] += d * d; }
    for (let j = 0; j < C; j++) sd[j] = Math.sqrt(sd[j] / Math.max(1, rows.length - 1));
    const act = []; for (let j = 0; j < C; j++) if (sd[j] > 1e-6) act.push(j);
    // a floor on the scale: points that barely move in normal operation would otherwise dominate every score
    this.sdRaw = Float64Array.from(sd);
    for (const j of act) sd[j] = Math.max(sd[j], 0.25);
    this.active = act; this.zMean = mean; this.zSd = sd;
    // PCA on the active channels
    const m = act.length;
    const cov = new Float64Array(m * m);
    for (const i of rows) for (let a = 0; a < m; a++) {
      const da = (Zf[i * C + act[a]] - mean[act[a]]) / sd[act[a]];
      for (let b = a; b < m; b++) cov[a * m + b] += da * (Zf[i * C + act[b]] - mean[act[b]]) / sd[act[b]];
    }
    for (let a = 0; a < m; a++) for (let b = a; b < m; b++) { cov[a * m + b] /= rows.length - 1; cov[b * m + a] = cov[a * m + b]; }
    const { vals, vecs } = TW.jacobi(cov, m);
    const order = Array.from(vals.keys()).sort((a, b) => vals[b] - vals[a]);
    const tot = vals.reduce((a, b) => a + Math.max(0, b), 0);
    let acc = 0, k = 0;
    while (k < m - 1 && acc / tot < 0.9) { acc += Math.max(0, vals[order[k]]); k++; }
    this.pcK = Math.max(1, k);
    this.pcV = order.slice(0, this.pcK).map(c => { const v = new Float64Array(m); for (let a = 0; a < m; a++) v[a] = vecs[a * m + c]; return v; });
    // graph regressions on the process graph
    const nb = Array.from({ length: C }, () => []);
    for (const [a, b] of ds.meta.graph.process) { nb[a].push(b); nb[b].push(a); }
    const actSet = new Set(act);
    this.reg = [];
    for (const j of act) {
      const N_ = nb[j].filter(x => actSet.has(x) && x !== j);
      if (!N_.length) { this.reg.push({ j, N: [], beta: [], sd: 1 }); continue; }
      const d = N_.length;
      const A = new Float64Array(d * d), bvec = new Float64Array(d);
      for (const i of rows) {
        const y = (Zf[i * C + j] - mean[j]) / sd[j];
        for (let a = 0; a < d; a++) {
          const xa = (Zf[i * C + N_[a]] - mean[N_[a]]) / sd[N_[a]];
          bvec[a] += xa * y;
          for (let b = a; b < d; b++) A[a * d + b] += xa * (Zf[i * C + N_[b]] - mean[N_[b]]) / sd[N_[b]];
        }
      }
      for (let a = 0; a < d; a++) { for (let b = 0; b < a; b++) A[a * d + b] = A[b * d + a]; A[a * d + a] += 0.05 * rows.length; }
      const beta = TW.solve(A, bvec, d);
      let ss = 0;
      for (const i of rows) {
        let yh = 0;
        for (let a = 0; a < d; a++) yh += beta[a] * (Zf[i * C + N_[a]] - mean[N_[a]]) / sd[N_[a]];
        const r = (Zf[i * C + j] - mean[j]) / sd[j] - yh; ss += r * r;
      }
      this.reg.push({ j, N: N_, beta, sd: Math.max(0.05, Math.sqrt(ss / (rows.length - 1))) });
    }
    // thresholds: 99th percentile of the fit scores
    const sc = { point: [], pca: [], graph: [] };
    const zrow = new Float32Array(C);
    for (const i of rows) {
      for (let j = 0; j < C; j++) zrow[j] = Zf[i * C + j];
      const s = this.scoreRow(zrow);
      sc.point.push(s.point); sc.pca.push(s.pca); sc.graph.push(s.graph);
    }
    this.detectors.forEach(d => { d.thr = Math.max(1e-6, TW.quantile(sc[d.id], 0.99)); });
  }

  scoreRow(z) {
    const C = this.C, act = this.active, mean = this.zMean, sd = this.zSd;
    let point = 0;
    for (const j of act) { const a = Math.min(20, Math.abs((z[j] - mean[j]) / sd[j])); if (a > point) point = a; }
    // inactive points (constant in normal operation) only count when they move
    let still = 0;
    for (let j = 0; j < C; j++) if (sd[j] <= 1e-6) { const a = Math.abs(z[j] - mean[j]); if (a > still) still = a; }
    still = Math.min(still, 20);
    point = Math.max(point, still);
    const m = act.length, u = this._u || (this._u = new Float64Array(m));
    for (let a = 0; a < m; a++) u[a] = TW.clamp((z[act[a]] - mean[act[a]]) / sd[act[a]], -20, 20);
    let spe = 0, proj2 = 0;
    for (let a = 0; a < m; a++) spe += u[a] * u[a];
    for (const v of this.pcV) { let p = 0; for (let a = 0; a < m; a++) p += v[a] * u[a]; proj2 += p * p; }
    spe = Math.max(0, spe - proj2) + still * still;
    let gmax = 0;
    for (const r of this.reg) {
      let yh = 0;
      for (let a = 0; a < r.N.length; a++) yh += r.beta[a] * TW.clamp((z[r.N[a]] - mean[r.N[a]]) / sd[r.N[a]], -20, 20);
      const res = Math.min(20, Math.abs((TW.clamp((z[r.j] - mean[r.j]) / sd[r.j], -20, 20) - yh) / r.sd));
      if (res > gmax) gmax = res;
    }
    gmax = Math.max(gmax, still);
    return { point, pca: spe, graph: gmax };
  }

  /* z of the evaluation timeline for channel j (pre-roll included in the causal level) */
  computeZ(j) {
    const ds = this.ds, C = this.C, ch = ds.meta.channels[j];
    for (const sg of ds.segList) {
      const n = sg.n, pre = sg.preN;
      const vals = new Float32Array(pre + n);
      for (let i = 0; i < pre; i++) vals[i] = ds.S[(sg.preRow + i) * C + j];
      for (let i = 0; i < n; i++) vals[pre + i] = this.X[(sg.tlStart + i) * C + j];
      const lv = this.refMode === 'fixed' ? null : this.levels(vals, sg.policy);
      for (let i = 0; i < n; i++) this.Z[(sg.tlStart + i) * C + j] = (vals[pre + i] - (lv ? lv[pre + i] : ch.mu)) / ch.scale;
    }
  }

  computeAll() {
    for (let j = 0; j < this.C; j++) this.computeZ(j);
    this.scoreFrom(0);
  }

  scoreFrom(i0) {
    const N = this.N, C = this.C;
    if (!this.scores) this.scores = { point: new Float32Array(N), pca: new Float32Array(N), graph: new Float32Array(N) };
    for (let i = i0; i < N; i++) {
      const s = this.scoreRow(this.Z.subarray(i * C, i * C + C));
      this.scores.point[i] = s.point; this.scores.pca[i] = s.pca; this.scores.graph[i] = s.graph;
    }
    this.evaluate();
  }

  /* event recall and false alarms of each detector on the replay, with the same event metrics as the replay */
  evaluate() {
    const ds = this.ds;
    this.results = {};
    for (const d of this.detectors) {
      const sc = new Float32Array(ds.nScored);
      for (let i = 0; i < ds.N; i++) { const p = ds.scorePos[i]; if (p >= 0) sc[p] = this.scores[d.id][i]; }
      this.results[d.id] = TW.evaluateRun(ds, sc, d.thr);
    }
    for (const inj of this.injections) this.judge(inj);
  }

  judge(inj) {
    const tolT = Math.ceil(this.ds.tol / this.ds.hop) + 1;
    inj.det = {};
    for (const d of this.detectors) {
      let hit = -1;
      for (let i = inj.start; i <= Math.min(this.N - 1, inj.start + inj.dur + tolT); i++) if (this.scores[d.id][i] >= d.thr) { hit = i; break; }
      inj.det[d.id] = hit >= 0 ? (hit - inj.start) * this.ds.hop + this.ds.win : null;
      if (hit >= 0 && hit === inj.start && this.scores[d.id][Math.max(0, inj.start - 1)] >= d.thr) inj.det[d.id + '_pre'] = true;
    }
  }

  setRef(mode) {
    this.refMode = mode;
    this.fit();
    this.computeAll();
  }

  /* inject a fault: steps [{ch, type, mag, value}] from tick start for dur ticks */
  inject(spec) {
    const ds = this.ds, C = this.C;
    const start = Math.max(0, Math.min(this.N - 2, Math.round(spec.start)));
    const dur = Math.max(1, Math.round(spec.dur));
    const sg = ds.segOfTick(start);
    const end = Math.min(sg.tlStart + sg.n - 1, start + dur);
    const inj = { id: (this._id = (this._id || 0) + 1), name: spec.name, desc: spec.desc || '', start, dur: end - start, steps: spec.steps, chs: [] };
    let seed = inj.id * 9973;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (const st of spec.steps) {
      const j = typeof st.ch === 'number' ? st.ch : ds.chIndex[st.ch];
      if (j === undefined) continue;
      const ch = ds.meta.channels[j];
      const R = ch.dhi - ch.dlo || Math.abs(ch.dhi) || 1;
      const x0 = this.X[start * C + j];
      for (let i = start; i <= end; i++) {
        const f = (i - start) / Math.max(1, end - start);
        const k = i * C + j;
        let v = this.X[k];
        switch (st.type) {
          case 'bias': v = v + st.mag * R; break;
          case 'drift': v = v + st.mag * R * f; break;
          case 'scale': v = v * (1 + st.mag * Math.min(1, f * 4)); break;
          case 'freeze': v = x0; break;
          case 'noise': v = v + st.mag * R * gauss(); break;
          case 'replay': { const src = i - (end - start) - 1; v = src >= sg.tlStart ? ds.S[ds.row[src] * C + j] : x0; break; }
          case 'set': v = st.value !== undefined ? st.value : ch.dlo + st.mag * R; break;
          case 'toggle': v = x0 > 0.5 ? 0 : 1; break;
          default: break;
        }
        if (ch.binary && st.type !== 'noise') v = v > 0.5 ? 1 : 0;
        this.X[k] = v;
      }
      inj.chs.push(j); this.injSet.add(j);
      this.computeZ(j);
    }
    this.injections.push(inj);
    this.scoreFrom(sg.tlStart);
    return inj;
  }

  clear() {
    const ds = this.ds, C = this.C;
    for (let i = 0; i < this.N; i++) this.X.set(ds.S.subarray(ds.row[i] * C, ds.row[i] * C + C), i * C);
    this.injections = []; this.injSet = new Set();
    this.computeAll();
  }

  injectedAt(i) {
    const s = new Set();
    for (const inj of this.injections) if (i >= inj.start && i <= inj.start + inj.dur) inj.chs.forEach(j => s.add(j));
    return s;
  }
};

/* eigen-decomposition of a symmetric matrix (cyclic Jacobi) */
TW.jacobi = function (A0, n) {
  const A = Float64Array.from(A0), V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] * A[p * n + q];
    if (off < 1e-12) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p * n + q];
      if (Math.abs(apq) < 1e-14) continue;
      const app = A[p * n + p], aqq = A[q * n + q];
      const th = (aqq - app) / (2 * apq);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k * n + p], akq = A[k * n + q];
        A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p * n + k], aqk = A[q * n + k];
        A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k * n + p], vkq = V[k * n + q];
        V[k * n + p] = c * vkp - s * vkq; V[k * n + q] = s * vkp + c * vkq;
      }
    }
  }
  const vals = new Float64Array(n);
  for (let i = 0; i < n; i++) vals[i] = A[i * n + i];
  return { vals, vecs: V };
};

/* solve A x = b (symmetric positive definite, Gaussian elimination with partial pivoting) */
TW.solve = function (A0, b0, n) {
  const A = Float64Array.from(A0), b = Float64Array.from(b0);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
    if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
    const d = A[c * n + c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    x[r] = s / (A[r * n + r] || 1e-12);
  }
  return x;
};

/* scenario presets (synthetic, illustrative); magnitudes in units of the point's normal range */
TW.SCENARIOS = {
  hai: [
    { name: 'Level reading frozen while the valve opens', desc: 'P1: LIT01 shows a frozen level while LCV01 opens further and the feed flow rises, an inconsistency between coupled points.', dur: 20,
      steps: [{ ch: 'P1_LIT01', type: 'freeze' }, { ch: 'P1_LCV01Z', type: 'drift', mag: 0.6 }, { ch: 'P1_LCV01D', type: 'drift', mag: 0.6 }, { ch: 'P1_FT01Z', type: 'drift', mag: 0.35 }] },
    { name: 'Feedwater pump PP01B trips', desc: 'P1: the running feedwater pump stops; feed flow and boiler pressure fall.', dur: 12,
      steps: [{ ch: 'P1_PP01BR', type: 'set', value: 0 }, { ch: 'P1_FT01Z', type: 'scale', mag: -0.8 }, { ch: 'P1_PIT01', type: 'scale', mag: -0.5 }] },
    { name: 'Turbine over-speed command', desc: 'P2: the speed set-point is pushed up; speed and shaft vibration rise.', dur: 16,
      steps: [{ ch: 'P2_SIT01', type: 'drift', mag: 0.8 }, { ch: 'P2_VIBTR01', type: 'noise', mag: 0.6 }, { ch: 'P2_VIBTR02', type: 'noise', mag: 0.6 }] },
    { name: 'Upper-tank pump forced off', desc: 'P3: LCP01 is switched off; the upper tank drains and the discharge falls.', dur: 24,
      steps: [{ ch: 'P3_LCP01D', type: 'set', value: 0 }, { ch: 'P3_LIT01', type: 'drift', mag: -0.7 }, { ch: 'P3_FIT01', type: 'scale', mag: -0.5 }] },
    { name: 'Spoofed boiler pressure (replayed)', desc: 'P1: PIT01 replays an earlier recording (stealthy for a per-point check) while the pressure valve moves.', dur: 20,
      steps: [{ ch: 'P1_PIT01', type: 'replay' }, { ch: 'P1_PCV01Z', type: 'drift', mag: 0.5 }, { ch: 'P1_PCV01D', type: 'drift', mag: 0.5 }] },
  ],
  skab: [
    { name: 'Outlet valve closing', desc: 'Flow falls, the pressure after the pump rises and the motor current drops.', dur: 8,
      steps: [{ ch: 'Volume Flow RateRMS', type: 'drift', mag: -1.2 }, { ch: 'Pressure', type: 'drift', mag: 0.8 }, { ch: 'Current', type: 'drift', mag: -0.4 }] },
    { name: 'Rotor imbalance', desc: 'Both accelerometers on the pump vibrate more.', dur: 10,
      steps: [{ ch: 'Accelerometer1RMS', type: 'bias', mag: 1.5 }, { ch: 'Accelerometer2RMS', type: 'bias', mag: 1.5 }] },
    { name: 'Hot water supply', desc: 'The fluid temperature in the loop rises.', dur: 12, steps: [{ ch: 'Thermocouple', type: 'drift', mag: 3 }] },
    { name: 'Frozen pressure sensor', desc: 'The pressure reading sticks at its last value.', dur: 12, steps: [{ ch: 'Pressure', type: 'freeze' }] },
  ],
  smartfarm: [
    { name: 'Irrigation pump forced on', desc: 'Actuator switching: the irrigation pump runs, the tank level drops and the soil gets wetter.', dur: 30,
      steps: [{ ch: 'WaterPumpFromTank', type: 'set', value: 1 }, { ch: 'WaterLevel', type: 'drift', mag: -0.5 }, { ch: 'SoilHumidity1', type: 'drift', mag: 0.5 }, { ch: 'SoilHumidity2', type: 'drift', mag: 0.5 }] },
    { name: 'Injected water-level value', desc: 'The level sensor reports a false value; nothing else changes.', dur: 20, steps: [{ ch: 'WaterLevel', type: 'bias', mag: 0.8 }] },
    { name: 'Grow light switched', desc: 'Actuator switching of the grow light.', dur: 30, steps: [{ ch: 'Light', type: 'toggle' }] },
    { name: 'Air-temperature sensor frozen', desc: 'The climate station keeps reporting the same temperature.', dur: 60, steps: [{ ch: 'Temperature', type: 'freeze' }] },
  ],
  wdsevent: [
    { name: 'Leak on line 3', desc: 'The inlet pressure of line 3 falls while its flow rises.', dur: 10,
      steps: [{ ch: 'Pressure 3 In', type: 'drift', mag: -1.0 }, { ch: 'Water Flow 3', type: 'drift', mag: 0.6 }] },
    { name: 'Pressure transmitter failure', desc: 'Pressure 1 Out drops to zero.', dur: 8, steps: [{ ch: 'Pressure 1 Out', type: 'set', value: 0 }] },
    { name: 'Drive of pump 1 attacked', desc: 'VFD 1 is slowed down; pressure and flow of line 1 follow.', dur: 10,
      steps: [{ ch: 'VFD 1', type: 'bias', mag: -1.2 }, { ch: 'Pressure 1 Out', type: 'drift', mag: -0.8 }, { ch: 'Water Flow 1', type: 'drift', mag: -0.6 }] },
    { name: 'Analog valve 2 forced shut', desc: 'Valve 2 closes; flow on line 2 falls.', dur: 10,
      steps: [{ ch: 'Analog Valve 2', type: 'set', value: 10 }, { ch: 'Water Flow 2', type: 'scale', mag: -0.6 }] },
  ],
  gecco: [
    { name: 'Contamination event', desc: 'Turbidity and conductivity rise while chlorine dioxide and redox fall.', dur: 20,
      steps: [{ ch: 'Trueb', type: 'drift', mag: 3 }, { ch: 'Cl', type: 'drift', mag: -0.8 }, { ch: 'Leit', type: 'bias', mag: 0.8 }, { ch: 'Redox', type: 'drift', mag: -0.8 }] },
    { name: 'Disinfectant dosing failure', desc: 'Chlorine dioxide falls at both measuring stations; redox follows.', dur: 24,
      steps: [{ ch: 'Cl', type: 'drift', mag: -1.2 }, { ch: 'Cl_2', type: 'drift', mag: -1.2 }, { ch: 'Redox', type: 'drift', mag: -0.8 }] },
    { name: 'pH sensor drift', desc: 'A slow drift of the pH probe only.', dur: 40, steps: [{ ch: 'pH', type: 'drift', mag: 1.5 }] },
    { name: 'Flow change (operational, not an event)', desc: 'Line 1 throttled, line 2 opened: operational data change, quality unchanged.', dur: 30,
      steps: [{ ch: 'Fm', type: 'scale', mag: -0.4 }, { ch: 'Fm_2', type: 'scale', mag: 0.3 }] },
  ],
};
