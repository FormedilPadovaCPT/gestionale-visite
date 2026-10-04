// Il gestionale si apre: nessun errore JavaScript non gestito, la maschera
// d'accesso c'è e si può scrivere. È la prova che un deploy rotto o un
// index.html troncato non arrivino ai tecnici senza che nessuno se ne accorga.
import { test, expect } from '@playwright/test';

test('il gestionale si apre senza errori e mostra l\'accesso', async ({ page }) => {
  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));

  const risposta = await page.goto('./', { waitUntil: 'networkidle' });
  expect(risposta.status(), 'la pagina risponde').toBeLessThan(400);

  await expect(page.locator('#l-email')).toBeVisible();
  await expect(page.locator('#l-pwd')).toBeVisible();
  await page.locator('#l-email').fill('nessuno@esempio.invalid');
  await expect(page.locator('#l-email')).toHaveValue('nessuno@esempio.invalid');

  expect(errori, 'errori JavaScript non gestiti all\'apertura').toEqual([]);
});
