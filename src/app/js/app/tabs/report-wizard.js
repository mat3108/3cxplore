// ---------- Générateur de rapport (20.2) : un assistant pose des questions (sur quoi, lequel, quelle période, ce que l'on veut savoir)
// puis bâtit le rapport imprimable d'un utilisateur, d'une file d'attente ou d'un numéro entrant (SDA), avec son export Excel ----------
const GRP_KEY = 'genrap3cx';
// ce que l'on peut demander pour chaque sujet : [id, question en français, question en anglais]
const GRP_Q = {
  ext: [['vol', "Combien d'appels a-t-il reçus, et combien en a-t-il répondu ?", 'How many calls did they receive, and how many did they answer?'],
    ['pick', 'À quelle vitesse décroche-t-il ?', 'How fast do they pick up?'],
    ['out', "Combien d'appels a-t-il passés vers l'extérieur, et vers où ?", 'How many outside calls did they make, and where to?'],
    ['int', "Avec qui parle-t-il à l'interne ?", 'Who do they talk to internally?'],
    ['talk', 'Combien de temps passe-t-il au téléphone ?', 'How much time do they spend on the phone?'],
    ['when', 'Quand est-il le plus occupé ?', 'When are they busiest?'],
    ['queue', "Comment travaille-t-il dans ses files d'attente ?", 'How do they work in their queues?'],
    ['vm', 'Combien de messages vocaux a-t-il reçus ?', 'How many voicemails did they get?'],
    ['callers', "Qui l'appelle le plus ?", 'Who calls them the most?']],
  queue: [['vol', "Combien d'appels sont entrés dans la file, et combien ont été servis ?", 'How many calls entered the queue, and how many were served?'],
    ['wait', 'Combien de temps les clients attendent-ils ?', 'How long do callers wait?'],
    ['sl', 'Quelle part des appels est répondue dans le délai visé ?', 'What share of calls is answered within the target time?'],
    ['ab', 'Pourquoi des appels ne sont-ils pas servis, et après combien de temps ?', 'Why are some calls not served, and after how long?'],
    ['agents', 'Quels agents répondent, et combien ?', 'Which agents answer, and how many calls?'],
    ['when', 'À quelle heure et quel jour arrivent les appels ?', 'At what time and on which day do calls arrive?'],
    ['talk', 'Combien de temps durent les conversations ?', 'How long do conversations last?'],
    ['cb', 'Les clients qui ont raccroché ont-ils été rappelés ?', 'Were the callers who hung up called back?'],
    ['cfg', 'Comment la file est-elle réglée ?', 'How is the queue set up?']],
  did: [['vol', 'Combien d\'appels sont arrivés sur ce numéro, et combien ont été répondus ?', 'How many calls came in on this number, and how many were answered?'],
    ['route', 'Où vont les appels de ce numéro ?', 'Where do this number\'s calls go?'],
    ['who', 'Qui répond à ces appels ?', 'Who answers these calls?'],
    ['pick', 'Combien de temps avant qu\'on réponde ?', 'How long before someone answers?'],
    ['lost', 'Comment les appels sont-ils perdus ?', 'How are calls lost?'],
    ['when', 'À quelle heure et quel jour arrivent les appels ?', 'At what time and on which day do calls arrive?'],
    ['callers', 'Qui appelle ce numéro ?', 'Who calls this number?'],
    ['cb', 'Quels clients faut-il rappeler ?', 'Which callers need a callback?'],
    ['talk', 'Combien de temps durent les conversations ?', 'How long do conversations last?']],
};
const grpMed = a => { if(!a.length) return null; const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
const grpPerc = (a, p) => { if(!a.length) return null; const x = a.slice().sort((u, v) => u - v); return x[Math.min(x.length - 1, Math.floor(x.length * p))]; };
const grpTxt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
// durées découpées en tranches : [libellé, nombre]
function grpBuckets(vals, T){
  const E = [[10, '< 10 s'], [20, T('10 à 20 s', '10 to 20 s')], [30, T('20 à 30 s', '20 to 30 s')], [60, T('30 s à 1 min', '30 s to 1 min')], [120, T('1 à 2 min', '1 to 2 min')], [300, T('2 à 5 min', '2 to 5 min')], [Infinity, T('5 min et plus', '5 min or more')]];
  const n = E.map(() => 0); vals.forEach(v => { n[E.findIndex(([m]) => v < m)]++; }); return E.map(([, l], i) => [l, n[i]]);
}
// sujets que l'on peut choisir (magasin affiché respecté), avec leur nombre d'appels sur tout l'historique
let GRP_CNT = null;
function grpCounts(){
  if(GRP_CNT) return GRP_CNT;
  const ext = {}, q = {};
  FULL.calls.forEach(c => { if(Array.isArray(c[11])) c[11].forEach(([x]) => ext[x] = (ext[x] || 0) + 1); if(c[1] === 'out') ext[c[2]] = (ext[c[2]] || 0) + 1; });
  FULL.queueCalls.forEach(r => q[r[1]] = (q[r[1]] || 0) + 1);
  return GRP_CNT = {ext, q};
}
function grpSubjects(k){
  const C = grpCounts(), nm = e => ((e.first || '') + ' ' + (e.last || '')).trim();
  if(k === 'ext') return FULL.extensions.filter(e => !SEG || SEGOF[e.number] === SEG).map(e => ({id: e.number, l: nm(e) || e.number, s: e.number, n: C.ext[e.number] || 0}));
  if(k === 'queue') return FULL.queues.filter(x => !SEG || SEGOF[x.number] === SEG).map(x => ({id: x.number, l: x.name || x.number, s: x.number, n: C.q[x.number] || 0}));
  const seen = new Set();
  return allDIDs.filter(d => (!SEG || DIDSEG[d.did] === SEG) && !seen.has(d.did) && seen.add(d.did)).map(d => ({id: d.did, l: phone(d.did) || d.did, s: segShort(DIDSEG[d.did] || SEG_COMMON), n: lineCalls[d.did] || 0}));
}

V.genrap = (el, arg) => {
  const S = window.__grp ||= (() => { try{ return JSON.parse(localStorage.getItem(GRP_KEY) || '{}'); }catch(e){ return {}; } })();
  if(arg){ const [k, id] = decodeURIComponent(arg).split('~'); // « ext », « queue » ou « did », suivi ou non de ~numéro (20.2.1 : l'accueil ouvre directement « Lequel ? »)
    if(GRP_Q[k]){ if(S.k !== k){ S.qs = null; S.id = ''; } S.k = k; S.done = false; if(id){ S.id = id; S.step = 2; } else S.step = 1; } history.replaceState(null, '', '#genrap'); }
  const en = document.documentElement.lang === 'en', T = (fr, e) => en ? e : fr, loc = en ? 'en-CA' : 'fr-CA';
  const all = FULL.calls, first = all.length ? localParts(all[all.length - 1][0])[0] : '', last = all.length ? localParts(all[0][0])[0] : '';
  const save = () => { try{ localStorage.setItem(GRP_KEY, JSON.stringify({k: S.k, id: S.id, p: S.p, cmp: S.cmp, qs: S.qs, sl: S.sl, list: S.list, step: S.step, done: S.done})); }catch(e){} };
  const title = T('Générateur de rapport', 'Report generator');
  if(!all.length){ el.innerHTML = `<h2>${title}</h2><p class="muted">${T('Aucun appel dans ce backup.', 'No calls in this backup.')}</p>`; return; }
  const KL = {ext: T('Un utilisateur', 'A user'), queue: T("Une file d'attente", 'A queue'), did: T('Un numéro entrant (SDA)', 'An incoming number (DID)')};
  const KI = {ext: 'employe', queue: 'files', did: 'numero'};
  const subj = () => (grpSubjects(S.k || 'ext').find(x => x.id === S.id) || null);
  const perLab = p => p === 'all' ? T("Tout l'historique", 'All history') : perIsC(p) ? (() => { const [a, b] = perRange(p, first, last); return T(`Du ${a} au ${b}`, `From ${a} to ${b}`); })() : T(`${p} derniers jours`, `Last ${p} days`);
  const listLab = v => v === 'scr' ? T('Oui, à la fin du rapport', 'Yes, at the end of the report') : v === 'xl' ? T('Seulement dans le fichier Excel', 'Only in the Excel file') : T('Non', 'No');
  // les étapes de l'assistant : [id, question, réponse donnée (texte)]
  const steps = () => [
    ['k', T('Bonjour ! Je vais vous préparer un rapport. Sur quoi voulez-vous un rapport ?', "Hello! I'll prepare a report for you. What do you want a report on?"), S.k ? KL[S.k] : ''],
    ['id', S.k === 'ext' ? T('Quel utilisateur ?', 'Which user?') : S.k === 'queue' ? T("Quelle file d'attente ?", 'Which queue?') : T('Quel numéro entrant ?', 'Which incoming number?'), (s => s ? `${s.l} (${s.s})` : '')(subj())],
    ['p', T('Sur quelle période ?', 'For what period?'), S.p ? perLab(S.p) : ''],
    ['cmp', T('Voulez-vous comparer avec la période juste avant ?', 'Do you want to compare with the period just before?'), S.cmp == null ? '' : S.cmp ? T('Oui, comparer', 'Yes, compare') : T('Non', 'No')],
    ['qs', T("Qu'est-ce que vous voulez savoir ? Cochez tout ce qui vous intéresse.", 'What do you want to know? Tick everything you care about.'), S.qs ? T(`${S.qs.length} question${S.qs.length > 1 ? 's' : ''}`, `${S.qs.length} question${S.qs.length > 1 ? 's' : ''}`) : ''],
    ...(S.k === 'queue' && (S.qs || []).includes('sl') ? [['sl', T('Quel délai visez-vous pour répondre ?', 'What answer time do you aim for?'), S.sl ? `${S.sl} s` : '']] : []),
    ['list', T('Voulez-vous aussi la liste de chaque appel ?', 'Do you also want the list of every call?'), S.list ? listLab(S.list) : ''],
  ];
  const logo = (document.querySelector('.brandlogo') || {}).outerHTML || '';
  const bot = t => `<div class="askrow"><span class="askav" aria-hidden="true">${logo}</span><p class="askq">${esc(t)}</p></div>`;
  const rc = `--rc:${navColor('genrap')}`;
  const head = `<h2>${title}</h2><p class="lead">${T("Répondez à quelques questions : le rapport d'un utilisateur, d'une file d'attente ou d'un numéro entrant (SDA) se construit avec les statistiques choisies, prêt à imprimer ou à exporter en Excel.", 'Answer a few questions: the report of a user, a queue or an incoming number (DID) is built with the statistics you choose, ready to print or export to Excel.')}</p>`;

  // ---------------- assistant ----------------
  function drawWizard(){
    const st = steps(); S.step = Math.min(S.step || 0, st.length - 1);
    let h = '';
    st.slice(0, S.step).forEach(([, q, a]) => { h += bot(q) + `<div class="askme"><span>${esc(a)}</span></div>`; });
    const [id, q] = st[S.step]; h += `<div class="asknew">${bot(q)}</div>`;
    const opt = (i, l, ic, sub) => `<button type="button" data-v="${esc(i)}" style="${rc}">${ic ? navIcon(ic) : ''}<span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    if(id === 'k') h += `<div class="askopts" role="group">${Object.keys(KL).map(k => opt(k, KL[k], KI[k])).join('')}</div>`;
    else if(id === 'id'){
      h += `<div class="grpfind"><div class="hosearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"/></svg><input id="grpq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(T('Chercher un nom ou un numéro…', 'Search a name or number…'))}" aria-label="${esc(T('Chercher', 'Search'))}"></div></div><div class="askopts grpids" role="group" id="grpids"></div>`;
    }
    else if(id === 'p') h += `<div class="askopts" role="group">${[['7'], ['30'], ['90'], ['all']].map(([v]) => opt(v, perLab(v), 'stats')).join('')}${opt('custom', T('Des dates au choix', 'Custom dates'), 'absences')}</div>
      <div class="grpdates" id="grpdates" hidden><label>${T('Du', 'From')} <input type="date" id="grpf" min="${first}" max="${last}" value="${perIsC(S.p) ? perRange(S.p, first, last)[0] : addDaysISO(last, -29) < first ? first : addDaysISO(last, -29)}"></label>
        <label>${T('au', 'to')} <input type="date" id="grpt" min="${first}" max="${last}" value="${perIsC(S.p) ? perRange(S.p, first, last)[1] : last}"></label><button type="button" class="btn primary" id="grpdok">${T('Continuer', 'Continue')}</button>
        <span class="muted">${T(`Historique disponible du ${first} au ${last}.`, `History available from ${first} to ${last}.`)}</span></div>`;
    else if(id === 'cmp') h += `<div class="askopts" role="group">${opt('1', T('Oui, comparer', 'Yes, compare'), 'avantapres', T('Chaque chiffre clé montre la hausse ou la baisse', 'Each key figure shows the rise or fall'))}${opt('0', T('Non', 'No'), 'stats')}</div>`;
    else if(id === 'qs'){ const sel = new Set(S.qs || GRP_Q[S.k].map(x => x[0]));
      h += `<div class="grpqs" role="group">${GRP_Q[S.k].map(([v, fr, e]) => `<label class="grpq${sel.has(v) ? ' on' : ''}" style="${rc}"><input type="checkbox" value="${v}"${sel.has(v) ? ' checked' : ''}><span>${esc(T(fr, e))}</span></label>`).join('')}</div>
        <div class="asknav"><button type="button" class="btn primary" id="grpqok">${T('Continuer', 'Continue')}</button><button type="button" class="btn" id="grpqall">${T('Tout cocher', 'Tick all')}</button><button type="button" class="btn" id="grpqnone">${T('Tout décocher', 'Untick all')}</button></div>`; }
    else if(id === 'sl') h += `<div class="askopts" role="group">${[20, 30, 45, 60, 120].map(v => opt(String(v), v < 60 ? `${v} s` : `${v / 60} min`, 'delai', v === 20 ? T('Objectif courant des centres d\'appels (80 % en 20 s)', 'Usual call-centre target (80% in 20 s)') : '')).join('')}</div>`;
    else if(id === 'list') h += `<div class="askopts" role="group">${opt('no', T('Non', 'No'), 'stats')}${opt('scr', listLab('scr'), 'appels', T('Les 300 plus récents à l\'écran, tous dans Excel', 'The 300 most recent on screen, all in Excel'))}${opt('xl', listLab('xl'), 'reglages')}</div>`;
    if(S.step) h += `<div class="asknav"><button type="button" class="btn" data-back>${T('Revenir en arrière', 'Go back')}</button><button type="button" class="btn" data-reset>${T('Recommencer', 'Start over')}</button></div>`;
    el.innerHTML = `<div id="grpwrap">${head}<div class="ask grpask" id="grpchat" aria-live="polite">${h}</div></div>`;
    const W = el.querySelector('#grpwrap');
    const next = () => { S.step++; if(S.step >= steps().length){ S.done = true; save(); return draw(); } save(); drawWizard(); const f = W.querySelector('.asknew ~ .askopts button, .asknew ~ .grpqs input, #grpq'); if(f) f.focus({preventScroll: true}); };
    W.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.hasAttribute('data-back')){ S.step--; save(); return drawWizard(); }
      if(b.hasAttribute('data-reset')){ Object.keys(S).forEach(k => delete S[k]); save(); return drawWizard(); }
      if(b.id === 'grpdok'){ const f = $('#grpf').value, t = $('#grpt').value; if(f && t){ S.p = `c:${f}:${t}`; next(); } return; }
      if(b.id === 'grpqok'){ const v = [...W.querySelectorAll('.grpqs input:checked')].map(i => i.value); if(!v.length) return; S.qs = v; return next(); }
      if(b.id === 'grpqall' || b.id === 'grpqnone'){ W.querySelectorAll('.grpqs input').forEach(i => { i.checked = b.id === 'grpqall'; i.closest('label').classList.toggle('on', i.checked); }); return; }
      const v = b.dataset.v; if(v == null) return;
      if(id === 'k'){ if(S.k !== v){ S.k = v; S.id = ''; S.qs = null; } }
      else if(id === 'id') S.id = v;
      else if(id === 'p'){ if(v === 'custom'){ $('#grpdates').hidden = false; $('#grpf').focus(); return; } S.p = v; }
      else if(id === 'cmp') S.cmp = v === '1';
      else if(id === 'sl') S.sl = +v;
      else if(id === 'list') S.list = v;
      next();
    });
    W.addEventListener('change', e => { const i = e.target.closest('.grpqs input'); if(i) i.closest('label').classList.toggle('on', i.checked); });
    if(id === 'id'){
      const L = grpSubjects(S.k).sort((a, b) => b.n - a.n || String(a.s).localeCompare(String(b.s), undefined, {numeric: true})), box = $('#grpids'), inp = $('#grpq');
      const show = () => { const w = inp.value.trim().toLowerCase(), wd = w.replace(/\D/g, '');
        const hit = L.filter(x => !w || x.l.toLowerCase().includes(w) || String(x.s).toLowerCase().includes(w) || (wd && String(x.id).replace(/\D/g, '').includes(wd)));
        box.innerHTML = hit.slice(0, 24).map(x => opt(x.id, x.l, KI[S.k], `${x.s} · ${T(`${nf(x.n)} appel${x.n > 1 ? 's' : ''}`, `${nf(x.n)} call${x.n > 1 ? 's' : ''}`)}`)).join('')
          + (hit.length > 24 ? `<p class="muted grpmore">${T(`… et ${nf(hit.length - 24)} autres : précisez la recherche.`, `… and ${nf(hit.length - 24)} more: refine the search.`)}</p>` : '')
          + (!hit.length ? `<p class="muted grpmore">${T('Aucun résultat.', 'No result.')}</p>` : ''); };
      inp.addEventListener('input', show);
      inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ const f = box.querySelector('button'); if(f){ e.preventDefault(); f.click(); } } });
      show();
    }
  }

  // ---------------- rapport ----------------
  function build(){
    const s = subj(); if(!s) return null;
    const [from, to] = perRange(S.p || '30', first, last), days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
    const pTo = addDaysISO(from, -1), pFrom = addDaysISO(from, -days), hasPrev = S.cmp && pTo >= first;
    const want = new Set(S.qs || GRP_Q[S.k].map(x => x[0]));
    const inP = (iso, a, b) => { const d = localParts(iso)[0]; return d >= a && d <= b; };
    const pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '–', avg = (t, n) => n ? Math.round(t / n) : 0;
    const secs = [], brief = [], list = {h: [], r: [], x: []};
    // chiffre clé : {l libellé, v affiché, x valeur Excel, c classe, p valeur précédente, g 'up' si la hausse est bonne, 'down' si c'est la baisse}
    const K = (l, v, x, o) => ({l, v, x: x ?? grpTxt(String(v)), ...(o || {})});
    const sec = (id, h, o) => { if(want.has(id)) secs.push({id, h, kpis: [], tables: [], html: '', note: '', ...o}); };
    const tbl = (t, hd, r, numFrom, x) => ({t, h: hd, r, n: numFrom, x});
    const vbars = (items, small) => { const mx = Math.max(1, ...items.map(x => x.v)); return `<div class="attvb${small ? ' sm' : ''}">${items.map(x => `<div><b>${x.v ? nf(x.v) : ''}</b><i style="height:calc((100% - 18px) * ${(Math.max(x.v ? .02 : 0, x.v / mx)).toFixed(3)})" class="${x.hot ? 'hot' : ''}"></i><span>${esc(x.lab)}</span></div>`).join('')}</div>`; };
    const WDS = en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    // répartition dans le temps : par heure, par jour de semaine, puis par jour, semaine ou mois selon la longueur de la période
    const timeCharts = (pts, lab) => {
      const hrs = Array(24).fill(0), wd = Array(7).fill(0), byD = {}; pts.forEach(([iso, bad]) => { const [d, h, w] = localParts(iso); hrs[h]++; wd[w]++; const x = byD[d] ||= {n: 0, b: 0}; x.n++; if(bad) x.b++; });
      const used = hrs.map((v, i) => v ? i : -1).filter(i => i >= 0), h0 = used.length ? used[0] : 8, h1 = used.length ? used[used.length - 1] : 17;
      const hmx = Math.max(...hrs), wmx = Math.max(...wd);
      let per = [], perT = '';
      if(days <= 45){ perT = T('Par jour', 'By day'); for(let d = from; d <= to; d = addDaysISO(d, 1)) per.push({v: (byD[d] || {}).n || 0, lab: d.slice(8)}); }
      else if(days <= 210){ perT = T('Par semaine (date du lundi)', 'By week (Monday date)'); const wk = {}; Object.entries(byD).forEach(([d, x]) => { const k = addDaysISO(d, -localParts(d + 'T12:00:00Z')[2]); wk[k] = (wk[k] || 0) + x.n; });
        for(let d = addDaysISO(from, -localParts(from + 'T12:00:00Z')[2]); d <= to; d = addDaysISO(d, 7)) per.push({v: wk[d] || 0, lab: d.slice(5)}); }
      else { perT = T('Par mois', 'By month'); const mo = {}; Object.entries(byD).forEach(([d, x]) => mo[d.slice(0, 7)] = (mo[d.slice(0, 7)] || 0) + x.n); Object.keys(mo).sort().forEach(m => per.push({v: mo[m], lab: m})); }
      const pk = hrs.indexOf(hmx), pw = wd.indexOf(wmx);
      return {html: `<div class="att2"><div><h3>${T('Par heure', 'By hour')}</h3>${vbars(hrs.slice(h0, h1 + 1).map((v, i) => ({v, lab: `${h0 + i} h`, hot: v === hmx && v > 0})), true)}</div>
        <div><h3>${T('Par jour de la semaine', 'By day of the week')}</h3>${vbars(wd.map((v, i) => ({v, lab: WDS[i], hot: v === wmx && v > 0})))}</div></div>
        <h3>${perT}</h3>${vbars(per, per.length > 14)}`,
        kpis: pts.length ? [K(T('Heure de pointe', 'Peak hour'), `${pk} h`), K(T('Jour le plus chargé', 'Busiest weekday'), WDS[pw]), K(T(`${lab} par jour (moyenne)`, `${lab} per day (average)`), (Math.round(pts.length / days * 10) / 10).toLocaleString(loc), Math.round(pts.length / days * 10) / 10)] : [],
        table: tbl(T('Par heure', 'By hour'), [T('Heure', 'Hour'), lab], hrs.map((v, i) => [`${i} h`, nf(v)]).filter((r, i) => hrs[i]), 1, hrs.map((v, i) => [i, v]).filter(r => r[1]))};
    };
    const pickSec = (id, h, vals, lab) => sec(id, h, {kpis: vals.length ? [K(T('Délai médian', 'Median time'), dur(grpMed(vals)), grpMed(vals)), K(T('Délai moyen', 'Average time'), dur(avg(vals.reduce((a, b) => a + b, 0), vals.length)), avg(vals.reduce((a, b) => a + b, 0), vals.length)),
        K(T('9 sur 10 en moins de', '9 out of 10 within'), dur(grpPerc(vals, .9)), grpPerc(vals, .9)), K(T('Le plus long', 'Longest'), dur(Math.max(...vals)), Math.max(...vals))] : [],
      html: vals.length ? vbars(grpBuckets(vals, T).map(([l, v]) => ({v, lab: l}))) : '', note: vals.length ? lab : T('Aucun appel répondu sur la période.', 'No answered call in the period.')});
    const r100 = (a, b) => b ? Math.round(100 * a / b) : 0;
    let name = s.l, sub = '', meta = '';

    // ======== utilisateur ========
    if(S.k === 'ext'){
      const E = EXT_BY[s.id], n = s.id, R = empStats(E, from, to), P = hasPrev ? empStats(E, pFrom, pTo) : null;
      sub = T('Rapport d\'un utilisateur', 'User report'); meta = `${T('Poste', 'Extension')} ${n} · ${segName(SEGOF[n] || SEG_COMMON)}`;
      sec('vol', T('Appels reçus et répondus', 'Calls received and answered'), {kpis: [K(T('Entrants répondus', 'Inbound answered'), nf(R.inAns), R.inAns, {p: P && P.inAns, g: 'up'}),
        K(T('Sonneries reçues', 'Rings received'), R.rings ? nf(R.rings) : '–', R.rings, {p: P && P.rings}), K(T('Sonneries sans réponse', 'Rings not answered'), R.rings ? `${nf(R.ringMiss)} (${pc(R.ringMiss, R.rings)})` : '–', R.ringMiss, {p: P && P.ringMiss, g: 'down', c: R.rings && R.ringMiss / R.rings > .2 ? 'bad' : ''}),
        K(T('Arrêtées : un collègue a répondu', 'Stopped: a colleague answered'), nf(R.ringCanc), R.ringCanc), K(T('Internes reçus', 'Internal received'), nf(R.intIn), R.intIn, {p: P && P.intIn}), K(T('Internes reçus et répondus', 'Internal received and answered'), nf(R.intInAns), R.intInAns)],
        note: T('Une sonnerie = une fois où son poste a sonné pour un appel entrant (un même appel peut le faire sonner plusieurs fois). « Arrêtée » : l\'appel a été pris ailleurs, ce n\'est pas un appel manqué.', 'A ring = one time their phone rang for an inbound call (a call can ring it several times). « Stopped »: the call was taken elsewhere, it is not a missed call.')});
      pickSec('pick', T('Vitesse de décroché', 'Pick-up speed'), R.pick, T('Temps entre l\'arrivée de l\'appel dans le 3CX et son décroché, pour les appels entrants qu\'il a été le premier à prendre.', 'Time between the call reaching the 3CX and the pick-up, for inbound calls they were first to take.'));
      const dT = Object.values(R.dest).reduce((a, b) => a + b, 0), dRows = Object.entries(R.dest).sort((a, b) => b[1] - a[1]);
      sec('out', T('Appels vers l\'extérieur', 'Outside calls'), {kpis: [K(T('Appels sortants', 'Outbound calls'), nf(R.out), R.out, {p: P && P.out}), K(T('Aboutis', 'Connected'), `${nf(R.outAns)} (${pc(R.outAns, R.out)})`, R.outAns, {p: P && P.outAns}),
        K(T('Conversation moyenne', 'Average talk'), dur(avg(R.outTalk, R.outAns)), avg(R.outTalk, R.outAns), {s: 1, p: P && avg(P.outTalk, P.outAns)}), K(T('Temps total', 'Total time'), dur(R.outTalk), R.outTalk, {s: 1})],
        tables: dRows.length ? [tbl(T('Destinations', 'Destinations'), [T('Région', 'Region'), T('Appels', 'Calls'), T('Part', 'Share')], dRows.map(([k, v]) => [esc((DST_REG.find(r => r[0] === k) || [k, k])[1]), nf(v), pc(v, dT)]), 1, dRows.map(([k, v]) => [(DST_REG.find(r => r[0] === k) || [k, k])[1], v, r100(v, dT) / 100]))] : []});
      const mates = Object.entries(R.mates).sort((a, b) => b[1] - a[1]).slice(0, 15);
      sec('int', T('Appels internes', 'Internal calls'), {kpis: [K(T('Internes passés', 'Internal made'), nf(R.intOut), R.intOut, {p: P && P.intOut}), K(T('Internes reçus', 'Internal received'), nf(R.intIn), R.intIn, {p: P && P.intIn})],
        tables: mates.length ? [tbl(T('Avec qui', 'With whom'), [T('Collègue ou service', 'Colleague or service'), T('Appels', 'Calls')], mates.map(([x, v]) => [dnLink(x), nf(v)]), 1, mates.map(([x, v]) => [`${x} ${dnName(x)}`, v]))] : []});
      // ses appels un par un (liste, temps au téléphone, appelants)
      const mine = [], who = {}; let longest = null;
      for(const c of all){ const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue;
        const m = Array.isArray(c[11]) ? c[11].find(([x]) => x === n) : null, rang = (c[14] || []).some(x => x[1] === 'extension' && x[0] === n);
        let dir = '', res = '', talk = 0, other = '';
        if(c[1] === 'in' && (m || rang || (c[10] === 'ans' && c[6] === n))){ dir = T('Entrant', 'Inbound'); talk = m ? m[1] : c[6] === n ? c[8] || 0 : 0; res = talk || c[6] === n ? T('Répondu', 'Answered') : T('A sonné sans réponse', 'Rang, not answered'); other = c[2];
          if(talk || c[6] === n){ const k = normNum(c[2]); if(k){ const x = who[k] ||= {n: 0, name: c[3] || '', t: 0}; x.n++; x.t += talk; } } }
        else if(c[1] === 'out' && c[2] === n){ dir = T('Sortant', 'Outbound'); talk = c[10] === 'ans' ? c[8] || 0 : 0; res = talk ? T('Abouti', 'Connected') : T('Sans réponse', 'No answer'); other = c[4]; }
        else if(c[1] === 'int' && (c[2] === n || c[4] === n || c[6] === n)){ dir = T('Interne', 'Internal'); talk = c[10] === 'ans' ? c[8] || 0 : 0; res = c[10] === 'ans' ? T('Répondu', 'Answered') : T('Sans réponse', 'No answer'); other = c[2] === n ? c[4] : c[2]; }
        if(!dir) continue;
        if(talk && (!longest || talk > longest[1])) longest = [c, talk];
        mine.push([c[0], dir, other, res, talk]); }
      const tot = R.inTalk + R.outTalk, ptot = P ? P.inTalk + P.outTalk : null;
      sec('talk', T('Temps au téléphone', 'Time on the phone'), {kpis: [K(T('Temps total en conversation', 'Total talk time'), dur(tot), tot, {s: 1, p: ptot}), K(T('Par jour (moyenne)', 'Per day (average)'), dur(Math.round(tot / days)), Math.round(tot / days), {s: 1}),
        K(T('Conversation moyenne (entrants)', 'Average talk (inbound)'), dur(avg(R.inTalk, R.inAns)), avg(R.inTalk, R.inAns), {s: 1, p: P && avg(P.inTalk, P.inAns)}), K(T('Conversation moyenne (sortants)', 'Average talk (outbound)'), dur(avg(R.outTalk, R.outAns)), avg(R.outTalk, R.outAns), {s: 1}),
        K(T('Plus long appel', 'Longest call'), longest ? dur(longest[1]) : '–', longest ? longest[1] : '', {sm: longest ? fmtD(longest[0][0]) : ''})], note: T(`Moyenne par jour sur les ${nf(days)} jours de la période, fins de semaine comprises.`, `Daily average over the ${nf(days)} days of the period, weekends included.`)});
      if(want.has('when')){ const tc = timeCharts(mine.filter(x => x[4] || x[1] !== T('Entrant', 'Inbound')).map(x => [x[0], 0]), T('Appels', 'Calls')); sec('when', T('Quand il est le plus occupé', 'When they are busiest'), {kpis: tc.kpis, html: tc.html, tables: [tc.table], note: T('Appels répondus, sortants et internes.', 'Answered, outbound and internal calls.')}); }
      const qr = Object.entries(R.q).sort((a, b) => (b[1].ans + b[1].served) - (a[1].ans + a[1].served));
      sec('queue', T('Travail dans les files d\'attente', 'Work in queues'), {kpis: [K(T('Temps connecté aux files', 'Time logged in to queues'), R.onH ? dur(Math.round(R.onH * 3600)) : '–', Math.round(R.onH * 3600), {s: 1}), K(T('Taux d\'occupation', 'Occupancy rate'), R.occ != null ? Math.round(R.occ * 100) + ' %' : '–', R.occ != null ? Math.round(R.occ * 100) : '')],
        tables: qr.length ? [tbl(T('Par file', 'By queue'), [T('File', 'Queue'), T('Appels servis', 'Calls served'), T('Sonneries répondues', 'Rings answered'), T('Sonneries expirées', 'Rings timed out'), T('Part expirée', 'Timed-out share')],
          qr.map(([q, x]) => [dnLink(q), nf(x.served), nf(x.ans), nf(x.exp), pc(x.exp, x.ans + x.exp)]), 1, qr.map(([q, x]) => [`${q} ${dnName(q)}`, x.served, x.ans, x.exp, x.ans + x.exp ? Math.round(100 * x.exp / (x.ans + x.exp)) / 100 : '']))] : [],
        note: qr.length ? T('Occupation : part du temps connecté passée en conversation (heures de bureau), même calcul que l\'onglet Taux d\'occupation des agents.', 'Occupancy: share of logged-in time spent talking (business hours), same as the Agent occupancy tab.') : T('Il n\'a reçu aucun appel de file sur la période.', 'They got no queue call in the period.')});
      const vmIn = all.filter(c => c[1] === 'in' && inP(c[0], from, to) && (c[14] || []).some(x => x[1] === 'voicemail' && x[0] === n)).length, vmBox = (FULL.voicemails || []).filter(v => v.ext === n), vmP = vmBox.filter(v => { const t = vmUTC(v.date); return t && inP(t, from, to); }).length;
      sec('vm', T('Messages vocaux', 'Voicemail'), {kpis: [K(T('Appels arrivés dans sa messagerie', 'Calls that reached their voicemail'), nf(vmIn), vmIn), K(T('Messages encore dans la boîte (période)', 'Messages still in the box (period)'), nf(vmP), vmP), K(T('Messages dans la boîte (en tout)', 'Messages in the box (all)'), nf(vmBox.length), vmBox.length),
        K(T('Messagerie vocale', 'Voicemail'), E.vm ? T('activée', 'on') : T('désactivée', 'off'))], note: T('Les messages écoutés puis effacés ne sont plus dans le backup : seuls les appels arrivés dans la messagerie les comptent tous.', 'Messages listened to and deleted are no longer in the backup: only the calls that reached voicemail count them all.')});
      const wr = Object.entries(who).sort((a, b) => b[1].n - a[1].n).slice(0, 15);
      sec('callers', T('Qui l\'appelle le plus', 'Who calls them the most'), {kpis: [K(T('Appelants différents', 'Different callers'), nf(Object.keys(who).length), Object.keys(who).length)],
        tables: wr.length ? [tbl(T('Appelants', 'Callers'), [T('Numéro', 'Number'), T('Nom', 'Name'), T('Appels répondus', 'Calls answered'), T('Conversation', 'Talk')], wr.map(([k, x]) => [`<a class="mono" href="#numero/${esc(k)}">${esc(phone(k))}</a>`, esc(x.name), nf(x.n), dur(x.t)]), 2, wr.map(([k, x]) => [phone(k), x.name, x.n, x.t]))] : []});
      brief.push(T(`<b>${esc(name)}</b> a répondu à <b>${nf(R.inAns)}</b> appel${R.inAns > 1 ? 's' : ''} entrant${R.inAns > 1 ? 's' : ''} et en a passé <b>${nf(R.out)}</b> vers l'extérieur, pour <b>${dur(tot)}</b> au téléphone.`, `<b>${esc(name)}</b> answered <b>${nf(R.inAns)}</b> inbound call${R.inAns > 1 ? 's' : ''} and made <b>${nf(R.out)}</b> outside, for <b>${dur(tot)}</b> on the phone.`));
      if(R.rings && R.ringMiss / R.rings > .2) brief.push(T(`Son poste a sonné sans réponse <b>${pc(R.ringMiss, R.rings)}</b> du temps : à vérifier (absences, renvois, file trop longue).`, `Their phone rang unanswered <b>${pc(R.ringMiss, R.rings)}</b> of the time: worth a look (absences, forwards, queue settings).`));
      if(grpMed(R.pick) != null) brief.push(T(`Il décroche en <b>${dur(grpMed(R.pick))}</b> la plupart du temps (médiane).`, `They usually pick up in <b>${dur(grpMed(R.pick))}</b> (median).`));
      list.h = [T('Date', 'Date'), T('Sens', 'Direction'), T('Correspondant', 'Other party'), T('Résultat', 'Result'), T('Conversation', 'Talk')];
      list.r = mine.map(x => [esc(fmtD(x[0])), esc(x[1]), DN[x[2]] ? dnLink(x[2]) : `<span class="mono">${esc(phone(x[2]) || x[2])}</span>`, esc(x[3]), x[4] ? dur(x[4]) : '']);
      list.x = mine.map(x => [fmtD(x[0]), x[1], DN[x[2]] ? `${x[2]} ${dnName(x[2])}` : phone(x[2]) || x[2], x[3], x[4]]);
    }

    // ======== file d'attente ========
    else if(S.k === 'queue'){
      const Q = FULL.queues.find(x => x.number === s.id) || {}, rows = FULL.queueCalls.filter(r => r[1] === s.id && inP(r[0], from, to)), prows = hasPrev ? FULL.queueCalls.filter(r => r[1] === s.id && inP(r[0], pFrom, pTo)) : null;
      sub = T('Rapport d\'une file d\'attente', 'Queue report'); meta = `${T('File', 'Queue')} ${s.id} · ${segName(SEGOF[s.id] || SEG_COMMON)}`;
      const core = R => { const sv = R.filter(r => r[6]), ab = R.filter(r => !r[6]), w = R.map(r => r[4]), ws = sv.map(r => r[4]), sl = S.sl || 20;
        return {n: R.length, sv: sv.length, ab: ab.length, noAg: R.filter(r => r[8] === 'NoAgents').length, w, ws, wa: ab.map(r => r[4]), talk: sv.map(r => r[5]),
          inSl: sv.filter(r => r[4] < sl).length /* attente tronquée à la seconde : 20 = de 20,0 à 20,9 s, donc « < » pour « 20 s ou moins » */, rate: r100(sv.length, R.length), avgW: avg(w.reduce((a, b) => a + b, 0), w.length), avgWs: avg(ws.reduce((a, b) => a + b, 0), ws.length)}; };
      const C = core(rows), Pq = prows ? core(prows) : null;
      sec('vol', T('Appels entrés et servis', 'Calls in and served'), {kpis: [K(T('Appels entrés dans la file', 'Calls that entered the queue'), nf(C.n), C.n, {p: Pq && Pq.n}), K(T('Servis par un agent', 'Served by an agent'), `${nf(C.sv)} (${pc(C.sv, C.n)})`, C.sv, {p: Pq && Pq.sv, g: 'up'}),
        K(T('Taux de service', 'Service rate'), C.n ? C.rate + ' %' : '–', C.rate, {p: Pq && Pq.rate, g: 'up', pct: 1}), K(T('Non servis', 'Not served'), `${nf(C.ab)} (${pc(C.ab, C.n)})`, C.ab, {p: Pq && Pq.ab, g: 'down', c: C.n && C.ab / C.n > .2 ? 'bad' : ''}),
        K(T('Aucun agent disponible', 'No agent available'), nf(C.noAg), C.noAg, {p: Pq && Pq.noAg, g: 'down', c: C.noAg ? 'bad' : ''})],
        note: T('Un même appel qui repasse par la file compte pour chaque passage (journal des files de 3CX). « Non servis » : le client a raccroché, ou l\'appel est sorti de la file sans agent (délai maximal, aucun agent).', 'A call that goes through the queue twice counts for each pass (3CX queue log). « Not served »: the caller hung up, or the call left the queue without an agent (max time, no agents).')});
      sec('wait', T('Attente des clients', 'Caller waiting time'), {kpis: C.n ? [K(T('Attente moyenne (tous les appels)', 'Average wait (all calls)'), dur(C.avgW), C.avgW, {s: 1, p: Pq && Pq.avgW, g: 'down'}), K(T('Attente moyenne (appels servis)', 'Average wait (served calls)'), dur(C.avgWs), C.avgWs, {s: 1, p: Pq && Pq.avgWs, g: 'down'}),
          K(T('Attente médiane', 'Median wait'), dur(grpMed(C.w)), grpMed(C.w), {s: 1}), K(T('9 sur 10 attendent moins de', '9 out of 10 wait less than'), dur(grpPerc(C.w, .9)), grpPerc(C.w, .9), {s: 1}), K(T('Attente la plus longue', 'Longest wait'), dur(Math.max(...C.w)), Math.max(...C.w), {s: 1})] : [],
        html: C.n ? vbars(grpBuckets(C.w, T).map(([l, v]) => ({v, lab: l}))) : '', tables: C.n ? [tbl(T('Attente par tranche', 'Wait by range'), [T('Attente', 'Wait'), T('Appels', 'Calls'), T('Servis', 'Served'), T('Non servis', 'Not served')],
          grpBuckets(C.w, T).map(([l], i) => { const a = grpBuckets(C.ws, T)[i][1], b = grpBuckets(C.wa, T)[i][1]; return [esc(l), nf(a + b), nf(a), nf(b)]; }), 1)] : [],
        note: T('Attente comptée sur tous les appels de la file, servis ou non, et aussi sur les seuls appels servis.', 'Wait counted over every queue call, served or not, and also over served calls only.')});
      const sl = S.sl || 20, slP = Pq ? r100(Pq.inSl, Pq.n) : null;
      sec('sl', T(`Répondus en ${sl} s ou moins`, `Answered within ${sl} s`), {kpis: [K(T('Niveau de service', 'Service level'), C.n ? r100(C.inSl, C.n) + ' %' : '–', r100(C.inSl, C.n), {p: slP, g: 'up', pct: 1, c: C.n && r100(C.inSl, C.n) < 80 ? 'bad' : 'ok'}), K(T(`Servis en ${sl} s ou moins`, `Served within ${sl} s`), nf(C.inSl), C.inSl),
        K(T('Parmi les appels servis', 'Among served calls'), pc(C.inSl, C.sv), r100(C.inSl, C.sv))], note: T(`Niveau de service = appels servis en ${sl} s ou moins ÷ tous les appels entrés dans la file. Objectif courant : 80 %.`, `Service level = calls served within ${sl} s ÷ all calls that entered the queue. Usual target: 80%.`)});
      // motifs de 3CX : le client raccroche, le délai maximal fait passer l'appel à la destination suivante, aucun agent, le client quitte la file
      const RS = {'Caller dropped the call': T('Le client a raccroché', 'The caller hung up'), MaxWaitTime: T('Délai maximal atteint : l\'appel passe à la suite', 'Maximum wait reached: the call moves on'), NoAgents: T('Aucun agent connecté', 'No agent logged in'), UserRequested: T('Le client a quitté la file (touche)', 'The caller left the queue (key)')};
      const ns = rows.filter(r => !r[6]), drop = ns.filter(r => r[8] === 'Caller dropped the call'), wd = drop.map(r => r[4]), mx = ns.filter(r => r[8] === 'MaxWaitTime').length;
      const reasons = {}; ns.forEach(r => { const k = RS[r[8]] || r[8] || T('Autre', 'Other'); reasons[k] = (reasons[k] || 0) + 1; });
      sec('ab', T('Appels non servis : pourquoi et après combien de temps', 'Unserved calls: why and after how long'), {kpis: C.ab ? [K(T('Le client a raccroché', 'The caller hung up'), `${nf(drop.length)} (${pc(drop.length, C.n)})`, drop.length, {c: drop.length / C.n > .1 ? 'bad' : ''}),
          K(T('Attente médiane avant de raccrocher', 'Median wait before hanging up'), wd.length ? dur(grpMed(wd)) : '–', wd.length ? grpMed(wd) : '', {s: 1}), K(T('Raccrochent en moins de 10 s', 'Hang up within 10 s'), nf(wd.filter(v => v < 10).length), wd.filter(v => v < 10).length),
          K(T('Délai maximal atteint', 'Maximum wait reached'), nf(mx), mx), K(T('Aucun agent connecté', 'No agent logged in'), nf(C.noAg), C.noAg, {c: C.noAg ? 'bad' : ''})] : [],
        html: wd.length ? `<h3>${T('Attente avant de raccrocher', 'Wait before hanging up')}</h3>` + vbars(grpBuckets(wd, T).map(([l, v]) => ({v, lab: l, hot: true}))) : '', tables: C.ab ? [tbl(T('Motifs', 'Reasons'), [T('Motif', 'Reason'), T('Appels', 'Calls'), T('Part des non servis', 'Share of unserved')], Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [esc(k), nf(v), pc(v, C.ab)]), 1, Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, Math.round(100 * v / C.ab) / 100]))] : [],
        note: C.ab ? T('« Délai maximal atteint » : l\'appel n\'est pas perdu pour autant, il continue vers la destination prévue après la file (voir les réglages). Ceux qui raccrochent en moins de 10 s ont souvent fait un mauvais choix au menu.', '« Maximum wait reached »: the call is not lost, it goes on to the destination set after the queue (see the settings). Those who hang up within 10 s often made a wrong menu choice.') : T('Aucun appel non servi sur la période.', 'No unserved call in the period.')});
      if(want.has('agents')){ const ag = {}; rows.filter(r => r[6] && r[7]).forEach(r => { const x = ag[r[7]] ||= {sv: 0, t: 0, ans: 0, exp: 0, hu: 0}; x.sv++; x.t += r[5]; });
        Object.entries(FULL.agentPolls || {}).forEach(([k, v]) => { const [d, q, a] = k.split('|'); if(q !== s.id || d < from || d > to) return; const x = ag[a] ||= {sv: 0, t: 0, ans: 0, exp: 0, hu: 0}; x.ans += v[0]; x.exp += v[1]; x.hu += v[2]; });
        (Q.members || []).forEach(m => ag[m.dn] ||= {sv: 0, t: 0, ans: 0, exp: 0, hu: 0});
        const ar = Object.entries(ag).sort((a, b) => b[1].sv - a[1].sv || a[0].localeCompare(b[0], undefined, {numeric: true}));
        const top = ar[0] && ar[0][1].sv ? ar[0] : null, idle = ar.filter(([, x]) => !x.sv && !x.ans);
        sec('agents', T('Agents', 'Agents'), {kpis: [K(T('Agents qui ont servi', 'Agents who served'), nf(ar.filter(([, x]) => x.sv).length), ar.filter(([, x]) => x.sv).length), K(T('Membres de la file', 'Queue members'), nf((Q.members || []).length), (Q.members || []).length),
          K(T('Le plus actif', 'Most active'), top ? `${top[0]} ${dnName(top[0])}` : '–', top ? `${top[0]} ${dnName(top[0])}` : '', {sm: top ? `${pc(top[1].sv, C.sv)} ${T('des appels servis', 'of served calls')}` : ''}), K(T('Membres sans aucun appel', 'Members with no call'), nf(idle.length), idle.length, {c: idle.length ? 'warn' : ''})],
          tables: [tbl(T('Par agent', 'By agent'), [T('Agent', 'Agent'), T('Servis', 'Served'), T('Part', 'Share'), T('Conversation moyenne', 'Average talk'), T('Sonneries répondues', 'Rings answered'), T('Sonneries expirées', 'Rings timed out'), T('Part expirée', 'Timed-out share')],
            ar.map(([a, x]) => [dnLink(a), nf(x.sv), pc(x.sv, C.sv), x.sv ? dur(avg(x.t, x.sv)) : '–', nf(x.ans), nf(x.exp), pc(x.exp, x.ans + x.exp)]), 1, ar.map(([a, x]) => [`${a} ${dnName(a)}`, x.sv, C.sv ? Math.round(100 * x.sv / C.sv) / 100 : '', avg(x.t, x.sv), x.ans, x.exp, x.ans + x.exp ? Math.round(100 * x.exp / (x.ans + x.exp)) / 100 : '']))],
          note: T('Sonneries : chaque fois que la file a fait sonner l\'agent ; « expirée » = il n\'a pas répondu avant la fin de la sonnerie.', 'Rings: each time the queue rang the agent; « timed out » = they did not answer before the ring ended.')}); }
      if(want.has('when')){ const tc = timeCharts(rows.map(r => [r[0], !r[6]]), T('Appels', 'Calls')); const hb = Array(24).fill(0).map(() => [0, 0]); rows.forEach(r => { const h = localParts(r[0])[1]; hb[h][0]++; if(!r[6]) hb[h][1]++; });
        sec('when', T('Quand arrivent les appels', 'When calls arrive'), {kpis: tc.kpis, html: tc.html, tables: [tbl(T('Par heure', 'By hour'), [T('Heure', 'Hour'), T('Appels', 'Calls'), T('Non servis', 'Not served'), T('Part non servie', 'Unserved share')],
          hb.map((x, h) => [`${h} h`, nf(x[0]), nf(x[1]), pc(x[1], x[0])]).filter((r, h) => hb[h][0]), 1, hb.map((x, h) => [h, x[0], x[1], x[0] ? Math.round(100 * x[1] / x[0]) / 100 : '']).filter(r => r[1]))]}); }
      const tt = C.talk.reduce((a, b) => a + b, 0);
      sec('talk', T('Durée des conversations', 'Conversation length'), {kpis: C.sv ? [K(T('Conversation moyenne', 'Average talk'), dur(avg(tt, C.sv)), avg(tt, C.sv), {s: 1, p: Pq && avg(Pq.talk.reduce((a, b) => a + b, 0), Pq.sv)}), K(T('Conversation médiane', 'Median talk'), dur(grpMed(C.talk)), grpMed(C.talk), {s: 1}),
        K(T('Temps total en conversation', 'Total talk time'), dur(tt), tt, {s: 1}), K(T('Plus longue', 'Longest'), dur(Math.max(...C.talk)), Math.max(...C.talk), {s: 1})] : [], note: C.sv ? '' : T('Aucun appel servi.', 'No call served.')});
      if(want.has('cb')){
        // clients non servis : ont-ils été servis ensuite (rappel de leur part) ou rappelés par un poste ?
        const nsn = new Set(rows.filter(r => !r[6]).map(r => normNum(r[2])).filter(Boolean)), inBy = {}; all.forEach(c => { if(c[1] === 'in'){ const k = normNum(c[2]); if(nsn.has(k)) (inBy[k] ||= []).push(c); } });
        // l'appel a été répondu plus loin dans le même appel (après le délai maximal, par la destination suivante) : rien à rappeler
        const same = r => (inBy[normNum(r[2])] || []).some(c => { const d = Date.parse(r[0]) - Date.parse(c[0]); return d >= -60e3 && d <= 15 * 60e3 && ST_ANS.has(c[10]); });
        let sameN = 0; const ab = {}; rows.filter(r => !r[6]).forEach(r => { const k = normNum(r[2]); if(!k) return; if(same(r)){ sameN++; return; } const x = ab[k] ||= {t: r[0], n: 0, name: r[3] || ''}; x.n++; if(r[0] > x.t) x.t = r[0]; });
        const st = {}; Object.keys(ab).forEach(k => st[k] = 'todo');
        FULL.queueCalls.forEach(r => { const k = normNum(r[2]); if(st[k] === 'todo' && r[6] && r[0] > ab[k].t) st[k] = 'self'; });
        all.forEach(c => { const t = c[0]; if(c[1] === 'in'){ const k = normNum(c[2]); if(st[k] === 'todo' && t > ab[k].t && ST_ANS.has(c[10])) st[k] = 'self'; } else if(c[1] === 'out'){ const k = normNum(c[4]); if(st[k] && st[k] !== 'back' && t > ab[k].t && c[10] === 'ans') st[k] = 'back'; } });
        const ks = Object.keys(ab), cnt = x => ks.filter(k => st[k] === x).length, todo = ks.filter(k => st[k] === 'todo').sort((a, b) => ab[a].t < ab[b].t ? 1 : -1);
        sec('cb', T('Clients non servis : rappelés ?', 'Unserved callers: called back?'), {kpis: [K(T('Répondus plus loin dans le même appel', 'Answered further in the same call'), nf(sameN), sameN), K(T('Clients non servis', 'Unserved callers'), nf(ks.length), ks.length), K(T('Rappelés par un poste', 'Called back by an extension'), nf(cnt('back')), cnt('back')),
          K(T('Ont rappelé et ont été servis', 'Called again and were served'), nf(cnt('self')), cnt('self')), K(T('Jamais rappelés', 'Never called back'), `${nf(todo.length)} (${pc(todo.length, ks.length)})`, todo.length, {c: todo.length ? 'bad' : 'ok'})],
          tables: todo.length ? [tbl(T('À rappeler', 'To call back'), [T('Client', 'Caller'), T('Nom', 'Name'), T('Dernier appel non servi', 'Last unserved call'), T('Tentatives', 'Attempts')], todo.slice(0, 40).map(k => [`<a class="mono" href="#numero/${esc(k)}">${esc(phone(k))}</a>`, esc(ab[k].name), esc(fmtD(ab[k].t)), nf(ab[k].n)]), 3, todo.map(k => [phone(k), ab[k].name, fmtD(ab[k].t), ab[k].n]))] : [],
          note: T('Numéros masqués et appels répondus plus loin dans le même appel exclus. Vérifié sur tout l\'historique après le dernier appel non servi : appel sortant abouti vers ce numéro, ou nouvel appel du client répondu.', 'Hidden numbers and calls answered further in the same call excluded. Checked over the whole history after the last unserved call: a connected outbound call to that number, or a new answered call from the caller.')}); }
      const SR = {RoundRobin: T('À tour de rôle', 'Round robin'), RingAll: T('Tous en même temps', 'Ring all'), LongestWaiting: T('Celui qui attend depuis le plus longtemps', 'Longest waiting'), LeastTalkTime: T('Celui qui a le moins parlé', 'Least talk time'), FewestAnswered: T('Celui qui a le moins répondu', 'Fewest answered'), Hunt: T('Dans l\'ordre (le premier libre)', 'Hunt (first free)'), HuntBy3s: T('Dans l\'ordre, par 3', 'Hunt by threes'), Random: T('Au hasard', 'Random')};
      sec('cfg', T('Réglages de la file', 'Queue settings'), {html: kv([[T('Façon de faire sonner', 'Ring strategy'), esc(SR[Q.strategy] || Q.strategy || '')], [T('Sonnerie par agent', 'Ring time per agent'), Q.ringTimeout ? esc(Q.ringTimeout) + ' s' : ''], [T('Attente maximale', 'Maximum wait'), Q.masterTimeout ? esc(Q.masterTimeout) + ' s' : ''],
        [T('Ensuite, l\'appel va vers', 'Then the call goes to'), Q.dest ? destHTML(Q.dest) : ''], [T('Annonce de la position', 'Position announcement'), Q.announcePos ? T('oui', 'yes') : T('non', 'no')], [T('Message d\'accueil', 'Intro message'), Q.introEnabled ? esc(Q.intro || T('oui', 'yes')) : T('non', 'no')],
        [T('Membres', 'Members'), (Q.members || []).map(m => dnLink(m.dn) + (m.status && m.status !== 'LoggedIn' ? ` <span class="muted">(${esc(m.status)})</span>` : '')).join(', ')], [T('Responsables', 'Managers'), (Q.managers || []).map(x => dnLink(x)).join(', ')]])
        + `<p class="noprint"><a href="#" data-dn="${esc(s.id)}" class="dn btn">${T('Fiche complète de la file', 'Full queue sheet')}</a></p>`});
      brief.push(T(`<b>${nf(C.n)}</b> appels sont entrés dans la file ; <b>${pc(C.sv, C.n)}</b> ont été servis par un agent, après <b>${dur(C.avgWs)}</b> d'attente en moyenne.`, `<b>${nf(C.n)}</b> calls entered the queue; <b>${pc(C.sv, C.n)}</b> were served by an agent, after <b>${dur(C.avgWs)}</b> of waiting on average.`));
      if(C.ab) brief.push(T(`<b>${nf(C.ab)}</b> appels n'ont pas été servis par la file : ${nf(drop.length)} clients ont raccroché, ${nf(mx)} sont passés à la destination suivante après le délai maximal${C.noAg ? `, ${nf(C.noAg)} n'ont trouvé aucun agent` : ''}.`, `<b>${nf(C.ab)}</b> calls were not served by the queue: ${nf(drop.length)} callers hung up, ${nf(mx)} moved on after the maximum wait${C.noAg ? `, ${nf(C.noAg)} found no agent` : ''}.`));
      if(want.has('sl') && C.n) brief.push(T(`Niveau de service : <b>${r100(C.inSl, C.n)} %</b> des appels servis en ${sl} s ou moins.`, `Service level: <b>${r100(C.inSl, C.n)}%</b> of calls served within ${sl} s.`));
      list.h = [T('Date', 'Date'), T('Appelant', 'Caller'), T('Attente', 'Wait'), T('Résultat', 'Result'), T('Agent', 'Agent'), T('Conversation', 'Talk')];
      list.r = rows.map(r => [esc(fmtD(r[0])), `<span class="mono">${esc(phone(r[2]) || r[2])}</span> <span class="muted">${esc(r[3])}</span>`, dur(r[4]), r[6] ? `<span class="pill ok">${T('Servi', 'Served')}</span>` : `<span class="pill bad">${T('Non servi', 'Not served')}</span> <span class="muted">${esc(r[8] || '')}</span>`, r[6] && r[7] ? dnLink(r[7]) : '', r[6] ? dur(r[5]) : '']);
      list.x = rows.map(r => [fmtD(r[0]), phone(r[2]) || r[2], r[4], r[6] ? T('Servi', 'Served') : T('Non servi', 'Not served') + (r[8] ? ` (${r[8]})` : ''), r[6] && r[7] ? `${r[7]} ${dnName(r[7])}` : '', r[6] ? r[5] : '']);
    }

    // ======== numéro entrant (SDA) ========
    else {
      const k = normNum(s.id), isMe = c => c[1] === 'in' && (normNum(c[5]) === k || c[5] === s.id), rows = all.filter(c => isMe(c) && inP(c[0], from, to)), prow = hasPrev ? all.filter(c => isMe(c) && inP(c[0], pFrom, pTo)) : null;
      const D0 = allDIDs.find(d => d.did === s.id);
      sub = T('Rapport d\'un numéro entrant (SDA)', 'Incoming number (DID) report'); meta = `${T('Trunk', 'Trunk')} ${D0 ? D0.line.number : ''} · ${segName(DIDSEG[s.id] || SEG_COMMON)}`;
      // comme la Fiche numéro et les Statistiques : répondus et perdus sur les appels hors transferts vers un autre 3CX
      const core = R => { const br = R.filter(c => c[10] === 'bridge').length, base = R.length - br, ans = R.filter(c => ST_ANS.has(c[10])).length, lost = R.filter(c => ST_LOST.has(c[10])).length;
        return {n: R.length, br, base, ans, lost, vm: R.filter(c => c[10] === 'vm').length, rate: r100(ans, base), lrate: r100(lost, base), cli: new Set(R.map(c => normNum(c[2])).filter(Boolean)).size}; };
      const C = core(rows), Pd = prow ? core(prow) : null;
      sec('vol', T('Appels reçus et répondus', 'Calls received and answered'), {kpis: [K(T('Appels reçus', 'Calls received'), nf(C.n), C.n, {p: Pd && Pd.n}), K(T('Répondus', 'Answered'), `${nf(C.ans)} (${pc(C.ans, C.base)})`, C.ans, {p: Pd && Pd.ans, g: 'up'}),
        K(T('Taux de réponse', 'Answer rate'), C.base ? C.rate + ' %' : '–', C.rate, {p: Pd && Pd.rate, g: 'up', pct: 1}), K(T('Perdus', 'Lost'), `${nf(C.lost)} (${pc(C.lost, C.base)})`, C.lost, {p: Pd && Pd.lost, g: 'down', c: C.base && C.lost / C.base > .2 ? 'bad' : ''}),
        K(T('Messagerie', 'Voicemail'), nf(C.vm), C.vm, {p: Pd && Pd.vm}), K(T('Transférés vers un autre 3CX', 'Transferred to another 3CX'), nf(C.br), C.br)],
        note: T('Répondus et perdus : sur les appels reçus hors transferts vers un autre 3CX, comme dans les Statistiques. Répondus comprend les renvois externes qui ont répondu.', 'Answered and lost: over calls received excluding transfers to another 3CX, as in Statistics. Answered includes external forwards that were answered.')});
      if(want.has('route')){ const fs = {}; rows.forEach(c => { const p = c[9][0]; const key = p ? p[0] : ''; fs[key] = (fs[key] || 0) + 1; }); const fr = Object.entries(fs).sort((a, b) => b[1] - a[1]);
        const ru = D0 && D0.rule, dest = [[T('Heures d\'ouverture', 'Office hours'), ru && ru.office], ...(ru && ru.altOOO ? [[T('Hors heures', 'Out of hours'), ru.outOfOffice]] : []), ...(ru && ru.altHol ? [[T('Jours fériés', 'Holidays'), ru.holidays]] : [])];
        sec('route', T('Où vont les appels', 'Where calls go'), {html: (D0 ? kv([[T('Trunk', 'Trunk'), `${dnLink(D0.line.number)} <span class="muted">${esc(D0.line.gateway || '')}</span>`], [T('Règle entrante', 'Inbound rule'), esc(ruleLabel(D0))], ...dest.map(([l, d]) => [l, d ? destHTML(d) : '<span class="muted">—</span>'])]) : '')
            + `<p class="noprint"><a class="btn" href="#diagramme/${esc(s.id)}">${T('Diagramme du parcours', 'Route diagram')}</a> <a class="btn" href="#simulateur/${esc(s.id)}">${T('Simuler un appel', 'Simulate a call')}</a></p>`,
          tables: fr.length ? [tbl(T('Première étape réelle des appels', 'Actual first step of calls'), [T('Étape', 'Step'), T('Appels', 'Calls'), T('Part', 'Share')], fr.map(([x, v]) => [x ? dnLink(x) : `<span class="muted">${T('aucune (raccroché tout de suite)', 'none (hung up at once)')}</span>`, nf(v), pc(v, C.n)]), 1, fr.map(([x, v]) => [x ? `${x} ${dnName(x)}` : T('aucune', 'none'), v, C.n ? Math.round(100 * v / C.n) / 100 : '']))]: []}); }
      const who = {}; rows.forEach(c => (Array.isArray(c[11]) ? c[11] : []).forEach(([x, t]) => { if(!EXT_BY[x]) return; const y = who[x] ||= {n: 0, t: 0}; y.n++; y.t += t || 0; }));
      const wr = Object.entries(who).sort((a, b) => b[1].n - a[1].n);
      sec('who', T('Qui répond', 'Who answers'), {kpis: [K(T('Personnes qui ont répondu', 'People who answered'), nf(wr.length), wr.length), K(T('Le plus souvent', 'Most often'), wr[0] ? `${wr[0][0]} ${dnName(wr[0][0])}` : '–', wr[0] ? `${wr[0][0]} ${dnName(wr[0][0])}` : '', {sm: wr[0] ? `${pc(wr[0][1].n, C.ans)} ${T('des appels répondus', 'of answered calls')}` : ''})],
        tables: wr.length ? [tbl(T('Par employé', 'By employee'), [T('Employé', 'Employee'), T('Appels répondus', 'Calls answered'), T('Part', 'Share'), T('Conversation moyenne', 'Average talk')], wr.slice(0, 25).map(([x, y]) => [dnLink(x), nf(y.n), pc(y.n, C.ans), dur(avg(y.t, y.n))]), 1, wr.map(([x, y]) => [`${x} ${dnName(x)}`, y.n, C.ans ? Math.round(100 * y.n / C.ans) / 100 : '', avg(y.t, y.n)]))] : [],
        note: T('Un appel transféré compte pour chaque personne qui lui a parlé : la somme peut dépasser le nombre d\'appels répondus.', 'A transferred call counts for each person who talked on it: the total can exceed the answered calls.')});
      pickSec('pick', T('Délai avant réponse', 'Time to answer'), rows.filter(c => ST_ANS.has(c[10]) && c[12] != null).map(c => c[12]), T('Temps entre l\'arrivée de l\'appel et le premier décroché par une personne (menus vocaux et attente en file compris).', 'Time between the call arriving and the first pick-up by a person (voice menus and queue wait included).'));
      if(want.has('lost')){ const lk = {}, lw = {}; rows.filter(c => ST_LOST.has(c[10])).forEach(c => { lk[c[10]] = (lk[c[10]] || 0) + 1; const p = c[9][c[9].length - 1]; const x = p ? p[0] : ''; lw[x] = (lw[x] || 0) + 1; });
        const lr = Object.entries(lk).sort((a, b) => b[1] - a[1]), lwr = Object.entries(lw).sort((a, b) => b[1] - a[1]).slice(0, 15);
        sec('lost', T('Comment les appels sont perdus', 'How calls are lost'), {kpis: [K(T('Perdus', 'Lost'), `${nf(C.lost)} (${pc(C.lost, C.base)})`, C.lost, {c: C.lost ? 'bad' : 'ok'})],
          tables: C.lost ? [tbl(T('Façon de perdre l\'appel', 'How the call was lost'), [T('Cas', 'Case'), T('Appels', 'Calls'), T('Part des perdus', 'Share of lost')], lr.map(([x, v]) => [`<span class="pill ${(ST[x] || ['', ''])[1]}">${esc((ST[x] || [x])[0])}</span>`, nf(v), pc(v, C.lost)]), 1, lr.map(([x, v]) => [(ST[x] || [x])[0], v, Math.round(100 * v / C.lost) / 100])),
            tbl(T('Dernière étape avant la perte', 'Last step before the loss'), [T('Étape', 'Step'), T('Appels perdus', 'Lost calls')], lwr.map(([x, v]) => [x ? dnLink(x) : `<span class="muted">${T('aucune', 'none')}</span>`, nf(v)]), 1, lwr.map(([x, v]) => [x ? `${x} ${dnName(x)}` : T('aucune', 'none'), v]))] : []}); }
      if(want.has('when')){ const tc = timeCharts(rows.map(c => [c[0], ST_LOST.has(c[10])]), T('Appels', 'Calls')); const hb = Array(24).fill(0).map(() => [0, 0]); rows.forEach(c => { const h = localParts(c[0])[1]; hb[h][0]++; if(ST_LOST.has(c[10])) hb[h][1]++; });
        sec('when', T('Quand arrivent les appels', 'When calls arrive'), {kpis: tc.kpis, html: tc.html, tables: [tbl(T('Par heure', 'By hour'), [T('Heure', 'Hour'), T('Appels', 'Calls'), T('Perdus', 'Lost'), T('Part perdue', 'Lost share')],
          hb.map((x, h) => [`${h} h`, nf(x[0]), nf(x[1]), pc(x[1], x[0])]).filter((r, h) => hb[h][0]), 1, hb.map((x, h) => [h, x[0], x[1], x[0] ? Math.round(100 * x[1] / x[0]) / 100 : '']).filter(r => r[1]))]}); }
      if(want.has('callers')){ const by = {}; rows.forEach(c => { const x = normNum(c[2]); if(!x) return; const y = by[x] ||= {n: 0, l: 0, name: c[3] || ''}; y.n++; if(ST_LOST.has(c[10])) y.l++; });
        const before = new Set(); for(let i = all.length - 1; i >= 0; i--){ const c = all[i]; if(localParts(c[0])[0] >= from) break; if(c[1] === 'in'){ const x = normNum(c[2]); if(by[x]) before.add(x); } }
        const ks = Object.keys(by), rep = ks.filter(x => by[x].n > 1).length, hid = rows.filter(c => !normNum(c[2])).length, br = ks.sort((a, b) => by[b].n - by[a].n).slice(0, 20);
        sec('callers', T('Qui appelle ce numéro', 'Who calls this number'), {kpis: [K(T('Appelants différents', 'Different callers'), nf(ks.length), ks.length, {p: Pd && Pd.cli}), K(T('Nouveaux (jamais appelé avant)', 'New (never called before)'), `${nf(ks.length - before.size)} (${pc(ks.length - before.size, ks.length)})`, ks.length - before.size),
          K(T('Ont appelé plus d\'une fois', 'Called more than once'), `${nf(rep)} (${pc(rep, ks.length)})`, rep), K(T('Numéros masqués', 'Hidden numbers'), nf(hid), hid)],
          tables: br.length ? [tbl(T('Ceux qui appellent le plus', 'Top callers'), [T('Numéro', 'Number'), T('Nom', 'Name'), T('Appels', 'Calls'), T('Perdus', 'Lost')], br.map(x => [`<a class="mono" href="#numero/${esc(x)}">${esc(phone(x))}</a>`, esc(by[x].name), nf(by[x].n), nf(by[x].l)]), 2, br.map(x => [phone(x), by[x].name, by[x].n, by[x].l]))] : [],
          note: T('« Nouveaux » : aucun appel entrant de ce numéro, sur aucun SDA, avant le début de la période (dans l\'historique du backup).', '« New »: no inbound call from that number, on any DID, before the period starts (in the backup history).')}); }
      if(want.has('cb')){ let miss = []; try{ miss = missedAnalysis(from, to).filter(m => m.lost.some(i => normNum(all[i][5]) === k)); }catch(e){}
        const todo = miss.filter(m => m.st === 'todo').sort((a, b) => a.last < b.last ? 1 : -1), cnt = x => miss.filter(m => m.st === x).length;
        sec('cb', T('Clients à rappeler', 'Callers to call back'), {kpis: [K(T('Clients avec un appel perdu', 'Callers with a lost call'), nf(miss.length), miss.length), K(RAP_ST.back.l, nf(cnt('back')), cnt('back')), K(RAP_ST.self.l, nf(cnt('self')), cnt('self')), K(T('Encore à rappeler', 'Still to call back'), nf(todo.length), todo.length, {c: todo.length ? 'bad' : 'ok'})],
          tables: todo.length ? [tbl(T('À rappeler', 'To call back'), [T('Client', 'Caller'), T('Nom', 'Name'), T('Dernier appel perdu', 'Last lost call'), T('Tentatives', 'Attempts')], todo.slice(0, 40).map(m => [`<a class="mono" href="#numero/${esc(m.num)}">${esc(phone(m.num))}</a>`, esc(m.name || ''), esc(fmtD(m.last)), nf(m.n)]), 3, todo.map(m => [phone(m.num), m.name || '', fmtD(m.last), m.n]))] : [],
          note: T('Même calcul que l\'onglet Appels manqués : un appel perdu est réglé par un rappel abouti ou un appel servi du même magasin.', 'Same as the Missed calls tab: a lost call is settled by a connected callback or a served call from the same store.')}); }
      const ar = rows.filter(c => ST_ANS.has(c[10])), tl = ar.map(c => c[8] || 0), tt = tl.reduce((a, b) => a + b, 0);
      sec('talk', T('Durée des conversations', 'Conversation length'), {kpis: ar.length ? [K(T('Conversation moyenne', 'Average talk'), dur(avg(tt, ar.length)), avg(tt, ar.length), {s: 1, p: prow && (x => avg(x.reduce((a, c) => a + (c[8] || 0), 0), x.length))(prow.filter(c => ST_ANS.has(c[10])))}),
        K(T('Conversation médiane', 'Median talk'), dur(grpMed(tl)), grpMed(tl), {s: 1}), K(T('Temps total', 'Total time'), dur(tt), tt, {s: 1}), K(T('Appels de plus de 10 min', 'Calls over 10 min'), nf(tl.filter(v => v > 600).length), tl.filter(v => v > 600).length)] : [], note: ar.length ? '' : T('Aucun appel répondu.', 'No answered call.')});
      brief.push(T(`<b>${nf(C.n)}</b> appels sont arrivés sur ce numéro ; <b>${pc(C.ans, C.base)}</b> ont été répondus et <b>${pc(C.lost, C.base)}</b> perdus.`, `<b>${nf(C.n)}</b> calls came in on this number; <b>${pc(C.ans, C.base)}</b> were answered and <b>${pc(C.lost, C.base)}</b> lost.`));
      if(C.base && C.lost / C.base > .2) brief.push(T('Plus d\'un appel sur cinq est perdu : regardez « Comment les appels sont perdus » et les heures où ça arrive.', 'More than one call in five is lost: see « How calls are lost » and the hours when it happens.'));
      list.h = [T('Date', 'Date'), T('Appelant', 'Caller'), T('Résultat', 'Result'), T('Répondu par', 'Answered by'), T('Délai avant réponse', 'Time to answer'), T('Conversation', 'Talk')];
      list.r = rows.map(c => [esc(fmtD(c[0])), `<span class="mono">${esc(phone(c[2]) || c[2])}</span> <span class="muted">${esc(c[3] || '')}</span>`, `<span class="pill ${(ST[c[10]] || ['', ''])[1]}">${esc((ST[c[10]] || ['?'])[0])}</span>`, c[13] ? dnLink(c[13]) : c[6] && EXT_BY[c[6]] ? dnLink(c[6]) : '', c[12] != null ? dur(c[12]) : '', c[8] ? dur(c[8]) : '']);
      list.x = rows.map(c => [fmtD(c[0]), phone(c[2]) || c[2], (ST[c[10]] || ['?'])[0], c[13] ? `${c[13]} ${dnName(c[13])}` : c[6] && EXT_BY[c[6]] ? `${c[6]} ${dnName(c[6])}` : '', c[12] ?? '', c[8] || 0]);
    }
    // dans l'ordre des questions
    const order = GRP_Q[S.k].map(x => x[0]); secs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return {name, sub, meta, from, to, days, pFrom, pTo, hasPrev, secs, brief, list};
  }

  function draw(){
    if(!S.done) return drawWizard();
    const R = build();
    if(!R){ S.done = false; S.step = 1; save(); return drawWizard(); }
    const kpiH = k => `<div class="${k.c || ''}"><span>${esc(k.l)}</span><b>${k.v}</b>${k.sm ? `<small class="grpd">${esc(k.sm)}</small>` : ''}${delta(k)}</div>`;
    const delta = k => { if(!R.hasPrev || k.p == null || typeof k.x !== 'number' || k.p === '') return '';
      if(k.p === 0 && k.x > 0 && !k.pct) return `<small class="grpd">${T('rien sur la période d\'avant', 'none in the previous period')}</small>`;
      const d = Math.round((k.x - k.p) * 10) / 10; if(!d) return `<small class="grpd">= ${T('comme avant', 'same as before')}</small>`;
      const good = k.g === 'up' ? d > 0 : k.g === 'down' ? d < 0 : null, rel = k.p && !k.pct ? ` (${d > 0 ? '+' : ''}${Math.round(100 * d / k.p)} %)` : '';
      const v = k.pct ? `${Math.abs(d)} pt` : k.s ? dur(Math.abs(Math.round(d))) : nf(Math.abs(d));
      return `<small class="grpd ${good == null ? '' : good ? 'ok' : 'bad'}">${d > 0 ? '▲ +' : '▼ −'}${v}${rel} ${T('par rapport à avant', 'vs before')}</small>`; };
    const tblH = t => `<h3>${esc(t.t)}</h3><div class="attsc"><table class="rpt"><thead><tr>${t.h.map((h, i) => `<th${i >= t.n ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.r.map(r => `<tr>${r.map((v, i) => `<td${i >= t.n ? ' class="num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const showList = S.list === 'scr' && R.list.r.length;
    const answers = steps().map(([, , a]) => a).filter(Boolean);
    el.innerHTML = `<div id="grpwrap"><div class="noprint">${head}
      <div class="grpbar"><span class="grpans">${answers.map(a => `<span class="pill">${esc(a)}</span>`).join(' ')}</span><span style="flex:1"></span>
        <button class="btn" id="grpedit">${T('Changer mes réponses', 'Change my answers')}</button><button class="btn" id="grpnew">${T('Nouveau rapport', 'New report')}</button><button class="btn primary" id="grpprint">${T('Imprimer / PDF', 'Print / PDF')}</button><button class="btn" id="grpxl">${T('Exporter en Excel', 'Export to Excel')}</button></div></div>
      <div class="report attrep dprep grprep" id="grpsheet"><header class="rpcover"><div class="rpk">${esc(R.sub)} · 3CXplore</div><h1>${esc(R.name)}</h1>
        <div class="attsub">${esc(R.meta)}</div>
        <div class="rpmeta">${T(`Du ${R.from} au ${R.to}`, `From ${R.from} to ${R.to}`)} (${nf(R.days)} ${T('jours', 'days')})${R.hasPrev ? ` · ${T(`comparé au ${R.pFrom} → ${R.pTo}`, `compared with ${R.pFrom} → ${R.pTo}`)}` : S.cmp ? ` · ${T('pas d\'historique avant la période pour comparer', 'no history before the period to compare')}` : ''} · ${T('préparé le', 'prepared on')} ${esc(new Date().toLocaleDateString(loc))}</div></header>
      ${R.brief.length ? `<div class="attbrief"><h3>${T('En bref', 'In short')}</h3>${R.brief.map(t => `<p>${t}</p>`).join('')}</div>` : ''}
      ${R.secs.map(x => `<section class="rps grpsec"><h2>${esc(x.h)}</h2>${x.kpis.length ? `<div class="attkpi">${x.kpis.map(kpiH).join('')}</div>` : ''}${x.html}${x.tables.map(tblH).join('')}${x.note ? `<p class="muted grpnote">${esc(x.note)}</p>` : ''}</section>`).join('')}
      ${showList ? `<section class="rps grpsec attbrk"><h2>${T('Les appels un par un', 'Calls one by one')} <span class="muted">(${nf(R.list.r.length)})</span></h2>${tblH({t: R.list.r.length > 300 ? T('Les 300 plus récents (tous dans Excel)', 'The 300 most recent (all in Excel)') : '', h: R.list.h, r: R.list.r.slice(0, 300), n: 99})}</section>` : ''}
      </div></div>`;
    $('#grpedit').addEventListener('click', () => { S.done = false; S.step = 4; save(); drawWizard(); });
    $('#grpnew').addEventListener('click', () => { Object.keys(S).forEach(k => delete S[k]); save(); drawWizard(); });
    $('#grpprint').addEventListener('click', () => printHTML($('#grpsheet').outerHTML.replace('id="grpsheet"', '')));
    $('#grpxl').addEventListener('click', () => {
      const sh = [{name: T('Résumé', 'Summary'), rows: [[T('Rubrique', 'Section'), T('Chiffre', 'Figure'), T('Valeur', 'Value'), ...(R.hasPrev ? [T('Période précédente', 'Previous period')] : [])],
        [T('Rapport', 'Report'), R.sub, R.name], ['', T('Détail', 'Detail'), R.meta], ['', T('Période', 'Period'), `${R.from} → ${R.to}`], ...(R.hasPrev ? [['', T('Comparée à', 'Compared with'), `${R.pFrom} → ${R.pTo}`]] : []),
        ...R.secs.flatMap(x => x.kpis.map(k => [x.h, k.l, k.x, ...(R.hasPrev ? [k.p ?? ''] : [])]))]}];
      R.secs.forEach(x => x.tables.forEach(t => sh.push({name: t.t || x.h, rows: [t.h, ...(t.x || t.r.map(r => r.map(grpTxt)))]})));
      if(S.list !== 'no' && R.list.x.length) sh.push({name: T('Appels', 'Calls'), rows: [R.list.h, ...R.list.x]});
      const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = `${T('rapport', 'report')}-${S.k}-${String(S.id).replace(/\W/g, '')}-${R.from}-${R.to}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  }
  draw();
};
