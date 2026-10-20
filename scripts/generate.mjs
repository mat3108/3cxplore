#!/usr/bin/env node
// 3CXplore page generator.
//
//   mise run build              (or: node scripts/generate.mjs)
//   mise run package            (or: node scripts/generate.mjs --package)  also writes dist/visualiseur-3cx-v<n>.zip
//
// For every version in src/versions.json it writes visualiseur-3cx-v<n>.html: the latest in app/, the
// others in app/anciennes-versions/. A version's template comes from:
//   - src/versions/<n>/modele.html for versions up to 18.4 (frozen copies);
//   - Vite's build of src/app/ (build/app/index.html) for the latest version (19.0 and later);
//   - Vite's build of src/app/ as saved in the git tag v<n> for older versions from 19.0 on.
// It also writes the user guide (app/documentation.html, documentation-en.html), the changelog
// (app/changelog.html), index.html, the installable web app files (manifest.webmanifest, sw.js) and the
// generated parts of README.md (versions table, tabs, badge).
// --package: dist/visualiseur-3cx-v<n>.zip with only the latest version, its documentation, the firmware
// files and a read-me; if scripts/local/donnees-organisation.json exists (local only, never committed),
// organisation-specific terms are replaced with neutral examples.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

export const BASE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const P = (...p) => path.join(BASE, ...p);
const VERSIONS_JSON = P('src/versions.json');
const VERSIONS_DIR = P('src/versions');
const APP = P('app');
const OLD = P('app/anciennes-versions');
const DIST = P('dist');
const BUILD = P('build');

const read = f => fs.readFileSync(f, 'utf8');
const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const rep = (s, a, b) => s.split(a).join(b);                       // replace all, no `$` patterns
const rep1 = (s, a, b) => { const i = s.indexOf(a); return i < 0 ? s : s.slice(0, i) + b + s.slice(i + a.length); };
export const verKey = v => v.split('.').map(Number);
export const cmpVer = (a, b) => { const x = verKey(a), y = verKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
export const escHtml = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const pageName = v => `visualiseur-3cx-v${v}.html`;

export function loadVersions() {
  const versions = JSON.parse(read(VERSIONS_JSON));
  versions.sort((a, b) => cmpVer(b.version, a.version));
  return { versions, active: versions.filter(v => !v.retiree) };
}

// ---------- Templates ----------

async function viteBuild(configFile, outDir) {
  const { build } = await import('vite');
  process.env.VITE_OUT_DIR = outDir;
  try { await build({ configFile, logLevel: 'warn' }); } finally { delete process.env.VITE_OUT_DIR; }
  return read(path.join(outDir, 'index.html'));
}

/** Template of the latest version: Vite's build of src/app/. */
export async function buildLatest() {
  return viteBuild(P('vite.config.js'), path.join(BUILD, 'app'));
}

// Files of a git tag that Vite's build of src/app/ needs (present in every tag from 19.0 on).
const TAG_SOURCES = ['src/app', 'src/versions.json', 'scripts/vite-inline-scripts.mjs', 'vite.config.js', 'package.json'];

/** Template of an older version from 19.0 on: Vite's build of the sources saved in git tag v<n>. */
async function buildFromTag(version) {
  const tag = `v${version}`;
  let commit;
  try { commit = execFileSync('git', ['rev-parse', '--verify', '-q', `refs/tags/${tag}^{commit}`], { cwd: BASE, encoding: 'utf8' }).trim(); }
  catch { throw new Error(`no template for ${version}: neither src/versions/${version}/modele.html nor git tag ${tag} (git fetch --tags)`); }
  const dir = path.join(BUILD, 'tags', version), out = path.join(dir, '.out'), stamp = path.join(dir, '.commit');
  if (fs.existsSync(stamp) && read(stamp) === commit && fs.existsSync(path.join(out, 'index.html'))) return read(path.join(out, 'index.html'));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // only what the Vite build reads (the whole tree is ~450 MB per version); the build fails if a file is missing
  execFileSync('sh', ['-c', `git archive "${commit}" -- ${TAG_SOURCES.join(' ')} | tar -x -C "${dir}"`], { cwd: BASE });
  fs.symlinkSync(P('node_modules'), path.join(dir, 'node_modules'));
  const html = await viteBuild(path.join(dir, 'vite.config.js'), out);
  // keep only the built page and the stamp the cache check reads
  for (const f of fs.readdirSync(dir)) if (f !== '.out') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  write(stamp, commit);
  return html;
}

let latestTemplate = null;
/** HTML template of a version (see the header of this file). */
export async function template(version, latest) {
  const frozen = path.join(VERSIONS_DIR, version, 'modele.html');
  if (fs.existsSync(frozen)) return read(frozen);
  if (version === latest) return (latestTemplate ??= await buildLatest());
  return buildFromTag(version);
}

// ---------- Pages ----------

function pageHref(v, latest, here) {
  const name = pageName(v);
  if (v === latest) return here === 'app' ? name : '../' + name;
  return here === 'app' ? 'anciennes-versions/' + name : name;
}

/** Pre-6.19 file names and relative paths depending on where the page lives. */
function fixPaths(html, here) {
  const up = here === 'old' ? '../' : '';
  html = rep(rep(html, 'src="firmwares_3cx.js"', `src="${up}firmwares-3cx.js"`), 'src="firmwares-3cx.js"', `src="${up}firmwares-3cx.js"`);
  return rep(rep(html, 'verifier_firmwares.command', 'verifier-firmwares.command'), 'firmwares_3cx.js', 'firmwares-3cx.js');
}

/** Version selector + documentation link, injected into every page. */
export function versionMenu(versions, current, { floating = false, here = 'app' } = {}) {
  const act = versions.filter(v => !v.retiree);
  const latest = act[0]?.version;
  const doc = here === 'app' ? 'documentation.html' : '../documentation.html';
  const opts = act.map((v, i) => `<option value="${pageHref(v.version, latest, here)}"${v.version === current ? ' selected' : ''}>Version ${escHtml(v.version)}${i === 0 ? ' (actuelle)' : ''}</option>`).join('');
  let style = '.vmenu{display:flex;gap:6px;align-items:center}'
    + '.vmenu select{background:var(--panel2,#f1f3f6);color:var(--text,#1b1f24);border:1px solid var(--line,#e2e6eb);'
    + 'border-radius:6px;padding:4px 8px;font:inherit;font-size:13px;cursor:pointer}'
    + '.vmenu a{color:var(--accent,#2563eb);font-size:13px;text-decoration:none;white-space:nowrap}'
    + '.vmenu a:hover{text-decoration:underline}';
  if (floating) style += '.vmenu.float{position:fixed;top:8px;right:60px;z-index:30;background:var(--panel,#fff);'
    + 'padding:4px 8px;border:1px solid var(--line,#e2e6eb);border-radius:8px}';
  return `<style>${style}</style><div class="vmenu${floating ? ' float' : ''}"><select aria-label="Version de l'application" `
    + `onchange="location.href=this.value">${opts}${current === 'doc' ? '<option value="documentation.html" selected hidden>Documentation</option>' : ''}</select><a href="${doc}">Documentation</a></div>`
    // English interface: the link opens the English guide
    + '<script>(()=>{const a=document.currentScript.previousElementSibling.querySelector("a");'
    + 'if(a&&document.documentElement.lang==="en")a.href=a.getAttribute("href").replace(/documentation\\.html$/,"documentation-en.html");})()</script>';
}

function writePwa(version, latest) {
  const manifest = { name: '3CXplore', short_name: '3CXplore', description: 'Explorez votre 3CX en profondeur',
    lang: 'fr', start_url: './index.html', scope: './', display: 'standalone',
    background_color: '#042C53', theme_color: '#042C53',
    icons: [{ src: 'assets/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'assets/icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'assets/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
  write(P('manifest.webmanifest'), JSON.stringify(manifest, null, 1));
  const files = ['./', './index.html', './app/' + latest, './app/documentation.html', './app/documentation-en.html', './app/changelog.html', './app/firmwares-3cx.js', './manifest.webmanifest',
    './assets/icone-192.png', './assets/icone-512.png', './assets/logo-icone.svg'];
  write(P('sw.js'), `// 3CXplore — service worker (généré par scripts/generate.mjs ; ne pas modifier à la main)
// Garde une copie de l'outil pour le hors ligne et récupère la dernière version quand le réseau est disponible.
// Les backups ne passent jamais par ici : ils sont lus depuis le disque, dans le navigateur.
const CACHE = '3cxplore-${version}';
const FILES = [${files.map(f => JSON.stringify(f)).join(', ')}];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('3cxplore-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
// page d'accueil : on y redirige (vraie adresse) au lieu d'afficher son contenu sous une autre adresse,
// sinon ses liens relatifs pointent au mauvais endroit et les redirections bouclent (app/app/app/…)
const HOME = new URL('./index.html', self.registration.scope).href;
const home = r => r.mode === 'navigate' && r.url.split('#')[0] !== HOME ? Response.redirect(HOME, 302) : null;
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  // réseau d'abord (dernière version), copie locale si hors ligne
  e.respondWith(fetch(r).then(res => {
      if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }
      // page disparue (ancienne adresse) : aller à la dernière version plutôt qu'afficher une erreur 404
      if(res.status === 404) return home(r) || res;
      return res; })
    .catch(() => caches.match(r).then(m => m || home(r) || Response.error())));
});
`);
  write(P('.nojekyll'), '');   // GitHub Pages: serve files as they are
}

const sizeMb = f => (fs.statSync(f).size / 1e6).toFixed(1);

async function buildVersions(pkg) {
  const { versions, active } = loadVersions();
  const latestV = active[0].version;
  fs.mkdirSync(OLD, { recursive: true });
  for (const v of active) {
    const here = v === active[0] ? 'app' : 'old';
    let html = fixPaths(rep(await template(v.version, latestV), '/*__DATA__*/null', 'null'), here);
    html = rep(html, '__APP_VERSION__', v.version);                              // page version (update check)
    html = rep(html, '__ROOT__', here === 'app' ? '../' : '../../');            // site root (manifest, service worker)
    html = html.includes('<!--__VERSION_MENU__-->')
      ? rep(html, '<!--__VERSION_MENU__-->', versionMenu(versions, v.version, { here }))
      // versions from before the menu: floating selector, nothing else changes
      : rep1(html, '</body>', versionMenu(versions, v.version, { floating: true, here }) + '</body>');
    const out = path.join(here === 'app' ? APP : OLD, pageName(v.version));
    write(out, html);
    console.log('OK ->', pageName(v.version), `(${sizeMb(out)} Mo)`);
  }

  const latest = pageName(latestV);
  // generated pages no longer in their place (e.g. the previous latest version left in app/)
  const keep = new Set([path.join(APP, latest), ...active.slice(1).flatMap(v => [path.join(OLD, pageName(v.version)), path.join(APP, pageName(v.version))])]);
  for (const dir of [APP, OLD]) for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (/^visualiseur-3cx-v.*\.html$/.test(f) && !keep.has(full)) { fs.rmSync(full); console.log('Removed (moved generated page):', path.relative(BASE, full)); }
  }
  writePwa(latestV, latest);
  write(P('index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>3CXplore</title>'
    + `<meta http-equiv="refresh" content="0; url=app/${latest}"></head><body>`
    + `<p>Redirection vers la <a href="app/${latest}">version la plus récente</a>…</p></body></html>`);
  // old addresses of the latest version (bookmarks, installed app): small page that redirects to the current one
  for (const v of active.slice(1)) {
    write(path.join(APP, pageName(v.version)), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>3CXplore</title>'
      + '<meta http-equiv="refresh" content="0; url=../index.html"><script>location.replace("../index.html")</script></head><body>'
      + '<p>Cette version a été remplacée : <a href="../index.html">ouvrir la dernière version de 3CXplore</a>. '
      + `La version ${escHtml(v.version)} reste disponible dans <a href="anciennes-versions/${pageName(v.version)}">les anciennes versions</a>.</p></body></html>`);
  }

  write(path.join(APP, 'changelog.html'), buildChangelog(versions, active, versions));
  for (const [lang, name] of [['fr', 'documentation.html'], ['en', 'documentation-en.html']]) write(path.join(APP, name), await buildGuide(versions, active, { lang }));
  console.log(`OK -> app/documentation.html and documentation-en.html (guide); app/changelog.html; index.html -> app/${latest}`);
  await updateReadmes(active);
  if (pkg) await buildPackage(versions, active);
}

// ---------- Changelog ----------

function buildChangelog(versions, active, menuVersions, linkable = null) {
  let doc = read(P('src/documentation-modele.html'));
  const sections = versions.map(v => {
    const tabs = v.onglets?.length ? '<h4>Onglets</h4><dl class="tabs">' + v.onglets.map(([a, b]) => `<dt>${escHtml(a)}</dt><dd>${escHtml(b)}</dd>`).join('') + '</dl>' : '';
    const badge = v === active[0] ? ' <span class="badge">actuelle</span>' : (v.retiree ? ' <span class="badge off">retirée</span>' : '');
    const open = v.retiree ? `<span class="open muted">Retirée le ${escHtml(v.retiree)} — gabarit conservé dans versions/${escHtml(v.version)}/</span>`
      : (linkable === null || linkable.has(v.version) ? `<a class="open" href="${pageHref(v.version, active[0].version, 'app')}">Ouvrir cette version →</a>` : '<span class="open muted">Non incluse dans ce paquet</span>');
    return `<section class="ver" id="v${escHtml(v.version)}"><div class="vh"><h3>Version ${escHtml(v.version)}${badge}</h3><span class="date">${escHtml(v.date)}</span>`
      + `${open}</div><p class="titre">${escHtml(v.titre)}</p><p>${escHtml(v.resume)}</p>`
      + `<h4>Changements</h4><ul>${v.changements.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul>${tabs}</section>`;
  });
  const toc = versions.map(v => `<a href="#v${escHtml(v.version)}"${v.retiree ? ' class="off"' : ''}>${escHtml(v.version)} <span>${escHtml(v.date) + (v.retiree ? ' · retirée' : '')}</span></a>`).join('');
  doc = rep(doc, '<!--__VERSION_MENU__-->', versionMenu(menuVersions, 'doc'));
  doc = rep(doc, '<!--__HOME__-->', pageName(active[0].version));
  doc = rep(doc, '<!--__TOC__-->', toc);
  doc = rep(doc, '<!--__SECTIONS__-->', sections.join(''));
  return rep(doc, '<!--__SOURCE__-->', "le backup .zip choisi dans l'interface (aucune donnée n'est intégrée aux pages)");
}

// ---------- User guide ----------

const TAB_LABEL = /\['(\w+)','((?:[^'\\]|\\.)*)'/g;
const GROUP = /\[\s*(?:"([^"]+)"|'([^']+)')\s*,\s*\[([^\]]*)\]\s*\]/g;
const unq = s => s.replaceAll("\\'", "'");
const between = (t, a, b) => { const i = t.indexOf(a); if (i < 0) throw new Error(`${a} not found in the template`); const j = t.indexOf(b, i); if (j < 0) throw new Error(`${b} not found in the template`); return t.slice(i, j); };

/** Tab labels of a template, in order: {key: label}. */
export function tabLabels(t) {
  return Object.fromEntries([...between(t, 'const TABS = [', 'const NAV_GROUPS').matchAll(TAB_LABEL)].map(m => [m[1], unq(m[2])]));
}

/** Simplified menu of the latest version: [[group, [[entry, [tab keys]]]]] and the tab labels. */
function menuStructure(t) {
  const labels = tabLabels(t);
  const setsSrc = between(t, 'const NAV_SETS = {', 'const NAV2 = [');
  const sets = Object.fromEntries([...setsSrc.matchAll(/(\w+): \['((?:[^'\\]|\\.)*)', '\w+', \[([^\]]*)\]\]/g)].map(m => [m[1], [unq(m[2]), [...m[3].matchAll(/'(\w+)'/g)].map(x => x[1])]]));
  let nav2 = t.slice(t.indexOf('const NAV2 = ['));
  nav2 = nav2.slice(0, nav2.indexOf('];'));
  const out = [];
  for (const [, g1, g2, items] of nav2.matchAll(GROUP)) {
    const entries = [];
    for (const [, it] of items.matchAll(/'(@?\w+)'/g)) {
      if (it[0] === '@' && sets[it.slice(1)]) { const [l, ks] = sets[it.slice(1)]; entries.push([l, ks.filter(k => k in labels)]); }
      else if (it in labels) entries.push([labels[it], [it]]);
    }
    out.push([g1 || g2, entries]);
  }
  return [out, labels];
}

/** French -> English dictionary of the interface (const EN) of a template. */
function enLabels(t) {
  const a = t.indexOf('const EN = {');
  if (a < 0) return {};
  const b = t.indexOf('\n};', a);
  const out = {};
  for (const m of t.slice(a, b).matchAll(/"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g)) out[JSON.parse(`"${m[1]}"`)] = JSON.parse(`"${m[2]}"`);
  return out;
}

const GUIDE_TXT = {
  fr: { start: 'Premiers pas', subs: 'Sous-onglets : %s', how: "Comment l'utiliser", tip: 'Bon à savoir :', open: "Ouvrir l'onglet dans 3CXplore →",
    gl: 'Glossaire', gltoc: 'Termes de 3CX (%d)', glintro: "Les mots de 3CX utilisés dans l'outil, expliqués simplement. Dans le guide, les termes soulignés en pointillé mènent ici.",
    see: 'Voir : %s', cl: 'Changelog (historique des versions)', gltitle: 'Voir le glossaire', other: ['documentation-en.html', 'English version'] },
  en: { start: 'Getting started', subs: 'Sub-tabs: %s', how: 'How to use it', tip: 'Good to know:', open: 'Open the tab in 3CXplore →',
    gl: 'Glossary', gltoc: '3CX terms (%d)', glintro: 'The 3CX words used in the tool, explained simply. In the guide, terms underlined with dots lead here.',
    see: 'See: %s', cl: 'Changelog (version history)', gltitle: 'See the glossary', other: ['documentation.html', 'Version française'] },
};
const fmt = (s, x) => s.replace(/%[sd]/, x);

export const slug = s => s.normalize('NFD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const W = String.raw`\p{L}\p{N}_À-ÿ`;                                  // Python's Unicode \w, plus À-ÿ
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');      // only escapes that are valid in Unicode mode
const isUpper = s => s === s.toUpperCase() && s !== s.toLowerCase();

/** Links to the glossary the first occurrence of each technical term (outside existing links), at most `limit` terms. */
function guideLinks(html, gloss, title, limit = 4) {
  const forms = gloss.flatMap(x => (x.formes || []).map(f => [f, x])).sort((a, b) => b[0].length - a[0].length);
  const used = new Set();
  let n = 0;
  for (const [f, x] of forms) {
    if (n >= limit || used.has(x.terme)) continue;
    const pat = new RegExp(`(?<![${W}'])(${reEsc(escHtml(f))})(?![${W}])`, isUpper(f) ? 'u' : 'iu');
    const parts = html.split(/(<a [^>]*>.*?<\/a>)/);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('<a ') || !pat.test(parts[i])) continue;
      parts[i] = parts[i].replace(pat, (_, m) => `<a class="gl" href="#gl-${slug(x.terme)}" title="${title}">${m}</a>`);
      used.add(x.terme); n++;
      break;
    }
    html = parts.join('');
  }
  return html;
}

async function buildGuide(versions, active, { herePage = null, lang = 'fr' } = {}) {
  const latest = active[0].version;
  const page = herePage || pageName(latest);
  const tpl = read(P(lang === 'en' ? 'src/guide-modele-en.html' : 'src/guide-modele.html'));
  let G = JSON.parse(read(P('src/guide.json')));
  const TX = GUIDE_TXT[lang];
  const t = await template(latest, latest);
  let [menu, labels] = menuStructure(t);
  if (lang === 'en') {
    G = G.en || G;
    const tr = enLabels(t), T = s => tr[s] ?? s;
    labels = Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, T(v)]));
    menu = menu.map(([g, es]) => [T(g), es.map(([e, ks]) => [T(e), ks])]);
  }
  // tabs opened only from a button (no menu entry): placed right after the tab named by "apres" in src/guide.json
  for (const [k, o] of Object.entries(G.onglets)) {
    if (k in labels && o.apres && !menu.some(([, es]) => es.some(([, ks]) => ks.includes(k)))) {
      for (const [, es] of menu) for (const [, ks] of es) if (ks.includes(o.apres)) ks.splice(ks.indexOf(o.apres) + 1, 0, k);
    }
  }
  const covered = new Set(menu.flatMap(([, es]) => es.flatMap(([, ks]) => ks)));
  const missing = [...new Set(Object.keys(labels).filter(k => !(k in G.onglets) || !covered.has(k)))].sort();
  if (missing.length) console.log('WARNING: tabs missing from the guide (src/guide.json or simplified menu):', missing.join(', '));
  const gloss = G.glossaire || [];
  const toc = [`<a href="${TX.other[0]}">${TX.other[1]}</a>`, `<a href="#premiers-pas">${TX.start}</a>`];
  const secs = [`<section class="entry" id="premiers-pas"><h3>${TX.start}</h3><dl class="gen">${G.general.map(([a, b]) => `<dt>${escHtml(a)}</dt><dd>${escHtml(b)}</dd>`).join('')}</dl></section>`];
  for (const [grp, entries] of menu) {
    toc.push(`<span class="tg">${escHtml(grp)}</span>`);
    secs.push(`<h2 class="grp" id="g-${slug(grp)}">${escHtml(grp)}</h2>`);
    for (const [ent, ks] of entries) {
      const eid = 'm-' + slug(ent);
      toc.push(`<a href="#${eid}">${escHtml(ent)}</a>`);
      if (ks.length > 1) toc.push(...ks.map(k => `<a class="sub" href="#o-${k}">${escHtml(labels[k])}</a>`));
      const blocks = ks.map(k => {
        const o = G.onglets[k] || { sert: '' };
        const p = [grp, ent, ...(ks.length > 1 ? [labels[k]] : [])].join(' › ');
        return `<div class="tab" id="o-${k}"><h4>${escHtml(labels[k])}</h4><div class="path">${escHtml(p)}</div><p>${guideLinks(escHtml(o.sert), gloss, TX.gltitle)}</p>`
          + (o.comment?.length ? `<div class="lbl">${TX.how}</div><ul>${o.comment.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul>` : '')
          + (o.astuce ? `<div class="tip"><b>${TX.tip}</b> ${escHtml(o.astuce)}</div>` : '')
          + `<p><a class="go" href="${page}#${k}">${TX.open}</a></p></div>`;
      });
      secs.push(`<section class="entry" id="${eid}"><h3>${escHtml(ent)}</h3>${ks.length > 1 ? `<p class="subs">${escHtml(fmt(TX.subs, ks.map(k => labels[k]).join(', ')))}</p>` : ''}${blocks.join('')}</section>`);
    }
  }
  if (gloss.length) {
    toc.push(`<span class="tg">${TX.gl}</span><a href="#glossaire">${fmt(TX.gltoc, gloss.length)}</a>`);
    const dl = [...gloss].sort((a, b) => (slug(a.terme) < slug(b.terme) ? -1 : slug(a.terme) > slug(b.terme) ? 1 : 0)).map(x =>
      `<dt id="gl-${slug(x.terme)}">${escHtml(x.terme)}</dt><dd>${escHtml(x.def)}`
      + (x.onglets?.length ? ` <span class="voir">${fmt(TX.see, x.onglets.filter(k => k in labels).map(k => `<a href="#o-${k}">${escHtml(labels[k])}</a>`).join(', '))}</span>` : '') + '</dd>').join('');
    secs.push(`<h2 class="grp" id="g-glossaire">${TX.gl}</h2><section class="entry" id="glossaire"><p class="subs">${TX.glintro}</p><dl class="gloss">${dl}</dl></section>`);
  }
  toc.push(`<a class="cl" href="changelog.html">${TX.cl}</a>`);
  let out = rep(tpl, '<!--__VERSION_MENU__-->', versionMenu(versions, 'doc'));
  out = rep(out, '<!--__HOME__-->', page);
  out = rep(out, '<!--__TOC__-->', toc.join(''));
  out = rep(out, '<!--__SECTIONS__-->', secs.join(''));
  return rep(out, '<!--__VERSION__-->', escHtml(latest));
}

// ---------- README: versions table, tabs and badge ----------

function readmeTabs(t, en) {
  if (!t.includes('const TABS = [') || !t.includes('const NAV_GROUPS = [')) return [null, 0];
  const labels = tabLabels(t);
  let navs = t.slice(t.indexOf('const NAV_GROUPS = ['));
  navs = navs.slice(0, navs.indexOf('];'));
  const desc = {};
  for (const v of [...JSON.parse(read(VERSIONS_JSON))].reverse()) for (const o of v.onglets || []) if (Array.isArray(o) && o.length === 2) desc[o[0]] = o[1];
  const tr = en ? enLabels(t) : {}, T = s => tr[s] ?? s;
  const out = [];
  let n = 0;
  for (const [, g1, g2, keys] of navs.matchAll(GROUP)) {
    const ks = [...keys.matchAll(/'(\w+)'/g)].map(m => m[1]).filter(k => k in labels);
    if (!ks.length) continue;
    n += ks.length;
    // English: tab names only (the descriptions are written in French, in versions.json)
    if (en) out.push(`### ${T(g1 || g2)}`, ks.map(k => T(labels[k])).join(' · '), '');
    else out.push(`### ${g1 || g2}`, '| Onglet | À quoi il sert |', '|---|---|', ...ks.map(k => `| **${labels[k]}** | ${(desc[labels[k]] || '').replaceAll('|', '/')} |`), '');
  }
  return [out.join('\n').trimEnd(), n];
}

const splice = (md, a, b, body) => md.slice(0, md.indexOf(a) + a.length) + '\n' + body + '\n' + md.slice(md.indexOf(b));

async function updateReadmes(active) {
  const latest = active[0].version;
  const t = await template(latest, latest);
  for (const [file, en] of [['README.md', false], ['README.en.md', true]]) {
    const f = P(file);
    if (!fs.existsSync(f)) continue;
    let md = read(f);
    const a = '<!-- VERSIONS:START -->', b = '<!-- VERSIONS:END -->';
    if (md.includes(a) && md.includes(b)) {
      const major = latest.split('.')[0];
      const rows = [en ? '| Version | What is new |' : '| Version | Nouveauté |', '|---|---|'];
      active.filter(v => v.version.split('.')[0] === major).forEach((v, i) => rows.push(`| ${i === 0 ? `**${v.version}**` : v.version} | ${v.titre.replaceAll('|', '/')} |`));
      const older = {};
      for (const v of active) { const m = v.version.split('.')[0]; if (m !== major) (older[m] ||= []).push(v); }
      for (const m of Object.keys(older).sort((x, y) => y - x)) {
        const titles = older[m].map(v => v.titre.replaceAll('|', '/')).reverse();
        rows.push(`| ${m}.x | ${titles.slice(0, 5).join(' · ')}${titles.length > 5 ? ' · …' : ''} |`);
      }
      md = splice(md, a, b, rows.join('\n'));
    } else if (!en) console.log(`${file}: VERSIONS markers missing, table not updated`);
    md = md.replace(/badge\/version-[0-9.]+-/g, `badge/version-${latest.replaceAll('-', '--')}-`);
    const [sec, n] = readmeTabs(t, en);
    const ta = '<!-- ONGLETS:START -->', tb = '<!-- ONGLETS:END -->';
    if (sec && md.includes(ta) && md.includes(tb)) {
      md = splice(md, ta, tb, sec);
      md = md.replace(/\*\*\d+ onglets\*\*/g, `**${n} onglets**`).replace(/\*\*\d+ tabs\*\*/g, `**${n} tabs**`);
    }
    write(f, md);
    console.log(`OK -> ${file} (version ${latest}${sec ? `, ${n} tabs` : ''})`);
  }
}

// ---------- Share package ----------

// organisation-specific terms, read from scripts/local/donnees-organisation.json (never committed):
// "neutre" = replacements applied to the package; "a_surveiller" = terms reported if any are left.
export function orgData() {
  try { return JSON.parse(read(P('scripts/local/donnees-organisation.json'))); } catch { return {}; }
}

const LISEZMOI = (v, page) => `3CXplore — version ${v}
${'='.repeat(19 + v.length)}

Ouvrir : double-cliquez sur ${page} (Chrome ou Edge recommandés).
Puis, dans le Tableau de bord, choisissez un backup 3CX (.zip).

Confidentialité
- Le backup est lu entièrement dans votre navigateur : rien n'est envoyé sur Internet.
- Seule exception, désactivable dans l'onglet Interface : au démarrage, l'outil demande
  à GitHub le numéro de la dernière version publiée (aucune donnée du backup n'est envoyée).
- Le backup reste mémorisé dans le navigateur jusqu'à « Fermer le backup »,
  qui permet de choisir ce qui est effacé.
- Les fichiers exportés (CSV, PDF, réglages) vont dans Téléchargements :
  supprimez-les vous-même quand vous n'en avez plus besoin.
- Ne partagez jamais le fichier .zip du backup : il contient les appels,
  enregistrements, messages vocaux et identifiants du système.

Firmwares des téléphones (Mac seulement)
- Double-cliquez sur verifier-firmwares.command pour télécharger la liste officielle
  des firmwares 3CX dans firmwares-3cx.js, puis rechargez la page.
- Au premier lancement, macOS peut bloquer le fichier : clic droit > Ouvrir.

Documentation : documentation.html (guide de l'utilisateur : chaque menu expliqué ; en anglais : documentation-en.html).
Changelog : changelog.html (nouveautés de chaque version).
`;

const README_TXT = (v, page) => `3CXplore — version ${v}
${'='.repeat(19 + v.length)}

Open: double-click ${page} (Chrome or Edge recommended).
Then, in the Dashboard, choose a 3CX backup (.zip). The EN button in the header switches the interface to English.

Privacy
- The backup is read entirely in your browser: nothing is sent over the Internet.
- Only exception, which can be turned off in the Interface tab: at start-up, the tool asks
  GitHub for the number of the latest published version (no backup data is sent).
- The backup stays stored in the browser until "Close the backup",
  which lets you choose what is erased.
- Exported files (CSV, PDF, settings) go to Downloads: delete them yourself when you no longer need them.
- Never share the backup .zip: it contains the system's calls, recordings, voicemails and credentials.

Phone firmwares (Mac only)
- Double-click verifier-firmwares.command to download the official 3CX firmware list
  into firmwares-3cx.js, then reload the page.
- On first launch, macOS may block the file: right-click > Open.

Documentation: documentation-en.html (user guide: every menu explained; in French: documentation.html).
Changelog: changelog.html (what is new in each version, in French).
`;

async function buildPackage(versions, active) {
  const org = orgData();
  const neutralise = h => (org.neutre || []).reduce((s, [a, b]) => rep(s, a, b), h);
  const v = active[0], page = pageName(v.version);
  let html = fixPaths(rep(await template(v.version, v.version), '/*__DATA__*/null', 'null'), 'app');
  html = neutralise(rep(rep(html, '<!--__VERSION_MENU__-->', versionMenu([v], v.version)), '__APP_VERSION__', v.version));
  // share package: opened from a file, no installable app
  html = rep(rep(html, '<link rel="manifest" href="__ROOT__manifest.webmanifest">', ''), '__ROOT__', '');
  const doc = neutralise(buildChangelog(versions, active, [v], new Set([v.version])));
  const guide = neutralise(await buildGuide([v], [v], { herePage: page }));
  const guideEn = neutralise(await buildGuide([v], [v], { herePage: page, lang: 'en' }));
  const left = [...new Set((org.a_surveiller || []).filter(w => [html, doc, guide, guideEn].some(t => t.includes(w))))].sort();
  if (left.length) console.log('WARNING: organisation-specific terms still in the package:', left.join(', '));
  const folder = `visualiseur-3cx-v${v.version}/`;
  const files = {
    [folder + page]: strToU8(html), [folder + 'documentation.html']: strToU8(guide), [folder + 'documentation-en.html']: strToU8(guideEn),
    [folder + 'changelog.html']: strToU8(doc), [folder + 'LISEZMOI.txt']: strToU8(LISEZMOI(v.version, page)), [folder + 'README.txt']: strToU8(README_TXT(v.version, page)),
  };
  for (const [name, src, mode] of [['firmwares-3cx.js', path.join(APP, 'firmwares-3cx.js'), 0o644], ['verifier-firmwares.command', P('scripts/verifier-firmwares.command'), 0o755]]) {
    if (fs.existsSync(src)) files[folder + name] = [fs.readFileSync(src), { os: 3, attrs: (0o100000 | mode) << 16 }];
  }
  const out = path.join(DIST, `visualiseur-3cx-v${v.version}.zip`);
  write(out, zipSync(files, { level: 9 }));
  console.log(`OK -> dist/${path.basename(out)} (${sizeMb(out)} Mo)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildVersions(process.argv.includes('--package')).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}
