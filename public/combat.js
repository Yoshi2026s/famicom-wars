const combatScreen = (() => {
  // Every unit shows one figure per remaining HP.
  const footKinds = new Set(['infantry', 'antitank', 'mortar']);
  const dialog = document.getElementById('combat-screen');
  const advance = document.getElementById('combat-advance');
  const status = document.getElementById('combat-status');
  const stage = document.getElementById('combat-stage');
  const finale = document.getElementById('combat-outcome');
  const finaleTitle = document.getElementById('combat-outcome-title');
  const camera = dialog.querySelector('.combat-camera');
  const backdrop = camera.querySelector('.combat-backdrop img');
  const volley = camera.querySelector('.combat-volley');
  const impactEffects = camera.querySelector('.combat-hit');
  const formations = {player: camera.querySelector('.ally'), enemy: camera.querySelector('.foe')};
  const versus = dialog.querySelector('.combat-versus');
  // Machines (vehicles, aircraft and ships) stand in up to three staggered ranks, one per HP; the first
  // slots are the front line, so survivors stay up front as losses are removed from the back.
  const machineSlots = [
    {x: 40, y: 6, scale: .66, z: 10}, {x: 12, y: 8, scale: .64, z: 9}, {x: 64, y: 10, scale: .62, z: 8},
    {x: 28, y: 22, scale: .58, z: 7}, {x: 52, y: 25, scale: .56, z: 6}, {x: 2, y: 26, scale: .56, z: 5},
    {x: 72, y: 29, scale: .54, z: 4}, {x: 16, y: 39, scale: .5, z: 3}, {x: 40, y: 41, scale: .48, z: 2},
    {x: 62, y: 44, scale: .46, z: 1},
  ];
  // Five or fewer machines get the original roomier line-up at a larger size.
  const roomySlots = [
    {x: 40, y: 8, scale: 1, z: 5}, {x: 4, y: 10, scale: .97, z: 4}, {x: 22, y: 29, scale: .82, z: 3},
    {x: 52, y: 31, scale: .8, z: 2}, {x: 0, y: 34, scale: .76, z: 1},
  ];
  const tactics = {
    infantry: {slots: [[0, 0], [5, 0], [3, 0]], muzzle: [.89, .57], hit: .56, aim: 320, flight: 240, attack: '一斉射撃'},
    scout: {slots: [[0, 0], [0, 82], [0, 164]], muzzle: [.88, .44], hit: .66, aim: 245, flight: 210, attack: '機銃を連射'},
    support: {slots: [[0, 0], [0, 120]], muzzle: [.66, .16], hit: .58, aim: 415, flight: 525, attack: '支援弾を発射'},
    tank: {slots: [[0, 0]], muzzle: [.96, .48], hit: .61, aim: 420, flight: 250, attack: '主砲を発射'},
    artillery: {profile: 'support', slots: [[0, 0]], muzzle: [.84, .34], flight: 575, attack: '榴弾を発射'},
    rocket: {profile: 'support', slots: [[0, 0], [0, 85], [0, 170]], muzzle: [.72, .36], flight: 510, attack: 'ロケット弾を斉射'},
    antiair: {profile: 'scout', muzzle: [.77, .38], flight: 185, attack: '対空砲を連射'},
    helicopter: {profile: 'support', muzzle: [.77, .60], hit: .50, flight: 340, attack: 'ロケット弾を発射'},
    fighter: {profile: 'scout', slots: [[0, 0], [0, 115]], muzzle: [.78, .48], hit: .48, flight: 235, attack: '空対空ミサイルを発射'},
    bomber: {profile: 'tank', slots: [[0, 0], [0, 135]], muzzle: [.57, .68], hit: .52, flight: 440, attack: '爆弾を投下'},
    patrol: {profile: 'scout', muzzle: [.78, .50], hit: .58, attack: '速射砲を連射'},
    destroyer: {profile: 'support', muzzle: [.76, .45], hit: .57, flight: 410, attack: '誘導弾を発射'},
    battleship: {profile: 'tank', slots: [[0, 0], [0, 125]], muzzle: [.78, .43], hit: .58, flight: 395, attack: '艦砲を斉射'},
    antitank: {profile: 'infantry', attack: '対戦車ロケットを発射'},
    heavytank: {profile: 'tank', attack: '主砲を発射'},
    drone: {profile: 'scout', hit: .5, attack: '誘導ミサイルを発射'},
    submarine: {profile: 'support', hit: .62, flight: 460, attack: '魚雷を発射'},
    mortar: {profile: 'infantry', flight: 520, attack: '迫撃砲を発射'},
    samlauncher: {profile: 'support', flight: 380, attack: '対空ミサイルを発射'},
    cruiser: {profile: 'support', hit: .57, flight: 400, attack: '艦対空ミサイルを発射'},
    striker: {profile: 'tank', hit: .52, flight: 300, attack: '対地ロケットを発射'},
  };

  function attackTactics(kind) {
    const detail = tactics[kind] ?? tactics.tank;
    return {...tactics[detail.profile], ...detail};
  }
  const teamNames = {};
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;

  backdrop.decode().then(() => backdrop.classList.add('is-ready')).catch(() => {
    // Keep the painted fallback if the panorama fails to load.
  });

  // Swap in the code-painted realistic panorama (scene-art.js) once the browser is idle.
  let sceneryRequested = false;
  function paintScenery() {
    if (!window.SceneArt || sceneryRequested) return;
    sceneryRequested = true;
    try {
      window.SceneArt.backdropAsync(url => {
        const image = new Image();
        image.src = url;
        image.decode().then(() => {
          backdrop.src = url;
          document.documentElement.classList.add('scene-art');
          backdrop.classList.add('is-ready');
        }).catch(() => {});
      });
    } catch {
      // Keep the original panorama.
    }
  }
  if (window.SceneArt) (window.requestIdleCallback ?? (task => setTimeout(task, 1500)))(paintScenery, {timeout: 4000});

  function showForces({playerHP, enemyHP}, animateLoss = false) {
    for (const [side, hp] of [
      ['player', playerHP],
      ['enemy', enemyHP],
    ]) {
      document.getElementById('combat-' + side + '-hp').textContent = hp + '/' + scene.map.maxHP;
      document.getElementById('combat-' + side + '-bar').style.setProperty('--hp-fill', hp / scene.map.maxHP * 100 + '%');
      const formation = formations[side];
      const count = hp;
      for (const fighter of [...formation.children].slice(count)) {
        if (animateLoss && !motion.matches) fighter.classList.add('retreating');
        else fighter.remove();
      }
      if (!formation.childElementCount) formation.toggleAttribute('data-roomy', count <= roomySlots.length);
      while (formation.childElementCount < count) {
        const fighter = document.createElement('span');
        fighter.className = 'fighter';
        if (formation.hasAttribute('data-static')) {
          const sprite = document.createElement('span');
          sprite.className = 'fighter-sprite';
          fighter.append(sprite);
        }
        const slot = formation.childElementCount;
        const column = slot % 5;
        const rank = Math.floor(slot / 5);
        fighter.style.setProperty('--column', column);
        fighter.style.setProperty('--rank', rank);
        const delay = column < 3 ? rank * 154 + column * 19 : 308 + (column - 3) * 23 + rank * 22;
        fighter.style.setProperty('--fire-delay', delay + 'ms');
        if (!footKinds.has(formation.dataset.kind)) {
          const slots = formation.hasAttribute('data-roomy') ? roomySlots : machineSlots;
          const place = slots[slot] ?? slots[0];
          fighter.style.setProperty('--vx', place.x + '%');
          fighter.style.setProperty('--vy', place.y + '%');
          fighter.style.setProperty('--vs', place.scale);
          fighter.style.setProperty('--vz', place.z);
          fighter.style.setProperty('--fire-delay', slot * 90 + 'ms');
          fighter.style.setProperty('--bob-delay', slot * -370 + 'ms');
        }
        formation.append(fighter);
      }
    }
  }

  function removeRetreatingFighters() {
    dialog.querySelectorAll('.retreating').forEach(fighter => fighter.remove());
  }

  function stageAttack(attacker) {
    const defender = attacker === 'player' ? 'enemy' : 'player';
    formations[attacker].dataset.role = 'attacking';
    formations[defender].dataset.role = 'defending';
    dialog.dataset.attacker = attacker;
    dialog.dataset.armament = formations[attacker].dataset.kind;
    dialog.dataset.defender = formations[defender].dataset.kind;
    dialog.dataset.attackProfile = formations[attacker].dataset.profile;
    dialog.dataset.defenseProfile = formations[defender].dataset.profile;
    dialog.dataset.defenseDomain = formations[defender].dataset.domain;
    delete dialog.dataset.lethal;
  }

  function beginStrike(attacker) {
    removeRetreatingFighters();
    stageAttack(attacker);
    dialog.dataset.phase = 'aim';
    const first = scene.nextStrike === 0;
    stage.textContent = first ? '先攻' : '反撃';
    const team = teamNames[attacker];
    const previous = scene.strikes[scene.nextStrike - 1];
    const hp = attacker === 'player' ? previous?.playerHP ?? scene.startHP.player : previous?.enemyHP ?? scene.startHP.enemy;
    const power = `（戦力 ${Math.round(hp / scene.map.maxHP * 100)}%）`;
    status.textContent = (first ? `${team}が構えた。` : `${team}が反撃の構え。`) + power;
    scene.timer = portraitMode.schedule(startVolley, motion.matches ? 90 : attackTactics(dialog.dataset.armament).aim);
  }

  function startVolley() {
    const fromPlayer = dialog.dataset.attacker === 'player';
    const {slots, muzzle, flight, attack} = attackTactics(dialog.dataset.armament);
    const hitHeight = attackTactics(dialog.dataset.defender).hit;
    const attackers = formations[fromPlayer ? 'player' : 'enemy'].children;
    const squadron = !footKinds.has(formations[fromPlayer ? 'player' : 'enemy'].dataset.kind);
    const defenders = formations[fromPlayer ? 'enemy' : 'player'].children;
    const view = camera.getBoundingClientRect();
    const point = (unit, x, y) => {
      const box = unit.getBoundingClientRect();
      return [(box.left + box.width * x - view.left) / view.width, (box.top + box.height * y - view.top) / view.height];
    };
    let lastShot = 0;
    for (const [lane, ray] of [...volley.children].entries()) {
      const laneSpec = squadron && attackers[lane] ? [lane, (slots[lane] ?? slots[0])[1]] : slots[lane];
      const shooter = attackers[laneSpec?.[0]];
      ray.hidden = !shooter;
      if (!shooter) continue;
      const [slot, pause] = laneSpec;
      const delay = Number.parseInt(shooter.style.getPropertyValue('--fire-delay'), 10) + pause;
      lastShot = Math.max(lastShot, delay);
      ray.style.setProperty('--shot-delay', `${delay}ms`);
      ray.style.setProperty('--flight', `${flight}ms`);
      const [fromX, fromY] = point(shooter, fromPlayer ? muzzle[0] : 1 - muzzle[0], muzzle[1]);
      const [toX, toY] = point(defenders[slot] ?? defenders[0], .50, hitHeight + lane * .03);
      const dx = (toX - fromX) * view.width;
      const dy = (toY - fromY) * view.height;
      const angle = Math.atan2(dy, dx);
      const arc = view.height * (.20 + lane * .042);
      for (const [property, value] of [['from-x', fromX], ['from-y', fromY], ['to-x', toX], ['to-y', toY]]) {
        ray.style.setProperty('--' + property, value * 100 + '%');
      }
      ray.style.setProperty('--angle', `${angle}rad`);
      ray.style.setProperty('--arc-rise', `${arc}px`);
      ray.style.setProperty('--launch', `${Math.atan2(dy - arc * 2, dx)}rad`);
      ray.style.setProperty('--fall', `${Math.atan2(dy + arc * 2, dx)}rad`);
      if (lane === 0) {
        impactEffects.style.setProperty('--hit-x', toX * 100 + '%');
        impactEffects.style.setProperty('--hit-y', toY * 100 + '%');
      }
    }
    dialog.dataset.phase = 'attack';
    const team = teamNames[dialog.dataset.attacker];
    status.textContent = `${team}が${attack}！`;
    if (motion.matches) combatAudio.play(`shot-${dialog.dataset.armament}`, fromPlayer ? -.62 : .62);
    scene.timer = portraitMode.schedule(showImpact, motion.matches ? 160 : lastShot + flight + 35);
  }

  function defenseMessage(hit) {
    if (!hit.mitigation) return '';
    const source = hit.armored ? (hit.covered ? `${hit.terrain}と装甲` : '装甲') : hit.terrain;
    return `${source}で${hit.mitigation}軽減`;
  }

  function showImpact() {
    const hit = scene.strikes[scene.nextStrike++];
    showForces(hit, true);
    const target = teamNames[hit.attacker === 'player' ? 'enemy' : 'player'];
    const remaining = hit.attacker === 'player' ? hit.enemyHP : hit.playerHP;
    const critical = hit.critical ? 'クリティカル！' : '';
    const impact = !hit.damage ? `${target}にダメージを与えられない！残りHP ${remaining}`
      : remaining ? `${critical}${target}に${hit.damage}ダメージ。残りHP ${remaining}`
      : `${critical}${target}を${hit.damage}ダメージで撃破。`;
    const defense = defenseMessage(hit);
    document.getElementById('combat-damage').textContent = hit.critical ? `−${hit.damage}!` : `−${hit.damage}`;
    dialog.toggleAttribute('data-critical', Boolean(hit.critical));
    const cover = document.getElementById('combat-cover');
    cover.textContent = defense;
    cover.hidden = !defense;
    status.textContent = defense ? `${impact}（${defense}）` : impact;
    dialog.dataset.lethal = String(remaining === 0);
    dialog.dataset.phase = 'impact';
    combatAudio.play(`${remaining ? 'impact' : 'defeat'}-${dialog.dataset.defender}:${dialog.dataset.defenseDomain}`, hit.attacker === 'player' ? .55 : -.55);
    const next = scene.strikes[scene.nextStrike];
    scene.timer = portraitMode.schedule(() => {
      if (next) beginStrike(next.attacker);
      else showResult(true);
    }, motion.matches ? 460 : remaining ? 860 : 1060);
  }

  function showResult(autoReturn) {
    portraitMode.cancel(scene.timer);
    combatAudio.stop();
    const [attack, counter] = scene.strikes;
    const outcome = counter ?? attack;
    showForces(outcome);
    const verdict = scene.map.result;
    const title = verdict === 'victory' ? '勝利' : '敗北';
    const result = verdict === 'victory' ? '勝利。敵部隊をすべて撃破しました。' : verdict === 'defeat' ? '敗北。味方部隊が全滅しました。'
      : outcome.enemyHP === 0 ? `${teamNames.enemy}を撃破しました。`
      : outcome.playerHP === 0 ? `${teamNames.player}が撃破されました。` : '戦闘終了。';
    const report = scene.strikes.map((hit, index) => {
      const action = index === 0 ? '先攻' : '反撃';
      const defense = defenseMessage(hit);
      return `${action} ${hit.damage}ダメージ${hit.critical ? '（クリティカル）' : ''}${defense ? `（${defense}）` : ''}`;
    });
    status.textContent = result + report.join('、') + '。';
    dialog.dataset.phase = 'result';
    advance.textContent = 'マップに戻る';
    if (verdict) {
      dialog.dataset.outcome = verdict;
      finaleTitle.textContent = title;
      finale.hidden = false;
      music.setScene(verdict);
    } else if (autoReturn) {
      scene.timer = portraitMode.schedule(close, 2200);
    }
  }

  function close(restoreFocus = true) {
    if (!scene) return;
    const completed = scene;
    scene = null;
    portraitMode.cancel(completed.timer);
    combatAudio.stop();
    removeRetreatingFighters();
    // Restyle the map once: lift the map-hiding class in the same style pass as the modal's inert state.
    document.documentElement.classList.remove('combat-open');
    dialog.close();
    if (!completed.map.result) music.setScene('map');
    completed.onReturn(restoreFocus);
  }

  function advanceScene() {
    if (!scene || portraitMode.blocked) return;
    if (dialog.dataset.phase === 'result') close();
    else showResult(false);
  }
  advance.addEventListener('click', (event) => {
    if (!scene || portraitMode.blocked) return;
    if (event.detail > 0) {
      // Touch clicks can carry a timestamp from before the result appeared.
      const now = performance.now();
      if (scene.skipClickTime !== null && (event.detail > 1 || now - scene.skipClickTime < 300)) return;
      if (dialog.dataset.phase !== 'result') scene.skipClickTime = now;
    }
    advanceScene();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.repeat && event.key === 'Escape') event.preventDefault();
  });
  advance.addEventListener('keydown', (event) => {
    if (event.repeat && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (scene) advanceScene();
  });
  volley.addEventListener('animationstart', (event) => {
    if (scene && !portraitMode.blocked && dialog.dataset.phase === 'attack'
      && (event.animationName === 'shot-trail' || event.animationName === 'rocket-trail')) {
      combatAudio.play(`shot-${dialog.dataset.armament}`, dialog.dataset.attacker === 'player' ? -.62 : .62);
    }
  });

  return {
    get active() { return scene !== null; },
    open({map, attacker, friendly, enemy, enemyPosition, resolve, onReturn}) {
      if (scene) return;
      scene = {map, onReturn, strikes: null, nextStrike: 0, timer: null, skipClickTime: null};
      for (const [side, prefix, unit, position] of [['player', '味方', friendly, friendly], ['enemy', '敵', enemy, enemyPosition]]) {
        const terrain = map.terrainAt(position.x, position.y);
        teamNames[side] = prefix + unit.name;
        document.getElementById('combat-' + side + '-name').textContent = teamNames[side];
        const fortress = map.scenario && (unit.type.domain ?? 'land') === 'land' && map.facilityAt(position.x, position.y)?.kind === 'fortress';
        document.getElementById('combat-' + side + '-terrain').textContent = fortress ? '要塞' : terrain.name;
        formations[side].dataset.terrain = terrain.id;
        paintScenery();
        if (window.SceneArt && ['forest', 'mountain', 'marsh'].includes(terrain.id)) {
          formations[side].style.setProperty('--cover-image', `url("${window.SceneArt.cover(terrain.id)}")`);
        } else {
          formations[side].style.removeProperty('--cover-image');
        }
        const {id, domain = 'land'} = unit.type;
        const formation = formations[side];
        formation.replaceChildren();
        const detail = attackTactics(id);
        formation.dataset.kind = id;
        formation.dataset.domain = domain;
        formation.dataset.profile = detail.profile ?? (Object.hasOwn(tactics, id) ? id : 'tank');
        const art = window.UnitArt;
        // Foot soldiers use the posed atlas (aim, duck, hit, down) whenever code-drawn art is available.
        const posed = !detail.profile || Boolean(art && footKinds.has(id));
        formation.toggleAttribute('data-static', !posed);
        const staticSprite = side === 'enemy' ? `enemy-${id}` : id;
        if (!posed) {
          formation.style.setProperty('--unit-static', `url("./assets/${staticSprite}.png?v=coastal")`);
          formation.style.setProperty('--muzzle-x', `${detail.muzzle[0] * 100}%`);
          formation.style.setProperty('--muzzle-y', `${detail.muzzle[1] * 100 - 14}%`);
        } else {
          for (const property of ['--unit-static', '--muzzle-x', '--muzzle-y']) formation.style.removeProperty(property);
        }
        const team = side === 'enemy' ? 'enemy' : 'friendly';
        formation.toggleAttribute('data-art', Boolean(art && posed));
        if (art) {
          const [muzzleX, muzzleY] = art.muzzle(id);
          formation.style.setProperty('--muzzle-x', `${muzzleX * 100}%`);
          formation.style.setProperty('--muzzle-y', `${muzzleY * 100 - 14}%`);
          if (!posed) formation.style.setProperty('--unit-static', `url("${art.still(id, team)}")`);
          else formation.style.setProperty('--unit-atlas', `url("${art.atlas(id, team)}")`);
        } else {
          formation.style.removeProperty('--unit-atlas');
        }
        const sprite = side === 'player' && id === 'support' ? 'friendly-support'
          : side === 'enemy' && (id === 'scout' || id === 'tank') ? `enemy-${id}` : id;
        formation.dataset.unit = sprite;
      }
      dialog.toggleAttribute('data-coastal', Object.values(formations).some(formation => formation.dataset.domain === 'sea'));
      dialog.toggleAttribute('data-skies', Object.values(formations).every(formation => formation.dataset.domain === 'air'));
      versus.querySelector('.versus-ally').textContent = teamNames.player;
      versus.querySelector('.versus-foe').textContent = teamNames.enemy;
      scene.startHP = {player: friendly.hp, enemy: enemy.hp};
      document.getElementById('combat-turn').textContent = `ターン ${map.turn} · ${attacker === 'enemy' ? '敵の手番' : '味方の手番'}`;
      advance.textContent = '演出をスキップ';
      showForces({playerHP: friendly.hp, enemyHP: enemy.hp});
      delete dialog.dataset.outcome;
      finale.hidden = true;
      combatAudio.prepare(Object.values(formations).flatMap(({dataset: {kind, domain}}) =>
        [`shot-${kind}`, `impact-${kind}:${domain}`, `defeat-${kind}:${domain}`]));
      stageAttack(attacker);
      dialog.dataset.phase = 'entry';
      status.textContent = '交戦開始';
      // showModal() restyles the whole page (everything else turns inert), so hide the map first to pay for that once.
      document.documentElement.classList.add('combat-open');
      dialog.showModal();
      scene.strikes = resolve();
      music.setScene('battle');
      document.getElementById('combat-title').focus({preventScroll: true});
      if (motion.matches) beginStrike(attacker);
      else scene.timer = portraitMode.schedule(() => beginStrike(attacker), 1050);
    },
  };
})();
