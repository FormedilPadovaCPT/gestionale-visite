// Quale file dell'archivio dei verbali puo' toccare upload-pdf, e con che nome (11/11/2026).
// Modulo puro, senza rete: lo usa la funzione upload-pdf e lo provano i test del repo
// (test/upload-pdf-originali-intatti.test.cjs).
//
// PERCHE'. Fino all'11/11/2026 la funzione cercava il file del verbale per `visita_id` e, se non lo
// trovava, per prefisso di nome («Verbale_0697_»), poi ne SOSTITUIVA il contenuto. I verbali storici
// portati a mano nell'archivio non hanno `visita_id`: rigenerarli o inviarli dal gestionale cancellava
// l'originale del modulo mandato all'impresa. E' successo il 28/10, il 03/11 e il 05/11/2026 ai verbali
// 0697, 0716, 0731 e 0811 dell'ES 2025-2026 (recuperati dalla cronologia di Drive, rianalisi R224).
//
// LA REGOLA, adesso:
//  · il gestionale tocca (sostituisce o rinomina) SOLO un file che e' suo: porta il suo `visita_id`
//    nelle appProperties E ha un nome che il gestionale da'. Un nome con un suffisso messo a mano
//    (`_versione-sostituita`, `_rigenerazione-form-1`, `_DUPLICATO-NUMERO`…) o di una serie parallela
//    (`Verbale_0076-form_`, `Verbale_0140-cf_`) vuol dire che una persona l'ha preso in carico: non si
//    tocca piu', anche se ha il `visita_id`;
//  · un file trovato solo per prefisso di nome non si tocca MAI: il PDF del gestionale si crea accanto,
//    come file nuovo col suo `visita_id`;
//  · se il nome che il gestionale darebbe e' gia' preso da un altro file (a maiuscole ignorate: il mount
//    di Drive e' case-insensitive e un nome uguale sul PC sovrascrive in silenzio, caso del 13/08/2026),
//    il PDF del gestionale prende il suffisso `_rigenerazione-gestionale-N`, il primo N libero. E' la
//    stessa famiglia di `_rigenerazione-form-N` (il Form Publisher che rigenera lo stesso verbale): come
//    li', il file SENZA suffisso resta l'originale, e quello col suffisso dichiara di essere una
//    rigenerazione. Il suffisso va sul file nuovo e non sull'originale perche' l'originale non si tocca.

/* I nomi che dà il gestionale (nomeArchivio), con l'eventuale suffisso che dà questo modulo. */
export const NOME_GESTIONALE = /^Verbale_(\d{4}|SN)_.+_(\d{4} \d{2} \d{2}|data-non-indicata)(_rigenerazione-gestionale-\d+)?\.pdf$/i

export const SUFFISSO = '_rigenerazione-gestionale-'

/* «Verbale_0697_» (o «Verbale_SN_»): il prefisso con cui si cercano i file dello stesso numero.
   Le serie parallele («Verbale_0076-form_») non cominciano cosi' e restano fuori anche dalla ricerca. */
export function prefisso(nome) {
  const m = /^(Verbale_(\d{4}|SN)_)/.exec(String(nome || ''))
  return m ? m[1] : null
}

/* Il file e' del gestionale e si puo' sostituire o rinominare. */
export function eNostro(f, visitaId) {
  if (!f || !visitaId) return false
  const vid = f.appProperties && f.appProperties.visita_id
  return !!vid && String(vid) === String(visitaId) && NOME_GESTIONALE.test(String(f.name || ''))
}

/* Il primo nome libero a maiuscole ignorate: `nome` se nessun altro file lo ha, altrimenti
   `…_rigenerazione-gestionale-1.pdf`, `-2`, … */
export function nomeLibero(nome, occupati) {
  const presi = new Set((occupati || []).map((n) => String(n).toLowerCase()))
  if (!presi.has(String(nome).toLowerCase())) return nome
  const base = String(nome).replace(/\.pdf$/i, '')
  for (let n = 1; n < 1000; n++) {
    const c = `${base}${SUFFISSO}${n}.pdf`
    if (!presi.has(c.toLowerCase())) return c
  }
  throw new Error('nessun nome libero per ' + nome)
}

/* La scelta, dati i file trovati nella cartella.
   - perId:       file con appProperties visita_id = questa visita
   - perPrefisso: file il cui nome comincia col prefisso del numero (Verbale_NNNN_)
   Restituisce:
   - esist:      il file del gestionale da riusare (sostituire o lasciare), oppure null = se ne crea uno
   - nome:       il nome da dare (al file riusato o a quello nuovo), mai uguale a un altro file
   - originali:  i nomi dei file dello stesso numero che NON sono del gestionale e restano intatti */
export function scegli({ nome, visitaId, perId = [], perPrefisso = [] }) {
  const tutti = new Map()
  for (const f of [...perId, ...perPrefisso]) if (f && f.id) tutti.set(f.id, f)
  const esist = [...tutti.values()].find((f) => eNostro(f, visitaId)) || null
  const altri = [...tutti.values()].filter((f) => !esist || f.id !== esist.id)
  const nomeFile = nomeLibero(nome, altri.map((f) => f.name))
  const originali = altri.filter((f) => !eNostro(f, visitaId)).map((f) => String(f.name || ''))
  return { esist, nome: nomeFile, originali }
}
