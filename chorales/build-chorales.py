#!/usr/bin/env python3
"""Export a collection of J.S. Bach chorales (public domain) to chorales.json
for the chorale ear-trainer. Needs music21 (pip install music21); the chorales
ship inside music21's corpus, so no other download is required.

    python3 chorales/build-chorales.py [N]

Each chorale -> { id, title, key, tonicPc, mode, meter:[num,den], quarters,
measures, voices:[SATB][ [midi, offset, dur], ... ] }  (offset/dur in quarter
notes, ties stripped). Bach died 1750, so these are public domain worldwide.
"""
import json, os, re, sys
from music21 import corpus, chord as m21chord, roman
from music21.corpus import chorales

MAJOR_PAL = {"I","ii","iii","IV","V","vi","viio"}
MINOR_PAL = {"i","iio","III","iv","v","V","VI","VII","viio"}

def analyze_beats(voices, k, meter, measure_offsets, quarters, mode):
    """One vertical sonority per quarter-beat -> Roman numeral vs the key.
    Returns [ [q, roman, invFig, clean(0/1), diatonic(0/1)], ... ]
      invFig = figured-bass inversion suffix ('', '6', '64', '7', '65', '43', '42')."""
    pal = MINOR_PAL if mode == "minor" else MAJOR_PAL
    mo = list(measure_offsets) + [quarters]
    offs = []
    for i in range(len(measure_offsets)):
        q = mo[i]
        while q < mo[i+1] - 1e-6:
            offs.append(round(q, 4)); q += 1.0
    out = []
    for q in offs:
        midis = []
        for v in voices:
            for m, o, d in v:
                if o - 1e-6 <= q < o + d - 1e-6:
                    midis.append(m); break
        uniq = sorted(set(midis))
        if len(uniq) < 2:
            out.append([q, "", "", 0, 0]); continue
        ch = m21chord.Chord(uniq)
        try:
            rn = roman.romanNumeralFromChord(ch, k); ra = rn.romanNumeralAlone
        except Exception:
            out.append([q, "", "", 0, 0]); continue
        clean = 1 if (ch.isTriad() or ch.isSeventh()) else 0
        diat = 1 if ra in pal else 0
        is7 = ch.isSeventh()
        try: inv = rn.inversion()
        except Exception: inv = 0
        invfig = ({0:"7",1:"65",2:"43",3:"42"}.get(inv, "7") if is7
                  else {0:"",1:"6",2:"64"}.get(inv, ""))
        out.append([q, ra, invfig, clean, diat])
    return out

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "chorales.json")
WANT = int(sys.argv[1]) if len(sys.argv) > 1 else 30

def voice_events(part):
    ev = []
    for n in part.stripTies().flatten().notes:
        ql = float(n.quarterLength)
        if ql <= 0: continue                      # skip grace notes
        pitch = n.pitches[-1] if n.isChord else n.pitch     # SATB parts are monophonic
        ev.append([pitch.midi, round(float(n.offset), 4), round(ql, 4)])
    return ev

def build_one(fn):
    s = corpus.parse(fn)
    parts = s.parts
    if len(parts) != 4:
        return None
    k = s.analyze("key")
    tsl = s.recurse().getElementsByClass("TimeSignature")
    ts = tsl[0] if tsl else None
    voices = [voice_events(p) for p in parts]
    if any(len(v) == 0 for v in voices):
        return None
    end = max(max(o + d for _, o, d in v) for v in voices)
    measure_offsets = [round(float(m.offset), 4) for m in parts[0].getElementsByClass("Measure")]
    m = re.search(r"bwv(\d+\w*)", str(fn), re.I)
    bwv = m.group(1) if m else str(fn)
    title = (s.metadata.title if s.metadata and s.metadata.title else "")
    return {
        "id": f"bwv{bwv}",
        "title": f"BWV {bwv}" + (f" (Riemenschneider {title})" if title else ""),
        "key": f"{k.tonic.name} {k.mode}",
        "tonicPc": k.tonic.pitchClass,
        "mode": k.mode,
        "meter": [ts.numerator, ts.denominator] if ts else [4, 4],
        "quarters": round(float(end), 4),
        "measures": len(measure_offsets),
        "measureOffsets": measure_offsets,
        "beats": analyze_beats(voices, k, [ts.numerator, ts.denominator] if ts else [4, 4],
                               measure_offsets, round(float(end), 4), k.mode),
        "voices": voices,
    }

def main():
    print("Scanning Bach chorales in the music21 corpus…", file=sys.stderr)
    fns = list(chorales.Iterator(numberingSystem="bwv", returnType="filename"))
    out, seen = [], set()
    for fn in fns:
        if len(out) >= WANT: break
        try:
            c = build_one(fn)
        except Exception as e:
            continue
        if not c or c["id"] in seen: continue
        seen.add(c["id"]); out.append(c)
        print(f"  {len(out):2d}. {c['id']}  {c['key']}  {c['meter'][0]}/{c['meter'][1]}  "
              f"{c['measures']} bars, {sum(len(v) for v in c['voices'])} notes", file=sys.stderr)
    json.dump({"source": "J.S. Bach chorales (public domain), via the music21 corpus",
               "count": len(out), "chorales": out},
              open(OUT, "w"), separators=(",", ":"))
    kb = os.path.getsize(OUT) / 1024
    print(f"\nwrote {OUT}: {len(out)} chorales, {kb:.0f} KB", file=sys.stderr)

if __name__ == "__main__":
    main()
