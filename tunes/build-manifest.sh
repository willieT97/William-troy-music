#!/bin/bash
# Regenerates tunes/manifest.json from the .abc bundle files in this folder.
# The deployed site (GitHub Pages) can't list a folder at runtime, so the
# Melody Trainer reads this manifest to know which tune bundles to load.
# Run it after adding/removing .abc files, before you commit & push.
cd "$(dirname "$0")" || exit 1

printf '[\n' > manifest.json
first=1
for f in *.abc; do
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
