# Song library

Every `.musicxml` file in this folder becomes a song in the Song Trainer automatically.

## Add a song

1. In **MuseScore**, write the chords (Add ▸ Text ▸ Chord Symbol) and a rhythm on the staff. Repeats and 1st/2nd endings are respected.
2. Export it: **File ▸ Export ▸ MusicXML**, and choose **Uncompressed (`.musicxml`)** — *not* the compressed `.mxl`.
3. Save the exported file into this `songs/` folder.

## See it in the list

- **Locally** (running a dev server, e.g. `python3 -m http.server`): it appears on reload — nothing else to do.
- **Deployed to GitHub Pages**: run the manifest builder once, then commit & push:

  ```sh
  sh songs/build-manifest.sh
  ```

  This writes `songs/manifest.json`, the list the live site reads (GitHub Pages can't list a folder at runtime).

## Notes

- The song title and composer come from the file's work-title / composer fields; otherwise the filename is used.
- Chords play as major/minor triads; 7ths, sus, etc. are shown as their base triad.
- The key, tempo, roman numerals and soloing scales are all worked out from the file.
