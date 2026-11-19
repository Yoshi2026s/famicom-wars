const combatScreen = (() => {
  const dialog = document.getElementById('combat-screen');
  const advance = document.getElementById('combat-advance');
  const status = document.getElementById('combat-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene = null;

  function showForces(map) {
    for (const [side, team, hp, max] of [
      ['player', 'ally', map.playerHP, map.isBattle ? 3 : 1],
      ['enemy', 'foe', map.enemyHP, map.isBattle ? 2 : 1],
    ]) {
      document.getElementById('combat-' + side + '-hp').textContent = hp + '/' + max;
      const formation = dialog.querySelector('.formation.' + team);
      while (formation.childElementCount > hp) formation.lastElementChild.remove();
      while (formation.childElementCount < hp) {
        const fighter = document.createElement('span');
        fighter.className = 'fighter';
        formation.append(fighter);
      }
    }
  }

  function resolveHit() {
    if (!scene || scene.resolved) return;
    scene.resolved = true;
    clearTimeout(scene.timer);
    scene.resolve();
    showForces(scene.map);
    const target = scene.attacker === 'player' ? '敵歩兵' : '味方歩兵';
    const remaining = scene.attacker === 'player' ? scene.map.enemyHP : scene.map.playerHP;
    status.textContent = remaining ? target + 'に1ダメージ。残りHP ' + remaining : target + 'が撃破されました。';
    dialog.dataset.phase = 'result';
    advance.textContent = 'マップに戻る';
    scene.timer = setTimeout(close, 1800);
  }

  function close(restoreFocus = true) {
    if (!scene) return;
    resolveHit();
    const completed = scene;
    scene = null;
    clearTimeout(completed.timer);
    dialog.close();
    completed.onReturn(restoreFocus);
  }

  function advanceScene() {
    if (scene?.resolved) close();
    else resolveHit();
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
      scene = {map, attacker, resolve, onReturn, resolved: false, timer: null};
      dialog.dataset.attacker = attacker;
      dialog.dataset.phase = 'attack';
      document.getElementById('combat-turn').textContent = 'ターン ' + map.turn;
      status.textContent = attacker === 'player' ? '味方歩兵の攻撃！' : '敵歩兵の攻撃！';
      advance.textContent = '演出をスキップ';
      showForces(map);
      dialog.showModal();
      document.getElementById('combat-title').focus({preventScroll: true});
      scene.timer = setTimeout(resolveHit, motion.matches ? 250 : 820);
    },
    close,
  };
})();
