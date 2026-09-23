# -*- coding: utf-8 -*-
"""23/09/2026 - Dashboard pratica da telefono, statistiche in una scheda a parte.

Chiesto dall'utente: «pulire la dashboard e renderla pratica per uso al cell;
via tutte le statistiche, in una scheda finale dopo gli incarichi. Nella
dashboard mantieni la mappa, specificando che li' si vede l'ultima visita dei
cantieri con IPC, quindi la situazione dei cantieri in monitoraggio attuale
da parte di tutti i tecnici».

- Dashboard: pulsanti rapidi, avvisi e riquadri, obiettivo del mese, mappa.
- Nuova scheda «📊 Statistiche» dopo Incarichi: filtri, contatori, grafici e
  tabelle, spostati tali e quali (stessi id: il codice che li disegna non cambia).
  Si caricano solo quando si apre la scheda: la Dashboard non scarica piu' le
  visite dell'esercizio a ogni apertura.
- Mappa: solo cantieri APERTI (v_mappa_cantieri.cantiere_chiuso, colonna aggiunta
  oggi), colore = IPC dell'ultima visita di qualunque tecnico; spiegazione scritta
  sopra la mappa. Sul telefono l'altezza segue lo schermo.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)
NL = CRLF if CRLF in src else LF
assert NL == LF


def sost(vecchio, nuovo, nome):
    global src
    c = src.count(vecchio)
    assert c == 1, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)


def taglia(inizio, fine, nome):
    """Toglie da src il pezzo da `inizio` (compreso) a `fine` (escluso) e lo restituisce."""
    global src
    assert src.count(inizio) == 1, nome + ': inizio non unico'
    i = src.index(inizio)
    j = src.index(fine, i)
    pezzo = src[i:j]
    src = src[:i] + src[j:]
    return pezzo


# ── 1. menu: la scheda Statistiche dopo Incarichi ──
sost("""    <button id="nav-assev" style="display:none;""",
     """    <button data-view="statistiche" id="nav-statistiche">📊 Statistiche</button>
    <button id="nav-assev" style="display:none;""", 'menu')

sost("""['dashboard','form','lista','cantieri','rubrica','scadenze','incarichi','admin','segreteria','committenti'].forEach(v=>""",
     """['dashboard','form','lista','cantieri','rubrica','scadenze','incarichi','statistiche','admin','segreteria','committenti'].forEach(v=>""", 'navTo elenco')

sost("""  if(view==='incarichi'&&typeof loadIncarichi==='function')loadIncarichi().catch(e=>console.warn('loadIncarichi:',e))
""", """  if(view==='incarichi'&&typeof loadIncarichi==='function')loadIncarichi().catch(e=>console.warn('loadIncarichi:',e))
  if(view==='statistiche')loadStat().catch(e=>{console.error('loadStat:',e);toast('Errore caricamento statistiche: '+e.message,'err')})
""", 'navTo statistiche')

# ── 2. HTML: obiettivo del mese e statistiche escono dal blocco ──
obiettivo = taglia("""      <div class="card" id="card-target-mese" """,
                   """      <div class="dash-row-2">
        <div class="card"><h3>Visite per esercizio""", 'obiettivo')

statistiche = taglia("""            <!-- FILTRI DASHBOARD -->""",
                     """<div class="card">
        <h3>Mappa cantieri visitati &mdash; IPC ultima visita</h3>""", 'statistiche')
assert 'id="dash-kpi"' in statistiche and 'id="ch-importo"' in statistiche
assert 'dash-map' not in statistiche and 'card-target-mese' not in statistiche
statistiche = statistiche.replace("""            <!-- FILTRI DASHBOARD -->""", """      <!-- FILTRI STATISTICHE (ex Dashboard, 23/09/2026: gli id restano fd-*/k-*/ch-*) -->""")
statistiche = statistiche.rstrip() + LF

# la mappa, con il titolo e la spiegazione chiesti
sost("""<div class="card">
        <h3>Mappa cantieri visitati &mdash; IPC ultima visita</h3>
        <div id="dash-map-filters\"""", obiettivo + """      <div class="card" id="dash-map-card">
        <h3>🗺️ Cantieri in monitoraggio &mdash; IPC dell'ultima visita</h3>
        <p id="dash-map-spiega" style="font-size:12.5px;color:#555;margin:-4px 0 8px;line-height:1.45">Ogni pallino è un <b>cantiere aperto</b>, colorato con l'IPC della sua <b>ultima visita</b>, chiunque l'abbia fatta: è la situazione attuale dei cantieri che tutti i tecnici stanno seguendo. I cantieri chiusi non compaiono. Tocca un pallino per verbale, data e tecnico.</p>
        <div id="dash-map-filters\"""", 'mappa titolo')

sost("""<div id="dash-map-note" style="font-size:11px;color:#999;margin-top:6px">I segnaposto con bordo tratteggiato sono al centro del comune (indirizzo non geolocalizzabile con precisione); gli altri sono geolocalizzati sull'indirizzo.</div>""",
     """<div id="dash-map-note" style="font-size:11px;color:#999;margin-top:6px">Bordo tratteggiato = posizione al centro del comune (indirizzo non geolocalizzabile con precisione); gli altri sono sull'indirizzo. Contatori, grafici e tabelle sono nella scheda <b>📊 Statistiche</b>.</div>""", 'mappa nota')

# la nuova sezione, dopo Incarichi
sost("""    <section id="view-committenti" class="hidden">""", """    <!-- STATISTICHE (23/09/2026): contatori, grafici e tabelle usciti dalla Dashboard -->
    <section id="view-statistiche" class="hidden">
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <h2 style="margin:0;font-size:18px;color:var(--orange)">📊 Statistiche delle visite</h2>
        <span style="font-size:12px;color:#888">Si calcolano quando apri questa scheda; i filtri valgono per tutto quello che sta sotto.</span>
      </div>
""" + statistiche + """    </section>

    <section id="view-committenti" class="hidden">""", 'sezione')

# ── 3. CSS: le regole della dashboard valgono anche per le statistiche ──
sost("""  #view-dashboard div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}""",
     """  #view-dashboard div[style*="grid-template-columns:1fr 1fr"],#view-statistiche div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}
  /* mappa della Dashboard: sul telefono alta quanto lo schermo lascia (23/09/2026) */
  #dash-map{height:62vh!important;min-height:320px}""", 'css mobile')
sost("""#view-dashboard .card h3{font-size:13px;""", """#view-dashboard .card h3,#view-statistiche .card h3{font-size:13px;""", 'css h3')
sost("""#view-dashboard .card h3::after{""", """#view-dashboard .card h3::after,#view-statistiche .card h3::after{""", 'css h3 after')

# ── 4. JS: la Dashboard carica solo il suo, le statistiche all'apertura della scheda ──
sost("""async function loadDash(){
  if($('fd-count'))$('fd-count').textContent='Caricamento dati…'
  // mappa tecnici
  const{data:tecs}=await sb.from('tecnici').select('tecnico_id,tecnico_nome,tecnico_cognome')
  _dashTecMap={}
  ;(tecs||[]).forEach(t=>{_dashTecMap[t.tecnico_id]=((t.tecnico_cognome||'')+' '+(t.tecnico_nome||'')).trim()||t.tecnico_id})
  // per il tecnico la card obiettivo va in alto: sotto gli avvisi, prima dei filtri
  if(S.tecnico&&!window.__isCoord){
    const _ct=$('card-target-mese'),_df=$('dash-filtri')
    if(_ct&&_df&&_df.parentNode&&_ct.nextElementSibling!==_df)_df.parentNode.insertBefore(_ct,_df)
  }
  // card obiettivo mensile (non blocca la dashboard se fallisce)
  loadTargetCard&&loadTargetCard().catch(e=>console.warn('loadTargetCard:',e))
  loadAvvisi&&loadAvvisi().catch(e=>console.warn('loadAvvisi:',e))
  loadIncarichi&&loadIncarichi().catch(e=>console.warn('loadIncarichi:',e))
  _incApertiCache=null
""", """// Dashboard (23/09/2026): pulsanti, avvisi, obiettivo del mese e mappa dei cantieri
// in monitoraggio. Contatori, grafici e tabelle sono nella scheda Statistiche (loadStat).
async function loadDash(){
  // card obiettivo mensile (non blocca la dashboard se fallisce)
  loadTargetCard&&loadTargetCard().catch(e=>console.warn('loadTargetCard:',e))
  loadAvvisi&&loadAvvisi().catch(e=>console.warn('loadAvvisi:',e))
  loadIncarichi&&loadIncarichi().catch(e=>console.warn('loadIncarichi:',e))
  _incApertiCache=null
  await loadDashMap()
}

async function loadStat(){
  if($('fd-count'))$('fd-count').textContent='Caricamento dati…'
  // mappa tecnici
  const{data:tecs}=await sb.from('tecnici').select('tecnico_id,tecnico_nome,tecnico_cognome')
  _dashTecMap={}
  ;(tecs||[]).forEach(t=>{_dashTecMap[t.tecnico_id]=((t.tecnico_cognome||'')+' '+(t.tecnico_nome||'')).trim()||t.tecnico_id})
""", 'loadDash')

sost("""  _dashFillSelectors()
  applyDashFilters()
  loadDashMap().catch(e=>console.error('loadDashMap:',e))
}""", """  _dashFillSelectors()
  applyDashFilters()
}""", 'loadStat fine')

sost("""        try{await loadDash()}catch(e){console.error('loadDash storico:',e);toast('Errore caricamento storico: '+e.message,'err')}""",
     """        try{await loadStat()}catch(e){console.error('loadStat storico:',e);toast('Errore caricamento storico: '+e.message,'err')}""", 'storico')

sost("""  // per il tecnico (non coordinatore) la card va sopra i selettori della dashboard
  if(S.tecnico&&!window.__isCoord){
    const _df=$('dash-filtri')
    if(_df&&_df.parentNode&&card.nextElementSibling!==_df)_df.parentNode.insertBefore(card,_df)
  }
""", "", 'target card')

# ── 5. mappa: solo cantieri aperti ──
sost("""      .select('cantiere_id,lat,lng,ipc,geocode_status,indirizzo,comune_nome,tecnico,data_visita,nr_verbale')
      .order('cantiere_id').order('nr_verbale').range(da,a))
  }catch(error){console.error('v_mappa_cantieri:',error);toast('Mappa: non sono riuscito a leggere i cantieri visitati','err');return}
  const rows=(data||[]).filter(r=>r.lat!=null&&r.lng!=null)""",
     """      .select('cantiere_id,lat,lng,ipc,geocode_status,indirizzo,comune_nome,tecnico,data_visita,nr_verbale,cantiere_chiuso')
      .order('cantiere_id').order('nr_verbale').range(da,a))
  }catch(error){console.error('v_mappa_cantieri:',error);toast('Mappa: non sono riuscito a leggere i cantieri visitati','err');return}
  // solo i cantieri aperti: e' la situazione dei cantieri in monitoraggio (23/09/2026)
  const rows=(data||[]).filter(r=>r.lat!=null&&r.lng!=null&&!r.cantiere_chiuso)""", 'mappa aperti')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
