import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import generator from '../public/map-generator.js';

const type = (game, id) => game.unitTypes.find(unit => unit.id === id);
const place = (game, side, id, x, y) => {
  const unit = {type: type(game, id), name: id, x, y, hp: 10, readyTurn: 1, moved: false, attacked: false};
  game[side + 'Units'].push(unit);
  return unit;
};
const land = (game, predicate = () => true) => {
  for (let y = 1; y < game.height - 1; y++) for (let x = 1; x < game.width - 1; x++) {
    if (game.terrainAt(x, y).id === 'plains' && !game.facilityAt(x, y) && predicate(x, y)) return {x, y};
  }
  return null;
};

test('丘陵・廃墟は歩兵系は1、車両は2。山は歩兵系だけが通れる', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const ids = id => Object.values({k: 'hill', u: 'ruins', a: 'beach', m: 'mountain'})[['k', 'u', 'a', 'm'].indexOf(id)];
  const at = id => {
    for (let y = 0; y < game.height; y++) {
      const x = game.terrain[y].indexOf(id);
      if (x >= 0) return {x, y};
    }
    return null;
  };
  for (const id of ['k', 'u', 'a', 'm']) {
    const spot = at(id);
    assert.ok(spot, `${ids(id)} がマップにある`);
    assert.equal(game.terrainAt(spot.x, spot.y).id, ids(id));
    const foot = game.movementCost(type(game, 'antitank'), spot.x, spot.y);
    const vehicle = game.movementCost(type(game, 'heavytank'), spot.x, spot.y);
    if (id === 'm') assert.deepEqual([foot, vehicle], [1, Infinity]);
    else if (id === 'a') assert.deepEqual([foot, vehicle], [1, 1]);
    else assert.deepEqual([foot, vehicle], [1, 2]);
  }
  assert.equal(game.terrainAt(at('u').x, at('u').y).defense, 2);
  assert.equal(game.terrainAt(at('k').x, at('k').y).defense, 1);
});

test('対戦車兵は占領でき車両に強い。重戦車は受けるダメージが1減る', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const antitank = type(game, 'antitank');
  const tank = type(game, 'tank');
  const heavy = type(game, 'heavytank');
  assert.ok(game.damageEstimate(antitank, tank) > game.damageEstimate(type(game, 'infantry'), tank));
  assert.equal(game.damageEstimate(tank, heavy), game.damageEstimate(tank, {...heavy, armor: 0}) - 1);
  const spot = land(game);
  const a = place(game, 'friendly', 'antitank', spot.x, spot.y);
  const t = place(game, 'enemy', 'tank', spot.x + 1, spot.y);
  game.activeUnit = a;
  const [hit] = game.previewAttack(t);
  assert.equal(hit.enemyHP, 10 - game.damageEstimate(antitank, tank));

  const site = game.sites.find(s => s.kind === 'oilfield' && s.owner === 'neutral');
  const holder = place(game, 'friendly', 'antitank', site.x, site.y);
  game.activeUnit = holder;
  game.selected = true;
  assert.equal(game.canCaptureHere, true);
  assert.equal(game.captureHere().completed, true);
  assert.equal(site.owner, 'friendly');
});

test('潜水艦は艦船だけを攻撃し、哨戒艇・駆逐艦・潜水艦にしか攻撃されない', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const sub = type(game, 'submarine');
  assert.equal(game.damageEstimate(sub, type(game, 'tank')), null);
  assert.ok(game.damageEstimate(sub, type(game, 'battleship')) > 0);
  for (const id of ['bomber', 'helicopter', 'battleship', 'artillery', 'drone']) assert.equal(game.damageEstimate(type(game, id), sub), null, id);
  for (const id of ['patrol', 'destroyer', 'submarine']) assert.ok(game.damageEstimate(type(game, id), sub) > 0, id);
});

test('油田は収入2000、補給所は収入500で全種の部隊を半額で回復する', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const base = game.incomeFor('friendly');
  const oil = game.sites.find(s => s.kind === 'oilfield' && s.owner === 'neutral');
  oil.owner = 'friendly';
  assert.equal(game.incomeFor('friendly'), base + 2000);
  let depot = game.sites.find(s => s.kind === 'depot');
  for (let seed = 4; !depot; seed++) {
    const other = BattleMap.newMatch('coastal', seed);
    depot = other.sites.find(s => s.kind === 'depot');
    if (depot) return checkDepot(other, depot);
  }
  checkDepot(game, depot);
});

function checkDepot(game, depot) {
  depot.owner = 'friendly';
  const base = game.incomeFor('friendly');
  depot.owner = 'neutral';
  assert.equal(base - game.incomeFor('friendly'), 500);
  depot.owner = 'friendly';
  const fighter = place(game, 'friendly', 'fighter', depot.x, depot.y);
  fighter.hp = 5;
  for (const enemy of game.enemyUnits) enemy.readyTurn = 99;
  game.funds = {friendly: 0, enemy: 0};
  const income = game.incomeFor('friendly');
  game.endTurn();
  assert.equal(fighter.hp, 7);
  assert.equal(game.funds.friendly, income - 2 * Math.ceil(7500 / 20));
  assert.deepEqual(game.facilityHealing.find(entry => entry.side === 'friendly'),
    {side: 'friendly', unit: 'fighter', amount: 2, facility: 'depot', cost: 2 * Math.ceil(7500 / 20)});
}

test('拡大したマップは生成が速く、新しい地形と施設を含んでも左右対称で公平', () => {
  const started = performance.now();
  let withDepot = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const map = generator.generateMap(seed);
    assert.equal(generator.validateGeneratedMap(map), true);
    for (const row of map.terrain) assert.equal([...row].reverse().join(''), row);
    if (map.sites.some(site => site.kind === 'depot')) withDepot++;
    assert.equal(map.sites.filter(site => site.kind === 'oilfield').length, 2);
  }
  assert.ok(withDepot > 40);
  assert.ok((performance.now() - started) / 80 < 40, '1枚あたり40ms未満');
});

test('地形防御はダメージを最大で半分までしか減らさない', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const infantry = type(game, 'infantry');
  assert.equal(game.damageEstimate(infantry, infantry, {cover: 0}), 3);
  assert.equal(game.damageEstimate(infantry, infantry, {cover: 1}), 2);
  // Ruins and mountains (defense 2) used to cut a firepower-3 hit to 1.
  assert.equal(game.damageEstimate(infantry, infantry, {cover: 2}), 2);
  assert.equal(game.damageEstimate(type(game, 'tank'), infantry, {cover: 2}), 3);
  assert.equal(game.damageEstimate(type(game, 'tank'), type(game, 'heavytank'), {cover: 0}), 4);
});
