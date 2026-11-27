// Original unit art in a realistic, lit "3D illustration" style. Every unit is drawn in
// the browser with gradients, specular highlights, camouflage and soft shadows, facing
// right. It provides one still image per unit and team, plus a 7-frame combat atlas
// (idle, aim, fire, recoil, hit, duck, destroyed) for the units that use frame poses.
(() => {
  const W = 256, H = 224, GROUND = 204;
  const teams = {
    friendly: {base: '#58758c', light: '#a7c3d6', dark: '#26384a', camo: '#3e5c58', camo2: '#7d97a3', mark: '#3cc8e6', markDark: '#126d86', cloth: '#4d6a70', skin: '#e0b48e'},
    enemy: {base: '#93603f', light: '#dcab84', dark: '#4a2a1a', camo: '#6f4a2c', camo2: '#b98a5c', mark: '#ff6b3d', markDark: '#9c2a14', cloth: '#7c5236', skin: '#d9a982'},
  };

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
  }

  // ---- Primitives ----------------------------------------------------------------
  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    return g;
  }
  function metal(ctx, y0, y1, p, tone = 'base') {
    const base = tone === 'camo' ? p.camo : p.base;
    return vgrad(ctx, y0, y1, [[0, p.light], [.22, base], [.75, base], [1, p.dark]]);
  }
  function poly(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  function fillShape(ctx, points, fill, outline = 'rgba(12,16,20,.85)', width = 2.2) {
    poly(ctx, points);
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke(); }
  }
  function camo(ctx, points, p, seed, alpha = .55) {
    ctx.save();
    poly(ctx, points);
    ctx.clip();
    const r = rng(seed);
    const xs = points.map(q => q[0]), ys = points.map(q => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 3 ? p.camo : p.camo2;
      ctx.beginPath();
      ctx.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 6 + r() * 16, 3 + r() * 7, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function specular(ctx, points, strength = .35) {
    ctx.save();
    poly(ctx, points);
    ctx.clip();
    const ys = points.map(q => q[1]);
    const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    g.addColorStop(0, `rgba(255,255,255,${strength})`);
    g.addColorStop(.18, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function groundShadow(ctx, cx, w, y = GROUND + 4, alpha = .4) {
    const g = ctx.createRadialGradient(cx, y, 2, cx, y, w);
    g.addColorStop(0, `rgba(10,14,10,${alpha})`);
    g.addColorStop(1, 'rgba(10,14,10,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, .22);
    ctx.beginPath();
    ctx.arc(cx, y / .22, w, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function wheel(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, '#5a5f63'); g.addColorStop(.7, '#26292c'); g.addColorStop(1, '#101214');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const hub = ctx.createRadialGradient(x - r * .15, y - r * .15, 1, x, y, r * .5);
    hub.addColorStop(0, '#c8cdd0'); hub.addColorStop(1, '#5d6468');
    ctx.fillStyle = hub;
    ctx.beginPath(); ctx.arc(x, y, r * .45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2e31';
    ctx.beginPath(); ctx.arc(x, y, r * .14, 0, Math.PI * 2); ctx.fill();
  }
  function track(ctx, x0, x1, y, h, count) {
    const r = h / 2;
    ctx.fillStyle = vgrad(ctx, y - r, y + r, [[0, '#4a4d4f'], [.5, '#232527'], [1, '#121314']]);
    ctx.beginPath();
    ctx.arc(x0 + r, y, r, Math.PI / 2, Math.PI * 1.5);
    ctx.arc(x1 - r, y, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0b0c0d'; ctx.lineWidth = 2; ctx.stroke();
    // Track links.
    ctx.strokeStyle = 'rgba(150,150,150,.35)'; ctx.lineWidth = 1.4;
    for (let x = x0 + r * .6; x < x1 - r * .6; x += 7) {
      ctx.beginPath(); ctx.moveTo(x, y - r + 1); ctx.lineTo(x + 2, y - r + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + r - 1); ctx.lineTo(x + 2, y + r - 4); ctx.stroke();
    }
    const step = (x1 - x0 - h) / (count - 1);
    for (let i = 0; i < count; i++) wheel(ctx, x0 + r + i * step, y + 1, r * .72);
  }
  function barrel(ctx, x, y, length, thick, angle, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    ctx.fillStyle = vgrad(ctx, -thick / 2, thick / 2, [[0, p.light], [.4, p.base], [1, p.dark]]);
    ctx.fillRect(0, -thick / 2, length, thick);
    ctx.strokeStyle = 'rgba(12,16,20,.85)'; ctx.lineWidth = 1.8; ctx.strokeRect(0, -thick / 2, length, thick);
    ctx.fillStyle = p.dark;
    ctx.fillRect(length - thick * 1.6, -thick * .7, thick * 1.6, thick * 1.4);
    ctx.restore();
    return [x + Math.cos(angle) * length, y - Math.sin(angle) * length];
  }
  function insignia(ctx, x, y, r, p) {
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.mark;
    ctx.beginPath(); ctx.arc(x, y, r * .72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .22 : r * .55; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }
  function stripe(ctx, x, y, w, h, p) {
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, p.mark], [1, p.markDark]]);
    ctx.fillRect(x, y, w, h);
  }
  function muzzleFlash(ctx, x, y, size, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    const g = ctx.createRadialGradient(size * .3, 0, 0, size * .3, 0, size);
    g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(.25, 'rgba(255,225,120,.95)');
    g.addColorStop(.6, 'rgba(255,130,40,.6)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * .5, -size * .45); ctx.lineTo(size * .7, -size * .12); ctx.lineTo(size * 1.25, 0);
    ctx.lineTo(size * .7, size * .12); ctx.lineTo(size * .5, size * .45);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(size * .25, 0, size * .4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function smoke(ctx, x, y, size, alpha = .6) {
    for (let i = 0; i < 6; i++) {
      const cx = x + Math.sin(i * 2.1) * size * .5, cy = y - i * size * .32, r = size * (.35 + i * .08);
      const g = ctx.createRadialGradient(cx - r * .3, cy - r * .3, 1, cx, cy, r);
      g.addColorStop(0, `rgba(120,118,112,${alpha})`); g.addColorStop(1, 'rgba(60,58,55,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  function glass(ctx, points) {
    poly(ctx, points);
    const ys = points.map(q => q[1]);
    ctx.fillStyle = vgrad(ctx, Math.min(...ys), Math.max(...ys), [[0, '#d9f3ff'], [.35, '#6fa9c8'], [1, '#1c3446']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.9)'; ctx.lineWidth = 1.8; ctx.stroke();
  }

  // ---- Units (each draws facing right, standing on GROUND) -----------------------------
  function drawInfantry(ctx, p, pose) {
    const crouch = pose === 'duck' ? 26 : 0;
    groundShadow(ctx, 128, 56);
    ctx.save();
    ctx.translate(0, crouch);
    const legTop = 146, hip = 128;
    // Legs (one kneeling when crouched).
    const pants = vgrad(ctx, legTop, GROUND, [[0, p.cloth], [1, p.dark]]);
    if (crouch) {
      fillShape(ctx, [[108, 140], [126, 140], [124, 160], [96, 170], [92, 160]], pants);
      fillShape(ctx, [[92, 160], [100, 172], [96, 178], [84, 170]], '#2b2420');
      fillShape(ctx, [[128, 140], [146, 140], [152, 172], [138, 176]], pants);
      fillShape(ctx, [[136, 170], [160, 170], [160, 178], [136, 178]], '#2b2420');
    } else {
      fillShape(ctx, [[108, legTop], [124, legTop], [118, 196], [102, 196]], pants);
      fillShape(ctx, [[130, legTop], [146, legTop], [156, 196], [140, 196]], pants);
      fillShape(ctx, [[98, 192], [122, 192], [124, 204], [94, 204]], '#2b2420');
      fillShape(ctx, [[138, 192], [162, 192], [166, 204], [136, 204]], '#2b2420');
    }
    // Backpack.
    fillShape(ctx, [[84, 92], [104, 88], [106, 134], [86, 138]], vgrad(ctx, 88, 138, [[0, '#8a7a55'], [1, '#4c422d']]));
    // Torso with vest.
    const torso = [[100, 86], [148, 86], [152, hip + 18], [104, hip + 18]];
    fillShape(ctx, torso, vgrad(ctx, 86, hip + 18, [[0, p.light], [.3, p.cloth], [1, p.dark]]));
    camo(ctx, torso, p, 11, .45);
    fillShape(ctx, [[106, 98], [144, 98], [146, 132], [108, 132]], vgrad(ctx, 98, 132, [[0, '#6b6a55'], [1, '#3b3a2e']]), 'rgba(12,16,20,.6)', 1.4);
    for (const x of [112, 124, 136]) fillShape(ctx, [[x, 112], [x + 9, 112], [x + 9, 126], [x, 126]], '#4f4d3e', 'rgba(0,0,0,.5)', 1);
    stripe(ctx, 100, 90, 10, 8, p);
    // Head and helmet.
    const face = ctx.createRadialGradient(140, 70, 2, 136, 74, 18);
    face.addColorStop(0, '#f6d2b0'); face.addColorStop(1, p.skin);
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.ellipse(136, 74, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a201a'; ctx.fillRect(140, 70, 5, 3);
    const helmet = [[114, 66], [118, 48], [134, 40], [152, 46], [160, 62], [162, 68]];
    ctx.beginPath(); ctx.moveTo(112, 68); ctx.quadraticCurveTo(118, 38, 140, 40); ctx.quadraticCurveTo(162, 42, 164, 68); ctx.closePath();
    ctx.fillStyle = metal(ctx, 40, 68, p); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.9)'; ctx.lineWidth = 2.2; ctx.stroke();
    camo(ctx, helmet, p, 5, .5);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(130, 47, 10, 3.5, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.mark; ctx.fillRect(118, 60, 40, 5);
    // Arms and rifle.
    const aimed = pose !== 'idle';
    const rifleY = aimed ? 100 : 112, rifleAngle = aimed ? 0 : .3;
    ctx.save();
    ctx.translate(118, rifleY);
    ctx.rotate(-rifleAngle);
    ctx.fillStyle = vgrad(ctx, -6, 8, [[0, '#6a5038'], [1, '#3a2a1c']]);
    ctx.fillRect(-14, -2, 30, 10);
    ctx.fillStyle = vgrad(ctx, -4, 6, [[0, '#6a6f73'], [1, '#202325']]);
    ctx.fillRect(12, -4, 74, 8);
    ctx.fillRect(30, 4, 8, 14);
    ctx.fillRect(48, -9, 18, 5);
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(12, -4, 74, 8);
    ctx.restore();
    ctx.fillStyle = vgrad(ctx, 90, 120, [[0, p.light], [1, p.cloth]]);
    poly(ctx, [[112, 92], [128, 92], [150, rifleY + 2], [146, rifleY + 10], [122, 110]]); ctx.fill(); ctx.strokeStyle = 'rgba(12,16,20,.8)'; ctx.stroke();
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(150, rifleY + 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return {muzzle: aimed ? [206, 100 + crouch] : [196, 86 + crouch], angle: 0};
  }

  function drawInfantryDown(ctx, p) {
    groundShadow(ctx, 128, 70, GROUND + 2, .3);
    fillShape(ctx, [[60, 186], [190, 182], [194, 200], [60, 204]], vgrad(ctx, 182, 204, [[0, p.cloth], [1, p.dark]]));
    ctx.beginPath(); ctx.ellipse(200, 190, 16, 12, 0, 0, Math.PI * 2); ctx.fillStyle = metal(ctx, 178, 202, p); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.stroke();
    ctx.fillStyle = '#2a2d30'; ctx.fillRect(70, 176, 80, 6);
  }

  function drawScout(ctx, p, pose) {
    groundShadow(ctx, 128, 100);
    const body = [[40, 168], [52, 132], [96, 122], [176, 122], [210, 140], [222, 170], [210, 184], [48, 184]];
    fillShape(ctx, body, metal(ctx, 122, 184, p));
    camo(ctx, body, p, 21);
    specular(ctx, body);
    glass(ctx, [[176, 126], [204, 140], [196, 146], [170, 136]]);
    fillShape(ctx, [[100, 104], [146, 104], [152, 122], [96, 122]], metal(ctx, 104, 122, p));
    const [mx, my] = barrel(ctx, 146, 110, 52, 5, 0, p);
    stripe(ctx, 60, 150, 140, 6, p);
    insignia(ctx, 120, 160, 9, p);
    for (const x of [74, 120, 180]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 186, 21, Math.PI, 0); ctx.fill(); wheel(ctx, x, 186, 18); }
    return {muzzle: [mx, my], angle: 0};
  }

  function drawSupport(ctx, p, pose) {
    groundShadow(ctx, 128, 104);
    // Cab.
    const cab = [[176, 184], [176, 120], [204, 120], [226, 150], [228, 184]];
    fillShape(ctx, cab, metal(ctx, 120, 184, p));
    glass(ctx, [[184, 126], [202, 126], [218, 150], [184, 150]]);
    // Cargo bed with mortar launcher.
    const bed = [[32, 184], [32, 150], [176, 150], [176, 184]];
    fillShape(ctx, bed, metal(ctx, 150, 184, p));
    camo(ctx, bed, p, 31);
    specular(ctx, bed, .25);
    fillShape(ctx, [[66, 150], [126, 150], [118, 134], [74, 134]], metal(ctx, 134, 150, p, 'camo'));
    const [mx, my] = barrel(ctx, 96, 138, 74, 14, .75, p);
    stripe(ctx, 40, 160, 128, 5, p);
    insignia(ctx, 200, 168, 9, p);
    for (const x of [64, 112, 200]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 188, 20, Math.PI, 0); ctx.fill(); wheel(ctx, x, 188, 17); }
    return {muzzle: [mx, my], angle: .75};
  }

  function drawTank(ctx, p, pose) {
    groundShadow(ctx, 128, 112);
    track(ctx, 34, 220, 184, 34, 6);
    const hull = [[26, 168], [40, 146], [208, 146], [230, 160], [222, 172], [32, 172]];
    fillShape(ctx, hull, metal(ctx, 146, 172, p));
    camo(ctx, hull, p, 41);
    specular(ctx, hull, .3);
    fillShape(ctx, [[30, 164], [226, 164], [222, 172], [32, 172]], 'rgba(0,0,0,.35)', null);
    // Turret.
    const turret = [[70, 146], [80, 118], [132, 108], [176, 116], [186, 146]];
    fillShape(ctx, turret, metal(ctx, 108, 146, p));
    camo(ctx, turret, p, 43);
    specular(ctx, turret);
    fillShape(ctx, [[108, 110], [126, 108], [128, 100], [110, 100]], metal(ctx, 100, 110, p));
    const [mx, my] = barrel(ctx, 182, 126, 66, 9, 0, p);
    stripe(ctx, 84, 128, 30, 6, p);
    insignia(ctx, 150, 132, 9, p);
    return {muzzle: [mx, my], angle: 0};
  }

  function drawArtillery(ctx, p) {
    groundShadow(ctx, 128, 110);
    track(ctx, 36, 216, 184, 32, 6);
    const hull = [[28, 168], [40, 148], [206, 148], [224, 166], [216, 172], [32, 172]];
    fillShape(ctx, hull, metal(ctx, 148, 172, p));
    camo(ctx, hull, p, 51);
    const turret = [[44, 148], [50, 110], [140, 106], [150, 148]];
    fillShape(ctx, turret, metal(ctx, 106, 148, p));
    camo(ctx, turret, p, 53);
    specular(ctx, turret);
    const [mx, my] = barrel(ctx, 138, 118, 96, 10, .42, p);
    stripe(ctx, 56, 132, 70, 6, p);
    insignia(ctx, 176, 160, 8, p);
    return {muzzle: [mx, my], angle: .42};
  }

  function drawRocket(ctx, p) {
    groundShadow(ctx, 128, 108);
    const cab = [[176, 184], [176, 124], [206, 124], [228, 152], [228, 184]];
    fillShape(ctx, cab, metal(ctx, 124, 184, p));
    glass(ctx, [[184, 130], [204, 130], [220, 152], [184, 152]]);
    const bed = [[28, 184], [28, 156], [176, 156], [176, 184]];
    fillShape(ctx, bed, metal(ctx, 156, 184, p));
    camo(ctx, bed, p, 61);
    // Rocket pod raised on a rail.
    ctx.save();
    ctx.translate(48, 150);
    ctx.rotate(-.42);
    const pod = [[0, -30], [112, -30], [112, 4], [0, 4]];
    fillShape(ctx, pod, metal(ctx, -30, 4, p, 'camo'));
    camo(ctx, pod, p, 63);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#1b1d1f'; ctx.beginPath(); ctx.arc(112, -22 + j * 15 + (i % 2) * 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#d24c2c'; ctx.beginPath(); ctx.arc(113, -24 + i * 8, 3.2, 0, Math.PI * 2); ctx.fill(); }
    stripe(ctx, 10, -12, 60, 5, p);
    ctx.restore();
    insignia(ctx, 200, 170, 9, p);
    for (const x of [58, 104, 204]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 188, 20, Math.PI, 0); ctx.fill(); wheel(ctx, x, 188, 17); }
    return {muzzle: [48 + Math.cos(.42) * 120, 150 - Math.sin(.42) * 120 - 8], angle: .42};
  }

  function drawAntiair(ctx, p) {
    groundShadow(ctx, 128, 108);
    track(ctx, 36, 218, 184, 32, 6);
    const hull = [[28, 168], [40, 148], [206, 148], [226, 164], [216, 172], [32, 172]];
    fillShape(ctx, hull, metal(ctx, 148, 172, p));
    camo(ctx, hull, p, 71);
    const turret = [[76, 148], [84, 112], [162, 112], [172, 148]];
    fillShape(ctx, turret, metal(ctx, 112, 148, p));
    camo(ctx, turret, p, 73);
    specular(ctx, turret);
    barrel(ctx, 150, 120, 70, 6, .7, p);
    const [mx, my] = barrel(ctx, 160, 128, 70, 6, .7, p);
    // Radar dish.
    ctx.fillStyle = '#3a3e41'; ctx.fillRect(94, 86, 4, 26);
    ctx.save(); ctx.translate(96, 84); ctx.rotate(-.3);
    ctx.fillStyle = vgrad(ctx, -18, 4, [[0, '#e4e8ea'], [1, '#7c8588']]);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 8, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
    ctx.restore();
    stripe(ctx, 90, 132, 50, 6, p);
    insignia(ctx, 190, 160, 8, p);
    return {muzzle: [mx, my], angle: .7};
  }

  function drawHelicopter(ctx, p, pose) {
    groundShadow(ctx, 128, 70, GROUND + 4, .22);
    // Tail boom and fin.
    fillShape(ctx, [[30, 98], [110, 104], [110, 120], [36, 110]], metal(ctx, 98, 120, p));
    fillShape(ctx, [[24, 74], [40, 74], [46, 106], [28, 108]], metal(ctx, 74, 108, p));
    ctx.strokeStyle = 'rgba(40,40,40,.5)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(34, 92, 4, 22, 0, 0, Math.PI * 2); ctx.stroke();
    // Fuselage.
    const body = [[96, 96], [150, 84], [196, 96], [224, 118], [214, 136], [150, 142], [100, 128]];
    fillShape(ctx, body, metal(ctx, 84, 142, p));
    camo(ctx, body, p, 81);
    specular(ctx, body, .4);
    glass(ctx, [[160, 88], [194, 96], [212, 114], [174, 110], [156, 100]]);
    // Stub wing, rocket pod and chin gun.
    fillShape(ctx, [[120, 120], [176, 120], [172, 128], [124, 128]], metal(ctx, 120, 128, p));
    fillShape(ctx, [[126, 128], [168, 128], [172, 140], [124, 140]], vgrad(ctx, 128, 140, [[0, '#6b7074'], [1, '#2a2d30']]));
    const [mx, my] = barrel(ctx, 204, 138, 26, 4, -.1, {light: '#8a8f93', base: '#4a4f52', dark: '#1d2022'});
    stripe(ctx, 104, 112, 40, 5, p);
    insignia(ctx, 76, 108, 7, p);
    // Skids.
    ctx.strokeStyle = '#25282a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(120, 142); ctx.lineTo(116, 158); ctx.moveTo(182, 140); ctx.lineTo(186, 158); ctx.moveTo(100, 158); ctx.lineTo(204, 158); ctx.stroke();
    // Rotor mast and blurred blades.
    ctx.fillStyle = '#2d3134'; ctx.fillRect(152, 70, 8, 16);
    const blur = ctx.createLinearGradient(30, 0, 250, 0);
    blur.addColorStop(0, 'rgba(30,34,38,0)'); blur.addColorStop(.5, 'rgba(30,34,38,.55)'); blur.addColorStop(1, 'rgba(30,34,38,0)');
    ctx.fillStyle = blur; ctx.beginPath(); ctx.ellipse(156, 68, 112, 6, 0, 0, Math.PI * 2); ctx.fill();
    return {muzzle: [mx, my], angle: -.1};
  }

  function drawFighter(ctx, p) {
    groundShadow(ctx, 128, 70, GROUND + 4, .18);
    // Far wing.
    fillShape(ctx, [[110, 118], [150, 118], [116, 92], [100, 92]], vgrad(ctx, 92, 118, [[0, p.dark], [1, p.base]]));
    // Tail fin.
    fillShape(ctx, [[24, 116], [56, 116], [44, 70], [28, 70]], metal(ctx, 70, 116, p));
    stripe(ctx, 32, 76, 14, 8, p);
    const body = [[22, 116], [40, 108], [150, 104], [206, 112], [240, 122], [206, 132], [150, 138], [40, 134]];
    fillShape(ctx, body, metal(ctx, 104, 138, p));
    camo(ctx, body, p, 91, .35);
    specular(ctx, body, .45);
    glass(ctx, [[160, 106], [178, 96], [202, 104], [206, 112], [168, 112]]);
    // Near wing.
    fillShape(ctx, [[96, 126], [162, 126], [110, 166], [90, 166]], metal(ctx, 126, 166, p));
    insignia(ctx, 112, 148, 9, p);
    // Afterburner.
    const flame = ctx.createRadialGradient(16, 121, 1, 16, 121, 22);
    flame.addColorStop(0, 'rgba(255,245,210,.95)'); flame.addColorStop(.4, 'rgba(255,160,60,.75)'); flame.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(12, 121, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    return {muzzle: [236, 122], angle: 0};
  }

  function drawBomber(ctx, p) {
    groundShadow(ctx, 128, 90, GROUND + 4, .18);
    fillShape(ctx, [[96, 112], [150, 112], [112, 80], [92, 80]], vgrad(ctx, 80, 112, [[0, p.dark], [1, p.base]]));
    fillShape(ctx, [[18, 112], [56, 112], [44, 62], [26, 62]], metal(ctx, 62, 112, p));
    stripe(ctx, 28, 70, 16, 9, p);
    const body = [[16, 112], [40, 98], [170, 94], [222, 104], [246, 118], [222, 134], [170, 142], [40, 136]];
    fillShape(ctx, body, metal(ctx, 94, 142, p));
    camo(ctx, body, p, 101, .4);
    specular(ctx, body, .4);
    glass(ctx, [[204, 100], [224, 104], [240, 116], [212, 116]]);
    for (let x = 70; x < 200; x += 16) { ctx.fillStyle = 'rgba(20,30,40,.55)'; ctx.fillRect(x, 108, 7, 5); }
    // Near wing with two engines.
    fillShape(ctx, [[80, 128], [170, 128], [112, 182], [82, 182]], metal(ctx, 128, 182, p));
    for (const [x, y] of [[118, 150], [96, 170]]) {
      fillShape(ctx, [[x - 4, y - 7], [x + 36, y - 7], [x + 42, y], [x + 36, y + 7], [x - 4, y + 7]], vgrad(ctx, y - 7, y + 7, [[0, '#9aa1a5'], [1, '#2d3134']]));
      ctx.fillStyle = 'rgba(30,34,38,.5)'; ctx.beginPath(); ctx.ellipse(x + 44, y, 2, 14, 0, 0, Math.PI * 2); ctx.fill();
    }
    insignia(ctx, 140, 122, 9, p);
    return {muzzle: [150, 150], angle: -1.2};
  }

  function wake(ctx, x0, x1, y) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.75)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y, (x1 - x0) / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,110,150,.45)';
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2 + 20, y + 4, (x1 - x0) / 2 + 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  function hull(ctx, x0, x1, top, bottom, p, seed) {
    const shape = [[x0, top], [x1, top - 6], [x1 - 26, bottom], [x0 + 10, bottom]];
    fillShape(ctx, shape, metal(ctx, top - 6, bottom, p));
    camo(ctx, shape, p, seed, .35);
    specular(ctx, shape, .3);
    ctx.fillStyle = 'rgba(20,24,28,.6)'; ctx.fillRect(x0 + 6, bottom - 7, x1 - x0 - 30, 4);
    ctx.fillStyle = vgrad(ctx, top - 4, top + 2, [[0, '#b8b0a0'], [1, '#6c6458']]);
    ctx.fillRect(x0 + 2, top - 3, x1 - x0 - 6, 4);
  }

  function drawPatrol(ctx, p) {
    wake(ctx, 24, 200, 184);
    hull(ctx, 40, 228, 156, 184, p, 111);
    fillShape(ctx, [[92, 154], [96, 124], [156, 124], [168, 152]], metal(ctx, 124, 154, p));
    glass(ctx, [[140, 128], [156, 128], [162, 144], [140, 144]]);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(118, 96, 4, 28);
    ctx.fillRect(108, 102, 24, 3);
    const [mx, my] = barrel(ctx, 190, 146, 32, 5, .1, p);
    fillShape(ctx, [[180, 152], [196, 152], [196, 140], [180, 140]], metal(ctx, 140, 152, p));
    stripe(ctx, 60, 164, 100, 5, p);
    insignia(ctx, 76, 170, 7, p);
    return {muzzle: [mx, my], angle: .1};
  }

  function drawDestroyer(ctx, p) {
    wake(ctx, 8, 220, 186);
    hull(ctx, 14, 246, 152, 186, p, 121);
    fillShape(ctx, [[70, 150], [76, 118], [156, 118], [164, 150]], metal(ctx, 118, 150, p));
    fillShape(ctx, [[110, 118], [114, 92], [140, 92], [146, 118]], metal(ctx, 92, 118, p));
    glass(ctx, [[118, 98], [140, 98], [142, 108], [116, 108]]);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(126, 60, 4, 32); ctx.fillRect(114, 68, 28, 3);
    fillShape(ctx, [[86, 118], [100, 118], [98, 100], [88, 100]], vgrad(ctx, 100, 118, [[0, '#4c5256'], [1, '#22262a']]));
    fillShape(ctx, [[188, 150], [212, 150], [210, 138], [192, 138]], metal(ctx, 138, 150, p));
    const [mx, my] = barrel(ctx, 208, 142, 30, 5, .08, p);
    fillShape(ctx, [[34, 150], [56, 150], [54, 140], [36, 140]], metal(ctx, 140, 150, p));
    stripe(ctx, 30, 162, 180, 5, p);
    insignia(ctx, 176, 170, 7, p);
    return {muzzle: [mx, my], angle: .08};
  }

  function drawBattleship(ctx, p) {
    wake(ctx, 4, 230, 190);
    hull(ctx, 6, 250, 148, 190, p, 131);
    fillShape(ctx, [[70, 146], [78, 106], [170, 106], [178, 146]], metal(ctx, 106, 146, p));
    fillShape(ctx, [[104, 106], [110, 70], [146, 70], [152, 106]], metal(ctx, 70, 106, p));
    glass(ctx, [[114, 76], [144, 76], [146, 86], [112, 86]]);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(126, 34, 5, 36); ctx.fillRect(110, 44, 36, 3);
    for (const x of [86, 156]) fillShape(ctx, [[x, 106], [x + 14, 106], [x + 12, 82], [x + 2, 82]], vgrad(ctx, 82, 106, [[0, '#4c5256'], [1, '#22262a']]));
    let muzzle = [0, 0];
    for (const [x, dir] of [[196, 1], [222, 1], [30, -1]]) {
      fillShape(ctx, [[x - 12, 146], [x + 12, 146], [x + 10, 132], [x - 10, 132]], metal(ctx, 132, 146, p));
      if (dir > 0) muzzle = barrel(ctx, x + 8, 138, 30, 5, .12, p);
      else barrel(ctx, x - 6, 138, -26, 5, -.12, p);
    }
    stripe(ctx, 30, 160, 190, 6, p);
    insignia(ctx, 60, 170, 8, p);
    return {muzzle, angle: .12};
  }

  const drawers = {
    infantry: drawInfantry, scout: drawScout, support: drawSupport, tank: drawTank,
    artillery: drawArtillery, rocket: drawRocket, antiair: drawAntiair,
    helicopter: drawHelicopter, fighter: drawFighter, bomber: drawBomber,
    patrol: drawPatrol, destroyer: drawDestroyer, battleship: drawBattleship,
  };

  // Poses for the 7-frame combat atlas.
  const poses = ['idle', 'aim', 'fire', 'recoil', 'hit', 'duck', 'down'];

  function drawFrame(ctx, id, team, pose) {
    const p = teams[team];
    ctx.save();
    ctx.lineJoin = 'round';
    if (pose === 'down') {
      if (id === 'infantry') {
        drawInfantryDown(ctx, p);
      } else {
        ctx.save();
        ctx.translate(128, GROUND);
        ctx.rotate(.06);
        ctx.translate(-128, -GROUND + 8);
        drawers[id](ctx, p, 'idle');
        ctx.restore();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(20,16,12,.62)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        smoke(ctx, 140, 130, 40, .55);
      }
      ctx.restore();
      return;
    }
    if (pose === 'recoil') { ctx.translate(-7, 1); }
    if (pose === 'hit') { ctx.translate(128, GROUND); ctx.rotate(-.04); ctx.translate(-124, -GROUND); }
    const {muzzle, angle} = drawers[id](ctx, p, pose);
    muzzles.set(id, muzzle);
    if (pose === 'hit') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,240,220,.38)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (pose === 'fire') muzzleFlash(ctx, muzzle[0] + (pose === 'recoil' ? -7 : 0), muzzle[1], 26, angle);
    if (pose === 'recoil') smoke(ctx, muzzle[0] - 4, muzzle[1], 14, .35);
  }

  const cache = new Map();
  const muzzles = new Map();
  function canvasURL(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    return canvas.toDataURL('image/png');
  }
  // Enemy stills face left by default, like the original sprites.
  function still(id, team, facing = team === 'enemy' ? 'left' : 'right') {
    const key = `${id}:${team}:${facing}`;
    if (!cache.has(key)) {
      cache.set(key, canvasURL(W, H, ctx => {
        if (facing === 'left') { ctx.translate(W, 0); ctx.scale(-1, 1); }
        drawFrame(ctx, id, team, 'idle');
      }));
    }
    return cache.get(key);
  }
  // Map icon: the still trimmed to its visible area so the unit fills a small tile.
  function icon(id, team, facing = team === 'enemy' ? 'left' : 'right') {
    const key = `${id}:${team}:${facing}:icon`;
    if (!cache.has(key)) {
      const source = document.createElement('canvas');
      source.width = W;
      source.height = H;
      const ctx = source.getContext('2d');
      if (facing === 'left') { ctx.translate(W, 0); ctx.scale(-1, 1); }
      drawFrame(ctx, id, team, 'idle');
      const {data} = source.getContext('2d').getImageData(0, 0, W, H);
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        if (data[(y * W + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      if (x1 < x0) return still(id, team, facing);
      const pad = 4, w = x1 - x0 + 1 + pad * 2, h = y1 - y0 + 1 + pad * 2;
      cache.set(key, canvasURL(w, h, out => out.drawImage(source, x0 - pad, y0 - pad, w, h, 0, 0, w, h)));
    }
    return cache.get(key);
  }
  // Muzzle position of the aimed pose as a fraction of the right-facing frame.
  function muzzle(id) {
    if (!muzzles.has(id)) {
      const ctx = document.createElement('canvas').getContext('2d');
      drawFrame(ctx, id, 'friendly', 'aim');
    }
    const [x, y] = muzzles.get(id);
    return [x / W, y / H];
  }
  function atlas(id, team) {
    const key = `${id}:${team}:atlas`;
    if (!cache.has(key)) {
      cache.set(key, canvasURL(W, H * poses.length, ctx => {
        poses.forEach((pose, i) => {
          ctx.save();
          ctx.translate(0, i * H);
          ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
          drawFrame(ctx, id, team, pose);
          ctx.restore();
        });
      }));
    }
    return cache.get(key);
  }

  let supported = false;
  try {
    const probe = document.createElement('canvas').getContext('2d');
    supported = Boolean(probe && typeof probe.createRadialGradient === 'function');
  } catch {
    supported = false;
  }

  window.UnitArt = supported ? {
    types: Object.keys(drawers),
    still,
    icon,
    atlas,
    muzzle,
    drawFrame,
    size: [W, H],
  } : null;
})();
