/* Water Digital Twin — application: routing, replay engine, panels, what-if lab */
'use strict';
(function () {
  const h = TW.h, $ = TW.$;
  const FAMILY = [
    ['Tabular foundation models', ['tabpfn_v1', 'tabpfn_v2', 'tabicl']],
    ['Graph neural networks', ['gnn_process', 'gnn_corr', 'gnn_none']],
    ['Few-label deep detectors', ['deepsad', 'devnet']],
    ['Tabular baseline', ['hgb']],
    ['Zero-label references', ['iforest', 'pca_spe', 'usad', 'gdn', 'chronos']],
  ];
  const SPEEDS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const EV_ICON = { leak: '💧', 'sensor failure': '⚡', cyberattack: '☠' };

  const S = (TW.state = {
    id: null, ds: null, lab: null, view: '2d', mode: 'replay',
    model: 'tabpfn_v1', k: null, seed: 0, thrMode: 'val', manualQ: 0.98,
    tick: 0, playing: false, speed: 20, sel: new Set(), inj: new Set(),
    log: [], logUpTo: -1, lastTick: -1, all: null, injectCh: null,
  });
  TW.S = S;

  /* ------------------------------------------------------------------ routing */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, q] = raw.split('?');
    const params = new URLSearchParams(q || '');
    return { id: path || '', view: params.get('view'), mode: params.get('mode') };
  }
  function setHash() {
    if (!S.id) return;
    const q = new URLSearchParams();
    if (S.view !== '2d') q.set('view', S.view);
    if (S.mode !== 'replay') q.set('mode', S.mode);
    const hsh = '#/' + S.id + (q.toString() ? '?' + q : '');
    if (location.hash !== hsh) history.replaceState(null, '', hsh);
  }
  async function route() {
    const r = parseHash();
    if (!r.id || !TW.datasets.includes(r.id)) { showHome(); return; }
    if (r.view) S.view = r.view === '3d' ? '3d' : '2d';
    if (r.mode) S.mode = r.mode === 'lab' ? 'lab' : 'replay';
    if (S.id !== r.id) await openTwin(r.id);
    else { applyView(); applyMode(); }
  }
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------------------ header */
  function rotBtn() {
    const b = $('#rotBtn');
    b.onclick = () => { if (!S.v3d) return; S.v3d.autoRotate = !S.v3d.autoRotate; b.classList.toggle('on', S.v3d.autoRotate); };
  }

  function buildHeader() {
    rotBtn();
    const tabs = $('#tabs');
    TW.datasets.forEach(id => {
      tabs.appendChild(h('a', { href: '#/' + id, class: 'tab', 'data-id': id }, TW.NAMES[id]));
    });
    $('#viewSeg').addEventListener('click', e => { const v = e.target.dataset.v; if (v) { S.view = v; applyView(); setHash(); } });
    $('#modeSeg').addEventListener('click', e => { const m = e.target.dataset.m; if (m) { S.mode = m; applyMode(); setHash(); } });
    $('#aboutBtn').addEventListener('click', () => $('#about').classList.remove('hidden'));
    $('#about').addEventListener('click', e => { if (e.target.id === 'about' || e.target.classList.contains('close')) $('#about').classList.add('hidden'); });
  }
  TW.NAMES = { hai: 'HAI 23.05', skab: 'SKAB', smartfarm: 'Smart-Farm-IDS', wdsevent: 'WDSEventDB', gecco: 'GECCO 2018' };

  /* ------------------------------------------------------------------ home */
  async function showHome() {
    S.playing = false;
    $('#twin').classList.add('hidden'); $('#home').classList.remove('hidden');
    document.body.classList.add('at-home');
    TW.$$('.tab').forEach(t => t.classList.remove('active'));
    if ($('#home').dataset.built) return;
    $('#home').dataset.built = '1';
    let idx = [];
    try { idx = await TW.fetchJSON('data/index.json'); } catch (e) { console.error(e); }
    const grid = $('#cards');
    idx.forEach(d => {
      const hours = d.seconds / 3600;
      grid.appendChild(h('a', { class: 'pcard', href: '#/' + d.id },
        h('div', { class: 'pcard-art', html: TW.ART[d.id] || '' }),
        h('div', { class: 'pcard-body' },
          h('div', { class: 'pcard-kind' }, d.kind),
          h('h3', null, d.name),
          h('p', null, d.title),
          h('div', { class: 'pcard-facts' },
            h('span', null, h('b', null, d.channels), ' sensors'),
            h('span', null, h('b', null, d.events), ' evaluation events'),
            h('span', null, h('b', null, hours >= 48 ? (hours / 24).toFixed(0) + ' d' : hours.toFixed(1) + ' h'), ' replay'),
            h('span', null, h('b', null, d.runs), ' runs')),
          h('div', { class: 'pcard-best' },
            'Best ranker: ', h('b', null, d.best_sup[0]), ' AUROC ', d.best_sup[1].toFixed(2),
            ' · best zero-label: ', h('b', null, d.best_ref[0]), ' ', d.best_ref[1].toFixed(2)),
          h('div', { class: 'pcard-go' }, 'Open the twin →'))));
    });
  }

  /* ------------------------------------------------------------------ twin */
  async function openTwin(id) {
    S.playing = false;
    $('#home').classList.add('hidden'); $('#twin').classList.remove('hidden');
    document.body.classList.remove('at-home');
    TW.$$('.tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
    const load = $('#loading');
    load.classList.remove('hidden'); load.textContent = 'Loading ' + TW.NAMES[id] + '…';
    teardown();
    S.id = id; S.ds = null; S.R = null; S.lab = null; S.inspect = null;
    let ds;
    try {
      ds = await TW.loadDataset(id, p => { load.textContent = `Loading ${TW.NAMES[id]} sensors… ${Math.round(p * 100)}%`; });
    } catch (e) { load.textContent = 'Could not load the data: ' + e.message; return; }
    S.ds = ds;
    load.textContent = 'Fitting the in-browser detectors…';
    await new Promise(r => setTimeout(r, 20));
    S.lab = new TW.Lab(ds);
    S.plant = TW.plants[id];
    S.k = ds.meta.full_k; S.seed = 0; S.tick = firstInteresting(ds); S.sel = new Set(); S.all = null;
    S.injectCh = null;
    if (!ds.modelById[S.model]) S.model = 'tabpfn_v1';
    S.speed = id === 'gecco' ? 50 : id === 'hai' ? 20 : 5;
    buildStage();
    buildSide();
    buildTransport();
    buildCharts();
    await setRun();
    load.classList.add('hidden');
    applyView(); applyMode();
    setHash();
    S.lastTick = -1;
  }

  function firstInteresting(ds) {
    const e = ds.events[0];
    if (!e) return 0;
    const sg = ds.segOfTick(Math.max(0, e.labStart));
    let first = sg.tlStart;
    while (first < sg.tlStart + sg.n && !ds.scored[first]) first++;
    return Math.max(first, e.labStart - 20);
  }

  function teardown() {
    if (S.v2d) { S.v2d.destroy(); S.v2d = null; }
    if (S.v3d) { S.v3d.destroy(); S.v3d = null; }
    ['#v2d', '#v3d', '#side', '#transport', '#overviewHost', '#chartsHost'].forEach(s => { $(s).innerHTML = ''; });
  }

  /* ------------------------------------------------------------------ stage */
  function buildStage() {
    const ds = S.ds;
    S.v2d = new TW.View2D($('#v2d'), ds, S.plant, { onPick: pick });
    $('#hudTitle').textContent = ds.meta.name;
    $('#hudSub').textContent = ds.meta.title;
    $('#plantNote').textContent = S.plant.note || '';
  }

  function applyView() {
    TW.$$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
    if (!S.ds) return;
    if (S.view === '3d' && !S.v3d) {
      try { S.v3d = new TW.View3D($('#v3d'), S.ds, S.plant, { onPick: pick }); }
      catch (e) { console.error(e); toast('3D view unavailable: ' + e.message); S.view = '2d'; }
    }
    $('#v2d').classList.toggle('hidden', S.view !== '2d');
    $('#v3d').classList.toggle('hidden', S.view !== '3d');
    $('#stage').classList.toggle('is3d', S.view === '3d');
    if (S.v3d) S.v3d.resize();
  }

  function applyMode() {
    TW.$$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.mode));
    document.body.classList.toggle('lab-mode', S.mode === 'lab');
    if (!S.ds) return;
    TW.$$('.replay-only').forEach(e => e.classList.toggle('hidden', S.mode !== 'replay'));
    TW.$$('.lab-only').forEach(e => e.classList.toggle('hidden', S.mode !== 'lab'));
    if (S.labChart) S.labChart.resize();
    S.lastTick = -1;
  }

  /* ------------------------------------------------------------------ side panel */
  function card(title, hint, ...kids) {
    return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('span', null, title), hint ? h('span', { class: 'hint' }, hint) : null), ...kids);
  }

  function buildSide() {
    const side = $('#side'), ds = S.ds;
    // detector card
    const sel = h('select', { id: 'selModel', onchange: e => { S.model = e.target.value; refreshChips(); setRun(); } });
    FAMILY.forEach(([fam, ids]) => {
      const og = h('optgroup', { label: fam });
      ids.forEach(mid => { if (ds.modelById[mid]) og.appendChild(h('option', { value: mid }, ds.modelById[mid].label)); });
      sel.appendChild(og);
    });
    sel.value = S.model;
    const thrSeg = h('div', { class: 'seg small', id: 'segThr' },
      h('button', { 'data-t': 'val' }, 'Validation F1'), h('button', { 'data-t': 'nb' }, '1% budget'), h('button', { 'data-t': 'manual' }, 'Manual'));
    thrSeg.addEventListener('click', e => { const t = e.target.dataset.t; if (t) { S.thrMode = t; setRun(); } });
    const slider = h('input', { type: 'range', min: 0.5, max: 0.9995, step: 0.0005, value: S.manualQ, id: 'thrSlider',
      oninput: e => { S.manualQ = +e.target.value; S.thrMode = 'manual'; setRun(true); } });
    side.appendChild(card('Detector', 'recorded scores of every run',
      h('label', null, 'Model'), sel,
      h('label', null, 'Labelled events', h('span', { class: 'lhint' }, 'label budget k')), h('div', { class: 'chips', id: 'chipsK' }),
      h('label', null, 'Label draw'), h('div', { class: 'chips', id: 'chipsSeed' }),
      h('label', null, 'Alarm threshold θ'), thrSeg,
      h('div', { class: 'slider-row' }, h('span', null, 'lenient'), slider, h('span', null, 'strict')),
      h('div', { class: 'runinfo', id: 'runInfo' })));
    // live results
    side.appendChild(card('Live results', 'up to the replay cursor',
      h('div', { class: 'kpis' },
        kpi('kDet', 'events detected'), kpi('kRec', 'event recall'), kpi('kFA', 'false alarms'),
        kpi('kWP', 'window precision'), kpi('kF1', 'event F1'), kpi('kDelay', 'mean delay')),
      h('div', { class: 'evdots', id: 'evDots' }),
      h('div', { class: 'artline', id: 'artLine' })));
    // event log
    side.appendChild(h('div', { class: 'card replay-only' }, h('div', { class: 'card-h' }, h('span', null, 'Event log'), h('span', { class: 'hint' }, 'newest first')),
      h('div', { class: 'log', id: 'log' })));
    // all detectors
    side.appendChild(h('div', { class: 'card replay-only', id: 'allCard' }, h('div', { class: 'card-h' }, h('span', null, 'All detectors at this moment'), h('span', { class: 'hint' }, 'same k and draw')),
      h('div', { id: 'allBody' }, h('button', { class: 'btn', onclick: loadAll }, 'Load all ' + ds.models.length + ' detectors'))));
    buildLabSide(side);
    refreshChips();
  }
  function kpi(id, label) { return h('div', { class: 'kpi' }, h('b', { id }, '–'), h('span', null, label)); }

  function refreshChips() {
    const ds = S.ds, m = ds.modelById[S.model];
    const ks = m.budgets;
    if (!ks.includes(S.k)) S.k = ks.includes(ds.meta.full_k) ? ds.meta.full_k : ks[ks.length - 1];
    const ck = $('#chipsK'); ck.innerHTML = '';
    ks.forEach(k => ck.appendChild(h('button', { class: 'chip' + (k === S.k ? ' on' : ''), onclick: () => { S.k = k; refreshChips(); setRun(); } }, k === 0 ? 'none (zero-label)' : String(k))));
    const seeds = [...new Set(m.runs.filter(r => r.k === S.k).map(r => r.seed))];
    if (!seeds.includes(S.seed)) S.seed = seeds[0];
    const cs = $('#chipsSeed'); cs.innerHTML = '';
    seeds.forEach(sd => cs.appendChild(h('button', { class: 'chip' + (sd === S.seed ? ' on' : ''), onclick: () => { S.seed = sd; refreshChips(); setRun(); } }, (ks[0] === 0 ? 'seed ' : 'draw ') + (sd + 1))));
  }

  let setRunToken = 0;
  async function setRun(fast) {
    const ds = S.ds, m = ds.modelById[S.model];
    const tok = ++setRunToken;
    const ri = ds.runIndex(S.model, S.k, S.seed);
    const run = m.runs[ri];
    if (!fast) $('#runInfo').textContent = 'Loading scores…';
    const runs = await ds.loadModel(S.model);
    if (tok !== setRunToken) return;
    const scores = runs[ri];
    let thr = run.thr;
    if (S.thrMode === 'nb' && run.thr_nb !== null && run.thr_nb !== undefined) thr = run.thr_nb;
    if (S.thrMode === 'manual') thr = TW.quantile(scores, S.manualQ);
    S.run = run; S.scores = scores; S.thr = thr;
    S.R = TW.evaluateRun(ds, scores, thr);
    S.scale = TW.scoreScale(scores, thr);
    TW.$$('#segThr button').forEach(b => b.classList.toggle('on', b.dataset.t === S.thrMode));
    if (S.thrMode !== 'manual') {
      // place the slider at the quantile of the chosen threshold
      let below = 0; for (let i = 0; i < scores.length; i++) if (scores[i] < thr) below++;
      $('#thrSlider').value = TW.clamp(below / scores.length, 0.5, 0.9995);
    }
    S.overview.setRun(scores, S.scale, S.R);
    S.live.setRun(scores, S.scale, S.R, m.colour, m.label);
    runInfo();
    rebuildLog();
    S.lastTick = -1;
    if (S.all) refreshAll();
  }

  function runInfo() {
    const ds = S.ds, run = S.run, m = ds.modelById[S.model];
    const el = $('#runInfo'); el.innerHTML = '';
    let txt;
    if (run.k === 0) txt = 'Zero-label reference: fitted on normal data only, no labelled event.';
    else {
      const cls = {};
      run.chosen.forEach(e => { const ev = ds.eventById[e]; const c = (ev && (ev.cls || ev.top)) || '?'; cls[c] = (cls[c] || 0) + 1; });
      const parts = Object.entries(cls).map(([c, n]) => (n > 1 ? n + '× ' : '') + c);
      txt = `Trained on ${run.k} labelled event${run.k > 1 ? 's' : ''} of the labelled pool` + (parts.length ? ' (' + parts.join(', ') + ')' : '') + '.';
    }
    const thrTxt = { val: 'F1-optimal on the validation split (default)', nb: '99th percentile of the validation negatives (1% false-alarm budget)', manual: `manual (${TW.pct(1 - S.manualQ, 1)} of the evaluation windows above θ)` }[S.thrMode];
    el.append(h('div', null, txt), h('div', null, 'θ = ' + TW.fmt(S.thr) + ' — ' + thrTxt));
    const mm = run.m;
    const art = $('#artLine'); art.innerHTML = '';
    art.append(h('span', { class: 'artlab' }, 'Recorded result, whole evaluation period (this run):'),
      h('span', null, `AUROC ${TW.fmt(mm.auroc, 2)} · AUC-PR ${TW.fmt(mm.aucpr, 2)} · event recall ${TW.fmt(mm.er, 2)} · window precision ${TW.fmt(mm.wp, 2)} · event F1 ${TW.fmt(mm.f1e, 2)} · ${TW.fmt(mm.fa, 2)} false alarms/h`));
    if (S.thrMode === 'val') {
      const f = S.R.final;
      const same = run.exact !== false && Math.abs(f.er - mm.er) < 1e-3 && Math.abs(f.faph - mm.fa) < 1e-3;
      art.appendChild(h('span', { class: 'check ' + (same ? 'ok' : 'warn') }, same
        ? '✓ the replay reproduces these event metrics at the end of the period'
        : '≈ in this run a few stored float32 scores round across θ, so the replay differs slightly from the recorded result'));
    }
  }

  /* ------------------------------------------------------------------ lab side */
  function buildLabSide(side) {
    const ds = S.ds, lab = S.lab;
    const presets = h('div', { class: 'presets' });
    (TW.SCENARIOS[ds.meta.id] || []).forEach(sc => presets.appendChild(h('button', { class: 'preset', title: sc.desc, onclick: () => doInject(sc) },
      h('b', null, sc.name), h('span', null, sc.desc))));
    const chSel = h('select', { id: 'injCh' });
    const groups = {};
    ds.meta.channels.forEach(ch => { (groups[ch.group || 'points'] = groups[ch.group || 'points'] || []).push(ch); });
    Object.entries(groups).forEach(([g, chs]) => {
      const og = h('optgroup', { label: g });
      chs.forEach(ch => og.appendChild(h('option', { value: ch.idx }, ch.id + (ch.unit ? ' [' + ch.unit + ']' : ''))));
      chSel.appendChild(og);
    });
    const typeSel = h('select', { id: 'injType' },
      ...[['bias', 'Offset (spoofed value)'], ['drift', 'Slow drift'], ['freeze', 'Frozen sensor'], ['replay', 'Replay of earlier readings'],
        ['noise', 'Noise burst'], ['scale', 'Scale (e.g. flow −40%)'], ['set', 'Force to a value']].map(([v, l]) => h('option', { value: v }, l)));
    const mag = h('input', { type: 'range', min: -3, max: 3, step: 0.1, value: 1, id: 'injMag', oninput: () => $('#injMagV').textContent = (+mag.value).toFixed(1) });
    const dur = h('input', { type: 'number', min: 1, max: 600, value: 12, id: 'injDur', class: 'num' });
    side.appendChild(h('div', { class: 'card lab-only' },
      h('div', { class: 'card-h' }, h('span', null, 'Inject a fault'), h('span', { class: 'hint' }, 'starts at the replay cursor')),
      h('div', { class: 'lab-sub' }, 'Scenarios'), presets,
      h('div', { class: 'lab-sub' }, 'Custom fault'),
      h('label', null, 'Point'), chSel,
      h('label', null, 'Fault'), typeSel,
      h('label', null, 'Magnitude ', h('span', { class: 'lhint' }, '× normal range (or fraction for scale) '), h('b', { id: 'injMagV' }, '1.0')), mag,
      h('label', null, 'Duration ', h('span', { class: 'lhint' }, 'ticks of ' + ds.hop + ' s')), dur,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => {
          const j = +chSel.value, ch = ds.meta.channels[j];
          const type = typeSel.value, m = +mag.value;
          const step = { ch: j, type, mag: type === 'scale' ? m / 3 : m };
          if (type === 'set') step.value = ch.dlo + TW.clamp((m + 3) / 6, 0, 1) * (ch.dhi - ch.dlo);
          doInject({ name: `${typeSel.selectedOptions[0].textContent} on ${ch.id}`, desc: 'custom fault', dur: +dur.value, steps: [step] });
        } }, '⚡ Inject now'),
        h('button', { class: 'btn', onclick: () => { lab.clear(); afterLab(); toast('All injected faults removed'); } }, 'Clear all'))));
    side.appendChild(h('div', { class: 'card lab-only' },
      h('div', { class: 'card-h' }, h('span', null, 'Detectors running in your browser'), h('span', { class: 'hint' }, 'fitted on normal data, 1% budget')),
      h('div', { id: 'labDet' }),
      h('div', { class: 'lab-sub' }, 'Normal reference'),
      h('div', { class: 'seg small', id: 'segRef' }, h('button', { 'data-r': 'causal', class: 'on' }, 'Causal (default)'), h('button', { 'data-r': 'fixed' }, 'Fixed (counterfactual)')),
      h('div', { class: 'hint2' }, 'The fixed reference uses the mean of the normal record for every point, a counterfactual; watch the false alarms on records that change operating point.')));
    $('#segRef').addEventListener('click', e => {
      const r = e.target.dataset.r; if (!r) return;
      TW.$$('#segRef button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
      toast('Re-fitting the detectors…');
      setTimeout(() => { lab.setRef(r); afterLab(); }, 30);
    });
    side.appendChild(h('div', { class: 'card lab-only' }, h('div', { class: 'card-h' }, h('span', null, 'Injected faults'), h('span', { class: 'hint' }, 'detected within the event tolerance?')),
      h('div', { id: 'injList' }, h('div', { class: 'empty' }, 'No fault injected yet. Pick a scenario or build a custom fault, then press play.'))));
    renderLabDet();
  }

  function doInject(sc) {
    const lab = S.lab;
    const inj = lab.inject({ name: sc.name, desc: sc.desc, steps: sc.steps, dur: sc.dur || 12, start: Math.floor(S.tick) });
    addLog(inj.start, 'inj', `Injected: ${sc.name}`);
    afterLab();
    toast('Fault injected at the cursor — press play to watch the response');
    if (!S.playing) togglePlay(true);
  }

  function afterLab() {
    S.overview.setLab(S.lab);
    S.live.setLab(S.lab);
    renderLabDet(); renderInjList();
    S.lastTick = -1;
  }

  function renderLabDet() {
    const el = $('#labDet'); if (!el) return;
    el.innerHTML = '';
    S.lab.detectors.forEach(d => {
      const R = S.lab.results[d.id], f = R.final;
      el.appendChild(h('div', { class: 'det', 'data-id': d.id },
        h('div', { class: 'det-top' }, h('i', { class: 'lamp', id: 'lamp_' + d.id }), h('b', { style: { color: d.colour } }, d.label), h('span', { class: 'det-sub' }, d.sub)),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', id: 'bar_' + d.id, style: { background: d.colour } }), h('div', { class: 'bar-thr' })),
        h('div', { class: 'det-stats' }, `On the real events of this replay: event recall ${TW.fmt(f.er, 2)} · window precision ${TW.fmt(f.wp, 2)} · event F1 ${TW.fmt(f.f1e, 2)} · ${TW.fmt(f.faph, 2)} false alarms/h`)));
    });
  }

  function renderInjList() {
    const el = $('#injList'); if (!el) return;
    el.innerHTML = '';
    if (!S.lab.injections.length) { el.appendChild(h('div', { class: 'empty' }, 'No fault injected yet. Pick a scenario or build a custom fault, then press play.')); return; }
    S.lab.injections.slice().reverse().forEach(inj => {
      const row = h('div', { class: 'inj' },
        h('div', { class: 'inj-h' }, h('b', null, inj.name), h('a', { href: '#', onclick: e => { e.preventDefault(); seek(Math.max(0, inj.start - 10)); } }, TW.clock(S.ds.t0[inj.start], S.ds))),
        h('div', { class: 'inj-pts' }, inj.chs.map(j => S.ds.meta.channels[j].id).join(', ') + ` · ${TW.dur(inj.dur * S.ds.hop)}`),
        h('div', { class: 'inj-res' }, S.lab.detectors.map(d => {
          const v = inj.det[d.id];
          return h('span', { class: 'pill ' + (v === null ? 'miss' : 'hit'), title: d.label }, (v === null ? '✗ ' : '✓ ') + d.label.split(' ')[0] + (v === null ? '' : ' · ' + TW.dur(v)));
        })));
      el.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------ all detectors */
  async function loadAll() {
    const ds = S.ds, body = $('#allBody');
    body.innerHTML = '';
    const prog = h('div', { class: 'hint2' }, 'Loading…');
    body.appendChild(prog);
    let n = 0;
    for (const m of ds.models) { await ds.loadModel(m.id); n++; prog.textContent = `Loading ${n}/${ds.models.length}…`; }
    S.all = {};
    refreshAll();
  }
  function refreshAll() {
    const ds = S.ds, body = $('#allBody');
    body.innerHTML = '';
    S.all = {};
    FAMILY.forEach(([, ids]) => ids.forEach(mid => {
      const m = ds.modelById[mid]; if (!m) return;
      let k = m.budgets.includes(S.k) ? S.k : m.budgets[0] === 0 ? 0 : m.budgets.reduce((a, b) => (Math.abs(b - S.k) < Math.abs(a - S.k) ? b : a));
      const ri = ds.runIndex(mid, k, S.seed), run = m.runs[ri];
      const sc = ds._scores[mid][ri];
      const thr = S.thrMode === 'nb' && run.thr_nb != null ? run.thr_nb : run.thr;
      const R = TW.evaluateRun(ds, sc, thr), scale = TW.scoreScale(sc, thr);
      const row = h('div', { class: 'allrow' + (mid === S.model ? ' cur' : ''), onclick: () => { S.model = mid; $('#selModel').value = mid; refreshChips(); setRun(); } },
        h('i', { class: 'lamp' }), h('span', { class: 'allname', style: { color: m.colour } }, m.label + (k !== S.k ? ` (k=${k})` : '')),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: { background: m.colour } }), h('div', { class: 'bar-thr' })),
        h('span', { class: 'allrec' }, ''));
      body.appendChild(row);
      S.all[mid] = { sc, thr, R, scale, row };
    }));
    S.lastTick = -1;
  }
  function updateAll(i) {
    if (!S.all) return;
    const ds = S.ds, p = ds.scorePos[i];
    for (const a of Object.values(S.all)) {
      const lamp = a.row.children[0], fill = a.row.children[2].children[0], rec = a.row.children[3];
      if (p < 0) { lamp.className = 'lamp'; fill.style.width = '0%'; continue; }
      const v = a.sc[p], r = a.scale.f(v) / Math.max(1e-6, a.scale.thrN);
      fill.style.width = TW.clamp(r / 1.6, 0, 1) * 100 + '%';
      lamp.className = 'lamp' + (v >= a.thr ? ' red' : ' green');
      const L = TW.liveAt(ds, a.R, i);
      rec.textContent = `${L.detected}/${L.started}`;
    }
  }

  /* ------------------------------------------------------------------ transport */
  function buildTransport() {
    const t = $('#transport');
    const spd = h('select', { id: 'speed', onchange: e => { S.speed = +e.target.value; updateSpeedLabel(); } },
      ...SPEEDS.map(v => h('option', { value: v }, v + ' ticks/s')));
    spd.value = S.speed;
    t.append(
      h('button', { class: 'tbtn', title: 'Previous event (P)', onclick: () => jumpEvent(-1) }, '⏮'),
      h('button', { class: 'tbtn', title: 'Step back (←)', onclick: () => seek(Math.floor(S.tick) - 1) }, '◀'),
      h('button', { class: 'tbtn play', id: 'playBtn', title: 'Play / pause (space)', onclick: () => togglePlay() }, '▶'),
      h('button', { class: 'tbtn', title: 'Step (→)', onclick: () => seek(Math.floor(S.tick) + 1) }, '▶|'),
      h('button', { class: 'tbtn', title: 'Next event (N)', onclick: () => jumpEvent(1) }, '⏭'),
      h('div', { class: 'tspeed' }, spd, h('span', { id: 'speedLab', class: 'hint' })),
      h('div', { class: 'grow' }),
      h('div', { class: 'tclock' }, h('b', { id: 'clock' }, ''), h('span', { id: 'tickLab', class: 'hint' }, '')));
    updateSpeedLabel();
  }
  function updateSpeedLabel() {
    const x = S.speed * S.ds.hop;
    $('#speedLab').textContent = '≈ ' + (x >= 1000 ? Math.round(x / 100) * 100 : x) + '× real time';
  }
  function togglePlay(force) {
    S.playing = force === undefined ? !S.playing : force;
    if (S.playing && S.tick >= S.ds.N - 1) seek(0);
    $('#playBtn').textContent = S.playing ? '❚❚' : '▶';
    $('#playBtn').classList.toggle('on', S.playing);
  }
  function seek(t) {
    S.tick = TW.clamp(t, 0, S.ds.N - 1);
    rebuildLog();
    S.lastTick = -1;
  }
  function jumpEvent(dir) {
    const ds = S.ds, T = Math.floor(S.tick);
    const evs = ds.events.filter(e => e.labStart >= 0);
    if (dir > 0) { const e = evs.find(e => e.labStart - 6 > T); if (e) seek(e.labStart - 6); }
    else { const e = evs.slice().reverse().find(e => e.labStart - 6 < T - 1); if (e) seek(e.labStart - 6); }
  }

  /* ------------------------------------------------------------------ charts */
  function buildCharts() {
    const ds = S.ds;
    S.overview = new TW.Overview($('#overviewHost'), ds, t => seek(t));
    const host = $('#chartsHost');
    const liveWrap = h('div', { class: 'chartwrap' }, h('div', { class: 'chart-h' }, h('span', null, 'Anomaly score of the selected detector and the selected sensors'), h('span', { class: 'hint' }, 'click a sensor or component to add its trace')));
    host.appendChild(liveWrap);
    S.live = new TW.LiveChart(liveWrap, ds, 170);
    const labWrap = h('div', { class: 'chartwrap lab-only' }, h('div', { class: 'chart-h' }, h('span', null, 'In-browser detectors'),
      h('span', { class: 'legend' }, ...S.lab.detectors.map(d => h('span', null, h('i', { style: { background: d.colour } }), d.label)))));
    host.appendChild(labWrap);
    S.labChart = new TW.LabChart(labWrap, ds, 130);
    S.overview.setLab(S.lab); S.live.setLab(S.lab);
  }

  /* ------------------------------------------------------------------ inspector */
  function pick(idx, label) {
    const ds = S.ds;
    if (!idx.length) return;
    const el = $('#inspector');
    el.innerHTML = '';
    el.classList.remove('hidden');
    el.appendChild(h('div', { class: 'insp-h' }, h('b', null, label), h('button', { class: 'close', onclick: () => el.classList.add('hidden') }, '×')));
    S.inspect = idx.slice(0, 8).map(j => {
      const ch = ds.meta.channels[j];
      const val = h('b', { class: 'insp-val' }, ''), z = h('span', { class: 'insp-z' }, '');
      const cv = h('canvas', { class: 'spark' });
      const on = S.sel.has(j);
      const btn = h('button', { class: 'chip' + (on ? ' on' : ''), onclick: () => {
        if (S.sel.has(j)) S.sel.delete(j); else { if (S.sel.size >= 4) S.sel.delete([...S.sel][0]); S.sel.add(j); }
        btn.classList.toggle('on', S.sel.has(j)); S.live.setTraces([...S.sel]); S.lastTick = -1;
      } }, 'chart');
      const injBtn = h('button', { class: 'chip lab-only' + (S.mode === 'lab' ? '' : ' hidden'), onclick: () => { $('#injCh').value = j; toast('Point selected in the fault form'); } }, 'inject…');
      el.appendChild(h('div', { class: 'insp-row' },
        h('div', { class: 'insp-top' }, h('span', { class: 'insp-id' }, ch.id), val, z, btn, injBtn),
        h('div', { class: 'insp-desc' }, ch.desc + (ch.unit ? ' · ' + ch.unit : '') + (ch.group ? ' · ' + ch.group : '')), cv));
      return { j, val, z, cv };
    });
    if (S.mode === 'lab' && idx.length) $('#injCh').value = idx[0];
    S.lastTick = -1;
  }

  function updateInspector(i) {
    if (!S.inspect || $('#inspector').classList.contains('hidden')) return;
    const ds = S.ds, lab = S.lab;
    for (const r of S.inspect) {
      const ch = ds.meta.channels[r.j];
      const v = lab.value(i, r.j);
      r.val.textContent = (ch.binary && (ch.unit === 'on/off' || ch.unit === 'bool') ? (v > 0.5 ? 'ON' : 'OFF') : TW.fmt(v) + (ch.unit && !ch.binary ? ' ' + ch.unit : ''));
      const z = lab.Z[i * ds.C + r.j];
      r.z.textContent = 'z ' + TW.fmt(z, 1);
      r.z.style.color = TW.colorDev(z);
      TW.spark(r.cv, ds, r.j, i, 160, lab);
    }
  }

  /* ------------------------------------------------------------------ event log */
  function addLog(i, kind, text) { S.log.push({ i, kind, text }); }
  function evName(e) {
    const ds = S.ds;
    const cls = e.cls ? e.cls : '';
    return `#${e.id}` + (cls ? ' · ' + cls : '') + (e.top ? ' · top point ' + e.top : '');
  }
  function rebuildLog() {
    S.log = []; S.logUpTo = -1;
    advanceLog(Math.floor(S.tick));
    renderLog(true);
  }
  function advanceLog(T) {
    const ds = S.ds, R = S.R;
    if (!R || T <= S.logUpTo) return;
    const a = S.logUpTo, b = T;
    for (const x of R.evs) {
      const e = x.e;
      if (e.labStart > a && e.labStart <= b) addLog(e.labStart, 'ev', 'Event started ' + evName(e));
      if (x.det > a && x.det <= b) addLog(x.det, 'det', `Detected ${'#' + e.id} after ${TW.dur(x.delay)}`);
      if ((x.det < 0 || x.det > e.last) && e.last > a && e.last <= b) addLog(e.last, 'miss', `Missed ${'#' + e.id} (no alarm while it lasted)`);
    }
    for (const p of R.eps) if (!p.cred && p.b > a && p.b <= b) addLog(p.b, 'fa', `False alarm: ${p.b - p.a + 1} window${p.b > p.a ? 's' : ''} flagged, no event`);
    for (const inj of S.lab.injections) if (inj.start > a && inj.start <= b && !S.log.some(l => l.kind === 'inj' && l.i === inj.start)) addLog(inj.start, 'inj', 'Injected: ' + inj.name);
    S.log.sort((x, y) => x.i - y.i);
    if (S.log.length > 400) S.log = S.log.slice(-400);
    S.logUpTo = b;
  }
  function renderLog(force) {
    const el = $('#log'); if (!el) return;
    const n = S.log.length;
    if (!force && el.dataset.n === String(n)) return;
    el.dataset.n = n;
    el.innerHTML = '';
    if (!n) { el.appendChild(h('div', { class: 'empty' }, 'Nothing yet — press play.')); return; }
    S.log.slice(-60).reverse().forEach(l => el.appendChild(h('div', { class: 'logrow ' + l.kind, onclick: () => seek(Math.max(0, l.i - 8)) },
      h('span', { class: 'logt' }, TW.clock(S.ds.t0[l.i], S.ds).slice(-11)), h('span', null, l.text))));
  }

  /* ------------------------------------------------------------------ frame */
  const st = { vals: null, z: null, alarm: false, evTop: -1, evSeg: '', evIcon: '', inj: null, sel: null, t: 0 };
  let lastNow = performance.now(), chartAcc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    const ds = S.ds;
    if (!ds || !S.R || !S.lab || S.lab.ds !== ds || $('#twin').classList.contains('hidden')) return;
    if (S.playing) {
      S.tick += S.speed * dt;
      if (S.tick >= ds.N - 1) { S.tick = ds.N - 1; togglePlay(false); }
    }
    const i = Math.floor(S.tick), f = S.tick - i, i2 = Math.min(ds.N - 1, i + 1);
    const C = ds.C, lab = S.lab;
    if (!st.vals || st.vals.length !== C) { st.vals = new Float32Array(C); }
    for (let j = 0; j < C; j++) {
      const a = lab.X[i * C + j], b = lab.X[i2 * C + j];
      st.vals[j] = ds.meta.channels[j].binary ? (f < 0.5 ? a : b) : a + (b - a) * f;
    }
    st.z = lab.Z.subarray(i * C, i * C + C);
    st.t += dt;
    st.alarm = S.mode === 'lab' ? labAlarm(i) : !!S.R.flags[i];
    const k = ds.activeEvent[i];
    const ev = k >= 0 ? ds.events[k] : null;
    st.evTop = ev && ev.top ? ds.chIndex[ev.top] : -1;
    st.evSeg = ev ? ev.seg : '';
    st.evIcon = ev ? (EV_ICON[ev.cls] || '⚠') : '';
    if (i !== S.lastTick) { st.inj = lab.injectedAt(i); }
    st.sel = S.sel;
    if (S.view === '3d' && S.v3d) S.v3d.update(st, dt); else if (S.v2d) S.v2d.update(st, dt);
    chartAcc += dt;
    if (i !== S.lastTick || chartAcc > 0.25) {
      const changed = i !== S.lastTick;
      S.lastTick = i; chartAcc = 0;
      onTick(i, ev, changed);
    }
  }

  function labAlarm(i) {
    for (const d of S.lab.detectors) if (S.lab.scores[d.id][i] >= d.thr) return true;
    return false;
  }

  function onTick(i, ev, changed) {
    const ds = S.ds;
    $('#clock').textContent = TW.clock(ds.t0[i] + ds.win, ds);
    $('#tickLab').textContent = ` · window ${i + 1} / ${ds.N}` + (ds.segList.length > 1 ? ' · record ' + ds.segOfTick(i).name : '');
    $('#hudClock').textContent = TW.clock(ds.t0[i] + ds.win, ds);
    // HUD alarm and event banners
    const m = ds.modelById[S.model];
    const scored = ds.scored[i];
    const al = $('#hudAlarm');
    if (S.mode === 'lab') {
      const any = labAlarm(i);
      al.className = 'hud-alarm ' + (any ? 'on' : 'off');
      al.textContent = any ? '● ALARM · in-browser detectors' : '● normal · in-browser detectors';
    } else if (!scored) {
      al.className = 'hud-alarm idle'; al.textContent = '● calibration prefix (not scored)';
    } else {
      const on = !!S.R.flags[i];
      al.className = 'hud-alarm ' + (on ? 'on' : 'off');
      al.textContent = (on ? '● ALARM · ' : '● normal · ') + m.label;
    }
    const eb = $('#hudEvent');
    const injNow = S.lab.injections.filter(x => i >= x.start && i <= x.start + x.dur);
    if (ev) {
      eb.className = 'hud-event on';
      eb.textContent = `${EV_ICON[ev.cls] || '⚠'} Labelled event ${evName(ev)}`;
    } else if (injNow.length) {
      eb.className = 'hud-event inj'; eb.textContent = '⚡ Injected fault: ' + injNow.map(x => x.name).join(' + ');
    } else { eb.className = 'hud-event'; eb.textContent = ''; }
    // KPIs
    const L = TW.liveAt(ds, S.R, i);
    $('#kDet').textContent = `${L.detected}/${L.started}`;
    $('#kRec').textContent = isFinite(L.er) ? TW.fmt(L.er, 2) : '–';
    $('#kFA').textContent = `${L.fa}` + (isFinite(L.faph) ? ` · ${TW.fmt(L.faph, 2)}/h` : '');
    $('#kWP').textContent = L.flaggedAll ? TW.fmt(L.wp, 2) : '–';
    $('#kF1').textContent = isFinite(L.f1e) ? TW.fmt(L.f1e, 2) : '–';
    $('#kDelay').textContent = isFinite(L.delay) ? TW.dur(L.delay) : '–';
    renderDots(i);
    // log
    if (changed) { advanceLog(i); renderLog(); }
    // charts
    S.overview.draw(S.tick);
    S.live.draw(S.tick, S.lab);
    if (S.mode === 'lab') { S.labChart.draw(S.tick, S.lab); updateLabDet(i); }
    updateAll(i);
    updateInspector(i);
  }

  function renderDots(i) {
    const ds = S.ds, el = $('#evDots');
    if (!el._built || el._run !== S.R) {
      el.innerHTML = '';
      el._dots = S.R.evs.map(x => {
        const d = h('i', { class: 'dot', title: evName(x.e), onclick: () => seek(Math.max(0, x.e.labStart - 6)) });
        el.appendChild(d); return { d, x };
      });
      el._built = true; el._run = S.R;
    }
    const tNow = ds.t0[i] + ds.win;
    for (const { d, x } of el._dots) {
      let c = 'dot';
      if (x.e.start < tNow) {
        if (x.det >= 0 && x.det <= i) c += ' det';
        else if (x.e.last < i || i === ds.N - 1) c += ' miss';
        else c += ' live';
      }
      if (d.className !== c) d.className = c;
    }
  }

  function updateLabDet(i) {
    for (const d of S.lab.detectors) {
      const v = S.lab.scores[d.id][i] / d.thr;
      const b = $('#bar_' + d.id), l = $('#lamp_' + d.id);
      if (b) b.style.width = TW.clamp(Math.log10(1 + 9 * TW.clamp(v, 0, 4)) / Math.log10(37), 0, 1) * 100 + '%';
      if (l) l.className = 'lamp ' + (v >= 1 ? 'red' : 'green');
    }
  }

  /* ------------------------------------------------------------------ toast, keys */
  let toastT = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600);
  }
  TW.toast = toast;
  document.addEventListener('keydown', e => {
    if (!S.ds || $('#twin').classList.contains('hidden')) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') seek(Math.floor(S.tick) + 1);
    else if (e.key === 'ArrowLeft') seek(Math.floor(S.tick) - 1);
    else if (e.key === 'n' || e.key === 'N') jumpEvent(1);
    else if (e.key === 'p' || e.key === 'P') jumpEvent(-1);
    else if (e.key === 'Escape') $('#inspector').classList.add('hidden');
  });
  window.addEventListener('resize', () => { S.lastTick = -1; });

  /* ------------------------------------------------------------------ boot */
  buildHeader();
  requestAnimationFrame(frame);
  route();
})();
