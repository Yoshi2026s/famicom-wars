import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

function adjacentInfantry(friendlyPosition = {x: 10, y: 1}, enemyPosition = {x: 11, y: 1}) {
  const map = new BattleMap();
  const friendly = map.friendlyUnits[1];
  const enemy = map.enemyUnits[0];
  Object.assign(friendly, friendlyPosition);
  Object.assign(enemy, enemyPosition);
  map.choose(friendly.x, friendly.y);
  return {map, friendly, enemy};
}

test('敵の行動計画を調べても位置・ターン・HPが変わらない', () => {
  const map = new BattleMap();
  map.choose(3, 1);
  map.choose(4, 1);
  const before = map.crossingSnapshot();
  const plan = map.planEnemyAction(map.enemyUnits[0]);
  assert.deepEqual(plan.from, {x: 7, y: 1});
  assert.deepEqual(plan.to, {x: 5, y: 1});
  assert.deepEqual(plan.path, [{x: 6, y: 1}, {x: 5, y: 1}]);
  assert.equal(plan.friendly, map.activeUnit);
  assert.deepEqual(map.crossingSnapshot(), before);
});

test('味方が先手なら敵は1回反撃し、撃破された側は反撃しない', () => {
  const {map, enemy} = adjacentInfantry();
  assert.deepEqual(map.choose(enemy.x, enemy.y), [
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 7},
    {attacker: 'enemy', damage: 2, terrain: '草原', mitigation: 0, playerHP: 8, enemyHP: 7},
  ]);
  assert.equal(map.choose(enemy.x, enemy.y), undefined);
  assert.equal(map.canMove, false);

  const final = adjacentInfantry();
  final.enemy.hp = 2;
  final.map.enemyUnits.slice(1).forEach(unit => { unit.hp = 0; });
  assert.deepEqual(final.map.choose(final.enemy.x, final.enemy.y), [
    {attacker: 'player', damage: 2, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 0},
  ]);
  assert.equal(final.map.result, 'victory');
  const settled = final.map.crossingSnapshot();
  final.map.endTurn();
  final.map.choose(final.enemy.x, final.enemy.y);
  assert.deepEqual(final.map.crossingSnapshot(), settled);
});

test('全滅で敗北すると行動もターンも止まる', () => {
  const {map, friendly} = adjacentInfantry();
  friendly.hp = 2;
  map.friendlyUnits.filter(unit => unit !== friendly).forEach(unit => { unit.hp = 0; });
  assert.deepEqual(map.endTurn(), [
    {attacker: 'enemy', damage: 2, terrain: '草原', mitigation: 0, playerHP: 0, enemyHP: 10},
  ]);
  assert.deepEqual([map.result, map.turn, map.canAttack, map.canMove], ['defeat', 1, false, false]);
  const settled = map.crossingSnapshot();
  map.choose(9, 1);
  map.endTurn();
  assert.deepEqual(map.crossingSnapshot(), settled);
});

test('敵ターンの反撃で最後の敵を撃破すると勝利になる', () => {
  const {map, enemy} = adjacentInfantry();
  enemy.hp = 1;
  map.enemyUnits.slice(1).forEach(unit => { unit.hp = 0; });
  assert.deepEqual(map.endTurn(), [
    {attacker: 'enemy', damage: 1, terrain: '草原', mitigation: 0, playerHP: 9, enemyHP: 1},
    {attacker: 'player', damage: 1, terrain: '草原', mitigation: 0, playerHP: 9, enemyHP: 0},
  ]);
  assert.deepEqual([map.result, map.enemy, map.turn], ['victory', null, 1]);
});

test('攻撃力の境界を適用し、相手の残りHPを超えるダメージは発生しない', () => {
  for (const [hp, expected] of [[1, 1], [3, 1], [4, 2], [7, 2], [8, 3], [10, 3]]) {
    const {map, friendly, enemy} = adjacentInfantry();
    friendly.hp = hp;
    const [first] = map.choose(enemy.x, enemy.y);
    assert.equal(first.damage, expected, 'HP' + hp);
    assert.equal(first.enemyHP, 10 - expected);
  }
  const {map, enemy} = adjacentInfantry();
  enemy.hp = 2;
  assert.deepEqual(map.choose(enemy.x, enemy.y), [
    {attacker: 'player', damage: 2, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 0},
  ]);
});

test('味方の先攻は敵の山、敵の反撃は味方の森で軽減する', () => {
  const {map, enemy} = adjacentInfantry({x: 1, y: 0}, {x: 2, y: 0});
  assert.deepEqual(map.choose(enemy.x, enemy.y), [
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 2, playerHP: 10, enemyHP: 9},
    {attacker: 'enemy', damage: 2, terrain: '森', mitigation: 1, playerHP: 8, enemyHP: 9},
  ]);
});

test('森と山でも最低1ダメージになる', () => {
  const {map, friendly, enemy} = adjacentInfantry({x: 1, y: 0}, {x: 2, y: 0});
  friendly.hp = 4;
  enemy.hp = 2;
  assert.deepEqual(map.choose(enemy.x, enemy.y), [
    {attacker: 'player', damage: 1, terrain: '山', mitigation: 1, playerHP: 4, enemyHP: 1},
    {attacker: 'enemy', damage: 1, terrain: '森', mitigation: 0, playerHP: 3, enemyHP: 1},
  ]);
});
