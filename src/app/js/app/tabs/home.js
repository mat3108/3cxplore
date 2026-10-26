// ---------- Accueil (20.1) : l'assistant. La mascotte pose une question, on répond en touchant un gros bouton, et elle mène à la bonne page ----------
// chaque question : [texte, réponses] ; une réponse : [libellé, icône (onglet), destination] — '>id' pose la question id, sinon c'est l'onglet à ouvrir (« onglet/argument » possible)
const ASK = {
  start: [null, [['Voir les appels', 'appels', '>appels'], ['Régler un problème', 'priorites', '>reparer'], ['Ajouter ou retirer quelqu\'un', 'nouvel', '>gens'],
    ['Voir mon magasin', 'magasins', '>magasin'], ['Trouver quelqu\'un', 'annuaire', '>trouver'], ['Comprendre où va un appel', 'flux', '>chemin'], ['Faire un rapport', 'genrap', '>rapport'], ['Faire un graphique', 'gengraph', 'gengraph'], ['Autre chose', 'autre', '>autre']]],
  rapport: ['Un rapport sur quoi ?', [['Un employé', 'employe', 'genrap/ext'], ['Une file d\'attente', 'files', 'genrap/queue'], ['Un numéro entrant (SDA)', 'numero', 'genrap/did']]],
  appels: ['Quels appels ?', [['Ceux qui n\'ont pas eu de réponse', 'rappels', 'rappels'], ['Les clients qui rappellent souvent', 'rappellent', 'rappellent'],
    ['Un numéro de téléphone précis', 'numero', 'numero'], ['Combien de temps on attend avant de répondre', 'delai', 'delai'], ['Les appels très courts', 'courts', 'courts'], ['Tous les appels, un par un', 'appels', 'appels']]],
  reparer: ['On commence par quoi ?', [['Le plus urgent d\'abord', 'priorites', 'priorites'], ['La note de chaque magasin', 'sante', 'sante'],
    ['Ce qu\'il faut changer dans la console 3CX', 'actions', 'actions'], ['Les numéros qui ne mènent nulle part', 'controle', 'controle'], ['Les appels qui tournent en rond', 'pieges', 'pieges']]],
  gens: ['Que se passe-t-il ?', [['Quelqu\'un arrive', 'nouvel', 'nouvel'], ['Quelqu\'un part', 'depart', 'depart'], ['Quelqu\'un remplace quelqu\'un', 'changement', 'changement'], ['Quelqu\'un est absent ou en congé', 'absences', 'absences'], ['Un magasin ouvre', 'ouvmag', 'ouvmag']]],
  magasin: ['Qu\'est-ce que vous voulez voir ?', [['Sa fiche', 'fichemag', 'fichemag'], ['Son rapport, à imprimer', 'rapport', 'rapport'], ['Son classement face aux autres', 'classement', 'classement'],
    ['Ses heures d\'ouverture', 'horaires', 'horaires'], ['Les jours fériés à préparer', 'feries', 'feries']]],
  trouver: ['Vous cherchez quoi ?', [['La fiche d\'un employé', 'employe', 'employe'], ['L\'annuaire', 'annuaire', 'annuaire'], ['Qui dépend de qui', 'organigramme', 'organigramme'], ['Un poste', 'postes', 'postes']]],
  chemin: ['Qu\'est-ce que vous voulez savoir ?', [['Où sonne un appel, en le testant', 'simulateur', 'simulateur'], ['Le dessin du chemin', 'diagramme', 'diagramme'],
    ['Les menus vocaux (tapez 1, tapez 2…)', 'ivr', 'ivr'], ['Les files d\'attente', 'files', 'files'], ['Les groupes qui sonnent ensemble', 'sonnerie', 'sonnerie']]],
  autre: ['Voici le reste. Lequel ?', [['Les téléphones et leurs touches', 'telephones', '>tel'], ['Les chiffres', 'stats', '>chiffres'], ['Les messages vocaux', 'audio', '>vocal'],
    ['La sécurité', 'securite', '>securite'], ['Ce qui a changé', 'modifs', '>change'], ['L\'apparence de 3CXplore', 'interface', 'interface']]],
  tel: ['Plutôt quoi ?', [['La liste des postes', 'postes', 'postes'], ['Les téléphones de bureau', 'telephones', 'telephones'], ['Les touches des téléphones', 'blf', 'blf'], ['Les lignes vers l\'extérieur', 'trunks', 'trunks']]],
  chiffres: ['Quels chiffres ?', [['Le résumé de tous les appels', 'stats', 'stats'], ['Un rapport sur une personne, une file ou un numéro', 'genrap', 'genrap'], ['Un graphique à mon goût', 'gengraph', 'gengraph'], ['D\'où viennent les appels', 'provenance', 'provenance'], ['Combien coûtent les appels sortants', 'couts', 'couts'],
    ['Combien de personnes il faut', 'effectif', 'effectif'], ['Le tableau de bord', 'dashboard', 'dashboard']]],
  vocal: ['Lequel ?', [['Les boîtes vocales', 'messageries', 'messageries'], ['Comment on arrive à une boîte vocale', 'vmchemins', 'vmchemins'], ['Qui peut laisser un message', 'recobv', 'recobv'], ['Les messages d\'accueil', 'audio', 'audio'], ['Les enregistrements', 'enreg', 'enreg']]],
  securite: ['Qu\'est-ce qui vous inquiète ?', [['Qui peut voir quoi', 'visibilite', 'visibilite'], ['Les renvois vers l\'extérieur', 'renvois', 'renvois'], ['Les appels bizarres', 'suspects', 'suspects'], ['Le bilan de sécurité', 'securite', 'securite']]],
  change: ['Depuis quand ?', [['Les dernières modifications', 'modifs', 'modifs'], ['Le journal complet', 'audit', 'audit'], ['Avant et après une date', 'avantapres', 'avantapres']]],
};
let ASK_PATH = []; // réponses choisies depuis le début (gardées pendant la session : « Accueil » ramène où on en était)
V.accueil = el => {
  // 20.2.2 : raccourci « Fermer le backup » (même fenêtre que la carte du tableau de bord), avec le nom du backup ouvert
  const bkName = D.source && D.source.kind === 'zip' ? D.source.name : '';
  const n = RECO_COUNT, logo = (document.querySelector('.brandlogo') || {}).outerHTML || '';
  const hello = `Bonjour ! ${n ? `Il y a ${nf(n)} ${n > 1 ? 'choses' : 'chose'} à réparer dans votre 3CX.` : 'Rien d\'urgent à réparer dans votre 3CX.'} Qu'est-ce que vous voulez faire ?`;
  const bot = t => `<div class="askrow"><span class="askav" aria-hidden="true">${logo}</span><p class="askq">${esc(t)}</p></div>`;
  const draw = () => {
    let id = 'start', h = bot(hello);
    for(const i of ASK_PATH){ const a = ASK[id][1][i]; h += `<div class="askme"><span>${esc(a[0])}</span></div>`; id = a[2].slice(1); h += bot(ASK[id][0]); }
    h += `<div class="askopts" role="group" aria-label="Réponses">${ASK[id][1].map(([l, ic, to], i) => (to[0] === '>' || TAB_BY[to.split('/')[0]]) ? `<button type="button" data-ask="${i}" style="--rc:${navColor(to[0] === '>' ? ic : to.split('/')[0])}">${navIcon(ic)}<span>${esc(l)}</span></button>` : '').join('')}</div>`;
    if(ASK_PATH.length) h += `<div class="asknav"><button type="button" class="btn" data-askback>Revenir en arrière</button><button type="button" class="btn" data-askreset>Recommencer</button></div>`;
    el.querySelector('#askchat').innerHTML = h;
    const rows = el.querySelectorAll('#askchat .askrow'); if(ASK_PATH.length) rows[rows.length - 1].classList.add('asknew');
  };
  el.innerHTML = `<div class="ask"><h2 class="sr-only">Accueil</h2><div id="askchat" aria-live="polite"></div>
    <div class="askfoot"><p>Vous pouvez aussi écrire ce que vous cherchez :</p>
      <div class="hosearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"/></svg><input id="hoq" type="search" autocomplete="off" spellcheck="false" placeholder="Par exemple : appels manqués, jours fériés, un nom, sda KM…" aria-label="Chercher une page, un poste, un SDA…" aria-controls="hores"></div>
      <div id="hores" class="hores" role="listbox" aria-label="Pages trouvées" hidden></div>
      <p class="askmenu"><button type="button" class="btn" data-askmenu><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Ouvrir le menu complet</button>
        <button type="button" class="btn danger" data-askclose><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Fermer le backup</button></p>
      ${bkName ? `<p class="askbk muted">Backup ouvert : <b>${esc(bkName)}</b></p>` : ''}</div></div>`;
  draw();
  el.querySelector('.ask').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.hasAttribute('data-askclose')){ if(typeof BK !== 'undefined' && BK.closeDialog) BK.closeDialog(true); return; }
    if(b.hasAttribute('data-askmenu')){ window.setNavOpen(true); return; }
    if(b.hasAttribute('data-askback')){ ASK_PATH.pop(); return draw(); }
    if(b.hasAttribute('data-askreset')){ ASK_PATH = []; return draw(); }
    if(!b.dataset.ask) return;
    let id = 'start'; for(const i of ASK_PATH) id = ASK[id][1][i][2].slice(1);
    const [, , to] = ASK[id][1][+b.dataset.ask];
    if(to[0] === '>'){ ASK_PATH.push(+b.dataset.ask); draw(); const f = el.querySelector('.askopts button'); if(f) f.focus({preventScroll: true}); }
    else location.hash = '#' + to;
  });
  // recherche : les mêmes pages que la recherche du menu, avec leur rubrique, puis (20.3.3) ce que trouve la barre du haut : postes, SDA, files, téléphones, contacts
  const inp = el.querySelector('#hoq'), res = el.querySelector('#hores');
  let found = [];
  inp.addEventListener('input', () => {
    const words = navNorm(inp.value.trim()).split(/\s+/).filter(Boolean); res.hidden = !words.length; if(!words.length){ res.innerHTML = ''; return; }
    const hits = navEntries().filter(e => { const s = navNorm([e.l, navTr(e.l), ...e.path, ...e.path.map(navTr)].join(' ')); return words.every(w => s.includes(w)); }).slice(0, 8);
    found = window.__app.gsSearch ? window.__app.gsSearch(inp.value).slice(0, 10) : [];
    res.innerHTML = (hits.length ? hits.map(e => `<a href="#${e.k}" role="option" style="--rc:${navColor(SET_OF[e.k] || e.k)}">${navIcon(e.k)}<span><b>${esc(navTr(e.l))}</b><small>${e.path.map(x => esc(navTr(x))).join(' › ')}</small></span></a>`).join('') : '')
      + (found.length ? `<p class="hogs">Dans le système</p>${found.map((r, i) => `<a href="#" role="option" data-gs="${i}" style="--rc:var(--accent)"><span class="pill">${esc(r.kind)}</span><span><b>${esc(r.label)}</b><small>${esc(r.sub || '')}</small></span></a>`).join('')}` : '')
      || '<p class="muted">Rien ne correspond. Essayez un autre mot, par exemple « appels », « poste », un nom ou un numéro (« sda KM »).</p>';
  });
  const openGs = a => { const r = found[+a.dataset.gs]; if(r){ inp.value = ''; res.hidden = true; r.open(); } };
  res.addEventListener('click', e => { const a = e.target.closest('[data-gs]'); if(a){ e.preventDefault(); openGs(a); } });
  inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ const a = res.querySelector('a'); if(a){ e.preventDefault(); if(a.dataset.gs) openGs(a); else location.hash = a.getAttribute('href'); } } });
};
