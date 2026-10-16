// ---------- Références inverses : tout ce qui pointe vers un numéro ----------
// cat : 'route' (acheminement : menus, départements, files, groupes), 'sda' (numéros entrants), 'fwd' (renvois des collègues), 'member' (appartenances)
let REFS_CACHE = null;
function dnRefs(){
  if(REFS_CACHE) return REFS_CACHE;
  const R = {}, add = (n, r) => { if(n) (R[n] ||= []).push(r); };
  const via = d => d && d.dn && d.to !== 'External' ? d.dn : '';
  const vm = d => d && d.to === 'VoiceMail' ? ' (messagerie vocale)' : '';
  const GR = {office: "heures d'ouverture", outOfOffice: 'hors heures', break: 'pause', holidays: 'jours fériés'};
  FULL.ivrs.forEach(i => {
    i.options.forEach(o => add(o.dn, {cat: 'route', from: i.number, what: `Touche ${o.key} du menu`, how: (TO_FR[o.type] || o.type) + (o.type === 'VoiceMail' ? ' (messagerie vocale)' : '')}));
    if(i.timeoutDN) add(i.timeoutDN, {cat: 'route', from: i.number, what: 'Sans choix (délai) du menu', how: TO_FR[i.timeoutType] || i.timeoutType});
    if(i.invalidDN) add(i.invalidDN, {cat: 'route', from: i.number, what: 'Touche invalide du menu', how: ''});
    Object.entries(i.routes || {}).forEach(([k, d]) => add(via(d), {cat: 'route', from: i.number, what: `Acheminement ${GR[k] || k} du menu`, how: (TO_FR[d.to] || d.to) + vm(d)}));
  });
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => {
    Object.entries(g.routes).forEach(([k, d]) => add(via(d), {cat: 'route', from: g.number, what: `Acheminement ${GR[k] || k} du département`, how: (TO_FR[d?.to] || d?.to || '') + vm(d)}));
    if(via(g.operator)) add(via(g.operator), {cat: 'route', from: g.number, what: 'Opérateur du département', how: TO_FR[g.operator.to] || g.operator.to});
    g.members.forEach(m => add(m.dn, {cat: 'member', from: g.number, what: 'Membre du département', how: VROLE_FR[m.role] || m.role}));
  });
  FULL.queues.forEach(q => {
    if(via(q.dest)) add(via(q.dest), {cat: 'route', from: q.number, what: "Débordement (attente maximale) de la file", how: (TO_FR[q.dest.to] || q.dest.to) + vm(q.dest)});
    Object.entries(q.routes || {}).forEach(([k, d]) => add(via(d), {cat: 'route', from: q.number, what: `Acheminement ${GR[k] || k} de la file`, how: (TO_FR[d.to] || d.to) + vm(d)}));
    q.members.forEach(m => add(m.dn, {cat: 'member', from: q.number, what: 'Agent de la file', how: !m.status || m.status === 'LoggedIn' ? 'connecté' : 'déconnecté'}));
    q.managers.forEach(m => add(m, {cat: 'member', from: q.number, what: 'Gestionnaire de la file', how: ''}));
  });
  FULL.ringGroups.forEach(r => {
    if(via(r.dest)) add(via(r.dest), {cat: 'route', from: r.number, what: 'Sans réponse du groupe de sonnerie', how: (TO_FR[r.dest.to] || r.dest.to) + vm(r.dest)});
    r.members.forEach(m => add(m, {cat: 'member', from: r.number, what: 'Membre du groupe de sonnerie', how: ''}));
  });
  // renvois : une ligne par collègue et par destination, avec la liste des statuts concernés (dans l'ordre de 3CX)
  FULL.extensions.forEach(e => { const per = {};
    e.profiles.forEach(p => p.routes.forEach(([k, d]) => { const n = via(d); if(!n || n === e.number) return;
      const x = per[n] ||= {st: [], how: (TO_FR[d.to] || d.to) + vm(d)}; const lab = (typeof FWD_ST !== 'undefined' && FWD_ST[p.name]) || p.name; if(!x.st.includes(lab)) x.st.push(lab); }));
    const ord = typeof FWD_ST !== 'undefined' ? Object.values(FWD_ST) : [];
    Object.entries(per).forEach(([n, x]) => { x.st.sort((a, b) => (ord.indexOf(a) + 1 || 99) - (ord.indexOf(b) + 1 || 99));
      add(n, {cat: 'fwd', from: e.number, what: x.st.length === ord.length && ord.length ? 'Renvoi (tous les statuts) de' : `Renvoi (${x.st.join(', ')}) de`, how: x.how}); }); });
  const HR = {office: "heures d'ouverture", outOfOffice: 'hors heures', holidays: 'jours fériés'};
  FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(did => { const r = by[did] || def; if(!r) return; const per = {};
      Object.keys(HR).forEach(k => { const n = via(r[k]); if(n) (per[n] ||= []).push(HR[k]); });
      Object.entries(per).forEach(([n, ks]) => add(n, {cat: 'sda', from: l.number, did, what: `SDA ${phone(did)}`, how: ks.join(', ') + (by[did] ? '' : ' — règle par défaut du trunk')})); }); });
  return REFS_CACHE = R;
}
const REF_CAT = {route: 'Acheminement (menus, départements, files, groupes)', sda: 'Numéros entrants (SDA)', fwd: 'Renvois de collègues', member: 'Appartenances'};
const refLine = r => `${esc(r.what)} ${r.cat === 'sda' ? `<span class="muted">(trunk ${esc(r.from)})</span>` : dnLink(r.from)}${r.how ? ` <span class="muted">→ ${esc(r.how)}</span>` : ''}`;

