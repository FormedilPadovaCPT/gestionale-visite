#!/usr/bin/env python3
"""
Validatore d'integrita' di index.html per il Gestionale Visite.

Nasce per prevenire l'incidente del 02/06/2026 (upload di un index.html
troncato -> app in crash). Da eseguire SEMPRE prima di caricare il file
sul repo, e in automatico via GitHub Actions (vedi .github/workflows/valida-index.yml).

Uso:
    python tools/valida_index.py [percorso_index.html]

Esce con codice 0 se il file e' integro, 1 se trova problemi.
"""
import re
import sys
import pathlib

def valida(path: str) -> int:
    p = pathlib.Path(path)
    if not p.exists():
        print(f"ERRORE: file non trovato: {path}")
        return 1

    s = p.read_text(encoding="utf-8")
    problemi = []

    # 1) Il file deve chiudersi correttamente (il troncamento taglia proprio la coda)
    if not s.rstrip().endswith("</html>"):
        problemi.append("Il file NON termina con </html> -> probabile troncamento.")

    # 2) Tag <script> bilanciati
    ap = len(re.findall(r"<script\b", s, re.I))
    ch = len(re.findall(r"</script>", s, re.I))
    if ap != ch:
        problemi.append(f"Tag <script> sbilanciati: {ap} aperti / {ch} chiusi.")

    # 3) Tag <style> bilanciati
    sa = len(re.findall(r"<style\b", s, re.I))
    sc = len(re.findall(r"</style>", s, re.I))
    if sa != sc:
        problemi.append(f"Tag <style> sbilanciati: {sa} aperti / {sc} chiusi.")

    # 4) Parentesi graffe del JS bilanciate (controllo grezzo ma efficace sui troncamenti)
    g_ap, g_ch = s.count("{"), s.count("}")
    if g_ap != g_ch:
        problemi.append(f"Parentesi graffe sbilanciate: {{ {g_ap} vs }} {g_ch} (diff {g_ap - g_ch}).")

    # 5) Il client Supabase deve essere presente (marcatore che l'app e' completa)
    if "createClient" not in s:
        problemi.append("Manca 'createClient' -> il file potrebbe essere incompleto.")

    # 6) Dimensione minima di sanita' (un index.html valido supera ampiamente i 400 KB)
    if len(s) < 400_000:
        problemi.append(f"Dimensione sospetta: {len(s)} byte (< 400 KB).")

    if problemi:
        print("VALIDAZIONE FALLITA:")
        for x in problemi:
            print("  - " + x)
        return 1

    print(f"OK: index.html integro ({len(s):,} byte, {ap} script, graffe {g_ap} bilanciate).")
    return 0

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    sys.exit(valida(target))
