const terrainTypes = {
  p: Object.freeze({id: 'plains', name: '草原', defense: 0}),
  f: Object.freeze({id: 'forest', name: '森', defense: 1}),
  m: Object.freeze({id: 'mountain', name: '山', defense: 2}),
  r: Object.freeze({id: 'river', name: '川', defense: 0, cost: Infinity}),
  b: Object.freeze({id: 'bridge', name: '橋', defense: 0}),
  s: Object.freeze({id: 'marsh', name: '湿地', defense: 1, cost: 2}),
};
const battleTerrain = [
  'fppmf',
  'fpmpp',
  'ppfpf',
  'mpppm',
  'pffpp',
];
const crossingTerrain = [
  'pfmffrfmfp',
  'ppfppbffpp',
  'fppsrrpfmp',
  'mfpsrpsspp',
  'pppsrppfpp',
  'fpspbppfmp',
  'ppfsrsppfp',
  'fppprsfppp',
];
const infantry = Object.freeze({id: 'infantry', name: '歩兵', movement: 2, minRange: 1, maxRange: 1});
const scout = Object.freeze({id: 'scout', name: '偵察車', movement: 4, minRange: 1, maxRange: 1});
const support = Object.freeze({id: 'support', name: '支援車', movement: 1, minRange: 2, maxRange: 3});
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function distanceBetween(from, to) {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function inRange(unit, from, to) {
  const distance = distanceBetween(from, to);
  return distance >= unit.minRange && distance <= unit.maxRange;
}

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
    this.mode = mode;
    this.isBattle = mode === 'battle' || this.isCrossing;
    const startingHP = this.isBattle ? this.maxHP : 1;
    this.playerHP = startingHP;
    this.enemyHP = startingHP;
    this.enemyAction = null;
    if (this.isCrossing) {
      this.x = 1;
      this.y = 6;
      this.enemy = {x: 7, y: 2};
    } else if (this.isBattle) {
      this.x = 1;
      this.y = 3;
      this.enemy = {x: 3, y: 1};
    }
  }

  get isCrossing() { return this.mode === 'crossing'; }
  get width() { return this.isCrossing ? crossingTerrain[0].length : TrainingMap.size; }
  get height() { return this.isCrossing ? crossingTerrain.length : TrainingMap.size; }
  get playerUnit() { return this.isCrossing ? scout : infantry; }
  get enemyUnit() { return this.isCrossing ? support : infantry; }

  get maxHP() {
    return 10;
  }

  get result() {
    if (this.isBattle && this.playerHP === 0) return 'defeat';
    if (this.isBattle && !this.enemy) return 'victory';
    return null;
  }

  isEnemyAt(x, y) {
    return this.enemy !== null && this.enemy.x === x && this.enemy.y === y;
  }

  terrainAt(x, y) {
    const layout = this.isCrossing ? crossingTerrain : this.isBattle ? battleTerrain : null;
    return terrainTypes[layout?.[y]?.[x] ?? 'p'];
  }

  get canAttack() {
    return this.playerHP > 0 && !this.attacked && this.enemy !== null
      && inRange(this.playerUnit, this, this.enemy);
  }

  get canMove() {
    return !this.result && !this.moved && !this.attacked;
  }

  canMoveTo(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && this.movementTargets().has(`${x},${y}`);
  }

  movementTargets() {
    if (!this.selected || !this.canMove) return new Map();
    const routes = this.#routes({x: this.x, y: this.y}, this.enemy, this.playerUnit.movement);
    routes.delete(`${this.x},${this.y}`);
    return routes;
  }

  #routes(from, blocked, budget, stepLimit = budget) {
    const start = {...from, cost: 0, first: from};
    const routes = new Map([[`${from.x},${from.y}`, start]]);
    const queue = [start];
    for (const route of queue) {
      for (const [dx, dy] of directions) {
        const x = route.x + dx;
        const y = route.y + dy;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        if (x === blocked?.x && y === blocked?.y) continue;
        const stepCost = this.terrainAt(x, y).cost ?? 1;
        const cost = route.cost + stepCost;
        const key = `${x},${y}`;
        if (stepCost === Infinity || stepCost > stepLimit || cost > budget || cost >= (routes.get(key)?.cost ?? Infinity)) continue;
        const next = {x, y, cost, first: route.cost ? route.first : {x, y}};
        routes.set(key, next);
        queue.push(next);
      }
    }
    return routes;
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
    const counterUnit = defender === 'player' ? this.playerUnit : this.enemyUnit;
    if (this.playerHP > 0 && this.enemy && inRange(counterUnit, this, this.enemy)) {
      strikes.push(this.#strike(defender));
    }
    return strikes;
  }

  #strike(attacker) {
    const playerAttacks = attacker === 'player';
    const attackingHP = playerAttacks ? this.playerHP : this.enemyHP;
    const defendingHP = playerAttacks ? this.enemyHP : this.playerHP;
    const defender = playerAttacks ? this.enemy : this;
    const terrain = this.terrainAt(defender.x, defender.y);
    const strength = attackingHP >= 8 ? 3 : attackingHP >= 4 ? 2 : 1;
    const protectedDamage = Math.max(1, strength - terrain.defense);
    const damage = Math.min(protectedDamage, defendingHP);
    if (playerAttacks) {
      this.enemyHP -= damage;
      if (this.enemyHP === 0) this.enemy = null;
    } else {
      this.playerHP -= damage;
    }
    return {attacker, damage, terrain: terrain.name, mitigation: strength - protectedDamage,
      playerHP: this.playerHP, enemyHP: this.enemyHP};
  }

  planEnemyTurn() {
    if (!this.isBattle || this.result) return null;
    const from = {...this.enemy};
    if (this.isCrossing) {
      const routes = this.#routes(from, this, Infinity, this.enemyUnit.movement);
      let target = null;
      for (const route of routes.values()) {
        if (inRange(this.enemyUnit, route, this) && route.cost < (target?.cost ?? Infinity)) target = route;
      }
      const to = target?.first ?? from;
      return {turn: this.turn, from, to, hit: inRange(this.enemyUnit, to, this)};
    }
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
