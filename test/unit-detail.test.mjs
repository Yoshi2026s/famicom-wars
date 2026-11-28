import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import './fixed-dice.mjs';

const roundTrip = state => BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(state)));

test('ダメージ目安は実際の攻撃と同じ値になり、狙えない相手はnullになる', () => {
  const game = new BattleMap('coastal');
  const type = id => game.unitTypes.find(unit => unit.id === id);
  const attacker = game.friendlyUnits.find(unit => unit.type.id === 'infantry');
  const target = game.enemyUnits.find(unit => unit.type.id === 'scout');
  Object.assign(target, {x: attacker.x + 1, y: attacker.y});
  game.activeUnit = attacker;
  const [hit] = game.previewAttack(target);
  const cover = game.terrainAt(target.x, target.y).defense;
  assert.equal(game.damageEstimate(attacker.type, target.type, {cover}), hit.damage);
  assert.equal(game.damageEstimate(type('fighter'), type('tank')), null);
  assert.equal(game.damageEstimate(type('antiair'), type('helicopter')), 6);
  assert.equal(game.damageEstimate(type('infantry'), type('helicopter')), null);
  assert.equal(game.damageEstimate(type('tank'), type('scout'), {hp: 5}), Math.round(6 * .5));
});

test('次の行動での移動範囲と攻撃範囲を、行動済みでも敵味方どちらでも求められる', () => {
  const game = new BattleMap('coastal');
  const scout = game.friendlyUnits.find(unit => unit.type.id === 'scout');
  game.choose(scout.x, scout.y);
  const expected = game.movementTargets();
  const {move, attack} = game.unitReach(scout);
  assert.deepEqual([...move.keys()].sort(), [...expected.keys()].sort());
  // A direct-fire unit can strike every tile next to wherever it can stop.
  for (const key of move.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (x + dx >= 0 && y + dy >= 0 && x + dx < game.width && y + dy < game.height) assert.ok(attack.has(`${x + dx},${y + dy}`));
    }
  }
  scout.moved = true;
  assert.equal(game.unitReach(scout).move.size, move.size);

  const guns = game.enemyUnits.find(unit => unit.type.id === 'artillery');
  const reach = game.unitReach(guns);
  // Indirect fire only from where it stands: range 2〜4 around its own tile.
  for (const key of reach.attack) {
    const [x, y] = key.split(',').map(Number);
    const distance = Math.abs(x - guns.x) + Math.abs(y - guns.y);
    assert.ok(distance >= 2 && distance <= 4, key);
  }
  assert.ok(reach.move.size > 0);
});

test('CPUの強さは3段階で、収入に反映され、保存と再開でも維持される', () => {
  assert.deepEqual(BattleMap.difficulties, ['easy', 'normal', 'hard']);
  const incomes = {};
  for (const level of BattleMap.difficulties) {
    const game = BattleMap.newMatch('coastal', 77, {difficulty: level});
    assert.equal(game.difficulty, level);
    incomes[level] = game.incomeFor('enemy');
    assert.equal(game.incomeFor('friendly'), BattleMap.newMatch('coastal', 77).incomeFor('friendly'));
    const loaded = roundTrip(game.crossingSnapshot());
    assert.equal(loaded.difficulty, level);
  }
  assert.ok(incomes.easy < incomes.normal && incomes.normal < incomes.hard);
  assert.equal(new BattleMap('coastal', {difficulty: 'unknown'}).difficulty, 'normal');
  const state = BattleMap.newMatch('coastal', 5).crossingSnapshot();
  assert.equal(roundTrip({...state, difficulty: 'nightmare'}), null);
  const {difficulty, ...older} = state;
  assert.equal(roundTrip(older).difficulty, 'normal');
});

test('やさしいCPUも同じ盤面で必ず合法な行動を選び、対戦を進められる', () => {
  for (const level of BattleMap.difficulties) {
    const game = BattleMap.newMatch('coastal', 2024, {difficulty: level});
    for (let turn = 0; turn < 6 && !game.result; turn++) game.endTurn();
    assert.ok(game.enemyUnits.length > 0, level);
    for (const unit of game.enemyUnits) {
      assert.ok(Number.isFinite(game.movementCost(unit.type, unit.x, unit.y)), `${level} ${unit.name}`);
    }
  }
});
