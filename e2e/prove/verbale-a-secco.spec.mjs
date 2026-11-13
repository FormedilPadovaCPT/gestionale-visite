// (13/11/2026) LA PROVA CHE ENTRA NELL'APP. Con l'account di prova: accesso, le pagine si
// aprono, la maschera del verbale si compila e «Salva bozza» arriva a scrivere il verbale.
// Niente arriva al database, per due protezioni indipendenti:
//   1. tools/prova_a_secco.js ferma le scritture nel browser (e lo scenario lo VERIFICA
//      con una scrittura innocua prima di toccare la maschera);
//   2. il database rifiuta ogni scrittura dell'account di prova
//      (supabase/sql/2026_11_13_account_prova_non_scrive.sql).
// Per questo la prova gira sul database vero, cosa che fino a oggi non si faceva.
//
// ⚠️ Questo repository è PUBBLICO, e lo sono i log e il rapporto di Playwright:
//   - niente traccia, schermate o video (conterrebbero la password e i dati dell'app);
//   - i messaggi delle asserzioni sono generici: il dettaglio di che cosa non è andato
//     finisce in esito-scenario-*.json, che il workflow porta nel verdetto (database).
//
// Senza le credenziali (secret E2E_EMAIL ed E2E_PASSWORD) la prova si salta, e lo dice.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
/* l'unico accesso con cui questa prova ha il permesso di premere «Salva»: è quello che il
   database ferma. Con qualunque altro ci si rifiuta, anche se il secret fosse sbagliato. */
const ACCOUNT_DI_PROVA = 'prova.tecnico@did.formedilpadova.it';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('con l\'account di prova: accesso, pagine, verbale salvato a secco', async ({ page }, info) => {
  const fileEsito = path.join(qui, '..', `esito-scenario-${info.project.name}.json`);
  const scrivi = (o) => fs.writeFileSync(fileEsito, JSON.stringify({ progetto: info.project.name, ...o }));
  if (!EMAIL || !PASSWORD) { scrivi({ saltata: 'secret E2E_EMAIL / E2E_PASSWORD non configurati' }); }
  test.skip(!EMAIL || !PASSWORD, 'credenziali dell\'account di prova non configurate');
  test.setTimeout(180_000);

  const errori = [];
  page.on('pageerror', (e) => errori.push(String(e.message).slice(0, 300)));
  let esito = { ok: false, errore: 'non partita' };
  try {
    expect(EMAIL.toLowerCase(), 'il secret E2E_EMAIL non è l\'account di prova').toBe(ACCOUNT_DI_PROVA);

    await page.goto('./', { waitUntil: 'networkidle' });
    await page.locator('#l-email').fill(EMAIL);
    await page.locator('#l-pwd').fill(PASSWORD);
    await page.locator('#btn-login').click();
    const entrato = await page.waitForFunction(
      () => window.S && window.S.appReady === true && window.S.user && window.sb && window.__app,
      null, { timeout: 60_000 }).then(() => true).catch(() => false);
    if (!entrato) {
      const aVideo = await page.locator('#login-err').textContent().catch(() => '');
      esito = { ok: false, errore: 'accesso non riuscito', aVideo: String(aVideo || '').slice(0, 200) };
      throw new Error('accesso');
    }
    const chi = await page.evaluate(() => String(window.S.user.email || '').toLowerCase());
    if (chi !== ACCOUNT_DI_PROVA) { esito = { ok: false, errore: 'entrato con un account diverso da quello di prova: mi fermo' }; throw new Error('account'); }

    await page.addScriptTag({ path: path.join(qui, '..', '..', 'tools', 'prova_a_secco.js') });
    await page.addScriptTag({ path: path.join(qui, '..', 'scenario-verbale.js') });
    esito = await page.evaluate(() => window.__scenarioVerbale({ salva: true }));
  } catch (e) {
    if (esito.errore === 'non partita') esito = { ok: false, errore: 'eccezione della prova: ' + String(e && e.message).slice(0, 300) };
  } finally {
    scrivi({ ...esito, erroriJavaScript: errori });
  }

  // messaggi generici: i log sono pubblici, il dettaglio sta nel verdetto
  expect(esito.ok, 'lo scenario del verbale a secco non è riuscito (dettaglio nel verdetto, nel database)').toBe(true);
  expect((esito.scritture || []).includes('POST /rest/v1/visite'), '«Salva bozza» non ha scritto il verbale').toBe(true);
  expect(errori.length, 'errori JavaScript non gestiti durante lo scenario (dettaglio nel verdetto)').toBe(0);
});
