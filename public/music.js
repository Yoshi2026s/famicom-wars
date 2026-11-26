const music = (() => {
  const player = document.getElementById('bgm-player');
  const buttons = [...document.querySelectorAll('[data-bgm]')];
  const setting = 'famicom-wars-bgm';
  const tracks = {
    map: './assets/bgm-map.mp3?v=turn-score', battle: './assets/bgm-battle.mp3?v=turn-score',
    'enemy-map': './assets/bgm-enemy-map.mp3?v=turn-score',
    'enemy-battle': './assets/bgm-enemy-battle.mp3?v=turn-score',
    victory: './assets/bgm-victory.mp3?v=turn-score', defeat: './assets/bgm-defeat.mp3?v=turn-score',
  };
  const sources = {...tracks};
  const requested = new Set();
  let mapPosition = 0;
  let enabled = true;
  let unavailable = false;
  let interacted = false;
  let orientationBlocked = false;
  let turn = 'friendly';
  let scene = 'map';
  let loadedTrack;
  player.volume = .45;
  try {
    enabled = localStorage.getItem(setting) !== 'off';
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
    const track = turn === 'enemy' && (scene === 'map' || scene === 'battle') ? `enemy-${scene}` : scene;
    if (loadedTrack !== track) {
      player.loop = scene === 'map' || scene === 'battle';
      player.src = sources[track];
      player.currentTime = scene === 'map' ? mapPosition : 0;
      loadedTrack = track;
      start();
    } else if (player.paused && !player.ended) {
      start();
    }
    if (scene === 'map') {
      prefetch(turn === 'enemy' ? 'enemy-battle' : 'battle');
      prefetch(turn === 'enemy' ? 'map' : 'enemy-map');
    }
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
    const requestedTrack = loadedTrack;
    const requestedSource = player.src;
    player.play().catch((error) => {
      if (requestedTrack !== loadedTrack || requestedSource !== player.src || error.name !== 'NotSupportedError') return;
      if (requestedSource === sources[requestedTrack] && requestedSource.startsWith('blob:')) {
        sources[requestedTrack] = tracks[requestedTrack];
        URL.revokeObjectURL(requestedSource);
        loadedTrack = undefined;
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
    enabled = event.newValue !== 'off';
    updateButtons();
    updatePlayback();
  });
  updateButtons();
  return {
    setOrientationBlocked(blocked) {
      orientationBlocked = blocked;
      updatePlayback();
    },
    setTurn(side) {
      if (turn === side) return;
      turn = side;
      mapPosition = 0;
      if (loadedTrack === (turn === 'enemy' ? 'enemy-map' : 'map')) player.currentTime = 0;
      updatePlayback();
    },
    setScene(nextScene) {
      if (scene === 'map' && nextScene !== 'map' && loadedTrack === (turn === 'enemy' ? 'enemy-map' : 'map')) {
        mapPosition = player.currentTime;
      }
      scene = nextScene;
      updatePlayback();
    },
  };
})();
