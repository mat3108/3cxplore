// ---------- Personnes indispensables : files, groupes et numéros qui reposent sur une seule personne ----------
const hasDest = d => d && d.to && d.to !== 'None';
const destTxt1 = d => !d || !d.to || d.to === 'None' ? 'aucune destination' : d.to === 'External' ? 'renvoi vers ' + phone(d.ext) : d.to === 'VoiceMail' ? 'messagerie' + (d.dn ? ' de ' + d.dn + ' ' + dnName(d.dn) : '') : d.to === 'EndCall' ? 'raccroche' : (d.dn ? d.dn + ' ' + dnName(d.dn) : TO_FR[d.to] || d.to);
function indispAnalysis(){
  const end = FULL.queueCalls.length ? FULL.queueCalls[0][0] : (FULL.calls[0] || [])[0] || new Date().toISOString();
  const from = new Date(Date.parse(end) - 30 * 864e5).toISOString(), inSeg = n => !SEG || SEGOF[n] === SEG;
  const qc = {}; FULL.queueCalls.forEach(r => { if(r[0] < from) return; const q = qc[r[1]] ||= {n: 0, served: 0, by: {}}; q.n++; if(r[6]){ q.served++; if(r[7]) q.by[r[7]] = (q.by[r[7]] || 0) + 1; } });
  const rgCalls = {}; FULL.calls.forEach(c => { if(c[0] < from || c[1] !== 'in') return; new Set(c[9].map(p => p[0])).forEach(dn => { rgCalls[dn] = (rgCalls[dn] || 0) + 1; }); });
  const items = [];
  FULL.queues.filter(q => inSeg(q.number)).forEach(q => {
    const on = q.members.filter(m => !m.status || m.status === 'LoggedIn'), s = qc[q.number] || {n: 0, served: 0, by: {}};
    const top = Object.entries(s.by).sort((a, b) => b[1] - a[1])[0], share = top && s.served ? top[1] / s.served : 0;
    const why = [];
    if(!q.members.length) why.push(hasDest(q.dest) ? ['warn', 'Aucun membre : renvoi direct'] : ['bad', 'Aucun membre']);
    else if(!on.length) why.push(['bad', 'Aucun agent connecté']);
    else if(on.length === 1) why.push(['warn', q.members.length === 1 ? 'Un seul membre' : `Un seul agent connecté sur ${q.members.length}`]);
    if(top && s.served >= 20 && share >= 0.6) why.push(['warn', `${top[0]} ${dnName(top[0])} répond à ${Math.round(100 * share)} % des appels`]);
    items.push({kind: "File d'attente", dn: q.number, name: q.name, seg: SEGOF[q.number] || SEG_COMMON, members: q.members.length, on: on.length, onList: on.map(m => m.dn), calls: s.n, served: s.served, top: top ? top[0] : null, share, why, after: q.dest});
  });
  FULL.ringGroups.filter(r => inSeg(r.number)).forEach(r => {
    const why = []; if(!r.members.length) why.push(hasDest(r.dest) ? ['warn', 'Aucun membre : renvoi direct'] : ['bad', 'Aucun membre']); else if(r.members.length === 1) why.push(['warn', 'Un seul membre']);
    items.push({kind: 'Groupe de sonnerie', dn: r.number, name: r.name, seg: SEGOF[r.number] || SEG_COMMON, members: r.members.length, on: r.members.length, onList: r.members, calls: rgCalls[r.number] || 0, served: null, top: null, share: 0, why, after: r.dest});
  });
  const risky = items.filter(x => x.why.length).sort((a, b) => (b.why.some(w => w[0] === 'bad') - a.why.some(w => w[0] === 'bad')) || b.calls - a.calls);
  // personnes : files où elles sont seules connectées ou répondent à la majorité des appels
  const P = {};
  items.forEach(x => {
    const solo = x.on === 1 ? x.onList[0] : null, main = x.top && x.served >= 20 && x.share >= 0.5 ? x.top : null;
    [...new Set([solo, main].filter(Boolean))].forEach(a => { const p = P[a] ||= {a, items: [], calls: 0};
      p.items.push({x, solo: a === solo, share: a === x.top ? x.share : null}); p.calls += x.calls; });
  });
  const people = Object.values(P).sort((a, b) => b.calls - a.calls || b.items.length - a.items.length);
  // numéros et touches qui mènent directement à un poste (une seule personne)
  const direct = [];
  allDIDs.forEach(r => { const o = r.rule?.office; if(o && o.to === 'Extension' && o.dn && inSeg(o.dn)) direct.push({src: 'SDA ' + phone(r.did), dn: o.dn, calls: lineCalls[r.did] || 0, link: '#simulateur/' + r.did}); });
  FULL.ivrs.filter(i => inSeg(i.number)).forEach(i => i.options.forEach(op => { if(op.type === 'Extension' && op.dn) direct.push({src: `${i.name} · touche ${op.key}`, dn: op.dn, calls: null, ivr: i.number}); }));
  FULL.groups.filter(g => !isSysGroup(g) && inSeg(g.number) && g.routes).forEach(g => [['office', 'ouvert'], ['outOfOffice', 'fermé']].forEach(([k, l]) => { const d = g.routes[k]; if(d && d.to === 'Extension' && d.dn) direct.push({src: `Département ${g.name} (${l})`, dn: d.dn, calls: null}); }));
  direct.forEach(x => { const e = EXT_BY[x.dn], p = e && (e.profiles.find(p => p.name === e.profile) || e.profiles[0]);
    const rt = p && p.routes.find(r => /^AvailableRoute › NoAnswer › AllCalls/.test(r[0])); x.ifNo = rt ? rt[1] : null; x.profile = e ? e.profile : ''; });
  return {from, end, items, risky, people, direct};
}
V.indisp = el => {
  const A = indispAnalysis(), nBad = A.risky.filter(x => x.why.some(w => w[0] === 'bad')).length;
  el.innerHTML = `<div id="idwrap"><h2>Personnes indispensables</h2>
    <p class="lead">Files d'attente et groupes de sonnerie qui reposent sur une seule personne, agents dont l'absence ferait perdre des appels, et numéros qui sonnent directement chez une personne${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Volumes et parts des 30 derniers jours de l'historique (du ${dayKey(A.from)} au ${dayKey(A.end)}) ; agents connectés selon le backup.</p>
    <div class="grid kpis">${[['Files et groupes à risque', nf(A.risky.length), A.risky.length ? 'warn' : 'ok'], ['… sans personne pour répondre', nf(nBad), nBad ? 'bad' : 'ok'], ['Personnes indispensables', nf(A.people.length), A.people.length ? 'warn' : ''], ['Numéros ou touches vers une seule personne', nf(A.direct.length), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Files et groupes à risque (${A.risky.length})</h3><div id="idt1"></div>
    <h3>Personnes indispensables (${A.people.length})</h3>
    ${A.people.length ? `<div class="tw"><table><thead><tr><th>Agent</th><th>Magasin</th><th>Pourquoi</th><th class="num">Appels concernés (30 j)</th><th>Si cette personne est absente</th></tr></thead><tbody>
      ${A.people.map(p => `<tr><td>${dnLink(p.a)}</td><td class="muted">${esc(segShort(SEGOF[p.a] || SEG_COMMON))}</td>
        <td style="font-size:12.5px">${p.items.map(i => `<div>${dnLink(i.x.dn)} : ${i.solo ? '<span class="pill warn">seule personne connectée</span>' : ''}${i.share ? ` <span class="pill">${Math.round(100 * i.share)} % des réponses</span>` : ''}</div>`).join('')}</td>
        <td class="num">${nf(p.calls)}</td><td style="font-size:12.5px">${p.items.map(i => `<div>${esc(i.x.name)} → ${i.solo ? esc(destTxt1(i.x.after)) : 'les collègues répondent, mais avec moins de monde'}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>` : '<p><span class="pill ok">Aucune</span> Aucune file ne repose sur une seule personne.</p>'}
    <h3>Numéros et touches qui sonnent chez une seule personne (${A.direct.length})</h3>
    ${A.direct.length ? `<div class="tw"><table><thead><tr><th>Source</th><th>Poste</th><th class="num">Appels</th><th>Profil actuel</th><th>Si pas de réponse</th></tr></thead><tbody>
      ${A.direct.sort((a, b) => (b.calls || 0) - (a.calls || 0)).map(x => `<tr><td>${x.link ? `<a class="dlink" href="${esc(x.link)}">${esc(x.src)}</a>` : x.ivr ? `${dnLink(x.ivr, false)} <span class="muted">${esc(x.src.split(' · ')[1])}</span>` : esc(x.src)}</td><td>${dnLink(x.dn)}</td><td class="num">${x.calls == null ? '<span class="muted">–</span>' : nf(x.calls)}</td>
        <td class="muted">${esc(x.profile || '—')}</td><td>${x.ifNo ? `<span class="pill ${x.ifNo.to === 'VoiceMail' ? 'warn' : x.ifNo.to === 'None' || x.ifNo.to === 'EndCall' ? 'bad' : ''}">${esc(destTxt1(x.ifNo))}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Quand cette personne est absente ou en ligne, ces appels vont à sa messagerie ou à son renvoi. Une file ou un groupe avec un remplaçant évite de dépendre d'une seule personne.</p>` : '<p class="muted">Aucun numéro ni touche ne mène directement à un poste.</p>'}
    <p class="note">« Connecté » : état de l'agent dans la file au moment du backup. « Répond à X % » : part des appels servis de la file sur 30 jours (files ayant au moins 20 appels servis).</p></div>`;
  table($('#idt1'), {rows: A.risky, pageSize: 50, state: (window.__idTable ||= {}),
    search: x => [x.dn, x.name, segShort(x.seg), ...x.why.map(w => w[1])].join(' '),
    filters: [{label: 'Tous les types', options: [["File d'attente", "Files d'attente"], ['Groupe de sonnerie', 'Groupes de sonnerie']], test: (x, v) => x.kind === v},
              {label: 'Toutes les gravités', options: [['bad', 'Personne pour répondre'], ['warn', 'Une seule personne']], test: (x, v) => x.why.some(w => w[0] === v)}],
    cols: [{h: 'Élément', v: x => x.name, f: x => dnLink(x.dn) + `<div class="muted" style="font-size:11.5px">${esc(x.kind)}</div>`}, {h: 'Magasin', v: x => segShort(x.seg), cls: 'muted'},
      {h: 'Agents connectés', num: 1, v: x => x.on, f: x => `${x.on} / ${x.members}`}, {h: 'Appels (30 j)', num: 1, v: x => x.calls, f: x => nf(x.calls)},
      {h: 'Risque', v: x => x.why.length, f: x => x.why.map(([c, t]) => `<span class="pill ${c}">${esc(t)}</span>`).join(' ')},
      {h: 'Si personne ne répond', v: x => destTxt1(x.after), f: x => `<span style="font-size:12.5px">${esc(destTxt1(x.after))}</span>`}]});
};

