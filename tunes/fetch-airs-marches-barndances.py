#!/usr/bin/env python3
"""(Re)build marches.abc, barndances.abc and slow-airs.abc from thesession.org.

    python3 tunes/fetch-airs-marches-barndances.py

Each bundle is a hand-curated set of well-known, traditional (public-domain)
tunes. For every tune we fetch its FULL ABC from thesession.org — which carries
the correct M:/L:/K: headers — take the first setting, and re-tag it with our
own R: group and O:Irish session so the Melody Trainer's picker files it under
the right heading. thesession's own type for a tune isn't always the one we
want (most slow airs are filed there as 3/4 "waltz"), so the R: label below is
what we choose, keyed to the tune, not scraped.

Tune settings are community transcriptions from thesession.org (shared under a
Creative Commons licence); the tunes themselves are traditional / public domain.
Uses `curl` for the HTTP, matching the other fetch-*.py scripts here.
"""
import json, os, re, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
UA   = "MusicArcade-MelodyTrainer/1.0 (educational tune collection)"

# file -> (R: group label, header blurb, [thesession tune ids])
GROUPS = {
    "marches.abc": ("march",
        "Traditional Irish marches", [
        271,   # Brian Boru's March
        7309,  # O'Donnell Abu
        6673,  # Roddy McCorley
        6782,  # The Minstrel Boy
        638,   # Lord Mayo
        1308,  # After The Battle Of Aughrim
        4977,  # The Wearing Of The Green
    ]),
    "barndances.abc": ("barndance",
        "Irish barndances", [
        13734, # The Stack Of Barley
        1920,  # Jimmy Duffy's
        3515,  # Jamesy Gannon's
        3520,  # Lynch's
        7018,  # Oh Dear Mother My Toes Are Sore
    ]),
    "slow-airs.abc": ("air",
        "Slow airs — for tone and ornament", [
        4735,  # She Moved Through The Fair
        1815,  # The Coolin (An Chuilfhionn)
        2575,  # Eleanor Plunkett (O'Carolan)
        454,   # Tabhair Dom Do Lamh (Give Me Your Hand)
        957,   # Fanny Power (O'Carolan)
        2407,  # Eibhli Gheal Chiuin Ni Chearbhaill
    ]),
}

def curl(url):
    r = subprocess.run(["curl", "-s", "-L", "--max-time", "40", "-A", UA, url],
                       capture_output=True)
    return r.stdout.decode("utf-8", "replace")

def first_block(abc_text):
    """Return the first X: block of a multi-setting ABC download, as its lines."""
    lines, started = [], False
    for ln in abc_text.split("\n"):
        if ln.startswith("X:"):
            if started:
                break
            started = True
            continue
        if started:
            lines.append(ln)
    return lines

def build_tune(n, tid, r_label):
    lines = first_block(curl(f"https://thesession.org/tunes/{tid}/abc"))
    T = M = L = K = None
    body, in_body = [], False
    for ln in lines:
        if not in_body and ln.startswith("T:") and T is None: T = ln[2:].strip(); continue
        if not in_body and ln.startswith("M:"): M = ln[2:].strip(); continue
        if not in_body and ln.startswith("L:"): L = ln[2:].strip(); continue
        if not in_body and ln.startswith("K:"):
            K = re.sub(r"\s*clef=.*$", "", ln[2:]).strip(); in_body = True; continue
        if not in_body:
            continue                              # skip Z:/S:/R:/C:/other headers
        if re.match(r"^[a-zA-Z]:", ln):           # a stray header inside the body — skip
            continue
        if ln.strip():
            body.append(ln.rstrip())
    if not (T and body):
        return None
    m = re.match(r"^(.*),\s*(The|A|An)$", T)      # "Minstrel Boy, The" -> "The Minstrel Boy"
    if m:
        T = m.group(2) + " " + m.group(1)
    hdr = [f"X:{n}", f"T:{T}", f"R:{r_label}", "O:Irish session",
           f"M:{M or '4/4'}", f"L:{L or '1/8'}", f"K:{K or 'C'}"]
    return "\n".join(hdr) + "\n" + "\n".join(body) + "\n"

HEADER = ("% Irish session tunes — settings sourced from thesession.org (community\n"
          "% transcriptions; the tunes themselves are traditional / public domain).\n"
          "% {blurb}. Built by fetch-airs-marches-barndances.py — rerun it, or paste\n"
          "% more X:… blocks below, then rerun tunes/build-manifest.sh\n\n")

def main():
    for fname, (r_label, blurb, ids) in GROUPS.items():
        blocks, n = [], 0
        for tid in ids:
            n += 1
            b = build_tune(n, tid, r_label)
            if b:
                blocks.append(b)
                title = re.search(r"^T:(.+)$", b, re.M).group(1)
                print(f"  {fname}: [{r_label}] {title}", file=sys.stderr)
            else:
                n -= 1
                print(f"  {fname}: !! could not build tune id {tid}", file=sys.stderr)
            time.sleep(0.15)
        out = os.path.join(HERE, fname)
        open(out, "w", encoding="utf-8").write(HEADER.format(blurb=blurb) + "\n".join(blocks))
        print(f"wrote {fname}: {len(blocks)} tunes", file=sys.stderr)
    print("\nNow run:  sh tunes/build-manifest.sh   (then commit & push)", file=sys.stderr)

if __name__ == "__main__":
    main()
