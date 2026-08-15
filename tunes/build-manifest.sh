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

# Also rebuild index.json — every tune's name/rhythm/key/origin, pulled from
# the bundles. The site-wide search box reads this instead of downloading
# every bundle just to know the tune names.
python3 - <<'PYEOF'
import json, re, glob
out = []
for f in sorted(glob.glob('*.abc')):
    txt = open(f, encoding='utf-8', errors='replace').read()
    for block in re.split(r'\n(?=X:)', txt):
        if not block.strip().startswith('X:'): continue
        def field(tag, block=block):
            m = re.search(r'^' + tag + r':\s*(.+)$', block, re.M)
            return m.group(1).strip() if m else ''
        name = field('T')
        if name:
            out.append({'n': name, 'r': field('R'), 'k': field('K'), 'o': field('O'), 'f': f})
json.dump(out, open('index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('Wrote index.json:', len(out), 'tunes')
PYEOF
