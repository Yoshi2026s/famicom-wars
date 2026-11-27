// The eastern shore mirrors the western shore, including access to both bays.
const westernShore = [
  'ooooooooooooo',
  'ooohhooohhooo',
  'oohppphoooooo',
  'ohppfppphoooo',
  'ohpfmdppphooo',
  'ohpppdpffphoo',
  'ohpmpdpfsppho',
  'ohddddddddddd',
  'ohpffdpmpdpfm',
  'ohpppdpfpdpsm',
  'ohddddddddddd',
  'ohpppdpfsppho',
  'ohpppdpffphoo',
  'oohpmdppphooo',
  'ooohpppphoooo',
  'ooooohhhooooo',
  'ooooooooooooo',
  'ooooooooooooo',
];

const coastalHeadquarters = {x: 3, y: 9};
const homeFacilities = [
  ['city', 4, 8], ['city', 5, 10], ['factory', 4, 11],
  ['airfield', 5, 6], ['port', 4, 2], ['port', 6, 14],
];
const frontierFacilities = [
  ['city', 11, 10], ['factory', 10, 8], ['airfield', 10, 11], ['port', 10, 6],
];
const coastalStartingUnits = [
  ['scout', 4, 9], ['infantry', 7, 7], ['artillery', 5, 8],
  ['helicopter', 7, 5], ['patrol', 8, 2],
];

function reflectCoastalX(x) {
  return westernShore[0].length * 2 - 1 - x;
}

const coastalScenario = {
  id: 'coastal',
  name: '湾岸の攻防',
  terrain: westernShore.map(row => row + [...row].reverse().join('')),
  headquarters: {
    friendly: {...coastalHeadquarters},
    enemy: {...coastalHeadquarters, x: reflectCoastalX(coastalHeadquarters.x)},
  },
  sites: [
    ...homeFacilities.flatMap(([kind, x, y]) => [
      {kind, x, y, owner: 'friendly'}, {kind, x: reflectCoastalX(x), y, owner: 'enemy'},
    ]),
    ...frontierFacilities.flatMap(([kind, x, y]) => [
      {kind, x, y, owner: 'neutral'}, {kind, x: reflectCoastalX(x), y, owner: 'neutral'},
    ]),
  ],
  units: {
    friendly: coastalStartingUnits,
    enemy: coastalStartingUnits.map(([type, x, y]) => [type, reflectCoastalX(x), y]),
  },
};

if (typeof module !== 'undefined') module.exports = coastalScenario;
