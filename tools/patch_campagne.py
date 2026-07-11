# -*- coding: utf-8 -*-
"""Patch: campagne informative (es. colpo di calore) — 2026-07-11
- Zona Coordinatore: sezione per preparare titolo, testo, 1-2 immagini, 2 link e periodo
- Coda del verbale PDF: blocco campagna con immagini e link cliccabili
- Mail verbale: blocco campagna gestito da send-verbale v21
- All'invio: scelta di volta in volta dove inserirla (verbale/mail/entrambi/no)
Uso: python tools/patch_campagne.py
"""
import io, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'index.html')
ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
BAK = os.path.join(BASE, f'index_pre_campagne_{ts}.html.bak')
shutil.copy2(SRC, BAK)
print('Backup:', BAK)

with io.open(BAK, 'r', encoding='utf-8') as f:
    html = f.read()

def rep(old, new, label, expected=1):
    global html
    n = html.count(old)
    assert n == expected, f'{label}: attese {expected}, trovate {n}'
    html = html.replace(old, new)
    print('OK:', label)

ADM_IN = 'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:6px;padding:8px'

# ── 1. Sezione admin ──
rep('        <!-- Bacheca avvisi -->',
    f'''        <!-- Campagne informative -->
        <div class="adm-section">
          <div class="adm-section-title">📣 Campagna informativa (coda verbale / email)</div>
          <p style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:10px">Prepara testo, una o due immagini ed eventuali link (es. campagna colpo di calore). Nel periodo indicato viene accodata automaticamente al PDF del verbale e/o alla mail; al momento dell'invio si può comunque cambiare o escludere.</p>
          <div style="display:grid;gap:8px;max-width:660px">
            <input id="cmp-titolo" placeholder="Titolo campagna *" style="{ADM_IN}">
            <textarea id="cmp-testo" placeholder="Testo (opzionale)…" rows="3" style="{ADM_IN};font-family:inherit"></textarea>
            <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.7)">
              <label>Immagine 1&nbsp;<input type="file" id="cmp-img1" accept="image/*"></label>
              <label>Immagine 2&nbsp;<input type="file" id="cmp-img2" accept="image/*"></label>
            </div>
            <div id="cmp-img-prev" style="display:flex;gap:8px"></div>
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
              <input id="cmp-l1-label" placeholder="Testo link 1 (es. ordinanza n°58)" style="{ADM_IN}">
              <input id="cmp-l1-url" placeholder="https://…" style="{ADM_IN}">
              <input id="cmp-l2-label" placeholder="Testo link 2" style="{ADM_IN}">
              <input id="cmp-l2-url" placeholder="https://…" style="{ADM_IN}">
            </div>
            <div class="adm-date-row">
              <div class="field" style="min-width:140px"><label>Attiva dal</label><input type="date" id="cmp-dal"></div>
              <div class="field" style="min-width:140px"><label>Fino al</label><input type="date" id="cmp-al"></div>
              <div class="field" style="min-width:180px"><label>Posizione predefinita</label><select id="cmp-pos"><option value="verbale">Coda del verbale PDF</option><option value="email">Corpo della mail</option><option value="entrambi">Verbale + mail</option></select></div>
              <button class="btn-primary" style="background:#95C22F;border-color:#7aa527" onclick="admSalvaCampagna()">💾 Salva campagna</button>
            </div>
            <div id="cmp-status" style="font-size:12px;color:rgba(255,255,255,.6)"></div>
          </div>
          <div id="adm-campagne-list" style="margin-top:14px"></div>
        </div>

        <!-- Bacheca avvisi -->''',
    'sezione admin campagne')

# ── 2. Modal email: riquadro scelta posizione ──
rep('<div id="email-verbale-list" style="margin-bottom:14px;max-height:220px;overflow-y:auto"></div>',
    '''<div id="email-verbale-list" style="margin-bottom:14px;max-height:220px;overflow-y:auto"></div>
    <div id="ev-campagna-wrap" style="display:none;margin-bottom:12px;padding:8px 10px;background:#fff3ee;border-radius:8px;font-size:12px">
      📣 Campagna attiva: <b id="ev-campagna-nome"></b><br>
      Inserisci in: <select id="ev-campagna-pos" style="margin-top:4px;padding:3px 6px;border-radius:6px;border:1px solid #ddd;font-size:12px">
        <option value="entrambi">verbale PDF + mail</option>
        <option value="verbale">solo verbale PDF</option>
        <option value="email">solo mail</option>
        <option value="no">non inserire questa volta</option>
      </select>
    </div>''',
    'riquadro campagna modal email')

# ── 3. navTo admin: carica anche le campagne ──
rep("if(view==='admin'){admInit();admLoadAvvisi&&admLoadAvvisi().catch(e=>console.warn('admLoadAvvisi:',e))}",
    "if(view==='admin'){admInit();admLoadAvvisi&&admLoadAvvisi().catch(e=>console.warn('admLoadAvvisi:',e));admLoadCampagne&&admLoadCampagne().catch(e=>console.warn('admLoadCampagne:',e))}",
    'admin init campagne')

# ── 4. genPDF: coda campagna prima del footer ──
rep("""    ln(22)
    hLine([220,220,220],0.2);ln(4)
    setFont('normal',7,[180,180,180])
    doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`,PW/2,y,{align:'center'})""",
    """    // ── CAMPAGNA INFORMATIVA (coda verbale) ──
    try{
      const _cmp=await getCampagnaAttiva()
      const _cmpPos=(window._campagnaTarget!==undefined&&window._campagnaTarget!==null)?window._campagnaTarget:(_cmp?_cmp.posizione:null)
      if(_cmp&&(_cmpPos==='verbale'||_cmpPos==='entrambi')){
        const _PH=doc.internal.pageSize.getHeight()
        if(y>_PH-70){doc.addPage();y=16}else{ln(10)}
        hLine(ORANGE,0.6);ln(8)
        setFont('bold',12,ORANGE)
        const _ttl=doc.splitTextToSize(_cmp.titolo||'',W)
        doc.text(_ttl,L,y);y+=_ttl.length*5.5+3
        if(_cmp.testo){
          setFont('normal',9,[40,40,40])
          const _tl=doc.splitTextToSize(_cmp.testo,W)
          if(y+_tl.length*4.5>_PH-20){doc.addPage();y=16}
          doc.text(_tl,L,y);y+=_tl.length*4.5+5
        }
        for(const _iu of [_cmp.img1_url,_cmp.img2_url].filter(Boolean)){
          try{
            const _r=await fetch(_iu);if(!_r.ok)continue
            const _b=await _r.blob()
            const _d=await new Promise(res=>{const fr=new FileReader();fr.onload=e=>res(e.target.result);fr.readAsDataURL(_b)})
            const _im=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=_d})
            let _w=W,_h=_w*_im.height/_im.width
            const _maxH=_PH-36
            if(_h>_maxH){_h=_maxH;_w=_h*_im.width/_im.height}
            if(y+_h>_PH-18){doc.addPage();y=16}
            const _fmt=_d.slice(0,30).includes('png')?'PNG':'JPEG'
            doc.addImage(_d,_fmt,L+(W-_w)/2,y,_w,_h)
            y+=_h+5
          }catch(_ei){console.warn('img campagna PDF:',_ei)}
        }
        const _lnks=[[_cmp.link1_label,_cmp.link1_url],[_cmp.link2_label,_cmp.link2_url]].filter(x=>x[1])
        if(_lnks.length){
          if(y>_PH-16){doc.addPage();y=16}
          setFont('normal',9,[37,99,235])
          let _lx=L
          _lnks.forEach(([_lb,_url])=>{
            const _t=_lb||_url
            doc.textWithLink(_t,_lx,y,{url:_url})
            const _tw=doc.getTextWidth(_t)
            doc.setDrawColor(37,99,235);doc.setLineWidth(0.2);doc.line(_lx,y+1,_lx+_tw,y+1)
            _lx+=_tw+16
          })
          y+=8
        }
      }
    }catch(_ec){console.warn('campagna PDF:',_ec)}

    ln(22)
    hLine([220,220,220],0.2);ln(4)
    setFont('normal',7,[180,180,180])
    doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`,PW/2,y,{align:'center'})""",
    'coda campagna in genPDF')

# ── 5. apertura modal email: prepara il riquadro campagna (2 flussi) ──
rep("show('modal-email-verbale')",
    "_evSetupCampagna();show('modal-email-verbale')",
    'setup campagna su apertura modal', expected=2)

# ── 6. invio: rispetta la scelta nel PDF e nella mail ──
rep("    const pdfDataUri=await genPDF(vid,'base64')",
    """    const _cmpW=$('ev-campagna-wrap')
    window._campagnaTarget=(_cmpW&&_cmpW.style.display!=='none')?$('ev-campagna-pos').value:undefined
    const pdfDataUri=await genPDF(vid,'base64')""",
    'target campagna prima del PDF')

rep("    const pdfBase64=pdfDataUri.includes(',')?pdfDataUri.split(',')[1]:pdfDataUri",
    "    const pdfBase64=pdfDataUri.includes(',')?pdfDataUri.split(',')[1]:pdfDataUri\n    window._campagnaTarget=undefined",
    'reset target campagna')

rep("          driveFileId: upData.drive_file_id,",
    "          campagna: await _evCampagnaPayload(),\n          driveFileId: upData.drive_file_id,",
    'payload campagna nella mail')

# ── 7. blocco JS campagne ──
rep("window.dedupMerge=dedupMerge",
    """window.dedupMerge=dedupMerge

// ══════════════════════════════════════════════════════════════
// ── CAMPAGNE INFORMATIVE (coda verbale / email) ──
// ══════════════════════════════════════════════════════════════
async function getCampagnaAttiva(force){
  if(!force&&window._campagnaCache!==undefined)return window._campagnaCache
  try{
    const today=new Date().toISOString().slice(0,10)
    const{data}=await sb.from('campagne').select('*').eq('attivo',true)
      .or(`dal.is.null,dal.lte.${today}`).or(`al.is.null,al.gte.${today}`)
      .order('created_at',{ascending:false}).limit(1)
    window._campagnaCache=(data&&data[0])||null
  }catch(_e){window._campagnaCache=null}
  return window._campagnaCache
}
async function _evSetupCampagna(){
  const wrap=$('ev-campagna-wrap');if(!wrap)return
  const c=await getCampagnaAttiva()
  if(!c){wrap.style.display='none';return}
  $('ev-campagna-nome').textContent=c.titolo||''
  $('ev-campagna-pos').value=c.posizione||'verbale'
  wrap.style.display='block'
}
async function _evCampagnaPayload(){
  const wrap=$('ev-campagna-wrap')
  if(!wrap||wrap.style.display==='none')return null
  const pos=$('ev-campagna-pos').value
  if(pos!=='email'&&pos!=='entrambi')return null
  const c=await getCampagnaAttiva()
  if(!c)return null
  return {titolo:c.titolo,testo:c.testo,img1_url:c.img1_url,img2_url:c.img2_url,
    link1_label:c.link1_label,link1_url:c.link1_url,link2_label:c.link2_label,link2_url:c.link2_url}
}

// ── gestione campagne (Zona Coordinatore) ──
let _cmpEditId=null,_cmpImg1Url=null,_cmpImg2Url=null
async function _cmpUpload(file){
  const b64=await _segnComprimiFoto(file)
  const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0))
  const path=`campagna_${Date.now()}_${Math.random().toString(36).slice(2,6)}.jpg`
  const{error}=await sb.storage.from('campagne').upload(path,bin,{contentType:'image/jpeg'})
  if(error)throw error
  return sb.storage.from('campagne').getPublicUrl(path).data.publicUrl
}
function _cmpResetForm(){
  _cmpEditId=null;_cmpImg1Url=null;_cmpImg2Url=null
  ;['cmp-titolo','cmp-testo','cmp-l1-label','cmp-l1-url','cmp-l2-label','cmp-l2-url','cmp-dal','cmp-al'].forEach(id=>{const el=$(id);if(el)el.value=''})
  const p=$('cmp-pos');if(p)p.value='verbale'
  ;['cmp-img1','cmp-img2'].forEach(id=>{const el=$(id);if(el)el.value=''})
  const pv=$('cmp-img-prev');if(pv)pv.innerHTML=''
}
async function admSalvaCampagna(){
  if(!window.__isCoord){toast('Funzione riservata al coordinatore','err');return}
  const titolo=vGet('cmp-titolo').trim()
  if(!titolo){toast('Il titolo della campagna è obbligatorio','warn');return}
  const st=$('cmp-status');if(st)st.textContent='⏳ Salvataggio…'
  try{
    let img1=_cmpImg1Url,img2=_cmpImg2Url
    const f1=$('cmp-img1')?.files?.[0],f2=$('cmp-img2')?.files?.[0]
    if(f1){if(st)st.textContent='⏳ Carico immagine 1…';img1=await _cmpUpload(f1)}
    if(f2){if(st)st.textContent='⏳ Carico immagine 2…';img2=await _cmpUpload(f2)}
    const row={titolo,testo:vGet('cmp-testo').trim()||null,
      img1_url:img1||null,img2_url:img2||null,
      link1_label:vGet('cmp-l1-label').trim()||null,link1_url:vGet('cmp-l1-url').trim()||null,
      link2_label:vGet('cmp-l2-label').trim()||null,link2_url:vGet('cmp-l2-url').trim()||null,
      dal:vGet('cmp-dal')||null,al:vGet('cmp-al')||null,
      posizione:vGet('cmp-pos')||'verbale',created_by:S.user?.email||null}
    let error
    if(_cmpEditId){({error}=await sb.from('campagne').update(row).eq('id',_cmpEditId))}
    else{({error}=await sb.from('campagne').insert(row))}
    if(error)throw error
    if(st)st.textContent=''
    toast('Campagna salvata ✓','ok')
    _cmpResetForm()
    window._campagnaCache=undefined
    admLoadCampagne()
  }catch(e){
    if(st)st.textContent=''
    toast('Errore salvataggio campagna: '+(e.message||e),'err')
  }
}
async function admLoadCampagne(){
  const box=$('adm-campagne-list');if(!box)return
  const{data}=await sb.from('campagne').select('*').order('created_at',{ascending:false}).limit(30)
  const today=new Date().toISOString().slice(0,10)
  const POS={verbale:'verbale PDF',email:'mail',entrambi:'verbale + mail'}
  box.innerHTML=(data||[]).map(c=>{
    let stato,col
    if(!c.attivo){stato='spenta';col='#888'}
    else if(c.dal&&c.dal>today){stato='in partenza il '+fmtDate(c.dal);col='#f39c12'}
    else if(c.al&&c.al<today){stato='scaduta';col='#c0392b'}
    else{stato='ATTIVA ORA';col='#95C22F'}
    const per=[c.dal?fmtDate(c.dal):'sempre',c.al?fmtDate(c.al):'senza fine'].join(' → ')
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.1);font-size:12px;color:rgba(255,255,255,.85)">
      <span style="font-weight:700;flex:1">${esc(c.titolo)}</span>
      <span style="color:rgba(255,255,255,.5)">${per} · ${POS[c.posizione]||c.posizione}${c.img1_url?' · 🖼':''}${c.img2_url?'🖼':''}</span>
      <span style="font-weight:700;color:${col}">${stato}</span>
      <button class="btn-outline btn-sm" onclick="admEditCampagna('${c.id}')" title="Modifica">✏️</button>
      <button class="btn-outline btn-sm" onclick="admToggleCampagna('${c.id}',${c.attivo?'false':'true'})" title="${c.attivo?'Spegni':'Riattiva'}">${c.attivo?'⏻':'▶'}</button>
      <button class="btn-outline btn-sm" onclick="admEliminaCampagna('${c.id}')" title="Elimina">🗑</button>
    </div>`
  }).join('')||'<div style="color:rgba(255,255,255,.4);font-size:12px;padding:8px">Nessuna campagna creata.</div>'
}
async function admEditCampagna(id){
  const{data:c}=await sb.from('campagne').select('*').eq('id',id).single()
  if(!c)return
  _cmpEditId=id;_cmpImg1Url=c.img1_url||null;_cmpImg2Url=c.img2_url||null
  vSet('cmp-titolo',c.titolo||'');vSet('cmp-testo',c.testo||'')
  vSet('cmp-l1-label',c.link1_label||'');vSet('cmp-l1-url',c.link1_url||'')
  vSet('cmp-l2-label',c.link2_label||'');vSet('cmp-l2-url',c.link2_url||'')
  vSet('cmp-dal',c.dal||'');vSet('cmp-al',c.al||'');vSet('cmp-pos',c.posizione||'verbale')
  const pv=$('cmp-img-prev')
  if(pv)pv.innerHTML=[c.img1_url,c.img2_url].filter(Boolean).map(u=>`<img src="${esc(u)}" style="height:60px;border-radius:6px">`).join('')||''
  toast('Campagna caricata nel modulo: modifica e premi Salva','ok')
}
async function admToggleCampagna(id,att){
  const{error}=await sb.from('campagne').update({attivo:att==='true'||att===true}).eq('id',id)
  if(error){toast('Errore: '+error.message,'err');return}
  window._campagnaCache=undefined
  admLoadCampagne()
}
async function admEliminaCampagna(id){
  if(!confirm('Eliminare definitivamente questa campagna?'))return
  const{error}=await sb.from('campagne').delete().eq('id',id)
  if(error){toast('Errore: '+error.message,'err');return}
  window._campagnaCache=undefined
  toast('Campagna eliminata','ok')
  admLoadCampagne()
}
window.admSalvaCampagna=admSalvaCampagna
window.admLoadCampagne=admLoadCampagne
window.admEditCampagna=admEditCampagna
window.admToggleCampagna=admToggleCampagna
window.admEliminaCampagna=admEliminaCampagna""",
    'blocco js campagne')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

ok_end = html.rstrip().endswith('</html>')
print(f'Scritto {SRC}: {os.path.getsize(SRC)} byte, termina con </html>: {ok_end}')
assert ok_end
print('PATCH CAMPAGNE COMPLETATA')
