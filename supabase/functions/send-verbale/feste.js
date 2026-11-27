/* Veste delle feste della mail del verbale (27/11/2026, scelta dell'utente).
   Per un periodo il banner di sempre («Servizio di Consulenza Tecnica in Cantiere»)
   lascia il posto a quello natalizio, e dopo i saluti c'è un riquadro d'augurio.
   La lettera non cambia. Fuori dal periodo la mail torna da sola com'era.
   Grafica C «Il cantiere a riposo» e frase 5, scelte fra le proposte in
   5_MEDIA/PUBBLICAZIONI/2026_11_Natale-mail-verbale-imprese/.
   ⚠️ Mai nella rettifica: è un errore nostro, e gli auguri stonerebbero (come il questionario).
   Modulo puro: niente import, così la prova lo carica con node. */

export const FESTE = {
  dal: '2026-12-01',
  al: '2027-01-06',
  // Pubblicato da GitHub Pages: deploy-pages copia ogni .png della radice del repo.
  // Il sito è /gestionale-visite/ (nome del repo), non /gestionale/: provato il 27/11/2026.
  banner: 'https://formedilpadovacpt.github.io/gestionale-visite/natale-2026-verbale.png',
  alt: 'Buone Feste da FORMEDIL PADOVA – Area Sicurezza e Salute',
  titolo: 'Buon riposo, e a presto in cantiere',
  frase: "La sicurezza si costruisce insieme, un giorno alla volta. Grazie per la collaborazione del 2026 e auguri di buone feste dall'Area Sicurezza e Salute di FORMEDIL PADOVA.",
};

/* Il giorno si legge sull'ora di Roma, non su UTC: una mail spedita alle 00:30 del 1° dicembre
   ha già la veste delle feste, una spedita alle 00:30 del 7 gennaio non più. */
export function giornoRoma(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function inFeste(d = new Date(), f = FESTE) {
  const g = giornoRoma(d);
  return g >= f.dal && g <= f.al;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Il riquadro d'augurio: fondo grigio scuro del banner, titolo verde, testo bianco.
    bgcolor anche come attributo, perché Outlook per Windows ignora a volte lo stile. */
export function augurioHtml(f = FESTE) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
    <tr><td bgcolor="#3f444c" style="background:#3f444c;border-radius:8px;padding:18px 22px">
      <p style="margin:0 0 6px;font-size:17px;font-weight:bold;color:#95c22f">${esc(f.titolo)}</p>
      <p style="margin:0;line-height:1.65;font-size:14px;color:#ffffff">${esc(f.frase)}</p>
    </td></tr>
    </table>`;
}
