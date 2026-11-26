import assert from 'node:assert/strict';
import {test} from 'node:test';
import TrainingMap from '../public/rules.js';

function leaveEnemySupport(game, x, y) {
  const [infantry, scout, support] = game.enemyUnits;
  infantry.hp = 0;
  scout.hp = 0;
  Object.assign(support, {x, y});
  return support;
}

test('新作戦は10×8で、川を避けて橋を渡り、湿地には移動力2を使う', () => {
  const game = new TrainingMap('crossing');
  assert.deepEqual([game.width, game.height, game.x, game.y], [10, 8, 1, 6]);
  assert.equal(game.playerUnit.id, 'scout');
  assert.deepEqual(game.enemyUnits.map(unit => [unit.type.id, unit.x, unit.y]), [
    ['infantry', 7, 1], ['scout', 7, 5], ['support', 7, 2],
  ]);
  leaveEnemySupport(game, 7, 2);

  game.choose(1, 6);
  const paths = game.movementTargets();
  assert.equal(paths.get('2,5').cost, 3); // C6 is a marsh, two squares from B7.
  assert.equal(paths.get('3,5').cost, 4);
  assert.equal(game.canMoveTo(4, 5), false);
  assert.equal(game.canMoveTo(4, 6), false);
  assert.equal(game.canMoveTo(1, 8), false);
  game.choose(3, 5);
  game.endTurn();
  game.choose(3, 5);
  assert.equal(game.movementTargets().get('5,5').cost, 2);
  assert.equal(game.canMoveTo(4, 4), false);
  assert.equal(game.canMoveTo(7, 5), true);
  game.choose(7, 5);
  assert.deepEqual([game.x, game.y], [7, 5]);
});

test('支援車は川・湿地を避けて橋を目指し、射程に入るとその場で攻撃する', () => {
  const game = new TrainingMap('crossing');
  game.x = 1;
  game.y = 4;
  const support = leaveEnemySupport(game, 5, 4);
  const before = structuredClone(game);
  assert.deepEqual(game.planEnemyAction(support), {enemy: support, from: {x: 5, y: 4}, to: {x: 5, y: 5}, friendly: null});
  assert.deepEqual(structuredClone(game), before);
  game.endTurn();
  game.endTurn();
  assert.deepEqual(game.enemy, {x: 4, y: 5});
  const strikes = game.endTurn();
  assert.deepEqual(game.enemyActions[0].to, {x: 3, y: 5});
  assert.deepEqual(strikes.map(hit => hit.attacker), ['enemy']);
  assert.equal(game.planEnemyAction(support).friendly, game.activeUnit);
  assert.deepEqual(game.planEnemyAction(support).to, game.enemy);
});

test('偵察車の隣接攻撃と支援車の遠距離攻撃はどちらも射程外から反撃されない', () => {
  const game = new TrainingMap('crossing');
  game.x = 3;
  game.y = 4; // D5 marsh.
  leaveEnemySupport(game, 3, 5);
  assert.deepEqual(game.choose(3, 5), [
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 10, enemyHP: 7},
  ]);
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 1, terrain: '湿地', mitigation: 1, playerHP: 9, enemyHP: 7},
  ]);
  assert.equal(game.canAttack, false);
});

test('味方3部隊は同じターンに1回ずつ移動し、味方のマスを通らず、次のターンに再び動ける', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  assert.deepEqual(game.friendlyUnits.map(unit => [unit.type.id, unit.x, unit.y]), [
    ['scout', 1, 6], ['infantry', 3, 1], ['support', 2, 1],
  ]);
  game.choose(scout.x, scout.y);
  game.choose(3, 5);
  game.choose(infantry.x, infantry.y);
  assert.equal(game.canMoveTo(support.x, support.y), false);
  assert.equal(game.canMoveTo(1, 1), false); // Reaching B2 would require crossing the support vehicle's tile.
  game.choose(3, 2);
  game.choose(support.x, support.y);
  game.choose(2, 2);
  for (const unit of game.friendlyUnits) {
    game.choose(unit.x, unit.y);
    assert.equal(game.activeUnit, unit);
    assert.equal(game.canMove, false);
    assert.equal(game.movementTargets().size, 0);
  }
  assert.deepEqual(game.friendlyUnits.map(unit => [unit.x, unit.y]), [[3, 5], [3, 2], [2, 2]]);
  assert.equal(game.turn, 1);
  game.endTurn();
  assert.equal(game.turn, 2);
  assert.ok(game.friendlyUnits.every(unit => !unit.moved && !unit.attacked));
});

test('味方の支援車は移動後に一度だけ攻撃でき、別の部隊は続けて行動できる', () => {
  const game = new TrainingMap('crossing');
  const [scout, , support] = game.friendlyUnits;
  Object.assign(support, {x: 3, y: 5});
  leaveEnemySupport(game, 6, 5);
  game.choose(support.x, support.y);
  game.choose(4, 5);
  assert.equal(support.moved, true);
  assert.equal(game.canAttack, true);
  assert.deepEqual(game.choose(game.enemy.x, game.enemy.y).map(hit => hit.attacker), ['player', 'enemy']);
  assert.equal(support.attacked, true);
  assert.equal(game.choose(game.enemy.x, game.enemy.y), undefined);
  game.choose(scout.x, scout.y);
  assert.equal(game.canMove, true);
});

test('敵の攻撃と反撃は操作中の部隊ではなく交戦する部隊の射程・HPを使う', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  Object.assign(support, {x: 3, y: 4});
  const enemy = leaveEnemySupport(game, 5, 4);
  assert.equal(game.planEnemyAction(enemy).friendly, support);
  assert.deepEqual(game.endTurn(), [
    {attacker: 'enemy', damage: 2, terrain: '湿地', mitigation: 1, playerHP: 8, enemyHP: 10},
    {attacker: 'player', damage: 3, terrain: '草原', mitigation: 0, playerHP: 8, enemyHP: 7},
  ]);
  assert.equal(game.activeUnit, scout);
  assert.deepEqual([scout.hp, infantry.hp, support.hp], [10, 10, 8]);
});

test('撃破された味方は盤面を空け、残った部隊を操作でき、全滅で敗北する', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  Object.assign(scout, {x: 3, y: 4, hp: 1});
  leaveEnemySupport(game, 5, 4);
  game.endTurn();
  assert.equal(game.friendlyAt(3, 4), undefined);
  assert.equal(game.activeUnit, infantry);
  assert.equal(game.result, null);
  game.choose(infantry.x, infantry.y);
  assert.ok(game.movementTargets().size > 0);

  infantry.hp = 0;
  Object.assign(support, {x: 3, y: 4, hp: 1});
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.equal(game.beginEnemyTurn(), false);
});

test('敵3部隊は自分の移動力と射程で1回ずつ行動し、すべて終わってから次のターンに進む', () => {
  const game = new TrainingMap('crossing');
  const [scout, , support] = game.friendlyUnits;
  const [enemyInfantry, enemyScout, enemySupport] = game.enemyUnits;
  Object.assign(scout, {x: 3, y: 5, moved: true});
  Object.assign(support, {x: 2, y: 6});
  Object.assign(enemyInfantry, {x: 6, y: 1});
  Object.assign(enemySupport, {x: 6, y: 4});

  assert.equal(game.beginEnemyTurn(), true);
  assert.equal(game.beginEnemyTurn(), false);
  game.choose(3, 5);
  assert.equal(game.canMove, false);
  assert.equal(game.endTurn(), undefined);
  game.finishEnemyTurn();
  assert.equal(game.turn, 1);
  const first = game.prepareEnemyAction();
  assert.equal(game.prepareEnemyAction(), first);
  assert.deepEqual([first.enemy, first.to, first.friendly.type.id], [enemyInfantry, {x: 4, y: 1}, 'infantry']);
  assert.deepEqual(game.resolveEnemyAction(first).map(hit => hit.attacker), ['enemy', 'player']);
  assert.deepEqual(game.resolveEnemyAction(first), []);

  const second = game.prepareEnemyAction();
  assert.deepEqual([second.enemy, second.to, second.friendly], [enemyScout, {x: 4, y: 5}, scout]);
  assert.deepEqual(game.resolveEnemyAction(second).map(hit => hit.attacker), ['enemy', 'player']);
  const third = game.prepareEnemyAction();
  assert.deepEqual([third.enemy, third.to, third.friendly], [enemySupport, {x: 6, y: 5}, scout]);
  assert.deepEqual(game.resolveEnemyAction(third).map(hit => hit.attacker), ['enemy']);

  assert.equal(game.prepareEnemyAction(), null);
  assert.equal(game.turn, 1);
  assert.equal(scout.moved, true);
  game.finishEnemyTurn();
  game.finishEnemyTurn();
  assert.equal(game.turn, 2);
  assert.equal(scout.moved, false);
  assert.equal(game.enemyTurn, null);
  assert.deepEqual(game.enemyActions.map(action => action.enemy), ['歩兵', '偵察車', '支援車']);
});

test('先の敵に撃破された味方を除外し、空いたマスを使って次の敵が行動する', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry] = game.friendlyUnits;
  const [enemyInfantry, enemyScout, enemySupport] = game.enemyUnits;
  Object.assign(scout, {x: 7, y: 4, hp: 1});
  Object.assign(infantry, {x: 8, y: 4});
  Object.assign(enemyInfantry, {x: 7, y: 3});
  Object.assign(enemyScout, {x: 6, y: 4});
  Object.assign(enemySupport, {x: 6, y: 5});
  game.beginEnemyTurn();
  const first = game.prepareEnemyAction();
  assert.equal(first.friendly, scout);
  game.resolveEnemyAction(first);
  assert.equal(scout.hp, 0);
  assert.equal(game.result, null);
  const second = game.prepareEnemyAction();
  assert.equal(second.friendly, infantry);
  assert.deepEqual(second.to, {x: 7, y: 4});
  game.resolveEnemyAction(second);
  assert.ok(infantry.hp < 10);
});

test('射程外の敵を攻撃できず、敵を1体倒しても最後の敵を撃破するまで勝利にならない', () => {
  const game = new TrainingMap('crossing');
  const [enemyInfantry, enemyScout, enemySupport] = game.enemyUnits;
  Object.assign(enemyInfantry, {x: 1, y: 5, hp: 1});
  assert.equal(game.canAttack, true);
  assert.equal(game.canUnitAttack(game.activeUnit, enemyScout), false);
  assert.equal(game.choose(enemyScout.x, enemyScout.y), undefined);
  assert.equal(enemyScout.hp, 10);
  assert.equal(game.choose(enemyInfantry.x, enemyInfantry.y).length, 1);
  assert.equal(game.result, null);
  assert.equal(game.enemyAt(1, 5), undefined);
  assert.equal(game.beginEnemyTurn(), true);
  const action = game.prepareEnemyAction();
  assert.equal(action.enemy, enemyScout);
  game.resolveEnemyAction(action);
  assert.equal(game.prepareEnemyAction().enemy, enemySupport);
});

test('敵の偵察車が橋へ向かうとき、先にいる部隊のマスを通れない', () => {
  const game = new TrainingMap('crossing');
  const [scout] = game.friendlyUnits;
  const [, enemyScout, enemySupport] = game.enemyUnits;
  Object.assign(scout, {x: 3, y: 5});
  const unblocked = game.planEnemyAction(enemyScout);
  assert.deepEqual(unblocked.to, {x: 4, y: 5});
  assert.equal(unblocked.friendly, scout);
  Object.assign(enemySupport, {x: 4, y: 5});
  const blocked = game.planEnemyAction(enemyScout);
  assert.notDeepEqual(blocked.to, {x: 4, y: 5});
  assert.notEqual(blocked.friendly, scout);
});

test('最後の味方が撃破された時点で、残りの敵は行動しない', () => {
  const game = new TrainingMap('crossing');
  const [scout, infantry, support] = game.friendlyUnits;
  const [enemyInfantry, enemyScout, enemySupport] = game.enemyUnits;
  Object.assign(enemyInfantry, {x: 1, y: 5});
  scout.hp = 1;
  infantry.hp = 0;
  support.hp = 0;
  game.endTurn();
  assert.equal(game.result, 'defeat');
  assert.equal(game.turn, 1);
  assert.equal(game.enemyTurn, null);
  assert.deepEqual(game.enemyActions.map(action => action.enemy), ['歩兵']);
  assert.deepEqual([enemyScout.x, enemyScout.y, enemySupport.x, enemySupport.y], [7, 5, 7, 2]);
});

test('歩兵が敵本拠地を移動先に選ぶと、敵が残っていてもその場で勝利する', () => {
  const game = new TrainingMap('crossing');
  const infantry = game.friendlyUnits[1];
  Object.assign(infantry, {x: 8, y: 5});
  assert.deepEqual(game.headquarters, {friendly: {x: 0, y: 6}, enemy: {x: 9, y: 5}});
  assert.equal(game.headquartersAt(0, 6), 'friendly');
  assert.equal(game.headquartersAt(9, 5), 'enemy');
  game.choose(8, 5);
  assert.equal(game.canMoveTo(9, 5), true);
  game.choose(9, 5);
  assert.equal(game.capturedBy, 'friendly');
  assert.equal(game.result, 'victory');
  assert.equal(game.canAttack, false);
  assert.ok(game.enemyUnits.every(unit => unit.hp === 10));
  game.choose(8, 5);
  game.endTurn();
  assert.deepEqual([infantry.x, infantry.y, game.turn], [9, 5, 1]);
  assert.equal(new TrainingMap('crossing').capturedBy, null);
  assert.equal(new TrainingMap('battle').headquartersAt(0, 6), null);
});

test('偵察車や支援車が敵本拠地に止まっても占領できず、歩兵は占有中の本拠地に入れない', () => {
  for (const index of [0, 2]) {
    const game = new TrainingMap('crossing');
    const vehicle = game.friendlyUnits[index];
    const infantry = game.friendlyUnits[1];
    Object.assign(vehicle, {x: 8, y: 5});
    Object.assign(infantry, {x: 9, y: 4});
    game.choose(8, 5);
    game.choose(9, 5);
    assert.equal(game.friendlyAt(9, 5), vehicle);
    assert.equal(game.result, null);
    game.choose(9, 4);
    assert.equal(game.canMoveTo(9, 5), false);
  }
  const game = new TrainingMap('crossing');
  Object.assign(game.friendlyUnits[1], {x: 8, y: 5});
  Object.assign(game.enemyUnits[1], {x: 9, y: 5, hp: 1});
  game.choose(8, 5);
  assert.equal(game.canMoveTo(9, 5), false);
  assert.equal(game.choose(9, 5).length, 1);
  assert.equal(game.capturedBy, null);
  assert.equal(game.result, null);
});

test('敵の歩兵は空いた味方本拠地を占領し、残りの敵の行動を待たずに敗北する', () => {
  const game = new TrainingMap('crossing');
  const enemyInfantry = game.enemyUnits[0];
  Object.assign(enemyInfantry, {x: 1, y: 5});
  assert.equal(game.beginEnemyTurn(), true);
  const action = game.prepareEnemyAction();
  assert.deepEqual(action.to, game.headquarters.friendly);
  assert.equal(action.friendly, null);
  assert.deepEqual(game.resolveEnemyAction(action), []);
  assert.equal(game.prepareEnemyAction(), null);
  game.finishEnemyTurn();
  assert.equal(game.result, 'defeat');
  assert.equal(game.capturedBy, 'enemy');
  assert.equal(game.turn, 1);
  assert.ok(game.friendlyUnits.every(unit => unit.hp === 10));
  assert.deepEqual(game.enemyActions.map(({enemy, captured}) => [enemy, captured]), [['歩兵', true]]);
});

test('味方本拠地を守る部隊がいる場合、敵歩兵は占領できない', () => {
  const game = new TrainingMap('crossing');
  const scout = game.friendlyUnits[0];
  Object.assign(scout, game.headquarters.friendly);
  Object.assign(game.friendlyUnits[1], {x: 1, y: 5});
  Object.assign(game.enemyUnits[0], {x: 1, y: 6});
  game.beginEnemyTurn();
  const action = game.prepareEnemyAction();
  assert.equal(action.friendly, scout);
  assert.notDeepEqual(action.to, game.headquarters.friendly);
  game.resolveEnemyAction(action);
  assert.equal(game.result, null);
  assert.equal(game.capturedBy, null);
});
