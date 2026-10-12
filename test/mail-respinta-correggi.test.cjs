// node test/mail-respinta-correggi.test.cjs
// (12/10/2026, chiesto dall'utente) «Verbale non consegnato»: il più delle volte l'indirizzo è scritto male.
// Dal riquadro il tecnico lo corregge (mail_respinta_correggi: visita del rimbalzo + anagrafica) e il verbale
// si ritrasmette SOLO all'indirizzo corretto, con la copia all'ufficio; la riga del registro è «reinvio»,
// il rimbalzo si chiude da solo, e una rettifica futura va a tutti, con gli indirizzi corretti.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const box = fs.readFileSync(process.env.RESPINTE_JS || path.join(dir, 'mail-respinte-tec.js'), 'utf8').replace(/\r\n/g, '\n');

/* il riquadro: il pulsante, la funzione del database, la domanda prima di ritrasmettere */
assert.ok(/data-resp-corr="\$\{r\.id\}"/.test(box), 'nel riquadro c’è «Correggi indirizzo»');
assert.ok(/\$\{r\.visita_id \? `<button[^`]*data-resp-corr/.test(box), 'solo se il rimbalzo sa di quale visita è');
assert.ok(/rpc\('mail_respinta_correggi', \{ p_id: id, p_nuova: pulita \}\)/.test(box), 'la correzione la fa il database');
assert.ok(/if \(confirm\(`\$\{fatto\}\\n\\nVuoi ritrasmettere il verbale/.test(box), 'prima di ritrasmettere si chiede');
assert.ok(/window\.reinviaVerbaleA\(r\.visita_id, \{ email: esito\.nuova/.test(box), 'si ritrasmette all’indirizzo NUOVO');
assert.ok(/p_note: nota \+ ' Verbale non ritrasmesso\.'/.test(box), 'se non si ritrasmette, il rimbalzo si chiude dicendolo');
assert.ok(/'visita_id, ruolo,|nr_verbale, visita_id, ruolo/.test(box), 'la lettura porta la visita');

/* la finestra d'invio */
assert.ok(/window\.reinviaVerbaleA=async function\(vid,dest,opz\)\{/.test(html), 'c’è la ritrasmissione');
assert.ok(/window\._evEmails=\[\{ruolo:dest\.ruolo\|\|'Destinatario',nome:dest\.nome\|\|'',email:dest\.email\},\.\.\.\(cpt\?\[cpt\]:\[\]\)\]/.test(html),
  'destinatari: il solo indirizzo corretto più la copia all’ufficio');
assert.ok(/if\(!window\._evContext\|\|window\._evContext\.vid!==vid\)return/.test(html), 'se la finestra non si è aperta su quella visita, non si tocca niente');
assert.ok(/const _reinvio=window\._evReinvio&&window\._evReinvio\.vid===vid\?window\._evReinvio:null/.test(html), 'la ritrasmissione vale solo per la sua visita');
assert.ok(/tipo:_ret\?'rettifica':_reinvio\?'reinvio':'invio'/.test(html), 'nel registro degli invii è un «reinvio»');
assert.ok(/sb\.rpc\('s_mail_respinta_chiudi',\{p_id:_reinvio\.respintaId,p_stato:'risolta'/.test(html), 'partito l’invio, il rimbalzo si chiude');
assert.ok(/window\._evRettifica=null;window\._evReinvio=null;_setEvModalRett\(false\)/.test(html), 'chiudendo la finestra la ritrasmissione si azzera');
assert.ok(/async function inviEmailVerbaleFromList\(vid\)\{\n\s+window\._evReinvio=null/.test(html), 'un invio normale dall’elenco non eredita la ritrasmissione');

/* la rettifica: dall'ultimo invio completo, con gli indirizzi corretti */
assert.ok(/\.eq\('visita_id',vid\)\.eq\('inviato_email',true\)\.or\('tipo\.is\.null,tipo\.neq\.reinvio'\)/.test(html), 'la rettifica non parte dal reinvio a un solo indirizzo');
assert.ok(/from\('mail_correzioni'\)\.select\('vecchia,nuova'\)/.test(html), 'la rettifica sostituisce gli indirizzi corretti');
assert.ok(/if\(eCor\)\{toast\('Non sono riuscito a leggere gli indirizzi corretti/.test(html), 'una lettura fallita si dice');

console.log('mail-respinta-correggi: ok');
