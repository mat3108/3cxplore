// ---------- Tiroir de détail ----------
function openDrawer(title, html){ $('#dt').innerHTML = title; $('#db').innerHTML = html; $('#drawer').classList.add('open'); $('#db').scrollTop=0; }
function closeDrawer(){ $('#drawer').classList.remove('open'); }
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

