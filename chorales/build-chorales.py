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
from music21 import corpus
from music21.corpus import chorales

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
