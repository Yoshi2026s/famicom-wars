// Original stereo scores rendered to the published MP3 files.
import {writeFileSync} from 'node:fs';
import {Mp3Encoder} from '@breezystack/lamejs';

const sampleRate = 24000;
const tau = 2 * Math.PI;
const chords = {
  D: [38, 54, 57, 62], A: [33, 52, 57, 61], Bm: [35, 54, 59, 62],
  G: [31, 55, 59, 62], Em: [40, 55, 59, 64], Fsharp: [42, 54, 58, 61],
  F: [41, 53, 57, 60], C: [36, 55, 60, 64],
  Am: [33, 57, 60, 64], B7: [35, 57, 59, 63],
};
const mapScore = {
  bpm: 106,
  harmony: ['D','A','Bm','G','D','Em','G','A','Bm','Fsharp','G','D','Em','Bm','G','A',
    'D','G','Bm','A','Em','G','D','A'],
  melody: [
    [[.5,1,69],[1.5,.5,71],[2,1.75,74]], [[0,1,76],[1,.5,74],[1.5,1,73],[3,1,69]],
    [[0,1.5,71],[2,.75,74],[3,.75,78]], [[0,1.5,76],[2,1.75,74]],
    [[0,.75,69],[1,.75,74],[2,1.75,81]], [[0,1,79],[1,.75,78],[2,1.5,76]],
    [[0,1.25,74],[1.5,.75,71],[2.5,1.25,67]], [[0,1.75,69],[2,1.5,73]],
    [[0,1.5,78],[2,.75,81],[3,.75,83]], [[0,1,85],[1,2.5,82]],
    [[0,1.5,83],[2,.75,81],[3,.75,79]], [[0,2,78],[2.5,1.25,74]],
    [[0,1,76],[1,.5,78],[1.5,.75,79],[2.5,1.25,83]], [[0,1.75,86],[2,.75,85],[3,.75,81]],
    [[0,1.25,83],[1.5,.75,79],[2.5,1.25,74]], [[0,1.5,76],[2,1.5,73]],
    [[0,1,74],[1,.5,78],[1.5,.5,81],[2,1.75,86]], [[0,1,83],[1,.75,81],[2,1.75,79]],
    [[0,1.25,78],[1.5,.75,74],[2.5,1.25,71]], [[0,1,73],[1,.75,76],[2,1.5,81]],
    [[0,1,79],[1,.5,76],[1.5,.5,74],[2,1.75,71]], [[0,1.5,74],[2,.75,71],[3,.75,67]],
    [[0,2.4,69],[2.5,1.25,74]], [[0,1.5,73],[2,1.6,69]],
  ],
};
const battleScore = {
  bpm: 156,
  harmony: ['Em','C','Am','B7','Em','G','D','B7','C','G','Am','Em','F','Am','Em','B7',
    'Em','C','D','B7','Em','Am','C','B7'],
  melody: [
    [[0,.58,76],[.75,.2,76],[1,.32,79],[1.5,.37,83],[2,1.18,88],[3.5,.34,86]],
    [[0,.65,84],[.75,.2,83],[1,1.35,79],[2.75,.37,76],[3.25,.57,79]],
    [[0,.65,81],[.75,.42,84],[1.25,.5,88],[2,.7,91],[3,.7,88]],
    [[0,.8,87],[1,.46,83],[1.5,.42,81],[2,1.64,75]],
    [[0,.58,76],[.75,.2,76],[1,.32,79],[1.5,.37,83],[2,1.18,91],[3.5,.34,88]],
    [[0,.7,86],[1,.45,83],[1.5,.42,79],[2,1.55,83]],
    [[0,.65,81],[.75,.5,86],[1.5,.43,88],[2,1.38,90]],
    [[0,.78,87],[1,.49,83],[1.5,.42,81],[2,1.55,78]],
    [[.25,1.28,84],[1.75,.5,83],[2.5,1.25,79]], [[0,1.17,81],[1.5,.5,79],[2,1.7,74]],
    [[0,1.25,76],[1.5,.5,79],[2,1.65,81]], [[0,1.1,83],[1.5,.46,79],[2,1.6,76]],
    [[0,1.1,77],[1.5,.45,81],[2,1.5,84]], [[0,1.1,88],[1.5,.5,84],[2,1.5,81]],
    [[0,1.1,79],[1.5,.45,83],[2,1.55,88]], [[0,.65,90],[1,.55,88],[2,1.5,87]],
    [[0,.6,88],[.75,.2,88],[1,.32,91],[1.5,.4,95],[2,1.18,91],[3.5,.34,88]],
    [[0,.78,84],[1,.48,88],[1.5,.45,91],[2,1.64,88]], [[0,.75,90],[1,.44,88],[1.5,.45,86],[2,1.6,81]],
    [[0,.71,83],[1,.42,87],[1.5,.45,90],[2,1.62,87]], [[0,.74,88],[1,.43,91],[1.5,.43,95],[2,1.55,93]],
    [[0,.7,91],[1,.55,88],[2,1.6,84]], [[0,.8,83],[1,.5,84],[2,1.53,88]],
    [[0,.7,87],[1,.43,83],[1.5,.43,81],[2,1.58,75]],
  ],
};

const instruments = {
  piano: {attack: .008, wave: (phase, t) =>
    (Math.sin(phase + Math.sin(phase * 2.01) * .72 * Math.exp(-3.2 * t)) + .16 * Math.sin(phase * 3))
    * Math.exp(-1.25 * t)},
  flute: {attack: .075, wave: (phase, t) =>
    Math.sin(phase + .25 * Math.sin(tau * 5.1 * t)) + .19 * Math.sin(phase * 2) + .06 * Math.sin(phase * 3)},
  strings: {attack: .14, wave: (phase, t) =>
    .56 * Math.sin(phase * .998) + .36 * Math.sin(phase * 1.002)
    + .21 * Math.sin(phase * 2 + .45 * Math.sin(tau * 4.3 * t)) + .12 * Math.sin(phase * 3)},
  brass: {attack: .018, wave: (phase, t) =>
    Math.sin(phase) + .34 * Math.sin(2 * phase) + .20 * Math.sin(3 * phase)
    + .14 * Math.sin(phase * 4) * Math.exp(-3 * t)},
  horn: {attack: .013, wave: (phase, t) =>
    Math.sin(phase + .25 * Math.sin(2 * phase)) + .33 * Math.sin(phase * 1.003)
    + .18 * Math.sin(3 * phase) * Math.exp(-3.6 * t)},
  pulse: {attack: .007, wave: (phase, t) =>
    (Math.sin(phase + .51 * Math.sin(phase * 2)) + .22 * Math.sin(phase * 2.004)) * Math.exp(-5.5 * t)},
  bass: {attack: .022, wave: (phase) => .9 * Math.sin(phase) + .27 * Math.sin(2 * phase)},
};

function synthesizer(bpm, beats) {
  const beat = 60 / bpm;
  const length = Math.round(beats * beat * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let seed = 9627;

  function add(start, duration, pan, signal) {
    const offset = Math.round(start * beat * sampleRate);
    const frames = Math.round(duration * sampleRate);
    const balance = (pan + 1) * Math.PI / 4;
    const l = Math.cos(balance), r = Math.sin(balance);
    for (let i = 0; i < frames; i++) {
      const sample = signal(i / sampleRate);
      const at = (offset + i) % length;
      left[at] += sample * l;
      right[at] += sample * r;
    }
  }

  function note(start, beats, pitch, gain, name, pan = 0) {
    const {attack, wave} = instruments[name];
    const duration = beats * beat + .09;
    const radians = tau * 440 * 2 ** ((pitch - 69) / 12);
    add(start, duration, pan, (t) => {
      const envelope = Math.min(1, t / attack, (duration - t) / .10);
      return gain * envelope * wave(radians * t, t);
    });
  }

  function percussion(start, kind, gain, pan = 0) {
    const duration = kind === 'kick' ? .36 : kind === 'snare' ? .24 : kind === 'tom' ? .34 : .095;
    let last = 0;
    add(start, duration, pan, (t) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2 ** 31 - 1;
      const high = noise - last * .72;
      last = noise;
      const kick = Math.sin(tau * (46 * t + 3.6 * (1 - Math.exp(-t * 21))));
      const snare = .68 * noise + .32 * Math.sin(tau * 165 * t) * Math.exp(-24 * t);
      const tom = .81 * Math.sin(tau * (93 * t + 2.2 * (1 - Math.exp(-t * 34)))) + .19 * noise;
      const waveform = kind === 'kick' ? kick : kind === 'snare' ? snare : kind === 'tom' ? tom : high;
      return gain * waveform * Math.min(1, t / .003) * (1 - t / duration) ** 3;
    });
  }
  return {channels: [left, right], note, percussion};
}

function arrange({bpm, harmony, melody}, battle) {
  const {channels, note, percussion} = synthesizer(bpm, harmony.length * 4);

  for (const [bar, chord] of harmony.entries()) {
    const [root, ...tones] = chords[chord];
    const start = bar * 4;
    const bridge = bar >= 8 && bar < 16;
    const finale = bar >= 16;

    if (battle) {
      const rhythm = bridge ? [0, .75, 1.5, 2.5, 3.5] : [0, .5, .75, 1.5, 2, 2.75, 3.25, 3.5];
      tones.forEach((pitch, voice) => note(start, 4, pitch, bridge ? .072 : .036, 'strings', (voice - 1) * .76));
      for (const [i, step] of rhythm.entries()) {
        note(start + step, .32, root + (i % 4 === 3 ? 12 : 0), .145, 'bass');
        note(start + step, .28, tones[i % tones.length] + 12, bridge ? .042 : .083, 'pulse', i % 2 ? -.63 : .57);
      }
      for (const [offset, duration, pitch] of melody[bar]) {
        note(start + offset, duration, pitch, bridge ? .15 : .173, bridge ? 'strings' : 'horn', -.16);
        note(start + offset + .135, duration * .76, pitch - 12, bridge || finale ? .069 : .045, 'brass', .45);
        if (finale) note(start + offset + .38, duration * .62, pitch, .044, 'piano', .77);
      }
      for (const step of (bridge ? [0, 2.5] : [0, 1.5, 2, 3.5])) percussion(start + step, 'kick', .23);
      for (const step of [1, 3]) percussion(start + step, 'snare', bridge ? .070 : .14, -.18);
      for (const step of (bar % 4 === 3 ? [2.75, 3.25, 3.5, 3.75] : [0, 2])) {
        percussion(start + step, 'tom', bridge ? .058 : .132, step < 2 ? -.34 : .35);
      }
      for (let i = 0; i < 8; i++) percussion(start + i * .5, 'hat', i % 2 ? .047 : .025, i % 2 ? .48 : -.42);
      if (bar % 4 === 0) {
        tones.forEach((pitch, voice) => note(start, .68, pitch, .076, 'brass', (voice - 1) * .57));
      }
      continue;
    }

    tones.forEach((pitch, i) => note(start, 4.02, pitch, .048, 'strings', (i - 1) * .68));
    for (const [i, step] of [0,1.5,2.75].entries()) {
      note(start + step, .86, root + (i % 3 === 2 ? 12 : 0), .074, 'bass');
    }
    for (let i = 0; i < 8; i++) {
      const pitch = tones[(i + (bridge ? bar : 0)) % tones.length] + 12;
      note(start + i * .5, .42, pitch, .062, 'piano', i % 2 ? -.61 : .49);
      if (finale) percussion(start + i * .5, 'hat', i % 2 ? .036 : .020, i % 2 ? .42 : -.24);
    }
    for (const [offset, duration, pitch] of melody[bar]) {
      const lead = bridge || finale ? 'flute' : 'piano';
      note(start + offset, duration, pitch, lead === 'flute' ? .142 : .158, lead, -.13);
      note(start + offset + .375, duration * .72, pitch, .028, 'piano', .66);
      if (finale) {
        note(start + offset, Math.min(duration, .85), pitch - 12, .053, 'strings', .36);
      }
    }

    for (const step of [0, 2.5]) {
      percussion(start + step, 'kick', .108);
    }
    for (const step of [1, 3]) {
      percussion(start + step, 'snare', .041, -.14);
    }
  }
  return channels;
}

function arrangeFinale({bpm, beats, melody, harmony, accents, lead}) {
  const {channels, note, percussion} = synthesizer(bpm, beats);
  for (const [start, length, pitches] of harmony) {
    const [root, ...voices] = pitches;
    note(start, length, root, .100, 'bass');
    voices.forEach((pitch, index) => note(start, length, pitch, .072, 'strings', (index - 1) * .68));
  }
  for (const [start, length, pitch] of melody) {
    note(start, length, pitch, .20, lead, -.13);
    note(start + .12, length * .83, pitch - 12, .055, 'piano', .53);
  }
  for (const [start, gain] of accents) percussion(start, 'tom', gain);
  return channels;
}

function encode(channels) {
  const [left, right] = channels;
  const roomLength = Math.round(.089 * sampleRate);
  const master = (sample, room, i) =>
    Math.round(Math.tanh(1.46 * (sample + .13 * room[(i + room.length - roomLength) % room.length])) * 27800);
  const pcmLeft = Int16Array.from(left, (sample, i) => master(sample, right, i));
  const pcmRight = Int16Array.from(right, (sample, i) => master(sample, left, i));
  const encoder = new Mp3Encoder(2, sampleRate, 64);
  const frames = [];
  for (let i = 0; i < left.length; i += 1152) {
    frames.push(Buffer.from(encoder.encodeBuffer(pcmLeft.subarray(i, i + 1152), pcmRight.subarray(i, i + 1152))));
  }
  frames.push(Buffer.from(encoder.flush()));
  return Buffer.concat(frames);
}

for (const [name, score, battle] of [['bgm-map', mapScore, false], ['bgm-battle', battleScore, true]]) {
  writeFileSync(new URL('../public/assets/' + name + '.mp3', import.meta.url), encode(arrange(score, battle)));
}

const victory = {
  bpm: 118, beats: 10.75, lead: 'horn',
  melody: [[0,.36,67],[.5,.36,72],[1,.43,76],[1.5,1.24,79],[3,.52,76],[3.75,.52,79],[4.5,.76,84],[5.5,.58,83],[6.25,3.25,84]],
  harmony: [[0,2.78,[48,55,60,64]],[3,1.38,[45,57,60,64]],[4.5,.88,[41,60,65,69]],
    [5.5,.65,[43,55,62,71]],[6.25,3.65,[48,55,64,72]]],
  accents: [[0,.18],[1.5,.12],[4.5,.12],[6.25,.18]],
};
const defeat = {
  bpm: 76, beats: 8.25, lead: 'flute',
  melody: [[0,.85,76],[1,.75,74],[2,.9,72],[3,.62,69],[3.75,.8,68],[4.75,2.68,69]],
  harmony: [[0,1.84,[45,57,60,64]],[2,.93,[41,53,60,65]],[3,1.58,[40,52,59,68]],
    [4.75,2.75,[45,52,57,60]]],
  accents: [[0,.072],[4.75,.045]],
};
for (const [name, score] of [['victory', victory], ['defeat', defeat]]) {
  writeFileSync(new URL('../public/assets/bgm-' + name + '.mp3', import.meta.url), encode(arrangeFinale(score)));
}
