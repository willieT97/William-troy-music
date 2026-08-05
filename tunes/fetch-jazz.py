#!/usr/bin/env python3
"""(Re)build tunes/trad-jazz.abc from The Public Domain Song Anthology
(David Berger & Chuck Israels), which is released CC0 / public domain.

    python3 tunes/fetch-jazz.py

Downloads the selected songs' MusicXML lead sheets from UVA LibraData
(doi:10.18130/V3/C4RD06), converts them to ABC with Wim Vree's xml2abc
(fetched + Python-3.9-patched automatically), strips lyrics/line-break
markers, and tags each tune O:Trad jazz. All tunes are US public domain.
Edit WANT below to change the set. Uses `curl` for the HTTP.
"""
import json, re, os, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "trad-jazz.abc")
DOI  = "doi:10.18130/V3/C4RD06"
BASE = "https://dataverse.lib.virginia.edu"
UA   = "MusicArcade-MelodyTrainer/1.0 (educational tune collection)"
TMP  = tempfile.mkdtemp(prefix="jazz_")

WANT = [
 "St Louis Blues","Memphis Blues","Beale Street Blues","Aunt Hagar's Blues","Yellow Dog Blues",
 "Careless Love","Frankie and Johnny","Make Me a Pallet on the Floor","St James Infirmary",
 "Nobody Knows You When You're Down and Out","Tain't Nobody's Bizness If I Do",
 "Good Man Is Hard to Find","Dallas Blues","Tishomingo Blues","Wabash Blues","Wang Wang Blues",
 "Sugar Blues","Jazz Me Blues","Tin Roof Blues","Farewell Blues","Buddy Bolden's Blues",
 "Singin' the Blues","When the Saints Go Marching In","Down by the Riverside",
 "Just a Closer Walk with Thee","Oh, Didn't He Ramble","Second Line","High Society",
 "That's a Plenty","Tiger Rag","Livery Stable Blues","At the Jazz Band Ball","Bugle Call Rag",
 "Twelfth Street Rag","Down Home Rag","Alexander's Ragtime Band","Charleston","Runnin' Wild",
 "Shim-Me-Sha-Wabble","I Wish I Could Shimmy Like My Sister Kate","Ballin' the Jack",
 "Some of These Days","After You've Gone","Indiana","Way Down Yonder in New Orleans","Rose Room",
 "Whispering","World Is Waiting for the Sunrise","Somebody Stole My Gal","There'll Be Some Changes Made",
]

def curl(url, binary=False):
    r = subprocess.run(["curl","-s","-L","--max-time","40","-A",UA,url], capture_output=True)
    return r.stdout if binary else r.stdout.decode("utf-8","replace")

def get_xml2abc():
    """Fetch xml2abc.py and shim the removed getchildren() for Python 3.9+."""
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

def dtype(title, meter):
    t = title.lower()
    if "blues" in t: return "blues"
    if "rag" in t: return "rag"
    if "waltz" in t or meter == "3/4": return "waltz"
    return "jazz"

def clean(abc, n):
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
    title = titlecase(T or "Untitled"); meter = M or "4/4"
    hdr = [f"X:{n}", f"T:{title}", "O:Trad jazz", f"R:{dtype(title,meter)}",
           f"M:{meter}", f"L:{L or '1/8'}"]
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

    kept, miss, n = [], [], 0
    for want in WANT:
        w = norm(want)
        fid = ids.get(w) or next((v for k, v in ids.items() if k.startswith(w) or w in k), None)
        if not fid: miss.append(want); continue
        xp = os.path.join(TMP, f"{fid}.xml")
        open(xp, "wb").write(curl(f"{BASE}/api/access/datafile/{fid}?format=original", binary=True))
        subprocess.run(["python3", x2a, "-o", TMP, xp], capture_output=True)
        ap = os.path.join(TMP, f"{fid}.abc")
        if not os.path.exists(ap): miss.append(want); continue
        n += 1
        block = clean(open(ap, encoding="utf-8", errors="replace").read(), n)
        if not block: n -= 1; miss.append(want); continue
        kept.append(block); print(f"  {n:2d}. {want}", file=sys.stderr)
        time.sleep(0.1)

    header = ("% Trad jazz & blues — melodies from The Public Domain Song Anthology\n"
              "% (David Berger & Chuck Israels), released CC0 / public domain. Converted\n"
              "% from the anthology's MusicXML lead sheets. All tunes are US public domain.\n\n")
    open(OUT, "w").write(header + "\n".join(kept))
    print(f"\nwrote {OUT}: {len(kept)} tunes; missed {miss}", file=sys.stderr)
    print("Now run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
