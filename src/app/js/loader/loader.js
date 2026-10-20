// ===================================================================
// Chargement d'un backup 3CX (.zip) directement dans le navigateur.
// Équivalent JavaScript de generer_interface.py : même structure de données D.
// Rien n'est envoyé sur le réseau ; le dernier backup est mémorisé (IndexedDB).
// ===================================================================
window.NAV_ICONS = {
  dashboard:'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  magasins:'M3 9l1.5-5h15L21 9M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8M10 21v-5h4v5',
  telephones:'M5 9h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM7 9V5a2 2 0 0 1 2-2h1v6M14 13h4M14 17h4M7 13h3v4H7z',
  stats:'M3 3v18h18M7 15l4-4 3 3 5-6M17 8h3v3',
  agents:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11l2 2 4-4',
  horaires:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  comparaison:'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4',
  rapport:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2',
  actions:'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  suivi:'M3 17l6-6 4 4 8-8M14 7h7v7',
  rappels:'M23 1l-6 6M17 1l6 6M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  menus:'M4 6h16M4 12h10M4 18h7M17 14l4 4-4 4',
  objectifs:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  client:'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21a7 7 0 0 1 10-6.3M18 14v3l2 1M23 17a5 5 0 1 1-10 0 5 5 0 0 1 10 0z',
  cmpmag:'M3 21V8l5-4 5 4v13M13 21V12l4-3 4 3v9M6 12h4M6 16h4',
  licences:'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7zM17 11h.01',
  reglages:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  reco:'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  flux:'M3 6h13M13 3l3 3-3 3M21 18H8M11 15l-3 3 3 3',
  diagramme:'M4 4h6v5H4zM14 15h6v5h-6zM14 4h6v5h-6zM7 9v8.5h7M17 9v6',
  postes:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  groupes:'M4 21V6l8-3 8 3v15M9 21v-4h6v4M8 9h2M14 9h2M8 13h2M14 13h2',
  files:'M4 6h16M4 12h16M4 18h10',
  ivr:'M6 4h.01M12 4h.01M18 4h.01M6 10h.01M12 10h.01M18 10h.01M6 16h.01M12 16h.01M18 16h.01M12 21h.01',
  sonnerie:'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  trunks:'M3 4h18v7H3zM3 13h18v7H3zM7 7.5h.01M7 16.5h.01',
  sortant:'M7 17L17 7M9 7h8v8',
  appels:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  statsfiles:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  enreg:'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  visite:'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z',
  glossaire:'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM4 17a3 3 0 0 1 3-3h11M8 8h6',
  changelog:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  audio:'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  doublons:'M8 4h10a2 2 0 0 1 2 2v10M4 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  recobv:'M3 11l9-7 9 7M5 9.5V20h14V9.5M9 15l2 2 4-4',
  messageries:'M6.5 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm11 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM6.5 15.5h11',
  annuaire:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  audit:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  simulateur:'M5 3l14 9-14 9z',
  employe:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0M17 8h4M19 6v4',
  attente:'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  deptrap:'M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01',
  numero:'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1zM15 3h6M15 7h6',
  corrections:'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  absences:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M10 13l4 4M14 13l-4 4',
  rappellent:'M4 5h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 7a2 2 0 0 1 1-2zM15 3a6 6 0 0 1 6 6M15 7a2 2 0 0 1 2 2',
  couts:'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  vip:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
  occupation:'M12 3a9 9 0 1 0 9 9h-9zM14 2.2A9 9 0 0 1 21.8 10H14z',
  ouvmag:'M3 9l1.5-5h15L21 9M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h7M18 14v6M15 17h6',
  sdainut:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2zM15 3l6 6M21 3l-6 6',
  suspects:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v4M12 15h.01',
  internes:'M7 7h10M7 7l3-3M7 7l3 3M17 17H7M17 17l-3-3M17 17l-3 3',
  prevision:'M3 17l5-5 4 3 8-8M15 7h5v5M3 21h18',
  courts:'M3 12h4l2-5 3 10 2-5h7',
  destinations:'M5 19L19 5M9 5h10v10M5 12v7h7',
  delai:'M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5l3 2M9 2h6',
  provenance:'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  historique:'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4',
  blfmodele:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
  receptions:'M3 18h18M5 18v-4a7 7 0 0 1 14 0v4M12 7V5M10 5h4',
  fichemag:'M4 21V9l8-6 8 6v12H4zM9 21v-6h6v6',
  renvois:'M4 12h12M12 6l6 6-6 6M20 4v16',
  pieges:'M12 3l9 16H3zM12 10v4M12 17h.01',
  blf:'M4 4h16v16H4zM8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h3v3h-3z',
  pkplan:'M5 21V4h7a5 5 0 0 1 0 10H5M15 17l2 2 4-4',
  parkings:'M5 21V4h7a5 5 0 0 1 0 10H5',
  organigramme:'M10 3h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4zM12 7v5M5 17v-5h14v5',
  numerotation:'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  nouvel:'M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6',
  depart:'M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11h6',
  comparer:'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20',
  droits:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  visibilite:'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  interface:'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A5 5 0 0 0 22 10c0-3.9-4.5-7-10-7zM7.5 12h.01M10 7.5h.01M15 7.5h.01',
  priorites:'M4 6h10M4 12h7M4 18h4M17 4v16M14 17l3 3 3-3',
  sante:'M3 12h4l3-8 4 16 3-8h4',
  avantapres:'M4 7h13l-3-3M20 17H7l3 3',
  classement:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  effectif:'M3 3v18h18M7 15l4-4 3 3 5-6',
  indisp:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 12 0v1M19 8v5M19 16h.01',
  feries:'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M9 15l2 2 4-4',
  controle:'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  qualite:'M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4',
  securite:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  modifs:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  params:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};
window.navIcon = k => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${window.NAV_ICONS[k]||''}"/></svg>`;
const BK = (() => {
  // secrets : mots de passe, PIN, jetons, clés, empreintes d'accès (ex. SERVICES_ACCESS_HASH) et identifiants
  const SENSITIVE = /PASS|PIN$|SECRET|TOKEN|LICENSEKEY|RPS_KEY|QUICKMEETING|JWT|APIKEY|API_KEY|HASH|CREDENTIAL|PRIVATE_?KEY/i;
  const DBNAME = 'visualiseur-3cx', STORE = 'backup', KEY = 'courant';

//#include timezone.js
//#include zip.js
//#include csv.js
//#include xml.js
//#include build-data.js
//#include storage-and-startup.js
//#include empty-state.js
//#include close.js
