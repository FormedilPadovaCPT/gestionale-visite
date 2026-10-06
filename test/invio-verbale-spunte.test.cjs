// node test/invio-verbale-spunte.test.cjs
// (06/10/2026, chiesto dall'utente) «nell'invio verbale mi serve che il tecnico possa deselezionare delle mail di invio
// per escluderle dalla ricezione verbale». Ogni destinatario ha la sua spunta; la copia all'ufficio non si toglie;
// parte solo ai destinatari spuntati, e nel registro degli invii resta chi l'ha ricevuto davvero.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const pezzo = (re, cosa) => { const m = html.match(re); assert.ok(m, 'non trovo ' + cosa); return m[0]; };

/* ── l'elenco, su una finta pagina ── */
const blocco = pezzo(/const _evImpresa=[\s\S]*?\nfunction _evRenderList\(\)\{[\s\S]*?\n\}\n/, 'le spunte dei destinatari');
const box = { innerHTML: '' };
const win = {};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = new Function('window', '$', 'esc', blocco + '\nreturn { _evScelti, _evRenderList, _evImpresa };')(win, (id) => (id === 'email-verbale-list' ? box : null), esc);
win._evEmails = [
  { ruolo: 'Committente', nome: 'Rossi Mario', email: 'rossi@example.it' },
  { ruolo: 'CSE', nome: 'Bianchi', email: 'cse@example.it' },
  { ruolo: 'Impresa', nome: 'EDIL ALFA', email: 'alfa@example.it' },
  { ruolo: 'CPT', nome: 'Formedil Padova – Area Sicurezza', email: 'cpt@formedilpadova.it' },
];
f._evRenderList();
assert.strictEqual((box.innerHTML.match(/type="checkbox" data-ev-spunta=/g) || []).length, 4, 'una spunta per destinatario');
assert.strictEqual((box.innerHTML.match(/ checked /g) || []).length, 4, 'all’apertura sono tutti spuntati');
assert.ok(/data-ev-spunta="3" checked disabled/.test(box.innerHTML), 'la copia all’ufficio non si toglie');
assert.ok(!/Riceveranno/.test(box.innerHTML), 'tutti spuntati: nessun conteggio');

win._evSpunta(1, false); // il tecnico toglie il CSE
assert.deepStrictEqual(f._evScelti().map((e) => e.email), ['rossi@example.it', 'alfa@example.it', 'cpt@formedilpadova.it'], 'il CSE non riceve');
assert.ok(/data-ev-spunta="1"  title=/.test(box.innerHTML) && /non lo riceve/.test(box.innerHTML), 'la riga tolta si vede, senza spunta');
assert.ok(/Riceveranno il verbale <b>3<\/b> destinatari su 4/.test(box.innerHTML), 'il conteggio dice quanti lo ricevono');
win._evSpunta(3, false); // la copia all'ufficio resta
assert.ok(f._evScelti().some((e) => e.ruolo === 'CPT'), 'la copia all’ufficio non si toglie nemmeno a mano');

win._evSpunta(2, false); // tolta l'unica impresa
assert.ok(/Hai tolto la spunta a tutte le imprese/.test(box.innerHTML), 'senza imprese spuntate l’avviso lo dice');
win._evSpunta(2, true);
assert.ok(!/Hai tolto la spunta/.test(box.innerHTML));
win._evSpunta(1, true);
assert.strictEqual(f._evScelti().length, 4, 'rimessa la spunta, torna fra i destinatari');

/* ── l'invio ── */
const invia = pezzo(/\$\('btn-ev-invia'\)\.onclick=async\(\)=>\{[\s\S]*?\n\}\n/, 'il pulsante Invia ora');
assert.ok(/const emails=_evScelti\(\)\.map\(\(\{escluso,\.\.\.e\}\)=>e\)/.test(invia), 'parte solo ai destinatari spuntati');
assert.ok(/to: emails\.map\(e=>e\.email\)/.test(invia), 'a send-verbale vanno solo loro');
assert.ok(/email_dest:emails\.map\(e=>e\.email\),\n\s*dest:emails,/.test(invia), 'nel registro degli invii resta chi l’ha ricevuto davvero');
assert.ok(/if\(!emails\.some\(_evImpresa\)&&tutti\.some\(_evImpresa\)\)\{toast\('Hai tolto la spunta a tutte le imprese/.test(invia), 'senza imprese spuntate l’invio non parte');

/* ── «+ Aggiungi» di un indirizzo già in elenco ma senza spunta lo rimette ── */
assert.ok(/if\(gia&&gia\.escluso\)\{gia\.escluso=false;/.test(html));
/* ── la rettifica usa lo stesso elenco ── */
const rett = pezzo(/function apriEmailRettifica\(p\)\{[\s\S]*?\n\}\n/, 'apriEmailRettifica');
assert.ok(/window\._evEmails=emails\n  _evRenderList\(\)/.test(rett) && !/email-verbale-list/.test(rett), 'anche in rettifica si spunta');

console.log('ok — invio del verbale: il tecnico toglie la spunta a chi non deve riceverlo');
