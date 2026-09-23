# -*- coding: utf-8 -*-
"""23/09/2026 - Letture che si fermavano a 1.000 righe.

Il server Supabase non restituisce piu' di 1.000 righe per lettura, qualunque
.limit() si chieda. La mappa dei cantieri attivi leggeva con .limit(3000) e
riceveva 1.000 cantieri su 5.309: l'elenco sotto (a blocchi) li vedeva tutti.
Stessa trappola in altri quattro punti. Qui si passa tutto da sbTutte(), che
legge a blocchi da 1.000 fino alla fine, con un ordinamento che non lascia
buchi o doppioni fra un blocco e l'altro.
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

# 1. Mappa cantieri attivi
sost("""  const{data,error}=await sb.from('cantieri')
    .select('cantiere_id,cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome,lat,lng,geocode_status,cantiere_importo,cantiere_tip_ope,cantiere_tip_ope_altro,data_ult,cantiere_descrizione')
    .eq('elimina',0).not('cantiere_chiuso','is',true).not('lat','is',null).limit(3000)
  if(error){console.error('loadCantMap:',error);return}
""", """  /* A blocchi fino alla fine (23/09/2026): il server non da' piu' di 1.000 righe per lettura, e con
     .limit(3000) la mappa riceveva 1.000 cantieri attivi su 5.300 - l'elenco sotto li vedeva tutti,
     la mappa no (Casalserugo: pochi pin in mappa, molti in elenco). Ordine per id: blocchi senza buchi. */
  let data
  try{
    data=await sbTutte((da,a)=>sb.from('cantieri')
      .select('cantiere_id,cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome,lat,lng,geocode_status,cantiere_importo,cantiere_tip_ope,cantiere_tip_ope_altro,data_ult,cantiere_descrizione')
      .eq('elimina',0).not('cantiere_chiuso','is',true).not('lat','is',null).order('cantiere_id').range(da,a))
  }catch(error){console.error('loadCantMap:',error);toast('Mappa: non sono riuscito a leggere i cantieri ('+(error.message||error)+')','err');return}
""", 'mappa attivi')

# 2. Conteggio visite per cantiere nella stessa mappa (2.346 visite, ne leggeva 1.000)
sost("""    const{data:_vv}=await sb.from('visite').select('cantiere_id').eq('elimina',0).limit(10000)
    const _nv={};(_vv||[]).forEach(v=>{if(v.cantiere_id)_nv[v.cantiere_id]=(_nv[v.cantiere_id]||0)+1})
    rows.forEach(r=>r.n_visite=_nv[r.cantiere_id]||0)
  }catch(_e){rows.forEach(r=>r.n_visite=0)}""", """    const _vv=await sbTutte((da,a)=>sb.from('visite').select('cantiere_id').eq('elimina',0).order('visita_id').range(da,a))
    const _nv={};(_vv||[]).forEach(v=>{if(v.cantiere_id)_nv[v.cantiere_id]=(_nv[v.cantiere_id]||0)+1})
    rows.forEach(r=>r.n_visite=_nv[r.cantiere_id]||0)
  }catch(_e){console.warn('mappa, conteggio visite:',_e);toast('Mappa: conteggio delle visite non riuscito, il filtro Visite non è affidabile','warn');rows.forEach(r=>r.n_visite=0)}""", 'mappa visite')

# 3. Mappa della dashboard (1.172 righe, ne leggeva 1.000)
sost("""  const{data,error}=await sb.from('v_mappa_cantieri')
    .select('cantiere_id,lat,lng,ipc,geocode_status,indirizzo,comune_nome,tecnico,data_visita,nr_verbale')
  if(error){console.error('v_mappa_cantieri:',error);return}
""", """  let data  // a blocchi (23/09/2026): 1.172 cantieri visitati, una lettura sola ne dava 1.000
  try{
    data=await sbTutte((da,a)=>sb.from('v_mappa_cantieri')
      .select('cantiere_id,lat,lng,ipc,geocode_status,indirizzo,comune_nome,tecnico,data_visita,nr_verbale')
      .order('cantiere_id').order('nr_verbale').range(da,a))
  }catch(error){console.error('v_mappa_cantieri:',error);toast('Mappa: non sono riuscito a leggere i cantieri visitati','err');return}
""", 'mappa dashboard')

# 4. Controllo duplicati CNCE (4.731 cantieri CNCE, ne controllava 1.000)
sost("""  const{data,error}=await sb.from('cantieri').select('cantiere_id,cantiere_cnce,lotto,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_etichetta,created_at').eq('elimina',0).ilike('cantiere_cnce','CNCE%').limit(10000)
  if(error){box.innerHTML='';toast('Errore: '+error.message,'err');return}
""", """  let data  // a blocchi (23/09/2026): 4.731 cantieri CNCE, una lettura sola ne controllava 1.000 e diceva «nessun duplicato»
  try{
    data=await sbTutte((da,a)=>sb.from('cantieri').select('cantiere_id,cantiere_cnce,lotto,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_etichetta,created_at').eq('elimina',0).ilike('cantiere_cnce','CNCE%').order('cantiere_id').range(da,a))
  }catch(error){box.innerHTML='';toast('Errore: '+(error.message||error),'err');return}
""", 'duplicati CNCE')

# 5. Cantieri senza CNCE (1.114, ne mostrava 1.000)
sost("""  const{data:senza,error}=await sb.from('cantieri').select('cantiere_id,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_cap,cantiere_etichetta,cantiere_comune_cod,cantiere_committente_id').eq('elimina',0).is('cantiere_cnce',null).order('comune_nome')
""", """  let senza=null,error=null  // a blocchi (23/09/2026): 1.114 cantieri senza CNCE, una lettura sola ne dava 1.000
  try{
    senza=await sbTutte((da,a)=>sb.from('cantieri').select('cantiere_id,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_cap,cantiere_etichetta,cantiere_comune_cod,cantiere_committente_id').eq('elimina',0).is('cantiere_cnce',null).order('comune_nome').order('cantiere_id').range(da,a))
  }catch(e){error=e}
""", 'senza CNCE')

# 6. Elenco cantieri: gia' a blocchi, ma per updated_at, che si ripete sui salvataggi di massa:
#    a parita' di valore l'ordine non e' fisso e un cantiere puo' cadere fra due blocchi.
sost(""".eq('elimina',0).order('updated_at',{ascending:false}).range(_fromC,_fromC+999)""",
     """.eq('elimina',0).order('updated_at',{ascending:false}).order('cantiere_id').range(_fromC,_fromC+999)""", 'elenco cantieri')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))

# 7. Riepilogo verbali: checklist a gruppi di 200 visite, fino a ~300 righe per visita
R = 'riepilogo-verbali.js'
r = io.open(R, encoding='utf-8', newline='').read()
vecchio = """    for (let i = 0; i < ids.length; i += 200) {        /* Supabase dà al massimo 1.000 righe per lettura */
      const { data, error: e2 } = await radice.sb.from('visite_checklist')
        .select('visita_id, codice, valore, nota').in('visita_id', ids.slice(i, i + 200)).limit(20000);
      if (e2) throw e2;
      righeChk.push(...(data || []));
    }"""
nuovo = """    /* Supabase dà al massimo 1.000 righe per lettura, e una visita ha fino a ~300 righe di checklist:
       spezzare le visite a gruppi non basta, ogni gruppo va letto a blocchi (23/09/2026). */
    for (let i = 0; i < ids.length; i += 50) {
      for (let da = 0; ; da += 1000) {
        const { data, error: e2 } = await radice.sb.from('visite_checklist')
          .select('visita_id, codice, valore, nota').in('visita_id', ids.slice(i, i + 50))
          .order('id').range(da, da + 999);
        if (e2) throw e2;
        righeChk.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }"""
if CRLF in r:
    vecchio = vecchio.replace(LF, CRLF); nuovo = nuovo.replace(LF, CRLF)
assert r.count(vecchio) == 1, 'riepilogo: occorrenze %d' % r.count(vecchio)
r = r.replace(vecchio, nuovo)
io.open(R, 'w', encoding='utf-8', newline='').write(r)
print('riepilogo-verbali.js aggiornato')
