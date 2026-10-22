"""
Chord names and fingerings for the tune pages' "Chords" section.

  parse(sym)          ABC chord symbol ("G#dim", "Bb7", "C/E") -> chord dict, or None
  shape(inst, chord)  -> {'frets': [...], 'base': n} for guitar / uke / gdae
  svg(inst, chord)    -> a small chord-box diagram (static SVG, so it's readable
                         without JavaScript)

The common shapes are the site's own: chords.html (guitar and tenor banjo
majors/minors, the guitar 7ths) and ukulele-chords.html. Anything else —
7ths on uke and banjo, diminished, m7♭5… — is worked out by search(): the
lowest, most compact grip that holds every note the chord needs.

'gdae' is tenor banjo AND mandolin: same tuning in fifths, so same shapes.
"""
import re
from itertools import product

NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

# quality as written in the ABC -> (intervals, which may be left out, how it's printed)
QUAL = {
    '':     ([0, 4, 7], [], ''),            'maj': ([0, 4, 7], [], ''),
    'm':    ([0, 3, 7], [], 'm'),           'min': ([0, 3, 7], [], 'm'),
    '7':    ([0, 4, 7, 10], [7], '7'),      'm7':  ([0, 3, 7, 10], [7], 'm7'),
    'maj7': ([0, 4, 7, 11], [7], 'maj7'),
    'dim':  ([0, 3, 6, 9], [], 'dim'),      # songbook "dim" = the four-note dim7, as played
    'dim7': ([0, 3, 6, 9], [], 'dim7'),
    '+':    ([0, 4, 8], [], '+'),           'aug': ([0, 4, 8], [], '+'),
    '6':    ([0, 4, 7, 9], [7], '6'),       'm6':  ([0, 3, 7, 9], [7], 'm6'),
    'm7b5': ([0, 3, 6, 10], [], 'm7♭5'),
    '7#5':  ([0, 4, 8, 10], [], '7♯5'),     '7b5': ([0, 4, 6, 10], [], '7♭5'),
    '9':    ([0, 4, 7, 10, 2], [7], '9'),   '7b9': ([0, 4, 7, 10, 1], [7], '7♭9'),
}

def _pc(letter, acc):
    return (NAT[letter.upper()] + (1 if acc in ('#', '♯') else -1 if acc in ('b', '♭') else 0)) % 12

def parse(sym):
    sym = sym.strip()
    m = re.fullmatch(r'([A-G])([#b♯♭]?)([a-z0-9#+]*?)(?:/([A-G])([#b♯♭]?))?', sym)
    if not m or m.group(3) not in QUAL: return None
    ivs, opt, qname = QUAL[m.group(3)]
    root = _pc(m.group(1), m.group(2))
    flat = m.group(2) in ('b', '♭') or (m.group(2) == '' and m.group(1) == 'F')
    rname = m.group(1) + {'#': '♯', 'b': '♭'}.get(m.group(2), m.group(2))
    bass = _pc(m.group(4), m.group(5)) if m.group(4) else None
    bname = (m.group(4) + {'#': '♯', 'b': '♭'}.get(m.group(5), m.group(5))) if m.group(4) else None
    name = rname + qname + ('/' + bname if bname else '')
    return {'name': name, 'shape_name': rname + qname, 'root': root, 'pcs': [(root + i) % 12 for i in ivs],
            'optional': [(root + i) % 12 for i in opt], 'q': m.group(3), 'bass': bass, 'bass_name': bname}

# ---------------------------------------------------------------- instruments
INST = {
    'guitar': {'open': [40, 45, 50, 55, 59, 64], 'names': 'E A D G B E', 'label': 'Guitar'},
    'uke':    {'open': [67, 60, 64, 69], 'names': 'G C E A', 'label': 'Ukulele'},
    'gdae':   {'open': [43, 50, 57, 64], 'names': 'G D A E', 'label': 'Tenor banjo & mandolin'},
}

# the site's own shapes (frets low string -> high; -1 = not played)
G_MAJ = {5: [1, 3, 3, 2, 1, 1], 0: [-1, 3, 2, 0, 1, 0], 7: [3, 2, 0, 0, 0, 3], 2: [-1, -1, 0, 2, 3, 2], 9: [-1, 0, 2, 2, 2, 0],
         4: [0, 2, 2, 1, 0, 0], 11: [-1, 2, 4, 4, 4, 2], 6: [2, 4, 4, 3, 2, 2], 1: [-1, 4, 6, 6, 6, 4], 8: [4, 6, 6, 5, 4, 4],
         3: [-1, 6, 8, 8, 8, 6], 10: [-1, 1, 3, 3, 3, 1]}
G_MIN = {5: [1, 3, 3, 1, 1, 1], 0: [-1, 3, 5, 5, 4, 3], 7: [3, 5, 5, 3, 3, 3], 2: [-1, -1, 0, 2, 3, 1], 9: [-1, 0, 2, 2, 1, 0],
         4: [0, 2, 2, 0, 0, 0], 11: [-1, 2, 4, 4, 3, 2], 6: [2, 4, 4, 2, 2, 2], 1: [-1, 4, 6, 6, 5, 4], 8: [4, 6, 6, 4, 4, 4],
         3: [-1, 6, 8, 8, 7, 6], 10: [-1, 1, 3, 3, 2, 1]}
G_7 = {4: [0, 2, 0, 1, 0, 0], 9: [-1, 0, 2, 0, 2, 0], 2: [-1, -1, 0, 2, 1, 2], 7: [3, 2, 0, 0, 0, 1], 0: [-1, 3, 2, 3, 1, 0],
       11: [-1, 2, 1, 2, 0, 2]}
B_MAJ = {0: [0, 2, 3, 0], 1: [1, 3, 4, 1], 2: [2, 0, 0, 2], 3: [0, 1, 1, 3], 4: [1, 2, 2, 0], 5: [2, 3, 3, 1], 6: [3, 4, 4, 2],
         7: [0, 0, 2, 3], 8: [1, 1, 3, 4], 9: [2, 2, 4, 0], 10: [3, 0, 1, 1], 11: [4, 1, 2, 2]}
B_MIN = {0: [0, 1, 3, 3], 1: [1, 2, 4, 0], 2: [2, 0, 0, 1], 3: [3, 1, 1, 2], 4: [0, 2, 2, 0], 5: [1, 3, 3, 1], 6: [2, 4, 4, 2],
         7: [0, 0, 1, 3], 8: [1, 1, 2, 4], 9: [2, 2, 3, 0], 10: [3, 3, 4, 1], 11: [4, 0, 2, 2]}
U_SEED = {(0, ''): [0, 0, 0, 3], (5, ''): [2, 0, 1, 0], (7, ''): [0, 2, 3, 2], (9, 'm'): [2, 0, 0, 0], (2, ''): [2, 2, 2, 0],
          (2, 'm'): [2, 2, 1, 0], (9, ''): [2, 1, 0, 0], (4, 'm'): [0, 4, 3, 2], (4, '7'): [1, 2, 0, 2], (7, '7'): [0, 2, 1, 2]}

def seeded(inst, root, q):
    q = {'maj': '', 'min': 'm'}.get(q, q)
    if inst == 'guitar':
        return {'': G_MAJ, 'm': G_MIN, '7': G_7}.get(q, {}).get(root)
    if inst == 'gdae':
        return {'': B_MAJ, 'm': B_MIN}.get(q, {}).get(root)
    if inst == 'uke':
        return U_SEED.get((root, q))
    return None

def search(inst, chord):
    """The easiest grip with every note the chord needs: lowest position,
    fewest fingers, open strings welcome, root (or the slash note) in the bass on guitar."""
    opn = INST[inst]['open']; n = len(opn)
    need = set(chord['pcs']) - set(chord['optional']); allowed = set(chord['pcs'])
    if chord['bass'] is not None: allowed.add(chord['bass'])
    best = None
    for start in range(0, 10):
        span = [0] + list(range(max(1, start), start + 4))
        opts = [span + ([-1] if inst == 'guitar' and i < 2 else []) for i in range(n)]
        for fr in product(*opts):
            played = [(opn[i] + f) for i, f in enumerate(fr) if f >= 0]
            if len(played) < (4 if inst == 'guitar' else n): continue
            pcs = [p % 12 for p in played]
            if not set(pcs) <= allowed or not need <= set(pcs): continue
            if inst == 'guitar' and fr[1] == -1 and fr[0] != -1: continue        # no muted string in the middle
            low = min(played) % 12
            want_bass = chord['bass'] if chord['bass'] is not None else chord['root']
            fretted = [f for f in fr if f > 0]
            cost = (max(fretted) if fretted else 0) * 3 + len(fretted) * 2 + (max(fretted) - min(fretted) if fretted else 0) * 2
            cost += fr.count(-1) * 1
            if inst == 'guitar' and low != want_bass: cost += 12
            if inst != 'guitar' and chord['bass'] is None and low != chord['root']: cost += 1
            cost += 3 * (len(need) and len(pcs) - len(set(pcs)) > 2)
            if best is None or cost < best[0]: best = (cost, list(fr))
        if best and start > 2: break
    return best[1] if best else None

def shape(inst, chord):
    fr = None
    if chord['bass'] is None or inst != 'guitar':
        fr = seeded(inst, chord['root'], chord['q'])
    fr = fr or search(inst, chord)
    if not fr: return None
    fretted = [f for f in fr if f > 0]
    base = 1 if not fretted or max(fretted) <= 4 else min(fretted)
    return {'frets': fr, 'base': base}

def svg(inst, chord):
    sh = shape(inst, chord)
    if not sh: return ''
    fr, base = sh['frets'], sh['base']; n = len(fr)
    gap, fg, padl, padt = (13 if n == 6 else 17), 18, 20, 30
    w = padl + gap * (n - 1) + 16; h = padt + fg * 4 + 12
    out = [f'<svg class="cbox" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
           f'aria-label="{chord["name"]} chord on {INST[inst]["label"].lower()}: frets {" ".join("x" if f < 0 else str(f) for f in fr)}">']
    out.append(f'<text x="{padl + gap * (n - 1) / 2}" y="13" class="cn">{chord["name"]}</text>')
    nut = padt
    out.append(f'<rect x="{padl}" y="{nut}" width="{gap * (n - 1)}" height="{fg * 4}" class="board"/>')
    if base == 1: out.append(f'<rect x="{padl - 1}" y="{nut - 3}" width="{gap * (n - 1) + 2}" height="4" class="nut"/>')
    else: out.append(f'<text x="{padl - 6}" y="{nut + fg * 0.5 + 4}" class="bf">{base}</text>')
    for k in range(1, 4): out.append(f'<line x1="{padl}" x2="{padl + gap * (n - 1)}" y1="{nut + k * fg}" y2="{nut + k * fg}" class="fw"/>')
    for i in range(n): out.append(f'<line x1="{padl + i * gap}" x2="{padl + i * gap}" y1="{nut}" y2="{nut + 4 * fg}" class="st"/>')
    for i, f in enumerate(fr):
        x = padl + i * gap
        if f < 0: out.append(f'<text x="{x}" y="{nut - 6}" class="mx">×</text>')
        elif f == 0: out.append(f'<circle cx="{x}" cy="{nut - 9}" r="3.6" class="op"/>')
        else: out.append(f'<circle cx="{x}" cy="{nut + (f - base + 0.5) * fg}" r="5.6" class="dot"/>')
    out.append('</svg>')
    return ''.join(out)

if __name__ == '__main__':
    for s in ['D', 'A7', 'D7', 'G', 'G#dim', 'Bb', 'Em7', 'C/E', 'F#m7b5', 'E7', 'Bdim', 'C6', 'G9']:
        c = parse(s)
        print(f'{s:7}', {k: shape(k, c)['frets'] for k in INST})
