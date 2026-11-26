// Shared helpers for browser tests.

/**
 * Collects console errors, page errors and failed requests for a page so a test can
 * assert there were none.
 */
export function watchForErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
  });
  return errors;
}

export async function openGallery(page, query = '') {
  await page.goto(`/preview/${query}`);
  await page.locator('#gallery[data-ready="true"]').waitFor({ state: 'attached' });
}
