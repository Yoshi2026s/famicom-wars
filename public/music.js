const music = (() => {
  const player = document.getElementById('bgm-player');
  const buttons = [...document.querySelectorAll('[data-bgm]')];
  const setting = 'famicom-wars-bgm';
  const tracks = {map: './assets/bgm-map.mp3?v=highland', battle: './assets/bgm-battle.mp3?v=volley'};
  let mapPosition = 0;
  let battleSource = tracks.battle;
  let battleRequested = false;
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
      if (loadedScene === 'map') mapPosition = player.currentTime;
      player.src = scene === 'battle' ? battleSource : tracks.map;
      player.currentTime = scene === 'map' ? mapPosition : 0;
      loadedScene = scene;
      start();
    } else if (player.paused) {
      start();
    }
    if (scene === 'map' && !battleRequested && location.protocol !== 'file:') {
      battleRequested = true;
      fetch(tracks.battle)
        .then((response) => {
          if (!response.ok) throw new Error('Battle music is unavailable');
          return response.blob();
        })
        .then((track) => { battleSource = URL.createObjectURL(track); })
        .catch(() => {
          // The player can still request the original URL on entering combat.
        });
    }
  }

  function start() {
    const requestedScene = loadedScene;
    const requestedSource = player.src;
    player.play().catch((error) => {
      if (requestedScene !== loadedScene || requestedSource !== player.src || error.name !== 'NotSupportedError') return;
      if (requestedSource === battleSource && requestedSource.startsWith('blob:')) {
        battleSource = tracks.battle;
        URL.revokeObjectURL(requestedSource);
        loadedScene = undefined;
        updatePlayback();
        return;
      }
      unavailable = true;
      updateButtons();
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
