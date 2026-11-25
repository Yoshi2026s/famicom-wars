import assert from 'node:assert/strict';
import {test} from 'node:test';
import TrainingMap from '../public/rules.js';

test('歩兵で占領した都市は次のターンから収入になり、ターン開始を繰り返しても加算は1回だけ', () => {
  const game = new TrainingMap('crossing');
  const city = game.cityAt(4, 1);
  assert.equal(city.owner, 'neutral');
  assert.deepEqual(game.funds, {friendly: 4500, enemy: 4500});
  assert.equal(game.incomeFor('friendly'), 1000);

  game.choose(3, 1);
  game.choose(4, 1);
  assert.equal(city.owner, 'friendly');
  assert.equal(game.incomeFor('friendly'), 2000);
  assert.equal(game.funds.friendly, 4500);
  game.endTurn();
  game.finishEnemyTurn();
  assert.equal(game.turn, 2);
  assert.equal(game.funds.friendly, 6500);
  assert.equal(city.owner, 'friendly');
});

test('車両は中立都市を占領できず、都市の地形と双方の収入は維持される', () => {
  const game = new TrainingMap('crossing');
  const scout = game.friendlyUnits[0];
  Object.assign(scout, {x: 4, y: 5});
  const terrain = game.terrainAt(5, 5);
  game.choose(4, 5);
  game.choose(5, 5);
  assert.equal(game.friendlyAt(5, 5), scout);
  assert.equal(game.cityAt(5, 5).owner, 'neutral');
  assert.equal(game.terrainAt(5, 5), terrain);
  assert.deepEqual([game.incomeFor('friendly'), game.incomeFor('enemy')], [1000, 1000]);
});

test('敵歩兵が都市を奪うと次のターンの収入が移り、既存の資金は奪われない', () => {
  const game = new TrainingMap('crossing');
  Object.assign(game.enemyUnits[0], {x: 2, y: 2});
  game.funds.enemy = 0;
  game.endTurn();
  assert.equal(game.cityAt(2, 3).owner, 'enemy');
  assert.ok(game.enemyActions.some(action => action.enemy === '歩兵' && action.cityCaptured));
  assert.deepEqual(game.funds, {friendly: 4500, enemy: 2000});
  assert.deepEqual([game.incomeFor('friendly'), game.incomeFor('enemy')], [0, 2000]);
  assert.equal(game.production.enemy, null);
});

test('部隊の種類ごとに費用が異なり、資金不足の操作は資金や部隊に影響しない', () => {
  for (const [type, cost] of [['infantry', 1000], ['scout', 2500], ['support', 3000]]) {
    const game = new TrainingMap('crossing');
    assert.equal(game.productionCost(type), cost);
    game.funds.friendly = cost - 1;
    assert.equal(game.produce(type), null);
    assert.equal(game.funds.friendly, cost - 1);
    assert.equal(game.production.friendly, null);
    assert.equal(game.friendlyUnits.length, 3);
    game.funds.friendly = cost;
    assert.equal(game.produce(type).type.id, type);
    assert.equal(game.funds.friendly, 0);
    assert.equal(game.production.friendly.cost, cost);
    assert.equal(game.produce(type), null);
  }
});

test('決着時は収入と補充を停止し、再戦では所有者と初期資金が戻る', () => {
  const game = new TrainingMap('crossing');
  const city = game.cityAt(4, 1);
  game.choose(3, 1);
  game.choose(4, 1);
  assert.equal(city.owner, 'friendly');
  Object.assign(game.enemyUnits[0], {x: 1, y: 5});
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.deepEqual(game.funds, {friendly: 4500, enemy: 4500});
  assert.equal(game.production.enemy, null);
  const replay = new TrainingMap('crossing');
  assert.equal(replay.cityAt(4, 1).owner, 'neutral');
  assert.deepEqual(replay.funds, {friendly: 4500, enemy: 4500});
});
