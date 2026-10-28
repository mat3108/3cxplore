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
    // clavier : quand le menu s'ouvre par-dessus la page (téléphone, menu masqué), le focus y entre, Tab y tourne en rond,
    // et il revient au bouton Menu (ou passe au contenu après un choix) quand le menu se referme
    const side = $$('#side'), mbtn = $$('#menubtn'), overlay = () => getComputedStyle(side).position === 'fixed';
    const focusables = root => [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(x => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
    window.setNavOpen = (open, to) => {
      const was = document.body.classList.contains('navopen'); document.body.classList.toggle('navopen', open); mbtn.setAttribute('aria-expanded', open); mbtn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      if(!overlay()) return;
      if(open){ if(!side.contains(document.activeElement)){ const f = focusables(side); if(f.length) f[0].focus(); } }
      else if(was && (to === 'main' || side.contains(document.activeElement))) (to === 'main' ? $$('#main') : mbtn).focus({preventScroll: true});
    };
    mbtn.addEventListener('click', () => window.setNavOpen(!document.body.classList.contains('navopen')));
    $$('#scrim').addEventListener('click', () => window.setNavOpen(false));
    $$('#nav').addEventListener('click', e => { if(e.target.closest('a') && document.body.classList.contains('navopen')) window.setNavOpen(false, 'main'); });
    side.addEventListener('keydown', e => {
      if(e.key !== 'Tab' || !document.body.classList.contains('navopen') || !overlay()) return;
      const f = focusables(side); if(!f.length) return; const i = f.indexOf(document.activeElement);
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && (i < 0 || i === f.length - 1)){ e.preventDefault(); f[0].focus(); }
    });
    // flèches dans le menu : haut / bas d'une entrée à l'autre, droite ouvre une rubrique puis entre dans ses pages, gauche en ressort
    $$('#nav').addEventListener('keydown', e => {
      const nav = $$('#nav'), a = e.target.closest('a'), q = $$('#navq'), res = $$('#navqres');
      if(e.target === q && !(e.key === 'ArrowDown' && (!res || res.hidden))) return;
      const links = [...nav.querySelectorAll('a[href]')].filter(x => x.getClientRects().length), i = links.indexOf(a);
      if(e.key === 'ArrowDown'){ e.preventDefault(); (links[i + 1] || links[0]).focus(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); if(i === 0 && q && q.getClientRects().length) q.focus(); else (i > 0 ? links[i - 1] : links[links.length - 1]).focus(); }
      else if(e.key === 'Home'){ e.preventDefault(); if(links[0]) links[0].focus(); }
      else if(e.key === 'End'){ e.preventDefault(); if(links.length) links[links.length - 1].focus(); }
      else if(e.key === 'ArrowRight' && a && a.dataset.set){ if(document.body.classList.contains('mini') && !overlay()) return; e.preventDefault(); const w = a.closest('.rbw'); // 20.9.1 : menu réduit, sous-pages cachées : rien à ouvrir
        if(!w.classList.contains('open')){ w.classList.add('open'); a.setAttribute('aria-expanded', 'true'); }
        else { const s = w.querySelector('.stns a'); if(s && s.getClientRects().length) s.focus(); } }
      else if(e.key === 'ArrowLeft' && a){ const w = a.closest('.rbw'); if(!w) return; e.preventDefault();
        if(a.classList.contains('stn')) w.querySelector('.rb').focus(); else { w.classList.remove('open'); a.setAttribute('aria-expanded', 'false'); } }
    });
    // 20.9.1 : fenêtres par-dessus la page (palette, fermer le backup, vérifier avant d'ouvrir, visite guidée) et tiroir de détail :
    //          Tab y tourne en rond au lieu de partir dans la page cachée derrière, et à la fermeture le focus revient à l'élément qui les a ouvertes
    const modalBox = () => { const m = [...document.querySelectorAll('[aria-modal="true"]')].filter(x => x.getClientRects().length); if(m.length) return m[m.length - 1];
      const d = $$('#drawer'); return d && d.classList.contains('open') ? d : null; };
    document.addEventListener('keydown', e => {
      if(e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return; const box = modalBox(); if(!box) return;
      const f = focusables(box), i = f.indexOf(document.activeElement);
      if(!f.length){ e.preventDefault(); return; }
      if(i < 0){ e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
      else if(e.shiftKey && i === 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }, true);
    let lastOut = null; const shown = x => !!x && document.contains(x) && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
    document.addEventListener('focusin', e => { if(!e.target.closest('[aria-modal="true"]')) lastOut = e.target; }, true);
    new MutationObserver(ms => ms.forEach(m => {
      m.addedNodes.forEach(n => { if(n.nodeType === 1 && (n.matches('[aria-modal="true"]') || n.querySelector('[aria-modal="true"]'))) n.__opener = lastOut; });
      m.removedNodes.forEach(n => { if(n.nodeType !== 1 || !('__opener' in n)) return; const a = document.activeElement;
        if(a && a !== document.body && document.contains(a)) return; // le focus est déjà ailleurs (tiroir ouvert, page choisie…)
        (shown(n.__opener) ? n.__opener : $$('#main')).focus({preventScroll: true}); });
    })).observe(document.body, {childList: true});
    // 20.9.1 : lignes de tableau cliquables et liens vers un poste, une file, un menu… : atteignables par Tab, ouverts par Entrée ou Espace
    const KB_SEL = 'tr.click:not([tabindex]), a.dn:not([href]):not([tabindex])';
    const kbMark = x => { x.tabIndex = 0; if(x.tagName === 'A') x.setAttribute('role', 'link'); };
    const kbScan = n => { if(n.nodeType !== 1) return; if(n.matches(KB_SEL)) kbMark(n); n.querySelectorAll(KB_SEL).forEach(kbMark); };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(kbScan))).observe(document.body, {childList: true, subtree: true});
    kbScan(document.body);
    document.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const t = e.target;
      if(!t.matches || !t.matches('tr.click, a.dn:not([href])')) return; e.preventDefault(); t.click(); });
    // 20.9.1 : le bandeau reste en haut de l'écran ; un élément qui reçoit le focus ne doit pas finir caché dessous (marge de défilement = hauteur du bandeau)
    { const hd = document.querySelector('header'), setH = () => document.documentElement.style.setProperty('--hdrh', hd.offsetHeight + 'px');
      if(hd){ setH(); if(window.ResizeObserver) new ResizeObserver(setH).observe(hd); else window.addEventListener('resize', setH); } }
    const sk = $$('#skiplink'); if(sk) sk.addEventListener('click', e => { e.preventDefault(); $$('#main').focus(); });
    document.querySelectorAll('.themesw button').forEach(b => b.addEventListener('click', () => window.applyTheme(b.dataset.t)));
    { let t = ''; try{ t = localStorage.getItem('theme3cx') || ''; }catch(e){} window.applyTheme(t); }
  }
  function run(D){ window.D = D; new Function('D', document.getElementById('app').textContent)(D); }

