import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

test('味方は工場で3種から1部隊ずつ生産でき、次のターンに移動できる', () => {
  const game = new BattleMap();
  const factory = game.factoryAt(1, 5);
  assert.equal(factory.owner, 'friendly');
  assert.equal(game.factoryAt(8, 4).owner, 'enemy');
  assert.equal(game.productionStatus(factory), 'ready');
  assert.equal(game.produce('unknown', factory), null);
  for (const [id, name, next] of [['infantry', '歩兵 2', [1, 3]], ['scout', '偵察車 2', [0, 2]], ['support', '支援車 2', null]]) {
    const unit = game.produce(id, factory);
    assert.deepEqual([unit.name, unit.type.id, unit.hp, unit.readyTurn], [name, id, 10, game.turn + 1]);
    assert.equal(game.friendlyAt(1, 5), unit);
    assert.equal(game.productionStatus(factory), 'used');
    assert.equal(game.produce(id, factory), null);
    game.choose(1, 5);
    assert.equal(game.activeUnit, unit);
    assert.equal(game.canMove, false);
    assert.equal(game.canAttack, false);
    if (!next) continue;
    game.endTurn();
    assert.equal(game.productionStatus(factory), 'occupied');
    assert.equal(game.produce(id, factory), null);
    game.choose(1, 5);
    assert.equal(game.canMoveTo(...next), true);
    game.choose(...next);
    assert.equal(game.friendlyAt(...next), unit);
    assert.equal(game.productionStatus(factory), 'ready');
  }
  assert.equal(game.friendlyUnits.length, 6);
});

test('敵も空いている工場で毎ターン1部隊を補充し、その部隊は次の敵ターンから行動する', () => {
  const game = new BattleMap();
  const home = game.factoryAt(1, 5);
  game.funds.enemy = 8000;
  let previous;
  for (const expected of ['tank', 'infantry', 'scout', 'support']) {
    assert.equal(game.beginEnemyTurn(), true);
    assert.equal(game.productionStatus(home), 'waiting');
    assert.equal(game.produce('infantry', home), null);
    const actors = [];
    for (let action; (action = game.prepareEnemyAction());) {
      actors.push(action.enemy.name);
      game.resolveEnemyAction(action);
    }
    const count = game.enemyUnits.length;
    const productionTurn = game.turn;
    const budget = game.funds.enemy;
    game.finishEnemyTurn();
    game.finishEnemyTurn();
    const unit = game.enemyUnits.at(-1);
    assert.equal(game.enemyUnits.length, count + 1);
    assert.equal(game.enemyAt(8, 4), unit);
    assert.equal(unit.type.id, expected);
    assert.equal(unit.readyTurn, game.turn);
    assert.equal(game.turn, productionTurn + 1);
    assert.deepEqual(game.enemyProductions, [{x: 8, y: 4, unit: unit.name, turn: productionTurn, cost: game.productionCost(expected)}]);
    assert.equal(game.funds.enemy, budget - game.enemyProductions[0].cost + game.incomeFor('enemy'));
    assert.ok(!actors.includes(unit.name));
    if (previous) assert.equal(actors.filter(name => name === previous).length, 1);
    previous = unit.name;
  }
});

test('相手の部隊が工場マスを占有している間は生産できない', () => {
  const game = new BattleMap();
  const [, enemy] = game.enemyUnits;
  const factory = game.factoryAt(1, 5);
  Object.assign(enemy, {x: factory.x, y: factory.y});
  assert.equal(game.productionStatus(factory), 'occupied');
  assert.equal(game.produce('infantry', factory), null);

  const ally = game.friendlyUnits[2];
  Object.assign(ally, {x: 8, y: 4});
  game.endTurn();
  assert.equal(game.friendlyAt(8, 4), ally);
  assert.deepEqual(game.enemyProductions, []);
  assert.equal(game.enemyUnits.length, 3);
});

test('増援の歩兵も次のターンに本拠地を占領でき、決着後は生産できない', () => {
  const game = new BattleMap();
  const factory = game.factoryAt(1, 5);
  const infantry = game.produce('infantry', factory);
  game.endTurn();
  Object.assign(infantry, {x: 12, y: 7});
  game.choose(12, 7);
  game.choose(13, 7);
  assert.equal(game.activeUnit, infantry);
  assert.equal(game.result, 'victory');
  assert.equal(game.produce('support', factory), null);
  assert.equal(game.friendlyUnits.length, 4);
  assert.equal(new BattleMap().produce('scout'), null);
});

test('歩兵が占領した工場はマスを空けると生産でき、工場ごとの回数と陣営の資金を使う', () => {
  const game = new BattleMap();
  const home = game.factoryAt(1, 5);
  const target = game.factoryAt(8, 4);
  const infantry = game.friendlyUnits[1];
  Object.assign(infantry, {x: 8, y: 3});
  const budget = game.funds.friendly;
  game.choose(8, 3);
  game.choose(8, 4);
  assert.equal(target.owner, 'friendly');
  assert.equal(game.friendlyCapture.facility, 'factory');
  assert.equal(game.result, null);
  assert.equal(game.funds.friendly, budget);
  assert.equal(game.incomeFor('friendly'), 1000);
  assert.equal(game.productionStatus(target), 'occupied');
  assert.equal(game.produce('infantry', target), null);

  game.endTurn();
  assert.deepEqual(game.enemyProductions, []);
  assert.equal(infantry.hp, 6);
  assert.deepEqual(game.facilityHealing, [{side: 'friendly', unit: '歩兵', amount: 2, facility: 'factory'}]);
  game.choose(8, 4);
  game.choose(9, 4);
  const turnBudget = game.funds.friendly;
  const scout = game.produce('scout', target);
  assert.equal(game.friendlyAt(8, 4), scout);
  assert.equal(scout.readyTurn, game.turn + 1);
  assert.equal(game.productionStatus(target), 'used');
  assert.equal(game.produce('scout', target), null);
  const reinforcement = game.produce('infantry', home);
  assert.equal(game.friendlyAt(1, 5), reinforcement);
  assert.equal(game.funds.friendly, turnBudget - 3500);
  assert.equal(new BattleMap().factoryAt(8, 4).owner, 'enemy');
});

test('車両は工場を占領できず、敵の工場を指定しても生産や支払いは発生しない', () => {
  const game = new BattleMap();
  const target = game.factoryAt(8, 4);
  Object.assign(game.friendlyUnits[0], {x: 8, y: 3});
  game.choose(8, 3);
  game.choose(8, 4);
  assert.equal(game.friendlyAt(8, 4).type.id, 'scout');
  assert.equal(target.owner, 'enemy');
  assert.equal(game.produce('infantry', target), null);
  assert.equal(game.funds.friendly, 4500);
});

test('敵歩兵に占領された工場も、敵の部隊がマスを空けると生産に使われる', () => {
  const game = new BattleMap();
  const home = game.factoryAt(1, 5);
  Object.assign(game.enemyUnits[0], {x: 1, y: 4});
  game.endTurn();
  assert.equal(home.owner, 'enemy');
  assert.ok(game.enemyActions.some(action => action.factoryCaptured));
  assert.equal(game.productionStatus(home), 'unavailable');
  assert.equal(game.produce('infantry', home), null);
  assert.ok(!game.enemyProductions.some(({x, y}) => x === 1 && y === 5));
  assert.deepEqual(game.facilityHealing, [{side: 'enemy', unit: '歩兵', amount: 2, facility: 'factory'}]);

  // Defend headquarters so the occupying enemy can move out without ending the battle.
  Object.assign(game.friendlyUnits[0], {x: 0, y: 6});
  const budget = game.funds.enemy;
  game.endTurn();
  assert.equal(game.result, null);
  assert.ok(game.enemyProductions.some(({x, y}) => x === 1 && y === 5));
  const spent = game.enemyProductions.reduce((sum, {cost}) => sum + cost, 0);
  assert.equal(game.funds.enemy, budget - spent + game.incomeFor('enemy'));
});

test('敵も2工場を所有すると、空いている両工場から同じターンに生産できる', () => {
  const game = new BattleMap();
  game.factoryAt(1, 5).owner = 'enemy';
  game.funds.enemy = 6000;
  const budget = game.funds.enemy;
  game.endTurn();
  assert.deepEqual(game.enemyProductions.map(({x, y, cost}) => [x, y, cost]), [[1, 5, 4000], [8, 4, 1000]]);
  assert.equal(game.enemyAt(1, 5).type.id, 'tank');
  assert.equal(game.enemyAt(8, 4).type.id, 'infantry');
  assert.equal(game.funds.enemy, budget - 5000 + game.incomeFor('enemy'));
});

test('敵の生産選択は盤面を変えず、1工場で出撃した直後に再開しても再生産しない', () => {
  const game = new BattleMap();
  game.factoryAt(1, 5).owner = 'enemy';
  game.funds.enemy = 6000;
  assert.equal(game.planEnemyProduction(), null);
  game.beginEnemyTurn();
  assert.equal(game.planEnemyProduction(), null);
  for (let action; (action = game.prepareEnemyAction());) game.resolveEnemyAction(action);
  const before = game.crossingSnapshot();
  const order = game.planEnemyProduction();
  assert.equal(order.factory, game.factoryAt(1, 5));
  assert.equal(order.type.id, 'tank');
  assert.deepEqual(game.crossingSnapshot(), before);
  assert.equal(game.produceEnemyUnit({...order, factory: game.factoryAt(8, 4)}), null);
  assert.equal(game.produceEnemyUnit(order).readyTurn, 2);
  assert.equal(game.produceEnemyUnit(order), null);
  assert.equal(game.funds.enemy, 2000);
  assert.equal(game.turn, 1);

  const resumed = BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(game.crossingSnapshot())));
  const next = resumed.planEnemyProduction();
  assert.equal(next.factory, resumed.factoryAt(8, 4));
  assert.equal(next.type.id, 'infantry');
  resumed.produceEnemyUnit(next);
  assert.equal(resumed.planEnemyProduction(), null);
  resumed.finishEnemyTurn();
  game.finishEnemyTurn();
  assert.deepEqual(resumed.crossingSnapshot(), game.crossingSnapshot());
  assert.deepEqual(resumed.enemyProductions.map(({unit}) => unit), ['戦車', '歩兵 2']);
  assert.equal(resumed.enemyActions.length, 3);
  assert.equal(resumed.funds.enemy, 2000);
  assert.equal(resumed.turn, 2);
});

test('両工場で生産した戦車は次のターンから、移動力3・射程1と攻撃力補正を使う', () => {
  const game = new BattleMap();
  const friendlyTank = game.produce('tank', game.factoryAt(1, 5));
  assert.equal(game.funds.friendly, 500);
  game.choose(1, 5);
  assert.equal(game.canMove, false);
  game.endTurn();
  const enemyTank = game.enemyAt(8, 4);
  assert.equal(enemyTank.type.id, 'tank');
  assert.deepEqual([friendlyTank.readyTurn, enemyTank.readyTurn, game.turn], [2, 2, 2]);
  assert.deepEqual([friendlyTank.type.movement, friendlyTank.type.minRange, friendlyTank.type.maxRange], [3, 1, 1]);
  Object.assign(friendlyTank, {x: 10, y: 7});
  Object.assign(enemyTank, {x: 11, y: 7});
  game.choose(10, 7);
  assert.equal(game.canMoveTo(12, 6), true);
  assert.equal(game.canMoveTo(13, 6), false);
  assert.deepEqual(game.choose(11, 7), [
    {attacker: 'player', damage: 4, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 6},
    {attacker: 'enemy', damage: 2, terrain: '森', mitigation: 1, playerHP: 8, enemyHP: 6},
  ]);
});
