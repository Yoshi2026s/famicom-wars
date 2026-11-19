const missions = {training: new TrainingMap(), battle: new TrainingMap('battle')};
let game = missions.training;
let pendingEnemyTurn = null;
const board = document.getElementById('board');
const cells = [];
const columns = 'ABCDE';
const troop = document.createElement('img');
troop.src = './assets/infantry.png';
troop.alt = '';
troop.draggable = false;
const opposingTroop = troop.cloneNode();
opposingTroop.src = './assets/enemy-infantry.png';

function coordinate(x, y) {
  return columns[x] + (y + 1);
}

function render() {
  const waiting = game === pendingEnemyTurn;
  const spent = !game.canMove && !game.canAttack;
  const lost = game.result === 'defeat';
  if (!game.enemy) opposingTroop.remove();
  if (lost) troop.remove();
  for (const cell of cells) {
    const {x, y, button} = cell;
    const occupied = !lost && game.x === x && game.y === y;
    const enemy = game.isEnemyAt(x, y);
    const target = !waiting && enemy && game.canAttack;
    const reachable = !waiting && game.canMoveTo(x, y);
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', enemy);
    button.classList.toggle('target', target);
    button.classList.toggle('selected', !waiting && occupied && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('spent', occupied && spent);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方歩兵' : enemy ? '敵歩兵' : '草原',
      target ? '攻撃可能' : '', reachable ? '移動可能' : '', occupied && spent ? '行動済み' : '',
      !waiting && occupied && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    if (occupied && troop.parentNode !== button) button.append(troop);
    if (enemy && opposingTroop.parentNode !== button) button.append(opposingTroop);
  }
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = lost ? '—' : position;
  document.getElementById('turn').textContent = String(game.turn).padStart(2, '0');
  const state = document.getElementById('state');
  const message = document.getElementById('message');
  state.classList.toggle('spent', spent);
  state.classList.toggle('attack-ready', !waiting && game.canAttack);
  const end = document.getElementById('end');
  end.disabled = waiting;
  end.hidden = Boolean(game.result);
  const replay = document.getElementById('replay');
  replay.hidden = game.isBattle ? !game.result : Boolean(game.enemy);
  replay.textContent = game.isBattle ? 'もう一度対戦する' : 'もう一度訓練する';
  replay.classList.toggle('primary', game.isBattle);
  document.getElementById('next-mission').hidden = game.isBattle || Boolean(game.enemy);
  if (game.isBattle) renderBattleStatus();
  if (game.result) {
    state.textContent = lost ? '敗北' : '勝利';
    message.textContent = lost ? '敗北。味方のHPが0になりました。' : '勝利！ 敵歩兵を撃破しました。';
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = '敵歩兵が行動します。';
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const target = coordinate(game.enemy.x, game.enemy.y);
    message.textContent = target + ' の敵歩兵を選ぶと、その場で攻撃できます。'
      + (game.selected ? ' 移動するには印のある草原を選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    if (game.attacked && game.isBattle) message.textContent = '敵に1ダメージ。残りHPは' + game.enemyHP + 'です。ターンを終了できます。';
    else message.textContent = game.attacked ? '敵歩兵を撃破しました！' : position + ' に移動しました。ターンを終了できます。';
  } else if (game.selected) {
    state.textContent = '選択中';
    message.textContent = game.enemy ? '印のあるマスに移動します。敵の上下左右に並ぶと攻撃できます。' : '印のあるマスを選んで移動します。';
  } else {
    state.textContent = '行動可能';
    message.textContent = 'ターン ' + game.turn + '。盤面の味方歩兵を選んでください。';
  }
}

function renderBattleStatus() {
  for (const [side, hp] of [['player', game.playerHP], ['enemy', game.enemyHP]]) {
    const meter = document.getElementById(side + '-hp');
    meter.value = hp;
    document.getElementById(side + '-hp-text').textContent = hp + '/' + meter.max;
  }
  const report = document.getElementById('enemy-report');
  report.hidden = false;
  const action = game.enemyAction;
  if (!action) {
    report.textContent = '敵歩兵のHPを0にすれば勝利。ターンを終えると敵が行動します。';
    return;
  }
  const from = coordinate(action.from.x, action.from.y);
  const to = coordinate(action.to.x, action.to.y);
  const movement = from === to ? to + ' に留まり' : from + ' から ' + to + ' へ移動し';
  report.textContent = action.turn + 'ターン目、敵は' + movement + (action.hit ? '、味方に1ダメージ。' : 'ました。');
}

function showMission() {
  const battle = location.hash === '#battle';
  game = battle ? missions.battle : missions.training;
  const title = battle ? '草原の遭遇戦' : 'はじまりの草原';
  document.title = 'ファミコンウォーズ｜' + title;
  document.getElementById('mission-title').textContent = title;
  for (const [id, active] of [['training-link', !battle], ['battle-link', battle]]) {
    const link = document.getElementById(id);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.getElementById('mission-rules').textContent = battle
    ? '歩兵戦では味方HPは3、敵HPは2です。敵は毎ターン最大1マス近づき、上下左右に隣接すると1ダメージを与えます。先に相手のHPを0にすると勝利です。'
    : '歩兵訓練では敵はその場で待機します。攻撃1回で撃破できます。';
  document.getElementById('battle-health').hidden = !battle;
  document.getElementById('enemy-report').hidden = !battle;
  setBoardTabStop(cells[game.y * TrainingMap.size + game.x].button);
  render();
}

function setBoardTabStop(button) {
  for (const cell of cells) cell.button.tabIndex = cell.button === button ? 0 : -1;
}

for (let y = 0; y < TrainingMap.size; y++) {
  for (let x = 0; x < TrainingMap.size; x++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.tabIndex = x === game.x && y === game.y ? 0 : -1;
    button.addEventListener('focus', () => setBoardTabStop(button));
    button.addEventListener('click', () => {
      if (game === pendingEnemyTurn || game.result) return;
      game.choose(x, y);
      render();
    });
    button.addEventListener('keydown', (event) => {
      const offsets = {ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1]};
      if (!Object.hasOwn(offsets, event.key)) return;
      event.preventDefault();
      const [dx, dy] = offsets[event.key];
      const nextX = Math.max(0, Math.min(TrainingMap.size - 1, x + dx));
      const nextY = Math.max(0, Math.min(TrainingMap.size - 1, y + dy));
      cells[nextY * TrainingMap.size + nextX].button.focus();
    });
    cells.push({x, y, button});
    board.append(button);
  }
}

document.getElementById('end').addEventListener('click', (event) => {
  if (game === pendingEnemyTurn || game.result) return;
  const ending = game;
  if (!ending.isBattle) {
    if (event.detail > 1) return;
    finishTurn(ending);
    return;
  }
  pendingEnemyTurn = ending;
  render();
  window.setTimeout(() => {
    pendingEnemyTurn = null;
    finishTurn(ending);
  }, 450);
});

function finishTurn(ending) {
  ending.endTurn();
  if (ending !== game) return;
  setBoardTabStop(cells[game.y * TrainingMap.size + game.x].button);
  render();
  if (game.result && !document.getElementById('guide').open) document.getElementById('replay').focus();
}

document.getElementById('end').addEventListener('keydown', (event) => {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
});
document.getElementById('help').addEventListener('click', () => document.getElementById('guide').showModal());
document.getElementById('replay').addEventListener('click', () => {
  const mode = game.isBattle ? 'battle' : 'training';
  missions[mode] = new TrainingMap(mode);
  showMission();
  cells[game.y * TrainingMap.size + game.x].button.focus();
});
window.addEventListener('hashchange', () => {
  showMission();
  document.getElementById('mission-title').focus({preventScroll: true});
  window.scrollTo(0, 0);
});
showMission();
