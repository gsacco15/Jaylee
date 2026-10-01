import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Brain } from '../public/dist/brain.js';
import { Yard } from '../public/dist/world.js';

const land = { medium: 'land', ball: 'none', timeInWater: 0 };
const fixed = () => 0.5;

test('a hot Jaylee wants the pool', () => {
  const b = new Brain(undefined, fixed);
  Object.assign(b.needs, { heat: 0.95, energy: 0.8, boredom: 0.2, curiosity: 0.1, affection: 0.1 });
  assert.equal(b.options(land)[0].intent.kind, 'swim');
});

test('an exhausted Jaylee rests and turns down zoomies', () => {
  const b = new Brain(undefined, () => 0.99);
  Object.assign(b.needs, { energy: 0.05, heat: 0.2, boredom: 0.5 });
  assert.equal(b.options(land)[0].intent.kind, 'rest');
  assert.equal(b.consider({ kind: 'zoomies' }, 'player', land).accept, false);
  assert.equal(b.consider({ kind: 'eatTreat' }, 'player', land).accept, true);
});

test('after a long cool swim she gets out', () => {
  const b = new Brain(undefined, fixed);
  Object.assign(b.needs, { heat: 0, energy: 0.4 });
  const top = b.options({ medium: 'water', ball: 'none', timeInWater: 60 })[0];
  assert.equal(top.intent.kind, 'leavePool');
});

test('needy Jaylee seeks attention; petting fixes it', () => {
  const b = new Brain(undefined, fixed);
  Object.assign(b.needs, { affection: 1, heat: 0.1, energy: 0.8, boredom: 0.1, curiosity: 0.1 });
  assert.equal(b.options(land)[0].intent.kind, 'seekAttention');
  b.feel({ type: 'petted' });
  assert.ok(b.needs.affection < 0.7);
});

test('needs drift with activity', () => {
  const b = new Brain(undefined, fixed);
  const e0 = b.needs.energy, h0 = b.needs.heat;
  b.tick(5, 'running', 'land');
  assert.ok(b.needs.energy < e0 && b.needs.heat > h0);
  b.tick(5, 'swimming', 'water');
  assert.ok(b.needs.heat < h0);
});

test('routes jump into the pool and walk around it', () => {
  const y = new Yard();
  const into = y.route({ x: 0.2, y: 0.5 }, 'land', { x: 0.7, y: 0.5 });
  assert.ok(into.some((l) => l.type === 'jump' && l.into === 'water'));
  const around = y.route({ x: 0.5, y: 0.5 }, 'land', { x: 0.95, y: 0.5 });
  assert.ok(around.length > 1, 'detours around the pool');
  for (const leg of around) assert.ok(!y.inPool(leg.to));
  const out = y.route({ x: 0.7, y: 0.5 }, 'water', { x: 0.2, y: 0.5 });
  assert.ok(out.some((l) => l.type === 'jump' && l.into === 'land'));
});
