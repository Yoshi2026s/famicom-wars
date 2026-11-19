// Original loop scores. Run with Node.js to render the mono PCM files.
import { writeFileSync } from 'node:fs';

const sampleRate = 22050;
const twoPi = 2 * Math.PI;
const mapScore = {
  bpm: 112,
  chords: [
    [38, 53, 57, 60], [34, 50, 53, 57], [41, 53, 57, 62], [36, 52, 55, 62],
    [38, 53, 57, 62], [34, 53, 57, 60], [43, 50, 57, 62], [45, 52, 55, 61],
    [38, 53, 57, 60], [41, 53, 57, 62], [34, 52, 53, 57], [45, 52, 57, 61],
  ],
  melody: [
    [[0,1,69],[1,0.5,72],[1.5,1.5,74],[3,0.75,77]],
    [[0,1.5,76],[1.5,0.5,74],[2,1.75,72]],
    [[0,0.75,69],[1,0.5,72],[1.5,0.5,74],[2,1.5,81]],
    [[0,1,79],[1,0.75,76],[2,0.75,74],[3,0.75,72]],
    [[0.5,0.75,74],[1.5,0.75,77],[2.5,1,81]],
    [[0,1,84],[1.5,0.5,81],[2,1.5,77]],
    [[0,1,79],[1.5,0.75,81],[2.5,1.25,82]],
    [[0,1,81],[1,0.5,77],[1.5,0.75,76],[2.5,1,73]],
    [[0,1,74],[1,0.5,77],[1.5,1.5,81],[3,0.75,84]],
    [[0,1.75,86],[2,0.75,84],[3,0.75,81]],
    [[0,1.25,77],[1.5,0.5,76],[2,0.75,74],[3,0.75,72]],
    [[0,1.75,73],[2,1.75,76]],
  ],
};
const battleScore = {
  bpm: 152,
  chords: [
    [38, 50, 53, 57], [38, 50, 53, 60], [34, 50, 53, 57], [36, 52, 55, 60],
    [38, 50, 57, 60], [41, 53, 57, 60], [43, 50, 55, 58], [45, 52, 55, 61],
    [38, 50, 53, 57], [46, 53, 57, 62], [43, 50, 55, 62], [45, 52, 57, 61],
  ],
  melody: [
    [[0,.75,74],[1,.5,74],[1.5,.5,77],[2,.75,81],[3,.5,79],[3.5,.45,77]],
    [[0,.75,84],[1,1,81],[2.5,.5,77],[3,.5,79],[3.5,.45,81]],
    [[0,.75,82],[1,.5,77],[1.5,1,74],[3,.75,72]],
    [[0,.75,76],[1,.5,79],[1.5,.5,84],[2.5,1,86]],
    [[0,.75,89],[1,.5,86],[1.5,.5,84],[2,1.25,81],[3.5,.45,77]],
    [[0,.75,81],[1,.75,84],[2,1.5,89]],
    [[0,.75,86],[1,.5,82],[2,.75,79],[3,.75,77]],
    [[0,.5,76],[.5,.5,77],[1,.5,79],[1.5,.5,81],[2,1.75,85]],
    [[0,.75,86],[1,.5,84],[1.5,.5,81],[2,.75,89],[3,.5,86],[3.5,.45,84]],
    [[0,1,82],[1.5,.5,81],[2,.75,77],[3,.75,74]],
    [[0,.75,79],[1,.5,82],[1.5,.5,86],[2.5,1.25,84]],
    [[0,.5,81],[.5,.5,79],[1,.5,77],[1.5,.5,76],[2,1.5,73]],
  ],
};

function render({bpm, chords, melody}, battle) {
  const beat = 60 / bpm;
  const mix = new Float32Array(Math.round(chords.length * 4 * beat * sampleRate));
  let seed = 4157;

  function add(time, length, renderSample) {
    const offset = Math.round(time * beat * sampleRate);
    const seconds = length * beat;
    const frames = Math.ceil(seconds * sampleRate);
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate;
      const index = (offset + i) % mix.length;
      mix[index] += renderSample(t, t / seconds);
    }
  }
  function note(time, length, pitch, volume, voice) {
    const frequency = 440 * 2 ** ((pitch - 69) / 12);
    const attack = voice === 'pad' ? 0.11 : 0.012;
    add(time, length, (t, progress) => {
      const phase = twoPi * frequency * t;
      const envelope = Math.min(t / attack, 1, (1 - progress) * 5);
      let wave;
      if (voice === 'pad') wave = Math.sin(phase) + 0.24 * Math.sin(phase * 2.003);
      else if (voice === 'pluck') wave = Math.sin(phase + Math.sin(phase * 2) * Math.exp(-t * 12)) * Math.exp(-5 * progress);
      else wave = Math.sin(phase) + (battle ? 0.36 : 0.21) * Math.sin(phase * 2) + 0.12 * Math.sin(phase * 3.004);
      return volume * envelope * wave;
    });
  }
  function drum(time, kick, volume) {
    add(time, kick ? .42 : .19, (t, progress) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      const wave = kick ? Math.sin(twoPi * (54 * t + 3 * (1 - Math.exp(-t * 17)))) : noise;
      return wave * Math.min(t / 0.003, 1) * (1 - progress) ** 3 * volume;
    });
  }
  chords.forEach(([root, ...harmony], bar) => {
    const start = bar * 4;
    for (const pitch of harmony) note(start, 4.08, pitch, battle ? .019 : .026, 'pad');
    for (const step of (battle ? [0,.75,1.5,2,2.75,3.5] : [0,1.5,2.5])) {
      note(start + step, battle ? .45 : .86, root + (step === 2.5 || step === 3.5 ? 12 : 0), battle ? .088 : .058, 'bass');
    }
    for (let i = 0; i < 8; i++) {
      note(start + i * .5, .46, harmony[(i + bar) % harmony.length] + 12, battle ? .033 : .048, 'pluck');
    }
    for (const [offset, length, pitch] of melody[bar]) {
      note(start + offset, length, pitch, battle ? .105 : .086, 'lead');
      note(start + offset + .375, length * .86, pitch, .021, 'pluck');
    }
    for (const step of (battle ? [0,1.5,2,3.5] : [0,2.5])) drum(start + step, true, battle ? .14 : .073);
    for (const step of (battle ? [.5,1,1.75,2.5,3,3.75] : [1,2,3,3.5])) drum(start + step, false, battle && Number.isInteger(step) ? .10 : .038);
  });
  return mix;
}

for (const [name, score, battle] of [['bgm-map', mapScore, false], ['bgm-battle', battleScore, true]]) {
  const samples = render(score, battle);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.tanh(samples[i] * 1.34) * 27300), 44 + i * 2);
  writeFileSync(new URL(`../public/assets/${name}.wav`, import.meta.url), wav);
}
