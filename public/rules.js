class TrainingMap {
  static size = 5;
  static movement = 2;
  x = 2;
  y = 2;
  turn = 1;
  selected = false;
  moved = false;

  canMoveTo(x, y) {
    const distance = Math.abs(this.x - x) + Math.abs(this.y - y);
    return this.selected && !this.moved && Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < TrainingMap.size && y < TrainingMap.size
      && distance > 0 && distance <= TrainingMap.movement;
  }

  choose(x, y) {
    if (this.moved) return;
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
  }
}

if (typeof module !== 'undefined') module.exports = TrainingMap;
