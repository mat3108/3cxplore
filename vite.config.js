// 3CXplore: Vite builds src/app/ into one self-contained HTML page (build/app/index.html).
// That page is the template scripts/generate.mjs turns into app/visualiseur-3cx-v<version>.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import inlineScripts from './scripts/vite-inline-scripts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const versions = JSON.parse(fs.readFileSync(path.join(here, 'src/versions.json'), 'utf8'));

export default defineConfig({
  root: path.join(here, 'src/app'),
  // dev server only: serves app/firmwares-3cx.js (the phone firmware list) next to the page
  publicDir: path.join(here, 'app'),
  plugins: [inlineScripts({ devVersion: versions[0].version }), viteSingleFile()],
  server: { port: 5173, open: false },
  build: {
    outDir: process.env.VITE_OUT_DIR || path.join(here, 'build/app'),
    emptyOutDir: true,
    copyPublicDir: false,
    // keep the page readable and identical in behaviour to the sources (no renaming or rewriting)
    minify: false,
    cssMinify: false,
  },
  logLevel: process.env.VITE_LOG_LEVEL || 'info',
});
