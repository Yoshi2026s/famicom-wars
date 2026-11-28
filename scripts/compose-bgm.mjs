// Original soundtrack for スマホウォーズ: seven new pieces for a symphonic rock band
// (brass lead, overdriven power chords, bass, strings, timpani and drums), rendered to MP3.
// Phone-speaker rules learnt in play-testing: plain triads only (no held notes a semitone apart),
// no vibrato or wide detune (it warbles), band-limited voices and a gentle top end, brisk tempos.
import {writeFileSync} from 'node:fs';
import {Mp3Encoder} from '@breezystack/lamejs';

const sampleRate = 44100;
const tau = 2 * Math.PI;
// Highest partial a voice may contain, so nothing aliases or sounds shrill.
const ceilingHz = 6500;

const names = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
/** "C#5" -> MIDI number. */
function midi(name) {
  const [, letter, octave] = name.match(/^([A-G][#b]?)(-?\d)$/);
  return (Number(octave) + 1) * 12 + names[letter];
}
/** A melody written as "D5:1.5 A4:.5 r:1 ..." -> [[offset, beats, midi], ...]. */
function line(text) {
  let at = 0;
  const notes = [];
  for (const token of text.trim().split(/\s+/)) {
    const [name, length] = token.split(':');
    const beats = Number(length);
    if (name !== 'r') notes.push([at, beats, midi(name)]);
    at += beats;
  }
  return notes;
}
/** One 4/4 bar of melody. */
function bar(text) {
  const notes = line(text);
  const [at, beats] = notes.at(-1) ?? [0, 0];
  if (!/r:[\d.]+$/.test(text.trim()) && Math.abs(at + beats - 4) > 1e-6) throw new Error(`Bar is not 4 beats: ${text}`);
  return notes;
}
/** Chord symbol -> root pitch class and triad pitch classes. */
function chord(symbol) {
  const minor = symbol.endsWith('m');
  const root = names[minor ? symbol.slice(0, -1) : symbol];
  return {root, tones: [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12]};
}
/** Close triad from E3 upward, leaving out tones a semitone from a held melody note. */
function voicing(tones, held = [], from = 52, count = 4) {
  const voices = [];
  for (let pitch = from; voices.length < count; pitch++) if (tones.includes(pitch % 12)) voices.push(pitch);
  return voices.filter(pitch => !held.some(note => [1, 11].includes(Math.abs(note - pitch) % 12)));
}
/** A chord tone a third to a sixth below the tune, or nothing. */
function harmonyBelow(pitch, tones) {
  for (let candidate = pitch - 3; candidate > pitch - 10; candidate--) if (tones.includes(candidate % 12)) return candidate;
  return null;
}

// Additive voices: each partial is kept below ceilingHz.
function partials(phase, frequency, weights) {
  let sum = 0;
  for (let n = 1; n <= weights.length; n++) {
    if (n * frequency > ceilingHz) break;
    sum += weights[n - 1] * Math.sin(n * phase);
  }
  return sum;
}
const saw = Array.from({length: 24}, (_, i) => 1 / (i + 1));
const instruments = {
  // Brass lead: bright attack that settles, like a section of trumpets.
  brass: {attack: .025, release: .14, wave: (p, t, f) => {
    const settle = .55 + .45 * Math.exp(-6 * t);
    return partials(p, f, [1, .62, .46 * settle, .34 * settle, .24 * settle, .16 * settle, .1 * settle, .06 * settle]) * .62;
  }},
  // Warm French horn for lyrical lines and doubling an octave below.
  horn: {attack: .04, release: .18, wave: (p, t, f) => partials(p, f, [1, .48, .22, .1, .05]) * .8},
  // Strings: two very slightly spread saw voices, no vibrato.
  strings: {attack: .09, release: .3, wave: (p, t, f) =>
    (partials(p * .999, f, saw.slice(0, 10)) + partials(p * 1.001, f, saw.slice(0, 10))) * .32},
  // Short string stabs and arpeggios.
  pizz: {attack: .006, release: .09, wave: (p, t, f) => partials(p, f, [1, .5, .28, .14, .07]) * Math.exp(-7 * t) * .9},
  // Overdriven power-chord voice (rendered per note; the chord is root, fifth and octave).
  drive: {attack: .004, release: .06, wave: (p, t, f) => Math.tanh(2.2 * partials(p, f, saw.slice(0, 12))) * .55},
  // Electric bass: round fundamental with enough upper partials to carry on small speakers.
  bass: {attack: .008, release: .07, wave: (p, t, f) => Math.tanh(1.5 * partials(p, f, [1, .55, .32, .18, .1])) * .85},
  // Timpani: tuned membrane partials, quick decay.
  timpani: {attack: .003, release: .25, wave: (p, t) =>
    (Math.sin(p) + .45 * Math.sin(1.504 * p) * Math.exp(-3 * t) + .25 * Math.sin(1.992 * p) * Math.exp(-4 * t)) * Math.exp(-3.2 * t)},
  // Glockenspiel sparkle, used sparingly.
  bell: {attack: .003, release: .3, wave: (p, t, f) => (Math.sin(p) + .25 * (2.76 * f < ceilingHz ? Math.sin(2.76 * p) : 0)) * Math.exp(-4 * t)},
};

function synthesizer(bpm, beats, loop) {
  const beat = 60 / bpm;
  const length = Math.round(beats * beat * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let seed = 9627;

  function add(start, duration, pan, signal) {
    const offset = Math.round(start * beat * sampleRate);
    const frames = Math.min(Math.round(duration * sampleRate), loop ? length : length - offset);
    const balance = (pan + 1) * Math.PI / 4;
    const l = Math.cos(balance);
    const r = Math.sin(balance);
    for (let i = 0; i < frames; i++) {
      const sample = signal(i / sampleRate);
      const at = (offset + i) % length;
      left[at] += sample * l;
      right[at] += sample * r;
    }
  }

  function note(start, beats, pitch, gain, voice, pan = 0) {
    const {attack, release, wave} = instruments[voice];
    const duration = beats * beat + release;
    const frequency = 440 * 2 ** ((pitch - 69) / 12);
    const radians = tau * frequency;
    add(start, duration, pan, t => gain * Math.min(1, t / attack, (duration - t) / release) * wave(radians * t, t, frequency));
  }

  function drum(start, kind, gain, pan = 0) {
    const duration = {kick: .32, snare: .26, hat: .05, open: .22, tom: .4, crash: 1.6}[kind];
    let low = 0;
    let band = 0;
    add(start, duration, pan, t => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2 ** 31 - 1;
      low += .2 * (noise - low);
      const bright = noise - low;
      band += .45 * (bright - band);
      const shape = {
        // Punchy kick: pitch drop from ~150 Hz with a soft click.
        kick: Math.sin(tau * (50 * t + 2.6 * (1 - Math.exp(-t * 32)))) * Math.exp(-9 * t) * 1.2 + .12 * band * Math.exp(-90 * t),
        // Snare: tuned body plus a short, darkened rattle.
        snare: .55 * Math.sin(tau * 185 * t) * Math.exp(-22 * t) + .7 * band * Math.exp(-16 * t) + .25 * low * Math.exp(-12 * t),
        // Hi-hats kept soft and band-limited (no sizzle above the mastering roll-off).
        hat: band * Math.exp(-70 * t),
        open: band * Math.exp(-14 * t),
        tom: Math.sin(tau * (95 * t + 1.6 * (1 - Math.exp(-t * 20)))) * Math.exp(-7 * t) + .12 * band * Math.exp(-30 * t),
        crash: (.6 * band + .2 * low) * Math.exp(-2.2 * t),
      }[kind];
      return gain * shape * Math.min(1, t / .002) * Math.min(1, (duration - t) / .02);
    });
  }

  return {channels: [left, right], note, drum, beatSeconds: beat};
}

/**
 * Arranges a piece from bars of [chord, melody] and sections [firstBar, energy (0-2), lead voice].
 * Energy 0: pads, light drums. 1: driving band. 2: full band, brass harmony, timpani and crashes.
 */
function arrange(piece) {
  const {bpm, bars, sections, groove = 'rock', dark = false} = piece;
  const {channels, note, drum} = synthesizer(bpm, bars.length * 4, true);
  const sectionAt = index => sections.filter(([first]) => first <= index).at(-1);
  for (const [index, [symbol, melody]] of bars.entries()) {
    const start = index * 4;
    const {root, tones} = chord(symbol);
    const [first, energy, lead] = sectionAt(index);
    const next = sections.find(([at]) => at > index)?.[0] ?? bars.length;
    const sectionStart = index === first;
    const sectionEnd = index === next - 1;
    // Energy of the section that follows (the loop wraps to the first one).
    const upcoming = sectionAt(next % bars.length)[1];
    const held = melody.filter(([, beats]) => beats >= .5).map(([, , pitch]) => pitch);
    const pad = voicing(tones, held);
    const bassRoot = 36 + root; // C2..B2

    // Drums.
    if (energy === 0) {
      drum(start, 'kick', .5);
      drum(start + 2, 'kick', .38);
      for (const step of [1, 3]) drum(start + step, 'snare', .22, -.1);
      for (let step = 0; step < 4; step++) drum(start + step + .5, 'hat', .06, .35);
    } else {
      const kicks = groove === 'march' ? [0, 2, 2.5] : groove === 'drive' ? [0, .75, 1.5, 2, 2.75, 3.5] : [0, 1.5, 2, 2.75];
      for (const step of kicks) drum(start + step, 'kick', .62);
      for (const step of [1, 3]) drum(start + step, 'snare', .5, -.1);
      for (let step = 0; step < 8; step++) drum(start + step / 2, step % 2 ? 'hat' : 'hat', step % 2 ? .07 : .045, .35);
      if (energy === 2) drum(start + 3.5, 'open', .05, .35);
      // Double-kick burst into the next bar when the full band is playing.
      if (energy === 2 && groove === 'drive') for (const step of [3.25, 3.75]) drum(start + step, 'kick', .48);
      if (groove === 'march') for (const step of [3.25, 3.75]) drum(start + step, 'snare', .2, -.1);
    }
    if (sectionStart && energy > 0) drum(start, 'crash', energy === 2 ? .19 : .14, .4);
    if (sectionStart && energy === 2) drum(start, 'crash', .12, -.4);
    if (sectionEnd && upcoming === 2 && energy < 2) {
      // Snare build-up: sixteenths swelling over the last two beats, into the climax.
      for (let i = 0; i < 8; i++) drum(start + 2 + i / 4, 'snare', .14 + i * .045, -.1);
      note(start + 3, 1, 41 + ((root + 7) % 12), .16, 'timpani', -.2);
      note(start + 3.5, .5, 41 + ((root + 7) % 12), .2, 'timpani', -.2);
    } else if (sectionEnd && energy > 0) {
      [[2, 0], [2.5, .3], [3, .6], [3.5, .9]].forEach(([step, rise], i) => drum(start + step, 'tom', .4, -.4 + rise));
    }

    // Bass.
    if (energy === 0) {
      note(start, 1.9, bassRoot, .2, 'bass');
      note(start + 2, 1.9, bassRoot, .17, 'bass');
    } else {
      const steps = groove === 'drive' ? 16 : 8;
      for (let i = 0; i < steps; i++) {
        const length = 4 / steps;
        // Root and octave, with the fifth leading into the next bar.
        const octave = groove === 'drive' ? (i % 4 === 2 ? 12 : 0) : (i % 2 ? 12 : 0);
        const lift = i === steps - 1 ? 7 : octave;
        note(start + i * length, length * .8, bassRoot + lift, (i % 2 ? .14 : .19), 'bass');
      }
    }

    // Power chords: palm-muted eighths, with a ringing chord at each section start.
    if (energy > 0) {
      const low = 40 + ((root - 4 + 12) % 12); // E2..Eb3
      // Climax: a galloping eighth-and-two-sixteenths rhythm; otherwise steady eighths.
      const hits = energy === 2
        ? [0, .5, .75, 1, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5, 3.75]
        : [0, .5, 1, 1.5, 2, 2.5, 3, 3.5];
      for (const at of hits) {
        const accent = at === 0 || at === 1.5 || at === 3;
        const length = accent ? .42 : at % .5 ? .14 : .22;
        for (const [interval, level] of [[0, 1], [7, .8], [12, .55]]) {
          note(start + at, length, low + interval, (accent ? .05 : .03) * level, 'drive', interval ? -.55 : .55);
        }
      }
    }
    // Orchestral hit opening the climax: brass chord, timpani and low strings together.
    if (sectionStart && energy === 2) {
      pad.forEach((pitch, i) => note(start, .75, pitch + 12, .06, 'brass', (i - 1.5) * .4));
      note(start, 1.5, bassRoot, .06, 'strings', 0);
    }

    // Strings: sustained pad, plus a quick arpeggio figure when the band is driving.
    pad.forEach((pitch, i) => note(start, 3.85, pitch + (i > 1 ? 12 : 0), energy === 0 ? .05 : .035, 'strings', (i - 1.5) * .5));
    if (energy > 0) {
      const figure = [0, 1, 2, 1, 2, 3, 2, 1];
      figure.forEach((voice, i) => {
        const pitch = pad[voice % pad.length] + 12;
        note(start + i * .5, .35, pitch, .045, 'pizz', i % 2 ? .45 : -.45);
      });
    }

    // Timpani on downbeats of big sections.
    if (energy === 2 || sectionStart) note(start, 1, 41 + ((root + 7) % 12), .22, 'timpani', -.2);

    // The tune.
    for (const [offset, beats, pitch] of melody) {
      const at = start + offset;
      note(at, beats, pitch, .16, lead, -.08);
      if (energy >= 1) note(at + .01, beats, pitch - 12, .07, 'horn', .3);
      if (energy === 2) note(at + .02, beats, pitch - 12, .045, 'strings', -.35);
      if (energy === 2 && beats >= .5) {
        const second = harmonyBelow(pitch, tones);
        if (second !== null) note(at + .015, beats, second, .07, 'brass', .4);
      }
      // While the tune holds a long note, the brass section answers with short chord stabs.
      if (energy >= 1 && beats >= 2) {
        for (const stab of [1.5, 2]) {
          if (stab + .5 > beats) continue;
          voicing(tones, [pitch], 55, 3).forEach((tone, i) => note(at + stab, .3, tone, .045, 'brass', (i - 1) * .5));
        }
      }
    }
    // Answer phrase in the rest at the end of a bar.
    const [lastAt, lastBeats] = melody.at(-1) ?? [0, 0];
    if (energy >= 1 && 4 - (lastAt + lastBeats) >= 1) {
      const [low3, mid3, high3] = voicing(tones, [], 60, 3);
      [[3, low3], [3.25, mid3], [3.5, high3]].forEach(([step, tone]) => note(start + step, .4, tone, .07, 'brass', .25));
    }
    if (energy === 2 && !dark && index % 2 === 0) note(start + 2, .5, pad[pad.length - 1] + 24, .03, 'bell', .5);
  }
  return channels;
}

/** Short fanfares for victory and defeat: tune over held chords with timpani. */
function arrangeFinale({bpm, beats, tune, chords, lead, fanfare = false}) {
  const {channels, note, drum} = synthesizer(bpm, beats, false);
  const melody = line(tune);
  for (const [start, length, symbol] of chords) {
    const {root, tones} = chord(symbol);
    const held = melody.filter(([at, b]) => b >= .5 && at < start + length && at + b > start).map(([, , p]) => p);
    note(start, length, 36 + root, .2, 'bass');
    voicing(tones, held).forEach((pitch, i) => note(start, length, pitch + (i > 1 ? 12 : 0), .05, 'strings', (i - 1.5) * .5));
    note(start, 1, 41 + ((root + 7) % 12), .22, 'timpani', -.2);
  }
  for (const [start, length, pitch] of melody) {
    note(start, length, pitch, .17, lead, -.1);
    note(start + .01, length, pitch - 12, .08, 'horn', .3);
  }
  drum(0, 'crash', .1, .4);
  if (fanfare) {
    for (let i = 0; i < 12; i++) drum(i / 4, 'snare', .1 + i * .02, -.1);
    for (const [start] of chords) drum(start, 'kick', .55);
    const last = chords.at(-1)[0];
    drum(last, 'crash', .18, .4);
    drum(last, 'crash', .12, -.4);
  }
  return channels;
}


// Concert-hall reverb (Schroeder combs and allpasses). Loops run twice so the tail wraps around the seam.
function hall([left, right], loop, wet = .11) {
  const length = left.length;
  const out = [];
  for (const [channel, spread] of [[left, 0], [right, 23]]) {
    const input = loop ? Float32Array.from({length: length * 2}, (_, i) => channel[i % length]) : channel;
    const mix = new Float32Array(input.length);
    for (const delay of [1557, 1617, 1491, 1422, 1277, 1356]) {
      const size = Math.round((delay + spread) * 1.6);
      const buffer = new Float32Array(size);
      let index = 0;
      let damp = 0;
      for (let i = 0; i < input.length; i++) {
        const value = buffer[index];
        damp = value * .5 + damp * .5;
        buffer[index] = input[i] + damp * .7;
        mix[i] += value;
        index = (index + 1) % size;
      }
    }
    for (const delay of [556, 441, 341, 225]) {
      const size = delay + spread;
      const buffer = new Float32Array(size);
      let index = 0;
      for (let i = 0; i < mix.length; i++) {
        const delayed = buffer[index];
        const value = -mix[i] + delayed;
        buffer[index] = mix[i] + delayed * .5;
        mix[i] = value;
        index = (index + 1) % size;
      }
    }
    const offset = loop ? length : 0;
    out.push(Float32Array.from(channel, (sample, i) => sample + mix[i + offset] * wet / 6));
  }
  return out;
}


// Gentle mastering EQ (RBJ biquads): phone speakers exaggerate 2-5 kHz, so tame that range and the
// top end, and add a little low-mid warmth. Loops are filtered twice round so the seam stays clean.
function biquad(type, frequency, gain, q) {
  const a = 10 ** (gain / 40);
  const w = tau * frequency / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const root = 2 * Math.sqrt(a) * alpha;
  const [b0, b1, b2, a0, a1, a2] = type === 'peak'
    ? [1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a]
    : [a * ((a + 1) + (a - 1) * cos + root), -2 * a * ((a - 1) + (a + 1) * cos), a * ((a + 1) + (a - 1) * cos - root),
      (a + 1) - (a - 1) * cos + root, 2 * ((a - 1) - (a + 1) * cos), (a + 1) - (a - 1) * cos - root];
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
const mastering = [biquad('peak', 300, 2, .7), biquad('peak', 2800, -7, .7), biquad('shelf', 5500, -8, .7)];
function soften(channel, loop) {
  let signal = loop ? Float32Array.from({length: channel.length * 2}, (_, i) => channel[i % channel.length]) : channel;
  for (const [b0, b1, b2, a1, a2] of mastering) {
    const out = new Float32Array(signal.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < signal.length; i++) {
      const y = b0 * signal[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = signal[i]; y2 = y1; y1 = y;
      out[i] = y;
    }
    signal = out;
  }
  return loop ? signal.slice(channel.length) : signal;
}

function encode([left, right], loop, bitrate = 112, ceiling = .91) {
  left = soften(left, loop);
  right = soften(right, loop);
  const room = [[.031,.11],[.061,.088],[.104,.062],[.157,.038],[.214,.024]]
    .map(([delay, gain]) => [Math.round(delay * sampleRate), gain]);
  let power = 0;
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    power += left[i] ** 2 + right[i] ** 2;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const rms = Math.sqrt(power / (2 * left.length));
  const level = Math.min(.18 / rms, ceiling / peak, 2.8);
  const fadeLength = Math.round(.010 * sampleRate);
  function master(dry, other) {
    return Int16Array.from(dry, (sample, i) => {
      let wet = 0;
      for (const [delay, gain] of room) {
        const j = i - delay;
        if (j >= 0) wet += gain * other[j];
        else if (loop) wet += gain * other[j + dry.length];
      }
      // Loops wrap seamlessly, so only the one-shot finales fade at their edges.
      const fade = loop ? 1 : Math.min(1, i / fadeLength, (dry.length - 1 - i) / fadeLength);
      return Math.round(Math.tanh((sample + wet) * level) * fade * 30100);
    });
  }
  const pcmLeft = master(left, right);
  const pcmRight = master(right, left);
  const encoder = new Mp3Encoder(2, sampleRate, bitrate);
  const frames = [];
  for (let i = 0; i < left.length; i += 1152) {
    frames.push(Buffer.from(encoder.encodeBuffer(pcmLeft.subarray(i, i + 1152), pcmRight.subarray(i, i + 1152))));
  }
  frames.push(Buffer.from(encoder.flush()));
  return Buffer.concat(frames);
}

// Pieces: each bar is "Chord | melody". Sections are [first bar, energy, lead voice].
const piece = (rows) => rows.trim().split('\n').map(row => {
  const [symbol, melody] = row.split('|').map(part => part.trim());
  return [symbol, bar(melody)];
});
const pieces = [
  {name: 'bgm-title', bpm: 116, sections: [[0, 0, 'horn'], [4, 1, 'brass'], [8, 2, 'brass']], bars: piece(`
    G  | G4:1.5 D5:.5 D5:1 B4:1
    D  | A4:1.5 F#4:.5 A4:1 D5:1
    Em | E5:1.5 D5:.5 B4:1 G4:1
    C  | C5:1 E5:1 G5:2
    G  | G5:1.5 E5:.5 D5:1 B4:1
    D  | A4:1 D5:1 F#5:1 A5:1
    C  | G5:1.5 E5:.5 C5:1 E5:1
    D  | F#5:2 A5:1 r:1
    C  | G5:1.5 E5:.5 C5:1 G4:1
    D  | A4:1.5 D5:.5 F#5:1 A5:1
    Bm | B5:1.5 A5:.5 F#5:1 D5:1
    Em | E5:1 G5:1 B5:2
    C  | C6:1.5 A5:.5 G5:1 E5:1
    D  | D5:1 F#5:1 A5:1 D6:1
    G  | B5:3 A5:.5 G5:.5
    G  | G5:2 D5:1 r:1`)},
  {name: 'bgm-map', bpm: 132, sections: [[0, 1, 'brass'], [8, 0, 'horn'], [16, 2, 'brass']], bars: piece(`
    D  | D5:1.5 A4:.5 D5:.5 E5:.5 F#5:1
    A  | E5:1.5 C#5:.5 A4:1 E5:1
    Bm | F#5:1 D5:.5 E5:.5 F#5:1 B5:1
    G  | B5:1.5 G5:.5 D5:2
    D  | D5:1.5 A4:.5 D5:.5 E5:.5 F#5:1
    A  | E5:1 A5:1 C#6:1 A5:1
    G  | B5:1.5 A5:.5 G5:1 D5:1
    A  | C#5:.5 E5:.5 A5:2 r:1
    Bm | F#5:2 D5:1 B4:1
    G  | D5:1.5 B4:.5 G4:2
    D  | A4:1 D5:1 F#5:2
    A  | E5:3 C#5:1
    Bm | B4:1 D5:1 F#5:1 B5:1
    G  | B5:2 G5:1 D5:1
    Em | E5:1 G5:1 B5:1 G5:1
    A  | A5:2 E5:1 C#5:1
    G  | D6:1.5 B5:.5 G5:1 B5:1
    A  | C#6:1.5 A5:.5 E5:1 A5:1
    F#m| C#6:1 A5:.5 F#5:.5 A5:1 C#6:1
    Bm | D6:2 B5:1 F#5:1
    G  | D6:1.5 B5:.5 G5:1 B5:1
    A  | E6:1.5 C#6:.5 A5:2
    D  | D6:3 A5:1
    A  | E5:.5 F#5:.5 G5:.5 A5:.5 C#6:1 E5:1`)},
  {name: 'bgm-enemy-map', bpm: 126, groove: 'drive', dark: true, sections: [[0, 1, 'brass'], [8, 2, 'brass']], bars: piece(`
    Cm | C5:1.5 G4:.5 C5:1 Eb5:1
    Cm | Eb5:1 G5:1 Eb5:1 C5:1
    Ab | C5:1.5 Eb5:.5 Ab5:2
    Bb | F5:1 D5:1 Bb4:1 D5:1
    Cm | G5:1.5 Eb5:.5 C5:1 G5:1
    Cm | Eb5:1 D5:.5 C5:.5 G4:2
    Ab | Ab4:1 C5:1 Eb5:1 Ab5:1
    G  | G5:2 D5:1 B4:1
    Fm | F5:1.5 Ab5:.5 C6:2
    Cm | C6:1 G5:1 Eb5:2
    Ab | Eb5:1 Ab5:1 C6:1 Ab5:1
    Bb | Bb5:1.5 F5:.5 D5:2
    Fm | C6:1.5 Ab5:.5 F5:1 Ab5:1
    G  | B5:1.5 G5:.5 D5:1 G5:1
    Cm | C6:3 G5:1
    G  | D5:.5 F5:.5 G5:1 B5:2`)},
  {name: 'bgm-battle', bpm: 160, groove: 'drive', sections: [[0, 1, 'brass'], [8, 2, 'brass']], bars: piece(`
    Am | A4:.5 C5:.5 E5:1 A5:2
    F  | A5:.5 G5:.5 F5:1 C5:2
    G  | B4:.5 D5:.5 G5:1 D5:2
    Em | E5:1.5 G5:.5 B5:2
    Am | C6:1.5 B5:.5 A5:1 E5:1
    F  | F5:1 A5:1 C6:2
    G  | B5:1.5 A5:.5 G5:1 D5:1
    E  | E5:1 G#5:1 B5:2
    F  | C6:1.5 A5:.5 F5:2
    G  | D6:1.5 B5:.5 G5:2
    Em | E6:1.5 D6:.5 B5:1 G5:1
    Am | A5:3 E5:1
    F  | F5:1 A5:1 C6:1 F6:1
    G  | D6:1 B5:1 G5:1 D6:1
    E  | E6:2 B5:1 G#5:1
    E  | B5:.5 A5:.5 G#5:.5 F#5:.5 E5:2`)},
  {name: 'bgm-enemy-battle', bpm: 164, groove: 'drive', dark: true, sections: [[0, 1, 'brass'], [8, 2, 'brass']], bars: piece(`
    Dm | A4:1 D5:.5 E5:.5 F5:1 A5:1
    Bb | Bb5:1.5 G5:.5 F5:1 D5:1
    C  | E5:1 G5:1 C6:1.5 G5:.5
    A  | A5:2 C#5:1 E5:1
    Dm | F5:1.5 E5:.5 D5:1 A5:1
    Bb | D5:1 F5:1 Bb5:2
    Gm | G5:1.5 Bb5:.5 D6:2
    A  | C#6:2 A5:1 E5:1
    Dm | D6:1.5 C6:.5 A5:1 F5:1
    Bb | F5:1 Bb5:1 D6:2
    C  | E6:1.5 D6:.5 C6:1 G5:1
    A  | C#6:1.5 E6:.5 A5:2
    Dm | A5:1 D6:1 F6:2
    Bb | F6:1.5 D6:.5 Bb5:2
    Gm | D6:1.5 Bb5:.5 G5:2
    A  | C#5:.5 D5:.5 E5:.5 A5:.5 C#6:2`)},
];
const finales = [
  {name: 'bgm-victory', bpm: 132, beats: 12, lead: 'brass', fanfare: true,
    tune: 'D5:.333 D5:.333 D5:.334 G5:1 B5:1 C6:1 A5:.5 B5:.25 C6:.25 D6:4 r:3',
    chords: [[0, 3, 'G'], [3, 1, 'C'], [4, 1, 'D'], [5, 7, 'G']]},
  {name: 'bgm-defeat', bpm: 84, beats: 12, lead: 'horn',
    tune: 'A5:1.5 G5:.5 F5:2 D5:1 Bb4:1 C#5:1 E5:1 D5:3 r:1',
    chords: [[0, 2, 'Dm'], [2, 2, 'Bb'], [4, 1, 'Gm'], [5, 2, 'A'], [7, 5, 'Dm']]},
];

for (const score of pieces) {
  writeFileSync(new URL('../public/assets/' + score.name + '.mp3', import.meta.url), encode(hall(arrange(score), true), true, 128, 1.3));
}
for (const score of finales) {
  writeFileSync(new URL('../public/assets/' + score.name + '.mp3', import.meta.url), encode(hall(arrangeFinale(score), false), false, 128, 1.2));
}
