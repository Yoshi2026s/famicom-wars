const music = (() => {
  const player = document.getElementById('bgm-player');
  const buttons = [...document.querySelectorAll('[data-bgm]')];
  const setting = 'famicom-wars-bgm';
  const tracks = {
    map: './assets/bgm-map.mp3?v=highland', battle: './assets/bgm-battle.mp3?v=volley',
    victory: './assets/bgm-victory.mp3?v=finale', defeat: './assets/bgm-defeat.mp3?v=finale',
  };
  const sources = {...tracks};
  const requested = new Set();
  let mapPosition = 0;
  let enabled = false;
  let unavailable = false;
  let interacted = false;
  let orientationBlocked = false;
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
    if (unavailable || !enabled || !interacted || document.hidden || orientationBlocked) {
      player.pause();
      return;
    }
    if (loadedScene !== scene) {
      player.loop = scene === 'map' || scene === 'battle';
      player.src = sources[scene];
      player.currentTime = scene === 'map' ? mapPosition : 0;
      loadedScene = scene;
      start();
    } else if (player.paused && !player.ended) {
      start();
    }
    if (scene === 'map') prefetch('battle');
    if (scene === 'battle') {
      prefetch('victory');
      prefetch('defeat');
    }
  }

  function prefetch(track) {
    if (requested.has(track) || location.protocol === 'file:') return;
    requested.add(track);
    fetch(tracks[track])
      .then((response) => {
        if (!response.ok) throw new Error('Track is unavailable');
        return response.blob();
      })
      .then((audio) => { sources[track] = URL.createObjectURL(audio); })
      .catch(() => {
        // The player can still request the original URL when the scene opens.
      });
  }

  function start() {
    const requestedScene = loadedScene;
    const requestedSource = player.src;
    player.play().catch((error) => {
      if (requestedScene !== loadedScene || requestedSource !== player.src || error.name !== 'NotSupportedError') return;
      if (requestedSource === sources[requestedScene] && requestedSource.startsWith('blob:')) {
        sources[requestedScene] = tracks[requestedScene];
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
    setOrientationBlocked(blocked) {
      orientationBlocked = blocked;
      updatePlayback();
    },
    setScene(nextScene) {
      if (scene !== nextScene && loadedScene === scene) {
        if (scene === 'map') mapPosition = player.currentTime;
        loadedScene = undefined;
      }
      scene = nextScene;
      updatePlayback();
    },
  };
})();
