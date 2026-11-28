const combatAudio = (() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = 'famicom-wars-combat-audio';
  const buttons = [...document.querySelectorAll('[data-combat-audio]')];
  const sources = new Set();
  const effects = new Map();
  const lastStart = new Map();
  let context;
  let output;
  let resuming;
  let cueId = 0;
  let enabled = true;
  try {
    enabled = localStorage.getItem(preferenceKey) !== 'off';
  } catch {
    // The controls still work for this visit when storage is unavailable.
  }

  // Each unit fires its own weapon; impacts depend on what is hit (foot soldiers, armour, ships, aircraft).
  const weapons = {
    infantry: 'rifle', antitank: 'atRocket', mortar: 'mortar', scout: 'mg', antiair: 'flak', patrol: 'autocannon',
    tank: 'cannon', heavytank: 'heavyCannon', artillery: 'howitzer', support: 'supportRound', rocket: 'salvo',
    striker: 'airSalvo', helicopter: 'heliRocket', fighter: 'missile', drone: 'droneMissile', destroyer: 'shipMissile',
    samlauncher: 'sam', cruiser: 'fleetSam', bomber: 'bomb', battleship: 'navalGun', submarine: 'torpedo',
  };
  const footKinds = new Set(['infantry', 'antitank', 'mortar']);
  const materialOf = (unit, domain) => domain === 'sea' ? 'water' : domain === 'air' ? 'air'
    : footKinds.has(unit) ? 'foot' : 'armor';
  // Register of the body struck. Small frames ring above the heavier hulls.
  const bodyPitch = {
    infantry: 169, antitank: 204, mortar: 251, scout: 406, antiair: 348, support: 283, artillery: 231,
    rocket: 316, samlauncher: 269, tank: 189, heavytank: 146, drone: 690, fighter: 498,
    helicopter: 330, striker: 388, bomber: 252, patrol: 357, destroyer: 226, cruiser: 187,
    battleship: 134, submarine: 164,
  };
  // Peak level of each cue after normalising; map and menu sounds stay below the battle.
  const levels = {shot: .78, impact: .74, defeat: .86, accent: .64, move: .34, ui: .32, jingle: .5};

  function noteHz(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  /** Renders one cue into mono samples. Pure, so it can be tested without a sound device. */
  function synthesize(kind, rate = 44100, variant = 0) {
    const [stage, rest = ''] = kind.split(/-(.+)/);
    const [unit, domain = 'land'] = rest.split(':');
    let seed = (2166136261 ^ (variant + 1) * 7919) >>> 0;
    for (const char of kind) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Small pitch and timing differences so repeated shots never sound identical.
    const detune = 1 + (variant ? (rnd() - .5) * .1 : 0);
    const layers = [];
    let length = 0;
    const reach = end => { length = Math.max(length, end); };

    function noise({at = 0, dur, amp, f: [from, to = from], q = 1, attack = .002, decay = 8}) {
      dur = Math.min(dur, attack + 6.5 / decay);
      layers.push({type: 'noise', at, dur, amp, from: from * detune, to: to * detune, q, attack, decay});
      reach(at + dur);
    }
    function tone({at = 0, dur, amp, f: [from, to = from], wave = 'sine', attack = .003, decay = 6, drive = 0, vibrato = 0, tremolo = 0}) {
      dur = Math.min(dur, attack + 6.5 / decay);
      layers.push({type: 'tone', at, dur, amp, from: from * detune, to: to * detune, wave, attack, decay, drive, vibrato, tremolo});
      reach(at + dur);
    }
    function crack(at, amp = .8, bright = 2600) {
      noise({at, dur: .06, amp, f: [bright, bright * .45], q: .7, attack: .0008, decay: 55});
    }
    function boom(at, size = 1, amp = 1) {
      crack(at, .75 * amp, 3200);
      noise({at, dur: .35 + .45 * size, amp: .95 * amp, f: [1650, 270], q: .65, attack: .002, decay: 4.6 / size});
      tone({at, dur: .3 + .35 * size, amp: .6 * amp, f: [150, 52], decay: 5.5 / size, drive: 2.6});
      // The first part of the blast still has body when bass is lost to a phone speaker.
      tone({at: at + .009, dur: .15, amp: .33 * amp, f: [510, 230], wave: 'triangle', decay: 18});
      for (let i = 0; i < 2 + size * 3; i++) {
        noise({at: at + .09 + rnd() * .4 * size, dur: .045, amp: .22 * amp, f: [2200 + rnd() * 1800], q: 1.4, decay: 40});
      }
    }
    function gun(at, amp = 1, pitch = 1) {
      crack(at, .85 * amp, 2900 * pitch);
      noise({at, dur: .095, amp: .52 * amp, f: [1480 * pitch, 680 * pitch], q: .8, decay: 34});
      tone({at, dur: .06, amp: .32 * amp, f: [510 * pitch, 220 * pitch], decay: 46, drive: 1.6});
      noise({at: at + .026, dur: .023, amp: .22 * amp, f: [2050 * pitch, 1500 * pitch], q: 1.3, decay: 62});
    }
    function cannon(at, size = 1) {
      crack(at, .95, 2400);
      noise({at, dur: .22 + .2 * size, amp: .8, f: [1150, 320], q: .7, decay: 9 / size});
      tone({at, dur: .3 + .15 * size, amp: .7, f: [165 / size ** .3, 58], decay: 7 / size, drive: 3});
      tone({at: at + .005, dur: .12, amp: .32, f: [680, 340], decay: 26, wave: 'triangle'});
      // A short second knock carries the recoil through the lower midrange on a small speaker.
      tone({at: at + .042 * size, dur: .12, amp: .35, f: [450 / size ** .5, 210 / size ** .5], wave: 'triangle', decay: 26});
    }
    function whoosh(at, dur, from, to, amp = .5) {
      noise({at, dur, amp, f: [from, to], q: 2.2, attack: dur * .25, decay: 2.2 / dur});
    }
    function whistle(at, dur, from, to, amp = .16) {
      tone({at, dur, amp, f: [from, to], attack: .04, decay: .6 / dur, vibrato: .012});
    }
    function beep(at, freq, amp = .14) {
      tone({at, dur: .05, amp, f: [freq], wave: 'pulse', attack: .002, decay: 20});
    }
    function metal(at, amp = 1, pitch = 1) {
      crack(at, .55 * amp, 5200);
      for (const [ratio, gain, fade] of [[1, .32, 16], [2.76, .2, 22], [5.4, .13, 30], [8.9, .07, 40]]) {
        tone({at, dur: .45, amp: gain * amp, f: [620 * pitch * ratio * (1 + (rnd() - .5) * .03)], decay: fade});
      }
      noise({at, dur: .18, amp: .35 * amp, f: [3800, 1600], q: 1.2, decay: 22});
    }
    function thud(at, amp = 1) {
      noise({at, dur: .22, amp: .75 * amp, f: [1280, 400], q: .7, decay: 17});
      tone({at, dur: .16, amp: .45 * amp, f: [270, 115], decay: 20, drive: 2});
      noise({at: at + .03, dur: .32, amp: .22 * amp, f: [2400, 1200], q: .6, attack: .02, decay: 9});
    }
    function splash(at, size = 1, amp = 1) {
      noise({at, dur: .5 + .4 * size, amp: .7 * amp, f: [520, 2600], q: .55, attack: .025, decay: 3.8 / size});
      noise({at: at + .06, dur: .6 * size, amp: .28 * amp, f: [4200, 1800], q: .8, attack: .05, decay: 4});
      for (let i = 0; i < 6 + 6 * size; i++) {
        const pitch = 420 + rnd() * 900;
        tone({at: at + .12 + rnd() * .55 * size, dur: .045, amp: .07 * amp, f: [pitch, pitch * 1.7], decay: 30});
      }
    }
    function notes(sequence, {wave = 'triangle', amp = .3, decay = 5, step = .09, at = 0, gap = 0, attack = .004} = {}) {
      sequence.forEach((midi, index) => {
        if (midi === null) return;
        const dur = Array.isArray(midi) ? midi[1] : step + gap + .08;
        const pitch = Array.isArray(midi) ? midi[0] : midi;
        tone({at: at + index * step, dur, amp, f: [noteHz(pitch)], wave, decay, attack});
      });
    }

    if (stage === 'shot') {
      const offset = () => rnd() * .006;
      switch (weapons[unit] ?? 'cannon') {
        case 'rifle': for (let i = 0; i < 3; i++) gun(i * (.075 + rnd() * .02) + offset(), .9 - i * .12, 1.02); break;
        case 'mg': for (let i = 0; i < 6; i++) gun(i * .052 + offset(), .72 - i * .04, 1.12); break;
        case 'autocannon': for (let i = 0; i < 4; i++) gun(i * .085 + offset(), .9, .78); break;
        case 'flak':
          for (let i = 0; i < 7; i++) gun(i * .046 + offset(), .7, .7);
          for (let i = 0; i < 4; i++) noise({at: .32 + i * .07 + rnd() * .03, dur: .09, amp: .18, f: [1400], q: 1, decay: 30});
          break;
        case 'cannon': cannon(0, 1); break;
        case 'heavyCannon': cannon(0, 1.5); tone({at: .02, dur: .7, amp: .2, f: [95, 60], decay: 4, drive: 2}); break;
        case 'howitzer':
          cannon(0, 1.6);
          whistle(.25, .45, 2300, 1200, .1);
          break;
        case 'supportRound':
          gun(0, .78, .70);
          tone({at: .018, dur: .15, amp: .32, f: [360, 172], wave: 'triangle', decay: 14});
          whoosh(.035, .27, 920, 2380, .42);
          break;
        case 'mortar':
          tone({at: 0, dur: .08, amp: .55, f: [420, 180], decay: 30, drive: 2});
          noise({at: 0, dur: .14, amp: .5, f: [1600, 700], q: .9, decay: 24});
          whistle(.16, .4, 1900, 1050, .1);
          break;
        case 'atRocket':
          gun(0, .7, .8);
          whoosh(.02, .38, 2600, 900, .55);
          break;
        case 'salvo':
          for (let i = 0; i < 3; i++) {
            crack(i * .1, .5, 2000);
            whoosh(i * .1 + .01, .42, 3000, 800, .38);
          }
          break;
        case 'airSalvo':
          whoosh(0, .34, 1500, 610, .35);
          for (const at of [0, .072]) {
            crack(at, .59, 3200);
            whistle(at + .012, .21, 760, 1680, .14);
          }
          break;
        case 'heliRocket':
          tone({at: 0, dur: .55, amp: .1, f: [92], tremolo: 22, drive: 1.5, decay: 2});
          for (let i = 0; i < 2; i++) {
            crack(i * .13, .45, 2200);
            whoosh(i * .13, .35, 2800, 1000, .4);
          }
          break;
        case 'missile':
          beep(0, 1760);
          beep(.064, 2220);
          crack(.12, .52, 2400);
          whoosh(.12, .53, 700, 3100, .62);
          tone({at: .13, dur: .22, amp: .21, f: [420, 940], decay: 9, drive: 1.7});
          break;
        case 'droneMissile':
          tone({dur: .23, amp: .22, f: [770, 1050], tremolo: 33, decay: 6});
          beep(.012, 2637, .09);
          whoosh(.046, .28, 2200, 4900, .54);
          break;
        case 'shipMissile':
          tone({dur: .14, amp: .36, f: [260, 124], decay: 14, drive: 2});
          crack(.018, .64, 1950);
          whoosh(.034, .42, 870, 2700, .64);
          whistle(.08, .27, 860, 1610, .10);
          break;
        case 'fleetSam':
          beep(0, 1318, .12);
          beep(.048, 1976, .10);
          metal(.077, .28, .7);
          whoosh(.092, .44, 740, 3200, .66);
          break;
        case 'sam':
          beep(0, 1568, .12);
          beep(.06, 2093, .12);
          tone({at: .14, dur: .12, amp: .5, f: [260, 120], decay: 20, drive: 2});
          whoosh(.14, .6, 700, 3000, .55);
          break;
        case 'bomb':
          metal(0, .25, .7);
          tone({at: .025, dur: .14, amp: .3, f: [650, 330], decay: 16, wave: 'triangle'});
          whistle(.065, .57, 2480, 460, .26);
          whoosh(.07, .48, 2300, 720, .29);
          break;
        case 'navalGun':
          cannon(0, 1.7);
          cannon(.17, 1.4);
          noise({at: .05, dur: 1, amp: .2, f: [420, 140], q: .6, attack: .06, decay: 2.6});
          break;
        case 'torpedo':
          noise({at: 0, dur: .19, amp: .5, f: [1820, 620], q: .8, decay: 17});
          tone({at: .055, dur: .6, amp: .23, f: [580, 308], decay: 3.6, vibrato: .03, tremolo: 15});
          for (let i = 0; i < 8; i++) tone({at: .12 + rnd() * .45, dur: .04, amp: .06, f: [600 + rnd() * 600, 1300], decay: 30});
          break;
      }
      return finish('shot', .12);
    }

    // Short signatures can overlap the unit's attack or impact without masking the whole cue.
    if (stage === 'accent') {
      if (unit === 'critical') {
        crack(0, .9, 3550);
        tone({dur: .26, amp: .44, f: [440, 150], decay: 13, drive: 2.5});
        notes([[80, .11], [87, .14], [92, .19]], {at: .024, step: .038, amp: .34, decay: 11});
        noise({at: .085, dur: .22, amp: .31, f: [3250, 1600], q: 1.1, decay: 13});
      } else if (unit === 'counter') {
        metal(0, .4, .78);
        tone({at: .024, dur: .16, amp: .42, f: [1080, 510], wave: 'triangle', decay: 14});
        crack(.065, .49, 2240);
      } else if (unit === 'breakthrough') {
        whoosh(0, .24, 920, 2900, .44);
        notes([[69, .15], [76, .16], [81, .36]], {step: .07, amp: .41, wave: 'triangle', decay: 8});
        notes([[57, .32], null, [64, .36]], {step: .07, at: .02, amp: .26, decay: 7});
        crack(.146, .55, 2750);
      } else if (unit === 'blocked') {
        metal(0, .9, 1.7);
        tone({at: .047, dur: .25, amp: .33, f: [2870, 1000], decay: 10, vibrato: .025});
        noise({at: .028, dur: .11, amp: .28, f: [3720, 2100], q: 1.6, decay: 30});
      } else if (unit === 'kill') {
        tone({dur: .74, amp: .59, f: [205, 75], decay: 4.8, drive: 2.8});
        tone({at: .045, dur: .4, amp: .31, f: [780, 186], wave: 'triangle', decay: 7});
        noise({at: .04, dur: .82, amp: .42, f: [1080, 190], q: .6, attack: .04, decay: 3.2});
        for (let i = 0; i < 6; i++) noise({at: .17 + rnd() * .48, dur: .05, amp: .16, f: [1650 + rnd() * 1400], q: 1.4, decay: 40});
      } else {
        return new Float32Array(0);
      }
      return finish('accent', .1);
    }

    if (stage === 'impact' || stage === 'defeat') {
      const material = materialOf(unit, domain);
      const fatal = stage === 'defeat';
      const heavy = ['tank', 'heavytank', 'battleship', 'bomber', 'cruiser'].includes(unit) ? 1.25 : 1;
      const pitch = bodyPitch[unit] ?? 240;
      // Brief material-specific tails sit behind the impact and leave the critical/block accents clear.
      if (material === 'water') {
        tone({at: .025, dur: .30, amp: .31, f: [pitch * 1.9, pitch * 1.72], decay: 12});
        tone({at: .041, dur: .24, amp: .14, f: [pitch * 3.7, pitch * 3.53], decay: 16});
      } else if (material === 'air') {
        tone({at: .027, dur: fatal ? .41 : .18, amp: .23, f: [pitch * 1.8, pitch * .76],
          tremolo: unit === 'helicopter' ? 19 : 0, decay: 10});
      } else if (material === 'foot') {
        noise({at: .033, dur: .12, amp: .27, f: [pitch * 8, pitch * 4], q: .75, decay: 20});
      }
      // Heavy targets get a bass thump; drive adds overtones a phone speaker can still play.
      if (material !== 'foot') tone({dur: .33, amp: .5 * heavy, f: [196, 77], decay: 8, drive: 3.2});
      if (!fatal) {
        if (material === 'foot') thud(0, 1);
        if (material === 'armor') { thud(0, .6); metal(0, .9, .48 + pitch / 610); }
        if (material === 'water') { boom(0, .55, .55); splash(.04, 1, .8); }
        if (material === 'air') { metal(0, .7, 1.35); noise({at: 0, dur: .25, amp: .45, f: [2600, 900], q: .9, decay: 14}); }
        return finish('impact', .1);
      }
      if (material === 'foot') { boom(0, .8, .85); thud(.02, .5); }
      if (material === 'armor') { boom(0, 1.3 * heavy); metal(.06, .6, .38 + pitch / 665); boom(.24, .7, .45); }
      if (material === 'water') { boom(0, 1.2 * heavy); splash(.18, 1.6, 1); }
      if (material === 'air') {
        metal(0, .48, 1.28);
        whistle(.035, .50, 1550, 260, .21);
        boom(.38, 1);
        boom(.57, .6, .35);
      }
      return finish('defeat', .2);
    }

    if (stage === 'move') {
      if (unit === 'foot') {
        for (let i = 0; i < 4; i++) {
          noise({at: i * .11, dur: .07, amp: .55, f: [1300, 600], q: .9, decay: 38});
          tone({at: i * .11, dur: .05, amp: .3, f: [150, 90], decay: 40});
        }
      } else if (unit === 'air') {
        whoosh(0, .65, 500, 2400, .45);
        tone({at: 0, dur: .6, amp: .07, f: [880, 1040], decay: 2, attack: .12});
      } else if (unit === 'sea') {
        noise({at: 0, dur: .7, amp: .5, f: [380, 900], q: .5, attack: .2, decay: 2.5});
        tone({at: 0, dur: .65, amp: .14, f: [92, 104], tremolo: 14, drive: 1.6, attack: .08, decay: 2});
      } else {
        tone({at: 0, dur: .6, amp: .2, f: [78, 112], wave: 'saw', tremolo: 19, drive: 1.4, attack: .05, decay: 2.4});
        for (let i = 0; i < 6; i++) noise({at: .04 + i * .085, dur: .05, amp: .22, f: [1900, 1200], q: 1.6, decay: 45});
      }
      return finish('move', .06);
    }

    const ui = {
      select: () => notes([86, 93], {step: .05, amp: .3, decay: 18}),
      inspect: () => notes([90], {step: .04, amp: .22, decay: 30}),
      confirm: () => notes([81, 86, 90], {step: .055, amp: .3, wave: 'pulse', decay: 14}),
      cancel: () => notes([86, 79], {step: .06, amp: .28, decay: 16}),
      error: () => notes([[50, .09], [50, .12]], {step: .1, amp: .3, wave: 'pulse', decay: 12}),
      open: () => notes([79, 86], {step: .04, amp: .2, decay: 22}),
      close: () => notes([86, 79], {step: .04, amp: .2, decay: 22}),
      produce: () => {
        metal(0, .45, 1.1);
        notes([74, 78, 81, 86], {at: .08, step: .055, amp: .26, wave: 'pulse', decay: 12});
      },
      heal: () => {
        notes([81, 85, 88, 93], {step: .07, amp: .22, decay: 7, wave: 'sine'});
        notes([93, 97], {at: .26, step: .07, amp: .1, decay: 6, wave: 'sine'});
      },
      'capture-step': () => {
        for (let i = 0; i < 4; i++) noise({at: i * .045, dur: .05, amp: .24, f: [2600, 1800], q: 1, decay: 40});
        notes([81, 86], {at: .18, step: .08, amp: .28, wave: 'pulse', decay: 10});
      },
      'capture-friendly': () => {
        for (let i = 0; i < 6; i++) noise({at: i * .04, dur: .05, amp: .22, f: [2600, 1800], q: 1, decay: 40});
        notes([79, 83, 86, [91, .7]], {at: .24, step: .1, amp: .32, wave: 'pulse', decay: 4});
        notes([67, 71, 74, [79, .7]], {at: .24, step: .1, amp: .2, wave: 'triangle', decay: 4});
        boom(.54, .5, .3);
      },
      'capture-enemy': () => {
        notes([76, 72, [69, .7]], {step: .14, amp: .3, wave: 'pulse', decay: 4});
        notes([[45, .9]], {step: .1, amp: .32, wave: 'triangle', decay: 3});
        tone({at: 0, dur: .9, amp: .12, f: [noteHz(51)], wave: 'saw', decay: 3});
      },
      'turn-friendly': () => {
        notes([74, 78, 81, [86, .45]], {step: .085, amp: .3, wave: 'pulse', decay: 5});
        notes([62, 66, 69, [74, .45]], {step: .085, amp: .2, decay: 5});
        noise({at: .255, dur: .3, amp: .25, f: [5200, 3600], q: .7, attack: .01, decay: 9});
      },
      'turn-enemy': () => {
        notes([[62, .5], [68, .55]], {step: .16, amp: .26, wave: 'saw', decay: 4, attack: .02});
        notes([[38, .7]], {amp: .34, wave: 'triangle', decay: 3});
        boom(0, .45, .35);
        boom(.16, .45, .3);
      },
      start: () => {
        whoosh(0, .35, 600, 3000, .3);
        notes([74, 78, 81, 86, 90], {at: .2, step: .06, amp: .26, wave: 'pulse', decay: 6});
        boom(.48, .6, .35);
      },
    }[kind];
    if (!ui) return new Float32Array(0);
    ui();
    return finish(kind.startsWith('turn-') || kind.startsWith('capture-') || kind === 'start' ? 'jingle' : 'ui', .05);

    function finish(group, room) {
      const samples = new Float32Array(Math.ceil((length + .12 + room) * rate));
      for (const layer of layers) (layer.type === 'noise' ? renderNoise : renderTone)(samples, layer);
      // A short room so effects do not sound dry on a phone speaker.
      if (room) {
        for (const [delay, gain] of [[.023, .42], [.041, .33], [.067, .25], [.097, .17]]) {
          const offset = Math.round(delay * rate);
          for (let i = samples.length - 1; i >= offset; i--) samples[i] += samples[i - offset] * gain * room * 4;
        }
      }
      // Phone speakers cannot reproduce the lowest rumble, so remove it and keep the mid-range punch.
      // Two gentle low-pass stages keep taps and gunfire from sounding shrill on phone speakers.
      let previousIn = 0;
      let previousOut = 0;
      let smooth = 0;
      let smoother = 0;
      const pole = Math.exp(-2 * Math.PI * 85 / rate);
      const soft = 1 - Math.exp(-2 * Math.PI * 4200 / rate);
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const input = samples[i];
        previousOut = pole * (previousOut + input - previousIn);
        previousIn = input;
        smooth += (previousOut - smooth) * soft;
        smoother += (smooth - smoother) * soft;
        samples[i] = smoother;
        peak = Math.max(peak, Math.abs(smoother));
      }
      const gain = peak ? levels[group] / peak : 0;
      const fade = Math.round(.01 * rate);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.tanh(samples[i] * gain * 1.1) / 1.1 * Math.min(1, (samples.length - 1 - i) / fade);
      }
      return samples;
    }

    function envelope(layer, time, decay) {
      return Math.min(1, time / layer.attack, (layer.dur - time) / .008) * decay;
    }

    function renderNoise(samples, layer) {
      const start = Math.round(layer.at * rate);
      const frames = Math.round(layer.dur * rate);
      const damping = 1 / layer.q;
      const sweep = (layer.to / layer.from) ** (1 / frames);
      let centre = layer.from;
      let low = 0;
      let band = 0;
      const fall = Math.exp(-layer.decay / rate);
      let decay = 1;
      for (let i = 0; i < frames && start + i < samples.length; i++) {
        const time = i / rate;
        decay *= fall;
        centre *= sweep;
        const f = 2 * Math.sin(Math.PI * Math.min(centre, rate / 6.5) / rate);
        const high = rnd() * 2 - 1 - low - damping * band;
        band += f * high;
        low += f * band;
        samples[start + i] += layer.amp * envelope(layer, time, decay) * band * Math.sqrt(damping + .2);
      }
    }

    function renderTone(samples, layer) {
      const start = Math.round(layer.at * rate);
      const frames = Math.round(layer.dur * rate);
      const sweep = (layer.to / layer.from) ** (1 / frames);
      const wave = layer.wave;
      let frequency = layer.from;
      let phase = 0;
      const fall = Math.exp(-layer.decay / rate);
      let decay = 1;
      for (let i = 0; i < frames && start + i < samples.length; i++) {
        const time = i / rate;
        decay *= fall;
        frequency *= sweep;
        phase += frequency * (layer.vibrato ? 1 + layer.vibrato * Math.sin(2 * Math.PI * 5.5 * time) : 1) / rate;
        const cycle = phase - Math.floor(phase);
        let value;
        if (wave === 'triangle') value = 1 - 4 * Math.abs(cycle - .5);
        else if (wave === 'pulse') value = Math.tanh(1.8 * Math.sin(2 * Math.PI * cycle)) * .85;
        else if (wave === 'saw') value = (2 * cycle - 1) * .7;
        else value = Math.sin(2 * Math.PI * cycle);
        if (layer.drive) value = Math.tanh(value * layer.drive) / Math.tanh(layer.drive);
        if (layer.tremolo) value *= .65 + .35 * Math.sin(2 * Math.PI * layer.tremolo * time);
        samples[start + i] += layer.amp * envelope(layer, time, decay) * value;
      }
    }
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
        // iOS unlocks reliably when a silent buffer starts inside the same gesture.
        const silence = context.createBufferSource();
        silence.buffer = context.createBuffer(1, 1, context.sampleRate);
        silence.connect(context.destination);
        silence.start();
        resuming = context.resume().catch(() => {}).finally(() => { resuming = undefined; });
        resuming.then(() => prepare(common));
      }
    } catch {
      // Audio is optional, including when the device denies playback.
    }
  }

  function bus() {
    if (output) return output;
    const gain = context.createGain();
    gain.gain.value = .8;
    // Keeps stacked explosions and volleys from clipping.
    const limiter = context.createDynamicsCompressor?.();
    if (limiter) {
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = .002;
      limiter.release.value = .12;
      gain.connect(limiter);
      limiter.connect(context.destination);
    } else {
      gain.connect(context.destination);
    }
    output = gain;
    return output;
  }

  const variantsOf = kind => /^(shot|impact|defeat)-/.test(kind) ? 3 : 1;
  function bufferFor(kind, variant = Math.floor(Math.random() * variantsOf(kind))) {
    const key = `${kind}#${variant}`;
    if (!effects.has(key)) {
      // The mix rolls off above 4.2 kHz. Keep synthesis bounded on high-rate devices.
      const rate = Math.min(32000, context.sampleRate);
      const samples = synthesize(kind, rate, variant);
      if (!samples.length) return null;
      const buffer = context.createBuffer(1, samples.length, rate);
      buffer.getChannelData(0).set(samples);
      effects.set(key, buffer);
    }
    return effects.get(key);
  }

  // Renders cues ahead of time in small idle slices so the first shot never stalls an animation.
  const pending = new Map();
  let preparing = false;
  function prepare(kinds) {
    if (!enabled || !context) return;
    for (const kind of kinds) {
      for (let variant = 0; variant < variantsOf(kind); variant++) {
        const key = `${kind}#${variant}`;
        if (!effects.has(key)) pending.set(key, [kind, variant]);
      }
    }
    if (preparing || !pending.size) return;
    preparing = true;
    const schedule = window.requestIdleCallback
      ? callback => window.requestIdleCallback(callback, {timeout: 180})
      : callback => setTimeout(callback, 24);
    const work = () => {
      // Safari's timer fallback also yields after one buffer; do not render a whole battle in one frame.
      if (enabled && !document.hidden && pending.size) {
        const [key, cue] = pending.entries().next().value;
        pending.delete(key);
        bufferFor(...cue);
      } else pending.clear();
      if (pending.size) schedule(work);
      else preparing = false;
    };
    schedule(work);
  }
  const common = ['select', 'inspect', 'confirm', 'cancel', 'error', 'open', 'close', 'turn-friendly', 'turn-enemy',
    'move-foot', 'move-vehicle', 'move-air', 'move-sea', 'capture-step', 'capture-friendly', 'capture-enemy', 'produce', 'heal'];

  function play(kind, pan = 0, {at = 0, gain: level = 1, minor = false} = {}) {
    if (!enabled || document.hidden || context?.state !== 'running') return;
    const now = context.currentTime;
    // Several lanes of one volley start together; one sound per lane is enough.
    if (now - (lastStart.get(kind) ?? -1) < .035 || sources.size >= (minor ? 6 : 10)) return;
    const buffer = bufferFor(kind);
    if (!buffer) return;
    lastStart.set(kind, now);
    const source = context.createBufferSource();
    source.buffer = buffer;
    if (/^(shot|impact|defeat)-/.test(kind)) source.playbackRate.value = 1 + (Math.random() - .5) * .05;
    const gain = context.createGain();
    gain.gain.value = level / Math.sqrt(sources.size + 1);
    const panner = context.createStereoPanner?.();
    source.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(bus());
    } else {
      gain.connect(bus());
    }
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    source.start(now + at);
    sources.add(source);
  }

  function stop() {
    cueId++;
    for (const source of sources) {
      source.disconnect();
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    sources.clear();
  }

  /** Plays a cue now, or right after the first tap finishes unlocking audio. */
  function cue(kind, pan = 0, options) {
    const id = cueId;
    if (context?.state === 'running') play(kind, pan, options);
    else resuming?.then(() => {
      if (id === cueId) play(kind, pan, options);
    });
  }

  function playTurn(side) {
    cueId++;
    cue(`turn-${side}`);
  }

  /** Movement sound for a unit type: footsteps, engines, rotors or a wake. */
  function playMove(type) {
    const domain = type?.domain ?? 'land';
    cue(`move-${domain === 'land' ? (footKinds.has(type?.id) ? 'foot' : 'vehicle') : domain}`);
  }

  function gesture(event) {
    if (!event.isTrusted || event.target.closest?.('[data-combat-audio]') || document.getElementById('portrait-notice')?.open) return;
    unlock();
  }
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, gesture, {capture: true, passive: true});
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
      if (enabled) {
        unlock();
        cue('confirm');
      } else {
        stop();
      }
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
  return {play, cue, playTurn, playMove, prepare, stop, synthesize};
})();
