// ---------- Modifications d'un magasin sur une période (journal d'audit) ----------
const MOD_TYPES = {'7': 'Poste', '14': 'Département', '16': "File d'attente", '17': 'Groupe de sonnerie', '25': 'Standard IVR', '30': 'Trunk', '33': 'Règle sortante',
  '45': 'Fichier audio', '46': 'Liste de blocage IP', '59': 'Enregistrement', '81': 'Jour férié', '1009': 'Paramètre système', '1012': 'Microsoft 365', '1017': 'Modèle de téléphone', '86': 'Mise à jour 3CX'};
const modType = a => MOD_TYPES[a[2]] || 'Autre (type ' + a[2] + ')';
const MOD_GNAME = {}; FULL.groups.filter(g => !isSysGroup(g)).forEach(g => { MOD_GNAME[gsNorm(g.name).trim()] = g.number; });
const MOD_EXTNAME = {}; FULL.extensions.forEach(e => { const k = gsNorm((e.first + ' ' + e.last).trim()); if(k) MOD_EXTNAME[k] = e.number; });
let MOD_OBJSTR = null; // pour les fichiers audio : éléments (menus, files, départements…) qui utilisent le fichier
const modObjStr = () => MOD_OBJSTR ||= [...FULL.ivrs, ...FULL.queues, ...FULL.ringGroups, ...FULL.groups.filter(g => !isSysGroup(g)), ...FULL.extensions].map(o => [o.number, gsNorm(JSON.stringify(o))]);
const MOD_STORES = SEG_LIST.filter(s => s[0] !== '@');
const MOD_FULLNAMES = MOD_STORES.filter(c => SEGCFG.names[c]).map(c => [c, gsNorm(SEGCFG.names[c]).trim()]).filter(x => x[1].length > 3);
// magasin(s) concerné(s) par une entrée du journal : numéro de l'objet, nom de département, département d'un jour férié, code ou nom du magasin dans le nom
function auditSegs(a){
  const out = new Set(), name = String(a[4] || ''), add = s => { if(s) out.add(s); };
  name.split(',').forEach(p => { const t = p.trim().split(/[\s/]/)[0]; add(SEGOF[t] || SEGOF[MOD_EXTNAME[gsNorm(p).trim()]]); });
  if(a[2] === '45' && name.length > 4){ const f = gsNorm(name); modObjStr().forEach(([n, j]) => { if(j.includes(f)) add(SEGOF[n]); }); }
  add(SEGOF[MOD_GNAME[gsNorm(name).trim()]]);
  a[6].forEach(c => { if(c[0] === 'Group') add(SEGOF[String(c[1] || c[2]).replace(/"/g, '')]); });
  if(!out.size || [...out].every(s => s === SEG_COMMON)){
    name.split(/[\s_.,\/-]+/).forEach(t => { if(MOD_STORES.includes(t)) add(t); });
    const n = gsNorm(name); MOD_FULLNAMES.forEach(([c, f]) => { if(n.includes(f)) add(c); });
  }
  if(out.size > 1) out.delete(SEG_COMMON);
  if(!out.size) out.add(SEG_COMMON);
  return out;
}
let MOD_CACHE = null;
function modEntries(){
  if(MOD_CACHE) return MOD_CACHE;
  const fw = {}; (FULL.fwErased || []).forEach(f => { fw[f[2] + '|' + f[4]] = f[1]; });
  MOD_CACHE = (FULL.audit || []).filter(a => a[1] !== 'Connexion' && a[2] !== '59').map(a => ({a, day: dayKey(a[0]), segs: auditSegs(a), type: modType(a), fwErased: fw[a[0] + '|' + String(a[4]).split(' ')[0]] || null}));
  return MOD_CACHE;
}
const MOD_KEY = 'modifs3cx-periode';
V.modifs = el => {
  const all = modEntries();
  if(!all.length){ el.innerHTML = '<h2>Modifications</h2><p class="muted">Le journal d\'audit de ce backup ne contient aucune modification.</p>'; return; }
  const lastDay = all[0].day, firstDay = all[all.length - 1].day;
  let P = {}; try{ P = JSON.parse(localStorage.getItem(MOD_KEY) || '{}'); }catch(e){}
  P = {mode: P.mode || '30', from: P.from || '', to: P.to || '', seg: window.__modSeg != null ? window.__modSeg : SEG, common: !!P.common};
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDays(lastDay, -(+P.mode) + 1), lastDay];
  const save = () => { try{ localStorage.setItem(MOD_KEY, JSON.stringify({mode: P.mode, from: P.from, to: P.to, common: P.common})); }catch(e){} };
  el.innerHTML = `<div id="mdwrap"><h2>Modifications de la configuration</h2>
    <p class="lead">Ce qui a été créé, modifié ou supprimé dans la console 3CX pour un magasin, sur la période de votre choix : qui, quand, et la valeur avant et après de chaque champ (journal d'audit du backup, du ${firstDay} au ${lastDay}). Les connexions à la console et les actions sur les enregistrements d'appels sont dans l'onglet Journal d'audit.</p>
    <div class="bar"><label class="count">Magasin</label><select id="mdseg"><option value="">Tous les magasins</option>${SEG_LIST.filter(s => s !== SEG_BRIDGE).map(s => `<option value="${esc(s)}"${s === P.seg ? ' selected' : ''}>${esc(segShort(s))}</option>`).join('')}</select>
      <label class="count">Période</label><select id="mdpm">${[['1', 'Dernier jour'], ['7', '7 derniers jours'], ['30', '30 derniers jours'], ['90', '90 derniers jours'], ['all', 'Tout le journal'], ['custom', 'Dates au choix']].map(([v, l]) => `<option value="${v}"${P.mode === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <span id="mdc" ${P.mode === 'custom' ? '' : 'hidden'}><input type="date" id="mdf" value="${esc(P.from)}" min="${firstDay}" max="${lastDay}"> → <input type="date" id="mdt" value="${esc(P.to)}" min="${firstDay}" max="${lastDay}"></span>
      <label class="count" id="mdcl"><input type="checkbox" id="mdcom"${P.common ? ' checked' : ''}> inclure les changements communs à tout le système</label>
      <span class="count" id="mdrange"></span></div>
    <div id="mdbody"></div></div>`;
  function draw(){
    const [from, to] = range(), s = P.seg;
    $('#mdrange').textContent = `du ${from} au ${to}`;
    $('#mdcl').hidden = !s || s === SEG_COMMON;
    const rows = all.filter(r => r.day >= from && r.day <= to && (!s || r.segs.has(s) || (P.common && s !== SEG_COMMON && r.segs.has(SEG_COMMON))));
    const cnt = k => rows.filter(r => r.a[1] === k).length;
    const objs = new Set(rows.map(r => r.a[2] + '|' + r.a[4])).size;
    const byUser = {}, byType = {}, byDay = {};
    rows.forEach(r => { byUser[r.a[3] || '—'] = (byUser[r.a[3] || '—'] || 0) + 1; byType[r.type] = (byType[r.type] || 0) + 1; byDay[r.day] = (byDay[r.day] || 0) + 1; });
    const days = []; for(let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);
    const mx = Math.max(1, ...days.map(d => byDay[d] || 0)), W = 640, H = 90, bw = (W - 20) / Math.max(days.length, 1);
    const chart = days.length > 1 ? `<svg viewBox="0 0 ${W} ${H + 16}" style="width:100%;max-width:${W}px;height:auto">${days.map((d, i) => { const v = byDay[d] || 0, h = v ? Math.max(2, (H - 10) * v / mx) : 0;
        return `<rect x="${10 + i * bw + bw * 0.12}" y="${H - h}" width="${Math.max(1, bw * 0.76)}" height="${h}" rx="1.5" fill="var(--accent)"><title>${d} : ${v} modification${v > 1 ? 's' : ''}</title></rect>`; }).join('')}
        <text x="10" y="${H + 13}" font-size="10" fill="currentColor" opacity=".6">${from}</text><text x="${W - 10}" y="${H + 13}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${to}</text><text x="${W - 10}" y="10" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">max ${mx} / jour</text></svg>` : '';
    const pills = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill">${esc(k)} · ${nf(v)}</span>`).join('') || '<span class="muted">–</span>';
    const fwN = rows.filter(r => r.fwErased).length;
    $('#mdbody').innerHTML = `<p class="lead" style="margin-top:4px"><b>${esc(s ? segName(s) : 'Tous les magasins')}</b> · ${nf(rows.length)} changement${rows.length > 1 ? 's' : ''} du ${from} au ${to}</p>
      <div class="grid kpis">${[['Changements', nf(rows.length), ''], ['Créations', nf(cnt('Création')), 'ok'], ['Modifications', nf(cnt('Modification')), ''], ['Suppressions', nf(cnt('Suppression')), 'bad'], ['Éléments touchés', nf(objs), ''], ['Firmwares effacés', nf(fwN), fwN ? 'warn' : '']]
        .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      ${rows.length ? `${chart ? `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">Changements par jour</h3>${chart}</div>` : ''}
      <div class="grid two" style="margin-top:12px"><div class="card"><h3 style="margin-top:0">Par qui</h3>${pills(byUser)}</div><div class="card"><h3 style="margin-top:0">Quoi</h3>${pills(byType)}</div></div>
      <h3>Détail (${nf(rows.length)})</h3><div id="mdt2"></div>
      <p class="note">Cliquez une ligne pour voir chaque champ avant et après. Le magasin d'un changement est déduit du numéro ou du nom de l'élément (et du département pour les jours fériés) ; les changements sans magasin identifiable (trunks, paramètres, Microsoft 365…) sont « communs ». Les valeurs sensibles (mots de passe, clés) ne sont jamais affichées.</p>`
      : '<p class="muted" style="margin-top:12px">Aucun changement pour ce magasin sur cette période.</p>'}`;
    if(!rows.length) return;
    const fieldsTxt = r => r.a[6].map(c => c[0]).join(', ');
    table($('#mdt2'), {rows, pageSize: 100, state: (window.__modTable ||= {}),
      search: r => [r.a[1], r.type, r.a[3], r.a[4], fieldsTxt(r), ...r.a[6].map(c => c[1] + ' ' + c[2])].join(' '),
      filters: [{label: 'Toutes actions', options: [...new Set(rows.map(r => r.a[1]))].sort().map(x => [x, x]), test: (r, v) => r.a[1] === v},
                {label: 'Tous les types', options: [...new Set(rows.map(r => r.type))].sort().map(x => [x, x]), test: (r, v) => r.type === v},
                {label: 'Tous les utilisateurs', options: [...new Set(rows.map(r => r.a[3]))].sort().map(x => [x, x]), test: (r, v) => r.a[3] === v}],
      cols: [{h: 'Date', v: r => r.a[0], f: r => fmtD(r.a[0])},
        {h: 'Action', v: r => r.a[1], f: r => `<span class="pill ${r.a[1] === 'Suppression' ? 'bad' : r.a[1] === 'Création' ? 'ok' : r.a[1] === 'Modification' ? 'acc' : ''}">${esc(r.a[1])}</span>`},
        {h: 'Type', v: r => r.type, cls: 'muted'},
        {h: 'Élément', v: r => r.a[4], f: r => { const t = String(r.a[4]).split(/[\s,]/)[0]; return (DN[t] && !String(r.a[4]).includes(',') ? dnLink(t) : esc(String(r.a[4] || '—').slice(0, 160)) + (String(r.a[4]).length > 160 ? '…' : '')) + (!s ? `<div class="muted" style="font-size:11.5px">${[...r.segs].map(x => esc(segShort(x))).join(', ')}</div>` : ''); }},
        {h: 'Par', v: r => r.a[3]},
        {h: 'Champs modifiés', v: r => r.a[6].length, f: r => (r.fwErased ? '<span class="pill warn">Firmware effacé</span> ' : '') + `<span class="muted" style="font-size:12px">${esc(fieldsTxt(r).slice(0, 90))}${fieldsTxt(r).length > 90 ? '…' : ''}</span>`}],
      onRow: r => openDrawer(esc(r.a[1]) + ' · ' + esc(r.a[4] || r.type), kv([['Date', fmtD(r.a[0])], ['Par', esc(r.a[3])], ['IP', esc(r.a[5])], ['Type', esc(r.type)], ['Magasin', [...r.segs].map(x => esc(segName(x))).join(', ')]].concat(r.fwErased ? [['Firmware effacé', `<span class="pill warn">${esc(r.fwErased)} → aucun</span>`]] : [])) +
        (r.a[6].length ? `<h3>Changements</h3><div class="tw"><table><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>${r.a[6].map(c => `<tr><td><b>${esc(c[0])}</b></td><td class="mono" style="color:var(--bad)">${esc(c[1])}</td><td class="mono" style="color:var(--ok)">${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun détail de changement dans le journal.</p>'))});
    $('#mdt2 .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="mdexp" style="margin-left:auto">Exporter (CSV)</button>');
    $('#mdexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
      const out = [['Date', 'Action', 'Type', 'Élément', 'Magasin', 'Par', 'IP', 'Champ', 'Avant', 'Après']];
      rows.forEach(r => { const b = [fmtD(r.a[0]), r.a[1], r.type, r.a[4], [...r.segs].map(segShort).join(', '), r.a[3], r.a[5]]; if(r.a[6].length) r.a[6].forEach(c => out.push(b.concat(c))); else out.push(b.concat(['', '', ''])); });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
      a.download = `modifications-${s ? segShort(s).replace(/[^\w-]+/g, '_') : 'tous'}-${from}_${to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  }
  $('#mdseg').addEventListener('change', e => { P.seg = window.__modSeg = e.target.value; window.__modTable = {}; draw(); });
  $('#mdpm').addEventListener('change', e => { P.mode = e.target.value; $('#mdc').hidden = P.mode !== 'custom'; if(P.mode === 'custom'){ const [f, t] = range(); P.from ||= f; P.to ||= t; $('#mdf').value = P.from; $('#mdt').value = P.to; } save(); draw(); });
  $('#mdf').addEventListener('change', e => { P.from = e.target.value; save(); draw(); });
  $('#mdt').addEventListener('change', e => { P.to = e.target.value; save(); draw(); });
  $('#mdcom').addEventListener('change', e => { P.common = e.target.checked; save(); draw(); });
  draw();
};

