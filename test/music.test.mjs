import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../public/music.js', import.meta.url), 'utf8');

function audioPage(savedPreference, media = {}) {
  const events = new Map();
  const settings = new Map([['famicom-wars-bgm', savedPreference]]);
  const button = {label: {},
    addEventListener: (type, fn) => events.set('button:' + type, fn),
    setAttribute() {},
    querySelector() { return this.label; },
  };
  let source;
  const player = {
    paused: true, ended: false, currentTime: 0,
    get src() { return source; },
    set src(next) { source = next; this.currentTime = 0; },
    play() {
      if (media.play) return media.play(this);
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; },
  };
  const document = {
    hidden: false,
    getElementById: () => player,
    querySelectorAll: () => [button],
    addEventListener: (type, fn) => events.set(type, fn),
  };
  const music = runInNewContext(script + '\nmusic', {
    document, location: {protocol: media.fetch ? 'https:' : 'file:'},
    fetch: media.fetch,
    URL: {createObjectURL: blob => 'blob:' + blob.path, revokeObjectURL() {}},
    window: {addEventListener: (type, fn) => events.set(type, fn)},
    localStorage: {getItem: key => settings.get(key), setItem: (key, value) => settings.set(key, value)},
  });
  return {
    music, player, button, settings,
    unlock() { events.get('click')({isTrusted: true, target: {closest: () => null}}); },
    toggle() { events.get('button:click')(); },
    setHidden(hidden) { document.hidden = hidden; events.get('visibilitychange')(); },
    track() { return player.src?.match(/\/bgm-([\w-]+)\.mp3/)[1]; },
  };
}

test('手番を切り替えると陣営のBGMが冒頭から流れ、戦闘後は同じ手番の位置に戻る', () => {
  const page = audioPage();
  const {music, player, button} = page;
  assert.equal(button.label.textContent, 'ON');
  assert.equal(page.track(), undefined);
  page.unlock();
  assert.equal(page.track(), 'map');
  player.currentTime = 11;
  music.setScene('battle');
  assert.equal(page.track(), 'battle');
  assert.equal(player.loop, true);
  music.setScene('map');
  assert.equal(page.track(), 'map');
  assert.equal(player.currentTime, 11);

  music.setTurn('enemy');
  assert.equal(page.track(), 'enemy-map');
  assert.equal(player.currentTime, 0);
  player.currentTime = 3.5;
  music.setScene('battle');
  assert.equal(page.track(), 'enemy-battle');
  music.setScene('map');
  assert.equal(page.track(), 'enemy-map');
  assert.equal(player.currentTime, 3.5);
  music.setTurn('friendly');
  assert.equal(page.track(), 'map');
  assert.equal(player.currentTime, 0);
});

test('敵手番の再開、BGMオフの保持、画面復帰と勝敗曲が現在の場面に追従する', () => {
  const page = audioPage('off');
  const {music, player, button, settings} = page;
  music.setTurn('enemy');
  page.unlock();
  assert.equal(page.track(), undefined);
  assert.equal(button.label.textContent, 'OFF');
  page.toggle();
  assert.equal(page.track(), 'enemy-map');
  assert.equal(settings.get('famicom-wars-bgm'), 'on');
  page.setHidden(true);
  assert.equal(player.paused, true);
  music.setOrientationBlocked(true);
  music.setScene('battle');
  page.setHidden(false);
  assert.equal(player.paused, true);
  music.setOrientationBlocked(false);
  assert.equal(page.track(), 'enemy-battle');
  assert.equal(player.paused, false);
  for (const result of ['defeat', 'victory']) {
    music.setScene(result);
    assert.equal(page.track(), result);
    assert.equal(player.loop, false);
  }
});

test('直接再生できないときは取得済みの音源に切り替えて再生する', async () => {
  let onPlayback;
  const played = new Promise(resolve => { onPlayback = resolve; });
  const page = audioPage(undefined, {
    fetch: async path => ({ok: true, blob: async () => ({path})}),
    async play(player) {
      if (!player.src.startsWith('blob:')) throw Object.assign(new Error(), {name: 'NotSupportedError'});
      player.paused = false;
      onPlayback(player.src);
    },
  });
  page.unlock();
  assert.match(await played, /^blob:.*bgm-map\.mp3/);
  assert.equal(page.player.paused, false);
  assert.equal(page.button.label.textContent, 'ON');
});

test('タイトル画面ではタイトル曲がループし、閉じるとマップ曲の続きに戻る', () => {
  const page = audioPage();
  const {music, player} = page;
  page.unlock();
  assert.equal(page.track(), 'map');
  player.currentTime = 7;
  music.setScene('title');
  assert.equal(page.track(), 'title');
  assert.equal(player.loop, true);
  music.setScene('map');
  assert.equal(page.track(), 'map');
  assert.equal(player.currentTime, 7);
});

test('ファンファーレの間だけBGMの音量を下げる', () => {
  const page = audioPage();
  const before = page.player.volume;
  page.music.duck(500);
  assert.ok(page.player.volume < before);
});
