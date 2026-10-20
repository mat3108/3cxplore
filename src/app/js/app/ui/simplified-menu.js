// ---------- Menu (20.0) : un seul menu, des rubriques qui s'ouvrent sur leurs pages (sous-menu), une couleur par rubrique ----------
// [libellé, icône (onglet dont on reprend l'icône), pages de la rubrique] ; les adresses des pages (#flux, #postes…) ne changent pas
const NAV_SETS = {
  reparer: ['À réparer', 'priorites', ['priorites', 'reco', 'sante', 'actions', 'corrections', 'pieges', 'doublons', 'controle', 'sdainut']],
  appels: ['Les appels', 'appels', ['appels', 'rappels', 'rappellent', 'numero', 'client', 'vip', 'delai', 'receptions', 'courts', 'parkings']],
  magasins: ['Les magasins', 'magasins', ['fichemag', 'rapport', 'deptrap', 'classement', 'cmpmag', 'objectifs', 'horaires', 'magasins']],
  personnes: ['Les personnes', 'employe', ['employe', 'annuaire', 'organigramme', 'agents', 'occupation', 'indisp', 'absences', 'historique']],
  postes: ['Postes, téléphones et lignes', 'telephones', ['postes', 'telephones', 'blf', 'blfmodele', 'licences', 'trunks', 'sortant', 'numerotation']],
  chemin: ['Le chemin des appels', 'flux', ['simulateur', 'diagramme', 'flux', 'ivr', 'menus', 'sonnerie', 'files', 'groupes', 'pkplan']],
  vocal: ['Messages vocaux', 'audio', ['messageries', 'recobv', 'audio', 'enreg']],
  securite: ['Sécurité et droits', 'securite', ['securite', 'renvois', 'suspects', 'visibilite', 'droits', 'comparer']],
  chiffres: ['Les chiffres', 'stats', ['stats', 'genrap', 'statsfiles', 'provenance', 'destinations', 'couts', 'internes', 'qualite', 'effectif', 'prevision']],
  historique: ['Ce qui a changé', 'modifs', ['modifs', 'audit', 'suivi', 'comparaison', 'avantapres']],
  reglages: ['Réglages', 'reglages', ['interface', 'reglages', 'params']],
};
const NAV2 = [
  ['Tous les jours', ['accueil', 'dashboard', '@reparer', '@appels', '@magasins']],
  ['Je veux…', ['nouvel', 'depart', 'ouvmag', 'feries']],
  ['Mon installation', ['@personnes', '@postes', '@chemin', '@vocal', '@securite']],
  ['Comprendre', ['@chiffres', '@historique']],
  ['Réglages', ['@reglages']],
];
const SET_OF = {}; Object.entries(NAV_SETS).forEach(([id, [, , ms]]) => ms.forEach(k => SET_OF[k] = id));
// couleur de chaque rubrique : la même dans le menu, le fil d'Ariane, les sous-onglets et les tuiles de l'accueil
const NAV_COLOR = {accueil: '#0b6bcb', dashboard: '#0b6bcb', reparer: '#d93d42', appels: '#2f7fd6', magasins: '#b07d06', personnes: '#a144b3', postes: '#2f8f46',
  chemin: '#6650c8', vocal: '#0e8a7c', securite: '#5b6b7f', chiffres: '#d9590b', historique: '#97704f', reglages: '#6b7280', autre: '#6b7280', faire: '#0b6bcb'};
// ce que l'on trouve dans chaque rubrique, en une phrase (bulle du menu et tuiles de l'accueil)
const NAV_HINT = {
  reparer: 'Ce qui ne va pas, du plus urgent au moins urgent, et comment le corriger.',
  appels: 'Qui a appelé, qui n\'a pas eu de réponse, et combien de temps on attend.',
  magasins: 'La fiche, le rapport et le classement de chaque magasin.',
  personnes: 'Les employés, l\'annuaire, l\'organigramme et les absences.',
  postes: 'Les postes, les téléphones de bureau, leurs touches et les lignes vers l\'extérieur.',
  chemin: 'Par où passe un appel : menus vocaux, files d\'attente et groupes qui sonnent.',
  vocal: 'Les boîtes vocales, les messages d\'accueil et les enregistrements.',
  securite: 'Qui peut voir quoi, les renvois vers l\'extérieur et les appels bizarres.',
  chiffres: 'Les statistiques : volumes, provenance, coûts, qualité et prévisions.',
  historique: 'Ce qui a été modifié dans le système, et quand.',
  reglages: 'L\'apparence de 3CXplore et la sauvegarde de vos réglages.',
};
// libellés du menu « Je veux… » : une action plutôt qu'un nom d'onglet
const NAV_DO = {nouvel: 'Ajouter un employé', depart: 'Retirer un employé', ouvmag: 'Ouvrir un magasin', feries: 'Préparer les jours fériés'};
