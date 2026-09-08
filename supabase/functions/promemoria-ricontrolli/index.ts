// Supabase Edge Function – promemoria-ricontrolli
// Invia a ogni tecnico un digest email dei ricontrolli in scadenza sui suoi cantieri,
// secondo la regola Formedil (RPC public.ricontrolli_pendenti). Da schedulare (cron).
//
// 08/09/2026 — la mail deve dire ESATTAMENTE quello che dice la pagina Scadenze del
// gestionale (richiesta dell'utente dopo il confronto sul caso Caon): stessa RPC,
// stessa finestra (60 giorni, era 7), stesse due sezioni («Prossime visite
// pianificate» per data, «Urgenti — rientro scaduto» per IPC e poi per data più
// vecchia). La RPC è stata allineata lo stesso giorno (niente più filtro su
// `chiusa`, spareggio sul numero di verbale a parità di data).
//
// Sicurezza: verify_jwt=false. Autorizzazione accettata in 3 modi:
//   1) Authorization: Bearer <CRON_SECRET>  (cron GitHub, consigliato)
//   2) Authorization: Bearer <SERVICE_ROLE_KEY>
//   3) Authorization: Bearer <JWT utente> dove l'utente e' il coordinatore (COORD): invio manuale dal gestionale
// Secret usati: GOOGLE_SERVICE_ACCOUNT_JSON, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, SUPABASE_ANON_KEY
// Parametri query opzionali: ?dryRun=1 (non invia, restituisce il riepilogo), ?giorni=60
// Interruttore: la tabella public.app_impostazioni (chiave='promemoria_ricontrolli_attivo')
// permette al coordinatore di attivare/disattivare l'invio automatico dalla Zona Segreteria.
// NB: l'invio manuale (via JWT coordinatore) parte SEMPRE, anche se l'automatico e' sospeso.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }
const COORD = 'cptpd@did.formedilpadova.it'
const FINESTRA_GG = 60 // come la pagina Scadenze del gestionale

async function getToken(sa: Record<string,string>, scope: string): Promise<string> {
  const now = Math.floor(Date.now()/1000)
  const b64 = (o: unknown)=>btoa(JSON.stringify(o)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const payload = { iss: sa.client_email, sub: COORD, scope, aud:'https://oauth2.googleapis.com/token', iat: now, exp: now+3600 }
  const signingInput = `${b64({alg:'RS256',typ:'JWT'})}.${b64(payload)}`
  const pem = sa.private_key.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'')
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem),c=>c.charCodeAt(0)).buffer, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const res = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signingInput}.${sigB64}` })
  const d = await res.json(); if(!d.access_token) throw new Error('Token Google: '+JSON.stringify(d)); return d.access_token
}

function b64urlUtf8(s: string): string { const b=new TextEncoder().encode(s); let x=''; b.forEach(c=>x+=String.fromCharCode(c)); return btoa(x).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'') }

async function sendMail(token: string, to: string, subject: string, html: string, bcc?: string) {
  const headers = [ 'MIME-Version: 1.0', `From: Gestionale Visite <${COORD}>`, `To: ${to}` ]
  if(bcc && bcc.toLowerCase()!==String(to).toLowerCase()) headers.push(`Bcc: ${bcc}`)
  headers.push('Reply-To: cpt@formedilpadova.it', `Subject: =?UTF-8?B?${b64urlUtf8(subject)}?=`, 'Content-Type: text/html; charset=UTF-8', '', html)
  const mime = headers.join('\r\n')
  const raw = b64urlUtf8(mime)
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ raw }) })
  const j = await r.json(); if(!r.ok||j.error) throw new Error(j.error?.message||JSON.stringify(j)); return j.id
}

function fmt(d: string){ if(!d) return '–'; const p=String(d).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(d) }

// stesso ordine della pagina Scadenze: urgenti per IPC (Alto prima) e poi per data più vecchia;
// prossime per data più vicina
const IPC_ORD: Record<string,number> = { ALTO:0, MEDIO:1, BASSO:2, NR:3 }
function ordinaUrgenti(a: any, b: any){ return (IPC_ORD[a.ipc]??3)-(IPC_ORD[b.ipc]??3) || String(a.data_rientro).localeCompare(String(b.data_rientro)) }
function ordinaProssime(a: any, b: any){ return String(a.data_rientro).localeCompare(String(b.data_rientro)) }

function tabella(rows: any[], urgenti: boolean): string {
  const th='style="padding:6px 8px;text-align:left;font-size:11px;color:#888;border-bottom:2px solid #eee"'
  const td='style="padding:6px 8px;font-size:12px;border-bottom:1px solid #f0f0f0"'
  let h=`<table style="width:100%;border-collapse:collapse;margin:6px 0 16px"><thead><tr><th ${th}>N° Verbale</th><th ${th}>Cantiere</th><th ${th}>Data visita</th><th ${th}>Acc.</th><th ${th}>IPC</th><th ${th}>Rientro previsto</th><th ${th}>${urgenti?'Scaduto da':'Tra giorni'}</th></tr></thead><tbody>`
  for(const r of rows){
    const gg = r.giorni_diff
    const stato = urgenti ? `<span style="color:#e74c3c;font-weight:700">${gg===0?'oggi':Math.abs(gg)+' gg fa'}</span>` : `<span style="color:#27ae60;font-weight:600">${gg===0?'oggi':'tra '+gg+' gg'}</span>`
    h += `<tr><td ${td} style="padding:6px 8px;font-size:12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#565c66;white-space:nowrap">${r.nr_verbale||'–'}</td><td ${td}>${r.cantiere_label||'–'}</td><td ${td}>${fmt(r.data_visita)}</td><td ${td} align="center">${r.acc??'–'}</td><td ${td}>${r.ipc||'–'}</td><td ${td}>${fmt(r.data_rientro)}${r.tipo?` <span style="font-size:10px;color:#f39c12">(${r.tipo})</span>`:''}</td><td ${td}>${stato}</td></tr>`
  }
  return h+'</tbody></table>'
}

serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:CORS})
  try{
    const SB_URL = Deno.env.get('SUPABASE_URL')!
    const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const CRON = Deno.env.get('CRON_SECRET')
    const auth = req.headers.get('Authorization')||''
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    // 1) cron/service key
    let okAuth = bearer === SRK || (!!CRON && bearer === CRON)
    let manuale = false
    // 3) JWT del coordinatore -> invio manuale
    if(!okAuth && bearer){
      try{
        const ur = await fetch(`${SB_URL}/auth/v1/user`, { headers:{ apikey: ANON||SRK, Authorization:`Bearer ${bearer}` } })
        if(ur.ok){
          const u = await ur.json()
          const email = String(u?.email||'').toLowerCase()
          if(email === COORD.toLowerCase()){ okAuth = true; manuale = true }
        }
      }catch(_e){ /* ignora, resta non autorizzato */ }
    }
    if(!okAuth) return new Response(JSON.stringify({error:'non autorizzato'}),{status:401,headers:{'Content-Type':'application/json',...CORS}})

    const url = new URL(req.url)
    const dryRun = url.searchParams.get('dryRun')==='1'
    const giorni = parseInt(url.searchParams.get('giorni')||String(FINESTRA_GG),10)||FINESTRA_GG

    // Interruttore master (invio AUTOMATICO). L'invio manuale del coordinatore lo ignora.
    let attivo = true
    try{
      const fr = await fetch(`${SB_URL}/rest/v1/app_impostazioni?chiave=eq.promemoria_ricontrolli_attivo&select=valore`, { headers:{ apikey:SRK, Authorization:`Bearer ${SRK}` } })
      const fj = await fr.json()
      if(Array.isArray(fj) && fj.length && fj[0].valore === false) attivo = false
    }catch(_e){ /* in caso di errore lettura flag, prosegui come attivo */ }
    if(!attivo && !dryRun && !manuale){
      return new Response(JSON.stringify({ ok:true, skipped:true, motivo:'promemoria disattivato dal coordinatore' }, null, 2),{headers:{'Content-Type':'application/json',...CORS}})
    }

    const rpc = await fetch(`${SB_URL}/rest/v1/rpc/ricontrolli_pendenti`, { method:'POST', headers:{ 'Content-Type':'application/json', apikey:SRK, Authorization:`Bearer ${SRK}` }, body: JSON.stringify({ p_giorni_imminenti: giorni }) })
    const all = await rpc.json()
    if(!Array.isArray(all)) throw new Error('RPC ricontrolli_pendenti: '+JSON.stringify(all))

    // 08/09/2026: la mail va solo ai tecnici IN SERVIZIO. Il 07/09 il promemoria era partito anche
    // verso mirco.canova@…, account cancellato (attivo=false, elimina=1): è tornato indietro con
    // «indirizzo inesistente», e i suoi 42 cantieri con rientro scaduto non li ha visti nessuno.
    // I cantieri dei tecnici non più in servizio finiscono in una mail a parte al coordinatore:
    // vanno riassegnati, non dimenticati.
    const tr = await fetch(`${SB_URL}/rest/v1/tecnici?select=email,attivo,elimina`, { headers:{ apikey:SRK, Authorization:`Bearer ${SRK}` } })
    const tecniciTutti = await tr.json().catch(()=>[])
    const inServizio = new Set((Array.isArray(tecniciTutti)?tecniciTutti:[]).filter((t:any)=>t.email && t.attivo!==false && !(Number(t.elimina)>0)).map((t:any)=>String(t.email).toLowerCase()))

    const byTec: Record<string, {email:string, nome:string, urgenti:any[], prossime:any[]}> = {}
    const orfani: Record<string, {nome:string, rows:any[]}> = {}
    for(const r of all){
      if(r.categoria!=='urgente' && r.categoria!=='imminente') continue
      const k = String(r.tecnico_email||'').toLowerCase()
      if(!k || !inServizio.has(k)){
        const kk = k || (r.tecnico_nome||'senza tecnico')
        if(!orfani[kk]) orfani[kk] = { nome:r.tecnico_nome||kk, rows:[] }
        orfani[kk].rows.push(r)
        continue
      }
      if(!byTec[k]) byTec[k] = { email:r.tecnico_email, nome:r.tecnico_nome||'', urgenti:[], prossime:[] }
      ;(r.categoria==='urgente' ? byTec[k].urgenti : byTec[k].prossime).push(r)
    }
    for(const k in byTec){ byTec[k].urgenti.sort(ordinaUrgenti); byTec[k].prossime.sort(ordinaProssime) }
    for(const k in orfani){ orfani[k].rows.sort((a,b)=> (a.categoria===b.categoria ? 0 : (a.categoria==='urgente'?-1:1)) || ordinaUrgenti(a,b)) }

    const riepilogo = Object.values(byTec).map(t=>({ tecnico:t.nome, email:t.email, urgenti:t.urgenti.length, imminenti:t.prossime.length, verbali_urgenti:t.urgenti.map(r=>r.nr_verbale), verbali_prossime:t.prossime.map(r=>r.nr_verbale) }))
    const riepilogoOrfani = Object.values(orfani).map(o=>({ tecnico:o.nome, cantieri:o.rows.length }))
    if(dryRun) return new Response(JSON.stringify({ ok:true, dryRun:true, attivo, manuale, giorni, bcc:COORD, tecnici:riepilogo, da_riassegnare:riepilogoOrfani }, null, 2),{headers:{'Content-Type':'application/json',...CORS}})

    const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!)
    const token = await getToken(sa,'https://www.googleapis.com/auth/gmail.send')

    const esiti:any[] = []
    for(const t of Object.values(byTec)){
      const nU = t.urgenti.length, nI = t.prossime.length
      const MAX = 80
      const taglio = (rows:any[]) => rows.length>MAX ? `<p style="font-size:12px;color:#888">…e altri ${rows.length-MAX} cantieri: l'elenco completo è nella pagina Scadenze del gestionale.</p>` : ''
      const h3 = (t:string, col:string) => `<h3 style="font-size:13px;color:${col};text-transform:uppercase;letter-spacing:.5px;margin:14px 0 4px">${t}</h3>`
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:760px">`
        + `<div style="background:#e7500f;color:#fff;padding:12px 16px;border-radius:6px 6px 0 0"><strong>FORMEDIL PADOVA · Scadenze visite di ritorno</strong></div>`
        + `<div style="border:1px solid #eee;border-top:none;padding:16px;border-radius:0 0 6px 6px">`
        + `<p>Ciao ${t.nome||''},<br>questo è l'elenco della pagina <strong>Scadenze</strong> del gestionale per i tuoi cantieri: <strong style="color:#27ae60">${nI} con rientro previsto nei prossimi ${giorni} giorni</strong> e <strong style="color:#e74c3c">${nU} con rientro scaduto</strong>.</p>`
        + (nI ? h3('📅 Prossime visite pianificate', '#e7500f') + `<p style="font-size:11px;color:#888;margin:0">Ultima visita per cantiere con rientro previsto nei prossimi ${giorni} giorni, per data più vicina.</p>` + tabella(t.prossime.slice(0,MAX), false) + taglio(t.prossime) : '')
        + (nU ? h3('⚠️ Urgenti — rientro scaduto', '#e74c3c') + `<p style="font-size:11px;color:#888;margin:0">Ultima visita per cantiere con IPC diverso da Nessun Rilievo e rientro scaduto. Ordine per IPC (Alto prima) poi per data più vecchia.</p>` + tabella(t.urgenti.slice(0,MAX), true) + taglio(t.urgenti) : '')
        + `<p style="font-size:11px;color:#aaa;margin-top:16px">Promemoria dal Gestionale Visite: è lo stesso elenco della pagina Scadenze, con la stessa regola Formedil (IPC alto → 3 giorni, medio/basso → 22 giorni al primo accesso). Se un cantiere è concluso, chiudilo nel gestionale per non ricevere più il promemoria.</p>`
        + `</div></div>`
      try{ const id = await sendMail(token, t.email, `Scadenze visite di ritorno – ${nU} scaduti, ${nI} nei prossimi ${giorni} giorni`, html, COORD); esiti.push({email:t.email, ok:true, id, bcc:COORD}) }
      catch(e){ esiti.push({email:t.email, ok:false, err:String(e.message||e)}) }
    }
    // i cantieri dei tecnici non più in servizio: una mail sola al coordinatore, da riassegnare
    const listaOrfani = Object.values(orfani)
    if(listaOrfani.length){
      const tot = listaOrfani.reduce((s,o)=>s+o.rows.length,0)
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:760px">`
        + `<div style="background:#565c66;color:#fff;padding:12px 16px;border-radius:6px 6px 0 0"><strong>FORMEDIL PADOVA · Rientri di tecnici non più in servizio</strong></div>`
        + `<div style="border:1px solid #eee;border-top:none;padding:16px;border-radius:0 0 6px 6px">`
        + `<p>Questi <strong>${tot}</strong> cantieri hanno l'ultima visita di un tecnico che non è più in servizio (o senza indirizzo), quindi il promemoria non li manda a nessuno: vanno <strong>riassegnati</strong> dal gestionale, oppure chiusi se conclusi.</p>`
        + listaOrfani.map(o=>`<h3 style="font-size:13px;color:#565c66;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 4px">${o.nome} · ${o.rows.length} cantieri</h3>`+tabella(o.rows.slice(0,80), true)+(o.rows.length>80?`<p style="font-size:12px;color:#888">…e altri ${o.rows.length-80}.</p>`:'')).join('')
        + `</div></div>`
      try{ const id = await sendMail(token, COORD, `Rientri scaduti di tecnici non più in servizio – ${tot} cantieri da riassegnare`, html); esiti.push({email:COORD, ok:true, id, orfani:tot}) }
      catch(e){ esiti.push({email:COORD, ok:false, err:String(e.message||e), orfani:tot}) }
    }
    return new Response(JSON.stringify({ ok:true, manuale, giorni, bcc:COORD, inviate:esiti.filter(e=>e.ok).length, da_riassegnare:riepilogoOrfani, esiti }, null, 2),{headers:{'Content-Type':'application/json',...CORS}})
  }catch(e){
    console.error('promemoria-ricontrolli:', e)
    return new Response(JSON.stringify({error:String(e.message||e)}),{status:400,headers:{'Content-Type':'application/json',...CORS}})
  }
})
