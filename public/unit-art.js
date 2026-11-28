// Original unit art in a realistic, lit "3D illustration" style. Every unit is drawn in
// the browser with gradients, specular highlights, camouflage and soft shadows, facing
// right. It provides one still image per unit and team, plus a 7-frame combat atlas
// (idle, aim, fire, recoil, hit, duck, destroyed) for the units that use frame poses.
(() => {
  const W = 256, H = 224, GROUND = 204;
  const teams = {
    friendly: {base: '#4f7899', light: '#bed5e0', dark: '#203448', camo: '#3d5d61', camo2: '#80a0b1', mark: '#63e4f4', markDark: '#176d8d', cloth: '#4b7180', skin: '#e0b48e'},
    enemy: {base: '#a36549', light: '#edc1a2', dark: '#482820', camo: '#764c3a', camo2: '#bf8c6e', mark: '#ff8c61', markDark: '#a42f24', cloth: '#86583e', skin: '#d9a982'},
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
    // A bright bevel, a wide painted face, and a narrow bounce from the ground.
    return vgrad(ctx, y0, y1, [[0, p.light], [.09, p.light], [.22, base], [.51, base],
      [.78, p.dark], [.94, p.dark], [1, base]]);
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
  function strokeLine(ctx, points, color, width = 1) {
    ctx.beginPath();
    for (const [i, point] of points.entries()) {
      if (i === 0) ctx.moveTo(...point);
      else ctx.lineTo(...point);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function vents(ctx, x, y, width, rows) {
    ctx.fillStyle = '#1c2a32';
    ctx.fillRect(x, y, width, rows * 3 + 1);
    for (let row = 0; row < rows; row++) {
      strokeLine(ctx, [[x + 1, y + row * 3 + 1], [x + width - 2, y + row * 3 + 1]], '#879292');
    }
  }
  function camo(ctx, points, p, seed, alpha = .55) {
    ctx.save();
    poly(ctx, points);
    ctx.clip();
    const r = rng(seed);
    const xs = points.map(q => q[0]), ys = points.map(q => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    ctx.globalAlpha = alpha;
    // Broad, angular paint masks follow the length of a panel. Small dots turn
    // into visual noise when the same artwork is used on the board.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 3 ? p.camo : p.camo2;
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      const w = (x1 - x0) * (.12 + r() * .17), h = (y1 - y0) * (.12 + r() * .18);
      poly(ctx, [[x-w,y], [x-w*.5,y-h], [x+w*.1,y-h*.7], [x+w,y-h*1.4],
        [x+w*.58,y+h*.22], [x+w*.14,y+h], [x-w*.34,y+h*.7]]);
      ctx.fill();
    }
    ctx.restore();
  }
  function specular(ctx, points, strength = .35) {
    ctx.save();
    poly(ctx, points);
    ctx.clip();
    const xs = points.map(q => q[0]), ys = points.map(q => q[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const g = ctx.createLinearGradient(left, top, left + (right-left)*.22, bottom);
    g.addColorStop(0, `rgba(255,226,186,${strength})`);
    g.addColorStop(.25, 'rgba(255,238,217,.03)');
    g.addColorStop(.52, 'rgba(25,35,50,0)');
    g.addColorStop(.81, 'rgba(20,32,49,.35)');
    g.addColorStop(1, 'rgba(134,163,177,.20)');
    ctx.fillStyle = g;
    ctx.fillRect(left, top, right-left, bottom-top);
    // Warm edge light faces the sky. Short cool edges under the panel pick up bounced light.
    const middle = (top + bottom) * .5;
    for (const [i, a] of points.entries()) {
      const b = points[(i+1) % points.length];
      if (b[0] > a[0] && Math.max(a[1], b[1]) <= middle) {
        strokeLine(ctx, [a,b], 'rgba(255,231,192,.84)', 3.6);
      } else if (b[0] < a[0] && Math.min(a[1], b[1]) >= middle) {
        strokeLine(ctx, [a,b], 'rgba(173,210,221,.40)', 2.5);
      }
    }
    ctx.restore();
  }
  function groundShadow(ctx, cx, w, y = GROUND + 4, alpha = .4) {
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(1, .13);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, w);
    g.addColorStop(0, `rgba(10,14,10,${alpha})`);
    g.addColorStop(1, 'rgba(10,14,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, Math.PI * 2);
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
    ctx.strokeStyle = '#777b77'; ctx.lineWidth = Math.max(1,r*.08);
    ctx.beginPath(); ctx.arc(x,y,r*.8,Math.PI*1.07,Math.PI*1.76); ctx.stroke();
    ctx.fillStyle = '#c4bba7';
    for (let i=0; i<5; i++) {
      const a = i*Math.PI*2/5;
      ctx.fillRect(x+Math.cos(a)*r*.3-1, y+Math.sin(a)*r*.3-1, 1.8, 1.8);
    }
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
    const end = length < 0 ? length : length - thick * 1.6;
    ctx.fillStyle = p.light;
    ctx.fillRect(end, -thick*.62, thick*1.5, Math.max(1,thick*.18));
    ctx.fillStyle = 'rgba(246,226,190,.75)';
    ctx.fillRect(length*.22, -thick*.36, length*.35, Math.max(1,thick*.13));
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
    ctx.fillStyle = 'rgba(14,22,31,.62)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = vgrad(ctx, y, y + h, [[0, p.mark], [.5, p.mark], [1, p.markDark]]);
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
    const xs = points.map(q => q[0]), ys = points.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = x1-x0, h = y1-y0;
    ctx.fillStyle = vgrad(ctx, y0, y1, [[0, '#e0f8ec'], [.22, '#8fcdd0'], [.48, '#5083a1'],
      [.51, '#263b51'], [.83, '#172b3a'], [1, '#3d6471']]);
    ctx.fill();
    ctx.save(); ctx.clip();
    fillShape(ctx, [[x0+w*.36,y0],[x0+w*.53,y0],[x0+w*.31,y1],[x0+w*.13,y1]], 'rgba(255,244,214,.52)', null);
    fillShape(ctx, [[x0+w*.61,y0],[x0+w*.67,y0],[x0+w*.45,y1],[x0+w*.39,y1]], 'rgba(179,237,241,.36)', null);
    ctx.restore();
    poly(ctx, points);
    ctx.strokeStyle = 'rgba(12,16,20,.9)'; ctx.lineWidth = 1.8; ctx.stroke();
  }

  // ---- Units (each draws facing right, standing on GROUND) -----------------------------
  // Soldier body (legs, pack, vest, head, helmet); the caller adds the weapon and arm.
  function soldier(ctx, p, crouch) {
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
    fillShape(ctx, [[80,96],[88,90],[101,90],[100,99],[87,104],[80,102]],
      vgrad(ctx,90,104,[[0,'#c1ae76'],[1,'#655f43']]), '#393b30', 1.4);
    strokeLine(ctx, [[88,102],[92,102],[94,132]], '#b5a47e', 2);
    strokeLine(ctx, crouch ? [[131,147],[141,148],[147,161],[138,160]] : [[134,156],[145,154],[151,167],[138,170]], p.camo2, 3);
    strokeLine(ctx, crouch ? [[91,167],[96,172]] : [[99,198],[119,197]], '#99876c', 2);
    // Torso with vest.
    const torso = [[100, 86], [148, 86], [152, hip + 18], [104, hip + 18]];
    fillShape(ctx, torso, vgrad(ctx, 86, hip + 18, [[0, p.light], [.3, p.cloth], [1, p.dark]]));
    camo(ctx, torso, p, 11, .45);
    fillShape(ctx, [[106, 98], [144, 98], [146, 132], [108, 132]], vgrad(ctx, 98, 132, [[0, '#6b6a55'], [1, '#3b3a2e']]), 'rgba(12,16,20,.6)', 1.4);
    for (const x of [112, 124, 136]) {
      fillShape(ctx, [[x,112],[x+9,112],[x+10,125],[x+2,127]], vgrad(ctx,112,127,[[0,'#8f9270'],[.38,'#64674d'],[1,'#434b3c']]), 'rgba(0,0,0,.6)', 1);
      strokeLine(ctx, [[x+1,116],[x+8,115]], '#c3ba91', 1.3);
    }
    strokeLine(ctx, [[109,89],[116,102],[136,109]], '#c6b78e', 3);
    const shoulder = [[100, 91], [112, 89], [122, 95], [117, 107], [103, 105], [98, 99]];
    fillShape(ctx, shoulder, metal(ctx, 89, 107, p), '#192834', 1.7);
    specular(ctx, shoulder);
    stripe(ctx, 102, 95, 12, 5, p);
    // Head and helmet.
    const face = ctx.createRadialGradient(140, 70, 2, 136, 74, 18);
    face.addColorStop(0, '#f6d2b0'); face.addColorStop(1, p.skin);
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.ellipse(136, 74, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.8)'; ctx.lineWidth = 2; ctx.stroke();
    fillShape(ctx, [[137,68],[152,69],[151,76],[146,77],[138,75]], '#273945', '#222c30', 1.3);
    strokeLine(ctx, [[140,70],[149,70]], '#b7d9d3', 1.8);
    strokeLine(ctx, [[125,71],[128,82],[139,88],[146,85]], '#6d614e', 2.6);
    const helmet = [[114, 66], [118, 48], [134, 40], [152, 46], [160, 62], [162, 68]];
    ctx.beginPath(); ctx.moveTo(112, 68); ctx.quadraticCurveTo(118, 38, 140, 40); ctx.quadraticCurveTo(162, 42, 164, 68); ctx.closePath();
    ctx.fillStyle = metal(ctx, 40, 68, p); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.9)'; ctx.lineWidth = 2.2; ctx.stroke();
    camo(ctx, helmet, p, 5, .5);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(130, 47, 10, 3.5, -.3, 0, Math.PI * 2); ctx.fill();
    fillShape(ctx, [[115,60],[141,59],[160,62],[161,66],[141,64],[115,65]], p.mark, null);
    strokeLine(ctx, [[117,58],[123,49],[133,45]], '#e7d7b3', 2);
    ctx.fillStyle = '#a9a58c'; ctx.fillRect(118,63,5,5);
    strokeLine(ctx, [[116,68],[140,69],[161,68]], '#232b35', 2.4);
  }

  function drawInfantry(ctx, p, pose) {
    const crouch = pose === 'duck' ? 26 : 0;
    groundShadow(ctx, 128, 56);
    ctx.save();
    ctx.translate(0, crouch);
    soldier(ctx, p, crouch);
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
    vents(ctx,64,136,22,3);
    strokeLine(ctx, [[134,132],[154,130],[165,141],[163,165],[134,167],[134,132]], 'rgba(20,35,43,.58)', 1.8);
    ctx.fillStyle = '#e8d4a4'; ctx.fillRect(213,153,7,4);
    strokeLine(ctx, [[77,123],[73,87],[71,78]], '#4b5553', 1.8);
    insignia(ctx, 120, 160, 9, p);
    for (const x of [74, 120, 180]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 186, 21, Math.PI, 0); ctx.fill(); wheel(ctx, x, 186, 18); }
    return {muzzle: [mx, my], angle: 0};
  }

  function drawSupport(ctx, p, pose) {
    groundShadow(ctx, 128, 104);
    // Cab.
    const cab = [[176, 184], [176, 120], [204, 120], [226, 150], [228, 184]];
    fillShape(ctx, cab, metal(ctx, 120, 184, p));
    specular(ctx, cab);
    glass(ctx, [[184, 126], [202, 126], [218, 150], [184, 150]]);
    // Cargo bed with mortar launcher.
    const bed = [[32, 184], [32, 150], [176, 150], [176, 184]];
    fillShape(ctx, bed, metal(ctx, 150, 184, p));
    camo(ctx, bed, p, 31);
    specular(ctx, bed, .25);
    fillShape(ctx, [[66, 150], [126, 150], [118, 134], [74, 134]], metal(ctx, 134, 150, p, 'camo'));
    const [mx, my] = barrel(ctx, 96, 138, 74, 14, .75, p);
    stripe(ctx, 40, 160, 128, 5, p);
    for (const x of [52,84,116,149]) strokeLine(ctx, [[x,153],[x-1,176]], 'rgba(25,39,44,.65)', 2);
    ctx.fillStyle = '#ede3b0'; ctx.fillRect(222,154,5,5);
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
    fillShape(ctx, [[82,118],[131,110],[171,117],[153,125],[97,126]], 'rgba(210,225,227,.20)', null);
    fillShape(ctx, [[108, 110], [126, 108], [128, 100], [110, 100]], metal(ctx, 100, 110, p));
    fillShape(ctx, [[175,120],[187,119],[192,126],[186,137],[178,139]], metal(ctx, 119, 139, p));
    const [mx, my] = barrel(ctx, 182, 126, 66, 9, 0, p);
    stripe(ctx, 84, 128, 30, 6, p);
    vents(ctx,43,152,26,3);
    glass(ctx, [[112,102],[122,102],[123,106],[112,106]]);
    strokeLine(ctx, [[78,118],[77,104],[76,82]], '#434e52', 1.6);
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
    vents(ctx,57,115,20,3);
    strokeLine(ctx, [[96,113],[122,112],[128,128],[101,129],[96,113]], 'rgba(20,35,43,.65)', 1.5);
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
    specular(ctx, pod, .45);
    fillShape(ctx, [[106,-29],[117,-25],[117,7],[106,3]], metal(ctx,-29,7,p), '#29343b', 1.4);
    for (let row=0; row<3; row++) for (let column=0; column<2; column++) {
      const x=109+column*5, y=-23+row*10+column*2;
      ctx.fillStyle = '#192429'; ctx.beginPath(); ctx.ellipse(x,y,2.6,4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c58e76'; ctx.fillRect(x-1,y-2,1.5,2);
    }
    strokeLine(ctx, [[6,-25],[97,-25]], p.light, 1.5);
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
    strokeLine(ctx, [[-16,-4],[2,-14],[8,-4]], '#555d60', 1.5);
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
    vents(ctx,110,99,19,3);
    insignia(ctx, 76, 108, 7, p);
    // Skids.
    ctx.strokeStyle = '#25282a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(120, 142); ctx.lineTo(116, 158); ctx.moveTo(182, 140); ctx.lineTo(186, 158); ctx.moveTo(100, 158); ctx.lineTo(204, 158); ctx.stroke();
    // Rotor mast and blurred blades.
    ctx.fillStyle = '#2d3134'; ctx.fillRect(152, 70, 8, 16);
    const blur = ctx.createLinearGradient(30, 0, 250, 0);
    blur.addColorStop(0, 'rgba(30,34,38,0)'); blur.addColorStop(.5, 'rgba(30,34,38,.55)'); blur.addColorStop(1, 'rgba(30,34,38,0)');
    ctx.fillStyle = blur; ctx.beginPath(); ctx.ellipse(156, 68, 112, 6, 0, 0, Math.PI * 2); ctx.fill();
    strokeLine(ctx, [[48,70],[154,68],[244,65]], '#485557', 1.5);
    strokeLine(ctx, [[55,69],[91,68]], '#d4cbb2', 1.2);
    fillShape(ctx, [[148,71],[155,65],[163,68],[166,72]], metal(ctx,65,72,p), '#323d43', 1);
    return {muzzle: [mx, my], angle: -.1};
  }

  function jetIntake(ctx, x, y, p) {
    fillShape(ctx, [[x,y],[x+24,y-3],[x+31,y],[x+24,y+8],[x+2,y+9]], metal(ctx,y-3,y+9,p), '#35444a', 1.6);
    fillShape(ctx, [[x+19,y],[x+28,y],[x+23,y+5],[x+16,y+6]], '#1a2831', null);
    strokeLine(ctx, [[x+3,y+1],[x+18,y-1],[x+25,y-1]], p.light, 1.4);
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
    const wing = [[96, 126], [162, 126], [110, 166], [90, 166]];
    fillShape(ctx, wing, metal(ctx, 126, 166, p));
    fillShape(ctx, [[95,144],[142,137],[125,149],[93,156]], 'rgba(208,224,214,.23)', null);
    insignia(ctx, 112, 148, 9, p);
    strokeLine(ctx, [[96,160],[106,160],[135,139]], p.dark, 1.5);
    jetIntake(ctx,134,120,p);
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
    const wing = [[80, 128], [170, 128], [112, 182], [82, 182]];
    fillShape(ctx, wing, metal(ctx, 128, 182, p));
    specular(ctx, wing, .4);
    for (const [x, y] of [[118, 150], [96, 170]]) {
      fillShape(ctx, [[x - 4, y - 7], [x + 36, y - 7], [x + 42, y], [x + 36, y + 7], [x - 4, y + 7]], vgrad(ctx, y - 7, y + 7, [[0, '#9aa1a5'], [1, '#2d3134']]));
      ctx.fillStyle = 'rgba(30,34,38,.5)'; ctx.beginPath(); ctx.ellipse(x + 44, y, 2, 14, 0, 0, Math.PI * 2); ctx.fill();
      strokeLine(ctx, [[x,y-5],[x+29,y-5]], '#d5d3be', 1.6);
      ctx.fillStyle = '#222f35'; ctx.fillRect(x+28,y-4,2,9);
    }
    insignia(ctx, 140, 122, 9, p);
    return {muzzle: [150, 150], angle: -1.2};
  }

  function wake(ctx, x0, x1, y) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0,'rgba(140,194,190,0)'); g.addColorStop(.2,'rgba(133,195,206,.36)');
    g.addColorStop(.8,'rgba(191,225,227,.66)'); g.addColorStop(1,'rgba(247,245,222,.90)');
    for (let i=0; i<3; i++) {
      const base=y+2+i*2.5;
      ctx.beginPath(); ctx.moveTo(x0-i*5,base+i);
      ctx.bezierCurveTo(x0+38,base-4,x1-32,base+3,x1-i*9,base-5);
      ctx.strokeStyle=g; ctx.lineWidth=3-i*.6; ctx.stroke();
    }
    // Broken wake crests keep the direction of travel visible against dark water.
    const x = x1 - 42;
    strokeLine(ctx, [[x,y+10],[x+14,y+9],[x+22,y+6]], 'rgba(210,246,240,.58)', 2.2);
    strokeLine(ctx, [[x+25,y+8],[x+35,y+7],[x+40,y+4]], 'rgba(243,246,226,.64)', 1.6);
  }
  function hull(ctx, x0, x1, top, bottom, p, seed) {
    const mid=(x0+x1)/2;
    const shape = [[x0,top],[mid,top-1],[x1-14,top-5],[x1,top-9],
      [x1-7,top+5],[x1-20,bottom-4],[x1-34,bottom],[mid,bottom+1],[x0+15,bottom],[x0+4,bottom-7]];
    fillShape(ctx, shape, metal(ctx, top - 6, bottom, p));
    camo(ctx, shape, p, seed, .35);
    specular(ctx, shape, .3);
    ctx.save(); poly(ctx,shape); ctx.clip();
    fillShape(ctx, [[x0,bottom-7],[mid,bottom-4],[x1,bottom-12],[x1,bottom+3],[x0,bottom+3]],
      vgrad(ctx,bottom-10,bottom+1,[[0,'#8c6657'],[.4,'#684f47'],[1,'#343e45']]), null);
    for (let x=x0+20; x<x1-20; x+=17) {
      ctx.fillStyle='#29383e'; ctx.fillRect(x,top+4,3.8,2.6);
      ctx.fillStyle='#bba995'; ctx.fillRect(x,top+6.7,3,1);
    }
    ctx.restore();
    // Reflected sky marks the waterline even in the dark foreground of the bay.
    strokeLine(ctx, [[x0+15,bottom],[mid,bottom+1],[x1-34,bottom],[x1-20,bottom-4]], '#a8c5c7', 2.4);
    strokeLine(ctx, [[x0+1,top],[mid,top-1],[x1-14,top-5],[x1-2,top-8]], '#e0c7a2', 2.6);
    // A short railing at the stern leaves the front turrets easy to read.
    for (let x=x0+4; x<x0+29; x+=8) strokeLine(ctx,[[x,top],[x,top-6]],'#6d7778',1.4);
    strokeLine(ctx,[[x0+4,top-6],[x0+28,top-6]],'#c1c3b6',1.2);
  }

  function drawPatrol(ctx, p) {
    wake(ctx, 24, 200, 184);
    hull(ctx, 40, 228, 156, 184, p, 111);
    const bridge = [[92, 154], [96, 124], [108, 116], [148, 116], [159, 124], [173, 152]];
    fillShape(ctx, bridge, metal(ctx, 116, 154, p));
    specular(ctx, bridge, .4);
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
    vents(ctx,87,126,23,3);
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
    for (const x of [117,127,137]) strokeLine(ctx,[[x,78],[x-2,86]],p.dark,1.4);
    vents(ctx,92,115,22,3);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(126, 34, 5, 36); ctx.fillRect(110, 44, 36, 3);
    for (const x of [86, 156]) fillShape(ctx, [[x, 106], [x + 14, 106], [x + 12, 82], [x + 2, 82]], vgrad(ctx, 82, 106, [[0, '#4c5256'], [1, '#22262a']]));
    let muzzle = [0, 0];
    for (const [x, dir] of [[196, 1], [222, 1], [30, -1]]) {
      fillShape(ctx, [[x - 13, 147], [x + 13, 147], [x + 11, 134], [x + 4, 128], [x - 8, 129]],
        metal(ctx, 128, 147, p));
      if (dir > 0) muzzle = barrel(ctx, x + 8, 138, 30, 5, .12, p);
      else barrel(ctx, x - 6, 138, -26, 5, -.12, p);
    }
    stripe(ctx, 30, 160, 190, 6, p);
    insignia(ctx, 60, 170, 8, p);
    return {muzzle, angle: .12};
  }

  // ---- Added units ----------------------------------------------------------------
  // Shoulder-fired launcher; returns the launcher mouth and rear in frame coordinates.
  function launcher(ctx, p, x, y, angle, loaded) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    fillShape(ctx, [[-58, -6], [-48, -6], [-48, 6], [-58, 6], [-64, 9], [-64, -9]], vgrad(ctx, -9, 9, [[0, '#6c6f66'], [1, '#22251f']]));
    const tube = [[-48, -6], [66, -6], [66, 6], [-48, 6]];
    fillShape(ctx, tube, metal(ctx, -6, 6, p, 'camo'));
    camo(ctx, tube, p, 141, .4);
    specular(ctx, tube, .4);
    fillShape(ctx, [[64, -8], [76, -8], [76, 8], [64, 8]], vgrad(ctx, -8, 8, [[0, '#7b7f78'], [1, '#262823']]));
    fillShape(ctx, [[8, -6], [10, -14], [28, -14], [28, -6]], vgrad(ctx, -14, -6, [[0, '#5a5e60'], [1, '#1f2224']]), 'rgba(0,0,0,.8)', 1.4);
    glass(ctx, [[10, -13], [15, -13], [15, -8], [10, -8]]);
    for (const gx of [4, 34]) fillShape(ctx, [[gx, 6], [gx + 7, 6], [gx + 5, 18], [gx - 1, 18]], '#2b2d2a', 'rgba(0,0,0,.8)', 1.2);
    stripe(ctx, -30, -6, 10, 12, p);
    if (loaded) {
      fillShape(ctx, [[76, -4], [82, -7], [94, -7], [104, 0], [94, 7], [82, 7], [76, 4]], vgrad(ctx, -7, 7, [[0, '#9aa274'], [.4, '#5d6a3a'], [1, '#2c331a']]), 'rgba(0,0,0,.8)', 1.4);
    }
    ctx.restore();
    const c = Math.cos(angle), s = Math.sin(angle);
    return {mouth: [x + c * 76, y - s * 76], rear: [x - c * 64, y + s * 64]};
  }

  function drawAntitank(ctx, p, pose) {
    const crouch = pose === 'duck' ? 26 : 0;
    groundShadow(ctx, 128, 56);
    ctx.save();
    ctx.translate(0, crouch);
    soldier(ctx, p, crouch);
    const aimed = pose !== 'idle', angle = aimed ? 0 : .42, sx = 124, sy = aimed ? 88 : 92;
    const {mouth, rear} = launcher(ctx, p, sx, sy, angle, pose === 'idle' || pose === 'aim' || pose === 'duck' || pose === 'hit');
    // Arm reaching to the front grip.
    const c = Math.cos(angle), s = Math.sin(angle);
    const hx = sx + c * 37 - s * 14, hy = sy - s * 37 + c * 14;
    ctx.fillStyle = vgrad(ctx, 90, 120, [[0, p.light], [1, p.cloth]]);
    poly(ctx, [[112, 94], [128, 94], [hx + 2, hy - 4], [hx, hy + 6], [118, 114]]); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.8)'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    // Backblast out of the rear of the tube.
    if (pose === 'fire') { muzzleFlash(ctx, rear[0], rear[1], 22, Math.PI + angle); smoke(ctx, rear[0] - 14, rear[1], 18, .45); }
    ctx.restore();
    return {muzzle: [mouth[0], mouth[1] + crouch], angle};
  }

  function drawAntitankDown(ctx, p) {
    ctx.save();
    ctx.translate(-30, 112);
    ctx.rotate(-.04);
    launcher(ctx, p, 140, 82, 0, false);
    ctx.restore();
    drawInfantryDown(ctx, p);
  }

  function drawHeavytank(ctx, p) {
    groundShadow(ctx, 128, 124);
    track(ctx, 16, 238, 182, 40, 8);
    // Armoured side skirt over the upper run of the track.
    const skirt = [[18, 164], [234, 164], [240, 176], [16, 178]];
    fillShape(ctx, skirt, metal(ctx, 164, 178, p, 'camo'));
    camo(ctx, skirt, p, 151, .45);
    ctx.strokeStyle = 'rgba(12,16,20,.55)'; ctx.lineWidth = 1.4;
    for (let x = 46; x < 232; x += 30) { ctx.beginPath(); ctx.moveTo(x, 165); ctx.lineTo(x, 177); ctx.stroke(); }
    ctx.fillStyle = 'rgba(230,230,220,.45)';
    for (let x = 28; x < 232; x += 15) { ctx.beginPath(); ctx.arc(x, 168, 1.3, 0, Math.PI * 2); ctx.fill(); }
    const body = [[12, 164], [26, 138], [212, 136], [246, 154], [238, 166], [14, 166]];
    fillShape(ctx, body, metal(ctx, 136, 166, p));
    camo(ctx, body, p, 153);
    specular(ctx, body, .3);
    strokeLine(ctx, [[25,157],[60,155],[196,155],[210,151]], 'rgba(25,38,47,.72)', 2.2);
    // Spare track links on the glacis.
    for (let i = 0; i < 3; i++) fillShape(ctx, [[214 + i * 9, 141 + i * 4], [222 + i * 9, 145 + i * 4], [220 + i * 9, 151 + i * 4], [212 + i * 9, 147 + i * 4]], '#2c2e2f', 'rgba(0,0,0,.7)', 1);
    // Angular turret with a rear bustle.
    const turret = [[40, 136], [44, 116], [64, 104], [100, 94], [158, 94], [188, 104], [198, 122], [192, 136]];
    fillShape(ctx, turret, metal(ctx, 94, 136, p));
    camo(ctx, turret, p, 155);
    specular(ctx, turret, .38);
    fillShape(ctx, [[64, 104], [188, 104], [198, 122], [44, 116]], 'rgba(216,230,226,.18)', 'rgba(12,16,20,.42)', 1.6);
    fillShape(ctx, [[44,116],[74,122],[70,135],[42,135]], metal(ctx, 116, 135, p, 'camo'), '#24333b', 1.5);
    fillShape(ctx, [[94, 94], [98, 84], [124, 84], [128, 94]], metal(ctx, 84, 94, p));
    glass(ctx, [[102, 87], [110, 87], [110, 91], [102, 91]]);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(140, 74, 3, 20);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = vgrad(ctx, 108, 116, [[0, '#6b7074'], [1, '#222527']]); ctx.fillRect(56 + i * 8, 108, 6, 9); }
    // Mantlet and long, thick gun with a fume extractor.
    fillShape(ctx, [[188, 108], [204, 110], [204, 132], [188, 134]], metal(ctx, 108, 134, p));
    const [mx, my] = barrel(ctx, 202, 120, 52, 12, 0, p);
    fillShape(ctx, [[220, 113], [232, 113], [232, 127], [220, 127]], vgrad(ctx, 113, 127, [[0, p.light], [.45, p.base], [1, p.dark]]), 'rgba(12,16,20,.85)', 1.6);
    stripe(ctx, 60, 122, 40, 7, p);
    insignia(ctx, 150, 120, 10, p);
    return {muzzle: [mx, my], angle: 0};
  }

  function drawDrone(ctx, p) {
    groundShadow(ctx, 128, 76, GROUND + 4, .16);
    // Far wing and far tail fin.
    fillShape(ctx, [[118, 110], [146, 110], [132, 62], [116, 62]], vgrad(ctx, 62, 110, [[0, p.dark], [1, p.base]]));
    fillShape(ctx, [[46, 110], [64, 110], [54, 82], [44, 82]], vgrad(ctx, 82, 110, [[0, p.dark], [1, p.base]]));
    // Slim fuselage with a satellite-link hump at the nose.
    const body = [[36, 114], [62, 108], [160, 106], [184, 98], [214, 100], [232, 110], [236, 118], [222, 126], [190, 130], [62, 124], [36, 120]];
    fillShape(ctx, body, metal(ctx, 98, 130, p));
    camo(ctx, body, p, 161, .3);
    specular(ctx, body, .45);
    fillShape(ctx, [[76, 108], [88, 100], [104, 100], [108, 107]], metal(ctx, 100, 108, p), 'rgba(12,16,20,.8)', 1.6);
    ctx.fillStyle = '#1b1e20'; ctx.fillRect(98, 102, 8, 4);
    ctx.fillStyle = '#2d3134'; ctx.fillRect(150, 96, 2, 10);
    // Near tail fin of the V-tail.
    const fin = [[38, 114], [62, 114], [38, 84], [26, 88]];
    fillShape(ctx, fin, metal(ctx, 84, 114, p));
    specular(ctx, fin, .45);
    stripe(ctx, 32, 92, 14, 6, p);
    // Rear pusher propeller.
    fillShape(ctx, [[36, 112], [26, 117], [36, 122]], '#3a3e41', 'rgba(0,0,0,.8)', 1.4);
    const prop = ctx.createRadialGradient(24, 117, 1, 24, 117, 24);
    prop.addColorStop(0, 'rgba(30,34,38,.6)'); prop.addColorStop(1, 'rgba(30,34,38,.08)');
    ctx.fillStyle = prop; ctx.beginPath(); ctx.ellipse(24, 117, 4, 24, 0, 0, Math.PI * 2); ctx.fill();
    // Sensor ball under the nose.
    ctx.fillStyle = '#2d3134'; ctx.fillRect(201, 124, 6, 4);
    const ball = ctx.createRadialGradient(202, 131, 1, 204, 133, 8);
    ball.addColorStop(0, '#d8dcdf'); ball.addColorStop(.5, '#7d8488'); ball.addColorStop(1, '#2b2e30');
    ctx.fillStyle = ball; ctx.beginPath(); ctx.arc(204, 133, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
    glass(ctx, [[206, 130], [211, 131], [211, 136], [206, 137]]);
    // Long, straight near wing with two missiles.
    const wing = [[112, 120], [146, 120], [112, 186], [90, 186]];
    fillShape(ctx, wing, metal(ctx, 120, 186, p));
    specular(ctx, wing, .3);
    strokeLine(ctx, [[98,180],[107,178],[127,139]], p.dark, 1.6);
    insignia(ctx, 116, 164, 8, p);
    let muzzle = [0, 0];
    for (const [x, y] of [[132, 142], [118, 172]]) {
      ctx.fillStyle = '#2d3134'; ctx.fillRect(x - 4, y - 7, 5, 5);
      fillShape(ctx, [[x - 22, y - 3], [x + 8, y - 3], [x + 16, y], [x + 8, y + 3], [x - 22, y + 3]], vgrad(ctx, y - 3, y + 3, [[0, '#e4e6e0'], [1, '#7c8178']]), 'rgba(0,0,0,.8)', 1.2);
      fillShape(ctx, [[x - 22, y - 3], [x - 26, y - 7], [x - 18, y - 3]], '#3a3e41', null);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 2, y - 3, 3, 6);
      if (!muzzle[0]) muzzle = [x + 16, y];
    }
    return {muzzle, angle: 0};
  }

  function drawSubmarine(ctx, p) {
    const dark = {light: p.base, base: p.dark, dark: '#0c1014'};
    wake(ctx, 10, 238, 186);
    // Stern rudder above the water.
    fillShape(ctx, [[20, 178], [26, 154], [38, 154], [42, 176]], metal(ctx, 154, 178, dark));
    const body = [[12, 186], [24, 178], [60, 170], [196, 168], [226, 172], [246, 182], [242, 188], [14, 190]];
    fillShape(ctx, body, metal(ctx, 168, 190, dark));
    specular(ctx, body, .32);
    ctx.strokeStyle = 'rgba(200,210,215,.18)'; ctx.lineWidth = 1;
    for (const x of [70, 96, 196, 214]) { ctx.beginPath(); ctx.moveTo(x, 171); ctx.lineTo(x + 8, 171); ctx.stroke(); }
    // Conning tower with dive planes and masts.
    ctx.fillStyle = '#2d3134';
    ctx.fillRect(126, 94, 4, 32); ctx.fillRect(124, 92, 8, 8);
    ctx.fillRect(140, 104, 3, 22); ctx.fillRect(152, 112, 2, 14); ctx.fillRect(149, 112, 8, 2);
    const sail = [[110, 170], [114, 132], [122, 124], [160, 124], [170, 132], [178, 170]];
    fillShape(ctx, sail, metal(ctx, 124, 170, dark));
    camo(ctx, sail, p, 171, .18);
    specular(ctx, sail, .4);
    stripe(ctx, 117, 131, 52, 5, p);
    for (const x of [127,136,145,154]) {
      ctx.fillStyle='#15212a'; ctx.fillRect(x,127,5,2.8);
    }
    strokeLine(ctx, [[174,171],[198,171],[213,173]], 'rgba(225,231,207,.74)', 2.1);
    insignia(ctx, 140, 148, 8, p);
    fillShape(ctx, [[150, 158], [194, 160], [192, 165], [150, 165]], metal(ctx, 158, 165, dark), 'rgba(12,16,20,.85)', 1.6);
    // Water line over the submerged hull, with bow foam.
    ctx.fillStyle = vgrad(ctx, 180, 198, [[0, 'rgba(40,110,150,.7)'], [1, 'rgba(40,110,150,.2)']]);
    ctx.beginPath(); ctx.ellipse(128, 189, 124, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const [x, y, r] of [[238, 182, 7], [228, 186, 6], [246, 186, 4], [214, 188, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    return {muzzle: [240, 182], angle: 0};
  }

  function drawMortar(ctx, p, pose) {
    const crouch = pose === 'duck' ? 26 : 16;
    groundShadow(ctx, 128, 60);
    // Baseplate and tube in front of the crouching crew member.
    const angle = 1.05, bx = 186, by = GROUND - 4;
    ctx.fillStyle = vgrad(ctx, by - 6, by + 4, [[0, '#6a6f73'], [1, '#2a2d30']]);
    poly(ctx, [[bx - 22, by + 2], [bx + 20, by + 2], [bx + 14, by - 6], [bx - 16, by - 6]]); ctx.fill();
    ctx.save();
    ctx.translate(bx, by - 4);
    ctx.rotate(-angle);
    ctx.fillStyle = vgrad(ctx, -7, 7, [[0, '#8a9096'], [.4, '#4a4f54'], [1, '#1e2124']]);
    ctx.fillRect(0, -7, 82, 14);
    ctx.fillStyle = '#2a2d30'; ctx.fillRect(74, -9, 10, 18);
    ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(0, -7, 82, 14);
    ctx.restore();
    // Bipod.
    ctx.strokeStyle = '#2a2d30'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx + 18, by - 38); ctx.lineTo(bx + 30, by); ctx.moveTo(bx + 18, by - 38); ctx.lineTo(bx + 8, by); ctx.stroke();
    ctx.save();
    ctx.translate(-14, crouch);
    soldier(ctx, p, true);
    ctx.fillStyle = vgrad(ctx, 90, 120, [[0, p.light], [1, p.cloth]]);
    poly(ctx, [[120, 94], [136, 94], [176, 128], [170, 136], [126, 112]]); ctx.fill(); ctx.strokeStyle = 'rgba(12,16,20,.8)'; ctx.stroke();
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(174, 132, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const c = Math.cos(angle), sn = Math.sin(angle);
    if (pose === 'fire') smoke(ctx, bx + c * 90, by - 4 - sn * 90, 16, .4);
    return {muzzle: [bx + c * 84, by - 4 - sn * 84], angle};
  }

  function drawSamlauncher(ctx, p) {
    groundShadow(ctx, 128, 110);
    const cab = [[180, 184], [180, 126], [208, 126], [230, 152], [230, 184]];
    fillShape(ctx, cab, metal(ctx, 126, 184, p));
    glass(ctx, [[188, 132], [206, 132], [222, 152], [188, 152]]);
    const bed = [[26, 184], [26, 158], [180, 158], [180, 184]];
    fillShape(ctx, bed, metal(ctx, 158, 184, p));
    camo(ctx, bed, p, 161);
    // Twin missile canisters on a raised launcher.
    ctx.fillStyle = '#3a3e41'; ctx.fillRect(90, 132, 12, 28);
    ctx.save();
    ctx.translate(52, 146);
    ctx.rotate(-.55);
    for (const y of [-34, -14]) {
      const can = [[0, y], [128, y], [128, y + 18], [0, y + 18]];
      fillShape(ctx, can, metal(ctx, y, y + 18, p, 'camo'));
      camo(ctx, can, p, 163 + y, .4);
      ctx.fillStyle = '#e9e4d6'; ctx.beginPath(); ctx.arc(128, y + 9, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.fillStyle = '#d24c2c'; ctx.fillRect(116, y + 2, 6, 14);
    }
    stripe(ctx, 12, -8, 56, 5, p);
    ctx.restore();
    // Search radar on the cab.
    ctx.fillStyle = '#3a3e41'; ctx.fillRect(196, 106, 4, 20);
    ctx.fillStyle = vgrad(ctx, 94, 110, [[0, '#e4e8ea'], [1, '#7c8588']]);
    ctx.fillRect(184, 96, 28, 12); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.4; ctx.strokeRect(184, 96, 28, 12);
    for (const x of [190,197,204]) strokeLine(ctx,[[x,97],[x,107]], '#78868b');
    strokeLine(ctx, [[185,102],[211,102]], '#78868b');
    insignia(ctx, 204, 170, 9, p);
    for (const x of [56, 104, 150, 206]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 188, 18, Math.PI, 0); ctx.fill(); wheel(ctx, x, 188, 15); }
    const c = Math.cos(.55), sn = Math.sin(.55);
    return {muzzle: [52 + c * 136, 146 - sn * 136 - 14], angle: .55};
  }

  function drawCruiser(ctx, p) {
    wake(ctx, 6, 230, 188);
    hull(ctx, 8, 250, 150, 188, p, 171);
    fillShape(ctx, [[60, 150], [66, 112], [170, 112], [178, 150]], metal(ctx, 112, 150, p));
    camo(ctx, [[60, 150], [66, 112], [170, 112], [178, 150]], p, 173, .3);
    fillShape(ctx, [[100, 112], [106, 82], [146, 82], [152, 112]], metal(ctx, 82, 112, p));
    glass(ctx, [[110, 88], [142, 88], [144, 98], [108, 98]]);
    for (const x of [117,127,137]) strokeLine(ctx,[[x,89],[x-1,97]],p.dark,1.4);
    vents(ctx,76,120,24,3);
    // The broad angled radar panel reads differently from the battleship's narrow mast at map scale.
    fillShape(ctx, [[114,82],[122,53],[132,53],[141,82]], metal(ctx,53,82,p));
    fillShape(ctx, [[103,45],[142,35],[151,52],[111,63]], vgrad(ctx,35,63,[[0,'#d4dedb'],[1,'#657987']]));
    strokeLine(ctx, [[109,48],[140,40]], '#ebeee1', 2);
    // Missile cells on the foredeck and guns fore and aft.
    ctx.fillStyle = '#2b2f32'; ctx.fillRect(184, 142, 26, 8);
    ctx.fillStyle = '#6b7276';
    for (let i = 0; i < 4; i++) ctx.fillRect(186 + i * 6, 143, 4, 6);
    fillShape(ctx, [[212, 150], [234, 150], [232, 138], [214, 138]], metal(ctx, 138, 150, p));
    const [mx, my] = barrel(ctx, 230, 142, 26, 5, .12, p);
    fillShape(ctx, [[24, 150], [48, 150], [46, 138], [26, 138]], metal(ctx, 138, 150, p));
    barrel(ctx, 28, 142, -22, 5, -.1, p);
    stripe(ctx, 24, 164, 196, 5, p);
    insignia(ctx, 184, 172, 7, p);
    return {muzzle: [mx, my], angle: .12};
  }

  function drawStriker(ctx, p) {
    groundShadow(ctx, 128, 76, GROUND + 4, .18);
    fillShape(ctx, [[91,118],[146,118],[135,77],[106,77]], vgrad(ctx,77,118,[[0,p.dark],[1,p.base]]));
    // Twin tail fins.
    fillShape(ctx, [[22, 118], [54, 118], [46, 76], [30, 76]], metal(ctx, 76, 118, p));
    fillShape(ctx, [[36, 116], [64, 116], [58, 84], [46, 84]], vgrad(ctx, 84, 116, [[0, p.dark], [1, p.base]]));
    stripe(ctx, 32, 82, 14, 8, p);
    const body = [[20, 118], [40, 108], [146, 106], [200, 112], [236, 124], [200, 134], [146, 140], [40, 134]];
    fillShape(ctx, body, metal(ctx, 106, 140, p));
    camo(ctx, body, p, 181, .45);
    specular(ctx, body, .4);
    glass(ctx, [[158, 108], [174, 98], [196, 106], [200, 114], [164, 114]]);
    // Near wing with bombs and rocket pods.
    const wing = [[88,128],[153,128],[131,177],[99,177]];
    fillShape(ctx, wing, metal(ctx,128,177,p));
    specular(ctx, wing, .45);
    for (const [x, y] of [[100, 150], [124, 140]]) {
      fillShape(ctx, [[x - 14, y], [x + 16, y], [x + 22, y + 5], [x + 16, y + 10], [x - 14, y + 10]], vgrad(ctx, y, y + 10, [[0, '#7c8a6a'], [1, '#2c331a']]), 'rgba(0,0,0,.8)', 1.2);
    }
    insignia(ctx, 116, 132, 8, p);
    jetIntake(ctx,138,120,p);
    const flame = ctx.createRadialGradient(16, 124, 1, 16, 124, 18);
    flame.addColorStop(0, 'rgba(255,245,210,.9)'); flame.addColorStop(.4, 'rgba(255,160,60,.65)'); flame.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(12, 124, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    return {muzzle: [124, 150], angle: -.5};
  }

  const drawers = {
    infantry: drawInfantry, scout: drawScout, support: drawSupport, tank: drawTank,
    artillery: drawArtillery, rocket: drawRocket, antiair: drawAntiair,
    helicopter: drawHelicopter, fighter: drawFighter, bomber: drawBomber,
    patrol: drawPatrol, destroyer: drawDestroyer, battleship: drawBattleship,
    antitank: drawAntitank, heavytank: drawHeavytank, drone: drawDrone, submarine: drawSubmarine,
    mortar: drawMortar, samlauncher: drawSamlauncher, cruiser: drawCruiser, striker: drawStriker,
  };
  const downDrawers = {infantry: drawInfantryDown, antitank: drawAntitankDown, mortar: drawInfantryDown};

  // Poses for the 7-frame combat atlas.
  const poses = ['idle', 'aim', 'fire', 'recoil', 'hit', 'duck', 'down'];

  function drawFrame(ctx, id, team, pose) {
    const p = teams[team];
    ctx.save();
    ctx.lineJoin = 'round';
    if (pose === 'down') {
      if (downDrawers[id]) {
        downDrawers[id](ctx, p);
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
    // The muzzle flash is aimed from the aiming pose, whatever pose was drawn last.
    if (pose === 'aim') muzzles.set(id, muzzle);
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
  // Battle sprites travel through inherited CSS custom properties; a short blob: URL keeps every
  // fighter from re-parsing a 300 KB data: URL. The cache has a fixed set of keys, so nothing leaks.
  function pngObjectURL(canvas) {
    const data = canvas.toDataURL('image/png');
    if (typeof Blob === 'undefined' || !URL.createObjectURL) return data;
    const binary = atob(data.slice(data.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
  }
  function canvasURL(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    return pngObjectURL(canvas);
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
        // A hovering aircraft's translucent ground shadow must not shrink its board icon.
        if (data[(y * W + x) * 4 + 3] > 110) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
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
