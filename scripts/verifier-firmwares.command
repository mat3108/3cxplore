#!/bin/bash
# Vérification en ligne des firmwares recommandés par 3CX.
# Double-cliquez sur ce fichier : il télécharge la liste officielle
# (https://www.3cx.com/docs/phone-firmwares/) et l'enregistre dans firmwares-3cx.js,
# à côté de l'interface : dossier app/ du projet, ou même dossier dans le paquet de partage.
# Rechargez ensuite la page du visualiseur.
cd "$(dirname "$0")" || exit 1
[ "$(basename "$PWD")" = scripts ] && [ -d ../app ] && cd ../app   # projet : écrire dans app/
/usr/bin/env python3 -I - <<'PY'
import datetime, html, json, re, sys, urllib.request

URL = "https://www.3cx.com/docs/phone-firmwares/"
try:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (verifier-firmwares 3CX)"})
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
except Exception as e:
    print("Échec du téléchargement de la liste 3CX :", e)
    sys.exit(1)

rows = re.findall(r'<tr[^>]*>\s*<td>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td>([^<]*)</td>\s*<td[^>]*>\s*<a href="([^"]+)"', page)
lst = [[html.unescape(m).strip(), v.strip(), u.strip().rsplit("/", 1)[-1], html.unescape(d).strip(), u.strip()] for m, v, d, u in rows]
if len(lst) < 20:
    print("La page 3CX a changé de format : seulement %d modèles reconnus. Utilisez le copier-coller dans l'interface." % len(lst))
    sys.exit(1)

data = {"date": datetime.date.today().isoformat(), "source": "script", "url": URL, "list": lst}
with open("firmwares-3cx.js", "w", encoding="utf-8") as f:
    f.write("// Généré par verifier-firmwares.command — liste officielle des firmwares 3CX\n")
    f.write("window.FW_3CX_FILE = " + json.dumps(data, ensure_ascii=False) + ";\n")
print("OK : %d modèles enregistrés dans firmwares-3cx.js (%s)." % (len(lst), data["date"]))
print("Rechargez la page du visualiseur (onglet Téléphones).")
PY
echo
read -n 1 -s -r -p "Appuyez sur une touche pour fermer…"
