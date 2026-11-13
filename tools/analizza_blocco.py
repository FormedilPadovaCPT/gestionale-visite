"""Analizza un blocco del modulo di index.html: che cosa usa da fuori, che cosa dà a fuori.
   python analizza_blocco.py <riga_da> <riga_a>"""
import re, io, sys, glob
da, a = int(sys.argv[1]), int(sys.argv[2])
righe = io.open('index.html', encoding='utf-8').read().split('\n')
# il modulo principale: da <script type="module"> alla sua chiusura
ini = next(i for i, r in enumerate(righe) if '<script type="module">' in r)
fin = next(i for i in range(ini + 1, len(righe)) if righe[i].strip().startswith('</script>'))
mod = righe[ini + 1:fin]
off = ini + 2   # numero di riga (da 1) della prima riga del modulo
DICH = re.compile(r'^(?:async\s+function\*?|function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)')
DICH_MULTI = re.compile(r'^(const|let|var)\s+(.+)')
dich = {}   # nome -> (riga, tipo)
for i, r in enumerate(mod):
    m = DICH.match(r)
    if m:
        tipo = r.split()[0] if not r.startswith('async') else 'function'
        dich.setdefault(m.group(1), (i + off, tipo))
        if tipo in ('const', 'let', 'var'):
            # dichiarazioni multiple sulla stessa riga: const a=1,b=2  (grossolano)
            for mm in re.finditer(r'[,;]\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=', r):
                dich.setdefault(mm.group(1), (i + off, tipo))
    m = re.match(r'^(?:const|let|var)\s*\{([^}]*)\}\s*=', r)
    if m:
        for n in m.group(1).split(','):
            n = n.split(':')[-1].strip()
            if n: dich.setdefault(n, (i + off, 'const'))
blocco_nomi = {n for n, (l, t) in dich.items() if da <= l <= a}
testo_blocco = '\n'.join(righe[da - 1:a])
testo_fuori = '\n'.join(righe[:da - 1] + righe[a:])
def senza_stringhe_e_commenti(t):
    t = re.sub(r'/\*.*?\*/', ' ', t, flags=re.S)
    t = re.sub(r'(?m)(^|[^:\\])//.*$', r'\1', t)
    return t
idb = set(re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)', senza_stringhe_e_commenti(testo_blocco)))
dip = sorted(n for n in idb if n in dich and n not in blocco_nomi)
print('== DIPENDENZE (dichiarate nel modulo, fuori dal blocco):', len(dip))
for n in dip:
    l, t = dich[n]
    riass = len(re.findall(r'(?<![\w$.])' + re.escape(n) + r'\s*(?:=(?!=)|\+=|-=|\+\+|--)', testo_fuori)) - (1 if t != 'function' else 0)
    nota = ''
    if t in ('let', 'var') and riass > 0: nota = '  !! riassegnata altrove (%d volte): serve un getter' % riass
    if t in ('const', 'let') and l > da: nota += '  !! dichiarata DOPO il blocco (riga %d): zona morta al momento della chiamata' % l
    print(f'  {n:28s} {t:9s} riga {l}{nota}')
# nomi del blocco usati fuori (resto di index.html, attributi on*, altri file js)
altri = ''
for f in glob.glob('*.js'):
    altri += io.open(f, encoding='utf-8', errors='ignore').read() + '\n'
usati = []
for n in sorted(blocco_nomi):
    k = len(re.findall(r'(?<![\w$])' + re.escape(n) + r'(?![\w$])', testo_fuori))
    j = len(re.findall(r'(?<![\w$])' + re.escape(n) + r'(?![\w$])', altri))
    if k or j: usati.append((n, k, j))
print('== NOMI DEL BLOCCO USATI FUORI:', len(usati))
for n, k, j in usati: print(f'  {n:28s} in index.html fuori dal blocco: {k}   in altri .js: {j}')
print('== window.* assegnati nel blocco:', sorted(set(re.findall(r'window\.([A-Za-z_$][\w$]*)\s*=', testo_blocco))))
print('== globali usati (window.X o nomi non dichiarati nel modulo, a campione):')
glob_noti = {'window','document','console','Promise','Array','Object','String','Number','Date','Math','JSON','Set','Map','setTimeout','fetch','FileReader','Blob','URL','XLSX','alert','confirm','navigator','location','parseInt','parseFloat','isNaN','Error','RegExp','Boolean','Intl','encodeURIComponent','atob','btoa','Uint8Array','undefined','null','true','false','this','new','return','if','else','for','while','const','let','var','function','async','await','try','catch','finally','throw','typeof','of','in','switch','case','break','continue','default','delete','void','instanceof','do','class','event','e','r','s','t','i','j','k','n','v','x','a','b','c','d','f','g','h','l','m','o','p','q','u','w','y','z'}
nd = sorted(n for n in idb if n not in dich and n not in glob_noti and re.search(r'(?<![\w$.\'"`])' + re.escape(n) + r'\s*\(', testo_blocco) and not re.search(r'(?:function\s+|[\(,]\s*|\b(?:const|let|var)\s+)' + re.escape(n) + r'\b', testo_blocco))
print('  funzioni chiamate non dichiarate nel modulo né nel blocco:', nd[:60])
