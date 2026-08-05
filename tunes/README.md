# Tune library (Melody Trainer)

Every `.abc` file in this folder is a **bundle** of tunes for the
[Melody Trainer](../melody-trainer_1.html). A single `.abc` file can hold as
many tunes as you like — each one is an `X:` block — so the library expands
just by pasting more tunes in. The trainer groups everything by **tune type**
(reel, jig, hornpipe…) in a searchable picker, regardless of which file a tune
lives in.

The starter set is the **top 50 most-played tunes on
[thesession.org](https://thesession.org)** (ranked by how many players have
saved them). The tunes are traditional / public domain; the specific settings
are community transcriptions from thesession.org.

## Add tunes

**By hand (one or a few):**

1. On thesession.org, open a tune and copy its ABC (the `X: … K: …` block plus
   the notes).
2. Paste it into the matching bundle — a reel into `reels.abc`, a jig into
   `jigs.abc`, and so on. Make sure it has `T:` (title), `R:` (type, e.g.
   `jig`), `M:` (e.g. `6/8`), `L:1/8` and `K:` lines. Keep tunes separated by a
   blank line.
3. Rebuild the manifest (below).

Keep your own hand-added tunes in a separate file (e.g. `my-tunes.abc`) so the
refresh script below never overwrites them.

**In bulk (refresh / grow the popular set):**

```sh
python3 tunes/fetch-popular.py 100     # pull the top 100 most-played tunes
```

This rewrites the `<type>.abc` bundles (reels, jigs, …) from thesession.org.
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
