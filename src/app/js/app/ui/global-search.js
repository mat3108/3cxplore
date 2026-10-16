// ---------- Recherche globale (bandeau) ----------
const gsNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const gsDigits = s => String(s || '').replace(/[^0-9a-z]/gi, '').toLowerCase();
function gsBuild(){
  const idx = [];
  const add = (kind, label, sub, keys, open) => idx.push({kind, label, sub, open, text: gsNorm([label, sub, ...keys].join(' ')), dig: keys.concat([label, sub]).map(gsDigits).filter(x => x.length >= 3)});
  FULL.extensions.forEach(e => {
    const name = (e.first + ' ' + e.last).trim();
    add('Poste', `${e.number} ${name}`, [segShort(SEGOF[e.number]), e.email].filter(Boolean).join(' · '), [e.number, e.email, e.callerId, e.mobile, e.azure, ...e.devices.map(d => d.mac), ...e.devices.map(d => d.model)], () => showDN(e.number));
    e.devices.forEach(d => d.mac && add('Téléphone', `${macFmt(d.mac)} — ${d.model || d.template}`, `${e.number} ${name}`, [d.mac, macFmt(d.mac), e.number], () => showDN(e.number)));
  });
  FULL.queues.forEach(q => add("File d'attente", `${q.number} ${q.name}`, segShort(SEGOF[q.number]), [q.number], () => showDN(q.number)));
  FULL.ivrs.forEach(i => add('Standard (IVR)', `${i.number} ${i.name}`, segShort(SEGOF[i.number]), [i.number, i.prompt], () => showDN(i.number)));
  FULL.ringGroups.forEach(r => add('Groupe de sonnerie', `${r.number} ${r.name}`, '', [r.number], () => showDN(r.number)));
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => add('Département', `${g.number} ${g.name}`, segShort(SEGOF[g.number]), [g.number], () => showDN(g.number)));
  FULL.lines.forEach(l => {
    add('Trunk', `${l.number} ${l.gateway}`, l.extNumber ? phone(l.extNumber) : '', [l.number, l.extNumber], () => showDN(l.number));
    const by = {}; l.rules.forEach(r => by[r.data] = r);
    l.dids.forEach(d => add('SDA', phone(d), `${(by[d]?.name) || ''} ${dnName(by[d]?.office?.dn || '')}`.trim() || l.gateway, [d], () => gsOpenDid(d)));
  });
  FULL.phonebook.forEach(p => add('Contact', `${(p.first + ' ' + p.last).trim() || p.company}`, [p.company, p.phone].filter(Boolean).join(' · '), [p.phone, p.company, ...p.other], () => openDrawer(esc((p.first + ' ' + p.last).trim() || p.company),
    kv([['Entreprise', esc(p.company)], ['Téléphone', `<span class="mono">${esc(p.phone)}</span>`], ['Autres', p.other.map(o => esc(o)).join('<br>')], ['Portée', esc(p.scope)]]))));
  return idx;
}
function gsOpenDid(d){
  if(allDIDs.some(r => r.did === d)){ location.hash = 'diagramme/' + d; return; }
  // SDA d'un autre magasin que celui affiché : revenir à tous les magasins
  location.hash = 'diagramme/' + d; window.__app.setSeg('');
}
const GS_IDX = gsBuild();
function gsSearch(q){
  const t = gsNorm(q).trim(); if(t.length < 2) return [];
  const d = gsDigits(q), words = t.split(/\s+/);
  const out = [];
  for(const it of GS_IDX){
    let score = 0;
    if(d.length >= 3 && it.dig.some(x => x === d)) score = 100;
    else if(d.length >= 3 && /\d/.test(d) && it.dig.some(x => x.includes(d))) score = 60;
    if(words.every(w => it.text.includes(w))) score = Math.max(score, gsNorm(it.label).startsWith(t) ? 80 : 40);
    if(score) out.push([score, it]);
  }
  const res = out.sort((a, b) => b[0] - a[0] || a[1].label.localeCompare(b[1].label)).slice(0, 14).map(x => x[1]);
  // un numéro de téléphone complet : proposer l'historique du client
  const cn = normNum(q); if(cn && cn.length === 10){ res.unshift({kind: 'Client', label: phone(cn), sub: 'Historique du client (appels, rappels, enregistrements)', open: () => { location.hash = 'client/' + cn; }});
    res.unshift({kind: 'Numéro', label: phone(cn), sub: 'Fiche numéro : SDA, client ou employé, tout sur une page', open: () => { location.hash = 'numero/' + cn; }}); } // 18.3
  return res;
}
// branchement du champ (une seule fois ; l'index est remplacé à chaque affichage)
window.__app.gsSearch = gsSearch;
{ const box = $('#gsearch'); box.hidden = false; }
if(!window.__gsBound){
  window.__gsBound = true;
  const inp = document.getElementById('gsq'), list = document.getElementById('gsres');
  let cur = [], sel = 0;
  const render = () => {
    if(!cur.length){ list.innerHTML = inp.value.trim().length >= 2 ? '<div class="gsempty">Aucun résultat</div>' : ''; list.hidden = !inp.value.trim(); return; }
    list.innerHTML = cur.map((r, i) => `<div class="gsitem${i === sel ? ' on' : ''}" data-i="${i}"><span class="pill">${esc(r.kind)}</span><span class="gsl">${esc(r.label)}</span><span class="gss">${esc(r.sub || '')}</span></div>`).join('');
    list.hidden = false;
  };
  const go = i => { const r = cur[i]; if(!r) return; list.hidden = true; inp.value = ''; inp.blur(); document.body.classList.remove('navopen'); r.open(); };
  inp.addEventListener('input', () => { cur = window.__app.gsSearch(inp.value); sel = 0; render(); });
  inp.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, cur.length - 1); render(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
    else if(e.key === 'Enter'){ e.preventDefault(); go(sel); }
    else if(e.key === 'Escape'){ inp.value = ''; list.hidden = true; inp.blur(); }
  });
  list.addEventListener('mousedown', e => { const it = e.target.closest('.gsitem'); if(it){ e.preventDefault(); go(+it.dataset.i); } });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  inp.addEventListener('focus', () => { if(inp.value.trim()){ cur = window.__app.gsSearch(inp.value); render(); } });
  document.addEventListener('keydown', e => {
    if(e.target.closest('input,textarea,select')) return;
    if(e.key === '/'){ if(!document.getElementById('gsearch').hidden){ e.preventDefault(); inp.focus(); inp.select(); } }
  });
}

