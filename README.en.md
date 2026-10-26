<p align="center"><img src="assets/logo.svg" alt="3CXplore" width="440"></p>

# 🔎 3CXplore

> *Explore your 3CX in depth* — [version française](README.md).
>
> A fully local web interface to **explore, analyse and audit a 3CX V20 phone system from its backup file**: configuration, call flows, statistics, security and recommendations, store by store.

![Version](https://img.shields.io/badge/version-20.8-2563eb)
![3CX](https://img.shields.io/badge/3CX-V20-0d9488)
![Data](https://img.shields.io/badge/data-100%25%20local-15803d)

---

## ✨ In short

- **Nothing to install**: a single HTML file to open in the browser.
- **No data sent anywhere**: the backup `.zip` is read directly in the browser; nothing leaves the computer.
- **Update notice**: at start-up, a banner says when a newer version is published (can be turned off).
- **Built for a centralised system**: everything can be filtered by store with the selector in the header.
- **French or English**: the EN / FR button in the header switches the whole interface.

## 🚀 Getting started

1. Open **`index.html`** (it redirects to the latest version, in `app/`) in Chrome or Edge.
2. In the **Dashboard**, choose or drag and drop a 3CX backup (`.zip`).
3. Pick a store in the header, or stay on "All stores".

The backup stays stored in the browser until **"Close the backup"**, which lets you choose what is erased.
The user guide is in [`app/documentation-en.html`](app/documentation-en.html).

## 🧭 Tabs

<!-- ONGLETS:START -->
### Overview
Home · Dashboard · Priorities · Health score · Recommendations · Console actions · Report · Store sheet · Tracking · Comparison · Call flows · Call flow (diagram) · Call simulator · DID check · Unused DIDs · No outbound caller ID · 911 calls · Routing traps · Duplicates and inconsistencies · Before / after

### Configuration
Extensions · Phones · BLF keys · Key template · Numbering plan · Departments · Org chart · Holidays · Queues · IVR menus · Ring groups · Trunks · Outbound rules · Phonebook

### Activity
Missed calls · Repeat callers · Number sheet · Customer history · Key numbers · Receptions · Time to answer · Statistics · Générateur de rapport · Chart generator · Department report · Call origin · Outbound call destinations · Outbound call costs · Internal calls · Agents · Agent occupancy · Key people · Volume forecast · Staffing by call volume · Store ranking · Very short calls · Call quality · Hours · IVR menus · Calls · Shared parking · Parking plan · Queue calls · Recordings · Voicemail & audio · Voicemail boxes

### System
Targets · Compare stores · Licences and extensions · Stores · Settings backup · Interface · Security · External forwards · Suspicious calls · Visibility and rights · Rights matrix · Compare two users · Employee sheet · Fixes by user · New employee · Employee departure · Employee change · Absences and leave · Opening a store · Employee history · Changes · Audit log · Parameters · Who can leave a message?
<!-- ONGLETS:END -->

## 🔒 Privacy

- The backup is **read in the browser** (built-in ZIP reader) and stored locally (IndexedDB); **nothing is sent over the Internet**.
- The only Internet request: at start-up (at most once a day), the tool asks GitHub for the number of the latest published version of 3CXplore. No backup data is sent; the option can be turned off in the **Interface** tab.
- **Passwords, PINs, secrets and keys** are hidden or ignored when the backup is read.
- This repository **contains no data**: backups (`*.zip`) and exports (`*.csv`, settings) are excluded by [`.gitignore`](.gitignore).

> ⚠️ **Never add a 3CX backup to this repository**: it contains the system's calls, recordings, voicemails and credentials.

## 🧑‍💻 Development

Requirement: [mise](https://mise.jdx.dev) (it installs the right Node version). Run every command from the project root; `mise tasks` lists them.

| Command | What it does |
|---|---|
| `mise run dev` | Edit: serves `src/app/` at http://localhost:5173; the page reloads on every save. |
| `mise run build` | Builds every page (latest version, older versions, guide, changelog, READMEs). |
| `mise run check` | Repository check (the same one GitHub runs). |
| `mise run preview` | Serves the built site at http://localhost:4173. |
| `mise run package` | Builds the share package `dist/visualiseur-3cx-v<version>.zip`. |
| `mise run firmwares` | Downloads the official 3CX firmware list into `app/firmwares-3cx.js` (macOS). |
| `mise run ci` | What GitHub runs: build, compare with the committed pages, check. |

**Source code (since 19.0)**: the code is split across `src/app/` (about 120 files: one per tab, plus the core, the translation, the backup loader and the styles). **Vite** builds it into **one self-contained HTML page**: styles are joined with `@import`, and scripts (`<script inline src="…">`, `//#include …`) are inserted in place, with nothing added. See [`src/app/README.md`](src/app/README.md).

```
src/app/
├── index.html          the page: HTML structure, styles and scripts
├── css/                styles
└── js/
    ├── i18n/           French → English translation of the interface
    ├── appearance.js   themes and display options (applied before first paint)
    ├── updates.js      update check and installation
    ├── loader/         reads the backup in the browser: zip, csv, xml → the data object D
    └── app/            the application: core/, tabs/ (one file per tab), ui/
```

`mise run build` writes the latest version to `app/` and the older ones to `app/anciennes-versions/`, adds the version menu to every page, builds the user guide and the changelog, points `index.html` at the latest version and updates the generated parts of the READMEs. Versions from 19.0 on that are no longer the latest are rebuilt from their git tag `v<version>`.

### Versions

Every change is a new version: a change in `src/app/`, an entry at the top of `src/versions.json`, `mise run build`, a commit, a tag `v<version>` and a GitHub release with the share package. Older versions stay available from the menu at the top right of the interface. The full history (in French) is in [`app/changelog.html`](app/changelog.html).

### Automatic check

On every push, GitHub's **"Contrôle du dépôt"** workflow runs `mise run ci`: it builds the pages with Vite and checks they match the committed ones, that **no backup, export, recording or secret** was committed, that every page and link exists, that every tab is explained in the guide, that every file in `src/app/` is used, and that the latest version's JavaScript compiles.

## 💻 Compatibility

- **Browsers**: Chrome and Edge recommended (ZIP reading via `DecompressionStream`).
- **3CX**: V20 backups (`*Db.xml` and `DbTables/*.csv` tables).
- **Firmware check**: `scripts/verifier-firmwares.command` runs on macOS with nothing to install; on first launch, right-click > Open.
