import { test, expect } from '@playwright/test';

test('Complementos carregam em <1s após selecionar produto', async ({ page, baseURL }) => {
  const userId = process.env.MENU_TEST_USER_ID;
  test.skip(!userId, 'Defina MENU_TEST_USER_ID para executar este teste.');

  await page.addInitScript(() => {
    try {
      localStorage.setItem('boracume_perf_debug', '0');
      localStorage.setItem('boracume_perf_entries', '[]');
    } catch {}
  });

  await page.goto(`${baseURL}/menu/${userId}`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/buscar/i).waitFor({ state: 'visible' });

  await page.waitForTimeout(900);

  const firstAdd = page.getByRole('button', { name: /adicionar/i }).first();
  await firstAdd.click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });

  const started = Date.now();
  const personalize = dialog.getByText(/Personalize seu pedido/i);
  const noVars = dialog.getByText(/Nenhuma variação disponível/i);
  await Promise.race([
    personalize.waitFor({ state: 'visible', timeout: 1000 }),
    noVars.waitFor({ state: 'visible', timeout: 1000 })
  ]);
  expect(Date.now() - started).toBeLessThan(1000);
});
