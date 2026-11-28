import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import './fixed-dice.mjs';
import {createCrossingSave, crossingSaveKey} from '../public/crossing-save.js';

function openSave(storage) {
  const save = createCrossingSave(() => storage);
  const game = save.load(BattleMap.fromCrossingSnapshot);
  return {save, game};
}

function finishEnemyPhase(game) {
  for (let action; (action = game.prepareEnemyAction());) game.resolveEnemyAction(action);
  game.finishEnemyTurn();
}

test('自動保存は施設の所有状況、資金、部隊のHP・行動済み・出撃待ちを再開後も保つ', () => {
  const storage = new Map();
  const area = {getItem: key => storage.get(key) ?? null, setItem: storage.set.bind(storage)};
  const game = new BattleMap();
  const {save} = openSave(area);
  game.choose(3, 1);
  game.choose(4, 1);
  game.produce('tank', game.factoryAt(1, 5));
  assert.equal(save.write(game.crossingSnapshot()), true);

  const {save: resumedSave, game: resumed} = openSave(area);
  assert.equal(resumedSave.status, 'restored');
  assert.deepEqual(resumed.crossingSnapshot(), game.crossingSnapshot());
  assert.equal(resumed.activeUnit, resumed.friendlyAt(4, 1));
  assert.equal(resumed.activeUnit.moved, true);
  assert.equal(resumed.activeUnit.type, game.activeUnit.type);
  assert.equal(resumed.cityAt(4, 1).owner, 'friendly');
  assert.equal(resumed.productionStatus(resumed.factoryAt(1, 5)), 'used');
  assert.equal(resumed.friendlyAt(1, 5).readyTurn, 2);
  assert.equal(resumed.funds.friendly, 500);

  resumed.endTurn();
  resumedSave.write(resumed.crossingSnapshot());
  const reopened = openSave(area).game;
  assert.equal(reopened.turn, 2);
  assert.equal(reopened.funds.friendly, 2300);
  assert.equal(reopened.friendlyAt(4, 1).hp, 6);
  assert.deepEqual(reopened.facilityHealing, [{side: 'friendly', unit: '歩兵', amount: 2, facility: 'city', cost: 200}]);
  assert.equal(reopened.enemyAt(8, 4).type.id, 'tank');
  assert.deepEqual(reopened.crossingSnapshot(), resumed.crossingSnapshot());
});

test('敵の行動を予約したところで閉じても、確定済みの戦闘やターン収入を繰り返さない', () => {
  const game = new BattleMap();
  game.choose(3, 1);
  game.choose(4, 1);
  game.beginEnemyTurn();
  assert.ok(game.resolveEnemyAction(game.prepareEnemyAction()).length, '先頭の敵が戦闘を行う');
  assert.ok(game.prepareEnemyAction());
  const snapshot = JSON.parse(JSON.stringify(game.crossingSnapshot()));
  assert.equal(snapshot.nextEnemy, 1);
  const resumed = BattleMap.fromCrossingSnapshot(snapshot);
  assert.equal(resumed.friendlyAt(4, 1).hp, game.friendlyAt(4, 1).hp);
  assert.equal(resumed.enemyActions.length, 1);
  finishEnemyPhase(game);
  finishEnemyPhase(resumed);
  assert.deepEqual(resumed.crossingSnapshot(), game.crossingSnapshot());
  assert.equal(resumed.turn, 2);
  assert.equal(resumed.enemyActions.length, 3);
  assert.equal(resumed.enemyProductions.length, 1);
});

test('占領した工場の所有状況を復元したあと、自軍のユニットを生産できる', () => {
  const game = new BattleMap();
  Object.assign(game.friendlyUnits[1], {x: 8, y: 3});
  game.choose(8, 3);
  game.choose(8, 4);
  const resumed = BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(game.crossingSnapshot())));
  const factory = resumed.factoryAt(8, 4);
  assert.equal(factory.owner, 'friendly');
  assert.equal(resumed.productionStatus(factory), 'occupied');
  Object.assign(resumed.activeUnit, {x: 9, y: 4});
  assert.equal(resumed.produce('tank', factory).type.id, 'tank');
  assert.equal(resumed.funds.friendly, 500);
});

test('決着と再戦を続けて保存すると、再戦後の初期状態が復元される', () => {
  let stored = null;
  const area = {getItem: () => stored, setItem: (_key, value) => { stored = value; }};
  const {save} = openSave(area);
  const game = new BattleMap();
  Object.assign(game.friendlyUnits[1], {x: 12, y: 7});
  game.choose(12, 7);
  game.choose(13, 7);
  assert.equal(game.result, 'victory');
  save.write(game.crossingSnapshot());
  const finished = openSave(area);
  assert.equal(finished.game.result, 'victory');
  finished.save.write(new BattleMap().crossingSnapshot());
  const restarted = openSave(area).game;
  assert.equal(restarted.result, null);
  assert.equal(restarted.turn, 1);
  assert.deepEqual(restarted.funds, {friendly: 4500, enemy: 4500});
});

test('壊れた保存や未対応の保存形式を上書きしない', () => {
  const snapshot = new BattleMap().crossingSnapshot();
  for (const text of ['{', JSON.stringify({version: 2, state: snapshot}),
    JSON.stringify({version: 1, state: {...snapshot, activeUnit: 99}})]) {
    const area = {getItem: () => text, setItem: () => assert.fail('既存の保存を上書きした')};
    const {save, game} = openSave(area);
    assert.equal(game, null);
    assert.equal(save.status, 'unreadable');
    assert.equal(save.write(snapshot), false);
  }
});

test('読めない保存は、新しい対戦を選んだときだけ置き換える', () => {
  const snapshot = new BattleMap().crossingSnapshot();
  let stored = '{';
  const area = {getItem: () => stored, setItem: (_key, value) => { stored = value; }};
  const {save} = openSave(area);
  assert.equal(save.status, 'unreadable');
  assert.equal(save.write(snapshot), false);
  assert.equal(stored, '{');
  save.discardUnreadable();
  assert.equal(save.write(snapshot), true);
  assert.notEqual(stored, '{');
});

test('保存の例外と書き込み未反映を表示でき、復旧後の書き込みで続きが残る', () => {
  let stored = null;
  let store = value => { stored = value; };
  const area = {getItem: () => stored, setItem: (_key, value) => store(value)};
  const {save} = openSave(area);
  const game = new BattleMap();
  assert.equal(save.write(game.crossingSnapshot()), true);
  const checkpoint = stored;
  game.produce('tank', game.factoryAt(1, 5));
  store = () => { throw new Error('Quota exceeded'); };
  assert.equal(save.write(game.crossingSnapshot()), false);
  assert.equal(save.status, 'unavailable');
  assert.equal(stored, checkpoint);
  store = () => {};
  assert.equal(save.write(game.crossingSnapshot()), false);
  assert.equal(stored, checkpoint);
  store = value => { stored = value; };
  assert.equal(save.write(game.crossingSnapshot()), true);
  assert.equal(save.status, 'saved');
  assert.equal(openSave(area).game.funds.friendly, 500);
});

test('古いタブの対戦で、別のタブが保存した進行を上書きしない', () => {
  const storage = new Map();
  const area = {getItem: key => storage.get(key) ?? null, setItem: storage.set.bind(storage)};
  const game = new BattleMap();
  const first = openSave(area).save;
  first.write(game.crossingSnapshot());
  const stale = openSave(area);
  game.produce('tank', game.factoryAt(1, 5));
  first.write(game.crossingSnapshot());
  const latest = storage.get(crossingSaveKey);
  stale.game.endTurn();
  assert.equal(stale.save.write(stale.game.crossingSnapshot()), false);
  assert.equal(stale.save.status, 'changed-elsewhere');
  assert.equal(storage.get(crossingSaveKey), latest);
  assert.equal(openSave(area).game.funds.friendly, 500);
});
