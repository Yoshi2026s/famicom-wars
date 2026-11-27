import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import generator from '../public/map-generator.js';

const {generateMap, validateGeneratedMap} = generator;
const roundTrip = state => BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(state)));

test('ランダムマップは同じ種なら同じ形になり、左右対称で両軍の施設がそろう', () => {
  const layouts = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const map = generateMap(seed);
    assert.deepEqual(generateMap(seed), map);
    assert.equal(validateGeneratedMap(map), true);
    assert.deepEqual([map.width, map.height], [26, 18]);
    for (const row of map.terrain) assert.equal([...row].reverse().join(''), row);
    const {friendly, enemy} = map.headquarters;
    assert.deepEqual([enemy.x, enemy.y], [map.width - 1 - friendly.x, friendly.y]);
    const count = (owner, kind) => map.sites.filter(site => site.owner === owner && site.kind === kind).length;
    for (const kind of ['factory', 'city', 'airfield', 'port']) assert.equal(count('friendly', kind), count('enemy', kind), kind);
    assert.ok(count('friendly', 'factory') >= 1);
    layouts.add(map.terrain.join(''));
  }
  assert.ok(layouts.size >= 55, '種ごとに違う地形になる');
});

test('新しい対戦は毎回別のマップで、両軍とも部隊なしで始まり初手から生産できる', () => {
  const first = BattleMap.newMatch('coastal', 101);
  const second = BattleMap.newMatch('coastal', 202);
  assert.notDeepEqual(first.terrain, second.terrain);
  const game = first;
  assert.deepEqual([game.friendlyUnits.length, game.enemyUnits.length], [0, 0]);
  assert.deepEqual(game.funds, {friendly: 10000, enemy: 10000});
  assert.equal(game.result, null);
  assert.equal(game.canMove, false);
  assert.equal(game.canAttack, false);
  assert.deepEqual([game.activeUnit.x, game.activeUnit.y], [game.headquarters.friendly.x, game.headquarters.friendly.y]);

  const home = game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y);
  assert.equal(game.productionStatus(home), 'ready');
  const infantry = game.produce('infantry', home);
  assert.equal(game.activeUnit, infantry);
  const factory = game.sites.find(site => site.kind === 'factory' && site.owner === 'friendly');
  assert.equal(game.produce('tank', factory)?.type.id, 'tank');

  game.endTurn();
  assert.equal(game.turn, 2);
  assert.ok(game.enemyUnits.length >= 1, 'CPUも最初のターンに生産する');
  assert.ok(game.enemyUnits.every(unit => unit.readyTurn === 2));
  assert.equal(game.result, null);
});

test('部隊を出していない側は全滅扱いにならず、CPUは相手が部隊なしでも生産する', () => {
  const game = BattleMap.newMatch('coastal', 7);
  game.endTurn();
  assert.equal(game.result, null);
  assert.equal(game.friendlyUnits.length, 0);
  assert.ok(game.enemyUnits.length >= 1);
  for (const unit of game.enemyUnits) unit.hp = 0;
  assert.equal(game.result, 'victory');
});

test('ランダムマップの対戦は部隊なしの状態でも保存から同じマップで再開でき、壊れた地図は受け付けない', () => {
  const game = BattleMap.newMatch('coastal', 4242);
  const empty = game.crossingSnapshot();
  assert.equal(empty.activeUnit, -1);
  const resumed = roundTrip(empty);
  assert.ok(resumed);
  assert.deepEqual(resumed.terrain, game.terrain);
  assert.deepEqual(resumed.crossingSnapshot(), empty);

  game.produce('infantry', game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y));
  game.endTurn();
  const saved = game.crossingSnapshot();
  const loaded = roundTrip(saved);
  assert.deepEqual(loaded.crossingSnapshot(), saved);
  assert.deepEqual(loaded.sites.map(({kind, x, y}) => [kind, x, y]), game.sites.map(({kind, x, y}) => [kind, x, y]));

  const broken = JSON.parse(JSON.stringify(saved));
  broken.map.terrain[0] = 'x'.repeat(broken.map.width);
  assert.equal(roundTrip(broken), null);
  const unfair = JSON.parse(JSON.stringify(saved));
  unfair.map.sites = unfair.map.sites.filter(site => !(site.owner === 'enemy' && site.kind === 'factory'));
  assert.equal(roundTrip(unfair), null);
});

test('施設での回復は兵種価格の1割×回復HPを払い、足りなければ払える分だけ回復する', () => {
  const game = BattleMap.newMatch('coastal', 99);
  const home = game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y);
  const tank = game.produce('tank', home);
  game.endTurn();
  tank.hp = 5;
  // Income arrives first; leave exactly enough for one HP of tank repair (400).
  game.funds.friendly = 400 - game.incomeFor('friendly');
  for (const enemy of game.enemyUnits) enemy.readyTurn = game.turn + 2;
  game.funds.enemy = 0;
  game.endTurn();
  assert.equal(tank.hp, 6);
  assert.equal(game.funds.friendly, 0);
  assert.deepEqual(game.facilityHealing.filter(({side}) => side === 'friendly'),
    [{side: 'friendly', unit: '戦車', amount: 1, facility: 'headquarters', cost: 400}]);

  game.funds.friendly = 50000;
  game.endTurn();
  assert.equal(tank.hp, 8);
  assert.equal(game.funds.friendly, 50000 + game.incomeFor('friendly') - 800);
});
