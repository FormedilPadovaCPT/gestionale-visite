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
// POST JSON { azione:'scarica', doc_id | invio_id | iscrizione_id } → { ok, nome, mime, base64 }  (18/11/2026)
//   il proprietario della riga o la segreteria; se manca drive_file_id il file
//   si trova dal percorso «File: …» della nota e se ne salva l'id
// POST JSON { azione:'collega_attestati' } → { ok, collegati, senza_file }  (18/11/2026)
//   collega ai PDF di attestati_emessi/<anno>/ gli attestati emessi da noi
//   (il tecnico i suoi, la segreteria di tutti i tecnici attivi)
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
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '')
}
/* le cartelle dei tecnici non sono tutte uguali (Claudio_Simonetto, Caon_Franco):
   va bene l'una e l'altra forma, maiuscole e spazi ignorati */
export function chiaveCartella(s: string) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
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

  // deno-lint-ignore no-explicit-any
  let b: any
  try { b = await req.json() } catch { return risposta({ ok: false, error: 'richiesta non leggibile' }, 400) }

  /* ── scarica (18/11/2026): il tecnico scarica un suo documento; la segreteria
     qualunque. Il file sta sul Drive dell'ufficio e il tecnico non ha accesso
     diretto: passa da qui, che controlla di chi è la riga. Le righe della
     ricostruzione del 17/11 hanno solo il percorso nella nota («File: …»): la
     prima volta si trova il file seguendo il percorso e se ne salva l'id. ── */
  if (b.azione === 'scarica') {
    try {
      const { data: segr, error: es } = await comeUtente.rpc('is_segreteria')
      if (es) throw new Error('non sono riuscito a sapere chi sei: ' + es.message)
      /* attestato rilasciato da noi: si scarica il PDF collegato all'iscrizione,
         se l'iscrizione è del tecnico (persona o codice fiscale) */
      if (b.iscrizione_id != null) {
        const { data: i, error: ei2 } = await servizio.from('s_corsi_iscritti')
          .select('id, persona_id, cf, attestato_drive_id, attestato_revocato_il').eq('id', Number(b.iscrizione_id)).maybeSingle()
        if (ei2) throw new Error('attestato non letto: ' + ei2.message)
        if (!i || i.attestato_revocato_il) return risposta({ ok: false, error: 'attestato non trovato' }, 404)
        if (segr !== true) {
          const { data: t } = await servizio.from('tecnici').select('persona_id').eq('tecnico_id', tecId || '').maybeSingle()
          const { data: p } = t?.persona_id ? await servizio.from('persone').select('cf').eq('persona_id', t.persona_id).maybeSingle() : { data: null }
          const mio = !!t && ((t.persona_id && i.persona_id === t.persona_id) || (p?.cf && String(i.cf || '').toUpperCase() === String(p.cf).toUpperCase()))
          if (!mio) return risposta({ ok: false, error: 'puoi scaricare solo i tuoi attestati' }, 403)
        }
        if (!i.attestato_drive_id) return risposta({ ok: false, error: 'il PDF di questo attestato non è nell\'archivio: chiedilo alla segreteria' }, 404)
        b.__file = i.attestato_drive_id
      }
      const invio = b.invio_id != null
      const id = Number(invio ? b.invio_id : b.doc_id)
      if (!b.__file && !id) return risposta({ ok: false, error: 'documento non indicato' }, 400)
      // deno-lint-ignore no-explicit-any
      let riga: any = null
      if (!b.__file) {
        const r0 = await servizio.from(invio ? 's_doc_tecnico_invii' : 's_doc_tecnico')
          .select(invio ? 'id, tecnico_id, drive_file_id, nome_file' : 'id, tecnico_id, requisito_id, drive_file_id, note').eq('id', id).maybeSingle()
        if (r0.error) throw new Error('documento non letto: ' + r0.error.message)
        riga = r0.data
        if (!riga) return risposta({ ok: false, error: 'documento non trovato' }, 404)
        if (segr !== true && (!tecId || riga.tecnico_id !== tecId)) return risposta({ ok: false, error: 'puoi scaricare solo i tuoi documenti' }, 403)
      }

      const SA = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (!SA) throw new Error('configurazione Drive mancante')
      const tk = await getAccessToken(JSON.parse(SA))
      let fid = (b.__file || riga.drive_file_id) as string | null
      if (!fid && !invio) {
        const m = String(riga.note || '').match(/File: ([0-9]_?[A-Z].*?\.(?:pdf|jpe?g|png|docx?|xlsx?|msg|eml))(?=[\s.;,)]|$)/i)
        if (!m) return risposta({ ok: false, error: 'per questo documento non è registrato il file: chiedilo alla segreteria' }, 404)
        const pezzi = m[1].split('/').filter(Boolean)
        let padre = 'root'
        for (let i = 0; i < pezzi.length; i++) {
          const ultimo = i === pezzi.length - 1
          const trovati = await cerca(tk, `'${padre}' in parents and trashed=false and name='${q(pezzi[i])}'` +
            (ultimo ? '' : " and mimeType='application/vnd.google-apps.folder'"))
          if (!trovati.length) return risposta({ ok: false, error: `file non trovato su Drive (${pezzi.slice(0, i + 1).join('/')}): avvisa la segreteria` }, 404)
          padre = trovati[0].id
        }
        fid = padre
        /* l'id si salva: la volta dopo non si cerca più */
        await servizio.from('s_doc_tecnico').update({ drive_file_id: fid }).eq('id', id).is('drive_file_id', null)
      }
      if (!fid) return risposta({ ok: false, error: 'file non registrato' }, 404)
      const meta = await gapi(tk, `https://www.googleapis.com/drive/v3/files/${fid}?fields=name,mimeType,size,trashed`)
      if (meta.trashed) return risposta({ ok: false, error: 'il file è nel cestino di Drive: avvisa la segreteria' }, 404)
      if (Number(meta.size) > 15 * 1024 * 1024) return risposta({ ok: false, error: 'file oltre 15 MB: chiedilo alla segreteria' }, 413)
      /* privacy: alcune righe puntano a raccolte (attestati di più tecnici,
         registri firmati da tutti i partecipanti). Il tecnico scarica solo i
         file che portano il suo cognome nel nome; i suoi caricamenti sempre. */
      /* (vale per i crediti formativi, dove la ricostruzione ha collegato raccolte;
         contratto, polizze e attestati emessi da noi sono documenti individuali) */
      let aOre = false
      if (riga && !invio && riga.requisito_id) {
        const { data: rq } = await servizio.from('s_doc_requisito').select('ore_soglia, id').eq('id', riga.requisito_id).maybeSingle()
        const { data: og } = await servizio.from('s_doc_requisito').select('id').eq('origine_requisito_id', riga.requisito_id).limit(1)
        aOre = Number(rq?.ore_soglia) > 0 || !!og?.length
      }
      if (segr !== true && aOre) {
        const { data: t } = await servizio.from('tecnici').select('tecnico_cognome').eq('tecnico_id', tecId).maybeSingle()
        const cogn = chiaveCartella(String(t?.tecnico_cognome || ''))
        if (!cogn || !chiaveCartella(String(meta.name || '')).includes(cogn)) {
          return risposta({ ok: false, error: 'questo file contiene anche dati di altre persone: chiedi alla segreteria la tua parte' }, 403)
        }
      }
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fid}?alt=media`, { headers: { Authorization: `Bearer ${tk}` } })
      if (!r.ok) throw new Error('Drive non ha consegnato il file (' + r.status + ')')
      const bytes = new Uint8Array(await r.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return risposta({ ok: true, nome: meta.name, mime: meta.mimeType || 'application/octet-stream', base64: btoa(bin) })
    } catch (e) {
      return risposta({ ok: false, error: String((e as Error).message || e) }, 500)
    }
  }

  /* ── collega_attestati (18/11/2026): gli attestati rilasciati da FORMEDIL
     PADOVA (s_corsi_iscritti, esito «presente») di solito non hanno il
     collegamento al PDF, che sta in 2_AREE/Formazione/attestati_emessi/<anno>/
     col codice fiscale nel nome. Qui si trova il file e si salva
     attestato_drive_id, SOLO dove manca e SOLO se il file è uno:
     1) codice fiscale + numero («Prot_4473», «_n4-2026»; senza numero vale l'id
        dell'iscrizione, che negli storici è lo stesso);
     2) altrimenti codice fiscale + data del corso, per i file senza numero.
     Provato sul disco il 18/11/2026: 78 trovati su 137, nessun doppio.
     Il tecnico collega i suoi, la segreteria quelli di tutti. ── */
  if (b.azione === 'collega_attestati') {
    try {
      const { data: segr } = await comeUtente.rpc('is_segreteria')
      let q1 = servizio.from('tecnici').select('tecnico_id, persona_id').eq('attivo', true)
      if (segr !== true) {
        if (!tecId) return risposta({ ok: false, error: 'solo i tecnici e la segreteria' }, 403)
        q1 = q1.eq('tecnico_id', tecId)
      }
      const { data: tec, error: e1 } = await q1
      if (e1) throw new Error('tecnici non letti: ' + e1.message)
      const pid = (tec || []).map((t: { persona_id: string }) => t.persona_id).filter(Boolean)
      if (!pid.length) return risposta({ ok: true, collegati: 0, senza_file: 0 })
      const { data: pers, error: e2 } = await servizio.from('persone').select('persona_id, cf').in('persona_id', pid)
      if (e2) throw new Error('persone non lette: ' + e2.message)
      const cfDi = new Map((pers || []).filter((p: { cf: string }) => p.cf).map((p: { persona_id: string; cf: string }) => [p.persona_id, p.cf.toUpperCase()]))
      const cfs = [...new Set(cfDi.values())]
      const ors = [`persona_id.in.(${pid.join(',')})`, ...(cfs.length ? [`cf.in.(${cfs.join(',')})`] : [])].join(',')
      const { data: iscr, error: e3 } = await servizio.from('s_corsi_iscritti')
        .select('id, persona_id, cf, attestato_numero, attestato_data, s_corsi(data_inizio, data_fine)')
        .eq('esito', 'presente').is('attestato_revocato_il', null).is('attestato_drive_id', null).or(ors)
      if (e3) throw new Error('attestati non letti: ' + e3.message)
      // deno-lint-ignore no-explicit-any
      const righe = (iscr || []).map((i: any) => ({ ...i, cfx: String(i.cf || cfDi.get(i.persona_id) || '').toUpperCase() })).filter((i: { cfx: string }) => i.cfx)
      if (!righe.length) return risposta({ ok: true, collegati: 0, senza_file: 0 })

      const SA = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
      if (!SA) throw new Error('configurazione Drive mancante')
      const tk = await getAccessToken(JSON.parse(SA))
      const giu = async (padre: string, nome: string) => (await cartelle(tk, padre)).find((f) => f.name === nome)?.id
      const aree = await giu('root', '2_AREE'); const form = aree && await giu(aree, 'Formazione')
      const ae = form && await giu(form, 'attestati_emessi')
      if (!ae) throw new Error('cartella attestati_emessi non trovata su Drive')
      const anni = await cartelle(tk, ae)
      const perAnno = new Map<string, { id: string; name: string }[]>()
      const fileAnno = async (a: number) => {
        const k = String(a)
        if (perAnno.has(k)) return perAnno.get(k)!
        const cart = anni.find((f) => f.name === k)
        const tutti: { id: string; name: string }[] = []
        if (cart) {
          let tok = ''
          do {
            const u = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
              q: `'${cart.id}' in parents and trashed=false and mimeType='application/pdf'`,
              fields: 'nextPageToken,files(id,name)', pageSize: '1000', ...(tok ? { pageToken: tok } : {}) })
            const j = await gapi(tk, u)
            tutti.push(...(j.files || [])); tok = j.nextPageToken || ''
          } while (tok)
        }
        perAnno.set(k, tutti)
        return tutti
      }
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      let collegati = 0, senza = 0
      for (const r of righe) {
        const c = r.s_corsi || {}
        const date = [r.attestato_data, c.data_inizio, c.data_fine].filter(Boolean) as string[]
        if (!date.length) { senza++; continue }
        const ys = date.map((d) => Number(d.slice(0, 4)))
        const n = String(r.attestato_numero || r.id)
        const pat = [new RegExp('Prot_' + esc(n) + '(?![0-9])')]
        if (n.includes('/')) { const [a, bb] = n.split('/'); pat.push(new RegExp('_n' + esc(a) + '-' + esc(bb) + '(?![0-9])')) }
        let trovati: { id: string; name: string }[] = []
        const candidati: { id: string; name: string }[] = []
        for (let a = Math.min(...ys); a <= Math.max(...ys) + 1; a++) {
          candidati.push(...(await fileAnno(a)).filter((f) => f.name.toUpperCase().includes(r.cfx)))
        }
        trovati = candidati.filter((f) => pat.some((p) => p.test(f.name)))
        if (!trovati.length) {
          trovati = candidati.filter((f) => date.includes(f.name.slice(0, 10).replace(/_/g, '-')) && !/Prot_?[0-9]|_n[0-9]+-[0-9]{4}/.test(f.name))
        }
        if (trovati.length !== 1) { senza++; continue }
        const { error: eu2 } = await servizio.from('s_corsi_iscritti').update({ attestato_drive_id: trovati[0].id }).eq('id', r.id).is('attestato_drive_id', null)
        if (eu2) throw new Error('collegamento non salvato: ' + eu2.message)
        collegati++
      }
      return risposta({ ok: true, collegati, senza_file: senza })
    } catch (e) {
      return risposta({ ok: false, error: String((e as Error).message || e) }, 500)
    }
  }

  if (!tecId) return risposta({ ok: false, error: 'caricano gli attestati solo i tecnici, ciascuno per sé' }, 403)

  let fileId: string | null = null
  let token = ''
  try {
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
