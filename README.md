<p align="center"><img src="assets/logo.svg" alt="3CXplore" width="440"></p>

# 🔎 3CXplore

> *Explorez votre 3CX en profondeur.*
>
> Une interface web, entièrement locale, pour **explorer, analyser et auditer un système téléphonique 3CX V20 à partir de son fichier de backup** — configuration, flux d'appels, statistiques, sécurité et recommandations, magasin par magasin.

![Version](https://img.shields.io/badge/version-18.2.37-2563eb)
![3CX](https://img.shields.io/badge/3CX-V20-0d9488)
![Données](https://img.shields.io/badge/donn%C3%A9es-100%20%25%20locales-15803d)
![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-aucune-64748b)

---

## ✨ En bref

- **Aucune installation** : un seul fichier HTML à ouvrir dans le navigateur.
- **Aucune donnée envoyée** : le backup `.zip` est lu directement dans le navigateur ; rien ne quitte le poste.
- **Mises à jour signalées** : au démarrage, un bandeau indique si une version plus récente est publiée (désactivable).
- **Pensé pour les systèmes à plusieurs sites** : tout se filtre par magasin (ou site) grâce au sélecteur du bandeau ; le magasin est déduit du code au début du nom des départements.
- **81 onglets** répartis en quatre sections, du tableau de bord jusqu'au simulateur d'appel.

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
| **Fiche magasin** | Lien « Rapport du département » pour chaque département du magasin. |
| **Suivi** | Évolution des indicateurs d'un backup à l'autre (service, problèmes, téléphones, parc), par système ou par magasin ; ajout d'anciens backups, export / import de l'historique. |
| **Comparaison** | Différences entre le backup actuel et un backup de référence : ajouts, suppressions, modifications champ par champ et journal d'audit de la période ; export CSV. |
| **Flux d'appels** | Chaque numéro (DID) avec sa règle entrante et l'arbre d'acheminement complet : département → standard IVR (touche par touche) → files d'attente → agents, pour les heures d'ouverture et hors heures. |
| **Flux d'appel (diagramme)** | Interrupteur « Portrait (lettre) » et impression PDF au format lettre. |
| **Simulateur d'appel** | Heures du département propriétaire d'une file, d'un menu ou d'un groupe de sonnerie. |
| **Contrôle des SDA** | Simulation de tous les SDA à des moments clés, problèmes regroupés par cause. |
| **SDA inutilisés** | SDA jamais appelés, plus appelés depuis longtemps ou très peu appelés, par trunk, avec l'économie possible. |
| **Pièges d'acheminement** | Boucles, destinations disparues ou désactivées, files, groupes et menus sans issue, SDA vers messagerie. |
| **Doublons et incohérences** | Postes, numéros présentés, éléments et SDA configurés deux fois ou de façon contradictoire. |
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
| **Clients qui rappellent** | Numéros d'exception exclus des calculs, ajout en lot et bouton « Exclure ». |
| **Historique client** | Chaque appel de la chronologie ouvre son parcours détaillé. |
| **Numéros importants** | Contacts clés suivis appel par appel : manqués, rappels en retard, délais, interlocuteurs ; alerte sur le tableau de bord. |
| **Réceptions** | Postes de réception : appels présentés, répondus, perdus, parking, appels simultanés et heures de surcharge. |
| **Délai avant réponse** | Temps d'attente du client avant qu'une personne décroche : médiane, 90 %, objectif, répartition, par heure, par magasin et par personne. |
| **Statistiques** | Comparaison des magasins sur une période et carte de chaleur jour × heure (appels entrants, perdus ou taux de perte, par magasin et par file), avec les appels de chaque créneau. |
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
| **Appels** | Fiche d'un appel : parcours détaillé étape par étape avec frise chronologique. |
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
| **Interface** | Thèmes prêts à l'emploi, couleur, densité, texte, coins, cartes, police, largeur, menu, onglet d'accueil et animations. |
| **Sécurité** | Droits d'administration, double authentification, renvois externes, appels internationaux, connexions et changements sensibles. |
| **Renvois externes** | Renvois vers des numéros externes : statuts, appels renvoyés, anciens employés, cellulaires de collègues, numéros inconnus. |
| **Appels suspects** | Démarchage et robots : rafales, plusieurs SDA appelés, appels très courts ou de nuit répétés, appels masqués par heure. |
| **Visibilité et droits** | Ce qu'un utilisateur voit et peut faire sur chaque poste, selon ses rôles par département. |
| **Matrice des droits** | Droits des rôles par département, droits propres et incohérences. |
| **Comparer deux utilisateurs** | Deux postes côte à côte et les changements pour aligner le second sur le premier. |
| **Fiche employé** | Bouton « Mises en attente » qui ouvre le rapport pour la même personne et la même période. |
| **Nouvel employé** | Fiche de création d'un poste sur le modèle d'un collègue, maintenant avec les renvois d'appel selon le statut. |
| **Départ d'un employé** | Fiche de départ : ce qui pointe vers le poste, ce qu'il faut retirer ou transmettre, avec un remplaçant facultatif. |
| **Absences et congés** | Absences prévues, éléments laissés sans personne, jours critiques, appels à répartir et remplaçants possibles. |
| **Ouverture d'un magasin** | Parkings partagés libres proposés et touches de parking à programmer, liés au Plan des parkings. |
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
│   ├── documentation.html          # guide de l'utilisateur : chaque menu expliqué
│   ├── documentation-en.html       # le même guide en anglais
│   ├── changelog.html              # Changelog : nouveautés de chaque version
│   ├── firmwares-3cx.js            # liste des firmwares recommandés par 3CX
│   └── anciennes-versions/         # versions précédentes (quand il y en a)
├── src/                            # sources
│   ├── versions.json               # liste des versions (titre, résumé, changements, onglets)
│   ├── documentation-modele.html   # modèle du Changelog
│   ├── guide-modele.html           # modèle du guide de l'utilisateur
│   ├── guide-modele-en.html        # modèle du guide en anglais
│   ├── guide.json                  # contenu du guide (un bloc par onglet, français et anglais)
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

Le générateur écrit la dernière version dans `app/` et les précédentes dans `app/anciennes-versions/`, injecte le menu des versions dans chaque page, produit le guide de l'utilisateur `app/documentation.html` et le Changelog `app/changelog.html`, fait pointer `index.html` vers la dernière version et met à jour ce README (tableau des versions, onglets, badge).

**Préparer un paquet à partager** avec des collègues :

```bash
python3 scripts/generer_interface.py --partage
```

Crée `dist/visualiseur-3cx-v<version>.zip` : seulement la dernière version, le guide de l'utilisateur, le Changelog, les fichiers des firmwares et un `LISEZMOI.txt`. Le menu ne propose que cette version (pas de liens morts). Si le fichier local `scripts/local/donnees-organisation.json` existe (jamais versionné), ses termes propres à votre organisation sont remplacés par des exemples neutres. Le zip n'est jamais ajouté au dépôt (`.gitignore`).

## ✅ Contrôle automatique

À chaque envoi sur GitHub, le contrôle **« Contrôle du dépôt »** (onglet *Actions* du dépôt) :
- régénère les pages et vérifie qu'elles correspondent aux sources envoyées ;
- vérifie qu'**aucun backup, export, enregistrement ou secret** n'est entré dans le dépôt ;
- vérifie que toutes les pages existent et que leurs liens (versions, guide, Changelog, firmwares) fonctionnent, et que chaque onglet est expliqué dans le guide ;
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
| **18.2.37** | Fuseau horaire lu dans le backup |
| 18.2.36 | Départements et Fiche magasin : plus de plantage sur un horaire incomplet |
| 18.2.35 | « Où est-ce utilisé ? » : texte des références protégé |
| 18.2.34 | Clients qui rappellent : numéros de l'entreprise reconnus avec un magasin choisi |
| 18.2.33 | Parkings : tous les clients perdus en parking sont listés |
| 18.2.32 | Exports CSV : une valeur ne peut plus devenir une formule dans Excel |
| 18.2.31 | Suivi dans le temps : fichier importé vérifié |
| 18.2.30 | Files d'attente : appels par heure à l'heure du système 3CX |
| 18.2.29 | Recommandations : enregistrements présents ou non dans le backup |
| 18.2.28 | Statistiques et Rapport : définition des appels perdus complète |
| 18.2.27 | Rapports de département et des mises en attente : jour de semaine calculé sans dépendre du fuseau |
| 18.2.26 | Rapport de département : sonneries comptées comme dans la Fiche employé |
| 18.2.25 | Rapport de département : menus communs pris en compte avec un magasin choisi |
| 18.2.24 | Ouverture d'un magasin : SDA du magasin modèle même avec un autre magasin choisi |
| 18.2.23 | Doublons : retrait d'un contrôle qui ne pouvait jamais se déclencher |
| 18.2.22 | Doublons : numéro présenté d'un autre magasin reconnu avec un magasin choisi |
| 18.2.21 | Fermer et rouvrir un backup : les boutons ne réagissent plus en double |
| 18.2.20 | Tableau de bord : nombre d'appels cohérent avec un magasin choisi |
| 18.2.19 | Ouverture d'un magasin : date du jour dans le fuseau du système 3CX |
| 18.2.18 | Taux d'occupation : date de début du journal des connexions dans le fuseau du système 3CX |
| 18.2.17 | Actions console : fériés des 7 prochains jours dans le fuseau du système 3CX |
| 18.2.16 | Suivi et Note de santé : modèle hors liste distingué d'une version inconnue |
| 18.2.15 | Comparaison : éléments supprimés comptés dans le bon magasin |
| 18.2.14 | Dates de backup affichées sans ambiguïté : Comparaison, Suivi et export Excel |
| 18.2.13 | Agents connectés : Organigramme, Départ d'un employé, références et Effectif |
| 18.2.12 | Parcours détaillé d'un appel : étape « Messagerie vocale » nommée |
| 18.2.11 | Appels très courts : les fax reçus ne sont plus comptés |
| 18.2.10 | Délai avant réponse : les fax reçus ne sont plus comptés |
| 18.2.9 | Numéros importants : mêmes règles de rappel qu'Appels manqués |
| 18.2.8 | Appels manqués : un numéro commun peut être rappelé par n'importe quel magasin |
| 18.2.7 | Historique d'un client : « rappelé » seulement par le magasin qui l'a manqué |
| 18.2.6 | Classement, Priorités et export Excel : objectif d'attente de chaque magasin |
| 18.2.5 | Avant / après : les deux backups simulés de la même façon |
| 18.2.4 | Simulateur d'appel : plus de plantage sans historique des connexions |
| 18.2.3 | Actions console : plus de chiffre propre à un autre système |
| 18.2.2 | Messages vocaux : date affichée à l'heure du système 3CX |
| 18.2.1 | Messageries vocales : heure des messages lue en UTC (correction de la 18.1.46) |
| 18.1.47 | Priorités : le total des appels touchés est présenté comme une somme |
| 18.1.46 | Messageries vocales : âge des messages dans le fuseau du système 3CX |
| 18.1.45 | Renvois externes : un poste qui répond à des appels transférés n'est plus « inactif » |
| 18.1.44 | Comparaison : compteurs limités au magasin choisi |
| 18.1.43 | Jours fériés récurrents qui chevauchent le Nouvel An |
| 18.1.42 | Suivi dans le temps : téléphones comptés comme dans l'onglet Téléphones |
| 18.1.41 | Avant / après : les numéros retirés restent visibles avec un magasin choisi |
| 18.1.40 | Nouvel employé et Départ : la fiche copiée n'a plus de codes HTML |
| 18.1.39 | Jours fériés : tous les fériés passés de l'historique |
| 18.1.38 | Absences et congés : appels habituels calculés sur l'historique disponible |
| 18.1.37 | Taux d'occupation : occupation par heure sans les agents écartés |
| 18.1.36 | Parcours détaillé d'un appel : plus de variables globales |
| 18.1.35 | Recommandations : éléments joignables par les heures d'un département plus signalés « jamais atteints » |
| 18.1.34 | Journal d'audit : mots de passe masqués aussi dans les réglages imbriqués |
| 18.1.33 | Date du backup affichée sans ambiguïté |
| 18.1.32 | Dates au choix inversées : prises dans le bon ordre partout |
| 18.1.31 | Ouverture d'un magasin : postes à 3 chiffres bien numérotés |
| 18.1.30 | Numéros importants : l'étoile fonctionne après un changement de magasin ou de backup |
| 18.1.29 | Nouveau menu (bêta) : l'interrupteur fonctionne après un changement de magasin |
| 18.1.28 | Agents connectés : même règle dans tous les onglets |
| 18.1.27 | Note de santé et Contrôle des SDA : même résultat pour un même numéro |
| 18.1.26 | Simulateur : un poste désactivé ne sonne pas |
| 18.1.25 | Simulateur : un groupe de sonnerie sans membre ne fait sonner personne |
| 18.1.24 | Taux d'occupation et Numéros importants : périodes en jours du système 3CX |
| 18.1.23 | Jours fériés à venir : « aujourd'hui » dans le fuseau du système 3CX |
| 18.1.22 | Changement d'heure : les jours de passage à l'heure d'été et d'hiver commencent à minuit |
| 18.1.21 | Licences : pic d'appels simultanés par jour du système 3CX |
| 18.1.20 | Réceptions : carte jour × heure dans le fuseau du système 3CX |
| 18.1.19 | Fiche magasin : heure de pointe dans le fuseau du système 3CX |
| 18.1.18 | Parkings partagés : heures et dates dans le fuseau du système 3CX |
| 18.1.17 | Tableau de bord et Recommandations : chaque appel compté dans un seul magasin |
| 18.1.16 | Recommandations : même taux d'appels perdus que les Statistiques |
| 18.1.15 | Fiche employé : même taux d'occupation que l'onglet Taux d'occupation |
| 18.1.14 | Destinations et coûts : numéros composés avec un préfixe |
| 18.1.13 | Prévision du volume : la tendance récente est de nouveau appliquée |
| 18.1.12 | Appels manqués : tentatives comptées depuis le dernier rappel |
| 18.1.11 | Appels manqués : un message laissé n'est plus « servi » |
| 18.1.10 | Appels manqués : une tentative de rappel sans réponse n'est plus un rappel |
| 18.1.9 | Appels manqués : un client n'est « rappelé » que par le magasin qui l'a manqué |
| 18.1.8 | Effectif, Classement et Priorités : période limitée aux dates du backup |
| 18.1.7 | Horaires : plus de fausses alertes avec un backup lu par une ancienne version |
| 18.1.6 | Horaires : un appel n'est plus compté deux fois dans le même département |
| 18.1.5 | Horaires : appels « par semaine » calculés sur toute la période |
| 18.1.4 | Fax reçus : plus comptés comme des appels perdus |
| 18.1.3 | Appels internes vers une file ou un menu : plus comptés comme répondus |
| 18.1.2 | Messagerie vocale des files et groupes : plus comptée comme un abandon |
| 18.1.1 | Messagerie vocale des employés : plus comptée comme un appel répondu |
| 18.1 | Diagramme en portrait (lettre) |
| 18.0 | Nouveau menu (bêta) |
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
- **Vérification des firmwares** : `scripts/verifier-firmwares.command` fonctionne sur macOS (Python 3) ; au premier lancement, clic droit > Ouvrir.

---

<sub>Projet privé — usage interne.</sub>

## 📄 Licence et avertissement

Distribué sous licence **MIT** (voir [`LICENSE`](LICENSE)).

3CXplore est un projet indépendant, sans lien avec 3CX Ltd. « 3CX » est une marque de son propriétaire, utilisée ici uniquement pour indiquer le système concerné. L'outil ne fait que lire un fichier de backup : il ne modifie jamais votre système 3CX.
