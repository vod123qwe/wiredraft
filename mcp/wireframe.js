// WireDraft — shared wireframe logic for the MCP server (pure JS, no DOM).
// Mirrors the renderers in index.html so ASCII preview matches the editor,
// and builds editor URLs with the document encoded in the #d= hash.

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
  return { version: 2, code: genCode(), grid, pages, activePage: pages[0].id };
}

export function encodeUrl(doc, baseUrl = DEFAULT_BASE) {
  const json = JSON.stringify(doc);
  const b64 = Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sep = baseUrl.includes('#') ? '' : '#d=';
  return baseUrl + sep + b64;
}
