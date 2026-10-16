#!/bin/bash
# Vérification en ligne des firmwares recommandés par 3CX.
# Double-cliquez sur ce fichier : il télécharge la liste officielle
# (https://www.3cx.com/docs/phone-firmwares/) et l'enregistre dans firmwares-3cx.js,
# à côté de l'interface : dossier app/ du projet, ou même dossier dans le paquet de partage.
# Rechargez ensuite la page du visualiseur.
#
# Checks the official 3CX phone firmware list online and saves it to firmwares-3cx.js (next to the page).
# Only uses what every Mac has: curl and JavaScript for Automation (osascript), nothing to install.
cd "$(dirname "$0")" || exit 1
[ "$(basename "$PWD")" = scripts ] && [ -d ../app ] && cd ../app   # projet : écrire dans app/

URL="https://www.3cx.com/docs/phone-firmwares/"
PAGE="$(mktemp -t firmwares3cx)" || exit 1
trap 'rm -f "$PAGE"' EXIT
if ! curl -fsSL --max-time 30 -A "Mozilla/5.0 (verifier-firmwares 3CX)" "$URL" -o "$PAGE"; then
  echo "Échec du téléchargement de la liste 3CX ($URL)."
  exit 1
fi

/usr/bin/osascript -l JavaScript - "$PAGE" "$URL" "$PWD/firmwares-3cx.js" <<'JS'
ObjC.import('Foundation');
function run(argv) {
  const [pageFile, url, out] = argv;
  const page = $.NSString.stringWithContentsOfFileEncodingError(pageFile, $.NSUTF8StringEncoding, null).js || '';
  const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à' };
  const unescape = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#'
    ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10))
    : (NAMED[e] ?? m));
  const re = /<tr[^>]*>\s*<td>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>\s*<a href="([^"]+)"/g;
  const list = [...page.matchAll(re)].map(([, m, v, d, u]) => [unescape(m).trim(), v.trim(), u.trim().split('/').pop(), unescape(d).trim(), u.trim()]);
  if (list.length < 20) throw new Error(`La page 3CX a changé de format : seulement ${list.length} modèles reconnus. Utilisez le copier-coller dans l'interface.`);
  const date = new Date().toISOString().slice(0, 10);
  const js = '// Généré par verifier-firmwares.command — liste officielle des firmwares 3CX\n'
    + 'window.FW_3CX_FILE = ' + JSON.stringify({ date, source: 'script', url, list }) + ';\n';
  if (!$(js).writeToFileAtomicallyEncodingError(out, true, $.NSUTF8StringEncoding, null)) throw new Error(`Impossible d'écrire ${out}.`);
  return `OK : ${list.length} modèles enregistrés dans firmwares-3cx.js (${date}).\nRechargez la page du visualiseur (onglet Téléphones).`;
}
JS
status=$?
echo
[ -t 0 ] && read -n 1 -s -r -p "Appuyez sur une touche pour fermer…"
exit $status
