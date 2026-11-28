const combatScreen = (() => {
  // Every unit shows one figure per remaining HP.
  const footKinds = new Set(['infantry', 'antitank', 'mortar']);
  const dialog = document.getElementById('combat-screen');
  const advance = document.getElementById('combat-advance');
  const status = document.getElementById('combat-status');
  const stage = document.getElementById('combat-stage');
  const speech = dialog.querySelector('.combat-speech');
  const speaker = document.getElementById('combat-speaker');
  const quote = document.getElementById('combat-quote');
  const cutIn = dialog.querySelector('.combat-cut-in');
  const cutInUnit = cutIn.querySelector('img');
  const cutInTitle = document.getElementById('combat-cut-in-title');
  const cutInDetail = document.getElementById('combat-cut-in-detail');
  const finale = document.getElementById('combat-outcome');
  const finaleTitle = document.getElementById('combat-outcome-title');
  const camera = dialog.querySelector('.combat-camera');
  const backdrop = camera.querySelector('.combat-backdrop img');
  const volley = camera.querySelector('.combat-volley');
  const rays = volley.getElementsByTagName('i');
  const puffs = volley.getElementsByTagName('b');
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

  // What each weapon fires, for the look and arc of its rounds.
  const rounds = {fighter: 'missile', drone: 'missile', samlauncher: 'missile', cruiser: 'missile', destroyer: 'missile',
    antitank: 'missile', striker: 'missile', artillery: 'shell', mortar: 'shell', bomber: 'bomb', submarine: 'torpedo'};
  const profileRounds = {infantry: 'bullet', scout: 'tracer', support: 'rocket', tank: 'shell'};
  // Stereo position (-0.85 left … 0.85 right) for a point across the field (0…1).
  const panAt = x => Math.max(-.85, Math.min(.85, x * 2 - 1));

  function attackTactics(kind) {
    const detail = tactics[kind] ?? tactics.tank;
    return {...tactics[detail.profile], ...detail};
  }
  const teamNames = {};
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hpTicks = {player: 0, enemy: 0};
  let scene = null;

  const commands = {
    land: '狙いを合わせろ！',
    sea: '各艦、攻撃用意！',
    air: '目標をとらえた！',
  };
  const weaponCommands = {
    torpedo: '魚雷、発射用意！',
    bomb: '投下位置についた！',
    missile: '目標をロックした！',
  };

  function clearCutIn() {
    cutIn.hidden = true;
    delete dialog.dataset.rare;
  }

  function showSpeech(side, message) {
    speech.dataset.side = side;
    speaker.textContent = teamNames[side];
    quote.textContent = message;
    speech.hidden = false;
  }

  // Each battle requests a single panorama. Keep the terrain visible if the image is slow or unavailable.
  backdrop.addEventListener('load', () => {
    backdrop.classList.add('is-ready');
    backdrop.parentElement.classList.add('has-panorama');
  });
  backdrop.addEventListener('error', () => {
    backdrop.classList.remove('is-ready');
    backdrop.parentElement.classList.remove('has-panorama');
  });

  function showPanorama() {
    const units = Object.values(formations);
    const coastal = units.some(formation => formation.dataset.domain === 'sea');
    const skies = units.every(formation => formation.dataset.domain === 'air');
    const ground = units.filter(({dataset}) => dataset.domain === 'land').map(({dataset}) => dataset.terrain);
    const ruined = ground.includes('ruins');
    const wooded = ground.includes('forest') || ground.includes('jungle');
    dialog.toggleAttribute('data-coastal', coastal);
    dialog.toggleAttribute('data-skies', skies);
    const panorama = coastal ? 'bay' : skies ? 'clouds' : ruined ? 'ruins' : wooded ? 'forest' : 'valley';
    dialog.dataset.panorama = panorama;
    const path = './assets/battle-' + panorama + '.webp';
    if (backdrop.getAttribute('src') === path && (backdrop.naturalWidth || !backdrop.complete)) return;
    backdrop.classList.remove('is-ready');
    backdrop.parentElement.classList.remove('has-panorama');
    backdrop.src = path;
  }

  function showForces({playerHP, enemyHP}, animateLoss = false) {
    for (const [side, hp] of [
      ['player', playerHP],
      ['enemy', enemyHP],
    ]) {
      // The bar drops at once, a red trail of the lost HP shrinks after it, and the number counts down.
      const label = document.getElementById('combat-' + side + '-hp');
      const bar = document.getElementById('combat-' + side + '-bar');
      const max = scene.map.maxHP;
      const from = Number(label.dataset.hp ?? hp);
      const hurt = animateLoss && hp < from;
      cancelAnimationFrame(hpTicks[side]);
      label.dataset.hp = hp;
      bar.toggleAttribute('data-instant', !animateLoss);
      bar.style.setProperty('--hp-fill', hp / max * 100 + '%');
      bar.style.setProperty('--hp-ghost', hp / max * 100 + '%');
      bar.parentElement.toggleAttribute('data-hurt', hurt);
      bar.parentElement.toggleAttribute('data-down', hurt && hp === 0);
      if (hurt && !motion.matches) {
        const start = performance.now();
        const tick = now => {
          const t = Math.min(1, (now - start) / 480);
          label.textContent = Math.round(from - (from - hp) * (1 - (1 - t) ** 3)) + '/' + max;
          if (t < 1) hpTicks[side] = requestAnimationFrame(tick);
        };
        label.textContent = from + '/' + max;
        hpTicks[side] = requestAnimationFrame(tick);
      } else {
        label.textContent = hp + '/' + max;
      }
      const formation = formations[side];
      const count = hp;
      // Lost units fall one after another, front rank first (at most 330ms apart in all).
      const lost = [...formation.children].slice(count).filter(fighter => !fighter.classList.contains('retreating'));
      const step = Math.min(110, 330 / Math.max(lost.length - 1, 1));
      lost.forEach((fighter, index) => {
        if (!animateLoss || motion.matches) return fighter.remove();
        fighter.style.setProperty('--loss-delay', Math.round(index * step) + 'ms');
        fighter.classList.add('retreating');
      });
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
        // A fixed per-slot jitter keeps the volley ragged without randomness.
        const jitter = (slot * 37 + rank * 13) % 29;
        const delay = (column < 3 ? rank * 154 + column * 19 : 308 + (column - 3) * 23 + rank * 22) + jitter;
        fighter.style.setProperty('--fire-delay', delay + 'ms');
        if (!footKinds.has(formation.dataset.kind)) {
          const slots = formation.hasAttribute('data-roomy') ? roomySlots : machineSlots;
          const place = slots[slot] ?? slots[0];
          fighter.style.setProperty('--vx', place.x + '%');
          fighter.style.setProperty('--vy', place.y + '%');
          fighter.style.setProperty('--vs', place.scale);
          fighter.style.setProperty('--vz', place.z);
          fighter.style.setProperty('--fire-delay', slot * 90 + jitter + 'ms');
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
    dialog.dataset.attackDomain = formations[attacker].dataset.domain;
    dialog.dataset.defenseProfile = formations[defender].dataset.profile;
    dialog.dataset.defenseDomain = formations[defender].dataset.domain;
    dialog.dataset.round = rounds[dialog.dataset.armament] ?? profileRounds[dialog.dataset.attackProfile] ?? 'shell';
    dialog.dataset.defenseTerrain = formations[defender].hasAttribute('data-fortress') ? 'fortress' : formations[defender].dataset.terrain;
    delete dialog.dataset.lethal;
    for (const flag of ['data-guarded', 'data-deflected', 'data-armored', 'data-glance']) dialog.removeAttribute(flag);
  }

  function beginStrike(attacker) {
    removeRetreatingFighters();
    clearCutIn();
    stageAttack(attacker);
    dialog.dataset.phase = 'aim';
    const first = scene.nextStrike === 0;
    dialog.dataset.strike = first ? 'first' : 'counter';
    stage.textContent = first ? '先攻' : '反撃';
    const team = teamNames[attacker];
    const previous = scene.strikes[scene.nextStrike - 1];
    const hp = attacker === 'player' ? previous?.playerHP ?? scene.startHP.player : previous?.enemyHP ?? scene.startHP.enemy;
    const power = `（戦力 ${Math.round(hp / scene.map.maxHP * 100)}%）`;
    status.textContent = (first ? `${team}が構えた。` : `${team}が反撃の構え。`) + power;
    const command = weaponCommands[dialog.dataset.round] ?? commands[dialog.dataset.attackDomain];
    showSpeech(attacker, first ? command : 'まだ終わっていない！');
    if (!first) combatAudio.play('accent-counter', attacker === 'player' ? -.4 : .4, {gain: .65});
    // A counterattack braces a little longer than the opening shot.
    const aim = attackTactics(dialog.dataset.armament).aim + (first ? 0 : 200);
    scene.timer = portraitMode.schedule(startVolley, motion.matches ? 460 : Math.max(350, aim));
  }

  function startVolley() {
    const fromPlayer = dialog.dataset.attacker === 'player';
    const {slots, muzzle, flight, attack} = attackTactics(dialog.dataset.armament);
    const [muzzleX, muzzleY] = window.UnitArt?.muzzle(dialog.dataset.armament) ?? muzzle;
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
    const lights = camera.parentElement.style;
    for (const [lane, ray] of [...rays].entries()) {
      const laneSpec = squadron && attackers[lane] ? [lane, (slots[lane] ?? slots[0])[1]] : slots[lane];
      const shooter = attackers[laneSpec?.[0]];
      ray.hidden = !shooter;
      puffs[lane].hidden = !shooter;
      if (!shooter) continue;
      const [slot, pause] = laneSpec;
      const delay = Number.parseInt(shooter.style.getPropertyValue('--fire-delay'), 10) + pause;
      lastShot = Math.max(lastShot, delay);
      ray.style.setProperty('--shot-delay', `${delay}ms`);
      ray.style.setProperty('--flight', `${flight}ms`);
      const [fromX, fromY] = point(shooter, fromPlayer ? muzzleX : 1 - muzzleX, muzzleY);
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
      puffs[lane].style.cssText = ray.style.cssText;
      if (lane === 0) {
        // The camera carries the impact point so it can zoom on it; the blast layers inherit it.
        camera.style.setProperty('--hit-x', toX * 100 + '%');
        camera.style.setProperty('--hit-y', toY * 100 + '%');
        camera.style.setProperty('--wake-x', fromX * 100 + '%');
        camera.style.setProperty('--wake-y', fromY * 100 + '%');
        camera.style.setProperty('--wake-delay', `${delay}ms`);
        lights.setProperty('--flare-x', fromX * 100 + '%');
        lights.setProperty('--flare-y', fromY * 100 + '%');
        lights.setProperty('--flare-delay', `${delay}ms`);
        lights.setProperty('--glow-x', toX * 100 + '%');
        lights.setProperty('--glow-y', toY * 100 + '%');
      }
    }
    // The camera follows the last round to the target.
    camera.style.setProperty('--cam-delay', `${lastShot}ms`);
    camera.style.setProperty('--cam-follow', `${flight}ms`);
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

  function showRareImpact(hit, remaining) {
    const counterKill = scene.nextStrike > 1 && remaining === 0;
    const rare = counterKill ? 'counter' : hit.critical && remaining === 0 ? 'breakthrough' : hit.critical ? 'critical' : '';
    if (!rare) return false;
    const label = {
      counter: hit.critical ? '反撃でクリティカル撃破' : '反撃で撃破',
      breakthrough: 'クリティカル撃破',
      critical: 'クリティカル',
    };
    cutInTitle.textContent = label[rare];
    cutInDetail.textContent = `${teamNames[hit.attacker]} · ${hit.damage}ダメージ`;
    const art = window.UnitArt;
    if (art) cutInUnit.src = art.still(dialog.dataset.armament, hit.attacker === 'player' ? 'friendly' : 'enemy');
    cutInUnit.hidden = !art;
    dialog.dataset.rare = rare;
    cutIn.hidden = false;
    if (rare !== 'critical') {
      music.duck(900);
      combatAudio.play('accent-breakthrough', 0, {at: .09, gain: .68});
    }
    return true;
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
    const deflected = !hit.damage;
    document.getElementById('combat-damage').textContent = deflected ? (hit.armored ? '弾かれた！' : 'ノーダメージ')
      : hit.critical ? `−${hit.damage}!` : `−${hit.damage}`;
    dialog.toggleAttribute('data-critical', Boolean(hit.critical));
    dialog.toggleAttribute('data-deflected', deflected);
    dialog.toggleAttribute('data-armored', Boolean(hit.armored));
    dialog.toggleAttribute('data-glance', !hit.critical && (deflected || (hit.armored && hit.damage < 2)));
    // Terrain or a fortress (not armor alone) took part of the hit.
    dialog.toggleAttribute('data-guarded', hit.mitigation > 0 && (!hit.armored || hit.covered));
    // How hard the hit lands drives blast size, camera shake and the damage number.
    dialog.dataset.hitTier = deflected ? 'none' : hit.critical || remaining === 0 || hit.damage >= 5 ? 'heavy'
      : hit.damage <= 1 ? 'light' : 'normal';
    const cover = document.getElementById('combat-cover');
    cover.textContent = defense;
    cover.hidden = !defense;
    status.textContent = defense ? `${impact}（${defense}）` : impact;
    dialog.dataset.lethal = String(remaining === 0);
    dialog.dataset.phase = 'impact';
    speech.hidden = true;
    const hitX = Number.parseFloat(camera.style.getPropertyValue('--hit-x')) / 100;
    const pan = Number.isFinite(hitX) ? panAt(hitX) : hit.attacker === 'player' ? .55 : -.55;
    const body = `${remaining ? 'impact' : 'defeat'}-${dialog.dataset.defender}:${dialog.dataset.defenseDomain}`;
    if (deflected) {
      combatAudio.play(body, pan, {gain: .45});
      combatAudio.play('accent-blocked', pan, {at: .03});
    } else {
      combatAudio.play(body, pan);
      if (hit.critical) combatAudio.play('accent-critical', pan * .5);
      if (!remaining) combatAudio.play('accent-kill', pan * .3, {at: .16});
    }
    const rare = showRareImpact(hit, remaining);
    if (!rare && deflected && hit.armored) showSpeech(hit.attacker === 'player' ? 'enemy' : 'player', '装甲で弾いた！');
    const next = scene.strikes[scene.nextStrike];
    // Criticals hold a short hit-stop; a long line of losses gets time to fall.
    const lossSpan = Math.max(0, Math.min(dialog.querySelectorAll('.retreating').length - 1, 4) * 80);
    scene.timer = portraitMode.schedule(() => {
      if (next) beginStrike(next.attacker);
      else showResult(true);
    }, motion.matches ? (rare ? 900 : deflected ? 700 : 460) : (remaining ? 860 : 1060) + (rare ? 200 : 0) + lossSpan);
  }

  function showResult(autoReturn) {
    portraitMode.cancel(scene.timer);
    combatAudio.stop();
    // Skipping mid-impact must not leave falling units, critical styling or rounds on the result.
    removeRetreatingFighters();
    clearCutIn();
    speech.hidden = true;
    dialog.removeAttribute('data-critical');
    for (const ray of rays) ray.hidden = true;
    for (const puff of puffs) puff.hidden = true;
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
    delete dialog.dataset.strike;
    dialog.dataset.phase = 'result';
    const winner = outcome.enemyHP === 0 ? 'player' : outcome.playerHP === 0 ? 'enemy' : '';
    if (winner) dialog.dataset.winner = winner; else delete dialog.dataset.winner;
    stage.textContent = winner === 'player' ? '撃破！' : winner === 'enemy' ? '被撃破' : '交戦終了';
    advance.textContent = 'マップに戻る';
    if (verdict) {
      dialog.dataset.outcome = verdict;
      finaleTitle.textContent = title;
      finale.hidden = false;
      music.setScene(verdict);
    } else if (autoReturn) {
      scene.timer = portraitMode.schedule(close, 2000);
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
      if (scene.skipClickTime !== null && now - scene.skipClickTime < 320) return;
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
      && event.target.localName === 'i' && !event.pseudoElement) {
      const fromX = Number.parseFloat(event.target.style.getPropertyValue('--from-x')) / 100;
      combatAudio.play(`shot-${dialog.dataset.armament}`, Number.isFinite(fromX) ? panAt(fromX) : dialog.dataset.attacker === 'player' ? -.62 : .62);
    }
  });

  return {
    get active() { return scene !== null; },
    open({map, attacker, friendly, enemy, enemyPosition, resolve, onReturn}) {
      if (scene) return;
      scene = {map, onReturn, strikes: null, nextStrike: 0, timer: null, skipClickTime: null};
      speech.hidden = true;
      clearCutIn();
      for (const [side, prefix, unit, position] of [['player', '味方', friendly, friendly], ['enemy', '敵', enemy, enemyPosition]]) {
        const terrain = map.terrainAt(position.x, position.y);
        teamNames[side] = prefix + unit.name;
        document.getElementById('combat-' + side + '-name').textContent = teamNames[side];
        const fortress = map.scenario && (unit.type.domain ?? 'land') === 'land' && map.facilityAt(position.x, position.y)?.kind === 'fortress';
        document.getElementById('combat-' + side + '-terrain').textContent = fortress ? '要塞' : terrain.name;
        formations[side].dataset.terrain = terrain.id;
        formations[side].toggleAttribute('data-fortress', Boolean(fortress));
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
        // Land machines also use the posed atlas (fire, recoil, hit, down) when it is available.
        const posed = !detail.profile || Boolean(art && (footKinds.has(id) || domain === 'land'));
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
      showPanorama();
      versus.querySelector('.versus-ally').textContent = teamNames.player;
      versus.querySelector('.versus-foe').textContent = teamNames.enemy;
      for (const [side, selector, hp] of [['player', '.versus-ally', friendly.hp], ['enemy', '.versus-foe', enemy.hp]]) {
        versus.querySelector(selector).dataset.detail = `HP ${hp}/${map.maxHP}${side === attacker ? ' · 先攻' : ''}`;
      }
      scene.startHP = {player: friendly.hp, enemy: enemy.hp};
      document.getElementById('combat-turn').textContent = `ターン ${map.turn} · ${attacker === 'enemy' ? '敵の手番' : '味方の手番'}`;
      advance.textContent = '演出をスキップ';
      showForces({playerHP: friendly.hp, enemyHP: enemy.hp});
      delete dialog.dataset.outcome;
      delete dialog.dataset.winner;
      delete dialog.dataset.hitTier;
      finale.hidden = true;
      combatAudio.prepare(Object.values(formations).flatMap(({dataset: {kind, domain}}) =>
        [`shot-${kind}`, `impact-${kind}:${domain}`, `defeat-${kind}:${domain}`])
        .concat(['accent-critical', 'accent-blocked', 'accent-kill', 'accent-counter', 'accent-breakthrough']));
      stageAttack(attacker);
      delete dialog.dataset.strike;
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
