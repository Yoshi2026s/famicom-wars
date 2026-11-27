// Original hand-coded map art. Paints the static terrain of a map into one canvas
// (joined roads and rivers, rounded coastlines, depth-shaded sea, layered forests and
// mountains) and draws the facility sprites for each owner. Everything is generated
// in the browser once per map, so the game ships no extra image files for it.
(() => {
  const inWorker = typeof document === 'undefined';
  function makeCanvas(width, height) {
    if (inWorker) return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  const waterIds = new Set(['sea', 'shoal']);
  const roadIds = new Set(['road', 'bridge']);
  const riverIds = new Set(['river', 'bridge']);

  function hash(x, y, k = 0) {
    let h = Math.imul(x + 374761, 668265263) ^ Math.imul(y + 9127, 2246822519) ^ Math.imul(k + 77, 3266489917);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function seeded(x, y, k) {
    let n = 0;
    return () => hash(x, y, k * 131 + n++);
  }

  function roundedTile(ctx, x, y, w, h, r) {
    // r = [nw, ne, se, sw]
    ctx.beginPath();
    ctx.moveTo(x + r[0], y);
    ctx.lineTo(x + w - r[1], y);
    ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
    ctx.lineTo(x + w, y + h - r[2]);
    ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
    ctx.lineTo(x + r[3], y + h);
    ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
    ctx.lineTo(x, y + r[0]);
    ctx.arcTo(x, y, x + r[0], y, r[0]);
    ctx.closePath();
  }

  function terrainIds(game) {
    const ids = [];
    for (let y = 0; y < game.height; y++) {
      const row = [];
      for (let x = 0; x < game.width; x++) row.push(game.terrainAt(x, y).id);
      ids.push(row);
    }
    return ids;
  }
  function terrainGrid(ids) {
    const height = ids.length, width = ids[0].length;
    const at = (x, y) => ids[Math.max(0, Math.min(height - 1, y))][Math.max(0, Math.min(width - 1, x))];
    return {ids, at, width, height};
  }

  // Distance (in tiles) from land for every water tile, used for the depth colours.
  function waterDepth(grid) {
    const depth = grid.ids.map(row => row.map(id => (waterIds.has(id) ? Infinity : 0)));
    const queue = [];
    grid.ids.forEach((row, y) => row.forEach((id, x) => { if (!waterIds.has(id)) queue.push([x, y]); }));
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || ny >= grid.height || nx < 0 || nx >= grid.width) continue;
        if (depth[ny][nx] > depth[y][x] + 1) { depth[ny][nx] = depth[y][x] + 1; queue.push([nx, ny]); }
      }
    }
    return depth;
  }

  function paintWater(ctx, grid, T) {
    const depth = waterDepth(grid);
    const hasLand = depth.some(row => row.some(d => d === 0));
    const colorOf = (id, d) => {
      if (id === 'shoal') return [86, 206, 196];
      if (!waterIds.has(id)) return [100, 206, 196];
      const deep = [[64, 196, 196], [44, 156, 186], [34, 120, 168], [27, 92, 146], [22, 74, 126]];
      return deep[Math.min(deep.length - 1, hasLand ? d : 3)];
    };
    const tileColor = grid.ids.map((row, y) => row.map((id, x) => colorOf(id, depth[y][x])));
    const K = 8;
    const mid = makeCanvas(grid.width * K, grid.height * K);
    const m = mid.getContext('2d');
    const pixels = m.createImageData(mid.width, mid.height);
    const smooth = t => t * t * (3 - 2 * t);
    const sample = (x, y) => tileColor[Math.max(0, Math.min(grid.height - 1, y))][Math.max(0, Math.min(grid.width - 1, x))];
    for (let py = 0; py < mid.height; py++) {
      const fy = (py + .5) / K - .5, y0 = Math.floor(fy), ty = smooth(fy - y0);
      for (let px = 0; px < mid.width; px++) {
        const fx = (px + .5) / K - .5, x0 = Math.floor(fx), tx = smooth(fx - x0);
        const a = sample(x0, y0), b = sample(x0 + 1, y0), c = sample(x0, y0 + 1), d = sample(x0 + 1, y0 + 1);
        const at = (py * mid.width + px) * 4;
        for (let i = 0; i < 3; i++) {
          const top = a[i] + (b[i] - a[i]) * tx, bottom = c[i] + (d[i] - c[i]) * tx;
          pixels.data[at + i] = top + (bottom - top) * ty;
        }
        pixels.data[at + 3] = 255;
      }
    }
    m.putImageData(pixels, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, 0, 0, grid.width * T, grid.height * T);
    ctx.restore();
    // Wave crests and sparkles.
    grid.ids.forEach((row, y) => row.forEach((id, x) => {
      if (!waterIds.has(id)) return;
      const r = seeded(x, y, 3);
      const count = id === 'shoal' ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const cx = (x + .12 + r() * .76) * T, cy = (y + .15 + r() * .7) * T;
        const w = T * (.12 + r() * .14);
        ctx.strokeStyle = id === 'shoal' ? 'rgba(235,255,246,.55)' : 'rgba(190,236,255,.42)';
        ctx.lineWidth = Math.max(1, T * .028);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - w, cy);
        ctx.quadraticCurveTo(cx - w / 2, cy - w * .45, cx, cy);
        ctx.quadraticCurveTo(cx + w / 2, cy - w * .45, cx + w, cy);
        ctx.stroke();
      }
      if (id === 'shoal') {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = 'rgba(244,226,170,.38)';
          ctx.beginPath();
          ctx.ellipse((x + r()) * T, (y + r()) * T, T * (.05 + r() * .08), T * (.03 + r() * .04), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (r() < .2) {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        const sx = (x + .2 + r() * .6) * T, sy = (y + .2 + r() * .6) * T, sr = T * .025;
        ctx.fillRect(sx - sr * 2, sy - sr / 3, sr * 4, sr * .66);
        ctx.fillRect(sx - sr / 3, sy - sr * 2, sr * .66, sr * 4);
      }
    }));
  }

  function landCorners(grid, x, y, T, inset) {
    const water = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) return waterIds.has(grid.at(nx, ny));
      return waterIds.has(grid.ids[ny][nx]);
    };
    const n = water(0, -1), e = water(1, 0), s = water(0, 1), w = water(-1, 0);
    const R = T * .38;
    const radii = [n && w ? R : 0, n && e ? R : 0, s && e ? R : 0, s && w ? R : 0];
    const box = [x * T + (w ? inset : -1), y * T + (n ? inset : -1), T - (w ? inset : -1) - (e ? inset : -1), T - (n ? inset : -1) - (s ? inset : -1)];
    return {box, radii: radii.map(r => Math.max(0, r - inset * .5)), coast: n || e || s || w};
  }

  function paintLand(ctx, grid, T) {
    // Foam, sand and grass layers give every shoreline a rounded beach.
    const layers = [
      {inset: -T * .07, color: 'rgba(240,255,250,.5)', coastOnly: true},
      {inset: 0, color: '#e7d29a', coastOnly: true},
      {inset: T * .09, color: '#cdb878', coastOnly: true},
      {inset: T * .13, color: null},
    ];
    for (const layer of layers) {
      grid.ids.forEach((row, y) => row.forEach((id, x) => {
        if (waterIds.has(id)) return;
        const {box, radii, coast} = landCorners(grid, x, y, T, layer.inset);
        if (layer.coastOnly && !coast) return;
        if (layer.color) {
          ctx.fillStyle = layer.color;
        } else {
          ctx.fillStyle = '#88bb62';
        }
        roundedTile(ctx, box[0], box[1], box[2], box[3], radii);
        ctx.fill();
      }));
    }
    // Large soft colour patches break up the grass.
    grid.ids.forEach((row, y) => row.forEach((id, x) => {
      if (waterIds.has(id) || id === 'beach') return;
      const r = seeded(x, y, 2);
      const cx = (x + r()) * T, cy = (y + r()) * T, radius = T * (.5 + r() * .4);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, r() < .5 ? 'rgba(178,212,110,.4)' : 'rgba(70,134,66,.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    }));
  }

  function grassDetail(ctx, x, y, T) {
    const r = seeded(x, y, 4);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const gx = (x + .15 + r() * .7) * T, gy = (y + .18 + r() * .7) * T, h = T * (.05 + r() * .05);
      ctx.strokeStyle = r() < .5 ? 'rgba(62,116,52,.55)' : 'rgba(180,220,120,.6)';
      ctx.lineWidth = Math.max(1, T * .02);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - h * .35, gy - h);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + h * .3, gy - h * .9);
      ctx.stroke();
    }
    if (r() < .35) {
      const colors = ['#fff3b0', '#ffd0e0', '#ffffff', '#ffe27a'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[Math.floor(r() * colors.length)];
        ctx.beginPath();
        ctx.arc((x + .2 + r() * .6) * T, (y + .2 + r() * .6) * T, T * .022, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function linked(grid, x, y, set) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    return dirs.map(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) return false;
      return set.has(grid.ids[ny][nx]);
    });
  }

  // Draws a band from the tile centre towards every linked side, in several passes.
  function bands(ctx, cells, T, width, style) {
    ctx.fillStyle = style;
    for (const {x, y, links} of cells) {
      const cx = (x + .5) * T, cy = (y + .5) * T, h = width / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, h, 0, Math.PI * 2);
      ctx.fill();
      if (links[0]) ctx.fillRect(cx - h, y * T - 1, width, T / 2 + 1);
      if (links[2]) ctx.fillRect(cx - h, cy, width, T / 2 + 1);
      if (links[3]) ctx.fillRect(x * T - 1, cy - h, T / 2 + 1, width);
      if (links[1]) ctx.fillRect(cx, cy - h, T / 2 + 1, width);
    }
  }

  function paintRivers(ctx, grid, T) {
    const cells = [];
    grid.ids.forEach((row, y) => row.forEach((id, x) => {
      if (!riverIds.has(id)) return;
      const links = linked(grid, x, y, riverIds);
      // Rivers keep flowing off the map edge.
      if (y === 0) links[0] = true;
      if (y === grid.height - 1) links[2] = true;
      cells.push({x, y, links});
    }));
    if (!cells.length) return;
    bands(ctx, cells, T, T * 1.0, '#b7a36a');
    bands(ctx, cells, T, T * .86, '#7d6a42');
    bands(ctx, cells, T, T * .74, '#3c8fb0');
    bands(ctx, cells, T, T * .46, '#4fb2c9');
    for (const {x, y} of cells) {
      const r = seeded(x, y, 6);
      ctx.strokeStyle = 'rgba(220,248,255,.6)';
      ctx.lineWidth = Math.max(1, T * .025);
      for (let i = 0; i < 3; i++) {
        const cx = (x + .3 + r() * .4) * T, cy = (y + .2 + r() * .6) * T;
        ctx.beginPath();
        ctx.moveTo(cx - T * .08, cy);
        ctx.quadraticCurveTo(cx, cy - T * .05, cx + T * .08, cy);
        ctx.stroke();
      }
    }
  }

  function paintRoads(ctx, grid, T) {
    const cells = [];
    grid.ids.forEach((row, y) => row.forEach((id, x) => {
      if (!roadIds.has(id)) return;
      const links = linked(grid, x, y, roadIds);
      if (!links.some(Boolean)) links[1] = links[3] = true;
      // A road meeting the map edge runs on past it.
      if (x === 0 && links[1]) links[3] = true;
      if (x === grid.width - 1 && links[3]) links[1] = true;
      cells.push({x, y, links, bridge: id === 'bridge'});
    }));
    if (!cells.length) return;
    const ground = cells.filter(cell => !cell.bridge);
    bands(ctx, ground, T, T * .6, 'rgba(40,52,30,.28)');
    bands(ctx, ground, T, T * .52, '#8a7a5c');
    bands(ctx, ground, T, T * .44, '#c9b48a');
    bands(ctx, ground, T, T * .36, '#d8c49a');
    // Wheel ruts and centre dashes.
    ctx.fillStyle = 'rgba(150,126,86,.5)';
    for (const {x, y, links} of ground) {
      const cx = (x + .5) * T, cy = (y + .5) * T, o = T * .1, w = Math.max(1, T * .025);
      if (links[1] || links[3]) {
        ctx.fillRect(links[3] ? x * T : cx, cy - o - w / 2, links[1] && links[3] ? T : T / 2, w);
        ctx.fillRect(links[3] ? x * T : cx, cy + o - w / 2, links[1] && links[3] ? T : T / 2, w);
      }
      if (links[0] || links[2]) {
        ctx.fillRect(cx - o - w / 2, links[0] ? y * T : cy, w, links[0] && links[2] ? T : T / 2);
        ctx.fillRect(cx + o - w / 2, links[0] ? y * T : cy, w, links[0] && links[2] ? T : T / 2);
      }
    }
    for (const {x, y, links} of cells.filter(cell => cell.bridge)) {
      const horizontal = links[1] || links[3];
      ctx.save();
      ctx.translate((x + .5) * T, (y + .5) * T);
      if (!horizontal) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(20,30,40,.35)';
      ctx.fillRect(-T * .56, -T * .26, T * 1.12, T * .6);
      ctx.fillStyle = '#6b4a2c';
      ctx.fillRect(-T * .55, -T * .3, T * 1.1, T * .6);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#b98a55' : '#a87a48';
        ctx.fillRect(-T * .5 + i * T * .125, -T * .26, T * .115, T * .52);
      }
      ctx.fillStyle = '#4e321c';
      ctx.fillRect(-T * .55, -T * .34, T * 1.1, T * .07);
      ctx.fillRect(-T * .55, T * .27, T * 1.1, T * .07);
      ctx.restore();
    }
  }

  function paintMarsh(ctx, x, y, T) {
    const r = seeded(x, y, 7);
    const g = ctx.createRadialGradient((x + .5) * T, (y + .5) * T, T * .1, (x + .5) * T, (y + .5) * T, T * .75);
    g.addColorStop(0, 'rgba(96,110,64,.9)');
    g.addColorStop(1, 'rgba(96,110,64,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x * T - T * .2, y * T - T * .2, T * 1.4, T * 1.4);
    for (let i = 0; i < 4; i++) {
      const px = (x + .2 + r() * .6) * T, py = (y + .2 + r() * .6) * T, rx = T * (.1 + r() * .12), ry = rx * .5;
      ctx.fillStyle = '#4c5c3a';
      ctx.beginPath(); ctx.ellipse(px, py + ry * .25, rx * 1.1, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      const w = ctx.createLinearGradient(px, py - ry, px, py + ry);
      w.addColorStop(0, '#8fc6c0'); w.addColorStop(1, '#4d8f8e');
      ctx.fillStyle = w;
      ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const rx = (x + .1 + r() * .8) * T, ry = (y + .3 + r() * .65) * T, h = T * (.12 + r() * .12);
      ctx.strokeStyle = r() < .5 ? '#5e7a36' : '#90a64a';
      ctx.lineWidth = Math.max(1, T * .022);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + T * .02, ry - h * .6, rx + (r() - .5) * T * .08, ry - h); ctx.stroke();
      if (r() < .4) {
        ctx.fillStyle = '#7a5530';
        ctx.fillRect(rx - T * .012, ry - h - T * .05, T * .028, T * .07);
      }
    }
  }


  // Sand ground: wet sand and a wavy foam line on the water side, a ragged soft edge
  // that fades into the neighbouring grass.
  function paintBeach(ctx, grid, T) {
    const cells = [];
    grid.ids.forEach((row, y) => row.forEach((id, x) => { if (id === 'beach') cells.push([x, y]); }));
    if (!cells.length) return;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const kind = (x, y) => {
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return grid.at(x, y);
      return grid.ids[y][x];
    };
    // Soft sand spill into the grass around.
    for (const [x, y] of cells) {
      const r = seeded(x, y, 21);
      dirs.forEach(([dx, dy]) => {
        const n = kind(x + dx, y + dy);
        if (waterIds.has(n) || n === 'beach') return;
        for (let i = 0; i < 4; i++) {
          const t = (i + .5) / 4 + (r() - .5) * .12;
          const ex = dx ? (dx > 0 ? x + 1 : x) : x + t, ey = dy ? (dy > 0 ? y + 1 : y) : y + t;
          const rad = T * (.22 + r() * .14);
          const g = ctx.createRadialGradient(ex * T, ey * T, 0, ex * T, ey * T, rad);
          g.addColorStop(0, 'rgba(226,204,146,.95)');
          g.addColorStop(.55, 'rgba(214,194,134,.55)');
          g.addColorStop(1, 'rgba(200,190,120,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(ex * T, ey * T, rad, 0, Math.PI * 2); ctx.fill();
        }
      });
    }
    // Wet sand reaching the waterline, then dry sand.
    for (const [x, y] of cells) {
      const {box, radii} = landCorners(grid, x, y, T, 0);
      ctx.fillStyle = '#c7ad72';
      roundedTile(ctx, box[0], box[1], box[2], box[3], radii); ctx.fill();
      const dry = landCorners(grid, x, y, T, T * .08);
      ctx.fillStyle = '#ead6a2';
      roundedTile(ctx, dry.box[0], dry.box[1], dry.box[2], dry.box[3], dry.radii); ctx.fill();
    }
    // Soft light and dark drifts that ignore the tile grid.
    for (const [x, y] of cells) {
      const r = seeded(x, y, 26);
      ctx.save();
      const dry = landCorners(grid, x, y, T, T * .08);
      roundedTile(ctx, dry.box[0], dry.box[1], dry.box[2], dry.box[3], dry.radii); ctx.clip();
      for (let i = 0; i < 2; i++) {
        const cx = (x + .3 + r() * .4) * T, cy = (y + .3 + r() * .4) * T, rad = T * (.25 + r() * .15);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const tone = r() < .6 ? '255,246,214' : '196,166,110';
        g.addColorStop(0, `rgba(${tone},${tone[0] === '2' ? .45 : .2})`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g; ctx.fillRect(x * T - T, y * T - T, T * 3, T * 3);
      }
      ctx.restore();
    }
    for (const [x, y] of cells) {
      const r = seeded(x, y, 22);
      // Wind ripples, grains, pebbles and the odd shell.
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, T * .018);
      for (let i = 0; i < 4; i++) {
        const cx = (x + .2 + r() * .6) * T, cy = (y + .18 + r() * .64) * T, w = T * (.1 + r() * .1);
        ctx.strokeStyle = 'rgba(170,140,86,.45)';
        ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - T * .04, cx + w, cy); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,248,220,.55)';
        ctx.beginPath(); ctx.moveTo(cx - w, cy - T * .02); ctx.quadraticCurveTo(cx, cy - T * .06, cx + w, cy - T * .02); ctx.stroke();
      }
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = r() < .5 ? 'rgba(150,120,70,.45)' : 'rgba(255,250,230,.6)';
        ctx.fillRect((x + .08 + r() * .84) * T, (y + .08 + r() * .84) * T, Math.max(1, T * .016), Math.max(1, T * .016));
      }
      if (r() < .55) {
        const sx = (x + .25 + r() * .5) * T, sy = (y + .25 + r() * .5) * T;
        ctx.fillStyle = 'rgba(90,70,40,.3)';
        ctx.beginPath(); ctx.ellipse(sx + T * .01, sy + T * .012, T * .035, T * .02, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = r() < .5 ? '#fbeee0' : '#f3c9b4';
        ctx.beginPath(); ctx.ellipse(sx, sy, T * .03, T * .02, -.4, 0, Math.PI * 2); ctx.fill();
      }
      // Foam lapping on every water side.
      dirs.forEach(([dx, dy]) => {
        if (!waterIds.has(kind(x + dx, y + dy))) return;
        ctx.save();
        ctx.translate((x + .5) * T, (y + .5) * T);
        ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
        // Local frame: the water side is +y.
        ctx.strokeStyle = 'rgba(250,255,252,.8)';
        ctx.lineWidth = Math.max(1, T * .03);
        ctx.beginPath();
        const edge = T * .5 + T * .02;
        ctx.moveTo(-T * .5, edge);
        for (let i = 0; i < 4; i++) {
          const x0 = -T * .5 + i * T * .25;
          ctx.quadraticCurveTo(x0 + T * .125, edge + T * (.05 + r() * .04), x0 + T * .25, edge);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,96,58,.28)';
        ctx.lineWidth = Math.max(1, T * .02);
        ctx.beginPath(); ctx.moveTo(-T * .45, T * .42); ctx.quadraticCurveTo(0, T * .38 + r() * T * .04, T * .45, T * .42); ctx.stroke();
        ctx.restore();
      });
    }
  }

  // Low, grassy rolling knolls: green domes lit from the upper left.
  function hills(ctx, x, y, T) {
    const r = seeded(x, y, 23);
    const knolls = [
      {cx: .32 + r() * .08, by: .52, w: .36, h: .2 + r() * .05},
      {cx: .72 + r() * .06, by: .6, w: .3, h: .16 + r() * .05},
      {cx: .46 + r() * .08, by: .92, w: .46, h: .26 + r() * .05},
    ];
    for (const k of knolls) {
      const cx = (x + k.cx) * T, by = (y + k.by) * T, w = k.w * T, h = k.h * T;
      ctx.fillStyle = 'rgba(30,64,30,.3)';
      ctx.beginPath(); ctx.ellipse(cx + w * .18, by + T * .01, w * 1.05, h * .32, 0, 0, Math.PI * 2); ctx.fill();
      const dome = () => {
        ctx.beginPath();
        ctx.moveTo(cx - w, by);
        ctx.bezierCurveTo(cx - w * .7, by - h * 1.05, cx + w * .55, by - h * 1.15, cx + w, by);
        ctx.quadraticCurveTo(cx, by + h * .22, cx - w, by);
        ctx.closePath();
      };
      const g = ctx.createRadialGradient(cx - w * .35, by - h * .8, w * .05, cx, by - h * .3, w * 1.2);
      g.addColorStop(0, '#c4e08a'); g.addColorStop(.4, '#8cbf5c'); g.addColorStop(.8, '#5f9a44'); g.addColorStop(1, '#447a36');
      ctx.fillStyle = g; dome(); ctx.fill();
      // Shaded east flank.
      ctx.save(); dome(); ctx.clip();
      const sh = ctx.createLinearGradient(cx - w * .1, 0, cx + w, 0);
      sh.addColorStop(0, 'rgba(30,60,40,0)'); sh.addColorStop(1, 'rgba(30,60,40,.38)');
      ctx.fillStyle = sh; ctx.fillRect(cx - w, by - h * 1.2, w * 2, h * 1.5);
      // Contour strokes.
      ctx.strokeStyle = 'rgba(232,248,190,.35)';
      ctx.lineWidth = Math.max(1, T * .018);
      ctx.beginPath(); ctx.moveTo(cx - w * .65, by - h * .45); ctx.quadraticCurveTo(cx - w * .2, by - h * .9, cx + w * .25, by - h * .75); ctx.stroke();
      ctx.restore();
      // Grass texture follows the slope.
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const u = r() * 1.6 - .8, tx = cx + u * w, ty = by - h * (1 - u * u) * (.25 + r() * .6), th = T * .028;
        ctx.strokeStyle = u > .2 ? 'rgba(40,86,40,.4)' : 'rgba(214,240,160,.45)';
        ctx.lineWidth = Math.max(1, T * .012);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + th * .2, ty - th); ctx.stroke();
      }
    }
    // A small bush or boulder on some tiles.
    if (r() < .5) {
      const bx = (x + .12 + r() * .2) * T, by = (y + .86) * T, s = T * .07;
      ctx.fillStyle = 'rgba(30,50,30,.3)';
      ctx.beginPath(); ctx.ellipse(bx + s * .4, by, s * 1.2, s * .4, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(bx - s * .4, by - s * 1.1, s * .1, bx, by - s * .6, s * 1.3);
      g.addColorStop(0, '#9fcf62'); g.addColorStop(1, '#2f6a34');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx - s * .4, by - s * .5, s * .6, 0, Math.PI * 2); ctx.arc(bx + s * .35, by - s * .55, s * .62, 0, Math.PI * 2); ctx.arc(bx, by - s * 1, s * .66, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Ground of a ruined block: scorched dirt, scattered paving and rubble.
  function ruinsGround(ctx, x, y, T) {
    const r = seeded(x, y, 24);
    const g = ctx.createRadialGradient((x + .5) * T, (y + .55) * T, T * .08, (x + .5) * T, (y + .55) * T, T * .7);
    g.addColorStop(0, 'rgba(112,96,74,.95)'); g.addColorStop(.65, 'rgba(136,118,88,.8)'); g.addColorStop(1, 'rgba(140,122,92,0)');
    ctx.fillStyle = g; ctx.fillRect(x * T - T * .2, y * T - T * .2, T * 1.4, T * 1.4);
    const s = ctx.createRadialGradient((x + .62) * T, (y + .4) * T, 0, (x + .62) * T, (y + .4) * T, T * .22);
    s.addColorStop(0, 'rgba(40,34,30,.5)'); s.addColorStop(1, 'rgba(40,34,30,0)');
    ctx.fillStyle = s; ctx.fillRect(x * T, y * T, T, T);
    // Broken paving slabs.
    for (let i = 0; i < 5; i++) {
      const px = (x + .15 + r() * .7) * T, py = (y + .2 + r() * .7) * T, w = T * (.08 + r() * .06);
      ctx.save(); ctx.translate(px, py); ctx.rotate((r() - .5) * .8);
      ctx.fillStyle = 'rgba(60,50,40,.35)'; ctx.fillRect(-w / 2 + T * .01, -w * .3 + T * .01, w, w * .6);
      ctx.fillStyle = r() < .5 ? '#b5ab98' : '#a39780'; ctx.fillRect(-w / 2, -w * .3, w, w * .6);
      ctx.restore();
    }
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = ['#6e6356', '#c8bca4', '#8f8370', '#a0583e'][Math.floor(r() * 4)];
      const d = Math.max(1, T * (.015 + r() * .02));
      ctx.fillRect((x + .1 + r() * .8) * T, (y + .15 + r() * .8) * T, d, d);
    }
    // Weeds pushing through.
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const gx = (x + .1 + r() * .8) * T, gy = (y + .3 + r() * .65) * T, h = T * .06;
      ctx.strokeStyle = 'rgba(92,132,58,.75)'; ctx.lineWidth = Math.max(1, T * .018);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - h * .4, gy - h); ctx.moveTo(gx, gy); ctx.lineTo(gx + h * .35, gy - h * .9); ctx.stroke();
    }
  }

  // A broken masonry wall: lit front face, shaded end, ragged top and stone courses.
  function brokenWall(ctx, x0, by, w, h, depth, r, T) {
    const steps = 6, tops = [];
    for (let i = 0; i <= steps; i++) tops.push(h * (i === 0 || i === steps ? .35 + r() * .3 : .45 + r() * .55));
    ctx.fillStyle = 'rgba(30,26,22,.35)';
    ctx.beginPath(); ctx.ellipse(x0 + w * .55, by + T * .01, w * .62, T * .05, 0, 0, Math.PI * 2); ctx.fill();
    const front = () => {
      ctx.beginPath(); ctx.moveTo(x0, by);
      tops.forEach((t, i) => ctx.lineTo(x0 + w * i / steps, by - t));
      ctx.lineTo(x0 + w, by); ctx.closePath();
    };
    // Top/side thickness.
    ctx.fillStyle = '#8c8170';
    ctx.beginPath(); ctx.moveTo(x0 + w, by); ctx.lineTo(x0 + w, by - tops[steps]); ctx.lineTo(x0 + w + depth, by - tops[steps] - depth * .6); ctx.lineTo(x0 + w + depth, by - depth * .6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfc4ab';
    ctx.beginPath(); ctx.moveTo(x0, by - tops[0]);
    tops.forEach((t, i) => ctx.lineTo(x0 + w * i / steps, by - t));
    for (let i = steps; i >= 0; i--) ctx.lineTo(x0 + w * i / steps + depth, by - tops[i] - depth * .6);
    ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(x0, by - h, x0 + w, by);
    g.addColorStop(0, '#e2d6bb'); g.addColorStop(.6, '#bfb196'); g.addColorStop(1, '#9a8c74');
    ctx.fillStyle = g; front(); ctx.fill();
    ctx.save(); front(); ctx.clip();
    ctx.strokeStyle = 'rgba(80,68,54,.45)'; ctx.lineWidth = Math.max(1, T * .012);
    const course = Math.max(3, T * .06);
    for (let yy = by - course, row = 0; yy > by - h; yy -= course, row++) {
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy); ctx.stroke();
      for (let xx = x0 + (row % 2 ? course : course * 1.8); xx < x0 + w; xx += course * 1.8) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + course); ctx.stroke(); }
    }
    // Soot and an empty window.
    const soot = ctx.createLinearGradient(0, by - h, 0, by);
    soot.addColorStop(0, 'rgba(40,34,30,.45)'); soot.addColorStop(.5, 'rgba(40,34,30,0)');
    ctx.fillStyle = soot; ctx.fillRect(x0, by - h, w, h);
    if (h > T * .2) {
      ctx.fillStyle = '#3a332c';
      ctx.fillRect(x0 + w * .38, by - h * .62, w * .2, h * .26);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(50,42,34,.75)'; ctx.lineWidth = Math.max(1, T * .016); front(); ctx.stroke();
  }

  function rubblePile(ctx, cx, by, s, r) {
    ctx.fillStyle = 'rgba(30,26,22,.32)';
    ctx.beginPath(); ctx.ellipse(cx + s * .1, by, s * 1.1, s * .35, 0, 0, Math.PI * 2); ctx.fill();
    const colors = ['#b9ae98', '#9a8e78', '#d6cbb2', '#a45f42', '#7d7262'];
    for (let i = 0; i < 9; i++) {
      const px = cx + (r() - .5) * s * 1.6, py = by - s * (.08 + r() * .45) * (1 - Math.abs(px - cx) / (s * 1.2)), d = s * (.18 + r() * .22);
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.beginPath(); ctx.moveTo(px - d, py); ctx.lineTo(px - d * .3, py - d * .8); ctx.lineTo(px + d * .8, py - d * .5); ctx.lineTo(px + d, py + d * .2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,235,.3)';
      ctx.beginPath(); ctx.moveTo(px - d, py); ctx.lineTo(px - d * .3, py - d * .8); ctx.lineTo(px, py - d * .2); ctx.closePath(); ctx.fill();
    }
  }

  function ruins(ctx, x, y, T) {
    const r = seeded(x, y, 25);
    // L-shaped remains of a house at the back, a lone wall stub and rubble in front.
    brokenWall(ctx, (x + .14) * T, (y + .5) * T, T * .46, T * (.3 + r() * .08), T * .07, r, T);
    brokenWall(ctx, (x + .66) * T, (y + .62) * T, T * .2, T * (.18 + r() * .08), T * .06, r, T);
    // A charred beam leaning on the wall.
    ctx.strokeStyle = '#4a3626'; ctx.lineWidth = Math.max(2, T * .04); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo((x + .36) * T, (y + .58) * T); ctx.lineTo((x + .56) * T, (y + .3) * T); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,140,.25)'; ctx.lineWidth = Math.max(1, T * .012);
    ctx.beginPath(); ctx.moveTo((x + .35) * T, (y + .57) * T); ctx.lineTo((x + .55) * T, (y + .29) * T); ctx.stroke();
    rubblePile(ctx, (x + .32) * T, (y + .78) * T, T * .16, r);
    rubblePile(ctx, (x + .72) * T, (y + .86) * T, T * .13, r);
  }

  function tree(ctx, cx, by, s, r) {
    // Shadow, trunk, then a three-tier conifer or a round broadleaf canopy.
    ctx.fillStyle = 'rgba(24,52,30,.35)';
    ctx.beginPath(); ctx.ellipse(cx + s * .12, by, s * .42, s * .14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(cx - s * .06, by - s * .28, s * .12, s * .28);
    if (r() < .62) {
      const tiers = [[.9, .5], [.7, .4], [.5, .3]];
      tiers.forEach(([top, half], i) => {
        const yTop = by - s * (top + .25), yBase = by - s * (.18 + i * .2);
        const g = ctx.createLinearGradient(cx - s * half, 0, cx + s * half, 0);
        g.addColorStop(0, '#3f8a4a'); g.addColorStop(.45, '#2f7440'); g.addColorStop(1, '#1d5233');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(cx, yTop); ctx.lineTo(cx + s * half, yBase); ctx.lineTo(cx - s * half, yBase); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(170,220,130,.35)';
        ctx.beginPath(); ctx.moveTo(cx, yTop); ctx.lineTo(cx - s * half * .2, yBase - s * .04); ctx.lineTo(cx - s * half * .8, yBase - s * .02); ctx.closePath(); ctx.fill();
      });
    } else {
      const cy = by - s * .58, rad = s * .4;
      const g = ctx.createRadialGradient(cx - rad * .4, cy - rad * .45, rad * .1, cx, cy, rad * 1.1);
      g.addColorStop(0, '#9fd46a'); g.addColorStop(.5, '#4f9a45'); g.addColorStop(1, '#2a6236');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx - rad * .35, cy + rad * .15, rad * .62, 0, Math.PI * 2);
      ctx.arc(cx + rad * .35, cy + rad * .12, rad * .64, 0, Math.PI * 2);
      ctx.arc(cx, cy - rad * .3, rad * .7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function mountain(ctx, x, y, T) {
    const r = seeded(x, y, 9);
    const peaks = [
      {cx: .32 + r() * .06, h: .62 + r() * .1, w: .34},
      {cx: .66 + r() * .06, h: .74 + r() * .12, w: .38},
      {cx: .48 + r() * .04, h: .46 + r() * .08, w: .3},
    ];
    const base = (y + .9) * T;
    ctx.fillStyle = 'rgba(40,50,40,.32)';
    ctx.beginPath(); ctx.ellipse((x + .54) * T, base, T * .5, T * .12, 0, 0, Math.PI * 2); ctx.fill();
    for (const p of peaks) {
      const px = (x + p.cx) * T, top = base - p.h * T, half = p.w * T;
      const g = ctx.createLinearGradient(px - half, top, px + half, base);
      g.addColorStop(0, '#b9b2a4'); g.addColorStop(.5, '#8f8a80'); g.addColorStop(1, '#5d5a58');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + half, base); ctx.lineTo(px - half, base); ctx.closePath(); ctx.fill();
      // Shaded east face.
      ctx.fillStyle = 'rgba(40,38,52,.32)';
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + half, base); ctx.lineTo(px + half * .1, base); ctx.closePath(); ctx.fill();
      // Snow cap.
      const cap = .32;
      ctx.fillStyle = '#f6fbff';
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px + half * cap, top + p.h * T * cap);
      ctx.lineTo(px + half * cap * .3, top + p.h * T * cap * .78);
      ctx.lineTo(px - half * cap * .2, top + p.h * T * cap * .95);
      ctx.lineTo(px - half * cap, top + p.h * T * cap);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(150,180,210,.45)';
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + half * cap, top + p.h * T * cap); ctx.lineTo(px + half * cap * .3, top + p.h * T * cap * .78); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#6e8a52';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse((x + .15 + r() * .7) * T, base - T * .02, T * .08, T * .04, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // The terrain is painted in steps so the main-thread fallback can yield between them.
  function terrainSteps(ids, T) {
    const grid = terrainGrid(ids);
    const canvas = makeCanvas(grid.width * T, grid.height * T);
    const ctx = canvas.getContext('2d');
    const steps = [() => paintWater(ctx, grid, T), () => paintLand(ctx, grid, T), () => paintBeach(ctx, grid, T), () => grid.ids.forEach((row, y) => row.forEach((id, x) => {
      if (id === 'plains' || id === 'forest' || id === 'road' || id === 'hill') grassDetail(ctx, x, y, T);
      if (id === 'marsh') paintMarsh(ctx, x, y, T);
      if (id === 'ruins') ruinsGround(ctx, x, y, T);
    })), () => paintRivers(ctx, grid, T), () => paintRoads(ctx, grid, T), () => {
      // Tall scenery is drawn back to front so it can overlap the row above.
      const tall = [];
      grid.ids.forEach((row, y) => row.forEach((id, x) => {
        if (id === 'forest') {
          const r = seeded(x, y, 8);
          const spots = [[.25, .42], [.68, .38], [.47, .62], [.2, .86], [.75, .84], [.5, .98]];
          for (const [sx, sy] of spots) tall.push({y: y + sy * .9, draw: () => tree(ctx, (x + sx + (r() - .5) * .1) * T, (y + sy * .9) * T, T * (.46 + r() * .12), r)});
        }
        if (id === 'mountain') tall.push({y: y + .9, draw: () => mountain(ctx, x, y, T)});
        if (id === 'hill') tall.push({y: y + .9, draw: () => hills(ctx, x, y, T)});
        if (id === 'ruins') tall.push({y: y + .8, draw: () => ruins(ctx, x, y, T)});
      }));
      tall.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    }, () => {
      // A soft light from the upper left.
      const light = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      light.addColorStop(0, 'rgba(255,246,210,.10)');
      light.addColorStop(1, 'rgba(20,30,60,.10)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }];
    return {canvas, steps};
  }
  function paintTerrain(ids, T) {
    const {canvas, steps} = terrainSteps(ids, T);
    steps.forEach(step => step());
    return canvas;
  }

  // ---- Facility sprites -------------------------------------------------------------
  const palettes = {
    friendly: {roof: '#2f9fc0', roofDark: '#1d6d8c', roofLight: '#7fd8ee', flag: '#33c2d6', trim: '#e9fbff'},
    enemy: {roof: '#d75a3e', roofDark: '#9a3423', roofLight: '#ffa27f', flag: '#ef6a45', trim: '#fff0e4'},
    neutral: {roof: '#a59a86', roofDark: '#776d5d', roofLight: '#d7cfbd', flag: '#f3efe4', trim: '#fffaf0'},
  };
  const wall = {light: '#f2e6cc', mid: '#d9c8a4', dark: '#a8946e', line: '#3b3226'};

  function box(ctx, x, y, w, h, p, roofH = 0) {
    ctx.fillStyle = wall.mid; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = wall.light; ctx.fillRect(x, y, w * .55, h);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + w * .78, y, w * .22, h);
    ctx.strokeStyle = wall.line; ctx.lineWidth = 2.4; ctx.strokeRect(x, y, w, h);
    if (roofH) {
      ctx.fillStyle = p.roof;
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + w / 2, y - roofH); ctx.lineTo(x + w + 4, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = p.roofDark;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y - roofH); ctx.lineTo(x + w + 4, y); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = wall.line; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + w / 2, y - roofH); ctx.lineTo(x + w + 4, y); ctx.closePath(); ctx.stroke();
    }
  }
  function windows(ctx, x, y, cols, rows, gap, lit) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      ctx.fillStyle = (i + j) % 3 === 0 && lit ? '#ffe68a' : '#4d6878';
      ctx.fillRect(x + i * gap, y + j * gap, gap * .55, gap * .6);
    }
  }
  function flag(ctx, x, y, p, h = 40) {
    ctx.fillStyle = '#3b3226'; ctx.fillRect(x - 1.5, y - h, 3, h);
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y - h, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.flag;
    ctx.beginPath(); ctx.moveTo(x + 1, y - h + 2); ctx.quadraticCurveTo(x + 14, y - h - 3, x + 26, y - h + 4); ctx.lineTo(x + 24, y - h + 13); ctx.quadraticCurveTo(x + 13, y - h + 8, x + 1, y - h + 16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,30,.65)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function shadow(ctx, cx, cy, rx, ry) {
    ctx.fillStyle = 'rgba(20,34,26,.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  const facilityDrawers = {
    headquarters(ctx, p) {
      shadow(ctx, 66, 112, 52, 11);
      // Curtain wall with crenellations.
      box(ctx, 14, 72, 100, 38, p);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? wall.mid : wall.light; ctx.fillRect(14 + i * 14.3, 64, 9, 9); ctx.strokeStyle = wall.line; ctx.lineWidth = 2; ctx.strokeRect(14 + i * 14.3, 64, 9, 9); }
      // Keep.
      box(ctx, 40, 36, 48, 50, p, 26);
      ctx.fillStyle = '#5a3e2a'; ctx.beginPath(); ctx.moveTo(54, 110); ctx.lineTo(54, 94); ctx.arc(64, 94, 10, Math.PI, 0); ctx.lineTo(74, 110); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2d2016'; ctx.lineWidth = 2; ctx.stroke();
      windows(ctx, 47, 46, 3, 2, 13, true);
      // Gold star emblem.
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4 : 9; ctx.lineTo(64 + Math.cos(a) * rr, 20 + 8 + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Side towers.
      box(ctx, 8, 58, 18, 52, p, 16);
      box(ctx, 102, 58, 18, 52, p, 16);
      flag(ctx, 17, 42, p, 22);
      flag(ctx, 111, 42, p, 22);
    },
    city(ctx, p) {
      shadow(ctx, 64, 112, 50, 10);
      box(ctx, 16, 58, 30, 52, p, 18); windows(ctx, 21, 64, 3, 4, 9, true);
      box(ctx, 76, 66, 34, 44, p, 16); windows(ctx, 81, 72, 3, 3, 10, true);
      box(ctx, 44, 34, 36, 76, p, 0);
      ctx.fillStyle = p.roof; ctx.fillRect(42, 28, 40, 8); ctx.strokeStyle = wall.line; ctx.lineWidth = 2.4; ctx.strokeRect(42, 28, 40, 8);
      windows(ctx, 49, 42, 3, 6, 10, true);
      ctx.fillStyle = '#5a3e2a'; ctx.fillRect(56, 96, 12, 14);
      flag(ctx, 62, 28, p, 22);
    },
    factory(ctx, p) {
      shadow(ctx, 64, 112, 54, 10);
      // Smoke.
      ctx.fillStyle = 'rgba(235,238,240,.85)';
      for (const [x, y, r] of [[96, 18, 9], [104, 10, 7], [88, 12, 6], [32, 24, 7], [38, 16, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      // Chimneys.
      for (const x of [26, 90]) { ctx.fillStyle = '#9b6b55'; ctx.fillRect(x, 26, 12, 50); ctx.fillStyle = p.roof; ctx.fillRect(x, 34, 12, 6); ctx.strokeStyle = wall.line; ctx.lineWidth = 2.4; ctx.strokeRect(x, 26, 12, 50); }
      box(ctx, 12, 64, 104, 46, p);
      // Sawtooth roof.
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 26;
        ctx.fillStyle = p.roof; ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 26, 48); ctx.lineTo(x + 26, 64); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#bfe8f4'; ctx.fillRect(x + 22, 50, 4, 14);
        ctx.strokeStyle = wall.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 26, 48); ctx.lineTo(x + 26, 64); ctx.stroke();
      }
      ctx.fillStyle = p.roof; ctx.fillRect(12, 80, 104, 6);
      ctx.fillStyle = '#4d5a63'; ctx.fillRect(48, 90, 32, 20);
      ctx.strokeStyle = '#2a3238'; ctx.lineWidth = 1.5; for (let y = 94; y < 110; y += 4) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(80, y); ctx.stroke(); }
      // Gear emblem.
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(28, 96, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5410'; ctx.beginPath(); ctx.arc(28, 96, 2.6, 0, Math.PI * 2); ctx.fill();
    },
    airfield(ctx, p) {
      shadow(ctx, 64, 112, 56, 10);
      // Runway.
      ctx.save(); ctx.translate(64, 88); ctx.rotate(-.18);
      ctx.fillStyle = '#4a5157'; ctx.fillRect(-60, -14, 120, 28);
      ctx.fillStyle = '#f5f1df'; for (let i = -52; i < 52; i += 16) ctx.fillRect(i, -1.5, 9, 3);
      ctx.fillStyle = p.roofLight; ctx.fillRect(-60, -14, 120, 3); ctx.fillRect(-60, 11, 120, 3);
      ctx.restore();
      // Hangar.
      ctx.fillStyle = p.roof; ctx.beginPath(); ctx.moveTo(10, 70); ctx.quadraticCurveTo(34, 36, 58, 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = wall.line; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = '#2f3b44'; ctx.beginPath(); ctx.moveTo(22, 70); ctx.quadraticCurveTo(34, 52, 46, 70); ctx.closePath(); ctx.fill();
      // Control tower.
      ctx.fillStyle = wall.mid; ctx.fillRect(86, 30, 12, 44); ctx.strokeStyle = wall.line; ctx.strokeRect(86, 30, 12, 44);
      ctx.fillStyle = '#9ee6f2'; ctx.fillRect(80, 20, 24, 12); ctx.strokeRect(80, 20, 24, 12);
      ctx.fillStyle = p.roof; ctx.fillRect(78, 14, 28, 7); ctx.strokeRect(78, 14, 28, 7);
      // Windsock.
      ctx.fillStyle = '#3b3226'; ctx.fillRect(112, 40, 2.5, 30);
      ctx.fillStyle = p.flag; ctx.beginPath(); ctx.moveTo(114, 41); ctx.lineTo(126, 44); ctx.lineTo(126, 48); ctx.lineTo(114, 50); ctx.closePath(); ctx.fill();
    },
    port(ctx, p) {
      shadow(ctx, 64, 112, 54, 10);
      // Pier with planks over a patch of water.
      const water = ctx.createLinearGradient(0, 74, 0, 120);
      water.addColorStop(0, '#3f9fbe'); water.addColorStop(1, '#2a7aa4');
      ctx.fillStyle = water; ctx.beginPath(); ctx.ellipse(70, 100, 54, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5f36'; ctx.fillRect(20, 84, 96, 14);
      for (let x = 22; x < 114; x += 8) { ctx.fillStyle = x % 16 ? '#b9874f' : '#a77843'; ctx.fillRect(x, 85, 7, 12); }
      ctx.fillStyle = '#4e321c'; for (const x of [26, 56, 86, 110]) ctx.fillRect(x, 98, 4, 12);
      // Warehouse.
      box(ctx, 12, 52, 40, 32, p, 14);
      ctx.fillStyle = '#4d5a63'; ctx.fillRect(24, 66, 16, 18);
      // Crane.
      ctx.strokeStyle = p.roofDark; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(84, 84); ctx.lineTo(84, 22); ctx.lineTo(118, 30); ctx.stroke();
      ctx.strokeStyle = p.roof; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(84, 22); ctx.lineTo(62, 28); ctx.moveTo(84, 40); ctx.lineTo(112, 30); ctx.stroke();
      ctx.strokeStyle = '#3b3226'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(114, 30); ctx.lineTo(114, 56); ctx.stroke();
      ctx.fillStyle = '#e0a83a'; ctx.fillRect(107, 56, 14, 10);
      ctx.fillStyle = '#2f3b44'; ctx.fillRect(76, 78, 18, 8);
      // Anchor badge.
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(32, 26); ctx.lineTo(32, 44); ctx.moveTo(25, 31); ctx.lineTo(39, 31); ctx.moveTo(24, 39); ctx.quadraticCurveTo(32, 50, 40, 39); ctx.stroke();
      flag(ctx, 52, 52, p, 20);
    },
    oilfield(ctx, p) {
      shadow(ctx, 64, 112, 56, 10);
      // Concrete pad with an owner-coloured hazard edge.
      ctx.fillStyle = '#9a9a92'; ctx.beginPath(); ctx.ellipse(64, 102, 56, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bdbcb2'; ctx.beginPath(); ctx.ellipse(62, 100, 52, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.roof; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(64, 102, 55, 15, 0, .15, Math.PI - .15); ctx.stroke();
      ctx.fillStyle = 'rgba(30,26,22,.45)'; ctx.beginPath(); ctx.ellipse(46, 104, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      // Storage tank (cylinder).
      const tx = 82, tw = 34, top = 52, bottom = 98;
      ctx.fillStyle = 'rgba(20,34,26,.3)'; ctx.beginPath(); ctx.ellipse(tx + tw / 2 + 4, bottom + 2, tw / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      body.addColorStop(0, '#d8dcd8'); body.addColorStop(.35, '#f4f6f2'); body.addColorStop(1, '#8e958f');
      ctx.fillStyle = body; ctx.fillRect(tx, top, tw, bottom - top);
      ctx.beginPath(); ctx.ellipse(tx + tw / 2, bottom, tw / 2, 5, 0, 0, Math.PI); ctx.fill();
      const band = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      band.addColorStop(0, p.roof); band.addColorStop(.4, p.roofLight); band.addColorStop(1, p.roofDark);
      ctx.fillStyle = band; ctx.fillRect(tx, 70, tw, 9);
      ctx.fillStyle = '#c9cec9'; ctx.beginPath(); ctx.ellipse(tx + tw / 2, top, tw / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = wall.line; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx, bottom); ctx.ellipse(tx + tw / 2, bottom, tw / 2, 5, 0, Math.PI, 0, true); ctx.lineTo(tx + tw, top); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tx + tw / 2, top, tw / 2, 5, 0, 0, Math.PI * 2); ctx.stroke();
      // Ladder.
      ctx.strokeStyle = '#5d6460'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tx + 6, top + 4); ctx.lineTo(tx + 6, bottom); ctx.moveTo(tx + 10, top + 4); ctx.lineTo(tx + 10, bottom); ctx.stroke();
      for (let yy = top + 8; yy < bottom; yy += 5) { ctx.beginPath(); ctx.moveTo(tx + 6, yy); ctx.lineTo(tx + 10, yy); ctx.stroke(); }
      // Pipe to the well head.
      ctx.strokeStyle = '#59605c'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(36, 100); ctx.lineTo(60, 100); ctx.lineTo(82, 94); ctx.stroke();
      // Pumpjack: base skid, A-frame samson post, walking beam, horsehead, crank and counterweight.
      ctx.fillStyle = '#4a4f4c'; ctx.fillRect(18, 96, 58, 6);
      ctx.strokeStyle = wall.line; ctx.lineWidth = 2; ctx.strokeRect(18, 96, 58, 6);
      ctx.strokeStyle = '#3c3f3d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(34, 96); ctx.lineTo(44, 50); ctx.lineTo(54, 96); ctx.stroke();
      ctx.strokeStyle = '#6b716d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(37, 82); ctx.lineTo(51, 82); ctx.stroke();
      // Crank with counterweight.
      ctx.fillStyle = '#5b605c'; ctx.beginPath(); ctx.arc(66, 82, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.roofDark; ctx.strokeStyle = wall.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(66, 82); ctx.arc(66, 82, 14, Math.PI * .55, Math.PI * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3c3f3d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 88); ctx.lineTo(64, 56); ctx.stroke();
      // Walking beam in the owner's colour.
      ctx.save(); ctx.translate(44, 50); ctx.rotate(-.12);
      const beam = ctx.createLinearGradient(0, -5, 0, 5);
      beam.addColorStop(0, p.roofLight); beam.addColorStop(.5, p.roof); beam.addColorStop(1, p.roofDark);
      ctx.fillStyle = beam; ctx.fillRect(-26, -4, 50, 8);
      ctx.strokeStyle = wall.line; ctx.lineWidth = 2; ctx.strokeRect(-26, -4, 50, 8);
      // Horsehead.
      ctx.fillStyle = p.roofDark;
      ctx.beginPath(); ctx.moveTo(-26, -6); ctx.quadraticCurveTo(-38, -4, -36, 10); ctx.lineTo(-30, 12); ctx.quadraticCurveTo(-30, 2, -26, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(44, 50, 3, 0, Math.PI * 2); ctx.fill();
      // Polished rod and well head.
      ctx.strokeStyle = '#d9ddd9'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, 60); ctx.lineTo(10, 94); ctx.stroke();
      ctx.fillStyle = '#5b605c'; ctx.fillRect(5, 92, 10, 10); ctx.strokeStyle = wall.line; ctx.strokeRect(5, 92, 10, 10);
      // Oil drop badge on the tank.
      ctx.fillStyle = '#2b2320'; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(99, 82); ctx.quadraticCurveTo(105, 90, 99, 95); ctx.quadraticCurveTo(93, 90, 99, 82); ctx.fill(); ctx.stroke();
      flag(ctx, 112, 52, p, 26);
    },
    depot(ctx, p) {
      shadow(ctx, 64, 112, 56, 10);
      // Gravel yard.
      ctx.fillStyle = '#b4a888'; ctx.beginPath(); ctx.ellipse(64, 100, 56, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,108,84,.5)'; for (let i = 0; i < 26; i++) ctx.fillRect(14 + (i * 37) % 100, 92 + (i * 13) % 16, 2, 2);
      // Supply shed with a curved owner-coloured roof.
      ctx.fillStyle = 'rgba(20,34,26,.3)'; ctx.fillRect(18, 96, 60, 6);
      box(ctx, 16, 62, 58, 36, p);
      ctx.fillStyle = '#4d5a63'; ctx.fillRect(30, 72, 24, 26);
      ctx.strokeStyle = '#2a3238'; ctx.lineWidth = 1.3; for (let y = 76; y < 98; y += 4) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(54, y); ctx.stroke(); }
      const roof = ctx.createLinearGradient(0, 40, 0, 64);
      roof.addColorStop(0, p.roofLight); roof.addColorStop(.5, p.roof); roof.addColorStop(1, p.roofDark);
      ctx.fillStyle = roof;
      ctx.beginPath(); ctx.moveTo(10, 64); ctx.quadraticCurveTo(45, 32, 80, 64); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = wall.line; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5;
      for (const x of [24, 36, 48, 60]) { ctx.beginPath(); ctx.moveTo(x, 63); ctx.quadraticCurveTo(x + 2, 52, x + (x < 45 ? 4 : -2), 47); ctx.stroke(); }
      // Wrench badge on the gable.
      ctx.save(); ctx.translate(62, 84); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = wall.line; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#6a737a'; ctx.fillRect(-1.6, -3, 3.2, 9);
      ctx.beginPath(); ctx.arc(0, -4, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d6'; ctx.fillRect(-1.2, -8.5, 2.4, 4);
      ctx.restore();
      // Stacked crates.
      const crate = (x, y, s) => {
        ctx.fillStyle = '#c08a4c'; ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#e0ad6a'; ctx.fillRect(x, y, s, s * .25);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + s * .75, y, s * .25, s);
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1.8; ctx.strokeRect(x, y, s, s);
        ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s * .25); ctx.stroke();
      };
      crate(78, 86, 16); crate(94, 86, 16); crate(86, 70, 16);
      // Fuel drums with owner stripes.
      const drum = (x, y) => {
        const g = ctx.createLinearGradient(x, 0, x + 11, 0);
        g.addColorStop(0, '#5f6b52'); g.addColorStop(.35, '#8c9a76'); g.addColorStop(1, '#3d4636');
        ctx.fillStyle = g; ctx.fillRect(x, y, 11, 16);
        ctx.fillStyle = p.roof; ctx.fillRect(x, y + 4, 11, 3); ctx.fillRect(x, y + 10, 11, 2);
        ctx.fillStyle = '#9fae88'; ctx.beginPath(); ctx.ellipse(x + 5.5, y, 5.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = wall.line; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, 11, 16);
      };
      drum(108, 88); drum(114, 92); drum(102, 94);
      // Fuel pump.
      ctx.fillStyle = p.roofDark; ctx.fillRect(4, 80, 10, 20); ctx.strokeStyle = wall.line; ctx.lineWidth = 1.8; ctx.strokeRect(4, 80, 10, 20);
      ctx.fillStyle = '#e9f4f0'; ctx.fillRect(6, 83, 6, 5);
      flag(ctx, 96, 70, p, 30);
    },
  };

  function facilityCanvas(kind, owner) {
    const canvas = makeCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    // Unknown kinds or owners fall back to a neutral city rather than failing the sheet.
    (facilityDrawers[kind] || facilityDrawers.city)(ctx, palettes[owner] || palettes.neutral);
    return canvas;
  }
  function facilityList() {
    const list = [];
    for (const kind of Object.keys(facilityDrawers)) {
      for (const owner of ['friendly', 'enemy', 'neutral']) {
        if (kind !== 'headquarters' || owner !== 'neutral') list.push([kind, owner]);
      }
    }
    return list;
  }

  if (inWorker) {
    self.MapArt = {paintTerrain, facilityCanvas, facilityList};
    return;
  }

  function facilityImage(kind, owner) {
    return facilityCanvas(kind, owner).toDataURL('image/png');
  }

  // ---- Painting off the main thread ----------------------------------------------------
  // public/map-worker.js paints the terrain and facility sprites with OffscreenCanvas.
  // Browsers without it (older Safari) or a failing worker fall back to painting here,
  // after the first frame and in small steps so the page stays responsive.
  let worker = null, workerBroken = !('Worker' in window && 'OffscreenCanvas' in window);
  const waiting = new Map();
  let nextRequest = 1;
  function failWorker() {
    workerBroken = true;
    worker?.terminate();
    worker = null;
    const pending = [...waiting.values()];
    waiting.clear();
    pending.forEach(request => request.fallback());
  }
  function askWorker(message, done, fallback) {
    if (!workerBroken && !worker) {
      try {
        worker = new Worker('./map-worker.js?v=more-content');
        worker.onmessage = event => {
          const request = waiting.get(event.data?.id);
          if (!request) return;
          waiting.delete(event.data.id);
          if (event.data.ok) request.done(event.data);
          else failWorker(), request.fallback();
        };
        worker.onerror = event => { event.preventDefault?.(); failWorker(); };
      } catch {
        workerBroken = true;
      }
    }
    if (workerBroken) { fallback(); return; }
    const id = nextRequest++;
    waiting.set(id, {done, fallback});
    worker.postMessage({...message, id});
  }
  const afterFrame = fn => requestAnimationFrame(() => setTimeout(fn, 0));
  function runSteps(steps, done) {
    let i = 0;
    const next = () => {
      const started = performance.now();
      try {
        while (i < steps.length && performance.now() - started < 30) steps[i++]();
      } catch (error) { done(error); return; }
      if (i < steps.length) setTimeout(next, 0); else done();
    };
    afterFrame(next);
  }

  let facilitiesState = 'idle';
  function applyFacilities(urls) {
    const root = document.documentElement;
    for (const [key, url] of urls) root.style.setProperty(`--art-${key}`, `url("${url}")`);
    root.classList.add('map-art');
    root.classList.remove('map-art-pending');
    facilitiesState = 'ready';
  }
  function installFacilities() {
    if (facilitiesState !== 'idle') return;
    facilitiesState = 'loading';
    // Hide the old pixel sprites on the board until the painted ones arrive.
    document.documentElement.classList.add('map-art-pending');
    const onMain = () => {
      const list = facilityList();
      const urls = [];
      runSteps(list.map(([kind, owner]) => () => urls.push([`${kind}-${owner}`, facilityImage(kind, owner)])), error => {
        if (error) {
          facilitiesState = 'failed';
          document.documentElement.classList.remove('map-art-pending');
          console.warn('map art unavailable', error);
        }
        else applyFacilities(urls);
      });
    };
    askWorker({type: 'facilities'}, data => applyFacilities(data.sprites.map(([key, blob]) => [key, URL.createObjectURL(blob)])), onMain);
  }

  // ---- Board integration -------------------------------------------------------------
  let observer, paintToken = 0;
  function showTerrain(board, canvas, source) {
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    source.close?.();
    canvas.classList.add('painted');
  }

  // A few short highlights that fade in and out on open water (CSS animates them).
  function placeGlints(board, canvas, ids) {
    let layer = board.querySelector(':scope > .water-glints');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'water-glints';
      layer.setAttribute('aria-hidden', 'true');
    }
    canvas.after(layer);
    const height = ids.length, width = ids[0].length;
    const open = [];
    ids.forEach((row, y) => row.forEach((id, x) => {
      if (id === 'sea' || id === 'shoal') open.push([x, y]);
    }));
    const glints = [];
    const count = Math.min(28, Math.round(open.length / 9));
    for (let i = 0; i < count; i++) {
      const [x, y] = open[Math.floor(hash(i, open.length, 41) * open.length)];
      const glint = document.createElement('i');
      glint.style.cssText = `--gx:${((x + .15 + hash(x, y, 42) * .5) / width * 100).toFixed(2)}%;`
        + `--gy:${((y + .2 + hash(x, y, 43) * .6) / height * 100).toFixed(2)}%;`
        + `--gt:${(4 + hash(x, y, 44) * 3).toFixed(2)}s;--gd:${(-hash(x, y, 45) * 7).toFixed(2)}s`;
      glints.push(glint);
    }
    layer.replaceChildren(...glints);
  }
  function paintBoard(board, game) {
    try {
      installFacilities();
      let canvas = board.querySelector(':scope > canvas.terrain-art');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'terrain-art';
        canvas.setAttribute('aria-hidden', 'true');
      }
      board.prepend(canvas);
      const ids = terrainIds(game);
      const mapKey = `${game.scenario?.id ?? 'legacy'}:${game.scenario?.map?.seed ?? 'fixed'}:${game.width}x${game.height}`;
      const draw = () => {
        const cssTile = board.clientWidth / game.width || 48;
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        // Keep the canvas within the size limits of mobile browsers.
        const T = Math.max(24, Math.min(128, Math.round(cssTile * scale / 8) * 8, Math.floor(4096 / game.width), Math.floor(4096 / game.height)));
        if (canvas.dataset.tile === String(T) && canvas.dataset.map === mapKey) return;
        canvas.dataset.tile = String(T);
        canvas.dataset.map = mapKey;
        const token = ++paintToken;
        const fail = error => {
          if (token !== paintToken) return;
          board.classList.remove('art-ready');
          delete canvas.dataset.tile;
          console.warn('map art unavailable', error);
        };
        const onMain = () => {
          let job;
          try { job = terrainSteps(ids, T); } catch (error) { fail(error); return; }
          runSteps(job.steps, error => {
            if (token !== paintToken) return;
            if (error) fail(error); else showTerrain(board, canvas, job.canvas);
          });
        };
        askWorker({type: 'terrain', ids, T}, data => {
          if (token === paintToken) showTerrain(board, canvas, data.bitmap);
          else data.bitmap.close?.();
        }, onMain);
      };
      if (board.dataset.artMap !== mapKey) canvas.classList.remove('painted');
      placeGlints(board, canvas, ids);
      board.dataset.artMap = mapKey;
      board.classList.add('art-ready');
      delete canvas.dataset.tile;
      observer?.disconnect();
      if ('ResizeObserver' in window) {
        // The first callback arrives right after the browser lays the board out, so the
        // size is read without forcing an extra layout of the freshly built tiles.
        let pending, first = true;
        observer = new ResizeObserver(() => {
          clearTimeout(pending);
          if (first) { first = false; draw(); } else pending = setTimeout(draw, 200);
        });
        observer.observe(board);
      } else {
        draw();
      }
    } catch (error) {
      board.classList.remove('art-ready');
      console.warn('map art unavailable', error);
    }
  }

  window.MapArt = {paintBoard, facilityImage};
})();
