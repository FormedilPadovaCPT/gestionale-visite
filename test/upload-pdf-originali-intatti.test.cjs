/* upload-pdf non sovrascrive mai un verbale storico (11/11/2026, rianalisi R224).
   Il 28/10, il 03/11 e il 05/11/2026 la funzione ha sostituito il contenuto degli originali di
   0697, 0716, 0731 e 0811 (ES 2025-26): li cercava per prefisso di nome quando non trovava il
   `visita_id`. Qui si prova la scelta del file (scelta.js) sui casi veri dell'archivio, e che la
   funzione tocchi solo il file che la scelta le dà.
   UPLOAD_PDF_DIR permette di puntare il test a un'altra copia della funzione: sulla versione di
   prima dell'11/11 deve fallire. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const dir = process.env.UPLOAD_PDF_DIR || path.join(__dirname, '..', 'supabase', 'functions', 'upload-pdf');

(async () => {
  const fn = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(fs.existsSync(path.join(dir, 'scelta.js')), 'la scelta del file sta in scelta.js');
  const S = await import(pathToFileURL(path.join(dir, 'scelta.js')).href);

  const VID = 'V-2026-000697';
  const NOME = 'Verbale_0697_IMPRESA BARZON_Padova_Camuffo_2026 06 08.pdf';
  const f = (id, name, visita_id, impronta) => ({ id, name, appProperties: visita_id ? { visita_id, ...(impronta ? { impronta } : {}) } : undefined });

  /* 1. Il caso del 28/10: l'originale del modulo, senza visita_id, con lo STESSO nome che darebbe il
        gestionale. Prima veniva sostituito. Ora resta com'è e il PDF nuovo gli si crea accanto. */
  {
    const orig = f('orig', NOME);
    const r = S.scegli({ nome: NOME, visitaId: VID, perId: [], perPrefisso: [orig] });
    assert.strictEqual(r.esist, null, 'un file trovato solo per prefisso non si tocca mai');
    assert.strictEqual(r.nome, 'Verbale_0697_IMPRESA BARZON_Padova_Camuffo_2026 06 08_rigenerazione-gestionale-1.pdf', 'stesso nome: il nuovo prende il suffisso');
    assert.deepStrictEqual(r.originali, [NOME], 'la risposta dice quale originale è rimasto intatto');
  }

  /* 2. Mount case-insensitive: «ICM spa» e «ICM Spa» sono lo stesso file sul PC (caso del 13/08). */
  {
    const orig = f('orig', NOME.toUpperCase().replace('.PDF', '.pdf'));
    const r = S.scegli({ nome: NOME, visitaId: VID, perPrefisso: [orig] });
    assert.notStrictEqual(r.nome.toLowerCase(), orig.name.toLowerCase(), 'il nome si confronta a maiuscole ignorate');
    assert.ok(r.nome.endsWith('_rigenerazione-gestionale-1.pdf'));
  }

  /* 3. Nome diverso dall'originale (impresa scritta in un altro modo): niente suffisso, ma si crea accanto. */
  {
    const orig = f('orig', 'Verbale_0697_BARZON_Padova_cm_2026 06 08.pdf');
    const r = S.scegli({ nome: NOME, visitaId: VID, perPrefisso: [orig] });
    assert.strictEqual(r.esist, null);
    assert.strictEqual(r.nome, NOME);
    assert.deepStrictEqual(r.originali, [orig.name]);
  }

  /* 4. Com'è oggi dopo il recupero R224: il file del gestionale (col suo visita_id) e l'originale
        recuperato accanto con `_versione-sostituita`. Si riusa il file del gestionale, l'altro no. */
  {
    const nostro = f('nostro', NOME, VID, 'abc');
    const rec = f('rec', NOME.replace('.pdf', '_versione-sostituita.pdf'));
    const r = S.scegli({ nome: NOME, visitaId: VID, perId: [nostro], perPrefisso: [nostro, rec] });
    assert.strictEqual(r.esist && r.esist.id, 'nostro', 'il file del gestionale si riusa');
    assert.strictEqual(r.nome, NOME, 'e tiene il suo nome');
    assert.deepStrictEqual(r.originali, [rec.name]);
  }

  /* 5. Anche col visita_id, un file con un suffisso messo a mano non è più del gestionale. */
  for (const nome of [
    NOME.replace('.pdf', '_versione-sostituita.pdf'),
    NOME.replace('.pdf', '_rigenerazione-form-1.pdf'),
    NOME.replace('.pdf', '_DUPLICATO-NUMERO.pdf'),
    'Verbale_0076-form_ROSSI_Este_cf_2020 05 12.pdf',
    'Verbale_0140-cf_ROSSI_Este_cf_2019 10 01.pdf',
  ]) {
    assert.strictEqual(S.eNostro(f('x', nome, VID), VID), false, 'non si tocca: ' + nome);
    const r = S.scegli({ nome: NOME, visitaId: VID, perId: [f('x', nome, VID)], perPrefisso: [] });
    assert.strictEqual(r.esist, null, 'si crea un file nuovo invece di toccare ' + nome);
  }
  /* il visita_id di un'altra visita non vale */
  assert.strictEqual(S.eNostro(f('x', NOME, 'V-ALTRA'), VID), false);
  assert.strictEqual(S.eNostro(f('x', NOME, VID), VID), true);

  /* 6. Il file del gestionale col suffisso resta stabile: non torna sul nome dell'originale. */
  {
    const orig = f('orig', NOME);
    const nostro = f('nostro', NOME.replace('.pdf', '_rigenerazione-gestionale-1.pdf'), VID, 'abc');
    const r = S.scegli({ nome: NOME, visitaId: VID, perId: [nostro], perPrefisso: [orig, nostro] });
    assert.strictEqual(r.esist.id, 'nostro');
    assert.strictEqual(r.nome, nostro.name, 'nessuna rinomina sopra l’originale');
    /* suffisso già preso da un file non nostro: si va al numero dopo */
    const intruso = f('intr', NOME.replace('.pdf', '_rigenerazione-gestionale-1.pdf'));
    const r2 = S.scegli({ nome: NOME, visitaId: VID, perPrefisso: [orig, intruso] });
    assert.ok(r2.nome.endsWith('_rigenerazione-gestionale-2.pdf'));
  }

  /* 7. Il prefisso: solo Verbale_NNNN_, le serie parallele restano fuori anche dalla ricerca. */
  assert.strictEqual(S.prefisso(NOME), 'Verbale_0697_');
  assert.strictEqual(S.prefisso('Verbale_0076-form_X_Y_Z_2020 05 12.pdf'), null);

  /* 8. La funzione: il file da sostituire o rinominare viene SOLO dalla scelta. */
  assert.ok(/import \{ scegli, prefisso \} from '\.\/scelta\.js'/.test(fn), 'la funzione usa scelta.js');
  assert.ok(/const esist: any = scelta\.esist/.test(fn), 'il file da toccare è quello che dà la scelta');
  assert.ok(!/esist = \(await cerca\(/.test(fn), 'nessun file preso direttamente da una ricerca');
  assert.ok(!/\.find\(\(f\) => String\(f\.name\)\.startsWith\(pref\)\)/.test(fn), 'niente più «il primo trovato per prefisso»');
  assert.ok(/multipart\(\{ name: nomeFile, appProperties: props \}, pdfBytes\)/.test(fn), 'sostituzione col nome libero');
  assert.ok(/multipart\(\{ name: nomeFile, parents: \[dove\], appProperties: props \}, pdfBytes\)/.test(fn), 'creazione col nome libero');
  assert.ok(/body: JSON\.stringify\(\{ name: nomeFile \}\)/.test(fn), 'rinomina col nome libero');
  assert.ok(/scelta\.originali\.length \? 'creato_accanto' : 'creato'/.test(fn), 'la risposta dice «creato accanto all’originale»');
  assert.ok(/creato accanto all\\'originale/.test(fn) && /originali_intatti/.test(fn));

  console.log('ok upload-pdf-originali-intatti');
})().catch((e) => { console.error(e); process.exit(1); });
