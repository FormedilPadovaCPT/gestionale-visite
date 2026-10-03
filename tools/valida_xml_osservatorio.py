#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Valida i cinque file XML per l'Osservatorio nazionale contro gli schemi XSD, PRIMA di caricarli.

Uso:
    python tools/valida_xml_osservatorio.py <cartella-o-file.xml> [...] [--schemi <cartella degli XSD>]

  · Dando una cartella, prende i file che cominciano per Visite_, Cantieri_, Imprese_,
    Committenti_, Tecnici_ (i nomi che dà il gestionale) o che contengono quelle parole.
  · Gli schemi (SchemaVisita.xsd, SchemaCantiere.xsd, SchemaImpresa.xsd, SchemaCommittente.xsd,
    SchemaTecnico.xsd) sono quelli di Cresme: di norma stanno in
    9_APPLICATIVI/OSSERVATORIO VISITE 2026/ e lo script li cerca lì.

Oltre allo schema controlla ciò che lo schema non vede:
  · ogni cantiere, impresa e tecnico citato da una visita è nel suo file, e ogni committente
    citato da un cantiere è nel file dei committenti;
  · i valori «di ripiego» che lo schema lascia passare ma che non devono più uscire
    (tipo di intervento fuori da 1-4): dal 03/10/2026 l'esportazione non li scrive.

Esce con 0 se tutto è a posto, con 1 se anche un solo controllo fallisce.
«Valido» non vuol dire «giusto»: lo schema non sa se un dato è vero.
Serve lxml (pip install lxml).
"""
import argparse
import pathlib
import sys

try:
    from lxml import etree
except ImportError:  # pragma: no cover
    sys.stderr.write("Serve lxml: pip install lxml\n")
    sys.exit(2)

TIPI = {
    "visite": ("SchemaVisita.xsd", "visita"),
    "cantieri": ("SchemaCantiere.xsd", "cantiere"),
    "imprese": ("SchemaImpresa.xsd", "impresa"),
    "committenti": ("SchemaCommittente.xsd", "committente"),
    "tecnici": ("SchemaTecnico.xsd", "tecnico"),
}
SCHEMI_PREDEFINITI = [
    pathlib.Path(__file__).resolve().parents[3] / "OSSERVATORIO VISITE 2026",
    pathlib.Path(__file__).resolve().parent / "osservatorio_xsd",
]


def tipo_di(percorso):
    nome = percorso.name.lower()
    for tipo in TIPI:
        if tipo in nome:
            return tipo
    return None


def raccogli(argomenti):
    trovati = {}
    for a in argomenti:
        p = pathlib.Path(a)
        candidati = sorted(p.glob("*.xml")) if p.is_dir() else [p]
        for f in candidati:
            t = tipo_di(f)
            if not t:
                continue
            if t in trovati:
                raise SystemExit("Due file per «%s»: %s e %s. Indica i file uno per uno." % (t, trovati[t].name, f.name))
            trovati[t] = f
    return trovati


def testo(nodo, tag):
    figlio = nodo.find(tag)
    return (figlio.text or "").strip() if figlio is not None else ""


def main():
    ap = argparse.ArgumentParser(description="Valida gli XML per l'Osservatorio contro gli XSD")
    ap.add_argument("percorsi", nargs="+", help="cartella con i cinque file, oppure i file")
    ap.add_argument("--schemi", help="cartella degli XSD")
    a = ap.parse_args()

    cartelle = [pathlib.Path(a.schemi)] if a.schemi else SCHEMI_PREDEFINITI
    schemi = next((c for c in cartelle if (c / "SchemaVisita.xsd").is_file()), None)
    if schemi is None:
        sys.stderr.write("Non trovo gli schemi XSD in: %s\nIndica la cartella con --schemi.\n" % ", ".join(str(c) for c in cartelle))
        return 2

    file = raccogli(a.percorsi)
    errori = 0
    alberi = {}
    for tipo, (xsd, _elem) in TIPI.items():
        f = file.get(tipo)
        if f is None:
            print("MANCA   %-12s nessun file" % tipo)
            errori += 1
            continue
        try:
            schema = etree.XMLSchema(etree.parse(str(schemi / xsd)))
            albero = etree.parse(str(f))
        except (etree.XMLSyntaxError, etree.XMLSchemaParseError, OSError) as e:
            print("ERRORE  %-12s %s: %s" % (tipo, f.name, e))
            errori += 1
            continue
        alberi[tipo] = albero
        n = len(albero.getroot())
        if schema.validate(albero):
            print("VALIDO  %-12s %s (%d righe)" % (tipo, f.name, n))
        else:
            errori += 1
            print("NON VALIDO %-9s %s (%d righe): %d errori di schema" % (tipo, f.name, n, len(schema.error_log)))
            for riga in list(schema.error_log)[:15]:
                print("          riga %d: %s" % (riga.line, riga.message))
            if len(schema.error_log) > 15:
                print("          … e altri %d" % (len(schema.error_log) - 15))

    # ── quello che lo schema non vede ──
    if len(alberi) == len(TIPI):
        ids = {
            "cantieri": {testo(n, "cantiereId") for n in alberi["cantieri"].getroot()},
            "imprese": {testo(n, "impresaId") for n in alberi["imprese"].getroot()},
            "tecnici": {testo(n, "tecnicoId") for n in alberi["tecnici"].getroot()},
            "committenti": {testo(n, "committenteId") for n in alberi["committenti"].getroot()},
        }
        orfani = []
        for v in alberi["visite"].getroot():
            vid = testo(v, "visitaId")
            for tag, dove in (("cantiereId", "cantieri"), ("impresaId", "imprese"), ("tecnicoId", "tecnici"), ("secondoTecnicoId", "tecnici")):
                x = testo(v, tag)
                if x and x not in ids[dove]:
                    orfani.append("visita %s: %s «%s» non è nel file %s" % (vid, tag, x, dove))
        for c in alberi["cantieri"].getroot():
            x = testo(c, "cantiereCommittenteId")
            if x and x not in ids["committenti"]:
                orfani.append("cantiere %s: committente «%s» non è nel file committenti" % (testo(c, "cantiereId"), x))
        if orfani:
            errori += 1
            print("RIFERIMENTI  %d riferimenti a righe che non ci sono:" % len(orfani))
            for o in orfani[:15]:
                print("          " + o)
            if len(orfani) > 15:
                print("          … e altri %d" % (len(orfani) - 15))
        else:
            print("RIFERIMENTI  ogni cantiere, impresa, tecnico e committente citato è nel suo file")

        ripieghi = [testo(c, "cantiereId") for c in alberi["cantieri"].getroot() if testo(c, "cantiereTipInt") not in ("1", "2", "3", "4")]
        if ripieghi:
            errori += 1
            print("RIPIEGHI     %d cantieri con tipo di intervento fuori da 1-4 (valore di ripiego): %s%s"
                  % (len(ripieghi), ", ".join(ripieghi[:10]), "…" if len(ripieghi) > 10 else ""))
        else:
            print("RIPIEGHI     nessun tipo di intervento fuori da 1-4")
        nd_imp = sum(1 for c in alberi["cantieri"].getroot() if testo(c, "cantiereImporto") == "11")
        nd_dur = sum(1 for c in alberi["cantieri"].getroot() if testo(c, "cantiereDurata") == "7")
        nd_com = sum(1 for c in alberi["committenti"].getroot() if testo(c, "committenteTipo") == "3")
        print("NOTA         «Non disponibile» dichiarati: importo %d, durata %d, tipo del committente %d (ammessi dall'Osservatorio)" % (nd_imp, nd_dur, nd_com))

    print("\n%s" % ("TUTTO A POSTO: i file si possono caricare." if not errori else "NON CARICARE: %d controlli falliti." % errori))
    return 0 if not errori else 1


if __name__ == "__main__":
    sys.exit(main())
