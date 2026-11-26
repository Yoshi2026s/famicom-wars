// Original pixel art. Run with Node.js to rebuild the PNGs used by the game.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const directory = new URL('../public/assets/', import.meta.url);
mkdirSync(directory, {recursive: true});

function pngChunk(kind, data) {
  const tag = Buffer.from(kind);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([tag, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, tag, data, checksum]);
}

class Pixels {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(height * (width * 4 + 1));
  }
  rect(x, y, w, h, color) {
    const rgb = parseInt(color, 16);
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) {
        const at = j * (1 + this.width * 4) + 1 + i * 4;
        this.data[at] = rgb >>> 16;
        this.data[at + 1] = rgb >>> 8;
        this.data[at + 2] = rgb;
        this.data[at + 3] = 255;
      }
    }
  }
  sprite(x, y, rows, colors, scale = 1) {
    rows.forEach((row, j) => {
      [...row].forEach((key, i) => {
        if (colors[key]) this.rect(x + i * scale, y + j * scale, scale, scale, colors[key]);
      });
    });
  }
  ellipse(x, y, rx, ry, color) {
    for (let row = -ry; row <= ry; row++) {
      const half = Math.floor(rx * Math.sqrt(1 - (row / ry) ** 2));
      this.rect(x - half, y + row, 2 * half + 1, 1, color);
    }
  }
  save(name) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8;
    header[9] = 6;
    writeFileSync(new URL(name, directory), Buffer.concat([
      Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(this.data, {level: 9})), pngChunk('IEND', Buffer.alloc(0)),
    ]));
  }
}

let seed = 1947;
function random(limit) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return Math.floor(seed / 2 ** 32 * limit);
}

const fir = [
  '.....t.....', '....tlt....', '....llt....', '...llmmt...', '..lllmmt...',
  '...lmmtt...', '..llmmmt...', '.llmlmmmt..', 'ttllmmmttt.', '..lmmmt....',
  '.llmmmmt...', 'llmmlmmt...', 'tmmmmtmttt.', '.tttttttt..', '....ww.....',
];
const treeColors = {t:'466e48', l:'82a75b', m:'60914f', w:'806e47'};
const rocks = ['...aaa...', '..ahlha..', '.ahlllla.', 'allmmlmma', '.ammmaa..'];
const rockColors = {a:'67755f', h:'e1dcb3', l:'bdc3a0', m:'95a68c'};
const mapSize = 320;
const map = new Pixels(mapSize, mapSize);
// Continuous paths and patches of meadow are terrain decoration on this flat training map.
function pathX(y) {
  return Math.round(266 - y * .66 + 24 * Math.sin(y / 39) + 10 * Math.cos(y / 22));
}
const meadowColors = ['547b59','628760','739669','85a46d','98ad74','aeb77e'];
const meadowDither = ['5a805e','698c63','7a9b6e','8ba773','9daf78','b2ba82'];
const pathColors = ['b4a079','bba981','c4af87','c9b88b'];
for (let y = 0; y < mapSize; y++) {
  const center = pathX(y);
  for (let x = 0; x < mapSize; x++) {
    const slope = Math.sin(x / 46 + y / 56) + Math.cos(x / 63 - y / 34) + .39 * Math.sin(y / 22);
    const slopeIndex = Math.max(0, Math.min(5.99, 2.7 + slope * 1.35));
    const band = Math.floor(slopeIndex);
    const trail = Math.abs(x - center) + random(3);
    let color = slopeIndex % 1 > .72 && (x + y) % 2 ? meadowDither[band] : meadowColors[band];
    if (trail < 10) color = pathColors[random(pathColors.length)];
    else if (trail < 13) color = trail < 11 ? 'd5c397' : 'a6a879';
    map.rect(x,y,1,1,color);
  }
}
for (let i = 0; i < 2440; i++) {
  const x = random(mapSize), y = random(mapSize);
  if (Math.abs(x-pathX(y)) < 9) {
    map.rect(x,y,random(4)+1,1,i % 3 ? 'a59571' : 'e2ce9d');
  } else {
    map.rect(x,y,random(3)+1,1,['a6b87a','4e7757','aabe80'][random(3)]);
    if (i % 6 === 0) {
      map.rect(x-1,y-1,1,2,'658b5b'); map.rect(x+1,y-2,1,3,'799a62');
      map.rect(x+2,y-2,1,1,'c0c98e');
    }
  }
}
for (const [cx,cy] of [[17,12],[9,82],[175,26],[155,106],[29,143],[174,180],[89,49]]) {
  for (let i=0; i<10; i++) {
    const x=Math.round(cx*1.6)+random(19), y=Math.round(cy*1.6)+random(15);
    map.rect(x,y+1,1,2,'76974e'); map.rect(x-1,y,3,1,i%3 ? 'f7e5aa' : 'ecd477');
  }
}
for (const [x,y] of [[6,5],[17,7],[1,13],[11,16],[55,0],[183,1],[171,8],[185,13],
  [4,55],[9,64],[175,54],[185,62],[144,124],[153,129],[3,169],[11,177],[166,177],[176,183],[158,185]]) {
  const left = Math.round(x * 1.6), top = Math.round(y * 1.6);
  map.ellipse(left + 18, top + 26, 17, 4, '456b50');
  map.sprite(left,top,fir,treeColors,2);
}
for (const [x,y] of [[84,13],[90,16],[34,54],[151,77],[26,111],[120,148],[127,152],[78,179],[185,147]]) {
  map.sprite(Math.round(x * 1.6),Math.round(y * 1.6),rocks,rockColors,2);
}
map.save('grassland.png');

const portrait = new Pixels(176, 72);
portrait.rect(0,0,176,72,'d8e7c6');
for (const [x,y,w] of [[8,14,24],[19,10,11],[112,8,22],[121,5,9],[144,21,19],[58,6,19]]) {
  portrait.rect(x,y,w,3,'f1f0d1');
}
for (let x=0; x<176; x++) {
  const far = Math.round(37 + 4*Math.sin(x/18) - 6*Math.cos(x/11));
  const near = Math.round(45 + 2*Math.cos(x/9) - 4*Math.sin(x/20));
  portrait.rect(x,far,1,72-far,'a7c8a0');
  portrait.rect(x,near,1,72-near,'84aa79');
}
for (let x=-6; x<176; x += 6+random(7)) {
  const y = 34 + random(8);
  portrait.sprite(x,y,fir,{t:'678f6a',l:'87aa7a',m:'779d71',w:'75906a'});
}
for (let x=0; x<176; x++) {
  const y = 52 + Math.round(2*Math.sin(x/22));
  portrait.rect(x,y,1,72-y,'b9c77c');
  portrait.rect(x,61+Math.round(2*Math.sin(x/16)),1,14,'aabb71');
}
for (let i=0; i<220; i++) {
  const x=random(176), y=56+random(16);
  portrait.rect(x,y,2+random(3),1,i%2 ? 'd5d891':'91aa68');
}
portrait.rect(77,64,24,2,'80965f');
portrait.save('meadow.png');

const infantryRows = [
  '.........ooooo.........',
  '.......ootttttoo.......',
  '......otthhhttllo......',
  '.....otthhttttlllo.....',
  '.....ottttttttlllo.....',
  '....odddddddddddddo....',
  '....oddtttttttllldo....',
  '.....odgggggggdno.....',
  '.....ogaggaagggno.....',
  '.....odgggggggdno.....',
  '......osffssffso.......',
  '.......ojjjjjoo........',
  '.....ooojjjjjdoo.......',
  '....oppoojjjdltto......',
  '...opppotjjjtlltto.....',
  '...oppootthttllldo.....',
  '...oppottshtttllsso....',
  '....oootssdddddlsso....',
  '.....oonssbbbbdooo.....',
  '......ooddbybddo.......',
  '.......odddodddo.......',
  '.......odllodllo.......',
  '.......odlloodllo......',
  '......obbbboobbbo......',
  '......obbbboobbbbo.....',
  '......ooooo.oooooo.....',
];
const uniform = {o:'182a32', t:'348c98', h:'89dbd0', l:'256279', d:'274457', n:'79594e',
  s:'d49264', f:'ffd4a1', j:'ebbe60', p:'887550', b:'514941', y:'e2b669', a:'b9f2d9', g:'294958'};
const unit = new Pixels(46,54);
unit.sprite(0,0,infantryRows,uniform,2);
unit.rect(23,8,10,2,uniform.h);
unit.rect(27,6,5,2,uniform.a);
unit.rect(27,32,5,2,uniform.h);
unit.rect(27,34,2,2,uniform.a);
unit.rect(10,23,3,10,uniform.d);
unit.rect(10,23,3,2,uniform.h);
unit.rect(13,31,5,2,uniform.j);
unit.save('infantry.png');

const enemyUniform = {
  ...uniform, o:'38272f', t:'b84f4d', h:'f4a479', l:'8d3d45', d:'663342', j:'f0deb0', a:'ffd3a2', g:'503635',
};
const enemy = new Pixels(46,54);
enemy.sprite(0,0,infantryRows.map(row => [...row].reverse().join('')), enemyUniform,2);
enemy.rect(13,8,10,2,enemyUniform.h);
enemy.rect(14,6,5,2,enemyUniform.a);
enemy.rect(13,32,5,2,enemyUniform.h);
enemy.rect(34,23,3,10,enemyUniform.d);
enemy.rect(34,23,3,2,enemyUniform.h);
enemy.rect(29,31,5,2,enemyUniform.j);
enemy.save('enemy-infantry.png');

// Side view for the battle cutaway; both formations face the centre.
const profile = [
  '......oooooo', '....ootthhttoo', '...otthhhhtttlo', '..otthhttttttllo',
  '..ottttttttlllllo', '..odddddddddddddoo', '...onnfsffnffo', '...onffsffoffo',
  '...onnsfsfffffo', '....oosffffffo', '...oooossssso', '.ooppoojjjjdoo',
  'oppppottjjjttloo....ooooo', 'opppotthttttttsoooooddddooo', 'opppottttssffffbddddddddddo',
  'opppooltlosssoooddoodooo', 'oppooottlloooddoo', '.oooooddddbbbbo',
  '.....odddybddo', '.....odlltddlo', '....odlldodllo', '....odlldoodllo',
  '...obbbo...obbbo', '..obbbbo...obbbboo', '..oooooo...ooooooo',
];
for (const [name, palette] of [['ally', uniform], ['foe', enemyUniform]]) {
  const sheet = new Pixels(56, 150);
  for (const [pose, head, arms, backFoot] of [[0,0,0,0], [1,1,1,-1], [2,-1,-1,-1]]) {
    const top = pose * 50;
    for (const [row, pixels] of profile.entries()) {
      const shift = row < 11 ? head : row < 19 ? arms : 0;
      if (row < 21) sheet.sprite(shift * 2, top + row * 2, [pixels], palette, 2);
      else {
        sheet.sprite(backFoot * 2, top + row * 2, [pixels.slice(0, 10)], palette, 2);
        sheet.sprite((10 - backFoot) * 2, top + row * 2, [pixels.slice(10)], palette, 2);
      }
    }
    sheet.rect(12 + head * 2, top + 4, 9, 2, palette.a);
    sheet.rect(42 + arms * 2, top + 28, 10, 1, palette.h);
    sheet.rect(11 + arms * 2, top + 32, 3, 5, palette.h);
  }
  sheet.save('squad-' + name + '.png');
}

// Stand, aim, fire, recoil, take a hit, duck, defeated. Each cell is 64 × 56 pixels.
const poses = [
  {head: [0, 0], arms: [0, 0], stance: 0},
  {head: [1, 0], arms: [1, -1], stance: 1},
  {head: [1, 0], arms: [2, -1], stance: 1},
  {head: [-1, -1], arms: [-1, -2], stance: 2},
  {head: [-2, 1], arms: [-1, 1], stance: 2},
  {head: [1, 3], arms: [1, 2], stance: 2},
  {head: [-1, 6], arms: [-2, 4], stance: 2},
];
for (const [name, palette] of [['ally', uniform], ['foe', enemyUniform]]) {
  const atlas = new Pixels(64, 56 * poses.length);
  for (const [index, {head, arms, stance}] of poses.entries()) {
    const top = index * 56;
    if (index === 6) {
      atlas.sprite(5, top + 34, [
        '....................oo...', '.............oooo.ottto..',
        '.......oooooottttoodggo..', '..ooooddllltthhltopoooo..',
        '.oddlldoddldddddoopoo....', '.obbooodlboooooooooo.....',
        '.oooooooooooo...oodddddo.', '................oooooooo',
      ], palette, 2);
      atlas.rect(40, top + 37, 7, 1, palette.h);
      continue;
    }
    for (const [row, pixels] of profile.entries()) {
      if (row >= 20) {
        atlas.sprite(4 - stance * 2, top + 4 + row * 2, [pixels.slice(0, 10)], palette, 2);
        atlas.sprite(24 + stance * 2, top + 4 + row * 2, [pixels.slice(10)], palette, 2);
      } else {
        const [x, y] = row < 11 ? head : arms;
        const hipOffset = row < 16 ? y : Math.round(y * (20 - row) / 4);
        atlas.sprite(4 + x * 2, top + 4 + (row + hipOffset) * 2, [pixels], palette, 2);
      }
    }
    atlas.rect(16 + head[0] * 2, top + 8 + head[1] * 2, 10, 2, palette.a);
    atlas.rect(16 + head[0] * 2, top + 19 + head[1] * 2, 17, 3, palette.g);
    atlas.rect(18 + head[0] * 2, top + 19 + head[1] * 2, 6, 1, palette.a);
    atlas.rect(9 + arms[0] * 2, top + 25 + arms[1] * 2, 2, 11, palette.o);
    atlas.rect(46 + arms[0] * 2, top + 32 + arms[1] * 2, 10, 1, palette.h);
    atlas.rect(15 + arms[0] * 2, top + 36 + arms[1] * 2, 3, 4, palette.h);
  }
  atlas.save('volley-' + name + '.png');
}

// Keep the established map tiles independent of edits to the battle panorama.
seed = 779578159;
const forestTile = new Pixels(64, 64);
forestTile.rect(0, 0, 64, 64, '597a56');
for (let i = 0; i < 175; i++) {
  forestTile.rect(random(64), random(64), 1 + random(4), 1, i % 2 ? '819d6b' : '486f55');
}
for (const [x, y] of [[-3,-4],[13,-6],[36,-4],[50,-3],[6,8],[28,9],[46,12],[-4,24],[17,25],[36,26],[51,31],[4,39],[22,40],[40,41]]) {
  forestTile.ellipse(x + 17, y + 26, 14, 5, '305445');
  forestTile.sprite(x, y, fir, {t:'224943', l:'8dbb76', m:'487e61', w:'80664d'},2);
  forestTile.rect(x + 9, y + 8, 3, 2, 'c1d490');
  forestTile.rect(x + 5, y + 16, 4, 2, 'a5c78a');
  forestTile.rect(x + 12, y + 20, 5, 1, '609570');
  forestTile.rect(x + 15, y + 23, 3, 1, '39755a');
}
forestTile.save('terrain-forest.png');

const mountainTile = new Pixels(64, 64);
mountainTile.rect(0, 0, 64, 64, '869269');
for (let i = 0; i < 170; i++) {
  mountainTile.rect(random(64), random(64), 1 + random(3), 1, i % 2 ? 'a7ae80' : '697a60');
}
const peak = [
  '..........tt..........', '.........tllt.........', '.........tlst.........',
  '........tlhlst........', '.......tlhllsdt.......', '.......thhlsddt.......',
  '......thshlsdsdt......', '.....tlhllssdddt......', '.....tlrllssdsddt.....',
  '....tllrrlssdssddt....', '....tlrrllssddsddt....', '...tlllrlssdddssddt...',
  '..tllrllrssdsdddddtt..', '..tllrrrrssddssddddd..', '.tllrlrrsdsdddsddddtt.',
  'tllrllrsdsdddssddddddt', 'ttrrlrrssdddddddddddtt', '.ttrrrssdddttttttttt..',
];
const stoneColors = {t:'455766', l:'d5d0bc', h:'f7e8c6', r:'b2b5b0', s:'8c9ba3', d:'637689'};
const ridgeColors = {t:'43566a', l:'d9d6c4', h:'fff0cc', r:'b7bab5', s:'899da9', d:'5e748a'};
for (const [x, y, scale] of [[-7,8,2],[25,1,2],[16,24,2],[0,43,1],[40,39,1],[31,47,1]]) {
  mountainTile.ellipse(x+11*scale,y+17*scale,12*scale,3*scale,'5c7164');
  mountainTile.sprite(x, y, peak, ridgeColors, scale);
  mountainTile.rect(x+9*scale,y+6*scale,scale,scale,'efe9cf');
  mountainTile.rect(x+14*scale,y+12*scale,3*scale,scale,'7890a2');
}
mountainTile.save('terrain-mountain.png');

// Keep the original scenery's seeded texture independent of the crossing tiles.
const scenerySeed = seed;
seed = 29350613;
const crossingPlains = new Pixels(64, 64);
crossingPlains.rect(0, 0, 64, 64, '859c63');
for (let i = 0; i < 150; i++) {
  crossingPlains.rect(random(64), random(64), 1 + random(4), 1, i % 2 ? '98aa70' : '718e5a');
}
for (const [x, y] of [[7,13],[43,9],[24,38],[58,33],[9,54],[41,56]]) {
  crossingPlains.sprite(x,y,['...a.','.a.a.','.al..','..s..'], {a:'b8c77d', l:'a1b36f', s:'688955'});
}
crossingPlains.save('terrain-crossing-plains.png');

for (const [side, roof, light, flag] of [
  ['friendly', '36778a', '8fcec8', '6edac8'],
  ['enemy', '974c38', 'e1a36d', 'f09066'],
]) {
  const base = new Pixels(64, 64);
  base.ellipse(32, 52, 26, 8, '55694c');
  base.rect(8, 47, 48, 8, 'a59472');
  base.rect(12, 28, 40, 23, '303638');
  base.rect(15, 30, 34, 18, 'c9b995');
  base.rect(15, 38, 34, 10, '958562');
  base.rect(28, 36, 10, 13, '493e33');
  base.rect(19, 33, 5, 5, light);
  base.rect(42, 33, 5, 5, light);
  base.rect(9, 24, 46, 7, '303638');
  base.rect(13, 20, 38, 7, roof);
  base.rect(18, 17, 29, 6, roof);
  base.rect(19, 17, 26, 2, light);
  base.rect(31, 6, 3, 17, 'e1d9aa');
  base.rect(34, 7, 15, 8, flag);
  base.rect(34, 13, 12, 2, roof);
  base.rect(10, 49, 44, 2, 'e1ca98');
  base.rect(17, 41, 8, 2, 'aa9977');
  base.rect(40, 43, 8, 2, 'aa9977');
  base.rect(18, 22, 28, 2, light);
  base.save(`headquarters-${side}.png`);
}

for (const [side, wall, bright] of [['friendly', '347485', '81bfba'], ['enemy', '954e3b', 'df9a6d']]) {
  const factory = new Pixels(64, 64);
  factory.ellipse(32, 52, 28, 7, '586d54');
  factory.rect(5, 47, 54, 8, 'a29574');
  factory.rect(42, 10, 11, 26, '2e3334');
  factory.rect(45, 12, 6, 23, wall);
  factory.rect(41, 8, 13, 5, 'c3b38e');
  factory.sprite(4, 18, ['..............', '....xx..xx....', '...xwx.xwx....', '..xwwxxwwxx...', '.xwwwwwwwwwx..',
    '.xxxxxxxxxxxxx', '.xwwwwwwwwwwwx', '.xwlwxhhhxwlwx', '.xwwwxhhhxwwwx', '.xwwwxhhhxwwwx', '.xxxxxxxxxxxxx'],
  {x: '2e3334', w: wall, l: bright, h: '7f8277'}, 4);
  factory.rect(29, 49, 12, 2, 'd0c6a9');
  for (const y of [39,42,45]) factory.rect(26, y, 16, 1, '555e5c');
  for (const x of [13,18,47,52]) factory.rect(x, 42, 2, 2, bright);
  factory.save(`factory-${side}.png`);
}

for (const [side, roof, light] of [
  ['friendly', '3b8292', '8ccabe'], ['enemy', 'a3553e', 'eaa976'], ['neutral', '84724d', 'cfba7b'],
]) {
  const city = new Pixels(64, 64);
  city.ellipse(32, 51, 28, 8, '52664d');
  city.rect(7, 44, 50, 9, 'b4a783');
  for (const [x, y, width] of [[6, 26, 17], [22, 17, 21], [43, 25, 15]]) {
    city.rect(x, y, width, 48 - y, '39393a');
    city.rect(x + 2, y + 5, width - 4, 41 - y, 'cebd99');
    city.rect(x - 1, y, width + 2, 5, roof);
    city.rect(x + 1, y - 3, width - 2, 4, roof);
    city.rect(x + 3, y - 3, width - 6, 2, light);
    city.rect(x + 4, y + 9, 4, 4, '666357');
    city.rect(x + width - 8, y + 9, 4, 4, '666357');
    city.rect(x + Math.floor(width / 2) - 2, 41, 5, 7, '544b41');
    city.rect(x + 4, y + 9, 2, 2, 'fbde9c');
    city.rect(x + width - 8, y + 9, 2, 2, 'edbd79');
    city.rect(x + 2, 45, 4, 1, 'a99a77');
  }
  city.save(`city-${side}.png`);
}

function drawBridge(tile) {
  tile.rect(0, 18, 64, 31, '40312c');
  tile.rect(0, 21, 64, 23, 'b99262');
  for (let x = 0; x < 64; x += 8) {
    tile.rect(x, 21, 1, 24, '725139');
    tile.rect(x + 1, 23, 5, 2, 'd8b783');
    tile.rect(x + 1, 33, 4, 1, 'c5a473');
    tile.rect(x + 2, 41, 4, 1, '997443');
  }
  for (const y of [17, 44]) {
    tile.rect(0, y, 64, 3, 'e3bf82');
    for (const x of [4, 27, 56]) {
      tile.rect(x, y - 3, 4, 9, '70513b');
      tile.rect(x, y - 3, 3, 1, 'f4d29b');
    }
  }
}

const deck = new Pixels(64, 64);
drawBridge(deck);
deck.save('terrain-bridge-deck.png');
for (const name of ['river', 'bridge']) {
  const tile = new Pixels(64, 64);
  tile.rect(0, 0, 64, 64, '386c81');
  tile.rect(15, 0, 34, 64, '3f7b8c');
  for (let i = 0; i < 130; i++) {
    tile.rect(random(64), random(64), 2 + random(11), 1, i % 2 ? '609ba3' : '2f627a');
  }
  if (name === 'bridge') drawBridge(tile);
  tile.save(`terrain-${name}.png`);
}

// The four cardinal connections use bits 1, 2, 4 and 8, clockwise from north.
const waterways = new Pixels(64 * 9, 64 * 16);
for (let mask = 0; mask < 16; mask++) {
  const lateral = (mask & 5) === 0 && mask !== 0;
  for (let frame = 0; frame <= 8; frame++) {
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dx = x - 31.5;
        const dy = y - 31.5;
        const horizontal = Math.sin(x / 63 * Math.PI) * 3;
        const vertical = Math.sin(y / 63 * Math.PI) * 3;
        const bank = Math.min(Math.hypot(dx, dy) - 22,
          mask & 1 ? Math.hypot(dx + vertical, Math.max(0, dy)) - 21 : Infinity,
          mask & 2 ? Math.hypot(dy - horizontal, Math.max(0, -dx)) - 21 : Infinity,
          mask & 4 ? Math.hypot(dx - vertical, Math.max(0, -dy)) - 21 : Infinity,
          mask & 8 ? Math.hypot(dy + horizontal, Math.max(0, dx)) - 21 : Infinity);
        const grain = ((x * 23 + y * 37) ^ (x * y * 11)) & 15;
        const across = lateral ? y : x;
        const downstream = lateral ? x : y;
        const ripple = (downstream + 64 - frame * 8 + (across >> 3) * 3) & 63;
        const gleam = ripple % 17 < 2 && (across + (ripple >> 2) * 13) % 19 < 11;
        let color;
        if (bank > 3) color = grain < 2 ? 'a0b573' : grain > 13 ? '748e58' : '859c63';
        else if (bank > 1) color = grain < 7 ? '738755' : 'a1a477';
        else if (bank > -1.1) color = grain < 11 ? 'b8b68a' : 'd6c69b';
        else if (bank > -4) color = gleam ? 'bbded3' : '589a9c';
        else if (gleam) color = ripple < 20 ? '7dbcb5' : '5d9fa7';
        else if (ripple % 13 < 2) color = '31687f';
        else color = bank < -14 ? '2e6e87' : '3a8295';
        waterways.rect(frame * 64 + x, mask * 64 + y, 1, 1, color);
      }
    }
  }
}
waterways.save('terrain-waterways.png');

function reeds(image, x, y, scale = 1) {
  image.sprite(x, y, ['...ll.......', '...ll....l..', '.l..l....l..', '.l..ml...ml.',
    '.m..ml..lm..', '..ml.mm.mm..', '..mm.mm.mm..', '...mmmmmm...', '..ddddddddd.'],
  {l: 'c2b377', m: '647f50', d: '3d5d47'}, scale);
}

const marshTile = new Pixels(64, 64);
marshTile.rect(0, 0, 64, 64, '648169');
for (const [x, y, w, h] of [[10,8,18,5], [47,21,19,8], [17,39,21,6], [54,57,24,6]]) {
  marshTile.ellipse(x, y, w, h, '4a797d');
  marshTile.rect(x - 5, y, 15, 1, '77a2a0');
}
for (const [x, y] of [[10,3],[36,4],[1,24],[26,23],[43,31],[13,44],[41,49]]) {
  reeds(marshTile, x, y, 2);
}
marshTile.save('terrain-marsh.png');

const marshCover = new Pixels(140, 76);
marshCover.ellipse(57, 67, 59, 6, '54787b');
marshCover.rect(12, 66, 60, 1, '89aaa0');
for (const [x, y, scale] of [[4,37,3], [28,26,4], [72,31,4], [107,45,3]]) {
  reeds(marshCover, x, y, scale);
}
marshCover.save('volley-cover-marsh.png');
seed = scenerySeed;

const vehiclePalettes = {
  scout: {body: '3d8f99', light: '93dfcf', shade: '285c70', glass: 'b3e6e1'},
  'enemy-scout': {body: 'a85848', light: 'efb477', shade: '6e3933', glass: 'ead09b'},
  support: {body: 'ad5e4e', light: 'edab72', shade: '773d42', glass: 'f1c39c'},
  'friendly-support': {body: '3c719a', light: 'a3d7ed', shade: '294c72', glass: 'b9eddf'},
};

function drawVehicle(image, top, name, pose, left = 0, stride = 0) {
  const scoutVehicle = name === 'scout' || name === 'enemy-scout';
  const {body, light, shade, glass} = vehiclePalettes[name];
  const shift = pose === 3 || pose === 4 ? -2 : 0;
  const y = top + stride % 2;
  const paint = (x, row, width, height, color) => image.rect(left + x + shift, y + row, width, height, color);
  const edge = '202b37';
  if (pose === 6) {
    paint(8, 43, 49, 6, '2a292e');
    paint(11, 39, 42, 5, shade);
    paint(14, 38, scoutVehicle ? 22 : 13, 3, body);
    paint(51, 48, 10, 4, '34323b');
    paint(54, 48, 4, 2, '81705c');
    if (!scoutVehicle) {
      paint(31, 29, 19, 10, '39323a');
      paint(34, 31, 15, 4, shade);
      paint(44, 35, 12, 2, 'b07e54');
    }
    paint(19, 41, 7, 1, 'de9c64');
    return;
  }

  if (scoutVehicle) {
    paint(6, 30, 53, 13, edge);
    paint(8, 27, 35, 7, shade);
    paint(10, 29, 43, 10, body);
    paint(43, 31, 16, 6, body);
    paint(46, 31, 10, 2, light);
    paint(8, 38, 48, 3, shade);
    paint(15, 20, 25, 12, edge);
    paint(18, 18, 19, 4, light);
    paint(19, 22, 16, 9, shade);
    paint(24, 22, 11, 6, glass);
    paint(35, 23, 4, 5, glass);
    paint(12, 10, 2, 19, edge);
    paint(11, 9, 5, 2, light);
    const barrel = pose === 1 || pose === 2 ? 23 : 26;
    paint(38, barrel, 18, 4, edge);
    paint(41, barrel, 13, 1, light);
    paint(54, 33, 4, 2, 'ffe7ae');
    paint(7, 34, 4, 3, 'cb815f');
    paint(24, 34, 11, 2, light);
    for (const x of [12, 42]) {
      paint(x, 37, 12, 12, edge);
      paint(x + 2, 39, 8, 8, '465056');
      paint(x + 3, 40, 6, 6, shade);
      paint(x + 4 + stride % 3, 41 + stride % 2, 2, 2, light);
    }
    if (pose === 2) paint(55, barrel - 1, 5, 5, 'ffe9a8');
    if (pose === 4) paint(45, 31, 8, 3, 'ffdc9b');
  } else {
    paint(4, 31, 56, 13, edge);
    paint(7, 32, 50, 8, body);
    paint(8, 35, 46, 2, light);
    paint(36, 22, 17, 13, edge);
    paint(39, 24, 12, 10, body);
    paint(44, 25, 6, 5, glass);
    paint(51, 30, 7, 6, shade);
    paint(54, 33, 5, 2, 'ffe6a3');
    paint(11, 24, 14, 9, shade);
    paint(15, 24, 4, 9, edge);
    paint(16, 25, 2, 8, light);
    const raised = pose === 1 || pose === 2;
    const drop = pose === 4 ? 4 : 0;
    for (let segment = 0; segment < 7; segment++) {
      const rack = 17 - (raised ? segment * 2 : Math.floor(segment / 3)) + drop;
      paint(6 + segment * 5, rack - 4, 5, 14, edge);
      paint(6 + segment * 5, rack - 2, 5, 10, shade);
      paint(6 + segment * 5, rack - 2, 5, 2, light);
      paint(6 + segment * 5, rack + 2, 5, 1, body);
    }
    for (const [x, tz] of [[10,39],[22,39],[45,39]]) {
      paint(x, tz, 11, 10, edge);
      paint(x + 2, tz + 2, 7, 6, shade);
      paint(x + 4 + stride % 3, tz + 3, 2, 2, light);
    }
    if (pose === 2) paint(41, 4, 6, 6, 'fcecc1');
    if (pose === 4) paint(22, 24, 6, 2, 'ffe0a3');
  }
}

function drawTank(image, top, {body, light, shade}, pose, left = 0, stride = 0) {
  const shift = pose === 3 ? -3 : pose === 4 ? -1 : 0;
  const turret = pose === 4 || pose === 5 ? 3 : 0;
  const paint = (x, y, width, height, color) => image.rect(left + x + shift, top + y, width, height, color);
  const outline = '20262e';
  if (pose === 6) {
    paint(5, 39, 53, 10, outline);
    paint(7, 43, 49, 6, '444047');
    paint(12, 44, 31, 2, '66554e');
    paint(12, 34, 41, 8, shade);
    paint(15, 30, 23, 8, '333139');
    paint(19, 31, 15, 2, body);
    paint(32, 33, 18, 6, '34313b');
    paint(48, 37, 12, 5, '3e363e');
    paint(14, 38, 9, 1, 'd19563');
    paint(35, 40, 5, 2, 'ac674e');
    return;
  }
  paint(7, 34, 50, 15, outline);
  paint(11, 32, 42, 19, outline);
  paint(9, 38, 46, 9, '3b4144');
  for (const x of [10, 20, 30, 40, 50]) {
    paint(x, 39, 6, 7, '535c5d');
    paint(x + 1, 40, 4, 4, '777b71');
    paint(x + 2, 41, 2, 2, shade);
  }
  for (let x = 12 + stride; x <= 51; x += 6) paint(x, 47, 3, 1, '8c8974');
  paint(5, 29, 54, 9, outline);
  paint(7, 26, 47, 8, body);
  paint(11, 27, 43, 3, light);
  paint(51, 29, 7, 7, body);
  paint(10, 33, 46, 5, shade);
  paint(16, 21 + turret, 29, 9, outline);
  paint(18, 18 + turret, 24, 10, body);
  paint(22, 17 + turret, 15, 3, light);
  paint(22, 14 + turret, 11, 3, outline);
  paint(24, 14 + turret, 10, 2, shade);
  paint(40, 24 + turret, pose === 3 ? 18 : 23, 6, outline);
  paint(42, 25 + turret, pose === 3 ? 15 : 19, 2, light);
  paint(39, 23 + turret, 7, 7, shade);
  paint(23, 22 + turret, 6, 3, shade);
  paint(24, 22 + turret, 4, 1, 'eddb9f');
  paint(10, 29, 12, 2, shade);
  paint(51, 31, 4, 2, 'f6dba4');
  for (const x of [14, 25, 36, 47]) paint(x, 31, 2, 1, light);
  if (pose === 2) paint(59, 23, 5, 7, 'ffe4a1');
  if (pose === 4) {
    paint(47, 15, 3, 3, 'fff5c1');
    paint(42, 19, 7, 1, 'f6ba85');
    paint(12, 29, 17, 1, 'fff5c1');
  }
}

function saveVehicle(name, draw) {
  const icon = new Pixels(64, 56);
  draw(icon, 0, 0);
  icon.save(`${name}.png`);
  const atlas = new Pixels(64, 56 * poses.length);
  for (const index of poses.keys()) draw(atlas, index * 56, index);
  atlas.save(`volley-${name}.png`);
}
for (const name of Object.keys(vehiclePalettes)) {
  saveVehicle(name, (image, top, pose) => drawVehicle(image, top, name, pose));
}
const tankPalettes = {
  tank: {body: '397299', light: '8ecbd5', shade: '284c6b'},
  'enemy-tank': {body: 'aa6144', light: 'efb577', shade: '733735'},
};
for (const [name, palette] of Object.entries(tankPalettes)) {
  saveVehicle(name, (image, top, pose) => drawTank(image, top, palette, pose));
}

function drawMarchingInfantry(image, left, top, colors, stride) {
  const rise = stride % 2;
  image.sprite(left + 9, top + 2 - rise, infantryRows.slice(0, 20), colors, 2);
  image.rect(left + 33, top + 10 - rise, 9, 2, colors.h);
  image.rect(left + 36, top + 8 - rise, 5, 2, colors.a);
  image.rect(left + 34, top + 29 - rise, 5, 2, colors.h);
  const swing = [0, 3, 0, -3][stride];
  for (const [x, lifted] of [[left + 24 - swing, stride === 1], [left + 34 + swing, stride === 3]]) {
    const y = top + 41 - (lifted ? 3 : 0);
    image.rect(x, y - 2, 7, 11, colors.o);
    image.rect(x + 1, y - 1, 5, 7, colors.l);
    image.rect(x - 1, y + 6, 9, 4, colors.o);
    image.rect(x, y + 6, 6, 2, colors.b);
  }
}

const marchRows = ['infantry','scout','friendly-support','tank','enemy-infantry','enemy-scout','support','enemy-tank'];
const march = new Pixels(64 * 5, 56 * marchRows.length);
for (const [row, name] of marchRows.entries()) {
  for (let frame = 0; frame <= 4; frame++) {
    const top = row * 56;
    const left = frame * 64;
    const stride = frame % 4;
    if (name.endsWith('infantry')) drawMarchingInfantry(march, left, top, name === 'infantry' ? uniform : enemyUniform, stride);
    else if (tankPalettes[name]) drawTank(march, top, tankPalettes[name], 0, left, stride);
    else drawVehicle(march, top, name, 0, left, stride);
  }
}
march.save('map-march.png');

const vista = new Pixels(360, 168);
for (const [top, end, color] of [
  [0, 15, '213451'], [15, 27, '374868'], [27, 40, '656181'], [40, 52, '977383'],
  [52, 63, 'cd8983'], [63, 80, 'edaa86'], [80, 168, 'f8c591'],
]) {
  vista.rect(0, top, 360, end - top, color);
}
for (const [x, y] of [[22,9],[43,16],[81,13],[116,8],[127,25],[189,12],[204,28],[246,11],[283,15],[306,24],[341,8]]) {
  vista.rect(x, y, 2, 1, 'e5cda9');
}
vista.ellipse(184, 63, 46, 24, 'f4b987');
vista.ellipse(184, 61, 34, 23, 'ffd697');
for (let y = 36; y <= 79; y++) {
  const halfWidth = Math.floor(Math.sqrt(Math.max(0, 22 ** 2 - (y - 58) ** 2)));
  vista.rect(184 - halfWidth, y, 2 * halfWidth + 1, 1, y < 63 ? 'ffe4a8' : 'f6cb95');
}
for (const [x, y, width] of [[10,33,50],[62,22,48],[104,49,30],[144,17,49],[228,28,43],[270,48,60],[322,20,32]]) {
  vista.rect(x, y + 4, width + 7, 1, 'b88e91');
  vista.rect(x, y, width, 3, 'b19099');
  vista.rect(x + 4, y - 3, width - 10, 4, 'dca397');
  vista.rect(x + 12, y - 5, width - 20, 2, 'e5b197');
}
for (let x = 0; x < 360; x++) {
  const ridge = 73 + Math.round(7 * Math.sin(x / 18) + 8 * Math.cos(x / 39) + 2 * Math.sin(x / 6));
  const near = 92 + Math.round(6 * Math.sin(x / 21 + 2) + 4 * Math.cos(x / 11));
  vista.rect(x, ridge, 1, 108 - ridge, '6d7188');
  vista.rect(x, ridge, 1, 2, 'a28e9a');
  vista.rect(x, ridge + 9, 1, 3, '787c90');
  vista.rect(x, near, 1, 117 - near, '3d6267');
  vista.rect(x, near, 1, 1, '618481');
}
for (let x = -4; x < 360; x += 6 + random(7)) {
  const y = 85 + random(12);
  vista.sprite(x, y, fir, {t:'3c5557', l:'788b72', m:'59766a', w:'595c50'});
}
for (let x = 0; x < 360; x++) {
  const hill = 109 + Math.round(3 * Math.sin(x / 17));
  const track = 126 + Math.round(2 * Math.sin(x / 27));
  const foreground = 156 + Math.round(4 * Math.cos(x / 23));
  vista.rect(x, hill, 1, 168 - hill, '879863');
  vista.rect(x, hill, 1, 2, 'bad099');
  vista.rect(x, track, 1, 18, 'b99873');
  vista.rect(x, track, 1, 2, 'dec097');
  vista.rect(x, track + 16, 1, 3, '806b5e');
  vista.rect(x, foreground, 1, 168 - foreground, '536f56');
}
for (let i = 0; i < 1200; i++) {
  const x = random(360);
  const y = 114 + random(54);
  const palette = y >= 128 && y <= 143 ? ['d1b485','b99b70'] : ['aeb178','828b5f','5f7054','b4b87b'];
  vista.rect(x, y, 1 + random(5), 1, palette[random(palette.length)]);
}
for (const [x, y] of [[2,149],[30,151],[69,146],[116,157],[138,151],[210,151],[230,158],[285,149],[311,155],[342,147]]) {
  vista.sprite(x, y, rocks, rockColors);
}
vista.save('combat-field.png');

const forestCover = new Pixels(64, 41);
for (const [x, y] of [[0,19],[7,7],[19,3],[26,12],[37,14],[4,26],[21,24],[34,25],[48,26],[52,20]]) {
  forestCover.sprite(x, y, fir, {t:'2d4c46', l:'8f9b64', m:'506e55', w:'74664d'});
}
forestCover.save('combat-cover-forest.png');

const mountainCover = new Pixels(64, 41);
for (const [x, y] of [[0,10],[14,2],[32,15],[8,22],[24,21],[45,23]]) {
  mountainCover.sprite(x, y, peak, stoneColors);
}
mountainCover.save('combat-cover-mountain.png');

const duskForest = new Pixels(140, 76);
for (const [x, y, shade] of [[4,8,0],[26,5,0],[46,12,0],[66,17,0],[11,27,1],[36,22,1],[58,32,1],[77,40,1],[103,43,1]]) {
  const colors = shade ? {t:'274842', l:'8ca375', m:'4e715d', w:'7c5c48'} :
    {t:'293f49', l:'618675', m:'45605b', w:'61524a'};
  duskForest.ellipse(x + 15, y + 28, 16, 3, '3e4843');
  duskForest.sprite(x, y, fir, colors, 2);
}
duskForest.save('volley-cover-forest.png');

const duskMountain = new Pixels(140, 76);
const shale = {t:'394350', l:'b4aa9f', h:'e4c6a8', r:'948b88', s:'687482', d:'4e6073'};
for (const [x, y, scale] of [[2,13,2],[35,3,2],[62,18,2],[17,40,1],[44,43,1],[67,41,1],[88,50,1],[112,56,1]]) {
  duskMountain.ellipse(x + 11*scale, y + 17*scale, 12*scale, 3*scale, '4a4a4b');
  duskMountain.sprite(x, y, peak, shale, scale);
}
duskMountain.save('volley-cover-mountain.png');

function drawHomeIcon(size) {
  const icon = new Pixels(size, size);
  const edge = position => Math.round(position * size / 32);
  const tile = (x, y, w, h, color) => icon.rect(edge(x), edge(y), edge(x + w) - edge(x), edge(y + h) - edge(y), color);
  tile(0, 0, 32, 32, '1c2638');
  tile(0, 0, 32, 9, '252e43');
  tile(0, 20, 32, 12, '192837');
  for (const x of [4, 12, 20, 28]) tile(x, 0, 1, 32, '2c3a4b');
  for (const y of [4, 12, 20, 28]) tile(0, y, 32, 1, '2c3a4b');

  // The flag sits above a stepped river, like a marker on the operations map.
  for (const [x, y, width] of [[0, 25, 6], [6, 26, 8], [14, 27, 7], [21, 26, 6], [27, 24, 5]]) {
    tile(x, y, width, 3, '306781');
    tile(x, y, width, 1, '51a0ae');
  }

  tile(8, 8, 5, 18, '111a28');
  tile(10, 8, 2, 16, 'f8d38b');
  tile(9, 7, 4, 2, 'ffeac0');
  tile(8, 23, 8, 2, 'ffcf77');
  tile(8, 25, 8, 1, 'a1693b');
  tile(12, 8, 7, 10, '141d2b');
  tile(19, 10, 6, 8, '141d2b');
  tile(12, 8, 6, 8, 'ffcc72');
  tile(18, 9, 5, 7, 'ffcc72');
  tile(23, 10, 2, 4, 'ffcc72');
  tile(12, 8, 6, 2, 'ffe5a7');
  tile(18, 9, 5, 1, 'ffe5a7');
  tile(12, 14, 6, 2, 'e5a853');
  tile(18, 14, 5, 2, 'e5a853');
  tile(23, 13, 2, 1, 'e5a853');
  icon.save(`home-icon-${size}.png`);
}

for (const size of [180, 192, 512]) drawHomeIcon(size);
