# Tune library (Melody Trainer)

Every `.abc` file in this folder is a **bundle** of tunes for the
[Melody Trainer](../melody-trainer_1.html). A single `.abc` file can hold as
many tunes as you like — each one is an `X:` block — so the library expands
just by pasting more tunes in. The trainer groups everything by **tune type**
(reel, jig, hornpipe…) in a searchable picker, and shows a small **tradition
tag** on each tune from its `O:` (origin) field, regardless of which file it
lives in.

Three starter collections:

- **Irish session tunes** — the **top 50 most-played tunes on
  [thesession.org](https://thesession.org)** (ranked by how many players saved
  them), tagged `O:Irish session`. Split by type into `reels.abc`, `jigs.abc`, …
- **American fiddle tunes** — 50 traditional standards collected from
  [Jim's Roots & Blues](https://jimsrootsandblues.com/favorites/), tagged
  `O:American fiddle`, in `american-fiddle.abc`. Only the plainly-**Traditional**
  settings are included — settings citing a Creative Commons licence, the
  *Fiddler's Fakebook* or any other book source, or a named modern composer
  (e.g. Bill Monroe compositions) were left out.
- **Trad jazz & blues** — 50 early jazz, ragtime and blues melodies from
  **The Public Domain Song Anthology** (David Berger & Chuck Israels), which is
  released **CC0 / public domain**, tagged `O:Trad jazz`, in `trad-jazz.abc`.
  Converted from the anthology's MusicXML lead sheets. All US public domain.

The tunes are traditional / public domain; the ABC settings were collected /
converted from the sources above.

## Add tunes

**By hand (one or a few):**

1. On thesession.org, open a tune and copy its ABC (the `X: … K: …` block plus
   the notes).
2. Paste it into the matching bundle — a reel into `reels.abc`, a jig into
   `jigs.abc`, and so on. Make sure it has `T:` (title), `R:` (type, e.g.
   `jig`), `M:` (e.g. `6/8`), `L:1/8`, `K:` and (optionally) an `O:` origin line
   for its tradition tag. Keep tunes separated by a blank line.
3. Rebuild the manifest (below).

Keep your own hand-added tunes in a separate file (e.g. `my-tunes.abc`) so the
refresh scripts below never overwrite them.

**In bulk (refresh / grow a collection):**

```sh
python3 tunes/fetch-popular.py 100     # top 100 Irish tunes from thesession.org
python3 tunes/fetch-american.py        # American fiddle tunes from Jim's site
python3 tunes/fetch-jazz.py            # trad jazz & blues from the PD Song Anthology
```

`fetch-popular.py` rewrites the `<type>.abc` bundles from thesession.org.
`fetch-american.py` rewrites `american-fiddle.abc` from jimsrootsandblues.com,
keeping only the Traditional settings (edit its `CANDIDATES` list to change the
set). `fetch-jazz.py` rewrites `trad-jazz.abc` from the CC0 Public Domain Song
Anthology's MusicXML, converting with xml2abc (edit its `WANT` list to change
the set). Each script has no dependencies beyond `curl` + Python 3.
It uses `curl`, so no Python setup is needed.

## Make it show up

- **Locally** (running a dev server, e.g. `python3 -m http.server`): reload the
  page — nothing else to do; the trainer reads the folder through the manifest.
- **Deployed to GitHub Pages**: regenerate the manifest, then commit & push:

  ```sh
  sh tunes/build-manifest.sh
  ```

  This writes `tunes/manifest.json` — the list of bundle files the live site
  reads (GitHub Pages can't list a folder at runtime).

## What the trainer understands

Single melody lines: keys and modes (`K:Edorian`, `K:Gmajor`…), the common
session meters (4/4, 6/8, 9/8, 12/8, 2/4, 3/4…), dotted rhythms (`a>b`),
triplets, ties and rests. Ornaments are **stripped** (grace notes, rolls,
slurs) so you learn the bones of the tune; **repeats** play once through and
**1st/2nd endings** play both in sequence. Those last two show a small note on
load — they don't stop a tune from working.

## Fields

- `T:` title — shown in the picker and above the stave.
- `R:` type (`reel`, `jig`, `slip jig`, `hornpipe`, `polka`, `slide`, `waltz`…)
  — how the picker groups tunes.
- `M:` / `L:` / `K:` — meter, unit note length, key.
