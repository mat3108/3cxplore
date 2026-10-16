// ---------- Historique d'un employé (onglet) ----------
const HX_FIELD = {Phones: 'Téléphones', Blfs: 'Touches BLF', OutboundCallerID: 'Caller ID sortant', Groups: 'Départements et rôles', ForwardingProfiles: 'Renvois d\'appel', EmailAddress: 'Courriel',
  DisplayName: 'Nom affiché', FirstName: 'Prénom', LastName: 'Nom', Require2FA: 'Double authentification', VMEnabled: 'Messagerie vocale', Enabled: 'Poste actif', Greetings: 'Messages d\'accueil',
  Hours: 'Horaires', BreakTime: 'Pauses', OfficeHoursProps: 'Horaires', PinProtected: 'Protection par PIN', PromptSet: 'Langue des messages', MobileNumber: 'Cellulaire', RecordCalls: 'Enregistrement',
  CallScreening: 'Filtrage des appels', SipAuth: 'Identifiants SIP', RpsKey: 'Clé de provisionnement', ConfigurationLink: 'Lien de configuration', SendWelcomeEmail: 'Courriel de bienvenue', ClickToCallId: 'Lien « cliquer pour appeler »', WebMeetingFriendlyName: 'Nom de réunion web', SendEmailMissedCalls: 'Courriel des appels manqués', EnableHotdesking: 'Hot desking', Internal: 'Poste interne', HideInPhonebook: 'Masqué de l\'annuaire', Number: 'Numéro du poste'};
const hxField = k => HX_FIELD[k] || (/^MS365/.test(k) ? 'Microsoft 365' : /^Google/.test(k) ? 'Google' : /^MyPhone/.test(k) ? "Options de l'application" : /^VM/.test(k) ? 'Messagerie vocale' : /^Emergency/.test(k) ? "Appels d'urgence" : k);
// [ajouté …, retiré …, dans …] selon le type d'appartenance
const HX_KIND = {dept: ['au département', 'du département', 'dans le département'], file: ['à la file', 'de la file', 'dans la file'], 'file-gest': ['comme gestionnaire de la file', 'comme gestionnaire de la file', 'pour la gestion de la file'], groupe: ['au groupe de sonnerie', 'du groupe de sonnerie', 'dans le groupe de sonnerie']};
// événements d'un poste : modifications de sa fiche, appartenances (départements, files, groupes) et modifications qu'il a faites lui-même
function hxEvents(n){
  const ev = [];
  (FULL.audit || []).forEach(a => {
    if(a[2] === '7' && String(a[4]).split(' ')[0] === n){
      const f = [...new Set(a[6].map(c => hxField(c[0])))];
      const txt = a[1] === 'Création' ? 'Création du poste' : a[1] === 'Suppression' ? 'Suppression du poste' : f.length ? 'Fiche modifiée : ' + f.slice(0, 6).join(', ') + (f.length > 6 ? ` et ${f.length - 6} autre(s)` : '') : a[1];
      const det = a[6].filter(c => ['EmailAddress', 'FirstName', 'LastName', 'OutboundCallerID', 'Enabled', 'Require2FA', 'VMEnabled', 'MobileNumber', 'DisplayName'].includes(c[0])).map(c => `${hxField(c[0])} : ${c[1] || '—'} → ${c[2] || '—'}`);
      ev.push({t: a[0], who: a[3], kind: a[1] === 'Création' ? 'new' : a[1] === 'Suppression' ? 'del' : 'edit', txt, det});
    }
  });
  (FULL.auditMem || []).forEach(m => { if(m[4] !== n) return;
    const K = HX_KIND[m[2]] || [m[2], m[2], m[2]], o = `« ${m[3]} »`;
    const txt = m[5] === 'add' ? `Ajouté ${K[0]} ${o}${m[7] ? ` (rôle ${VROLE_FR[m[7]] || m[7]})` : ''}` : m[5] === 'del' ? `Retiré ${K[1]} ${o}` : `Rôle changé ${K[2]} ${o} : ${VROLE_FR[m[6]] || m[6]} → ${VROLE_FR[m[7]] || m[7]}`;
    ev.push({t: m[0], who: m[1], kind: m[5] === 'add' ? 'add' : m[5] === 'del' ? 'rem' : 'role', txt, det: []}); });
  // une même modification peut apparaître depuis la fiche du poste et depuis le département : on garde une seule ligne par minute et par texte
  const seen = new Set();
  return ev.filter(e => { const k = e.t.slice(0, 16) + '|' + e.txt; if(seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t < b.t ? 1 : -1);
}
// différences avec le backup de référence (onglet Avant / après)
function hxRefDiff(n){
  const R = window.REF_D; if(!R || !R.extensions) return null;
  const a = R.extensions.find(e => e.number === n), b = EXT_BY[n], out = [];
  if(!a && b) return {date: R.info && R.info.date, items: ['Le poste n\'existait pas dans le backup de référence (créé depuis)']};
  if(a && !b) return {date: R.info && R.info.date, items: ['Le poste a été supprimé depuis le backup de référence']};
  if(!a) return null;
  const nm = e => (e.first + ' ' + e.last).trim();
  if(nm(a) !== nm(b)) out.push(`Nom : ${nm(a)} → ${nm(b)}`);
  if(a.email !== b.email) out.push(`Courriel : ${a.email || '—'} → ${b.email || '—'}`);
  const gs = e => Object.fromEntries((e.groups || []).filter(g => !/^(__|SYSTEM$)/.test(g.g)).map(g => [g.g, g.role || '']));
  const ga = gs(a), gb = gs(b);
  Object.keys(gb).filter(g => !(g in ga)).forEach(g => out.push(`Ajouté au département « ${g} »${gb[g] ? ` (${VROLE_FR[gb[g]] || gb[g]})` : ''}`));
  Object.keys(ga).filter(g => !(g in gb)).forEach(g => out.push(`Retiré du département « ${g} »`));
  Object.keys(gb).filter(g => g in ga && ga[g] && gb[g] && ga[g] !== gb[g]).forEach(g => out.push(`Rôle dans « ${g} » : ${VROLE_FR[ga[g]] || ga[g]} → ${VROLE_FR[gb[g]] || gb[g]}`));
  const diffList = (x, y, l) => { (y || []).filter(q => !(x || []).includes(q)).forEach(q => out.push(`Ajouté ${l} ${q} ${dnName(q)}`)); (x || []).filter(q => !(y || []).includes(q)).forEach(q => out.push(`Retiré ${l} ${q} ${dnName(q)}`)); };
  diffList(a.queues, b.queues, 'à la file'); diffList(a.ringGroups, b.ringGroups, 'au groupe de sonnerie');
  const ext = e => [...new Set((e.profiles || []).flatMap(p => p.routes.filter(r => r[1] && r[1].to === 'External' && r[1].ext).map(r => r[1].ext)))].sort().join(', ');
  if(ext(a) !== ext(b)) out.push(`Renvois externes : ${ext(a) || 'aucun'} → ${ext(b) || 'aucun'}`);
  if(a.blfs && b.blfs && JSON.stringify(a.blfs) !== JSON.stringify(b.blfs)) out.push(`Touches BLF : ${a.blfs.length} → ${b.blfs.length} touche(s), contenu modifié`);
  if((a.devices || []).map(d => d.mac).join() !== (b.devices || []).map(d => d.mac).join()) out.push(`Téléphone : ${(a.devices || []).map(d => d.model || d.mac).join(', ') || 'aucun'} → ${(b.devices || []).map(d => d.model || d.mac).join(', ') || 'aucun'}`);
  if(a.enabled !== b.enabled) out.push(`Poste ${b.enabled ? 'réactivé' : 'désactivé'}`);
  return {date: R.info && R.info.date, items: out};
}
const HX_ICON = {new: ['Création', 'ok'], del: ['Suppression', 'bad'], edit: ['Modification', ''], add: ['Ajout', 'ok'], rem: ['Retrait', 'warn'], role: ['Rôle', 'acc']};
V.historique = (el, arg) => {
  const S = window.__hx ||= {u: '', k: ''};
  const exts = FULL.extensions.filter(e => !SEG || SEGOF[e.number] === SEG).slice().sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  if(arg) S.u = decodeURIComponent(arg);
  if(!exts.some(e => e.number === S.u)) S.u = (exts.find(e => e.email) || exts[0] || {}).number || '';
  const E = EXT_BY[S.u];
  if(!E){ el.innerHTML = '<h2>Historique d\'un employé</h2><p class="muted">Aucun poste.</p>'; return; }
  const nm = e => (e.first + ' ' + e.last).trim();
  const evAll = hxEvents(E.number), ev = evAll.filter(e => !S.k || e.kind === S.k), ref = hxRefDiff(E.number);
  const done = (FULL.audit || []).filter(a => String(a[3]).split(' ')[0] === E.number && a[1] !== 'Connexion');
  const A = FULL.audit || [], aFirst = A.length ? A[A.length - 1][0] : '', aLast = A.length ? A[0][0] : '';
  const who = {}; evAll.forEach(e => { if(e.who) who[e.who] = (who[e.who] || 0) + 1; });
  const fd = t => t ? fmtD(t) : '—';
  el.innerHTML = `<div id="hxwrap"><div class="noprint"><h2>Historique d'un employé</h2>
    <p class="lead">Tout ce qui a changé pour un poste d'après le journal d'audit de 3CX${aFirst ? ` (du ${esc(fd(aFirst).slice(0, 10))} au ${esc(fd(aLast).slice(0, 10))})` : ''} : création, modifications de sa fiche, ajouts et retraits dans les départements, les files et les groupes de sonnerie, changements de rôle — avec la date et l'auteur de chaque modification${window.REF_D ? ', et les différences avec le backup de référence' : ''}.</p>
    <div class="bar"><input type="search" id="hxq" placeholder="Rechercher un employé (poste ou nom)…" autocomplete="off" style="flex:1;min-width:200px">
      <select id="hxu">${exts.map(e => `<option value="${esc(e.number)}"${e.number === S.u ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))} · ${esc(segShort(SEGOF[e.number] || SEG_COMMON))}</option>`).join('')}</select>
      <button class="btn primary" id="hxprint">Imprimer / PDF</button></div>
    ${FULL.audit && !FULL.auditMem ? '<div class="card" style="border-left:3px solid var(--warn)">Les ajouts et retraits dans les départements, files et groupes sont lus à l\'ouverture du backup : <b>rouvrez le backup</b> pour les voir ici.</div>' : ''}</div>
    <div class="report" id="hxsheet"><header class="rpcover"><div class="rpk">Historique d'un employé · 3CXplore</div><h1>${esc(E.number)} ${esc(nm(E))}</h1>
      <div class="rpmeta">${esc(segName(SEGOF[E.number] || SEG_COMMON))}${E.email ? ' · ' + esc(E.email) : ''} · ${evAll.length} événement${evAll.length > 1 ? 's' : ''} dans le journal · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      <div class="grid kpis">${[['Événements', nf(evAll.length)], ['Première trace', evAll.length ? fd(evAll[evAll.length - 1].t).slice(0, 10) : '—'], ['Dernière modification', evAll.length ? fd(evAll[0].t).slice(0, 10) : '—'], ['Ajouts / retraits', nf(evAll.filter(e => e.kind === 'add' || e.kind === 'rem').length)], ['Modifications faites par ce poste', nf(done.length)]].map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:19px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
      ${Object.keys(who).length ? `<p class="muted" style="font-size:12.5px">Modifié par : ${Object.entries(who).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${esc(w)} (${c})`).join(' · ')}</p>` : ''}
      ${ref ? `<section class="rps"><h2>Depuis le backup de référence${ref.date ? ' du ' + esc(ref.date) : ''}</h2>${ref.items.length ? `<ul>${ref.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Aucune différence pour ce poste.</p>'}</section>` : ''}
      <section class="rps"><h2>Chronologie</h2>
        <div class="bar noprint"><select id="hxk"><option value="">Tous les événements (${evAll.length})</option>${Object.entries(HX_ICON).map(([k, [l]]) => `<option value="${k}"${S.k === k ? ' selected' : ''}>${esc(l)} (${evAll.filter(e => e.kind === k).length})</option>`).join('')}</select></div>
        ${ev.length ? `<div class="hxtl">${ev.map(e => `<div class="hxe"><div class="hxd mono">${esc(fd(e.t))}</div><div><span class="pill ${HX_ICON[e.kind][1]}">${esc(HX_ICON[e.kind][0])}</span> ${esc(e.txt)}${e.det.length ? `<div class="muted" style="font-size:12px">${e.det.map(esc).join('<br>')}</div>` : ''}<div class="muted" style="font-size:11.5px">par ${esc(e.who || '—')}</div></div></div>`).join('')}</div>`
          : `<p class="muted">Aucun événement pour ce poste dans le journal d'audit${aFirst ? ' (qui couvre seulement la période ci-dessus)' : ''}.</p>`}</section>
      ${done.length ? `<section class="rps"><h2>Modifications faites par ce poste (${done.length})</h2><div class="muted" style="font-size:12.5px;margin-bottom:4px">Ce poste a un accès à la console d'administration.</div>${done.slice(0, 40).map(a => `<div style="font-size:12.5px"><span class="mono">${esc(fd(a[0]))}</span> ${esc(a[1])} · ${esc(modType(a))} « ${esc(a[4])} »</div>`).join('')}${done.length > 40 ? `<p class="muted">… et ${done.length - 40} autre(s) : voir l'onglet Journal d'audit.</p>` : ''}</section>` : ''}
      <section class="rps noprint"><h2>Aujourd'hui</h2><p style="margin:0">${dnLink(E.number)} · ${(E.groups || []).filter(g => !/^(__|SYSTEM$)/.test(g.g)).map(g => `${esc(g.g)}${g.role ? ` <span class="muted">(${esc(VROLE_FR[g.role] || g.role)})</span>` : ''}`).join(', ') || 'aucun département'}${E.queues.length ? ` · files : ${E.queues.map(q => dnLink(q)).join(', ')}` : ''}</p></section>
    </div></div>`;
  const re = () => V.historique(el);
  $('#hxu').addEventListener('change', e => { S.u = e.target.value; S.k = ''; re(); });
  $('#hxk').addEventListener('change', e => { S.k = e.target.value; re(); });
  $('#hxq').addEventListener('input', e => { const q = gsNorm(e.target.value), sel = $('#hxu'); if(!q) return; const o = [...sel.options].find(o => gsNorm(o.text).includes(q)); if(o && o.value !== S.u){ S.u = o.value; S.k = ''; re(); setTimeout(() => { const i = $('#hxq'); if(i){ i.value = e.target.value; i.focus(); } }, 0); } });
  $('#hxprint').addEventListener('click', () => { printHTML($('#hxsheet').outerHTML.replace('id="hxsheet"', '')); });
};

