const crossingSave = createCrossingSave(() => window.localStorage);
let game = crossingSave.load(BattleMap.fromCrossingSnapshot) ?? new BattleMap();
const board = document.getElementById('board');
const mapSurround = document.getElementById('map-surround');
const mapScrollNote = document.getElementById('map-scroll-note');
const mapLetters = document.getElementById('map-letters');
const mapNumbers = document.getElementById('map-numbers');
const roster = document.getElementById('friendly-roster');
const enemyRoster = document.getElementById('enemy-roster');
const cells = [];
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
const productionButtons = [...document.querySelectorAll('[data-produce]')];
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
  acting: {label: '行動中', marker: '動'}, defeated: {label: '撃破'}, ended: {label: '対戦終了'},
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
let movingEnemy = null;
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

function columnName(x) {
  return String.fromCharCode(65 + x);
}

function coordinate(x, y) {
  return columnName(x) + (y + 1);
}

function friendlyTile() {
  return tileAt(game.activeUnit);
}

function tileAt({x, y}) {
  return cells[y * game.width + x].button;
}

function unitImage(type, enemy = false) {
  if (enemy && type.id !== 'support') return `./assets/enemy-${type.id}.png`;
  const sprite = !enemy && type.id === 'support' ? 'friendly-support' : type.id;
  return `./assets/${sprite}.png`;
}

function showImage(image, source) {
  if (image.getAttribute('src') !== source) image.src = source;
}

function waitingForEnemy() {
  return Boolean(game.enemyTurn);
}

function inputBlocked() {
  return portraitMode.blocked || combatScreen.active || waitingForEnemy() || Boolean(game.result);
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
  if (game.result) return 'ended';
  if (unit.readyTurn > game.turn) return 'deployed';
  if (unit.attacked) return 'spent';
  if (unit.moved) return game.canUnitAttack(unit) ? 'attack' : 'spent';
  return 'ready';
}

function renderTurn(waiting) {
  const round = String(game.turn).padStart(2, '0');
  const side = game.result ? 'ended' : waiting ? 'enemy' : 'friendly';
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
  }, 850);
}

function renderProduction() {
  const owned = game.factories.filter(factory => factory.owner === 'friendly');
  if (!owned.includes(selectedFactory)) selectedFactory = owned[0];
  const mapFactory = productionOrigin?.cell;
  factoryPicker.hidden = owned.length < 2 || Boolean(mapFactory);
  productionMove.hidden = !mapFactory || !game.canMoveTo(mapFactory.x, mapFactory.y);
  for (const {factory, icon, owner, button} of factoryEntries) {
    icon.dataset.factory = factory.owner;
    owner.textContent = `${ownerNames[factory.owner]}工場`;
    button.hidden = factory.owner !== 'friendly';
    button.setAttribute('aria-pressed', String(factory === selectedFactory));
  }
  document.getElementById('production-title-coordinate').textContent = selectedFactory
    ? coordinate(selectedFactory.x, selectedFactory.y) : '';
  const status = game.productionStatus(selectedFactory);
  const purchase = selectedFactory?.production;
  const labels = {
    ready: '1ターンに1部隊を生産できます。',
    occupied: '工場が使用中です。マスが空くと生産できます。',
    used: purchase ? `${purchase.unit}を生産しました（−${currency.format(purchase.cost)}）。次のターンから操作できます。` : '',
    waiting: '敵のターンです。',
    unavailable: game.result ? '対戦終了' : '工場を占領すると生産できます。',
    insufficient: '生産に必要な資金が足りません。',
  };
  if (productionStatus.textContent !== labels[status]) productionStatus.textContent = labels[status];
  document.getElementById('production-funds').textContent = currency.format(game.funds.friendly);
  for (const button of productionButtons) {
    const affordable = game.funds.friendly >= game.productionCost(button.dataset.produce);
    button.hidden = Boolean(mapFactory) && (status !== 'ready' || !affordable);
    button.setAttribute('aria-disabled', String(status !== 'ready' || !affordable));
  }
}

function buildFactories() {
  selectedFactory = undefined;
  factoryEntries.length = 0;
  factoryLegend.replaceChildren();
  factoryPicker.replaceChildren();
  for (const factory of game.factories) {
    const spot = coordinate(factory.x, factory.y);
    const legend = document.createElement('span');
    const icon = document.createElement('i');
    icon.className = 'factory-key';
    icon.setAttribute('aria-hidden', 'true');
    const owner = document.createElement('span');
    const position = document.createElement('b');
    position.textContent = spot;
    legend.append(icon, owner, position);
    factoryLegend.append(legend);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = spot;
    button.setAttribute('aria-label', `${spot} の工場`);
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
    label.textContent = `${coordinate(city.x, city.y)} ${owner}`;
  }
  const healing = document.getElementById('facility-healing');
  const restored = game.facilityHealing.map(({side, unit, amount, facility}) => {
    const site = facility === 'factory' ? '工場' : '都市';
    return `${ownerNames[side]}${unit}（${site}） +${amount} HP`;
  });
  const report = !game.enemyTurn && !game.result && restored.length ? `回復　${restored.join('、')}` : '';
  if (healing.textContent !== report) healing.textContent = report;
}

function render() {
  const waiting = waitingForEnemy();
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
    state.textContent = mobileField && unit.hp ? `${coordinate(unit.x, unit.y)} · ${label}` : label;
    card.dataset.action = action;
    card.disabled = !unit.hp || Boolean(game.result);
    card.classList.toggle('defeated', !unit.hp);
    card.setAttribute('aria-disabled', String(waiting || card.disabled));
    card.setAttribute('aria-pressed', String(unit === game.activeUnit));
  }
  for (const {unit, card, hp, state} of enemyRosterEntries) {
    const action = enemyAction(unit);
    hp.textContent = `HP ${unit.hp}/${game.maxHP}`;
    const {x, y} = movingEnemy?.unit === unit ? movingEnemy.position : unit;
    const spot = coordinate(x, y);
    state.textContent = !unit.hp ? unitActions.defeated.label : action ? `${spot} · ${unitActions[action].label}` : spot;
    card.dataset.action = action;
    card.classList.toggle('enemy-acting', unit === actingEnemy);
    card.classList.toggle('defeated', !unit.hp);
  }
  for (const cell of cells) {
    const {x, y, button, image, hpBadge, actionBadge, productionBadge, base, factory, city} = cell;
    const terrain = game.terrainAt(x, y);
    button.dataset.terrain = terrain.id;
    const captured = Boolean(base && game.capturedBy && base !== game.capturedBy);
    if (city) button.dataset.city = city.owner;
    if (factory) button.dataset.factory = factory.owner;
    const friendly = game.friendlyAt(x, y);
    const occupied = Boolean(friendly);
    const active = friendly === game.activeUnit;
    let enemy = game.enemyAt(x, y);
    if (movingEnemy && movingEnemy.position.x === x && movingEnemy.position.y === y) enemy = movingEnemy.unit;
    else if (movingEnemy && enemy === movingEnemy.unit) enemy = undefined;
    const action = friendly ? friendlyAction(friendly) : enemy ? enemyAction(enemy) : '';
    const actionInfo = unitActions[action];
    const target = !waiting && enemy && game.canUnitAttack(game.activeUnit, enemy);
    const reachable = movementTargets.has(`${x},${y}`);
    const facility = factory ?? city;
    const captureTarget = reachable && game.playerUnit.id === 'infantry'
      && (base === 'enemy' || Boolean(facility && facility.owner !== 'friendly'));
    const productionReady = factory && canOpenProductionDialog && game.productionStatus(factory) === 'ready';
    productionBadge.hidden = !productionReady;
    button.classList.toggle('action-pending', pendingAction?.cell === cell);
    if (productionReady || reachable || target) button.setAttribute('aria-haspopup', 'dialog');
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
    button.setAttribute('aria-label', [coordinate(x, y), occupied ? '味方' + friendly.name : enemy ? '敵' + enemy.name : '',
      base ? `${base === 'friendly' ? '味方' : '敵'}の本拠地` : '', captured ? '占領済み' : '',
      factory ? `${ownerNames[factory.owner]}の工場` : '',
      city ? `${ownerNames[city.owner]}の都市` : '',
      terrain.name, terrain.defense ? `防御${terrain.defense}` : '',
      terrain.cost === Infinity ? '通行不可' : terrain.cost ? `消費移動力${terrain.cost}` : '',
      productionReady ? '生産可能' : '', target ? '攻撃可能' : '', captureTarget ? '占領可能' : reachable ? '移動可能' : '',
      occupied || enemy ? `HP ${(friendly ?? enemy).hp}` : '', actionInfo?.label,
      !waiting && active && game.selected ? '選択中' : ''].filter(Boolean).join('、'));
    image.hidden = !occupied && !enemy;
    if (occupied || enemy) showImage(image, unitImage((enemy ?? friendly).type, Boolean(enemy)));
    hpBadge.hidden = !mobileField || image.hidden;
    if (!hpBadge.hidden) hpBadge.textContent = (enemy ?? friendly).hp;
    actionBadge.hidden = !actionInfo?.marker;
    if (!actionBadge.hidden) {
      actionBadge.dataset.action = action;
      actionBadge.textContent = actionInfo.marker;
    }
  }
  const {movement, minRange, maxRange, attackBonus} = game.playerUnit;
  document.getElementById('unit-name').textContent = game.activeUnit.name;
  document.getElementById('unit-movement').textContent = movement;
  document.getElementById('unit-range').textContent = minRange === maxRange ? maxRange : `${minRange}〜${maxRange}`;
  document.getElementById('unit-trait').hidden = !attackBonus;
  showImage(document.getElementById('unit-portrait'), unitImage(game.playerUnit));
  const position = coordinate(game.x, game.y);
  document.getElementById('position').textContent = game.playerHP ? position : '—';
  document.getElementById('unit-terrain').textContent = game.playerHP ? game.terrainAt(game.x, game.y).name : '—';
  renderTurn(waiting);
  const state = document.getElementById('state');
  const message = document.getElementById('message');
  state.classList.toggle('spent', spent);
  state.classList.toggle('attack-ready', !waiting && game.canAttack);
  endTurn.setAttribute('aria-disabled', String(waiting));
  productionLaunch.setAttribute('aria-disabled', String(waiting));
  document.getElementById('help').setAttribute('aria-disabled', String(Boolean(game.enemyTurn)));
  ordersActions.hidden = Boolean(game.result) && !mobileField;
  endTurn.hidden = Boolean(game.result);
  productionLaunch.hidden = !canOpenProductionDialog || Boolean(game.result);
  replay.hidden = !game.result;
  renderBattleStatus();
  if (game.result) {
    state.textContent = lost ? '敗北' : '勝利';
    if (game.capturedBy) {
      const base = game.headquarters[lost ? 'friendly' : 'enemy'];
      const spot = coordinate(base.x, base.y);
      message.textContent = lost ? `敗北。敵歩兵に味方の本拠地（${spot}）を占領されました。`
        : `勝利！ 味方歩兵が敵の本拠地（${spot}）を占領しました。`;
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
    message.textContent = '「占領」の印がある敵本拠地に歩兵を移動させると勝利します。';
  } else if (announcedCapture) {
    const factory = facilityCapture.facility === 'factory';
    const site = factory ? '工場' : '都市';
    const update = factory ? '工場マスが空くと生産できます。' : '次のターンから収入が入ります。';
    state.textContent = game.canAttack ? '攻撃可能' : `${site}占領`;
    message.textContent = `${coordinate(facilityCapture.x, facilityCapture.y)} の${site}を占領しました。${update}`
      + (game.canAttack ? '印のある敵を攻撃できます。' : '');
  } else if (game.canAttack) {
    state.textContent = '攻撃可能';
    const targets = game.enemyUnits.filter(enemy => game.canUnitAttack(game.activeUnit, enemy));
    const target = targets.length === 1 ? `${coordinate(targets[0].x, targets[0].y)} の敵${targets[0].name}` : '印のある敵';
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
  if (mobileField) {
    let summary = `${game.activeUnit.name} ${position} · HP ${game.playerHP} · ${state.textContent}`;
    if (waiting) summary = actingEnemy ? `敵${actingEnemy.name}が行動中` : state.textContent;
    if (game.result) summary = state.textContent;
    if (fieldUnit.textContent !== summary) fieldUnit.textContent = summary;
    fieldFunds.textContent = currency.format(game.funds.friendly);
    for (const button of fieldButtons) button.setAttribute('aria-disabled', String(waiting));
    fieldNextUnit.setAttribute('aria-disabled', String(waiting || Boolean(game.result) || !nextFriendlyUnit()));
  }
}

function renderBattleStatus() {
  const report = document.getElementById('enemy-report');
  const lines = game.enemyActions.map(({enemy, friendly, from, to, captured, cityCaptured, factoryCaptured}) => {
    const origin = coordinate(from.x, from.y);
    const destination = coordinate(to.x, to.y);
    if (origin === destination) {
      return `敵${enemy} ${destination}${friendly ? `から味方${friendly}を攻撃` : 'で待機'}`;
    }
    const capture = captured ? '、本拠地を占領' : cityCaptured ? '、都市を占領' : factoryCaptured ? '、工場を占領' : '';
    const attack = friendly ? `、味方${friendly}を攻撃` : '';
    return `敵${enemy} ${origin} → ${destination}${capture}${attack}`;
  });
  for (const {x, y, unit} of game.enemyProductions) {
    lines.push(`敵は工場（${coordinate(x, y)}）で${unit}を生産`);
  }
  report.hidden = lines.length === 0;
  report.textContent = lines.join('\n');
}

function showMap() {
  if (turnChangeTimer) portraitMode.cancel(turnChangeTimer);
  turnChangeTimer = undefined;
  turnChange.hidden = true;
  pendingAction = undefined;
  productionOrigin = undefined;
  if (actionDialog.open) actionDialog.close();
  if (productionDialog.open) productionDialog.close();
  positionProductionControls();
  closeFieldDialogs();
  renderSaveStatus();
  setMobileFieldLayout();
  music.setTurn(game.enemyTurn ? 'enemy' : 'friendly');
  music.setScene(game.result ?? 'map');
  for (const [side, {x, y}] of Object.entries(game.headquarters)) {
    document.getElementById(`${side}-base-coordinate`).textContent = coordinate(x, y);
  }
  for (const button of productionButtons) {
    button.querySelector('small').textContent = currency.format(game.productionCost(button.dataset.produce));
  }
  buildFactories();
  cityEntries.length = 0;
  cityOverview.replaceChildren();
  for (const city of game.cities) {
    const label = document.createElement('span');
    cityEntries.push({city, label});
    cityOverview.append(label);
  }
  buildBoard();
  updateMapScrollNote();
  rosterEntries.length = 0;
  enemyRosterEntries.length = 0;
  roster.replaceChildren();
  enemyRoster.replaceChildren();
  setBoardTabStop(friendlyTile());
  render();
  mapSurround.scrollLeft = 0;
  mapSurround.scrollTop = 0;
  revealTile(friendlyTile(), mobileField);
  if (game.enemyTurn) runEnemyTurn(false);
}

function revealTile(button, center = false) {
  const viewport = mapSurround.getBoundingClientRect();
  const tile = button.getBoundingClientRect();
  const visibleLeft = viewport.left + mapNumbers.offsetWidth;
  const visibleRight = viewport.left + mapSurround.clientWidth;
  if (mobileField) {
    const visibleTop = viewport.top + mapLetters.offsetHeight;
    const bottom = viewport.top + mapSurround.clientHeight;
    if (center) {
      mapSurround.scrollLeft += (tile.left + tile.right - visibleLeft - visibleRight) / 2;
      mapSurround.scrollTop += (tile.top + tile.bottom - visibleTop - bottom) / 2;
      return;
    }
    if (tile.top < visibleTop) mapSurround.scrollTop += tile.top - visibleTop - 8;
    if (tile.bottom > bottom) mapSurround.scrollTop += tile.bottom - bottom + 8;
  }
  if (tile.left < visibleLeft) mapSurround.scrollLeft += tile.left - visibleLeft - 12;
  if (tile.right > visibleRight) mapSurround.scrollLeft += tile.right - visibleRight + 12;
}

function updateMapScrollNote() {
  mapScrollNote.hidden = mapSurround.scrollWidth <= mapSurround.clientWidth;
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
  const spots = cells.map(({button, base}) => {
    const spot = document.createElement('span');
    spot.className = 'overview-cell';
    spot.setAttribute('aria-hidden', 'true');
    spot.dataset.terrain = button.dataset.terrain;
    if (base) spot.dataset.base = base;
    const facility = button.dataset.factory ?? button.dataset.city;
    if (facility) spot.dataset.facility = facility;
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
  const left = Math.max(0, viewport.left + mapNumbers.offsetWidth - map.left);
  const top = Math.max(0, viewport.top + mapLetters.offsetHeight - map.top);
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

function setBoardTabStop(button) {
  for (const cell of cells) cell.button.tabIndex = cell.button === button ? 0 : -1;
}

function buildBoard() {
  board.replaceChildren();
  cells.length = 0;
  const {width, height} = game;
  mapSurround.style.setProperty('--columns', width);
  mapSurround.style.setProperty('--rows', height);
  board.setAttribute('aria-label', `${width}列${height}行の作戦マップ`);
  document.getElementById('dimensions').textContent = `${width} × ${height}`;
  for (const [id, count, label] of [['map-letters', width, columnName], ['map-numbers', height, index => index + 1]]) {
    const labels = Array.from({length: count}, (_, index) => {
      const item = document.createElement('b');
      item.textContent = label(index);
      return item;
    });
    document.getElementById(id).replaceChildren(...labels);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) addTile(x, y);
  }
}

function addTile(x, y) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  const base = game.headquartersAt(x, y);
  const factory = game.factoryAt(x, y);
  const city = game.cityAt(x, y);
  if (base) button.dataset.base = base;
  button.classList.toggle('last-column', x === game.width - 1);
  button.classList.toggle('last-row', y === game.height - 1);
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  button.append(image);
  const hpBadge = document.createElement('span');
  hpBadge.className = 'map-hp';
  hpBadge.setAttribute('aria-hidden', 'true');
  button.append(hpBadge);
  const actionBadge = document.createElement('span');
  actionBadge.className = 'unit-action';
  actionBadge.setAttribute('aria-hidden', 'true');
  button.append(actionBadge);
  const productionBadge = document.createElement('span');
  productionBadge.className = 'tile-production';
  productionBadge.setAttribute('aria-hidden', 'true');
  productionBadge.textContent = '生産';
  button.append(productionBadge);
  const cell = {x, y, button, image, hpBadge, actionBadge, productionBadge, base, factory, city};
  button.addEventListener('focus', () => setBoardTabStop(button));
  button.addEventListener('click', (event) => {
    if (inputBlocked()) return;
    if (factory && game.productionStatus(factory) === 'ready' && openProduction(event, cell)) return;
    if (previewAction(cell, event)) return;
    if (!game.friendlyAt(x, y)) return;
    game.choose(x, y);
    saveProgress();
    render();
  });
  button.addEventListener('keydown', (event) => {
    if (portraitMode.blocked) return;
    const offsets = {ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1]};
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    const nextX = Math.max(0, Math.min(game.width - 1, x + dx));
    const nextY = Math.max(0, Math.min(game.height - 1, y + dy));
    const next = cells[nextY * game.width + nextX].button;
    if (mobileField) {
      next.focus({preventScroll: true});
      revealTile(next);
    } else next.focus();
  });
  cells.push(cell);
  board.append(button);
}

function repeatedTap(event, opener) {
  return event.detail > 0 && opener?.detail > 0 && event.timeStamp - opener.timeStamp < 320
    && Math.hypot(event.clientX - opener.clientX, event.clientY - opener.clientY) < 24;
}

function previewAction(cell, opener) {
  const {x, y, base, factory, city} = cell;
  const unit = game.activeUnit;
  const enemy = game.enemyAt(x, y);
  const strikes = game.previewAttack(enemy);
  const destination = coordinate(x, y);
  let verb;
  if (strikes.length) {
    const [hit, counter] = strikes;
    verb = '攻撃';
    actionSummary.textContent = `${unit.name} → 敵${enemy.name}（${destination}）`;
    const reply = counter ? `反撃で味方 HP ${unit.hp} → ${counter.playerHP}` : '反撃なし';
    actionDetail.textContent = `敵 HP ${enemy.hp} → ${hit.enemyHP} ／ ${reply}`;
  } else {
    const route = game.movementTargets().get(`${x},${y}`);
    if (!route) return false;
    const site = factory ?? city;
    let capture = '';
    if (unit.type.id === 'infantry') {
      if (base === 'enemy') capture = '敵本拠地を占領すると勝利';
      else if (site && site.owner !== 'friendly') capture = `${factory ? '工場' : '都市'}を占領`;
    }
    verb = capture ? '占領' : '移動';
    actionSummary.textContent = `${unit.name}  ${coordinate(unit.x, unit.y)} → ${destination}`;
    actionDetail.textContent = [game.terrainAt(x, y).name, `移動力 ${route.cost} 消費`, capture].filter(Boolean).join(' ／ ');
  }
  actionTitle.textContent = `${verb}を確認`;
  actionConfirm.textContent = `${verb}する`;
  pendingAction = {cell, unit, enemy: strikes.length ? enemy : null, opener};
  cell.button.classList.add('action-pending');
  actionDialog.showModal();
  return true;
}

actionConfirm.addEventListener('click', (event) => {
  if (!pendingAction || inputBlocked() || repeatedTap(event, pendingAction.opener)) return;
  const {cell, unit, enemy} = pendingAction;
  const {x, y, factory} = cell;
  if (unit !== game.activeUnit || (enemy
    ? enemy !== game.enemyAt(x, y) || !game.canUnitAttack(unit, enemy)
    : !game.canMoveTo(x, y))) {
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
  const capturedFactory = factory?.owner === 'enemy';
  game.choose(x, y);
  if (capturedFactory && factory.owner === 'friendly') selectedFactory = factory;
  saveProgress();
  restoreBoardFocus();
});

actionDialog.addEventListener('close', () => {
  if (actionDialog.open || !pendingAction) return;
  const {button} = pendingAction.cell;
  pendingAction = undefined;
  button.classList.remove('action-pending');
  button.focus({preventScroll: true});
});

endTurn.addEventListener('click', (event) => {
  if (event.detail > 1 || inputBlocked() || !game.beginEnemyTurn()) return;
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
  const site = game.factoryAt(to.x, to.y) ?? game.cityAt(to.x, to.y);
  const capture = enemy.type.id === 'infantry' && (game.headquartersAt(to.x, to.y) === 'friendly' || (site && site.owner !== 'enemy'));
  const commands = [];
  if (path.length) commands.push({id: 'move', label: '移動'});
  if (capture) commands.push({id: 'capture', label: '占領'});
  if (friendly) commands.push({id: 'attack', label: '攻撃'});
  if (!commands.length) commands.push({id: 'wait', label: '待機'});
  const origin = coordinate(from.x, from.y);
  const destination = coordinate(to.x, to.y);
  openEnemyMenu('action', `敵${enemy.name}　${origin}${path.length ? ` → ${destination}` : ''}`, commands);
  const commandDetail = {move: `${destination} へ移動`, capture: `${destination} を占領`,
    attack: friendly ? `${coordinate(friendly.x, friendly.y)} の味方${friendly.name}を攻撃` : '', wait: `${origin} で待機`};
  const steps = commands.flatMap(({id}) => id === 'move'
    ? [{id, position: from, delay: 260}, ...path.map(position => ({id, position, delay: 145}))]
    : [{id, position: to, delay: 330}]);
  highlightEnemyRoute(path, to);

  function advance(index) {
    const step = steps[index];
    if (step) {
      movingEnemy = {unit: enemy, position: step.position};
      showEnemyChoice(step.id, step.id, commandDetail[step.id]);
      render();
      followEnemy(step.position);
      portraitMode.schedule(() => advance(index + 1), step.delay);
      return;
    }
    movingEnemy = null;
    highlightEnemyRoute([]);
    if (friendly) {
      presentAttack({attacker: 'enemy', enemy, friendly, enemyPosition: to,
        resolve: () => game.resolveEnemyAction(action), onReturn: runEnemyTurn});
      return;
    }
    game.resolveEnemyAction(action);
    saveProgress();
    runEnemyTurn(restoreFocus);
  }
  advance(0);
}

function playEnemyProduction(order, restoreFocus) {
  const {factory, type} = order;
  const spot = coordinate(factory.x, factory.y);
  openEnemyMenu('production', `敵工場 ${spot}`, productionTypes.map(({id, name, cost}) => ({id, label: name, cost})));
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
      portraitMode.schedule(() => runEnemyTurn(restoreFocus), 520);
    }, 390);
  }, 280);
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
  if (!game.result) announceTurn('friendly');
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
for (const button of productionButtons) {
  button.addEventListener('click', event => {
    if (inputBlocked() || repeatedTap(event, productionOrigin?.event) || !game.produce(button.dataset.produce, selectedFactory)) return;
    saveProgress();
    render();
  });
}
for (const [index, button] of fieldButtons.entries()) {
  const dialog = fieldDialogs[index];
  button.addEventListener('click', () => {
    if (!mobileField || portraitMode.blocked || waitingForEnemy() || combatScreen.active || dialog.open) return;
    if (dialog === fieldOverview) drawOverview();
    dialog.showModal();
    if (dialog === fieldOverview) updateOverviewWindow();
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
  if (!portraitMode.blocked && !game.enemyTurn) document.getElementById('guide').showModal();
});
replay.addEventListener('click', () => {
  if (portraitMode.blocked || combatScreen.active || game.enemyTurn || !game.result) return;
  game = new BattleMap();
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
  updateMapScrollNote();
  updateOverviewWindow();
}
window.addEventListener('resize', resizeGame);
compactControls.addEventListener('change', resizeGame);
portraitMode.onChange(resizeGame);
showMap();
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(updateMapScrollNote).observe(mapSurround);
}
