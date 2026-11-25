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
const crossingHeadquarters = Object.freeze({
  friendly: Object.freeze({x: 0, y: 6}),
  enemy: Object.freeze({x: 9, y: 5}),
});
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

function deploy(type, x, y, hp) {
  return {type, x, y, hp, moved: false, attacked: false};
}

class TrainingMap {
  static size = 5;
  static movement = 2;
  turn = 1;
  selected = false;
  enemyTurn = null;
  enemyActions = [];
  capturedBy = null;

  constructor(mode = 'training') {
    this.mode = mode;
    this.isBattle = mode === 'battle' || this.isCrossing;
    const startingHP = this.isBattle ? this.maxHP : 1;
    this.enemyAction = null;
    if (this.isCrossing) {
      this.friendlyUnits = [deploy(scout, 1, 6, startingHP), deploy(infantry, 3, 1, startingHP), deploy(support, 2, 1, startingHP)];
      this.enemyUnits = [deploy(infantry, 7, 1, startingHP), deploy(scout, 7, 5, startingHP), deploy(support, 7, 2, startingHP)];
    } else if (this.isBattle) {
      this.friendlyUnits = [deploy(infantry, 1, 3, startingHP)];
      this.enemyUnits = [deploy(infantry, 3, 1, startingHP)];
    } else {
      this.friendlyUnits = [deploy(infantry, 2, 2, startingHP)];
      this.enemyUnits = [deploy(infantry, 4, 1, startingHP)];
    }
    this.activeUnit = this.friendlyUnits[0];
  }

  get isCrossing() { return this.mode === 'crossing'; }
  get headquarters() { return this.isCrossing ? crossingHeadquarters : null; }
  get width() { return this.isCrossing ? crossingTerrain[0].length : TrainingMap.size; }
  get height() { return this.isCrossing ? crossingTerrain.length : TrainingMap.size; }
  get x() { return this.activeUnit.x; }
  set x(x) { this.activeUnit.x = x; }
  get y() { return this.activeUnit.y; }
  set y(y) { this.activeUnit.y = y; }
  get moved() { return this.activeUnit.moved; }
  get attacked() { return this.activeUnit.attacked; }
  get playerHP() { return this.activeUnit.hp; }
  set playerHP(hp) { this.activeUnit.hp = hp; }
  get playerUnit() { return this.activeUnit.type; }
  get enemy() {
    const unit = this.enemyUnits.find(unit => unit.hp > 0);
    return unit ? {x: unit.x, y: unit.y} : null;
  }
  set enemy({x, y}) { Object.assign(this.enemyUnits[0], {x, y}); }
  get enemyHP() { return this.enemyUnits[0].hp; }
  set enemyHP(hp) { this.enemyUnits[0].hp = hp; }

  get maxHP() {
    return 10;
  }

  get result() {
    if (this.capturedBy === 'friendly') return 'victory';
    if (this.capturedBy === 'enemy') return 'defeat';
    if (this.isBattle && this.friendlyUnits.every(unit => unit.hp === 0)) return 'defeat';
    if (this.isBattle && this.enemyUnits.every(unit => unit.hp === 0)) return 'victory';
    return null;
  }

  headquartersAt(x, y) {
    if (!this.headquarters) return null;
    for (const [side, position] of Object.entries(this.headquarters)) {
      if (x === position.x && y === position.y) return side;
    }
    return null;
  }

  #captureHeadquarters(unit, side) {
    const owner = this.headquartersAt(unit.x, unit.y);
    if (!owner || owner === side || unit.type.id !== infantry.id) return false;
    this.capturedBy = side;
    return true;
  }

  isEnemyAt(x, y) {
    return Boolean(this.enemyAt(x, y));
  }

  enemyAt(x, y) {
    return this.enemyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  friendlyAt(x, y) {
    return this.friendlyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  terrainAt(x, y) {
    const layout = this.isCrossing ? crossingTerrain : this.isBattle ? battleTerrain : null;
    return terrainTypes[layout?.[y]?.[x] ?? 'p'];
  }

  get canAttack() {
    return this.canUnitAttack(this.activeUnit);
  }

  canUnitAttack(unit, enemy) {
    return !this.enemyTurn && !this.result && unit.hp > 0 && !unit.attacked && (enemy
      ? enemy.hp > 0 && inRange(unit.type, unit, enemy)
      : this.enemyUnits.some(target => target.hp > 0 && inRange(unit.type, unit, target)));
  }

  get canMove() {
    return !this.enemyTurn && !this.result && this.playerHP > 0 && !this.moved && !this.attacked;
  }

  canMoveTo(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && this.movementTargets().has(`${x},${y}`);
  }

  movementTargets() {
    if (!this.selected || !this.canMove) return new Map();
    const occupied = this.#occupiedExcept(this.activeUnit);
    const routes = this.#routes(this.activeUnit, occupied, this.playerUnit.movement);
    routes.delete(`${this.x},${this.y}`);
    return routes;
  }

  #occupiedExcept(actor) {
    return [...this.friendlyUnits, ...this.enemyUnits].filter(unit => unit.hp > 0 && unit !== actor);
  }

  #routes(from, blocked, budget, stepLimit = budget) {
    const start = {x: from.x, y: from.y, cost: 0, previous: null};
    const occupied = new Set(blocked.map(({x, y}) => `${x},${y}`));
    const routes = new Map([[`${from.x},${from.y}`, start]]);
    const queue = [start];
    for (const route of queue) {
      for (const [dx, dy] of directions) {
        const x = route.x + dx;
        const y = route.y + dy;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        const key = `${x},${y}`;
        if (occupied.has(key)) continue;
        const stepCost = this.terrainAt(x, y).cost ?? 1;
        const cost = route.cost + stepCost;
        if (stepCost === Infinity || stepCost > stepLimit || cost > budget || cost >= (routes.get(key)?.cost ?? Infinity)) continue;
        const next = {x, y, cost, previous: route};
        routes.set(key, next);
        queue.push(next);
      }
    }
    return routes;
  }

  choose(x, y) {
    if (this.result || this.enemyTurn) return;
    const enemy = this.enemyAt(x, y);
    if (enemy && this.canUnitAttack(this.activeUnit, enemy)) {
      this.activeUnit.attacked = true;
      this.selected = false;
      const strikes = this.#exchange('player', this.activeUnit, enemy);
      this.#restoreActiveUnit();
      return strikes;
    }
    const friendly = this.friendlyAt(x, y);
    if (friendly) {
      const same = friendly === this.activeUnit;
      this.activeUnit = friendly;
      this.selected = this.canMove && !(same && this.selected);
    } else if (this.canMoveTo(x, y)) {
      this.x = x;
      this.y = y;
      this.selected = false;
      this.activeUnit.moved = true;
      this.#captureHeadquarters(this.activeUnit, 'friendly');
    }
  }

  endTurn() {
    if (this.result || this.enemyTurn) return;
    if (this.isCrossing) {
      this.beginEnemyTurn();
      const strikes = [];
      for (let action; (action = this.prepareEnemyAction());) {
        strikes.push(...this.resolveEnemyAction(action));
      }
      this.finishEnemyTurn();
      return strikes.length ? strikes : undefined;
    }
    this.selected = false;
    let strikes;
    if (this.isBattle) {
      this.enemyAction = this.planEnemyTurn();
      this.enemy = this.enemyAction.to;
      if (this.enemyAction.hit) strikes = this.#exchange('enemy', this.activeUnit, this.enemyUnits[0]);
    }
    this.#startNextTurn();
    return strikes;
  }

  #startNextTurn() {
    for (const unit of this.friendlyUnits) {
      unit.moved = false;
      unit.attacked = false;
    }
    if (!this.result) this.turn += 1;
  }

  beginEnemyTurn() {
    if (!this.isCrossing || this.enemyTurn || this.result) return false;
    this.selected = false;
    this.enemyActions = [];
    this.enemyTurn = {nextIndex: 0, action: null};
    return true;
  }

  prepareEnemyAction() {
    const phase = this.enemyTurn;
    if (!phase || this.result) return null;
    if (phase.action) return phase.action;
    const index = this.enemyUnits.findIndex((unit, index) => index >= phase.nextIndex && unit.hp > 0);
    if (index < 0) return null;
    phase.action = this.planEnemyAction(this.enemyUnits[index]);
    phase.nextIndex = index + 1;
    return phase.action;
  }

  resolveEnemyAction(action) {
    const phase = this.enemyTurn;
    if (!action || phase?.action !== action) return [];
    phase.action = null;
    const {enemy, friendly, from, to} = action;
    Object.assign(enemy, to);
    const captured = this.#captureHeadquarters(enemy, 'enemy');
    const strikes = !captured && friendly ? this.#exchange('enemy', friendly, enemy) : [];
    this.#restoreActiveUnit();
    this.enemyActions.push({enemy: enemy.type.name, friendly: friendly?.type.name, from, to, captured});
    return strikes;
  }

  finishEnemyTurn() {
    if (!this.enemyTurn || this.prepareEnemyAction()) return;
    this.enemyTurn = null;
    this.#startNextTurn();
  }

  #restoreActiveUnit() {
    if (!this.activeUnit.hp) {
      this.activeUnit = this.friendlyUnits.find(unit => unit.hp > 0) ?? this.activeUnit;
    }
  }

  #exchange(attacker, friendly, enemy) {
    const strikes = [this.#strike(attacker, friendly, enemy)];
    const defender = attacker === 'player' ? 'enemy' : 'player';
    const counterUnit = defender === 'player' ? friendly.type : enemy.type;
    if (friendly.hp > 0 && enemy.hp > 0 && inRange(counterUnit, friendly, enemy)) {
      strikes.push(this.#strike(defender, friendly, enemy));
    }
    return strikes;
  }

  #strike(attacker, friendly, enemy) {
    const playerAttacks = attacker === 'player';
    const attackingHP = playerAttacks ? friendly.hp : enemy.hp;
    const defender = playerAttacks ? enemy : friendly;
    const terrain = this.terrainAt(defender.x, defender.y);
    const strength = attackingHP >= 8 ? 3 : attackingHP >= 4 ? 2 : 1;
    const protectedDamage = Math.max(1, strength - terrain.defense);
    const damage = Math.min(protectedDamage, defender.hp);
    defender.hp -= damage;
    return {attacker, damage, terrain: terrain.name, mitigation: strength - protectedDamage,
      playerHP: friendly.hp, enemyHP: enemy.hp};
  }

  planEnemyAction(enemy) {
    const from = {x: enemy.x, y: enemy.y};
    const {type} = enemy;
    const living = this.friendlyUnits.filter(unit => unit.hp > 0);
    const routes = this.#routes(enemy, this.#occupiedExcept(enemy), Infinity, type.movement);
    const home = this.headquarters?.friendly;
    if (home && type.id === infantry.id) {
      const route = routes.get(`${home.x},${home.y}`);
      if (route && route.cost <= type.movement) return {enemy, from, to: {...home}, friendly: null};
    }
    const targetAt = position => living.find(unit => inRange(type, position, unit));
    let goal = null;
    for (const route of routes.values()) {
      if (route.cost < (goal?.cost ?? Infinity) && targetAt(route)) goal = route;
    }
    while (goal && goal.cost > type.movement) goal = goal.previous;
    const to = goal ? {x: goal.x, y: goal.y} : from;
    return {enemy, from, to, friendly: targetAt(to) ?? null};
  }

  planEnemyTurn() {
    if (!this.isBattle || this.isCrossing || this.result) return null;
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
