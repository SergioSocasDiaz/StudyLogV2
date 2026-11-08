import { expect, test } from '@playwright/test';

test('the landing page loads at /', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /sabes cuánto estudias/i }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/StudyLog/);
  await expect(page.getByRole('link', { name: 'StudyLog' })).toBeVisible();
});

test('unknown routes render the 404 page', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe');

  await expect(page.getByRole('heading', { level: 1, name: /esa página no existe/i })).toBeVisible();
});

test('the API healthcheck reports a connected database', async ({ request }) => {
  await expect
    .poll(async () => (await request.get('/api/health')).status(), {
      timeout: 60_000,
      intervals: [500, 1_000, 2_000],
    })
    .toBe(200);

  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'ok', database: 'up' });
});
