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

def page(title, desc, ld, crumbs, body, foot='<a href="learn/">&larr; From William</a>', css=''):
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
<style>{tp.CSS}{CSS}{css}</style>
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
# one recording of each, checked to exist and be embeddable (YouTube oEmbed, 2026-10-25): (video id, who's playing)
FIRST_TEN_VIDEOS = {
    'The Dawning Of The Day (Fáinne Geal An Lae)': ('9Bd9Kbn2Fbc', 'Mícheál Ó Súilleabháin, piano (Irish Traditional Music Archive)'),
    'Sí Bheag Sí Mhór': ('jgU_TxYZCoQ', 'on harp, the instrument O’Carolan wrote it for (Sonja Harp)'),
    'Fanny Power': ('nbxa4PF4Ku8', 'a fiddle trio (Katy Adelson)'),
    'The Britches Full Of Stitches': ('MjVwy62IIN0', 'Jackie Daly and Séamus Creagh, live; it’s the second tune'),
    "Egan's (The Kerry Polka)": ('PprQc-qtfSQ', 'Mad For Trad, live'),
    "John Ryan's": ('8tkIYY6XQgs', 'Gaelic Storm, “An Irish Party in Third Class” from the film Titanic'),
    'The Boys Of Bluehill': ('sBc450A0aC4', 'Séamus Ennis, uilleann pipes; it’s the first tune'),
    'The Stack Of Barley': ('mz6VlV7pNAk', 'Johnny Connolly'),
    'Off To California': ('nOxuHBy84bM', 'Clannad, live in Bremen, 1980; it’s the second tune'),
    'The Kesh': ('Sk7UXx4ouS0', 'The Bothy Band; it’s the first tune in the set'),
}

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
               f'<a href="{tune}">Sheet music &amp; tab</a></div>'
               + (yt(FIRST_TEN_VIDEOS[name][0], f'{name} — {FIRST_TEN_VIDEOS[name][1]}',
                     f'<b>Hear it:</b> {esc(FIRST_TEN_VIDEOS[name][1])}.') if name in FIRST_TEN_VIDEOS else '')
               + '</li>\n')
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
    <p>Not sure what makes a polka a polka? Here’s <a href="learn/hornpipe-reel-polka.html">how to tell a hornpipe, a reel and a polka apart</a>.</p>
  </section>
{JS_VIDEO}'''
    crumbs = '<a href="learn/">From William</a> › 10 first session tunes'
    return page(title, desc, ld, crumbs, body, css=CSS_VIDEO), answer

# ---------------------------------------------------------------- article 2
TYPES_URL = 'learn/hornpipe-reel-polka.html'
# one recording of each type, checked to exist and be embeddable (YouTube oEmbed, 2026-10-25)
VIDEOS = {
    'polka': ('MjVwy62IIN0', 'Bill Sullivan’s Polka / The Britches Full of Stitches',
              'Jackie Daly and Séamus Creagh, live'),
    'reel': ('tYQWCu-M9o0', 'Miss McLeod’s', 'The Fitzgeralds, from the National Museum of Australia'),
    'hornpipe': ('sBc450A0aC4', 'The Boys of Bluehill / Dunphy’s Hornpipe', 'Séamus Ennis, uilleann pipes'),
}
CSS_VIDEO = """
  .yt{ margin:14px 0 6px; max-width:560px; }
  .yt a.ytp{ position:relative; display:block; aspect-ratio:16/9; border:2px solid var(--ink); border-radius:12px; overflow:hidden;
    background:#000; box-shadow:4px 4px 0 var(--ink); }
  .yt img{ width:100%; height:100%; object-fit:cover; display:block; opacity:.85; }
  .yt .play{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .yt .play b{ width:68px; height:48px; border-radius:12px; background:#e33; color:#fff; font-size:22px; display:flex;
    align-items:center; justify-content:center; }
  .yt a.ytp:hover .play b{ background:#c00; }
  .yt iframe{ width:100%; aspect-ratio:16/9; border:2px solid var(--ink); border-radius:12px; display:block; }
  .yt figcaption{ font-size:14px; margin-top:8px; opacity:.85; }
  table.cmp{ border-collapse:collapse; width:100%; margin:8px 0 6px; font-size:15px; }
  table.cmp th, table.cmp td{ text-align:left; padding:7px 8px; border-bottom:1px solid rgba(23,20,14,.15); vertical-align:top; }
  table.cmp thead th{ font-family:var(--disp); font-size:16px; }
  table.cmp tbody th{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.05em; font-weight:400; opacity:.75; }
  .faq h3{ font-family:var(--disp); font-size:18px; margin:16px 0 4px; } .faq p{ margin:0 0 8px; max-width:68ch; }
"""
# loads the real player only when someone clicks; without JavaScript the thumbnail is a plain link to YouTube
JS_VIDEO = """<script>
  document.querySelectorAll('a.ytp').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + a.dataset.id + '?autoplay=1&rel=0';
      f.title = a.dataset.title; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      a.replaceWith(f);
    });
  });
</script>"""

def yt(vid, title, caption):
    """A YouTube thumbnail that turns into the no-cookie player when clicked (caption is HTML)."""
    return (f'<figure class="yt"><a class="ytp" href="https://www.youtube.com/watch?v={vid}" data-id="{vid}" data-title="{esc(title)}">'
            f'<img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="{esc(title)} (video)" loading="lazy">'
            f'<span class="play"><b>▶</b></span></a>'
            f'<figcaption>{caption} <a href="https://www.youtube.com/watch?v={vid}">Watch on YouTube</a></figcaption></figure>')

def video(kind):
    vid, tune, who = VIDEOS[kind]
    return yt(vid, f'{tune} — {who}', f'<b>Hear a {kind}:</b> {esc(tune)}, {esc(who)}.')

def mt_link(name):
    """A tune's name, opening it in the Melody Trainer, where you see and hear how it's played."""
    return f'<a href="{esc("melody-trainer_1.html?tune=" + quote(name))}">{esc(name)}</a>'

def tune_links(names):
    return ', '.join(mt_link(n) for n in names)

def hornpipe_reel_polka(lib):
    irish = [t for t in lib if t['origin'] == 'Irish session']
    n, reels = len(irish), sum(t['type'] == 'reel' for t in irish)
    answer = ('Count the beats and listen for the swing. A polka has two beats in a bar and bounces along quickly. A reel and a '
              'hornpipe both have four, but a reel runs in even notes and flies along, while a hornpipe is slower and swung, '
              'long-short, and often ends each part on three strong notes. Tap your foot and you’ll hear it.')
    title = 'Hornpipe, Reel or Polka? How to Tell Them Apart | The Music Arcade'
    desc = ('How to tell a hornpipe, a reel and a polka apart: count the beats, listen for the swing, and hear one of each, '
            'from a tenor banjo and trad teacher.')
    faq = [('Is a hornpipe just a slow reel?',
            'No: it’s swung. Play a reel long-short and it starts to sound like a hornpipe, but hornpipes are made to sit in that '
            'lilt, with those strong endings.'),
           ('Why does the sheet music for a hornpipe look like a reel?',
            'Most transcriptions write both in even notes, and players add the swing. So learn hornpipes by ear as well as from '
            'the page.')]
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': 'Hornpipe, reel or polka? How to tell them apart',
           'description': desc, 'url': SITE + TYPES_URL, 'datePublished': '2026-10-25', 'dateModified': '2026-10-25',
           'author': AUTHOR, 'publisher': PUBLISHER},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
              {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}]
    tl = mt_link
    body = f'''  <h1>Hornpipe, reel or polka? How to tell them apart</h1>
  <p class="byline">From William · tenor banjo and Irish trad teacher</p>
  <p class="answer">{esc(answer)}</p>
  <section class="card prose"><h2>The polka</h2>
    <p>The polka is the quickest to recognise: two beats in a bar, <i>one-and two-and</i>, short phrases that keep bouncing back.
    It’s the music of Sliabh Luachra on the Cork–Kerry border, and it’s where I start beginners, because the tunes are short and
    the rhythm carries you.</p>
    <p>Try: {tune_links(["The Britches Full Of Stitches", "Egan's (The Kerry Polka)", "John Ryan's"])}.</p>
    {video('polka')}
  </section>
  <section class="card prose"><h2>The reel</h2>
    <p>Reels are the backbone of a session: {reels} of the {n} Irish tunes in my library are reels, more than any other type. Four
    beats in a bar, filled with a steady stream of even notes, <i>di-dle-di-dle</i>. Played up to speed they fly, which is exactly
    why I tell students to learn them slowly first.</p>
    <p>Try: {tune_links(["Miss McLeod's", "Drowsy Maggie"])}.</p>
    {video('reel')}
  </section>
  <section class="card prose"><h2>The hornpipe</h2>
    <p>A hornpipe has the same four beats as a reel, and on paper it often looks just like one. The difference is in how it’s
    played: swung, long-short, long-short, and steadier, with a stately lift. Listen for the end of each part, where many hornpipes
    land on three strong, even notes, like three stamps of the foot. {tl("The Boys Of Bluehill")} and
    {tl("The Harvest Home")} both do it.</p>
    <p>Try: {tune_links(["The Boys Of Bluehill", "Off To California", "The Harvest Home"])}. Barndances like
    {tl("The Stack Of Barley")} share that swung feel.</p>
    {video('hornpipe')}
  </section>
  <section class="card prose"><h2>At a glance</h2>
    <table class="cmp"><thead><tr><th></th><th scope="col">Polka</th><th scope="col">Reel</th><th scope="col">Hornpipe</th></tr></thead>
    <tbody>
      <tr><th scope="row">Beats in a bar</th><td>2</td><td>4</td><td>4</td></tr>
      <tr><th scope="row">Feel</th><td>bouncy</td><td>even, driving</td><td>swung, long-short</td></tr>
      <tr><th scope="row">Speed</th><td>quick</td><td>fastest</td><td>steadier</td></tr>
      <tr><th scope="row">Listen for</th><td>“one-and two-and”</td><td>a constant stream of notes</td><td>three “stamps” at the end of a part</td></tr>
      <tr><th scope="row">Try</th><td>{tl("The Britches Full Of Stitches")}, {tl("Egan's (The Kerry Polka)")}</td>
        <td>{tl("Miss McLeod's")}, {tl("Drowsy Maggie")}</td><td>{tl("The Boys Of Bluehill")}, {tl("Off To California")}</td></tr>
    </tbody></table>
  </section>
  <section class="card prose"><h2>Try it yourself</h2>
    <p>Open <a href="{esc("melody-trainer_1.html?tune=" + quote("Miss McLeod's"))}">Miss McLeod’s</a> and
    <a href="{esc("melody-trainer_1.html?tune=" + quote("The Boys Of Bluehill"))}">The Boys of Bluehill</a> in the Melody Trainer
    one after the other. Same four beats: tap your foot to each and you’ll feel the reel run straight and the hornpipe swing.</p>
    <p>Starting out? My <a href="{FIRST_TEN_URL}">10 first session tunes</a> include three polkas and three hornpipes and barndances,
    and they’re <a href="tunes/keys.html">nearly all in D or G</a>.</p>
  </section>
  <section class="card faq"><h2>Questions people ask</h2>
    {''.join(f'<h3>{esc(q)}</h3><p>{esc(a)}</p>' for q, a in faq)}
  </section>
{JS_VIDEO}'''
    crumbs = '<a href="learn/">From William</a> › Hornpipe, reel or polka?'
    return page(title, desc, ld, crumbs, body, css=CSS_VIDEO), answer

ARTICLES = [  # (url, title, one line) — newest first on the index
    (TYPES_URL, 'Hornpipe, reel or polka? How to tell them apart',
     'Count the beats, listen for the swing, and hear one of each.'),
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
    art, answer = hornpipe_reel_polka(lib)
    open(os.path.join(ROOT, TYPES_URL), 'w', encoding='utf-8').write(tp.root_links(art))
    print('wrote', TYPES_URL, '| answer words:', len(answer.split()))
