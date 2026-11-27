const terrainTypes = {
  p: Object.freeze({id: 'plains', name: '草原', defense: 0}),
  f: Object.freeze({id: 'forest', name: '森', defense: 1}),
  m: Object.freeze({id: 'mountain', name: '山', defense: 2}),
  r: Object.freeze({id: 'river', name: '川', defense: 0, cost: Infinity}),
  b: Object.freeze({id: 'bridge', name: '橋', defense: 0}),
  s: Object.freeze({id: 'marsh', name: '湿地', defense: 1, cost: 2}),
  o: Object.freeze({id: 'sea', name: '外海', defense: 0, water: true}),
  h: Object.freeze({id: 'shoal', name: '浅瀬', defense: 0, water: true, cost: 2}),
  d: Object.freeze({id: 'road', name: '道路', defense: 0}),
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
// Capturing takes 10 points; each attempt removes as many points as the infantry has HP.
const capturePoints = 10;
const infantry = Object.freeze({id: 'infantry', name: '歩兵', movement: 2, minRange: 1, maxRange: 1, cost: 1000});
const scout = Object.freeze({id: 'scout', name: '偵察車', movement: 4, minRange: 1, maxRange: 1, cost: 2500});
const support = Object.freeze({id: 'support', name: '支援車', movement: 1, minRange: 2, maxRange: 3, cost: 3000});
const tank = Object.freeze({id: 'tank', name: '戦車', movement: 3, minRange: 1, maxRange: 1, cost: 4000, attackBonus: 1});
const productionTypes = [infantry, scout, support, tank];
const fieldScenario = typeof module === 'undefined' ? coastalScenario : require('./coastal-scenario.js');
const land = 'land';
const air = 'air';
const sea = 'sea';
const coastalTypes = new Map([
  {...infantry, movement: 3, firepower: 3, targets: [land, sea], trait: '歩兵だけが施設を占領できる'},
  {...scout, movement: 6, firepower: 3, targets: [land], trait: '移動力が高い。山は通れない'},
  {...support, movement: 4, firepower: 4, targets: [land, sea], stationary: true, trait: '射程2〜3。移動したターンは攻撃できない'},
  {...tank, movement: 4, firepower: 5, targets: [land, sea], trait: '装甲車両に強い。山は通れない', bonus: {scout: 1, support: 1, antiair: 1}},
  {id: 'artillery', name: '自走砲', movement: 3, minRange: 2, maxRange: 4, cost: 5000, firepower: 5, targets: [land, sea], stationary: true, trait: '射程2〜4。移動したターンは攻撃できない'},
  {id: 'rocket', name: 'ロケット砲', movement: 3, minRange: 3, maxRange: 6, cost: 7500, firepower: 5, targets: [land, sea], stationary: true, trait: '射程3〜6。接近されると攻撃できない'},
  {id: 'antiair', name: '対空車', movement: 4, minRange: 1, maxRange: 2, cost: 4500, firepower: 3, targets: [land, air], bonus: {air: 3}, trait: '航空部隊への攻撃力が高い'},
  {id: 'helicopter', name: '攻撃ヘリ', domain: air, movement: 5, minRange: 1, maxRange: 1, cost: 5500, firepower: 4, targets: [land, sea, air], bonus: {air: -2, tank: 1}, trait: '地形を越える。戦車に強く、空戦は苦手'},
  {id: 'fighter', name: '戦闘機', domain: air, movement: 7, minRange: 1, maxRange: 2, cost: 7500, firepower: 6, targets: [air], trait: '航空部隊専用。広い範囲を迎撃できる'},
  {id: 'bomber', name: '爆撃機', domain: air, movement: 6, minRange: 1, maxRange: 1, cost: 9500, firepower: 7, targets: [land, sea], trait: '地上・艦船に大ダメージ。空戦はできない'},
  {id: 'patrol', name: '哨戒艇', domain: sea, movement: 6, minRange: 1, maxRange: 1, cost: 4000, firepower: 3, targets: [land, sea], bonus: {sea: 1}, trait: '低価格で足の速い小型艦'},
  {id: 'destroyer', name: '駆逐艦', domain: sea, movement: 5, minRange: 1, maxRange: 2, cost: 6500, firepower: 4, targets: [land, sea, air], bonus: {air: 1, patrol: 1}, trait: '射程1〜2。航空部隊も攻撃可能'},
  {id: 'battleship', name: '戦艦', domain: sea, movement: 4, minRange: 2, maxRange: 5, cost: 10500, firepower: 7, targets: [land, sea], stationary: true, trait: '射程2〜5の艦砲。移動したターンは攻撃できない'},
].map(type => [type.id, Object.freeze({domain: land, ...type})]));
const facilityNames = {headquarters: '本拠地', city: '都市', factory: '工場', airfield: '飛行場', port: '港'};
const fleetLimit = 14;
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

  constructor(scenario = 'legacy') {
    this.scenario = scenario === fieldScenario.id ? fieldScenario : null;
    if (this.scenario) {
      for (const side of ['friendly', 'enemy']) {
        this[side + 'Units'] = this.scenario.units[side].map(([id, x, y]) => deploy(coastalTypes.get(id), x, y, this.maxHP));
      }
      this.funds = {friendly: 8000, enemy: 8000};
      this.sites = this.scenario.sites.map(site => ({...site, production: null, capture: null}));
      for (const [owner, position] of Object.entries(this.headquarters)) {
        this.sites.push({...position, owner, kind: 'headquarters', production: null, capture: null});
      }
      this.cities = this.sites.filter(site => site.kind === 'city');
      this.factories = this.sites.filter(site => site.kind === 'factory');
      this.activeUnit = this.friendlyUnits[0];
      return;
    }
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
    for (const factory of this.factories) factory.kind = 'factory';
    for (const city of this.cities) city.kind = 'city';
    this.sites = [...this.factories, ...this.cities];
  }

  crossingSnapshot() {
    const saveUnits = units => units.map(({type, x, y, hp, readyTurn, moved, attacked}) => ({
      type: type.id, x, y, hp, readyTurn, moved, attacked,
    }));
    const phase = this.enemyTurn;
    const snapshot = {
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
    if (this.scenario) {
      snapshot.scenario = this.scenario.id;
      snapshot.sites = this.sites.map(({owner, production, capture}) => ({owner, production, capture: capture ?? null}));
    }
    return snapshot;
  }

  static fromCrossingSnapshot(saved) {
    if (!saved || !integerBetween(saved.turn, 1, Number.MAX_SAFE_INTEGER - 1)) return null;
    if (saved.scenario !== undefined && saved.scenario !== fieldScenario.id) return null;
    const game = new BattleMap(saved.scenario);
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
        const type = game.unitTypes.find(type => type.id === unit.type);
        if (!type || (unit.hp && !Number.isFinite(game.movementCost(type, unit.x, unit.y)))) return null;
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
    const isFacility = facility => Object.hasOwn(facilityNames, facility);
    const validProduction = entry => entry && names.has(entry.unit) && integerBetween(entry.turn, 1, turn)
      && game.unitTypes.some(type => type.cost === entry.cost);
    if (!validEntries(factories, site => (isSide(site.owner) || (game.scenario && site.owner === 'neutral'))
      && (site.production === null || validProduction(site.production)))
      || factories.length !== game.factories.length
      || !validEntries(cityOwners, owner => isSide(owner) || owner === 'neutral') || cityOwners.length !== game.cities.length
      || !validEntries(enemyActions, entry => names.has(entry.enemy) && (!entry.friendly || names.has(entry.friendly))
        && validPosition(entry.from) && validPosition(entry.to)
        && (entry.facility === undefined || isFacility(entry.facility))
        && [entry.captured, entry.cityCaptured, entry.factoryCaptured].every(flag => typeof flag === 'boolean'))
      || !validEntries(enemyProductions, entry => validProduction(entry) && game.productionSiteAt(entry.x, entry.y))
      || (friendlyCapture !== null && !(validPosition(friendlyCapture) && names.has(friendlyCapture.unit)
        && isFacility(friendlyCapture.facility) && integerBetween(friendlyCapture.turn, 1, turn)
        && (friendlyCapture.points === undefined || integerBetween(friendlyCapture.points, 0, capturePoints - 1))))
      || !validEntries(facilityHealing, entry => isSide(entry.side) && names.has(entry.unit)
        && isFacility(entry.facility) && integerBetween(entry.amount, 1, facilityRecovery))) return null;

    if (game.scenario) {
      const validCapture = capture => capture === undefined || capture === null
        || (isSide(capture.side) && names.has(capture.unit) && integerBetween(capture.points, 1, capturePoints - 1));
      if (!validEntries(saved.sites, (site) => (isSide(site.owner) || site.owner === 'neutral')
        && (site.production === null || validProduction(site.production)) && validCapture(site.capture))
        || saved.sites.length !== game.sites.length) return null;
      for (const [index, site] of game.sites.entries()) {
        const savedSite = saved.sites[index];
        if (site.kind === 'headquarters' && site.owner !== savedSite.owner) return null;
        const {owner, production, capture = null} = savedSite;
        Object.assign(site, {owner, production, capture: capture && {...capture}});
      }
    }
    Object.assign(game, {turn, selected, capturedBy, friendlyUnits, enemyUnits, activeUnit: friendlyUnits[activeUnit],
      funds: {friendly: funds.friendly, enemy: funds.enemy}, enemyActions, enemyProductions, friendlyCapture, facilityHealing});
    if (!game.scenario) game.factories.forEach((site, index) => {
      const {owner, production} = factories[index];
      Object.assign(site, {owner, production});
    });
    if (!game.scenario) game.cities.forEach((city, index) => { city.owner = cityOwners[index]; });
    if (nextEnemy !== null) game.enemyTurn = {nextIndex: nextEnemy, action: null};
    return game;
  }

  get name() { return this.scenario?.name ?? 'はじまりの草原'; }
  get headquarters() { return this.scenario?.headquarters ?? mainHeadquarters; }
  get terrain() { return this.scenario?.terrain ?? mainTerrain; }
  get width() { return this.terrain[0].length; }
  get height() { return this.terrain.length; }
  get unitTypes() { return this.scenario ? [...coastalTypes.values()] : productionTypes; }
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

  facilityAt(x, y) {
    return this.sites.find(site => site.x === x && site.y === y);
  }

  get productionSites() {
    return this.sites.filter(site => this.domainAtSite(site));
  }

  productionSiteAt(x, y) {
    const site = this.facilityAt(x, y);
    return this.domainAtSite(site) ? site : undefined;
  }

  domainAtSite(site) {
    if (!site) return null;
    if (site.kind === 'factory' || site.kind === 'headquarters') return land;
    if (site.kind === 'airfield') return air;
    if (site.kind === 'port') return sea;
    if (this.scenario && site.kind === 'city'
      && Object.values(this.headquarters).some(base => distanceBetween(site, base) <= 3)) return land;
    return null;
  }

  productionChoices(site) {
    const domain = this.domainAtSite(site);
    return domain ? this.unitTypes.filter(type => (type.domain ?? land) === domain) : [];
  }

  incomeFor(side) {
    if (!Object.hasOwn(this.funds, side)) return 0;
    return this.cities.filter(city => city.owner === side).length * cityIncome + (this.scenario ? 1000 : 0);
  }

  productionCost(typeId) {
    return this.unitTypes.find(type => type.id === typeId)?.cost;
  }

  productionStatus(factory) {
    if (this.result || !this.sites.includes(factory) || !this.domainAtSite(factory) || factory.owner !== 'friendly') return 'unavailable';
    if (this.enemyTurn) return 'waiting';
    const status = this.#factoryStatus(factory);
    if (status !== 'ready') return status;
    if (this.scenario && this.friendlyUnits.filter(unit => unit.hp > 0).length >= fleetLimit) return 'limit';
    if (!this.productionChoices(factory).some(type => type.cost <= this.funds.friendly)) return 'insufficient';
    return status;
  }

  #factoryStatus(factory) {
    if (factory.production?.turn === this.turn) return 'used';
    const {x, y} = factory;
    return this.friendlyAt(x, y) || this.enemyAt(x, y) ? 'occupied' : 'ready';
  }

  produce(typeId, factory) {
    const type = this.productionChoices(factory).find(type => type.id === typeId);
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

  // Returns the capture in progress on a site, or null once its infantry has left or been destroyed.
  captureProgress(site) {
    const capture = site?.capture;
    if (!capture) return null;
    const units = capture.side === 'friendly' ? this.friendlyUnits : this.enemyUnits;
    const holder = units.find(unit => unit.name === capture.unit && unit.hp > 0 && unit.x === site.x && unit.y === site.y);
    return holder && site.owner !== capture.side ? capture : null;
  }

  #clearStaleCaptures() {
    for (const site of this.sites) {
      if (site.capture && !this.captureProgress(site)) site.capture = null;
    }
  }

  #advanceCapture(unit, side) {
    this.#clearStaleCaptures();
    if (unit.type.id !== infantry.id || unit.hp <= 0) return null;
    const site = this.facilityAt(unit.x, unit.y);
    if (!site || site.owner === side) return null;
    const current = site.capture?.side === side && site.capture.unit === unit.name ? site.capture.points : capturePoints;
    const points = Math.max(0, current - unit.hp);
    if (points > 0) {
      site.capture = {side, unit: unit.name, points};
      return {site, points, completed: false};
    }
    site.capture = null;
    if (site.kind === 'headquarters') this.capturedBy = side;
    else site.owner = side;
    return {site, points: 0, completed: true};
  }

  get canCaptureHere() {
    const unit = this.activeUnit;
    if (!this.scenario || this.enemyTurn || this.result || unit.type.id !== infantry.id || !unit.hp
      || unit.readyTurn > this.turn || unit.moved || unit.attacked) return false;
    const site = this.facilityAt(unit.x, unit.y);
    return Boolean(site && site.owner !== 'friendly');
  }

  captureHere() {
    if (!this.canCaptureHere) return null;
    const unit = this.activeUnit;
    unit.moved = true;
    this.selected = false;
    const step = this.#advanceCapture(unit, 'friendly');
    this.friendlyCapture = {facility: step.site.kind, unit: unit.name, x: unit.x, y: unit.y, turn: this.turn, points: step.points};
    return step;
  }

  #captureHeadquarters(unit, side) {
    const owner = this.headquartersAt(unit.x, unit.y);
    if (!owner || owner === side || unit.type.id !== infantry.id) return false;
    this.capturedBy = side;
    return true;
  }

  #captureFacility(unit, side) {
    if (unit.type.id !== infantry.id) return null;
    const site = this.facilityAt(unit.x, unit.y);
    if (!site || site.kind === 'headquarters' || site.owner === side) return null;
    site.owner = side;
    return site.kind;
  }

  enemyAt(x, y) {
    return this.enemyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  friendlyAt(x, y) {
    return this.friendlyUnits.find(unit => unit.hp > 0 && unit.x === x && unit.y === y);
  }

  terrainAt(x, y) {
    return terrainTypes[this.terrain[y]?.[x] ?? 'p'];
  }

  movementCost(type, x, y) {
    const terrain = this.terrainAt(x, y);
    if (!this.scenario) return terrain.cost ?? 1;
    if (type.domain === air) return 1;
    const port = this.facilityAt(x, y)?.kind === 'port';
    if (type.domain === sea) return port || terrain.water ? terrain.cost ?? 1 : Infinity;
    if (terrain.water && !port || (terrain.id === 'mountain' && type.id !== 'infantry')) return Infinity;
    if (terrain.id === 'forest' && type.id !== 'infantry') return 2;
    return terrain.cost ?? 1;
  }

  #canStrike(unit, target, position = unit, moved = unit.moved, counter = false) {
    const {type} = unit;
    if (type.targets && !type.targets.includes(target.type.domain)) return false;
    if (type.stationary && (counter || moved)) return false;
    return inRange(type, position, target);
  }

  get canAttack() {
    return this.canUnitAttack(this.activeUnit);
  }

  canUnitAttack(unit, enemy) {
    return !this.enemyTurn && !this.result && unit.hp > 0 && unit.readyTurn <= this.turn && !unit.attacked && (enemy
      ? this.enemyUnits.includes(enemy) && enemy.hp > 0 && this.#canStrike(unit, enemy)
      : this.enemyUnits.some(target => target.hp > 0 && this.#canStrike(unit, target)));
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
    const others = this.#occupiedExcept(this.activeUnit);
    const enemies = others.filter(unit => this.enemyUnits.includes(unit));
    const allies = others.filter(unit => !this.enemyUnits.includes(unit));
    // Friendly units can pass through allied squares but cannot stop on them.
    const routes = this.#routes(this.activeUnit, enemies, this.playerUnit.movement, this.playerUnit.movement, allies);
    routes.delete(`${this.x},${this.y}`);
    return routes;
  }

  #occupiedExcept(actor) {
    return [...this.friendlyUnits, ...this.enemyUnits].filter(unit => unit.hp > 0 && unit !== actor);
  }

  #routes(from, blocked, budget, stepLimit = budget, passable = []) {
    const start = {x: from.x, y: from.y, cost: 0, previous: null};
    const occupied = new Set(blocked.map(({x, y}) => `${x},${y}`));
    const crossable = passable.map(({x, y}) => `${x},${y}`);
    const routes = new Map([[`${from.x},${from.y}`, start]]);
    const queue = [start];
    for (const route of queue) {
      for (const [dx, dy] of directions) {
        const x = route.x + dx;
        const y = route.y + dy;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        const key = `${x},${y}`;
        if (from.type.domain !== air && occupied.has(key)) continue;
        const stepCost = this.movementCost(from.type, x, y);
        const cost = route.cost + stepCost;
        if (stepCost === Infinity || stepCost > stepLimit || cost > budget || cost >= (routes.get(key)?.cost ?? Infinity)) continue;
        const next = {x, y, cost, previous: route};
        routes.set(key, next);
        queue.push(next);
      }
    }
    for (const key of [...occupied, ...crossable]) routes.delete(key);
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
      if (this.scenario) {
        const step = this.#advanceCapture(this.activeUnit, 'friendly');
        if (step) {
          this.friendlyCapture = {facility: step.site.kind, unit: this.activeUnit.name, x, y, turn: this.turn, points: step.points};
        }
        return;
      }
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
        const facility = this.facilityAt(unit.x, unit.y);
        if (!this.#canRecover(unit, side, facility)) continue;
        const amount = Math.min(facilityRecovery, this.maxHP - unit.hp);
        unit.hp += amount;
        this.facilityHealing.push({side, unit: unit.name, amount, facility: facility.kind});
      }
    }
  }

  #canRecover(unit, side, facility) {
    if (facility?.owner !== side) return false;
    if (unit.type.domain === air) return facility.kind === 'airfield';
    if (unit.type.domain === sea) return facility.kind === 'port';
    return true;
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
    let captured;
    let facility;
    let step = null;
    if (this.scenario) {
      step = this.#advanceCapture(enemy, 'enemy');
      captured = Boolean(step?.completed && step.site.kind === 'headquarters');
      facility = step?.completed && !captured ? step.site.kind : null;
    } else {
      captured = this.#captureHeadquarters(enemy, 'enemy');
      facility = this.#captureFacility(enemy, 'enemy');
    }
    const strikes = !captured && friendly ? this.#exchange('enemy', friendly, enemy) : [];
    this.#restoreActiveUnit();
    this.#clearStaleCaptures();
    const record = {enemy: enemy.name, friendly: friendly?.name, from, to, captured,
      cityCaptured: facility === 'city', factoryCaptured: facility === 'factory'};
    if (this.scenario && facility) record.facility = facility;
    if (step && !step.completed) Object.assign(record, {capturing: step.site.kind, points: step.points});
    this.enemyActions.push(record);
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
    if (this.scenario) return this.#planCoastalProduction();
    const factory = this.factories.find(site => site.owner === 'enemy' && this.#factoryStatus(site) === 'ready');
    if (!factory) return null;
    const counts = new Map(productionTypes.map(({id}) => [id, 0]));
    for (const unit of this.enemyUnits) {
      if (unit.hp > 0) counts.set(unit.type.id, counts.get(unit.type.id) + 1);
    }
    const type = productionTypes.reduce((fewest, next) => counts.get(next.id) < counts.get(fewest.id) ? next : fewest);
    return this.funds.enemy >= type.cost ? {factory, type} : null;
  }

  #planCoastalProduction() {
    const units = this.enemyUnits.filter(unit => unit.hp);
    if (units.length >= fleetLimit) return null;
    const foes = this.friendlyUnits.filter(unit => unit.hp);
    const numbers = id => units.filter(unit => unit.type.id === id).length;
    const opposing = domain => foes.filter(unit => unit.type.domain === domain).length;
    const coastDistance = new Map(foes.map(foe => [foe, this.#distanceToSea(foe)]));
    const savings = this.funds.enemy + this.incomeFor('enemy');
    let best = null;
    let bestScore = -Infinity;
    let reserveScore = -Infinity;
    for (const factory of this.productionSites) {
      if (factory.owner !== 'enemy' || this.#factoryStatus(factory) !== 'ready') continue;
      for (const type of this.productionChoices(factory)) {
        const reachable = foes.filter(foe => type.targets.includes(foe.type.domain)
          && (type.domain !== sea || coastDistance.get(foe) <= type.maxRange));
        if (!reachable.length) continue;
        let score = type.firepower * 2 - type.cost / 2000 - 5 * numbers(type.id);
        if (type.id === 'infantry' && numbers(type.id) < 2) score += 12;
        if (['antiair', 'fighter', 'destroyer'].includes(type.id)) score += Math.min(8, opposing(air) * 3);
        if (type.id === 'fighter' && opposing(air) === 1) score -= 4;
        if (type.domain === sea && opposing(sea)) score += 3;
        const nearest = Math.min(...reachable.map(foe => distanceBetween(factory, foe)));
        score -= nearest / (type.movement + type.maxRange);
        if (type.cost > this.funds.enemy) {
          if (units.length >= 8 && type.cost >= 6500 && type.cost <= savings) reserveScore = Math.max(reserveScore, score);
          continue;
        }
        if (score <= bestScore) continue;
        bestScore = score;
        best = {factory, type};
      }
    }
    return reserveScore > bestScore + 2 ? null : best;
  }

  #distanceToSea(position) {
    const {x, y} = position;
    const maxRange = coastalTypes.get('battleship').maxRange;
    for (let radius = 0; radius <= maxRange; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const row = y + dy;
        if (row < 0 || row >= this.height) continue;
        const dx = radius - Math.abs(dy);
        for (const column of [x - dx, x + dx]) {
          if (column < 0 || column >= this.width) continue;
          if (Number.isFinite(this.movementCost(coastalTypes.get('patrol'), column, row))) return radius;
        }
      }
    }
    return Infinity;
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
    const counterUnit = defender === 'player' ? friendly : enemy;
    const counterTarget = defender === 'player' ? enemy : friendly;
    if (friendly.hp > 0 && enemy.hp > 0 && this.#canStrike(counterUnit, counterTarget, counterUnit, false, true)) {
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
    const {type} = attackingUnit;
    const cover = defender.type.domain && defender.type.domain !== land ? 0 : terrain.defense;
    let strength;
    let protectedDamage;
    if (this.scenario) {
      // Damage scales with the attacker's remaining strength (HP) after matchup and cover are applied,
      // so a squad at half strength deals about half the damage.
      const ratio = attackingUnit.hp / this.maxHP;
      const full = Math.max(1, type.firepower + (type.bonus?.[defender.type.id] ?? type.bonus?.[defender.type.domain] ?? 0));
      strength = Math.max(1, Math.round(full * ratio));
      protectedDamage = Math.max(1, Math.round(Math.max(1, full - cover) * ratio));
    } else {
      strength = baseStrength + (type.attackBonus ?? 0);
      protectedDamage = Math.max(1, strength - cover);
    }
    const damage = Math.min(protectedDamage, defender.hp);
    defender.hp -= damage;
    return {attacker, damage, terrain: terrain.name, mitigation: Math.max(0, strength - protectedDamage),
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

  #planCoastalAction(enemy) {
    const from = {x: enemy.x, y: enemy.y};
    const {type} = enemy;
    const living = this.friendlyUnits.filter(unit => unit.hp > 0);
    const routes = this.#routes(enemy, this.#occupiedExcept(enemy), Infinity, type.movement);
    const home = this.headquarters.friendly;
    const homeRoute = routes.get(`${home.x},${home.y}`);
    const holding = this.captureProgress(this.facilityAt(from.x, from.y));
    if (holding?.side === 'enemy' && holding.unit === enemy.name) {
      // Stay on the site to continue an unfinished capture.
      return {enemy, from, to: {...from}, path: [], friendly: null};
    }
    if (type.id === infantry.id && homeRoute?.cost <= type.movement) {
      return {enemy, from, to: {...home}, path: routeSteps(homeRoute), friendly: null};
    }
    const capturable = position => {
      const site = this.facilityAt(position.x, position.y);
      if (type.id !== infantry.id || !site || site.owner === 'enemy') return 0;
      return site.kind === 'headquarters' ? 24 : site.kind === 'city' ? 13 : 10;
    };
    const objectives = living.filter(unit => type.targets.includes(unit.type.domain));
    let approach = null;
    let bestGoal = -Infinity;
    for (const route of routes.values()) {
      const capture = capturable(route);
      const firing = objectives.some(target => this.#canStrike(enemy, target, route, false));
      if (!capture && !firing) continue;
      const priority = Math.max(capture, firing ? 11 : 0) - route.cost;
      if (priority <= bestGoal) continue;
      approach = route;
      bestGoal = priority;
    }
    while (approach && (approach.cost > type.movement || !routes.has(`${approach.x},${approach.y}`))) {
      approach = approach.previous;
    }
    const danger = (route, destroyed) => living.reduce((risk, target) => {
      if (target === destroyed || !target.type.targets.includes(type.domain)) return risk;
      const distance = distanceBetween(route, target);
      const cover = type.domain === land ? this.terrainAt(route.x, route.y).defense : 0;
      if (inRange(target.type, target, route)) return risk + Math.max(1, target.type.firepower - cover) * .33;
      if (!target.type.stationary && distance <= target.type.maxRange + target.type.movement) return risk + .3;
      return risk;
    }, 0);
    let bestScore = -Infinity;
    let choice;
    for (const route of routes.values()) {
      if (route.cost > type.movement) continue;
      const site = this.facilityAt(route.x, route.y);
      const capture = capturable(route);
      const moved = route.cost > 0;
      const recover = this.#canRecover(enemy, 'enemy', site) ? Math.min(facilityRecovery, this.maxHP - enemy.hp) : 0;
      const holdingProduction = site?.owner === 'enemy' && this.domainAtSite(site);
      const baseScore = capture + recover * 1.55 - (holdingProduction ? 2 : 0) - route.cost * .12
        + (moved && route === approach ? 4.5 : 0);
      const targets = objectives.filter(target => this.#canStrike(enemy, target, route, moved));
      const risk = danger(route, null);
      for (const target of [null, ...targets]) {
        const strikes = target ? this.#exchange('enemy', {...target}, {...enemy, x: route.x, y: route.y}) : [];
        const [hit, reply] = strikes;
        const killed = hit?.playerHP === 0;
        const lost = reply?.enemyHP === 0;
        const combat = hit ? hit.damage * 2.1 + (killed ? 11 : 0) - (reply?.damage ?? 0) * 1.6 - (lost ? 12 : 0) : 0;
        const score = baseScore + combat - (killed ? danger(route, target) : risk);
        if (score <= bestScore) continue;
        bestScore = score;
        choice = {enemy, from, to: {x: route.x, y: route.y}, path: routeSteps(route), friendly: target};
      }
    }
    return choice;
  }

  planEnemyAction(enemy) {
    if (this.scenario) return this.#planCoastalAction(enemy);
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
