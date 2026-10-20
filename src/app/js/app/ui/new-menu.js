// ---------- Nouveau menu (18.0, bêta) : organisé par question ; activé par l'interrupteur du menu, l'ancien menu simplifié reste celui par défaut ----------
const NAVBETA_KEY = 'menubeta3cx';
const NAV_SETS_BETA = {
  corriger: ['À corriger', 'priorites', ['priorites', 'reco', 'sante', 'actions', 'pieges', 'doublons', 'controle', 'sdainut', 'recobv']],
  appels: ['Nos appels', 'appels', ['rappels', 'rappellent', 'numero', 'client', 'vip', 'appels', 'delai', 'receptions', 'courts', 'parkings']],
  equipes: ['Nos équipes', 'employe', ['employe', 'corrections', 'agents', 'occupation', 'indisp', 'absences', 'effectif', 'prevision', 'nouvel', 'depart', 'historique']],
  magasin: ['Mon magasin', 'fichemag', ['fichemag', 'rapport', 'deptrap', 'horaires', 'feries', 'ouvmag']],
  stats: ['Statistiques', 'stats', ['stats', 'statsfiles', 'provenance', 'destinations', 'couts', 'internes', 'qualite', 'menus']],
  comparer: ['Comparer', 'classement', ['classement', 'cmpmag', 'suivi', 'comparaison', 'avantapres']],
  parcours: ['Parcours des appels', 'flux', ['simulateur', 'diagramme', 'flux', 'groupes', 'organigramme', 'ivr', 'sonnerie', 'files', 'pkplan']],
  postes: ['Postes et téléphones', 'postes', ['postes', 'telephones', 'blf', 'blfmodele', 'licences', 'annuaire']],
  lignes: ['Lignes et numéros', 'trunks', ['trunks', 'sortant', 'numerotation']],
  vocal: ['Messagerie et enregistrements', 'audio', ['messageries', 'audio', 'enreg']],
  securite: ['Sécurité et droits', 'securite', ['securite', 'renvois', 'suspects', 'visibilite', 'droits', 'comparer']],
  changements: ['Historique des changements', 'modifs', ['modifs', 'audit']],
  reglages: ['Réglages', 'reglages', ['objectifs', 'magasins', 'interface', 'reglages', 'params']],
};
const NAV2_BETA = [
  ['Au quotidien', ['dashboard', '@corriger', '@appels', '@equipes', '@magasin']],
  ['Analyser', ['@stats', '@comparer', '@parcours']],
  ['Technique', ['@postes', '@lignes', '@vocal', '@securite', '@changements', '@reglages']],
];
const NAV_SETS_STD = {...NAV_SETS}, NAV2_STD = NAV2.slice();
const navBeta = () => { try{ return localStorage.getItem(NAVBETA_KEY) === '1'; }catch(e){ return false; } };
// remplace le contenu du menu simplifié (mêmes objets, utilisés partout : sous-onglets, recherche, surlignage)
function navApply(){
  const b = navBeta(), S = b ? NAV_SETS_BETA : NAV_SETS_STD, G = b ? NAV2_BETA : NAV2_STD;
  Object.keys(NAV_SETS).forEach(k => delete NAV_SETS[k]); Object.assign(NAV_SETS, S); NAV2.length = 0; G.forEach(x => NAV2.push(x));
  Object.keys(SET_OF).forEach(k => delete SET_OF[k]); Object.entries(NAV_SETS).forEach(([id, [, , ms]]) => ms.forEach(k => SET_OF[k] = id));
}
navApply();
window.__app.navApply = navApply; // 18.1.29 : l'interrupteur (branché une seule fois) appelle le menu de l'affichage en cours
// dernier sous-onglet ouvert dans chaque entrée regroupée (mémorisé dans ce navigateur)
const NAVMODE_KEY = 'menumode3cx';
const navMode = () => { try{ return localStorage.getItem(NAVMODE_KEY) === 'expert' ? 'expert' : 'simple'; }catch(e){ return 'simple'; } };
const NAVLAST_KEY = 'menuepure3cx';
let NAVLAST = {}; try{ NAVLAST = JSON.parse(localStorage.getItem(NAVLAST_KEY) || '{}'); }catch(e){}
const navLast = id => { const ms = NAV_SETS[id][2].filter(k => TAB_BY[k]); return ms.includes(NAVLAST[id]) ? NAVLAST[id] : ms[0]; };
function subTabs(tab){
  const id = SET_OF[tab]; if(!id) return null;
  if(NAVLAST[id] !== tab){ NAVLAST[id] = tab; try{ localStorage.setItem(NAVLAST_KEY, JSON.stringify(NAVLAST)); }catch(e){}
    const a = document.querySelector(`#nav a[data-set="${id}"]`); if(a) a.setAttribute('href', '#' + tab); }
  const b = document.createElement('nav'); b.className = 'subtabs'; b.setAttribute('aria-label', NAV_SETS[id][0]);
  b.innerHTML = NAV_SETS[id][2].filter(k => TAB_BY[k]).map(k => { const [, l, n] = TAB_BY[k];
    return `<a href="#${k}"${k === tab ? ' class="on" aria-current="page"' : ''}>${navIcon(k)}<span>${esc(l)}</span>${n != null ? `<span class="n">${nf(n)}</span>` : ''}</a>`; }).join('');
  return b;
}
