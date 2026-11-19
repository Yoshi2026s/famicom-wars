import assert from 'node:assert/strict';
import { test } from 'node:test';
import TrainingMap from '../public/rules.js';

function beginEncounter() {
  const game = new TrainingMap('battle');
  game.choose(1, 3);
  game.choose(2, 2);
  game.endTurn();
  return game;
}

test('歩兵戦では敵が最大1マス近づき、隣接したターンだけ1ダメージを与える', () => {
  const game = new TrainingMap('battle');
  assert.deepEqual([game.x, game.y, game.playerHP, game.enemyHP], [1, 3, 3, 2]);
  game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 1, from: {x: 3, y: 1}, to: {x: 2, y: 1}, hit: false});
  assert.equal(game.playerHP, 3);
  game.endTurn();
  assert.deepEqual(game.enemy, {x: 2, y: 2});
  assert.equal(game.playerHP, 3);
  game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 3, from: {x: 2, y: 2}, to: {x: 1, y: 2}, hit: true});
  assert.equal(game.playerHP, 2);
});

test('敵の隣で始めたターンに攻撃し、次のターンの2発目で勝利できる', () => {
  const game = beginEncounter();
  assert.equal(game.canAttack, true);
  assert.equal(game.playerHP, 2);
  game.choose(2, 1);
  game.choose(2, 1);
  assert.deepEqual([game.enemyHP, game.result, game.canMove], [1, null, false]);
  game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 2, from: {x: 2, y: 1}, to: {x: 2, y: 1}, hit: true});
  assert.equal(game.playerHP, 1);
  game.choose(2, 1);
  assert.deepEqual([game.enemy, game.enemyHP, game.result], [null, 0, 'victory']);
  const finalState = structuredClone(game);
  game.endTurn();
  game.choose(2, 2);
  game.choose(2, 1);
  assert.deepEqual(structuredClone(game), finalState);
});

test('HPが0になると敗北し、行動とターンはそこで止まる', () => {
  const game = beginEncounter();
  game.endTurn();
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.deepEqual([game.playerHP, game.turn, game.canAttack, game.canMove], [0, 3, false, false]);
  const finalState = structuredClone(game);
  game.choose(2, 1);
  game.endTurn();
  assert.deepEqual(structuredClone(game), finalState);
});

test('訓練と歩兵戦は独立し、訓練の敵は動かず1回で撃破される', () => {
  const training = new TrainingMap();
  const battle = beginEncounter();
  training.endTurn();
  assert.deepEqual(training.enemy, {x: 4, y: 1});
  training.choose(2, 2);
  training.choose(3, 1);
  training.choose(4, 1);
  assert.deepEqual([training.enemy, training.result], [null, null]);
  assert.deepEqual([battle.enemy, battle.playerHP, battle.enemyHP], [{x: 2, y: 1}, 2, 2]);
});
