// node test/osservatorio-senza-ripieghi.test.cjs
// (03/10/2026) L'esportazione per l'Osservatorio non mette più valori di ripiego: una visita a cui
// manca un dato obbligatorio NON ESCE, e lo si vede prima (tessera «Pronti per l'Osservatorio»,
// pulsante «Controlla»). Che cosa è «pronto» lo decide il database (osservatorio_controllo); le
// funzioni oss* di osservatorio.js sono la seconda rete e non hanno ripieghi.
// Ogni regola è provata su un caso rotto apposta, che deve essere visto.
// In coda: il tipo di accesso preso dall'incarico e la conferma con zero lavoratori.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const oss = fs.readFileSync(path.join(radice, 'osservatorio.js'), 'utf8');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_03_osservatorio_controllo.sql'), 'utf8');

/* la fabbrica si carica così com'è, con dipendenze finte: le funzioni oss* sono pure */
const finestra = {};
const crea = new Function('window', oss.replace('export function creaOsservatorio', 'function creaOsservatorio') + '\nreturn creaOsservatorio')(finestra);
const O = crea({ sb: {}, S: {}, ADMIN_EMAIL: 'x', $: () => null, vGet: () => '', vSet() {}, toast() {} });

/* ── 1. nel codice non ci sono più i ripieghi ── */
for (const [re, che] of [
  [/ruolo=2\b/, 'ruolo → 2'], [/ti=8\b/, 'tipo di intervento → 8'], [/to=16\b/, 'tipo di opera → 16'],
  [/im=11\b/, 'importo → 11'], [/du=7\b/, 'durata → 7'], [/\|\|'SN'/, 'civico → SN'],
  [/committente_tipo:3/, 'tipo del committente → 3'], [/\|\|'ND'/, 'cognome del tecnico → ND'], [/– ND/, 'nome → ND'],
  [/TIPO_MAP\[ta\]\|\|5/, 'tipo di visita → 5'],
]) assert.ok(!re.test(oss), 'in osservatorio.js c’è ancora il ripiego: ' + che);
assert.ok(/sb\.rpc\('osservatorio_controllo'/.test(oss), 'l’esportazione deve chiedere al database che cosa è pronto');
assert.ok(!/comm_email/.test(oss), 'la mail del committente non serve più all’esportazione');

/* ── 2. ruolo e tipo di visita ── */
assert.strictEqual(O.ossRuolo({ ruolo: 'Affidataria' }), 1);
assert.strictEqual(O.ossRuolo({ ruolo: ' affidataria ed esecutrice ' }), 2);
assert.strictEqual(O.ossRuolo({ ruolo: 'Subappaltatrice' }), 3);
assert.strictEqual(O.ossRuolo({ ruolo: null, tipo_imp: 5 }), 3, 'senza testo vale tipo_imp');
assert.strictEqual(O.ossRuolo({ ruolo: '', tipo_imp: null }), null, 'ruolo mancante: null, non 2');
assert.strictEqual(O.ossRuolo(undefined), null, 'nessuna impresa principale: null');
assert.strictEqual(O.ossTipoVisita({ tipo_accesso_naz: 2, tipo_accesso: 8 }), 2);
assert.strictEqual(O.ossTipoVisita({ tipo_accesso_naz: null, tipo_accesso: 9 }), 3, 'stage → per protocolli di intesa');
assert.strictEqual(O.ossTipoVisita({ tipo_accesso_naz: null, tipo_accesso: null }), null, 'tipo mancante: null, non 5');

/* ── 3. scheda del cantiere ── */
const cant = { cantiere_id: 'C1', cantiere_indirizzo: 'Via Roma', cantiere_civico: '1', cantiere_comune_cod: '028060', cantiere_tip_int: 2, cantiere_tip_ope: 3, cantiere_importo: 4, cantiere_durata: 2, cantiere_committente_id: 'K1' };
assert.deepStrictEqual(O.ossCantiereManca(cant), []);
assert.deepStrictEqual(O.ossCantiereManca({ ...cant, cantiere_importo: 11, cantiere_durata: 7 }), [], '«Non disponibile» è ammesso dall’Osservatorio');
assert.deepStrictEqual(O.ossCantiereManca(null), ['cantiere']);
for (const [campo, valore, codice] of [
  ['cantiere_indirizzo', ' ', 'cantiere-indirizzo'], ['cantiere_civico', '', 'cantiere-civico'],
  ['cantiere_comune_cod', '28060', 'cantiere-comune'], ['cantiere_comune_cod', null, 'cantiere-comune'],
  ['cantiere_tip_int', 5, 'cantiere-intervento'], ['cantiere_tip_int', 8, 'cantiere-intervento'], ['cantiere_tip_int', null, 'cantiere-intervento'],
  ['cantiere_tip_ope', 17, 'cantiere-opera'], ['cantiere_tip_ope', null, 'cantiere-opera'],
  ['cantiere_importo', null, 'cantiere-importo'], ['cantiere_importo', 12, 'cantiere-importo'],
  ['cantiere_durata', null, 'cantiere-durata'], ['cantiere_durata', 8, 'cantiere-durata'],
]) assert.deepStrictEqual(O.ossCantiereManca({ ...cant, [campo]: valore }), [codice], campo + ' = ' + JSON.stringify(valore));
assert.strictEqual(O.ossCommittenteTipo({ committente_tipo: null }), null, 'committente senza tipo: null, non 3');
assert.strictEqual(O.ossCommittenteTipo({ committente_tipo: 3 }), 3);
assert.strictEqual(O.ossCommittenteTipo({ committente_tipo: 4 }), null);

/* ── 4. quali visite escono ── */
const visita = { visita_id: 'V1', nr_verbale: 'CPT/26_27/0010', cantiere_id: 'C1', impresa_id: 'I1', tecnico_id: 'T1', tecnico2_id: 'T9', tipo_accesso: 5, tipo_accesso_naz: 5, data_visita: '2026-10-05', ora_visita: '09:30:00', ora_fine: '10:15:00', nr_imp: 1, nr_lavoratori: 3, nr_ind: 0, coord: true };
const base = () => ({
  visite: [visita],
  ferme: null,
  valPerVisita: O.ossValutazioni([{ visita_id: 'V1', codice: 'IMP_LOG_001', valore: 'NC+', nota: 'recinzione <aperta>' }, { visita_id: 'V1', codice: 'IMP_LOG_002', valore: 'VER', nota: null }, { visita_id: 'V1', codice: 'IMP_LOG_003', valore: 'NA', nota: null }]),
  ruoloRiga: { V1: { ruolo: 'Esecutrice', tipo_imp: 3 } },
  cantMap: { C1: cant },
  commMap: { K1: { committente_id: 'K1', committente_nome: 'Comune di Prova', committente_tipo: 1 } },
  impMap: { I1: { impresa_id: 'I1', impresa_nome: 'EDILPROVA', impresa_cf: '01234567890' }, I2: { impresa_id: 'I2', impresa_nome: 'ALTRA' } },
  tecMap: { T1: { tecnico_id: 'T1', tecnico_cognome: 'Rossi', tecnico_nome: 'Mario' }, T2: { tecnico_id: 'T2', tecnico_cognome: 'Bianchi' } },
});
let r = O.ossScegli(base());
assert.strictEqual(r.esporta.length, 1); assert.strictEqual(r.scarti.length, 0);
assert.strictEqual(r.esporta[0].ruolo, 3); assert.strictEqual(r.esporta[0].tipo, 5);
// casi rotti apposta: la visita non esce, e si sa perché
const rotto = (modifica, atteso, che) => {
  const d = base(); modifica(d);
  const x = O.ossScegli(d);
  assert.strictEqual(x.esporta.length, 0, che + ': la visita non deve uscire');
  assert.deepStrictEqual(x.scarti[0].perche, atteso, che);
};
rotto((d) => { d.valPerVisita = {}; }, ['checklist'], 'check-list vuota');
rotto((d) => { d.valPerVisita = O.ossValutazioni([{ visita_id: 'V1', codice: 'CODICE_SENZA_CORRISPONDENZA', valore: 'NC+' }]); }, ['checklist'], 'check-list senza codici nazionali');
rotto((d) => { delete d.impMap.I1; }, ['impresa'], 'impresa non in anagrafica');
rotto((d) => { d.ruoloRiga = {}; }, ['ruolo'], 'nessuna impresa principale');
rotto((d) => { d.ruoloRiga.V1 = { ruolo: 'boh', tipo_imp: null }; }, ['ruolo'], 'ruolo non riconosciuto');
rotto((d) => { d.visite = [{ ...visita, tipo_accesso: null, tipo_accesso_naz: null }]; }, ['tipo-visita'], 'tipo di accesso mancante');
rotto((d) => { delete d.tecMap.T1; }, ['tecnico'], 'tecnico non in anagrafica');
rotto((d) => { d.cantMap = {}; }, ['cantiere'], 'cantiere non in archivio');
rotto((d) => { d.cantMap.C1 = { ...cant, cantiere_tip_int: 5, cantiere_durata: null }; }, ['cantiere-intervento', 'cantiere-durata'], 'scheda del cantiere incompleta');
rotto((d) => { d.commMap = {}; }, ['committente'], 'committente collegato ma non in anagrafica');
rotto((d) => { d.commMap.K1.committente_tipo = null; }, ['committente-tipo'], 'committente senza pubblico/privato');
// una visita che il database dà per ferma non si guarda nemmeno
r = O.ossScegli({ ...base(), ferme: new Set(['V1']) });
assert.strictEqual(r.esporta.length + r.scarti.length, 0);
// un cantiere senza committente esce: l'Osservatorio non lo chiede
{ const d = base(); d.cantMap.C1 = { ...cant, cantiere_committente_id: null }; assert.strictEqual(O.ossScegli(d).esporta.length, 1); }

/* ── 5. i cinque file: solo ciò che le visite esportate citano, e i valori veri ── */
const d = base();
const x = O.ossXml({ esporta: O.ossScegli(d).esporta, cantMap: d.cantMap, commMap: d.commMap, impMap: d.impMap, tecMap: d.tecMap });
assert.strictEqual(x.nVis, 1); assert.strictEqual(x.nCant, 1); assert.strictEqual(x.nImp, 1); assert.strictEqual(x.nComm, 1); assert.strictEqual(x.nTec, 1);
assert.ok(/<visitaImpresaRuolo>3<\/visitaImpresaRuolo>/.test(x.xv) && /<visitaTipo>5<\/visitaTipo>/.test(x.xv));
assert.ok(!/secondoTecnicoId/.test(x.xv), 'il secondo tecnico non in anagrafica non si cita');
assert.ok(/visitaZonaNote="recinzione &lt;aperta&gt;"/.test(x.xv), 'le note vanno protette');
assert.strictEqual((x.xv.match(/<visitaValutazione /g) || []).length, 2, 'NA non è una valutazione');
assert.ok(/<visitaOraInizio>9<\/visitaOraInizio><visitaMinutiInizio>30<\/visitaMinutiInizio>/.test(x.xv));
assert.ok(/<cantiereComuneCod>028060<\/cantiereComuneCod>/.test(x.xc));
assert.ok(/<cantiereTipInt>2<\/cantiereTipInt><cantiereTipOpe>3<\/cantiereTipOpe><cantiereImporto>4<\/cantiereImporto><cantiereDurata>2<\/cantiereDurata><cantiereCommittenteId>K1<\/cantiereCommittenteId>/.test(x.xc));
assert.ok(!/ALTRA/.test(x.xi), 'un’impresa che nessuna visita esportata cita non esce');
assert.ok(!/Bianchi/.test(x.xt), 'un tecnico che nessuna visita esportata cita non esce');
assert.ok(/<committenteTipo>1<\/committenteTipo>/.test(x.xm));
for (const f of [x.xv, x.xc, x.xi, x.xm, x.xt]) assert.ok(!/>ND<|undefined|NaN|null/.test(f), 'nei file non devono comparire ND, undefined, NaN, null');

/* ── 6. le due regole sono la stessa: i codici dell'esportazione sono i blocchi del database ── */
const regole = [...sql.matchAll(/^\s*\('([a-z-]+)',\s*'(visita|cantiere)',\s*(true|false),/gm)].map((m) => ({ cosa: m[1], blocca: m[3] === 'true' }));
assert.ok(regole.length >= 20, 'non trovo le regole in 2026_10_03_osservatorio_controllo.sql');
const blocchiDb = regole.filter((g) => g.blocca).map((g) => g.cosa).sort();
const corpo = oss.slice(oss.indexOf('function ossCantiereManca'), oss.indexOf('function ossXml'));
const codiciJs = [...new Set([...corpo.matchAll(/(?:push\('|return\[')([a-z-]+)'/g)].map((m) => m[1]))].sort();
assert.deepStrictEqual(codiciJs, blocchiDb, 'i codici di osservatorio.js e i blocchi di osservatorio_controllo devono coincidere');
assert.ok(/revoke execute on function public\.osservatorio_controllo\(date, date, boolean\) from public, anon/.test(sql));
assert.ok(/security invoker/.test(sql));

/* ── 7. l'elenco: i testi che vengono dal database sono protetti ── */
const ctrl = { dal: '2025-10-01', al: '2026-09-30', definitive: 3, pronte: 1, ferme: 2, con_avvisi: 1, non_definitive: 1,
  motivi: [{ cosa: 'cantiere-intervento', dove: 'cantiere', blocca: true, testo: 'Scheda del cantiere: tipo di intervento da indicare (costruzione…)', visite: 1, cantieri: 1 },
    { cosa: 'ruolo', dove: 'visita', blocca: true, testo: 'Ruolo dell\'impresa principale non indicato', visite: 1, cantieri: 1 },
    { cosa: 'importo-nd', dove: 'cantiere', blocca: false, testo: 'Importo «Non disponibile»', visite: 1, cantieri: 1 }],
  cantieri: [{ cantiere_id: 'C"1', cantiere: 'Via <b>Roma</b> 1', comune: 'PADOVA', visite: 1, blocchi: ['cantiere-intervento'], avvisi: [] },
    { cantiere_id: 'C2', cantiere: 'Via Po 2', comune: 'ESTE', visite: 1, blocchi: [], avvisi: ['importo-nd'] }],
  visite: [{ visita_id: 'V7', nr_verbale: 'CPT/26_27/0001', data: '2026-10-02', tecnico: 'Caon', impresa: 'GALIAZZO', cantiere_id: 'C3', blocchi: ['ruolo'] },
    { visita_id: 'V8', nr_verbale: 'CPT/25_26/0023', data: '2025-10-09', tecnico: 'Caon', impresa: 'MARTINI', cantiere_id: 'C"1', blocchi: ['cantiere-intervento'] }] };
const elenco = O._ossElenco(ctrl, { scarti: [] });
assert.ok(/<b>3<\/b> visite definitive/.test(elenco) && /1 pronte/.test(elenco) && /2 ferme/.test(elenco));
assert.ok(/ancora bozze/.test(elenco));
assert.ok(elenco.includes('Via &lt;b&gt;Roma&lt;/b&gt; 1') && !elenco.includes('Via <b>Roma</b>'), 'il nome del cantiere va protetto');
assert.ok(elenco.includes('data-oss-cant="C&quot;1"'), 'l’identificativo va protetto dentro l’attributo');
assert.ok(elenco.includes('data-oss-vis="V7"') && !elenco.includes('data-oss-vis="V8"'), 'fra i verbali da completare vanno solo quelli con un motivo di visita');
assert.ok(/Cantieri da completare \(1\)/.test(elenco) && /Verbali da completare \(1\)/.test(elenco));
assert.ok(/02\/10\/2026/.test(elenco));
assert.ok(/Tutte le visite definitive hanno i dati obbligatori/.test(O._ossElenco({ ...ctrl, pronte: 3, ferme: 0, non_definitive: 0, motivi: [], cantieri: [], visite: [] })));

/* ── 8. l'esercizio va dal 1/10 al 30/9 ── */
assert.deepStrictEqual(O.ossEsercizi(new Date(2026, 9, 3)).map((e) => [e.nome, e.dal, e.al]), [['2026-27', '2026-10-01', '2027-09-30'], ['2025-26', '2025-10-01', '2026-09-30']]);
assert.deepStrictEqual(O.ossEsercizi(new Date(2026, 8, 30)).map((e) => e.nome), ['2025-26', '2024-25']);
assert.deepStrictEqual(O.ossEsercizi(new Date(2027, 0, 15)).map((e) => e.nome), ['2026-27', '2025-26']);

/* ── 9. la pagina: tessera, «Controlla», e la tessera si carica aprendo la Segreteria ── */
assert.ok(/<div id="oss-tessera"/.test(html), 'manca la tessera «Pronti per l’Osservatorio»');
assert.ok(/<button class="btn-outline" id="oss-controlla" onclick="admOssControlla\(\)">/.test(html), 'manca il pulsante «Controlla»');
assert.ok(/function sgrInit\(\)\{[\s\S]{0,700}window\.admOssTessera\(\)/.test(html), 'la tessera deve caricarsi con la pagina Segreteria');
assert.ok(/non sono riuscito a leggere/.test(oss), 'una lettura fallita si dice: mai uno zero al posto di un errore');
assert.strictEqual(typeof finestra.admOssControlla, 'function');
assert.strictEqual(typeof finestra.admOssTessera, 'function');

/* ── 10. il tipo di accesso che l'incarico dice da sé ── */
const prendi = (re, nome) => { const m = html.match(re); assert.ok(m, nome + ' non trovata in index.html'); return m[0]; };
const incTipoAccesso = Function(prendi(/function incTipoAccesso\(r\)\{[\s\S]*?\r?\n\}/, 'incTipoAccesso') + '; return incTipoAccesso')();
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo in Azienda AUDIT ASL/STAGE', tipologia_richiesta: 'Richiesta Visita STAGE' }), 9);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: null, stage_elenco_id: 12 }), 9);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Serie di visite' }), 8);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo per Asseverazione - MOG' }), 10);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Assegnazione Impresa Progetto SPISAL "Soft Skills per la sicurezza"' }), 12);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo in Cantiere - Visita singola', tipologia_richiesta: 'Richiesta Visita su segnalazione' }), 1);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo in Cantiere - Visita singola' }), 2);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo urgente in Cantiere' }), 2);
// dove la richiesta non lo dice, non si indovina
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Informazioni' }), null);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Consulenza in sede Impresa' }), null);
assert.strictEqual(incTipoAccesso({ tipo_richiesta: 'Sopralluogo in Cantiere - Visita singola; Sopralluogo per Asseverazione - MOG' }), null, 'più richieste insieme: sceglie il tecnico');
assert.strictEqual(incTipoAccesso({}), null); assert.strictEqual(incTipoAccesso(null), null);
// si propone solo se il campo è vuoto, e resta «– Scegli –» quando non si parte da un incarico
assert.ok(/const _ta=incTipoAccesso\(r\)\r?\n\s*if\(_ta&&!vGet\('f-tipo'\)\)\{/.test(html), 'il tipo dell’incarico non deve sovrascrivere una scelta già fatta');
assert.ok(/vSet\('f-tipo',''\)/.test(html), 'senza incarico la tipologia di accesso nasce vuota');

/* ── 11. zero lavoratori: si chiude solo dopo averlo confermato ── */
const zeroLavoratori = Function(prendi(/function zeroLavoratori\(tot\)\{[^\n]*\}/, 'zeroLavoratori') + '; return zeroLavoratori')();
assert.strictEqual(zeroLavoratori({ nr_lavoratori: 0, nr_ind: 0 }), true);
assert.strictEqual(zeroLavoratori({ nr_lavoratori: 0, nr_ind: 1 }), false, 'un autonomo è un lavoratore');
assert.strictEqual(zeroLavoratori({ nr_lavoratori: 2, nr_ind: 0 }), false);
assert.strictEqual(zeroLavoratori(null), false);
const salva = prendi(/async function saveVisita\(stato\)\{[\s\S]*?const vistaRow=/, 'saveVisita');
assert.ok(/if\(stato==='definitivo'&&zeroLavoratori\(computeImpTotals\(\)\)&&!confirm\(/.test(salva), 'la conferma sui lavoratori deve stare prima di ogni scrittura');
assert.ok(salva.indexOf('zeroLavoratori(computeImpTotals())') < salva.indexOf("sb.from('visite').upsert") || !/sb\.from\('visite'\)\.upsert/.test(salva.slice(0, salva.indexOf('zeroLavoratori(computeImpTotals())'))), 'prima la conferma, poi il salvataggio');

console.log('osservatorio-senza-ripieghi: ok');
