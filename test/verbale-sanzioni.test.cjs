// node test/verbale-sanzioni.test.cjs
// (03/11/2026, deciso dall'utente) ipotesi di sanzione del verbale: dati di legge da sanzioni-voci.js (foglio v02),
// voci dello stesso punto dell'allegato = una violazione, x2/x3 per i lavoratori dell'impresa principale,
// sospensione (Allegato I), crediti della patente col tetto del doppio della più grave, avviso 231 con NC+.
const assert = require('assert');
require('../sanzioni-voci.js');
const V = require('../verbale-pdf.js');
const D = globalThis.SANZIONI_VOCI;
const st = (cod, val, lav) => V.stimaSanzioni(cod.map((c) => ({ codice: c, val: val || 'NC-' })), D, lav);
const tondo = (n) => Math.round(n * 100) / 100;

// il file di dati è completo e coerente
for (const [c, z] of Object.entries(D.voci)) {
  assert.ok(['sicuro', 'ipotesi', 'nessuna'].includes(z.certezza), c);
  if (z.certezza === 'nessuna') { assert.ok(!z.max, c); continue; }
  assert.ok(z.precetto && z.sanz && z.pena, c);
  assert.ok(z.max > 0 && z.ridotta > 0 && z.ridotta < z.max, c);
  assert.ok(['penale', 'amministrativa'].includes(z.natura), c);
  if (z.certezza === 'ipotesi') assert.ok(z.ipotesi, c + ': ipotesi senza spiegazione');
  for (const k of z.rif || []) assert.ok(D.estratti[k], c + ': estratto ' + k);
  if (z.sosp) assert.ok(z.sosp_desc && z.sosp_somma > 0, c);
}

// servizi igienici: docce (punto 2) e spogliatoi (punto 1) sono due violazioni, acqua e refettorio (punto 4) una
let s = st(['IMP_IGS_003', 'IMP_IGS_004', 'IMP_IGS_001', 'IMP_IGS_006']);
assert.strictEqual(s.voci, 4);
assert.strictEqual(s.violazioni, 3);
assert.strictEqual(s.unite, 1);
assert.strictEqual(s.max, tondo(3 * 2847.69));
assert.strictEqual(s.ridotta, tondo(3 * 711.92));

// tre voci del punto 3.1 dell'allegato VI: una violazione
s = st(['SOL_GRU_008', 'SOL_PIA_001', 'SOL_PIA_006']);
assert.strictEqual(s.violazioni, 1);

// formazione con 6 lavoratori: x2, sospensione 300 € a lavoratore, 2 crediti
s = st(['FOR_BAS_001'], 'NC-', 6);
assert.strictEqual(s.max, tondo(2 * 7403.96));
assert.strictEqual(s.molt, 2);
assert.deepStrictEqual(s.sospensioni.map((x) => [x.n, x.somma]), [['3', 1800]]);
assert.strictEqual(s.crediti, 2);
assert.strictEqual(st(['FOR_BAS_001'], 'NC-', 11).max, tondo(3 * 7403.96));
assert.strictEqual(st(['FOR_BAS_001'], 'NC-', 5).max, 7403.96);
assert.strictEqual(st(['FOR_BAS_001'], 'NC-', 0).sommaSosp, 300);   // lavoratori non indicati: almeno uno

// patente: 2 + 3 + 2 + 3 = 10 crediti, ma al massimo il doppio della più grave (3) = 6
s = st(['FOR_BAS_001', 'OPE_POF_003', 'IMP_ELE_005', 'DOC_GEN_004']);
assert.strictEqual(s.crediti, 6);
assert.strictEqual(s.sommaSosp, 300 + 2500 + 3000 + 3000);

// 231 solo con NC+ su una violazione penale
assert.strictEqual(st(['OPE_POF_003'], 'NC-').art231, false);
assert.strictEqual(st(['OPE_POF_003'], 'NC+').art231, true);

// (03/11/2026, chiesto dall'utente) nel riquadro in grassetto: caso più probabile, sospensione, patente, responsabilità dell'ente
const note = V.noteStima(st(['FOR_BAS_001', 'OPE_POF_003', 'PIN_TES_001'], 'NC+', 7)).join(' ');
for (const g of ['**il calcolo considera il caso più probabile**', "**Possibile sospensione dell'attività**", '**Patente a crediti**', "**responsabilità dell'ente**"]) assert.ok(note.includes(g), g);

// voce aggiunta alla checklist dopo l'ultimo giro dello script: non entra nel conto ma il verbale lo dice
s = st(['IMP_LOG_001', 'VOCE_NUOVA_999']);
assert.strictEqual(s.voci, 1);
assert.strictEqual(s.senzaDati, 1);
assert.strictEqual(st(['IMP_LOG_001']).senzaDati, 0);

// voce senza sanzione specifica: niente riquadro
assert.strictEqual(st(['DOC_GEN_008']), null);
assert.strictEqual(st([]), null);

// riga sotto il rilievo: certa senza asterisco, ipotesi con la spiegazione, sospensione e crediti
assert.ok(!V.rigaSanzione(D.voci.IMP_LOG_001).includes('*'));
assert.ok(V.rigaSanzione(D.voci.IMP_LOG_001).startsWith('Art. 109 c.1 D.Lgs. 81/2008 · sanzione Art. 159 c.2 lett. c)'));
assert.ok(V.rigaSanzione(D.voci.PIN_TES_001).includes('\n* Ipotesi: '));
assert.ok(/Possibile sospensione.*Allegato I n\. 7.*3 crediti in meno/.test(V.rigaSanzione(D.voci.OPE_POF_003)));
assert.ok(V.rigaSanzione(D.voci.DOC_GEN_008).startsWith('Nessuna sanzione specifica'));

// tutto ciò che finisce sul PDF si stampa col font helvetica (WinAnsi): niente «−», «≤» e simili
const WIN = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);
const fuori = (t) => [...String(t)].filter((c) => c.charCodeAt(0) > 255 && !WIN.has(c));
for (const [c, z] of Object.entries(D.voci)) assert.deepStrictEqual(fuori(V.rigaSanzione(z)), [], c);
for (const [k, e] of Object.entries(D.estratti)) assert.deepStrictEqual(fuori(e.testo + e.rubrica), [], 'estratto ' + k);
// e non porta all'impresa gli appunti di chi valida il foglio Excel
for (const [c, z] of Object.entries(D.voci)) assert.ok(!/come sopra|da confermare|da rivedere|da decidere|vedi colonna/i.test(V.rigaSanzione(z)), c + ': ' + V.rigaSanzione(z));

// prepara: col file di dati il verbale usa la stima nuova e non più gli importi vecchi della checklist
const voci = [
  { codice: 'IMP_IGS_003', zona_osserv: 1, prefisso: 'IMP_IGS', descrizione: 'Docce', articolo: 'Docce (art. 96 c 1, sanzione max 7.862,44)', importo_sanzione: 7862.44 },
  { codice: 'FOR_BAS_001', zona_osserv: 10, prefisso: 'FOR_BAS', descrizione: 'Formazione', articolo: 'vecchio', importo_sanzione: 6388.23 }
];
const base = { v: { data_visita: '2026-11-03', cantieri: {}, tecnici: {} }, imps: [{ nr_lav: 7, imprese: { impresa_nome: 'X' } }], lavs: [], voci,
  chk: [{ codice: 'IMP_IGS_003', valore: 'NC-' }, { codice: 'FOR_BAS_001', valore: 'NC+' }] };
const d = V.prepara(base);
assert.strictEqual(d.sanzione, null);
assert.strictEqual(d.stima.max, tondo(2847.69 + 2 * 7403.96));
assert.strictEqual(d.stima.lav, 7);
assert.ok(d.stima.riferimenti.some((e) => e.art === '37' && e.comma === '1'));
const righe = d.zone.flatMap((z) => z.gruppi.flatMap((g) => g.voci.map((x) => x.articolo)));
assert.ok(righe.every((t) => t.includes('D.Lgs. 81/2008 · sanzione')));
assert.ok(!righe.some((t) => t.includes('7.862,44')));

console.log('verbale-sanzioni: ok');
