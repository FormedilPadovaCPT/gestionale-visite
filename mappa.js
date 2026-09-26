/* ============================================================
   Mappa sul telefono (13/09/2026)

   Due funzioni nate col tema «Mappa» dell'11/09 e rimaste quando i
   temi sono stati tolti: la grafica resta quella di sempre, ma sul
   telefono queste servono in cantiere.
   - NUOVA VISITA: «Cantieri vicino a te» dal GPS, con «Inizia qui».
   - SCADENZE: «Rientri sulla mappa», con «Aggiungi al giro» e
     «Nuova visita qui».
   Compaiono solo su telefono e tablet (schermo fino a 1024 px, oppure
   il dito come puntatore): al computer la posizione non dice niente.

   Niente viene salvato da qui: si riempie il modulo come farebbe il
   tecnico a mano, e il salvataggio resta quello di sempre. La posizione
   serve solo a ordinare i cantieri e non si registra.

   Script classico come manuali.js: gira PRIMA del modulo di index.html,
   quindi sb, S e le funzioni del modulo (window.__app) si leggono solo
   al momento del bisogno. Il modulo chiama window.mappaEvento(tipo, arg)
   da vSet (cantiere), initForm (form) e activateTab (tab).
   Errori: niente console.error/warn, che aprirebbero il pannello rosso
   di diagnostica ai tecnici.
   ============================================================ */
(function () {
  'use strict'

  // il tema scelto dall'11 al 13/09 non esiste più: si toglie la scelta rimasta
  try { localStorage.removeItem('visite.tema') } catch (e) { /* niente */ }

  var MOBILE = window.matchMedia ? window.matchMedia('(max-width: 1024px), (pointer: coarse)') : null
  function mobile() { return !!(MOBILE && MOBILE.matches) }

  function $(id) { return document.getElementById(id) }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function avviso(msg, tipo) { if (window.toast) window.toast(msg, tipo); else alert(msg) }
  function dataIt(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '' }
  function nrCorto(nr) { var m = String(nr || '').match(/(\d+)$/); return m ? m[1] : String(nr || '') }
  /* numero breve; l'esercizio si scrive solo se non e' quello in corso (1/10-30/9) */
  function nrBreve(nr) {
    var m = String(nr || '').match(/(\d\d_\d\d)\/(\d+)$/)
    if (!m) return nrCorto(nr)
    var d = new Date(), a = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1
    var es = String(a % 100).padStart(2, '0') + '_' + String((a + 1) % 100).padStart(2, '0')
    return m[1] === es ? m[2] : m[1] + '/' + m[2]
  }
  function app() { return window.__app || null }
  function formNuova() { var S = window.S; return !!(S && S.fd && !S.fd.visita_id && !S.savedId) }
  function visibile(id) { var el = $(id); return !!(el && !el.classList.contains('hidden')) }
  function log(where, e) { try { console.log('[mappa] ' + where + ':', e && e.message ? e.message : e) } catch (_e) { /* niente */ } }
  function tessere(L, mappa) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mappa)
  }

  /* ── eventi dal modulo ─────────────────────────────────────── */
  var cantiere = ''
  var timerCant = null
  window.mappaEvento = function (tipo, arg) {
    try {
      if (tipo === 'form') {
        // il cantiere puo' essere gia' nel modulo (bozza riaperta, visita di ritorno)
        var A = app()
        cantiere = String((A && A.vGet('f-cant-id')) || '')
        disegnaVisita()
      }
      else if (tipo === 'cantiere') {
        var id = String(arg || '')
        if (id === cantiere) return
        cantiere = id
        clearTimeout(timerCant)
        timerCant = setTimeout(disegnaVisita, 300)
      }
      else if (tipo === 'tab') { lontano(arg) }
    } catch (e) { log('evento ' + tipo, e) }
  }

  /* ════ NUOVA VISITA: cantieri vicino a te ════ */
  /* sta sopra il modulo, sui passi Visita, Cantiere e Imprese */
  function riquadro() {
    var box = $('mc-vicini')
    if (box) return box
    var form = $('view-form')
    var lay = form && form.querySelector('.form-layout')
    if (!lay) return null
    box = document.createElement('div')
    box.id = 'mc-vicini'
    lay.parentNode.insertBefore(box, lay)
    return box
  }
  function lontano(n) {
    var b = $('mc-vicini')
    if (b) { if (n != null && n > 2) b.setAttribute('data-lontano', ''); else b.removeAttribute('data-lontano') }
  }
  function disegnaVisita() {
    var box = riquadro()
    if (!box) return
    if (!mobile() || !formNuova()) { chiudiMappaVicini(); box.innerHTML = ''; return }
    if (cantiere) scelto(box)
    else vicini(box, false)
  }

  /* cantiere gia' scelto: una riga sola, con la strada per cambiarlo */
  function scelto(box) {
    chiudiMappaVicini()
    var nome = ($('f-cant-search') || {}).value || ''
    box.innerHTML = '<div class="card mc-scelto"><span>📍 <b>' + h(nome || 'Cantiere scelto') + '</b></span>' +
      '<button type="button" class="btn-outline btn-sm" data-mc="altri">Cantieri vicino a te</button></div>'
    box.querySelector('[data-mc="altri"]').onclick = function () { vicini(box, true) }
  }

  var mappaVicini = null
  function chiudiMappaVicini() {
    if (mappaVicini) { try { mappaVicini.remove() } catch (e) { /* niente */ } mappaVicini = null }
  }
  function vicini(box, subito) {
    chiudiMappaVicini()
    box.innerHTML = '<div class="card mc-card">' +
      '<h3>📍 Cantieri vicino a te</h3>' +
      '<p class="mc-sotto">Sei in cantiere? Apri la visita dal cantiere in cui ti trovi, senza cercare l\'indirizzo.</p>' +
      '<div class="mc-azioni"><button type="button" class="btn-primary" data-mc="gps">Trova i cantieri vicini</button>' +
      '<span class="mc-nota">oppure cercalo per comune e indirizzo nel passo «Cantiere»</span></div>' +
      '<div data-mc="esito"></div></div>'
    var gps = box.querySelector('[data-mc="gps"]')
    gps.onclick = function () { cercaVicini(box) }
    if (subito) gps.click()
  }
  function distanza(a, b, c, d) {
    var R = 6371, r = Math.PI / 180
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2)
    return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y))
  }
  function fmtKm(k) { return k < 1 ? Math.round(k * 1000 / 10) * 10 + ' m' : k.toFixed(1).replace('.', ',') + ' km' }
  function cercaVicini(box) {
    var esito = box.querySelector('[data-mc="esito"]')
    if (!navigator.geolocation) { esito.innerHTML = '<p class="mc-sotto">Questo dispositivo non dà la posizione: cerca il cantiere nel passo «Cantiere».</p>'; return }
    esito.innerHTML = '<p class="mc-sotto">Cerco la tua posizione…</p>'
    navigator.geolocation.getCurrentPosition(function (pos) {
      caricaVicini(box, esito, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).catch(function (e) {
        log('vicini', e); esito.innerHTML = '<p class="mc-sotto">Non sono riuscito a leggere i cantieri: ' + h(e.message) + '</p>'
      })
    }, function (err) {
      esito.innerHTML = '<p class="mc-sotto">' + (err.code === 1
        ? 'La posizione non è autorizzata: consentila nelle impostazioni del browser, oppure cerca il cantiere nel passo «Cantiere».'
        : 'Posizione non disponibile adesso: riprova all\'aperto, oppure cerca il cantiere nel passo «Cantiere».') + '</p>'
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }
  async function caricaVicini(box, esito, lat, lng, acc) {
    var sb = window.sb
    if (!sb) throw new Error("l'app non è ancora pronta")
    var righe = []
    var raggi = [[0.045, 0.065], [0.14, 0.2]] // circa 5 e 15 km
    for (var i = 0; i < raggi.length && righe.length < 3; i++) {
      var q = await sb.from('cantieri')
        .select('cantiere_id,cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome,lat,lng,geocode_status,nodo_id,cantiere_cnce,lotto')
        .eq('elimina', 0).not('cantiere_chiuso', 'is', true)
        .gte('lat', lat - raggi[i][0]).lte('lat', lat + raggi[i][0])
        .gte('lng', lng - raggi[i][1]).lte('lng', lng + raggi[i][1])
        .limit(500)
      if (q.error) throw q.error
      righe = q.data || []
    }
    righe.forEach(function (c) { c._km = distanza(lat, lng, +c.lat, +c.lng) })
    righe.sort(function (a, b) { return a._km - b._km })
    righe = righe.slice(0, 8)
    var gps = box.querySelector('[data-mc="gps"]')
    if (gps) gps.textContent = 'Aggiorna la posizione'
    var nota = box.querySelector('.mc-nota')
    if (nota) nota.remove()
    if (!righe.length) { esito.innerHTML = '<p class="mc-sotto">Nessun cantiere attivo entro 15 km. Cercalo nel passo «Cantiere» o crealo da lì.</p>'; return }
    var ids = righe.map(function (c) { return c.cantiere_id })
    var vq = await sb.from('visite').select('cantiere_id,nr_verbale,data_visita,ipc,acc_cant')
      .in('cantiere_id', ids).eq('elimina', 0).order('data_visita', { ascending: false }).order('nr_verbale', { ascending: false }).limit(200)
    var ultime = {}
    /* lettura fallita ≠ «nessuna visita registrata»: il cantiere sembrerebbe mai visitato */
    var visNonLette = !!vq.error
    if (vq.error) console.warn('mappa vicini: visite non lette', vq.error)
    ;(vq.data || []).forEach(function (v) { if (!ultime[v.cantiere_id]) ultime[v.cantiere_id] = v })
    var oggi = new Date().toISOString().slice(0, 10)
    chiudiMappaVicini()
    esito.innerHTML = '<p class="mc-sotto" style="margin-top:10px">Posizione trovata' + (acc ? ' (precisione ' + fmtKm(acc / 1000) + ')' : '') + '. I più vicini:</p>' +
      (visNonLette ? '<p class="mc-sotto" style="color:#c0392b">Non sono riuscito a leggere le visite di questi cantieri: le ultime visite non sono indicate, non vuol dire che non ce ne siano.</p>' : '') +
      '<div class="mc-map" data-mc="mappa"></div>' +
      righe.map(function (c, i) {
        var u = ultime[c.cantiere_id]
        var ind = ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim()
        var titolo = c.cantiere_etichetta || ind || '(senza indirizzo)'
        var fatto = u && String(u.data_visita).slice(0, 10) === oggi
        var info = u ? (fatto ? 'già visitato oggi, verbale ' + nrBreve(u.nr_verbale)
          : (u.acc_cant ? u.acc_cant + '° accesso · ' : '') + 'ultimo verbale ' + nrBreve(u.nr_verbale) + ' del ' + dataIt(u.data_visita) + (u.ipc ? ' · IPC ' + u.ipc : ''))
          : (visNonLette ? 'visite non lette' : 'nessuna visita registrata')
        return '<div class="mc-vic' + (fatto ? ' mc-oggi' : '') + '"><i><span>' + (i + 1) + '</span></i>' +
          '<b>' + h(titolo) + '</b>' +
          '<button type="button" class="btn-primary btn-sm" data-usa="' + h(c.cantiere_id) + '">Inizia qui</button>' +
          '<small>' + h([c.comune_nome, fmtKm(c._km), info, c.lotto ? 'lotto ' + c.lotto : '', c.cantiere_cnce || c.nodo_id].filter(Boolean).join(' · ')) + (c.geocode_status === 'comune' ? ' · posizione approssimata al comune' : '') + '</small></div>'
      }).join('')
    esito.querySelectorAll('[data-usa]').forEach(function (b) {
      b.onclick = function () { b.disabled = true; usaCantiere(b.dataset.usa).finally(function () { b.disabled = false }) }
    })
    if (window.L) {
      var L = window.L
      mappaVicini = L.map(esito.querySelector('[data-mc="mappa"]'))
      tessere(L, mappaVicini)
      var pts = [[lat, lng]]
      L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(mappaVicini).bindTooltip('Tu sei qui')
      righe.forEach(function (c, i) {
        pts.push([+c.lat, +c.lng])
        var mk = L.marker([+c.lat, +c.lng], { icon: L.divIcon({ className: '', html: '<div class="mc-pin"><span>' + (i + 1) + '</span></div>', iconSize: [24, 24], iconAnchor: [4, 24] }) }).addTo(mappaVicini)
        var ind = ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim()
        mk.bindPopup('<b>' + h(c.cantiere_etichetta || ind) + '</b><br>' + h(c.comune_nome || '') + '<br><button type="button" class="btn-primary btn-sm" data-usa-pop="' + h(c.cantiere_id) + '" style="margin-top:6px">Inizia qui</button>')
      })
      mappaVicini.on('popupopen', function (ev) {
        var b = ev.popup.getElement().querySelector('[data-usa-pop]')
        if (b) b.onclick = function () { usaCantiere(b.dataset.usaPop) }
      })
      mappaVicini.fitBounds(pts, { padding: [24, 24], maxZoom: 16 })
      var m = mappaVicini
      setTimeout(function () { try { m.invalidateSize() } catch (e) { /* niente */ } }, 150)
    }
  }

  /* stesso percorso del «+ Visita» dall'elenco cantieri */
  async function usaCantiere(id) {
    var A = app(), S = window.S, sb = window.sb
    if (!A || !S || !sb) { avviso("L'app non è ancora pronta: riprova tra un attimo", 'warn'); return }
    try {
      var r = await sb.from('cantieri').select('*').eq('cantiere_id', id).single()
      var cd = r.data
      if (!cd) { avviso('Cantiere non trovato', 'err'); return }
      var ind = ((cd.cantiere_indirizzo || '') + ' ' + (cd.cantiere_civico || '')).trim()
      A.vSet('f-cant-search', cd.cantiere_etichetta || ind)
      A.vSet('f-cant-id', id)
      var det = $('cant-detail'); if (det) det.textContent = ind + (cd.comune_nome ? ' – ' + cd.comune_nome : '')
      S.fd.cantiere_id = id
      S.fd.comune_nome = cd.comune_nome || ''
      S.fd.cantiere_indirizzo = cd.cantiere_indirizzo || ''
      S.fd.cantiere_civico = cd.cantiere_civico || ''
      A.vSet('f-cnce', cd.cantiere_cnce || '')
      A.vSet('f-cod-uni', cd.nodo_id || '')
      A.vSet('f-data-ult', cd.data_ult || '')
      A.renderCantCard(cd)
      A.proponiImportoCantiere(cd.cantiere_importo)
      A.caricaProposteImprese(true)
      await A.autoAccCant(id)
      await A.proponiCommittenteCantiere(id)
      avviso('Cantiere scelto: ' + (cd.cantiere_etichetta || ind) + (cd.comune_nome ? ', ' + cd.comune_nome : ''), 'ok')
    } catch (e) { log('usaCantiere', e); avviso('Errore nella scelta del cantiere: ' + e.message, 'err') }
  }

  /* ════ SCADENZE: rientri sulla mappa ════ */
  var mappaScad = null, timerScad = null
  function programmaScadenze() { clearTimeout(timerScad); timerScad = setTimeout(mappaScadenze, 250) }
  function mappaScadenze() {
    var card = $('mc-scad')
    if (!mobile() || !window.L) { if (card) card.hidden = true; return }
    if (!visibile('view-scadenze')) return
    var sez = $('view-scadenze')
    if (!card) {
      card = document.createElement('div')
      card.id = 'mc-scad'
      card.className = 'card mc-card'
      card.innerHTML = '<h3>🗺️ Rientri sulla mappa</h3><p class="mc-sotto">In rosso gli urgenti, in arancione i prossimi. Tocca un segnaposto per aggiungerlo al giro o aprire la visita.</p><div class="mc-map"></div><p class="mc-sotto" data-mc="nota" style="margin:0"></p>'
      var primo = sez.firstElementChild
      sez.insertBefore(card, primo ? primo.nextSibling : null)
    }
    card.hidden = false
    var punti = []
    ;[['tbody-scad-urgenti', '#b3261e', 'urgente'], ['tbody-scad-prossime', '#e7500f', 'prossimo']].forEach(function (d) {
      var tb = $(d[0]); if (!tb) return
      tb.querySelectorAll('.giro-chk').forEach(function (chk) {
        var tr = chk.closest('tr')
        if (tr && tr.style.display === 'none') return
        var la = parseFloat(chk.dataset.lat), ln = parseFloat(chk.dataset.lng)
        if (!isFinite(la) || !isFinite(ln)) { punti.push({ senza: true }); return }
        punti.push({ lat: la, lng: ln, colore: d[1], tipo: d[2], chk: chk, label: chk.dataset.label || '', addr: chk.dataset.addr || '', id: chk.dataset.id })
      })
    })
    var validi = punti.filter(function (p) { return !p.senza })
    var senza = punti.length - validi.length
    var L = window.L
    if (!mappaScad) {
      mappaScad = L.map(card.querySelector('.mc-map'))
      tessere(L, mappaScad)
      mappaScad._mcStrato = L.layerGroup().addTo(mappaScad)
      mappaScad.on('popupopen', function (ev) {
        var root = ev.popup.getElement()
        var p = ev.popup._mcPunto
        if (!p) return
        var g = root.querySelector('[data-mc="giro"]'), v = root.querySelector('[data-mc="visita"]')
        if (g) g.onclick = function () { p.chk.click(); g.textContent = p.chk.checked ? '✓ Nel giro' : 'Aggiungi al giro' }
        if (v) v.onclick = function () { nuovaVisitaQui(p.id) }
      })
    }
    mappaScad._mcStrato.clearLayers()
    validi.forEach(function (p) {
      var mk = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 2, fillColor: p.colore, fillOpacity: .95 })
      var pop = L.popup().setContent('<b>' + h(p.label) + '</b><br>' + h(p.addr) + '<br><small>' + (p.tipo === 'urgente' ? 'rientro scaduto' : 'rientro in arrivo') + '</small><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
        '<button type="button" class="btn-outline btn-sm" data-mc="giro">' + (p.chk.checked ? '✓ Nel giro' : 'Aggiungi al giro') + '</button>' +
        '<button type="button" class="btn-primary btn-sm" data-mc="visita">Nuova visita qui</button></div>')
      pop._mcPunto = p
      mk.bindPopup(pop)
      mappaScad._mcStrato.addLayer(mk)
    })
    card.querySelector('[data-mc="nota"]').textContent = validi.length
      ? validi.length + ' cantieri sulla mappa' + (senza ? '; ' + senza + ' senza posizione (restano negli elenchi sotto)' : '')
      : 'Nessun rientro con posizione da mostrare.'
    setTimeout(function () {
      try {
        mappaScad.invalidateSize()
        if (validi.length) mappaScad.fitBounds(validi.map(function (p) { return [p.lat, p.lng] }), { padding: [26, 26], maxZoom: 14 })
        else mappaScad.setView([45.41, 11.88], 10)
      } catch (e) { /* niente */ }
    }, 120)
  }
  async function nuovaVisitaQui(id) {
    var A = app()
    if (!A) return
    try {
      await A.initForm()
      window.navTo('form')
      await usaCantiere(id)
    } catch (e) { log('nuovaVisitaQui', e); avviso('Errore: ' + e.message, 'err') }
  }
  function osservaScadenze() {
    ;['tbody-scad-urgenti', 'tbody-scad-prossime'].forEach(function (id) {
      var tb = $(id); if (!tb || tb._mcOss) return
      tb._mcOss = new MutationObserver(programmaScadenze)
      tb._mcOss.observe(tb, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    })
    var sez = $('view-scadenze')
    if (sez && !sez._mcOss) {
      sez._mcOss = new MutationObserver(function () { if (visibile('view-scadenze')) programmaScadenze() })
      sez._mcOss.observe(sez, { attributes: true, attributeFilter: ['class'] })
    }
  }

  /* ── avvio ─────────────────────────────────────────────────── */
  function avvia() {
    osservaScadenze()
    if (!MOBILE) return
    /* si ridisegna solo quando si passa davvero da telefono a computer o
       viceversa: sul telefono il resize scatta anche quando compare la
       tastiera o sparisce la barra del browser, e cancellerebbe i cantieri
       gia' trovati */
    var eraMobile = mobile(), timerMisura = null
    var cambio = function () {
      if (mobile() === eraMobile) return
      eraMobile = mobile()
      if (visibile('view-form')) disegnaVisita()
      programmaScadenze()
    }
    if (MOBILE.addEventListener) MOBILE.addEventListener('change', cambio)
    else if (MOBILE.addListener) MOBILE.addListener(cambio)
    window.addEventListener('resize', function () { clearTimeout(timerMisura); timerMisura = setTimeout(cambio, 200) })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia)
  else avvia()
})()
