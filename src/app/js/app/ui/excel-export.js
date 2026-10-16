// ---------- Export Excel complet (.xlsx écrit directement dans le navigateur, sans bibliothèque) ----------
const XL = (() => {
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for(let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  // archive ZIP sans compression (format attendu par Excel, LibreOffice et Numbers)
  function zip(files){
    const parts = [], central = []; let off = 0;
    files.forEach(([name, text]) => {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + data.length;
    });
    const csize = central.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  const x = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = i => { let s = ''; i++; while(i){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sheetName = (n, used) => { let b = String(n).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Feuille', s = b, k = 2; while(used.has(s)) s = b.slice(0, 28) + ' ' + k++; used.add(s); return s; };
  function sheetXml(rows){
    const ncol = Math.max(1, ...rows.map(r => r.length)), w = Array(ncol).fill(8);
    rows.forEach(r => r.forEach((v, i) => { const l = v == null ? 0 : String(v).length; w[i] = Math.min(60, Math.max(w[i], l + 2)); }));
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const ref = col(ci) + (ri + 1), s = ri === 0 ? ' s="1"' : '';
      if(v == null || v === '') return ri === 0 ? `<c r="${ref}"${s}/>` : '';
      if(typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
      if(typeof v === 'boolean') v = v ? 'oui' : 'non';
      return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${x(String(v).slice(0, 32000))}</t></is></c>`; }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetViews><sheetView workbookViewId="0"${rows.length > 1 ? '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>' : '/>'}</sheetViews>`
      + `<cols>${w.map((v, i) => `<col min="${i + 1}" max="${i + 1}" width="${v}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>`
      + (rows.length > 1 ? `<autoFilter ref="A1:${col(ncol - 1)}${rows.length}"/>` : '') + `</worksheet>`;
  }
  return {build(sheets){
    const used = new Set(), S = sheets.map(s => ({...s, name: sheetName(s.name, used)}));
    const files = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${S.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${S.map((s, i) => `<sheet name="${x(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${S.some(s => s.rows.length > 1) ? `<definedNames>${S.map((s, i) => s.rows.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(s.name.replace(/'/g, "''"))}'!$A$1:$${col(Math.max(1, ...s.rows.map(r => r.length)) - 1)}$${s.rows.length}</definedName>` : '').join('')}</definedNames>` : ''}</workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${S.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${S.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],
      ...S.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)])];
    return {blob: zip(files), sheets: S};
  }};
})();
// contenu du classeur : une feuille par sujet, filtrée par le magasin du bandeau
function xlsxSheets(){
  const yn = b => b ? 'oui' : 'non', sh = [], seg = n => segShort(SEGOF[n] || SEG_COMMON), inSeg = n => !SEG || SEGOF[n] === SEG;
  const exts = FULL.extensions.filter(e => inSeg(e.number));
  sh.push({name: 'Postes', rows: [['Poste', 'Nom', 'Magasin', 'Courriel', 'Actif', 'Profil actuel', 'Départements', "Files d'attente", 'Téléphones', 'Caller ID', 'Mobile', 'Enregistrement', 'Messagerie', 'Réseau local seulement', 'MFA', 'Compte Microsoft 365']]
    .concat(exts.map(e => [e.number, (e.first + ' ' + e.last).trim(), seg(e.number), e.email, yn(e.enabled), e.profile, e.groups.filter(g => !/^(__|SYSTEM$|___FAV)/.test(g.g)).map(g => g.g + (g.role && g.role !== 'users' ? ' (' + secRole(g.role)[1] + ')' : '')).join(', '),
      e.queues.join(', '), e.devices.map(d => d.model || d.template).join(', '), e.callerId, e.mobile, yn(e.record), yn(e.vm), yn(e.lanOnly), MFA_L[mfaOf(e).k][0], mfaOf(e).upn]))});
  sh.push({name: 'Téléphones', rows: [['Poste', 'Utilisateur', 'Magasin', 'Modèle', 'MAC', 'Firmware assigné', 'Version recommandée 3CX', 'État', 'Détail']]
    .concat(phoneRows().map(r => [r.ext, r.user, seg(r.ext), r.model, r.mac, r.fw, r.rec, (PH_ST[r.st] || {l: r.st}).l, r.why]))});
  const qs = FULL.queues.filter(q => inSeg(q.number));
  sh.push({name: "Files d'attente", rows: [['File', 'Nom', 'Magasin', 'Stratégie', 'Sonnerie par agent (s)', 'Attente maximale (s)', 'Membres', 'Connectés', 'Si personne ne répond', 'Appels (historique)', 'Servis', '% servis']]
    .concat(qs.map(q => { const s = FULL.queueStats[q.number] || {total: 0, served: 0}; return [q.number, q.name, seg(q.number), q.strategy, +q.ringTimeout || q.ringTimeout, +q.masterTimeout || q.masterTimeout, q.members.length,
      q.members.filter(m => !m.status || m.status === 'LoggedIn').length, destTxt1(q.dest), s.total, s.served, s.total ? Math.round(1000 * s.served / s.total) / 10 : '']; }))});
  const C = ctlRun();
  sh.push({name: 'SDA', rows: [['SDA', 'Magasin', 'Règle entrante', 'Destination', 'Appels (historique)', ...C.M.map(m => `${m[1]} (${m[2]})`)]]
    .concat(C.rows.map(r => [phone(r.did), segShort(r.seg), r.e.rule?.name || (r.e.isDefault ? 'Règle par défaut du trunk' : ''), r.e.rule?.office ? destTxt1(r.e.rule.office) : 'aucune', r.calls,
      ...r.cells.map(c => SIM_END[c.end][0] + (c.after ? ' / sinon : ' + SIM_END[c.after][0] : '') + (c.holWarn ? ' / férié non configuré' : '') + ' — ' + c.why)]))});
  // jours fériés manquants dans les 12 prochains mois (jours non observés exclus)
  const cfgF = ferCfg(), today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), lim = addDaysISO(today, 365), y0 = +today.slice(0, 4);
  const hols = [...qcHolidays(y0), ...qcHolidays(y0 + 1)].filter(h => h[1] >= today && h[1] <= lim && !cfgF.skip.includes(h[0]));
  const depts = FULL.groups.filter(g => !isSysGroup(g) && !/^___FAVORITES/.test(g.name) && g.routes?.office?.to && g.routes.office.to !== 'None' && g.hours?.type !== 'AllHours' && SEGOF[g.number] !== SEG_BRIDGE && inSeg(g.number));
  const fer = []; depts.forEach(g => { const sch = deptSchedule(g); hols.forEach(h => { if(!sch.isHol(h[1]) && sch.per(simWd(h[1])).length) fer.push([seg(g.number), g.name, g.number, h[0], h[1], FER_FIXED.has(h[0]) ? 'oui' : 'non']); }); });
  sh.push({name: 'Fériés à saisir', rows: [['Magasin', 'Département', 'Numéro', 'Jour férié', 'Date', 'Récurrent']].concat(fer)});
  const SA = secAnalysis();
  sh.push({name: 'Sécurité - comptes', rows: [['Poste', 'Nom', 'Magasin', 'Rôle', 'Portée', 'MFA', 'Réseau local seulement', 'Dernière connexion', 'Adresses IP']]
    .concat(SA.elevated.filter(r => !SEG || r.seg === SEG).map(r => [r.e.number, (r.e.first + ' ' + r.e.last).trim(), segShort(r.seg), secRole(r.role)[1], r.global ? 'Système entier' : r.groups.join(', '), MFA_L[r.fa][0], yn(r.lan), r.last ? fmtD(r.last) : '', r.ips]))});
  sh.push({name: 'Renvois externes', rows: [['Poste', 'Nom', 'Magasin', 'Numéros externes', 'Profils', 'Profil actif concerné', 'Sonne aussi le cellulaire']]
    .concat(SA.fwd.filter(r => !SEG || r.seg === SEG).map(r => [r.e.number, (r.e.first + ' ' + r.e.last).trim(), segShort(r.seg), r.nums.map(phone).join(', '), r.profiles.map(p => p.p.name).join(', '), yn(r.active), yn(r.mobile)]))});
  const ID = indispAnalysis();
  sh.push({name: 'Personnes indispensables', rows: [['Élément', 'Nom', 'Type', 'Magasin', 'Agents connectés', 'Membres', 'Appels (30 j)', 'Risque', 'Si personne ne répond']]
    .concat(ID.risky.map(x => [x.dn, x.name, x.kind, segShort(x.seg), x.on, x.members, x.calls, x.why.map(w => w[1]).join(' ; '), destTxt1(x.after)]))});
  const eff = [];
  qs.forEach(q => { const A = effAnalysis(new Set([q.number]), 8, '80|' + (objFor(SEGOF[q.number], 'wait') || 30)); A.G.forEach((r, wd) => r.forEach((c, h) => { if(c.st === 'bad' || c.st === 'warn')
    eff.push([q.number, q.name, seg(q.number), EFF_DAYS[wd], `${h} h – ${h + 1} h`, Math.round(c.cph * 10) / 10, c.n ? Math.round(1000 * c.ab / c.n) / 10 : 0, c.n ? Math.round(1000 * c.ov / c.n) / 10 : 0, Math.round(c.agents * 10) / 10, c.need, c.st === 'bad' ? 'sous-doté' : 'juste']); })); });
  sh.push({name: 'Effectif - créneaux', rows: [['File', 'Nom', 'Magasin', 'Jour', 'Heure', 'Appels / h', '% abandonnés', '% débordés', 'Agents actifs', 'Agents nécessaires', 'État']].concat(eff)});
  const SEVN = {crit: 'Critique', fix: 'À corriger', obs: 'Observation'};
  sh.push({name: 'Recommandations', rows: [['Gravité', 'Catégorie', 'Constat', 'Détail', 'Recommandation', 'Éléments', 'Liste']]
    .concat(analyse().map(f => [SEVN[f.sev] || f.sev, f.cat, f.title, f.detail, f.reco, f.items.length, f.items.map(i => i.text).join(' | ')]))});
  const info = FULL.info, now = new Date();
  sh.unshift({name: 'Résumé', rows: [['3CXplore — export complet', ''], ['Système', info.company + ' · 3CX ' + info.version], ['Backup du', bkDate(info.date)], ['Magasin', SEG ? segName(SEG) : 'Tous les magasins'], ['Exporté le', now.toLocaleString('fr-CA')], ['', ''], ['Feuille', 'Lignes']]
    .concat(sh.map(s => [s.name, s.rows.length - 1]))});
  return sh;
}
function exportXlsx(){
  const {blob, sheets} = XL.build(xlsxSheets());
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `visualiseur-3cx-${SEG ? segShort(SEG).replace(/[^\w-]+/g, '_') + '-' : ''}${new Date().toLocaleDateString('fr-CA')}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return {size: blob.size, sheets: sheets.map(s => [s.name, s.rows.length - 1])};
}

