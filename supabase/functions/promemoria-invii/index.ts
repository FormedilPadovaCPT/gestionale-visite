// Supabase Edge Function – promemoria-invii
// (13/10/2026, deciso dall'utente)
//
// Ogni mattina feriale, dalle 8, manda a ogni tecnico che ne ha UNA mail con
// l'elenco delle sue visite ferme da almeno un giorno lavorativo: verbali
// chiusi e mai inviati all'impresa, e verbali ancora in bozza. Indipendente
// dal riepilogo dei ricontrolli del lunedì (promemoria-ricontrolli).
// Solo al tecnico, coordinatore NON in copia. Nessun «consegnato a mano»:
// se all'impresa manca la mail, il tecnico la cerca.
//
// ⚠️ PARTE DA SOLA: è l'eccezione 9 alla regola «l'app prepara, la persona
// manda». Regge perché il testo si legge tutto dal database (testo.js).
//
// ⚠️ NON MANDA DUE VOLTE: prima di spedire si prenota la riga
// (giorno, tecnico) in promemoria_invii_giri; a invio riuscito `inviato_il`,
// a invio fallito l'errore, e il giro dopo dello stesso giorno ritenta. La
// riga '*' è il battito del giro: si scrive anche quando non parte niente.
//
// Chiamata: POST dal giro pg_cron `promemoria-invii-giro` (6:20 e 7:20 UTC,
// lun-ven) con X-Promemoria-Invii = s_config.promemoria_invii_token.
// Corpo facoltativo: { prova: true, ora?: ISO } → dice che cosa manderebbe,
// senza scrivere e senza spedire; { forza: true } salta il controllo
// dell'orario (non quello dei doppioni).
// Interruttore: app_impostazioni.promemoria_invii_attivo.
// Secret: GOOGLE_SERVICE_ACCOUNT_JSON (delega gmail.send), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getToken, SOGGETTO_ENTE, SCOPE_GMAIL } from '../_shared/google.ts'
// @ts-ignore modulo JS puro, provato dai test del repo
import { raggruppa, oggetto, html } from './testo.js'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-promemoria-invii' }
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const oraRoma = () => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date())

function b64(s: string): string {
  const b = new TextEncoder().encode(s); let x = ''
  for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(x)
}
const b64url = (s: string) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

async function manda(token: string, to: string, subject: string, corpo: string) {
  const mime = [
    'MIME-Version: 1.0',
    `From: Gestionale Visite <${SOGGETTO_ENTE}>`,
    `To: ${to}`,
    'Reply-To: cpt@formedilpadova.it',
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(corpo).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n')
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64url(mime) }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error?.message || ('Gmail HTTP ' + r.status))
  return j.id as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'solo POST' }, 405)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const giorno = oggiRoma()
  try {
    const { data: cfg, error: eCfg } = await sb.from('s_config').select('valore').eq('chiave', 'promemoria_invii_token').maybeSingle()
    if (eCfg) throw eCfg
    const atteso = String(cfg?.valore || '')
    if (!atteso || req.headers.get('x-promemoria-invii') !== atteso) return json({ error: 'non autorizzato' }, 401)

    const corpo = await req.json().catch(() => ({})) as { prova?: boolean; ora?: string; forza?: boolean }
    const prova = !!corpo.prova

    if (!prova && !corpo.forza && oraRoma() < 8) return json({ saltato: 'prima delle 8 (ora italiana)', giorno })

    if (!prova) {
      const { data: imp, error: eImp } = await sb.from('app_impostazioni').select('valore').eq('chiave', 'promemoria_invii_attivo').maybeSingle()
      if (eImp) throw eImp
      if (imp && imp.valore === false) {
        await sb.from('promemoria_invii_giri').upsert({ giorno, tecnico_email: '*', esito: 'sospeso', prenotato_il: new Date().toISOString() }, { onConflict: 'giorno,tecnico_email' })
        return json({ sospeso: true, giorno })
      }
      const { data: giro, error: eGiro } = await sb.from('promemoria_invii_giri').select('esito').eq('giorno', giorno).eq('tecnico_email', '*').maybeSingle()
      if (eGiro) throw eGiro
      if (giro && giro.esito === 'giro-ok') return json({ gia_fatto: true, giorno })
    }

    const { data: righe, error: eEl } = await sb.rpc('promemoria_invii_elenco', prova && corpo.ora ? { p_ora: corpo.ora } : {})
    if (eEl) throw eEl
    const gruppi = raggruppa(righe || [])

    if (prova) return json({ prova: true, giorno, tecnici: gruppi.map((g: any) => ({ email: g.email, oggetto: oggetto(g), definitivi: g.definitivi.map((r: any) => r.nr_verbale), bozze: g.bozze.map((r: any) => r.nr_verbale) })) })

    let token = ''
    const esiti: Record<string, string> = {}
    let errori = 0, inviate = 0
    for (const g of gruppi as any[]) {
      // prenota: se la riga di oggi c'è già ed è inviata, non si rimanda
      const { data: gia, error: eGia } = await sb.from('promemoria_invii_giri').select('id, inviato_il').eq('giorno', giorno).eq('tecnico_email', g.email).maybeSingle()
      if (eGia) throw eGia
      if (gia?.inviato_il) { esiti[g.email] = 'già inviato oggi'; continue }
      const riga = { giorno, tecnico_email: g.email, n_definitivi: g.definitivi.length, n_bozze: g.bozze.length,
        elenco: [...g.definitivi, ...g.bozze].map((r: any) => ({ visita_id: r.visita_id, nr: r.nr_verbale, stato: r.stato, giorni: r.giorni })),
        prenotato_il: new Date().toISOString(), esito: null, errore: null }
      const { error: ePren } = await sb.from('promemoria_invii_giri').upsert(riga, { onConflict: 'giorno,tecnico_email' })
      if (ePren) throw ePren
      try {
        if (!token) token = await getToken(JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!), SCOPE_GMAIL)
        await manda(token, g.email, oggetto(g), html(g))
        await sb.from('promemoria_invii_giri').update({ inviato_il: new Date().toISOString(), esito: 'inviato' }).eq('giorno', giorno).eq('tecnico_email', g.email)
        esiti[g.email] = 'inviato'; inviate++
      } catch (e) {
        errori++
        const msg = String((e as Error).message || e).slice(0, 500)
        await sb.from('promemoria_invii_giri').update({ esito: 'errore', errore: msg }).eq('giorno', giorno).eq('tecnico_email', g.email)
        esiti[g.email] = 'errore: ' + msg
      }
    }
    // il battito del giro, anche quando non è partito niente
    const { error: eBat } = await sb.from('promemoria_invii_giri').upsert({
      giorno, tecnico_email: '*', n_definitivi: (righe || []).filter((r: any) => r.stato !== 'bozza').length,
      n_bozze: (righe || []).filter((r: any) => r.stato === 'bozza').length, elenco: esiti,
      prenotato_il: new Date().toISOString(), inviato_il: new Date().toISOString(),
      esito: errori ? 'giro-errori' : 'giro-ok', errore: errori ? `${errori} mail non partite` : null,
    }, { onConflict: 'giorno,tecnico_email' })
    if (eBat) throw eBat
    return json({ giorno, tecnici: gruppi.length, inviate, errori, esiti }, errori ? 500 : 200)
  } catch (e) {
    const msg = String((e as Error).message || e)
    await sb.from('promemoria_invii_giri').upsert({ giorno, tecnico_email: '*', esito: 'giro-errori', errore: msg.slice(0, 500), prenotato_il: new Date().toISOString() }, { onConflict: 'giorno,tecnico_email' }).then(() => {}, () => {})
    return json({ error: msg }, 500)
  }
})
