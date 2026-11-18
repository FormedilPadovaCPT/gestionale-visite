// Supabase Edge Function – task-ufficio
// Le task del vault nella pagina «📋 Task» del gestionale (16/11/2026, chiesto
// dall'utente dopo aver visto la prova della pagina).
//
// La FONTE resta il vault (Obsidian): questa funzione legge i file su Google
// Drive con l'account di servizio dell'ente, come fa già «manuali», ne estrae
// le checkbox (leggi-task.js) e le scrive in s_task_vault con
// s_task_vault_carica, che sostituisce tutto in una transazione. Niente PC
// acceso, niente chiave nuova.
//
// Azioni (POST JSON, utente autenticato: segreteria, Coordinatore o Direttore):
//   { azione: 'aggiorna' }               rilegge il vault se l'ultimo giro riuscito
//                                        ha più di MINUTI_FRESCHI minuti
//   { azione: 'aggiorna', forza: true }  rilegge comunque (tasto «Aggiorna adesso»)
//
// UN CANALE CHE NON SI SORVEGLIA È UN CANALE DI CUI NON SI SA NIENTE: ogni giro
// lascia una riga in s_task_vault_giri, anche quando non cambia niente
// («invariato») e anche quando fallisce prima di arrivare al database
// (s_task_vault_giro_fallito). La pagina mostra l'ora dell'ultimo giro riuscito.
//
// ⚠️ SU DRIVE I FILE SI RICONOSCONO DAL PERCORSO, NON DAL NOME: ci sono copie
// del vault (BK20260626, la copia di 9_APPLICATIVI del 03/09) e tasks.md in
// 4_ARCHIVIO. La radice del vault si trova da scadenze_ufficio.md (il cui padre
// si chiama _SISTEMA e il cui nonno contiene 2_AREE), e ogni tasks.md si tiene
// solo se, risalendo le cartelle, arriva a quella radice dentro 1_PROGETTI o
// 2_AREE (fileAmmesso).
//
// Secret: GOOGLE_SERVICE_ACCOUNT_JSON

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken } from '../_shared/google.ts'
import { fileAmmesso, leggiFile, conChiavi } from './leggi-task.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const MINUTI_FRESCHI = 10
const DRIVE = 'https://www.googleapis.com/drive/v3/files'
const TUTTI = { supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }
type Meta = { id: string; name: string; parents?: string[]; modifiedTime?: string; trashed?: boolean }

const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

async function sha256(t: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function drive(token: string) {
  const cache = new Map<string, Promise<Meta | null>>()
  const meta = (id: string) => {
    if (!cache.has(id)) {
      cache.set(id, fetch(`${DRIVE}/${id}?` + new URLSearchParams({ fields: 'id,name,parents,trashed', supportsAllDrives: 'true' }),
        { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)))
    }
    return cache.get(id)!
  }
  const cerca = async (q: string): Promise<Meta[]> => {
    const out: Meta[] = []
    let pagina = ''
    do {
      const r = await fetch(`${DRIVE}?` + new URLSearchParams({ q, pageSize: '200', fields: 'nextPageToken,files(id,name,parents,modifiedTime)', ...TUTTI, ...(pagina ? { pageToken: pagina } : {}) }),
        { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (d.error) throw new Error('ricerca su Drive non riuscita (' + q + '): ' + JSON.stringify(d.error))
      out.push(...(d.files || []))
      pagina = d.nextPageToken || ''
    } while (pagina)
    return out
  }
  const testo = async (id: string) => {
    const r = await fetch(`${DRIVE}/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error('file ' + id + ' non scaricato: ' + r.status)
    return await r.text()
  }
  return { meta, cerca, testo }
}

/* la radice del vault e la cartella _SISTEMA, da scadenze_ufficio.md */
async function radice(d: ReturnType<typeof drive>) {
  const candidati = await d.cerca("name = 'scadenze_ufficio.md' and trashed = false")
  candidati.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)))
  for (const c of candidati) {
    const sis = c.parents?.[0] ? await d.meta(c.parents[0]) : null
    if (!sis || sis.name !== '_SISTEMA' || !sis.parents?.[0]) continue
    const aree = await d.cerca(`'${sis.parents[0]}' in parents and name = '2_AREE' and trashed = false`)
    if (aree.length) return { radiceId: sis.parents[0], sistemaId: sis.id, scadenze: c }
  }
  throw new Error('radice del vault non trovata su Drive (scadenze_ufficio.md dentro _SISTEMA, accanto a 2_AREE)')
}

/* il percorso di un file rispetto alla radice del vault, o null se non ci arriva */
async function percorso(d: ReturnType<typeof drive>, f: Meta, radiceId: string) {
  const nomi = [f.name]
  let padre = f.parents?.[0]
  for (let i = 0; padre && i < 14; i++) {
    if (padre === radiceId) return nomi.reverse().join('/')
    const m = await d.meta(padre)
    if (!m || m.trashed) return null
    nomi.push(m.name)
    padre = m.parents?.[0]
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const URL_ = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let da = 'pagina'
  try {
    /* chi chiama: le funzioni di ruolo eseguite COME l'utente (col suo token); un errore vale «no» */
    const sb = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const ruolo = async (f: string) => { const { data, error } = await sb.rpc(f); return !error && data === true }
    const [segr, coord, dir] = await Promise.all(['is_segreteria', 'is_coordinatore', 'is_direttore'].map(ruolo))
    if (!segr && !coord && !dir) return json({ ok: false, errore: 'Pagina riservata a segreteria, Coordinatore e Direttore' }, 403)
    const { data: chi } = await sb.auth.getUser()
    da = 'pagina: ' + (chi?.user?.email || '?')

    const body = await req.json().catch(() => ({}))
    if (body.azione !== 'aggiorna') return json({ ok: false, errore: 'azione sconosciuta' }, 400)

    if (!body.forza) {
      const { data: ult, error } = await admin.from('s_task_vault_giri').select('eseguito_il')
        .in('esito', ['ok', 'invariato']).order('eseguito_il', { ascending: false }).limit(1)
      if (!error && ult && ult[0] && Date.now() - Date.parse(ult[0].eseguito_il) < MINUTI_FRESCHI * 60000) {
        return json({ ok: true, saltato: true, ultimo: ult[0].eseguito_il })
      }
    }

    const SA = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON non configurato')
    const d = drive(await getAccessToken(JSON.parse(SA)))
    const { radiceId, sistemaId, scadenze } = await radice(d)

    const file: { p: string; id: string }[] = [{ p: '_SISTEMA/scadenze_ufficio.md', id: scadenze.id }]
    const pratiche = await d.cerca(`name = 'pratiche_aperte.md' and '${sistemaId}' in parents and trashed = false`)
    if (pratiche[0]) file.push({ p: '_SISTEMA/pratiche_aperte.md', id: pratiche[0].id })
    const tasks = await d.cerca("name = 'tasks.md' and trashed = false")
    const percorsi = await Promise.all(tasks.map((t) => percorso(d, t, radiceId)))
    tasks.forEach((t, i) => { const p = percorsi[i]; if (p && fileAmmesso(p)) file.push({ p, id: t.id }) })

    const oggi = oggiRoma()
    const testi = await Promise.all(file.map((f) => d.testo(f.id)))
    const righe = file.flatMap((f, i) => leggiFile(f.p, testi[i], oggi))
    const conK = conChiavi(righe)
    const pronte = await Promise.all(conK.map(async ({ r, baseChiave, corpo }) => ({
      ...r, chiave: (await sha256(baseChiave)).slice(0, 20), impronta: (await sha256(corpo)).slice(0, 32),
    })))

    const { data: esito, error } = await admin.rpc('s_task_vault_carica', { p: { righe: pronte, da } })
    if (error) throw new Error('caricamento nel database non riuscito: ' + error.message)
    return json({ ...(esito || {}), file_letti: file.map((f) => f.p), task: pronte.length })
  } catch (e) {
    const msg = String((e as Error)?.message || e)
    try { await admin.rpc('s_task_vault_giro_fallito', { p_da: da, p_esito: msg }) } catch (_e) { /* il giro fallito resta nel log della funzione */ }
    /* (18/11/2026, avviso CodeQL n. 34) il messaggio resta nel registro del giro, che la pagina Task
       mostra («L'ultimo aggiornamento non è riuscito…»), e nel log: non esce nella risposta */
    console.error('task-ufficio:', msg)
    return json({ ok: false, errore: 'aggiornamento non riuscito: il motivo è scritto nella pagina Task' }, 500)
  }
})
