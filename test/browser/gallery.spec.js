import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { ANIMATION_STATE_IDS, MOODS } from '../../src/core/moods.js';
import { STATE_LOOKS } from '../../src/renderer/rig.js';
import { PROP_NAMES } from '../../src/renderer/props.js';
import { PET_DEFINITIONS } from '../../src/renderer/pets/index.js';
import { watchForErrors, openGallery } from './helpers.js';

const SHOTS = 'test-results/screenshots';
const RIG_PARTS = ['.rig', '.part.body', '.part.head', '.paw-l', '.paw-r', '.foot-l', '.foot-r', '.face', '.shadow'];

/** For one gallery cell: which eyes, mouths and props are actually displayed. */
function displayed(cell) {
  const shown = (el) => getComputedStyle(el).display !== 'none';
  const names = (selector, prefix) => [...cell.querySelectorAll(selector)]
    .filter(shown)
    .map((el) => [...el.classList].find((c) => c.startsWith(prefix)).slice(prefix.length));
  const bubble = cell.querySelector('.pet-bubble');
  return {
    eyes: names('.eyes', 'eyes-'),
    mouths: names('.mouth', 'mouth-').sort(),
    props: names('.prop', 'prop-').sort(),
    drops: [...cell.querySelectorAll('.drop')].filter(shown).length,
    bubble: bubble.hidden ? null : bubble.textContent,
  };
}

for (const petId of Object.keys(PET_DEFINITIONS)) {
  test.describe(`gallery: ${petId}`, () => {
    test('has exactly one cell per animation state, in order', async ({ page }) => {
      const errors = watchForErrors(page);
      await openGallery(page, `?pet=${petId}`);
      const states = await page.locator('.states .cell').evaluateAll((cells) => cells.map((c) => c.dataset.state));
      expect(states).toEqual([...ANIMATION_STATE_IDS]);
      expect(errors).toEqual([]);
    });

    test('every cell draws the rig with the right face, props and bubble', async ({ page }) => {
      const errors = watchForErrors(page);
      await openGallery(page, `?pet=${petId}`);
      for (const state of ANIMATION_STATE_IDS) {
        const cell = page.locator(`.states .cell[data-state="${state}"]`);
        for (const part of RIG_PARTS) {
          await expect(cell.locator(`.pet-svg ${part}`), `${state} ${part}`).toHaveCount(1);
        }
        const look = STATE_LOOKS[state];
        const seen = await cell.evaluate(displayed);
        expect(seen.eyes, `${state} eyes`).toEqual([look.eyes]);
        expect(seen.mouths, `${state} mouth`).toEqual(look.mouth === 'yawn' ? ['neutral', 'o'] : [look.mouth]);
        // Steam only shows at the top sweat level, so it's hidden in the intensity-1 cell.
        const expectedProps = look.props.filter((p) => p !== 'steam').sort();
        expect(seen.props, `${state} props`).toEqual(expectedProps);
        const bubble = state === 'meeting' ? null : MOODS[state]?.bubble ?? null;
        expect(seen.bubble, `${state} bubble`).toBe(bubble);
      }
      expect(errors).toEqual([]);
    });

    test('sweat grows with intensity and steam appears at level 3', async ({ page }) => {
      await openGallery(page, `?pet=${petId}`);
      const levels = await page.locator('.intensities .cell').evaluateAll((cells) => cells.map((c) => {
        const shown = (el) => getComputedStyle(el).display !== 'none';
        return {
          drops: [...c.querySelectorAll('.drop')].filter(shown).length,
          steam: shown(c.querySelector('.prop-steam')),
        };
      }));
      expect(levels).toEqual([
        { drops: 1, steam: false },
        { drops: 2, steam: false },
        { drops: 3, steam: true },
      ]);
    });

    test('props the state does not use stay hidden', async ({ page }) => {
      await openGallery(page, `?pet=${petId}`);
      const cell = page.locator('.states .cell[data-state="wander"]');
      const visible = await cell.evaluate((c, names) => names.filter(
        (n) => getComputedStyle(c.querySelector(`.prop-${n}`)).display !== 'none',
      ), PROP_NAMES);
      expect(visible).toEqual([]);
    });

    test('screenshots of every state on light and dark backgrounds', async ({ page }) => {
      await mkdir(`${SHOTS}/${petId}`, { recursive: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const bg of ['light', 'dark']) {
        await openGallery(page, `?pet=${petId}&bg=${bg}`);
        await page.waitForTimeout(400);
        await page.locator('#gallery').screenshot({ path: `${SHOTS}/gallery-${petId}-${bg}.png` });
      }
      for (const state of ANIMATION_STATE_IDS) {
        await page.locator(`.states .cell[data-state="${state}"]`).screenshot({ path: `${SHOTS}/${petId}/${state}.png` });
      }
    });
  });
}

test('the background toggle switches light and dark', async ({ page }) => {
  await openGallery(page);
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'light');
  await page.getByRole('button', { name: 'Dark background' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'dark');
  await expect(page).toHaveURL(/bg=dark/);
  await page.getByRole('button', { name: 'Light background' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'light');
});

test('the default view shows every pet, and the filter narrows it to one', async ({ page }) => {
  const errors = watchForErrors(page);
  await openGallery(page);
  const sections = await page.locator('.states').evaluateAll((s) => s.map((el) => el.dataset.pet));
  expect(sections).toEqual(Object.keys(PET_DEFINITIONS));
  await expect(page.locator('.states .cell')).toHaveCount(Object.keys(PET_DEFINITIONS).length * ANIMATION_STATE_IDS.length);
  await expect(page.locator('.intensities')).toHaveCount(0);

  await page.getByLabel('Pet', { exact: true }).selectOption('cat');
  await page.locator('#gallery[data-ready="true"]').waitFor({ state: 'attached' });
  await expect(page).toHaveURL(/pet=cat/);
  await expect(page.locator('.states')).toHaveCount(1);
  await expect(page.locator('.intensities .cell')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('an unknown pet id falls back to showing every pet', async ({ page }) => {
  await openGallery(page, '?pet=dragon');
  await expect(page.locator('.states')).toHaveCount(Object.keys(PET_DEFINITIONS).length);
});
