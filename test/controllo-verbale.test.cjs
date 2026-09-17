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
console.log('controllo-verbale: tutti i casi passano');
