<p align="center"><img src="assets/logo.svg" alt="3CXplore" width="440"></p>

# 🔎 3CXplore

> *Explorez votre 3CX en profondeur.*
>
> Une interface web, entièrement locale, pour **explorer, analyser et auditer un système téléphonique 3CX V20 à partir de son fichier de backup** — configuration, flux d'appels, statistiques, sécurité et recommandations, magasin par magasin.

![Version](https://img.shields.io/badge/version-20.6-2563eb)
![3CX](https://img.shields.io/badge/3CX-V20-0d9488)
![Données](https://img.shields.io/badge/donn%C3%A9es-100%20%25%20locales-15803d)
![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-aucune-64748b)

---

## ✨ En bref

- **Aucune installation** : un seul fichier HTML à ouvrir dans le navigateur.
- **Aucune donnée envoyée** : le backup `.zip` est lu directement dans le navigateur ; rien ne quitte le poste.
- **Mises à jour signalées** : au démarrage, un bandeau indique si une version plus récente est publiée (désactivable).
- **Pensé pour les systèmes à plusieurs sites** : tout se filtre par magasin (ou site) grâce au sélecteur du bandeau ; le magasin est déduit du code au début du nom des départements.
- **89 onglets** répartis en quatre sections, du tableau de bord jusqu'au simulateur d'appel.

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
| **Accueil** | Le champ de recherche trouve aussi les postes, les SDA, les files et les contacts. |
| **Tableau de bord** | Volume d'appels par jour sur des jours consécutifs, avec les dates dans le titre. |
| **Priorités** | Postes qui enverraient au 911 l'adresse d'un autre magasin (critique). |
| **Note de santé** | Pastilles Serv. / Conf. / Sécu. / Tél. au lieu de S C S T ; « /100 » plus lisible. |
| **Recommandations** | Nouveau point critique : numéro envoyé au 911 d'un autre magasin. |
| **Actions console** | Liste de tâches à faire dans la console 3CX, classées par moment, avec chemin, impact, éléments exacts, copie des MAC, suivi et impression. |
| **Rapport** | Rapport imprimable / PDF par magasin : synthèse, recommandations, SDA et diagrammes, horaires, files, agents, postes, téléphones à mettre à jour. |
| **Fiche magasin** | Lien « Rapport du département » pour chaque département du magasin. |
| **Suivi** | Évolution des indicateurs d'un backup à l'autre (service, problèmes, téléphones, parc), par système ou par magasin ; ajout d'anciens backups, export / import de l'historique. |
| **Comparaison** | Différences entre le backup actuel et un backup de référence : ajouts, suppressions, modifications champ par champ et journal d'audit de la période ; export CSV. |
| **Flux d'appels** | Chaque numéro (DID) avec sa règle entrante et l'arbre d'acheminement complet : département → standard IVR (touche par touche) → files d'attente → agents, pour les heures d'ouverture et hors heures. |
| **Flux d'appel (diagramme)** | Interrupteur « Portrait (lettre) » et impression PDF au format lettre. |
| **Simulateur d'appel** | Heures du département propriétaire d'une file, d'un menu ou d'un groupe de sonnerie. |
| **Contrôle des SDA** | Simulation de tous les SDA à des moments clés, problèmes regroupés par cause. |
| **SDA inutilisés** | SDA jamais appelés, plus appelés depuis longtemps ou très peu appelés, par trunk, avec l'économie possible. |
| **Sans numéro de sortie** | Nouvelle page : postes sans numéro présenté et numéro à leur mettre. |
| **Appels au 911** | Nouvelle page : numéro envoyé au 911 par chaque poste et magasin de ce numéro. |
| **Pièges d'acheminement** | Boucles, destinations disparues ou désactivées, files, groupes et menus sans issue, SDA vers messagerie. |
| **Doublons et incohérences** | Postes, numéros présentés, éléments et SDA configurés deux fois ou de façon contradictoire. |
| **Avant / après** | Parcours des SDA comparés entre le backup de référence et le backup actuel. |

### Configuration
| Onglet | À quoi il sert |
|---|---|
| **Postes** | Longues listes de départements repliées (« +N autres »). |
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
| **Clients qui rappellent** | Numéros d'exception exclus des calculs, ajout en lot et bouton « Exclure ». |
| **Fiche numéro** | Nouvel onglet : tout sur un numéro (SDA, client, employé) sur une page. |
| **Historique client** | Chaque appel de la chronologie ouvre son parcours détaillé. |
| **Numéros importants** | Contacts clés suivis appel par appel : manqués, rappels en retard, délais, interlocuteurs ; alerte sur le tableau de bord. |
| **Réceptions** | Postes de réception : appels présentés, répondus, perdus, parking, appels simultanés et heures de surcharge. |
| **Délai avant réponse** | Temps d'attente du client avant qu'une personne décroche : médiane, 90 %, objectif, répartition, par heure, par magasin et par personne. |
| **Statistiques** | « Tout l'historique » part du vrai début de l'historique. |
| **Générateur de rapport** | Jours avant l'historique grisés, moyennes sur les jours couverts, comparaison seulement si possible. |
| **Générateur de graphique** | Comparer jusqu'à trois magasins, utilisateurs, files ou SDA sur le même graphique. |
| **Rapport de département** | Nouveau rapport imprimable de toutes les statistiques des appels d'un département. |
| **Provenance des appels** | Appels entrants par région de l'appelant (indicatif), par magasin : parts, appels perdus par région, indicatifs fréquents, numéros d'une région. |
| **Destinations des appels sortants** | Appels sortants par destination (indicatif), par magasin et par poste : hors Québec, international, services spéciaux, soirs et fins de semaine. |
| **Coût des appels sortants** | Estimation du coût des appels sortants d'après vos tarifs : par destination, mois, magasin, poste et numéro. |
| **Appels internes** | Appels entre postes et entre magasins : postes sollicités, collègues difficiles à joindre, paires fréquentes, matrice entre magasins. |
| **Agents** | Performance par agent et par magasin sur une période : répondus, conversation moyenne, taux de réponse en file, manquées, décroché moyen, sortants ; fiche détaillée et export CSV. |
| **Taux d'occupation des agents** | Part du temps connecté passée en conversation, par agent, par heure et par magasin : agents débordés et peu sollicités. |
| **Personnes indispensables** | Files, groupes et numéros qui dépendent d'une seule personne. |
| **Prévision du volume** | Appels entrants attendus sur 7 jours, par jour et par heure, avec fourchette, tendance et jours fériés. |
| **Effectif selon l'achalandage** | Appels, pertes et agents par créneau, et agents nécessaires. |
| **Classement des magasins** | Comparaison des magasins sur la réponse, les abandons, l'attente et les heures de pointe. |
| **Appels très courts** | Appels répondus de quelques secondes et rappels dans les 2 minutes (coupures probables), par type, ligne, heure et poste. |
| **Qualité des appels** | Qualité de la voix par magasin, site, modèle de téléphone et trunk. |
| **Horaires** | Lien « Rapport » sur chaque département et dans son détail. |
| **Menus IVR** | Choix des appelants dans chaque standard, raccrochages, délais sans choix, devenir des appels par choix, points de perte du parcours. |
| **Appels** | Sur téléphone, un appel par carte. |
| **Parkings partagés** | Bouton « Rapport des mises en attente par employé » et lien « Rapport » pour chaque employé. |
| **Plan des parkings** | Nombre de parkings nécessaires par magasin d'après les appels parqués en même temps. |
| **Appels en file** | Chaque passage en file d'attente : attente, conversation, résultat et agent. |
| **Enregistrements** | Liste des enregistrements référencés (les fichiers audio ne font pas partie du backup). |
| **Messagerie & audio** | Messages vocaux, invites personnalisées (avec l'élément qui les utilise) et messages d'accueil, écoutables. |
| **Messageries vocales** | État de chaque boîte vocale, envoi par courriel, annonce, messages conservés, consultation et acheminements qui y mènent. |

### Système
| Onglet | À quoi il sert |
|---|---|
| **Objectifs** | Cibles de qualité de service par défaut et par magasin, avec la valeur actuelle et l'atteinte ; utilisées par Statistiques, Agents, Suivi et Rapport. |
| **Comparer les magasins** | Configuration des magasins côte à côte (horaires, menus, files, délais, stratégies, postes) et éléments de même rôle comparés, écarts surlignés. |
| **Licences et postes** | Postes jamais utilisés ou inactifs (seuil au choix), encore visés par un acheminement, en double ou désactivés ; téléphones à récupérer ; pic d'appels simultanés. |
| **Magasins** | Codes de magasin détectés (nom, type Magasin/Commun, nombre d'éléments) et attribution de chaque département, file, standard, groupe de sonnerie et poste, avec correction manuelle. |
| **Sauvegarde des réglages** | Export et import en un fichier de tous les réglages saisis dans l'interface (magasins, objectifs, suivi, notes, tâches, préférences). |
| **Interface** | Pastilles des rubriques sur plusieurs lignes sur ordinateur ; fondu sur le bord sur téléphone. |
| **Sécurité** | Droits d'administration, double authentification, renvois externes, appels internationaux, connexions et changements sensibles. |
| **Renvois externes** | Renvois vers des numéros externes : statuts, appels renvoyés, anciens employés, cellulaires de collègues, numéros inconnus. |
| **Appels suspects** | Démarchage et robots : rafales, plusieurs SDA appelés, appels très courts ou de nuit répétés, appels masqués par heure. |
| **Visibilité et droits** | Ce qu'un utilisateur voit et peut faire sur chaque poste, selon ses rôles par département. |
| **Matrice des droits** | Droits des rôles par département, droits propres et incohérences. |
| **Comparer deux utilisateurs** | Deux postes côte à côte et les changements pour aligner le second sur le premier. |
| **Fiche employé** | Bouton « Mises en attente » qui ouvre le rapport pour la même personne et la même période. |
| **Corrections par usager** | Nouvel onglet : corrections à faire sur le poste de chaque employé. |
| **Nouvel employé** | Touches BLF du nouveau poste et des collègues, au choix. |
| **Départ d'un employé** | Fiche de départ : ce qui pointe vers le poste, ce qu'il faut retirer ou transmettre, avec un remplaçant facultatif. |
| **Absences et congés** | Absences prévues, éléments laissés sans personne, jours critiques, appels à répartir et remplaçants possibles. |
| **Ouverture d'un magasin** | Parkings partagés libres proposés et touches de parking à programmer, liés au Plan des parkings. |
| **Historique d'un employé** | Chronologie d'un poste d'après le journal d'audit : modifications, ajouts et retraits, changements de rôle, auteurs. |
| **Modifications** | Changements de configuration d'un magasin sur une période, avec l'avant et l'après de chaque champ. |
| **Journal d'audit** | Modifications de configuration et connexions, avec l'avant/après de chaque champ modifié. |
| **Paramètres** | Paramètres système et tenant (valeurs sensibles masquées). |
| **Qui peut laisser un message ?** | Onglet renommé (ancien Recommandation BV) et déplacé en bas du menu. |
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
├── README.md, README.en.md         # ce fichier, en français et en anglais
├── mise.toml                       # outils (Node) et tâches : mise run dev / build / check / package
├── package.json, vite.config.js    # Vite : construction de la page à partir de src/app/
├── .github/workflows/              # contrôle automatique à chaque envoi sur GitHub
├── app/                            # ce qu'on ouvre dans le navigateur (généré)
│   ├── visualiseur-3cx-vX.Y.html   # dernière version : une seule page HTML autonome
│   ├── documentation.html          # guide de l'utilisateur : chaque menu expliqué
│   ├── documentation-en.html       # le même guide en anglais
│   ├── changelog.html              # Changelog : nouveautés de chaque version
│   ├── firmwares-3cx.js            # liste des firmwares recommandés par 3CX
│   └── anciennes-versions/         # toutes les versions précédentes
├── src/                            # sources
│   ├── app/                        # code de la dernière version (depuis 19.0) — voir src/app/README.md
│   │   ├── index.html              # la page : structure HTML, styles et scripts inclus
│   │   ├── css/                    # styles (base, side-menu, modern-finish, geek-themes)
│   │   └── js/                     # i18n/, appearance.js, updates.js, loader/ (lecture du backup),
│   │       └── app/                #   application : core/, tabs/ (un fichier par onglet), ui/
│   ├── versions.json               # liste des versions (titre, résumé, changements, onglets)
│   ├── documentation-modele.html   # modèle du Changelog
│   ├── guide-modele.html           # modèle du guide de l'utilisateur
│   ├── guide-modele-en.html        # modèle du guide en anglais
│   ├── guide.json                  # contenu du guide (un bloc par onglet, français et anglais)
│   └── versions/X.Y/modele.html    # modèle figé des versions jusqu'à 18.4
├── scripts/
│   ├── generate.mjs                # générateur des pages, du guide, du Changelog, du README et du paquet de partage
│   ├── check.mjs                   # contrôle du dépôt (aussi lancé par GitHub)
│   ├── vite-inline-scripts.mjs     # extension Vite : insère les scripts de src/app/ dans la page
│   └── verifier-firmwares.command  # mise à jour de la liste des firmwares (macOS, double-clic)
├── assets/
│   └── logo.svg, logo-icone.svg, icone-192.png, icone-512.png
├── manifest.webmanifest, sw.js     # application installable (générés)
└── build/, dist/, node_modules/    # construction, paquets de partage, outils (non versionnés)
```

## 🧑‍💻 Développement

Prérequis : [mise](https://mise.jdx.dev) (il installe la bonne version de Node). Toutes les commandes se lancent depuis la racine du projet ; `mise tasks` les liste.

| Commande | Ce qu'elle fait |
|---|---|
| `mise run dev` | Édition : sert `src/app/` sur http://localhost:5173 ; la page se recharge à chaque enregistrement. |
| `mise run build` | Construit toutes les pages (dernière version, anciennes versions, guide, Changelog, README). |
| `mise run check` | Contrôle du dépôt (le même que sur GitHub). |
| `mise run preview` | Sert le site construit sur http://localhost:4173. |
| `mise run package` | Crée le paquet de partage `dist/visualiseur-3cx-v<version>.zip`. |
| `mise run firmwares` | Télécharge la liste officielle des firmwares 3CX dans `app/firmwares-3cx.js` (macOS). |
| `mise run ci` | Ce que lance GitHub : construction, comparaison avec les pages envoyées, contrôle. |

**Code source (depuis 19.0)** : le code est réparti dans `src/app/` (environ 120 fichiers : un par onglet, plus le noyau, la langue, le chargement du backup et les styles). **Vite** construit une **seule page HTML autonome** : les styles sont réunis par `@import`, et les scripts (`<script inline src="…">`, `//#include …`) sont insérés à leur place, sans rien ajouter. Voir [`src/app/README.md`](src/app/README.md).

Le générateur (`mise run build`) écrit la dernière version dans `app/` et les précédentes dans `app/anciennes-versions/`, injecte le menu des versions dans chaque page, produit le guide de l'utilisateur `app/documentation.html` et le Changelog `app/changelog.html`, fait pointer `index.html` vers la dernière version et met à jour les README (tableau des versions, onglets, badge). Les versions à partir de 19.0 qui ne sont plus la dernière sont reconstruites depuis leur étiquette git `v<version>`.

Le **paquet de partage** (`mise run package`) contient seulement la dernière version, le guide de l'utilisateur, le Changelog, les fichiers des firmwares et un `LISEZMOI.txt` / `README.txt`. Le menu ne propose que cette version (pas de liens morts) et les exemples propres au client sont remplacés par des exemples neutres. Le zip n'est jamais ajouté au dépôt (`.gitignore`).

## ✅ Contrôle automatique

À chaque envoi sur GitHub, le contrôle **« Contrôle du dépôt »** (onglet *Actions* du dépôt) lance `mise run ci` :
- construit les pages avec Vite et vérifie qu'elles correspondent aux sources envoyées ;
- vérifie qu'**aucun backup, export, enregistrement ou secret** n'est entré dans le dépôt ;
- vérifie que toutes les pages existent et que leurs liens (versions, guide, Changelog, firmwares) fonctionnent, que chaque onglet est expliqué dans le guide et que chaque fichier de `src/app/` est utilisé ;
- vérifie la syntaxe JavaScript de la dernière version.

En cas d'échec, GitHub envoie un courriel. Le même contrôle se lance à la main : `mise run check`.

## 🔢 Versions

Chaque changement est une nouvelle version : une modification de `src/app/` (jusqu'à 18.4 : un modèle dans `src/versions/<version>/`) et une entrée en tête de `src/versions.json`, puis `mise run build`. Les versions précédentes restent accessibles depuis le menu en haut à droite de l'interface.

<!-- VERSIONS:START -->
| Version | Nouveauté |
|---|---|
| **20.6** | Le bon numéro pour le 911 |
| 20.5.2 | Les postes sans numéro de sortie |
| 20.5.1 | Les pastilles des rubriques ne sont plus coupées |
| 20.5 | Comparer 2 ou 3 sur le même graphique |
| 20.4 | Les appels derrière chaque barre |
| 20.3.3 | Trouver un SDA avec la barre de recherche |
| 20.3.2 | Les touches BLF du nouvel employé |
| 20.3.1 | Le vrai début de l'historique |
| 20.3 | Le générateur de graphique |
| 20.2.3 | Un générateur plus léger sur le disque |
| 20.2.2 | Fermer le backup depuis l'accueil |
| 20.2.1 | Le rapport depuis l'accueil |
| 20.2 | Le générateur de rapport |
| 20.1 | L'assistant de l'accueil |
| 20.0 | Un menu simple, avec ses sous-menus |
| 19.x | Code source en modules, construit avec Vite · Langue des téléphones · Catégories du menu soulignées · Renvois d'appel lus comme dans la console · Chiffres d'appels corrigés après l'audit des données · … |
| 18.x | Nouveau menu (bêta) · Diagramme en portrait (lettre) · Messagerie vocale des employés : plus comptée comme un appel répondu · Messagerie vocale des files et groupes : plus comptée comme un abandon · Appels internes vers une file ou un menu : plus comptés comme répondus · … |
| 17.x | Guide de l'utilisateur en anglais · Visite guidée · Rapport et fiches : affichage sans chevauchement · Visite guidée : interrupteur à l'ouverture du backup · Fiche employé · … |
| 16.x | Plan des parkings par magasin · Plan des parkings : export pour corriger les usagers · Plan des parkings : tableau des usagers en problème · Aide contextuelle « ? » sur chaque onglet · Plan des parkings : nombre de parkings nécessaires · … |
| 15.x | 3CXplore entièrement en anglais · Menu épuré : 22 entrées au lieu de 62 · Choix du menu : simplifié ou expert · Provenance des appels par indicatif régional · Délai avant réponse · … |
| 14.x | Interface en anglais (première étape) · Interface en anglais : deuxième étape · Statistiques : carte de chaleur jour × heure enrichie |
| 13.x | Première version publique de 3CXplore · Avis de mise à jour au démarrage · Application installable (version web) · Bouton mises à jour et installation dans le bandeau · Correctif : bouton mises à jour sans backup ouvert · … |
<!-- VERSIONS:END -->

L'historique complet est dans le Changelog : [`app/changelog.html`](app/changelog.html). Le guide de l'utilisateur (chaque menu expliqué) est dans [`app/documentation.html`](app/documentation.html).

## 💻 Compatibilité

- **Navigateurs** : Chrome et Edge recommandés (lecture ZIP via `DecompressionStream`).
- **3CX** : backups V20 (`*Db.xml` et tables `DbTables/*.csv`).
- **Vérification des firmwares** : `scripts/verifier-firmwares.command` fonctionne sur macOS, sans rien installer ; au premier lancement, clic droit > Ouvrir.

---

<sub>Projet privé — usage interne.</sub>

## 📄 Licence et avertissement

Distribué sous licence **MIT** (voir [`LICENSE`](LICENSE)).

3CXplore est un projet indépendant, sans lien avec 3CX Ltd. « 3CX » est une marque de son propriétaire, utilisée ici uniquement pour indiquer le système concerné. L'outil ne fait que lire un fichier de backup : il ne modifie jamais votre système 3CX.
