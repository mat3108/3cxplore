// ---------- Audit des renvois externes (onglet) ----------
const RX_FLAG = {inactive: ['Poste inactif', 'bad'], other: ["Cellulaire d'un autre employé", 'warn'], unknown: ['Numéro non reconnu', 'warn'], own: ['Son cellulaire', 'ok'], disabled: ['Poste désactivé', '']};
let RX_CACHE = null;
function rxAnalysis(){
  if(RX_CACHE) return RX_CACHE;
  const calls = FULL.calls, end = calls.length ? calls[0][0] : new Date().toISOString(), lim30 = new Date(Date.parse(end) - 30 * 864e5).toISOString();
  const mob = {}; FULL.extensions.forEach(e => { const k = normNum(e.mobile); if(k) (mob[k] ||= []).push(e.number); });
  // activité : dernier appel répondu ou passé par le poste ; appels renvoyés vers l'extérieur par le poste (dernier élément du parcours)
  const last = {}, fw = {};
  for(const c of calls){ const a = c[6] && c[6] !== 'VM' ? c[6] : c[1] !== 'in' ? c[2] : '';
    if(a && !last[a]) last[a] = c[0];
    if(Array.isArray(c[11])) c[11].forEach(([x]) => { if(!last[x]) last[x] = c[0]; }); // 18.1.45 : tous les postes qui ont répondu
    if(c[10] === 'fwd_ok' || c[10] === 'fwd_no'){ const p = c[9], n = p.length ? p[p.length - 1][0] : ''; if(!n) continue;
      const f = fw[n] ||= {ok: 0, no: 0, last: ''}; f[c[10] === 'fwd_ok' ? 'ok' : 'no']++; if(c[0] > f.last) f.last = c[0]; } }
  const rows = [];
  FULL.extensions.forEach(e => {
    const per = {};
    e.profiles.forEach(p => p.routes.forEach(([k, d]) => { if(!d || d.to !== 'External' || !d.ext) return; const x = per[normNum(d.ext) || d.ext] ||= {raw: d.ext, st: new Set(), conds: new Set()};
      x.st.add(FWD_ST[p.name] || p.name); const t = k.split(' › ').slice(1); x.conds.add(t.join(' ')); }));
    const ring = e.profiles.filter(p => p.ringMobile === 'True' || p.ringMobile === '1').map(p => FWD_ST[p.name] || p.name);
    Object.entries(per).forEach(([k, x]) => {
      const others = (mob[k] || []).filter(n => n !== e.number), own = normNum(e.mobile) && normNum(e.mobile) === k;
      const curLab = FWD_ST[e.profile] || e.profile, active = x.st.has(curLab), lastAct = last[e.number] || '';
      const flags = [];
      if(e.enabled === false) flags.push('disabled');
      else if(!lastAct || lastAct < lim30) flags.push('inactive');
      if(own) flags.push('own'); else if(others.length) flags.push('other'); else flags.push('unknown');
      rows.push({e, num: k, raw: x.raw, st: [...x.st], conds: [...x.conds], active, cur: curLab, ring, others, own, flags, lastAct, f: fw[e.number] || {ok: 0, no: 0, last: ''}, seg: SEGOF[e.number] || SEG_COMMON});
    });
  });
  const ord = Object.values(FWD_ST); rows.forEach(r => r.st.sort((a, b) => (ord.indexOf(a) + 1 || 99) - (ord.indexOf(b) + 1 || 99)));
  return RX_CACHE = {rows, end, ringOnly: FULL.extensions.filter(e => !rows.some(r => r.e === e) && e.profiles.some(p => p.ringMobile === 'True' || p.ringMobile === '1'))};
}
V.renvois = el => {
  const S = window.__rx ||= {fl: ''};
  const A = rxAnalysis(), rows = A.rows.filter(r => !SEG || r.seg === SEG);
  const exts = new Set(rows.map(r => r.e.number)), nums = {}; rows.forEach(r => (nums[r.num] ||= []).push(r));
  const fOk = [...exts].reduce((a, n) => a + (A.rows.find(r => r.e.number === n).f.ok), 0), fNo = [...exts].reduce((a, n) => a + (A.rows.find(r => r.e.number === n).f.no), 0);
  const cnt = k => rows.filter(r => r.flags.includes(k)).length;
  const day = s => s ? FMT_DAY.format(new Date(s)) : '—'; // 18.1.18 : fuseau du système 3CX
  el.innerHTML = `<div id="rxwrap"><h2>Renvois externes</h2>
    <p class="lead">Tous les postes qui renvoient des appels vers un numéro externe (cellulaire, domicile, autre entreprise), pour quel statut, et combien d'appels sont réellement partis vers l'extérieur d'après l'historique. Repère les renvois d'anciens employés, vers le cellulaire d'un collègue ou vers un numéro inconnu${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="grid kpis">${[['Postes avec renvoi externe', nf(exts.size), ''], ['Numéros externes', nf(Object.keys(nums).length), ''], ['Actifs maintenant', nf(rows.filter(r => r.active).length), ''], ['Appels renvoyés (répondus)', nf(fOk), ''], ['Renvoyés sans réponse', nf(fNo), fNo ? 'warn' : ''],
      ['Postes inactifs (30 j)', nf(new Set(rows.filter(r => r.flags.includes('inactive')).map(r => r.e.number)).size), cnt('inactive') ? 'bad' : ''], ["Cellulaire d'un autre employé", nf(cnt('other')), cnt('other') ? 'warn' : ''], ['Numéros non reconnus', nf(cnt('unknown')), '']].map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="bar"><select id="rxfl"><option value="">Tous les renvois (${rows.length})</option>${Object.entries(RX_FLAG).map(([k, [l]]) => `<option value="${k}"${S.fl === k ? ' selected' : ''}>${esc(l)} (${cnt(k)})</option>`).join('')}<option value="active"${S.fl === 'active' ? ' selected' : ''}>Actifs maintenant (${rows.filter(r => r.active).length})</option></select></div>
    <div id="rxt"></div>
    <h3>Numéros externes utilisés par plusieurs postes</h3>
    <div class="card" style="font-size:13px">${Object.entries(nums).filter(([, rs]) => new Set(rs.map(r => r.e.number)).size > 1).sort((a, b) => b[1].length - a[1].length).map(([n, rs]) => `<div><b class="mono">${esc(phone(n))}</b> <span class="muted">←</span> ${[...new Set(rs.map(r => r.e.number))].map(x => dnLink(x)).join(', ')}</div>`).join('') || '<span class="muted">Aucun : chaque numéro externe n\'est utilisé que par un poste.</span>'}</div>
    ${A.ringOnly.length ? `<h3>« Faire sonner aussi le cellulaire » sans renvoi (${A.ringOnly.filter(e => !SEG || SEGOF[e.number] === SEG).length})</h3><div class="card" style="font-size:13px">${A.ringOnly.filter(e => !SEG || SEGOF[e.number] === SEG).map(e => dnLink(e.number)).join(' · ')}</div>` : ''}
    <p class="note">« Poste inactif » : aucun appel répondu ni passé par ce poste dans les 30 derniers jours de l'historique, mais ses renvois externes sont toujours en place (souvent un ancien employé). « Numéro non reconnu » : ne correspond au cellulaire d'aucun poste (domicile, ancien cellulaire, autre entreprise…). Les appels renvoyés sont ceux qui se terminent par un renvoi externe de ce poste.</p></div>`;
  const draw = () => table($('#rxt'), {rows: rows.filter(r => !S.fl || (S.fl === 'active' ? r.active : r.flags.includes(S.fl))), pageSize: 50, sort: [0, 1], state: S.t ||= {},
    search: r => [r.e.number, r.e.first, r.e.last, r.num, phone(r.num), ...r.st].join(' '),
    cols: [{h: 'Poste', v: r => r.e.number, f: r => dnLink(r.e.number)}, {h: 'Magasin', v: r => r.seg, f: r => esc(segShort(r.seg))},
      {h: 'Numéro externe', v: r => r.num, f: r => `<span class="mono">${esc(phone(r.raw) || r.raw)}</span>`},
      {h: 'Statuts', v: r => r.st.join(', '), f: r => r.st.map(s => `<span class="pill${s === r.cur ? ' acc' : ''}" title="${s === r.cur ? 'statut actuel du poste' : ''}">${esc(s)}</span>`).join(' ')},
      {h: 'Appels renvoyés', num: 1, v: r => r.f.ok + r.f.no, f: r => r.f.ok + r.f.no ? `${nf(r.f.ok + r.f.no)}${r.f.no ? ` <span class="muted">(${nf(r.f.no)} sans réponse)</span>` : ''}` : '0'},
      {h: 'Dernière activité du poste', v: r => r.lastAct, f: r => day(r.lastAct)},
      {h: 'Constat', v: r => r.flags.join(), f: r => r.flags.map(k => `<span class="pill ${RX_FLAG[k][1]}">${esc(RX_FLAG[k][0])}${k === 'other' ? ' : ' + esc(r.others.join(', ')) : ''}</span>`).join(' ')}],
    onRow: r => openDrawer(`Renvoi de <span class="mono">${esc(r.e.number)}</span> ${esc(dnName(r.e.number))}`, kv([['Numéro externe', `<span class="mono">${esc(phone(r.raw) || r.raw)}</span>`], ['Statuts concernés', esc(r.st.join(', '))], ['Situations', esc(r.conds.join(' ; ').replace(/NoAnswer/g, 'sans réponse').replace(/Busy/g, 'occupé').replace(/NotRegistered/g, 'non connecté').replace(/AllCalls/g, 'tous les appels').replace(/Internal/g, 'internes').replace(/External/g, 'externes').replace(/AllHours/g, "heures d'ouverture").replace(/OutOfOfficeHours/g, 'hors heures'))],
      ['Statut actuel du poste', esc(r.cur) + (r.active ? ' <span class="pill acc">renvoi actif</span>' : '')], ['Appels renvoyés', `${nf(r.f.ok)} répondus, ${nf(r.f.no)} sans réponse${r.f.last ? ' · dernier le ' + day(r.f.last) : ''}`],
      ['Dernière activité du poste', day(r.lastAct)], ['Constat', r.flags.map(k => RX_FLAG[k][0] + (k === 'other' ? ' (' + r.others.map(n => n + ' ' + dnName(n)).join(', ') + ')' : '')).join(' · ')]]) +
      `<p class="muted" style="font-size:12.5px">À corriger dans la console : Utilisateurs → poste ${esc(r.e.number)} → Renvois (Forwarding Rules), pour chaque statut listé.</p><p><a class="btn dn" data-dn="${esc(r.e.number)}">Ouvrir la fiche du poste</a></p>`)});
  draw();
  $('#rxfl').addEventListener('change', e => { S.fl = e.target.value; draw(); });
};

