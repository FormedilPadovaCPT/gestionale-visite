# -*- coding: utf-8 -*-
"""Patch: segnalazioni cantiere da mobile (GPS + foto + note) — 2026-07-10
Applica le modifiche a index.html partendo dal backup integro.
Uso: python tools/patch_segnalazioni.py
"""
import io, os, shutil, sys, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_segnalazioni_{ts}.html.bak')

shutil.copy2(SRC, BAK)
print('Backup:', BAK)

with io.open(BAK, 'r', encoding='utf-8') as f:
    html = f.read()

def rep(old, new, label):
    global html
    n = html.count(old)
    assert n == 1, f'{label}: attese 1 occorrenza, trovate {n}'
    html = html.replace(old, new)
    print('OK:', label)

# ── 1. Pulsante "Segnala cantiere" nell'header della mappa ──
rep(
    '          <span id="cant-map-count" style="font-size:12px;color:#888"></span>',
    '          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="cant-map-count" style="font-size:12px;color:#888"></span><button class="btn-primary btn-sm" id="btn-segnala-cant">&#128205; Segnala cantiere</button></div>',
    'pulsante segnala')

# ── 2. Legenda mappa ──
rep(
    'Cerchio pieno = posizione precisa &middot; bordo tratteggiato = posizione approssimata (centro comune) &middot; colore = scadenza lavori. I cantieri chiusi non compaiono.',
    'Cerchio pieno = posizione precisa &middot; bordo tratteggiato = posizione approssimata (centro comune) &middot; colore = scadenza lavori &middot; <span style="color:#d5008f;font-weight:600">fuxia</span> = cantiere segnalato da tecnico (non codificato CNCE). I cantieri chiusi non compaiono.',
    'legenda')

# ── 3. Modali HTML (prima di modal-cant) ──
MODALI = '''<!-- ── MODAL SEGNALA CANTIERE (mobile GPS) ── -->
<div class="modal-overlay hidden" id="modal-segn">
  <div class="modal-box" style="max-width:480px">
    <h3>&#128205; Segnala cantiere</h3>
    <div id="segn-gps" style="font-size:13px;padding:8px 10px;border-radius:8px;background:#f4f6f8;margin-bottom:10px">&#8987; Rilevamento posizione GPS&#8230;</div>
    <div class="field"><label>Foto (facoltativa)</label>
      <input type="file" id="segn-foto" accept="image/*" capture="environment">
      <img id="segn-foto-prev" style="display:none;max-width:100%;max-height:180px;border-radius:8px;margin-top:6px">
    </div>
    <div class="field"><label>Note (facoltative)</label><textarea id="segn-note" rows="3" maxlength="500" placeholder="Es. gru montata, ponteggio su facciata, nessun cartello&#8230;"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn-secondary btn-sm" id="segn-annulla">Annulla</button>
      <button class="btn-primary btn-sm" id="segn-salva">Salva segnalazione</button>
    </div>
  </div>
</div>
<!-- ── MODAL AGGANCIO SEGNALAZIONE → CANTIERE CNCE ── -->
<div class="modal-overlay hidden" id="modal-segn-agg">
  <div class="modal-box" style="max-width:560px">
    <h3>&#128279; Aggancia segnalazione a cantiere</h3>
    <div id="segn-agg-info" style="font-size:12px;color:#666;margin-bottom:8px"></div>
    <div class="search-bar" style="margin-bottom:8px">
      <input type="text" id="segn-agg-q" placeholder="Indirizzo, comune, etichetta, CNCE&#8230;" style="flex:1">
      <button class="btn-primary btn-sm" id="segn-agg-cerca">Cerca</button>
    </div>
    <div id="segn-agg-res" style="max-height:300px;overflow:auto;font-size:13px"></div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn-secondary btn-sm" id="segn-agg-chiudi">Chiudi</button></div>
  </div>
</div>
<div class="modal-overlay hidden" id="modal-cant">'''
rep('<div class="modal-overlay hidden" id="modal-cant">', MODALI, 'modali html')

# ── 4. Variabile _cmSegn ──
rep("let _cmMap=null,_cmLayer=null,_cmRows=null",
    "let _cmMap=null,_cmLayer=null,_cmRows=null,_cmSegn=null",
    'var _cmSegn')

# ── 5. loadCantMap: carica anche le segnalazioni aperte ──
rep("""  _cmRows=rows

  if(!_cmMap){""",
    """  _cmRows=rows

  // segnalazioni cantiere aperte (pin fuxia)
  try{
    const{data:sg}=await sb.from('segnalazioni_cantiere').select('*').eq('stato','aperta').order('created_at',{ascending:false}).limit(500)
    _cmSegn=sg||[]
  }catch(_e){_cmSegn=[]}

  if(!_cmMap){""",
    'fetch segnalazioni')

# ── 6. Filtro origine ──
rep("""  mkSel('cm-f-scad','<option value="">\U0001f5d3️ Tutte le scadenze</option>'+_CM_SCAD.map(s=>`<option value="${s.k}">${s.label}</option>`).join(''))""",
    """  mkSel('cm-f-scad','<option value="">\U0001f5d3️ Tutte le scadenze</option>'+_CM_SCAD.map(s=>`<option value="${s.k}">${s.label}</option>`).join(''))
  mkSel('cm-f-orig','<option value="">\U0001f3f7️ Origine: tutti</option><option value="cnce">Cantieri CNCE/CEIV</option><option value="segn">Segnalati da tecnici</option>')""",
    'filtro origine')

# ── 7. _cmRender: legge filtro origine + contatore segnalazioni ──
rep("""  const fSca=$('cm-f-scad')?.value||''
  const bounds=[]
  let n=0""",
    """  const fSca=$('cm-f-scad')?.value||''
  const fOrig=$('cm-f-orig')?.value||''
  const bounds=[]
  let n=0,nSeg=0""",
    'filtri render')

# ── 8. _cmRender: salta i cantieri se filtro "solo segnalati" ──
rep("""  _cmRows.forEach(d=>{
    if(fCom&&d.comune_nome!==fCom)return""",
    """  _cmRows.forEach(d=>{
    if(fOrig==='segn')return
    if(fCom&&d.comune_nome!==fCom)return""",
    'skip cantieri')

# ── 9. _cmRender: marker fuxia segnalazioni + contatore ──
rep("""  const cnt=$('cant-map-count');if(cnt)cnt.textContent=n+' cantier'+(n===1?'e':'i')+' in mappa'""",
    """  // ── segnalazioni da tecnici (pin fuxia) ──
  if(fOrig!=='cnce'&&!fCom&&!fOpe&&!fImp&&!fSca&&Array.isArray(_cmSegn)){
    _cmSegn.forEach(s=>{
      if(s.lat==null||s.lng==null)return
      const m=L.circleMarker([s.lat,s.lng],{radius:8,color:'#fff',weight:2,fillColor:'#d5008f',fillOpacity:0.95})
      const dt=s.created_at?new Date(s.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'–'
      let ph=''
      if(s.thumb_url)ph='<a href="'+_cmEsc(s.drive_url||s.thumb_url)+'" target="_blank"><img src="'+_cmEsc(s.thumb_url)+'" referrerpolicy="no-referrer" style="max-width:180px;max-height:120px;border-radius:6px;display:block;margin:4px 0"></a>'
      else if(s.drive_url)ph='<a href="'+_cmEsc(s.drive_url)+'" target="_blank">\U0001f4f7 Apri foto su Drive</a><br>'
      let btns=''
      if(window.__isCoord){
        btns='<br><button onclick="segnApriAggancio(\\''+s.id+'\\')" style="background:#d5008f;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px">\U0001f517 Aggancia a cantiere</button> '+
             '<button onclick="segnScarta(\\''+s.id+'\\')" style="background:#9aa0a6;color:#fff;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px">✖ Scarta</button>'
      }
      m.bindPopup('<b style="color:#d5008f">\U0001f4cd Cantiere segnalato</b><br>'+
        '<b>Quando:</b> '+dt+'<br>'+
        '<b>Da:</b> '+_cmEsc(s.tecnico_nome||s.segnalata_da||'')+
        (s.note?'<br><i style="color:#555">'+_cmEsc(s.note)+'</i>':'')+'<br>'+ph+
        (s.accuracy_m?'<span style="color:#999;font-size:11px">precisione GPS ±'+Math.round(s.accuracy_m)+' m</span>':'')+btns)
      m.addTo(_cmLayer);bounds.push([s.lat,s.lng]);nSeg++
    })
  }
  const cnt=$('cant-map-count');if(cnt)cnt.textContent=n+' cantier'+(n===1?'e':'i')+(nSeg?' + '+nSeg+' segnalat'+(nSeg===1?'o':'i'):'')+' in mappa'""",
    'marker segnalazioni')

# ── 10. Blocco JS: modale segnalazione + aggancio (dopo _cmRender) ──
ANCHOR_END = """  if(fit&&bounds.length)_cmMap.fitBounds(bounds,{padding:[30,30],maxZoom:13})
}

// ── EMAIL VERBALE DA ELENCO ──"""
BLOCCO = """  if(fit&&bounds.length)_cmMap.fitBounds(bounds,{padding:[30,30],maxZoom:13})
}

// ══════════════════════════════════════════════════════════════
// ── SEGNALAZIONI CANTIERE DA MOBILE (GPS + foto + note) ──
// ══════════════════════════════════════════════════════════════
let _segnPos=null,_segnFotoFile=null,_segnAggId=null

function apriSegnalaCantiere(){
  _segnPos=null;_segnFotoFile=null
  $('segn-note').value='';$('segn-foto').value=''
  const pv=$('segn-foto-prev');pv.style.display='none';pv.src=''
  const g=$('segn-gps');g.style.color='';g.textContent='⌛ Rilevamento posizione GPS…'
  show('modal-segn')
  if(!navigator.geolocation){g.textContent='⚠ GPS non disponibile su questo dispositivo';g.style.color='#c0392b';return}
  navigator.geolocation.getCurrentPosition(p=>{
    _segnPos={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}
    g.innerHTML='✅ Posizione rilevata: '+p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6)+' <span style="color:#888">(±'+Math.round(p.coords.accuracy)+' m)</span>'
  },err=>{
    g.textContent='⚠ Posizione non disponibile: '+err.message+'. Attiva il GPS e riapri.'
    g.style.color='#c0392b'
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0})
}
$('btn-segnala-cant').onclick=apriSegnalaCantiere
$('segn-annulla').onclick=()=>hide('modal-segn')
$('segn-foto').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0]
  _segnFotoFile=f||null
  const pv=$('segn-foto-prev')
  if(f){pv.src=URL.createObjectURL(f);pv.style.display='block'}else{pv.style.display='none'}
})

// ridimensiona e comprime la foto (max 1600px, JPEG 0.82) → base64 senza prefisso
function _segnComprimiFoto(file){
  return new Promise((res,rej)=>{
    const img=new Image()
    img.onload=()=>{
      const MAX=1600
      let w=img.width,h=img.height
      if(w>MAX||h>MAX){const r=Math.min(MAX/w,MAX/h);w=Math.round(w*r);h=Math.round(h*r)}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h
      cv.getContext('2d').drawImage(img,0,0,w,h)
      const dataUrl=cv.toDataURL('image/jpeg',0.82)
      URL.revokeObjectURL(img.src)
      res(dataUrl.split(',')[1])
    }
    img.onerror=rej
    img.src=URL.createObjectURL(file)
  })
}

async function salvaSegnalazione(){
  if(!_segnPos){toast('Posizione GPS non ancora rilevata','warn');return}
  const btn=$('segn-salva');btn.disabled=true;btn.textContent='⏳ Salvataggio…'
  try{
    const tecNome=S.tecnico?`${S.tecnico.tecnico_nome||''} ${S.tecnico.tecnico_cognome||''}`.trim():null
    const{data:row,error}=await sb.from('segnalazioni_cantiere').insert({
      lat:_segnPos.lat,lng:_segnPos.lng,accuracy_m:Math.round(_segnPos.acc||0),
      note:$('segn-note').value.trim()||null,
      tecnico_nome:tecNome
    }).select('id,created_at').single()
    if(error)throw error
    // foto → Drive (cartella "Foto Segnalazioni CPT")
    if(_segnFotoFile){
      toast('Carico foto su Drive…')
      const b64=await _segnComprimiFoto(_segnFotoFile)
      const{data:{session}}=await sb.auth.getSession()
      const token=session?.access_token
      if(!token)throw new Error('Sessione scaduta, effettua il login')
      const d=new Date(row.created_at)
      const nome='segnalazione_'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'_'+row.id.slice(0,8)+'.jpg'
      const res=await fetch(`${SB_URL}/functions/v1/upload-foto`,{
        method:'POST',
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json','apikey':SB_KEY},
        body:JSON.stringify({contesto:'segnalazione',nome_file:nome,mime_type:'image/jpeg',image_base64:b64})
      })
      const up=await res.json()
      if(res.ok&&up.drive_file_id){
        await sb.from('segnalazioni_cantiere').update({
          drive_file_id:up.drive_file_id,drive_url:up.drive_url||null,thumb_url:up.thumb_url||null,
          nome_file:nome,dimensione_kb:Math.round(b64.length*3/4/1024)
        }).eq('id',row.id)
      }else{
        toast('Segnalazione salvata ma foto non caricata: '+(up.error||'errore Drive'),'warn',6000)
      }
    }
    hide('modal-segn')
    toast('Segnalazione salvata ✓','ok')
    loadCantMap().catch(()=>{})
  }catch(e){
    console.error('salvaSegnalazione:',e)
    toast('Errore salvataggio segnalazione: '+(e.message||e),'err')
  }finally{
    btn.disabled=false;btn.textContent='Salva segnalazione'
  }
}
$('segn-salva').onclick=salvaSegnalazione

// ── aggancio / scarto (solo coordinatore) ──
function _segnDist(la1,lo1,la2,lo2){const R=6371,toR=x=>x*Math.PI/180;const dLa=toR(la2-la1),dLo=toR(lo2-lo1);const h=Math.sin(dLa/2)**2+Math.cos(toR(la1))*Math.cos(toR(la2))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h))}

async function segnApriAggancio(id){
  if(!window.__isCoord){toast('Azione riservata al coordinatore','err');return}
  _segnAggId=id
  const s=(_cmSegn||[]).find(x=>x.id===id)
  $('segn-agg-info').textContent=s?('Segnalazione del '+new Date(s.created_at).toLocaleString('it-IT')+' — '+(s.tecnico_nome||s.segnalata_da||'')+(s.note?' — '+s.note:'')):''
  $('segn-agg-q').value='';$('segn-agg-res').innerHTML=''
  show('modal-segn-agg')
  segnAggCerca()   // default: i 10 cantieri attivi più vicini al pin
}

async function segnAggCerca(){
  const q=$('segn-agg-q').value.trim()
  const box=$('segn-agg-res')
  box.innerHTML='<div style="color:#aaa;padding:8px">Ricerca…</div>'
  const s=(_cmSegn||[]).find(x=>x.id===_segnAggId)
  let rows=[]
  if(!q){
    rows=(_cmRows||[]).filter(r=>r.lat!=null).map(r=>({...r,_d:s?_segnDist(s.lat,s.lng,r.lat,r.lng):null})).sort((a,b)=>(a._d??9e9)-(b._d??9e9)).slice(0,10)
  }else{
    const{data}=await sb.from('cantieri').select('cantiere_id,cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_cnce,lat,lng').eq('elimina',0).or(`cantiere_etichetta.ilike.%${q}%,cantiere_indirizzo.ilike.%${q}%,comune_nome.ilike.%${q}%,cantiere_cnce.ilike.%${q}%`).limit(20)
    rows=(data||[]).map(r=>({...r,_d:(s&&r.lat!=null)?_segnDist(s.lat,s.lng,r.lat,r.lng):null}))
  }
  if(!rows.length){box.innerHTML='<div style="color:#aaa;padding:8px">Nessun cantiere trovato</div>';return}
  box.innerHTML=(q?'':'<div style="font-size:11px;color:#888;padding:4px 0 6px">I 10 cantieri attivi più vicini al punto segnalato:</div>')+rows.map(r=>{
    const lbl=r.cantiere_etichetta||`${r.cantiere_indirizzo||''} ${r.cantiere_civico||''}`.trim()||'(senza indirizzo)'
    const dist=r._d!=null?(r._d<1?Math.round(r._d*1000)+' m':r._d.toFixed(1)+' km'):''
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid #eee">'+
      '<div style="flex:1"><b>'+esc(lbl)+'</b> — '+esc(r.comune_nome||'')+(r.cantiere_cnce?'<br><span style="font-size:11px;color:#888">CNCE: '+esc(r.cantiere_cnce)+'</span>':'')+'</div>'+
      (dist?'<span style="font-size:11px;color:#d5008f;white-space:nowrap">'+dist+'</span>':'')+
      '<button class="btn-primary btn-sm" onclick="segnAggancia(\\''+esc(r.cantiere_id)+'\\')">Aggancia</button>'+
      '</div>'
  }).join('')
}
$('segn-agg-cerca').onclick=segnAggCerca
$('segn-agg-q').onkeydown=e=>{if(e.key==='Enter')segnAggCerca()}
$('segn-agg-chiudi').onclick=()=>hide('modal-segn-agg')

async function segnAggancia(cantId){
  if(!_segnAggId)return
  if(!confirm('Agganciare la segnalazione a questo cantiere?\\nIl pin fuxia uscirà dalla mappa; foto e note resteranno visibili nella scheda del cantiere.'))return
  const{error}=await sb.from('segnalazioni_cantiere').update({
    stato:'agganciata',cantiere_id:cantId,gestita_da:S.user?.email||null,gestita_il:new Date().toISOString()
  }).eq('id',_segnAggId)
  if(error){toast('Errore aggancio: '+error.message,'err');return}
  hide('modal-segn-agg');_segnAggId=null
  toast('Segnalazione agganciata al cantiere ✓','ok')
  loadCantMap().catch(()=>{})
}

async function segnScarta(id){
  if(!window.__isCoord){toast('Azione riservata al coordinatore','err');return}
  if(!confirm('Scartare questa segnalazione?\\nIl pin sparirà dalla mappa (foto e note restano archiviate nel database).'))return
  const{error}=await sb.from('segnalazioni_cantiere').update({stato:'scartata',gestita_da:S.user?.email||null,gestita_il:new Date().toISOString()}).eq('id',id)
  if(error){toast('Errore: '+error.message,'err');return}
  toast('Segnalazione scartata','ok')
  loadCantMap().catch(()=>{})
}
window.segnApriAggancio=segnApriAggancio
window.segnAggancia=segnAggancia
window.segnScarta=segnScarta

// ── EMAIL VERBALE DA ELENCO ──"""
rep(ANCHOR_END, BLOCCO, 'blocco js segnalazioni')

# ── 11. showCantiereDetail: foto/note da segnalazioni agganciate ──
rep("""    } else {
      html+=qdSec('Visite')+'<div style="color:#aaa;font-size:13px;padding:6px 0">Nessuna visita registrata</div>'
    }
    $('qd-body').innerHTML=html""",
    """    } else {
      html+=qdSec('Visite')+'<div style="color:#aaa;font-size:13px;padding:6px 0">Nessuna visita registrata</div>'
    }
    // Foto/note da segnalazioni agganciate a questo cantiere
    try{
      const{data:segs}=await sb.from('segnalazioni_cantiere').select('id,created_at,tecnico_nome,segnalata_da,note,drive_url,thumb_url').eq('cantiere_id',cantId).eq('stato','agganciata').order('created_at',{ascending:false})
      if(segs&&segs.length){
        html+=qdSec('Segnalazioni agganciate ('+segs.length+')')
        html+='<div style="display:flex;flex-wrap:wrap;gap:10px">'
        segs.forEach(sg=>{
          const dt=sg.created_at?new Date(sg.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):''
          html+='<div style="width:160px;font-size:11px;color:#666">'
          if(sg.thumb_url)html+='<a href="'+esc(sg.drive_url||sg.thumb_url)+'" target="_blank"><img src="'+esc(sg.thumb_url)+'" referrerpolicy="no-referrer" style="width:100%;border-radius:8px;display:block;margin-bottom:4px"></a>'
          else if(sg.drive_url)html+='<a href="'+esc(sg.drive_url)+'" target="_blank">\U0001f4f7 Foto su Drive</a><br>'
          html+='\U0001f4cd '+dt+(sg.tecnico_nome?'<br>'+esc(sg.tecnico_nome):'')+(sg.note?'<br><i>'+esc(sg.note)+'</i>':'')
          html+='</div>'
        })
        html+='</div>'
      }
    }catch(_e){}
    $('qd-body').innerHTML=html""",
    'scheda cantiere foto')

# ── Scrittura ──
with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

size = os.path.getsize(SRC)
ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {size} byte, termina con </html>: {ok_end}')
assert ok_end, 'file non termina con </html>!'
print('PATCH COMPLETATA')
