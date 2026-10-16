// ---------- Statistiques par magasin et par période ----------
const ST_PAL = ['#2563eb', '#0d9488', '#d97706', '#db2777', '#7c3aed', '#65a30d', '#dc2626', '#0891b2', '#9333ea', '#ca8a04'];
const WD = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
// heure locale (Est) rapide : décalage calculé une fois par heure UTC puis mis en cache -> [jour 'AAAA-MM-JJ', heure, jour de semaine 0=lundi]
const _tzOff = {};
function localParts(iso){
  const k = iso.slice(0, 13); let o = _tzOff[k];
  if(o === undefined){ const d = new Date(k + ':00:00Z'); o = _tzOff[k] = Date.parse(d.toLocaleString('sv-SE', {timeZone: TZ}).replace(' ', 'T') + 'Z') - d.getTime(); }
  const t = new Date(Date.parse(iso) + o); return [t.toISOString().slice(0, 10), t.getUTCHours(), (t.getUTCDay() + 6) % 7];
}
// magasin d'un appel (un seul, pour comparer sans double compte) : SDA pour les entrants, poste d'origine sinon
const callSeg = c => {
  if(c[1] === 'in'){ const s = DIDSEG[c[5]]; if(s && s !== SEG_COMMON) return s; const p = c[9].find(x => SEGOF[x[0]] && SEGOF[x[0]] !== SEG_COMMON); return p ? SEGOF[p[0]] : (s || SEG_COMMON); }
  return SEGOF[c[2]] || SEGOF[c[6]] || SEG_COMMON;
};
const ST_ANS = new Set(['ans', 'fwd_ok']), ST_LOST = new Set(['q_ab', 'ivr_ab', 'miss', 'fwd_no', 'park_ab']);
const STATS_KEY = 'stats3cx-periode';
function statsPeriod(){ let p = {}; try{ p = JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); }catch(e){} let f = p.from || '', t = p.to || ''; if(f && t && f > t) [f, t] = [t, f]; return {mode: p.mode || '30', from: f, to: t}; } // 18.1.32 : dates remises dans l'ordre

V.stats = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Statistiques</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const meta = all.map(c => localParts(c[0])), qmeta = FULL.queueCalls.map(r => localParts(r[0]));
  const lastDay = meta[0][0], firstDay = meta[meta.length - 1][0];
  const P = statsPeriod();
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDays(lastDay, -(+P.mode) + 1), lastDay];
  el.innerHTML = `<div id="swrap"><h2>Statistiques par magasin</h2>
  <p class="lead">Comparaison des magasins sur une période : taux de réponse, appels perdus, attente en file et heures de pointe. Chaque appel est attribué à un seul magasin : celui du SDA appelé pour les appels entrants, celui du poste d'origine sinon. Historique disponible du ${firstDay} au ${lastDay}.</p>
  <div class="bar"><label class="count">Période</label>
    <select id="spm">${[['7','7 derniers jours'],['30','30 derniers jours'],['90','90 derniers jours'],['all','Tout l\'historique'],['custom','Dates au choix']].map(([v,l]) => `<option value="${v}"${P.mode===v?' selected':''}>${l}</option>`).join('')}</select>
    <span id="spc" ${P.mode==='custom'?'':'hidden'}><input type="date" id="spf" value="${esc(P.from)}" min="${firstDay}" max="${lastDay}"> → <input type="date" id="spt" value="${esc(P.to)}" min="${firstDay}" max="${lastDay}"></span>
    <span class="count" id="sprange"></span><span style="flex:1"></span><button class="btn" id="sexp">Exporter (CSV)</button></div>
  <div id="sbody"></div></div>`;
  const W = $('#swrap');
  const save = () => { try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(e){} };
  let lastRows = [];
  function draw(){
    const [from, to] = range();
    $('#sprange').textContent = `du ${from} au ${to}`;
    const idx = []; meta.forEach((m, i) => { if(m[0] >= from && m[0] <= to) idx.push(i); });
    const qc = FULL.queueCalls.filter((r, i) => qmeta[i][0] >= from && qmeta[i][0] <= to);
    const segs = SEG_LIST.filter(s => s !== SEG_BRIDGE);
    const by = {}; segs.concat([SEG_BRIDGE]).forEach(s => by[s] = {s, inc: 0, ans: 0, fwd: 0, lost: 0, vm: 0, bridge: 0, out: 0, int: 0, hours: Array(24).fill(0), heat: Array.from({length: 7}, () => Array(24).fill(0)), days: {}, qn: 0, qw: 0, qs: 0, qab: 0, talk: 0});
    const inCalls = []; // [indice de l'appel, magasin, jour de semaine, heure] pour la carte de chaleur
    idx.forEach(i => {
      const c = all[i], m = meta[i], s = callSeg(c), b = by[s] || by[SEG_COMMON];
      if(c[1] === 'in'){
        b.inc++; const st = c[10]; inCalls.push([i, b.s, m[2], m[1]]);
        if(st === 'ans') b.ans++; else if(st === 'fwd_ok') b.fwd++; else if(st === 'vm') b.vm++; else if(st === 'bridge') b.bridge++; else if(ST_LOST.has(st)) b.lost++;
        if(ST_ANS.has(st)) b.talk += c[8];
        b.hours[m[1]]++; b.heat[m[2]][m[1]]++; b.days[m[0]] = (b.days[m[0]] || 0) + 1;
      } else if(c[1] === 'out') b.out++; else b.int++;
    });
    qc.forEach(r => { const b = by[SEGOF[r[1]]] || by[SEG_COMMON]; b.qn++; if(r[6]){ b.qs++; b.qw += r[4]; } else b.qab++; });
    const rows = Object.values(by).filter(b => b.inc || b.out || b.int).map(b => {
      const base = b.inc - b.bridge, peak = b.hours.indexOf(Math.max(...b.hours));
      return {...b, base, rate: base ? (b.ans + b.fwd) / base : null, lostRate: base ? b.lost / base : null, wait: b.qs ? b.qw / b.qs : null, peak: b.inc ? peak : null, avgTalk: (b.ans + b.fwd) ? b.talk / (b.ans + b.fwd) : null};
    }).sort((a, b) => b.inc - a.inc);
    lastRows = rows;
    const tot = rows.reduce((t, r) => { ['inc','ans','fwd','lost','vm','bridge','out','int','qn','qs','qw','base'].forEach(k => t[k] += r[k]); r.hours.forEach((v, i) => t.hours[i] += v); return t; },
      {inc:0, ans:0, fwd:0, lost:0, vm:0, bridge:0, out:0, int:0, qn:0, qs:0, qw:0, base:0, hours: Array(24).fill(0)});
    const pc = v => v == null ? '–' : Math.round(v * 100) + ' %';
    const rateCls = v => v == null ? '' : v >= 0.85 ? 'ok' : v >= 0.7 ? 'warn' : 'bad';
    const shown = rows.filter(r => r.s !== SEG_BRIDGE && r.base > 0);
    const maxBase = Math.max(1, ...shown.map(r => r.base));
    const colorOf = {}; rows.forEach((r, i) => colorOf[r.s] = ST_PAL[i % ST_PAL.length]);
    // carte des heures de pointe : magasin choisi ou tous
    const heatSel = W.dataset.heat || '', heatQ = W.dataset.hq || '', heatM = W.dataset.hm || 'inc';
    const cells = Array.from({length: 7}, () => Array.from({length: 24}, () => ({n: 0, lost: 0, base: 0, ids: []})));
    const qSeen = new Set();
    inCalls.forEach(([i, s, d, h]) => { if(heatSel && s !== heatSel) return; const c = all[i]; c[9].forEach(p => { if(p[1] === 'queue') qSeen.add(p[0]); });
      if(heatQ && !c[9].some(p => p[0] === heatQ && p[1] === 'queue')) return;
      const x = cells[d][h]; x.n++; x.ids.push(i); if(c[10] !== 'bridge'){ x.base++; if(ST_LOST.has(c[10])) x.lost++; } });
    // taux de perte : seulement à partir de 5 appels dans le créneau (sinon trop peu pour conclure)
    const hval = x => heatM === 'lost' ? x.lost : heatM === 'rate' ? (x.base >= 5 ? x.lost / x.base : null) : x.n;
    const heat = cells.map(row => row.map(hval));
    const hmax = Math.max(heatM === 'rate' ? 0.01 : 1, ...heat.flat().filter(v => v != null));
    const hfmt = v => v == null ? '–' : heatM === 'rate' ? Math.round(v * 100) + ' %' : nf(v);
    const htip = (d, h) => { const x = cells[d][h]; return `${WD[d]} ${h} h : ${x.n} appel${x.n > 1 ? 's' : ''} entrant${x.n > 1 ? 's' : ''}, ${x.lost} perdu${x.lost > 1 ? 's' : ''}${x.base ? ` (${Math.round(100 * x.lost / x.base)} %)` : ''}`; };
    const worst = cells.flatMap((row, d) => row.map((x, h) => ({d, h, v: hval(x)}))).filter(x => x.v).sort((a, b) => b.v - a.v).slice(0, 6);
    const qList = FULL.queues.filter(q => qSeen.has(q.number) || q.number === heatQ).sort((a, b) => a.number < b.number ? -1 : 1);
    // évolution quotidienne (5 magasins principaux)
    const top = shown.slice(0, 5), dayList = []; for(let d = from; d <= to; d = addDays(d, 1)){ dayList.push(d); if(dayList.length > 400) break; }
    const dmax = Math.max(1, ...top.flatMap(r => dayList.map(d => r.days[d] || 0)));
    const LW = 900, LH = 200, LP = 34;
    const line = r => dayList.map((d, i) => `${LP + i * (LW - LP) / Math.max(1, dayList.length - 1)},${LH - (LH - 12) * (r.days[d] || 0) / dmax}`).join(' ');
    $('#sbody').innerHTML = `
    <div class="grid kpis">${[['Appels entrants', nf(tot.inc)], ['Taux de réponse*', objPill(SEG, 'rate', tot.base ? 100 * (tot.ans + tot.fwd) / tot.base : null, pc(tot.base ? (tot.ans + tot.fwd) / tot.base : null))], ['Appels perdus', nf(tot.lost) + ' · ' + pc(tot.base ? tot.lost / tot.base : null)], ['Attente moy. en file', tot.qs ? dur(Math.round(tot.qw / tot.qs)) : '–'], ['Heure de pointe', tot.inc ? tot.hours.indexOf(Math.max(...tot.hours)) + ' h' : '–'], ['Appels sortants', nf(tot.out)]]
      .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <p class="note">* Répondus localement ou par renvoi externe, sur les appels entrants hors transferts vers un autre 3CX (bridge). Perdus = abandon en file, raccroché au menu, renvoi externe sans réponse, non répondu, raccroché en parking.</p>
    <h3>Comparaison des magasins</h3>
    <div class="tw"><table class="stbl"><thead><tr><th>Magasin</th><th class="num">Entrants</th><th class="num">Répondus</th><th class="num">Taux de réponse</th><th class="num">Perdus</th><th class="num">% perdus</th><th class="num">Messagerie</th><th class="num">Vers bridge</th><th class="num">Attente moy. file</th><th class="num">Abandons file</th><th class="num">Conversation moy.</th><th class="num">Heure de pointe</th><th class="num">Sortants</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r.s === SEG ? 'cur' : ''}"><td><span class="sw" style="background:${colorOf[r.s]}"></span><b>${esc(segShort(r.s))}</b>${r.s[0] !== '@' && SEGCFG.names[r.s] ? ` <span class="muted mono">${esc(r.s)}</span>` : ''}</td>
      <td class="num">${nf(r.inc)}</td><td class="num">${nf(r.ans + r.fwd)}</td><td class="num">${objPill(r.s, 'rate', r.rate == null ? null : r.rate * 100, pc(r.rate))}</td>
      <td class="num">${nf(r.lost)}</td><td class="num">${objPill(r.s, 'lostRate', r.lostRate == null ? null : r.lostRate * 100, pc(r.lostRate))}</td><td class="num">${nf(r.vm)}</td><td class="num">${nf(r.bridge)}</td>
      <td class="num">${r.wait == null ? '–' : objPill(r.s, 'wait', r.wait, dur(Math.round(r.wait)))}</td><td class="num">${r.qn ? pct(r.qab, r.qn) : '–'}</td><td class="num">${r.avgTalk == null ? '–' : dur(Math.round(r.avgTalk))}</td>
      <td class="num">${r.peak == null ? '–' : r.peak + ' h'}</td><td class="num">${nf(r.out)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Répondus et perdus par magasin</h3>
        ${shown.map(r => `<div class="stbar"><span class="nm">${esc(segShort(r.s))}</span><span class="t" title="${nf(r.ans + r.fwd)} répondus, ${nf(r.vm)} messagerie, ${nf(r.lost)} perdus sur ${nf(r.base)}">
          <span style="width:${100 * (r.ans + r.fwd) / maxBase}%;background:var(--c-in)"></span><span style="width:${100 * r.vm / maxBase}%;background:var(--warn)"></span><span style="width:${100 * r.lost / maxBase}%;background:var(--bad)"></span></span><span class="num">${pc(r.rate)}</span></div>`).join('') || '<p class="muted">Aucun appel entrant sur la période.</p>'}
        <div class="legend"><span><i style="background:var(--c-in)"></i>Répondus</span><span><i style="background:var(--warn)"></i>Messagerie</span><span><i style="background:var(--bad)"></i>Perdus</span></div></div>
      <div class="card"><h3 style="margin-top:0">Carte de chaleur : jour × heure</h3>
        <div class="hbar"><select id="shm" aria-label="Mesure">${[['inc', 'Appels entrants'], ['lost', 'Appels perdus'], ['rate', 'Taux de perte']].map(([v, l]) => `<option value="${v}"${heatM === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <select id="sheat" aria-label="Magasin"><option value="">Tous les magasins</option>${shown.map(r => `<option value="${esc(r.s)}"${heatSel===r.s?' selected':''}>${esc(segShort(r.s))}</option>`).join('')}</select>
        <select id="shq" aria-label="File d'attente"><option value="">Toutes les files</option>${qList.map(q => `<option value="${esc(q.number)}"${heatQ === q.number ? ' selected' : ''}>${esc(q.number + ' ' + q.name)}</option>`).join('')}</select></div>
        <div class="heat" id="sheatg"><span></span>${Array.from({length: 24}, (_, h) => `<span class="hh">${h % 3 === 0 ? h : ''}</span>`).join('')}
        ${heat.map((row, d) => `<span class="hd">${WD[d]}</span>` + row.map((v, h) => `<span class="hc${heatM === 'inc' ? '' : ' bad'}" data-d="${d}" data-h="${h}" style="opacity:${v ? 0.12 + 0.88 * v / hmax : 0.04}" title="${esc(htip(d, h))}"></span>`).join('')).join('')}</div>
        <div class="hleg"><span>0</span><i class="${heatM === 'inc' ? '' : 'bad'}"></i><span>${hfmt(hmax)}</span></div>
        ${worst.length ? `<div class="hworst"><span class="muted">${heatM === 'inc' ? 'Créneaux les plus chargés' : heatM === 'lost' ? 'Créneaux avec le plus d\'appels perdus' : 'Créneaux avec le plus fort taux de perte'} :</span> ${worst.map(x => `<button class="pill${heatM === 'inc' ? '' : ' bad'}" data-d="${x.d}" data-h="${x.h}">${WD[x.d]} ${x.h} h · ${hfmt(x.v)}</button>`).join('')}</div>` : ''}
        <p class="note">${heatM === 'inc' ? "Plus la case est foncée, plus il y a d'appels entrants" : heatM === 'lost' ? "Plus la case est foncée, plus il y a d'appels perdus (abandon en file, raccroché au menu, non répondu, renvoi sans réponse, raccroché en parking)" : "Plus la case est foncée, plus la part d'appels perdus est forte (calculée à partir de 5 appels dans le créneau)"} — heure de l'Est. Cliquez sur une case pour voir ses appels.</p></div>
    </div>
    <div class="card chart" style="margin-top:14px"><h3 style="margin-top:0">Appels entrants par jour — ${top.length} magasins principaux</h3>
      ${dayList.length > 1 ? `<svg viewBox="0 0 ${LW} ${LH + 22}" role="img" aria-label="Évolution quotidienne">
        ${[0, .5, 1].map(f => `<line x1="${LP}" x2="${LW}" y1="${LH - (LH - 12) * f}" y2="${LH - (LH - 12) * f}" stroke="var(--line)"/><text class="ax" x="${LP - 4}" y="${LH - (LH - 12) * f + 3}" text-anchor="end">${Math.round(dmax * f)}</text>`).join('')}
        ${dayList.map((d, i) => i % Math.ceil(dayList.length / 10) === 0 ? `<text class="ax" x="${LP + i * (LW - LP) / Math.max(1, dayList.length - 1)}" y="${LH + 16}" text-anchor="middle">${d.slice(5)}</text>` : '').join('')}
        ${top.map(r => `<polyline points="${line(r)}" fill="none" stroke="${colorOf[r.s]}" stroke-width="2"><title>${esc(segShort(r.s))}</title></polyline>`).join('')}</svg>
        <div class="legend">${top.map(r => `<span><i style="background:${colorOf[r.s]}"></i>${esc(segShort(r.s))}</span>`).join('')}</div>` : '<p class="muted">Choisissez une période d\'au moins deux jours.</p>'}</div>`;
    const hs = $('#sheat'); if(hs) hs.addEventListener('change', () => { W.dataset.heat = hs.value; draw(); });
    $('#shq').addEventListener('change', e => { W.dataset.hq = e.target.value; draw(); });
    $('#shm').addEventListener('change', e => { W.dataset.hm = e.target.value; draw(); });
    const HST = {ans: 'Répondu', fwd_ok: 'Renvoyé ext. (répondu)', vm: 'Messagerie', bridge: 'Vers autre 3CX (bridge)'};
    const openCell = (d, h) => { const x = cells[d][h], ids = x.ids.slice().sort((a, b) => all[a][0] < all[b][0] ? 1 : -1);
      openDrawer(`${WD[d]} ${h} h — ${nf(x.n)} appel${x.n > 1 ? 's' : ''} entrant${x.n > 1 ? 's' : ''}`, kv([['Période', `du ${esc(from)} au ${esc(to)}`], ['Magasin', esc(heatSel ? segShort(heatSel) : 'Tous les magasins')], ['File d\'attente', esc(heatQ ? heatQ + ' ' + (FULL.queues.find(q => q.number === heatQ) || {}).name : 'Toutes les files')],
        ['Appels perdus', `${nf(x.lost)}${x.base ? ` (${Math.round(100 * x.lost / x.base)} %)` : ''}`]]) +
        `<div class="tw"><table><thead><tr><th>Date</th><th>SDA appelé</th><th>Appelant</th><th>Issue</th><th class="num">Durée</th></tr></thead><tbody>${ids.slice(0, 300).map(i => { const c = all[i];
          return `<tr style="white-space:nowrap"><td>${esc(fmtD(c[0]))}</td><td class="mono">${esc(phone(c[5]) || c[5] || '')}</td><td class="mono">${esc(phone(c[2]) || c[2] || '')}</td><td>${ST_LOST.has(c[10]) ? `<span class="pill bad">${esc(LOST_WHERE[c[10]] || c[10])}</span>` : esc(HST[c[10]] || c[10])}</td><td class="num">${dur(c[7])}</td></tr>`; }).join('')}</tbody></table></div>${ids.length > 300 ? `<p class="muted">Les 300 plus récents sur ${nf(ids.length)}.</p>` : ''}`); };
    $('#sbody').querySelectorAll('#sheatg .hc[data-d], .hworst [data-d]').forEach(b => b.addEventListener('click', () => openCell(+b.dataset.d, +b.dataset.h)));
  }
  $('#spm').addEventListener('change', e => { P.mode = e.target.value; $('#spc').hidden = P.mode !== 'custom'; if(P.mode === 'custom'){ P.from ||= firstDay; P.to ||= lastDay; $('#spf').value = P.from; $('#spt').value = P.to; } save(); draw(); });
  $('#spf').addEventListener('change', e => { P.from = e.target.value; save(); draw(); });
  $('#spt').addEventListener('change', e => { P.to = e.target.value; save(); draw(); });
  $('#sexp').addEventListener('click', () => {
    const [from, to] = range(), q = v => '"' + csvSafe(v) + '"', r2 = v => v == null ? '' : Math.round(v * 1000) / 10;
    const out = [['Magasin', 'Code', 'Du', 'Au', 'Entrants', 'Répondus', 'Taux de réponse (%)', 'Perdus', '% perdus', 'Messagerie', 'Vers bridge', 'Attente moy. file (s)', 'Appels en file', 'Abandons file', 'Conversation moy. (s)', 'Heure de pointe', 'Sortants', 'Internes']]
      .concat(lastRows.map(r => [segShort(r.s), r.s, from, to, r.inc, r.ans + r.fwd, r2(r.rate), r.lost, r2(r.lostRate), r.vm, r.bridge, r.wait == null ? '' : Math.round(r.wait), r.qn, r.qab, r.avgTalk == null ? '' : Math.round(r.avgTalk), r.peak == null ? '' : r.peak, r.out, r.int]));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = `statistiques-magasins-${from}_${to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  draw();
};

