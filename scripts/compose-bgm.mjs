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
  // Softer colours for the enemy field theme: G minor sixth fits the tune, and the dominant resolves without the flat ninth.
  Gm6: [43, 55, 58, 62, 64], A7s: [33, 52, 57, 61, 67],
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
  [[0,.62,64],[.75,.39,67],[1.25,.55,70],[2,1.37,67],[3.6,.29,64]],
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
    // Field theme as a full symphonic arrangement (see arrangeEpic).
    name: 'bgm-map', bpm: 104, melody: [...meadow, ...ridge, ...meadow], epic: true,
    harmony: [...friendlyPhrase, 'Bm','Fsm','G','D','Bm','Em','G','A', ...friendlyPhrase],
  },
  {
    // Tense but easy to listen to: chords follow the tune (no clashing ninths), and no choir.
    name: 'bgm-enemy-map', bpm: 100, melody: valley, epic: true, enemy: true,
    harmony: ['Dm','Bb','Gm6','A7s','Dm','Bb','Gm','A7', 'F','Bb','Gm6','A7s','Dm','Bb','Gm','A7', 'Dm','Bb','Gm6','A7'],
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
  // Symphonic section voices for the field themes.
  ensemble: {attack:.16, release:.45, wave:(p,t) => {
    const v = .006*Math.sin(tau*5.3*t);
    let sum = 0;
    for (const detune of [.994, 1, 1.006]) {
      const q = p*detune*(1+v);
      sum += .5*Math.sin(q) + .27*Math.sin(2*q) + .17*Math.sin(3*q) + .1*Math.sin(4*q) + .06*Math.sin(5*q) + .035*Math.sin(6*q);
    }
    return sum * .42;
  }},
  choir: {attack:.22, release:.5, wave:(p,t) => {
    const v = .008*Math.sin(tau*4.8*t + 1);
    let sum = 0;
    for (const detune of [.996, 1.004]) {
      const q = p*detune*(1+v);
      sum += .55*Math.sin(q) + .22*Math.sin(2*q) + .3*Math.sin(3*q) + .2*Math.sin(4*q) + .06*Math.sin(6*q);
    }
    return sum * .5;
  }},
  trumpet: {attack:.03, release:.16, wave:(p,t) => {
    const bright = Math.min(1, t / .09);
    const q = p*(1 + (t > .25 ? .005*Math.sin(tau*5.6*t) : 0));
    return Math.tanh(1.2*(.68*Math.sin(q) + .46*Math.sin(2*q) + .3*bright*Math.sin(3*q) + .17*bright*Math.sin(4*q)
      + .09*bright*Math.sin(5*q) + .04*bright*Math.sin(6*q))) * .74;
  }},
  brass: {attack:.06, release:.25, wave:(p,t) => {
    let sum = 0;
    for (const detune of [.997, 1.003]) {
      const q = p*detune;
      sum += .7*Math.sin(q) + .36*Math.sin(2*q) + .24*Math.sin(3*q) + .12*Math.sin(4*q) + .05*Math.sin(5*q);
    }
    return Math.tanh(sum * .8) * .75;
  }},
  timpani: {attack:.003, release:.3, wave:(p,t) =>
    (Math.sin(p) + .5*Math.sin(1.504*p)*Math.exp(-2*t) + .32*Math.sin(1.992*p)*Math.exp(-3*t) + .2*Math.sin(2.44*p)*Math.exp(-6*t))
    * Math.exp(-2.6*t)},
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
    const duration = {kick:.39, snare:.29, tom:.52, brush:.17, cymbal:2.6, roll:.12, bass:.9}[kind];
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
        // Crash cymbal: bright noise with shimmering partials and a long tail.
        cymbal: (.45*bright + .04*Math.sin(tau*5180*t) + .03*Math.sin(tau*7930*t)) * Math.exp(-1.5*t),
        roll: .6*bright + .25*low,
        // Concert bass drum: deep thump that still carries on small speakers.
        bass: (Math.sin(tau * (62*t + 2.2*(1 - Math.exp(-t*18)))) + .3*Math.sin(tau*124*t)*Math.exp(-6*t)) * Math.exp(-3.4*t)
          + .18*bright*Math.exp(-40*t),
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

// Chord tone a third to a sixth below the melody, for horn harmony under the tune.
function under(pitch, tones) {
  for (let candidate = pitch - 3; candidate > pitch - 10; candidate--) {
    if (tones.some(tone => (tone - candidate) % 12 === 0)) return candidate;
  }
  // No chord tone fits: leave the harmony out rather than add a note from outside the key.
  return null;
}

// Plain major/minor triads for the orchestral pads. The jazzier sevenths and ninths of the small band
// sound harsh when strings, choir and brass hold them under the tune.
const triads = {
  D: [2, 6, 9], A: [9, 1, 4], Bm: [11, 2, 6], G: [7, 11, 2], Em: [4, 7, 11], Fsm: [6, 9, 1], C: [0, 4, 7],
  Dm: [2, 5, 9], Bb: [10, 2, 5], Gm: [7, 10, 2], Gm6: [7, 10, 2], A7: [9, 1, 4], A7s: [9, 1, 4], A7b9: [9, 1, 4],
  F: [5, 9, 0], Eb: [3, 7, 10], Dsus: [2, 7, 9],
};
/** Close-position triad from E3 upward, dropping any tone a semitone from a held melody note. */
function padTones(chord, held = []) {
  const voices = [];
  for (let pitch = 52; voices.length < 4; pitch++) {
    if (triads[chord].includes(pitch % 12)) voices.push(pitch);
  }
  return voices.filter(pitch => !held.some(note => [1, 11].includes(Math.abs(note - pitch) % 12)));
}

// A / B / A' in full orchestra: strings, choir, horns and trumpets, harp, timpani and cymbals.
function arrangeEpic({bpm, harmony, melody, enemy}) {
  const {channels, note, percussion} = synthesizer(bpm, harmony.length * 4, true);
  for (const [bar, chord] of harmony.entries()) {
    const root = chords[chord][0];
    const held = melody[bar % melody.length].filter(([, duration]) => duration >= .5).map(([, , pitch]) => pitch);
    const tones = padTones(chord, held);
    const start = bar * 4;
    const section = Math.floor(bar / 8);
    const phrase = bar % 8;
    const grand = section === 2;
    const lyric = section === 1;
    const swell = [.8, .9, 1.12][section];
    const sectionStart = phrase === 0;
    const sectionEnd = phrase === 7;

    // String ensemble and choir pads, spread wide.
    tones.forEach((pitch, i) => {
      note(start, 3.9, pitch + (i >= 2 ? 12 : 0), .036 * swell, 'ensemble', (i - 1.5) * .45);
    });
    if ((lyric || grand) && !enemy) {
      for (const [i, pitch] of tones.slice(0, 3).entries()) note(start, 3.9, pitch + 12, .024 * swell, 'choir', (1 - i) * .55);
    }
    // Low strings and basses: driving eighths in the outer sections, long bows in the middle.
    const low = root < 36 ? root + 12 : root;
    if (lyric) {
      note(start, 1.9, low, .11, 'bass', -.1);
      note(start + 2, 1.9, low + 7, .085, 'bass', .1);
      note(start, 3.9, low + 12, .05, 'cello', -.3);
    } else {
      [0, .5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((step, i) => {
        note(start + step, .42, low + (i % 4 === 2 ? 7 : 0) + (i % 2 ? 12 : 0), (i % 2 ? .055 : .085) * swell, 'bass', i % 2 ? .15 : -.15);
      });
      // Cello counter-line rising through the chord.
      [0, 1, 2, 3].forEach(step => note(start + step, .9, tones[step % tones.length] - (enemy ? 0 : 12) + 12, .04 * swell, 'cello', -.45));
    }
    // Harp: rippling arpeggios, with a glissando into each new section.
    const ripple = sectionEnd ? [0,.25,.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75] : [0,.5,1,1.5,2,2.5,3,3.5];
    ripple.forEach((step, i) => {
      const pitch = tones[i % tones.length] + 12 * (1 + Math.floor(i / tones.length) % 2) + (sectionEnd ? 12 * Math.floor(i / 8) : 0);
      note(start + step, .4, pitch, (sectionEnd ? .028 + i * .002 : .03) * swell, 'harp', i % 2 ? .6 : -.6);
    });

    // The tune: horns, then a lyrical cello and horn middle, then trumpets with horn harmony.
    for (const [offset, duration, pitch] of melody[bar % melody.length]) {
      const at = start + offset;
      if (grand) {
        note(at, duration, pitch, .13, enemy ? 'brass' : 'trumpet', -.12);
        const second = under(pitch, tones);
        if (second !== null) note(at + .012, duration, second, .075, 'brass', .3);
        note(at + .02, duration, pitch - 12, .07, 'horn', -.35);
        if (pitch + 12 <= 93) note(at, duration, pitch + 12, .03, 'ensemble', .5);
      } else if (lyric) {
        note(at, duration, pitch, .14, 'horn', -.1);
        note(at + .015, duration, pitch - 12, .08, 'cello', .3);
        if (pitch + 12 <= 93) note(at, duration, pitch + 12, .026, 'ensemble', -.5);
      } else {
        note(at, duration, pitch, .13, 'horn', -.12);
        if (pitch + 12 <= 93) note(at + .01, duration, pitch + 12, .042, 'ensemble', .45);
        note(at + .02, duration * .9, pitch - 12, .05, 'brass', .25);
      }
    }
    // Brass fanfare stabs and glockenspiel sparkle on the grand return.
    if (grand || sectionStart) {
      for (const step of grand ? [0, 2.5] : [0]) {
        tones.slice(0, 3).forEach((pitch, i) => note(start + step, grand ? .9 : 1.6, pitch, .045, 'brass', (i - 1) * .5));
      }
    }
    if (grand && phrase % 2 === 0 && !enemy) {
      [0, .5, 1].forEach((step, i) => note(start + 2 + step, .3, tones[(i + 1) % tones.length] + 24, .03, 'bell', .55));
    }

    // Timpani on the roots, rolls into each section, crashes at section starts.
    note(start, 1.5, root < 38 ? root + 12 : root, .17 * swell, 'timpani', -.2);
    if (!lyric) note(start + 2, 1, (root < 38 ? root + 12 : root) + 7 - 12, .11 * swell, 'timpani', .2);
    if (sectionEnd) {
      for (let i = 0; i < 12; i++) note(start + 2 + i * .1667, .2, root < 38 ? root + 12 : root, .05 + i * .009, 'timpani', -.2);
      for (let i = 0; i < 8; i++) percussion(start + 3 + i * .125, 'roll', .03 + i * .01, .15);
    }
    if (sectionStart) {
      percussion(start, 'cymbal', .11, .35);
      percussion(start, 'bass', .32);
    }
    if (grand) {
      for (const step of [0, 2]) percussion(start + step, 'bass', .2);
      for (const step of [1, 3]) percussion(start + step, 'snare', .06, -.2);
      if (phrase % 4 === 3) percussion(start + 3.5, 'cymbal', .06, -.4);
    } else if (!lyric) {
      for (const step of [1, 3]) percussion(start + step, 'snare', .05, -.2);
      percussion(start + 2.5, 'brush', .04, .3);
    }
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
  const level = Math.min(.15 / rms, ceiling / peak, 2.4);
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
  const mix = score.epic ? hall(arrangeEpic(score), true) : arrange(score);
  writeFileSync(new URL('../public/assets/' + score.name + '.mp3', import.meta.url), encode(mix, true, score.bitrate ?? 96, score.epic ? 1.1 : .91));
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
