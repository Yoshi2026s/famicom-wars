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
  // Weapons differ: a fighter's missile is not the scout's machine gun, and a bomber is not a tank.
  assert.notDeepEqual(audio.synthesize('shot-fighter', 22050), audio.synthesize('shot-scout', 22050));
  assert.notDeepEqual(audio.synthesize('shot-bomber', 22050), audio.synthesize('shot-tank', 22050));
  // Repeated shots use several variations.
  assert.notDeepEqual(audio.synthesize('shot-tank', 22050, 0), audio.synthesize('shot-tank', 22050, 1));
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
