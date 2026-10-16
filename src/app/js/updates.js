// Mises à jour et installation : démarre au chargement de la page, même sans backup ouvert
(() => {
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// ---------- Vérification des mises à jour (dernière release publique de 3CXplore sur GitHub) ----------
// seule requête Internet de l'outil : elle demande à GitHub le numéro de la dernière version ; aucune donnée du backup n'est envoyée
const UPD_REPO = 'mat3108/3cxplore', APP_VERSION = '__APP_VERSION__';
const updCmp = (a, b) => { const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
  for(let i = 0; i < Math.max(x.length, y.length); i++){ const d = (x[i] || 0) - (y[i] || 0); if(d) return d; } return 0; };
const updOn = () => { try{ return localStorage.getItem('maj3cx') !== 'off'; }catch(e){ return true; } };
async function updCheck(force){
  if(/^__/.test(APP_VERSION)) return {err: 'version de la page inconnue'};
  let c = null; try{ c = JSON.parse(localStorage.getItem('maj3cx-cache') || 'null'); }catch(e){}
  if(!force && c && c.tag && Date.now() - c.t < 864e5) return c; // au plus une vérification par jour
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 6000);
  try{
    const r = await fetch('https://api.github.com/repos/' + UPD_REPO + '/releases/latest', {signal: ac.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', headers: {Accept: 'application/vnd.github+json'}});
    clearTimeout(tm); if(!r.ok) throw new Error('GitHub a répondu ' + r.status);
    const j = await r.json(); c = {t: Date.now(), tag: j.tag_name, url: j.html_url, name: j.name};
    try{ localStorage.setItem('maj3cx-cache', JSON.stringify(c)); }catch(e){}
    return c;
  }catch(e){ clearTimeout(tm); return {err: e.name === 'AbortError' ? 'pas de réponse (hors ligne ?)' : e.message}; }
}
function updBanner(c){
  window.__updLast = c; setTimeout(updDot, 0); const b = document.getElementById('updbar'); if(!b) return;
  let ign = ''; try{ ign = localStorage.getItem('maj3cx-ignore') || ''; }catch(e){}
  if(!c || c.err || !c.tag || updCmp(c.tag, APP_VERSION) <= 0 || ign === c.tag){ b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `<span><b>${esc(c.name || '3CXplore ' + c.tag.replace(/^v/, ''))}</b> est disponible — vous utilisez la version ${esc(APP_VERSION)}.</span>${pwaWeb() ? `<a class="btn primary" href="${esc(window.APP_ROOT)}index.html">Ouvrir la nouvelle version</a>` : `<a class="btn primary" href="${esc(c.url)}" target="_blank" rel="noopener">Télécharger la mise à jour</a>`}<button class="btn" id="updx">Plus tard</button>`;
  document.getElementById('updx').addEventListener('click', () => { try{ localStorage.setItem('maj3cx-ignore', c.tag); }catch(e){} b.hidden = true; });
}
if(!window.__updDone){ window.__updDone = true; if(updOn()) updCheck(false).then(updBanner); }
else if(window.__updLast) updBanner(window.__updLast);
// bouton « Vérifier maintenant » de l'onglet Interface (branché une seule fois)
if(!window.__updWired){ window.__updWired = true;
  document.addEventListener('click', async e => { if(!e.target.closest || !e.target.closest('#uiupdnow')) return; const st = document.getElementById('uiupdst'); if(st) st.textContent = 'Vérification…';
    const c = await updCheck(true); updBanner(c);
    if(st) st.textContent = c.err ? `Impossible de vérifier : ${c.err}.` : updCmp(c.tag, APP_VERSION) > 0 ? `Mise à jour disponible : ${c.tag.replace(/^v/, '')} (vous utilisez ${APP_VERSION}).` : `Vous utilisez la dernière version (${APP_VERSION}).`; }); }

// ---------- Application installable (version web servie en https, par exemple GitHub Pages) ----------
// le service worker garde une copie de l'outil pour le hors ligne et récupère la dernière version quand le réseau est là ;
// les backups ne passent jamais par lui (ils sont lus depuis le disque, dans le navigateur)
const PWA_URL = 'https://mat3108.github.io/3cxplore/';
// page servie par un site sécurisé (https, ou localhost pour les essais) : pas depuis un fichier ouvert en double-clic
function pwaWeb(){ return !!window.isSecureContext && /^https?:$/.test(location.protocol) && !!window.APP_ROOT && !/^__/.test(window.APP_ROOT); }
if(!window.__pwaWired){ window.__pwaWired = true;
  window.__pwa = {prompt: null, installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true};
  if('serviceWorker' in navigator && pwaWeb()) navigator.serviceWorker.register(window.APP_ROOT + 'sw.js', {scope: window.APP_ROOT}).catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__pwa.prompt = e; const b = document.getElementById('pwainst'); if(b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { window.__pwa.installed = true; window.__pwa.prompt = null; const s = document.getElementById('pwast'); if(s) s.textContent = '3CXplore est installé.'; });
  document.addEventListener('click', async e => { if(!e.target.closest || !e.target.closest('#pwainst')) return; const p = window.__pwa.prompt; if(!p) return;
    p.prompt(); try{ await p.userChoice; }catch(er){} window.__pwa.prompt = null; const b = document.getElementById('pwainst'); if(b) b.hidden = true; });
}

// ---------- Bouton « Mises à jour et installation » du bandeau du haut ----------
function updDot(){
  const b = document.getElementById('updbtn'); if(!b) return;
  const c = window.__updLast, newer = c && !c.err && c.tag && updCmp(c.tag, APP_VERSION) > 0, inst = !!(window.__pwa && window.__pwa.prompt);
  b.classList.toggle('has', !!(newer || inst)); b.querySelector('.dot').hidden = !(newer || inst);
  b.title = newer ? `Mise à jour disponible : ${c.tag.replace(/^v/, '')}` : inst ? 'Installer 3CXplore comme application' : 'Mises à jour et installation';
}
function updPopRender(msg){
  const p = document.getElementById('updpop'); if(!p) return;
  const c = window.__updLast, P = window.__pwa || {}, newer = c && !c.err && c.tag && updCmp(c.tag, APP_VERSION) > 0;
  const de = document.querySelector('.vmenu a[href*="documentation"]'), doc = de ? de.getAttribute('href') : '';
  const state = msg || (c && c.err ? `Dernière vérification impossible : ${c.err}.` : newer ? `${c.name || '3CXplore ' + c.tag.replace(/^v/, '')} est disponible.` : c && c.tag ? 'Vous utilisez la dernière version.' : 'Pas encore vérifié.');
  const dl = newer ? (pwaWeb() ? `<a class="btn primary" href="${esc(window.APP_ROOT)}index.html">Ouvrir la nouvelle version</a>` : `<a class="btn primary" href="${esc(c.url)}" target="_blank" rel="noopener">Télécharger la mise à jour</a>`) : '';
  const inst = P.installed ? '<div class="muted">Installé comme application : les mises à jour se font automatiquement.</div>'
    : pwaWeb() ? `<button class="btn" id="pwainst"${P.prompt ? '' : ' hidden'}>Installer l'application</button>${P.prompt ? '' : '<div class="muted">Installation : menu du navigateur (Chrome ou Edge) → « Installer 3CXplore ».</div>'}`
    : `<div class="muted">Pour installer 3CXplore comme application, ouvrez la version web : <a href="${PWA_URL}" target="_blank" rel="noopener">${PWA_URL.replace(/^https:\/\//, '')}</a></div>`;
  p.innerHTML = `<div class="updpv">3CXplore <b>${esc(APP_VERSION)}</b>${doc ? ` · <a href="${esc(doc)}">nouveautés</a>` : ''}</div>
    <div class="updps" id="updst">${esc(state)}</div>
    <div class="updpa"><button class="btn" id="updchk">Vérifier les mises à jour</button>${dl}</div>
    <div class="updpi"><div class="updpt">Application</div>${inst}</div>
    <div class="muted updpn">La vérification demande seulement à GitHub le numéro de la dernière version ; aucune donnée du backup n'est envoyée.${updOn() ? '' : ' Vérification au démarrage désactivée (onglet Interface).'}</div>`;
}
if(!window.__updHdr){ window.__updHdr = true;
  document.addEventListener('click', async e => {
    const btn = e.target.closest && e.target.closest('#updbtn'), pop = document.getElementById('updpop');
    if(btn){ if(pop.hidden){ updPopRender(); pop.hidden = false; } else pop.hidden = true; return; }
    if(e.target.closest && e.target.closest('#updchk')){ const st = document.getElementById('updst'); if(st) st.textContent = 'Vérification…';
      const c = await updCheck(true); updBanner(c); updPopRender(c.err ? `Impossible de vérifier : ${c.err}.` : updCmp(c.tag, APP_VERSION) > 0 ? `${c.name || '3CXplore ' + c.tag.replace(/^v/, '')} est disponible.` : `Vous utilisez la dernière version (${APP_VERSION}).`); return; }
    if(pop && !pop.hidden && !(e.target.closest && e.target.closest('#updpop'))) pop.hidden = true; });
  document.addEventListener('keydown', e => { const pop = document.getElementById('updpop'); if(e.key === 'Escape' && pop && !pop.hidden) pop.hidden = true; });
  window.addEventListener('beforeinstallprompt', () => setTimeout(() => { updDot(); const pop = document.getElementById('updpop'); if(pop && !pop.hidden) updPopRender(); }, 0));
}
updDot();

window.UPD = {on: updOn, check: updCheck, version: APP_VERSION};
})();
