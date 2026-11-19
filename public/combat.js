const combatScreen = (() => {
  const dialog = document.getElementById('combat-screen');
  const advance = document.getElementById('combat-advance');
  const status = document.getElementById('combat-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;

  function showForces({playerHP, enemyHP}) {
    for (const [side, team, hp] of [
      ['player', 'ally', playerHP],
      ['enemy', 'foe', enemyHP],
    ]) {
      document.getElementById('combat-' + side + '-hp').textContent = hp + '/' + scene.map.maxHP;
      const formation = dialog.querySelector('.formation.' + team);
      while (formation.childElementCount > hp) formation.lastElementChild.remove();
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

  function beginStrike(attacker) {
    dialog.dataset.attacker = attacker;
    dialog.dataset.phase = 'attack';
    const team = attacker === 'player' ? '味方歩兵' : '敵歩兵';
    status.textContent = team + (scene.nextStrike === 0 ? 'の攻撃！' : 'の反撃！');
    scene.timer = setTimeout(showImpact, motion.matches ? 250 : 820);
  }

  function defenseMessage(hit) {
    return hit.mitigation ? `${hit.terrain}で${hit.mitigation}軽減` : '';
  }

  function showImpact() {
    scene.strikes ??= scene.resolve();
    const hit = scene.strikes[scene.nextStrike++];
    showForces(hit);
    const target = hit.attacker === 'player' ? '敵歩兵' : '味方歩兵';
    const remaining = hit.attacker === 'player' ? hit.enemyHP : hit.playerHP;
    const impact = remaining
      ? `${target}に${hit.damage}ダメージ。残りHP ${remaining}`
      : `${target}を${hit.damage}ダメージで撃破。`;
    const defense = defenseMessage(hit);
    status.textContent = defense ? `${impact}（${defense}）` : impact;
    dialog.dataset.phase = 'impact';
    const next = scene.strikes[scene.nextStrike];
    scene.timer = setTimeout(next ? () => beginStrike(next.attacker) : showResult, 460);
  }

  function showResult() {
    clearTimeout(scene.timer);
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
    scene.timer = setTimeout(close, 1800);
  }

  function close(restoreFocus = true) {
    if (!scene) return;
    scene.strikes ??= scene.resolve();
    const completed = scene;
    scene = null;
    clearTimeout(completed.timer);
    dialog.close();
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

  return {
    get active() { return scene !== null; },
    open(map, attacker, resolve, onReturn) {
      if (scene) return;
      scene = {map, resolve, onReturn, strikes: null, nextStrike: 0, timer: null};
      dialog.classList.toggle('platoon', map.isBattle);
      const enemyPosition = attacker === 'enemy' ? map.planEnemyTurn().to : map.enemy;
      document.getElementById('combat-player-terrain').textContent = map.terrainAt(map.x, map.y).name;
      document.getElementById('combat-enemy-terrain').textContent = map.terrainAt(enemyPosition.x, enemyPosition.y).name;
      document.getElementById('combat-turn').textContent = 'ターン ' + map.turn;
      advance.textContent = '演出をスキップ';
      showForces(map);
      beginStrike(attacker);
      dialog.showModal();
      document.getElementById('combat-title').focus({preventScroll: true});
    },
    close,
  };
})();
