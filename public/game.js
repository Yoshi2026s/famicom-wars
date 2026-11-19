let game = new TrainingMap();
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
  const spent = !game.canMove && !game.canAttack;
  if (!game.enemy) opposingTroop.remove();
  for (const cell of cells) {
    const {x, y, button} = cell;
    const occupied = game.x === x && game.y === y;
    const enemy = game.isEnemyAt(x, y);
    const target = enemy && game.canAttack;
    const reachable = game.canMoveTo(x, y);
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', enemy);
    button.classList.toggle('target', target);
    button.classList.toggle('selected', occupied && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('spent', occupied && spent);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方歩兵' : enemy ? '敵歩兵' : '草原',
      target ? '攻撃可能' : '', reachable ? '移動可能' : '', occupied && spent ? '行動済み' : '',
      occupied && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    if (occupied && troop.parentNode !== button) button.append(troop);
    if (enemy && opposingTroop.parentNode !== button) button.append(opposingTroop);
  }
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = position;
  document.getElementById('turn').textContent = String(game.turn).padStart(2, '0');
  const state = document.getElementById('state');
  const message = document.getElementById('message');
  state.classList.toggle('spent', spent);
  state.classList.toggle('attack-ready', game.canAttack);
  document.getElementById('replay').hidden = game.enemy !== null;
  if (game.canAttack) {
    state.textContent = '攻撃可能';
    const target = coordinate(game.enemy.x, game.enemy.y);
    message.textContent = target + ' の敵歩兵を選ぶと、その場で攻撃できます。'
      + (game.selected ? ' 移動するには印のある草原を選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    message.textContent = game.attacked ? '敵歩兵を撃破しました！' : position + ' に移動しました。ターンを終了できます。';
  } else if (game.selected) {
    state.textContent = '選択中';
    message.textContent = game.enemy ? '印のあるマスに移動します。敵の上下左右に並ぶと攻撃できます。' : '印のあるマスを選んで移動します。';
  } else {
    state.textContent = '行動可能';
    message.textContent = 'ターン ' + game.turn + '。盤面の味方歩兵を選んでください。';
  }
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
  if (event.detail > 1) return;
  game.endTurn();
  setBoardTabStop(cells[game.y * TrainingMap.size + game.x].button);
  render();
});
document.getElementById('help').addEventListener('click', () => document.getElementById('guide').showModal());
document.getElementById('replay').addEventListener('click', () => {
  game = new TrainingMap();
  render();
  cells[game.y * TrainingMap.size + game.x].button.focus();
});
render();
