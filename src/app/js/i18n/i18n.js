// ---------- Langue de l'interface (14.0, tout le contenu depuis 15.0) : français ou anglais ----------
// La page est écrite en français ; en anglais, les textes affichés sont traduits au vol à partir du dictionnaire ci-dessous
// (menu, bandeau, chargement, mises à jour, Interface et onglets principaux). Un texte absent du dictionnaire reste en français.
// Les données du backup ne passent jamais par le dictionnaire : seuls les textes de l'outil y figurent.
(() => {
const KEY = 'langue3cx';
let lang = ''; try{ lang = localStorage.getItem(KEY) || ''; }catch(e){}
if(lang !== 'fr' && lang !== 'en') lang = /^fr\b/i.test(navigator.language || 'fr') ? 'fr' : 'en';
document.documentElement.lang = lang;
//#include en-dictionary.js
// textes composés (nombres, dates) : expressions régulières ; t() traduit la partie texte
const t = s => EN[s] !== undefined ? EN[s] : null;
// gabarits à trous (14.0.1) : ¤ = valeur insérée par l'outil (nombre, nom, pluriel…) ; {1}, {2}… = ces valeurs dans le texte anglais
//#include en-templates.js
const rxEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
// chaque trou : « pl » s'il colle à un mot (marque du pluriel : vide ou s), « num » s'il ouvre la phrase (un nombre, sauf texte fixe assez long)
const TPLC = TPL.map(([fr, en]) => { const seg = fr.split('¤'), lits = seg.map(x => x.trim()).filter(Boolean), litLen = lits.join('').replace(/\s/g, '').length;
  const holes = seg.slice(0, -1).map((x, i) => /[A-Za-zÀ-ÿ)]$/.test(x) ? 'pl' : i === 0 && x === '' && litLen < 12 ? 'num' : '');
  return {key: lits.reduce((a, b) => b.length > a.length ? b : a, ''), re: new RegExp('^' + seg.map((x, i) => rxEsc(x) + (i < holes.length ? (holes[i] === 'pl' ? '(s|x|es)?' : '(.*?)') : '')).join('') + '$'), re2: holes.includes('pl') ? new RegExp('^' + seg.map(rxEsc).join('(.*?)') + '$') : null, en, holes, litLen}; });
const NUMISH = /^[\d\s\u202f.,%()+\-–:hs]*$/, DAYW = /^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)$/;
// jours fériés du Québec et moments clés (contrôle des SDA) : noms fournis par l'outil
const HOL = {"Jour de l'An": "New Year's Day", "Vendredi saint": "Good Friday", "Lundi de Pâques": "Easter Monday", "Journée nationale des patriotes": "National Patriots' Day",
  "Fête nationale": "Quebec National Holiday", "Fête du Canada": "Canada Day", "Fête du travail": "Labour Day", "Action de grâce": "Thanksgiving", "Noël": "Christmas", "Lendemain de Noël": "Boxing Day"};
const MOM = {"Semaine 10 h": "Weekday 10 am", "Midi": "Noon", "Soir 20 h 30": "Evening 8:30 pm", "Nuit 2 h": "Night 2 am", "Samedi 11 h": "Saturday 11 am", "Dimanche 11 h": "Sunday 11 am"};
Object.assign(EN, HOL, MOM);
const HOLRE = new RegExp('(' + Object.keys(HOL).sort((a, b) => b.length - a.length).map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?= \\(?\\d{2,4}-)', 'g');
// valeur insérée : traduite telle quelle, sinon élément par élément s'il s'agit d'une liste (« A 3 · B 2 », « X (date), Y (date) »)
const item = x => { const v = core(x); if(v) return v; const p = x.match(/^([—➜]\s*)?(.*)$/), m = p[2].match(/^(.*?)(\s*\([^()]*\)|\s+[\d\s\u202f.,%:\/-]+(?:\s?h)?)$/); if(m && m[1]){ const w = core(m[1].trim()); if(w) return (p[1] || '') + w + m[2]; } return null; };
function list(x, strict){ const parts = x.split(/( · |, | ; )/); if(parts.length < 3) return null; let n = 0, k = 0;
  const out = parts.map((p, i) => { if(i % 2) return p; k++; const v = item(p.trim()); if(v){ n++; return v; } return p; });
  return n && (!strict || n === k) ? out.join('') : null; }
const trCap = c => { const x = c.trim(); if(!x) return c; const v = core(x) || list(x, false); return v ? c.replace(x, () => v) : c; };
const TPLW = new Map(), TPL0 = []; TPLC.forEach((T, i) => { T.i = i; const w = (TPL[i][0].toLowerCase().match(/(?<![¤a-zà-ÿ'])[a-zà-ÿ']{4,}(?![¤a-zà-ÿ'])/g) || []).sort((a, b) => b.length - a.length)[0]; if(w) (TPLW.get(w) || TPLW.set(w, []).get(w)).push(T); else TPL0.push(T); });
const tplFor = k => { const seen = new Set(TPL0), out = [...TPL0]; for(const w of new Set(k.toLowerCase().match(/[a-zà-ÿ']{4,}/g) || [])) for(const T of TPLW.get(w) || []) if(!seen.has(T)){ seen.add(T); out.push(T); } return out.sort((a, b) => a.i - b.i); };
function tpl(k){ for(const T of tplFor(k)){ if(T.key && !k.includes(T.key)) continue; let loose = false, m = k.match(T.re); if(!m && T.re2){ m = k.match(T.re2); loose = true; } if(!m) continue;
  // gabarit court (« ¤ SDA », « ¤ poste¤ ») : seulement si les valeurs sont des nombres, sinon on traduirait à moitié un autre texte
  if(T.litLen < 8 && !m.slice(1).every(c => NUMISH.test(c || '') || DAYW.test(c))) continue;
  if(!T.holes.every((h, i) => h === 'pl' ? /^(s|x|es|)$/.test(m[i + 1] || '') || (loose && /^\s/.test(m[i + 1])) : h === 'num' ? (/\d/.test(m[i + 1]) && NUMISH.test(m[i + 1])) || DAYW.test(m[i + 1]) : true)) continue;
  return T.en.replace(/\{(\d+)\}/g, (_, i) => trCap(m[+i] || '')); } return null; }
const DAYS = {Lun: 'Mon', Mar: 'Tue', Mer: 'Wed', Jeu: 'Thu', Ven: 'Fri', Sam: 'Sat', Dim: 'Sun'};
const RX = [
  [/^(?:(?:Lun|Mar|Mer|Jeu|Ven|Sam|Dim)(?:–|, |$))+$/, m => m[0].replace(/Lun|Mar|Mer|Jeu|Ven|Sam|Dim/g, d => DAYS[d])],
  [/^(.+?) — (\d+) %$/, m => t(m[1]) && t(m[1]) + ' — ' + m[2] + ' %'],
  [/^Erreur : (.+)$/, m => 'Error: ' + (t(m[1]) || m[1])],
  [/^Version ([\d.]+) \(actuelle\)$/, m => 'Version ' + m[1] + ' (current)'],
  [/^([\d\s ]+) éléments?$/, m => m[1] + ' items'],
  [/^([\d\s ]+) acheminements?$/, m => m[1] + ' routing' + (m[1].trim() === '1' ? '' : 's')],
  [/^([\d\s ]+) critiques?$/, m => m[1] + ' critical'], [/^([\d\s ]+) observations?$/, m => m[1] + ' observation' + (m[1].trim() === '1' ? '' : 's')],
  [/^([\d\s ]+) à corriger$/, m => m[1] + ' to fix'], [/^([\d\s ]+) firmwares? effacés?$/, m => m[1] + ' firmware cleared'],
  [/^\+([\d\s ]+) autres?$/, m => '+' + m[1] + ' more'], [/^(\d+) derniers jours$/, m => 'Last ' + m[1] + ' days'],
  [/^\((\d+) derniers jours avec activité\)$/, m => '(last ' + m[1] + ' days with activity)'], [/^\(objectif (.+)\)$/, m => '(target ' + m[1] + ')'], [/^\(toutes les (\d+) s\)$/, m => '(every ' + m[1] + ' s)'],
  [/^(\d+)h – répondus : (.+)$/, m => m[1] + 'h – answered: ' + m[2]], [/^(\d+)h – non répondus : (.+)$/, m => m[1] + 'h – unanswered: ' + m[2]],
  [/^Surveillé par (\d+) téléphones?$/, m => 'Monitored by ' + m[1] + ' phone' + (m[1] === '1' ? '' : 's')], [/^Liste du (.+)$/, m => 'List of ' + m[1]],
  [/^Les plus faibles : (.+)$/, m => 'Weakest: ' + m[1]], [/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim) (fermé)$/, m => DAYS[m[1]] + ' closed'], [/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim) (\d[^·]*)$/, m => DAYS[m[1]] + ' ' + m[2]],
  [/^Inactifs? > (\d+) (jours|j)$/, m => 'Inactive > ' + m[1] + (m[2] === 'j' ? ' d' : ' days')], [/^Inactif \((\d+) j\)$/, m => 'Inactive (' + m[1] + ' d)'], [/^(\d+) jours$/, m => m[1] + ' days'],
  [/^vu le (.+)$/, m => 'seen on ' + m[1]],
  [/^dont ([\d ]+) vers un autre 3CX$/, m => 'incl. ' + m[1] + ' to another 3CX'], [/^([\d ]+) sur ([\d ]+) appels de clients$/, m => m[1] + ' of ' + m[2] + ' customer calls'],
  [/^([\d ]+) servis sur ([\d ]+) appels en file$/, m => m[1] + ' served of ' + m[2] + ' queue calls'], [/^\(([\d ]+) appels de clients\)$/, m => '(' + m[1] + ' customer calls)'],
  [/^Hors pourcentages : ([\d ]+) appels envoyés vers un autre 3CX \(bridge\), traités sur l'autre système\.$/, m => 'Not in the percentages: ' + m[1] + ' calls sent to another 3CX (bridge), handled on the other system.'],
  [/^postes (.+) : relancer « Mettre à jour le firmware »$/, m => 'extensions ' + m[1] + ': run “Update firmware” again'],
  [/^(.*) · backup du (.+?) · appels du (.+?) au (.+)$/, m => m[1] + ' · backup of ' + m[2] + ' · calls from ' + m[3] + ' to ' + m[4]],
  [/(Jour de l'An|Vendredi saint|Lundi de Pâques|Journée nationale des patriotes|Fête nationale|Fête du Canada|Fête du travail|Action de grâce|Lendemain de Noël|Noël)(?= \(?\d{4}-)/, m => m.input.replace(/(Jour de l'An|Vendredi saint|Lundi de Pâques|Journée nationale des patriotes|Fête nationale|Fête du Canada|Fête du travail|Action de grâce|Lendemain de Noël|Noël)(?= \(?\d{4}-)/g, h => HOL[h])],
  [/^(Poste|File) (\d+) (.+)$/, m => (m[1] === 'Poste' ? 'Extension ' : 'Queue ') + m[2] + ' ' + m[3]],
  [/^(File d'attente|Groupe de sonnerie|Standard \(IVR\)|Département|Messagerie vocale|Règle entrante|Numéro externe) — (.*)$/, m => t(m[1]) + ' — ' + trCap(m[2])],
  [/^(Taux de réponse|Appels perdus|Attente moyenne en file|Taux de réponse en file \(agents\)) : (.*?) — objectif (.*?) :$/, m => t(m[1]) + ': ' + m[2] + ' — target ' + m[3] + ':'], [/^➜ (.+)$/, m => { const v = core(m[1]); return v ? '➜ ' + v : null; }], [/^(.+) 10 h$/, m => HOL[m[1]] ? HOL[m[1]] + ' 10 am' : null], [/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)–(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)( [^·]*)?$/, m => DAYS[m[1]] + '–' + DAYS[m[2]] + (m[3] ? ' ' + (trCap(m[3].trim())) : '')], [/^avec (.+)$/, m => 'with ' + m[1]],
  [/^Historique analysé : du (.+) au (.+)\.$/, m => 'History analysed: ' + m[1] + ' to ' + m[2] + '.'],
  [/^« Jamais utilisé » : aucun appel passé, reçu ou répondu sur toute la période de l'historique\. .*$/, m => "“Never used”: no call made, received or answered over the whole history. “Still in a routing”: the extension is unused or disabled, but a menu, queue, ring group, DID, forward or a colleague's BLF key still points to it (department membership alone does not count): calls may get lost there. “Phone never seen”: the phone's MAC address does not appear in any call quality report" + (/non vérifié/.test(m[0]) ? ' (not checked: no quality reports in this backup)' : '') + '; it may be unplugged or never installed. Check before deleting: an extension may be used rarely (substitute, meeting room, door phone) or have been created recently.'],
  [/^3CX (\S+) · sauvegarde du (.+?)(?: · chargé le (.+?))?(?: · (\d+) Mo)?$/, m => '3CX ' + m[1] + ' · backup of ' + m[2] + (m[3] ? ' · loaded on ' + m[3] : '') + (m[4] ? ' · ' + m[4] + ' MB' : '')],
  [/^· (Taux de réponse|Appels perdus|Attente moyenne en file|Taux de réponse en file \(agents\)) (.+)$/, m => '· ' + t(m[1]) + ' ' + m[2]],
  [/^Appel du (\S+) (\d+) h (\d+)$/, m => 'Call on ' + m[1] + ' ' + m[2] + ':' + m[3]],
  [/^Clients qui ont appelé sans obtenir de réponse .* jusqu'à la fin de l'historique du backup \((.+)\)\.$/, m => "Customers who called without getting an answer (abandoned in queue, hung up in menu, unanswered, external forward not answered, hung up while parked) and have not been called back since. A customer counts as “called back” if an outbound call was made to their number after their last missed call, or if they called back themselves and were served. Withheld numbers are ignored. The period applies to the date of the last missed call; the call-back is searched up to the end of the backup history (" + m[1] + ")."],
  [/^Téléphones de bureau rattachés à un poste jamais utilisé, inactif depuis plus de (\d+) jours ou désactivé : ils peuvent être récupérés ou donnés à un autre employé\.$/, m => 'Desk phones attached to an extension that was never used, inactive for more than ' + m[1] + ' days or disabled: they can be recovered or given to another employee.'],
  [/^Postes qui pourraient être supprimés ou réattribués .*Historique analysé : du (.+) au (.+)\.$/, m => "Extensions that could be deleted or reassigned (never used, inactive, duplicates, “vacant” or “test”, disabled), desk phones to recover, and peak concurrent calls. 3CX V20 is licensed by simultaneous calls (not per extension): deleting unneeded extensions simplifies management and frees any Microsoft 365 accounts, but the peak of simultaneous calls sets the licence size. History analysed: " + m[1] + ' to ' + m[2] + '.'],
  [/^(.+?) ([\d\s\u202f.,%]+)$/, m => { const v = t(m[1]) || tpl(m[1]); return v ? v + ' ' + m[2] : null; }],
  [/^(.+?) : ([\d\s\u202f.,%]+)$/, m => { const v = t(m[1]) || tpl(m[1]); return v ? v + ': ' + m[2] : null; }],
  [/^(.*) \(([\d\s\u202f]+) (postes?|rôles?)\)$/, m => m[1] + ' (' + m[2] + (m[3][0] === 'p' ? (m[2].trim() === '1' ? ' extension' : ' extensions') : (m[2].trim() === '1' ? ' role' : ' roles')) + ')'],
  [/ appels \/ (\d+) j\)/, m => m.input.replace(/ appels \/ (\d+) j\)/g, ' calls / $1 d)')],
  [/^(.+?) · (.+)$/, m => { if(core.inList) return null; const a = trCap(m[1]), b = trCap(m[2]); return a !== m[1] || b !== m[2] ? a + ' · ' + b : null; }],
  [/^(.+?) : (.+, .+)$/, m => { const a = t(m[1]), b = a && list(m[2], true); return b ? a + ': ' + b : null; }],
  [/^(\d+)\. (.+)$/, m => { const v = t(m[2]) || tpl(m[2]); return v ? m[1] + '. ' + v : null; }],
  [/^([A-ZÀ-Ý'’ ()]{3,}?)( · .*)?$/, m => { const U = core.up ||= Object.fromEntries(Object.entries(EN).map(([k, v]) => [k.toUpperCase(), v.toUpperCase()])); const v = U[m[1].trim()]; return v ? v + (m[2] ? ' · ' + trCap(m[2].slice(3)) : '') : null; }],
  // libellé suivi d'un nombre entre parenthèses, d'une flèche ou de deux-points
  [/^(.+?) \(([\d\s ]+)\)$/, m => t(m[1]) && t(m[1]) + ' (' + m[2] + ')'], [/^(.+?) ([▸→])$/, m => t(m[1]) && t(m[1]) + ' ' + m[2]],
  [/^(.+?) :$/, m => t(m[1]) && t(m[1]) + ':'], [/^(.+?)…$/, m => t(m[1]) && t(m[1]) + '…'],
];
function core(k){
  let v = t(k); if(v === null) v = tpl(k);
  if(v === null) for(const [re, f] of RX){ const m = k.match(re); if(m){ v = f(m); if(v) break; v = null; } }
  if(v === null && !core.inList){ core.inList = true; try{ v = list(k, true); }finally{ core.inList = false; } }
  return v;
}
function tr(s){
  const k = s.replace(/\s+/g, ' ').trim(); if(!k || k.length > 6000 || !/[A-Za-zÀ-ÿ]/.test(k)) return null;
  let v = core(k); { const x = v || k, y = x.replace(HOLRE, h => HOL[h]); if(y !== x) v = y; }
  if(!v || v === k) return null; // identique dans les deux langues : ne rien réécrire (sinon l'observateur reboucle)
  const out = s.replace(/\S[\s\S]*\S|\S/, () => v); return out === s ? null : out;
}
const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/, ATTRS = ['title', 'placeholder', 'aria-label'];
function trEl(e){ if(e.closest('[data-noi18n]')) return; for(const a of ATTRS){ const v = e.getAttribute(a); if(v){ const x = tr(v); if(x) e.setAttribute(a, x); } } }
function walk(root){
  if(root.nodeType === 3){ const p = root.parentElement; if(p && !SKIP.test(p.tagName) && !p.closest('[data-noi18n]')){ const x = tr(root.nodeValue); if(x) root.nodeValue = x; } return; }
  if(root.nodeType !== 1 || SKIP.test(root.tagName) || root.closest('[data-noi18n]')) return;
  trEl(root); root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(trEl);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){ const p = n.parentElement; if(!p || SKIP.test(p.tagName) || p.closest('[data-noi18n]')) continue; const x = tr(n.nodeValue); if(x) n.nodeValue = x; }
}
if(lang === 'en'){
  new MutationObserver(ms => { for(const m of ms){
    if(m.type === 'characterData') walk(m.target);
    else if(m.type === 'attributes') trEl(m.target);
    else m.addedNodes.forEach(walk); } }).observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  document.addEventListener('DOMContentLoaded', () => walk(document.body));
}
// bouton FR / EN du bandeau : change de langue et recharge la page (le backup ouvert est conservé)
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#langbtn'); if(!b) return;
  try{ localStorage.setItem(KEY, lang === 'en' ? 'fr' : 'en'); }catch(er){} location.reload(); });
document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('langbtn'); if(!b) return;
  b.querySelector('.lb').textContent = lang === 'en' ? 'FR' : 'EN'; b.title = b.ariaLabel = lang === 'en' ? 'Afficher en français' : 'Show in English'; });
window.LANG = {lang, tr: s => tr(s) || s};
})();
