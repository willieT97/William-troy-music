#!/bin/bash
# Regenerates songs/manifest.json from the .musicxml files in this folder.
# The deployed site (GitHub Pages) reads this manifest to build the song list.
# Run it after adding/removing songs, before you commit & push.
cd "$(dirname "$0")" || exit 1

printf '[\n' > manifest.json
first=1
for f in *.musicxml; do
  [ -e "$f" ] || continue
  if [ $first -eq 0 ]; then printf ',\n' >> manifest.json; fi
  # escape backslashes and double-quotes for valid JSON
  esc=$(printf '%s' "$f" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '  "%s"' "$esc" >> manifest.json
  first=0
done
printf '\n]\n' >> manifest.json

echo "Wrote manifest.json:"
cat manifest.json
