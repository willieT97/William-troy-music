#!/usr/bin/env python3
"""
One page per session tune, for people searching "<tune> notes / tab / sheet
music" — e.g. /tunes/the-kesh.html:

  * the sheet music (drawn in the browser by abcjs, from the library's ABC)
  * the notes as letter names, in the trad way (capitals up to C, then d e f…)
  * tabs worked out here: tenor banjo, mandolin, fiddle fingering, guitar
  * what the tune is, its key (and the major key with the same notes),
    related tunes, a credit to thesession.org, and a button straight into
    the Melody Trainer to play along

    python3 tune-pages.py && python3 seo.py

TO ADD TUNES: put names in BUILD (as they appear in the library), or pass
--all to build every Irish session tune.
"""
import os, re, sys, json, glob, html
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'tunes')
BUILD = ['The Kesh']

ABCJS = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js'
LETTERS = 'CDEFGAB'
NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
MODES = {'major': 0, 'dorian': 2, 'phrygian': 4, 'lydian': 5, 'mixolydian': 7, 'minor': 9, 'locrian': 11}
MAJOR_FIFTHS = {0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1}
MAJOR_NAME = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
TYPE_WORD = {'reel': 'reel', 'jig': 'jig', 'slip jig': 'slip jig', 'hornpipe': 'hornpipe', 'polka': 'polka',
             'slide': 'slide', 'waltz': 'waltz', 'barndance': 'barndance', 'march': 'march', 'slow air': 'slow air'}

# instrument -> (heading, open strings low->high as WRITTEN pitch, fret limit for "open position")
# tenor banjo and guitar sound an octave below the written note, so their strings are written an octave up
INSTR = {
    'banjo':    ('Tenor banjo tab', 'G D A E (Irish tuning) · open position', [55, 62, 69, 76], 6),
    'mandolin': ('Mandolin tab', 'G D A E · open position', [55, 62, 69, 76], 6),
    'fiddle':   ('Fiddle fingering', 'G D A E · first position — finger numbers', [55, 62, 69, 76], 7),
    'guitar':   ('Guitar tab', 'E A D G B E · open position', [52, 57, 62, 67, 71, 76], 4),
    'uke':      ('Ukulele tab', 'G C E A (high G) · open position', [67, 60, 64, 69], 5),
}
STRING_NAMES = {'banjo': 'GDAE', 'mandolin': 'GDAE', 'fiddle': 'GDAE', 'guitar': ['E', 'A', 'D', 'G', 'B', 'e'], 'uke': 'GCEA'}
FIDDLE_FINGER = {0: '0', 1: 'L1', 2: '1', 3: 'L2', 4: '2', 5: '3', 6: 'H3', 7: '4'}

def esc(s): return html.escape(str(s), quote=True)
def slug(s):
    import unicodedata                         # Sí Bheag Sí Mhór -> si-bheag-si-mhor
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')

# ---------------------------------------------------------------- the library
def library():
    tunes = []
    for f in sorted(glob.glob(os.path.join(OUT, '*.abc'))):
        for blk in re.split(r'(?m)^(?=X:)', open(f, encoding='utf-8').read()):
            if not blk.startswith('X:'): continue
            fld = lambda t: (re.search(r'(?m)^' + t + r':\s*(.*)$', blk) or [None, ''])[1].strip()
            tunes.append({'name': fld('T'), 'type': fld('R').lower(), 'origin': fld('O') or 'Irish session',
                          'key': fld('K'), 'id': fld('X'), 'meter': fld('M'), 'abc': blk.strip()})
    return tunes

def parse_key(k):
    m = re.match(r'^\s*([A-Ga-g])\s*([#b]?)\s*([A-Za-z]*)', k or 'C')
    if not m: return None
    w = m.group(3).lower()
    mode = ('major' if not w or w.startswith(('maj', 'ion')) else 'minor' if w == 'm' or w.startswith(('min', 'aeo'))
            else next((x for x in MODES if w.startswith(x[:3])), 'major'))
    acc = 1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0
    tonic = m.group(1).upper()
    pc = (NAT[tonic] + acc) % 12
    parent = (pc - MODES[mode]) % 12
    fifths = MAJOR_FIFTHS[parent]
    alters = {l: 0 for l in LETTERS}
    for i in range(abs(fifths)): alters[('FCGDAEB' if fifths > 0 else 'BEADGCF')[i]] = 1 if fifths > 0 else -1
    tname = tonic + ('♯' if acc > 0 else '♭' if acc < 0 else '')
    return {'tonic': tname, 'mode': mode, 'parent': parent, 'alters': alters,
            'label': tname + ' ' + mode, 'parent_name': MAJOR_NAME[parent] + ' major'}

# ---------------------------------------------------------------- the notes
def notes_by_bar(abc, key):
    """Pitch (written) of every note, bar by bar. Rhythm isn't needed here:
    the stave shows it, the tabs and letter names follow the order."""
    body = abc.split('\n')
    i = next(n for n, ln in enumerate(body) if ln.startswith('K:')) + 1
    s = '\n'.join(ln for ln in body[i:] if not re.match(r'^[A-Za-z]:', ln))
    s = re.sub(r'%.*', '', s)
    s = re.sub(r'"[^"]*"', '', s)             # chord symbols
    s = re.sub(r'\{[^}]*\}', '', s)           # grace notes
    s = re.sub(r'![^!]*!|\+[^+]*\+', '', s)   # decorations
    s = re.sub(r'\[[A-Za-z]:[^\]]*\]', '', s)  # inline fields
    bars, cur, acc_bar, k = [], [], {}, 0
    tok = re.compile(r"\[(?=[_=^]*[A-Ga-g])|\]|(\|+|:\|+|\|+:|::|\[\d|\|\d|:\]|\|\])|(\^{1,2}|_{1,2}|=)?([A-Ga-g])([,']*)|z|x")
    in_chord, chord_taken = False, False
    for m in tok.finditer(s):
        t = m.group(0)
        if t == '[': in_chord, chord_taken = True, False; continue
        if t == ']' and in_chord: in_chord = False; continue
        if m.group(1):
            if re.search(r'\|', t) and cur: bars.append(cur); cur = []
            acc_bar = {}
            continue
        if not m.group(3): continue
        if in_chord and chord_taken: continue
        chord_taken = in_chord
        L = m.group(3); octv = 4 if L.isupper() else 5
        octv += m.group(4).count("'") - m.group(4).count(',')
        L = L.upper()
        a = m.group(2)
        if a: acc_bar[(L, octv)] = {'^': 1, '^^': 2, '_': -1, '__': -2, '=': 0}[a]
        alt = acc_bar.get((L, octv), key['alters'][L])
        midi = (octv + 1) * 12 + NAT[L] + alt
        cur.append({'L': L, 'oct': octv, 'alt': alt, 'midi': midi})
    if cur: bars.append(cur)
    return bars

def trad_name(n):
    a = {1: '♯', -1: '♭', 2: '𝄪', -2: '𝄫'}.get(n['alt'], '')
    if n['oct'] >= 6: return n['L'].lower() + a + "'" * (n['oct'] - 5)
    if n['oct'] == 5 and n['L'] != 'C': return n['L'].lower() + a
    if n['oct'] <= 3: return n['L'] + a + ',' * (4 - n['oct'])
    return n['L'] + a

def place(strings, midi, maxf):
    cand = [(midi - o, si) for si, o in enumerate(strings) if midi - o >= 0]
    if not cand: return None
    near = [c for c in cand if c[0] <= maxf]
    return min(near or cand)                  # lowest fret: open strings first, then up the top string

def tab_lines(inst, bars, per_line=4):
    _, _, strings, maxf = INSTR[inst]
    names = list(STRING_NAMES[inst])
    out = []
    for li in range(0, len(bars), per_line):
        rows = [names[si] + '|' for si in range(len(strings))]
        for bar in bars[li:li + per_line]:
            for n in bar:
                p = place(strings, n['midi'], maxf)
                cell = '?' if p is None else (FIDDLE_FINGER.get(p[0], str(p[0])) if inst == 'fiddle' else str(p[0]))
                w = len(cell) + 1
                for si in range(len(strings)):
                    rows[si] += ('-' + cell if p and p[1] == si else '-' * w)
            for si in range(len(strings)): rows[si] += '-|'
        out.append('\n'.join(reversed(rows)))   # highest string on top, as tab is read
    return out

# ---------------------------------------------------------------- what's worth knowing
NOTES_FILE = os.path.join(OUT, 'notes.txt')
def teacher_notes():
    """tunes/notes.txt — William's own notes, one tune per line:  Tune name | note"""
    out = {}
    if os.path.exists(NOTES_FILE):
        for ln in open(NOTES_FILE, encoding='utf-8'):
            if '|' in ln and not ln.lstrip().startswith('#'):
                n, txt = ln.split('|', 1)
                if txt.strip(): out[n.strip().lower()] = txt.strip()
    return out

DANCE = {'reel', 'jig', 'slip jig', 'hornpipe', 'polka', 'slide', 'barndance', 'march'}
NUM = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six'}
def tune_facts(t, key, bars):
    """Worked out from the notes: parts, range, first position, notes used,
    accidentals and a rough difficulty — different on every page, and what a
    learner wants to know before starting a tune."""
    notes = [n for b in bars for n in b]
    lo = min(notes, key=lambda n: n['midi']); hi = max(notes, key=lambda n: n['midi'])
    span = hi['midi'] - lo['midi']
    nb = len(bars)
    has_rep = bool(re.search(r'\|:|:\|', t['abc']))
    parts = max(1, round(nb / 8)) if t['type'] in DANCE else None
    first_pos = all(55 <= n['midi'] <= 83 for n in notes)          # G string open .. 4th finger on E
    # accidentals: notes outside the key signature
    off = [n for n in notes if n['alt'] != key['alters'][n['L']]]
    used = []
    for n in sorted(notes, key=lambda n: (NAT[n['L']] + n['alt']) % 12):
        nm = n['L'] + {1: '♯', -1: '♭', 2: '𝄪', -2: '𝄫'}.get(n['alt'], '')
        if nm not in used: used.append(nm)
    per_bar = len(notes) / max(1, nb)
    score = (span > 14) + (span > 19) + (len(off) > 2) + (len(off) > 8) + (t['type'] in ('reel', 'hornpipe')) + \
            (per_bar > 7.5) + (not first_pos)
    level = 'beginner-friendly' if score <= 1 else 'intermediate' if score <= 3 else 'one for the more experienced'
    return {'lo': trad_name(lo), 'hi': trad_name(hi), 'span': span, 'parts': parts, 'has_rep': has_rep, 'bars': nb,
            'first_pos': first_pos, 'off': len(off), 'used': used, 'level': level}

def intro(name, ttype, key, f):
    bits = []
    if f['parts']: bits.append(f'{NUM.get(f["parts"], f["parts"])}-part {ttype}')
    else: bits.append(ttype)
    s = f'{name} is a {bits[0]} in {key["label"]}'
    if key['mode'] != 'major': s += f' (it uses the notes of {key["parent_name"]})'
    s += f' — {f["level"]}'
    s += (f', running from {f["lo"]} to {f["hi"]}' + (' and staying in first position on banjo, mandolin and fiddle.' if f['first_pos'] else '.'))
    return s

# ---------------------------------------------------------------- the page
CSS = """
  :root{ --paper:#F4EEE2; --ink:#17140E; --blue:#2438C8; --pink:#FF4E86; --amber:#E0922A; --green:#1F9D55; --inset:#FBF7EC;
    --disp:'Syne',sans-serif; --body:'Hanken Grotesk',system-ui,sans-serif; --mono:'Space Mono',monospace; }
  *{ box-sizing:border-box; } html,body{ margin:0; padding:0; }
  body{ background:var(--paper); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .wrap{ max-width:900px; margin:0 auto; padding:28px 16px 70px; }
  .tabs{ display:flex; gap:8px; justify-content:center; margin-bottom:22px; flex-wrap:wrap; }
  .tabs a{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; text-decoration:none; color:var(--ink);
    padding:8px 15px; border:2px solid var(--ink); background:var(--paper); box-shadow:3px 3px 0 rgba(23,20,14,.9); }
  .tabs a.cur{ background:var(--ink); color:var(--paper); box-shadow:3px 3px 0 var(--green); }
  .crumbs{ font-family:var(--mono); font-size:12px; margin-bottom:10px; } .crumbs a{ color:var(--blue); text-decoration:none; }
  /* "Sheet Music & Tab Directory" on one line, scaled to fit; phones get two lines at a readable size */
  h1{ font-family:var(--disp); font-weight:800; font-size:min(36px, calc((100vw - 40px) / 24)); white-space:nowrap; line-height:1.02; margin:0;
    text-shadow:2.5px 2px 0 rgba(36,56,200,.55), -2.5px -1.5px 0 rgba(255,78,134,.5); }
  .facts{ font-family:var(--mono); font-size:13px; margin:10px 0 0; }
  .lede{ max-width:64ch; margin:12px 0 18px; }
  /* the heading reads "Sheet Music & Tab"; the tune's name is in it for search engines and screen readers,
     and on screen in the sheet music box below */
  .sr{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  /* the way into the Melody Trainer, right at the top */
  .mtbanner{ display:grid; grid-template-columns:1fr auto; gap:4px 18px; align-items:center; text-decoration:none; color:#fff;
    background:var(--blue); border:2.5px solid var(--ink); border-radius:16px; box-shadow:6px 6px 0 var(--ink); padding:16px 20px; margin:16px 0 12px; }
  .mtbanner:hover{ transform:translate(-1px,-1px); box-shadow:7px 7px 0 var(--ink); }
  .mtb-k{ font-family:var(--disp); font-weight:800; font-size:clamp(19px,3vw,24px); grid-column:1; }
  .mtb-t{ grid-column:1; font-size:15px; opacity:.95; }
  .mtb-go{ grid-column:2; grid-row:1 / span 2; font-family:var(--mono); font-weight:700; font-size:14px; background:var(--paper); color:var(--ink);
    border:2px solid var(--ink); border-radius:10px; padding:10px 14px; white-space:nowrap; box-shadow:3px 3px 0 var(--ink); }
  @media (max-width:600px){ h1{ font-size:27px; white-space:normal; } }
  @media (max-width:640px){ .mtbanner{ grid-template-columns:1fr; } .mtb-go{ grid-column:1; grid-row:auto; justify-self:start; margin-top:8px; } }
  .play{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:0 0 24px; }
  .play a{ font-family:var(--mono); font-weight:700; font-size:13px; text-decoration:none; border:2px solid var(--ink); border-radius:10px;
    padding:9px 14px; box-shadow:3px 3px 0 var(--ink); color:var(--ink); background:var(--paper); }
  .play a.main{ background:var(--blue); color:#fff; font-size:14px; padding:11px 18px; }
  .card{ background:var(--paper); border:2px solid var(--ink); border-radius:14px; box-shadow:5px 5px 0 rgba(23,20,14,.9); padding:18px; margin:0 0 22px; }
  .card h2{ font-family:var(--disp); font-weight:700; font-size:15px; text-transform:uppercase; letter-spacing:.1em; margin:0 0 4px; }
  .card .sub{ font-family:var(--mono); font-size:12px; opacity:.75; margin:0 0 12px; }
  #stave svg{ max-width:100%; }
  .letters{ font-family:var(--mono); font-size:15px; line-height:2; margin:0; white-space:pre-wrap; }
  pre.tab{ font-family:var(--mono); font-size:13px; line-height:1.35; margin:0 0 12px; overflow-x:auto; background:var(--inset);
    border:1.5px solid rgba(23,20,14,.25); border-radius:8px; padding:10px 12px; }
  .note{ font-size:14px; opacity:.85; margin:6px 0 0; }
  .about .aboutline{ margin:0 0 10px; font-size:16.5px; }
  .about .mynote{ margin:0 0 12px; padding:10px 12px; border-left:4px solid var(--pink); background:#fff5f8; border-radius:6px; }
  .facts{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px 18px; margin:0; }
  .facts dt{ font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; opacity:.7; }
  .facts dd{ margin:2px 0 0; font-weight:600; }
  .lettersh{ font-family:var(--disp); font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.1em; margin:18px 0 2px; }
  details.inst{ border-top:1.5px solid rgba(23,20,14,.2); padding:6px 0; }
  details.inst summary{ cursor:pointer; list-style:none; display:flex; align-items:center; gap:8px; padding:6px 0; }
  details.inst summary::-webkit-details-marker{ display:none; }
  details.inst summary::before{ content:'▸'; font-family:var(--mono); transition:transform .15s; }
  details.inst[open] summary::before{ transform:rotate(90deg); }
  details.inst h3{ font-family:var(--disp); font-weight:700; font-size:14px; text-transform:uppercase; letter-spacing:.08em; margin:0; }
  .rel{ display:flex; flex-wrap:wrap; gap:8px; } .rel a{ font-weight:600; text-decoration:none; color:var(--ink); border:2px solid var(--ink);
    border-radius:10px; padding:6px 11px; background:#fffdf7; } .rel a:hover{ background:#fff; }
  .credit{ font-size:13px; opacity:.8; } .credit a{ color:var(--blue); }
  .foot{ margin-top:30px; text-align:center; font-family:var(--mono); font-size:12px; } .foot a{ color:var(--blue); text-decoration:none; }
"""

def build_page(t, lib, built, notes_by_name=None):
    key = parse_key(t['key'])
    bars = notes_by_bar(t['abc'], key)
    ttype = TYPE_WORD.get(t['type'], t['type'] or 'tune')
    name = t['name']
    f = tune_facts(t, key, bars)
    mynote = (notes_by_name or {}).get(name.lower())
    mt = 'melody-trainer_1.html?tune=' + quote(name)
    keytxt = key['label'] + ('' if key['mode'] == 'major' else ' (the notes of ' + key['parent_name'] + ')')
    title = f'{name} — Sheet Music & Tab (banjo, mandolin, fiddle, guitar)'
    desc = (f'{name}, a {f["level"].replace("one for the more experienced", "more advanced")} Irish {ttype} in {key["label"]}: '
            f'sheet music, the notes as letters, and tab for tenor banjo, mandolin, fiddle, guitar and ukulele. Play along in the Melody Trainer.')
    letters = '\n'.join(' | '.join(' '.join(trad_name(n) for n in bar) for bar in bars[i:i + 4]) for i in range(0, len(bars), 4))
    abc_render = '\n'.join(ln for ln in t['abc'].split('\n') if not re.match(r'^[TXOR]:', ln))
    # related: same type and same parent key first, then same type
    rel = [x for x in lib if x is not t and x['origin'] == t['origin'] and x['name'] != name]
    k0 = key['parent']
    def score(x):
        kx = parse_key(x['key']); return (x['type'] == t['type']) * 2 + (kx and kx['parent'] == k0)
    rel = sorted(rel, key=lambda x: -score(x))[:8]
    def link(x):
        return (f'tunes/{slug(x["name"])}.html' if x['name'] in built else 'melody-trainer_1.html?tune=' + quote(x['name']))
    sections = ''
    for inst, (h, sub, _, _) in INSTR.items():
        # each instrument folds away; a link like #banjo (the Melody Trainer's "See tab") opens that one
        tabs = tab_lines(inst, bars)
        extra = ('<p class="note">0 = open string · 1–4 = finger · L = low (half step back), H = high.</p>' if inst == 'fiddle' else
                 '<p class="note">Numbers are frets. Tenor banjo sounds an octave below the written notes.</p>' if inst == 'banjo' else
                 '<p class="note">Numbers are frets; the bottom line is the low E string.</p>' if inst == 'guitar' else
                 '<p class="note">Numbers are frets; the top line is the A string, the bottom line the high G.</p>' if inst == 'uke' else
                 '<p class="note">Numbers are frets. Same strings as the fiddle, so the same notes fall in the same places.</p>')
        sections += (f'<details class="inst" id="{inst}"><summary><h3>{esc(name)} — {esc(h.lower() if inst == "fiddle" else h)}</h3></summary>'
                     f'<p class="sub">{esc(sub)}</p>' + ''.join(f'<pre class="tab">{esc(x)}</pre>' for x in tabs) + extra + '</details>\n')
    jsonld = {"@context": "https://schema.org", "@type": "MusicComposition", "name": name, "genre": "Irish traditional music",
              "musicalKey": key['label'], "inLanguage": "en", "description": desc,
              "composer": {"@type": "Organization", "name": "Traditional"}}
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<script src="/analytics.js" defer></script>
<script src="/auth.js" defer></script>
<meta charset="UTF-8">
<base href="/">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="/favicon.png?v=2">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}" />
<script type="application/ld+json">
{json.dumps(jsonld, ensure_ascii=False, indent=1)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <nav class="tabs" aria-label="Sections">
    <a href="index.html">Arcade</a><a href="dojo.html">Courses</a><a href="resources.html">Resources</a>
    <a href="training.html" class="cur" aria-current="page">Practice</a><a href="create.html">Create</a>
  </nav>
  <div class="crumbs"><a href="melody-trainer_1.html">Melody Trainer</a> › <a href="tunes/">Session tunes</a> › {esc(name)}</div>
  <h1><span class="sr">{esc(name)} — </span>Sheet Music &amp; Tab Directory</h1>

  <a class="mtbanner" href="{mt}">
    <span class="mtb-k">▶ Learn it in the Melody Trainer</span>
    <span class="mtb-t">See every note of {esc(name)} on your banjo, fiddle, mandolin, guitar, ukulele or piano — then play along: the music listens and waits for you.</span>
    <span class="mtb-go">Open {esc(name)} →</span>
  </a>

  <section class="card about"><h2>About {esc(name)}</h2>
    <p class="aboutline">{esc(intro(name, ttype, key, f))}</p>
    {('<p class="mynote"><b>From William:</b> ' + esc(mynote) + '</p>') if mynote else ''}
    <dl class="facts">
      <div><dt>Type</dt><dd>{esc(ttype.capitalize())}{(', ' + NUM.get(f['parts'], str(f['parts'])) + ' parts') if f['parts'] else ''}{', each usually played twice' if f['has_rep'] else ''}</dd></div>
      <div><dt>Key</dt><dd>{esc(keytxt)} · {esc(t['meter'])}</dd></div>
      <div><dt>Range</dt><dd>{esc(f['lo'])} to {esc(f['hi'])}{' · first position' if f['first_pos'] else ''}</dd></div>
      <div><dt>Notes used</dt><dd>{esc(' '.join(f['used']))}</dd></div>
      <div><dt>Level</dt><dd>{esc(f['level'].capitalize())}</dd></div>
    </dl>
  </section>

  <section class="card"><h2>{esc(name)} — sheet music</h2><p class="sub">{esc(keytxt)} · {esc(t["meter"])}</p>
    <div id="stave" aria-label="Sheet music for {esc(name)}"></div>
    <noscript><p class="note">Turn on JavaScript to see the sheet music.</p></noscript>
    <h3 class="lettersh">The notes</h3>
    <p class="sub">Letter names, bar by bar · capitals up to C in the third space, lower case from the D on the 4th line</p>
    <p class="letters">{esc(letters)}</p>
  </section>

  <div class="play"><a class="main" href="{mt}">▶ Play along in the Melody Trainer</a></div>

  <section class="card tabs-card" id="tab"><h2>{esc(name)} — tab</h2>
    <p class="sub">Tenor banjo · mandolin · fiddle · guitar · ukulele — tap one to open it</p>
{sections}  </section>
  <section class="card"><h2>More {esc(ttype)}s and tunes like it</h2>
    <div class="rel">{"".join(f'<a href="{link(x)}">{esc(x["name"])}</a>' for x in rel)}</div>
  </section>

  <p class="credit">This setting of {esc(name)} is a community transcription from
  <a href="https://thesession.org/tunes/{esc(t["id"])}" rel="nofollow noopener" target="_blank">thesession.org</a>.
  The tune itself is traditional. Tabs and letter names worked out by The Music Arcade.</p>
  <div class="foot"><a href="melody-trainer_1.html">&larr; Melody Trainer</a></div>
</div>
<script type="text/plain" id="abcSrc">{esc(abc_render)}</script>
<script src="{ABCJS}"></script>
<script>
  /* draw the sheet music from the tune's ABC (abcjs, MIT licence) */
  (function(){{
    var src = document.getElementById('abcSrc').textContent;
    var t = document.createElement('textarea'); t.innerHTML = src; src = t.value;   // undo the HTML escaping
    if(window.ABCJS) ABCJS.renderAbc('stave', src, {{ responsive:'resize', paddingtop:0, paddingbottom:0, staffwidth:820 }});
  }})();
  /* #banjo, #fiddle… (the Melody Trainer's "See tab") opens that instrument's tab and scrolls to it */
  (function(){{
    function openHash(){{
      var d = location.hash && document.getElementById(location.hash.slice(1));
      if(d && d.tagName === 'DETAILS'){{ d.open = true; setTimeout(function(){{ d.scrollIntoView({{ block:'start' }}); }}, 50); }}
    }}
    openHash(); window.addEventListener('hashchange', openHash);
  }})();
</script>
<script src="/tools.js"></script>
<script src="/related.js"></script>
</body>
</html>
'''

TYPE_ORDER = ['reel', 'jig', 'slip jig', 'hornpipe', 'polka', 'slide', 'barndance', 'march', 'slow air', 'waltz']
PLURAL = {'slip jig': 'Slip jigs', 'slow air': 'Slow airs', 'march': 'Marches'}
def build_index(lib, names):
    """tunes/index.html — the Sheet Music & Tab Directory: every tune page, by type."""
    rows = {}
    for nm in names:
        t = next((x for x in lib if x['name'] == nm), None)
        if not t: continue
        key = parse_key(t['key']); f = tune_facts(t, key, notes_by_bar(t['abc'], key))
        rows.setdefault(t['type'], []).append((t, key, f))
    order = sorted(rows, key=lambda ty: (TYPE_ORDER.index(ty) if ty in TYPE_ORDER else 99, ty))
    lvl = {'beginner-friendly': ('beg', 'Beginner'), 'intermediate': ('int', 'Intermediate'), 'one for the more experienced': ('adv', 'Advanced')}
    body = ''
    for ty in order:
        items = sorted(rows[ty], key=lambda r: re.sub(r'^the\s+', '', r[0]['name'].lower()))
        body += f'<section class="grp" data-type="{esc(ty)}"><h2>{esc(PLURAL.get(ty, ty.capitalize() + "s"))} <span>{len(items)}</span></h2><ul>'
        for t, key, f in items:
            c, l = lvl[f['level']]
            body += (f'<li data-k="{esc((t["name"] + " " + key["label"] + " " + key["parent_name"] + " " + l).lower())}">'
                     f'<a href="tunes/{slug(t["name"])}.html">{esc(t["name"])}</a>'
                     f'<span class="k">{esc(key["label"])}</span><span class="lv {c}">{l}</span></li>')
        body += '</ul></section>\n'
    n = sum(len(v) for v in rows.values())
    title = 'Sheet Music & Tab Directory — Irish session tunes | Music Arcade'
    desc = (f'Sheet music, note names and tab for {n} Irish session tunes — reels, jigs, hornpipes, polkas and more — '
            'for tenor banjo, mandolin, fiddle, guitar and ukulele. Free, with a play-along.')
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<script src="/analytics.js" defer></script>
<script src="/auth.js" defer></script>
<meta charset="UTF-8">
<base href="/">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="/favicon.png?v=2">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{CSS}
  .search{{ width:100%; font-family:var(--body); font-size:16px; padding:11px 14px; border:2px solid var(--ink); border-radius:10px; background:#fffdf7; margin:0 0 20px; }}
  .grp h2{{ font-family:var(--disp); font-weight:700; font-size:15px; text-transform:uppercase; letter-spacing:.1em; margin:22px 0 8px; }}
  .grp h2 span{{ font-family:var(--mono); font-weight:400; opacity:.6; }}
  .grp ul{{ list-style:none; padding:0; margin:0; columns:2 300px; column-gap:24px; }}
  .grp li{{ display:flex; align-items:baseline; gap:8px; padding:5px 0; border-bottom:1px solid rgba(23,20,14,.12); break-inside:avoid; }}
  .grp li a{{ flex:1; font-weight:600; color:var(--ink); text-decoration:none; }} .grp li a:hover{{ color:var(--blue); text-decoration:underline; }}
  .grp .k{{ font-family:var(--mono); font-size:11.5px; opacity:.7; white-space:nowrap; }}
  .lv{{ font-family:var(--mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; border:1.5px solid var(--ink); border-radius:99px; padding:0 6px; white-space:nowrap; }}
  .lv.beg{{ background:#d8efdd; }} .lv.int{{ background:#fff2c2; }} .lv.adv{{ background:#fde0e6; }}
  .grp.empty{{ display:none; }} li.hide{{ display:none; }}
</style>
</head>
<body>
<div class="wrap">
  <nav class="tabs" aria-label="Sections">
    <a href="index.html">Arcade</a><a href="dojo.html">Courses</a><a href="resources.html">Resources</a>
    <a href="training.html" class="cur" aria-current="page">Practice</a><a href="create.html">Create</a>
  </nav>
  <div class="crumbs"><a href="melody-trainer_1.html">Melody Trainer</a> › Session tunes</div>
  <h1>Sheet Music &amp; Tab Directory</h1>
  <a class="mtbanner" href="melody-trainer_1.html">
    <span class="mtb-k">▶ Learn them in the Melody Trainer</span>
    <span class="mtb-t">Pick any tune and see every note on your banjo, fiddle, mandolin, guitar, ukulele or piano — then play along: the music listens and waits for you.</span>
    <span class="mtb-go">Open the Melody Trainer →</span>
  </a>
  <p class="lede">{n} of the most-played Irish session tunes, each with its sheet music, the notes as letter names, and tab for tenor banjo,
  mandolin, fiddle, guitar and ukulele. Search by name, key (try “D major” or “A dorian”) or level.</p>
  <input class="search" id="q" type="search" placeholder="Search tunes — name, key or level…" aria-label="Search tunes">
{body}
  <p class="credit">Settings from <a href="https://thesession.org" rel="nofollow noopener" target="_blank">thesession.org</a>; the tunes are traditional.</p>
  <div class="foot"><a href="melody-trainer_1.html">&larr; Melody Trainer</a></div>
</div>
<script>
  /* filter the list as you type */
  document.getElementById('q').addEventListener('input', function(){{
    var q = this.value.trim().toLowerCase();
    document.querySelectorAll('.grp').forEach(function(g){{
      var shown = 0;
      g.querySelectorAll('li').forEach(function(li){{ var ok = !q || li.dataset.k.indexOf(q) >= 0; li.classList.toggle('hide', !ok); if(ok) shown++; }});
      g.classList.toggle('empty', !shown);
    }});
  }});
</script>
<script src="/tools.js"></script>
<script src="/related.js"></script>
</body>
</html>
'''

def main():
    lib = library()
    names = [t['name'] for t in lib if t['origin'] == 'Irish session'] if '--all' in sys.argv else BUILD
    built = set(names)
    # the list the Melody Trainer reads to know which tunes have a page ("See tab")
    existing = {}
    jp = os.path.join(OUT, 'pages.json')
    if os.path.exists(jp) and '--all' not in sys.argv:
        try: existing = json.load(open(jp, encoding='utf-8'))
        except Exception: existing = {}
    for nm in names:
        existing[nm] = 'tunes/' + slug(nm) + '.html'
    json.dump(existing, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    tn = teacher_notes()
    for nm in names:
        t = next((x for x in lib if x['name'] == nm), None)
        if not t: print('not in the library:', nm); continue
        path = os.path.join(OUT, slug(nm) + '.html')
        open(path, 'w', encoding='utf-8').write(build_page(t, lib, built, tn))
        print('wrote', os.path.relpath(path, ROOT))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(build_index(lib, sorted(existing)))
    print('wrote tunes/index.html')

if __name__ == '__main__':
    main()
