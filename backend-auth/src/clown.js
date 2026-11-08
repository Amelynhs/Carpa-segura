// Hermenegildo, versión SVG para las páginas del backend (login y enrolamiento).
export const HERMENEGILDO_SVG = `
<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg" class="clown" aria-label="Hermenegildo el payaso">
  <defs>
    <linearGradient id="hat" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe8a3"/><stop offset="1" stop-color="#ffc7a8"/>
    </linearGradient>
  </defs>
  <!-- pelo -->
  <circle cx="48" cy="112" r="30" fill="#cdb4f6"/><circle cx="34" cy="138" r="22" fill="#b9e6d3"/>
  <circle cx="172" cy="112" r="30" fill="#ffc2dc"/><circle cx="186" cy="138" r="22" fill="#bfe3ff"/>
  <!-- sombrero -->
  <path d="M110 12 L148 78 Q110 92 72 78 Z" fill="url(#hat)" stroke="#f3b99b" stroke-width="2"/>
  <circle cx="110" cy="12" r="11" fill="#ffc2dc"/>
  <circle cx="98" cy="52" r="5" fill="#ffffff" opacity=".85"/><circle cx="120" cy="40" r="4" fill="#cdb4f6"/>
  <circle cx="124" cy="64" r="4" fill="#b9e6d3"/>
  <!-- cara -->
  <circle cx="110" cy="128" r="58" fill="#fff4ea" stroke="#f1d9c6" stroke-width="2"/>
  <circle cx="76" cy="144" r="11" fill="#ffc2dc" opacity=".75"/><circle cx="144" cy="144" r="11" fill="#ffc2dc" opacity=".75"/>
  <!-- ojos con rombos -->
  <path d="M82 110 l7 -12 l7 12 l-7 12 z" fill="#bfe3ff"/><path d="M124 110 l7 -12 l7 12 l-7 12 z" fill="#cdb4f6"/>
  <circle cx="89" cy="111" r="4.5" fill="#5b4b7a"/><circle cx="131" cy="111" r="4.5" fill="#5b4b7a"/>
  <circle cx="90.5" cy="109.5" r="1.4" fill="#fff"/><circle cx="132.5" cy="109.5" r="1.4" fill="#fff"/>
  <!-- nariz y sonrisa -->
  <circle cx="110" cy="132" r="13" fill="#ff9eb5"/><circle cx="106" cy="127" r="4" fill="#fff" opacity=".7"/>
  <path d="M80 152 Q110 184 140 152" fill="#ffd6e2" stroke="#e58aa6" stroke-width="3" stroke-linecap="round"/>
  <!-- corbatín -->
  <path d="M110 192 L82 178 L82 206 Z" fill="#b9e6d3" stroke="#8ccdb3" stroke-width="2"/>
  <path d="M110 192 L138 178 L138 206 Z" fill="#b9e6d3" stroke="#8ccdb3" stroke-width="2"/>
  <circle cx="110" cy="192" r="8" fill="#cdb4f6"/>
</svg>`;
