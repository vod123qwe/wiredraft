# WireDraft

Single-file, statyczne narzędzie do **makietowania lo-fi** w stylu znakowego gridu (ASCII), wizualnie
spójne z [Grid Blob](../grid-blob). Rysujesz pierwsze drafty UI, dopieszczasz je wizualnie (drag / resize /
notatki), a potem eksportujesz **do Figmy** — żeby tam pracować na hi-fi.

Model obiektów jest zgodny z **wiretext** (`box / text / line / arrow / component / connector`, pola
`annotation`, `layers`, `groupId`, `zIndex`), więc makiety są wymienne z ekosystemem wiretext / skillem
`figma-flow-design`.

## Co potrafi

- **Pełnoekranowy canvas znakowy** — dark, Figma-like; grid w kropki wypełnia cały obszar (edge-to-edge),
  prawy sidebar 300px (nagłówki: JetBrains Mono, wersaliki) ułożony w te same grupy co wiretext.
- **Pages** — wiele stron w projekcie, każda = osobny canvas/ścieżka (własne obiekty + warstwy). **Zakładki
  na górze canvasu** (jak w Figmie): klik = przełącz, dwuklik = zmień nazwę, × = usuń, `+` = nowa. Kontrolki
  (undo/redo, zoom, **? = skróty**) po prawej stronie górnego paska.
- **Współdzielenie** — każdy projekt ma **unikalny kod** (`WD-XXXXXXXX`, w sekcji SHARE). „Udostępnij projekt"
  kopiuje link `#d=…` z całym projektem (wszystkie strony) — działa dla każdego, bez serwera.
- **Live session (P2P)** — „Live session" łączy wszystkich z tym samym kodem w jeden pokój przez **WebRTC
  (Trystero/nostr)**: **kursory innych na żywo** (z nazwą/kolorem, filtrowane per strona) + **synchronizacja
  zmian** (last-writer-wins, debounce). Bez własnego serwera. Otwarcie linku `#d=…` auto-dołącza do sesji.
- **Zaznaczanie wielu** — marquee (przeciągnij po pustym), Shift = dokładanie; przesuwanie grupy razem.
- **Sidebar jak wiretext** — sekcje: **Layers** (◉ widoczność, ◇ lock, „+ Layer", licznik obiektów),
  **Tools** (Select, Box, Text, Line, Arrow, Connector), **Input** (Button, Input, Select, Checkbox, Radio,
  Toggle), **Layout** (Table, Modal, Browser, Card), **Display** (Navbar, Tabs, Progress, Icon, Image, Divider,
  Alert, Breadcrumb, Avatar, List, Stepper, Rating, Skeleton), **Inspector** (właściwości zaznaczenia + notatka),
  **Objects**, **Canvas**, **Export/Import**.
- **Dolny status bar** — tryb, współrzędne kursora, liczba obiektów, zaznaczenie, SNAP, zoom.
- **Dodawanie** — **przeciągnij kafelek z palety na canvas** (z podglądem miejsca), albo kliknij = wstaw na środku widoku.
- **Interakcje** — klik = zaznacz, Shift+klik = multi, drag = przesuń (snap do cel), uchwyt = resize,
  Del = usuń, **Ctrl+Z / Ctrl+Shift+Z** = undo/redo. Warstwę można **zablokować** (kłódka) — wtedy jej obiekty
  są nieklikalne, a warstwa jest wyraźnie oznaczona (bursztynowy pasek + 🔒).
- **Canvas** — zoom (Ctrl+scroll, +/−, Ctrl+0 reset), pan (Space/H trzymane albo środkowy przycisk).
- **Notatki** — każdy obiekt ma pole `annotation` (✎). Notatki jadą do eksportu jako osobna warstwa.

## „Load z Claude" (bez backendu)

Narzędzie jest w 100% statyczne (GitHub Pages), więc stan makiety jedzie w **URL hash**:

- `#d=<base64url(JSON dokumentu)>` — Claude generuje taki link; kliknięcie otwiera edytor z wczytaną makietą.
- `#j=<uri-encoded JSON>` — wariant nieskompresowany.
- **Paste / import…** — wklej `Doc` lub samą tablicę `objects[]` (Claude może dać sam JSON).
- **Drag & drop** pliku `.json` na canvas.

Pętla pracy: Claude komponuje `objects[]` → daje Ci link/JSON → wczytujesz i dopieszczasz wizualnie → eksport.

## Eksport do Figmy

1. **Copy SVG** → w Figmie <kbd>Ctrl/Cmd</kbd>+<kbd>V</kbd>. Wkleja się jako edytowalne warstwy
   wektorowe; grupy nazwane po warstwach i obiektach, notatki w warstwie `#annotations` (żółte sticky + linia).
2. **Download SVG** → przeciągnij plik na canvas Figmy.
3. **Copy / Download JSON** → format dla Claude: w sesji z Figma MCP Claude odtwarza **natywne** ramki /
   teksty / auto-layout + `annotation` jako adnotacje Figmy (wyższa wierność niż wklejony SVG).

## Uruchomienie lokalne

Bez kroku budowania. Otwórz `index.html` wprost, albo:

```bash
node serve.js   # http://localhost:8791
```

## Hosting (GitHub Pages)

Repo statyczne — wrzuć `index.html` (i opcjonalnie README) do repo, włącz Pages na branchu `main`.
Działa jak `grid-blob` na `*.github.io`.

## Roadmapa (kolejne iteracje)

- **Trwała współpraca / kod-only** — backend (np. GitHub Gist) by wczytywać projekt po samym krótkim kodzie
  i persystować sesję między spotkaniami (live P2P jest efemeryczne — działa tylko gdy obie strony są online).
- Dedykowany **npm/npx MCP**, który sam emituje linki `#d=…` do hostowanego edytora („każdy podpina MCP").
- Kompresja `#z=` (lz-string) dla krótszych linków.
- Przycisk **natywnego eksportu do Figmy** wprost z edytora (na razie po stronie Claude przez Figma MCP).
- Tryb „klik narzędzie → kliknij na canvasie by postawić" (teraz obiekt ląduje na środku widoku).
