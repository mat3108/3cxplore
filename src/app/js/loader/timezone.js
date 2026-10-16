  // ---------- 18.2.37 : fuseau horaire du système 3CX d'après ses paramètres (Montréal par défaut) ----------
  // ville du réglage « fuseau sélectionné » -> fuseau officiel ; sinon écart d'heures du système ; les fuseaux des modèles de téléphones ne sont pas fiables (valeurs par défaut)
  window.tz3cx = params => {
    const get = n => ((params || []).find(p => p.name === n) || {}).value || '';
    const ok = z => { try{ new Intl.DateTimeFormat('en', {timeZone: z}); return true; }catch(e){ return false; } };
    const MAP = [[/st\.?\s*john'?s|newfoundland|terre-neuve/i, 'America/St_Johns'], [/halifax|atlantic|atlantique|moncton|saint john\b/i, 'America/Halifax'],
      [/montr[eé]al|ottawa|qu[eé]bec|toronto|new york|eastern|detroit|indiana/i, 'America/Toronto'], [/regina|saskatchewan/i, 'America/Regina'],
      [/winnipeg|central|chicago|mexico|guadalajara|monterrey/i, 'America/Winnipeg'], [/phoenix|arizona/i, 'America/Phoenix'], [/edmonton|calgary|mountain|denver/i, 'America/Edmonton'],
      [/vancouver|pacific|pacifique|los angeles|tijuana|seattle/i, 'America/Vancouver'], [/alaska|anchorage/i, 'America/Anchorage'], [/hawa/i, 'Pacific/Honolulu'],
      [/london|londres|dublin|lisbon|lisbonne/i, 'Europe/London'], [/paris|bruxelles|brussels|madrid|rome|berlin|amsterdam|zurich|vienn|copenhag|stockholm|oslo|prague|warsaw|varsovie/i, 'Europe/Paris'],
      [/athens|ath[eè]nes|helsinki|kyiv|kiev|bucarest|bucharest|sofia|istanbul|jerusalem|cairo|le caire/i, 'Europe/Athens'], [/moscow|moscou/i, 'Europe/Moscow'], [/dubai|duba[iï]/i, 'Asia/Dubai'],
      [/sydney|melbourne|canberra/i, 'Australia/Sydney'], [/tokyo/i, 'Asia/Tokyo'], [/s[aã]o paulo|brasilia/i, 'America/Sao_Paulo'], [/buenos aires/i, 'America/Argentina/Buenos_Aires']];
    const sel = get('TIME_DATE.SELECTED_TIMEZONE');
    if(sel) for(const [re, z] of MAP) if(re.test(sel) && ok(z)) return {tz: z, how: 'param', label: sel};
    const off = get('TIMEZONE_GLOBAL_ZONE').trim(), m = off.match(/^([+-]?)(\d{1,2}):?(\d{2})?$/);
    if(m){ const h = +m[2], mi = +(m[3] || 0), neg = m[1] === '-', key = (neg ? '-' : '+') + h + ':' + String(mi).padStart(2, '0');
      const OFF = {'-3:30': 'America/St_Johns', '-4:00': 'America/Halifax', '-5:00': 'America/Toronto', '-6:00': 'America/Winnipeg', '-7:00': 'America/Edmonton', '-8:00': 'America/Vancouver', '-9:00': 'America/Anchorage', '-10:00': 'Pacific/Honolulu', '+0:00': 'Europe/London', '-0:00': 'Europe/London', '+1:00': 'Europe/Paris', '+2:00': 'Europe/Athens', '+3:00': 'Europe/Moscow', '+3:30': 'Asia/Tehran', '+4:30': 'Asia/Kabul', '+5:30': 'Asia/Kolkata', '+5:45': 'Asia/Kathmandu', '+9:30': 'Australia/Darwin', '-2:30': 'America/St_Johns'};
      const z = OFF[key] || (!mi ? 'Etc/GMT' + (h ? (neg ? '+' : '-') + h : '') : null);
      if(z && ok(z)) return {tz: z, how: 'offset', label: off}; }
    return null;
  };

