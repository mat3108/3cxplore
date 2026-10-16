// ---------- Organigramme des magasins (onglet) ----------
V.organigramme = el => {
  const S = window.__org ||= {q: ''};
  const stores = SEG_LIST.filter(s => !SEG || s === SEG);
  const own = (arr, s) => arr.filter(x => SEGOF[x.number] === s).sort((a, b) => a.number.localeCompare(b.number, 'fr', {numeric: true}));
  const leaf = (html, key) => `<li class="orgl" data-q="${esc(key.toLowerCase())}">${html}</li>`;
  const node = (cls, sum, items, open) => `<li><details class="orgn ${cls}"${open ? ' open' : ''}><summary>${sum}</summary><ul>${items.join('') || '<li class="muted">Aucun</li>'}</ul></details></li>`;
  const who = n => `${dnName(n)} ${n}`;
  const tree = stores.map(s => {
    const gs = own(FULL.groups.filter(g => !isSysGroup(g)), s), qs = own(FULL.queues, s), rs = own(FULL.ringGroups, s), is = own(FULL.ivrs, s);
    const posts = FULL.extensions.filter(e => SEGOF[e.number] === s);
    if(!gs.length && !qs.length && !rs.length && !is.length && !posts.length) return '';
    const inDept = new Set(gs.flatMap(g => g.members.map(m => m.dn)));
    const deps = gs.map(g => node('org-d', `<span class="orgk">Département</span> ${dnLink(g.number)} <span class="muted">· ${g.members.length} membre${g.members.length > 1 ? 's' : ''}</span>${g.routes.office?.to ? ` <span class="orgr">ouvert → ${esc(TO_FR[g.routes.office.to] || g.routes.office.to)} ${esc(g.routes.office.dn || '')}</span>` : ''}`,
      g.members.slice().sort((a, b) => a.dn.localeCompare(b.dn, 'fr', {numeric: true})).map(m => leaf(`${dnLink(m.dn)} <span class="pill">${esc(VROLE_FR[m.role] || m.role)}</span>`, who(m.dn) + ' ' + g.name)), gs.length <= 3));
    const files = qs.map(q => { const on = q.members.filter(m => !m.status || m.status === 'LoggedIn').length;
      return node('org-q', `<span class="orgk">File</span> ${dnLink(q.number)} <span class="muted">· ${esc(q.strategy)} · ${on}/${q.members.length} connecté${on > 1 ? 's' : ''}</span>`,
        q.members.map(m => leaf(`${dnLink(m.dn)} <span class="pill ${!m.status || m.status === 'LoggedIn' ? 'ok' : ''}">${!m.status || m.status === 'LoggedIn' ? 'Connecté' : 'Déconnecté'}</span>`, who(m.dn) + ' ' + q.name)), false); });
    const rgs = rs.map(r => node('org-r', `<span class="orgk">Groupe de sonnerie</span> ${dnLink(r.number)} <span class="muted">· ${esc(r.strategy)} · ${r.members.length} membre${r.members.length > 1 ? 's' : ''}</span>`,
      r.members.map(m => leaf(dnLink(m), who(m) + ' ' + r.name)), false));
    const menus = is.map(i => node('org-i', `<span class="orgk">Menu</span> ${dnLink(i.number)} <span class="muted">· ${i.options.length} touche${i.options.length > 1 ? 's' : ''}</span>`,
      i.options.slice().sort((a, b) => a.key.localeCompare(b.key)).map(o => leaf(`<span class="pill">Touche ${esc(o.key)}</span> ${o.dn ? dnLink(o.dn) : esc(TO_FR[o.type] || o.type)}`, who(o.dn || '') + ' ' + i.name)), false));
    const alone = posts.filter(e => !inDept.has(e.number)).sort((a, b) => a.number.localeCompare(b.number, 'fr', {numeric: true}));
    const sec = (t, arr) => arr.length ? `<li class="orgsec">${t} (${arr.length})</li>${arr.join('')}` : '';
    return `<li><details class="orgn org-s" open><summary><b>${esc(segName(s))}</b> <span class="muted">· ${posts.length} poste${posts.length > 1 ? 's' : ''} · ${gs.length} dép. · ${qs.length} file${qs.length > 1 ? 's' : ''} · ${rs.length} groupe${rs.length > 1 ? 's' : ''} · ${is.length} menu${is.length > 1 ? 's' : ''}</span></summary><ul>
      ${sec('Départements', deps)}${sec("Files d'attente", files)}${sec('Groupes de sonnerie', rgs)}${sec('Menus (IVR)', menus)}
      ${alone.length ? sec('Postes sans département dans ce magasin', [node('org-p', `<span class="muted">${alone.length} poste${alone.length > 1 ? 's' : ''}</span>`, alone.map(e => leaf(dnLink(e.number), who(e.number))), false)]) : ''}</ul></details></li>`;
  }).join('');
  el.innerHTML = `<div id="orgwrap"><h2>Organigramme des magasins</h2>
    <p class="lead">Vue en arbre de chaque magasin : départements et leurs membres (avec le rôle), files d'attente et leurs agents (état de connexion au moment du backup), groupes de sonnerie et menus vocaux${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Cliquez un nom pour l'ouvrir.</p>
    <p class="orgbar"><input id="orgq" type="search" placeholder="Rechercher un employé, un numéro, une file…" value="${esc(S.q)}"> <button class="btn" id="orgopen">Tout déplier</button> <button class="btn" id="orgclose">Tout replier</button> <button class="btn primary" id="orgprint">Imprimer / PDF</button> <span class="muted" id="orgmsg" style="font-size:12.5px"></span></p>
    <div class="card report" id="orgsheet"><h2 class="orgprt">Organigramme — ${esc(FULL.info.fqdn || '3CX')}${SEG ? ' — ' + esc(segName(SEG)) : ''}</h2><ul class="orgt">${tree || '<li class="muted">Aucun élément.</li>'}</ul></div></div>`;
  const all = () => [...el.querySelectorAll('#orgsheet details')];
  const filter = () => { const q = S.q.trim().toLowerCase(), sheet = $('#orgsheet');
    sheet.querySelectorAll('.orgl').forEach(l => l.hidden = !!q && !l.dataset.q.includes(q));
    let hits = 0;
    [...sheet.querySelectorAll('details')].reverse().forEach(d => { const n = d.querySelectorAll('.orgl:not([hidden])').length, self = d.querySelector('summary').innerText.toLowerCase().includes(q);
      d.parentElement.hidden = !!q && !n && !self; if(q && (n || self)) d.open = true; });
    sheet.querySelectorAll('.orgsec').forEach(h => { let x = h.nextElementSibling, vis = false; while(x && !x.classList.contains('orgsec')){ if(!x.hidden) vis = true; x = x.nextElementSibling; } h.hidden = !vis; });
    hits = sheet.querySelectorAll('.orgl:not([hidden])').length;
    $('#orgmsg').textContent = q ? `${hits} résultat${hits > 1 ? 's' : ''}` : ''; };
  $('#orgq').addEventListener('input', e => { S.q = e.target.value; filter(); });
  $('#orgopen').addEventListener('click', () => all().forEach(d => d.open = true));
  $('#orgclose').addEventListener('click', () => all().forEach(d => d.open = d.classList.contains('org-s')));
  $('#orgprint').addEventListener('click', () => { const p = document.createElement('div'); p.id = 'secprint'; p.innerHTML = $('#orgsheet').outerHTML.replace('id="orgsheet"', '');
    p.querySelectorAll('details').forEach(d => d.open = true); p.querySelectorAll('[hidden]').forEach(x => x.hidden = false);
    document.body.appendChild(p); document.body.classList.add('printing-sec'); window.print(); setTimeout(() => { p.remove(); document.body.classList.remove('printing-sec'); }, 800); });
  // un clic sur un nom dans l'en-tête d'une branche ouvre l'élément sans replier la branche
  $('#orgwrap').addEventListener('click', e => { if(e.target.closest('summary a.dn')) e.preventDefault(); }, true);
  if(S.q) filter();
};

