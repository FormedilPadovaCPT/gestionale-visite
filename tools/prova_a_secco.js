/* PROVA A SECCO DEL GESTIONALE — da incollare nella console del browser, sull'app aperta con un accesso vero.
   (03/10/2026, controllo prima dei primi verbali del 05/10)

   Che cosa fa: da quel momento la pagina LEGGE dal database come sempre, ma ogni SCRITTURA
   (insert, update, delete, funzioni che scrivono, funzioni edge) viene fermata, messa da parte in
   window.__secco.scritture e si finge riuscita. Si può compilare un verbale, premere «Definitivo»,
   riaprire un verbale e risalvarlo: nel database non arriva niente, e in __secco.scritture c'è
   quello che la maschera avrebbe mandato. Ricaricando la pagina tutto torna normale.

   Perché così: lo script principale di index.html è un modulo, quindi le sue funzioni non si
   possono sostituire da fuori; e la pagina di prova in locale non può fare un accesso vero.
   Il client di Supabase però passa tutto da sb.rest.fetch e sb.fetch, che qui vengono avvolti
   (NON sostituiti: sono loro a mettere la chiave e il permesso nelle richieste di lettura).

   Due avvertenze imparate usandolo:
   - una scheda del browser in secondo piano rallenta i timer fino a uno al minuto: le attese
     vanno tenute corte, o la scheda va tenuta in primo piano;
   - i confirm() nativi bloccano la scheda: __conferme li registra e risponde __rispostaConferma.

   La prova gemella, dalla parte del database, è una transazione annullata che ripete le stesse
   scritture fingendo l'accesso di un tecnico (set local role authenticated + request.jwt.claims):
   insieme coprono tutta la catena maschera → database senza lasciare traccia. */
(() => {
  if (window.__secco) return 'già installata';
  // funzioni del database che leggono soltanto: passano. Tutte le altre vengono fermate.
  const LETTURA = new Set(('prossimo_numero_verbale,incarico_di_chi,incarichi_miei_aperti,is_coordinatore,is_direttore,'
    + 'is_presidenza,is_segreteria,deve_cambiare_password,impresa_previsita,committenti_duplicati,committenti_lista,'
    + 'committenti_simili,dash_macroaree,dash_macroaree_dettaglio,dash_ver_visite,rubrica_impresa_dettaglio,'
    + 'rubrica_imprese_cerca,rubrica_persona_dettaglio,rubrica_persone_cerca,visite_count_map,s_direzione_in_attesa,'
    + 'coord_avviso_verbali_stato,incarichi_avanzamento,osservatorio_controllo,imprese_senza_cf,persona_verbali').split(','));
  const reg = window.__secco = {
    scritture: [],
    attivo: true,
    ritardoNumero: 0,                                        // millisecondi: finge un telefono con poca linea
    finto: { chiudi_verbale: { ok: true, mancanze: [] } }    // risposta finta delle funzioni fermate
  };
  const avvolgi = (vero) => async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input.url || String(input));
    const metodo = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    if (!reg.attivo || url.includes('/auth/v1/') || metodo === 'GET' || metodo === 'HEAD') return vero(input, init);
    const m = /\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(url);
    if (m && LETTURA.has(m[1])) {
      if (m[1] === 'prossimo_numero_verbale' && reg.ritardoNumero) await new Promise((r) => setTimeout(r, reg.ritardoNumero));
      return vero(input, init);
    }
    let corpo = init.body; try { corpo = JSON.parse(corpo); } catch (e) { /* non è JSON: resta com'è */ }
    reg.scritture.push({ method: metodo, url: url.replace(/^https:\/\/[^/]+/, ''), body: corpo });
    const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (m) return J(m[1] in reg.finto ? reg.finto[m[1]] : null);
    if (url.includes('/functions/v1/')) return J({ ok: true, secco: true });
    let pref = ''; try { const h = init.headers; pref = (h && (h.get ? h.get('Prefer') : (h.Prefer || h.prefer))) || ''; } catch (e) { /* niente */ }
    if (/return=representation/.test(pref)) return J([], metodo === 'POST' ? 201 : 200);
    return new Response(null, { status: metodo === 'POST' ? 201 : 204 });
  };
  window.fetch = avvolgi(window.fetch.bind(window));
  window.sb.rest.fetch = avvolgi(window.sb.rest.fetch);
  window.sb.fetch = avvolgi(window.sb.fetch);
  window.__conferme = []; window.__rispostaConferma = true;
  window.confirm = (t) => { window.__conferme.push(String(t)); return window.__rispostaConferma; };
  return 'installata: le scritture finiscono in __secco.scritture e non arrivano al database';
})();
