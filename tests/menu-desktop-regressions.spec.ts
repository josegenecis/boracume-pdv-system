import { expect, Page, test } from 'playwright/test';

const defaultUserId = process.env.MENU_TEST_USER_ID || 'd15f067d-a0db-4fdc-9487-b210474e5f2e';
const productCardAddButtons = 'div.bg-white.rounded-2xl.shadow-sm.border.border-boracume-light button';

async function openFirstVariationDialog(page: Page) {
  const buttons = page.locator(productCardAddButtons);
  const total = Math.min(await buttons.count(), 8);

  for (let index = 0; index < total; index += 1) {
    await buttons.nth(index).click();
    const dialog = page.getByRole('dialog').last();
    try {
      await dialog.waitFor({ state: 'visible', timeout: 1500 });
      if (await dialog.getByText(/Personalize seu pedido/i).count()) {
        return dialog;
      }
      const addButton = dialog.getByRole('button', { name: /Adicionar/i });
      if (await addButton.count()) {
        await addButton.click();
      }
    } catch {}
  }

  throw new Error('Nenhum produto com modal de complementos foi encontrado.');
}

async function addAnyItemToCart(page: Page) {
  const buttons = page.locator(productCardAddButtons);
  const total = Math.min(await buttons.count(), 6);

  for (let index = 0; index < total; index += 1) {
    await buttons.nth(index).click();
    const dialog = page.getByRole('dialog').last();
    try {
      await dialog.waitFor({ state: 'visible', timeout: 1200 });
      const addButton = dialog.getByRole('button', { name: /Adicionar/i });
      if (await addButton.count()) {
        await addButton.click();
        return;
      }
    } catch {}

    if (await page.getByText(/Ver carrinho/i).count()) {
      return;
    }
  }

  throw new Error('Nao foi possivel adicionar item ao carrinho.');
}

async function getLastDialogScrollMetrics(page: Page) {
  return page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const dialog = dialogs.at(-1);
    const scroller = dialog?.querySelector<HTMLElement>('.overflow-y-auto');
    if (!dialog || !scroller) return null;

    const dialogRect = dialog.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    return {
      dialogTop: dialogRect.top,
      dialogBottom: dialogRect.bottom,
      dialogHeight: dialogRect.height,
      scrollerHeight: scrollerRect.height,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      viewportHeight: window.innerHeight,
    };
  });
}

async function scrollLastDialog(page: Page, deltaY = 900) {
  await page.locator('[role="dialog"] .overflow-y-auto').last().hover();
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(200);
}

test('Desktop mantém rolagem interna em complementos e checkout', async ({ page, baseURL }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Teste especifico para desktop.');

  await page.goto(`${baseURL}/menu/${defaultUserId}`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/buscar/i).waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);

  const variationDialog = await openFirstVariationDialog(page);
  await variationDialog.waitFor({ state: 'visible' });

  const variationBefore = await getLastDialogScrollMetrics(page);
  expect(variationBefore).not.toBeNull();
  expect(variationBefore!.scrollHeight).toBeGreaterThan(variationBefore!.clientHeight);

  await scrollLastDialog(page);

  const variationAfter = await getLastDialogScrollMetrics(page);
  expect(variationAfter!.scrollTop).toBeGreaterThan(0);

  await variationDialog.getByRole('button', { name: /Adicionar/i }).click();
  await page.getByText(/Ver carrinho/i).click();

  const bagDialog = page.getByRole('dialog').last();
  await bagDialog.waitFor({ state: 'visible' });
  await bagDialog.getByRole('button', { name: /Continuar/i }).click();

  const checkoutDialog = page.getByRole('dialog').last();
  await checkoutDialog.waitFor({ state: 'visible' });

  const checkoutBefore = await getLastDialogScrollMetrics(page);
  expect(checkoutBefore).not.toBeNull();
  expect(checkoutBefore!.scrollHeight).toBeGreaterThan(checkoutBefore!.clientHeight);

  await scrollLastDialog(page);

  const checkoutAfter = await getLastDialogScrollMetrics(page);
  expect(checkoutAfter!.scrollTop).toBeGreaterThan(0);
});

test('PIX abre QR Code mesmo quando a forma de pagamento vem do banco com UUID', async ({ page, baseURL }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Fluxo validado no desktop.');

  let pixCheckoutRequests = 0;
  let orderInsertRequests = 0;

  await page.route('**/rest/v1/payment_methods*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'uuid-pix-123', name: 'PIX', is_card: false, extra_fee_percent: 0, icon: null },
        { id: 'uuid-card-123', name: 'Cartão de Crédito', is_card: true, extra_fee_percent: 0, icon: null },
        { id: 'uuid-cash-123', name: 'Dinheiro', is_card: false, extra_fee_percent: 0, icon: null },
      ]),
    });
  });

  await page.route('**/pix-start-checkout**', async (route) => {
    if (route.request().method() === 'POST') {
      pixCheckoutRequests += 1;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        correlationID: 'cid-test',
        brCode: '000201010212',
        qrCodeImage: '',
        paymentLinkUrl: 'https://example.com/pay',
      }),
    });
  });

  await page.route('**/rest/v1/pix_checkouts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'CREATED', order_id: null }),
    });
  });

  await page.route('**/rest/v1/orders*', async (route) => {
    if (route.request().method() === 'POST') {
      orderInsertRequests += 1;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'order-test-1' }]),
    });
  });

  await page.route('**/rest/v1/customers*', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'customer-test-1' }]),
    });
  });

  await page.goto(`${baseURL}/menu/${defaultUserId}`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/buscar/i).waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);

  await addAnyItemToCart(page);

  await page.getByText(/Ver carrinho/i).click();
  const bagDialog = page.getByRole('dialog').last();
  await bagDialog.waitFor({ state: 'visible' });
  await bagDialog.getByRole('button', { name: /Continuar/i }).click();

  const checkoutDialog = page.getByRole('dialog').last();
  await checkoutDialog.waitFor({ state: 'visible' });

  await checkoutDialog.getByPlaceholder('(11) 99999-9999').fill('(11) 97777-1234');
  await page.waitForTimeout(700);
  await checkoutDialog.getByPlaceholder('Seu nome completo').fill('Cliente Teste');
  await checkoutDialog.getByPlaceholder(/Rua/i).fill('Rua A, 10, Centro');

  const zoneSelect = page.locator('[role="combobox"]').last();
  if (await zoneSelect.count()) {
    await zoneSelect.click();
    await page.getByRole('option').first().click();
  }

  await expect(checkoutDialog.getByRole('button', { name: 'Finalizar Pedido' })).toBeEnabled();
  await checkoutDialog.getByRole('button', { name: 'Finalizar Pedido' }).click();

  await expect(page.getByRole('dialog').getByText(/Pagamento via PIX/i)).toBeVisible();
  expect(pixCheckoutRequests).toBe(1);
  expect(orderInsertRequests).toBe(0);
});
