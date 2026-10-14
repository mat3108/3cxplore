#!/usr/bin/env python3
"""Génère l'interface de visualisation 3CX à partir d'un backup V20 extrait dans backup_extrait/.

Usage : python3 scripts/generer_interface.py              (depuis la racine du projet)
        python3 scripts/generer_interface.py --partage   (crée aussi le zip de partage dans dist/)

Pour chaque version listée dans src/versions.json, le modèle src/versions/<n>/modele.html
produit visualiseur-3cx-v<n>.html : la dernière version dans app/, les précédentes dans
app/anciennes-versions/. Sont aussi générés app/documentation.html (une section par version)
et index.html, qui redirige vers la version la plus récente.
Les mots de passe, PIN, secrets et clés de licence sont exclus des pages.
Si aucune version active n'intègre de données (cas actuel), backup_extrait/ n'est pas nécessaire.
Le tableau des versions de README.md (entre les marqueurs VERSIONS:START / VERSIONS:END) et le
badge de version sont mis à jour à chaque génération.
Avec --partage : dist/visualiseur-3cx-v<n>.zip contient seulement la dernière version, sa documentation,
les fichiers des firmwares et un LISEZMOI ; le menu ne propose que cette version. Si scripts/local/donnees-organisation.json
existe (fichier local, jamais versionné), ses termes propres à l'organisation sont remplacés par des exemples neutres.
"""
import csv
import glob
import json
import os
import re
import sys
import stat
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # racine du projet
SRC = os.path.join(BASE, "backup_extrait")
VERSIONS_DIR = os.path.join(BASE, "src", "versions")
VERSIONS_JSON = os.path.join(BASE, "src", "versions.json")
DOC_TEMPLATE = os.path.join(BASE, "src", "documentation-modele.html")
APP = os.path.join(BASE, "app")
OLD = os.path.join(APP, "anciennes-versions")
DIST = os.path.join(BASE, "dist")
MODELE = "modele.html"
csv.field_size_limit(10**9)

SENSITIVE = re.compile(r"PASS|PIN$|SECRET|TOKEN|LICENSEKEY|RPS_KEY|QUICKMEETING|JWT|APIKEY|API_KEY|HASH|CREDENTIAL|PRIVATE_?KEY", re.I)


def txt(e, tag, default=""):
    v = e.findtext(tag)
    return v.strip() if v else default


def read_csv(name):
    p = os.path.join(SRC, "DbTables", name + ".csv")
    if not os.path.exists(p):
        return []
    with open(p, newline="", encoding="utf-8", errors="replace") as f:
        return list(csv.DictReader(f))


def iso(ts):
    """'2026-07-28 13:27:46.531577+00' -> '2026-07-28T13:27:46Z'"""
    if not ts:
        return ""
    return ts[:19].replace(" ", "T") + "Z"


def secs(a, b):
    if not a or not b:
        return 0
    f = "%Y-%m-%d %H:%M:%S"
    try:
        return max(0, int((datetime.strptime(b[:19], f) - datetime.strptime(a[:19], f)).total_seconds()))
    except ValueError:
        return 0


def interval_s(v):
    """'00:00:24.523629' -> 24"""
    if not v:
        return 0
    try:
        h, m, s = v.split(":")
        return int(int(h) * 3600 + int(m) * 60 + float(s))
    except ValueError:
        return 0


def dest(e):
    """Élément avec <To> + <Internal DN> / <External> -> dict."""
    if e is None:
        return None
    to = txt(e, "To")
    if not to:
        return None
    i = e.find("Internal")
    return {"to": to, "dn": i.get("DN", "") if i is not None else "", "ext": txt(e, "External")}


def route_str(s):
    """'IVR.9100.' -> dict"""
    if not s:
        return None
    parts = (s + "..").split(".")
    return {"to": parts[0], "dn": parts[1], "ext": parts[2]}


def hours(e):
    h = e.find("Hours") if e is not None else None
    if h is None:
        return None
    days = []
    for pd in h.findall("PeriodsOfDay"):
        days.append({"day": pd.get("DayOfWeek"), "p": [[p.get("begin"), p.get("end")] for p in pd.findall("PeriodOfDay")]})
    return {"type": h.get("HoursType", ""), "days": days}


def props(e):
    out = {}
    pe = e.find("Properties")
    if pe is None:
        return out
    for p in pe:
        n = txt(p, "Name")
        if n and not SENSITIVE.search(n):
            out[n] = txt(p, "Value")
    return out


def flatten_routes(e, path=""):
    """Parcourt un FwdProfile et retourne [(chemin, dest)] pour chaque nœud contenant <To>."""
    res = []
    for c in e:
        if c.find("To") is not None:
            d = dest(c)
            if d:
                res.append([(path + " › " + c.tag).strip(" ›"), d])
        elif len(c):
            res += flatten_routes(c, (path + " › " + c.tag).strip(" ›"))
    return res


def needs_data():
    """Vrai si une version active de l'interface intègre encore les données du backup."""
    with open(VERSIONS_JSON, encoding="utf-8") as f:
        versions = json.load(f)
    for v in versions:
        if v.get("retiree"):
            continue
        with open(os.path.join(VERSIONS_DIR, v["version"], MODELE), encoding="utf-8") as f:
            if "/*__DATA__*/null" in f.read():
                return True
    return False


def main():
    if not needs_data():
        # Aucune page n'intègre de données : le backup est choisi dans l'interface.
        build_versions("null", None)
        return
    xmls = glob.glob(os.path.join(SRC, "*Db.xml"))
    if not xmls:
        sys.exit("Aucun fichier *Db.xml dans backup_extrait/")
    root = ET.parse(xmls[0]).getroot()
    ten = root.find("Tenants/Tenant")
    D = {}

    D["info"] = {
        "version": txt(root, "header/version"),
        "date": txt(root, "header/Date"),
        "company": txt(root, "license/company"),
        "contact": txt(root, "license/contact"),
        "email": txt(root, "license/email"),
        "phone": txt(root, "license/phone"),
        "country": txt(root, "license/country"),
        "fqdn": txt(root, "fqdn/externalFqdn"),
        "internalFqdn": txt(root, "fqdn/internalFqdn"),
        "mailHost": txt(root, "mailSettings/mailServerHost"),
        "mailPort": txt(root, "mailSettings/mailServerPort"),
        "mailFrom": txt(root, "mailSettings/mailFromAddress"),
        "backupPath": txt(root, "generalSettings/backupPath"),
        "recordingPath": txt(root, "generalSettings/recordingPath"),
        "codecs": [c.findtext("RFCName") or c.get("RFCName") or (c.text or "").strip() for c in root.find("Codecs") or []],
    }

    # ---------- Paramètres système ----------
    params = []
    for p in root.findall("Parameters/Parameter"):
        n = txt(p, "Name")
        v = txt(p, "Value")
        if SENSITIVE.search(n):
            v = "•••• (masqué)" if v else ""
        params.append({"name": n, "value": v[:500], "desc": txt(p, "Description"), "scope": "Système"})
    for p in ten.findall("Properties/TenantProperty"):
        n = txt(p, "Name")
        if n.startswith("BILL_0"):
            continue
        v = txt(p, "Value")
        if SENSITIVE.search(n):
            v = "•••• (masqué)" if v else ""
        params.append({"name": n, "value": v[:500], "desc": txt(p, "Description"), "scope": "Tenant"})
    D["params"] = params

    # ---------- Groupes (départements) ----------
    groups = []
    ext_groups = defaultdict(list)
    for g in ten.findall("Groups/Group"):
        members = []
        for m in g.findall("Members/Member"):
            role = m.find("role")
            rn = role.get("name", "") if role is not None else ""
            primary = m.get("IsPrimary") == "true"
            members.append({"dn": m.get("DN"), "role": rn, "primary": primary})
            ext_groups[m.get("DN")].append({"g": txt(g, "Name"), "role": rn, "primary": primary})
        groups.append({
            "number": txt(g, "Number"),
            "name": txt(g, "Name"),
            "members": members,
            "hours": hours(g),
            "breakTime": hours(g.find("BreakTime")) if g.find("BreakTime") is not None and len(g.find("BreakTime")) else None,
            "holidays": [h.findtext("Name") or ET.tostring(h, encoding="unicode")[:80] for h in g.findall("OfficeHolidays/*")],
            "routes": {
                "office": route_str(txt(g, "OfficeHoursRoute")),
                "outOfOffice": route_str(txt(g, "OutOfOfficeHoursRoute")),
                "holidays": route_str(txt(g, "HolidaysRoute")),
                "break": route_str(txt(g, "BreakTimeRoute")),
            },
            "prompts": {
                "office": txt(g, "OfficeHoursRoutePrompt"),
                "outOfOffice": txt(g, "OutOfOfficeHoursRoutePrompt"),
                "break": txt(g, "BreakTimeRoutePrompt"),
                "holidays": txt(g, "HolidaysRoutePrompt"),
            },
            "operator": dest(g.find("CustomOperator")),
            "phonebook": len(g.findall("PhoneBookEntries/PhoneBookEntry")),
        })
    D["groups"] = groups

    # ---------- DN ----------
    queues, ivrs, rgs, exts, lines, parks = [], [], [], [], [], []
    ext_queues = defaultdict(list)
    ext_rgs = defaultdict(list)
    for q in ten.findall("DN/Queue"):
        num = txt(q, "Number")
        mem = [{"dn": m.get("DN"), "status": m.get("QueueStatus", ""), "skill": m.get("SkillGroup", "")} for m in q.findall("Members/Member")]
        for m in mem:
            ext_queues[m["dn"]].append(num)
        queues.append({
            "number": num, "name": txt(q, "Name"),
            "strategy": txt(q, "PollingStrategy"),
            "ringTimeout": txt(q, "RingTimeout"), "masterTimeout": txt(q, "MasterTimeout"),
            "intro": txt(q, "IntroFile"), "introEnabled": txt(q, "EnableIntro") == "True",
            "moh": txt(q, "OnHoldFile"),
            "announcePos": txt(q, "AnnounceQueuePosition") == "True", "announceInterval": txt(q, "AnnouncementInterval"),
            "dest": dest(q.find("Destination")),
            "members": mem,
            "managers": [m.get("DN") for m in q.findall("QueueManagers/Manager")],
            "props": {k: v for k, v in props(q).items()},
            "routes": {"office": route_str(txt(q, "OfficeHoursRoute")), "outOfOffice": route_str(txt(q, "OutOfOfficeHoursRoute"))},
        })
    for i in ten.findall("DN/IVR"):
        ivrs.append({
            "number": txt(i, "Number"), "name": txt(i, "Name"),
            "prompt": txt(i, "PromptFilename"), "timeout": txt(i, "Timeout"),
            "timeoutType": txt(i, "TimeoutForwardType"), "timeoutDN": txt(i, "TimeoutForwardDN"),
            "invalidDN": txt(i, "InvalidKeyForwardDN"),
            "options": [{"key": txt(f, "Number"), "type": txt(f, "ForwardType"), "dn": txt(f, "ForwardDN"), "data": txt(f, "CustomData")} for f in i.findall("Forwards/IVRForward")],
            "props": props(i),
            "routes": {"office": route_str(txt(i, "OfficeHoursRoute")), "outOfOffice": route_str(txt(i, "OutOfOfficeHoursRoute"))},
        })
    for r in ten.findall("DN/RingGroup"):
        num = txt(r, "Number")
        mem = [m.get("DN") for m in r.findall("Members/Member")]
        for m in mem:
            ext_rgs[m].append(num)
        rgs.append({"number": num, "name": txt(r, "Name"), "strategy": txt(r, "RingStrategy"),
                    "ringTime": txt(r, "RingTime"), "members": mem, "dest": dest(r.find("Destination"))})
    for p in ten.findall("DN/ParkExtension"):
        parks.append(txt(p, "Number"))

    for e in ten.findall("DN/Extension"):
        num = txt(e, "Number")
        pr = props(e)
        devices = []
        for d in e.findall("PhoneDevices/PhoneDevice"):
            st = d.findtext("Settings") or ""
            def attr(n):
                m = re.search(n + r'="([^"]*)"', st)
                return m.group(1) if m else ""
            devices.append({
                "mac": txt(d, "MAC"), "template": txt(d, "TemplateFilename"),
                "model": (txt(d, "ProvisioningFilename2").split("-")[0] if txt(d, "ProvisioningFilename2") else ""),
                "iface": txt(d, "Interface"), "firmware": attr("Firmware"), "lang": attr("PhoneLanguage"),
                "sbc": attr("SbcName"), "xfer": attr("XferType"),
            })
        profiles = []
        for fp in e.findall("FwdProfiles/FwdProfile"):
            profiles.append({"name": txt(fp, "Name"), "display": txt(fp, "DisplayName"), "noAnswer": txt(fp, "NoAnswerTimeout"),
                             "ringMobile": txt(fp, "RingMyMobile"), "routes": flatten_routes(fp)})
        exts.append({
            "number": num, "first": txt(e, "FirstName"), "last": txt(e, "LastName"),
            "email": txt(e, "EmailAddress"), "callerId": txt(e, "OutboundCallerID"),
            "mobile": pr.get("MOBILENUMBER", ""),
            "enabled": txt(e, "Enabled") == "True", "profile": txt(e, "CurrentProfile"),
            "queueStatus": txt(e, "QueueStatus"), "userStatus": txt(e, "UserStatus"),
            "record": txt(e, "RecordCalls") == "True", "vm": txt(e, "VMEnabled") == "True",
            "vmEmail": txt(e, "VMEmailOptions"), "noAnswer": txt(e, "NoAnswerTimeout"),
            "lanOnly": pr.get("ALLOW_LAN_ONLY") == "1", "azure": pr.get("AZURE_UPN", ""),
            "groups": ext_groups.get(num, []), "queues": ext_queues.get(num, []), "ringGroups": ext_rgs.get(num, []),
            "devices": devices, "profiles": profiles,
            "props": {k: v for k, v in pr.items() if not k.startswith(("MYPHONETEMPLATEINFO", "SHARED_BLFS", "LASTUPDATED", "EXTGUID"))},
        })

    for l in ten.findall("DN/ExternalLine"):
        rules = []
        for rr in l.findall("RoutingRules/ExternalLineRule"):
            fd = rr.find("ForwardDestinations")
            conds = rr.find("Conditions")
            rules.append({
                "name": txt(rr, "RuleName"), "data": txt(rr, "Data"),
                "cond": conds.find("Condition").get("Type") if conds is not None and conds.find("Condition") is not None else "",
                "callType": conds.find("CallType").get("Type") if conds is not None and conds.find("CallType") is not None else "",
                "hours": (rr.find("Hours").get("HoursType") if rr.find("Hours") is not None else ""),
                "office": dest(fd.find("OfficeHoursDestination")) if fd is not None else None,
                "outOfOffice": dest(fd.find("OutOfOfficeHoursDestination")) if fd is not None else None,
                "holidays": dest(fd.find("HolidaysDestination")) if fd is not None else None,
                "altOOO": txt(fd, "AlterDestinationDuringOutOfOfficeHours") == "True" if fd is not None else False,
                "altHol": txt(fd, "AlterDestinationDuringHolidays") == "True" if fd is not None else False,
            })
        lines.append({
            "number": txt(l, "Number"), "gateway": txt(l, "Gateway"), "extNumber": txt(l, "ExternalNumber"),
            "direction": txt(l, "Direction"), "sim": txt(l, "SimultaneousCalls"),
            "dids": [d for d in txt(l, "DIDNumbers").split(",") if d], "rules": rules,
        })

    gws = []
    for g in root.find("Gateways") or []:
        gws.append({
            "kind": g.tag, "name": txt(g, "Name"), "type": txt(g, "Type"), "host": txt(g, "Host"), "port": txt(g, "Port"),
            "proxy": txt(g, "ProxyHost"), "template": txt(g, "TemplateFilename"), "reg": txt(g, "RequireRegistrationFor"),
            "srtp": txt(g, "SRTPMode"), "codecs": [c.get("RFCName") for c in g.findall("Codecs/codec")],
            "regTime": txt(g, "TimeBetweenReg"),
        })

    outbound = []
    for o in ten.findall("OutboundRules/OutboundRule"):
        outbound.append({
            "name": txt(o, "Name"), "prefix": txt(o, "Prefix"), "priority": int(txt(o, "Priority", "0") or 0),
            "lengths": txt(o, "NumberLengthRanges"), "callerFilter": txt(o, "DNRanges"),
            "groups": [x.text or x.get("Name", "") for x in o.findall("DNGroups/*")],
            "ranges": [ET.tostring(x, encoding="unicode") for x in o.findall("DNRanges/*")],
            "routes": [{"gw": txt(r, "Gateway"), "strip": txt(r, "StripDigits"), "prepend": txt(r, "Prepend"), "cid": txt(r, "CallerID")}
                       for r in o.findall("OutboundRoutes/OutboundRoute") if txt(r, "Gateway")],
        })
    outbound.sort(key=lambda x: x["priority"])

    pb = []
    for p in ten.findall("PhoneBookEntries/PhoneBookEntry"):
        pb.append({"first": txt(p, "FirstName"), "last": txt(p, "LastName"), "company": txt(p, "CompanyName"),
                   "phone": txt(p, "PhoneNumber"),
                   "other": [txt(p, "AddressNumberOrData%d" % i) for i in range(10) if txt(p, "AddressNumberOrData%d" % i)],
                   "scope": "Entreprise"})
    for g in ten.findall("Groups/Group"):
        for p in g.findall("PhoneBookEntries/PhoneBookEntry"):
            pb.append({"first": txt(p, "FirstName"), "last": txt(p, "LastName"), "company": txt(p, "CompanyName"),
                       "phone": txt(p, "PhoneNumber"), "other": [], "scope": "Groupe " + txt(g, "Name")})

    D.update(queues=queues, ivrs=ivrs, ringGroups=rgs, extensions=exts, lines=lines, gateways=gws,
             outbound=outbound, phonebook=pb, parks=parks,
             promptSets=[txt(p, "Name") or p.get("Name", "") for p in root.findall("PromptSets/PromptSet")])
    D["firmwares"] = sorted([{"vendor": os.path.basename(os.path.dirname(p)), "file": os.path.basename(p)}
                             for p in glob.glob(os.path.join(SRC, "provisioning", "*", "firmware", "*", "*"))], key=lambda x: x["file"])

    # ---------- Fichiers audio ----------
    def rel(p):
        return os.path.relpath(p, BASE).replace(os.sep, "/")
    D["prompts"] = sorted([{"file": os.path.basename(p), "path": rel(p), "size": os.path.getsize(p)}
                           for p in glob.glob(os.path.join(SRC, "httpprompts", "*.wav"))], key=lambda x: x["file"].lower())
    vms = []
    for p in glob.glob(os.path.join(SRC, "voicemails", "*", "*.wav")):
        fn = os.path.basename(p)
        m = re.match(r"vmail_(.*?)_(\d+)_(\d{14})", fn)
        vms.append({"ext": os.path.basename(os.path.dirname(p)), "from": m.group(1) if m else "", "date": m.group(3) if m else "",
                    "path": rel(p), "size": os.path.getsize(p)})
    D["voicemails"] = sorted(vms, key=lambda x: x["date"], reverse=True)
    D["vmGreetings"] = sorted([{"ext": os.path.basename(os.path.dirname(p)), "file": os.path.basename(p), "path": rel(p)}
                               for p in glob.glob(os.path.join(SRC, "vmailprompts", "*", "*.wav"))], key=lambda x: x["ext"])

    # ---------- CDR -> appels ----------
    rows = read_csv("cdroutput")
    calls = defaultdict(list)
    for r in rows:
        calls[r["main_call_history_id"] or r["call_history_id"]].append(r)
    PATH_TYPES = {"ivr", "queue", "group", "ring_group_ring_all", "ring_group_hunt", "extension", "vmail_console", "shared_parking", "fax", "script"}
    out_calls = []
    for cid, segs in calls.items():
        segs.sort(key=lambda r: r["cdr_started_at"])
        first = segs[0]
        start = min(r["cdr_started_at"] for r in segs)
        end = max(r["cdr_ended_at"] or r["cdr_started_at"] for r in segs)
        inbound = first["source_dn_type"] == "external_line" or first["source_entity_type"] == "external_line"
        outbound_seg = next((r for r in segs if r["destination_dn_type"] == "provider"), None)
        if inbound:
            direction = "in"
            frm = first["source_participant_phone_number"]
            frm_name = first["source_participant_name"]
            did = next((r["source_participant_trunk_did"] for r in segs if r["source_participant_trunk_did"]), "")
            to = did
        elif outbound_seg:
            direction = "out"
            frm = first["source_dn_number"]
            frm_name = first["source_dn_name"]
            to = outbound_seg["destination_participant_phone_number"] or outbound_seg["destination_dn_number"]
            did = ""
        else:
            direction = "int"
            frm = first["source_dn_number"]
            frm_name = first["source_dn_name"]
            to = first["destination_dn_number"]
            did = ""
        path = []
        for r in segs:
            t = r["destination_dn_type"]
            if t in PATH_TYPES and r["destination_dn_number"]:
                lab = r["destination_dn_number"]
                if not path or path[-1][0] != lab:
                    path.append([lab, t])
        answered = None
        talk = 0
        for r in segs:
            if r["cdr_answered_at"] and r["destination_dn_type"] in ("extension", "provider", "vmail_console"):
                if direction == "out" and r["destination_dn_type"] == "provider":
                    answered = answered or first["source_dn_number"]
                    talk += secs(r["cdr_answered_at"], r["cdr_ended_at"])
                elif r["destination_dn_type"] == "extension":
                    answered = r["destination_dn_number"]
                    talk += secs(r["cdr_answered_at"], r["cdr_ended_at"])
                elif r["destination_dn_type"] == "vmail_console" and not answered:
                    answered = "VM"
        if direction == "int" and not answered and first["cdr_answered_at"]:
            answered = first["destination_dn_number"]
            talk = secs(first["cdr_answered_at"], first["cdr_ended_at"])
        # Issue de l'appel
        types = [r["destination_dn_type"] for r in segs]
        prov = [r for r in segs if r["destination_dn_type"] == "provider"]
        if answered == "VM":
            status = "vm"
        elif answered:
            status = "ans"
        elif direction == "in" and prov:
            status = "fwd_ok" if any(r["cdr_answered_at"] for r in prov) else "fwd_no"
            if status == "fwd_ok":
                talk = sum(secs(r["cdr_answered_at"], r["cdr_ended_at"]) for r in prov if r["cdr_answered_at"])
        elif "bridge" in types:
            status = "bridge"
        elif "queue" in types:
            status = "q_ab"
        elif "ivr" in types:
            status = "ivr_ab"
        else:
            status = "miss"
        out_calls.append([iso(start), direction, frm, frm_name, to, did, answered or "", secs(start, end), talk, path, status])
    out_calls.sort(key=lambda c: c[0], reverse=True)
    D["calls"] = out_calls

    # ---------- Files d'attente : statistiques ----------
    qstats = defaultdict(lambda: {"total": 0, "served": 0, "abandoned": 0, "noAgents": 0, "wait": 0, "waitServed": 0, "talk": 0, "hours": [0] * 24})
    qrows = []
    for r in read_csv("callcent_queuecalls"):
        q = qstats[r["q_num"]]
        res = r["call_result"]
        q["total"] += 1
        w = interval_s(r["ts_waiting"])
        q["wait"] += w
        served = "S" in res
        if served:
            q["served"] += 1
            q["waitServed"] += w
            q["talk"] += interval_s(r["ts_servicing"])
        else:
            q["abandoned"] += 1
        if r["reason_noanswerdesc"] == "NoAgents":
            q["noAgents"] += 1
        try:
            q["hours"][int(r["time_start"][11:13])] += 1
        except ValueError:
            pass
        qrows.append([iso(r["time_start"]), r["q_num"], r["from_userpart"], r["from_displayname"], w,
                      interval_s(r["ts_servicing"]), served, r["to_dn"], r["reason_noanswerdesc"] or r["reason_faildesc"]])
    D["queueStats"] = qstats
    qrows.sort(key=lambda x: x[0], reverse=True)
    D["queueCalls"] = qrows

    # ---------- Enregistrements ----------
    recs = []
    for r in read_csv("recordings"):
        url = r["recording_url"]
        m = re.match(r"(\d+)/\[(.*?)\]_(\d+)-(.*?)_(\d{14})", url)
        recs.append([iso(r["start_time"]), m.group(1) if m else url.split("/")[0], m.group(2) if m else "",
                     m.group(4) if m else "", secs(r["start_time"], r["end_time"]), url, r["archived"] == "t", r["queue_dn"]])
    recs.sort(key=lambda x: x[0], reverse=True)
    D["recordings"] = recs

    # ---------- Journal d'audit ----------
    ACTIONS = {"0": "Création", "1": "Modification", "2": "Suppression", "18": "Connexion"}
    audit = []
    for r in read_csv("audit_log"):
        changes = []
        try:
            prev = json.loads(r["prev_data"]) if r["prev_data"] else {}
            new = json.loads(r["new_data"]) if r["new_data"] else {}
        except ValueError:
            prev, new = {}, {}
        if isinstance(prev, dict) and isinstance(new, dict):
            for k in sorted(set(prev) | set(new)):
                if SENSITIVE.search(k):
                    continue
                a, b = prev.get(k), new.get(k)
                if a != b:
                    sa = json.dumps(a, ensure_ascii=False) if a is not None else ""
                    sb = json.dumps(b, ensure_ascii=False) if b is not None else ""
                    changes.append([k, sa[:300], sb[:300]])
        audit.append([iso(r["time_stamp"]), ACTIONS.get(r["action"], "Action " + r["action"]), r["object_type"],
                      r["user_name"], r["object_name"], r["ip"], changes[:40]])
    audit.sort(key=lambda x: x[0], reverse=True)
    D["audit"] = audit

    # ---------- Clavardage ----------
    D["chatCount"] = len(read_csv("chat_message"))
    D["source"] = {"kind": "embedded"}

    data = json.dumps(D, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    build_versions(data, D)
    print("Appels:", len(out_calls), "Postes:", len(exts), "Files:", len(queues), "IVR:", len(ivrs))


# ---------- Versions & documentation ----------

def page_name(v):
    return "visualiseur-3cx-v%s.html" % v


def page_href(v, latest, here):
    """Lien vers la page d'une version depuis une page située dans « here » ('app' ou 'old')."""
    name = page_name(v)
    if v == latest:
        return name if here == "app" else "../" + name
    return ("anciennes-versions/" + name) if here == "app" else name


def fix_paths(html, here):
    """Noms de fichiers d'avant la 6.19 et chemins relatifs selon l'emplacement de la page."""
    up = "../" if here == "old" else ""
    html = html.replace('src="firmwares_3cx.js"', 'src="%sfirmwares-3cx.js"' % up).replace('src="firmwares-3cx.js"', 'src="%sfirmwares-3cx.js"' % up)
    return html.replace("verifier_firmwares.command", "verifier-firmwares.command").replace("firmwares_3cx.js", "firmwares-3cx.js")


def write_pwa(version, latest):
    """Version web installable : manifeste d'application et service worker à la racine du site (GitHub Pages)."""
    manifest = {"name": "3CXplore", "short_name": "3CXplore", "description": "Explorez votre 3CX en profondeur",
                "lang": "fr", "start_url": "./index.html", "scope": "./", "display": "standalone",
                "background_color": "#042C53", "theme_color": "#042C53",
                "icons": [{"src": "assets/icone-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "assets/icone-512.png", "sizes": "512x512", "type": "image/png"},
                          {"src": "assets/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    with open(os.path.join(BASE, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    files = ["./", "./index.html", "./app/" + latest, "./app/documentation.html", "./app/firmwares-3cx.js", "./manifest.webmanifest",
             "./assets/icone-192.png", "./assets/icone-512.png", "./assets/logo-icone.svg"]
    sw = """// 3CXplore — service worker (généré par scripts/generer_interface.py ; ne pas modifier à la main)
// Garde une copie de l'outil pour le hors ligne et récupère la dernière version quand le réseau est disponible.
// Les backups ne passent jamais par ici : ils sont lus depuis le disque, dans le navigateur.
const CACHE = '3cxplore-%s';
const FILES = %s;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('3cxplore-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  // réseau d'abord (dernière version), copie locale si hors ligne
  e.respondWith(fetch(r).then(res => {
      if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }
      // page disparue (ancienne adresse) : afficher la dernière version plutôt qu'une erreur 404
      if(r.mode === 'navigate' && res.status === 404) return fetch('./index.html').catch(() => caches.match('./index.html')).then(x => x || res);
      return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
""" % (version, json.dumps(files))
    with open(os.path.join(BASE, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)
    open(os.path.join(BASE, ".nojekyll"), "w").close()  # GitHub Pages : servir les fichiers tels quels


def version_menu(versions, current, floating=False, here="app"):
    """Sélecteur de version + lien vers la documentation, injecté dans chaque page."""
    latest = next((v["version"] for v in versions if not v.get("retiree")), None)
    doc = "documentation.html" if here == "app" else "../documentation.html"
    opts = "".join(
        '<option value="%s"%s>Version %s%s</option>' % (
            page_href(v["version"], latest, here), " selected" if v["version"] == current else "",
            esc_html(v["version"]), " (actuelle)" if i == 0 else "")
        for i, v in enumerate(v for v in versions if not v.get("retiree")))
    doc_sel = " selected" if current == "doc" else ""
    style = (".vmenu{display:flex;gap:6px;align-items:center}"
             ".vmenu select{background:var(--panel2,#f1f3f6);color:var(--text,#1b1f24);border:1px solid var(--line,#e2e6eb);"
             "border-radius:6px;padding:4px 8px;font:inherit;font-size:13px;cursor:pointer}"
             ".vmenu a{color:var(--accent,#2563eb);font-size:13px;text-decoration:none;white-space:nowrap}"
             ".vmenu a:hover{text-decoration:underline}")
    if floating:
        style += (".vmenu.float{position:fixed;top:8px;right:60px;z-index:30;background:var(--panel,#fff);"
                  "padding:4px 8px;border:1px solid var(--line,#e2e6eb);border-radius:8px}")
    return ('<style>%s</style><div class="vmenu%s"><select aria-label="Version de l\'application" '
            'onchange="location.href=this.value">%s%s</select><a href="%s">Documentation</a></div>') % (
        style, " float" if floating else "", opts,
        '<option value="documentation.html"%s hidden>Documentation</option>' % doc_sel if current == "doc" else "", doc)


def esc_html(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def build_versions(data, D):
    with open(VERSIONS_JSON, encoding="utf-8") as f:
        versions = json.load(f)
    versions.sort(key=lambda v: [int(x) for x in v["version"].split(".")], reverse=True)
    active = [v for v in versions if not v.get("retiree")]
    os.makedirs(OLD, exist_ok=True)
    for v in active:
        tpl = os.path.join(VERSIONS_DIR, v["version"], MODELE)
        with open(tpl, encoding="utf-8") as f:
            html = f.read()
        here = "app" if v is active[0] else "old"
        html = fix_paths(html.replace("/*__DATA__*/null", data), here)
        html = html.replace("__APP_VERSION__", v["version"])  # numéro de version de la page (vérification des mises à jour)
        html = html.replace("__ROOT__", "../" if here == "app" else "../../")  # racine du site (manifeste, service worker)
        if "<!--__VERSION_MENU__-->" in html:
            html = html.replace("<!--__VERSION_MENU__-->", version_menu(versions, v["version"], here=here))
        else:
            # Versions antérieures au menu : sélecteur flottant, rien d'autre n'est modifié.
            html = html.replace("</body>", version_menu(versions, v["version"], floating=True, here=here) + "</body>", 1)
        out = os.path.join(APP if here == "app" else OLD, page_name(v["version"]))
        with open(out, "w", encoding="utf-8") as f:
            f.write(html)
        print("OK ->", page_name(v["version"]), "(%.1f Mo)" % (os.path.getsize(out) / 1e6))

    latest = page_name(active[0]["version"])
    # pages générées qui ne sont plus à leur place (ex. l'ancienne dernière version restée dans app/)
    keep = {os.path.join(APP, latest)} | {os.path.join(OLD, page_name(v["version"])) for v in active[1:]} | {os.path.join(APP, page_name(v["version"])) for v in active[1:]}  # + pages de redirection
    for f in glob.glob(os.path.join(APP, "visualiseur-3cx-v*.html")) + glob.glob(os.path.join(OLD, "visualiseur-3cx-v*.html")):
        if f not in keep:
            os.remove(f)
            print("Retiré (page générée déplacée) :", os.path.relpath(f, BASE))
    write_pwa(active[0]["version"], latest)
    with open(os.path.join(BASE, "index.html"), "w", encoding="utf-8") as f:
        f.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>3CXplore</title>'
                '<meta http-equiv="refresh" content="0; url=%s"></head><body>'
                '<p>Redirection vers la <a href="%s">version la plus récente</a>…</p></body></html>' % ("app/" + latest, "app/" + latest))
    # anciennes adresses de la dernière version (favoris, application installée) : petite page qui redirige vers la version actuelle
    for v in active[1:]:
        stub = os.path.join(APP, page_name(v["version"]))
        with open(stub, "w", encoding="utf-8") as f:
            f.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>3CXplore</title>'
                    '<meta http-equiv="refresh" content="0; url=../index.html"><script>location.replace("../index.html")</script></head><body>'
                    '<p>Cette version a été remplacée : <a href="../index.html">ouvrir la dernière version de 3CXplore</a>. '
                    'La version %s reste disponible dans <a href="anciennes-versions/%s">les anciennes versions</a>.</p></body></html>'
                    % (esc_html(v["version"]), page_name(v["version"])))

    doc = build_doc(versions, active, versions, D)
    with open(os.path.join(APP, "documentation.html"), "w", encoding="utf-8") as f:
        f.write(doc)
    print("OK -> app/documentation.html ; index.html -> app/" + latest)
    update_readme(active)
    if "--partage" in sys.argv:
        build_share(versions, active)


def build_doc(versions, active, menu_versions, D=None, linkable=None):
    """Page de documentation. linkable : versions dont la page est disponible (None = toutes)."""
    with open(DOC_TEMPLATE, encoding="utf-8") as f:
        doc = f.read()
    sections = []
    for i, v in enumerate(versions):
        tabs = ""
        if v.get("onglets"):
            tabs = "<h4>Onglets</h4><dl class=\"tabs\">" + "".join(
                "<dt>%s</dt><dd>%s</dd>" % (esc_html(a), esc_html(b)) for a, b in v["onglets"]) + "</dl>"
        sections.append(
            '<section class="ver" id="v%s"><div class="vh"><h3>Version %s%s</h3><span class="date">%s</span>'
            '%s</div><p class="titre">%s</p><p>%s</p>'
            '<h4>Changements</h4><ul>%s</ul>%s</section>' % (
                esc_html(v["version"]), esc_html(v["version"]),
                ' <span class="badge">actuelle</span>' if v is active[0] else (' <span class="badge off">retirée</span>' if v.get("retiree") else ""),
                esc_html(v["date"]),
                ('<span class="open muted">Retirée le %s — gabarit conservé dans versions/%s/</span>' % (esc_html(v["retiree"]), esc_html(v["version"])))
                if v.get("retiree") else ('<a class="open" href="%s">Ouvrir cette version →</a>' % page_href(v["version"], active[0]["version"], "app")
                    if linkable is None or v["version"] in linkable else '<span class="open muted">Non incluse dans ce paquet</span>'),
                esc_html(v["titre"]), esc_html(v["resume"]),
                "".join("<li>%s</li>" % esc_html(c) for c in v["changements"]), tabs))
    toc = "".join('<a href="#v%s"%s>%s <span>%s</span></a>' % (esc_html(v["version"]), ' class="off"' if v.get("retiree") else "", esc_html(v["version"]), esc_html(v["date"]) + (" · retirée" if v.get("retiree") else ""))
                  for v in versions)
    doc = (doc.replace("<!--__VERSION_MENU__-->", version_menu(menu_versions, "doc"))
              .replace("<!--__TOC__-->", toc).replace("<!--__SECTIONS__-->", "".join(sections))
              .replace("<!--__SOURCE__-->", esc_html("%s · %s · 3CX %s · backup du %s" % (
                  D["info"]["company"], D["info"]["fqdn"], D["info"]["version"], D["info"]["date"])) if D
                  else "le backup .zip choisi dans l'interface (aucune donnée n'est intégrée aux pages)"))
    return doc


# ---------- README : tableau des versions, onglets et badge ----------

def readme_tabs(latest):
    """Section des onglets du README : groupes et libellés du menu de la dernière version, descriptions de versions.json."""
    with open(os.path.join(VERSIONS_DIR, latest, MODELE), encoding="utf-8") as f:
        t = f.read()
    if "const TABS = [" not in t or "const NAV_GROUPS = [" not in t:
        return None, 0
    tabs = t[t.index("const TABS = ["):t.index("const NAV_GROUPS")]
    labels = {k: l.replace("\\'", "'") for k, l in re.findall(r"\['(\w+)','((?:[^'\\]|\\.)*)'", tabs)}
    navs = t[t.index("const NAV_GROUPS = ["):]
    navs = navs[:navs.index("];")]
    groups = re.findall(r"\[\s*(?:\"([^\"]+)\"|'([^']+)')\s*,\s*\[([^\]]*)\]\s*\]", navs)
    with open(VERSIONS_JSON, encoding="utf-8") as f:
        versions = json.load(f)
    desc = {}
    for v in reversed(versions):
        for o in v.get("onglets") or []:
            if isinstance(o, list) and len(o) == 2:
                desc[o[0]] = o[1]
    out, n = [], 0
    for g1, g2, keys in groups:
        ks = [k for k in re.findall(r"'(\w+)'", keys) if k in labels]
        if not ks:
            continue
        out += ["### %s" % (g1 or g2), "| Onglet | À quoi il sert |", "|---|---|"]
        for k in ks:
            out.append("| **%s** | %s |" % (labels[k], desc.get(labels[k], "").replace("|", "/")))
            n += 1
        out.append("")
    return "\n".join(out).rstrip(), n


def update_readme(active):
    path = os.path.join(BASE, "README.md")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        md = f.read()
    a, b = "<!-- VERSIONS:START -->", "<!-- VERSIONS:END -->"
    if a not in md or b not in md:
        print("README.md : marqueurs VERSIONS absents, tableau non mis à jour")
        return
    latest = active[0]["version"]
    major = latest.split(".")[0]
    rows = ["| Version | Nouveauté |", "|---|---|"]
    for i, v in enumerate(x for x in active if x["version"].split(".")[0] == major):
        rows.append("| %s | %s |" % ("**%s**" % v["version"] if i == 0 else v["version"], v["titre"].replace("|", "/")))
    older = defaultdict(list)
    for v in active:
        if v["version"].split(".")[0] != major:
            older[v["version"].split(".")[0]].append(v)
    for m in sorted(older, key=int, reverse=True):
        vs = older[m]
        titles = [v["titre"].replace("|", "/") for v in reversed(vs)]
        rows.append("| %s.x | %s%s |" % (m, " · ".join(titles[:5]), " · …" if len(titles) > 5 else ""))
    md = md[:md.index(a) + len(a)] + "\n" + "\n".join(rows) + "\n" + md[md.index(b):]
    md = re.sub(r"badge/version-[0-9.]+-", "badge/version-%s-" % latest.replace("-", "--"), md)
    sec, n = readme_tabs(latest)
    ta, tb = "<!-- ONGLETS:START -->", "<!-- ONGLETS:END -->"
    if sec and ta in md and tb in md:
        md = md[:md.index(ta) + len(ta)] + "\n" + sec + "\n" + md[md.index(tb):]
        md = re.sub(r"\*\*\d+ onglets\*\*", "**%d onglets**" % n, md)
    with open(path, "w", encoding="utf-8") as f:
        f.write(md)
    print("OK -> README.md (version %s%s)" % (latest, ", %d onglets" % n if sec else ""))


# ---------- Paquet de partage ----------

# termes propres à l'organisation : lus dans scripts/local/donnees-organisation.json (jamais versionné).
# « neutre » : remplacements appliqués au paquet de partage (utile pour les anciennes versions) ;
# « a_surveiller » : termes signalés s'il en reste. Sans ce fichier, aucune neutralisation (versions 11 et plus : rien à neutraliser).
def donnees_organisation():
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local", "donnees-organisation.json")
    try:
        with open(f, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}
_ORG = donnees_organisation()
NEUTRE = [tuple(x) for x in _ORG.get("neutre", [])]
A_SURVEILLER = _ORG.get("a_surveiller", [])

LISEZMOI = """3CXplore — version %(v)s
%(u)s

Ouvrir : double-cliquez sur %(page)s (Chrome ou Edge recommandés).
Puis, dans le Tableau de bord, choisissez un backup 3CX (.zip).

Confidentialité
- Le backup est lu entièrement dans votre navigateur : rien n'est envoyé sur Internet.
- Seule exception, désactivable dans l'onglet Interface : au démarrage, l'outil demande
  à GitHub le numéro de la dernière version publiée (aucune donnée du backup n'est envoyée).
- Le backup reste mémorisé dans le navigateur jusqu'à « Fermer le backup »,
  qui permet de choisir ce qui est effacé.
- Les fichiers exportés (CSV, PDF, réglages) vont dans Téléchargements :
  supprimez-les vous-même quand vous n'en avez plus besoin.
- Ne partagez jamais le fichier .zip du backup : il contient les appels,
  enregistrements, messages vocaux et identifiants du système.

Firmwares des téléphones (Mac seulement)
- Double-cliquez sur verifier-firmwares.command pour télécharger la liste officielle
  des firmwares 3CX dans firmwares-3cx.js, puis rechargez la page.
- Au premier lancement, macOS peut bloquer le fichier : clic droit > Ouvrir.

Documentation : documentation.html (nouveautés de chaque version).
"""


def neutralise(html):
    for a, b in NEUTRE:
        html = html.replace(a, b)
    return html


def build_share(versions, active):
    v = active[0]
    page = page_name(v["version"])
    with open(os.path.join(VERSIONS_DIR, v["version"], MODELE), encoding="utf-8") as f:
        html = fix_paths(f.read().replace("/*__DATA__*/null", "null"), "app")
    html = neutralise(html.replace("<!--__VERSION_MENU__-->", version_menu([v], v["version"])).replace("__APP_VERSION__", v["version"]))
    # paquet de partage : ouvert depuis un fichier, pas d'application installable
    html = html.replace('<link rel="manifest" href="__ROOT__manifest.webmanifest">', "").replace("__ROOT__", "")
    doc = neutralise(build_doc(versions, active, [v], None, linkable={v["version"]}))
    restes = sorted({w for w in A_SURVEILLER for t in (html, doc) if w in t})
    if restes:
        print("ATTENTION : termes propres au client encore présents dans le paquet :", ", ".join(restes))
    folder = "visualiseur-3cx-v%s/" % v["version"]
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "visualiseur-3cx-v%s.zip" % v["version"])
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(folder + page, html)
        z.writestr(folder + "documentation.html", doc)
        z.writestr(folder + "LISEZMOI.txt", LISEZMOI % {"v": v["version"], "u": "=" * (19 + len(v["version"])), "page": page})
        for name, src in (("firmwares-3cx.js", os.path.join(APP, "firmwares-3cx.js")), ("verifier-firmwares.command", os.path.join(BASE, "scripts", "verifier-firmwares.command"))):
            if not os.path.exists(src):
                continue
            info = zipfile.ZipInfo.from_file(src, folder + name)
            if name.endswith(".command"):
                info.external_attr = (stat.S_IFREG | 0o755) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(src, "rb") as f:
                z.writestr(info, f.read())
    print("OK -> dist/%s (%.1f Mo)" % (os.path.basename(out), os.path.getsize(out) / 1e6))

if __name__ == "__main__":
    main()
