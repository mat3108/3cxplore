// ---------- Téléphones : inventaire et firmware (référence officielle 3CX) ----------
const fwPrefix = f => String(f || '').split(/[-_]/)[0];
const fwVersion = f => String(f || '').replace(/^[^-_]*[-_]/, '').replace(/\.(rom|z|bin|img|zip)$/i, '');
const verCmp = (a, b) => { const x = String(a).split(/\D+/).filter(Boolean).map(Number), y = String(b).split(/\D+/).filter(Boolean).map(Number);
  for(let i = 0; i < Math.max(x.length, y.length); i++){ const d = (x[i]||0) - (y[i]||0); if(d) return d < 0 ? -1 : 1; } return 0; };
const modelKey = m => String(m || '').toLowerCase().replace(/\bdoor-?phone\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Référence 3CX : la plus récente entre la liste intégrée, le fichier du script et un copier-coller mémorisé
const FW_REF_KEY = 'fw3cx-colle';
function fwRefs(){
  const out = [FW_3CX_REF];
  if(window.FW_3CX_FILE && Array.isArray(window.FW_3CX_FILE.list)) out.push(window.FW_3CX_FILE);
  try{ const p = JSON.parse(localStorage.getItem(FW_REF_KEY) || 'null'); if(p && Array.isArray(p.list)) out.push(p); }catch(e){}
  return out;
}
const FW_REF = fwRefs().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : ({colle:0, script:1, integree:2}[a.source] - {colle:0, script:1, integree:2}[b.source])))[0];
const FW_REC = {}; // clé modèle -> {model, version, file, url}
FW_REF.list.forEach(([model, version, file, desc, url]) => { const k = modelKey(model); if(!FW_REC[k]) FW_REC[k] = {model, version, file, desc, url}; });
const recFor = model => FW_REC[modelKey(model)] || null;
const FW_SRC_FR = {integree: 'liste intégrée à l\'interface', script: 'téléchargée par verifier-firmwares.command', colle: 'collée depuis la page 3CX'};

// Firmwares présents sur le serveur 3CX (backup)
const FW_SERVER = (FULL.firmwares || []).map(f => f.file);
const serverFor = model => { const r = recFor(model); const pre = r ? fwPrefix(r.file) : null;
  const cands = FW_SERVER.filter(f => pre ? fwPrefix(f) === pre : false); return cands.sort((a, b) => verCmp(fwVersion(b), fwVersion(a)))[0] || ''; };

const PH_ST = {old:{l:'À mettre à jour', c:'bad'}, unk:{l:'Inconnu', c:'warn'}, prob:{l:'Probablement à jour', c:'acc'}, okv:{l:'À jour (vérifié)', c:'ok'}, ok:{l:'À jour', c:'ok'}, new:{l:'Plus récent que 3CX', c:'acc'}, nt:{l:'Modèle hors liste 3CX', c:''}};
const PH_ORDER = ['old', 'unk', 'prob', 'new', 'nt', 'okv', 'ok'];
const HAS_EVIDENCE = Array.isArray(FULL.fwErased) && Array.isArray(FULL.phoneUA);
const UA_BY = {}; (FULL.phoneUA || []).forEach(u => UA_BY[u[0]] = u);       // dernière version vue par MAC
const ERASED_BY = {}; (FULL.fwErased || []).forEach(e => ERASED_BY[e[0]] = e); // dernier effacement par MAC
function phoneRows(){
  const rows = [];
  D.extensions.forEach(e => e.devices.forEach(d => {
    const rec = recFor(d.model), srv = serverFor(d.model), mac = (d.mac || '').toUpperCase();
    const target = rec ? rec.version : (srv ? fwVersion(srv) : '');
    const ua = UA_BY[mac] || null, er = ERASED_BY[mac] || null;
    const cmp = v => target ? verCmp(v, target) : 0;
    let st, why = '';
    if(d.firmware){ // firmware assigné par 3CX
      if(!target) st = 'nt'; else { const c = cmp(fwVersion(d.firmware)); st = c < 0 ? 'old' : c > 0 ? 'new' : 'ok'; }
      why = 'Firmware assigné par 3CX : ' + fwVersion(d.firmware);
      if(ua && st === 'ok' && cmp(ua[2]) === 0){ st = 'okv'; why += ' — confirmé par le téléphone le ' + fmtD(ua[3]); }
    } else if(ua){ // version annoncée par le téléphone lors d'un appel
      const c = cmp(ua[2]); st = !target ? 'nt' : c < 0 ? 'old' : c > 0 ? 'new' : 'okv';
      why = `Version ${ua[2]} annoncée par le téléphone le ${fmtD(ua[3])} (rapport de qualité d'appel)`;
    } else if(er){ // firmware assigné puis effacé par une modification
      const c = cmp(fwVersion(er[1])); st = !target ? 'nt' : c < 0 ? 'old' : 'prob';
      why = `Firmware ${fwVersion(er[1])} assigné, puis effacé le ${fmtD(er[2])} par ${er[3]} (modification du téléphone)`;
    } else { st = 'unk'; why = 'Aucun firmware assigné et aucune version observée'; }
    rows.push({ext: e.number, user: (e.first + ' ' + e.last).trim(), model: d.model || d.template, mac: d.mac, fw: d.firmware,
      srv, rec: rec ? rec.version : '', st, why, ua, er, template: d.template, seg: SEGOF[e.number]});
  }));
  return rows;
}
function showPhone(r){
  openDrawer(`${esc(r.ext)} ${esc(r.user)} — ${esc(r.model)}`, kv([
    ['État', `<span class="pill ${PH_ST[r.st].c}">${PH_ST[r.st].l}</span>`], ['Explication', esc(r.why)],
    ['MAC', `<span class="mono">${esc(macFmt(r.mac))}</span>`], ['Firmware assigné', r.fw ? `<span class="mono">${esc(r.fw)}</span>` : '—'],
    ['Version vue sur le téléphone', r.ua ? `<span class="mono">${esc(r.ua[2])}</span> le ${fmtD(r.ua[3])}` : '—'],
    ['Firmware effacé', r.er ? `<span class="mono">${esc(r.er[1])}</span> le ${fmtD(r.er[2])} par ${esc(r.er[3])}` : '—'],
    ['Recommandé par 3CX', r.rec ? `<span class="mono">${esc(r.rec)}</span>` : '—'], ['Sur le serveur', r.srv ? `<span class="mono">${esc(r.srv)}</span>` : 'aucun'],
    ['Poste', dnLink(r.ext)], ['Gabarit', esc(r.template)],
  ]) + `<p class="note">« Version vue » provient des rapports de qualité d'appel enregistrés par 3CX (le téléphone y annonce sa version) ; seuls certains appels en génèrent. « Firmware effacé » provient du journal d'audit.</p>`);
}
// État du serveur par modèle présent dans le parc
function modelRows(rows){
  return [...new Set(rows.map(r => r.model))].sort().map(m => {
    const rec = recFor(m), srv = serverFor(m), rs = rows.filter(r => r.model === m);
    let st;
    if(!rec) st = 'nolist';
    else if(!Array.isArray(FULL.firmwares)) st = 'srvunk';
    else if(!srv) st = 'missing';
    else st = verCmp(fwVersion(srv), rec.version) < 0 ? 'srvold' : 'srvok';
    return {model: m, rec, srv, st, count: rs.length, rows: rs};
  });
}
const SRV_ST = {srvunk:{l:'Serveur non vérifié', c:'warn'}, srvok:{l:'Serveur à jour', c:'ok'}, missing:{l:'Firmware absent du serveur', c:'bad'}, srvold:{l:'Serveur en retard', c:'bad'}, nolist:{l:'Modèle hors liste 3CX', c:''}};
const macFmt = m => String(m || '').replace(/(..)(?!$)/g, '$1:');

// Analyse d'un copier-coller de la page 3CX (tableau Modèle / Version / Description / Download)
function parseFwPaste(txt){
  const list = [];
  String(txt).split(/\r?\n/).forEach(line => {
    const cells = line.split('\t').map(c => c.trim()).filter(Boolean);
    let m = null, v = null;
    if(cells.length >= 2 && /^\d+(\.\d+){2,}$/.test(cells[1])){ m = cells[0]; v = cells[1]; }
    else { const x = line.match(/^\s*([A-Za-z][A-Za-z0-9 +\-]*?)\s+(\d+(?:\.\d+){2,5})\b/); if(x){ m = x[1]; v = x[2]; } }
    if(m && v && /yealink|fanvil|snom|grandstream|gigaset|htek|alcatel|cisco|polycom|poly|aastra|mitel|panasonic|akuvox|2n/i.test(m) && !list.some(r => r[0] === m)) list.push([m, v, '', '', '']);
  });
  return list;
}
function fwSummary(){
  const rows = phoneRows(), mods = modelRows(rows), n = s => rows.filter(r => r.st === s).length;
  const bad = mods.filter(m => m.st === 'missing' || m.st === 'srvold');
  return `<div class="fwsum">
    <div class="grid kpis">${[['Téléphones', rows.length, ''], ['À mettre à jour', n('old'), 'bad'], ['Inconnu', n('unk'), 'warn'], ['Probablement à jour', n('prob'), ''], ['À jour', n('ok') + n('okv'), 'ok']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:20px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${!Array.isArray(FULL.firmwares) ? '<p class="pill warn" style="margin:10px 0 4px;white-space:normal">Ce backup a été chargé avec une version antérieure de l\'interface : la liste des firmwares présents sur le serveur est inconnue. Rechargez le .zip (« Choisir un backup ») pour vérifier le serveur.</p>' : ''}
    ${bad.length ? `<p style="margin:10px 0 4px"><b>Firmware recommandé absent du serveur :</b> ${bad.map(m => `${esc(m.model)} <span class="muted">(${m.count}, ${esc(m.rec.version)})</span>`).join(', ')}</p>` : (Array.isArray(FULL.firmwares) ? '<p class="muted" style="margin:10px 0 4px">Le serveur contient le firmware recommandé pour tous les modèles du parc.</p>' : '')}
    <p style="margin:4px 0 0"><a class="btn" href="#telephones" id="fwgo">Voir le détail dans l'onglet Téléphones</a></p></div>`;
}
function openFwCheck(){
  openDrawer('Vérifier les firmwares en ligne', `${fwSummary()}
    <p>La référence est la liste officielle <a class="dlink" href="https://www.3cx.com/docs/phone-firmwares/" target="_blank" rel="noopener">3CX — Phone firmwares</a> : un firmware testé et recommandé par 3CX pour chaque modèle.</p>
    <p class="muted" style="font-size:12.5px">Référence utilisée : <b>${esc(FW_REF.date)}</b>, ${esc(FW_SRC_FR[FW_REF.source] || FW_REF.source)} (${FW_REF.list.length} modèles).</p>
    <h3>Méthode 1 — Script (recommandée)</h3>
    <ol class="steps"><li>Double-cliquez sur <b class="mono">verifier-firmwares.command</b> : dans le dossier <span class="mono">scripts</span> du projet, ou à côté de la page dans le paquet de partage.</li>
      <li>Il télécharge la liste 3CX et crée <span class="mono">firmwares-3cx.js</span> à côté de la page (dossier <span class="mono">app</span> du projet).</li>
      <li>Rechargez cette page : la nouvelle liste est utilisée automatiquement.</li></ol>
    <p class="muted" style="font-size:12.5px">La première fois, macOS peut demander une confirmation : clic droit sur le fichier → Ouvrir.</p>
    <h3>Méthode 2 — Copier-coller</h3>
    <ol class="steps"><li><a class="btn" href="https://www.3cx.com/docs/phone-firmwares/" target="_blank" rel="noopener">Ouvrir la page 3CX</a></li>
      <li>Sur la page 3CX : Cmd + A (tout sélectionner), puis Cmd + C (copier).</li>
      <li>Collez ici puis cliquez sur « Analyser » :</li></ol>
    <textarea id="fwpaste" class="rnote" rows="6" placeholder="Collez ici le contenu de la page 3CX…"></textarea>
    <div style="margin-top:8px"><button class="btn primary" id="fwparse">Analyser</button> ${(() => { try{ return localStorage.getItem(FW_REF_KEY) ? '<button class="btn" id="fwforget">Oublier la liste collée</button>' : ''; }catch(e){ return ''; } })()}</div>
    <div id="fwmsg" class="bkst"></div>`);
  const go = $('#fwgo'); if(go) go.addEventListener('click', () => closeDrawer());
  $('#fwparse').addEventListener('click', () => {
    const list = parseFwPaste($('#fwpaste').value), msg = $('#fwmsg');
    if(list.length < 20){ msg.className = 'bkst err'; msg.textContent = `Seulement ${list.length} modèle(s) reconnu(s) : copiez bien toute la page 3CX (Cmd + A puis Cmd + C).`; return; }
    try{ localStorage.setItem(FW_REF_KEY, JSON.stringify({date: new Date().toLocaleDateString('fr-CA'), source: 'colle', list})); }catch(e){}
    msg.className = 'bkst'; msg.textContent = `${list.length} modèles reconnus. Mise à jour de l'affichage…`;
    setTimeout(() => { closeDrawer(); BK.rerun(); }, 600);
  });
  const fg = $('#fwforget'); if(fg) fg.addEventListener('click', () => { try{ localStorage.removeItem(FW_REF_KEY); }catch(e){} closeDrawer(); BK.rerun(); });
}

V.telephones = el => {
  const rows = phoneRows(), n = s => rows.filter(r => r.st === s).length, mods = modelRows(rows);
  const age = Math.round((Date.now() - Date.parse(FW_REF.date)) / 86400000);
  el.innerHTML = `<div id="pwrap"><h2>Téléphones</h2>
  <p class="lead">Inventaire des téléphones provisionnés et état de leur firmware, comparé à la version recommandée par 3CX pour chaque modèle. Sans firmware assigné, l'état est déduit de deux indices : la version annoncée par le téléphone dans les rapports de qualité d'appel (« À jour (vérifié) ») et un firmware assigné puis effacé par une modification (« Probablement à jour »). Cliquez sur un téléphone pour le détail. Le firmware affiché pour un téléphone est celui que 3CX lui a assigné ; vide si aucun n'est assigné (téléphone jamais mis à jour par 3CX, ou firmware effacé lors d'une modification du téléphone dans la console).</p>
  <div class="card fwref"><div><div class="bkt">Référence 3CX</div><b>Liste du ${esc(FW_REF.date)}</b> <span class="muted">· ${esc(FW_SRC_FR[FW_REF.source] || FW_REF.source)} · ${FW_REF.list.length} modèles${age > 30 ? ` · <span style="color:var(--warn)">datée de ${age} jours</span>` : ''}</span></div>
    <button class="btn primary" id="fwcheck">Vérifier en ligne</button></div>
  ${HAS_EVIDENCE ? '' : '<p class="segbar">Ce backup a été chargé avec une version antérieure de l\'interface : les indices « version vue » et « firmware effacé » ne sont pas disponibles. Rechargez le .zip pour les obtenir.</p>'}
  <div class="grid kpis">${[['Téléphones', rows.length, ''], ['À mettre à jour', n('old'), 'bad'], ['Inconnu', n('unk'), 'warn'], ['Probablement à jour', n('prob'), ''], ['À jour', n('ok') + n('okv'), 'ok'], ['Modèles sans firmware sur le serveur', mods.filter(m => m.st === 'missing' || m.st === 'srvold').length, 'bad']]
    .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
  ${!Array.isArray(FULL.firmwares) ? '<p class="segbar">Ce backup a été chargé avec une version antérieure de l\'interface : les firmwares présents sur le serveur ne sont pas connus. Rechargez le .zip avec « Choisir un backup » pour vérifier le serveur.</p>' : ''}
  <h3>Par modèle</h3>
  <div class="tw"><table><thead><tr><th>Modèle</th><th class="num">Téléphones</th><th>Recommandé par 3CX</th><th>Sur le serveur</th><th>Serveur</th><th>Téléphones</th><th></th></tr></thead><tbody>
  ${mods.map(m => `<tr><td><b>${esc(m.model)}</b></td><td class="num">${m.count}</td>
    <td class="mono">${m.rec ? esc(m.rec.version) : '<span class="muted">—</span>'}</td>
    <td class="mono">${m.srv ? esc(fwVersion(m.srv)) : '<span class="muted">aucun</span>'}</td>
    <td><span class="pill ${SRV_ST[m.st].c}">${SRV_ST[m.st].l}</span></td>
    <td>${Object.keys(PH_ST).filter(s => m.rows.some(r => r.st === s)).map(s => `<span class="pill ${PH_ST[s].c}">${PH_ST[s].l} : ${m.rows.filter(r => r.st === s).length}</span>`).join('')}</td>
    <td>${m.rec && m.rec.url && (m.st === 'missing' || m.st === 'srvold') ? `<a class="dlink" href="${esc(m.rec.url)}" target="_blank" rel="noopener" title="Fichier officiel 3CX">Télécharger ${esc(m.rec.file)}</a>` : ''}</td></tr>`).join('')}
  </tbody></table></div>
  ${mods.some(m => m.st === 'missing' || m.st === 'srvold') ? `<p class="note">Pour les modèles « Firmware absent du serveur » ou « Serveur en retard », 3CX télécharge normalement le firmware recommandé lors de l'action « Mettre à jour le firmware » (console 3CX → Téléphones) ; le lien permet de récupérer le fichier officiel au besoin.</p>` : ''}
  <h3>Liste des téléphones</h3>
  <div id="pt"></div>
  <p class="note">Rappel : modifier un téléphone dans la console 3CX sans resélectionner son firmware efface le firmware assigné. Après une modification, relancez « Mettre à jour le firmware ».</p></div>`;
  $('#fwcheck').addEventListener('click', openFwCheck);
  table($('#pt'), {
    rows, pageSize: 60, sort: [6, 1],
    search: r => [r.ext, r.user, r.model, r.mac, macFmt(r.mac), r.fw, r.template, segName(r.seg)].join(' '),
    filters: [
      {label: 'Tous les états', options: [['todo', 'À mettre à jour ou inconnu'], ['uptodate', 'À jour (assigné ou vérifié)'], ...PH_ORDER.map(k => [k, PH_ST[k].l])], test: (r, v) => v === 'todo' ? (r.st === 'old' || r.st === 'unk') : v === 'uptodate' ? (r.st === 'ok' || r.st === 'okv') : r.st === v},
      {label: 'Tous les modèles', options: [...new Set(rows.map(r => r.model))].sort().map(m => [m, m]), test: (r, v) => r.model === v},
      {label: 'Tous les gabarits', options: [...new Set(rows.map(r => r.template))].sort().map(m => [m, m]), test: (r, v) => r.template === v},
    ],
    cols: [
      {h: 'Poste', v: r => r.ext, f: r => dnLink(r.ext, true)},
      {h: 'Modèle', v: r => r.model},
      {h: 'MAC', v: r => r.mac, f: r => `<span class="mono">${esc(macFmt(r.mac))}</span>`},
      {h: 'Firmware assigné', v: r => r.fw, f: r => r.fw ? `<span class="mono">${esc(fwVersion(r.fw))}</span>` : (r.er ? `<span class="muted" title="Effacé le ${esc(fmtD(r.er[2]))} par ${esc(r.er[3])}">effacé (${esc(fwVersion(r.er[1]))})</span>` : '<span class="muted">—</span>')},
      {h: 'Version vue', v: r => r.ua ? r.ua[2] : '', f: r => r.ua ? `<span class="mono" title="Annoncée le ${esc(fmtD(r.ua[3]))}">${esc(r.ua[2])}</span>` : '<span class="muted">—</span>'},
      {h: 'Recommandé 3CX', v: r => r.rec, f: r => r.rec ? `<span class="mono">${esc(r.rec)}</span>` : '<span class="muted">—</span>'},
      {h: 'État', v: r => PH_ORDER.indexOf(r.st), f: r => `<span class="pill ${PH_ST[r.st].c}" title="${esc(r.why)}">${PH_ST[r.st].l}</span>`},
      {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'},
      {h: 'Gabarit', v: r => r.template, cls: 'muted'},
    ],
    onRow: showPhone,
  });
  const fs = $('#pt select[data-f="0"]'); if(fs && (n('old') + n('unk'))){ fs.value = 'todo'; fs.dispatchEvent(new Event('change')); }
  $('#pt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="pexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#pexp').addEventListener('click', () => {
    const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Utilisateur', 'Magasin', 'Modèle', 'MAC', 'Firmware assigné', 'Version vue', 'Vue le', 'Firmware effacé', 'Effacé le', 'Effacé par', 'Sur le serveur', 'Recommandé 3CX', 'État', 'Explication', 'Gabarit']]
      .concat(rows.map(r => [r.ext, r.user, segShort(r.seg), r.model, macFmt(r.mac), r.fw, r.ua?.[2] || '', r.ua ? fmtD(r.ua[3]) : '', r.er?.[1] || '', r.er ? fmtD(r.er[2]) : '', r.er?.[3] || '', r.srv, r.rec, PH_ST[r.st].l, r.why, r.template]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = 'telephones-3cx.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
};

