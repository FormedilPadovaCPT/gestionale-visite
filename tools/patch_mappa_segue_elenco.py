# -*- coding: utf-8 -*-
"""23/09/2026 - La mappa dei cantieri attivi segue i filtri dell'elenco.

Chiesto dall'utente: c'erano due selettori (uno sopra la mappa, uno sopra
l'elenco) e quello dell'elenco e' il piu' completo, perche' ha anche la
ricerca testuale e «Includi chiusi». Ora ce n'e' uno solo: la mappa disegna
esattamente le righe che l'elenco ha filtrato. Niente seconda lettura dal
database per la mappa. Sotto la mappa compare la legenda dei colori.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == 1, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)

# 1. HTML: al posto della barra filtri della mappa, un rimando; sotto la mappa la legenda.
sost("""        <div id="cant-map-filters" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"></div>""",
     """        <div id="cant-map-filters" style="font-size:12px;color:#666;margin-bottom:10px">🔎 La mappa mostra gli stessi cantieri dell'<b>elenco qui sotto</b>: ricerca, comuni, «La mia zona», filtri e «Includi chiusi» valgono per tutte e due.</div>""",
     'html filtri')
sost("""          Cerchio pieno = posizione precisa &middot; bordo tratteggiato = posizione approssimata (centro comune) &middot; colore = scadenza lavori &middot; <span style="color:#d5008f;font-weight:600">fuxia</span> = cantiere segnalato da tecnico (non codificato CNCE). I cantieri chiusi non compaiono.""",
     """          <div id="cant-map-legenda" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:4px;color:#555"><b>Colore = fine lavori prevista:</b>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#c0392b;vertical-align:middle"></span> già passata</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e7500f;vertical-align:middle"></span> entro 30 giorni</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e6a417;vertical-align:middle"></span> entro 90 giorni</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27ae60;vertical-align:middle"></span> oltre 90 giorni</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#9aa0a6;vertical-align:middle"></span> data non indicata</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#d5008f;vertical-align:middle"></span> segnalato da un tecnico</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4b5563;vertical-align:middle"></span> chiuso (solo con «Includi chiusi»)</span></div>
          Cerchio pieno = posizione precisa &middot; bordo tratteggiato = posizione approssimata (centro del comune) &middot; i cantieri senza coordinate sono solo nell'elenco.""",
     'html legenda')

# 2. navTo: la mappa non carica piu' per conto suo, la disegna l'elenco.
sost("""  if(view==='cantieri'&&typeof loadCantMap==='function')loadCantMap().catch(e=>console.error('loadCantMap:',e))
""", "", 'navTo')

# 3. loadCantieri: i campi del popup e le segnalazioni complete, poi i dati per la mappa.
sost("""  const _selC='cantiere_id,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_etichetta,prot_int,nodo_id,cantiere_cnce,elimina,lat,lng,geocode_status,cantiere_tip_ope,cantiere_importo,data_ult,cantiere_committente_id,cantiere_chiuso'""",
     """  const _selC='cantiere_id,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_etichetta,prot_int,nodo_id,cantiere_cnce,elimina,lat,lng,geocode_status,cantiere_tip_ope,cantiere_tip_ope_altro,cantiere_descrizione,cantiere_importo,data_ult,cantiere_committente_id,cantiere_chiuso'""",
     'selC')
sost("""    const{data:sg}=await sb.from('segnalazioni_cantiere').select('id,lat,lng,note,tecnico_nome,segnalata_da,created_at').eq('stato','aperta').order('created_at',{ascending:false}).limit(300)
    ;(sg||[]).forEach(s=>{
      if(s.lat==null||s.lng==null)return
      const lbl=(s.note&&s.note.trim())||'Cantiere segnalato'
      rows.push({_segn:true,seg_id:s.id,cantiere_id:'segn:'+s.id,label:lbl,lat:s.lat,lng:s.lng,
        seg_tec:s.tecnico_nome||s.segnalata_da||'',seg_data:s.created_at,n_visite:0})
    })
  }catch(_e){}
  _clRows=rows
""", """    const{data:sg}=await sb.from('segnalazioni_cantiere').select('*').eq('stato','aperta').order('created_at',{ascending:false}).limit(300)
    _cmSegn=sg||[]
    ;(sg||[]).forEach(s=>{
      if(s.lat==null||s.lng==null)return
      const lbl=(s.note&&s.note.trim())||'Cantiere segnalato'
      rows.push({_segn:true,_s:s,seg_id:s.id,cantiere_id:'segn:'+s.id,label:lbl,lat:s.lat,lng:s.lng,
        seg_tec:s.tecnico_nome||s.segnalata_da||'',seg_data:s.created_at,n_visite:0})
    })
  }catch(_e){console.warn('segnalazioni:',_e)}
  // posizione di disegno sulla mappa: i cantieri al centro del comune si aprono a raggiera
  // (campi a parte: lat/lng restano quelli veri, li usa il giro sul navigatore)
  const _grp={}
  rows.forEach(d=>{d._mlat=d.lat;d._mlng=d.lng;if(!d._segn&&d.lat!=null&&d.geocode_status==='comune'){const k=(+d.lat).toFixed(4)+','+(+d.lng).toFixed(4);(_grp[k]=_grp[k]||[]).push(d)}})
  Object.values(_grp).forEach(list=>{
    if(list.length<2)return
    const R=0.0016
    list.forEach((d,i)=>{const a=2*Math.PI*i/list.length;d._mlat=+d.lat+R*Math.cos(a);d._mlng=+d.lng+R*Math.sin(a)/Math.cos(d.lat*Math.PI/180)})
  })
  _cmRows=rows.filter(r=>!r._segn&&r.lat!=null&&r.lng!=null)  // per «Aggancia a cantiere» delle segnalazioni
  _clRows=rows
""", 'segnalazioni elenco')

# 4. _clRender ridisegna anche la mappa
sost("""  const all=(_clRows||[]).filter(_clPass)
  const _shown=window._cantShowAll?all.length:Math.min(300,all.length)
""", """  const all=(_clRows||[]).filter(_clPass)
  try{_cmRender(true)}catch(e){console.error('mappa:',e)}  // la mappa segue l'elenco (23/09/2026)
  const _shown=window._cantShowAll?all.length:Math.min(300,all.length)
""", 'clRender')

# 5. Il vecchio blocco della mappa (lettura propria + filtri propri) sostituito
ini = src.index('async function loadCantMap(){')
fine_marca = '// ── SEGNALAZIONI CANTIERE DA MOBILE'
fine = src.index(fine_marca)
fine = src.rindex('// ══', ini, fine)   # la riga di cornice sopra il titolo
vecchio_blocco = src[ini:fine]
assert 'function _cmBuildFilters' in vecchio_blocco and 'function _cmRender' in vecchio_blocco and 'function _cmEsc' in vecchio_blocco
nuovo_blocco = """/* Dal 23/09/2026 la mappa non ha filtri suoi ne' una lettura sua: disegna le righe che l'elenco
   qui sotto ha gia' filtrato (_clRows + _clPass), cosi' ricerca testuale, comuni, «La mia zona»,
   scadenze, origine, visite e «Includi chiusi» valgono per tutte e due. loadCantMap resta per chi
   la chiamava dopo una modifica: ricarica l'elenco, che ridisegna la mappa. */
async function loadCantMap(){return loadCantieri()}

function _cmEnsure(){
  if(typeof L==='undefined'){console.warn('Leaflet non caricato');return false}
  if(!$('cant-map'))return false
  if(!_cmMap){
    // canvas: con «Tutti i comuni» i pallini sono piu' di 5.000
    _cmMap=L.map('cant-map',{scrollWheelZoom:false,preferCanvas:true}).setView([45.35,11.85],10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(_cmMap)
    _cmMap.on('click',()=>_cmMap.scrollWheelZoom.enable())
    _cmLayer=L.layerGroup().addTo(_cmMap)
    setTimeout(()=>_cmMap.invalidateSize(),250)
  }
  return true
}

function _cmEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function _cmPopupSegn(s){
  const dt=s.created_at?new Date(s.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'–'
  const _fid=s.drive_file_id
  const _img=_fid?('https://drive.google.com/thumbnail?id='+_cmEsc(_fid)+'&sz=w600'):(s.thumb_url||'')
  let ph=''
  if(_img){
    const _fb=(s.thumb_url&&s.thumb_url!==_img)?_cmEsc(s.thumb_url):''
    ph='<a href="'+_cmEsc(s.drive_url||_img)+'" target="_blank"><img src="'+_cmEsc(_img)+'" referrerpolicy="no-referrer"'+(_fb?' onerror="this.onerror=null;this.src=\\''+_fb+'\\'"':'')+' style="max-width:200px;max-height:150px;border-radius:6px;display:block;margin:4px 0"></a>'
  }else if(s.drive_url)ph='<a href="'+_cmEsc(s.drive_url)+'" target="_blank">📷 Apri foto su Drive</a><br>'
  const _nav='<a href="https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng+'&travelmode=driving" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin:6px 0 2px;padding:7px 12px;background:var(--orange,#e7500f);color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600">🧭 Naviga fin qui</a><br>'
  let btns=''
  if(window.__isCoord){
    btns='<br><button onclick="segnApriAggancio(\\''+s.id+'\\')" style="background:#d5008f;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px">🔗 Aggancia a cantiere</button> '+
         '<button onclick="segnScarta(\\''+s.id+'\\')" style="background:#9aa0a6;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px">✖ Scarta</button>'
  }
  return '<b style="color:#d5008f">📍 Cantiere segnalato</b><br>'+
    '<b>Quando:</b> '+dt+'<br>'+
    '<b>Da:</b> '+_cmEsc(s.tecnico_nome||s.segnalata_da||'')+
    (s.note?'<br><i style="color:#555">'+_cmEsc(s.note)+'</i>':'')+'<br>'+ph+_nav+
    (s.accuracy_m?'<span style="color:#999;font-size:11px">precisione GPS ±'+Math.round(s.accuracy_m)+' m</span>':'')+btns
}

function _cmRender(fit){
  if(!_cmEnsure())return
  _cmLayer.clearLayers()
  const bounds=[]
  let n=0,nSeg=0,nSenza=0
  ;(_clRows||[]).filter(_clPass).forEach(d=>{
    if(d._segn){
      const s=d._s||d
      const m=L.circleMarker([s.lat,s.lng],{radius:8,color:'#fff',weight:2,fillColor:'#d5008f',fillOpacity:0.95})
      m.bindPopup(_cmPopupSegn(s))
      m.addTo(_cmLayer);bounds.push([s.lat,s.lng]);nSeg++
      return
    }
    if(d.lat==null||d.lng==null){nSenza++;return}
    const sk=_cmScad(d.data_ult)
    const approx=d.geocode_status==='comune'
    const chiuso=d.cantiere_chiuso===true
    const col=chiuso?'#4b5563':_cmColor(sk)
    const la=d._mlat!=null?d._mlat:d.lat,ln=d._mlng!=null?d._mlng:d.lng
    const m=L.circleMarker([la,ln],{radius:7,color:approx?'#666':'#fff',weight:2,dashArray:approx?'3 2':null,fillColor:col,fillOpacity:0.9})
    const label=d.cantiere_etichetta||`${d.cantiere_indirizzo||''} ${d.cantiere_civico||''}`.trim()||'(senza indirizzo)'
    const ope=d.cantiere_tip_ope!=null?(TIP_OPE_LABELS[d.cantiere_tip_ope]||('Op. '+d.cantiere_tip_ope))+(d.cantiere_tip_ope_altro?' – '+d.cantiere_tip_ope_altro:''):'–'
    const imp=d.cantiere_importo!=null?(IMP_LBL[d.cantiere_importo]||('Fascia '+d.cantiere_importo)):'–'
    const dult=d.data_ult?new Date(d.data_ult).toLocaleDateString('it-IT'):'–'
    m.bindPopup(
      '<b>'+_cmEsc(label)+'</b>'+(chiuso?' 🔒 <span style="color:#4b5563">chiuso</span>':'')+'<br>'+_cmEsc(d.comune_nome||'')+'<br>'+(d.cantiere_descrizione?'<i style="color:#555">'+_cmEsc(d.cantiere_descrizione)+'</i><br>':'')+'<br>'+
      '<b>Tipo opera:</b> '+_cmEsc(ope)+'<br>'+
      '<b>Importo:</b> '+_cmEsc(imp)+'<br>'+
      '<b>Visite effettuate:</b> '+(d.n_visite||0)+'<br>'+
      '<b>Fine lavori:</b> '+dult+
      (approx?'<br><i style="color:#999">posizione approssimata (comune)</i>':'')+
      '<br><br><button onclick="showCantiereDetail(\\''+_cmEsc(d.cantiere_id)+'\\')" style="background:var(--orange,#e7500f);color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px">Apri scheda</button>'+
      (d.cantiere_id?'<br>'+_geoFixBtn(d.cantiere_id,'cant'):'')
    )
    m.addTo(_cmLayer)
    bounds.push([la,ln])
    n++
  })
  const cnt=$('cant-map-count')
  if(cnt)cnt.textContent=n+' cantier'+(n===1?'e':'i')+(nSeg?' + '+nSeg+' segnalat'+(nSeg===1?'o':'i'):'')+' in mappa'+(nSenza?' · '+nSenza+' senza posizione (solo in elenco)':'')
  if(fit&&bounds.length)_cmMap.fitBounds(bounds,{padding:[30,30],maxZoom:13})
}

"""
src = src[:ini] + nuovo_blocco.replace(LF, NL) + src[fine:]

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
