const missionTitles = {training: 'はじまりの草原', battle: '草原の遭遇戦', crossing: '水辺の攻防'};
const missions = Object.fromEntries(Object.keys(missionTitles).map(mode => [mode, new TrainingMap(mode)]));
let game = missions.training;
const pendingEnemyTurns = new Set();
const board = document.getElementById('board');
const mapSurround = document.getElementById('map-surround');
const roster = document.getElementById('friendly-roster');
const enemyRoster = document.getElementById('enemy-roster');
const cells = [];
const rosterEntries = [];
const enemyRosterEntries = [];
const productionButtons = [...document.querySelectorAll('[data-produce]')];
const productionStatus = document.getElementById('production-status');

function columnName(x) {
  return String.fromCharCode(65 + x);
}

function coordinate(x, y) {
  return columnName(x) + (y + 1);
}

function friendlyTile() {
  return cells[game.y * game.width + game.x].button;
}

function unitImage(type, enemy = false) {
  if (enemy && type.id !== 'support') return `./assets/enemy-${type.id}.png`;
  const sprite = !enemy && type.id === 'support' ? 'friendly-support' : type.id;
  return `./assets/${sprite}.png`;
}

function showImage(image, source) {
  if (image.getAttribute('src') !== source) image.src = source;
}

function waitingForEnemy() {
  return Boolean(game.enemyTurn) || pendingEnemyTurns.has(game);
}

function extendRoster(container, entries, units, interactive) {
  for (const unit of units.slice(entries.length)) {
    const card = document.createElement(interactive ? 'button' : 'div');
    const name = document.createElement('strong');
    name.textContent = (interactive ? '' : '敵') + unit.name;
    const hp = document.createElement('span');
    const state = document.createElement('span');
    card.append(name, hp, state);
    if (interactive) {
      card.type = 'button';
      card.addEventListener('click', () => {
        if (combatScreen.active || waitingForEnemy() || game.result) return;
        game.choose(unit.x, unit.y);
        setBoardTabStop(friendlyTile());
        revealTile(friendlyTile());
        render();
      });
    }
    entries.push({unit, card, hp, state});
    container.append(card);
  }
}

function unitState(unit) {
  if (!unit.hp) return '撃破';
  if (game.result) return '対戦終了';
  if (unit.readyTurn > game.turn) return '次のターンから';
  if (unit.attacked) return '行動済み';
  if (unit.moved) return game.canUnitAttack(unit) ? '攻撃可能' : '移動済み';
  return '移動可能';
}

function renderProduction() {
  const status = game.productionStatus;
  const labels = {
    ready: '1ターンに1部隊を生産できます。',
    occupied: '工場が使用中です。マスが空くと生産できます。',
    used: `${game.production.friendly?.unit}を生産しました。次のターンから操作できます。`,
    waiting: '敵のターンです。',
    unavailable: '対戦終了',
  };
  if (productionStatus.textContent !== labels[status]) productionStatus.textContent = labels[status];
  for (const button of productionButtons) button.setAttribute('aria-disabled', String(status !== 'ready'));
}

function render() {
  const waiting = waitingForEnemy();
  const spent = !game.canMove && !game.canAttack;
  const lost = game.result === 'defeat';
  const friendlyName = '味方' + game.activeUnit.name;
  const movementTargets = waiting ? new Map() : game.movementTargets();
  const enemyBase = game.headquarters?.enemy;
  const captureReady = Boolean(enemyBase && game.playerUnit.id === 'infantry' && movementTargets.has(`${enemyBase.x},${enemyBase.y}`));
  const actingEnemy = game.enemyTurn?.action?.enemy;
  if (game.isCrossing) {
    extendRoster(roster, rosterEntries, game.friendlyUnits, true);
    extendRoster(enemyRoster, enemyRosterEntries, game.enemyUnits, false);
    renderProduction();
  }
  for (const {unit, card, hp, state} of rosterEntries) {
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    state.textContent = unitState(unit);
    card.disabled = !unit.hp || Boolean(game.result);
    card.classList.toggle('defeated', !unit.hp);
    card.setAttribute('aria-disabled', String(waiting || card.disabled));
    card.setAttribute('aria-pressed', String(unit === game.activeUnit));
  }
  for (const {unit, card, hp, state} of enemyRosterEntries) {
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    state.textContent = !unit.hp ? '撃破' : unit === actingEnemy ? '行動中' : coordinate(unit.x, unit.y);
    card.classList.toggle('enemy-acting', unit === actingEnemy);
    card.classList.toggle('defeated', !unit.hp);
  }
  for (const cell of cells) {
    const {x, y, button, terrainLabel, image, base, factory} = cell;
    const terrain = game.terrainAt(x, y);
    button.dataset.terrain = terrain.id;
    const captured = Boolean(base && game.capturedBy && base !== game.capturedBy);
    terrainLabel.textContent = captured ? '占領済' : base ? '本拠地' : factory ? '工場' : terrain.name;
    terrainLabel.hidden = !base && !factory && terrain.id === 'plains';
    const friendly = game.friendlyAt(x, y);
    const occupied = Boolean(friendly);
    const active = friendly === game.activeUnit;
    const tileSpent = occupied && (friendly.readyTurn > game.turn || friendly.attacked || (friendly.moved && !game.canUnitAttack(friendly)));
    const enemy = game.enemyAt(x, y);
    const target = !waiting && enemy && game.canUnitAttack(game.activeUnit, enemy);
    const reachable = movementTargets.has(`${x},${y}`);
    const captureTarget = captureReady && base === 'enemy';
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', Boolean(enemy));
    button.classList.toggle('enemy-acting', Boolean(enemy && enemy === actingEnemy));
    button.classList.toggle('target', Boolean(target));
    button.classList.toggle('active-unit', game.isCrossing && active);
    button.classList.toggle('selected', !waiting && active && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('capture-target', captureTarget);
    button.classList.toggle('captured-base', captured);
    button.classList.toggle('spent', tileSpent);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方' + friendly.name : enemy ? '敵' + enemy.name : '',
      base ? `${base === 'friendly' ? '味方' : '敵'}の本拠地` : '', captured ? '占領済み' : '',
      factory ? `${factory === 'friendly' ? '味方' : '敵'}の工場` : '',
      terrain.name, terrain.defense ? `防御${terrain.defense}` : '',
      terrain.cost === Infinity ? '通行不可' : terrain.cost ? `消費移動力${terrain.cost}` : '',
      target ? '攻撃可能' : '', captureTarget ? '占領可能' : reachable ? '移動可能' : '',
      occupied && game.isCrossing ? `HP ${friendly.hp}、${unitState(friendly)}` : '',
      enemy && game.isCrossing ? `HP ${enemy.hp}` : '', !game.isCrossing && tileSpent ? '行動済み' : '',
      !waiting && active && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    image.hidden = !occupied && !enemy;
    if (occupied || enemy) showImage(image, unitImage((enemy ?? friendly).type, Boolean(enemy)));
  }
  const {movement, minRange, maxRange} = game.playerUnit;
  document.getElementById('unit-name').textContent = game.activeUnit.name;
  document.getElementById('unit-movement').textContent = movement;
  document.getElementById('unit-range').textContent = minRange === maxRange ? maxRange : `${minRange}〜${maxRange}`;
  showImage(document.getElementById('unit-portrait'), unitImage(game.playerUnit));
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = game.playerHP ? position : '—';
  document.getElementById('unit-terrain').textContent = game.playerHP ? game.terrainAt(game.x, game.y).name : '—';
  document.getElementById('turn').textContent = String(game.turn).padStart(2, '0');
  const state = document.getElementById('state');
  const message = document.getElementById('message');
  state.classList.toggle('spent', spent);
  state.classList.toggle('attack-ready', !waiting && game.canAttack);
  const end = document.getElementById('end');
  if (waiting) end.setAttribute('aria-disabled', 'true');
  else end.removeAttribute('aria-disabled');
  document.getElementById('help').setAttribute('aria-disabled', String(Boolean(game.enemyTurn)));
  end.hidden = Boolean(game.result);
  const replay = document.getElementById('replay');
  const enemiesRemain = game.enemyUnits.some(unit => unit.hp > 0);
  replay.hidden = game.isBattle ? !game.result : enemiesRemain;
  replay.textContent = game.isBattle ? 'もう一度対戦する' : 'もう一度訓練する';
  replay.classList.toggle('primary', game.isBattle);
  document.getElementById('next-mission').hidden = game.isBattle || enemiesRemain;
  if (game.isBattle) renderBattleStatus();
  if (game.result) {
    state.textContent = lost ? '敗北' : '勝利';
    if (game.capturedBy) {
      const base = game.headquarters[lost ? 'friendly' : 'enemy'];
      const spot = coordinate(base.x, base.y);
      message.textContent = lost ? `敗北。敵歩兵に味方の本拠地（${spot}）を占領されました。`
        : `勝利！ 味方歩兵が敵の本拠地（${spot}）を占領しました。`;
    } else {
      message.textContent = lost ? '敗北。味方部隊が全滅しました。'
        : game.isCrossing ? '勝利！ 敵部隊をすべて撃破しました。' : '勝利！ 敵歩兵を撃破しました。';
    }
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = actingEnemy ? `敵${actingEnemy.name}が行動します。` : '敵部隊が行動します。';
  } else if (game.activeUnit.readyTurn > game.turn) {
    state.textContent = '生産直後';
    message.textContent = `${friendlyName}は次のターンから操作できます。`;
  } else if (captureReady) {
    state.textContent = '占領可能';
    message.textContent = '「占領」の印がある敵本拠地に歩兵を移動させると勝利します。';
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const targets = game.enemyUnits.filter(enemy => game.canUnitAttack(game.activeUnit, enemy));
    const target = targets.length === 1 ? `${coordinate(targets[0].x, targets[0].y)} の敵${targets[0].name}` : '印のある敵';
    message.textContent = `${target}を選ぶと、その場で攻撃できます。`
      + (game.selected ? ' 移動するには印のあるマスを選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    if (game.isCrossing) {
      const action = game.attacked ? '行動を終えました。' : `${position} に移動しました。`;
      const another = game.friendlyUnits.some(unit => unit !== game.activeUnit && unit.hp && unit.readyTurn <= game.turn
        && !unit.attacked && (!unit.moved || game.canUnitAttack(unit)));
      message.textContent = `${friendlyName}は${action}${another ? '別の味方を選べます。' : 'ターンを終了できます。'}`;
    } else if (game.attacked && game.isBattle) message.textContent = '戦闘終了。味方HP ' + game.playerHP + '、敵HP ' + game.enemyHP + '。ターンを終了できます。';
    else message.textContent = game.attacked ? '敵歩兵を撃破しました！' : position + ' に移動しました。ターンを終了できます。';
  } else if (game.selected) {
    state.textContent = '選択中';
    message.textContent = '印のあるマスを選んで移動します。' + (enemiesRemain ? '敵が射程に入ると攻撃できます。' : '');
  } else {
    state.textContent = '行動可能';
    message.textContent = `ターン ${game.turn}。${game.isCrossing ? '動かす部隊を選んでください。' : `盤面の${friendlyName}を選んでください。`}`;
  }
}

function renderBattleStatus() {
  const report = document.getElementById('enemy-report');
  if (game.isCrossing) {
    const lines = game.enemyActions.map(({enemy, friendly, from, to, captured}) => {
      const origin = coordinate(from.x, from.y);
      const destination = coordinate(to.x, to.y);
      if (origin === destination) {
        return `敵${enemy} ${destination}${friendly ? `から味方${friendly}を攻撃` : 'で待機'}`;
      }
      const result = captured ? '、本拠地を占領' : friendly ? `、味方${friendly}を攻撃` : '';
      return `敵${enemy} ${origin} → ${destination}${result}`;
    });
    if (game.production.enemy) {
      const {x, y} = game.factories.enemy;
      lines.push(`敵は工場（${coordinate(x, y)}）で${game.production.enemy.unit}を生産`);
    }
    report.hidden = lines.length === 0;
    report.textContent = lines.join('\n');
    return;
  }
  for (const [side, hp] of [['player', game.playerHP], ['enemy', game.enemyHP]]) {
    const meter = document.getElementById(side + '-hp');
    meter.max = game.maxHP;
    meter.value = hp;
    document.getElementById(side + '-hp-text').textContent = hp + '/' + meter.max;
  }
  const action = game.enemyAction;
  if (!action) {
    report.textContent = '敵歩兵のHPを0にすれば勝利。ターンを終えると敵が行動します。';
    return;
  }
  const from = coordinate(action.from.x, action.from.y);
  const to = coordinate(action.to.x, action.to.y);
  const movement = from === to ? to + ' に留まり' : from + ' から ' + to + ' へ移動し';
  const result = action.hit ? '、戦闘を開始しました。' : 'ました。';
  report.textContent = action.turn + 'ターン目、敵は' + movement + result;
}

function showMission() {
  const hash = location.hash.slice(1);
  const mode = Object.hasOwn(missions, hash) ? hash : 'training';
  game = missions[mode];
  music.setScene('map');
  const title = missionTitles[mode];
  document.title = 'ファミコンウォーズ｜' + title;
  document.getElementById('mission-title').textContent = title;
  for (const key of Object.keys(missions)) {
    const link = document.getElementById(key + '-link');
    if (key === mode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const rules = {
    training: '歩兵訓練では上下左右に合計2マスまで移動できます。HP1で始まり、敵はその場で待機します。',
    battle: '歩兵は上下左右に合計2マスまで移動できます。敵は毎ターン最大1マス近づき、隣接すると攻撃します。',
    crossing: '空いている敵の本拠地に歩兵を移動させるか、敵を全滅させると勝利です。双方とも空いている自陣の工場で、1ターンに1部隊を生産できます。生産した部隊は次のターンから行動できます。川は橋で渡り、湿地は移動力を2消費します。',
  };
  document.getElementById('mission-rules').textContent = rules[mode];
  document.getElementById('battle-health').hidden = !game.isBattle || game.isCrossing;
  roster.hidden = !game.isCrossing;
  enemyRoster.hidden = !game.isCrossing;
  document.getElementById('enemy-report').hidden = !game.isBattle;
  document.getElementById('terrain-legend').hidden = !game.isBattle;
  document.getElementById('crossing-legend').hidden = !game.isCrossing;
  document.getElementById('base-legend').hidden = !game.headquarters;
  document.getElementById('factory-legend').hidden = !game.factories;
  document.getElementById('production-controls').hidden = !game.factories;
  document.getElementById('crossing-objective').hidden = !game.headquarters;
  if (game.headquarters) {
    for (const [side, {x, y}] of Object.entries(game.headquarters)) {
      document.getElementById(`${side}-base-coordinate`).textContent = coordinate(x, y);
    }
    for (const [side, {x, y}] of Object.entries(game.factories)) {
      document.getElementById(`${side}-factory-coordinate`).textContent = coordinate(x, y);
    }
    document.getElementById('production-title-coordinate').textContent = coordinate(game.factories.friendly.x, game.factories.friendly.y);
  }
  document.getElementById('enemy-range').hidden = !game.isCrossing;
  document.getElementById('map-scroll-note').hidden = !game.isCrossing;
  document.getElementById('friendly-legend').textContent = game.isCrossing ? '味方部隊' : '味方歩兵';
  document.getElementById('enemy-legend').textContent = game.isCrossing ? '敵部隊' : '敵歩兵';
  buildBoard();
  rosterEntries.length = 0;
  enemyRosterEntries.length = 0;
  roster.replaceChildren();
  enemyRoster.replaceChildren();
  setBoardTabStop(friendlyTile());
  render();
  mapSurround.scrollLeft = 0;
  revealTile(friendlyTile());
}

function revealTile(button) {
  const viewport = mapSurround.getBoundingClientRect();
  const tile = button.getBoundingClientRect();
  if (tile.left < viewport.left) mapSurround.scrollLeft += tile.left - viewport.left - 12;
  if (tile.right > viewport.right) mapSurround.scrollLeft += tile.right - viewport.right + 12;
}

function setBoardTabStop(button) {
  for (const cell of cells) cell.button.tabIndex = cell.button === button ? 0 : -1;
}

function buildBoard() {
  board.replaceChildren();
  cells.length = 0;
  const {width, height} = game;
  board.dataset.mode = game.mode;
  mapSurround.dataset.mode = game.mode;
  mapSurround.style.setProperty('--columns', width);
  mapSurround.style.setProperty('--rows', height);
  board.setAttribute('aria-label', `${width}列${height}行の作戦マップ`);
  document.getElementById('dimensions').textContent = `${width} × ${height}`;
  for (const [id, count, label] of [['map-letters', width, columnName], ['map-numbers', height, index => index + 1]]) {
    const labels = Array.from({length: count}, (_, index) => {
      const item = document.createElement('b');
      item.textContent = label(index);
      return item;
    });
    document.getElementById(id).replaceChildren(...labels);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) addTile(x, y);
  }
}

function addTile(x, y) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  const base = game.headquartersAt(x, y);
  const factory = game.factoryAt(x, y);
  if (base) button.dataset.base = base;
  if (factory) button.dataset.factory = factory;
  button.classList.toggle('last-column', x === game.width - 1);
  button.classList.toggle('last-row', y === game.height - 1);
  const terrainLabel = document.createElement('span');
  terrainLabel.className = 'terrain-label';
  terrainLabel.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  button.append(terrainLabel, image);
  button.addEventListener('focus', () => setBoardTabStop(button));
  button.addEventListener('click', () => {
    if (combatScreen.active || waitingForEnemy() || game.result) return;
    const enemy = game.enemyAt(x, y);
    if (enemy && game.canUnitAttack(game.activeUnit, enemy)) {
      const acting = game;
      presentAttack(acting, {attacker: 'player', enemy, resolve: () => acting.choose(x, y)});
      return;
    }
    game.choose(x, y);
    if (game.capturedBy) restoreBoardFocus(game, 'player', true);
    else render();
  });
  button.addEventListener('keydown', (event) => {
    const offsets = {ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1]};
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    const nextX = Math.max(0, Math.min(game.width - 1, x + dx));
    const nextY = Math.max(0, Math.min(game.height - 1, y + dy));
    cells[nextY * game.width + nextX].button.focus();
  });
  cells.push({x, y, button, terrainLabel, image, base, factory});
  board.append(button);
}

document.getElementById('end').addEventListener('click', (event) => {
  if (combatScreen.active || waitingForEnemy() || game.result) return;
  const ending = game;
  if (ending.isCrossing) {
    if (event.detail <= 1 && ending.beginEnemyTurn()) runEnemyTurn(ending);
    return;
  }
  if (!ending.isBattle) {
    if (event.detail > 1) return;
    finishTurn(ending);
    return;
  }
  const enemyPlan = ending.planEnemyTurn();
  if (enemyPlan.hit) {
    presentAttack(ending, {attacker: 'enemy', enemy: ending.enemyUnits[0], enemyPosition: enemyPlan.to, resolve: () => ending.endTurn()});
    return;
  }
  pendingEnemyTurns.add(ending);
  render();
  window.setTimeout(() => {
    pendingEnemyTurns.delete(ending);
    finishTurn(ending);
  }, 450);
});

function runEnemyTurn(acting, restoreFocus = true) {
  const action = acting.prepareEnemyAction();
  if (!action) {
    acting.finishEnemyTurn();
    if (game === acting) restoreBoardFocus(acting, 'enemy', restoreFocus);
    return;
  }
  if (game === acting) render();
  window.setTimeout(() => {
    if (game === acting && action.friendly) {
      presentAttack(acting, {
        attacker: 'enemy', enemy: action.enemy, friendly: action.friendly, enemyPosition: action.to,
        resolve: () => acting.resolveEnemyAction(action),
        onReturn: focus => runEnemyTurn(acting, focus),
      });
    } else {
      acting.resolveEnemyAction(action);
      runEnemyTurn(acting, restoreFocus);
    }
  }, 280);
}

function presentAttack(acting, {attacker, friendly = acting.activeUnit, enemy, enemyPosition = enemy, resolve, onReturn}) {
  combatScreen.open({
    map: acting, attacker, friendly, enemy, enemyPosition, resolve,
    onReturn: onReturn ?? (restoreFocus => {
      if (game === acting) restoreBoardFocus(acting, attacker, restoreFocus);
    }),
  });
}

function restoreBoardFocus(acting, attacker, restoreFocus) {
  const tile = friendlyTile();
  setBoardTabStop(tile);
  render();
  if (acting.capturedBy) music.setScene(acting.result);
  if (!restoreFocus || document.getElementById('guide').open) return;
  const control = acting.result ? document.getElementById('replay')
    : attacker === 'player' && !acting.isCrossing ? document.getElementById('end') : tile;
  if (control === tile && acting.isCrossing) revealTile(tile);
  control.focus({preventScroll: !acting.capturedBy});
}

function finishTurn(ending) {
  ending.endTurn();
  if (ending !== game) return;
  setBoardTabStop(friendlyTile());
  render();
  if (game.result && !document.getElementById('guide').open) document.getElementById('replay').focus();
}

document.getElementById('end').addEventListener('keydown', (event) => {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
});
for (const button of productionButtons) {
  button.addEventListener('click', () => {
    if (!combatScreen.active && game.produce(button.dataset.produce)) render();
  });
}
document.getElementById('help').addEventListener('click', () => {
  if (!game.enemyTurn) document.getElementById('guide').showModal();
});
document.getElementById('replay').addEventListener('click', () => {
  missions[game.mode] = new TrainingMap(game.mode);
  showMission();
  friendlyTile().focus();
});
window.addEventListener('hashchange', () => {
  combatScreen.close(false);
  showMission();
  document.getElementById('mission-title').focus({preventScroll: true});
  window.scrollTo(0, 0);
});
showMission();
