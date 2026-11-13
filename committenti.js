/* ============================================================
   Pagina «Committenti» della segreteria: elenco, ricerca, modifica, nuovo, doppioni e unione (admLoadCommittenti, admEditCommittente, admFondiCommittenti…). I pulsanti li mette su window.

   MODULO ESTRATTO DAL FILE CENTRALE index.html (revisione di tenuta del 13/11/2026).
   Il codice è lo stesso che stava nel file centrale: nessuna riga è cambiata. Vive
   dentro una fabbrica che riceve dal modulo inline le sole cose di cui ha bisogno:
   se manca una dipendenza si vede alla prima chiamata.

   Chi lo usa (index.html):
     import { creaCommittenti } from './committenti.js'
     const { admLoadCommittenti } = creaCommittenti({ $, sb, toast, esc, show, hide, vGet, vSet, selComEScritto })
   ⚠️ Un file nuovo va aggiunto alle due liste di .github/workflows/deploy-pages.yml
   (paths e copia in _site): senza, non viene pubblicato.
   ============================================================ */
export function creaCommittenti({ $, sb, toast, esc, show, hide, vGet, vSet, selComEScritto }) {
// ── GESTIONE COMMITTENTI (pagina dedicata, solo segreteria) ──
let _commRows=[]
let _commSel=new Map()
let _commSort={k:'nome',dir:1}
let _commDup=null,_commDupN=0,_commFilterIds=null
function _commMergeBar(){const bar=$('comm-merge-bar');if(!bar)return;const n=_commSel.size;bar.style.display=n>=2?'flex':'none';const c=$('comm-merge-count');if(c)c.textContent=n+' committente/i selezionato/i'}
function _commSelToggle(cb){const id=cb.dataset.id;if(cb.checked)_commSel.set(id,cb.dataset.nome||id);else _commSel.delete(id);_commMergeBar()}
function _commSelClear(){_commSel.clear();document.querySelectorAll('.comm-sel-chk').forEach(c=>c.checked=false);_commMergeBar()}
function _commTipoLbl(k){return (k.tipo_sogg||'')||(k.committente_tipo==1?'Pubblico':(k.committente_tipo==2?'Privato':''))}
function _commSortVal(k,key){
  if(key==='n_cantieri')return k.n_cantieri||0
  if(key==='n_visite')return k.n_visite||0
  if(key==='cf')return (k.cf_piva||'').toLowerCase()
  if(key==='piva')return (k.piva||'').toLowerCase()
  if(key==='tipo')return _commTipoLbl(k).toLowerCase()
  return (k.committente_nome||'').toLowerCase()
}
function _commRowHtml(k){
  const id=k.committente_id
  const dup=_commDup&&_commDup.has(id)
  const bg=dup?((_commDup.get(id)%2)?'#ffe3d3':'#fff1e8'):(_commFilterIds?'#fff1e8':'')
  return '<tr'+(bg?' style="background:'+bg+'"':'')+'>'+
    '<td style="text-align:center"><input type="checkbox" class="comm-sel-chk" data-id="'+esc(id)+'" data-nome="'+esc(k.committente_nome||'')+'" '+(_commSel.has(id)?'checked':'')+' onchange="_commSelToggle(this)" style="width:16px;height:16px;cursor:pointer"></td>'+
    '<td style="font-weight:500">'+(dup?'<span title="Possibile duplicato" style="color:var(--orange,#e7500f)">●</span> ':'')+esc(k.committente_nome||'')+'</td>'+
    '<td style="font-family:monospace;font-size:11px;color:#666">'+esc(k.cf_piva||'')+'</td>'+
    '<td style="font-family:monospace;font-size:11px;color:#666">'+esc(k.piva||'')+'</td>'+
    '<td style="font-size:12px">'+esc(_commTipoLbl(k))+'</td>'+
    '<td style="text-align:center">'+(k.n_cantieri||0)+'</td>'+
    '<td style="text-align:center">'+(k.n_visite||0)+'</td>'+
    '<td style="text-align:right;white-space:nowrap"><button class="btn-outline btn-sm" title="Modifica" onclick="admEditCommittente(\''+esc(id)+'\')">✏️</button> <button class="btn-outline btn-sm" title="Trova nomi simili" onclick="admSimiliCommittente(\''+esc(id)+'\')">🧬</button></td></tr>'
}
function _commRender(){
  const tb=$('tbody-adm-comm');if(!tb)return
  const k=_commSort.k,dir=_commSort.dir
  let rows=_commFilterIds?_commRows.filter(r=>_commFilterIds.has(r.committente_id)):[..._commRows]
  if(k==='dup'&&_commDup){
    rows.sort((a,b)=>{
      const ga=_commDup.has(a.committente_id)?_commDup.get(a.committente_id):Infinity
      const gb=_commDup.has(b.committente_id)?_commDup.get(b.committente_id):Infinity
      if(ga!==gb)return ga<gb?-1:1
      const va=_commSortVal(a,'nome'),vb=_commSortVal(b,'nome');return va<vb?-1:va>vb?1:0
    })
  }else{
    rows.sort((a,b)=>{const va=_commSortVal(a,k),vb=_commSortVal(b,k);return (va<vb?-1:va>vb?1:0)*dir})
  }
  tb.innerHTML=rows.map(_commRowHtml).join('')
  document.querySelectorAll('#view-committenti .cs-i').forEach(s=>s.textContent=(s.dataset.k===k)?(dir>0?' ▲':' ▼'):'')
  const cnt=$('comm-list-count')
  if(cnt)cnt.textContent=_commFilterIds?(rows.length+' con nome simile — "Mostra tutti" per tornare alla lista completa'):(rows.length+' committenti'+(_commDup?(' · '+_commDupN+' gruppi di possibili duplicati evidenziati in cima'):''))
  _commMergeBar()
}
function commSort(k){if(_commSort.k===k)_commSort.dir*=-1;else{_commSort.k=k;_commSort.dir=1}_commRender()}
async function admLoadCommittenti(){
  _commFilterIds=null
  const q=($('adm-comm-search')?.value||'').trim()
  const tb=$('tbody-adm-comm');if(!tb)return
  tb.innerHTML='<tr><td colspan="8" style="padding:16px;text-align:center;color:#aaa">Caricamento…</td></tr>'
  const emp=$('comm-empty');if(emp)emp.classList.add('hidden')
  try{
    const{data,error}=await sb.rpc('committenti_lista',{p_search:q||null})
    if(error)throw error
    _commRows=data||[]
    if(!_commRows.length){tb.innerHTML='';if(emp)emp.classList.remove('hidden');const cnt=$('comm-list-count');if(cnt)cnt.textContent='0 committenti';return}
    _commRender()
  }catch(e){console.error('admLoadCommittenti',e);tb.innerHTML='<tr><td colspan="8" style="padding:16px;text-align:center;color:#c00">Errore: '+esc(e.message||'')+'</td></tr>'}
}
let _editCommId=null
async function admEditCommittente(id){
  _editCommId=id
  const _idf=$('ec-id');if(_idf){_idf.readOnly=true;_idf.style.background='#f4f4f4';_idf.style.color='#888';_idf.style.cursor='not-allowed'}
  const _mh=document.querySelector('#modal-edit-comm h3');if(_mh)_mh.textContent='👤 Scheda committente'
  /* 04/10/2026: la scheda si rilegge sempre dal database (prima si prendeva dall'elenco già in
     memoria, che poteva essere vecchio), e salvando si scrive solo ciò che è cambiato (_ecOrig) */
  const ri=(_commRows||[]).find(x=>x.committente_id===id)||{}
  const{data,error}=await sb.from('committenti').select('*').eq('committente_id',id).single()
  if(error){toast('Non sono riuscito a leggere la scheda del committente ('+error.message+'): riprova.','err');return}
  const k=Object.assign({n_cantieri:ri.n_cantieri,n_visite:ri.n_visite},data||{})
  _ecOrig=data||{}
  vSet('ec-id',k.committente_id||id)
  vSet('ec-nome',k.committente_nome||'')
  vSet('ec-cfpiva',k.cf_piva||'')
  vSet('ec-piva',k.piva||'')
  vSet('ec-email',k.email||'')
  vSet('ec-tel',k.telefono||'')
  selComEScritto($('ec-sogg'),k.tipo_sogg||'')
  selComEScritto($('ec-tipo'),k.committente_tipo!=null?String(k.committente_tipo):'')
  const info=$('ec-info');if(info)info.textContent=(k.n_cantieri!=null?('· '+k.n_cantieri+' cantieri · '+(k.n_visite||0)+' visite'):'')
  const box=$('ec-cantieri-list');if(box)box.innerHTML='<div style="color:#aaa;font-size:12px">Caricamento cantieri…</div>'
  show('modal-edit-comm')
  const vbox=$('ec-visite-list'),vinfo=$('ec-visite-info')
  if(vbox)vbox.innerHTML='<div style="color:#aaa;font-size:12px">Caricamento visite…</div>'
  try{
    const{data:cant,error:eCant}=await sb.from('cantieri').select('cantiere_id,cantiere_etichetta,cantiere_indirizzo,comune_nome,cantiere_cnce').eq('cantiere_committente_id',id).order('comune_nome').limit(500)
    if(eCant)throw eCant   // lettura fallita ≠ «Nessun cantiere collegato»
    const clist=cant||[]
    if(box){
      if(!clist.length)box.innerHTML='<div style="color:#aaa;font-size:12px">Nessun cantiere collegato</div>'
      else box.innerHTML=clist.map(function(c){return '<div style="padding:4px 0;border-bottom:1px solid #eee;font-size:12px"><b>'+esc(c.cantiere_etichetta||c.cantiere_indirizzo||c.cantiere_id)+'</b> <span style="color:#888">'+esc(c.comune_nome||'')+(c.cantiere_cnce?(' · CNCE '+esc(c.cantiere_cnce)):'')+'</span></div>'}).join('')
    }
    const cmap={};clist.forEach(function(c){cmap[c.cantiere_id]=c.cantiere_etichetta||c.cantiere_indirizzo||c.cantiere_id})
    const cids=clist.map(function(c){return c.cantiere_id})
    let vis=[]
    if(cids.length){
      const{data:vv,error:eVv}=await sb.from('visite').select('visita_id,nr_verbale,data_visita,cantiere_id,ipc').in('cantiere_id',cids).eq('elimina',0).order('data_visita',{ascending:false}).limit(500)
      if(eVv){   // lettura fallita ≠ «Nessuna visita collegata»
        if(vinfo)vinfo.textContent=''
        if(vbox)vbox.innerHTML='<div style="color:#c00;font-size:12px">Non sono riuscito a leggere le visite: '+esc(eVv.message||'')+'</div>'
        return
      }
      vis=vv||[]
    }
    if(vinfo)vinfo.textContent=vis.length?('· '+vis.length+' visite'):'· nessuna'
    if(vbox){
      if(!vis.length)vbox.innerHTML='<div style="color:#aaa;font-size:12px">Nessuna visita collegata</div>'
      else vbox.innerHTML=vis.map(function(v){var d=v.data_visita?new Date(v.data_visita).toLocaleDateString('it-IT'):'';return '<div style="padding:4px 0;border-bottom:1px solid #eee;font-size:12px"><b>'+esc(v.nr_verbale||v.visita_id)+'</b> <span style="color:#888">'+d+' · '+esc(cmap[v.cantiere_id]||'')+(v.ipc?(' · IPC '+esc(v.ipc)):'')+'</span></div>'}).join('')
    }
  }catch(e){
    if(box)box.innerHTML='<div style="color:#c00;font-size:12px">Non sono riuscito a leggere i cantieri: '+esc(e.message||'')+'</div>'
    if(vinfo)vinfo.textContent=''
    if(vbox)vbox.innerHTML='<div style="color:#c00;font-size:12px">Visite non lette (i cantieri non si sono letti).</div>'
  }
}
function admNuovoCommittente(){
  _editCommId=null
  ;['ec-id','ec-nome','ec-cfpiva','ec-piva','ec-email','ec-tel'].forEach(function(i){vSet(i,'')})
  const sog=$('ec-sogg');if(sog)sog.value=''
  const tp=$('ec-tipo');if(tp)tp.value=''
  const info=$('ec-info');if(info)info.textContent=''
  const vinfo=$('ec-visite-info');if(vinfo)vinfo.textContent=''
  const b1=$('ec-cantieri-list');if(b1)b1.innerHTML='<div style="color:#aaa;font-size:12px">\u2014</div>'
  const b2=$('ec-visite-list');if(b2)b2.innerHTML='<div style="color:#aaa;font-size:12px">\u2014</div>'
  const f=$('ec-id');if(f){f.readOnly=false;f.style.background='';f.style.color='';f.style.cursor='';f.placeholder='CF (16) o P.IVA (11)'}
  const h=document.querySelector('#modal-edit-comm h3');if(h)h.textContent='👤 Nuovo committente'
  show('modal-edit-comm')
  if(f)f.focus()
}
let _ecOrig=null
async function admSaveEditComm(){
  const nome=vGet('ec-nome').trim()
  if(nome.length<2){toast('Ragione sociale / nome obbligatorio','warn');return}
  const tp=vGet('ec-tipo')
  const upd={
    committente_nome:nome,
    tipo_sogg:vGet('ec-sogg')||null,
    committente_tipo:tp?parseInt(tp,10):null,
    cf_piva:vGet('ec-cfpiva').trim()||null,
    piva:vGet('ec-piva').trim()||null,
    email:vGet('ec-email').trim()||null,
    telefono:vGet('ec-tel').trim()||null
  }
  try{
    if(_editCommId){
      const o=_ecOrig||{},diff={}
      Object.entries(upd).forEach(([c,v])=>{if(String(o[c]??'')!==String(v??''))diff[c]=v})
      if(Object.keys(diff).length){const{error}=await sb.from('committenti').update(diff).eq('committente_id',_editCommId);if(error)throw error}
      hide('modal-edit-comm');toast('Committente aggiornato','ok');admLoadCommittenti();_commDupReload()
    }else{
      const nid=vGet('ec-id').trim().toUpperCase().replace(/\s+/g,'')
      if(!nid){toast('Inserisci CF o P.IVA: \u00e8 la chiave del committente','warn');return}
      if(nid.length!==11&&nid.length!==16&&!confirm('L\'identificativo "'+nid+'" non ha 11 caratteri (P.IVA) n\u00e9 16 (CF).\nSalvare comunque?'))return
      const{data:ex}=await sb.from('committenti').select('committente_id,committente_nome,elimina').eq('committente_id',nid).maybeSingle()
      if(ex){toast('Esiste gi\u00e0 un committente con questo identificativo: '+(ex.committente_nome||nid)+(ex.elimina?' (archiviato)':''),'err');return}
      if(!upd.cf_piva)upd.cf_piva=nid
      const{error}=await sb.from('committenti').insert(Object.assign({committente_id:nid},upd));if(error)throw error
      hide('modal-edit-comm');toast('Committente creato','ok')
      const sf=$('adm-comm-search');if(sf)sf.value=nome
      admLoadCommittenti()
    }
  }catch(e){toast('Errore salvataggio: '+(e.message||e),'err')}
}
window.admSaveEditComm=admSaveEditComm
window.admNuovoCommittente=admNuovoCommittente
;(function(){var c=$('btn-ec-cancel');if(c)c.onclick=function(){hide('modal-edit-comm')};var s=$('btn-ec-save');if(s)s.onclick=admSaveEditComm})()
async function admFondiCommittenti(){
  const ids=[..._commSel.keys()]
  if(ids.length<2){toast('Seleziona almeno due committenti','warn');return}
  const opts=ids.map((id,i)=>(i+1)+'. '+_commSel.get(id)+' ['+id+']').join('\n')
  const raw=prompt('UNIONE COMMITTENTI\n\nQuale vuoi TENERE come principale?\nDigita il numero:\n\n'+opts,'1')
  if(raw===null)return
  const idx=parseInt(raw,10)-1
  if(isNaN(idx)||idx<0||idx>=ids.length){toast('Scelta non valida','err');return}
  const masterId=ids[idx];const dupeIds=ids.filter(x=>x!==masterId)
  if(!confirm('Confermi l\'unione?\n\nPRINCIPALE (tenuto): '+_commSel.get(masterId)+'\n\nUniti e archiviati ('+dupeIds.length+'):\n'+dupeIds.map(x=>'• '+_commSel.get(x)).join('\n')+'\n\nCantieri e visite verranno spostati sul principale.'))return
  try{
    const{data,error}=await sb.rpc('fondi_committenti',{p_master_id:masterId,p_dupe_ids:dupeIds})
    if(error)throw error
    const _rne=(data&&data.recapiti_non_entrati)||[]
    toast('Unione completata: '+((data&&data.committenti_archiviati)||dupeIds.length)+' archiviato/i · '+((data&&data.cantieri_spostati)||0)+' cantieri spostati'+(_rne.length?' · ATTENZIONE: il committente ha un posto solo per email e telefono, non sono entrati: '+_rne.map(r=>r.valore).join(', '):''),_rne.length?'warn':'ok',_rne.length?12000:3500)
    _commSelClear();admLoadCommittenti();_commDupReload()
  }catch(e){toast('Errore unione: '+(e.message||e),'err')}
}
async function admEvidenziaDup(){
  const btn=$('btn-comm-dup')
  if(_commDup){_commDup=null;_commDupN=0;if(btn)btn.textContent='🧬 Evidenzia duplicati';if(_commSort.k==='dup')_commSort={k:'nome',dir:1};_commRender();return}
  if(btn)btn.textContent='🧬 Ricerca…'
  try{
    const{data,error}=await sb.rpc('committenti_duplicati')
    if(error)throw error
    const gs=data||[]
    if(!gs.length){if(btn)btn.textContent='🧬 Evidenzia duplicati';toast('Nessun duplicato per nome identico 🎉 (usa 🧬 sulla riga per i nomi simili)','ok');return}
    _commDup=new Map();_commDupN=gs.length
    gs.forEach((g,gi)=>(g.membri||[]).forEach(m=>_commDup.set(m.id,gi)))
    _commSort={k:'dup',dir:1}
    if(btn)btn.textContent='🧬 '+gs.length+' gruppi — togli evidenza'
    _commRender()
  }catch(e){if(btn)btn.textContent='🧬 Evidenzia duplicati';toast('Errore: '+(e.message||e),'err')}
}
async function _commDupReload(){
  if(!_commDup)return
  try{
    const{data}=await sb.rpc('committenti_duplicati')
    const gs=data||[]
    const btn=$('btn-comm-dup')
    if(!gs.length){_commDup=null;_commDupN=0;if(btn)btn.textContent='🧬 Evidenzia duplicati';if(_commSort.k==='dup')_commSort={k:'nome',dir:1}}
    else{_commDup=new Map();_commDupN=gs.length;gs.forEach((g,gi)=>(g.membri||[]).forEach(m=>_commDup.set(m.id,gi)));if(btn)btn.textContent='🧬 '+gs.length+' gruppi — togli evidenza'}
    _commRender()
  }catch(_){}
}
async function admSimiliCommittente(id){
  try{
    const{data,error}=await sb.rpc('committenti_simili',{p_id:id})
    if(error)throw error
    const sim=data||[]
    if(!sim.length){toast('Nessun nome simile trovato','ok');return}
    sim.forEach(function(x){if(!(_commRows||[]).some(r=>r.committente_id===x.id))_commRows.push({committente_id:x.id,committente_nome:x.nome,cf_piva:x.cfp||null,piva:null,n_cantieri:x.n_cantieri||0,n_visite:x.n_visite||0})})
    _commFilterIds=new Set([id].concat(sim.map(x=>x.id)))
    _commRender()
  }catch(e){toast('Errore: '+(e.message||e),'err')}
}
window.admLoadCommittenti=admLoadCommittenti
window._commSelToggle=_commSelToggle
window._commSelClear=_commSelClear
window.admEditCommittente=admEditCommittente
window.admFondiCommittenti=admFondiCommittenti
window.admEvidenziaDup=admEvidenziaDup
window.admSimiliCommittente=admSimiliCommittente
window.commSort=commSort
document.querySelectorAll('#view-committenti th.cs').forEach(function(th){th.onclick=function(){commSort(th.dataset.k)}})
$('adm-comm-search')?.addEventListener('keydown',function(e){if(e.key==='Enter')admLoadCommittenti()})
return { admLoadCommittenti }
}
