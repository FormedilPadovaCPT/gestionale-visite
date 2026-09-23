# -*- coding: utf-8 -*-
"""23/09/2026 - Invio del verbale: testo in sola lettura, indirizzi aggiunti a
mano, e nell'elenco Visite si vede se il verbale e' stato inviato.

Chiesto dall'utente.
1. Il testo nella finestra NON e' mai stato spedito: la mail la compone la
   funzione send-verbale sul server. Chi lo modificava credeva di cambiare la
   mail. Ora e' un'anteprima in sola lettura, allineata al testo vero, e si
   ricalcola a ogni apertura (prima, aprendo dal verbale, restava quello di
   un verbale precedente).
2. «Aggiungi un altro indirizzo»: oltre alle figure del verbale; gli
   aggiunti si tolgono con ✕. Partono con gli altri e finiscono nel registro
   dell'invio (verbali.dest, ruolo «Aggiunto»).
3. Nell'elenco Visite, sotto lo stato: «📧 inviato il gg/mm» se l'invio e'
   registrato; «📧 inviato» per le visite fino al 30/09/2026 (partite col
   modulo Google, parola dell'utente); «✉️ da inviare» per i definitivi dal
   1/10 senza invio. Le bozze niente.
"""
import io, re

CRLF = chr(13) + chr(10)
LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome, n=1):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == n, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)

# ── HTML ──
sost("""    <div id="email-verbale-list" style="margin-bottom:14px;max-height:220px;overflow-y:auto"></div>
""", """    <div id="email-verbale-list" style="margin-bottom:8px;max-height:220px;overflow-y:auto"></div>
    <div style="display:flex;gap:6px;margin-bottom:14px">
      <input type="email" id="ev-extra" placeholder="Aggiungi un altro indirizzo email…" style="flex:1;min-width:0" autocomplete="off">
      <button type="button" class="btn-outline btn-sm" id="btn-ev-extra" style="white-space:nowrap">+ Aggiungi</button>
    </div>
""", 'html extra')
sost("""      <label>Testo della comunicazione <span style="font-weight:400;font-size:11px;color:#aaa">(modificabile prima dell'invio)</span></label>
      <textarea id="email-verbale-testo" rows="12" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px;resize:vertical;line-height:1.5" placeholder="Spett.le impresa…"></textarea>""",
     """      <label>Testo della comunicazione <span style="font-weight:400;font-size:11px;color:#aaa">(anteprima: è il testo standard dell'ente e non si modifica)</span></label>
      <textarea id="email-verbale-testo" rows="12" readonly style="width:100%;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px;resize:vertical;line-height:1.5;background:#f8f8f8;color:#444" placeholder="Spett.le impresa…"></textarea>""", 'html testo')

# ── lista destinatari: ✕ sugli aggiunti ──
sost("""        :`<span style="color:var(--orange);font-size:12px">${esc(e.email)}</span>`}
    </div>`).join('')""", """        :`<span style="color:var(--orange);font-size:12px">${esc(e.email)}</span>`}
      ${e.extra?`<button type="button" class="btn-outline btn-sm" onclick="window._evTogli(${i})" title="Togli questo indirizzo" style="padding:2px 8px">✕</button>`:''}
    </div>`).join('')""", 'lista x')

# ── funzioni: anteprima, aggiunta, stato invio ──
sost("""async function _evArricchisciAlt(emails){""", """/* Anteprima del testo che parte davvero: e' la copia di quello composto dalla
   funzione send-verbale (supabase/functions/send-verbale/index.ts). Se cambia
   il testo la', va cambiato anche qui. (23/09/2026) */
function _evAnteprima(){
  const el=$('email-verbale-testo');if(!el)return
  const c=window._evContext||{},r=window._evRettifica
  const due=!!(c.tecnico&&c.tecnico2)
  const cant=[c.cantIndirizzo,c.comune].filter(Boolean).join(' – ')||c.comune||c.cantiere||''
  const righe=[`Spett.le impresa${c.impresa?'\\n'+c.impresa:''}`,'',`Prevenzione Infortuni${r?' – RETTIFICA VERBALE':''}`,'',
    'Alla cortese attenzione del','Responsabile del Servizio di Prevenzione e Protezione','e/o del','Coordinatore per la Sicurezza','']
  if(cant)righe.push('Cantiere di '+cant,'')
  if(r){
    righe.push(`Con la presente Vi comunichiamo che il verbale ${c.nr_verbale?'n. '+c.nr_verbale+' ':''}relativo alla visita effettuata${c.dataVisita?' il '+c.dataVisita:''} nel cantiere in oggetto, già trasmesso${r.dataPrimoInvio?' in data '+r.dataPrimoInvio:''}, è stato rettificato.`,'')
    if((r.modifiche||[]).length)righe.push('Modifiche apportate:',...r.modifiche.map(m=>'• '+m),'')
    if(r.note)righe.push('Note: '+r.note,'')
    righe.push('Vi trasmettiamo in allegato il verbale rettificato, che sostituisce integralmente quello precedentemente inviato, da ritenersi privo di validità.','',
      'Ci scusiamo per l\\'inconveniente e rimaniamo a disposizione per ogni eventuale chiarimento.','','Distinti saluti.')
  }else{
    const nomi=due?`, ${c.tecnico} e ${c.tecnico2}`:(c.tecnico?`, ${c.tecnico}`:'')
    righe.push(`${c.dataVisita?'Il giorno '+c.dataVisita+' '+(due?'sono passati':'è passato'):(due?'Sono passati':'È passato')} nel vostro cantiere in oggetto, per fornirvi utili consigli in materia di prevenzione infortuni, ${due?'i nostri tecnici':'uno dei nostri tecnici'}${nomi}.`,'',
      `${due?'Essi si sono soffermati':'Egli si è soffermato'} ad illustrare al Vostro personale in cantiere le più importanti norme che devono essere tenute presenti per garantire la sicurezza durante le varie fasi lavorative, con particolare riferimento a quelle in corso.`,'',
      'In base a quanto previsto dalle norme che regolano il funzionamento dello scrivente Comitato Paritetico Territoriale, potrà essere effettuata entro breve termine una successiva visita, per constatare che i consigli forniti siano stati correttamente attuati.','',
      `Vi trasmettiamo in allegato il rapporto di visita redatto ${due?'dai nostri Tecnici':'dal nostro Tecnico'} in cantiere.`,'',
      'Evidenziamo che la consulenza che è stata resa alla Vostra impresa è per Voi totalmente gratuita, grazie al contributo versato da imprese e lavoratori iscritti a C.E.I.V.','',
      'L\\'iscrizione a C.E.I.V. offre molti altri vantaggi, come ad esempio la possibilità di accedere alla formazione obbligatoria ex D.Lgs 81/2008, che Formedil Padova offre a tariffe agevolate.','',
      'Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.','',
      '[Riquadro «Com\\'è andata la visita?» con il pulsante «Valuta la visita →»]')
  }
  const cw=$('ev-campagna-wrap')
  if(!r&&cw&&cw.style.display!=='none')righe.push('','[Campagna informativa attiva: '+($('ev-campagna-nome')?.textContent||'')+' — dove va lo decide la tendina qui sopra]')
  righe.push('','Renato Squizzato','Area Sicurezza e Salute | FORMEDIL PADOVA','Via Basilicata 10 – 35127 Padova (PD)','email: cpt@formedilpadova.it','Tel. 049 - 761168 (int.4)','URL: www.formedilpadova.it',
    '[Pulsante «I nostri servizi →»]','','In allegato: il verbale in PDF.')
  el.value=righe.join('\\n')
}
/* indirizzi aggiunti a mano, oltre alle figure del verbale (23/09/2026) */
function _evExtraReset(){const i=$('ev-extra');if(i)i.value=''}
function _evAggiungi(){
  const i=$('ev-extra');if(!i)return
  const em=i.value.trim().toLowerCase()
  if(!em)return
  if(!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(em)){toast('Indirizzo non valido: controlla com\\'è scritto','warn');i.focus();return}
  const list=window._evEmails||(window._evEmails=[])
  if(list.some(e=>String(e.email||'').trim().toLowerCase()===em)){toast('Questo indirizzo è già fra i destinatari','warn');return}
  list.push({ruolo:'Aggiunto',nome:'Indirizzo aggiunto a mano',email:em,extra:true})
  i.value='';_evRenderList();i.focus()
}
window._evTogli=function(idx){const l=window._evEmails||[];if(l[idx]&&l[idx].extra){l.splice(idx,1);_evRenderList()}}
/* stato dell'invio nell'elenco Visite (23/09/2026) */
let _invMap={}
async function _caricaInvii(ids){
  const m={}
  for(let i=0;i<ids.length;i+=200){
    const{data,error}=await sb.from('verbali').select('visita_id,inviato_at').eq('inviato_email',true).in('visita_id',ids.slice(i,i+200)).order('inviato_at',{ascending:false}).limit(1000)
    if(error)throw error
    ;(data||[]).forEach(r=>{if(!m[r.visita_id])m[r.visita_id]=r.inviato_at})
  }
  _invMap=m
}
const _FINE_MODULO_GOOGLE='2026-09-30'   // fino a qui i verbali partivano col modulo Google
function _invCell(v){
  if(+v.elimina===1||(v.stato||'bozza')==='bozza')return ''
  const at=_invMap[v.visita_id]
  if(at){const d=new Date(at);return `<div style="font-size:10px;color:#2e7d32;margin-top:3px;white-space:nowrap" title="Inviato dal gestionale il ${d.toLocaleString('it-IT')}">📧 inviato il ${d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})}</div>`}
  if(String(v.data_visita||'')<=_FINE_MODULO_GOOGLE)return `<div style="font-size:10px;color:#2e7d32;margin-top:3px;white-space:nowrap" title="Visita fino al 30/09/2026: il verbale è partito col modulo Google">📧 inviato</div>`
  return `<div style="font-size:10px;color:#c0392b;margin-top:3px;white-space:nowrap;font-weight:600" title="Verbale definitivo non ancora inviato all'impresa: usa il pulsante 📧">✉️ da inviare</div>`
}
async function _evArricchisciAlt(emails){""", 'funzioni')

# prima di ogni apertura della finestra: anteprima e casella degli aggiunti
c = src.count("show('modal-email-verbale')")
assert c == 3, c
src = src.replace("show('modal-email-verbale')", "_evAnteprima();_evExtraReset();show('modal-email-verbale')")

# pulsante e Invio nella casella
sost("""$('btn-ev-close').onclick=()=>{""", """$('btn-ev-extra').onclick=_evAggiungi
$('ev-extra').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();_evAggiungi()}}
$('btn-ev-close').onclick=()=>{""", 'bind extra')

# campagna: se cambia la tendina, l'anteprima si aggiorna
# (non indispensabile: l'anteprima la dice comunque)

# dopo l'invio riuscito: l'elenco Visite si aggiorna
sost("""    window._evRettifica=null
    _setEvModalRett(false)
    setTimeout(()=>hide('modal-email-verbale'), 2000)""", """    window._evRettifica=null
    _setEvModalRett(false)
    setTimeout(()=>hide('modal-email-verbale'), 2000)
    if(!$('view-lista')?.classList.contains('hidden'))loadLista().catch(()=>{})""", 'dopo invio')

# elenco Visite: stato dell'invio
sost("""  const tbody=$('tbody-lista')
  if(!vs.length){tbody.innerHTML='';show('lista-empty')}""", """  try{await _caricaInvii(vs.map(v=>v.visita_id))}
  catch(e){console.warn('stato invii:',e);_invMap={};toast('Non sono riuscito a leggere quali verbali sono stati inviati','warn')}
  const tbody=$('tbody-lista')
  if(!vs.length){tbody.innerHTML='';show('lista-empty')}""", 'lista carica')
sost("""    <td><span class="badge badge-${v.stato||'bozza'}">${v.stato||'bozza'}</span></td>
    <td><div class="tbl-actions">${actions}</div></td>""", """    <td><span class="badge badge-${v.stato||'bozza'}">${v.stato||'bozza'}</span>${_invCell(v)}</td>
    <td><div class="tbl-actions">${actions}</div></td>""", 'riga')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
