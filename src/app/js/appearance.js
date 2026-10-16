// Thème : 'light', 'dark' ou automatique (réglage du système) ; mémorisé dans le navigateur
window.applyTheme = t => {
  const r = document.documentElement;
  if(t === 'light' || t === 'dark') r.dataset.theme = t; else r.removeAttribute('data-theme');
  try{ if(t === 'light' || t === 'dark') localStorage.setItem('theme3cx', t); else localStorage.removeItem('theme3cx'); }catch(e){}
  document.querySelectorAll('.themesw button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === ((t === 'light' || t === 'dark') ? t : 'auto'))));
};
// interface par défaut : thème Graphite en mode sombre, menu Dégradé, groupes repliables, compteurs affichés, espacement confortable
window.APP_DEFAULT = {preset: 'graphite', nav: 'degrade', navFold: 'on'};
// première ouverture (aucun réglage d'apparence mémorisé) : on enregistre l'interface par défaut, et le mode sombre si aucun mode n'a été choisi
try{ if(localStorage.getItem('apparence3cx') === null){ localStorage.setItem('apparence3cx', JSON.stringify(window.APP_DEFAULT)); if(localStorage.getItem('theme3cx') === null) localStorage.setItem('theme3cx', 'dark'); } }catch(e){}
try{ const t = localStorage.getItem('theme3cx'); if(t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; }catch(e){}
// apparence : thèmes prêts à l'emploi, couleur principale, densité, taille, coins, cartes, police, largeur, animations (onglet Interface)
window.APP_ACCENTS = [['bleu', 'Bleu', '#2563eb'], ['turquoise', 'Turquoise', '#0d9488'], ['vert', 'Vert', '#15803d'], ['violet', 'Violet', '#7c3aed'], ['indigo', 'Indigo', '#4338ca'], ['orange', 'Orange', '#c2410c'], ['rouge', 'Rouge', '#b91c1c'], ['rose', 'Rose', '#be185d'], ['graphite', 'Graphite', '#475569']];
// [clé, nom, description, couleurs claires, couleurs sombres, mode conseillé]
window.APP_PRESETS = [
  ['classique', 'Classique', 'Blanc et bleu, le style d\'origine.', null, null],
  ['ocean', 'Océan', 'Fond légèrement bleuté, turquoise.', {bg: '#eef6f8', panel: '#ffffff', panel2: '#e3f0f3', text: '#12262e', muted: '#557079', line: '#d3e4e8', accent: '#0e7490', 'accent-soft': '#dff2f7', 'c-in': '#0e7490'},
    {bg: '#0b171c', panel: '#10212a', panel2: '#152b35', text: '#e2eef2', muted: '#8fa9b2', line: '#1f3a45', accent: '#22d3ee', 'accent-soft': '#12303b', 'c-in': '#22d3ee'}],
  ['foret', 'Forêt', 'Tons verts doux et reposants.', {bg: '#f2f6f1', panel: '#ffffff', panel2: '#e8efe6', text: '#18241a', muted: '#5d6e60', line: '#dbe5d8', accent: '#2f7d32', 'accent-soft': '#e3f1e3', 'c-in': '#2f7d32'},
    {bg: '#0f1510', panel: '#162018', panel2: '#1c281e', text: '#e4ece4', muted: '#93a596', line: '#27362a', accent: '#6fcf73', 'accent-soft': '#1d3320', 'c-in': '#6fcf73'}],
  ['sable', 'Sable', 'Fond crème chaud, orange brûlé.', {bg: '#faf6ef', panel: '#fffdf9', panel2: '#f3ece0', text: '#2a2118', muted: '#7a6a58', line: '#e8dfd0', accent: '#c2410c', 'accent-soft': '#fbe9dc', 'c-in': '#c2410c'},
    {bg: '#17130e', panel: '#201a13', panel2: '#2a2219', text: '#f0e9df', muted: '#ab9d8b', line: '#3a3024', accent: '#fb923c', 'accent-soft': '#3a2516', 'c-in': '#fb923c'}],
  ['ardoise', 'Ardoise', 'Gris neutres, très sobre.', {bg: '#f4f5f7', panel: '#ffffff', panel2: '#eceef1', text: '#1e2329', muted: '#64707d', line: '#dde1e6', accent: '#475569', 'accent-soft': '#e7eaee', 'c-in': '#475569'},
    {bg: '#121417', panel: '#1a1d21', panel2: '#22262b', text: '#e5e7ea', muted: '#9aa3ad', line: '#2d3238', accent: '#94a3b8', 'accent-soft': '#262c33', 'c-in': '#94a3b8'}],
  ['nuit', 'Nuit', 'Sombre profond et indigo (passe en thème sombre).', {bg: '#eef0fb', panel: '#ffffff', panel2: '#e4e7f7', text: '#171a33', muted: '#5d6386', line: '#d8dcf0', accent: '#4338ca', 'accent-soft': '#e5e6fb', 'c-in': '#4338ca'},
    {bg: '#0b0d1a', panel: '#12152a', panel2: '#181c36', text: '#e5e7fb', muted: '#9499c2', line: '#252a4a', accent: '#818cf8', 'accent-soft': '#1e2350', 'c-in': '#818cf8'}, 'dark'],
  ['contraste', 'Contraste élevé', 'Noir et blanc, couleurs franches, pour la lisibilité.', {bg: '#ffffff', panel: '#ffffff', panel2: '#f0f0f0', text: '#000000', muted: '#2b2b2b', line: '#000000', accent: '#0033cc', 'accent-soft': '#dde5ff', ok: '#006400', 'ok-soft': '#dff3df', warn: '#7a4300', 'warn-soft': '#fff0d6', bad: '#b00000', 'bad-soft': '#ffe0e0', 'c-in': '#0033cc', shadow: 'none'},
    {bg: '#000000', panel: '#000000', panel2: '#141414', text: '#ffffff', muted: '#e0e0e0', line: '#ffffff', accent: '#ffd400', 'accent-soft': '#332b00', ok: '#4dff4d', 'ok-soft': '#0b2b0b', warn: '#ffb000', 'warn-soft': '#2e2000', bad: '#ff6b6b', 'bad-soft': '#330d0d', 'c-in': '#ffd400', shadow: 'none'}]];
// thèmes « geek » : refonte complète (police à chasse fixe, néon, grille, lignes de balayage) — [clé, nom, description, couleurs, couleurs, mode, 'geek']
(() => {
  const T = {bg: '#050a05', panel: '#0a120a', panel2: '#0f1a0f', text: '#b6ffb0', muted: '#5fa85a', line: '#1d3a1b', accent: '#39ff14', 'accent-soft': '#0f2a0c', ok: '#39ff14', 'ok-soft': '#0f2a0c', warn: '#e6ff3d', 'warn-soft': '#2a2e0a', bad: '#ff4d4d', 'bad-soft': '#2e0d0d', 'c-in': '#39ff14', 'c-out': '#7dffd4', 'c-int': '#3d6b3a', 'k-dept': '#7dffd4', 'k-rg': '#e6ff3d', 'k-xt': '#39ff14', shadow: 'none', grid: 'rgba(57,255,20,.05)'};
  const C = {bg: '#0d0221', panel: '#140533', panel2: '#1c0a45', text: '#e8e2ff', muted: '#9d8cc9', line: '#3b1f73', accent: '#00f0ff', 'accent-soft': '#0a2a4a', ok: '#00ff9f', 'ok-soft': '#0a3326', warn: '#fcee0a', 'warn-soft': '#3a3305', bad: '#ff2a6d', 'bad-soft': '#3d0a1f', 'c-in': '#00f0ff', 'c-out': '#ff2a6d', 'c-int': '#7a5fc9', 'k-dept': '#ff2a6d', 'k-rg': '#fcee0a', 'k-xt': '#00f0ff', shadow: 'none', grid: 'rgba(255,42,109,.06)'};
  const A = {bg: '#0c0700', panel: '#140c02', panel2: '#1c1205', text: '#ffcf8a', muted: '#b07a2e', line: '#3a2508', accent: '#ffb000', 'accent-soft': '#2e1f02', ok: '#ffd36b', 'ok-soft': '#2a2008', warn: '#ff8c1a', 'warn-soft': '#331a05', bad: '#ff5a36', 'bad-soft': '#330f08', 'c-in': '#ffb000', 'c-out': '#ffd36b', 'c-int': '#7a5420', 'k-dept': '#ffd36b', 'k-rg': '#ff8c1a', 'k-xt': '#ffb000', shadow: 'none', grid: 'rgba(255,176,0,.05)'};
  const D = {bg: '#1e1f29', panel: '#282a36', panel2: '#303241', text: '#f8f8f2', muted: '#a4a8c6', line: '#44475a', accent: '#bd93f9', 'accent-soft': '#3a3456', ok: '#50fa7b', 'ok-soft': '#1f3a2a', warn: '#f1fa8c', 'warn-soft': '#3a3b23', bad: '#ff5555', 'bad-soft': '#3d2228', 'c-in': '#bd93f9', 'c-out': '#8be9fd', 'c-int': '#6272a4', 'k-dept': '#ff79c6', 'k-rg': '#ffb86c', 'k-xt': '#8be9fd', shadow: 'none', grid: 'rgba(189,147,249,.05)'};
  const S = {bg: '#f7f3ff', panel: '#ffffff', panel2: '#efe8ff', text: '#1b1440', muted: '#6b5f99', line: '#d9cff5', accent: '#d6008f', 'accent-soft': '#fbe0f3', ok: '#008f6b', 'ok-soft': '#dcf5ec', warn: '#b36b00', 'warn-soft': '#fdf0d6', bad: '#d6003a', 'bad-soft': '#ffe0e8', 'c-in': '#6b2cff', 'c-out': '#d6008f', 'c-int': '#a59ccc', 'k-dept': '#6b2cff', 'k-rg': '#d6008f', 'k-xt': '#008f9b', shadow: 'none', grid: 'rgba(107,44,255,.07)'};
  const SD = {...S, bg: '#140a2e', panel: '#1c1040', panel2: '#251652', text: '#f1eaff', muted: '#a596d6', line: '#3b2a75', accent: '#ff4fc3', 'accent-soft': '#3d1446', 'c-in': '#9d7bff', 'ok-soft': '#0d3329', 'warn-soft': '#3a2a0a', 'bad-soft': '#3d0a1f', grid: 'rgba(255,79,195,.06)'};
  window.APP_PRESETS.push(
    ['terminal', 'Terminal', 'Vert phosphore sur noir, façon vieux terminal.', T, T, 'dark', 'geek'],
    ['cyberpunk', 'Cyberpunk', 'Néon cyan et magenta sur violet nuit.', C, C, 'dark', 'geek'],
    ['ambre', 'Ambre', 'Orange ambre sur noir, moniteur des années 80.', A, A, 'dark', 'geek'],
    ['dracula', 'Dracula', 'Violet, rose et vert, le thème préféré des développeurs.', D, D, 'dark', 'geek'],
    ['synthwave', 'Synthwave clair', 'Papier quadrillé, encre bleu nuit et touches néon.', S, SD, 'light', 'geek']);
})();
// thèmes modernes et raffinés — [clé, nom, description, couleurs claires, couleurs sombres, mode, 'raffine' | 'raffine-serif']
window.APP_PRESETS.push(
  ['minimal', 'Minimal', 'Blanc pur, noir et gris, épuré.', {bg: '#fafafa', panel: '#ffffff', panel2: '#f4f4f5', text: '#18181b', muted: '#71717a', line: '#e4e4e7', accent: '#18181b', 'accent-soft': '#f4f4f5', 'c-in': '#3f3f46', 'on-accent': '#ffffff'},
    {bg: '#09090b', panel: '#111113', panel2: '#18181b', text: '#fafafa', muted: '#a1a1aa', line: '#27272a', accent: '#fafafa', 'accent-soft': '#27272a', 'c-in': '#d4d4d8', 'on-accent': '#09090b'}, null, 'raffine'],
  ['graphite', 'Graphite', 'Anthracite et violet discret, façon applications pro récentes.', {bg: '#f7f7f8', panel: '#ffffff', panel2: '#f0f0f2', text: '#1d1d22', muted: '#6c6c78', line: '#e3e3e8', accent: '#5e5ce6', 'accent-soft': '#ececfd', 'c-in': '#5e5ce6'},
    {bg: '#0e0e11', panel: '#16161a', panel2: '#1d1d22', text: '#ececf1', muted: '#8b8b98', line: '#26262d', accent: '#8b89ff', 'accent-soft': '#25244a', 'c-in': '#8b89ff'}, 'dark', 'raffine'],
  ['nordique', 'Nordique', 'Bleus et gris froids, palette « Nord ».', {bg: '#eceff4', panel: '#f8f9fb', panel2: '#e5e9f0', text: '#2e3440', muted: '#5e6a7e', line: '#d8dee9', accent: '#5e81ac', 'accent-soft': '#dfe7f1', ok: '#5b8a4e', 'ok-soft': '#e3ecdc', warn: '#b7823b', 'warn-soft': '#f3e8d6', bad: '#bf616a', 'bad-soft': '#f3dfe1', 'c-in': '#5e81ac', 'c-out': '#88c0d0'},
    {bg: '#2e3440', panel: '#3b4252', panel2: '#434c5e', text: '#eceff4', muted: '#a5b0c2', line: '#4c566a', accent: '#88c0d0', 'accent-soft': '#3d5566', ok: '#a3be8c', 'ok-soft': '#3b4a3c', warn: '#ebcb8b', 'warn-soft': '#4d4636', bad: '#bf616a', 'bad-soft': '#4b3a41', 'c-in': '#88c0d0', 'c-out': '#81a1c1', 'on-accent': '#2e3440'}, 'dark', 'raffine'],
  ['marine', 'Marine & or', 'Bleu marine profond et touches dorées, très corporatif.', {bg: '#f5f7fa', panel: '#ffffff', panel2: '#edf1f7', text: '#0f1f3d', muted: '#5c6b85', line: '#dfe5ee', accent: '#1e3a6e', 'accent-soft': '#e4eaf5', warn: '#a8730b', 'c-in': '#1e3a6e', 'c-out': '#c9a227', 'k-dept': '#c9a227'},
    {bg: '#0a1324', panel: '#0f1b33', panel2: '#15233f', text: '#e8edf6', muted: '#9aa8c2', line: '#22324f', accent: '#d4af37', 'accent-soft': '#2f2a14', 'c-in': '#d4af37', 'c-out': '#6d8fd1', 'k-dept': '#d4af37', 'on-accent': '#0a1324'}, null, 'raffine'],
  ['ivoire', 'Ivoire & bordeaux', 'Fond ivoire, accent bordeaux, titres à empattements.', {bg: '#faf7f2', panel: '#fffdf9', panel2: '#f3eee6', text: '#2b2321', muted: '#7b6e66', line: '#e7dfd4', accent: '#8c1c3a', 'accent-soft': '#f6e4e8', 'c-in': '#8c1c3a'},
    {bg: '#17110f', panel: '#201816', panel2: '#2a201d', text: '#f3ebe4', muted: '#b3a59b', line: '#3a2d29', accent: '#e07a96', 'accent-soft': '#3a1e26', 'c-in': '#e07a96', 'on-accent': '#17110f'}, null, 'raffine-serif'],
  ['lavande', 'Lavande', 'Tons pastel doux et apaisants.', {bg: '#f8f7fd', panel: '#ffffff', panel2: '#f1eefb', text: '#25213a', muted: '#6f6a8a', line: '#e6e2f5', accent: '#7c5cdb', 'accent-soft': '#efeafd', ok: '#2f9e6e', 'ok-soft': '#e5f6ee', 'c-in': '#7c5cdb'},
    {bg: '#14121f', panel: '#1b1829', panel2: '#232036', text: '#ece9fb', muted: '#a6a1c4', line: '#2f2b48', accent: '#b4a0ff', 'accent-soft': '#2c2550', 'c-in': '#b4a0ff', 'on-accent': '#14121f'}, null, 'raffine'],
  ['solarise', 'Solarisé', 'La palette classique des éditeurs de code.', {bg: '#fdf6e3', panel: '#fffbee', panel2: '#eee8d5', text: '#073642', muted: '#657b83', line: '#e4dcc4', accent: '#268bd2', 'accent-soft': '#e3eef5', ok: '#859900', 'ok-soft': '#eef0d6', warn: '#b58900', 'warn-soft': '#f6ecd0', bad: '#dc322f', 'bad-soft': '#f9e0dc', 'c-in': '#268bd2', 'c-out': '#2aa198'},
    {bg: '#002b36', panel: '#073642', panel2: '#0b4050', text: '#eee8d5', muted: '#93a1a1', line: '#124b59', accent: '#4ea4e6', 'accent-soft': '#0e4459', ok: '#a3b81a', 'ok-soft': '#1d3d2a', warn: '#d9a514', 'warn-soft': '#3b3a1c', bad: '#ef5350', 'bad-soft': '#3d1f24', 'c-in': '#4ea4e6', 'c-out': '#2aa198', 'on-accent': '#002b36'}, null, 'raffine']);
window.APP_HOMES = [['dashboard', 'Tableau de bord'], ['priorites', 'Priorités'], ['sante', 'Note de santé'], ['reco', 'Recommandations'], ['actions', 'Actions console'], ['stats', 'Statistiques'], ['rappels', 'Appels manqués']];
window.loadAppearance = () => { try{ const v = localStorage.getItem('apparence3cx'); return v === null ? {...window.APP_DEFAULT} : (JSON.parse(v) || {}); }catch(e){ return {...window.APP_DEFAULT}; } };
window.applyAppearance = a => {
  if(a === undefined) a = window.loadAppearance();
  let st = document.getElementById('apparence'); if(!st){ st = document.createElement('style'); st.id = 'apparence'; document.head.appendChild(st); }
  const vars = o => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
  const blocks = (L, Dk) => `:root{${L}}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${Dk}}}:root[data-theme="dark"]{${Dk}}`;
  let css = '';
  const p = (window.APP_PRESETS.find(x => x[0] === a.preset) || [])[3] ? window.APP_PRESETS.find(x => x[0] === a.preset) : null;
  if(p) css += blocks(vars(p[3]), vars(p[4]));
  const geek = !!(p && p[6] === 'geek'), root = document.documentElement;
  const raf = !!(p && /^raffine/.test(p[6] || ''));
  root.classList.toggle('raffine', raf); root.classList.toggle('serif-titles', !!(p && p[6] === 'raffine-serif'));
  root.classList.toggle('geek', geek);
  [...root.classList].filter(c => c.startsWith('nav-')).forEach(c => root.classList.remove(c));
  if(a.nav && a.nav !== 'classique') root.classList.add('nav-' + a.nav);
  root.classList.toggle('navfold', a.navFold === 'on'); root.classList.toggle('nocount', a.navCount === 'off'); root.classList.toggle('navtight', a.navSpace === 'serre'); root.classList.toggle('scan', geek && a.scan !== 'off'); root.classList.toggle('geek-light', geek && p[5] === 'light');
  const c = /^#[0-9a-f]{6}$/i.test(a.accent || '') ? a.accent.toLowerCase() : null;
  if(c && !(c === '#2563eb' && !p))
    css += blocks(`--accent:${c};--accent-soft:color-mix(in srgb,${c} 13%,var(--panel));--c-in:${c}`, `--accent:color-mix(in srgb,${c} 62%,#fff);--accent-soft:color-mix(in srgb,${c} 24%,var(--panel));--c-in:color-mix(in srgb,${c} 62%,#fff)`);
  if(a.density === 'compact') css += 'th,td{padding:4px 8px}.card{padding:10px 12px}main{padding:12px 16px 40px}';
  const z = {s: .92, l: 1.1, xl: 1.2}[a.size]; if(z) css += `main{zoom:${z}}`;
  const R = {carre: '3px', doux: '14px'}[a.radius]; if(R) css += `.card,.btn,.pill,.tw,input,select,textarea,.kpi,.uiopt,.uicust,#drawer,.vmenu select{border-radius:${R}!important}`;
  if(a.cards === 'bordure') css += '.card{box-shadow:none!important}';
  if(a.cards === 'plat') css += '.card{box-shadow:none!important;border-color:transparent!important;background:var(--panel2)!important}.card .card{background:var(--panel)!important}';
  const F = {arrondie: 'ui-rounded,"SF Pro Rounded","Nunito","Varela Round",-apple-system,"Segoe UI",sans-serif', serif: 'ui-serif,"Iowan Old Style","Palatino Linotype",Georgia,serif', mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'}[a.font];
  if(F) css += `html,body{font-family:${F}}`;
  if(a.width === 'large') css += 'main{max-width:none}';
  if(a.motion === 'reduit') css += '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}';
  st.textContent = css;
};
try{ window.applyAppearance(); }catch(e){}
window.APP_NAVSTYLES = [['classique', 'Classique', 'Le menu d\'origine.'], ['pilules', 'Pilules', 'Éléments arrondis, onglet actif en couleur pleine.'], ['trait', 'Trait indicateur', 'Fin trait de couleur à gauche, très sobre.'],
  ['pastilles', 'Icônes en pastilles', 'Une couleur par groupe, façon Réglages de macOS.'], ['sombre', 'Menu sombre', 'Toujours sombre, même en thème clair.'], ['ilot', 'Îlot flottant', 'Détaché du bord, coins arrondis et ombre.'], ['degrade', 'Dégradé', 'Fond dégradé discret, onglet actif en verre.']];
// groupes du menu repliables (si l'option est active) ; état mémorisé
document.addEventListener('click', e => {
  const ng = e.target.closest('#nav .ng'); if(!ng || !document.documentElement.classList.contains('navfold') || document.body.classList.contains('mini')) return;
  const g = ng.closest('.ngrp'); if(!g) return; g.classList.toggle('closed');
  try{ localStorage.setItem('navgroupes3cx', JSON.stringify([...document.querySelectorAll('#nav .ngrp.closed')].map(x => x.dataset.gi))); }catch(er){}
});
