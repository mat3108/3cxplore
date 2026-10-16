// ---------- « Où est-ce utilisé ? » dans les fiches (poste, file, menu, groupe de sonnerie, département) ----------
function usedByHTML(n){
  const refs = dnRefs()[n] || [], d = DN[n], isExt = d && d.kind === 'Poste';
  const order = ['route', 'sda', 'fwd', 'member'], calls = refs.filter(r => r.cat !== 'member').length;
  const head = `<h3>Où est-ce utilisé ? <span class="pill ${calls ? 'acc' : ''}">${calls} acheminement${calls > 1 ? 's' : ''}</span></h3>`;
  if(!refs.length) return head + `<div class="card ubx"><span class="muted">${isExt ? "Aucun menu, département, file, groupe, SDA ni renvoi de collègue ne pointe vers ce poste." : "Rien ne pointe vers cet élément : il peut être modifié ou supprimé sans couper d'acheminement."}</span></div>`;
  const body = order.filter(c => refs.some(r => r.cat === c)).map(c => { const rs = refs.filter(r => r.cat === c);
    return `<div class="ubg"><div class="ubt">${esc(REF_CAT[c])} <span class="muted">(${rs.length})</span></div>${rs.slice(0, 60).map(r => `<div class="ubl">${refLine(r)}</div>`).join('')}${rs.length > 60 ? `<div class="muted">… et ${rs.length - 60} autre(s)</div>` : ''}</div>`; }).join('');
  return head + `<div class="card ubx">${calls ? `<div class="ubw">Avant de modifier ou supprimer ${esc(n)}, mettre à jour ${calls > 1 ? `ces ${calls} acheminements` : 'cet acheminement'}.</div>` : ''}${body}
    ${isExt ? `<p style="margin:8px 0 0"><a class="btn" href="#employe/${esc(n)}">Fiche employé</a> <a class="btn" href="#historique/${esc(n)}">Historique du poste</a> <a class="btn" href="#depart" data-ubdep="${esc(n)}">Préparer la fiche de départ</a></p>` : ''}</div>`;
}
// la section est ajoutée en fin de fiche : chaque fonction d'affichage mémorise le numéro ouvert, openDrawer l'ajoute
let UB_DN = null;
openDrawer = (orig => (title, html, ...rest) => orig(title, UB_DN ? html + usedByHTML(UB_DN) : html, ...rest))(openDrawer);
showExt = (f => function(o){ UB_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ UB_DN = null; } })(showExt);
showQueue = (f => function(o){ UB_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ UB_DN = null; } })(showQueue);
showIVR = (f => function(o){ UB_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ UB_DN = null; } })(showIVR);
showRG = (f => function(o){ UB_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ UB_DN = null; } })(showRG);
showGroup = (f => function(o){ UB_DN = o && o.number; try{ return f.apply(this, arguments); }finally{ UB_DN = null; } })(showGroup);
document.addEventListener('click', e => { const a = e.target.closest('[data-ubdep]'); if(!a) return;
  const n = a.dataset.ubdep; window.__dp = {seg: SEGOF[n] && SEGOF[n][0] !== '@' ? SEGOF[n] : '', ext: n, rep: ''}; closeDrawer(); });

