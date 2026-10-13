// node test/elenco-cantieri-tel.test.cjs
// (13/10/2026, proposta B scelta dall'utente) Sul telefono l'elenco cantieri è fatto di schede che si leggono
// dall'alto; sul PC resta la tabella. I pulsanti delle schede hanno gli stessi attributi della tabella e
// index.html li collega con lo stesso codice. I campi vuoti non si mostrano; «mai visitato» solo se la data
// delle visite è stata letta davvero.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'elenco-cantieri-tel.js'), 'utf8');
const aiuto = fs.readFileSync(path.join(dir, 'aiuto.js'), 'utf8');
const deploy = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_13_visite_ultima_map.sql'), 'utf8');

/* ── index.html: lo script c'è, il telefono passa da disegna(), i collegamenti valgono per tutti e due ── */
assert.ok(/<script src="elenco-cantieri-tel\.js\?v=\d+"><\/script>/.test(html), 'lo script è caricato');
const r0 = html.indexOf('function _clRender(){'), r1 = html.indexOf('// ── GIRO A TAPPE', r0);
const render = html.slice(r0, r1);
assert.ok(/const _tel=!!\(window\.ElencoCantieriTel&&ElencoCantieriTel\.attivo\(\)\)/.test(render), 'decide il telefono');
assert.ok(/ElencoCantieriTel\.disegna\(\{tbody,unita:_unita,shown:_shown,all,/.test(render), 'disegna con le stesse unità della tabella');
assert.ok(/if\(!_tel\)tbody\.innerHTML=_unita\.map/.test(render), 'sul telefono la tabella non si scrive');
assert.ok(/ElencoCantieriTel\.spegni\(tbody\)/.test(render), 'sul PC torna la tabella');
assert.ok(/_cont\.querySelectorAll\('\[data-cant-id\]'\)/.test(render), '«+ Visita» collegato anche sulle schede');
assert.ok(/_cont\.querySelectorAll\('\[data-act="detail-cantiere"\]'\)/.test(render), 'la scheda si apre anche dalle schede');
assert.ok(/ElencoCantieriTel\.svuota\(\)/.test(render), 'nessun cantiere: niente schede vecchie');
assert.ok(/window\._clRender=\(\)=>_clRender\(\)/.test(html), 'il telefono che gira ridisegna');
assert.ok(/sb\.rpc\('visite_ultima_map'\)/.test(html) && /if\(eu\)throw eu/.test(html), 'la data dell\'ultima visita si legge e si controlla l\'errore');

/* ── pubblicazione, nuvolette, database ── */
assert.strictEqual((deploy.match(/elenco-cantieri-tel\.js/g) || []).length, 2, 'il file è nei due elenchi del deploy');
assert.ok(/'t:giro a tappe':/.test(aiuto) && /'t:\+ visita':/.test(aiuto) && /'p:lotti \(':/.test(aiuto), 'le nuvolette nuove ci sono');
assert.ok(/solo_proprie\(\)/.test(sql) && /revoke all on function public\.visite_ultima_map\(\) from public, anon/.test(sql), 'stesse regole di visibilità del conteggio, niente anon');

/* ── le schede ── */
const ctx = { document: { getElementById: () => null }, quartiereBadge: (i, c) => (/^padova$/i.test(c) ? '<span class="q">Q3</span>' : '') };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const T = ctx.ElencoCantieriTel;
assert.strictEqual(T.testoVisite(0, null), 'mai visitato');
assert.strictEqual(T.testoVisite(0, undefined), '0 visite', 'senza la data non si afferma «mai visitato»');
assert.strictEqual(T.testoVisite(1, '2026-10-07'), '1 visita · ultima 07/10/2026');
assert.strictEqual(T.testoVisite(3, undefined), '3 visite');

const sel = new Set(['B']);
const righe = [
  { cantiere_id: 'A', cantiere_etichetta: 'via Arturo Toscanini', cantiere_indirizzo: 'via Arturo Toscanini', cantiere_civico: 'SNC', comune_nome: 'Limena', committente_nome: 'PI s.r.l.', n_visite: 1, ult_visita: '2026-10-09' },
  { cantiere_id: 'B', cantiere_etichetta: 'via Roma', cantiere_indirizzo: 'via Roma', comune_nome: 'Massanzago', committente_nome: 'IMMOBILIARE F2 DI FORMENTIN STEFANO & C.', cantiere_cnce: 'CNCEC9014300405', n_visite: 1, ult_visita: '2026-10-07', lat: 45.5, lng: 11.9 },
  { cantiere_id: 'C', cantiere_etichetta: 'VIA <b>X</b>', comune_nome: 'Padova', n_visite: 0, ult_visita: null, nodo_id: 'NDM-x-CAR' },
];
const o = { unita: righe.map((c) => ({ righe: [c] })), shown: 300, all: righe, apertiTutti: false, aperti: new Set(), giroSel: sel, ordLotto: (l) => String(l || ''), base: (s) => s };
const out = T.html(o);
assert.ok(/<span class="ct-com">Limena<\/span>/.test(out) && /<h3 class="ct-tit">via Arturo Toscanini/.test(out), 'comune in alto, indirizzo come titolo');
assert.ok(!/CNCE[^"]*<\/span>[^<]*–/.test(out) && !/>–</.test(out), 'nessun campo vuoto col trattino');
assert.ok(/IMMOBILIARE F2 DI FORMENTIN STEFANO &amp; C\./.test(out), 'il committente è scritto in sicurezza');
assert.ok(/VIA &lt;b&gt;X&lt;\/b&gt;/.test(out), 'l\'etichetta è scritta in sicurezza');
assert.ok(/data-id="B"[^>]*checked/.test(out) && !/data-id="A"[^>]*checked/.test(out), 'il giro a tappe ricorda le spunte');
assert.ok(/class="giro-chk" data-id="B" data-lat="45.5" data-lng="11.9" data-addr="via Roma, Massanzago"/.test(out), 'la casella del giro porta gli stessi dati della tabella');
assert.ok(/onchange="_giroToggle\(this\)"/.test(out), 'la casella usa il giro a tappe di sempre');
assert.ok(/data-cant-id="A" data-cant-label="via Arturo Toscanini" data-cant-detail="via Arturo Toscanini SNC – Limena">\+ Visita</.test(out), '«+ Visita» con gli stessi dati della tabella');
assert.ok(/data-act="detail-cantiere" data-id="A">Apri scheda</.test(out), 'Apri scheda');
assert.ok(/cod\. NDM-x-CAR/.test(out) && /mai visitato/.test(out) && /<span class="q">Q3<\/span>/.test(out), 'codice univoco solo se c\'è, mai visitato, quartiere');
assert.strictEqual((out.match(/ct-com">/g) || []).length, 3, 'una scheda per cantiere');
assert.ok(!/btn-cant-more/.test(out), 'nessun «mostra tutti» se sono tutti');
const tagliato = T.html(Object.assign({}, o, { shown: 2 }));
assert.strictEqual((tagliato.match(/ct-com">/g) || []).length, 2, 'si taglia come la tabella');
assert.ok(/id="btn-cant-more"[^>]*>Mostra tutti i 3 cantieri \(altri 1\)/.test(tagliato), 'il «mostra tutti» ha l\'id che index.html collega');

/* complesso con lotti: chiuso di norma, i lotti col loro «+ Visita» */
const l1 = { cantiere_id: 'L1', cantiere_etichetta: 'via Boccaccio – lotto 1', comune_nome: 'Padova', lotto: '1', n_visite: 2, ult_visita: '2026-09-01', cantiere_cnce: 'CNCEC1' };
const l2 = { cantiere_id: 'L2', cantiere_etichetta: 'via Boccaccio – lotto 2', comune_nome: 'Padova', lotto: '2', n_visite: 1, ult_visita: '2026-10-01', cantiere_cnce: 'CNCEC1' };
const oc = Object.assign({}, o, { unita: [{ k: 'cnce:CNCEC1', righe: [l2, l1] }], all: [l1, l2] });
const comp = T.html(oc);
assert.ok(/complesso, 2 lotti/.test(comp) && /3 visite · ultima 01\/10\/2026/.test(comp), 'il complesso somma le visite e dice l\'ultima');
assert.ok(/data-ct-lotti="cnce:CNCEC1" aria-expanded="false">Lotti \(2\) ▾/.test(comp) && /data-ct-of="cnce:CNCEC1" hidden/.test(comp), 'lotti chiusi di norma');
assert.ok(comp.indexOf('lotto 1') < comp.indexOf('lotto 2'), 'lotti in ordine');
assert.strictEqual((comp.match(/data-cant-id=/g) || []).length, 2, 'il «+ Visita» sta sui lotti, non sul complesso');
assert.ok(/data-ct-of="cnce:CNCEC1">/.test(T.html(Object.assign({}, oc, { apertiTutti: true }))), 'con una ricerca i lotti sono aperti');

/* segnalato: navigatore, niente «+ Visita» */
const segn = T.html(Object.assign({}, o, { unita: [{ righe: [{ _segn: true, cantiere_id: 'S1', label: 'Ponteggio <x>', lat: 45.4, lng: 11.8, seg_tec: 'Caon' }] }], all: [{}] }));
assert.ok(/📍 Ponteggio &lt;x&gt;/.test(segn) && /🧭 Naviga/.test(segn) && !/data-cant-id/.test(segn), 'segnalato');

console.log('elenco-cantieri-tel: ok');
