// node test/scheda-formativa.test.cjs
// (13/10/2026, lotto 2 del fascicolo corso digitale) Nella pagina Formazione il responsabile del progetto
// formativo tiene il catalogo delle tipologie e scrive la scheda formativa (o la delega a un docente).
// Qui: le maschere salvano SOLO i campi cambiati, le scritture passano dalle RPC, il PDF lo chiede alla
// funzione documenti-corso, e il docente delegato vede le sue schede.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const f = leggi('formazione.js');
const index = leggi('index.html');

assert.ok(/window\.formazione = \{ carica, badge, VOCI \}/.test(f), 'formazione.js espone carica, badge e le voci della scheda');
// le voci della scheda dell'Ufficio Corsi, una per una
for (const k of ['requisiti_precorso', 'nai_bes', 'modalita', 'metodologie', 'strumenti', 'verifica']) {
  assert.ok(new RegExp(`^    ${k}: \\[`, 'm').test(f), `VOCI.${k} c'è`);
}
assert.ok(/\['no_elearning', 'Non è ammesso l\\'e-learning/.test(f), 'la voce sull\'e-learning non ammesso');
assert.ok(/\['altro', 'Altro:'\]/.test(f), 'le sezioni con «Altro» hanno la voce libera');

// le scritture passano dalle RPC, mai insert/update diretti
assert.ok(/rpc\('tipologia_salva', \{ p \}\)/.test(f) && /rpc\('scheda_salva', \{ p \}\)/.test(f) && /rpc\('scheda_stato', \{ p_id: /.test(f), 'tipologie e schede si scrivono con le RPC');
assert.ok(!/from\('s_corsi_tipologie'\)\.(insert|update|delete|upsert)/.test(f) && !/from\('s_corsi_schede_formative'\)\.(insert|update|delete|upsert)/.test(f), 'nessuna scrittura diretta sulle tabelle');

// solo i campi cambiati (regola del 04/10/2026)
assert.ok(/if \(!t \|\| String\(ora\[k\]\) !== String\(letto\[k\]\)\) p\[k\] =/.test(f), 'la tipologia manda solo i campi cambiati');
assert.ok(/if \(JSON\.stringify\(ora\[k\]\) !== JSON\.stringify\(letto\[k\]\)\) p\[k\] = ora\[k\];/.test(f), 'la scheda manda solo i campi cambiati');
assert.ok(/if \(t && Object\.keys\(p\)\.length === 1\) \{ avviso\('Niente da salvare/.test(f) && /if \(Object\.keys\(p\)\.length === 1\) return \{ data: s, cambiato: false \};/.test(f), 'aprire e salvare senza toccare non scrive niente');
assert.ok(/\(com'è scritto\)/.test(f), 'una tendina con un valore fuori elenco lo mostra com\'è scritto');

// il PDF lo disegna la funzione, uguale per le due app
assert.ok(/functions\.invoke\('documenti-corso', \{ body: \{ azione: 'scheda_formativa', id \} \}\)/.test(f), 'il PDF viene da documenti-corso');
assert.ok(/const w = window\.open\('', '_blank'\);/.test(f), 'la scheda del PDF si apre subito (telefono) e poi prende il blob');

// chi vede che cosa
assert.ok(/const modificabile = \['bozza', 'pronta'\]\.includes\(s\.stato\) && \(R\.capo \|\| String\(s\.delegata_a \|\| ''\)\.toLowerCase\(\) === email\(\)\);/.test(f), 'modifica solo chi può: RPF/segreteria, o il delegato finché è bozza/pronta');
assert.ok(/const mie = _sch\.filter\(\(s\) => String\(s\.delegata_a \|\| ''\)\.toLowerCase\(\) === me && \['bozza', 'pronta'\]\.includes\(s\.stato\)\);/.test(f), 'il docente vede le schede delegate a lui');
assert.ok(/R\.capo \? campo\('Delegata al docente/.test(f), 'la delega la mette solo chi è capo (RPF o segreteria)');
assert.ok(/'Prima di dichiararla pronta|Dichiaro pronta la scheda\?/.test(f), '«Pronta» chiede conferma');

// la pagina c'è ancora, con le firme
assert.ok(/<section id="view-formazione" class="hidden">/.test(index), 'la vista Formazione');
// ogni testo dal database passa da esc()
for (const campo of ['t.titolo', 's.delegata_a', 'e.message', 't.codice']) {
  assert.ok(f.includes('esc(' + campo + ')'), `${campo} deve passare da esc()`);
}
const v = Number((index.match(/<script src="formazione\.js\?v=(\d+)"/) || [])[1] || 0);
assert.ok(v >= 2, 'formazione.js?v= alzato per il lotto 2');
console.log('scheda-formativa: ok');
