"""Cartes à collectionner : une carte par rivière + 6 phénomènes.
Entrées : données préparées du projet « Les rivières du Grand Est » (stations.json, debit/rivers .b64, geo.json, events.json)
Sortie  : site/data/cards.json
"""
import json, sys, base64, re, unicodedata, math, collections
import numpy as np, pandas as pd

D = sys.argv[1]; OUT = sys.argv[2]
st = json.load(open(f"{D}/stations.json")); W, S = st["W"], st["S"]; ST = st["stations"]
geo = json.load(open(f"{D}/geo.json")); events = json.load(open(f"{D}/events.json"))
deb = np.frombuffer(base64.b64decode(open(f"{D}/debit.b64.txt").read()), dtype=np.uint16).reshape(S, W)
flow = np.where(deb == 0, np.nan, 10 ** ((deb.astype(float) - 1) / 10000) - 1)
riv = np.frombuffer(base64.b64decode(open(f"{D}/rivers.b64.txt").read()), dtype=np.int16).reshape(-1, 8)
seg = riv[:, 0:4] / 50.0; segS = riv[:, 6].astype(int); segW = riv[:, 7] / 1000.0
weeks = pd.date_range(st["weeks0"], periods=W, freq="7D"); isoW = weeks.isocalendar().week.values; years = weeks.year.values

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower()); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("canalisee", ""); s = re.sub(r"\[.*?\]", "", s); s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(r"^(ruisseau |riviere )?((la|le|les|l|de|du|d) )*", "", " ".join(s.split())); return s.strip()
def clean(lbl):
    lbl = re.sub(r"\s*Canalis[ée]e", "", lbl); lbl = re.sub(r"[\[\]]", "", lbl).strip()
    return lbl[0].upper() + lbl[1:]

groups = collections.defaultdict(list)
for i, s in enumerate(ST): groups[norm(s["river"])].append(i)
BAS = {"A": "R", "B": "M", "H": "S", "F": "S", "U": "O"}   # R Rhin·Moselle, M Meuse, S Seine·Marne, O Saône
BASNAME = {"R": "Rhin · Moselle", "M": "Meuse", "S": "Seine · Marne", "O": "Saône"}

def rank(vals):
    v = np.array(vals, dtype=float); out = np.full(len(v), np.nan); ok = ~np.isnan(v)
    out[ok] = pd.Series(v[ok]).rank(pct=True).values; return out

cards, raw = [], []
for key, ids in groups.items():
    meds = [ST[i].get("med", 0) or 0 for i in ids]
    main = max(ids, key=lambda i: ((ST[i].get("med") or 0) * (ST[i]["cov"] > 0.4), ST[i]["cov"]))
    f = flow[main]; ok = ~np.isnan(f)
    res = crue = np.nan
    if ok.sum() > 150:
        med = np.nanmedian(f)
        mins = [np.nanmin(f[(years == y) & (isoW >= 27) & (isoW <= 38)]) for y in range(2000, 2027)
                if np.sum(~np.isnan(f[(years == y) & (isoW >= 27) & (isoW <= 38)])) >= 8]
        if mins and med > 0: res = np.median(mins) / med
        if med > 0: crue = np.nanpercentile(f, 99) / med
    lab = collections.Counter(clean(ST[i]["river"]) for i in ids).most_common(1)[0][0]
    bas = collections.Counter(BAS[ST[i]["b"]] for i in ids).most_common(1)[0][0]
    m = max(meds)
    rar = 3 if m >= 40000 else 2 if m >= 8000 else 1 if m >= 1500 else 0
    kind = "Fleuve" if key in ("rhin", "meuse", "seine") else "Ruisseau" if lab.lower().startswith("ruisseau") else "Rivière"
    depts = sorted({ST[i]["dept"].split(",")[0] for i in ids})
    raw.append(dict(key=key, name=lab, kind=kind, b=bas, rar=rar, ids=ids, power=math.log10(max(m, 1)), res=res, crue=crue, depts=depts))

pw, rs, cr = rank([r["power"] for r in raw]), rank([r["res"] for r in raw]), rank([r["crue"] for r in raw])
ART_W, ART_H = 1000, 760
_rr = np.vstack([np.array(r) for r in geo["region"]])
GX0, GX1, GY0, GY1 = _rr[:, 0].min(), _rr[:, 0].max(), _rr[:, 1].min(), _rr[:, 1].max()
GS = max(GX1 - GX0, GY1 - GY0)
RX = lambda x: (x - GX0) / GS * 1000
RY = lambda y: (GY1 - y) / GS * 1000
REGION_MINI = []
for ring in geo["region"]:
    rr = np.array(ring)[::2]
    REGION_MINI.append(np.stack([RX(rr[:, 0]), RY(rr[:, 1])], 1).round().astype(int).ravel().tolist())
for k, r in enumerate(raw):
    mask = np.isin(segS, r["ids"]) & (segW > 0.36)
    s_ = seg[mask]; w_ = segW[mask]
    if len(s_) == 0:
        # rivière sans tracé rattaché : on garde la position des stations
        pts = np.array([[ST[i]["x"], ST[i]["y"]] for i in r["ids"]])
        s_ = np.hstack([pts, pts + 0.01]); w_ = np.full(len(pts), 0.6)
    xs = np.r_[s_[:, 0], s_[:, 2]]; ys = np.r_[s_[:, 1], s_[:, 3]]
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    span = max((x1 - x0) / ART_W, (y1 - y0) / ART_H, 6 / ART_W) * 1.22
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    T = lambda x, y: (np.round((x - cx) / span + ART_W / 2).astype(int), np.round(ART_H / 2 - (y - cy) / span).astype(int))
    ax0, ax1, ay0, ay1 = cx - ART_W / 2 * span, cx + ART_W / 2 * span, cy - ART_H / 2 * span, cy + ART_H / 2 * span
    inside = lambda s: (np.maximum(s[:, 0], s[:, 2]) >= ax0) & (np.minimum(s[:, 0], s[:, 2]) <= ax1) & (np.maximum(s[:, 1], s[:, 3]) >= ay0) & (np.minimum(s[:, 1], s[:, 3]) <= ay1)
    ctx = ~mask & inside(seg)
    ci = np.where(ctx)[0]
    if len(ci) > 700: ci = ci[np.argsort(-segW[ci] - np.random.default_rng(k).random(len(ci)) * 0.2)[:700]]
    def pack(s, w):
        a, b = T(s[:, 0], s[:, 1]); c, d = T(s[:, 2], s[:, 3])
        return np.stack([a, b, c, d, np.round(w * 10).astype(int)], 1).ravel().tolist()
    reg = []
    for ring in geo["region"]:
        rr = np.array(ring); sg = np.hstack([rr[:-1], rr[1:]]); sg = sg[inside(sg)]
        if len(sg): reg += pack(sg, np.ones(len(sg)))
    sx_, sy_ = T(np.array([ST[i]["x"] for i in r["ids"]]), np.array([ST[i]["y"] for i in r["ids"]]))
    sts = [[int(a), int(b)] for a, b in zip(sx_, sy_)]
    g = lambda v: None if np.isnan(v) else round(float(v), 3)
    # mini-carte : la rivière dans la silhouette régionale (repère 0..1000)
    ms = s_[np.linspace(0, len(s_) - 1, min(len(s_), 260)).astype(int)]
    mini = np.stack([RX(ms[:, 0]), RY(ms[:, 1]), RX(ms[:, 2]), RY(ms[:, 3])], 1).round().astype(int).ravel().tolist()
    cards.append(dict(id=f"r{k}", type="river", mini=mini, key=r["key"], name=r["name"], kind=r["kind"], b=r["b"], rar=r["rar"], depts=r["depts"],
                      nst=len(r["ids"]), gauges=dict(power=g(pw[k]), res=g(rs[k]), crue=g(cr[k])),
                      art=dict(river=pack(s_, w_), ctx=pack(seg[ci], segW[ci]), region=reg, st=sts, scale=round(float(span), 4))))

# phénomènes
PH = [("sec", "Grande sécheresse", "Les rivières tombent sous leurs plus bas niveaux, plusieurs semaines d'affilée."),
      ("haut", "Hautes eaux", "Les rivières débordent de leurs habitudes, souvent au cœur de l'hiver."),
      ("chaud", "Canicule", "L'air dépasse les 23 °C de moyenne sur toute une semaine."),
      ("froid", "Grand froid", "Une semaine où l’air reste sous −2 °C en moyenne au pied des stations."),
      ("pluie", "Déluge", "Les semaines les plus pluvieuses des 26 ans."),
      ("neige", "Neige", "Une semaine de neige abondante au pied des stations.")]
cnt = collections.Counter(e["type"] for e in events)
dur = {t: np.mean([e["weeks"] for e in events if e["type"] == t]) for t in cnt}
mc, md = max(cnt.values()), max(dur.values())
for t, nm, txt in PH:
    occ = [[e["from"], e["to"]] for e in events if e["type"] == t]
    cards.append(dict(id=f"p_{t}", type="phen", key=t, name=nm, kind="Phénomène", b="*", rar=4, text=txt,
                      gauges=dict(freq=round(cnt[t] / mc, 3), dur=round(dur[t] / md, 3)), occ=occ))
order = {"R": 0, "M": 1, "S": 2, "O": 3, "*": 4}
cards.sort(key=lambda c: (order[c["b"]], -c["rar"], c["name"]))
for n, c in enumerate(cards): c["no"] = n + 1
json.dump(dict(W=W, weeks0=st["weeks0"], bassins=BASNAME, region=REGION_MINI, regionH=round(float((GY1 - GY0) / GS * 1000)), cards=cards), open(f"{OUT}/cards.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("cartes:", len(cards), collections.Counter((c["b"], c["rar"]) for c in cards))
print("sans jauge sécheresse:", sum(1 for c in cards if c["type"] == "river" and c["gauges"]["res"] is None))
