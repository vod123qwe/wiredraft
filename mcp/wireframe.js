// WireDraft — shared wireframe logic for the MCP server (pure JS, no DOM).
// Mirrors the renderers in index.html so ASCII preview matches the editor,
// and builds editor URLs with the document encoded in the #z= hash (gzip).

import { gzipSync } from 'node:zlib';

export const DEFAULT_BASE = 'https://vod123qwe.github.io/wiredraft/';

const BORDERS = {
  single:  { tl:'┌', tr:'┐', bl:'└', br:'┘', h:'─', v:'│' },
  double:  { tl:'╔', tr:'╗', bl:'╚', br:'╝', h:'═', v:'║' },
  rounded: { tl:'╭', tr:'╮', bl:'╰', br:'╯', h:'─', v:'│' },
  heavy:   { tl:'┏', tr:'┓', bl:'┗', br:'┛', h:'━', v:'┃' },
};
const ALERT_ICON = { info:'i', warning:'!', error:'x', success:'✓' };

const uid = () => 'o' + Math.random().toString(36).slice(2, 9);
const genCode = () => 'WD-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

/* ---------- buffer ---------- */
function makeBuf(grid) {
  const b = new Array(grid.rows);
  for (let r = 0; r < grid.rows; r++) b[r] = new Array(grid.cols).fill(' ');
  return b;
}
function put(b, grid, c, r, ch) {
  if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols && ch != null && ch !== '') b[r][c] = ch;
}
function writeText(b, grid, c, r, str) { for (let i = 0; i < str.length; i++) put(b, grid, c + i, r, str[i]); }
function centerPad(width, len) { return Math.max(0, Math.floor((width - len) / 2)); }

function drawBoxFrame(b, grid, col, row, w, h, style, fill) {
  if (w < 2 || h < 2) return;
  const B = BORDERS[style] || BORDERS.single;
  if (fill === 'solid') for (let r = row + 1; r < row + h - 1; r++) for (let c = col + 1; c < col + w - 1; c++) put(b, grid, c, r, ' ');
  for (let c = col + 1; c < col + w - 1; c++) { put(b, grid, c, row, B.h); put(b, grid, c, row + h - 1, B.h); }
  for (let r = row + 1; r < row + h - 1; r++) { put(b, grid, col, r, B.v); put(b, grid, col + w - 1, r, B.v); }
  put(b, grid, col, row, B.tl); put(b, grid, col + w - 1, row, B.tr);
  put(b, grid, col, row + h - 1, B.bl); put(b, grid, col + w - 1, row + h - 1, B.br);
}
function drawCenteredLabel(b, grid, col, row, w, h, label) {
  if (!label) return;
  const lines = String(label).split('\n');
  const startRow = row + Math.max(1, Math.floor((h - lines.length) / 2));
  lines.forEach((ln, i) => {
    const inner = w - 2;
    const pad = centerPad(inner, ln.length);
    writeText(b, grid, col + 1 + pad, startRow + i, ln.slice(0, inner));
  });
}

function renderObject(b, grid, o) {
  const c = o.position?.col ?? 0, r = o.position?.row ?? 0;
  const w = o.width ?? 10, h = o.height ?? 5;
  if (o.type === 'box') { drawBoxFrame(b, grid, c, r, w, h, o.borderStyle || 'single', o.fill || 'transparent'); drawCenteredLabel(b, grid, c, r, w, h, o.label); return; }
  if (o.type === 'text') { String(o.content || '').split('\n').forEach((ln, i) => writeText(b, grid, c, r + i, ln)); return; }
  if (o.type === 'line' || o.type === 'arrow') { drawLine(b, grid, o); return; }
  if (o.type === 'connector') { return; /* connectors need full doc; handled in buildBuffer */ }
  if (o.type === 'component') { renderComponent(b, grid, o, c, r, w, h); return; }
}

function renderComponent(b, grid, o, c, r, w, h) {
  const ct = o.componentType;
  const lab = o.label || '';
  const bs = o.borderStyle || (ct === 'modal' ? 'double' : ct === 'avatar' ? 'rounded' : 'single');
  const ic = o.icon ? o.icon + ' ' : '';
  switch (ct) {
    case 'button': drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h, ic + (lab || 'Button')); return;
    case 'input':
    case 'select': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      const txt = ic + (lab || (ct === 'select' ? 'Select' : 'Input'));
      writeText(b, grid, c + 2, r + Math.floor(h / 2), txt.slice(0, w - 4));
      if (ct === 'select') put(b, grid, c + w - 3, r + Math.floor(h / 2), '▾');
      return;
    }
    case 'checkbox': writeText(b, grid, c, r + Math.floor(h / 2), (o.checked ? '[✓] ' : '[ ] ') + lab); return;
    case 'radio':    writeText(b, grid, c, r + Math.floor(h / 2), (o.checked ? '(●) ' : '( ) ') + lab); return;
    case 'toggle':   writeText(b, grid, c, r, (o.checked ? '[●──] ' : '[──●] ') + lab); return;
    case 'divider': {
      for (let i = 0; i < w; i++) put(b, grid, c + i, r, '─');
      if (lab) { const t = ' ' + lab + ' '; const pad = centerPad(w, t.length); writeText(b, grid, c + pad, r, t); }
      return;
    }
    case 'breadcrumb': { const items = o.items || ['Home','Page']; writeText(b, grid, c, r, items.join(o.separator || ' > ').slice(0, w)); return; }
    case 'navbar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const items = o.navItems || []; writeText(b, grid, c + 2, r + Math.floor(h / 2), ('=  ' + items.join('  ')).slice(0, w - 4)); return; }
    case 'tabs': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const tabs = o.tabs || ['Tab 1','Tab 2']; writeText(b, grid, c + 2, r + Math.floor(h / 2), tabs.join(' │ ').slice(0, w - 4)); return; }
    case 'list': {
      const items = o.items || ['Item 1','Item 2'];
      const pre = o.listStyle === 'dash' ? () => '- ' : o.listStyle === 'number' ? (i) => (i + 1) + '. ' : () => '• ';
      items.forEach((it, i) => { if (r + i < grid.rows) writeText(b, grid, c, r + i, (pre(i) + it).slice(0, w)); });
      return;
    }
    case 'progress': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const inner = w - 2, filled = Math.round(inner * (o.progress ?? 0) / 100); const mid = r + Math.floor(h / 2); for (let i = 0; i < inner; i++) put(b, grid, c + 1 + i, mid, i < filled ? '▓' : '░'); return; }
    case 'avatar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const ini = (lab || 'A').slice(0, 2).split('').join(' '); drawCenteredLabel(b, grid, c, r, w, h, ini); return; }
    case 'image': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h, o.icon || '⊠'); return; }
    case 'card':
    case 'modal': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      if (lab) writeText(b, grid, c + 2, r + 1, lab.slice(0, w - 4));
      for (let i = 1; i < w - 1; i++) put(b, grid, c + i, r + 2, '─');
      if (o.body) String(o.body).split('\n').forEach((ln, i) => { if (r + 3 + i < r + h - 1) writeText(b, grid, c + 2, r + 3 + i, ln.slice(0, w - 4)); });
      return;
    }
    case 'alert': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); writeText(b, grid, c + 2, r + 1, ((ALERT_ICON[o.alertType] || 'i') + ' ' + lab).slice(0, w - 4)); if (o.body) writeText(b, grid, c + 2, r + 2, String(o.body).slice(0, w - 4)); return; }
    case 'table': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      const cols = o.columns || ['Col 1','Col 2']; const cw = Math.floor((w - 2) / cols.length);
      cols.forEach((cn, i) => writeText(b, grid, c + 1 + i * cw + 1, r + 1, cn.slice(0, cw - 1)));
      for (let i = 1; i < w - 1; i++) put(b, grid, c + i, r + 2, '─');
      (o.rows || []).forEach((rowData, ri) => { if (r + 3 + ri < r + h - 1) rowData.forEach((cell, i) => writeText(b, grid, c + 1 + i * cw + 1, r + 3 + ri, String(cell).slice(0, cw - 1))); });
      return;
    }
    case 'browser': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      writeText(b, grid, c + 2, r + 1, ('< > O   ' + (lab || '')).slice(0, w - 4));
      put(b, grid, c, r + 2, '├'); put(b, grid, c + w - 1, r + 2, '┤');
      for (let i = 1; i < w - 1; i++) put(b, grid, c + i, r + 2, '─');
      return;
    }
    case 'icon': { const gly = o.icon || '★'; writeText(b, grid, c + Math.floor((w - 1) / 2), r + Math.floor((h - 1) / 2), gly); return; }
    case 'stepper': {
      const items = o.items || ['Step 1','Step 2']; const active = o.activeStep ?? 0;
      const segs = items.map((it, i) => (i <= active ? '●' : '○') + ' ' + it);
      const base = segs.join('').length; const n = items.length;
      const gapTotal = Math.max((n - 1) * 3, w - base); const gap = n > 1 ? Math.floor(gapTotal / (n - 1)) : 0;
      let s = ''; segs.forEach((sg, i) => { s += sg; if (i < n - 1) s += ' ' + '─'.repeat(Math.max(1, gap - 2)) + ' '; });
      writeText(b, grid, c, r, s.slice(0, w)); return;
    }
    case 'rating': { const val = Math.round(o.value ?? 0), mx = o.maxValue ?? 5; writeText(b, grid, c, r, ('●'.repeat(Math.min(val, mx)) + '○'.repeat(Math.max(0, mx - val))).slice(0, w)); return; }
    case 'skeleton': { for (let rr = r; rr < r + h; rr++) for (let i = 0; i < w; i++) put(b, grid, c + i, rr, '░'); return; }
    case 'statusbar': { const time = lab || '9:41'; const right = o.body || '▮▮▮ 100%'; writeText(b, grid, c + 1, r, time.slice(0, w - 2)); writeText(b, grid, c + Math.max(1, w - 1 - right.length), r, right); return; }
    case 'iosnav': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      const items = o.items || ['Back', '']; const back = items[0] ? '‹ ' + items[0] : '‹'; const right = items[1] || ''; const mid = r + Math.floor(h / 2);
      writeText(b, grid, c + 2, mid, back.slice(0, w - 4)); if (right) writeText(b, grid, c + Math.max(2, w - 2 - right.length), mid, right);
      drawCenteredLabel(b, grid, c, r, w, h, lab || 'Title'); return;
    }
    case 'tabbar': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      const tabs = o.items || ['Home', 'Search', 'Profile']; const inner = w - 2, seg = Math.max(1, Math.floor(inner / tabs.length));
      tabs.forEach((t, i) => { const txt = t.slice(0, seg - 1); const pad = Math.max(0, Math.floor((seg - txt.length) / 2)); writeText(b, grid, c + 1 + i * seg + pad, r + Math.floor(h / 2), txt); });
      return;
    }
    case 'segmented': {
      drawBoxFrame(b, grid, c, r, w, h, bs, 'solid');
      const segs = o.items || ['One', 'Two', 'Three']; const active = o.activeStep ?? 0;
      const parts = segs.map((s, i) => i === active ? '«' + s + '»' : ' ' + s + ' ');
      writeText(b, grid, c + 2, r + Math.floor(h / 2), parts.join('│').slice(0, w - 4)); return;
    }
    case 'iosswitch': writeText(b, grid, c, r + Math.floor(h / 2), (o.checked !== false ? '(  ●) ' : '(●  ) ') + lab); return;
    case 'searchbar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); writeText(b, grid, c + 2, r + Math.floor(h / 2), ('⌕ ' + (lab || 'Search')).slice(0, w - 4)); return; }
    case 'homeindicator': { const n = Math.min(w - 2, Math.max(6, Math.floor(w / 3))); const bar = '▬'.repeat(n); const pad = centerPad(w, bar.length); writeText(b, grid, c + pad, r + Math.floor(h / 2), bar); return; }
    case 'heading': { const t = lab || 'Heading'; writeText(b, grid, c, r, t.slice(0, w)); for (let i = 0; i < Math.min(w, t.length); i++) put(b, grid, c + i, r + 1, '═'); return; }
    case 'link': { const t = lab || 'link'; writeText(b, grid, c, r, t.slice(0, w)); for (let i = 0; i < Math.min(w, t.length); i++) put(b, grid, c + i, r + 1, '─'); return; }
    case 'badge': writeText(b, grid, c, r, ('( ' + (lab || '3') + ' )').slice(0, w)); return;
    case 'chip': writeText(b, grid, c, r, ('[ ' + (lab || 'Tag') + ' ✕ ]').slice(0, w)); return;
    case 'kbd': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h, lab || 'Ctrl'); return; }
    case 'slider': { const mid = r + Math.floor(h / 2); for (let i = 0; i < w; i++) put(b, grid, c + i, mid, i === 0 ? '├' : i === w - 1 ? '┤' : '─'); const p = Math.round((w - 1) * ((o.value ?? 50) / (o.maxValue ?? 100))); put(b, grid, c + Math.max(1, Math.min(w - 2, p)), mid, '●'); return; }
    case 'numstep': writeText(b, grid, c, r + Math.floor(h / 2), ('[ − ]  ' + (o.value ?? 1) + '  [ + ]').slice(0, w)); return;
    case 'pagination': { const n = o.maxValue ?? 4, act = o.activeStep ?? 0; const parts = []; for (let i = 0; i < n; i++) parts.push(i === act ? '[' + (i + 1) + ']' : String(i + 1)); writeText(b, grid, c, r + Math.floor(h / 2), ('‹ ' + parts.join(' ') + ' ›').slice(0, w)); return; }
    case 'accordion': { const open = o.checked !== false; writeText(b, grid, c, r, ((open ? '▾ ' : '▸ ') + (lab || 'Section')).slice(0, w)); for (let i = 0; i < w; i++) put(b, grid, c + i, r + 1, '─'); if (open && o.body) String(o.body).split('\n').forEach((ln, i) => { if (r + 2 + i < r + h) writeText(b, grid, c + 2, r + 2 + i, ln.slice(0, w - 2)); }); return; }
    case 'menu': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); (o.items || ['Item 1','Item 2','Item 3']).forEach((it, i) => { if (r + 1 + i < r + h - 1) writeText(b, grid, c + 2, r + 1 + i, it.slice(0, w - 4)); }); return; }
    case 'snackbar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const mid = r + Math.floor(h / 2); const act = o.body || 'UNDO'; writeText(b, grid, c + 2, mid, (lab || 'Saved').slice(0, w - 6 - act.length)); writeText(b, grid, c + Math.max(2, w - 2 - act.length), mid, act); return; }
    case 'fab': { drawBoxFrame(b, grid, c, r, w, h, 'rounded', 'solid'); drawCenteredLabel(b, grid, c, r, w, h, o.icon || '+'); return; }
    case 'spinner': writeText(b, grid, c, r + Math.floor(h / 2), ('◐ ' + (lab || 'Loading…')).slice(0, w)); return;
    case 'statcard': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); writeText(b, grid, c + 2, r + 1, (lab || '1,234').slice(0, w - 4)); writeText(b, grid, c + 2, r + 2, (o.body || 'Users').slice(0, w - 4)); return; }
    case 'chartbar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const bars = ['▁','▂','▃','▄','▅','▆','▇','█']; const data = o.items || ['3','6','2','7','5','8','4','6','3','7']; for (let i = 0; i < w - 2; i++) { const lvl = Math.max(0, Math.min(7, parseInt(data[i % data.length]) || 3)); put(b, grid, c + 1 + i, r + h - 2, bars[lvl]); } return; }
    case 'video': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h, '▶'); return; }
    case 'grouplist': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const items = o.items || ['Settings','Privacy','About']; items.forEach((it, i) => { const rr = r + 1 + i * 2; if (rr < r + h - 1) { writeText(b, grid, c + 2, rr, it.slice(0, w - 6)); put(b, grid, c + w - 3, rr, '›'); if (i < items.length - 1 && rr + 1 < r + h - 1) for (let x = 2; x < w - 2; x++) put(b, grid, c + x, rr + 1, '─'); } }); return; }
    case 'pagecontrol': { const n = o.maxValue ?? 4, act = o.activeStep ?? 0; let s = ''; for (let i = 0; i < n; i++) s += (i === act ? '● ' : '○ '); const t = s.trim(); writeText(b, grid, c + centerPad(w, t.length), r + Math.floor(h / 2), t); return; }
    case 'listitem': { const lead = o.icon || '●'; const trail = o.trailing || '›'; const mid = r + Math.floor((h - (o.body ? 1 : 0)) / 2); writeText(b, grid, c, mid, (lead + '  ' + (lab || 'Title')).slice(0, Math.max(0, w - trail.length - 1))); if (o.body) writeText(b, grid, c + 3, mid + 1, String(o.body).slice(0, w - 5)); writeText(b, grid, c + w - trail.length, mid, trail); for (let i = 0; i < w; i++) put(b, grid, c + i, r + h - 1, '─'); return; }
    case 'appbar': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const lead = o.icon || '≡'; const mid = r + Math.floor(h / 2); writeText(b, grid, c + 2, mid, (lead + '  ' + (lab || 'Title')).slice(0, w - 4)); const right = (o.items || ['⋯']).join('  '); writeText(b, grid, c + Math.max(2, w - 2 - right.length), mid, right); return; }
    case 'bottomsheet': { drawBoxFrame(b, grid, c, r, w, h, o.borderStyle || 'rounded', 'solid'); const grab = '────'; writeText(b, grid, c + centerPad(w, grab.length), r + 1, grab); if (lab) writeText(b, grid, c + 2, r + 2, lab.slice(0, w - 4)); for (let i = 1; i < w - 1; i++) put(b, grid, c + i, r + 3, '─'); if (o.body) String(o.body).split('\n').forEach((ln, i) => { if (r + 4 + i < r + h - 1) writeText(b, grid, c + 2, r + 4 + i, ln.slice(0, w - 4)); }); return; }
    case 'banner': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); const mid = r + Math.floor(h / 2); const act = o.body || 'Action'; writeText(b, grid, c + 2, mid, ((o.icon || 'ⓘ') + ' ' + (lab || 'Banner message')).slice(0, w - 5 - act.length)); writeText(b, grid, c + Math.max(2, w - 2 - act.length), mid, act); return; }
    case 'textarea': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); writeText(b, grid, c + 2, r + 1, (lab || 'Text…').slice(0, w - 4)); return; }
    case 'datefield': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); writeText(b, grid, c + 2, r + Math.floor(h / 2), (lab || 'YYYY-MM-DD').slice(0, w - 5)); put(b, grid, c + w - 3, r + Math.floor(h / 2), '▦'); return; }
    case 'otp': { const n = o.maxValue || 4; let x = c; for (let i = 0; i < n && x + 3 <= c + w; i++) { drawBoxFrame(b, grid, x, r, 4, 3, 'single', 'solid'); put(b, grid, x + 1, r + 1, (o.label || '')[i] || '_'); x += 5; } return; }
    case 'chipgroup': { const items = o.items || ['All', 'Active', 'Done']; writeText(b, grid, c, r + Math.floor(h / 2), items.map(it => '[' + it + ']').join(' ').slice(0, w)); return; }
    case 'carousel': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h - 1, o.icon || '⊠'); const n = o.maxValue || 3, act = o.activeStep || 0; let dots = ''; for (let i = 0; i < n; i++) dots += (i === act ? '● ' : '○ '); dots = dots.trim(); writeText(b, grid, c + centerPad(w, dots.length), r + h - 2, dots); return; }
    case 'emptystate': { const midR = r + Math.floor(h / 2); put(b, grid, c + Math.floor((w - 1) / 2), midR - 1, o.icon || '∅'); const title = lab || 'Nothing here'; writeText(b, grid, c + centerPad(w, title.length), midR, title.slice(0, w)); if (o.body) writeText(b, grid, c + centerPad(w, o.body.length), midR + 1, o.body.slice(0, w)); return; }
    case 'map': { drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); for (let rr = r + 1; rr < r + h - 1; rr += 2) for (let cc = c + 1; cc < c + w - 1; cc += 4) put(b, grid, cc, rr, '·'); drawCenteredLabel(b, grid, c, r, w, h, '⌖ ' + (lab || 'Map')); return; }
    default: drawBoxFrame(b, grid, c, r, w, h, bs, 'solid'); drawCenteredLabel(b, grid, c, r, w, h, lab || ct);
  }
}

function drawLine(b, grid, o) {
  const x0 = o.position.col, y0 = o.position.row, x1 = o.endPosition.col, y1 = o.endPosition.row;
  bresenham(x0, y0, x1, y1).forEach((p) => {
    let ch = '·';
    if (y0 === y1) ch = '─'; else if (x0 === x1) ch = '│';
    else ch = (x1 - x0) * (y1 - y0) > 0 ? '╲' : '╱';
    put(b, grid, p[0], p[1], ch);
  });
  if (o.type === 'arrow') { const head = arrowHead(x0, y0, x1, y1); if (o.endHead !== false) put(b, grid, x1, y1, head.end); if (o.startHead) put(b, grid, x0, y0, head.start); }
}
function arrowHead(x0, y0, x1, y1) {
  if (y0 === y1) return x1 >= x0 ? { end:'▶', start:'◀' } : { end:'◀', start:'▶' };
  if (x0 === x1) return y1 >= y0 ? { end:'▼', start:'▲' } : { end:'▲', start:'▼' };
  return { end:'►', start:'◄' };
}
function bresenham(x0, y0, x1, y1) {
  const pts = []; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, x = x0, y = y0;
  while (true) { pts.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } }
  return pts;
}
function objCenter(o) { return { x: o.position.col + (o.width ?? 10) / 2, y: o.position.row + (o.height ?? 5) / 2 }; }
function edgePoint(o, side) {
  const c = o.position.col, r = o.position.row, w = o.width ?? 10, h = o.height ?? 5;
  if (side === 'top') return { x: Math.round(c + w / 2), y: r - 1 };
  if (side === 'bottom') return { x: Math.round(c + w / 2), y: r + h };
  if (side === 'left') return { x: c - 1, y: Math.round(r + h / 2) };
  return { x: c + w, y: Math.round(r + h / 2) };
}
function autoSides(a, bb) {
  const ca = objCenter(a), cb = objCenter(bb), dx = cb.x - ca.x, dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right','left'] : ['left','right'];
  return dy >= 0 ? ['bottom','top'] : ['top','bottom'];
}
function drawConnector(b, grid, objs, o) {
  const from = objs.find(x => x.id === o.fromId), to = objs.find(x => x.id === o.toId);
  if (!from || !to) return;
  const [fa, ta] = autoSides(from, to);
  const fs = o.fromSide || fa, ts = o.toSide || ta;
  const p0 = edgePoint(from, fs), p1 = edgePoint(to, ts);
  const midX = Math.round((p0.x + p1.x) / 2), midY = Math.round((p0.y + p1.y) / 2);
  const path = [];
  const hseg = (x0, x1, y) => { const s = x0 < x1 ? 1 : -1; for (let x = x0; x !== x1 + s; x += s) path.push([x, y, '─']); };
  const vseg = (y0, y1, x) => { const s = y0 < y1 ? 1 : -1; for (let y = y0; y !== y1 + s; y += s) path.push([x, y, '│']); };
  if (fs === 'left' || fs === 'right') { hseg(p0.x, midX, p0.y); vseg(p0.y, p1.y, midX); hseg(midX, p1.x, p1.y); }
  else { vseg(p0.y, midY, p0.x); hseg(p0.x, p1.x, midY); vseg(midY, p1.y, p1.x); }
  path.forEach(p => put(b, grid, p[0], p[1], p[2]));
  let hc = '►'; if (ts === 'left') hc = '▶'; else if (ts === 'right') hc = '◀'; else if (ts === 'top') hc = '▼'; else if (ts === 'bottom') hc = '▲';
  if (o.endHead !== false) put(b, grid, p1.x, p1.y, hc);
  if (o.label) writeText(b, grid, midX - Math.floor(o.label.length / 2), midY, o.label);
}

function orderedObjects(page) {
  const lidx = {}, vis = {};
  (page.layers || []).forEach((l, i) => { lidx[l.id] = i; vis[l.id] = l.visible; });
  return (page.objects || []).filter(o => vis[o.layerId ?? 'default'] !== false).slice()
    .sort((a, bb) => {
      const la = lidx[a.layerId ?? 'default'] ?? 0, lb = lidx[bb.layerId ?? 'default'] ?? 0;
      if (la !== lb) return la - lb;
      return (a.zIndex ?? 0) - (bb.zIndex ?? 0);
    });
}

export function renderAscii(page, grid) {
  const b = makeBuf(grid);
  const ordered = orderedObjects(page);
  ordered.forEach(o => { if (o.type !== 'connector') renderObject(b, grid, o); });
  ordered.forEach(o => { if (o.type === 'connector') drawConnector(b, grid, page.objects, o); });
  return b.map(row => row.join('').replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

/* ---------- doc building + URL ---------- */
function boundsOf(o) {
  if (o.type === 'line' || o.type === 'arrow') {
    return { col: Math.min(o.position.col, o.endPosition.col), row: Math.min(o.position.row, o.endPosition.row), w: Math.abs(o.endPosition.col - o.position.col) + 1, h: Math.abs(o.endPosition.row - o.position.row) + 1 };
  }
  return { col: o.position?.col ?? 0, row: o.position?.row ?? 0, w: o.width ?? 10, h: o.height ?? 5 };
}
function fitGrid(grid, pages) {
  let maxC = grid.cols, maxR = grid.rows;
  pages.forEach(p => (p.objects || []).forEach(o => { if (o.type === 'connector') return; const b = boundsOf(o); maxC = Math.max(maxC, b.col + b.w + 2); maxR = Math.max(maxR, b.row + b.h + 2); }));
  grid.cols = Math.max(grid.cols, maxC); grid.rows = Math.max(grid.rows, maxR);
}

// input: { objects?, pages?, name?, grid? } -> normalized v2 doc
export function makeDoc(input = {}) {
  const grid = Object.assign({ cols: 60, rows: 24, cellW: 10, cellH: 20 }, input.grid || {});
  let pages;
  if (Array.isArray(input.pages) && input.pages.length) {
    pages = input.pages.map((p, i) => ({ id: 'pg' + uid(), name: p.name || ('Flow ' + (i + 1)), layers: [{ id: 'default', name: 'Layer 1', visible: true }], objects: p.objects || [] }));
  } else {
    pages = [{ id: 'pg' + uid(), name: input.name || 'Flow 1', layers: [{ id: 'default', name: 'Layer 1', visible: true }], objects: input.objects || [] }];
  }
  pages.forEach(pg => (pg.objects || []).forEach(o => { if (!o.id) o.id = uid(); if (!o.layerId) o.layerId = 'default'; if (!o.position) o.position = { col: 0, row: 0 }; }));
  fitGrid(grid, pages);
  // Project code = Live-session room id. Precedence: arg `code` → env WIREDRAFT_CODE → random.
  const fixed = input.code || process.env.WIREDRAFT_CODE;
  const code = (fixed && /^WD-[A-Z0-9]{4,}$/i.test(fixed)) ? fixed.toUpperCase() : genCode();
  return { version: 2, code, grid, pages, activePage: pages[0].id };
}

export function encodeUrl(doc, baseUrl = DEFAULT_BASE) {
  const json = JSON.stringify(doc);
  const b64 = gzipSync(Buffer.from(json, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sep = baseUrl.includes('#') ? '' : '#z=';
  return baseUrl + sep + b64;
}
