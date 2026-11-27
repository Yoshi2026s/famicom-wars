import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';

const roundTrip = state => BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(state)));

function readyMatch() {
  const game = BattleMap.newMatch('coastal', 31);
  const home = game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y);
  const unit = game.produce('infantry', home);
  game.endTurn();
  game.choose(unit.x, unit.y);
  assert.equal(game.selected, true);
  return {game, unit};
}

test('仮の移動はキャンセルすると元の位置・未行動・選択中に戻る', () => {
  const {game, unit} = readyMatch();
  const from = {x: unit.x, y: unit.y};
  const [key] = game.movementTargets().keys();
  const [x, y] = key.split(',').map(Number);
  const before = game.crossingSnapshot();
  assert.equal(game.stageMove(x, y), true);
  assert.deepEqual([unit.x, unit.y, unit.moved, game.selected], [x, y, true, false]);
  assert.deepEqual(game.stagedMove, {unit, from});
  assert.deepEqual(game.crossingSnapshot(), before, '確定前の保存は移動前の状態');
  assert.equal(game.stageMove(x, y), false, '二重に仮移動しない');
  assert.equal(game.cancelMove(), true);
  assert.deepEqual([unit.x, unit.y, unit.moved, game.selected, game.stagedMove], [from.x, from.y, false, true, null]);
  assert.deepEqual(game.crossingSnapshot(), before);
  assert.equal(game.cancelMove(), false);
});

test('仮の移動は確定して初めて占領が進み、保存と再開に反映される', () => {
  const game = BattleMap.newMatch('coastal', 31);
  const home = game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y);
  const unit = game.produce('infantry', home);
  game.endTurn();
  const site = game.sites.find(s => s.owner !== 'friendly' && s.kind !== 'headquarters');
  // Put a neutral or enemy site within one step of the infantry.
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({x: unit.x + dx, y: unit.y + dy}))
    .find(p => game.movementCost(unit.type, p.x, p.y) === 1 && !game.facilityAt(p.x, p.y));
  Object.assign(site, {x: spot.x, y: spot.y});
  game.choose(unit.x, unit.y);
  const owner = site.owner;
  assert.equal(game.stageMove(spot.x, spot.y), true);
  assert.equal(site.owner, owner, '仮移動では占領しない');
  assert.equal(game.confirmMove(), true);
  assert.equal(game.stagedMove, null);
  assert.equal(site.owner, 'friendly', 'HP10の歩兵は確定で占領を終える');
  assert.equal(game.friendlyCapture.unit, unit.name);
  const saved = game.crossingSnapshot();
  assert.deepEqual(roundTrip(saved).crossingSnapshot(), saved);
});

test('仮の移動先からの攻撃は移動を確定してから攻撃し、それ以外の選択は受け付けない', () => {
  const {game, unit} = readyMatch();
  const [key] = game.movementTargets().keys();
  const [x, y] = key.split(',').map(Number);
  game.stageMove(x, y);
  const enemy = game.enemyUnits.find(e => e.hp > 0);
  // Place an enemy next to the staged tile.
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({x: x + dx, y: y + dy}))
    .find(p => !game.friendlyAt(p.x, p.y) && !game.enemyAt(p.x, p.y) && game.terrainAt(p.x, p.y).water !== true);
  Object.assign(enemy, near);
  game.choose(unit.x, unit.y);
  assert.ok(game.stagedMove, '自分のマスを選んでも仮移動のまま');
  assert.equal(game.canUnitAttack(unit, enemy), true);
  const hp = enemy.hp;
  game.choose(enemy.x, enemy.y);
  assert.equal(game.stagedMove, null);
  assert.deepEqual([unit.x, unit.y, unit.moved, unit.attacked], [x, y, true, true]);
  assert.ok(enemy.hp < hp);
});

test('仮の移動のままターンを終えると、その移動は確定する', () => {
  const {game, unit} = readyMatch();
  const [key] = game.movementTargets().keys();
  const [x, y] = key.split(',').map(Number);
  game.stageMove(x, y);
  game.endTurn();
  assert.equal(game.stagedMove, null);
  assert.deepEqual([unit.x, unit.y], [x, y]);
});

test('従来の choose による移動は確定まで一度に行う', () => {
  const {game, unit} = readyMatch();
  const [key] = game.movementTargets().keys();
  const [x, y] = key.split(',').map(Number);
  game.choose(x, y);
  assert.equal(game.stagedMove, null);
  assert.deepEqual([unit.x, unit.y, unit.moved], [x, y, true]);
});
