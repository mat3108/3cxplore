// ---------- Segmentation par magasin ----------
// Chaque élément reçoit un code de magasin : préfixe du nom du département (AB, CD, EF…),
// département principal pour les postes, département qui y mène pour les files/standards sans préfixe.
const FULL = D;
const SEG_COMMON = '@COMMON', SEG_BRIDGE = '@BRIDGE';
const SEG_CFG_KEY = 'seg3cx:' + (FULL.info.fqdn || ''), SEG_SEL_KEY = 'segsel3cx:' + (FULL.info.fqdn || '');
function segCfg(){ let c = {}; try{ c = JSON.parse(localStorage.getItem(SEG_CFG_KEY) || '{}'); }catch(e){} c.names ||= {}; c.overrides ||= {}; c.common ||= {}; return c; }
const SEGCFG = segCfg();
const saveSegCfg = () => { try{ localStorage.setItem(SEG_CFG_KEY, JSON.stringify(SEGCFG)); }catch(e){} };
const isSysGroup = g => /^(__|SYSTEM$)/.test(g.name) || /^FGRP/.test(g.number);
const rawCode = name => { name = String(name || '').trim(); if(/^Renvoi\b/i.test(name)) return SEG_BRIDGE; const t = name.split(/[\s_.-]+/)[0]; return /^[A-Z]{2,4}$/.test(t) ? t : (name || SEG_COMMON); };
const normSeg = c => !c ? SEG_COMMON : (SEGCFG.common[c] ? SEG_COMMON : c);

const SEGOF = {};       // dn -> code
const AUTOSEG = {};     // dn -> code automatique (avant correction manuelle)
const SEG_CODES = new Set();
FULL.groups.filter(g => !isSysGroup(g)).forEach(g => { const c = rawCode(g.name); AUTOSEG[g.number] = c; if(c !== SEG_BRIDGE) SEG_CODES.add(c); });
// files, standards, groupes de sonnerie : préfixe connu, sinon département(s) qui y mènent
const gRoutes = {}; // dn -> Set(codes de départements qui l'atteignent)
const byNum = {}; FULL.queues.forEach(x => byNum[x.number] = ['q', x]); FULL.ivrs.forEach(x => byNum[x.number] = ['i', x]); FULL.ringGroups.forEach(x => byNum[x.number] = ['r', x]);
FULL.groups.filter(g => !isSysGroup(g)).forEach(g => {
  const code = AUTOSEG[g.number], seen = new Set(), st = Object.values(g.routes).map(r => r?.dn).filter(Boolean);
  while(st.length){ const n = st.pop(); if(seen.has(n) || !byNum[n]) continue; seen.add(n); (gRoutes[n] ||= new Set()).add(code);
    const [k, o] = byNum[n];
    if(k === 'i'){ o.options.forEach(x => st.push(x.dn)); if(o.timeoutDN) st.push(o.timeoutDN); }
    else if(o.dest?.dn) st.push(o.dest.dn); }
});
[...FULL.queues, ...FULL.ivrs, ...FULL.ringGroups].forEach(x => {
  const t = rawCode(x.name);
  if(SEG_CODES.has(t)) AUTOSEG[x.number] = t;
  else { const r = [...(gRoutes[x.number] || [])].filter(c => c !== SEG_BRIDGE); AUTOSEG[x.number] = r.length === 1 ? r[0] : SEG_COMMON; }
});
// postes : département principal (IsPrimary), sinon unique magasin de rattachement
FULL.extensions.forEach(e => {
  const gs = e.groups.filter(g => !/^(__|SYSTEM$)/.test(g.g));
  const p = gs.find(g => g.primary);
  if(p) AUTOSEG[e.number] = rawCode(p.g);
  else { const cs = [...new Set(gs.map(g => rawCode(g.g)).filter(c => c !== SEG_BRIDGE))]; AUTOSEG[e.number] = cs.length === 1 ? cs[0] : SEG_COMMON; }
});
Object.keys(AUTOSEG).forEach(n => { const o = SEGCFG.overrides[n]; SEGOF[n] = o ? o : (AUTOSEG[n] === SEG_BRIDGE ? SEG_BRIDGE : normSeg(AUTOSEG[n])); });
Object.values(SEGCFG.overrides).forEach(c => { if(c && c[0] !== '@') SEG_CODES.add(c); });
const segName = c => c === SEG_COMMON ? 'Commun / non attribué' : c === SEG_BRIDGE ? 'Autres sites (bridges)' : (SEGCFG.names[c] ? `${SEGCFG.names[c]} (${c})` : c);
const segShort = c => c === SEG_COMMON ? 'Commun' : c === SEG_BRIDGE ? 'Bridges' : (SEGCFG.names[c] || c);
const segOf = n => SEGOF[n] || null;
// SDA -> magasin de la destination de sa règle (règle propre ou règle par défaut du trunk)
const DIDSEG = {};
FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
  l.dids.forEach(d => { const r = by[d] || def, dn = r?.office?.dn; DIDSEG[d] = dn && SEGOF[dn] ? SEGOF[dn] : (r?.office?.to === 'External' ? SEG_BRIDGE : SEG_COMMON); }); });
// un magasin n'apparaît dans le sélecteur que s'il a au moins un poste, une file, un standard, un groupe de sonnerie ou un SDA
const segUsed = c => [...FULL.extensions, ...FULL.queues, ...FULL.ivrs, ...FULL.ringGroups].some(x => SEGOF[x.number] === c) || Object.values(DIDSEG).includes(c);
const SEG_LIST = [...[...SEG_CODES].filter(c => !SEGCFG.common[c] && segUsed(c)).sort(), SEG_COMMON, SEG_BRIDGE];
let SEG = ''; try{ SEG = localStorage.getItem(SEG_SEL_KEY) || ''; }catch(e){}
if(SEG && !SEG_LIST.includes(SEG)) SEG = '';

function segFilter(F, s){
  if(!s) return F;
  const ok = n => SEGOF[n] === s;
  const callOk = c => DIDSEG[c[5]] === s || ok(c[2]) || ok(c[6]) || (c[1] !== 'in' && ok(c[4])) || c[9].some(p => ok(p[0]));
  const q = new Set(F.queues.filter(x => ok(x.number)).map(x => x.number));
  const used = new Set();
  F.ivrs.filter(x => ok(x.number)).forEach(i => i.prompt && used.add(i.prompt));
  F.queues.filter(x => ok(x.number)).forEach(x => { used.add(x.intro); used.add(x.moh); });
  F.groups.filter(g => ok(g.number)).forEach(g => Object.values(g.prompts).forEach(p => p && used.add(p)));
  const gname = {}; F.groups.forEach(g => gname[g.name] = g.number);
  return {...F,
    extensions: F.extensions.filter(e => ok(e.number)),
    queues: F.queues.filter(x => ok(x.number)), ivrs: F.ivrs.filter(x => ok(x.number)), ringGroups: F.ringGroups.filter(x => ok(x.number)),
    groups: F.groups.filter(g => ok(g.number)),
    lines: F.lines.map(l => ({...l, dids: l.dids.filter(d => DIDSEG[d] === s)})).filter(l => l.dids.length),
    phonebook: F.phonebook.filter(p => p.scope === 'Entreprise' || ok(gname[p.scope.replace(/^Groupe /, '')])),
    calls: F.calls.filter(callOk),
    queueStats: Object.fromEntries(Object.entries(F.queueStats).filter(([k]) => q.has(k))),
    queueCalls: F.queueCalls.filter(r => q.has(r[1])),
    recordings: F.recordings.filter(r => ok(r[1]) || q.has(r[7])),
    voicemails: F.voicemails.filter(v => ok(v.ext)), vmGreetings: F.vmGreetings.filter(v => ok(v.ext)),
    prompts: F.prompts.filter(p => used.has(p.file)),
    audit: F.audit.filter(a => ok(String(a[4]).split(' ')[0])),
  };
}
D = segFilter(FULL, SEG);

