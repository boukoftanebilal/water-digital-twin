/* Plant models of the five testbeds. One declarative description drives both the 2D schematic and the 3D scene.
   Coordinates are in the 2D viewBox; bindings name the channel that animates a component (lo/hi default to the
   channel's 1st-99th percentile in normal operation). Layouts follow the documentation of each testbed:
   HAI P1 follows the physical boiler graph shipped with HAI (graph/boiler/phy_boiler.json) and the HAI technical
   report; SKAB follows the benchmark's testbed description; Smart-Farm-IDS, WDSEventDB and GECCO 2018 are schematic
   layouts built from the dataset descriptions and channel structure (not to scale). */
'use strict';
TW.plants = {};

/* ------------------------------------------------------------------ HAI 23.05 */
TW.plants.hai = {
  vb: [1000, 680],
  sm: true,
  note: 'P1 follows the physical boiler graph shipped with HAI (TK01-TK03, HEX01, feedwater, heating and cooling loops); P2-P4 follow the HAI technical report.',
  zones: [
    { id: 'P1', x: 10, y: 28, w: 600, h: 434, label: 'P1 · Boiler process', sub: 'Emerson Ovation DCS', col: '#1d6fd1' },
    { id: 'P2', x: 620, y: 28, w: 370, h: 216, label: 'P2 · Turbine (rotor kit)', sub: 'GE Mark VIe', col: '#9b5de5' },
    { id: 'P3', x: 620, y: 252, w: 370, h: 210, label: 'P3 · Water treatment', sub: 'Siemens S7-300', col: '#00a6a6' },
    { id: 'P4', x: 10, y: 470, w: 980, h: 202, label: 'P4 · HIL grid simulator', sub: 'dSPACE SCALEXIO', col: '#f4a259' },
  ],
  comps: [
    // P1 heating loop
    { id: 'TK02', t: 'tank', x: 30, y: 84, w: 66, h: 92, label: 'TK02 heating', lv: 0.78, liq: 'hot', heater: true, chs: ['P1_TIT02'] },
    { id: 'FCV02', t: 'valve', x: 140, y: 106, o: 'h', label: 'FCV02', op: { ch: 'P1_FCV02Z', lo: 0, hi: 100 }, chs: ['P1_FCV02D', 'P1_FCV02Z'] },
    { id: 'PP02', t: 'pump', x: 140, y: 156, r: 15, label: 'PP02', run: { ch: 'P1_PP02R' }, chs: ['P1_PP02D', 'P1_PP02R'] },
    { id: 'FCV01', t: 'valve', x: 214, y: 156, o: 'h', label: 'FCV01', op: { ch: 'P1_FCV01Z', lo: 0, hi: 100 }, chs: ['P1_FCV01D', 'P1_FCV01Z', 'P1_FT02', 'P1_FT02Z', 'P1_PIT02'] },
    { id: 'HEX01', t: 'hx', x: 268, y: 118, w: 108, h: 84, label: 'HEX01 heat exchanger', chs: ['P1_TIT01'] },
    // P1 feedwater loop
    { id: 'TK01', t: 'tank', x: 28, y: 270, w: 82, h: 120, label: 'TK01 main', lab: 'in', lv: 0.7, liq: 'water', chs: ['P1_TIT03', 'P1_SOL01D', 'P1_SOL03D'] },
    { id: 'PP01A', t: 'pump', x: 168, y: 316, r: 15, label: 'PP01A', run: { ch: 'P1_PP01AR' }, chs: ['P1_PP01AD', 'P1_PP01AR'] },
    { id: 'PP01B', t: 'pump', x: 168, y: 372, r: 15, label: 'PP01B', run: { ch: 'P1_PP01BR' }, chs: ['P1_PP01BD', 'P1_PP01BR'] },
    { id: 'PCV02', t: 'valve', x: 252, y: 362, o: 'v', label: 'PCV02', op: { ch: 'P1_PCV02Z', lo: 0, hi: 100 }, chs: ['P1_PCV02D', 'P1_PCV02Z'], s: 0.8 },
    { id: 'PCV01', t: 'valve', x: 432, y: 158, o: 'h', label: 'PCV01', op: { ch: 'P1_PCV01Z', lo: 0, hi: 100 }, chs: ['P1_PCV01D', 'P1_PCV01Z', 'P1_PIT01', 'P1_PIT01_HH', 'P1_FT01', 'P1_FT01Z'] },
    { id: 'LCV01', t: 'valve', x: 490, y: 158, o: 'h', label: 'LCV01', op: { ch: 'P1_LCV01Z', lo: 0, hi: 100 }, chs: ['P1_LCV01D', 'P1_LCV01Z'] },
    { id: 'TK03', t: 'tank', x: 524, y: 104, w: 66, h: 118, label: 'TK03 return', lv: { ch: 'P1_LIT01' }, liq: 'water', chs: ['P1_LIT01'] },
    { id: 'FCV03', t: 'valve', x: 490, y: 246, o: 'h', label: 'FCV03', op: { ch: 'P1_FCV03Z', lo: 0, hi: 100 }, chs: ['P1_FCV03D', 'P1_FCV03Z', 'P1_FT03', 'P1_FT03Z'] },
    // P1 cooling
    { id: 'PP04', t: 'pump', x: 162, y: 430, r: 13, label: '', spd: { ch: 'P1_PP04' }, chs: ['P1_PP04', 'P1_PP04D', 'P1_PP04SP'] },
    { id: 'COND01', t: 'cooler', x: 214, y: 416, w: 64, h: 28, label: 'PP04 · COND01 cooling' },
    { id: 'DCS', t: 'dcs', x: 400, y: 318, w: 198, h: 128, label: 'DCS loops (set-points)', rows: [
      { label: '1001 pressure', chs: ['x1001_05_SETPOINT_OUT', 'x1001_15_ASSIGN_OUT'] },
      { label: '1002 level', chs: ['x1002_07_SETPOINT_OUT', 'x1002_08_SETPOINT_OUT'] },
      { label: '1003 temp.', chs: ['x1003_10_SETPOINT_OUT', 'x1003_18_SETPOINT_OUT', 'x1003_24_SUM_OUT'] },
      { label: 'Boiler start/stop', chs: ['P1_STSP'] } ] },
    // P2 turbine
    { id: 'LAMPS', t: 'lamps', x: 636, y: 68, label: '', items: [
      { ch: 'P2_24Vdc', label: '24 V' }, { ch: 'P2_OnOff', label: 'On' }, { ch: 'P2_AutoGO', label: 'Auto go' },
      { ch: 'P2_ManualGO', label: 'Man go' }, { ch: 'P2_ATSW_Lamp', label: 'Auto' }, { ch: 'P2_MASW', label: 'M/A sw' },
      { ch: 'P2_MASW_Lamp', label: 'M/A' }, { ch: 'P2_Emerg', label: 'Emerg', bad: true }, { ch: 'P2_TripEx', label: 'Trip', bad: true } ] },
    { id: 'ROTOR', t: 'rotor', x: 640, y: 136, w: 334, h: 72, label: '',
      spd: { ch: 'P2_SIT01', lo: 0, hi: 3200 },
      chs: ['P2_SIT01', 'P2_VT01', 'P2_RTR', 'P2_SCO', 'P2_SCST', 'P2_AutoSD', 'P2_ManualSD', 'P2_VTR01', 'P2_VTR02', 'P2_VTR03', 'P2_VTR04'] },
    // P3 water treatment
    { id: 'P3LOW', t: 'tank', x: 640, y: 366, w: 104, h: 74, label: 'Lower tank', lv: 0.55, liq: 'water' },
    { id: 'LCP01', t: 'pump', x: 800, y: 420, r: 16, label: 'LCP01', run: { ch: 'P3_LCP01D', lo: 0, hi: 2000 }, chs: ['P3_LCP01D'] },
    { id: 'P3UP', t: 'tank', x: 870, y: 290, w: 100, h: 84, label: 'Upper tank', lv: { ch: 'P3_LIT01' }, liq: 'water',
      sw: { hi: 'P3_LH01', lo: 'P3_LL01' }, chs: ['P3_LIT01', 'P3_LH01', 'P3_LL01'] },
    { id: 'P3LCV', t: 'valve', x: 790, y: 306, o: 'h', label: 'LCV01', op: { ch: 'P3_LCV01D' }, chs: ['P3_LCV01D', 'P3_FIT01', 'P3_PIT01'] },
    // P4 HIL grid
    { id: 'STM', t: 'turbine', x: 116, y: 520, w: 96, h: 58, label: 'Steam turbine model', spd: { ch: 'P4_ST_PO' },
      chs: ['P4_ST_GOV', 'P4_ST_PT01', 'P4_ST_TT01', 'P4_ST_FD', 'P4_ST_PS', 'P4_ST_LD'] },
    { id: 'G1', t: 'gen', x: 268, y: 549, r: 26, label: 'Generator (STM)', pow: { ch: 'P4_ST_PO' }, chs: ['P4_ST_PO'] },
    { id: 'HTM', t: 'turbine', x: 456, y: 520, w: 96, h: 58, label: 'Hydro turbine model', hydro: true, spd: { ch: 'P4_HT_PO' },
      chs: ['P4_HT_FD', 'P4_HT_PS'] },
    { id: 'G2', t: 'gen', x: 606, y: 549, r: 26, label: 'Generator (HTM)', pow: { ch: 'P4_HT_PO' }, chs: ['P4_HT_PO'] },
    { id: 'BUS', t: 'bus', x: 700, y: 512, w: 10, h: 116, label: '60 Hz grid' },
    { id: 'CITY', t: 'city', x: 790, y: 512, w: 186, h: 112, label: 'Local load demand', load: { ch: 'P4_LD' }, chs: ['P4_LD'] },
  ],
  pipes: [
    // heating loop (hot water)
    { k: 'hot', pts: [[96, 156], [125, 156]], f: { run: 'PP02' } },
    { k: 'hot', pts: [[155, 156], [268, 156]], f: { ch: 'P1_FT02Z' } },
    { k: 'hot', pts: [[182, 156], [182, 106], [96, 106]], f: { ch: 'P1_FCV02Z', lo: 0, hi: 100 }, w: 4 },
    { k: 'hotret', pts: [[322, 118], [322, 62], [63, 62], [63, 84]], f: { ch: 'P1_FT02Z' } },
    // feedwater suction and discharge
    { k: 'water', pts: [[110, 350], [132, 350], [132, 316], [153, 316]], f: { run: 'PP01A' } },
    { k: 'water', pts: [[132, 350], [132, 372], [153, 372]], f: { run: 'PP01B' } },
    { k: 'water', pts: [[183, 316], [206, 316], [206, 344]], f: { run: 'PP01A' } },
    { k: 'water', pts: [[183, 372], [206, 372], [206, 344]], f: { run: 'PP01B' } },
    { k: 'water', pts: [[206, 344], [326, 344], [326, 202]], f: { ch: 'P1_FT01Z' } },
    { k: 'water', pts: [[252, 344], [252, 382], [110, 382]], f: { ch: 'P1_PCV02Z', lo: 0, hi: 100 }, w: 4 },
    // heated feedwater to the return tank, and back to the main tank
    { k: 'hot', pts: [[376, 158], [524, 158]], f: { ch: 'P1_FT01Z' } },
    { k: 'water', pts: [[557, 222], [557, 246], [124, 246], [124, 290], [110, 290]], f: { ch: 'P1_FT03Z' } },
    // cooling loop
    { k: 'cool', pts: [[50, 390], [50, 430], [149, 430]], f: { ch: 'P1_PP04' } },
    { k: 'cool', pts: [[175, 430], [214, 430]], f: { ch: 'P1_PP04' } },
    { k: 'cool', pts: [[278, 430], [296, 430], [296, 452], [36, 452], [36, 390]], f: { ch: 'P1_PP04' } },
    // P3
    { k: 'water', pts: [[744, 420], [784, 420]], f: { run: 'LCP01' } },
    { k: 'water', pts: [[816, 420], [920, 420], [920, 374]], f: { run: 'LCP01' } },
    { k: 'water', pts: [[870, 306], [700, 306], [700, 366]], f: { ch: 'P3_FIT01' } },
    // P4 power and signals
    { k: 'shaft', pts: [[212, 549], [242, 549]], f: { ch: 'P4_ST_PO' } },
    { k: 'shaft', pts: [[552, 549], [580, 549]], f: { ch: 'P4_HT_PO' } },
    { k: 'power', pts: [[294, 549], [330, 549], [330, 620], [705, 620]], f: { ch: 'P4_ST_PO' } },
    { k: 'power', pts: [[632, 549], [660, 549], [660, 580], [705, 580]], f: { ch: 'P4_HT_PO' } },
    { k: 'power', pts: [[710, 560], [790, 560]], f: { ch: 'P4_LD' } },
    { k: 'signal', pts: [[44, 500], [44, 549], [116, 549]], label: 'steam P, T from P1' },
    { k: 'signal', pts: [[700, 440], [700, 486], [420, 486], [420, 549], [456, 549]], label: '' },
  ],
  tags: [
    { ch: 'P1_TIT02', x: 63, y: 214 },
    { ch: 'P1_PIT02', x: 252, y: 96 },
    { ch: 'P1_FT02Z', x: 214, y: 196 },
    { ch: 'P1_TIT01', x: 400, y: 104 },
    { ch: 'P1_PIT01', x: 432, y: 200 },
    { ch: 'P1_FT01Z', x: 370, y: 300 },
    { ch: 'P1_LIT01', x: 557, y: 72 },
    { ch: 'P1_FT03Z', x: 562, y: 272 },
    { ch: 'P1_TIT03', x: 69, y: 254 },
    { ch: 'P1_PCV02Z', x: 300, y: 396 },
    { ch: 'P1_PP04', x: 350, y: 430, label: 'PP04 speed' },
    { ch: 'P2_SCO', x: 676, y: 112 },
    { ch: 'P2_VIBTR01', x: 767, y: 112 },
    { ch: 'P2_VIBTR03', x: 927, y: 112 },
    { ch: 'P2_SIT01', x: 676, y: 226 },
    { ch: 'P2_VIBTR02', x: 767, y: 226 },
    { ch: 'P2_VIBTR04', x: 927, y: 226 },
    { ch: 'P3_FIT01', x: 700, y: 284 },
    { ch: 'P3_LIT01', x: 812, y: 352 },
    { ch: 'P3_PIT01', x: 880, y: 444 },
    { ch: 'P4_ST_PO', x: 268, y: 506 },
    { ch: 'P4_HT_PO', x: 606, y: 506 },
    { ch: 'P4_LD', x: 883, y: 494 },
    { ch: 'P4_ST_PT01', x: 70, y: 652 },
    { ch: 'P4_ST_TT01', x: 154, y: 652 },
    { ch: 'P4_ST_GOV', x: 238, y: 652 },
    { ch: 'P4_ST_FD', x: 420, y: 652 },
    { ch: 'P4_HT_FD', x: 504, y: 652 },
    { ch: 'P4_HT_PS', x: 588, y: 652 },
  ],
};

/* ------------------------------------------------------------------ SKAB */
TW.plants.skab = {
  vb: [1000, 600],
  note: 'Water circulation loop of the Skoltech testbed: tank, inlet valve, centrifugal pump driven by an electric motor, outlet valve. Valve symbols close during the labelled valve-closing experiments.',
  zones: [{ id: 'loop', x: 24, y: 28, w: 952, h: 548, label: 'Skoltech water circulation testbed', sub: '8 sensors · 1 Hz', col: '#1d6fd1' }],
  comps: [
    { id: 'tank', t: 'tank', x: 78, y: 150, w: 170, h: 270, label: 'Water tank', lv: 0.72, liq: 'water' },
    { id: 'v1', t: 'valve', x: 330, y: 480, o: 'h', label: 'Valve 1 · inlet', evClose: 'valve1', s: 1.6 },
    { id: 'pump', t: 'pump', x: 486, y: 480, r: 44, label: 'Centrifugal pump', spd: { ch: 'Current' }, chs: ['Accelerometer1RMS', 'Accelerometer2RMS'] },
    { id: 'motor', t: 'motor', x: 430, y: 530, w: 112, h: 40, label: '', spd: { ch: 'Current' }, chs: ['Current', 'Voltage', 'Temperature'] },
    { id: 'pt', t: 'gauge', x: 590, y: 330, label: 'PT', chs: ['Pressure'] },
    { id: 'fm', t: 'fm', x: 690, y: 330, label: 'Flow meter', chs: ['Volume Flow RateRMS'] },
    { id: 'tc', t: 'probe', x: 790, y: 330, label: 'TC', chs: ['Thermocouple'] },
    { id: 'v2', t: 'valve', x: 880, y: 230, o: 'v', label: 'Valve 2 · outlet', evClose: 'valve2', s: 1.6 },
  ],
  pipes: [
    { k: 'water', pts: [[163, 420], [163, 480], [442, 480]], f: { ch: 'Volume Flow RateRMS' }, w: 9 },
    { k: 'water', pts: [[486, 436], [486, 330], [880, 330], [880, 110], [163, 110], [163, 150]], f: { ch: 'Volume Flow RateRMS' }, w: 9 },
  ],
  tags: [
    { ch: 'Pressure', x: 590, y: 286 },
    { ch: 'Volume Flow RateRMS', x: 690, y: 286 },
    { ch: 'Thermocouple', x: 790, y: 286 },
    { ch: 'Accelerometer1RMS', x: 610, y: 446 },
    { ch: 'Accelerometer2RMS', x: 610, y: 488 },
    { ch: 'Current', x: 366, y: 524 },
    { ch: 'Voltage', x: 366, y: 562 },
    { ch: 'Temperature', x: 610, y: 534, label: 'Motor T' },
  ],
};

/* ------------------------------------------------------------------ Smart-Farm-IDS */
TW.plants.smartfarm = {
  vb: [1000, 600],
  note: 'Schematic of the smart farm described by Smart-Farm-IDS: nutrient tank with fill and irrigation pumps, two soil beds, greenhouse climate station and grow light.',
  zones: [{ id: 'farm', x: 18, y: 28, w: 964, h: 552, label: 'Smart farm', sub: '14 sensors · 1 Hz', col: '#2a9d4b' }],
  comps: [
    { id: 'sun', t: 'sun', x: 92, y: 120, r: 30, int: { ch: 'LightIntensity' } },
    { id: 'src', t: 'source', x: 34, y: 330, w: 72, h: 56, label: 'Water supply' },
    { id: 'fill', t: 'pump', x: 168, y: 358, r: 22, label: 'Fill pump', run: { ch: 'WaterPumpToTank' }, chs: ['WaterPumpToTank'] },
    { id: 'tank', t: 'tank', x: 226, y: 226, w: 132, h: 214, label: 'Nutrient tank', lv: { ch: 'WaterLevel', lo: 0, hi: 25 }, liq: 'nutrient',
      chs: ['WaterLevel', 'WaterTemperature', 'Ec', 'Tds'] },
    { id: 'irr', t: 'pump', x: 424, y: 418, r: 22, label: 'Irrigation pump', run: { ch: 'WaterPumpFromTank' }, chs: ['WaterPumpFromTank'] },
    { id: 'gh', t: 'greenhouse', x: 478, y: 110, w: 490, h: 452, label: 'Greenhouse' },
    { id: 'lamp1', t: 'lamp', x: 528, y: 300, w: 160, on: { ch: 'Light' }, chs: ['Light'] },
    { id: 'lamp2', t: 'lamp', x: 758, y: 300, w: 160, on: { ch: 'Light' }, chs: ['Light'] },
    { id: 'bed1', t: 'bed', x: 508, y: 452, w: 200, h: 78, label: '', moist: { ch: 'SoilHumidity1' }, chs: ['SoilHumidity1'] },
    { id: 'bed2', t: 'bed', x: 738, y: 452, w: 200, h: 78, label: '', moist: { ch: 'SoilHumidity2' }, chs: ['SoilHumidity2'] },
    { id: 'env', t: 'envbox', x: 640, y: 168, w: 132, h: 64, label: 'Climate station', chs: ['Temperature', 'Humidity', 'HeatIndex', 'AirQuality'] },
    { id: 'lux', t: 'probe', x: 890, y: 196, label: 'lux', chs: ['LightIntensity'] },
  ],
  pipes: [
    { k: 'water', pts: [[106, 358], [146, 358]], f: { run: 'fill' } },
    { k: 'water', pts: [[190, 358], [206, 358], [206, 206], [292, 206], [292, 226]], f: { run: 'fill' } },
    { k: 'nutrient', pts: [[358, 418], [402, 418]], f: { run: 'irr' } },
    { k: 'nutrient', pts: [[446, 418], [494, 418], [494, 440], [950, 440]], f: { run: 'irr' }, drip: true },
  ],
  tags: [
    { ch: 'WaterLevel', x: 244, y: 484 },
    { ch: 'WaterTemperature', x: 342, y: 484 },
    { ch: 'Ec', x: 244, y: 522 },
    { ch: 'Tds', x: 342, y: 522 },
    { ch: 'WaterPumpToTank', x: 160, y: 422 },
    { ch: 'WaterPumpFromTank', x: 432, y: 488 },
    { ch: 'Temperature', x: 584, y: 256 },
    { ch: 'Humidity', x: 668, y: 256 },
    { ch: 'HeatIndex', x: 752, y: 256 },
    { ch: 'AirQuality', x: 836, y: 256 },
    { ch: 'LightIntensity', x: 890, y: 150 },
    { ch: 'Light', x: 560, y: 150 },
    { ch: 'SoilHumidity1', x: 608, y: 556 },
    { ch: 'SoilHumidity2', x: 838, y: 556 },
  ],
};

/* ------------------------------------------------------------------ WDSEventDB */
TW.plants.wdsevent = {
  vb: [1000, 600],
  note: 'Schematic inferred from the dataset channels: four pump lines, each with a variable-frequency drive, a pressure transmitter and a flow meter, joined by a common circuit throttled by two analog valves (not to scale).',
  sm: true,
  zones: [{ id: 'net', x: 18, y: 28, w: 964, h: 552, label: 'Water distribution testbed', sub: '15 sensors · 1 Hz', col: '#1d6fd1' }],
  comps: [
    { id: 'R1', t: 'reservoir', x: 40, y: 120, w: 96, h: 72, label: 'Supply tank 1' },
    { id: 'R2', t: 'reservoir', x: 40, y: 406, w: 96, h: 72, label: 'Supply tank 2' },
    { id: 'VFD1', t: 'pump', x: 196, y: 156, r: 22, label: 'Pump 1', spd: { ch: 'VFD 1', lo: 0, hi: 60 }, chs: ['VFD 1'] },
    { id: 'VFD2', t: 'pump', x: 196, y: 442, r: 22, label: 'Pump 2', spd: { ch: 'VFD 2', lo: 0, hi: 60 }, chs: ['VFD 2'] },
    { id: 'AV1', t: 'valve', x: 530, y: 156, o: 'h', label: 'Analog valve 1', op: { ch: 'Analog Valve 1', lo: 0, hi: 100 }, chs: ['Analog Valve 1'], s: 1.4 },
    { id: 'AV2', t: 'valve', x: 530, y: 442, o: 'h', label: 'Analog valve 2', op: { ch: 'Analog Valve 2', lo: 0, hi: 100 }, chs: ['Analog Valve 2'], s: 1.4 },
    { id: 'J1', t: 'node', x: 330, y: 156 }, { id: 'J2', t: 'node', x: 330, y: 442 },
    { id: 'J3', t: 'node', x: 730, y: 156 }, { id: 'J4', t: 'node', x: 730, y: 442 },
    { id: 'VFD3', t: 'pump', x: 856, y: 230, r: 22, label: 'Pump 3', spd: { ch: 'VFD 3', lo: 0, hi: 60 }, chs: ['VFD 3'] },
    { id: 'VFD41', t: 'pump', x: 856, y: 360, r: 20, label: 'Pump 4-1', spd: { ch: 'VFD 4-1', lo: 0, hi: 60 }, chs: ['VFD 4-1'] },
    { id: 'VFD42', t: 'pump', x: 856, y: 424, r: 20, label: 'Pump 4-2', spd: { ch: 'VFD 4-2', lo: 0, hi: 60 }, chs: ['VFD 4-2'] },
    { id: 'T3', t: 'reservoir', x: 900, y: 200, w: 70, h: 60, label: 'Tank 3' },
    { id: 'T4', t: 'reservoir', x: 900, y: 362, w: 70, h: 72, label: 'Tank 4' },
  ],
  pipes: [
    { k: 'water', pts: [[136, 156], [174, 156]], f: { ch: 'Water Flow 1' } },
    { k: 'water', pts: [[218, 156], [330, 156]], f: { ch: 'Water Flow 1' } },
    { k: 'water', pts: [[136, 442], [174, 442]], f: { ch: 'Water Flow 2' } },
    { k: 'water', pts: [[218, 442], [330, 442]], f: { ch: 'Water Flow 2' } },
    { k: 'water', pts: [[330, 156], [730, 156]], f: { ch: 'Analog Valve 1', lo: 0, hi: 100 }, w: 8 },
    { k: 'water', pts: [[330, 442], [730, 442]], f: { ch: 'Analog Valve 2', lo: 0, hi: 100 }, w: 8 },
    { k: 'water', pts: [[330, 156], [330, 442]], f: 0.35, w: 6 },
    { k: 'water', pts: [[730, 156], [730, 442]], f: 0.35, w: 6 },
    { k: 'water', pts: [[730, 230], [834, 230]], f: { ch: 'Water Flow 3' } },
    { k: 'water', pts: [[878, 230], [900, 230]], f: { ch: 'Water Flow 3' } },
    { k: 'water', pts: [[730, 392], [800, 392], [800, 360], [836, 360]], f: { ch: 'Water Flow 4' } },
    { k: 'water', pts: [[800, 392], [800, 424], [836, 424]], f: { ch: 'Water Flow 4' } },
    { k: 'water', pts: [[876, 360], [900, 360], [900, 398]], f: { ch: 'Water Flow 4' } },
    { k: 'water', pts: [[876, 424], [900, 424], [900, 398]], f: { ch: 'Water Flow 4' } },
  ],
  tags: [
    { ch: 'Pressure 1 Out', x: 270, y: 112 },
    { ch: 'Water Flow 1', x: 292, y: 206 },
    { ch: 'VFD 1', x: 196, y: 212 },
    { ch: 'Pressure 2 Out', x: 270, y: 398 },
    { ch: 'Water Flow 2', x: 292, y: 492 },
    { ch: 'VFD 2', x: 196, y: 500 },
    { ch: 'Analog Valve 1', x: 640, y: 120 },
    { ch: 'Analog Valve 2', x: 530, y: 496 },
    { ch: 'Pressure 3 In', x: 770, y: 196 },
    { ch: 'Water Flow 3', x: 770, y: 274 },
    { ch: 'VFD 3', x: 922, y: 176 },
    { ch: 'Pressure 4 In', x: 690, y: 352 },
    { ch: 'Water Flow 4', x: 690, y: 394 },
    { ch: 'VFD 4-1', x: 940, y: 318 },
    { ch: 'VFD 4-2', x: 940, y: 482 },
  ],
};

/* ------------------------------------------------------------------ GECCO 2018 */
TW.plants.gecco = {
  vb: [1000, 600],
  note: 'Schematic of the bulk drinking-water supply of Thüringer Fernwasserversorgung described by the GECCO 2018 challenge: two water lines with flow meters and chlorine-dioxide measuring stations, and the quality analysers of the measuring station (not to scale).',
  zones: [{ id: 'sup', x: 18, y: 28, w: 964, h: 552, label: 'Bulk drinking-water supply', sub: '9 sensors · 1 sample per minute', col: '#1d6fd1' }],
  comps: [
    { id: 'dam', t: 'reservoir', x: 36, y: 214, w: 120, h: 104, label: 'Reservoir', dam: true },
    { id: 'wtp', t: 'building', x: 186, y: 196, w: 124, h: 118, label: 'Treatment plant', sub: 'ClO₂ dosing' },
    { id: 'J', t: 'node', x: 400, y: 256 },
    { id: 'FM1', t: 'fm', x: 486, y: 150, label: 'Flow meter L1', chs: ['Fm'] },
    { id: 'MS1', t: 'analyser', x: 590, y: 150, label: 'MS1', chs: ['Cl'] },
    { id: 'FM2', t: 'fm', x: 486, y: 450, label: 'Flow meter L2', chs: ['Fm_2'] },
    { id: 'MS2', t: 'analyser', x: 590, y: 450, label: 'MS2', chs: ['Cl_2'] },
    { id: 'st', t: 'building', x: 646, y: 200, w: 210, h: 186, label: 'Measuring station', sub: 'quality analysers on a sample stream', rack: true,
      chs: ['Tp', 'pH', 'Redox', 'Leit', 'Trueb'] },
    { id: 'town1', t: 'town', x: 900, y: 96, w: 80, h: 90, label: 'Clients · line 1' },
    { id: 'town2', t: 'town', x: 900, y: 402, w: 80, h: 90, label: 'Clients · line 2' },
  ],
  pipes: [
    { k: 'water', pts: [[156, 256], [186, 256]], f: { ch: 'Fm' } },
    { k: 'water', pts: [[310, 256], [400, 256]], f: { ch: 'Fm' }, w: 10 },
    { k: 'water', pts: [[400, 256], [400, 150], [904, 150]], f: { ch: 'Fm' }, w: 9, tint: 'Trueb' },
    { k: 'water', pts: [[400, 256], [400, 450], [904, 450]], f: { ch: 'Fm_2' }, w: 9, tint: 'Trueb' },
    { k: 'water', pts: [[700, 150], [700, 200]], f: 0.4, w: 4 },
    { k: 'water', pts: [[804, 200], [804, 150]], f: 0.4, w: 4 },
  ],
  tags: [
    { ch: 'Fm', x: 486, y: 104 },
    { ch: 'Cl', x: 590, y: 104 },
    { ch: 'Fm_2', x: 486, y: 498 },
    { ch: 'Cl_2', x: 590, y: 498 },
    { ch: 'Tp', x: 698, y: 276 },
    { ch: 'pH', x: 802, y: 276 },
    { ch: 'Redox', x: 698, y: 316 },
    { ch: 'Leit', x: 802, y: 316 },
    { ch: 'Trueb', x: 750, y: 356 },
  ],
};

/* palette of fluids and lines */
TW.FLUID = {
  water: '#39b6ff', hot: '#ff8a3d', hotret: '#d98c5f', cool: '#68e0ff', nutrient: '#5fd38f',
  shaft: '#9aa7bd', power: '#ffd166', signal: '#7f8ca6',
};
