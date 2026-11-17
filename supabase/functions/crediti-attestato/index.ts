// Supabase Edge Function – crediti-attestato (17/11/2026)
//
// IL TECNICO CARICA UN SUO ATTESTATO DI AGGIORNAMENTO (crediti-formativi.js).
// Deciso dall'utente: ognuno per sé (non il Coordinatore), senza protocollo;
// la segreteria convalida. Il file va su Drive nel fascicolo del tecnico,
//   2_AREE/Team_Tecnici/<cartella del tecnico>/curriculum_e_qualificazione/
// col nome a convenzione `aaaa_mm_gg_ATT_Cognome-Nome_<descrizione>.pdf`, e la
// riga va in s_doc_tecnico_invii «da verificare»: non conta nelle ore finché la
// segreteria non la conferma (crediti_conferma_invio).
//
// Il tecnico è quello dell'accesso (mio_tecnico_id, chiesto COME l'utente):
// nessuno carica per conto di un altro. Se il database non risponde, la
// risposta è un errore, mai un «inviato».
//
// POST JSON { requisito_id, tipo, data_inizio, ore?, ore_di_corso?, descrizione,
//             ente?, nota?, nome_file, mime_type, base64 } → { ok, id, nome_file }
//
// Secret: GOOGLE_SERVICE_ACCOUNT_JSON (delega sul Drive dell'ente, la cui radice è il vault)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken } from '../_shared/google.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const risposta = (dati: unknown, status = 200) =>
  new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

const MAX_BYTE = 10 * 1024 * 1024
const TIPI_FILE: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }
const SOTTOCARTELLA = 'curriculum_e_qualificazione'

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function gapi(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error('Drive: ' + JSON.stringify(j.error || r.status))
  return j
}
async function cerca(token: string, query: string) {
  const u = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: query, fields: 'files(id,name)', pageSize: '200' })
  return (await gapi(token, u)).files as { id: string; name: string }[]
}
async function cartelle(token: string, padre: string) {
  return cerca(token, `'${padre}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
}
async function creaCartella(token: string, nome: string, padre: string) {
  return (await gapi(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })).id as string
}

/* come si scrive un pezzo di nome: niente accenti né spazi */
export function pezzo(s: string, max = 60) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '')
}
/* le cartelle dei tecnici non sono tutte uguali (Claudio_Simonetto, Caon_Franco):
   va bene l'una e l'altra forma, maiuscole e spazi ignorati */
export function chiaveCartella(s: string) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta({ ok: false, error: 'metodo non ammesso' }, 405)
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)

  const comeUtente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const servizio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: eu } = await comeUtente.auth.getUser()
  if (eu || !u?.user?.email) return risposta({ ok: false, error: 'accesso non autorizzato' }, 401)
  const { data: tecId, error: et } = await comeUtente.rpc('mio_tecnico_id')
  if (et) return risposta({ ok: false, error: 'non sono riuscito a sapere chi sei: ' + et.message }, 500)
  if (!tecId) return risposta({ ok: false, error: 'caricano gli attestati solo i tecnici, ciascuno per sé' }, 403)

  let fileId: string | null = null
  let token = ''
  try {
    const b = await req.json()
    const requisitoId = Number(b.requisito_id)
    const tipo = String(b.tipo || '')
    const data = String(b.data_inizio || '')
    const ore = b.ore === null || b.ore === undefined || b.ore === '' ? null : Number(b.ore)
    const oreCorso = b.ore_di_corso === null || b.ore_di_corso === undefined || b.ore_di_corso === '' ? null : Number(b.ore_di_corso)
    const descrizione = String(b.descrizione || '').trim()
    const est = TIPI_FILE[String(b.mime_type || '')]

    /* ── i controlli, prima di toccare Drive ── */
    const { data: r, error: er } = await servizio.from('s_doc_requisito').select('*').eq('id', requisitoId).maybeSingle()
    if (er) throw new Error('requisito non letto: ' + er.message)
    if (!r || !r.attivo) return risposta({ ok: false, error: 'requisito non valido' }, 400)
    const { data: orig } = await servizio.from('s_doc_requisito').select('id').eq('origine_requisito_id', requisitoId).limit(1)
    if (!(Number(r.ore_soglia) > 0) && !orig?.length) return risposta({ ok: false, error: 'per questo requisito il caricamento non è previsto' }, 400)
    if (!['attestato', 'aggiornamento', 'docenza'].includes(tipo)) return risposta({ ok: false, error: 'tipo non valido' }, 400)
    if (tipo === 'docenza' && !r.docenza_alternativa) return risposta({ ok: false, error: `per «${r.descrizione}» la docenza non vale come aggiornamento` }, 400)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || isNaN(Date.parse(data))) return risposta({ ok: false, error: 'data non valida' }, 400)
    const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
    if (data > oggi) return risposta({ ok: false, error: 'la data è nel futuro' }, 400)
    if (tipo !== 'attestato' && !(ore! > 0)) return risposta({ ok: false, error: 'scrivi le ore che valgono' }, 400)
    if (ore !== null && !(ore > 0 && ore <= 400)) return risposta({ ok: false, error: 'ore non valide' }, 400)
    if (oreCorso !== null && !(oreCorso >= 0 && (ore === null || oreCorso <= ore))) return risposta({ ok: false, error: 'le ore di corso non possono superare le ore' }, 400)
    if (descrizione.length < 3) return risposta({ ok: false, error: 'scrivi il titolo del corso' }, 400)
    if (!est) return risposta({ ok: false, error: 'si caricano PDF, JPG o PNG' }, 400)
    const bin = atob(String(b.base64 || ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    if (!bytes.length) return risposta({ ok: false, error: 'file vuoto' }, 400)
    if (bytes.length > MAX_BYTE) return risposta({ ok: false, error: 'file oltre 10 MB' }, 400)
    const firma = Array.from(bytes.slice(0, 4)).map((x) => x.toString(16).padStart(2, '0')).join('')
    const buono = (est === 'pdf' && firma === '25504446') || (est === 'png' && firma === '89504e47') || (est === 'jpg' && firma.startsWith('ffd8ff'))
    if (!buono) return risposta({ ok: false, error: 'il contenuto del file non corrisponde al tipo' }, 400)

    const { data: t, error: ett } = await servizio.from('tecnici').select('tecnico_cognome, tecnico_nome').eq('tecnico_id', tecId).maybeSingle()
    if (ett || !t) throw new Error('tecnico non letto')

    /* ── Drive: la cartella del tecnico, poi la sottocartella delle qualifiche ── */
    const SA = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!SA) throw new Error('configurazione Drive mancante')
    token = await getAccessToken(JSON.parse(SA))
    const aree = (await cartelle(token, 'root')).find((f) => f.name === '2_AREE')
    if (!aree) throw new Error('cartella 2_AREE non trovata su Drive')
    const team = (await cartelle(token, aree.id)).find((f) => f.name === 'Team_Tecnici')
    if (!team) throw new Error('cartella Team_Tecnici non trovata su Drive')
    const nome = String(t.tecnico_nome || '').trim(), cognome = String(t.tecnico_cognome || '').trim()
    const forme = [chiaveCartella(nome + cognome), chiaveCartella(cognome + nome)]
    const sue = (await cartelle(token, team.id)).filter((f) => forme.includes(chiaveCartella(f.name)))
    if (sue.length > 1) throw new Error('trovate due cartelle per lo stesso tecnico: avvisa la segreteria')
    const mia = sue[0]?.id ?? await creaCartella(token, `${pezzo(nome)}_${pezzo(cognome)}`.replace(/-/g, '_'), team.id)
    const qualif = (await cartelle(token, mia)).find((f) => f.name === SOTTOCARTELLA)?.id
      ?? await creaCartella(token, SOTTOCARTELLA, mia)

    /* ── il nome: data del documento, ATT, Cognome-Nome, il corso; mai uguale a uno che c'è
       (a maiuscole ignorate: il mount del Drive non le distingue) ── */
    const base = `${data.replace(/-/g, '_')}_ATT_${pezzo(cognome)}-${pezzo(nome)}_${pezzo(descrizione) || 'attestato'}`
    const esistenti = new Set((await cerca(token, `'${qualif}' in parents and trashed=false and name contains '${q(base)}'`)).map((f) => f.name.toLowerCase()))
    let nomeFile = `${base}.${est}`
    for (let v = 2; esistenti.has(nomeFile.toLowerCase()); v++) nomeFile = `${base}_v${String(v).padStart(2, '0')}.${est}`

    const confine = '-------AttestatoTecnico'
    const testa = new TextEncoder().encode(
      `--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nomeFile, parents: [qualif] })}\r\n` +
      `--${confine}\r\nContent-Type: ${b.mime_type}\r\n\r\n`)
    const coda = new TextEncoder().encode(`\r\n--${confine}--`)
    const corpo = new Uint8Array(testa.length + bytes.length + coda.length)
    corpo.set(testa, 0); corpo.set(bytes, testa.length); corpo.set(coda, testa.length + bytes.length)
    const f = await gapi(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${confine}` }, body: corpo,
    })
    fileId = f.id

    const { data: riga, error: ei } = await servizio.from('s_doc_tecnico_invii').insert({
      tecnico_id: tecId, requisito_id: requisitoId, tipo, data_inizio: data, ore, ore_di_corso: oreCorso,
      descrizione, ente: String(b.ente || '').trim() || null, note_tecnico: String(b.nota || '').trim() || null,
      nome_file: nomeFile, drive_file_id: f.id, drive_url: f.webViewLink ?? null, inviato_da: u.user.email.toLowerCase(),
    }).select('id').single()
    if (ei) throw new Error('registrazione non riuscita: ' + ei.message)
    return risposta({ ok: true, id: riga.id, nome_file: nomeFile })
  } catch (e) {
    /* il file caricato senza la sua riga non deve restare a metà: va nel cestino */
    if (fileId && token) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      }).catch(() => {})
    }
    return risposta({ ok: false, error: String((e as Error).message || e) }, 500)
  }
})
