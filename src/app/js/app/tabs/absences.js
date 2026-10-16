// ---------- Absences et congés (15.16) : qui manque, ce qui reste sans personne, qui peut remplacer ----------
// liste gardée seulement dans ce navigateur (clé absences3cx:<système>), incluse dans la Sauvegarde des réglages
const ABS_KEY = 'absences3cx:' + (FULL.info.fqdn || '');
const absLoad = () => { try{ const j = JSON.parse(localStorage.getItem(ABS_KEY) || '{}'); return Array.isArray(j.list) ? j.list : []; }catch(e){ return []; } };
const absSave = list => { try{ localStorage.setItem(ABS_KEY, JSON.stringify({list})); }catch(e){} };
const absDays = (a, b) => { const out = []; for(let d = new Date(a + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= b && out.length < 400; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
const absWd = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
const absToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const ABS_WD = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
// éléments où une personne compte : files, départements, groupes de sonnerie
function absBoxes(){
  const out = [];
  FULL.queues.forEach(q => out.push({kind: "File d'attente", dn: q.number, members: q.members.map(m => m.dn), on: new Set(q.members.filter(m => !m.status || m.status === 'LoggedIn').map(m => m.dn))}));
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => out.push({kind: 'Département', dn: g.number, members: g.members.map(m => m.dn), on: null}));
  FULL.ringGroups.forEach(r => out.push({kind: 'Groupe de sonnerie', dn: r.number, members: r.members.slice(), on: null}));
  return out.filter(b => b.members.length);
}
// appels répondus par chaque poste, par jour de semaine, sur les 8 dernières semaines de l'historique
function absLoad8(){
  const all = FULL.calls, end = all.length ? all[0][0] : new Date().toISOString(), from = new Date(Date.parse(end) - 56 * 864e5).toISOString(), R = {};
  for(const c of all){ if(c[0] < from) break; if(c[1] !== 'in' || !ST_ANS.has(c[10])) continue; const who = c[13] || c[6]; if(!who || who === 'VM' || !EXT_BY[who]) continue;
    const wd = localParts(c[0])[2]; (R[who] ||= Array(7).fill(0))[wd]++; }
  const old = all.length ? Date.parse(all[all.length - 1][0]) : Date.parse(end), wk = Math.max(1, Math.min(8, (Date.parse(end) - old) / (7 * 864e5))); // 18.1.38 : semaines réellement disponibles
  Object.values(R).forEach(a => a.forEach((v, i) => a[i] = v / wk));
  return R;
}
function absImpact(a, list, boxes, perWd){
  const E = a.ext, ov = list.filter(x => x.id !== a.id && x.ext !== E && x.from <= a.to && x.to >= a.from), others = new Set(ov.map(x => x.ext)), days = absDays(a.from, a.to);
  const offOn = (m, d) => ov.some(x => x.ext === m && x.from <= d && x.to >= d);
  const span = ds => ds.length === 1 ? `le ${ds[0]}` : ds.length === absDays(ds[0], ds[ds.length - 1]).length ? `du ${ds[0]} au ${ds[ds.length - 1]}` : `${ds.length} jours`;
  const rows = boxes.filter(b => b.members.includes(E)).map(b => { const rest = b.members.filter(m => m !== E), restOn = b.on ? rest.filter(m => b.on.has(m)) : null;
    const avail = days.map(d => rest.filter(m => !offOn(m, d)).length), min = avail.length ? Math.min(...avail) : rest.length, empty = days.filter((d, i) => !avail[i]);
    const sev = !rest.length || empty.length ? 'bad' : (b.on && !restOn.length) || min === 1 ? 'warn' : 'ok';
    const txt = !rest.length ? 'seule personne de cet élément' : empty.length ? `plus personne ${span(empty)}` : b.on && !restOn.length ? `${rest.length} autre${rest.length > 1 ? 's' : ''}, aucun connecté actuellement`
      : min < rest.length ? `${min} autre${min > 1 ? 's' : ''} au minimum (absences en même temps)` : `${rest.length} autre${rest.length > 1 ? 's' : ''} disponible${rest.length > 1 ? 's' : ''}${restOn ? ` (${restOn.length} connecté${restOn.length > 1 ? 's' : ''})` : ''}`;
    return {b, rest, restOn, sev, txt}; })
    .sort((x, y) => ['bad', 'warn', 'ok'].indexOf(x.sev) - ['bad', 'warn', 'ok'].indexOf(y.sev));
  const direct = (dnRefs()[E] || []).filter(r => r.cat !== 'member');
  const blf = FULL.extensions.filter(e => e.number !== E && (e.blfs || []).some(b => b.type === 'BLF' && b.v === E)).length;
  const pw = perWd[E] || Array(7).fill(0), calls = days.reduce((s, d) => s + pw[absWd(d)], 0);
  // remplaçants : collègues qui partagent le plus d'éléments, présents, du même magasin de préférence
  const mine = rows.map(r => r.b), score = {};
  mine.forEach(b => b.members.forEach(m => { if(m === E || others.has(m) || !EXT_BY[m] || !EXT_BY[m].enabled) return; const s = score[m] ||= {m, shared: [], calls: 0}; s.shared.push(b); }));
  Object.values(score).forEach(s => { s.calls = (perWd[s.m] || []).reduce((x, y) => x + y, 0); s.same = (SEGOF[s.m] || '') === (SEGOF[E] || ''); });
  const subs = Object.values(score).sort((x, y) => y.shared.length - x.shared.length || (y.same - x.same) || y.calls - x.calls).slice(0, 3);
  const e = EXT_BY[E], p = e && (e.profiles.find(p => p.name === e.profile) || e.profiles[0]), rt = p && p.routes.find(r => /^AvailableRoute › NoAnswer › AllCalls/.test(r[0]));
  return {rows, direct, blf, days, calls, subs, ifNo: rt ? rt[1] : null, others, sev: rows.some(r => r.sev === 'bad') ? 'bad' : rows.some(r => r.sev === 'warn') ? 'warn' : 'ok'};
}
// jours où une file, un département ou un groupe n'a plus personne
function absCritical(list, boxes, from, to){
  const out = [];
  absDays(from, to).forEach(d => { const off = new Set(list.filter(x => x.from <= d && x.to >= d).map(x => x.ext)); if(!off.size) return;
    const empty = boxes.filter(b => b.members.some(m => off.has(m)) && b.members.every(m => off.has(m))); if(empty.length) out.push({d, empty, off}); });
  return out;
}
V.absences = el => {
  const list = absLoad().sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0), today = absToday(), boxes = absBoxes(), perWd = absLoad8();
  const S = window.__abs ||= {ext: '', from: today, to: today, note: '', past: false};
  const inSeg = n => !SEG || (SEGOF[n] || SEG_COMMON) === SEG;
  const exts = FULL.extensions.filter(e => inSeg(e.number)).sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  const shown = list.filter(a => inSeg(a.ext)), cur = shown.filter(a => a.from <= today && a.to >= today), next = shown.filter(a => a.from > today), past = shown.filter(a => a.to < today);
  const horizon = new Date(Date.parse(today + 'T12:00:00Z') + 55 * 864e5).toISOString().slice(0, 10);
  const crit = absCritical(list, boxes, today, horizon).map(c => ({...c, empty: c.empty.filter(b => inSeg(b.dn))})).filter(c => c.empty.length);
  const imp = {}; [...cur, ...next, ...past].forEach(a => imp[a.id] = absImpact(a, list, boxes, perWd));
  const nm = n => `${n} ${dnName(n)}`.trim();
  const card = a => { const I = imp[a.id], d = I.days.length;
    return `<div class="card" style="margin:10px 0;border-left:4px solid var(--${I.sev === 'bad' ? 'bad' : I.sev === 'warn' ? 'warn' : 'ok'})">
      <div class="omhh"><b>${dnLink(a.ext)}</b> <span class="muted">${esc(segShort(SEGOF[a.ext] || SEG_COMMON))}</span> <span class="pill">du ${esc(a.from)} au ${esc(a.to)}</span> <span class="muted">${nf(d)} jour${d > 1 ? 's' : ''}</span>${a.note ? ` <span class="muted">· ${esc(a.note)}</span>` : ''}<span style="flex:1"></span><button class="btn" data-del="${esc(a.id)}">Retirer</button></div>
      ${I.others.size ? `<p class="muted" style="font-size:12.5px">Absents en même temps : ${[...I.others].map(n => dnLink(n)).join(', ')}</p>` : ''}
      ${I.rows.length ? `<div class="tw"><table><thead><tr><th>Élément</th><th>Type</th><th>Pendant l'absence</th><th>Autres personnes</th></tr></thead><tbody>${I.rows.map(r => `<tr><td>${dnLink(r.b.dn)}</td><td class="muted">${esc(r.b.kind)}</td>
        <td><span class="pill ${r.sev === 'ok' ? 'ok' : r.sev}">${esc(r.txt)}</span></td><td style="font-size:12.5px">${r.rest.slice(0, 4).map(m => dnLink(m)).join(', ')}${r.rest.length > 4 ? ` <span class="muted">+${r.rest.length - 4}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Membre d\'aucune file, d\'aucun département ni d\'aucun groupe de sonnerie.</p>'}
      ${kv([['Appels habituellement répondus', I.calls >= 0.5 ? `≈ ${nf(Math.round(I.calls))} sur la période <span class="muted">(moyenne des 8 dernières semaines)</span>` : '<span class="muted">peu ou pas d\'appels</span>'],
        ['Mène directement à ce poste', I.direct.length ? I.direct.slice(0, 8).map(r => `<div>${refLine(r)}</div>`).join('') + (I.direct.length > 8 ? `<div class="muted">… et ${I.direct.length - 8} autre(s)</div>` : '') : '<span class="muted">rien</span>'],
        ['Sans réponse, ses appels vont vers', I.ifNo ? esc(destTxt1(I.ifNo)) : '<span class="muted">—</span>'],
        I.blf ? ['Touches BLF de collègues', `${nf(I.blf)} collègue${I.blf > 1 ? 's' : ''} surveille${I.blf > 1 ? 'nt' : ''} ce poste`] : null,
        ['Remplaçants possibles', I.subs.length ? I.subs.map(s => `<div>${dnLink(s.m)} <span class="muted">— ${s.shared.length} élément${s.shared.length > 1 ? 's' : ''} en commun${s.same ? '' : ', autre magasin'}${s.calls >= 1 ? `, ≈ ${nf(Math.round(s.calls))} appels répondus par semaine` : ''}</span></div>`).join('') : '<span class="muted">aucun collègue ne partage ses files ou départements</span>']])}
      ${I.direct.length || I.rows.some(r => r.sev !== 'ok') ? `<p class="muted" style="font-size:12.5px">À prévoir : ${[I.rows.some(r => r.sev === 'bad') ? 'ajouter un remplaçant aux éléments sans personne' : '', I.direct.length ? 'changer le renvoi du poste (profil « Absent » ou renvoi vers un collègue) pour les appels qui le visent directement' : ''].filter(Boolean).join(' ; ')}.</p>` : ''}
    </div>`; };
  const strip = () => { const days = absDays(today, horizon), rows = [...cur, ...next].slice(0, 30); if(!rows.length) return '';
    const critD = new Set(crit.map(c => c.d));
    return `<div class="tw" style="overflow:auto"><table style="font-size:11px;border-collapse:collapse"><thead><tr><th></th>${days.map(d => `<th style="padding:1px 0;min-width:13px;text-align:center;font-weight:400;${critD.has(d) ? 'color:var(--bad)' : ''}" title="${d}">${absWd(d) === 0 ? d.slice(8) : ''}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(a => `<tr><td style="white-space:nowrap;padding-right:8px">${esc(nm(a.ext))}</td>${days.map(d => `<td style="padding:1px 0" title="${d}"><i style="display:block;height:12px;margin:0 1px;border-radius:2px;background:${a.from <= d && a.to >= d ? (critD.has(d) ? 'var(--bad)' : 'var(--acc, #3b82f6)') : absWd(d) > 4 ? 'var(--line)' : 'transparent'}"></i></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px">8 prochaines semaines ; les numéros en tête de colonne sont les lundis ; en rouge, un jour où une file, un département ou un groupe n'a plus personne.</p>`; };
  el.innerHTML = `<div id="abswrap"><h2>Absences et congés</h2>
    <p class="lead">Indiquez les absences prévues (vacances, congés, formation) : pour chacune, les files, départements et groupes de sonnerie où la personne manque, ce qui reste sans personne, les numéros et touches qui sonnent directement chez elle, et qui peut la remplacer${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Les absences restent dans ce navigateur et sont incluses dans la Sauvegarde des réglages.</p>
    <div class="card"><div class="ombar"><label>Employé <select id="absext"><option value="">— choisir —</option>${exts.map(e => `<option value="${esc(e.number)}"${S.ext === e.number ? ' selected' : ''}>${esc(e.number)} ${esc((e.first + ' ' + e.last).trim())}${SEG ? '' : ' · ' + esc(segShort(SEGOF[e.number] || SEG_COMMON))}</option>`).join('')}</select></label>
      <label>Du <input type="date" id="absfrom" value="${esc(S.from)}"></label> <label>au <input type="date" id="absto" value="${esc(S.to)}"></label>
      <label>Note <input id="absnote" value="${esc(S.note)}" placeholder="vacances, formation…" style="width:160px"></label> <button class="btn primary" id="absadd">Ajouter</button></div><div id="absmsg" class="muted" style="font-size:12.5px"></div></div>
    <div class="grid kpis">${[['Absences en cours', nf(cur.length), ''], ['À venir', nf(next.length), ''], ['Jours critiques (8 semaines)', nf(crit.length), crit.length ? 'bad' : 'ok'], ['Absences avec un élément sans personne', nf([...cur, ...next].filter(a => imp[a.id].sev === 'bad').length), [...cur, ...next].some(a => imp[a.id].sev === 'bad') ? 'bad' : 'ok']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${crit.length ? `<h3>Jours critiques</h3><div class="tw"><table><thead><tr><th>Jour</th><th>Sans personne</th><th>Absents</th></tr></thead><tbody>${crit.slice(0, 40).map(c => `<tr><td class="mono">${esc(c.d)} <span class="muted">${ABS_WD[absWd(c.d)]}</span></td><td>${c.empty.map(b => dnLink(b.dn)).join(', ')}</td><td style="font-size:12.5px">${[...c.off].map(n => dnLink(n)).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${strip()}
    <h3>En cours et à venir (${cur.length + next.length})</h3>${[...cur, ...next].map(card).join('') || '<p class="muted">Aucune absence prévue.</p>'}
    ${past.length ? `<details${S.past ? ' open' : ''} id="abspast"><summary><b>Passées (${past.length})</b></summary>${past.slice().reverse().map(card).join('')}</details>` : ''}
    ${shown.length ? '<p><button class="btn" id="absexp">Exporter (CSV)</button> <button class="btn" id="absprint">Imprimer</button></p>' : ''}
    <p class="note">Les personnes connectées aux files sont celles du moment du backup. Les appels habituels sont la moyenne, par jour de semaine, des appels entrants répondus par la personne sur les 8 dernières semaines de l'historique. Les remplaçants proposés partagent le plus de files, départements ou groupes avec elle et ne sont pas absents en même temps.</p></div>`;
  const keep = () => { S.ext = $('#absext').value; S.from = $('#absfrom').value; S.to = $('#absto').value; S.note = $('#absnote').value.trim(); };
  ['#absext', '#absfrom', '#absto', '#absnote'].forEach(id => $(id).addEventListener('change', keep));
  $('#absadd').addEventListener('click', () => { keep(); const msg = $('#absmsg');
    if(!S.ext) return msg.textContent = 'Choisissez un employé.'; if(!S.from || !S.to) return msg.textContent = 'Indiquez les deux dates.'; if(S.to < S.from) return msg.textContent = 'La date de fin est avant la date de début.';
    const l = absLoad(); l.push({id: 'a' + Date.now().toString(36), ext: S.ext, from: S.from, to: S.to, note: S.note}); absSave(l); S.note = ''; V.absences(el); });
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { if(!confirm('Retirer cette absence ?')) return; absSave(absLoad().filter(x => x.id !== b.dataset.del)); V.absences(el); }));
  const pd = $('#abspast'); if(pd) pd.addEventListener('toggle', () => { S.past = pd.open; });
  const ex = $('#absexp'); if(ex) ex.addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Nom', 'Magasin', 'Du', 'Au', 'Jours', 'Note', 'Éléments sans personne', 'Appels habituels sur la période', 'Remplaçants possibles']].concat(shown.map(a => { const I = imp[a.id];
      return [a.ext, dnName(a.ext), segShort(SEGOF[a.ext] || SEG_COMMON), a.from, a.to, I.days.length, a.note, I.rows.filter(r => r.sev === 'bad').map(r => nm(r.b.dn)).join(' | '), Math.round(I.calls), I.subs.map(s => nm(s.m)).join(' | ')]; }));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'absences.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  const pr = $('#absprint'); if(pr) pr.addEventListener('click', () => printHTML(`<h2>Absences et congés</h2>${[...cur, ...next].map(card).join('')}`, p => p.querySelectorAll('button').forEach(b => b.remove())));
};
