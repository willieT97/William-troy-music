/* Music Arcade — shared pitch-detection core (McLeod Pitch Method).
   Used by the Listening Lab tool and the Learning to Fly course labs.
   Pure functions only — each page runs its own mic loop and capture logic. */
(function (global) {
  'use strict';
  var NOTES12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FFT = 2048, CLARITY_MIN = 0.86, RMS_MIN = 0.008, KT = 0.9;

  function detectPitch(buf, sr) {
    var SIZE = buf.length, rms = 0, i;
    for (i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < RMS_MIN) return { freq: -1, clarity: 0, rms: rms };
    var maxLag = SIZE >> 1, nsdf = new Float32Array(maxLag), tau;
    for (tau = 0; tau < maxLag; tau++) {
      var acf = 0, m = 0;
      for (i = 0; i < SIZE - tau; i++) { var a = buf[i], b = buf[i + tau]; acf += a * b; m += a * a + b * b; }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }
    tau = 0; while (tau < maxLag - 1 && nsdf[tau] > 0) tau++;
    var peaks = [];
    while (tau < maxLag - 1) {
      if (nsdf[tau] > 0) {
        var mT = tau, mV = nsdf[tau];
        while (tau < maxLag - 1 && nsdf[tau] > 0) { if (nsdf[tau] > mV) { mV = nsdf[tau]; mT = tau; } tau++; }
        peaks.push([mT, mV]);
      } else tau++;
    }
    if (!peaks.length) return { freq: -1, clarity: 0, rms: rms };
    var gMax = 0; for (i = 0; i < peaks.length; i++) if (peaks[i][1] > gMax) gMax = peaks[i][1];
    var thr = KT * gMax, chosen = peaks[0];
    for (i = 0; i < peaks.length; i++) { if (peaks[i][1] >= thr) { chosen = peaks[i]; break; } }
    var pt = chosen[0], bt = pt;
    if (pt > 0 && pt < maxLag - 1) {
      var x1 = nsdf[pt - 1], x2 = nsdf[pt], x3 = nsdf[pt + 1], d = x1 - 2 * x2 + x3;
      if (d !== 0) bt = pt + 0.5 * (x1 - x3) / d;
    }
    return { freq: sr / bt, clarity: chosen[1], rms: rms };
  }

  function freqToMidi(f) { return Math.round(69 + 12 * Math.log2(f / 440)); }

  global.ListenCore = { NOTES12: NOTES12, FFT: FFT, CLARITY_MIN: CLARITY_MIN, RMS_MIN: RMS_MIN, KT: KT,
    detectPitch: detectPitch, freqToMidi: freqToMidi };
})(window);
