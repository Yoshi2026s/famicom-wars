// Original stereo arrangements for the field, engagements and results.
import {writeFileSync} from 'node:fs';
import {Mp3Encoder} from '@breezystack/lamejs';

const sampleRate = 44100;
const tau = 2 * Math.PI;
const chords = {
  D: [38, 54, 57, 61, 64], A: [33, 52, 57, 59, 61], Bm: [35, 54, 57, 62, 66],
  G: [43, 54, 59, 62, 67], Em: [40, 55, 59, 62, 66], Fsm: [42, 54, 57, 61, 64],
  C: [36, 55, 60, 64, 67], Dm: [38, 53, 57, 60, 64], Bb: [34, 53, 57, 62, 65],
  Gm: [43, 55, 58, 62, 65], A7: [33, 55, 57, 61, 64], A7b9: [33, 55, 58, 61, 64],
  F: [41, 53, 57, 60, 64], Eb: [39, 55, 58, 62, 65], Dsus: [38, 55, 57, 62, 64],
  // Plain triads for the marches: brighter and more martial than the sevenths of the field themes.
  D3: [38, 50, 57, 62, 66], C3: [36, 48, 55, 60, 64], G3: [43, 55, 59, 62, 67], A3: [33, 45, 57, 61, 64],
  Bb3: [34, 46, 53, 58, 62], Em3: [40, 52, 55, 59, 64],
};

const meadow = [
  [[0,.66,74],[.75,.4,78],[1.25,.57,81],[2,1.32,83],[3.5,.38,81]],
  [[0,1,85],[1.25,.55,83],[2,.78,81],[3,.70,76]],
  [[0,.68,78],[.75,.41,81],[1.25,.57,83],[2,1.28,86],[3.5,.36,85]],
  [[0,1.12,83],[1.5,.53,79],[2.25,1.37,78]],
  [[0,1.08,81],[1.25,.42,86],[1.75,.46,88],[2.5,1.23,90]],
  [[0,.70,88],[.75,.41,86],[1.25,.56,83],[2,1.65,79]],
  [[.25,.84,81],[1.25,.41,83],[1.75,.47,86],[2.5,1.03,90],[3.6,.32,86]],
  [[0,1.1,85],[1.25,.48,81],[2,1.33,76],[3.5,.36,73]],
];
const valley = [
  [[0,1.16,62],[1.5,.48,65],[2.25,1.24,64],[3.75,.20,60]],
  [[0,1.35,58],[1.75,.45,60],[2.5,1.16,62]],
  [[0,.62,64],[.75,.39,67],[1.25,.55,70],[2,1.37,69],[3.6,.29,65]],
  [[0,.94,64],[1.25,.65,61],[2.25,1.28,57]],
  [[0,1.12,62],[1.5,.38,64],[2,.70,65],[3,.56,69],[3.62,.28,72]],
  [[0,1.44,70],[1.75,.52,69],[2.5,1.14,65]],
  [[0,.67,67],[.75,.4,70],[1.25,.52,74],[2,1.19,77],[3.5,.42,74]],
  [[0,.91,73],[1,.5,70],[1.75,.40,67],[2.5,1.16,64]],
];

// Middle section of the field theme, sung lower by horn and cello.
const ridge = [
  [[0,1.5,74],[1.5,.5,73],[2,1,71],[3,1,66]], [[0,1.5,69],[1.5,.5,71],[2,2,73]],
  [[0,1,74],[1,.5,76],[1.5,.5,74],[2,1,71],[3,1,67]], [[0,2.5,69],[2.5,.5,66],[3,.5,69],[3.5,.5,74]],
  [[0,1.5,78],[1.5,.5,76],[2,1,74],[3,1,71]], [[0,1,79],[1,.5,78],[1.5,.5,76],[2,2,71]],
  [[0,.75,74],[.75,.25,76],[1,1,79],[2,1,83],[3,1,81]], [[0,1,79],[1,1,76],[2,1.5,73],[3.5,.5,71]],
];
// Battle themes: short scenes, so the hook arrives in the first bar.
const charge = [
  [[0,.5,74],[.5,.25,74],[.75,.25,74],[1,.5,78],[1.5,.5,81],[2,1.5,86],[3.5,.5,85]],
  [[0,.75,84],[.75,.25,83],[1,.5,81],[1.5,.5,79],[2,1.75,76]],
  [[0,.5,79],[.5,.5,83],[1,.5,86],[1.5,.5,83],[2,.75,88],[2.75,.25,86],[3,1,83]],
  [[0,1.5,81],[1.5,.5,85],[2,.5,88],[2.5,.5,85],[3,1,81]],
  [[0,.5,86],[.5,.25,86],[.75,.25,86],[1,.5,90],[1.5,.5,88],[2,1.5,86],[3.5,.5,81]],
  [[0,.5,84],[.5,.5,88],[1,1,91],[2,.5,88],[2.5,.5,84],[3,1,79]],
  [[0,1,86],[1,.5,89],[1.5,.5,86],[2,1.5,82],[3.5,.5,81]],
  [[0,.5,76],[.5,.5,81],[1,.5,85],[1.5,.5,88],[2,1.75,85],[3.75,.25,73]],
];
const assault = [
  [[0,.25,74],[.25,.25,74],[.5,.5,77],[1,.25,76],[1.25,.25,74],[1.5,.5,73],[2,1.5,74],[3.5,.5,69]],
  [[0,.5,70],[.5,.5,69],[1,.5,74],[1.5,.5,77],[2,1,81],[3,.5,80],[3.5,.5,77]],
  [[0,1,82],[1,.5,81],[1.5,.5,77],[2,1.5,74],[3.5,.5,77]],
  [[0,.5,76],[.5,.5,73],[1,.5,69],[1.5,.5,73],[2,1,76],[3,1,79]],
  [[0,.25,81],[.25,.25,81],[.5,.5,84],[1,.25,82],[1.25,.25,81],[1.5,.5,80],[2,1.5,81],[3.5,.5,77]],
  [[0,1,79],[1,.5,82],[1.5,.5,86],[2,1,82],[3,1,79]],
  [[0,1.5,79],[1.5,.5,77],[2,1,75],[3,1,70]],
  [[0,.5,69],[.5,.5,70],[1,.5,73],[1.5,.5,76],[2,1,79],[3,1,73]],
];

const friendlyPhrase = ['D','A','Bm','G','D','Em','G','A'];
const enemyPhrase = ['Dm','Bb','Gm','A7','Dm','Bb','Gm','A7b9'];
const scores = [
  {
    name: 'bgm-map', bpm: 116, melody: [...meadow, ...ridge, ...meadow], reply: [69, 73, 74, 71, 78, 76, 74, 73],
    harmony: [...friendlyPhrase, 'Bm','Fsm','G','D','Bm','Em','G','A', ...friendlyPhrase],
    lead: ['flute','horn','horn'], bass: [0,1.5,2,3.25], drums: [0,2.5], offbeats: [1,3], drive: .65,
    bridgeLift: 0, quietOpening: true,
  },
  {
    name: 'bgm-enemy-map', bpm: 96, melody: valley, reply: [69, 65, 70, 61, 72, 69, 74, 67],
    harmony: [...enemyPhrase, 'F','Bb','Gm','A7','Dm','Eb','Gm','A7b9','Dm','Bb','Gm','A7b9'],
    lead: ['reed','cello','horn'], bass: [0,.75,1.5,2.5,3], drums: [0,1.5,2.5], offbeats: [1,3.5], drive: .85, enemy: true,
  },
  {
    name: 'bgm-battle', bpm: 144, melody: charge, reply: [69, 72, 74, 73, 78, 79, 77, 76],
    harmony: ['D3','C3','G3','A3','D3','C3','Bb3','A3','D3','C3','G3','A3','D3','C3','Bb3','A3'],
    lead: ['horn','horn','horn'], bass: [0,.5,1,1.5,2,2.5,3,3.5], drums: [0,1,2,3], offbeats: [1,3], drive: 1.05, battle: true,
    bridgeLift: 0, double: -12, march: true,
  },
  {
    name: 'bgm-enemy-battle', bpm: 152, melody: assault, reply: [69, 65, 70, 61, 72, 69, 74, 67],
    harmony: ['Dm','Dm','Bb','A7','Dm','Gm','Eb','A7b9','Dm','Dm','Bb','A7','Dm','Gm','Eb','A7b9'],
    lead: ['reed','horn','horn'], double: -12, march: true, bass: [0,.5,1.5,2,2.75,3.25,3.5], drums: [0,.75,2,2.75,3.5], offbeats: [1,3], drive: 1.23, enemy: true, battle: true,
  },
  {
    // Title: the main theme as a slow, broad march.
    name: 'bgm-title', bpm: 98, melody: [...meadow, ...ridge], reply: [69, 73, 74, 71, 78, 76, 74, 73],
    harmony: [...friendlyPhrase, 'Bm','Fsm','G','D','Bm','Em','G','A'],
    lead: ['horn','strings','horn'], bass: [0,2], drums: [0], offbeats: [2], drive: .7, bridgeLift: 0, double: -12,
  },
];

const instruments = {
  harp: {attack:.006, release:.22, wave:(p,t) =>
    (Math.sin(p + .87 * Math.exp(-4.1*t) * Math.sin(p*2.002)) + .14*Math.sin(3*p) + .09*Math.sin(5*p)) * Math.exp(-2.5*t)},
  flute: {attack:.042, release:.18, wave:(p,t) =>
    .77*Math.sin(p + .23*Math.sin(tau*5.2*t)) + .20*Math.sin(p*2) + .052*Math.sin(p*3) + .025*Math.sin(p*5)},
  strings: {attack:.074, release:.23, wave:(p,t) =>
    .42*Math.sin(p*.997) + .40*Math.sin(p*1.003) + .21*Math.sin(2*p + .23*Math.sin(tau*5.5*t)) + .11*Math.sin(3*p) + .048*Math.sin(4*p)},
  cello: {attack:.028, release:.14, wave:(p,t) =>
    .66*Math.sin(p) + .35*Math.sin(2*p+.15*Math.sin(tau*4.5*t)) + .20*Math.sin(3*p) + .096*Math.sin(5*p)*Math.exp(-2*t)},
  horn: {attack:.023, release:.17, wave:(p,t) =>
    .72*Math.sin(p*.999) + .28*Math.sin(p*1.002) + .30*Math.sin(2*p) + .22*Math.sin(3*p)*Math.exp(-.95*t) + .11*Math.sin(4*p)*Math.exp(-2.5*t)},
  reed: {attack:.032, release:.15, wave:(p,t) =>
    .79*Math.sin(p + .21*Math.sin(tau*4.1*t)) + .31*Math.sin(3*p) + .11*Math.sin(5*p) + .048*Math.sin(7*p)},
  // Extra upper harmonics let the bass line come through on phone speakers.
  bass: {attack:.019, release:.11, wave:(p,t) =>
    Math.tanh(1.8 * (.62*Math.sin(p) + .42*Math.sin(2*p) + .22*Math.sin(3*p)*Math.exp(-2*t) + .14*Math.sin(4*p)*Math.exp(-3*t))) * .8},
  bell: {attack:.005, release:.27, wave:(p,t) =>
    (.61*Math.sin(p) + .24*Math.sin(2.004*p) + .13*Math.sin(2.76*p) + .12*Math.sin(4.1*p)*Math.exp(-5*t))*Math.exp(-5*t)},
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
    const radians = tau * 440 * 2 ** ((pitch - 69) / 12);
    add(start, duration, pan, t => {
      const envelope = Math.min(1, t / attack, (duration - t) / release);
      return gain * envelope * wave(radians * t, t);
    });
  }

  function percussion(start, kind, gain, pan = 0) {
    const duration = {kick:.39, snare:.29, tom:.52, brush:.17}[kind];
    let low = 0;
    add(start, duration, pan, t => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2 ** 31 - 1;
      low += .17 * (noise - low);
      const bright = noise - low;
      const kick = Math.sin(tau * (52*t + 3.2*(1 - Math.exp(-t*29)))) * Math.exp(-7*t);
      const skin = Math.sin(tau * (98*t + 2.3*(1 - Math.exp(-t*22)))) + .31*Math.sin(tau*161*t);
      const waveform = {
        kick: kick + .22*bright*Math.exp(-60*t),
        snare: .57*bright + .29*low + .28*Math.sin(tau*174*t)*Math.exp(-18*t),
        tom: .78*skin + .14*bright*Math.exp(-16*t),
        brush: .59*bright + .09*Math.sin(tau*7310*t),
      }[kind];
      return gain * waveform * Math.min(1, t / .004) * (1 - t / duration) ** 2.7;
    });
  }

  return {channels: [left, right], note, percussion};
}

function arrange(score) {
  const {bpm, harmony, melody, reply, lead, bass, drums, offbeats, drive, battle, enemy, march, quietOpening} = score;
  const {channels, note, percussion} = synthesizer(bpm, harmony.length * 4, true);

  for (const [bar, chord] of harmony.entries()) {
    const [root, ...tones] = chords[chord];
    const start = bar * 4;
    const phrase = bar % 8;
    const bridge = bar >= 8 && bar < harmony.length - 4;
    const reprise = bar >= harmony.length - 4;
    const voice = lead[bridge ? 1 : reprise ? 2 : 0];
    // The field theme opens lightly and builds, so the loop has some light and shade.
    const quiet = quietOpening && bar < 8;

    for (const [i, pitch] of tones.entries()) {
      note(start, 3.85, pitch + (i === 3 ? 12 : 0), bridge ? .049 : .038, 'strings', (i - 1.5) * .39);
    }
    for (const [i, step] of bass.entries()) {
      const octave = i === bass.length - 1 && !enemy ? 12 : 0;
      note(start + step, (bass[i + 1] ?? 4) - step - .12, root + (march ? (i % 2 ? 12 : 0) : octave), .115 * drive, 'bass');
    }
    for (const [i, step] of [0,.5,1,1.5,2,2.5,3,3.5].entries()) {
      const pitch = tones[(enemy ? [0,2,1,2,0,3,1,2] : [0,1,3,2,1,2,3,1])[i]];
      const pan = i % 2 ? .56 : -.56;
      if (quiet && i % 2) continue;
      note(start + step, .30, pitch + (enemy ? 0 : 12),
        (i % 2 ? .035 : .059) * (bridge ? 1.27 : 1), enemy ? 'cello' : 'harp', pan);
      if (i % 2 || battle) percussion(start + step, 'brush', (i % 2 ? .068 : .04) * drive, pan);
    }

    for (const [offset, duration, pitch] of melody[bar % melody.length]) {
      const lift = score.bridgeLift !== undefined ? 0 : enemy ? (battle && reprise ? 12 : 0) : (bridge ? -12 : 0);
      note(start + offset, duration, pitch + lift, voice === 'harp' ? .205 : .176, voice, -.17);
      if (battle || reprise || (bar % 4 === 0 && offset < 2.05)) {
        note(start + offset + .014, duration * .82, pitch + lift + (score.double ?? (enemy ? 12 : -12)), .055,
          enemy ? 'reed' : 'horn', .38);
      }
    }
    if (phrase % 2) {
      note(start + 1.75, .65, reply[phrase] - (enemy ? 0 : 12), .064, enemy ? 'cello' : 'flute', .61);
      note(start + 2.75, .73, tones[2] + (enemy ? 0 : 12), .049, enemy ? 'horn' : 'bell', .45);
    }

    if (!quiet) for (const step of drums) percussion(start + step, 'kick', (bridge ? .153 : .202) * drive);
    // Marching snare: a roll into every second bar.
    if (march && phrase % 2) for (const step of [3, 3.25, 3.5, 3.75]) percussion(start + step, 'snare', .07 * drive, .2);
    for (const step of offbeats) percussion(start + step, 'snare', (battle || enemy ? .159 : .094) * drive, -.25);
    if (phrase % 4 === 3 || (enemy && phrase === 0)) {
      for (const [step, pan] of [[.02,-.17],[.76,.26],[1.50,.48]]) {
        percussion(start + (phrase === 0 ? 0 : 2.25) + step, 'tom', .114 * drive, pan);
      }
    }
    if (!enemy && phrase % 4 === 0) note(start + .1, .55, tones[2] + 24, .062, 'bell', .42);
  }
  return channels;
}

function arrangeFinale({bpm, beats, melody, harmony, accents, lead, reply}) {
  const {channels, note, percussion} = synthesizer(bpm, beats, false);
  for (const [start, length, pitches] of harmony) {
    const [root, ...voices] = pitches;
    note(start, length, root, .13, 'bass');
    voices.forEach((pitch, i) => {
      note(start, length, pitch, .065, 'strings', (i - 1.5) * .43);
      note(start + .10 + i*.15, length * .66, pitch + 12, .045, 'harp', .50 - i*.24);
    });
  }
  for (const [start, length, pitch] of melody) {
    note(start, length, pitch, .207, lead, -.19);
    note(start + .055, length * .88, pitch - 12, .087, reply, .33);
  }
  for (const [start, gain] of accents) percussion(start, 'tom', gain);
  return channels;
}

function encode([left, right], loop, bitrate = 112) {
  const room = [[.031,.11],[.061,.088],[.104,.062],[.157,.038],[.214,.024]]
    .map(([delay, gain]) => [Math.round(delay * sampleRate), gain]);
  let power = 0;
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    power += left[i] ** 2 + right[i] ** 2;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const rms = Math.sqrt(power / (2 * left.length));
  const level = Math.min(.15 / rms, .91 / peak, 2.4);
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

for (const score of scores) {
  writeFileSync(new URL('../public/assets/' + score.name + '.mp3', import.meta.url), encode(arrange(score), true, score.bitrate ?? 96));
}

const victory = {
  bpm: 124, beats: 12, lead: 'horn', reply: 'flute',
  melody: [[0,.48,74],[.6,.54,78],[1.25,.57,81],[2,1.45,86],[3.75,.49,83],[4.35,.54,86],
    [5,1.09,90],[6.25,.53,88],[7,3.7,86]],
  harmony: [[0,1.90,[38,54,57,62,66]],[2,1.65,[35,54,57,62,66]],[3.75,1.23,[43,55,62,67,71]],
    [5,1.20,[40,55,59,64,67]],[6.25,.72,[33,55,57,61,64]],[7,3.9,[38,54,57,62,69]]],
  accents: [[0,.21],[1.25,.091],[2,.20],[5,.13],[7,.22]],
};
const defeat = {
  bpm: 76, beats: 10, lead: 'reed', reply: 'cello',
  melody: [[0,1.06,74],[1.25,.68,72],[2.15,1.04,69],[3.45,.81,65],[4.55,.66,64],[5.4,3.04,62]],
  harmony: [[0,2,[38,53,57,62,65]],[2.15,1.2,[34,53,57,62,65]],[3.45,1,[43,55,58,62,65]],
    [4.55,.82,[33,55,57,61,64]],[5.4,3.15,[38,53,57,60,62]]],
  accents: [[0,.11],[5.4,.068]],
};
for (const [name, score] of [['victory', victory], ['defeat', defeat]]) {
  writeFileSync(new URL('../public/assets/bgm-' + name + '.mp3', import.meta.url), encode(arrangeFinale(score), false));
}
