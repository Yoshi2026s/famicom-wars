// Pins the damage swing to its middle so rule tests see each hit's expected damage.
// Tests that check the swing itself replace map.random on their own instance.
import BattleMap from '../public/rules.js';

BattleMap.prototype.random = () => .5;
