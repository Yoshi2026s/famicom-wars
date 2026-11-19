const combatAudio = (() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = 'famicom-wars-combat-audio';
  const buttons = [...document.querySelectorAll('[data-combat-audio]')];
  const sources = new Set();
  const effects = new Map();
  let context;
  let enabled = false;
  try {
    enabled = localStorage.getItem(preferenceKey) === 'on';
  } catch {
    // The controls still work for this visit when storage is unavailable.
  }

  function syncButtons() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(enabled && Boolean(Audio)));
      button.querySelector('b').textContent = enabled && Audio ? 'ON' : 'OFF';
      button.disabled = !Audio;
    }
  }

  function unlock() {
    if (!enabled || !Audio) return;
    try {
      context ??= new Audio();
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Audio is optional, including when the device denies playback.
    }
  }

  function makeEffect(kind) {
    const impact = kind === 'impact';
    const duration = impact ? 0.32 : 0.14;
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(rate * duration), rate);
    const samples = buffer.getChannelData(0);
    let seed = 26393;
    let smoothNoise = 0;
    let phase = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      smoothNoise += (noise - smoothNoise) * (impact ? 0.09 : 0.22);
      const time = i / rate;
      const progress = time / duration;
      phase += (impact ? 112 - 62 * progress : 350 - 215 * progress) / rate;
      const tone = Math.sin(phase * 2 * Math.PI);
      const envelope = Math.min(1, time / 0.0025, (duration - time) / .015) * Math.exp(-time * (impact ? 18 : 27));
      const tail = noise * Math.max(0, 1 - progress) ** 5 * .027;
      samples[i] = envelope * (impact ? .35 * tone + .25 * smoothNoise : .25 * (noise - smoothNoise) + .11 * tone) + tail;
    }
    return buffer;
  }

  function play(kind, pan = 0) {
    if (!enabled || document.hidden || context?.state !== 'running') return;
    if (!effects.has(kind)) effects.set(kind, makeEffect(kind));
    const source = context.createBufferSource();
    source.buffer = effects.get(kind);
    const panner = context.createStereoPanner?.();
    if (panner) {
      panner.pan.value = pan;
      source.connect(panner);
      panner.connect(context.destination);
    } else {
      source.connect(context.destination);
    }
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      panner?.disconnect();
    };
    source.start();
    sources.add(source);
  }

  function stop() {
    for (const source of sources) {
      source.disconnect();
      source.stop();
    }
    sources.clear();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      enabled = !enabled;
      try {
        localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
      } catch {
        // Keep the setting in memory for this visit.
      }
      syncButtons();
      if (enabled) unlock();
      else stop();
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== preferenceKey && event.key !== null) return;
    enabled = event.newValue === 'on';
    syncButtons();
    if (!enabled) stop();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  syncButtons();
  return {unlock, play, stop};
})();
