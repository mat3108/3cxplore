// ---------- Comparaison de la configuration des magasins ----------
// rôle d'un élément : son nom sans le code du magasin (« AB Accueil » -> « accueil »)
const roleOf = name => gsNorm(String(name || '').replace(/^\S+\s+/, '')).replace(/[^a-z0-9]+/g, ' ').trim();
const mode = arr => { const c = {}; arr.forEach(v => { if(v != null && v !== '') c[v] = (c[v] || 0) + 1; }); const e = Object.entries(c).sort((a, b) => b[1] - a[1]); return e.length && e[0][1] > 1 ? e[0][0] : null; };
const med = a => { const s = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function storeProfiles(){
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const by = s => ({groups: FULL.groups.filter(g => !isSysGroup(g) && SEGOF[g.number] === s), queues: FULL.queues.filter(q => SEGOF[q.number] === s), ivrs: FULL.ivrs.filter(i => SEGOF[i.number] === s), exts: FULL.extensions.filter(e => SEGOF[e.number] === s)});
  const P = {};
  stores.forEach(s => {
    const x = by(s), main = x.groups.find(g => rawCode(g.name) === s && roleOf(g.name) === '') || x.groups[0];
    const pc = (arr, f) => arr.length ? Math.round(100 * arr.filter(f).length / arr.length) : null;
    const devs = x.exts.flatMap(e => e.devices);
    P[s] = {
      'Départements': x.groups.length, 'Horaires (département principal)': main ? hoursSummary(main.hours).join(' ; ') || '—' : '—',
      'Pauses': main && main.breakTime?.days?.length ? hoursSummary(main.breakTime).join(' ; ') : '—',
      'Jours fériés configurés': main ? (main.holidayDates || main.holidays || []).length : null,
      'Menus IVR': x.ivrs.length, 'Délai des menus (s, médiane)': med(x.ivrs.map(i => +i.timeout)), 'Sans choix (le plus fréquent)': mode(x.ivrs.map(i => TO_FR[i.timeoutType] || i.timeoutType)) || (x.ivrs[0] ? TO_FR[x.ivrs[0].timeoutType] || x.ivrs[0].timeoutType : '—'),
      "Files d'attente": x.queues.length, 'Sonnerie par agent (s, médiane)': med(x.queues.map(q => +q.ringTimeout)), 'Attente maximale (s, médiane)': med(x.queues.map(q => +q.masterTimeout)),
      'Stratégie (la plus fréquente)': mode(x.queues.map(q => q.strategy)) || (x.queues[0]?.strategy || '—'), 'Agents par file (médiane)': med(x.queues.map(q => q.members.length)),
      'Files avec débordement (%)': pc(x.queues, q => q.dest && q.dest.to !== 'None'), 'Files avec message d\'intro (%)': pc(x.queues, q => q.introEnabled),
      'Annonce de la position (%)': pc(x.queues, q => q.announcePos), 'Postes': x.exts.length, 'Enregistrement activé (%)': pc(x.exts, e => e.record),
      'Messagerie activée (%)': pc(x.exts, e => e.vm), 'Réseau local seulement (%)': pc(x.exts, e => e.lanOnly),
      'Modèles de téléphones': [...new Set(devs.map(d => d.model || d.template))].sort().join(', ') || '—',
      _queues: x.queues, _ivrs: x.ivrs,
    };
  });
  return {stores, P};
}
V.cmpmag = el => {
  const {stores, P} = storeProfiles();
  const attrs = Object.keys(P[stores[0]] || {}).filter(k => k[0] !== '_');
  const num = v => typeof v === 'number';
  // écart : valeur différente de la valeur la plus courante entre les magasins (ou très éloignée de la médiane pour les nombres)
  const devCls = (k, s) => { const vals = stores.map(x => P[x][k]), v = P[s][k]; if(v == null || v === '—') return '';
    if(num(v)){ const m = med(vals); if(m == null) return ''; return Math.abs(v - m) > Math.max(5, 0.5 * m) ? 'dev' : ''; }
    const mo = mode(vals); return mo != null && String(v) !== String(mo) ? 'dev' : ''; };
  // éléments comparables (même rôle dans au moins deux magasins)
  const roles = (key, fields) => { const g = {}; stores.forEach(s => P[s][key].forEach(o => { const r = roleOf(o.name); if(r) (g[r] ||= {})[s] = o; }));
    return Object.entries(g).filter(([, m]) => Object.keys(m).length >= 2).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length || a[0].localeCompare(b[0]))
      .map(([r, m]) => ({role: r, items: m, rows: fields.map(([lbl, f]) => { const vals = Object.values(m).map(f), mo = mode(vals.map(String)); return {lbl, cells: stores.map(s => m[s] ? {v: f(m[s]), dev: mo != null && String(f(m[s])) !== mo, n: m[s].number} : null)}; })})); };
  const qRoles = roles('_queues', [['Sonnerie par agent (s)', q => +q.ringTimeout], ['Attente maximale (s)', q => +q.masterTimeout], ['Stratégie', q => q.strategy], ['Agents', q => q.members.length], ['Débordement', q => q.dest && q.dest.to !== 'None' ? TO_FR[q.dest.to] || q.dest.to : 'aucun'], ['Intro', q => q.introEnabled ? 'oui' : 'non']]);
  const iRoles = roles('_ivrs', [['Délai (s)', i => +i.timeout], ['Sans choix', i => TO_FR[i.timeoutType] || i.timeoutType], ['Touches', i => i.options.length], ['Message', i => i.prompt ? 'oui' : 'aucun']]);
  const head = `<tr><th></th>${stores.map(s => `<th>${esc(segShort(s))}</th>`).join('')}</tr>`;
  const roleTable = (title, list) => list.length ? `<h3>${esc(title)} (${list.length} rôles)</h3>${list.map(R => `<details class="card ccat"${R.rows.some(r => r.cells.some(c => c && c.dev)) ? ' open' : ''}><summary><b>${esc(R.role)}</b> <span class="muted">${Object.keys(R.items).length} magasins</span>${R.rows.some(r => r.cells.some(c => c && c.dev)) ? '<span class="pill warn">écarts</span>' : '<span class="pill ok">identique</span>'}</summary>
    <div class="tw" style="margin:0 12px 12px"><table class="cmpt"><thead>${head}</thead><tbody>${R.rows.map(r => `<tr><th>${esc(r.lbl)}</th>${r.cells.map(c => c ? `<td class="${c.dev ? 'dev' : ''}"><a class="dn" data-dn="${esc(c.n)}">${esc(c.v)}</a></td>` : '<td class="muted">—</td>').join('')}</tr>`).join('')}</tbody></table></div></details>`).join('')}` : '';
  el.innerHTML = `<div id="cmwrap"><h2>Comparaison de la configuration des magasins</h2>
    <p class="lead">La structure de chaque magasin côte à côte, pour repérer les écarts et harmoniser. Une case orange signale une valeur différente de celle de la majorité des magasins (ou un nombre très éloigné de la médiane). Les files et menus sont comparés par rôle : même nom sans le code du magasin (ex. « AB Accueil » et « CD Accueil »). Cliquez une valeur pour ouvrir l'élément.</p>
    <h3>Vue d'ensemble</h3>
    <div class="tw"><table class="cmpt"><thead>${head}</thead><tbody>${attrs.map(k => `<tr><th>${esc(k)}</th>${stores.map(s => { const v = P[s][k]; return `<td class="${devCls(k, s)}">${v == null ? '<span class="muted">—</span>' : esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    ${roleTable("Files d'attente comparables", qRoles)}
    ${roleTable('Menus comparables', iRoles)}
    <p class="note">Les magasins sans élément d'un rôle affichent « — ». Le rattachement des éléments aux magasins suit l'onglet Magasins.</p></div>`;
};

