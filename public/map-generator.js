// Generates a new random battlefield for every new match. The west half is generated
// and mirrored onto the east half, so both armies always get the same terrain, the same
// facilities and the same distances. A layout is accepted only when every route the
// game needs exists (see validateGeneratedMap); otherwise the next seed is tried.
(() => {
  const width = 40;
  const height = 26;
  const half = width / 2;
  const version = 4;

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth value noise on a coarse lattice, sampled per tile.
  function noiseField(random, cell) {
    const cols = Math.ceil(half / cell) + 2;
    const rows = Math.ceil(height / cell) + 2;
    const lattice = Array.from({length: rows}, () => Array.from({length: cols}, random));
    const smooth = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = smooth(gx - x0), ty = smooth(gy - y0);
      const a = lattice[y0][x0] + (lattice[y0][x0 + 1] - lattice[y0][x0]) * tx;
      const b = lattice[y0 + 1][x0] + (lattice[y0 + 1][x0 + 1] - lattice[y0 + 1][x0]) * tx;
      return a + (b - a) * ty;
    };
  }

  const steps = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < half && y < height;
  const isWater = id => id === 'o' || id === 'h';

  function landMask(random) {
    const noise = noiseField(random, 3.2);
    const mask = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < half; x++) {
        // Land grows toward the centre line, where the two halves meet.
        const toSeam = (half - 1 - x) / (half - 1);
        const vertical = Math.abs(y - (height - 1) / 2) / (height / 2);
        const value = noise(x, y) * .55 + (1 - toSeam) * .55 - vertical * vertical * .3;
        row.push(x >= 1 && y >= 1 && y < height - 2 && value > .34);
      }
      mask.push(row);
    }
    // Keep one landmass: the part that reaches the centre line.
    const keep = new Set();
    const queue = [];
    for (let y = 0; y < height; y++) if (mask[y][half - 1]) { keep.add(`${half - 1},${y}`); queue.push([half - 1, y]); }
    for (const [x, y] of queue) {
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (inside(nx, ny) && mask[ny][nx] && !keep.has(key)) { keep.add(key); queue.push([nx, ny]); }
      }
    }
    return mask.map((row, y) => row.map((_, x) => keep.has(`${x},${y}`)));
  }

  // Inland ponds look odd and no ship can reach them, so water cut off from the open sea
  // (the left, top and bottom edges; the centre line is mirrored land/sea) becomes land.
  function fillLakes(mask) {
    const open = new Set();
    const queue = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < half; x++) {
        if (!mask[y][x] && (x === 0 || y === 0 || y === height - 1)) { open.add(`${x},${y}`); queue.push([x, y]); }
      }
    }
    for (const [x, y] of queue) {
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (inside(nx, ny) && !mask[ny][nx] && !open.has(key)) { open.add(key); queue.push([nx, ny]); }
      }
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < half; x++) if (!mask[y][x] && !open.has(`${x},${y}`)) mask[y][x] = true;
  }

  function shortestPath(grid, from, to, passable) {
    const key = ({x, y}) => `${x},${y}`;
    const previous = new Map([[key(from), null]]);
    const queue = [from];
    for (const at of queue) {
      if (at.x === to.x && at.y === to.y) break;
      for (const [dx, dy] of steps) {
        const next = {x: at.x + dx, y: at.y + dy};
        if (!inside(next.x, next.y) || previous.has(key(next)) || !passable(grid[next.y][next.x], next)) continue;
        previous.set(key(next), at);
        queue.push(next);
      }
    }
    if (!previous.has(key(to))) return null;
    const path = [];
    for (let at = to; at; at = previous.get(key(at))) path.push(at);
    return path.reverse();
  }

  function attempt(seed) {
    const random = rng(seed);
    const pick = list => list[Math.floor(random() * list.length)];
    const mask = landMask(random);
    fillLakes(mask);
    const grid = mask.map(row => row.map(land => (land ? 'p' : 'o')));
    const landCount = mask.flat().filter(Boolean).length;
    if (landCount < 240 || landCount > 390) return null;
    // Shallows along the coast.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < half; x++) {
        if (grid[y][x] !== 'o') continue;
        if (steps.some(([dx, dy]) => inside(x + dx, y + dy) && grid[y + dy][x + dx] === 'p') && random() < .5) grid[y][x] = 'h';
      }
    }
    // Reefs out in the open sea, away from every shore, so ports and beaches stay reachable.
    const reefNoise = noiseField(random, 2);
    const openSea = [];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < half; x++) {
      if (grid[y][x] !== 'o') continue;
      const nearLand = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], ...steps]
        .some(([dx, dy]) => inside(x + dx, y + dy) && grid[y + dy][x + dx] !== 'o' && grid[y + dy][x + dx] !== 'e');
      if (!nearLand && reefNoise(x, y) > .6) openSea.push({x, y, score: reefNoise(x, y)});
    }
    openSea.sort((a, b) => b.score - a.score).slice(0, Math.round(openSea.length / 3)).forEach(({x, y}) => { grid[y][x] = 'e'; });
    const coast = (x, y) => steps.some(([dx, dy]) => inside(x + dx, y + dy) && isWater(grid[y + dy][x + dx]));
    const landTiles = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < half; x++) if (grid[y][x] === 'p') landTiles.push({x, y});

    // Headquarters on the home side, away from the shore.
    const homeCandidates = landTiles.filter(({x, y}) => x >= 2 && x <= 7 && y >= 6 && y <= height - 8 && !coast(x, y));
    if (!homeCandidates.length) return null;
    const hq = pick(homeCandidates);
    const taken = new Set([`${hq.x},${hq.y}`]);
    const sites = [];
    const place = (kind, owner, filter) => {
      const options = landTiles.filter(spot => !taken.has(`${spot.x},${spot.y}`) && filter(spot)
        && [...taken].every(other => { const [ox, oy] = other.split(',').map(Number); return Math.abs(ox - spot.x) + Math.abs(oy - spot.y) >= 2; }));
      if (!options.length) return false;
      const spot = pick(options);
      taken.add(`${spot.x},${spot.y}`);
      sites.push({kind, x: spot.x, y: spot.y, owner});
      return true;
    };
    const near = (from, min, max) => spot => {
      const distance = Math.abs(spot.x - from.x) + Math.abs(spot.y - from.y);
      return distance >= min && distance <= max;
    };
    const ok = place('factory', 'friendly', near(hq, 2, 3))
      && place('city', 'friendly', near(hq, 2, 3))
      && place('city', 'friendly', spot => near(hq, 3, 7)(spot) && spot.x <= 12)
      && place('airfield', 'friendly', spot => near(hq, 2, 7)(spot) && spot.x <= 12)
      && (place('port', 'friendly', spot => coast(spot.x, spot.y) && spot.x >= 5 && spot.x <= 13 && (spot.y <= 6 || spot.y >= height - 7))
        || place('port', 'friendly', spot => coast(spot.x, spot.y) && spot.x <= 12))
      && place('city', 'neutral', spot => spot.x >= 12 && spot.x <= 17)
      && place('factory', 'neutral', spot => spot.x >= 12 && spot.x <= 17)
      // An oil field in contested ground: high income, but no production or repairs.
      && place('oilfield', 'neutral', spot => spot.x >= 14 && spot.x <= 17)
      // A fortress (cover 3 for land units inside, small income) inland near the front.
      && place('fortress', 'neutral', spot => spot.x >= 11 && spot.x <= 17 && !coast(spot.x, spot.y));
    if (!ok) return null;
    // A supply depot (repairs every kind of unit at half price) on the way to the front.
    if (random() < .75) place('depot', 'neutral', spot => spot.x >= 9 && spot.x <= 17);
    // A field hospital (land units recover 3 HP a turn) a little behind the front.
    if (random() < .6) place('hospital', 'neutral', spot => spot.x >= 8 && spot.x <= 15);
    if (random() < .7) place('city', 'neutral', spot => spot.x >= 9 && spot.x <= 17);
    if (random() < .4) place('city', 'neutral', spot => spot.x >= 10 && spot.x <= 17);
    if (random() < .5) {
      const kind = random() < .5 ? 'airfield' : 'port';
      place(kind, 'neutral', spot => spot.x >= 12 && spot.x <= 17 && (kind === 'airfield' || coast(spot.x, spot.y)));
    }

    // Roads from headquarters to the factory, the cities and the centre line.
    const seamTarget = pick(landTiles.filter(({x}) => x === half - 1));
    if (!seamTarget) return null;
    const roadTo = target => {
      const path = shortestPath(grid, hq, target, id => id === 'p' || id === 'd');
      if (path) for (const {x, y} of path) grid[y][x] = 'd';
      return Boolean(path);
    };
    if (!roadTo(seamTarget)) return null;
    for (const site of sites.filter(site => site.owner === 'friendly' && site.kind !== 'port')) roadTo(site);

    // A river that runs from the coast into the land, crossed by bridges where roads meet it.
    if (random() < .7) {
      const mouths = landTiles.filter(({x, y}) => coast(x, y) && grid[y][x] === 'p' && x <= 14 && (y <= 5 || y >= height - 7));
      if (mouths.length) {
        let at = pick(mouths);
        const goingDown = at.y <= 5;
        for (let length = 0; length < 11; length++) {
          if (!inside(at.x, at.y) || isWater(grid[at.y][at.x]) && length) break;
          const id = grid[at.y][at.x];
          if (taken.has(`${at.x},${at.y}`)) break;
          grid[at.y][at.x] = id === 'd' ? 'b' : 'r';
          at = random() < .7 ? {x: at.x, y: at.y + (goingDown ? 1 : -1)} : {x: at.x + (random() < .5 ? 1 : -1), y: at.y};
        }
      }
    }

    // Forests, mountains and marshes in clusters on the remaining plains.
    const cover = noiseField(random, 2.2);
    const ridge = noiseField(random, 2.6);
    // Keep the mix playable: at most about 1 in 11 land tiles are mountains and 1 in 5 forests,
    // taking the highest ridges and densest cover first so they still form clusters.
    const open = landTiles.filter(({x, y}) => grid[y][x] === 'p' && !taken.has(`${x},${y}`)
      && Math.abs(x - hq.x) + Math.abs(y - hq.y) > 1);
    const ranked = (score, limit, filter) => open.filter(spot => grid[spot.y][spot.x] === 'p' && filter(spot) && score(spot) > 0)
      .sort((a, b) => score(b) - score(a)).slice(0, limit);
    for (const {x, y} of ranked(({x, y}) => ridge(x, y) - .62, Math.round(landTiles.length / 11), ({x, y}) => !coast(x, y))) grid[y][x] = 'm';
    // A snowfield on the high northern ground and jungle in the humid south.
    const climate = noiseField(random, 2.4);
    for (const {x, y} of ranked(({x, y}) => climate(x, y) - .35, Math.round(landTiles.length / 16), ({x, y}) => y <= 7 && !coast(x, y))) grid[y][x] = 'n';
    for (const {x, y} of ranked(({x, y}) => cover(x, y) - .42, Math.round(landTiles.length / 18), ({y}) => y >= height - 9)) grid[y][x] = 'j';
    for (const {x, y} of ranked(({x, y}) => cover(x, y) - .58, Math.round(landTiles.length / 5), () => true)) grid[y][x] = 'f';
    for (const {x, y} of ranked(({x, y}) => .2 - cover(x, y), Math.round(landTiles.length / 30), ({x, y}) => coast(x, y))) grid[y][x] = 's';
    // Hills on the lower slopes around the ridges, ruins in the contested middle, beaches on open shores.
    for (const {x, y} of ranked(({x, y}) => ridge(x, y) - .5, Math.round(landTiles.length / 12), ({x, y}) => !coast(x, y))) grid[y][x] = 'k';
    const rubble = noiseField(random, 1.6);
    for (const {x, y} of ranked(({x, y}) => rubble(x, y) - .55, Math.round(landTiles.length / 40), ({x}) => x >= 8)) grid[y][x] = 'u';
    for (const {x, y} of ranked(({x, y}) => cover(x, y) - .2, Math.round(landTiles.length / 14), ({x, y}) => coast(x, y))) grid[y][x] = 'a';

    const west = grid.map(row => row.join(''));
    const terrain = west.map(row => row + [...row].reverse().join(''));
    const mirror = x => width - 1 - x;
    return {
      version, seed, width, height, terrain,
      headquarters: {friendly: {x: hq.x, y: hq.y}, enemy: {x: mirror(hq.x), y: hq.y}},
      sites: sites.flatMap(site => [site, {...site, x: mirror(site.x), owner: site.owner === 'friendly' ? 'enemy' : site.owner}]),
    };
  }

  // Movement rules used to check a layout (a subset of rules.js for the generated maps).
  const blockedFor = {
    infantry: id => id === 'o' || id === 'h' || id === 'r' || id === 'e',
    tank: id => id === 'o' || id === 'h' || id === 'r' || id === 'm' || id === 'e',
    ship: id => !(id === 'o' || id === 'h'),
  };
  function reach(map, from, mover) {
    const portAt = new Set(map.sites.filter(site => site.kind === 'port').map(({x, y}) => `${x},${y}`));
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    for (const {x, y} of queue) {
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
        if (blockedFor[mover](map.terrain[ny][nx]) && !(mover === 'ship' && portAt.has(key))) continue;
        seen.add(key);
        queue.push({x: nx, y: ny});
      }
    }
    return seen;
  }

  function validateGeneratedMap(map) {
    if (!map || map.terrain.length !== map.height || map.terrain.some(row => row.length !== map.width)) return false;
    const {friendly, enemy} = map.headquarters;
    const onFoot = reach(map, friendly, 'infantry');
    const byTank = reach(map, friendly, 'tank');
    if (!onFoot.has(`${enemy.x},${enemy.y}`) || !byTank.has(`${enemy.x},${enemy.y}`)) return false;
    for (const site of map.sites) {
      const id = map.terrain[site.y][site.x];
      if (id !== 'p' && id !== 'd') return false;
      if (!onFoot.has(`${site.x},${site.y}`)) return false;
    }
    const ports = map.sites.filter(site => site.kind === 'port');
    if (ports.length) {
      const bySea = reach(map, ports[0], 'ship');
      if (!ports.every(({x, y}) => bySea.has(`${x},${y}`))) return false;
    }
    const kinds = side => map.sites.filter(site => site.owner === side).map(site => site.kind).sort().join();
    return kinds('friendly') === kinds('enemy') && kinds('friendly').includes('factory');
  }

  function generateMap(seed = Math.floor(Math.random() * 0x7fffffff)) {
    for (let tries = 0; tries < 400; tries++) {
      const map = attempt((seed + tries * 7919) >>> 0);
      if (map && validateGeneratedMap(map)) return {...map, seed};
    }
    throw new Error('map generation failed');
  }

  const api = {generateMap, validateGeneratedMap, mapVersion: version};
  if (typeof module !== 'undefined') module.exports = api;
  else self.MapGenerator = api;
})();
