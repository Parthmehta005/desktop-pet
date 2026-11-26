import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripBounds, stripHeight, petSizePx, BASE_PET_SIZE, HEADROOM } from '../../src/core/layout.js';

test('pet size scales from the base size', () => {
  assert.equal(petSizePx(1), BASE_PET_SIZE);
  assert.equal(petSizePx(2), BASE_PET_SIZE * 2);
  assert.equal(petSizePx(0.5), BASE_PET_SIZE / 2);
  assert.equal(petSizePx(Number.NaN), BASE_PET_SIZE);
  assert.equal(petSizePx(-3), BASE_PET_SIZE);
  assert.equal(stripHeight(1), BASE_PET_SIZE + HEADROOM);
});

test('the strip spans the work area and sits on its bottom edge (above the taskbar)', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 }; // 40px taskbar below
  assert.deepEqual(stripBounds(workArea, 1), { x: 0, y: 1040 - 250, width: 1920, height: 250 });
});

test('works with a taskbar on the left or top, and on secondary-display coordinates', () => {
  assert.deepEqual(stripBounds({ x: 48, y: 0, width: 1872, height: 1080 }, 1), { x: 48, y: 830, width: 1872, height: 250 });
  assert.deepEqual(stripBounds({ x: 0, y: 40, width: 1920, height: 1040 }, 1), { x: 0, y: 830, width: 1920, height: 250 });
  assert.deepEqual(stripBounds({ x: -1280, y: 100, width: 1280, height: 984 }, 1), { x: -1280, y: 834, width: 1280, height: 250 });
});

test('a bigger pet gets a taller strip, never taller than the work area', () => {
  assert.equal(stripBounds({ x: 0, y: 0, width: 800, height: 1000 }, 2).height, 2 * BASE_PET_SIZE + HEADROOM);
  assert.deepEqual(stripBounds({ x: 0, y: 0, width: 800, height: 200 }, 2), { x: 0, y: 0, width: 800, height: 200 });
});

test('fractional work areas (display scaling) round to whole pixels', () => {
  const b = stripBounds({ x: 0.4, y: 0.2, width: 1536.6, height: 816.8 }, 1);
  for (const v of Object.values(b)) assert.ok(Number.isInteger(v));
});
