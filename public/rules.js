const terrainTypes = {
  p: Object.freeze({id: 'plains', name: '草原', defense: 0}),
  f: Object.freeze({id: 'forest', name: '森', defense: 1}),
  m: Object.freeze({id: 'mountain', name: '山', defense: 2}),
  r: Object.freeze({id: 'river', name: '川', defense: 0, cost: Infinity}),
  b: Object.freeze({id: 'bridge', name: '橋', defense: 0}),
  s: Object.freeze({id: 'marsh', name: '湿地', defense: 1, cost: 2}),
};
const mainTerrain = [
  'pfmffrfmfpfppf',
  'ppfppbffppppmp',
  'fppsrrpfmppffp',
  'mfpsrpssppmppp',
  'pppsrppfpppfsp',
  'fpspbppfmppfpp',
  'ppfsrsppfpppff',
  'fppprsfpppfppp',
  'fpmpbpspfmpspp',
  'ppffrppfppfppm',
];
const mainHeadquarters = Object.freeze({
  friendly: Object.freeze({x: 0, y: 6}),
  enemy: Object.freeze({x: 13, y: 7}),
});
const startingFunds = 4500;
const cityIncome = 1000;
const facilityRecovery = 2;
const infantry = Object.freeze({id: 'infantry', name: '歩兵', movement: 2, minRange: 1, maxRange: 1, cost: 1000});
const scout = Object.freeze({id: 'scout', name: '偵察車', movement: 4, minRange: 1, maxRange: 1, cost: 2500});
const support = Object.freeze({id: 'support', name: '支援車', movement: 1, minRange: 2, maxRange: 3, cost: 3000});
const tank = Object.freeze({id: 'tank', name: '戦車', movement: 3, minRange: 1, maxRange: 1, cost: 4000, attackBonus: 1});
const productionTypes = [infantry, scout, support, tank];
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function distanceBetween(from, to) {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function inRange(unit, from, to) {
  const distance = distanceBetween(from, to);
  return distance >= unit.minRange && distance <= unit.maxRange;
}

function deploy(type, x, y, hp, number = 1, readyTurn = 1) {
  const name = number === 1 ? type.name : `${type.name} ${number}`;
  return {type, name, x, y, hp, readyTurn, moved: false, attacked: false};
}

function integerBetween(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validEntries(entries, validate) {
  return Array.isArray(entries) && entries.every(entry => entry && validate(entry));
}

function routeSteps(destination) {
  const steps = [];
  for (let step = destination; step?.previous; step = step.previous) steps.push({x: step.x, y: step.y});
  return steps.reverse();
}

class BattleMap {
  turn = 1;
  selected = false;
  enemyTurn = null;
  enemyActions = [];
  capturedBy = null;
  enemyProductions = [];
  friendlyCapture = null;
  facilityHealing = [];

  constructor() {
    this.friendlyUnits = [deploy(scout, 1, 6, this.maxHP), deploy(infantry, 3, 1, this.maxHP), deploy(support, 2, 1, this.maxHP)];
    this.enemyUnits = [deploy(infantry, 7, 1, this.maxHP), deploy(scout, 7, 5, this.maxHP), deploy(support, 7, 2, this.maxHP)];
    this.funds = {friendly: startingFunds, enemy: startingFunds};
    this.factories = [
      {x: 1, y: 5, owner: 'friendly', production: null}, {x: 8, y: 4, owner: 'enemy', production: null},
    ];
    this.cities = [
      {x: 2, y: 3, owner: 'friendly'}, {x: 7, y: 4, owner: 'enemy'},
      {x: 4, y: 1, owner: 'neutral'}, {x: 5, y: 5, owner: 'neutral'},
    ];
    this.activeUnit = this.friendlyUnits[0];
  }

  crossingSnapshot() {
    const saveUnits = units => units.map(({type, x, y, hp, readyTurn, moved, attacked}) => ({
      type: type.id, x, y, hp, readyTurn, moved, attacked,
    }));
    const phase = this.enemyTurn;
    return {
      turn: this.turn, selected: this.selected, capturedBy: this.capturedBy,
      activeUnit: this.friendlyUnits.indexOf(this.activeUnit),
      friendlyUnits: saveUnits(this.friendlyUnits), enemyUnits: saveUnits(this.enemyUnits),
      funds: {...this.funds},
      factories: this.factories.map(({owner, production}) => ({owner, production})),
      cityOwners: this.cities.map(city => city.owner),
      // A planned action is recalculated on resume until it has been resolved.
      nextEnemy: phase ? phase.nextIndex - Number(Boolean(phase.action)) : null,
      enemyActions: this.enemyActions.map(({friendly, ...action}) => ({...action, friendly: friendly ?? null})),
      enemyProductions: this.enemyProductions.slice(),
      friendlyCapture: this.friendlyCapture, facilityHealing: this.facilityHealing.slice(),
    };
  }

  static fromCrossingSnapshot(saved) {
    const game = new BattleMap();
    if (!saved || !integerBetween(saved.turn, 1, Number.MAX_SAFE_INTEGER - 1)) return null;
    const {turn, selected, capturedBy, activeUnit, nextEnemy, funds, factories, cityOwners,
      enemyActions, enemyProductions, friendlyCapture, facilityHealing} = saved;
    const validPosition = position => position && integerBetween(position.x, 0, game.width - 1)
      && integerBetween(position.y, 0, game.height - 1);
    const isSide = side => side === 'friendly' || side === 'enemy';
    const restoreUnits = units => {
      if (!validEntries(units, unit => validPosition(unit) && integerBetween(unit.hp, 0, game.maxHP)
        && integerBetween(unit.readyTurn, 1, turn + 1) && typeof unit.moved === 'boolean'
        && typeof unit.attacked === 'boolean')) return null;
      const counts = new Map();
      const roster = [];
      for (const unit of units) {
        const type = productionTypes.find(type => type.id === unit.type);
        if (!type || game.terrainAt(unit.x, unit.y).cost === Infinity) return null;
        const number = (counts.get(type) ?? 0) + 1;
        counts.set(type, number);
        roster.push({...deploy(type, unit.x, unit.y, unit.hp, number, unit.readyTurn), moved: unit.moved, attacked: unit.attacked});
      }
      return roster;
    };
    const friendlyUnits = restoreUnits(saved.friendlyUnits);
    const enemyUnits = restoreUnits(saved.enemyUnits);
    if (!friendlyUnits || !enemyUnits?.length || !integerBetween(activeUnit, 0, friendlyUnits.length - 1)
      || (nextEnemy !== null && !integerBetween(nextEnemy, 0, enemyUnits.length))
      || (capturedBy !== null && !isSide(capturedBy)) || typeof selected !== 'boolean'
      || !funds || !integerBetween(funds.friendly, 0, Number.MAX_SAFE_INTEGER)
      || !integerBetween(funds.enemy, 0, Number.MAX_SAFE_INTEGER)) return null;
    const liveSpots = [...friendlyUnits, ...enemyUnits].filter(unit => unit.hp).map(unit => `${unit.x},${unit.y}`);
    if (new Set(liveSpots).size !== liveSpots.length) return null;

    const names = new Set([...friendlyUnits, ...enemyUnits].map(unit => unit.name));
    const isFacility = facility => facility === 'factory' || facility === 'city';
    const validProduction = entry => entry && names.has(entry.unit) && integerBetween(entry.turn, 1, turn)
      && productionTypes.some(type => type.cost === entry.cost);
    if (!validEntries(factories, site => isSide(site.owner) && (site.production === null || validProduction(site.production)))
      || factories.length !== game.factories.length
      || !validEntries(cityOwners, owner => isSide(owner) || owner === 'neutral') || cityOwners.length !== game.cities.length
      || !validEntries(enemyActions, entry => names.has(entry.enemy) && (!entry.friendly || names.has(entry.friendly))
        && validPosition(entry.from) && validPosition(entry.to)
        && [entry.captured, entry.cityCaptured, entry.factoryCaptured].every(flag => typeof flag === 'boolean'))
      || !validEntries(enemyProductions, entry => validProduction(entry) && game.factoryAt(entry.x, entry.y))
      || (friendlyCapture !== null && !(validPosition(friendlyCapture) && names.has(friendlyCapture.unit)
        && isFacility(friendlyCapture.facility) && integerBetween(friendlyCapture.turn, 1, turn)))
      || !validEntries(facilityHealing, entry => isSide(entry.side) && names.has(entry.unit)
        && isFacility(entry.facility) && integerBetween(entry.amount, 1, facilityRecovery))) return null;

    Object.assign(game, {turn, selected, capturedBy, friendlyUnits, enemyUnits, activeUnit: friendlyUnits[activeUnit],
      funds: {friendly: funds.friendly, enemy: funds.enemy}, enemyActions, enemyProductions, friendlyCapture, facilityHealing});
    game.factories.forEach((site, index) => {
      const {owner, production} = factories[index];
      Object.assign(site, {owner, production});
    });
    game.cities.forEach((city, index) => { city.owner = cityOwners[index]; });
    if (nextEnemy !== null) game.enemyTurn = {nextIndex: nextEnemy, action: null};
    return game;
  }

  get headquarters() { return mainHeadquarters; }
  get width() { return mainTerrain[0].length; }
  get height() { return mainTerrain.length; }
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

  get maxHP() {
    return 10;
  }

  get result() {
    if (this.capturedBy === 'friendly') return 'victory';
    if (this.capturedBy === 'enemy') return 'defeat';
    if (this.friendlyUnits.every(unit => unit.hp === 0)) return 'defeat';
    if (this.enemyUnits.every(unit => unit.hp === 0)) return 'victory';
    return null;
  }

  headquartersAt(x, y) {
    for (const [side, position] of Object.entries(this.headquarters)) {
      if (x === position.x && y === position.y) return side;
    }
    return null;
  }

  factoryAt(x, y) {
    return this.factories.find(factory => factory.x === x && factory.y === y);
  }

  cityAt(x, y) {
    return this.cities.find(city => city.x === x && city.y === y);
  }

  incomeFor(side) {
    if (!Object.hasOwn(this.funds, side)) return 0;
    return this.cities.filter(city => city.owner === side).length * cityIncome;
  }

  productionCost(typeId) {
    return productionTypes.find(type => type.id === typeId)?.cost;
  }

  productionStatus(factory) {
    if (this.result || !this.factories.includes(factory) || factory.owner !== 'friendly') return 'unavailable';
    if (this.enemyTurn) return 'waiting';
    const status = this.#factoryStatus(factory);
    if (status === 'ready' && !productionTypes.some(type => type.cost <= this.funds.friendly)) return 'insufficient';
    return status;
  }

  #factoryStatus(factory) {
    if (factory.production?.turn === this.turn) return 'used';
    const {x, y} = factory;
    return this.friendlyAt(x, y) || this.enemyAt(x, y) ? 'occupied' : 'ready';
  }

  produce(typeId, factory) {
    const type = productionTypes.find(type => type.id === typeId);
    if (!type || this.productionStatus(factory) !== 'ready') return null;
    return this.#deployReinforcement(factory, type);
  }

  #deployReinforcement(factory, type) {
    const {x, y, owner: side} = factory;
    if (type.cost > this.funds[side]) return null;
    const units = side === 'friendly' ? this.friendlyUnits : this.enemyUnits;
    const number = units.filter(unit => unit.type.id === type.id).length + 1;
    const unit = deploy(type, x, y, this.maxHP, number, this.turn + 1);
    units.push(unit);
    this.funds[side] -= type.cost;
    factory.production = {unit: unit.name, turn: this.turn, cost: type.cost};
    return unit;
  }

  #captureHeadquarters(unit, side) {
    const owner = this.headquartersAt(unit.x, unit.y);
    if (!owner || owner === side || unit.type.id !== infantry.id) return false;
    this.capturedBy = side;
    return true;
  }

  #captureFacility(unit, side) {
    if (unit.type.id !== infantry.id) return null;
    const factory = this.factoryAt(unit.x, unit.y);
    const site = factory ?? this.cityAt(unit.x, unit.y);
    if (!site || site.owner === side) return null;
    site.owner = side;
    return factory ? 'factory' : 'city';
  }

  enemyAt(x, y) {
    return this.enemyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  friendlyAt(x, y) {
    return this.friendlyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  terrainAt(x, y) {
    return terrainTypes[mainTerrain[y]?.[x] ?? 'p'];
  }

  get canAttack() {
    return this.canUnitAttack(this.activeUnit);
  }

  canUnitAttack(unit, enemy) {
    return !this.enemyTurn && !this.result && unit.hp > 0 && unit.readyTurn <= this.turn && !unit.attacked && (enemy
      ? enemy.hp > 0 && inRange(unit.type, unit, enemy)
      : this.enemyUnits.some(target => target.hp > 0 && inRange(unit.type, unit, target)));
  }

  previewAttack(enemy) {
    if (!enemy || !this.canUnitAttack(this.activeUnit, enemy)) return [];
    return this.#exchange('player', {...this.activeUnit}, {...enemy});
  }

  get canMove() {
    return !this.enemyTurn && !this.result && this.playerHP > 0 && this.activeUnit.readyTurn <= this.turn && !this.moved && !this.attacked;
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
      const facility = this.#captureFacility(this.activeUnit, 'friendly');
      if (facility) {
        this.friendlyCapture = {facility, unit: this.activeUnit.name, x, y, turn: this.turn};
      }
    }
  }

  endTurn() {
    if (!this.beginEnemyTurn()) return;
    const strikes = [];
    for (let action; (action = this.prepareEnemyAction());) {
      strikes.push(...this.resolveEnemyAction(action));
    }
    this.finishEnemyTurn();
    return strikes.length ? strikes : undefined;
  }

  #startNextTurn() {
    for (const unit of this.friendlyUnits) {
      unit.moved = false;
      unit.attacked = false;
    }
    if (this.result) return;
    this.turn += 1;
    this.facilityHealing = [];
    for (const [side, units] of [['friendly', this.friendlyUnits], ['enemy', this.enemyUnits]]) {
      this.funds[side] += this.incomeFor(side);
      for (const unit of units) {
        if (!unit.hp || unit.hp >= this.maxHP) continue;
        const factory = this.factoryAt(unit.x, unit.y);
        const facility = factory ?? this.cityAt(unit.x, unit.y);
        if (facility?.owner !== side) continue;
        const amount = Math.min(facilityRecovery, this.maxHP - unit.hp);
        unit.hp += amount;
        this.facilityHealing.push({side, unit: unit.name, amount, facility: factory ? 'factory' : 'city'});
      }
    }
  }

  beginEnemyTurn() {
    if (this.enemyTurn || this.result) return false;
    this.selected = false;
    this.enemyActions = [];
    this.enemyProductions = [];
    this.enemyTurn = {nextIndex: 0, action: null};
    return true;
  }

  prepareEnemyAction() {
    const phase = this.enemyTurn;
    if (!phase || this.result) return null;
    if (phase.action) return phase.action;
    const index = this.#nextEnemyIndex(phase.nextIndex);
    if (index < 0) return null;
    phase.action = this.planEnemyAction(this.enemyUnits[index]);
    phase.nextIndex = index + 1;
    return phase.action;
  }

  #nextEnemyIndex(after) {
    return this.enemyUnits.findIndex((unit, index) => index >= after && unit.hp > 0 && unit.readyTurn <= this.turn);
  }

  resolveEnemyAction(action) {
    const phase = this.enemyTurn;
    if (!action || phase?.action !== action) return [];
    phase.action = null;
    const {enemy, friendly, from, to} = action;
    Object.assign(enemy, to);
    const captured = this.#captureHeadquarters(enemy, 'enemy');
    const facility = this.#captureFacility(enemy, 'enemy');
    const strikes = !captured && friendly ? this.#exchange('enemy', friendly, enemy) : [];
    this.#restoreActiveUnit();
    this.enemyActions.push({enemy: enemy.name, friendly: friendly?.name, from, to, captured,
      cityCaptured: facility === 'city', factoryCaptured: facility === 'factory'});
    return strikes;
  }

  finishEnemyTurn() {
    if (!this.enemyTurn || this.prepareEnemyAction()) return;
    for (let order; (order = this.planEnemyProduction());) this.produceEnemyUnit(order);
    this.enemyTurn = null;
    this.#startNextTurn();
  }

  planEnemyProduction() {
    const phase = this.enemyTurn;
    if (!phase || this.result || phase.action || this.#nextEnemyIndex(phase.nextIndex) >= 0) return null;
    const factory = this.factories.find(site => site.owner === 'enemy' && this.#factoryStatus(site) === 'ready');
    if (!factory) return null;
    const counts = new Map(productionTypes.map(({id}) => [id, 0]));
    for (const unit of this.enemyUnits) {
      if (unit.hp > 0) counts.set(unit.type.id, counts.get(unit.type.id) + 1);
    }
    const type = productionTypes.reduce((fewest, next) => counts.get(next.id) < counts.get(fewest.id) ? next : fewest);
    return this.funds.enemy >= type.cost ? {factory, type} : null;
  }

  produceEnemyUnit({factory, type}) {
    const next = this.planEnemyProduction();
    if (!next || next.factory !== factory || next.type !== type) return null;
    const unit = this.#deployReinforcement(factory, type);
    this.enemyProductions.push({x: factory.x, y: factory.y, ...factory.production});
    return unit;
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
    const attackingUnit = playerAttacks ? friendly : enemy;
    const defender = playerAttacks ? enemy : friendly;
    const terrain = this.terrainAt(defender.x, defender.y);
    const baseStrength = attackingUnit.hp >= 8 ? 3 : attackingUnit.hp >= 4 ? 2 : 1;
    const strength = baseStrength + (attackingUnit.type.attackBonus ?? 0);
    const protectedDamage = Math.max(1, strength - terrain.defense);
    const damage = Math.min(protectedDamage, defender.hp);
    defender.hp -= damage;
    return {attacker, damage, terrain: terrain.name, mitigation: strength - protectedDamage,
      playerHP: friendly.hp, enemyHP: enemy.hp};
  }

  #captureRoute(sites, routes, movement) {
    let destination = null;
    for (const site of sites) {
      if (site.owner === 'enemy') continue;
      const path = routes.get(`${site.x},${site.y}`);
      if (path && path.cost > 0 && path.cost <= movement && path.cost < (destination?.cost ?? Infinity)) destination = path;
    }
    return destination;
  }

  planEnemyAction(enemy) {
    const from = {x: enemy.x, y: enemy.y};
    const {type} = enemy;
    const living = this.friendlyUnits.filter(unit => unit.hp > 0);
    const routes = this.#routes(enemy, this.#occupiedExcept(enemy), Infinity, type.movement);
    const targetAt = position => living.find(unit => inRange(type, position, unit));
    const home = this.headquarters.friendly;
    if (type.id === infantry.id) {
      const route = routes.get(`${home.x},${home.y}`);
      if (route && route.cost <= type.movement) return {enemy, from, to: {...home}, path: routeSteps(route), friendly: null};
      const destination = this.#captureRoute(this.factories, routes, type.movement)
        ?? this.#captureRoute(this.cities, routes, type.movement);
      if (destination) {
        const to = {x: destination.x, y: destination.y};
        return {enemy, from, to, path: routeSteps(destination), friendly: targetAt(to) ?? null};
      }
    }
    let goal = null;
    for (const route of routes.values()) {
      if (route.cost < (goal?.cost ?? Infinity) && targetAt(route)) goal = route;
    }
    if (!goal && this.factoryAt(from.x, from.y)?.owner === 'enemy') {
      // Clear the factory for another unit when the route to combat is blocked.
      let bestDistance = Infinity;
      for (const route of routes.values()) {
        if (!route.cost || route.cost > type.movement) continue;
        const distance = Math.min(...living.map(unit => distanceBetween(route, unit)));
        if (distance < bestDistance) {
          bestDistance = distance;
          goal = route;
        }
      }
    }
    while (goal && goal.cost > type.movement) goal = goal.previous;
    const to = goal ? {x: goal.x, y: goal.y} : from;
    return {enemy, from, to, path: routeSteps(goal), friendly: targetAt(to) ?? null};
  }
}

if (typeof module !== 'undefined') module.exports = BattleMap;
