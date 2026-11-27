// Original, code-painted battle scenery in the same lit, realistic style as unit-art.js:
// a golden-hour highland panorama (layered mountain ranges with atmospheric haze, snow,
// tree lines and a sunlit meadow) and foreground cover for forests, mountains and marshes.
(() => {
  // Works on the page and inside scene-worker.js (OffscreenCanvas, no DOM).
  const inWorker = typeof document === 'undefined';
  function makeCanvas(width, height) {
    if (inWorker) return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
  }
  // 1D fractal value noise in [0, 1].
  function ridgeNoise(seed, octaves = 5) {
    const r = rng(seed);
    const lattice = Array.from({length: 512}, () => r());
    const value = x => {
      const i = Math.floor(x), f = x - i, t = (1 - Math.cos(f * Math.PI)) / 2;
      return lattice[i & 511] * (1 - t) + lattice[(i + 1) & 511] * t;
    };
    return x => {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) { sum += value(x * freq) * amp; norm += amp; amp *= .5; freq *= 2.1; }
      return sum / norm;
    };
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function paintSky(ctx, w, h, horizon, sun) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#24345c');
    sky.addColorStop(.38, '#56628f');
    sky.addColorStop(.7, '#c98c86');
    sky.addColorStop(.9, '#f0b585');
    sky.addColorStop(1, '#f9d7a2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 4);
    const glow = ctx.createRadialGradient(sun[0], sun[1], 4, sun[0], sun[1], w * .55);
    glow.addColorStop(0, 'rgba(255,246,214,.95)');
    glow.addColorStop(.06, 'rgba(255,226,160,.7)');
    glow.addColorStop(.25, 'rgba(255,178,120,.28)');
    glow.addColorStop(1, 'rgba(255,160,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon + 4);
    ctx.fillStyle = '#fff8e4';
    ctx.beginPath(); ctx.arc(sun[0], sun[1], w * .028, 0, Math.PI * 2); ctx.fill();
  }

  // Clusters of soft cumulus: lit warm on the sun side and on top, cool and darker beneath.
  // Painted at quarter size and scaled up so the puffs melt together softly.
  function paintClouds(target, w, horizon, sun, seed) {
    const q = 4, layer = makeCanvas(Math.ceil(w / q), Math.ceil(horizon / q));
    const ctx = layer.getContext('2d');
    ctx.scale(1 / q, 1 / q);
    const r = rng(seed);
    for (let c = 0; c < 9; c++) {
      const cx = r() * w, cy = horizon * (.12 + r() * .55), spread = 80 + r() * 160, scale = .6 + (cy / horizon) * .5;
      const near = Math.max(0, 1 - Math.hypot(cx - sun[0], cy - sun[1]) / (w * .65));
      for (let i = 0; i < 60; i++) {
        const x = cx + (r() - .5) * spread * 2, y = cy + (r() - .5) * spread * .22;
        const rad = (28 + r() * 46) * scale * (1 - Math.abs(x - cx) / (spread * 1.3));
        if (rad < 4) continue;
        const lit = mix([120, 118, 158], [255, 220, 178], .35 + near * .6);
        const dark = mix([70, 70, 108], [190, 128, 120], near * .5);
        const g = ctx.createRadialGradient(x + rad * .25, y - rad * .45, rad * .1, x, y, rad);
        g.addColorStop(0, rgba(lit, .32));
        g.addColorStop(.65, rgba(mix(lit, dark, .55), .2));
        g.addColorStop(1, rgba(dark, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Thin high streaks.
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = horizon * (.08 + r() * .3), rx = 120 + r() * 220;
      const g = ctx.createRadialGradient(x, y, 1, x, y, rx);
      g.addColorStop(0, 'rgba(255,214,186,.22)'); g.addColorStop(1, 'rgba(255,214,186,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rx, 4 + r() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    target.save();
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = 'high';
    target.drawImage(layer, 0, 0, layer.width * q, layer.height * q);
    target.restore();
  }

  // 2D fractal value noise for the rock faces.
  function fieldNoise(seed) {
    const r = rng(seed);
    const size = 256, lattice = Float32Array.from({length: size * size}, () => r());
    const at = (i, j) => lattice[(j & 255) * size + (i & 255)];
    const value = (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
      return a + (b - a) * sy;
    };
    return (x, y) => {
      let sum = 0, amp = 1, norm = 0;
      for (let o = 0; o < 5; o++) { sum += value(x, y) * amp; norm += amp; amp *= .5; x *= 2.03; y *= 2.03; }
      return sum / norm;
    };
  }

  // One mountain range, lit per pixel at half resolution: rock ridges and gullies from a
  // noise field lit from the upper right, snow on the high faces, and haze with distance.
  function paintRange(ctx, w, h, {seed, base, height, scale, color, haze, hazeAmount, snow = 0, light = .35}) {
    const noise = ridgeNoise(seed, 4), detail = ridgeNoise(seed + 5, 3);
    const top = x => base - height * Math.pow(noise(x / scale), 1.3) * 1.6 - height * .12 * detail(x / (scale * .22));
    const field = fieldNoise(seed + 13);
    const k = 2, lw = Math.ceil(w / k);
    let minTop = h;
    const tops = new Float32Array(lw);
    for (let i = 0; i < lw; i++) { tops[i] = top(i * k) / k; minTop = Math.min(minTop, tops[i]); }
    const y0 = Math.floor(minTop), y1 = Math.ceil(h / k), lh = y1 - y0;
    const layer = makeCanvas(lw, lh);
    const lctx = layer.getContext('2d');
    const img = lctx.createImageData(lw, lh), d = img.data;
    const lit = [255, 214, 170], shade = [28, 32, 62], snowLit = [255, 244, 232], snowShade = [168, 180, 220];
    const fs = 1 / (scale * .18 / k);
    for (let i = 0; i < lw; i++) {
      const t0 = tops[i], slope = (tops[Math.min(lw - 1, i + 2)] - tops[Math.max(0, i - 2)]) / 4;
      for (let j = Math.max(0, Math.floor(t0) - y0); j < lh; j++) {
        const y = j + y0;
        if (y < t0) continue;
        const below = (y - t0) / Math.max(1, base / k - t0 + 30);
        const fx = i * fs, fy = y * fs * 1.6;
        const f = field(fx, fy), dx = field(fx + .08, fy) - f, dy = field(fx, fy + .08) - f;
        // Light from the upper right, plus the ridge slope near the crest.
        let l = .5 + (dx * 9 - dy * 5) * light * 3 + (-slope) * light * Math.max(0, 1 - below * 1.5);
        l = Math.max(0, Math.min(1, l));
        let c = l > .5 ? mix(color, lit, (l - .5) * 1.1) : mix(color, shade, (.5 - l) * 1.1);
        if (snow && y * k < snow + (f - .5) * height * .9 && below < .55) c = mix(snowShade, snowLit, l);
        c = mix(c, haze, Math.min(1, hazeAmount + below * .35));
        const at = (j * lw + i) * 4;
        d[at] = c[0]; d[at + 1] = c[1]; d[at + 2] = c[2];
        d[at + 3] = y - t0 < 1 ? Math.round((y - t0) * 255) : 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(layer, 0, y0 * k, lw * k, lh * k);
    ctx.restore();
  }

  function treeLine(ctx, w, seed, {base, wave, size, color, density}) {
    const r = rng(seed);
    const noise = ridgeNoise(seed + 9, 3);
    for (let x = -10; x < w + 10; x += density * (.6 + r() * .8)) {
      const y = base - wave * noise(x / 160), s = size * (.6 + r() * .8);
      ctx.fillStyle = rgb(mix(color, [20, 30, 30], r() * .3));
      ctx.beginPath();
      ctx.moveTo(x, y - s * 2.2);
      ctx.lineTo(x + s * .6, y);
      ctx.lineTo(x - s * .6, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintMeadow(ctx, w, h, horizon, sun, seed) {
    const r = rng(seed);
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, '#a7a86a');
    ground.addColorStop(.25, '#7f9a4f');
    ground.addColorStop(.6, '#5e7d38');
    ground.addColorStop(1, '#3f5a27');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);
    // Rolling light and shadow across the field.
    const roll = ridgeNoise(seed + 3, 4);
    for (let i = 0; i < 9; i++) {
      const y = horizon + (h - horizon) * (i / 9) ** 1.6, x = w * roll(i * 3.1);
      const g = ctx.createRadialGradient(x, y, 1, x, y, w * (.2 + i * .04));
      g.addColorStop(0, i % 2 ? 'rgba(255,220,140,.22)' : 'rgba(30,50,20,.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, w * (.3 + i * .05), (h - horizon) * .08 * (1 + i * .3), 0, 0, Math.PI * 2); ctx.fill();
    }
    // Sun glare across the meadow.
    const glare = ctx.createRadialGradient(sun[0], horizon, 1, sun[0], horizon, w * .5);
    glare.addColorStop(0, 'rgba(255,220,160,.55)');
    glare.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, horizon, w, (h - horizon) * .6);
    // Grass blades in perspective: tiny far away, long and detailed up close.
    ctx.lineCap = 'round';
    const blades = Math.round(w * 11);
    for (let i = 0; i < blades; i++) {
      const t = r() ** .7, y = horizon + (h - horizon) * t, x = r() * w;
      const len = 1.5 + t * t * 26 * (.6 + r() * .8), lean = (r() - .45) * len * .5;
      const warm = Math.max(0, 1 - Math.abs(x - sun[0]) / w) * (1 - t);
      const c = mix(mix([62, 92, 40], [168, 176, 92], r() * .8), [240, 200, 120], warm * .5);
      ctx.strokeStyle = rgba(c, .5 + t * .4);
      ctx.lineWidth = .6 + t * 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * .3, y - len * .6, x + lean, y - len); ctx.stroke();
    }
    // Wildflowers in the foreground.
    for (let i = 0; i < 260; i++) {
      const t = .45 + r() * .55, y = horizon + (h - horizon) * t, x = r() * w;
      ctx.fillStyle = ['#f6e39a', '#ffffff', '#e9a8c0', '#f2c45c'][Math.floor(r() * 4)];
      ctx.globalAlpha = .7;
      ctx.beginPath(); ctx.arc(x, y, .8 + t * 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function landscape(width = 1280, height = 900) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const horizon = height * .58, sun = [width * .7, height * .37];
    const haze = [236, 190, 160];
    paintSky(ctx, width, height, horizon, sun);
    paintClouds(ctx, width, horizon * .9, sun, 7);
    paintRange(ctx, width, height, {seed: 11, base: height * .5, height: height * .2, scale: 260, color: [104, 108, 150], haze, hazeAmount: .5, snow: height * .4, light: .5});
    paintRange(ctx, width, height, {seed: 23, base: height * .55, height: height * .14, scale: 190, color: [78, 88, 118], haze, hazeAmount: .36, snow: height * .44, light: .45});
    paintRange(ctx, width, height, {seed: 37, base: height * .6, height: height * .09, scale: 150, color: [62, 84, 78], haze, hazeAmount: .22, light: .4});
    treeLine(ctx, width, 41, {base: height * .6, wave: height * .05, size: 7, color: [52, 72, 62], density: 5});
    paintRange(ctx, width, height, {seed: 53, base: height * .64, height: height * .05, scale: 220, color: [66, 96, 50], haze, hazeAmount: .06, light: .35});
    treeLine(ctx, width, 59, {base: height * .645, wave: height * .03, size: 11, color: [36, 60, 40], density: 7});
    paintMeadow(ctx, width, height, height * .64, sun, 61);
    // Haze over the horizon and a soft grade.
    const mist = ctx.createLinearGradient(0, height * .5, 0, height * .7);
    mist.addColorStop(0, 'rgba(250,210,170,0)');
    mist.addColorStop(.5, 'rgba(250,210,170,.22)');
    mist.addColorStop(1, 'rgba(250,210,170,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, height * .5, width, height * .2);
    return canvas;
  }

  // ---- Title screen: a portrait dusk coastline (sky, far ranges, sea with a sun path, and
  // a grassy headland in front). Units are laid over it on the page (see game.js).
  function paintSea(ctx, w, top, bottom, sun, seed) {
    const r = rng(seed);
    const sea = ctx.createLinearGradient(0, top, 0, bottom);
    sea.addColorStop(0, '#d7a58e');
    sea.addColorStop(.06, '#8d8aa6');
    sea.addColorStop(.35, '#4b6688');
    sea.addColorStop(1, '#1b3452');
    ctx.fillStyle = sea;
    ctx.fillRect(0, top, w, bottom - top);
    // Swell: long dark and light bands that grow with nearness.
    ctx.lineCap = 'round';
    for (let i = 0; i < w * 2.2; i++) {
      const t = r() ** 1.5, y = top + (bottom - top) * t, x = r() * w, len = 4 + t * t * 90 * (.5 + r());
      ctx.strokeStyle = r() < .55 ? `rgba(14,30,52,${.18 + t * .25})` : `rgba(190,210,235,${.05 + t * .12})`;
      ctx.lineWidth = .5 + t * 2.2;
      ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke();
    }
    // The sun's path: warm glints, thick under the sun and widening toward the viewer.
    for (let i = 0; i < w * 3.4; i++) {
      const t = r() ** 1.25, y = top + (bottom - top) * t;
      const spread = w * (.025 + t * .2);
      const x = sun[0] + (r() + r() + r() - 1.5) * spread;
      const fade = Math.max(0, 1 - Math.abs(x - sun[0]) / (spread * 1.25));
      if (fade <= 0) continue;
      const len = 2 + t * 34 * r();
      ctx.strokeStyle = `rgba(255,${Math.round(214 + r() * 30)},${Math.round(150 + r() * 60)},${(.25 + fade * .75) * (1 - t * .45)})`;
      ctx.lineWidth = .6 + t * 2.4;
      ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(sun[0], top, 2, sun[0], top, w * .45);
    glow.addColorStop(0, 'rgba(255,214,160,.55)');
    glow.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, top, w, (bottom - top) * .5);
  }

  function titleScene(width = 720, height = 1280) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const horizon = Math.round(height * .44), sun = [width * .64, horizon - height * .012];
    const haze = [232, 176, 156];
    paintSky(ctx, width, height, horizon, sun);
    paintClouds(ctx, width, horizon * .92, sun, 17);
    // A headland range on the left and a low island on the right, standing on the horizon.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, width * .52, horizon + 4);
    ctx.clip();
    paintRange(ctx, width, horizon + 6, {seed: 71, base: horizon + 2, height: height * .11, scale: 150, color: [92, 96, 138], haze, hazeAmount: .45, snow: horizon - height * .1, light: .55});
    paintRange(ctx, width, horizon + 6, {seed: 83, base: horizon + 4, height: height * .06, scale: 110, color: [64, 74, 96], haze, hazeAmount: .25, light: .45});
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(width * .78, 0, width * .22, horizon + 4);
    ctx.clip();
    paintRange(ctx, width, horizon + 6, {seed: 97, base: horizon + 2, height: height * .035, scale: 70, color: [86, 88, 120], haze, hazeAmount: .5, light: .5});
    ctx.restore();
    const shore = Math.round(height * .66);
    paintSea(ctx, width, horizon, shore + height * .06, sun, 29);
    // Headland in front: an uneven shoreline with sand, surf and the sunlit meadow.
    const edge = ridgeNoise(131, 4);
    const coastY = x => shore - height * .035 * Math.sin(x / width * Math.PI * .9 + .4) - height * .04 * edge(x / 90);
    const coast = () => {
      ctx.beginPath(); ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) ctx.lineTo(x, coastY(x));
      ctx.lineTo(width, height); ctx.closePath();
    };
    ctx.save();
    ctx.translate(0, height * .012);
    coast();
    ctx.fillStyle = '#d8c39a';
    ctx.fill();
    ctx.restore();
    ctx.save();
    coast();
    ctx.clip();
    paintMeadow(ctx, width, height, shore - height * .09, sun, 143);
    ctx.restore();
    // Surf along the waterline.
    const surf = rng(151);
    for (let x = 0; x < width; x += 2) {
      const y = coastY(x) + height * .014 + surf() * 3;
      ctx.fillStyle = `rgba(255,248,236,${.35 + surf() * .45})`;
      ctx.fillRect(x, y, 2 + surf() * 6, 1.2 + surf() * 1.6);
    }
    // Horizon haze, warm grade and a soft vignette.
    const mist = ctx.createLinearGradient(0, horizon - height * .06, 0, horizon + height * .05);
    mist.addColorStop(0, 'rgba(255,206,170,0)');
    mist.addColorStop(.5, 'rgba(255,206,170,.3)');
    mist.addColorStop(1, 'rgba(255,206,170,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, horizon - height * .06, width, height * .11);
    const vignette = ctx.createRadialGradient(width / 2, height * .46, width * .3, width / 2, height * .5, height * .72);
    vignette.addColorStop(0, 'rgba(8,14,28,0)');
    vignette.addColorStop(1, 'rgba(8,14,28,.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }

  // ---- Foreground cover (drawn facing right, 560x304, standing on the bottom edge) ----
  const CW = 560, CH = 304;
  function conifer(ctx, x, y, h, r) {
    const w = h * .42;
    ctx.fillStyle = 'rgba(20,30,15,.35)';
    ctx.beginPath(); ctx.ellipse(x + w * .3, y, w * 1.1, h * .05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3322'; ctx.fillRect(x - h * .025, y - h * .18, h * .05, h * .18);
    for (let i = 0; i < 6; i++) {
      const ty = y - h * .12 - i * h * .14, tw = w * (1 - i * .14);
      const g = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
      g.addColorStop(0, '#1f3a28'); g.addColorStop(.55, '#2f5534'); g.addColorStop(1, '#5d8a4a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, ty - h * .22);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, px = x - tw + t * tw * 2, py = ty + Math.sin(t * Math.PI * 4) * h * .015 + (r() - .5) * h * .02;
        ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  function bush(ctx, x, y, s, r) {
    for (let i = 0; i < 7; i++) {
      const cx = x + (r() - .5) * s * 1.2, cy = y - s * .35 - r() * s * .4, rad = s * (.28 + r() * .2);
      const g = ctx.createRadialGradient(cx + rad * .4, cy - rad * .4, 1, cx, cy, rad);
      g.addColorStop(0, '#8cb35a'); g.addColorStop(.6, '#4b7a37'); g.addColorStop(1, '#2a4a22');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  function boulder(ctx, x, y, w, h, r) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + i / 10 * Math.PI, rad = .82 + r() * .22;
      pts.push([x + Math.cos(a) * w * rad, y + Math.sin(a) * h * rad]);
    }
    ctx.fillStyle = 'rgba(20,18,16,.35)';
    ctx.beginPath(); ctx.ellipse(x + w * .15, y, w * 1.1, h * .12, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - w, y - h, x + w, y);
    g.addColorStop(0, '#6a655e'); g.addColorStop(.45, '#8d877d'); g.addColorStop(.7, '#c9b9a0'); g.addColorStop(1, '#7b7268');
    ctx.fillStyle = g;
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,36,32,.45)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const sx = x + (r() - .5) * w, sy = y - r() * h * .7;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - .5) * w * .4, sy + h * .2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(110,140,70,.55)';
    ctx.beginPath(); ctx.ellipse(x - w * .3, y - h * .82, w * .3, h * .08, 0, 0, Math.PI * 2); ctx.fill();
  }
  function reed(ctx, x, y, h, r) {
    ctx.strokeStyle = r() < .5 ? '#6f8a3e' : '#a3a45a';
    ctx.lineWidth = 2.2;
    const lean = (r() - .5) * h * .3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * .2, y - h * .6, x + lean, y - h); ctx.stroke();
    if (r() < .45) {
      ctx.fillStyle = '#6b4526';
      ctx.beginPath(); ctx.ellipse(x + lean * .92, y - h * .92, 3.2, 10, lean * .01, 0, Math.PI * 2); ctx.fill();
    }
  }
  const covers = {
    forest(ctx, r) {
      bush(ctx, 470, CH - 4, 90, r);
      conifer(ctx, 120, CH - 6, 280, r);
      conifer(ctx, 260, CH - 4, 220, r);
      conifer(ctx, 40, CH - 2, 200, r);
      bush(ctx, 360, CH - 2, 110, r);
      bush(ctx, 180, CH, 80, r);
    },
    mountain(ctx, r) {
      boulder(ctx, 170, CH - 4, 150, 210, r);
      boulder(ctx, 360, CH - 2, 110, 130, r);
      boulder(ctx, 60, CH, 70, 90, r);
      boulder(ctx, 480, CH, 60, 60, r);
    },
    marsh(ctx, r) {
      const water = ctx.createLinearGradient(0, CH - 60, 0, CH);
      water.addColorStop(0, '#9cc4c0'); water.addColorStop(1, '#4b7d7f');
      ctx.fillStyle = water;
      ctx.beginPath(); ctx.ellipse(280, CH - 26, 260, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,210,.45)';
      ctx.beginPath(); ctx.ellipse(330, CH - 34, 90, 4, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 70; i++) reed(ctx, 20 + r() * 520, CH - 10 - r() * 30, 70 + r() * 130, r);
    },
  };

  const cache = new Map();
  function cover(kind) {
    if (!cache.has(kind)) {
      const canvas = document.createElement('canvas');
      canvas.width = CW;
      canvas.height = CH;
      const ctx = canvas.getContext('2d');
      covers[kind](ctx, rng(kind.length * 977));
      // A blob: URL keeps the battle's inherited --cover-image cheap to restyle (see unit-art.js).
      const data = canvas.toDataURL('image/png');
      let url = data;
      if (typeof Blob !== 'undefined' && URL.createObjectURL) {
        const binary = atob(data.slice(data.indexOf(',') + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
      }
      cache.set(kind, url);
    }
    return cache.get(kind);
  }
  function backdrop() {
    if (!cache.has('backdrop')) cache.set('backdrop', landscape().toDataURL('image/jpeg', .9));
    return cache.get('backdrop');
  }

  if (inWorker) {
    self.SceneArt = {landscape, titleScene};
    return;
  }
  let supported = false;
  try {
    supported = Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    supported = false;
  }
  // Paints the panorama in a worker when the browser can, so the page never stalls;
  // otherwise on the page. Calls back with an image URL.
  const pendingPaints = new Map();
  const localPaint = {
    landscape: backdrop,
    title: () => titleScene().toDataURL('image/jpeg', .88),
  };
  function backdropAsync(done) {
    paintAsync('landscape', done);
  }
  function titleAsync(done) {
    paintAsync('title', done);
  }
  function paintAsync(kind, done) {
    const key = kind === 'landscape' ? 'backdrop' : kind;
    if (cache.has(key)) { done(cache.get(key)); return; }
    if (pendingPaints.has(kind)) { pendingPaints.get(kind).push(done); return; }
    pendingPaints.set(kind, [done]);
    const finish = url => {
      cache.set(key, url);
      const callbacks = pendingPaints.get(kind);
      pendingPaints.delete(kind);
      callbacks.forEach(callback => callback(url));
    };
    const local = () => finish(localPaint[kind]());
    if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || !('convertToBlob' in OffscreenCanvas.prototype)) {
      local();
      return;
    }
    try {
      const worker = new Worker('./scene-worker.js?v=content2');
      worker.onmessage = ({data}) => {
        worker.terminate();
        if (data instanceof Blob) finish(URL.createObjectURL(data));
        else local();
      };
      worker.onerror = () => { worker.terminate(); local(); };
      worker.postMessage(kind);
    } catch {
      local();
    }
  }
  window.SceneArt = supported ? {backdrop, backdropAsync, cover, landscape, titleScene, titleAsync} : null;
})();
