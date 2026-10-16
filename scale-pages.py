#!/usr/bin/env python3
"""
One page per popular scale, for search engines — e.g.
    /scales/tenor-banjo/d-major-scale.html  "D Major Scale on Tenor Banjo"

Each page is find-the-note.html (the Scales page) with its own heading,
title and description, the diagram already set to that scale, and a short
written section underneath (the notes, where they sit on each string) that
gives Google something to read. find-the-note.html is the template, so a
change to the Scales page reaches every scale page on the next run.

    python3 scale-pages.py && python3 seo.py

TO ADD PAGES: add rows to BUILD.  The Scales page itself is untouched apart
from reading window.SCALE_PRESET.
"""
import os, re, html, json

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'scales')

# (instrument key in find-the-note.html, scale key, root pitch class)
BUILD = [
  ('banjo', 'major', 2),
  ('banjo', 'major', 9),
  ('banjo', 'major', 7),
  ('banjo', 'minor', 4),
  ('banjo', 'minor', 9),
]

INST = {
  #          slug           name            strings low -> high (midi)          tuning text              view
  'banjo':   ('tenor-banjo', 'Tenor Banjo', [43, 50, 57, 64], 'G D A E, Irish tuning', {'octs': 2, 'shape': 1}),
  'guitar':  ('guitar',      'Guitar',      [40, 45, 50, 55, 59, 64], 'E A D G B E', {'octs': 2}),
  'ukulele': ('ukulele',     'Ukulele',     [67, 60, 64, 69], 'G C E A', {'octs': 1}),
  'bass':    ('bass',        'Bass',        [28, 33, 38, 43], 'E A D G', {'octs': 2}),
  'piano':   ('piano',       'Piano',       None, None, {'octs': 1}),
}

# (semitones above the root, letter steps above the root) — so every note gets the right letter
SCALES = {
  'major':         ('Major',            [(0,0),(2,1),(4,2),(5,3),(7,4),(9,5),(11,6)], 'maj'),
  'minor':         ('Minor',    [(0,0),(2,1),(3,2),(5,3),(7,4),(8,5),(10,6)], 'min'),
  'majpent':       ('Major Pentatonic', [(0,0),(2,1),(4,2),(7,4),(9,5)], 'maj'),
  'minpent':       ('Minor Pentatonic', [(0,0),(3,2),(5,3),(7,4),(10,6)], 'min'),
  'blues':         ('Blues',            [(0,0),(3,2),(5,3),(6,4),(7,4),(10,6)], 'min'),
  'majblues':      ('Major Blues',      [(0,0),(2,1),(3,2),(4,2),(7,4),(9,5)], 'maj'),
  'dorian':        ('Dorian',           [(0,0),(2,1),(3,2),(5,3),(7,4),(9,5),(10,6)], 'min'),
  'mixolydian':    ('Mixolydian',       [(0,0),(2,1),(4,2),(5,3),(7,4),(9,5),(10,6)], 'maj'),
  'harmonicminor': ('Harmonic Minor',   [(0,0),(2,1),(3,2),(5,3),(7,4),(8,5),(11,6)], 'min'),
}
ROOT_NAME = {
  'maj': ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'],
  'min': ['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'],
}
LETTERS = 'CDEFGAB'; NATURAL = [0, 2, 4, 5, 7, 9, 11]
ACC = {0: '', 1: '♯', 2: '𝄪', -1: '♭', -2: '𝄫'}

# a line of colour for the keys a trad player reaches for first
SESSION = {
  ('banjo', 'major', 2): 'D major is the busiest key in an Irish session — reels, jigs and polkas by the hundred — so it is usually the first scale a tenor banjo player learns.',
  ('banjo', 'major', 7): 'G major sits right beside D in the session — the other key most Irish tunes live in.',
  ('banjo', 'major', 9): 'A major turns up in plenty of reels and in most of the fiddle-led tunes in A.',
  ('banjo', 'minor', 4): 'E minor — and its close cousin E dorian — is home to a great many jigs and reels, and it sits comfortably in open position.',
  ('banjo', 'minor', 9): 'A minor and A dorian are everyday session keys too; plenty of reels and slow airs live there.',
}

def spell(root, scale):
  name, steps, kind = SCALES[scale]
  rn = ROOT_NAME[kind][root]
  L = LETTERS.index(rn[0])
  out = []
  for semi, step in steps:
    letter = (L + step) % 7
    acc = ((root + semi) - NATURAL[letter]) % 12
    if acc > 6: acc -= 12
    out.append(((root + semi) % 12, LETTERS[letter] + ACC[acc]))
  return rn, out

def slug(s):
  return s.replace('♯', '-sharp').replace('♭', '-flat').replace(' ', '-').lower()

def esc(s): return html.escape(s, quote=True)

def key_signature(notes):
  sh = [n for _, n in notes if '♯' in n]; fl = [n for _, n in notes if '♭' in n]
  if not sh and not fl: return 'no sharps or flats'
  acc, word = (sh, 'sharp') if sh else (fl, 'flat')
  return f"{len(acc)} {word}{'s' if len(acc) > 1 else ''} ({', '.join(acc)})"

def page_path(inst, scale, root):
  rn, _ = spell(root, scale)
  return f"scales/{INST[inst][0]}/{slug(rn)}-{slug(SCALES[scale][0])}-scale.html"

HANDOVER = """<script>
/* This page is about one scale on one instrument, and its heading and notes
   say so. Changing the subject — instrument, key, scale, or picking a single
   note — goes to that scale's own page if there is one, otherwise to the full
   Scales page already set up. The view buttons, degrees and Print stay here. */
(function(){
  var PAGES = window.SCALE_PAGES || {}, P = window.SCALE_PRESET;
  function range(){ var b = document.querySelector('#rangeBtns .on'); return b ? b.dataset.range : P.octs; }
  function go(inst, scale, root, note){
    var key = inst + '/' + scale + '/' + root;
    if(note == null && PAGES[key]){ location.href = '/' + PAGES[key]; return; }
    var q = '?inst=' + inst + (note != null ? '&note=' + note
          : '&scale=' + scale + '&root=' + root + (range() === 'all' ? '' : '&octs=' + range()));
    location.href = '/find-the-note.html' + q;
  }
  var rootSel = document.getElementById('scaleRoot'), typeSel = document.getElementById('scaleType');
  document.addEventListener('click', function(e){
    var t = e.target.closest('#insttabs button, #notes button');
    if(!t || t.classList.contains('on')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(t.dataset.inst) go(t.dataset.inst, P.scale, P.root);
    else if(t.dataset.pc != null) go(P.inst, null, null, t.dataset.pc);
    else location.href = '/find-the-note.html?inst=' + P.inst;          // the clear button
  }, true);
  function picked(e){ e.stopImmediatePropagation(); go(P.inst, typeSel.value, +rootSel.value); }
  rootSel.addEventListener('change', picked, true); typeSel.addEventListener('change', picked, true);
})();
</script>
"""

def build(template, inst, scale, root):
  islug, iname, strings, tuning, view = INST[inst]
  sname, _, _ = SCALES[scale]
  rn, notes = spell(root, scale)
  names = {pc: n for pc, n in notes}
  full = f'{rn} {sname} Scale'
  h1 = f'{full} on {iname}'
  title = f'{h1}{" (GDAE)" if inst == "banjo" else ""} — notes & fingering | Music Arcade'
  note_list = ' '.join(n for _, n in notes)
  desc = (f'The {rn} {sname.lower()} scale on {iname.lower()}: {note_list}. '
          f'See every note on the neck, hear it, and print it — free.')

  s = template
  s = re.sub(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', s, count=1, flags=re.S)
  s = re.sub(r'\n?<!-- seo: .*?<!-- /seo -->', '', s, flags=re.S)
  s = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>',
             lambda _: '<meta name="description" content="' + esc(desc) + '" />', s, count=1)
  # pages live two folders down; every relative link on the template means the site root
  s = s.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<base href="/">', 1)

  head = (f'<header class="top">\n'
          f'    <span class="kicker">Scales · {esc(iname)}</span>\n'
          f'    <h1>{esc(h1)}</h1>\n'
          f'    <p class="lede">{esc(note_list)} — every note of the {esc(rn)} {esc(sname.lower())} scale, '
          f'drawn on the {esc(iname.lower())}{" (tuned " + esc(tuning) + ")" if tuning else ""}. '
          f'Tap any note to hear it.</p>\n'
          f'  </header>')
  s = re.sub(r'<header class="top">.*?</header>', lambda _: head, s, count=1, flags=re.S)

  preset = {'inst': inst, 'scale': scale, 'root': root, **view}
  s = s.replace('<script>\n(function(){\n  var NAMES=',
                '<script>window.SCALE_PRESET=' + str(preset).replace("'", '"') + ';</script>\n<script>\n(function(){\n  var NAMES=', 1)

  # ---- the written part ----
  paras = [f'<p>The <b>{esc(rn)} {esc(sname.lower())}</b> scale has {len(notes)} notes: '
           f'<b>{esc(note_list)}</b>, then {esc(rn)} again an octave up.'
           + (' This is the natural minor, the same notes as its relative major.' if scale == 'minor' else '')
           + (f' Its key signature has {esc(key_signature(notes))}.' if scale in ('major', 'minor') else '') + '</p>']
  if (inst, scale, root) in SESSION: paras.append('<p>' + esc(SESSION[(inst, scale, root)]) + '</p>')
  rows = ''
  if strings:
    for m in strings:
      cells = []
      for f in range(0, 8):
        pc = (m + f) % 12
        if pc in names:
          cells.append(f'<span class="{"rt" if pc == root else ""}">{esc(names[pc])}<i>{"open" if f == 0 else f}</i></span>')
      open_name = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][m % 12]
      rows = f'<tr><th>{esc(names.get(m % 12, open_name))} string</th><td>{"".join(cells)}</td></tr>' + rows
    paras.append(f'<h2>Where the notes are, frets 0–7</h2>'
                 f'<p>The {esc(rn)} {esc(sname.lower())} scale in first position on the {esc(iname.lower())}, '
                 f'highest string at the top. Fret numbers under each note; the root, {esc(rn)}, in red.</p>'
                 f'<table class="frets">{rows}</table>')
  links = [f'<a href="find-the-note.html?scale={scale}&amp;root={root}&amp;inst={inst}">Open it in the full Scales page →</a>',
           f'<a href="chords.html?inst={"banjo" if inst == "banjo" else inst}">Chords for {esc(iname.lower())} →</a>']
  if inst == 'banjo':
    links.insert(0, '<a href="learn-banjo.html">New to the banjo? Start with Beginner Banjo →</a>')
    links.append('<a href="Banjo/what-note-banjo.html">Learn the notes on the neck: What Note? (banjo) →</a>')
    links.append('<a href="melody-trainer_1.html">Play session tunes in this key: Melody Trainer →</a>')
  sibs = [(i, sc, r) for i, sc, r in BUILD if i == inst and (sc, r) != (scale, root)]
  if sibs:
    paras.append(f'<h2>More {esc(iname.lower())} scales</h2><p class="sibs">' + ''.join(
      f'<a href="{page_path(i, sc, r)}">{esc(spell(r, sc)[0])} {esc(SCALES[sc][0].lower())}</a>' for i, sc, r in sibs) + '</p>')
  paras.append('<p class="morelinks">' + ''.join(links) + '</p>')
  about = '<section class="about">\n' + '\n'.join(paras) + '\n</section>'
  s = s.replace('<p class="backlink" id="backlink"></p>', '<p class="backlink" id="backlink"></p>\n\n  ' + about, 1)

  css = """  .about{ background:#fff; border-radius:16px; box-shadow:0 6px 18px rgba(20,30,60,.10); padding:20px 22px; margin-top:22px; }
  .about h2{ font-family:var(--disp); font-weight:700; font-size:1.2rem; margin:18px 0 4px; }
  .about p{ margin:0 0 10px; }
  .frets{ border-collapse:collapse; width:100%; margin-top:6px; }
  .frets th{ text-align:left; font-family:var(--disp); font-weight:600; font-size:.9rem; white-space:nowrap; padding:7px 12px 7px 0; vertical-align:middle; }
  .frets td{ padding:6px 0; display:flex; flex-wrap:wrap; gap:6px; }
  .frets tr+tr{ border-top:1px solid var(--line); }
  .frets span{ display:inline-flex; flex-direction:column; align-items:center; min-width:42px; padding:4px 6px; border-radius:9px;
    background:var(--blue-tint); color:#1f5fbf; font-family:var(--disp); font-weight:600; }
  .frets span.rt{ background:var(--hi-tint); color:var(--hi); }
  .frets span i{ font-style:normal; font-family:var(--mono); font-size:.62rem; color:var(--muted); }
  .sibs{ display:flex; flex-wrap:wrap; gap:8px; }
  .sibs a{ font-family:var(--disp); font-weight:600; font-size:.9rem; text-decoration:none; color:var(--ink); background:#fff;
    border:2px solid var(--line); border-radius:10px; padding:6px 12px; }
  .sibs a:hover{ border-color:var(--ink); }
  .morelinks{ display:flex; flex-direction:column; gap:6px; margin-top:16px !important; }
  .morelinks a{ font-family:var(--mono); font-weight:700; font-size:.78rem; color:#2E77E6; text-decoration:none; }
  .morelinks a:hover{ text-decoration:underline; }
  @media print{ .about{ display:none; } }
"""
  s = s.replace('  /* print / PDF */', css + '  /* print / PDF */', 1)
  s = s.replace('<!-- more like this', HANDOVER + '<!-- more like this', 1)
  return s

def main():
  template = open(os.path.join(ROOT, 'find-the-note.html'), encoding='utf-8').read()
  pages = {f'{i}/{sc}/{r}': page_path(i, sc, r) for i, sc, r in BUILD}
  os.makedirs(OUT, exist_ok=True)
  open(os.path.join(OUT, 'pages.js'), 'w', encoding='utf-8').write(
    '/* written by scale-pages.py: which scales have a page of their own.\n'
    '   Read by find-the-note.html and every page under /scales/. */\n'
    'window.SCALE_PAGES = ' + json.dumps(pages, indent=1) + ';\n')
  for inst, scale, root in BUILD:
    path = page_path(inst, scale, root)
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(build(template, inst, scale, root))
    print('wrote', path)

if __name__ == '__main__':
  main()
