# -*- coding: utf-8 -*-
"""Sposta un blocco di index.html in un modulo a sé, dentro una fabbrica (13/11/2026).

Uso:  python tools/estrai_blocco.py <riga_da> <riga_a> <file.js> <nomeFabbrica> "<dip1,dip2,...>" "<che cosa contiene>" [nomi restituiti]

Non cambia una riga del blocco. Nel file centrale lascia, nello stesso punto, la chiamata
della fabbrica, e aggiunge l'import in testa al modulo (dopo l'ultimo import di un modulo
estratto). Se la fabbrica deve restituire dei nomi usati dal resto del file, si passano
come settimo argomento («a,b,c»): la chiamata diventa `const { a, b, c } = crea…(…)`.
Prima: tools/analizza_blocco.py. Dopo: tsc --checkJs sul file nuovo, le due liste di
deploy-pages.yml, le prove (metodo in tools/LEGGIMI-estrarre-un-blocco.md).
"""
import io, sys, re, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # la console di Windows è cp1252

da, a = int(sys.argv[1]), int(sys.argv[2])
nuovo, fabbrica, dip, cosa = sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
resi = [x.strip() for x in sys.argv[7].split(',')] if len(sys.argv) > 7 and sys.argv[7].strip() else []
assert not os.path.exists(nuovo), nuovo + ' esiste già'
DIP = '{ ' + ', '.join(x.strip() for x in dip.split(',')) + ' }'

t = io.open('index.html', encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in t else '\n'
righe = t.split(nl)
blocco = righe[da - 1:a]
print('prima riga :', blocco[0][:90])
print('ultima riga:', blocco[-1][:90])

testa = [
    '/* ============================================================',
    '   ' + cosa,
    '',
    '   MODULO ESTRATTO DAL FILE CENTRALE index.html (revisione di tenuta del 13/11/2026).',
    '   Il codice è lo stesso che stava nel file centrale: nessuna riga è cambiata. Vive',
    '   dentro una fabbrica che riceve dal modulo inline le sole cose di cui ha bisogno:',
    '   se manca una dipendenza si vede alla prima chiamata.',
    '',
    '   Chi lo usa (index.html):',
    "     import { " + fabbrica + " } from './" + nuovo + "'",
    '     ' + (('const { ' + ', '.join(resi) + ' } = ') if resi else '') + fabbrica + '(' + DIP + ')',
    '   ⚠️ Un file nuovo va aggiunto alle due liste di .github/workflows/deploy-pages.yml',
    '   (paths e copia in _site): senza, non viene pubblicato.',
    '   ============================================================ */',
    'export function ' + fabbrica + '(' + DIP + ') {',
]
coda = (['return { ' + ', '.join(resi) + ' }'] if resi else []) + ['}', '']
io.open(nuovo, 'w', encoding='utf-8', newline='').write(nl.join(testa + blocco + coda))

chiamata = [
    '',
    '// (13/11/2026) ' + cosa.split('.')[0] + ': il codice sta in ' + nuovo + ', modulo estratto dal file centrale.',
    (('const { ' + ', '.join(resi) + ' } = ') if resi else '') + fabbrica + '(' + DIP + ')',
]
righe[da - 1:a] = chiamata
imp = [i for i, r in enumerate(righe) if re.match(r"^import \{ crea\w+ \} from '\./[\w.-]+\.js", r)]
assert imp, 'non trovo gli import dei moduli estratti'
righe.insert(imp[-1] + 1, "import { " + fabbrica + " } from './" + nuovo + "?v=1'   // (13/11/2026) alzare ?v= quando il file cambia")
io.open('index.html', 'w', encoding='utf-8', newline='').write(nl.join(righe))
print('ok:', len(blocco), 'righe spostate in', nuovo)
