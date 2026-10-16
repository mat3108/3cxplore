// Vite plugin: inline the app's classic scripts into the page.
//
// The app's scripts are classic scripts, not ES modules: they run in order while the page is parsed
// (theme and language before first paint), and the application code (`<script type="text/x-app">`)
// is re-run as a whole with `new Function('D', ...)` every time a backup is opened. Its ~100 files
// therefore share one scope, and are joined, in order, rather than imported.
//
//   <script inline src="./js/appearance.js"></script>   ->  <script>\n...file...</script>
//   //#include core/helpers.js                          ->  the file's content (inside a .js file)
//
// Nothing is added around the files: the page is the plain concatenation of the sources.
import fs from 'node:fs';
import path from 'node:path';

const INCLUDE = /^[ \t]*\/\/#include (\S+)[ \t]*$/;
const SCRIPT = /<script inline((?:\s+[\w-]+(?:="[^"]*")?)*)\s+src="([^"]+)"><\/script>/g;

/** Text of a JS file with its `//#include` lines replaced, recursively. `files` collects every file read. */
export function resolveIncludes(file, files = [], stack = []) {
  if (stack.includes(file)) throw new Error(`include loop: ${[...stack, file].join(' -> ')}`);
  if (!fs.existsSync(file)) throw new Error(`included file not found: ${file}${stack.length ? ` (from ${stack.at(-1)})` : ''}`);
  files.push(file);
  let out = '';
  for (const line of fs.readFileSync(file, 'utf8').split(/(?<=\n)/)) {
    const m = INCLUDE.exec(line.replace(/\r?\n$/, ''));
    if (!m) { out += line; continue; }
    const text = resolveIncludes(path.resolve(path.dirname(file), m[1]), files, [...stack, file]);
    if (text && !text.endsWith('\n')) throw new Error(`${m[1]} must end with a newline`);
    out += text;
  }
  return out;
}

/** index.html with every `<script inline src>` replaced by the script's content. */
export function inlineScripts(html, root, files = []) {
  return html.replace(SCRIPT, (_, attrs, src) => `<script${attrs}>\n${resolveIncludes(path.resolve(root, src), files)}</script>`);
}

export default function inlineScriptsPlugin({ devVersion = 'dev' } = {}) {
  let root;
  return {
    name: '3cxplore-inline-scripts',
    configResolved(config) { root = config.root; },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        html = inlineScripts(html, root);
        // dev server: no generator step, so fill in what it would (site root, version number)
        if (ctx.server) html = html.replaceAll('__ROOT__', '/').replaceAll('__APP_VERSION__', devVersion);
        return html;
      },
    },
    configureServer(server) {
      // inlined scripts are not part of Vite's module graph: reload the page when one changes
      server.watcher.on('change', file => {
        if (file.startsWith(root) && file.endsWith('.js')) server.ws.send({ type: 'full-reload', path: '*' });
      });
    },
  };
}
