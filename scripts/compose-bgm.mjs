// Original stereo scores rendered to the published MP3 files.
import {writeFileSync} from 'node:fs';
import {Mp3Encoder} from '@breezystack/lamejs';

const sampleRate = 24000;
const tau = 2 * Math.PI;
const chords = {
  D: [38, 54, 57, 62], A: [33, 52, 57, 61], Bm: [35, 54, 59, 62],
  G: [31, 55, 59, 62], Em: [40, 55, 59, 64], Fsharp: [42, 54, 58, 61],
  Dm: [38, 53, 57, 62], Bb: [34, 53, 58, 62], F: [41, 53, 57, 60],
  C: [36, 55, 60, 64], Gm: [43, 55, 58, 62], A7: [33, 55, 57, 61],
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
  bpm: 148,
  harmony: ['Dm','Bb','Gm','A7','Dm','C','Bb','A7','Gm','Dm','F','C','Bb','Gm','Dm','A7',
    'Dm','Bb','F','C','Gm','Bb','A7','A7'],
  melody: [
    [[0,.66,74],[.75,.2,74],[1,.54,77],[1.75,.24,81],[2,1.4,86],[3.5,.4,84]],
    [[0,.72,82],[.75,.25,81],[1,1,77],[2.5,.45,74],[3,.85,77]],
    [[0,.9,79],[1,.45,82],[1.5,.4,86],[2,.76,89],[3,.74,86]],
    [[0,.78,85],[1,.5,81],[1.5,.4,79],[2,1.6,76]],
    [[0,.75,74],[.75,.23,74],[1,.6,77],[1.75,.24,81],[2,1.4,89],[3.5,.4,86]],
    [[0,.9,84],[1,.5,79],[1.5,.4,76],[2,1.35,79]],
    [[0,.72,77],[1,.45,82],[1.5,.4,84],[2,1.4,86]], [[0,.75,85],[1,.6,81],[2,1.7,76]],
    [[0,1.15,82],[1.5,.4,79],[2,1.5,74]], [[0,.9,81],[1,.75,77],[2,1.5,74]],
    [[0,1.2,84],[1.5,.4,81],[2,1.6,77]], [[0,.9,79],[1,.75,76],[2,1.5,72]],
    [[0,.7,74],[1,.45,77],[1.5,.45,82],[2,1.35,86]], [[0,.7,82],[1,.75,79],[2,1.45,86]],
    [[0,.75,81],[1,.4,84],[1.5,.4,86],[2,1.45,89]], [[0,.75,91],[1,.65,89],[2,1.7,85]],
    [[0,.65,86],[.75,.24,86],[1,.6,89],[1.75,.24,93],[2,1.45,89]],
    [[0,.75,86],[1,.5,82],[2,.6,77],[3,.76,82]], [[0,.85,81],[1,.55,84],[2,1.5,89]],
    [[0,.85,84],[1,.55,79],[2,1.5,76]], [[0,.7,79],[1,.45,82],[1.5,.45,86],[2,1.5,91]],
    [[0,.75,89],[1,.65,86],[2,1.45,82]], [[0,.7,81],[1,.75,85],[2,1.55,88]],
    [[0,.65,85],[1,.7,81],[2,.5,79],[3,.8,73]],
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
  bass: {attack: .022, wave: (phase) => .9 * Math.sin(phase) + .27 * Math.sin(2 * phase)},
};

function arrange({bpm, harmony, melody}, battle) {
  const beat = 60 / bpm;
  const length = Math.round(harmony.length * 4 * beat * sampleRate);
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
    const duration = kind === 'kick' ? .36 : kind === 'snare' ? .24 : .095;
    let last = 0;
    add(start, duration, pan, (t) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2 ** 31 - 1;
      const high = noise - last * .72;
      last = noise;
      const kick = Math.sin(tau * (46 * t + 3.6 * (1 - Math.exp(-t * 21))));
      const snare = .68 * noise + .32 * Math.sin(tau * 165 * t) * Math.exp(-24 * t);
      const waveform = kind === 'kick' ? kick : kind === 'snare' ? snare : high;
      return gain * waveform * Math.min(1, t / .003) * (1 - t / duration) ** 3;
    });
  }

  for (const [bar, chord] of harmony.entries()) {
    const [root, ...tones] = chords[chord];
    const start = bar * 4;
    const bridge = bar >= 8 && bar < 16;
    const finale = bar >= 16;

    tones.forEach((pitch, i) => note(start, 4.02, pitch, battle ? .035 : .048, 'strings', (i - 1) * .68));
    for (const [i, step] of (battle ? [0,.75,1.5,2,2.75,3.5] : [0,1.5,2.75]).entries()) {
      note(start + step, battle ? .32 : .86, root + (i % 3 === 2 ? 12 : 0), battle ? .13 : .074, 'bass');
    }
    for (let i = 0; i < 8; i++) {
      const pitch = tones[(i + (bridge ? bar : 0)) % tones.length] + (battle ? 0 : 12);
      note(start + i * .5, .42, pitch, battle ? .038 : .062, 'piano', i % 2 ? -.61 : .49);
      if (battle || finale) percussion(start + i * .5, 'hat', i % 2 ? .036 : .020, i % 2 ? .42 : -.24);
    }
    for (const [offset, duration, pitch] of melody[bar]) {
      const lead = battle && !bridge ? 'brass' : bridge || finale ? 'flute' : 'piano';
      note(start + offset, duration, pitch, lead === 'flute' ? .142 : .158, lead, -.13);
      note(start + offset + .375, duration * .72, pitch, .028, 'piano', .66);
      if (finale || (battle && offset === 0)) {
        note(start + offset, Math.min(duration, .85), pitch - 12, .053, battle ? 'brass' : 'strings', .36);
      }
    }

    for (const step of (battle ? [0, 1.5, 2, 3.5] : [0, 2.5])) {
      percussion(start + step, 'kick', battle ? .22 : .108);
    }
    for (const step of (battle ? [1, 3, ...(bar % 4 === 3 ? [3.25, 3.5, 3.75] : [])] : [1, 3])) {
      percussion(start + step, 'snare', battle ? .116 : .041, -.14);
    }
    if (battle && bar % 4 === 0) {
      tones.forEach((pitch, i) => note(start, .72, pitch, .076, 'brass', (i - 1) * .57));
    }
  }
  return [left, right];
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
