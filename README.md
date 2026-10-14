<p align="center"><img src="assets/logo.svg" alt="3CXplore" width="440"></p>

# 🔎 3CXplore

> *Explorez votre 3CX en profondeur.*
>
> Une interface web, entièrement locale, pour **explorer, analyser et auditer un système téléphonique 3CX V20 à partir de son fichier de backup** — configuration, flux d'appels, statistiques, sécurité et recommandations, magasin par magasin.

![Version](https://img.shields.io/badge/version-13.3.1-2563eb)
![3CX](https://img.shields.io/badge/3CX-V20-0d9488)
![Données](https://img.shields.io/badge/donn%C3%A9es-100%20%25%20locales-15803d)
![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-aucune-64748b)

---

## ✨ En bref

- **Aucune installation** : un seul fichier HTML à ouvrir dans le navigateur.
- **Aucune donnée envoyée** : le backup `.zip` est lu directement dans le navigateur ; rien ne quitte le poste.
- **Mises à jour signalées** : au démarrage, un bandeau indique si une version plus récente est publiée (désactivable).
- **Pensé pour les systèmes à plusieurs sites** : tout se filtre par magasin (ou site) grâce au sélecteur du bandeau ; le magasin est déduit du code au début du nom des départements.
- **62 onglets** répartis en quatre sections, du tableau de bord jusqu'au simulateur d'appel.

## 🚀 Démarrage

1. Ouvrir **`index.html`** (redirige vers la dernière version, dans `app/`) dans Chrome ou Edge.
2. Dans le **Tableau de bord**, choisir ou glisser-déposer un backup 3CX (`.zip`).
3. Choisir un magasin dans le bandeau, ou rester sur « Tous les magasins ».

Le backup est mémorisé dans le navigateur jusqu'à **« Fermer le backup »**, qui permet de choisir ce qui est effacé.

**Version web installable** : ouverte depuis son adresse web (GitHub Pages, par exemple `https://mat3108.github.io/3cxplore/`), l'interface s'installe comme une application dans Chrome ou Edge (onglet **Interface** → **Installer l'application**) : icône sur le bureau, fenêtre à part, fonctionnement hors ligne et mises à jour automatiques. Le backup reste lu uniquement dans le navigateur.

## 🧭 Ce que contient l'interface

<!-- ONGLETS:START -->
### Vue d'ensemble
| Onglet | À quoi il sert |
|---|---|
| **Tableau de bord** | Chiffres clés, issue des appels entrants, volume quotidien (entrants/sortants/internes), appels entrants par heure, postes et numéros les plus actifs, informations système. |
| **Priorités** | Tous les problèmes en une liste, classés selon les appels touchés puis par gravité. |
| **Note de santé** | Note sur 100 par magasin : service, configuration, sécurité et téléphones. |
| **Recommandations** | Analyse automatique de la configuration et de l'activité, classée Critique / À corriger / Observation, avec éléments concernés, recommandation, statut et notes personnelles ; ajout d'observations manuelles ; export CSV et impression. |
| **Actions console** | Liste de tâches à faire dans la console 3CX, classées par moment, avec chemin, impact, éléments exacts, copie des MAC, suivi et impression. |
| **Rapport** | Rapport imprimable / PDF par magasin : synthèse, recommandations, SDA et diagrammes, horaires, files, agents, postes, téléphones à mettre à jour. |
| **Fiche magasin** | Résumé imprimable d'un magasin : appels, SDA, horaires, files, parkings et problèmes à corriger. |
| **Suivi** | Évolution des indicateurs d'un backup à l'autre (service, problèmes, téléphones, parc), par système ou par magasin ; ajout d'anciens backups, export / import de l'historique. |
| **Comparaison** | Différences entre le backup actuel et un backup de référence : ajouts, suppressions, modifications champ par champ et journal d'audit de la période ; export CSV. |
| **Flux d'appels** | Chaque numéro (DID) avec sa règle entrante et l'arbre d'acheminement complet : département → standard IVR (touche par touche) → files d'attente → agents, pour les heures d'ouverture et hors heures. |
| **Flux d'appel (diagramme)** | Diagramme du callflow complet d'un SDA choisi dans la liste du système, avec zoom, export SVG et impression. |
| **Simulateur d'appel** | Parcours et issue d'un appel entrant sur un SDA à un jour et une heure donnés. |
| **Contrôle des SDA** | Simulation de tous les SDA à des moments clés, problèmes regroupés par cause. |
| **Pièges d'acheminement** | Boucles, destinations disparues ou désactivées, files, groupes et menus sans issue, SDA vers messagerie. |
| **Avant / après** | Parcours des SDA comparés entre le backup de référence et le backup actuel. |

### Configuration
| Onglet | À quoi il sert |
|---|---|
| **Postes** | Utilisateurs avec filtres (département, statut, appareil). Fiche : coordonnées, compte Microsoft 365, téléphones (modèle, MAC, firmware), files, profils de renvoi, message d'accueil et messages vocaux écoutables, propriétés. |
| **Téléphones** | Inventaire des téléphones, comparaison avec les firmwares recommandés par 3CX (par modèle et par téléphone), état du serveur, vérification en ligne et export CSV. |
| **Touches BLF** | Touches programmées des téléphones : BLF, parkings, numérotation rapide, touches à corriger et qui surveille qui. |
| **Modèle de touches** | Modèle de touches d'un département et fiche des touches à ajouter ou retirer sur chaque téléphone. |
| **Plan de numérotation** | Plages de numéros par magasin, numéros libres et postes hors plage. |
| **Départements** | Groupes 3CX : horaires par jour, acheminement ouvert/fermé/pause/fériés avec invites écoutables, arbre d'acheminement, membres et rôles. |
| **Organigramme** | Arbre magasin → départements, files, groupes de sonnerie et menus → membres, avec recherche et impression. |
| **Jours fériés** | Fériés configurés ou manquants par département et liste à saisir dans la console. |
| **Files d'attente** | Stratégie, délais, intro et musique d'attente, agents et gestionnaires, statistiques (taux de service, attente et conversation moyennes, abandons, appels sans agent, répartition horaire). |
| **Standards IVR** | Message, touches et destinations, comportement sans choix, arbre d'acheminement. |
| **Groupes de sonnerie** | Stratégie, membres, destination sans réponse. |
| **Trunks** | Lignes externes (DID, règles entrantes) et passerelles / fournisseurs SIP / bridges. |
| **Règles sortantes** | Règles par ordre de priorité, préfixes, longueurs, routes et manipulation des chiffres. |
| **Annuaire** | Contacts de l'entreprise et des départements. |

### Activité
| Onglet | À quoi il sert |
|---|---|
| **Appels manqués** | Liste de rappel des clients sans réponse non rappelés, par magasin : tentatives, heure, cause, statut de rappel ; suivi « Traité », export CSV et impression. |
| **Historique client** | Tous les échanges avec un numéro de téléphone : appels, parcours, issues, interlocuteurs, files, messages vocaux, enregistrements. |
| **Réceptions** | Postes de réception : appels présentés, répondus, perdus, parking, appels simultanés et heures de surcharge. |
| **Statistiques** | Comparaison des magasins sur une période : taux de réponse, appels perdus, attente en file, heures de pointe, évolution quotidienne ; export CSV. |
| **Agents** | Performance par agent et par magasin sur une période : répondus, conversation moyenne, taux de réponse en file, manquées, décroché moyen, sortants ; fiche détaillée et export CSV. |
| **Personnes indispensables** | Files, groupes et numéros qui dépendent d'une seule personne. |
| **Effectif selon l'achalandage** | Appels, pertes et agents par créneau, et agents nécessaires. |
| **Classement des magasins** | Comparaison des magasins sur la réponse, les abandons, l'attente et les heures de pointe. |
| **Qualité des appels** | Qualité de la voix par magasin, site, modèle de téléphone et trunk. |
| **Horaires** | Contrôle des horaires configurés d'après les appels réels : anomalies, demande avant ouverture et après fermeture, jours fériés à venir manquants ; fiche détaillée par département. |
| **Menus IVR** | Choix des appelants dans chaque standard, raccrochages, délais sans choix, devenir des appels par choix, points de perte du parcours. |
| **Appels** | Historique complet filtrable par période, direction, issue et file ; fiche avec le parcours de l'appel. |
| **Parkings partagés** | Réglages et utilisation des parkings d'appels : reprises, retours, appels perdus en attente, parkings affichés sur les téléphones. |
| **Appels en file** | Chaque passage en file d'attente : attente, conversation, résultat et agent. |
| **Enregistrements** | Liste des enregistrements référencés (les fichiers audio ne font pas partie du backup). |
| **Messagerie & audio** | Messages vocaux, invites personnalisées (avec l'élément qui les utilise) et messages d'accueil, écoutables. |

### Système
| Onglet | À quoi il sert |
|---|---|
| **Objectifs** | Cibles de qualité de service par défaut et par magasin, avec la valeur actuelle et l'atteinte ; utilisées par Statistiques, Agents, Suivi et Rapport. |
| **Comparer les magasins** | Configuration des magasins côte à côte (horaires, menus, files, délais, stratégies, postes) et éléments de même rôle comparés, écarts surlignés. |
| **Licences et postes** | Postes inutilisés, inactifs, en double ou de test par magasin ; pic d'appels simultanés pour la licence ; export CSV. |
| **Magasins** | Codes de magasin détectés (nom, type Magasin/Commun, nombre d'éléments) et attribution de chaque département, file, standard, groupe de sonnerie et poste, avec correction manuelle. |
| **Sauvegarde des réglages** | Export et import en un fichier de tous les réglages saisis dans l'interface (magasins, objectifs, suivi, notes, tâches, préférences). |
| **Interface** | Thèmes prêts à l'emploi, couleur, densité, texte, coins, cartes, police, largeur, menu, onglet d'accueil et animations. |
| **Sécurité** | Droits d'administration, double authentification, renvois externes, appels internationaux, connexions et changements sensibles. |
| **Renvois externes** | Renvois vers des numéros externes : statuts, appels renvoyés, anciens employés, cellulaires de collègues, numéros inconnus. |
| **Visibilité et droits** | Ce qu'un utilisateur voit et peut faire sur chaque poste, selon ses rôles par département. |
| **Matrice des droits** | Droits des rôles par département, droits propres et incohérences. |
| **Comparer deux utilisateurs** | Deux postes côte à côte et les changements pour aligner le second sur le premier. |
| **Nouvel employé** | Fiche de création d'un poste sur le modèle d'un collègue, maintenant avec les renvois d'appel selon le statut. |
| **Départ d'un employé** | Fiche de départ : ce qui pointe vers le poste, ce qu'il faut retirer ou transmettre, avec un remplaçant facultatif. |
| **Historique d'un employé** | Chronologie d'un poste d'après le journal d'audit : modifications, ajouts et retraits, changements de rôle, auteurs. |
| **Modifications** | Changements de configuration d'un magasin sur une période, avec l'avant et l'après de chaque champ. |
| **Journal d'audit** | Modifications de configuration et connexions, avec l'avant/après de chaque champ modifié. |
| **Paramètres** | Paramètres système et tenant (valeurs sensibles masquées). |
<!-- ONGLETS:END -->

## 🔒 Confidentialité et sécurité

- Le backup est **lu dans le navigateur** (lecteur ZIP intégré) et mémorisé localement (IndexedDB) ; **rien n'est envoyé sur Internet**.
- Seule requête Internet : au démarrage (au plus une fois par jour), l'outil demande à GitHub le numéro de la dernière version publiée de 3CXplore, pour signaler une mise à jour. Aucune donnée du backup n'est transmise ; l'option se désactive dans l'onglet **Interface**.
- Les **mots de passe, PIN, secrets et clés** sont masqués ou ignorés à la lecture.
- **« Fermer le backup »** efface le backup, la mémoire de la session et, au choix, la référence de comparaison, les numéros de clients et les réglages.
- Ce dépôt **ne contient aucune donnée** : les backups (`*.zip`) et les exports (`*.csv`, réglages) sont exclus par le [`.gitignore`](.gitignore).

> ⚠️ **Ne jamais ajouter un backup 3CX à ce dépôt** : il contient les appels, enregistrements, messages vocaux et identifiants du système.

## 🛠️ Structure du projet

```
.
├── index.html                      # ouvre la dernière version
├── README.md
├── .github/workflows/              # contrôle automatique à chaque envoi sur GitHub
├── app/                            # ce qu'on ouvre dans le navigateur (généré)
│   ├── visualiseur-3cx-vX.Y.html   # dernière version
│   ├── documentation.html          # nouveautés de chaque version
│   ├── firmwares-3cx.js            # liste des firmwares recommandés par 3CX
│   └── anciennes-versions/         # versions précédentes (quand il y en a)
├── src/                            # sources
│   ├── versions.json               # liste des versions (titre, résumé, changements, onglets)
│   ├── documentation-modele.html
│   └── versions/X.Y/modele.html    # modèle de chaque version
├── scripts/
│   ├── generer_interface.py        # générateur des pages, du README et du paquet de partage
│   ├── verifier_depot.py           # contrôle du dépôt (aussi lancé par GitHub)
│   └── verifier-firmwares.command  # mise à jour de la liste des firmwares (macOS, double-clic)
├── assets/
│   └── logo.svg, logo-icone.svg, icone-192.png, icone-512.png
├── manifest.webmanifest, sw.js     # application installable (générés)
└── dist/                           # paquets de partage (non versionnés)
```

**Régénérer les pages** après une modification d'un modèle ou de `src/versions.json` (depuis la racine du projet) :

```bash
python3 scripts/generer_interface.py
```

Le générateur écrit la dernière version dans `app/` et les précédentes dans `app/anciennes-versions/`, injecte le menu des versions dans chaque page, produit `app/documentation.html`, fait pointer `index.html` vers la dernière version et met à jour ce README (tableau des versions, onglets, badge).

**Préparer un paquet à partager** avec des collègues :

```bash
python3 scripts/generer_interface.py --partage
```

Crée `dist/visualiseur-3cx-v<version>.zip` : seulement la dernière version, sa documentation, les fichiers des firmwares et un `LISEZMOI.txt`. Le menu ne propose que cette version (pas de liens morts). Si le fichier local `scripts/local/donnees-organisation.json` existe (jamais versionné), ses termes propres à votre organisation sont remplacés par des exemples neutres. Le zip n'est jamais ajouté au dépôt (`.gitignore`).

## ✅ Contrôle automatique

À chaque envoi sur GitHub, le contrôle **« Contrôle du dépôt »** (onglet *Actions* du dépôt) :
- régénère les pages et vérifie qu'elles correspondent aux sources envoyées ;
- vérifie qu'**aucun backup, export, enregistrement ou secret** n'est entré dans le dépôt ;
- vérifie que toutes les pages existent et que leurs liens (versions, documentation, firmwares) fonctionnent ;
- vérifie la syntaxe JavaScript de la dernière version.

En cas d'échec, GitHub envoie un courriel. Le même contrôle se lance à la main :

```bash
python3 scripts/verifier_depot.py
```

## 🔢 Versions

Chaque changement est une nouvelle version : un modèle dans `src/versions/<version>/` et une entrée en tête de `src/versions.json`, puis `python3 scripts/generer_interface.py`. Les versions précédentes restent accessibles depuis le menu en haut à droite de l'interface.

<!-- VERSIONS:START -->
| Version | Nouveauté |
|---|---|
| **13.3.1** | Correctif : bouton mises à jour sans backup ouvert |
| 13.3 | Bouton mises à jour et installation dans le bandeau |
| 13.2 | Application installable (version web) |
| 13.1 | Avis de mise à jour au démarrage |
| 13.0 | Première version publique de 3CXplore |
<!-- VERSIONS:END -->

L'historique complet est dans [`app/documentation.html`](app/documentation.html).

## 💻 Compatibilité

- **Navigateurs** : Chrome et Edge recommandés (lecture ZIP via `DecompressionStream`).
- **3CX** : backups V20 (`*Db.xml` et tables `DbTables/*.csv`).
- **Vérification des firmwares** : `scripts/verifier-firmwares.command` fonctionne sur macOS (Python 3) ; au premier lancement, clic droit > Ouvrir.

---

<sub>Projet privé — usage interne.</sub>

## 📄 Licence et avertissement

Distribué sous licence **MIT** (voir [`LICENSE`](LICENSE)).

3CXplore est un projet indépendant, sans lien avec 3CX Ltd. « 3CX » est une marque de son propriétaire, utilisée ici uniquement pour indiquer le système concerné. L'outil ne fait que lire un fichier de backup : il ne modifie jamais votre système 3CX.
