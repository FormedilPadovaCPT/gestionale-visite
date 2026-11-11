// node test/persone-omonimi.test.cjs
// (11/11/2026, chiesto dall'utente dal verbale CPT/26_27/0093) «Geom. Marco Carraro» e «Ing. Marco Carraro»
// sono due persone diverse. Il gestionale ora: lascia creare l'omonimo se qualcosa lo distingue; aggancia al
// riquadro del verbale la scheda scelta; senza scelta riconosce la scheda da e-mail, telefono e titolo, e se
// non si capisce quale sia non scrive su nessuna. Il codice fiscale il tecnico lo scrive solo dove manca.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const P = require(path.join(dir, 'persone-omonimi.js'));
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

const geom = { persona_id: 'g', titolo: 'geom.', nome: 'Marco', cognome: 'Carraro', email: 'info@carrarosicurezzacantieri.com', telefono: '340 3813287' };
const ing = { persona_id: 'i', titolo: 'Ing.', nome: 'Marco', cognome: 'Carraro' };
const MC = { nome: 'Marco', cognome: 'Carraro' };

/* scelta della scheda per il riquadro */
assert.strictEqual(P.scegli({ ...MC, titolo: 'Ing.' }, [geom, ing]).persona.persona_id, 'i', 'il titolo distingue gli omonimi');
assert.strictEqual(P.scegli({ ...MC, titolo: 'Ing.', tel: '3403813287' }, [geom, ing]).persona.persona_id, 'g', 'il telefono vince sul titolo');
assert.strictEqual(P.scegli({ ...MC, email: 'INFO@carrarosicurezzacantieri.com ' }, [geom, ing]).persona.persona_id, 'g', 'e-mail a maiuscole e spazi ignorati');
assert.strictEqual(P.scegli({ ...MC, sceltaId: 'i', email: 'info@carrarosicurezzacantieri.com' }, [geom, ing]).persona.persona_id, 'i', 'la scheda scelta nel riquadro vince su tutto');
assert.ok(P.scegli(MC, [geom, ing]).ambigua, 'due omonimi senza niente che li distingua: non si sceglie');
const t = P.scegli({ ...MC, titolo: 'Ing.' }, [geom]);
assert.ok(t.ambigua && t.motivo === 'titolo', 'una sola scheda col titolo diverso: forse un omonimo, non si tocca');
assert.strictEqual(P.scegli({ ...MC, titolo: 'Geom.' }, [geom]).persona.persona_id, 'g', '«geom.» e «Geom.» sono lo stesso titolo');
assert.strictEqual(P.scegli({ ...MC, titolo: 'Dott. Ing.' }, [ing]).persona.persona_id, 'i', '«Dott. Ing.» e «Ing.» non si escludono');
assert.strictEqual(P.scegli(MC, [geom]).persona.persona_id, 'g', 'una scheda sola senza conflitti: quella');
assert.strictEqual(P.scegli({ nome: 'Carraro', cognome: 'Marco' }, [geom]).persona.persona_id, 'g', 'nome e cognome scambiati');
assert.ok(P.scegli({ nome: 'Luca', cognome: 'Carraro' }, [geom, ing]).nessuna, 'nessuno con quel nome: si può creare');
assert.ok(P.scegli(MC, [{ ...ing, elimina: 1 }]).nessuna, 'le schede eliminate non contano');

/* creare l'omonimo */
assert.strictEqual(P.percheNonCreare({ titolo: 'Ing.', ...MC }, [geom]), '', 'l’Ing. si crea accanto al Geom.');
assert.ok(P.percheNonCreare({ titolo: 'Geom.', ...MC }, [geom]), 'identico al Geom.: non si crea');
assert.ok(P.percheNonCreare({ ...MC, email: 'altro@studio.it' }, [geom]) === '', 'un’e-mail diversa distingue');
assert.ok(/stessa persona/.test(P.percheNonCreare({ ...MC, titolo: 'Ing.', cf: 'CRRMRC80A01G224X' }, [{ ...geom, cf: 'CRRMRC80A01G224X' }])), 'stesso codice fiscale = stessa persona');

/* codice fiscale */
assert.strictEqual(P.cfProblema('RSSMRA80A01H501U', 'Mario', 'Rossi'), '', 'codice giusto');
assert.strictEqual(P.cfProblema('RSSMRA80A01H501U', 'Rossi', 'Mario'), '', 'nome e cognome scambiati: il database li gira');
assert.ok(P.cfProblema('RSSMRA80A01H501X', 'Mario', 'Rossi').grave, 'carattere di controllo sbagliato: grave');
assert.ok(P.cfProblema('RSSMRA80A01H501', 'Mario', 'Rossi').grave, '15 caratteri: grave');
const nonTorna = P.cfProblema('RSSMRA80A01H501U', 'Marco', 'Carraro');
assert.ok(nonTorna && !nonTorna.grave, 'lettere che non tornano col nome: si avvisa');
assert.strictEqual(P.cfScrivibile(false, ''), true, 'il tecnico scrive il codice dove manca');
assert.strictEqual(P.cfScrivibile(false, 'RSSMRA80A01H501U'), false, 'il tecnico non cambia un codice già scritto');
assert.strictEqual(P.cfScrivibile(true, 'RSSMRA80A01H501U'), true, 'la segreteria sì');

/* la pagina usa le regole */
assert.ok(html.includes('<script src="persone-omonimi.js?v='), 'la pagina carica persone-omonimi.js');
assert.ok(/window\._persScelta=\{\}/.test(html), 'la scelta riparte da zero a ogni verbale');
assert.ok(/if\(cfg\.ruolo&&r\.persona_id\)window\._persScelta\[cfg\.ruolo\]=r\.persona_id/.test(html), 'scegliendo dall’elenco la scheda si lega al riquadro');
assert.ok(/if\(cfg\.ruolo\)delete window\._persScelta\[cfg\.ruolo\]/.test(html), 'riscrivendo il nome la scelta si scioglie');
for (const r of ['presente', 'rl', 'csp', 'cse']) assert.ok(html.includes(`attachPersonAC({ruolo:'${r}',`), 'riquadro ' + r);
assert.ok(/const es=PersOmonimi\.scegli\(\{nome,cognome:cog,titolo,email,tel,sceltaId:sid\},trovate\)\n\s+if\(es\.ambigua\)\{/.test(html), 'il salvataggio del verbale sceglie la scheda con la regola degli omonimi');
assert.ok(!/const r=ex\[0\],upd=\{\}/.test(html), 'non si prende più la prima scheda col nome');
assert.ok(/if\(r\.error\)throw r\.error/.test(html), 'una lettura dell’anagrafica fallita non è «nessuno»');
assert.ok(/if\(sc==='nuova'\)\{nuovaPersona\(ruolo\);return\}/.test(html), 'dal doppio clic si può creare l’omonimo');
assert.ok(/PersOmonimi\.percheNonCreare\(/.test(html), '«Nuova persona» crea l’omonimo solo se qualcosa lo distingue');
assert.ok(/\$\('mp-cf'\)\.disabled=!PersOmonimi\.cfScrivibile\(coord,r\.cf\)/.test(html), 'scheda: codice fiscale scrivibile dove manca');
assert.ok(/if\(pb&&pb\.grave\)\{toast\(pb\.motivo/.test(html), 'un codice fiscale sbagliato non si salva');
assert.ok(/\.eq\('cf',_cfNuovo\)/.test(html), 'si controlla che il codice non sia di un’altra scheda');

console.log('persone-omonimi: ok');
