# -*- coding: utf-8 -*-
"""23/09/2026 - Le tendine dei tecnici prendono anche i tecnici nuovi dal database.

Chiesto dall'utente: Barellas, Cuccato e Simonetto (schede create il 21/09)
non comparivano nelle tendine del tecnico, perche' TECNICI_LIST in app-data.js
e' scritto a mano con i sei storici. All'accesso si aggiungono in coda i
tecnici attivi del database che mancano (esclusi i dipendenti d'ufficio e
l'account di prova): i prossimi assunti compaiono da soli. In coda, perche'
le tendine usano la posizione nell'elenco come valore.
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

sost("""  await loadVoci()
  showScr('app')
  populateTecnicoSelect()""", """  await loadVoci()
  showScr('app')
  await aggiungiTecniciDalDb()
  populateTecnicoSelect()""", 'onLogin')

sost("""function populateTecnicoSelect(){""", """/* I tecnici attivi del database che TECNICI_LIST (app-data.js, scritto a mano)
   non conosce ancora: si aggiungono in coda (23/09/2026, Barellas, Cuccato e
   Simonetto non comparivano). Fuori i dipendenti d'ufficio e l'account di prova. */
async function aggiungiTecniciDalDb(){
  try{
    const{data,error}=await sb.from('tecnici').select('tecnico_nome,tecnico_cognome,titolo,email,dipendente')
      .eq('attivo',true).eq('elimina',0).not('email','is',null).order('tecnico_cognome')
    if(error)throw error
    ;(data||[]).forEach(t=>{
      const em=String(t.email||'').trim().toLowerCase()
      if(!em||t.dipendente===true||em.startsWith('prova.'))return
      if(TECNICI_LIST.some(x=>String(x.email||'').toLowerCase()===em))return
      TECNICI_LIST.push({nome:[t.titolo,t.tecnico_nome,t.tecnico_cognome].map(x=>String(x||'').trim()).filter(Boolean).join(' ')||t.email,email:t.email})
    })
  }catch(e){console.warn('tecnici dal database:',e);toast('Tendina tecnici: non sono riuscito a leggere i tecnici nuovi, compaiono solo quelli storici','warn')}
}
function populateTecnicoSelect(){""", 'funzione')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
