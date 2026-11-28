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

const type = (game, id) => game.unitTypes.find(unit => unit.id === id);

test('歩兵はHP10でも重戦車・戦艦などの重装甲にはダメージ0か1しか与えられない', () => {
  const game = new BattleMap('coastal');
  const infantry = type(game, 'infantry');
  for (const id of ['heavytank', 'battleship', 'cruiser']) {
    assert.ok(game.damageEstimate(infantry, type(game, id)) <= 1, id);
  }
  // Small arms cannot reach aircraft at all; a helicopter's guns barely scratch a fighter.
  assert.equal(game.damageEstimate(infantry, type(game, 'fighter')), null);
  assert.ok(game.damageEstimate(type(game, 'helicopter'), type(game, 'fighter')) <= 1);
  // Anti-tank troops' specialty ignores the plating gap.
  assert.ok(game.damageEstimate(type(game, 'antitank'), type(game, 'heavytank')) >= 4);
});

// Two adjacent coastal units on plains: the friendly one attacks the enemy one.
function duel(attackerId, defenderId, random) {
  const game = new BattleMap('coastal');
  game.random = random;
  const actor = game.friendlyUnits[0];
  const target = game.enemyUnits[0];
  for (const [unit, id, x] of [[actor, attackerId, 0], [target, defenderId, 1]]) {
    let spot = null;
    for (let y = 0; y < game.height && !spot; y++) {
      for (let column = 0; column + 1 < game.width && !spot; column++) {
        if (game.terrainAt(column, y).id === 'plains' && game.terrainAt(column + 1, y).id === 'plains'
          && !game.facilityAt(column, y) && !game.facilityAt(column + 1, y)) spot = {x: column, y};
      }
    }
    Object.assign(unit, {type: type(game, id), hp: 10, readyTurn: 1, x: spot.x + x, y: spot.y});
  }
  for (const other of [...game.friendlyUnits, ...game.enemyUnits]) if (other !== actor && other !== target) other.hp = 0;
  game.activeUnit = actor;
  return {game, target};
}

test('重装甲への攻撃は何度試してもダメージ0か1で、0も出る', () => {
  const roll = dice(3);
  const seen = new Set();
  for (let trial = 0; trial < 100; trial++) {
    const {game, target} = duel('infantry', 'heavytank', roll);
    seen.add(game.choose(target.x, target.y)[0].damage);
  }
  assert.deepEqual([...seen].sort(), [0, 1]);
});

test('特効相手にはクリティカルが出ることがあり、得意でない相手には出ない', () => {
  const roll = dice(5);
  let criticals = 0;
  for (let trial = 0; trial < 200; trial++) {
    const {game, target} = duel('antitank', 'tank', roll);
    const [preview] = game.previewAttack(target);
    const [hit] = game.choose(target.x, target.y);
    assert.ok(hit.damage <= preview.range[1]);
    if (hit.critical) {
      criticals++;
      assert.ok(hit.damage > preview.range[0]);
    }
  }
  assert.ok(criticals > 20 && criticals < 90, `${criticals}`);
  for (let trial = 0; trial < 50; trial++) {
    const {game, target} = duel('infantry', 'infantry', roll);
    assert.equal(game.choose(target.x, target.y)[0].critical, undefined);
  }
});
