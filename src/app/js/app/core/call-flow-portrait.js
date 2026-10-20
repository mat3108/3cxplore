// ---------- Diagramme en portrait (18.1) : le parcours de haut en bas, pour une page lettre à imprimer ou envoyer en PDF ----------
// chaque élément une seule fois ; un élément déjà affiché est rappelé par un renvoi « voir plus haut »
const DGP_KEY = 'diagportrait3cx';
const dgpOn = () => { try{ return localStorage.getItem(DGP_KEY) === '1'; }catch(e){ return false; } };
function renderFlowPortrait(g, r){
  const kids = {}; g.edges.forEach(e => (kids[e.from] ||= []).push(e));
  const shown = new Set(), num = {}; let html = '', k = 0;
  // plusieurs cas qui mènent au même élément : « … ou … » (chaque cas dans sa propre balise pour la traduction)
  const lbl = ls => ls && ls.length ? `<span class="dgp-lbl">${ls.map(l => `<span>${esc(l)}</span>`).join(' <i class="dgp-ou">ou</i> ')}</span>` : '';
  const walk = (id, depth, label) => {
    const n = g.nodes.get(id); if(!n) return;
    const st = KIND_STYLE[n.kind] || KIND_STYLE.other;
    if(shown.has(id)){ html += `<div class="dgp-row" style="--d:${depth}">${depth ? '<span class="dgp-arr">↳</span>' : ''}${lbl(label)}<div class="dgp-ref" style="--c:${st.c}"><span>${esc(st.t)}</span> <b>${esc(n.title)}</b>${n.sub ? ` <span class="mono">${esc(n.sub)}</span>` : ''} <span class="muted">(voir plus haut, n° ${num[id]})</span></div></div>`; return; }
    shown.add(id); num[id] = ++k;
    html += `<div class="dgp-row" style="--d:${depth}">${depth ? '<span class="dgp-arr">↳</span>' : ''}${lbl(label)}<div class="dgp-box" style="--c:${st.c}"><div class="dgp-k"><span class="dgp-n">${num[id]}</span> <span>${esc(st.t)}</span>${n.sub ? ` · <span class="mono">${esc(n.sub)}</span>` : ''}</div><div class="dgp-t">${esc(n.title)}</div>`
      + n.lines.map(l => `<div class="dgp-l">${esc(l)}</div>`).join('')
      + (n.agents ? `<div class="dgp-l"><b>${n.agents.length} agent${n.agents.length > 1 ? 's' : ''}</b> : ${n.agents.slice(0, 24).map(esc).join(' · ')}${n.agents.length > 24 ? ` · + ${n.agents.length - 24}` : ''}</div>` : '') + `</div></div>`;
    (kids[id] || []).filter(e => !e.back || true).forEach(e => walk(e.to, depth + 1, e.labels));
  };
  walk('did', 0, []); g.nodes.forEach((n, id) => { if(!shown.has(id)) walk(id, 0, []); });
  const used = [...new Set([...g.nodes.values()].map(n => n.kind))];
  return `<div class="report dgp" id="dgpsheet"><header class="rpcover"><div class="rpk">Parcours des appels · 3CXplore</div><h1>${esc(phone(r.did))}</h1>
    <div class="rpmeta">${esc(segName(DIDSEG[r.did] || SEG_COMMON))} · trunk ${esc(r.line.gateway || r.line.number)} · ${esc(ruleLabel(r))} · ${nf(g.nodes.size)} éléments${lineCalls[r.did] ? ` · ${nf(lineCalls[r.did])} appels reçus dans le backup` : ''} · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
    <div class="dgp-body">${html}</div>
    <div class="dgp-leg">${used.map(kd => { const st = KIND_STYLE[kd] || KIND_STYLE.other; return `<span><i style="background:${st.c}"></i>${esc(st.t)}</span>`; }).join('')}</div>
    <div class="rpfoot">Lecture : de haut en bas, l'appel passe d'un élément au suivant ; le texte sur la flèche indique le choix ou le moment (touche du menu, ouvert / fermé, délai). Un élément déjà affiché est rappelé par son numéro. Configuration du backup du ${esc(bkDate(FULL.info.date))}.</div></div>`;
}
const ruleLabel = r => r.rule ? (r.rule.name || (r.isDefault ? 'règle par défaut du trunk' : 'règle du SDA')) : 'aucune règle';
V.diagramme = (el, arg) => {
  const opts = allDIDs.slice().sort((a,b) => (lineCalls[b.did]||0) - (lineCalls[a.did]||0));
  el.innerHTML = `<h2>Flux d'appel (diagramme)</h2>
  <p class="lead">Choisissez un SDA : le diagramme montre tout le parcours d'un appel entrant sur ce numéro (règle entrante, départements, standards, files, agents, renvois). Cliquez sur une boîte pour ouvrir sa fiche.</p>
  <div class="bar dgbar">
    <input type="search" id="dgq" placeholder="Filtrer les SDA (numéro, règle, destination)…">
    <select id="dgsel"></select>
    <span class="sp"></span>
    <div class="dgzoom"><button class="btn" data-z="-1" title="Zoom arrière">−</button><button class="btn" data-z="0" title="Ajuster à la fenêtre">Ajuster</button><button class="btn" data-z="1" title="Zoom avant">+</button>
    <button class="btn" id="dgdl">Télécharger (SVG)</button><button class="btn" id="dgpr">Imprimer</button></div>
    <label class="tourtgl" title="Parcours de haut en bas, lisible sur une page lettre : à imprimer ou à enregistrer en PDF pour l'envoyer par courriel"><input type="checkbox" id="dgport"${dgpOn() ? ' checked' : ''}> Portrait (lettre)</label>
  </div>
  <div id="dghead" class="dghead"></div>
  <div class="diag" id="dg"><p class="muted" style="padding:20px">Sélectionnez un SDA.</p></div>
  <div class="legend dglegend">${Object.entries(KIND_STYLE).filter(([k])=>!['other','rule'].includes(k)).map(([k,v])=>`<span><i style="background:${v.c}"></i>${esc(v.t)}</span>`).join('')}<span><i style="background:transparent;border:1.5px dashed var(--muted)"></i>Retour vers un élément déjà affiché</span><span>Ouvert / Fermé / Pause / Fériés : selon l'horaire du département ou de la règle</span></div>`;
  const sel = $('#dgsel'), dg = $('#dg');
  const label = r => `${phone(r.did)} — ${ruleLabel(r)} → ${r.rule?.office ? (dnName(r.rule.office.dn) || TO_FR[r.rule.office.to] || r.rule.office.to) : '–'}${lineCalls[r.did]?` (${nf(lineCalls[r.did])} appels)`:''}`;
  const fill = qq => {
    qq = (qq||'').toLowerCase().replace(/[\s().-]/g,'');
    const cur = sel.value;
    const list = opts.filter(r => !qq || (r.did + label(r)).toLowerCase().replace(/[\s().-]/g,'').includes(qq));
    sel.innerHTML = `<option value="">— Choisir un SDA (${list.length}) —</option>` + list.map(r => `<option value="${esc(r.did)}">${esc(label(r))}</option>`).join('');
    if(list.some(r => r.did===cur)) sel.value = cur;
  };
  let zoom = 1, cur = null;
  const applyZoom = () => { const s = dg.querySelector('svg'); if(s && cur){ s.setAttribute('width', cur.W*zoom); s.setAttribute('height', cur.Hh*zoom); } };
  const fit = () => { if(cur){ zoom = Math.min(1.2, Math.max(0.25, (dg.clientWidth-20)/cur.W)); applyZoom(); } };
  const draw = did => {
    const r = allDIDs.find(x => x.did===did);
    if(!r){ dg.innerHTML = '<p class="muted" style="padding:20px">Sélectionnez un SDA.</p>'; $('#dghead').innerHTML=''; cur = null; return; }
    const g = buildFlow(r);
    el.classList.toggle('dgportrait', dgpOn());
    if(dgpOn()){ cur = null; $('#dgpr').textContent = 'Imprimer / PDF';
      $('#dghead').innerHTML = `<b class="mono">${esc(phone(r.did))}</b> · ${g.nodes.size} éléments · <a class="dlink" href="#simulateur/${esc(r.did)}">Simuler un appel ▸</a>`;
      dg.innerHTML = renderFlowPortrait(g, r);
      if(location.hash !== '#diagramme/'+did) history.replaceState(null, '', '#diagramme/'+did); return; }
    $('#dgpr').textContent = 'Imprimer';
    cur = renderFlow(g);
    $('#dghead').innerHTML = `<b class="mono">${esc(phone(r.did))}</b> · trunk ${dnLink(r.line.number)} · ${esc(ruleLabel(r))} · ${g.nodes.size} éléments · <a class="dlink" href="#simulateur/${esc(r.did)}">Simuler un appel ▸</a>`;
    dg.innerHTML = cur.svg;
    fit();
    dg.querySelectorAll('.f-node.click').forEach(n => n.addEventListener('click', () => showDN(n.dataset.dn)));
    if(location.hash !== '#diagramme/'+did) history.replaceState(null, '', '#diagramme/'+did);
  };
  fill('');
  $('#dgq').addEventListener('input', e => fill(e.target.value));
  sel.addEventListener('change', () => draw(sel.value));
  el.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => { const z = +b.dataset.z; if(z===0) fit(); else { zoom = Math.min(3, Math.max(0.2, zoom*(z>0?1.25:0.8))); applyZoom(); } }));
  dg.addEventListener('wheel', e => { if(!(e.ctrlKey||e.metaKey) || !cur) return; e.preventDefault(); zoom = Math.min(3, Math.max(0.2, zoom*(e.deltaY<0?1.1:0.9))); applyZoom(); }, {passive:false});
  // déplacement à la souris
  let drag = null;
  dg.addEventListener('mousedown', e => { if(e.target.closest('.f-node')) return; drag = {x:e.clientX, y:e.clientY, l:dg.scrollLeft, t:dg.scrollTop}; dg.classList.add('grab'); });
  window.addEventListener('mousemove', e => { if(drag){ dg.scrollLeft = drag.l-(e.clientX-drag.x); dg.scrollTop = drag.t-(e.clientY-drag.y); } });
  window.addEventListener('mouseup', () => { drag = null; dg.classList.remove('grab'); });
  $('#dgdl').addEventListener('click', () => {
    const s = dg.querySelector('svg'); if(!s) return;
    const c = s.cloneNode(true); c.setAttribute('width', cur.W); c.setAttribute('height', cur.Hh);
    const cs = getComputedStyle(document.documentElement);
    const vars = ['--bg','--panel','--text','--muted','--line','--accent','--warn','--bad','--c-out','--c-int','--k-dept','--k-rg','--k-xt'].map(v => `${v}:${cs.getPropertyValue(v).trim()}`).join(';');
    const st = document.createElementNS('http://www.w3.org/2000/svg','style');
    st.textContent = `svg{${vars}} ${FLOW_CSS}`;
    c.insertBefore(st, c.firstChild);
    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('width','100%'); bg.setAttribute('height','100%'); bg.setAttribute('style','fill:var(--bg)');
    c.insertBefore(bg, st.nextSibling);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], {type:'image/svg+xml'}));
    a.download = 'flux-'+sel.value+'.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#dgpr').addEventListener('click', () => { const p = $('#dgpsheet');
    if(dgpOn() && p) printHTML('<style>@page{size:letter portrait;margin:12mm}</style>' + p.outerHTML.replace('id="dgpsheet"', ''));
    else { fit(); window.print(); } });
  $('#dgport').addEventListener('change', e => { try{ localStorage.setItem(DGP_KEY, e.target.checked ? '1' : '0'); }catch(er){} draw(sel.value); });
  if(arg && allDIDs.some(r => r.did===arg)){ sel.value = arg; if(sel.value !== arg){ $('#dgq').value=''; fill(''); sel.value = arg; } draw(arg); }
};
const FLOW_CSS = `.f-box{fill:var(--panel);stroke-width:1.5} .f-kind{font-size:10px;font-weight:700;letter-spacing:.04em}
.f-title{font-size:13.5px;font-weight:650;fill:var(--text)} .f-line{font-size:11.5px;fill:var(--muted)} .f-line.strong{fill:var(--text);font-weight:600}
.f-edge{fill:none;stroke:var(--muted);stroke-width:1.4} .f-edge.back{stroke-dasharray:5 4} .f-arrow{fill:var(--muted)}
.f-elabel{font-size:11px;fill:var(--text);paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round}`;

V.flux = el => {
  el.innerHTML = `<h2>Flux d'appels entrants</h2><p class="lead">Pour chaque numéro (DID) : la règle d'acheminement, puis l'arbre complet (département → standard → files → agents). Cliquez sur un nom pour voir sa fiche.</p><div id="ft"></div>`;
  const rows = allDIDs.map(x=>x);
  table($('#ft'), {
    rows, pageSize:40, sort:[3,-1],
    search: r => [r.did, r.rule?.name, r.line.gateway, dnName(r.rule?.office?.dn)].join(' '),
    cols: [
      {h:'Numéro', v:r=>r.did, f:r=>`<span class="mono">${esc(phone(r.did))}</span>`},
      {h:'Règle', v:r=>r.rule?.name||''},
      {h:'Trunk', v:r=>r.line.gateway},
      {h:'Appels', num:1, v:r=>lineCalls[r.did]||0, f:r=>nf(lineCalls[r.did]||0)},
      {h:'Heures d\'ouverture', v:r=>dnName(r.rule?.office?.dn), f:r=>destHTML(r.rule?.office)},
      {h:'Hors heures', v:r=>dnName(r.rule?.outOfOffice?.dn), f:r=>r.rule&&r.rule.altOOO?destHTML(r.rule.outOfOffice):'<span class="muted">idem</span>'},
    ],
    onRow: r => {
      const ru = r.rule;
      openDrawer(`<span class="mono">${esc(phone(r.did))}</span> ${esc(ru?.name||'')}`,
        kv([['Trunk', dnLink(r.line.number)], ['Règle', esc(ru?.name||(r.isDefault?'Règle par défaut du trunk (ForwardAll)':'(sans nom)'))], ['Diagramme', `<a class="btn" href="#diagramme/${esc(r.did)}">Voir le diagramme du flux</a>`], ['Condition', esc(ru?.cond||'')], ['Type d\'appel', esc(ru?.callType||'')], ['Appels reçus', nf(lineCalls[r.did]||0)]]) +
        `<h3>Heures d'ouverture</h3><div class="tree">${ru?.office?.dn?flowNode(ru.office.dn,0,new Set()):destHTML(ru?.office)}</div>` +
        (ru&&ru.altOOO?`<h3>Hors heures</h3><div class="tree">${ru.outOfOffice?.dn?flowNode(ru.outOfOffice.dn,0,new Set()):destHTML(ru.outOfOffice)}</div>`:'') +
        (ru&&ru.altHol?`<h3>Fériés</h3><div class="tree">${ru.holidays?.dn?flowNode(ru.holidays.dn,0,new Set()):destHTML(ru.holidays)}</div>`:''));
    }
  });
};

V.postes = el => {
  el.innerHTML = `<h2>Postes</h2><p class="lead">Utilisateurs, appareils, appartenances aux files et départements.</p><div id="t"></div>`;
  const deps = [...new Set(D.extensions.flatMap(e=>e.groups.map(g=>g.g)))].sort();
  table($('#t'), {
    rows: D.extensions, sort:[0,1],
    search: e => [e.number,e.first,e.last,e.email,e.callerId,e.azure,...e.groups.map(g=>g.g),...e.devices.map(d=>d.mac+' '+d.model)].join(' '),
    filters: [
      {label:'Tous les départements', options:deps.map(d=>[d,d]), test:(e,v)=>e.groups.some(g=>g.g===v)},
      {label:'Statut', options:Object.entries(FWD_ST), test:(e,v)=>e.profile===v},
      {label:'Appareil', options:[['1','Avec téléphone'],['0','Sans téléphone']], test:(e,v)=>(e.devices.length>0)===(v==='1')},
    ],
    cols: [
      {h:'Poste', v:e=>e.number, cls:'mono'},
      {h:'Nom', v:e=>(e.first+' '+e.last).trim()},
      {h:'Courriel', v:e=>e.email, cls:'muted'},
      {h:'Départements', v:e=>e.groups.map(g=>g.g).join(', '), f:e=>{ // 19.3.2 : au-delà de 4 départements, les autres se déplient (responsables en premier)
        const pl = g=>`<span class="pill ${g.role==='supervisors'||g.role==='managers'?'warn':''}">${esc(g.g)}${g.role&&g.role!=='users'?' · '+esc(g.role):''}</span>`;
        const gs = e.groups.filter(g=>g.g!=='__DEFAULT__'), lead = g=>g.role==='supervisors'||g.role==='managers'?0:1;
        if(gs.length<=5) return gs.map(pl).join('');
        const o = gs.slice().sort((a,b)=>lead(a)-lead(b));
        return o.slice(0,4).map(pl).join('')+`<details class="pmore"><summary>+${o.length-4} autres</summary>${o.slice(4).map(pl).join('')}</details>`; }},
      {h:'Files', num:1, v:e=>e.queues.length},
      {h:'Téléphone', v:e=>e.devices.map(d=>d.model).join(', '), f:e=>e.devices.map(d=>`<span class="pill">${esc(d.model||d.template)}</span>`).join('')||'<span class="muted">–</span>'},
      {h:'Statut', v:e=>e.profile, f:e=>`<span class="pill ${e.profile==='Available'?'ok':e.profile==='Away'?'warn':''}">${esc(fwdName(e.profile))}</span>`},
      {h:'Enreg.', v:e=>e.record?1:0, f:e=>e.record?'<span class="pill acc">Oui</span>':''},
    ],
    onRow: showExt
  });
};
function showExt(e){
  const myCalls = D.calls.filter(c=>c[6]===e.number || c[2]===e.number);
  const vms = D.voicemails.filter(v=>v.ext===e.number), gr = D.vmGreetings.filter(v=>v.ext===e.number);
  openDrawer(`<span class="mono">${esc(e.number)}</span> ${esc(e.first+' '+e.last)}`,
    kv([['Courriel',esc(e.email)],['Compte Microsoft 365',esc(e.azure)],['Caller ID sortant',`<span class="mono">${esc(phone(e.callerId))}</span>`],['Mobile',esc(phone(e.mobile))],
      ['Actif',yes(e.enabled)],['Profil actuel',esc(fwdName(e.profile))],['Statut files',esc(e.queueStatus)],['Enregistrement',yes(e.record)],
      ['Messagerie vocale',yes(e.vm)+' '+esc(e.vmEmail)],['LAN seulement',yes(e.lanOnly)],['Délai sans réponse',esc(e.noAnswer)+' s'],
      ['Appels (traités / initiés)', nf(myCalls.length)]]) +
    `<h3>Départements</h3>${e.groups.map(g=>`<span class="pill">${esc(g.g)} · ${esc(g.role)}</span>`).join('')||'<span class="muted">–</span>'}` +
    `<h3>Files d'attente</h3>${e.queues.map(q=>dnLink(q)).join('<br>')||'<span class="muted">–</span>'}` +
    (e.ringGroups.length?`<h3>Groupes de sonnerie</h3>${e.ringGroups.map(q=>dnLink(q)).join('<br>')}`:'') +
    `<h3>Téléphones</h3>${e.devices.map(d=>kv([['Modèle',esc(d.model)],['MAC',`<span class="mono">${esc(d.mac.replace(/(..)(?!$)/g,'$1:'))}</span>`],['Firmware',esc(d.firmware)],['Gabarit',esc(d.template)],['Langue',esc(d.lang)],['Interface',esc(d.iface)],['SBC',esc(d.sbc)]])).join('<hr style="border:0;border-top:1px solid var(--line)">')||'<span class="muted">Aucun appareil provisionné</span>'}` +
    `<h3>Profils de renvoi</h3>${e.profiles.map(p=>`<details><summary><b>${esc(fwdName(p.name))}</b> ${p.display?`<span class="muted">« ${esc(p.display)} »</span>`:''}</summary>${kv(p.routes.map(([k,d])=>[k.replace(/Route|AllHours|OutOfOfficeHours/g,m=>({Route:'',AllHours:'toutes heures',OutOfOfficeHours:'hors heures'}[m])), fwdBusy(k,d)?'<span class="lbl">Refusé (occupé)</span>':destHTML(d)]))}</details>`).join('')}` +
    (gr.length?`<h3>Message d'accueil</h3>${gr.map(g=>audio(g.path)).join('')}`:'') +
    (vms.length?`<h3>Messages vocaux (${vms.length})</h3>${vms.map(v=>`<div>${esc(phone(v.from))} · ${esc(fmtD(vmUTC(v.date)) || v.date)}<br>${audio(v.path)}</div>`).join('')}`:'') +
    `<h3>Propriétés</h3>${kv(Object.entries(e.props).filter(([k,v])=>v!=='').map(([k,v])=>[k,`<span class="mono">${esc(v)}</span>`]))}`);
}

V.groupes = el => {
  el.innerHTML = `<h2>Départements</h2><p class="lead">Groupes 3CX : heures d'ouverture, acheminement selon l'horaire, membres.</p><div id="t"></div>`;
  table($('#t'), {
    rows: D.groups, sort:[0,1],
    search: g => [g.number,g.name].join(' '),
    cols: [
      {h:'N°', v:g=>g.number, cls:'mono'}, {h:'Nom', v:g=>g.name},
      {h:'Membres', num:1, v:g=>g.members.length},
      {h:'Ouvert →', v:g=>g.routes.office?.dn||'', f:g=>destHTML(g.routes.office)},
      {h:'Fermé →', v:g=>g.routes.outOfOffice?.dn||'', f:g=>destHTML(g.routes.outOfOffice)},
      {h:'Horaire', v:g=>g.hours?.days.length||0, f:g=>g.hours&&g.hours.days.length?g.hours.days.map(d=>`<span class="pill">${(DAYS_FR[d.day] || d.day || '?').slice(0,3)} ${d.p.map(p=>p.join('-')).join(',')}</span>`).join(''):'<span class="muted">–</span>'},
    ],
    onRow: showGroup
  });
};
function showGroup(g){
  const R = {office:'Heures d\'ouverture',outOfOffice:'Hors heures',break:'Pause',holidays:'Fériés'};
  openDrawer(`<span class="mono">${esc(g.number)}</span> ${esc(g.name)}`,
    `${isSysGroup(g) ? '' : `<p><a class="btn" href="#deptrap/${esc(g.number)}">Rapport du département</a></p>`}<h3>Horaire</h3>${hoursHTML(g.hours)}` + (g.breakTime&&g.breakTime.days.length?`<h3>Pauses</h3>${hoursHTML(g.breakTime)}`:'') +
    `<h3>Acheminement</h3>${kv(Object.keys(R).map(k=>[R[k], destHTML(g.routes[k]) + (g.prompts[k]?`<div style="margin-top:4px">${promptHTML(g.prompts[k])}</div>`:'')]))}` +
    `<h3>Opérateur</h3>${destHTML(g.operator)}` +
    (g.holidays.length?`<h3>Jours fériés</h3>${g.holidays.map(h=>`<span class="pill">${esc(h)}</span>`).join('')}`:'') +
    `<h3>Arbre d'acheminement</h3><div class="tree">${flowNode(g.number,0,new Set())}</div>` +
    `<h3>Membres (${g.members.length})</h3>${g.members.map(m=>`<div>${dnLink(m.dn)} <span class="pill">${esc(m.role)}</span></div>`).join('')}`);
}

V.files = el => {
  el.innerHTML = `<h2>Files d'attente</h2><p class="lead">Configuration et statistiques (données callcent_queuecalls du backup).</p><div id="t"></div>`;
  const st = n => D.queueStats[n] || {total:0,served:0,abandoned:0,wait:0,waitServed:0,talk:0};
  table($('#t'), {
    rows: D.queues, sort:[0,1],
    search: q => [q.number,q.name,q.strategy].join(' '),
    cols: [
      {h:'N°', v:q=>q.number, cls:'mono'}, {h:'Nom', v:q=>q.name},
      {h:'Stratégie', v:q=>q.strategy, f:q=>`<span class="pill">${esc(q.strategy)}</span>`},
      {h:'Agents', num:1, v:q=>q.members.length},
      {h:'Appels', num:1, v:q=>st(q.number).total, f:q=>nf(st(q.number).total)},
      {h:'Servis', num:1, v:q=>st(q.number).total?st(q.number).served/st(q.number).total:-1, f:q=>pct(st(q.number).served, st(q.number).total)},
      {h:'Attente moy. (servis)', num:1, v:q=>st(q.number).served?st(q.number).waitServed/st(q.number).served:0, f:q=>st(q.number).served?dur(Math.round(st(q.number).waitServed/st(q.number).served)):'–'},
      {h:'Délai max →', v:q=>q.dest?.dn||'', f:q=>destHTML(q.dest)},
    ],
    onRow: showQueue
  });
};
function showQueue(q){
  const s = D.queueStats[q.number] || {total:0,served:0,abandoned:0,noAgents:0,wait:0,waitServed:0,talk:0,hours:Array(24).fill(0)};
  const qh = Array(24).fill(0); (FULL.queueCalls || []).forEach(r => { if(r[1] === q.number) qh[localParts(r[0])[1]]++; }); // 18.2.30 : heure du système 3CX
  const mx = Math.max(...qh,1);
  openDrawer(`<span class="mono">${esc(q.number)}</span> ${esc(q.name)}`,
    `<div class="grid kpis">${[['Appels',nf(s.total)],['Servis',pct(s.served,s.total)],['Abandonnés',nf(s.abandoned)],['Sans agent',nf(s.noAgents)],['Attente moy. (servis)',s.served?dur(Math.round(s.waitServed/s.served)):'–'],['Attente avant abandon',s.abandoned?dur(Math.round((s.wait-s.waitServed)/s.abandoned)):'–'],['Conversation moy.',s.served?dur(Math.round(s.talk/s.served)):'–']].map(([l,v])=>`<div class="card kpi"><div class="v" style="font-size:19px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>` +
    (s.total?`<h3>Appels par heure</h3><div style="display:flex;align-items:flex-end;gap:2px;height:60px">${qh.map((h,i)=>`<div title="${i} h : ${h}" style="flex:1;background:var(--accent);height:${100*h/mx}%;min-height:${h?2:0}px;border-radius:2px 2px 0 0"></div>`).join('')}</div>`:'') +
    kv([['Stratégie',esc(q.strategy)],['Sonnerie par agent',esc(q.ringTimeout)+' s'],['Attente maximale',esc(q.masterTimeout)+' s'],['Destination au délai max',destHTML(q.dest)],
      ['Annonce de position',yes(q.announcePos)+' (toutes les '+esc(q.announceInterval)+' s)'],['Intro',(q.introEnabled?'':'<span class="pill">désactivée</span> ')+promptHTML(q.intro)],['Musique d\'attente',promptHTML(q.moh)]]) +
    `<h3>Agents (${q.members.length})</h3>${q.members.map(m=>`<div>${dnLink(m.dn)} <span class="pill ${m.status==='LoggedIn'?'ok':''}">${m.status==='LoggedIn'?'Connecté':esc(m.status)}</span></div>`).join('')||'<span class="muted">Aucun</span>'}` +
    `<h3>Gestionnaires</h3>${q.managers.map(m=>dnLink(m)).join('<br>')||'<span class="muted">–</span>'}`);
}

V.ivr = el => {
  el.innerHTML = `<h2>Standards automatiques (IVR)</h2><p class="lead">Menus vocaux : message, touches et destinations.</p><div id="t"></div>`;
  table($('#t'), {
    rows: D.ivrs, sort:[0,1],
    search: i => [i.number,i.name,i.prompt,...i.options.map(o=>dnName(o.dn))].join(' '),
    cols: [
      {h:'N°', v:i=>i.number, cls:'mono'}, {h:'Nom', v:i=>i.name},
      {h:'Message', v:i=>i.prompt, f:i=>i.prompt?esc(i.prompt):'<span class="muted">–</span>'},
      {h:'Touches', v:i=>i.options.length, f:i=>i.options.slice().sort((a,b)=>a.key.localeCompare(b.key)).map(o=>`<span class="pill" title="${esc(dnName(o.dn))}">${esc(o.key)} → ${esc(o.dn)}</span>`).join('')},
      {h:'Sans choix', v:i=>i.timeoutType, f:i=>`${esc(TO_FR[i.timeoutType]||i.timeoutType)} ${i.timeoutDN?dnLink(i.timeoutDN,true):''}`},
    ],
    onRow: showIVR
  });
};
function showIVR(i){
  openDrawer(`<span class="mono">${esc(i.number)}</span> ${esc(i.name)}`,
    `<h3>Message</h3>${promptHTML(i.prompt)}` +
    `<h3>Touches</h3>${kv(i.options.slice().sort((a,b)=>a.key.localeCompare(b.key)).map(o=>['Touche '+o.key, destHTML({to:o.type,dn:o.dn,ext:o.data})]))}` +
    kv([['Délai',esc(i.timeout)+' s'],['Sans choix',destHTML({to:i.timeoutType,dn:i.timeoutDN})],['Touche invalide',i.invalidDN?dnLink(i.invalidDN):'–']]) +
    `<h3>Arbre</h3><div class="tree">${flowNode(i.number,0,new Set())}</div>`);
}

V.sonnerie = el => {
  el.innerHTML = `<h2>Groupes de sonnerie</h2><p class="lead">&nbsp;</p><div id="t"></div>`;
  table($('#t'), {
    rows: D.ringGroups, sort:[0,1], search: r=>[r.number,r.name].join(' '),
    cols: [{h:'N°',v:r=>r.number,cls:'mono'},{h:'Nom',v:r=>r.name},{h:'Stratégie',v:r=>r.strategy},{h:'Sonnerie',num:1,v:r=>+r.ringTime,f:r=>esc(r.ringTime)+' s'},
      {h:'Membres',v:r=>r.members.length,f:r=>r.members.map(m=>`<span class="pill">${esc(m)} ${esc(dnName(m))}</span>`).join('')},{h:'Sans réponse →',v:r=>r.dest?.to||'',f:r=>destHTML(r.dest)}],
    onRow: showRG
  });
};
function showRG(r){ openDrawer(`<span class="mono">${esc(r.number)}</span> ${esc(r.name)}`, kv([['Stratégie',esc(r.strategy)],['Sonnerie',esc(r.ringTime)+' s'],['Sans réponse',destHTML(r.dest)]]) + `<h3>Membres</h3>${r.members.map(m=>dnLink(m)).join('<br>')}`); }

V.trunks = el => {
  el.innerHTML = `<h2>Trunks & passerelles</h2><p class="lead">Fournisseurs SIP, ponts (bridges) et lignes externes.</p><h3>Lignes externes</h3><div id="t1"></div><h3>Passerelles / fournisseurs</h3><div id="t2"></div>`;
  table($('#t1'), {
    rows: D.lines, search: l=>[l.number,l.gateway,l.extNumber,...l.dids].join(' '),
    cols: [{h:'N°',v:l=>l.number,cls:'mono'},{h:'Passerelle',v:l=>l.gateway},{h:'Numéro principal',v:l=>l.extNumber,f:l=>`<span class="mono">${esc(phone(l.extNumber))}</span>`},
      {h:'Direction',v:l=>l.direction},{h:'Appels simult.',num:1,v:l=>+l.sim},{h:'DID',num:1,v:l=>l.dids.length},{h:'Règles',num:1,v:l=>l.rules.length}],
    onRow: showLine
  });
  table($('#t2'), {
    rows: D.gateways, search: g=>[g.name,g.host,g.type].join(' '),
    cols: [{h:'Nom',v:g=>g.name},{h:'Type',v:g=>g.type,f:g=>`<span class="pill ${g.type==='Provider'?'acc':''}">${esc(g.type)}</span>`},{h:'Hôte',v:g=>g.host,cls:'mono',f:g=>esc(g.host)+(g.host&&g.port&&g.port!=='0'?':'+esc(g.port):'')},
      {h:'Gabarit',v:g=>g.template,cls:'muted'},{h:'Enregistrement',v:g=>g.reg},{h:'Codecs',v:g=>g.codecs.join(', ')},{h:'SRTP',v:g=>g.srtp}],
  });
};
function showLine(l){
  openDrawer(`Trunk <span class="mono">${esc(l.number)}</span> ${esc(l.gateway)}`,
    kv([['Passerelle',esc(l.gateway)],['Numéro principal',esc(phone(l.extNumber))],['Direction',esc(l.direction)],['Appels simultanés',esc(l.sim)],['Nombre de DID',l.dids.length]]) +
    `<h3>Règles entrantes (${l.rules.length})</h3><div class="tw"><table><thead><tr><th>Règle</th><th>DID</th><th>Ouvert</th><th>Fermé</th></tr></thead><tbody>${l.rules.map(r=>`<tr><td>${esc(r.name)}</td><td class="mono">${esc(phone(r.data))}</td><td>${destHTML(r.office)}</td><td>${r.altOOO?destHTML(r.outOfOffice):'<span class="muted">idem</span>'}</td></tr>`).join('')}</tbody></table></div>` +
    `<h3>DID sans règle spécifique</h3>${l.dids.filter(d=>!l.rules.some(r=>r.data===d)).map(d=>`<span class="pill mono">${esc(phone(d))}</span>`).join('')||'<span class="muted">Aucun</span>'}`);
}

V.sortant = el => {
  el.innerHTML = `<h2>Règles sortantes</h2><p class="lead">Évaluées par ordre de priorité.</p><div id="t"></div>`;
  table($('#t'), {
    rows: D.outbound, sort:[0,1], search: o=>[o.name,o.prefix,...o.routes.map(r=>r.gw)].join(' '),
    cols: [{h:'Priorité',num:1,v:o=>o.priority},{h:'Nom',v:o=>o.name},{h:'Préfixe',v:o=>o.prefix,cls:'mono'},{h:'Longueurs',v:o=>o.lengths,cls:'mono'},
      {h:'Groupes appelants',v:o=>o.groups.join(', ')},
      {h:'Routes',v:o=>o.routes.length,f:o=>o.routes.map((r,i)=>`<div><span class="pill">${i+1}</span>${esc(r.gw)} <span class="muted mono">${r.strip&&r.strip!=='0'?'−'+esc(r.strip)+' ':''}${r.prepend?'+'+esc(r.prepend):''}</span></div>`).join('')}],
  });
};

V.appels = el => {
  el.innerHTML = `<h2>Historique des appels</h2><p class="lead">Reconstitué à partir du CDR (cdroutput) : un appel = tous ses segments (IVR, file, transferts…). Heures en heure de l'Est.</p><div class="bar" style="margin-bottom:6px"><label class="count">Du <input type="date" id="d1"></label><label class="count">au <input type="date" id="d2"></label></div><div id="t"></div>`;
  const draw = () => {
    const d1=$('#d1').value, d2=$('#d2').value;
    const rows = D.calls.filter(c => { if(!d1&&!d2) return true; const k=dayKey(c[0]); return (!d1||k>=d1)&&(!d2||k<=d2); });
    table($('#t'), {
      rows, pageSize:100,
      search: c => [c[2],c[3],c[4],c[5],c[6],dnName(c[6]),phone(c[2]),phone(c[4]),...c[9].map(p=>p[0]+' '+dnName(p[0]))].join(' '),
      filters: [
        {label:'Toutes directions', options:[['in','Entrants'],['out','Sortants'],['int','Internes'],['transit','Transit']], test:(c,v)=>c[1]===v},
        {label:'Toutes issues', options:Object.entries(ST).map(([k,v])=>[k,v[0]]), test:(c,v)=>c[10]===v},
        {label:'Toutes files', options:D.queues.map(q=>[q.number,q.number+' '+q.name]), test:(c,v)=>c[9].some(p=>p[0]===v)},
      ],
      cols: [
        {h:'Date', v:c=>c[0], f:c=>fmtD(c[0])},
        {h:'', v:c=>c[1], f:c=>`<span class="pill ${c[1]==='in'?'acc':c[1]==='out'?'ok':''}">${{in:'Entrant',out:'Sortant',int:'Interne',transit:'Transit'}[c[1]]}</span>`},
        {h:'De', v:c=>c[2], f:c=>c[1]==='in'?`<span class="mono">${esc(phone(c[2]))}</span>${vipStar(c[2])} <span class="muted">${esc(c[3])}</span>`:dnLink(c[2])},
        {h:'Vers', v:c=>c[4], f:c=>c[1]==='int'?dnLink(c[4]):`<span class="mono">${esc(phone(c[4]))}</span>`},
        {h:'Parcours', v:c=>c[9].length, f:c=>c[9].filter(p=>p[1]!=='extension').slice(0,4).map(p=>`<span class="pill" title="${esc(dnName(p[0]))}">${esc(dnName(p[0])||p[0])}</span>`).join('')},
        {h:'Issue', v:c=>c[10]+c[6], f:stHTML},
        {h:'Durée', num:1, v:c=>c[7], f:c=>dur(c[7])},
        {h:'Conversation', num:1, v:c=>c[8], f:c=>c[8]?dur(c[8]):''},
      ],
      onRow: c => openCall(c)
    });
  };
  $('#d1').addEventListener('change', draw); $('#d2').addEventListener('change', draw);
  draw();
};

V.statsfiles = el => {
  el.innerHTML = `<h2>Appels des files d'attente</h2><p class="lead">Détail de chaque passage en file (callcent_queuecalls).</p><div id="t"></div>`;
  table($('#t'), {
    rows: D.queueCalls, pageSize:100,
    search: r => [r[1],dnName(r[1]),r[2],r[3],r[7],dnName(r[7]),r[8]].join(' '),
    filters: [{label:'Toutes files', options:D.queues.map(q=>[q.number,q.number+' '+q.name]), test:(r,v)=>r[1]===v},
              {label:'Tous résultats', options:[['1','Servis'],['0','Non servis']], test:(r,v)=>r[6]===(v==='1')}],
    cols: [
      {h:'Date',v:r=>r[0],f:r=>fmtD(r[0])},{h:'File',v:r=>r[1],f:r=>dnLink(r[1])},
      {h:'Appelant',v:r=>r[2],f:r=>`<span class="mono">${esc(phone(r[2]))}</span> <span class="muted">${esc(r[3])}</span>`},
      {h:'Attente',num:1,v:r=>r[4],f:r=>dur(r[4])},{h:'Conversation',num:1,v:r=>r[5],f:r=>r[5]?dur(r[5]):''},
      {h:'Résultat',v:r=>r[6]?1:0,f:r=>r[6]?`<span class="pill ok">Servi</span> ${dnLink(r[7])}`:`<span class="pill bad">Non servi</span> <span class="muted">${esc(r[8])}</span>`},
    ],
  });
};

V.enreg = el => {
  const inB = D.recInBackup, linked = BK.recLinked();
  const banner = inB === undefined
    ? `<p class="segbar">Ce backup a été chargé avec une version antérieure de l'interface : impossible de savoir s'il contient les fichiers audio. Rechargez le .zip (« Choisir un backup ») pour vérifier.</p>`
    : inB === 0
    ? `<p class="segbar warnbar"><b>Enregistrements non inclus dans le backup utilisé.</b> Le backup ne contient que la liste des enregistrements, pas les fichiers audio : l'option « Inclure les enregistrements » est désactivée dans les sauvegardes de la console 3CX (Sauvegarde → options). Si vous l'activez, prévoyez un backup beaucoup plus volumineux.</p>`
    : linked
    ? `<p class="segbar okbar"><b>${nf(inB)} enregistrement${inB > 1 ? 's' : ''} disponible${inB > 1 ? 's' : ''} dans le backup</b> : cliquez sur « Écouter » pour lire un enregistrement, ou téléchargez-le.</p>`
    : `<div class="segbar"><b>Ce backup contient ${nf(inB)} enregistrement${inB > 1 ? 's' : ''}.</b> Pour les écouter, sélectionnez à nouveau le même fichier .zip (il n'est pas recopié dans le navigateur à cause de sa taille ; à refaire après chaque rechargement de la page).
        <label class="btn primary" style="margin-left:8px">Sélectionner le zip du backup<input type="file" id="reclink" accept=".zip,application/zip" hidden></label> <span id="reclst" class="bkst"></span></div>`;
  const avail = r => inB > 0 && linked && BK.recHas(r[5]);
  el.innerHTML = `<div id="enwrap"><h2>Enregistrements</h2><p class="lead">Enregistrements d'appels référencés dans le backup (${nf(D.recordings.length)}).</p>${banner}<div id="t"></div></div>`;
  table($('#t'), {
    rows: D.recordings, pageSize: 100, state: (window.__recTable ||= {}),
    search: r => [r[1], dnName(r[1]), r[2], r[3], phone(r[3]), r[5]].join(' '),
    filters: [{label: 'Tous les postes', options: [...new Set(D.recordings.map(r => r[1]))].sort().map(n => [n, n + ' ' + dnName(n)]), test: (r, v) => r[1] === v},
              ...(inB > 0 && linked ? [{label: 'Écoute : tous', options: [['1', 'Écoute disponible'], ['0', 'Non inclus dans le backup']], test: (r, v) => avail(r) === (v === '1')}] : [])],
    cols: [{h: 'Date', v: r => r[0], f: r => fmtD(r[0])}, {h: 'Poste', v: r => r[1], f: r => dnLink(r[1])}, {h: 'Correspondant', v: r => r[3], f: r => `<span class="mono">${esc(phone(r[3]))}</span>`},
      {h: 'Durée', num: 1, v: r => r[4], f: r => dur(r[4])},
      {h: 'Écoute', v: r => avail(r) ? 1 : 0, f: r => avail(r) ? `<span class="recplay"><button class="btn recbtn" data-u="${esc(r[5])}">▶ Écouter</button></span>`
        : `<span class="muted" style="font-size:12px">${inB === undefined ? 'inconnu (recharger le zip)' : inB > 0 && !linked ? 'sélectionner le zip' : 'Non inclus dans le backup utilisé'}</span>`},
      {h: 'Fichier', v: r => r[5], cls: 'mono muted'}],
  });
  const W = $('#enwrap');
  W.addEventListener('click', async e => {
    const b = e.target.closest('.recbtn'); if(!b) return;
    const u = b.dataset.u, cell = b.closest('.recplay'); b.disabled = true; b.textContent = 'Chargement…';
    try{
      const blob = await BK.recBlob(u); if(!blob) throw new Error('fichier introuvable');
      const url = URL.createObjectURL(blob), fn = u.split('/').pop(); (window.__recUrls ||= []).push(url);
      cell.innerHTML = `<audio controls autoplay src="${url}" style="height:30px;max-width:240px;vertical-align:middle"></audio> <a class="dlink" href="${url}" download="${esc(fn)}" title="Télécharger">⬇</a>`;
    }catch(er){ cell.innerHTML = `<span class="pill bad">Lecture impossible : ${esc(er.message)}</span>`; }
  });
  const lk = $('#reclink');
  if(lk) lk.addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return; const st = $('#reclst'); st.className = 'bkst'; st.textContent = 'Lecture du zip…';
    try{ const n = await BK.linkRecZip(f); st.textContent = `${nf(n)} enregistrements reliés.`; V.enreg(el); }
    catch(er){ st.className = 'bkst err'; st.textContent = 'Erreur : ' + er.message; } });
};

V.audio = el => {
  el.innerHTML = `<h2>Messagerie & fichiers audio</h2><p class="lead">Messages vocaux, messages d'accueil et invites présents dans le backup (lecture directe).</p>
    <h3>Messages vocaux (${D.voicemails.length})</h3><div id="t1"></div><h3>Invites personnalisées (${D.prompts.length})</h3><div id="t2"></div><h3>Messages d'accueil de boîte vocale (${D.vmGreetings.length})</h3><div id="t3"></div>`;
  table($('#t1'), {rows:D.voicemails, search:v=>[v.ext,v.from,dnName(v.ext)].join(' '),
    cols:[{h:'Poste',v:v=>v.ext,f:v=>dnLink(v.ext)},{h:'De',v:v=>v.from,f:v=>`<span class="mono">${esc(phone(v.from))}</span>`},{h:'Date (UTC)',v:v=>v.date,f:v=>esc(v.date.replace(/(\d{4})(\d\d)(\d\d)(\d\d)(\d\d).*/,'$1-$2-$3 $4:$5'))},{h:'Écouter',v:v=>v.size,f:v=>audio(v.path)}]});
  const usedBy = f => [...D.ivrs.filter(i=>i.prompt===f).map(i=>i.number), ...D.queues.filter(q=>q.intro===f||q.moh===f).map(q=>q.number), ...D.groups.filter(g=>Object.values(g.prompts).includes(f)).map(g=>g.number)];
  table($('#t2'), {rows:D.prompts, search:p=>p.file+' '+usedBy(p.file).map(dnName).join(' '),
    cols:[{h:'Fichier',v:p=>p.file},{h:'Utilisé par',v:p=>usedBy(p.file).length,f:p=>usedBy(p.file).map(n=>dnLink(n,false)).join(', ')||'<span class="muted">non utilisé</span>'},{h:'Taille',num:1,v:p=>p.size,f:p=>Math.round(p.size/1024)+' Ko'},{h:'Écouter',v:p=>p.file,f:p=>audio(p.path)}]});
  table($('#t3'), {rows:D.vmGreetings, search:g=>g.ext+' '+dnName(g.ext),
    cols:[{h:'Poste',v:g=>g.ext,f:g=>dnLink(g.ext)},{h:'Fichier',v:g=>g.file,cls:'muted'},{h:'Écouter',v:g=>g.file,f:g=>audio(g.path)}]});
};

V.annuaire = el => {
  el.innerHTML = `<h2>Annuaire</h2><p class="lead">Contacts de l'entreprise et des départements.</p><div id="t"></div>`;
  table($('#t'), {rows:D.phonebook, sort:[0,1], search:p=>[p.first,p.last,p.company,p.phone,...p.other,p.scope].join(' '),
    cols:[{h:'Nom',v:p=>(p.first+' '+p.last).trim()},{h:'Entreprise',v:p=>p.company},{h:'Téléphone',v:p=>p.phone,f:p=>`<span class="mono">${esc(p.phone)}</span>`},{h:'Autres',v:p=>p.other.join(' '),f:p=>p.other.filter(o=>o.length<60).map(o=>`<span class="pill">${esc(o)}</span>`).join('')},{h:'Portée',v:p=>p.scope}]});
};

V.audit = el => {
  el.innerHTML = `<h2>Journal d'audit</h2><p class="lead">Modifications de configuration et connexions à la console. Cliquez sur une ligne pour voir les changements.</p><div id="t"></div>`;
  table($('#t'), {rows:D.audit, pageSize:100,
    search:a=>[a[1],a[3],a[4],a[5],...a[6].map(c=>c[0])].join(' '),
    filters:[{label:'Toutes actions', options:[...new Set(D.audit.map(a=>a[1]))].sort().map(x=>[x,x]), test:(a,v)=>a[1]===v},
             {label:'Tous utilisateurs', options:[...new Set(D.audit.map(a=>a[3]))].sort().map(x=>[x,x]), test:(a,v)=>a[3]===v}],
    cols:[{h:'Date',v:a=>a[0],f:a=>fmtD(a[0])},{h:'Action',v:a=>a[1],f:a=>`<span class="pill ${a[1]==='Suppression'?'bad':a[1]==='Création'?'ok':a[1]==='Modification'?'acc':''}">${esc(a[1])}</span>`},
      {h:'Objet',v:a=>a[4]},{h:'Par',v:a=>a[3]},{h:'IP',v:a=>a[5],cls:'mono muted'},{h:'Champs modifiés',num:1,v:a=>a[6].length,f:a=>a[6].length||''}],
    onRow:a=>openDrawer(esc(a[1])+' · '+esc(a[4]), kv([['Date',fmtD(a[0])],['Par',esc(a[3])],['IP',esc(a[5])],['Type d\'objet',esc(a[2])]]) +
      (a[6].length?`<h3>Changements</h3><div class="tw"><table><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>${a[6].map(c=>`<tr><td><b>${esc(c[0])}</b></td><td class="mono" style="color:var(--bad)">${esc(c[1])}</td><td class="mono" style="color:var(--ok)">${esc(c[2])}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Aucun détail de changement.</p>'))
  });
};

V.params = el => {
  el.innerHTML = `<h2>Paramètres</h2><p class="lead">Paramètres système et tenant. Les valeurs sensibles (mots de passe, clés) sont masquées.</p><div id="t"></div>`;
  table($('#t'), {rows:D.params, pageSize:100, sort:[0,1], search:p=>[p.name,p.value,p.desc].join(' '),
    filters:[{label:'Toutes portées', options:[['Système','Système'],['Tenant','Tenant']], test:(p,v)=>p.scope===v}],
    cols:[{h:'Nom',v:p=>p.name,cls:'mono'},{h:'Valeur',v:p=>p.value,cls:'mono',f:p=>esc(p.value.length>140?p.value.slice(0,140)+'…':p.value)},{h:'Description',v:p=>p.desc,cls:'muted'},{h:'Portée',v:p=>p.scope}]});
};

// ---------- Navigation ----------
