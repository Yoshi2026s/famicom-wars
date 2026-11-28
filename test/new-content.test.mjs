import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import './fixed-dice.mjs';
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
  const spot = land(game, (x, y) => game.terrainAt(x + 1, y).id === 'plains' && !game.facilityAt(x + 1, y));
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

test('潜水艦は艦船だけを攻撃し、哨戒艇・駆逐艦・巡洋艦・潜水艦にしか攻撃されない', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const sub = type(game, 'submarine');
  assert.equal(game.damageEstimate(sub, type(game, 'tank')), null);
  assert.ok(game.damageEstimate(sub, type(game, 'battleship')) > 0);
  for (const id of ['bomber', 'helicopter', 'battleship', 'artillery', 'drone']) assert.equal(game.damageEstimate(type(game, id), sub), null, id);
  for (const id of ['patrol', 'destroyer', 'cruiser', 'submarine']) assert.ok(game.damageEstimate(type(game, id), sub) > 0, id);
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
  // A heavy tank's plating is one class above a tank gun, so the hit is also cut to 70%.
  assert.equal(game.damageEstimate(type(game, 'tank'), type(game, 'heavytank'), {cover: 0}), 3);
});

test('CPUは占領の続きより、届く本拠地の占領を優先する', () => {
  const game = BattleMap.newMatch(undefined, 1);
  const hq = game.headquarters.friendly;
  const gap = site => Math.abs(site.x - hq.x) + Math.abs(site.y - hq.y);
  const site = game.sites.filter(item => item.kind !== 'headquarters' && item.owner !== 'enemy').sort((a, b) => gap(a) - gap(b))[0];
  assert.ok(gap(site) <= 3);
  game.enemyUnits.push({type: type(game, 'infantry'), name: '歩兵', x: site.x, y: site.y, hp: 10, readyTurn: 1, moved: false, attacked: false});
  site.capture = {side: 'enemy', unit: '歩兵', points: 5};
  game.beginEnemyTurn();
  const action = game.prepareEnemyAction();
  assert.deepEqual([action.to.x, action.to.y], [hq.x, hq.y]);
});

test('雪原・密林・岩礁の移動コストと防御', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const find = id => {
    for (let y = 0; y < game.height; y++) {
      const x = game.terrain[y].indexOf(id);
      if (x >= 0) return {x, y};
    }
    return null;
  };
  const snow = find('n'), jungle = find('j');
  assert.ok(snow && jungle);
  const cost = (id, at) => game.movementCost(type(game, id), at.x, at.y);
  assert.deepEqual([cost('infantry', snow), cost('tank', snow), cost('helicopter', snow)], [2, 2, 1]);
  assert.deepEqual([cost('infantry', jungle), cost('tank', jungle)], [2, 3]);
  assert.equal(game.coverAt(jungle.x, jungle.y), 2);
  let reef = null;
  for (let seed = 1; seed < 40 && !reef; seed++) {
    const map = generator.generateMap(seed);
    const y = map.terrain.findIndex(row => row.includes('e'));
    if (y >= 0) reef = BattleMap.newMatch('coastal', seed);
  }
  assert.ok(reef);
  const y = reef.terrain.findIndex(row => row.includes('e'));
  const x = reef.terrain[y].indexOf('e');
  assert.deepEqual([type(reef, 'patrol'), type(reef, 'infantry'), type(reef, 'fighter')].map(t => reef.movementCost(t, x, y)), [Infinity, Infinity, 1]);
});

test('要塞の地上部隊は防御3、野戦病院では地上部隊が3回復する', () => {
  const game = BattleMap.newMatch('coastal', 5);
  const fortress = game.sites.find(site => site.kind === 'fortress');
  assert.ok(fortress);
  assert.equal(game.coverAt(fortress.x, fortress.y), 3);
  const tank = type(game, 'tank'), infantry = type(game, 'infantry');
  assert.equal(game.damageEstimate(tank, infantry, {cover: game.coverAt(fortress.x, fortress.y)}), 3);
  let hospital = null, seed = 1;
  for (; seed < 60 && !hospital; seed++) {
    const candidate = BattleMap.newMatch('coastal', seed);
    const site = candidate.sites.find(item => item.kind === 'hospital');
    if (site) hospital = {game: candidate, site};
  }
  assert.ok(hospital);
  const {game: field, site} = hospital;
  site.owner = 'friendly';
  const unit = place(field, 'friendly', 'infantry', site.x, site.y);
  unit.hp = 4;
  field.funds.friendly = 20000;
  field.endTurn();
  while (field.enemyTurn) {
    const action = field.prepareEnemyAction();
    if (!action) break;
    field.resolveEnemyAction(action);
  }
  field.finishEnemyTurn?.();
  assert.equal(unit.hp, 7);
});

test('追加の兵種: 迫撃砲兵は山を越えるが占領できず、対空ミサイル車は航空部隊だけを狙う', () => {
  const game = BattleMap.newMatch('coastal', 3);
  const mortar = type(game, 'mortar'), sam = type(game, 'samlauncher');
  assert.equal(mortar.foot, true);
  assert.equal(mortar.captures, undefined);
  assert.equal(game.damageEstimate(sam, type(game, 'tank')), null);
  assert.ok(game.damageEstimate(sam, type(game, 'bomber')) >= 7);
  assert.equal(game.damageEstimate(type(game, 'striker'), type(game, 'fighter')), null);
  assert.ok(game.damageEstimate(type(game, 'cruiser'), type(game, 'submarine')) > 0);
});

test('CPUの瀕死部隊は、いま立っている回復施設に留まって回復する', () => {
  const game = BattleMap.newMatch('coastal', 1, {difficulty: 'normal'});
  const cities = game.sites.filter(site => site.kind === 'city');
  for (const city of cities) city.owner = 'enemy';
  const hq = game.headquarters.friendly;
  const gap = site => Math.abs(site.x - hq.x) + Math.abs(site.y - hq.y);
  const city = [...cities].sort((a, b) => gap(b) - gap(a))[0];
  const tank = {type: type(game, 'tank'), name: '戦車', x: city.x, y: city.y, hp: 3, readyTurn: 1, moved: false, attacked: false};
  game.enemyUnits.push(tank);
  game.friendlyUnits.push({type: type(game, 'infantry'), name: '歩兵', x: hq.x, y: hq.y, hp: 10, readyTurn: 1, moved: false, attacked: false});
  game.funds.enemy = 50000;
  game.beginEnemyTurn();
  const action = game.prepareEnemyAction();
  assert.deepEqual([action.to.x, action.to.y], [city.x, city.y]);
});

test('要塞で軽減した攻撃は、地形ではなく要塞の軽減として表示する', () => {
  const game = BattleMap.newMatch('coastal', 1);
  const fortress = game.sites.find(site => site.kind === 'fortress');
  const plainsNext = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({x: fortress.x + dx, y: fortress.y + dy}))
    .find(at => game.terrainAt(at.x, at.y).id === 'plains' && !game.facilityAt(at.x, at.y));
  assert.ok(plainsNext);
  const tank = place(game, 'friendly', 'tank', plainsNext.x, plainsNext.y);
  const target = place(game, 'enemy', 'infantry', fortress.x, fortress.y);
  game.activeUnit = tank;
  const [hit] = game.previewAttack(target);
  assert.equal(hit.terrain, '要塞');
  assert.ok(hit.mitigation > 0);
});
