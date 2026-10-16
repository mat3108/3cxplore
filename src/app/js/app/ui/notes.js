// ---------- Notes (mémorisées dans ce navigateur, par backup) ----------
const NOTES_KEY = () => 'notes3cx:' + (D.info.fqdn||'') + '|' + (D.info.date||'');
function loadNotes(){ try{ return JSON.parse(localStorage.getItem(NOTES_KEY()) || '{}'); }catch(e){ return {}; } }
function saveNotes(n){ try{ localStorage.setItem(NOTES_KEY(), JSON.stringify(n)); return true; }catch(e){ return false; } }

V.reco = el => {
  const F = analyse();
  let notes = loadNotes(); notes.status ||= {}; notes.text ||= {}; notes.custom ||= [];
  const cnt = s => F.filter(f => f.sev===s).length;
  el.innerHTML = `<div id="rwrap"><h2>Recommandations</h2>
  <p class="lead">Analyse automatique du backup : problèmes à corriger, risques et observations. Ajoutez vos propres notes et suivez l'avancement ; elles sont mémorisées dans ce navigateur pour ce backup.</p>
  <div class="grid kpis">${['crit','fix','obs'].map(s => `<div class="card kpi rk ${s}"><div class="v">${cnt(s)}</div><div class="l">${SEV[s].l}</div></div>`).join('')}
    <div class="card kpi"><div class="v">${Object.values(notes.status).filter(x => x==='done').length + notes.custom.filter(c => c.status==='done').length}</div><div class="l">Points corrigés</div></div></div>
  <div class="bar" style="margin-top:14px"><input type="search" id="rq" placeholder="Rechercher dans les recommandations…">
    <select id="rsev"><option value="">Toutes les sévérités</option>${Object.entries(SEV).map(([k,v]) => `<option value="${k}">${v.l}</option>`).join('')}</select>
    <select id="rcat"><option value="">Toutes les catégories</option>${[...new Set(F.map(f => f.cat))].sort().map(c => `<option>${esc(c)}</option>`).join('')}</select>
    <select id="rst"><option value="">Tous les statuts</option>${Object.entries(NOTE_ST).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <span class="sp" style="flex:1"></span><button class="btn" id="rexp">Exporter (CSV)</button><button class="btn" id="rprint">Imprimer</button></div>
  <div id="rlist"></div>
  <h3 style="margin-top:26px">Mes observations</h3>
  <div class="card rnew"><div class="rnewrow"><select id="nsev">${Object.entries(SEV).map(([k,v]) => `<option value="${k}"${k==='obs'?' selected':''}>${v.l}</option>`).join('')}</select>
    <input type="text" id="ntitle" placeholder="Titre (ex. Revoir le message du menu fermé)"></div>
    <textarea id="ntext" rows="3" placeholder="Détail, contexte, action à faire…"></textarea>
    <div><button class="btn primary" id="nadd">Ajouter l'observation</button> <span id="nmsg" class="muted" style="font-size:12.5px"></span></div></div>
  <div id="clist"></div></div>`;
  const W = $('#rwrap');
  const persist = () => { if(!saveNotes(notes)) $('#nmsg').textContent = 'Attention : le navigateur refuse la mémorisation, les notes seront perdues à la fermeture.'; };
  const stSel = (id, v) => `<select class="rstsel" data-id="${esc(id)}">${Object.entries(NOTE_ST).map(([k,l]) => `<option value="${k}"${(v||'todo')===k?' selected':''}>${l}</option>`).join('')}</select>`;
  function drawList(){
    const q = $('#rq').value.toLowerCase(), sv = $('#rsev').value, ct = $('#rcat').value, ss = $('#rst').value;
    const list = F.filter(f => (!sv || f.sev===sv) && (!ct || f.cat===ct) && (!ss || (notes.status[f.id]||'todo')===ss) &&
      (!q || [f.title, f.detail, f.reco, f.cat, notes.text[f.id]||'', ...f.items.map(i => i.text)].join(' ').toLowerCase().includes(q)));
    $('#rlist').innerHTML = list.map(f => { const s = notes.status[f.id]||'todo';
      return `<details class="card rcard ${f.sev} st-${s}" data-id="${esc(f.id)}"><summary>
        <span class="pill ${SEV[f.sev].c}">${SEV[f.sev].l}</span><span class="pill">${esc(f.cat)}</span>
        <span class="rt">${esc(f.title)}</span>${stSel(f.id, s)}</summary>
        <div class="rb"><p>${esc(f.detail)}</p><p class="rreco"><b>Recommandation :</b> ${esc(f.reco)}</p>
        ${f.items.length ? `<div class="ritems"><div class="muted" style="font-size:12px;margin-bottom:4px">Éléments concernés (${f.items.length})</div>${f.items.slice(0, 200).map(i => `<span class="ritem">${i.html}</span>`).join('')}${f.items.length>200?`<span class="muted">+ ${f.items.length-200} autres</span>`:''}</div>` : ''}
        <label class="muted" style="font-size:12px">Ma note</label><textarea class="rnote" data-id="${esc(f.id)}" rows="2" placeholder="Ajouter une note…">${esc(notes.text[f.id]||'')}</textarea></div></details>`; }).join('')
      || '<p class="muted">Aucune recommandation ne correspond aux filtres.</p>';
  }
  function drawCustom(){
    $('#clist').innerHTML = notes.custom.map((c, i) => `<div class="card rcard ${c.sev} st-${c.status||'todo'}"><div class="rhead">
      <span class="pill ${SEV[c.sev].c}">${SEV[c.sev].l}</span><span class="rt">${esc(c.title)}</span>
      <span class="muted" style="font-size:12px">${esc(fmtD(c.date))}</span>${stSel('custom:'+i, c.status)}<button class="btn rdel" data-i="${i}" title="Supprimer">×</button></div>
      ${c.text ? `<p class="rctext">${esc(c.text)}</p>` : ''}</div>`).join('') || '<p class="muted">Aucune observation ajoutée pour l\'instant.</p>';
  }
  drawList(); drawCustom();
  ['#rq','#rsev','#rcat','#rst'].forEach(s => $(s).addEventListener('input', drawList));
  W.addEventListener('change', e => { const s = e.target.closest('.rstsel'); if(!s) return; const id = s.dataset.id;
    if(id.startsWith('custom:')) notes.custom[+id.slice(7)].status = s.value; else notes.status[id] = s.value;
    persist(); const card = s.closest('.rcard'); card.className = card.className.replace(/st-\w+/, 'st-'+s.value); });
  W.addEventListener('click', e => { if(e.target.closest('.rstsel')) e.preventDefault(); });
  W.addEventListener('input', e => { const t = e.target.closest('.rnote'); if(!t) return; notes.text[t.dataset.id] = t.value; persist(); });
  $('#nadd').addEventListener('click', () => { const t = $('#ntitle').value.trim(); if(!t){ $('#ntitle').focus(); return; }
    notes.custom.unshift({sev: $('#nsev').value, title: t, text: $('#ntext').value.trim(), date: new Date().toISOString(), status: 'todo'});
    $('#ntitle').value = ''; $('#ntext').value = ''; persist(); drawCustom(); });
  $('#clist').addEventListener('click', e => { const b = e.target.closest('.rdel'); if(!b) return;
    if(confirm('Supprimer cette observation ?')){ notes.custom.splice(+b.dataset.i, 1); persist(); drawCustom(); } });
  $('#rexp').addEventListener('click', () => {
    const q = v => '"' + csvSafe(v) + '"';
    const rows = [['Sévérité','Catégorie','Titre','Détail','Recommandation','Éléments concernés','Statut','Note']];
    F.forEach(f => rows.push([SEV[f.sev].l, f.cat, f.title, f.detail, f.reco, f.items.map(i => i.text).join(' | '), NOTE_ST[notes.status[f.id]||'todo'], notes.text[f.id]||'']));
    notes.custom.forEach(c => rows.push([SEV[c.sev].l, 'Observation manuelle', c.title, c.text, '', '', NOTE_ST[c.status||'todo'], '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = 'recommandations-3cx.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#rprint').addEventListener('click', () => { W.querySelectorAll('details.rcard').forEach(d => d.open = true); window.print(); });
};

