import assert from 'node:assert/strict';
import { test } from 'node:test';
import TrainingMap from '../public/rules.js';

test('未選択では移動せず、歩兵の再選択で取り消せる', () => {
  const map = new TrainingMap();
  map.choose(1, 2);
  assert.deepEqual([map.x, map.y, map.turn], [2, 2, 1]);
  map.choose(2, 2);
  assert.equal(map.selected, true);
  map.choose(2, 2);
  assert.equal(map.selected, false);
});

test('中央から上下左右の合計2マス以内の12マスだけが移動先になる', () => {
  const map = new TrainingMap();
  map.choose(2, 2);
  const targets = [];
  for (let x = 0; x < TrainingMap.size; x++) {
    for (let y = 0; y < TrainingMap.size; y++) {
      if (map.canMoveTo(x, y)) targets.push([x, y]);
    }
  }
  assert.deepEqual(targets, [[0,2],[1,1],[1,2],[1,3],[2,0],[2,1],[2,3],[2,4],[3,1],[3,2],[3,3],[4,2]]);
  map.choose(4, 4);
  assert.deepEqual([map.x, map.y, map.selected, map.moved], [2, 2, true, false]);
});

test('移動後は同じターンの再移動を防ぎ、次のターンは移動先から再開する', () => {
  const map = new TrainingMap();
  map.choose(2, 2);
  map.choose(0, 2);
  map.choose(0, 2);
  map.choose(1, 2);
  assert.deepEqual([map.x, map.y, map.selected, map.moved], [0, 2, false, true]);
  map.endTurn();
  assert.deepEqual([map.x, map.y, map.turn, map.moved], [0, 2, 2, false]);
  map.choose(0, 2);
  for (const [x, y] of [[-1, 2], [0, 1.5], [5, 2], [0, 5]]) {
    assert.equal(map.canMoveTo(x, y), false);
  }
  map.choose(0, 0);
  assert.deepEqual([map.x, map.y, map.moved], [0, 0, true]);
});

test('選択中でも移動せずにターン終了でき、選択が解除される', () => {
  const map = new TrainingMap();
  map.choose(2, 2);
  map.endTurn();
  map.choose(2, 1);
  assert.deepEqual([map.turn, map.x, map.y, map.selected, map.moved], [2, 2, 2, false, false]);
});

test('移動前や斜め・範囲外から敵を選んでも攻撃は発生しない', () => {
  for (const [x, y] of [[3, 2], [0, 2]]) {
    const map = new TrainingMap();
    assert.deepEqual(map.enemy, {x: 4, y: 1});
    map.choose(4, 1);
    map.choose(2, 2);
    map.choose(4, 1);
    assert.equal(map.selected, true);
    map.choose(x, y);
    map.choose(4, 1);
    assert.deepEqual([map.x, map.y, map.canAttack, map.attacked], [x, y, false, false]);
    assert.equal(map.isEnemyAt(4, 1), true);
  }
});

test('上下左右の隣から敵だけを攻撃でき、連打やターン終了で敵は復活しない', () => {
  for (const [enemyX, enemyY] of [[0, 2], [2, 2], [1, 1], [1, 3]]) {
    const map = new TrainingMap();
    map.x = 1;
    map.y = 0;
    map.enemy = {x: enemyX, y: enemyY};
    // Reach B3 from B4 if the enemy blocks the northern approach.
    if (enemyY === 1) map.y = 3;
    map.choose(map.x, map.y);
    map.choose(1, 2);
    assert.equal(map.canAttack, true);
    map.choose(3, 3);
    map.choose(1, 2);
    assert.equal(map.canAttack, true);
    map.choose(enemyX, enemyY);
    map.choose(enemyX, enemyY);
    assert.deepEqual([map.x, map.y, map.enemy, map.attacked, map.canAttack], [1, 2, null, true, false]);
    map.endTurn();
    assert.equal(map.attacked, false);
    map.choose(1, 2);
    map.choose(enemyX, enemyY);
    assert.deepEqual([map.x, map.y, map.enemy], [enemyX, enemyY, null]);
  }
});

test('攻撃を見送ると権利が切れ、敵のいるマスには入れず通過もできない', () => {
  const map = new TrainingMap();
  map.choose(2, 2);
  map.choose(4, 2); // E3, just below the enemy at E2.
  assert.equal(map.canAttack, true);
  map.endTurn();
  map.choose(4, 1);
  assert.equal(map.canAttack, false);
  assert.equal(map.isEnemyAt(4, 1), true);
  map.choose(4, 2);
  assert.equal(map.canMoveTo(4, 0), false);
  assert.equal(map.canMoveTo(4, 1), false);
  map.choose(4, 1);
  assert.deepEqual([map.x, map.y, map.moved, map.selected], [4, 2, false, true]);
  map.choose(3, 1); // D2 is accessible through D3.
  assert.equal(map.canAttack, true);
  map.choose(4, 1);
  assert.equal(map.enemy, null);
});
