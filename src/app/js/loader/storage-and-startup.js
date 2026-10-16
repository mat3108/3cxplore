  // ---------- Mémorisation (IndexedDB) ----------
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DBNAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function save(rec){ const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(rec, KEY); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  async function loadSaved(){ try{ const db = await idb(); return await new Promise((res) => { const t = db.transaction(STORE, 'readonly'); const r = t.objectStore(STORE).get(KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }catch(e){ return null; } }
  async function clear(){ try{ const db = await idb(); await new Promise(res => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(KEY); t.oncomplete = res; t.onerror = res; }); }catch(e){} }
  async function putKey(k, rec){ const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(rec, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  async function getKey(k){ try{ const db = await idb(); return await new Promise(res => { const t = db.transaction(STORE, 'readonly'); const r = t.objectStore(STORE).get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }catch(e){ return null; } }
  async function delKey(k){ try{ const db = await idb(); await new Promise(res => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = res; t.onerror = res; }); }catch(e){} }
  // backup de référence pour la comparaison : analysé comme un backup normal, sans remplacer le backup actuel
  // ---------- Vérification avant import ----------
  const TABLE_FR = {cdroutput: 'historique des appels', callcent_queuecalls: "appels en file d'attente", callcent_ag_dropped_calls: 'sonneries des agents', audit_log: "journal d'audit", recordings: 'enregistrements', cl_quality: "qualité des appels", chat_message: 'clavardage'};
  const lastCall = X => X && X.calls && X.calls.length ? X.calls[0][0] : '';
  const dayFr = iso => iso ? new Date(iso).toLocaleDateString('fr-CA') : '?';
  const escH = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function preCheck(N, ref){
    const W = [], C = window.D && window.D.info ? window.D : null;
    if(C){
      if((N.info.fqdn || '') !== (C.info.fqdn || '')) W.push(['bad', `Ce backup vient d'un autre système (${N.info.fqdn || 'inconnu'}) que celui affiché (${C.info.fqdn || 'inconnu'}).`, ref ? 'La comparaison mélangerait deux systèmes différents.' : 'Le suivi, les objectifs et les réglages des magasins sont propres à chaque système.']);
      else if(N.info.date === C.info.date) W.push(['warn', `C'est le même backup que celui déjà affiché (sauvegarde du ${N.info.date}).`, ref ? 'La comparaison ne montrera aucune différence.' : 'Rien de nouveau ne sera affiché.']);
      else if(!ref && lastCall(N) && lastCall(C) && lastCall(N) < lastCall(C)) W.push(['warn', `Ce backup est plus ancien que celui affiché : son historique s'arrête au ${dayFr(lastCall(N))}, contre le ${dayFr(lastCall(C))}.`, 'Pour comparer avec un ancien backup, utilisez plutôt l\'onglet Comparaison (backup de référence).']);
    }
    if(!/^20\./.test(N.info.version || '')) W.push(['warn', `Version 3CX ${N.info.version || 'inconnue'} : l'interface est prévue pour les backups 3CX V20.`, 'Certains onglets peuvent être incomplets.']);
    const miss = (N.missingTables || []).filter(t => TABLE_FR[t]);
    if(miss.length) W.push(['warn', `Tables absentes du backup : ${miss.map(t => TABLE_FR[t]).join(', ')}.`, 'Les onglets correspondants seront vides (backup partiel ou sans historique).']);
    else if(!N.calls.length) W.push(['warn', 'Aucun appel dans l\'historique de ce backup.', 'Les statistiques, agents, rappels et effectifs seront vides.']);
    return W;
  }
  function confirmImport(W, file, ref){
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'batchov';
      ov.innerHTML = `<div class="card clbox" role="dialog" aria-modal="true"><h3 style="margin-top:0">Vérifier avant d'ouvrir ${ref ? 'la référence' : 'ce backup'}</h3>
        <p class="muted" style="margin-top:0">${escH(file.name)}</p>
        ${W.map(([c, t, d]) => `<div style="margin:10px 0"><span class="pill ${c}">${c === 'bad' ? 'Attention' : 'À vérifier'}</span> <b>${escH(t)}</b><div class="muted" style="font-size:12.5px">${escH(d)}</div></div>`).join('')}
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px"><button class="btn" id="pcno">Annuler</button><button class="btn primary" id="pcyes">Ouvrir quand même</button></div></div>`;
      document.body.appendChild(ov);
      const end = v => { ov.remove(); document.removeEventListener('keydown', key); res(v); }, key = e => { if(e.key === 'Escape') end(false); };
      document.addEventListener('keydown', key);
      ov.querySelector('#pcno').addEventListener('click', () => end(false)); ov.querySelector('#pcyes').addEventListener('click', () => end(true));
      ov.querySelector('#pcno').focus();
    });
  }
  const cancelled = () => { const e = new Error('Ouverture annulée : le backup affiché est conservé.'); e.cancel = true; return e; };
  async function loadRef(file, progress){
    if(!/\.zip$/i.test(file.name)) throw new Error('Veuillez choisir un fichier .zip.');
    const {D} = await build(file, progress);
    const W = preCheck(D, true); if(W.length && !(await confirmImport(W, file, true))) throw cancelled();
    progress('Mémorisation de la référence…', 97);
    try{ await putKey('reference', {D}); }catch(e){}
    window.REF_D = D;
  }
  async function clearRef(){ await delKey('reference'); window.REF_D = null; }
  // analyse d'un zip sans le mémoriser (ajout d'un point au suivi dans le temps)
  async function parseOnly(file, progress){ if(!/\.zip$/i.test(file.name)) throw new Error('Veuillez choisir un fichier .zip.'); const {D} = await build(file, progress); return D; }

  // ---------- Démarrage ----------
  let AUDIO = {};
  let RECZIP = null; // zip du backup courant, gardé en mémoire pour lire les enregistrements à la demande (trop volumineux pour être recopié)
  const urlCache = {};
  function audioURL(path){
    if(!path || !path.startsWith('zip:')) return path;
    if(urlCache[path]) return urlCache[path];
    const b = AUDIO[path]; return b ? (urlCache[path] = URL.createObjectURL(b)) : '';
  }
  const $$ = s => document.querySelector(s);
  function ensureListeners(){
    if(window.__appListeners) return;
    window.__appListeners = true;
    document.addEventListener('keydown', e => { if(e.key==='Escape') window.__app.closeDrawer(); });
    document.addEventListener('click', e => { const a = e.target.closest('a.dn'); if(a){ e.preventDefault(); window.__app.showDN(a.dataset.dn); } });
    $$('#dclose').addEventListener('click', () => window.__app.closeDrawer());
    window.addEventListener('hashchange', () => window.__app.route());
    $$('#segsel').addEventListener('change', e => window.__app.setSeg && window.__app.setSeg(e.target.value));
    $$('#fwhdr').addEventListener('click', () => window.__app.openFwCheck && window.__app.openFwCheck());
    $$('#collapse').addEventListener('click', () => {
      document.body.classList.toggle('mini');
      try{ localStorage.setItem('nav3cx', document.body.classList.contains('mini') ? 'mini' : ''); }catch(e){}
    });
    $$('#menubtn').addEventListener('click', () => document.body.classList.toggle('navopen'));
    $$('#scrim').addEventListener('click', () => document.body.classList.remove('navopen'));
    $$('#nav').addEventListener('click', e => { if(e.target.closest('a')) document.body.classList.remove('navopen'); });
    document.querySelectorAll('.themesw button').forEach(b => b.addEventListener('click', () => window.applyTheme(b.dataset.t)));
    { let t = ''; try{ t = localStorage.getItem('theme3cx') || ''; }catch(e){} window.applyTheme(t); }
  }
  function run(D){ window.D = D; new Function('D', document.getElementById('app').textContent)(D); }

