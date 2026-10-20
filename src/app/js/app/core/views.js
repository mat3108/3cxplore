// ---------- Vues ----------
const V = {};
const lineCalls = {}; // DID -> appels
FULL.calls.forEach(c => { if(c[1]==='in' && c[5]) lineCalls[c[5]] = (lineCalls[c[5]]||0)+1; }); // 18.2.20 : tous les appels reçus sur le numéro
const allDIDs = [];
D.lines.forEach(l => { const ruleBy = {}; l.rules.forEach(r => ruleBy[r.data]=r); const def = l.rules.find(r => r.cond==='ForwardAll');
  l.dids.forEach(d => allDIDs.push({did:d, line:l, rule:ruleBy[d]||def, isDefault:!ruleBy[d] && !!def})); });

function systemInfo(){
  const i = D.info, mono = v => v ? `<span class="mono">${esc(v)}</span>` : '';
  const items = [
    ['Version 3CX', esc(i.version)], ['FQDN', mono(i.fqdn)],
    i.internalFqdn && i.internalFqdn!==i.fqdn ? ['FQDN interne', mono(i.internalFqdn)] : null,
    ['Licence', esc(i.company)], ['Contact', esc(i.contact)+(i.email?'<br><span class="muted">'+esc(i.email)+'</span>':'')],
    ['Téléphone', esc(i.phone)], ['Pays', esc(i.country)],
    ['Fuseau horaire', `<span class="mono">${esc(TZ)}</span> <span class="muted">(${esc(!TZ_SRC ? 'par défaut (aucun fuseau dans le backup)' : TZ_SRC.how === 'param' ? "d'après le réglage du système 3CX : " + TZ_SRC.label : "d'après l'écart d'heures du système 3CX (" + TZ_SRC.label + ')')})</span>`],
    ['Serveur courriel', mono(i.mailHost+(i.mailPort?':'+i.mailPort:''))+(i.mailFrom?'<br><span class="muted">'+esc(i.mailFrom)+'</span>':'')],
    ['Chemin backups', mono(i.backupPath)], ['Chemin enregistrements', mono(i.recordingPath)],
    ['Codecs', (i.codecs||[]).filter(Boolean).map(c=>`<span class="pill">${esc(c)}</span>`).join('')],
    ['Parkings', nf(D.parks.length)], ['Messages de clavardage', nf(D.chatCount)], ['Enregistrements', nf(D.recordings.length)],
  ].filter(Boolean);
  return `<details class="sys"><summary><span class="bkt">Système</span> <span class="muted">FQDN, licence, courriel, chemins, codecs…</span></summary><div class="sysgrid">${items.map(([k,v])=>`<div><div class="sk">${k}</div><div class="sv">${v||'<span class="muted">–</span>'}</div></div>`).join('')}</div></details>`;
}
function backupCard(){
  const s = D.source || {kind:'embedded'};
  const loaded = s.kind==='zip';
  return `<div class="card bk" id="bkcard">
    <div class="bkrow">
      <div class="bkinfo"><div class="bkt">Backup affiché</div>
        <div class="bkn">${loaded?esc(s.name):'Backup intégré à la page'}</div>
        <div class="muted" style="font-size:12.5px">3CX ${esc(D.info.version)} · sauvegarde du ${esc(bkDate(D.info.date))}${loaded?` · chargé le ${fmtD(s.loadedAt)}${s.size?' · '+(s.size/1048576).toFixed(0)+' Mo':''}`:''}</div>
        ${loaded&&s.stored===false?'<div class="pill warn" style="margin-top:4px">Non mémorisé : le navigateur a refusé le stockage, il faudra le recharger à la prochaine ouverture.</div>':''}
      </div>
      <div class="bkact">
        <label class="btn primary">Choisir un backup (.zip)<input type="file" id="bkfile" accept=".zip,application/zip" hidden></label>
        <button class="btn danger" id="bkclose">Fermer le backup</button>
        <label class="tourtgl" title="Lancer la visite guidée à chaque ouverture d'un backup"><input type="checkbox" class="tourauto"${(() => { try{ return localStorage.getItem('visiteauto3cx') === '1' ? ' checked' : ''; }catch(e){ return ''; } })()}> Visite guidée à l'ouverture du backup</label>
      </div>
    </div>
    ${systemInfo()}
    <div class="bkdrop">Pour changer de backup : choisissez ou glissez-déposez un autre fichier .zip ici. Le traitement se fait entièrement dans votre navigateur.</div>
    <div id="bkst" class="bkst"></div>
  </div>`;
}
function wireBackup(){ BK.wireCard(); }

// 19.3 : les trois problèmes qui font perdre le plus d'appels, repris de l'onglet Priorités
function prioTopCard(){
  try{
    const P = prioAnalysis(), top = P.A.slice(0, 3); if(!top.length) return '';
    const SEVL = {crit: ['Critique', 'bad'], fix: ['À corriger', 'warn'], obs: ['Observation', '']};
    return `<div class="card prtop"><div class="prtoph"><h3>À traiter en premier</h3><a class="dlink" href="#priorites"><span>Toutes les priorités</span> <span class="muted">(${nf(P.A.length + P.R.length)})</span> ▸</a></div>
      ${top.map(x => `<a class="prtopr" href="#${esc(x.link)}"><span class="pill ${SEVL[x.sev][1]}">${SEVL[x.sev][0]}</span><span class="prtopt">${esc(x.title)}</span><span class="prtopn"><b>${nf(x.calls)}</b> <span class="muted">${esc(x.unit || '')}</span></span></a>`).join('')}</div>`;
  }catch(e){ console.warn('Priorités :', e); return ''; }
}

function recoBanner(){
  const F = analyse(), c = s => F.filter(f => f.sev === s).length;
  return `<a class="card rbanner" href="#reco"><span class="ico-wrap">${navIcon('reco')}</span>
    <span class="rbt"><b>Recommandations</b><span class="muted">Analyse automatique de la configuration et de l'activité</span></span>
    <span class="pill bad">${c('crit')} critique${c('crit')>1?'s':''}</span><span class="pill warn">${c('fix')} à corriger</span><span class="pill acc">${c('obs')} observation${c('obs')>1?'s':''}</span><span class="muted">Voir →</span></a>`;
}
V.dashboard = el => {
  const CS = SEG ? D.calls.filter(c => callSeg(c) === SEG) : D.calls; // 18.1.17 : un appel compté dans un seul magasin
  const inc = CS.filter(c=>c[1]==='in'), out = CS.filter(c=>c[1]==='out'), intr = CS.filter(c=>c[1]==='int'), nTransit = CS.filter(c=>c[1]==='transit').length;
  const incAns = inc.filter(c=>c[10]==='ans'||c[10]==='fwd_ok').length, incLocal = inc.filter(c=>c[10]!=='bridge').length;
  const stCount = {}; inc.forEach(c=>stCount[c[10]]=(stCount[c[10]]||0)+1);
  const nBridge = stCount.bridge || 0; delete stCount.bridge; // 19.3.1 : l'issue des appels se lit sur les appels de clients, comme « Entrants répondus »
  const first = D.calls.length ? D.calls[D.calls.length-1][0] : '', last = D.calls.length ? D.calls[0][0] : '';
  // volume par jour
  const days = {};
  CS.forEach(c => { const k=dayKey(c[0]); const d=(days[k] ||= {in:0,out:0,int:0}); if(c[1] in d) d[c[1]]++; });
  // 19.3.2 : jours consécutifs (un jour sans appel garde sa place) sur 90 jours au plus, du premier jour actif de cette fenêtre au dernier
  const act = Object.keys(days).sort(), dAdd = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const keys = [];
  if(act.length){ const lastD = act[act.length-1], from = dAdd(lastD, -89), firstD = act.find(k => k >= from);
    for(let k = firstD; k <= lastD; k = dAdd(k, 1)){ keys.push(k); days[k] ||= {in:0,out:0,int:0}; } }
  // heures
  const hrs = Array(24).fill(0).map(()=>({a:0,m:0}));
  inc.filter(c=>c[10]!=='bridge').forEach(c => { const h=hourOf(c[0]); (c[10]==='ans'||c[10]==='fwd_ok')?hrs[h].a++:hrs[h].m++; });
  // top agents
  const ag = {}; CS.forEach(c => { if(c[6] && DN[c[6]] && DN[c[6]].kind==='Poste' && c[1]==='in'){ (ag[c[6]] ||= {n:0,t:0}); ag[c[6]].n++; ag[c[6]].t+=c[8]; }});
  const topAg = Object.entries(ag).sort((a,b)=>b[1].n-a[1].n).slice(0,12);
  const topDid = Object.entries(lineCalls).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const didRule = {}; allDIDs.forEach(x=>didRule[x.did]=x.rule);
  const maxAg = topAg.length?topAg[0][1].n:1, maxDid = topDid.length?topDid[0][1]:1;
  const totQ = Object.values(D.queueStats).reduce((a,q)=>({t:a.t+q.total,s:a.s+q.served,w:a.w+q.waitServed}),{t:0,s:0,w:0});
  // 19.3 : l'essentiel d'abord (note, chiffres, priorités) ; le backup et le système en bas de page
  el.innerHTML = `
  <h2>Tableau de bord</h2>
  <p class="lead">${esc(D.info.company)} · ${esc(D.info.fqdn)} · 3CX ${esc(D.info.version)} · backup du ${esc(bkDate(D.info.date))}${first?` · appels du ${dayKey(first)} au ${dayKey(last)}`:''}</p>
  ${hsDashCard()}
  <div class="grid kpis dkpis">
    ${[['Postes',D.extensions.length],['Files d\'attente',D.queues.length],['Standards (IVR)',D.ivrs.length],['Départements',D.groups.filter(g=>!g.name.startsWith('__')&&g.name!=='SYSTEM').length],['Numéros (DID)',allDIDs.length],['Téléphones',D.extensions.reduce((a,e)=>a+e.devices.length,0)],
       ['Appels totaux',nf(CS.length)],['Entrants',nf(inc.length),nBridge?`dont ${nf(nBridge)} vers un autre 3CX`:''],['Entrants répondus*',pct(incAns,incLocal),`${nf(incAns)} sur ${nf(incLocal)} appels de clients`],['Sortants',nf(out.length)],['Internes',nf(intr.length)],['Service files',pct(totQ.s,totQ.t),`${nf(totQ.s)} servis sur ${nf(totQ.t)} appels en file`]]
      .map(([l,v,b])=>`<div class="card kpi"><div class="v">${v}</div><div class="l">${l}</div>${b?`<div class="kb">${b}</div>`:''}</div>`).join('')}
  </div>
  <p class="note">* Répondus localement ou via renvoi externe, hors appels transférés vers un autre 3CX par bridge.${nTransit?` <span>${nf(nTransit)} appel${nTransit>1?'s':''} en transit (un poste de l'autre 3CX qui sort par le trunk d'ici via un bridge) ne sont comptés ni comme entrants ni comme sortants : ce ne sont pas des appels de clients.</span>`:''}</p>
  ${prioTopCard()}
  ${recoBanner()}
  ${whatsNewCard()}
  <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Issue des appels entrants <span class="muted" style="font-weight:400">(${nf(incLocal)} appels de clients)</span></h3>
    ${Object.entries(stCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="hbar"><span class="nm"><span class="pill ${ST[k][1]}">${ST[k][0]}</span></span><span class="t"><span style="width:${100*v/incLocal}%"></span></span><span class="num">${nf(v)} <span class="muted">${pct(v,incLocal)}</span></span></div>`).join('')}
    ${nBridge?`<p class="note" style="margin-bottom:0">Hors pourcentages : ${nf(nBridge)} appels envoyés vers un autre 3CX (bridge), traités sur l'autre système.</p>`:''}</div>
  <div class="card chart" style="margin-top:12px"><h3 style="margin-top:0">Volume d'appels par jour <span class="muted" style="font-weight:400">${keys.length?`(du ${keys[0]} au ${keys[keys.length-1]})`:''}</span></h3>${stackChart(keys, keys.map(k=>days[k]))}
    <div class="legend"><span><i style="background:var(--c-in)"></i>Entrants</span><span><i style="background:var(--c-out)"></i>Sortants</span><span><i style="background:var(--c-int)"></i>Internes</span></div></div>
  <div class="grid two" style="margin-top:12px">
    <div class="card chart"><h3 style="margin-top:0">Appels entrants par heure</h3>${hourChart(hrs)}
      <div class="legend"><span><i style="background:var(--c-in)"></i>Répondus</span><span><i style="background:var(--bad)"></i>Non répondus</span></div></div>
    <div class="card"><h3 style="margin-top:0">Postes ayant répondu au plus d'appels entrants</h3>
      ${topAg.map(([n,v])=>`<div class="hbar"><span class="nm">${dnLink(n)}</span><span class="t"><span style="width:${100*v.n/maxAg}%"></span></span><span class="num">${nf(v.n)}</span></div>`).join('')||'<span class="muted">–</span>'}</div>
    <div class="card"><h3 style="margin-top:0">Numéros (DID) les plus appelés</h3>
      ${topDid.map(([n,v])=>`<div class="hbar"><span class="nm"><span class="mono">${esc(phone(n))}</span> <span class="muted">${esc(didRule[n]?.name||'')}</span></span><span class="t"><span style="width:${100*v/maxDid}%"></span></span><span class="num">${nf(v)}</span></div>`).join('')||'<span class="muted">–</span>'}</div>
  </div>
  <div style="margin-top:18px">${backupCard()}</div>`;
  wireBackup();
};

function stackChart(keys, vals){
  if(!keys.length) return '<p class="muted">Aucune donnée</p>';
  const W=1000,H=220,P=30, max=Math.max(...vals.map(v=>v.in+v.out+v.int),1), bw=(W-P)/keys.length;
  let s=`<svg viewBox="0 0 ${W} ${H+24}" role="img" aria-label="Volume quotidien">`;
  [0,.5,1].forEach(f=>{const y=H-(H-10)*f; s+=`<line x1="${P}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text class="ax" x="${P-4}" y="${y+3}" text-anchor="end">${Math.round(max*f)}</text>`;});
  keys.forEach((k,i)=>{ let y=H; const v=vals[i];
    [['int','var(--c-int)'],['out','var(--c-out)'],['in','var(--c-in)']].forEach(([t,c])=>{const h=(H-10)*v[t]/max; if(h>0){y-=h; s+=`<rect x="${P+i*bw+1}" y="${y}" width="${Math.max(bw-2,1)}" height="${h}" fill="${c}"><title>${k} – ${{in:'Entrants',out:'Sortants',int:'Internes'}[t]} : ${v[t]}</title></rect>`;}});
    if(i%Math.ceil(keys.length/12)===0) s+=`<text class="ax" x="${P+i*bw+bw/2}" y="${H+16}" text-anchor="middle">${k.slice(5)}</text>`;
  });
  return s+'</svg>';
}
function hourChart(hrs){
  const W=600,H=180,P=28, max=Math.max(...hrs.map(h=>h.a+h.m),1), bw=(W-P)/24;
  let s=`<svg viewBox="0 0 ${W} ${H+22}" role="img" aria-label="Appels par heure">`;
  [0,.5,1].forEach(f=>{const y=H-(H-10)*f; s+=`<line x1="${P}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text class="ax" x="${P-4}" y="${y+3}" text-anchor="end">${Math.round(max*f)}</text>`;});
  hrs.forEach((h,i)=>{ const ha=(H-10)*h.a/max, hm=(H-10)*h.m/max;
    s+=`<rect x="${P+i*bw+2}" y="${H-ha}" width="${bw-4}" height="${ha}" fill="var(--c-in)"><title>${i}h – répondus : ${h.a}</title></rect><rect x="${P+i*bw+2}" y="${H-ha-hm}" width="${bw-4}" height="${hm}" fill="var(--bad)" opacity=".8"><title>${i}h – non répondus : ${h.m}</title></rect>`;
    if(i%2===0) s+=`<text class="ax" x="${P+i*bw+bw/2}" y="${H+14}" text-anchor="middle">${i}h</text>`; });
  return s+'</svg>';
}

