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
  '.....onssnnssnnnno.....',
  '.....onsfsnssfsnno.....',
  '.....onfffnsfffnno.....',
  '......osffssffso.......',
  '.......osssssoo........',
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
  s:'d49264', f:'ffd4a1', j:'ebbe60', p:'887550', b:'514941', y:'e2b669', a:'b9f2d9'};
const unit = new Pixels(46,54);
unit.sprite(0,0,infantryRows,uniform,2);
unit.rect(23,8,10,2,uniform.h);
unit.rect(27,6,5,2,uniform.a);
unit.rect(27,32,5,2,uniform.h);
unit.rect(27,34,2,2,uniform.a);
unit.save('infantry.png');

const enemyUniform = {
  ...uniform, o:'38272f', t:'b84f4d', h:'f4a479', l:'8d3d45', d:'663342', j:'f0deb0', a:'ffd3a2',
};
const enemy = new Pixels(46,54);
enemy.sprite(0,0,infantryRows.map(row => [...row].reverse().join('')), enemyUniform,2);
enemy.rect(13,8,10,2,enemyUniform.h);
enemy.rect(14,6,5,2,enemyUniform.a);
enemy.rect(13,32,5,2,enemyUniform.h);
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

// Stand, aim, fire, recoil, take a hit, duck. Each cell is 64 × 56 pixels.
const poses = [
  {head: [0, 0], arms: [0, 0], stance: 0},
  {head: [1, 0], arms: [1, -1], stance: 1},
  {head: [1, 0], arms: [2, -1], stance: 1},
  {head: [-1, -1], arms: [-1, -2], stance: 2},
  {head: [-2, 1], arms: [-1, 1], stance: 2},
  {head: [1, 3], arms: [1, 2], stance: 2},
];
for (const [name, palette] of [['ally', uniform], ['foe', enemyUniform]]) {
  const atlas = new Pixels(64, 56 * poses.length);
  for (const [index, {head, arms, stance}] of poses.entries()) {
    const top = index * 56;
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
  forestTile.ellipse(x + 17, y + 26, 14, 5, '365b48');
  forestTile.sprite(x, y, fir, {t:'254b43', l:'90b977', m:'4f815d', w:'80664d'},2);
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
for (const [x, y, scale] of [[-7,8,2],[25,1,2],[16,24,2],[0,43,1],[40,39,1],[31,47,1]]) {
  mountainTile.ellipse(x+11*scale,y+17*scale,12*scale,3*scale,'5c7164');
  mountainTile.sprite(x, y, peak, stoneColors, scale);
}
mountainTile.save('terrain-mountain.png');

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
