// ---------- Diagramme de flux d'appel (par SDA) ----------
const DAY_ABBR = {Monday:'Lun',Tuesday:'Mar',Wednesday:'Mer',Thursday:'Jeu',Friday:'Ven',Saturday:'Sam',Sunday:'Dim'};
const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function hoursSummary(h){
  if(!h) return [];
  if(!h.days.length) return [h.type==='AllHours' ? 'Ouvert 24 h/24' : ''].filter(Boolean);
  const per = DAY_ORDER.map(d => { const x = h.days.find(y => y.day===d); return x && x.p.length ? x.p.map(p => p.join('–')).join(', ') : 'fermé'; });
  const out = []; let i = 0;
  while(i < 7){ let j = i; while(j+1 < 7 && per[j+1]===per[i]) j++;
    out.push((i===j ? DAY_ABBR[DAY_ORDER[i]] : DAY_ABBR[DAY_ORDER[i]]+'–'+DAY_ABBR[DAY_ORDER[j]]) + ' ' + per[i]); i = j+1; }
  return out;
}
const KIND_STYLE = {
  did:{c:'var(--accent)', t:'SDA'}, rule:{c:'var(--muted)', t:'Règle entrante'}, 'Département':{c:'var(--k-dept)', t:'Département'},
  'Standard (IVR)':{c:'var(--warn)', t:'Standard (IVR)'}, "File d'attente":{c:'var(--c-out)', t:"File d'attente"},
  'Groupe de sonnerie':{c:'var(--k-rg)', t:'Groupe de sonnerie'}, 'Poste':{c:'var(--c-int)', t:'Poste'},
  ext:{c:'var(--k-xt)', t:'Numéro externe'}, vm:{c:'var(--warn)', t:'Messagerie vocale'}, end:{c:'var(--bad)', t:'Fin'}, other:{c:'var(--c-int)', t:'Autre'},
};

function buildFlow(entry){
  const nodes = new Map(), edges = [];
  let uid = 0;
  const addNode = n => { nodes.set(n.id, n); return n.id; };
  const addEdge = (from, to, label, extra) => {
    const e = edges.find(x => x.from===from && x.to===to);
    if(e){ if(label && !e.labels.includes(label)) e.labels.push(label); return; }
    edges.push({from, to, labels: label ? [label] : [], ...(extra||{})});
  };
  const skip = d => !d || !d.to || d.to==='None' || d.to==='ProceedWithNoExceptions';
  function target(d){
    if(d.to==='VoiceMail') return addNode({id:'vm:'+(d.dn||uid++), kind:'vm', title:'Messagerie vocale', sub: d.dn ? d.dn+' '+dnName(d.dn) : '', lines:[], dn:d.dn});
    if(d.to==='External'){ const v = viaRule(d.ext);
      return addNode({id:'ext:'+d.ext, kind:'ext', title: phone(d.ext), sub: v ? 'via '+(v.routes[0]?.gw||v.name) : 'Numéro externe', lines:[]}); }
    if(d.dn && DN[d.dn]) return dnNode(d.dn);
    if(d.to==='EndCall') return addNode({id:'end:'+(uid++), kind:'end', title:'Raccrocher', sub:'', lines:[]});
    return addNode({id:'o:'+(uid++), kind:'other', title: TO_FR[d.to]||d.to, sub: d.dn||'', lines:[]});
  }
  function dnNode(n){
    const id = 'dn:'+n;
    if(nodes.has(id)) return id;
    const d = DN[n], o = d.obj;
    const node = {id, kind:d.kind, title:d.name||n, sub:n, lines:[], dn:n};
    addNode(node);
    if(d.kind==='Département'){
      node.lines = hoursSummary(o.hours);
      if(o.breakTime && (o.breakTime.days || []).length){ const bs = hoursSummary(o.breakTime).filter(t => !/fermé$/.test(t)); if(bs.length) node.lines.push('Pause : ' + bs.join(', ')); }
      [['office','Ouvert'],['outOfOffice','Fermé'],['break','Pause'],['holidays','Fériés']].forEach(([k,l]) => {
        const r = o.routes[k]; if(!skip(r)) addEdge(id, target(r), l);
      });
    } else if(d.kind==='Standard (IVR)'){
      if(o.prompt) node.lines.push('♪ '+o.prompt);
      o.options.slice().sort((a,b)=>a.key.localeCompare(b.key)).forEach(op => {
        const dd = {to:op.type, dn:op.dn, ext:op.data}; if(!skip(dd)) addEdge(id, target(dd), 'Touche '+op.key);
      });
      if(o.timeoutType==='RepeatPrompt') node.lines.push(`Sans choix (${o.timeout}s) : répète le message`);
      else if(o.timeoutType) { const dd = o.timeoutDN ? {to:o.timeoutType, dn:o.timeoutDN} : {to:o.timeoutType}; if(!skip(dd)) addEdge(id, target(dd), `Sans choix (${o.timeout}s)`); }
      if(o.invalidDN && DN[o.invalidDN]) addEdge(id, dnNode(o.invalidDN), 'Touche invalide');
      ownerBranches(n, o).forEach(([l, r]) => { if(!skip(r)) addEdge(id, target(r), l); });
    } else if(d.kind==="File d'attente"){
      node.lines.push(`${o.strategy} · ${o.ringTimeout}s/agent`);
      { const t = +o.masterTimeout || 0, m = Math.floor(t / 60), r = t % 60; if(t) node.lines.push(`Attente max. ${t < 60 ? t + ' s' : m + ' min' + (r ? ' ' + r + ' s' : '')}`);
        if(skip(o.dest)) node.lines.push("Sans réponse : fin de l'appel"); }
      if(o.intro && o.introEnabled) node.lines.push('♪ '+o.intro);
      node.agents = o.members.map(m => m.dn+' '+dnName(m.dn)+(m.status && m.status!=='LoggedIn' ? ' (déconnecté)' : ''));
      if(!skip(o.dest)) addEdge(id, target(o.dest), `Délai max (${o.masterTimeout}s)`);
      ownerBranches(n, o).forEach(([l, r]) => { if(!skip(r)) addEdge(id, target(r), l); });
    } else if(d.kind==='Groupe de sonnerie'){
      node.lines.push(`${o.strategy} · ${o.ringTime}s`);
      node.agents = o.members.map(m => m+' '+dnName(m));
      if(!skip(o.dest)) addEdge(id, target(o.dest), `Sans réponse (${o.ringTime}s)`);
      ownerBranches(n, o).forEach(([l, r]) => { if(!skip(r)) addEdge(id, target(r), l); });
    } else if(d.kind==='Poste'){
      if(o.email) node.lines.push(o.email);
    }
    return id;
  }
  // racine : SDA puis règle entrante
  const did = addNode({id:'did', kind:'did', title: phone(entry.did), sub: entry.line.gateway, lines: lineCalls[entry.did] ? [nf(lineCalls[entry.did])+' appels reçus dans le backup'] : []});
  const ru = entry.rule;
  if(!ru){ addEdge(did, addNode({id:'norule', kind:'end', title:'Aucune règle entrante', sub:'', lines:[]}), ''); return {nodes, edges}; }
  const rid = addNode({id:'rule', kind:'rule', title: ru.name || (entry.isDefault ? 'Règle par défaut du trunk' : 'Règle du SDA'),
    sub: entry.isDefault ? 'ForwardAll' : (ru.cond==='BasedOnDID' ? 'Selon le SDA' : ru.cond), lines: entry.isDefault ? ['Aucune règle propre à ce SDA'] : []});
  addEdge(did, rid, '');
  const periods = [['office', ru.altOOO||ru.altHol ? 'Ouvert' : 'Toujours']];
  if(ru.altOOO) periods.push(['outOfOffice','Fermé']);
  if(ru.altHol) periods.push(['holidays','Fériés']);
  periods.forEach(([k,l]) => { const dd = ru[k]; if(skip(dd)) addEdge(rid, addNode({id:'none', kind:'end', title:'Aucune destination', sub:'', lines:["L'appel n'est pas acheminé"]}), l); else addEdge(rid, target(dd), l); });
  return {nodes, edges};
}

const NW = 250, GX = 200, GY = 26, LINE = 15, PORT = 19;
function nodeHeight(n, ports){
  const ag = n.agents ? Math.min(n.agents.length, 14) + (n.agents.length > 14 ? 1 : 0) + 1 : 0;
  return Math.max(46 + (n.lines.length + ag) * LINE + (n.lines.length || ag ? 6 : 0), ports * PORT + 14);
}
function layoutFlow(g){
  const ids = [...g.nodes.keys()], out = {}, inc = {};
  ids.forEach(i => { out[i] = []; inc[i] = []; });
  // arêtes de retour (cycles) par DFS
  const state = {}, order = [];
  const dfs = v => { state[v] = 1; order.push(v);
    for(const e of g.edges.filter(e => e.from===v)){ if(state[e.to]===1) e.back = true; else if(!state[e.to]) dfs(e.to); }
    state[v] = 2; };
  dfs('did'); ids.forEach(i => { if(!state[i]) dfs(i); });
  g.edges.forEach(e => { if(!e.back){ out[e.from].push(e.to); inc[e.to].push(e.from); } });
  // couches : plus long chemin depuis la racine
  const layer = {}; const indeg = {}; ids.forEach(i => indeg[i] = inc[i].length);
  const q = ids.filter(i => !indeg[i]); ids.forEach(i => layer[i] = 0);
  while(q.length){ const v = q.shift(); for(const w of out[v]){ layer[w] = Math.max(layer[w], layer[v]+1); if(--indeg[w]===0) q.push(w); } }
  const L = []; order.forEach(i => (L[layer[i]] ||= []).push(i));
  const H = {}; ids.forEach(i => H[i] = nodeHeight(g.nodes.get(i), Math.max(out[i].length, inc[i].length)));
  // points de passage pour les flèches qui sautent des colonnes (elles ne traversent plus les boîtes)
  let vk = 0;
  g.edges.forEach(e => {
    e.via = [];
    if(e.back || layer[e.to] - layer[e.from] < 2) return;
    let prev = e.from;
    for(let l = layer[e.from]+1; l < layer[e.to]; l++){
      const v = '~'+(vk++); layer[v] = l; H[v] = PORT; inc[v] = [prev]; L[l].push(v); e.via.push(v); prev = v;
    }
    inc[e.to] = inc[e.to].map(x => x===e.from ? prev : x);
  });
  const allIds = ids.concat(g.edges.flatMap(e => e.via));
  const pos = {};
  L.forEach((col, li) => {
    // ordre : barycentre des parents
    if(li > 0) col.sort((a,b) => {
      const bc = v => { const p = inc[v].filter(x => pos[x]); return p.length ? p.reduce((s,x) => s + pos[x].y + H[x]/2, 0)/p.length : 1e9; };
      return bc(a) - bc(b);
    });
    let y = 0;
    col.forEach(v => {
      const p = inc[v].filter(x => pos[x]);
      const want = li > 0 && p.length ? p.reduce((s,x) => s + pos[x].y + H[x]/2, 0)/p.length - H[v]/2 : y;
      const yy = Math.max(want, y);
      pos[v] = {x: li*(NW+GX), y: yy}; y = yy + H[v] + GY;
    });
  });
  // recentrer les couches trop hautes vers le haut si possible (aucun y négatif)
  const minY = Math.min(...allIds.map(i => pos[i].y));
  allIds.forEach(i => pos[i].y -= minY - 20);
  const W = Math.max(...ids.map(i => pos[i].x + NW)) + 40;
  const Hh = Math.max(...allIds.map(i => pos[i].y + H[i])) + 70;
  // points d'attache : sorties réparties sur le bord droit (triées selon la cible), entrées sur le bord gauche
  const cy = i => pos[i].y + H[i]/2;
  const spread = (i, n, k) => n === 1 ? cy(i) : cy(i) + (k - (n-1)/2) * Math.min(PORT, (H[i]-14)/(n-1));
  ids.forEach(i => {
    const first = e => e.via.length ? e.via[0] : e.to;
    const o = g.edges.filter(e => e.from===i && !e.back).sort((a,b) => cy(first(a))-cy(first(b)));
    o.forEach((e,k) => e.sy = spread(i, o.length, k));
  });
  const last = e => e.via.length ? cy(e.via[e.via.length-1]) : e.sy;
  ids.forEach(i => { const n = g.edges.filter(e => e.to===i && !e.back).sort((a,b) => last(a)-last(b)); n.forEach((e,k) => e.ty = spread(i, n.length, k)); });
  return {pos, H, W, Hh};
}
function trunc(s, n){ s = String(s ?? ''); return s.length > n ? s.slice(0, n-1)+'…' : s; }
function renderFlow(g){
  const {pos, H, W, Hh} = layoutFlow(g);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" class="flowsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="f-arrow"/></marker></defs>`;
  // arêtes
  g.edges.forEach(e => {
    const a = pos[e.from], b = pos[e.to]; if(!a || !b) return;
    const label = e.labels.map(l => l.replace(/ : [^()]*\)$/, ')')).join(' ou ');
    let d, lx, ly;
    if(!e.back && b.x > a.x){
      const x1 = a.x+NW, y1 = e.sy, x2 = b.x, y2 = e.ty;
      // trajet : départ → (traversée de chaque colonne intermédiaire au point réservé) → arrivée
      const pts = [[x1, y1]];
      e.via.forEach(v => { const yv = pos[v].y + PORT/2; pts.push([pos[v].x, yv], [pos[v].x+NW, yv]); });
      pts.push([x2-2, y2]);
      d = `M${x1},${y1} L${x1+12},${y1}`;
      for(let k = 0; k+1 < pts.length; k += 2){
        const [ax, ay] = k===0 ? [x1+12, y1] : pts[k], [bx, by] = pts[k+1];
        if(k > 0) d += ` L${ax},${ay}`;
        const c1 = ax + Math.min(140, (bx-ax)*0.6), c2 = bx - Math.min(80, (bx-ax)*0.4);
        d += ` C${c1},${ay} ${c2},${by} ${bx},${by}`;
      }
      s += `<path d="${d}" class="f-edge" marker-end="url(#arr)"/><circle cx="${x1}" cy="${y1}" r="2.5" class="f-arrow"/>`;
      if(label) s += `<text x="${x1+8}" y="${y1-4}" class="f-elabel">${esc(trunc(label, 30))}</text>`;
    } else {
      // retour vers un élément déjà affiché : courbe par le bas
      const x1 = a.x+NW/2, y1 = a.y+H[e.from], x2 = b.x+NW/2+20, y2 = b.y+H[e.to];
      const yb = Math.max(y1, y2) + 40;
      d = `M${x1},${y1} C${x1},${yb} ${x2},${yb} ${x2},${y2+2}`;
      s += `<path d="${d}" class="f-edge back" marker-end="url(#arr)"/>`;
      if(label) s += `<text x="${(x1+x2)/2}" y="${yb-8}" text-anchor="middle" class="f-elabel">${esc(trunc(label, 34))} ↺</text>`;
    }
  });
  // nœuds
  g.nodes.forEach(n => {
    const p = pos[n.id], h = H[n.id], st = KIND_STYLE[n.kind] || KIND_STYLE.other;
    s += `<g class="f-node${n.dn?' click':''}" ${n.dn?`data-dn="${esc(n.dn)}"`:''} transform="translate(${p.x},${p.y})">
      <title>${esc(st.t+' — '+n.title+(n.sub?' ('+n.sub+')':''))}</title>
      <rect width="${NW}" height="${h}" rx="9" class="f-box" style="stroke:${st.c}"/>
      <rect width="5" height="${h}" rx="2" style="fill:${st.c}"/>
      <text x="14" y="17" class="f-kind" style="fill:${st.c}">${esc(st.t.toUpperCase())}${n.sub?' · '+esc(trunc(n.sub, 22)):''}</text>
      <text x="14" y="36" class="f-title">${esc(trunc(n.title, 30))}</text>`;
    let y = 36 + 6;
    n.lines.forEach(l => { y += LINE; s += `<text x="14" y="${y}" class="f-line">${esc(trunc(l, 38))}</text>`; });
    if(n.agents){
      y += LINE; s += `<text x="14" y="${y}" class="f-line strong">${n.agents.length} agent${n.agents.length>1?'s':''}</text>`;
      n.agents.slice(0, 14).forEach(a => { y += LINE; s += `<text x="22" y="${y}" class="f-line">• ${esc(trunc(a, 34))}</text>`; });
      if(n.agents.length > 14){ y += LINE; s += `<text x="22" y="${y}" class="f-line muted">+ ${n.agents.length-14} autres</text>`; }
    }
    s += `</g>`;
  });
  return {svg: s + '</svg>', W, Hh};
}

