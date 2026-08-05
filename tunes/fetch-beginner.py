#!/usr/bin/env python3
"""(Re)build tunes/beginner.abc from The Public Domain Song Anthology
(David Berger & Chuck Israels), released CC0 / public domain.

    python3 tunes/fetch-beginner.py

A beginner / familiar-melody tier: nursery rhymes, simple folk songs,
Christmas carols and spirituals. Downloads each song's MusicXML lead sheet
from UVA LibraData (doi:10.18130/V3/C4RD06), converts to ABC with Wim Vree's
xml2abc (fetched + Python-3.9-patched automatically), strips lyrics/line-break
markers, and tags each O:Beginner with a category type (nursery/folk/carol/
spiritual). All tunes are US public domain. Edit WANT below to change the set.
Uses `curl` for the HTTP.
"""
import json, re, os, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "beginner.abc")
DOI  = "doi:10.18130/V3/C4RD06"
BASE = "https://dataverse.lib.virginia.edu"
UA   = "MusicArcade-MelodyTrainer/1.0 (educational tune collection)"
TMP  = tempfile.mkdtemp(prefix="beginner_")

# (title, category) — category becomes the R: type / picker group
WANT = [
 ("Twinkle Twinkle Little Star","nursery"),("Mary Had a Little Lamb","nursery"),
 ("London Bridge Is Falling Down","nursery"),("Row Row Row Your Boat","nursery"),
 ("Pop Goes the Weasel","nursery"),("This Old Man","nursery"),
 ("Old MacDonald Had a Farm","nursery"),("Frere Jacques","nursery"),
 ("Here We Go Round the Mulberry Bush","nursery"),("Polly Wolly Doodle","nursery"),
 ("Go Tell Aunt Rhody","nursery"),("Tisket a Tasket","nursery"),
 ("Rock-a-bye Baby","nursery"),("Billy Boy","nursery"),("Alouette","nursery"),

 ("Oh My Darling Clementine","folk"),("On Top of Old Smoky","folk"),
 ("Home on the Range","folk"),("Red River Valley","folk"),("Shenandoah","folk"),
 ("Down in the Valley","folk"),("My Bonnie Lies Over the Ocean","folk"),
 ("Camptown Races","folk"),("Old Folks at Home","folk"),("Beautiful Dreamer","folk"),
 ("Yellow Rose of Texas","folk"),("She'll Be Comin' Round the Mountain","folk"),
 ("I've Been Working on the Railroad","folk"),("Auld Lang Syne","folk"),
 ("Scarborough Fair","folk"),("Greensleeves","folk"),("Loch Lomond","folk"),
 ("Londonderry Air","folk"),

 ("Silent Night","carol"),("Jingle Bells","carol"),("Deck the Halls","carol"),
 ("Joy to the World","carol"),("O Tannenbaum","carol"),
 ("Hark! the Herald Angels Sing","carol"),("God Rest Ye Merry Gentlemen","carol"),
 ("O Little Town of Bethlehem","carol"),("First Noel","carol"),
 ("Angels We Have Heard on High","carol"),("We Wish You a Merry Christmas","carol"),
 ("Away in a Manger","carol"),

 ("Swing Low Sweet Chariot","spiritual"),("Go Down Moses","spiritual"),
 ("Nobody Knows the Trouble I've Seen","spiritual"),("Joshua Fit the Battle of Jericho","spiritual"),
 ("Deep River","spiritual"),("Go Tell It on the Mountain","spiritual"),
 ("Michael Row the Boat Ashore","spiritual"),("Amazing Grace","spiritual"),
 ("Were You There","spiritual"),("Shall We Gather at the River","spiritual"),
]

def curl(url, binary=False):
    r = subprocess.run(["curl","-s","-L","--max-time","40","-A",UA,url], capture_output=True)
    return r.stdout if binary else r.stdout.decode("utf-8","replace")

def get_xml2abc():
    p = os.path.join(TMP, "xml2abc.py")
    src = curl("https://raw.githubusercontent.com/SpotlightKid/xml2abc/master/xml2abc.py")
    shim = ("import sys as _sys\n_sys.modules['_elementtree']=None\n"
            "import xml.etree.ElementTree as _CE\n"
            "if not hasattr(_CE.Element,'getchildren'):\n"
            "    _CE.Element.getchildren=lambda self: list(self)\n"
            "    _CE.Element.getiterator=lambda self,t=None: self.iter(t)\n")
    lines = src.split("\n"); lines.insert(2, shim)
    open(p, "w", encoding="latin-1").write("\n".join(lines))
    return p

norm = lambda s: re.sub(r"[^A-Z0-9]+", " ", s.upper()).strip()

def titlecase(s):
    def cap(w):
        w = w.lower()
        for i, ch in enumerate(w):
            if ch.isalpha(): return w[:i] + w[i].upper() + w[i+1:]
        return w
    s = " ".join(cap(w) for w in s.split(" "))
    m = re.match(r"^(.*),\s*(The|A|An)$", s)
    return (m.group(2) + " " + m.group(1)) if m else s

def clean(abc, n, ttype):
    T = C = M = L = K = None; body = []; inbody = False
    for ln in abc.split("\n"):
        if ln.startswith("X:"): continue
        if ln.startswith("T:") and T is None: T = ln[2:].strip(); continue
        if ln.startswith("C:") and C is None: C = ln[2:].strip(); continue
        if ln.startswith("M:") and not inbody: M = ln[2:].strip(); continue
        if ln.startswith("L:") and not inbody: L = ln[2:].strip(); continue
        if ln.startswith("K:") and not inbody:
            K = re.sub(r"\s*clef=.*$", "", ln[2:]).strip(); inbody = True; continue
        if not inbody: continue
        if re.match(r"^[a-zA-Z]:", ln): continue
        ln = re.sub(r"\s*%\s*\d+\s*$", "", ln).replace("$", " ").rstrip()
        if ln.strip(): body.append(ln)
    if not body: return None
    hdr = [f"X:{n}", f"T:{titlecase(T or 'Untitled')}", "O:Beginner", f"R:{ttype}",
           f"M:{M or '4/4'}", f"L:{L or '1/8'}"]
    if C: hdr.append(f"C:{C}")
    hdr.append(f"K:{K or 'C'}")
    return "\n".join(hdr) + "\n" + "\n".join(body) + "\n"

def main():
    print("Fetching xml2abc + anthology file list…", file=sys.stderr)
    x2a = get_xml2abc()
    meta = json.loads(curl(f"{BASE}/api/datasets/:persistentId/?persistentId={DOI}"))
    ids = {}
    for f in meta["data"]["latestVersion"]["files"]:
        df = f["dataFile"]; nm = df.get("filename", "")
        if nm.lower().endswith(".xml"): ids[norm(nm[:-4])] = df["id"]

    kept, miss, kinds, n = [], [], {}, 0
    for want, ttype in WANT:
        w = norm(want)
        fid = ids.get(w) or next((v for k, v in ids.items() if k.startswith(w) or w in k), None)
        if not fid: miss.append(want); continue
        xp = os.path.join(TMP, f"{fid}.xml")
        open(xp, "wb").write(curl(f"{BASE}/api/access/datafile/{fid}?format=original", binary=True))
        subprocess.run(["python3", x2a, "-o", TMP, xp], capture_output=True)
        ap = os.path.join(TMP, f"{fid}.abc")
        if not os.path.exists(ap): miss.append(want); continue
        n += 1
        block = clean(open(ap, encoding="utf-8", errors="replace").read(), n, ttype)
        if not block: n -= 1; miss.append(want); continue
        kept.append(block); kinds[ttype] = kinds.get(ttype, 0) + 1
        print(f"  {n:2d}. [{ttype}] {want}", file=sys.stderr)
        time.sleep(0.1)

    header = ("% Beginner folk songs & carols — familiar melodies from The Public Domain\n"
              "% Song Anthology (David Berger & Chuck Israels), released CC0 / public\n"
              "% domain. Nursery rhymes, simple folk songs, carols and spirituals for\n"
              "% first melody playing. All tunes are US public domain.\n\n")
    open(OUT, "w").write(header + "\n".join(kept))
    print(f"\nwrote {OUT}: {len(kept)} tunes {kinds}; missed {miss}", file=sys.stderr)
    print("Now run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
