# 3CXplore sources (since 19.0) — [en français](LISEZMOI.md)

The latest version's code lives here. **Vite** builds it into **one self-contained HTML page**
(`mise run build`, which then turns that page into `app/visualiseur-3cx-v<version>.html`).

```bash
mise run dev      # http://localhost:5173 — the page reloads on every save
mise run build    # build every page
mise run check    # repository check (same as GitHub)
```

In `mise run dev` the page reopens the backup you last loaded (it is kept in the browser). Data
stays local, as in the real page.

## How the page is put together

| In | Written as | Becomes |
|---|---|---|
| `index.html` | `<script inline src="./js/appearance.js"></script>` | `<script>` + the file + `</script>` |
| a `.js` file | `//#include core/helpers.js` | the file's content, in place |
| `index.html` | `<link rel="stylesheet" href="./css/styles.css">` | one `<style>` (Vite joins the `@import`s) |

Nothing is added around the files: the page is the plain concatenation of the sources, in order.
Every file ends with a newline. The inlining is done by `scripts/vite-inline-scripts.mjs`.

Placeholders filled in by `scripts/generate.mjs`: `__ROOT__` (site root), `__APP_VERSION__`
(version number) and `<!--__VERSION_MENU__-->` (version selector). In `mise run dev` the first
two are filled in by the Vite plugin.

## Layout

```
index.html                 page structure (header, menu, main area) and the order of the blocks
css/styles.css             -> base, side-menu, modern-finish, geek-themes
js/i18n/i18n.js            French -> English translation (en-dictionary.js, en-templates.js)
js/appearance.js           themes and display options, applied before first paint
js/updates.js              update check and installation
js/loader/loader.js        reads the backup in the browser: zip, csv, xml, build-data (the object D),
                           storage-and-startup (IndexedDB), empty-state, close, timezone
js/app/app.js              order of the application files:
  core/                    helpers, store segmentation, tables, drawer, flow trees and diagrams
  tabs/                    one file per tab (or group of related tabs)
  ui/                      navigation (TABS, menus), search, command palette, notes, Excel export,
                           settings backup, guided tour
```

## Why classic scripts and not ES modules

The code in `js/app/` sits inside `<script type="text/x-app" id="app">` and is run again for
**every** backup that is opened (`new Function('D', …)` in `js/loader/storage-and-startup.js`).
All its files therefore share **one scope**: a constant declared in `core/helpers.js` is visible in
every tab, and **the order in `app.js` matters** (a constant must be declared before it is used at
the top level). The scripts in `<head>` (language, appearance) must also run before the page is
drawn, which ES modules (always deferred) would not do.

## Adding a tab

1. Create `js/app/tabs/<name>.js`.
2. Add it to `js/app/app.js`, before `ui/navigation.js`.
3. Declare it in `TABS` and `NAV_GROUPS` (`ui/navigation.js`), then in a menu section (`NAV_SETS` or `NAV2`, `ui/simplified-menu.js`).
4. Explain it in `src/guide.json` (French and English); `mise run check` makes sure of it.
5. Texts shown to the user are written in French; add their English translation to `js/i18n/en-dictionary.js`.
