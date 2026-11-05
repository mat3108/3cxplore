// ---------- Avant / après : parcours des SDA dans le backup de référence et dans le backup actuel ----------
// contexte de simulation d'un autre backup (index des éléments, SDA, département par défaut)
function simCtx(X){
  const DNx = {}, add = (n, kind, name, obj) => { if(n) DNx[n] = {kind, name, obj}; };
  X.extensions.forEach(e => add(e.number, 'Poste', (e.first + ' ' + e.last).trim(), e)); X.queues.forEach(q => add(q.number, "File d'attente", q.name, q));
  X.ivrs.forEach(i => add(i.number, 'Standard (IVR)', i.name, i)); X.ringGroups.forEach(r => add(r.number, 'Groupe de sonnerie', r.name, r)); X.groups.forEach(g => add(g.number, 'Département', g.name, g));
  const dids = []; X.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(d => dids.push({did: d, line: l, rule: by[d] || def, isDefault: !by[d] && !!def})); });
  return {DN: DNx, dids, def: X.groups.find(g => g.name === '__DEFAULT__')};
}
const simSig = R => R.steps.map(s => [s.kind, s.dn || s.title, s.branch || '', s.cls || ''].join('·')).join(' > ') + ' => ' + R.end + '/' + (R.after || '');
const SIM_RANK = {human: 3, vm: 2, ext: 2, wait: 1, lost: 0};
// renvoi vers un autre système 3CX (bridge, ex. « 12GRP0000 ») : ce qui se passe ensuite n'est pas connu
const simBridge = R => R.steps.some(s => (s.kind === 'Numéro externe' && /[A-Za-z]/.test(s.title || '')) || (s.kind === 'Département' && /^Renvoi\b/i.test(s.title || '')) || (s.kind === 'Numéro externe' && (s.lines || []).some(l => /3CX|bridge/i.test(l))));
V.avantapres = el => {
  const REF = window.REF_D;
  if(!REF){ el.innerHTML = `<h2>Avant / après</h2><p class="lead">Compare le parcours de chaque SDA entre deux backups, pour vérifier qu'une correction faite dans la console a l'effet voulu (et rien d'autre).</p>
    <p>Aucun backup de référence : chargez l'ancien backup dans l'onglet <a class="dlink" href="#comparaison">Comparaison</a>, puis revenez ici.</p>`; return; }
  const refIso = backupDateISO(REF.info.date) || '', curIso = backupDateISO(FULL.info.date) || '';
  const curIsAfter = curIso >= refIso, ctxRef = simCtx(REF);
  const dk = X => { const i = backupDateISO(X.info.date); return i ? dayKey(i) : X.info.date; };
  const before = curIsAfter ? {ctx: ctxRef, date: dk(REF)} : {ctx: null, date: dk(FULL)}, after = curIsAfter ? {ctx: null, date: dk(FULL)} : {ctx: ctxRef, date: dk(REF)};
  // 18.1.41 : numéro retiré (absent du backup actuel) rattaché au magasin de la destination de sa règle dans le backup de référence
  const refSeg = d => { const r = ctxRef.dids.find(x => x.did === d), dn = r && r.rule && r.rule.office && r.rule.office.dn; return dn ? SEGOF[dn] : ''; };
  const CUR = simCtx(FULL); // 18.2.5 : backup actuel simulé comme le backup de référence (sans historique des pauses)
  const M = ctlMoments(), ids = new Set([...allDIDs.map(r => r.did), ...ctxRef.dids.map(r => r.did)].filter(d => !SEG || DIDSEG[d] === SEG || (!DIDSEG[d] && refSeg(d) === SEG)));
  const inB = new Set((before.ctx ? before.ctx.dids : allDIDs).map(r => r.did)), inA = new Set((after.ctx ? after.ctx.dids : allDIDs).map(r => r.did));
  const rows = [...ids].map(did => {
    if(!inB.has(did)) return {did, kind: 'new', calls: lineCalls[did] || 0, moments: []};
    if(!inA.has(did)) return {did, kind: 'gone', calls: lineCalls[did] || 0, moments: []};
    const moments = M.map(([k, l, day, t]) => { const [h, m] = t.split(':').map(Number), min = h * 60 + m;
      const b = simulate(did, day, min, {}, before.ctx || CUR), a = simulate(did, day, min, {}, after.ctx || CUR), sb = simSig(b), sa = simSig(a);
      if(sb === sa) return null;
      const rb = SIM_RANK[b.end] * 10 + (b.after ? SIM_RANK[b.after] : 5), ra = SIM_RANK[a.end] * 10 + (a.after ? SIM_RANK[a.after] : 5);
      let i = 0; while(i < Math.min(b.steps.length, a.steps.length) && simSig({steps: [b.steps[i]], end: ''}) === simSig({steps: [a.steps[i]], end: ''})) i++;
      const br = simBridge(b) || simBridge(a);
      return {k, l, day, t, b, a, br, trend: br ? 'same' : ra > rb ? 'up' : ra < rb ? 'down' : 'same', div: i}; }).filter(Boolean);
    return {did, kind: moments.length ? 'changed' : 'same', calls: lineCalls[did] || 0, moments, trend: moments.some(m => m.trend === 'down') ? 'down' : moments.some(m => m.trend === 'up') ? 'up' : 'same'};
  });
  const ch = rows.filter(r => r.kind !== 'same').sort((a, b) => ({down: 0, up: 1, same: 2})[a.trend || 'same'] - ({down: 0, up: 1, same: 2})[b.trend || 'same'] || b.calls - a.calls);
  const cnt = f => rows.filter(f).length, TR = {up: ['Amélioré', 'ok'], down: ['Dégradé', 'bad'], same: ['Modifié', 'acc']};
  const endTxt = R => SIM_END[R.end][0] + (R.after ? ' → si personne ne répond : ' + SIM_END[R.after][0] : '');
  el.innerHTML = `<div id="apwrap"><h2>Avant / après</h2>
    <p class="lead">Parcours de chaque SDA${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''} simulé avec la configuration du backup <b>avant</b> (${esc(before.date)}) et du backup <b>après</b> (${esc(after.date)}), aux mêmes moments que le Contrôle des SDA : ${M.map(m => esc(m[1])).join(', ')}. Pour vérifier qu'une correction faite dans la console a eu l'effet voulu, et rien d'autre.</p>
    <div class="grid kpis">${[['SDA comparés', nf(rows.length), ''], ['Parcours changés', nf(cnt(r => r.kind === 'changed')), ''], ['Améliorés', nf(cnt(r => r.trend === 'up')), 'ok'], ['Dégradés', nf(cnt(r => r.trend === 'down')), cnt(r => r.trend === 'down') ? 'bad' : 'ok'], ['Nouveaux SDA', nf(cnt(r => r.kind === 'new')), ''], ['SDA retirés', nf(cnt(r => r.kind === 'gone')), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="card rpctl noprint" id="apflowcard"><div style="flex:1;min-width:260px"><b>Rapport des parcours avant / après</b><div class="muted" style="font-size:12.5px">Le diagramme du parcours des appels de chaque SDA dont la configuration a changé : d'abord avant (${esc(before.date)}), puis après (${esc(after.date)}), les éléments modifiés surlignés. SDA nouveaux et retirés inclus ; les SDA au parcours identique sont seulement listés. À imprimer ou enregistrer en PDF.</div></div>
      <div><button class="btn" id="apflowgo">Préparer le rapport</button> <button class="btn primary" id="apflowpr" hidden>Imprimer / PDF</button></div></div>
    <div id="apflowbox" hidden></div>
    <h3>SDA dont le parcours a changé (${ch.length})</h3>
    ${ch.length ? ch.slice(0, 150).map(r => r.kind === 'new' ? `<div class="card apr"><span class="pill acc">Nouveau</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">${esc(segShort(DIDSEG[r.did] || SEG_COMMON))} · n'existait pas dans le backup avant</span></div>`
      : r.kind === 'gone' ? `<div class="card apr"><span class="pill">Retiré</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">n'existe plus dans le backup après</span></div>`
      : `<details class="card ccat apr"${r.trend === 'down' ? ' open' : ''}><summary><span class="pill ${TR[r.trend][1]}">${TR[r.trend][0]}</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">${esc(segShort(DIDSEG[r.did] || SEG_COMMON))} · ${nf(r.calls)} appels${r.moments.some(m => m.br) ? ' · vers un autre 3CX : issue non comparable' : ''}</span>
          <span style="margin-left:auto;font-size:12.5px">${r.moments.map(m => `<span class="pill ${TR[m.trend][1]}" title="${esc(endTxt(m.b) + ' ⟶ ' + endTxt(m.a))}">${esc(m.l)}</span>`).join(' ')}</span></summary>
        <div style="padding:0 12px 12px">${r.moments.slice(0, 3).map(m => `<div class="apm"><div class="muted" style="font-size:12.5px;margin:6px 0"><b>${esc(m.l)}</b> (${esc(m.day)} ${esc(m.t)}) : ${esc(endTxt(m.b))} <b>⟶</b> ${esc(endTxt(m.a))}</div>
          <div class="apcols">${[['Avant', m.b], ['Après', m.a]].map(([lbl, R]) => `<div><div class="bkt">${lbl}</div><ol class="apsteps">${R.steps.map((s, i) => `<li class="${i >= m.div ? 'diff' : ''}${s.soft ? ' soft' : ''}"><span class="muted">${esc(s.kind)}</span> ${esc(s.dn ? s.dn + ' ' + s.title.replace(new RegExp('^' + s.dn + ' '), '') : s.title)}${s.branch ? ` <span class="pill">${esc(s.branch)}</span>` : ''}</li>`).join('')}</ol></div>`).join('')}</div></div>`).join('')}
          ${r.moments.length > 3 ? `<div class="muted" style="font-size:12.5px">+${r.moments.length - 3} autre(s) moment(s) modifié(s)</div>` : ''}
          <a class="dlink" href="#simulateur/${esc(r.did)}" style="font-size:12.5px">Ouvrir dans le simulateur (backup actuel) ▸</a></div></details>`).join('') + (ch.length > 150 ? `<p class="muted">+${ch.length - 150} autres SDA.</p>` : '')
      : '<p><span class="pill ok">Aucun changement</span> Tous les SDA suivent le même parcours dans les deux backups aux moments contrôlés.</p>'}
    <p class="note">« Amélioré » : l'issue est meilleure après (par exemple un appel perdu qui arrive maintenant à une personne ou à une messagerie). « Dégradé » : l'issue est moins bonne. « Modifié » : le parcours a changé mais l'issue est équivalente, ou l'un des deux parcours part vers un autre système 3CX (bridge), dont la suite n'est pas connue. Les étapes en couleur sont celles qui diffèrent. Les jours et heures simulés sont les mêmes pour les deux backups (horaires et jours fériés de chacun).</p></div>`;
  // 20.10.4 : rapport des parcours (diagrammes) avant / après
  $('#apflowgo').addEventListener('click', () => { const box = $('#apflowbox'), on = box.hidden; box.hidden = !on; $('#apflowpr').hidden = !on; $('#apflowgo').textContent = on ? 'Masquer le rapport' : 'Préparer le rapport';
    if(on){ box.innerHTML = '<p class="muted">Préparation…</p>'; setTimeout(() => { try{ box.innerHTML = apFlowReport(ids, before, after); }catch(er){ console.error(er); box.innerHTML = '<p class="muted">Erreur : ' + esc(er.message) + '</p>'; } box.scrollIntoView({behavior: 'smooth'}); }, 30); } });
  $('#apflowpr').addEventListener('click', () => { const a = $('#apflowsheet'); if(a) printHTML('<style>@page{size:letter portrait;margin:12mm}</style>' + a.innerHTML); });
};

// ---------- Rapport des parcours avant / après (20.10.4) ----------
// diagramme d'un SDA tel que configuré dans un autre backup : l'index des numéros (DN) est remplacé le temps de le construire
function apFlow(ctx, did){
  if(!ctx){ const e = allDIDs.find(x => x.did === did); return e ? apExt(apClean(buildFlow(e))) : null; }
  const e = ctx.dids.find(x => x.did === did); if(!e) return null;
  const save = {...DN}; Object.keys(DN).forEach(k => delete DN[k]); Object.assign(DN, ctx.DN); OWNER_CACHE.delete(DN);
  try{ return apExt(apClean(buildFlow(e))); }
  finally{ Object.keys(DN).forEach(k => delete DN[k]); Object.assign(DN, save); OWNER_CACHE.delete(DN); }
}
// renvoi personnel des postes (statut actuel), comme le simulateur : un changement de statut ou de renvoi change le parcours (à appeler pendant que DN est celui du backup dessiné)
function apExt(g){
  g.nodes.forEach(n => { if(n.kind !== 'Poste' || !DN[n.dn]) return; const o = DN[n.dn].obj; if(!o || !o.profiles) return;
    const p = o.profiles.find(x => x.name === o.profile) || o.profiles[0], avail = p ? p.routes.some(r => /^AvailableRoute/.test(r[0])) : true;
    const rt = p ? p.routes.find(r => avail ? /^AvailableRoute › NoAnswer › AllCalls/.test(r[0]) : /^AwayRoute › External/.test(r[0])) : null, go = rt && rt[1].to && rt[1].to !== 'None' ? rt[1] : null;
    n.lines = n.lines.concat([o.enabled === false ? '⚠ Poste désactivé' : '', `Statut actuel : ${fwdName(o.profile) || '—'}`,
      go ? (avail ? `Sans réponse (${p.noAnswer || o.noAnswer || '?'} s) → ${cmpDest(go)}` : `Absent : renvoi immédiat → ${cmpDest(go)}`) : !avail && rt && fwdBusy(rt[0], rt[1]) ? 'Absent : appel refusé (occupé)' : ''].filter(Boolean)); });
  return g;
}
// le nombre d'appels du backup actuel n'a pas de sens pour l'autre backup : retiré des deux côtés
const apClean = g => { const d = g.nodes.get('did'); if(d) d.lines = []; return g; };
// signature d'un élément (avec ses sorties) et du parcours entier ; le SDA et le nom de la règle propre à chaque SDA n'entrent pas en compte
function apSigs(g){
  const key = id => { const n = g.nodes.get(id); if(!n) return id; if(id === 'did') return 'did|' + n.sub; if(n.kind === 'rule') return 'rule|' + n.sub + '|' + n.lines.join('/'); return [n.kind, n.title, n.sub, n.lines.join('/'), (n.agents || []).join(',')].join('|'); };
  // une sortie se compare par sa destination (numéro), pas par le contenu de celle-ci : un élément n'est pas surligné parce qu'un élément suivant a changé
  const ref = id => /^(dn|ext|vm):/.test(id) ? id : (() => { const n = g.nodes.get(id); return n ? n.kind + '|' + n.title : id; })();
  const out = {}, deep = {}; g.edges.forEach(e => { (out[e.from] ||= []).push(e.labels.join('/') + '>' + ref(e.to)); (deep[e.from] ||= []).push(e.labels.join('/') + '>' + key(e.to)); });
  const node = {}, full = []; g.nodes.forEach((n, id) => { node[id] = key(id) + '{' + (out[id] || []).sort().join(';') + '}'; full.push(key(id) + '{' + (deep[id] || []).sort().join(';') + '}'); });
  return {node, all: full.sort().join('\n')};
}
function apFlowReport(ids, before, after){
  const dk = d => d || '—', groups = new Map(), same = [], added = [], gone = [];
  [...ids].forEach(did => {
    const gb = apFlow(before.ctx, did), ga = apFlow(after.ctx, did);
    if(!gb && !ga) return;
    const sb = gb ? apSigs(gb) : null, sa = ga ? apSigs(ga) : null;
    // nom de la règle entrante (propre à chaque SDA) : hors signature pour regrouper, mais un changement de nom compte
    const rn = g => g && g.nodes.get('rule') ? g.nodes.get('rule').title : '', ruleCh = gb && ga && rn(gb) !== rn(ga);
    if(sb && sa && sb.all === sa.all && !ruleCh){ same.push(did); return; }
    const kind = !gb ? 'new' : !ga ? 'gone' : 'changed', k = kind + '\u0001' + (sb ? sb.all : '') + '\u0001' + (sa ? sa.all : '') + (ruleCh ? '\u0001' + rn(gb) + '\u0001' + rn(ga) : '');
    if(!groups.has(k)) groups.set(k, {kind, gb, ga, sb, sa, ruleCh, dids: []});
    groups.get(k).dids.push(did);
  });
  const calls = gr => gr.dids.reduce((t, d) => t + (lineCalls[d] || 0), 0);
  const list = [...groups.values()].sort((a, b) => ({changed: 0, new: 1, gone: 2})[a.kind] - ({changed: 0, new: 1, gone: 2})[b.kind] || calls(b) - calls(a));
  const nDid = k => list.filter(g => g.kind === k).reduce((t, g) => t + g.dids.length, 0);
  const KL = {changed: ['Parcours modifié', 'acc'], new: ['Nouveau SDA', 'ok'], gone: ['SDA retiré', 'bad']};
  const one = (g, sig, other, side, date, gr) => {
    const mark = new Set(); if(other) Object.entries(sig.node).forEach(([id, s]) => { if(id !== 'did' && !Object.values(other.node).includes(s)) mark.add(id); });
    if(gr.ruleCh && g.nodes.get('rule')) mark.add('rule');
    const d = g.nodes.get('did'); if(d) d.title = gr.dids.length > 1 ? gr.dids.length + ' SDA' : phone(gr.dids[0]);
    const html = renderFlowPortrait(g, {did: gr.dids[0]}, {title: side + ' — ' + date, meta: (mark.size ? mark.size + ' élément' + (mark.size > 1 ? 's' : '') + (side === 'Avant' ? ' modifié' + (mark.size > 1 ? 's' : '') + ' ou retiré' + (mark.size > 1 ? 's' : '') + ' ensuite' : ' nouveau' + (mark.size > 1 ? 'x' : '') + ' ou modifié' + (mark.size > 1 ? 's' : '')) + ', surligné' + (mark.size > 1 ? 's' : '') : (other ? 'Aucun élément propre à ce côté' : 'Parcours complet')), mark});
    return html.replace(' id="dgpsheet"', '').replace('class="report dgp"', 'class="dgp rpflow apside apside-' + (side === 'Avant' ? 'b' : 'a') + '"')
      .replace(/<header class="rpcover"><div class="rpk">[^<]*<\/div><h1>([\s\S]*?)<\/h1>/, '<header class="rpflowh"><h3>$1</h3>').replace(/<div class="rpfoot">[\s\S]*?<\/div><\/div>$/, '</div>');
  };
  const segs = gr => [...new Set(gr.dids.map(d => segShort(DIDSEG[d] || SEG_COMMON)))].join(', ');
  const blocks = list.map(gr => `<section class="rps apgrp"><h2><span class="pill ${KL[gr.kind][1]}">${KL[gr.kind][0]}</span> ${gr.dids.length > 1 ? gr.dids.length + ' SDA avec le même changement' : esc(phone(gr.dids[0]))}</h2>
    <p class="rpnote">${gr.dids.length > 1 ? `<b>SDA :</b> ${gr.dids.map(d => esc(phone(d))).join(', ')} · ` : ''}Magasin : ${esc(segs(gr))} · ${nf(calls(gr))} appels reçus dans le backup actuel</p>
    ${gr.gb ? one(gr.gb, gr.sb, gr.sa, 'Avant', dk(before.date), gr) : `<p class="rpnote"><b>Avant (${esc(dk(before.date))}) :</b> ce SDA n'existait pas.</p>`}
    ${gr.ga ? one(gr.ga, gr.sa, gr.sb, 'Après', dk(after.date), gr) : `<p class="rpnote"><b>Après (${esc(dk(after.date))}) :</b> ce SDA n'existe plus.</p>`}</section>`).join('');
  const now = new Date().toLocaleString('fr-CA', {timeZone: TZ, dateStyle: 'long', timeStyle: 'short'});
  return `<div id="apflowsheet"><article class="report apflowrep"><header class="rpcover"><div class="rpk">Parcours des appels avant / après · 3CXplore</div><h1>${esc(SEG ? segName(SEG) : 'Tous les magasins')}</h1>
    <div class="rpmeta">${esc(FULL.info.company)} · ${esc(FULL.info.fqdn)}<br>Avant : backup du ${esc(dk(before.date))} · après : backup du ${esc(dk(after.date))} · rapport généré le ${esc(now)}</div></header>
    <div class="rpkpis">${[['SDA comparés', nf(ids.size)], ['Parcours modifiés', nf(nDid('changed'))], ['Nouveaux SDA', nf(nDid('new'))], ['SDA retirés', nf(nDid('gone'))], ['Parcours identiques', nf(same.length)]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <p class="rpnote">Pour chaque SDA dont la configuration du parcours a changé, le diagramme d'avant puis celui d'après. Surligné : dans « Avant », ce qui a été modifié ou retiré ensuite ; dans « Après », ce qui est nouveau ou modifié (horaires, destinations, touches de menu, délais, agents, messages, statut et renvoi des postes…). Le statut d'un poste est celui du moment du backup : un employé passé « Absent » ce jour-là compte comme un changement. Les SDA qui ont exactement le même changement partagent un seul couple de diagrammes. Lecture : de haut en bas, l'appel passe d'un élément au suivant ; le texte sur la flèche indique le choix ou le moment. Un élément déjà affiché est rappelé par son numéro.</p>
    ${blocks || '<p><b>Aucun parcours modifié.</b> Tous les SDA ont exactement le même parcours dans les deux backups.</p>'}
    ${same.length ? `<section class="rps"><h2>Parcours identiques (${nf(same.length)} SDA)</h2><p class="rpnote">${same.sort((a, b) => (lineCalls[b] || 0) - (lineCalls[a] || 0)).map(d => esc(phone(d))).join(', ')}</p></section>` : ''}
    <footer class="rpfoot">Généré par 3CXplore — configuration des backups du ${esc(dk(before.date))} et du ${esc(dk(after.date))}. Un changement de configuration n'a pas toujours d'effet sur l'issue de l'appel : la liste « SDA dont le parcours a changé » de l'onglet simule l'issue à des moments clés.</footer></article></div>`;
}
