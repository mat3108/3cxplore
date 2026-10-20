// ---------- Menu épuré (15.1) : onglets voisins réunis sous une seule entrée, avec des sous-onglets en haut de page ----------
// [libellé, icône (onglet dont on reprend l'icône), onglets réunis] ; les adresses des onglets (#flux, #postes…) ne changent pas
const NAV_SETS = {
  route: ['Acheminement', 'flux', ['flux', 'diagramme', 'simulateur', 'controle', 'sdainut', 'pieges', 'doublons', 'numerotation']],
  postes: ['Postes et téléphones', 'postes', ['postes', 'telephones', 'blf', 'blfmodele', 'licences']],
  structure: ['Structure', 'groupes', ['groupes', 'organigramme', 'ivr', 'sonnerie', 'feries', 'horaires', 'ouvmag']],
  appels: ['Appels', 'appels', ['appels', 'rappels', 'rappellent', 'numero', 'client', 'vip', 'receptions', 'delai', 'parkings', 'pkplan']],
  files: ['Files et agents', 'files', ['files', 'statsfiles', 'agents', 'occupation', 'prevision', 'effectif', 'indisp']],
  analyse: ['Analyse', 'stats', ['stats', 'deptrap', 'provenance', 'destinations', 'couts', 'internes', 'classement', 'cmpmag', 'courts', 'qualite', 'menus']],
  securite: ['Sécurité et droits', 'securite', ['securite', 'renvois', 'suspects', 'visibilite', 'droits', 'comparer']],
  employes: ['Employés', 'nouvel', ['employe', 'corrections', 'nouvel', 'depart', 'absences', 'historique']],
  vocal: ['Messagerie et enregistrements', 'audio', ['messageries', 'audio', 'enreg']],
  changements: ['Changements', 'modifs', ['suivi', 'comparaison', 'avantapres', 'modifs', 'audit']],
  reglages: ['Réglages', 'reglages', ['objectifs', 'magasins', 'interface', 'reglages', 'params']],
};
const NAV2 = [
  ["Vue d'ensemble", ['dashboard', 'priorites', 'reco', 'sante', 'rapport', 'fichemag', 'actions']],
  ['Configuration', ['@postes', '@structure', '@route', 'trunks', 'sortant', 'annuaire']],
  ['Activité', ['@appels', '@files', '@analyse', '@vocal']],
  ['Système', ['@securite', '@employes', '@changements', '@reglages', 'recobv']],
];
const SET_OF = {}; Object.entries(NAV_SETS).forEach(([id, [, , ms]]) => ms.forEach(k => SET_OF[k] = id));
