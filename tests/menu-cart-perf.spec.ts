import { test, expect, chromium, Page } from '@playwright/test';

async function enable3G(page: Page) {
  const browser = page.context().browser();
  if (!browser) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 220,
    downloadThroughput: (1.2 * 1024 * 1024) / 8,
    uploadThroughput: (0.35 * 1024 * 1024) / 8
  });
}

test('Carrinho atualiza em <500ms em 95% (10 usuários)', async ({ baseURL }) => {
  const userId = process.env.MENU_TEST_USER_ID;
  test.skip(!userId, 'Defina MENU_TEST_USER_ID para executar este teste.');

  const browser = await chromium.launch();
  const results: number[] = [];

  const runOne = async (i: number) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await enable3G(page);

    await page.addInitScript(() => {
      try {
        localStorage.setItem('boracume_perf_debug', '0');
        localStorage.setItem('boracume_perf_entries', '[]');
      } catch {}
    });

    await page.goto(`${baseURL}/menu/${userId}`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/buscar/i).waitFor({ state: 'visible' });

    const firstAdd = page.getByRole('button', { name: /adicionar/i }).first();
    await firstAdd.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    const optionGroups = dialog.locator('div.border.rounded.p-3');
    const groupsCount = await optionGroups.count();
    for (let g = 0; g < groupsCount; g++) {
      const group = optionGroups.nth(g);
      const firstOptionRow = group.locator('div.cursor-pointer').first();
      if (await firstOptionRow.count()) {
        await firstOptionRow.click();
      }
    }

    const addBtn = dialog.getByRole('button', { name: /^Adicionar$/i });
    await addBtn.click();

    await page.getByRole('button', { name: /ver carrinho/i }).waitFor({ state: 'visible' });

    const ms = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('boracume_perf_entries') || '[]';
        const entries = JSON.parse(raw) as any[];
        const add = [...entries].reverse().find((e) => e?.name === 'menu.cart.add');
        return typeof add?.ms === 'number' ? add.ms : null;
      } catch {
        return null;
      }
    });

    await context.close();

    if (typeof ms === 'number') results[i] = ms;
    else results[i] = 9999;
  };

  await Promise.all(Array.from({ length: 10 }).map((_, i) => runOne(i)));
  await browser.close();

  const ok = results.filter((ms) => ms < 500).length;
  expect(ok).toBeGreaterThanOrEqual(9);
});
