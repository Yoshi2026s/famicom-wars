import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

test('未選択では移動せず、歩兵の再選択で取り消せる', () => {
  const map = new BattleMap();
  map.choose(1, 7);
  assert.deepEqual([map.x, map.y, map.turn], [1, 6, 1]);
  map.choose(3, 1);
  assert.equal(map.selected, true);
  map.choose(3, 1);
  assert.equal(map.selected, false);
});

test('D2の歩兵は地形を考慮し、味方のマスを通過して移動力2の範囲を選べる', () => {
  const map = new BattleMap();
  map.choose(3, 1);
  assert.deepEqual([...map.movementTargets().keys()].sort(), ['1,1', '2,0', '2,2', '3,0', '3,2', '4,0', '4,1', '5,1']);
  for (const [x, y] of [[-1, 1], [3, 1.5], [14, 2], [4, 10], [5, 0], [2, 1]]) {
    assert.equal(map.canMoveTo(x, y), false);
  }
  map.choose(5, 0);
  assert.deepEqual([map.x, map.y, map.selected, map.moved], [3, 1, true, false]);
});

test('同じターンにもう一度移動できず、次のターンは移動先から再開する', () => {
  const map = new BattleMap();
  map.choose(3, 1);
  map.choose(3, 0);
  map.choose(3, 0);
  map.choose(2, 0);
  assert.deepEqual([map.x, map.y, map.selected, map.moved], [3, 0, false, true]);
  map.endTurn();
  assert.deepEqual([map.x, map.y, map.turn, map.moved], [3, 0, 2, false]);
  map.choose(3, 0);
  map.choose(2, 0);
  assert.deepEqual([map.x, map.y, map.moved], [2, 0, true]);
});

test('選択中でも移動せずにターン終了でき、選択が解除される', () => {
  const map = new BattleMap();
  map.choose(3, 1);
  map.endTurn();
  map.choose(3, 0);
  assert.deepEqual([map.turn, map.x, map.y, map.selected, map.moved], [2, 3, 1, false, false]);
});

test('斜めの敵を攻撃できず、隣接した場合も移動を先に選べる', () => {
  const map = new BattleMap();
  const infantry = map.friendlyUnits[1];
  const enemy = map.enemyUnits[0];
  Object.assign(infantry, {x: 10, y: 1});
  Object.assign(enemy, {x: 11, y: 2});
  map.choose(10, 1);
  assert.equal(map.canAttack, false);
  assert.equal(map.choose(11, 2), undefined);
  assert.equal(enemy.hp, 10);
  enemy.y = 1;
  assert.equal(map.canAttack, true);
  map.choose(10, 2);
  assert.equal(infantry.moved, true);
  assert.equal(map.canAttack, false);
  assert.equal(enemy.hp, 10);
});

for (const selected of [true, false]) {
  test(`隣接した敵をその場で攻撃できる（味方${selected ? '選択中' : '未選択'}）`, () => {
    const map = new BattleMap();
    const infantry = map.friendlyUnits[1];
    const enemy = map.enemyUnits[0];
    Object.assign(infantry, {x: 10, y: 1});
    Object.assign(enemy, {x: 11, y: 1, hp: 2});
    map.choose(10, 1);
    if (!selected) map.choose(10, 1);
    assert.equal(map.selected, selected);
    assert.equal(map.canAttack, true);
    assert.equal(map.choose(11, 1).length, 1);
    assert.equal(map.choose(11, 1), undefined);
    assert.deepEqual([map.selected, infantry.moved, infantry.attacked], [false, false, true]);
    map.endTurn();
    assert.equal(enemy.hp, 0);
    assert.equal(map.enemyAt(11, 1), undefined);
  });
}

test('味方のマスは通過できるが、敵のマスは通過できない', () => {
  const map = new BattleMap();
  const [, infantry, support] = map.friendlyUnits;
  map.choose(infantry.x, infantry.y);
  assert.equal(map.canMoveTo(support.x, support.y), false);
  assert.equal(map.canMoveTo(support.x - 1, support.y), true);
  map.choose(infantry.x, infantry.y);
  const enemy = map.enemyUnits[0];
  [enemy.x, enemy.y, support.x, support.y] = [support.x, support.y, enemy.x, enemy.y];
  map.choose(infantry.x, infantry.y);
  assert.equal(map.canMoveTo(enemy.x - 1, enemy.y), false);
});
