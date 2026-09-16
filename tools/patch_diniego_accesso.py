"""Bottone «Accesso negato al cantiere» in dashboard (16/09/2026).

La funzione vive in diniego-accesso.js; qui si aggiungono solo:
bottone, due regole di stile, riga di caricamento dello script.
Regola del file grande: backup, sostituzioni con assert su una sola
occorrenza, controllo della coda.
"""
import pathlib, shutil, datetime

p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text(encoding='utf-8')
stampo = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
shutil.copyfile(p, p.with_name(f'index_pre_diniego_{stampo}.html.bak'))

def rep(a, b):
    global s
    n = s.count(a)
    assert n == 1, f'{n} occorrenze di: {a[:80]}'
    s = s.replace(a, b)

# 1. bottone accanto a «Segnala un cantiere attivo»
rep('&#128205; Segnala un cantiere attivo</button><button id="btn-qr-servizi"',
    '&#128205; Segnala un cantiere attivo</button>'
    '<button id="btn-diniego-dash" title="Segnala alla segreteria che ti è stato negato l\'accesso a un cantiere" '
    'style="flex:2;min-width:220px;padding:12px;font-size:15px;border-radius:10px;background:#fff;border:2px solid #c0392b;color:#c0392b;font-weight:600;cursor:pointer">'
    '&#128683; Accesso negato al cantiere</button><button id="btn-qr-servizi"')

# 2. stile: chi è in sola lettura non segnala; sul telefono a tutta larghezza
rep('.btn-outline{background:transparent;border:2px solid var(--orange);color:var(--orange)}',
    '.btn-outline{background:transparent;border:2px solid var(--orange);color:var(--orange)}\n'
    'body.viewer-mode #btn-diniego-dash{display:none!important}')
rep('  #dash-segnala-wrap #btn-segnala-dash{grid-column:1/-1}',
    '  #dash-segnala-wrap #btn-segnala-dash,#dash-segnala-wrap #btn-diniego-dash{grid-column:1/-1}')

# 3. lo script, dopo la relazione stage
rep('<script src="stage-relazione.js"></script>',
    '<script src="stage-relazione.js"></script>\n'
    '<!-- accesso negato al cantiere: il tecnico segnala, la segreteria gestisce -->\n'
    '<script src="diniego-accesso.js?v=1"></script>')

assert s.rstrip().endswith('</html>')
p.write_text(s, encoding='utf-8', newline='\r\n')   # il file di lavoro e' CRLF
print('ok', len(s))
