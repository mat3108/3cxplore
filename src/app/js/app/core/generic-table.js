// ---------- Table générique ----------
function table(el, {cols, rows, search, pageSize=50, onRow, sort, filters, state, rowCls}){
  // state (facultatif) : objet conservé par l'appelant pour retrouver recherche, filtres, tri et page après un nouvel affichage
  const S = state || {};
  let q=S.q||'', page=S.page||0, sk=S.sk!==undefined?S.sk:(sort?sort[0]:null), sd=S.sd||(sort?sort[1]:1), fvals={...(S.fvals||{})};
  const keep = () => { if(state) Object.assign(state, {q, page, sk, sd, fvals: {...fvals}}); };
  el.innerHTML = `<div class="bar"><input type="search" placeholder="Rechercher…">${filters&&filters.length?'<button type="button" class="btn fbtn" aria-expanded="false"><span>Filtres</span><span class="fn"></span></button>':''}${(filters||[]).map((f,i)=>`<select data-f="${i}"><option value="">${esc(f.label)}</option>${f.options.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`).join('')}<span class="count"></span></div><div class="tw"><table><thead><tr>${cols.map((c,i)=>`<th data-i="${i}" class="${c.num?'num':''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="pager"><button data-p="-1">‹ Préc.</button><span class="count pg"></span><button data-p="1">Suiv. ›</button></div>`;
  const tb = el.querySelector('tbody');
  let view = rows;
  function apply(){
    const qq = q.toLowerCase();
    view = rows.filter(r => (!qq || search(r).toLowerCase().includes(qq)) && (filters||[]).every((f,i)=>!fvals[i] || f.test(r,fvals[i])));
    if(sk!==null){ const c=cols[sk], k=c.sort||c.v; view = view.slice().sort((a,b)=>{const x=k(a),y=k(b); return (x>y?1:x<y?-1:0)*sd;}); }
    page=0; draw();
  }
  function draw(){
    const n = view.length, pages = Math.max(1, Math.ceil(n/pageSize));
    page = Math.min(page, pages-1);
    tb.innerHTML = view.slice(page*pageSize,(page+1)*pageSize).map((r,i)=>`<tr data-i="${page*pageSize+i}" class="${onRow?'click':''}${rowCls?' '+(rowCls(r)||''):''}">${cols.map(c=>`<td class="${c.num?'num':''} ${c.cls||''}">${c.f?c.f(r):esc(c.v(r))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="muted">Aucun résultat</td></tr>`;
    el.querySelector('.count').textContent = nf(n)+' élément'+(n>1?'s':'');
    el.querySelector('.pg').textContent = `Page ${page+1} / ${pages}`;
    el.querySelector('[data-p="-1"]').disabled = page===0;
    el.querySelector('[data-p="1"]').disabled = page>=pages-1;
    el.querySelector('.pager').style.display = pages>1?'':'none';
    el.querySelectorAll('th').forEach((th,i)=>th.className=(cols[i].num?'num ':'')+(i===sk?(sd>0?'s-asc':'s-desc'):''));
    keep();
  }
  el.querySelector('input').addEventListener('input', e => { q=e.target.value; apply(); });
  el.querySelectorAll('select[data-f]').forEach(s=>s.addEventListener('change',e=>{fvals[s.dataset.f]=e.target.value; apply();}));
  el.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{const i=+th.dataset.i; if(sk===i) sd=-sd; else {sk=i; sd=cols[i].num?-1:1;} apply();}));
  el.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{page+=+b.dataset.p; draw();}));
  // 19.3.2 : sur téléphone, les listes de filtres se rangent derrière le bouton « Filtres » (nombre de filtres actifs entre parenthèses)
  const fb = el.querySelector('.fbtn'), fcount = () => { if(!fb) return; const n = Object.values(fvals).filter(Boolean).length; fb.querySelector('.fn').textContent = n ? '('+n+')' : ''; fb.classList.toggle('on', n>0); };
  if(fb) fb.addEventListener('click', () => { const b = el.querySelector('.bar'); b.classList.toggle('fopen'); fb.setAttribute('aria-expanded', b.classList.contains('fopen')); });
  el.querySelectorAll('select[data-f]').forEach(s=>s.addEventListener('change', fcount));
  tb.addEventListener('click', e => { if(e.target.closest('a,audio,input,select,button,label,summary,details')) return; const tr=e.target.closest('tr[data-i]'); if(tr && onRow) onRow(view[+tr.dataset.i]); });
  // restaurer l'état mémorisé (valeurs des champs, puis page)
  el.querySelector('input').value = q;
  el.querySelectorAll('select[data-f]').forEach(s => { if(fvals[s.dataset.f]) s.value = fvals[s.dataset.f]; });
  fcount(); const startPage = page; apply();
  if(startPage){ page = startPage; draw(); }
}

