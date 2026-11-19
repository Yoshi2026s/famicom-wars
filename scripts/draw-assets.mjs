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
  sprite(x, y, rows, colors) {
    rows.forEach((row, j) => {
      [...row].forEach((key, i) => {
        if (colors[key]) this.rect(x + i, y + j, 1, 1, colors[key]);
      });
    });
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
const map = new Pixels(200, 200);
// Continuous paths and patches of meadow are terrain decoration on this flat training map.
function pathX(y) {
  const points = [[0,151],[34,140],[56,118],[83,114],[109,92],[132,68],[154,65],[178,47],[200,37]];
  const i = points.findIndex(([height]) => height >= y);
  if (i <= 0) return points[0][1];
  const [a,b] = points[i-1], [c,d] = points[i];
  return Math.round(b + (d-b) * (y-a) / (c-a));
}
for (let y = 0; y < 200; y++) {
  const center = pathX(y);
  for (let x = 0; x < 200; x++) {
    const patch = Math.sin(x/15 + y/21) + Math.cos(x/19 - y/13) + .6 * Math.sin(y/9);
    const trail = Math.abs(x - center) + random(4);
    let color = patch > 1 ? 'baca7c' : patch < -.7 ? 'a0b96e' : 'adc575';
    if (trail < 9) color = ['d9ca8d','d7c689','d8c88b','dfd198'][random(4)];
    else if (trail < 12) color = 'c5c585';
    map.rect(x,y,1,1,color);
  }
}
for (let i = 0; i < 1800; i++) {
  const x = random(200), y = random(200);
  if (Math.abs(x-pathX(y)) < 11) {
    map.rect(x,y,random(3)+1,1,'c0b781');
  } else {
    map.rect(x,y,random(3)+1,1,['bed385','95b067','ccda92'][random(3)]);
    if (i % 6 === 0) {
      map.rect(x-1,y-1,1,2,'7e9e5b'); map.rect(x+1,y-2,1,3,'8ba760');
      map.rect(x+2,y-2,1,1,'cfda8b');
    }
  }
}
for (const [cx,cy] of [[17,12],[9,82],[175,26],[155,106],[29,143],[174,180],[89,49]]) {
  for (let i=0; i<10; i++) {
    const x=cx+random(13), y=cy+random(10);
    map.rect(x,y+1,1,2,'76974e'); map.rect(x-1,y,3,1,i%3 ? 'f7e5aa' : 'ecd477');
  }
}
for (const [x,y] of [[6,5],[17,7],[1,13],[11,16],[55,0],[183,1],[171,8],[185,13],
  [4,55],[9,64],[175,54],[185,62],[144,124],[153,129],[3,169],[11,177],[166,177],[176,183],[158,185]]) {
  map.rect(x+1,y+12,12,2,'91a767'); map.sprite(x,y,fir,treeColors);
}
for (const [x,y] of [[84,13],[90,16],[34,54],[151,77],[26,111],[120,148],[127,152],[78,179],[185,147]]) {
  map.sprite(x,y,rocks,rockColors);
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
const uniform = {o:'28392f', t:'418991', h:'79b6a8', l:'32636a', d:'335257', n:'795941',
  s:'d29a62', f:'f1c58b', j:'e8aa51', p:'8c8152', b:'5d5142', y:'d7b16a'};
const unit = new Pixels(23,27);
unit.sprite(0,0,infantryRows,uniform);
unit.save('infantry.png');

const enemyUniform = {
  ...uniform, o:'3d2d2c', t:'b35343', h:'e08965', l:'8b423b', d:'683b36', j:'eadab0',
};
const enemy = new Pixels(23,27);
enemy.sprite(0,0,infantryRows.map(row => [...row].reverse().join('')), enemyUniform);
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
for (const [name,palette] of [['combat-ally',uniform],['combat-foe',enemyUniform]]) {
  const figure = new Pixels(28,25);
  figure.sprite(0,0,profile,palette);
  figure.save(name + '.png');
}

// Keep the established map tiles independent of edits to the battle panorama.
seed = 779578159;
const forestTile = new Pixels(40, 40);
forestTile.rect(0, 0, 40, 40, '799b5b');
for (let i = 0; i < 92; i++) {
  forestTile.rect(random(40), random(40), 1 + random(3), 1, i % 2 ? '9daf68' : '64894e');
}
for (const [x, y] of [[-1,0],[11,-1],[25,1],[3,9],[17,8],[28,11],[9,20],[21,20],[0,25],[30,25]]) {
  forestTile.rect(x + 1, y + 12, 11, 2, '557b4c');
  forestTile.sprite(x, y, fir, {t:'315442', l:'81ad65', m:'537d4c', w:'766340'});
}
forestTile.save('terrain-forest.png');

const mountainTile = new Pixels(40, 40);
mountainTile.rect(0, 0, 40, 40, '9da56f');
for (let i = 0; i < 85; i++) {
  mountainTile.rect(random(40), random(40), 1 + random(3), 1, i % 2 ? 'b5bc84' : '818f65');
}
const peak = [
  '..........tt..........', '.........tllt.........', '.........tlst.........',
  '........tlhlst........', '.......tlhllsdt.......', '.......thhlsddt.......',
  '......thshlsdsdt......', '.....tlhllssdddt......', '.....tlrllssdsddt.....',
  '....tllrrlssdssddt....', '....tlrrllssddsddt....', '...tlllrlssdddssddt...',
  '..tllrllrssdsdddddtt..', '..tllrrrrssddssddddd..', '.tllrlrrsdsdddsddddtt.',
  'tllrllrsdsdddssddddddt', 'ttrrlrrssdddddddddddtt', '.ttrrrssdddttttttttt..',
];
const stoneColors = {t:'566759', l:'c3c6ac', h:'e4e5c8', r:'a5ac9e', s:'929e96', d:'707d7c'};
for (const [x, y] of [[-1,5],[15,1],[8,17],[23,19]]) {
  mountainTile.sprite(x, y, peak, stoneColors);
}
mountainTile.save('terrain-mountain.png');

const vista = new Pixels(360, 168);
for (const [top, end, color] of [
  [0, 15, '364867'], [15, 27, '56627d'], [27, 40, '867589'], [40, 52, 'bc8588'],
  [52, 63, 'df9c89'], [63, 80, 'f0b391'], [80, 168, 'f5c99b'],
]) {
  vista.rect(0, top, 360, end - top, color);
}
for (let y = 36; y <= 79; y++) {
  const halfWidth = Math.floor(Math.sqrt(Math.max(0, 22 ** 2 - (y - 58) ** 2)));
  vista.rect(184 - halfWidth, y, 2 * halfWidth + 1, 1, y < 63 ? 'ffe4a8' : 'f6cb95');
}
for (const [x, y, width] of [[10,33,50],[62,22,48],[104,49,30],[144,17,49],[228,28,43],[270,48,60],[322,20,32]]) {
  vista.rect(x, y, width, 2, 'c7a0a0');
  vista.rect(x + 4, y - 2, width - 10, 2, 'dcae9e');
  vista.rect(x + 12, y - 4, width - 20, 2, 'e1b4a2');
}
for (let x = 0; x < 360; x++) {
  const ridge = 73 + Math.round(7 * Math.sin(x / 18) + 8 * Math.cos(x / 39) + 2 * Math.sin(x / 6));
  const near = 92 + Math.round(6 * Math.sin(x / 21 + 2) + 4 * Math.cos(x / 11));
  vista.rect(x, ridge, 1, 108 - ridge, '897985');
  vista.rect(x, ridge + 2, 1, 2, 'a08a8c');
  vista.rect(x, near, 1, 117 - near, '526a67');
  vista.rect(x, near, 1, 1, '7c8b76');
}
for (let x = -4; x < 360; x += 6 + random(7)) {
  const y = 85 + random(12);
  vista.sprite(x, y, fir, {t:'3c5557', l:'788b72', m:'59766a', w:'595c50'});
}
for (let x = 0; x < 360; x++) {
  const hill = 109 + Math.round(3 * Math.sin(x / 17));
  const track = 126 + Math.round(2 * Math.sin(x / 27));
  const foreground = 156 + Math.round(4 * Math.cos(x / 23));
  vista.rect(x, hill, 1, 168 - hill, '9a9a64');
  vista.rect(x, hill, 1, 2, 'bcc185');
  vista.rect(x, track, 1, 18, 'c5a779');
  vista.rect(x, track, 1, 2, 'dbc08e');
  vista.rect(x, track + 16, 1, 3, 'a18360');
  vista.rect(x, foreground, 1, 168 - foreground, '6b7955');
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
