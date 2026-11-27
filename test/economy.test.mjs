import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

test('歩兵で占領した都市は次のターンから収入になり、ターン開始を繰り返しても加算は1回だけ', () => {
  const game = new BattleMap();
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
  // 4500 + income 2000 - repair of 2 HP (100 per HP for infantry).
  assert.equal(game.funds.friendly, 6300);
  assert.equal(city.owner, 'friendly');
  assert.equal(game.friendlyAt(4, 1).hp, 6);
  assert.deepEqual(game.facilityHealing, [{side: 'friendly', unit: '歩兵', amount: 2, facility: 'city', cost: 200}]);
});

test('車両は中立都市を占領できず、都市の地形と双方の収入は維持される', () => {
  const game = new BattleMap();
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
  const game = new BattleMap();
  Object.assign(game.enemyUnits[0], {x: 2, y: 2});
  game.funds.enemy = 0;
  game.endTurn();
  assert.equal(game.cityAt(2, 3).owner, 'enemy');
  assert.ok(game.enemyActions.some(action => action.enemy === '歩兵' && action.cityCaptured));
  assert.deepEqual(game.funds, {friendly: 4500, enemy: 2000});
  assert.deepEqual([game.incomeFor('friendly'), game.incomeFor('enemy')], [0, 2000]);
  assert.deepEqual(game.enemyProductions, []);
});

test('部隊の種類ごとに費用が異なり、資金不足の操作は資金や部隊に影響しない', () => {
  for (const [type, cost] of [['infantry', 1000], ['scout', 2500], ['support', 3000], ['tank', 4000]]) {
    const game = new BattleMap();
    const factory = game.factoryAt(1, 5);
    assert.equal(game.productionCost(type), cost);
    game.funds.friendly = cost - 1;
    assert.equal(game.produce(type, factory), null);
    assert.equal(game.funds.friendly, cost - 1);
    assert.equal(factory.production, null);
    assert.equal(game.friendlyUnits.length, 3);
    game.funds.friendly = cost;
    assert.equal(game.produce(type, factory).type.id, type);
    assert.equal(game.funds.friendly, 0);
    assert.equal(factory.production.cost, cost);
    assert.equal(game.produce(type, factory), null);
  }
});

test('決着時は収入と補充を停止し、再戦では所有者と初期資金が戻る', () => {
  const game = new BattleMap();
  const city = game.cityAt(4, 1);
  game.choose(3, 1);
  game.choose(4, 1);
  assert.equal(city.owner, 'friendly');
  game.friendlyUnits[1].hp = 6;
  Object.assign(game.enemyUnits[0], {x: 1, y: 5});
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.deepEqual(game.funds, {friendly: 4500, enemy: 4500});
  assert.deepEqual(game.enemyProductions, []);
  assert.equal(game.friendlyUnits[1].hp, 6);
  assert.deepEqual(game.facilityHealing, []);
  const replay = new BattleMap();
  assert.equal(replay.cityAt(4, 1).owner, 'neutral');
  assert.deepEqual(replay.funds, {friendly: 4500, enemy: 4500});
});

test('ターン開始時は所有都市にいる両陣営の生存部隊だけが最大HPまで回復する', () => {
  const game = new BattleMap();
  game.beginEnemyTurn();
  for (let action; (action = game.prepareEnemyAction());) game.resolveEnemyAction(action);
  const [scout, infantry, support] = game.friendlyUnits;
  const [destroyed, enemyScout] = game.enemyUnits;
  Object.assign(scout, {x: 2, y: 3, hp: 6});
  Object.assign(infantry, {x: 5, y: 5, hp: 5});
  Object.assign(support, {x: 4, y: 1, hp: 8});
  game.cityAt(4, 1).owner = 'enemy';
  Object.assign(destroyed, {x: 7, y: 4, hp: 0});
  Object.assign(enemyScout, {x: 7, y: 4, hp: 9});
  game.finishEnemyTurn();
  game.finishEnemyTurn();
  assert.deepEqual([scout.hp, infantry.hp, support.hp, destroyed.hp, enemyScout.hp], [8, 5, 8, 0, 10]);
  assert.deepEqual(game.facilityHealing, [
    {side: 'friendly', unit: '偵察車', amount: 2, facility: 'city', cost: 500},
    {side: 'enemy', unit: '偵察車', amount: 1, facility: 'city', cost: 250},
  ]);
});

test('自軍工場ではHPが最大値まで回復し、敵工場の車両や撃破済みの部隊は回復しない', () => {
  const game = new BattleMap();
  game.beginEnemyTurn();
  for (let action; (action = game.prepareEnemyAction());) game.resolveEnemyAction(action);
  const [scout, , support] = game.friendlyUnits;
  const [destroyed] = game.enemyUnits;
  Object.assign(scout, {x: 1, y: 5, hp: 9});
  Object.assign(support, {x: 8, y: 4, hp: 5});
  Object.assign(destroyed, {x: 8, y: 4, hp: 0});
  game.finishEnemyTurn();
  game.finishEnemyTurn();
  assert.deepEqual([scout.hp, support.hp, destroyed.hp], [10, 5, 0]);
  assert.deepEqual(game.facilityHealing, [{side: 'friendly', unit: '偵察車', amount: 1, facility: 'factory', cost: 250}]);
  assert.deepEqual(game.funds, {friendly: 5250, enemy: 5500});
});
