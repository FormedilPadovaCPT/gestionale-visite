// node test/verbale-posizione.test.cjs
// (26/10/2026, deciso dall'utente) sul verbale, sotto la banda grigia, la riga
// «Accesso al cantiere 4 · Ciclo di visita 2 · Visita 1 di 3 · Serie di visite 4 di 10» (variante A).
// I numeri li dà verbale_posizione del database; senza ciclo né serie resta la cella «N° accesso».
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VerbalePDF = require('../verbale-pdf.js');
const R = VerbalePDF.rigaPosizione;

// ciclo normale
assert.deepStrictEqual(R('4', { ciclo: { numero: 2, visita: 1, di: 3 } }),
  [['Accesso al cantiere', '4'], ['Ciclo di visita', '2'], ['Visita', '1 di 3']]);
// visita in serie: il ciclo come per tutte le altre, più il progressivo della serie
assert.deepStrictEqual(R('6', { ciclo: { numero: 1, visita: 4, di: 5 }, serie: { n: 4, di: 10, incarico: 1080 } }),
  [['Accesso al cantiere', '6'], ['Ciclo di visita', '1'], ['Visita', '4 di 5'], ['Serie di visite', '4 di 10']]);
// oltre il massimo il «di» sparisce, non si scrive «6 di 5» né «50 di 10»
assert.deepStrictEqual(R('9', { ciclo: { numero: 1, visita: 6, di: null } })[2], ['Visita', '6']);
assert.deepStrictEqual(R('3', { serie: { n: 50, di: null } }), [['Accesso al cantiere', '3'], ['Serie di visite', '50']]);
// storico, bozza, asseverazione, lettura non riuscita: niente riga, resta la banda di prima
assert.strictEqual(R('4', null), null);
assert.strictEqual(R('4', {}), null);
assert.strictEqual(R('4', { ciclo: { numero: 1, visita: null } }), null);

// prepara() porta la riga nei dati del disegno
const base = { v: { acc_cant: 4, data_visita: '2026-10-26', cantieri: {}, tecnici: {} }, imps: [], chk: [], lavs: [], voci: [] };
assert.deepStrictEqual(VerbalePDF.prepara({ ...base, posizione: { ciclo: { numero: 2, visita: 1, di: 3 } } }).posizione[2], ['Visita', '1 di 3']);
assert.strictEqual(VerbalePDF.prepara(base).posizione, null);

// il disegno: con la riga l'accesso esce dalla banda, senza resta la cella «N° accesso»
const src = fs.readFileSync(path.join(__dirname, '..', 'verbale-pdf.js'), 'utf8');
assert.ok(/const celle = d\.posizione\s*\?[^:]*\['Etichetta cantiere', d\.etichetta, 52\]\]\s*:\s*\[\['Tecnico'[^\n]*\['N° accesso', d\.accesso, 20\]/.test(src), 'banda con e senza la riga della posizione');
assert.ok(/if \(d\.posizione\) \{[\s\S]{0,400}C\.pietra[\s\S]{0,200}C\.arancio/.test(src), 'riga chiara col filo arancione');

// genPDF chiede i numeri al database e legge l'errore
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(/sb\.rpc\('verbale_posizione',\{p_visita_id:vid\}\)/.test(html), 'genPDF chiama verbale_posizione');
assert.ok(/if\(_eP\)\{[^\n]*toast\(/.test(html), "l'errore si legge e si dice");
assert.ok(/prepara\(\{[^\n]*posizione:_pos\}\)/.test(html), 'la posizione arriva a prepara');
assert.ok(/verbale-pdf\.js\?v=(\d+)/.test(html) && +html.match(/verbale-pdf\.js\?v=(\d+)/)[1] >= 14, 'versione del modulo aggiornata');

// la conta della serie è la stessa del controllo «serie completa» (verbale_mancanze)
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '2026_10_26_verbale_posizione.sql'), 'utf8');
const man = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '2026_10_26_verbale_mancanze_incarico.sql'), 'utf8');
const senzaSpazi = (t) => t.replace(/\s+/g, '');
const stessaConta = senzaSpazi("o.incarico_id = inc.id or trim(coalesce(o.prot_int, '')) = inc.id::text)");
assert.ok(senzaSpazi(sql).includes(stessaConta) && senzaSpazi(man).includes(stessaConta), 'stesse visite contate sull’incarico');
assert.ok(sql.includes('coalesce(i.visite_previste, public.incarichi_previste(i.tipo_richiesta))') && man.includes('coalesce(i.visite_previste, public.incarichi_previste(i.tipo_richiesta))'), 'stesso numero previsto');
assert.ok(/when v\.ciclo_visita <= 3 then 3 when v\.ciclo_visita <= 5 then 5 end/.test(sql), 'di 3, poi di 5, poi niente');
assert.ok(/revoke execute on function public\.verbale_posizione\(text\) from public, anon/.test(sql), 'niente anon');

console.log('verbale-posizione: ok');
