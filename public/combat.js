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

  function showImpact() {
    scene.strikes ??= scene.resolve();
    const hit = scene.strikes[scene.nextStrike++];
    showForces(hit);
    const target = hit.attacker === 'player' ? '敵歩兵' : '味方歩兵';
    const remaining = hit.attacker === 'player' ? hit.enemyHP : hit.playerHP;
    status.textContent = remaining ? target + 'に1ダメージ。残りHP ' + remaining : target + 'が撃破されました。';
    dialog.dataset.phase = 'impact';
    const next = scene.strikes[scene.nextStrike];
    scene.timer = setTimeout(next ? () => beginStrike(next.attacker) : showResult, 460);
  }

  function showResult() {
    clearTimeout(scene.timer);
    scene.strikes ??= scene.resolve();
    const outcome = scene.strikes.at(-1);
    showForces(outcome);
    if (outcome.playerHP === 0) status.textContent = '味方歩兵が撃破されました。';
    else if (outcome.enemyHP === 0) status.textContent = '敵歩兵を撃破しました。';
    else status.textContent = '戦闘終了。味方HP ' + outcome.playerHP + '、敵HP ' + outcome.enemyHP + '。';
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
