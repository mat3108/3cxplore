// ---------- Comparaison entre deux backups ----------
// Date du backup (« 10/11/2026 2:36:00 a.m. ») -> ISO UTC approximatif (heure locale du serveur traitée comme heure de l'Est)
// 18.1.33 : date du backup lisible (3CX l'écrit mois/jour/année)
const bkDate = s => { const i = backupDateISO(s); return i ? fmtD(i) : (s || ''); };
function backupDateISO(s){
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?/i);
  if(!m) return '';
  let h = +m[4]; if(m[7]){ const pm = /p/i.test(m[7]); if(pm && h < 12) h += 12; if(!pm && h === 12) h = 0; }
  const local = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T${String(h).padStart(2, '0')}:${m[5]}:${m[6] || '00'}`;
  const guess = new Date(local + 'Z'), off = Date.parse(guess.toLocaleString('sv-SE', {timeZone: TZ}).replace(' ', 'T') + 'Z') - guess.getTime();
  return new Date(guess.getTime() - off).toISOString();
}
const cmpDest = d => !d || !d.to || d.to === 'None' ? '—' : d.to === 'External' ? 'Externe ' + phone(d.ext) : `${TO_FR[d.to] || d.to}${d.dn ? ' ' + d.dn + (dnName(d.dn) ? ' ' + dnName(d.dn) : '') : ''}`;
const cmpHours = h => hoursSummary(h).join(' ; ') || '—';
const yn = b => b ? 'oui' : 'non';
// définition des catégories comparées : clé unique + champs (texte ou liste)
function cmpCategories(X){
  const lines = X.lines || [], ruleOf = {};
  lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll'); l.dids.forEach(d => ruleOf[d] = {l, r: by[d] || def, def: !by[d]}); });
  const phones = []; X.extensions.forEach(e => e.devices.forEach(d => d.mac && phones.push({...d, ext: e.number, user: (e.first + ' ' + e.last).trim()})));
  return [
    {key: 'postes', label: 'Postes', items: X.extensions, id: e => e.number, name: e => `${e.number} ${(e.first + ' ' + e.last).trim()}`, link: e => e.number,
      fields: e => ({'Nom': (e.first + ' ' + e.last).trim(), 'Courriel': e.email, 'Caller ID': phone(e.callerId), 'Mobile': phone(e.mobile), 'Actif': yn(e.enabled), 'Enregistrement': yn(e.record), 'Messagerie': yn(e.vm), 'Réseau local seulement': yn(e.lanOnly),
        'Départements': e.groups.filter(g => !/^(__|SYSTEM$)/.test(g.g)).map(g => g.g + (g.role ? ' (' + g.role + ')' : '')), 'Files': e.queues, 'Groupes de sonnerie': e.ringGroups, 'Téléphones (MAC)': e.devices.map(d => macFmt(d.mac) + ' ' + (d.model || ''))})},
    {key: 'phones', label: 'Téléphones', items: phones, id: d => (d.mac || '').toUpperCase(), name: d => `${macFmt(d.mac)} — ${d.model || d.template}`, link: d => d.ext,
      fields: d => ({'Poste': d.ext + ' ' + d.user, 'Modèle': d.model, 'Gabarit': d.template, 'Firmware assigné': d.firmware ? fwVersion(d.firmware) : '— (aucun)', 'Langue': d.lang})},
    {key: 'files', label: "Files d'attente", items: X.queues, id: q => q.number, name: q => `${q.number} ${q.name}`, link: q => q.number,
      fields: q => ({'Nom': q.name, 'Stratégie': q.strategy, 'Sonnerie par agent (s)': q.ringTimeout, 'Attente maximale (s)': q.masterTimeout, 'Débordement': cmpDest(q.dest), 'Intro': q.introEnabled ? q.intro : '—', 'Musique d\'attente': q.moh,
        'Agents': q.members.map(m => m.dn), 'Gestionnaires': q.managers})},
    {key: 'ivr', label: 'Standards IVR', items: X.ivrs, id: i => i.number, name: i => `${i.number} ${i.name}`, link: i => i.number,
      fields: i => ({'Nom': i.name, 'Message': i.prompt || '—', 'Délai (s)': i.timeout, 'Sans choix': i.timeoutType + (i.timeoutDN ? ' ' + i.timeoutDN : ''), 'Touches': i.options.map(o => `${o.key} → ${cmpDest({to: o.type, dn: o.dn, ext: o.data})}`)})},
    {key: 'rg', label: 'Groupes de sonnerie', items: X.ringGroups, id: r => r.number, name: r => `${r.number} ${r.name}`, link: r => r.number,
      fields: r => ({'Nom': r.name, 'Stratégie': r.strategy, 'Sonnerie (s)': r.ringTime, 'Sans réponse': cmpDest(r.dest), 'Membres': r.members})},
    {key: 'dept', label: 'Départements', items: X.groups.filter(g => !isSysGroup(g)), id: g => g.number, name: g => `${g.number} ${g.name}`, link: g => g.number,
      fields: g => ({'Nom': g.name, 'Horaires': cmpHours(g.hours), 'Pauses': g.breakTime ? cmpHours(g.breakTime) : '—', 'Ouvert →': cmpDest(g.routes.office), 'Fermé →': cmpDest(g.routes.outOfOffice), 'Pause →': cmpDest(g.routes.break), 'Fériés →': cmpDest(g.routes.holidays),
        'Jours fériés': (g.holidayDates || []).map(h => `${h.name} ${h.y || ''}-${String(h.m).padStart(2, '0')}-${String(h.d).padStart(2, '0')}`).concat(g.holidayDates ? [] : g.holidays || []), 'Membres': g.members.map(m => m.dn)})},
    {key: 'sda', label: 'SDA', items: Object.keys(ruleOf).map(d => ({did: d, ...ruleOf[d]})), id: x => x.did, name: x => phone(x.did), did: x => x.did,
      fields: x => ({'Trunk': x.l.number + ' ' + x.l.gateway, 'Règle': x.r ? (x.r.name || (x.def ? 'règle par défaut du trunk' : 'règle du SDA')) : '—', 'Ouvert →': cmpDest(x.r?.office), 'Fermé →': x.r?.altOOO ? cmpDest(x.r.outOfOffice) : '(idem)', 'Fériés →': x.r?.altHol ? cmpDest(x.r.holidays) : '(idem)'})},
    {key: 'trunks', label: 'Trunks', items: lines, id: l => l.number, name: l => `${l.number} ${l.gateway}`, link: l => l.number,
      fields: l => ({'Passerelle': l.gateway, 'Numéro principal': phone(l.extNumber), 'Direction': l.direction, 'Appels simultanés': l.sim, 'Nombre de SDA': String(l.dids.length)})},
    {key: 'gw', label: 'Passerelles / fournisseurs', items: X.gateways || [], id: g => g.name, name: g => g.name,
      fields: g => ({'Type': g.type, 'Hôte': g.host + (g.port && g.port !== '0' ? ':' + g.port : ''), 'Gabarit': g.template, 'Enregistrement': g.reg, 'Codecs': (g.codecs || []).join(', ')})},
    {key: 'out', label: 'Règles sortantes', items: X.outbound || [], id: o => o.name, name: o => o.name,
      fields: o => ({'Priorité': String(o.priority), 'Préfixe': o.prefix, 'Longueurs': o.lengths, 'Routes': o.routes.map(r => r.gw + (r.strip && r.strip !== '0' ? ' −' + r.strip : '') + (r.prepend ? ' +' + r.prepend : ''))})},
    {key: 'fw', label: 'Firmwares sur le serveur', items: (X.firmwares || []).map(f => ({file: f.file})), id: f => f.file, name: f => f.file, fields: f => ({})},
    {key: 'params', label: 'Paramètres', items: X.params || [], id: p => p.scope + ':' + p.name, name: p => p.name, fields: p => ({'Valeur': p.value})},
  ];
}
function cmpDiff(OLD, NEW){
  const co = cmpCategories(OLD), cn = cmpCategories(NEW);
  return cn.map((cat, i) => {
    const o = co[i], mo = new Map(o.items.map(x => [cat.id(x), x])), mn = new Map(cat.items.map(x => [cat.id(x), x]));
    const added = [], removed = [], changed = [];
    mn.forEach((x, k) => { if(!mo.has(k)) added.push(x); });
    mo.forEach((x, k) => { if(!mn.has(k)) removed.push(x); });
    mn.forEach((x, k) => {
      const y = mo.get(k); if(!y) return;
      const fa = o.fields(y), fb = cat.fields(x), diffs = [];
      Object.keys(fb).forEach(f => {
        const a = fa[f], b = fb[f];
        if(Array.isArray(b) || Array.isArray(a)){
          const A = new Set(a || []), B = new Set(b || []);
          const plus = [...B].filter(v => !A.has(v)), minus = [...A].filter(v => !B.has(v));
          if(plus.length || minus.length) diffs.push({f, plus, minus});
        } else if(String(a ?? '') !== String(b ?? '')) diffs.push({f, a: a ?? '', b: b ?? ''});
      });
      if(diffs.length) changed.push({x, diffs});
    });
    return {cat, o, added, removed, changed};
  });
}

V.comparaison = el => {
  const REF = window.REF_D || null;
  const curISO = backupDateISO(FULL.info.date), refISO = REF ? backupDateISO(REF.info.date) : '';
  const refCard = `<div class="card bk" id="refcard"><div class="bkrow"><div class="bkinfo"><div class="bkt">Backup de référence</div>
      <div class="bkn">${REF ? esc(REF.source?.name || 'backup de référence') : 'Aucun'}</div>
      <div class="muted" style="font-size:12.5px">${REF ? `3CX ${esc(REF.info.version)} · sauvegarde du ${esc(bkDate(REF.info.date))} · ${esc(REF.info.company)}` : 'Choisissez un second backup (.zip) du même système pour le comparer au backup actuel.'}</div></div>
      <div class="bkact"><label class="btn primary">${REF ? 'Changer de référence' : 'Choisir le backup de référence (.zip)'}<input type="file" id="reffile" accept=".zip,application/zip" hidden></label>${REF ? '<button class="btn danger" id="refclose">Retirer la référence</button>' : ''}</div></div>
      <div class="bkdrop">ou glissez-déposez le fichier .zip ici. Il est analysé dans votre navigateur et mémorisé à part : le backup actuel n'est pas remplacé.</div><div id="refst" class="bkst"></div></div>`;
  el.innerHTML = `<div id="cwrap"><h2>Comparaison de backups</h2>
  <p class="lead">Ce qui a changé entre deux backups : éléments ajoutés, supprimés et modifiés (champ par champ), et journal d'audit entre les deux dates. Le plus ancien des deux est pris comme « avant », quel que soit l'ordre de chargement.</p>
  <div class="grid two"><div class="card"><div class="bkt">Backup actuel</div><div class="bkn">${esc(FULL.source?.name || 'backup actuel')}</div><div class="muted" style="font-size:12.5px">3CX ${esc(FULL.info.version)} · sauvegarde du ${esc(bkDate(FULL.info.date))}</div></div>${refCard}</div>
  <div id="cbody"></div></div>`;
  // chargement de la référence
  const card = $('#refcard'), st = $('#refst');
  const go = async f => { if(!f) return; card.classList.add('busy'); st.className = 'bkst'; st.textContent = 'Démarrage…';
    try{ await BK.loadRef(f, m => { st.textContent = m; }); BK.rerun(); }
    catch(e){ card.classList.remove('busy'); st.className = e.cancel ? 'bkst' : 'bkst err'; st.textContent = e.cancel ? e.message.replace('le backup affiché', 'la référence actuelle') : 'Erreur : ' + e.message; } };
  $('#reffile').addEventListener('change', e => go(e.target.files[0]));
  card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('over'); });
  card.addEventListener('dragleave', () => card.classList.remove('over'));
  card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('over'); go(e.dataTransfer.files[0]); });
  const rc = $('#refclose'); if(rc) rc.addEventListener('click', async () => { await BK.clearRef(); BK.rerun(); });
  if(!REF) return;
  if(REF.info.fqdn !== FULL.info.fqdn) $('#cbody').insertAdjacentHTML('beforeend', `<p class="segbar">Attention : les deux backups ne viennent pas du même système (${esc(REF.info.fqdn)} / ${esc(FULL.info.fqdn)}).</p>`);
  const refOlder = refISO && curISO ? refISO <= curISO : true;
  const OLD = refOlder ? REF : FULL, NEW = refOlder ? FULL : REF, oISO = refOlder ? refISO : curISO, nISO = refOlder ? curISO : refISO;
  const res = cmpDiff(OLD, NEW);
  // filtre magasin : élément du magasin choisi (ou, s'il a été supprimé, préfixe de son nom)
  const inSeg = (cat, x) => { if(!SEG) return true; const k = cat.link ? cat.link(x) : null; if(k && SEGOF[k]) return SEGOF[k] === SEG;
    if(cat.did) return DIDSEG[cat.did(x)] === SEG; const nm = cat.name(x); return rawCode(String(nm).replace(/^\S+\s/, '')) === SEG || rawCode(nm) === SEG; };
  // 18.1.44 : compteurs du magasin choisi (OLD et NEW remplacés, dans ce tableau seulement, par leur partie du magasin)
  // 18.2.15 : élément supprimé depuis : magasin d'après le préfixe de son nom, comme la liste des changements
  const segX = x => x.number in SEGOF ? SEGOF[x.number] : (nm => rawCode(nm.replace(/^\S+\s/, '')) === SEG || rawCode(nm) === SEG ? SEG : '')(String(x.name || ((x.first || '') + ' ' + (x.last || '')).trim()));
  const sfx = a => SEG ? a.filter(x => segX(x) === SEG) : a, sfo = X => ({...X, extensions: sfx(X.extensions), queues: sfx(X.queues), ivrs: sfx(X.ivrs), groups: sfx(X.groups)});
  const didSegOf = (l, d) => { if(d in DIDSEG) return DIDSEG[d]; const r = l.rules.find(x => x.data === d) || l.rules.find(x => x.cond === 'ForwardAll'), dn = r && r.office && r.office.dn; return dn ? SEGOF[dn] : ''; };
  const sdx = X => X.lines.reduce((a, l) => a + l.dids.filter(d => !SEG || didSegOf(l, d) === SEG).length, 0), scx = X => SEG ? X.calls.filter(c => callSeg(c) === SEG).length : X.calls.length;
  const counts = (([OLD, NEW]) => [['Postes', OLD.extensions.length, NEW.extensions.length], ['Téléphones', OLD.extensions.reduce((a, e) => a + e.devices.length, 0), NEW.extensions.reduce((a, e) => a + e.devices.length, 0)],
    ["Files d'attente", OLD.queues.length, NEW.queues.length], ['Standards IVR', OLD.ivrs.length, NEW.ivrs.length], ['Départements', OLD.groups.length, NEW.groups.length],
    ['SDA', sdx(OLD), sdx(NEW)], ['Appels dans l\'historique', scx(OLD), scx(NEW)]])([sfo(OLD), sfo(NEW)]);
  const linkOf = (cat, x) => cat.link && DN[cat.link(x)] ? `<a class="dn" data-dn="${esc(cat.link(x))}">${esc(cat.name(x))}</a>` : cat.did ? `<a class="dlink" href="#diagramme/${esc(cat.did(x))}">${esc(cat.name(x))}</a>` : esc(cat.name(x));
  const diffHTML = d => d.plus ? `<div class="cdf"><b>${esc(d.f)}</b> ${d.plus.map(v => `<span class="cadd">+ ${esc(v)}</span>`).join('')}${d.minus.map(v => `<span class="cdel">− ${esc(v)}</span>`).join('')}</div>`
    : `<div class="cdf"><b>${esc(d.f)}</b> <span class="cdel">${esc(d.a) || '∅'}</span> → <span class="cadd">${esc(d.b) || '∅'}</span></div>`;
  const total = res.reduce((a, r) => a + r.added.filter(x => inSeg(r.cat, x)).length + r.removed.filter(x => inSeg(r.cat, x)).length + r.changed.filter(c => inSeg(r.cat, c.x)).length, 0);
  // journal d'audit entre les deux backups (pris dans le plus récent)
  const auditBetween = (NEW.audit || []).filter(a => a[0] > oISO && a[0] <= (nISO || '9999') && (!SEG || String(a[4]).split(/[ ,]/).some(n => SEGOF[n] === SEG)));
  $('#cbody').insertAdjacentHTML('beforeend', `
    <p class="lead" style="margin-top:14px"><b>Avant :</b> ${esc(bkDate(OLD.info.date))} → <b>Après :</b> ${esc(bkDate(NEW.info.date))} · <b>${nf(total)}</b> changement${total>1?'s':''}${SEG ? ` pour le magasin <b>${esc(segName(SEG))}</b>` : ''} · ${nf(auditBetween.length)} entrées du journal d'audit entre les deux.</p>
    <div class="tw"><table><thead><tr><th>Élément</th><th class="num">Avant</th><th class="num">Après</th><th class="num">Écart</th></tr></thead><tbody>
    ${counts.map(([l, a, b]) => `<tr><td>${l}</td><td class="num">${nf(a)}</td><td class="num">${nf(b)}</td><td class="num">${b - a ? `<span class="pill ${b > a ? 'ok' : 'bad'}">${b > a ? '+' : ''}${nf(b - a)}</span>` : '='}</td></tr>`).join('')}</tbody></table></div>
    <div class="bar" style="margin-top:14px"><input type="search" id="cq" placeholder="Filtrer les changements (nom, numéro, champ…)"><select id="ck"><option value="">Tous les types</option><option value="a">Ajoutés</option><option value="r">Supprimés</option><option value="m">Modifiés</option></select><span style="flex:1"></span><button class="btn" id="cexp">Exporter (CSV)</button></div>
    <div id="clist"></div>
    <h3>Journal d'audit entre les deux backups</h3><div id="caudit"></div>`);
  function drawList(){
    const q = gsNorm($('#cq').value), k = $('#ck').value;
    const match = (cat, x, extra) => !q || gsNorm(cat.name(x) + ' ' + (extra || '')).includes(q);
    $('#clist').innerHTML = res.map(r => {
      const A = k && k !== 'a' ? [] : r.added.filter(x => inSeg(r.cat, x) && match(r.cat, x));
      const R = k && k !== 'r' ? [] : r.removed.filter(x => inSeg(r.cat, x) && match(r.cat, x));
      const M = k && k !== 'm' ? [] : r.changed.filter(c => inSeg(r.cat, c.x) && match(r.cat, c.x, c.diffs.map(d => d.f + ' ' + (d.a || '') + ' ' + (d.b || '') + ' ' + (d.plus || []).join(' ') + ' ' + (d.minus || []).join(' ')).join(' ')));
      if(!A.length && !R.length && !M.length) return '';
      return `<details class="card ccat" ${A.length + R.length + M.length <= 40 ? 'open' : ''}><summary><b>${esc(r.cat.label)}</b>
        ${A.length ? `<span class="pill ok">${A.length} ajouté${A.length>1?'s':''}</span>` : ''}${R.length ? `<span class="pill bad">${R.length} supprimé${R.length>1?'s':''}</span>` : ''}${M.length ? `<span class="pill warn">${M.length} modifié${M.length>1?'s':''}</span>` : ''}</summary>
        ${A.length ? `<div class="cgrp"><div class="cgt">Ajoutés</div>${A.slice(0, 300).map(x => `<span class="ritem cadd2">${linkOf(r.cat, x)}</span>`).join('')}${A.length > 300 ? `<span class="muted">+ ${A.length - 300} autres</span>` : ''}</div>` : ''}
        ${R.length ? `<div class="cgrp"><div class="cgt">Supprimés</div>${R.slice(0, 300).map(x => `<span class="ritem cdel2">${esc(r.cat.name(x))}</span>`).join('')}${R.length > 300 ? `<span class="muted">+ ${R.length - 300} autres</span>` : ''}</div>` : ''}
        ${M.length ? `<div class="cgrp"><div class="cgt">Modifiés</div>${M.slice(0, 300).map(c => `<div class="cmod"><div class="cmn">${linkOf(r.cat, c.x)}</div>${c.diffs.map(diffHTML).join('')}</div>`).join('')}${M.length > 300 ? `<p class="muted">+ ${M.length - 300} autres (filtrez pour les voir)</p>` : ''}</div>` : ''}
      </details>`; }).join('') || '<p class="muted">Aucun changement ne correspond aux filtres.</p>';
  }
  drawList();
  $('#cq').addEventListener('input', drawList); $('#ck').addEventListener('change', drawList);
  $('#cexp').addEventListener('click', () => {
    const qv = v => '"' + csvSafe(v) + '"', out = [['Catégorie', 'Type', 'Élément', 'Champ', 'Avant', 'Après']];
    res.forEach(r => { r.added.filter(x => inSeg(r.cat, x)).forEach(x => out.push([r.cat.label, 'Ajouté', r.cat.name(x), '', '', '']));
      r.removed.filter(x => inSeg(r.cat, x)).forEach(x => out.push([r.cat.label, 'Supprimé', r.cat.name(x), '', '', '']));
      r.changed.filter(c => inSeg(r.cat, c.x)).forEach(c => c.diffs.forEach(d => out.push([r.cat.label, 'Modifié', r.cat.name(c.x), d.f, d.plus ? d.minus.join(' | ') : d.a, d.plus ? d.plus.join(' | ') : d.b]))); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(qv).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = `comparaison-${(oISO || '').slice(0, 10)}_${(nISO || '').slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  table($('#caudit'), {rows: auditBetween, pageSize: 50,
    search: a => [a[1], a[3], a[4], a[5], ...a[6].map(c => c[0])].join(' '),
    filters: [{label: 'Toutes actions', options: [...new Set(auditBetween.map(a => a[1]))].sort().map(x => [x, x]), test: (a, v) => a[1] === v},
              {label: 'Tous utilisateurs', options: [...new Set(auditBetween.map(a => a[3]))].sort().map(x => [x, x]), test: (a, v) => a[3] === v}],
    cols: [{h: 'Date', v: a => a[0], f: a => fmtD(a[0])}, {h: 'Action', v: a => a[1], f: a => `<span class="pill ${a[1]==='Suppression'?'bad':a[1]==='Création'?'ok':a[1]==='Modification'?'acc':''}">${esc(a[1])}</span>`},
      {h: 'Objet', v: a => a[4]}, {h: 'Par', v: a => a[3]}, {h: 'Champs modifiés', num: 1, v: a => a[6].length, f: a => a[6].length || ''}],
    onRow: a => openDrawer(esc(a[1]) + ' · ' + esc(a[4]), kv([['Date', fmtD(a[0])], ['Par', esc(a[3])], ['IP', esc(a[5])]]) +
      (a[6].length ? `<h3>Changements</h3><div class="tw"><table><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>${a[6].map(c => `<tr><td><b>${esc(c[0])}</b></td><td class="mono" style="color:var(--bad)">${esc(c[1])}</td><td class="mono" style="color:var(--ok)">${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun détail de changement.</p>'))});
};

