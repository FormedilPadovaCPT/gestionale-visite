// node test/fuori-procedura.test.cjs
// (13/10/2026, scelte dell'utente) VISITE FUORI PROCEDURA. Il tecnico che sceglie, per una visita ordinaria, un
// cantiere archiviato dalla procedura da meno del tempo adeguato (30 gg C.E.I.V. attiva, 90 altrimenti) o torna più
// di una settimana prima del rientro dovuto, riceve l'avviso con i rientri dovuti nella sua zona e scrive il motivo.
// Il motivo è interno (mai sul PDF né nella mail); il verbale esce segnato «fuori procedura» e lo approva solo il
// Coordinatore. Con «fase nuova» il database confronta le lavorazioni. La segreteria vede i numeri nei mesi.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const js = fs.readFileSync(path.join(dir, 'fuori-procedura.js'), 'utf8');
const yml = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_13_visite_fuori_procedura.sql'), 'utf8');
const sendv = fs.readFileSync(path.join(dir, 'supabase', 'functions', 'send-verbale', 'index.ts'), 'utf8');
const critici = fs.readFileSync(path.join(dir, 'cantieri-critici-coord.js'), 'utf8');
const aiuto = fs.readFileSync(path.join(dir, 'aiuto.js'), 'utf8');
/* la segreteria è un altro repo: in locale sta accanto, nel workflow di GitHub no (il primo run del 13/10 è caduto qui) */
const segPath = path.join(dir, '..', 'segreteria-app', 'js', 'fatture-tecnici.js');
const seg = fs.existsSync(segPath) ? fs.readFileSync(segPath, 'utf8') : null;

/* ── il modulo ── */
const finto = () => ({ style: {}, value: '', checked: false, innerHTML: '', remove() {}, focus() {}, querySelector: finto });
const ctx = { document: { getElementById: () => null, querySelector: () => null, createElement: finto, body: { appendChild() {} } }, prompt: () => null, alert() {} };
ctx.window = ctx; ctx.S = { fd: {}, user: { email: 'x@y' } };
ctx.vGet = (id) => ({ 'f-tipo': '5', 'f-prot-int': '' })[id] || '';
vm.createContext(ctx); vm.runInContext(js, ctx);
const F = ctx.FuoriProcedura;
assert.ok(F && ['controlla', 'apriAvviso', 'pronto', 'campi', 'daSnap', 'dopoChiusura', 'serieProposta', 'boxCoord', 'decidi', 'badge', 'dettaglio'].every((k) => typeof F[k] === 'function'), 'il modulo espone le sue funzioni');
assert.strictEqual(F.MOTIVI.map((m) => m[0]).join(','), 'fase_nuova,impresa_nuova,richiesta,rischio,altro', 'i cinque motivi decisi');
assert.strictEqual(F.etichettaTipo('archiviato'), 'cantiere archiviato');
assert.strictEqual(F.etichettaTipo('anticipato'), 'rientro anticipato');
/* ordinaria = tipo 5 o 7 senza incarico */
assert.strictEqual(F.ordinaria(), true, 'tipo 5 senza incarico è ordinaria');
ctx.vGet = (id) => ({ 'f-tipo': '8', 'f-prot-int': '' })[id] || '';
assert.strictEqual(F.ordinaria(), false, 'una visita in serie non è ordinaria');
ctx.vGet = (id) => ({ 'f-tipo': '7', 'f-prot-int': '1234' })[id] || '';
assert.strictEqual(F.ordinaria(), false, 'con un incarico non è ordinaria');
ctx.vGet = (id) => ({ 'f-tipo': '7', 'f-prot-int': '' })[id] || '';
/* senza motivo non si salva; con motivo i campi vanno nel verbale */
ctx.S.fd.fp = { cantiere: 'c1', tipo: 'archiviato', motivo_tipo: null, motivo: '', serie: false, info: {} };
let avvisi = []; ctx.toast = (m) => avvisi.push(m);
assert.strictEqual(F.pronto(), false, 'fuori procedura senza motivo: non si salva');
assert.ok(avvisi.some((m) => /scrivi il motivo/.test(m)), 'e lo dice');
ctx.S.fd.fp.motivo_tipo = 'fase_nuova'; ctx.S.fd.fp.motivo = 'Iniziate le finiture'; ctx.S.fd.fp.serie = true;
assert.strictEqual(F.pronto(), true);
assert.strictEqual(JSON.stringify(F.campi()), JSON.stringify({ fp_motivo_tipo: 'fase_nuova', fp_motivo: 'Iniziate le finiture', fp_serie_proposta: true }), 'i campi salvati; fp_tipo lo mette il database');
assert.strictEqual(F.serieProposta(), true);
ctx.vGet = (id) => ({ 'f-tipo': '9', 'f-prot-int': '' })[id] || '';
assert.strictEqual(JSON.stringify(F.campi()), JSON.stringify({ fp_motivo_tipo: null, fp_motivo: null, fp_serie_proposta: false }), 'se il tipo non è più ordinario i campi non partono');
assert.strictEqual(F.pronto(), true, 'e il salvataggio non si ferma');
/* badge e dettaglio */
assert.ok(/in attesa del Coordinatore/.test(F.badge({ fp_tipo: 'archiviato' })), 'etichetta nell\'elenco');
assert.strictEqual(F.badge({ fp_tipo: null }), '', 'niente etichetta se non è fuori procedura');
assert.ok(F.dettaglio({ fp_tipo: 'anticipato', fp_motivo_tipo: 'fase_nuova', fp_lavorazioni_uguali: true }).some(([k, v]) => k === 'Lavorazioni' && /uguali/.test(v)), 'le lavorazioni uguali si vedono nel dettaglio');
assert.ok(/sb\.rpc\('fp_controllo', \{ p_cantiere_id: cantId, p_data: data, p_visita_id: vid \}\)/.test(js), 'il controllo lo fa il database');
assert.ok(/sb\.rpc\('fp_rientri_dovuti', \{ p_email: email \}\)/.test(js), 'i rientri dovuti nella zona del tecnico');
assert.ok(/sb\.rpc\('fp_decidi', \{ p_visita_id: vid, p_esito: esito, p_nota: nota \|\| null \}\)/.test(js), 'la decisione passa da fp_decidi');
assert.ok(/if \(!window\.__isCoordinatoreVero\)/.test(js), 'Approvo/Non approvo solo al Coordinatore vero');
assert.ok(/esito === 'non_approvata' && nota\.length < 5/.test(js), 'non approvare vuole il motivo');
assert.ok(/Non sono riuscito a controllare la procedura/.test(js) && /Non sono riuscito a leggere i rientri dovuti/.test(js) && /Non sono riuscito a leggere tutto/.test(js), 'un errore di lettura si dice, non si tace');

/* ── index.html ── */
assert.ok(/id="fp-stato"/.test(html), 'la riga sotto la scheda del cantiere');
assert.ok(/id="adm-fuori-procedura"/.test(html), 'il riquadro nella Zona Coordinatore');
assert.ok(/if\(window\.FuoriProcedura\)await FuoriProcedura\.controlla\(cantId\)/.test(html), 'il controllo parte quando si sceglie il cantiere (autoAccCant)');
assert.ok(/async function _saveVisitaCorpo\(stato\)\{\n  saveTabData\(\)\n[^\n]*\n  if\(window\.FuoriProcedura&&!FuoriProcedura\.pronto\(\)\)return/.test(html), 'senza motivo non si salva');
assert.ok(/\.\.\.\(window\.FuoriProcedura\?FuoriProcedura\.campi\(\):\{\}\),/.test(html), 'i campi vanno nel verbale');
assert.ok(/if\(_cv&&_cv\.ok\)\{stato='definitivo';if\(window\.FuoriProcedura\)FuoriProcedura\.dopoChiusura\(vid\)/.test(html), 'dopo la chiusura si legge che cosa ha deciso il database');
assert.ok(/fp_tipo:v\.fp_tipo\|\|null,fp_motivo_tipo:v\.fp_motivo_tipo\|\|null/.test(html) && /if\(window\.FuoriProcedura\)FuoriProcedura\.daSnap\(snap\)/.test(html), 'la bozza riaperta porta il suo motivo');
assert.ok(/\['fp_tipo','fp_motivo_tipo','fp_motivo','fp_serie_proposta','fp_rif_visita_id','fp_esito'\]\.forEach\(k=>delete snap\[k\]\)/.test(html), 'la visita di ritorno nuova non eredita il motivo del verbale vecchio');
assert.ok(/acc_cant,fp_tipo,fp_esito,cantieri\(/.test(html) && /FuoriProcedura\.badge\(v\)/.test(html), 'etichetta nell\'elenco visite');
assert.ok(/qdSec\('⚠️ Fuori procedura \(interno\)'\)\+qdDl\(FuoriProcedura\.dettaglio\(v\)\)/.test(html), 'il dettaglio del verbale lo mostra');
assert.ok((html.match(/window\._evSerie=!!\(window\.FuoriProcedura&&FuoriProcedura\.serieProposta\(\)\)/g) || []).length === 2 && /window\._evSerie=!!v\.fp_serie_proposta/.test(html), 'la serie proposta arriva alla mail dal modulo e dall\'elenco');
assert.ok(/serieProposta: !window\._evRettifica&&!!window\._evSerie,/.test(html), 'e parte con l\'invio');
assert.ok(/window\.isCoordPageUser=isCoordPageUser/.test(html), 'isCoordPageUser raggiungibile dal modulo');
assert.ok(/<script src="fuori-procedura\.js\?v=\d+"><\/script>/.test(html), 'lo script è incluso');
assert.ok(/- 'fuori-procedura\.js'/.test(yml), 'e pubblicato (deploy-pages.yml)');
assert.ok(/window\.FuoriProcedura\.boxCoord\(\)/.test(critici), 'la Zona Coordinatore lo aggiorna con gli altri riquadri');
/* il motivo NON va sul PDF né nella mail */
const pdf = fs.readFileSync(path.join(dir, 'verbale-pdf.js'), 'utf8');
assert.ok(!/fp_motivo|fp_tipo/.test(pdf), 'il PDF non stampa il motivo');
assert.ok(!/fp_motivo/.test(sendv), 'la mail all\'impresa non porta il motivo');
assert.ok(/serieProposta && !rettifica/.test(sendv) && /servizi\/\?pagina=visita/.test(sendv) && /\$\{serieHtml\}/.test(sendv), 'la mail porta l\'invito alla serie, col collegamento al modulo del portale');
['fp-ok', 'fp-altro', 'fp-cambia', 'fp-serie', 't:approvo', 't:non approvo'].forEach((k) => assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta ' + k));

/* ── il database ── */
assert.ok(/add column if not exists fp_tipo text/.test(sql) && /fp_tipo in \('archiviato','anticipato'\)/.test(sql), 'le colonne');
assert.ok(/fin := case when v_ceiv then 30 else 90 end/.test(sql), '30 giorni C.E.I.V. attiva, 90 altrimenti');
assert.ok(/v_ceiv := \(v_cassa = 'Attiva'\)/.test(sql), 'sospesa e cessata contano 90 (eccezione dichiarata)');
assert.ok(/if p_data < dovuto - 7 then tipo := 'anticipato'/.test(sql), 'tolleranza di una settimana sul rientro anticipato');
assert.ok(/new\.tipo_accesso not in \(5, 7\) or new\.incarico_id is not null/.test(sql), 'solo le visite ordinarie senza incarico');
assert.ok(/new\.data_visita < date '2026-10-14'/.test(sql), 'lo storico non si rietichetta');
assert.ok(/if not public\.is_coordinatore\(\) then/.test(sql) && /app\.fp_decidi/.test(sql), 'approva solo il Coordinatore, e l\'esito non si scrive da fuori');
assert.ok(/fp_lavorazioni_uguali/.test(sql) && /new\.fp_motivo_tipo = 'fase_nuova'/.test(sql), 'con fase nuova si confrontano le lavorazioni');
assert.ok(/push_accoda\(v_coord, 'fp_nuova:'/.test(sql) && /push_accoda\(v_mail, 'fp_esito:'/.test(sql), 'push al Coordinatore e al tecnico');
assert.ok(/is_coordinatore\(\) or public\.is_segreteria\(\) as si/.test(sql), 'il riepilogo per tecnico è del Coordinatore e della segreteria');
['fp_controllo(text, date, text)', 'fp_rientri_dovuti(text)', 'fp_riepilogo(date, date)', 'fp_decidi(text, text, text)', 'tg_visite_fuori_procedura()', 'push_fp_coordinatore()', 'fp_controllo_int(text, date, text)'].forEach((f) =>
  assert.ok(sql.includes(`revoke execute on function public.${f} from public, anon`), 'niente anon su ' + f));
assert.ok(/fp_controllo_int\(text, date, text\) from public, anon, authenticated/.test(sql), 'la versione interna non si chiama dall\'app');
assert.ok(/tg_visite_fuori_procedura\(\)\nreturns trigger language plpgsql security definer/.test(sql), 'il trigger è security definer (chiama la versione interna)');

/* ── la segreteria: la colonna dopo «Visite fatte» (solo dove il repo c'è) ── */
if (seg) {
  assert.ok(/sb\.rpc\('fp_riepilogo', \{ p_dal: da, p_al: a \}\)/.test(seg), 'la segreteria legge il riepilogo del mese');
  assert.ok(/<th>Visite fatte<\/th><th title="[^"]*">Fuori procedura<\/th>/.test(seg), 'la colonna sta dopo «Visite fatte»');
  assert.ok(/fp\.error \? '<span class="hint" style="color:var\(--rosso,#c0392b\)"/.test(seg), 'se non si legge lo dice');
  assert.ok(/colspan="8"/.test(seg), 'la riga vuota copre la colonna in più');
} else {
  console.log('fuori-procedura: repo segreteria non presente, colonna non controllata');
}

console.log('fuori-procedura: ok');
