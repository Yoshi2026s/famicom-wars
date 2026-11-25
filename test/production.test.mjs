import assert from 'node:assert/strict';
import {test} from 'node:test';
import TrainingMap from '../public/rules.js';

test('味方は工場で3種から1部隊ずつ生産でき、次のターンに移動できる', () => {
  const game = new TrainingMap('crossing');
  assert.equal(game.factoryAt(1, 5), 'friendly');
  assert.equal(game.factoryAt(8, 4), 'enemy');
  assert.equal(game.productionStatus, 'ready');
  assert.equal(game.produce('unknown'), null);
  for (const [id, name, next] of [['infantry', '歩兵 2', [1, 3]], ['scout', '偵察車 2', [0, 2]], ['support', '支援車 2', null]]) {
    const unit = game.produce(id);
    assert.deepEqual([unit.name, unit.type.id, unit.hp, unit.readyTurn], [name, id, 10, game.turn + 1]);
    assert.equal(game.friendlyAt(1, 5), unit);
    assert.equal(game.productionStatus, 'used');
    assert.equal(game.produce(id), null);
    game.choose(1, 5);
    assert.equal(game.activeUnit, unit);
    assert.equal(game.canMove, false);
    assert.equal(game.canAttack, false);
    if (!next) continue;
    game.endTurn();
    assert.equal(game.productionStatus, 'occupied');
    assert.equal(game.produce(id), null);
    game.choose(1, 5);
    assert.equal(game.canMoveTo(...next), true);
    game.choose(...next);
    assert.equal(game.friendlyAt(...next), unit);
    assert.equal(game.productionStatus, 'ready');
  }
  assert.equal(game.friendlyUnits.length, 6);
});

test('敵も空いている工場で毎ターン1部隊を補充し、その部隊は次の敵ターンから行動する', () => {
  const game = new TrainingMap('crossing');
  let previous;
  for (const expected of ['infantry', 'scout', 'support']) {
    assert.equal(game.beginEnemyTurn(), true);
    assert.equal(game.productionStatus, 'waiting');
    assert.equal(game.produce('infantry'), null);
    const actors = [];
    for (let action; (action = game.prepareEnemyAction());) {
      actors.push(action.enemy.name);
      game.resolveEnemyAction(action);
    }
    const count = game.enemyUnits.length;
    const productionTurn = game.turn;
    game.finishEnemyTurn();
    game.finishEnemyTurn();
    const unit = game.enemyUnits.at(-1);
    assert.equal(game.enemyUnits.length, count + 1);
    assert.equal(game.enemyAt(8, 4), unit);
    assert.equal(unit.type.id, expected);
    assert.equal(unit.readyTurn, game.turn);
    assert.equal(game.turn, productionTurn + 1);
    assert.deepEqual(game.production.enemy, {unit: unit.name, turn: productionTurn});
    assert.ok(!actors.includes(unit.name));
    if (previous) assert.equal(actors.filter(name => name === previous).length, 1);
    previous = unit.name;
  }
});

test('相手の部隊が工場マスを占有している間は生産できない', () => {
  const game = new TrainingMap('crossing');
  const [enemy] = game.enemyUnits;
  Object.assign(enemy, game.factories.friendly);
  assert.equal(game.productionStatus, 'occupied');
  assert.equal(game.produce('infantry'), null);

  const ally = game.friendlyUnits[2];
  Object.assign(ally, game.factories.enemy);
  game.endTurn();
  assert.equal(game.friendlyAt(8, 4), ally);
  assert.equal(game.production.enemy, null);
  assert.equal(game.enemyUnits.length, 3);
});

test('増援の歩兵も次のターンに本拠地を占領でき、決着後や他の作戦では生産できない', () => {
  const game = new TrainingMap('crossing');
  const infantry = game.produce('infantry');
  game.endTurn();
  Object.assign(infantry, {x: 8, y: 5});
  game.choose(8, 5);
  game.choose(9, 5);
  assert.equal(game.activeUnit, infantry);
  assert.equal(game.result, 'victory');
  assert.equal(game.produce('support'), null);
  assert.equal(game.friendlyUnits.length, 4);
  for (const mode of ['training', 'battle']) {
    assert.equal(new TrainingMap(mode).produce('scout'), null);
  }
});
