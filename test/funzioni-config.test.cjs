// (13/11/2026) verify_jwt di ogni funzione server sta in supabase/config.toml, non più
// solo nel pannello di Supabase. Qui si controlla che:
//  1. ogni cartella in supabase/functions abbia la sua riga (una funzione nuova non
//     si pubblica «come viene»);
//  2. le funzioni raggiungibili SENZA accesso siano esattamente quelle dell'elenco qui
//     sotto: aprirne una al pubblico vuol dire toccare questo file, cioè deciderlo.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.resolve(__dirname, '..');
const toml = fs.readFileSync(path.join(radice, 'supabase', 'config.toml'), 'utf8');
const config = {};
for (const m of toml.matchAll(/^\[functions\.([a-z0-9-]+)\]\s*\r?\nverify_jwt\s*=\s*(true|false)/gm)) config[m[1]] = m[2] === 'true';

/* si difendono da sé: biglietto firmato (chat-team, documenti-personale), parola
   d'ordine o accesso del coordinatore (promemoria-ricontrolli, push-visite), tetto
   di richieste (request-access) */
const SENZA_ACCESSO = ['chat-team', 'documenti-personale', 'promemoria-ricontrolli', 'push-visite', 'request-access'];

const cartelle = fs.readdirSync(path.join(radice, 'supabase', 'functions'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
assert.ok(cartelle.length >= 10, 'cartelle delle funzioni non lette');
assert.deepStrictEqual(cartelle.filter((c) => !(c in config)), [], 'funzioni senza riga in supabase/config.toml');
assert.deepStrictEqual(Object.keys(config).filter((c) => !cartelle.includes(c)), [], 'righe di config.toml senza cartella');
assert.deepStrictEqual(Object.keys(config).filter((k) => config[k] === false).sort(), [...SENZA_ACCESSO].sort(),
  'le funzioni senza accesso non sono quelle dichiarate');
console.log('funzioni-config: ' + cartelle.length + ' funzioni, ' + SENZA_ACCESSO.length + ' senza accesso');
