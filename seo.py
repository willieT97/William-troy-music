#!/usr/bin/env python3
"""
SEO for themusicarcade.com — run after adding or renaming a page:

    python3 seo.py

What it does, every time (safe to re-run; it rewrites its own block):
  * <title> and <meta name="description"> from PAGES below (a page left out
    of PAGES, or given None, keeps what it already has)
  * one marked block in each <head>: canonical URL, Open Graph + Twitter
    share tags (title, description, picture), and noindex for private pages
  * sitemap.xml — every public page, last-modified date from git
  * robots.txt  — points search engines at the sitemap

TO ADD A PAGE: add a row to PAGES. ('title', 'description') — keep the
title under ~60 characters with the words people would type into Google
first, and the description under ~155 characters, written for a person
deciding whether to click.
Private pages (teacher tools, account) go in PRIVATE: they get noindex and
stay out of the sitemap. Shelved tools stay indexable (their address
still works) but are left out of the sitemap, read from tools.js.
"""
import os, re, subprocess, html, json
from urllib.parse import quote

SITE = 'https://themusicarcade.com/'
NAME = 'The Music Arcade'
IMAGE = SITE + 'og-image.png'
# pages with a share picture of their own (shown when the link is posted on WhatsApp, Facebook…)
IMAGES = { 'learn-banjo.html': 'learn-banjo-card.jpg' }
ROOT = os.path.dirname(os.path.abspath(__file__))

PAGES = {
  # ---- front door + section pages ----
  'index.html': ('Music Arcade — free music games for ear training & note reading',
    'Free browser games that teach music: ear training, note reading, rhythm, chords and scales for guitar, ukulele, piano and tenor banjo. Play with your own instrument.'),
  'start.html': ('Where do I start? — Music Arcade', None),
  'training.html': ('Music practice tools — Melody Trainer, tuner, metronome | Music Arcade',
    'Free practice tools: play trad tunes back from notation, ear-train with Pitch Practice, tune up, keep time with a metronome, and jam over backing tracks.'),
  'resources.html': ('Free printable music resources — chords, scales, circle of fifths | Music Arcade',
    'Printable chord charts, scales for every instrument, an interactive circle of fifths, and plain-English theory pages on scales, chords and the blues.'),
  'dojo.html': ('Online music courses — improvisation, walking bass, counterpoint | Music Arcade',
    'Step-by-step music courses: learn to improvise (Learning to Fly), walk a jazz bassline (Learning to Walk), and write counterpoint the way it was taught 300 years ago.'),
  'create.html': ('Make your own song online — Song Maker & Song Lab | Music Arcade',
    'Write a song in your browser: drop chords into bars, draw a melody, add a beat and play it back. Share it on the charts.'),
  'gallery.html': ('The Charts — songs made on the Music Arcade',
    'Play the songs other people built in the Music Arcade song makers, and vote your favourites up the charts.'),
  'upgrade.html': ('Go Pro — Music Arcade', 'Unlock every course and practice pack on the Music Arcade.'),

  'learn-banjo.html': (None, None),   # title + description written in the page itself

  # ---- reference + theory ----
  'chords.html': ('Chord charts for piano, guitar & tenor banjo — printable | Music Arcade',
    'Every major and minor chord drawn out for piano, guitar or Irish tenor banjo (GDAE). Beginner, intermediate and full circle-of-fifths sets, made to print.'),
  'ukulele-chords.html': ('Ukulele chords for beginners — printable chart | Music Arcade', None),
  'find-the-note.html': ('Scales on piano, guitar, ukulele, bass & tenor banjo | Music Arcade', None),
  'circle-of-fifths.html': ('Interactive circle of fifths — keys, chords, printable | Music Arcade', None),
  'scale-theory.html': ('Scale theory explained — major, minor, modes, pentatonic | Music Arcade', None),
  'chord-theory.html': ('Chord theory explained — major, minor, diminished, augmented | Music Arcade', None),
  'blues-theory.html': ('Blues theory — the blues scale, blue notes & 12-bar blues | Music Arcade', None),
  'note-names.html': ('Notes on the treble stave — Every Good Boy Deserves Food | Music Arcade', None),
  'string-names.html': ('Guitar & ukulele string names — with sayings to remember them | Music Arcade', None),
  'rhythm-zoo.html': ('Rhythm Zoo — note values for kids, as animals | Music Arcade', None),

  # ---- practice tools ----
  'melody-trainer_1.html': ('Melody Trainer — learn tunes on banjo, guitar, fiddle or piano',
    'Pick a tune and see every note on the stave and on your banjo, fiddle, guitar, uke or piano. Play along — the music waits for you. 260+ Irish & folk tunes.'),
  'Ear Training/pitch-practice.html': ('Pitch Practice — online ear training by scale | Music Arcade',
    'Pure ear training, no game: hear a short run of notes off a home note and name them. Start in C major and unlock new scales by playing them on your instrument.'),
  'Ear Training/play-it-back.html': (None, None),   # title + description written in the page
  'tuner.html': ('Online tuner — chromatic, for any instrument | Music Arcade',
    'A free chromatic tuner in your browser. Play a note and the needle shows how sharp or flat you are — guitar, ukulele, banjo, fiddle, voice, anything.'),
  'metronome.html': ('Online metronome — free, with tap tempo | Music Arcade', None),
  'jam-track.html': ('Jam Track — make a backing track from a chord chart | Music Arcade', None),
  'phrasebook.html': ('Phrasebook — practise licks in all 12 keys | Music Arcade', None),
  'composer.html': ('Song Maker — write a song with chords and melody online | Music Arcade', None),
  'songlab.html': ('Song Lab — build a full song with sections and beats | Music Arcade', None),
  'song-trainer.html': (None, None),
  'listening-lab.html': (None, None),
  'chorale-ears.html': (None, None),

  # ---- courses ----
  'learning-to-fly.html': ('Learning to Fly — learn to improvise, step by step | Music Arcade', None),
  'learning-to-walk.html': ('Learning to Walk — walking bass lines for beginners | Music Arcade', None),
  'Theory/gradus-shell.html': ('The Counterpoint Dojo — first species counterpoint (Fux) | Music Arcade',
    'Learn species counterpoint the way Fux taught it in Gradus ad Parnassum: write a line over a cantus firmus and get every note checked.'),
  'Theory/old-man-and-the-c.html': (None, 'A seafaring note-reading tale: read each note on the stave to reel it in and sail out to deeper water.'),
  'Guitar/fretboard-atlas.html': ('The Fretboard Atlas — learn the notes on the guitar neck | Music Arcade',
    'A course in learning every note on the guitar fretboard, string by string, with an old mapmaker.'),

  # ---- arcade: ear training ----
  'Ear Training/pitch-invaders_2.html': ('Pitch Invaders — ear training game | Music Arcade',
    'An ear-training arcade game: aliens fall down the lane of their note — hear it, tap the right note and shoot them down. Free in your browser.'),
  'Ear Training/pitch-invaders-chromatic.html': ('Pitch Invaders Chromatic — all 12 notes ear training | Music Arcade',
    'Ear-training game with all twelve notes, sharps and flats included, brought in one at a time so your ear can settle.'),
  'Ear Training/pitch-invaders-fifths.html': ('Pitch Invaders: Circle of Fifths — ear training in every key | Music Arcade',
    'Only the notes of the key fall, and the circle of fifths spins to a new key every time you beat a boss. An ear-training game for every key.'),
  'Ear Training/chord-progress.html': ('Chord Progress — chord progression ear training | Music Arcade',
    'A chord progression plays with the last card blank — name the chord you heard. Ear training for I, IV, V and vi.'),
  'Theory/scale-climb.html': ('Scale Climb — scale ear training game | Music Arcade',
    'Tap the next note of the scale to climb a step — and stay ahead of the barrels rolling down. An ear-training game.'),

  # ---- arcade: ukulele ----
  'Ukulele/in-tune.html': ('Is my ukulele in tune? — ear training game | Music Arcade',
    'The four ukulele strings play one by one. Is it in tune, or is something off? Train the ear you need to tune by ear.'),
  'Ukulele/out-of-tune.html': ('Which ukulele string is out of tune? — ear game | Music Arcade',
    'One ukulele string has gone sour. Find it by ear — the same skill you use tuning up for real.'),
  'Ukulele/chord-quiz.html': ('Ukulele chord quiz — build the chord shape | Music Arcade',
    'A chord name pops up — build the ukulele chord shape from memory, then check it. A free ukulele chord quiz.'),
  'Ukulele/chord-progress-uke.html': ('Uke Progress — ukulele chord ear training | Music Arcade',
    'Ukulele chords play and the last one is blank — name the chord you heard. Ear training for ukulele players.'),
  'Ukulele/what-note-ukulele-3frets.html': ('Ukulele fretboard notes game — open + 3 frets | Music Arcade',
    'A marker lands on the ukulele fretboard — work out which note it is. Learn the first three frets of the ukulele.'),

  # ---- arcade: guitar ----
  'Guitar/in-tune-guitar.html': ('Is my guitar in tune? — ear training game | Music Arcade',
    'The six guitar strings play in turn. Is the guitar in tune, or is one string off? Train your ear to tune by ear.'),
  'Guitar/out-of-tune-guitar.html': ('Which guitar string is out of tune? — ear game | Music Arcade',
    'One of the six strings is out. Find it by ear — the ear test you use when tuning a guitar for real.'),
  'Guitar/chord-quiz-guitar.html': ('Guitar chord quiz — build the chord shape | Music Arcade',
    'A chord name pops up — build the guitar chord by tapping frets, then check it. A free guitar chord quiz.'),
  'Guitar/chord-progress-guitar.html': ('Guitar Progress — guitar chord ear training | Music Arcade',
    'Guitar chords play with their real shapes and the last one is blank — name what you heard. Chord ear training for guitarists.'),
  'Guitar/what-note-guitar.html': ('Guitar fretboard notes game — learn the notes | Music Arcade',
    'A marker lands on the guitar neck — work out the note and tap it. Learn the notes on the guitar fretboard, open strings to 3rd fret.'),
  'Guitar/triad-drop.html': ('Triad Drop — guitar triads up the neck | Music Arcade',
    'Slide a three-note grip up the guitar neck to the fret where it spells the chord. Learn guitar triad shapes everywhere.'),
  'Guitar/triad-slingshot.html': ('Triad Launch — guitar triad game | Music Arcade',
    'Fire a triad grip along the guitar neck so it stops on the fret that spells the chord. A game for learning guitar triads.'),

  # ---- arcade: piano ----
  'Piano/what-note-piano.html': ('Piano keyboard notes game — name the key | Music Arcade',
    'A marker lands on an unlabelled piano keyboard — use the black-key groups to work out the note. Learn the piano keys, free.'),
  'Piano/chord-catapult.html': ('Chord Catapult — piano chord game | Music Arcade',
    'Fling notes onto the piano keyboard and strike the keys that spell the chord. A game for learning piano chords.'),
  'Piano/chord-cascade.html': ('Chord Cascade — piano chord shapes game | Music Arcade',
    'A chord shape drops from the sky — slide the piano keyboard so it lands where it fits. Learn chord shapes on the piano.'),

  # ---- arcade: tenor banjo ----
  'Banjo/what-note-banjo.html': ('Tenor banjo fretboard notes game (GDAE) | Music Arcade',
    'A marker lands on the tenor banjo neck — work out the note. GDAE tuning, so it works for mandolin and fiddle fingers too.'),
  'Banjo/in-tune-banjo.html': ('Is my tenor banjo in tune? — ear training (GDAE) | Music Arcade',
    'The four GDAE strings play in turn — is the tenor banjo in tune, or is one string off? Ear training for tuning by ear.'),
  'Banjo/out-of-tune-banjo.html': ('Which banjo string is out of tune? — tenor banjo ear game | Music Arcade',
    'One GDAE string is out. Find it by ear and say whether it’s sharp or flat — the real tuning-up ear, for Irish tenor banjo.'),

  # ---- arcade: reading + rhythm ----
  'Theory/note-reading.html': ('Note reading game — name the note on the stave | Music Arcade',
    'A note appears on the stave — name it before the clock runs down. Free sight-reading practice for treble and bass clef.'),
  'Theory/note-elevator.html': ('Note Elevator — note reading game | Music Arcade',
    'Read the note, press its floor and send the lift there — faster and faster. A fun way to learn to read music.'),
  'Theory/note-hopper.html': ('Note Hopper — play the note on your instrument to cross the river | Music Arcade',
    'A frog crosses the river on lily pads, each marked with a note. Play it on your own instrument and the frog hops on. A mic-powered music game.'),
  'Theory/apple-shot.html': ('Apple Shot — note reading archery game | Music Arcade',
    'Read the note on the apple, draw the bow and loose it as your aim crosses that note. A note-reading game.'),
  'Theory/hidden-words.html': ('Hidden Words — spell words with notes on the stave | Music Arcade',
    'Each note on the stave stands for a letter. Read them in turn and spell the hidden word. Note-reading practice for beginners.'),
  'Theory/bar-packer.html': ('Bar Packer — rhythm & note values game | Music Arcade',
    'Pack a bar with note blocks so it fills exactly — no gaps, no spilling over. Learn note values and time signatures.'),
  'Theory/missing-piece.html': ('The Missing Piece — note values puzzle | Music Arcade',
    'A bar drawn as a jigsaw with one piece gone — pick the note that fills the hole exactly. A rhythm and note-value puzzle.'),
  'Theory/fix-the-plank.html': ('Fix the Plank — rhythm game | Music Arcade',
    'One plank in the bar is cracked — rebuild its length out of smaller notes. Practise note values and subdivision.'),
  'Theory/rhythm-runner.html': ('Rhythm Runner — rhythm reading game | Music Arcade',
    'Read the bar of rhythm, then run it — hold for the long notes and land on the rests. Rhythm-reading practice.'),
}

# noindex + out of the sitemap
PRIVATE = {
  'rollbook.html', 'account.html', 'workshop-lab.html', 'reading.html', 'shelf.html',
  'learning-to-fly-listen.html', 'arcade-index.html', 'Theory/fix-the-bridge.html',
  'Theory/gap-fill.html', 'irish-releases-admin.html', 'lab.html',
}
# old prototypes nothing links to any more: tagged, but kept out of the sitemap
# (move one into PAGES with a real title/description if it comes back)
UNLISTED = {
  'chord-trainer.html', 'Theory/counterpoint.html', 'Ukulele/chord-countdown.html',
  'Ukulele/chord-maker.html', 'Guitar/fretfall-arcade.html', 'Ukulele/what-note-ukulele.html',
}
# not pages at all
SKIP_DIRS = ('email-templates/', 'supabase/', 'chorales/', 'songs/', 'tunes/', 'node_modules/')

def url_for(path):
  return SITE if path == 'index.html' else SITE + quote(path)

def shelved_hrefs():
  src = open(os.path.join(ROOT, 'tools.js'), encoding='utf-8').read()
  out = set()
  for m in re.finditer(r"\{[^{}]*\}", src):
    row = m.group(0)
    if re.search(r"\bshelved\s*:\s*true", row):
      h = re.search(r"\bh\s*:\s*'([^']+)'", row)
      if h: out.add(h.group(1).replace('%20', ' '))
  return out

def git_date(path):
  try:
    d = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path], cwd=ROOT,
                       capture_output=True, text=True).stdout.strip()
    return d or None
  except Exception:
    return None

def esc(s): return html.escape(s, quote=True)

def process(path, shelved):
  full = os.path.join(ROOT, path)
  s = open(full, encoding='utf-8').read()
  if '<head' not in s: return None
  title, desc = PAGES.get(path, (None, None))

  if title:
    s, n = re.subn(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', s, count=1, flags=re.S)
    if not n: s = s.replace('</head>', '<title>' + esc(title) + '</title>\n</head>', 1)
  m = re.search(r'<title>(.*?)</title>', s, re.S)
  cur_title = html.unescape(m.group(1).strip()) if m else NAME

  dre = r'<meta\s+name="description"\s+content="[^"]*"\s*/?>'
  if desc:
    tag = '<meta name="description" content="' + esc(desc) + '" />'
    if re.search(dre, s): s = re.sub(dre, lambda _: tag, s, count=1)
    else: s = re.sub(r'(<title>.*?</title>)', lambda mm: mm.group(1) + '\n' + tag, s, count=1, flags=re.S)
  m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', s)
  cur_desc = html.unescape(m.group(1)) if m else None

  private = path in PRIVATE
  # one hand-written canonical (the old arcade-index stub) is left alone
  if not private:
    s = re.sub(r'\n?<link rel="canonical"[^>]*>', '', s)
  lines = ['<!-- seo: written by seo.py — edit PAGES there, not here -->']
  if private:
    lines.append('<meta name="robots" content="noindex" />')
  else:
    u = url_for(path)
    lines += ['<link rel="canonical" href="' + u + '" />',
              '<meta property="og:site_name" content="' + NAME + '" />',
              '<meta property="og:type" content="website" />',
              '<meta property="og:url" content="' + u + '" />',
              '<meta property="og:title" content="' + esc(cur_title) + '" />']
    if cur_desc: lines.append('<meta property="og:description" content="' + esc(cur_desc) + '" />')
    lines += ['<meta property="og:image" content="' + (SITE + IMAGES[path] if path in IMAGES else IMAGE) + '" />',
              '<meta name="twitter:card" content="summary_large_image" />']
  block = '\n'.join(lines) + '\n<!-- /seo -->'

  s = re.sub(r'\n?<!-- seo: .*?<!-- /seo -->', '', s, flags=re.S)
  if private and 'name="robots"' in s:   # page already says noindex itself
    block = None
  if block:
    s = re.sub(r'(<title>.*?</title>)', lambda mm: mm.group(1) + '\n' + block, s, count=1, flags=re.S)

  open(full, 'w', encoding='utf-8').write(s)
  listed = (not private) and path not in shelved and path not in UNLISTED
  return (path, listed)

def main():
  shelved = shelved_hrefs()
  files = subprocess.run(['git', 'ls-files', '*.html'], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()
  files = [f.strip('"') for f in files if not f.startswith(SKIP_DIRS)]
  # pages made by scale-pages.py count even before they are committed
  for d, _, fs in list(os.walk(os.path.join(ROOT, 'scales'))) + list(os.walk(os.path.join(ROOT, 'tunes'))):
    files += [os.path.relpath(os.path.join(d, f), ROOT) for f in fs if f.endswith('.html')]
  files = sorted(set(files))
  done, urls = 0, []
  for f in sorted(files):
    if not os.path.exists(os.path.join(ROOT, f)): continue
    r = process(f, shelved)
    if not r: continue
    done += 1
    if r[1]: urls.append((f, git_date(f)))
  urls.sort(key=lambda u: (u[0] != 'index.html', '/' in u[0], u[0]))
  out = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
  for f, d in urls:
    out.append('  <url><loc>' + esc(url_for(f)) + '</loc>' + ('<lastmod>' + d + '</lastmod>' if d else '') + '</url>')
  out.append('</urlset>')
  open(os.path.join(ROOT, 'sitemap.xml'), 'w').write('\n'.join(out) + '\n')
  # private pages are NOT disallowed here: a crawler has to fetch a page to see its noindex
  open(os.path.join(ROOT, 'robots.txt'), 'w').write(
    'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + 'sitemap.xml\n')
  missing = [p for p in PAGES if p not in files]
  print(f'{done} pages tagged, {len(urls)} in sitemap.xml')
  if missing: print('in PAGES but not found:', missing)

if __name__ == '__main__':
  main()
