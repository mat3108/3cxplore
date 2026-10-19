  // ---------- Construction de D ----------
  async function build(file, progress){
    progress('Lecture du fichier .zip…', 1);
    const z = await readZip(file);
    const names = [...z.entries.keys()];
    const xmlName = names.find(n => /(^|\/)[^/]*Db\.xml$/.test(n));
    if(!xmlName) throw new Error("Aucun fichier *Db.xml trouvé : est-ce bien un backup 3CX V20 ?");
    const base = xmlName.includes('/') ? xmlName.slice(0, xmlName.lastIndexOf('/') + 1) : '';
    const rel = n => n.slice(base.length);
    const MISSING = []; // tables absentes du backup (signalées avant l'ouverture)
    const csv = async (name, onp) => { const t = await z.text(base + 'DbTables/' + name + '.csv'); if(!t) MISSING.push(name); return t ? await parseCSV(t.replace(/^﻿/, ''), onp) : []; };

    progress('Analyse de la configuration (XML)…', 3);
    let doc = new DOMParser().parseFromString((await z.text(xmlName)).replace(/^﻿/, ''), 'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('Le fichier de configuration XML est illisible.');
    let root = doc.documentElement, ten = q1(root, 'Tenants/Tenant');
    if(!ten) throw new Error('Structure du backup non reconnue (Tenants/Tenant absent).');
    const D = {};
    D.info = {
      version: txt(root, 'header/version'), date: txt(root, 'header/Date'),
      company: txt(root, 'license/company'), contact: txt(root, 'license/contact'), email: txt(root, 'license/email'),
      phone: txt(root, 'license/phone'), country: txt(root, 'license/country'),
      fqdn: txt(root, 'fqdn/externalFqdn'), internalFqdn: txt(root, 'fqdn/internalFqdn'),
      mailHost: txt(root, 'mailSettings/mailServerHost'), mailPort: txt(root, 'mailSettings/mailServerPort'), mailFrom: txt(root, 'mailSettings/mailFromAddress'),
      backupPath: txt(root, 'generalSettings/backupPath'), recordingPath: txt(root, 'generalSettings/recordingPath'),
      codecs: kids(q1(root, 'Codecs'), '*').map(c => txt(c, 'RFCName') || c.getAttribute('RFCName') || own(c)),
    };
    const params = [];
    for(const p of qa(root, 'Parameters/Parameter')){
      const n = txt(p, 'Name'); let v = txt(p, 'Value');
      if(SENSITIVE.test(n)) v = v ? '•••• (masqué)' : '';
      params.push({name: n, value: v.slice(0, 500), desc: txt(p, 'Description'), scope: 'Système'});
    }
    for(const p of qa(ten, 'Properties/TenantProperty')){
      const n = txt(p, 'Name'); if(n.startsWith('BILL_0')) continue; let v = txt(p, 'Value');
      if(SENSITIVE.test(n)) v = v ? '•••• (masqué)' : '';
      params.push({name: n, value: v.slice(0, 500), desc: txt(p, 'Description'), scope: 'Tenant'});
    }
    D.params = params; { const t = window.tz3cx(params); D.tz = t ? t.tz : 'America/Toronto'; } // 18.2.37 : fuseau du système 3CX

    const extGroups = {};
    D.groups = qa(ten, 'Groups/Group').map(g => {
      const rights = el => { const o = {}; if(el) kids(el, '*').forEach(c => { o[c.tagName] = c.textContent.trim() === 'true'; }); return o; };
      const members = qa(g, 'Members/Member').map(m => { const r = q1(m, 'role'); const rn = r ? (r.getAttribute('name') || '') : '';
        const pr = m.getAttribute('IsPrimary') === 'true', own = rights(r);
        (extGroups[m.getAttribute('DN')] ||= []).push({g: txt(g, 'Name'), role: rn, primary: pr}); return {dn: m.getAttribute('DN'), role: rn, primary: pr, rights: Object.keys(own).length ? own : null}; });
      const roles = {}; kids(q1(g, 'Roles'), 'role').forEach(r => { roles[r.getAttribute('name')] = rights(r); });
      const bt = q1(g, 'BreakTime');
      return {
        number: txt(g, 'Number'), name: txt(g, 'Name'), members, roles, globalVis: props(g).GLOBALLY_VISIBLE === '1', hours: hours(g),
        breakTime: bt && bt.children.length ? {type: bt.getAttribute('HoursType') || '', days: kids(bt, 'PeriodsOfDay').map(pd => ({day: pd.getAttribute('DayOfWeek'), p: kids(pd, 'PeriodOfDay').map(p => [p.getAttribute('begin'), p.getAttribute('end')])}))} : null,
        holidayDates: kids(q1(g, 'OfficeHolidays'), 'OfficeHoliday').map(h => ({name: txt(h, 'Name'), d: +txt(h, 'Day'), de: +txt(h, 'DayEnd') || +txt(h, 'Day'), m: +txt(h, 'Month'), me: +txt(h, 'MonthEnd') || +txt(h, 'Month'), y: +txt(h, 'Year'), ye: +txt(h, 'YearEnd') || +txt(h, 'Year'), recurrent: txt(h, 'IsRecurrent') === 'True'})),
        holidays: kids(q1(g, 'OfficeHolidays'), '*').map(h => txt(h, 'Name') || h.tagName),
        routes: {office: routeStr(txt(g, 'OfficeHoursRoute')), outOfOffice: routeStr(txt(g, 'OutOfOfficeHoursRoute')), holidays: routeStr(txt(g, 'HolidaysRoute')), break: routeStr(txt(g, 'BreakTimeRoute'))},
        prompts: {office: txt(g, 'OfficeHoursRoutePrompt'), outOfOffice: txt(g, 'OutOfOfficeHoursRoutePrompt'), break: txt(g, 'BreakTimeRoutePrompt'), holidays: txt(g, 'HolidaysRoutePrompt')},
        operator: dest(q1(g, 'CustomOperator')), phonebook: qa(g, 'PhoneBookEntries/PhoneBookEntry').length,
      };
    });

    const extQueues = {}, extRgs = {};
    D.queues = qa(ten, 'DN/Queue').map(q => {
      const num = txt(q, 'Number');
      const mem = qa(q, 'Members/Member').map(m => ({dn: m.getAttribute('DN'), status: m.getAttribute('QueueStatus') || '', skill: m.getAttribute('SkillGroup') || ''}));
      mem.forEach(m => (extQueues[m.dn] ||= []).push(num));
      return {number: num, name: txt(q, 'Name'), strategy: txt(q, 'PollingStrategy'), ringTimeout: txt(q, 'RingTimeout'), masterTimeout: txt(q, 'MasterTimeout'),
        intro: txt(q, 'IntroFile'), introEnabled: txt(q, 'EnableIntro') === 'True', moh: txt(q, 'OnHoldFile'),
        announcePos: txt(q, 'AnnounceQueuePosition') === 'True', announceInterval: txt(q, 'AnnouncementInterval'),
        dest: dest(q1(q, 'Destination')), members: mem, managers: qa(q, 'QueueManagers/Manager').map(m => m.getAttribute('DN')),
        props: props(q), routes: {office: routeStr(txt(q, 'OfficeHoursRoute')), outOfOffice: routeStr(txt(q, 'OutOfOfficeHoursRoute'))}};
    });
    D.ivrs = qa(ten, 'DN/IVR').map(i => ({
      number: txt(i, 'Number'), name: txt(i, 'Name'), prompt: txt(i, 'PromptFilename'), timeout: txt(i, 'Timeout'),
      timeoutType: txt(i, 'TimeoutForwardType'), timeoutDN: txt(i, 'TimeoutForwardDN'), invalidDN: txt(i, 'InvalidKeyForwardDN'),
      options: qa(i, 'Forwards/IVRForward').map(f => ({key: txt(f, 'Number'), type: txt(f, 'ForwardType'), dn: txt(f, 'ForwardDN'), data: txt(f, 'CustomData')})),
      props: props(i), routes: {office: routeStr(txt(i, 'OfficeHoursRoute')), outOfOffice: routeStr(txt(i, 'OutOfOfficeHoursRoute'))},
    }));
    D.ringGroups = qa(ten, 'DN/RingGroup').map(r => {
      const num = txt(r, 'Number'), mem = qa(r, 'Members/Member').map(m => m.getAttribute('DN'));
      mem.forEach(m => (extRgs[m] ||= []).push(num));
      return {number: num, name: txt(r, 'Name'), strategy: txt(r, 'RingStrategy'), ringTime: txt(r, 'RingTime'), members: mem, dest: dest(q1(r, 'Destination'))};
    });
    D.parks = qa(ten, 'DN/ParkExtension').map(p => txt(p, 'Number'));
    D.parkInfo = qa(ten, 'DN/ParkExtension').map(p => { const pr = props(p); return {number: txt(p, 'Number'), auto: pr.PARK_AUTOPICKUP || '', timeout: pr.PARK_TIMEOUT_PICKUP || '', dest: pr.PARK_TIMEOUT_DESTINATION || ''}; });
    // touches programmées des téléphones (propriété SHARED_BLFS : BLF, parking partagé, numérotation rapide, ligne, statut, connexion aux files)
    const parseBlfs = x => { if(!x) return []; try{ const d = new DOMParser().parseFromString(x, 'application/xml'); return [...d.getElementsByTagName('BLF')].map(b => { const t = b.getAttribute('BLFType') || '';
      return {no: +b.getAttribute('BLFNo') || 0, type: t, v: t === 'Line' || t === 'None' ? '' : [...b.childNodes].filter(c => c.nodeType === 3).map(c => c.nodeValue).join('').trim()}; }).sort((a, b) => a.no - b.no); }catch(e){ return []; } };
    D.extensions = qa(ten, 'DN/Extension').map(e => {
      const num = txt(e, 'Number'), pr = props(e);
      const devices = qa(e, 'PhoneDevices/PhoneDevice').map(d => {
        const st = txt(d, 'Settings'); const attr = n => { const m = st.match(new RegExp(n + '="([^"]*)"')); return m ? m[1] : ''; };
        const pf = txt(d, 'ProvisioningFilename2');
        return {mac: txt(d, 'MAC'), template: txt(d, 'TemplateFilename'), model: pf ? pf.split('-')[0] : '', iface: txt(d, 'Interface'),
          firmware: attr('Firmware'), lang: attr('PhoneLanguage'), sbc: attr('SbcName'), xfer: attr('XferType')};
      });
      const profiles = qa(e, 'FwdProfiles/FwdProfile').map(fp => ({name: txt(fp, 'Name'), display: txt(fp, 'DisplayName'), noAnswer: txt(fp, 'NoAnswerTimeout'), ringMobile: txt(fp, 'RingMyMobile'), routes: flatten(fp)}));
      const p2 = {}; for(const [k, v] of Object.entries(pr)) if(!/^(MYPHONETEMPLATEINFO|SHARED_BLFS|LASTUPDATED|EXTGUID)/.test(k)) p2[k] = v;
      return {number: num, first: txt(e, 'FirstName'), last: txt(e, 'LastName'), email: txt(e, 'EmailAddress'), callerId: txt(e, 'OutboundCallerID'),
        mobile: pr.MOBILENUMBER || '', enabled: txt(e, 'Enabled') === 'True', profile: txt(e, 'CurrentProfile'), queueStatus: txt(e, 'QueueStatus'),
        userStatus: txt(e, 'UserStatus'), record: txt(e, 'RecordCalls') === 'True', vm: txt(e, 'VMEnabled') === 'True', vmEmail: txt(e, 'VMEmailOptions'),
        noAnswer: txt(e, 'NoAnswerTimeout'), lanOnly: pr.ALLOW_LAN_ONLY === '1', azure: pr.AZURE_UPN || '', blfs: parseBlfs(pr.SHARED_BLFS), hidePresence: txt(e, 'HidePresence') === 'True',
        groups: extGroups[num] || [], queues: extQueues[num] || [], ringGroups: extRgs[num] || [], devices, profiles, props: p2};
    });
    D.lines = qa(ten, 'DN/ExternalLine').map(l => ({
      number: txt(l, 'Number'), gateway: txt(l, 'Gateway'), extNumber: txt(l, 'ExternalNumber'), direction: txt(l, 'Direction'), sim: txt(l, 'SimultaneousCalls'),
      dids: txt(l, 'DIDNumbers').split(',').filter(Boolean),
      rules: qa(l, 'RoutingRules/ExternalLineRule').map(rr => {
        const fd = q1(rr, 'ForwardDestinations'), co = q1(rr, 'Conditions'), h = q1(rr, 'Hours');
        return {name: txt(rr, 'RuleName'), data: txt(rr, 'Data'),
          cond: co && q1(co, 'Condition') ? q1(co, 'Condition').getAttribute('Type') || '' : '',
          callType: co && q1(co, 'CallType') ? q1(co, 'CallType').getAttribute('Type') || '' : '',
          hours: h ? h.getAttribute('HoursType') || '' : '',
          office: fd ? dest(q1(fd, 'OfficeHoursDestination')) : null, outOfOffice: fd ? dest(q1(fd, 'OutOfOfficeHoursDestination')) : null,
          holidays: fd ? dest(q1(fd, 'HolidaysDestination')) : null,
          altOOO: fd ? txt(fd, 'AlterDestinationDuringOutOfOfficeHours') === 'True' : false, altHol: fd ? txt(fd, 'AlterDestinationDuringHolidays') === 'True' : false};
      }),
    }));
    D.gateways = kids(q1(root, 'Gateways'), '*').map(g => ({kind: g.tagName, name: txt(g, 'Name'), type: txt(g, 'Type'), host: txt(g, 'Host'), port: txt(g, 'Port'),
      proxy: txt(g, 'ProxyHost'), template: txt(g, 'TemplateFilename'), reg: txt(g, 'RequireRegistrationFor'), srtp: txt(g, 'SRTPMode'),
      codecs: qa(g, 'Codecs/codec').map(c => c.getAttribute('RFCName')), regTime: txt(g, 'TimeBetweenReg')}));
    D.outbound = qa(ten, 'OutboundRules/OutboundRule').map(o => ({
      name: txt(o, 'Name'), prefix: txt(o, 'Prefix'), priority: parseInt(txt(o, 'Priority', '0')) || 0, lengths: txt(o, 'NumberLengthRanges'), callerFilter: txt(o, 'DNRanges'),
      groups: kids(q1(o, 'DNGroups'), '*').map(x => own(x) || x.getAttribute('Name') || ''), ranges: [],
      routes: qa(o, 'OutboundRoutes/OutboundRoute').filter(r => txt(r, 'Gateway')).map(r => ({gw: txt(r, 'Gateway'), strip: txt(r, 'StripDigits'), prepend: txt(r, 'Prepend'), cid: txt(r, 'CallerID')})),
    })).sort((a, b) => a.priority - b.priority);
    const pb = qa(ten, 'PhoneBookEntries/PhoneBookEntry').map(p => ({first: txt(p, 'FirstName'), last: txt(p, 'LastName'), company: txt(p, 'CompanyName'), phone: txt(p, 'PhoneNumber'),
      other: [...Array(10).keys()].map(i => txt(p, 'AddressNumberOrData' + i)).filter(Boolean), scope: 'Entreprise'}));
    for(const g of qa(ten, 'Groups/Group')) for(const p of qa(g, 'PhoneBookEntries/PhoneBookEntry'))
      pb.push({first: txt(p, 'FirstName'), last: txt(p, 'LastName'), company: txt(p, 'CompanyName'), phone: txt(p, 'PhoneNumber'), other: [], scope: 'Groupe ' + txt(g, 'Name')});
    D.phonebook = pb;
    D.firmwares = names.filter(n => n.startsWith(base) && /^provisioning\/[^/]+\/firmware\/[^/]+\/[^/]+$/.test(rel(n))).map(n => { const p = rel(n).split('/'); return {vendor: p[3], file: p[4]}; });
    D.promptSets = qa(root, 'PromptSets/PromptSet').map(p => txt(p, 'Name') || p.getAttribute('Name') || '');

    // ---------- Fichiers audio ----------
    doc = root = ten = null; // l'arbre XML n'est plus utilisé : le navigateur peut libérer sa mémoire
    progress('Extraction des fichiers audio…', 6);
    const audio = {};
    const wavs = names.filter(n => n.startsWith(base) && /\.wav$/i.test(n)).map(rel);
    const take = async r => { const b = await z.blob(base + r, 'audio/wav'); audio['zip:' + r] = b; return b; };
    D.prompts = [];
    for(const r of wavs.filter(r => /^httpprompts\/[^/]+$/.test(r))){ const b = await take(r); D.prompts.push({file: r.split('/').pop(), path: 'zip:' + r, size: b.size}); }
    D.prompts.sort((a, b) => a.file.toLowerCase() < b.file.toLowerCase() ? -1 : 1);
    D.voicemails = [];
    for(const r of wavs.filter(r => /^voicemails\/[^/]+\/[^/]+$/.test(r))){
      const b = await take(r), fn = r.split('/').pop(), m = fn.match(/^vmail_(.*?)_(\d+)_(\d{14})/);
      D.voicemails.push({ext: r.split('/')[1], from: m ? m[1] : '', date: m ? m[3] : '', path: 'zip:' + r, size: b.size});
    }
    D.voicemails.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    D.vmGreetings = [];
    for(const r of wavs.filter(r => /^vmailprompts\/[^/]+\/[^/]+$/.test(r))){ await take(r); D.vmGreetings.push({ext: r.split('/')[1], file: r.split('/').pop(), path: 'zip:' + r}); }
    D.vmGreetings.sort((a, b) => a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0);

    // ---------- Appels (CDR) ----------
    progress("Reconstitution de l'historique des appels…", 9);
    const calls = new Map();
    for(const r of await csv('cdroutput', f => progress("Lecture de l'historique des appels…", 9 + 46 * f))){ const k = r.main_call_history_id || r.call_history_id; if(!calls.has(k)) calls.set(k, []); calls.get(k).push(r); }
    const PATH = new Set(['ivr', 'queue', 'group', 'ring_group_ring_all', 'ring_group_hunt', 'extension', 'vmail_console', 'shared_parking', 'fax', 'script']);
    // 18.1.1 : étape « messagerie vocale » (3CX garde le type du poste, l'entité vaut voicemail) : ce n'est pas une personne qui répond
    const isVM = r => r.destination_entity_type === 'voicemail'; // 18.1.2 : aussi la messagerie d'une file ou d'un groupe de sonnerie
    const out = [];
    let nGrp = 0; const totGrp = calls.size || 1;
    for(const segs of calls.values()){
      if(++nGrp % 4000 === 0){ progress("Reconstitution de l'historique des appels…", 55 + 14 * nGrp / totGrp); await tick(); }
      segs.sort((a, b) => a.cdr_started_at < b.cdr_started_at ? -1 : a.cdr_started_at > b.cdr_started_at ? 1 : 0);
      const first = segs[0];
      let start = segs[0].cdr_started_at, end = '';
      for(const r of segs){ if(r.cdr_started_at < start) start = r.cdr_started_at; const e = r.cdr_ended_at || r.cdr_started_at; if(e > end) end = e; }
      const inbound = first.source_dn_type === 'external_line' || first.source_entity_type === 'external_line';
      const outSeg = segs.find(r => r.destination_dn_type === 'provider');
      let direction, frm, frmName, to, did = '';
      if(inbound){ direction = 'in'; frm = first.source_participant_phone_number; frmName = first.source_participant_name;
        did = (segs.find(r => r.source_participant_trunk_did) || {}).source_participant_trunk_did || ''; to = did; }
      else if(outSeg){ direction = 'out'; frm = first.source_dn_number; frmName = first.source_dn_name; to = outSeg.destination_participant_phone_number || outSeg.destination_dn_number; }
      else { direction = 'int'; frm = first.source_dn_number; frmName = first.source_dn_name; to = first.destination_dn_number; }
      const path = [];
      for(const r of segs){ const t = r.destination_dn_type; if(PATH.has(t) && r.destination_dn_number){ const lab = r.destination_dn_number; if(!path.length || path[path.length - 1][0] !== lab) path.push([lab, t]); } }
      let answered = null, talk = 0;
      const byExt = {}; // chaque poste ayant répondu pendant l'appel -> durée de conversation (s)
      let firstAt = '', firstBy = ''; // premier décroché par une personne (délai avant réponse)
      for(const r of segs) if(r.cdr_answered_at && r.destination_dn_type === 'extension' && r.destination_dn_number && !isVM(r)){
        byExt[r.destination_dn_number] = (byExt[r.destination_dn_number] || 0) + secs(r.cdr_answered_at, r.cdr_ended_at);
        if(!firstAt || r.cdr_answered_at < firstAt){ firstAt = r.cdr_answered_at; firstBy = r.destination_dn_number; } }
      for(const r of segs){
        if(r.cdr_answered_at && isVM(r)){ if(!answered) answered = 'VM'; continue; }
        if(r.cdr_answered_at && r.destination_dn_type === 'fax'){ if(!answered || answered === 'VM') answered = r.destination_dn_number || 'FAX'; continue; } // 18.1.4 : fax reçu
        if(r.cdr_answered_at && ['extension', 'provider', 'vmail_console'].includes(r.destination_dn_type)){
          if(direction === 'out' && r.destination_dn_type === 'provider'){ answered = answered || first.source_dn_number; talk += secs(r.cdr_answered_at, r.cdr_ended_at); }
          else if(r.destination_dn_type === 'extension'){ if(answered === 'VM') answered = null; answered = r.destination_dn_number; talk += secs(r.cdr_answered_at, r.cdr_ended_at); }
          else if(r.destination_dn_type === 'vmail_console' && !answered) answered = 'VM';
        }
      }
      if(direction === 'int' && !answered && first.cdr_answered_at && ['extension', 'provider', 'vmail_console'].includes(first.destination_dn_type) && !isVM(first)){ answered = first.destination_dn_number; talk = secs(first.cdr_answered_at, first.cdr_ended_at); }
      const types = segs.map(r => r.destination_dn_type), prov = segs.filter(r => r.destination_dn_type === 'provider');
      let status;
      if(answered === 'VM') status = 'vm';
      else if(answered) status = 'ans';
      else if(direction === 'in' && prov.length){
        status = prov.some(r => r.cdr_answered_at) ? 'fwd_ok' : 'fwd_no';
        if(status === 'fwd_ok') talk = prov.filter(r => r.cdr_answered_at).reduce((a, r) => a + secs(r.cdr_answered_at, r.cdr_ended_at), 0);
      }
      else if(types.includes('bridge')) status = 'bridge';
      else if(types.includes('queue')) status = 'q_ab';
      else if(types.includes('ivr')) status = 'ivr_ab';
      else status = 'miss';
      if(direction === 'in' && segs.some(r => r.destination_entity_type === 'shared_parking' && r.termination_reason === 'src_participant_terminated')) status = 'park_ab';
      // étapes détaillées (15.15) : [numéro, type, début (s), durée (s), décroché après (s, -1 sinon), fin, suite (motif de l'étape suivante), créée par, motif de création]
      const byId = {}; segs.forEach(r => { if(r.cdr_id) byId[r.cdr_id] = r; });
      const steps = segs.filter(r => r.destination_dn_type && r.destination_dn_type !== 'external_line').map(r => { const n = byId[r.continued_in_cdr_id], b = secs(start, r.cdr_started_at);
        return [r.destination_dn_number || r.destination_participant_phone_number || '', isVM(r) ? 'voicemail' : r.destination_dn_type, b, secs(r.cdr_started_at, r.cdr_ended_at || r.cdr_started_at), r.cdr_answered_at ? secs(r.cdr_started_at, r.cdr_answered_at) : -1,
          r.termination_reason || '', n ? n.creation_forward_reason || n.creation_method || '' : '', r.creation_method || '', r.creation_forward_reason || '']; });
      out.push([iso(start), direction, frm, frmName, to, did, answered || '', secs(start, end), talk, path, status, Object.entries(byExt), firstAt ? secs(start, firstAt) : null, firstBy, steps]);
    }
    out.sort((a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0);
    D.calls = out; D.cdrv = 6; // version de lecture du backup (18.2.37 : fuseau du système)
    // parkings partagés : chaque passage d'un appel par un parking (qui l'a mis, combien de temps, comment il en sort) ; aucun numéro externe conservé
    D.parkCalls = [];
    for(const segs of calls.values()){
      const by = {}, prev = {}; segs.forEach(r => { by[r.cdr_id] = r; if(r.continued_in_cdr_id) prev[r.continued_in_cdr_id] = r; });
      const did = (segs.find(r => r.source_participant_trunk_did) || {}).source_participant_trunk_did || '';
      for(const r of segs){
        if(r.destination_entity_type !== 'shared_parking') continue;
        const nx = by[r.continued_in_cdr_id], pv = prev[r.cdr_id], parker = pv && pv.destination_entity_type === 'extension' ? pv.destination_dn_number : r.source_entity_type === 'extension' ? r.source_dn_number : '';
        const o = r.creation_method === 'call_init' ? 'direct' : nx && nx.creation_method === 'pickup' ? 'pickup' : nx && nx.creation_method === 'route_to' && nx.destination_entity_type === 'extension' ? 'back'
          : nx && nx.creation_forward_reason === 'no_answer' ? 'timeout' : nx && nx.creation_method === 'transfer' ? 'transfer' : r.termination_reason === 'src_participant_terminated' ? 'hangup' : 'other';
        D.parkCalls.push([iso(r.cdr_started_at), r.destination_dn_number, secs(r.cdr_started_at, r.cdr_ended_at), o, parker || '', nx ? nx.destination_dn_number || '' : '', r.source_entity_type === 'external_line' ? 'ext' : 'int', did]);
      }
    }

    progress("Statistiques des files d'attente…", 70);
    const qs = {}, qrows = [];
    for(const r of await csv('callcent_queuecalls')){
      const s = qs[r.q_num] ||= {total: 0, served: 0, abandoned: 0, noAgents: 0, wait: 0, waitServed: 0, talk: 0, hours: Array(24).fill(0)};
      const w = interval(r.ts_waiting), served = (r.call_result || '').includes('S');
      s.total++; s.wait += w;
      if(served){ s.served++; s.waitServed += w; s.talk += interval(r.ts_servicing); } else s.abandoned++;
      if(r.reason_noanswerdesc === 'NoAgents') s.noAgents++;
      const h = parseInt((r.time_start || '').slice(11, 13)); if(!isNaN(h)) s.hours[h]++;
      qrows.push([iso(r.time_start), r.q_num, r.from_userpart, r.from_displayname, w, interval(r.ts_servicing), served, r.to_dn, r.reason_noanswerdesc || r.reason_faildesc]);
    }
    qrows.sort(desc);
    D.queueStats = qs; D.queueCalls = qrows;
    progress('Connexions des agents aux files…', 78);
    // [date ISO, file, agent, 1 connecté | 0 déconnecté], dans l'ordre chronologique
    D.agentStatus = (await csv('callcent_ag_queuestatus')).filter(r => r.timeofupdate && r.q_num && r.ag_num).map(r => [iso(r.timeofupdate), r.q_num, r.ag_num, r.is_loggedin_in_queue === 't' ? 1 : 0]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    progress('Sonneries des agents en file…', 80);
    // 'AAAA-MM-JJ|file|agent' -> [répondues, expirées, appelant raccroché, annulées (collègue), autres, décroché total (s)]
    D.agentPolls = {};
    const tzo = {};
    const lday = ts => { const k = ts.slice(0, 13); let o = tzo[k];
      if(o === undefined){ const d = new Date(k.replace(' ', 'T') + ':00:00Z'); o = tzo[k] = Date.parse(d.toLocaleString('sv-SE', {timeZone: D.tz || 'America/Toronto'}).replace(' ', 'T') + 'Z') - d.getTime(); }
      return new Date(Date.parse(ts.slice(0, 19).replace(' ', 'T') + 'Z') + o).toISOString().slice(0, 10); };
    for(const r of await csv('callcent_ag_dropped_calls')){
      if(!r.time_start || !r.ag_num) continue;
      const a = D.agentPolls[lday(r.time_start) + '|' + r.q_num + '|' + r.ag_num] ||= [0, 0, 0, 0, 0, 0], c = r.reason_noanswercode;
      if(c === '202'){ a[0]++; const p = (r.ts_polling || '').split(':'); if(p.length === 3) a[5] += +p[0] * 3600 + +p[1] * 60 + parseFloat(p[2]); }
      else if(c === '408') a[1]++; else if(c === '486') a[2]++; else if(c === '487' || c === '200' || c === '203' || c === '485') a[3]++; else a[4]++;
    }

    progress('Enregistrements et journal d\'audit…', 86);
    D.recordings = (await csv('recordings')).map(r => {
      const url = r.recording_url, m = url.match(/^(\d+)\/\[(.*?)\]_(\d+)-(.*?)_(\d{14})/);
      return [iso(r.start_time), m ? m[1] : url.split('/')[0], m ? m[2] : '', m ? m[4] : '', secs(r.start_time, r.end_time), url, r.archived === 't', r.queue_dn];
    }).sort(desc);
    const recMap = recIndex(z, D.recordings);
    D.recInBackup = Object.keys(recMap).length;
    const ACTIONS = {'0': 'Création', '1': 'Modification', '2': 'Suppression', '18': 'Connexion'};
    const auditRows = await csv('audit_log');
    for(let k = 0; k < auditRows.length; k++){ const r = auditRows[k];
      try{ r._p = r.prev_data ? JSON.parse(r.prev_data) : {}; r._n = r.new_data ? JSON.parse(r.new_data) : {}; }catch(e){ r._p = {}; r._n = {}; }
      if(k % 200 === 199){ progress("Journal d'audit…", 86 + 9 * k / auditRows.length); await tick(); } }
    const maskDeep = v => v && typeof v === 'object' ? (Array.isArray(v) ? v.map(maskDeep) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE.test(k) ? (x ? '•••• (masqué)' : x) : maskDeep(x)]))) : v;
    D.audit = auditRows.map(r => {
      const changes = []; let prev = {}, neu = {};
      prev = r._p; neu = r._n;
      if(prev && neu && typeof prev === 'object' && typeof neu === 'object' && !Array.isArray(prev) && !Array.isArray(neu)){
        for(const k of [...new Set([...Object.keys(prev), ...Object.keys(neu)])].sort()){
          if(SENSITIVE.test(k)) continue;
          const a = maskDeep(prev[k]), b = maskDeep(neu[k]); // 18.1.34 : secrets masqués à tous les niveaux
          const sa = a === undefined || a === null ? '' : pyDumps(a), sb = b === undefined || b === null ? '' : pyDumps(b);
          if(JSON.stringify(a) !== JSON.stringify(b)) changes.push([k, sa.slice(0, 300), sb.slice(0, 300)]);
        }
      }
      return [iso(r.time_stamp), ACTIONS[r.action] || 'Action ' + r.action, r.object_type, r.user_name, r.object_name, r.ip, changes.slice(0, 40)];
    }).sort(desc);
    // appartenances : [date, auteur, 'dept' | 'file' | 'file-gest' | 'groupe', nom de l'objet, poste, 'add' | 'del' | 'role', ancien rôle, nouveau rôle]
    D.auditMem = [];
    {
      const gid = {}; // identifiant interne d'un département -> nom (d'après les listes de membres)
      const O = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
      auditRows.forEach(r => { if(r.object_type === '14') [r._p, r._n].forEach(x => (O(x).Members || []).forEach(m => { if(m && m.GroupId != null && m.Name) gid[m.GroupId] = m.Name; })); });
      const diff = (r, kind, oname, pl, nl, key, role) => { if(!Array.isArray(pl) && !Array.isArray(nl)) return; const P = {}, Q = {};
        (pl || []).forEach(m => { if(m && m[key] != null) P[m[key]] = role(m); }); (nl || []).forEach(m => { if(m && m[key] != null) Q[m[key]] = role(m); });
        const num = k => kind === 'ext' ? String(r.object_name || '').split(' ')[0] : String(k), obj = k => kind === 'ext' ? (gid[k] || 'département n° ' + k) : oname, kd = kind === 'ext' ? 'dept' : kind;
        Object.keys(Q).filter(k => !(k in P)).forEach(k => D.auditMem.push([iso(r.time_stamp), r.user_name, kd, obj(k), num(k), 'add', '', Q[k] || '']));
        Object.keys(P).filter(k => !(k in Q)).forEach(k => D.auditMem.push([iso(r.time_stamp), r.user_name, kd, obj(k), num(k), 'del', P[k] || '', '']));
        Object.keys(Q).filter(k => k in P && P[k] && Q[k] && P[k] !== Q[k]).forEach(k => D.auditMem.push([iso(r.time_stamp), r.user_name, kd, obj(k), num(k), 'role', P[k], Q[k]])); };
      const rn = m => (m.Rights && m.Rights.RoleName) || '', none = () => '';
      auditRows.forEach(r => { if(!['0', '1', '2'].includes(r.action)) return; const p = O(r._p), n = O(r._n), on = String(r.object_name || '');
        if(r.object_type === '14' && (p.Members || n.Members)) diff(r, 'dept', on, p.Members, n.Members, 'Number', rn);
        if(r.object_type === '16'){ if(p.Agents || n.Agents) diff(r, 'file', on, p.Agents, n.Agents, 'Number', none); if(p.Managers || n.Managers) diff(r, 'file-gest', on, p.Managers, n.Managers, 'Number', none); }
        if(r.object_type === '17' && (p.Members || n.Members)) diff(r, 'groupe', on, p.Members, n.Members, 'Number', none);
        if(r.object_type === '7' && r.action !== '2' && (p.Groups || n.Groups)) diff(r, 'ext', on, p.Groups, n.Groups, 'GroupId', rn); });
      D.auditMem.sort((a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0); }
    // firmware effacé lors d'une modification du téléphone dans la console : [MAC, firmware précédent, date, utilisateur, poste]
    D.fwErased = [];
    auditRows.forEach(r => {
      const p = (r.prev_data || '').match(/"Firmware":"([^"]*)"/), n = (r.new_data || '').match(/"Firmware":"([^"]*)"/), m = (r.new_data || '').match(/"MacAddress":"([0-9A-Fa-f]{12})"/);
      if(p && n && p[1] && !n[1] && m) D.fwErased.push([m[1].toUpperCase(), p[1], iso(r.time_stamp), r.user_name, (r.object_name || '').split(' ')[0]]);
    });
    D.fwErased.sort((a, b) => a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
    // version réellement installée, annoncée par le téléphone (User-Agent) dans les rapports de qualité d'appel : [MAC, modèle, version, date, numéro]
    D.phoneUA = [];
    const clq = await csv('cl_quality');
    clq.forEach(r => ['a', 'b'].forEach(x => {
      const m = (r[x + '_useragent'] || '').match(/^(\S+)\s+(?:SIP-)?(\S+)\s+(\d+(?:\.\d+){2,})\s+([0-9a-fA-F]{12})/);
      if(m) D.phoneUA.push([m[4].toUpperCase(), m[1] + ' ' + m[2], m[3], iso(r.time_stamp), r[x + '_number'] || '']);
    }));
    D.phoneUA.sort((a, b) => a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0);
    // qualité de la voix : un objet par rapport, un côté (leg) par participant
    const qn = v => v === '' || v == null || isNaN(+v) ? null : +v;
    D.quality = clq.map(r => ({t: iso(r.time_stamp), sum: r.summary, tc: r.transcoding === 't', legs: ['a', 'b'].map(x => ({
      num: String(r[x + '_number'] || '').replace(/^\+/, ''), name: r[x + '_name'] || '', ua: r[x + '_useragent'] || '', caller: r[x + '_caller'] === 't',
      addr: r[x + '_address'] || '', pub: r[x + '_tun_address'] || '', codec: r[x + '_codec'] || '', rtt: qn(r[x + '_rtt']),
      mosTo: qn(r[x + '_mos_to_pbx']), mosFrom: qn(r[x + '_mos_from_pbx']),
      loss: Math.max(qn(r[x + '_rx_loss']) || 0, qn(r[x + '_tx_loss']) || 0), jit: Math.max(qn(r[x + '_rx_jitter']) || 0, qn(r[x + '_tx_jitter']) || 0),
      dur: qn(r[x + '_duration']) || 0}))}));
    D.chatCount = (await csv('chat_message')).length;
    D.source = {kind: 'zip', name: file.name, size: file.size, loadedAt: new Date().toISOString(), fwd: 1}; // fwd : 19.0.3, renvois désactivés lus
    D.missingTables = MISSING;
    return {D, audio, rec: {z, map: recMap}};
  }

