// Generates a new random battlefield for every new match. The west half is generated
// and mirrored onto the east half, so both armies always get the same terrain, the same
// facilities and the same distances. A layout is accepted only when every route the
// game needs exists (see validateGeneratedMap); otherwise the next seed is tried.
(() => {
  const width = 26;
  const height = 18;
  const half = width / 2;
  const version = 1;

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
        const value = noise(x, y) * .55 + (1 - toSeam) * .55 - vertical * vertical * .5;
        row.push(x >= 1 && y >= 1 && y < height - 2 && value > .38);
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
    const grid = mask.map(row => row.map(land => (land ? 'p' : 'o')));
    const landCount = mask.flat().filter(Boolean).length;
    if (landCount < 95 || landCount > 150) return null;
    // Shallows along the coast.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < half; x++) {
        if (grid[y][x] !== 'o') continue;
        if (steps.some(([dx, dy]) => inside(x + dx, y + dy) && grid[y + dy][x + dx] === 'p') && random() < .8) grid[y][x] = 'h';
      }
    }
    const coast = (x, y) => steps.some(([dx, dy]) => inside(x + dx, y + dy) && isWater(grid[y + dy][x + dx]));
    const landTiles = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < half; x++) if (grid[y][x] === 'p') landTiles.push({x, y});

    // Headquarters on the home side, away from the shore.
    const homeCandidates = landTiles.filter(({x, y}) => x >= 2 && x <= 5 && y >= 4 && y <= height - 6 && !coast(x, y));
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
      && place('city', 'friendly', spot => near(hq, 3, 6)(spot) && spot.x <= 8)
      && place('airfield', 'friendly', spot => near(hq, 2, 6)(spot) && spot.x <= 8)
      && place('port', 'friendly', spot => coast(spot.x, spot.y) && spot.x <= 8)
      && place('city', 'neutral', spot => spot.x >= 8 && spot.x <= 11)
      && place('factory', 'neutral', spot => spot.x >= 8 && spot.x <= 11);
    if (!ok) return null;
    if (random() < .6) place('city', 'neutral', spot => spot.x >= 6 && spot.x <= 11);
    if (random() < .5) {
      const kind = random() < .5 ? 'airfield' : 'port';
      place(kind, 'neutral', spot => spot.x >= 7 && spot.x <= 11 && (kind === 'airfield' || coast(spot.x, spot.y)));
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
      const mouths = landTiles.filter(({x, y}) => coast(x, y) && grid[y][x] === 'p' && x <= 9 && (y <= 3 || y >= height - 5));
      if (mouths.length) {
        let at = pick(mouths);
        const goingDown = at.y <= 3;
        for (let length = 0; length < 7; length++) {
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
    for (const {x, y} of landTiles) {
      if (grid[y][x] !== 'p' || taken.has(`${x},${y}`)) continue;
      const near = Math.abs(x - hq.x) + Math.abs(y - hq.y);
      if (near <= 1) continue;
      if (ridge(x, y) > .7 && !coast(x, y)) grid[y][x] = 'm';
      else if (cover(x, y) > .64) grid[y][x] = 'f';
      else if (cover(x, y) < .14 && coast(x, y)) grid[y][x] = 's';
    }

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
    infantry: id => id === 'o' || id === 'h' || id === 'r',
    tank: id => id === 'o' || id === 'h' || id === 'r' || id === 'm',
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
