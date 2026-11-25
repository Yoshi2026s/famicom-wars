const missionTitles = {training: 'はじまりの草原', battle: '草原の遭遇戦', crossing: '水辺の攻防'};
const missions = Object.fromEntries(Object.keys(missionTitles).map(mode => [mode, new TrainingMap(mode)]));
let game = missions.training;
const pendingEnemyTurns = new Set();
const board = document.getElementById('board');
const mapSurround = document.getElementById('map-surround');
const cells = [];
const troop = document.createElement('img');
troop.alt = '';
troop.draggable = false;
const opposingTroop = troop.cloneNode();

function columnName(x) {
  return String.fromCharCode(65 + x);
}

function coordinate(x, y) {
  return columnName(x) + (y + 1);
}

function friendlyTile() {
  return cells[game.y * game.width + game.x].button;
}

function render() {
  const waiting = pendingEnemyTurns.has(game);
  const spent = !game.canMove && !game.canAttack;
  const lost = game.result === 'defeat';
  const friendlyName = '味方' + game.playerUnit.name;
  const enemyName = '敵' + game.enemyUnit.name;
  const movementTargets = waiting ? new Map() : game.movementTargets();
  if (!game.enemy) opposingTroop.remove();
  if (lost) troop.remove();
  for (const cell of cells) {
    const {x, y, button, terrainLabel} = cell;
    const terrain = game.terrainAt(x, y);
    button.dataset.terrain = terrain.id;
    terrainLabel.textContent = terrain.name;
    terrainLabel.hidden = terrain.id === 'plains';
    const occupied = !lost && game.x === x && game.y === y;
    const enemy = game.isEnemyAt(x, y);
    const target = !waiting && enemy && game.canAttack;
    const reachable = movementTargets.has(`${x},${y}`);
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', enemy);
    button.classList.toggle('target', target);
    button.classList.toggle('selected', !waiting && occupied && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('spent', occupied && spent);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? friendlyName : enemy ? enemyName : '',
      terrain.name, terrain.defense ? `防御${terrain.defense}` : '',
      terrain.cost === Infinity ? '通行不可' : terrain.cost ? `消費移動力${terrain.cost}` : '',
      target ? '攻撃可能' : '', reachable ? '移動可能' : '', occupied && spent ? '行動済み' : '',
      !waiting && occupied && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    if (occupied && troop.parentNode !== button) button.append(troop);
    if (enemy && opposingTroop.parentNode !== button) button.append(opposingTroop);
  }
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
  end.hidden = Boolean(game.result);
  const replay = document.getElementById('replay');
  replay.hidden = game.isBattle ? !game.result : Boolean(game.enemy);
  replay.textContent = game.isBattle ? 'もう一度対戦する' : 'もう一度訓練する';
  replay.classList.toggle('primary', game.isBattle);
  document.getElementById('next-mission').hidden = game.isBattle || Boolean(game.enemy);
  if (game.isBattle) renderBattleStatus();
  if (game.result) {
    state.textContent = lost ? '敗北' : '勝利';
    message.textContent = lost ? '敗北。味方のHPが0になりました。' : `勝利！ ${enemyName}を撃破しました。`;
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = `${enemyName}が行動します。`;
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const target = coordinate(game.enemy.x, game.enemy.y);
    message.textContent = `${target} の${enemyName}を選ぶと、その場で攻撃できます。`
      + (game.selected ? ' 移動するには印のあるマスを選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    if (game.attacked && game.isBattle) message.textContent = '戦闘終了。味方HP ' + game.playerHP + '、敵HP ' + game.enemyHP + '。ターンを終了できます。';
    else message.textContent = game.attacked ? `${enemyName}を撃破しました！` : position + ' に移動しました。ターンを終了できます。';
  } else if (game.selected) {
    state.textContent = '選択中';
    message.textContent = game.enemy ? '印のあるマスを選んで移動します。敵に隣接すると攻撃できます。' : '印のあるマスを選んで移動します。';
  } else {
    state.textContent = '行動可能';
    message.textContent = `ターン ${game.turn}。盤面の${friendlyName}を選んでください。`;
  }
}

function renderBattleStatus() {
  for (const [side, hp] of [['player', game.playerHP], ['enemy', game.enemyHP]]) {
    const meter = document.getElementById(side + '-hp');
    meter.max = game.maxHP;
    meter.value = hp;
    document.getElementById(side + '-hp-text').textContent = hp + '/' + meter.max;
  }
  const report = document.getElementById('enemy-report');
  report.hidden = false;
  const action = game.enemyAction;
  if (!action) {
    report.textContent = `敵${game.enemyUnit.name}のHPを0にすれば勝利。ターンを終えると敵が行動します。`;
    return;
  }
  const from = coordinate(action.from.x, action.from.y);
  const to = coordinate(action.to.x, action.to.y);
  const movement = from === to ? to + ' に留まり' : from + ' から ' + to + ' へ移動し';
  report.textContent = action.turn + 'ターン目、敵は' + movement + (action.hit ? '、戦闘を開始しました。' : 'ました。');
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
    crossing: '偵察車は移動力4で射程1。支援車は移動力1で射程2〜3です。距離は上下左右で数えます。川は橋で渡れます。湿地は移動力を2消費します。',
  };
  document.getElementById('mission-rules').textContent = rules[mode];
  document.getElementById('battle-health').hidden = !game.isBattle;
  document.getElementById('enemy-report').hidden = !game.isBattle;
  document.getElementById('terrain-legend').hidden = !game.isBattle;
  document.getElementById('crossing-legend').hidden = !game.isCrossing;
  document.getElementById('enemy-range').hidden = !game.isCrossing;
  document.getElementById('map-scroll-note').hidden = !game.isCrossing;
  document.getElementById('friendly-legend').textContent = '味方' + game.playerUnit.name;
  document.getElementById('enemy-legend').textContent = '敵' + game.enemyUnit.name;
  document.getElementById('unit-name').textContent = game.playerUnit.name;
  document.getElementById('unit-movement').textContent = game.playerUnit.movement;
  document.getElementById('unit-range').textContent = game.playerUnit.maxRange;
  troop.src = `./assets/${game.playerUnit.id}.png`;
  opposingTroop.src = game.isCrossing ? './assets/support.png' : './assets/enemy-infantry.png';
  document.getElementById('unit-portrait').src = troop.src;
  buildBoard();
  setBoardTabStop(friendlyTile());
  render();
  mapSurround.scrollLeft = 0;
  const viewport = mapSurround.getBoundingClientRect();
  const tile = friendlyTile().getBoundingClientRect();
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
  button.append(terrainLabel);
  button.addEventListener('focus', () => setBoardTabStop(button));
  button.addEventListener('click', () => {
    if (combatScreen.active || pendingEnemyTurns.has(game) || game.result) return;
    if (game.canAttack && game.isEnemyAt(x, y)) {
      const acting = game;
      presentAttack(acting, 'player', () => acting.choose(x, y));
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
  cells.push({x, y, button, terrainLabel});
  board.append(button);
}

document.getElementById('end').addEventListener('click', (event) => {
  if (combatScreen.active || pendingEnemyTurns.has(game) || game.result) return;
  const ending = game;
  if (!ending.isBattle) {
    if (event.detail > 1) return;
    finishTurn(ending);
    return;
  }
  if (ending.planEnemyTurn().hit) {
    presentAttack(ending, 'enemy', () => ending.endTurn());
    return;
  }
  pendingEnemyTurns.add(ending);
  render();
  window.setTimeout(() => {
    pendingEnemyTurns.delete(ending);
    finishTurn(ending);
  }, 450);
});

function presentAttack(acting, attacker, resolve) {
  combatScreen.open(acting, attacker, resolve, (restoreFocus) => {
    if (game !== acting) return;
    const friendly = friendlyTile();
    setBoardTabStop(friendly);
    render();
    if (restoreFocus) {
      const control = acting.result ? document.getElementById('replay')
        : attacker === 'player' ? document.getElementById('end') : friendly;
      control.focus({preventScroll: true});
    }
  });
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
document.getElementById('help').addEventListener('click', () => document.getElementById('guide').showModal());
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
