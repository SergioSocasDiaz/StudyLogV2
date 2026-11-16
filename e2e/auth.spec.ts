import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

declare const window: {
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
};

const PASSWORD = 'una-contraseña-segura';
const DISPLAY_NAME = 'E2E';

async function assertNoStorageTokens(page: Page) {
  const { localKeys, sessionKeys } = await page.evaluate(() => ({
    localKeys: Object.keys(window.localStorage),
    sessionKeys: Object.keys(window.sessionStorage),
  }));
  expect(localKeys).toEqual([]);
  expect(sessionKeys).toEqual([]);
}

test('an account can be registered, persists after reload and logs back in', async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`;

  await test.step('register a new account', async () => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1, name: 'Crea tu cuenta' })).toBeVisible();

    await page.getByLabel('Nombre visible').fill(DISPLAY_NAME);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
  });

  await test.step('land on /app with the personal greeting', async () => {
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { level: 1, name: /Hola, E2E/ })).toBeVisible();
    await assertNoStorageTokens(page);
  });

  await test.step('the session survives a page reload', async () => {
    await page.reload();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { level: 1, name: /Hola, E2E/ })).toBeVisible();
    await assertNoStorageTokens(page);
  });

  await test.step('logging out returns to the landing page', async () => {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
    await assertNoStorageTokens(page);
  });

  await test.step('/app without a session redirects to /login', async () => {
    await page.goto('/app');

    await expect(page).toHaveURL(/\/login\?.*returnTo/);
    await expect(page.getByRole('heading', { level: 1, name: 'Entra en StudyLog' })).toBeVisible();
  });

  await test.step('logging in again goes back to /app', async () => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { level: 1, name: /Hola, E2E/ })).toBeVisible();
    await assertNoStorageTokens(page);
  });
});

test('wrong credentials show an error and stay on /login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Entra en StudyLog' })).toBeVisible();

  await page.getByLabel('Email').fill(`nadie+${Date.now()}@example.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill('esta-contraseña-no-existe');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos.');
  await expect(page).toHaveURL(/\/login/);
});
