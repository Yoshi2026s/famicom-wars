const missionTitles = {training: 'はじまりの草原', battle: '草原の遭遇戦', crossing: '水辺の攻防'};
const missions = Object.fromEntries(Object.keys(missionTitles).map(mode => [mode, new TrainingMap(mode)]));
let game = missions.training;
const pendingEnemyTurns = new Set();
const board = document.getElementById('board');
const mapSurround = document.getElementById('map-surround');
const roster = document.getElementById('friendly-roster');
const enemyRoster = document.getElementById('enemy-roster');
const cells = [];
let rosterEntries = [];
let enemyRosterEntries = [];

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

function buildRoster(container, units, interactive) {
  const entries = units.map(unit => {
    const card = document.createElement(interactive ? 'button' : 'div');
    const name = document.createElement('strong');
    name.textContent = (interactive ? '' : '敵') + unit.type.name;
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
    return {unit, card, hp, state};
  });
  container.replaceChildren(...entries.map(entry => entry.card));
  return entries;
}

function unitState(unit) {
  if (!unit.hp) return '撃破';
  if (unit.attacked) return '行動済み';
  if (unit.moved) return game.canUnitAttack(unit) ? '攻撃可能' : '移動済み';
  return '移動可能';
}

function render() {
  const waiting = waitingForEnemy();
  const spent = !game.canMove && !game.canAttack;
  const lost = game.result === 'defeat';
  const friendlyName = '味方' + game.playerUnit.name;
  const movementTargets = waiting ? new Map() : game.movementTargets();
  const actingEnemy = game.enemyTurn?.action?.enemy;
  for (const {unit, card, hp, state} of rosterEntries) {
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    state.textContent = unitState(unit);
    card.disabled = !unit.hp || Boolean(game.result);
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
    const {x, y, button, terrainLabel, image} = cell;
    const terrain = game.terrainAt(x, y);
    button.dataset.terrain = terrain.id;
    terrainLabel.textContent = terrain.name;
    terrainLabel.hidden = terrain.id === 'plains';
    const friendly = game.friendlyAt(x, y);
    const occupied = Boolean(friendly);
    const active = friendly === game.activeUnit;
    const tileSpent = occupied && (friendly.attacked || (friendly.moved && !game.canUnitAttack(friendly)));
    const enemy = game.enemyAt(x, y);
    const target = !waiting && enemy && game.canUnitAttack(game.activeUnit, enemy);
    const reachable = movementTargets.has(`${x},${y}`);
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', Boolean(enemy));
    button.classList.toggle('enemy-acting', Boolean(enemy && enemy === actingEnemy));
    button.classList.toggle('target', Boolean(target));
    button.classList.toggle('active-unit', game.isCrossing && active);
    button.classList.toggle('selected', !waiting && active && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('spent', tileSpent);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方' + friendly.type.name : enemy ? '敵' + enemy.type.name : '',
      terrain.name, terrain.defense ? `防御${terrain.defense}` : '',
      terrain.cost === Infinity ? '通行不可' : terrain.cost ? `消費移動力${terrain.cost}` : '',
      target ? '攻撃可能' : '', reachable ? '移動可能' : '',
      occupied && game.isCrossing ? `HP ${friendly.hp}、${unitState(friendly)}` : '',
      enemy && game.isCrossing ? `HP ${enemy.hp}` : '', !game.isCrossing && tileSpent ? '行動済み' : '',
      !waiting && active && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    image.hidden = !occupied && !enemy;
    if (occupied || enemy) showImage(image, unitImage((enemy ?? friendly).type, Boolean(enemy)));
  }
  const {name, movement, minRange, maxRange} = game.playerUnit;
  document.getElementById('unit-name').textContent = name;
  document.getElementById('unit-movement').textContent = movement;
  document.getElementById('unit-range').textContent = minRange === maxRange ? maxRange : `${minRange}〜${maxRange}`;
  showImage(document.getElementById('unit-portrait'), unitImage(game.playerUnit));
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = lost ? '—' : position;
  document.getElementById('unit-terrain').textContent = lost ? '—' : game.terrainAt(game.x, game.y).name;
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
    message.textContent = lost ? '敗北。味方部隊が全滅しました。'
      : game.isCrossing ? '勝利！ 敵部隊をすべて撃破しました。' : '勝利！ 敵歩兵を撃破しました。';
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = actingEnemy ? `敵${actingEnemy.type.name}が行動します。` : '敵部隊が行動します。';
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const targets = game.enemyUnits.filter(enemy => game.canUnitAttack(game.activeUnit, enemy));
    const target = targets.length === 1 ? `${coordinate(targets[0].x, targets[0].y)} の敵${targets[0].type.name}` : '印のある敵';
    message.textContent = `${target}を選ぶと、その場で攻撃できます。`
      + (game.selected ? ' 移動するには印のあるマスを選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    if (game.isCrossing) {
      const action = game.attacked ? '行動を終えました。' : `${position} に移動しました。`;
      const another = game.friendlyUnits.some(unit => unit !== game.activeUnit && unit.hp && !unit.attacked && (!unit.moved || game.canUnitAttack(unit)));
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
    report.textContent = game.enemyActions.map(({enemy, friendly, from, to}) => {
      const origin = coordinate(from.x, from.y);
      const destination = coordinate(to.x, to.y);
      if (origin === destination) {
        return `敵${enemy} ${destination}${friendly ? `から味方${friendly}を攻撃` : 'で待機'}`;
      }
      return `敵${enemy} ${origin} → ${destination}${friendly ? `、味方${friendly}を攻撃` : ''}`;
    }).join('\n') || '敵部隊をすべて撃破すると勝利です。';
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
    crossing: '味方はそれぞれ1ターンに1回移動でき、移動後も射程内の敵を1回攻撃できます。敵のターンは歩兵・偵察車・支援車の順に、移動と攻撃をそれぞれ1回まで行います。川は橋で渡り、湿地は移動力を2消費します。',
  };
  document.getElementById('mission-rules').textContent = rules[mode];
  document.getElementById('battle-health').hidden = !game.isBattle || game.isCrossing;
  roster.hidden = !game.isCrossing;
  enemyRoster.hidden = !game.isCrossing;
  document.getElementById('enemy-report').hidden = !game.isBattle;
  document.getElementById('terrain-legend').hidden = !game.isBattle;
  document.getElementById('crossing-legend').hidden = !game.isCrossing;
  document.getElementById('enemy-range').hidden = !game.isCrossing;
  document.getElementById('map-scroll-note').hidden = !game.isCrossing;
  document.getElementById('friendly-legend').textContent = game.isCrossing ? '味方部隊' : '味方歩兵';
  document.getElementById('enemy-legend').textContent = game.isCrossing ? '敵部隊' : '敵歩兵';
  buildBoard();
  rosterEntries = buildRoster(roster, game.isCrossing ? game.friendlyUnits : [], true);
  enemyRosterEntries = buildRoster(enemyRoster, game.isCrossing ? game.enemyUnits : [], false);
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
    render();
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
  cells.push({x, y, button, terrainLabel, image});
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
  if (!restoreFocus || document.getElementById('guide').open) return;
  const control = acting.result ? document.getElementById('replay')
    : attacker === 'player' && !acting.isCrossing ? document.getElementById('end') : tile;
  if (control === tile && acting.isCrossing) revealTile(tile);
  control.focus({preventScroll: true});
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
