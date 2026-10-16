// ---------- Modèle de touches par département (onglet) ----------
const BM_TYPES = ['BLF', 'SharedParking', 'SpeedDial', 'CustomSpeedDial', 'ProfileStatus', 'QueueLogin'];
V.blfmodele = el => {
  if(!FULL.extensions.some(e => e.blfs)){ el.innerHTML = `<h2>Modèle de touches</h2><div class="card" style="border-left:3px solid var(--warn)">Les touches des téléphones sont lues à l'ouverture du backup : <b>rouvrez le backup</b> pour utiliser cet assistant.</div>`; return; }
  const S = window.__bm ||= {g: '', th: '60', pick: {}};
  const memOf = g => { const s = SEGOF[g.number]; return g.members.map(m => EXT_BY[m.dn]).filter(e => e && (e.blfs || []).some(b => BM_TYPES.includes(b.type) && b.v) && SEGOF[e.number] === s); };
  const groups = FULL.groups.filter(g => !isSysGroup(g) && (!SEG || SEGOF[g.number] === SEG)).map(g => ({g, m: memOf(g)})).filter(x => x.m.length >= 2).sort((a, b) => b.m.length - a.m.length);
  if(!groups.length){ el.innerHTML = '<h2>Modèle de touches</h2><p class="muted">Aucun département avec au moins deux postes programmés.</p>'; return; }
  if(!groups.some(x => x.g.number === S.g)) S.g = groups[0].g.number;
  const {g, m: mem} = groups.find(x => x.g.number === S.g), th = +S.th / 100;
  const keyOf = b => b.type + '|' + b.v, keys = b => (b.blfs || []).filter(x => BM_TYPES.includes(x.type) && x.v);
  // fréquence de chaque touche parmi les membres (une touche BLF vers un membre ne compte pas pour ce membre)
  const F = {};
  mem.forEach(e => { const seen = new Set(); keys(e).forEach(b => { const k = keyOf(b); if(seen.has(k)) return; seen.add(k); const f = F[k] ||= {k, b, n: 0, pos: []}; f.n++; f.pos.push(b.no); }); });
  Object.values(F).forEach(f => { f.elig = mem.filter(e => !(f.b.type === 'BLF' && f.b.v === e.number)).length; f.r = f.n / (f.elig || 1); f.pos.sort((a, b) => a - b); f.at = f.pos[Math.floor(f.pos.length / 2)]; });
  const pick = S.pick[g.number] ||= {}, inModel = f => pick[f.k] != null ? pick[f.k] : f.r >= th && f.n >= 2;
  const cand = Object.values(F).filter(f => f.n >= 2 || pick[f.k]).sort((a, b) => a.at - b.at || b.r - a.r), model = cand.filter(inModel);
  let gone = []; try{ gone = blfAnalysis().issues.filter(i => (i.k === 'gone' || i.k === 'dup') && mem.includes(i.e)); }catch(e){}
  const plan = mem.map(e => { const have = new Set(keys(e).map(keyOf)), used = new Set((e.blfs || []).filter(b => b.type !== 'None').map(b => b.no));
    const free = () => { let n = 1; while(used.has(n)) n++; used.add(n); return n; };
    const add = model.filter(f => !have.has(f.k) && !(f.b.type === 'BLF' && f.b.v === e.number)).map(f => { const at = !used.has(f.at) ? (used.add(f.at), f.at) : free(); return {f, at}; });
    const extra = keys(e).filter(b => !model.some(f => f.k === keyOf(b)));
    const del = gone.filter(i => i.e === e);
    return {e, add, extra, del, ok: model.length > 0 && !add.length && !del.length}; });
  const ok = plan.filter(p => p.ok).length;
  const nm = e => (e.first + ' ' + e.last).trim();
  el.innerHTML = `<div id="bmwrap"><div class="noprint"><h2>Modèle de touches</h2>
    <p class="lead">Choisissez un département : l'assistant propose un modèle de touches d'après ce que la majorité des collègues du même magasin ont sur leur téléphone (BLF, parkings, numérotation rapide, statut), puis prépare pour chaque téléphone la liste des touches à ajouter ou à retirer. Rien n'est modifié dans 3CX.</p>
    <div class="bar"><label class="count">Département</label><select id="bmg">${groups.map(x => `<option value="${esc(x.g.number)}"${x.g.number === S.g ? ' selected' : ''}>${esc(x.g.name)} (${x.m.length} postes)</option>`).join('')}</select>
      <label class="count">Touche dans le modèle si au moins</label><select id="bmth">${['50', '60', '75', '90'].map(v => `<option value="${v}"${S.th === v ? ' selected' : ''}>${v} % des collègues</option>`).join('')}</select>
      <span style="flex:1"></span><button class="btn primary" id="bmprint">Imprimer / PDF</button> <button class="btn" id="bmcopy">Copier</button> <span class="muted" id="bmmsg" style="font-size:12.5px"></span></div>
    <div class="grid kpis">${[['Postes du département', nf(mem.length)], ['Touches du modèle', nf(model.length)], ['Téléphones conformes', `${nf(ok)} / ${nf(mem.length)}`], ['Touches à ajouter', nf(plan.reduce((a, p) => a + p.add.length, 0))], ['Touches à retirer (cassées)', nf(plan.reduce((a, p) => a + p.del.length, 0))]].map(([l, v]) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h3>Modèle proposé</h3>
    <div class="card"><div class="muted" style="font-size:12.5px;margin-bottom:6px">Cochez ou décochez pour ajuster le modèle. Position = touche la plus souvent utilisée pour cette fonction.</div>
      ${cand.map(f => `<label class="bmk"><input type="checkbox" data-bmk="${esc(f.k)}"${inModel(f) ? ' checked' : ''}> <span class="blfn">${f.at}</span> ${(() => { const t = blfTarget(f.b); return t && DN[t] ? `${esc((BLF_T[f.b.type] || [f.b.type])[0])} : ${dnLink(t)}` : esc(blfLabel(f.b)); })()} <span class="muted">— ${f.n} / ${f.elig} (${Math.round(100 * f.r)} %)</span>${pick[f.k] != null ? ' <span class="pill">ajusté</span>' : ''}</label>`).join('') || '<span class="muted">Aucune touche commune à au moins deux postes.</span>'}
      ${cand.length && !model.length ? '<div class="ubw" style="margin-top:8px">Aucune touche n\'atteint le seuil : baissez le seuil ou cochez les touches à inclure dans le modèle.</div>' : ''}
      ${Object.keys(pick).length ? '<p style="margin:8px 0 0"><button class="btn" id="bmreset">Revenir au modèle calculé</button></p>' : ''}</div>
    <h3>Téléphones</h3>
    <div class="tw"><table><thead><tr><th>Poste</th><th>Téléphone</th><th class="num">Touches</th><th class="num">À ajouter</th><th class="num">À retirer</th><th class="num">Hors modèle</th><th>État</th></tr></thead><tbody>
      ${plan.map(p => `<tr><td>${dnLink(p.e.number)}</td><td>${esc(p.e.devices.map(d => d.model || d.template).join(', ') || '—')}</td><td class="num">${keys(p.e).length}</td><td class="num">${p.add.length || ''}</td><td class="num">${p.del.length ? `<span class="pill bad">${p.del.length}</span>` : ''}</td><td class="num">${p.extra.length || ''}</td><td>${p.ok ? '<span class="pill ok">Conforme</span>' : !model.length && !p.del.length ? '<span class="muted">pas de modèle</span>' : '<span class="pill warn">À ajuster</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="nvsheet report" id="bmsheet"><header class="rpcover"><div class="rpk">Touches à programmer · 3CXplore</div><h1>${esc(g.name)}</h1>
      <div class="rpmeta">Magasin ${esc(segName(SEGOF[g.number] || SEG_COMMON))} · modèle de ${model.length} touche${model.length > 1 ? 's' : ''} · ${plan.length - ok} téléphone${plan.length - ok > 1 ? 's' : ''} à ajuster · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      ${plan.filter(p => !p.ok).map(p => `<section class="rps"><h2>${esc(p.e.number)} ${esc(nm(p.e))}</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">Console 3CX → Utilisateurs → ${esc(p.e.number)} → Touches BLF${p.e.devices.length ? ' · ' + esc(p.e.devices.map(d => d.model || d.template).join(', ')) : ''}</div><ul class="nvck">
        ${p.del.map(i => `<li><label><input type="checkbox"> <span><b>Retirer</b> touche ${i.b.no || ''} : ${esc(i.t)}</span></label></li>`).join('')}
        ${p.add.map(a => `<li><label><input type="checkbox"> <span><b>Ajouter</b> en touche ${a.at} : ${esc(blfLabel(a.f.b))}</span></label></li>`).join('')}</ul>
        ${p.extra.length ? `<div class="muted" style="font-size:12px">Touches propres à ce poste (à garder si utiles) : ${p.extra.map(b => esc(blfLabel(b))).join(' · ')}</div>` : ''}</section>`).join('') || '<p>Tous les téléphones du département suivent déjà le modèle.</p>'}
    </div></div>`;
  const re = () => V.blfmodele(el);
  $('#bmg').addEventListener('change', e => { S.g = e.target.value; re(); });
  $('#bmth').addEventListener('change', e => { S.th = e.target.value; re(); });
  $('#bmwrap').addEventListener('change', e => { const c = e.target.closest('[data-bmk]'); if(!c) return; const f = F[c.dataset.bmk]; const calc = f.r >= th && f.n >= 2;
    if(c.checked === calc) delete pick[f.k]; else pick[f.k] = c.checked; re(); });
  if($('#bmreset')) $('#bmreset').addEventListener('click', () => { S.pick[g.number] = {}; re(); });
  $('#bmprint').addEventListener('click', () => { printHTML($('#bmsheet').outerHTML.replace('id="bmsheet"', '')); });
  $('#bmcopy').addEventListener('click', async () => { const t = [`Touches à programmer — ${g.name}`, ...plan.filter(p => !p.ok).map(p => `\n${p.e.number} ${nm(p.e)}\n` + [...p.del.map(i => `   [ ] Retirer touche ${i.b.no || ''} : ${i.t}`), ...p.add.map(a => `   [ ] Ajouter en touche ${a.at} : ${blfLabel(a.f.b)}`)].join('\n'))].join('\n');
    try{ await navigator.clipboard.writeText(t); $('#bmmsg').textContent = 'Copié.'; }catch(er){ $('#bmmsg').textContent = 'Copie impossible.'; } });
};

