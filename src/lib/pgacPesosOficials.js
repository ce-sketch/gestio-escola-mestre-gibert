// Pesos oficials del PGAC del curs 2026-27, transcrits del document
// "Eina d'avaluació PGAC Curs 2026-27" un cop revisat i corregit (agost
// de 2026). Serveixen per posar al dia un curs que ja estava desat a
// Firestore abans que l'app tingués pesos.
//
// La sincronització NOMÉS toca pesos, escales i indicadors que falten.
// Els valors de Gener i Juny que ja hi hagi introduïts no es toquen mai.

export const CURS_PESOS_OFICIALS = '2026-27'

export const PESOS_OFICIALS = [
  {
    objectiu: 1,
    competencies: {
      actiu: true,
      pes: 35,
      escala: 'indicadors6',
      text: "Consolidar l'assoliment de les competències bàsiques — nombre d'indicadors dins del llindar del Vo.",
    },
    operatius: [
      {
        codi: '1.1', pes: 25,
        indicadors: [
          { codi: '1.1.1', pes: 100, text: 'I.1.1.1. Diagnosi realitzada. Proposta didàctica dissenyada per a tots els cicles.' },
        ],
      },
      {
        codi: '1.2', pes: 75,
        indicadors: [
          { codi: '1.2.1', pes: 25, text: "I.1.2.1. Reunió realitzada. Registre a l'acta de direcció." },
          { codi: '1.2.2', pes: 25, text: 'I.1.2.2. Autoavaluació realitzada i lliurada.' },
          { codi: '1.2.3', pes: 25, text: 'I.1.2.3. Avaluació externa realitzada.' },
          { codi: '1.2.4', pes: 25, text: 'I.1.2.4. Informe de resultats analitzat. Propostes de millora incorporades a la PGAC.' },
        ],
      },
      { codi: '1.3', pes: 0, indicadors: [] },
    ],
  },
  {
    objectiu: 2,
    operatius: [
      {
        codi: '2.1', pes: 50,
        indicadors: [
          { codi: '2.1.1', pes: 20, text: 'I.2.1.1. Normativa llegida i analitzada.' },
          { codi: '2.1.2', pes: 20, text: 'I.2.1.2. Diagnòsi de la diversitat al centre elaborada.' },
          { codi: '2.1.3', pes: 60, text: 'I.2.1.3. Publicació del nou PAD a la pàgina web.' },
        ],
      },
      {
        codi: '2.2', pes: 50,
        indicadors: [
          { codi: '2.2.1', pes: 25, text: 'I.2.2.1. EDC 2026-2030 elaborada i aprovada. Nous objectius definits.' },
          { codi: '2.2.2', pes: 25, text: 'I.2.2.2. Objectius EDC revisats i en seguiment. Apartat EDC a la MAC elaborat.' },
          { codi: '2.2.3', pes: 25, text: 'I.2.2.3. Ràdio implementada a 5è. Mínim 1 emissió per trimestre.' },
          { codi: '2.2.4', pes: 25, text: "I.2.2.4. Informe d'avaluació competencial digital elaborat per a tot l'alumnat." },
        ],
      },
      { codi: '2.3', pes: 0, indicadors: [] },
    ],
  },
  {
    objectiu: 3,
    operatius: [
      {
        codi: '3.1', pes: 50,
        indicadors: [
          { codi: '3.1.1', pes: 25, text: "I.3.1.1. Nombre d'entrevistes inicials realitzades amb famílies NESE A de nova incorporació." },
          { codi: '3.1.2', pes: 25, text: 'I.3.1.2. Circuit definit i comunicat als equips docents.' },
          { codi: '3.1.3', pes: 25, text: "I.3.1.3. Protocol recollit a l'esborrany PAD i coordinacions realitzades." },
          { codi: '3.1.4', pes: 25, text: "I.3.1.4. Resultats de l'enquesta de satisfacció de famílies (apartat comunicació)." },
        ],
      },
      {
        codi: '3.2', pes: 50,
        indicadors: [
          { codi: '3.2.1', pes: 100, text: '3.2.1. Participació en el programa Transformem els Patis (AjBCN / CEB): constitució del grup motor, procés participatiu de cocreació del nou pati, elaboració del Projecte Educatiu de Pati.' },
        ],
      },
      { codi: '3.3', pes: 0, indicadors: [] },
    ],
  },
]

/** Treu el codi numèric d'un text ("I.1.2.3. Avaluació…" → "1.2.3",
 *  "Operatiu 2.1" → "2.1", "3.2.1. Participació…" → "3.2.1"). El codi ha
 *  d'anar al principi, opcionalment precedit de "Operatiu", "Indicador" o
 *  la "I" dels indicadors — així no s'enganxa a cap número que hi hagi
 *  enmig del text (per exemple "EDC 2026-2030"). */
export function codiDe(text) {
  if (!text) return null
  const m = String(text).trim().match(/^(?:operatiu|indicador|i)?\s*[.\-]?\s*(\d+(?:\.\d+)+)/i)
  return m ? m[1] : null
}

/**
 * Compara el que hi ha desat amb els pesos oficials i retorna els objectius
 * ja corregits més la llista del que canviarà, perquè es pugui ensenyar
 * abans d'aplicar-ho. No toca mai els valors de Gener i Juny.
 */
export function sincronitzaAmbOficial(objectius) {
  const canvis = []
  const nous = objectius.map((objectiu, idxObj) => {
    const plantilla = PESOS_OFICIALS[idxObj]
    if (!plantilla) return objectiu

    const operatius = objectiu.operatius.map((op) => {
      const codiOp = codiDe(op.titol) ?? codiDe(op.text)
      const plantillaOp = plantilla.operatius.find((p) => p.codi === codiOp)
      if (!plantillaOp) return op

      if (Number(op.pes) !== plantillaOp.pes) {
        canvis.push(`${op.titol}: pes ${op.pes ?? '—'}% → ${plantillaOp.pes}%`)
      }

      // Pesos dels indicadors que ja hi són
      const indicadors = op.indicadors.map((ind) => {
        const codi = codiDe(ind.text)
        const plantillaInd = plantillaOp.indicadors.find((p) => p.codi === codi)
        if (!plantillaInd) return ind
        if (Number(ind.pesGlobal) !== plantillaInd.pes) {
          canvis.push(`   ${codi}: pes ${ind.pesGlobal ?? '—'}% → ${plantillaInd.pes}%`)
        }
        return { ...ind, pesGlobal: plantillaInd.pes }
      })

      // Indicadors del document que aquí encara no hi són
      for (const plantillaInd of plantillaOp.indicadors) {
        const hiEs = indicadors.some((ind) => codiDe(ind.text) === plantillaInd.codi)
        if (!hiEs) {
          indicadors.push({
            id: crypto.randomUUID(),
            text: plantillaInd.text,
            gener: '', juny: '',
            escala: 'execucio',
            valor: 100,
            pesGlobal: plantillaInd.pes,
          })
          canvis.push(`   ${plantillaInd.codi}: indicador NOU (pes ${plantillaInd.pes}%)`)
        }
      }

      return { ...op, pes: plantillaOp.pes, indicadors }
    })

    let competencies = objectiu.competencies
    if (plantilla.competencies && !objectiu.competencies?.actiu) {
      competencies = { ...objectiu.competencies, ...plantilla.competencies }
      canvis.push(`${objectiu.titol}: s'activa el ${100 - plantilla.competencies.pes}/${plantilla.competencies.pes} amb les competències bàsiques`)
    }

    return { ...objectiu, operatius, competencies }
  })

  return { objectius: nous, canvis }
}
