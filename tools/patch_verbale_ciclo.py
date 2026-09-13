"""Verbale di sopralluogo in PDF, stile «ciclo con rilievi» (13/09/2026).

Sostituisce il CORPO di genPDF: il disegno passa a verbale-pdf.js
(VerbalePDF.prepara + VerbalePDF.crea), qui restano il caricamento dei dati,
il recupero di foto, firme, logo, QR e campagna, il salvataggio e l'upload su
Drive, identici a prima. La firma della funzione e il marcatore
«// ── GESTIONE FIRME TECNICI» restano uguali (li usa il banco di prova).

Backup index_pre_verbaleciclo_<data>.html.bak; ogni sostituzione deve
trovare UNA sola occorrenza (regola del file grande: mai Edit diretto).
"""
import pathlib, shutil, datetime, sys

D = pathlib.Path(__file__).resolve().parent.parent
P = D / "index.html"
raw = P.read_bytes()
crlf = b"\r\n" in raw[:5000]
s = raw.decode("utf-8")
if crlf:
    s = s.replace("\r\n", "\n")

if "verbale-pdf.js" in s:
    print("gia' applicata"); sys.exit(0)

bak = D / f"index_pre_verbaleciclo_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak"
shutil.copy2(P, bak)

def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:90])
    s = s.replace(old, new)

INIZIO = "async function genPDF(vid, output='save'){"
FINE = "\n// ── GESTIONE FIRME TECNICI"
assert s.count(INIZIO) == 1 and s.count(FINE) == 1
i, j = s.index(INIZIO), s.index(FINE)
vecchia = s[i:j]
assert vecchia.rstrip().endswith("finally{_pdfInProgress=false}\n}"), vecchia[-120:]

NUOVA = r"""async function genPDF(vid, output='save'){
  if(_pdfInProgress&&output==='save'){toast('PDF già in generazione, attendi…','warn');return}
  _pdfInProgress=true
  toast('Generazione PDF…')
  try{
    if(!vid){toast('ID visita mancante','err');_pdfInProgress=false;return}
    if(!window.jspdf?.jsPDF){toast('Libreria PDF non caricata — ricarica la pagina','err');_pdfInProgress=false;return}
    // La grafica del verbale sta in verbale-pdf.js (stile «ciclo con rilievi», 13/09/2026):
    // qui si caricano i dati e le immagini, là si fanno i calcoli e il disegno.
    if(!window.VerbalePDF){toast('Modulo del verbale non caricato — ricarica la pagina','err');_pdfInProgress=false;return}
    // Ricarica sempre voci dal DB per avere articolo/importo_sanzione aggiornati
    {
      const{data:vd}=await sb.from('checklist_voci').select('*').order('ordine')
      if(vd?.length) S.voci=vd
    }

    const{data:v,error:eV}=await sb.from('visite').select(`*,tecnici!visite_tecnico_id_fkey(*),cantieri(*,committenti(*)),imprese(*)`).eq('visita_id',vid).single()
    if(eV)throw new Error('Errore caricamento visita: '+eV.message)
    const{data:chk}=await sb.from('visite_checklist').select('codice,valore,nota').eq('visita_id',vid)
    const{data:lavs}=await sb.from('visite_lavorazioni').select('genere,fase,lavorazione').eq('visita_id',vid)
    const{data:imps}=await sb.from('visite_imprese_presenti').select('*,imprese(impresa_nome,impresa_cf,piva,impresa_email_ref)').eq('visita_id',vid).order('ordine')

    if(!v){toast('Visita non trovata','err');return}

    // Rettifica: dicitura sul PDF se è in corso un reinvio rettificato
    // oppure se l'ultimo invio registrato è una rettifica
    let _rettBanner=null
    try{
      if(window._evRettifica){
        _rettBanner='Sostituisce integralmente il verbale trasmesso il '+(window._evRettifica.dataPrimoInvio||'')
      }else{
        const{data:_ri}=await sb.from('verbali').select('tipo,inviato_at').eq('visita_id',vid).eq('inviato_email',true).order('inviato_at',{ascending:false}).limit(2)
        if(_ri&&_ri[0]?.tipo==='rettifica'){
          const _fmtR=iso=>{const d=new Date(iso);return isNaN(d)?'':`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
          _rettBanner=_ri[1]?('Sostituisce integralmente il verbale trasmesso il '+_fmtR(_ri[1].inviato_at)):('Rettifica trasmessa il '+_fmtR(_ri[0].inviato_at))
        }
      }
    }catch(_rb){console.warn('banner rettifica:',_rb)}

    // Secondo tecnico
    let tec2=null
    if(v.tecnico2_id){
      const{data:t2}=await sb.from('tecnici').select('tecnico_nome,tecnico_cognome,email').eq('tecnico_id',v.tecnico2_id).maybeSingle()
      tec2=t2||null
    }
    const pd=window.VerbalePDF.prepara({v,imps:imps||[],chk:chk||[],lavs:lavs||[],voci:S.voci||[],tec2,rettBanner:_rettBanner})
    const comuneLabel=(v.cantieri||{}).comune_nome||''

    // ── Immagini: nessuna è bloccante, se una non arriva il verbale esce senza ──
    const img={logo:null,qr:null,foto:[],firme:[],campagna:null}
    const _dataUrl=async resp=>{const b=await resp.blob();return await new Promise(res=>{const fr=new FileReader();fr.onload=e=>res(e.target.result);fr.readAsDataURL(b)})}
    try{
      const _lr=await fetch('logo-pdf.jpg')
      if(_lr.ok)img.logo=await _dataUrl(_lr)
    }catch(_eL){console.warn('logo PDF non caricato',_eL)}
    try{
      const _qrResp=await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&color=e7500f&bgcolor=ffffff&data=${encodeURIComponent('https://formedilpadovacpt.github.io/servizi/#')}`)
      if(_qrResp.ok)img.qr=await _dataUrl(_qrResp)
    }catch(_eQR){console.warn('QR fetch non riuscito',_eQR)}

    // FOTO – foto1..foto4 + eventuale foto privacy/firma
    const FOTO_TIPI=['foto1','foto2','foto3','foto4','privacy']
    const imgMap={}

    // 1. Usa base64 già in memoria (sessione corrente, dopo selezione file)
    for(const tipo of FOTO_TIPI){
      if(S.foto[tipo]?.base64) imgMap[tipo]='data:image/jpeg;base64,'+S.foto[tipo].base64
    }

    // 1b. Riusa le foto già decodificate in una precedente generazione di QUESTA visita
    for(const tipo of FOTO_TIPI){
      if(!imgMap[tipo]&&_fotoPdfCache[vid+'_'+tipo]) imgMap[tipo]=_fotoPdfCache[vid+'_'+tipo]
    }

    // 2. Per gli slot ancora vuoti: recupera metadati foto da DB + S.foto in memoria
    const slotMancanti=FOTO_TIPI.filter(t=>!imgMap[t])
    if(slotMancanti.length){
      try{
        // Query DB — seleziona anche thumb_url per download diretto (no Edge Function)
        const{data:fotoRec,error:fotoErr}=await sb.from('visite_foto')
          .select('tipo,drive_file_id,thumb_url')
          .eq('visita_id',vid)
          .in('tipo',slotMancanti)
        if(fotoErr) console.warn('visite_foto select errore:',fotoErr.message)

        // Unisce metadati DB + S.foto in memoria (visitata aperta o caricata da loadFotoExisting)
        const fotoMeta={}
        for(const fr of (fotoRec||[])){
          fotoMeta[fr.tipo]={fileId:fr.drive_file_id,thumb:fr.thumb_url}
        }
        for(const tipo of slotMancanti){
          if(!fotoMeta[tipo]&&(S.foto[tipo]?.thumb||S.foto[tipo]?.fileId)){
            fotoMeta[tipo]={fileId:S.foto[tipo].fileId,thumb:S.foto[tipo].thumb}
          }
        }

        const voci=Object.entries(fotoMeta)
        if(voci.length){
          toast('Recupero foto da Drive…')
          for(const [tipo,meta] of voci){
            // ── Tentativo 1: thumb_url pubblico, fetch diretto dal browser (veloce) ──
            if(meta.thumb){
              try{
                const b64=await fetchImageBase64(meta.thumb)
                if(b64){
                  imgMap[tipo]='data:image/jpeg;base64,'+b64
                  console.log('foto thumb OK:',tipo)
                  continue
                }
              }catch(e2){console.warn('foto thumb errore:',tipo,e2.message)}
            }
            // ── Tentativo 2: download via Edge Function (con timeout 12 s) ──
            if(meta.fileId){
              const{data:{session}}=await sb.auth.getSession()
              const token=session?.access_token
              if(token){
                try{
                  const ctrl=new AbortController()
                  const tId=setTimeout(()=>ctrl.abort(),12000)
                  let dlRes
                  try{
                    dlRes=await fetch(`${SB_URL}/functions/v1/upload-foto`,{
                      method:'POST',signal:ctrl.signal,
                      headers:{Authorization:`Bearer ${token}`,apikey:SB_KEY,'Content-Type':'application/json'},
                      body:JSON.stringify({download:true,file_id:meta.fileId})
                    })
                  }finally{clearTimeout(tId)}
                  const dlData=await dlRes.json()
                  if(dlData.ok&&dlData.base64){
                    imgMap[tipo]='data:image/jpeg;base64,'+dlData.base64
                    console.log('foto Edge Function OK:',tipo)
                  } else {
                    console.warn('foto Edge Function ERRORE:',tipo,dlData.error||dlRes.status)
                  }
                }catch(e2){
                  if(e2.name==='AbortError') console.warn('foto Edge Function TIMEOUT:',tipo)
                  else console.warn('foto Edge Function errore:',tipo,e2.message)
                }
              }
            }
          }
        }
      }catch(e){console.warn('foto lookup:',e)}
    }

    // Memorizza in cache di sessione le foto risolte: le riedizioni successive
    // del PDF le ritroveranno anche se Drive non risponde o S.foto è vuoto.
    for(const tipo of FOTO_TIPI){ if(imgMap[tipo]) _fotoPdfCache[vid+'_'+tipo]=imgMap[tipo] }

    // Comprimi le foto al volo (max 800px) prima di metterle nel PDF — evita rallentamenti con foto originali
    for(const tipo of FOTO_TIPI){
      if(!imgMap[tipo])continue
      try{
        const uri=imgMap[tipo]
        const b64orig=uri.includes(',')?uri.split(',')[1]:uri
        const b64pdf=await compressImageBase64(b64orig,800,0.7)
        img.foto.push({tipo,uri:'data:image/jpeg;base64,'+b64pdf})
      }catch(e){/* formato non supportato */}
    }

    // FIRMA – immagini firma da Supabase Storage (usa cache sessione _firmaCache)
    const _getFirmaB64=async(email)=>{
      if(!email)return null
      const fUrl=_firmaCache[email]
      if(!fUrl)return null
      try{
        const sUrl=await getFirmaSignedUrl(fUrl)
        if(!sUrl)return null
        return await fetchImageBase64(sUrl)
      }catch(e){return null}
    }
    for(const email of [pd.tecEmail,...(pd.tec2Nome?[pd.tec2Email]:[])]){
      const fb64=await _getFirmaB64(email)
      img.firme.push(fb64?'data:image/'+(fb64.startsWith('/9j')?'jpeg':'png')+';base64,'+fb64:null)
    }

    // ── CAMPAGNA INFORMATIVA (coda verbale) ──
    try{
      const _cmp=await getCampagnaAttiva()
      const _cmpPos=(window._campagnaTarget!==undefined&&window._campagnaTarget!==null)?window._campagnaTarget:(_cmp?_cmp.posizione:null)
      if(_cmp&&(_cmpPos==='verbale'||_cmpPos==='entrambi')){
        const immagini=[]
        for(const [_iu,_ifid] of [[_cmp.img1_url,_cmp.img1_file_id],[_cmp.img2_url,_cmp.img2_file_id]].filter(x=>x[0]||x[1])){
          try{
            let _d=null
            if(_ifid){
              try{
                const{data:{session:_ss}}=await sb.auth.getSession()
                const _tk=_ss?.access_token
                if(_tk){
                  const _dr=await fetch(`${SB_URL}/functions/v1/upload-foto`,{method:'POST',headers:{Authorization:`Bearer ${_tk}`,apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({download:true,file_id:_ifid})})
                  const _dd=await _dr.json()
                  if(_dd.ok&&_dd.base64)_d='data:image/jpeg;base64,'+_dd.base64
                }
              }catch(_ed){console.warn('download img campagna Drive:',_ed)}
            }
            if(!_d){
              if(!_iu)continue
              const _r=await fetch(_iu);if(!_r.ok)continue
              _d=await _dataUrl(_r)
            }
            const _im=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=_d})
            immagini.push({uri:_d,w:_im.width,h:_im.height})
          }catch(_ei){console.warn('img campagna PDF:',_ei)}
        }
        img.campagna={titolo:_cmp.titolo||'',testo:_cmp.testo||'',immagini,link:[[_cmp.link1_label,_cmp.link1_url],[_cmp.link2_label,_cmp.link2_url]]}
      }
    }catch(_ec){console.warn('campagna PDF:',_ec)}

    const doc=window.VerbalePDF.crea(window.jspdf.jsPDF,pd,img)

    // Salva PDF su Drive in background (non bloccante)
    const _uploadPdfDrive=async(b64)=>{
      try{
        const{data:{session}}=await sb.auth.getSession()
        const tkn=session?.access_token
        const r=await fetch(`${SB_URL}/functions/v1/upload-pdf`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${tkn}`,'apikey':SB_KEY},
          body:JSON.stringify({pdf_base64:b64,nr_verbale:v.nr_verbale,data_visita:v.data_visita,visita_id:vid})
        })
        const d=await r.json()
        if(d.ok)toast('PDF salvato su Drive ✓','ok')
        else console.warn('upload-pdf:',d.error)
      }catch(e){console.warn('upload-pdf:',e)}
    }

    if(output==='base64'){
      // NON chiamare _uploadPdfDrive qui: il gestore send-verbale lo gestisce
      // esplicitamente; un doppio upload concorrente blocca la Edge Function
      return doc.output('datauristring')
    }
    const pdfB64=doc.output('datauristring').split(',')[1]
    const _slugPdf=s=>(s||'').replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim()
    const _primaImpPdf=imps&&imps.length?imps[0].imprese?.impresa_nome||'':''
    // Nome file: Verb_<ultime 4 cifre> - ragione sociale (max 30) - comune - tecnico - data
    const _codePdf=(v.nr_verbale||'').replace(/\D/g,'').slice(-4)||_slugPdf(v.nr_verbale||vid)
    const _ragPdf=_slugPdf(_primaImpPdf).slice(0,30).trim()
    const _comPdf=_slugPdf(comuneLabel)
    const _tecPdf=_slugPdf([v.tecnici?.tecnico_nome,v.tecnici?.tecnico_cognome].filter(Boolean).join(' '))
    const _dPdf=v.data_visita?new Date(v.data_visita+'T00:00:00'):null
    const _dataFPdf=_dPdf&&!isNaN(_dPdf)?`${String(_dPdf.getDate()).padStart(2,'0')}-${String(_dPdf.getMonth()+1).padStart(2,'0')}-${_dPdf.getFullYear()}`:''
    const _pdfName=[`Verb_${_codePdf}`,_ragPdf,_comPdf,_tecPdf,_dataFPdf].filter(Boolean).join(' - ')+'.pdf'
    doc.save(_pdfName)
    toast('PDF generato','ok')
    _uploadPdfDrive(pdfB64)   // upload in background
  }catch(e){toast('Errore PDF: '+e.message,'err');console.error(e)}
  finally{_pdfInProgress=false}
}
"""

# il nome file e il regex dello slug devono restare quelli di prima
for pezzo in [r"const _slugPdf=s=>(s||'').replace(/[\\/:*?" + '"' + r"<>|]/g,'')","const _pdfName=[`Verb_${_codePdf}`", "return doc.output('datauristring')"]:
    assert pezzo in vecchia and pezzo in NUOVA, pezzo

s = s[:i] + NUOVA + "\n" + s[j:]

rep('<script src="manuali.js"></script>\n',
    '<script src="manuali.js"></script>\n'
    '<!-- verbale di sopralluogo in PDF, stile «ciclo con rilievi»: genPDF carica dati e immagini, qui il disegno -->\n'
    '<script src="verbale-pdf.js?v=1"></script>\n')

out = s.replace("\n", "\r\n") if crlf else s
P.write_bytes(out.encode("utf-8"))
print("ok", bak.name, len(raw), "->", len(out.encode("utf-8")), "crlf" if crlf else "lf", "| genPDF righe:", vecchia.count("\n"), "->", NUOVA.count("\n"))
