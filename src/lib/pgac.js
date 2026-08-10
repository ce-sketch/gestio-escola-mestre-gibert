// Dades i càlculs del mòdul "PGAC" (seguiment de la Programació General
// Anual de Centre): 3 Objectius Estratègics del Projecte de Direcció, cada
// un desglossat en Estratègia → Operatius → Indicadors, cada indicador amb
// un percentatge de compliment a Gener i a Juny.

function indicador(text) {
  return { id: crypto.randomUUID(), text, gener: '', juny: '' }
}

function operatiu(titol, text, indicadors) {
  return { id: crypto.randomUUID(), titol, text, indicadors: indicadors.map(indicador) }
}

/** Dades reals del curs 2026-27, tal com surten al document oficial —
 *  serveixen de punt de partida la primera vegada que s'obre el mòdul;
 *  després tot és editable (afegir/treure operatius i indicadors, canviar
 *  el text...). */
export function objectiusPerDefecte() {
  return [
    {
      id: crypto.randomUUID(),
      titol: 'Objectiu 1 (Àmbit pedagògic)',
      descripcio: "Millorar la competència escrita en llengua catalana a primària, participar en el model d'Avaluació Integrada per a la Millora (AVIM) de la Inspecció d'Educació i afavorir un clima d'aula que promogui l'atenció, la concentració i l'aprenentatge.",
      estrategiaTitol: 'Estratègia 1',
      estrategiaText: "Iniciar la millora de la competència escrita en llengua catalana a primària i participar en el nou model d'Avaluació Integrada per a la Millora (AVIM), mitjançant la diagnosi ortogràfica i el desplegament de l'AVIM en llengua i matemàtiques.",
      operatius: [
        operatiu('Operatiu 1.1', 'Desenvolupar seqüències específiques de treball ortogràfic a primària per millorar la competència escrita.', [
          'I.1.1.1. Diagnosi realitzada. Proposta didàctica dissenyada per a tots els cicles.',
        ]),
        operatiu('Operatiu 1.2', "Participar en el procés d'Avaluació Integrada per a la Millora (AVIM) de la Inspecció d'Educació en els àmbits de llengua i matemàtiques.", [
          "I.1.2.1. Reunió realitzada. Registre a l'acta de direcció.",
          'I.1.2.2. Autoavaluació realitzada i lliurada.',
          'I.1.2.3. Avaluació externa realitzada.',
          'I.1.2.4. Informe de resultats analitzat. Propostes de millora incorporades a la PGAC.',
        ]),
        operatiu('Operatiu 1.3', '', []),
      ],
    },
    {
      id: crypto.randomUUID(),
      titol: 'Objectiu 2 (Àmbit de gestió)',
      descripcio: "Elaborar i actualitzar els documents de gestió prioritaris i consolidar l'Estratègia Digital de Centre (EDC).",
      estrategiaTitol: 'Estratègia 2',
      estrategiaText: "Iniciar l'elaboració del Pla d'Atenció per a la Diversitat i consolidar l'Estratègia Digital de Centre, mitjançant la seva revisió, actualització i el desplegament de projectes digitals.",
      operatius: [
        operatiu('Operatiu 2.1', 'Elaborar i desplegar el PAD: fase preparatòria (normativa + diagnòsi).', [
          'I.2.1.1. Normativa llegida i analitzada.',
          'I.2.1.2. Diagnòsi de la diversitat al centre elaborada.',
        ]),
        operatiu('Operatiu 2.2', "Revisar i actualitzar l'Estratègia Digital de Centre (EDC). Actuacions del curs 26-27: revisió de l'EDC i projectes digitals.", [
          'I.2.2.1. EDC 2026-2030 elaborada i aprovada. Nous objectius definits.',
          'I.2.2.2. Objectius EDC revisats i en seguiment. Apartat EDC a la MAC elaborat.',
          'I.2.2.3. Ràdio implementada a 5è. Mínim 1 emissió per trimestre.',
          "I.2.2.4. Informe d'avaluació competencial digital elaborat per a tot l'alumnat.",
        ]),
      ],
    },
    {
      id: crypto.randomUUID(),
      titol: "Objectiu 3 (Àmbit d'Organització i funcionament)",
      descripcio: "Consolidar una escola inclusiva, participativa i oberta a l'entorn, mitjançant la millora de la comunicació amb les famílies, la coordinació amb serveis externs i la transformació del pati escolar com a espai educatiu, coeducatiu, naturalitzat i comunitari.",
      estrategiaTitol: 'Estratègia 3',
      estrategiaText: "Millorar l'acollida de les famílies de l'alumnat NESE de nova incorporació, i iniciar la transformació participativa del pati escolar.",
      operatius: [
        operatiu('Operatiu 3.1', "Millorar l'acollida de les famílies de l'alumnat NESE A de nova incorporació, mitjançant reunions prèvies amb l'equip d'Atenció a la Diversitat i les tutores, i recollir aquesta manera de fer al PAD (anual).", [
          "I.3.1.1. Nombre d'entrevistes inicials realitzades amb famílies NESE A de nova incorporació.",
          'I.3.1.2. Circuit definit i comunicat als equips docents.',
          "I.3.1.3. Protocol recollit a l'esborrany PAD i coordinacions realitzades.",
          "I.3.1.4. Resultats de l'enquesta de satisfacció de famílies (apartat comunicació).",
        ]),
        operatiu('Operatiu 3.2', 'Transformar el pati escolar en un espai educatiu, naturalitzat, coeducatiu i comunitari. Actuacions del curs 26-27 (1r any).', [
          '3.2.1. Participació en el programa Transformem els Patis (AjBCN / CEB): constitució del grup motor, procés participatiu de cocreació del nou pati, elaboració del Projecte Educatiu de Pati.',
        ]),
      ],
    },
  ]
}

export function operatiuBuit(n) {
  return operatiu(`Operatiu ${n}`, '', [])
}

export function indicadorBuit() {
  return indicador('')
}

/** Mitjana de compliment (Gener o Juny) de tots els indicadors amb un
 *  valor introduït — ignora els que encara estan buits. */
export function mitjanaOperatiu(op, camp) {
  const valors = op.indicadors.filter((i) => i[camp] !== '' && i[camp] !== null && i[camp] !== undefined).map((i) => Number(i[camp]))
  if (valors.length === 0) return null
  return valors.reduce((a, b) => a + b, 0) / valors.length
}

export function mitjanaObjectiu(objectiu, camp) {
  const totes = objectiu.operatius.flatMap((op) => op.indicadors)
  const valors = totes.filter((i) => i[camp] !== '' && i[camp] !== null && i[camp] !== undefined).map((i) => Number(i[camp]))
  if (valors.length === 0) return null
  return valors.reduce((a, b) => a + b, 0) / valors.length
}

export function mitjanaGeneral(objectius, camp) {
  const totes = objectius.flatMap((o) => o.operatius.flatMap((op) => op.indicadors))
  const valors = totes.filter((i) => i[camp] !== '' && i[camp] !== null && i[camp] !== undefined).map((i) => Number(i[camp]))
  if (valors.length === 0) return null
  return valors.reduce((a, b) => a + b, 0) / valors.length
}
