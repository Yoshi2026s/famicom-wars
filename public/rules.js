class TrainingMap {
  static size = 5;
  static movement = 2;
  x = 2;
  y = 2;
  enemy = {x: 4, y: 1};
  turn = 1;
  selected = false;
  moved = false;
  attacked = false;

  constructor(mode = 'training') {
    this.isBattle = mode === 'battle';
    this.playerHP = this.isBattle ? 3 : 1;
    this.enemyHP = this.isBattle ? 2 : 1;
    this.enemyAction = null;
    if (this.isBattle) {
      this.x = 1;
      this.y = 3;
      this.enemy = {x: 3, y: 1};
    }
  }

  get result() {
    if (this.isBattle && this.playerHP === 0) return 'defeat';
    if (this.isBattle && !this.enemy) return 'victory';
    return null;
  }

  isEnemyAt(x, y) {
    return this.enemy !== null && this.enemy.x === x && this.enemy.y === y;
  }

  get canAttack() {
    return this.playerHP > 0 && !this.attacked && this.enemy !== null
      && Math.abs(this.x - this.enemy.x) + Math.abs(this.y - this.enemy.y) === 1;
  }

  get canMove() {
    return !this.result && !this.moved && !this.attacked;
  }

  canMoveTo(x, y) {
    const distance = Math.abs(this.x - x) + Math.abs(this.y - y);
    return this.selected && this.canMove && Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < TrainingMap.size && y < TrainingMap.size
      && distance > 0 && distance <= TrainingMap.movement
      && !this.isEnemyAt(x, y)
      // A two-step straight move has one possible intermediate square.
      && !(distance === 2 && this.isEnemyAt((this.x + x) / 2, (this.y + y) / 2));
  }

  choose(x, y) {
    if (this.isEnemyAt(x, y) && this.canAttack) {
      this.enemyHP -= 1;
      if (this.enemyHP === 0) this.enemy = null;
      this.attacked = true;
      this.selected = false;
      return;
    }
    if (!this.canMove) return;
    if (x === this.x && y === this.y) {
      this.selected = !this.selected;
    } else if (this.canMoveTo(x, y)) {
      this.x = x;
      this.y = y;
      this.selected = false;
      this.moved = true;
    }
  }

  endTurn() {
    if (this.result) return;
    this.selected = false;
    this.moved = false;
    this.attacked = false;
    if (this.isBattle) this.#takeEnemyTurn();
    if (!this.result) this.turn += 1;
  }

  #takeEnemyTurn() {
    const from = {...this.enemy};
    const dx = this.x - from.x;
    const dy = this.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) {
      if (Math.abs(dx) >= Math.abs(dy)) this.enemy.x += Math.sign(dx);
      else this.enemy.y += Math.sign(dy);
    }
    const hit = Math.abs(this.x - this.enemy.x) + Math.abs(this.y - this.enemy.y) === 1;
    if (hit) this.playerHP -= 1;
    this.enemyAction = {turn: this.turn, from, to: {...this.enemy}, hit};
  }
}

if (typeof module !== 'undefined') module.exports = TrainingMap;
