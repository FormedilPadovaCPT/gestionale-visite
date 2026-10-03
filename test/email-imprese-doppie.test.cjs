// node test/email-imprese-doppie.test.cjs
// (03/10/2026, sera) Lo stesso indirizzo e-mail non può stare su due imprese dello stesso verbale.
// Caso vero, verbale CPT/26_27/0003: a due lavoratori autonomi senza e-mail è stato scritto, nel campo
// «Email invio verbale», l'indirizzo dell'impresa principale. Il verbale è partito tre volte allo stesso
// indirizzo e quell'indirizzo è finito nelle schede dei due autonomi come se fosse il loro.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8');

const a = dati.indexOf('function mailImpreseDoppie(imprese,anag){'), b = dati.indexOf('// --- fine mailImpreseDoppie');
assert.ok(a > 0 && b > a, 'non trovo mailImpreseDoppie in app-data.js');
const ctx = vm.createContext({});
vm.runInContext(dati.slice(a, b) + '\nthis.f=mailImpreseDoppie', ctx);
const doppie = (imprese, anag) => JSON.parse(JSON.stringify(ctx.f(imprese, anag)));

const V = 'impresa@vettorazzo.example';
const anag = { '02443890286': [V, null, null], RAMPINMICHELE: [null, null, null], PELLICONENATALINO: [null, null, null] };
const righe = (r, p) => [
  { impresa_id: '02443890286', impresa_nome: 'VETTORAZZO COSTRUZIONI', email_verbale: '' },
  { impresa_id: 'RAMPINMICHELE', impresa_nome: 'Rampin Michele', email_verbale: r },
  { impresa_id: 'PELLICONENATALINO', impresa_nome: 'Pellicone Natalino', email_verbale: p }
];

// 1) il caso vero: l'indirizzo dell'impresa principale scritto sulle due righe degli autonomi
{
  const e = doppie(righe(V, ' ' + V.toUpperCase() + ' '), anag);
  assert.strictEqual(e.length, 2, 'le due righe con l’indirizzo di un’altra impresa vanno fermate tutte e due');
  assert.deepStrictEqual(e.map((x) => x.campo), ['im-email_verbale-1', 'im-email_verbale-2'], 'ogni errore porta al campo della sua riga');
  assert.ok(e.every((x) => x.cosa === 'email-doppia' && x.tab === 2 && /VETTORAZZO COSTRUZIONI/.test(x.testo)), 'il messaggio dice di chi è l’indirizzo');
  assert.ok(/Rampin Michele/.test(e[0].testo) && /Pellicone Natalino/.test(e[1].testo));
}
// 2) nessuno ha scritto niente: va bene (il verbale arriva a chi ha l'indirizzo in anagrafica)
assert.strictEqual(doppie(righe('', ''), anag).length, 0);
// 3) ognuno il suo indirizzo: va bene
assert.strictEqual(doppie(righe('rampin@example.it', 'pellicone@example.it'), anag).length, 0);
// 4) lo stesso indirizzo nuovo scritto su due righe: resta alla prima, la seconda si ferma
{
  const e = doppie(righe('studio@example.it', 'studio@example.it'), anag);
  assert.deepStrictEqual(e.map((x) => x.campo), ['im-email_verbale-2']);
  assert.ok(/Rampin Michele/.test(e[0].testo), 'dice quale riga lo ha già');
}
// 5) un'impresa che riscrive il PROPRIO indirizzo d'anagrafica non è un errore
{
  const r = righe('', ''); r[0].email_verbale = V;
  assert.strictEqual(doppie(r, anag).length, 0);
}
// 6) anagrafica non letta: si confrontano almeno gli indirizzi scritti, e non si inventa un errore
assert.strictEqual(doppie(righe(V, ''), null).length, 0, 'senza anagrafica non si può sapere: non si blocca a caso');
assert.strictEqual(doppie(righe('x@example.it', 'x@example.it'), null).length, 1);
// 7) una sola impresa, righe vuote, dati mancanti: niente errori e niente eccezioni
assert.strictEqual(doppie([{ impresa_id: 'A', email_verbale: V }], {}).length, 0);
assert.strictEqual(doppie([{ impresa_id: '', email_verbale: V }, null, { impresa_id: 'B', email_verbale: V }], {}).length, 0, 'una riga senza impresa non conta');
assert.strictEqual(doppie(null, null).length, 0);
// 8) maiuscole dell'identificativo: l'anagrafica è indicizzata in maiuscolo
assert.strictEqual(doppie([{ impresa_id: 'abc', impresa_nome: 'Abc', email_verbale: '' }, { impresa_id: 'def', impresa_nome: 'Def', email_verbale: 'a@b.it' }], { ABC: ['A@B.IT'] }).length, 1);

// ── la pagina applica la regola ─────────────────────────────────────────────────────────────────
const save = html.slice(html.indexOf('async function _saveVisitaCorpo(stato){'), html.indexOf('function buildSnap('));
const iBlocco = save.indexOf('mailImpreseDoppie(S.imprese,await _mailAnagImprese())');
assert.ok(iBlocco > 0, 'il salvataggio deve controllare gli indirizzi doppi');
assert.ok(iBlocco < save.indexOf("if(stato==='definitivo'){"), 'il controllo vale anche per la bozza: sta prima del ramo «definitivo»');
assert.ok(iBlocco < save.indexOf("sb.from('visite').insert(") && iBlocco < save.indexOf("sb.from('cantieri').update("), 'si ferma prima di scrivere qualunque cosa');
assert.ok(/if\(_mailDop\.length\)\{\s+mostraMancanze\(_mailDop,\{salvato:false,[\s\S]{0,400}?\}\)\s+return/.test(save), 'con un indirizzo doppio il salvataggio si ferma e mostra l’elenco');
// uscendo dal campo l'indirizzo viene tolto subito
assert.ok(html.includes('_em.onchange=()=>{mailImpresaControlla(idx)') && /im\.email_verbale=''\s+const el=\$\(`im-email_verbale-\$\{idx\}`\);if\(el\)el\.value=''\s+toast\(err\.testo,'err'/.test(html), 'il campo si controlla all’uscita');
// in anagrafica non entra un indirizzo che è già di un'altra impresa; nel dubbio non si scrive
const copia = save.slice(save.indexOf('entra in anagrafica, se lì non ce n'), save.indexOf('CHIUSURA. Fin qui il verbale è salvato'));
assert.ok(copia.includes(".neq('impresa_id',_id)") && /if\(_eGia\)\{[^\n]*continue\}/.test(copia) && /if\(_altra\)\{toast\([^\n]*continue\}/.test(copia), 'l’indirizzo di un’altra impresa non si copia nella scheda');
assert.ok(copia.indexOf('if(_altra){') < copia.indexOf("update({impresa_email_ref:_ev})"), 'il controllo viene prima della scrittura');
// lettura fallita dell'anagrafica ≠ nessun indirizzo
assert.ok(/if\(error\)\{console\.warn\('e-mail delle imprese non lette:',error\.message\);return null\}/.test(html), 'una lettura fallita rende null, non un elenco vuoto');
// i destinatari: lo stesso indirizzo fra le imprese una volta sola
assert.ok(html.includes("if(ev&&!emails.some(e=>e.ruolo==='Impresa'&&String(e.email||'').trim().toLowerCase()===ev.toLowerCase())) emails.push("), 'i destinatari uguali si mettono una volta');

console.log('email-imprese-doppie: ok');
