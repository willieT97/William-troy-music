#!/usr/bin/env python3
"""The "From William" section: learn/index.html and its articles.

    python3 learn-pages.py && python3 seo.py

The words are William's (he approves every article before it goes live), so
they live here as plain text; each tune's key and type are read from the tune
library with tune-pages.py's own parsing, so they always match the tune pages.
Add an article: write a build_<name>() like first_session_tunes() and list it
in ARTICLES.
"""
import importlib.util, json, os
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('tp', os.path.join(ROOT, 'tune-pages.py'))
tp = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(tp)
esc, slug = tp.esc, tp.slug
OUT = os.path.join(ROOT, 'learn')
SITE = 'https://themusicarcade.com/'

CSS = """
  .answer{ font-size:19px; line-height:1.55; max-width:62ch; margin:6px 0 22px; padding:16px 18px; background:#fffdf7;
    border:2px solid var(--ink); border-radius:12px; box-shadow:5px 5px 0 var(--ink); }
  .answer b{ color:var(--blue); }
  .byline{ font-family:var(--mono); font-size:12.5px; opacity:.75; margin:-4px 0 14px; }
  .prose p, .prose li{ max-width:68ch; } .prose a{ color:var(--blue); }
  ol.tunes{ list-style:none; padding:0; margin:0; counter-reset:t; }
  ol.tunes > li{ counter-increment:t; position:relative; padding:16px 18px 14px 64px; margin:0 0 14px; background:#fffdf7;
    border:2px solid var(--ink); border-radius:12px; }
  ol.tunes > li::before{ content:counter(t); position:absolute; left:16px; top:14px; width:34px; height:34px; border-radius:50%;
    background:var(--ink); color:#fffdf7; font-family:var(--disp); font-weight:800; font-size:17px; display:flex;
    align-items:center; justify-content:center; }
  ol.tunes h2{ font-family:var(--disp); font-weight:800; font-size:21px; margin:0 0 2px; }
  ol.tunes h2 a{ color:var(--ink); text-decoration:none; } ol.tunes h2 a:hover{ color:var(--blue); text-decoration:underline; }
  .tk{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.06em; opacity:.75; margin:0 0 6px; }
  ol.tunes p{ margin:0 0 10px; max-width:66ch; }
  .go{ display:flex; flex-wrap:wrap; gap:8px; }
  .go a{ font-size:14.5px; font-weight:600; text-decoration:none; color:var(--ink); border:2px solid var(--ink); border-radius:99px;
    padding:4px 12px; background:#fffdf7; }
  .go a.main{ background:var(--blue); border-color:var(--blue); color:#fff; }
  .go a:hover{ transform:translate(-1px,-1px); box-shadow:3px 3px 0 var(--ink); }
  .arts{ list-style:none; padding:0; margin:0; display:grid; gap:14px; }
  .arts a{ display:block; padding:16px 18px; background:#fffdf7; border:2px solid var(--ink); border-radius:12px;
    text-decoration:none; color:var(--ink); box-shadow:4px 4px 0 var(--ink); }
  .arts a:hover{ transform:translate(-1px,-1px); box-shadow:6px 6px 0 var(--ink); }
  .arts b{ display:block; font-family:var(--disp); font-weight:800; font-size:20px; margin:0 0 4px; }
  .arts span{ font-size:15.5px; }
  .tradh{ font-family:var(--disp); font-weight:800; font-size:24px; margin:30px 0 12px; padding-top:6px; border-top:3px solid var(--ink); }
"""

def nav():
    return ('<nav class="tabs" aria-label="Sections">\n'
            '    <a href="index.html">Arcade</a><a href="dojo.html">Courses</a><a href="resources.html">Resources</a>\n'
            '    <a href="training.html">Practice</a><a href="create.html">Create</a>'
            '<a href="learn/" class="cur" aria-current="page">From William</a>\n  </nav>')

def page(title, desc, ld, crumbs, body, foot='<a href="learn/">&larr; From William</a>'):
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
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{tp.CSS}{CSS}</style>
</head>
<body>
<div class="wrap">
  {nav()}
  <div class="crumbs">{crumbs}</div>
{body}
  <div class="foot">{foot}</div>
</div>
<script src="/tools.js"></script>
<script src="/related.js"></script>
</body>
</html>
'''

AUTHOR = {'@type': 'Person', 'name': 'William Troy'}
PUBLISHER = {'@type': 'Organization', 'name': 'The Music Arcade', 'url': SITE}

# ---------------------------------------------------------------- article 1
FIRST_TEN = [  # (library name, William's line)
    ('The Dawning Of The Day (Fáinne Geal An Lae)',
     'A beautiful slow air in D, and the tune of Raglan Road. Its long notes give you time to make every one ring.'),
    ('Sí Bheag Sí Mhór',
     'A slow waltz in D, with room to make every note ring. Said to be the first tune O’Carolan wrote.'),
    ('Fanny Power',
     'Another O’Carolan tune, in G. It moves at an easy pace, so you can put all your attention into a clean, even tone.'),
    ('The Britches Full Of Stitches',
     'Short and bouncy, and it sits right inside the D major scale. The classic first polka.'),
    ("Egan's (The Kerry Polka)",
     'The easiest tune on the list: two short parts that keep coming back to the same few notes. '
     'Play it straight after the Britches and you have your first set.'),
    ("John Ryan's",
     'The same feel as the first two polkas, a little wider. Add it to the Britches and the Kerry and you have a full set of three polkas.'),
    ('The Boys Of Bluehill',
     'Your first hornpipe, in D. Play the pairs of notes long-short and it starts to bounce.'),
    ('The Stack Of Barley',
     'A barndance in G, with the same swung feel as a hornpipe. Easy-going and fun to play.'),
    ('Off To California',
     'A second hornpipe, in G. Give it the same swing as the Bluehill and the two make a pair.'),
    ('The Kesh',
     'Your jig, and a session staple. Jigs go in threes; once this one flows, the jigs in the tune directory are open to you.'),
]
FIRST_TEN_URL = 'learn/first-session-tunes.html'

def first_session_tunes(lib):
    by = {t['name']: t for t in lib}
    items, li = [], ''
    for i, (name, line) in enumerate(FIRST_TEN, 1):
        t = by[name]
        k = tp.parse_key(t['key'])
        ty = tp.TYPE_WORD.get(t['type'], t['type'])
        mt = 'melody-trainer_1.html?tune=' + quote(name)
        tune = f'tunes/{slug(name)}.html'
        li += (f'<li><h2><a href="{tune}">{esc(name)}</a></h2><p class="tk">{esc(ty)} · {esc(k["label"])}</p>'
               f'<p>{esc(line)}</p><div class="go"><a class="main" href="{esc(mt)}">▶ Play along in the Melody Trainer</a>'
               f'<a href="{tune}">Sheet music &amp; tab</a></div></li>\n')
        items.append({'@type': 'ListItem', 'position': i, 'name': name, 'url': SITE + tune})
    answer = ('These are the ten tunes I give new students when they want to start playing at sessions. They’re all on the notes of D or G major, '
              'they sit in first position on banjo, mandolin or fiddle, and they build up in groups: three slow tunes, three '
              'polkas, three hornpipes and barndances, then your first jig. Learn them in this order and you’ll have a set ready for most sessions.')
    title = '10 First Session Tunes for Beginners — Irish Trad | The Music Arcade'
    desc = ('The ten Irish session tunes I start beginners on: three slow tunes, three polkas, three hornpipes and barndances, '
            'and a jig, each with tab and a play-along.')
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': '10 first session tunes for beginners',
           'description': desc, 'url': SITE + FIRST_TEN_URL, 'datePublished': '2026-10-24', 'dateModified': '2026-10-24',
           'author': AUTHOR, 'publisher': PUBLISHER},
          {'@context': 'https://schema.org', '@type': 'ItemList', 'name': '10 first session tunes', 'itemListElement': items}]
    body = f'''  <h1>10 first session tunes for beginners</h1>
  <p class="byline">From William · tenor banjo and Irish trad teacher</p>
  <p class="answer">{esc(answer)}</p>
  <ol class="tunes">
{li}  </ol>
  <section class="card prose"><h2>How I’d learn them</h2>
    <ul>
      <li><b>One tune at a time.</b> Open it in the <a href="melody-trainer_1.html">Melody Trainer</a>: it shows every note on your
      instrument and waits for you to play it, so you can go as slowly as you need.</li>
      <li><b>Then learn it by ear.</b> Trad is passed on by ear, so once you know a tune, practise hearing a phrase and playing it
      back with <a href="Ear%20Training/play-it-back.html">Play It Back</a>.</li>
      <li><b>Put them into sets.</b> The three polkas go together, and the Bluehill and Off to California make a pair of hornpipes. Playing tunes back to back
      is what a session sounds like.</li>
      <li><b>Speed comes last.</b> Play it clean and steady with the <a href="metronome.html">metronome</a> first, then nudge
      the tempo up.</li>
    </ul>
    <p>New to the banjo altogether? Start with my <a href="learn-banjo.html">Beginner Banjo</a> course: it gets you tuned up and
    playing the D major scale before the first of these tunes.</p>
  </section>
  <section class="card prose"><h2>Why these ten</h2>
    <p>They’re all on the notes of D or G major, and those two key signatures cover
    <a href="tunes/keys.html">nearly every tune you’ll hear at a session</a>. They mix slow tunes, polkas, hornpipes, a barndance
    and a jig, so you’re ready for whatever gets started. And they’re well known, so you’ll hear them, and people will join in.</p>
  </section>'''
    crumbs = '<a href="learn/">From William</a> › 10 first session tunes'
    return page(title, desc, ld, crumbs, body), answer

ARTICLES = [  # (url, title, one line) — newest first on the index
    (FIRST_TEN_URL, '10 first session tunes for beginners',
     'The ten tunes I start new students on, in order, each with a play-along in the Melody Trainer.'),
]
def also(lib):
    n = sum(t['origin'] == 'Irish session' for t in lib)
    return [('learn-banjo.html', 'Beginner Banjo', 'My free seven-step course for adults starting the tenor banjo.'),
            ('tunes/keys.html', 'What key are Irish session tunes in?', f'I counted the keys of {n} popular session tunes. Mostly D and G.')]

def index(lib):
    cards = lambda rows: '\n'.join(f'<li><a href="{u}"><b>{esc(t)}</b><span>{esc(s)}</span></a></li>' for u, t, s in rows)
    title = 'From William — Guides to Irish Trad & Tenor Banjo | The Music Arcade'
    desc = 'Guides to learning Irish traditional music and the tenor banjo, from William Troy, a working tenor banjo and trad teacher.'
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'From William', 'description': desc,
          'url': SITE + 'learn/', 'author': AUTHOR, 'publisher': PUBLISHER}
    body = f'''  <h1>From William</h1>
  <p class="lede">Guides to learning Irish trad and tenor banjo, from a working teacher. Each one links straight into the tools
  and tunes on this site, so you can go from reading to playing.</p>
  <section class="prose"><h2 class="tradh">Guides</h2>
  <ul class="arts">
{cards(ARTICLES)}
  </ul></section>
  <section class="prose"><h2 class="tradh">Also from me</h2>
  <ul class="arts">
{cards(also(lib))}
  </ul></section>'''
    return page(title, desc, ld, 'From William', body, foot='<a href="index.html">&larr; The Music Arcade</a>')

if __name__ == '__main__':
    lib = tp.library()
    os.makedirs(OUT, exist_ok=True)
    art, answer = first_session_tunes(lib)
    open(os.path.join(ROOT, FIRST_TEN_URL), 'w', encoding='utf-8').write(tp.root_links(art))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(tp.root_links(index(lib)))
    print('wrote', FIRST_TEN_URL, 'and learn/index.html | answer words:', len(answer.split()))
