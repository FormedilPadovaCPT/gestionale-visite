// node test/checklist-nomi-gruppi.test.cjs
// (06/10/2026, chiesto dall'utente) La check-list a video deve avere i nomi giusti dei gruppi, come il verbale; e la
// nota generale di un gruppo, che una «nuova visita da verbale» copia dal verbale precedente, deve vedersi e potersi
// cambiare (verbale CPT/26_27/0008: dodici note invisibili finite nel PDF).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8');
const pdf = fs.readFileSync(path.join(dir, 'verbale-pdf.js'), 'utf8');

/* ── un solo elenco di nomi, uguale a video e nel PDF ── */
const leggi = (src, re, cosa) => { const m = src.match(re); assert.ok(m, 'non trovo PREF_LBL in ' + cosa); return JSON.parse(JSON.stringify(vm.runInNewContext('(' + m[1] + ')'))); };
const schermo = leggi(dati, /const PREF_LBL=(\{[\s\S]*?\n\})/, 'app-data.js');
const stampa = leggi(pdf, /const PREF_LBL = (\{[^\n]*\})/, 'verbale-pdf.js');
assert.deepStrictEqual(stampa, schermo, 'schermo e PDF devono dare ai gruppi lo stesso nome');
// i 44 gruppi di checklist_voci (06/10/2026): nessuno senza nome
const GRUPPI = ['IMP_LOG', 'IMP_IGS', 'IMP_ELE', 'IMP_AGI', 'IMP_ORG', 'IMP_SEG', 'IMP_CON', 'PLL_SCA', 'PLL_DEM', 'PLL_OCA', 'PLL_PER',
  'SOL_GRU', 'SOL_AUT', 'SOL_ARG', 'SOL_ASO', 'SOL_PIA', 'ASU_ATT', 'ASU_SCA', 'ASU_UTE', 'MAC_MMT', 'MAC_MMM', 'MAC_MAS',
  'OPE_POF', 'OPE_POS', 'OPE_POC', 'OPE_POT', 'OPE_DPC', 'PIN_IND', 'PIN_TES', 'PIN_PIE', 'PIN_MAN', 'PIN_UDI', 'PIN_CAD', 'PIN_OCC', 'PIN_RES',
  'DOC_GEN', 'DOC_GEN_SOL', 'DOC_MA4', 'DOC_ELE', 'DOC_PON', 'SOG_FIG', 'FOR_BAS', 'FOR_FIG', 'FOR_RIS', 'FOR_ATM'];
for (const g of GRUPPI) assert.ok(schermo[g], 'il gruppo ' + g + ' non ha un nome');
// i nomi che erano scambiati, verificati sulle voci del gruppo
assert.strictEqual(schermo.OPE_POS, 'Ponteggi sospesi', 'colonne montanti, impalcati… : ponteggi sospesi (a video era «Ponti su cavalletti»)');
assert.strictEqual(schermo.OPE_POC, 'Ponti su cavalletti', 'cavalletti (a video era «Ponti su ruote»)');
assert.strictEqual(schermo.OPE_POT, 'Ponti su ruote – trabattelli', 'ruote, stabilizzatori (a video era «Ponteggi tubolari»)');
assert.strictEqual(schermo.MAC_MAS, 'Macchine stradali', 'rullo, fresatrice, vibrofinitrice (nel PDF era «Macchine movimento terra»)');
assert.strictEqual(schermo.MAC_MMT, 'Macchine movimento terra', 'dumper, escavatore, pala (nel PDF era «Macchine stradali»)');
assert.strictEqual(schermo.PLL_OCA, 'Opere in c.a.', 'casserature, puntelli (nel PDF era «Altre aree di pericolo»)');
assert.strictEqual(schermo.PLL_PER, 'Altre aree di pericolo', 'aperture verso il vuoto (nel PDF era «Opere in c.a.»)');
assert.strictEqual(schermo.SOL_ASO, 'Accessori di sollevamento', 'fasce, benna, forche');
assert.strictEqual(schermo.IMP_CON, 'Condizioni al contorno');

/* ── la nota generale del gruppo ── */
const m = html.match(/function _notaGruppoHtml\(pref,items\)\{[\s\S]*?\n\}\n/);
assert.ok(m, 'non trovo _notaGruppoHtml');
assert.ok(/\$\{_notaGruppoHtml\(pref,items\)\}/.test(html), 'la nota si disegna in fondo a ogni gruppo');
assert.ok(!/voce-nota separata: nascosta/.test(html), 'la voce di nota del gruppo non è più nascosta');
const S = { noteChk: { IMP_LOG_N: 'Non oggetto di verifica <oggi> & domani' } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = new Function('S', 'PREF_LBL', 'esc', m[0] + '\nreturn _notaGruppoHtml;')(S, schermo, esc);
const voci = [{ codice: 'IMP_LOG_001', is_nota: false }, { codice: 'IMP_LOG_N', is_nota: true, descrizione: 'Note Logistica' }];
let h = f('IMP_LOG', voci);
assert.ok(/<details class="nota-gruppo" data-nota-gruppo="IMP_LOG_N" open/.test(h), 'con un testo la nota è aperta e si vede');
assert.ok(/<textarea data-nota="IMP_LOG_N"/.test(h), 'è un campo che il gestionale già salva (textarea[data-nota])');
assert.ok(h.includes('Non oggetto di verifica &lt;oggi> &amp; domani'), 'il testo si mostra senza diventare codice');
assert.ok(/«Logistica»/.test(h), 'col nome del gruppo');
S.noteChk.IMP_LOG_N = '';
h = f('IMP_LOG', voci);
assert.ok(!/ open /.test(h) && /\+ Nota generale/.test(h), 'vuota: chiusa, si apre se serve');
assert.strictEqual(f('IMP_LOG', [voci[0]]), '', 'un gruppo senza voce di nota non disegna niente');
h = f('DOC_GEN_SOL', [{ codice: 'DOC_GEN_SOL_011', is_nota: true, descrizione: 'Note Apparecchi di sollevamento' }, { codice: 'DOC_GEN_SOL_N', is_nota: true, descrizione: 'Note Doc. sollevamento' }]);
assert.ok(/— Apparecchi di sollevamento/.test(h) && /— Doc\. sollevamento/.test(h), 'se un gruppo ne ha due, si distinguono');

console.log('ok — nomi dei gruppi uguali a video e nel PDF, note dei gruppi visibili e modificabili');
