const scenarioPreference = 'sumaho-wars:scenario';
const coastalSaveKey = 'sumaho-wars:coastal-save';

function openScenario(id) {
  const save = createCrossingSave(() => window.localStorage, id === 'coastal' ? coastalSaveKey : crossingSaveKey);
  const restored = save.load(state => {
    const map = BattleMap.fromCrossingSnapshot(state);
    return map && (map.scenario?.id ?? 'legacy') === id ? map : null;
  });
  return {save, restored};
}

function initialScenario() {
  try {
    const storage = window.localStorage;
    if (storage.getItem(crossingSaveKey) && (storage.getItem(scenarioPreference) === 'legacy'
      || (!storage.getItem(coastalSaveKey) && storage.getItem(scenarioPreference) !== 'coastal'))) return 'legacy';
  } catch {
    // A new match is still playable without storage.
  }
  return 'coastal';
}

let currentScenario = initialScenario();
let {save: crossingSave, restored: game} = openScenario(currentScenario);
if (!game && currentScenario === 'legacy') {
  currentScenario = 'coastal';
  ({save: crossingSave, restored: game} = openScenario(currentScenario));
}
game ??= new BattleMap(currentScenario);
const board = document.getElementById('board');
const mapSurround = document.getElementById('map-surround');
const mapScrollNote = document.getElementById('map-scroll-note');
const roster = document.getElementById('friendly-roster');
const enemyRoster = document.getElementById('enemy-roster');
const cells = [];
const reducedMapMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Time per tile while a unit moves (ms). Kept short so moves feel snappy.
const mapUnitMotion = {
  infantry: {row: 0, step: 120},
  scout: {row: 1, step: 85},
  support: {row: 2, step: 115},
  tank: {row: 3, step: 140},
};
const rosterEntries = [];
const enemyRosterEntries = [];
const ordersActions = document.getElementById('orders-actions');
const endTurn = document.getElementById('end');
const endLabel = document.getElementById('end-label');
const turnIndicator = document.getElementById('turn-indicator');
const turnNumber = document.getElementById('turn');
const turnSide = document.getElementById('turn-side');
const turnChange = document.getElementById('turn-change');
const turnChangeNumber = document.getElementById('turn-change-number');
const turnChangeSide = document.getElementById('turn-change-side');
const actionDialog = document.getElementById('action-dialog');
const actionTitle = document.getElementById('action-title');
const actionSummary = document.getElementById('action-summary');
const actionDetail = document.getElementById('action-detail');
const actionConfirm = document.getElementById('action-confirm');
const productionControls = document.getElementById('production-controls');
const productionLaunch = document.getElementById('production-launch');
const productionDialog = document.getElementById('production-dialog');
const canOpenProductionDialog = typeof productionDialog.showModal === 'function';
const compactControls = window.matchMedia('(max-width: 720px)');
const productionCatalog = document.querySelector('.production-choices');
const guide = document.getElementById('guide');
const productionStatus = document.getElementById('production-status');
const productionMove = document.getElementById('production-move');
const factoryLegend = document.getElementById('factory-legend');
const factoryPicker = document.getElementById('factory-picker');
const factoryEntries = [];
let selectedFactory;
let productionOrigin;
let pendingAction;
let turnChangeTimer;
const cityOverview = document.getElementById('city-overview');
const cityEntries = [];
const currency = new Intl.NumberFormat('ja-JP');
const ownerNames = {friendly: '味方', enemy: '敵', neutral: '中立'};
const unitActions = {
  ready: {label: '移動可能'}, spent: {label: '行動済み', marker: '済'},
  attack: {label: '攻撃可能', marker: '攻可'}, deployed: {label: '次のターンから', marker: '次'},
  acting: {label: '行動中', marker: '動'}, moving: {label: '移動中', marker: '動'}, defeated: {label: '撃破'}, ended: {label: '対戦終了'},
};
const main = document.querySelector('main');
const saveStatus = document.getElementById('crossing-save-status');
const replay = document.getElementById('replay');
const fieldTools = document.getElementById('field-tools');
const fieldNextUnit = document.getElementById('field-next-unit');
const enemyPreview = document.getElementById('enemy-preview');
const enemyPreviewTitle = document.getElementById('enemy-preview-title');
const enemyPreviewDetail = document.getElementById('enemy-preview-detail');
const enemyPreviewChoices = document.getElementById('enemy-preview-choices');
const fieldStatus = document.getElementById('field-status');
const fieldUnit = document.getElementById('field-unit');
const fieldFunds = document.getElementById('field-funds');
const fieldRoster = document.getElementById('field-roster-dialog');
const fieldOverview = document.getElementById('field-overview-dialog');
const overviewGrid = document.getElementById('overview-grid');
const overviewWindow = document.createElement('span');
overviewWindow.className = 'overview-window';
overviewWindow.setAttribute('aria-hidden', 'true');
const fieldButtons = [...fieldTools.querySelectorAll('button[aria-controls]')];
const fieldDialogs = fieldButtons.map(button => document.getElementById(button.getAttribute('aria-controls')));
const fieldSections = [
  ['friendly-roster', 'field-roster-content'],
  ['orders-notes', 'field-intel-content'],
  ['map-intel', 'field-intel-content'],
  ['map-keys', 'field-intel-content'],
  ['unit-panel', 'field-intel-content'],
  ['replay', 'orders-actions'],
].map(([id, targetId]) => {
  const content = document.getElementById(id);
  const placeholder = document.createComment(id);
  content.before(placeholder);
  return {content, placeholder, target: document.getElementById(targetId)};
});
let mobileField = false;
let inspectedCell = null;
let movingFriendly = null;
let movingEnemy = null;
let markedFriendlyTiles = [];
let strideSprite;
let markedEnemyTiles = [];
let enemyPositionInView = null;
let playerScrollTop = null;

function renderSaveStatus() {
  saveStatus.hidden = false;
  const messages = {
    ready: '自動保存', saved: '自動保存済み', restored: '続きから再開',
    unreadable: '保存データを読み込めません。', unavailable: '進行を保存できません。',
    'changed-elsewhere': '別のタブで進行が更新されました。開き直してください。',
  };
  const text = messages[crossingSave.status];
  if (saveStatus.textContent !== text) saveStatus.textContent = text;
  saveStatus.toggleAttribute('data-error', !['ready', 'saved', 'restored'].includes(crossingSave.status));
}

function saveProgress() {
  crossingSave.write(game.crossingSnapshot());
  renderSaveStatus();
}

// Places are described by facility or terrain instead of grid coordinates.
function placeName(x, y) {
  const base = game.headquartersAt(x, y);
  if (base) return `${ownerNames[base]}の本拠地`;
  const facility = game.facilityAt(x, y);
  if (facility) return `${ownerNames[facility.owner]}の${facilityNames[facility.kind]}`;
  return game.terrainAt(x, y).name;
}

// Describes the next capture step of an infantry unit on a site (10 points; each step removes the unit's HP).
function captureForecast(site, unit) {
  const name = site.kind === 'headquarters' ? '敵本拠地' : facilityNames[site.kind];
  if (!game.scenario) return site.kind === 'headquarters' ? '敵本拠地を占領すると勝利' : `${name}を占領`;
  const progress = game.captureProgress(site);
  const current = progress?.side === 'friendly' && progress.unit === unit.name ? progress.points : game.maxHP;
  const after = Math.max(0, current - unit.hp);
  if (after > 0) return `${name}の占領 残り${current}→${after}（あと${Math.ceil(after / unit.hp)}回）`;
  return site.kind === 'headquarters' ? '敵本拠地を占領して勝利' : `${name}を占領`;
}

const celebration = document.getElementById('celebration');
let celebrationTimer;
let celebratedResult = null;

// Big on-map effects for completed captures and the final result. They never block input:
// a capture banner fades by itself, and a result can be dismissed with a tap.
function celebrate(kind, title, sub, duration) {
  if (celebrationTimer) portraitMode.cancel(celebrationTimer);
  celebration.hidden = false;
  celebration.dataset.kind = kind;
  celebration.querySelector('.celebration-title').textContent = title;
  celebration.querySelector('.celebration-sub').textContent = sub;
  celebration.classList.remove('is-playing');
  void celebration.offsetWidth;
  celebration.classList.add('is-playing');
  celebrationTimer = portraitMode.schedule(endCelebration, reducedMapMotion.matches ? Math.min(duration, 1400) : duration);
}

function endCelebration() {
  if (celebrationTimer) portraitMode.cancel(celebrationTimer);
  celebrationTimer = undefined;
  celebration.hidden = true;
  celebration.classList.remove('is-playing');
}
celebration.addEventListener('click', endCelebration);

function celebrateCapture(step, side) {
  if (!step?.site) return;
  if (!step.completed) {
    flashMapTile(step.site, 'capture', `残り${step.points}`);
    return;
  }
  if (step.site.kind === 'headquarters' || game.result) {
    celebrateResult();
    return;
  }
  const name = facilityNames[step.site.kind];
  celebrate(side === 'friendly' ? 'capture' : 'lost', side === 'friendly' ? `${name}占領！` : `${name}を奪われた`,
    side === 'friendly' ? (step.site.kind === 'city' ? '収入が増えます' : '生産・補給に使えます') : '取り返しましょう', 1700);
}

function celebrateResult() {
  if (!game.result || celebratedResult === game.result) return;
  celebratedResult = game.result;
  const win = game.result === 'victory';
  const reason = game.capturedBy ? (win ? '敵本拠地を占領' : '本拠地を占領された') : (win ? '敵部隊を全滅' : '味方部隊が全滅');
  celebrate(win ? 'victory' : 'defeat', win ? '勝利' : '敗北', reason, 4200);
}

function siteLabel(site) {
  const name = facilityNames[site.kind];
  if (site.kind === 'headquarters') return name;
  // Number only the player's own sites of the same kind, so the production picker reads 都市1, 都市2...
  const peers = game.sites.filter(other => other.kind === site.kind && other.owner === site.owner)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return peers.length > 1 ? `${name}${peers.indexOf(site) + 1}` : name;
}

function friendlyTile() {
  return tileAt(game.activeUnit);
}

function tileAt({x, y}) {
  return cells[y * game.width + x].button;
}

// Realistic unit art from unit-art.js when the browser can draw it, otherwise the pixel sprites.
function unitImage(type, enemy = false, facing) {
  if (window.UnitArt) return window.UnitArt.icon(type.id, enemy ? 'enemy' : 'friendly', facing);
  if (enemy && type.id !== 'support') return `./assets/enemy-${type.id}.png?v=unit-combat`;
  const sprite = !enemy && type.id === 'support' ? 'friendly-support' : type.id;
  return `./assets/${sprite}.png?v=unit-combat`;
}

// Frame-animated map sprites exist only for the pixel art.
function unitMotion(id) {
  return window.UnitArt ? null : mapUnitMotion[id];
}
if (window.UnitArt) document.documentElement.classList.add('unit-art');

function showImage(image, source) {
  if (image.getAttribute('src') !== source) image.src = source;
}

function waitingForEnemy() {
  return Boolean(game.enemyTurn);
}

function inputBlocked() {
  return portraitMode.blocked || combatScreen.active || waitingForEnemy() || Boolean(movingFriendly || game.result);
}

function extendRoster(container, entries, units, interactive) {
  for (const unit of units.slice(entries.length)) {
    const card = document.createElement(interactive ? 'button' : 'div');
    const name = document.createElement('strong');
    name.textContent = (interactive ? '' : '敵') + unit.name;
    const hp = document.createElement('span');
    const state = document.createElement('span');
    card.append(name, hp, state);
    if (interactive) {
      card.type = 'button';
      card.addEventListener('click', () => selectFriendlyUnit(unit));
    }
    entries.push({unit, card, hp, state});
    container.append(card);
  }
}

function selectFriendlyUnit(unit) {
  if (inputBlocked() || !unit.hp) return;
  inspectedCell = null;
  if (!mobileField || game.activeUnit !== unit || !game.selected) game.choose(unit.x, unit.y);
  saveProgress();
  const tile = friendlyTile();
  setBoardTabStop(tile);
  if (fieldRoster.open) {
    fieldRoster.close();
    tile.focus({preventScroll: true});
  }
  revealTile(tile, mobileField);
  render();
}

function canAct(unit) {
  const action = friendlyAction(unit);
  return action === 'ready' || action === 'attack';
}

function nextFriendlyUnit() {
  const units = game.friendlyUnits;
  const current = units.indexOf(game.activeUnit);
  return units.slice(current + 1).concat(units.slice(0, current)).find(canAct);
}

function friendlyAction(unit) {
  if (!unit.hp) return 'defeated';
  if (movingFriendly?.unit === unit) return 'moving';
  if (game.result) return 'ended';
  if (unit.readyTurn > game.turn) return 'deployed';
  if (unit.attacked) return 'spent';
  if (unit.moved) return game.canUnitAttack(unit) ? 'attack' : 'spent';
  return 'ready';
}

function renderTurn(waiting) {
  const round = String(game.turn).padStart(2, '0');
  const side = game.result && !movingFriendly ? 'ended' : waiting ? 'enemy' : 'friendly';
  const label = {friendly: '味方の手番', enemy: '敵の手番', ended: '対戦終了'}[side];
  turnIndicator.dataset.side = side;
  if (turnNumber.textContent !== round) turnNumber.textContent = round;
  if (turnSide.textContent !== label) turnSide.textContent = label;
  endLabel.textContent = waiting ? '敵が行動中' : 'ターン終了';
}

function announceTurn(side, onComplete) {
  portraitMode.cancel(turnChangeTimer);
  turnChange.dataset.side = side;
  turnChangeNumber.textContent = `ターン ${String(game.turn).padStart(2, '0')}`;
  turnChangeSide.textContent = turnSide.textContent;
  turnChange.hidden = false;
  combatAudio.playTurn(side);
  turnChangeTimer = portraitMode.schedule(() => {
    turnChange.hidden = true;
    turnChangeTimer = undefined;
    onComplete?.();
  }, 700);
}

function renderProduction() {
  const owned = game.productionSites.filter(factory => factory.owner === 'friendly');
  if (!owned.includes(selectedFactory)) selectedFactory = owned.find(site => game.productionStatus(site) === 'ready') ?? owned[0];
  const mapFactory = productionOrigin?.cell;
  factoryPicker.hidden = owned.length < 2 || Boolean(mapFactory);
  productionMove.hidden = !mapFactory || !game.canMoveTo(mapFactory.x, mapFactory.y);
  for (const {factory, icon, owner, button} of factoryEntries) {
    icon.dataset.factory = factory.kind === 'factory' ? factory.owner : '';
    icon.dataset.facilityOwner = factory.owner;
    owner.textContent = `${ownerNames[factory.owner]}${facilityNames[factory.kind]}`;
    button.hidden = factory.owner !== 'friendly';
    if (!button.hidden) button.textContent = siteLabel(factory);
    button.setAttribute('aria-pressed', String(factory === selectedFactory));
  }
  document.getElementById('production-title-kind').textContent = selectedFactory ? siteLabel(selectedFactory) : 'ユニット生産';
  const status = game.productionStatus(selectedFactory);
  const purchase = selectedFactory?.production;
  const labels = {
    ready: '1ターンに1部隊を生産できます。',
    occupied: '部隊がいます。マスが空くと生産できます。',
    used: purchase ? `${purchase.unit}を生産しました（−${currency.format(purchase.cost)}）。次のターンから操作できます。` : '',
    waiting: '敵のターンです。',
    unavailable: game.result ? '対戦終了' : '生産できる味方施設がありません。',
    insufficient: '生産に必要な資金が足りません。',
    limit: `出撃できる上限（${fleetLimit}部隊）に達しました。`,
  };
  if (productionStatus.textContent !== labels[status]) productionStatus.textContent = labels[status];
  document.getElementById('production-funds').textContent = currency.format(game.funds.friendly);
  const available = new Set(game.productionChoices(selectedFactory).map(type => type.id));
  for (const button of productionCatalog.children) {
    const affordable = game.funds.friendly >= game.productionCost(button.dataset.produce);
    const canBuy = status === 'ready' && affordable && !movingFriendly;
    button.hidden = !available.has(button.dataset.produce);
    button.setAttribute('aria-disabled', String(!canBuy));
  }
}

function buildFactories() {
  selectedFactory = undefined;
  factoryEntries.length = 0;
  factoryLegend.replaceChildren();
  factoryPicker.replaceChildren();
  productionCatalog.replaceChildren();
  for (const type of game.unitTypes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.produce = type.id;
    const detail = document.createElement('small');
    detail.textContent = `${currency.format(type.cost)} · 移動 ${type.movement} · 射程 ${rangeLabel(type)}`;
    const trait = document.createElement('span');
    trait.className = 'production-trait';
    trait.textContent = type.trait ?? '';
    button.append(type.name, detail, trait);
    button.addEventListener('click', event => {
      if (inputBlocked() || repeatedTap(event, productionOrigin?.event)) return;
      const unit = game.produce(type.id, selectedFactory);
      if (!unit) return;
      saveProgress();
      render();
      flashMapTile(unit, 'deploy');
    });
    productionCatalog.append(button);
  }
  for (const factory of game.productionSites) {
    const legend = document.createElement('span');
    const icon = document.createElement('i');
    icon.className = 'factory-key';
    icon.dataset.facilityKind = factory.kind;
    icon.setAttribute('aria-hidden', 'true');
    const owner = document.createElement('span');
    legend.append(icon, owner);
    if (factory.kind !== 'headquarters' && factory.kind !== 'city') factoryLegend.append(legend);
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (portraitMode.blocked) return;
      selectedFactory = factory;
      renderProduction();
    });
    factoryPicker.append(button);
    factoryEntries.push({factory, icon, owner, button});
  }
}

function renderEconomy() {
  for (const side of Object.keys(game.funds)) {
    document.getElementById(`${side}-funds`).textContent = currency.format(game.funds[side]);
    document.getElementById(`${side}-income`).textContent = currency.format(game.incomeFor(side));
  }
  for (const {city, label} of cityEntries) {
    const owner = ownerNames[city.owner];
    label.dataset.city = city.owner;
    label.textContent = owner;
  }
  const healing = document.getElementById('facility-healing');
  const restored = game.facilityHealing.map(({side, unit, amount, facility}) => {
    const site = facilityNames[facility];
    return `${ownerNames[side]}${unit}（${site}） +${amount} HP`;
  });
  const report = !game.enemyTurn && !game.result && restored.length ? `回復　${restored.join('、')}` : '';
  if (healing.textContent !== report) healing.textContent = report;
}

function rangeLabel({minRange, maxRange}) {
  return minRange === maxRange ? maxRange : `${minRange}〜${maxRange}`;
}

function render() {
  const waiting = waitingForEnemy();
  const result = movingFriendly ? null : game.result;
  const ordersLocked = waiting || Boolean(movingFriendly);
  const spent = !game.canMove && !game.canAttack;
  const lost = game.result === 'defeat';
  const friendlyName = '味方' + game.activeUnit.name;
  const movementTargets = waiting ? new Map() : game.movementTargets();
  const enemyBase = game.headquarters.enemy;
  const captureReady = game.playerUnit.id === 'infantry' && movementTargets.has(`${enemyBase.x},${enemyBase.y}`);
  const actingEnemy = game.enemyTurn?.action?.enemy;
  const actedEnemies = new Set(waiting ? game.enemyActions.map(action => action.enemy) : []);
  const enemyAction = unit => {
    if (!unit.hp) return 'defeated';
    if (waiting && unit.readyTurn > game.turn) return 'deployed';
    if (unit === actingEnemy) return 'acting';
    return actedEnemies.has(unit.name) ? 'spent' : '';
  };
  const facilityCapture = game.friendlyCapture;
  const announcedCapture = facilityCapture?.turn === game.turn && facilityCapture.unit === game.activeUnit.name && !game.attacked;
  extendRoster(roster, rosterEntries, game.friendlyUnits, true);
  extendRoster(enemyRoster, enemyRosterEntries, game.enemyUnits, false);
  renderProduction();
  renderEconomy();
  for (const {unit, card, hp, state} of rosterEntries) {
    const action = friendlyAction(unit);
    const label = unitActions[action].label;
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    const {x, y} = movingFriendly?.unit === unit ? movingFriendly.position : unit;
    state.textContent = mobileField && unit.hp ? `${placeName(x, y)} · ${label}` : label;
    card.dataset.action = action;
    card.disabled = !unit.hp || Boolean(game.result);
    card.classList.toggle('defeated', !unit.hp);
    card.setAttribute('aria-disabled', String(ordersLocked || card.disabled));
    card.setAttribute('aria-pressed', String(unit === game.activeUnit));
  }
  for (const {unit, card, hp, state} of enemyRosterEntries) {
    const action = enemyAction(unit);
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    const {x, y} = movingEnemy?.unit === unit ? movingEnemy.position : unit;
    const spot = placeName(x, y);
    state.textContent = !unit.hp ? unitActions.defeated.label : action ? `${spot} · ${unitActions[action].label}` : spot;
    card.dataset.action = action;
    card.classList.toggle('enemy-acting', unit === actingEnemy);
    card.classList.toggle('defeated', !unit.hp);
  }
  for (const cell of cells) {
    const {x, y, button, image, idleSprite, hpBadge, actionBadge, productionBadge, base, factory, city, facility} = cell;
    const terrain = game.terrainAt(x, y);
    const captured = Boolean(base && game.capturedBy && base !== game.capturedBy);
    if (city) button.dataset.city = city.owner;
    if (facility?.kind === 'factory') button.dataset.factory = facility.owner;
    if (facility) button.dataset.facilityOwner = facility.owner;
    let friendly = game.friendlyAt(x, y);
    if (movingFriendly && movingFriendly.position.x === x && movingFriendly.position.y === y) friendly = movingFriendly.unit;
    else if (movingFriendly && friendly === movingFriendly.unit) friendly = undefined;
    const occupied = Boolean(friendly);
    const active = friendly === game.activeUnit;
    let enemy = game.enemyAt(x, y);
    if (movingEnemy && movingEnemy.position.x === x && movingEnemy.position.y === y) enemy = movingEnemy.unit;
    else if (movingEnemy && enemy === movingEnemy.unit) enemy = undefined;
    const action = friendly ? friendlyAction(friendly) : enemy ? enemyAction(enemy) : '';
    const actionInfo = unitActions[action];
    const target = !ordersLocked && enemy && game.canUnitAttack(game.activeUnit, enemy);
    const reachable = movementTargets.has(`${x},${y}`);
    const captureHere = active && game.selected && !ordersLocked && game.canCaptureHere;
    const captureTarget = captureHere || (reachable && game.playerUnit.id === 'infantry'
      && (base === 'enemy' || Boolean(facility && facility.owner !== 'friendly')));
    const progress = game.scenario && facility ? game.captureProgress(facility) : null;
    button.classList.toggle('capturing', Boolean(progress));
    if (progress) {
      button.dataset.captureSide = progress.side;
      button.style.setProperty('--capture-done', (game.maxHP - progress.points) / game.maxHP);
    } else {
      delete button.dataset.captureSide;
      button.style.removeProperty('--capture-done');
    }
    const productionReady = !ordersLocked && factory && canOpenProductionDialog && game.productionStatus(factory) === 'ready';
    productionBadge.hidden = !productionReady;
    button.classList.toggle('action-pending', pendingAction?.cell === cell);
    if (productionReady || reachable || target || captureHere) button.setAttribute('aria-haspopup', 'dialog');
    else button.removeAttribute('aria-haspopup');
    button.classList.toggle('occupied', occupied);
    button.classList.toggle('enemy', Boolean(enemy));
    button.classList.toggle('enemy-acting', Boolean(enemy && enemy === actingEnemy));
    button.classList.toggle('target', Boolean(target));
    button.classList.toggle('active-unit', active);
    button.classList.toggle('selected', !waiting && active && game.selected);
    button.classList.toggle('reachable', reachable);
    button.classList.toggle('capture-target', captureTarget);
    button.classList.toggle('captured-base', captured);
    button.classList.toggle('spent', action === 'spent' || action === 'deployed');
    const info = [occupied ? '味方' + friendly.name : enemy ? '敵' + enemy.name : '',
      base ? `${base === 'friendly' ? '味方' : '敵'}の本拠地` : '', captured ? '占領済み' : '',
      facility && !base ? `${ownerNames[facility.owner]}の${facilityNames[facility.kind]}` : '',
      terrain.name, terrain.defense ? `防御${terrain.defense}` : '',
      reachable ? `消費移動力${movementTargets.get(`${x},${y}`).cost}` : '',
      progress ? `${progress.side === 'friendly' ? '味方' : '敵'}が占領中 残り${progress.points}/${game.maxHP}` : '',
      productionReady ? '生産可能' : '', target ? '攻撃可能' : '', captureTarget ? '占領可能' : reachable ? '移動可能' : '',
      occupied || enemy ? `HP ${(friendly ?? enemy).hp}` : '', actionInfo?.label,
      !waiting && active && game.selected ? '選択中' : ''].filter(Boolean);
    button.setAttribute('aria-label', info.join('、'));
    cell.info = info.filter(item => item !== '選択中');
    button.classList.toggle('inspected', cell === inspectedCell && !waiting);
    const unit = enemy ?? friendly;
    const motion = unit && unitMotion(unit.type.id);
    image.hidden = !unit;
    idleSprite.hidden = !motion;
    button.toggleAttribute('data-static-unit', Boolean(unit && !motion));
    if (unit) {
      showImage(image, unitImage(unit.type, Boolean(enemy)));
      const {id} = unit.type;
      if (motion && idleSprite.dataset.unit !== id) {
        idleSprite.dataset.unit = id;
        idleSprite.style.setProperty('--atlas-row', motion.row);
      }
    }
    hpBadge.hidden = !mobileField || image.hidden;
    if (!hpBadge.hidden) hpBadge.textContent = (enemy ?? friendly).hp;
    actionBadge.hidden = !actionInfo?.marker;
    if (!actionBadge.hidden) {
      actionBadge.dataset.action = action;
      actionBadge.textContent = actionInfo.marker;
    }
  }
  const {movement, attackBonus, trait, firepower} = game.playerUnit;
  document.getElementById('unit-name').textContent = game.activeUnit.name;
  document.getElementById('unit-movement').textContent = movement;
  document.getElementById('unit-range').textContent = rangeLabel(game.playerUnit);
  const traitLabel = document.getElementById('unit-trait');
  traitLabel.hidden = !trait && !attackBonus;
  traitLabel.textContent = trait ? `攻撃力 ${firepower} · ${trait}` : attackBonus ? `攻撃力 ＋${attackBonus}` : '';
  showImage(document.getElementById('unit-portrait'), unitImage(game.playerUnit));
  const shownPosition = movingFriendly?.position ?? game.activeUnit;
  const position = placeName(shownPosition.x, shownPosition.y);
  document.getElementById('position').textContent = game.playerHP ? position : '—';
  document.getElementById('unit-terrain').textContent = game.playerHP ? game.terrainAt(game.x, game.y).name : '—';
  renderTurn(waiting);
  const state = document.getElementById('state');
  const message = document.getElementById('message');
  state.classList.toggle('spent', spent);
  state.classList.toggle('attack-ready', !ordersLocked && game.canAttack);
  endTurn.setAttribute('aria-disabled', String(ordersLocked));
  productionLaunch.setAttribute('aria-disabled', String(ordersLocked));
  document.getElementById('help').setAttribute('aria-disabled', String(ordersLocked));
  ordersActions.hidden = Boolean(result) && !mobileField;
  document.documentElement.classList.toggle('orders-visible', !ordersActions.hidden);
  endTurn.hidden = Boolean(result);
  productionLaunch.hidden = !canOpenProductionDialog || Boolean(result);
  replay.hidden = !result;
  renderBattleStatus();
  if (movingFriendly) {
    state.textContent = '移動中';
    message.textContent = `${friendlyName}が移動中です。`;
  } else if (result) {
    state.textContent = lost ? '敗北' : '勝利';
    if (game.capturedBy) {
      message.textContent = lost ? '敗北。敵歩兵に味方の本拠地を占領されました。'
        : '勝利！ 味方歩兵が敵の本拠地を占領しました。';
    } else {
      message.textContent = lost ? '敗北。味方部隊が全滅しました。' : '勝利！ 敵部隊をすべて撃破しました。';
    }
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = actingEnemy ? `敵${actingEnemy.name}が行動します。` : '敵部隊が行動します。';
  } else if (game.activeUnit.readyTurn > game.turn) {
    state.textContent = '生産直後';
    message.textContent = `${friendlyName}は次のターンから操作できます。`;
  } else if (captureReady) {
    state.textContent = '占領可能';
    message.textContent = game.scenario ? '「占領」の印がある敵本拠地に歩兵を移動させると占領が進みます。占領しきると勝利です。'
      : '「占領」の印がある敵本拠地に歩兵を移動させると勝利します。';
  } else if (announcedCapture && facilityCapture.points > 0) {
    const site = facilityCapture.facility === 'headquarters' ? '敵本拠地' : facilityNames[facilityCapture.facility];
    state.textContent = game.canAttack ? '攻撃可能' : '占領中';
    message.textContent = `${site}を占領中です（残り${facilityCapture.points}/${game.maxHP}）。次のターンも歩兵のマスを選んで「占領する」で続けられます。離れると最初からになります。`
      + (game.canAttack ? '印のある敵を攻撃できます。' : '');
  } else if (game.selected && game.canCaptureHere) {
    state.textContent = '占領可能';
    message.textContent = '歩兵のいるマスを選ぶと、その場で占領を続けられます。印のあるマスへ移動もできます。';
  } else if (announcedCapture) {
    const site = facilityNames[facilityCapture.facility];
    const production = game.productionSiteAt(facilityCapture.x, facilityCapture.y);
    const update = [facilityCapture.facility === 'city' ? '次のターンから収入が入ります。' : '',
      production ? 'マスが空くと生産できます。' : ''].filter(Boolean).join('');
    state.textContent = game.canAttack ? '攻撃可能' : `${site}占領`;
    message.textContent = `${site}を占領しました。${update}`
      + (game.canAttack ? '印のある敵を攻撃できます。' : '');
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const targets = game.enemyUnits.filter(enemy => game.canUnitAttack(game.activeUnit, enemy));
    const target = targets.length === 1 ? `敵${targets[0].name}` : '印のある敵';
    message.textContent = `${target}を選ぶと攻撃の結果を確認できます。`
      + (game.selected ? ' 移動するには印のあるマスを選びます。' : '');
  } else if (spent) {
    state.textContent = '行動済み';
    const action = game.attacked ? '行動を終えました。' : `${position} に移動しました。`;
    const another = game.friendlyUnits.some(unit => unit !== game.activeUnit && canAct(unit));
    message.textContent = `${friendlyName}は${action}${another ? '別の味方を選べます。' : 'ターンを終了できます。'}`;
  } else if (game.selected) {
    state.textContent = '選択中';
    message.textContent = '印のあるマスを選ぶと移動先を確認できます。敵が射程に入ると攻撃できます。';
  } else {
    state.textContent = '行動可能';
    message.textContent = `ターン ${game.turn}。動かす部隊を選んでください。`;
  }
  const inspection = inspectedCell && !waiting && !game.result ? `マス情報：${inspectedCell.info.join(' · ')}` : '';
  if (inspection) message.textContent = inspection;
  if (mobileField) {
    let summary = inspection || `${game.activeUnit.name}（${position}） · HP ${game.playerHP} · ${state.textContent}`;
    if (waiting) summary = actingEnemy ? `敵${actingEnemy.name}が行動中` : state.textContent;
    if (game.result) summary = state.textContent;
    if (fieldUnit.textContent !== summary) fieldUnit.textContent = summary;
    fieldFunds.textContent = currency.format(game.funds.friendly);
    for (const button of fieldButtons) button.setAttribute('aria-disabled', String(ordersLocked));
    fieldNextUnit.setAttribute('aria-disabled', String(ordersLocked || Boolean(result) || !nextFriendlyUnit()));
  }
}

function renderBattleStatus() {
  const report = document.getElementById('enemy-report');
  const lines = game.enemyActions.map(({enemy, friendly, from, to, captured, cityCaptured, factoryCaptured, facility, capturing, points}) => {
    const site = captured ? 'headquarters' : facility ?? (cityCaptured ? 'city' : factoryCaptured ? 'factory' : null);
    const capture = site ? `${facilityNames[site]}を占領`
      : capturing ? `${facilityNames[capturing]}を占領中（残り${points}）` : '';
    if (from.x === to.x && from.y === to.y) {
      return `敵${enemy}が${friendly ? `味方${friendly}を攻撃` : capture || '待機'}`;
    }
    const attack = friendly ? `、味方${friendly}を攻撃` : '';
    return `敵${enemy}が${placeName(to.x, to.y)}へ移動${capture ? '、' + capture : ''}${attack}`;
  });
  for (const {x, y, unit} of game.enemyProductions) {
    const name = facilityNames[game.facilityAt(x, y)?.kind];
    lines.push(`敵は${name}で${unit}を生産`);
  }
  report.hidden = lines.length === 0;
  report.textContent = lines.join('\n');
}

function showMap() {
  endCelebration();
  celebratedResult = game.result;
  if (turnChangeTimer) portraitMode.cancel(turnChangeTimer);
  turnChangeTimer = undefined;
  turnChange.hidden = true;
  pendingAction = undefined;
  highlightFriendlyRoute([]);
  productionOrigin = undefined;
  if (actionDialog.open) actionDialog.close();
  if (productionDialog.open) productionDialog.close();
  positionProductionControls();
  closeFieldDialogs();
  renderSaveStatus();
  setMobileFieldLayout();
  document.getElementById('mission-title').textContent = game.name;
  document.title = `スマホウォーズ｜${game.name}`;
  document.getElementById('coastal-legend').hidden = !game.scenario;
  music.setTurn(game.enemyTurn ? 'enemy' : 'friendly');
  music.setScene(game.result ?? 'map');
  buildFactories();
  cityEntries.length = 0;
  cityOverview.replaceChildren();
  for (const city of game.cities) {
    const label = document.createElement('span');
    cityEntries.push({city, label});
    cityOverview.append(label);
  }
  buildBoard();
  rosterEntries.length = 0;
  enemyRosterEntries.length = 0;
  roster.replaceChildren();
  enemyRoster.replaceChildren();
  setBoardTabStop(friendlyTile());
  render();
  // Read the layout in the next frame, once the board and its units are in place, so
  // building the board and laying it out are not one long task. It still runs before
  // the first paint, so the map does not visibly jump.
  const shownGame = game;
  requestAnimationFrame(() => {
    if (game !== shownGame) return;
    updateMapScrollNote();
    mapSurround.scrollLeft = 0;
    mapSurround.scrollTop = 0;
    revealTile(friendlyTile(), mobileField);
    if (game.enemyTurn) runEnemyTurn(false);
  });
}

function revealTile(button, center = false) {
  const viewport = mapSurround.getBoundingClientRect();
  const tile = button.getBoundingClientRect();
  const visibleLeft = viewport.left;
  const visibleRight = viewport.left + mapSurround.clientWidth;
  const visibleTop = viewport.top;
  const bottom = viewport.top + mapSurround.clientHeight;
  if (center) {
    mapSurround.scrollLeft += (tile.left + tile.right - visibleLeft - visibleRight) / 2;
    mapSurround.scrollTop += (tile.top + tile.bottom - visibleTop - bottom) / 2;
    return;
  }
  if (tile.top < visibleTop) mapSurround.scrollTop += tile.top - visibleTop - 8;
  if (tile.bottom > bottom) mapSurround.scrollTop += tile.bottom - bottom + 8;
  if (tile.left < visibleLeft) mapSurround.scrollLeft += tile.left - visibleLeft - 12;
  if (tile.right > visibleRight) mapSurround.scrollLeft += tile.right - visibleRight + 12;
}

function updateMapScrollNote() {
  mapScrollNote.hidden = mapSurround.scrollWidth <= mapSurround.clientWidth && mapSurround.scrollHeight <= mapSurround.clientHeight;
}

function closeFieldDialogs() {
  for (const dialog of fieldDialogs) if (dialog.open) dialog.close();
}

function setMobileFieldLayout() {
  const enabled = compactControls.matches && canOpenProductionDialog;
  if (portraitMode.blocked || mobileField === enabled) return false;
  closeFieldDialogs();
  mobileField = enabled;
  main.toggleAttribute('data-mobile-field', enabled);
  document.documentElement.classList.toggle('mobile-field', enabled);
  fieldStatus.hidden = !enabled;
  fieldTools.hidden = !enabled || !enemyPreview.hidden;
  for (const {content, placeholder, target} of fieldSections) {
    if (enabled) target.append(content);
    else placeholder.after(content);
  }
  return true;
}

function drawOverview() {
  overviewGrid.style.setProperty('--columns', game.width);
  overviewGrid.style.setProperty('--rows', game.height);
  const spots = cells.map(({button, base, facility}) => {
    const spot = document.createElement('span');
    spot.className = 'overview-cell';
    spot.setAttribute('aria-hidden', 'true');
    spot.dataset.terrain = button.dataset.terrain;
    if (base) spot.dataset.base = base;
    if (facility) spot.dataset.facility = facility.owner;
    if (button.classList.contains('occupied')) spot.dataset.side = 'friendly';
    if (button.classList.contains('enemy')) spot.dataset.side = 'enemy';
    return spot;
  });
  overviewGrid.replaceChildren(...spots, overviewWindow);
}

function updateOverviewWindow() {
  if (!fieldOverview.open || portraitMode.blocked) return;
  const viewport = mapSurround.getBoundingClientRect();
  const map = board.getBoundingClientRect();
  const left = Math.max(0, viewport.left - map.left);
  const top = Math.max(0, viewport.top - map.top);
  const right = Math.min(map.width, viewport.left + mapSurround.clientWidth - map.left);
  const bottom = Math.min(map.height, viewport.top + mapSurround.clientHeight - map.top);
  overviewWindow.style.left = `${left / map.width * 100}%`;
  overviewWindow.style.top = `${top / map.height * 100}%`;
  overviewWindow.style.width = `${(right - left) / map.width * 100}%`;
  overviewWindow.style.height = `${(bottom - top) / map.height * 100}%`;
}

function jumpToFieldLocation({x, y}) {
  if (!fieldOverview.open || portraitMode.blocked) return;
  fieldOverview.close();
  const tile = cells[y * game.width + x].button;
  tile.focus({preventScroll: true});
  revealTile(tile, true);
}

// Only the previous and the new tab stop change, instead of rewriting every tile.
let boardTabStop = null;
function setBoardTabStop(button) {
  if (boardTabStop === button && button?.tabIndex === 0) return;
  if (!boardTabStop || !boardTabStop.isConnected) {
    for (const cell of cells) if (cell.button !== button && cell.button.tabIndex !== -1) cell.button.tabIndex = -1;
  } else {
    boardTabStop.tabIndex = -1;
  }
  if (button) button.tabIndex = 0;
  boardTabStop = button;
}

// Every tile shares one template and one set of board listeners, so building a map
// clones nodes instead of creating ~3,300 elements and ~940 listeners one by one.
const tileTemplate = (() => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  button.append(image);
  for (const name of ['map-idle', 'map-hp', 'unit-action', 'tile-production', 'capture-meter']) {
    const part = document.createElement('span');
    part.className = name;
    part.setAttribute('aria-hidden', 'true');
    if (name === 'tile-production') part.textContent = '生産';
    button.append(part);
  }
  return button;
})();
const cellOfButton = new WeakMap();
const boardCell = (target) => {
  const button = target instanceof Element ? target.closest('.tile') : null;
  return button && button.parentElement === board ? cellOfButton.get(button) : undefined;
};
board.addEventListener('focusin', (event) => {
  const cell = boardCell(event.target);
  if (cell) setBoardTabStop(cell.button);
});
board.addEventListener('click', (event) => {
  const cell = boardCell(event.target);
  if (!cell || inputBlocked()) return;
  const {x, y, factory} = cell;
  inspectedCell = null;
  if (factory && game.productionStatus(factory) === 'ready' && openProduction(event, cell)) return;
  if (game.selected && game.friendlyAt(x, y) === game.activeUnit && previewCaptureHere(cell, event)) return;
  if (previewAction(cell, event)) return;
  if (!game.friendlyAt(x, y)) {
    inspectedCell = cell;
    render();
    return;
  }
  game.choose(x, y);
  saveProgress();
  render();
});
board.addEventListener('keydown', (event) => {
  const cell = boardCell(event.target);
  if (!cell || portraitMode.blocked) return;
  const offsets = {ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1]};
  if (!Object.hasOwn(offsets, event.key)) return;
  event.preventDefault();
  const [dx, dy] = offsets[event.key];
  const nextX = Math.max(0, Math.min(game.width - 1, cell.x + dx));
  const nextY = Math.max(0, Math.min(game.height - 1, cell.y + dy));
  const next = cells[nextY * game.width + nextX].button;
  next.focus({preventScroll: true});
  revealTile(next);
});

function buildBoard() {
  cells.length = 0;
  const {width, height} = game;
  mapSurround.style.setProperty('--columns', width);
  mapSurround.style.setProperty('--rows', height);
  board.setAttribute('aria-label', `${width}列${height}行の作戦マップ`);
  document.getElementById('dimensions').textContent = `${width} × ${height}`;
  const tiles = document.createDocumentFragment();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.append(addTile(x, y));
  }
  board.replaceChildren(tiles);
  window.MapArt?.paintBoard(board, game);
}

function addTile(x, y) {
  const button = tileTemplate.cloneNode(true);
  const [image, idleSprite, hpBadge, actionBadge, productionBadge] = button.children;
  const base = game.headquartersAt(x, y);
  const facility = game.facilityAt(x, y);
  const factory = game.productionSiteAt(x, y);
  const city = facility?.kind === 'city' ? facility : null;
  const terrain = game.terrainAt(x, y).id;
  button.dataset.terrain = terrain;
  if (terrain === 'river' || terrain === 'bridge') drawWater(button, x, y);
  if (base) button.dataset.base = base;
  if (facility) button.dataset.facilityKind = facility.kind;
  if (x === game.width - 1) button.classList.add('last-column');
  if (y === game.height - 1) button.classList.add('last-row');
  idleSprite.style.setProperty('--idle-delay', `${-(x * 371 + y * 587) % 1600}ms`);
  const cell = {x, y, button, image, idleSprite, hpBadge, actionBadge, productionBadge, base, factory, city, facility};
  cellOfButton.set(button, cell);
  cells.push(cell);
  return button;
}

function repeatedTap(event, opener) {
  return event.detail > 0 && opener?.detail > 0 && event.timeStamp - opener.timeStamp < 320
    && Math.hypot(event.clientX - opener.clientX, event.clientY - opener.clientY) < 24;
}

function drawWater(tile, x, y) {
  const directions = [[0,-1], [1,0], [0,1], [-1,0]];
  let bank = 0;
  for (const [index, [dx, dy]] of directions.entries()) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= game.width || ny < 0 || ny >= game.height) continue;
    const id = game.terrainAt(nx, ny).id;
    if (id === 'river' || id === 'bridge') bank |= 1 << index;
  }
  if (y === 0 && (bank & 4)) bank |= 1;
  if (y === game.height - 1 && (bank & 1)) bank |= 4;
  const surface = document.createElement('span');
  surface.className = 'water-surface';
  surface.setAttribute('aria-hidden', 'true');
  surface.style.setProperty('--shore-row', `${bank / 15 * 100}%`);
  tile.prepend(surface);
}

function highlightFriendlyRoute(path) {
  for (const tile of markedFriendlyTiles) tile.classList.remove('friendly-route');
  markedFriendlyTiles = path.map(tileAt);
  for (const tile of markedFriendlyTiles) tile.classList.add('friendly-route');
}

// The moving sprite's tile is marked with a class (cheaper to restyle than :has()).
function clearStride() {
  strideSprite?.parentElement?.classList.remove('striding');
  strideSprite?.remove();
}

function showStride(unit, from, to, enemy, duration) {
  clearStride();
  const motion = unitMotion(unit.type.id);
  if ((motion && !board.classList.contains('map-march-ready')) || reducedMapMotion.matches
    || (from.x === to.x && from.y === to.y)) return;
  const tile = tileAt(to);
  const shell = document.createElement('span');
  const sprite = document.createElement(motion ? 'span' : 'img');
  shell.className = 'map-stride';
  shell.dataset.unit = unit.type.id;
  shell.dataset.domain = unit.type.domain ?? 'land';
  shell.setAttribute('aria-hidden', 'true');
  sprite.className = 'map-stride-sprite';
  if (motion) {
    const atlasRow = motion.row + (enemy ? 4 : 0);
    shell.style.setProperty('--atlas-row', `${atlasRow / 7 * 100}%`);
  } else {
    shell.setAttribute('data-static', '');
    sprite.src = unitImage(unit.type, enemy, 'right');
    sprite.alt = '';
  }
  shell.style.setProperty('--stride-x', `${(from.x - to.x) * 100}%`);
  shell.style.setProperty('--stride-y', `${(from.y - to.y) * 100}%`);
  shell.style.setProperty('--stride-duration', `${duration}ms`);
  shell.style.setProperty('--facing', from.x > to.x || (from.x === to.x && enemy) ? '-1' : '1');
  shell.append(sprite);
  tile.append(shell);
  tile.classList.add('striding');
  strideSprite = shell;
}

function flashMapTile(position, effect, text = '') {
  if (reducedMapMotion.matches) return;
  const marker = document.createElement('span');
  marker.className = 'map-feedback';
  marker.dataset.effect = effect;
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = text;
  tileAt(position).append(marker);
  portraitMode.schedule(() => marker.remove(), 780);
}

function animateFriendlyMove(unit, from, path, onComplete) {
  const duration = mapUnitMotion[unit.type.id]?.step ?? 80;
  function advance(index, previous) {
    const position = path[index];
    if (!position || reducedMapMotion.matches) {
      clearStride();
      movingFriendly = null;
      highlightFriendlyRoute([]);
      onComplete();
      return;
    }
    movingFriendly = {unit, position};
    render();
    revealTile(tileAt(position));
    showStride(unit, previous, position, false, duration);
    portraitMode.schedule(() => advance(index + 1, position), duration);
  }
  advance(0, from);
}

function previewCaptureHere(cell, opener) {
  const unit = game.activeUnit;
  if (!game.canCaptureHere || unit.x !== cell.x || unit.y !== cell.y) return false;
  actionTitle.textContent = '占領を確認';
  actionSummary.textContent = `${unit.name}（HP ${unit.hp}）  ${placeName(cell.x, cell.y)}`;
  actionDetail.textContent = captureForecast(cell.facility, unit);
  actionConfirm.textContent = '占領する';
  pendingAction = {cell, unit, enemy: null, opener, captureHere: true};
  highlightFriendlyRoute([]);
  cell.button.classList.add('action-pending');
  actionDialog.showModal();
  return true;
}

function previewAction(cell, opener) {
  const {x, y, base, facility} = cell;
  const unit = game.activeUnit;
  const enemy = game.enemyAt(x, y);
  const strikes = game.previewAttack(enemy);
  let path = [];
  const destination = placeName(x, y);
  let verb;
  if (strikes.length) {
    const [hit, counter] = strikes;
    verb = '攻撃';
    actionSummary.textContent = `${unit.name} → 敵${enemy.name}`;
    const reply = counter ? `反撃で味方 HP ${unit.hp} → ${counter.playerHP}` : '反撃なし';
    actionDetail.textContent = `戦力 ${Math.round(unit.hp / game.maxHP * 100)}% ／ 敵 HP ${enemy.hp} → ${hit.enemyHP} ／ ${reply}`;
  } else {
    const route = game.movementTargets().get(`${x},${y}`);
    if (!route) return false;
    path = routeSteps(route);
    let capture = '';
    if (unit.type.id === 'infantry') {
      if (base === 'enemy' && !game.scenario) capture = '敵本拠地を占領すると勝利';
      else if (facility && facility.owner !== 'friendly') capture = captureForecast(facility, unit);
    }
    verb = capture ? '占領' : '移動';
    actionSummary.textContent = `${unit.name}  ${placeName(unit.x, unit.y)} → ${destination}`;
    actionDetail.textContent = [game.terrainAt(x, y).name, `移動力 ${route.cost} 消費`, capture].filter(Boolean).join(' ／ ');
  }
  actionTitle.textContent = `${verb}を確認`;
  actionConfirm.textContent = `${verb}する`;
  pendingAction = {cell, unit, enemy: strikes.length ? enemy : null, opener};
  highlightFriendlyRoute(path);
  cell.button.classList.add('action-pending');
  actionDialog.showModal();
  return true;
}

actionConfirm.addEventListener('click', (event) => {
  if (!pendingAction || inputBlocked() || repeatedTap(event, pendingAction.opener)) return;
  const {cell, unit, enemy, captureHere} = pendingAction;
  const {x, y, factory} = cell;
  if (captureHere) {
    pendingAction = undefined;
    cell.button.classList.remove('action-pending');
    actionDialog.close();
    if (unit !== game.activeUnit || !game.canCaptureHere) return;
    const step = game.captureHere();
    if (step?.completed && factory) selectedFactory = factory;
    saveProgress();
    render();
    restoreBoardFocus();
    celebrateCapture(step, 'friendly');
    return;
  }
  const route = enemy ? null : game.movementTargets().get(`${x},${y}`);
  if (unit !== game.activeUnit || (enemy
    ? enemy !== game.enemyAt(x, y) || !game.canUnitAttack(unit, enemy)
    : !route)) {
    actionDialog.close();
    return;
  }
  pendingAction = undefined;
  cell.button.classList.remove('action-pending');
  actionDialog.close();
  if (enemy) {
    presentAttack({attacker: 'player', enemy, resolve: () => game.choose(x, y)});
    return;
  }
  const capturedFactory = factory && factory.owner !== 'friendly';
  const previousCapture = game.friendlyCapture;
  const from = {x: unit.x, y: unit.y};
  game.choose(x, y);
  if (capturedFactory && factory.owner === 'friendly') selectedFactory = factory;
  saveProgress();
  const captured = game.capturedBy === 'friendly' || game.friendlyCapture !== previousCapture;
  const step = captured ? {site: cell.facility, points: game.friendlyCapture?.points ?? 0,
    completed: game.capturedBy === 'friendly' || !(game.friendlyCapture?.points > 0)} : null;
  animateFriendlyMove(unit, from, routeSteps(route), () => {
    restoreBoardFocus();
    if (captured) flashMapTile(cell, 'capture');
    if (step) celebrateCapture(step, 'friendly');
  });
});

actionDialog.addEventListener('close', () => {
  if (actionDialog.open || !pendingAction) return;
  const {button} = pendingAction.cell;
  pendingAction = undefined;
  highlightFriendlyRoute([]);
  button.classList.remove('action-pending');
  button.focus({preventScroll: true});
});

endTurn.addEventListener('click', (event) => {
  if (event.detail > 1 || inputBlocked() || !game.beginEnemyTurn()) return;
  inspectedCell = null;
  playerScrollTop = window.scrollY;
  saveProgress();
  music.setTurn('enemy');
  render();
  announceTurn('enemy', runEnemyTurn);
});

function openEnemyMenu(menu, title, choices) {
  enemyPreview.hidden = false;
  fieldTools.hidden = true;
  enemyPreview.dataset.menu = menu;
  enemyPreviewTitle.textContent = title;
  enemyPreviewChoices.replaceChildren(...choices.map(({id, label, cost}) => {
    const item = document.createElement('li');
    item.dataset.choice = id;
    item.textContent = label;
    if (cost !== undefined) {
      const price = document.createElement('small');
      price.textContent = currency.format(cost);
      item.append(price);
    }
    return item;
  }));
}

function showEnemyChoice(stage, selected, detail) {
  enemyPreview.dataset.stage = stage;
  enemyPreviewDetail.textContent = detail;
  for (const item of enemyPreviewChoices.children) {
    if (item.dataset.choice === selected) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  }
}

function highlightEnemyRoute(path, destination) {
  for (const tile of markedEnemyTiles) tile.classList.remove('enemy-route', 'enemy-destination', 'enemy-spawned');
  markedEnemyTiles = path.map(tileAt);
  for (const tile of markedEnemyTiles) tile.classList.add('enemy-route');
  if (destination) {
    const target = tileAt(destination);
    markedEnemyTiles.push(target);
    target.classList.add('enemy-destination');
  }
}

function followEnemy(position) {
  enemyPositionInView = position;
  const tile = tileAt(position);
  revealTile(tile);
  if (!mobileField) tile.scrollIntoView({block: 'nearest', inline: 'nearest'});
}

function playEnemyAction(action, restoreFocus) {
  const {enemy, from, to, path, friendly} = action;
  const site = game.facilityAt(to.x, to.y);
  const capture = enemy.type.id === 'infantry' && (game.headquartersAt(to.x, to.y) === 'friendly' || (site && site.owner !== 'enemy'));
  const commands = [];
  if (path.length) commands.push({id: 'move', label: '移動'});
  if (capture) commands.push({id: 'capture', label: '占領'});
  if (friendly) commands.push({id: 'attack', label: '攻撃'});
  if (!commands.length) commands.push({id: 'wait', label: '待機'});
  const origin = placeName(from.x, from.y);
  const destination = placeName(to.x, to.y);
  openEnemyMenu('action', `敵${enemy.name}　${origin}${path.length ? ` → ${destination}` : ''}`, commands);
  const commandDetail = {move: `${destination} へ移動`, capture: `${destination} を占領`,
    attack: friendly ? `味方${friendly.name}を攻撃` : '', wait: 'その場で待機'};
  const fast = Boolean(game.scenario);
  const steps = commands.flatMap(({id}) => id === 'move'
    ? [{id, position: from, delay: fast ? 70 : 200}, ...path.map(position => ({
      id, position, delay: fast ? 60 : mapUnitMotion[enemy.type.id].step,
    }))]
    : [{id, position: to, delay: fast ? 100 : 260}]);
  highlightEnemyRoute(path, to);

  function advance(index, previous = from) {
    const step = steps[index];
    if (step) {
      movingEnemy = {unit: enemy, position: step.position};
      showEnemyChoice(step.id, step.id, commandDetail[step.id]);
      render();
      followEnemy(step.position);
      showStride(enemy, previous, step.position, true, step.delay);
      portraitMode.schedule(() => advance(index + 1, step.position), step.delay);
      return;
    }
    clearStride();
    movingEnemy = null;
    highlightEnemyRoute([]);
    if (friendly) {
      presentAttack({attacker: 'enemy', enemy, friendly, enemyPosition: to,
        resolve: () => game.resolveEnemyAction(action), onReturn: runEnemyTurn});
      return;
    }
    game.resolveEnemyAction(action);
    saveProgress();
    const resolved = game.enemyActions.at(-1);
    if (resolved?.captured || resolved?.cityCaptured || resolved?.factoryCaptured || resolved?.facility) flashMapTile(to, 'capture');
    if (game.scenario && (resolved?.captured || resolved?.facility)) {
      celebrateCapture({site: game.facilityAt(to.x, to.y), points: 0, completed: true}, 'enemy');
    }
    runEnemyTurn(restoreFocus);
  }
  advance(0);
}

function playEnemyProduction(order, restoreFocus) {
  const {factory, type} = order;
  openEnemyMenu('production', `敵の${facilityNames[factory.kind]}`,
    game.productionChoices(factory).map(({id, name, cost}) => ({id, label: name, cost})));
  showEnemyChoice('factory', null, `資金 ${currency.format(game.funds.enemy)}`);
  highlightEnemyRoute([], factory);
  render();
  followEnemy(factory);
  portraitMode.schedule(() => {
    showEnemyChoice('selection', type.id, `${type.name}を選択　−${currency.format(type.cost)}`);
    portraitMode.schedule(() => {
      const unit = game.produceEnemyUnit(order);
      if (!unit) {
        runEnemyTurn(restoreFocus);
        return;
      }
      saveProgress();
      showEnemyChoice('deploy', type.id, `${unit.name}が出撃`);
      render();
      tileAt(factory).classList.add('enemy-spawned');
      flashMapTile(factory, 'deploy');
      portraitMode.schedule(() => runEnemyTurn(restoreFocus), 320);
    }, 240);
  }, 170);
}

function runEnemyTurn(restoreFocus = true) {
  const action = game.prepareEnemyAction();
  if (action) {
    playEnemyAction(action, restoreFocus);
    return;
  }
  const order = game.planEnemyProduction();
  if (order) {
    playEnemyProduction(order, restoreFocus);
    return;
  }
  game.finishEnemyTurn();
  saveProgress();
  if (!game.result) music.setTurn('friendly');
  enemyPreview.hidden = true;
  fieldTools.hidden = !mobileField;
  highlightEnemyRoute([]);
  enemyPositionInView = null;
  if (playerScrollTop !== null) window.scrollTo(0, playerScrollTop);
  playerScrollTop = null;
  restoreBoardFocus(restoreFocus);
  if (!game.result) announceTurn('friendly', () => {
    for (const {side, unit, amount} of game.facilityHealing) {
      const units = side === 'friendly' ? game.friendlyUnits : game.enemyUnits;
      const healed = units.find(candidate => candidate.name === unit);
      if (healed) flashMapTile(healed, 'heal', `+${amount} HP`);
    }
  });
}

function presentAttack({attacker, friendly = game.activeUnit, enemy, enemyPosition = enemy, resolve, onReturn = restoreBoardFocus}) {
  combatScreen.open({
    map: game, attacker, friendly, enemy, enemyPosition,
    resolve: () => {
      const strikes = resolve();
      saveProgress();
      return strikes;
    },
    onReturn,
  });
}

function restoreBoardFocus(restoreFocus = true) {
  const tile = friendlyTile();
  setBoardTabStop(tile);
  render();
  if (game.capturedBy) music.setScene(game.result);
  if (!restoreFocus || document.getElementById('guide').open) return;
  if (!game.result) revealTile(tile);
  const control = game.result ? replay : tile;
  control.focus({preventScroll: !game.capturedBy});
}

endTurn.addEventListener('keydown', (event) => {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
});
function showOverview() {
  if (portraitMode.blocked || waitingForEnemy() || movingFriendly || combatScreen.active || fieldOverview.open) return;
  drawOverview();
  fieldOverview.showModal();
  updateOverviewWindow();
}

document.getElementById('desktop-overview').addEventListener('click', showOverview);
for (const [index, button] of fieldButtons.entries()) {
  const dialog = fieldDialogs[index];
  button.addEventListener('click', () => {
    if (!mobileField || portraitMode.blocked || waitingForEnemy() || movingFriendly || combatScreen.active || dialog.open) return;
    if (dialog === fieldOverview) showOverview();
    else dialog.showModal();
  });
}
fieldNextUnit.addEventListener('click', () => {
  if (!mobileField || inputBlocked()) return;
  const unit = nextFriendlyUnit();
  if (unit) selectFriendlyUnit(unit);
});
overviewGrid.addEventListener('click', event => {
  if (!event.detail) {
    jumpToFieldLocation(game.activeUnit);
    return;
  }
  const rect = overviewGrid.getBoundingClientRect();
  const x = Math.max(0, Math.min(game.width - 1, Math.floor((event.clientX - rect.left) / rect.width * game.width)));
  const y = Math.max(0, Math.min(game.height - 1, Math.floor((event.clientY - rect.top) / rect.height * game.height)));
  jumpToFieldLocation({x, y});
});
for (const button of fieldOverview.querySelectorAll('[data-jump]')) {
  button.addEventListener('click', () => {
    const destination = button.dataset.jump;
    jumpToFieldLocation(destination === 'unit' ? game.activeUnit : game.headquarters[destination]);
  });
}
mapSurround.addEventListener('scroll', updateOverviewWindow, {passive: true});
productionLaunch.addEventListener('click', event => {
  if (!productionLaunch.hidden && compactControls.matches) openProduction(event);
});

function openProduction(event, cell) {
  if (!canOpenProductionDialog || inputBlocked() || productionDialog.open) return false;
  if (cell) selectedFactory = cell.factory;
  productionOrigin = {event, cell};
  positionProductionControls(true);
  renderProduction();
  productionDialog.showModal();
  productionDialog.scrollTop = 0;
  return true;
}

productionMove.addEventListener('click', event => {
  const cell = productionOrigin?.cell;
  if (!cell || inputBlocked() || repeatedTap(event, productionOrigin.event) || !game.canMoveTo(cell.x, cell.y)) return;
  productionDialog.close();
  previewAction(cell, event);
});

productionDialog.addEventListener('close', () => {
  if (productionDialog.open || !productionOrigin) return;
  const {cell} = productionOrigin;
  productionOrigin = undefined;
  positionProductionControls();
  renderProduction();
  if (cell && !actionDialog.open && !portraitMode.blocked) cell.button.focus({preventScroll: true});
});

function positionProductionControls(opening = false) {
  const inDialog = productionControls.parentElement === productionDialog;
  const useDialog = compactControls.matches || productionDialog.open || opening;
  if (!canOpenProductionDialog || portraitMode.blocked || useDialog === inDialog) return;
  if (useDialog) {
    const hadFocus = productionControls.contains(document.activeElement);
    productionDialog.prepend(productionControls);
    if (!opening && hadFocus && !ordersActions.hidden) productionLaunch.focus({preventScroll: true});
  } else {
    const hadFocus = productionDialog.contains(document.activeElement) || document.activeElement === productionLaunch;
    ordersActions.before(productionControls);
    if (hadFocus && !ordersActions.hidden) endTurn.focus({preventScroll: true});
  }
}
document.getElementById('help').addEventListener('click', () => {
  if (portraitMode.blocked || game.enemyTurn || movingFriendly) return;
  document.getElementById('play-coastal').hidden = Boolean(game.scenario);
  document.getElementById('play-legacy').hidden = !game.scenario || !openScenario('legacy').restored;
  guide.showModal();
  guide.scrollTop = 0;
});

function switchScenario(id) {
  if (portraitMode.blocked || game.enemyTurn || movingFriendly || combatScreen.active) return;
  const {save, restored} = openScenario(id);
  if (!restored && id === 'legacy') return;
  crossingSave = save;
  game = restored ?? new BattleMap(id);
  currentScenario = id;
  try {
    window.localStorage.setItem(scenarioPreference, id);
  } catch {
    // The selected map is still available for this visit.
  }
  guide.close();
  saveProgress();
  showMap();
  friendlyTile().focus({preventScroll: true});
}

document.getElementById('play-coastal').addEventListener('click', () => switchScenario('coastal'));
document.getElementById('play-legacy').addEventListener('click', () => switchScenario('legacy'));
replay.addEventListener('click', () => {
  if (portraitMode.blocked || combatScreen.active || game.enemyTurn || !game.result) return;
  if (currentScenario === 'legacy') {
    switchScenario('coastal');
    return;
  }
  game = new BattleMap(currentScenario);
  saveProgress();
  showMap();
  friendlyTile().focus();
});
function resizeGame() {
  const focused = document.activeElement;
  positionProductionControls();
  if (setMobileFieldLayout()) {
    render();
    if (mobileField) {
      if (!enemyPositionInView) revealTile(friendlyTile(), true);
    } else if (fieldTools.contains(focused) || fieldDialogs.some(dialog => dialog.contains(focused))) {
      document.getElementById('mission-title').focus({preventScroll: true});
    }
  }
  if (enemyPositionInView && !portraitMode.blocked && !combatScreen.active) followEnemy(enemyPositionInView);
  if (movingFriendly && !portraitMode.blocked) revealTile(tileAt(movingFriendly.position));
  updateMapScrollNote();
  updateOverviewWindow();
}
window.addEventListener('resize', resizeGame);
compactControls.addEventListener('change', resizeGame);
portraitMode.onChange(resizeGame);
showMap();
for (const atlas of ['map-idle', 'map-march']) {
  const image = new Image();
  image.src = `./assets/${atlas}.png?v=map-unit-motion`;
  image.decode().then(() => board.classList.add(atlas + '-ready')).catch(() => {
    // Keep the static sprite if the animation could not load.
  });
}
document.addEventListener('visibilitychange', () => board.toggleAttribute('data-map-hidden', document.hidden));
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(updateMapScrollNote).observe(mapSurround);
}
