// node test/rettifica-invio.test.cjs
// (12/11/2026, deciso dall'utente dal verbale CPT/26_27/0093) La rettifica si decide al momento dell'invio, da
// qualunque pulsante: si confrontano i dati stampati sul verbale con quelli dell'ultimo invio. Cambiato qualcosa →
// rettifica; niente → nuovo invio della stessa versione («copia»), senza dicitura. Chi ha ricevuto una versione
// precedente torna in fondo all'elenco, senza spunta.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const R = require(path.join(dir, 'rettifica-invio.js'));
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(dir, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

/* un verbale come lo prepara VerbalePDF.prepara (i soli campi che servono) */
const base = () => ({
  dataOggi: '11/11/2026', rettBanner: null, bozza: false,
  nrVerbale: 'CPT/26_27/0093', dataVisita: '11/11/2026', impNome: 'Seico', cantDetail: 'via Caboto SNC – LEGNARO',
  etichetta: 'via Caboto', tecNome: 'Franco Caon', tecEmail: 'franco.caon@x', tipoAcc: 'Programmata', accesso: '1',
  figure: [['Resp. dei lavori', 'Geom. Marco Carraro', 'info@carrarosicurezzacantieri.com', '340 3813287'],
    ['CSE', 'Geom. Marco Carraro', 'info@carrarosicurezzacantieri.com', '340 3813287']],
  cantiere: [['Indirizzo', 'via Caboto', 'N° civico', 'SNC'], ['Comune', 'LEGNARO', 'CAP', '35020']],
  imprese: [{ n: 1, nome: 'Seico', ruolo: 'Affidataria', piva: '01234567890', cf: '–', nrLav: 3, email: 'sedilscarl@gmail.com', note: '' }],
  lavorazioni: 'Strutture', noteLav: '–', ossTec: 'Tutto in ordine',
  ipc: { label: 'BASSO', bg: [1, 2, 3], ncp: 0, ncn: 0, oss: 1, ver: 9, msg: 'testo fisso', tinta: [4, 5, 6] },
  zone: [{ label: 'Impianti di cantiere', gruppi: [{ label: 'Logistica', nota: '', voci: [
    { desc: 'Recinzione', val: 'VER', nota: '', articolo: '' },
    { desc: 'Baracca', val: 'OSS', nota: 'da sistemare', articolo: 'art. 96 D.Lgs. 81/2008' }] }] }],
  sanzione: null, stima: { totale: 100 }, corpo: ['Il giorno …']
});
const N = (pd, foto) => R.normalizza(pd, foto || 'f1');

/* stessa versione: data di stampa, dicitura di rettifica, articoli e sanzioni non contano */
{
  const a = base(), b = base();
  b.dataOggi = '12/11/2026'; b.rettBanner = 'Sostituisce…'; b.stima = { totale: 999 };
  b.zone[0].gruppi[0].voci[1].articolo = 'art. 96 aggiornato'; b.ipc.msg = 'altro testo'; b.corpo = ['x'];
  assert.deepStrictEqual(R.differenze(N(a), N(b)), [], 'stampa, dicitura, articoli e sanzioni non fanno una rettifica');
}
/* il caso del 0093: il titolo e i recapiti del coordinatore, e l'indirizzo del cantiere letto dall'anagrafica */
{
  const a = base(), b = base();
  b.figure = [['Resp. dei lavori', 'Ing. Marco Carraro', '–', '–'], ['CSE', 'Ing. Marco Carraro', '–', '–']];
  b.cantDetail = 'via Cavour SNC – LEGNARO'; b.cantiere[0][1] = 'via Cavour';
  const d = R.differenze(N(a), N(b));
  assert.ok(d.includes('CSE: Geom. Marco Carraro → Ing. Marco Carraro'), 'il titolo stampato è una modifica: ' + d);
  assert.ok(d.includes('CSE – e-mail: info@carrarosicurezzacantieri.com → —'), 'anche l’e-mail tolta');
  assert.ok(d.some((x) => /^Cantiere – Indirizzo: via Caboto → via Cavour$/.test(x)), 'l’indirizzo del cantiere cambiato in anagrafica');
}
/* il solo titolo basta (prima la copia della maschera lo saltava) */
{
  const a = base(), b = base();
  b.figure[1] = ['CSE', 'Ing. Marco Carraro', 'info@carrarosicurezzacantieri.com', '340 3813287'];
  assert.strictEqual(R.differenze(N(a), N(b)).length, 1, 'il solo titolo fa una rettifica');
}
/* check-list, note, imprese, foto */
{
  const a = base(), b = base();
  b.zone[0].gruppi[0].voci[1].val = 'NC-'; b.zone[0].gruppi[0].voci[1].nota = 'grave';
  b.imprese[0].nrLav = 4; b.imprese.push({ n: 2, nome: 'Altra', ruolo: 'Esecutrice', piva: '1', cf: '–', nrLav: 1, email: '–', note: '' });
  b.ipc.label = 'MEDIO';
  const d = R.differenze(N(a), N(b, 'f2'));
  for (const atteso of ['Check-list «Baracca»: OSS → NC-', 'Nota a «Baracca»: «da sistemare» → «grave»', 'Impresa 1 (Seico) – lavoratori: 3 → 4',
    'Impresa 2 aggiunta: Altra', 'IPC: BASSO → MEDIO', 'Foto del verbale cambiate'])
    assert.ok(d.includes(atteso), 'manca «' + atteso + '» in ' + JSON.stringify(d));
}
/* chi ha ricevuto una versione precedente torna in fondo, senza spunta; l'ufficio no */
{
  const attuali = [{ ruolo: 'Impresa', nome: 'Seico', email: 'sedilscarl@gmail.com' }, { ruolo: 'CPT', nome: 'Ufficio', email: 'cpt@formedilpadova.it' }];
  const invii = [{ dest: [{ ruolo: 'CSE', nome: 'Marco Carraro', email: 'info@carrarosicurezzacantieri.com' },
    { ruolo: 'Impresa', nome: 'Seico', email: 'SEDILSCARL@gmail.com' }, { ruolo: 'CPT', nome: 'Ufficio', email: 'cpt@formedilpadova.it' }] },
  { email_dest: ['info@carrarosicurezzacantieri.com', 'sedilscarl@pec.it'] }];
  const l = R.conPrecedenti(attuali, invii);
  assert.strictEqual(l.length, 4, JSON.stringify(l));
  assert.deepStrictEqual(l.filter((e) => e.precedente).map((e) => [e.email, e.escluso]),
    [['info@carrarosicurezzacantieri.com', true], ['sedilscarl@pec.it', true]], 'il Geom. e la PEC, senza spunta');
}

/* la pagina usa le regole */
assert.ok(html.includes('<script src="rettifica-invio.js?v='), 'la pagina carica rettifica-invio.js');
assert.ok(/async function inviEmailVerbaleFromList\(vid,opz\)\{[\s\S]*?\n  await _evApri\(\)\n\}/.test(html), 'dall’elenco l’invio passa dalla valutazione');
assert.ok(/async function inviEmailVerbale\(opz\)\{[\s\S]*?\n  await _evApri\(opz&&opz\.valutazione\)\n\}/.test(html), 'dalla maschera anche');
assert.ok(!/show\('modal-email-verbale'\)\n\}\n/.test(html.slice(html.indexOf('async function inviEmailVerbaleFromList'), html.indexOf('// ── RETTIFICA VERBALE GIÀ INVIATO'))), 'nessuna strada apre la finestra senza valutazione');
assert.ok(/if\(ultimo\.pdf_dati\)modifiche=RettificaInvio\.differenze\(ultimo\.pdf_dati,dati\)/.test(html), 'si confronta coi dati stampati dell’ultimo invio');
assert.ok(/modifiche=diffSnapRettifica\(ultimo\.snapshot,sr\.snapshot,\{titoli:true\}\)/.test(html), 'per gli invii vecchi la copia della maschera, titoli compresi');
assert.ok(/if\(!_reinvio&&\(_val\.stato==='rettifica'\|\|_val\.stato==='da-chiedere'\)&&!_rett&&!_stessa\)\{toast\('Invio fermato/.test(html), 'un verbale cambiato non parte come primo invio');
assert.ok(/if\(!_reinvio&&!_val\)\{toast\('Invio fermato/.test(html), 'senza valutazione non parte');
assert.ok(/pdf_dati:\(window\._pdfDatiConfronto&&window\._pdfDatiConfronto\.vid===vid\)\?window\._pdfDatiConfronto\.dati:null/.test(html), 'l’invio salva ciò che era stampato');
assert.ok(/if\(output==='dati'\)return _datiConfronto\n\s+const doc=window\.VerbalePDF\.crea/.test(html), 'genPDF in modalità dati non disegna');
assert.ok(/if\(eChk\)throw new Error\('Errore caricamento check-list/.test(html), 'una check-list non letta non è vuota');

console.log('rettifica-invio: ok');
