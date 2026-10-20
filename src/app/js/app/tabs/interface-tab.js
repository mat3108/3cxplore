// ---------- Interface : thèmes prêts à l'emploi et options d'affichage ----------
V.interface = el => {
  let A = window.loadAppearance();
  let theme = 'auto'; try{ theme = localStorage.getItem('theme3cx') || 'auto'; }catch(e){}
  const mini = document.body.classList.contains('mini');
  const save = () => { try{ localStorage.setItem('apparence3cx', JSON.stringify(A)); }catch(e){} window.applyAppearance(A); V.interface(el); };
  const radios = (name, cur, opts) => `<div class="uiopts">${opts.map(([k, l, extra]) => `<label class="uiopt${cur === k ? ' on' : ''}"><input type="radio" name="${name}" value="${k}"${cur === k ? ' checked' : ''}>${extra || ''}${esc(l)}</label>`).join('')}</div>`;
  const opt = (title, body, note) => `<div class="card"><h3 style="margin-top:0">${title}</h3>${body}${note ? `<p class="muted" style="font-size:12.5px;margin-bottom:0">${note}</p>` : ''}</div>`;
  const preset = A.preset || 'classique', cur = (A.accent || '').toLowerCase();
  const sw = (p, mode) => { const c = (mode === 'd' ? p[4] : p[3]) || (mode === 'd' ? {bg: '#0f1216', panel: '#171b21', accent: '#6b9cff', text: '#e6e9ee', line: '#2a3039'} : {bg: '#f6f7f9', panel: '#ffffff', accent: '#2563eb', text: '#1b1f24', line: '#e2e6eb'});
    return `<span class="pvmini" style="background:${c.bg};border-color:${c.line}"><i style="background:${c.panel};border-color:${c.line}"><b style="background:${c.accent}"></b><u style="background:${c.text}"></u></i></span>`; };
  el.innerHTML = `<div id="uiwrap"><h2>Interface</h2><p><button class="btn" data-tour="1">Relancer la visite guidée</button> <label class="tourtgl" title="Lancer la visite guidée à chaque ouverture d'un backup"><input type="checkbox" class="tourauto"${(() => { try{ return localStorage.getItem('visiteauto3cx') === '1' ? ' checked' : ''; }catch(e){ return ''; } })()}> Visite guidée à l'ouverture du backup</label></p>
    <p class="lead">Personnalisez l'apparence : un thème prêt à l'emploi, puis les détails (couleur, densité, texte, coins, cartes, police, largeur, menu, onglet d'accueil, animations). Tout s'applique tout de suite, est mémorisé dans ce navigateur et inclus dans la Sauvegarde des réglages. Les rapports imprimés gardent leurs couleurs habituelles.</p>
    <h3>Menu</h3>
    <div class="grid two" style="margin-top:10px">
      ${opt('Menu de gauche', radios('uinh', A.navShow === 'on' ? 'on' : 'off', [['off', 'Caché, le bouton Menu l\'ouvre'], ['on', 'Toujours affiché']]), 'Caché : l\'accueil montre l\'assistant et le bouton « Menu », en haut à gauche, ouvre le menu par-dessus la page.')}
      ${opt('Mises à jour', radios('uiupd', window.UPD && !window.UPD.on() ? 'off' : 'on', [['on', 'Vérifier au démarrage'], ['off', 'Ne pas vérifier']]), 'Le bouton de téléchargement du bandeau du haut permet de vérifier à tout moment et d\'installer l\'application. Au démarrage (au plus une fois par jour), 3CXplore demande à GitHub le numéro de la dernière version publiée et affiche un bandeau si une mise à jour existe. C\'est la seule requête Internet de l\'outil : aucune donnée du backup n\'est envoyée.')}
      ${opt('Compteurs du menu', radios('uinc', A.navCount === 'off' ? 'off' : 'on', [['on', 'Affichés'], ['off', 'Masqués']]))}
      ${opt('Espacement du menu', radios('uins', A.navSpace === 'serre' ? 'serre' : 'confort', [['confort', 'Confortable'], ['serre', 'Serré']]))}
    </div>
    <h3>Thèmes modernes et raffinés</h3>
    <p class="muted" style="font-size:12.5px;margin-top:-4px">Finition soignée : bordures légères, ombres douces, bandeau translucide, cartes qui se soulèvent au survol, typographie ajustée et chiffres alignés.</p>
    <div class="pvgrid">${APP_PRESETS.filter(p => /^raffine/.test(p[6] || '')).map(p => `<button class="card pvcard rafcard${preset === p[0] ? ' on' : ''}" data-preset="${p[0]}" type="button"><span class="pvsw">${sw(p, 'l')}${sw(p, 'd')}</span><b${p[6] === 'raffine-serif' ? ' style="font-family:ui-serif,Georgia,serif"' : ''}>${esc(p[1])}</b><span class="muted" style="font-size:12px">${esc(p[2])}</span></button>`).join('')}</div>
    <h3>Thèmes geek (refonte complète)</h3>
    <p class="muted" style="font-size:12.5px;margin-top:-4px">Police à chasse fixe, titres de terminal, boutons [ entre crochets ], étiquettes [OK], menu en arborescence, néon, grille et lignes de balayage. Les rapports imprimés gardent leur mise en page habituelle.</p>
    <div class="pvgrid">${APP_PRESETS.filter(p => p[6] === 'geek').map(p => `<button class="card pvcard geekcard${preset === p[0] ? ' on' : ''}" data-preset="${p[0]}" type="button" style="background:${p[3].bg};color:${p[3].text};border-color:${p[3].line}"><span class="pvgeek" style="color:${p[3].accent};text-shadow:0 0 6px ${p[3].accent}">&gt; ${esc(p[1].toUpperCase())}_</span><span style="font:11.5px ui-monospace,Menlo,monospace;color:${p[3].muted}">$ ./3cxplore --theme ${p[0]}</span><span style="font-size:12px;color:${p[3].text}">${esc(p[2])}</span><span class="pvdots">${['accent', 'ok', 'warn', 'bad', 'c-out'].map(k => `<i style="background:${p[3][k]};box-shadow:0 0 6px ${p[3][k]}"></i>`).join('')}</span></button>`).join('')}</div>
    <h3>Thèmes classiques</h3>
    <div class="pvgrid">${APP_PRESETS.filter(p => !p[6]).map(p => `<button class="card pvcard${preset === p[0] ? ' on' : ''}" data-preset="${p[0]}" type="button"><span class="pvsw">${sw(p, 'l')}${sw(p, 'd')}</span><b>${esc(p[1])}</b><span class="muted" style="font-size:12px">${esc(p[2])}</span></button>`).join('')}</div>
    <p class="muted" style="font-size:12.5px">Chaque thème a une version claire et une version sombre (aperçus ci-dessus) ; le mode affiché suit le réglage « Mode » ci-dessous.</p>
    <div class="grid two">
      ${opt('Mode', radios('uith', theme, [['light', 'Clair', '<span class="uisw th-light"></span>'], ['dark', 'Sombre', '<span class="uisw th-dark"></span>'], ['auto', 'Automatique', '<span class="uisw th-auto"></span>']]), 'Automatique : suit le réglage clair ou sombre de l\'ordinateur.')}
      ${opt('Couleur principale', `<div class="uicols"><button class="uicol uidef${cur ? '' : ' on'}" data-c="" title="Celle du thème" aria-label="Couleur du thème">✓</button>${APP_ACCENTS.map(([k, l, c]) => `<button class="uicol${cur === c ? ' on' : ''}" data-c="${c}" title="${esc(l)}" aria-label="${esc(l)}" style="background:${c}"></button>`).join('')}
        <label class="uicust${cur && !APP_ACCENTS.some(x => x[2] === cur) ? ' on' : ''}" title="Couleur au choix"><input type="color" id="uicc" value="${esc(cur || '#2563eb')}"> Autre</label></div>`, 'La première pastille garde la couleur du thème choisi.')}
      ${opt('Densité', radios('uide', A.density || 'normal', [['normal', 'Normale'], ['compact', 'Compacte']]), 'Compacte : tableaux et cartes plus serrés.')}
      ${opt('Taille du texte', radios('uisz', A.size || 'm', [['s', 'Petite'], ['m', 'Normale'], ['l', 'Grande'], ['xl', 'Très grande']]))}
      ${opt('Coins', radios('uira', A.radius || 'arrondi', [['carre', 'Carrés'], ['arrondi', 'Arrondis'], ['doux', 'Très arrondis']]))}
      ${opt('Cartes', radios('uica', A.cards || 'ombre', [['ombre', 'Avec ombre'], ['bordure', 'Bordure seule'], ['plat', 'Plates']]))}
      ${opt('Police', radios('uifo', A.font || 'systeme', [['systeme', 'Système'], ['arrondie', 'Arrondie'], ['serif', 'À empattements'], ['mono', 'Chasse fixe']]), 'Selon les polices installées sur l\'ordinateur.')}
      ${opt('Largeur du contenu', radios('uiwi', A.width || 'centre', [['centre', 'Centrée (1500 px max.)'], ['large', 'Pleine largeur']]), 'Pleine largeur : utile sur un grand écran.')}
      ${opt('Menu latéral', radios('uinv', mini ? 'reduit' : 'etendu', [['etendu', 'Étendu'], ['reduit', 'Réduit (icônes)']]), 'Conservé au prochain démarrage (comme le bouton « Réduire le menu »).')}
      ${opt('Onglet d\'accueil', `<select id="uiho">${APP_HOMES.map(([k, l]) => `<option value="${k}"${(A.home || 'accueil') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, 'Onglet affiché à l\'ouverture de l\'interface (sans lien direct vers un autre onglet).')}
      ${opt('Animations', radios('uimo', A.motion || 'normal', [['normal', 'Normales'], ['reduit', 'Réduites']]), 'Réduites : aucune transition ni animation (confort visuel), curseur fixe.')}
      ${opt('Effets rétro (thèmes geek)', radios('uisc', A.scan === 'off' ? 'off' : 'on', [['on', 'Grille et lignes de balayage'], ['off', 'Sans lignes de balayage']]), 'Effet d\'écran cathodique ; sans effet sur les thèmes classiques.')}
    </div>
    <h3>Aperçu</h3>
    <div class="card uiprev">
      <div class="bar" style="margin:0 0 10px"><button class="btn primary" type="button">Bouton principal</button><button class="btn" type="button">Bouton</button><a class="dlink" href="#interface">Un lien</a>
        <span class="pill ok">Bonne</span><span class="pill warn">À vérifier</span><span class="pill bad">Appel perdu</span><span class="pill acc">Information</span></div>
      <div class="grid kpis">${[['Appels entrants', '26 793', ''], ['Taux de réponse', '82,8 %', 'ok'], ['Appels perdus', '17,2 %', 'bad']].map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      <div class="tw" style="margin-top:10px"><table><thead><tr><th>Magasin</th><th class="num">Appels</th><th>Note</th></tr></thead><tbody>
        ${[['AB', 4503, 94], ['CD', 7988, 89], ['EF', 3127, 71]].map(([s, n, h]) => `<tr><td><a class="dlink" href="#interface">${s}</a></td><td class="num">${nf(n)}</td><td><div class="hsbar" style="max-width:220px"><i style="width:${h}%;background:var(--accent)"></i></div></td></tr>`).join('')}</tbody></table></div></div>
    <p><button class="btn" id="uireset" title="Graphite en mode sombre, menu Dégradé, groupes repliables, compteurs affichés, espacement confortable">Revenir aux réglages par défaut</button></p></div>`;
  const W = $('#uiwrap'), set = (k, v) => { A[k] = v; save(); };
  W.addEventListener('change', e => {
    const t = e.target;
    if(t.name === 'uith'){ window.applyTheme(t.value === 'auto' ? '' : t.value); V.interface(el); return; }
    if(t.name === 'uiupd'){ try{ localStorage.setItem('maj3cx', t.value); }catch(er){} if(t.value === 'off'){ const b = $('#updbar'); if(b) b.hidden = true; } V.interface(el); return; }
    if(t.name === 'uinv'){ document.body.classList.toggle('mini', t.value === 'reduit'); try{ localStorage.setItem('nav3cx', t.value === 'reduit' ? 'mini' : ''); }catch(er){} V.interface(el); return; }
    const map = {uide: 'density', uisz: 'size', uira: 'radius', uica: 'cards', uifo: 'font', uiwi: 'width', uimo: 'motion', uisc: 'scan', uinf: 'navFold', uinc: 'navCount', uinh: 'navShow', uins: 'navSpace'};
    if(map[t.name]) return set(map[t.name], t.value);
    if(t.id === 'uiho') return set('home', t.value);
    if(t.id === 'uicc') return set('accent', t.value);
  });
  W.addEventListener('click', e => {
    const pv = e.target.closest('[data-preset]');
    if(pv){ const p = APP_PRESETS.find(x => x[0] === pv.dataset.preset); A.preset = p[0]; delete A.accent; if(p[5]) window.applyTheme(p[5]); return save(); }
    const b = e.target.closest('.uicol'); if(b){ if(b.dataset.c) A.accent = b.dataset.c; else delete A.accent; return save(); }
    if(e.target.id === 'uireset'){ A = {...window.APP_DEFAULT}; try{ localStorage.setItem('apparence3cx', JSON.stringify(A)); localStorage.setItem('nav3cx', ''); }catch(er){} document.body.classList.remove('mini'); window.applyTheme('dark'); window.applyAppearance(A); V.interface(el); }
  });
};

