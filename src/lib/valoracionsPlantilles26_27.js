// Text real dels objectius (i, quan es coneixen, les actuacions) de cada
// cicle/comissió/equip, tal com surten a les plantilles del curs 2026-27.
// Només s'utilitza com a punt de partida la primera vegada que s'obre
// aquell nom EXACTE en aquest curs concret — després tot és lliurement
// editable. Per a qualsevol altre curs escolar (27-28 i següents), o per a
// un nom que no hi surti aquí, es comença en blanc.

function obj(text, actuacions = []) {
  return { id: crypto.randomUUID(), text, gener: '', juny: '', actuacions: actuacions.map((a) => ({ id: crypto.randomUUID(), text: a[0], indicador: a[1] ?? '', gener: '', juny: '' })) }
}

export const CURS_AMB_PLANTILLA = '2026-27'

export const PLANTILLES_26_27 = {
  'Cicle Superior': {
    objectius: [
      obj("Participar en el desplegament de l'AVIM (diagnosi ortogràfica i seguiment) en llengua i matemàtiques del cicle."),
      obj("Treballar l'atenció a la diversitat dins les programacions de llengua (comprensió lectora, expressió escrita i oral)."),
      obj("Elaborar l'informe de diagnosi de competència ortogràfica de l'alumnat de primària, conclusions i futures línies de treball (incorporar activitats sistemàtiques d'ortografia vinculades a la diagnosi de l'AVIM a 5è i 6è)."),
      obj("Consolidar l'ús i la cura de l'espai de l'atelier, amb normes i coordinació clares entre els professionals que hi intervenen."),
      obj("Implementar el racó de ràdio a 5è, estenent la rotació feta a 6è, amb un mínim d'una emissió trimestral per nivell."),
      obj('Actualitzar les dades de la carpeta de classe. Recull de dades dels alumnes. (10%)'),
      obj('Actualitzar els PI i el pla de treball SEP. (10%)'),
      obj("Omplir l'aplicatiu de celebracions, sortides i activitats, treball cooperatiu, d'entrevistes amb les famílies, assistència i d'avaluació referencial. (10%)"),
    ],
    metodologies: "Racons, entrada relaxada, TP i Espais, treball cooperatiu, AVALUACIÓ (formativa i formadora)",
  },
  'Cicle Inicial': {
    objectius: [
      obj("Reforçar la cohesió de l'equip de cicle i crear espais estables de comunicació per compartir propostes entre mestres."),
      obj("Consolidar l'ús i la cura de l'espai de l'atelier, amb normes i coordinació clares entre els professionals que hi intervenen."),
      obj("Elaborar l'informe de diagnosi de competència ortogràfica de l'alumnat de primària, conclusions i futures línies de treball (incorporar activitats sistemàtiques d'ortografia i consciència fonològica vinculades a la diagnosi de l'AVIM a 1r i 2n)."),
      obj("Participar en el desplegament de l'AVIM (diagnosi ortogràfica i seguiment) en llengua i matemàtiques del cicle."),
      obj("Treballar l'atenció a la diversitat dins les programacions de llengua (comprensió lectora, expressió escrita i oral)."),
      obj('Actualitzar les dades de la carpeta de classe. Recull de dades dels alumnes.'),
      obj("Omplir els aplicatius d'avaluació referencial."),
      obj('Actualitzar els PI i el pla de treball SEP.'),
      obj("Omplir l'aplicatiu de celebracions, sortides i activitats, treball cooperatiu, d'entrevistes amb les famílies i assistència."),
    ],
    metodologies: "Racons, entrada relaxada, TP i Espais, treball cooperatiu, AVALUACIÓ (formativa i formadora)",
  },
  'Cicle Mitjà': {
    objectius: [
      obj("Afavorir un clima de treball positiu basat en la cooperació i l'aprenentatge entre iguals. (10%)"),
      obj("Participar en el desplegament de l'AVIM (diagnosi ortogràfica i seguiment) en llengua i matemàtiques del cicle."),
      obj("Treballar l'atenció a la diversitat dins les programacions de llengua (comprensió lectora, expressió escrita i oral). Revisar sistemàticament la programació de comprensió lectora, expressió escrita i oral incorporant-hi l'atenció a la diversitat."),
      obj("Elaborar l'informe de diagnosi de competència ortogràfica de l'alumnat de primària, conclusions i futures línies de treball (incorporar activitats sistemàtiques d'ortografia vinculades a la diagnosi de l'AVIM a 3r i 4t)."),
      obj("Consolidar l'ús i la cura de l'espai de l'atelier, amb normes i coordinació clares entre els professionals que hi intervenen."),
      obj('Ampliar la proposta multinivell dels projectes per donar resposta a la diversitat de aula.'),
      obj('Actualitzar i elaborar els PI i el pla de treball del SEP.'),
      obj('Omplir els aplicatius d\'avaluació referencial. Revisar les dades de la carpeta de classe i del recull de dades dels alumnes.'),
      obj("Omplir l'aplicatiu de celebracions, sortides i activitats, treball cooperatiu, d'entrevistes amb les famílies, assistència i d'avaluació referencial."),
    ],
    metodologies: "Racons, entrada relaxada, TP i Espais, treball cooperatiu, AVALUACIÓ",
  },
  'Educació Infantil': {
    objectius: [
      obj("Implementar la lectura dialogada en grups desdoblats a I4 i I5, seguint la metodologia proposada pel CREDA."),
      obj("Consolidar l'ús i la cura de l'espai de l'atelier, amb normes i coordinació clares entre els professionals que hi intervenen."),
      obj('Col·laborar en la proposta del CRP.'),
      obj("Garantir una gestió eficient, ordenada i sostenible del material dels espais compartits, assegurant-ne el manteniment, la disponibilitat i la traçabilitat per afavorir-ne un ús responsable."),
      obj("Participar en el desplegament de l'AVIM (diagnosi ortogràfica i seguiment) en llengua i matemàtiques del cicle."),
      obj("Omplir l'aplicatiu d'entrevistes amb les famílies i assistència de l'alumnat."),
      obj('Actualitzar i elaborar els PSI i el pla de treball del SEP.'),
      obj("Omplir els aplicatius d'avaluació referencial. Revisar les dades de la carpeta de classe i del recull de dades dels alumnes."),
      obj("Omplir l'aplicatiu de celebracions, sortides i activitats, treball cooperatiu."),
    ],
    metodologies: "Racons, entrada relaxada, TP i Espais, treball cooperatiu, AVALUACIÓ",
  },
  'Comissió Espai de migdia': {
    responsable: 'Àlvaro Molero Mateos',
    membres: 'Rosa Martí, Esther Díaz, Montse Perea, Sara Jiménez, Nines Pardos, Lluís Cazorla, Núria Saloni i Àlvaro Molero',
    objectius: [
      obj('Consolidar els canals de comunicació entre AFA, Com a Casa i Escola per coordinar la tasca pedagògica, per impulsar una educació de 360 graus dins i fora de l\'horari lectiu.', [
        ['Planificació de reunions trimestrals per compartir bones pràctiques pedagògiques', 'Fet(100%)/no fet(0%)'],
        ["Planificació reunions d'inici de curs per presentar els referents de grup de Com a Casa i el personal docent.", 'Fet(100%)/no fet(0%)'],
        ["Participació en les reunions d'inici de curs de I3 per donar a conèixer l'espai de migdia a les noves famílies.", 'Fet(100%)/no fet(0%)'],
        ["Participació en les reunions i revisió del material de la web de portes obertes", 'Fet(100%)/no fet(0%)'],
        ["Planificació de les reunions de la comissió mixta per fer el seguiment del funcionament de l'educació de 360 graus de la franja de 15:00 a 16:30", 'Fet(100%)/no fet(0%)'],
        ["Validació del pla d'emergència", 'Fet(100%)/no fet(0%)'],
        ['Validació de funcionament del menjador', 'Fet(100%)/no fet(0%)'],
        ['Revisió de la coordinació empresarial', 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Garantir els principis pedagògics de l'escola a través d'una visió compartida de l'educació 360 graus (Com a Casa i Escola) per coordinar el PEC.", [
        ['Elaboració del projecte educatiu del menjador', 'Fet(100%)/no fet(0%)'],
        ['Elaboració del pla de funcionament de menjador, seguint la línia pedagògica, el pla de convivència', 'Fet(100%)/no fet(0%)'],
        ["Implementació de l'anglès dins de l'educació 360 graus amb tres monitors/es de menjador dins i fora de l'horari lectiu (Science)", 'Fet(100%)/no fet(0%)'],
        ['Dinamitzar activitats interculturals per afavorir el coneixement cultural i les relacions socials', 'Fet(100%)/no fet(0%)'],
        ["Dinamitzar activitats d'apadrinament", 'Fet(100%)/no fet(0%)'],
        ["Dinamitzar activitats de l'eix d'identitat a I4", 'Fet(100%)/no fet(0%)'],
        ['Coordinar accions conjuntes escola i espai de migdia per gaudir de les festes escolars amb principis pedagògics del PEC', 'Fet(100%)/no fet(0%)'],
        ["Dinamitzar el treball de l'hort a 1r", 'Fet(100%)/no fet(0%)'],
      ]),
      obj('Enregistrar les dades del SIC-Dades anuals.'),
      obj("Presentar el projecte pedagògic al Consell Escolar per la seva aprovació o ratificació."),
      obj('Revisar la informació de traspàs de la reunió inicial entre el claustre i l\'equip de migdia.'),
      obj("Implementar les propostes de millores de l'auditoria del CEB a l'espai de migdia."),
      obj('Organitzar les reunions informatives a les famílies del centre.'),
      obj("Gestionar les incidències de les reclamacions per responsabilitat patrimonial en l'àmbit educatiu."),
    ],
  },
  'Comissió Comunicació': {
    objectius: [
      obj('Participar en l\'elaboració de la Tafanera.', [
        ['Presentar un article per la Tafanera', 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Actualitzar el vídeo d'informacions d'I3.", [
        ['Actualització realitzada', 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Planificar reunions trimestrals per millorar el procés de comunicació de l'escola.", [
        ['Planificació de reunions trimestrals', 'Fet(100%)/no fet(0%)'],
        ["Gestió dels drets d'imatges i autoritzacions", 'Fet(100%)/no fet(0%)'],
      ]),
      obj('Potenciar la identitat i el sentit de pertinença comunitari.', [
        ['Presentació de la Giberteta a Ed. Infantil', 'Fet(100%)/no fet(0%)'],
        ["Impuls de les Xarxes Socials per apropar l'escola a les famílies", 'Fet(100%)/no fet(0%)'],
        ["Participació de l'AFA a les portes obertes", 'Fet(100%)/no fet(0%)'],
        ["Participació de l'AFA a la reunió d'inici de curs de I3", 'Fet(100%)/no fet(0%)'],
      ]),
      obj('Crear un google calendar comissió mixte de les reunions.'),
      obj('Presentar la documentació per la matriculació.'),
      obj('Preparar la benvinguda.'),
    ],
  },
  "Equip d'Atenció a la Diversitat": {
    objectius: [
      obj("Atendre i fer el seguiment dels/les alumnes NESE. Prioritzant els que presenten dificultats greus i permanents, dificultats d'aprenentatge, així com dur a terme el registre d'aquests.", [
        ["Assessorament als/les mestres sobre les adaptacions metodològiques i curriculars a l'aula que potenciïn l'adquisició dels aprenentatges dels/les alumnes amb NESE", "Grau de satisfacció de l'assessorament"],
        ['Realització del traspàs als/les mestres dels/les alumnes amb NESE', 'Informe del traspàs de final de curs (No fet - fet)'],
        ["Actualització dels llistats de seguiment dels alumnes amb NEE i/o atesos per les MEE del centre", 'Taules elaborades (No fet - fet)'],
        ["Seguiment i actualització dels historials de les actuacions realitzades als alumnes amb NEE", 'Historials dels alumnes (No fet - fet)'],
      ]),
      obj('Donar a conèixer, revisar i elaborar Plans Individualitzats (curriculars i metodològiques).', [
        ['Presentació i revisió dels Plans Individualitzats existents al tutor i mestres corresponents', 'Plans Individualitzats (No estan-estan)'],
        ['Elaboració dels nous Plans individualitzats donant suport a les tutories', 'Nous Plans individualitzats (No estan-estan)'],
        ['Seguiment al llarg del curs dels Plans Individualitzats', 'Escala No assolit / Baix / Poc satisfactori / Satisfactori / Bo / Alt'],
      ]),
      obj("Elaborar i cercar materials adaptats a les necessitats dels alumnes, tant manipulatiu com digital."),
      obj("Comunicar i coordinar amb l'EAP, serveis externs i inspecció la detecció i derivació dels alumnes amb NEE."),
      obj("Atendre les famílies dels alumnes d'Educació Especial."),
      obj('Reforçar l\'habilitat lectora a cicle inicial.'),
      obj("Elaborar i desplegar el Pla d'Atenció per a la Diversitat (PAD)."),
    ],
  },
  'Comissió Espais': {
    objectius: [
      obj("Rebre, inventariar i col·locar el material de la Ludoteca (valor 3.000€) als espais destinats al joc.", [
        ["Rebre i revisar el material de la Ludoteca adquirit, contrastant-lo amb l'albarà/factura de compra", 'Fet(100%)/no fet(0%)'],
        ['Elaborar l\'inventari inicial del material de la Ludoteca (tipologia, quantitat i ubicació prevista)', 'Fet(100%)/no fet(0%)'],
        ['Col·locar i etiquetar el material de la Ludoteca als espais destinats, garantint-ne l\'accessibilitat i la seguretat per a l\'alumnat', 'Fet(100%)/no fet(0%)'],
        ['Definir el circuit de préstec i retorn del material de la Ludoteca', 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Reorganitzar l'atelier per optimitzar l'ordre i el sistema de reposició de material.", [
        ['Revisar i redissenyar l\'organització de l\'atelier (ubicació i etiquetatge del material per tipologia)', 'Fet(100%)/no fet(0%)'],
        ['Establir un sistema de reposició periòdica de material fungible i sostenible', 'Fet(100%)/no fet(0%)'],
        ["Definir una persona referent estable de l'atelier per curs, per garantir-ne la continuïtat", 'Fet(100%)/no fet(0%)'],
        ["Elaborar un protocol d'ús de l'atelier per a tots els cicles", 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Gestionar l'inventari i el pressupost del material dels espais (Ludoteca, atelier i altres)."),
      obj("Coordinar-se amb els cicles i vetllar pel bon funcionament dels espais al llarg del curs."),
    ],
  },
  'Coordinació de Riscos Laborals': {
    objectius: [
      obj("Actualitzar el Pla d'Evacuació: responsables de plantes, ordre de sortida, protocol i tasques.", [
        ["Actualització del pla d'evacuació. Revisar i modificar el pla d'emergència del curs anterior", 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Realitzar un simulacre al centre (informar als mestres nous, coordinar amb l'equip directiu, comunicar el resultat al Servei de Prevenció).", [
        ["Informació als mestres sobre el pla d'evacuació", 'Fet(100%)/no fet(0%)'],
        ["Coordinació del simulacre d'incendis amb l'equip directiu", 'Fet(100%)/no fet(0%)'],
        ['Comunicació al servei de prevenció de riscos, dels resultats del simulacre', 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Revisar la localització dels mapes d'emergència i actualitzar-los segons les modificacions d'espais que s'han produït.", [
        ["Revisió de la localització dels mapes d'emergència", 'Fet(100%)/no fet(0%)'],
      ]),
      obj("Coordinar amb empreses no pròpies del consorci l'avaluació dels riscos laborals."),
      obj('Revisar periòdicament els equips de lluita contra incendis com a activitat complementària a les revisions oficials i notificar els desperfectes.'),
      obj('Notificar als Serveis Territorials els possibles problemes de seguretat.'),
      obj("Emplenar i trametre als Serveis Territorials el full de notificació d'accidents laborals."),
      obj('Assistir als cursos de formació que es considerin oportuns.'),
      obj("Emplenar i tramitar al Consorci el Pla de treball de l'acció preventiva del centre i la Memòria del treball en prevenció dels riscos laborals."),
    ],
  },
  'Comissió de Transformem els Patis': {
    responsable: 'Lidia Soriano',
    objectius: [
      obj('Constituir, convocar i coordinar el Grup Motor de centre del projecte Transformem els Patis.', [
        ["Constituir el Grup Motor amb representació de tota la comunitat educativa", 'Fet(100%)/no fet(0%)'],
        ["Emplenar i trametre la fitxa del Grup Motor a pladepatis@bcn.cat durant els primers dies de setembre", 'Fet(100%)/no fet(0%)'],
        ["Signar i enviar la Carta de Compromís del programa abans de la trobada del 26 de juny", 'Fet(100%)/no fet(0%)'],
        ["Convocar i coordinar les reunions del Grup Motor, vetllant perquè no se sobrepassin les 16:30h", 'Fet(100%)/no fet(0%)'],
      ]),
      obj('Assegurar la participació del professorat en la formació de 25 hores vinculada al programa Transformem els Patis.', [
        ['Inscriure com a mínim dos mestres del centre a la formació (12-13h presencials + 12h de treball intern)', 'Fet(100%)/no fet(0%)'],
        ['Assistir a les sessions formatives del primer trimestre: 17/09, 30/09 i 14/10 de 2026', 'Fet(100%)/no fet(0%)'],
        ['Assistir a les sessions formatives de coeducació i pati comunitari: 4/11 i 9/12 de 2026, i 28/04 de 2027', 'Fet(100%)/no fet(0%)'],
        ['Compartir amb la resta del Grup Motor els continguts treballats i elaborar el document pedagògic/pla estratègic del pati', 'Fet(100%)/no fet(0%)'],
      ]),
      obj('Participar en el procés de cocreació amb el Grup Motor (5 sessions dinamitzades).'),
      obj("Elaborar el projecte educatiu de pati i incorporar-lo al Projecte Educatiu de Centre (PEC)."),
      obj('Informar i implicar tota la comunitat educativa en el projecte de transformació del pati.'),
      obj("Gestionar la documentació, els tràmits i la coordinació amb el CEB i l'Ajuntament de Barcelona."),
    ],
  },
}
