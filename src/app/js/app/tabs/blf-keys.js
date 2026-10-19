// ---------- Touches BLF des téléphones (onglet) ----------
const BLF_T = {BLF: ['BLF', 'var(--accent)'], SharedParking: ['Parking', 'var(--k-rg)'], SpeedDial: ['Rapide', 'var(--c-out)'], CustomSpeedDial: ['Rapide perso.', 'var(--c-out)'],
  Line: ['Ligne', 'var(--muted)'], None: ['Vide', 'var(--line)'], ProfileStatus: ['Statut', 'var(--warn)'], QueueLogin: ['Files', 'var(--ok)']};
const BLF_ST = Object.values(FWD_ST); // 19.0.3 : noms des statuts du système
// libellé d'une touche ; numéro interne visé (ou '')
const blfNum = b => b.v.split(/\n/)[0].replace(/[\s().+-]/g, '');
const blfTarget = b => b.type === 'BLF' || b.type === 'SharedParking' ? b.v : (b.type === 'SpeedDial' || b.type === 'CustomSpeedDial') && /^\d{2,5}$/.test(blfNum(b)) ? blfNum(b) : '';
const blfLabel = b => { const T = BLF_T[b.type] || [b.type]; if(b.type === 'ProfileStatus') return `${T[0]} : ${BLF_ST[+b.v] || b.v}`;
  if(b.type === 'CustomSpeedDial'){ const [n, ...l] = b.v.split(/\n/); return `${T[0]} : ${l.join(' ').trim() || '—'} (${phone(n.trim()) || n.trim()})`; }
  if(b.type === 'SpeedDial') return `${T[0]} : ${DN[b.v] ? b.v + ' ' + dnName(b.v) : phone(b.v) || b.v}`;
  if(b.type === 'BLF' || b.type === 'SharedParking') return `${T[0]} : ${b.v}${DN[b.v] ? ' ' + dnName(b.v) : ''}`;
  return T[0]; };
let BLF_CACHE = null;
function blfAnalysis(){
  if(BLF_CACHE) return BLF_CACHE;
  const parks = new Set(FULL.parks), ok = n => !!DN[n] || parks.has(n);
  const watchers = {}, issues = [];
  FULL.extensions.forEach(e => (e.blfs || []).forEach(b => { if(b.type === 'BLF' && b.v) (watchers[b.v] ||= new Set()).add(e.number); }));
  FULL.extensions.forEach(e => { const B = e.blfs || [], seen = {};
    B.forEach(b => { const t = blfTarget(b);
      if(b.type === 'BLF' && b.v === e.number) issues.push({e, b, k: 'self', t: 'Touche BLF sur son propre poste'});
      else if((b.type === 'BLF' || b.type === 'SharedParking') && b.v && !ok(b.v)) issues.push({e, b, k: 'gone', t: `Touche vers ${b.v} : ce numéro n'existe plus`});
      else if(t && (b.type === 'SpeedDial' || b.type === 'CustomSpeedDial') && !ok(t)) issues.push({e, b, k: 'gone', t: `Numérotation rapide vers ${t} : ce numéro interne n'existe plus`});
      const key = b.type + ':' + b.v; if(b.v && !['Line', 'None', 'QueueLogin'].includes(b.type)){ if(seen[key]) issues.push({e, b, k: 'dup', t: `Touche en double (${blfLabel(b)}, touches ${seen[key]} et ${b.no})`}); else seen[key] = b.no; } }); });
  // cohérence dans un département : touche (BLF ou parking) présente chez au moins 60 % des membres qui ont des touches, absente chez d'autres
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => {
    const gs = SEGOF[g.number], mem = g.members.map(m => EXT_BY[m.dn]).filter(e => e && (e.blfs || []).length && SEGOF[e.number] === gs);
    if(mem.length < 4) return;
    const c = {}; mem.forEach(e => new Set((e.blfs || []).filter(b => (b.type === 'BLF' || b.type === 'SharedParking') && b.v && b.v !== e.number).map(b => b.type + ':' + b.v)).forEach(k => c[k] = (c[k] || 0) + 1));
    Object.entries(c).filter(([, n]) => n / mem.length >= .75 && n < mem.length).forEach(([k, n]) => { const [type, v] = k.split(':');
      mem.filter(e => !(e.blfs || []).some(b => b.type === type && b.v === v) && e.number !== v).forEach(e => issues.push({e, b: {type, v, no: 0}, k: 'miss', g, t: `N'a pas la touche ${blfLabel({type, v})} que ${n} des ${mem.length} collègues du département ${g.name} ont`})); }); });
  return BLF_CACHE = {watchers, issues};
}
const BLF_ISS = {gone: ['Numéro disparu', 'bad'], dup: ['En double', 'warn'], self: ['Sur soi-même', 'warn'], miss: ['Différent des collègues', '']};
function blfKeysHTML(e){
  const B = e.blfs || [];
  if(!B.length) return '<span class="muted">Aucune touche programmée.</span>';
  return `<div class="blfk">${B.map(b => { const T = BLF_T[b.type] || [b.type, 'var(--muted)'], t = blfTarget(b);
    return `<div class="blfr${b.type === 'None' || b.type === 'Line' ? ' dim' : ''}"><span class="blfn">${b.no || '–'}</span><i style="background:${T[1]}"></i><span>${t && DN[t] ? `${esc(T[0])} : ${dnLink(t)}` : esc(blfLabel(b))}</span></div>`; }).join('')}</div>`;
}
V.blf = el => {
  const S = window.__blf ||= {iss: ''};
  if(!FULL.extensions.some(e => e.blfs)){ el.innerHTML = `<h2>Touches BLF</h2><div class="card" style="border-left:3px solid var(--warn)">Les touches des téléphones sont lues à l'ouverture du backup : <b>rouvrez le backup</b> (Fermer le backup, puis le choisir de nouveau) pour afficher cette analyse.</div>`; return; }
  const A = blfAnalysis(), segOk = n => !SEG || SEGOF[n] === SEG;
  const exts = FULL.extensions.filter(e => segOk(e.number)), withK = exts.filter(e => (e.blfs || []).some(b => b.type !== 'None' && b.type !== 'Line'));
  const all = exts.flatMap(e => e.blfs || []), cnt = t => all.filter(b => b.type === t).length;
  const iss = A.issues.filter(i => segOk(i.e.number)), issBy = {}; iss.forEach(i => (issBy[i.e.number] ||= []).push(i));
  const nobody = exts.filter(e => e.email && !(A.watchers[e.number] || []).size);
  const top = Object.entries(A.watchers).filter(([n]) => segOk(n) && DN[n]).sort((a, b) => b[1].size - a[1].size).slice(0, 12);
  el.innerHTML = `<div id="blfwrap"><h2>Touches BLF</h2>
    <p class="lead">Les touches programmées des téléphones : surveillance de collègues (BLF), parkings partagés, numérotation rapide, changement de statut. Touches vers des numéros disparus, en double, et postes qui n'ont pas les mêmes touches que leurs collègues${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="grid kpis">${[['Postes avec touches', `${nf(withK.length)} / ${nf(exts.length)}`], ['Touches BLF', nf(cnt('BLF'))], ['Touches de parking', nf(cnt('SharedParking'))], ['Numérotation rapide', nf(cnt('SpeedDial') + cnt('CustomSpeedDial'))],
      ['Numéros disparus', nf(iss.filter(i => i.k === 'gone').length)], ['En double', nf(iss.filter(i => i.k === 'dup').length)], ['Différences entre collègues', nf(iss.filter(i => i.k === 'miss').length)], ['Employés surveillés par personne', nf(nobody.length)]].map(([l, v]) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h3>À corriger (${iss.length})</h3>
    <div class="bar"><select id="blfiss"><option value="">Tous les types</option>${Object.entries(BLF_ISS).map(([k, [l]]) => `<option value="${k}"${S.iss === k ? ' selected' : ''}>${esc(l)} (${iss.filter(i => i.k === k).length})</option>`).join('')}</select></div>
    <div id="blfi"></div>
    <h3>Postes</h3><div id="blft"></div>
    <div class="grid two"><div><h3>Les plus surveillés</h3><div class="card" style="font-size:13px">${top.map(([n, s]) => `<div>${dnLink(n)} <span class="muted">— ${s.size} téléphone${s.size > 1 ? 's' : ''}</span></div>`).join('') || '<span class="muted">Aucun</span>'}</div></div>
      <div><h3>Employés surveillés par personne (${nobody.length})</h3><div class="card" style="font-size:13px;max-height:320px;overflow:auto">${nobody.slice(0, 200).map(e => `<div>${dnLink(e.number)} <span class="muted">— ${esc(segShort(SEGOF[e.number] || SEG_COMMON))}</span></div>`).join('') || '<span class="muted">Aucun</span>'}</div></div></div>
    <p class="note">« Différent des collègues » : une touche BLF ou de parking que la grande majorité (75 % et plus) des membres d'un département, du même magasin, ont sur leur téléphone, mais pas ce poste. « Surveillé par personne » : poste nominatif (avec courriel) qu'aucun téléphone n'affiche en BLF. Les touches de type Ligne et Vide ne sont pas analysées.</p></div>`;
  const drawIss = () => table($('#blfi'), {rows: iss.filter(i => !S.iss || i.k === S.iss), pageSize: 25, state: S.ti ||= {},
    search: i => [i.e.number, (i.e.first + ' ' + i.e.last), i.t].join(' '),
    cols: [{h: 'Poste', v: i => i.e.number, f: i => dnLink(i.e.number)}, {h: 'Magasin', v: i => SEGOF[i.e.number] || '', f: i => esc(segShort(SEGOF[i.e.number] || SEG_COMMON))},
      {h: 'Type', v: i => i.k, f: i => `<span class="pill ${BLF_ISS[i.k][1]}">${esc(BLF_ISS[i.k][0])}</span>`}, {h: 'Détail', v: i => i.t, f: i => esc(i.t)}],
    onRow: i => showExt(i.e)});
  drawIss();
  $('#blfiss').addEventListener('change', e => { S.iss = e.target.value; drawIss(); });
  table($('#blft'), {rows: exts, sort: [0, 1], pageSize: 50, state: S.tp ||= {},
    search: e => [e.number, e.first, e.last, ...(e.blfs || []).map(b => b.v)].join(' '),
    filters: [{label: 'Touches', options: [['avec', 'Avec touches'], ['sans', 'Sans touche'], ['pb', 'Avec un problème']], test: (e, v) => v === 'avec' ? (e.blfs || []).length > 0 : v === 'sans' ? !(e.blfs || []).length : !!issBy[e.number]}],
    cols: [{h: 'Poste', v: e => e.number, cls: 'mono'}, {h: 'Nom', v: e => (e.first + ' ' + e.last).trim()}, {h: 'Magasin', v: e => SEGOF[e.number] || '', f: e => esc(segShort(SEGOF[e.number] || SEG_COMMON))},
      {h: 'Touches', num: 1, v: e => (e.blfs || []).filter(b => b.type !== 'None').length},
      {h: 'BLF', num: 1, v: e => (e.blfs || []).filter(b => b.type === 'BLF').length}, {h: 'Parking', num: 1, v: e => (e.blfs || []).filter(b => b.type === 'SharedParking').length},
      {h: 'Rapides', num: 1, v: e => (e.blfs || []).filter(b => /SpeedDial/.test(b.type)).length},
      {h: 'Surveillé par', num: 1, v: e => (A.watchers[e.number] || []).size},
      {h: 'Problèmes', num: 1, v: e => (issBy[e.number] || []).length, f: e => issBy[e.number] ? `<span class="pill ${issBy[e.number].some(i => i.k === 'gone') ? 'bad' : 'warn'}">${issBy[e.number].length}</span>` : ''}],
    onRow: e => showExt(e)});
};
// fiche d'un poste : touches programmées et qui le surveille
let BLF_DN = null;
openDrawer = (orig => (title, html, ...rest) => { if(BLF_DN){ const e = EXT_BY[BLF_DN];
  if(e && e.blfs){ const w = [...(blfAnalysis().watchers[e.number] || [])].sort(), is = blfAnalysis().issues.filter(i => i.e === e);
    html += `<h3>Touches programmées (${e.blfs.filter(b => b.type !== 'None').length})</h3>${blfKeysHTML(e)}${is.length ? `<div class="ubw" style="margin-top:8px">${is.map(i => esc(i.t)).join('<br>')}</div>` : ''}<h3>Surveillé par ${w.length} téléphone${w.length > 1 ? 's' : ''}</h3>${w.map(n => dnLink(n)).join(' · ') || '<span class="muted">Personne</span>'}`; } }
  return orig(title, html, ...rest); })(openDrawer);
showExt = (f => function(o){ BLF_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ BLF_DN = null; } })(showExt);

