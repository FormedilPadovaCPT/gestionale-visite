/* ============================================================
   SCHEDA IMPRESA PRE-VISITA (17/09/2026, chiesta dall'utente)

   Quando il tecnico sceglie un'impresa nel verbale, sotto la
   ragione sociale compare quello che l'ufficio già sa di lei:
   stato in Cassa Edile, ultime visite con i rilievi, rientri
   ancora da fare, cantieri critici aperti, asseverazione e
   l'eventuale richiesta di affidamento RLST.

   Regole decise con l'utente:
   · RLST si mostra SOLO come «richiesta di affidamento inviata
     il …»: l'ASC non comunica se la prende in carico, e dire
     altro sarebbe affermare un fatto che non abbiamo.
   · La FORMAZIONE dei lavoratori non entra: se ne occupa
     l'ufficio corsi.
   · Lo stato Cassa Edile porta sempre la data della lista da cui
     viene, perché è aggiornata una volta al mese.
   · È una scheda di lettura: non scrive niente nel verbale.

   I dati arrivano dalla funzione `impresa_previsita` del
   database, che è security definer e controlla il ruolo: il
   tecnico non legge da sé pratiche di asseverazione o RLST.
   ============================================================ */
(function () {
  'use strict'

  const cache = new Map()   // impresa_id -> dati (una lettura per impresa, per sessione)

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const gg = d => {
    if (!d) return ''
    const t = String(d).slice(0, 10).split('-')
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : String(d)
  }

  const giorniDa = d => {
    if (!d) return null
    const x = new Date(String(d).slice(0, 10) + 'T00:00:00')
    if (isNaN(x)) return null
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
    return Math.round((x - oggi) / 86400000)
  }

  const COLORI_IPC = { ALTO: '#c0392b', MEDIO: '#e67e22', BASSO: '#e1b12c', NR: '#27ae60' }

  function pastiglia(testo, colore, titolo) {
    return `<span title="${esc(titolo || '')}" style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${colore}">${esc(testo)}</span>`
  }

  // Stato in Cassa Edile: il colore dice subito se l'impresa è a posto
  function cassa(imp) {
    const s = (imp.stato_cassa || '').trim()
    if (!s) return `<span style="color:#888;font-size:12px">Cassa Edile: non risulta in elenco</span>`
    const giu = /attiv/i.test(s) ? '#27ae60' : (/sospes/i.test(s) ? '#e67e22' : '#c0392b')
    const quando = imp.lista_al ? ` <span style="color:#888">(lista al ${esc(gg(imp.lista_al))})</span>` : ''
    return `${pastiglia('C.E.I.V. ' + s, giu)}${quando}`
  }

  // Il testo della scheda. Funzione pura: riceve i dati, restituisce HTML (così si può provare).
  function html(dati) {
    if (!dati || !dati.impresa) return ''
    const d = dati
    const imp = d.impresa
    const righe = []

    righe.push(`<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px">
      ${cassa(imp)}
      ${imp.comune ? `<span style="color:#666;font-size:12px">📍 ${esc(imp.comune)}${imp.prov ? ' (' + esc(imp.prov) + ')' : ''}</span>` : ''}
      ${imp.ccnl ? `<span style="color:#666;font-size:12px">CCNL ${esc(imp.ccnl)}</span>` : ''}
    </div>`)

    // Cantieri critici aperti: è la cosa che il tecnico deve sapere prima di entrare
    const critici = d.critici || []
    if (critici.length) {
      righe.push(`<div style="background:#fdecea;border-left:3px solid #c0392b;padding:6px 10px;border-radius:4px;margin-bottom:6px">
        <b style="font-size:12px;color:#c0392b">🚧 ${critici.length === 1 ? 'Caso aperto' : critici.length + ' casi aperti'}</b>
        ${critici.slice(0, 3).map(k => `<div style="font-size:12px;color:#555">${esc(gg(k.data))} · ${esc(k.motivo === 'accesso_negato' || k.origine === 'accesso_negato' ? 'accesso negato' : (k.motivo || k.origine || 'segnalazione'))}${k.cantiere ? ' · ' + esc(k.cantiere) : ''} <i>(${esc(k.stato || '')})</i></div>`).join('')}
      </div>`)
    }

    // Rientri previsti e non ancora fatti
    const rientri = d.rientri || []
    if (rientri.length) {
      righe.push(`<div style="margin-bottom:6px"><b style="font-size:12px">🔁 Rientri previsti</b>
        ${rientri.slice(0, 3).map(r => {
          const q = giorniDa(r.ritorno)
          const tardi = q !== null && q < 0
          return `<div style="font-size:12px;color:${tardi ? '#c0392b' : '#555'}">${esc(gg(r.ritorno))}${q !== null ? (tardi ? ` (scaduto da ${-q} gg)` : ` (fra ${q} gg)`) : ''} · ${esc(r.cantiere || '')}${r.comune ? ' — ' + esc(r.comune) : ''} · dal verbale ${esc(r.verbale || '')}</div>`
        }).join('')}
      </div>`)
    }

    // Ultime visite
    const visite = d.visite || []
    if (visite.length) {
      righe.push(`<div style="margin-bottom:6px"><b style="font-size:12px">📋 Ultime visite</b>
        ${visite.slice(0, 4).map(v => {
          const col = COLORI_IPC[(v.ipc || '').toUpperCase()] || '#888'
          const rilievi = []
          if (v.nc_piu) rilievi.push('NC+ ' + v.nc_piu)
          if (v.nc_meno) rilievi.push('NC− ' + v.nc_meno)
          if (v.oss) rilievi.push('OSS ' + v.oss)
          return `<div style="font-size:12px;color:#555;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span style="color:#888">${esc(gg(v.data))}</span>
            <span style="color:#888">${esc(v.verbale || '')}</span>
            ${pastiglia(v.ipc || '—', col, 'Indice di pericolosità del cantiere')}
            <span>${esc(v.cantiere || '')}${v.comune ? ' — ' + esc(v.comune) : ''}</span>
            ${rilievi.length ? `<span style="color:#b8651b">${esc(rilievi.join(' · '))}</span>` : ''}
            ${v.tecnico ? `<span style="color:#888">${esc(v.tecnico)}</span>` : ''}
          </div>`
        }).join('')}
      </div>`)
    } else {
      righe.push(`<div style="font-size:12px;color:#888;margin-bottom:6px">Nessuna visita registrata a questa impresa.</div>`)
    }

    // Asseverazione e RLST: due righe, senza dire più di quello che sappiamo
    const coda = []
    const a = d.asseverazione
    if (a && (a.stato || a.numero)) {
      const scad = a.scadenza_attestato ? ` — valida fino al ${gg(a.scadenza_attestato)}` : ''
      const q = giorniDa(a.scadenza_attestato)
      const colore = a.stato === 'asseverata' && (q === null || q >= 0) ? '#27ae60' : '#e67e22'
      coda.push(`<span style="font-size:12px;color:#555">🏅 Asseverazione: ${pastiglia(a.stato || 'in corso', colore)} ${esc(a.numero || '')}${esc(scad)}${q !== null && q < 0 ? ' <b style="color:#c0392b">(scaduta)</b>' : ''}</span>`)
    }
    const r = d.rlst
    if (r && r.richiesta_il) {
      coda.push(`<span style="font-size:12px;color:#555">🦺 RLST: richiesta di affidamento inviata il ${esc(gg(r.richiesta_il))}</span>`)
    }
    if (coda.length) righe.push(`<div style="display:flex;flex-direction:column;gap:3px">${coda.join('')}</div>`)

    return `<div style="background:#fbfbfb;border:1px solid #e6e6e6;border-radius:8px;padding:10px 12px;margin:-2px 0 10px">
      <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:.5px;margin-bottom:6px">QUELLO CHE SAPPIAMO DI QUESTA IMPRESA</div>
      ${righe.join('')}
    </div>`
  }

  // Legge dal database (una volta per impresa) e scrive nel contenitore della scheda
  async function mostra(idx, impresaId, sb) {
    const box = document.getElementById('imp-scheda-' + idx)
    if (!box) return
    if (!impresaId) { box.innerHTML = ''; return }
    try {
      let dati = cache.get(impresaId)
      if (dati === undefined) {
        box.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px 0">Leggo la scheda dell\'impresa…</div>'
        const { data, error } = await sb.rpc('impresa_previsita', { p_impresa_id: impresaId })
        if (error) throw error
        dati = data || null
        cache.set(impresaId, dati)
      }
      box.innerHTML = html(dati)
    } catch (e) {
      // la scheda è un aiuto: se non arriva, il verbale si compila lo stesso
      box.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px 0">Scheda impresa non disponibile.</div>'
      console.warn('scheda impresa', e)
    }
  }

  window.SchedaImpresa = { html, mostra, cache }
})()
