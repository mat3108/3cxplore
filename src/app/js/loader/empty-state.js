  // ---------- Page vide (aucun backup) ----------
  function emptyView(){
    window.D = null;
    window.__app = {closeDrawer(){ $$('#drawer').classList.remove('open'); }, showDN(){}, route: emptyView};
    ensureListeners();
    $$('#drawer').classList.remove('open');
    if(location.hash && location.hash !== '#dashboard') history.replaceState(null, '', location.pathname + location.search);
    $$('#sub').textContent = 'Aucun backup chargé';
    $$('#segsel').hidden = true;
    $$('#gsearch').hidden = true;
    $$('#fwhdr').hidden = true;
    $$('#nav').innerHTML = `<div class="ng">Vue d'ensemble</div><a href="#dashboard" data-k="dashboard" class="on" title="Tableau de bord">${navIcon('dashboard')}<span class="lb">Tableau de bord</span></a><div class="navfoot"><a href="${location.pathname.includes('/anciennes-versions/') ? '../' : ''}${document.documentElement.lang === 'en' ? 'documentation-en.html' : 'documentation.html'}#glossaire" class="navcl" title="Les mots de 3CX expliqués simplement">${navIcon('glossaire')}<span class="lb">Glossaire</span></a><a href="${location.pathname.includes('/anciennes-versions/') ? '../' : ''}changelog.html" class="navcl" title="Historique des versions de 3CXplore">${navIcon('changelog')}<span class="lb">Changelog</span></a></div>`;
    $$('#main').innerHTML = `
      <div class="card bk empty" id="bkcard">
        <div class="emptyico" aria-hidden="true"><svg class="brandlogo" style="border-radius:18px;margin:0 auto" viewBox="0 0 56 56" width="72" height="72" aria-hidden="true"><rect width="56" height="56" rx="14" fill="#042C53"/><text x="4" y="9.8" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="4" y="16.8" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="4" y="23.8" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="4" y="30.8" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="4" y="37.8" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="9" y="8.1" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="9" y="15.1" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="9" y="22.1" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="44" y="11.4" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="44" y="18.4" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="44" y="25.4" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="10.1" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="17.1" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="49" y="24.1" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="31.1" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><circle cx="28" cy="28" r="12" fill="#E6F1FB" stroke="#85B7EB" stroke-width="2"/><path d="M14 28 a14 14 0 0 1 28 0" stroke="#444441" stroke-width="2.5" fill="none"/><rect x="11" y="25" width="5" height="8" rx="2.5" fill="#444441"/><rect x="40" y="25" width="5" height="8" rx="2.5" fill="#444441"/><path d="M42.5 33 q0 5 -6 5" stroke="#444441" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="35.5" cy="38" r="1.6" fill="#5DCAA5"/><path d="M19 25 h18 v3 a3 3 0 0 1 -3 3 h-3 a3 3 0 0 1 -3 -3 a3 3 0 0 1 -3 3 h-3 a3 3 0 0 1 -3 -3 z" fill="#042C53"/><path d="M21 26.5 h3 M30 26.5 h3" stroke="#5DCAA5" stroke-width="1.2" stroke-linecap="round"/><path d="M25 34.5 q3 1.5 7 -0.5" stroke="#444441" stroke-width="2" fill="none" stroke-linecap="round"/></svg></div>
        <h2>Aucun backup ouvert</h2>
        <p class="lead">Choisissez un fichier de backup 3CX (.zip) pour afficher la configuration, les flux d'appels, l'historique et les statistiques.</p>
        <label class="btn primary big">Choisir un backup (.zip)<input type="file" id="bkfile" accept=".zip,application/zip" hidden></label>
        <div><label class="tourtgl" title="Lancer la visite guidée à chaque ouverture d'un backup"><input type="checkbox" class="tourauto"${(() => { try{ return localStorage.getItem('visiteauto3cx') === '1' ? ' checked' : ''; }catch(e){ return ''; } })()}> Visite guidée à l'ouverture du backup</label></div>
        <div class="bkdrop">ou glissez-déposez le fichier .zip ici.<br>Le traitement se fait entièrement dans votre navigateur, rien n'est envoyé sur Internet.</div>
        <div id="bkst" class="bkst"></div>
        ${window.REF_D || ['rappels', 'notes', 'all'].some(g => lsKeys(g).length) ? '<p style="margin-top:14px"><button class="btn" id="bkwipe">Effacer les données conservées dans ce navigateur…</button></p>' : ''}
      </div>`;
    wireCard();
  }
  // Branche le bouton de choix, le bouton Fermer et le glisser-déposer de la carte #bkcard
  if(!window.__tourTglWired){ window.__tourTglWired = true; document.addEventListener('change', e => { if(e.target.classList && e.target.classList.contains('tourauto')){ try{ localStorage.setItem('visiteauto3cx', e.target.checked ? '1' : '0'); }catch(er){}
    document.querySelectorAll('input.tourauto').forEach(i => i.checked = e.target.checked); } }); }
  function wireCard(){
    const card = $$('#bkcard'); if(!card) return;
    const st = $$('#bkst');
    const go = async f => {
      if(!f) return;
      card.classList.add('busy'); st.className = 'bkst'; st.textContent = 'Démarrage…';
      const bar = (() => { let b = $$('#bkbar'); if(!b){ b = document.createElement('div'); b.id = 'bkbar'; b.className = 'bkbar'; b.innerHTML = '<i></i>'; st.after(b); } return b; })();
      try{ await load(f, (m, p) => { st.textContent = m + (p != null ? ` — ${Math.round(p)} %` : ''); if(p != null) bar.firstChild.style.width = Math.min(100, p) + '%'; }); }
      catch(e){ card.classList.remove('busy'); st.className = e.cancel ? 'bkst' : 'bkst err'; st.textContent = e.cancel ? e.message : 'Erreur : ' + e.message; const fi = $$('#bkfile'); if(fi) fi.value = ''; }
    };
    $$('#bkfile').addEventListener('change', e => go(e.target.files[0]));
    const cl = $$('#bkclose'); if(cl) cl.addEventListener('click', () => closeDialog(true));
    const wp = $$('#bkwipe'); if(wp) wp.addEventListener('click', () => closeDialog(false));
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('over'); });
    card.addEventListener('dragleave', () => card.classList.remove('over'));
    card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('over'); go(e.dataTransfer.files[0]); });
  }
  // masque les secrets d'un backup mémorisé par une version précédente (règle SENSITIVE élargie) ; renvoie true si quelque chose a changé
  function scrub(X){
    let ch = false; const M = '•••• (masqué)';
    [X.extensions, X.queues, X.ivrs].forEach(a => (a || []).forEach(o => { const p = o.props; if(p) for(const k in p) if(SENSITIVE.test(k) && p[k] && p[k] !== M){ p[k] = M; ch = true; } }));
    (X.params || []).forEach(p => { if(SENSITIVE.test(p.name) && p.value && p.value !== M){ p.value = M; ch = true; } });
    return ch;
  }
  async function start(){
    try{ if(localStorage.getItem('nav3cx')==='mini') document.body.classList.add('mini'); }catch(e){}
    const saved = await loadSaved();
    if(saved && saved.D && scrub(saved.D)) try{ await save(saved); }catch(e){}
    { const r = await getKey('reference'); if(r && r.D && scrub(r.D)) try{ await putKey('reference', r); }catch(e){} window.REF_D = r && r.D ? r.D : null; }
    if(saved && saved.D){ AUDIO = saved.audio || {}; run(saved.D);
      // 19.0.3 : un backup analysé avant cette version garde les renvois hors heures décochés ; il faut le rouvrir pour les lire correctement
      if(saved.D.source && saved.D.source.kind === 'zip' && !saved.D.source.fwd){ const n = document.createElement('div'); n.className = 'card'; n.setAttribute('role', 'status');
        n.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:min(560px,calc(100vw - 32px));padding:10px 14px;display:flex;gap:10px;align-items:center';
        n.innerHTML = '<span>Ce backup a été analysé par une version précédente : rouvrez-le pour que les renvois d\'appel soient lus comme dans la console 3CX.</span><button class="btn" type="button">OK</button>';
        n.querySelector('button').addEventListener('click', () => n.remove()); document.body.appendChild(n); } }
    else if(window.EMBEDDED) run(window.EMBEDDED);
    else emptyView();
  }
  async function load(file, progress){
    if(!/\.zip$/i.test(file.name)) throw new Error('Veuillez choisir un fichier .zip.');
    const t0 = performance.now();
    const {D, audio, rec} = await build(file, progress);
    const W = preCheck(D, false); if(W.length && !(await confirmImport(W, file, false))) throw cancelled();
    RECZIP = rec && Object.keys(rec.map).length ? rec : null;
    progress('Mémorisation dans le navigateur…', 97);
    let stored = true;
    try{ await save({D, audio}); }catch(e){ stored = false; }
    AUDIO = audio;
    for(const k in urlCache){ URL.revokeObjectURL(urlCache[k]); delete urlCache[k]; }
    D.source.stored = stored;
    D.source.seconds = Math.round((performance.now() - t0) / 100) / 10;
    window.__bkImported = true; // backup tout juste importé (pas restauré au rechargement de la page) : utilisé par la visite guidée
    run(D);
    return stored;
  }
