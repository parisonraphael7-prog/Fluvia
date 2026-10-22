/* Fluvia — jeu de cartes à collectionner tiré des données DataGrandEst 2026 */
const $ = (id) => document.getElementById(id);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 60) : ms));

/* ---------- données ---------- */
const DATA = await (async () => {
  const e = document.getElementById('data-cards');
  if (e) return JSON.parse(e.textContent);
  const r = await fetch('data/cards.json'); if (!r.ok) throw new Error('cards.json'); return r.json();
})();
const CARDS = DATA.cards, BYID = new Map(CARDS.map(c => [c.id, c])), TOTAL = CARDS.length;
const RIVERS = CARDS.filter(c => c.type === 'river'), PHENS = CARDS.filter(c => c.type === 'phen');
const BAS = { R: 'Rhin · Moselle', M: 'Meuse', S: 'Seine · Marne', O: 'Saône', '*': 'Spéciales' };
const BAS_OF = { R: 'du Rhin et de la Moselle', M: 'de la Meuse', S: 'de la Seine et de la Marne', O: 'de la Saône' };
// palettes vives par bassin : [clair, principal, profond]
const PAL = {
  R: ['#bff3ff', '#19d3ff', '#2a5bff'], M: ['#f0d9ff', '#c15bff', '#5b2bd6'],
  S: ['#ffe9b3', '#ffb21a', '#ff4f1f'], O: ['#c9ffe3', '#2fe08a', '#0f8f9a'],
};
const PHPAL = {
  sec: ['#ffe2b0', '#ff7a1a', '#b3121c'], haut: ['#cfe8ff', '#2b9bff', '#1b2fb8'], chaud: ['#fff3a6', '#ffc21a', '#ff3d1f'],
  froid: ['#eaffff', '#7ee8ff', '#3a6bd5'], pluie: ['#d8ddff', '#5b74ff', '#22205e'], neige: ['#ffffff', '#c7dbf2', '#6f8fb8'],
};
const palOf = (c) => c.type === 'phen' ? PHPAL[c.key] : PAL[c.b];
const RAR_SYM = ['●', '◆', '★', '✦', '✺'], RAR_NAME = ['Commune', 'Peu commune', 'Rare', 'Ultra-rare', 'Spéciale'];
const ATTR = {
  power: { label: 'Puissance', ends: ['discrète', 'puissante'], icon: 'drop' },
  res: { label: 'Résistance à la sécheresse', short: 'Résistance', ends: ['fragile', 'tenace'], icon: 'sun' },
  crue: { label: 'Tempérament en crue', short: 'Crue', ends: ['calme', 'fougueuse'], icon: 'wave' },
  freq: { label: 'Fréquence', ends: ['rare', 'fréquent'], icon: 'star' },
  dur: { label: 'Durée', ends: ['brève', 'longue'], icon: 'clock' },
};
const pips = (v) => v == null ? 0 : clamp(Math.ceil(v * 5), 1, 5);
const fixDept = (d) => d.replace(/-Et-/g, '-et-').replace(/-De-/g, '-de-').replace(/-Sur-/g, '-sur-').replace(/D'/g, "d'");
const num = (n) => String(n).padStart(3, '0');

/* ---------- collection (navigateur) ---------- */
const KEY = 'rivieres-tcg-v1';
let OWN = {}, OPENED = 0;
try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); OWN = s.own || {}; OPENED = s.opened || 0; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ own: OWN, opened: OPENED })); } catch (e) {} };
const owned = (id) => (OWN[id] || 0) > 0;
const ownedCount = () => CARDS.filter(c => owned(c.id)).length;
function updateCount() { $('albumCount').textContent = `${ownedCount()} / ${TOTAL}`; }

/* ---------- utilitaires de dessin ---------- */
function rng(seed) { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const FD = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif', FU = '"Rubik", Arial, sans-serif';
function fit(g, txt, maxW, size, weight, font, italic = '') { let s = size; do { g.font = `${italic} ${weight} ${s}px ${font}`; s -= 1; } while (g.measureText(txt).width > maxW && s > 12); return s + 1; }
function wrap(g, txt, x, y, maxW, lh, maxLines = 3) {
  const words = txt.split(' '); let line = '', yy = y, n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; if (++n >= maxLines) return; } else line = t; }
  if (line) g.fillText(line, x, yy);
}
const metal = (g, x0, y0, x1, y1, gold) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const st = gold ? ['#fff3b0', '#e0a92a', '#fff6c8', '#b8801a', '#ffe58a'] : ['#ffffff', '#aeb6c8', '#f4f7ff', '#8b93a8', '#e8ecf6'];
  st.forEach((c, i) => gr.addColorStop(i / (st.length - 1), c)); return gr;
};
// icônes vectorielles (goutte, soleil, vague, étoile, horloge)
function icon(g, kind, x, y, r, fill) {
  g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round'; g.fillStyle = fill;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.lineWidth = r * .12; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = r * .14;
  if (kind === 'drop') { g.beginPath(); g.moveTo(0, -r * .62); g.bezierCurveTo(r * .5, -r * .05, r * .48, r * .55, 0, r * .55); g.bezierCurveTo(-r * .48, r * .55, -r * .5, -r * .05, 0, -r * .62); g.fill(); }
  else if (kind === 'sun') { g.beginPath(); g.arc(0, 0, r * .3, 0, Math.PI * 2); g.fill(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * r * .45, Math.sin(a) * r * .45); g.lineTo(Math.cos(a) * r * .66, Math.sin(a) * r * .66); g.stroke(); } }
  else if (kind === 'wave') { for (const dy of [-.22, .18]) { g.beginPath(); for (let t = -.6; t <= .6; t += .05) { const xx = t * r, yy = dy * r + Math.sin(t * 7) * r * .1; t === -.6 ? g.moveTo(xx, yy) : g.lineTo(xx, yy); } g.stroke(); } }
  else if (kind === 'star') { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .25 : r * .6; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
  else if (kind === 'clock') { g.beginPath(); g.arc(0, 0, r * .5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * .32); g.moveTo(0, 0); g.lineTo(r * .24, r * .1); g.stroke(); }
  g.restore();
}
function dropShape(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.bezierCurveTo(x + s * .8, y - s * .1, x + s * .75, y + s * .85, x, y + s * .85); g.bezierCurveTo(x - s * .75, y + s * .85, x - s * .8, y - s * .1, x, y - s); }

/* =====================================================================
   IMAGES : dessin différé (temps libre du navigateur), fichiers Blob, 3 tailles
   ===================================================================== */
const DPR = Math.min(2, devicePixelRatio || 1);
const BUCKETS = [340, 640, 900];
const bucket = (w) => BUCKETS.find(b => w * DPR <= b) || 900;
const IMG = new Map(), QUEUE = [];
let pumping = false;
const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 250 }) : (f) => setTimeout(() => f({ timeRemaining: () => 10 }), 16);
function runJob(j) { if (j.ran) return; j.ran = true; const cv = j.draw(); cv.toBlob(b => j.res(URL.createObjectURL(b)), 'image/jpeg', .9); }
function pump() {
  if (pumping) return; pumping = true;
  // au moins une image par passage : la file avance même si le navigateur n'est jamais « libre » (animations continues)
  const step = (dl) => { let ran = 0; while (QUEUE.length && (ran === 0 || dl.timeRemaining() > 4)) { runJob(QUEUE.shift()); ran++; } if (QUEUE.length) idle(step); else pumping = false; };
  idle(step);
}
// prio : 0 = arrière-plan, 1 = bientôt (tête de file), 2 = tout de suite
function imgURL(key, draw, prio = 0) {
  let e = IMG.get(key);
  if (!e) { let res; const p = new Promise(r => res = r); e = { p, job: { draw, res, ran: false } }; IMG.set(key, e); if (prio < 2) { prio ? QUEUE.unshift(e.job) : QUEUE.push(e.job); pump(); } }
  if (prio === 2 && !e.job.ran) { const i = QUEUE.indexOf(e.job); if (i >= 0) QUEUE.splice(i, 1); runJob(e.job); }
  else if (prio === 1 && !e.job.ran) { const i = QUEUE.indexOf(e.job); if (i > 0) { QUEUE.splice(i, 1); QUEUE.unshift(e.job); } }
  return e.p;
}
const frontURL = (c, px, prio = 0) => imgURL(`f${c.id}@${px}`, () => drawFront(c, px), prio);
const versoURL = (c, px, prio = 0) => imgURL(`v${c.id}@${px}`, () => drawVerso(c, px), prio);
const backURL = (prio = 0) => imgURL('back', drawBack, prio);
const packURL = (b, prio = 0) => imgURL(`p${b}`, () => drawPack(b), prio);
function setSrc(img, promise) { img.decoding = 'async'; promise.then(u => { img.src = u; }); }

/* =====================================================================
   ILLUSTRATIONS
   ===================================================================== */
// rivière : fond éclatant, rayons, trame, réseau voisin, tracé lumineux
function riverArt(g, c, x, y, w, h, full) {
  const [lt, mid, dp] = palOf(c), a = c.art, r = rng(c.id);
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, full ? 0 : 12); g.clip();
  let sx = 0, sy = 0, n = 0; for (let i = 0; i < a.river.length; i += 10) { sx += a.river[i]; sy += a.river[i + 1]; n++; }
  const cx = x + (n ? sx / n : 500) / 1000 * w, cy = y + (n ? sy / n : 380) / 760 * h;
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * .85);
  bg.addColorStop(0, lt); bg.addColorStop(.35, mid); bg.addColorStop(1, dp); g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.save(); g.translate(cx, cy); g.globalAlpha = .16; g.fillStyle = '#fff';
  for (let k = 0; k < 18; k++) { const a0 = k / 18 * Math.PI * 2 + r() * .1; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Math.max(w, h) * 1.2, a0, a0 + .09); g.closePath(); g.fill(); }
  g.restore();
  g.fillStyle = hexA(dp, .35);
  for (let yy = y + h * .55; yy < y + h; yy += 9) for (let xx = x + ((yy / 9) % 2) * 4.5; xx < x + w; xx += 9) { const t = (yy - y - h * .55) / (h * .45); g.beginPath(); g.arc(xx, yy, .5 + t * 2.4, 0, Math.PI * 2); g.fill(); }
  const X = (v) => x + v / 1000 * w, Y = (v) => y + v / 760 * h;
  g.setLineDash([5, 6]); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; g.beginPath();
  for (let i = 0; i < a.region.length; i += 5) { g.moveTo(X(a.region[i]), Y(a.region[i + 1])); g.lineTo(X(a.region[i + 2]), Y(a.region[i + 3])); } g.stroke(); g.setLineDash([]);
  g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.32)';
  for (let i = 0; i < a.ctx.length; i += 5) { g.lineWidth = .6 + a.ctx[i + 4] * .06; g.beginPath(); g.moveTo(X(a.ctx[i]), Y(a.ctx[i + 1])); g.lineTo(X(a.ctx[i + 2]), Y(a.ctx[i + 3])); g.stroke(); }
  const k = (w / 516) * Math.max(.8, Math.min(1.6, 2.2 / (a.scale * 6 + .6))) * (full ? 1.35 : 1);
  if (a.river.length <= 15) {
    // tracé absent des contours fournis : méandre symbolique, signalé comme tel
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const ph = r() * 2, pts = []; for (let t = 0; t <= 1.0001; t += .02) pts.push([x + w * (.12 + t * .76), y + h * (.5 + Math.sin(t * Math.PI * 3.2 + ph) * .16 + Math.sin(t * Math.PI * 7 + ph) * .03)]);
    for (const [lw, col, bl] of [[22 * w / 516, hexA(lt, .55), 24], [10 * w / 516, dp, 0], [4 * w / 516, '#fff', 6]]) { g.shadowColor = col; g.shadowBlur = bl; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); }
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `600 ${15 * w / 516}px ${FU}`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('tracé symbolique', x + w - 12, y + h - 10);
    g.restore(); g.restore(); return;
  }
  const seg = (lw, col, blur) => {
    g.save(); g.strokeStyle = col; g.lineJoin = 'round'; if (blur) { g.shadowColor = col; g.shadowBlur = blur; }
    for (let i = 0; i < a.river.length; i += 5) { g.lineWidth = lw(a.river[i + 4]); g.beginPath(); g.moveTo(X(a.river[i]), Y(a.river[i + 1])); g.lineTo(X(a.river[i + 2]), Y(a.river[i + 3])); g.stroke(); }
    g.restore();
  };
  seg((v) => (6 + v * .3) * k, hexA(lt, .55), 24 * k);
  seg((v) => (4 + v * .22) * k, dp, 0);
  seg((v) => (1.6 + v * .12) * k, '#ffffff', 6 * k);
  for (const [px, py] of a.st) { g.beginPath(); g.arc(X(px), Y(py), 5.5 * k, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.4 * k; g.strokeStyle = dp; g.stroke(); }
  g.restore();
}
// spéciales : compositions graphiques dessinées
function phenArt(g, c, x, y, w, h) {
  const [lt, mid, dp] = palOf(c), r = rng(c.id), cx = x + w / 2, cy = y + h * .42;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * .8); bg.addColorStop(0, lt); bg.addColorStop(.4, mid); bg.addColorStop(1, dp); g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.save(); g.translate(cx, cy); g.globalAlpha = .18; g.fillStyle = '#fff';
  for (let k = 0; k < 24; k++) { const a0 = k / 24 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Math.max(w, h), a0, a0 + .07); g.closePath(); g.fill(); }
  g.restore();
  const s = w / 600;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const glow = (col, b) => { g.shadowColor = col; g.shadowBlur = b * s; };
  const sun = (sx, sy, R, rays) => { g.save(); glow('#fff6c0', 40); g.fillStyle = '#fff8d6'; g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.fill(); g.restore();
    g.strokeStyle = '#fff8d6'; g.lineWidth = 8 * s; for (let k = 0; k < rays; k++) { const a = k / rays * Math.PI * 2; g.beginPath(); g.moveTo(sx + Math.cos(a) * R * 1.3, sy + Math.sin(a) * R * 1.3); g.lineTo(sx + Math.cos(a) * R * (k % 2 ? 1.65 : 1.9), sy + Math.sin(a) * R * (k % 2 ? 1.65 : 1.9)); g.stroke(); } };
  const flake = (fx, fy, R, lw) => { g.strokeStyle = '#fff'; g.lineWidth = lw * s; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * R, fy + Math.sin(a) * R); g.stroke();
    for (const t of [.45, .72]) { const bx = fx + Math.cos(a) * R * t, by = fy + Math.sin(a) * R * t; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + sg * .75) * R * .26, by + Math.sin(a + sg * .75) * R * .26); g.stroke(); } } } };
  const cloud = (qx, qy, q, col = '#fff') => { g.save(); glow('rgba(0,0,0,.3)', 20); g.fillStyle = col; g.beginPath(); g.arc(qx - q * .55, qy + q * .1, q * .42, 0, Math.PI * 2); g.arc(qx, qy - q * .2, q * .58, 0, Math.PI * 2); g.arc(qx + q * .6, qy + q * .08, q * .45, 0, Math.PI * 2); g.rect(qx - q * .95, qy + q * .1, q * 1.95, q * .42); g.fill(); g.restore(); };
  switch (c.key) {
    case 'sec': {
      sun(cx, y + h * .3, 70 * s, 16);
      g.fillStyle = hexA(dp, .85); g.fillRect(x, y + h * .62, w, h);
      g.strokeStyle = hexA(lt, .9); g.lineWidth = 3.5 * s;
      for (let k = 0; k < 22; k++) { let px = x + r() * w, py = y + h * .62; g.beginPath(); g.moveTo(px, py); for (let t = 0; t < 4; t++) { px += (r() - .5) * 90 * s; py += (18 + r() * 30) * s; g.lineTo(px, py); } g.stroke(); }
      break; }
    case 'haut': { for (let k = 0; k < 6; k++) { const yy = y + h * (.35 + k * .11); g.strokeStyle = k % 2 ? '#fff' : hexA(lt, .9); g.lineWidth = (10 - k) * s; g.beginPath(); for (let px = x - 20; px <= x + w + 20; px += 6) { const py = yy + Math.sin((px + k * 40) / (32 * s)) * 16 * s; px === x - 20 ? g.moveTo(px, py) : g.lineTo(px, py); } g.stroke(); } cloud(cx - 90 * s, y + h * .15, 90 * s); break; }
    case 'chaud': { sun(cx, cy, 95 * s, 24); for (let k = 0; k < 4; k++) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5 * s; const yy = y + h * .82 + k * 14 * s; g.beginPath(); for (let px = x + 30; px <= x + w - 30; px += 5) { const py = yy + Math.sin(px / (10 * s) + k) * 5 * s; px === x + 30 ? g.moveTo(px, py) : g.lineTo(px, py); } g.stroke(); } break; }
    case 'froid': { g.save(); glow('#bff7ff', 30); flake(cx, cy, 130 * s, 12); g.restore(); for (let k = 0; k < 16; k++) flake(x + r() * w, y + r() * h, (10 + r() * 16) * s, 3); break; }
    case 'pluie': { cloud(cx - 70 * s, y + h * .2, 110 * s, '#e8ebff'); cloud(cx + 120 * s, y + h * .14, 80 * s, '#d0d6ff'); g.strokeStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 90; k++) { const px = x + r() * (w + 100) - 50, py = y + h * .38 + r() * h * .62; g.lineWidth = (2 + r() * 2.5) * s; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 14 * s, py + 34 * s); g.stroke(); }
      g.save(); glow('#fff6a0', 26); g.fillStyle = '#fff6a0'; g.beginPath(); g.moveTo(cx + 10 * s, y + h * .3); g.lineTo(cx - 30 * s, y + h * .58); g.lineTo(cx, y + h * .58); g.lineTo(cx - 24 * s, y + h * .86); g.lineTo(cx + 40 * s, y + h * .5); g.lineTo(cx + 8 * s, y + h * .5); g.closePath(); g.fill(); g.restore(); break; }
    case 'neige': { cloud(cx, y + h * .18, 140 * s, '#f3f7ff'); for (let k = 0; k < 26; k++) flake(x + 30 + r() * (w - 60), y + h * .4 + r() * h * .55, (10 + r() * 22) * s, 3.5); break; }
  }
  g.restore();
}

/* =====================================================================
   RECTO D'UNE CARTE — 600 × 840
   ===================================================================== */
const CW = 600, CH = 840;
function drawFront(c, px) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * CH / CW);
  const g = cv.getContext('2d'); g.scale(px / CW, px / CW);
  const [lt, mid, dp] = palOf(c);
  const full = c.rar >= 3, gold = c.rar >= 2;
  g.fillStyle = full ? metal(g, 0, 0, CW, CH, true) : (() => { const gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, mid); gr.addColorStop(1, dp); return gr; })();
  g.beginPath(); g.roundRect(0, 0, CW, CH, 30); g.fill();
  g.save(); g.beginPath(); g.roundRect(0, 0, CW, CH, 30); g.clip(); g.globalAlpha = .14; g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let i = -CH; i < CW; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + CH, CH); g.stroke(); } g.restore();
  const IX = 20, IY = 20, IW = CW - 40, IH = CH - 40;
  if (full) {
    g.save(); g.beginPath(); g.roundRect(IX, IY, IW, IH, 18); g.clip();
    if (c.type === 'phen') phenArt(g, c, IX, IY, IW, IH); else riverArt(g, c, IX, IY, IW, IH, true);
    const sh = g.createLinearGradient(0, IY + IH * .45, 0, IY + IH); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.82)'); g.fillStyle = sh; g.fillRect(IX, IY, IW, IH);
    const st = g.createLinearGradient(0, IY, 0, IY + 130); st.addColorStop(0, 'rgba(0,0,0,.55)'); st.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = st; g.fillRect(IX, IY, IW, 130);
    g.restore();
    g.strokeStyle = metal(g, 0, 0, CW, CH, true); g.lineWidth = 5; g.beginPath(); g.roundRect(IX, IY, IW, IH, 18); g.stroke();
    header(g, c, '#fff', true); attrs(g, c, 520, true); footer(g, c, true);
  } else {
    const pan = g.createLinearGradient(0, IY, 0, IY + IH); pan.addColorStop(0, '#ffffff'); pan.addColorStop(1, lt); g.fillStyle = pan;
    g.beginPath(); g.roundRect(IX, IY, IW, IH, 18); g.fill();
    g.save(); g.beginPath(); g.roundRect(IX, IY, IW, IH, 18); g.clip(); g.globalAlpha = .08; g.fillStyle = dp;
    for (let yy = IY; yy < IY + IH; yy += 10) for (let xx = IX + (yy / 10 % 2) * 5; xx < IX + IW; xx += 10) { g.beginPath(); g.arc(xx, yy, 1.4, 0, Math.PI * 2); g.fill(); } g.restore();
    header(g, c, '#141833', false);
    const AX = 36, AY = 104, AW = 528, AH = 352;
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 4; g.fillStyle = '#000'; g.beginPath(); g.roundRect(AX, AY, AW, AH, 12); g.fill(); g.restore();
    if (c.type === 'phen') phenArt(g, c, AX, AY, AW, AH); else riverArt(g, c, AX, AY, AW, AH, false);
    g.strokeStyle = gold ? metal(g, AX, AY, AX + AW, AY + AH, true) : c.rar === 1 ? metal(g, AX, AY, AX + AW, AY + AH, false) : '#ffffff'; g.lineWidth = gold ? 7 : 5;
    g.beginPath(); g.roundRect(AX, AY, AW, AH, 12); g.stroke();
    const by = 468; g.save(); g.fillStyle = (() => { const gr = g.createLinearGradient(40, 0, 560, 0); gr.addColorStop(0, dp); gr.addColorStop(1, mid); return gr; })();
    g.beginPath(); g.moveTo(52, by); g.lineTo(548, by); g.lineTo(536, by + 34); g.lineTo(64, by + 34); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = c.type === 'phen' ? 'Carte spéciale · phénomène' : `${c.kind} · ${c.depts.map(fixDept).join(' · ')}`;
    fit(g, t.toUpperCase(), 450, 19, 700, FU); g.fillText(t.toUpperCase(), CW / 2, by + 18);
    attrs(g, c, 520, false); footer(g, c, false);
  }
  return cv;
}
function header(g, c, col, full) {
  const [, mid, dp] = palOf(c);
  g.save(); g.fillStyle = full ? 'rgba(0,0,0,.45)' : dp; g.beginPath(); g.roundRect(36, 34, 136, 26, 13); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fit(g, (c.type === 'phen' ? 'Spéciale' : BAS[c.b]).toUpperCase(), 120, 14, 700, FU); g.fillText((c.type === 'phen' ? 'Spéciale' : BAS[c.b]).toUpperCase(), 104, 47.5); g.restore();
  g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (full) { g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 2; }
  fit(g, c.name, c.type === 'phen' ? 400 : 330, 50, 800, FD, 'italic'); g.fillText(c.name, 36, 98);
  if (full) g.restore();
  if (c.type === 'river') {
    const n = pips(c.gauges.power);
    for (let k = 0; k < 5; k++) {
      const x = CW - 46 - k * 28, y = 66; dropShape(g, x, y, 13);
      g.fillStyle = 5 - k <= n ? (full ? '#fff' : mid) : (full ? 'rgba(255,255,255,.25)' : 'rgba(20,24,51,.15)'); g.fill();
      if (5 - k <= n) { g.lineWidth = 2.4; g.strokeStyle = full ? mid : dp; g.stroke(); }
    }
  } else { g.fillStyle = col; g.font = `800 34px ${FD}`; g.textAlign = 'right'; g.fillText('✺', CW - 40, 92); }
}
function attrs(g, c, y0, full) {
  const [lt, mid, dp] = palOf(c);
  const rows = c.type === 'phen' ? [['freq', c.gauges.freq], ['dur', c.gauges.dur]] : [['power', c.gauges.power], ['res', c.gauges.res], ['crue', c.gauges.crue]];
  const top = full ? 548 : y0, rh = c.type === 'phen' ? 62 : 54;
  rows.forEach(([k, v], i) => {
    const y = top + i * rh, cyy = y + (rh - 8) / 2 - 4;
    if (full) { g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.roundRect(36, y - 4, CW - 72, rh - 8, 12); g.fill(); }
    icon(g, ATTR[k].icon, 64, cyy, 19, mid);
    g.fillStyle = full ? '#fff' : '#141833'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `700 25px ${FD}`; g.fillText((ATTR[k].short || ATTR[k].label).toUpperCase(), 94, cyy);
    const n = pips(v);
    for (let p = 0; p < 5; p++) {
      const x = CW - 62 - (4 - p) * 30;
      g.beginPath(); g.arc(x, cyy, 11, 0, Math.PI * 2);
      if (v == null) { g.setLineDash([3, 3]); g.strokeStyle = full ? 'rgba(255,255,255,.5)' : 'rgba(20,24,51,.35)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]); continue; }
      if (p < n) { const gr = g.createLinearGradient(x, cyy - 11, x, cyy + 11); gr.addColorStop(0, lt); gr.addColorStop(1, mid); g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = full ? '#fff' : dp; g.stroke(); }
      else { g.fillStyle = full ? 'rgba(255,255,255,.12)' : 'rgba(20,24,51,.08)'; g.fill(); g.lineWidth = 2; g.strokeStyle = full ? 'rgba(255,255,255,.35)' : 'rgba(20,24,51,.2)'; g.stroke(); }
    }
    if (!full && i < rows.length - 1) { g.strokeStyle = 'rgba(20,24,51,.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, y + rh - 4); g.lineTo(CW - 40, y + rh - 4); g.stroke(); }
  });
  const ty = top + rows.length * rh + 6;
  g.fillStyle = full ? 'rgba(255,255,255,.88)' : '#3a3f63'; g.textAlign = 'center'; g.textBaseline = 'top'; g.font = `italic 400 19px ${FU}`;
  wrap(g, c.type === 'phen' ? c.text : riverMotto(c), CW / 2, ty, 500, 23, 2);
}
function footer(g, c, full) {
  const y = CH - 46; g.textBaseline = 'middle';
  g.fillStyle = c.rar >= 2 ? (full ? '#ffe58a' : '#d9961a') : (full ? '#fff' : '#141833'); g.textAlign = 'left'; g.font = `800 24px ${FD}`;
  g.fillText(`${RAR_SYM[c.rar]} ${RAR_NAME[c.rar].toUpperCase()}`, 40, y);
  g.fillStyle = full ? 'rgba(255,255,255,.8)' : 'rgba(20,24,51,.6)'; g.font = `600 14px ${FU}`; g.textAlign = 'center'; g.fillText('FLUVIA · GRAND EST', CW / 2 + 30, y);
  g.textAlign = 'right'; g.font = `700 18px ${FU}`; g.fillText(`${num(c.no)}/${TOTAL}`, CW - 40, y);
}
function riverMotto(c) {
  const gg = c.gauges, items = [];
  for (const k of ['power', 'res', 'crue']) if (gg[k] != null) items.push([k, gg[k]]);
  if (!items.length) return 'Une rivière discrète, encore peu mesurée.';
  items.sort((a, b) => Math.abs(b[1] - .5) - Math.abs(a[1] - .5));
  const [k, v] = items[0];
  return {
    power: v > .5 ? 'Un cours d’eau puissant, parmi les plus généreux de la région.' : 'Un filet d’eau modeste, qu’on devine plus qu’on ne l’entend.',
    res: v > .5 ? 'Elle tient bon quand l’été assèche ses voisines.' : 'L’été la met à rude épreuve : elle s’amenuise vite.',
    crue: v > .5 ? 'Imprévisible : elle peut gonfler soudain et déborder.' : 'D’humeur égale, elle gonfle sans jamais s’emballer.',
  }[k];
}

/* ---------- verso : où coule-t-elle ? / apparitions ---------- */
function drawVerso(c, px) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * CH / CW); const g = cv.getContext('2d'); g.scale(px / CW, px / CW);
  const [lt, mid, dp] = palOf(c);
  const gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, dp); gr.addColorStop(1, '#0b0d24'); g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, CW, CH, 30); g.fill();
  g.strokeStyle = hexA(lt, .6); g.lineWidth = 3; g.beginPath(); g.roundRect(18, 18, CW - 36, CH - 36, 20); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `700 16px ${FU}`; g.fillStyle = hexA(lt, .9); g.fillText(c.type === 'phen' ? 'SES APPARITIONS, 2000 – 2026' : 'OÙ COULE-T-ELLE ?', CW / 2, 70);
  g.fillStyle = '#fff'; fit(g, c.name, 500, 48, 800, FD, 'italic'); g.fillText(c.name, CW / 2, 122);
  if (c.type === 'river') {
    const S = 470, ox = (CW - S) / 2, oy = 160 + (S * .78 - DATA.regionH * S / 1000) / 2;
    g.save(); g.fillStyle = 'rgba(255,255,255,.08)'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    for (const ring of DATA.region) { g.beginPath(); for (let i = 0; i < ring.length; i += 2) { const xx = ox + ring[i] / 1000 * S, yy = oy + ring[i + 1] / 1000 * S; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.closePath(); g.fill(); g.stroke(); }
    g.lineCap = 'round'; g.shadowColor = mid; g.shadowBlur = 14; g.strokeStyle = lt; g.lineWidth = 6;
    g.beginPath(); for (let i = 0; i < c.mini.length; i += 4) { g.moveTo(ox + c.mini[i] / 1000 * S, oy + c.mini[i + 1] / 1000 * S); g.lineTo(ox + c.mini[i + 2] / 1000 * S, oy + c.mini[i + 3] / 1000 * S); } g.stroke();
    g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.stroke(); g.restore();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `500 17px ${FU}`; g.fillText(`Bassin ${BAS_OF[c.b]}`, CW / 2, 560);
  } else {
    const tx = 60, tw = CW - 120, ty = 200, th = 170;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(tx - 10, ty - 10, tw + 20, th + 50, 14); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty + th); g.lineTo(tx + tw, ty + th); g.stroke();
    for (const [a, b] of c.occ) { const x0 = tx + a / DATA.W * tw, wd = Math.max(4, (b - a + 1) / DATA.W * tw); g.save(); g.shadowColor = mid; g.shadowBlur = 10; g.fillStyle = lt; g.fillRect(x0, ty + 10, wd, th - 10); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 18px ${FU}`; g.textAlign = 'left'; g.fillText('2000', tx, ty + th + 30); g.textAlign = 'right'; g.fillText('2026', tx + tw, ty + th + 30);
    g.textAlign = 'center'; g.font = `italic 400 20px ${FU}`; g.fillStyle = 'rgba(255,255,255,.85)'; wrap(g, c.text, CW / 2, 450, 470, 26, 3);
  }
  const rows = c.type === 'phen' ? [['freq', c.gauges.freq], ['dur', c.gauges.dur]] : [['power', c.gauges.power], ['res', c.gauges.res], ['crue', c.gauges.crue]];
  rows.forEach(([k, v], i) => {
    const y = 592 + i * 68 + (c.type === 'phen' ? 20 : 0);
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `700 22px ${FD}`; g.fillText(ATTR[k].label.toUpperCase(), 50, y);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(50, y + 10, CW - 100, 14, 7); g.fill();
    if (v != null) { const bg = g.createLinearGradient(50, 0, CW - 50, 0); bg.addColorStop(0, dp); bg.addColorStop(1, lt); g.fillStyle = bg; g.beginPath(); g.roundRect(50, y + 10, (CW - 100) * (.08 + v * .92), 14, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `italic 400 14px ${FU}`; g.textAlign = 'left'; g.fillText(ATTR[k].ends[0], 50, y + 41); g.textAlign = 'right'; g.fillText(v == null ? 'non mesuré' : ATTR[k].ends[1], CW - 50, y + 41);
  });
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = `700 15px ${FU}`; g.fillText(`${RAR_SYM[c.rar]} ${RAR_NAME[c.rar].toUpperCase()} · ${num(c.no)}/${TOTAL}`, CW / 2, CH - 42);
  return cv;
}

/* ---------- dos des cartes ---------- */
function drawBack() {
  const cv = document.createElement('canvas'); cv.width = 600; cv.height = 840; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(300, 420, 30, 300, 420, 560); gr.addColorStop(0, '#3a2bd6'); gr.addColorStop(.55, '#151a6b'); gr.addColorStop(1, '#070921'); g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, 600, 840, 30); g.fill();
  g.save(); g.beginPath(); g.roundRect(0, 0, 600, 840, 30); g.clip(); g.translate(300, 420);
  for (let k = 0; k < 40; k++) { g.rotate(Math.PI / 20); g.strokeStyle = k % 2 ? 'rgba(25,211,255,.35)' : 'rgba(193,91,255,.3)'; g.lineWidth = 3; g.beginPath(); for (let t = 0; t < 1; t += .02) { const rr = 40 + t * 560, a = t * 2.6; const xx = Math.cos(a) * rr, yy = Math.sin(a) * rr; t ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
  g.restore();
  g.strokeStyle = metal(g, 0, 0, 600, 840, true); g.lineWidth = 10; g.beginPath(); g.roundRect(14, 14, 572, 812, 24); g.stroke();
  g.fillStyle = '#0b0d24'; g.beginPath(); g.arc(300, 420, 128, 0, Math.PI * 2); g.fill(); g.strokeStyle = metal(g, 170, 290, 430, 550, true); g.lineWidth = 8; g.stroke();
  const lg = g.createLinearGradient(190, 0, 410, 0); lg.addColorStop(0, '#19d3ff'); lg.addColorStop(.5, '#c15bff'); lg.addColorStop(1, '#ffb21a');
  g.fillStyle = lg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `italic 800 64px ${FD}`; g.fillText('FLUVIA', 300, 412);
  g.fillStyle = '#fff'; g.font = `700 16px ${FU}`; g.fillText('GRAND EST', 300, 458);
  dropShape(g, 300, 352, 20); g.fillStyle = '#19d3ff'; g.fill();
  return cv;
}

/* =====================================================================
   COMPOSANT CARTE 3D
   ===================================================================== */
function makeCard(c, { w = 300, px = null, back = 'verso', faceDown = false, count = 0, tilt = true, holo = 'always', prio = 0 } = {}) {
  const el = document.createElement('div'); el.className = 'c3'; el.dataset.rar = c.rar; el.dataset.id = c.id;
  const [, mid, dp] = palOf(c); px = px || bucket(w);
  el.innerHTML = `<div class="inner"><div class="face front" style="background:linear-gradient(160deg,${mid},${dp})"><img alt="${c.name}, carte ${RAR_NAME[c.rar].toLowerCase()}"><div class="foil ${c.rar === 2 ? 'art' : 'full'}"></div><div class="sparkle"></div><div class="glare"></div></div>
    <div class="face back"><img alt="${back === 'verso' ? 'Verso de la carte ' + c.name : 'Dos de carte'}"><div class="glare"></div></div></div>${count > 1 ? `<span class="count">×${count}</span>` : ''}`;
  const [fi, bi] = el.querySelectorAll('img');
  setSrc(fi, frontURL(c, px, prio));
  if (back === 'verso') { el._verso = () => { if (!bi.src) setSrc(bi, versoURL(c, px, 2)); }; } else setSrc(bi, backURL(2));
  if (faceDown) el.style.setProperty('--flip', '180deg');
  el._holo = holo;
  if (tilt) attachTilt(el);
  if (c.rar >= 1 && holo === 'always') el.classList.add('live');
  return el;
}
// inclinaison : un seul calcul par image (requestAnimationFrame)
function attachTilt(el) {
  if (REDUCED) return;
  let ev = null, queued = false;
  const apply = () => {
    queued = false; if (!ev) return;
    const r = el.getBoundingClientRect(); const x = clamp((ev.clientX - r.left) / r.width, 0, 1), y = clamp((ev.clientY - r.top) / r.height, 0, 1);
    const st = el.style; st.setProperty('--ry', `${(x - .5) * 28}deg`); st.setProperty('--rx', `${(.5 - y) * 24}deg`); st.setProperty('--mx', `${x * 100}%`); st.setProperty('--my', `${y * 100}%`); st.setProperty('--o', 1);
  };
  el.addEventListener('pointerenter', () => { if (+el.dataset.rar >= 1 || el._holo === 'always') el.classList.add('live'); el.classList.add('hot'); });
  el.addEventListener('pointermove', (e) => { ev = e; if (!queued) { queued = true; requestAnimationFrame(apply); } }, { passive: true });
  const leave = () => { ev = null; const st = el.style; st.setProperty('--ry', '0deg'); st.setProperty('--rx', '0deg'); st.setProperty('--o', 0); el.classList.remove('hot'); if (el._holo === 'hover' || +el.dataset.rar < 1) el.classList.remove('live'); };
  el.addEventListener('pointerleave', leave); el.addEventListener('pointercancel', leave);
}
async function flip(el, toBack) { if (toBack && el._verso) el._verso(); el.classList.add('flipping'); el.style.setProperty('--flip', toBack ? '180deg' : '0deg'); await wait(720); el.classList.remove('flipping'); }

/* =====================================================================
   BOOSTERS
   ===================================================================== */
function drawPack(b) {
  const W = 600, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); const [lt, mid, dp] = PAL[b];
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, mid); gr.addColorStop(.6, dp); gr.addColorStop(1, '#0b0d24'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, 520); g.globalAlpha = .18; g.fillStyle = '#fff';
  for (let k = 0; k < 22; k++) { const a0 = k / 22 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 900, a0, a0 + .08); g.closePath(); g.fill(); } g.restore();
  const big = RIVERS.filter(c => c.b === b).sort((a, z) => z.rar - a.rar || (z.gauges.power ?? 0) - (a.gauges.power ?? 0))[0];
  if (big) { g.save(); g.beginPath(); g.arc(W / 2, 520, 230, 0, Math.PI * 2); g.clip(); riverArt(g, big, W / 2 - 300, 520 - 228, 600, 456, true); g.restore();
    g.strokeStyle = metal(g, 70, 290, 530, 750, true); g.lineWidth = 9; g.beginPath(); g.arc(W / 2, 520, 230, 0, Math.PI * 2); g.stroke(); }
  for (const [y0, y1] of [[0, 120], [H - 60, H]]) { g.fillStyle = metal(g, 0, y0, W, y1, false); g.fillRect(0, y0, W, y1 - y0); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < W; x += 12) g.fillRect(x, y0, 5, y1 - y0); }
  g.setLineDash([10, 8]); g.strokeStyle = 'rgba(11,13,36,.75)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, 126); g.lineTo(W - 10, 126); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(11,13,36,.75)'; g.font = `800 20px ${FU}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✂  DÉCHIRER ICI', W / 2, 98);
  const lg = g.createLinearGradient(80, 0, 520, 0); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, lt);
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowOffsetY = 5; g.fillStyle = lg; g.font = `italic 800 108px ${FD}`; g.fillText('FLUVIA', W / 2, 200); g.restore();
  g.fillStyle = '#fff'; g.font = `700 20px ${FU}`; g.fillText('GRAND EST · 2000 – 2026', W / 2, 256);
  g.save(); g.fillStyle = '#0b0d24'; g.beginPath(); g.moveTo(40, 772); g.lineTo(560, 772); g.lineTo(540, 828); g.lineTo(60, 828); g.closePath(); g.fill();
  g.fillStyle = '#fff'; fit(g, `BASSIN ${BAS[b].toUpperCase()}`, 440, 34, 800, FD, 'italic'); g.fillText(`BASSIN ${BAS[b].toUpperCase()}`, W / 2, 801); g.restore();
  g.save(); g.translate(500, 330); g.rotate(.2); g.fillStyle = '#ffcf4a'; g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, rr = k % 2 ? 46 : 56; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();
  g.fillStyle = '#2a1300'; g.font = `800 30px ${FD}`; g.fillText('5', 0, -10); g.font = `800 16px ${FU}`; g.fillText('CARTES', 0, 16); g.restore();
  const sh = g.createLinearGradient(0, 0, W, H); sh.addColorStop(.3, 'rgba(255,255,255,0)'); sh.addColorStop(.45, 'rgba(255,255,255,.22)'); sh.addColorStop(.55, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  return cv;
}
function renderShelf() {
  const n = ownedCount();
  $('stats').innerHTML = `<div class="stat"><b>${OPENED}</b>booster${OPENED > 1 ? 's' : ''} ouvert${OPENED > 1 ? 's' : ''}</div><div class="stat"><b>${n}</b>/ ${TOTAL} cartes</div>` +
    `<div class="stat"><b style="color:#ffcf4a">${CARDS.filter(c => c.rar === 3 && owned(c.id)).length}</b>/ 7 ultra-rares</div><div class="stat"><b style="color:#ff3d9a">${PHENS.filter(c => owned(c.id)).length}</b>/ 6 spéciales</div>`;
  $('shelf').innerHTML = '';
  for (const b of ['R', 'M', 'S', 'O']) {
    const list = RIVERS.filter(c => c.b === b), got = list.filter(c => owned(c.id)).length;
    const t = document.createElement('button'); t.className = 'pack-tile'; t.setAttribute('aria-label', `Ouvrir un booster du bassin ${BAS_OF[b]}`);
    t.innerHTML = `<div class="pk"><img alt=""></div><b>${BAS[b]}</b><span>${got} / ${list.length} rivières</span>`; setSrc(t.querySelector('img'), packURL(b, 1));
    t.onclick = () => openPack(b); $('shelf').appendChild(t);
  }
}
// tirage : environ une ultra-rare tous les 8 boosters, une rare dans deux sur cinq, une spéciale dans un sur six
const SLOTS = [[[0, .75], [1, .25]], [[0, .75], [1, .25]], [[0, .75], [1, .25]], [[1, .8], [2, .12], ['p', .08]], [[1, .45], [2, .33], ['p', .10], [3, .12]]];
function rollPack(b) {
  // coup de pouce : plus la collection avance, plus les cartes manquantes ont de chances de sortir
  const boost = 1 + 9 * Math.pow(ownedCount() / TOTAL, 2);
  const pickFrom = (arr, taken) => {
    const a = arr.filter(c => !taken.has(c.id)); if (!a.length) return null;
    const w = a.map(c => owned(c.id) ? 1 : boost); let x = Math.random() * w.reduce((s, v) => s + v, 0);
    for (let i = 0; i < a.length; i++) { if ((x -= w[i]) < 0) return a[i]; } return a[a.length - 1];
  };
  const pickRar = (r, taken) => {
    const local = pickFrom(RIVERS.filter(c => c.b === b && c.rar === r), taken); if (local) return local;
    if (r >= 2) { const g = pickFrom(RIVERS.filter(c => c.rar === r), taken); if (g) return g; }
    for (let k = r - 1; k >= 0; k--) { const c = pickFrom(RIVERS.filter(x => x.b === b && x.rar === k), taken); if (c) return c; }
    return pickFrom(RIVERS, taken);
  };
  const roll = (t) => { let x = Math.random(); for (const [v, p] of t) { if ((x -= p) < 0) return v; } return t[t.length - 1][0]; };
  const taken = new Set(), out = [];
  for (const t of SLOTS) { const v = roll(t); const c = v === 'p' ? pickFrom(PHENS, taken) || pickRar(1, taken) : pickRar(v, taken); if (c) { taken.add(c.id); out.push(c); } }
  return out;
}

/* ---------- scène d'ouverture ---------- */
let pack = null;
const stage = $('stage'), bp = $('bigpack'), deck = $('deck'), tray = $('tray');
function openPack(b) {
  const cards = rollPack(b);
  pack = { b, cards, prog: 0, tearing: false, done: false, idx: 0, els: [], news: cards.map(c => !owned(c.id)) };
  stage.hidden = false; document.body.style.overflow = 'hidden';
  stage.style.setProperty('--pk', PAL[b][2]); stage.style.setProperty('--pk2', PAL[b][1]);
  $('stageTitle').textContent = `Bassin ${BAS[b]}`;
  packURL(b, 2).then(u => { $('packBody').style.backgroundImage = $('packFlap').style.backgroundImage = `url(${u})`; });
  pack.px = bucket(stageCardW()); pack.ready = Promise.all([backURL(1), ...cards.map(c => frontURL(c, pack.px, 1))]);
  bp.className = 'bigpack'; bp.hidden = false; bp.style.setProperty('--p', 0); $('hand').style.display = '';
  deck.className = 'deck'; deck.innerHTML = ''; $('summary').hidden = true; $('rays').className = 'rays'; $('banner').className = 'banner';
  tray.style.opacity = 1; tray.innerHTML = cards.map(() => '<div class="ts"></div>').join('');
  setHint('Faites glisser le long du haut du booster pour l’ouvrir', '<button id="autoTear">ou cliquez ici</button>');
  $('autoTear').onclick = autoTear;
  setTimeout(() => $('tearZone').focus({ preventScroll: true }), 60);
}
const stageCardW = () => Math.min(380, innerWidth * .78, (innerHeight - 300) * 5 / 7);
function setHint(main, small = '') { $('hint').innerHTML = `${main}${small ? `<small>${small}</small>` : ''}`; }
function tearTo(p) { if (!pack || pack.done) return; pack.prog = Math.max(pack.prog, clamp(p, 0, 1)); bp.style.setProperty('--p', pack.prog.toFixed(3)); if (pack.prog > .92) finishTear(); }
async function autoTear() { if (!pack || pack.done) return; $('hand').style.display = 'none'; for (let p = pack.prog; p <= 1; p += .025) { tearTo(p); await wait(14); } tearTo(1); }
const tz = $('tearZone');
tz.addEventListener('pointerdown', (e) => { if (!pack || pack.done) return; pack.tearing = true; tz.setPointerCapture(e.pointerId); $('hand').style.display = 'none'; pack.x0 = e.clientX; });
tz.addEventListener('pointermove', (e) => { if (!pack?.tearing) return; const r = bp.getBoundingClientRect(); tearTo(Math.abs(e.clientX - pack.x0) / r.width * 1.1); });
const tearEnd = () => { if (pack) pack.tearing = false; };
tz.addEventListener('pointerup', tearEnd); tz.addEventListener('pointercancel', tearEnd);
tz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoTear(); } });
async function finishTear() {
  if (pack.done) return; pack.done = true; const P = pack; const alive = () => pack === P;
  bp.style.setProperty('--p', 1); bp.classList.add('open'); setHint('');
  FX.burstUp(bp, PAL[pack.b]);
  // on n'attend jamais le dessin plus de 0,7 s : au-delà, les cartes sont dessinées tout de suite (prio 2 dans makeCard)
  await Promise.race([pack.ready, wait(700)]); if (!alive()) return;
  pack.cards.forEach(c => OWN[c.id] = (OWN[c.id] || 0) + 1); OPENED++; save(); updateCount();
  // les cartes, cachées dans le paquet, en sortent par l'ouverture
  const w = stageCardW();
  pack.els = pack.cards.map((c, i) => {
    const s = document.createElement('div'); s.className = 'slot';
    s.appendChild(makeCard(c, { w, px: pack.px, back: 'cardback', faceDown: true, prio: 2 })); s.insertAdjacentHTML('beforeend', '<div class="aura"></div>'); deck.appendChild(s);
    s.style.transition = 'none'; s.style.transform = 'translateY(20%) scale(.78)'; s.style.zIndex = 10 - i; return s;
  });
  await wait(380); if (!alive()) return;
  pack.els.forEach((s, i) => { s.style.transition = ''; s.style.transitionDelay = `${(4 - i) * 70}ms`; s.style.transform = `translateY(-34%) scale(.78) rotate(${(i - 2) * 1.5}deg)`; });
  await wait(820); if (!alive()) return;
  bp.classList.add('gone'); deck.classList.add('front');
  pack.els.forEach((s, i) => { s.style.transitionDelay = `${i * 50}ms`; s.style.transform = `translate(${i * 3}px, ${-i * 3}px) rotate(${(i - 2) * 1.2}deg)`; });
  await wait(850); if (!alive()) return; pack.els.forEach(s => s.style.transitionDelay = '0ms');
  bp.hidden = true; nextReveal();
}
const ORD = ['première', 'deuxième', 'troisième', 'quatrième', 'dernière'];
function playBanner(text, big = false) {
  const bn = $('banner'); bn.className = 'banner';
  bn.innerHTML = big ? [...text].map((ch, k) => `<span style="--i:${k}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('') : text;
  void bn.offsetWidth; bn.className = 'banner go' + (big ? ' big' : '');
}
const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; };
function quake() { const m = $('stageMid'); m.classList.remove('quake'); void m.offsetWidth; m.classList.add('quake'); }
function flashScreen() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
// retournement avec un tour et demi (ultra-rares et spéciales)
async function spinFlip(el) {
  el.classList.add('spinning'); el.style.setProperty('--flip', '-360deg');
  await wait(1150);
  el.classList.add('nojump'); el.classList.remove('spinning'); el.style.setProperty('--flip', '0deg'); void el.offsetWidth; el.classList.remove('nojump');
}
async function reveal(c, s, el) {
  const pal = palOf(c), P = pack, ok = () => pack === P && !P.summary;
  if (REDUCED) { await flip(el, false); if (c.rar >= 2) playBanner(c.rar === 4 ? 'Carte spéciale !' : c.rar === 3 ? 'Ultra-rare !' : 'Rare !'); return; }
  if (c.rar <= 1) {
    s.classList.add('pop'); await flip(el, false); s.classList.remove('pop');
    const [x, y, w] = centerOf(s); FX.sparkle(x, y, w, c.rar ? 22 : 12, pal);
    return;
  }
  if (c.rar === 2) {
    // RARE : charge d'énergie, retournement, gerbe d'étincelles
    s.style.setProperty('--aura', pal[1]); s.classList.add('charge');
    let [x, y, w, h] = centerOf(s); FX.implode(x, y, w, h, pal, 46, .7);
    await wait(700); s.classList.remove('charge'); if (!ok()) return;
    s.classList.add('pop'); await flip(el, false); s.classList.remove('pop'); if (!ok()) return;
    [x, y, w, h] = centerOf(s);
    FX.burst(x, y, w, h, [pal[0], pal[1], '#ffffff', '#ffcf4a'], 90, 1); FX.ring(x, y, w * .4, w * 1.6, pal[1], .7); FX.ring(x, y, w * .3, w * 1.2, '#ffffff', .55, .12);
    $('rays').className = 'rays on'; playBanner('Rare !');
    return;
  }
  // ULTRA-RARE et SPÉCIALE : la salle s'assombrit, la carte s'élève et absorbe l'énergie, puis explose
  const gold = c.rar === 3, col = gold ? ['#fff3b0', '#ffcf4a', '#ff9a1a', '#ffffff'] : [pal[0], pal[1], pal[2], '#ffffff'];
  $('dim').classList.add('on');
  s.style.setProperty('--aura', gold ? '#ffcf4a' : pal[1]); s.classList.add('lift', 'charge', 'hard');
  let [x, y, w, h] = centerOf(s);
  FX.implode(x, y, w, h, col, 150, 1.25); FX.ring(x, y, w * 1.8, w * .4, col[1], 1.1, 0, true);
  await wait(1250); if (!ok()) return;
  s.classList.remove('charge', 'hard'); flashScreen(); quake();
  [x, y, w, h] = centerOf(s);
  const spin = spinFlip(el);
  FX.burst(x, y, w, h, col, 190, 1.35); FX.confetti(x, y, w, gold ? ['#ffcf4a', '#fff3b0', '#ff7a1a', '#ffffff', '#ffe58a'] : ['#ff3d9a', '#19d3ff', '#ffcf4a', '#2fe08a', '#c15bff', '#ffffff'], 110);
  FX.ring(x, y, w * .3, Math.max(innerWidth, innerHeight) * .7, col[1], 1.1); FX.ring(x, y, w * .3, w * 2.2, '#ffffff', .8, .15); FX.ring(x, y, w * .3, w * 3, col[0], 1, .3);
  $('rays').className = 'rays on gold';
  playBanner(gold ? 'Ultra-rare !' : 'Carte spéciale !', true);
  await spin; if (!ok()) return;
  s.classList.remove('lift');
  if (gold) FX.rainGlitter(col, 3.2); else FX.weather(c.key, pal, 4);
  setTimeout(() => $('dim').classList.remove('on'), 900);
}

/* =====================================================================
   MOTEUR DE PARTICULES — une toile plein écran, active seulement pendant les effets
   ===================================================================== */
const FX = (() => {
  const cv = $('fx'), g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, slow = 0, budget = 1;
  const parts = [], rings = [], emitters = [], sprites = new Map();
  function size() { dpr = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener('resize', size); size();
  // halo pré-rendu par couleur : pas de dégradé recalculé à chaque image
  function sprite(col) {
    let sp = sprites.get(col); if (sp) return sp;
    sp = document.createElement('canvas'); sp.width = sp.height = 64; const q = sp.getContext('2d');
    const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = gr; q.fillRect(0, 0, 64, 64); sprites.set(col, sp); return sp;
  }
  const flakeSp = (() => { const c = document.createElement('canvas'); c.width = c.height = 48; const q = c.getContext('2d'); q.strokeStyle = '#fff'; q.lineWidth = 3; q.lineCap = 'round'; q.translate(24, 24);
    for (let k = 0; k < 6; k++) { q.rotate(Math.PI / 3); q.beginPath(); q.moveTo(0, 0); q.lineTo(0, -20); q.moveTo(0, -10); q.lineTo(-6, -15); q.moveTo(0, -10); q.lineTo(6, -15); q.stroke(); } return c; })();
  const R = Math.random, pick = (a) => a[(R() * a.length) | 0];
  const n = (k) => Math.max(1, Math.round(k * budget));
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    // qualité adaptative : si l'appareil peine, on réduit les prochaines salves
    if (dt > 1 / 40) { if (++slow > 12) { budget = Math.max(.35, budget * .8); slow = 0; } } else slow = Math.max(0, slow - 1);
    g.clearRect(0, 0, W, H);
    for (let k = emitters.length - 1; k >= 0; k--) { const e = emitters[k]; e.t += dt; e.acc += dt * e.rate * budget; while (e.acc >= 1) { e.acc--; e.spawn(); } if (e.t >= e.dur) emitters.splice(k, 1); }
    g.globalCompositeOperation = 'lighter';
    for (let k = rings.length - 1; k >= 0; k--) {
      const r = rings[k]; r.t += dt; if (r.t < 0) continue; const q = r.t / r.d; if (q >= 1) { rings.splice(k, 1); continue; }
      const e = 1 - Math.pow(1 - q, 3), rad = r.r0 + (r.r1 - r.r0) * e;
      g.globalAlpha = (1 - q) * .9; g.strokeStyle = r.col; g.lineWidth = (r.inward ? 2 + q * 8 : 10 * (1 - q) + 1.5); g.beginPath(); g.arc(r.x, r.y, Math.max(1, rad), 0, Math.PI * 2); g.stroke();
    }
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.life -= dt; if (p.life <= 0) { parts[k] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.tx != null) { const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1; p.vx += dx / d * p.pull * dt; p.vy += dy / d * p.pull * dt; if (d < 18) p.life = 0; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.sway) p.x += Math.sin((p.life + p.seed) * p.sway) * 0.6;
      const a = Math.min(1, p.life / p.fade);
      if (p.type === 'confetti' || p.type === 'flake') continue;
      g.globalAlpha = a;
      if (p.type === 'spark' || p.type === 'drop') { g.strokeStyle = p.col; g.lineWidth = p.w; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.tail, p.y - p.vy * p.tail); g.stroke(); }
      else { const s = p.size * (p.grow ? (1 + (1 - a) * p.grow) : 1); g.drawImage(sprite(p.col), p.x - s, p.y - s, s * 2, s * 2); }
    }
    g.globalCompositeOperation = 'source-over';
    for (const p of parts) {
      if (p.type !== 'confetti' && p.type !== 'flake') continue;
      g.globalAlpha = Math.min(1, p.life / p.fade); g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.type === 'confetti') { g.scale(1, Math.cos(p.rot * 1.7)); g.fillStyle = p.col; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      else g.drawImage(flakeSp, -p.size, -p.size, p.size * 2, p.size * 2);
      g.restore();
    }
    g.globalAlpha = 1;
    if (parts.length || rings.length || emitters.length) raf = requestAnimationFrame(tick);
    else { raf = 0; g.clearRect(0, 0, W, H); }
  }
  const P = (o) => { if (parts.length > 1400) return; parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, rot: 0, vr: 0, size: 6, w: 2, tail: .03, fade: .4, life: 1, type: 'glow', seed: R() * 9 }, o)); };
  return {
    // étincelles qui convergent vers la carte depuis tout l'écran
    implode(x, y, w, h, cols, k, dur) {
      for (let i = 0; i < n(k); i++) {
        const a = R() * Math.PI * 2, d = Math.max(W, H) * (.35 + R() * .4);
        P({ type: R() < .55 ? 'spark' : 'glow', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, tx: x, ty: y, pull: 900 + R() * 900, drag: .985, col: pick(cols), w: 1.5 + R() * 2, tail: .045, size: 4 + R() * 6, life: dur * (.6 + R() * .6), fade: .2 });
      }
      start();
    },
    burst(x, y, w, h, cols, k, power) {
      for (let i = 0; i < n(k); i++) {
        const a = R() * Math.PI * 2, sp = (260 + R() * 900) * power;
        const ox = Math.cos(a) * w * .25, oy = Math.sin(a) * h * .25;
        P({ type: R() < .7 ? 'spark' : 'glow', x: x + ox, y: y + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 380, drag: .955, col: pick(cols), w: 1.5 + R() * 2.5, tail: .04, size: 5 + R() * 9, life: .6 + R() * .9, fade: .5 });
      }
      start();
    },
    confetti(x, y, w, cols, k) {
      for (let i = 0; i < n(k); i++) {
        const a = -Math.PI / 2 + (R() - .5) * 2.4, sp = 500 + R() * 800;
        P({ type: 'confetti', x: x + (R() - .5) * w * .5, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: .965, rot: R() * 6, vr: (R() - .5) * 14, col: pick(cols), size: 8 + R() * 8, life: 2.2 + R() * 1.2, fade: .6 });
      }
      start();
    },
    sparkle(x, y, w, k, cols) {
      for (let i = 0; i < n(k); i++) { const a = R() * Math.PI * 2, d = w * (.35 + R() * .3); P({ type: 'glow', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 1.3, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 30, col: pick([cols[0], cols[1], '#ffffff']), size: 4 + R() * 7, life: .5 + R() * .5, fade: .4, grow: 1 }); }
      start();
    },
    ring(x, y, r0, r1, col, d, delay = 0, inward = false) { rings.push({ x, y, r0, r1, col, d, t: -delay, inward }); start(); },
    // jet de lumière à l'ouverture du booster
    burstUp(el, pal) {
      if (REDUCED) return; const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * .14;
      for (let i = 0; i < n(70); i++) { const a = -Math.PI / 2 + (R() - .5) * 1.1, sp = 300 + R() * 700; P({ type: R() < .6 ? 'spark' : 'glow', x: x + (R() - .5) * r.width * .8, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, drag: .96, col: pick([pal[0], pal[1], '#ffffff']), w: 2, size: 5 + R() * 6, life: .6 + R() * .6, fade: .4 }); }
      start();
    },
    // pluie de paillettes dorées après une ultra-rare
    rainGlitter(cols, dur) {
      emitters.push({ t: 0, acc: 0, dur, rate: 70, spawn: () => P({ type: R() < .3 ? 'confetti' : 'glow', x: R() * W, y: -10, vx: (R() - .5) * 40, vy: 60 + R() * 120, g: 60, drag: .995, rot: R() * 6, vr: (R() - .5) * 6, col: pick(cols), size: R() < .3 ? 6 + R() * 5 : 3 + R() * 5, life: 4, fade: 1.2, sway: 3 }) });
      start();
    },
    // météo propre à chaque phénomène
    weather(key, pal, dur) {
      const spawnBy = {
        sec: () => P({ type: 'glow', x: R() * W, y: H + 10, vx: (R() - .5) * 30, vy: -(80 + R() * 160), col: pick(['#ff7a1a', '#ffb21a', '#ff4f1f']), size: 3 + R() * 5, life: 3, fade: 1, sway: 4 }),
        chaud: () => P({ type: 'spark', x: R() * W, y: H + 10, vx: (R() - .5) * 20, vy: -(300 + R() * 300), col: pick(['#fff3a6', '#ffc21a', '#ff7a1a']), w: 2, tail: .05, life: 2.5, fade: .8 }),
        haut: () => { const x = R() * W; for (let k = 0; k < 4; k++) P({ type: 'spark', x, y: H * (.75 + R() * .2), vx: (R() - .5) * 220, vy: -(300 + R() * 300), g: 900, col: pick([pal[0], pal[1], '#ffffff']), w: 2.5, tail: .03, life: 1.2, fade: .4 }); },
        froid: () => P({ type: R() < .5 ? 'flake' : 'spark', x: R() * W, y: -20, vx: (R() - .5) * 40, vy: 70 + R() * 90, rot: R() * 6, vr: (R() - .5) * 2, col: '#cdfaff', w: 1.5, tail: .06, size: 6 + R() * 10, life: 7, fade: 1.5, sway: 2 }),
        pluie: () => P({ type: 'drop', x: R() * (W + 300), y: -30, vx: -260, vy: 1100 + R() * 500, col: pick(['#d8ddff', '#9fb0ff', '#ffffff']), w: 1.6, tail: .025, life: 1.2, fade: .2 }),
        neige: () => P({ type: 'flake', x: R() * W, y: -20, vx: (R() - .5) * 30, vy: 40 + R() * 60, rot: R() * 6, vr: (R() - .5) * 1.5, size: 5 + R() * 11, life: 9, fade: 2, sway: 2.5 }),
      };
      const rate = { sec: 45, chaud: 55, haut: 14, froid: 40, pluie: 160, neige: 45 }[key] || 40;
      emitters.push({ t: 0, acc: 0, dur, rate, spawn: spawnBy[key] || spawnBy.neige });
      if (key === 'pluie') { setTimeout(flashScreen, 500); setTimeout(flashScreen, 1700); }
      start();
    },
    stopEmitters() { emitters.length = 0; for (const p of parts) p.life = Math.min(p.life, .5); },
    clear() { parts.length = 0; rings.length = 0; emitters.length = 0; },
  };
})();
function nextReveal() {
  if (!pack || pack.summary) return;
  const i = pack.idx; if (i >= pack.cards.length) return showSummary();
  const s = pack.els[i], el = s.firstChild, c = pack.cards[i];
  $('rays').className = 'rays';
  if (c.rar >= 2) s.classList.add('tease');        // le dos brille : quelque chose de précieux arrive
  setHint(`Touchez la carte pour la retourner · ${ORD[i]} carte`, '<button id="revealAll">tout révéler d’un coup</button>');
  $('revealAll').onclick = () => { pack.idx = pack.cards.length; showSummary(); };
  el.onclick = async () => {
    el.onclick = null; s.classList.remove('tease');
    const P = pack;
    await reveal(c, s, el); if (pack !== P || P.summary) return;
    if (pack.news[i]) { const t = document.createElement('span'); t.className = 'newtag'; t.textContent = 'Nouvelle'; s.appendChild(t); }
    setHint(`${c.name} · ${RAR_NAME[c.rar].toLowerCase()}`, 'touchez à nouveau pour ranger la carte');
    el.onclick = () => { el.onclick = null; FX.stopEmitters(); $('dim').classList.remove('on'); stow(i); };
  };
}
// la carte rejoint sa place dans la réglette du bas
async function stow(i) {
  const s = pack.els[i], c = pack.cards[i], ts = tray.children[i];
  const d = deck.getBoundingClientRect(), t = ts.getBoundingClientRect(), sw = s.getBoundingClientRect().width / 1;
  const k = t.width / s.offsetWidth;
  s.style.transform = `translate(${t.left + t.width / 2 - (d.left + d.width / 2)}px, ${t.top + t.height / 2 - (d.top + d.height / 2)}px) scale(${k})`;
  s.style.zIndex = 20; $('rays').className = 'rays';
  pack.idx++; setTimeout(nextReveal, 280);
  await wait(760); if (!ts.isConnected) return;
  s.remove(); ts.innerHTML = '<img alt="">'; setSrc(ts.firstChild, frontURL(c, pack ? pack.px : 640));
}
const FAN = [[-14, 34], [-7, 10], [0, 0], [7, 10], [14, 34]];
function showSummary() {
  if (!pack || pack.summary) return; pack.summary = true;
  deck.innerHTML = ''; $('summary').hidden = false; $('rays').className = 'rays'; $('banner').className = 'banner'; $('dim').classList.remove('on'); FX.stopEmitters(); tray.style.opacity = 0;
  setHint('Cartes ajoutées à votre collection', '');
  const fan = $('fan'); fan.innerHTML = '';
  pack.cards.forEach((c, i) => {
    const w = document.createElement('div'); w.style.setProperty('--fr', FAN[i][0] + 'deg'); w.style.setProperty('--fy', FAN[i][1] + 'px');
    const el = makeCard(c, { w: 230, px: pack.px }); w.appendChild(el);
    if (pack.news[i]) { const t = document.createElement('span'); t.className = 'newtag'; t.textContent = 'Nouvelle'; w.appendChild(t); }
    el.onclick = () => openViewer(c.id, pack.cards.map(x => x.id)); fan.appendChild(w);
    w.animate([{ transform: `translateY(60vh) rotate(0deg)`, opacity: 0 }, { transform: `translateY(${FAN[i][1]}px) rotate(${FAN[i][0]}deg)`, opacity: 1 }], { duration: REDUCED ? 1 : 700, delay: i * 80, fill: 'backwards', easing: 'cubic-bezier(.2,1.2,.4,1)' });
  });
}
function closeStage() { FX.clear(); $('dim').classList.remove('on'); stage.hidden = true; document.body.style.overflow = ''; pack = null; renderShelf(); renderAlbum(); }
$('stageClose').onclick = closeStage;
$('again').onclick = () => { FX.clear(); openPack(pack.b); };
$('toAlbum').onclick = () => { closeStage(); show('album'); };

/* =====================================================================
   ALBUM
   ===================================================================== */
let albumFilter = 'all';
function renderAlbum() {
  updateCount();
  const n = ownedCount();
  $('progTxt').textContent = n === TOTAL ? 'Collection complète !' : `${n} carte${n > 1 ? 's' : ''} sur ${TOTAL}`;
  $('progBar').style.width = `${n / TOTAL * 100}%`;
  $('rarities').innerHTML = [0, 1, 2, 3, 4].map(r => { const all = CARDS.filter(c => c.rar === r); return `<span>${RAR_SYM[r]} ${RAR_NAME[r]} · ${all.filter(c => owned(c.id)).length}/${all.length}</span>`; }).join('');
  const body = $('albumBody'); body.innerHTML = '';
  if (!n && albumFilter === 'own') { body.innerHTML = '<p class="lede">Aucune carte pour l’instant : ouvrez un premier booster.</p>'; return; }
  for (const b of ['R', 'M', 'S', 'O', '*']) {
    const list = CARDS.filter(c => c.b === b); const got = list.filter(c => owned(c.id)).length;
    if (albumFilter === 'own' && !got) continue;
    const [c1, c2] = b === '*' ? ['#ff3d9a', '#6a2bff'] : [PAL[b][1], PAL[b][2]];
    const h = document.createElement('div'); h.className = 'chapter'; h.style.setProperty('--c1', c1); h.style.setProperty('--c2', c2);
    h.innerHTML = `<h3>${b === '*' ? 'Cartes spéciales' : 'Bassin ' + BAS[b]}</h3><span>${got} / ${list.length}</span>`; body.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'grid'; body.appendChild(grid);
    for (const c of list) {
      if (owned(c.id)) { const holder = document.createElement('div'); holder.style.aspectRatio = '5 / 7'; holder.dataset.id = c.id; grid.appendChild(holder); lazy(holder); }
      else if (albumFilter === 'all') { const e = document.createElement('div'); e.className = 'empty'; e.innerHTML = `<b style="color:${c.rar >= 2 ? (c.rar === 4 ? '#ff3d9a' : '#ffcf4a') : 'inherit'}">${RAR_SYM[c.rar]}</b><small>${num(c.no)}/${TOTAL}</small>`; grid.appendChild(e); }
    }
  }
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); mountThumb(en.target); } }, { rootMargin: '300px' }) : null;
function lazy(h) { if (io) io.observe(h); else mountThumb(h); }
function mountThumb(holder) {
  const c = BYID.get(holder.dataset.id); const el = makeCard(c, { w: 200, count: OWN[c.id], holo: 'hover' });
  el.onclick = () => openViewer(c.id, CARDS.filter(x => owned(x.id)).map(x => x.id));
  el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${c.name}, voir la carte`); el.onkeydown = (e) => { if (e.key === 'Enter') el.onclick(); };
  holder.replaceWith(el);
}
$$('.filters .chip').forEach(b => b.onclick = () => { albumFilter = b.dataset.f; $$('.filters .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); renderAlbum(); });

/* ---------- visionneuse ---------- */
let viewer = null;
function openViewer(id, list) { viewer = { list, i: list.indexOf(id), back: false }; $('viewer').hidden = false; drawViewer(); }
function drawViewer() {
  const c = BYID.get(viewer.list[viewer.i]); const holder = $('viewerCard'); holder.innerHTML = '';
  const el = makeCard(c, { w: 480, prio: 2 }); holder.appendChild(el); viewer.el = el; viewer.back = false; el.onclick = toggleFlip;
  $('vPrev').disabled = viewer.i <= 0; $('vNext').disabled = viewer.i >= viewer.list.length - 1;
  $('viewerTip').textContent = matchMedia('(hover: hover)').matches ? 'Bougez la souris sur la carte · cliquez pour la retourner' : 'Glissez le doigt sur la carte · touchez pour la retourner';
}
function toggleFlip() { viewer.back = !viewer.back; flip(viewer.el, viewer.back); }
$('vFlip').onclick = toggleFlip;
$('vClose').onclick = () => { $('viewer').hidden = true; viewer = null; };
$('vPrev').onclick = () => { if (viewer.i > 0) { viewer.i--; drawViewer(); } };
$('vNext').onclick = () => { if (viewer.i < viewer.list.length - 1) { viewer.i++; drawViewer(); } };
$('viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') $('vClose').onclick(); });
addEventListener('keydown', (e) => {
  if (viewer) { if (e.key === 'Escape') $('vClose').onclick(); if (e.key === 'ArrowLeft') $('vPrev').onclick(); if (e.key === 'ArrowRight') $('vNext').onclick(); if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); toggleFlip(); } return; }
  if (e.key === 'Escape') { if (!$('picker').hidden) $('picker').hidden = true; else if (!$('stage').hidden) closeStage(); }
});

/* =====================================================================
   DUEL — bataille en trois manches
   ===================================================================== */
const duel = { a: null, b: null, busy: false, revealed: false };
const GORDER = ['power', 'res', 'crue'];
function renderDuelSlots() {
  const sa = $('slotA'), sb = $('slotB'); sa.innerHTML = ''; sb.innerHTML = '';
  $('sideA').className = 'side'; $('sideB').className = 'side';
  if (duel.a) { const el = makeCard(duel.a, { w: 340 }); el.onclick = openPicker; sa.appendChild(el); sa.insertAdjacentHTML('beforeend', `<div class="bar2"><div class="duelbar" id="barA" style="--c1:${palOf(duel.a)[1]};--c2:${palOf(duel.a)[2]}"><i></i></div></div>`); }
  else { const has = RIVERS.some(c => owned(c.id)); sa.innerHTML = `<button class="pick" id="pickA">${has ? 'Choisir une carte<br><small style="font:400 13px var(--f-ui);color:var(--fg-3)">dans votre collection</small>' : 'Collection vide<br><small style="font:400 13px var(--f-ui);color:var(--fg-3)">ouvrez d’abord un booster</small>'}</button>`; $('pickA').onclick = has ? openPicker : () => show('boosters'); }
  if (duel.b) { const el = makeCard(duel.b, { w: 340, back: 'cardback', faceDown: !duel.revealed }); sb.appendChild(el); duel.bEl = el; sb.insertAdjacentHTML('beforeend', `<div class="bar2"><div class="duelbar" id="barB" style="--c1:${palOf(duel.b)[1]};--c2:${palOf(duel.b)[2]}"><i></i></div></div>`); }
  else sb.innerHTML = `<div class="pick" style="cursor:default">Adversaire tiré<br>au hasard</div>`;
  $('fight').disabled = !duel.a || duel.busy;
}
function openPicker() {
  if (duel.busy) return;
  const grid = $('pickGrid'); grid.innerHTML = '';
  RIVERS.filter(c => owned(c.id)).forEach(c => { const el = makeCard(c, { w: 160, tilt: false, holo: 'hover' }); el.onclick = () => { duel.a = c; duel.b = null; duel.revealed = false; $('picker').hidden = true; resetDuelUI(); renderDuelSlots(); }; grid.appendChild(el); });
  $('picker').hidden = false;
}
$('pickClose').onclick = () => { $('picker').hidden = true; };
function resetDuelUI() { $('verdict').textContent = ''; $('gName').textContent = ''; $('roundTxt').textContent = 'Prêt ?'; $$('#pips i').forEach(i => i.className = ''); $('fight').textContent = 'Lancer le duel'; }
const setBar = (id, v) => { const i = $(id).querySelector('i'); i.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => i.style.width = v == null ? '0' : `${8 + v * 92}%`)); };
$('fight').onclick = async () => {
  if (!duel.a || duel.busy) return;
  duel.busy = true; resetDuelUI();
  const pool = RIVERS.filter(c => c.id !== duel.a.id); duel.b = pool[Math.floor(Math.random() * pool.length)]; duel.revealed = false;
  renderDuelSlots(); $('fight').disabled = true;
  await wait(300); await flip(duel.bEl, false); duel.revealed = true;
  let me = 0, them = 0; const used = new Set();
  for (let r = 0; r < 3; r++) {
    $('sideA').className = 'side'; $('sideB').className = 'side';
    $('roundTxt').textContent = ['Manche 1', 'Manche 2', 'Manche 3'][r];
    let cand = GORDER.filter(k => !used.has(k) && duel.a.gauges[k] != null && duel.b.gauges[k] != null);
    if (!cand.length) cand = GORDER.filter(k => duel.a.gauges[k] != null && duel.b.gauges[k] != null);
    if (!cand.length) cand = ['power'];
    const k = cand[Math.floor(Math.random() * cand.length)]; used.add(k);
    for (let s = 0; s < 10; s++) { $('gName').textContent = ATTR[GORDER[s % 3]].label; await wait(60 + s * 12); }
    $('gName').textContent = ATTR[k].label;
    const va = duel.a.gauges[k], vb = duel.b.gauges[k];
    setBar('barA', va); setBar('barB', vb); await wait(1150);
    const pip = $$('#pips i')[r];
    if ((va ?? -1) > (vb ?? -1)) { me++; $('sideA').classList.add('win'); $('sideB').classList.add('lose'); pip.className = 'me'; }
    else if ((vb ?? -1) > (va ?? -1)) { them++; $('sideB').classList.add('win'); $('sideA').classList.add('lose'); pip.className = 'them'; }
    await wait(1100);
  }
  $('sideA').className = 'side' + (me > them ? ' win' : me < them ? ' lose' : '');
  $('sideB').className = 'side' + (them > me ? ' win' : them < me ? ' lose' : '');
  const Wd = ['zéro', 'une', 'deux', 'trois'];
  $('verdict').innerHTML = me > them ? `Victoire ! ${duel.a.name} l’emporte ${Wd[me]} manche${me > 1 ? 's' : ''} à ${Wd[them]}` : me < them ? `Défaite… ${duel.b.name} l’emporte ${Wd[them]} manche${them > 1 ? 's' : ''} à ${Wd[me]}` : 'Égalité parfaite';
  $('roundTxt').textContent = 'Fin du duel'; $('fight').textContent = 'Nouvel adversaire'; duel.busy = false; $('fight').disabled = false;
};

/* =====================================================================
   NAVIGATION, RÈGLES, DÉMARRAGE
   ===================================================================== */
function show(v) {
  for (const k of ['boosters', 'album', 'duel', 'rules']) $('v-' + k).hidden = k !== v;
  $$('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  if (v === 'album') renderAlbum(); if (v === 'duel') { resetDuelUI(); renderDuelSlots(); } if (v === 'boosters') renderShelf();
  scrollTo({ top: 0, behavior: 'instant' });
}
$$('.tabs button').forEach(b => b.onclick = () => show(b.dataset.view));
let resetArm = false, resetTimer = 0;
$('reset').textContent = 'Vider la collection';
$('reset').onclick = () => {
  if (!resetArm) { resetArm = true; $('reset').textContent = 'Confirmer : tout effacer'; $('resetMsg').textContent = 'La collection sera vidée.'; resetTimer = setTimeout(() => { resetArm = false; $('reset').textContent = 'Vider la collection'; $('resetMsg').textContent = ''; }, 4000); return; }
  clearTimeout(resetTimer); OWN = {}; OPENED = 0; save(); resetArm = false; $('reset').textContent = 'Vider la collection'; $('resetMsg').textContent = 'Collection vidée.'; duel.a = duel.b = null; updateCount();
};
try { await Promise.all(['italic 800 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '800 40px "Barlow Condensed"', '700 20px "Rubik"', 'italic 400 20px "Rubik"'].map(f => document.fonts.load(f))); } catch (e) {}
updateCount(); renderShelf();
idle(() => { for (const c of CARDS) if (owned(c.id)) frontURL(c, bucket(200)); });
if (/[?&]test/.test(location.search)) window.__tcg = { openPack, autoTear, show, OWN, CARDS, openViewer, toggleFlip, duel, renderDuelSlots, drawPack: rollPack, FX, get pack() { return pack; } };
