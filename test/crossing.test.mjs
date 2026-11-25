import assert from 'node:assert/strict';
import {test} from 'node:test';
import TrainingMap from '../public/rules.js';

test('新作戦は10×8で、川を避けて橋を渡り、湿地には移動力2を使う', () => {
  const game = new TrainingMap('crossing');
  assert.deepEqual([game.width, game.height, game.x, game.y], [10, 8, 1, 6]);
  assert.equal(game.playerUnit.id, 'scout');
  assert.equal(game.enemyUnit.id, 'support');

  game.choose(1, 6);
  const paths = game.movementTargets();
  assert.equal(paths.get('2,5').cost, 3); // C6 is a marsh, two squares from B7.
  assert.equal(paths.get('3,5').cost, 4);
  assert.equal(game.canMoveTo(4, 5), false);
  assert.equal(game.canMoveTo(4, 6), false);
  assert.equal(game.canMoveTo(1, 8), false);
  game.choose(3, 5);
  game.endTurn();
  game.choose(3, 5);
  assert.equal(game.movementTargets().get('5,5').cost, 2);
  assert.equal(game.canMoveTo(4, 4), false);
  assert.equal(game.canMoveTo(7, 5), true);
  game.choose(7, 5);
  assert.deepEqual([game.x, game.y], [7, 5]);
});

test('支援車は川・湿地を避けて橋を目指し、射程に入るとその場で攻撃する', () => {
  const game = new TrainingMap('crossing');
  game.x = 1;
  game.y = 4;
  game.enemy = {x: 5, y: 4};
  const before = structuredClone(game);
  assert.deepEqual(game.planEnemyTurn(), {turn: 1, from: {x: 5, y: 4}, to: {x: 5, y: 5}, hit: false, targetId: null});
  assert.deepEqual(structuredClone(game), before);
  game.endTurn();
  game.endTurn();
  assert.deepEqual(game.enemy, {x: 4, y: 5});
  const strikes = game.endTurn();
  assert.deepEqual(game.enemyAction.to, {x: 3, y: 5});
  assert.deepEqual(strikes.map(hit => hit.attacker), ['enemy']);
  assert.equal(game.planEnemyTurn().hit, true);
  assert.deepEqual(game.planEnemyTurn().to, game.enemy);
});

test('偵察車の隣接攻撃と支援車の遠距離攻撃はどちらも射程外から反撃されない', () => {
  const game = new TrainingMap('crossing');
  game.x = 3;
  game.y = 4; // D5 marsh.
  game.enemy = {x: 3, y: 5};
  assert.deepEqual(game.choose(3, 5), [
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 7},
  ]);
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 1, terrain: '湿地', mitigation: 1, playerHP: 9, enemyHP: 7},
  ]);
  assert.equal(game.canAttack, false);
});

test('味方3部隊は同じターンに1回ずつ移動し、味方のマスを通らず、次のターンに再び動ける', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  assert.deepEqual(game.friendlyUnits.map(unit => [unit.type.id, unit.x, unit.y]), [
    ['scout', 1, 6], ['infantry', 3, 1], ['support', 2, 1],
  ]);
  game.choose(scout.x, scout.y);
  game.choose(3, 5);
  game.choose(infantry.x, infantry.y);
  assert.equal(game.canMoveTo(support.x, support.y), false);
  assert.equal(game.canMoveTo(1, 1), false); // Reaching B2 would require crossing the support vehicle's tile.
  game.choose(3, 2);
  game.choose(support.x, support.y);
  game.choose(2, 2);
  for (const unit of game.friendlyUnits) {
    game.choose(unit.x, unit.y);
    assert.equal(game.activeUnit, unit);
    assert.equal(game.canMove, false);
    assert.equal(game.movementTargets().size, 0);
  }
  assert.deepEqual(game.friendlyUnits.map(unit => [unit.x, unit.y]), [[3, 5], [3, 2], [2, 2]]);
  assert.equal(game.turn, 1);
  game.endTurn();
  assert.equal(game.turn, 2);
  assert.ok(game.friendlyUnits.every(unit => !unit.moved && !unit.attacked));
});

test('味方の支援車は移動後に一度だけ攻撃でき、別の部隊は続けて行動できる', () => {
  const game = new TrainingMap('crossing');
  const [scout, , support] = game.friendlyUnits;
  Object.assign(support, {x: 3, y: 5});
  game.enemy = {x: 6, y: 5};
  game.choose(support.x, support.y);
  game.choose(4, 5);
  assert.equal(support.moved, true);
  assert.equal(game.canAttack, true);
  assert.deepEqual(game.choose(game.enemy.x, game.enemy.y).map(hit => hit.attacker), ['player', 'enemy']);
  assert.equal(support.attacked, true);
  assert.equal(game.choose(game.enemy.x, game.enemy.y), undefined);
  game.choose(scout.x, scout.y);
  assert.equal(game.canMove, true);
});

test('敵の攻撃と反撃は操作中の部隊ではなく交戦する部隊の射程・HPを使う', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  Object.assign(support, {x: 3, y: 4});
  game.enemy = {x: 5, y: 4};
  assert.equal(game.planEnemyTurn().targetId, 'support');
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 2, terrain: '湿地', mitigation: 1, playerHP: 8, enemyHP: 10},
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 8, enemyHP: 7},
  ]);
  assert.equal(game.activeUnit, scout);
  assert.deepEqual([scout.hp, infantry.hp, support.hp], [10, 10, 8]);
});

test('撃破された味方は盤面を空け、残った部隊を操作でき、全滅で敗北する', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  Object.assign(scout, {x: 3, y: 4, hp: 1});
  game.enemy = {x: 5, y: 4};
  game.endTurn();
  assert.equal(game.friendlyAt(3, 4), undefined);
  assert.equal(game.activeUnit, infantry);
  assert.equal(game.result, null);
  game.choose(infantry.x, infantry.y);
  assert.ok(game.movementTargets().size > 0);

  infantry.hp = 0;
  Object.assign(support, {x: 3, y: 4, hp: 1});
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.equal(game.planEnemyTurn(), null);
});
