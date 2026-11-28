import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const script = readFileSync(new URL('../public/combat-audio.js', import.meta.url), 'utf8');
const combat = readFileSync(new URL('../public/combat.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../public/game.js', import.meta.url), 'utf8');

function load() {
  const window = {addEventListener() {}};
  const document = {hidden: false, querySelectorAll: () => [], addEventListener() {}, getElementById: () => null};
  const localStorage = {getItem: () => null, setItem() {}};
  return new Function('window', 'document', 'localStorage', script + '\nreturn combatAudio;')(window, document, localStorage);
}

function check(samples, kind) {
  assert.ok(samples.length > 0, `${kind} が無音`);
  let peak = 0;
  for (const value of samples) {
    assert.ok(Number.isFinite(value), `${kind} に不正な値`);
    peak = Math.max(peak, Math.abs(value));
  }
  assert.ok(peak > .2 && peak <= 1, `${kind} の音量 ${peak}`);
  return peak;
}

test('戦闘画面の全兵種に専用の発射・被弾・撃破音があり、割れずに鳴る', () => {
  const audio = load();
  const units = [...combat.matchAll(/^\s{4}(\w+): \{(?:profile|slots)/gm)].map(match => match[1]);
  assert.ok(units.length >= 20);
  for (const unit of units) {
    check(audio.synthesize(`shot-${unit}`, 22050, 1), `shot-${unit}`);
    for (const domain of ['land', 'sea', 'air']) {
      check(audio.synthesize(`impact-${unit}:${domain}`, 22050), `impact-${unit}:${domain}`);
      check(audio.synthesize(`defeat-${unit}:${domain}`, 22050), `defeat-${unit}:${domain}`);
    }
  }
  // Accents laid over hits: critical, armor bouncing the round off, and a kill.
  for (const accent of ['accent-critical', 'accent-blocked', 'accent-kill', 'accent-counter', 'accent-breakthrough']) {
    check(audio.synthesize(accent, 22050), accent);
  }
  // Weapons differ: a fighter's missile is not the scout's machine gun, and a bomber is not a tank.
  assert.notDeepEqual(audio.synthesize('shot-fighter', 22050), audio.synthesize('shot-scout', 22050));
  assert.notDeepEqual(audio.synthesize('shot-bomber', 22050), audio.synthesize('shot-tank', 22050));
  // Repeated shots use several variations.
  assert.notDeepEqual(audio.synthesize('shot-tank', 22050, 0), audio.synthesize('shot-tank', 22050, 1));
});

test('小型スピーカーを想定した帯域で、陸海空の着弾とレア演出の立ち上がりが埋もれない', () => {
  const audio = load();
  const rate = 22050;
  const attackFrames = Math.round(rate * .22);
  const lower = 1 - Math.exp(-2 * Math.PI * 360 / rate);
  const upper = 1 - Math.exp(-2 * Math.PI * 2500 / rate);
  const cues = [
    ['shot-tank', .055], ['shot-submarine', .075], ['shot-fighter', .075],
    ['impact-infantry:land', .05], ['impact-tank:land', .05],
    ['impact-battleship:sea', .065], ['impact-fighter:air', .065],
    ['accent-critical', .11], ['accent-blocked', .085], ['accent-breakthrough', .09],
  ];
  for (const [cue, minimum] of cues) {
    const samples = audio.synthesize(cue, rate);
    let low = 0;
    let high = 0;
    let energy = 0;
    for (const sample of samples.subarray(0, attackFrames)) {
      low += (sample - low) * lower;
      high += (sample - high) * upper;
      energy += (high - low) ** 2;
    }
    const rms = Math.sqrt(energy / attackFrames);
    assert.ok(rms >= minimum, `${cue} の中域が小さい (${rms})`);
    assert.equal(Math.abs(samples.at(-1)), 0);
  }
});

test('音声を先読みする各タイマーで1つだけ合成し、繰り返し依頼と高サンプルレートでも負荷を抑える', () => {
  const callbacks = [];
  const rates = [];
  const listeners = new Map();
  class AudioContext {
    state = 'running';
    sampleRate = 96000;
    createBuffer(channels, length, rate) {
      rates.push(rate);
      return {getChannelData: () => new Float32Array(length)};
    }
  }
  const window = {AudioContext, addEventListener() {}};
  const document = {hidden: false, querySelectorAll: () => [], getElementById: () => null,
    addEventListener: (type, fn) => listeners.set(type, fn)};
  const audio = new Function('window', 'document', 'localStorage', 'setTimeout', script + '\nreturn combatAudio;')(
    window, document, {getItem: () => null}, fn => callbacks.push(fn));
  listeners.get('click')({isTrusted: true, target: {}});
  audio.prepare(['shot-drone', 'shot-support']);
  audio.prepare(['shot-drone', 'shot-support']);
  for (let i = 0; i < 6; i++) {
    assert.equal(callbacks.length, 1);
    callbacks.shift()();
    assert.equal(rates.length, i + 1);
  }
  assert.deepEqual(rates, Array(6).fill(32000));
  assert.equal(callbacks.length, 0);
  audio.prepare(['shot-drone']);
  assert.equal(callbacks.length, 0);
});

test('マップ・メニュー・占領・生産・手番の効果音がすべて作れ、ゲームの場面から呼ばれる', () => {
  const audio = load();
  const cues = ['select', 'inspect', 'confirm', 'cancel', 'error', 'open', 'close', 'produce', 'heal', 'capture-step',
    'capture-friendly', 'capture-enemy', 'turn-friendly', 'turn-enemy', 'start', 'move-foot', 'move-vehicle', 'move-air', 'move-sea'];
  const peaks = Object.fromEntries(cues.map(kind => [kind, check(audio.synthesize(kind, 22050), kind)]));
  // Taps stay quieter than battle explosions.
  assert.ok(peaks.select < check(audio.synthesize('defeat-tank:land', 22050), 'defeat'));
  assert.equal(audio.synthesize('unknown-cue', 22050).length, 0);
  for (const kind of ['select', 'inspect', 'confirm', 'cancel', 'error', 'open', 'produce', 'heal', 'capture-step', 'start']) {
    assert.match(game, new RegExp(`combatAudio\\.cue\\('${kind}'`), `${kind} がゲームから呼ばれていない`);
  }
  assert.match(game, /combatAudio\.cue\(`capture-\$\{side\}`\)/);
  assert.match(game, /combatAudio\.playMove\(unit\.type\)/);
  assert.match(game, /combatAudio\.playMove\(enemy\.type\)/);
});
