# Edge function del gestionale visite

Girano su Supabase (progetto `utdantrfugnmqsuujxbe`) e sono chiamate
da `index.html`. Fino al 04/09/2026 il loro codice viveva **solo** su
Supabase e su un disco: qui c'è la copia versionata.

| Funzione | A cosa serve | Chiamata da |
|---|---|---|
| `request-access` | Un consigliere chiede l'accesso in sola lettura: registra la richiesta e avvisa la segreteria. Pubblica (`verify_jwt = false`), perché chi la usa un account non ce l'ha ancora — con dedup per email e un tetto di 5 richieste ogni 10 minuti. | schermata di accesso |
| `upload-foto` | Carica su Drive le foto del verbale, in una sottocartella per verbale; sa anche rileggerle (`download: true`) quando si rigenera il PDF. | form della visita |
| `upload-pdf` | Deposita il PDF del verbale nella cartella verbali. | invio verbale |
| `send-relazione-stage` | Archivia nel vault e invia la relazione di visita allo stagista. | pagina Incarichi |

## Secret da configurare

Si impostano nel pannello Supabase, **non** stanno qui dentro:

- `GOOGLE_SERVICE_ACCOUNT_JSON` — il service account con delega di
  dominio; serve a tutte. Scope richiesti: `gmail.send` e `drive`.
- `DRIVE_FOLDER_ID` — cartella delle foto dei verbali (`upload-foto`).
- `DRIVE_VERBALI_FOLDER_ID` — cartella dei PDF dei verbali (`upload-pdf`).
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` — forniti da Supabase.

`send-relazione-stage` non ha secret propri: destinatari e cartella di
archivio li legge da `s_config` (`didattica_referenti`,
`stage_relazione_cc`, `stage_relazione_cartella`), così si cambiano
senza rimettere mano al codice.

## Manca `send-verbale`

È l'unica non ancora qui. Nel suo HTML c'è un **URL firmato** del banner
mail, con il token in chiaro e scadenza 2032: vale per quel solo file
(`firme-tecnici/Banner mail cantieri.png`) e viaggia già dentro ogni
verbale spedito alle imprese, quindi non è un segreto operativo — ma
resta una credenziale, e su un repository pubblico non ci va senza
averlo deciso. Si sistema togliendo il token: o rendendo pubblico quel
file nel bucket, o leggendo l'indirizzo da `s_config`.

## Se ne modifichi una

Il file qui è una copia: **il deploy resta l'operazione che conta**.
Dopo aver cambiato il codice va rideployata su Supabase, altrimenti
questo repository racconta una cosa e la produzione ne fa un'altra.
