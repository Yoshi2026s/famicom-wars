import assert from 'node:assert/strict';
import { test } from 'node:test';
import TrainingMap from '../public/rules.js';

function beginEncounter() {
  const game = new TrainingMap('battle');
  game.choose(1, 3);
  game.choose(3, 3);
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
  assert.deepEqual([game.turn, game.playerHP, game.enemyHP], [2, 8, 9]);
  assert.deepEqual(strikes, [
    {attacker: 'enemy', damage: 2, terrain: '森', mitigation: 1, playerHP: 8, enemyHP: 10},
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 2, playerHP: 8, enemyHP: 9},
  ]);
  assert.equal(new TrainingMap().planEnemyTurn(), null);
});

test('歩兵戦では敵が最大1マス近づき、隣接したターンだけ攻撃する', () => {
  const game = new TrainingMap('battle');
  assert.deepEqual([game.x, game.y, game.maxHP, game.playerHP, game.enemyHP], [1, 3, 10, 10, 10]);
  game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 1, from: {x: 3, y: 1}, to: {x: 2, y: 1}, hit: false});
  assert.equal(game.playerHP, 10);
  game.endTurn();
  assert.deepEqual(game.enemy, {x: 2, y: 2});
  assert.equal(game.playerHP, 10);
  game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 3, from: {x: 2, y: 2}, to: {x: 1, y: 2}, hit: true});
  assert.equal(game.playerHP, 7);
});

test('味方が先手なら敵は1回反撃し、最後の一撃で撃破された側は反撃しない', () => {
  const game = new TrainingMap('battle');
  game.choose(1, 3);
  game.choose(2, 3);
  game.endTurn();
  game.choose(2, 3);
  game.choose(3, 3);
  assert.equal(game.canAttack, true);
  assert.deepEqual(game.choose(3, 2), [
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 7},
    {attacker: 'enemy', damage: 2, terrain: '草原', mitigation: 0, playerHP: 8, enemyHP: 7},
  ]);
  assert.equal(game.choose(3, 2), undefined);
  assert.equal(game.canMove, false);
  const enemyTurn = game.endTurn();
  assert.deepEqual(game.enemyAction, {turn: 2, from: {x: 3, y: 2}, to: {x: 3, y: 2}, hit: true});
  assert.deepEqual(enemyTurn, [
    {attacker: 'enemy', damage: 2, terrain: '草原', mitigation: 0, playerHP: 6, enemyHP: 7},
    {attacker: 'player', damage: 2, terrain: '草原', mitigation: 0, playerHP: 6, enemyHP: 5},
  ]);
  for (const [playerHP, enemyHP] of [[4, 3], [3, 2], [2, 1]]) {
    game.endTurn();
    assert.deepEqual([game.playerHP, game.enemyHP, game.result], [playerHP, enemyHP, null]);
  }
  assert.deepEqual(game.choose(3, 2), [{attacker: 'player', damage: 1, terrain: '草原', mitigation: 0, playerHP: 2, enemyHP: 0}]);
  assert.deepEqual([game.enemy, game.enemyHP, game.result], [null, 0, 'victory']);
  const finalState = structuredClone(game);
  game.endTurn();
  game.choose(2, 2);
  game.choose(2, 1);
  assert.deepEqual(structuredClone(game), finalState);
});

test('HPが0になると敗北し、行動とターンはそこで止まる', () => {
  const game = beginEncounter();
  for (const [playerHP, enemyHP] of [[4, 6], [2, 5]]) {
    game.endTurn();
    assert.deepEqual([game.playerHP, game.enemyHP, game.result], [playerHP, enemyHP, null]);
  }
  assert.deepEqual(game.endTurn(), [{attacker: 'enemy', damage: 2, terrain: '草原', mitigation: 0, playerHP: 0, enemyHP: 5}]);
  assert.equal(game.result, 'defeat');
  assert.deepEqual([game.playerHP, game.turn, game.canAttack, game.canMove], [0, 4, false, false]);
  const finalState = structuredClone(game);
  game.choose(2, 1);
  game.endTurn();
  assert.deepEqual(structuredClone(game), finalState);
});

test('敵のターン中に味方が反撃で撃破した場合も勝利になる', () => {
  const game = beginEncounter();
  game.enemyHP = 1;
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 1, terrain: '草原', mitigation: 0, playerHP: 6, enemyHP: 1},
    {attacker: 'player', damage: 1, terrain: '草原', mitigation: 0, playerHP: 6, enemyHP: 0},
  ]);
  assert.deepEqual([game.result, game.enemy, game.turn], ['victory', null, 2]);
});

test('攻撃力の境界を適用し、相手の残りHPを超えるダメージは発生しない', () => {
  for (const [hp, expected] of [[1, 1], [3, 1], [4, 2], [7, 2], [8, 3], [10, 3]]) {
    const game = new TrainingMap('battle');
    game.x = 3;
    game.y = 2;
    game.playerHP = hp;
    const [first] = game.choose(3, 1);
    assert.equal(first.damage, expected, `HP${hp}`);
    assert.equal(first.enemyHP, 10 - expected);
  }

  const game = new TrainingMap('battle');
  game.x = 3;
  game.y = 2;
  game.enemyHP = 2;
  assert.deepEqual(game.choose(3, 1), [{attacker: 'player', damage: 2, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 0}]);
});

test('訓練と歩兵戦は独立し、訓練の敵は動かず1回で撃破される', () => {
  const training = new TrainingMap();
  const battle = beginEncounter();
  assert.deepEqual([training.maxHP, training.playerHP, training.enemyHP], [10, 1, 1]);
  training.endTurn();
  assert.deepEqual(training.enemy, {x: 4, y: 1});
  training.choose(2, 2);
  training.choose(3, 1);
  training.choose(4, 1);
  assert.deepEqual([training.enemy, training.result], [null, null]);
  assert.deepEqual([battle.enemy, battle.playerHP, battle.enemyHP], [{x: 3, y: 2}, 7, 8]);
});

test('味方の先攻は敵の山、敵の反撃は味方の森で軽減する', () => {
  const game = new TrainingMap('battle');
  game.choose(1, 3);
  game.choose(1, 2);
  game.endTurn();
  game.choose(1, 2);
  assert.equal(game.canMoveTo(2, 2), true);
  game.choose(2, 2);
  assert.deepEqual(game.choose(2, 1), [
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 2, playerHP: 10, enemyHP: 9},
    {attacker: 'enemy', damage: 2, terrain: '森', mitigation: 1, playerHP: 8, enemyHP: 9},
  ]);
});

test('森と山でも最低1ダメージになり、HP0の部隊は反撃しない', () => {
  const game = new TrainingMap('battle');
  game.x = 2;
  game.y = 2;
  game.enemy = {x: 2, y: 1};
  game.playerHP = 4;
  game.enemyHP = 2;
  assert.deepEqual(game.choose(2, 1), [
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 1, playerHP: 4, enemyHP: 1},
    {attacker: 'enemy', damage: 1, terrain: '森', mitigation: 0, playerHP: 3, enemyHP: 1},
  ]);
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 1, terrain: '森', mitigation: 0, playerHP: 2, enemyHP: 1},
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 0, playerHP: 2, enemyHP: 0},
  ]);
  assert.equal(game.result, 'victory');
});
