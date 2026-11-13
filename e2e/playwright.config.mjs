// Prove nel browser del gestionale visite (04/10/2026).
// Primo passo: il sito pubblicato si apre senza errori, da telefono e da
// computer, e mostra la maschera d'accesso. Dal 13/11/2026 una prova entra
// nell'app con l'account di prova (prove/verbale-a-secco.spec.mjs): lavora a
// secco e il database rifiuta ogni scrittura di quell'account. Le prove che
// SCRIVONO davvero (es. «apri e salva senza toccare = nessuna modifica»)
// aspettano ancora un database di prova.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './prove',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.INDIRIZZO_APP || 'https://formedilpadovacpt.github.io/gestionale-visite/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
    { name: 'computer', use: { ...devices['Desktop Chrome'] } },
  ],
});
