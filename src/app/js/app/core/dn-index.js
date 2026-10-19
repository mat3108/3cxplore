// ---------- Index des DN ----------
const DN = {};
const EXT_BY = {}; FULL.extensions.forEach(e => EXT_BY[e.number] = e); // poste par numéro
const add = (n, kind, name, obj) => { if(n) DN[n] = {kind, name, obj}; };
FULL.extensions.forEach(e => add(e.number,'Poste',(e.first+' '+e.last).trim(),e));
FULL.queues.forEach(q => add(q.number,"File d'attente",q.name,q));
FULL.ivrs.forEach(i => add(i.number,'Standard (IVR)',i.name,i));
FULL.ringGroups.forEach(r => add(r.number,'Groupe de sonnerie',r.name,r));
FULL.groups.forEach(g => add(g.number,'Département',g.name,g));
FULL.lines.forEach(l => add(l.number,'Trunk',l.gateway,l));
const KIND_TAB = {'Poste':'postes',"File d'attente":'files','Standard (IVR)':'ivr','Groupe de sonnerie':'sonnerie','Département':'groupes','Trunk':'trunks'};
const dnName = n => DN[n] ? DN[n].name : '';
const dnLink = (n, withNum=true) => {
  if(!n) return '';
  const d = DN[n];
  if(!d) return `<span class="mono">${esc(n)}</span>`;
  return `<a class="dn" data-dn="${esc(n)}">${withNum?`<span class="mono">${esc(n)}</span> `:''}${esc(d.name)}</a>`;
};
const TO_FR = {Extension:'Poste',Queue:'File',IVR:'IVR',RoutePoint:'Département',RingGroup:'Groupe sonnerie',VoiceMail:'Messagerie vocale',External:'Numéro externe',None:'Aucune',EndCall:'Raccrocher',RepeatPrompt:'Répéter le message',ProceedWithNoExceptions:'Continuer normalement',CallBack:'Rappel',Fax:'Fax',DialByName:'Annuaire par nom',Script:'Script'};
const viaRule = num => { num=String(num||''); return D.outbound.find(o => o.prefix && o.prefix.split(',').some(p=>p && num.startsWith(p.trim()))); };
// statuts 3CX V20 : nom interne du profil -> nom affiché dans la console (19.0.3 : statuts personnalisés lus dans le backup, CUSTOM1NAME / CUSTOM2NAME)
const FWD_ST = (() => { const pv = n => ((FULL.params || []).find(p => p.name === n) || {}).value || '';
  return {'Available': 'Disponible', 'Away': 'Absent', 'Out of office': pv('DND_PROFILE_NAME') || 'Ne pas déranger', 'Custom 1': pv('CUSTOM1NAME') || 'Lunch', 'Custom 2': pv('CUSTOM2NAME') || "Voyage d'affaires"}; })();
const fwdName = n => FWD_ST[n] || n || '';
// 19.0.3 : dans un statut de type Absent, « None » est affiché « Send Busy » dans la console : l'appel est refusé comme occupé
const fwdBusy = (k, d) => /^AwayRoute/.test(k) && (!d || !d.to || d.to === 'None');
const destHTML = d => {
  if(!d || !d.to) return '<span class="muted">–</span>';
  const t = TO_FR[d.to] || d.to;
  if(d.to==='External'){ const v=viaRule(d.ext); return `<span class="lbl">${t}</span><span class="mono">${esc(phone(d.ext))}</span>${v?` <span class="pill" title="Règle sortante ${esc(v.name)}">via ${esc(v.routes[0]?.gw||v.name)}</span>`:''}`; }
  if(d.to==='VoiceMail') return `<span class="lbl">${t}</span>${d.dn?dnLink(d.dn):''}`;
  if(d.dn) return `<span class="lbl">${t}</span>${dnLink(d.dn)}`;
  return `<span class="muted">${t}</span>`;
};
const yes = b => b ? '<span class="pill ok">Oui</span>' : '<span class="pill">Non</span>';
const DAYS_FR = {Monday:'Lundi',Tuesday:'Mardi',Wednesday:'Mercredi',Thursday:'Jeudi',Friday:'Vendredi',Saturday:'Samedi',Sunday:'Dimanche'};
const hoursHTML = h => {
  if(!h) return '<span class="muted">–</span>';
  const T = {SpecificHoursExcludingHolidays:'Horaire spécifique (hors fériés)',SpecificHours:'Horaire spécifique',AllHours:'24 h/24',OfficeHours:'Heures du département'}[h.type] || h.type;
  if(!h.days.length) return esc(T);
  return `<div class="muted" style="font-size:12px;margin-bottom:4px">${esc(T)}</div><div class="hours">`+
    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>{const x=h.days.find(y=>y.day===d);return `<span>${DAYS_FR[d]}</span><span>${x&&x.p.length?x.p.map(p=>p.join('–')).join(', '):'<span class="muted">Fermé</span>'}</span>`;}).join('')+'</div>';
};
const audio = path => { if(!path) return ''; const u = path.startsWith('zip:') ? BK.audioURL(path) : encodeURI(path); return u ? `<audio controls preload="none" src="${esc(u)}"></audio>` : '<span class="muted">(audio indisponible)</span>'; };
const promptPath = f => { const p = D.prompts.find(x=>x.file===f); return p ? p.path : ''; };
const promptHTML = f => f ? `<div>${esc(f)}</div>${promptPath(f)?audio(promptPath(f)):'<span class="muted" style="font-size:12px">(fichier absent du backup)</span>'}` : '<span class="muted">–</span>';

