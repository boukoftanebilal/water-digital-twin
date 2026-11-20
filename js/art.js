/* Small illustrations of the five plants for the home page */
'use strict';
TW.ART = {
  hai: `<svg viewBox="0 0 320 150"><defs><linearGradient id="aw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0284c7"/></linearGradient><linearGradient id="ah" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdba74"/><stop offset="1" stop-color="#ea580c"/></linearGradient></defs>
  <rect x="14" y="40" width="34" height="70" rx="6" fill="#f1f5f9" stroke="#7b8ba1"/><rect x="17" y="62" width="28" height="45" rx="4" fill="url(#ah)"/>
  <rect x="14" y="118" width="40" height="22" rx="4" fill="#f1f5f9" stroke="#7b8ba1"/>
  <path fill="none" d="M48 80 H92" stroke="#ea580c" stroke-width="5" stroke-dasharray="6 6"/><circle cx="100" cy="80" r="10" fill="#e2e8f0" stroke="#22a052" stroke-width="2"/>
  <rect x="118" y="62" width="56" height="36" rx="10" fill="#e2e8f0" stroke="#64748b"/><path d="M124 80 l6 -10 l6 20 l6 -20 l6 20 l6 -20 l6 10" fill="none" stroke="#ea580c" stroke-width="2"/>
  <path fill="none" d="M174 80 H212" stroke="#0284c7" stroke-width="5" stroke-dasharray="6 6"/><rect x="212" y="50" width="30" height="62" rx="6" fill="#f1f5f9" stroke="#7b8ba1"/><rect x="215" y="72" width="24" height="37" rx="3" fill="url(#aw)"/>
  <rect x="256" y="30" width="56" height="10" rx="3" fill="#e2e8f0"/><rect x="258" y="16" width="16" height="14" rx="3" fill="#e2e8f0"/><line x1="274" y1="23" x2="310" y2="23" stroke="#64748b" stroke-width="3"/><ellipse cx="290" cy="23" rx="3" ry="11" fill="#94a3b8"/><ellipse cx="300" cy="23" rx="3" ry="11" fill="#94a3b8"/>
  <circle cx="276" cy="100" r="13" fill="#e2e8f0" stroke="#ca8a04" stroke-width="2"/><text x="276" y="105" text-anchor="middle" font-size="13" font-weight="700" fill="#ca8a04">G</text>
  <path fill="none" d="M289 100 H312 V135" stroke="#ca8a04" stroke-width="3" stroke-dasharray="3 5"/></svg>`,
  skab: `<svg viewBox="0 0 320 150"><defs><linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0284c7"/></linearGradient></defs>
  <rect x="24" y="34" width="60" height="90" rx="8" fill="#f1f5f9" stroke="#7b8ba1"/><rect x="27" y="58" width="54" height="63" rx="5" fill="url(#bw)"/>
  <path d="M54 124 V138 H150 M180 120 V86 H284 V20 H54 V34" fill="none" stroke="#e2e8f0" stroke-width="9" stroke-linejoin="round"/>
  <path d="M54 124 V138 H150 M180 120 V86 H284 V20 H54 V34" fill="none" stroke="#0284c7" stroke-width="4" stroke-dasharray="7 9" stroke-linejoin="round"/>
  <path d="M96 128 l14 10 l-14 10 Z M124 128 l-14 10 l14 10 Z" fill="#0284c7" stroke="#64748b"/><circle cx="180" cy="134" r="16" fill="#e2e8f0" stroke="#22a052" stroke-width="2.5"/>
  <path d="M274 54 l10 14 l10 -14 Z M274 82 l10 -14 l10 14 Z" fill="#f59e0b" stroke="#64748b"/><rect x="214" y="78" width="22" height="16" rx="4" fill="#ffffff" stroke="#64748b"/></svg>`,
  smartfarm: `<svg viewBox="0 0 320 150"><circle cx="40" cy="30" r="14" fill="#f59e0b"/><path d="M120 140 V60 L170 22 L220 60 L270 22 L310 60 V140 Z" fill="rgba(220,252,231,.7)" stroke="#16a34a"/>
  <rect x="44" y="70" width="44" height="66" rx="6" fill="#f1f5f9" stroke="#7b8ba1"/><rect x="47" y="96" width="38" height="37" rx="4" fill="#4ade80"/>
  <path fill="none" d="M88 124 H128 V128 H300" stroke="#16a34a" stroke-width="4" stroke-dasharray="6 6"/>
  <rect x="134" y="118" width="74" height="18" rx="4" fill="#6b4a2f"/><rect x="226" y="118" width="74" height="18" rx="4" fill="#4a3220"/>
  <g fill="#4fc26b">${[148, 166, 184, 240, 258, 276].map(x => `<ellipse cx="${x}" cy="112" rx="6" ry="3"/><ellipse cx="${x + 6}" cy="108" rx="6" ry="3"/>`).join('')}</g>
  <rect x="150" y="76" width="50" height="5" rx="2" fill="#facc15"/><path d="M152 81 L140 112 H210 L198 81 Z" fill="#facc15" opacity=".15"/><rect x="236" y="76" width="50" height="5" rx="2" fill="#facc15"/></svg>`,
  wdsevent: `<svg viewBox="0 0 320 150"><rect x="12" y="24" width="40" height="30" rx="4" fill="#0284c7" opacity=".85"/><rect x="12" y="96" width="40" height="30" rx="4" fill="#0284c7" opacity=".85"/>
  <path d="M52 39 H120 V111 H52 M120 39 H230 V111 H120 M230 60 H300 M230 96 H300" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-linejoin="round"/>
  <path d="M52 39 H120 V111 H52 M120 39 H230 V111 H120 M230 60 H300 M230 96 H300" fill="none" stroke="#0284c7" stroke-width="3" stroke-dasharray="6 8" stroke-linejoin="round"/>
  ${[[78, 39], [78, 111], [262, 60], [262, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#e2e8f0" stroke="#22a052" stroke-width="2"/>`).join('')}
  <path d="M166 31 l10 8 l-10 8 Z M186 31 l-10 8 l10 8 Z" fill="#0284c7" stroke="#64748b"/><path d="M166 103 l10 8 l-10 8 Z M186 103 l-10 8 l10 8 Z" fill="#0284c7" stroke="#64748b"/>
  <path d="M232 104 q4 8 0 12 q-4 -4 0 -12" fill="#0284c7"/></svg>`,
  gecco: `<svg viewBox="0 0 320 150"><path d="M10 60 L18 110 H70 L78 60 Z" fill="#ffffff" stroke="#7b8ba1"/><path d="M14 72 H74 L70 108 H18 Z" fill="#0284c7" opacity=".85"/><rect x="76" y="56" width="8" height="56" fill="#cbd5e1"/>
  <rect x="96" y="66" width="46" height="42" rx="3" fill="#f1f5f9" stroke="#7b8ba1"/><path d="M92 68 L119 52 L146 68 Z" fill="#e2e8f0"/>
  <path d="M142 88 H170 V40 H310 M170 88 V124 H310" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linejoin="round"/>
  <path d="M142 88 H170 V40 H310 M170 88 V124 H310" fill="none" stroke="#0284c7" stroke-width="3" stroke-dasharray="6 8" stroke-linejoin="round"/>
  <rect x="226" y="64" width="62" height="42" rx="3" fill="#f1f5f9" stroke="#7b8ba1"/>${[0, 1, 2, 3, 4].map(k => `<rect x="${232 + k * 11}" y="80" width="8" height="18" rx="1" fill="#14b8a6"/>`).join('')}
  <rect x="196" y="28" width="18" height="12" rx="2" fill="#f1f5f9" stroke="#64748b"/><rect x="196" y="112" width="18" height="12" rx="2" fill="#f1f5f9" stroke="#64748b"/></svg>`,
};
