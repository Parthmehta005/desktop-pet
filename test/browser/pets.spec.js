// Every pet shares one footprint so walking, dropping and landing line up, and each has
// its own signature animation.
import { test, expect } from '@playwright/test';
import { PET_DEFINITIONS } from '../../src/renderer/pets/index.js';
import { GROUND_Y } from '../../src/renderer/rig.js';
import { openGallery } from './helpers.js';

const SIGNATURE = {
  cat: 'cat-ear-twitch',
  penguin: 'penguin-flap-l',
  bluepanda: 'panda-tail',
  bee: 'bee-buzz',
  bat: 'bat-flutter',
};

// The box every pet must stand in (viewBox units), with feet on the ground.
const FOOTPRINT = { left: 26, right: 182, top: 30, bottom: 190 };

test('every drawn pet has a signature animation listed here', () => {
  expect(Object.keys(SIGNATURE).sort()).toEqual(Object.keys(PET_DEFINITIONS).sort());
});

for (const petId of Object.keys(PET_DEFINITIONS)) {
  test(`${petId}: stands on the shared ground line inside the shared footprint`, async ({ page }) => {
    await openGallery(page, `?pet=${petId}`);
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    const box = await page.locator('.states .cell[data-state="wander"] .pet-svg').evaluate((svg) => {
      const bbox = (sel) => svg.querySelector(sel).getBBox();
      const rig = bbox('.rig');
      const feet = [bbox('.foot-l'), bbox('.foot-r')];
      const body = bbox('.part.body');
      return {
        left: rig.x,
        right: rig.x + rig.width,
        top: rig.y,
        bottom: rig.y + rig.height,
        feetBottom: Math.max(...feet.map((f) => f.y + f.height)),
        bodyCenter: body.x + body.width / 2,
      };
    });
    expect(box.feetBottom, 'feet touch the ground').toBeGreaterThanOrEqual(GROUND_Y - 2);
    expect(box.feetBottom, 'feet touch the ground').toBeLessThanOrEqual(GROUND_Y + 4);
    expect(box.left).toBeGreaterThanOrEqual(FOOTPRINT.left);
    expect(box.right).toBeLessThanOrEqual(FOOTPRINT.right);
    expect(box.top).toBeGreaterThanOrEqual(FOOTPRINT.top);
    expect(box.bottom).toBeLessThanOrEqual(FOOTPRINT.bottom);
    expect(Math.abs(box.bodyCenter - 100), 'body is centred').toBeLessThanOrEqual(4);
  });

  test(`${petId}: shows its signature animation while wandering`, async ({ page }) => {
    await openGallery(page, `?pet=${petId}`);
    const names = await page.locator('.states .cell[data-state="wander"] .pet-svg').evaluate(
      (svg) => [...svg.querySelectorAll('*')].map((el) => getComputedStyle(el).animationName).filter((n) => n !== 'none'),
    );
    expect(names).toContain(SIGNATURE[petId]);
  });
}
