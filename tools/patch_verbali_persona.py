"""Scheda persona e inversioni nome/cognome (14/09/2026).

Due ritocchi a index.html, chiesti dall'utente dopo le nomine dai verbali:

1. upsertPersoneVisita cerca la persona anche con nome e cognome scambiati.
   Il database ora corregge al salvataggio le inversioni palesi
   (trg_persone_a_inversione, trg_visite_a_inversione): se il tecnico scrive
   «Triani Stefano» al contrario, la persona puo' esistere gia' nell'ordine
   giusto, e senza questa seconda ricerca ne nascerebbe un doppione.
2. La scheda persona della rubrica mostra i verbali in cui la persona compare
   (CSP, CSE, RL, presente) e per quali imprese, dalla RPC persona_verbali.

Backup index_pre_verbalipersona_<data>.html.bak; ogni sostituzione deve trovare
UNA sola occorrenza (regola del file grande: mai Edit diretto).
"""
import pathlib, shutil, datetime, sys

D = pathlib.Path(__file__).resolve().parent.parent
P = D / "index.html"
raw = P.read_bytes()
crlf = b"\r\n" in raw[:5000]
s = raw.decode("utf-8")
if crlf:
    s = s.replace("\r\n", "\n")

if "persona_verbali" in s:
    print("gia' applicata"); sys.exit(0)

bak = D / f"index_pre_verbalipersona_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak"
shutil.copy2(P, bak)

def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:90])
    s = s.replace(old, new)

# 1. ricerca anche in ordine inverso
rep("""      let qb=sb.from('persone').select('persona_id,titolo,email,email2,email3,telefono,telefono2,qualifica,ruoli').eq('elimina',0).limit(1)
      qb=nome?qb.ilike('nome',nome):qb.is('nome',null)
      qb=cog?qb.ilike('cognome',cog):qb.is('cognome',null)
      const{data:ex}=await qb
""",
"""      const _campiP='persona_id,titolo,email,email2,email3,telefono,telefono2,qualifica,ruoli'
      let qb=sb.from('persone').select(_campiP).eq('elimina',0).limit(1)
      qb=nome?qb.ilike('nome',nome):qb.is('nome',null)
      qb=cog?qb.ilike('cognome',cog):qb.is('cognome',null)
      let{data:ex}=await qb
      // nome e cognome scambiati: il database corregge le inversioni palesi al
      // salvataggio, quindi la persona puo' gia' esistere nell'ordine giusto (14/09/2026)
      if((!ex||!ex.length)&&nome&&cog){
        const _inv=await sb.from('persone').select(_campiP).eq('elimina',0).ilike('nome',cog).ilike('cognome',nome).limit(1)
        ex=_inv.data
      }
""")

# 2. verbali della persona nella scheda rubrica
rep("""      // Rapporti di lavoro: visibili solo a chi è autorizzato lato asseverazione
""",
"""      // Verbali in cui la persona compare (CSP, CSE, RL, presente) e per quali imprese (14/09/2026)
      try{
        const{data:vb}=await sb.rpc('persona_verbali',{p_persona_id:id})
        if(vb&&vb.length){
          const _imp=[]
          vb.forEach(x=>{const k=x.impresa_nome||x.impresa_id||'–';const y=_imp.find(z=>z.k===k);if(y)y.n++;else _imp.push({k,n:1})})
          _imp.sort((a,b)=>b.n-a.n)
          html+=qdSec(`Nei verbali di sopralluogo (${vb.length})`)
          html+=`<div style="font-size:12px;margin:0 0 6px;color:#555;line-height:1.6"><b>Imprese (${_imp.length}):</b> ${_imp.map(z=>esc(z.k)+' ('+z.n+')').join(' · ')}</div>`
          html+='<table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr>'
          html+='<th style="padding:4px 6px;text-align:left;color:#888;font-weight:600;font-size:11px">Data</th>'
          html+='<th style="padding:4px 6px;text-align:left;color:#888;font-weight:600;font-size:11px">Verbale</th>'
          html+='<th style="padding:4px 6px;text-align:left;color:#888;font-weight:600;font-size:11px">Figura</th>'
          html+='<th style="padding:4px 6px;text-align:left;color:#888;font-weight:600;font-size:11px">Impresa</th>'
          html+='<th style="padding:4px 6px;text-align:left;color:#888;font-weight:600;font-size:11px">Cantiere</th>'
          html+='</tr></thead><tbody>'
          vb.forEach(x=>{
            html+=`<tr style="border-top:1px solid #f0f0f0">
              <td style="padding:5px 6px">${x.data_visita?fmtDate(x.data_visita):'–'}</td>
              <td style="padding:5px 6px">${esc(x.nr_verbale||x.visita_id||'–')}</td>
              <td style="padding:5px 6px">${esc(x.figura||'–')}${x.qualifica?`<br><span style="color:#888">${esc(x.qualifica)}</span>`:''}</td>
              <td style="padding:5px 6px">${esc(x.impresa_nome||x.impresa_id||'–')}</td>
              <td style="padding:5px 6px">${esc([x.indirizzo,x.comune].filter(Boolean).join(', ')||'–')}</td>
            </tr>`
          })
          html+='</tbody></table>'
          html+='<div style="font-size:11px;color:#999;margin-top:4px">Abbinati per nome e cognome: due omonimi qui si confondono.</div>'
        }
      }catch(_ve){/* elenco non disponibile: la scheda resta com'era */}
      // Rapporti di lavoro: visibili solo a chi è autorizzato lato asseverazione
""")

out = s.replace("\n", "\r\n") if crlf else s
P.write_bytes(out.encode("utf-8"))
print("ok, backup:", bak.name)
