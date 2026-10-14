// node test/pagina-docente.test.cjs
// (14/10/2026, lotto 5 del fascicolo corso digitale) La pagina del docente per il corso: incarico da accettare,
// giornate con le firme dal QR da confermare per allievo, presenze a mano, argomenti, aggiunta dell'allievo PRIMA
// della firma (mansione obbligatoria), firma del registro della giornata. Qui: tutto passa dalle RPC e da
// firma-documenti, i pezzi stanno dove devono, i testi dal DB passano da esc().
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const fd = leggi('formazione-docente.js');
const f = leggi('formazione.js');
const index = leggi('index.html');
const deploy = leggi('.github/workflows/deploy-pages.yml');

assert.ok(/window\.formazioneDocente = \{ box \}/.test(fd), 'formazione-docente.js espone box');
assert.ok(/window\.formazioneDocente\.box\(hd, R\)/.test(f), 'formazione.js lo chiama');
// solo RPC e firma-documenti: nessuna lettura o scrittura diretta sulle tabelle dei corsi
for (const r of ['corso_docente_corsi', 'corso_docente_giornata', 'corso_docente_cerca_persona', 'corso_docente_cerca_impresa',
  'corso_docente_aggiungi_allievo', 'corso_docente_presenza', 'corso_docente_argomenti', 'corso_docente_registro_pronto',
  'pres_conferma', 'pres_conferma_allievo']) {
  assert.ok(fd.includes(`'${r}'`), `RPC ${r} usata`);
}
assert.ok(!/\.from\('s_corsi/.test(fd) && !/\.from\('persone/.test(fd), 'nessuna lettura diretta delle tabelle');
assert.ok(/azione: 'accetta_incarico', id: Number\(b\.dataset\.fdAccetta\)/.test(fd), 'l\'accettazione passa da firma-documenti');
// (14/10/2026) il docente firma la lettera stessa per accettazione: la riga «mia» della catena
assert.ok(/const mia = k\.mia;/.test(fd) && /mia\.stato === 'in_attesa'/.test(fd) && /«✍️ Le mie firme»/.test(fd), 'la lettera da firmare rimanda al riquadro delle firme');
assert.ok(/apriLink\(k\.lettera\.file, 'apri la lettera firmata'\)/.test(fd), 'a incarico accettato la lettera firmata si riapre');
assert.ok(/azione: 'firma_registro', id: gid/.test(fd), 'la firma del registro passa da firma-documenti');
assert.ok(/corso_docente_registro_pronto', \{ p_giornata: gid \}/.test(fd) && /Il registro non si può ancora firmare/.test(fd), 'prima di firmare si chiede al database che cosa manca');
// la conferma è per allievo, con le fuori orario una per una
assert.ok(/data-fd-conf-all="\$\{i\.id\}"/.test(fd) && /pres_conferma_allievo', \{ p_iscritto_id: Number\(b\.dataset\.fdConfAll\), p_giornata_id: gid \}/.test(fd), '«✓ Confermo» per allievo');
assert.ok(/data-fd-conf="\$\{f\.id\}"/.test(fd) && /data-fd-resp="\$\{f\.id\}"/.test(fd), 'ogni firma si conferma o respinge da sola');
assert.ok(/const nota = prompt\('Perché la respingi\?/.test(fd), 'chi respinge scrive una parola');
// l'allievo si aggiunge prima della firma, con la mansione
assert.ok(/if \(!p\.mansione\) \{ avviso\('La mansione è obbligatoria\.', 'err'\); return; \}/.test(fd), 'mansione obbligatoria anche nella maschera');
assert.ok(/Dagli questo codice per firmare dal telefono/.test(fd), 'il codice personale si mostra subito');
assert.ok(/out\.ripubblicato \? 'Il corso è stato rimandato al portale/.test(fd), 'si dice se il portale è stato aggiornato o no');
// errori detti, testi dal DB con esc()
assert.ok(/Non sono riuscito a leggere i corsi: \$\{esc\(e\.message\)\}/.test(fd), 'un errore di lettura si dice');
for (const campo of ['c.titolo', 'i.nominativo', 'i.impresa_txt || \'—\'', 'e.message', 'error.message', 'p.cognome', 'im.ragione_sociale', 'out.nominativo', 'f.note']) {
  assert.ok(fd.includes('esc(' + campo + ')'), `${campo} passa da esc()`);
}
// pulsanti che il server rifiuterebbe non si disegnano a chi non è docente del corso
assert.ok(/const mio = !!corso\.mio \|\| !!R\.segr;/.test(fd) && /\$\{mio \? '<button type="button" class="btn-primary btn-sm" id="fd-firma"/.test(fd), 'la firma del registro solo al docente del corso');
assert.ok(/const posso = c\.mio && !g\.firmato_da_me/.test(fd), '«Firmo il registro» solo se tocca a me');
// pubblicazione
assert.ok(deploy.includes("      - 'formazione-docente.js'") && /for f in [^\n]*\bformazione-docente\.js\b/.test(deploy), 'formazione-docente.js nei due punti di deploy-pages.yml');
assert.ok(/<script src="formazione-docente\.js\?v=\d+"><\/script>/.test(index), 'caricato da index.html');
assert.ok(index.indexOf('<script src="formazione.js?v=') < index.indexOf('<script src="formazione-docente.js?v='), 'dopo formazione.js');
const v = Number((index.match(/<script src="formazione\.js\?v=(\d+)"/) || [])[1] || 0);
assert.ok(v >= 4, 'formazione.js?v= alzato per il lotto 5');
console.log('pagina-docente: ok');
