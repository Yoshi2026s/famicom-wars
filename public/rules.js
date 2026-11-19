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

  isEnemyAt(x, y) {
    return this.enemy !== null && this.enemy.x === x && this.enemy.y === y;
  }

  get canAttack() {
    return this.moved && this.enemy !== null
      && Math.abs(this.x - this.enemy.x) + Math.abs(this.y - this.enemy.y) === 1;
  }

  canMoveTo(x, y) {
    const distance = Math.abs(this.x - x) + Math.abs(this.y - y);
    return this.selected && !this.moved && Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < TrainingMap.size && y < TrainingMap.size
      && distance > 0 && distance <= TrainingMap.movement
      && !this.isEnemyAt(x, y)
      // A two-step straight move has one possible intermediate square.
      && !(distance === 2 && this.isEnemyAt((this.x + x) / 2, (this.y + y) / 2));
  }

  choose(x, y) {
    if (this.moved) {
      if (this.canAttack && this.isEnemyAt(x, y)) {
        this.enemy = null;
        this.attacked = true;
      }
      return;
    }
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
    this.turn += 1;
    this.selected = false;
    this.moved = false;
    this.attacked = false;
  }
}

if (typeof module !== 'undefined') module.exports = TrainingMap;
