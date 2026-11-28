import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

const unit = (game, id) => game.friendlyUnits.find(unit => unit.type.id === id);

// The coastal artillery shelling a scout from out of its reach, so only one hit is rolled.
function shelling(hp, random) {
  const game = new BattleMap('coastal');
  game.random = random;
  const guns = unit(game, 'artillery');
  const scout = game.enemyUnits.find(unit => unit.type.id === 'scout');
  Object.assign(guns, {x: 9, y: 7, hp});
  Object.assign(scout, {x: 12, y: 7});
  game.choose(9, 7);
  return {game, scout};
}

function dice(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

test('実際の攻撃は毎回ダメージが少しぶれ、予告の範囲内に収まる', () => {
  const roll = dice(7);
  const first = shelling(10, roll);
  const [preview] = first.game.previewAttack(first.scout);
  assert.deepEqual(preview.range, [4, 6]);
  const seen = new Set();
  for (let trial = 0; trial < 200; trial++) {
    const {game, scout} = shelling(10, roll);
    const [hit] = game.choose(scout.x, scout.y);
    assert.ok(hit.damage >= preview.range[0] && hit.damage <= preview.range[1], `${hit.damage}`);
    assert.equal(hit.enemyHP, 10 - hit.damage);
    assert.equal(hit.range, undefined);
    seen.add(hit.damage);
  }
  assert.deepEqual([...seen].sort(), [4, 5, 6]);
});

test('残機が少ないほど与えるダメージが減り、戦力差が大きいとダメージ0もある', () => {
  const average = hp => {
    const roll = dice(11);
    let total = 0;
    for (let trial = 0; trial < 300; trial++) {
      const {game, scout} = shelling(hp, roll);
      total += game.choose(scout.x, scout.y)[0].damage;
    }
    return total / 300;
  };
  assert.ok(average(10) > average(6) && average(6) > average(2));

  const low = shelling(1, () => 0);
  assert.deepEqual(low.game.previewAttack(low.scout)[0].range, [0, 1]);
  const [miss] = low.game.choose(low.scout.x, low.scout.y);
  assert.deepEqual([miss.damage, miss.enemyHP], [0, 10]);
  const lucky = shelling(1, () => .99);
  assert.equal(lucky.game.choose(lucky.scout.x, lucky.scout.y)[0].damage, 1);
});

test('攻撃の予告とCPUの行動計画では乱数を使わない', () => {
  const {game, scout} = shelling(10, () => { throw new Error('rolled'); });
  assert.equal(game.previewAttack(scout)[0].damage, 5);
  for (const enemy of game.enemyUnits) game.planEnemyAction(enemy);
});
