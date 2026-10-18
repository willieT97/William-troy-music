#!/usr/bin/env python3
"""Add thesession.org popular tunes that the library doesn't have yet.

    python3 tunes/add-popular.py [N]      # look at the top N (default 100)
    sh tunes/build-manifest.sh            # then rebuild manifest + index

Unlike fetch-popular.py (which rewrites the bundles from scratch, so a tune
that slipped down the chart would vanish), this only ADDS: each missing tune
is appended to its <type>.abc bundle, same block format. A tune counts as
already there if its thesession id (X:) or its name is in any bundle.

COMPOSED holds modern compositions that are still in copyright: they are
popular at sessions but are not traditional, so they stay out of the
library. Add a thesession id there to keep a tune out.
"""
import json, os, re, sys, glob, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
UA = "MusicArcade-MelodyTrainer/1.0 (personal educational tune library)"

COMPOSED = {
    4997: "Ashokan Farewell (Jay Ungar, 1982)",
    2410: "Farewell To Whalley Range (Michael McGoldrick)",
    727:  "Brenda Stubbert's (Jerry Holland)",
}

# same table as fetch-popular.py
TYPE_META = {
    "reel": ("reels.abc", "4/4"), "jig": ("jigs.abc", "6/8"), "slip jig": ("slip-jigs.abc", "9/8"),
    "hornpipe": ("hornpipes.abc", "4/4"), "polka": ("polkas.abc", "2/4"), "slide": ("slides.abc", "12/8"),
    "waltz": ("waltzes.abc", "3/4"), "barndance": ("barndances.abc", "4/4"), "strathspey": ("strathspeys.abc", "4/4"),
    "march": ("marches.abc", "4/4"), "mazurka": ("mazurkas.abc", "3/4"), "three-two": ("three-twos.abc", "3/2"),
}

def fetch(url):
    out = subprocess.run(["curl", "-s", "--max-time", "25", "-A", UA, url],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def clean_body(abc):
    abc = abc.replace("!", "\n")
    return "\n".join(ln.rstrip() for ln in abc.splitlines() if ln.strip())

def norm(s):
    s = s.lower().strip(); s = re.sub(r"^the\s+", "", s); s = re.sub(r",\s*the$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def main():
    have_ids, have_names = set(), set()
    for f in glob.glob(os.path.join(HERE, "*.abc")):
        txt = open(f, encoding="utf-8").read()
        have_ids |= {int(x) for x in re.findall(r"(?m)^X:\s*(\d+)", txt)}
        have_names |= {norm(t) for t in re.findall(r"(?m)^T:(.*)$", txt)}
    tunes, page = [], 1
    while len(tunes) < N:
        d = fetch(f"https://thesession.org/tunes/popular?format=json&perpage=50&page={page}")
        tunes += d["tunes"]
        if page >= d["pages"]: break
        page += 1
    added, left_out = {}, []
    for t in tunes[:N]:
        tid, name, ttype = t["id"], t["name"], t["type"]
        if tid in have_ids or norm(name) in have_names: continue
        if tid in COMPOSED: left_out.append(COMPOSED[tid]); continue
        fname, meter = TYPE_META.get(ttype, (re.sub(r"[^a-z]+", "-", ttype.lower()) + ".abc", "4/4"))
        s = fetch(f"https://thesession.org/tunes/{tid}?format=json")["settings"][0]
        block = (f"X:{tid}\nT:{name}\nR:{ttype}\nO:Irish session\nM:{meter}\nL:1/8\n"
                 f"K:{s['key']}\n{clean_body(s['abc'])}\n")
        path = os.path.join(HERE, fname)
        prev = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        with open(path, "a", encoding="utf-8") as f:
            f.write(("" if prev.endswith("\n\n") or not prev else ("\n" if prev.endswith("\n") else "\n\n")) + block)
        have_ids.add(tid); have_names.add(norm(name))
        added.setdefault(fname, []).append(name)
        print(f"  + [{ttype}] {name}", file=sys.stderr)
        time.sleep(0.3)
    print(json.dumps({"added": added, "total": sum(len(v) for v in added.values()),
                      "left_out_as_composed": left_out}, indent=2, ensure_ascii=False))
    print("\nNow run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
