/* ====================================================================
   MUSIC ARCADE — what's on this site, and which of it suits you
   --------------------------------------------------------------------
   One catalogue of every tool and game, shared by the pages that need
   to recommend something: start.html (the three-question plan) and the
   "I want to..." strip on the arcade page.

   TO ADD A TOOL: add one row to CATALOGUE below. Nothing else, on any
   page, needs touching. Fields:
      t   title            h   href
      d   one line, written for a ten-year-old
      g   goals it serves  lv  levels it suits (1 new / 2 a while / 3 comfortable)
      i   instruments it ONLY makes sense on (omit = any instrument)
      fav instruments it's especially good for (a nudge, not a filter)
      dep 1 a game you can play right now / 2 a proper tool / 3 a whole course
      mic true if it listens through the microphone
      note a short caveat shown on the card (e.g. Pro courses)
      w   tie-breaker: doing beats reading about it (see score())
      mk  builds the href from the answers, for pages that take ?inst=

   Exposed as window.MATools:
      GOALS INSTS LEVELS CATALOGUE ICON GOAL_WORD INST_WORD LEVEL_WORD
      score(x, answers)      how well one tool fits
      plan(answers)          -> {stops:[3], more:[...]}  the three-stop plan
      forGoal(goal, answers) -> [...]  everything that serves one goal
      href(x, answers)       resolve a row's link
      remember() / forget()  the saved answers, shared across pages
   ==================================================================== */
(function () {
  'use strict';
  if (window.MATools) return;

/* Little drawn instruments. There is no ukulele emoji, and 🎸 would have to
   stand in for uke, guitar AND bass — three chips wearing the same picture.
   One waisted body, redrawn at different sizes with a longer or shorter
   neck, tells them apart the way the real instruments do. */
var BODY = 'M16 10C12 10 9.5 12.6 9.5 15.8c0 2 2 3 2 4.6 0 1.8-3.5 2.6-3.5 5.6 0 2.8 3.8 4.4 8 4.4'
         + 's8-1.6 8-4.4c0-3-3.5-3.8-3.5-5.6 0-1.6 2-2.6 2-4.6C22.5 12.6 20 10 16 10z';
function ico(inner) {
  return '<svg class="ic" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" '
       + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}
/* one body, drawn big or small, with a long or a stubby neck — the same
   thing that tells a uke from a guitar from a bass across a room */
function stringed(scale, neckTop, head) {
  var top = (22 - 12 * scale).toFixed(1);
  return '<g transform="translate(16 22) scale(' + scale + ') translate(-16 -22)">'
       + '<path d="' + BODY + '"/><circle cx="16" cy="19.4" r="2"/></g>'
       + '<path d="M16 ' + top + 'V' + neckTop + '" stroke-width="2.6"/>' + head;
}
var ICON = {
  /* squat: roomy body, barely any neck */
  uke:   ico(stringed(0.88, 9.6, '<rect x="13.6" y="5.6" width="4.8" height="4" rx="1"/>')),
  /* the big one: full body and a long neck */
  gtr:   ico(stringed(1.0, 4.2, '<rect x="13.2" y="1" width="5.6" height="4" rx="1"/>')),
  /* lanky: little body way down the bottom, neck the whole height */
  bass:  ico(stringed(0.62, 2.6, '<rect x="13.8" y="0.4" width="4.4" height="2.8" rx=".8"/>')),
  /* violin family: f-holes and a scroll where the headstock would be */
  gdae:  ico('<g transform="translate(16 22) scale(.84) translate(-16 -22)"><path d="' + BODY + '"/>'
           + '<path d="M12.8 17c-1 1.6-1 4 0 5.6M19.2 17c1 1.6 1 4 0 5.6"/></g>'
           + '<path d="M16 11.9V6.6" stroke-width="2.6"/>'
           + '<path d="M16.1 6.6c-.3-2.1 2.7-2.6 2.9-.5.2 1.7-2.2 2.2-3.1.8"/>'),
  /* keyboard: five whites, with the blacks grouped two-then-one like the real thing */
  pno:   ico('<rect x="3" y="9.5" width="26" height="14.5" rx="1.6"/>'
           + '<path d="M8.2 17.5V24M13.4 17.5V24M18.6 9.5V24M23.8 17.5V24" stroke-width="1.6"/>'
           + '<g fill="currentColor" stroke="none">'
           + '<rect x="6.8" y="9.5" width="2.8" height="8"/><rect x="12" y="9.5" width="2.8" height="8"/>'
           + '<rect x="22.4" y="9.5" width="2.8" height="8"/></g>'),
  /* a microphone for the singers */
  voice: ico('<rect x="12" y="3" width="8" height="14" rx="4"/>'
           + '<path d="M7.5 15a8.5 8.5 0 0 0 17 0M16 23.5V29M11.5 29h9"/>'),
  /* just looking around */
  none:  ico('<path d="M16 3.5l2.7 7.3 7.3 2.7-7.3 2.7L16 23.5l-2.7-7.3L6 13.5l7.3-2.7z"/>'
           + '<path d="M25.5 22.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>')
};

var INSTS = [
  { k:'uke',   t:'Ukulele',                   s:'Four strings, G C E A' },
  { k:'gtr',   t:'Guitar',                    s:'Six strings, acoustic or electric' },
  { k:'pno',   t:'Piano or keyboard',         s:'Black keys and white keys' },
  { k:'gdae',  t:'Fiddle, banjo or mandolin', s:'The GDAE family — trad instruments' },
  { k:'bass',  t:'Bass',                      s:'Four fat strings, holding it down' },
  { k:'voice', t:'Singing',                   s:'Your voice is the instrument' },
  { k:'none',  t:'Nothing yet',               s:"I'm just having a look around" }
];
INSTS.forEach(function (o) { o.svg = ICON[o.k]; });

/* t answers "what would you like to get better at?" on start.html;
   verb is the same goal as a thing you'd say out loud, for the
   "I want to..." strip — people look for verbs, not tool names */
var GOALS = [
  { k:'ears',   em:'👂', t:'My ears',             verb:'Train my ears',        s:'Hear a note or a chord and know what it is' },
  { k:'read',   em:'🎼', t:'Reading music',       verb:'Read music',           s:'Look at the dots on the page and know what to play' },
  { k:'rhythm', em:'🥁', t:'Rhythm and timing',   verb:'Sort out my rhythm',   s:'Counting it, feeling it, staying in time' },
  { k:'chords', em:'🎹', t:'Chords and keys',     verb:'Understand chords',    s:'Why songs sound the way they do' },
  { k:'tunes',  em:'🎵', t:'Learning tunes',      verb:'Learn a tune',         s:'Real songs I can play for someone' },
  { k:'write',  em:'✍️', t:'Making my own music', verb:'Write my own music',   s:'Writing tunes, or making them up as I go' }
];

var LEVELS = [
  { k:1, em:'🌱', t:'Just started',   s:'Weeks in — or not started yet' },
  { k:2, em:'🌿', t:'A while now',    s:'I know a few tunes and chords' },
  { k:3, em:'🌳', t:'A good while',   s:"I'm comfortable — give me the deep end" }
];

var GOAL_WORD = { ears:'training your ears', read:'reading music', rhythm:'rhythm and timing',
                  chords:'chords and keys', tunes:'learning tunes', write:'making your own music' };
var INST_WORD = { uke:'Ukulele', gtr:'Guitar', pno:'Piano', gdae:'Fiddle, banjo & mandolin',
                  bass:'Bass', voice:'Singing', none:'Just looking' };
var LEVEL_WORD = { 1:'just started', 2:'a while in', 3:'well on the way' };

/* which instrument name each reference page wants in its ?inst= */
var CHORD_INST = { gtr:'guitar', pno:'piano', gdae:'banjo', bass:'piano', voice:'piano', none:'piano' };
var FIND_INST  = { uke:'ukulele', gtr:'guitar', pno:'piano', gdae:'banjo', bass:'bass', voice:'piano', none:'piano' };

/* ══════════════════ the catalogue ══════════════════ */
var CATALOGUE = [

  /* ---- depth 1 · a game you can play right now ---- */
  { t:'In Tune?', h:'Ukulele/in-tune.html', dep:1, g:['ears'], lv:[1,2], i:['uke'],
    d:'The four strings play one by one. Your call: is the uke in tune, or is something off?' },
  { t:'Out of Tune?', h:'Ukulele/out-of-tune.html', dep:1, g:['ears'], lv:[1,2], i:['uke'],
    d:'One string has gone sour. Find it by ear — the same trick you use tuning up for real.' },
  { t:'Chord Quiz', h:'Ukulele/chord-quiz.html', dep:1, g:['chords'], lv:[1,2], i:['uke'],
    d:'A chord name pops up. Build the shape from memory, then check your work.' },
  { t:'Uke Progress', h:'Ukulele/chord-progress-uke.html', dep:1, g:['ears','chords'], lv:[2,3], i:['uke'],
    d:'A run of chords plays and the last card stays blank — name the chord you heard.' },
  { t:'What Note?', h:'Ukulele/what-note-ukulele-3frets.html', dep:1, g:['read'], lv:[1,2], i:['uke'],
    d:'A marker lands on the fretboard. Work out which note that is and tap it on the keyboard.' },

  { t:'In Tune?', h:'Guitar/in-tune-guitar.html', dep:1, g:['ears'], lv:[1,2], i:['gtr'],
    d:'Six strings, played in turn. Is the guitar in tune, or is one of them off?' },
  { t:'Out of Tune?', h:'Guitar/out-of-tune-guitar.html', dep:1, g:['ears'], lv:[1,2], i:['gtr'],
    d:'One of the six is out. Find it by ear — the ear-test you use tuning up for real.' },
  { t:'Chord Quiz', h:'Guitar/chord-quiz-guitar.html', dep:1, g:['chords'], lv:[1,2], i:['gtr'],
    d:'A chord name pops up. Build the shape by tapping frets, then check it.' },
  { t:'Guitar Progress', h:'Guitar/chord-progress-guitar.html', dep:1, g:['ears','chords'], lv:[2,3], i:['gtr'],
    d:'Chords play with their real shapes and the last one is blank — name what you heard.' },
  { t:'What Note?', h:'Guitar/what-note-guitar.html', dep:1, g:['read'], lv:[1,2], i:['gtr'],
    d:'A marker lands on the neck. Work out the note and tap it on the little keyboard.' },
  { t:'Triad Drop', h:'Guitar/triad-drop.html', dep:1, g:['chords'], lv:[3], i:['gtr'],
    d:'Slide a three-note grip up the neck to the one fret where it spells the chord you were given.' },

  { t:'Chord Catapult', h:'Piano/chord-catapult.html', dep:1, g:['chords'], lv:[1,2], i:['pno'],
    d:'Fling a note in an arc onto the keyboard and strike the keys that spell the chord.' },
  { t:'Chord Cascade', h:'Piano/chord-cascade.html', dep:1, g:['chords'], lv:[2,3], i:['pno'],
    d:"A chord's shape drops from the sky — slide the keyboard so it lands where it actually fits." },

  { t:'Pitch Invaders', h:'Ear%20Training/pitch-invaders_2.html', dep:1, g:['ears'], lv:[1,2],
    d:'Aliens fall down the lane of their note — tap the note you hear to shoot them down.' },
  { t:'Pitch Invaders — Chromatic', h:'Ear%20Training/pitch-invaders-chromatic.html', dep:1, g:['ears'], lv:[3],
    d:'All twelve notes, sharps and flats included, one new one at a time so your ear can settle.' },
  { t:'Pitch Invaders — Circle of Fifths', h:'Ear%20Training/pitch-invaders-fifths.html', dep:1, g:['ears','chords'], lv:[2,3],
    d:'Only the notes of the key fall, and the wheel spins to a new key every time you beat a boss.' },
  { t:'Chord Progress', h:'Ear%20Training/chord-progress.html', dep:1, g:['ears','chords'], lv:[2,3],
    d:'A chord progression plays with the last card blank. Name the chord you heard.' },
  { t:'Scale Climb', h:'Theory/scale-climb.html', dep:1, g:['ears','chords'], lv:[2],
    d:"Tap the scale's next note to climb a step — and stay ahead of the barrels rolling down." },

  { t:'Rhythm Zoo', h:'rhythm-zoo.html', dep:1, g:['rhythm'], lv:[1],
    d:'Every note is an animal. The gentlest way in to how long each one lasts.' },
  { t:'Bar Packer', h:'Theory/bar-packer.html', dep:1, g:['rhythm'], lv:[1,2],
    d:'Pack a bar with note blocks so it fills exactly — no gaps, no spilling over.' },
  { t:'The Missing Piece', h:'Theory/missing-piece.html', dep:1, g:['rhythm'], lv:[1,2],
    d:'A bar drawn as a jigsaw with one piece gone. Pick the note that fills the hole exactly.' },
  { t:'Fix the Plank', h:'Theory/fix-the-plank.html', dep:1, g:['rhythm'], lv:[2,3],
    d:'One plank in the bar is cracked. Rebuild its length out of smaller notes.' },
  { t:'Rhythm Runner', h:'Theory/rhythm-runner.html', dep:1, g:['rhythm'], lv:[2,3],
    d:'Read the bar of rhythm, then run it — hold for the long notes, land on the rests.' },

  { t:'Apple Shot', h:'Theory/apple-shot.html', dep:1, g:['read'], lv:[1],
    d:"Read the apple's note, draw the bow and loose it as your aim crosses that note." },
  { t:'Hidden Words', h:'Theory/hidden-words.html', dep:1, g:['read'], lv:[1],
    d:'Each note on the stave stands for a letter. Read them in turn and spell the hidden word.' },
  { t:'Note Reading', h:'Theory/note-reading.html', dep:1, g:['read'], lv:[1,2],
    d:'A note appears on the stave — name it before the clock runs down.' },
  { t:'Note Elevator', h:'Theory/note-elevator.html', dep:1, g:['read'], lv:[2],
    d:'Read the note, press its floor, send the lift there. Faster and faster as you go.' },

  /* ---- depth 2 · a proper tool ---- */
  { t:'Tuner', h:'tuner.html', dep:2, g:['ears'], lv:[1], mic:true,
    d:'Play a note and the needle shows how sharp or flat you are. Worth doing before anything else.' },
  { t:'Pitch Practice', h:'Ear%20Training/pitch-practice.html', w:10, dep:2, g:['ears'], lv:[2,3],
    d:'Pure ear training, no game. Hear a short run of notes off a home note and name what you heard.' },
  { t:'Chorale Ear Trainer', h:'chorale-ears.html', w:-8, dep:2, g:['ears','chords'], lv:[3],
    d:'Hear a few bars of real Bach and name the chords. What ears have been sharpened on for 300 years.' },

  { t:'Note Names', h:'note-names.html', w:20, dep:2, g:['read'], lv:[1],
    d:'Every Good Boy Deserves Football. The names of the notes on the stave, from scratch.' },
  { t:'Find the Note', h:'find-the-note.html', dep:2, g:['read','chords'], lv:[1,2],
    d:'Where every note lives on your own instrument — pick a note and it lights up everywhere it hides.',
    mk:function(a){ return 'find-the-note.html?inst=' + (FIND_INST[a.inst] || 'piano'); } },
  { t:'Melody Trainer', h:'melody-trainer_1.html', w:15, dep:2, g:['tunes','read'], lv:[1,2,3], mic:true,
    fav:['gdae','voice'],
    d:'Read a tune on the stave and play or sing it back. The cursor only moves when you land the right note — and 200+ trad tunes come loaded.' },
  { t:'Song Trainer', h:'song-trainer.html', dep:2, g:['tunes','chords'], lv:[1,2], fav:['uke','gtr'],
    d:'Learn a song by its chords and strumming, play along in time, then dig into the theory behind it.' },
  { t:'Jam Track', h:'jam-track.html', w:10, dep:2, g:['tunes','rhythm','write'], lv:[2,3],
    d:'Write out a chord chart, pick a style and a tempo, and a band plays it back on a loop for you to play over.' },

  { t:'Chords', h:'chords.html', w:8, dep:2, g:['chords'], lv:[1,2],
    d:'Every major and minor chord, drawn out for your instrument. Made to be printed and stuck on the wall.',
    mk:function(a){ return 'chords.html?inst=' + (CHORD_INST[a.inst] || 'piano'); } },
  { t:'Ukulele Chords', h:'ukulele-chords.html', dep:2, g:['chords'], lv:[1], i:['uke'],
    d:'Ten first chords, drawn big and clear. Enough for hundreds of songs.' },
  { t:'Scale Theory', h:'scale-theory.html', w:-10, dep:2, g:['chords'], lv:[2,3],
    d:'Every scale, why it is built the way it is, and what it sounds like on your instrument.' },
  { t:'Chord Theory', h:'chord-theory.html', w:-4, dep:2, g:['chords'], lv:[2,3],
    d:'Major, minor, diminished, augmented — how chords are stacked, and why each one has its mood.' },
  { t:'Circle of Fifths', h:'circle-of-fifths.html', w:-6, dep:2, g:['chords'], lv:[2,3],
    d:'The map of all the keys, and which chords live in each one.' },
  { t:'Blues Theory', h:'blues-theory.html', w:-15, dep:2, g:['chords','write'], lv:[3],
    d:'The blue notes — where they come from and why they sound the way they do.' },

  { t:'Song Maker', h:'composer.html', w:12, dep:2, g:['write'], lv:[1,2],
    d:"Drop chords into the bars and draw a melody. Notes in your key light up, so it's hard to hit a wrong one." },
  { t:'Song Lab', h:'songlab.html', w:10, dep:2, g:['write'], lv:[2,3],
    d:'The grown-up studio: verses, choruses and bridges, any chord you like, and a drum beat you tap out yourself.' },
  { t:'Phrasebook', h:'phrasebook.html', dep:2, g:['write'], lv:[3],
    d:'Collect the licks you love in notation, then drill them through all twelve keys and every mode.' },
  { t:'The Listening Lab', h:'listening-lab.html', w:8, dep:2, g:['write'], lv:[3], mic:true,
    d:'Solo over jazz and blues charts and the lab listens — your solo comes back written out and marked.' },
  { t:'The Charts', h:'gallery.html', w:-10, dep:2, g:['write'], lv:[1,2,3],
    d:'Listen to songs other people have built here, and vote your favourites up the charts.' },

  /* ---- depth 3 · a whole course ---- */
  { t:'Old Man and the C', h:'Theory/old-man-and-the-c.html', dep:3, g:['read'], lv:[1,2],
    d:'A seafaring note-reading tale. Read each note to reel it in and sail from the shallows out to deeper water.' },
  { t:'The Fretboard Atlas', h:'Guitar/fretboard-atlas.html', dep:3, g:['read'], lv:[1,2], i:['gtr'],
    note:'Expedition I is free',
    d:'Set out across the guitar neck with an old mapmaker and chart where every note lives, string by string.' },
  { t:'Learning to Fly', h:'learning-to-fly.html', dep:3, g:['write','ears'], lv:[2,3], mic:true,
    note:'First belt is free',
    d:'A whole course in making it up as you go — from tunes you already know, out to soloing over a groove on your own instrument.' },
  /* filed under making your own music, not under chords: it is the only
     course tagged for harmony, and it was turning up as the horizon for
     every chords plan — a ukulele beginner does not need walking bass */
  { t:'Learning to Walk', h:'learning-to-walk.html', dep:3, g:['write'], lv:[2,3], fav:['bass'],
    note:'First module is free',
    d:'Sit in with an old jazz cat and learn to walk a bassline from the ground up — barn dance to blues to a late-night club.' },
  { t:'The Counterpoint Dojo', h:'Theory/gradus-shell.html', dep:3, g:['write'], lv:[3],
    note:'First module is free',
    d:'Write a line above an old melody and have a stern master correct it note by note. The way it was taught 300 years ago.' }
];

/* ══════════════════ picking the plan ══════════════════
   Goal matters most, then whether it suits your instrument, then
   whether it is pitched at your level. One stop from each depth, so
   the plan reads as a journey: something to play now, a real tool,
   and something to grow into. */
function score(x, a) {
  if (x.i && x.i.indexOf(a.inst) < 0) return -1;          // instrument-only, and not yours
  var s = 0;
  s += (x.g.indexOf(a.goal) >= 0) ? 100 : -40;
  s += x.i ? 60 : 10;                                      // built for your instrument beats one-size-fits-all
  if (x.fav && x.fav.indexOf(a.inst) >= 0) s += 35;
  if (x.lv.indexOf(a.lvl) >= 0) s += 40;
  else {
    var gap = 9; x.lv.forEach(function (v) { gap = Math.min(gap, Math.abs(v - a.lvl)); });
    s -= 25 * gap;
  }
  s += (x.w || 0);   // the nudge that settles ties: doing beats reading about it
  return s;
}

function plan(a) {
  /* Only ever offer things that actually serve the goal they picked. If a
     depth has nothing to offer, the plan is simply shorter there and tops
     up from the rest — better than padding it with a near-miss. */
  var ranked = CATALOGUE.map(function (x) { return { x:x, s:score(x, a) }; })
                .filter(function (o) { return o.s > 0 && o.x.g.indexOf(a.goal) >= 0; })
                .sort(function (p, q) { return q.s - p.s; });
  var out = [], used = {};
  [1, 2, 3].forEach(function (d) {
    for (var i = 0; i < ranked.length; i++) {
      var o = ranked[i];
      if (o.x.dep === d && !used[o.x.t]) { used[o.x.t] = 1; out.push(o.x); return; }
    }
  });
  // nothing at some depth (rare) — top up from whatever is left, keeping the order
  for (var i = 0; i < ranked.length && out.length < 3; i++) {
    if (!used[ranked[i].x.t]) { used[ranked[i].x.t] = 1; out.push(ranked[i].x); }
  }
  out.sort(function (p, q) { return p.dep - q.dep; });

  // everything else that fits, so a good tool isn't buried just because
  // something else edged it out of the three
  var more = [];
  for (var j = 0; j < ranked.length && more.length < 5; j++) {
    if (!used[ranked[j].x.t]) { used[ranked[j].x.t] = 1; more.push(ranked[j].x); }
  }
  return { stops:out, more:more };
}

var LABELS = ['Start here', 'Then this', 'When you’re ready'];

/* the reference pages worth keeping open, for this instrument */
function corner(a) {
  var out = [], own = (a.inst !== 'none' && a.inst !== 'voice'), ic = ICON[a.inst] || '';
  if (a.inst === 'uke') out.push({ t:'Ukulele chords', h:'ukulele-chords.html', ic:ic });
  else if (own) out.push({ t:'Chord shapes', h:'chords.html?inst=' + (CHORD_INST[a.inst] || 'piano'), ic:ic });
  if (own) out.push({ t:'Where the notes live', h:'find-the-note.html?inst=' + FIND_INST[a.inst], ic:ic });
  out.push({ t:'Tuner', h:'tuner.html' });
  out.push({ t:'Circle of fifths', h:'circle-of-fifths.html' });
  return out;
}

/* ---------- everything that serves one goal, for the "I want to..." strip ----------
   With no saved answers we can't know their instrument, so instrument-only
   games are left out rather than offering uke chords to a piano player.
   Once they have answered the three questions, this quietly gets better. */
function forGoal(goal, a) {
  a = a || {};
  var known = !!a.inst && a.inst !== 'none';
  var ans = { inst: known ? a.inst : 'none', goal: goal, lvl: a.lvl || 2 };
  return CATALOGUE
    .filter(function (x) {
      if (x.g.indexOf(goal) < 0) return false;
      if (x.i && !known) return false;
      if (x.i && x.i.indexOf(ans.inst) < 0) return false;
      return true;
    })
    .map(function (x) { return { x:x, s:score(x, ans) }; })
    .sort(function (p, q) { return (p.x.dep - q.x.dep) || (q.s - p.s); })
    .map(function (o) { return o.x; });
}

function href(x, a) { return x.mk ? x.mk(a || { inst:'none' }) : x.h; }

/* the three answers, shared by every page that wants to be a bit smarter */
var KEY = 'ma.start.v1';
function remember(v) {
  if (v) { try { localStorage.setItem(KEY, JSON.stringify({ inst:v.inst, goal:v.goal, lvl:v.lvl, at:Date.now() })); } catch (e) {} return v; }
  try {
    var got = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (got && got.inst && got.goal && got.lvl) return got;
  } catch (e) {}
  return null;
}
function forget() { try { localStorage.removeItem(KEY); } catch (e) {} }

window.MATools = {
  GOALS:GOALS, INSTS:INSTS, LEVELS:LEVELS, CATALOGUE:CATALOGUE, ICON:ICON,
  GOAL_WORD:GOAL_WORD, INST_WORD:INST_WORD, LEVEL_WORD:LEVEL_WORD,
  CHORD_INST:CHORD_INST, FIND_INST:FIND_INST,
  score:score, plan:plan, forGoal:forGoal, href:href, corner:corner, LABELS:LABELS,
  remember:remember, forget:forget
};
})();
