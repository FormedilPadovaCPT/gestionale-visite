# -*- coding: utf-8 -*-
"""25/09/2026 - La formazione mancante rilevata in cantiere diventa lavoro per
l'ufficio corsi e un'offerta per l'impresa (idea dell'utente).

Nel verbale, accanto a «Contattare l'ufficio corsi», il tecnico spunta QUALE
formazione manca (elenco breve, da formazione_tipi). Quando manda il verbale,
la mail all'impresa porta le prossime date dei corsi con le quote vere
(gratuito o quanto costa, per le imprese CEIV e per le altre) e all'ufficio
corsi parte da sola una mail con i dati dell'impresa: lo fa la edge function
send-verbale, che riceve `formazione` nel body.
"""
import io

CRLF = chr(13) + chr(10); LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read(); n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome, quante=1):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == quante, '%s: trovate %d occorrenze (attese %d)' % (nome, c, quante)
    src = src.replace(vecchio, nuovo)

# 1. il modulo: le voci da spuntare accanto alla casella
sost("""          <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-note-for-sn"> Contattare l'ufficio corsi per regolarizzare la formazione mancante</span></label></div>
          <div class="field"><label>Note sulla formazione mancante</label><textarea id="f-note-for-m" rows="2"></textarea></div>""",
     """          <div class="field"><label><span class="check-inline"><input type="checkbox" id="f-note-for-sn"> Contattare l'ufficio corsi per regolarizzare la formazione mancante</span></label></div>
          <!-- quale formazione manca (25/09/2026): elenco breve da formazione_tipi. Con la casella
               spuntata, la mail del verbale propone le date dei corsi e l'ufficio corsi riceve la segnalazione -->
          <div class="field" id="fld-note-for-tipi"><label>Quale formazione manca? <span style="font-weight:400;text-transform:none;letter-spacing:0">(spunta una o più voci: con la casella qui sopra, l'impresa riceve nella mail del verbale le prossime date dei corsi e l'ufficio corsi viene avvisato)</span></label>
            <div id="f-note-for-tipi" class="chips-tipi"><span style="font-size:12px;color:#888">Carico l'elenco…</span></div></div>
          <div class="field"><label>Note sulla formazione mancante</label><textarea id="f-note-for-m" rows="2" placeholder="Es. solo il titolare ha il primo soccorso, e non sta in cantiere"></textarea></div>""", 'modulo')

sost("""body.viewer-mode #btn-diniego-dash{display:none!important}
""", """body.viewer-mode #btn-diniego-dash{display:none!important}
.chips-tipi{display:flex;flex-wrap:wrap;gap:6px}.chips-tipi label{display:inline-flex;align-items:center;gap:6px;margin:0;padding:6px 10px;border:1px solid #ddd;border-radius:18px;font-size:12.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#333;background:#fff;cursor:pointer}.chips-tipi label:has(input:checked){border-color:#e7500f;background:#fff3ec;color:#b33a00}.chips-tipi input{width:auto!important;min-width:0!important;margin:0!important}
""", 'css chips')

# 2. le funzioni: elenco tipi, lettura/scrittura delle spunte, il pacchetto per la mail
sost("""async function loadAutorizzazioni(){""", """// ── FORMAZIONE MANCANTE (25/09/2026) ──────────────────────────────
// L'elenco breve dei tipi lo dice la tabella formazione_tipi (la segreteria
// lo cambia lì, non qui). _tipiSel/_tipiSet leggono e scrivono le spunte del
// modulo; _evFormazioneCalc prepara il pacchetto che send-verbale usa per
// scrivere all'impresa le date dei corsi e all'ufficio corsi la segnalazione.
let _TIPI_FORM=null
async function _tipiFormazione(){
  if(_TIPI_FORM)return _TIPI_FORM
  const{data,error}=await sb.from('formazione_tipi').select('codice,etichetta,ordine').eq('attivo',true).order('ordine')
  if(error){console.warn('formazione_tipi:',error.message);return []}
  _TIPI_FORM=data||[];return _TIPI_FORM
}
const _tipiLabel=c=>{const t=(_TIPI_FORM||[]).find(x=>x.codice===c);return t?t.etichetta:c}
async function formTipiInit(){
  const box=$('f-note-for-tipi');if(!box)return
  const tipi=await _tipiFormazione()
  box.innerHTML=tipi.length?tipi.map(t=>`<label><input type="checkbox" value="${esc(t.codice)}"> ${esc(t.etichetta)}</label>`).join('')
    :'<span style="font-size:12px;color:#c0392b">Non sono riuscito a leggere l\\'elenco dei corsi: scrivi la formazione mancante nelle note.</span>'
  box.addEventListener('change',()=>{const sn=$('f-note-for-sn');if(sn&&_tipiSel()&&!sn.checked)sn.checked=true})   // spuntare un corso vuol dire contattare l'ufficio corsi
}
const _tipiSel=()=>{const v=[...document.querySelectorAll('#f-note-for-tipi input:checked')].map(i=>i.value);return v.length?v:null}
const _tipiSet=arr=>{document.querySelectorAll('#f-note-for-tipi input').forEach(i=>{i.checked=!!(arr||[]).includes(i.value)})}
/* il pacchetto per send-verbale: chi è l'impresa, chi c'era in cantiere, che cosa manca */
function _evFormazioneCalc(o){
  if(!o||!o.sn)return null
  const tipi=o.tipi||[]
  if(!tipi.length&&!(o.nota||'').trim())return null
  return{tipi,tipi_etichette:tipi.map(_tipiLabel),nota:(o.nota||'').trim()||null,
    ceiv:o.ceiv||'da_verificare',impresa:o.impresa||null,partita_iva:o.piva||null,impresa_id:o.impresa_id||null,
    impresa_email:o.impresa_email||null,impresa_tel:o.impresa_tel||null,
    referente:o.referente||null,referente_tel:o.referente_tel||null,tecnico_id:o.tecnico_id||null}
}
window._evFormazione=null
const _ceivDa=(cassa,stato)=>{const c=String(cassa||'').toLowerCase(),s=String(stato||'').toLowerCase()
  if(c==='si'||c==='sì'||c==='true'||/attiv/.test(s))return 'si'
  if(c==='no'||c==='false'||/cess|sospes/.test(s))return 'no'
  return 'da_verificare'}
/* nell'anteprima della mail: che cosa aggiungerà l'app (le date e le quote le legge dal calendario corsi) */
function _evFormazioneTesto(){
  const f=window._evFormazione;if(!f)return []
  return ['','[Formazione: possiamo aiutarvi]',`Durante la visita il nostro tecnico ha rilevato che manca o va aggiornata la formazione per: ${f.tipi_etichette.join(', ')||'vedi nota'}.${f.nota?' — '+f.nota:''}`,
    `[L'app aggiunge qui le prossime date in programma dei corsi con la quota: ${f.ceiv==='si'?'gratuito o scontato per la Vostra impresa iscritta CEIV, con il prezzo di listino che risparmiate':'quota di listino, e quanto costerebbe con l\\'iscrizione alla Cassa Edile'}. L'ufficio corsi riceve la segnalazione con i contatti dell'impresa.]`]
}

async function loadAutorizzazioni(){""", 'funzioni formazione')

# 3. all'avvio, l'elenco nel modulo
sost("""  populateComuniSelect()
  loadFirmeCache()""", """  populateComuniSelect()
  formTipiInit().catch(e=>console.warn('formTipiInit:',e))
  loadFirmeCache()""", 'init')

# 4. salvataggio e caricamento
sost("""      note_for_sn:cGet('f-note-for-sn'),
      note_for_m:vGet('f-note-for-m')||null,
      segnalazione:cGet('f-segnalazione'),""", """      note_for_sn:cGet('f-note-for-sn'),
      note_for_m:vGet('f-note-for-m')||null,
      note_for_tipi:_tipiSel(),
      segnalazione:cGet('f-segnalazione'),""", 'salva 1')
sost("""    note_for_sn:cGet('f-note-for-sn'),
    note_for_m:vGet('f-note-for-m')||null,
    segnalazione:cGet('f-segnalazione'),""", """    note_for_sn:cGet('f-note-for-sn'),
    note_for_m:vGet('f-note-for-m')||null,
    note_for_tipi:_tipiSel(),
    segnalazione:cGet('f-segnalazione'),""", 'salva 2')
sost("""  if(snap.note_for_m)vSet('f-note-for-m',snap.note_for_m)""", """  if(snap.note_for_m)vSet('f-note-for-m',snap.note_for_m)
  _tipiFormazione().then(()=>{if($('f-note-for-tipi')&&!$('f-note-for-tipi').querySelector('input'))return formTipiInit()}).then(()=>_tipiSet(snap.note_for_tipi||[])).catch(()=>{})""", 'carica')
sost("""note_for_sn:v.note_for_sn||false,note_for_m:v.note_for_m||null,""", """note_for_sn:v.note_for_sn||false,note_for_m:v.note_for_m||null,note_for_tipi:v.note_for_tipi||null,""", 'rebuild', quante=3)
sost("""        oss_tec_int,note_for_sn,note_for_m,segnalazione,data_ritorno,""", """        oss_tec_int,note_for_sn,note_for_m,note_for_tipi,segnalazione,data_ritorno,""", 'select dettaglio')
sost("""      if(v.note_for_sn===true||v.note_for_m?.trim())_int.push(`<div style="margin-bottom:6px"><b>Formazione mancante</b>${v.note_for_sn===true?' — da segnalare all\\'ufficio corsi':''}""",
     """      if(v.note_for_sn===true||v.note_for_m?.trim()||(v.note_for_tipi||[]).length)_int.push(`<div style="margin-bottom:6px"><b>Formazione mancante</b>${v.note_for_sn===true?' — da segnalare all\\'ufficio corsi':''}${(v.note_for_tipi||[]).length?' — '+esc(v.note_for_tipi.map(_tipiLabel).join(', ')):''}""", 'dettaglio interno')

# 5. mail dall'elenco: i dati per la segnalazione
sost("""    visita_id,nr_verbale,data_visita,tecnico2_id,
    comm_nome,comm_cog,comm_rag_soc,comm_tipo_sogg,comm_email,""", """    visita_id,nr_verbale,data_visita,tecnico2_id,tecnico_id,
    note_for_sn,note_for_m,note_for_tipi,ppre_titolo,ppre_nome,ppre_cog,ppre_qualifica,ppre_tel,
    comm_nome,comm_cog,comm_rag_soc,comm_tipo_sogg,comm_email,""", 'select mail elenco')
sost("""  const{data:impRows}=await sb.from('visite_imprese_presenti').select('impresa_id,imprese(impresa_nome,impresa_email_ref)').eq('visita_id',vid).order('ordine')""",
     """  const{data:impRows}=await sb.from('visite_imprese_presenti').select('impresa_id,is_principale,imprese(impresa_nome,impresa_email_ref,impresa_telefono,partita_iva,cassa_edile,stato_cassa)').eq('visita_id',vid).order('ordine')
  // formazione mancante (25/09/2026): il pacchetto per la mail all'impresa e la segnalazione all'ufficio corsi
  {const _pr=(impRows||[]).find(x=>x.is_principale)||(impRows||[])[0]||null,_pi=_pr&&_pr.imprese||{}
   await _tipiFormazione().catch(()=>{})
   window._evFormazione=_evFormazioneCalc({sn:v.note_for_sn===true,tipi:v.note_for_tipi||[],nota:v.note_for_m,
     ceiv:_ceivDa(_pi.cassa_edile,_pi.stato_cassa),impresa:_pi.impresa_nome||null,piva:_pi.partita_iva||null,impresa_id:_pr&&_pr.impresa_id||null,
     impresa_email:(_pi.impresa_email_ref||'').trim()||null,impresa_tel:_pi.impresa_telefono||null,
     referente:[v.ppre_titolo,v.ppre_nome,v.ppre_cog].filter(Boolean).join(' ')+(v.ppre_qualifica?' ('+v.ppre_qualifica+')':'')||null,referente_tel:v.ppre_tel||null,tecnico_id:v.tecnico_id||null})}""", 'imprese mail elenco')

# 6. mail dal modulo (dopo il salvataggio): stessi dati dal modulo
sost("""  const _fImp=(S.imprese&&S.imprese.length?S.imprese[0]?.impresa_nome:'')||''
""", """  const _fImp=(S.imprese&&S.imprese.length?S.imprese[0]?.impresa_nome:'')||''
  // formazione mancante (25/09/2026): dal modulo appena salvato
  // (la funzione non e' asincrona: si calcola subito con quello che c'e', e la lettura
  //  dell'impresa aggiorna il pacchetto appena arriva, prima che il tecnico prema Invia)
  try{const _i0=(S.imprese&&S.imprese[0])||{}
    const _calc=_ir=>{window._evFormazione=_evFormazioneCalc({sn:cGet('f-note-for-sn'),tipi:_tipiSel()||[],nota:vGet('f-note-for-m'),
      ceiv:_ceivDa(_ir.cassa_edile||_i0.ceiv,_ir.stato_cassa),impresa:_i0.impresa_nome||null,piva:_ir.partita_iva||_i0.piva||null,impresa_id:_i0.impresa_id||null,
      impresa_email:(_ir.impresa_email_ref||'').trim()||null,impresa_tel:_ir.impresa_telefono||null,
      referente:[vGet('f-ppre-titolo'),vGet('f-ppre-nome'),vGet('f-ppre-cog')].filter(Boolean).join(' ')+(vGet('f-qual-ppre')?' ('+vGet('f-qual-ppre')+')':'')||null,referente_tel:vGet('f-tel-ppre')||null,tecnico_id:S.tecnico?.tecnico_id||null});_evAnteprima&&_evAnteprima()}
    _calc({})
    _tipiFormazione().then(()=>_calc({})).catch(()=>{})
    if(_i0.impresa_id)sb.from('imprese').select('impresa_email_ref,impresa_telefono,partita_iva,cassa_edile,stato_cassa').eq('impresa_id',_i0.impresa_id).maybeSingle().then(({data:_d})=>_calc(_d||{})).catch(()=>{})
  }catch(e){console.warn('formazione dal modulo:',e);window._evFormazione=null}
""", 'mail dal modulo', quante=2)

# 7. l'anteprima dice che cosa aggiunge l'app
sost("""      'Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.','',
      '[Riquadro «Com\\'è andata la visita?» con il pulsante «Valuta la visita →»]')""",
     """      ..._evFormazioneTesto(),'',
      'Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.','',
      '[Riquadro «Com\\'è andata la visita?» con il pulsante «Valuta la visita →»]')""", 'anteprima')

# 8. il pacchetto parte con la mail
sost("""          rettifica: window._evRettifica||undefined,
          linkValuta,""", """          rettifica: window._evRettifica||undefined,
          formazione: (!window._evRettifica&&window._evFormazione)||undefined,   // 25/09/2026: date dei corsi all'impresa + segnalazione all'ufficio corsi
          linkValuta,""", 'payload')
# e l'esito della segnalazione si dice
sost("""    const nDest=emails.length
    status.style.color='var(--ok)'
    status.textContent=`✅ Inviato a ${nDest} destinatar${nDest===1?'io':'i'}`""",
     """    const nDest=emails.length
    status.style.color='var(--ok)'
    status.textContent=`✅ Inviato a ${nDest} destinatar${nDest===1?'io':'i'}`
    if(data&&data.formazione){const _f=data.formazione;if(_f.ufficio_corsi==='inviata')toast('Segnalazione di formazione mancante inviata all\\'ufficio corsi ✓','ok');else if(_f.errore)toast('Mail all\\'impresa inviata, ma la segnalazione all\\'ufficio corsi NON è partita: '+_f.errore,'warn',8000)}""", 'esito')

assert src.rstrip().endswith('</html>')
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d byte' % (n0, len(src)))

# ── aiuto.js ──
P3 = 'aiuto.js'; a = io.open(P3, encoding='utf-8', newline='').read(); N3 = CRLF if CRLF in a else LF
v = "  'v:direzione':"
assert a.count(v) == 1
a = a.replace(v, """  'f-note-for-sn': 'Con la casella spuntata, quando mandi il verbale l\\'impresa riceve nella stessa mail le prossime date dei corsi che mancano, con la quota vera (gratuita o scontata per le imprese iscritte alla Cassa Edile), e l\\'ufficio corsi riceve da solo una segnalazione con i contatti dell\\'impresa e la tua nota.',
  'f-note-for-tipi': 'Quale formazione manca: spunta una o più voci. Servono a scegliere i corsi da proporre all\\'impresa; la nota qui sotto va all\\'ufficio corsi.',
""".replace(LF, N3) + v)
io.open(P3, 'w', encoding='utf-8', newline='').write(a); print('aiuto.js ok')
