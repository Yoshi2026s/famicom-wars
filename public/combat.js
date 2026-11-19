const combatScreen = (() => {
  const dialog = document.getElementById('combat-screen');
  const advance = document.getElementById('combat-advance');
  const status = document.getElementById('combat-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;

  function showForces({playerHP, enemyHP}, animateLoss = false) {
    for (const [side, team, hp] of [
      ['player', 'ally', playerHP],
      ['enemy', 'foe', enemyHP],
    ]) {
      document.getElementById('combat-' + side + '-hp').textContent = hp + '/' + scene.map.maxHP;
      document.getElementById('combat-' + side + '-bar').style.setProperty('--hp-fill', hp / scene.map.maxHP * 100 + '%');
      const formation = dialog.querySelector('.formation.' + team);
      for (const fighter of [...formation.children].slice(hp)) {
        if (animateLoss && !motion.matches) fighter.classList.add('retreating');
        else fighter.remove();
      }
      while (formation.childElementCount < hp) {
        const fighter = document.createElement('span');
        fighter.className = 'fighter';
        const slot = formation.childElementCount;
        fighter.style.setProperty('--column', slot % 5);
        fighter.style.setProperty('--rank', Math.floor(slot / 5));
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
    dialog.dataset.phase = 'attack';
    const team = attacker === 'player' ? '味方歩兵' : '敵歩兵';
    status.textContent = team + (scene.nextStrike === 0 ? 'の攻撃！' : 'の反撃！');
    if (motion.matches) scene.soundTimer = setTimeout(() => combatAudio.play('shot'), 100);
    scene.timer = setTimeout(showImpact, motion.matches ? 250 : 1100);
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
    combatAudio.play('impact');
    const next = scene.strikes[scene.nextStrike];
    scene.timer = setTimeout(next ? () => beginStrike(next.attacker) : showResult, motion.matches ? 460 : 740);
  }

  function showResult() {
    clearTimeout(scene.timer);
    clearTimeout(scene.soundTimer);
    combatAudio.stop();
    scene.strikes ??= scene.resolve();
    const [attack, counter] = scene.strikes;
    const outcome = counter ?? attack;
    showForces(outcome);
    const result = outcome.playerHP === 0 ? '味方歩兵が撃破されました。'
      : outcome.enemyHP === 0 ? '敵歩兵を撃破しました。' : '戦闘終了。';
    const report = scene.strikes.map((hit, index) => {
      const action = index === 0 ? '先攻' : '反撃';
      const defense = defenseMessage(hit);
      return `${action} ${hit.damage}ダメージ${defense ? `（${defense}）` : ''}`;
    });
    status.textContent = result + report.join('、') + '。';
    dialog.dataset.phase = 'result';
    advance.textContent = 'マップに戻る';
    scene.timer = setTimeout(close, 2200);
  }

  function close(restoreFocus = true) {
    if (!scene) return;
    scene.strikes ??= scene.resolve();
    const completed = scene;
    scene = null;
    clearTimeout(completed.timer);
    clearTimeout(completed.soundTimer);
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
  dialog.querySelector('.combat-volley').addEventListener('animationstart', (event) => {
    if (scene && dialog.dataset.phase === 'attack' && event.animationName === 'tracer') combatAudio.play('shot');
  });

  return {
    get active() { return scene !== null; },
    open(map, attacker, resolve, onReturn) {
      if (scene) return;
      combatAudio.unlock();
      scene = {map, resolve, onReturn, strikes: null, nextStrike: 0, timer: null, soundTimer: null};
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
      beginStrike(attacker);
      dialog.showModal();
      music.setScene('battle');
      document.getElementById('combat-title').focus({preventScroll: true});
    },
    close,
  };
})();
