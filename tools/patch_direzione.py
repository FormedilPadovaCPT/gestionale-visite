# -*- coding: utf-8 -*-
"""25/09/2026 - Direzione e Consiglio nel gestionale.

1. Gli account di sola lettura (Direttore, Presidente, Vicepresidente,
   consiglieri) tornano a vedere le Statistiche: dal 23/09 il menu era
   nascosto e con esso la scheda. Vedono due schede, Mappa e Statistiche,
   senza i tasti da tecnico (Segnala, Appunti, Dove sono, QR) e senza i
   riquadri per tecnico (filtro, grafico, produttivita').
2. Il Direttore ha la sua pagina «Direzione» (direzione.js): autorizzazioni,
   conferme sui cantieri critici, registro delle questioni in attesa.
   La Presidenza ha la stessa pagina per le questioni sue.
3. Coordinatore e segreteria hanno il registro nella Zona Coordinatore.
4. La mappa della Dashboard si apre filtrata sul tecnico collegato.
5. KPI «Visite minime CEIV» nelle Statistiche, obiettivo in Zona Segreteria.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)

def leggi(p):
    return io.open(p, encoding='utf-8', newline='').read()

def scrivi(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

# ─────────────────────────────────────────────────────────────── index.html
P = 'index.html'
src = leggi(P)
n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome, quante=1):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == quante, '%s: trovate %d occorrenze (attese %d)' % (nome, c, quante)
    src = src.replace(vecchio, nuovo)

# 1. CSS: che cosa non vede chi e' in sola lettura
sost("""body.viewer-mode #btn-diniego-dash{display:none!important}
""", """body.viewer-mode #btn-diniego-dash{display:none!important}
/* sola lettura (Direzione e Consiglio, 25/09/2026): niente tasti da tecnico, niente riquadri per tecnico */
body.viewer-mode #btn-segnala-dash,body.viewer-mode #btn-qr-servizi,body.viewer-mode #btn-dove-sono,body.viewer-mode #btn-appunti,body.viewer-mode #dash-appunti-card,body.viewer-mode #card-target-mese,body.viewer-mode #dash-notifiche,body.viewer-mode #fld-fd-tec,body.viewer-mode #card-ch-tecnico,body.viewer-mode #card-tbl-prod{display:none!important}
#view-direzione h2{margin:0 0 4px;font-size:18px;color:var(--orange)}
#nav-dir-badge{background:#e7500f;color:#fff;border-radius:10px;padding:0 7px;font-size:11px;font-weight:700;margin-left:6px}
#view-admin #adm-decisioni .card{color:#222;text-align:left}#view-admin #adm-decisioni .card h3{color:#565c66}
""", 'css viewer')

# 2. menu: il pulsante «Direzione» (nascosto: lo accende onLogin)
sost("""    <button data-view="statistiche" id="nav-statistiche">📊 Statistiche</button>
""", """    <button data-view="statistiche" id="nav-statistiche">📊 Statistiche</button>
    <button data-view="direzione" id="nav-direzione" style="display:none">🏛️ Direzione<span id="nav-dir-badge" style="display:none">0</span></button>
""", 'nav direzione')

# 3. la pagina Direzione, prima delle Statistiche
sost("""    <!-- STATISTICHE (23/09/2026): contatori, grafici e tabelle usciti dalla Dashboard -->
""", """    <!-- DIREZIONE (25/09/2026): la pagina del Direttore (e della Presidenza) — direzione.js -->
    <section id="view-direzione" class="hidden">
      <h2>🏛️ Direzione — <span id="dir-nome"></span></h2>
      <p id="dir-intro" style="font-size:12.5px;color:#555;margin:0 0 12px;line-height:1.45"></p>
      <div id="dir-autorizzazioni" style="margin-bottom:14px"></div>
      <div id="dir-critici" style="margin-bottom:14px"></div>
      <div id="dir-decisioni" style="margin-bottom:14px"></div>
    </section>

    <!-- STATISTICHE (23/09/2026): contatori, grafici e tabelle usciti dalla Dashboard -->
""", 'view direzione')

# 4. Statistiche: id sui riquadri per tecnico, KPI visite minime CEIV
sost("""          <div class="field"><label>Tecnico</label><select id="fd-tec" style="font-size:13px"></select></div>
""", """          <div class="field" id="fld-fd-tec"><label>Tecnico</label><select id="fd-tec" style="font-size:13px"></select></div>
""", 'fd-tec')
sost("""        <div class="stat-card"><div class="num" id="k-cant" style="color:var(--orange)">–</div><div class="lbl">Cantieri visitati</div></div>
""", """        <div class="stat-card"><div class="num" id="k-cant" style="color:var(--orange)">–</div><div class="lbl">Cantieri visitati</div></div>
        <div class="stat-card" id="card-k-ceivmin" title="Regola CEIV: 100 visite ogni 50.000 € di contributi Cassa Edile (quota CPT). Le fatte contano tutte le visite dell'esercizio, di tutti i tecnici."><div class="num" id="k-ceivmin" style="color:#95C22F">–</div><div class="pct" id="k-ceivmin-pct" style="color:#888"></div><div class="lbl">Visite fatte / minime CEIV</div></div>
""", 'kpi ceiv')
sost("""        <div class="card"><h3>Sopralluoghi per tecnico</h3><div class="chbox" style="height:260px"><canvas id="ch-tecnico"></canvas></div></div>
""", """        <div class="card" id="card-ch-tecnico"><h3>Sopralluoghi per tecnico</h3><div class="chbox" style="height:260px"><canvas id="ch-tecnico"></canvas></div></div>
""", 'card tecnico')
sost("""      <div class="card"><h3>Produttività e qualità per tecnico</h3><div id="tbl-prod" style="overflow-x:auto"></div></div>
""", """      <div class="card" id="card-tbl-prod"><h3>Produttività e qualità per tecnico</h3><div id="tbl-prod" style="overflow-x:auto"></div></div>
""", 'card prod')

# 5. Zona Coordinatore: il registro delle questioni
sost("""        <div id="dash-fatture" style="display:none;margin-bottom:14px"></div>
        <div id="dash-critici" style="display:none;margin-bottom:14px"></div>
""", """        <div id="dash-fatture" style="display:none;margin-bottom:14px"></div>
        <div id="dash-critici" style="display:none;margin-bottom:14px"></div>
        <!-- le questioni in attesa di decisione (direzione.js, 25/09/2026) -->
        <div id="adm-decisioni" style="margin-bottom:14px"></div>
""", 'adm decisioni')

# 6. Zona Segreteria: l'obiettivo di visite dell'esercizio
sost("""        <!-- Promemoria ricontrolli (interruttore) -->
""", """        <!-- Obiettivo visite dell'esercizio, regola CEIV (direzione.js, 25/09/2026) -->
        <div id="sgr-obiettivi"></div>

        <!-- Promemoria ricontrolli (interruttore) -->
""", 'sgr obiettivi')

# 7. onLogin: chi e' in sola lettura vede Mappa e Statistiche; Direttore e Presidenza anche la loro pagina
sost("""  try{const _r=await sb.from('app_ruoli').select('ruolo,stato,nome').eq('email',user.email).maybeSingle();_roleRow=_r.data}catch(_e){}""",
     """  try{const _r=await sb.from('app_ruoli').select('ruolo,stato,nome,carica').eq('email',user.email).maybeSingle();_roleRow=_r.data}catch(_e){}""", 'select carica')
sost("""  if(S.viewer){
    S.tecnico=null
    S.viewerNome=_roleRow.nome||null
    $('lbl-user').textContent=(_roleRow.nome||user.email)+' — sola lettura'
    document.querySelector('nav')?.classList.add('hidden')
    document.body.classList.add('viewer-mode')
    await loadVoci().catch(()=>{})
    showScr('app')
    navTo('dashboard')
    S.appReady=true
    return
  }
  document.querySelector('nav')?.classList.remove('hidden')
  document.body.classList.remove('viewer-mode')
""", """  if(S.viewer){
    S.tecnico=null
    S.viewerNome=_roleRow.nome||null
    S.carica=_roleRow.carica||null
    // Direttore e Presidenza li dice il database, non la carica scritta a mano (25/09/2026)
    S.direttore=false;S.presidenza=false
    try{const[_d,_p]=await Promise.all([sb.rpc('is_direttore'),sb.rpc('is_presidenza')]);S.direttore=!!_d.data;S.presidenza=!!_p.data}catch(_e){}
    $('lbl-user').textContent=(_roleRow.nome||user.email)+' — sola lettura'
    // dal 25/09/2026 il menu resta: due schede (Mappa e Statistiche) piu' la pagina
    // Direzione per il Direttore e la Presidenza. Prima il menu spariva del tutto e
    // con lui le Statistiche, uscite dalla Dashboard il 23/09.
    const _nv=document.querySelector('nav')
    if(_nv){_nv.classList.remove('hidden')
      _nv.querySelectorAll('button').forEach(b=>{const v=b.dataset.view
        b.style.display=(v==='dashboard'||v==='statistiche'||(v==='direzione'&&(S.direttore||S.presidenza)))?'':'none'})
      const _bd=_nv.querySelector('button[data-view="dashboard"]');if(_bd)_bd.textContent='🗺️ Mappa'
      const _bdir=_nv.querySelector('button[data-view="direzione"]');if(_bdir&&S.presidenza&&!S.direttore)_bdir.firstChild.textContent='🏛️ Presidenza'
    }
    document.body.classList.add('viewer-mode')
    await loadVoci().catch(()=>{})
    showScr('app')
    navTo(S.direttore||S.presidenza?'direzione':'dashboard')
    S.appReady=true
    return
  }
  S.direttore=false;S.presidenza=false;S.carica=null
  document.querySelector('nav')?.classList.remove('hidden')
  document.body.classList.remove('viewer-mode')
  // se nella stessa scheda era entrato prima un account di sola lettura, il menu torna quello del tecnico
  document.querySelectorAll('nav button[data-view]').forEach(b=>{if(['dashboard','form','lista','cantieri','rubrica','scadenze','incarichi','statistiche'].includes(b.dataset.view))b.style.display=''})
  {const _bd=document.querySelector('nav button[data-view="dashboard"]');if(_bd)_bd.textContent='🏠 Dashboard'}
""", 'onLogin viewer')

# 8. navTo: la vista Direzione; l'obiettivo nella Zona Segreteria
sost("""  ;['dashboard','form','lista','cantieri','rubrica','scadenze','incarichi','statistiche','admin','segreteria','committenti'].forEach(v=>$(('view-'+v))?.classList.toggle('hidden',v!==view))""",
     """  ;['dashboard','form','lista','cantieri','rubrica','scadenze','incarichi','statistiche','direzione','admin','segreteria','committenti'].forEach(v=>$(('view-'+v))?.classList.toggle('hidden',v!==view))""", 'navTo lista')
sost("""  if(view==='statistiche')loadStat().catch(e=>{console.error('loadStat:',e);toast('Errore caricamento statistiche: '+e.message,'err')})
""", """  if(view==='statistiche')loadStat().catch(e=>{console.error('loadStat:',e);toast('Errore caricamento statistiche: '+e.message,'err')})
  if(view==='direzione'&&window.direzione)window.direzione.carica().catch(e=>{console.error('direzione:',e);toast('Errore caricamento Direzione: '+e.message,'err')})
""", 'navTo direzione')
sost("""  if(view==='segreteria'){sgrInit();admLoadCampagne&&admLoadCampagne().catch(e=>console.warn('admLoadCampagne:',e))}""",
     """  if(view==='segreteria'){sgrInit();admLoadCampagne&&admLoadCampagne().catch(e=>console.warn('admLoadCampagne:',e));if(window.direzione)window.direzione.obiettivi().catch(e=>console.warn('obiettivi:',e))}""", 'navTo segreteria')

# 9. loadAutorizzazioni: nella pagina Direzione, e a scrivania sgombra lo dice
sost("""async function loadAutorizzazioni(){
  const box=$('dash-autorizzazioni')
  if(!box)return
  try{
    const{data:dir}=await sb.rpc('is_direttore')
    if(!dir){box.style.display='none';return}
  }catch(_e){box.style.display='none';return}
""", """async function loadAutorizzazioni(){
  // dal 25/09/2026 il Direttore ha la sua pagina «Direzione»: il riquadro sta li',
  // e a scrivania sgombra dice «niente in attesa» invece di sparire
  const inDir=!!(S.direttore&&$('dir-autorizzazioni'))
  const box=inDir?$('dir-autorizzazioni'):$('dash-autorizzazioni')
  if(!box)return
  if(inDir&&$('dash-autorizzazioni'))$('dash-autorizzazioni').style.display='none'
  const vuoto=()=>{if(inDir){box.innerHTML='<div class="card" style="border-left:4px solid #95C22F"><h3>&#9997;&#65039; Autorizzazioni servizi CPT</h3><p style="font-size:13px;color:#555;margin:0">Niente in attesa del tuo visto.</p></div>';box.style.display=''}else box.style.display='none'}
  try{
    const{data:dir}=await sb.rpc('is_direttore')
    if(!dir){box.style.display='none';return}
  }catch(_e){box.style.display='none';return}
""", 'loadAutorizzazioni testa')
sost(""",aut_stato,autorizzata_da,data_autorizzazione,stato""", """,aut_stato,aut_richiesta_il,autorizzata_da,data_autorizzazione,stato""", 'select aut_richiesta_il', quante=5)
sost("""    if(!righe.length){box.style.display='none';return}
  }catch(_e){box.style.display='none';return}
""", """    if(!righe.length){vuoto();return}
  }catch(_e){box.style.display='none';return}
""", 'righe vuote')
sost("""  if(!attesa.length){box.style.display='none';return}
""", """  if(!attesa.length){vuoto();return}
""", 'attesa vuota')
sost("""    const daFare=['da_richiedere','richiesta'].includes(r.aut_stato)
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #f0e6dd">
      <strong style="font-size:12px">n&deg; ${n}</strong>${badge(r.aut_stato)}""",
     """    const daFare=['da_richiedere','richiesta'].includes(r.aut_stato)
    const gg=daFare&&r.aut_richiesta_il?Math.floor((Date.now()-new Date(String(r.aut_richiesta_il).slice(0,10)))/864e5):null
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #f0e6dd">
      <strong style="font-size:12px">n&deg; ${n}</strong>${badge(r.aut_stato)}${gg!=null?`<span style="font-size:11px;color:#888">in attesa da ${gg} g</span>`:''}""", 'giorni attesa')
sost("""${daFare?'Autorizza nell\\'app segreteria &#8599;':'apri la pratica &#8599;'}</a>""",
     """${daFare?'Autorizza nell\\'app segreteria &#8599;':'apri la pratica &#8599;'}</a>${daFare?'<span style="font-size:11px;color:#999">si apre gi&agrave; collegata</span>':''}""", 'link collegata')

# 10. la mappa della Dashboard parte dal tecnico collegato (chiesto dall'utente 25/09/2026)
sost("""  _dashMapTec=$('dash-map-tec')?.value||''
  _dashMapCom=$('dash-map-com')?.value||''
  renderDashMapMarkers()
""", """  _dashMapTec=$('dash-map-tec')?.value||''
  _dashMapCom=$('dash-map-com')?.value||''
  // la prima volta la mappa si apre sui cantieri del tecnico collegato (25/09/2026,
  // chiesto dall'utente); «Tutti» resta a un tocco. La segreteria vede tutto.
  if(!window._dashMapTecInit){window._dashMapTecInit=true
    if(S.tecnico&&!window.__isCoord&&!_dashMapTec){
      const _mio=((S.tecnico.tecnico_nome||'')+' '+(S.tecnico.tecnico_cognome||'')).trim()
      if(_mio&&rows.some(d=>d.tecnico===_mio))_dashMapTec=_mio}}
  renderDashMapMarkers()
""", 'mappa tecnico')

# 11. KPI visite minime CEIV nelle Statistiche
sost("""  $('k-comuni').textContent=com
  if($('k-cant'))$('k-cant').textContent=cant
}
""", """  $('k-comuni').textContent=com
  if($('k-cant'))$('k-cant').textContent=cant
  // visite fatte / minime dell'esercizio (regola CEIV): conta TUTTE le visite dell'esercizio
  // scelto, di tutti i tecnici, qualunque filtro sia impostato (25/09/2026)
  if(window.direzione&&window.direzione.kpiCeiv){const fE=$('fd-eserc')?$('fd-eserc').value:'';window.direzione.kpiCeiv(fE,fE?_dashRaw.filter(x=>x.eserc===fE).length:null)}
}
""", 'kpi ceiv js')

# 12. esportazioni per direzione.js
sost("""window.sb=sb; window.S=S; window.toast=toast
""", """window.sb=sb; window.S=S; window.toast=toast
window.loadAutorizzazioni=loadAutorizzazioni; window.annoEdile=annoEdile   // direzione.js (25/09/2026)
""", 'window exports')

# 13. lo script
sost("""<script src="appunti-cantiere.js?v=3"></script>
""", """<script src="appunti-cantiere.js?v=3"></script>
<!-- Direzione e Consiglio: pagina del Direttore, registro delle questioni, obiettivo CEIV (25/09/2026) -->
<script src="direzione.js?v=1"></script>
""", 'script tag')

assert src.rstrip().endswith('</html>'), 'index.html non finisce con </html>'
scrivi(P, src)
print('index.html: %d -> %d byte' % (n0, len(src)))

# ─────────────────────────────────────────────────── cantieri-critici-coord.js
P2 = 'cantieri-critici-coord.js'
s2 = leggi(P2)
NL2 = CRLF if CRLF in s2 else LF
def sost2(v, n, nome):
    global s2
    v = v.replace(LF, NL2); n = n.replace(LF, NL2)
    assert s2.count(v) == 1, '%s: %d occorrenze' % (nome, s2.count(v))
    s2 = s2.replace(v, n)
sost2("""    const f = vis('dash-fatture'), c = vis('dash-critici');
    return { fatture: f ? f.querySelectorAll('button[onclick*="approvata"]').length : 0, critici: c ? c.querySelectorAll('[data-cc]').length : 0 };""",
      """    const f = vis('dash-fatture'), c = vis('dash-critici'), d = $('adm-decisioni');
    return { fatture: f ? f.querySelectorAll('button[onclick*="approvata"]').length : 0, critici: c ? c.querySelectorAll('[data-cc]').length : 0,
      decise: d ? d.querySelectorAll('[data-dec-decisa]').length : 0 };   /* decisioni da prendere in carico (direzione.js, 25/09/2026) */""", 'conta')
sost2("""    const { fatture, critici } = conta();
    const tot = fatture + critici;""", """    const { fatture, critici, decise } = conta();
    const tot = fatture + critici + decise;""", 'avvisa tot')
sost2("""    if (critici) pezzi.push(`<strong>${critici}</strong> ${critici === 1 ? 'cantiere critico' : 'cantieri critici'}`);""",
      """    if (critici) pezzi.push(`<strong>${critici}</strong> ${critici === 1 ? 'cantiere critico' : 'cantieri critici'}`);
    if (decise) pezzi.push(`<strong>${decise}</strong> ${decise === 1 ? 'decisione da prendere in carico' : 'decisioni da prendere in carico'}`);""", 'avvisa pezzi')
sost2("""      typeof window.loadFattureCoord === 'function' ? window.loadFattureCoord() : Promise.resolve(),
      carica(),
    ]);""", """      typeof window.loadFattureCoord === 'function' ? window.loadFattureCoord() : Promise.resolve(),
      carica(),
      window.direzione && typeof window.direzione.zonaCoord === 'function' ? window.direzione.zonaCoord() : Promise.resolve(),
    ]);""", 'aggiorna')
scrivi(P2, s2)
print('cantieri-critici-coord.js aggiornato')

# ─────────────────────────────────────────────────────────────── aiuto.js
P3 = 'aiuto.js'
s3 = leggi(P3)
NL3 = CRLF if CRLF in s3 else LF
v = """  'v:statistiche': 'Contatori, grafici e tabelle delle visite (per esercizio, tecnico, IPC, comuni, imprese ricorrenti). Si calcolano quando apri la scheda.',""".replace(LF, NL3)
assert s3.count(v) == 1, 'aiuto v:statistiche'
s3 = s3.replace(v, v + NL3 + """  'v:direzione': 'La pagina della Direzione: autorizzazioni dei servizi CPT in attesa del visto, conferme richieste sui cantieri critici e le questioni aperte da coordinatore e segreteria, con i giorni di attesa. Si risponde da qui.',
  'nav-direzione': 'La pagina della Direzione: autorizzazioni dei servizi CPT in attesa del visto, conferme richieste sui cantieri critici e le questioni aperte da coordinatore e segreteria, con i giorni di attesa. Si risponde da qui.',
  'card-k-ceivmin': 'Visite fatte nell\\'esercizio scelto (tutti i tecnici) contro il minimo della regola CEIV: 100 visite ogni 50.000 euro di contributi Cassa Edile. Il minimo lo imposta la segreteria nella sua Zona.',""".replace(LF, NL3))
scrivi(P3, s3)
print('aiuto.js aggiornato')

# ───────────────────────────────────────────── .github/workflows/deploy-pages.yml
P4 = '.github/workflows/deploy-pages.yml'
s4 = leggi(P4)
NL4 = CRLF if CRLF in s4 else LF
a = "      - 'appunti-cantiere.js'".replace(LF, NL4)
assert s4.count(a) == 1
s4 = s4.replace(a, a + NL4 + "      - 'direzione.js'")
b = "appunti-cantiere.js sw.js manifest.webmanifest"
assert s4.count(b) == 1
s4 = s4.replace(b, "appunti-cantiere.js direzione.js sw.js manifest.webmanifest")
scrivi(P4, s4)
print('deploy-pages.yml aggiornato')
