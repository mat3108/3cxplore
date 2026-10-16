// ---------- Historique d'un client ----------
const DIR_FR = {in: 'Entrant', out: 'Sortant', int: 'Interne'};
function clientHistory(num){
  const all = FULL.calls, calls = [];
  all.forEach(c => { if((c[1] === 'in' && normNum(c[2]) === num) || (c[1] === 'out' && normNum(c[4]) === num)) calls.push(c); });
  const names = [...new Set(calls.filter(c => c[1] === 'in' && c[3] && normNum(c[3]) !== num).map(c => c[3].trim()))];
  const contacts = FULL.phonebook.filter(p => [p.phone, ...p.other].some(x => normNum(x) === num));
  const recs = (FULL.recordings || []).filter(r => normNum(r[3]) === num);
  const vms = (FULL.voicemails || []).filter(v => normNum(v.from) === num);
  const qcs = (FULL.queueCalls || []).filter(r => normNum(r[2]) === num);
  return {num, calls, names, contacts, recs, vms, qcs};
}
const pathTxt = c => c[9].filter(p => p[1] !== 'extension').map(p => dnName(p[0]) || p[0]).join(' → ');
const answerers = c => Array.isArray(c[11]) && c[11].length ? c[11].map(x => x[0]) : (c[6] && c[6] !== 'VM' ? [c[6]] : []);

V.client = (el, arg) => {
  const q0 = arg ? decodeURIComponent(arg) : (window.__clientNum || '');
  el.innerHTML = `<div id="clwrap"><h2>Historique d'un client</h2>
    <p class="lead">Tout ce que le backup sait d'un numéro de téléphone : appels entrants et sortants (tous magasins), qui a répondu, où l'appel a été perdu, passages en file, messages vocaux et enregistrements. Le numéro peut être saisi dans n'importe quel format.</p>
    <div class="bar"><input type="search" id="clq" placeholder="Numéro du client, ex. (555) 123-4567" value="${esc(q0)}" autocomplete="off"><button class="btn primary" id="clgo">Afficher</button></div>
    <div id="clbody"></div></div>`;
  const go = () => { const v = $('#clq').value.trim(), n = normNum(v); window.__clientNum = v;
    if(!n){ $('#clbody').innerHTML = v ? '<p class="muted">Saisissez un numéro d\'au moins 10 chiffres.</p>' : ''; return; }
    if(location.hash !== '#client/' + n) history.replaceState(null, '', '#client/' + n);
    draw(clientHistory(n)); };
  $('#clgo').addEventListener('click', go);
  $('#clq').addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
  function draw(H){
    const C = H.calls, inc = C.filter(c => c[1] === 'in'), out = C.filter(c => c[1] === 'out');
    if(!C.length && !H.contacts.length && !H.recs.length && !H.vms.length){ $('#clbody').innerHTML = `<p class="muted">Aucun échange avec le ${esc(phone(H.num))} dans l'historique du backup.</p>`; return; }
    const ok = inc.filter(c => ANS_ST.has(c[10])).length, lost = inc.filter(c => ST_LOST.has(c[10])).length;
    const lastIn = inc[0], lastLost = inc.find(c => ST_LOST.has(c[10]));
    const lostSeg = lastLost ? callSeg(lastLost) : ''; // 18.2.7 : même magasin que l'appel manqué (n'importe lequel pour un numéro commun)
    const calledBack = lastLost && C.some(c => c[0] > lastLost[0] && (lostSeg[0] === '@' || callSeg(c) === lostSeg) && ((c[1] === 'out' && c[10] === 'ans' && c[8] > 0) || (c[1] === 'in' && ANS_ST.has(c[10]))));
    const segs = {}; C.forEach(c => { const s = callSeg(c); segs[s] = (segs[s] || 0) + 1; });
    const ag = {}; C.forEach(c => answerers(c).forEach(x => (ag[x] ||= {a: 0, o: 0}).a++)); out.forEach(c => { if(c[2]) (ag[c[2]] ||= {a: 0, o: 0}).o++; });
    const talk = C.reduce((a, c) => a + (c[8] || 0), 0);
    const recByTime = c => H.recs.find(r => Math.abs(Date.parse(r[0]) - Date.parse(c[0])) < 15 * 60000 && (answerers(c).includes(r[1]) || r[1] === c[2]));
    $('#clbody').innerHTML = `
      <div class="card clhead"><div><div class="bkt">Client</div><div class="clnum mono">${esc(phone(H.num))}${vipStar(H.num)}</div>
        <div class="muted">${H.contacts.map(p => esc([(p.first + ' ' + p.last).trim(), p.company].filter(Boolean).join(' — ')) + ' <span class="pill">annuaire</span>').join('<br>') || esc(H.names.slice(0, 3).join(' · ')) || 'Nom inconnu'}</div></div>
        ${lastLost && !calledBack ? `<div class="pill bad" style="white-space:normal">Dernier appel manqué le ${fmtD(lastLost[0])} — pas encore rappelé</div>` : lastLost ? `<div class="pill ok">Dernier appel manqué rappelé ou servi ensuite</div>` : ''}</div>
      <div class="grid kpis">${[['Appels entrants', nf(inc.length)], ['Répondus', `${nf(ok)} (${pct(ok, inc.length)})`], ['Perdus', nf(lost)], ['Appels sortants (rappels)', nf(out.length)], ['Temps de conversation', dur(talk)], ['Premier / dernier échange', C.length ? `${dayKey(C[C.length - 1][0])} → ${dayKey(C[0][0])}` : '–']]
        .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:19px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      <div class="grid two" style="margin-top:12px">
        <div class="card"><h3 style="margin-top:0">Magasins contactés</h3>${Object.entries(segs).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<span class="pill">${esc(segShort(s))} · ${n}</span>`).join('') || '–'}</div>
        <div class="card"><h3 style="margin-top:0">Interlocuteurs</h3>${Object.entries(ag).sort((a, b) => (b[1].a + b[1].o) - (a[1].a + a[1].o)).slice(0, 12).map(([x, v]) => `<div>${dnLink(x)} <span class="muted">${[v.a && v.a + ' répondu' + (v.a > 1 ? 's' : ''), v.o && v.o + ' appel' + (v.o > 1 ? 's' : '') + ' sortant' + (v.o > 1 ? 's' : '')].filter(Boolean).join(' · ')}</span></div>`).join('') || '<span class="muted">Personne n\'a encore répondu.</span>'}</div>
      </div>
      <h3>Chronologie des appels (${nf(C.length)})</h3>
      <div class="tw"><table><thead><tr><th>Date</th><th>Sens</th><th>Magasin</th><th>Numéro du magasin / parcours</th><th>Issue</th><th>Interlocuteur</th><th class="num">Durée</th><th>Enregistrement</th></tr></thead><tbody>
      ${C.slice(0, 500).map((c, ci) => { const r = recByTime(c), who = c[1] === 'out' ? [c[2]] : answerers(c);
        return `<tr class="click" data-ci="${ci}"><td>${fmtD(c[0])}</td><td><span class="pill ${c[1] === 'in' ? 'acc' : 'ok'}">${DIR_FR[c[1]]}</span></td><td class="muted">${esc(segShort(callSeg(c)))}</td>
        <td style="font-size:12px">${c[1] === 'in' ? `<span class="mono">${esc(phone(c[5]))}</span>${pathTxt(c) ? '<div class="muted">' + esc(pathTxt(c)) + '</div>' : ''}` : '<span class="muted">appel sortant</span>'}</td>
        <td>${c[1] === 'out' ? (c[8] ? '<span class="pill ok">Abouti</span>' : '<span class="pill">Sans réponse</span>') : `<span class="pill ${(ST[c[10]] || ['', ''])[1]}">${esc((ST[c[10]] || [c[10]])[0])}</span>`}</td>
        <td>${who.map(x => dnLink(x)).join('<br>') || '<span class="muted">—</span>'}</td><td class="num">${dur(c[8] || 0)}</td>
        <td>${r ? (BK.recHas && BK.recHas(r[5]) ? `<span class="recplay"><button class="btn recbtn" data-u="${esc(r[5])}">▶ Écouter</button></span>` : `<span class="muted" style="font-size:12px" title="${esc(r[5])}">${D.recInBackup === 0 ? 'non inclus dans le backup' : 'oui'}</span>`) : ''}</td></tr>`; }).join('')}
      </tbody></table></div>${C.length > 500 ? '<p class="muted">Seuls les 500 appels les plus récents sont affichés.</p>' : ''}
      ${H.qcs.length ? `<h3>Passages en file d'attente (${H.qcs.length})</h3><div class="tw"><table><thead><tr><th>Date</th><th>File</th><th class="num">Attente</th><th>Résultat</th></tr></thead><tbody>
        ${H.qcs.slice(0, 200).map(r => `<tr><td>${fmtD(r[0])}</td><td>${dnLink(r[1])}</td><td class="num">${dur(r[4])}</td><td>${r[6] ? `<span class="pill ok">Servi</span> ${dnLink(r[7])}` : `<span class="pill bad">Non servi</span> <span class="muted">${esc(r[8])}</span>`}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${H.vms.length ? `<h3>Messages vocaux (${H.vms.length})</h3>${H.vms.map(v => `<div>${dnLink(v.ext)} · ${esc(fmtD(vmUTC(v.date)) || v.date)} ${audio(v.path)}</div>`).join('')}` : ''}`;
    $('#clbody').addEventListener('click', async e => { const ctr = e.target.closest('tr[data-ci]'); if(ctr && !e.target.closest('a,button,audio')){ openCall(C[+ctr.dataset.ci]); return; }
      const b = e.target.closest('.recbtn'); if(!b) return; const cell = b.closest('.recplay'); b.disabled = true; b.textContent = 'Chargement…';
      try{ const blob = await BK.recBlob(b.dataset.u); const url = URL.createObjectURL(blob); (window.__recUrls ||= []).push(url); cell.innerHTML = `<audio controls autoplay src="${url}" style="height:30px;max-width:220px"></audio>`; }catch(er){ cell.textContent = 'Lecture impossible'; } });
  }
  if(q0) go();
};

