# -*- coding: utf-8 -*-
"""23/09/2026 - Imprese del verbale: resta aperta quella su cui si lavora.

Chiesto dall'utente: con «+ Aggiungi impresa» la nuova si apriva chiusa e
sembrava che non si riuscisse a inserirla. Causa: a ogni ridisegno si apriva
sempre e solo la prima (idx===0), anche dopo aver scelto un'impresa dai
suggerimenti. Ora si ricorda quale e' aperta (S._impOpen): aggiungendo, si
chiude quella sopra, si apre la nuova, il cursore va sulla ragione sociale e
la pagina ci scorre sopra. Cliccando l'intestazione di un'altra impresa si
apre quella e si chiudono le altre; cliccando quella aperta si chiude.
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

# verbale nuovo e verbale ricaricato: si riparte dalla principale
sost("""  S.fd={}; S.checklist={}; S.noteChk={}; S.imprese=[]; S.lavorazioni=[]; S.savedId=null; S.foto={}""",
     """  S.fd={}; S.checklist={}; S.noteChk={}; S.imprese=[]; S.lavorazioni=[]; S.savedId=null; S.foto={}; S._impOpen=0""", 'initForm')
sost("""  S.imprese=(snap.imprese||[]).map((im,i)=>({...im,is_principale:i===0}))
""", """  S.imprese=(snap.imprese||[]).map((im,i)=>({...im,is_principale:i===0}))
  S._impOpen=0
""", 'snap')

# intestazione: apre questa e chiude le altre; sulla aperta la chiude
sost("""  wrap.querySelectorAll('.imp-acc-header').forEach(h=>{
    h.onclick=()=>{
      const body=h.nextElementSibling
      body.classList.toggle('open')
    }
  })""", """  wrap.querySelectorAll('.imp-acc-header').forEach(h=>{
    h.onclick=()=>{
      const i=+h.dataset.impIdx
      const apri=!h.nextElementSibling.classList.contains('open')
      wrap.querySelectorAll('.imp-acc-body').forEach(b=>b.classList.remove('open'))
      if(apri)h.nextElementSibling.classList.add('open')
      S._impOpen=apri?i:-1
    }
  })""", 'header')

# scelta dai suggerimenti: resta aperta l'impresa appena scelta
sost("""      $(`im-search-${idx}`).value=item.label
      renderImpreseAccordion()""", """      $(`im-search-${idx}`).value=item.label
      S._impOpen=idx
      renderImpreseAccordion()""", 'autocomplete')

# rimozione: se si toglie quella aperta, si apre la precedente
sost("""      S.imprese.splice(idx,1)
      renderImpreseAccordion()""", """      S.imprese.splice(idx,1)
      if(S._impOpen===idx)S._impOpen=idx-1
      else if(S._impOpen>idx)S._impOpen--
      renderImpreseAccordion()""", 'remove')

# HTML: aperta quella su cui si lavora
sost("""    <div class="imp-acc-header">
      <span class="imp-name">""", """    <div class="imp-acc-header" data-imp-idx="${idx}">
      <span class="imp-name">""", 'data idx')
sost("""    <div class="imp-acc-body${idx===0?' open':''}">""",
     """    <div class="imp-acc-body${idx===(S._impOpen==null?0:S._impOpen)?' open':''}">""", 'open')

# + Aggiungi impresa: chiude la sopra, apre la nuova, cursore e scorrimento
sost("""  S.imprese.push({impresa_id:'',impresa_nome:'',piva:'',cf_imp:'',ind_imp:'',com_imp:'',att:'',capo_nome:'',capo_cog:'',badge:'',pat:'',note_fasilav:'',tipo_imp:'',certif:[],ceiv:'',stage_imp:'',is_principale:false,nr_lav:0,nr_lav_str:0})
  renderImpreseAccordion()
}""", """  S.imprese.push({impresa_id:'',impresa_nome:'',piva:'',cf_imp:'',ind_imp:'',com_imp:'',att:'',capo_nome:'',capo_cog:'',badge:'',pat:'',note_fasilav:'',tipo_imp:'',certif:[],ceiv:'',stage_imp:'',is_principale:false,nr_lav:0,nr_lav_str:0})
  const _nuova=S.imprese.length-1
  S._impOpen=_nuova
  renderImpreseAccordion()
  const _in=$(`im-search-${_nuova}`)
  if(_in){try{_in.scrollIntoView({behavior:'smooth',block:'center'})}catch(_e){};_in.focus({preventScroll:true})}
}""", 'add')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
