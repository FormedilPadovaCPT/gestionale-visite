// node test/verbale-verifica.test.cjs
// (13/10/2026, lotto 3 del fascicolo corso digitale) Nella pagina Formazione l'RPF dichiara pronto il progetto
// formativo dell'edizione e prepara/completa il verbale di verifica finale. Qui: le scritture passano dalle RPC,
// lo scrutinio lo fotografa il database (non la maschera), il PDF viene da documenti-corso, i pezzi stanno dove devono.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const fc = leggi('formazione-corsi.js');
const f = leggi('formazione.js');
const index = leggi('index.html');
const deploy = leggi('.github/workflows/deploy-pages.yml');

assert.ok(/window\.formazioneCorsi = \{ box \}/.test(fc), 'formazione-corsi.js espone box');
assert.ok(/window\.formazioneCorsi\.box\(hc, R\)/.test(f), 'formazione.js lo chiama');
// le scritture passano dalle RPC
for (const r of ['corso_progetto_stato', 'corso_verbale_prepara', 'corso_verbale_salva', 'corso_verbale_stato']) {
  assert.ok(fc.includes(`'${r}'`), `RPC ${r} usata`);
}
assert.ok(!/from\('s_corsi(_verbali_verifica)?'\)\.(insert|update|delete|upsert)/.test(fc), 'nessuna scrittura diretta su corsi e verbali');
// lo scrutinio lo fotografa il database: la maschera corregge, non calcola
assert.ok(/data-v-prepara/.test(fc) && /'📋 Prepara'/.test(fc), 'il verbale si prepara dal database');
assert.ok(/scrutinio: scr\.map\(\(r, i\) =>/.test(fc) && /ammesso: tr\.querySelector\('\[data-r-amm\]'\)\.checked, verifica: tr\.querySelector\('\[data-r-ver\]'\)\.value/.test(fc), 'la maschera corregge ammissione ed esito per riga');
assert.ok(/for \(const k of Object\.keys\(ora\)\) if \(JSON\.stringify\(ora\[k\]\) !== JSON\.stringify\(letto\[k\]\)\) p\[k\] = ora\[k\];/.test(fc), 'solo i campi cambiati');
assert.ok(/if \(Object\.keys\(p\)\.length === 1\) return false;/.test(fc), 'aprire e salvare senza toccare non scrive');
assert.ok(/\(com'è scritto\)/.test(fc), 'una verifica fuori elenco si mostra com\'è scritta');
// il PDF
assert.ok(/functions\.invoke\('documenti-corso', \{ body: \{ azione, id \} \}\)/.test(fc), 'il PDF viene da documenti-corso');
assert.ok(/pdf\('progetto_formativo'/.test(fc) && /pdf\('verbale_verifica'/.test(fc), 'progetto e verbale');
assert.ok(/const w = window\.open\('', '_blank'\);/.test(fc), 'la scheda del PDF si apre prima dell\'attesa');
// chi vede: solo RPF e segreteria
assert.ok(/if \(!host \|\| !R \|\| !R\.capo\) \{ if \(host\) host\.innerHTML = ''; return; \}/.test(fc), 'il riquadro è dell\'RPF (e della segreteria)');
// errori detti, testi dal DB con esc()
assert.ok(/Non sono riuscito a leggere i corsi: \$\{esc\(e\.message\)\}/.test(fc), 'un errore di lettura si dice');
for (const campo of ['c.titolo', 'r.nominativo', 'e.nominativo', 'e.message']) assert.ok(fc.includes('esc(' + campo + ')'), `${campo} passa da esc()`);
// pubblicazione
assert.ok(deploy.includes("      - 'formazione-corsi.js'") && /for f in [^\n]*\bformazione-corsi\.js\b/.test(deploy), 'formazione-corsi.js nei due punti di deploy-pages.yml');
assert.ok(/<script src="formazione-corsi\.js\?v=\d+"><\/script>/.test(index), 'caricato da index.html');
assert.ok(index.indexOf('<script src="formazione.js?v=') < index.indexOf('<script src="formazione-corsi.js?v='), 'dopo formazione.js');
const v = Number((index.match(/<script src="formazione\.js\?v=(\d+)"/) || [])[1] || 0);
assert.ok(v >= 3, 'formazione.js?v= alzato per il lotto 3');
console.log('verbale-verifica: ok');
