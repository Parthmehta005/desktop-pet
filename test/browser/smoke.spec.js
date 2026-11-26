import { test, expect } from '@playwright/test';
import { watchForErrors, openGallery } from './helpers.js';

test('the preview page loads cleanly', async ({ page }) => {
  const errors = watchForErrors(page);
  await openGallery(page);
  await expect(page).toHaveTitle('Desktop Pet preview');
  expect(errors).toEqual([]);
});

test('/ redirects to the preview page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/preview\/$/);
});
