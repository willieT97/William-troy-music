# Song library

Every `.musicxml` file in this folder becomes a song in the Song Trainer automatically.

## Add a song

1. In **MuseScore**, write the chords (Add ▸ Text ▸ Chord Symbol) and a rhythm on the staff. Repeats and 1st/2nd endings are respected.
2. Export it: **File ▸ Export ▸ MusicXML**, and choose **Uncompressed (`.musicxml`)** — *not* the compressed `.mxl`.
3. Save the exported file into this `songs/` folder.

## Whole songs: sections + rounds

Write the whole song in order (Intro, Verse, Chorus, Bridge…) and mark it up so it stays compact:

- **Name each section** with a **Rehearsal Mark** at its first bar — select the bar and press **Ctrl/Cmd + M**, then type `Verse`, `Chorus`, `Bridge`, etc. Each named section starts a new labelled line in the trainer. (Recognised words: verse, chorus, bridge, intro, outro, pre-chorus, solo, interlude, refrain, hook, break, coda, ending, tag, vamp…)
- **Repeat a run of chords** by wrapping it in **repeat barlines** (`‖: … :‖`) — from the Barlines palette.
- **Set the number of rounds** on the **end-repeat barline**: select it, and in **Properties** set **Play count** to how many times it plays (e.g. `4`). The trainer shows it as **×4** and plays it that many times.

Everything then plays straight through the whole form — Verse ×2, Chorus ×4, Bridge, etc. — and the bass and drums follow the same road-map. Tip: keep bass and drums inside the same repeat barlines as the chords so all three parts collapse to the short loop instead of being written out in full.

**Empty bars and pickups.** Each part only shows the bars where it actually plays — empty (all-rest) bars are left out, so a bass that rests through the intro just starts at its first note. A **pickup bar** (an incomplete first measure / count-in) is drawn narrow and sits at the start of the first line, so that line can hold the pickup plus four full bars.

## See it in the list

- **Locally** (running a dev server, e.g. `python3 -m http.server`): it appears on reload — nothing else to do.
- **Deployed to GitHub Pages**: run the manifest builder once, then commit & push:

  ```sh
  sh songs/build-manifest.sh
  ```

  This writes `songs/manifest.json`, the list the live site reads (GitHub Pages can't list a folder at runtime).

## Add a bass line and drums (optional)

Write them as **extra instruments in the same MuseScore file** — no separate files needed:

1. **Bass:** add a bass instrument (Bass Guitar / Electric Bass) and write the actual bass notes on its staff.
2. **Drums:** add a **Drumset** instrument and write the groove (kick, snare, hi-hats, etc.) on its percussion staff.
3. Export the whole thing as one Uncompressed `.musicxml` as above.

The trainer plays all three parts together in time, and adds **bass** / **drums** checkboxes so they can be toggled on and off while you play along. Repeats apply to every part, so the bass and drums follow the same road-map as the chords.

## Major or minor?

A key signature can be a major key *or* its relative minor (e.g. one sharp = **G major** or **E minor**), and MuseScore can't tell the trainer which. So:

- When you **import a file with the ＋ button**, the trainer asks you which one.
- To set it permanently for a folder song (and for the live site), drop a tiny sidecar next to the file — same name, `.json` — e.g. for `Zombie1.musicxml`:

  ```json
  { "mode": "minor" }
  ```

  (`"mode"` is `"major"` or `"minor"`.) The trainer picks it up automatically. You can also just flip the on-screen **Tonality** switch, which is remembered in your browser.

## Notes

- The song title and composer come from the file's work-title / composer fields; otherwise the filename is used.
- Chords play as major/minor triads; 7ths, sus, etc. are shown as their base triad.
- The key, tempo, roman numerals and soloing scales are all worked out from the file.
- The bass part is any pitched staff that isn't the chord staff; the drum part is any percussion staff. The bass plays the notes exactly as written; drums use the standard General-MIDI drum sounds.
