// ---------- Corrections par usager (18.4) : ce qu'il faut corriger sur le poste de chaque employé, à cocher et à imprimer pour le technicien ----------
// même liste que « À corriger sur son poste » de la Fiche employé (fonction commune) ; état « fait » mémorisé par backup
const COR_KEY = () => 'corrections3cx:' + (FULL.info.fqdn || '') + '|' + (FULL.info.date || '');
const COR_VM = {off: "Activer la messagerie du poste, ou changer les acheminements qui y mènent.", nomail: "Corriger le courriel du poste (ou le serveur courriel) pour que les messages soient envoyés.",
  offown: "Changer le renvoi du profil vers une destination active, ou activer la messagerie.", old: "Écouter et supprimer les anciens messages.",
  nocheck: "Montrer à l'employé comment consulter sa messagerie, ou activer l'envoi par courriel.", nogreet: "Enregistrer une annonce personnalisée."};
const COR_DBL = {cidother: "Mettre comme numéro présenté un SDA de son magasin.", cidnone: "Mettre comme numéro présenté un SDA du système.", samemobile: "Vérifier le cellulaire saisi sur chaque poste.",
  samemail: "Garder le courriel sur un seul poste.", samename: "Vérifier qu'il s'agit bien de deux personnes, sinon retirer le poste en trop.", macdup: "Garder le téléphone sur un seul poste."};
const COR_PK = {autre: "Retirer la touche du parking d'un autre magasin.", usage: "Utiliser les parkings de son magasin.", horsplan: "Retirer la touche hors plan, ou l'ajouter au plan des parkings.", manque: "Ajouter les touches de parking du magasin."};
// contexte calculé une fois pour tous les postes (messageries, doublons, plan des parkings)
function corCtx(){
  const X = {vm: {}, dbl: [], pku: {}};
  try{ vmAnalysis().rows.forEach(r => X.vm[r.n] = r); }catch(e){}
  try{ X.dbl = dblAnalysis(); }catch(e){}
  try{ const pl = pkpLoad(); if(Object.keys(pl).length) pkpUsers(pkpAnalysis(pl), pl).forEach(u => X.pku[u.n] = u); }catch(e){}
  return X;
}
// corrections d'un poste : {id, cat, text, sev, href, fix}
function empIssues(E, X){
  X ||= corCtx(); const out = [], add = (cat, text, sev, href, fix) => out.push({id: cat + '|' + text, cat, text, sev, href, fix});
  const v = X.vm[E.number]; if(v) v.flags.filter(f => f !== 'ok').forEach(f => add('Messagerie vocale', VM_FLAG[f][0], VM_FLAG[f][1], '#messageries', COR_VM[f] || ''));
  X.dbl.filter(x => x.items.includes(E.number)).forEach(x => add('Doublons', `${DBL_K[x.k][0]} — ${x.detail}`, x.sev, '#doublons', COR_DBL[x.k] || "Voir l'onglet Doublons et incohérences."));
  const u = X.pku[E.number]; if(u) u.probs.forEach(k => add('Parkings', PKU_PB[k][0] + (k === 'autre' ? ` : ${pkFmt(u.rem.map(x => x.v))}` : k === 'manque' ? ` : ajouter ${pkFmt(u.addk)}` : ''), PKU_PB[k][1], '#pkplan', COR_PK[k] || ''));
  (E.blfs || []).filter(b => b.type === 'BLF' && b.v && (!DN[b.v] || (EXT_BY[b.v] && !EXT_BY[b.v].enabled))).forEach(b => add('Touches BLF', `Touche ${b.no} vers ${b.v} ${DN[b.v] ? '(poste désactivé)' : '(poste inexistant)'}`, 'warn', '#blf', 'Retirer la touche, ou la faire pointer vers un poste actif.'));
  const ext = []; E.profiles.forEach(p => p.routes.forEach(([k, d]) => { if(d.to === 'External' && d.ext) ext.push(`${FWD_ST && FWD_ST[p.name] || p.name} → ${phone(d.ext) || d.ext}`); }));
  if(ext.length) add('Renvois externes', [...new Set(ext)].slice(0, 4).join(' · '), '', '#renvois', "Vérifier avec l'employé que ce renvoi vers l'extérieur est voulu.");
  E.devices.filter(d => phLangBad(d.lang)).forEach(d => add('Téléphone', `${d.model || d.template || 'Téléphone'} en ${phLang(d.lang)}`, 'bad', '#telephones', 'Dans la console 3CX → Téléphones, choisir la langue Français pour ce téléphone, enregistrer puis reprovisionner.'));
  if(!E.enabled) out.unshift({id: 'Poste|Poste désactivé', cat: 'Poste', text: 'Poste désactivé', sev: 'bad', href: '#postes', fix: 'Réactiver le poste, ou le retirer des départements, files et touches qui le visent.'});
  return out;
}
V.corrections = el => {
  const S = window.__cor ||= {cat: '', hideDone: false, q: '', page: true};
  let done = {}; try{ done = JSON.parse(localStorage.getItem(COR_KEY()) || '{}'); }catch(e){}
  const keep = () => { try{ localStorage.setItem(COR_KEY(), JSON.stringify(done)); }catch(e){} };
  const X = corCtx(), nm = e => ((e.first || '') + ' ' + (e.last || '')).trim() || e.number, SEVO = {bad: 0, warn: 1, acc: 2, '': 3, ok: 4};
  const people = FULL.extensions.filter(e => !SEG || SEGOF[e.number] === SEG).map(e => ({e, list: empIssues(e, X)})).filter(p => p.list.length)
    .sort((a, b) => b.list.filter(x => x.sev === 'bad').length - a.list.filter(x => x.sev === 'bad').length || b.list.length - a.list.length || a.e.number.localeCompare(b.e.number, undefined, {numeric: true}));
  const cats = [...new Set(people.flatMap(p => p.list.map(x => x.cat)))].sort();
  const isDone = (p, x) => !!done[p.e.number + '|' + x.id];
  const shown = people.map(p => ({...p, view: p.list.filter(x => (!S.cat || x.cat === S.cat) && (!S.hideDone || !isDone(p, x))).sort((a, b) => (SEVO[a.sev] ?? 3) - (SEVO[b.sev] ?? 3))}))
    .filter(p => p.view.length && (!S.q || (p.e.number + ' ' + nm(p.e)).toLowerCase().includes(S.q.toLowerCase())));
  const tot = people.reduce((a, p) => a + p.list.length, 0), nDone = people.reduce((a, p) => a + p.list.filter(x => isDone(p, x)).length, 0), nBad = people.reduce((a, p) => a + p.list.filter(x => x.sev === 'bad').length, 0);
  const SEVL = {bad: 'Important', warn: 'À vérifier', acc: 'À ajouter', '': 'Information'};
  const card = p => `<section class="rps corp${S.page ? ' corpg' : ''}"><h2>${esc(p.e.number)} — ${esc(nm(p.e))} <span class="muted" style="font-size:.7em;font-weight:400">${esc(segShort(SEGOF[p.e.number] || SEG_COMMON))} · ${nf(p.list.length)} correction${p.list.length > 1 ? 's' : ''}</span></h2>
    <p class="noprint" style="margin:0 0 6px"><a href="#employe/${esc(p.e.number)}">Fiche employé</a> · <a href="#" class="dn" data-dn="${esc(p.e.number)}">Fiche du poste</a></p>
    <table class="rpt cort"><thead><tr><th style="width:44px">Fait</th><th>Sujet</th><th>Constat</th><th>À faire</th></tr></thead><tbody>
    ${p.view.map(x => { const k = p.e.number + '|' + x.id, d = !!done[k]; return `<tr class="${d ? 'cordone' : ''}"><td><input type="checkbox" class="corck" data-k="${esc(k)}"${d ? ' checked' : ''} aria-label="Fait"></td>
      <td><span class="pill ${x.sev || ''}" style="white-space:normal">${esc(x.cat)}</span><div class="muted" style="font-size:11px">${esc(SEVL[x.sev] || SEVL[''])}</div></td><td>${esc(x.text)}</td><td>${esc(x.fix || '')} <a class="noprint" href="${esc(x.href)}">ouvrir ▸</a></td></tr>`; }).join('')}</tbody></table></section>`;
  el.innerHTML = `<div id="corwrap"><div class="noprint"><h2>Corrections par usager</h2>
    <p class="lead">Ce qu'il faut corriger sur le poste de chaque employé (poste désactivé, messagerie vocale, doublons, parkings, touches, renvois externes), avec ce qu'il faut faire : à cocher au fur et à mesure et à imprimer pour le technicien${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Même liste que dans la Fiche employé.</p>
    <div class="grid kpis">${[['Employés à corriger', nf(people.length)], ['Corrections', nf(tot)], ['Importantes', nf(nBad)], ['Faites', `${nf(nDone)} sur ${nf(tot)}`]].map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:20px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="bar"><input type="search" id="corq" placeholder="Employé ou poste…" value="${esc(S.q)}"><select id="corcat"><option value="">Tous les sujets</option>${cats.map(c => `<option${c === S.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label class="tourtgl"><input type="checkbox" id="corhide"${S.hideDone ? ' checked' : ''}> Masquer les corrections faites</label><label class="tourtgl"><input type="checkbox" id="corpage"${S.page ? ' checked' : ''}> Une page par employé à l'impression</label>
      <span style="flex:1"></span><button class="btn" id="corprint">Imprimer / PDF</button><button class="btn" id="corxl">Exporter en Excel</button></div></div>
    <div class="report" id="corsheet"><header class="rpcover"><div class="rpk">Corrections par usager · 3CXplore</div><h1>${esc(SEG ? segName(SEG) : 'Tous les magasins')}</h1>
      <div class="rpmeta">${nf(shown.length)} employé${shown.length > 1 ? 's' : ''} · backup du ${esc(bkDate(FULL.info.date))} · préparé le ${esc(new Date().toLocaleDateString('fr-CA', {timeZone: TZ}))}</div></header>
    ${shown.length ? shown.map(card).join('') : `<p class="muted">${people.length ? 'Aucune correction avec ces filtres.' : 'Rien à corriger sur les postes de ce magasin.'}</p>`}</div></div>`;
  const re = () => V.corrections(el);
  $('#corq').addEventListener('input', e => { S.q = e.target.value; clearTimeout(window.__corT); window.__corT = setTimeout(() => { re(); const q = $('#corq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
  $('#corcat').addEventListener('change', e => { S.cat = e.target.value; re(); });
  $('#corhide').addEventListener('change', e => { S.hideDone = e.target.checked; re(); });
  $('#corpage').addEventListener('change', e => { S.page = e.target.checked; re(); });
  el.querySelectorAll('.corck').forEach(c => c.addEventListener('change', e => { const k = e.target.dataset.k; if(e.target.checked) done[k] = new Date().toISOString(); else delete done[k]; keep(); if(S.hideDone) re(); else { e.target.closest('tr').classList.toggle('cordone', e.target.checked); } }));
  $('#corprint').addEventListener('click', () => printHTML($('#corsheet').outerHTML.replace('id="corsheet"', '')));
  $('#corxl').addEventListener('click', () => {
    const rows = [['Poste', 'Nom', 'Magasin', 'Sujet', 'Gravité', 'Constat', 'À faire', 'Fait']];
    shown.forEach(p => p.view.forEach(x => rows.push([p.e.number, nm(p.e), segShort(SEGOF[p.e.number] || SEG_COMMON), x.cat, SEVL[x.sev] || SEVL[''], x.text, x.fix || '', done[p.e.number + '|' + x.id] ? 'oui' : ''])));
    const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build([{name: 'Corrections', rows}]).blob); a.download = `corrections-par-usager-${SEG ? segShort(SEG).replace(/[^\w-]+/g, '_') + '-' : ''}${new Date().toLocaleDateString('fr-CA', {timeZone: TZ})}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
};
