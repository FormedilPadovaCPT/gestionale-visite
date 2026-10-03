// node test/imprese-senza-cf.test.cjs
// (03/10/2026, chiesto dall'utente) La segreteria vede le imprese visitate senza codice fiscale e
// le sistema a mano. Quello che questi controlli tengono fermo:
//   · un codice con la cifra o il carattere di controllo sbagliato non si salva;
//   · un codice che è già di un'altra impresa non si salva (è un doppione da unire);
//   · se la lettura fallisce lo si dice: non si scrive «nessuna».
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const prendi = (re, nome) => { const m = html.match(re); assert.ok(m, nome + ' non trovata in index.html'); return m[0]; };
const f = Function(
  prendi(/function pivaValida\(x\)\{[\s\S]*?\r?\n\}/, 'pivaValida') + ';' +
  prendi(/function cfPersonaValido\(x\)\{[\s\S]*?\r?\n\}/, 'cfPersonaValido') + ';' +
  prendi(/function cfImpresaProblema\(x\)\{[\s\S]*?\r?\n\}/, 'cfImpresaProblema') +
  '; return { pivaValida, cfPersonaValido, cfImpresaProblema }')();

// partite IVA vere, lette dall'anagrafica: devono passare tutte
for (const p of ['00251920286', '03236900274', '04693200265', '03604030282', '04931000287', '05761880284']) {
  assert.strictEqual(f.pivaValida(p), true, 'partita IVA vera rifiutata: ' + p);
}
// casi rotti apposta: una cifra cambiata, una in meno, lettere
assert.strictEqual(f.pivaValida('00251920287'), false, 'una cifra sbagliata deve essere vista');
assert.strictEqual(f.pivaValida('0025192028'), false);
assert.strictEqual(f.pivaValida('0025192028A'), false);
assert.strictEqual(f.pivaValida(''), false);
assert.strictEqual(f.pivaValida(' 00251920286 '), true, 'gli spazi non contano');

// codici fiscali di persona veri (dai verbali CPT/26_27/0001 e 0002)
assert.strictEqual(f.cfPersonaValido('PRVNCI87B16G224Q'), true);
assert.strictEqual(f.cfPersonaValido('MCCMKM82D63Z127G'), true);
assert.strictEqual(f.cfPersonaValido('mccmkm82d63z127g'), true, 'le minuscole non contano');
assert.strictEqual(f.cfPersonaValido('PRVNCI87B16G224R'), false, 'carattere di controllo sbagliato');
assert.strictEqual(f.cfPersonaValido('PRVNCI87B16G224'), false);
assert.strictEqual(f.cfPersonaValido('PRVNC187B16G224Q'), false, 'una lettera scambiata con una cifra deve essere vista');

assert.strictEqual(f.cfImpresaProblema('00251920286'), '');
assert.strictEqual(f.cfImpresaProblema('PRVNCI87B16G224Q'), '');
assert.ok(/Scrivi/.test(f.cfImpresaProblema('')));
assert.ok(/11 cifre/.test(f.cfImpresaProblema('123')));
assert.ok(/cifra di controllo/.test(f.cfImpresaProblema('00251920287')));
assert.ok(/16 caratteri/.test(f.cfImpresaProblema('ABC')));
assert.ok(/carattere di controllo/.test(f.cfImpresaProblema('PRVNCI87B16G224R')));

/* nella pagina */
const salva = prendi(/async function admImpSalvaCf\(i\)\{[\s\S]*?\r?\n\}/, 'admImpSalvaCf');
assert.ok(salva.indexOf('cfImpresaProblema(cf)') < salva.indexOf(".update({impresa_cf:cf})"), 'il codice si controlla prima di salvarlo');
assert.ok(/if\(eAltra\)\{toast\('Non sono riuscito a controllare/.test(salva), 'lettura fallita: lo si dice e non si salva');
assert.ok(/if\(altra&&altra\.length\)\{toast\('Questo codice fiscale è già dell/.test(salva), 'codice già di un’altra impresa: non si salva');
assert.ok(/if\(!fatto\|\|!fatto\.length\)/.test(salva), 'zero righe aggiornate non è un salvataggio riuscito');
const carica = prendi(/async function admImpSenzaCf\(\)\{[\s\S]*?\r?\n\}/, 'admImpSenzaCf');
assert.ok(/sb\.rpc\('imprese_senza_cf'\)/.test(carica) && /if\(error\)\{[\s\S]{0,200}Non sono riuscito a leggere/.test(carica), 'errore di lettura detto, non «nessuna»');
assert.ok(/window\.admImpSenzaCf=admImpSenzaCf/.test(html) && /onclick="admImpSenzaCf\(\)"/.test(html));
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '2026_10_03_imprese_senza_cf.sql'), 'utf8');
assert.ok(/revoke execute on function public\.imprese_senza_cf\(\) from public, anon;/.test(sql));
assert.ok(/security invoker/.test(sql));

console.log('ok — imprese senza codice fiscale: controllo delle cifre, doppioni, errori detti');
