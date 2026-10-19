// 18.2.37 : fuseau horaire du système 3CX, lu dans ses paramètres (Montréal par défaut)
const TZ_SRC = (() => { try{ return window.tz3cx ? window.tz3cx(D.params || []) : null; }catch(e){ return null; } })();
const TZ = (TZ_SRC && TZ_SRC.tz) || 'America/Toronto';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// formateurs de dates créés une seule fois : en créer un à chaque appel coûtait plusieurs secondes sur les grands historiques
const FMT_D = new Intl.DateTimeFormat('fr-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
const FMT_DAY = new Intl.DateTimeFormat('fr-CA', {timeZone: TZ}), FMT_H = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: '2-digit', hourCycle: 'h23'});
const fmtD = iso => { if(!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(d) : FMT_D.format(d); }
// 18.2.32 : valeur de cellule CSV sans risque de formule (=, +, -, @ en tête, sauf un nombre ou un numéro)
const csvSafe = v => { let s = String(v ?? ''); if(/^[=+\-@\t\r]/.test(s) && !/^[-+]?[\d(][\d\s().,:-]*$/.test(s)) s = "'" + s; return s.replace(/"/g, '""'); };
// 18.2.1 : heure d'un message vocal (nom du fichier AAAAMMJJHHMMSS, en UTC) -> ISO
const vmUTC = s => { if(!(s && s.length >= 12)) return ''; const t = Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14) || '00'}Z`); return isNaN(t) ? '' : new Date(t).toISOString(); };;
// jour et heure locaux : décalage horaire mis en cache par heure UTC (même résultat que le formateur, beaucoup plus rapide)
const _dkOff = {};
const _dkShift = iso => { const k = String(iso).slice(0, 13); let o = _dkOff[k]; if(o === undefined){ const d = new Date(k + ':00:00Z'); o = _dkOff[k] = isNaN(d) ? null : Date.parse(FMT_DAY.format(d) + 'T' + String(+FMT_H.format(d) % 24).padStart(2, '0') + ':00:00Z') - d.getTime(); } return o; };
const dayKey = iso => { const o = _dkShift(iso); const d = new Date(iso); if(isNaN(d)) return String(d); return o == null ? FMT_DAY.format(d) : new Date(d.getTime() + o).toISOString().slice(0, 10); };
const hourOf = iso => { const o = _dkShift(iso); const d = new Date(iso); if(isNaN(d)) return NaN; return o == null ? +FMT_H.format(d) % 24 : new Date(d.getTime() + o).getUTCHours(); };
// impression d'une fiche (une seule fonction pour tous les onglets)
const printHTML = (html, prep) => { const p = document.createElement('div'); p.id = 'secprint'; p.innerHTML = html; if(prep) prep(p); document.body.appendChild(p); document.body.classList.add('printing-sec'); window.print(); setTimeout(() => { p.remove(); document.body.classList.remove('printing-sec'); }, 800); };
const dur = s => { s=+s||0; const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+'h':'')+(h||m?String(m).padStart(h?2:1,'0')+'m':'')+String(x).padStart(h||m?2:1,'0')+'s'; };
const nf = n => (+n).toLocaleString('fr-CA');
const pct = (a,b) => b ? Math.round(100*a/b)+' %' : '–';
const phone = p => { const d=String(p||'').replace(/^\+?1(?=\d{10}$)/,''); return /^\d{10}$/.test(d)? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : (p||''); };

const ST = {ans:['Répondu','ok'],vm:['Messagerie','warn'],fwd_ok:['Renvoyé ext. (répondu)','acc'],fwd_no:['Renvoyé ext. (sans rép.)','bad'],park_ab:['Raccroché en parking','bad'],bridge:['Vers autre 3CX (bridge)',''],q_ab:['Abandon en file','bad'],ivr_ab:['Raccroché au menu','warn'],miss:['Non répondu','bad'],transit:['Transit depuis un autre 3CX','']};
const stHTML = c => { const s=ST[c[10]]||['?','']; return c[10]==='ans'?dnLink(c[6]):`<span class="pill ${s[1]}">${s[0]}</span>`; };
