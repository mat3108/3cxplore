// ---------- Simulateur d'appel : parcours d'un appel entrant à un moment donné ----------
const SIM_END = {human: ['Un employé peut répondre', 'ok'], vm: ['Messagerie vocale', 'warn'], ext: ['Renvoyé vers un numéro externe', 'acc'], lost: ['Appel perdu', 'bad'], wait: ['Le client doit choisir', '']};
const SIM_DEFAULT = FULL.groups.find(g => g.name === '__DEFAULT__');
const simWd = day => (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7;
const simHol = day => { const h = qcHolidays(+day.slice(0, 4)).find(x => x[1] === day); return h ? h[0] : null; };
// parcours : liste d'étapes {kind, dn, title, lines[], branch, cls, soft} et issue finale (end, why, after)
// heure locale (jour + minutes) -> instant UTC en millisecondes
function simAt(day, min){ const t0 = Date.parse(day + 'T00:00:00Z') + min * 60000; const t1 = t0 - (_dkShift(new Date(t0).toISOString()) || 0); return t0 - (_dkShift(new Date(t1).toISOString()) || 0); }
// période couverte par l'historique des connexions : [premier changement, fin du backup]
function simHistRange(){ const A = FULL.agentStatus; if(!A || !A.length) return null; const end = FULL.calls.length ? FULL.calls[0][0] : A[A.length - 1][0]; return [Date.parse(A[0][0]), Date.parse(end) + 3600e3]; }
let SIM_ST = null; // 'agent|file' -> [[t, 0|1], …]
// agent connecté à la file à l'instant t : dernier changement avant t ; avant le premier changement, l'inverse de celui-ci ; sans changement, l'état au moment du backup
function simAgentAt(q, m, t){
  if(!SIM_ST){ SIM_ST = {}; (FULL.agentStatus || []).forEach(r => (SIM_ST[r[2] + '|' + r[1]] ||= []).push([Date.parse(r[0]), r[3]])); }
  const ev = SIM_ST[m.dn + '|' + q]; if(!ev || !ev.length) return !m.status || m.status === 'LoggedIn';
  let v = 1 - ev[0][1]; for(const [ts, x] of ev){ if(ts > t) break; v = x; } return !!v;
}
function simulate(did, day, min, keys, ctx, opt){
  const histAt = !ctx && opt && opt.at != null ? opt.at : null;
  // ctx : autre backup (onglet Avant / après) ; sinon le backup ouvert
  const DNX = ctx ? ctx.DN : DN, DIDX = ctx ? ctx.dids : allDIDs, DEFX = ctx ? ctx.def : SIM_DEFAULT, nmX = n => DNX[n] ? DNX[n].name : '';
  const wd = simWd(day), steps = [], seen = new Set();
  let soft = false, budget = 40;
  let note = null;
  const st = o => { const x = Object.assign({lines: [], soft}, o); if(note){ x.lines = [note, ...x.lines]; note = null; } steps.push(x); return x; };
  const entry = DIDX.find(r => r.did === did);
  if(!entry) return {steps, end: 'lost', why: 'SDA inconnu'};
  st({kind: 'SDA', title: phone(did), lines: [`Trunk ${entry.line.gateway || entry.line.number}`]});
  const ru = entry.rule;
  if(!ru){ st({kind: 'Règle entrante', title: 'Aucune règle entrante', cls: 'bad'}); return {steps, end: 'lost', why: 'aucune règle entrante pour ce SDA'}; }
  let d0 = ru.office, branch = ru.altOOO || ru.altHol ? 'Ouvert' : 'Toujours';
  const differs = (ru.altOOO && JSON.stringify(ru.outOfOffice) !== JSON.stringify(ru.office)) || (ru.altHol && JSON.stringify(ru.holidays) !== JSON.stringify(ru.office));
  if(differs && DEFX){ const s = deptSchedule(DEFX).expected(day, min, wd);
    if(s === 'holidays' && ru.altHol){ d0 = ru.holidays; branch = 'Férié'; } else if(s !== 'office' && ru.altOOO){ d0 = ru.outOfOffice; branch = 'Fermé'; } }
  st({kind: 'Règle entrante', title: ru.name || (entry.isDefault ? 'Règle par défaut du trunk' : 'Règle du SDA'), branch,
    lines: differs ? ['Ouvert / fermé selon les heures du système (département par défaut)'] : ['Même destination ouvert ou fermé : les horaires sont ceux du département']});
  // après une sonnerie sans réponse : le parcours continue (étapes en pointillé)
  const overflow = (why, nx) => { st({kind: 'Ensuite', title: 'Si personne ne répond', soft: true}); const was = soft; soft = true; const a = run(nx); soft = was;
    return {end: 'human', why, after: a.end, afterWhy: a.why}; };
  function run(d){
    while(budget-- > 0){
      if(!d || !d.to || d.to === 'None'){ st({kind: 'Fin', title: 'Aucune destination', cls: 'bad', lines: ['L\'appel n\'est pas acheminé']}); return {end: 'lost', why: 'aucune destination définie'}; }
      if(d.to === 'EndCall'){ st({kind: 'Fin', title: 'Raccrocher', cls: 'bad'}); return {end: 'lost', why: 'le système raccroche'}; }
      if(d.to === 'VoiceMail'){ st({kind: 'Messagerie vocale', dn: d.dn, title: d.dn ? d.dn + ' ' + nmX(d.dn) : 'Messagerie vocale', cls: 'warn'}); return {end: 'vm', why: 'le client laisse un message'}; }
      if(d.to === 'External'){ const v = viaRule(d.ext); st({kind: 'Numéro externe', title: phone(d.ext), cls: 'acc', lines: [v ? 'via ' + (v.routes[0]?.gw || v.name) : '']}); return {end: 'ext', why: 'renvoyé vers ' + phone(d.ext)}; }
      const node = d.dn && DNX[d.dn];
      if(!node){ st({kind: TO_FR[d.to] || d.to, title: d.dn || '—', cls: 'bad', lines: ['Élément introuvable dans la configuration']}); return {end: 'lost', why: 'destination introuvable'}; }
      if(seen.has(d.dn) && node.kind !== 'Standard (IVR)'){ st({kind: 'Boucle', title: d.dn + ' ' + nmX(d.dn), cls: 'warn', lines: ['Retour vers un élément déjà traversé']}); return {end: 'lost', why: 'boucle dans le parcours'}; }
      seen.add(d.dn);
      const o = node.obj;
      // 17.4.1 : file, menu ou groupe de sonnerie atteint sans passer par son département : heures de ce département
      if(node.kind === "File d'attente" || node.kind === 'Standard (IVR)' || node.kind === 'Groupe de sonnerie'){
        const oh = ownerHours(d.dn, o, day, min, wd, n => seen.has(n), DNX, !ctx || !!ctx.cur);
        if(oh){ const bs = hoursSummary(oh.g.breakTime).filter(x => !/fermé$/.test(x)), etat = oh.k === 'break' ? `en pause${bs.length ? ' (' + bs.join(', ') + ')' : ''}` : oh.k === 'holidays' ? 'en jour férié' : 'fermé';
          const hl = oh.h ? `Appels réels à ce moment : ${oh.h.f} sur ${oh.h.n} sont partis vers la destination « pause »` : '';
          if(oh.d){ st({kind: node.kind, dn: d.dn, title: o.name, cls: 'warn', branch: oh.k === 'break' ? `Pause du département ${oh.g.name}` : `Fermé : département ${oh.g.name}`,
              lines: [oh.k === 'break' ? `Le département ${oh.g.name} est ${etat} : 3CX envoie l'appel vers la destination « pause » du département` : `Le département ${oh.g.name} est ${etat} : l'appel suit la destination « en dehors des heures » de cet élément`, hl, oh.k === 'break' && !oh.sure ? "Comportement non confirmé par l'historique des appels" : ''].filter(Boolean)});
            d = oh.d; continue; }
          note = oh.k === 'break' ? `Département ${oh.g.name} ${etat}, mais l'appel continue normalement${oh.h ? ` (${oh.h.n - oh.h.f} appels réels sur ${oh.h.n})` : ''}` : `Département ${oh.g.name} ${etat} : cet élément est réglé pour continuer normalement`; }
      }
      if(node.kind === 'Département'){
        const s = deptSchedule(o).expected(day, min, wd), hol = simHol(day), lines = hoursSummary(o.hours).slice(0, 3);
        if(hol && s !== 'holidays') lines.push(`⚠ ${hol} : jour férié non configuré dans ce département, l'horaire normal s'applique`);
        if(s === 'holidays') lines.push('Jour férié configuré');
        if(s === 'break') lines.push('Pause en cours');
        let r = o.routes[s], used = s;
        if((!r || !r.to || r.to === 'None') && (s === 'break' || s === 'holidays')){ r = o.routes.outOfOffice; used = 'outOfOffice'; lines.push(`Pas de destination propre pour « ${BR_FR[s]} » : destination « Fermé » supposée`); }
        st({kind: 'Département', dn: d.dn, title: o.name, branch: BR_FR[used], lines, cls: BR_CLS[s]});
        d = r; continue;
      }
      if(node.kind === 'Standard (IVR)'){
        const opts = o.options.slice().sort((a, b) => a.key.localeCompare(b.key)), k = keys[d.dn] != null && (keys[d.dn] === 'bad' || keys[d.dn] === 'none' || opts.some(x => x.key === keys[d.dn])) ? keys[d.dn] : 'none';
        const s = st({kind: 'Menu (IVR)', dn: d.dn, title: o.name, lines: [o.prompt ? '♪ ' + o.prompt : 'Aucun message configuré'], choice: {dn: d.dn, cur: k,
          opts: [['none', `Sans choix (${o.timeout} s)`], ...opts.map(op => [op.key, `Touche ${op.key} → ${op.type === 'External' ? phone(op.data) : (op.dn ? op.dn + ' ' + nmX(op.dn) : TO_FR[op.type] || op.type)}`]), ...(o.invalidDN ? [['bad', 'Touche invalide']] : [])]}});
        if(k === 'none'){
          s.branch = `Sans choix (${o.timeout} s)`;
          if(o.timeoutType === 'RepeatPrompt'){ s.lines.push('Le message est répété : le client doit choisir une touche'); return {end: 'wait', why: 'le menu attend un choix du client'}; }
          d = o.timeoutDN ? {to: o.timeoutType, dn: o.timeoutDN} : {to: o.timeoutType}; continue;
        }
        if(k === 'bad'){ s.branch = 'Touche invalide'; d = {to: 'Extension', dn: o.invalidDN}; continue; }
        const op = opts.find(x => x.key === k); s.branch = 'Touche ' + k; d = {to: op.type, dn: op.dn, ext: op.data}; continue;
      }
      if(node.kind === "File d'attente"){
        const isOn = m => histAt != null ? simAgentAt(d.dn, m, histAt) : !m.status || m.status === 'LoggedIn';
        const on = o.members.filter(isOn), off = o.members.length - on.length;
        const lines = [`${o.strategy} · ${o.ringTimeout} s par agent · attente max. ${o.masterTimeout} s`, `${on.length} agent${on.length > 1 ? 's' : ''} connecté${on.length > 1 ? 's' : ''}${off ? ` · ${off} déconnecté${off > 1 ? 's' : ''}` : ''}${histAt != null ? ' (connexions réelles à ce moment)' : ' (état au moment du backup)'}`];
        if(o.intro && o.introEnabled) lines.push('♪ ' + o.intro);
        if(!on.length) lines.push('⚠ Aucun agent connecté : personne ne peut répondre');
        const nx = o.dest && o.dest.to && o.dest.to !== 'None' ? o.dest : null;
        st({kind: "File d'attente", dn: d.dn, title: o.name, lines, agents: o.members.map(m => [m.dn, isOn(m)]), cls: on.length ? 'ok' : 'bad', branch: nx ? `Si personne ne répond en ${o.masterTimeout} s` : null});
        if(!nx) return on.length ? {end: 'human', why: 'les agents de la file sonnent (aucune destination si personne ne répond)'} : {end: 'lost', why: 'file sans agent connecté et sans débordement'};
        if(on.length) return overflow('les agents de la file sonnent', nx);
        d = nx; continue;
      }
      if(node.kind === 'Groupe de sonnerie'){
        const nx = o.dest && o.dest.to && o.dest.to !== 'None' ? o.dest : null;
        if(!o.members.length){ st({kind: 'Groupe de sonnerie', dn: d.dn, title: o.name, lines: ['Aucun membre : personne ne sonne'], cls: 'bad', branch: nx ? 'Sans réponse' : null}); // 18.1.25
          if(!nx) return {end: 'lost', why: 'groupe de sonnerie sans membre et sans destination'}; d = nx; continue; }
        st({kind: 'Groupe de sonnerie', dn: d.dn, title: o.name, lines: [`${o.strategy} · ${o.ringTime} s`], agents: o.members.map(m => [m, true]), cls: 'ok', branch: nx ? `Sans réponse (${o.ringTime} s)` : null});
        return nx ? overflow('les membres du groupe sonnent', nx) : {end: 'human', why: 'les membres du groupe sonnent'};
      }
      if(node.kind === 'Poste'){
        const p = o.profiles.find(x => x.name === o.profile) || o.profiles[0];
        const avail = /avail|custom/i.test(o.profile || '');
        const rt = p ? p.routes.find(r => avail ? /^AvailableRoute › NoAnswer › AllCalls/.test(r[0]) : /^AwayRoute › External/.test(r[0])) : null;
        const s = st({kind: 'Poste', dn: d.dn, title: d.dn + ' ' + nmX(d.dn), lines: [`Profil actuel : ${o.profile || '—'}`, !o.enabled ? '⚠ Poste désactivé' : ''].filter(Boolean), cls: avail ? 'ok' : 'warn'});
        const go = rt && rt[1].to && rt[1].to !== 'None' ? rt[1] : null;
        if(o.enabled === false){ s.cls = 'bad'; return {end: 'lost', why: "poste désactivé : l'appel n'aboutit pas"}; } // 18.1.26
        if(!avail && go){ s.branch = 'Absent : renvoi immédiat'; d = go; continue; }
        if(go){ s.branch = `Sans réponse (${p.noAnswer || o.noAnswer || '?'} s)`; return overflow('le poste sonne', go); }
        return {end: 'human', why: 'le poste sonne'};
      }
      st({kind: node.kind, dn: d.dn, title: d.dn + ' ' + (node.name || '')}); return {end: 'human', why: node.kind};
    }
    return {end: 'lost', why: 'parcours trop long'};
  }
  const r = run(d0);
  return Object.assign({steps}, r);
}
const SIM_KEY = 'simulateur3cx';
V.simulateur = (el, arg) => {
  if(!allDIDs.length){ el.innerHTML = '<h2>Simulateur d\'appel</h2><p class="muted">Aucun SDA dans ce backup.</p>'; return; }
  const S = window.__sim ||= (() => { let p = {}; try{ p = JSON.parse(localStorage.getItem(SIM_KEY) || '{}'); }catch(e){} return {did: p.did || '', day: '', time: p.time || '10:00', keys: {}}; })();
  if(arg) S.did = decodeURIComponent(arg);
  const opts = allDIDs.filter(r => !SEG || DIDSEG[r.did] === SEG).sort((a, b) => (lineCalls[b.did] || 0) - (lineCalls[a.did] || 0));
  if(!opts.some(r => r.did === S.did)) S.did = (opts[0] || allDIDs[0]).did;
  const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ});
  if(!S.day) S.day = today;
  const save = () => { try{ localStorage.setItem(SIM_KEY, JSON.stringify({did: S.did, time: S.time})); }catch(e){} };
  const label = r => `${phone(r.did)} · ${segShort(DIDSEG[r.did] || SEG_COMMON)} → ${r.rule?.office ? (dnName(r.rule.office.dn) || TO_FR[r.rule.office.to] || r.rule.office.to) : 'aucune destination'}${lineCalls[r.did] ? ` (${nf(lineCalls[r.did])} appels)` : ''}`;
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const nextHol = () => { const y = +today.slice(0, 4); return [...qcHolidays(y), ...qcHolidays(y + 1)].find(h => h[1] >= today); };
  const nextWd = w => { for(let i = 0; i < 7; i++){ const d = addD(today, i); if(simWd(d) === w) return d; } return today; };
  const nh = nextHol();
  el.innerHTML = `<div id="simwrap"><h2>Simulateur d'appel</h2>
    <p class="lead">Que se passe-t-il quand un client appelle ce numéro à ce moment-là ? Le simulateur suit la configuration du backup : règle entrante, horaires et jours fériés des départements, menus (choisissez la touche que le client fait), files et agents connectés (pour une date passée : les agents réellement connectés à ce moment, d'après l'historique des connexions), renvois des postes, débordements et messagerie.</p>
    <div class="bar"><input type="search" id="simq" placeholder="Rechercher un SDA : numéro (même partiel), magasin ou destination…" autocomplete="off" style="flex:1;min-width:220px">
      <span class="count" id="simqn"></span></div>
    <div class="bar"><select id="simdid" style="max-width:100%"></select></div>
    <div class="bar"><label class="count">Jour</label><input type="date" id="simday" value="${esc(S.day)}"><label class="count">Heure</label><input type="time" id="simtime" value="${esc(S.time)}" step="300">
      <span class="count" id="simwdn"></span>
      <span style="flex-basis:100%;height:0"></span>
      <button class="btn" data-p="now">Maintenant</button><button class="btn" data-p="eve">Ce soir 20 h</button><button class="btn" data-p="sat">Samedi 11 h</button><button class="btn" data-p="sun">Dimanche 11 h</button><button class="btn" data-p="noon">Midi (pause)</button>${nh ? `<button class="btn" data-p="hol">${esc(nh[0])} (${esc(nh[1].slice(5))})</button>` : ''}</div>
    <div id="simout"></div>
    <h3>Toute la semaine</h3><p class="muted" style="margin-top:-4px">Issue de l'appel heure par heure pour la semaine du jour choisi, avec les touches choisies ci-dessus. Cliquez une case pour simuler ce moment.</p><div id="simweek"></div>
    <p class="note">Le simulateur lit la configuration du backup. Pour une date passée couverte par l'historique, il utilise les connexions réelles des agents aux files à ce moment-là (les membres de chaque file restent ceux de la configuration actuelle) ; le statut de présence des postes (Disponible, Absent, Lunch…) et les renvois restent ceux du jour du backup, car 3CX ne conserve pas leur historique. Il ne tient pas compte des agents occupés au téléphone. Les jours fériés suivent ceux configurés dans chaque département ; un jour férié du Québec non configuré est signalé.</p></div>`;
  const W = $('#simwrap');
  // recherche de SDA : chiffres seuls comparés au numéro (avec ou sans le 1), sinon texte du libellé (magasin, destination)
  const norm = t => gsNorm(t).replace(/[\s().+-]/g, '');
  const txt = r => [r.did, phone(r.did), label(r), segName(DIDSEG[r.did] || SEG_COMMON), r.rule?.name || '', r.rule?.office?.dn || ''].join(' ');
  const fill = () => {
    const q = norm($('#simq').value), dq = q.replace(/\D/g, ''), digitsOnly = q && /^\d+$/.test(q);
    const list = !q ? opts : opts.filter(r => digitsOnly ? (r.did.includes(dq) || r.did.replace(/^1(?=\d{10}$)/, '').includes(dq)) : norm(txt(r)).includes(q));
    const sel = $('#simdid');
    sel.innerHTML = list.map(r => `<option value="${esc(r.did)}"${r.did === S.did ? ' selected' : ''}>${esc(label(r))}</option>`).join('') || '<option value="">Aucun SDA trouvé</option>';
    const others = q && SEG ? FULL.lines.flatMap(l => l.dids).filter(d => DIDSEG[d] !== SEG && (digitsOnly ? d.includes(dq) : norm(d + ' ' + phone(d) + ' ' + segName(DIDSEG[d] || SEG_COMMON)).includes(q))).length : 0;
    $('#simqn').textContent = q ? `${list.length ? `${list.length} SDA trouvé${list.length > 1 ? 's' : ''}` : 'Aucun SDA trouvé'}${others ? ` · ${others} autre${others > 1 ? 's' : ''} dans d'autres magasins (choisir « Tous les magasins » dans le bandeau)` : ''}` : `${opts.length} SDA`;
    // la sélection suit la recherche : premier résultat si le SDA affiché n'en fait plus partie
    if(list.length && !list.some(r => r.did === S.did)){ S.did = list[0].did; S.keys = {}; history.replaceState(null, '', '#simulateur/' + S.did); save(); draw(); }
  };
  const draw = () => {
    const [h, m] = S.time.split(':').map(Number), min = h * 60 + (m || 0), wd = simWd(S.day), hol = simHol(S.day);
    $('#simwdn').textContent = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][wd] + (hol ? ' · ' + hol : '');
    const HR = simHistRange(), at = simAt(S.day, min), useHist = !!(HR && at >= HR[0] && at <= HR[1]), optAt = useHist ? {at} : null;
    const R = simulate(S.did, S.day, min, S.keys, null, optAt), E = SIM_END[R.end], A = R.after ? SIM_END[R.after] : null;
    // appels réellement reçus sur ce numéro ce jour-là, ± 60 min
    const dayCalls = useHist || (FULL.calls.length && S.day <= localParts(FULL.calls[0][0])[0] && S.day >= localParts(FULL.calls[FULL.calls.length - 1][0])[0])
      ? FULL.calls.filter(c => c[1] === 'in' && c[5] === S.did && localParts(c[0])[0] === S.day && Math.abs(localFull(c[0])[1] - min) <= 60).sort((a, b) => a[0] < b[0] ? -1 : 1) : null;
    const histNote = !HR ? "Agents : état au moment du backup (rouvrez le backup pour utiliser l'historique des connexions)."
      : useHist ? `Agents : connexions réelles aux files le ${S.day} à ${S.time}, d'après l'historique.`
      : `Agents : état au moment du backup (l'historique des connexions couvre du ${localParts(new Date(HR[0]).toISOString())[0]} au ${localParts(new Date(HR[1] - 3600e3).toISOString())[0]}).`;
    // appels réels à ce moment (même jour de la semaine, ± 30 min) dans l'historique
    const real = {n: 0, ans: 0, vm: 0, lost: 0, bridge: 0};
    FULL.calls.forEach(c => { if(c[1] !== 'in' || c[5] !== S.did) return; const lf = localFull(c[0]); if(lf[2] !== wd || Math.abs(lf[1] - min) > 30) return;
      real.n++; if(ANS_ST.has(c[10])) real.ans++; else if(c[10] === 'vm') real.vm++; else if(ST_LOST.has(c[10])) real.lost++; else if(c[10] === 'bridge') real.bridge++; });
    $('#simout').innerHTML = `<div class="card simres ${E[1]}"><div class="bkt">Résultat</div><div class="muted" style="font-size:12px;margin-bottom:4px"><span class="pill ${useHist ? 'acc' : ''}">${useHist ? 'Historique réel' : 'Configuration actuelle'}</span> ${esc(histNote)}</div><div style="font-size:19px;font-weight:600"><span class="pill ${E[1]}">${E[0]}</span> ${esc(R.why)}</div>
      ${A ? `<div class="muted" style="margin-top:4px">Si personne ne répond : <span class="pill ${A[1]}">${A[0]}</span> ${esc(R.afterWhy || '')}</div>` : ''}
      ${real.n ? `<div class="muted" style="font-size:12.5px;margin-top:6px">Dans l'historique, le même jour de la semaine vers la même heure (± 30 min) : ${nf(real.n)} appel${real.n > 1 ? 's' : ''} sur ce numéro — ${nf(real.ans)} répondu${real.ans > 1 ? 's' : ''}, ${nf(real.vm)} en messagerie, ${nf(real.lost)} perdu${real.lost > 1 ? 's' : ''}${real.bridge ? `, ${nf(real.bridge)} transféré${real.bridge > 1 ? 's' : ''} vers un autre 3CX (bridge)` : ''}.</div>` : ''}</div>
      ${dayCalls ? `<details class="simreal"${dayCalls.length ? ' open' : ''}><summary style="cursor:pointer;font-size:13px;margin-top:6px"><b>Ce qui s'est réellement passé ce jour-là</b> <span class="muted">(${S.day}, entre ${String(Math.max(0, Math.floor((min - 60) / 60))).padStart(2, '0')} h ${String(Math.max(0, min - 60) % 60).padStart(2, '0')} et ${String(Math.min(23, Math.floor((min + 60) / 60))).padStart(2, '0')} h ${String((min + 60) % 60).padStart(2, '0')}) : ${dayCalls.length} appel${dayCalls.length > 1 ? 's' : ''}</span></summary>
        ${dayCalls.length ? `<div style="font-size:12.5px;margin-top:4px">${dayCalls.slice(0, 25).map(c => { const st = ST[c[10]] || [c[10], '']; const last = c[9].length ? c[9][c[9].length - 1][0] : '';
          return `<div><span class="mono">${(m2 => String(Math.floor(m2 / 60)).padStart(2, '0') + ':' + String(m2 % 60).padStart(2, '0'))(localFull(c[0])[1])}</span> <span class="pill ${st[1]}">${esc(st[0])}</span>${c[6] && c[6] !== 'VM' ? ` répondu par ${dnLink(c[6])}` : last ? ` <span class="muted">dernier passage : ${esc(last + ' ' + dnName(last))}</span>` : ''} <span class="muted">· ${dur(c[7])}</span></div>`; }).join('')}${dayCalls.length > 25 ? `<div class="muted">… et ${dayCalls.length - 25} autre(s)</div>` : ''}</div>` : '<div class="muted" style="font-size:12.5px">Aucun appel reçu sur ce numéro dans cet intervalle.</div>'}</details>` : ''}
      <ol class="simsteps">${R.steps.map(s => `<li class="${s.soft ? 'soft' : ''} ${s.cls ? 'c-' + s.cls : ''}"><div class="sk">${esc(s.kind)}</div>
        <div class="st">${s.dn && DN[s.dn] ? dnLink(s.dn) : esc(s.title)}${s.branch ? ` <span class="pill ${s.cls || ''}">${esc(s.branch)}</span>` : ''}</div>
        ${s.lines.filter(Boolean).map(l => `<div class="muted" style="font-size:12.5px">${esc(l)}</div>`).join('')}
        ${s.agents ? `<div class="simag">${s.agents.slice(0, 30).map(([a, ok]) => `<span class="pill ${ok ? '' : 'bad'}" title="${ok ? 'connecté' : 'déconnecté de la file'}">${esc(a)} ${esc(dnName(a))}</span>`).join('')}${s.agents.length > 30 ? ` <span class="muted">+${s.agents.length - 30}</span>` : ''}</div>` : ''}
        ${s.choice ? `<div style="margin-top:6px"><label class="count">Le client fait :</label> <select class="simkey" data-dn="${esc(s.choice.dn)}">${s.choice.opts.map(([v, l]) => `<option value="${esc(v)}"${v === s.choice.cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}</li>`).join('')}</ol>`;
    // semaine
    const mon = addD(S.day, -wd), days = Array.from({length: 7}, (_, i) => addD(mon, i)), hours = Array.from({length: 24}, (_, i) => i);
    const col = {human: 'var(--ok)', vm: 'var(--warn)', ext: 'var(--accent)', lost: 'var(--bad)', wait: 'var(--muted)'};
    $('#simweek').innerHTML = `<div class="tw"><table class="simgrid"><thead><tr><th></th>${hours.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${days.map(d => `<tr><th>${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][simWd(d)]} ${d.slice(8)}${simHol(d) ? ' ★' : ''}</th>${hours.map(x => {
        const at2 = simAt(d, x * 60 + 30), r = simulate(S.did, d, x * 60 + 30, S.keys, null, HR && at2 >= HR[0] && at2 <= HR[1] ? {at: at2} : null), sel = d === S.day && Math.floor(min / 60) === x;
        return `<td data-d="${d}" data-h="${x}" title="${d} ${x} h 30 : ${esc(SIM_END[r.end][0])}${r.after ? ' puis ' + esc(SIM_END[r.after][0]) : ''}" style="background:${col[r.end]};${sel ? 'outline:2px solid var(--text);outline-offset:-2px' : ''}"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="legend">${Object.entries(SIM_END).map(([k, v]) => `<span><i style="background:${col[k]}"></i>${esc(v[0])}</span>`).join('')}<span>★ jour férié du Québec</span></div>`;
  };
  $('#simq').addEventListener('input', fill);
  $('#simq').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); $('#simdid').focus(); } });
  W.addEventListener('change', e => {
    if(e.target.id === 'simdid'){ if(!e.target.value) return; S.did = e.target.value; S.keys = {}; history.replaceState(null, '', '#simulateur/' + S.did); }
    else if(e.target.id === 'simday'){ S.day = e.target.value || today; }
    else if(e.target.id === 'simtime'){ S.time = e.target.value || '10:00'; }
    else if(e.target.classList.contains('simkey')){ S.keys[e.target.dataset.dn] = e.target.value; }
    else return;
    save(); draw();
  });
  W.addEventListener('click', e => {
    const p = e.target.closest('button[data-p]');
    if(p){ const k = p.dataset.p, now = new Date();
      if(k === 'now'){ S.day = today; S.time = now.toLocaleTimeString('fr-CA', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false}).replace(' h ', ':').slice(0, 5); }
      if(k === 'eve'){ S.day = today; S.time = '20:00'; }
      if(k === 'sat'){ S.day = nextWd(5); S.time = '11:00'; }
      if(k === 'sun'){ S.day = nextWd(6); S.time = '11:00'; }
      if(k === 'noon'){ S.time = '12:15'; }
      if(k === 'hol' && nh){ S.day = nh[1]; S.time = '10:00'; }
      $('#simday').value = S.day; $('#simtime').value = S.time; save(); draw(); return; }
    const td = e.target.closest('#simweek td[data-d]');
    if(td){ S.day = td.dataset.d; S.time = String(td.dataset.h).padStart(2, '0') + ':30'; $('#simday').value = S.day; $('#simtime').value = S.time; save(); draw(); }
  });
  fill(); draw();
};

