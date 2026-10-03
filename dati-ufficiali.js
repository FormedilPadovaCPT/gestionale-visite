/* ============================================================
   DATI UFFICIALI DELL'IMPRESA DA P.IVA / CODICE FISCALE
   (03/10/2026, chiesto dall'utente: «il tecnico può decidere di
   far arrivare i dati nella scheda impresa invece che scrivere
   ragioni sociali non proprio corrette»)

   Nelle maschere «Nuova impresa» e «Modifica impresa», sotto
   P.IVA e codice fiscale, il tasto «🔎 Dati ufficiali» chiede alla
   funzione dati-impresa-ufficiali che cosa dicono:
     · InfoCamere (Registro Imprese, dati di elevato valore): solo
       società, lun-ven 8-18;
     · VIES (Commissione europea): sempre acceso, anche le ditte
       individuali, ma solo ragione sociale e indirizzo.
   Mostra accanto a ogni campo quello che c'è nella scheda e il dato
   ufficiale, con una spunta. Il tecnico sceglie che cosa riportare;
   «Riporta nella scheda» riempie i campi e NON salva: si salva come
   sempre col 💾. Il codice fiscale di un'impresa che esiste già non
   si cambia da qui (è la chiave): se è diverso lo si dice e basta.

   CAP e provincia non hanno un campo nella maschera: se il comune
   riportato è ancora quello al momento del salvataggio, il
   salvataggio li prende da extra(); stessa cosa per la forma
   giuridica nella maschera di modifica, che la tendina non ce l'ha.

   Script classico, come scheda-impresa.js: usa window.sb e
   window.toast; le funzioni pure si provano in
   test/dati-ufficiali.test.cjs.
   ============================================================ */
(function () {
  'use strict'

  const MASCHERE = {
    mi: { modale: 'modal-imp', nome: 'mi-nome', piva: 'mi-piva', cf: 'mi-cf', ind: 'mi-ind', com: 'mi-com', forma: 'mi-forma', nuova: true },
    ei: { modale: 'modal-edit-imp', nome: 'ei-nome', piva: 'ei-piva', cf: 'ei-cf', ind: 'ei-ind', com: 'ei-com', forma: null, nuova: false },
  }
  const stato = { mi: null, ei: null }   // ultima risposta e ciò che è stato riportato

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // uguali a meno di maiuscole, spazi e punteggiatura: «Via Roma, 3» = «VIA ROMA 3»
  const chiaveConfronto = s => String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')
  const uguali = (a, b) => chiaveConfronto(a) === chiaveConfronto(b)

  const normCodice = s => {
    let x = String(s == null ? '' : s).toUpperCase().replace(/[\s.\-\/]/g, '')
    if (/^IT\d{11}$/.test(x)) x = x.slice(2)
    return x
  }
  const isPiva = s => /^\d{11}$/.test(s)
  const isCf16 = s => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(s)

  // Che cosa si manda alla funzione, dai due campi così come sono scritti.
  // Nella maschera di modifica il campo «P.IVA» mostra la chiave dell'impresa,
  // che dal 15/07 è il codice fiscale: un CF di 16 caratteri lì va spostato.
  function richiesta(pivaGrezza, cfGrezzo) {
    let piva = normCodice(pivaGrezza)
    let cf = normCodice(cfGrezzo)
    if (!isPiva(piva) && isCf16(piva) && !cf) { cf = piva; piva = '' }
    if (!isPiva(piva) && !isCf16(piva)) piva = ''
    if (!isPiva(cf) && !isCf16(cf)) cf = ''
    if (!piva && isPiva(cf)) piva = cf
    return (piva || cf) ? { piva, cf } : null
  }

  const dataIt = s => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '')
  }

  // Dalla risposta della funzione alle righe da mostrare. Funzione pura.
  //   attuali: { nome, piva, cf, ind, com, forma }   nuova: maschera «Nuova impresa»
  function proposte(resp, attuali, nuova) {
    const ic = resp && resp.infocamere && resp.infocamere.esito === 'ok' ? resp.infocamere.dati : null
    const vi = resp && resp.vies && resp.vies.esito === 'ok' ? resp.vies.dati : null
    const pivaValida = resp && resp.vies && resp.vies.esito === 'ok' ? resp.vies.chiave : ''
    const righe = []
    const aggiungi = (campo, etichetta, attuale, ufficiale, fonte, opz) => {
      ufficiale = String(ufficiale || '').trim()
      if (!ufficiale) return
      const o = opz || {}
      const r = { campo, etichetta, attuale: String(attuale || '').trim(), ufficiale, fonte, nota: o.nota || '' }
      if (uguali(r.attuale, ufficiale)) { r.uguale = true }
      else if (o.bloccato) { r.bloccato = o.bloccato }
      else { r.spunta = true }
      righe.push(r)
    }
    const fonteNome = ic && ic.ragione_sociale ? 'InfoCamere' : 'VIES'
    aggiungi('nome', 'Ragione sociale', attuali.nome, (ic && ic.ragione_sociale) || (vi && vi.ragione_sociale), fonteNome)

    if (nuova && !String(attuali.piva || '').trim() && pivaValida) {
      aggiungi('piva', 'Partita IVA', attuali.piva, pivaValida, 'VIES')
    }
    if (ic && ic.cf) {
      const att = String(attuali.cf || '').trim()
      aggiungi('cf', 'Codice fiscale', att, ic.cf, 'InfoCamere',
        !nuova && att ? { bloccato: 'Il codice fiscale è la chiave dell\'impresa: se è sbagliato lo corregge la segreteria con «Cambia la chiave».' } : null)
    }

    const sede = ic && ic.indirizzo ? ic : (vi && vi.indirizzo ? vi : null)
    if (sede) {
      const f = sede === ic ? 'InfoCamere' : 'VIES'
      aggiungi('ind', 'Indirizzo sede', attuali.ind, sede.indirizzo, f)
      const capProv = [sede.cap, sede.prov ? '(' + sede.prov + ')' : ''].filter(Boolean).join(' ')
      aggiungi('com', 'Comune', attuali.com, sede.comune, f, { nota: capProv ? 'con CAP e provincia: ' + capProv : '' })
      const rc = righe.find(r => r.campo === 'com')
      if (rc) { rc.cap = sede.cap || ''; rc.prov = sede.prov || '' }
    }

    if (ic && ic.forma_app) {
      aggiungi('forma', 'Forma giuridica', attuali.forma, ic.forma_app, 'InfoCamere',
        { nota: ic.forma_giuridica && !uguali(ic.forma_giuridica, ic.forma_app) ? ic.forma_giuridica.toLowerCase() : '' })
    }
    return righe
  }

  // Le righe in alto: stato dell'impresa e da dove vengono i dati
  function intestazione(resp) {
    const ic = resp.infocamere || {}, vi = resp.vies || {}
    const out = []
    if (ic.esito === 'ok') {
      const d = ic.dati || {}
      if (/cessat|inattiv|sospes|liquidaz|fallim|scioglim/i.test(d.stato || '')) {
        out.push(`<div class="du-allarme">⚠️ Nel Registro Imprese risulta <b>${esc(d.stato)}</b>.</div>`)
      }
      const info = [
        d.stato ? 'stato: ' + esc(d.stato) : '',
        d.data_registrazione ? 'iscritta dal ' + esc(d.data_registrazione) : '',
        d.nace ? 'attività (NACE) ' + esc(d.nace) : '',
      ].filter(Boolean).join(' · ')
      if (info) out.push(`<div class="du-info">${info}</div>`)
    }
    if (vi.esito === 'non_valida') {
      out.push(`<div class="du-allarme">⚠️ VIES: la partita IVA ${esc(vi.chiave || '')} non risulta attiva.</div>`)
    }
    const riga = (nome, r) => {
      if (!r || !r.esito || r.esito === 'non_interrogato') return ''
      if (r.esito === 'ok') return `<span class="du-ok">✓ ${nome}</span>`
      return `<span class="du-ko" title="${esc(r.messaggio || '')}">✗ ${nome}: ${esc(r.messaggio || r.esito)}</span>`
    }
    out.push(`<div class="du-fonti">${[riga('InfoCamere', ic), riga('VIES', vi)].filter(Boolean).join(' &nbsp; ')}</div>`)
    return out.join('')
  }

  function tabella(righe) {
    if (!righe.length) return '<div class="du-info">Nessun dato da proporre.</div>'
    return `<table class="du-tab"><tr><th></th><th>Campo</th><th>Nella scheda</th><th>Dato ufficiale</th></tr>${righe.map((r, i) => `
      <tr class="${r.uguale ? 'du-uguale' : ''}">
        <td>${r.spunta ? `<input type="checkbox" data-du-riga="${i}" checked>` : (r.uguale ? '✓' : '—')}</td>
        <td>${esc(r.etichetta)}</td>
        <td>${r.attuale ? esc(r.attuale) : '<i style="color:#aaa">vuoto</i>'}</td>
        <td><b>${esc(r.ufficiale)}</b> <span class="du-fonte">${esc(r.fonte)}</span>
          ${r.nota ? `<div class="du-nota">${esc(r.nota)}</div>` : ''}
          ${r.bloccato ? `<div class="du-nota" style="color:#b9770e">${esc(r.bloccato)}</div>` : ''}
          ${r.uguale ? '<div class="du-nota">già uguale</div>' : ''}</td>
      </tr>`).join('')}</table>`
  }

  const $ = id => document.getElementById(id)
  const val = id => { const el = id && $(id); return el ? el.value : '' }
  const imposta = (id, v) => {
    const el = $(id); if (!el) return
    el.value = v
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function attuali(cfg) {
    return { nome: val(cfg.nome), piva: val(cfg.piva), cf: val(cfg.cf), ind: val(cfg.ind), com: val(cfg.com), forma: cfg.forma ? val(cfg.forma) : '' }
  }

  async function cerca(p) {
    const cfg = MASCHERE[p]
    const box = $('du-esito-' + p)
    const req = richiesta(val(cfg.piva), val(cfg.cf))
    if (!req) {
      box.innerHTML = '<div class="du-allarme">Scrivi prima la partita IVA (11 cifre) o il codice fiscale.</div>'
      return
    }
    box.innerHTML = '<div class="du-info">Chiedo a InfoCamere e VIES…</div>'
    let resp
    try {
      const { data, error } = await window.sb.functions.invoke('dati-impresa-ufficiali', { body: req })
      if (error) {
        let msg = error.message || 'errore'
        try { const j = await error.context.json(); if (j && j.error) msg = j.error } catch (_) { /* risposta non JSON */ }
        throw new Error(msg)
      }
      resp = data
    } catch (e) {
      box.innerHTML = `<div class="du-allarme">Non sono riuscito a leggere i dati ufficiali: ${esc(e.message || e)}. Puoi compilare a mano.</div>`
      return
    }
    const righe = proposte(resp, attuali(cfg), cfg.nuova)
    stato[p] = { resp, righe, riportati: null }
    const nessuna = (!resp.infocamere || resp.infocamere.esito !== 'ok') && (!resp.vies || resp.vies.esito !== 'ok')
    box.innerHTML = `<div class="du-pannello">
      ${intestazione(resp)}
      ${nessuna ? '<div class="du-info">Nessuna delle due fonti ha restituito dati: si compila a mano.</div>' : tabella(righe)}
      ${righe.some(r => r.spunta) ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn-primary" id="du-riporta-${p}">⬇️ Riporta nella scheda</button>
        <span class="du-nota">Togli la spunta a ciò che non vuoi. Poi salva col 💾: da solo non salva niente.</span></div>` : ''}
      <div class="du-nota" style="margin-top:6px">Fonti: Registro Imprese – InfoCamere, dati di elevato valore (licenza CC BY 4.0); VIES – Commissione europea.</div>
    </div>`
    const b = $('du-riporta-' + p)
    if (b) b.onclick = () => riporta(p)
  }

  function riporta(p) {
    const cfg = MASCHERE[p], st = stato[p]
    if (!st) return
    const scelte = [...document.querySelectorAll(`#du-esito-${p} [data-du-riga]`)]
      .filter(c => c.checked).map(c => st.righe[+c.dataset.duRiga])
    const rip = {}
    scelte.forEach(r => {
      if (r.campo === 'forma') {
        if (cfg.forma) imposta(cfg.forma, r.ufficiale)
        rip.tipo_impresa = r.ufficiale
      } else if (r.campo === 'com') {
        imposta(cfg.com, r.ufficiale)
        rip.comune = r.ufficiale; rip.cap = r.cap; rip.prov = r.prov
      } else if (cfg[r.campo]) {
        imposta(cfg[r.campo], r.ufficiale)
      }
    })
    st.riportati = rip
    if (typeof window.toast === 'function') {
      window.toast(scelte.length ? `Riportati ${scelte.length} dati: ora salva la scheda` : 'Nessun dato spuntato', scelte.length ? 'ok' : 'warn')
    }
  }

  // Colonne in più per il salvataggio, solo se il comune riportato è ancora
  // quello scritto nel campo (se il tecnico l'ha cambiato dopo, CAP e
  // provincia non c'entrano più e li rimette il trigger dal comune).
  function extra(p, comuneAlSalvataggio) {
    const st = stato[p]
    const rip = st && st.riportati
    if (!rip) return {}
    const out = {}
    if (rip.comune && uguali(rip.comune, comuneAlSalvataggio)) {
      if (rip.cap) out.cap = rip.cap
      if (rip.prov) out.prov = rip.prov
    }
    if (rip.tipo_impresa && !MASCHERE[p].forma) out.tipo_impresa = rip.tipo_impresa
    return out
  }

  function azzera(p) {
    stato[p] = null
    const box = $('du-esito-' + p)
    if (box) box.innerHTML = ''
  }

  const CSS = `
    .du-pannello{background:#f7fafc;border:1px solid #d6e4ef;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px}
    .du-tab{width:100%;border-collapse:collapse;margin-top:6px}
    .du-tab th{text-align:left;font-size:11px;color:#888;font-weight:600;padding:3px 4px;border-bottom:1px solid #e3e3e3}
    .du-tab td{padding:4px;vertical-align:top;border-bottom:1px solid #f0f0f0}
    .du-tab tr.du-uguale td{color:#999}
    .du-fonte{font-size:10px;color:#fff;background:#7f8c8d;border-radius:8px;padding:0 6px;margin-left:4px}
    .du-nota{font-size:11px;color:#888}
    .du-info{font-size:12px;color:#555;margin:2px 0}
    .du-allarme{background:#fdecea;border-left:3px solid #c0392b;padding:5px 8px;border-radius:4px;color:#7b241c;margin:3px 0;font-size:12px}
    .du-fonti{font-size:11px;margin:3px 0}
    .du-ok{color:#27ae60}.du-ko{color:#b9770e}`

  function monta() {
    if (!document.getElementById('du-css')) {
      const st = document.createElement('style'); st.id = 'du-css'; st.textContent = CSS
      document.head.appendChild(st)
    }
    Object.keys(MASCHERE).forEach(p => {
      const cfg = MASCHERE[p]
      const cfEl = $(cfg.cf), modale = $(cfg.modale)
      if (!cfEl || !modale || $('du-blocco-' + p)) return
      const riga = cfEl.closest('.row') || cfEl.parentElement
      const blocco = document.createElement('div')
      blocco.id = 'du-blocco-' + p
      blocco.style.margin = '-4px 0 10px'
      blocco.innerHTML = `<button type="button" class="btn-outline" id="btn-${p}-ufficiali" style="font-size:12px;padding:4px 10px">🔎 Dati ufficiali da P.IVA / codice fiscale</button>
        <div id="du-esito-${p}"></div>`
      riga.insertAdjacentElement('afterend', blocco)
      $('btn-' + p + '-ufficiali').onclick = () => cerca(p)
      // ogni volta che la maschera si apre, si riparte da zero
      let chiusa = modale.classList.contains('hidden')
      new MutationObserver(() => {
        const ora = modale.classList.contains('hidden')
        if (chiusa && !ora) azzera(p)
        chiusa = ora
      }).observe(modale, { attributes: true, attributeFilter: ['class'] })
    })
  }

  window.DatiUfficiali = { proposte, richiesta, extra, uguali, intestazione, tabella, _stato: stato, _monta: monta }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta)
  else monta()
})()
