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

const enemy = new Pixels(23,27);
enemy.sprite(0,0,infantryRows.map(row => [...row].reverse().join('')), {
  ...uniform, o:'3d2d2c', t:'b35343', h:'e08965', l:'8b423b', d:'683b36', j:'eadab0',
});
enemy.save('enemy-infantry.png');
