const portraitMode = (() => {
  const phone = navigator.userAgentData?.mobile || /\b(?:iPhone|iPod|Android.*Mobile)\b/.test(navigator.userAgent);
  const landscapePhone = window.matchMedia(phone ? '(orientation: landscape)'
    : '(orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse)');
  const notice = document.getElementById('portrait-notice');
  const timers = new Set();

  function start(timer) {
    timer.deadline = performance.now() + timer.remaining;
    timer.id = setTimeout(() => {
      timer.id = null;
      if (landscapePhone.matches) {
        timer.remaining = 0;
        return;
      }
      timers.delete(timer);
      timer.run();
    }, timer.remaining);
  }

  function sync() {
    const blocked = landscapePhone.matches;
    if (blocked) {
      const now = performance.now();
      for (const timer of timers) {
        if (timer.id === null) continue;
        clearTimeout(timer.id);
        timer.id = null;
        timer.remaining = Math.max(0, timer.deadline - now);
      }
      combatAudio.stop();
      if (!notice.open) notice.showModal();
      document.documentElement.classList.add('portrait-blocked');
    } else {
      if (notice.open) notice.close();
      document.documentElement.classList.remove('portrait-blocked');
      for (const timer of timers) {
        if (timer.id === null) start(timer);
      }
    }
    music.setOrientationBlocked(blocked);
  }

  notice.addEventListener('cancel', event => event.preventDefault());
  landscapePhone.addEventListener('change', sync);
  sync();

  return {
    get blocked() { return landscapePhone.matches; },
    onChange(listener) { landscapePhone.addEventListener('change', listener); },
    schedule(run, delay) {
      const timer = {run, remaining: delay, id: null};
      timers.add(timer);
      if (!landscapePhone.matches) start(timer);
      return timer;
    },
    cancel(timer) {
      if (timers.delete(timer)) clearTimeout(timer.id);
    },
  };
})();
