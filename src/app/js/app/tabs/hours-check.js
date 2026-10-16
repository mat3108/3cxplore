// ---------- Contrôle des horaires : horaires configurés vs appels réels ----------
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const toMin = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); }; // fin exclusive, comme 3CX (« 07:59 » = jusqu'à 7 h 59)
// heure locale complète : [jour 'AAAA-MM-JJ', minutes depuis minuit, jour de semaine 0=lundi]
function localFull(iso){ const [d, h, w] = localParts(iso); return [d, h * 60 + new Date(Date.parse(iso)).getUTCMinutes(), w]; }
// jours fériés du Québec (date fixe ou calculée) pour une année
function qcHolidays(y){
  const pad = n => String(n).padStart(2, '0'), ymd = (m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const nth = (m, wd, n) => { const d = new Date(Date.UTC(y, m - 1, 1)); let c = 0; for(let i = 1; i <= 31; i++){ d.setUTCDate(i); if(d.getUTCMonth() !== m - 1) break; if(d.getUTCDay() === wd && ++c === n) return ymd(m, i); } };
  const easter = (() => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(Date.UTC(y, mo - 1, da)); })();
  const shift = (dt, n) => { const x = new Date(dt); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const patriotes = (() => { for(let d = 24; d >= 18; d--){ const x = new Date(Date.UTC(y, 4, d)); if(x.getUTCDay() === 1) return ymd(5, d); } })();
  return [['Jour de l\'An', ymd(1, 1)], ['Vendredi saint', shift(easter, -2)], ['Lundi de Pâques', shift(easter, 1)], ['Journée nationale des patriotes', patriotes],
    ['Fête nationale', ymd(6, 24)], ['Fête du Canada', ymd(7, 1)], ['Fête du travail', nth(9, 1, 1)], ['Action de grâce', nth(10, 1, 2)], ['Noël', ymd(12, 25)], ['Lendemain de Noël', ymd(12, 26)]];
}
const HAS_HOURS_DETAIL = FULL.groups.some(g => Array.isArray(g.holidayDates));
function deptSchedule(g){
  const per = d => (g.hours?.days || []).find(x => x.day === DAYS_EN[d])?.p || [];
  const brk = d => (g.breakTime?.days || []).find(x => x.day === DAYS_EN[d])?.p || [];
  const hol = (g.holidayDates || []);
  const isHol = day => hol.some(h => { const [y, m, d] = day.split('-').map(Number);
    const key = h.recurrent ? (m * 100 + d) : (y * 10000 + m * 100 + d);
    const a = h.recurrent ? h.m * 100 + h.d : h.y * 10000 + h.m * 100 + h.d, b = h.recurrent ? h.me * 100 + h.de : h.ye * 10000 + h.me * 100 + h.de;
    return a <= b ? key >= a && key <= b : key >= a || key <= b; }); // 18.1.43 : période récurrente à cheval sur deux années
  const allHours = g.hours?.type === 'AllHours';
  return {per, brk, isHol, allHours, expected(day, min, wd){
    if(allHours) return 'office';
    if(g.hours?.type !== 'SpecificHours' && isHol(day)) return 'holidays';
    const inP = ps => ps.some(([b, e]) => min >= toMin(b) && min < toMin(e));
    if(inP(brk(wd))) return 'break';
    if(inP(per(wd))) return 'office';
    return 'outOfOffice';
  }};
}
const BR_FR = {office: 'Ouvert', outOfOffice: 'Fermé', break: 'Pause', holidays: 'Férié'};
const BR_CLS = {office: 'ok', outOfOffice: '', break: 'warn', holidays: 'acc'};
function hoursAnalysis(from, to){
  // 18.1.5 : semaines de la période (bornée aux dates couvertes par le backup), et non jours avec des appels
  const dFirst = FULL.calls.length ? localParts(FULL.calls[FULL.calls.length - 1][0])[0] : from, dLast = FULL.calls.length ? localParts(FULL.calls[0][0])[0] : to;
  const pA = from > dFirst ? from : dFirst, pB = to < dLast ? to : dLast, perWeeks = Math.max(1, (Math.round((Date.parse(pB) - Date.parse(pA)) / 864e5) + 1) / 7);
  const depts = D.groups.filter(g => !isSysGroup(g) && g.routes && ['office', 'outOfOffice'].some(k => g.routes[k] && g.routes[k].to !== 'None' && g.routes[k].dn));
  // un seul passage sur les appels : index des appels entrants de la période par département traversé
  const byGroup = {};
  FULL.calls.forEach((c, i) => {
    if(c[1] !== 'in') return;
    const gs = [...new Set(c[9].filter(p => p[1] === 'group').map(p => p[0]))]; if(!gs.length) return; // 18.1.6 : une seule fois par département
    const m = localFull(c[0]); if(m[0] < from || m[0] > to) return;
    gs.forEach(n => (byGroup[n] ||= []).push([c, m]));
  });
  return depts.map(g => {
    const sch = deptSchedule(g), dnOf = k => g.routes[k] && g.routes[k].to !== 'None' ? g.routes[k].dn || ('ext:' + g.routes[k].ext) : null;
    const br = {}; ['office', 'outOfOffice', 'break', 'holidays'].forEach(k => { const d = dnOf(k); if(d) (br[d] ||= []).push(k); });
    const R = {g, sch, total: 0, obs: {office: 0, outOfOffice: 0, break: 0, holidays: 0}, closedWhileOpen: [], openWhileClosed: [], grid: Array.from({length: 7}, () => Array.from({length: 48}, () => ({n: 0, bad: 0, st: {}}))),
      before: Array(7).fill(0), after: Array(7).fill(0), days: new Set(),
      pre: Array.from({length: 7}, () => Array.from({length: 4}, () => ({n: 0, l: 0}))), post: Array.from({length: 7}, () => Array.from({length: 4}, () => ({n: 0, l: 0}))), brk: Array.from({length: 7}, () => ({n: 0, l: 0})), off: Array.from({length: 7}, () => ({n: 0, l: 0}))};
    (byGroup[g.number] || []).forEach(([c, m]) => {
      const k = c[9].findIndex(p => p[0] === g.number); if(k < 0 || !c[9][k + 1]) return;
      const poss = br[c[9][k + 1][0]]; if(!poss) return;
      const [day, min, wd] = m, exp = sch.expected(day, min, wd);
      R.total++; R.days.add(day);
      const obs = poss.includes(exp) ? exp : poss[0];
      R.obs[obs]++;
      const cell = R.grid[wd][Math.floor(min / 30)]; cell.n++; cell.st[obs] = (cell.st[obs] || 0) + 1;
      const closedBranch = poss.every(p => p !== 'office'), openBranch = poss.includes('office') && poss.length === 1;
      // 18.1.7 : sans le détail des pauses et des fériés (backup lu par une ancienne version), seule la branche « fermé » est une anomalie certaine
      if(exp === 'office' && closedBranch && (HAS_HOURS_DETAIL || poss.every(p => p === 'outOfOffice'))){ R.closedWhileOpen.push({c, day, min, poss}); cell.bad++; }
      if(exp !== 'office' && openBranch){ R.openWhileClosed.push({c, day, min, exp}); cell.bad++; }
      // demande proche des horaires (dans l'heure qui précède l'ouverture ou suit la fermeture)
      if(exp === 'outOfOffice'){ const ps = sch.per(wd);
        if(ps.some(([b]) => min >= toMin(b) - 60 && min < toMin(b))) R.before[wd]++;
        if(ps.some(([, e]) => min >= toMin(e) && min < toMin(e) + 60)) R.after[wd]++;
        // 15.18 : par demi-heure, jusqu'à 2 h avant la première ouverture et après la dernière fermeture du jour ; jours sans horaire
        const lost = ST_LOST.has(c[10]);
        if(ps.length){ const bm = toMin(ps[0][0]), em = toMin(ps[ps.length - 1][1]);
          if(min < bm && min >= bm - 120){ const x = R.pre[wd][Math.floor((bm - 1 - min) / 30)]; x.n++; if(lost) x.l++; }
          if(min >= em && min < em + 120){ const x = R.post[wd][Math.floor((min - em) / 30)]; x.n++; if(lost) x.l++; } }
        else { R.off[wd].n++; if(lost) R.off[wd].l++; } }
      if(exp === 'break'){ R.brk[wd].n++; if(ST_LOST.has(c[10])) R.brk[wd].l++; }
    });
    // jours fériés du Québec à venir non configurés (90 prochains jours)
    const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), lim = new Date(Date.now() + 90 * 864e5).toLocaleDateString('fr-CA', {timeZone: TZ}); // 18.1.23
    const y = +today.slice(0, 4);
    R.missingHol = HAS_HOURS_DETAIL ? [...qcHolidays(y), ...qcHolidays(y + 1)].filter(([, d]) => d >= today && d <= lim && !sch.isHol(d) && g.hours?.type !== 'AllHours') : [];
    R.weeks = perWeeks;
    return R;
  }).filter(R => R.total || R.missingHol.length).sort((a, b) => b.total - a.total);
}
const fmtMin = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
