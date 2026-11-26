const combatScreen = (() => {
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
  const teamNames = {};
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;

  backdrop.decode().then(() => backdrop.classList.add('is-ready')).catch(() => {
    // Keep the painted fallback if the panorama fails to load.
  });

  function showForces({playerHP, enemyHP}, animateLoss = false) {
    for (const [side, hp] of [
      ['player', playerHP],
      ['enemy', enemyHP],
    ]) {
      document.getElementById('combat-' + side + '-hp').textContent = hp + '/' + scene.map.maxHP;
      document.getElementById('combat-' + side + '-bar').style.setProperty('--hp-fill', hp / scene.map.maxHP * 100 + '%');
      const formation = formations[side];
      const count = formation.dataset.unit === 'infantry' ? hp : Number(hp > 0);
      for (const fighter of [...formation.children].slice(count)) {
        if (animateLoss && !motion.matches) fighter.classList.add('retreating');
        else fighter.remove();
      }
      while (formation.childElementCount < count) {
        const fighter = document.createElement('span');
        fighter.className = 'fighter';
        const slot = formation.childElementCount;
        const column = slot % 5;
        const rank = Math.floor(slot / 5);
        fighter.style.setProperty('--column', column);
        fighter.style.setProperty('--rank', rank);
        const delay = column < 3 ? rank * 154 + column * 19 : 308 + (column - 3) * 23 + rank * 22;
        fighter.style.setProperty('--fire-delay', delay + 'ms');
        formation.append(fighter);
      }
    }
  }

  function removeRetreatingFighters() {
    dialog.querySelectorAll('.retreating').forEach(fighter => fighter.remove());
  }

  function beginStrike(attacker) {
    removeRetreatingFighters();
    dialog.dataset.attacker = attacker;
    dialog.dataset.phase = 'aim';
    const first = scene.nextStrike === 0;
    stage.textContent = first ? '先攻' : '反撃';
    const team = teamNames[attacker];
    status.textContent = first ? `${team}が構えた。` : `${team}が反撃の構え。`;
    scene.timer = portraitMode.schedule(startVolley, motion.matches ? 90 : 360);
  }

  function startVolley() {
    const fromPlayer = dialog.dataset.attacker === 'player';
    const attackers = formations[fromPlayer ? 'player' : 'enemy'].children;
    const defenders = formations[fromPlayer ? 'enemy' : 'player'].children;
    const view = camera.getBoundingClientRect();
    const point = (unit, x, y) => {
      const box = unit.getBoundingClientRect();
      return [(box.left + box.width * x - view.left) / view.width, (box.top + box.height * y - view.top) / view.height];
    };
    let lastShot = 0;
    for (const [lane, slot] of [0, 5, 3].entries()) {
      const ray = volley.children[lane];
      const shooter = attackers[slot];
      ray.hidden = !shooter;
      if (!shooter) continue;
      const delay = shooter.style.getPropertyValue('--fire-delay');
      lastShot = Math.max(lastShot, Number.parseInt(delay, 10));
      ray.style.setProperty('--shot-delay', delay);
      const [fromX, fromY] = point(shooter, fromPlayer ? .90 : .10, .57);
      const [toX, toY] = point(defenders[slot] ?? defenders[0], .50, .61);
      const angle = Math.atan2((toY - fromY) * view.height, (toX - fromX) * view.width);
      for (const [property, value] of [['from-x', fromX], ['from-y', fromY], ['to-x', toX], ['to-y', toY]]) {
        ray.style.setProperty('--' + property, value * 100 + '%');
      }
      ray.style.setProperty('--angle', angle + 'rad');
      if (lane === 0) {
        impactEffects.style.setProperty('--hit-x', toX * 100 + '%');
        impactEffects.style.setProperty('--hit-y', toY * 100 + '%');
      }
    }
    dialog.dataset.phase = 'attack';
    const team = teamNames[dialog.dataset.attacker];
    status.textContent = `${team}の${scene.nextStrike === 0 ? '攻撃' : '反撃'}！`;
    if (motion.matches) combatAudio.play('shot', fromPlayer ? -.62 : .62);
    scene.timer = portraitMode.schedule(showImpact, motion.matches ? 160 : lastShot + 350);
  }

  function defenseMessage(hit) {
    return hit.mitigation ? `${hit.terrain}で${hit.mitigation}軽減` : '';
  }

  function showImpact() {
    scene.strikes ??= scene.resolve();
    const hit = scene.strikes[scene.nextStrike++];
    showForces(hit, true);
    const target = teamNames[hit.attacker === 'player' ? 'enemy' : 'player'];
    const remaining = hit.attacker === 'player' ? hit.enemyHP : hit.playerHP;
    const impact = remaining
      ? `${target}に${hit.damage}ダメージ。残りHP ${remaining}`
      : `${target}を${hit.damage}ダメージで撃破。`;
    const defense = defenseMessage(hit);
    document.getElementById('combat-damage').textContent = `−${hit.damage}`;
    const cover = document.getElementById('combat-cover');
    cover.textContent = defense;
    cover.hidden = !defense;
    status.textContent = defense ? `${impact}（${defense}）` : impact;
    dialog.dataset.phase = 'impact';
    combatAudio.play('impact', hit.attacker === 'player' ? .55 : -.55);
    const next = scene.strikes[scene.nextStrike];
    scene.timer = portraitMode.schedule(() => {
      if (next) beginStrike(next.attacker);
      else showResult(true);
    }, motion.matches ? 460 : 900);
  }

  function showResult(autoReturn) {
    portraitMode.cancel(scene.timer);
    combatAudio.stop();
    scene.strikes ??= scene.resolve();
    const [attack, counter] = scene.strikes;
    const outcome = counter ?? attack;
    showForces(outcome);
    const verdict = scene.map.result ?? (!scene.map.isBattle && outcome.enemyHP === 0 ? 'victory' : null);
    const title = verdict === 'victory' ? '勝利' : '敗北';
    const defeated = scene.map.isCrossing ? '味方部隊が全滅しました。' : `${teamNames.player}が撃破されました。`;
    const victory = scene.map.isCrossing ? '敵部隊をすべて撃破しました。' : `${teamNames.enemy}を撃破しました。`;
    const result = verdict === 'victory' ? `勝利。${victory}` : verdict === 'defeat' ? `敗北。${defeated}`
      : outcome.enemyHP === 0 ? `${teamNames.enemy}を撃破しました。`
      : outcome.playerHP === 0 ? `${teamNames.player}が撃破されました。` : '戦闘終了。';
    const report = scene.strikes.map((hit, index) => {
      const action = index === 0 ? '先攻' : '反撃';
      const defense = defenseMessage(hit);
      return `${action} ${hit.damage}ダメージ${defense ? `（${defense}）` : ''}`;
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
    scene.strikes ??= scene.resolve();
    const completed = scene;
    scene = null;
    portraitMode.cancel(completed.timer);
    combatAudio.stop();
    removeRetreatingFighters();
    dialog.close();
    music.setScene('map');
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
      // Some touch browsers report each tap as a single click.
      if (scene.skipClickTime !== null && (event.detail > 1 || event.timeStamp - scene.skipClickTime < 300)) return;
      if (dialog.dataset.phase !== 'result') scene.skipClickTime = event.timeStamp;
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
    if (scene && !portraitMode.blocked && dialog.dataset.phase === 'attack' && event.animationName === 'shot-trail') {
      combatAudio.play('shot', dialog.dataset.attacker === 'player' ? -.62 : .62);
    }
  });

  return {
    get active() { return scene !== null; },
    open({map, attacker, friendly, enemy, enemyPosition, resolve, resolveOnOpen, onReturn}) {
      if (scene) return;
      combatAudio.unlock();
      scene = {map, resolve, onReturn, strikes: null, nextStrike: 0, timer: null, skipClickTime: null};
      dialog.classList.toggle('platoon', map.isBattle);
      for (const [side, prefix, unit, position] of [['player', '味方', friendly, friendly], ['enemy', '敵', enemy, enemyPosition]]) {
        const terrain = map.terrainAt(position.x, position.y);
        teamNames[side] = prefix + unit.name;
        document.getElementById('combat-' + side + '-name').textContent = teamNames[side];
        document.getElementById('combat-' + side + '-terrain').textContent = terrain.name;
        formations[side].dataset.terrain = terrain.id;
        const {id} = unit.type;
        const sprite = side === 'player' && id === 'support' ? 'friendly-support'
          : side === 'enemy' && (id === 'scout' || id === 'tank') ? `enemy-${id}` : id;
        formations[side].dataset.unit = sprite;
      }
      document.getElementById('combat-turn').textContent = 'ターン ' + map.turn;
      advance.textContent = '演出をスキップ';
      showForces({playerHP: friendly.hp, enemyHP: enemy.hp});
      delete dialog.dataset.outcome;
      finale.hidden = true;
      dialog.dataset.attacker = attacker;
      dialog.dataset.phase = 'entry';
      status.textContent = '交戦開始';
      dialog.showModal();
      if (resolveOnOpen) scene.strikes = resolve();
      music.setScene('battle');
      document.getElementById('combat-title').focus({preventScroll: true});
      if (motion.matches) beginStrike(attacker);
      else scene.timer = portraitMode.schedule(() => beginStrike(attacker), 420);
    },
    close,
  };
})();
