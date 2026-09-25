# -*- coding: utf-8 -*-
"""25/09/2026 - send-verbale: il paragrafo «Formazione: possiamo aiutarvi» nella
mail all'impresa (date e quote vere dal calendario corsi) e, a mail partita, la
segnalazione all'ufficio corsi con la riga nel registro s_formazione_segnalazioni.
"""
import io
P = 'supabase/functions/send-verbale/index.ts'
s = io.open(P, encoding='utf-8', newline='').read(); NL = '\r\n' if '\r\n' in s else '\n'
def sost(v, n, nome):
    global s
    v = v.replace('\n', NL); n = n.replace('\n', NL)
    assert s.count(v) == 1, '%s: %d occorrenze' % (nome, s.count(v))
    s = s.replace(v, n)

# 1. le funzioni della formazione, prima di serve()
sost("""serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })""",
"""// ── FORMAZIONE MANCANTE (25/09/2026, idea dell'utente) ───────────────
// Il tecnico ha spuntato «contattare l'ufficio corsi» e quale formazione
// manca. Qui: (a) il paragrafo per l'impresa con le prossime date dei corsi
// e la quota VERA — gratuito o quanto costa per le imprese CEIV, quota di
// listino per le altre, e in tutti e due i casi quanto si risparmia con la
// Cassa Edile; (b) a mail partita, la mail interna all'ufficio corsi con i
// contatti dell'impresa (parte da sola: testo letto dal database, terza
// eccezione della famiglia «avviso di pagamento») e la riga nel registro.
type Formazione = {
  tipi?: string[]; tipi_etichette?: string[]; nota?: string | null; ceiv?: 'si' | 'no' | 'da_verificare'
  impresa?: string | null; partita_iva?: string | null; impresa_id?: string | null
  impresa_email?: string | null; impresa_tel?: string | null; referente?: string | null; referente_tel?: string | null; tecnico_id?: string | null
}
type Proposta = {
  tipo: string; etichetta: string; codice: string; titolo: string; ore: number | null; validita: string | null
  ceiv_gratuito: boolean; quota_ceiv: number | null; quota_listino: number | null; diritti_segreteria: number | null
  date: { inizio: string; fine: string | null; sede: string | null }[]
}
const PREFISSO_OGGETTO = 'FORMEDIL Padova -AREA SICUREZZA E SALUTE-'
const eur = (n: number | null | undefined) => n == null ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const dIt = (iso?: string | null) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''
const titoloBello = (t: string) => t.replace(/\\s+/g, ' ').trim().toLowerCase().replace(/(^|[\\s(\\-–/])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\\bCcnl\\b/g, 'CCNL').replace(/\\bRls\\b/g, 'RLS').replace(/\\bRspp\\b/g, 'RSPP').replace(/\\bDpi\\b/g, 'DPI').replace(/\\bPle\\b/g, 'PLE')

/* la riga della quota, che dice sempre la verità del listino e quanto si risparmia */
function quotaTesto(c: Proposta, ceiv: string): string {
  const dir = c.diritti_segreteria ? ` (${eur(c.diritti_segreteria)} di diritti di segreteria)` : ''
  if (ceiv === 'si') {
    if (c.ceiv_gratuito) return `per la Vostra impresa, iscritta alla Cassa Edile, <strong>gratuito</strong>${dir}${c.quota_listino ? ` — anziché ${eur(c.quota_listino)} di listino` : ''}`
    if (c.quota_ceiv != null) return `per la Vostra impresa, iscritta alla Cassa Edile, <strong>${eur(c.quota_ceiv)}</strong>${c.quota_listino ? ` anziché ${eur(c.quota_listino)} di listino` : ''} (IVA esclusa)`
    return c.quota_listino ? `quota ${eur(c.quota_listino)} (IVA esclusa)` : ''
  }
  const listino = c.quota_listino ? `quota di listino ${eur(c.quota_listino)} (IVA esclusa)` : ''
  if (c.ceiv_gratuito) return `${listino}${listino ? '; ' : ''}<strong>con l'iscrizione alla Cassa Edile sarebbe gratuito</strong>${dir}`
  if (c.quota_ceiv != null) return `${listino}${listino ? '; ' : ''}con l'iscrizione alla Cassa Edile <strong>${eur(c.quota_ceiv)}</strong>`
  return listino
}

/* il paragrafo per l'impresa */
function formazioneHtml(f: Formazione, proposte: Proposta[], cfg: Record<string, string>): string {
  const ceiv = f.ceiv || 'da_verificare'
  const etich = (f.tipi_etichette || []).filter(Boolean)
  // per ogni tipo spuntato: i corsi con una data in programma, al massimo tre; se nessuno ha date, lo si dice
  const perTipo = new Map<string, Proposta[]>()
  for (const p of proposte) { if (!perTipo.has(p.tipo)) perTipo.set(p.tipo, []); perTipo.get(p.tipo)!.push(p) }
  const righe: string[] = []
  for (const [tipo, lista] of perTipo) {
    const conDate = lista.filter((c) => (c.date || []).length).slice(0, 3)
    const etichetta = lista[0]?.etichetta || tipo
    if (!conDate.length) { righe.push(`<li style="margin:0 0 8px"><strong>${esc(etichetta)}</strong>: nessuna edizione in programma nel trimestre — l'Ufficio Corsi vi indicherà la prima data utile.</li>`); continue }
    for (const c of conDate) {
      const date = c.date.map((d) => d.fine && d.fine !== d.inizio ? `${dIt(d.inizio)} → ${dIt(d.fine)}` : dIt(d.inizio)).join(', ')
      righe.push(`<li style="margin:0 0 8px"><strong>${esc(titoloBello(c.titolo))}</strong>${c.ore ? ` (${c.ore} ore${c.validita && c.validita !== 'MAI' ? `, valido ${esc(c.validita.toLowerCase())}` : ''})` : ''}<br>prossime date: ${esc(date)}${c.date[0]?.sede && c.date[0].sede !== 'PADOVA' ? ` (${esc(c.date[0].sede.toLowerCase())})` : ''}<br><span style="color:#555">${quotaTesto(c, ceiv)}</span></li>`)
    }
  }
  const contatto = `${esc(cfg.ufficio_corsi_nomi || 'Ufficio Corsi Sicurezza')} — <a href="mailto:${esc(cfg.ufficio_corsi_email || 'corsi@formedilpadova.it')}" style="color:#e7500f">${esc(cfg.ufficio_corsi_email || 'corsi@formedilpadova.it')}</a>`
  return `
    <h3 style="color:#e7500f;font-size:15px;margin:22px 0 8px;border-bottom:2px solid #e7500f;padding-bottom:5px">Formazione: possiamo aiutarvi</h3>
    <p style="line-height:1.7;margin:0 0 10px">Durante la visita il nostro tecnico ha rilevato che manca o va aggiornata la formazione per: <strong>${esc(etich.join(', ') || 'vedi rapporto')}</strong>.${f.nota ? ` <span style="color:#555">(${esc(f.nota)})</span>` : ''}</p>
    <p style="line-height:1.7;margin:0 0 6px">Formedil Padova tiene questi corsi nella propria sede. ${ceiv === 'si' ? 'Per le imprese iscritte alla Cassa Edile la maggior parte dei corsi di sicurezza è <strong>gratuita</strong>.' : 'Per le imprese iscritte alla Cassa Edile la maggior parte dei corsi di sicurezza è <strong>gratuita</strong>: vale la pena tenerne conto.'} Le prossime date in programma:</p>
    <ul style="margin:0 0 12px 18px;padding:0;line-height:1.55">${righe.join('')}</ul>
    <p style="line-height:1.7;margin:0 0 14px">Per iscrizioni e informazioni: ${contatto}${cfg.formazione_programmazione_url ? ` · <a href="${esc(cfg.formazione_programmazione_url)}" style="color:#e7500f">programmazione completa dei corsi</a>` : ''}. L'Ufficio Corsi ha già ricevuto questa segnalazione e può contattarvi.</p>`
}

/* la mail interna all'ufficio corsi, tutta letta dal database e dal verbale */
function ufficioCorsiHtml(f: Formazione, ctx: { nrVerbale: string; dataVisita: string; cantiere: string; tecnico: string; tecnico2: string }, proposte: Proposta[]): string {
  const riga = (k: string, v?: string | null) => v ? `<tr><td style="padding:3px 10px 3px 0;color:#666;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:3px 0">${esc(v)}</td></tr>` : ''
  const ceiv = f.ceiv === 'si' ? 'iscritta' : f.ceiv === 'no' ? 'NON iscritta' : 'da verificare'
  const conDate = proposte.filter((p) => (p.date || []).length)
  return `
    <p style="line-height:1.7;margin:0 0 10px">Buongiorno,<br>durante una visita in cantiere il nostro tecnico ha rilevato <strong>formazione mancante o da aggiornare</strong> e ha chiesto che l'impresa venga contattata dall'Ufficio Corsi. L'impresa ha ricevuto, insieme al verbale, l'elenco delle prossime date in programma per questi corsi.</p>
    <table style="border-collapse:collapse;font-size:13px;margin:0 0 12px">
      ${riga('Impresa', f.impresa)}${riga('Partita IVA', f.partita_iva)}${riga('Cassa Edile', ceiv)}
      ${riga('E-mail impresa', f.impresa_email)}${riga('Telefono impresa', f.impresa_tel)}
      ${riga('Presente in cantiere', f.referente)}${riga('Telefono del presente', f.referente_tel)}
      ${riga('Cantiere', ctx.cantiere)}${riga('Verbale', `${ctx.nrVerbale || ''}${ctx.dataVisita ? ' del ' + ctx.dataVisita : ''}`)}
      ${riga('Tecnico', [ctx.tecnico, ctx.tecnico2].filter(Boolean).join(' e '))}
    </table>
    <p style="line-height:1.7;margin:0 0 6px"><strong>Formazione mancante:</strong> ${esc((f.tipi_etichette || []).join(', ') || '—')}</p>
    ${f.nota ? `<p style="line-height:1.7;margin:0 0 12px"><strong>Nota del tecnico:</strong> ${esc(f.nota)}</p>` : ''}
    ${conDate.length ? `<p style="line-height:1.7;margin:0 0 6px;color:#555">Corsi proposti all'impresa: ${esc(conDate.map((c) => `${titoloBello(c.titolo)} (${c.date.map((d) => dIt(d.inizio)).join(', ')})`).join('; '))}.</p>` : '<p style="line-height:1.7;margin:0 0 6px;color:#555">Nessuna edizione in programma per questi corsi nel trimestre: all\\'impresa è stato indicato di rivolgersi a voi.</p>'}
    <p style="line-height:1.7;margin:12px 0 0;color:#666;font-size:12px">Questa segnalazione parte da sola dal gestionale visite quando il tecnico manda il verbale. L'esito del contatto (contattata, iscritta, non interessata) lo registra la segreteria dell'Area nell'app.</p>`
}

/* tutto il giro: proposte, paragrafo, e dopo l'invio la mail interna + la riga nel registro */
async function formazionePrepara(f: Formazione | undefined, authHeader: string): Promise<{ html: string; proposte: Proposta[]; cfg: Record<string, string> } | null> {
  if (!f || !((f.tipi || []).length || (f.nota || '').trim())) return null
  const sbUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } })
  const [{ data: prop, error: ep }, { data: cfgRows }] = await Promise.all([
    sbUser.rpc('formazione_proposte', { p_tipi: f.tipi || [] }),
    sbUser.from('s_config').select('chiave, valore').in('chiave', ['ufficio_corsi_email', 'ufficio_corsi_nomi', 'formazione_programmazione_url']),
  ])
  if (ep) console.warn('formazione_proposte:', ep.message)
  const cfg: Record<string, string> = Object.fromEntries((cfgRows || []).map((r: { chiave: string; valore: string }) => [r.chiave, r.valore]))
  const proposte = (Array.isArray(prop) ? prop : []) as Proposta[]
  return { html: formazioneHtml(f, proposte, cfg), proposte, cfg }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })""", 'funzioni')

# 2. il body: anche formazione
sost("""    const { to, subject, nrVerbale, cantiere, impresa, tecnico, tecnico2, comune, cantIndirizzo, dataVisita, driveFileId, fileName, campagna, rettifica, linkValuta } = await req.json()""",
     """    const { to, subject, nrVerbale, cantiere, impresa, tecnico, tecnico2, comune, cantIndirizzo, dataVisita, driveFileId, fileName, campagna, rettifica, linkValuta, formazione } = await req.json()
    /* formazione mancante (25/09/2026): il paragrafo per l'impresa si prepara qui; se la
       lettura fallisce la mail del verbale parte lo stesso, senza il paragrafo */
    let formaz: { html: string; proposte: Proposta[]; cfg: Record<string, string> } | null = null
    if (formazione && !rettifica) {
      try { formaz = await formazionePrepara(formazione as Formazione, req.headers.get('Authorization') || '') }
      catch (e) { console.warn('formazione:', (e as Error).message); formaz = null }
    }""", 'body')

# 3. il paragrafo nel corpo (solo verbale normale, non rettifica)
sost("""    <p style="margin:0 0 24px">Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.</p>`
    }""", """    ${formaz ? formaz.html : ''}
    <p style="margin:0 0 24px">Rimanendo a disposizione per ogni eventuale chiarimento porgiamo distinti saluti.</p>`
    }""", 'paragrafo')

# 4. dopo l'invio: la mail all'ufficio corsi e la riga nel registro
sost("""    return new Response(JSON.stringify({ ok:true, messageId: gmailData.id }),""",
     """    /* ── la segnalazione all'ufficio corsi (25/09/2026): parte solo se la mail
       all'impresa è partita. Non fa mai fallire la risposta: se non riesce, lo dice. */
    let esitoFormazione: Record<string, unknown> | null = null
    if (formaz && formazione) {
      const f = formazione as Formazione
      esitoFormazione = {}
      try {
        const aChi = (formaz.cfg.ufficio_corsi_email || '').trim()
        if (!aChi) throw new Error('ufficio_corsi_email non impostato in s_config')
        const ctx = { nrVerbale: String(nrVerbale || ''), dataVisita: String(dataVisita || ''), cantiere: [cantIndirizzo, comune].filter(Boolean).join(' – ') || String(cantiere || ''), tecnico: String(tecnico || ''), tecnico2: String(tecnico2 || '') }
        const oggettoUC = `${PREFISSO_OGGETTO} Formazione mancante rilevata in cantiere: ${f.impresa || impresa || 'impresa'}${nrVerbale ? ` (verbale ${nrVerbale})` : ''}`
        const htmlUC = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:20px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;overflow:hidden;margin:0 auto"><tr><td style="background:#e7500f;padding:14px 24px"><p style="margin:0;color:#fff;font-size:11px;letter-spacing:1px;text-transform:uppercase">Formedil Padova · Area Sicurezza e Salute → Ufficio Corsi</p></td></tr>
<tr><td style="padding:24px 28px">${ufficioCorsiHtml(f, ctx, formaz.proposte)}</td></tr></table></body></html>`
        const rawUC = buildMime({ from: 'cptpd@did.formedilpadova.it', to: [aChi], subject: oggettoUC, html: htmlUC, attachmentB64: '', attachmentName: '' })
        const rUC = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          { method: 'POST', headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: rawUC }) })
        const dUC = await rUC.json()
        if (!rUC.ok || dUC.error) throw new Error(dUC.error?.message || JSON.stringify(dUC))
        esitoFormazione.ufficio_corsi = 'inviata'; esitoFormazione.a = aChi
        // la riga nel registro (service role: il tecnico non ha il permesso di scrivere qui)
        const sbAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const riga = {
          visita_id: (formazione as { visita_id?: string }).visita_id || null, nr_verbale: nrVerbale || null, data_visita: dataVisitaIso(dataVisita),
          tecnico_id: f.tecnico_id || null, tecnico_nome: [tecnico, tecnico2].filter(Boolean).join(' e ') || null,
          impresa_id: f.impresa_id || null, impresa_nome: f.impresa || impresa || null, partita_iva: f.partita_iva || null, ceiv: f.ceiv || 'da_verificare',
          cantiere_desc: ctx.cantiere || null, referente: f.referente || null, telefono: f.referente_tel || f.impresa_tel || null, email: f.impresa_email || null,
          tipi: f.tipi || [], nota: f.nota || null, mail_a: aChi, mail_inviata_il: new Date().toISOString(), mail_esito: 'inviata', stato: 'inviata',
        }
        const { error: eIns } = await sbAdmin.from('s_formazione_segnalazioni').upsert(riga, { onConflict: 'visita_id', ignoreDuplicates: false })
        if (eIns) { console.warn('s_formazione_segnalazioni:', eIns.message); esitoFormazione.registro = 'non scritto: ' + eIns.message }
        else esitoFormazione.registro = 'scritta'
      } catch (e) {
        console.warn('segnalazione ufficio corsi:', (e as Error).message)
        esitoFormazione.errore = (e as Error).message
      }
    }

    return new Response(JSON.stringify({ ok:true, messageId: gmailData.id, formazione: esitoFormazione }),""", 'dopo invio')

# 5. helper data (dataVisita arriva come gg/mm/aaaa dal gestionale)
sost("""const PREFISSO_OGGETTO = 'FORMEDIL Padova -AREA SICUREZZA E SALUTE-'""",
     """const PREFISSO_OGGETTO = 'FORMEDIL Padova -AREA SICUREZZA E SALUTE-'
const dataVisitaIso = (s?: string | null) => { const m = String(s || '').match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\\d{4}-\\d{2}-\\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : null) }""", 'helper data')

io.open(P, 'w', encoding='utf-8', newline='').write(s); print('send-verbale patch ok')
