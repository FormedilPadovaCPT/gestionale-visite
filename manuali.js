/* ============================================================
   Manuali d'uso — sempre l'ultima versione (10/09/2026)

   Il pulsante «📘 Manuale» nella testata scarica il manuale dalla edge
   function `manuali`, che lo legge da Drive (cartella
   9_APPLICATIVI/Gestionale_Visite_APP/Manuali_pubblicati). Niente piu'
   PDF mandati per mail a ogni versione: una copia per posta resta
   indietro e chi l'ha ricevuta non lo sa.

   Il pallino sul pulsante dice che c'e' una versione che SU QUESTO
   DISPOSITIVO non e' ancora stata scaricata (si ricorda in localStorage:
   su un telefono nuovo il pallino riappare, ed e' giusto cosi').

   Script classico come stage-relazione.js: sb, SB_URL e SB_KEY li espone
   il modulo in fondo a index.html, che pero' gira DOPO questo file —
   quindi si leggono da window solo al momento del bisogno.
   ============================================================ */
(function () {
  'use strict'

  var CHIAVE = 'manuali-scaricati'
  var ARANCIO = '#e7500f'

  function visti() {
    try { return JSON.parse(localStorage.getItem(CHIAVE) || '{}') } catch (e) { return {} }
  }
  function segnaVisto(codice, versione) {
    try { var v = visti(); v[codice] = versione; localStorage.setItem(CHIAVE, JSON.stringify(v)) } catch (e) { /* niente */ }
  }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function dataIt(iso) { return String(iso || '').split('-').reverse().join('/') }
  function mb(b) { return b ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : '' }
  function avviso(msg, tipo) { if (window.toast) window.toast(msg, tipo); else alert(msg) }

  async function chiama(body) {
    if (!window.sb) throw new Error("L'app non è ancora pronta: riprova tra un attimo")
    var sess = (await window.sb.auth.getSession()).data.session
    if (!sess) throw new Error("Accesso scaduto: rientra nell'app")
    var r = await fetch(window.SB_URL + '/functions/v1/manuali', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: window.SB_KEY, Authorization: 'Bearer ' + sess.access_token },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      var m = 'errore ' + r.status
      try { m = (await r.json()).error || m } catch (e) { /* risposta non JSON */ }
      throw new Error(m)
    }
    return r
  }

  async function elenco() {
    var d = await (await chiama({ azione: 'elenco' })).json()
    return d.manuali || []
  }

  function pallino(manuali) {
    var btn = document.getElementById('btn-manuale')
    if (!btn) return
    var v = visti()
    var nuovi = manuali.filter(function (m) { return v[m.codice] !== m.versione })
    btn.innerHTML = '📘 Manuale' + (nuovi.length
      ? ' <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffd54f;margin-left:2px;vertical-align:middle"></span>'
      : '')
    btn.title = nuovi.length
      ? 'C’è una versione del manuale che su questo dispositivo non hai ancora scaricato'
      : 'Manuale d’uso — sempre l’ultima versione'
  }

  async function scarica(m, bottone) {
    var testo = bottone.textContent
    bottone.disabled = true
    bottone.textContent = 'Scarico…'
    try {
      var r = await chiama({ azione: 'scarica', codice: m.codice })
      var blob = new Blob([await r.blob()], { type: 'application/pdf' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = m.nome_file
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function () { URL.revokeObjectURL(url) }, 60000)
      segnaVisto(m.codice, m.versione)
      avviso('Scaricato: ' + m.titolo + ' v' + m.versione, 'ok')
      var riga = bottone.closest('[data-manuale]')
      var badge = riga && riga.querySelector('.man-nuova')
      if (badge) badge.remove()
      elenco().then(pallino).catch(function () { /* il pallino puo' aspettare */ })
    } catch (e) {
      avviso('Manuale non scaricato: ' + e.message, 'err')
    } finally {
      bottone.disabled = false
      bottone.textContent = testo
    }
  }

  function chiudi() {
    var el = document.getElementById('manuali-modal')
    if (el) el.remove()
  }

  async function apri() {
    chiudi()
    var fondo = document.createElement('div')
    fondo.id = 'manuali-modal'
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px'
    fondo.innerHTML =
      '<div style="background:#fff;border-radius:10px;max-width:520px;width:100%;max-height:90vh;overflow:auto;border-top:5px solid ' + ARANCIO + ';box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#333">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px">' +
          '<strong style="font-size:16px;color:#565c66">📘 Manuali d’uso</strong>' +
          '<button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888">✕</button>' +
        '</div>' +
        '<div id="manuali-corpo" style="padding:6px 18px 4px">Carico l’elenco…</div>' +
        '<p style="margin:8px 18px 16px;font-size:12px;color:#777;line-height:1.5">Qui c’è sempre l’<b>ultima versione</b> pubblicata. Le copie ricevute per mail o salvate in passato possono essere superate: in caso di dubbio, riscarica da qui.</p>' +
      '</div>'
    fondo.addEventListener('click', function (e) {
      if (e.target === fondo || e.target.closest('[data-chiudi]')) chiudi()
    })
    document.body.appendChild(fondo)

    var corpo = document.getElementById('manuali-corpo')
    try {
      var manuali = await elenco()
      pallino(manuali)
      if (!manuali.length) {
        corpo.innerHTML = '<p style="color:#888">Nessun manuale pubblicato per il tuo utente.</p>'
        return
      }
      var v = visti()
      corpo.innerHTML = manuali.map(function (m, i) {
        var nuova = v[m.codice] !== m.versione
        return '<div data-manuale="' + i + '" style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee">' +
          '<div style="min-width:0">' +
            '<div style="font-weight:600">' + h(m.titolo) +
              (nuova ? ' <span class="man-nuova" style="background:' + ARANCIO + ';color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:4px">nuova</span>' : '') +
            '</div>' +
            '<div style="font-size:12px;color:#777;margin-top:2px">' + h(m.app) + ' · versione <b>' + h(m.versione) + '</b> del ' + dataIt(m.data) +
              (m.dimensione ? ' · ' + mb(m.dimensione) : '') + '</div>' +
          '</div>' +
          '<button type="button" data-scarica="' + i + '" style="background:' + ARANCIO + ';color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;white-space:nowrap">⬇ Scarica</button>' +
        '</div>'
      }).join('')
      corpo.querySelectorAll('[data-scarica]').forEach(function (b) {
        b.addEventListener('click', function () { scarica(manuali[Number(b.dataset.scarica)], b) })
      })
    } catch (e) {
      corpo.innerHTML = '<p style="color:#c0392b">Elenco non disponibile: ' + h(e.message) + '</p>'
    }
  }

  /* All'avvio, se c'e' una sessione, si guarda se c'e' una versione nuova.
     Si aspetta che il modulo abbia messo sb su window (al massimo ~30 s). */
  function controllaNovita(giri) {
    if (!window.sb) {
      if (giri < 60) setTimeout(function () { controllaNovita(giri + 1) }, 500)
      return
    }
    window.sb.auth.getSession().then(function (r) {
      if (r.data.session) elenco().then(pallino).catch(function () { /* silenzioso: resta il pulsante */ })
    })
    window.sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'SIGNED_IN') elenco().then(pallino).catch(function () { /* idem */ })
    })
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') chiudi() })
  var btn = document.getElementById('btn-manuale')
  if (btn) btn.addEventListener('click', apri)
  controllaNovita(0)
})()
