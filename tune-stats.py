#!/usr/bin/env python3
"""tunes/keys.html — "What key are Irish session tunes in?", counted from the
tune library itself (the same ABC bundles the tune pages are built from).

    python3 tune-stats.py && python3 seo.py

Rerun after adding tunes: every number on the page comes from tunes/*.abc,
parsed with tune-pages.py's own key and range logic, so the page can never
disagree with the tune pages. Bump COUNTED when you rerun with new tunes.
Written in William's voice (SEO playbook item 4): change the wording here, not in the page.
"""
import importlib.util, json, os, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('tp', os.path.join(ROOT, 'tune-pages.py'))
tp = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(tp)
esc, slug = tp.esc, tp.slug

COUNTED = ('2026-10-24', 'October 2026')
OUT = os.path.join(ROOT, 'tunes', 'keys.html')
URL = 'https://themusicarcade.com/tunes/keys.html'

# where a key can be practised on the banjo: the scale's own page, else the Scales tool
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
_pages_js = os.path.join(ROOT, 'scales', 'pages.js')   # written by scale-pages.py
SCALE_PAGES = (json.loads(open(_pages_js, encoding='utf-8').read().split('=', 1)[1].strip().rstrip(';'))
               if os.path.exists(_pages_js) else {})
def scale_link(key):
    t = key['tonic']
    if t[0] not in PC: return None
    pc = (PC[t[0]] + (1 if '♯' in t else -1 if '♭' in t else 0)) % 12
    page = SCALE_PAGES.get(f'banjo/{key["mode"]}/{pc}')
    return page or f'find-the-note.html?inst=banjo&root={pc}&scale={key["mode"]}'

def rows_for(lib, origin):
    out = []
    for t in lib:
        if t['origin'] != origin: continue
        k = tp.parse_key(t['key'])
        f = tp.tune_facts(t, k, tp.notes_by_bar(t['abc'], k))
        out.append({'t': t, 'k': k, 'f': f})
    return out

def pct(a, b): return round(100 * a / b) if b else 0

def bars(counter, n, link=None, examples=None):
    """A bar chart that is just HTML: every number is visible text."""
    top = max(counter.values())
    h = '<ul class="bars">'
    for label, c in counter.most_common():
        href = link(label) if link else None
        lab = f'<a href="{esc(href)}">{esc(label)}</a>' if href else esc(label)
        ex = ''
        if examples and examples.get(label):
            ex = '<span class="ex">' + ', '.join(f'<a href="tunes/{slug(nm)}.html">{esc(nm)}</a>' for nm in examples[label][:3]) + '</span>'
        h += (f'<li><span class="lab">{lab}</span><span class="track"><i style="width:{100 * c / top:.1f}%"></i></span>'
              f'<span class="num">{c} <small>({pct(c, n)}%)</small></span>{ex}</li>')
    return h + '</ul>'

def build():
    lib = [t for t in tp.library() if t['origin'] in tp.ORIGIN]
    I = rows_for(lib, 'Irish session'); n = len(I)
    keys = collections.Counter(r['k']['label'] for r in I)
    keyobj = {r['k']['label']: r['k'] for r in I}
    ex = collections.defaultdict(list)
    for r in sorted(I, key=lambda r: r['t']['name']): ex[r['k']['label']].append(r['t']['name'])
    sig = collections.Counter(r['k']['parent_name'] for r in I)
    dg = sig['D major'] + sig['G major']
    modes = collections.Counter(r['k']['mode'] for r in I)
    plain = modes['major']
    dorian = keys['E dorian'] + keys['A dorian']
    # the E dorian tune to listen to: a well-known one if it's in the library
    listen = next((nm for nm in ("Cooley's", 'Drowsy Maggie') if nm in ex['E dorian']), ex['E dorian'][0])
    first = sum(r['f']['first_pos'] for r in I)
    clean = sum(r['f']['off'] == 0 for r in I)
    types = collections.Counter(r['t']['type'] for r in I)
    PL = dict(tp.PLURAL, air='Airs', barndance='Barndances', reel='Reels', jig='Jigs', hornpipe='Hornpipes',
              polka='Polkas', slide='Slides', waltz='Waltzes')
    type_rows = ''
    for ty, c in types.most_common():
        kk = collections.Counter(r['k']['label'] for r in I if r['t']['type'] == ty).most_common(3)
        type_rows += (f'<tr><th scope="row">{esc(PL.get(ty, ty.capitalize() + "s"))}</th><td>{c}</td>'
                      f'<td>{esc(", ".join(f"{k} ({v})" for k, v in kk))}</td></tr>')

    A = rows_for(lib, 'American fiddle'); J = rows_for(lib, 'Trad jazz')
    ak = collections.Counter(r['k']['label'] for r in A); jk = collections.Counter(r['k']['parent_name'] for r in J)
    flat3 = sum(jk[k] for k in ('B♭ major', 'E♭ major', 'F major'))
    amodal = sum(r['k']['mode'] != 'major' for r in A)

    answer = (f'Mostly D major and G major. Of the {n} popular session tunes I’ve gathered here, {dg} use the key '
              f'signature of D or G major, one or two sharps. About a quarter are in E or A dorian, which use those same notes. '
              f'That’s why I start every new banjo student on the D scale, then G: between them, they cover nearly every tune at a session.')
    title = f'What Key Are Irish Session Tunes In? Keys of {n} Trad Tunes | The Music Arcade'
    desc = (f'{dg} of {n} popular Irish session tunes use the key signature of D or G major. '
            f'Keys, modes and tune types counted from real tunes, by tenor banjo teacher William Troy.')
    faq = [
        ('What is the most common key in Irish traditional music?',
         f'D major, then G major. In this collection {keys["D major"]} of {n} tunes are in D major and {keys["G major"]} in G major, '
         f'and {dg} of the {n} use the key signature of one of those two.'),
        ('What does dorian mean in an Irish tune?',
         'A dorian tune uses the notes of a major scale but treats a different note as home. E dorian uses the notes of D major, '
         'and A dorian uses the notes of G major, so they sound minor without needing any new notes.'),
        ('Which scales should I learn first for Irish tunes?',
         f'D major, then G major. Those two key signatures cover {dg} of the {n} tunes here, including the dorian and mixolydian ones, '
         'because those use the same notes.'),
    ]
    ld = [{
        '@context': 'https://schema.org', '@type': 'Article', 'headline': 'What key are Irish session tunes in?',
        'description': desc, 'url': URL, 'datePublished': COUNTED[0], 'dateModified': COUNTED[0],
        'author': {'@type': 'Person', 'name': 'William Troy'},
        'publisher': {'@type': 'Organization', 'name': 'The Music Arcade', 'url': 'https://themusicarcade.com/'}},
        {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}]

    css = """
  .answer{ font-size:19px; line-height:1.55; max-width:62ch; margin:6px 0 22px; padding:16px 18px; background:#fffdf7;
    border:2px solid var(--ink); border-radius:12px; box-shadow:5px 5px 0 var(--ink); }
  .answer b{ color:var(--blue); }
  .stats{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:0 0 26px; }
  .stat{ border:2px solid var(--ink); border-radius:12px; padding:12px 14px; background:#fffdf7; }
  .stat b{ display:block; font-family:var(--disp); font-weight:800; font-size:30px; line-height:1; }
  .stat span{ font-size:14px; }
  .bars{ list-style:none; padding:0; margin:8px 0 6px; }
  .bars li{ display:grid; grid-template-columns:130px 1fr 92px; align-items:center; gap:10px; padding:5px 0;
    border-bottom:1px solid rgba(23,20,14,.12); }
  .bars .lab{ font-weight:600; } .bars .lab a{ color:var(--ink); } .bars .lab a:hover{ color:var(--blue); }
  .bars .track{ height:14px; border:1.5px solid var(--ink); border-radius:99px; overflow:hidden; background:#fffdf7; }
  .bars .track i{ display:block; height:100%; background:var(--blue); }
  .bars .num{ font-family:var(--mono); font-size:13px; text-align:right; } .bars small{ opacity:.65; }
  .bars .ex{ grid-column:1 / -1; font-size:13.5px; opacity:.85; margin:-2px 0 2px; }
  .bars .ex a{ color:var(--blue); text-decoration:none; } .bars .ex a:hover{ text-decoration:underline; }
  table.types{ border-collapse:collapse; width:100%; margin:8px 0 6px; font-size:15px; }
  table.types th, table.types td{ text-align:left; padding:6px 8px; border-bottom:1px solid rgba(23,20,14,.15); }
  table.types thead th{ font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  .prose p, .prose ol li{ max-width:68ch; } .prose a{ color:var(--blue); }
  .faq h3{ font-family:var(--disp); font-size:18px; margin:16px 0 4px; } .faq p{ margin:0 0 8px; max-width:68ch; }
  .method{ font-size:14.5px; opacity:.9; } .method p{ max-width:72ch; }
  @media (max-width:560px){ .bars li{ grid-template-columns:96px 1fr 74px; } }
"""
    html = f'''<!DOCTYPE html>
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
<style>{tp.CSS}{css}</style>
</head>
<body>
<div class="wrap">
  <nav class="tabs" aria-label="Sections">
    <a href="index.html">Arcade</a><a href="dojo.html">Courses</a><a href="resources.html">Resources</a>
    <a href="training.html" class="cur" aria-current="page">Practice</a><a href="create.html">Create</a>
  </nav>
  <div class="crumbs"><a href="melody-trainer_1.html">Melody Trainer</a> › <a href="tunes/">Tune directory</a> › Keys</div>
  <h1>What key are Irish session tunes in?</h1>
  <p class="answer"><b>{esc(answer.split('.')[0])}.</b>{esc(answer[len(answer.split('.')[0]) + 1:])}</p>

  <div class="stats">
    <div class="stat"><b>{pct(dg, n)}%</b><span>use the key signature of D or G major ({dg} of {n})</span></div>
    <div class="stat"><b>{pct(n - plain, n)}%</b><span>aren’t plain major: dorian, mixolydian or minor</span></div>
    <div class="stat"><b>{pct(first, n)}%</b><span>fit in first position on fiddle, mandolin or tenor banjo</span></div>
    <div class="stat"><b>{pct(clean, n)}%</b><span>use no notes outside the key signature</span></div>
  </div>

  <section class="card prose"><h2>The keys, counted</h2>
    <p>Here’s every key in the {n} Irish tunes in my library, as each tune is written. Click a key to see that scale on the banjo,
    or one of the tunes under it to learn it.</p>
    {bars(keys, n, link=lambda lab: scale_link(keyobj[lab]), examples=ex)}
  </section>

  <section class="card prose"><h2>Same notes, different home</h2>
    <p>Only {plain} of the {n} tunes ({pct(plain, n)}%) are in a plain major key, so you might expect to need a lot of scales. You don’t.
    E dorian uses exactly the notes of D major; A dorian and D mixolydian use the notes of G major. The tune just treats a different
    note as home, which is what gives so many reels that lonesome, minor-ish sound.</p>
    <p>Group the tunes by key signature instead and it’s almost all one or two sharps:</p>
    {bars(sig, n)}
    <p>So when a student asks me what to learn after D and G, my answer is: nothing new yet. Play the same notes, and listen for where
    the tune comes to rest.</p>
  </section>

  <section class="card prose"><h2>Tune types and their keys</h2>
    <table class="types"><thead><tr><th scope="col">Type</th><th scope="col">Tunes</th><th scope="col">Most common keys</th></tr></thead>
    <tbody>{type_rows}</tbody></table>
  </section>

  <section class="card prose"><h2>What this means if you’re learning</h2>
    <ol>
      <li><b>Learn D major first, then G major.</b> That’s the order in my <a href="learn-banjo.html">Beginner Banjo</a> course,
      and it’s why: those two key signatures cover {dg} of these {n} tunes. Start with
      <a href="scales/tenor-banjo/d-major-scale.html">D major on tenor banjo</a>, then
      <a href="scales/tenor-banjo/g-major-scale.html">G major</a>.</li>
      <li><b>Then learn to hear the dorian tunes.</b> {dorian} of the {n} are in E or A dorian. You already know the notes;
      try <a href="tunes/{slug(listen)}.html">{esc(listen)}</a> and listen for the E it keeps coming home to.</li>
      <li><b>Stay in first position.</b> {first} of the {n} tunes fit between the open G string and the fourth finger on the E string,
      so there’s no need to move up the neck to play the session repertoire.</li>
    </ol>
  </section>

  <section class="card prose"><h2>Across the Atlantic, and beyond</h2>
    <p>The same count tells other traditions apart. In the {len(A)} American old-time fiddle tunes here, A major is the second most
    common key ({ak['A major']} tunes, {pct(ak['A major'], len(A))}%), and only {amodal} aren’t in a plain major key. In the {len(J)} trad jazz tunes,
    the keys swing to the flat side: {flat3} of {len(J)} ({pct(flat3, len(J))}%) are in B♭, E♭ or F, the keys of the horns.</p>
  </section>

  <section class="card faq"><h2>Questions people ask</h2>
    {''.join(f'<h3>{esc(q)}</h3><p>{esc(a)}</p>' for q, a in faq)}
  </section>

  <section class="card method"><h2>How I counted</h2>
    <p>The Irish tunes are thesession.org’s most-saved tunes, plus a hand-picked set of well-known marches, barndances and slow airs:
    {n} in all, each using the first setting on thesession.org. The American fiddle tunes come from Jim’s Roots &amp; Blues
    and the trad jazz tunes from <i>The Public Domain Song Anthology</i>.</p>
    <p>Each key is the one written in that transcription. Transcribers don’t always agree, so the same tune can be written as E minor
    in one place and E dorian in another. “First position” means every note lies between the open G string of a fiddle (the G below
    middle C) and the B played with the fourth finger on the E string, the same written range on mandolin and tenor banjo. These are popular tunes, not every tune ever played, so treat the numbers as a picture of what you’ll hear at a typical
    session. Counted {COUNTED[1]}, from the same files the <a href="tunes/">tune pages</a> are built from.</p>
  </section>

  <p class="credit">Tune settings from <a href="https://thesession.org" rel="nofollow noopener" target="_blank">thesession.org</a>
  and <a href="https://www.jimsrootsandblues.com" rel="nofollow noopener" target="_blank">Jim’s Roots &amp; Blues</a>; jazz melodies from
  <i>The Public Domain Song Anthology</i> (CC0). Every tune here is traditional or in the public domain.</p>
  <div class="foot"><a href="tunes/">&larr; Tune directory</a></div>
</div>
<script src="/tools.js"></script>
<script src="/related.js"></script>
</body>
</html>
'''
    return tp.root_links(html), answer

if __name__ == '__main__':
    page, answer = build()
    open(OUT, 'w', encoding='utf-8').write(page)
    print('wrote', os.path.relpath(OUT, ROOT), '| answer words:', len(answer.split()))
