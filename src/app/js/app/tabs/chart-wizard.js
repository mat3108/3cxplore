// ---------- Générateur de graphique (20.3) : comme le générateur de rapport, un assistant pose des questions (quoi mesurer, sur quoi, lequel,
// quelle période, découpé comment, quel graphique, comparer ou non avec avant) puis dessine le graphique, avec ses chiffres clés, son tableau et ses exports ----------
const GVZ_KEY = 'gengraph3cx';
// ce que l'on peut mesurer : [id, libellé français, libellé anglais, genre, source (c appels, q files), sujets permis, sens favorable]
// genre : count = un nombre d'appels, stack = des appels répartis par résultat, ratio = un pourcentage, avg = une durée moyenne (s)
const GVZ_M = [
  ['recv', "Le nombre d'appels entrants", 'The number of inbound calls', 'count', 'c', ['all', 'store', 'did', 'ext'], ''],
  ['res', 'Les appels entrants : répondus, messagerie ou perdus', 'Inbound calls: answered, voicemail or lost', 'stack', 'c', ['all', 'store', 'did'], ''],
  ['rate', 'Le taux de réponse', 'The answer rate', 'ratio', 'c', ['all', 'store', 'did'], 'up'],
  ['lost', 'Les appels perdus', 'Lost calls', 'count', 'c', ['all', 'store', 'did'], 'down'],
  ['out', "Les appels vers l'extérieur", 'Outside calls', 'count', 'c', ['all', 'store', 'ext'], ''],
  ['pick', 'Le délai avant réponse', 'The time to answer', 'avg', 'c', ['all', 'store', 'did'], 'down'],
  ['talk', 'La durée des conversations', 'Conversation length', 'avg', 'c', ['all', 'store', 'did', 'ext'], ''],
  ['qcalls', "Les appels en file d'attente : servis ou non", 'Queue calls: served or not', 'stack', 'q', ['all', 'store', 'queue'], ''],
  ['qwait', "L'attente en file d'attente", 'Queue waiting time', 'avg', 'q', ['all', 'store', 'queue'], 'down'],
];
const GVZ_MB = Object.fromEntries(GVZ_M.map(x => [x[0], x]));
// postes qui ont parlé sur un appel : [poste, 'in' | 'out', conversation (s)] ; un entrant compte pour chaque poste qui lui a parlé (transfert)
function gvzExtParts(c){
  const r = [];
  if(c[1] === 'in'){ const seen = new Set();
    (Array.isArray(c[11]) ? c[11] : []).forEach(([x, t]) => { if(EXT_BY[x] && (t > 0 || c[6] === x)){ seen.add(x); r.push([x, 'in', t || (c[6] === x ? c[8] || 0 : 0)]); } });
    if(EXT_BY[c[6]] && !seen.has(c[6])) r.push([c[6], 'in', c[8] || 0]); }
  else if(c[1] === 'out' && EXT_BY[c[2]]) r.push([c[2], 'out', c[10] === 'ans' ? c[8] || 0 : 0]);
  return r;
}

V.gengraph = el => {
  const S = window.__gvz ||= (() => { try{ return JSON.parse(localStorage.getItem(GVZ_KEY) || '{}'); }catch(e){ return {}; } })();
  const en = document.documentElement.lang === 'en', T = (fr, e) => en ? e : fr, loc = en ? 'en-CA' : 'fr-CA';
  const all = FULL.calls, first = all.length ? callHist().first : '', last = all.length ? localParts(all[0][0])[0] : '';
  const save = () => { try{ localStorage.setItem(GVZ_KEY, JSON.stringify({m: S.m, k: S.k, id: S.id, p: S.p, g: S.g, t: S.t, cmp: S.cmp, step: S.step, done: S.done})); }catch(e){} };
  const title = T('Générateur de graphique', 'Chart generator');
  if(!all.length){ el.innerHTML = `<h2>${title}</h2><p class="muted">${T('Aucun appel dans ce backup.', 'No calls in this backup.')}</p>`; return; }
  const M = () => GVZ_MB[S.m], kind = () => (M() || [])[3];
  const mLab = id => (x => x ? T(x[1], x[2]) : '')(GVZ_MB[id]);
  const KL = {all: SEG ? T('Le magasin affiché', 'The store shown') : T('Tous les appels', 'All calls'), store: T('Un magasin', 'A store'), ext: T('Un utilisateur', 'A user'), queue: T("Une file d'attente", 'A queue'), did: T('Un numéro entrant (SDA)', 'An incoming number (DID)')};
  const KI = {all: 'stats', store: 'magasins', ext: 'employe', queue: 'files', did: 'numero'};
  const MI = {recv: 'appels', res: 'stats', rate: 'classement', lost: 'rappels', out: 'destinations', pick: 'delai', talk: 'attente', qcalls: 'statsfiles', qwait: 'files'};
  const stores = () => SEG_LIST.filter(c => c !== SEG_BRIDGE && (!SEG || c === SEG)).map(c => ({id: c, l: segName(c), s: c === SEG_COMMON ? '' : c, n: null}));
  const subjects = k => k === 'store' ? stores() : grpSubjects(k);
  const subj = () => S.k === 'all' ? {id: '', l: KL.all, s: ''} : (subjects(S.k).find(x => x.id === S.id) || null);
  const perLab = p => p === 'all' ? T("Tout l'historique", 'All history') : perIsC(p) ? (() => { const [a, b] = perRange(p, first, last); return T(`Du ${a} au ${b}`, `From ${a} to ${b}`); })() : T(`${p} derniers jours`, `Last ${p} days`);
  // découpages possibles selon la mesure et le sujet
  const BY = {store: T('Comparer les magasins', 'Compare the stores'), did: T('Comparer les numéros entrants (SDA)', 'Compare the incoming numbers (DIDs)'), queue: T("Comparer les files d'attente", 'Compare the queues'), ext: T('Comparer les employés', 'Compare the employees')};
  const gOpts = () => { const m = M(); if(!m) return [];
    const o = [['time', T('Dans le temps', 'Over time'), 'prevision', T('Par jour, par semaine ou par mois selon la longueur de la période', 'By day, week or month depending on the period length')],
      ['hour', T('Par heure de la journée', 'By hour of the day'), 'horaires', ''], ['wd', T('Par jour de la semaine', 'By day of the week'), 'absences', ''],
      ['heat', T('Heure et jour ensemble', 'Hour and day together'), 'classement', T('Une grille jour × heure : plus la case est foncée, plus le chiffre est élevé', 'A day × hour grid: the darker the cell, the higher the figure')]];
    if(S.k === 'all' || S.k === 'store'){
      if(S.k === 'all' && !SEG && SEG_LIST.length > 3) o.push(['by:store', BY.store, 'magasins', '']);
      if(['recv', 'res', 'rate', 'lost', 'pick'].includes(m[0])) o.push(['by:did', BY.did, 'numero', T('Les 15 qui reçoivent le plus d\'appels', 'The 15 with the most calls')]);
      if(m[4] === 'q') o.push(['by:queue', BY.queue, 'files', T('Les 15 plus occupées', 'The 15 busiest')]);
      if(['recv', 'out', 'talk'].includes(m[0])) o.push(['by:ext', BY.ext, 'employe', T('Les 15 qui ont le plus d\'appels', 'The 15 with the most calls')]);
    }
    return o; };
  const gLab = g => (gOpts().find(x => x[0] === g) || [, ''])[1];
  const tOpts = () => { if(!S.g || S.g === 'heat') return [];
    if(kind() === 'stack') return [['stack', T('Barres empilées', 'Stacked bars'), 'stats', T('Recommandé : on voit le total et sa répartition', 'Recommended: shows the total and how it splits')], ['pct', T('En pourcentage (100 %)', 'As a percentage (100%)'), 'classement', T('Chaque barre fait 100 % : on compare les parts', 'Each bar is 100%: compares the shares')]];
    if(S.g.startsWith('by:')) return [];
    return [['auto', T('Choisir pour moi', 'Choose for me'), 'stats', T('Recommandé : une courbe pour une longue suite de jours, des colonnes sinon', 'Recommended: a line for a long run of days, columns otherwise')], ['bar', T('Des colonnes', 'Columns'), 'stats', ''], ['line', T('Une courbe', 'A line'), 'prevision', '']]; };
  const tLab = t => (tOpts().find(x => x[0] === t) || [, ''])[1];
  // la période juste avant doit être entièrement dans l'historique (20.3.1), sinon la comparaison serait faussée par des jours sans données
  const prevOk = () => { const [a, b] = perRange(S.p || '30', first, last), d = Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1; return addDaysISO(a, -d) >= first; };
  const cmpOk = () => S.p && S.p !== 'all' && S.g && S.g !== 'heat' && kind() !== 'stack' && prevOk();
  const steps = () => [
    ['m', T('Bonjour ! Je vais vous faire un graphique. Qu\'est-ce que vous voulez voir ?', "Hello! I'll make you a chart. What do you want to see?"), S.m ? mLab(S.m) : ''],
    ['k', T('Pour quoi ?', 'For what?'), S.k ? KL[S.k] : ''],
    ...(S.k && S.k !== 'all' ? [['id', S.k === 'store' ? T('Quel magasin ?', 'Which store?') : S.k === 'ext' ? T('Quel utilisateur ?', 'Which user?') : S.k === 'queue' ? T("Quelle file d'attente ?", 'Which queue?') : T('Quel numéro entrant ?', 'Which incoming number?'), (s => s ? `${s.l}${s.s && s.s !== s.l ? ` (${s.s})` : ''}` : '')(subj())]] : []),
    ['p', T('Sur quelle période ?', 'For what period?'), S.p ? perLab(S.p) : ''],
    ['g', T('Comment voulez-vous découper les chiffres ?', 'How do you want to split the figures?'), S.g ? gLab(S.g) : ''],
    ...(tOpts().length ? [['t', T('Quel genre de graphique ?', 'What kind of chart?'), S.t ? tLab(S.t) : '']] : []),
    ...(cmpOk() ? [['cmp', T('Voulez-vous voir aussi la période juste avant, pour comparer ?', 'Do you also want to see the period just before, to compare?'), S.cmp == null ? '' : S.cmp ? T('Oui, comparer', 'Yes, compare') : T('Non', 'No')]] : []),
  ];
  const logo = (document.querySelector('.brandlogo') || {}).outerHTML || '';
  const bot = t => `<div class="askrow"><span class="askav" aria-hidden="true">${logo}</span><p class="askq">${esc(t)}</p></div>`;
  const rc = `--rc:${navColor('gengraph')}`;
  const head = `<h2>${title}</h2><p class="lead">${T('Répondez à quelques questions : le graphique se construit avec ce que vous avez choisi (quoi, pour qui, sur quelle période, découpé comment), avec ses chiffres clés et son tableau, prêt à imprimer, à enregistrer en image ou à exporter en Excel.', 'Answer a few questions: the chart is built from your choices (what, for whom, over which period, split how), with its key figures and its table, ready to print, save as an image or export to Excel.')}</p>`;

  // ---------------- assistant ----------------
  function drawWizard(){
    const st = steps(); S.step = Math.min(S.step || 0, st.length - 1);
    let h = '';
    st.slice(0, S.step).forEach(([, q, a]) => { h += bot(q) + `<div class="askme"><span>${esc(a)}</span></div>`; });
    const [id, q] = st[S.step]; h += `<div class="asknew">${bot(q)}</div>`;
    const opt = (i, l, ic, sub) => `<button type="button" data-v="${esc(i)}" style="${rc}">${ic ? navIcon(ic) : ''}<span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    if(id === 'm') h += `<div class="askopts" role="group">${GVZ_M.map(x => opt(x[0], T(x[1], x[2]), MI[x[0]])).join('')}</div>`;
    else if(id === 'k') h += `<div class="askopts" role="group">${M()[5].filter(k => k !== 'store' || stores().length > 1).map(k => opt(k, KL[k], KI[k])).join('')}</div>`;
    else if(id === 'id') h += `<div class="grpfind"><div class="hosearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"/></svg><input id="gvzq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(T('Chercher un nom ou un numéro…', 'Search a name or number…'))}" aria-label="${esc(T('Chercher', 'Search'))}"></div></div><div class="askopts grpids" role="group" id="gvzids"></div>`;
    else if(id === 'p') h += `<div class="askopts" role="group">${['7', '30', '90', 'all'].map(v => opt(v, perLab(v), 'stats')).join('')}${opt('custom', T('Des dates au choix', 'Custom dates'), 'absences')}</div>
      <div class="grpdates" id="gvzdates" hidden><label>${T('Du', 'From')} <input type="date" id="gvzf" min="${first}" max="${last}" value="${perIsC(S.p) ? perRange(S.p, first, last)[0] : addDaysISO(last, -29) < first ? first : addDaysISO(last, -29)}"></label>
        <label>${T('au', 'to')} <input type="date" id="gvzt" min="${first}" max="${last}" value="${perIsC(S.p) ? perRange(S.p, first, last)[1] : last}"></label><button type="button" class="btn primary" id="gvzdok">${T('Continuer', 'Continue')}</button>
        <span class="muted">${T(`Historique disponible du ${first} au ${last}.`, `History available from ${first} to ${last}.`)}</span></div>`;
    else if(id === 'g') h += `<div class="askopts" role="group">${gOpts().map(([v, l, ic, sub]) => opt(v, l, ic, sub)).join('')}</div>`;
    else if(id === 't') h += `<div class="askopts" role="group">${tOpts().map(([v, l, ic, sub]) => opt(v, l, ic, sub)).join('')}</div>`;
    else if(id === 'cmp') h += `<div class="askopts" role="group">${opt('1', T('Oui, comparer', 'Yes, compare'), 'avantapres', T('La période d\'avant s\'affiche en gris à côté', 'The previous period shows in grey alongside'))}${opt('0', T('Non', 'No'), 'stats')}</div>`;
    if(S.step) h += `<div class="asknav"><button type="button" class="btn" data-back>${T('Revenir en arrière', 'Go back')}</button><button type="button" class="btn" data-reset>${T('Recommencer', 'Start over')}</button></div>`;
    el.innerHTML = `<div id="gvzwrap">${head}<div class="ask grpask" id="gvzchat" aria-live="polite">${h}</div></div>`;
    const W = el.querySelector('#gvzwrap');
    const next = () => { S.step++; if(S.step >= steps().length){ S.done = true; save(); return draw(); } save(); drawWizard(); const f = W.querySelector('.asknew ~ .askopts button, #gvzq'); if(f) f.focus({preventScroll: true}); };
    W.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.hasAttribute('data-back')){ S.step--; save(); return drawWizard(); }
      if(b.hasAttribute('data-reset')){ Object.keys(S).forEach(k => delete S[k]); save(); return drawWizard(); }
      if(b.id === 'gvzdok'){ const f = $('#gvzf').value, t = $('#gvzt').value; if(f && t){ S.p = `c:${f}:${t}`; next(); } return; }
      const v = b.dataset.v; if(v == null) return;
      // une réponse changée efface les réponses qui en dépendent
      if(id === 'm'){ if(S.m !== v){ S.m = v; if(!GVZ_MB[v][5].includes(S.k)){ S.k = ''; S.id = ''; } S.g = ''; S.t = ''; S.cmp = null; } }
      else if(id === 'k'){ if(S.k !== v){ S.k = v; S.id = ''; S.g = ''; S.t = ''; } }
      else if(id === 'id') S.id = v;
      else if(id === 'p'){ if(v === 'custom'){ $('#gvzdates').hidden = false; $('#gvzf').focus(); return; } S.p = v; }
      else if(id === 'g'){ if(S.g !== v){ S.g = v; S.t = ''; } }
      else if(id === 't') S.t = v;
      else if(id === 'cmp') S.cmp = v === '1';
      next();
    });
    if(id === 'id'){
      const L = subjects(S.k).sort((a, b) => (b.n || 0) - (a.n || 0) || String(a.s || a.l).localeCompare(String(b.s || b.l), undefined, {numeric: true})), box = $('#gvzids'), inp = $('#gvzq');
      const show = () => { const w = inp.value.trim().toLowerCase(), wd = w.replace(/\D/g, '');
        const hit = L.filter(x => !w || x.l.toLowerCase().includes(w) || String(x.s).toLowerCase().includes(w) || (wd && String(x.id).replace(/\D/g, '').includes(wd)));
        box.innerHTML = hit.slice(0, 24).map(x => opt(x.id, x.l, KI[S.k], [x.s && x.s !== x.l ? x.s : '', x.n != null ? T(`${nf(x.n)} appel${x.n > 1 ? 's' : ''}`, `${nf(x.n)} call${x.n > 1 ? 's' : ''}`) : ''].filter(Boolean).join(' · '))).join('')
          + (hit.length > 24 ? `<p class="muted grpmore">${T(`… et ${nf(hit.length - 24)} autres : précisez la recherche.`, `… and ${nf(hit.length - 24)} more: refine the search.`)}</p>` : '')
          + (!hit.length ? `<p class="muted grpmore">${T('Aucun résultat.', 'No result.')}</p>` : ''); };
      inp.addEventListener('input', show);
      inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ const f = box.querySelector('button'); if(f){ e.preventDefault(); f.click(); } } });
      show();
    }
  }

  // ---------------- données ----------------
  const WDS = en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const WDL = en ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const wdOf = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const monthLab = (m, long) => new Date(m + '-15T12:00:00Z').toLocaleDateString(loc, {month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC'});
  function build(){
    const m = M(), s = subj(); if(!m || !s || !S.g || !gOpts().some(x => x[0] === S.g)) return null;
    const K = m[3], src = m[4], g = S.g, by = g.startsWith('by:') ? g.slice(3) : '';
    const [from, to] = perRange(S.p || '30', first, last), days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
    const pTo = addDaysISO(from, -1), pFrom = addDaysISO(from, -days), hasPrev = !!(S.cmp && cmpOk());
    // jours de la période avant le début réel de l'historique (20.3.1) : pas de données, grisés, hors des moyennes
    const H = callHist(), cFrom = from < H.first ? H.first : from, cDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(cFrom)) / 864e5) + 1);
    const extMode = S.k === 'ext' || by === 'ext';
    // découpage dans le temps : par jour jusqu'à 45 jours, par semaine (lundi) jusqu'à 210 jours, par mois au-delà
    const unit = days <= 45 ? 'day' : days <= 210 ? 'week' : 'month';
    const tKey = lp => unit === 'day' ? lp[0] : unit === 'week' ? addDaysISO(lp[0], -lp[2]) : lp[0].slice(0, 7);
    const tKeys = (a, b) => { const r = [];
      if(unit === 'day') for(let d = a; d <= b; d = addDaysISO(d, 1)) r.push(d);
      else if(unit === 'week') for(let d = addDaysISO(a, -wdOf(a)); d <= b; d = addDaysISO(d, 7)) r.push(d);
      else for(let mo = a.slice(0, 7); mo <= b.slice(0, 7); mo = (([y, n]) => n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, '0')}`)(mo.split('-').map(Number))) r.push(mo);
      return r; };
    const qSeg = r => SEGOF[r[1]] || SEG_COMMON;
    const gKey = (lp, rec, x) => g === 'time' ? tKey(lp) : g === 'hour' ? lp[1] : g === 'wd' ? lp[2] : g === 'heat' ? lp[2] * 24 + lp[1]
      : by === 'store' ? (src === 'c' ? callSeg(rec) : qSeg(rec)) : by === 'did' ? rec[5] : by === 'queue' ? rec[1] : x;
    const nk = normNum(S.id);
    const okC = c => S.k === 'all' ? !SEG || callSeg(c) === SEG : S.k === 'store' ? callSeg(c) === S.id : S.k === 'did' ? c[1] === 'in' && (c[5] === S.id || (nk && normNum(c[5]) === nk)) : true;
    const okQ = r => S.k === 'all' ? !SEG || qSeg(r) === SEG : S.k === 'store' ? qSeg(r) === S.id : r[1] === S.id;
    // ce que chaque appel apporte à la mesure : push(apport, poste)
    const emitC = (c, push) => {
      const d = c[1], st = c[10]; if(d === 'transit') return;
      const xp = () => gvzExtParts(c).filter(p => S.k !== 'ext' || p[0] === S.id);
      switch(m[0]){
        case 'recv': if(d !== 'in') return; if(extMode) xp().forEach(p => push({n: 1}, p[0])); else push({n: 1}); return;
        case 'res': if(d !== 'in' || st === 'bridge') return; push({cat: ST_ANS.has(st) ? 'ans' : st === 'vm' ? 'vm' : 'lost'}); return;
        case 'rate': if(d !== 'in' || st === 'bridge') return; push({num: ST_ANS.has(st) ? 1 : 0, den: 1}); return;
        case 'lost': if(d === 'in' && ST_LOST.has(st)) push({n: 1}); return;
        case 'out': if(d !== 'out') return; if(extMode) xp().forEach(p => push({n: 1}, p[0])); else push({n: 1}); return;
        case 'pick': if(d === 'in' && ST_ANS.has(st) && c[12] != null) push({v: c[12]}); return;
        case 'talk': if(extMode){ xp().forEach(p => { if(p[2] > 0) push({v: p[2]}, p[0]); }); return; }
          if((d === 'in' && ST_ANS.has(st)) || (S.k !== 'did' && d === 'out' && st === 'ans')) push({v: c[8] || 0}); return;
      } };
    const emitQ = (r, push) => { if(m[0] === 'qcalls') push({cat: r[6] ? 'sv' : 'ns'}); else push({v: r[4]}); };
    const blank = () => ({n: 0, cats: {}, num: 0, den: 0, sum: 0, cnt: 0, vals: [], recs: []});
    const add = (a, x, keep) => { if(x.n) a.n += x.n; if(x.cat) a.cats[x.cat] = (a.cats[x.cat] || 0) + 1; if(x.den){ a.num += x.num; a.den += x.den; } if(x.v != null){ a.sum += x.v; a.cnt++; if(keep) a.vals.push(x.v); } };
    const run = (a, b, keepRecs) => { const acc = new Map(), tot = blank();
      const rows = src === 'c' ? all : FULL.queueCalls, ok = src === 'c' ? okC : okQ, emit = src === 'c' ? emitC : emitQ;
      for(const rec of rows){ const lp = localParts(rec[0]); if(lp[0] > b) continue; if(lp[0] < a) break; // les deux listes sont triées du plus récent au plus ancien
        if(!ok(rec)) continue;
        emit(rec, (x, ext) => { if(extMode && S.k === 'ext' && ext !== S.id) return; add(tot, x, true); const k = gKey(lp, rec, ext); if(k == null || k === '') return; let o = acc.get(k); if(!o) acc.set(k, o = blank()); add(o, x); if(keepRecs) o.recs.push([rec, x, ext]); }); } // 20.4 : les appels derrière chaque barre
      return {acc, tot}; };
    const cur = run(cFrom, to, true), prv = hasPrev ? run(pFrom, pTo) : null;
    const CATS = m[0] === 'res' ? [['ans', T('Répondus', 'Answered'), 's1'], ['vm', T('Messagerie', 'Voicemail'), 's3'], ['lost', T('Perdus', 'Lost'), 's2']] : m[0] === 'qcalls' ? [['sv', T('Servis', 'Served'), 's1'], ['ns', T('Non servis', 'Not served'), 's2']] : [];
    const val = a => !a ? (K === 'count' || K === 'stack' ? 0 : null) : K === 'count' ? a.n : K === 'stack' ? CATS.reduce((t, [c]) => t + (a.cats[c] || 0), 0) : K === 'ratio' ? (a.den ? 100 * a.num / a.den : null) : (a.cnt ? a.sum / a.cnt : null);
    const vol = a => !a ? 0 : K === 'count' ? a.n : K === 'stack' ? val(a) : K === 'ratio' ? a.den : a.cnt;
    // catégories (axe des x, ou lignes pour une comparaison)
    let cats = [], prevKeys = null;
    const tTitle = k => unit === 'day' ? `${WDL[wdOf(k)]} ${k}` : unit === 'week' ? T(`Semaine du ${k} au ${addDaysISO(k, 6)}`, `Week of ${k} to ${addDaysISO(k, 6)}`) : monthLab(k, true);
    const tShort = k => unit === 'day' ? k.slice(5) : unit === 'week' ? k.slice(5) : monthLab(k);
    if(g === 'time'){ cats = tKeys(from, to).map(k => ({k, l: tShort(k), tt: tTitle(k)})); if(prv) prevKeys = tKeys(pFrom, pTo); }
    else if(g === 'hour'){ const used = [...cur.acc.keys(), ...(prv ? prv.acc.keys() : [])].map(Number), h0 = used.length ? Math.min(...used) : 8, h1 = used.length ? Math.max(...used) : 17;
      for(let h = h0; h <= h1; h++) cats.push({k: h, l: `${h} h`, tt: T(`De ${h} h à ${h + 1} h`, `From ${h}:00 to ${h + 1}:00`)}); }
    else if(g === 'wd') cats = WDS.map((l, i) => ({k: i, l, tt: WDL[i]}));
    else if(g === 'heat') cats = [];
    else { const name = k => by === 'store' ? segName(k) : by === 'did' ? phone(k) || k : `${k} ${dnName(k)}`.trim();
      cats = [...cur.acc.entries()].sort((a, b) => vol(b[1]) - vol(a[1])).slice(0, 15).map(([k]) => ({k, l: name(k), tt: name(k)}));
      cats.sort((a, b) => (val(cur.acc.get(b.k)) ?? -1) - (val(cur.acc.get(a.k)) ?? -1)); }
    const curLab = T('Période choisie', 'Chosen period'), prevLab = T('Période d\'avant', 'Previous period');
    const series = K === 'stack' ? CATS.map(([c, l, col]) => ({id: c, l, col, v: cats.map(x => (cur.acc.get(x.k) || {cats: {}}).cats[c] || 0)}))
      : [{id: 'cur', l: hasPrev ? curLab : mLab(m[0]), col: 's1', v: cats.map(x => val(cur.acc.get(x.k))), n: cats.map(x => vol(cur.acc.get(x.k)))},
        ...(prv ? [{id: 'prev', l: prevLab, col: 'prev', v: cats.map((x, i) => val(prv.acc.get(prevKeys ? prevKeys[i] : x.k))), n: cats.map((x, i) => vol(prv.acc.get(prevKeys ? prevKeys[i] : x.k))), keys: prevKeys}] : [])];
    const nod = cats.map(c => g === 'time' && (unit === 'day' ? c.k < H.first : unit === 'week' ? addDaysISO(c.k, 6) < H.first : c.k < H.first.slice(0, 7)));
    series.forEach(x => { x.v = x.v.map((v, i) => nod[i] ? null : v); if(x.n) x.n = x.n.map((v, i) => nod[i] ? null : v); });
    // grille jour × heure
    let heat = null;
    if(g === 'heat'){ const used = [...cur.acc.keys()].map(k => k % 24), h0 = used.length ? Math.min(...used) : 8, h1 = used.length ? Math.max(...used) : 17;
      heat = {h0, h1, v: WDS.map((l, w) => { const r = []; for(let h = h0; h <= h1; h++) r.push(val(cur.acc.get(w * 24 + h))); return r; }), n: WDS.map((l, w) => { const r = []; for(let h = h0; h <= h1; h++) r.push(vol(cur.acc.get(w * 24 + h))); return r; })}; }
    return {m, K, s, g, by, src, extMode, unit, from, to, days, H, cFrom, cDays, nod, pFrom, pTo, hasPrev, cur, prv, cats, series, heat, CATS, val, vol};
  }

  // ---------------- dessin ----------------
  const fmtV = (K, v) => v == null ? '–' : K === 'ratio' ? `${(Math.round(v * 10) / 10).toLocaleString(loc)} %` : K === 'avg' ? dur(Math.round(v)) : nf(Math.round(v));
  const fmtAx = (K, v, pct) => pct || K === 'ratio' ? `${v} %` : K === 'avg' ? (v < 60 ? `${v} s` : v % 60 ? dur(v) : `${v / 60} min`) : v >= 1000 ? `${(v / 1000).toLocaleString(loc)} k` : nf(v);
  // graduations rondes : 4 ou 5 lignes, en secondes rondes pour les durées
  const nice = (max, K, pct) => { if(pct) return {top: 100, step: 25}; if(K === 'ratio' && max > 50) return {top: 100, step: 25};
    max = Math.max(max, K === 'count' || K === 'stack' ? 4 : 1);
    const cand = K === 'avg' ? [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 7200] : (() => { const r = []; for(let e = 0; e < 9; e++) [1, 2, 5].forEach(b => r.push(b * 10 ** e)); return r; })();
    const step = cand.find(c => max / c <= 5) || cand[cand.length - 1]; return {top: Math.ceil(max / step) * step, step}; };
  const rbar = (x, y, w, h, r) => { if(h <= 0 || w <= 0) return ''; r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const rbarH = (x, y, w, h, r) => { if(h <= 0 || w <= 0) return ''; r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  const trunc = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;

  function draw(){
    if(!S.done) return drawWizard();
    const R = build();
    if(!R){ S.done = false; S.step = 0; save(); return drawWizard(); }
    const {K, m} = R, pct = S.t === 'pct', isLine = !R.by && R.g !== 'heat' && K !== 'stack' && (S.t === 'line' || (S.t !== 'bar' && R.g === 'time' && R.cats.length > 14));
    const tips = []; // contenu des info-bulles, construit avec textContent
    const svgW = Math.max(320, Math.min(1100, (el.clientWidth || 900) - 4));
    const answers = steps().map(([, , a]) => a).filter(Boolean);
    let svg = '', legend = '', note = '';
    const grid = (x0, x1, y, top, step, h, pc) => { let o = ''; for(let v = 0; v <= top + 1e-9; v += step){ const yy = y + h - h * v / top; o += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" class="${v ? 'gvgrid' : 'gvbase'}"/><text x="${x0 - 6}" y="${yy + 4}" class="gvax" text-anchor="end">${esc(fmtAx(K, v, pc))}</text>`; } return o; };
    const tipFor = i => { const c = R.cats[i], rows = [];
      if(R.nod[i]){ tips[i] = {t: c.tt, rows: [['', T('Pas encore d\'historique', 'No history yet'), '–', T(`il commence le ${R.H.first}`, `it starts on ${R.H.first}`)]]}; return; }
      if(K === 'stack'){ const tot = R.series.reduce((t, s) => t + s.v[i], 0); R.series.forEach(s => rows.push([s.col, s.l, nf(s.v[i]), tot ? `${Math.round(100 * s.v[i] / tot)} %` : ''])); rows.push(['', T('Total', 'Total'), nf(tot), '']); }
      else R.series.forEach(s => rows.push([s.col, s.id === 'prev' && s.keys ? `${s.l} (${(R.unit === 'day' ? s.keys[i] : R.unit === 'week' ? T('sem. du ', 'wk of ') + s.keys[i] : monthLab(s.keys[i], true))})` : s.l, fmtV(K, s.v[i]),
        K === 'ratio' || K === 'avg' ? (s.n[i] ? T(`sur ${nf(s.n[i])} appel${s.n[i] > 1 ? 's' : ''}`, `over ${nf(s.n[i])} call${s.n[i] > 1 ? 's' : ''}`) : '') : '']));
      tips[i] = {t: c.tt, rows, k: c.k}; };

    if(R.g === 'heat'){
      const H = R.heat, cols = H.h1 - H.h0 + 1, ml = 44, cw = Math.max(14, (svgW - ml - 4) / cols), ch = 32, top = 22, mx = Math.max(0, ...H.v.flat().filter(v => v != null));
      const w = ml + cw * cols + 4, hgt = top + ch * 7 + 8;
      let o = ''; for(let h = H.h0; h <= H.h1; h++) if(cw >= 22 || (h - H.h0) % 2 === 0) o += `<text x="${ml + (h - H.h0 + .5) * cw}" y="14" class="gvax" text-anchor="middle">${h} h</text>`;
      H.v.forEach((row, wd) => { o += `<text x="${ml - 8}" y="${top + wd * ch + ch / 2 + 4}" class="gvax" text-anchor="end">${esc(WDS[wd])}</text>`;
        row.forEach((v, j) => { const st = v == null || v <= 0 || !mx ? -1 : Math.min(6, Math.floor(7 * v / mx - 1e-9)), x = ml + j * cw, y = top + wd * ch, i = tips.length;
          tips.push({k: wd * 24 + H.h0 + j, t: `${WDL[wd]}, ${T(`de ${H.h0 + j} h à ${H.h0 + j + 1} h`, `${H.h0 + j}:00 to ${H.h0 + j + 1}:00`)}`, rows: [['', mLab(m[0]), fmtV(K, v), K === 'ratio' || K === 'avg' ? (H.n[wd][j] ? T(`sur ${nf(H.n[wd][j])} appels`, `over ${nf(H.n[wd][j])} calls`) : '') : '']]});
          const txt = fmtV(K, v), fits = v != null && v > 0 && txt.length * 6.4 + 6 <= cw - 2;
          o += `<g class="gvcell" tabindex="0" data-i="${i}" aria-label="${esc(tips[i].t + ' : ' + txt)}"><rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" class="gvh${st}"/>${fits ? `<text x="${x + cw / 2}" y="${y + ch / 2 + 4}" text-anchor="middle" class="gvht${st}">${esc(txt)}</text>` : ''}</g>`; }); });
      svg = `<svg viewBox="0 0 ${w} ${hgt}" width="100%" class="gvsvg" role="img" aria-label="${esc(mLab(m[0]))}">${o}</svg>`;
      legend = `<div class="gvscale"><span>${esc(fmtV(K, 0))}</span>${[0, 1, 2, 3, 4, 5, 6].map(s => `<i class="gvh${s}"></i>`).join('')}<span>${esc(fmtV(K, mx))}</span><span class="muted">${T('plus foncé = plus élevé', 'darker = higher')}</span></div>`;
    }
    else if(R.by){ // barres horizontales, une ligne par magasin, SDA, file ou employé
      const n = R.cats.length, two = R.series.length === 2 && K !== 'stack', rowH = two ? 34 : 30, lw = Math.min(230, Math.round(svgW * .36)), vw = 78, x0 = lw + 10, pw = svgW - x0 - vw, top = 6, hgt = top + n * rowH + 24;
      const tot = i => R.series.reduce((t, s) => t + (s.v[i] || 0), 0), mx = K === 'stack' ? (pct ? 100 : Math.max(0, ...R.cats.map((c, i) => tot(i)))) : Math.max(0, ...R.series.flatMap(s => s.v.filter(v => v != null)));
      const sc = nice(mx, K, pct); let o = '';
      for(let v = 0; v <= sc.top + 1e-9; v += sc.step){ const x = x0 + pw * v / sc.top; o += `<line x1="${x}" x2="${x}" y1="${top}" y2="${top + n * rowH}" class="${v ? 'gvgrid' : 'gvbase'}"/><text x="${x}" y="${top + n * rowH + 16}" class="gvax" text-anchor="middle">${esc(fmtAx(K, v, pct))}</text>`; }
      R.cats.forEach((c, i) => { tipFor(i); const y = top + i * rowH;
        o += `<text x="${lw}" y="${y + rowH / 2 + 4}" class="gvlab" text-anchor="end"><title>${esc(c.l)}</title>${esc(trunc(c.l, Math.max(12, Math.floor(lw / 7))))}</text>`;
        if(K === 'stack'){ const t = tot(i); let x = x0; const segs = R.series.map(s => ({s, w: t ? pw * (pct ? 100 * s.v[i] / t : s.v[i]) / sc.top : 0})).filter(z => z.w > 0);
          segs.forEach((z, j) => { const last = j === segs.length - 1, ww = Math.max(0, z.w - (last ? 0 : 2)); o += last ? `<path d="${rbarH(x, y + (rowH - 20) / 2, ww, 20, 4)}" class="gv-${z.s.col}"/>` : `<rect x="${x}" y="${y + (rowH - 20) / 2}" width="${ww}" height="20" class="gv-${z.s.col}"/>`; x += z.w; });
          o += `<text x="${x0 + pw * (pct ? (t ? 100 : 0) : t) / sc.top + 6}" y="${y + rowH / 2 + 4}" class="gvval">${esc(nf(t))}</text>`; }
        else R.series.forEach((s, j) => { const v = s.v[i], bh = two ? 12 : 20, yy = y + (two ? (rowH - 26) / 2 + j * 14 : (rowH - 20) / 2);
          if(v != null) o += `<path d="${rbarH(x0, yy, Math.max(1, pw * v / sc.top), bh, 4)}" class="gv-${s.col}"/>`;
          if(j === 0) o += `<text x="${x0 + pw * (v || 0) / sc.top + 6}" y="${yy + bh / 2 + 4}" class="gvval">${esc(fmtV(K, v))}</text>`; });
        o += `<rect x="0" y="${y}" width="${svgW}" height="${rowH}" class="gvhit" tabindex="0" data-i="${i}" aria-label="${esc(c.tt)}"/>`; });
      svg = `<svg viewBox="0 0 ${svgW} ${hgt}" width="100%" class="gvsvg" role="img" aria-label="${esc(mLab(m[0]))}">${o}</svg>`;
    }
    else { // colonnes ou courbe, dans le temps, par heure ou par jour de semaine
      const n = R.cats.length, ml = K === 'avg' ? 62 : 52, mr = 14, mt = 22, ph = 260, mb = 30, pw = svgW - ml - mr, band = pw / Math.max(1, n), hgt = mt + ph + mb;
      const tot = i => R.series.reduce((t, s) => t + (s.v[i] || 0), 0);
      const mx = K === 'stack' ? (pct ? 100 : Math.max(0, ...R.cats.map((c, i) => tot(i)))) : Math.max(0, ...R.series.flatMap(s => s.v.filter(v => v != null)));
      const sc = nice(mx, K, pct), Y = v => mt + ph - ph * v / sc.top, X = i => ml + band * (i + .5);
      let o = grid(ml, ml + pw, mt, sc.top, sc.step, ph, pct);
      const nn = R.nod.lastIndexOf(true) + 1;
      if(nn){ const w = band * nn; o += `<rect x="${ml}" y="${mt}" width="${w}" height="${ph}" class="gvnod"/>`; if(w >= 96) o += `<text x="${ml + w / 2}" y="${mt + ph / 2}" class="gvnodt" text-anchor="middle">${esc(T('Pas d\'historique', 'No history'))}</text>`; }
      const lw = Math.max(...R.cats.map(c => c.l.length)) * 6.6 + 10, every = Math.max(1, Math.ceil(lw / band));
      R.cats.forEach((c, i) => { if(i % every === 0) o += `<text x="${X(i)}" y="${mt + ph + 18}" class="gvax" text-anchor="middle">${esc(c.l)}</text>`; });
      if(isLine){
        R.series.slice().reverse().forEach(s => { let d = '', pen = false; s.v.forEach((v, i) => { if(v == null){ pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
          o += `<path d="${d}" class="gvline gvl-${s.col}"/>`;
          if(s.id === 'cur' && n <= 20) s.v.forEach((v, i) => { if(v != null) o += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" class="gvdot gv-${s.col}"/>`; }); });
        const c0 = R.series[0], li = c0.v.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
        if(li != null){ o += `<circle cx="${X(li)}" cy="${Y(c0.v[li])}" r="4.5" class="gvdot gv-${c0.col}"/>`; }
        o += `<line class="gvx" x1="0" x2="0" y1="${mt}" y2="${mt + ph}" visibility="hidden"/>`;
      } else {
        const k = K === 'stack' ? 1 : R.series.length, bw = Math.max(2, Math.min(24, band * (k > 1 ? .36 : .68))), gw = k * bw + (k - 1) * 2;
        R.cats.forEach((c, i) => { const xs = X(i) - gw / 2;
          if(K === 'stack'){ const t = tot(i); let y = mt + ph; const segs = R.series.map(s => ({s, h: t ? ph * (pct ? 100 * s.v[i] / t : s.v[i]) / sc.top : 0})).filter(z => z.h > 0);
            segs.forEach((z, j) => { const lastS = j === segs.length - 1, hh = Math.max(0, z.h - (lastS ? 0 : 2)); y -= z.h; o += lastS ? `<path d="${rbar(xs, y, bw, hh, 4)}" class="gv-${z.s.col}"/>` : `<rect x="${xs}" y="${y + 2}" width="${bw}" height="${hh}" class="gv-${z.s.col}"/>`; }); }
          else R.series.slice().reverse().forEach((s, jj) => { const j = R.series.length - 1 - jj, v = s.v[i]; if(v == null || v <= 0) return; o += `<path d="${rbar(xs + j * (bw + 2), Y(v), bw, mt + ph - Y(v), 4)}" class="gv-${s.col}"/>`; }); });
      }
      // une seule valeur écrite : le plus haut de la période choisie (le reste dans l'info-bulle et le tableau)
      const ref = K === 'stack' ? R.cats.map((c, i) => pct ? null : tot(i)) : R.series[0].v, pk = ref.reduce((b, v, i) => v != null && (b < 0 || v > ref[b]) ? i : b, -1);
      if(pk >= 0 && ref[pk] > 0){ const k = K === 'stack' || isLine ? 1 : R.series.length, bw = Math.max(2, Math.min(24, band * (k > 1 ? .36 : .68))), gw = k * bw + (k - 1) * 2, x = isLine || k === 1 ? X(pk) : X(pk) - gw / 2 + bw / 2;
        o += `<text x="${Math.min(ml + pw - 10, Math.max(ml + 14, x))}" y="${Y(ref[pk]) - 8}" class="gvval" text-anchor="middle">${esc(fmtV(K, ref[pk]))}</text>`; }
      R.cats.forEach((c, i) => { tipFor(i); o += `<rect x="${ml + band * i}" y="${mt}" width="${band}" height="${ph}" class="gvhit" tabindex="0" data-i="${i}" aria-label="${esc(c.tt)}"/>`; });
      svg = `<svg viewBox="0 0 ${svgW} ${hgt}" width="100%" class="gvsvg" role="img" aria-label="${esc(mLab(m[0]))}">${o}</svg>`;
    }
    if(R.series.length > 1 && R.g !== 'heat') legend = `<div class="gvleg">${R.series.map(s => `<span><i class="${isLine ? 'ln ' : ''}gv-${s.col}"></i>${esc(s.l)}${s.id === 'prev' ? ` <span class="muted">(${esc(R.pFrom)} → ${esc(R.pTo)})</span>` : ''}</span>`).join('')}</div>`;

    // chiffres clés
    const tot = R.cur.tot, ptot = R.prv && R.prv.tot, kp = [];
    const delta = (a, b, gd) => { if(b == null || a == null) return ''; if(b === 0 && a > 0 && K !== 'ratio') return `<small class="grpd">${T('rien sur la période d\'avant', 'none in the previous period')}</small>`; const d = Math.round((a - b) * 10) / 10; if(!d) return `<small class="grpd">= ${T('comme avant', 'same as before')}</small>`;
      const good = gd === 'up' ? d > 0 : gd === 'down' ? d < 0 : null, v = K === 'ratio' ? `${Math.abs(d).toLocaleString(loc)} pt` : K === 'avg' ? dur(Math.abs(Math.round(d))) : nf(Math.abs(d)), rel = b && K !== 'ratio' ? ` (${d > 0 ? '+' : ''}${Math.round(100 * d / b)} %)` : '';
      return `<small class="grpd ${good == null ? '' : good ? 'ok' : 'bad'}">${d > 0 ? '▲ +' : '▼ −'}${v}${rel} ${T('par rapport à avant', 'vs before')}</small>`; };
    const kpi = (l, v, sm) => kp.push(`<div><span>${esc(l)}</span><b>${esc(v)}</b>${sm || ''}</div>`);
    const allCells = R.g === 'heat' ? R.heat.v.flatMap((r, w) => r.map((v, j) => [v, `${WDS[w]} ${R.heat.h0 + j} h`])) : R.cats.map((c, i) => [K === 'stack' ? R.series.reduce((t, s) => t + s.v[i], 0) : R.series[0].v[i], c.tt]);
    const pkC = allCells.filter(x => x[0] != null).sort((a, b) => b[0] - a[0])[0];
    if(K === 'count'){ kpi(T('Total sur la période', 'Total over the period'), nf(tot.n), delta(tot.n, ptot && ptot.n, m[6])); kpi(T('Par jour (moyenne)', 'Per day (average)'), (Math.round(tot.n / R.cDays * 10) / 10).toLocaleString(loc)); }
    else if(K === 'stack'){ const t = R.CATS.reduce((a, [c]) => a + (tot.cats[c] || 0), 0); kpi(T('Total sur la période', 'Total over the period'), nf(t)); R.CATS.forEach(([c, l]) => kpi(l, `${nf(tot.cats[c] || 0)} (${t ? Math.round(100 * (tot.cats[c] || 0) / t) : 0} %)`)); }
    else if(K === 'ratio'){ const v = tot.den ? 100 * tot.num / tot.den : null; kpi(T('Sur toute la période', 'Over the whole period'), fmtV(K, v), delta(v, ptot && ptot.den ? 100 * ptot.num / ptot.den : null, m[6])); kpi(T('Appels comptés', 'Calls counted'), nf(tot.den)); }
    else { const v = tot.cnt ? tot.sum / tot.cnt : null; kpi(T('Moyenne sur la période', 'Average over the period'), fmtV(K, v), delta(v, ptot && ptot.cnt ? ptot.sum / ptot.cnt : null, m[6])); kpi(T('Médiane', 'Median'), fmtV(K, grpMed(tot.vals))); kpi(T('Appels comptés', 'Calls counted'), nf(tot.cnt)); }
    if(pkC && K !== 'stack') kpi(T('Le plus haut', 'Highest'), fmtV(K, pkC[0]), `<small class="grpd">${esc(pkC[1])}</small>`);
    else if(pkC && R.CATS.length && !pct) kpi(T('Le plus haut', 'Highest'), nf(pkC[0]), `<small class="grpd">${esc(pkC[1])}</small>`);

    // ce que mesure le graphique
    const NOTES = {
      recv: S.k === 'ext' || R.by === 'ext' ? T('Appels entrants auxquels l\'employé a parlé ; un appel transféré compte pour chaque employé qui lui a parlé.', 'Inbound calls the employee talked on; a transferred call counts for each employee who talked on it.') : T('Tous les appels entrants, y compris ceux transférés vers un autre 3CX.', 'Every inbound call, including those transferred to another 3CX.'),
      res: T('Appels entrants hors transferts vers un autre 3CX, comme dans les Statistiques. Répondus comprend les renvois externes qui ont répondu.', 'Inbound calls excluding transfers to another 3CX, as in Statistics. Answered includes external forwards that were answered.'),
      rate: T('Répondus ÷ appels entrants (hors transferts vers un autre 3CX), comme dans les Statistiques.', 'Answered ÷ inbound calls (excluding transfers to another 3CX), as in Statistics.'),
      lost: T('Abandon en file, raccroché au menu, non répondu, renvoi externe sans réponse, raccroché en parking. La messagerie n\'est pas comptée comme perdue.', 'Queue abandon, hung up in the menu, not answered, unanswered external forward, hung up in parking. Voicemail is not counted as lost.'),
      out: T('Tous les appels sortants, aboutis ou non.', 'Every outbound call, connected or not.'),
      pick: T('Temps entre l\'arrivée de l\'appel et le premier décroché par une personne (menus vocaux et attente en file compris).', 'Time between the call arriving and the first pick-up by a person (voice menus and queue wait included).'),
      talk: S.k === 'ext' || R.by === 'ext' ? T('Conversations de l\'employé : sa part des appels entrants et ses appels sortants aboutis.', 'The employee\'s conversations: their share of inbound calls and their connected outbound calls.') : S.k === 'did' ? T('Appels entrants répondus.', 'Answered inbound calls.') : T('Appels entrants répondus et appels sortants aboutis.', 'Answered inbound calls and connected outbound calls.'),
      qcalls: T('Un même appel qui repasse par la file compte pour chaque passage (journal des files de 3CX).', 'A call that goes through the queue twice counts for each pass (3CX queue log).'),
      qwait: T('Attente de tous les appels de la file, servis ou non.', 'Wait of every queue call, served or not.')};
    note = NOTES[m[0]] + (R.by && R.cur.acc.size > 15 ? ' ' + T('Seuls les 15 plus gros volumes sont montrés ; le tableau et Excel donnent les mêmes.', 'Only the 15 largest volumes are shown; the table and Excel give the same ones.') : '')
      + (R.g === 'time' ? ' ' + (R.unit === 'day' ? T('Un jour par barre ou par point.', 'One day per bar or point.') : R.unit === 'week' ? T('Une semaine par barre ou par point (date du lundi).', 'One week per bar or point (Monday date).') : T('Un mois par barre ou par point.', 'One month per bar or point.')) : '')
      + (S.cmp && !R.hasPrev ? ' ' + T(`Pas de comparaison : la période d'avant commencerait avant le début de l'historique (${R.H.first}).`, `No comparison: the previous period would start before the history begins (${R.H.first}).`) : '');
    // ce que l'historique ne couvre pas, dit en clair au-dessus du graphique
    const histNote = [R.from < R.H.first ? T(`L'historique des appels commence le ${R.H.first} : ${R.g === 'time' ? 'les jours d\'avant sont grisés (aucune donnée) et ' : ''}la période ne compte que ${nf(R.cDays)} jour${R.cDays > 1 ? 's' : ''} sur ${nf(R.days)}${R.K === 'count' ? ', moyennes comprises' : ''}.`, `Call history starts on ${R.H.first}: ${R.g === 'time' ? 'the days before are greyed out (no data) and ' : ''}the period covers only ${nf(R.cDays)} of ${nf(R.days)} days${R.K === 'count' ? ', averages included' : ''}.`) : '',
      R.H.stray && (S.p === 'all' || R.from < R.H.first) ? T(`${nf(R.H.stray)} appel${R.H.stray > 1 ? 's' : ''} d'avant le début réel de l'historique (appel${R.H.stray > 1 ? 's' : ''} isolé${R.H.stray > 1 ? 's' : ''} ou essais de mise en service, à partir du ${R.H.strayFrom}) ${R.H.stray > 1 ? 'ne sont' : 'n\'est'} pas compté${R.H.stray > 1 ? 's' : ''}.`, `${nf(R.H.stray)} call${R.H.stray > 1 ? 's' : ''} from before the real start of the history (isolated call${R.H.stray > 1 ? 's' : ''} or set-up tests, from ${R.H.strayFrom}) ${R.H.stray > 1 ? 'are' : 'is'} not counted.`) : ''].filter(Boolean).join(' ');

    // tableau des chiffres (le même que l'export Excel)
    const tH = R.g === 'heat' ? [T('Jour', 'Day'), ...Array.from({length: R.heat.h1 - R.heat.h0 + 1}, (x, j) => `${R.heat.h0 + j} h`)]
      : [R.by ? {store: T('Magasin', 'Store'), did: T('Numéro entrant (SDA)', 'Incoming number (DID)'), queue: T("File d'attente", 'Queue'), ext: T('Employé', 'Employee')}[R.by] : R.g === 'time' ? T('Période', 'Period') : R.g === 'hour' ? T('Heure', 'Hour') : T('Jour', 'Day'), ...R.series.map(s => s.l), ...(K === 'stack' ? [T('Total', 'Total')] : K === 'ratio' || K === 'avg' ? [T('Appels comptés', 'Calls counted')] : [])];
    const tR = R.g === 'heat' ? R.heat.v.map((r, w) => [WDL[w], ...r]) : R.cats.map((c, i) => R.nod[i] ? [c.tt, T('pas d\'historique', 'no history'), ...tH.slice(2).map(() => '')] : [c.tt, ...R.series.map(s => s.v[i]), ...(K === 'stack' ? [R.series.reduce((t, s) => t + s.v[i], 0)] : K === 'ratio' || K === 'avg' ? [R.series[0].n[i]] : [])]);
    const isVal = j => j >= 1 && j <= (R.g === 'heat' ? 99 : R.series.length); // colonnes de valeurs (les autres sont des nombres d'appels)
    const cellTxt = (v, j) => typeof v !== 'number' && v != null ? esc(v) : (K === 'ratio' || K === 'avg') && isVal(j) ? fmtV(K, v) : v == null ? '–' : nf(Math.round(v));
    const table = `<div class="attsc"><table class="rpt gvtbl"><thead><tr>${tH.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tR.map(r => `<tr>${r.map((v, j) => `<td${j ? ' class="num"' : ''}>${cellTxt(v, j)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

    const hTitle = `${mLab(m[0])} — ${R.s.l}`;
    el.innerHTML = `<div id="gvzwrap"><div class="noprint">${head}
      <div class="grpbar"><span class="grpans">${answers.map(a => `<span class="pill">${esc(a)}</span>`).join(' ')}</span><span style="flex:1"></span>
        <button class="btn" id="gvzedit">${T('Changer mes réponses', 'Change my answers')}</button><button class="btn" id="gvznew">${T('Nouveau graphique', 'New chart')}</button><button class="btn primary" id="gvzprint">${T('Imprimer / PDF', 'Print / PDF')}</button><button class="btn" id="gvzpng">${T('Enregistrer l\'image', 'Save the image')}</button><button class="btn" id="gvzxl">${T('Exporter en Excel', 'Export to Excel')}</button></div></div>
      <div class="report attrep grprep gvrep" id="gvzsheet"><header class="rpcover"><div class="rpk">${T('Graphique', 'Chart')} · 3CXplore</div><h1>${esc(hTitle)}</h1>
        <div class="rpmeta">${esc(R.g === 'heat' ? T('Heure et jour ensemble', 'Hour and day together') : gLab(R.g))} · ${T(`Du ${R.from} au ${R.to}`, `From ${R.from} to ${R.to}`)} (${nf(R.days)} ${T('jours', 'days')}${R.cDays < R.days ? T(`, dont ${nf(R.cDays)} avec historique`, `, ${nf(R.cDays)} with history`) : ''})${R.hasPrev ? ` · ${T(`comparé au ${R.pFrom} → ${R.pTo}`, `compared with ${R.pFrom} → ${R.pTo}`)}` : ''}${SEG && S.k === 'all' ? ` · ${esc(segName(SEG))}` : ''}</div></header>
        ${histNote ? `<p class="gvhist">${esc(histNote)}</p>` : ''}<div class="attkpi">${kp.join('')}</div>
        <div class="card gvcard">${legend}<div class="gvplot" id="gvzplot">${R.cats.length || R.g === 'heat' ? svg : `<p class="muted">${T('Aucun appel sur la période pour ce choix.', 'No call in the period for this choice.')}</p>`}<div class="gvtip" id="gvztip" hidden></div></div></div>
        <p class="muted grpnote">${esc(note)}</p>
        <details class="gvdet"${R.cats.length <= 31 ? ' open' : ''}><summary>${T('Les chiffres du graphique', 'The chart figures')}</summary>${table}</details>
      </div></div>`;

    // ---- les appels derrière une barre, un point ou une case (20.4) : panneau de côté, filtre par résultat pour les barres empilées, export Excel ----
    const {src, extMode} = R;
    const recsOf = d => d && d.k != null ? ((R.cur.acc.get(d.k) || {}).recs || []) : [], nRecs = d => recsOf(d).length;
    const numA = n => { const k = normNum(n); return k ? `<a class="mono" href="#numero/${esc(k)}">${esc(phone(n))}</a>` : `<span class="mono">${esc(phone(n) || n || '')}</span>`; };
    const who = n => n && (EXT_BY[n] || DN[n]) ? dnLink(n) : n ? `<span class="mono">${esc(n)}</span>` : '';
    const valH = K === 'avg' ? {pick: T('Délai avant réponse', 'Time to answer'), talk: T('Conversation', 'Talk'), qwait: T('Attente', 'Wait')}[m[0]] : '';
    // une ligne : [cellules HTML, cellules Excel, catégorie]
    const rowOf = ([r, x, ext]) => {
      if(src === 'q'){ const res = r[6] ? T('Servi', 'Served') : T('Non servi', 'Not served') + (r[8] ? ` (${r[8]})` : '');
        return [[esc(fmtD(r[0])), `${numA(r[2])} <span class="muted">${esc(r[3] || '')}</span>`, `${r[1]} ${esc(dnName(r[1]))}`, dur(r[4]), r[6] ? `<span class="pill ok">${esc(res)}</span>` : `<span class="pill bad">${esc(res)}</span>`, r[6] && r[7] ? who(r[7]) : '', r[6] ? dur(r[5]) : ''],
          [fmtD(r[0]), phone(r[2]) || r[2], r[3] || '', `${r[1]} ${dnName(r[1])}`, r[4], res, r[6] && r[7] ? `${r[7]} ${dnName(r[7])}` : '', r[6] ? r[5] : ''], x.cat]; }
      const inb = r[1] === 'in', other = inb ? r[2] : r[1] === 'out' ? r[4] : r[2] === ext ? r[4] : r[2], st = ST[r[10]] || [r[10], ''], by = r[13] || (EXT_BY[r[6]] ? r[6] : '');
      const sens = inb ? T('Entrant', 'Inbound') : r[1] === 'out' ? T('Sortant', 'Outbound') : T('Interne', 'Internal');
      return [[esc(fmtD(r[0])), esc(sens), `${numA(other)}${inb && r[3] ? ` <span class="muted">${esc(r[3])}</span>` : ''}`, inb && r[5] ? numA(r[5]) : '', `<span class="pill ${st[1]}">${esc(st[0])}</span>`, extMode ? who(ext) : who(by), valH ? dur(Math.round(x.v)) : r[8] ? dur(r[8]) : ''],
        [fmtD(r[0]), sens, phone(other) || other, inb ? r[3] || '' : '', inb ? phone(r[5]) || r[5] || '' : '', st[0], extMode ? `${ext} ${dnName(ext)}` : by ? `${by} ${dnName(by)}` : '', valH ? Math.round(x.v) : r[8] || 0], x.cat]; };
    const heads = src === 'q' ? [[T('Date', 'Date'), T('Appelant', 'Caller'), T('File', 'Queue'), T('Attente', 'Wait'), T('Résultat', 'Result'), T('Agent', 'Agent'), T('Conversation', 'Talk')], [T('Date', 'Date'), T('Appelant', 'Caller'), T('Nom', 'Name'), T('File', 'Queue'), T('Attente (s)', 'Wait (s)'), T('Résultat', 'Result'), T('Agent', 'Agent'), T('Conversation (s)', 'Talk (s)')]]
      : [[T('Date', 'Date'), T('Sens', 'Direction'), T('Correspondant', 'Other party'), T('SDA', 'DID'), T('Résultat', 'Result'), extMode ? T('Employé', 'Employee') : T('Répondu par', 'Answered by'), valH || T('Conversation', 'Talk')], [T('Date', 'Date'), T('Sens', 'Direction'), T('Correspondant', 'Other party'), T('Nom', 'Name'), T('SDA', 'DID'), T('Résultat', 'Result'), extMode ? T('Employé', 'Employee') : T('Répondu par', 'Answered by'), `${valH || T('Conversation', 'Talk')} (s)`]];
    function openCalls(d){
      const recs = recsOf(d); if(!recs.length) return; hide();
      const rows = recs.map(rowOf), cats = R.CATS.filter(([c]) => rows.some(x => x[2] === c)); let f = '';
      const body = () => { const L = rows.filter(x => !f || x[2] === f), MAX = 500;
        return `<p class="muted gvcl">${esc(mLab(m[0]))} — ${esc(R.s.l)}<br>${T(`${nf(L.length)} appel${L.length > 1 ? 's' : ''}`, `${nf(L.length)} call${L.length > 1 ? 's' : ''}`)}${L.length > MAX ? T(` : les ${MAX} plus récents ici, tous dans Excel`, `: the ${MAX} most recent here, all in Excel`) : ''}${extMode && S.k !== 'ext' ? T(' · un appel transféré compte pour chaque employé qui lui a parlé', ' · a transferred call counts for each employee who talked on it') : ''}</p>
          ${cats.length > 1 ? `<div class="gvcf">${[['', T('Tous', 'All')], ...cats].map(([c, l]) => `<button type="button" class="btn${f === c ? ' primary' : ''}" data-gvf="${esc(c)}">${esc(l)} (${nf(c ? rows.filter(x => x[2] === c).length : rows.length)})</button>`).join('')}</div>` : ''}
          <p><button type="button" class="btn" data-gvxl>${T('Exporter en Excel', 'Export to Excel')}</button></p>
          <div class="tw"><table class="gvcalls"><thead><tr>${heads[0].map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${L.slice(0, MAX).map(x => `<tr>${x[0].map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };
      const paint = () => { openDrawer(esc(d.t), body());
        const db = $('#db'); db.querySelectorAll('[data-gvf]').forEach(b => b.addEventListener('click', () => { f = b.dataset.gvf; paint(); }));
        db.querySelector('[data-gvxl]').addEventListener('click', () => { const L = rows.filter(x => !f || x[2] === f);
          const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build([{name: T('Appels', 'Calls'), rows: [heads[1], ...L.map(x => x[1])]}]).blob); a.download = `${T('appels', 'calls')}-${m[0]}-${String(d.t).replace(/[^\w-]+/g, '-').slice(0, 40)}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); };
      paint(); }
    // info-bulle : survol, toucher et clavier ; le contenu passe par textContent
    const plot = $('#gvzplot'), tip = $('#gvztip'), svgEl = plot.querySelector('svg'), xl = svgEl && svgEl.querySelector('.gvx');
    const show = (node, cx, cy) => { const d = tips[+node.dataset.i]; if(!d) return; tip.replaceChildren();
      const t = document.createElement('div'); t.className = 'gvtt'; t.textContent = d.t; tip.appendChild(t);
      d.rows.forEach(([col, l, v, sub]) => { const r = document.createElement('div'); r.className = 'gvtr'; const k = document.createElement('i'); if(col) k.className = `gv-${col}`; const b = document.createElement('b'); b.textContent = v; const s = document.createElement('span'); s.textContent = l + (sub ? ` · ${sub}` : ''); r.append(k, b, s); tip.appendChild(r); });
      if(nRecs(d)){ const h = document.createElement('div'); h.className = 'gvhint'; h.textContent = T('Cliquez pour voir les appels', 'Click to see the calls'); tip.appendChild(h); }
      tip.hidden = false; const pr = plot.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = cx - pr.left + 14, y = cy - pr.top - th - 10; if(x + tw > pr.width) x = Math.max(0, cx - pr.left - tw - 14); if(y < 0) y = cy - pr.top + 16;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      plot.querySelectorAll('.on').forEach(z => z.classList.remove('on')); node.classList.add('on');
      if(xl && node.classList.contains('gvhit')){ const bb = node.getBBox(), xx = bb.x + bb.width / 2; xl.setAttribute('x1', xx); xl.setAttribute('x2', xx); xl.setAttribute('visibility', 'visible'); } };
    const hide = () => { tip.hidden = true; plot.querySelectorAll('.on').forEach(z => z.classList.remove('on')); if(xl) xl.setAttribute('visibility', 'hidden'); };
    if(svgEl){ svgEl.addEventListener('pointermove', e => { const n = e.target.closest('[data-i]'); if(n) show(n, e.clientX, e.clientY); else hide(); });
      svgEl.addEventListener('pointerleave', hide);
      svgEl.addEventListener('focusin', e => { const n = e.target.closest('[data-i]'); if(n){ const b = n.getBoundingClientRect(); show(n, b.left + b.width / 2, b.top + Math.min(b.height / 2, 40)); } });
      svgEl.addEventListener('focusout', hide);
      svgEl.addEventListener('click', e => { const n = e.target.closest('[data-i]'); if(n) openCalls(tips[+n.dataset.i]); });
      svgEl.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const n = e.target.closest('[data-i]'); if(n){ e.preventDefault(); openCalls(tips[+n.dataset.i]); } }); }

    $('#gvzedit').addEventListener('click', () => { S.done = false; S.step = steps().length - 1; save(); drawWizard(); });
    $('#gvznew').addEventListener('click', () => { Object.keys(S).forEach(k => delete S[k]); save(); drawWizard(); });
    $('#gvzprint').addEventListener('click', () => printHTML($('#gvzsheet').outerHTML.replace('id="gvzsheet"', '').replace('<details class="gvdet"', '<details class="gvdet" open')));
    const fname = ext => `${T('graphique', 'chart')}-${m[0]}-${S.k}${S.id ? '-' + String(S.id).replace(/\W/g, '') : ''}-${R.from}-${R.to}.${ext}`;
    $('#gvzpng').addEventListener('click', () => { if(!svgEl) return;
      // copie du dessin avec les couleurs calculées (les variables CSS ne suivent pas l'image), titre en haut, fond du thème
      const cl = svgEl.cloneNode(true), src = svgEl.querySelectorAll('*'), dst = cl.querySelectorAll('*');
      src.forEach((n, i) => { const cs = getComputedStyle(n); ['fill', 'stroke', 'stroke-width', 'font-size', 'font-weight', 'opacity'].forEach(p => dst[i].style.setProperty(p, cs.getPropertyValue(p))); dst[i].style.fontFamily = cs.fontFamily; });
      dst.forEach(n => { if(n.classList.contains('gvhit') || n.classList.contains('gvx')) n.remove(); });
      // légende (pastille de la couleur calculée + nom) sous le titre, comme à l'écran
      const sheetCS = getComputedStyle($('#gvzsheet')), ff = esc(sheetCS.fontFamily), ink = sheetCS.color, mut = getComputedStyle(document.querySelector('#gvzsheet .grpnote')).color;
      let lx = 0, lg = ''; document.querySelectorAll('#gvzsheet .gvleg > span, #gvzsheet .gvscale > *').forEach(n => { if(n.tagName === 'I'){ lg += `<rect x="${lx}" y="0" width="${n.classList.contains('ln') ? 16 : 12}" height="${n.classList.contains('ln') ? 3 : 12}" rx="2" fill="${getComputedStyle(n).backgroundColor}"/>`; lx += n.classList.contains('ln') ? 20 : 15; return; }
        const i = n.querySelector('i'); if(i){ const ln = i.classList.contains('ln'); lg += `<rect x="${lx}" y="${ln ? 5 : 0}" width="${ln ? 16 : 12}" height="${ln ? 3 : 12}" rx="2" fill="${getComputedStyle(i).backgroundColor}"/>`; lx += ln ? 22 : 18; }
        const t = n.textContent.trim(); lg += `<text x="${lx}" y="10.5" font-family="${ff}" font-size="12" fill="${i ? ink : mut}">${esc(t)}</text>`; lx += t.length * 6.6 + 16; });
      const vb = svgEl.viewBox.baseVal, pad = 16, th = lg ? 52 : 30, w = Math.max(vb.width, lx) + pad * 2, hh = vb.height + pad * 2 + th, bg = sheetCS.backgroundColor || '#fff';
      const wrap = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><rect width="100%" height="100%" fill="${bg}"/><text x="${pad}" y="${pad + 14}" font-family="${ff}" font-size="15" font-weight="600" fill="${ink}">${esc(hTitle)} · ${esc(R.from)} → ${esc(R.to)}</text>${lg ? `<g transform="translate(${pad},${pad + 26})">${lg}</g>` : ''}<g transform="translate(${pad},${pad + th})">${new XMLSerializer().serializeToString(cl).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;
      const img = new Image(), url = URL.createObjectURL(new Blob([wrap], {type: 'image/svg+xml'}));
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = hh * 2; const cx = cv.getContext('2d'); cx.scale(2, 2); cx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
        cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname('png'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); };
      img.src = url; });
    $('#gvzxl').addEventListener('click', () => {
      const raw = (v, j) => typeof v === 'number' && K === 'ratio' && isVal(j) ? Math.round(v * 10) / 1000 : typeof v === 'number' ? Math.round(v * 10) / 10 : v ?? '';
      const sh = [{name: T('Graphique', 'Chart'), rows: [tH.map((h, j) => K === 'avg' && isVal(j) ? `${h} (s)` : h), ...tR.map(r => r.map(raw))]},
        {name: T('Réglages', 'Settings'), rows: [[T('Question', 'Question'), T('Réponse', 'Answer')], ...steps().map(([, q, a]) => [q, a]), [T('Période', 'Period'), `${R.from} → ${R.to}`], ...(R.hasPrev ? [[T('Comparée à', 'Compared with'), `${R.pFrom} → ${R.pTo}`]] : []), [T('Définition', 'Definition'), note]]}];
      const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = fname('xlsx'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  }
  draw();
  // le dessin suit la largeur de la page (fenêtre redimensionnée, panneau ouvert ou fermé, page affichée après avoir été masquée)
  if(window.__gvzRO) window.__gvzRO.disconnect();
  let lastW = el.clientWidth, rt = 0;
  window.__gvzRO = new ResizeObserver(() => { if(!el.isConnected || !el.querySelector('#gvzwrap')){ window.__gvzRO.disconnect(); return; } const w = el.clientWidth; if(!S.done || !w || Math.abs(w - lastW) < 40) return; lastW = w; clearTimeout(rt); rt = setTimeout(draw, 150); });
  window.__gvzRO.observe(el);
};
