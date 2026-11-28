import assert from 'node:assert/strict';
import {test} from 'node:test';
import BattleMap from '../public/rules.js';
import './fixed-dice.mjs';

const roundTrip = state => BattleMap.fromCrossingSnapshot(JSON.parse(JSON.stringify(state)));

test('降伏すると敗北で終わり、保存して再開しても敗北のまま', () => {
  const game = BattleMap.newMatch('coastal', 77, {difficulty: 'hard'});
  game.produce('infantry', game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y));
  assert.equal(game.surrender(), true);
  assert.equal(game.result, 'defeat');
  assert.equal(game.surrender(), false, '決着後はもう降伏できない');
  const saved = game.crossingSnapshot();
  assert.equal(saved.surrendered, true);
  const loaded = roundTrip(saved);
  assert.equal(loaded.result, 'defeat');
  assert.deepEqual(loaded.crossingSnapshot(), saved);
  assert.equal(roundTrip({...saved, surrendered: 'yes'}), null);
  const playing = BattleMap.newMatch('coastal', 77).crossingSnapshot();
  assert.equal('surrendered' in playing, false, '降伏していない保存は従来どおり');
});

test('敵の手番中は降伏できない', () => {
  const game = BattleMap.newMatch('coastal', 5);
  game.beginEnemyTurn();
  assert.equal(game.surrender(), false);
  assert.equal(game.result, null);
});

test('最初からは同じマップ・同じ強さでターン1・部隊なしに戻る', () => {
  const game = BattleMap.newMatch('coastal', 4321, {difficulty: 'easy'});
  game.produce('tank', game.facilityAt(game.headquarters.friendly.x, game.headquarters.friendly.y));
  game.endTurn();
  game.surrender();
  const again = game.restarted();
  assert.deepEqual(again.terrain, game.terrain);
  assert.equal(again.difficulty, 'easy');
  assert.equal(again.turn, 1);
  assert.equal(again.result, null);
  assert.deepEqual([again.friendlyUnits.length, again.enemyUnits.length], [0, 0]);
  assert.deepEqual(again.funds, {friendly: 10000, enemy: 10000});
  assert.deepEqual(again.crossingSnapshot(), new BattleMap('coastal', {map: game.scenario.map, difficulty: 'easy'}).crossingSnapshot());

  const legacy = new BattleMap('legacy', {difficulty: 'hard'});
  legacy.endTurn();
  const fresh = legacy.restarted();
  assert.equal(fresh.scenario, null);
  assert.equal(fresh.turn, 1);
  assert.equal(fresh.difficulty, 'hard');
});
