// ---------- Tiroir de détail ----------
// clavier : le focus entre dans le tiroir (son titre, puis Tab va au bouton Fermer et au contenu) et revient d'où il venait à la fermeture
let DRAWER_FROM = null;
function openDrawer(title, html){ const d = $('#drawer'), was = d.classList.contains('open'); $('#dt').innerHTML = title; $('#db').innerHTML = html; d.classList.add('open'); $('#db').scrollTop=0;
  if(!was) DRAWER_FROM = document.activeElement; if(!was || !d.contains(document.activeElement)) $('#dt').focus({preventScroll: true}); }
function closeDrawer(){ const d = $('#drawer'); if(!d.classList.contains('open')) return; d.classList.remove('open');
  if(d.contains(document.activeElement)){ const f = DRAWER_FROM && document.contains(DRAWER_FROM) && DRAWER_FROM.getClientRects().length ? DRAWER_FROM : $('#main'); f.focus({preventScroll: true}); } DRAWER_FROM = null; }
window.__app = {closeDrawer, showDN: n => showDN(n)};
BK.ensureListeners();
const kv = pairs => '<dl class="kv">'+pairs.filter(p=>p).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${v===''||v==null?'<span class="muted">–</span>':v}</dd>`).join('')+'</dl>';

function showDN(n){
  const d = DN[n]; if(!d) return;
  const o = d.obj;
  if(d.kind==='Poste') return showExt(o);
  if(d.kind==="File d'attente") return showQueue(o);
  if(d.kind==='Standard (IVR)') return showIVR(o);
  if(d.kind==='Groupe de sonnerie') return showRG(o);
  if(d.kind==='Département') return showGroup(o);
  if(d.kind==='Trunk') return showLine(o);
}

