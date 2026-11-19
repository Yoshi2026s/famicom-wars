const game = new TrainingMap();
const board = document.getElementById('board');
const cells = [];
const columns = 'ABCDE';
const troop = document.createElement('img');
troop.src = './assets/infantry.png';
troop.alt = '';
troop.draggable = false;

function coordinate(x, y) {
  return columns[x] + (y + 1);
}

function render() {
  for (const cell of cells) {
    const {x, y, button} = cell;
    const occupied = game.x === x && game.y === y;
    const reachable = game.canMoveTo(x, y);
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('selected', occupied && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('spent', occupied && game.moved);
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方歩兵' : '草原',
      reachable ? '移動可能' : '', occupied && game.moved ? '行動済み' : '',
      occupied && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    if (occupied && troop.parentNode !== button) button.append(troop);
  }
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = position;
  document.getElementById('turn').textContent = String(game.turn).padStart(2, '0');
  const state = document.getElementById('state');
  state.textContent = game.moved ? '行動済み' : game.selected ? '選択中' : '行動可能';
  state.classList.toggle('spent', game.moved);
  document.getElementById('message').textContent = game.moved
    ? position + ' に移動しました。ターンを終了できます。'
    : game.selected ? '印のあるマスを選んで移動します。'
    : 'ターン ' + game.turn + '。盤面の歩兵を選んでください。';
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
render();
