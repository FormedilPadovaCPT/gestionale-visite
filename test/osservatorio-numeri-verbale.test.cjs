// node test/osservatorio-numeri-verbale.test.cjs
// (05/10/2026) Nel controllo per l'Osservatorio, l'elenco dei cantieri da completare (e quello dei
// cantieri che escono con un «Non disponibile») mostra i NUMERI DI VERBALE delle visite del periodo,
// non solo quante sono: chiesto dall'utente per ritrovare il verbale. I numeri li manda il database
// (osservatorio_controllo, campo 'verbali' di ogni cantiere).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const oss = fs.readFileSync(path.join(radice, 'osservatorio.js'), 'utf8');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_05_osservatorio_controllo_verbali.sql'), 'utf8').replace(/\r\n/g, '\n');

/* ── il database: ogni cantiere porta i numeri di verbale del periodo, in ordine di data ── */
const blocco = sql.match(/'cantieri', case when not p_dettaglio[\s\S]*?end,\n/);
assert.ok(blocco, 'manca il blocco dei cantieri nella funzione');
assert.ok(/'verbali', \(select jsonb_agg\(x\.nr_verbale order by x\.data_visita, x\.nr_verbale\) from vd x where x\.cantiere_id = c\.cantiere_id\)/.test(blocco[0]),
  'ogni cantiere deve portare i numeri di verbale delle sue visite del periodo (da vd: solo definitive, solo nel periodo)');
assert.ok(/revoke execute on function public\.osservatorio_controllo\(date, date, boolean\) from public, anon;/.test(sql), 'permessi come prima');

/* ── la schermata ── */
const finestra = {};
const crea = new Function('window', oss.replace('export function creaOsservatorio', 'function creaOsservatorio') + '\nreturn creaOsservatorio')(finestra);
const O = crea({ sb: {}, S: {}, ADMIN_EMAIL: 'x', $: () => null, vGet: () => '', vSet() {}, toast() {} });
const ctrl = {
  dal: '2025-10-01', al: '2026-09-30', definitive: 3, pronte: 1, ferme: 2, con_avvisi: 1, non_definitive: 0,
  motivi: [
    { cosa: 'cantiere-durata', dove: 'cantiere', blocca: true, testo: 'Scheda del cantiere: durata dei lavori da indicare', visite: 2, cantieri: 1 },
    { cosa: 'importo-nd', dove: 'cantiere', blocca: false, testo: 'Importo dei lavori «Non disponibile»', visite: 1, cantieri: 1 },
  ],
  cantieri: [
    { cantiere_id: 'C1', cantiere: 'Via San Giorgio SNC', comune: 'ALBIGNASEGO', visite: 2, verbali: ['CPT/25_26/0101', 'CPT/25_26/0230'], blocchi: ['cantiere-durata'], avvisi: [] },
    { cantiere_id: 'C2', cantiere: 'Via Roma', comune: 'ESTE', visite: 1, verbali: ['CPT/25_26/0568'], blocchi: [], avvisi: ['importo-nd'] },
    { cantiere_id: 'C3', cantiere: 'Via Vecchia', comune: 'ESTE', visite: 4, blocchi: ['cantiere-durata'], avvisi: [] },
  ],
  visite: [],
};
const h = O._ossElenco(ctrl, { scarti: [] });
assert.ok(!/<th [^>]*>Visite<\/th>/.test(h), 'la colonna «Visite» col solo conteggio è stata sostituita');
assert.strictEqual((h.match(/<th [^>]*>Verbali<\/th>/g) || []).length, 2, 'colonna «Verbali» in tutte e due le tabelle dei cantieri');
assert.ok(h.includes('CPT/25_26/0101<br>CPT/25_26/0230'), 'i verbali del cantiere da completare, uno per riga');
assert.ok(h.includes('CPT/25_26/0568'), 'anche nei cantieri che escono con un «Non disponibile»');
assert.ok(/<td [^>]*>4<\/td>/.test(h), 'se il database non manda i numeri, resta il conteggio (non una cella vuota)');

console.log('osservatorio-numeri-verbale: ok');
