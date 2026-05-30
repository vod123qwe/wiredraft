#!/usr/bin/env node
// WireDraft MCP server — generates an editable WireDraft URL (state encoded in the
// #z= hash) from wire objects, plus an ASCII preview. Pair it with Claude Code to
// draft lo-fi wireframes, then open the link to refine them and export to Figma.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { makeDoc, encodeUrl, renderAscii, DEFAULT_BASE } from './wireframe.js';

const BASE_URL = process.env.WIREDRAFT_URL || DEFAULT_BASE;

const POSITION = { type: 'object', properties: { col: { type: 'integer' }, row: { type: 'integer' } }, required: ['col', 'row'] };
const WIRE_OBJECT = {
  type: 'object',
  additionalProperties: true,
  properties: {
    type: { type: 'string', enum: ['box', 'text', 'line', 'arrow', 'component', 'connector'] },
    id: { type: 'string', description: 'Stable id; needed when referenced by a connector.' },
    name: { type: 'string', description: 'Human label → becomes the Figma layer name on export.' },
    position: { ...POSITION, description: 'Top-left in grid cells (0-based). 1 cell = 1 monospace char.' },
    width: { type: 'integer', description: 'Cells incl. 1-cell border. Interior = width-2.' },
    height: { type: 'integer' },
    label: { type: 'string', description: 'Centered label (box/button/etc). \\n for multiline.' },
    content: { type: 'string', description: 'Text content for type="text".' },
    componentType: { type: 'string', enum: ['button','input','select','checkbox','radio','toggle','navbar','tabs','card','modal','list','table','image','alert','avatar','progress','divider','breadcrumb','browser','icon','stepper','rating','skeleton','statusbar','iosnav','tabbar','segmented','iosswitch','searchbar','homeindicator','heading','link','badge','chip','kbd','slider','numstep','pagination','accordion','menu','snackbar','fab','spinner','statcard','chartbar','video','grouplist','pagecontrol','listitem','appbar','bottomsheet','banner','textarea','datefield','otp','chipgroup','carousel','emptystate','map'] },
    borderStyle: { type: 'string', enum: ['single', 'double', 'rounded', 'heavy'] },
    fill: { type: 'string', enum: ['transparent', 'solid'] },
    annotation: { type: 'string', description: 'Design note → exported to Figma as an annotation/sticky.' },
    endPosition: { ...POSITION, description: 'End point for line/arrow.' },
    fromId: { type: 'string', description: 'connector: source object id.' },
    toId: { type: 'string', description: 'connector: target object id.' },
    items: { type: 'array', items: { type: 'string' } },
    navItems: { type: 'array', items: { type: 'string' } },
    tabs: { type: 'array', items: { type: 'string' } },
    columns: { type: 'array', items: { type: 'string' } },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    checked: { type: 'boolean' }, progress: { type: 'number' }, value: { type: 'number' }, maxValue: { type: 'integer' }, activeStep: { type: 'integer' },
    alertType: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
    icon: { type: 'string' }, body: { type: 'string' }, trailing: { type: 'string', description: 'listitem: right-side text/glyph (default ›).' }, variant: { type: 'string', description: 'Component variant: input/select/textarea/datefield → plain|labeled; button → filled|text; avatar → circle|square.' }, fieldLabel: { type: 'string', description: 'Label shown above a labeled field (variant="labeled").' }, listStyle: { type: 'string', enum: ['bullet', 'number', 'dash'] }, zIndex: { type: 'integer' },
  },
};

const GRID = { type: 'object', properties: { cols: { type: 'integer' }, rows: { type: 'integer' }, cellW: { type: 'integer' }, cellH: { type: 'integer' } } };

const LAYOUT_GUIDE =
  'Coordinates are character cells (1 cell = 1 monospace char). position={col,row} is the top-left, 0-based. ' +
  'Boxes/components have a 1-cell border; interior = width-2 × height-2. To nest a child, offset +2 col / +2 row from the parent and keep it 2 cells inside the far edge. ' +
  'Min sizes: button=label+4, input=label+6, card/modal h≥6, table/browser w≥20 h≥5. Use connectors (fromId→toId) to link screens into flows.';

const tools = [
  {
    name: 'create_wireframe',
    description:
      'Build a WireDraft wireframe and return an editable URL (state encoded in the #z= hash) that opens in the WireDraft editor — plus an ASCII preview. ' +
      'Use for lo-fi mockups/flows before hi-fi work in Figma. Pass either a single `objects` array, or `pages` (one canvas per flow). ' + LAYOUT_GUIDE,
    inputSchema: {
      type: 'object',
      properties: {
        objects: { type: 'array', items: WIRE_OBJECT, description: 'Objects for a single page.' },
        pages: { type: 'array', description: 'Multiple flows; each is its own canvas.', items: { type: 'object', properties: { name: { type: 'string' }, objects: { type: 'array', items: WIRE_OBJECT } }, required: ['objects'] } },
        name: { type: 'string', description: 'Page name when using `objects`.' },
        grid: GRID,
        code: { type: 'string', description: 'Fixed project code (np. WD-XXXXXXXX). Emitowany do linku → wszystkie linki z tym kodem otwierają ten sam pokój Live session / przestrzeń. Domyślnie env WIREDRAFT_CODE, w razie braku — losowy.' },
      },
    },
  },
  {
    name: 'render_wireframe',
    description: 'Render wire objects to an ASCII/Unicode preview (no URL). Use to check a layout before create_wireframe. ' + LAYOUT_GUIDE,
    inputSchema: { type: 'object', properties: { objects: { type: 'array', items: WIRE_OBJECT }, grid: GRID }, required: ['objects'] },
  },
];

const server = new Server({ name: 'wiredraft', version: '0.4.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    if (name === 'create_wireframe') {
      const doc = makeDoc(args);
      const url = encodeUrl(doc, BASE_URL);
      const previews = doc.pages.map(p => `── ${p.name} ──\n${renderAscii(p, doc.grid) || '(empty)'}`).join('\n\n');
      const text = `Open in WireDraft (editable):\n${url}\n\nProject code: ${doc.code} · pages: ${doc.pages.length}\n\nPreview:\n${previews}`;
      return { content: [{ type: 'text', text }] };
    }
    if (name === 'render_wireframe') {
      const doc = makeDoc({ objects: args.objects, grid: args.grid });
      return { content: [{ type: 'text', text: renderAscii(doc.pages[0], doc.grid) || '(empty)' }] };
    }
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (e) {
    return { content: [{ type: 'text', text: 'Error: ' + (e && e.message ? e.message : String(e)) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('wiredraft MCP server running (stdio) → ' + BASE_URL);
