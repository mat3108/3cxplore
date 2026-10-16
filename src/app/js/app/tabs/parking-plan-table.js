// ---------- Plan des parkings : tableau des usagers en problème (16.2) ----------
const PKU_PB = {autre: ['Parking d\'un autre magasin', 'bad'], usage: ['Parque chez un autre magasin', 'warn'], horsplan: ['Touche hors plan', 'warn'], manque: ['Touches manquantes', 'acc']};
const pkInit = e => { const t = ((e.first || '') + ' ' + (e.last || '')).trim().split(/\s+/).filter(Boolean); return ((t[0] || e.number)[0] + (t.length > 1 ? t[t.length - 1][0] : '')).toUpperCase(); };
const pkHue = s => { let h = 0; for(const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
// touches d'un usager : vert = parking de son magasin, rouge = d'un autre magasin, gris = hors plan, pointillé = à ajouter
function pkChips(u, A){
  const own = new Set(), oth = new Set(u.rem.map(k => k.v)), off = new Set(u.hors.map(k => k.v));
  u.cur.forEach(k => { if(!oth.has(k.v) && !off.has(k.v)) own.add(k.v); });
  return [...u.cur].sort((a, b) => a.no - b.no).map(k => { const c = oth.has(k.v) ? 'pk-other' : off.has(k.v) ? 'pk-off' : 'pk-own';
      const t = oth.has(k.v) ? `Touche ${k.no} : ${k.v}, parking de ${(A.owner[k.v] || []).map(segShort).join(', ')} — à retirer` : off.has(k.v) ? `Touche ${k.no} : ${k.v}, hors plan — à vérifier` : `Touche ${k.no} : ${k.v}`;
      return `<span class="pkchip ${c}" title="${esc(t)}"><b>${k.no}</b>${esc(k.v)}${oth.has(k.v) ? ` <i>${esc((A.owner[k.v] || []).map(segShort).join(','))}</i>` : ''}</span>`; }).join('')
    + u.addk.map(p => `<span class="pkchip pk-add" title="${esc(p)} : à ajouter">+${esc(p)}</span>`).join('');
}
function pkUsersHTML(users, A){
  if(!users.length) return '<p class="muted">Aucun usager en problème selon le plan.</p>';
  const by = {}; users.forEach(u => (by[u.s] ||= []).push(u)); const segs = Object.keys(by).sort((a, b) => by[b].length - by[a].length), mx = Math.max(...segs.map(s => by[s].length));
  const cnt = k => users.filter(u => u.probs.includes(k)).length;
  return `<div class="pkusum">${segs.map(s => `<button type="button" class="pkuseg" data-s="${esc(s)}" title="Afficher les usagers de ${esc(segName(s))}"><span class="nm">${esc(segShort(s))}</span><span class="t"><span style="width:${100 * by[s].length / mx}%;background:hsl(${pkHue(s)} 55% 50%)"></span></span><b>${nf(by[s].length)}</b></button>`).join('')}</div>
    <div class="pkleg"><span class="pkchip pk-own"><b>5</b>SP10</span> parking du magasin <span class="pkchip pk-other"><b>3</b>SP1 <i>CL</i></span> parking d'un autre magasin (à retirer) <span class="pkchip pk-off"><b>8</b>SP25</span> hors plan (à vérifier) <span class="pkchip pk-add">+SP12</span> à ajouter
      <span class="muted">— le petit chiffre est la position de la touche sur le téléphone</span></div>
    <div class="pkuk">${Object.entries(PKU_PB).filter(([k]) => cnt(k)).map(([k, [l, c]]) => `<span class="pill ${c}">${esc(l)} : ${nf(cnt(k))}</span>`).join(' ')}</div>
    <div id="pkut"></div>`;
}
function pkUsersTable(users, A){
  if(!users.length || !$('#pkut')) return;
  const nm = e => (e.first + ' ' + e.last).trim();
  table($('#pkut'), {rows: users, pageSize: 25, sort: [4, -1], state: (window.__pkuT ||= {}),
    search: u => [u.n, nm(u.e), u.e.email, segShort(u.s), ...u.cur.map(k => k.v), ...u.probs.map(k => PKU_PB[k][0])].join(' '),
    filters: [{label: 'Tous les magasins', options: [...new Set(users.map(u => u.s))].sort().map(s => [s, segShort(s)]), test: (u, v) => u.s === v},
      {label: 'Tous les problèmes', options: Object.entries(PKU_PB).map(([k, [l]]) => [k, l]), test: (u, v) => u.probs.includes(v)}],
    cols: [{h: 'Usager', v: u => nm(u.e) || u.n, f: u => `<div class="pkuser"><span class="pkav" style="background:hsl(${pkHue(u.s)} 55% 45%)">${esc(pkInit(u.e))}</span><div><div><a class="dn" data-dn="${esc(u.n)}"><b>${esc(nm(u.e) || u.n)}</b></a> <span class="mono muted">${esc(u.n)}</span></div><div class="muted" style="font-size:11.5px">${esc(u.e.email || '')}</div></div></div>`},
      {h: 'Magasin', v: u => segShort(u.s), f: u => `<span class="pill" style="background:hsl(${pkHue(u.s)} 55% 45%);color:#fff;font-weight:600">${esc(segShort(u.s))}</span>`},
      {h: 'Téléphone', v: u => (u.e.devices[0] || {}).model || '', f: u => u.e.devices.length ? u.e.devices.map(d => `<div style="font-size:12px">${esc(d.model || d.template || '?')} <span class="muted mono">${esc(d.mac || '')}</span></div>`).join('') : '<span class="muted">application</span>'},
      {h: 'Touches de parking', v: u => u.cur.length, f: u => `<div class="pkchips">${pkChips(u, A)}</div>`},
      {h: 'À faire', v: u => u.rem.length * 100 + Object.keys(u.us).length * 10 + u.hors.length + u.addk.length / 10, f: u => [u.rem.length ? `<span class="pill bad">retirer ${nf(u.rem.length)}</span>` : '', u.addk.length ? `<span class="pill acc">ajouter ${nf(u.addk.length)}</span>${u.free.length ? `<div class="muted" style="font-size:11px">positions libres : ${esc(u.free.join(', '))}</div>` : ''}` : '', u.hors.length ? `<span class="pill warn">vérifier ${nf(u.hors.length)}</span>` : '',
        Object.keys(u.us).length ? `<div class="muted" style="font-size:11px">${Object.entries(u.us).map(([p, n]) => `${nf(n)} appel${n > 1 ? 's' : ''} sur ${esc(p)}`).join(', ')}</div>` : ''].join(' ')}],
    onRow: u => showExt(u.e)});
  document.querySelectorAll('.pkuseg').forEach(b => b.addEventListener('click', () => { const sel = $('#pkut select[data-f="0"]'); if(!sel) return; sel.value = sel.value === b.dataset.s ? '' : b.dataset.s; sel.dispatchEvent(new Event('change'));
    document.querySelectorAll('.pkuseg').forEach(x => x.classList.toggle('on', x.dataset.s === sel.value)); }));
}
