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
    this.playerHP = this.maxHP;
    this.enemyHP = this.maxHP;
    this.enemyAction = null;
    if (this.isBattle) {
      this.x = 1;
      this.y = 3;
      this.enemy = {x: 3, y: 1};
    }
  }

  get maxHP() {
    return this.isBattle ? 3 : 1;
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
      this.attacked = true;
      this.selected = false;
      return this.#exchange('player');
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
    let strikes;
    if (this.isBattle) {
      this.enemyAction = this.planEnemyTurn();
      this.enemy = {...this.enemyAction.to};
      if (this.enemyAction.hit) strikes = this.#exchange('enemy');
    }
    if (!this.result) this.turn += 1;
    return strikes;
  }

  #exchange(attacker) {
    const strikes = [this.#strike(attacker)];
    const defender = attacker === 'player' ? 'enemy' : 'player';
    if (this.playerHP > 0 && this.enemyHP > 0) strikes.push(this.#strike(defender));
    return strikes;
  }

  #strike(attacker) {
    if (attacker === 'player') {
      this.enemyHP -= 1;
      if (this.enemyHP === 0) this.enemy = null;
    } else {
      this.playerHP -= 1;
    }
    return {attacker, playerHP: this.playerHP, enemyHP: this.enemyHP};
  }

  planEnemyTurn() {
    if (!this.isBattle || this.result) return null;
    const from = {...this.enemy};
    const to = {...from};
    const dx = this.x - from.x;
    const dy = this.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) {
      if (Math.abs(dx) >= Math.abs(dy)) to.x += Math.sign(dx);
      else to.y += Math.sign(dy);
    }
    const hit = Math.abs(this.x - to.x) + Math.abs(this.y - to.y) === 1;
    return {turn: this.turn, from, to, hit};
  }
}

if (typeof module !== 'undefined') module.exports = TrainingMap;
