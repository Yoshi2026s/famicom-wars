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
      for (const fighter of [...formation.children].slice(hp)) {
        if (animateLoss && !motion.matches) fighter.classList.add('retreating');
        else fighter.remove();
      }
      while (formation.childElementCount < hp) {
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
    const team = attacker === 'player' ? '味方歩兵' : '敵歩兵';
    status.textContent = first ? `${team}が構えた。` : `${team}が反撃の構え。`;
    scene.timer = setTimeout(startVolley, motion.matches ? 90 : 360);
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
    const team = fromPlayer ? '味方歩兵' : '敵歩兵';
    status.textContent = `${team}の${scene.nextStrike === 0 ? '攻撃' : '反撃'}！`;
    if (motion.matches) combatAudio.play('shot', fromPlayer ? -.62 : .62);
    scene.timer = setTimeout(showImpact, motion.matches ? 160 : lastShot + 350);
  }

  function defenseMessage(hit) {
    return hit.mitigation ? `${hit.terrain}で${hit.mitigation}軽減` : '';
  }

  function showImpact() {
    scene.strikes ??= scene.resolve();
    const hit = scene.strikes[scene.nextStrike++];
    showForces(hit, true);
    const target = hit.attacker === 'player' ? '敵歩兵' : '味方歩兵';
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
    scene.timer = setTimeout(next ? () => beginStrike(next.attacker) : showResult, motion.matches ? 460 : 900);
  }

  function showResult() {
    clearTimeout(scene.timer);
    combatAudio.stop();
    scene.strikes ??= scene.resolve();
    const [attack, counter] = scene.strikes;
    const outcome = counter ?? attack;
    showForces(outcome);
    const verdict = scene.map.result ?? (outcome.enemyHP === 0 ? 'victory' : null);
    const title = verdict === 'victory' ? '勝利' : '敗北';
    const result = verdict === 'victory' ? '勝利。敵歩兵を撃破しました。'
      : verdict === 'defeat' ? '敗北。味方歩兵が全滅しました。' : '戦闘終了。';
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
    } else {
      scene.timer = setTimeout(close, 2200);
    }
  }

  function close(restoreFocus = true) {
    if (!scene) return;
    scene.strikes ??= scene.resolve();
    const completed = scene;
    scene = null;
    clearTimeout(completed.timer);
    combatAudio.stop();
    removeRetreatingFighters();
    dialog.close();
    music.setScene('map');
    completed.onReturn(restoreFocus);
  }

  function advanceScene() {
    if (!scene) return;
    if (dialog.dataset.phase === 'result') close();
    else showResult();
  }
  advance.addEventListener('click', advanceScene);
  advance.addEventListener('keydown', (event) => {
    if (event.repeat && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (scene) advanceScene();
  });
  volley.addEventListener('animationstart', (event) => {
    if (scene && dialog.dataset.phase === 'attack' && event.animationName === 'shot-trail') {
      combatAudio.play('shot', dialog.dataset.attacker === 'player' ? -.62 : .62);
    }
  });

  return {
    get active() { return scene !== null; },
    open(map, attacker, resolve, onReturn) {
      if (scene) return;
      combatAudio.unlock();
      scene = {map, resolve, onReturn, strikes: null, nextStrike: 0, timer: null};
      dialog.classList.toggle('platoon', map.isBattle);
      const enemyPosition = attacker === 'enemy' ? map.planEnemyTurn().to : map.enemy;
      for (const [side, team, position] of [['player', 'ally', map], ['enemy', 'foe', enemyPosition]]) {
        const terrain = map.terrainAt(position.x, position.y);
        document.getElementById('combat-' + side + '-terrain').textContent = terrain.name;
        dialog.querySelector('.formation.' + team).dataset.terrain = terrain.id;
      }
      document.getElementById('combat-turn').textContent = 'ターン ' + map.turn;
      advance.textContent = '演出をスキップ';
      showForces(map);
      delete dialog.dataset.outcome;
      finale.hidden = true;
      dialog.dataset.attacker = attacker;
      dialog.dataset.phase = 'entry';
      status.textContent = '交戦開始';
      dialog.showModal();
      music.setScene('battle');
      document.getElementById('combat-title').focus({preventScroll: true});
      if (motion.matches) beginStrike(attacker);
      else scene.timer = setTimeout(() => beginStrike(attacker), 420);
    },
    close,
  };
})();
