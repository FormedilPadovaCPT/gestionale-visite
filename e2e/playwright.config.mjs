// Prove nel browser del gestionale visite (04/10/2026).
// Primo passo: il sito pubblicato si apre senza errori, da telefono e da
// computer, e mostra la maschera d'accesso. Le prove che entrano nell'app
// (es. «apri e salva senza toccare = nessuna modifica») aspettano un database
// di prova: sul database vero le prove finiscono nell'XML nazionale.
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
