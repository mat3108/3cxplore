// ---------- Chemins vers la boîte vocale (20.8.1) : pour chaque boîte, un diagramme de tout ce qui y mène ----------
// À droite la messagerie ; au milieu ce qui y envoie directement (le poste lui-même selon son statut, un menu, une file, un groupe,
// un département, un collègue qui renvoie) ; à gauche ce qui arrive sur ces éléments (SDA, menus…). Même source que l'onglet Messageries vocales (vmRefs).
const VP_NW = 230, VP_GX = 150, VP_GY = 18, VP_X0 = 16, VP_Y0 = 16;
const VP_COND = {NoAnswer: 'sans réponse', Busy: 'occupé', NotRegistered: 'téléphone non connecté', AllCalls: '', Internal: 'appels internes', External: 'appels externes', AllHours: 'heures d\'ouverture', OutOfOfficeHours: 'hors heures'};
// les renvois d'un poste vers une messagerie, par profil : [nom du profil, actif ?, libellés des conditions]
function vpOwnRoutes(e, box){
  const WHO = {Internal: 'appels internes', External: 'appels externes'}, HRS = {AllHours: 'heures d\'ouverture', OutOfOfficeHours: 'hors heures'};
  return e.profiles.map(p => { const conds = [], away = {};
    p.routes.forEach(([k, d]) => { if(!d || d.to !== 'VoiceMail' || (d.dn || e.number) !== box) return; const [a, b] = k.split(' › ').slice(1);
      if(a === 'NoAnswer' || a === 'Busy' || a === 'NotRegistered'){ const c = `${VP_COND[a]}${a === 'NoAnswer' && p.noAnswer ? ` (${p.noAnswer} s)` : ''}${b === 'Internal' ? ' (appels internes)' : ''}`; if(!conds.includes(c)) conds.push(c); }
      else (away[b || ''] ||= new Set()).add(a); });
    // statuts « absent » : par plage horaire, les deux sortes d'appels = « tous les appels » ; les deux plages = « à toute heure »
    // 19.0.3 : un profil sans renvoi « hors heures » (case décochée) applique son renvoi des heures d'ouverture à toute heure
    const hrs = Object.keys(away), all = h => away[h].has('Internal') && away[h].has('External') || away[h].has('AllCalls'), ooo = p.routes.some(([k]) => / › OutOfOfficeHours$/.test(k));
    if(hrs.length === 2 && hrs.every(all)) conds.push('tous les appels, à toute heure');
    else hrs.forEach(h => { const who = all(h) ? ['tous les appels'] : [...away[h]].map(w => WHO[w] || w); conds.push(`${who.join(' et ')}${!ooo ? ', à toute heure' : HRS[h] ? ', ' + HRS[h] : ''}`); });
    return conds.length ? [fwdName(p.name), p.name === e.profile, conds] : null; }).filter(Boolean);
}
function vpGraph(n, A){
  const e = EXT_BY[n], refs = A.R[n] || [], nodes = [], byId = {}, edges = [];
  const node = (id, kind, title, sub, lines, col, dn) => byId[id] || (nodes.push(byId[id] = {id, kind, title, sub, lines: lines || [], col, dn}), byId[id]);
  const edge = (from, to, label, dash) => { const x = edges.find(x => x.from === from && x.to === to); if(x){ if(label && !x.labels.includes(label)) x.labels.push(label); } else edges.push({from, to, labels: label ? [label] : [], dash}); };
  const kindOf = num => DN[num] ? DN[num].kind : 'other';
  // libellé court sur la flèche : la boîte de départ dit déjà ce qu'elle est (« Acheminement hors heures du département » → « hors heures »)
  const shortW = w => w.replace(/^Acheminement /, '').replace(/^Sans réponse du groupe de sonnerie$/, 'sans réponse').replace(/^Débordement de la file$/, 'débordement (attente maximale)').replace(/ (du menu|du département|de la file|du groupe de sonnerie)$/, '');
  const row = A.rows.find(r => r.n === n);
  node('vm', 'vm', 'Messagerie vocale', `${n} ${dnName(n)}`, row ? [row.on == null ? 'boîte de la file' : row.on ? 'activée' : 'DÉSACTIVÉE : aucun message possible', row.custom ? 'annonce personnalisée' : row.nameRec ? 'nom enregistré, annonce standard' : 'annonce standard', row.m.length ? `${nf(row.m.length)} message${row.m.length > 1 ? 's' : ''} conservé${row.m.length > 1 ? 's' : ''}` : ''].filter(Boolean) : [], 2, n);
  // ce qui arrive sur un élément du milieu (une colonne plus à gauche) : SDA et acheminements, au plus 8
  const MEMB = {'Agent de la file': 'file : fait sonner ce poste', 'Membre du groupe de sonnerie': 'groupe : fait sonner ce poste', 'Membre du département': 'département'};
  const feed = (num, id, memb) => { const rs = (dnRefs()[num] || []).filter(r => r.cat === 'sda' || r.cat === 'route' || (memb && r.cat === 'member' && MEMB[r.what])); let k = 0;
    rs.forEach(r => { if(r.cat !== 'sda' && r.from === num) return; /* pas de boucle sur soi-même (groupe dont le sans-réponse est sa propre boîte) */ if(k++ >= 10) return;
      if(r.cat === 'sda'){ const s = node('did:' + r.did, 'did', phone(r.did), `trunk ${r.from}`, [], 0); edge(s.id, id, r.how.replace(/ — règle par défaut du trunk$/, '')); }
      else if(r.cat === 'member'){ const s = node('dn:' + r.from, kindOf(r.from), `${r.from} ${dnName(r.from)}`, '', [], 0, r.from); edge(s.id, id, `${MEMB[r.what]}${r.how ? ' (' + r.how + ')' : ''}`); }
      else { const s = node('dn:' + r.from, kindOf(r.from), `${r.from} ${dnName(r.from)}`, '', [], 0, r.from); edge(s.id, id, shortW(r.what)); } });
    if(rs.length > 10) byId[id].lines.push(`+ ${rs.length - 10} autres entrées non dessinées`); };
  // le poste lui-même : ses renvois vers sa messagerie, et ce qui l'appelle
  if(e){ const own = vpOwnRoutes(e, n), act = own.filter(o => o[1]), oth = own.filter(o => !o[1]);
    if(own.length || (dnRefs()[n] || []).some(r => r.cat === 'sda' || r.cat === 'route' || (r.cat === 'member' && MEMB[r.what]))){
      const x = node('ext', 'Poste', `${n} ${dnName(n)}`, segShort(SEGOF[n]), [`statut actuel : ${fwdName(e.profile) || '—'}`, ...(oth.length ? [`aussi en ${oth.map(o => o[0]).join(', ')}`] : [])], 1, n);
      act.forEach(o => o[2].forEach(c => edge('ext', 'vm', c)));
      if(!act.length && oth.length) edge('ext', 'vm', `seulement en ${oth.map(o => o[0]).join(', ')}`, true);
      feed(n, 'ext', true); } }
  // ce qui envoie directement à la messagerie
  refs.forEach(r => {
    if(r.cat === 'own') return;
    if(r.cat === 'sda'){ const s = node('did:' + r.did, 'did', phone(r.did), `trunk ${r.from}`, [], 0); edge(s.id, 'vm', r.hrs); return; }
    if(r.cat === 'fwd'){ const c = EXT_BY[r.from]; const id = 'dn:' + r.from, s = node(id, 'Poste', `${r.from} ${dnName(r.from)}`, segShort(SEGOF[r.from]), [], 1, r.from);
      const own = c ? vpOwnRoutes(c, n) : []; own.forEach(o => edge(id, 'vm', `${o[0]} : ${o[2].join(', ')}`, !o[1])); if(!own.length) edge(id, 'vm', 'renvoi'); feed(r.from, id); return; }
    const id = 'dn:' + r.from, s = node(id, kindOf(r.from), `${r.from} ${dnName(r.from)}`, '', [], 1, r.from); edge(id, 'vm', shortW(r.what)); feed(r.from, id); });
  return {nodes, edges, byId};
}
function vpRender(g){
  const H = {}, pos = {}; g.nodes.forEach(n => H[n.id] = 46 + n.lines.length * 15 + (n.lines.length ? 6 : 0));
  // colonne 1 puis 0 (dans l'ordre de leur cible), la messagerie centrée sur la colonne 1
  const col = c => g.nodes.filter(n => n.col === c), place = (ns, c) => { let y = VP_Y0; ns.forEach(n => { pos[n.id] = {x: VP_X0 + c * (VP_NW + VP_GX), y}; y += H[n.id] + VP_GY; }); return y; };
  const used = [0, 1].filter(c => col(c).length), cx = {}; used.forEach((c, i) => cx[c] = i); cx[2] = used.length; // colonnes réellement occupées, serrées à gauche
  const c1 = col(1), y1 = place(c1, cx[1]);
  const tgt = n => { const e = g.edges.find(e => e.from === n.id); return e && pos[e.to] ? pos[e.to].y : 1e9; };
  const c0 = col(0).sort((a, b) => tgt(a) - tgt(b)), y0 = place(c0, cx[0] || 0);
  const Hh = Math.max(y1, y0, VP_Y0 + H.vm + VP_GY) + 10, W = VP_X0 * 2 + (cx[2] + 1) * VP_NW + cx[2] * VP_GX;
  pos.vm = {x: VP_X0 + cx[2] * (VP_NW + VP_GX), y: Math.max(VP_Y0, (Math.max(y1, y0) - VP_GY) / 2 - H.vm / 2)};
  let s = `<svg xmlns="http://www.w3.org/2000/svg" class="flowsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <defs><marker id="vparr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="f-arrow"/></marker></defs>`;
  const inIdx = {}; g.edges.forEach(e => { const a = pos[e.from], b = pos[e.to]; if(!a || !b) return;
    const k = (inIdx[e.to] = (inIdx[e.to] || 0) + 1), nIn = g.edges.filter(x => x.to === e.to).length;
    const x1 = a.x + VP_NW, y1 = a.y + H[e.from] / 2, x2 = b.x - 2, y2 = b.y + H[e.to] * (nIn > 1 ? (k / (nIn + 1)) : .5);
    const c1 = x1 + Math.min(110, (x2 - x1) * .5), c2 = x2 - Math.min(70, (x2 - x1) * .4);
    s += `<path d="M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}" class="f-edge${e.dash ? ' back' : ''}" marker-end="url(#vparr)"/><circle cx="${x1}" cy="${y1}" r="2.5" class="f-arrow"/>`;
    const ls = e.labels.slice(0, 4); if(e.labels.length > 4) ls.push(`+ ${e.labels.length - 4} autres`);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - (ls.length - 1) * 6.5;
    ls.forEach((l, j) => { s += `<text x="${mx}" y="${my + j * 13}" text-anchor="middle" class="f-elabel">${esc(trunc(l, 30))}</text>`; }); });
  g.nodes.forEach(n => { const p = pos[n.id], h = H[n.id], st = KIND_STYLE[n.kind] || KIND_STYLE.other;
    s += `<g class="f-node${n.dn ? ' click' : ''}" ${n.dn ? `data-dn="${esc(n.dn)}"` : ''} transform="translate(${p.x},${p.y})"><title>${esc(st.t + ' — ' + n.title + (n.sub ? ' (' + n.sub + ')' : ''))}</title>
      <rect width="${VP_NW}" height="${h}" rx="9" class="f-box" style="stroke:${st.c}"/><rect width="5" height="${h}" rx="2" style="fill:${st.c}"/>
      <text x="14" y="17" class="f-kind" style="fill:${st.c}">${esc(st.t.toUpperCase())}${n.sub ? ' · ' + esc(trunc(n.sub, 22)) : ''}</text><text x="14" y="36" class="f-title">${esc(trunc(n.title, 30))}</text>`;
    let y = 42; n.lines.forEach(l => { y += 15; s += `<text x="14" y="${y}" class="f-line${/DÉSACTIVÉE/.test(l) ? ' strong' : ''}">${esc(trunc(l, 38))}</text>`; }); s += '</g>'; });
  return s + '</svg>';
}
V.vmchemins = (el, arg) => {
  const A = vmAnalysis(), allRows = A.rows.filter(x => !SEG || x.seg === SEG).sort((a, b) => a.n.localeCompare(b.n, undefined, {numeric: true}));
  const S = window.__vp ||= {n: '', q: '', type: ''}; if(arg && allRows.some(r => r.n === arg)){ S.n = arg; S.q = ''; S.type = ''; }
  const kinds = [...new Set(allRows.map(r => r.kind))], q = gsNorm(S.q).trim();
  const rows = allRows.filter(r => (!S.type || r.kind === S.type) && (!q || gsNorm([r.n, dnName(r.n), r.kind, segShort(r.seg), segName(r.seg)].join(' ')).includes(q)));
  if(!rows.some(r => r.n === S.n)) S.n = (rows.find(r => r.refs.length) || rows[0] || {}).n || '';
  const cur = rows.find(r => r.n === S.n), i = rows.indexOf(cur);
  const ways = r => { const e = r.e, own = e ? vpOwnRoutes(e, r.n).filter(o => o[1]).length : 0; return r.others.length + own; };
  const none = rows.filter(r => !ways(r)).length;
  const CAT = {sda: 'Numéros entrants (SDA)', route: 'Acheminement (menus, départements, files, groupes)', fwd: 'Renvois de collègues'};
  el.innerHTML = `<div id="vpwrap"><h2>Chemins vers la boîte vocale</h2>
    <p class="lead">Pour chaque boîte vocale, le dessin de tout ce qui y mène : le poste lui-même selon son statut (sans réponse, occupé, hors heures), les menus, files, groupes et départements qui y envoient, les collègues qui y renvoient, et les SDA qui arrivent sur chacun d'eux${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Même lecture que l'onglet Messageries vocales.</p>
    <div class="grid kpis">${[['Boîtes', nf(rows.length) + (rows.length !== allRows.length ? ` <span class="muted" style="font-size:13px">/ ${nf(allRows.length)}</span>` : ''), ''], ['Avec au moins un chemin', nf(rows.length - none), ''], ['Sans aucun chemin', nf(none), none ? 'warn' : '']].map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="bar dgbar"><input type="search" id="vpq" value="${esc(S.q)}" placeholder="Chercher une boîte : numéro, nom, magasin" aria-label="Chercher une boîte vocale"><select id="vptype"><option value="">Tous les types</option>${kinds.map(k => `<option value="${esc(k)}"${k === S.type ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
    <div class="bar dgbar"><label class="count">Boîte vocale</label><select id="vpsel">${rows.map(r => `<option value="${esc(r.n)}"${r.n === S.n ? ' selected' : ''}>${esc(r.n + ' ' + dnName(r.n))}${r.kind !== 'Poste' ? ` · ${esc(r.kind)}` : ''} · ${ways(r)} chemin${ways(r) > 1 ? 's' : ''}</option>`).join('')}</select>
      <button class="btn" id="vpprev"${i <= 0 ? ' disabled' : ''}>‹ Précédente</button><button class="btn" id="vpnext"${i < 0 || i >= rows.length - 1 ? ' disabled' : ''}>Suivante ›</button></div>
    ${cur ? `<div class="vmdiag" id="vpdiag"></div>
    <div class="dglegend muted" style="font-size:12px;display:flex;gap:14px;margin-top:8px">${['did', 'Standard (IVR)', "File d'attente", 'Groupe de sonnerie', 'Département', 'Poste', 'vm'].map(k => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${KIND_STYLE[k].c};margin-right:5px;vertical-align:-1px"></i>${esc(KIND_STYLE[k].t)}</span>`).join('')}<span>— — en pointillé : seulement dans un autre statut que l'actuel</span></div>
    <div class="card" style="margin-top:14px"><b>Toutes les façons d'arriver à la messagerie de ${esc(cur.n)} ${esc(dnName(cur.n))}</b>
      ${cur.e ? (() => { const own = vpOwnRoutes(cur.e, cur.n); return `<h4>Le poste lui-même</h4>${own.length ? `<ul>${own.map(o => `<li>${o[1] ? '<b>' : ''}${esc(o[0])}${o[1] ? ' (statut actuel)</b>' : ''} : ${esc(o[2].join(', '))}</li>`).join('')}</ul>` : '<p class="muted">Aucun statut du poste ne renvoie vers sa messagerie : un appel sans réponse ne laisse pas de message.</p>'}`; })() : ''}
      ${Object.entries(CAT).map(([k, l]) => { const rs = cur.refs.filter(r => r.cat === k); return rs.length ? `<h4>${esc(l)}</h4><ul>${rs.map(r => `<li>${esc(r.what)} ${r.cat === 'sda' ? `<span class="muted">${esc(r.hrs)}</span> <span class="muted">(trunk ${esc(r.from)})</span>` : dnLink(r.from)}</li>`).join('')}</ul>` : ''; }).join('') || (cur.e ? '' : '<p class="muted">Rien dans la configuration ne mène à cette messagerie.</p>')}</div>` : `<p class="muted">${allRows.length ? 'Aucune boîte ne correspond à la recherche.' : 'Aucune boîte vocale.'}</p>`}
    <h3 style="margin-top:18px">Toutes les boîtes</h3><div id="vpt"></div>
    <p class="note">Le dessin se lit de gauche à droite : ce qui arrive (SDA, menus, files, groupes et départements dont le poste est membre) → ce qui envoie à la messagerie → la boîte. Cliquez un élément du dessin pour sa fiche, une ligne du tableau pour son dessin.</p></div>`;
  if(cur){ const g = vpGraph(cur.n, A); $('#vpdiag').innerHTML = vpRender(g);
    $('#vpdiag').addEventListener('click', ev => { const nd = ev.target.closest('.f-node.click'); if(nd) showDN(nd.dataset.dn); }); }
  const go = n => { S.n = n; V.vmchemins(el); window.scrollTo(0, 0); };
  $('#vpsel').addEventListener('change', ev => go(ev.target.value));
  $('#vpprev').addEventListener('click', () => go(rows[i - 1].n)); $('#vpnext').addEventListener('click', () => go(rows[i + 1].n));
  $('#vptype').addEventListener('change', ev => { S.type = ev.target.value; S.n = ''; V.vmchemins(el); });
  $('#vpq').addEventListener('input', ev => { S.q = ev.target.value; S.n = ''; clearTimeout(window.__vpT2); window.__vpT2 = setTimeout(() => { V.vmchemins(el); const x = $('#vpq'); if(x){ x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); });
  const cnt = (r, k) => r.refs.filter(x => x.cat === k).length;
  table($('#vpt'), {rows, pageSize: 50, sort: [0, 1], state: (window.__vpT ||= {}), search: r => [r.n, dnName(r.n), r.kind, segShort(r.seg)].join(' '),
    cols: [{h: 'Boîte', v: r => r.n, f: r => `<b>${esc(r.n)}</b> ${esc(dnName(r.n))} <span class="muted">${esc(r.kind)}</span>`}, {h: 'Magasin', v: r => segShort(r.seg)},
      {h: 'Messagerie', v: r => r.on == null ? 2 : r.on ? 1 : 0, f: r => r.on == null ? '<span class="muted">boîte de la file</span>' : r.on ? 'activée' : '<span class="pill bad">désactivée</span>'},
      {h: 'Le poste lui-même', v: r => r.e ? vpOwnRoutes(r.e, r.n).filter(o => o[1]).length : 0, f: r => { if(!r.e) return '<span class="muted">—</span>'; const o = vpOwnRoutes(r.e, r.n).filter(o => o[1]); return o.length ? esc(o.map(x => x[2].join(', ')).join(' ; ')) : '<span class="muted">aucun renvoi (statut actuel)</span>'; }},
      {h: 'SDA', num: 1, v: r => cnt(r, 'sda')}, {h: 'Acheminements', num: 1, v: r => cnt(r, 'route')}, {h: 'Renvois de collègues', num: 1, v: r => cnt(r, 'fwd')},
      {h: 'Chemins', num: 1, v: r => ways(r), f: r => ways(r) ? nf(ways(r)) : '<span class="pill warn">0</span>'}],
    onRow: r => go(r.n)});
};
