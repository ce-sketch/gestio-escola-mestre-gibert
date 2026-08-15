// Dades i càlculs del mòdul "PGAC" (seguiment de la Programació General
// Anual de Centre): 3 Objectius Estratègics del Projecte de Direcció, cada
// un desglossat en Estratègia → Operatius → Indicadors.
//
// ─────────────────────────────────────────────────────────────────────────
// COM CALCULA EL DOCUMENT OFICIAL (revisat casella per casella l'agost de
// 2026 contra "Eina d'avaluació PGAC Curs 2026-27")
//
//   indicador %  ×  valor (M)  ×  pes dins l'operatiu (P)
//     └─ Σ ─────────────────────────────────────────→  RESULTAT OPERATIU
//   resultat operatiu  ×  pes de l'operatiu dins l'objectiu
//     └─ Σ ─────────────────────────────────────────→  RESULTAT DELS OPERATIUS
//   resultat dels operatius × 65%  +  competències bàsiques × 35%
//     └───────────────────────────────────────────→  RESULTAT DE L'OBJECTIU
//
// Dues conseqüències que abans l'app no respectava:
//   1. Enlloc del document hi ha cap mitjana. Tot són sumes ponderades.
//   2. Els indicadors sense valorar NO s'ignoren: compten com a 0. Per això
//      cada resultat ve acompanyat de quants indicadors queden per omplir,
//      perquè un 25% a mig curs no sembli un mal resultat.
// ─────────────────────────────────────────────────────────────────────────

import { ESCALA_PER_DEFECTE } from './escales'

function indicador(text, pesGlobal = null, escala = ESCALA_PER_DEFECTE) {
  return {
    id: crypto.randomUUID(),
    text,
    gener: '',
    juny: '',
    escala,
    valor: 100,        // la "M" del document: normalment 100%
    pesGlobal,         // la "P": pes dins de l'operatiu; null = repartiment automàtic
  }
}

function operatiu(titol, text, indicadors, pes = null) {
  return {
    id: crypto.randomUUID(),
    titol,
    text,
    pes,               // pes de l'operatiu dins de l'objectiu (%)
    indicadors: indicadors.map((i) => (Array.isArray(i) ? indicador(i[0], i[1]) : indicador(i))),
  }
}

/** Dades reals del curs 2026-27, amb els pesos tal com són ara al document
 *  oficial — serveixen de punt de partida la primera vegada que s'obre el
 *  mòdul; després tot és editable. */
export function objectiusPerDefecte() {
  return [
    {
      id: crypto.randomUUID(),
      titol: 'Objectiu 1 (Àmbit pedagògic)',
      descripcio: "Millorar la competència escrita en llengua catalana a primària, participar en el model d'Avaluació Integrada per a la Millora (AVIM) de la Inspecció d'Educació i afavorir un clima d'aula que promogui l'atenció, la concentració i l'aprenentatge.",
      estrategiaTitol: 'Estratègia 1',
      estrategiaText: "Iniciar la millora de la competència escrita en llengua catalana a primària i participar en el nou model d'Avaluació Integrada per a la Millora (AVIM), mitjançant la diagnosi ortogràfica i el desplegament de l'AVIM en llengua i matemàtiques.",
      competencies: {
        actiu: true,
        pes: 35,
        escala: 'indicadors6',
        gener: '',
        juny: '',
        text: "Consolidar l'assoliment de les competències bàsiques — nombre d'indicadors dins del llindar del Vo.",
      },
      operatius: [
        operatiu('Operatiu 1.1', 'Desenvolupar seqüències específiques de treball ortogràfic a primària per millorar la competència escrita.', [
          ['I.1.1.1. Diagnosi realitzada. Proposta didàctica dissenyada per a tots els cicles.', 100],
        ], 25),
        operatiu('Operatiu 1.2', "Participar en el procés d'Avaluació Integrada per a la Millora (AVIM) de la Inspecció d'Educació en els àmbits de llengua i matemàtiques.", [
          ["I.1.2.1. Reunió realitzada. Registre a l'acta de direcció.", 25],
          ['I.1.2.2. Autoavaluació realitzada i lliurada.', 25],
          ['I.1.2.3. Avaluació externa realitzada.', 25],
          ['I.1.2.4. Informe de resultats analitzat. Propostes de millora incorporades a la PGAC.', 25],
        ], 75),
        operatiu('Operatiu 1.3', '', [], 0),
      ],
    },
    {
      id: crypto.randomUUID(),
      titol: 'Objectiu 2 (Àmbit de gestió)',
      descripcio: "Elaborar i actualitzar els documents de gestió prioritaris i consolidar l'Estratègia Digital de Centre (EDC).",
      estrategiaTitol: 'Estratègia 2',
      estrategiaText: "Iniciar l'elaboració del Pla d'Atenció per a la Diversitat i consolidar l'Estratègia Digital de Centre, mitjançant la seva revisió, actualització i el desplegament de projectes digitals.",
      competencies: { actiu: false, pes: 35, escala: 'indicadors6', gener: '', juny: '', text: '' },
      operatius: [
        operatiu('Operatiu 2.1', 'Elaborar i desplegar el PAD: fase preparatòria (normativa + diagnòsi).', [
          ['I.2.1.1. Normativa llegida i analitzada.', 20],
          ['I.2.1.2. Diagnosi de la diversitat al centre elaborada.', 20],
          ['I.2.1.3. Publicació del nou PAD a la pàgina web.', 60],
        ], 50),
        operatiu('Operatiu 2.2', "Revisar i actualitzar l'Estratègia Digital de Centre (EDC). Actuacions del curs 26-27: revisió de l'EDC i projectes digitals.", [
          ['I.2.2.1. EDC 2026-2030 elaborada i aprovada. Nous objectius definits.', 25],
          ['I.2.2.2. Objectius EDC revisats i en seguiment. Apartat EDC a la MAC elaborat.', 25],
          ['I.2.2.3. Ràdio implementada a 5è. Mínim 1 emissió per trimestre.', 25],
          ["I.2.2.4. Informe d'avaluació competencial digital elaborat per a tot l'alumnat.", 25],
        ], 50),
        operatiu('Operatiu 2.3', '', [], 0),
      ],
    },
    {
      id: crypto.randomUUID(),
      titol: "Objectiu 3 (Àmbit d'Organització i funcionament)",
      descripcio: "Consolidar una escola inclusiva, participativa i oberta a l'entorn, mitjançant la millora de la comunicació amb les famílies, la coordinació amb serveis externs i la transformació del pati escolar com a espai educatiu, coeducatiu, naturalitzat i comunitari.",
      estrategiaTitol: 'Estratègia 3',
      estrategiaText: "Millorar l'acollida de les famílies de l'alumnat NESE de nova incorporació, i iniciar la transformació participativa del pati escolar.",
      competencies: { actiu: false, pes: 35, escala: 'indicadors6', gener: '', juny: '', text: '' },
      operatius: [
        operatiu('Operatiu 3.1', "Millorar l'acollida de les famílies de l'alumnat NESE A de nova incorporació, mitjançant reunions prèvies amb l'equip d'Atenció a la Diversitat i les tutores, i recollir aquesta manera de fer al PAD (anual).", [
          ["I.3.1.1. Nombre d'entrevistes inicials realitzades amb famílies NESE A de nova incorporació.", 25],
          ['I.3.1.2. Circuit definit i comunicat als equips docents.', 25],
          ["I.3.1.3. Protocol recollit a l'esborrany PAD i coordinacions realitzades.", 25],
          ["I.3.1.4. Resultats de l'enquesta de satisfacció de famílies (apartat comunicació).", 25],
        ], 50),
        operatiu('Operatiu 3.2', 'Transformar el pati escolar en un espai educatiu, naturalitzat, coeducatiu i comunitari. Actuacions del curs 26-27 (1r any).', [
          ['3.2.1. Participació en el programa Transformem els Patis (AjBCN / CEB): constitució del grup motor, procés participatiu de cocreació del nou pati, elaboració del Projecte Educatiu de Pati.', 100],
        ], 50),
        operatiu('Operatiu 3.3', '', [], 0),
      ],
    },
  ]
}

export function operatiuBuit(n) {
  return operatiu(`Operatiu ${n}`, '', [], 0)
}

export function indicadorBuit() {
  return indicador('')
}

/** Posa al dia els documents desats abans que existissin els pesos: els
 *  reparteix a parts iguals i afegeix els camps que hi falten. Així res no
 *  peta ni canvia de valor de cop sense avisar. */
export function normalitzaObjectius(objectius) {
  if (!Array.isArray(objectius)) return []
  return objectius.map((o) => {
    const operatius = (o.operatius ?? []).map((op) => {
      const indicadors = (op.indicadors ?? []).map((ind) => ({
        escala: ESCALA_PER_DEFECTE,
        valor: 100,
        pesGlobal: null,
        ...ind,
      }))
      const capPes = indicadors.every((i) => i.pesGlobal === null || i.pesGlobal === undefined)
      if (capPes && indicadors.length > 0) {
        const repartit = Math.round((100 / indicadors.length) * 10) / 10
        indicadors.forEach((i, idx) => {
          // l'últim s'endú el residu perquè la suma faci 100 exacte
          i.pesGlobal = idx === indicadors.length - 1
            ? Math.round((100 - repartit * (indicadors.length - 1)) * 10) / 10
            : repartit
        })
      }
      return { pes: null, ...op, indicadors }
    })

    const capPesOp = operatius.every((op) => op.pes === null || op.pes === undefined)
    if (capPesOp && operatius.length > 0) {
      const repartit = Math.round((100 / operatius.length) * 10) / 10
      operatius.forEach((op, idx) => {
        op.pes = idx === operatius.length - 1
          ? Math.round((100 - repartit * (operatius.length - 1)) * 10) / 10
          : repartit
      })
    }

    return {
      competencies: { actiu: false, pes: 35, escala: 'indicadors6', gener: '', juny: '', text: '' },
      ...o,
      operatius,
    }
  })
}

function esBuit(v) {
  return v === '' || v === null || v === undefined || Number.isNaN(Number(v))
}

const num = (v, perDefecte = 0) => (esBuit(v) ? perDefecte : Number(v))

/**
 * Resultat d'un operatiu: Σ (indicador% × valor × pesGlobal).
 * Retorna també quants indicadors queden per valorar, perquè la xifra es
 * pugui llegir en context.
 */
export function resultatOperatiu(op, camp) {
  const indicadors = op.indicadors ?? []
  if (indicadors.length === 0) return { valor: null, total: 0, valorats: 0, pesTotal: 0 }

  let acumulat = 0
  let valorats = 0
  let pesTotal = 0

  for (const ind of indicadors) {
    const pes = num(ind.pesGlobal) / 100
    const m = num(ind.valor, 100) / 100
    pesTotal += num(ind.pesGlobal)
    if (!esBuit(ind[camp])) {
      valorats++
      acumulat += Number(ind[camp]) * m * pes
    }
  }

  return {
    valor: Math.round(acumulat * 100) / 100,
    total: indicadors.length,
    valorats,
    pesTotal: Math.round(pesTotal * 10) / 10,
  }
}

/**
 * Resultat d'un objectiu: Σ (resultat operatiu × pes), i si l'objectiu té
 * competències bàsiques actives, la barreja 65/35 amb el seu valor.
 */
export function resultatObjectiu(objectiu, camp) {
  const operatius = objectiu.operatius ?? []
  let acumulat = 0
  let total = 0
  let valorats = 0
  let pesTotal = 0

  for (const op of operatius) {
    const r = resultatOperatiu(op, camp)
    total += r.total
    valorats += r.valorats
    pesTotal += num(op.pes)
    if (r.valor !== null) acumulat += r.valor * (num(op.pes) / 100)
  }

  const cb = objectiu.competencies
  let valor = acumulat
  if (cb?.actiu) {
    const pesCb = num(cb.pes, 35) / 100
    valor = acumulat * (1 - pesCb) + num(cb[camp]) * pesCb
    total += 1
    if (!esBuit(cb[camp])) valorats += 1
  }

  return {
    valor: total === 0 ? null : Math.round(valor * 100) / 100,
    total,
    valorats,
    pesTotal: Math.round(pesTotal * 10) / 10,
    ambCompetencies: !!cb?.actiu,
    resultatOperatius: Math.round(acumulat * 100) / 100,
  }
}

/**
 * Mitjana dels 3 objectius estratègics. Ull: el document oficial NO calcula
 * cap total global del PGAC — els deixa per separat al full "Resultat PGAC".
 * Aquest número és una comoditat de l'app, no una xifra oficial.
 */
export function resultatGeneral(objectius, camp) {
  const parts = (objectius ?? []).map((o) => resultatObjectiu(o, camp)).filter((r) => r.valor !== null)
  if (parts.length === 0) return { valor: null, total: 0, valorats: 0 }
  return {
    valor: Math.round((parts.reduce((a, p) => a + p.valor, 0) / parts.length) * 100) / 100,
    total: parts.reduce((a, p) => a + p.total, 0),
    valorats: parts.reduce((a, p) => a + p.valorats, 0),
  }
}
