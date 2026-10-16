// ---------- Rapport de département (17.4) : toutes les statistiques des appels qui passent par un département, sur une page imprimable ----------
const DPR_KEY = 'deptrap3cx';
let DPR_IDX = null;
// appels entrants passés par chaque département (index calculé une fois) : numéro du département -> [[appel, position dans le parcours]]
function dprIndex(){
  if(DPR_IDX) return DPR_IDX;
  const by = {};
  FULL.calls.forEach(c => { if(c[1] !== 'in' || c[10] === 'bridge') return; const seen = new Set();
    c[9].forEach((p, k) => { if(p[1] === 'group' && !seen.has(p[0])){ seen.add(p[0]); (by[p[0]] ||= []).push([c, k]); } }); });
  return DPR_IDX = by;
}
V.deptrap = (el, arg) => {
  const S = window.__dpr ||= (() => { try{ return JSON.parse(localStorage.getItem(DPR_KEY) || '{}'); }catch(e){ return {}; } })();
  if(arg){ const [x, p] = decodeURIComponent(arg).split('~'); S.g = x; if(p) S.p = p; history.replaceState(null, '', '#deptrap'); }
  const en = document.documentElement.lang === 'en', T = (fr, e) => en ? e : fr, loc = en ? 'en-CA' : 'fr-CA';
  const WDN = en ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const MOM = en ? [['Morning', '(before noon)'], ['Afternoon', '(noon to 5 pm)'], ['Evening', '(after 5 pm)']] : [['Matin', '(avant midi)'], ['Après-midi', '(12 h à 17 h)'], ['Soir', '(après 17 h)']];
  const BRL = {office: T("Heures d'ouverture", 'Office hours'), outOfOffice: T('Hors heures (fermé)', 'Out of hours (closed)'), break: T('Pause', 'Break'), holidays: T('Jours fériés', 'Holidays')};
  const title = T('Rapport de département', 'Department report');
  const IDX = dprIndex(), all = FULL.calls;
  const gs = FULL.groups.filter(g => !isSysGroup(g) && (!SEG || SEGOF[g.number] === SEG) && (IDX[g.number] || []).length).sort((a, b) => IDX[b.number].length - IDX[a.number].length);
  if(!gs.length){ el.innerHTML = `<h2>${title}</h2><p class="muted">${T('Aucun appel entrant passé par un département', 'No inbound call went through a department')}${SEG ? T(' dans ce magasin', ' in this store') : ''}.</p>`; return; }
  if(!gs.some(g => g.number === S.g)) S.g = gs[0].number;
  const g = gs.find(x => x.number === S.g), IX = IDX[g.number];
  const first = localParts(all[all.length - 1][0])[0], last = localParts(all[0][0])[0];
  S.p ||= '90'; const [from, to] = perRange(S.p, first, last), days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  const save = () => { try{ localStorage.setItem(DPR_KEY, JSON.stringify({g: S.g, p: S.p})); }catch(e){} V.deptrap(el); };
  const pc = (a, b) => b ? Math.round(100 * a / b) + (en ? '%' : ' %') : '–', pn = (a, b) => b ? Math.round(100 * a / b) : 0, hh = h => en ? (h % 12 || 12) + (h < 12 ? ' am' : ' pm') : h + ' h';
  const dS = d => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, {day: 'numeric', month: 'short', timeZone: 'UTC'});
  const dL = d => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
  const sur = (l, n) => `${nf(l)} ${T('sur', 'of')} ${nf(n)}`, lbl = x => `<span>${esc(x)}</span>`, med = a => { if(!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const head = `<div class="noprint"><h2>${title}</h2>
    <p class="lead">${T("Toutes les statistiques des appels qui passent par un département, sur une page imprimable : volume, appels répondus et perdus, heures d'ouverture et hors heures, moments de la semaine, parcours des appels, employés qui répondent, clients, appels sortants et ce qu'il faut corriger", 'All the statistics of the calls that go through a department, on a printable page: volume, answered and lost calls, office hours and out of hours, times of the week, call routes, employees who answer, callers, outbound calls and what to fix')}${SEG ? ` — ${T('magasin', 'store')} <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">${T('Département', 'Department')}</label><select id="dprsel">${gs.map(x => `<option value="${esc(x.number)}"${x.number === g.number ? ' selected' : ''}>${esc(x.name)} (${esc(x.number)})${SEG ? '' : ' · ' + esc(segShort(SEGOF[x.number] || SEG_COMMON))} · ${nf(IDX[x.number].length)}</option>`).join('')}</select>
      <label class="count">${T('Période', 'Period')}</label>${perUI('dprp', S.p, first, last)}<span style="flex:1"></span><button class="btn" id="dprprint">${T('Imprimer / PDF', 'Print / PDF')}</button><button class="btn" id="dprxl">${T('Exporter en Excel', 'Export to Excel')}</button></div></div>`;
  // ---- appels du département, avec la branche horaire prise (même logique que l'onglet Horaires) ----
  const sch = deptSchedule(g), br = {};
  ['office', 'outOfOffice', 'break', 'holidays'].forEach(k => { const r = g.routes && g.routes[k]; const d = r && r.to !== 'None' ? r.dn || ('ext:' + r.ext) : null; if(d) (br[d] ||= []).push(k); });
  const mk = ([c, k]) => { const [d, min, wd] = localFull(c[0]), nx = c[9][k + 1], poss = nx ? br[nx[0]] : null, exp = sch.expected(d, min, wd);
    return {c, k, d, h: Math.floor(min / 60), min, wd, br: poss ? (poss.includes(exp) ? exp : poss[0]) : exp, st: ST_ANS.has(c[10]) ? 'ans' : c[10] === 'vm' ? 'vm' : ST_LOST.has(c[10]) ? 'lost' : 'other'}; };
  const pLen = days, pFrom = addDaysISO(from, -pLen), pTo = addDaysISO(from, -1);
  const R = [], P0 = []; IX.forEach(x => { const d = localParts(x[0][0])[0]; if(d >= from && d <= to) R.push(mk(x)); else if(d >= pFrom && d <= pTo && pFrom >= first) P0.push(mk(x)); });
  R.sort((a, b) => a.c[0] < b.c[0] ? -1 : 1);
  const wire = () => { $('#dprsel').addEventListener('change', e => { S.g = e.target.value; save(); }); perWire('dprp', S.p, first, last, v => { S.p = v; save(); }); };
  if(!R.length){ el.innerHTML = `<div id="dprwrap">${head}<div class="card">${T(`Aucun appel entrant passé par ce département du ${esc(dL(from))} au ${esc(dL(to))}.`, `No inbound call went through this department from ${esc(dL(from))} to ${esc(dL(to))}.`)}</div></div>`; wire(); $('#dprprint').disabled = $('#dprxl').disabled = true; return; }
  const K = L => { const n = L.length, a = L.filter(r => r.st === 'ans'), cli = new Set(L.map(r => normNum(r.c[2])).filter(Boolean));
    return {n, ans: a.length, vm: L.filter(r => r.st === 'vm').length, lost: L.filter(r => r.st === 'lost').length, cli: cli.size, pick: med(a.map(r => r.c[12]).filter(v => v != null)), talk: a.length ? Math.round(a.reduce((s, r) => s + (r.c[8] || 0), 0) / a.length) : 0}; };
  const k0 = K(R), kp = P0.length >= 20 ? K(P0) : null;
  const sub = T(`du ${esc(dL(from))} au ${esc(dL(to))}`, `from ${esc(dL(from))} to ${esc(dL(to))}`);
  // ---- 2. heures d'ouverture et hors heures ----
  const BRK = ['office', 'outOfOffice', 'break', 'holidays'].map(k => ({k, ...K(R.filter(r => r.br === k))})).filter(b => b.n);
  const closed = R.filter(r => r.br !== 'office');
  let HR = null; try{ HR = hoursAnalysis(from, to).find(x => x.g.number === g.number) || null; }catch(e){}
  let adj = []; try{ if(HR) adj = hoursAdjust(HR).sort((a, b) => b.perW - a.perW); }catch(e){}
  const cH = Array(24).fill(0); closed.forEach(r => cH[r.h]++);
  const cWd = Array(7).fill(0); closed.forEach(r => cWd[r.wd]++);
  // ---- 3. moments ----
  const grp = key => { const o = {}; R.forEach(r => { const k = key(r), b = o[k] ||= {k, n: 0, l: 0}; b.n++; if(r.st === 'lost') b.l++; }); return Object.values(o).sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0); };
  const months = grp(r => r.d.slice(0, 7)), weeks = grp(r => addDaysISO(r.d, -r.wd)), dayRows = grp(r => r.d);
  const byWd = Array.from({length: 7}, () => ({n: 0, l: 0})), byH = Array.from({length: 24}, () => ({n: 0, l: 0}));
  R.forEach(r => { byWd[r.wd].n++; byH[r.h].n++; if(r.st === 'lost'){ byWd[r.wd].l++; byH[r.h].l++; } });
  const wds = [0, 1, 2, 3, 4, 5, 6].filter(i => byWd[i].n);
  const hk = byH.map((x, h) => x.n >= Math.max(1, R.length * .01) ? h : -1).filter(h => h >= 0), h0 = Math.min(...hk), h1 = Math.max(...hk), clampH = h => Math.min(h1, Math.max(h0, h));
  const hrs = []; for(let h = h0; h <= h1; h++) hrs.push(h);
  const grid = Array.from({length: 7}, () => hrs.map(() => ({n: 0, l: 0}))); R.forEach(r => { const c = grid[r.wd][clampH(r.h) - h0]; c.n++; if(r.st === 'lost') c.l++; });
  const hByH = hrs.map(h => R.filter(r => clampH(r.h) === h)).map(a => ({n: a.length, l: a.filter(r => r.st === 'lost').length}));
  const mxL = Math.max(1, ...grid.flat().map(c => c.l)), mxN = Math.max(1, ...grid.flat().map(c => c.n)), anyLost = k0.lost > 0;
  const worst = []; wds.forEach(w => hrs.forEach((h, j) => { const c = grid[w][j]; if(c.l && c.n >= 3) worst.push({w, h, ...c}); })); worst.sort((a, b) => b.l - a.l || b.l / b.n - a.l / a.n);
  const mom = Array.from({length: 7}, () => [0, 1, 2].map(() => ({n: 0, l: 0}))); R.forEach(r => { const c = mom[r.wd][r.h < 12 ? 0 : r.h < 17 ? 1 : 2]; c.n++; if(r.st === 'lost') c.l++; });
  const dK = {}; R.forEach(r => { const x = dK[r.d] ||= {ans: 0, vm: 0, lost: 0, n: 0}; x.n++; if(r.st === 'ans') x.ans++; else if(r.st === 'vm') x.vm++; else if(r.st === 'lost') x.lost++; });
  // ---- 4. parcours : SDA, menus vocaux, files, point de perte ----
  const sda = {}; R.forEach(r => { const d = r.c[5] || '—', x = sda[d] ||= {d, n: 0, l: 0}; x.n++; if(r.st === 'lost') x.l++; });
  const ivrBy = Object.fromEntries((FULL.ivrs || []).map(i => { /* 18.2.25 : tous les menus, y compris communs */ const keysOf = {}; i.options.forEach(o => { const k = o.dn || ('ext:' + o.data) || o.type; (keysOf[k] ||= []).push(o.key); }); return [i.number, {i, keysOf}]; }));
  const IVR = {};
  R.forEach(r => { const p = r.c[9]; for(let j = r.k + 1; j < p.length; j++){ const x = p[j]; if(x[1] !== 'ivr' || !ivrBy[x[0]]) continue; const I = IVR[x[0]] ||= {dn: x[0], n: 0, hang: 0, ch: {}}; I.n++;
    const nx = p[j + 1]; if(!nx){ if(r.st === 'lost') I.hang++; continue; }
    const keys = ivrBy[x[0]].keysOf[nx[0]], key = keys ? keys.join(', ') : nx[0] === ivrBy[x[0]].i.timeoutDN ? T('sans choix', 'no choice') : T('autre', 'other'), cx = I.ch[key + '|' + nx[0]] ||= {key, dest: nx[0], n: 0, ans: 0, lost: 0}; cx.n++; if(r.st === 'ans') cx.ans++; else if(r.st === 'lost') cx.lost++; } });
  const QS = {}; R.forEach(r => { const p = r.c[9]; new Set(p.slice(r.k + 1).filter(x => x[1] === 'queue').map(x => x[0])).forEach(q => { const x = QS[q] ||= {q, n: 0, ans: 0, ab: 0}; x.n++; if(r.st === 'ans') x.ans++; if(r.c[10] === 'q_ab' && p[p.length - 1][0] === q) x.ab++; }); });
  Object.values(QS).forEach(x => { const w = FULL.queueCalls.filter(z => z[1] === x.q && z[6] && localParts(z[0])[0] >= from && localParts(z[0])[0] <= to).map(z => +z[4] || 0); x.wait = med(w); });
  const LOSS = {}; R.filter(r => r.st === 'lost').forEach(r => { const p = r.c[9], z = p[p.length - 1], k = z ? z[0] : '—', x = LOSS[k] ||= {dn: k, n: 0, why: {}}; x.n++; x.why[r.c[10]] = (x.why[r.c[10]] || 0) + 1; });
  // ---- 5. qui répond ----
  const mem = new Set((g.members || []).map(m => m.dn).filter(n => EXT_BY[n])), WHO = {};
  const W = n => WHO[n] ||= {n, ans: 0, talk: 0, pick: [], rings: 0, ringMiss: 0};
  R.forEach(r => { const c = r.c, by = Array.isArray(c[11]) ? c[11].filter(([x]) => EXT_BY[x]) : [];
    if(by.length) by.forEach(([x, t]) => { const w = W(x); w.ans++; w.talk += t || 0; }); else if(r.st === 'ans' && EXT_BY[c[6]]){ const w = W(c[6]); w.ans++; w.talk += c[8] || 0; }
    if(c[13] && EXT_BY[c[13]] && c[12] != null) W(c[13]).pick.push(c[12]);
    (Array.isArray(c[14]) ? c[14] : []).forEach(s => { if(s[1] === 'extension' && EXT_BY[s[0]]){ const w = W(s[0]); w.rings++; if(s[4] < 0 && s[5] !== 'cancelled') w.ringMiss++; } }); }); // 18.2.26 : comme la Fiche employé
  const who = Object.values(WHO).filter(w => w.ans || w.rings).sort((a, b) => b.ans - a.ans || b.rings - a.rings), ansTot = who.reduce((s, w) => s + w.ans, 0);
  let pk = {}; try{ attRows().forEach(x => { if(WHO[x.ext] && x.d >= from && x.d <= to){ const p = pk[x.ext] ||= {n: 0, l: 0}; p.n++; if(x.lost) p.l++; } }); }catch(e){}
  let indisp = []; try{ indisp = indispAnalysis().people.filter(p => mem.has(p.a) || WHO[p.a]); }catch(e){}
  let abs = []; try{ abs = absLoad().filter(a => (mem.has(a.ext) || WHO[a.ext]) && a.to >= from && a.from <= to); }catch(e){}
  // ---- 6. clients ----
  const inDept = new Set(R.map(r => r.c));
  // comme l'onglet Clients qui rappellent : appelants très fréquents (plus d'un appel servi tous les 2 jours, et au moins 10) exclus
  let rep = null; try{ const A0 = repAnalysis(from, to, 48).served.filter(x => inDept.has(x.c)), cK = {}; A0.forEach(x => cK[x.k] = (cK[x.k] || 0) + 1);
    const lim = Math.max(10, days / 2), A = A0.filter(x => cK[x.k] <= lim); rep = {n: A.length, r: A.filter(x => x.slow).length, fx: Object.values(cK).filter(v => v > lim).length}; }catch(e){}
  let miss = []; try{ miss = missedAnalysis(from, to).filter(m => m.lost.some(i => inDept.has(all[i]))); }catch(e){}
  const mTodo = miss.filter(m => m.st === 'todo'), mBack = miss.filter(m => m.st === 'back'), mSelf = miss.filter(m => m.st === 'self'), mDelay = med(mBack.map(m => m.delay).filter(v => v != null));
  const CLI = {}; R.forEach(r => { const k = normNum(r.c[2]); if(!k) return; const x = CLI[k] ||= {k, raw: r.c[2], name: '', n: 0, l: 0, last: ''}; x.n++; if(r.st === 'lost') x.l++; if(r.c[3] && normNum(r.c[3]) !== k) x.name = r.c[3]; if(r.c[0] > x.last) x.last = r.c[0]; });
  const topCli = Object.values(CLI).sort((a, b) => b.n - a.n).slice(0, 10);
  let vip = []; try{ const V0 = vipLoad(), byNum = {}; V0.contacts.forEach(ct => ct.nums.forEach(n => byNum[n] = ct)); const m = {};
    R.forEach(r => { const ct = byNum[normNum(r.c[2])]; if(!ct) return; const x = m[ct.id] ||= {ct, n: 0, l: 0}; x.n++; if(r.st === 'lost') x.l++; }); vip = Object.values(m).sort((a, b) => b.l - a.l || b.n - a.n); }catch(e){}
  // ---- 7. appels sortants des membres ----
  const OUT = all.filter(c => c[1] === 'out' && mem.has(c[2]) && (d => d >= from && d <= to)(localParts(c[0])[0]));
  const outAns = OUT.filter(c => c[10] === 'ans' && c[8] > 0), outTalk = outAns.reduce((s, c) => s + c[8], 0);
  const dest = {}; OUT.forEach(c => { const [k] = dstOf(c[4]); dest[k] = (dest[k] || 0) + 1; });
  let cost = null; try{ const C = cstLoad(), rate = k => cstNum((C.t[k] || {}).m), fee = k => cstNum((C.t[k] || {}).a);
    if(CST_REGS.some(([k]) => rate(k) || fee(k))) cost = outAns.reduce((s, c) => { const [k] = dstOf(c[4]); return s + Math.ceil(c[8] / C.inc) * C.inc / 60 * rate(k) + fee(k); }, 0); }catch(e){}
  const outBy = {}; OUT.forEach(c => { const x = outBy[c[2]] ||= {n: 0, a: 0, t: 0}; x.n++; if(c[10] === 'ans' && c[8] > 0){ x.a++; x.t += c[8]; } });
  // ---- 8. à corriger ----
  // [gravité, sujet, constat en HTML (libellés dans leur propre balise pour la traduction), constat en texte pour Excel]
  const fix = [], addF = (sev, t, d, h) => fix.push([sev, t, h || esc(d), d]);
  ['office', 'outOfOffice'].forEach(k => { const r = g.routes && g.routes[k]; if(!r || r.to === 'None' || (!r.dn && !r.ext)) addF('bad', T('Acheminement', 'Routing'), k === 'office' ? T("Aucune destination définie pour les heures d'ouverture.", 'No destination set for office hours.') : T('Aucune destination définie hors heures.', 'No destination set for out of hours.')); });
  if(HR){ if(HR.closedWhileOpen.length) addF('bad', T('Horaires', 'Hours'), T(`${nf(HR.closedWhileOpen.length)} appel(s) arrivés au menu fermé pendant les heures d'ouverture configurées (horaire modifié, mode fermé forcé ou férié).`, `${nf(HR.closedWhileOpen.length)} call(s) reached the closed menu during the configured office hours (changed hours, forced closed mode or holiday).`));
    if(HR.openWhileClosed.length) addF('warn', T('Horaires', 'Hours'), T(`${nf(HR.openWhileClosed.length)} appel(s) traités « ouvert » en dehors des horaires configurés.`, `${nf(HR.openWhileClosed.length)} call(s) handled as « open » outside the configured hours.`));
    if(HR.missingHol.length) addF('warn', T('Jours fériés', 'Holidays'), T('Fériés à venir non configurés : ', 'Upcoming holidays not configured: ') + HR.missingHol.map(([n, d]) => `${n} (${d})`).join(', '));
    adj.slice(0, 4).forEach(x => { const t = `: ${x.perW.toFixed(1).replace('.', en ? '.' : ',')} ${T('appels par semaine', 'calls per week')}, ${pc(x.l, x.n)} ${T('perdus', 'lost')}`; addF('info', T('Horaires', 'Hours'), `${adjDays(x.wds)} · ${adjTxt(x)} ${t}`, `${lbl(adjDays(x.wds))} · ${lbl(adjTxt(x))} ${esc(t)}`); }); }
  [...mem].filter(n => EXT_BY[n] && EXT_BY[n].enabled === false).forEach(n => addF('warn', T('Membres', 'Members'), `${n} ${dnName(n)} : ${T('poste désactivé', 'extension disabled')}`, `${dnLink(n)} : ${T('poste désactivé', 'extension disabled')}`));
  try{ vmAnalysis().rows.filter(x => mem.has(x.n) && x.flags.some(f => f !== 'ok')).forEach(x => x.flags.filter(f => f !== 'ok').forEach(f => addF(VM_FLAG[f][1] || 'warn', T('Messagerie vocale', 'Voicemail'), `${x.n} ${dnName(x.n)} : ${VM_FLAG[f][0]}`, `${dnLink(x.n)} : ${lbl(VM_FLAG[f][0])}`))); }catch(e){}
  try{ dblAnalysis().filter(x => x.items.includes(g.number)).forEach(x => addF(x.sev || 'warn', T('Doublons', 'Duplicates'), `${DBL_K[x.k][0]} — ${x.detail}`, `${lbl(DBL_K[x.k][0])} — ${lbl(x.detail)}`)); }catch(e){}
  try{ indispAnalysis().items.filter(x => QS[x.dn] && x.why.length).forEach(x => x.why.forEach(([sev, w]) => addF(sev, T("File d'attente", 'Queue'), `${x.dn} ${x.name} : ${w}`, `${dnLink(x.dn)} : ${lbl(w)}`))); }catch(e){}
  const fwdOut = [...mem].filter(n => (EXT_BY[n].profiles || []).some(p => p.routes.some(([, d]) => d.to === 'External' && d.ext)));
  if(fwdOut.length) addF('info', T('Renvois externes', 'External forwards'), T(`${fwdOut.length} membre(s) renvoient des appels vers un numéro externe : `, `${fwdOut.length} member(s) forward calls to an external number: `) + fwdOut.slice(0, 8).map(n => `${n} ${dnName(n)}`).join(', '));
  const SEVO = {bad: 0, warn: 1, info: 2, '': 2}; fix.sort((a, b) => (SEVO[a[0]] ?? 2) - (SEVO[b[0]] ?? 2));
  // ---- textes ----
  const lostR = pn(k0.lost, k0.n), bad = lostR >= 20, cmp = (a, b, inv) => { const d = a - b; return Math.abs(d) < 2 ? T('stable', 'stable') : (d > 0) !== !!inv ? `<b class="dprup">${d > 0 ? '+' : ''}${d} ${T('pts', 'pts')}</b>` : `<b class="dprdn">${d > 0 ? '+' : ''}${d} ${T('pts', 'pts')}</b>`; };
  const tr = kp ? pn(k0.lost, k0.n) - pn(kp.lost, kp.n) : 0;
  const top3 = worst.slice(0, 3).map(x => T(`${WDN[x.w].toLowerCase()} à ${x.h} h`, `${WDN[x.w]} at ${hh(x.h)}`));
  const cl = BRK.find(b => b.k === 'outOfOffice');
  const brief = [T(`Le département <b>${esc(g.name)}</b> a reçu <b>${nf(k0.n)} appels</b> (${nf(Math.round(k0.n / days * 10) / 10)} par jour) de <b>${nf(k0.cli)} clients différents</b>.`, `The <b>${esc(g.name)}</b> department received <b>${nf(k0.n)} calls</b> (${nf(Math.round(k0.n / days * 10) / 10)} per day) from <b>${nf(k0.cli)} different callers</b>.`),
    T(`<b>${pc(k0.ans, k0.n)} ont été répondus</b>, ${pc(k0.vm, k0.n)} sont allés en messagerie et <b>${nf(k0.lost)} ont été perdus (${pc(k0.lost, k0.n)})</b>.`, `<b>${pc(k0.ans, k0.n)} were answered</b>, ${pc(k0.vm, k0.n)} went to voicemail and <b>${nf(k0.lost)} were lost (${pc(k0.lost, k0.n)})</b>.`),
    kp ? T(`Par rapport à la période précédente (${nf(kp.n)} appels), le taux de perte est ${Math.abs(tr) < 2 ? 'stable' : tr > 0 ? `en hausse de ${tr} points` : `en baisse de ${-tr} points`}.`, `Compared with the previous period (${nf(kp.n)} calls), the loss rate is ${Math.abs(tr) < 2 ? 'stable' : tr > 0 ? `up ${tr} points` : `down ${-tr} points`}.`) : '',
    cl ? T(`<b>${nf(cl.n)} appels (${pc(cl.n, k0.n)}) sont arrivés hors heures</b> : ${pc(cl.vm, cl.n)} en messagerie, ${pc(cl.lost, cl.n)} perdus.`, `<b>${nf(cl.n)} calls (${pc(cl.n, k0.n)}) arrived out of hours</b>: ${pc(cl.vm, cl.n)} to voicemail, ${pc(cl.lost, cl.n)} lost.`) : '',
    top3.length && anyLost ? `<b>${T('Les pires moments :', 'Worst times:')}</b> ${top3.join(', ')}.` : '',
    mTodo.length ? T(`<b>${nf(mTodo.length)} clients</b> dont l'appel a été perdu n'ont pas été rappelés.`, `<b>${nf(mTodo.length)} callers</b> whose call was lost were not called back.`) : ''].filter(Boolean);
  // ---- graphiques ----
  const vbars = (items, small) => { const mx = Math.max(1, ...items.map(x => x.v)); return `<div class="attvb${small ? ' sm' : ''}">${items.map(x => `<div><b>${x.t}</b><i style="height:calc((100% - 18px) * ${(Math.max(x.v ? .02 : 0, x.v / mx)).toFixed(3)})" class="${x.hot ? 'hot' : ''}"></i><span>${x.lab}</span></div>`).join('')}</div>`; };
  const mName = k => { const s = new Date(k + '-15T12:00:00Z').toLocaleDateString(loc, {month: 'short', year: '2-digit', timeZone: 'UTC'}); return s.charAt(0).toUpperCase() + s.slice(1); };
  const hotOf = (arr, f) => arr.reduce((a, x) => a == null || f(x) > f(a) ? x : a, null);
  const hotM = hotOf(months.filter(m => m.n >= 10), m => m.l / m.n), hotW = hotOf(wds.filter(w => byWd[w].n >= 10), w => byWd[w].l / byWd[w].n), hotH = hotOf(hrs.filter((h, j) => hByH[j].n >= 10), h => hByH[h - h0].l / hByH[h - h0].n);
  const wkMx = Math.max(1, ...weeks.map(w => w.n)), wkStep = Math.ceil(weeks.length / 12);
  const wkChart = `<div class="attwk">${weeks.map((w, i) => `<div title="${esc(dS(w.k))} : ${w.l} / ${w.n}">${weeks.length <= 16 ? `<b>${w.l}/${w.n}</b>` : ''}<i style="height:calc((100% - 16px) * ${(w.n / wkMx).toFixed(3)})"><u style="height:${w.n ? 100 * w.l / w.n : 0}%"></u></i>${i % wkStep ? '' : `<span>${esc(dS(w.k))}</span>`}</div>`).join('')}</div>
    <div class="attleg"><span><i style="background:#cbd5e1"></i>${T('Appels reçus', 'Calls received')}</span><span><i style="background:#b91c1c"></i>${T('Perdus', 'Lost')}</span><span class="muted">${T('Semaine du', 'Week of')}</span></div>`;
  const heat = `<table class="attheat"><tbody>${wds.map(w => `<tr><th>${WDN[w]}</th>${hrs.map((h, j) => { const c = grid[w][j], a = anyLost ? c.l / mxL : c.n / mxN;
      return c.n ? `<td style="background:${(anyLost ? c.l : c.n) ? `rgba(${anyLost ? '185,28,28' : '37,99,235'},${(.1 + .9 * a).toFixed(2)})` : '#fff'};color:${a > .5 ? '#fff' : 'inherit'}" title="${WDN[w]} ${hh(h)} : ${sur(c.l, c.n)}"><b>${anyLost ? c.l : c.n}</b><small>${anyLost ? `${T('sur', 'of')} ${c.n}` : ''}</small></td>` : '<td class="muted">–</td>'; }).join('')}</tr>`).join('')}
    <tr><th></th>${hrs.map(h => `<th class="h">${hh(h)}</th>`).join('')}</tr></tbody></table>`;
  const lvl = (l, n) => !n ? '' : l / n < .1 ? 'a0' : l / n < .2 ? 'a1' : l / n < .35 ? 'a2' : 'a3';
  const kpi = (l, v, c) => `<div${c ? ` class="${c}"` : ''}><span>${l}</span><b>${v}</b></div>`;
  const tbl = (hd, rows, numFrom) => `<div class="attsc"><table class="rpt"><thead><tr>${hd.map((h, i) => `<th${i >= numFrom ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i >= numFrom ? ' class="num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const stCell = b => [nf(b.n), pc(b.ans, b.n), pc(b.vm, b.n), b.lost ? `<span class="pill ${b.lost / b.n >= .2 ? 'bad' : 'warn'}">${pc(b.lost, b.n)}</span>` : '0'];
  const SEVL = {bad: T('Important', 'Important'), warn: T('À vérifier', 'To check'), info: T('Information', 'Information')};
  el.innerHTML = `<div id="dprwrap">${head}
    <div class="report attrep dprep" id="dprsheet"><header class="rpcover"><div class="rpk">${title} · 3CXplore</div><h1>${esc(g.name)} <span class="muted mono" style="font-size:.6em">${esc(g.number)}</span></h1>
      <div class="attsub">${T('Statistiques des appels', 'Call statistics')}</div>
      <div class="rpmeta">${esc(segName(SEGOF[g.number] || SEG_COMMON))} · ${sub} (${nf(days)} ${T('jours', 'days')}) · ${T('préparé le', 'prepared on')} ${esc(new Date().toLocaleDateString(loc))}</div></header>
    <div class="attbrief${bad ? ' bad' : ''}"><h3>${T('En bref', 'In short')}</h3>${brief.map(t => `<p>${t}</p>`).join('')}</div>
    <div class="attkpi">${kpi(T('Appels reçus', 'Calls received'), nf(k0.n))}${kpi(T('Répondus', 'Answered'), pc(k0.ans, k0.n))}${kpi(T('Perdus', 'Lost'), `${nf(k0.lost)} (${pc(k0.lost, k0.n)})`)}${kpi(T('Messagerie', 'Voicemail'), nf(k0.vm))}${kpi(T('Clients différents', 'Different callers'), nf(k0.cli))}${kpi(T('Délai avant réponse (médiane)', 'Time to answer (median)'), k0.pick != null ? dur(k0.pick) : '–')}</div>
    ${kp ? `<p class="rpnote">${T('Période précédente', 'Previous period')} (${esc(dS(pFrom))} – ${esc(dS(pTo))}) : ${nf(kp.n)} ${T('appels', 'calls')} · ${T('répondus', 'answered')} ${pc(kp.ans, kp.n)} (${cmp(pn(k0.ans, k0.n), pn(kp.ans, kp.n), true)}) · ${T('perdus', 'lost')} ${pc(kp.lost, kp.n)} (${cmp(pn(k0.lost, k0.n), pn(kp.lost, kp.n))}).</p>` : ''}
    <section class="rps attkeep"><h2>${T("Heures d'ouverture et hors heures", 'Office hours and out of hours')}</h2>
      <p>${T('Horaires configurés', 'Configured hours')} : ${sch.allHours ? T('ouvert en tout temps', 'always open') : (hoursSummary(g.hours).map(esc).join(' · ') || '—')}${g.breakTime && g.breakTime.days && g.breakTime.days.length ? ` · ${T('pause', 'break')} : ${hoursSummary(g.breakTime).map(esc).join(', ')}` : ''}.</p>
      ${tbl([T('Moment', 'Time'), T('Appels', 'Calls'), T('Répondus', 'Answered'), T('Messagerie', 'Voicemail'), T('Perdus', 'Lost')], BRK.map(b => [`<b>${BRL[b.k]}</b>`, ...stCell(b)]), 1)}
      ${closed.length ? `<div class="att2"><div><h3>${T('Appels hors heures selon le jour', 'Out-of-hours calls by day')}</h3>${vbars(wds.map(w => ({v: cWd[w], t: cWd[w] || '', lab: WDN[w].slice(0, 3)})))}</div>
        <div><h3>${T("Appels hors heures selon l'heure", 'Out-of-hours calls by hour')}</h3>${vbars(cH.map((v, h) => ({v, t: v || '', lab: en ? h % 12 || 12 : h})).filter((x, h) => cH.slice(0, h + 1).some(Boolean) && cH.slice(h).some(Boolean)), true)}</div></div>` : ''}
      ${HR ? `<p class="rpnote">${T("Dans l'heure avant l'ouverture", 'In the hour before opening')} : ${(HR.before.reduce((a, b) => a + b, 0) / HR.weeks).toFixed(1).replace('.', en ? '.' : ',')} ${T('appels par semaine', 'calls per week')} · ${T("dans l'heure après la fermeture", 'in the hour after closing')} : ${(HR.after.reduce((a, b) => a + b, 0) / HR.weeks).toFixed(1).replace('.', en ? '.' : ',')}.</p>` : ''}
      ${adj.length ? `<h3>${T("Ajustements d'horaire suggérés", 'Suggested hour changes')}</h3><ul class="attul">${adj.slice(0, 6).map(x => `<li>${lbl(adjDays(x.wds))} · ${lbl(adjTxt(x))} : ${x.perW.toFixed(1).replace('.', en ? '.' : ',')} ${T('appels par semaine', 'calls per week')}, ${pc(x.l, x.n)} ${T('perdus', 'lost')}</li>`).join('')}</ul>` : ''}</section>
    <section class="rps attkeep attbrk"><h2>${T('Quand les clients appellent', 'When callers call')}</h2>
      ${months.length >= 2 ? `<h3>${T('% des appels perdus, mois par mois', '% of lost calls, month by month')}</h3>${vbars(months.map(m => ({v: pn(m.l, m.n), t: pc(m.l, m.n), lab: `${mName(m.k)}<br><small>${nf(m.n)}</small>`, hot: m === hotM})))}` : ''}
      <h3>${T('Semaine par semaine', 'Week by week')}</h3>${wkChart}
      <div class="att2"><div><h3>${T('% perdus selon le jour', '% lost by day')}</h3>${vbars(wds.map(w => ({v: pn(byWd[w].l, byWd[w].n), t: pc(byWd[w].l, byWd[w].n), lab: WDN[w].slice(0, 3), hot: w === hotW})))}</div>
        <div><h3>${T("% perdus selon l'heure", '% lost by hour')}</h3>${vbars(hrs.map((h, j) => ({v: pn(hByH[j].l, hByH[j].n), t: hByH[j].n ? pn(hByH[j].l, hByH[j].n) : '', lab: en ? h % 12 || 12 : h, hot: h === hotH})), true)}</div></div></section>
    <section class="rps attkeep"><h2>${anyLost ? T('Appels perdus, par jour et par heure', 'Lost calls, by day and hour') : T('Appels reçus, par jour et par heure', 'Calls received, by day and hour')}</h2><div class="attsc">${heat}</div>
      <p class="rpnote">${anyLost ? T("Gros chiffre = appels perdus. Petit chiffre = appels reçus à ce moment-là. Plus la case est foncée, plus il y a d'appels perdus.", 'Large number = lost calls. Small number = calls received at that time. The darker the cell, the more calls were lost.') : T('Nombre d\'appels reçus ; aucun appel perdu sur la période.', 'Number of calls received; no lost call in the period.')}${R.some(r => r.h < h0) ? T(` Les appels avant ${h0} h sont comptés dans ${h0} h.`, ` Calls before ${hh(h0)} are counted in ${hh(h0)}.`) : ''}${R.some(r => r.h > h1) ? T(` Les appels après ${h1} h sont comptés dans ${h1} h.`, ` Calls after ${hh(h1)} are counted in ${hh(h1)}.`) : ''}</p>
      ${worst.length ? `<h3>${T('Les pires moments', 'The worst times')}</h3><ul class="attul">${worst.slice(0, 6).map(x => `<li><b>${T(`${WDN[x.w]} à ${x.h} h`, `${WDN[x.w]} at ${hh(x.h)}`)}</b>${T(' :', ':')} ${T(`${nf(x.l)} appels perdus sur ${nf(x.n)}`, `${nf(x.l)} lost calls out of ${nf(x.n)}`)}</li>`).join('')}</ul>` : ''}
      <h3>${T('Par jour et par moment de la journée', 'By day and time of day')}</h3>
      <div class="attsc"><table class="attmom"><thead><tr><th>${T('Jour', 'Day')}</th>${MOM.map(([a, b]) => `<th>${a}<br><small>${b}</small></th>`).join('')}</tr></thead><tbody>${wds.map(w => `<tr><th>${WDN[w]}</th>${mom[w].map(c => c.n ? `<td class="${lvl(c.l, c.n)}"><b>${pc(c.l, c.n)} ${T('perdus', 'lost')}</b><small>${sur(c.l, c.n)}</small></td>` : '<td class="muted">—</td>').join('')}</tr>`).join('')}</tbody></table></div>
      <div class="attleg"><span><i class="a0"></i>${T('Moins de 10 %', 'Under 10%')}</span><span><i class="a1"></i>${T('10 à 19 %', '10 to 19%')}</span><span><i class="a2"></i>${T('20 à 34 %', '20 to 34%')}</span><span><i class="a3"></i>${T('35 % et plus', '35% and over')}</span></div></section>
    <section class="rps attbrk"><h2>${T('Où vont les appels', 'Where calls go')}</h2>
      <h3>${T("Numéros d'arrivée (SDA)", 'Incoming numbers (DID)')}</h3>${tbl([T('SDA', 'DID'), T('Appels', 'Calls'), T('Perdus', 'Lost')], Object.values(sda).sort((a, b) => b.n - a.n).slice(0, 10).map(x => [/^\+?\d{10,}$/.test(x.d) ? `<span class="mono">${esc(phone(x.d))}</span>` : x.d === '—' ? '—' : dnLink(x.d), nf(x.n), pc(x.l, x.n)]), 1)}
      ${Object.values(IVR).map(I => `<h3>${T('Menu vocal', 'Voice menu')} ${dnLink(I.dn)}</h3>${tbl([T('Touche', 'Key'), T('Destination', 'Destination'), T('Appels', 'Calls'), T('Répondus', 'Answered'), T('Perdus', 'Lost')],
        Object.values(I.ch).sort((a, b) => b.n - a.n).slice(0, 12).map(x => [`<b>${esc(x.key)}</b>`, dnLink(x.dest), nf(x.n), pc(x.ans, x.n), pc(x.lost, x.n)]).concat(I.hang ? [[`<i>${T('raccroché au menu', 'hung up at the menu')}</i>`, '', nf(I.hang), '', '']] : []), 2)}`).join('')}
      ${Object.keys(QS).length ? `<h3>${T("Files d'attente", 'Queues')}</h3>${tbl([T('File', 'Queue'), T('Appels du département', 'Department calls'), T('Répondus', 'Answered'), T('Abandons en file', 'Abandoned in queue'), T('Attente médiane (file entière)', 'Median wait (whole queue)')], Object.values(QS).sort((a, b) => b.n - a.n).map(x => [dnLink(x.q), nf(x.n), pc(x.ans, x.n), x.ab ? `<span class="pill ${x.ab / x.n >= .15 ? 'bad' : 'warn'}">${nf(x.ab)}</span>` : '0', x.wait != null ? dur(x.wait) : '–']), 1)}` : ''}
      ${Object.keys(LOSS).length ? `<h3>${T('Où les appels sont perdus', 'Where calls are lost')}</h3>${tbl([T('Dernière étape', 'Last step'), T('Appels perdus', 'Lost calls'), T('Cause', 'Cause')], Object.values(LOSS).sort((a, b) => b.n - a.n).slice(0, 8).map(x => [x.dn === '—' ? '—' : dnLink(x.dn), nf(x.n), Object.entries(x.why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill">${esc((ST[k] || [k])[0])}</span> ${nf(v)}`).join(' ')]), 1)}` : ''}</section>
    <section class="rps attbrk"><h2>${T('Qui répond', 'Who answers')}</h2>
      ${who.length ? tbl([T('Employé', 'Employee'), T('Appels répondus', 'Calls answered'), T('Part', 'Share'), T('Conversation moy.', 'Avg. talk'), T('Délai de décroché (médiane)', 'Pick-up delay (median)'), T('Sonneries sans réponse', 'Unanswered rings'), T('Mises en attente perdues', 'Holds lost')],
        who.slice(0, 25).map(w => [`${dnLink(w.n)}${mem.has(w.n) ? '' : ` <span class="muted" style="font-size:11px">${T('(hors département)', '(outside the department)')}</span>`}`, nf(w.ans), pc(w.ans, ansTot), w.ans ? dur(Math.round(w.talk / w.ans)) : '–', med(w.pick) != null ? dur(med(w.pick)) : '–', w.rings ? `${nf(w.ringMiss)} (${pc(w.ringMiss, w.rings)})` : '–', pk[w.n] ? `${nf(pk[w.n].l)} / ${nf(pk[w.n].n)}` : '–']), 1) : `<p class="muted">${T('Aucun employé identifié.', 'No employee identified.')}</p>`}
      <p class="rpnote">${T("Part : part des appels répondus du département. Sonneries sans réponse : le poste a sonné sans que la personne réponde (sonneries arrêtées parce qu'un collègue a répondu exclues). Mises en attente perdues : appels mis en attente par l'employé où le client a raccroché, sur tous ses appels de la période.", "Share: share of the department's answered calls. Unanswered rings: the phone rang without being answered (rings stopped because a colleague answered are excluded). Holds lost: calls put on hold by the employee where the caller hung up, over all their calls in the period.")}</p>
      ${indisp.length ? `<h3>${T('Personnes indispensables', 'Key people')}</h3><ul class="attul">${indisp.map(p => `<li>${dnLink(p.a)} — ${p.items.map(i => `${dnLink(i.x.dn)}${i.solo ? T(' (seule personne connectée)', ' (only person logged in)') : ''}${i.share ? ` (${Math.round(100 * i.share)} % ${T('des réponses', 'of answers')})` : ''}`).join(', ')}</li>`).join('')}</ul>` : ''}
      ${abs.length ? `<h3>${T('Absences sur la période', 'Absences in the period')}</h3><ul class="attul">${abs.map(a => `<li>${dnLink(a.ext)} : ${T(`du ${esc(a.from)} au ${esc(a.to)}`, `from ${esc(a.from)} to ${esc(a.to)}`)}${a.note ? ` (${esc(a.note)})` : ''}</li>`).join('')}</ul>` : ''}</section>
    <section class="rps attbrk"><h2>${T('Les clients', 'Callers')}</h2>
      <div class="attkpi">${kpi(T('Clients qui rappellent (48 h)', 'Callers who call back (48 h)'), rep && rep.n ? pc(rep.r, rep.n) : '–')}${kpi(T('Appels perdus non rappelés', 'Lost calls not called back'), nf(mTodo.length), mTodo.length ? 'dprbad' : '')}${kpi(T('Rappelés (délai médian)', 'Called back (median delay)'), `${nf(mBack.length)}${mDelay != null ? ` · ${fmtDelay(mDelay)}` : ''}`)}</div>
      <p class="rpnote">${T(`Clients qui rappellent : appels répondus suivis d'un nouvel appel du même client dans les 48 heures (${rep ? sur(rep.r, rep.n) : '–'}${rep && rep.fx ? `, ${nf(rep.fx)} appelants très fréquents exclus` : ''}). Appels perdus : ${nf(miss.length)} clients, dont ${nf(mBack.length)} rappelés par un employé et ${nf(mSelf.length)} qui ont rappelé eux-mêmes et ont été servis.`, `Callers who call back: answered calls followed by a new call from the same caller within 48 hours (${rep ? sur(rep.r, rep.n) : '–'}${rep && rep.fx ? `, ${nf(rep.fx)} very frequent callers excluded` : ''}). Lost calls: ${nf(miss.length)} callers, of whom ${nf(mBack.length)} were called back by an employee and ${nf(mSelf.length)} called again themselves and were served.`)}</p>
      ${mTodo.length ? `<h3>${T('À rappeler', 'To call back')}</h3>${tbl([T('Client', 'Caller'), T('Dernier appel perdu', 'Last lost call'), T('Tentatives', 'Attempts')], mTodo.sort((a, b) => a.last < b.last ? 1 : -1).slice(0, 15).map(m => [`<span class="mono">${esc(phone(m.num))}</span>${m.name ? ` <span class="muted">${esc(m.name)}</span>` : ''}`, esc(fmtD(m.last)), nf(m.n)]), 2)}` : ''}
      <h3>${T('Clients qui appellent le plus', 'Most frequent callers')}</h3>${tbl([T('Client', 'Caller'), T('Appels', 'Calls'), T('Perdus', 'Lost')], topCli.map(x => [`<span class="mono">${esc(phone(x.k))}</span>${x.name ? ` <span class="muted">${esc(x.name)}</span>` : ''}`, nf(x.n), nf(x.l)]), 1)}
      ${vip.length ? `<h3>${T('Numéros importants', 'Important numbers')}</h3>${tbl([T('Contact', 'Contact'), T('Catégorie', 'Category'), T('Appels', 'Calls'), T('Perdus', 'Lost')], vip.slice(0, 10).map(x => [esc(x.ct.name || phone(x.ct.nums[0])), lbl(VIP_CATS[x.ct.cat] || x.ct.cat), nf(x.n), x.l ? `<span class="pill bad">${nf(x.l)}</span>` : '0']), 2)}` : ''}</section>
    <section class="rps attkeep"><h2>${T('Appels sortants des membres du département', 'Outbound calls by department members')}</h2>
      ${OUT.length ? `<div class="attkpi">${kpi(T('Appels sortants', 'Outbound calls'), nf(OUT.length))}${kpi(T('Aboutis', 'Connected'), pc(outAns.length, OUT.length))}${kpi(T('Temps de conversation', 'Talk time'), dur(outTalk))}</div>
        <p>${T('Destinations', 'Destinations')} : ${Object.entries(dest).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${lbl((DST_REG.find(x => x[0] === k) || [, k])[1])} ${pc(v, OUT.length)}`).join(' · ')}${cost != null ? ` · ${T('coût estimé', 'estimated cost')} : <b>${money(cost)}</b>` : ''}.</p>
        ${tbl([T('Employé', 'Employee'), T('Appels', 'Calls'), T('Aboutis', 'Connected'), T('Conversation', 'Talk')], Object.entries(outBy).sort((a, b) => b[1].n - a[1].n).slice(0, 15).map(([n, x]) => [dnLink(n), nf(x.n), nf(x.a), dur(x.t)]), 1)}` : `<p class="muted">${T('Aucun appel sortant des membres sur la période.', 'No outbound call by members in the period.')}</p>`}</section>
    <section class="rps attkeep"><h2>${T('À corriger', 'To fix')} (${nf(fix.length)})</h2>${fix.length ? tbl([T('Gravité', 'Severity'), T('Sujet', 'Topic'), T('Constat', 'Finding')], fix.map(([sv, t, h]) => [`<span class="pill ${sv}">${SEVL[sv] || SEVL.info}</span>`, esc(t), h]), 9) : `<p class="muted">${T('Rien à corriger.', 'Nothing to fix.')}</p>`}</section>
    <section class="rps attbrk"><h2>${T('Annexe — Détail par journée', 'Appendix — Day by day')}</h2><p class="rpnote">${T("Les journées en rouge ont 30 % ou plus d'appels perdus.", 'Days in red have 30% or more lost calls.')}</p>
      <table class="rpt attday"><thead><tr><th>Date</th><th>${T('Jour', 'Day')}</th><th class="num">${T('Reçus', 'Received')}</th><th class="num">${T('Répondus', 'Answered')}</th><th class="num">${T('Messagerie', 'Voicemail')}</th><th class="num">${T('Perdus', 'Lost')}</th><th class="num">%</th></tr></thead><tbody>
      ${dayRows.map(x => { const d = dK[x.k]; return `<tr${d.n >= 3 && d.lost / d.n >= .3 ? ' class="hot"' : ''}><td class="nw">${esc(dS(x.k))}</td><td>${WDN[((new Date(x.k + 'T12:00:00Z').getUTCDay() + 6) % 7)].slice(0, 3)}</td><td class="num">${nf(d.n)}</td><td class="num">${nf(d.ans)}</td><td class="num">${nf(d.vm)}</td><td class="num">${nf(d.lost)}</td><td class="num">${pc(d.lost, d.n)}</td></tr>`; }).join('')}</tbody></table></section>
    <div class="rpfoot">${esc(g.name)} (${esc(g.number)}) — ${title} — ${sub}. ${T("Appels comptés : appels entrants passés par ce département. Perdus : raccroché au menu, abandon en file, sans réponse, renvoi externe sans réponse ou raccroché en attente ; les messages laissés en messagerie sont comptés à part.", 'Calls counted: inbound calls that went through this department. Lost: hung up at the menu, abandoned in queue, unanswered, external forward unanswered or hung up on hold; voicemail messages are counted separately.')}</div>
    </div></div>`;
  wire();
  $('#dprprint').addEventListener('click', () => printHTML($('#dprsheet').outerHTML.replace('id="dprsheet"', '')));
  $('#dprxl').addEventListener('click', () => {
    const STL = {ans: T('Répondu', 'Answered'), vm: T('Messagerie', 'Voicemail'), lost: T('Perdu', 'Lost'), other: T('Autre', 'Other')};
    const sh = [{name: T('Résumé', 'Summary'), rows: [[T('Rubrique', 'Item'), T('Valeur', 'Value')], [T('Département', 'Department'), `${g.number} ${g.name}`], [T('Magasin', 'Store'), segName(SEGOF[g.number] || SEG_COMMON)], [T('Période', 'Period'), `${from} → ${to}`],
        [T('Appels reçus', 'Calls received'), k0.n], [T('Répondus', 'Answered'), k0.ans], [T('Messagerie', 'Voicemail'), k0.vm], [T('Perdus', 'Lost'), k0.lost], [T('Clients différents', 'Different callers'), k0.cli], [T('Délai avant réponse médian (s)', 'Median time to answer (s)'), k0.pick ?? ''], [T('Conversation moyenne (s)', 'Average talk (s)'), k0.talk],
        [T('Clients qui rappellent (48 h)', 'Callers who call back (48 h)'), rep && rep.n ? `${rep.r} / ${rep.n}` : ''], [T('Appels perdus non rappelés', 'Lost calls not called back'), mTodo.length], [T('Appels sortants des membres', 'Outbound calls by members'), OUT.length], [T('Coût estimé des sortants', 'Estimated outbound cost'), cost != null ? cost.toFixed(2) : '']]},
      {name: T('Par moment', 'By time'), rows: [[T('Moment', 'Time'), T('Appels', 'Calls'), T('Répondus', 'Answered'), T('Messagerie', 'Voicemail'), T('Perdus', 'Lost')]].concat(BRK.map(b => [BRL[b.k], b.n, b.ans, b.vm, b.lost]))},
      {name: T('Par jour', 'By day'), rows: [['Date', T('Jour', 'Day'), T('Reçus', 'Received'), T('Répondus', 'Answered'), T('Messagerie', 'Voicemail'), T('Perdus', 'Lost')]].concat(dayRows.map(x => { const d = dK[x.k]; return [x.k, WDN[((new Date(x.k + 'T12:00:00Z').getUTCDay() + 6) % 7)], d.n, d.ans, d.vm, d.lost]; }))},
      {name: T('Jour et heure', 'Day and hour'), rows: [[T('Jour', 'Day'), ...hrs.map(hh)]].concat(wds.map(w => [WDN[w], ...grid[w].map(c => c.n ? `${c.l} / ${c.n}` : '')]))},
      {name: T('Par employé', 'By employee'), rows: [[T('Poste', 'Extension'), T('Nom', 'Name'), T('Membre', 'Member'), T('Appels répondus', 'Calls answered'), T('Conversation (s)', 'Talk (s)'), T('Délai de décroché médian (s)', 'Median pick-up delay (s)'), T('Sonneries', 'Rings'), T('Sonneries sans réponse', 'Unanswered rings')]].concat(who.map(w => [w.n, dnName(w.n), mem.has(w.n) ? T('oui', 'yes') : T('non', 'no'), w.ans, w.talk, med(w.pick) ?? '', w.rings, w.ringMiss]))},
      {name: T('À rappeler', 'To call back'), rows: [[T('Client', 'Caller'), T('Nom affiché', 'Display name'), T('Dernier appel perdu', 'Last lost call'), T('Tentatives', 'Attempts'), T('Statut', 'Status')]].concat(miss.map(m => [phone(m.num), m.name, fmtD(m.last), m.n, RAP_ST[m.st].l]))},
      {name: T('À corriger', 'To fix'), rows: [[T('Gravité', 'Severity'), T('Sujet', 'Topic'), T('Constat', 'Finding')]].concat(fix.map(([sv, t, , d]) => [SEVL[sv] || '', t, d]))},
      {name: T('Appels', 'Calls'), rows: [['Date', T('Heure', 'Time'), T('Moment', 'Time slot'), 'SDA', T('Appelant', 'Caller'), T('Résultat', 'Outcome'), T('Répondu par', 'Answered by'), T('Délai avant réponse (s)', 'Time to answer (s)'), T('Conversation (s)', 'Talk (s)'), T('Durée (s)', 'Duration (s)')]]
        .concat(R.map(r => [r.d, `${String(r.h).padStart(2, '0')}:${String(r.min % 60).padStart(2, '0')}`, BRL[r.br], r.c[5], phone(r.c[2]) || r.c[2], STL[r.st], r.c[6] && EXT_BY[r.c[6]] ? `${r.c[6]} ${dnName(r.c[6])}` : '', r.c[12] ?? '', r.c[8] || 0, r.c[7] || 0]))}];
    const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = `${T('rapport-departement', 'department-report')}-${g.number}-${from}-${to}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
};
