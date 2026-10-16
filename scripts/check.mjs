#!/usr/bin/env node
// 3CXplore repository check (run by GitHub on every push, or by hand: mise run check).
//
// Checks:
//   1. no forbidden file is committed (3CX backups, archives, exports, recordings);
//   2. no committed file contains backup data or a secret; if the local file
//      scripts/local/donnees-organisation.json exists (never committed), that the latest version, its
//      sources, the documentation, the READMEs and the scripts contain no organisation-specific term;
//   3. versions.json is complete and every version has a template (src/versions/<n>/modele.html,
//      src/app/ for the latest version, or git tag v<n>), and every file in src/app/ is used;
//   4. every generated page exists and its links (version menu, guide, changelog, firmware list) work;
//   4b. every tab of the latest version is explained in the user guide (src/guide.json);
//   5. the JavaScript of the latest version compiles.
// Exit code 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { BASE, loadVersions, orgData, pageName, tabLabels } from './generate.mjs';
import { inlineScripts } from './vite-inline-scripts.mjs';

process.chdir(BASE);
const errors = [];
const error = msg => { errors.push(msg); console.log('ERROR:', msg); };
const read = f => fs.readFileSync(f, 'utf8');
const isFile = f => fs.existsSync(f) && fs.statSync(f).isFile();
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

// 1) forbidden files
const FORBIDDEN = /(\.zip|\.csv|\.xlsx|\.wav|\.mp3|\.bak|\.db|\.sqlite)$|(^|\/)(backup_extrait|DbTables|dist|build|node_modules)\/|Db\.xml$/i;
for (const f of tracked) if (FORBIDDEN.test(f)) error(`forbidden file in the repository: ${f}`);

// 2) backup data or secrets (patterns split so they do not match themselves)
const org = orgData();
const MARKERS = ['AZURE' + '_USER_ID', 'DESKPHONE' + '_PASSWORD', 'USER_SECRET' + '_2FA', '<' + 'Tenants>', 'BEGIN (RSA |EC |OPENSSH )?' + 'PRIVATE KEY',
  'gh' + 'p_[A-Za-z0-9]{30,}', 'github' + '_pat_[A-Za-z0-9_]{30,}', ...(org.marqueurs || [])].map(p => new RegExp(p));
const text = f => { try { const b = fs.readFileSync(f); return b.includes(0) ? null : b.toString('utf8'); } catch { return null; } };
for (const f of tracked) {
  if (!isFile(f)) continue;
  const t = text(f);
  if (t !== null) for (const m of MARKERS) if (m.test(t)) error(`possible sensitive data (${m.source}) in ${f}`);
}

// 3) versions.json and templates
const { versions, active } = loadVersions();
const latest = active[0].version;
const srcFiles = [];
let latestTemplate = null;
if (isFile(`src/versions/${latest}/modele.html`)) latestTemplate = read(`src/versions/${latest}/modele.html`);
else {
  try {
    const html = inlineScripts(read('src/app/index.html'), path.resolve('src/app'), srcFiles);
    srcFiles.push(path.resolve('src/app/index.html'));
    // stylesheets: index.html links css/styles.css, which @imports the others
    const css = f => { srcFiles.push(f); for (const m of read(f).matchAll(/^@import "([^"]+)";$/gm)) css(path.resolve(path.dirname(f), m[1])); };
    for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)) css(path.resolve('src/app', m[1]));
    latestTemplate = html;
    const used = new Set(srcFiles.map(f => path.relative(BASE, f)));
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of walk('src/app').sort()) if (!used.has(f) && !/\.md$|\.DS_Store$/.test(f)) error(`file in src/app/ not included anywhere: ${f}`);
  } catch (e) { error(`sources of the latest version (src/app/): ${e.message}`); }
}
const seen = new Set();
for (const v of versions) {
  for (const k of ['version', 'date', 'titre', 'resume', 'changements']) if (!v[k] || (Array.isArray(v[k]) && !v[k].length)) error(`versions.json: field "${k}" missing for version ${v.version ?? '?'}`);
  if (seen.has(v.version)) error(`versions.json: version ${v.version} listed twice`);
  seen.add(v.version);
}
for (const v of active.slice(1)) {
  if (isFile(`src/versions/${v.version}/modele.html`)) continue;
  try { execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/v${v.version}`], { stdio: 'ignore' }); }
  catch { error(`template missing: neither src/versions/${v.version}/modele.html nor git tag v${v.version}`); }
}

// 2b) no organisation-specific term in the latest version, its sources and the shared files
if (org.a_surveiller?.length) {
  const own = [`src/versions/${latest}/modele.html`, `app/${pageName(latest)}`, 'app/documentation.html', 'app/documentation-en.html', 'app/changelog.html', 'app/firmwares-3cx.js',
    'src/versions.json', 'src/documentation-modele.html', 'src/guide-modele.html', 'src/guide-modele-en.html', 'src/guide.json', 'README.md', 'README.en.md', 'index.html', '.gitignore',
    '.github/workflows/verification.yml', 'package.json', 'mise.toml', 'vite.config.js', ...srcFiles.map(f => path.relative(BASE, f)),
    ...tracked.filter(f => f.startsWith('scripts/') || f.startsWith('assets/'))];
  for (const f of [...new Set(own)].sort()) {
    if (!isFile(f)) continue;
    const t = text(f);
    if (t === null) continue;
    const left = [...new Set(org.a_surveiller.filter(w => t.includes(w)))].sort();
    if (left.length) error(`organisation-specific term in ${f}: ${left.join(', ')}`);
  }
}

// 4) generated pages and links
const pages = [`app/${pageName(latest)}`, ...active.slice(1).map(v => `app/anciennes-versions/${pageName(v.version)}`), 'app/documentation.html', 'app/documentation-en.html', 'app/changelog.html', 'index.html'];
const LINKS = [/<option value="([^"$]+\.html)"/g, /<a class="open" href="([^"]+\.html)"/g, /<div class="vmenu[^"]*">.*?<a href="([^"]+)">Documentation<\/a>/g,
  /<script src="([^"]*firmwares[^"]*)"/g, /url=([^"]+\.html)"/g, /<a class="(?:go|cl|home)" href="([^"#]+\.html)/g, /<nav class="toc"[^>]*><b>[^<]*<\/b><a href="([^"#]+\.html)"/g];
for (const p of pages) {
  if (!isFile(p)) { error(`page missing: ${p}`); continue; }
  const html = read(p);
  const links = new Set(LINKS.flatMap(re => [...html.matchAll(re)].map(m => m[1])));
  for (const l of links) if (!fs.existsSync(path.normalize(path.join(path.dirname(p), l)))) error(`broken link in ${p}: ${l}`);
}

// 4b) every tab explained in the guide
if (isFile('src/guide.json') && latestTemplate?.includes('const TABS = [') && latestTemplate.includes('const NAV_GROUPS')) {
  const t = latestTemplate, keys = Object.keys(tabLabels(t));
  const G = JSON.parse(read('src/guide.json'));
  const langs = [['French', G.onglets || {}], ['English', G.en?.onglets || {}]];
  for (const [name, g] of langs) {
    const missing = keys.filter(k => !(k in g));
    if (missing.length) error(`${name} user guide (src/guide.json): tabs not explained: ${missing.join(', ')}`);
  }
  // a tab in no menu must say after which tab it is explained ("apres")
  const menuSrc = t.includes('const TAB_BY') ? t.slice(t.indexOf('const NAV_GROUPS'), t.indexOf('const TAB_BY')) : '';
  for (const k of keys) if (menuSrc && !menuSrc.includes(`'${k}'`)) for (const [name, g] of langs) if (!g[k]?.apres) error(`${name} user guide: tab ${k} is in no menu; set "apres" in src/guide.json`);
}
if (isFile('index.html') && !read('index.html').includes(`app/${pageName(latest)}`)) error(`index.html does not lead to the latest version (${latest})`);

// 5) the latest version's JavaScript compiles
if (isFile(pages[0])) {
  const html = read(pages[0]);
  const blocks = [...html.matchAll(/<script type="text\/x-app" id="app">([\s\S]*?)<\/script>/g)].map(m => `(function(D){\n${m[1]}\n})`)
    .concat([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]));
  blocks.forEach((b, i) => { try { new vm.Script(b, { filename: `${pages[0]} (block ${i + 1})` }); } catch (e) { error(`invalid JavaScript in ${pages[0]} (block ${i + 1}): ${e.message}`); } });
}

console.log(`\n${tracked.length} tracked files, ${active.length} versions, ${pages.length} pages checked.`);
if (errors.length) { console.log(`FAILED: ${errors.length} problem(s).`); process.exit(1); }
console.log('OK: no problem found.');
