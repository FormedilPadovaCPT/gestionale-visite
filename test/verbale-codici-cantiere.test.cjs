// node test/verbale-codici-cantiere.test.cjs
// Il verbale stampa tipo intervento, tipo opera e durata con le stesse parole della scheda del cantiere.
// Fino al 30/09/2026 la durata del verbale era la tabella a cinque fasce di Access: «da 12 a 24 mesi»
// (codice 4) usciva come «da 6 a 12 mesi».
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VerbalePDF = require('../verbale-pdf.js');

/* le tabelle vere, lette da app-data.js */
const src = fs.readFileSync(path.join(__dirname, '..', 'app-data.js'), 'utf8');
const tabella = (nome) => {
  const m = src.match(new RegExp('const ' + nome + '=(\{[^}]*\})'));
  assert.ok(m, nome + ' non trovata in app-data.js');
  return Function('return ' + m[1])();
};
const DURATA = tabella('DURATA_LABELS');
const TIP_OPE = tabella('TIP_OPE_LABELS');
const TIP_INT = tabella('TIP_INT_LABELS');

const campo = (cant, etichetta) => {
  const d = VerbalePDF.prepara({ v: { visita_id: 'x', cantieri: cant }, imps: [], chk: [], lavs: [], voci: [], tec2: null, rettBanner: null });
  for (const riga of d.cantiere) {
    for (let i = 0; i < riga.length; i += 2) if (riga[i] === etichetta) return riga[i + 1];
  }
  throw new Error('campo non trovato: ' + etichetta);
};
const uguali = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

for (const [k, v] of Object.entries(DURATA)) assert.ok(uguali(campo({ cantiere_durata: +k }, 'Durata cantiere'), v), `durata ${k}: atteso «${v}»`);
for (const [k, v] of Object.entries(TIP_OPE)) assert.ok(uguali(campo({ cantiere_tip_ope: +k }, 'Tipo opera'), v), `tipo opera ${k}: atteso «${v}»`);
for (const [k, v] of Object.entries(TIP_INT)) assert.ok(uguali(campo({ cantiere_tip_int: +k }, 'Tipo intervento'), v), `tipo intervento ${k}: atteso «${v}»`);

/* il caso che ha fatto scoprire il difetto */
assert.strictEqual(campo({ cantiere_durata: 4 }, 'Durata cantiere'), 'da 12 a 24 mesi');

/* conta quello che risultava nella visita (30/09/2026); il cantiere solo se la visita non lo dice */
const campoVisita = (v, cant, etichetta) => {
  const d = VerbalePDF.prepara({ v: Object.assign({ visita_id: 'x', cantieri: cant }, v), imps: [], chk: [], lavs: [], voci: [], tec2: null, rettBanner: null });
  for (const riga of d.cantiere) for (let i = 0; i < riga.length; i += 2) if (riga[i] === etichetta) return riga[i + 1];
};
assert.strictEqual(campoVisita({ vis_durata: 5 }, { cantiere_durata: 3 }, 'Durata cantiere'), 'da 24 a 36 mesi');
assert.strictEqual(campoVisita({ vis_durata: null }, { cantiere_durata: 3 }, 'Durata cantiere'), 'da 3 a 12 mesi');
assert.strictEqual(campoVisita({ vis_tip_int: 2 }, { cantiere_tip_int: 1 }, 'Tipo intervento'), 'Ristrutturazione');

console.log('verbale-codici-cantiere: ok');
