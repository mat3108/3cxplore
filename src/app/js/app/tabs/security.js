// ---------- Sécurité ----------
const SEC_ROLES = {system_owners: [6, 'Propriétaire du système', 'bad'], system_admins: [5, 'Administrateur du système', 'bad'], group_owners: [4, 'Propriétaire de département', 'warn'],
  managers: [3, 'Gestionnaire', 'warn'], supervisors: [2, 'Superviseur', 'acc'], receptionists: [1, 'Réceptionniste', ''], observers: [1, 'Observateur', '']};
const secRole = r => SEC_ROLES[r] || [0, r, ''];
// MFA d'un poste : 'on' double authentification 3CX ; 'ms' compte relié à Microsoft 365 avec la connexion Microsoft active
// (le MFA est alors imposé par Microsoft) ; 'req' exigée par 3CX mais pas configurée ; 'off' aucun
function mfaOf(e){
  const p = e.props || {}, upn = p.AZURE_UPN || e.azure || '', linked = p.AZURE_AD_USER === '1' || !!upn, ssoOff = p.MS365_DISABLE_SSO === '1';
  if(p.ENABLE_2FA === '1') return {k: 'on', upn, why: 'Double authentification 3CX activée'};
  if(linked && !ssoOff) return {k: 'ms', upn, why: 'Connexion par Microsoft 365' + (upn ? ' (' + upn + ')' : '') + ' : MFA géré par Microsoft'};
  const why = linked && ssoOff ? 'Relié à Microsoft 365, mais la connexion Microsoft est désactivée pour ce poste' : 'Non relié à Microsoft 365 et sans double authentification 3CX';
  return {k: p.REQUIRE_2FA === '1' ? 'req' : 'off', upn, why: p.REQUIRE_2FA === '1' ? why + ' (double authentification 3CX exigée, pas encore configurée)' : why, ssoOff: linked && ssoOff};
}
const MFA_L = {on: ['MFA 3CX', 'ok'], ms: ['MFA Microsoft 365', 'ok'], req: ['Exigée, pas configurée', 'warn'], off: ['Sans MFA', 'bad']};
const isPrivIP = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1|fe80)/.test(ip || '');
function secAnalysis(){
  const E = FULL.extensions, endISO = FULL.calls.length ? FULL.calls[0][0] : new Date().toISOString();
  const logins = (FULL.audit || []).filter(a => a[1] === 'Connexion');
  const end = logins.length && logins[0][0] > endISO ? logins[0][0] : endISO;
  const lastLogin = {}, userIPs = {};
  logins.forEach(a => { const u = String(a[3]).split(' ')[0]; if(!lastLogin[u]) lastLogin[u] = a[0]; (userIPs[u] ||= new Set()).add(a[5]); });
  // comptes à droits élevés (rôle le plus élevé parmi les départements, hors favoris)
  const elevated = E.map(e => {
    const gs = e.groups.filter(g => !/^___FAVORITES/.test(g.g) && g.role && g.role !== 'users');
    if(!gs.length) return null;
    const top = gs.reduce((a, g) => secRole(g.role)[0] > secRole(a.role)[0] ? g : a, gs[0]);
    const topGroups = gs.filter(g => g.role === top.role).map(g => g.g);
    const mf = mfaOf(e), fa = mf.k;
    return {e, role: top.role, rank: secRole(top.role)[0], global: topGroups.includes('__DEFAULT__'), groups: topGroups.filter(g => !/^(__|SYSTEM$)/.test(g)), fa,
      last: lastLogin[e.number] || null, ips: userIPs[e.number] ? userIPs[e.number].size : 0, lan: e.lanOnly, seg: SEGOF[e.number] || SEG_COMMON};
  }).filter(Boolean).sort((a, b) => b.rank - a.rank || a.e.number.localeCompare(b.e.number));
  // renvois vers des numéros externes
  const fwd = [];
  E.forEach(e => { const ps = e.profiles.map(p => ({p, ext: [...new Set(p.routes.filter(r => r[1] && r[1].to === 'External' && r[1].ext).map(r => r[1].ext))]})).filter(x => x.ext.length || x.p.ringMobile === 'True');
    if(ps.length) fwd.push({e, seg: SEGOF[e.number] || SEG_COMMON, current: e.profile, profiles: ps, nums: [...new Set(ps.flatMap(x => x.ext))], active: ps.some(x => x.p.name === e.profile), mobile: ps.some(x => x.p.ringMobile === 'True')}); });
  // connexions par adresse IP
  const lim14 = new Date(Date.parse(end) - 14 * 864e5).toISOString(), ipm = {};
  logins.forEach(a => { const ip = a[5] || '—', m = ipm[ip] ||= {ip, n: 0, users: {}, first: a[0], last: a[0], night: 0};
    m.n++; const u = a[3] || '—'; m.users[u] = (m.users[u] || 0) + 1; if(a[0] < m.first) m.first = a[0]; if(a[0] > m.last) m.last = a[0];
    const h = localParts(a[0])[1]; if(h >= 22 || h < 6) m.night++; });
  const ips = Object.values(ipm).map(m => ({...m, priv: isPrivIP(m.ip), isNew: m.first >= lim14, rare: m.n <= 3})).sort((a, b) => b.n - a.n);
  // changements sensibles dans le journal
  const SENS_F = /2FA|LAN_ONLY|LanOnly|BlockTunnel|REMOTETUNNEL|AccessType|MC_ACCESS|SystemAdmin|SYSTEM_ADMIN|International/i;
  const roles = v => (String(v).match(/RoleName"?:\s*"([^"]+)/g) || []).sort().join('|');
  const ELEV = /system_owners|system_admins|group_owners|managers|supervisors/;
  const roleChg = c => c[0] === 'Groups' && roles(c[1]) !== roles(c[2]) && (ELEV.test(roles(c[1])) || ELEV.test(roles(c[2])));
  // champ sensible réellement changé (valeurs avant et après connues)
  const sensChg = c => SENS_F.test(c[0]) && c[1] !== '' && c[2] !== '' && c[1] !== c[2];
  const sens = (FULL.audit || []).filter(a => a[1] !== 'Connexion' && (a[1] === 'Action 21' || a[2] === '46' || a[6].some(c => sensChg(c) || roleChg(c))))
    .map(a => ({a, kind: a[1] === 'Action 21' ? 'Identifiants réinitialisés / bienvenue' : a[2] === '46' ? 'Liste de blocage IP' : 'Droits ou accès modifiés',
      what: a[1] === 'Action 21' ? a[6].filter(c => /true/i.test(c[2])).map(c => c[0]).join(', ') : a[6].filter(c => sensChg(c) || roleChg(c)).map(c => c[0] === 'Groups' ? 'Rôle dans un département' : c[0]).join(', ') || a[4]}));
  // appels internationaux
  const intl = FULL.outbound.filter(o => (o.prefix || '').split(',').some(p => /^(011|00)/.test(p.trim())) || (o.lengths || '').split(',').some(l => +l >= 12));
  const intlCalls = FULL.calls.filter(c => c[1] === 'out' && /^(011|00|\+(?!1))/.test(String(c[4]))).length;
  return {elevated, fwd, ips, logins, sens, intl, intlCalls, end};
}
V.securite = el => {
  const S = secAnalysis(), inSeg = r => !SEG || r.seg === SEG;
  const elev = S.elevated.filter(inSeg), fwd = S.fwd.filter(inSeg), remote = FULL.extensions.filter(e => !e.lanOnly && (!SEG || SEGOF[e.number] === SEG));
  const admins = elev.filter(r => r.rank >= 5), adminNo2fa = admins.filter(r => r.fa !== 'on' && r.fa !== 'ms'), mgrNo2fa = elev.filter(r => r.rank >= 3 && r.rank < 5 && r.fa !== 'on' && r.fa !== 'ms');
  // MFA de tous les postes (Microsoft 365 ou 3CX)
  const allExt = FULL.extensions.filter(e => !SEG || SEGOF[e.number] === SEG).map(e => ({e, m: mfaOf(e), seg: SEGOF[e.number] || SEG_COMMON}));
  const mfaCnt = k => allExt.filter(x => x.m.k === k).length, noMfa = allExt.filter(x => x.m.k === 'off' || x.m.k === 'req');
  const pubIPs = S.ips.filter(m => !m.priv);
  const findings = [];
  if(adminNo2fa.length) findings.push(['bad', `${adminNo2fa.length} compte${adminNo2fa.length > 1 ? 's' : ''} propriétaire ou administrateur du système sans MFA (ni Microsoft 365 ni 3CX)`, 'Relier ces comptes à Microsoft 365 avec la connexion Microsoft active, ou activer la double authentification 3CX.']);
  if(admins.length > 4) findings.push(['warn', `${admins.length} comptes ont l'accès complet au système (propriétaires / administrateurs)`, 'Limiter ce rôle aux personnes qui administrent réellement le système ; donner le rôle Gestionnaire pour la gestion d\'un département.']);
  if(mgrNo2fa.length) findings.push(['warn', `${mgrNo2fa.length} gestionnaire${mgrNo2fa.length > 1 ? 's' : ''} sans MFA (ni Microsoft 365 ni 3CX)`, 'Les gestionnaires peuvent modifier la configuration de leurs départements : relier leur compte à Microsoft 365 ou activer la double authentification 3CX.']);
  if(S.intl.length && !S.intlCalls) findings.push(['warn', 'Appels internationaux autorisés, mais aucun appel international dans l\'historique', 'Désactiver ou restreindre la règle sortante internationale (risque de fraude téléphonique si un compte est compromis), ou la limiter à quelques postes.']);
  if(noMfa.length) findings.push(['warn', `${noMfa.length} poste${noMfa.length > 1 ? 's' : ''} sans MFA (ni Microsoft 365 ni 3CX)`, `Postes non reliés à Microsoft 365${allExt.some(x => x.m.ssoOff) ? ` ou dont la connexion Microsoft est désactivée (${allExt.filter(x => x.m.ssoOff).length})` : ''} : leurs utilisateurs se connectent au client Web avec le seul mot de passe 3CX. Ce sont souvent des postes partagés (garage, sonnette, vacant) où personne ne se connecte : le risque porte surtout sur les comptes nominatifs.`]);
  if(fwd.some(r => r.active)) findings.push(['acc', `${fwd.filter(r => r.active).length} poste${fwd.filter(r => r.active).length > 1 ? 's' : ''} renvoient actuellement des appels vers un numéro externe`, 'Vérifier que ces numéros sont connus (cellulaires professionnels) : chaque renvoi externe utilise une ligne et peut faire sortir des appels de clients.']);
  if(pubIPs.some(m => m.isNew)) findings.push(['acc', `${pubIPs.filter(m => m.isNew).length} nouvelle${pubIPs.filter(m => m.isNew).length > 1 ? 's' : ''} adresse${pubIPs.filter(m => m.isNew).length > 1 ? 's' : ''} Internet de connexion dans les 14 derniers jours`, 'Vérifier qu\'elles correspondent à des sites ou des employés connus.']);
  const faPill = (f, e) => `<span class="pill ${MFA_L[f][1]}" title="${esc(e ? mfaOf(e).why : '')}">${MFA_L[f][0]}</span>`;
  el.innerHTML = `<div id="secwrap"><h2>Sécurité</h2>
    <div class="bar noprint"><button class="btn primary" id="secrep">Aperçu du rapport de sécurité</button><button class="btn" id="secpr" hidden>Imprimer / PDF</button><span class="muted" style="font-size:12.5px">Document complet (sans pagination) avec un résumé, pour la direction ou un audit.</span></div>
    <div id="secreport" hidden></div>
    <p class="lead">Qui a des droits d'administration, double authentification, renvois vers l'extérieur, connexions au client Web et à la console, et changements sensibles du journal d'audit${SEG ? ` — magasin <b>${esc(segName(SEG))}</b> (les connexions et changements sensibles restent ceux de tout le système)` : ''}. Les mots de passe et clés ne sont jamais lus ni affichés.</p>
    <div class="grid kpis">${[['Accès complet au système', nf(admins.length), admins.length > 4 ? 'warn' : ''], ['… sans MFA', nf(adminNo2fa.length), adminNo2fa.length ? 'bad' : 'ok'], ['Postes avec MFA Microsoft 365', nf(mfaCnt('ms')), 'ok'], ['Postes sans MFA', nf(noMfa.length), noMfa.length ? 'warn' : 'ok'], ['Gestionnaires et superviseurs', nf(elev.filter(r => r.rank >= 2 && r.rank < 5).length), ''],
      ['Renvois vers l\'extérieur', nf(fwd.length), fwd.length ? 'warn' : ''], ['Postes autorisés hors réseau local', nf(remote.length), ''], ['Adresses Internet de connexion', nf(pubIPs.length), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${findings.length ? `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">À vérifier</h3>${findings.map(([c, t, r]) => `<div style="margin:8px 0"><span class="pill ${c}">${c === 'bad' ? 'Important' : c === 'warn' ? 'À corriger' : 'À vérifier'}</span> <b>${esc(t)}</b><div class="muted" style="font-size:12.5px">${esc(r)}</div></div>`).join('')}</div>` : ''}
    <h3>MFA de tous les postes</h3>
    <div class="card"><div class="mfabar">${[['ms', mfaCnt('ms')], ['on', mfaCnt('on')], ['req', mfaCnt('req')], ['off', mfaCnt('off')]].filter(x => x[1]).map(([k, v]) => `<span class="${MFA_L[k][1]}" style="flex:${v}" title="${MFA_L[k][0]} : ${v}">${MFA_L[k][0]} · ${nf(v)}</span>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin:8px 0 0">« MFA Microsoft 365 » : poste relié à un compte Microsoft (Entra ID) avec la connexion Microsoft active ; le MFA est alors imposé par Microsoft (règles du tenant, non visibles dans le backup 3CX : à vérifier dans Microsoft Entra, accès conditionnel). « Sans MFA » : poste non relié à Microsoft 365, ou connexion Microsoft désactivée pour ce poste, et sans double authentification 3CX.</p></div>
    ${noMfa.length ? `<h3>Postes sans MFA (${noMfa.length})</h3><div id="sect0"></div>` : ''}
    <h3>Comptes avec des droits élevés (${elev.length})</h3><div id="sect1"></div>
    <p class="note">Rôle le plus élevé du poste dans ses départements. « Système entier » : rôle donné dans le département par défaut, qui s'applique à tout le système. Propriétaires et administrateurs ont accès à toute la console ; gestionnaires et superviseurs gèrent leurs départements.</p>
    <h3>Renvois vers des numéros externes (${fwd.length})</h3>
    ${fwd.length ? `<div class="tw"><table><thead><tr><th>Poste</th><th>Magasin</th><th>Numéro(s) externe(s)</th><th>Profils concernés</th><th>État</th></tr></thead><tbody>${fwd.map(r => `<tr><td>${dnLink(r.e.number)}</td><td class="muted">${esc(segShort(r.seg))}</td>
      <td class="mono">${r.nums.map(n => esc(phone(n))).join('<br>') || '—'}${r.mobile ? `<div class="muted" style="font-size:12px;font-family:inherit">fait aussi sonner le cellulaire ${esc(phone(r.e.mobile))}</div>` : ''}</td>
      <td style="font-size:12.5px">${r.profiles.map(x => esc(x.p.name)).join(', ')}</td><td>${r.active ? `<span class="pill warn">Actif (profil ${esc(r.current)})</span>` : '<span class="pill">Profil non actif</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun renvoi vers un numéro externe.</p>'}
    <h3>Appels internationaux</h3>
    ${S.intl.length ? `<div class="tw"><table><thead><tr><th>Règle sortante</th><th>Préfixe</th><th>Longueurs</th><th>Trunk(s)</th><th>Postes autorisés</th></tr></thead><tbody>${S.intl.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="mono">${esc(o.prefix || '—')}</td><td class="muted">${esc(o.lengths || '—')}</td><td>${esc(o.routes.map(r => r.gw).join(', ') || '—')}</td><td class="muted">${esc(o.callerFilter || (o.groups.length ? o.groups.join(', ') : 'tous'))}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">${S.intlCalls ? `${nf(S.intlCalls)} appel(s) international(aux) dans l'historique.` : 'Aucun appel international dans l\'historique du backup.'}</p>` : '<p class="muted">Aucune règle sortante ne permet les appels internationaux.</p>'}
    <h3>Connexions par adresse IP (${nf(S.ips.length)})</h3>
    <p class="muted" style="margin-top:-4px">${nf(S.logins.length)} connexions au client Web et à la console dans le journal d'audit. « Nouvelle » : vue pour la première fois dans les 14 derniers jours ; « nuit » : entre 22 h et 6 h.</p><div id="sect2"></div>
    <h3>Changements sensibles (${nf(S.sens.length)})</h3><div id="sect3"></div>
    <p class="note">Identifiants réinitialisés ou courriel de bienvenue renvoyé (identifiants SIP, clé et lien de provisionnement), passage à un rôle de gestion ou d'administration (ou retrait), changements de double authentification, de réseau local seulement ou de tunnel, et changements de la liste de blocage IP. Cliquez une ligne pour le détail.</p></div>`;
  if(noMfa.length) table($('#sect0'), {rows: noMfa, pageSize: 25, state: (window.__secT0 ||= {}),
    search: x => [x.e.number, x.e.first, x.e.last, x.e.email, segShort(x.seg), x.m.why].join(' '),
    filters: [{label: 'Toutes les raisons', options: [['sso', 'Connexion Microsoft désactivée'], ['nolink', 'Non relié à Microsoft 365']], test: (x, v) => v === 'sso' ? !!x.m.ssoOff : !x.m.ssoOff},
              {label: 'Tous les magasins', options: [...new Set(noMfa.map(x => x.seg))].sort().map(s => [s, segShort(s)]), test: (x, v) => x.seg === v}],
    cols: [{h: 'Poste', v: x => x.e.number, f: x => dnLink(x.e.number)}, {h: 'Magasin', v: x => segShort(x.seg), cls: 'muted'}, {h: 'Courriel', v: x => x.e.email, cls: 'muted'},
      {h: 'Rôle', v: x => { const r = S.elevated.find(y => y.e === x.e); return r ? r.rank : 0; }, f: x => { const r = S.elevated.find(y => y.e === x.e); return r ? `<span class="pill ${secRole(r.role)[2]}">${esc(secRole(r.role)[1])}</span>` : '<span class="muted">Utilisateur</span>'; }},
      {h: 'Actif', v: x => x.e.enabled ? 1 : 0, f: x => x.e.enabled ? 'oui' : '<span class="muted">non</span>'},
      {h: 'Raison', v: x => x.m.why, f: x => `<span class="pill ${MFA_L[x.m.k][1]}">${MFA_L[x.m.k][0]}</span> <span class="muted" style="font-size:12px">${esc(x.m.why)}</span>`}]});
  table($('#sect1'), {rows: elev, pageSize: 50, state: (window.__secT1 ||= {}),
    search: r => [r.e.number, r.e.first, r.e.last, secRole(r.role)[1], r.groups.join(' '), segShort(r.seg)].join(' '),
    filters: [{label: 'Tous les rôles', options: [...new Set(elev.map(r => r.role))].sort((a, b) => secRole(b)[0] - secRole(a)[0]).map(x => [x, secRole(x)[1]]), test: (r, v) => r.role === v},
              {label: 'MFA', options: [['ms', 'Microsoft 365'], ['on', '3CX'], ['req', 'Exigée, pas configurée'], ['off', 'Sans MFA']], test: (r, v) => r.fa === v}],
    cols: [{h: 'Poste', v: r => r.e.number, f: r => dnLink(r.e.number)}, {h: 'Rôle', v: r => r.rank, f: r => `<span class="pill ${secRole(r.role)[2]}">${esc(secRole(r.role)[1])}</span>`},
      {h: 'Portée', v: r => r.global ? 999 : r.groups.length, f: r => r.global ? '<b>Système entier</b>' : `${r.groups.length} département${r.groups.length > 1 ? 's' : ''}<div class="muted" style="font-size:11.5px">${esc(r.groups.slice(0, 4).join(', '))}${r.groups.length > 4 ? '…' : ''}</div>`},
      {h: 'MFA', v: r => r.fa, f: r => faPill(r.fa, r.e)}, {h: 'Réseau local seulement', v: r => r.lan ? 1 : 0, f: r => r.lan ? 'oui' : '<span class="muted">non</span>'},
      {h: 'Dernière connexion', v: r => r.last || '', f: r => r.last ? fmtD(r.last) : '<span class="muted">—</span>'}, {h: 'Adresses IP', num: 1, v: r => r.ips}]});
  table($('#sect2'), {rows: S.ips, pageSize: 25, state: (window.__secT2 ||= {}),
    search: r => [r.ip, ...Object.keys(r.users)].join(' '),
    filters: [{label: 'Toutes les adresses', options: [['pub', 'Internet'], ['priv', 'Réseau privé'], ['new', 'Nouvelles'], ['rare', '3 connexions ou moins'], ['night', 'Avec connexions de nuit']],
      test: (r, v) => v === 'pub' ? !r.priv : v === 'priv' ? r.priv : v === 'new' ? r.isNew : v === 'rare' ? r.rare : r.night > 0}],
    cols: [{h: 'Adresse IP', v: r => r.ip, f: r => `<span class="mono">${esc(r.ip)}</span> ${r.priv ? '<span class="pill">privée</span>' : ''}${r.isNew ? '<span class="pill warn">nouvelle</span>' : ''}`},
      {h: 'Connexions', num: 1, v: r => r.n, f: r => nf(r.n)}, {h: 'Utilisateurs', v: r => Object.keys(r.users).length, f: r => { const u = Object.entries(r.users).sort((a, b) => b[1] - a[1]); return `${u.length} <span class="muted" style="font-size:12px">${esc(u.slice(0, 3).map(x => x[0]).join(', '))}${u.length > 3 ? '…' : ''}</span>`; }},
      {h: 'Première', v: r => r.first, f: r => fmtD(r.first)}, {h: 'Dernière', v: r => r.last, f: r => fmtD(r.last)}, {h: 'Nuit', num: 1, v: r => r.night, f: r => r.night ? `<span class="pill warn">${r.night}</span>` : ''}],
    onRow: r => openDrawer('Connexions depuis ' + esc(r.ip), kv([['Connexions', nf(r.n)], ['Première', fmtD(r.first)], ['Dernière', fmtD(r.last)], ['De nuit (22 h – 6 h)', nf(r.night)]]) +
      `<h3>Utilisateurs</h3><div class="tw"><table><tbody>${Object.entries(r.users).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<tr><td>${esc(u)}</td><td class="num">${nf(n)}</td></tr>`).join('')}</tbody></table></div>`)});
  table($('#sect3'), {rows: S.sens, pageSize: 50, state: (window.__secT3 ||= {}),
    search: r => [r.kind, r.a[3], r.a[4], r.what].join(' '),
    filters: [{label: 'Tous les types', options: [...new Set(S.sens.map(r => r.kind))].map(x => [x, x]), test: (r, v) => r.kind === v},
              {label: 'Tous les utilisateurs', options: [...new Set(S.sens.map(r => r.a[3]))].sort().map(x => [x, x]), test: (r, v) => r.a[3] === v}],
    cols: [{h: 'Date', v: r => r.a[0], f: r => fmtD(r.a[0])}, {h: 'Type', v: r => r.kind, f: r => `<span class="pill ${r.kind === 'Identifiants réinitialisés / bienvenue' ? 'warn' : 'acc'}">${esc(r.kind)}</span>`},
      {h: 'Élément', v: r => r.a[4]}, {h: 'Détail', v: r => r.what, cls: 'muted'}, {h: 'Par', v: r => r.a[3]}],
    onRow: r => openDrawer(esc(r.kind) + ' · ' + esc(r.a[4]), kv([['Date', fmtD(r.a[0])], ['Par', esc(r.a[3])], ['IP', esc(r.a[5])]]) +
      (r.a[6].length ? `<h3>Changements</h3><div class="tw"><table><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>${r.a[6].map(c => `<tr><td><b>${esc(c[0])}</b></td><td class="mono" style="color:var(--bad)">${esc(c[1])}</td><td class="mono" style="color:var(--ok)">${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>` : ''))});
  // ---------- rapport de sécurité imprimable ----------
  const buildSecReport = () => {
    const now = new Date().toLocaleString('fr-CA'), hs = (() => { try{ return healthScores().rows.find(x => x.seg === (SEG || '')); }catch(e){ return null; } })();
    const logo = (document.querySelector('.top .brandlogo') || {outerHTML: ''}).outerHTML.replace(/lgbH/g, 'lgbS');
    const tbl = (head, rows) => rows.length ? `<table class="rpt"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted">Aucun.</p>';
    const find = $('#secwrap .card') && [...document.querySelectorAll('#secwrap .card')].find(c => /À vérifier/.test(c.innerText));
    const pub = S.ips.filter(m => !m.priv), lim90 = new Date(Date.parse(S.end) - 90 * 864e5).toISOString(), sens = S.sens.filter(r => r.a[0] >= lim90);
    return `<header class="rpcover"><div class="rpk" style="display:flex;align-items:center;gap:8px">${logo}<span>Rapport de sécurité · 3CXplore</span></div>
        <h1>${esc(SEG ? segName(SEG) : 'Tout le système')}</h1>
        <div class="rpmeta">${esc(FULL.info.company)} · 3CX ${esc(FULL.info.version)} · backup du ${esc(bkDate(FULL.info.date))} · rapport généré le ${esc(now)}</div></header>
      <section class="rps"><h2>Résumé</h2>
        ${hs && hs.comp.secu ? `<p>Note de sécurité : <b>${hs.comp.secu.score}/100</b> (note de santé globale ${hs.total}/100).</p>` : ''}
        <table class="rpt"><tbody>${[['Comptes avec accès complet au système', admins.length], ['… dont sans MFA', adminNo2fa.length], ['Gestionnaires et superviseurs sans MFA', mgrNo2fa.length], ['Postes avec MFA Microsoft 365', mfaCnt('ms')], ['Postes avec MFA 3CX', mfaCnt('on')], ['Postes sans MFA', noMfa.length],
          ['Renvois vers des numéros externes (actifs)', `${fwd.length} (${fwd.filter(r => r.active).length})`], ['Postes autorisés hors réseau local', remote.length], ['Adresses Internet de connexion', pub.length], ['Règles permettant les appels internationaux', S.intl.length]]
          .map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num"><b>${esc(String(v))}</b></td></tr>`).join('')}</tbody></table></section>
      ${find ? `<section class="rps"><h2>À vérifier</h2>${find.innerHTML.replace(/<h3[^>]*>À vérifier<\/h3>/, '')}</section>` : ''}
      <section class="rps"><h2>Comptes avec des droits élevés (${elev.length})</h2>${tbl(['Poste', 'Rôle', 'Portée', 'MFA', 'Dernière connexion'], elev.map(r => [esc(r.e.number + ' ' + (r.e.first + ' ' + r.e.last).trim()), esc(secRole(r.role)[1]), r.global ? 'Système entier' : esc(r.groups.length + ' département' + (r.groups.length > 1 ? 's' : '')), esc(MFA_L[r.fa][0]), r.last ? esc(fmtD(r.last)) : '—']))}</section>
      <section class="rps"><h2>Postes sans MFA (${noMfa.length})</h2>${tbl(['Poste', 'Magasin', 'Courriel', 'Raison'], noMfa.map(x => [esc(x.e.number + ' ' + (x.e.first + ' ' + x.e.last).trim()), esc(segShort(x.seg)), esc(x.e.email || '—'), esc(x.m.why)]))}
        <p class="note">MFA Microsoft 365 : poste relié à un compte Microsoft (Entra ID) avec la connexion Microsoft active ; les règles du tenant (accès conditionnel) sont à vérifier dans Microsoft Entra.</p></section>
      <section class="rps"><h2>Renvois vers des numéros externes (${fwd.length})</h2>${tbl(['Poste', 'Numéros', 'Profils', 'État'], fwd.map(r => [esc(r.e.number + ' ' + (r.e.first + ' ' + r.e.last).trim()), esc(r.nums.map(phone).join(', ') || '—') + (r.mobile ? ' (et cellulaire)' : ''), esc(r.profiles.map(x => x.p.name).join(', ')), r.active ? '<b>Actif</b>' : 'Profil non actif']))}</section>
      <section class="rps"><h2>Appels internationaux</h2>${tbl(['Règle sortante', 'Préfixe', 'Trunks', 'Postes autorisés'], S.intl.map(o => [esc(o.name), esc(o.prefix || '—'), esc(o.routes.map(r => r.gw).join(', ') || '—'), esc(o.callerFilter || (o.groups.length ? o.groups.join(', ') : 'tous'))]))}
        <p class="note">${S.intlCalls ? `${nf(S.intlCalls)} appel(s) international(aux) dans l'historique.` : 'Aucun appel international dans l\'historique du backup.'}</p></section>
      <section class="rps"><h2>Connexions depuis Internet (${pub.length} adresses)</h2>${tbl(['Adresse IP', 'Connexions', 'Utilisateurs', 'Première', 'Dernière', 'De nuit'], pub.slice(0, 40).map(m => [esc(m.ip) + (m.isNew ? ' <b>(nouvelle)</b>' : ''), nf(m.n), nf(Object.keys(m.users).length), esc(fmtD(m.first)), esc(fmtD(m.last)), m.night ? nf(m.night) : '']))}
        ${pub.length > 40 ? `<p class="muted">+${pub.length - 40} autres adresses.</p>` : ''}</section>
      <section class="rps"><h2>Changements sensibles des 90 derniers jours (${sens.length})</h2>${tbl(['Date', 'Type', 'Élément', 'Détail', 'Par'], sens.slice(0, 60).map(r => [esc(fmtD(r.a[0])), esc(r.kind), esc(r.a[4]), esc(r.what), esc(r.a[3])]))}
        ${sens.length > 60 ? `<p class="muted">+${sens.length - 60} autres (onglet Sécurité).</p>` : ''}</section>
      <p class="note">Les mots de passe et clés ne sont jamais lus ni affichés. Source : backup 3CX du ${esc(bkDate(FULL.info.date))}.</p>`;
  };
  $('#secrep').addEventListener('click', () => { const box = $('#secreport'), on = box.hidden;
    box.hidden = !on; $('#secrep').textContent = on ? 'Masquer l\'aperçu' : 'Aperçu du rapport de sécurité'; $('#secpr').hidden = !on;
    if(on){ box.innerHTML = `<article class="report" id="secart">${buildSecReport()}</article>`; box.scrollIntoView({behavior: 'smooth'}); } });
  $('#secpr').addEventListener('click', () => { const art = $('#secart'); if(!art) return;
    const p = document.createElement('div'); p.id = 'secprint'; p.innerHTML = art.outerHTML.replace('id="secart"', ''); document.body.appendChild(p); document.body.classList.add('printing-sec');
    window.print(); setTimeout(() => { p.remove(); document.body.classList.remove('printing-sec'); }, 800); });
};

