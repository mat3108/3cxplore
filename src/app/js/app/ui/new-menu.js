// ---------- Sous-menus (20.0) : dernière page ouverte dans chaque rubrique, fil d'Ariane et sous-onglets en haut de la page ----------
// (le menu bêta de 18.0 et le choix Simplifié / Complet sont remplacés par le menu unique de simplified-menu.js)
const navColor = id => NAV_COLOR[id] || NAV_COLOR[SET_OF[id]] || (NAV_DO[id] ? NAV_COLOR.faire : 'var(--accent)');
const navLabel = k => NAV_DO[k] || (TAB_BY[k] ? TAB_BY[k][1] : k);
// rubrique (ou entrée directe) qui contient une page : [id, libellé, groupe]
function navPlace(tab){
  const id = SET_OF[tab]; if(id) return [id, NAV_SETS[id][0], (NAV2.find(([, ks]) => ks.includes('@' + id)) || [''])[0]];
  const g = NAV2.find(([, ks]) => ks.includes(tab)); return [tab, navLabel(tab), g ? g[0] : ''];
}
// dernière page ouverte dans chaque rubrique (mémorisée dans ce navigateur)
const NAVLAST_KEY = 'menuepure3cx';
let NAVLAST = {}; try{ NAVLAST = JSON.parse(localStorage.getItem(NAVLAST_KEY) || '{}'); }catch(e){}
const navLast = id => { const ms = NAV_SETS[id][2].filter(k => TAB_BY[k]); return ms.includes(NAVLAST[id]) ? NAVLAST[id] : ms[0]; };
function navRemember(tab){
  const id = SET_OF[tab]; if(!id || NAVLAST[id] === tab) return;
  NAVLAST[id] = tab; try{ localStorage.setItem(NAVLAST_KEY, JSON.stringify(NAVLAST)); }catch(e){}
  const a = document.querySelector(`#nav a[data-set="${id}"]`); if(a) a.setAttribute('href', '#' + tab);
}
// en haut de la page : « Rubrique › Page », puis les autres pages de la rubrique (affichées quand le sous-menu n'est pas visible : téléphone, menu réduit)
function subTabs(tab){
  if(tab === 'accueil') return null;
  const id = SET_OF[tab], [pid, pl] = navPlace(tab);
  const b = document.createElement('nav'); b.className = 'pagehead'; b.style.setProperty('--rc', navColor(pid)); b.setAttribute('aria-label', 'Vous êtes ici');
  const crumb = `<a href="#accueil" class="phhome">${navIcon('accueil')}<span>Accueil</span></a><span class="phsep" aria-hidden="true">›</span>`
    + (id ? `<a href="#${navLast(id)}" class="phset">${navIcon(NAV_SETS[id][1])}<span>${esc(pl)}</span></a><span class="phsep" aria-hidden="true">›</span>` : '')
    + `<span class="phcur" aria-current="page">${id ? '' : navIcon(tab)}${esc(navLabel(tab))}</span>`;
  b.innerHTML = `<div class="phcrumb">${crumb}</div>` + (id ? `<div class="subtabs">${NAV_SETS[id][2].filter(k => TAB_BY[k]).map(k => { const [, l, n] = TAB_BY[k];
    return `<a href="#${k}"${k === tab ? ' class="on" aria-current="page"' : ''}>${esc(l)}${n != null ? `<span class="n">${nf(n)}</span>` : ''}</a>`; }).join('')}</div>` : '');
  return b;
}
