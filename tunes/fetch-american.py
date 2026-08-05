#!/usr/bin/env python3
"""(Re)build tunes/american-fiddle.abc from Jim's Roots & Blues
(jimsrootsandblues.com), keeping ONLY the plainly-Traditional settings.

    python3 tunes/fetch-american.py

Settings that cite a Creative Commons licence, Paul Hardy's tunebook, the
Fiddler's Fakebook, any B: book source, or a named modern composer are
skipped, so what remains is public-domain traditional American fiddle tunes.
Edit CANDIDATES / EXCLUDE below to change the set. Uses `curl` for the HTTP.

The tunes are traditional American fiddle tunes (public domain); the ABC was
collected from jimsrootsandblues.com.
"""
import re, sys, time, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "american-fiddle.abc")
CAP  = 50
UA   = "Mozilla/5.0 (MusicArcade educational tune collection)"

# candidate tune slugs (jimsrootsandblues.com/<slug>/), roughly most-standard
# first; the filter + cap trim to CAP. Add slugs here to grow the set.
CANDIDATES = """
soldiers-joy arkansas-traveler old-joe-clark blackberry-blossom whiskey-before-breakfast
red-haired-boy billy-in-the-lowground fishers-hornpipe devils-dream turkey-in-the-straw
bill-cheatham cumberland-gap sally-goodin forked-deer mississippi-sawyer cherokee-shuffle
ragtime-annie saint-annes-reel temperance-reel liberty over-the-waterfall june-apple
big-sciota cold-frosty-morning kitchen-girl angeline-the-baker cluck-old-hen eighth-of-january
golden-slippers-2 buffalo-gals black-mountain-rag salt-creek grey-eagle sandy-river-belle
paddy-on-the-turnpike ricketts-hornpipe sailors-hornpipe boil-the-cabbage-down flop-eared-mule
beaumont-rag speed-the-plow katy-hill dusty-miller stoney-point glory-in-the-meetinghouse
squirrel-hunters cattle-in-the-cane breaking-up-christmas bonaparte-crossing-the-rhine
goodbye-liza-jane back-up-and-push tennessee-wagoner white-horse-breakdown duck-river
camp-chase abes-retreat boston-boy georgia-boys goin-up-caney new-five-cents old-virginia-reel
reelfoot-reel young-dan-tucker midnight-on-the-water wednesday-night-waltz red-river-waltz
cedar-gap sally-growler-hornpipe hollow-poplar jenny-lynn little-dutch-girl goosey-boy
""".split()

# known modern-copyright tunes to exclude even if the site marks them "Traditional"
EXCLUDE = {"salt-creek"}

def fetch(url):
    return subprocess.run(["curl","-s","-L","--max-time","25","-A",UA,url],
                          capture_output=True, text=True, check=True).stdout

def extract_first(slug):
    page = fetch(f"https://jimsrootsandblues.com/{slug}/")
    blocks = re.findall(r'var abc = "((?:[^"\\]|\\.)*)"', page)
    if not blocks: return None
    s = blocks[0].replace("\x01", "\n")
    s = s.replace('\\"','"').replace("\\'","'").replace("\\\\","\\").replace("\\/","/")
    return s

def field(abc, letter):
    m = re.search(r'^%s:(.*)$' % letter, abc, re.M)
    return m.group(1).strip() if m else ""

def norm_title(t):
    t = re.sub(r"\s+", " ", t.strip())
    m = re.match(r"^(.*),\s*(The|A|An)$", t)
    return (m.group(2) + " " + m.group(1)) if m else t

def derive_type(title, meter):
    t = title.lower(); m = meter.replace(" ", "")
    if "hornpipe" in t: return "hornpipe"
    if "rag" in t: return "rag"
    if "waltz" in t or m == "3/4": return "waltz"
    if m == "6/8": return "jig"
    return "reel"

def body_after_K(abc):
    out, seen = [], False
    for ln in abc.split("\n"):
        if seen:
            if ln.strip(): out.append(ln)
        elif re.match(r"^K:", ln):
            seen = True
    return "\n".join(out)

def restrictive(abc, comp):
    low = abc.lower()
    if re.search(r"creative commons|cc[\s-]?by|paul hardy|fakebook", low): return "CC / copyrighted book"
    if re.search(r"^B:\S", abc, re.M): return "cites a book source"
    c = comp.strip().lower()
    if c and "trad" not in c: return f"composer: {comp.strip()}"
    return None

def main():
    kept, skipped, n = [], [], 0
    for slug in CANDIDATES:
        if len(kept) >= CAP: break
        if slug in EXCLUDE:
            skipped.append((slug, "excluded (modern copyright)")); continue
        try:
            abc = extract_first(slug)
        except Exception as e:
            skipped.append((slug, f"fetch error {e}")); continue
        if not abc:
            skipped.append((slug, "no abc")); continue
        reason = restrictive(abc, field(abc, "C"))
        if reason:
            skipped.append((slug, reason)); continue
        title = norm_title(field(abc, "T") or slug.replace("-", " ").title())
        body  = body_after_K(abc)
        if not body.strip():
            skipped.append((slug, "empty body")); continue
        meter = field(abc, "M") or "4/4"
        n += 1
        block = (f"X:{n}\nT:{title}\nO:American fiddle\nR:{derive_type(title, meter)}\n"
                 f"M:{meter}\nL:{field(abc,'L') or '1/8'}\nC:Traditional\n"
                 f"K:{field(abc,'K') or 'D'}\n{body}\n")
        kept.append(block)
        print(f"  keep {n:2d}. {title}", file=sys.stderr)
        time.sleep(0.25)

    header = ("% American fiddle tunes — ABC collected from Jim's Roots & Blues\n"
              "% (jimsrootsandblues.com). Only the plainly-Traditional settings are\n"
              "% included; settings citing a copyrighted book, a CC licence, or a\n"
              "% named modern composer were skipped. The tunes are traditional\n"
              "% American fiddle tunes (public domain).\n\n")
    with open(OUT, "w") as f:
        f.write(header + "\n".join(kept))
    print(f"\nwrote {OUT}: {len(kept)} tunes; skipped {len(skipped)}", file=sys.stderr)
    for s, r in skipped: print(f"   - {s}: {r}", file=sys.stderr)
    print("\nNow run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
