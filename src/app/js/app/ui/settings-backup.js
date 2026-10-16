// ---------- Sauvegarde complète des réglages ----------
const SET_CATS = [
  ['seg3cx:', 'Magasins : noms, type Magasin / Commun, corrections d\'attribution'], ['segsel3cx:', 'Magasin sélectionné dans le bandeau'],
  ['objectifs3cx:', 'Objectifs par défaut et par magasin'], ['suivi3cx:', 'Historique du suivi dans le temps'],
  ['notes3cx:', 'Recommandations : statuts, notes et observations manuelles'], ['actions3cx:', 'Actions console : tâches cochées'], ['corrections3cx:', 'Corrections par usager : corrections cochées'],
  ['rappels3cx:', 'Appels manqués : clients marqués « traité »'], ['fw3cx-colle', 'Liste des firmwares 3CX collée'],
  ['stats3cx-periode', 'Période choisie (Statistiques, Agents, Horaires…)'], ['rapport3cx-sections', 'Sections du rapport'],
  ['modifs3cx-periode', 'Période choisie dans Modifications'], ['simulateur3cx', 'Simulateur d\'appel : dernier SDA et heure'], ['palette3cx', 'Palette de commandes : derniers choix'], ['quoideneuf3cx:', 'Quoi de neuf : carte masquée pour ce backup'], ['feries3cx:', 'Jours fériés : jours non observés par l\'entreprise'], ['vip3cx:', 'Numéros importants : contacts suivis et objectifs de rappel'], ['absences3cx:', 'Absences et congés : absences prévues'], ['rappellentexc3cx:', 'Clients qui rappellent : numéros d\'exception'], ['couts3cx:', 'Coût des appels sortants : tarifs et facturation'], ['pkplan3cx:', 'Plan des parkings : parkings attribués à chaque magasin'], ['rappellent3cx', 'Clients qui rappellent : délai et options'], ['theme3cx', 'Thème clair / sombre'], ['apparence3cx', 'Interface : thème, couleur, densité, texte, coins, cartes, police, largeur, onglet d\'accueil, animations, style du menu'], ['navgroupes3cx', 'Menu : groupes repliés'], ['nav3cx', 'Menu latéral réduit'],
];
const setCat = k => SET_CATS.find(([p]) => k === p || k.startsWith(p));
function setKeys(){ const out = []; try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(setCat(k)) out.push(k); } }catch(e){} return out.sort(); }
const setDesc = k => { const c = setCat(k); const extra = k.slice(c[0].length); return extra ? `${c[1]} — ${extra.replace(/\|/, ' · backup du ')}` : c[1]; };
function setCount(k, v){ try{ const j = JSON.parse(v);
  if(k.startsWith('suivi3cx:')) return `${j.length} point${j.length > 1 ? 's' : ''}`;
  if(k.startsWith('notes3cx:')) return `${Object.keys(j.status || {}).length} statuts, ${Object.keys(j.text || {}).length} notes, ${(j.custom || []).length} observations`;
  if(k.startsWith('actions3cx:')) return `${Object.keys(j.done || {}).length} tâches faites`;
  if(k.startsWith('rappels3cx:')) return `${Object.keys(j).length} clients traités`;
  if(k.startsWith('pkplan3cx:')) return `${Object.keys(j.plan || {}).length} magasin(s)`;
  if(k.startsWith('couts3cx:')) return `${Object.values(j.t || {}).filter(t => t && (t.m || t.a)).length} tarif(s)`;
  if(k.startsWith('rappellentexc3cx:')) return `${(j.list || []).length} numéro(s)`;
  if(k.startsWith('absences3cx:')) return `${(j.list || []).length} absence(s)`;
  if(k.startsWith('vip3cx:')) return `${(j.contacts || []).length} contact(s)`;
  if(k.startsWith('seg3cx:')) return `${Object.keys(j.names || {}).length} noms, ${Object.keys(j.overrides || {}).length} corrections`;
  if(k.startsWith('objectifs3cx:')) return `${Object.keys(j.seg || {}).length} magasin(s) avec objectifs propres`;
  if(k.startsWith('rapport3cx-sections')) return `${j.length} sections cochées`;
  if(k.startsWith('stats3cx-periode')) return ({'7': '7 derniers jours', '30': '30 derniers jours', '90': '90 derniers jours', all: 'tout l\'historique', custom: `du ${j.from} au ${j.to}`})[j.mode] || j.mode;
}catch(e){}
  if(k.startsWith('segsel3cx:')) return v ? segShort(v) : 'Tous les magasins';
  if(k === 'nav3cx') return v === 'mini' ? 'réduit' : 'déplié';
  if(k === 'theme3cx') return v === 'dark' ? 'sombre' : v === 'light' ? 'clair' : 'automatique';
  return v.length > 40 ? v.length + ' caractères' : v; }

V.reglages = el => {
  const keys = setKeys();
  el.innerHTML = `<div id="stwrap"><h2>Sauvegarde des réglages</h2>
    <p class="lead">Tout ce que vous avez saisi dans l'interface est conservé dans ce navigateur. Exportez-le dans un seul fichier pour le sauvegarder, changer de poste ou le partager avec un collègue, puis importez-le sur l'autre poste. Les backups eux-mêmes (fichiers .zip) ne sont pas inclus : rechargez-les sur l'autre poste.</p>
    <h3>Réglages présents dans ce navigateur (${keys.length})</h3>
    ${keys.length ? `<div class="tw"><table><thead><tr><th><input type="checkbox" id="stall" checked></th><th>Réglage</th><th>Contenu</th></tr></thead><tbody>
      ${keys.map(k => { let v = ''; try{ v = localStorage.getItem(k) || ''; }catch(e){} return `<tr><td><input type="checkbox" class="stk" data-k="${esc(k)}" checked></td><td>${esc(setDesc(k))}</td><td class="muted">${esc(setCount(k, v))}</td></tr>`; }).join('')}</tbody></table></div>
      <p><button class="btn primary" id="stexp">Exporter les réglages cochés</button></p>` : '<p class="muted">Aucun réglage enregistré pour l\'instant.</p>'}
    <h3>Importer des réglages</h3>
    <p><label class="btn">Choisir un fichier de réglages (.json)<input type="file" id="stimp" accept=".json,application/json" hidden></label></p>
    <div id="stprev"></div></div>`;
  const all = $('#stall'); if(all) all.addEventListener('change', () => el.querySelectorAll('.stk').forEach(c => c.checked = all.checked));
  const ex = $('#stexp'); if(ex) ex.addEventListener('click', () => {
    const data = {}; el.querySelectorAll('.stk:checked').forEach(c => { try{ data[c.dataset.k] = localStorage.getItem(c.dataset.k); }catch(e){} });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({type: 'reglages-visualiseur-3cx', version: 1, exported: new Date().toISOString(), system: FULL.info.fqdn, data}, null, 1)], {type: 'application/json'}));
    a.download = `reglages-3cx-${new Date().toLocaleDateString('fr-CA')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#stimp').addEventListener('change', async e => {
    const f = e.target.files[0]; if(!f) return; const pv = $('#stprev');
    let j; try{ j = JSON.parse(await f.text()); if(j.type !== 'reglages-visualiseur-3cx' || typeof j.data !== 'object') throw 0; }
    catch(er){ pv.innerHTML = '<p class="pill bad">Ce fichier n\'est pas un fichier de réglages du visualiseur.</p>'; return; }
    const ks = Object.keys(j.data).filter(setCat);
    pv.innerHTML = `<div class="card"><p>Fichier exporté le ${esc(fmtD(j.exported))}${j.system ? ` depuis le système ${esc(j.system)}` : ''} : ${ks.length} réglage(s).</p>
      <div class="tw"><table><thead><tr><th><input type="checkbox" id="stiall" checked></th><th>Réglage</th><th>Contenu</th><th>Ici</th></tr></thead><tbody>
      ${ks.map(k => { let cur = null; try{ cur = localStorage.getItem(k); }catch(er){} return `<tr><td><input type="checkbox" class="sti" data-k="${esc(k)}" checked></td><td>${esc(setDesc(k))}</td><td class="muted">${esc(setCount(k, j.data[k] || ''))}</td><td>${cur == null ? '<span class="pill ok">nouveau</span>' : cur === j.data[k] ? '<span class="pill">identique</span>' : `<span class="pill warn">${k.startsWith('suivi3cx:') ? 'fusionné' : 'remplacé'}</span>`}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">L'historique du suivi est fusionné (points ajoutés, sans doublon) ; les autres réglages cochés remplacent ceux de ce navigateur.</p>
      <button class="btn primary" id="stdo">Importer les réglages cochés</button> <span id="stmsg" class="bkst"></span></div>`;
    $('#stiall').addEventListener('change', ev => pv.querySelectorAll('.sti').forEach(c => c.checked = ev.target.checked));
    $('#stdo').addEventListener('click', () => {
      let n = 0;
      pv.querySelectorAll('.sti:checked').forEach(c => { const k = c.dataset.k, v = j.data[k]; if(v == null) return;
        try{
          if(k.startsWith('suivi3cx:')){ const cur = JSON.parse(localStorage.getItem(k) || '[]'), add = JSON.parse(v), ids = new Set(cur.map(p => p.id)); add.forEach(p => { if(!ids.has(p.id)) cur.push(p); }); cur.sort((a, b) => (a.iso || '') < (b.iso || '') ? -1 : 1); localStorage.setItem(k, JSON.stringify(cur)); }
          else localStorage.setItem(k, v);
          n++; }catch(er){} });
      $('#stmsg').textContent = `${n} réglage(s) importé(s). Mise à jour de l'affichage…`;
      setTimeout(() => { const t = localStorage.getItem('theme3cx'); if(window.applyTheme) window.applyTheme(t || ''); if(window.applyAppearance) window.applyAppearance(); document.body.classList.toggle('mini', localStorage.getItem('nav3cx') === 'mini'); BK.rerun(); }, 600);
    });
  });
};

if(!window.__runBatch){
  window.__runBatch = async (stores, orig) => {
    const ov = document.createElement('div'); ov.className = 'batchov'; document.body.appendChild(ov);
    const items = [];
    try{
      for(let i = 0; i < stores.length; i++){
        ov.innerHTML = `<div class="card"><b>Génération des rapports…</b><div class="muted">${i + 1} / ${stores.length}</div><div class="acpb" style="margin-top:8px"><span style="width:${100 * i / stores.length}%"></span></div></div>`;
        await new Promise(r => setTimeout(r, 30));
        if(location.hash.split('/')[0] !== '#rapport') history.replaceState(null, '', '#rapport');
        window.__app.setSeg(stores[i]);
        const rep = document.getElementById('report');
        if(rep) items.push({seg: stores[i], name: (document.querySelector('.rpcover h1') || {}).textContent || stores[i], html: rep.innerHTML});
      }
    } finally {
      window.__batchResult = {at: new Date().toISOString(), items};
      window.__app.setSeg(orig || '');
      ov.remove();
    }
  };
  window.__printBatch = () => {
    const R = window.__batchResult; if(!R) return;
    const box = document.createElement('div'); box.id = 'batchprint';
    box.innerHTML = R.items.map(x => `<article class="report batchrep">${x.html}</article>`).join('');
    document.body.appendChild(box); document.body.classList.add('printing-batch');
    window.print();
    setTimeout(() => { box.remove(); document.body.classList.remove('printing-batch'); }, 800);
  };
}
