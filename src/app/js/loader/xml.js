  // ---------- Aides XML ----------
  const kids = (e, tag) => e ? Array.from(e.children).filter(c => tag === '*' || c.tagName === tag) : [];
  const q1 = (e, path) => { for(const t of path.split('/')){ if(!e) return null; e = kids(e, t)[0] || null; } return e; };
  const qa = (e, path) => { const p = path.split('/'); let cur = e ? [e] : []; for(const t of p) cur = cur.flatMap(x => kids(x, t)); return cur; };
  const txt = (e, path, d = '') => { const x = q1(e, path); const v = x ? x.textContent.trim() : ''; return v || d; };
  const own = e => e ? Array.from(e.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim() : '';

  const iso = ts => ts ? ts.slice(0, 19).replace(' ', 'T') + 'Z' : '';
  const ms = ts => Date.parse(ts.slice(0, 19).replace(' ', 'T') + 'Z');
  const secs = (a, b) => { if(!a || !b) return 0; const x = ms(a), y = ms(b); return isNaN(x) || isNaN(y) ? 0 : Math.max(0, Math.round((y - x) / 1000)); };
  const interval = v => { if(!v) return 0; const p = v.split(':'); if(p.length !== 3) return 0; return Math.trunc(+p[0] * 3600 + +p[1] * 60 + parseFloat(p[2])) || 0; };
  const dest = e => { if(!e) return null; const to = txt(e, 'To'); if(!to) return null; const i = q1(e, 'Internal'); return {to, dn: i ? (i.getAttribute('DN') || '') : '', ext: txt(e, 'External')}; };
  const routeStr = s => { if(!s) return null; const p = (s + '..').split('.'); return {to: p[0], dn: p[1], ext: p[2]}; };
  const hours = e => {
    const h = e ? q1(e, 'Hours') : null; if(!h) return null;
    return {type: h.getAttribute('HoursType') || '', days: kids(h, 'PeriodsOfDay').map(pd => ({day: pd.getAttribute('DayOfWeek'), p: kids(pd, 'PeriodOfDay').map(p => [p.getAttribute('begin'), p.getAttribute('end')])}))};
  };
  const props = e => { const o = {}; for(const p of kids(q1(e, 'Properties'), '*')){ const n = txt(p, 'Name'); if(n) o[n] = SENSITIVE.test(n) ? (txt(p, 'Value') ? '•••• (masqué)' : '') : txt(p, 'Value'); } return o; };
  const desc = (a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0;
  // json.dumps de Python (séparateurs « , » et « : » avec espace)
  const pyDumps = v => v === null ? 'null' : Array.isArray(v) ? '[' + v.map(pyDumps).join(', ') + ']' : typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + pyDumps(x)).join(', ') + '}' : JSON.stringify(v);
  const strip = s => s.replace(/^[ ›]+|[ ›]+$/g, '');
  // 19.0.3 : un sous-renvoi décoché dans la console reste dans le backup, marqué OutOfHoursInactive / InternalInactive="true" : on l'ignore
  const flatten = (e, path = '') => {
    let res = [];
    const off = [e.getAttribute('OutOfHoursInactive') === 'true' && 'OutOfOfficeHours', e.getAttribute('InternalInactive') === 'true' && 'Internal'];
    for(const c of kids(e, '*')){
      if(off.includes(c.tagName)) continue;
      if(q1(c, 'To')){ const d = dest(c); if(d) res.push([strip(path + ' › ' + c.tagName), d]); }
      else if(c.children.length) res = res.concat(flatten(c, strip(path + ' › ' + c.tagName)));
    }
    return res;
  };

