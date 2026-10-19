// ---------- Parcours détaillé d'un appel (15.15) : chaque étape du CDR avec son moment, sa durée, la raison d'y arriver et son issue ----------
const JR_KIND = {unknown: 'SDA', group: 'Département', queue: "File d'attente", ivr: 'Standard (IVR)', extension: 'Poste', provider: 'Numéro externe', bridge: 'Autre site (bridge)', shared_parking: 'Parking', parking_orbit: 'Parking',
  ring_group_ring_all: 'Groupe de sonnerie', ring_group_hunt: 'Groupe de sonnerie', vmail_console: 'Messagerie vocale', voicemail: 'Messagerie vocale', script: 'Script', paging_group: 'Radiomessagerie', fax: 'Fax'};
const JR_COL = {ivr: '#8b5cf6', queue: '#f59e0b', extension: '#10b981', provider: '#3b82f6', shared_parking: '#06b6d4', parking_orbit: '#06b6d4', vmail_console: '#ef4444', voicemail: '#ef4444', ring_group_ring_all: '#f97316', ring_group_hunt: '#f97316', bridge: '#64748b'};
const JR_WHY = {by_did: 'appel reçu sur le SDA', office_time: "heures d'ouverture", out_of_office: 'hors heures', break_time: 'pause', holiday: 'jour férié', no_answer: "sans réponse à l'étape précédente", busy: 'occupé',
  forward_all: 'renvoi de tous les appels', dnd: 'ne pas déranger', custom_dnd: 'statut personnalisé', away: 'absent', not_registered: 'poste non connecté', no_destinations: 'aucun agent disponible',
  by_caller_id: "selon le numéro de l'appelant", callback_requested: 'rappel demandé', callback: 'rappel', in_conference: 'conférence'};
const JR_HOW = {transfer: 'transféré', pickup: 'intercepté', join: 'conférence', divert: 'dérivé', route_to: 'acheminé'};
const JR_END = {cancelled: 'sonnerie arrêtée', src_participant_terminated: "l'appelant raccroche", dst_participant_terminated: 'fin de la conversation', redirected: 'redirigé', rejected: 'refusé'};
const jrT = s => `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const JR_BOX = new Set(['queue', 'ring_group_ring_all', 'ring_group_hunt', 'group']);
function callJourney(c){
  const st = c[14];
  if(!Array.isArray(st) || !st.length) return `<h3>Parcours</h3><ol>${c[9].map(p => `<li><span class="pill">${esc(JR_KIND[p[1]] || p[1])}</span> ${dnLink(p[0]) || esc(p[0])}</li>`).join('')}</ol>
    <p class="muted" style="font-size:12.5px">Rouvrez le backup pour voir le détail de chaque étape (moment, durée, raison, issue) : il est extrait depuis la version 15.15.</p>`;
  const total = Math.max(1, c[7], ...st.map(s => s[2] + s[3]));
  // étapes principales ; les sonneries des agents (polling) sont rattachées à la file ou au groupe qui les fait sonner
  const main = [];
  st.forEach(s => { if(s[1] === 'extension' && s[8] === 'polling'){ const box = [...main].reverse().find(m => JR_BOX.has(m.s[1]) && m.s[2] <= s[2] + 1); if(box){ (box.rings ||= []).push(s); return; } } main.push({s}); });
  const lineOf = n => FULL.lines.find(l => l.number === n);
  // « unknown » : au début, le SDA (entrant) ou le numéro composé ; plus loin, un élément connu, un numéro externe (renvoi) ou un autre participant
  const kindOf = s => s[1] === 'unknown' ? (s === st[0] ? (c[1] === 'in' ? 'SDA' : 'Numéro composé') : DN[s[0]] ? DN[s[0]].kind : /^\+?\d{10,}$/.test(s[0]) ? 'Numéro externe' : 'Autre participant') : s[1] === 'provider' && lineOf(s[0]) ? 'Trunk' : JR_KIND[s[1]] || s[1];
  const tgt = s => s[1] === 'provider' && lineOf(s[0]) ? `<span class="mono">${esc(s[0])}</span> <span class="muted">${esc(lineOf(s[0]).gateway || '')}</span>` : (s[1] === 'unknown' && !DN[s[0]]) || s[1] === 'provider' ? `<span class="mono">${esc(phone(s[0]) || s[0])}</span>` : (DN[s[0]] ? dnLink(s[0]) : `<span class="mono">${esc(s[0])}</span>`);
  const rows = main.map((m, i) => { const s = m.s, nx = main[i + 1], k = s[1];
    const why = i === 0 ? (c[1] === 'in' ? 'appel entrant' : "début de l'appel") : JR_WHY[s[8]] || JR_HOW[s[7]] || '';
    let res = '';
    if(k === 'extension' || k === 'provider') res = s[4] >= 0 ? `répondu après ${dur(s[4])} · conversation ${dur(Math.max(0, s[3] - s[4]))}` : `sonne pendant ${dur(s[3])} · ${JR_END[s[5]] || 'sans réponse'}`;
    else if(k === 'ivr'){ const iv = FULL.ivrs.find(x => x.number === s[0]), o = iv && nx && iv.options.find(x => x.dn && x.dn === nx.s[0]);
      res = `menu écouté ${dur(s[3])}` + (o ? ` · touche ${o.key}` : iv && nx && iv.timeoutDN === nx.s[0] ? ' · aucun choix (délai)' : '') + (s[5] === 'src_participant_terminated' ? " · l'appelant raccroche" : ''); }
    else if(JR_BOX.has(k)){ const ok = (m.rings || []).find(r => r[4] >= 0);
      res = ok ? `répondu par ${dnLink(ok[0])} après ${dur(ok[2] + ok[4] - s[2])} d'attente` : s[3] ? `en attente ${dur(s[3])}` + (s[5] === 'src_participant_terminated' ? " · l'appelant raccroche" : s[6] === 'no_answer' ? ' · délai dépassé' : s[6] && JR_WHY[s[6]] ? ' · suite : ' + JR_WHY[s[6]] : '') : s[6] && JR_WHY[s[6]] ? 'suite : ' + JR_WHY[s[6]] : ''; }
    else if(k === 'shared_parking' || k === 'parking_orbit') res = `parqué pendant ${dur(s[3])}` + (s[5] === 'src_participant_terminated' ? " · l'appelant raccroche" : '');
    else if(k !== 'unknown') res = (s[3] ? dur(s[3]) : '') + (JR_END[s[5]] ? (s[3] ? ' · ' : '') + JR_END[s[5]] : '');
    const ringTxt = m.rings && m.rings.length ? `<div class="muted" style="font-size:12px">Sonne chez ${m.rings.length} poste${m.rings.length > 1 ? 's' : ''} : ${m.rings.slice(0, 8).map(r => `${dnLink(r[0])} <span class="mono">${dur(r[3])}</span>${r[4] >= 0 ? ' ✓' : ''}`).join(', ')}${m.rings.length > 8 ? ', …' : ''}</div>` : '';
    return `<tr><td class="mono">${jrT(s[2])}</td><td><span class="sw" style="background:${JR_COL[k] || 'var(--line)'}"></span><span class="pill">${esc(kindOf(s))}</span> ${tgt(s)}${ringTxt}</td><td class="muted">${esc(why)}</td><td>${res}</td></tr>`; }).join('');
  const bar = main.flatMap(m => [m.s, ...(m.rings || []).filter(x => x[4] >= 0)]).filter(s => s[3] > 0).map(s => { const l = 100 * s[2] / total, w = Math.max(0.6, 100 * s[3] / total), a = s[4] >= 0 && (s[1] === 'extension' || s[1] === 'provider') ? 100 * s[4] / Math.max(1, s[3]) : null;
    return `<i title="${esc(kindOf(s) + ' ' + s[0] + ' · ' + dur(s[3]))}" style="position:absolute;left:${l}%;width:${w}%;top:0;bottom:0;background:${JR_COL[s[1]] || '#94a3b8'};opacity:${a == null ? .55 : 1};${a != null ? `background:linear-gradient(90deg,${JR_COL[s[1]]}66 ${a}%,${JR_COL[s[1]]} ${a}%)` : ''}"></i>`; }).join('');
  return `<h3>Parcours détaillé</h3>
    <div style="position:relative;height:14px;border-radius:7px;overflow:hidden;background:var(--line);margin:6px 0 2px">${bar}</div>
    <div class="muted" style="display:flex;justify-content:space-between;font-size:11.5px"><span>0:00</span><span>${dur(total)}</span></div>
    <div class="tw"><table><thead><tr><th>Moment</th><th>Étape</th><th>Raison</th><th>Issue</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" style="font-size:12px">D'après l'historique des appels (CDR) de 3CX. Moment : temps écoulé depuis le début de l'appel. La touche choisie dans un menu est déduite de l'étape suivante.</p>`;
}
function openCall(c){
  openDrawer(`Appel du ${fmtD(c[0])}`, kv([['Direction', {in: 'Entrant', out: 'Sortant', int: 'Interne', transit: 'Transit depuis un autre 3CX (bridge → trunk)'}[c[1]]], ['Appelant', esc(phone(c[2])) + ' ' + esc(c[3]) + (DN[c[2]] ? ' ' + dnLink(c[2], false) : '')], ['Appelé', c[1] === 'int' ? dnLink(c[4]) : esc(phone(c[4]))],
      ['DID', esc(phone(c[5]))], ['Issue', stHTML(c)], ['Durée totale', dur(c[7])], c[12] != null ? ['Attente avant réponse', dur(c[12])] : null, ['Conversation', dur(c[8])]]) +
    (c[1] !== 'int' && normNum(c[1] === 'in' ? c[2] : c[4]) ? `<p><a class="btn" href="#client/${normNum(c[1] === 'in' ? c[2] : c[4])}">Historique de ce client</a></p>` : '') + callJourney(c));
}
