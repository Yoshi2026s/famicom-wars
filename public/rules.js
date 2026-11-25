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

function deploy(type, x, y, hp) {
  return {type, x, y, hp, moved: false, attacked: false};
}

class TrainingMap {
  static size = 5;
  static movement = 2;
  enemy = {x: 4, y: 1};
  turn = 1;
  selected = false;

  constructor(mode = 'training') {
    this.mode = mode;
    this.isBattle = mode === 'battle' || this.isCrossing;
    const startingHP = this.isBattle ? this.maxHP : 1;
    this.enemyHP = startingHP;
    this.enemyAction = null;
    if (this.isCrossing) {
      this.friendlyUnits = [deploy(scout, 1, 6, startingHP), deploy(infantry, 3, 1, startingHP), deploy(support, 2, 1, startingHP)];
      this.enemy = {x: 7, y: 2};
    } else if (this.isBattle) {
      this.friendlyUnits = [deploy(infantry, 1, 3, startingHP)];
      this.enemy = {x: 3, y: 1};
    } else {
      this.friendlyUnits = [deploy(infantry, 2, 2, startingHP)];
    }
    this.activeUnit = this.friendlyUnits[0];
  }

  get isCrossing() { return this.mode === 'crossing'; }
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
  get enemyUnit() { return this.isCrossing ? support : infantry; }

  get maxHP() {
    return 10;
  }

  get result() {
    if (this.isBattle && this.friendlyUnits.every(unit => unit.hp === 0)) return 'defeat';
    if (this.isBattle && !this.enemy) return 'victory';
    return null;
  }

  isEnemyAt(x, y) {
    return this.enemy !== null && this.enemy.x === x && this.enemy.y === y;
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

  canUnitAttack(unit) {
    return unit.hp > 0 && !unit.attacked && this.enemy !== null && inRange(unit.type, unit, this.enemy);
  }

  get canMove() {
    return !this.result && this.playerHP > 0 && !this.moved && !this.attacked;
  }

  canMoveTo(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && this.movementTargets().has(`${x},${y}`);
  }

  movementTargets() {
    if (!this.selected || !this.canMove) return new Map();
    const occupied = this.friendlyUnits.filter(unit => unit.hp > 0 && unit !== this.activeUnit);
    if (this.enemy) occupied.push(this.enemy);
    const routes = this.#routes(this.activeUnit, occupied, this.playerUnit.movement);
    routes.delete(`${this.x},${this.y}`);
    return routes;
  }

  #routes(from, blocked, budget, stepLimit = budget) {
    const start = {x: from.x, y: from.y, cost: 0, first: {x: from.x, y: from.y}};
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
        const next = {x, y, cost, first: route.cost ? route.first : {x, y}};
        routes.set(key, next);
        queue.push(next);
      }
    }
    return routes;
  }

  choose(x, y) {
    if (this.result) return;
    if (this.isEnemyAt(x, y) && this.canAttack) {
      this.activeUnit.attacked = true;
      this.selected = false;
      const strikes = this.#exchange('player', this.activeUnit);
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
    }
  }

  endTurn() {
    if (this.result) return;
    this.selected = false;
    for (const unit of this.friendlyUnits) {
      unit.moved = false;
      unit.attacked = false;
    }
    let strikes;
    if (this.isBattle) {
      this.enemyAction = this.planEnemyTurn();
      this.enemy = {...this.enemyAction.to};
      if (this.enemyAction.hit) {
        const defender = this.friendlyUnits.find(unit => unit.type.id === this.enemyAction.targetId) ?? this.activeUnit;
        strikes = this.#exchange('enemy', defender);
        this.#restoreActiveUnit();
      }
    }
    if (!this.result) this.turn += 1;
    return strikes;
  }

  #restoreActiveUnit() {
    if (!this.activeUnit.hp) {
      this.activeUnit = this.friendlyUnits.find(unit => unit.hp > 0) ?? this.activeUnit;
    }
  }

  #exchange(attacker, friendly) {
    const strikes = [this.#strike(attacker, friendly)];
    const defender = attacker === 'player' ? 'enemy' : 'player';
    const counterUnit = defender === 'player' ? friendly.type : this.enemyUnit;
    if (friendly.hp > 0 && this.enemy && inRange(counterUnit, friendly, this.enemy)) {
      strikes.push(this.#strike(defender, friendly));
    }
    return strikes;
  }

  #strike(attacker, friendly) {
    const playerAttacks = attacker === 'player';
    const attackingHP = playerAttacks ? friendly.hp : this.enemyHP;
    const defendingHP = playerAttacks ? this.enemyHP : friendly.hp;
    const defender = playerAttacks ? this.enemy : friendly;
    const terrain = this.terrainAt(defender.x, defender.y);
    const strength = attackingHP >= 8 ? 3 : attackingHP >= 4 ? 2 : 1;
    const protectedDamage = Math.max(1, strength - terrain.defense);
    const damage = Math.min(protectedDamage, defendingHP);
    if (playerAttacks) {
      this.enemyHP -= damage;
      if (this.enemyHP === 0) this.enemy = null;
    } else {
      friendly.hp -= damage;
    }
    return {attacker, damage, terrain: terrain.name, mitigation: strength - protectedDamage,
      playerHP: friendly.hp, enemyHP: this.enemyHP};
  }

  planEnemyTurn() {
    if (!this.isBattle || this.result) return null;
    const from = {...this.enemy};
    if (this.isCrossing) {
      const living = this.friendlyUnits.filter(unit => unit.hp > 0);
      const routes = this.#routes(from, living, Infinity, this.enemyUnit.movement);
      const targetAt = position => living.find(unit => inRange(this.enemyUnit, position, unit));
      let firingPosition = null;
      for (const route of routes.values()) {
        if (route.cost < (firingPosition?.cost ?? Infinity) && targetAt(route)) firingPosition = route;
      }
      const to = firingPosition?.first ?? from;
      const target = targetAt(to);
      return {turn: this.turn, from, to, hit: Boolean(target), targetId: target?.type.id ?? null};
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
