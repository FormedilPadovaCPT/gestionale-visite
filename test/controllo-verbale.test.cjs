// node test/controllo-verbale.test.cjs
const assert = require('assert');
const { analizza } = require('../controllo-verbale.js');
const base = { checklist: {}, noteChk: {}, dataVisita: '2026-09-10', oggi: '2026-09-17', accCant: '1' };
const chi = (d) => analizza({ ...base, ...d }).map((a) => a.chi);

// verbale pulito: nessun avviso
assert.deepStrictEqual(chi({ ossTec: 'Cantiere in fase di getto.' }), []);
// «tutto bene» senza rilievi va bene
assert.deepStrictEqual(chi({ ossTec: 'Nessun problema riscontrato' }), []);
// «tutto bene» con un'osservazione: avviso
assert.ok(chi({ checklist: { '3.1': 'OSS' }, ossTec: 'Va tutto bene', dataRitorno: '2026-10-02' }).includes('tutto-bene'));
assert.ok(chi({ checklist: { '3.1': 'NC+' }, noteChk: { '3.1': 'parapetto' }, noteLav: 'nessuna criticità', dataRitorno: '2026-09-13' }).includes('tutto-bene'));
// NC senza nota
assert.ok(chi({ checklist: { '3.1': 'NC-' }, dataRitorno: '2026-10-02' }).includes('nc-senza-nota'));
assert.ok(!chi({ checklist: { '3.1': 'NC-' }, noteChk: { '3.1': 'x' }, dataRitorno: '2026-10-02' }).includes('nc-senza-nota'));
// ritorno: la proposta Formedil esatta non avvisa
assert.deepStrictEqual(chi({ checklist: { a: 'NC+' }, noteChk: { a: 'x' }, dataRitorno: '2026-09-13' }), []);
assert.ok(chi({ checklist: { a: 'NC+' }, noteChk: { a: 'x' }, dataRitorno: '2026-11-13' }).includes('ritorno-tardi'));
assert.ok(chi({ checklist: { a: 'OSS' }, dataRitorno: '2026-09-01' }).includes('ritorno-prima'));
assert.ok(chi({ dataRitorno: '2026-10-01' }).includes('ritorno-non-dovuto'));
// 2° accesso con IPC basso: nessun rientro
assert.ok(chi({ accCant: '2', checklist: { a: 'OSS' }, dataRitorno: '2026-10-01' }).includes('ritorno-non-dovuto'));
// NC con la nota nel gruppo (…_N): nessun avviso
assert.ok(!chi({ checklist: { DOC_GEN_004: 'NC-' }, noteChk: { DOC_GEN_N: 'Non presente il POS' }, dataRitorno: '2026-10-02' }).includes('nc-senza-nota'));
assert.ok(chi({ checklist: { DOC_GEN_004: 'NC-' }, noteChk: { DOC_PON_N: 'altro gruppo' }, dataRitorno: '2026-10-02' }).includes('nc-senza-nota'));
// due tecnici diversi lo stesso giorno: normale
assert.deepStrictEqual(chi({ stessoGiorno: [{ nr_verbale: '0866', stessaImpresa: true, stessoTecnico: false }] }), []);
// stesso giorno
assert.deepStrictEqual(chi({ stessoGiorno: [{ nr_verbale: '0864', stessaImpresa: true }] }), ['doppione']);
assert.deepStrictEqual(chi({ stessoGiorno: [{ nr_verbale: '0864', stessaImpresa: false }] }), ['lotto']);
// persona presente
assert.deepStrictEqual(chi({ ppreNome: 'Rossi Mario' }), ['ppre-qualifica']);
assert.deepStrictEqual(chi({ ppreQual: 'Preposto' }), ['ppre-nome']);
// date e orari
assert.deepStrictEqual(chi({ dataVisita: '2026-09-20' }), ['data-futura']);
assert.deepStrictEqual(chi({ oraDa: '10:00', oraA: '09:30' }), ['orari']);

/* ── 03/10/2026, dal verbale CPT/26_27/0002 ── */
const CAON = 'Nel corso del sopralluogo non sono state rilevate non conformità in materia di salute e sicurezza; il cantiere risulta, per quanto verificato alla data odierna, correttamente organizzato e conforme alle misure di prevenzione e protezione previste.';
assert.ok(chi({ checklist: { a: 'OSS', b: 'OSS', c: 'OSS' }, ossTec: CAON, dataRitorno: '2026-10-02' }).includes('tutto-bene'), 'la frase di Caon con 3 OSS deve avvisare');
assert.deepStrictEqual(chi({ ossTec: CAON }), [], 'senza rilievi la stessa frase va bene');
assert.ok(chi({ checklist: { a: 'OSS' }, ossTec: 'Non si riscontrano criticità', dataRitorno: '2026-10-02' }).includes('tutto-bene'));
assert.ok(!chi({ checklist: { a: 'NC+' }, noteChk: { a: 'x' }, ossTec: 'Si rilevano le seguenti non conformità: parapetti assenti.', dataRitorno: '2026-09-13' }).includes('tutto-bene'), 'elencare le non conformità non è «tutto bene»');
// committente del verbale diverso da quello della scheda del cantiere
assert.deepStrictEqual(chi({ commVerbale: 'mccmkm82d63z127g', commCantiere: 'PRVNCI87B16G224Q' }), ['committente-cantiere']);
assert.deepStrictEqual(chi({ commVerbale: 'prvnci87b16g224q', commCantiere: 'PRVNCI87B16G224Q' }), [], 'maiuscole e minuscole non contano');
assert.deepStrictEqual(chi({ commVerbale: 'MCCMKM82D63Z127G', commCantiere: 'MBCOSTRUZIONISRLS' }), [], 'un identificativo che non è CF né P.IVA non si confronta');
assert.deepStrictEqual(chi({ commVerbale: '', commCantiere: 'PRVNCI87B16G224Q' }), []);
assert.deepStrictEqual(chi({ commCantiereErrore: 'rete assente' }), ['controllo-non-fatto'], 'una lettura fallita si dice');
// figure: refuso nel cognome, titoli diversi
const F = (ruolo, titolo, nome, cog) => ({ ruolo, titolo, nome, cog });
assert.deepStrictEqual(chi({ figure: [F('rl', 'Arch.', 'Mario', 'Bortolomami'), F('csp', 'Dott.', 'Mario', 'Bortolami'), F('cse', 'Dott.', 'Mario', 'Bortolami')] }), ['nomi-simili'], 'un avviso solo per lo stesso refuso');
assert.deepStrictEqual(chi({ figure: [F('rl', 'Arch.', 'Mario', 'Bortolami'), F('csp', 'Dott.', 'Mario', 'Bortolami')] }), ['titoli-diversi']);
assert.deepStrictEqual(chi({ figure: [F('rl', 'Geom.', 'Luca', 'Perrotta'), F('csp', 'Geom', 'Luca', 'Perrotta'), F('cse', 'Geom.', 'Luca', 'Perrotta')] }), [], 'il punto finale del titolo non conta');
assert.deepStrictEqual(chi({ figure: [F('rl', '', 'Mario', 'Rossi'), F('csp', '', 'Mario', 'Russo')] }), ['nomi-simili']);
assert.deepStrictEqual(chi({ figure: [F('rl', '', 'Mario', 'Rossi'), F('csp', '', 'Mario', 'Bianchi')] }), [], 'cognomi diversi: due persone');
assert.deepStrictEqual(chi({ figure: [F('rl', '', 'Mario', 'Bo'), F('csp', '', 'Mario', 'Ba')] }), [], 'cognomi troppo corti per dirlo');

console.log('controllo-verbale: tutti i casi passano');
