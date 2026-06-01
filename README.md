# WireDraft

Single-file, statyczne narzędzie do **makietowania lo-fi** w stylu znakowego gridu (ASCII), wizualnie
spójne z [Grid Blob](../grid-blob). Rysujesz pierwsze drafty UI, dopieszczasz je wizualnie (drag / resize /
notatki), a potem eksportujesz **do Figmy** — żeby tam pracować na hi-fi.

Model obiektów jest zgodny z **wiretext** (`box / text / line / arrow / component / connector`, pola
`annotation`, `layers`, `groupId`, `zIndex`), więc makiety są wymienne z ekosystemem wiretext / skillem
`figma-flow-design`.

## Co potrafi

- **Ogromny, pannable canvas** — workspace ≥ 600×280 cel, rośnie z zawartością; siatka kropek to tanie tło CSS
  (skaluje się bez limitu). **Zoom-to-fit** (przycisk ⊡ / Shift+1) dopasowuje widok do wszystkich ekranów.
- **Domyślnie tryb mobilny** — narzędzie startuje w trybie **Mobile App** (komponenty + ramka telefonu).
- **Uporządkowany sidebar (mobile-first)** — grupy: **TOOLS · MOBILE** (chrome per tryb, na górze) **· FORMS ·
  CONTAINERS · NAVIGATION · DISPLAY** (trzy ostatnie zwinięte domyślnie). ~55 komponentów. Wzorce mobilne m.in.:
  app bar, list item, bottom sheet, banner, OTP/code, textarea, date field, chip-row, carousel, empty state, map,
  FAB — obok wariantów iOS (status bar, nav, tab bar, segmented, switch, search, grouplist, page-control, home
  indicator) i bazowych (button/input/card/modal/table/list/accordion/menu/tabs/heading/badge/chip/stat/chart…).
- **Pages** — wiele stron w projekcie, każda = osobny canvas/ścieżka (własne obiekty + warstwy). **Zakładki
  na górze canvasu** (jak w Figmie): klik = przełącz, dwuklik = zmień nazwę, × = usuń, `+` = nowa. Kontrolki
  (undo/redo, zoom, **? = skróty**) po prawej stronie górnego paska.
- **Tryby projektowania** (selektor u góry, per strona): **Web Desktop / Web Mobile / iOS App**. Sekcja
  **CHROME** w sidebarze zmienia zawartość wg trybu, a **Frame** wstawia ramkę urządzenia z chrome (status bar,
  nav bar, tab bar, home indicator) jako jedną grupę. Warianty iOS w ASCII: `statusbar`, `iosnav` (‹ Back),
  `tabbar`, `segmented` (« »), `iosswitch` ((  ●)), `searchbar` (⌕), `homeindicator` (▬▬▬). Tryb zapisuje się
  w projekcie (share link / JSON).
- **Współdzielenie** — każdy projekt ma **unikalny kod** (`WD-XXXXXXXX`, w sekcji SHARE). „Udostępnij projekt"
  kopiuje link `#z=…` z całym projektem (wszystkie strony) — działa dla każdego, bez serwera.
- **Live session (P2P)** — „Live session" łączy wszystkich z tym samym kodem w jeden pokój przez **WebRTC
  (Trystero/nostr)**: **kursory innych na żywo** (z nazwą/kolorem, filtrowane per strona) + **synchronizacja
  zmian** (last-writer-wins, debounce). Bez własnego serwera. Otwarcie linku `#z=…` auto-dołącza do sesji.
- **Zaznaczanie wielu** — marquee (przeciągnij po pustym), Shift = dokładanie; przesuwanie grupy razem.
- **Sidebar jak wiretext** — sekcje: **Layers** (◉ widoczność, ◇ lock, „+ Layer", licznik obiektów),
  **Tools** (Select, Box, Text, Line, Arrow, Connector), **Input** (Button, Input, Select, Checkbox, Radio,
  Toggle), **Layout** (Table, Modal, Browser, Card), **Display** (Navbar, Tabs, Progress, Icon, Image, Divider,
  Alert, Breadcrumb, Avatar, List, Stepper, Rating, Skeleton), **Inspector** (właściwości zaznaczenia + notatka),
  **Objects**, **Canvas**, **Export/Import**.
- **Dolny status bar** — tryb, współrzędne kursora, liczba obiektów, zaznaczenie, SNAP, zoom.
- **Light / Dark** — przełącznik motywu pod ikoną **?** (zapamiętywany). Eksport SVG dopasowuje kolory do motywu.
- **SHARE / EXPORT (skondensowane)** — jeden dropdown ze wszystkimi akcjami (Copy/Download SVG/JSON, Share link,
  Copy kod, Import, MCP, Live) + dwa przyciski na wierzchu: **Copy SVG** i **Share link**.
- **Dodawanie** — **przeciągnij kafelek z palety na canvas** (z podglądem miejsca), albo kliknij = wstaw na środku widoku.
- **Interakcje** — klik = zaznacz, Shift+klik = multi, drag = przesuń (snap do cel), uchwyt = resize,
  Del = usuń, **Ctrl+Z / Ctrl+Shift+Z** = undo/redo, **Ctrl+C/X/V/D** = kopiuj/wytnij/wklej/duplikuj,
  **Ctrl+T** = nowa strona (jeśli przeglądarka nie przechwyci skrótu). Warstwę można **zablokować** (kłódka).
- **Inspector** — pełne, kontekstowe opcje per komponent: Border, State (On/Off), Body, items, list style,
  rating, progress, **picker ikon z kategoriami** (Navigation/Actions/Status/… — wiodąca ikona dla input/button/
  select, główny glif dla icon/image) oraz pole Notatki (✎) → Figma.
- **Canvas** — zoom (Ctrl+scroll, +/−, Ctrl+0 reset), pan (Space/H trzymane albo środkowy przycisk).
- **Notatki** — każdy obiekt ma pole `annotation` (✎). Notatki jadą do eksportu jako osobna warstwa.

## „Load z Claude" (bez backendu)

Narzędzie jest w 100% statyczne (GitHub Pages), więc stan makiety jedzie w **URL hash**:

- `#g=<gist-id>` — **najkrótszy link** (~70 znaków): projekt zapisany w sekretnym GitHub Gist, edytor wczytuje
  go po `fetch`. Tak domyślnie linkuje MCP, gdy ma token (patrz niżej).
- `#z=<gzip+base64url>` — link **samodzielny** (cały projekt w URL-u, gzip przez `CompressionStream`); fallback
  gdy brak tokenu/sieci. To format „Share link" w edytorze (przeglądarka nie tworzy gistów).
- `#d=<base64url(JSON)>` / `#j=<uri-encoded JSON>` — starsze formaty, nadal wczytywane (kompatybilność wstecz).
- **Paste / import…** — wklej `Doc` lub samą tablicę `objects[]` (Claude może dać sam JSON).
- **Drag & drop** pliku `.json` na canvas.

Pętla pracy: Claude komponuje `objects[]` → daje Ci link/JSON → wczytujesz i dopieszczasz wizualnie → eksport.

## Claude Code (MCP)

W repo jest serwer **MCP** (`mcp/server.js`), który pozwala Claude Code generować makiety i wrzucać je do
WireDraft jednym linkiem. Narzędzia:

- **`create_wireframe`** — z `objects[]` (lub `pages[]`) buduje makietę i zwraca **edytowalny URL**
  (`https://vod123qwe.github.io/wiredraft/#z=…`) + podgląd ASCII.
- **`render_wireframe`** — sam podgląd ASCII (do sprawdzenia układu).

Podłączenie (terminal, w katalogu projektu):

```bash
claude mcp add wiredraft -- npx -y github:vod123qwe/wiredraft
```

…albo ręcznie w `.mcp.json`:

```json
{
  "mcpServers": {
    "wiredraft": {
      "command": "npx",
      "args": ["-y", "github:vod123qwe/wiredraft"]
    }
  }
}
```

**Krótkie linki (gist).** `create_wireframe` domyślnie zapisuje projekt w **sekretnym GitHub Gist** i zwraca
krótki link `…/#g=<id>` (~70 znaków) zamiast długiego `#z=`. Wymaga tokenu GitHub: brany z `GITHUB_TOKEN` /
`GH_TOKEN`, a jeśli brak — z `gh auth token` (gdy masz zalogowane `gh`). Bez tokenu/sieci → fallback do `#z=`
(zero regresji). Wymuszenie długiego linku: argument `inline: true`. (Gist jest „secret" — niepubliczny, ale
dostępny po znajomości linku.)

Potem: w Claude Code poproś np. *„zrób makietę ekranu logowania"* → dostaniesz link, otwierasz go w WireDraft,
dopieszczasz i eksportujesz do Figmy. (Instrukcja jest też w aplikacji: **SHARE → ⚡ Połącz Claude Code (MCP)**.)
Inny edytor/host można wskazać zmienną `WIREDRAFT_URL`.

### Stały kod projektu = stała przestrzeń

Kod projektu (`WD-XXXXXXXX`) jest jednocześnie **identyfikatorem pokoju Live session (P2P)** — czyli „przestrzeni".
Domyślnie `create_wireframe` losuje nowy kod przy każdym wywołaniu (każdy link = inny pokój). Żeby wszystkie
generowane linki trafiały w **ten sam pokój**, ustaw stały kod. Precedencja: argument `code` (per wywołanie) →
zmienna `WIREDRAFT_CODE` → losowy (fallback).

```json
{
  "mcpServers": {
    "wiredraft": {
      "command": "npx",
      "args": ["-y", "github:vod123qwe/wiredraft"],
      "env": { "WIREDRAFT_CODE": "WD-P8ZOWAVQ" }
    }
  }
}
```

> Uwaga: WireDraft nie ma backendu. Stały kod **łączy w ten sam pokój Live session**, ale każdy link wciąż niesie
> własną zawartość (otwarcie `#z=…` zastępuje lokalny stan, potem dołącza do pokoju). Trwałość „po samym kodzie"
> (bez przenoszenia zawartości w linku) wymaga backendu (np. GitHub Gist) — to kolejny krok z roadmapy.

## Eksport do Figmy

1. **Copy SVG** → w Figmie <kbd>Ctrl/Cmd</kbd>+<kbd>V</kbd>. Wkleja się jako edytowalne warstwy
   wektorowe; grupy nazwane po warstwach i obiektach, notatki w warstwie `#annotations` (żółte sticky + linia).
2. **Download SVG** → przeciągnij plik na canvas Figmy.
3. **Copy / Download JSON** → format dla Claude: w sesji z Figma MCP Claude odtwarza **natywne** ramki /
   teksty / auto-layout + `annotation` jako adnotacje Figmy (wyższa wierność niż wklejony SVG).

## Uruchomienie lokalne

Bez kroku budowania. Otwórz `index.html` wprost, albo:

```bash
node serve.cjs   # http://localhost:8794
```

## Hosting (GitHub Pages)

Repo statyczne — wrzuć `index.html` (i opcjonalnie README) do repo, włącz Pages na branchu `main`.
Działa jak `grid-blob` na `*.github.io`.

## Roadmapa (kolejne iteracje)

- **Trwała współpraca / kod-only** — backend (np. GitHub Gist) by wczytywać projekt po samym krótkim kodzie
  i persystować sesję między spotkaniami (live P2P jest efemeryczne — działa tylko gdy obie strony są online).
- Kompresja `#z=` (lz-string) dla krótszych linków (przy dużych makietach).
- Przycisk **natywnego eksportu do Figmy** wprost z edytora (na razie po stronie Claude przez Figma MCP).
- Tryb „klik narzędzie → kliknij na canvasie by postawić" (teraz obiekt ląduje na środku widoku).
