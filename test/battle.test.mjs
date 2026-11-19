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

test('戦闘画面を開く前の敵行動の確認は、位置・ターン・HPを進めない', () => {
  const game = new TrainingMap('battle');
  const beforeMove = structuredClone(game);
  assert.equal(game.planEnemyTurn().hit, false);
  assert.deepEqual(structuredClone(game), beforeMove);
  game.choose(1, 3);
  game.choose(2, 2);
  const beforeAttack = structuredClone(game);
  const action = game.planEnemyTurn();
  assert.deepEqual(action, {turn: 1, from: {x: 3, y: 1}, to: {x: 2, y: 1}, hit: true});
  assert.deepEqual(structuredClone(game), beforeAttack);
  const strikes = game.endTurn();
  assert.deepEqual(game.enemyAction, action);
  assert.deepEqual([game.turn, game.playerHP, game.enemyHP], [2, 2, 2]);
  assert.deepEqual(strikes, [
    {attacker: 'enemy', playerHP: 2, enemyHP: 3},
    {attacker: 'player', playerHP: 2, enemyHP: 2},
  ]);
  assert.equal(new TrainingMap().planEnemyTurn(), null);
});

test('歩兵戦では敵が最大1マス近づき、隣接したターンだけ1ダメージを与える', () => {
  const game = new TrainingMap('battle');
  assert.deepEqual([game.x, game.y, game.playerHP, game.enemyHP], [1, 3, 3, 3]);
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

test('味方が先手なら敵は1回反撃し、最後の一撃で撃破された側は反撃しない', () => {
  const game = new TrainingMap('battle');
  game.choose(1, 3);
  game.choose(1, 2);
  game.endTurn();
  game.choose(1, 2);
  game.choose(2, 2);
  assert.equal(game.canAttack, true);
  assert.deepEqual(game.choose(2, 1), [
    {attacker: 'player', playerHP: 3, enemyHP: 2},
    {attacker: 'enemy', playerHP: 2, enemyHP: 2},
  ]);
  assert.equal(game.choose(2, 1), undefined);
  assert.equal(game.canMove, false);
  const enemyTurn = game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 2, from: {x: 2, y: 1}, to: {x: 2, y: 1}, hit: true});
  assert.deepEqual(enemyTurn, [
    {attacker: 'enemy', playerHP: 1, enemyHP: 2},
    {attacker: 'player', playerHP: 1, enemyHP: 1},
  ]);
  assert.deepEqual(game.choose(2, 1), [{attacker: 'player', playerHP: 1, enemyHP: 0}]);
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
  assert.deepEqual(game.endTurn(), [{attacker: 'enemy', playerHP: 0, enemyHP: 1}]);
  assert.equal(game.result, 'defeat');
  assert.deepEqual([game.playerHP, game.turn, game.canAttack, game.canMove], [0, 3, false, false]);
  const finalState = structuredClone(game);
  game.choose(2, 1);
  game.endTurn();
  assert.deepEqual(structuredClone(game), finalState);
});

test('敵のターン中に味方が反撃で撃破した場合も勝利になる', () => {
  const game = beginEncounter();
  game.enemyHP = 1;
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', playerHP: 1, enemyHP: 1},
    {attacker: 'player', playerHP: 1, enemyHP: 0},
  ]);
  assert.deepEqual([game.result, game.enemy, game.turn], ['victory', null, 2]);
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
