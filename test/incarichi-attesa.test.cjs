// node test/incarichi-attesa.test.cjs
// (07/10/2026, chiesto dall'utente) Negli «Incarichi da evadere» e nella pagina Incarichi si vede da quanti giorni
// l'incarico è stato dato al tecnico: si conta da assegnato_il (la scrive il database, riparte se riassegnato), per gli
// incarichi senza dalla data di risposta o di richiesta. Fino a 14 giorni grigio, 15-30 arancione, oltre 30 rosso.
// Le serie di visite contano le visite fatte, non i giorni, e nel riquadro stanno in fondo. Su una segnalazione
// l'impresa si scopre in cantiere: si scrive «impresa da individuare in cantiere», non «0».
process.env.TZ = 'Europe/Rome';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const v2 = fs.readFileSync(path.join(dir, 'veste-v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_07_incarichi_assegnato_il.sql'), 'utf8');

/* ── le funzioni, prese dal codice vero ── */
const i0 = html.indexOf('function incTipoAccesso(r){');
const i1 = html.indexOf('window.INC_IMPRESA_DA_TROVARE=INC_IMPRESA_DA_TROVARE');
assert.ok(i0 > 0 && i1 > i0, 'incAttesa e incImpresaTesto stanno accanto a incTipoAccesso');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(html.slice(i0, i1) + 'window.INC_IMPRESA_DA_TROVARE=INC_IMPRESA_DA_TROVARE', ctx);
const { incAttesa, incAttesaHtml, incImpresaTesto } = ctx;
const oggi = new Date(2026, 9, 7, 9, 30);

/* ── da quando si conta ── */
assert.strictEqual(incAttesa({ assegnato_il: '2026-09-24T10:00:00+00:00', data_richiesta: '2026-01-01' }, oggi).giorni, 13, 'dalla data di assegnazione, non dalla richiesta');
assert.strictEqual(incAttesa({ data_risposta: '2026-07-29', data_richiesta: '2026-07-28' }, oggi).giorni, 70, 'senza assegnazione: dalla risposta');
assert.strictEqual(incAttesa({ data_richiesta: '2026-07-28' }, oggi).giorni, 71, 'altrimenti dalla richiesta');
assert.strictEqual(incAttesa({}, oggi).giorni, null, 'senza date: niente numero');
assert.strictEqual(incAttesa({ assegnato_il: '2026-10-07T05:00:00+00:00' }, oggi).giorni, 0);
assert.strictEqual(incAttesa({ assegnato_il: '2026-10-06T22:30:00+00:00' }, oggi).giorni, 0, 'la data si legge nel giorno italiano, non in UTC');

/* ── le soglie ── */
const liv = (g) => incAttesa({ data_richiesta: new Date(2026, 9, 7 - g, 12).toISOString().slice(0, 10) }, oggi).livello;
assert.strictEqual(liv(14), 'ok'); assert.strictEqual(liv(15), 'attenzione'); assert.strictEqual(liv(30), 'attenzione'); assert.strictEqual(liv(31), 'fermo');
assert.ok(/da 13 giorni/.test(incAttesaHtml({ data_richiesta: '2026-09-24' }, oggi)) && /#888/.test(incAttesaHtml({ data_richiesta: '2026-09-24' }, oggi)));
assert.ok(/#c0392b/.test(incAttesaHtml({ data_richiesta: '2026-08-06' }, oggi)), 'oltre 30 giorni: rosso');
assert.ok(/da 1 giorno</.test(incAttesaHtml({ data_richiesta: '2026-10-06' }, oggi)) && /da oggi</.test(incAttesaHtml({ data_richiesta: '2026-10-07' }, oggi)));
assert.ok(/data-aiuto="Giorni passati da quando/.test(incAttesaHtml({ data_richiesta: '2026-09-24' }, oggi)), 'la nuvoletta spiega da quando si conta');

/* ── le serie ── */
const s = incAttesa({ visite_previste: 10, visite_fatte: 4, data_richiesta: '2025-07-03' }, oggi);
assert.ok(s.serie && s.giorni === null, 'una serie non conta i giorni');
assert.ok(/4 di 10 visite/.test(incAttesaHtml({ visite_previste: 10, visite_fatte: 4 }, oggi)));

/* ── l'impresa ── */
assert.strictEqual(incImpresaTesto({ impresa: 'ARIANNA S.A.S.' }), 'ARIANNA S.A.S.');
assert.strictEqual(incImpresaTesto({ impresa: null, richiedente: '0', tipo_richiesta: 'Sopralluogo in Cantiere - Visita singola' }), '', 'il 1081: impresa da individuare, non «0»');
assert.strictEqual(incImpresaTesto({ impresa: '', richiedente: 'Mario Rossi', tipo_richiesta: 'Segnalazione cantiere' }), '', 'su una segnalazione il segnalante non va al posto dell’impresa');
assert.strictEqual(incImpresaTesto({ richiedente: 'Studio Bianchi', tipo_richiesta: 'Consulenza Telefonica' }), 'Studio Bianchi');
assert.strictEqual(incImpresaTesto({ tipo_richiesta: 'Informazioni' }), null, 'fuori dalle visite resta il trattino');
assert.ok(/impresa da individuare in cantiere/.test(ctx.INC_IMPRESA_DA_TROVARE));

/* ── dove si vede ── */
assert.ok(/incAttesa\(r,_oggiInc\)\.livello==='fermo'/.test(html) && /fermi da più di 30 giorni/.test(html) && !/aperti da più di sei mesi/.test(html), 'il riepilogo conta i fermi oltre 30 giorni');
assert.ok(/r\.stato==='aperto'&&!serie\?'<span style="font-size:11px;margin-left:8px">'\+incAttesaHtml\(r\)/.test(html), 'la scheda mostra i giorni accanto alla data');
assert.ok(/const att=r\.stato==='aperto'\?incAttesa\(r,oggi\):null/.test(html) && /' att-'\+att\.livello/.test(html) && /\.inc-tab \.att-fermo\{/.test(html), 'la tabella del PC conta dall’assegnazione e colora');
assert.ok(/window\.incAttesaHtml\(x\)/.test(v2) && !/' · dal ' \+ gg\(x\.data_richiesta\)/.test(v2), 'il riquadro di Oggi mostra i giorni');
assert.ok(/if \(A\.serie !== B\.serie\) return A\.serie \? 1 : -1;/.test(v2) && /ordinati\.slice\(0, 5\)/.test(v2), 'il riquadro mette prima chi aspetta da più tempo, le serie in fondo');
assert.ok(/window\.incImpresaTesto\(x\)/.test(v2) && !/esc\(x\.impresa \|\| x\.richiedente \|\| '—'\)/.test(v2), 'il riquadro non mostra «0» come impresa');
assert.ok(/veste-v2\.js\?v=36/.test(html), 'la versione di veste-v2 è salita');

/* ── il database ── */
assert.ok(/add column if not exists assegnato_il timestamptz/.test(sql) && /trg_incarichi_su_assegnazione before insert or update/.test(sql), 'la data la scrive il database');
assert.ok(/new\.assegnato_il\s+:= old\.assegnato_il;/.test(sql), 'la guardia la protegge come il tecnico');
assert.ok(/disable trigger trg_incarichi_touch/.test(sql) && /enable trigger trg_incarichi_touch/.test(sql), 'il riempimento non tocca aggiornato_il');
assert.ok('trg_incarichi_su_assegnazione' > 'trg_incarichi_guard', 'il trigger gira dopo la guardia');

console.log('ok incarichi-attesa');
