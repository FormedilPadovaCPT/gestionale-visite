/* ============================================================
   DOVE SONO? e APPUNTI CANTIERE — dalla Dashboard (23/09/2026,
   chiesto dall'utente).

   «📍 Dove sono?» (solo telefono e tablet): legge il GPS, ricava
   l'indirizzo dalle coordinate (Nominatim / OpenStreetMap, come le
   mappe dell'app) e dice in quale quartiere di Padova sei, con lo
   stradario ufficiale del Comune (quartierePadova, lo stesso delle
   schede cantiere). Fuori Padova dice comune e zona.

   «📝 Appunti cantiere»: una maschera con l'indirizzo già preso dal
   GPS, un'etichetta per riconoscere la nota e il testo. Servono a
   scrivere il verbale dopo, a casa. Sono PERSONALI: la tabella
   appunti_cantiere ha RLS sull'autore, quindi li vede solo chi li ha
   scritti — nemmeno la segreteria. Al computer la maschera si apre
   senza GPS: lì serve rileggere gli appunti.

   Il testo che si sta scrivendo resta anche nella memoria del
   telefono finché non è salvato: in cantiere la linea va e viene, e
   un appunto non deve perdersi per un salvataggio non riuscito. Se il
   salvataggio fallisce lo si dice, e la bozza resta.

   La posizione non si registra da nessuna parte, salvo le coordinate
   dell'appunto che il tecnico salva. Per ricavare l'indirizzo le
   coordinate vanno a Nominatim (OpenStreetMap), come le tessere delle
   mappe.

   Script classico come proposte-chiusura.js: usa window.sb, window.S,
   window.toast, window.quartierePadova al momento del bisogno.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const MOBILE = window.matchMedia ? window.matchMedia('(max-width: 1024px), (pointer: coarse)') : null;
  const mobile = () => !!(MOBILE && MOBILE.matches);
  const BOZZA = 'appunti.bozza';
  const dataOra = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  /* ── posizione e indirizzo ─────────────────────────────────── */
  function posizione() {
    return new Promise((ok, ko) => {
      if (!navigator.geolocation) { ko(new Error('GPS non disponibile su questo dispositivo')); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
        (e) => ko(new Error(e.code === 1 ? 'hai negato il permesso di usare la posizione' : (e.message || 'posizione non disponibile'))),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  /* indirizzo dalle coordinate; null se Nominatim non risponde */
  async function indirizzoDa(lat, lng) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 10000) : null;
    try {
      const u = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=it&lat=' + lat + '&lon=' + lng;
      const r = await fetch(u, ctl ? { signal: ctl.signal } : {});
      if (!r.ok) return null;
      const j = await r.json();
      const a = (j && j.address) || {};
      const via = a.road || a.pedestrian || a.footway || a.path || a.square || a.neighbourhood || '';
      const comune = a.city || a.town || a.village || a.municipality || a.hamlet || '';
      return {
        via, civico: a.house_number || '', comune, cap: a.postcode || '',
        zona: a.suburb || a.quarter || a.neighbourhood || a.hamlet || '',
        provincia: a.county || '',
      };
    } catch (_e) { return null; } finally { if (t) clearTimeout(t); }
  }

  /* quartiere di Padova dallo stradario; fuori Padova null */
  function quartiere(ind) {
    if (!ind || !/^padova$/i.test(ind.comune || '')) return null;
    const q = typeof window.quartierePadova === 'function' ? window.quartierePadova(ind.via || '', 'Padova') : null;
    return q ? q.nome : null;
  }

  function descrivi(ind) {
    if (!ind) return { titolo: 'Indirizzo non trovato', dove: 'Nessuna risposta dal servizio delle mappe: prova di nuovo tra qualche secondo.' };
    const indirizzo = [ind.via, ind.civico].filter(Boolean).join(' ') || '(via non riconosciuta)';
    const q = quartiere(ind);
    let dove;
    if (/^padova$/i.test(ind.comune || '')) {
      dove = q ? 'Comune di Padova — <b>' + esc(q) + '</b>' : 'Comune di Padova — quartiere non riconosciuto dallo stradario per questa via';
      if (ind.zona) dove += ' · zona ' + esc(ind.zona);
    } else {
      dove = 'Non sei nel Comune di Padova: sei a <b>' + esc(ind.comune || '?') + '</b>' + (ind.zona && ind.zona !== ind.comune ? ' (zona ' + esc(ind.zona) + ')' : '') + (ind.provincia && !/padova/i.test(ind.provincia) ? ', provincia di ' + esc(ind.provincia) : '');
    }
    return { titolo: indirizzo, dove, quartiere: q };
  }

  /* ── finestre (costruite qui, per non toccare index.html) ──── */
  function finestre() {
    if ($('modal-dovesono')) return;
    const box = document.createElement('div');
    box.innerHTML = `
<div class="modal-overlay hidden" id="modal-dovesono">
  <div class="modal-box" style="max-width:460px">
    <h3>📍 Dove sono?</h3>
    <div id="ds-stato" style="font-size:13px;padding:8px 10px;border-radius:8px;background:#f4f6f8;margin-bottom:10px"></div>
    <div id="ds-esito"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px">
      <button class="btn-secondary btn-sm" id="ds-chiudi">Chiudi</button>
      <button class="btn-outline btn-sm" id="ds-rileva">🔄 Rileva di nuovo</button>
      <button class="btn-outline btn-sm" id="ds-maps" style="display:none">🗺️ Apri in Maps</button>
      <button class="btn-primary btn-sm" id="ds-appunto" style="display:none">📝 Prendi un appunto qui</button>
    </div>
  </div>
</div>
<div class="modal-overlay hidden" id="modal-appunti">
  <div class="modal-box" style="max-width:600px">
    <h3 style="margin-bottom:4px">📝 Appunti cantiere</h3>
    <div style="font-size:12px;color:#777;margin-bottom:10px">Li vedi <b>solo tu</b>: servono a ricordare che cosa hai visto quando scrivi il verbale. <span id="ap-autore"></span></div>
    <div id="ap-gps" style="font-size:12.5px;padding:7px 10px;border-radius:8px;background:#f4f6f8;margin-bottom:10px"></div>
    <input type="hidden" id="ap-id">
    <div class="field"><label>Etichetta</label><input type="text" id="ap-etichetta" maxlength="200" placeholder="Es. condominio via Roma, ponteggio lato strada"></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 10px">
      <div class="field"><label>Indirizzo</label><input type="text" id="ap-indirizzo" maxlength="300"></div>
      <div class="field"><label>Comune</label><input type="text" id="ap-comune" maxlength="100"></div>
    </div>
    <div id="ap-quartiere" style="font-size:12px;color:#555;margin:-4px 0 8px"></div>
    <div class="field"><label>Appunti</label><textarea id="ap-testo" rows="8" maxlength="20000" placeholder="Quello che vedi e che ti servirà per il verbale: imprese presenti, lavorazioni, rilievi, persone incontrate…"></textarea></div>
    <div id="ap-bozza-info" style="font-size:11px;color:#999;margin:-4px 0 6px"></div>
    <div class="field" style="margin-bottom:10px"><label>Foto</label>
      <div id="ap-foto" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px"></div>
      <label id="ap-foto-btn" class="btn-outline btn-sm" style="display:inline-block;cursor:pointer;text-transform:none;letter-spacing:normal;font-size:13px;margin:0">📷 Aggiungi foto<input type="file" id="ap-foto-input" accept="image/*" multiple style="display:none"></label>
      <span style="font-size:11px;color:#999;margin-left:6px">Vanno su Drive, senza link pubblico: le vedi solo tu.</span>
    </div>
    <div id="ap-foto-grande" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:100000;align-items:center;justify-content:center;cursor:zoom-out"><img style="max-width:96vw;max-height:92vh;border-radius:6px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn-secondary btn-sm" id="ap-chiudi">Chiudi</button>
      <button class="btn-outline btn-sm" id="ap-gps-btn">📍 Usa la mia posizione</button>
      <button class="btn-outline btn-sm" id="ap-copia">📋 Copia il testo</button>
      <button class="btn-outline btn-sm" id="ap-elimina" style="display:none;color:#c0392b;border-color:#c0392b">🗑 Elimina</button>
      <button class="btn-outline btn-sm" id="ap-nuovo">➕ Nuovo</button>
      <button class="btn-primary btn-sm" id="ap-salva">💾 Salva</button>
    </div>
    <div style="border-top:1px solid #eee;margin-top:14px;padding-top:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <b style="font-size:13px;flex:1 1 auto">I miei appunti <span id="ap-conta" style="font-weight:400;color:#888"></span></b>
        <input type="search" id="ap-cerca" placeholder="Cerca per etichetta, indirizzo, testo…" style="flex:1 1 200px;padding:6px 9px;border:1px solid #ddd;border-radius:8px;font-size:13px">
      </div>
      <div id="ap-elenco" style="max-height:40vh;overflow-y:auto"></div>
    </div>
  </div>
</div>`;
    while (box.firstElementChild) document.body.appendChild(box.firstElementChild);

    $('ds-chiudi').onclick = () => $('modal-dovesono').classList.add('hidden');
    $('ds-rileva').onclick = doveSono;
    $('ds-maps').onclick = () => { if (ultima) window.open('https://www.google.com/maps?q=' + ultima.pos.lat + ',' + ultima.pos.lng, '_blank', 'noopener'); };
    $('ds-appunto').onclick = () => { $('modal-dovesono').classList.add('hidden'); apriAppunti(ultima); };

    $('ap-chiudi').onclick = () => $('modal-appunti').classList.add('hidden');
    $('ap-gps-btn').onclick = () => rilevaPerAppunto();
    $('ap-nuovo').onclick = () => { if (!confermaSeModificato()) return; pulisci(); if (mobile()) rilevaPerAppunto(); };
    $('ap-salva').onclick = salva;
    $('ap-elimina').onclick = elimina;
    $('ap-copia').onclick = copia;
    $('ap-cerca').oninput = disegnaElenco;
    ['ap-etichetta', 'ap-indirizzo', 'ap-comune', 'ap-testo'].forEach((id) => { $(id).oninput = salvaBozza; });
    $('ap-indirizzo').onchange = aggiornaQuartiere;
    $('ap-comune').onchange = aggiornaQuartiere;
    $('ap-foto-input').onchange = (e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) aggiungiFoto(f); };
    $('ap-foto').onclick = (e) => {
      const t = e.target.closest('[data-foto-az]');
      if (!t) return;
      const k = t.dataset.fotoK, az = t.dataset.fotoAz;
      if (az === 'vedi') vediFoto(k);
      else if (az === 'togli') togliFoto(k);
      else if (az === 'riprova') riprovaFoto(k);
    };
    $('ap-foto-grande').onclick = () => { $('ap-foto-grande').style.display = 'none'; };
    $('ap-elenco').onclick = (e) => {
      const r = e.target.closest('[data-ap-id]');
      if (!r) return;
      if (!confermaSeModificato()) return;
      const a = elenco.find((x) => String(x.id) === r.dataset.apId);
      if (a) carica(a);
    };
  }

  /* ── Dove sono? ─────────────────────────────────────────────── */
  let ultima = null;   // {pos, ind}
  async function doveSono() {
    finestre();
    $('modal-dovesono').classList.remove('hidden');
    const st = $('ds-stato'), es = $('ds-esito');
    st.style.color = ''; st.textContent = '⌛ Rilevamento della posizione…';
    es.innerHTML = ''; $('ds-maps').style.display = 'none'; $('ds-appunto').style.display = 'none';
    let pos;
    try { pos = await posizione(); } catch (e) {
      st.style.color = '#c0392b'; st.textContent = '⚠ Posizione non disponibile: ' + e.message + '. Controlla che il GPS sia attivo.';
      return;
    }
    st.innerHTML = '✅ Coordinate ' + pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) + ' <span style="color:#888">(±' + pos.acc + ' m)</span> — cerco l\'indirizzo…';
    const ind = await indirizzoDa(pos.lat, pos.lng);
    ultima = { pos, ind };
    const d = descrivi(ind);
    st.innerHTML = '✅ Coordinate ' + pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) + ' <span style="color:#888">(±' + pos.acc + ' m)</span>'
      + (pos.acc > 100 ? '<br><span style="color:#b35c00">Precisione bassa: all\'aperto e col GPS attivo il dato migliora. Premi «Rileva di nuovo».</span>' : '');
    es.innerHTML = '<div style="font-size:18px;font-weight:700;color:#333;margin-bottom:4px">' + esc(d.titolo) + '</div>'
      + '<div style="font-size:14px;color:#444;line-height:1.5">' + d.dove + '</div>'
      + (d.quartiere ? '<div style="margin-top:10px;display:inline-block;background:#e7500f;color:#fff;border-radius:20px;padding:5px 14px;font-weight:700;font-size:15px">📍 ' + esc(d.quartiere) + '</div>' : '')
      + (ind && ind.cap ? '<div style="font-size:11px;color:#999;margin-top:8px">CAP ' + esc(ind.cap) + ' · indirizzo ricavato da OpenStreetMap, quartiere dallo stradario del Comune di Padova</div>' : '');
    $('ds-maps').style.display = '';
    $('ds-appunto').style.display = '';
  }

  /* ── Appunti ───────────────────────────────────────────────── */
  let elenco = [];
  let posAppunto = null;   // {lat,lng,acc}
  let quartiereAppunto = null;
  let fotografia = '';     // stato del modulo all'ultimo carica/salva, per capire se ci sono modifiche

  const statoModulo = () => ['ap-etichetta', 'ap-indirizzo', 'ap-comune', 'ap-testo'].map((id) => $(id).value).join('\u0001');
  function confermaSeModificato() {
    if (statoModulo() === fotografia) return true;
    return confirm('L\'appunto che stai scrivendo non è salvato. Lo lasci? (la bozza resta nel telefono finché non ne inizi un altro)');
  }

  function nomeAutore() {
    const S = window.S || {};
    const t = S.tecnico;
    if (t) return ((t.tecnico_nome || '') + ' ' + (t.tecnico_cognome || '')).trim();
    return (S.user && S.user.email) || '';
  }

  function pulisci() {
    $('ap-id').value = '';
    ['ap-etichetta', 'ap-indirizzo', 'ap-comune', 'ap-testo'].forEach((id) => { $(id).value = ''; });
    posAppunto = null; quartiereAppunto = null;
    $('ap-quartiere').textContent = '';
    $('ap-gps').style.color = '';
    $('ap-gps').textContent = mobile() ? '' : 'Al computer la posizione non serve: rileggi i tuoi appunti qui sotto, o scrivine uno a mano.';
    $('ap-elimina').style.display = 'none';
    $('ap-bozza-info').textContent = '';
    foto = []; disegnaFoto();
    fotografia = statoModulo();
    try { localStorage.removeItem(BOZZA); } catch (_e) { /* niente */ }
  }

  function carica(a) {
    $('ap-id').value = a.id;
    $('ap-etichetta').value = a.etichetta || '';
    $('ap-indirizzo').value = a.indirizzo || '';
    $('ap-comune').value = a.comune || '';
    $('ap-testo').value = a.testo || '';
    posAppunto = a.lat != null ? { lat: a.lat, lng: a.lng, acc: a.precisione_m } : null;
    quartiereAppunto = a.quartiere || null;
    $('ap-quartiere').textContent = a.quartiere ? '📍 ' + a.quartiere : '';
    $('ap-gps').style.color = '';
    $('ap-gps').textContent = 'Appunto del ' + dataOra(a.creato_il) + (a.aggiornato_il && a.aggiornato_il !== a.creato_il ? ' · modificato il ' + dataOra(a.aggiornato_il) : '');
    $('ap-elimina').style.display = '';
    $('ap-bozza-info').textContent = '';
    fotografia = statoModulo();
    caricaFoto(a.id);
    $('ap-testo').focus();
  }

  function salvaBozza() {
    try {
      localStorage.setItem(BOZZA, JSON.stringify({
        id: $('ap-id').value, etichetta: $('ap-etichetta').value, indirizzo: $('ap-indirizzo').value,
        comune: $('ap-comune').value, testo: $('ap-testo').value, pos: posAppunto, quartiere: quartiereAppunto, il: new Date().toISOString(),
      }));
      $('ap-bozza-info').textContent = 'Non ancora salvato — il testo resta intanto nella memoria di questo dispositivo.';
    } catch (_e) { /* memoria del browser non disponibile: si salva solo con Salva */ }
  }

  function leggiBozza() {
    try { const b = JSON.parse(localStorage.getItem(BOZZA) || 'null'); return b && (b.testo || b.etichetta) ? b : null; } catch (_e) { return null; }
  }

  function aggiornaQuartiere() {
    const q = quartiere({ via: $('ap-indirizzo').value.replace(/\s+\d+\S*$/, ''), comune: $('ap-comune').value.trim() });
    quartiereAppunto = q;
    $('ap-quartiere').textContent = q ? '📍 ' + q : '';
  }

  async function rilevaPerAppunto(dato) {
    const g = $('ap-gps');
    let pos, ind;
    if (dato && dato.pos) { pos = dato.pos; ind = dato.ind; } else {
      g.style.color = ''; g.textContent = '⌛ Rilevamento della posizione…';
      try { pos = await posizione(); } catch (e) {
        g.style.color = '#c0392b'; g.textContent = '⚠ Posizione non disponibile: ' + e.message + '. Puoi scrivere l\'indirizzo a mano.';
        return;
      }
      g.textContent = '⌛ Cerco l\'indirizzo…';
      ind = await indirizzoDa(pos.lat, pos.lng);
    }
    posAppunto = pos;
    if (ind) {
      $('ap-indirizzo').value = [ind.via, ind.civico].filter(Boolean).join(' ');
      $('ap-comune').value = ind.comune || '';
      quartiereAppunto = quartiere(ind);
      $('ap-quartiere').textContent = quartiereAppunto ? '📍 ' + quartiereAppunto + (ind.zona ? ' · zona ' + ind.zona : '') : (ind.zona ? 'zona ' + ind.zona : '');
      g.innerHTML = '✅ Indirizzo dal GPS <span style="color:#888">(±' + pos.acc + ' m)</span>: correggilo se non è preciso.';
    } else {
      g.style.color = '#b35c00';
      g.innerHTML = 'Posizione presa <span style="color:#888">(±' + pos.acc + ' m)</span>, ma l\'indirizzo non è arrivato: scrivilo a mano. Le coordinate si salvano comunque.';
    }
    salvaBozza();
  }

  async function apriAppunti(dato) {
    finestre();
    $('modal-appunti').classList.remove('hidden');
    const nome = nomeAutore();
    $('ap-autore').textContent = nome ? 'Autore: ' + nome + '.' : '';
    const b = leggiBozza();
    if (b) {   // un appunto non salvato ha la precedenza anche su «Prendi un appunto qui»: non si perde
      pulisci();
      $('ap-id').value = b.id || '';
      $('ap-etichetta').value = b.etichetta || ''; $('ap-indirizzo').value = b.indirizzo || '';
      $('ap-comune').value = b.comune || ''; $('ap-testo').value = b.testo || '';
      posAppunto = b.pos || null; quartiereAppunto = b.quartiere || null;
      $('ap-quartiere').textContent = b.quartiere ? '📍 ' + b.quartiere : '';
      $('ap-elimina').style.display = b.id ? '' : 'none';
      if (b.id) caricaFoto(b.id);
      $('ap-gps').style.color = '#b35c00';
      $('ap-gps').textContent = 'Ho ritrovato un appunto non salvato del ' + dataOra(b.il) + ': controllalo e premi Salva.';
      fotografia = '';   // e' da salvare
      try { localStorage.setItem(BOZZA, JSON.stringify(b)); } catch (_e) { /* niente */ }
    } else {
      pulisci();
      if (dato && dato.pos) rilevaPerAppunto(dato);
      else if (mobile()) rilevaPerAppunto();
    }
    await caricaElenco();
  }

  async function caricaElenco() {
    const el = $('ap-elenco');
    el.innerHTML = '<div style="color:#999;font-size:12px;padding:6px">Caricamento…</div>';
    const { data, error } = await window.sb.from('appunti_cantiere')
      .select('id,etichetta,indirizzo,comune,quartiere,lat,lng,precisione_m,testo,creato_il,aggiornato_il,appunti_cantiere_foto(count)')
      .order('aggiornato_il', { ascending: false }).order('id', { ascending: false }).limit(1000);
    if (error) {
      elenco = [];
      el.innerHTML = '<div style="color:#c0392b;font-size:12px;padding:6px">Non sono riuscito a leggere i tuoi appunti: ' + esc(error.message) + '</div>';
      $('ap-conta').textContent = '';
      return;
    }
    elenco = data || [];
    disegnaElenco();
  }

  function disegnaElenco() {
    const el = $('ap-elenco');
    const q = ($('ap-cerca').value || '').trim().toLowerCase();
    const righe = elenco.filter((a) => !q || [a.etichetta, a.indirizzo, a.comune, a.quartiere, a.testo].join(' ').toLowerCase().includes(q));
    $('ap-conta').textContent = elenco.length ? '(' + (q ? righe.length + ' di ' : '') + elenco.length + ')' : '';
    if (!elenco.length) { el.innerHTML = '<div style="color:#999;font-size:12px;padding:6px">Non hai ancora appunti.</div>'; return; }
    if (!righe.length) { el.innerHTML = '<div style="color:#999;font-size:12px;padding:6px">Nessun appunto con questa ricerca.</div>'; return; }
    el.innerHTML = righe.map((a) => {
      const testo = String(a.testo || '');
      const nf = (a.appunti_cantiere_foto && a.appunti_cantiere_foto[0] && a.appunti_cantiere_foto[0].count) || 0;
      return '<div data-ap-id="' + a.id + '" style="padding:8px 10px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;cursor:pointer;background:' + (String(a.id) === $('ap-id').value ? '#fff4ee' : '#fff') + '">'
        + '<div style="display:flex;gap:8px;justify-content:space-between;align-items:baseline"><b style="font-size:13px">' + esc(a.etichetta || '(senza etichetta)') + (nf ? ' <span style="font-weight:400;color:#888">📷 ' + nf + '</span>' : '') + '</b>'
        + '<span style="font-size:11px;color:#999;white-space:nowrap">' + dataOra(a.aggiornato_il) + '</span></div>'
        + '<div style="font-size:12px;color:#555">' + esc([a.indirizzo, a.comune].filter(Boolean).join(', ')) + (a.quartiere ? ' · ' + esc(a.quartiere) : '') + '</div>'
        + (testo ? '<div style="font-size:12px;color:#777;margin-top:3px;white-space:pre-wrap">' + esc(testo.length > 160 ? testo.slice(0, 160) + '…' : testo) + '</div>' : '')
        + '</div>';
    }).join('');
  }

  /* true se salvato; silenzioso = prima di caricare una foto (serve l'id dell'appunto) */
  async function salva(silenzioso) {
    if (silenzioso !== true) silenzioso = false;
    const riga = {
      etichetta: $('ap-etichetta').value.trim() || null,
      indirizzo: $('ap-indirizzo').value.trim() || null,
      comune: $('ap-comune').value.trim() || null,
      quartiere: quartiereAppunto || null,
      testo: $('ap-testo').value.trim() || null,
      lat: posAppunto ? posAppunto.lat : null,
      lng: posAppunto ? posAppunto.lng : null,
      precisione_m: posAppunto && posAppunto.acc != null ? posAppunto.acc : null,
    };
    if (!riga.etichetta && !riga.indirizzo && !riga.testo) { avviso('Scrivi almeno un\'etichetta, un indirizzo o un appunto' + (silenzioso ? ' prima di aggiungere foto' : ''), 'warn'); return false; }
    const id = $('ap-id').value;
    const bt = $('ap-salva'); bt.disabled = true;
    let res;
    try {
      res = id
        ? await window.sb.from('appunti_cantiere').update(riga).eq('id', id).select('*').single()
        : await window.sb.from('appunti_cantiere').insert(riga).select('*').single();
    } catch (e) { res = { error: e }; }
    bt.disabled = false;
    if (res.error || !res.data) {
      avviso('Appunto NON salvato: ' + ((res.error && res.error.message) || 'nessuna risposta') + '. Il testo resta nel telefono: riprova quando c\'è linea.', 'err');
      salvaBozza();
      return false;
    }
    try { localStorage.removeItem(BOZZA); } catch (_e) { /* niente */ }
    if (!silenzioso) avviso('Appunto salvato', 'ok');
    await caricaElenco();
    if (silenzioso) {   // resta com'e' sullo schermo, prende solo l'id
      $('ap-id').value = res.data.id; $('ap-elimina').style.display = ''; $('ap-bozza-info').textContent = '';
      fotografia = statoModulo();
    } else carica(res.data);
    return true;
  }

  async function elimina() {
    const id = $('ap-id').value;
    if (!id) return;
    const nf = foto.filter((f) => f.id).length;
    if (!confirm('Eliminare questo appunto' + (nf ? ' e le sue ' + nf + ' foto' : '') + '? Dall\'app non si recupera.')) return;
    // prima le foto (vanno nel cestino di Drive), poi l'appunto: se una foto non si toglie ci si ferma
    for (const f of foto.filter((x) => x.id)) {
      const r = await funzione({ azione: 'elimina', foto_id: f.id });
      if (!r.ok) { avviso('Non sono riuscito a togliere una foto (' + r.error + '): l\'appunto resta, riprova.', 'err'); await caricaFoto(id); return; }
    }
    const { error } = await window.sb.from('appunti_cantiere').delete().eq('id', id);
    if (error) { avviso('Non sono riuscito a eliminare l\'appunto: ' + error.message, 'err'); return; }
    avviso('Appunto eliminato', 'ok');
    pulisci();
    await caricaElenco();
  }

  /* ── foto (funzione foto-appunti: Drive senza link pubblico) ── */
  let foto = [];   // {k, id?, src?, b64?, stato:'ok'|'carico'|'errore'|'leggo', err?}
  let fotoSeq = 0;

  async function funzione(body) {
    try {
      const { data, error } = await window.sb.functions.invoke('foto-appunti', { body });
      if (error) {
        let msg = error.message || 'errore';
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_e) { /* niente */ }
        return { ok: false, error: msg };
      }
      return data && data.ok ? data : { ok: false, error: (data && data.error) || 'nessuna risposta' };
    } catch (e) { return { ok: false, error: (e && e.message) || 'rete assente' }; }
  }

  function disegnaFoto() {
    const el = $('ap-foto');
    if (!el) return;
    el.innerHTML = foto.map((f) => {
      const base = 'position:relative;width:84px;height:84px;border-radius:8px;overflow:hidden;background:#f1f1f1;display:flex;align-items:center;justify-content:center;font-size:11px;color:#888;text-align:center;';
      const x = f.stato !== 'carico' ? '<button type="button" data-foto-az="togli" data-foto-k="' + f.k + '" title="Togli la foto" style="position:absolute;top:2px;right:2px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:14px;line-height:22px;padding:0;cursor:pointer">×</button>' : '';
      if (f.stato === 'ok' && f.src) return '<div style="' + base + '"><img src="' + f.src + '" data-foto-az="vedi" data-foto-k="' + f.k + '" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">' + x + '</div>';
      if (f.stato === 'carico') return '<div style="' + base + '">⌛<br>carico…</div>';
      if (f.stato === 'leggo') return '<div style="' + base + '">⌛</div>' ;
      return '<div style="' + base + 'border:2px solid #c0392b;flex-direction:column;gap:4px;padding:4px">'
        + (f.src ? '<img src="' + f.src + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35">' : '')
        + '<span style="position:relative;color:#c0392b;font-weight:600">' + (f.id ? 'non letta' : 'non caricata') + '</span>'
        + (f.b64 ? '<button type="button" data-foto-az="riprova" data-foto-k="' + f.k + '" style="position:relative;font-size:11px;padding:2px 6px;border-radius:6px;border:1px solid #c0392b;background:#fff;color:#c0392b;cursor:pointer">Riprova</button>' : '')
        + x + '</div>';
    }).join('');
  }

  async function caricaFoto(appuntoId) {
    foto = []; disegnaFoto();
    const { data, error } = await window.sb.from('appunti_cantiere_foto').select('id').eq('appunto_id', appuntoId).order('id');
    if (String(appuntoId) !== $('ap-id').value) return;   // nel frattempo si e' aperto un altro appunto
    if (error) { $('ap-foto').innerHTML = '<span style="font-size:12px;color:#c0392b">Non sono riuscito a leggere le foto: ' + esc(error.message) + '</span>'; return; }
    foto = (data || []).map((r) => ({ k: 'f' + (++fotoSeq), id: r.id, stato: 'leggo' }));
    disegnaFoto();
    for (const f of foto.slice()) {
      const r = await funzione({ azione: 'scarica', foto_id: f.id });
      if (String(appuntoId) !== $('ap-id').value) return;
      if (r.ok) { f.src = 'data:image/jpeg;base64,' + r.base64; f.stato = 'ok'; } else { f.stato = 'errore'; f.err = r.error; }
      disegnaFoto();
    }
  }

  /* riduce la foto (lato lungo 1600 px, JPEG 0.82), come le foto delle segnalazioni */
  function comprimi(file) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.onerror = () => ko(new Error('immagine non leggibile'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function mandaFoto(f) {
    f.stato = 'carico'; disegnaFoto();
    const r = await funzione({ azione: 'carica', appunto_id: Number($('ap-id').value), image_base64: f.b64 });
    if (r.ok && r.foto) { f.id = r.foto.id; f.stato = 'ok'; f.b64 = null; }
    else { f.stato = 'errore'; f.err = r.error; avviso('Foto NON caricata: ' + r.error + '. Premi «Riprova» sulla foto quando c\'è linea.', 'err'); }
    disegnaFoto();
    caricaElenco();
  }

  async function aggiungiFoto(files) {
    if (!$('ap-id').value) {   // la foto si aggancia all'appunto: prima lo si salva
      const ok = await salva(true);
      if (!ok) return;
    }
    for (const file of files) {
      const f = { k: 'f' + (++fotoSeq), stato: 'carico' };
      foto.push(f); disegnaFoto();
      try { f.b64 = await comprimi(file); f.src = 'data:image/jpeg;base64,' + f.b64; } catch (e) {
        f.stato = 'errore'; f.err = e.message; disegnaFoto(); avviso('Foto non leggibile: ' + e.message, 'err'); continue;
      }
      await mandaFoto(f);
    }
  }

  function riprovaFoto(k) { const f = foto.find((x) => x.k === k); if (f && f.b64) mandaFoto(f); }

  function vediFoto(k) {
    const f = foto.find((x) => x.k === k);
    if (!f || !f.src) return;
    const g = $('ap-foto-grande'); g.querySelector('img').src = f.src; g.style.display = 'flex';
  }

  async function togliFoto(k) {
    const f = foto.find((x) => x.k === k);
    if (!f) return;
    if (f.id) {
      if (!confirm('Togliere questa foto dall\'appunto?')) return;
      const r = await funzione({ azione: 'elimina', foto_id: f.id });
      if (!r.ok) { avviso('Non sono riuscito a togliere la foto: ' + r.error, 'err'); return; }
    }
    foto = foto.filter((x) => x !== f);
    disegnaFoto();
    caricaElenco();
  }

  async function copia() {
    const testo = [$('ap-etichetta').value, [$('ap-indirizzo').value, $('ap-comune').value].filter(Boolean).join(', '), $('ap-testo').value].filter((s) => s && s.trim()).join('\n');
    if (!testo) { avviso('Non c\'è niente da copiare', 'warn'); return; }
    try { await navigator.clipboard.writeText(testo); avviso('Testo copiato: incollalo nel verbale', 'ok'); } catch (_e) {
      $('ap-testo').select(); avviso('Copia non riuscita: il testo è selezionato, copialo a mano', 'warn');
    }
  }

  /* ── pulsanti in Dashboard ─────────────────────────────────── */
  function pulsanti() {
    const wrap = $('dash-segnala-wrap');
    if (!wrap || $('btn-appunti')) return;
    const stile = 'flex:1;min-width:160px;padding:12px;font-size:15px;border-radius:10px;background:#fff;border:2px solid #565c66;color:#565c66;font-weight:600;cursor:pointer';
    const d = document.createElement('button');
    d.id = 'btn-dove-sono'; d.type = 'button'; d.style.cssText = stile; d.textContent = '📍 Dove sono?';
    d.onclick = doveSono;
    const a = document.createElement('button');
    a.id = 'btn-appunti'; a.type = 'button'; a.style.cssText = stile; a.textContent = '📝 Appunti cantiere';
    a.onclick = () => apriAppunti();
    wrap.appendChild(d); wrap.appendChild(a);
    const vedi = () => { d.style.display = mobile() ? '' : 'none'; a.style.gridColumn = mobile() ? '' : '1/-1'; };
    vedi();
    if (MOBILE && MOBILE.addEventListener) MOBILE.addEventListener('change', vedi);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pulsanti); else pulsanti();

  window.appuntiCantiere = { apri: apriAppunti, doveSono, indirizzoDa, descrivi };
})();
