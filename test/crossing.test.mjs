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
  assert.deepEqual(game.planEnemyTurn(), {turn: 1, from: {x: 5, y: 4}, to: {x: 5, y: 5}, hit: false});
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
