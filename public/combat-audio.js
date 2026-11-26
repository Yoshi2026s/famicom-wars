const combatAudio = (() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = 'famicom-wars-combat-audio';
  const buttons = [...document.querySelectorAll('[data-combat-audio]')];
  const sources = new Set();
  const effects = new Map();
  let context;
  let resuming;
  let cueId = 0;
  let enabled = true;
  const battleCues = {
    // Seconds, initial pitch, pitch change, filter, body, noise and decay.
    'shot-infantry': [.13, 470, -320, .24, .08, .26, 29],
    'shot-scout': [.11, 590, -390, .20, .12, .21, 31],
    'shot-support': [.29, 218, 380, .14, .12, .24, 9],
    'shot-tank': [.34, 160, -110, .10, .32, .24, 12],
    'impact-infantry': [.19, 155, -75, .12, .13, .16, 20],
    'impact-scout': [.24, 332, -208, .20, .18, .18, 17],
    'impact-support': [.29, 116, -45, .11, .23, .20, 14],
    'impact-tank': [.31, 202, -158, .075, .26, .22, 14],
    'defeat-infantry': [.26, 132, -76, .12, .16, .19, 13],
    'defeat-scout': [.37, 232, -168, .15, .24, .23, 11],
    'defeat-support': [.47, 175, -119, .08, .28, .24, 8],
    'defeat-tank': [.56, 113, -63, .06, .34, .22, 7],
  };
  try {
    enabled = localStorage.getItem(preferenceKey) !== 'off';
  } catch {
    // The controls still work for this visit when storage is unavailable.
  }

  function syncButtons() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(enabled && Boolean(Audio)));
      button.setAttribute('aria-label', Audio ? '効果音' : '効果音は再生できません');
      button.querySelector('b').textContent = !Audio ? '再生不可' : enabled ? 'ON' : 'OFF';
      button.disabled = !Audio;
    }
  }

  function unlock() {
    if (!enabled || !Audio) return;
    try {
      context ??= new Audio();
      if (context.state !== 'running' && !resuming) {
        resuming = context.resume().catch(() => {}).finally(() => { resuming = undefined; });
      }
    } catch {
      // Audio is optional, including when the device denies playback.
    }
  }

  function makeEffect(kind) {
    if (kind === 'turn-friendly' || kind === 'turn-enemy') return makeTurnEffect(kind === 'turn-friendly');
    const [duration, pitch, slide, filter, body, texture, decay] = battleCues[kind];
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(rate * duration), rate);
    const samples = buffer.getChannelData(0);
    let seed = 26393;
    let smoothNoise = 0;
    let phase = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      smoothNoise += (noise - smoothNoise) * filter;
      const time = i / rate;
      const progress = time / duration;
      phase += (pitch + slide * progress) / rate;
      const tone = Math.sin(phase * 2 * Math.PI);
      const envelope = Math.min(1, time / .003, (duration - time) / .027) * Math.exp(-time * decay);
      const transient = noise * Math.exp(-time * 48) * .48 + smoothNoise * 1.6;
      samples[i] = envelope * (body * tone + texture * transient);
    }
    return buffer;
  }

  function makeTurnEffect(friendly) {
    const rate = context.sampleRate;
    const frequencies = friendly ? [523.25, 783.99] : [349.23, 261.63];
    const buffer = context.createBuffer(1, Math.ceil(rate * .4), rate);
    const samples = buffer.getChannelData(0);
    for (const [index, frequency] of frequencies.entries()) {
      const start = Math.round(index * .12 * rate);
      for (let i = start; i < samples.length; i++) {
        const time = (i - start) / rate;
        const phase = 2 * Math.PI * frequency * time;
        const envelope = Math.min(1, time / .012, (samples.length - i) / (.045 * rate)) * Math.exp(-9 * time);
        samples[i] += .17 * envelope * (Math.sin(phase) + .24 * Math.sin(phase * 2));
      }
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
    cueId++;
    for (const source of sources) {
      source.disconnect();
      source.stop();
    }
    sources.clear();
  }

  function playTurn(side) {
    const id = ++cueId;
    const kind = `turn-${side}`;
    if (context?.state === 'running') play(kind);
    else resuming?.then(() => {
      if (id === cueId) play(kind);
    });
  }

  document.addEventListener('click', (event) => {
    if (event.isTrusted && !event.target.closest('[data-combat-audio]') && !document.getElementById('portrait-notice').open) unlock();
  }, true);

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
    enabled = event.newValue !== 'off';
    syncButtons();
    if (!enabled) stop();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  syncButtons();
  return {play, playTurn, stop};
})();
