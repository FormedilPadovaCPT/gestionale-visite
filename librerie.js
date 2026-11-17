/* ============================================================
   LIBRERIE PESANTI CARICATE AL BISOGNO (17/11/2026, chiesto dall'utente:
   «l'accensione delle app tramite cellulare è lentissima»)

   Fino al 17/11 la pagina caricava, prima di mostrare qualsiasi cosa,
   anche le librerie di grafici (Chart.js), PDF (jsPDF + autotable) ed
   Excel (SheetJS): circa 1,3 MB di codice da leggere col processore del
   telefono, per funzioni che all'accensione non servono. Adesso si
   scaricano la prima volta che servono, e poi restano lì.

   Chi usa una di queste librerie aspetta prima che sia pronta:
       await libreria('pdf')     → window.jspdf.jsPDF con autoTable
       await libreria('xlsx')    → window.XLSX
       await libreria('chart')   → window.Chart
   Indirizzi e impronte (integrity) sono quelli che stavano nell'<head>.
   Se la rete manca la promessa fallisce con un messaggio chiaro, e il
   tentativo successivo riprova da capo.
   ============================================================ */
(function () {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/'
  const FILE = {
    chart: [['Chart.js/4.4.1/chart.umd.min.js', 'sha512-CQBWl4fJHWbryGE+Pc7UAxWMUMNMWzWxF4SQo9CgkJIN1kx6djDQZjh3Y8SZ1d+6I+1zze6Z7kHXO7q3UyZAWw==']],
    pdf: [
      ['jspdf/2.5.1/jspdf.umd.min.js', 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA=='],
      ['jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'sha512-2/YdOMV+YNpanLCF5MdQwaoFRVbTmrJ4u4EpqS/USXAQNUDgI5uwYi6J98WVtJKcfe1AbgerygzDFToxAlOGEQ=='],
    ],
    xlsx: [['xlsx/0.18.5/xlsx.full.min.js', 'sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==']],
  }
  const PRONTA = {
    chart: () => !!window.Chart,
    pdf: () => !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable),
    xlsx: () => !!(window.XLSX && window.XLSX.utils),
  }
  const inCorso = {}

  function script(percorso, impronta) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script')
      s.src = CDN + percorso
      s.integrity = impronta
      s.crossOrigin = 'anonymous'
      s.referrerPolicy = 'no-referrer'
      s.onload = () => ok()
      s.onerror = () => { s.remove(); ko(new Error('Non riesco a scaricare ' + percorso.split('/').pop() + ': controlla la linea e riprova')) }
      document.head.appendChild(s)
    })
  }

  window.libreria = function (nome) {
    if (!FILE[nome]) return Promise.reject(new Error('Libreria sconosciuta: ' + nome))
    if (PRONTA[nome]()) return Promise.resolve()
    if (!inCorso[nome]) {
      // i file di una libreria si caricano in fila: autotable si aggancia a jsPDF già caricato
      inCorso[nome] = FILE[nome].reduce((p, [f, h]) => p.then(() => script(f, h)), Promise.resolve())
        .then(() => { if (!PRONTA[nome]()) throw new Error('La libreria ' + nome + ' si è scaricata ma non risponde: ricarica la pagina') })
        .catch((e) => { delete inCorso[nome]; throw e })
    }
    return inCorso[nome]
  }
})()
