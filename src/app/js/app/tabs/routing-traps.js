// ---------- Pièges d'acheminement (onglet) ----------
const TRAP_CAT = {loop: ['Boucle', 'bad'], gone: ['Destination disparue', 'bad'], off: ['Poste désactivé', 'bad'], noflow: ['Sans issue', 'warn'], empty: ['Sans membre', 'bad'], vmonly: ['SDA → messagerie', '']};
let TRAP_CACHE = null;
function trapAnalysis(){
  if(TRAP_CACHE) return TRAP_CACHE;
  const T = [], add = (cat, sev, el, title, detail, fix) => T.push({cat, sev, el, title, detail, fix});
  const via = d => d && d.dn && d.to && !['External', 'None', 'EndCall'].includes(d.to) ? d.dn : '';
  const exists = n => !!DN[n] || FULL.parks.includes(n);
  const ext = n => EXT_BY[n];
  // 1) destinations disparues ou postes désactivés : tout ce qui pointe vers un numéro (index des références inverses)
  Object.entries(dnRefs()).forEach(([n, refs]) => { const calls = refs.filter(r => r.cat !== 'member'); if(!calls.length) return;
    if(!exists(n)) calls.forEach(r => add('gone', 'bad', r.from, `${r.what} → ${n}, qui n'existe plus`, r.how, 'Choisir une nouvelle destination dans la console 3CX.'));
    else { const e = ext(n); if(e && e.enabled === false) calls.filter(r => r.cat !== 'fwd').forEach(r => add('off', 'bad', r.from, `${r.what} → poste ${n} ${dnName(n)}, désactivé`, r.how, 'Remplacer par un poste actif, une file ou un groupe.')); } });
  // 2) boucles sans intervention du client : débordements de files, groupes sans réponse, acheminement des départements, renvois « sans réponse », délai des menus
  const E = {}, edge = (a, b, how) => { if(a && b && a !== b) (E[a] ||= []).push([b, how]); };
  FULL.queues.forEach(q => edge(q.number, via(q.dest), 'débordement'));
  FULL.ringGroups.forEach(r => edge(r.number, via(r.dest), 'sans réponse'));
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => ['office', 'outOfOffice'].forEach(k => edge(g.number, via(g.routes[k]), k === 'office' ? 'ouvert' : 'fermé')));
  FULL.ivrs.forEach(i => { if(i.timeoutDN && !['EndCall', 'None', 'RepeatPrompt'].includes(i.timeoutType)) edge(i.number, i.timeoutDN, 'sans choix'); });
  FULL.extensions.forEach(e => { const p = e.profiles.find(x => x.name === (e.profile || 'Available')) || e.profiles.find(x => x.name === 'Available'); if(!p) return;
    const r = p.routes.find(([k]) => /NoAnswer › AllCalls$/.test(k)); if(r && r[1].to !== 'VoiceMail') edge(e.number, via(r[1]), 'sans réponse'); });
  const seen = new Set(), stack = [], onStack = new Set(), cycles = new Map();
  const dfs = n => { if(onStack.has(n)){ const c = stack.slice(stack.findIndex(x => x[0] === n)); const key = c.map(x => x[0]).slice().sort().join('>'); if(!cycles.has(key)) cycles.set(key, c); return; }
    if(seen.has(n)) return; seen.add(n); onStack.add(n);
    (E[n] || []).forEach(([b, how]) => { stack.push([n, how]); dfs(b); stack.pop(); }); onStack.delete(n); };
  Object.keys(E).forEach(n => dfs(n));
  cycles.forEach(c => { const path = c.map(([n, how]) => `${n} ${dnName(n)} (${how})`).join(' → ') + ` → ${c[0][0]}`;
    add('loop', c.every(([, how]) => how === 'sans choix') ? 'warn' : 'bad', c[0][0], `Boucle de ${c.length} élément${c.length > 1 ? 's' : ''} sans issue`, path, "Faire sortir la boucle vers une messagerie, une file avec agents ou un poste."); });
  // 3) sans issue
  FULL.queues.forEach(q => {
    if(!q.dest || !q.dest.to || ['None', 'EndCall'].includes(q.dest.to)) add('noflow', 'warn', q.number, "File sans destination à l'attente maximale", `Après ${q.masterTimeout || '?'} s d'attente, l'appel est raccroché.`, 'Définir une destination au délai maximal (messagerie, autre file, poste).');
    if(!q.members.length) add('empty', via(q.dest) ? 'warn' : 'bad', q.number, "File sans aucun agent", via(q.dest) ? `Les appels passent au débordement (${via(q.dest)} ${dnName(via(q.dest))}) après l'attente maximale.` : "Les appels attendent puis sont raccrochés.", "Ajouter des agents ou retirer la file de l'acheminement.");
    else if(!q.members.some(m => !m.status || m.status === 'LoggedIn')) add('empty', 'warn', q.number, "Aucun agent connecté à la file (au moment du backup)", `${q.members.length} agent${q.members.length > 1 ? 's' : ''}, tous déconnectés.`, "Vérifier que les agents se connectent à la file.");
  });
  FULL.ringGroups.forEach(r => { if(!r.members.length) add('empty', via(r.dest) ? 'warn' : 'bad', r.number, 'Groupe de sonnerie sans membre', via(r.dest) ? `Les appels vont directement à ${via(r.dest)} ${dnName(via(r.dest))}.` : 'Les appels ne sonnent nulle part.', 'Ajouter des membres ou retirer le groupe.');
    if(!r.dest || !r.dest.to || ['None', 'EndCall'].includes(r.dest.to)) add('noflow', 'warn', r.number, 'Groupe de sonnerie sans destination si personne ne répond', `Après ${r.ringTime || '?'} s, l'appel est raccroché.`, 'Définir une destination sans réponse (messagerie, file…).'); });
  // un menu sans touche est un message seulement (intro, fermé) : normal s'il passe ensuite à une destination
  FULL.ivrs.forEach(i => { if(!i.timeoutType || ['EndCall', 'None'].includes(i.timeoutType)) add('noflow', i.options.length ? 'warn' : 'info', i.number,
    i.options.length ? 'Menu qui raccroche si le client ne choisit rien' : 'Message seulement, puis raccroche', i.options.length ? `Après ${i.timeout || '?'} s sans choix.` : "Menu sans touche : le message joue puis l'appel se termine (normal pour un message de fermeture).",
    i.options.length ? 'Choisir une destination « sans choix » (réception, file, messagerie).' : "Vérifier que c'est voulu (message de fermeture) ; sinon, choisir une destination après le message."); });
  // 4) SDA qui mènent directement à une messagerie
  FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(did => { const r = by[did] || def; if(r && r.office && r.office.to === 'VoiceMail') add('vmonly', 'info', r.office.dn || l.number, `SDA ${phone(did)} → messagerie, même aux heures d'ouverture`, `Trunk ${l.number}${by[did] ? '' : ' (règle par défaut)'} · messagerie de ${r.office.dn || '?'} ${dnName(r.office.dn || '')}`, "Vérifier que c'est voulu : aucun employé ne peut répondre à ce numéro."); }); });
  return TRAP_CACHE = T;
}
V.pieges = el => {
  const S = window.__trap ||= {cat: ''};
  const all = trapAnalysis().filter(t => !SEG || (SEGOF[t.el] || SEG_COMMON) === SEG);
  const by = c => all.filter(t => t.cat === c).length, sevN = s => all.filter(t => t.sev === s).length;
  el.innerHTML = `<div id="trwrap"><h2>Pièges d'acheminement</h2>
    <p class="lead">Analyse de toute la configuration, sans simulation : boucles où l'appel tourne sans jamais aboutir, destinations qui n'existent plus ou postes désactivés, files, groupes et menus sans issue, SDA qui ne mènent qu'à une messagerie${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Complète le <a href="#controle">Contrôle des SDA</a>, qui simule chaque numéro à des moments clés.</p>
    <div class="grid kpis">${[['Appels perdus possibles', sevN('bad'), 'bad'], ['À vérifier', sevN('warn'), 'warn'], ['Information', sevN('info'), '']].map(([l, v, c]) => `<div class="card kpi ${v && c ? c : ''}"><div class="v">${nf(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="bar"><select id="trcat"><option value="">Toutes les catégories (${all.length})</option>${Object.entries(TRAP_CAT).map(([k, [l]]) => `<option value="${k}"${S.cat === k ? ' selected' : ''}>${esc(l)} (${by(k)})</option>`).join('')}</select></div>
    <div id="trt"></div>
    ${all.length ? '' : '<div class="card"><b>Aucun piège détecté.</b> <span class="muted">Toutes les destinations existent, aucune boucle, et chaque file, groupe et menu a une issue.</span></div>'}
    <p class="note">Boucle : suite d'éléments qui se renvoient l'appel sans intervention du client (débordement de file, groupe sans réponse, acheminement de département, renvoi « sans réponse » du statut actuel d'un poste, délai d'un menu). « Aucun agent connecté » reflète le moment du backup.</p></div>`;
  const draw = () => table($('#trt'), {rows: all.filter(t => !S.cat || t.cat === S.cat), pageSize: 50, state: S.t ||= {}, sort: [0, 1],
    search: t => [t.el, dnName(t.el), t.title, t.detail].join(' '),
    cols: [{h: 'Gravité', v: t => ({bad: 0, warn: 1, info: 2})[t.sev], f: t => `<span class="pill ${t.sev === 'info' ? '' : t.sev}">${({bad: 'Appel perdu', warn: 'À vérifier', info: 'Info'})[t.sev]}</span>`},
      {h: 'Catégorie', v: t => t.cat, f: t => esc(TRAP_CAT[t.cat][0])}, {h: 'Élément', v: t => t.el, f: t => DN[t.el] ? dnLink(t.el) : `<span class="mono">${esc(t.el)}</span>`},
      {h: 'Magasin', v: t => SEGOF[t.el] || '', f: t => esc(segShort(SEGOF[t.el] || SEG_COMMON))},
      {h: 'Problème', v: t => t.title, f: t => `${esc(t.title)}${t.detail ? `<div class="muted" style="font-size:12px">${esc(t.detail)}</div>` : ''}`}],
    onRow: t => openDrawer(esc(TRAP_CAT[t.cat][0]), kv([['Élément', DN[t.el] ? dnLink(t.el) : esc(t.el)], ['Problème', esc(t.title)], ['Détail', esc(t.detail || '—')], ['À faire', esc(t.fix)]]) + (DN[t.el] ? `<p><a class="btn dn" data-dn="${esc(t.el)}">Ouvrir la fiche de ${esc(t.el)}</a></p>` : ''))});
  draw();
  $('#trcat').addEventListener('change', e => { S.cat = e.target.value; draw(); });
};

