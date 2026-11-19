const music = (() => {
  const player = document.getElementById('bgm-player');
  const buttons = [...document.querySelectorAll('[data-bgm]')];
  const setting = 'famicom-wars-bgm';
  const tracks = {map: './assets/bgm-map.wav', battle: './assets/bgm-battle.wav'};
  const positions = {map: 0, battle: 0};
  let enabled = false;
  let unavailable = false;
  let interacted = false;
  let scene = 'map';
  let loadedScene;
  player.volume = .45;
  try {
    enabled = localStorage.getItem(setting) === 'on';
  } catch {
    // The controls still work when storage is unavailable.
  }

  function updateButtons() {
    for (const button of buttons) {
      button.disabled = unavailable;
      button.setAttribute('aria-label', unavailable ? 'BGMは再生できません' : 'BGM');
      button.setAttribute('aria-pressed', String(enabled && !unavailable));
      button.querySelector('b').textContent = unavailable ? '再生不可' : enabled ? 'ON' : 'OFF';
    }
  }

  function updatePlayback() {
    if (unavailable || !enabled || !interacted || document.hidden) {
      player.pause();
      return;
    }
    if (loadedScene !== scene) {
      if (loadedScene) positions[loadedScene] = player.currentTime;
      player.src = tracks[scene];
      player.currentTime = positions[scene];
      loadedScene = scene;
      start();
    } else if (player.paused) {
      start();
    }
  }

  function start() {
    const requestedScene = loadedScene;
    player.play().catch((error) => {
      if (requestedScene === loadedScene && error.name === 'NotSupportedError') {
        unavailable = true;
        updateButtons();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.isTrusted || event.target.closest('[data-bgm]')) return;
    interacted = true;
    updatePlayback();
  }, true);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      interacted = true;
      enabled = !enabled;
      try {
        localStorage.setItem(setting, enabled ? 'on' : 'off');
      } catch {
        // Keep the choice in memory for this visit.
      }
      updateButtons();
      updatePlayback();
    });
  }
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('storage', (event) => {
    if (event.key !== setting && event.key !== null) return;
    enabled = event.newValue === 'on';
    updateButtons();
    updatePlayback();
  });
  updateButtons();
  return {
    setScene(nextScene) {
      scene = nextScene;
      updatePlayback();
    },
  };
})();
