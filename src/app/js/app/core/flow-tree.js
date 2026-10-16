// ---------- Arbre de flux ----------
function flowNode(n, depth, seen){
  const d = DN[n];
  if(!d) return `<div class="leaf">${n?`<span class="mono">${esc(n)}</span>`:'<span class="muted">–</span>'}</div>`;
  const head = `<span class="pill acc">${esc(d.kind)}</span> ${dnLink(n)}`;
  if(seen.has(n) || depth>7) return `<div class="leaf">${head} <span class="muted">(déjà affiché)</span></div>`;
  const s2 = new Set(seen); s2.add(n);
  const o = d.obj; let kids = [];
  const sub = (label, dd) => {
    if(!dd || !dd.to || dd.to==='None' || dd.to==='ProceedWithNoExceptions') return;
    if(dd.dn && DN[dd.dn] && dd.to!=='VoiceMail') kids.push([label, flowNode(dd.dn, depth+1, s2)]);
    else kids.push([label, `<div class="leaf">${destHTML(dd)}</div>`]);
  };
  if(d.kind==='Département'){
    sub('Heures d\'ouverture', o.routes.office); sub('Hors heures', o.routes.outOfOffice);
    sub('Pause', o.routes.break); sub('Fériés', o.routes.holidays);
  } else if(d.kind==='Standard (IVR)'){
    o.options.slice().sort((a,b)=>a.key.localeCompare(b.key)).forEach(op => sub('Touche '+op.key, {to:op.type, dn:op.dn, ext:op.data}));
    if(o.timeoutType) sub(`Sans choix (${o.timeout}s)`, o.timeoutDN ? {to:o.timeoutType, dn:o.timeoutDN} : {to:o.timeoutType});
    ownerBranches(n, o).forEach(([l, r]) => sub(l, r));
  } else if(d.kind==="File d'attente"){
    kids.push(['Agents', `<div class="leaf">${o.members.length? o.members.map(m=>`<span class="pill">${esc(m.dn)} ${esc(dnName(m.dn))}</span>`).join(''):'<span class="muted">aucun</span>'}</div>`]);
    sub(`Délai max (${o.masterTimeout}s)`, o.dest);
    ownerBranches(n, o).forEach(([l, r]) => sub(l, r));
  } else if(d.kind==='Groupe de sonnerie'){
    kids.push(['Membres', `<div class="leaf">${o.members.map(m=>`<span class="pill">${esc(m)} ${esc(dnName(m))}</span>`).join('')}</div>`]);
    sub(`Sans réponse (${o.ringTime}s)`, o.dest);
    ownerBranches(n, o).forEach(([l, r]) => sub(l, r));
  }
  if(!kids.length) return `<div class="leaf">${head}</div>`;
  return `<details ${depth<2?'open':''}><summary>${head}</summary>${kids.map(([l,h])=>h.startsWith('<details')?h.replace('<summary>',`<summary><span class="lbl">${esc(l)} →</span> `):h.replace('<div class="leaf">',`<div class="leaf"><span class="lbl">${esc(l)} →</span> `)).join('')}</details>`;
}

