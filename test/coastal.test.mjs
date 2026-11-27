import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import {createCrossingSave, crossingSaveKey} from '../public/crossing-save.js';

const roundTrip = state => BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(state)));
const type = (game, id) => game.unitTypes.find(unit => unit.id === id);
const unit = (game, id) => game.friendlyUnits.find(unit => unit.type.id === id);
const sites = (game, kind, owner = 'friendly') => game.sites.filter(site => site.kind === kind && site.owner === owner);

function move(game, actor, x, y) {
  game.choose(actor.x, actor.y);
  assert.equal(game.canMoveTo(x, y), true, `${actor.name} → ${x},${y}`);
  game.choose(x, y);
  assert.equal(game.friendlyAt(x, y), actor);
}

function leaveEnemiesWaiting(game) {
  for (const enemy of game.enemyUnits) enemy.readyTurn = game.turn + 1;
  game.funds.enemy = 0;
}

test('湾岸の攻防では左右の陸路と海域がつながり、施設と初期部隊は合法な位置にある', () => {
  const game = new BattleMap('coastal');
  assert.equal(game.name, '湾岸の攻防');
  assert.deepEqual([game.width, game.height], [26, 18]);
  assert.equal(game.sites.length, 22);
  assert.equal(new Set(game.sites.map(({x, y}) => `${x},${y}`)).size, game.sites.length);
  for (const row of game.terrain) {
    assert.equal(row.length, game.width);
    assert.equal([...row].reverse().join(''), row);
  }
  for (const side of ['friendly', 'enemy']) {
    for (const actor of game[side + 'Units']) {
      assert.ok(Number.isFinite(game.movementCost(actor.type, actor.x, actor.y)), actor.name);
    }
  }
  for (const [unitId, from, to] of [
    ['infantry', game.headquarters.friendly, game.headquarters.enemy],
    ['patrol', sites(game, 'port')[0], sites(game, 'port', 'enemy')[1]],
  ]) {
    const actor = type(game, unitId);
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    for (const {x, y} of queue) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nextX = x + dx;
        const nextY = y + dy;
        const key = `${nextX},${nextY}`;
        if (nextX < 0 || nextY < 0 || nextX >= game.width || nextY >= game.height || seen.has(key)) continue;
        if (!Number.isFinite(game.movementCost(actor, nextX, nextY))) continue;
        seen.add(key);
        queue.push({x: nextX, y: nextY});
      }
    }
    assert.ok(seen.has(`${to.x},${to.y}`), unitId);
    if (unitId === 'patrol') {
      for (const port of game.sites.filter(site => site.kind === 'port')) {
        assert.ok(seen.has(`${port.x},${port.y}`), `港 ${port.x},${port.y}`);
      }
    }
  }
});

test('地形による移動費を陸海空で区別し、航空部隊も他の部隊のマスには停止できない', () => {
  const game = new BattleMap('coastal');
  const ground = type(game, 'scout');
  const plane = type(game, 'helicopter');
  const ship = type(game, 'patrol');
  assert.deepEqual([ground, plane, ship].map(actor => game.movementCost(actor, 0, 0)), [Infinity, 1, 1]);
  assert.deepEqual([ground, plane, ship].map(actor => game.movementCost(actor, 3, 1)), [Infinity, 1, 2]);
  assert.deepEqual([ground, plane, ship].map(actor => game.movementCost(actor, 4, 4)), [Infinity, 1, Infinity]);
  assert.equal(game.movementCost(type(game, 'infantry'), 4, 4), 1);
  const {x, y} = sites(game, 'port')[0];
  assert.deepEqual([ground, plane, ship].map(actor => game.movementCost(actor, x, y)), [1, 1, 1]);

  const helicopter = unit(game, 'helicopter');
  const scout = unit(game, 'scout');
  Object.assign(helicopter, {x: 4, y: 4});
  Object.assign(scout, {x: 4, y: 3});
  game.choose(4, 4);
  assert.equal(game.movementTargets().has('4,3'), false);
  assert.equal(game.movementTargets().get('4,2')?.cost, 2);
  assert.equal(game.canMoveTo(4, 1), true);
  game.choose(4, 1);
  assert.equal(game.friendlyAt(4, 1), helicopter);
  assert.equal(helicopter.moved, true);
  assert.equal(game.terrainAt(4, 1).id, 'shoal');
});

test('17兵種の補充を施設別に制御し、本拠地・近郊都市・工場から陸上部隊を出せる', () => {
  const game = new BattleMap('coastal');
  const ground = ['infantry', 'antitank', 'scout', 'support', 'tank', 'heavytank', 'artillery', 'rocket', 'antiair'];
  const air = ['drone', 'helicopter', 'fighter', 'bomber'];
  const sea = ['patrol', 'destroyer', 'submarine', 'battleship'];
  const [city, secondCity] = sites(game, 'city');
  const [headquarters] = sites(game, 'headquarters');
  const [factory] = sites(game, 'factory');
  const [airport] = sites(game, 'airfield');
  const [port] = sites(game, 'port');
  assert.deepEqual(game.unitTypes.map(unit => unit.id), [...ground, ...air, ...sea]);
  for (const [site, choices] of [[headquarters, ground], [city, ground], [secondCity, ground], [factory, ground], [airport, air], [port, sea]]) {
    assert.ok(game.productionSites.includes(site));
    assert.deepEqual(game.productionChoices(site).map(unit => unit.id), choices);
  }
  const [frontierCity] = sites(game, 'city', 'neutral');
  assert.equal(game.productionSiteAt(frontierCity.x, frontierCity.y), undefined);
  game.funds.friendly = 30000;
  assert.equal(game.produce('bomber', city), null);
  assert.equal(game.produce('battleship', factory), null);
  assert.equal(game.produce('infantry', airport), null);
  assert.equal(game.funds.friendly, 30000);
  for (const [site, id] of [[headquarters, 'infantry'], [city, 'tank'], [factory, 'artillery'], [airport, 'fighter'], [port, 'destroyer']]) {
    const before = game.funds.friendly;
    assert.equal(game.productionStatus(site), 'ready');
    const reinforcement = game.produce(id, site);
    assert.equal(reinforcement?.type.id, id);
    assert.equal(reinforcement.readyTurn, game.turn + 1);
    assert.equal(game.friendlyAt(site.x, site.y), reinforcement);
    assert.equal(game.funds.friendly, before - reinforcement.type.cost);
    assert.equal(game.productionStatus(site), 'used');
    assert.equal(game.produce(id, site), null);
  }
});

test('施設の占領・修復と陸海空の補充を再開後も引き継げる', () => {
  const game = new BattleMap('coastal');
  const infantry = unit(game, 'infantry');
  const scout = unit(game, 'scout');
  const guns = unit(game, 'artillery');
  const helicopter = unit(game, 'helicopter');
  const patrol = unit(game, 'patrol');
  const [factory] = sites(game, 'factory');
  const [port] = sites(game, 'port');
  const [airport] = sites(game, 'airfield', 'neutral');
  const [enemyAirport] = sites(game, 'airfield', 'enemy');
  Object.assign(scout, {...game.headquarters.friendly, hp: 4});
  Object.assign(guns, {x: factory.x, y: factory.y, hp: 6});
  Object.assign(patrol, {x: port.x, y: port.y, hp: 7});
  Object.assign(helicopter, {x: enemyAirport.x, y: enemyAirport.y, hp: 8});
  Object.assign(infantry, {x: airport.x - 1, y: airport.y, hp: 10});
  move(game, infantry, airport.x, airport.y);
  assert.equal(airport.owner, 'friendly');
  assert.equal(game.friendlyCapture.facility, 'airfield');
  assert.equal(game.productionStatus(airport), 'occupied');

  leaveEnemiesWaiting(game);
  game.funds.friendly = 20000;
  game.endTurn();
  assert.deepEqual([scout.hp, guns.hp, patrol.hp, helicopter.hp, infantry.hp], [6, 8, 9, 8, 10]);
  assert.deepEqual(game.facilityHealing.map(item => item.facility).sort(), ['factory', 'headquarters', 'port']);
  // Each repaired HP costs a tenth of the unit's price.
  assert.deepEqual(game.facilityHealing.map(({unit, cost}) => [unit, cost]).sort(),
    [['偵察車', 400], ['哨戒艇', 800], ['自走砲', 900]]);
  assert.equal(game.funds.friendly, 20000 + game.incomeFor('friendly') - 2100);
  move(game, infantry, airport.x - 1, airport.y);
  assert.equal(game.produce('bomber', airport)?.type.id, 'bomber');
  const saved = game.crossingSnapshot();
  const loaded = roundTrip(saved);
  assert.ok(loaded);
  assert.deepEqual(loaded.crossingSnapshot(), saved);
  assert.equal(loaded.productionStatus(loaded.facilityAt(airport.x, airport.y)), 'used');
  assert.equal(loaded.friendlyAt(airport.x, airport.y).type.id, 'bomber');
});

test('保存済みの旧対戦を同じキーと旧マップで再開でき、不明なマップは受け付けない', () => {
  const oldGame = new BattleMap();
  oldGame.produce('tank', oldGame.factoryAt(1, 5));
  const state = oldGame.crossingSnapshot();
  assert.equal(state.scenario, undefined);
  const storage = new Map([[crossingSaveKey, JSON.stringify({version: 1, state})]]);
  const makeSave = () => createCrossingSave(() => ({getItem: key => storage.get(key) ?? null, setItem: storage.set.bind(storage)}));
  const save = makeSave();
  const resumed = save.load(BattleMap.fromCrossingSnapshot);
  assert.equal(save.status, 'restored');
  assert.equal(resumed.name, 'はじまりの草原');
  assert.deepEqual([resumed.width, resumed.height], [14, 10]);
  assert.deepEqual(resumed.crossingSnapshot(), state);
  assert.equal(roundTrip({...state, scenario: 'unknown'}), null);

  const coastal = new BattleMap('coastal');
  const openCoastal = () => createCrossingSave(
    () => ({getItem: key => storage.get(key) ?? null, setItem: storage.set.bind(storage)}), 'sumaho-wars:coastal-save');
  const newSlot = openCoastal();
  assert.equal(newSlot.load(BattleMap.fromCrossingSnapshot), null);
  assert.equal(newSlot.write(coastal.crossingSnapshot()), true);
  const next = openCoastal().load(BattleMap.fromCrossingSnapshot);
  assert.equal(next.name, '湾岸の攻防');
  assert.deepEqual(next.crossingSnapshot(), coastal.crossingSnapshot());
  assert.deepEqual(makeSave().load(BattleMap.fromCrossingSnapshot).crossingSnapshot(), state);
});

test('保存データの施設情報からマップの座標や種類を上書きできない', () => {
  const game = new BattleMap('coastal');
  const saved = game.crossingSnapshot();
  Object.assign(saved.sites[0], {x: -1, y: 500, kind: 'port'});
  const resumed = roundTrip(saved);
  assert.ok(resumed);
  assert.deepEqual(resumed.sites, game.sites);
});

test('対空攻撃には空の相性が適用され、山上の航空部隊は地形防御を受けない', () => {
  const game = new BattleMap('coastal');
  const actor = unit(game, 'scout');
  const defender = game.enemyUnits.find(unit => unit.type.id === 'helicopter');
  Object.assign(actor, {x: 4, y: 3});
  Object.assign(defender, {x: 4, y: 4});
  assert.deepEqual(game.previewAttack(defender), []);
  actor.type = type(game, 'antiair');
  const preview = game.previewAttack(defender);
  assert.equal(preview[0].damage, 6);
  assert.equal(preview[0].mitigation, 0);
  assert.equal(preview[1].damage, 1);
  assert.equal(preview[1].mitigation, 1);
  assert.equal(defender.hp, 10);
  assert.deepEqual(game.choose(4, 4), preview);
  assert.equal(defender.hp, 4);
});

test('間接攻撃は移動直後や反撃で発動せず、射程内からの先制だけに使える', () => {
  const game = new BattleMap('coastal');
  const guns = unit(game, 'artillery');
  const scout = game.enemyUnits.find(unit => unit.type.id === 'scout');
  Object.assign(guns, {x: 9, y: 7});
  Object.assign(scout, {x: 12, y: 7});
  game.choose(9, 7);
  assert.equal(game.previewAttack(scout)[0].damage, 5);
  game.choose(10, 7);
  assert.equal(game.friendlyAt(10, 7), guns);
  assert.deepEqual(game.previewAttack(scout), []);

  scout.type = type(game, 'antiair');
  game.beginEnemyTurn();
  for (const enemy of game.enemyUnits) {
    if (enemy !== scout) enemy.readyTurn = game.turn + 1;
  }
  const action = game.prepareEnemyAction();
  assert.equal(action.friendly, guns);
  assert.equal(game.resolveEnemyAction(action).length, 1);
});

test('CPUは撃破可能な対象を優先し、行動の予告を保存時点から再現できる', () => {
  const game = new BattleMap('coastal');
  const guns = game.enemyUnits.find(unit => unit.type.id === 'artillery');
  const scout = unit(game, 'scout');
  const infantry = unit(game, 'infantry');
  Object.assign(guns, {x: 14, y: 7});
  Object.assign(scout, {x: 12, y: 7});
  Object.assign(infantry, {x: 10, y: 7, hp: 2});
  leaveEnemiesWaiting(game);
  guns.readyTurn = game.turn;
  game.beginEnemyTurn();
  const action = game.prepareEnemyAction();
  assert.equal(action.friendly, infantry);
  assert.deepEqual(action.path, []);
  assert.equal(infantry.hp, 2);
  const restored = roundTrip(game.crossingSnapshot());
  assert.ok(restored);
  assert.deepEqual(restored.resolveEnemyAction(restored.prepareEnemyAction()), game.resolveEnemyAction(action));
  assert.deepEqual(restored.crossingSnapshot(), game.crossingSnapshot());
});

test('CPUは手持ちで買える施設と兵種を選び、確定済みの生産は再開後も一度だけ反映する', () => {
  const game = new BattleMap('coastal');
  leaveEnemiesWaiting(game);
  game.funds.enemy = 1000;
  game.beginEnemyTurn();
  const order = game.planEnemyProduction();
  assert.equal(order.type.id, 'infantry');
  assert.ok(game.productionChoices(order.factory).includes(order.type));
  assert.ok(game.produceEnemyUnit(order));
  assert.equal(game.funds.enemy, 0);
  const restored = roundTrip(game.crossingSnapshot());
  assert.ok(restored);
  assert.equal(restored.planEnemyProduction(), null);
  restored.finishEnemyTurn();
  game.finishEnemyTurn();
  assert.deepEqual(restored.crossingSnapshot(), game.crossingSnapshot());
});

test('CPUは敵が艦砲の届かない内陸にいる場合、港だけ空いていても建造を見送る', () => {
  const game = new BattleMap('coastal');
  const infantry = unit(game, 'infantry');
  Object.assign(infantry, {x: 7, y: 9});
  for (const friendly of game.friendlyUnits) {
    if (friendly !== infantry) friendly.hp = 0;
  }
  leaveEnemiesWaiting(game);
  game.funds.enemy = 6500;
  for (const site of game.productionSites) {
    if (site.kind !== 'port' && site.owner === 'enemy') site.production = {turn: game.turn};
  }
  game.beginEnemyTurn();
  assert.equal(game.planEnemyProduction(), null);
});

test('攻撃側の残りHPに比例して与えるダメージが減る', () => {
  const game = new BattleMap('coastal');
  const guns = unit(game, 'artillery');
  const scout = game.enemyUnits.find(unit => unit.type.id === 'scout');
  Object.assign(guns, {x: 9, y: 7});
  Object.assign(scout, {x: 12, y: 7});
  game.choose(9, 7);
  const damageAt = hp => {
    guns.hp = hp;
    return game.previewAttack(scout)[0].damage;
  };
  assert.deepEqual([10, 8, 6, 4, 2, 1].map(damageAt), [5, 4, 3, 2, 1, 1]);
  assert.equal(scout.hp, 10);
});

test('歩兵の残りHPぶん占領が進み、HP10なら1回、少ないと複数回かかる', () => {
  const game = new BattleMap('coastal');
  const infantry = unit(game, 'infantry');
  const [city] = sites(game, 'city', 'neutral');
  Object.assign(infantry, {x: city.x - 1, y: city.y, hp: 4});
  move(game, infantry, city.x, city.y);
  assert.equal(city.owner, 'neutral');
  assert.deepEqual(game.captureProgress(city), {side: 'friendly', unit: infantry.name, points: 6});
  assert.equal(game.friendlyCapture.points, 6);
  assert.equal(game.canCaptureHere, false);

  const loaded = roundTrip(game.crossingSnapshot());
  assert.deepEqual(loaded.captureProgress(loaded.facilityAt(city.x, city.y)), {side: 'friendly', unit: infantry.name, points: 6});

  leaveEnemiesWaiting(game);
  game.endTurn();
  game.choose(infantry.x, infantry.y);
  assert.equal(game.canCaptureHere, true);
  assert.deepEqual(game.captureHere().points, 2);
  assert.equal(city.owner, 'neutral');
  leaveEnemiesWaiting(game);
  game.endTurn();
  game.choose(infantry.x, infantry.y);
  const done = game.captureHere();
  assert.equal(done.completed, true);
  assert.equal(city.owner, 'friendly');
  assert.equal(game.captureProgress(city), null);
});

test('占領途中で歩兵が離れると進行度は失われる', () => {
  const game = new BattleMap('coastal');
  const infantry = unit(game, 'infantry');
  const [city] = sites(game, 'city', 'neutral');
  Object.assign(infantry, {x: city.x - 1, y: city.y, hp: 5});
  move(game, infantry, city.x, city.y);
  assert.equal(game.captureProgress(city).points, 5);
  leaveEnemiesWaiting(game);
  game.endTurn();
  move(game, infantry, city.x - 1, city.y);
  assert.equal(game.captureProgress(city), null);
  leaveEnemiesWaiting(game);
  game.endTurn();
  move(game, infantry, city.x, city.y);
  assert.equal(game.captureProgress(city).points, 5);
});

test('敵歩兵は占領途中の施設にとどまって占領を続ける', () => {
  const game = new BattleMap('coastal');
  const [city] = sites(game, 'city', 'neutral');
  const raider = game.enemyUnits.find(enemy => enemy.type.id === 'infantry');
  for (const enemy of game.enemyUnits) if (enemy !== raider) enemy.readyTurn = game.turn + 5;
  game.funds.enemy = 0;
  Object.assign(raider, {x: city.x, y: city.y, hp: 6});
  city.capture = {side: 'enemy', unit: raider.name, points: 4};
  game.endTurn();
  assert.deepEqual([raider.x, raider.y], [city.x, city.y]);
  assert.equal(city.owner, 'enemy');
  assert.equal(game.enemyActions.find(action => action.enemy === raider.name).facility, 'city');
});
