#!/usr/bin/env python3
"""Εργαλείο του κόσμου «Εκδηλώσεις» (Κοντά μου) — ΧΩΡΙΣ κανένα κλειδί βάσης.

  python3 ergaleia/ekdiloseis.py check                 έλεγχος του ekdiloseis.json (αυστηρός· έξοδος 1 αν υπάρχει λάθος)
  python3 ergaleia/ekdiloseis.py merge neo.json        συγχώνευση νέων/ενημερωμένων εκδηλώσεων (ό,τι δεν περνά τον έλεγχο απορρίπτεται σιωπηλά)
  python3 ergaleia/ekdiloseis.py daily                 αφαίρεση όσων πέρασαν + «Συνήθως γίνεται» από το ημερολόγιο πανηγυριών + έλεγχος
  python3 ergaleia/ekdiloseis.py summary [ημέρες]      σύντομη σύνοψη (για την εβδομαδιαία ενημέρωση)

Κανόνες δημοσίευσης (ό,τι δεν τους τηρεί ΔΕΝ μπαίνει):
  • επίσημη πηγή https (όχι κοινωνικά δίκτυα), σαφής ΜΕΛΛΟΝΤΙΚΗ ημερομηνία, συγκεκριμένο χωριό/πόλη, θέση μέσα στην Ελλάδα
  • μόνο γεγονότα (τι/πού/πότε) με δικά μας λόγια· χωρίς αφίσες, φωτογραφίες, κείμενα τρίτων, εμβλήματα, «επίσημο»
  • «Από Δήμο» μόνο αν ο Δήμος είναι στο symfonies-dimon.json (γραπτή συμφωνία)· αλλιώς «Αυτόματη καταχώριση»
  • κανένα προσωπικό στοιχείο πέρα από το όνομα διοργανωτή που δημοσίευσε ο ίδιος (όχι τηλέφωνα/email ιδιωτών)
"""
import json, re, sys, datetime, os, hashlib
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F_EV = os.path.join(ROOT, "ekdiloseis.json")
F_CAL = os.path.join(ROOT, "imerologio-panigyrion.json")
F_AGR = os.path.join(ROOT, "symfonies-dimon.json")
CATS = ["panig", "glenti", "ethima", "synavl", "theatro", "festival", "politis", "ektheseis", "agores", "athlit", "paidikes", "ethelont"]
ST = ["ok", "usual", "changed", "cancelled"]
BAD_HOSTS = ("facebook.", "fb.", "instagram.", "twitter.", "x.com", "tiktok.", "youtube.", "youtu.be", "threads.", "linkedin.", "pinterest.", "t.me", "viber.", "whatsapp.")
ID = re.compile(r"^[a-z0-9-]{3,40}$")
DT = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")
PII = re.compile(r"(\+?30)?\s?(69\d{8}|2\d{9})|[\w.+-]+@[\w-]+\.[\w.]+")
TODAY = datetime.date.today()

def load(p, d):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except FileNotFoundError: return d
def save(p, o):
    with open(p, "w", encoding="utf-8") as f: json.dump(o, f, ensure_ascii=False, indent=1, sort_keys=False); f.write("\n")
def pdate(s, end=False):
    if not isinstance(s, str) or not DT.match(s): return None
    try:
        if "T" in s: return datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M")
        d = datetime.datetime.strptime(s, "%Y-%m-%d"); return d.replace(hour=23, minute=59) if end else d
    except ValueError: return None
def ev_end(x):
    s = pdate(x.get("s")); e = pdate(x.get("e"), True) if x.get("e") else None
    if e and e > s: return e
    return max(pdate(x["s"][:10], True), s + datetime.timedelta(hours=6))
def clean_txt(v, n):
    v = re.sub(r"[\u0000-\u001f<>]", " ", str(v or "")).strip()
    return re.sub(r"\s+", " ", v)[:n]
def ok_src(u):
    try: p = urlparse(str(u))
    except Exception: return False
    h = (p.hostname or "").lower()
    return p.scheme == "https" and "." in h and not any(b in h for b in BAD_HOSTS) and not re.search(r'[\s<>"]', str(u)) and len(str(u)) <= 300

def problems(x, future=True):
    """λίστα προβλημάτων· κενή = δημοσιεύσιμη"""
    P = []
    if not isinstance(x, dict): return ["όχι αντικείμενο"]
    if not ID.match(str(x.get("id", ""))): P.append("κωδικός")
    t = x.get("t", "")
    if not isinstance(t, str) or not (3 <= len(t.strip()) <= 120): P.append("τίτλος")
    if x.get("c") not in CATS: P.append("κατηγορία")
    s = pdate(x.get("s"))
    if not s: P.append("ημερομηνία")
    elif future and ev_end(x) < datetime.datetime.now(): P.append("πέρασε")
    elif s > datetime.datetime.now() + datetime.timedelta(days=400): P.append("πολύ μακριά")
    if x.get("e") and not pdate(x.get("e"), True): P.append("λήξη")
    if not (isinstance(x.get("v"), str) and len(x["v"].strip()) >= 2): P.append("χωριό/πόλη")
    try:
        lat, lng = float(x.get("lat")), float(x.get("lng"))
        if not (34 < lat < 42 and 19 < lng < 30): P.append("θέση εκτός Ελλάδας")
    except (TypeError, ValueError): P.append("θέση")
    src = x.get("src")
    if not (isinstance(src, list) and 1 <= len(src) <= 5 and all(ok_src(u) for u in src)): P.append("πηγή (μόνο https, όχι κοινωνικά δίκτυα)")
    if x.get("st", "ok") not in ST: P.append("κατάσταση")
    if x.get("by", "auto") not in ("auto", "org", "dimos"): P.append("προέλευση")
    for k in ("t", "o", "v", "d", "p"):
        if PII.search(str(x.get(k, ""))): P.append("προσωπικά στοιχεία στο " + k)
    if re.search(r"επίσημ", str(x.get("t", "")), re.I): P.append("λέξη «επίσημο»")
    return P

def normalize(x, agr):
    o = {k: x[k] for k in ("id", "c", "s", "lat", "lng") if k in x}
    o["t"] = clean_txt(x.get("t"), 120); o["v"] = clean_txt(x.get("v"), 60)
    for k, n in (("d", 60), ("p", 60), ("o", 100), ("sc", 40)):
        if x.get(k): o[k] = clean_txt(x[k], n)
    if x.get("e"): o["e"] = x["e"]
    o["lat"], o["lng"] = round(float(x["lat"]), 5), round(float(x["lng"]), 5)
    o["src"] = list(dict.fromkeys(x["src"]))[:5]
    o["st"] = x.get("st", "ok")
    by = x.get("by", "auto")
    if by == "dimos" and (o.get("d") or "") in agr: o["by"], o["agr"] = "dimos", True    # «Από Δήμο» ΜΟΝΟ με συμφωνία
    elif by == "org": o["by"] = "org"
    else: o["by"] = "auto"
    return o

def check(path=F_EV):
    d = load(path, None)
    if not isinstance(d, dict) or not isinstance(d.get("items"), list): print("ΧΑΛΑΣΜΕΝΟ ΑΡΧΕΙΟ"); return 1
    bad = 0; ids = set()
    for x in d["items"]:
        p = [q for q in problems(x, future=False) if q != "πέρασε"]
        if x.get("id") in ids: p.append("διπλός κωδικός")
        ids.add(x.get("id"))
        if p: bad += 1; print("✗", x.get("id"), ", ".join(p))
    print("εκδηλώσεις:", len(d["items"]), "· με λάθη:", bad)
    return 1 if bad else 0

def same_key(a, b):          # ίδια εκδήλωση με άλλον κωδικό: ίδια μέρα, ίδιο χωριό, παρόμοιος τίτλος, ίδια κατηγορία
    n = lambda s: re.sub(r"[^a-zα-ω0-9]", "", str(s).lower().translate(str.maketrans("άέήίόύώϊϋΐΰ", "αεηιουωιυιυ")))
    return a.get("s", "")[:10] == b.get("s", "")[:10] and n(a.get("v")) == n(b.get("v")) and a.get("c") == b.get("c") and (n(a.get("t"))[:12] == n(b.get("t"))[:12])

def merge(cand_path):
    d = load(F_EV, {"items": []}); agr = set(load(F_AGR, {"dimoi": []}).get("dimoi", []))
    cur = {x["id"]: x for x in d.get("items", [])}
    cand = load(cand_path, {"items": []}); cand = cand.get("items", cand) if isinstance(cand, dict) else cand
    today = TODAY.isoformat(); added = changed = confirmed = rejected = 0
    for raw in cand if isinstance(cand, list) else []:
        if problems(raw): rejected += 1; continue                         # απορρίπτεται σιωπηλά
        x = normalize(raw, agr)
        tgt = cur.get(x["id"]) or next((y for y in cur.values() if same_key(y, x)), None)
        if not tgt:
            x["add"] = today; x["chk"] = today; x["h"] = []; cur[x["id"]] = x; added += 1; continue
        diffs = []
        for k, lab in (("s", "ημερομηνία/ώρα"), ("e", "λήξη"), ("v", "τόπος"), ("lat", "θέση"), ("lng", "θέση"), ("t", "τίτλος"), ("o", "διοργανωτής")):
            if str(tgt.get(k, "")) != str(x.get(k, "")) and lab not in [q[0] for q in diffs]: diffs.append((lab, str(tgt.get(k, "")), str(x.get(k, ""))))
        h = tgt.get("h", [])
        if x["st"] == "cancelled" and tgt.get("st") != "cancelled":
            h.append({"d": today, "t": "Ακυρώθηκε σύμφωνα με την πηγή"}); tgt["st"] = "cancelled"; changed += 1
        elif diffs:
            for lab, a, b in diffs: h.append({"d": today, "t": f"Αλλαγή: {lab} ({a} → {b})"[:160]})
            for k in ("s", "e", "v", "d", "p", "lat", "lng", "t", "o"):
                if k in x: tgt[k] = x[k]
                elif k == "e": tgt.pop("e", None)
            tgt["st"] = "changed"; changed += 1
        else:
            if tgt.get("st") == "usual": tgt["st"] = "ok"; h.append({"d": today, "t": "Επιβεβαιώθηκε από την πηγή"})
            confirmed += 1
        tgt["src"] = list(dict.fromkeys(tgt.get("src", []) + x["src"]))[:5]
        tgt["by"] = x["by"]; tgt.pop("agr", None)
        if x.get("agr"): tgt["agr"] = True
        tgt["chk"] = today; tgt["h"] = h[-20:]                              # νέος έλεγχος → οι αναφορές χρηστών μηδενίζονται (νέα «εποχή»)
        learn_calendar(tgt)
    for x in cur.values():
        if x["st"] == "ok": learn_calendar(x)
    d["items"] = sorted(cur.values(), key=lambda x: (x["s"], x["id"])); d["updated"] = today
    d.setdefault("source", "Δημόσιες πηγές (Δήμοι, σύλλογοι, ανοιχτά δεδομένα) — με δικά μας λόγια και σύνδεσμο προς την πηγή")
    save(F_EV, d)
    print(f"νέες: {added} · αλλαγές/ακυρώσεις: {changed} · επιβεβαιώσεις: {confirmed} · απορρίφθηκαν: {rejected}")

# ---------- ημερολόγιο επαναλαμβανόμενων πανηγυριών (φτιαγμένο από εμάς, μαθαίνει από επιβεβαιωμένες εκδηλώσεις) ----------
def pascha(y):                 # Ορθόδοξο Πάσχα (Meeus) σε νέο ημερολόγιο
    a, b, c = y % 4, y % 7, y % 19; d = (19 * c + 15) % 30; e = (2 * a + 4 * b - d + 34) % 7
    m = (d + e + 114) // 31; day = (d + e + 114) % 31 + 1
    return datetime.date(y, m, day) + datetime.timedelta(days=13)
def learn_calendar(x):
    if x.get("c") not in ("panig", "glenti", "ethima") or x.get("st") not in ("ok", "changed"): return
    cal = load(F_CAL, {"items": {}}); it = cal.setdefault("items", {})
    s = pdate(x["s"]); key = re.sub(r"[^a-z0-9-]", "", x["id"].rsplit("-", 1)[0] if re.search(r"-\d{4}$", x["id"]) else x["id"])[:30] or hashlib.md5(x["id"].encode()).hexdigest()[:10]
    p = pascha(s.year); off = (s.date() - p).days
    rule = f"P{off:+d}" if -70 <= off <= 70 and x.get("kinito") else s.strftime("%m-%d")      # κινητή γιορτή μόνο αν σημειώθηκε ρητά
    it[key] = {"t": x["t"], "c": x["c"], "v": x["v"], "d": x.get("d", ""), "p": x.get("p", ""), "lat": x["lat"], "lng": x["lng"],
               "time": x["s"][11:] if "T" in x["s"] else "", "rule": rule, "src": x["src"][:2], "o": x.get("o", ""), "last": s.year}
    save(F_CAL, cal)
def calendar_fill(d):
    cal = load(F_CAL, {"items": {}}).get("items", {}); have = d["items"]; out = 0
    for key, c in cal.items():
        for y in (TODAY.year, TODAY.year + 1):
            r = c.get("rule", "")
            try: day = pascha(y) + datetime.timedelta(days=int(r[1:])) if r.startswith("P") else datetime.date(y, int(r[:2]), int(r[3:5]))
            except Exception: continue
            if not (TODAY <= day <= TODAY + datetime.timedelta(days=60)) or c.get("last", 0) >= y: continue
            x = {"id": f"us-{key}-{y}"[:40], "t": c["t"], "c": c["c"], "s": day.isoformat() + ("T" + c["time"] if c.get("time") else ""),
                 "v": c["v"], "d": c.get("d", ""), "p": c.get("p", ""), "lat": c["lat"], "lng": c["lng"], "o": c.get("o", ""), "src": c["src"], "st": "usual", "by": "auto",
                 "add": TODAY.isoformat(), "chk": TODAY.isoformat(), "h": [{"d": TODAY.isoformat(), "t": f"Συνήθως γίνεται — έγινε και το {c.get('last')}· αναμένει επιβεβαίωση"}]}
            if problems(x) or any(same_key(x, h) or h["id"] == x["id"] for h in have): continue
            have.append(x); out += 1
    return out

def daily():
    d = load(F_EV, {"items": []}); now = datetime.datetime.now() - datetime.timedelta(days=1)
    before = len(d.get("items", []))
    d["items"] = [x for x in d.get("items", []) if pdate(x.get("s")) and ev_end(x) >= now]             # αφαίρεση όσων πέρασαν
    gone = before - len(d["items"]); n = calendar_fill(d)
    d["items"].sort(key=lambda x: (x["s"], x["id"])); d["updated"] = TODAY.isoformat(); save(F_EV, d)
    print(f"αφαιρέθηκαν όσες πέρασαν: {gone} · «Συνήθως γίνεται» από το ημερολόγιο: {n}")
    return check()

def summary(days=7):
    d = load(F_EV, {"items": []}); since = (TODAY - datetime.timedelta(days=days)).isoformat()
    it = d.get("items", []); new = [x for x in it if x.get("add", "") >= since]
    ch = [x for x in it if any(h.get("d", "") >= since for h in x.get("h", [])) and x not in new]
    by_p = {}
    for x in new: by_p[x.get("p", "—")] = by_p.get(x.get("p", "—"), 0) + 1
    print(f"Σύνοψη {days} ημερών: {len(new)} νέες · {len(ch)} με αλλαγή/ακύρωση · {len(it)} ενεργές συνολικά")
    for p, n in sorted(by_p.items(), key=lambda a: -a[1]): print(f"  {p}: {n}")

if __name__ == "__main__":
    a = sys.argv[1:] or ["check"]
    if a[0] == "check": sys.exit(check())
    if a[0] == "merge": merge(a[1]); sys.exit(check())
    if a[0] == "daily": sys.exit(daily())
    if a[0] == "summary": summary(int(a[1]) if len(a) > 1 else 7); sys.exit(0)
    print(__doc__); sys.exit(2)
