/* Event metrics of the benchmark (code/metrics.py, run_generic.evaluate), ported for the replay.
   A window is credited to an event if it overlaps [start, end + tolerance]; an event is detected if a credited
   window is flagged; an alarm episode (run of consecutive flagged windows of one record) is a false alarm if none
   of its windows is credited. Window precision uses the unambiguous windows; event F1 is the harmonic mean of
   event recall and window precision; false alarms are counted per hour of normal operation. */
'use strict';

TW.prepareEvents = function (ds) {
  const N = ds.N, win = ds.win, tol = ds.tol;
  ds.credited = new Uint8Array(N);
  ds.scored = new Uint8Array(N);
  for (let i = 0; i < N; i++) ds.scored[i] = ds.scorePos[i] >= 0 ? 1 : 0;
  // cumulative normal (label-free) scored windows -> normal hours so far
  ds.cumNormal = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) ds.cumNormal[i + 1] = ds.cumNormal[i] + (ds.scored[i] && ds.frac[i] === 0 ? ds.hop / 3600 : 0);
  ds.normalHours = ds.cumNormal[N];
  for (const e of ds.events) {
    const sg = ds.segList.find(s => s.name === e.seg);
    e.segIdx = sg.idx;
    e.ticks = [];
    let lab0 = -1, lab1 = -1;
    for (let i = sg.tlStart; i < sg.tlStart + sg.n; i++) {
      const t0 = ds.t0[i], t1 = t0 + win;
      if (t1 > e.start && t0 <= e.end && lab0 < 0) lab0 = i;
      if (t1 > e.start && t0 <= e.end) lab1 = i;
      if (!ds.scored[i]) continue;
      if (t1 > e.start && t0 <= e.end + tol) { e.ticks.push(i); ds.credited[i] = 1; }
    }
    e.first = e.ticks.length ? e.ticks[0] : lab0;
    e.last = e.ticks.length ? e.ticks[e.ticks.length - 1] : lab1;
    e.labStart = lab0 >= 0 ? lab0 : e.first;
    e.labEnd = lab1 >= 0 ? lab1 : e.last;
  }
  // per tick: active event (label interval) for banners
  ds.activeEvent = new Int32Array(N).fill(-1);
  ds.events.forEach((e, k) => { for (let i = e.labStart; i <= e.labEnd && i >= 0; i++) ds.activeEvent[i] = k; });
};

/* flags of one run at a threshold, and every quantity needed for the live counters */
TW.evaluateRun = function (ds, scores, thr) {
  const N = ds.N;
  const flags = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = ds.scorePos[i];
    if (p >= 0 && scores[p] >= thr) flags[i] = 1;
  }
  // cumulative window counts for precision so far
  const cumFlagPos = new Int32Array(N + 1), cumFlagUnamb = new Int32Array(N + 1), cumFlag = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) {
    const f = flags[i];
    cumFlag[i + 1] = cumFlag[i] + f;
    cumFlagUnamb[i + 1] = cumFlagUnamb[i] + (f && ds.y[i] >= 0 ? 1 : 0);
    cumFlagPos[i + 1] = cumFlagPos[i] + (f && ds.y[i] === 1 ? 1 : 0);
  }
  // events
  const evs = ds.events.map(e => {
    let det = -1;
    for (const i of e.ticks) if (flags[i]) { det = i; break; }
    const delay = det >= 0 ? Math.max(0, ds.t0[det] + ds.win - e.start) : NaN;
    return { e, det, delay };
  });
  // alarm episodes per record (runs of consecutive flagged scored windows)
  const eps = [];
  for (const sg of ds.segList) {
    let a = -1, cred = false, last = -1;
    for (let i = sg.tlStart; i < sg.tlStart + sg.n; i++) {
      if (!ds.scored[i]) continue;
      if (flags[i]) {
        if (a < 0) { a = i; cred = false; }
        if (ds.credited[i]) cred = true;
        last = i;
      } else if (a >= 0) { eps.push({ a, b: last, cred }); a = -1; }
    }
    if (a >= 0) eps.push({ a, b: last, cred });
  }
  const R = { thr, flags, cumFlag, cumFlagPos, cumFlagUnamb, evs, eps };
  R.final = TW.liveAt(ds, R, N - 1);
  return R;
};

/* counters up to timeline tick T (inclusive) */
TW.liveAt = function (ds, R, T) {
  T = Math.max(0, Math.min(ds.N - 1, Math.floor(T)));
  const tNow = ds.t0[T] + ds.win;
  let started = 0, detected = 0, missed = 0, pending = 0, dsum = 0;
  for (const x of R.evs) {
    const e = x.e;
    if (e.start >= tNow) continue;
    started++;
    if (x.det >= 0 && x.det <= T) { detected++; dsum += x.delay; }
    else if (e.last < T || T === ds.N - 1) missed++;
    else pending++;
  }
  let fa = 0, active = null;
  for (const p of R.eps) {
    if (p.a > T) break;
    if (p.b <= T) { if (!p.cred) fa++; }
    else active = p;
  }
  if (active && T === ds.N - 1 && !active.cred) fa++;
  const flagged = R.cumFlagUnamb[T + 1], tp = R.cumFlagPos[T + 1];
  const wp = flagged ? tp / flagged : 0;
  const er = started ? detected / started : NaN;
  const nh = ds.cumNormal[T + 1];
  return {
    started, detected, missed, pending, er, wp,
    f1e: started ? (2 * wp * er) / Math.max(wp + er, 1e-12) : NaN,
    fa, faph: nh > 0 ? fa / nh : NaN, normalH: nh,
    delay: detected ? dsum / detected : NaN,
    flaggedAll: R.cumFlag[T + 1], activeEpisode: active,
  };
};

/* robust display scale of a run's scores (monotone, so threshold crossings are preserved) */
TW.scoreScale = function (scores, thr) {
  const lo = TW.quantile(scores, 0.02), hi = Math.max(TW.quantile(scores, 0.998), thr);
  const span = hi - lo || 1;
  return { lo, hi, f: v => (v - lo) / span, thrN: (thr - lo) / span };
};
