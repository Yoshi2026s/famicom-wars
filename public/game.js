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
// The CPU strength chosen for the last new match, used again for the next one.
const levelPreference = 'sumaho-wars:difficulty';
function preferredLevel() {
  try {
    const level = window.localStorage.getItem(levelPreference);
    return BattleMap.difficulties.includes(level) ? level : 'normal';
  } catch {
    return 'normal';
  }
}
game ??= BattleMap.newMatch(currentScenario, undefined, {difficulty: preferredLevel()});
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
  acting: {label: '行動中', marker: '動'}, moving: {label: '移動中', marker: '動'},
  staged: {label: '確定待ち', marker: '仮'}, defeated: {label: '撃破'}, ended: {label: '対戦終了'},
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
let detailUnit = null;
let shownDetail = null;
const unitDetail = document.getElementById('unit-detail');
const moveConfirm = document.getElementById('move-confirm');
const titleScreen = document.getElementById('title-screen');
const titleResume = document.getElementById('title-resume');
const titleResumeDetail = document.getElementById('title-resume-detail');
const titleNew = document.getElementById('title-new');
const gameMenu = document.getElementById('game-menu');
const menuSurrender = document.getElementById('menu-surrender');
const menuConfirm = document.getElementById('menu-confirm');
const menuConfirmTitle = document.getElementById('menu-confirm-title');
const menuConfirmText = document.getElementById('menu-confirm-text');
const menuConfirmOk = document.getElementById('menu-confirm-ok');
const moveConfirmRoute = document.getElementById('move-confirm-route');
const moveConfirmHint = document.getElementById('move-confirm-hint');
const moveCommit = document.getElementById('move-commit');
const moveCancel = document.getElementById('move-cancel');
const detailOpeners = [document.getElementById('field-detail'), document.getElementById('panel-detail')];
const domainNames = {land: '地上部隊', air: '航空部隊', sea: '艦船'};
const targetNames = {land: '地上', sea: '艦船', air: '航空'};
const newMatchDialog = document.getElementById('new-match-dialog');
const levelNames = {easy: 'やさしい', normal: 'ふつう', hard: 'つよい'};
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

const captureBenefit = {city: '収入が増えます', oilfield: '収入が大きく増えます', depot: '全部隊を半額で回復できます',
  fortress: '収入が増え、中の地上部隊が防御3になります', hospital: '地上部隊が毎ターン最大3回復します'};
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
    side === 'friendly' ? captureBenefit[step.site.kind] ?? '生産・補給に使えます' : '取り返しましょう', 1700);
}

function celebrateResult() {
  if (!game.result || celebratedResult === game.result) return;
  celebratedResult = game.result;
  const win = game.result === 'victory';
  const reason = game.surrendered ? '降伏した' : game.capturedBy ? (win ? '敵本拠地を占領' : '本拠地を占領された') : (win ? '敵部隊を全滅' : '味方部隊が全滅');
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

// A staged move only accepts its own confirm/cancel buttons and attacks from the new tile.
function inputBlocked(allowStaged = false) {
  return (!allowStaged && Boolean(game.stagedMove)) || portraitMode.blocked || combatScreen.active || waitingForEnemy() || Boolean(movingFriendly || game.result);
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
  if (game.stagedMove?.unit === unit) return 'staged';
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

let productionNotice = '';
productionDialog.addEventListener('close', () => { productionNotice = ''; });
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
    if (!button.hidden) {
      // Sites that already produced (or are blocked) this turn are marked so the next one is easy to find.
      const state = game.productionStatus(factory);
      button.textContent = siteLabel(factory);
      button.dataset.state = state;
      if (state === 'used') button.setAttribute('aria-label', `${siteLabel(factory)}（生産済み）`);
      else button.removeAttribute('aria-label');
    }
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
  if (status !== 'ready') productionNotice = '';
  const note = productionNotice || labels[status];
  if (productionStatus.textContent !== note) productionStatus.textContent = note;
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
      const site = selectedFactory;
      const unit = game.produce(type.id, site);
      if (!unit) return;
      // From the picker, move on to the next site that can still produce this turn.
      if (!productionOrigin?.cell) {
        const owned = game.productionSites.filter(other => other.owner === 'friendly');
        const start = owned.indexOf(site);
        const next = [...owned.slice(start + 1), ...owned.slice(0, start)].find(other => game.productionStatus(other) === 'ready');
        if (next) {
          selectedFactory = next;
          productionNotice = `${siteLabel(site)}で${unit.name}を生産しました（−${currency.format(site.production.cost)}）。続けて${siteLabel(next)}で生産できます。`;
        }
      }
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
      productionNotice = '';
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
  const restored = game.facilityHealing.map(({side, unit, amount, facility, cost}) => {
    const site = facilityNames[facility];
    return `${ownerNames[side]}${unit}（${site}） +${amount} HP${cost ? `（${currency.format(cost)}）` : ''}`;
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
  const captureReady = capturesSites(game.playerUnit) && movementTargets.has(`${enemyBase.x},${enemyBase.y}`);
  const actingEnemy = game.enemyTurn?.action?.enemy;
  const actedEnemies = new Set(waiting ? game.enemyActions.map(action => action.enemy) : []);
  const enemyAction = unit => {
    if (!unit.hp) return 'defeated';
    if (waiting && unit.readyTurn > game.turn) return 'deployed';
    if (unit === actingEnemy) return 'acting';
    return actedEnemies.has(unit.name) ? 'spent' : '';
  };
  if (detailUnit && (!detailUnit.hp || waiting || movingFriendly || game.result
    || ![...game.friendlyUnits, ...game.enemyUnits].includes(detailUnit))) detailUnit = null;
  const detailReach = detailUnit ? game.unitReach(detailUnit) : null;
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
    const captureTarget = captureHere || (reachable && capturesSites(game.playerUnit)
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
    setHidden(productionBadge, !productionReady);
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
      terrain.name, game.coverAt(x, y) ? `防御${game.coverAt(x, y)}` : '',
      reachable ? `消費移動力${movementTargets.get(`${x},${y}`).cost}` : '',
      progress ? `${progress.side === 'friendly' ? '味方' : '敵'}が占領中 残り${progress.points}/${game.maxHP}` : '',
      productionReady ? '生産可能' : '', target ? '攻撃可能' : '', captureTarget ? '占領可能' : reachable ? '移動可能' : '',
      occupied || enemy ? `HP ${(friendly ?? enemy).hp}` : '', actionInfo?.label,
      !waiting && active && game.selected ? '選択中' : ''].filter(Boolean);
    button.setAttribute('aria-label', info.join('、'));
    cell.info = info.filter(item => item !== '選択中');
    button.classList.toggle('inspected', cell === inspectedCell && !waiting);
    button.classList.toggle('detail-move', Boolean(detailReach?.move.has(`${x},${y}`)));
    button.classList.toggle('detail-attack', Boolean(detailReach?.attack.has(`${x},${y}`)));
    const unit = enemy ?? friendly;
    const motion = unit && unitMotion(unit.type.id);
    setHidden(image, !unit);
    setHidden(idleSprite, !motion);
    button.toggleAttribute('data-static-unit', Boolean(unit && !motion));
    if (unit) {
      showImage(image, unitImage(unit.type, Boolean(enemy)));
      const {id} = unit.type;
      if (motion && idleSprite.dataset.unit !== id) {
        idleSprite.dataset.unit = id;
        idleSprite.style.setProperty('--atlas-row', motion.row);
      }
    }
    setHidden(hpBadge, !mobileField || image.hidden);
    if (!hpBadge.hidden) hpBadge.textContent = (enemy ?? friendly).hp;
    setHidden(actionBadge, !actionInfo?.marker);
    if (!actionBadge.hidden) {
      actionBadge.dataset.action = action;
      actionBadge.textContent = actionInfo.marker;
    }
  }
  // Before the first unit is produced there is no unit to describe.
  const noUnit = Boolean(game.activeUnit.standby);
  const {movement, attackBonus, trait, firepower} = game.playerUnit;
  document.getElementById('unit-name').textContent = noUnit ? '部隊なし' : game.activeUnit.name;
  document.getElementById('unit-movement').textContent = noUnit ? '—' : movement;
  document.getElementById('unit-range').textContent = noUnit ? '—' : rangeLabel(game.playerUnit);
  const traitLabel = document.getElementById('unit-trait');
  setHidden(traitLabel, noUnit || (!trait && !attackBonus));
  traitLabel.textContent = trait ? `攻撃力 ${firepower} · ${trait}` : attackBonus ? `攻撃力 ＋${attackBonus}` : '';
  const portrait = document.getElementById('unit-portrait');
  setHidden(portrait, noUnit);
  if (!noUnit) showImage(portrait, unitImage(game.playerUnit));
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
  setHidden(ordersActions, Boolean(result) && !mobileField);
  document.documentElement.classList.toggle('orders-visible', !ordersActions.hidden);
  // The gentle idle motion rests while units move or the enemy acts, so it costs nothing then.
  document.documentElement.classList.toggle('map-busy', ordersLocked);
  setHidden(endTurn, Boolean(result));
  setHidden(productionLaunch, !canOpenProductionDialog || Boolean(result));
  setHidden(replay, !result);
  renderBattleStatus();
  renderUnitDetail(detailReach);
  renderMoveConfirm(waiting);
  for (const opener of detailOpeners) setHidden(opener, noUnit || Boolean(result) || waiting);
  if (movingFriendly) {
    state.textContent = '移動中';
    message.textContent = `${friendlyName}が移動中です。`;
  } else if (result) {
    state.textContent = lost ? '敗北' : '勝利';
    if (game.capturedBy) {
      message.textContent = lost ? '敗北。敵部隊に味方の本拠地を占領されました。'
        : '勝利！ 味方部隊が敵の本拠地を占領しました。';
    } else {
      message.textContent = lost ? '敗北。味方部隊が全滅しました。' : '勝利！ 敵部隊をすべて撃破しました。';
    }
  } else if (waiting) {
    state.textContent = '敵のターン';
    message.textContent = actingEnemy ? `敵${actingEnemy.name}が行動します。` : '敵部隊が行動します。';
  } else if (noUnit) {
    state.textContent = '部隊なし';
    message.textContent = canOpenProductionDialog
      ? '部隊がまだいません。「生産」の印がある本拠地・工場などを選んで部隊を生産してください。'
      : '部隊がまだいません。「ユニット生産」で部隊を生産してください。';
  } else if (game.activeUnit.readyTurn > game.turn) {
    state.textContent = '生産直後';
    message.textContent = `${friendlyName}は次のターンから操作できます。`;
  } else if (captureReady) {
    state.textContent = '占領可能';
    message.textContent = game.scenario ? '「占領」の印がある敵本拠地に歩兵・対戦車兵を移動させると占領が進みます。占領しきると勝利です。'
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
    const update = [['city', 'oilfield', 'depot', 'fortress'].includes(facilityCapture.facility) ? '次のターンから収入が入ります。' : '',
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
    let summary = inspection || (noUnit ? state.textContent : `${game.activeUnit.name}（${position}） · HP ${game.playerHP} · ${state.textContent}`);
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
  detailUnit = null;
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
  renderLevel();
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
    if (game.enemyTurn && !titleScreen.open) runEnemyTurn(false);
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
  if (!cell || inputBlocked(true)) return;
  const {x, y, factory} = cell;
  if (game.stagedMove) {
    const enemy = game.enemyAt(x, y);
    if (enemy && game.canUnitAttack(game.activeUnit, enemy)) previewAction(cell, event);
    return;
  }
  inspectedCell = null;
  if (factory && game.productionStatus(factory) === 'ready' && openProduction(event, cell)) return;
  if (game.selected && game.friendlyAt(x, y) === game.activeUnit && previewCaptureHere(cell, event)) return;
  if (previewAction(cell, event)) return;
  if (!game.friendlyAt(x, y)) {
    inspectedCell = cell;
    // Tapping an enemy shows its details and where it can move and strike next.
    detailUnit = game.enemyAt(x, y) ?? null;
    render();
    return;
  }
  game.choose(x, y);
  // An open detail panel follows the selected friendly unit.
  if (detailUnit) detailUnit = game.activeUnit;
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
  // Set on the leaves (not the tile) so tiles keep sharing their computed styles.
  const idleDelay = `${-(x * 371 + y * 587) % 1600}ms`;
  idleSprite.style.setProperty('--idle-delay', idleDelay);
  image.style.setProperty('--idle-delay', idleDelay);
  const cell = {x, y, button, image, idleSprite, hpBadge, actionBadge, productionBadge, base, factory, city, facility};
  cellOfButton.set(button, cell);
  cells.push(cell);
  return button;
}

// Assigning the value an element already has still makes the browser restyle it, and render()
// touches every tile, so only write .hidden when it changes.
function setHidden(element, hidden) {
  if (element.hidden !== hidden) element.hidden = hidden;
}

function repeatedTap(event, opener) {
  return event.detail > 0 && opener?.detail > 0 && event.timeStamp - opener.timeStamp < 320
    && Math.hypot(event.clientX - opener.clientX, event.clientY - opener.clientY) < 24;
}

// A quick second tap on the same spot lands on whatever the first tap revealed there (a dialog's
// close button, the menu, a sound toggle, a map tile). Swallow it everywhere, before any handler.
let lastTap = null;
document.addEventListener('click', event => {
  if (event.detail === 0) return;
  if (repeatedTap(event, lastTap)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  lastTap = event;
}, true);

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
    // Moves happen first and wait on the board for 確定 or キャンセル.
    return stageFriendlyMove(cell);
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
  if (!pendingAction || inputBlocked(true) || repeatedTap(event, pendingAction.opener)) return;
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
  // Attacking from a staged tile completes that move first (including any capture there).
  const moved = game.stagedMove ? commitStagedMove() : null;
  const celebrate = () => {
    if (!moved?.step) return;
    flashMapTile(moved.cell, 'capture');
    celebrateCapture(moved.step, 'friendly');
  };
  if (game.result) {
    restoreBoardFocus();
    celebrate();
    return;
  }
  presentAttack({attacker: 'player', enemy, resolve: () => game.choose(x, y), onReturn: () => {
    restoreBoardFocus();
    celebrate();
  }});
});

function stageFriendlyMove(cell) {
  const unit = game.activeUnit;
  const route = game.movementTargets().get(`${cell.x},${cell.y}`);
  const from = {x: unit.x, y: unit.y};
  if (!route || !game.stageMove(cell.x, cell.y)) return false;
  detailUnit = null;
  inspectedCell = null;
  animateFriendlyMove(unit, from, routeSteps(route), () => {
    render();
    moveCommit.focus({preventScroll: true});
    // Keep the moved unit visible above the confirm bar.
    requestAnimationFrame(() => {
      if (moveConfirm.hidden) return;
      const tile = tileAt(unit).getBoundingClientRect();
      const view = mapSurround.getBoundingClientRect();
      const visibleBottom = Math.min(view.bottom, moveConfirm.getBoundingClientRect().top) - 8;
      if (tile.bottom > visibleBottom) mapSurround.scrollTop += tile.bottom - visibleBottom + tile.height;
    });
  });
  return true;
}

function cellAt(x, y) {
  return cells[y * game.width + x];
}

/** Completes the staged move and reports any capture it made. */
function commitStagedMove() {
  const {unit} = game.stagedMove;
  const cell = cellAt(unit.x, unit.y);
  const factory = cell.factory;
  const capturedFactory = factory && factory.owner !== 'friendly';
  const previousCapture = game.friendlyCapture;
  game.confirmMove();
  if (capturedFactory && factory.owner === 'friendly') selectedFactory = factory;
  saveProgress();
  const captured = game.capturedBy === 'friendly' || game.friendlyCapture !== previousCapture;
  const step = captured ? {site: cell.facility, points: game.friendlyCapture?.points ?? 0,
    completed: game.capturedBy === 'friendly' || !(game.friendlyCapture?.points > 0)} : null;
  return {cell, step: captured ? step : null, captured};
}

function renderMoveConfirm(waiting) {
  const staged = !waiting && !movingFriendly ? game.stagedMove : null;
  document.documentElement.classList.toggle('move-staged', Boolean(game.stagedMove));
  for (const cell of board.querySelectorAll('.tile.staged-origin')) cell.classList.remove('staged-origin');
  if (game.stagedMove) tileAt(game.stagedMove.from).classList.add('staged-origin');
  moveConfirm.hidden = !staged;
  mapSurround.style.paddingBottom = '';
  if (!staged) return;
  // The bar covers the bottom of the map; let the map scroll far enough that the last row clears it.
  requestAnimationFrame(() => {
    if (moveConfirm.hidden) return;
    const cover = mapSurround.getBoundingClientRect().bottom - moveConfirm.getBoundingClientRect().top;
    const base = parseFloat(getComputedStyle(mapSurround).paddingBottom) || 0;
    if (cover > 0) mapSurround.style.paddingBottom = `${base + cover + 8}px`;
  });
  const {unit, from} = staged;
  const site = game.facilityAt(unit.x, unit.y);
  const capture = capturesSites(unit.type) && site && site.owner !== 'friendly'
    ? captureForecast(site, unit)
    : !game.scenario && capturesSites(unit.type) && game.headquartersAt(unit.x, unit.y) === 'enemy' ? '敵本拠地を占領すると勝利' : '';
  moveConfirmRoute.textContent = `味方${unit.name}  ${placeName(from.x, from.y)} → ${placeName(unit.x, unit.y)}`;
  moveConfirmHint.textContent = [capture,
    game.canAttack ? '「攻撃」の印がある敵をタップすると、ここから攻撃できます' : 'ここから攻撃できる敵はいません',
  ].filter(Boolean).join(' ／ ');
  moveCommit.textContent = capture ? '占領して確定' : '移動を確定';
}

moveCommit.addEventListener('click', () => {
  if (!game.stagedMove || inputBlocked(true) || actionDialog.open) return;
  const moved = commitStagedMove();
  restoreBoardFocus();
  if (moved.captured) flashMapTile(moved.cell, 'capture');
  if (moved.step) celebrateCapture(moved.step, 'friendly');
});

function cancelStagedMove() {
  if (!game.stagedMove || inputBlocked(true) || actionDialog.open) return;
  game.cancelMove();
  restoreBoardFocus();
}
moveCancel.addEventListener('click', cancelStagedMove);
document.addEventListener('keydown', (event) => {
  // Escape inside an open dialog (menu, guide, field panels) only closes that dialog.
  if (event.key === 'Escape' && game.stagedMove && !event.defaultPrevented && !document.querySelector('dialog[open]')) cancelStagedMove();
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
  const capture = capturesSites(enemy.type) && (game.headquartersAt(to.x, to.y) === 'friendly' || (site && site.owner !== 'enemy'));
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
  // A double tap on the move bar's キャンセル must not open production underneath it.
  if (event.detail > 1) return;
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
  // Opening a fresh map here is on purpose, so it may replace a save that could not be read.
  if (!restored) crossingSave.discardUnreadable();
  game = restored ?? BattleMap.newMatch(id);
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
  openNewMatch();
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

// ---- Unit details: stats, traits, matchups and the next move/strike range on the board ----

// Infantry and anti-tank troops (rules.js canCapture).
function capturesSites(type) {
  return type.id === 'infantry' || Boolean(type.captures);
}

function movementNote(type) {
  if (type.domain === 'air') return '地形と部隊を越えて移動';
  if (type.domain === 'sea') return '海と港だけを移動';
  if (!game.scenario) return '川は橋だけ、湿地は2';
  if (type.foot) return '山・丘陵・廃墟も通れる。外海・浅瀬は不可';
  return '山は通れない。森・丘陵・廃墟は2。外海・浅瀬は不可';
}

function matchupChips(entries) {
  const list = document.createElement('ul');
  list.className = 'matchup-chips';
  for (const {name, value} of entries) {
    const item = document.createElement('li');
    item.textContent = value === undefined ? name : `${name} ${value}`;
    list.append(item);
  }
  return list;
}

function renderUnitDetail(reach) {
  unitDetail.hidden = !detailUnit;
  if (!detailUnit) {
    shownDetail = null;
    return;
  }
  if (shownDetail !== detailUnit) {
    shownDetail = detailUnit;
    // Keep the unit visible above the panel that covers the bottom of the screen.
    requestAnimationFrame(() => {
      if (!detailUnit || unitDetail.hidden) return;
      const tile = tileAt(detailUnit).getBoundingClientRect();
      const panelTop = unitDetail.getBoundingClientRect().top;
      const view = mapSurround.getBoundingClientRect();
      const visibleBottom = Math.min(view.bottom, panelTop) - 8;
      if (tile.bottom > visibleBottom) mapSurround.scrollTop += tile.bottom - visibleBottom + tile.height;
      else if (tile.top < view.top) mapSurround.scrollTop -= view.top - tile.top + 8;
    });
  }
  const unit = detailUnit;
  const enemy = game.enemyUnits.includes(unit);
  const {type} = unit;
  document.getElementById('unit-detail-title').textContent = `${enemy ? '敵' : '味方'}${unit.name}`;
  document.getElementById('unit-detail-hp').textContent = `HP ${unit.hp}/${game.maxHP}`;
  document.getElementById('detail-move-count').textContent = reach.move.size;
  document.getElementById('detail-attack-count').textContent = reach.attack.size;
  const terrain = game.terrainAt(unit.x, unit.y);
  const cover = type.domain && type.domain !== 'land' ? 0 : game.coverAt(unit.x, unit.y);
  const ranged = type.minRange > 1 || type.stationary;
  const rows = [
    ['種別', `${domainNames[type.domain ?? 'land']}${type.cost ? ` · ${currency.format(type.cost)}` : ''}`],
    ['移動', `${type.movement}（${movementNote(type)}）`],
    ['射程', `${rangeLabel(type)}（${ranged ? '間接攻撃。移動したターンは攻撃できない' : '直接攻撃'}）`],
    ['反撃', type.stationary ? 'できない' : 'できる（射程内の相手のみ）'],
    ['占領', capturesSites(type) ? 'できる' : 'できない'],
    ['攻撃対象', type.targets ? type.targets.map(domain => targetNames[domain]).join('・') : '地上'],
    ['現在地', `${[...new Set([placeName(unit.x, unit.y), terrain.name])].join(' · ')}${cover ? `（防御+${cover}）` : ''}`],
  ];
  if (!enemy) rows.push(['状態', unitActions[friendlyAction(unit)]?.label ?? '']);
  if (type.firepower) rows.push(['攻撃力', String(type.firepower)]);
  if (type.trait) rows.push(['特性', type.trait]);
  const stats = document.getElementById('unit-detail-stats');
  stats.replaceChildren(...rows.flatMap(([label, value]) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    return [term, detail];
  }));
  // Matchups against every enemy kind: damage dealt at the unit's HP, damage taken from a full-strength foe.
  const foes = game.unitTypes;
  const dealt = foes.map(other => ({name: other.name, value: game.damageEstimate(type, other, {hp: unit.hp})}));
  const taken = foes.map(other => ({name: other.name, value: game.damageEstimate(other, type, {cover})}));
  const top = list => list.filter(entry => entry.value !== null).sort((a, b) => b.value - a.value).slice(0, 4);
  const section = (title, entries, note) => {
    const block = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = title;
    block.append(heading);
    if (note) {
      const small = document.createElement('small');
      small.textContent = note;
      heading.append(small);
    }
    block.append(entries.length ? matchupChips(entries) : Object.assign(document.createElement('p'), {textContent: 'なし'}));
    return block;
  };
  const unreachable = dealt.filter(entry => entry.value === null).map(({name}) => ({name}));
  const safe = taken.filter(entry => entry.value === null).map(({name}) => ({name}));
  document.getElementById('unit-detail-matchups').replaceChildren(
    section('得意な相手', top(dealt), '与ダメージの目安（今のHP）'),
    section('苦手な相手', top(taken), '受けるダメージの目安（相手HP10・今の地形）'),
    section('攻撃できない相手', unreachable),
    section('攻撃してこない相手', safe),
  );
}

for (const opener of detailOpeners) {
  opener.addEventListener('click', () => {
    if (inputBlocked() || game.activeUnit.standby) return;
    detailUnit = detailUnit === game.activeUnit ? null : game.activeUnit;
    render();
    if (detailUnit) document.getElementById('unit-detail-title').focus({preventScroll: true});
  });
}
document.getElementById('unit-detail-close').addEventListener('click', () => {
  detailUnit = null;
  render();
  restoreBoardFocus();
});
unitDetail.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  detailUnit = null;
  render();
  restoreBoardFocus();
});

// ---- New match with a chosen CPU strength ----
function renderLevel() {
  document.getElementById('level-label').textContent = levelNames[game.difficulty] ?? 'ふつう';
  document.getElementById('level-open').setAttribute('aria-label', `CPUの強さ ${levelNames[game.difficulty] ?? 'ふつう'}。新しい対戦を始める`);
}
// From the title screen a saved enemy turn is not running yet, so a new match can replace it.
const matchBusy = () => portraitMode.blocked || combatScreen.active
  || (!titleScreen.open && (game.enemyTurn || movingFriendly));
function openNewMatch() {
  if (matchBusy()) return;
  for (const choice of newMatchDialog.querySelectorAll('[data-level]')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.level === game.difficulty));
  }
  newMatchDialog.showModal();
}
document.getElementById('level-open').addEventListener('click', () => openNewMatch());
for (const choice of newMatchDialog.querySelectorAll('[data-level]')) {
  choice.addEventListener('click', () => {
    const level = choice.dataset.level;
    newMatchDialog.close();
    if (matchBusy()) return;
    if (titleScreen.open) titleScreen.close();
    try {
      window.localStorage.setItem(levelPreference, level);
    } catch {
      // The strength still applies to this match.
    }
    if (currentScenario === 'legacy') {
      currentScenario = 'coastal';
      ({save: crossingSave} = openScenario('coastal'));
      try { window.localStorage.setItem(scenarioPreference, 'coastal'); } catch { /* not stored */ }
    }
    game = BattleMap.newMatch(currentScenario, undefined, {difficulty: level});
    // Choosing a new match on purpose replaces a save that could not be read.
    crossingSave.discardUnreadable();
    saveProgress();
    showMap();
    friendlyTile().focus({preventScroll: true});
  });
}

// Title screen: shown on every visit, on top of the restored (or new) match.
function savedMatchExists() {
  try {
    return Boolean(window.localStorage.getItem(currentScenario === 'coastal' ? coastalSaveKey : crossingSaveKey));
  } catch {
    return false;
  }
}
// The title scene is painted in code (scene-art.js, in a worker when possible) after the
// title first appears, then the units are laid over it one per frame.
const titleUnits = [
  {id: 'bomber', team: 'enemy', x: 64, y: 17, w: 22, kind: 'fly far'},
  {id: 'fighter', team: 'friendly', x: 11, y: 21, w: 30, kind: 'fly'},
  {id: 'fighter', team: 'friendly', x: 38, y: 26.5, w: 22, kind: 'fly late'},
  {id: 'destroyer', team: 'enemy', x: 66, y: 38.5, w: 20, kind: 'sail far'},
  {id: 'battleship', team: 'friendly', x: 12, y: 34.5, w: 38, kind: 'sail'},
  {id: 'tank', team: 'friendly', x: 10, y: 54, w: 40, kind: 'land'},
  {id: 'infantry', team: 'friendly', x: 55, y: 61.5, w: 22, kind: 'land'},
];
let titleArtStarted = false;
function paintTitleArt() {
  if (titleArtStarted || !window.SceneArt) return;
  titleArtStarted = true;
  const art = document.getElementById('title-art');
  const backdrop = document.getElementById('title-backdrop');
  requestAnimationFrame(() => setTimeout(() => SceneArt.titleAsync(url => {
    backdrop.addEventListener('load', () => {
      art.classList.add('ready');
      if (!window.UnitArt) return;
      const add = index => {
        const unit = titleUnits[index];
        if (!unit) return;
        const image = new Image();
        image.className = `title-unit ${unit.kind}`;
        image.alt = '';
        image.style.cssText = `left:${unit.x}%;top:${unit.y}%;width:${unit.w}%`;
        image.src = UnitArt.still(unit.id, unit.team);
        art.append(image);
        requestAnimationFrame(() => setTimeout(() => add(index + 1), 0));
      };
      add(0);
    }, {once: true});
    backdrop.src = url;
  }), 0));
}
function showTitle() {
  paintTitleArt();
  for (const dialog of [gameMenu, menuConfirm, guide, newMatchDialog]) if (dialog.open) dialog.close();
  const resumable = savedMatchExists() && crossingSave.status !== 'unreadable' && !game.result;
  titleResume.disabled = !resumable;
  titleResume.classList.toggle('primary', resumable);
  titleNew.classList.toggle('primary', !resumable);
  const fixedMap = !game.scenario?.map;
  titleResumeDetail.textContent = resumable
    ? `${game.name}${fixedMap ? '（以前の固定マップ）' : ''}・ターン${game.turn}・CPU ${levelNames[game.difficulty] ?? 'ふつう'}`
    : '中断した対戦はありません';
  titleScreen.showModal();
  (resumable ? titleResume : titleNew).focus({preventScroll: true});
}
titleScreen.addEventListener('cancel', event => event.preventDefault());
titleResume.addEventListener('click', () => {
  if (titleResume.disabled) return;
  titleScreen.close();
  restoreBoardFocus();
  if (game.enemyTurn && !game.result) runEnemyTurn(false);
});
titleNew.addEventListener('click', () => openNewMatch());
document.getElementById('title-help').addEventListener('click', () => {
  // Map switching stays in the in-game guide; from the title it only explains the rules.
  document.getElementById('play-coastal').hidden = true;
  document.getElementById('play-legacy').hidden = true;
  guide.showModal();
  guide.scrollTop = 0;
});

// In-game menu: suspend to the title, restart, or surrender (the last two are confirmed first).
let menuConfirmAction = null;
// Unlike orders, the menu stays available after a result and during a staged move.
const menuBlocked = () => portraitMode.blocked || combatScreen.active || waitingForEnemy() || Boolean(movingFriendly);
document.getElementById('menu-open').addEventListener('click', () => {
  if (menuBlocked() || titleScreen.open) return;
  menuSurrender.disabled = Boolean(game.result);
  gameMenu.showModal();
});
function confirmMenu(title, text, label, action) {
  gameMenu.close();
  menuConfirmTitle.textContent = title;
  menuConfirmText.textContent = text;
  menuConfirmOk.textContent = label;
  menuConfirmAction = action;
  menuConfirm.showModal();
}
document.getElementById('menu-confirm-cancel').addEventListener('click', () => menuConfirm.close());
menuConfirm.addEventListener('close', () => { menuConfirmAction = null; });
menuConfirmOk.addEventListener('click', (event) => {
  const action = menuConfirmAction;
  if (event.detail > 1 || !action) return;
  menuConfirm.close();
  if (menuBlocked()) return;
  action();
});
document.getElementById('menu-suspend').addEventListener('click', () => {
  gameMenu.close();
  if (menuBlocked()) return;
  game.cancelMove();
  saveProgress();
  render();
  showTitle();
});
document.getElementById('menu-restart').addEventListener('click', () => confirmMenu(
  '最初からやり直しますか？',
  '同じマップ・同じCPUの強さで、ターン1から始めます。今の対戦の進行は失われます。',
  '最初からやり直す',
  () => {
    game = game.restarted();
    saveProgress();
    showMap();
    friendlyTile().focus({preventScroll: true});
  },
));
menuSurrender.addEventListener('click', () => {
  if (menuSurrender.disabled) return;
  confirmMenu('降伏しますか？', 'この対戦は敗北で終わります。降伏は取り消せません。', '降伏する', () => {
    if (!game.surrender()) return;
    saveProgress();
    restoreBoardFocus();
    celebrateResult();
  });
});

// Runs after the board is set up, so the title sits on top of the restored match.
showTitle();
