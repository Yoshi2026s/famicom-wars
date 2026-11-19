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
