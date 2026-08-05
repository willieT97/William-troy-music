#!/usr/bin/env python3
"""Pull the most-played tunes from thesession.org and (re)build the per-type
ABC bundles in this folder.

    python3 tunes/fetch-popular.py [N]

N is how many of the most-popular tunes to fetch (default 50). Tunes are
grouped into <type>.abc files (reels.abc, jigs.abc, ...). Existing bundle
files with those names are overwritten, so hand-added tunes are best kept in
a separate file (e.g. my-tunes.abc) that this script never touches.

Popularity = number of thesession.org "tunebooks" the tune is saved in.
The tunes are traditional (public domain); the specific settings are
community transcriptions from thesession.org.

Uses `curl` for the HTTP so it works without a Python CA bundle.
"""
import json, time, os, sys, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 50
UA = "MusicArcade-MelodyTrainer/1.0 (personal educational tune library)"

# tune type -> (bundle filename, time signature). L: is 1/8 for these dance forms.
TYPE_META = {
    "reel":       ("reels.abc",       "4/4"),
    "jig":        ("jigs.abc",        "6/8"),
    "slip jig":   ("slip-jigs.abc",   "9/8"),
    "hornpipe":   ("hornpipes.abc",   "4/4"),
    "polka":      ("polkas.abc",      "2/4"),
    "slide":      ("slides.abc",      "12/8"),
    "waltz":      ("waltzes.abc",     "3/4"),
    "barndance":  ("barndances.abc",  "4/4"),
    "strathspey": ("strathspeys.abc", "4/4"),
    "march":      ("marches.abc",     "4/4"),
    "mazurka":    ("mazurkas.abc",    "3/4"),
    "three-two":  ("three-twos.abc",  "3/2"),
}

def fetch(url):
    out = subprocess.run(["curl", "-s", "--max-time", "25", "-A", UA, url],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def clean_body(abc):
    abc = abc.replace("!", "\n")   # thesession uses '!' as a phrase/line break
    lines = [ln.rstrip() for ln in abc.splitlines() if ln.strip() != ""]
    return "\n".join(lines)

def main():
    print(f"Fetching the top {N} popular tunes…", file=sys.stderr)
    tunes = []
    page, per = 1, 50
    while len(tunes) < N:
        d = fetch(f"https://thesession.org/tunes/popular?format=json&perpage={per}&page={page}")
        tunes.extend(d["tunes"])
        if page >= d["pages"]:
            break
        page += 1
    tunes = tunes[:N]

    buckets, counts, skipped = {}, {}, []
    for i, t in enumerate(tunes, 1):
        tid, name, ttype = t["id"], t["name"], t["type"]
        fname, meter = TYPE_META.get(ttype, (re.sub(r"[^a-z]+", "-", ttype.lower()) + ".abc", "4/4"))
        try:
            s = fetch(f"https://thesession.org/tunes/{tid}?format=json")["settings"][0]
            block = (f"X:{tid}\nT:{name}\nR:{ttype}\nO:Irish session\nM:{meter}\nL:1/8\n"
                     f"K:{s['key']}\n{clean_body(s['abc'])}\n")
        except Exception as e:
            skipped.append((tid, name, str(e)))
            continue
        buckets.setdefault(fname, []).append((t.get("tunebooks", 0), block))
        counts[ttype] = counts.get(ttype, 0) + 1
        print(f"  {i:2d}. [{ttype}] {name}", file=sys.stderr)
        time.sleep(0.25)

    header = ("% Irish session tunes — settings sourced from thesession.org (community\n"
              "% transcriptions; the tunes themselves are traditional / public domain).\n"
              "% Regenerate with: python3 tunes/fetch-popular.py [N]\n\n")
    for fname, blocks in buckets.items():
        blocks.sort(key=lambda b: -b[0])                 # most popular first
        with open(os.path.join(HERE, fname), "w") as f:
            f.write(header + "\n".join(b[1] for b in blocks))
        print(f"wrote {fname}: {len(blocks)} tunes", file=sys.stderr)

    print(json.dumps({"counts": counts, "total": sum(counts.values()),
                      "skipped": skipped}, indent=2))
    print("\nNow run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
