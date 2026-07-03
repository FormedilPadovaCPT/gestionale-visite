// app-data.js — dati statici del Gestionale Visite (codelist, tabelle comuni, mappature).
// Caricato come <script> CLASSICO PRIMA del modulo principale: i const qui sono globali
// e vengono letti dal modulo. NON aggiungere qui logica/funzioni, solo dati.

const COMUNI_PD=['Abano Terme','Agna','Albignasego','Anguillara Veneta','Arquà Petrarca','Arquà Polesine','Arre','Arzergrande','Bagnoli di Sopra','Baone','Barbona','Battaglia Terme','Boara Pisani','Borgoricco','Bovolenta','Brugine','Cadoneghe','Campodarsego','Campodoro','Camposampiero','Campo San Martino','Candiana','Carceri','Cartura','Casale di Scodosia','Casalserugo','Castelbaldo','Cervarese Santa Croce','Chioggia','Cittadella','Codevigo','Conselve','Correzzola','Curtarolo','Due Carrare','Este','Fontaniva','Galliera Veneta','Galzignano Terme','Gazzo','Granze','Guarda Veneta','Legnaro','Limena','Loreggia','Lozzo Atestino','Masi','Massanzago','Megliadino San Fidenzio','Megliadino San Vitale','Merlara','Mestrino','Monselice','Montagnana','Montegrotto Terme','Motta','Noventa Padovana','Ospedaletto Euganeo','Padova','Pernumia','Piacenza d\'Adige','Piazzola sul Brenta','Piombino Dese','Piove di Sacco','Polverara','Ponso','Pontelongo','Ponte San Nicolò','Pozzonovo','Rovolon','Rubano','Saccolongo','San Giorgio delle Pertiche','San Giorgio in Bosco','San Martino di Lupari','San Pietro in Gu','San Pietro Viminario','Sant\'Angelo di Piove di Sacco','Sant\'Elena','Sant\'Urbano','Saonara','Selvazzano Dentro','Solesino','Stanghella','Teolo','Terrassa Padovana','Tombolo','Torre di Mosto','Trebaseleghe','Tribano','Urbana','Veggiano','Vescovana','Vighizzolo d\'Este','Vigodarzere','Vigonovo','Vigonza','Villa del Conte','Villa Estense','Villafranca Padovana','Villanova di Camposampiero','Vo\'']

const CAP_PD={
  'Abano Terme':'35031','Agna':'35021','Albignasego':'35020','Anguillara Veneta':'35022',
  'Arquà Petrarca':'35032','Arquà Polesine':'45031','Arre':'35020','Arzergrande':'35020',
  'Bagnoli di Sopra':'35023','Baone':'35030','Barbona':'35040','Battaglia Terme':'35041',
  'Boara Pisani':'35040','Borgoricco':'35010','Bovolenta':'35024','Brugine':'35020',
  'Cadoneghe':'35010','Campodarsego':'35011','Campodoro':'35010','Camposampiero':'35012',
  'Campo San Martino':'35010','Candiana':'35020','Carceri':'35040','Cartura':'35025',
  'Casale di Scodosia':'35040','Casalserugo':'35020','Castelbaldo':'35040',
  'Cervarese Santa Croce':'35030','Chioggia':'30015','Cittadella':'35013','Codevigo':'35020',
  'Conselve':'35026','Correzzola':'35020','Curtarolo':'35010','Due Carrare':'35020',
  'Este':'35042','Fontaniva':'35014','Galliera Veneta':'35015','Galzignano Terme':'35030',
  'Gazzo':'35010','Granze':'35040','Guarda Veneta':'45030','Legnaro':'35020','Limena':'35010',
  'Loreggia':'35010','Lozzo Atestino':'35034','Masi':'35040','Massanzago':'35010',
  'Megliadino San Fidenzio':'35040','Megliadino San Vitale':'35040','Merlara':'35040',
  'Mestrino':'35035','Monselice':'35043','Montagnana':'35044','Montegrotto Terme':'35036',
  'Motta':'35060','Noventa Padovana':'35027','Ospedaletto Euganeo':'35045','Padova':'35100',
  'Pernumia':'35020','Piacenza d\'Adige':'35040','Piazzola sul Brenta':'35016',
  'Piombino Dese':'35017','Piove di Sacco':'35028','Polverara':'35020','Ponso':'35040',
  'Pontelongo':'35029','Ponte San Nicolò':'35020','Pozzonovo':'35020','Rovolon':'35030',
  'Rubano':'35030','Saccolongo':'35030','San Giorgio delle Pertiche':'35010',
  'San Giorgio in Bosco':'35010','San Martino di Lupari':'35018','San Pietro in Gu':'35010',
  'San Pietro Viminario':'35020','Sant\'Angelo di Piove di Sacco':'35020',
  'Sant\'Elena':'35040','Sant\'Urbano':'35040','Saonara':'35020','Selvazzano Dentro':'35030',
  'Solesino':'35047','Stanghella':'35048','Teolo':'35037','Terrassa Padovana':'35020',
  'Tombolo':'35019','Torre di Mosto':'30020','Trebaseleghe':'35010','Tribano':'35020',
  'Urbana':'35040','Veggiano':'35030','Vescovana':'35040','Vighizzolo d\'Este':'35040',
  'Vigodarzere':'35010','Vigonovo':'35010','Vigonza':'35010','Villa del Conte':'35010',
  'Villa Estense':'35040','Villafranca Padovana':'35010','Villanova di Camposampiero':'35010',
  'Vo\'':'35030'
}

const ISTAT_PD={
  'Abano Terme':'028001','Agna':'028002','Albignasego':'028003','Anguillara Veneta':'028004',
  'Arquà Petrarca':'028005','Arre':'028007','Arzergrande':'028008','Bagnoli di Sopra':'028009',
  'Baone':'028010','Barbona':'028011','Battaglia Terme':'028012','Boara Pisani':'028013',
  'Borgoricco':'028014','Bovolenta':'028015','Brugine':'028016','Cadoneghe':'028017',
  'Campodarsego':'028018','Campodoro':'028019','Camposampiero':'028020','Campo San Martino':'028021',
  'Candiana':'028022','Carceri':'028023','Cartura':'028024','Casale di Scodosia':'028025',
  'Casalserugo':'028026','Castelbaldo':'028027','Cervarese Santa Croce':'028028',
  'Chioggia':'027004','Cittadella':'028029','Codevigo':'028030','Conselve':'028031',
  'Correzzola':'028032','Curtarolo':'028033','Due Carrare':'028034','Este':'028037',
  'Fontaniva':'028038','Galliera Veneta':'028039','Galzignano Terme':'028040','Gazzo':'028041',
  'Granze':'028042','Legnaro':'028046','Limena':'028047','Loreggia':'028049',
  'Lozzo Atestino':'028050','Masi':'028053','Massanzago':'028054',
  'Megliadino San Fidenzio':'028057','Megliadino San Vitale':'028058','Merlara':'028059',
  'Mestrino':'028060','Monselice':'028061','Montagnana':'028062','Montegrotto Terme':'028063',
  'Motta':'028065','Noventa Padovana':'028066','Ospedaletto Euganeo':'028067','Padova':'028060',
  'Pernumia':'028069','Piacenza d\'Adige':'028070','Piazzola sul Brenta':'028071',
  'Piombino Dese':'028072','Piove di Sacco':'028073','Polverara':'028074','Ponso':'028075',
  'Pontelongo':'028076','Ponte San Nicolò':'028077','Pozzonovo':'028078','Rovolon':'028080',
  'Rubano':'028081','Saccolongo':'028082','San Giorgio delle Pertiche':'028083',
  'San Giorgio in Bosco':'028084','San Martino di Lupari':'028085','San Pietro in Gu':'028086',
  'San Pietro Viminario':'028087','Sant\'Angelo di Piove di Sacco':'028088',
  'Sant\'Elena':'028089','Sant\'Urbano':'028090','Saonara':'028091',
  'Selvazzano Dentro':'028092','Solesino':'028093','Stanghella':'028094','Teolo':'028095',
  'Terrassa Padovana':'028096','Tombolo':'028097','Trebaseleghe':'028099','Tribano':'028100',
  'Urbana':'028101','Veggiano':'028102','Vescovana':'028103','Vighizzolo d\'Este':'028104',
  'Vigodarzere':'028105','Vigonovo':'028106','Vigonza':'028107','Villa del Conte':'028108',
  'Villa Estense':'028109','Villafranca Padovana':'028110','Villanova di Camposampiero':'028111',
  'Vo\'':'028112'
}
