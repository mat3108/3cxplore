#!/usr/bin/env python3
"""Contrôle du dépôt du Visualiseur 3CX (lancé par GitHub à chaque envoi, ou à la main).

Usage : python3 scripts/verifier_depot.py   (depuis la racine du projet)

Vérifie :
  1. qu'aucun fichier interdit n'est versionné (backups 3CX, archives, exports, enregistrements) ;
  2. qu'aucun fichier versionné ne contient de données d'un backup ni de secret ; si le fichier local
     scripts/local/donnees-organisation.json existe (jamais versionné), que la dernière version, la
     documentation, le README et les scripts ne contiennent aucun terme propre à l'organisation ;
  3. que versions.json est complet et que chaque version a son modèle ;
  4. que chaque page générée existe et que ses liens (menu des versions, documentation,
     liste des firmwares) mènent à des fichiers existants ;
  5. que le JavaScript de la dernière version est syntaxiquement correct (si Node.js est installé).
Code de sortie 1 au moindre problème.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ERREURS = []


def erreur(msg):
    ERREURS.append(msg)
    print("ERREUR :", msg)


def fichiers_versionnes():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=BASE, capture_output=True, check=True).stdout
    return [f for f in out.decode("utf-8").split("\0") if f]


# 1) fichiers interdits
INTERDITS = re.compile(r"(\.zip|\.csv|\.xlsx|\.wav|\.mp3|\.bak|\.db|\.sqlite)$|(^|/)(backup_extrait|DbTables|dist)/|Db\.xml$", re.I)
# 2) marqueurs de données de backup ou de secrets (motifs découpés pour ne pas se détecter eux-mêmes)
MARQUEURS = [re.compile(p) for p in (
    "AZURE" + "_USER_ID", "DESKPHONE" + "_PASSWORD", "USER_SECRET" + "_2FA",
    "<" + "Tenants>", "BEGIN (RSA |EC |OPENSSH )?" + "PRIVATE KEY",
    "gh" + r"p_[A-Za-z0-9]{30,}", "github" + "_pat_[A-Za-z0-9_]{30,}")]


# termes propres à l'organisation : uniquement dans un fichier local, jamais versionné
def donnees_organisation():
    try:
        with open(os.path.join(BASE, "scripts", "local", "donnees-organisation.json"), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def main():
    os.chdir(BASE)
    org = donnees_organisation()
    MARQUEURS.extend(re.compile(p) for p in org.get("marqueurs", []))
    fichiers = fichiers_versionnes()
    for f in fichiers:
        if INTERDITS.search(f):
            erreur("fichier interdit dans le dépôt : %s" % f)
    for f in fichiers:
        if not os.path.isfile(f):
            continue
        try:
            texte = open(f, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        for m in MARQUEURS:
            if m.search(texte):
                erreur("donnée sensible possible (%s) dans %s" % (m.pattern, f))

    # 3) versions.json et modèles
    versions = json.load(open("src/versions.json", encoding="utf-8"))
    # 2 bis) la dernière version et les fichiers communs ne contiennent aucun terme propre à l'organisation
    if org.get("a_surveiller"):
        cle0 = lambda v: [int(x) for x in v["version"].split(".")]
        der = sorted([v for v in versions if not v.get("retiree")], key=cle0, reverse=True)[0]["version"]
        propres = ["src/versions/%s/modele.html" % der, "app/visualiseur-3cx-v%s.html" % der, "app/documentation.html", "app/firmwares-3cx.js",
                   "src/versions.json", "src/documentation-modele.html", "README.md", "index.html", ".gitignore", ".github/workflows/verification.yml"] + \
                  [f for f in fichiers if f.startswith("scripts/")] + [f for f in fichiers if f.startswith("assets/")]
        for f in sorted(set(propres)):
            if not os.path.isfile(f):
                continue
            try:
                texte = open(f, encoding="utf-8").read()
            except UnicodeDecodeError:  # fichiers binaires (icônes PNG)
                continue
            restes = sorted({w for w in org["a_surveiller"] if w in texte})
            if restes:
                erreur("terme propre à l'organisation dans %s : %s" % (f, ", ".join(restes)))
    vus = set()
    for v in versions:
        for k in ("version", "date", "titre", "resume", "changements"):
            if not v.get(k):
                erreur("versions.json : champ « %s » manquant pour la version %s" % (k, v.get("version", "?")))
        if v.get("version") in vus:
            erreur("versions.json : version %s en double" % v["version"])
        vus.add(v.get("version"))
        if not v.get("retiree") and not os.path.isfile("src/versions/%s/modele.html" % v["version"]):
            erreur("modèle absent : src/versions/%s/modele.html" % v["version"])
    cle = lambda v: [int(x) for x in v["version"].split(".")]
    actives = sorted([v for v in versions if not v.get("retiree")], key=cle, reverse=True)

    # 4) pages générées et liens
    pages = ["app/visualiseur-3cx-v%s.html" % actives[0]["version"]] + \
            ["app/anciennes-versions/visualiseur-3cx-v%s.html" % v["version"] for v in actives[1:]] + ["app/documentation.html", "index.html"]
    for p in pages:
        if not os.path.isfile(p):
            erreur("page absente : %s" % p)
            continue
        html = open(p, encoding="utf-8").read()
        dossier = os.path.dirname(p)
        liens = re.findall(r'<option value="([^"$]+\.html)"', html) + re.findall(r'<a class="open" href="([^"]+\.html)"', html) + \
            re.findall(r'<div class="vmenu[^"]*">.*?<a href="([^"]+)">Documentation</a>', html) + re.findall(r'<script src="([^"]*firmwares[^"]*)"', html) + \
            re.findall(r'url=([^"]+\.html)"', html)
        for lien in set(liens):
            if not os.path.isfile(os.path.normpath(os.path.join(dossier, lien))):
                erreur("lien cassé dans %s : %s" % (p, lien))
    if os.path.isfile("index.html") and ("app/visualiseur-3cx-v%s.html" % actives[0]["version"]) not in open("index.html", encoding="utf-8").read():
        erreur("index.html ne mène pas à la dernière version (%s)" % actives[0]["version"])

    # 5) syntaxe JavaScript de la dernière version
    node = shutil.which("node")
    if node and os.path.isfile(pages[0]):
        html = open(pages[0], encoding="utf-8").read()
        blocs = re.findall(r'<script type="text/x-app" id="app">(.*?)</script>', html, re.S)
        blocs = ["(function(D){\n%s\n})" % b for b in blocs] + [b for b in re.findall(r"<script>(.*?)</script>", html, re.S)]
        for i, b in enumerate(blocs):
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as t:
                t.write(b)
            r = subprocess.run([node, "--check", t.name], capture_output=True, text=True)
            os.unlink(t.name)
            if r.returncode:
                erreur("JavaScript invalide dans %s (bloc %d) :\n%s" % (pages[0], i + 1, r.stderr.strip()[:800]))
    elif not node:
        print("Node.js absent : contrôle de la syntaxe JavaScript ignoré.")

    print("\n%d fichiers versionnés, %d versions, %d pages contrôlées." % (len(fichiers), len(actives), len(pages)))
    if ERREURS:
        print("ÉCHEC : %d problème(s)." % len(ERREURS))
        sys.exit(1)
    print("OK : aucun problème.")


if __name__ == "__main__":
    main()
