"""Ripristina il verbale PDF com'era prima del 13/09/2026.

Il 13/09/2026 genPDF è passata allo stile «ciclo con rilievi»: il disegno sta in
verbale-pdf.js (commit 0769863). Il corpo di genPDF di prima, con bande arancioni e
tabelle a griglia, è conservato identico in
tools/verbale_precedente/genPDF_fino_al_2026-09-13.js, estratto dal commit 2fc6efe
(tag git verbale-precedente-2026-09-13). Questo script lo rimette al posto di
quello nuovo.

Uso:
  python tools/ripristina_verbale_precedente.py              # modifica index.html, con backup
  python tools/ripristina_verbale_precedente.py --uscita X   # prova: scrive in X, index.html resta com'è

verbale-pdf.js e logo-pdf.jpg possono restare pubblicati: la genPDF di prima non li usa.
Dopo il ripristino: tools/valida_index.py, un PDF di prova, commit e push.
Stessa regola del file grande: mai Edit diretto su index.html.
"""
import pathlib, shutil, datetime, sys

D = pathlib.Path(__file__).resolve().parent.parent
P = D / "index.html"
VECCHIA = pathlib.Path(__file__).resolve().parent / "verbale_precedente" / "genPDF_fino_al_2026-09-13.js"
INIZIO = "async function genPDF(vid, output='save'){"
FINE = "\n// ── GESTIONE FIRME TECNICI"

uscita = None
if "--uscita" in sys.argv:
    uscita = pathlib.Path(sys.argv[sys.argv.index("--uscita") + 1])

raw = P.read_bytes()
crlf = b"\r\n" in raw[:5000]
s = raw.decode("utf-8").replace("\r\n", "\n")

testo = VECCHIA.read_text(encoding="utf-8").replace("\r\n", "\n")
vecchia = testo[testo.index(INIZIO):]  # via il commento in testa al file
assert "VerbalePDF" not in vecchia and vecchia.endswith("}\n"), "il file della genPDF di prima non è quello atteso"

assert s.count(INIZIO) == 1 and s.count(FINE) == 1, "in index.html i marcatori di genPDF non ci sono una volta sola"
i, j = s.index(INIZIO), s.index(FINE)
if "VerbalePDF" not in s[i:j]:
    print("genPDF è già quella di prima: niente da fare")
    sys.exit(0)

s = s[:i] + vecchia + s[j:]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")

if uscita:
    uscita.write_bytes(out)
    print("prova scritta in", uscita, "- index.html non toccato")
else:
    bak = D / f"index_pre_ripristinoverbale_{datetime.datetime.now():%Y%m%d_%H%M%S}.html.bak"
    shutil.copy2(P, bak)
    P.write_bytes(out)
    print("ok: genPDF di prima rimessa in index.html; backup", bak.name)
