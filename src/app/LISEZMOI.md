# Sources de 3CXplore (depuis 19.0) — [in English](README.md)

Le code de la dernière version est ici. **Vite** le construit en **une seule page HTML autonome**
(`mise run build`, qui en fait ensuite `app/visualiseur-3cx-v<version>.html`).

```bash
mise run dev      # http://localhost:5173 — la page se recharge à chaque enregistrement
mise run build    # construit toutes les pages
mise run check    # contrôle du dépôt (le même que sur GitHub)
```

Avec `mise run dev`, la page rouvre le dernier backup chargé (il est conservé dans le navigateur).
Les données restent locales, comme dans la vraie page.

## Comment la page est assemblée

| Dans | Écriture | Devient |
|---|---|---|
| `index.html` | `<script inline src="./js/appearance.js"></script>` | `<script>` + le fichier + `</script>` |
| un fichier `.js` | `//#include core/helpers.js` | le contenu du fichier, à cet endroit |
| `index.html` | `<link rel="stylesheet" href="./css/styles.css">` | un seul `<style>` (Vite réunit les `@import`) |

Rien n'est ajouté autour : la page est la simple concaténation des sources, dans l'ordre. Chaque
fichier se termine par un retour à la ligne. L'insertion est faite par `scripts/vite-inline-scripts.mjs`.

Repères remplis par `scripts/generate.mjs` : `__ROOT__` (racine du site), `__APP_VERSION__` (numéro
de version) et `<!--__VERSION_MENU__-->` (menu des versions). Avec `mise run dev`, les deux premiers
sont remplis par l'extension Vite.

## Organisation

```
index.html                 structure de la page (bandeau, menu, zone principale) et ordre des blocs
css/styles.css             -> base, side-menu, modern-finish, geek-themes
js/i18n/i18n.js            traduction français -> anglais (en-dictionary.js, en-templates.js)
js/appearance.js           thèmes et options d'affichage, appliqués avant l'affichage
js/updates.js              vérification des mises à jour et installation
js/loader/loader.js        lecture du backup dans le navigateur : zip, csv, xml, build-data (objet D),
                           storage-and-startup (IndexedDB), empty-state, close, timezone
js/app/app.js              ordre des fichiers de l'application :
  core/                    outils, segmentation par magasin, tables, tiroir, arbres et diagrammes de flux
  tabs/                    un fichier par onglet (ou groupe d'onglets voisins)
  ui/                      navigation (TABS, menus), recherche, palette de commandes, notes, export Excel,
                           sauvegarde des réglages, visite guidée
```

## Pourquoi des scripts classiques et pas des modules ES

Le code de `js/app/` est placé dans `<script type="text/x-app" id="app">` et exécuté à nouveau à
l'ouverture de **chaque** backup (`new Function('D', …)` dans `js/loader/storage-and-startup.js`).
Tous ses fichiers partagent donc **la même portée** : une constante déclarée dans `core/helpers.js`
est visible dans tous les onglets, et **l'ordre de `app.js` compte** (une constante doit être déclarée
avant d'être utilisée au premier niveau). Les scripts du `<head>` (langue, apparence) doivent aussi
s'exécuter avant l'affichage, ce que des modules ES (toujours différés) ne font pas.

## Ajouter un onglet

1. Créer `js/app/tabs/<nom>.js`.
2. L'ajouter dans `js/app/app.js`, avant `ui/navigation.js`.
3. Le déclarer dans `TABS` et les menus (`ui/navigation.js`, `ui/simplified-menu.js`, `ui/new-menu.js`).
4. L'expliquer dans `src/guide.json` (français et anglais) ; `mise run check` le vérifie.
5. Les textes affichés sont écrits en français ; ajouter leur traduction dans `js/i18n/en-dictionary.js`.
