/* ============================================================
   Temi del Gestionale Visite (11/09/2026)

   Il pulsante 🎨 nella testata fa scegliere a ogni tecnico la veste
   dell'app: Attuale (predefinita), Scrivania, Mappa, Taccuino. La
   scelta vale su quel dispositivo (localStorage «visite.tema»).

   Oltre alla grafica (temi.css) due temi portano funzioni:
   - MAPPA: nella nuova visita «Cantieri vicino a te» dal GPS, e nelle
     Scadenze la mappa dei rientri con «Nuova visita qui».
   - TACCUINO: scelto il cantiere, propone i dati dell'ultimo verbale
     da confermare («uguale / cambiato»), elenca i rilievi da
     ricontrollare, li segna nella check-list e fa dettare le note.
   La SCRIVANIA conta le voci compilate per sezione e mette una barra
   di stato in fondo al modulo.

   Niente viene salvato da qui: si riempie il modulo come farebbe il
   tecnico a mano, e il salvataggio resta quello di sempre.

   Script classico come manuali.js: gira PRIMA del modulo di index.html,
   quindi sb, S e le funzioni del modulo (window.__app) si leggono solo
   al momento del bisogno. Il modulo chiama window.temaEvento(tipo, arg)
   da vSet, initForm, activateTab, renderZoneTab e updateZoneDots.
   Errori: niente console.error/warn, che aprirebbero il pannello rosso
   di diagnostica ai tecnici.
   ============================================================ */
(function () {
  'use strict'

  var CHIAVE = 'visite.tema'
  var TEMI = [
    { id: 'attuale', nome: 'Attuale', desc: 'La grafica di sempre.' },
    { id: 'scrivania', nome: 'Scrivania', desc: "Come l'app segreteria: righe fitte, sezioni del verbale in una fila col conteggio, barra di stato in fondo." },
    { id: 'mappa', nome: 'Mappa', desc: 'Nuova visita dai cantieri vicino a te (GPS) e mappa dei rientri nelle Scadenze.' },
    { id: 'taccuino', nome: 'Taccuino', desc: "Nuova visita che riparte dall'ultimo verbale del cantiere, rilievi da ricontrollare e note dettate a voce." }
  ]
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition

  function tema() { return document.documentElement.dataset.tema || 'attuale' }
  function leggi() {
    try { var t = localStorage.getItem(CHIAVE); return TEMI.some(function (x) { return x.id === t }) ? t : 'attuale' } catch (e) { return 'attuale' }
  }
  function salva(t) { try { if (t === 'attuale') localStorage.removeItem(CHIAVE); else localStorage.setItem(CHIAVE, t) } catch (e) { /* niente */ } }
  function $(id) { return document.getElementById(id) }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function avviso(msg, tipo) { if (window.toast) window.toast(msg, tipo); else alert(msg) }
  function dataIt(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '' }
  function ggmm(iso) { return iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '' }
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
  function log(where, e) { try { console.log('[temi] ' + where + ':', e && e.message ? e.message : e) } catch (_e) { /* niente */ } }

  /* ── applicazione del tema ─────────────────────────────────── */
  var fontCaricati = false
  function caricaFont() {
    if (fontCaricati) return
    fontCaricati = true
    var l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap'
    document.head.appendChild(l)
  }
  function applica(t) {
    if (t === 'attuale') delete document.documentElement.dataset.tema
    else { document.documentElement.dataset.tema = t; caricaFont() }
    var b = $('btn-tema')
    if (b) b.title = 'Tema: ' + (TEMI.filter(function (x) { return x.id === t })[0] || TEMI[0]).nome
    aggiornaTutto()
  }
  function aggiornaTutto() {
    try {
      pulisciApertura()
      if (visibile('view-form')) apertura()
      contaSezioni()
      if (visibile('view-scadenze')) programmaScadenze()
      if (tema() === 'taccuino') { micStatici(); segnaPrimaVisibili() }
    } catch (e) { log('aggiorna', e) }
  }
  function visibile(id) { var el = $(id); return !!(el && !el.classList.contains('hidden')) }

  /* ── pulsante e menu ───────────────────────────────────────── */
  function montaPulsante() {
    var area = document.querySelector('.user-area')
    if (!area || $('btn-tema')) return
    var b = document.createElement('button')
    b.id = 'btn-tema'
    b.type = 'button'
    b.textContent = '🎨'
    b.setAttribute('aria-haspopup', 'menu')
    b.title = 'Tema'
    var man = $('btn-manuale')
    area.insertBefore(b, man || area.firstChild)
    b.onclick = function (ev) { ev.stopPropagation(); apriMenu(b) }
  }
  function apriMenu(b) {
    var vecchio = document.querySelector('.tm-menu')
    if (vecchio) { vecchio.remove(); return }
    var m = document.createElement('div')
    m.className = 'tm-menu'
    m.setAttribute('role', 'menu')
    var cur = tema()
    m.innerHTML = '<h4>Tema dell\'app</h4>' + TEMI.map(function (t) {
      return '<button type="button" role="menuitemradio" aria-checked="' + (t.id === cur) + '" data-t="' + t.id + '"><i></i><b>' + h(t.nome) + '</b><small>' + h(t.desc) + '</small></button>'
    }).join('') + '<p>La scelta vale solo su questo dispositivo. I dati e il verbale non cambiano.</p>'
    document.body.appendChild(m)
    var r = b.getBoundingClientRect()
    m.style.top = Math.round(r.bottom + 6) + 'px'
    m.style.left = Math.max(10, Math.round(Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 10))) + 'px'
    m.querySelectorAll('button[data-t]').forEach(function (x) {
      x.onclick = function () {
        salva(x.dataset.t); applica(x.dataset.t); m.remove()
        avviso('Tema «' + x.querySelector('b').textContent + '»', 'ok')
      }
    })
    var primo = m.querySelector('button[aria-checked="true"]') || m.querySelector('button')
    if (primo) primo.focus()
    setTimeout(function () {
      document.addEventListener('click', function chiudi(ev) {
        if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', chiudi) }
      })
    }, 0)
    m.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { m.remove(); b.focus() } })
  }

  /* le emoji del menu in uno span, così la Scrivania può nasconderle */
  function vestiNav() {
    document.querySelectorAll('nav button').forEach(function (btn) {
      if (btn.querySelector('.nav-ico')) return
      var n = btn.firstChild
      if (!n || n.nodeType !== 3) return
      var m = n.nodeValue.match(/^(\s*[^\wÀ-ÿ\s]+\s*)/)
      if (!m) return
      var s = document.createElement('span')
      s.className = 'nav-ico'
      s.textContent = m[1]
      n.nodeValue = n.nodeValue.slice(m[1].length)
      btn.insertBefore(s, n)
    })
  }

  /* ── eventi dal modulo ─────────────────────────────────────── */
  var timerCant = null
  window.temaEvento = function (tipo, arg) {
    try {
      if (tipo === 'form') {
        // il cantiere puo' essere gia' nel modulo (bozza riaperta, visita di ritorno)
        var A = app()
        stato.ultima = null; stato.prima = {}; stato.scelte = {}
        stato.cantiere = (A && A.vGet('f-cant-id')) || null
        pulisciApertura(); apertura(); contaSezioni()
      }
      else if (tipo === 'cantiere') {
        if (String(arg || '') === String(stato.cantiere || '')) return
        stato.cantiere = arg || null
        clearTimeout(timerCant)
        timerCant = setTimeout(function () { quandoCantiere(stato.cantiere) }, 500)
      }
      else if (tipo === 'tab') { mostraApertura(arg) }
      else if (tipo === 'zona') { if (tema() === 'taccuino') { segnaPrima(arg); micZona(arg) } }
      else if (tipo === 'dots') { contaSezioni() }
    } catch (e) { log('evento ' + tipo, e) }
  }

  var stato = { cantiere: null, ultima: null, prima: {}, scelte: {} }

  function contenitore() {
    var box = $('tema-apertura')
    if (box) return box
    var form = $('view-form')
    var lay = form && form.querySelector('.form-layout')
    if (!lay) return null
    box = document.createElement('div')
    box.id = 'tema-apertura'
    lay.parentNode.insertBefore(box, lay)
    return box
  }
  function pulisciApertura() { var b = $('tema-apertura'); if (b) b.innerHTML = '' }
  function mostraApertura(n) {
    var b = $('tema-apertura')
    if (b) b.style.display = (n == null || n <= 2) ? '' : 'none'
  }
  function apertura() {
    var t = tema()
    if (!formNuova()) return
    var A = app()
    var cid = (A && A.vGet('f-cant-id')) || null
    if (t === 'mappa' && !cid) vicini()
    if (t === 'taccuino' && cid) quandoCantiere(cid)
  }
  function quandoCantiere(cid) {
    var t = tema()
    if (t === 'mappa') { if (cid) pulisciApertura(); else if (formNuova()) vicini() }
    if (t === 'taccuino') { if (cid && formNuova()) ripresa(cid); else pulisciApertura() }
  }

  /* ════ SCRIVANIA: conteggio per sezione e barra di stato ════ */
  function contaSezioni() {
    var S = window.S
    var bar = $('tab-bar')
    if (!S || !bar) return
    if (tema() !== 'scrivania') { bar.querySelectorAll('.tab-btn[data-n]').forEach(function (b) { b.removeAttribute('data-n') }); return }
    for (var z = 1; z <= 10; z++) {
      var voci = (S.byZona && S.byZona[z]) || []
      var tot = 0, fatte = 0
      voci.forEach(function (v) { if (v.is_nota) return; tot++; if (S.checklist[v.codice]) fatte++ })
      var btn = bar.querySelector('.tab-btn[data-ti="' + (z + 2) + '"]')
      if (btn) { if (fatte) btn.setAttribute('data-n', fatte + '/' + tot); else btn.removeAttribute('data-n') }
    }
    var imp = bar.querySelector('.tab-btn[data-ti="2"]')
    var nImp = (S.imprese || []).filter(function (i) { return i.impresa_id }).length
    if (imp) { if (nImp) imp.setAttribute('data-n', nImp); else imp.removeAttribute('data-n') }
    var nav = $('form-nav-bar')
    if (!nav) return
    var st = $('tm-stato')
    if (!st) {
      st = document.createElement('div')
      st.id = 'tm-stato'
      var next = $('btn-next')
      nav.insertBefore(st, next || null)
    }
    var c = { VER: 0, OSS: 0, 'NC-': 0, 'NC+': 0 }
    Object.keys(S.checklist || {}).forEach(function (k) { var v = S.checklist[k]; if (c[v] != null) c[v]++ })
    var A = app(), ipc = ''
    try { ipc = A && A.calcIPC ? (A.calcIPC(S.checklist) || {}).ipc : '' } catch (e) { ipc = '' }
    st.innerHTML = 'VER <b>' + c.VER + '</b> · OSS <b>' + c.OSS + '</b> · NC− <b>' + c['NC-'] + '</b> · NC+ <b>' + c['NC+'] + '</b>' +
      (ipc ? ' · IPC <b>' + (ipc === 'NR' ? 'nessun rilievo' : ipc) + '</b>' : '')
  }

  /* ════ MAPPA: cantieri vicino a te ════ */
  var mappaVicini = null
  function vicini() {
    var box = contenitore()
    if (!box) return
    box.innerHTML = '<div class="tm-card" data-tm="vicini">' +
      '<h3>📍 Cantieri vicino a te</h3>' +
      '<p class="tm-sotto">Sei in cantiere? Apri la visita dal cantiere in cui ti trovi, senza cercare l\'indirizzo.</p>' +
      '<div class="tm-azioni"><button type="button" class="btn-primary" data-tm="gps">Trova i cantieri vicini</button>' +
      '<span class="tm-nota">oppure cerca per comune e indirizzo nella scheda «Cantiere»</span></div>' +
      '<div data-tm="esito"></div></div>'
    box.querySelector('[data-tm="gps"]').onclick = function () { cercaVicini(box) }
  }
  function distanza(a, b, c, d) {
    var R = 6371, r = Math.PI / 180
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2)
    return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y))
  }
  function fmtKm(k) { return k < 1 ? Math.round(k * 1000 / 10) * 10 + ' m' : k.toFixed(1).replace('.', ',') + ' km' }
  function cercaVicini(box) {
    var esito = box.querySelector('[data-tm="esito"]')
    if (!navigator.geolocation) { esito.innerHTML = '<p class="tm-sotto">Questo dispositivo non dà la posizione: cerca il cantiere nella scheda «Cantiere».</p>'; return }
    esito.innerHTML = '<p class="tm-sotto">Cerco la tua posizione…</p>'
    navigator.geolocation.getCurrentPosition(function (pos) {
      caricaVicini(esito, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).catch(function (e) {
        log('vicini', e); esito.innerHTML = '<p class="tm-sotto">Non sono riuscito a leggere i cantieri: ' + h(e.message) + '</p>'
      })
    }, function (err) {
      esito.innerHTML = '<p class="tm-sotto">' + (err.code === 1
        ? 'La posizione non è autorizzata: consentila nelle impostazioni del browser, oppure cerca il cantiere nella scheda «Cantiere».'
        : 'Posizione non disponibile adesso: riprova all\'aperto, oppure cerca il cantiere nella scheda «Cantiere».') + '</p>'
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }
  async function caricaVicini(esito, lat, lng, acc) {
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
    if (!righe.length) { esito.innerHTML = '<p class="tm-sotto">Nessun cantiere attivo entro 15 km. Cercalo nella scheda «Cantiere» o crealo da lì.</p>'; return }
    var ids = righe.map(function (c) { return c.cantiere_id })
    var vq = await sb.from('visite').select('cantiere_id,nr_verbale,data_visita,ipc,acc_cant')
      .in('cantiere_id', ids).eq('elimina', 0).order('data_visita', { ascending: false }).limit(200)
    var ultime = {}
    ;(vq.data || []).forEach(function (v) { if (!ultime[v.cantiere_id]) ultime[v.cantiere_id] = v })
    var oggi = new Date().toISOString().slice(0, 10)
    esito.innerHTML = '<p class="tm-sotto">Posizione trovata' + (acc ? ' (precisione ' + fmtKm(acc / 1000) + ')' : '') + '. I più vicini:</p>' +
      '<div class="tm-map" data-tm="mappa"></div>' +
      righe.map(function (c, i) {
        var u = ultime[c.cantiere_id]
        var ind = ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim()
        var titolo = c.cantiere_etichetta || ind || '(senza indirizzo)'
        var fatto = u && String(u.data_visita).slice(0, 10) === oggi
        var info = u ? (fatto ? 'già visitato oggi, verbale ' + nrBreve(u.nr_verbale)
          : (u.acc_cant ? u.acc_cant + '° accesso · ' : '') + 'ultimo verbale ' + nrBreve(u.nr_verbale) + ' del ' + dataIt(u.data_visita) + (u.ipc ? ' · IPC ' + u.ipc : ''))
          : 'nessuna visita registrata'
        return '<div class="tm-vic' + (fatto ? ' tm-oggi' : '') + '"><i><span>' + (i + 1) + '</span></i>' +
          '<b>' + h(titolo) + '</b>' +
          '<button type="button" class="btn-primary btn-sm" data-usa="' + h(c.cantiere_id) + '">Inizia qui</button>' +
          '<small>' + h([c.comune_nome, fmtKm(c._km), info, c.lotto ? 'lotto ' + c.lotto : '', c.cantiere_cnce || c.nodo_id].filter(Boolean).join(' · ')) + (c.geocode_status === 'comune' ? ' · posizione approssimata al comune' : '') + '</small></div>'
      }).join('')
    esito.querySelectorAll('[data-usa]').forEach(function (b) {
      b.onclick = function () { b.disabled = true; usaCantiere(b.dataset.usa).finally(function () { b.disabled = false }) }
    })
    if (window.L) {
      var el = esito.querySelector('[data-tm="mappa"]')
      if (mappaVicini) { try { mappaVicini.remove() } catch (e) { /* niente */ } }
      var L = window.L
      mappaVicini = L.map(el, { zoomControl: true, attributionControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mappaVicini)
      var pts = [[lat, lng]]
      L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(mappaVicini).bindTooltip('Tu sei qui')
      righe.forEach(function (c, i) {
        pts.push([+c.lat, +c.lng])
        var mk = L.marker([+c.lat, +c.lng], { icon: L.divIcon({ className: '', html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2e7d4f;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:700 11px/1 sans-serif">' + (i + 1) + '</span></div>', iconSize: [24, 24], iconAnchor: [4, 24] }) }).addTo(mappaVicini)
        var ind = ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim()
        mk.bindPopup('<b>' + h(c.cantiere_etichetta || ind) + '</b><br>' + h(c.comune_nome || '') + '<br><button type="button" class="btn-primary btn-sm" data-usa-pop="' + h(c.cantiere_id) + '" style="margin-top:6px">Inizia qui</button>')
      })
      mappaVicini.on('popupopen', function (ev) {
        var b = ev.popup.getElement().querySelector('[data-usa-pop]')
        if (b) b.onclick = function () { usaCantiere(b.dataset.usaPop) }
      })
      mappaVicini.fitBounds(pts, { padding: [24, 24], maxZoom: 16 })
      setTimeout(function () { try { mappaVicini.invalidateSize() } catch (e) { /* niente */ } }, 150)
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
      A.vSet('f-cant-id', id)
      A.vSet('f-cant-search', cd.cantiere_etichetta || ind)
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

  /* ════ MAPPA: rientri sulla mappa nelle Scadenze ════ */
  var mappaScad = null, timerScad = null
  function programmaScadenze() { clearTimeout(timerScad); timerScad = setTimeout(mappaScadenze, 250) }
  function mappaScadenze() {
    if (tema() !== 'mappa' || !visibile('view-scadenze') || !window.L) return
    var sez = $('view-scadenze')
    var card = $('tm-scad')
    if (!card) {
      card = document.createElement('div')
      card.id = 'tm-scad'
      card.className = 'tm-card'
      card.innerHTML = '<h3>🗺️ Rientri sulla mappa</h3><p class="tm-sotto">In rosso gli urgenti, in arancione i prossimi. Tocca un segnaposto per aggiungerlo al giro o aprire la visita.</p><div class="tm-map"></div><p class="tm-sotto" data-tm="nota" style="margin:0"></p>'
      var primo = sez.firstElementChild
      sez.insertBefore(card, primo ? primo.nextSibling : null)
    }
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
    var el = card.querySelector('.tm-map')
    var L = window.L
    if (!mappaScad) {
      mappaScad = L.map(el)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mappaScad)
      mappaScad._tmStrato = L.layerGroup().addTo(mappaScad)
      mappaScad.on('popupopen', function (ev) {
        var root = ev.popup.getElement()
        var p = ev.popup._tmPunto
        if (!p) return
        var g = root.querySelector('[data-tm="giro"]'), v = root.querySelector('[data-tm="visita"]')
        if (g) g.onclick = function () { p.chk.click(); g.textContent = p.chk.checked ? '✓ Nel giro' : 'Aggiungi al giro' }
        if (v) v.onclick = function () { nuovaVisitaQui(p.id) }
      })
    }
    mappaScad._tmStrato.clearLayers()
    validi.forEach(function (p) {
      var mk = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 2, fillColor: p.colore, fillOpacity: .95 })
      var pop = L.popup().setContent('<b>' + h(p.label) + '</b><br>' + h(p.addr) + '<br><small>' + (p.tipo === 'urgente' ? 'rientro scaduto' : 'rientro in arrivo') + '</small><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
        '<button type="button" class="btn-outline btn-sm" data-tm="giro">' + (p.chk.checked ? '✓ Nel giro' : 'Aggiungi al giro') + '</button>' +
        '<button type="button" class="btn-primary btn-sm" data-tm="visita">Nuova visita qui</button></div>')
      pop._tmPunto = p
      mk.bindPopup(pop)
      mappaScad._tmStrato.addLayer(mk)
    })
    card.querySelector('[data-tm="nota"]').textContent = validi.length
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
      var tb = $(id); if (!tb || tb._tmOss) return
      tb._tmOss = new MutationObserver(function () { if (tema() === 'mappa') programmaScadenze() })
      tb._tmOss.observe(tb, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    })
    var sez = $('view-scadenze')
    if (sez && !sez._tmOss) {
      sez._tmOss = new MutationObserver(function () { if (tema() === 'mappa' && visibile('view-scadenze')) programmaScadenze() })
      sez._tmOss.observe(sez, { attributes: true, attributeFilter: ['class'] })
    }
  }

  /* ════ TACCUINO: si riparte dall'ultimo verbale ════ */
  var CAMPI = {
    persona: ['ppre_titolo', 'ppre_nome', 'ppre_cog', 'nom_ppre', 'qual_ppre', 'tel_ppre'],
    committente: ['comm_tipo_sogg', 'comm_tipo', 'comm_titolo', 'comm_nome', 'comm_cog', 'comm_cf', 'comm_email', 'comm_tel', 'comm_rag_soc', 'comm_piva'],
    coord: ['coord', 'rl_titolo', 'rl_nome', 'rl_cog', 'rl_email', 'rl_tel', 'csp_titolo', 'csp_nome', 'csp_cog', 'csp_email', 'csp_tel', 'cse_titolo', 'cse_nome', 'cse_cog', 'cse_email', 'cse_tel']
  }
  function nome(t, n, c) { return [t, n, c].map(function (x) { return String(x || '').trim() }).filter(Boolean).join(' ') }

  async function ripresa(cid) {
    var sb = window.sb, A = app(), S = window.S
    if (!sb || !A || !S) return
    var box = contenitore()
    if (!box) return
    if (stato.ultima && stato.ultima.cid === cid) { disegnaRipresa(); return }
    box.innerHTML = '<div class="tm-card"><p class="tm-sotto" style="margin:0">Cerco l\'ultimo verbale di questo cantiere…</p></div>'
    try {
      var q = await sb.from('visite').select('visita_id,nr_verbale,data_visita,acc_cant,ipc')
        .eq('cantiere_id', cid).eq('elimina', 0)
        .order('data_visita', { ascending: false }).order('nr_verbale', { ascending: false }).limit(1)
      if (String(stato.cantiere) !== String(cid)) return
      var v = (q.data || [])[0]
      if (!v) {
        stato.ultima = { cid: cid, nessuna: true }
        disegnaRipresa()
        return
      }
      var res = await Promise.all([
        A.rebuildSnapFromDB(v.visita_id),
        sb.from('visite_imprese_presenti').select('impresa_id,att,nom_prec,badge,pat,note_fasilav,nr_lav,nr_lav_str,tipo_imp,ordine,imprese(impresa_nome,impresa_cf,piva)').eq('visita_id', v.visita_id).order('ordine'),
        sb.from('visite_checklist').select('codice,valore,nota').eq('visita_id', v.visita_id)
      ])
      if (String(stato.cantiere) !== String(cid)) return
      var snap = res[0] || {}
      var imprese = ((res[1] && res[1].data) || []).filter(function (r) { return r.impresa_id }).map(function (r) {
        return {
          impresa_id: r.impresa_id, impresa_nome: (r.imprese && r.imprese.impresa_nome) || '', piva: (r.imprese && r.imprese.piva) || '', cf_imp: (r.imprese && r.imprese.impresa_cf) || '',
          ind_imp: '', com_imp: '', att: r.att || '', nom_prec: r.nom_prec || '', capo_nome: '', capo_cog: '', badge: r.badge || '', pat: r.pat || '',
          note_fasilav: r.note_fasilav || '', tipo_imp: r.tipo_imp != null ? String(r.tipo_imp) : '', nr_lav: +r.nr_lav || 0, nr_lav_str: +r.nr_lav_str || 0,
          certif: [], ceiv: '', stage_imp: ''
        }
      })
      var righe = (res[2] && res[2].data) || []
      var note = {}
      righe.forEach(function (r) { if (r.nota) note[r.codice] = r.nota })
      // la nota puo' stare sulla voce o, nei verbali dal modulo Google, sulla voce-nota del gruppo (<PREFISSO>_N)
      var rilievi = righe.filter(function (r) { return ['OSS', 'NC-', 'NC+'].indexOf(r.valore) >= 0 }).map(function (r) { return { codice: r.codice, valore: r.valore, nota: r.nota || note[r.codice] || note[r.codice.replace(/_\d+$/, '') + '_N'] || '' } })
      stato.prima = {}
      rilievi.forEach(function (r) { stato.prima[r.codice] = r })
      stato.ultima = { cid: cid, v: v, snap: snap, imprese: imprese, rilievi: rilievi, fatto: false }
      stato.scelte = {}
      disegnaRipresa()
      segnaPrimaVisibili()
    } catch (e) {
      log('ripresa', e)
      box.innerHTML = '<div class="tm-card"><p class="tm-sotto" style="margin:0">Non sono riuscito a leggere l\'ultimo verbale: ' + h(e.message) + '</p></div>'
    }
  }

  function vociRipresa() {
    var u = stato.ultima, s = u.snap, out = []
    var pers = nome(s.ppre_titolo, s.ppre_nome, s.ppre_cog) || s.nom_ppre
    if (pers) out.push({ k: 'persona', et: 'Persona presente', val: pers + (s.qual_ppre ? ' · ' + s.qual_ppre : ''), a: 'Uguale', b: 'Cambiata' })
    var comm = s.comm_rag_soc || nome(s.comm_titolo, s.comm_nome, s.comm_cog)
    if (comm) out.push({ k: 'committente', et: 'Committente', val: comm, a: 'Uguale', b: 'Cambiato', gia: !!(window.__app && window.__app.vGet('f-comm-id')) })
    var fig = []
    var csp = nome(s.csp_titolo, s.csp_nome, s.csp_cog), cse = nome(s.cse_titolo, s.cse_nome, s.cse_cog), rl = nome(s.rl_titolo, s.rl_nome, s.rl_cog)
    if (csp && csp === cse) fig.push('CSP e CSE ' + csp)
    else { if (csp) fig.push('CSP ' + csp); if (cse) fig.push('CSE ' + cse) }
    if (rl) fig.push('RL ' + rl)
    if (fig.length) out.push({ k: 'coord', et: 'Coordinamento', val: fig.join(' · '), a: 'Uguale', b: 'Cambiato' })
    var ruoli = window.TIPO_IMP_OPT || (typeof TIPO_IMP_OPT !== 'undefined' ? TIPO_IMP_OPT : {})
    u.imprese.forEach(function (im, i) {
      var r = ruoli[im.tipo_imp] ? String(ruoli[im.tipo_imp]).toLowerCase() : ''
      out.push({ k: 'imp' + i, et: i === 0 ? 'Impresa principale' : 'Impresa', val: (im.impresa_nome || im.impresa_id) + (r ? ' · ' + r : '') + (im.nr_lav ? ' · ' + im.nr_lav + ' lav.' : ''), a: "C'è", b: "Non c'è" })
    })
    var lav = (s.lavorazioni || []).length
    if (lav || s.stato_lav) out.push({ k: 'lavorazioni', et: 'Lavorazioni', val: lav ? lav + ' lavorazioni segnate' + (s.stato_lav ? ' · ' + s.stato_lav : '') : s.stato_lav, a: 'Uguali', b: 'Cambiate' })
    return out
  }

  function disegnaRipresa() {
    var box = contenitore()
    var u = stato.ultima
    if (!box || !u) return
    if (u.nessuna) {
      box.innerHTML = '<div class="tm-card"><h3>Primo accesso</h3><p class="tm-sotto" style="margin:0">Su questo cantiere non c\'è ancora un verbale: si compila da capo.</p></div>'
      return
    }
    var nr = nrCorto(u.v.nr_verbale), dt = dataIt(u.v.data_visita)
    var ril = u.rilievi.length ? '<div style="margin-top:12px"><b style="font-size:13px">Da ricontrollare · ' + u.rilievi.length + (u.rilievi.length === 1 ? ' rilievo' : ' rilievi') + ' del verbale ' + h(nr) + '</b>' +
      u.rilievi.map(function (r) {
        var voce = descrVoce(r.codice)
        return '<div class="tm-ril"><span class="badge ' + badge(r.valore) + '">' + h(r.valore) + '</span><span>' + h(voce) + '</span>' + (r.nota ? '<small>' + h(r.nota.length > 260 ? r.nota.slice(0, 257) + '…' : r.nota) + '</small>' : '') + '</div>'
      }).join('') + '<p class="tm-sotto" style="margin:6px 0 0">Nella check-list queste voci portano l\'etichetta «il ' + h(ggmm(u.v.data_visita)) + ': …».</p></div>'
      : '<p class="tm-sotto" style="margin:10px 0 0">Nel verbale ' + h(nr) + ' non c\'erano rilievi da ricontrollare.</p>'
    if (u.fatto) {
      box.innerHTML = '<div class="tm-card"><div class="tm-fatto">✓ <span>Dati ripresi dal verbale ' + h(nr) + ' del ' + h(dt) + '. Controlla il numero dei lavoratori nelle imprese.</span></div>' + ril + '</div>'
      return
    }
    var voci = vociRipresa()
    box.innerHTML = '<div class="tm-card tm-ripresa">' +
      '<h3>Riparti dal verbale ' + h(nr) + ' del ' + h(dt) + '</h3>' +
      '<p class="tm-sotto">' + (u.v.acc_cant ? u.v.acc_cant + '° accesso' + (u.v.ipc ? ', IPC ' + h(u.v.ipc) : '') + '. ' : '') + 'Tocca solo quello che oggi è cambiato: il resto si ricopia nel modulo.</p>' +
      (voci.length ? voci.map(function (x) {
        var no = stato.scelte[x.k] === false
        return '<div class="tm-riga' + (no ? ' tm-no' : '') + '" data-k="' + x.k + '"><span>' + h(x.et) + '</span><b>' + h(x.val) + (x.gia ? ' <small style="color:#6b7280;font-weight:400">(già compilato dal cantiere)</small>' : '') + '</b>' +
          '<span class="tm-due" role="group"><button type="button" aria-pressed="' + !no + '" data-v="1">' + h(x.a) + '</button><button type="button" class="tm-cambia" aria-pressed="' + no + '" data-v="0">' + h(x.b) + '</button></span></div>'
      }).join('') : '<p class="tm-sotto">Il verbale non ha dati da riprendere.</p>') +
      '<div class="tm-azioni"><button type="button" class="btn-primary" data-tm="riprendi">Riprendi i dati confermati</button><button type="button" class="btn-outline btn-sm" data-tm="no">Compilo da capo</button>' +
      '<span class="tm-nota" data-tm="conta"></span></div>' + ril + '</div>'
    var conta = function () {
      var tot = voci.length, cambiati = voci.filter(function (x) { return stato.scelte[x.k] === false }).length
      var c = box.querySelector('[data-tm="conta"]')
      if (c) c.textContent = tot ? (tot - cambiati) + ' da riprendere, ' + cambiati + (cambiati === 1 ? ' cambiato' : ' cambiati') : ''
    }
    box.querySelectorAll('.tm-riga').forEach(function (rg) {
      rg.querySelectorAll('.tm-due button').forEach(function (b) {
        b.onclick = function () {
          var si = b.dataset.v === '1'
          stato.scelte[rg.dataset.k] = si
          rg.classList.toggle('tm-no', !si)
          rg.querySelectorAll('.tm-due button').forEach(function (x) { x.setAttribute('aria-pressed', String((x.dataset.v === '1') === si)) })
          conta()
        }
      })
    })
    conta()
    box.querySelector('[data-tm="riprendi"]').onclick = function () { applicaRipresa(voci) }
    box.querySelector('[data-tm="no"]').onclick = function () {
      stato.ultima.fatto = true
      box.innerHTML = ril ? '<div class="tm-card">' + ril + '</div>' : ''
    }
  }

  function applicaRipresa(voci) {
    var A = app(), S = window.S, u = stato.ultima
    if (!A || !S || !u) return
    try {
      if (A.saveTabData) A.saveTabData()
      var cur = A.buildSnap()
      delete cur.visita_id
      delete cur.stage_vis
      delete cur.nom_stage
      var p = u.snap, presi = 0
      var tieni = function (k) { return voci.some(function (x) { return x.k === k }) && stato.scelte[k] !== false }
      if (tieni('persona')) { CAMPI.persona.forEach(function (c) { if (p[c] != null && p[c] !== '') cur[c] = p[c] }); presi++ }
      if (tieni('committente') && !A.vGet('f-comm-id')) { CAMPI.committente.forEach(function (c) { if (p[c] != null && p[c] !== '') cur[c] = p[c] }); presi++ }
      if (tieni('coord')) { CAMPI.coord.forEach(function (c) { if (p[c] != null && p[c] !== '') cur[c] = p[c] }); presi++ }
      var tenute = u.imprese.filter(function (im, i) { return tieni('imp' + i) })
      if (tenute.length) {
        var gia = (cur.imprese || []).filter(function (im) { return im.impresa_id })
        var ids = gia.map(function (im) { return String(im.impresa_id) })
        cur.imprese = gia.concat(tenute.filter(function (im) { return ids.indexOf(String(im.impresa_id)) < 0 }).map(function (im) { return Object.assign({}, im) }))
        presi += tenute.length
      }
      if (tieni('lavorazioni')) { cur.lavorazioni = (p.lavorazioni || []).map(function (l) { return Object.assign({}, l) }); if (p.stato_lav) cur.stato_lav = p.stato_lav; presi++ }
      A.applySnap(cur)
      if (A.activateTab && S.tab === 2 && A.renderImpreseAccordion) A.renderImpreseAccordion()
      u.fatto = true
      disegnaRipresa()
      contaSezioni()
      avviso(presi ? 'Ripresi ' + presi + ' dati dal verbale ' + nrCorto(u.v.nr_verbale) + ': controlla lavoratori e imprese' : 'Nessun dato ripreso', presi ? 'ok' : 'warn')
    } catch (e) { log('applicaRipresa', e); avviso('Non sono riuscito a riprendere i dati: ' + e.message, 'err') }
  }

  function descrVoce(codice) {
    var S = window.S
    var v = S && S.voci ? S.voci.filter(function (x) { return x.codice === codice })[0] : null
    if (!v) return codice
    var z = window.ZONE_LBL || (typeof ZONE_LBL !== 'undefined' ? ZONE_LBL : {})
    return (z[v.zona_osserv] ? z[v.zona_osserv] + ' › ' : '') + v.descrizione
  }
  function badge(val) { return val === 'NC+' ? 'badge-alto' : val === 'NC-' ? 'badge-medio' : 'badge-oss' }

  /* etichetta «il 25/06: OSS» accanto alle voci con un rilievo nel verbale prima */
  function segnaPrima(ti) {
    var u = stato.ultima
    var z = ti - 2
    if (z < 1 || z > 10) return
    var con = $('zi-' + z)
    if (!con) return
    con.querySelectorAll('.tm-prima').forEach(function (x) { x.remove() })
    if (!u || u.nessuna || !u.v || !formNuova()) return
    con.querySelectorAll('.check-item').forEach(function (it) {
      var r = it.querySelector('input[type=radio][data-c]')
      if (!r) return
      var pr = stato.prima[r.dataset.c]
      if (!pr) return
      var lab = it.querySelector('.check-label')
      if (!lab) return
      var s = document.createElement('span')
      s.className = 'tm-prima' + (pr.valore === 'NC+' ? ' tm-ncp' : pr.valore === 'NC-' ? ' tm-ncm' : '')
      s.textContent = 'il ' + ggmm(u.v.data_visita) + ': ' + pr.valore
      if (pr.nota) s.title = pr.nota
      lab.appendChild(s)
    })
  }
  function segnaPrimaVisibili() {
    var S = window.S
    if (S && S.tab >= 3 && S.tab <= 12) segnaPrima(S.tab)
  }

  /* dettatura delle note (Chrome/Android e Safari; dove non c'è, niente pulsante) */
  var rec = null
  function aggiungiMic(ta) {
    if (!SR || !ta || ta.dataset.tmMic) return
    ta.dataset.tmMic = '1'
    var b = document.createElement('button')
    b.type = 'button'
    b.className = 'tm-mic'
    b.textContent = '🎤 Detta'
    b.title = 'Detta la nota: il testo si aggiunge in fondo'
    ta.insertAdjacentElement('afterend', b)
    b.onclick = function () { detta(ta, b) }
  }
  function detta(ta, b) {
    if (rec) { try { rec.stop() } catch (e) { /* niente */ } return }
    try {
      rec = new SR()
      rec.lang = 'it-IT'
      rec.interimResults = false
      rec.continuous = false
      b.classList.add('tm-on')
      b.textContent = '● Ascolto… tocca per fermare'
      rec.onresult = function (e) {
        var t = ''
        for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' '
        t = t.trim()
        if (!t) return
        var prima = ta.value.replace(/\s+$/, '')
        if (!prima) t = t.charAt(0).toUpperCase() + t.slice(1)
        ta.value = prima ? prima + ' ' + t : t
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
      rec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') avviso('Microfono non autorizzato: consentilo nelle impostazioni del browser', 'warn')
        else if (e.error === 'network') avviso('La dettatura ha bisogno della rete', 'warn')
      }
      rec.onend = function () { rec = null; b.classList.remove('tm-on'); b.textContent = '🎤 Detta' }
      rec.start()
    } catch (e) { rec = null; b.classList.remove('tm-on'); b.textContent = '🎤 Detta'; log('detta', e) }
  }
  function micStatici() { ['f-oss-tec', 'f-oss-int', 'f-note-lav', 'f-note-for-m'].forEach(function (id) { aggiungiMic($(id)) }) }
  function micZona(ti) {
    var z = ti - 2
    var con = $('zi-' + z)
    if (!con) return
    con.querySelectorAll('textarea[data-nota]').forEach(aggiungiMic)
  }

  /* ── avvio ─────────────────────────────────────────────────── */
  function avvia() {
    montaPulsante()
    vestiNav()
    osservaScadenze()
    applica(leggi())
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia)
  else avvia()
})()
