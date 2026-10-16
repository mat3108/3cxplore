  // ---------- Fermeture et effacement des données conservées dans le navigateur ----------
  const LS_GROUPS = {rappels: ['rappels3cx:'], notes: ['notes3cx:'],
    all: ['seg3cx:', 'segsel3cx:', 'objectifs3cx:', 'suivi3cx:', 'actions3cx:', 'corrections3cx:', 'fw3cx-colle', 'stats3cx-periode', 'rapport3cx-sections', 'modifs3cx-periode', 'simulateur3cx', 'quoideneuf3cx:', 'feries3cx:', 'vip3cx:', 'absences3cx:', 'rappellentexc3cx:', 'rappellent3cx', 'couts3cx:', 'pkplan3cx:', 'visite3cx', 'visiteauto3cx']};
  const lsKeys = g => { const out = []; try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(LS_GROUPS[g].some(p => k.startsWith(p))) out.push(k); } }catch(e){} return out; };
  const rappelsCount = () => lsKeys('rappels').reduce((a, k) => { try{ return a + Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length; }catch(e){ return a; } }, 0);
  const KEEP_WIN = ['__appListeners', '__runBatch', '__printBatch', '__app', '__recUrls', '__wnWired'];
  function wipeMemory(){
    const keep = k => KEEP_WIN.includes(k) || /Wired$/.test(k); // 18.2.21 : écouteurs branchés une seule fois
    AUDIO = {}; RECZIP = null;
    for(const k in urlCache){ URL.revokeObjectURL(urlCache[k]); delete urlCache[k]; }
    document.querySelectorAll('audio').forEach(a => { try{ a.pause(); a.removeAttribute('src'); a.load(); }catch(e){} });
    (window.__recUrls || []).forEach(u => URL.revokeObjectURL(u)); window.__recUrls = [];
    // rapports générés, recherches (numéros de clients), états des tableaux…
    Object.keys(window).filter(k => /^__/.test(k) && !keep(k)).forEach(k => { try{ delete window[k]; }catch(e){} if(window[k] !== undefined) window[k] = undefined; });
    const bp = document.getElementById('batchprint'); if(bp) bp.remove();
    document.querySelectorAll('input[type=file]').forEach(i => { try{ i.value = ''; }catch(e){} });
  }
  async function close(o = {}){
    const done = [];
    if(window.D) done.push('le backup ouvert');
    await clear();
    if(o.ref){
      await delKey('reference'); window.REF_D = null; done.push('le backup de référence');
      try{ const db = await idb(); await new Promise(res => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).clear(); t.oncomplete = res; t.onerror = res; }); db.close(); }catch(e){}
    }
    const lbl = {rappels: 'les numéros de clients marqués « traité »', notes: 'les notes et observations', all: 'les autres réglages'};
    ['rappels', 'notes', 'all'].forEach(g => { if(!o[g]) return; lsKeys(g).forEach(k => { try{ localStorage.removeItem(k); }catch(e){} }); done.push(lbl[g]); });
    wipeMemory(); done.push('la mémoire de la session');
    if(window.EMBEDDED) run(window.EMBEDDED); else emptyView();
    const st = $$('#bkst'); if(st){ st.className = 'bkst'; st.textContent = 'Effacé de ce navigateur : ' + done.join(', ') + '.'; }
  }
  function closeDialog(hasCurrent){
    const refThere = !!window.REF_D, nRap = rappelsCount(), hasNotes = lsKeys('notes').length, hasAll = lsKeys('all').length;
    const row = (id, label, sub, attr) => `<label class="clrow"><input type="checkbox" id="${id}" ${attr}><span><b>${label}</b><br><span class="muted" style="font-size:12.5px">${sub}</span></span></label>`;
    const ov = document.createElement('div'); ov.className = 'batchov';
    ov.innerHTML = `<div class="card clbox" role="dialog" aria-modal="true" aria-labelledby="clttl"><h3 id="clttl" style="margin-top:0">${hasCurrent ? 'Fermer le backup' : 'Effacer les données conservées'}</h3>
      <p class="muted" style="margin-top:0">Choisissez ce qui doit être effacé de ce navigateur.</p>
      ${hasCurrent ? row('clcur', 'Backup ouvert', 'Configuration, appels, messages vocaux et invites audio analysés.', 'checked disabled') : ''}
      ${row('clmem', 'Mémoire de la session', 'Rapports générés, recherches (dont les numéros de clients), enregistrements écoutés.', 'checked disabled')}
      ${refThere ? row('clref', 'Backup de référence', 'Deuxième backup gardé pour l\'onglet Comparaison.', 'checked') : ''}
      ${nRap ? row('clrap', 'Numéros de clients marqués « traité »', `Onglet Appels manqués : ${nRap} numéro${nRap > 1 ? 's' : ''}.`, '') : ''}
      ${hasNotes ? row('clnot', 'Notes et observations', 'Statuts, notes et observations de l\'onglet Recommandations.', '') : ''}
      ${hasAll ? row('clall', 'Tous les autres réglages', 'Magasins, objectifs, suivi dans le temps, tâches cochées, préférences de période et de rapport. Exportez-les d\'abord (Sauvegarde des réglages) si vous voulez les garder.', '') : ''}
      <p class="note">Le fichier .zip du backup n'est jamais modifié. Les fichiers déjà exportés (CSV, PDF, réglages) dans vos Téléchargements ne sont pas touchés : supprimez-les vous-même. Le thème et le menu réduit sont conservés.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn" id="clno">Annuler</button><button class="btn danger" id="clyes">${hasCurrent ? 'Fermer et effacer' : 'Effacer'}</button></div></div>`;
    document.body.appendChild(ov);
    const end = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if(e.key === 'Escape') end(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if(e.target === ov) end(); });
    ov.querySelector('#clno').addEventListener('click', end);
    const ck = id => { const c = ov.querySelector('#' + id); return !!(c && c.checked); };
    ov.querySelector('#clyes').addEventListener('click', async () => { const o = {ref: ck('clref'), rappels: ck('clrap'), notes: ck('clnot'), all: ck('clall')}; end(); await close(o); });
    ov.querySelector('#clyes').focus();
  }
  // enregistrements : rattacher à nouveau le zip après un rechargement de la page, lire un enregistrement
  async function linkRecZip(file){
    if(!/\.zip$/i.test(file.name)) throw new Error('Veuillez choisir un fichier .zip.');
    const z = await readZip(file), map = recIndex(z, (window.D && window.D.recordings) || []), n = Object.keys(map).length;
    if(!n) throw new Error('Aucun enregistrement de ce backup n\'a été trouvé dans ce fichier.');
    RECZIP = {z, map}; return n;
  }
  const recHas = url => !!(RECZIP && RECZIP.map[url]);
  const recLinked = () => !!RECZIP;
  async function recBlob(url){ if(!recHas(url)) return null; return RECZIP.z.blob(RECZIP.map[url], /\.mp3$/i.test(url) ? 'audio/mpeg' : 'audio/wav'); }
  return {start, load, close, audioURL, ensureListeners, wireCard, rerun: () => run(window.D), loadRef, clearRef, parseOnly, linkRecZip, recHas, recLinked, recBlob};
})();

