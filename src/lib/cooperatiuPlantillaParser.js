// Lector de la plantilla "Valoració Aprenentatge Cooperatiu".
//
// El document té un full per nivell (P-3, P-4, P-5, 1r… 6è). Dins de cada
// full, els tres objectius de sempre, i sota cada objectiu les actuacions
// concretes d'aquell nivell — que **no són les mateixes a tot arreu**: a
// P-3 l'objectiu 3 en té una i a P-5 en té quatre.
//
// L'escala de cada actuació ve escrita dins del text del criteri, no en una
// fórmula com a les comissions:
//
//   "Llegeixo els acords… Fet(100%)/no fet(0%)"
//   "Utilitzo 0 dinàmiques de cohesió: No assolit=0% · entre 1 i 2: Baix=20%
//    · entre 2 i 4: Poc satisfactori=40% …"
//
// Per això aquí es fa servir `escalaDeText` i no `escalaDeFormula`.

import { text, neteja, escalaDeText, identificaEscala } from './excelLectura'
import { carregaExcelJS } from './carregaLlibreries'
import { OBJECTIUS_COOPERATIU, TOTS_ELS_NIVELLS } from './aprenentatgeCooperatiu'

/** Al document els nivells d'infantil es diuen P-3, P-4 i P-5; a l'app,
 *  I-3, I-4 i I-5. */
const EQUIVALENCIES = { 'p-3': 'I-3', 'p-4': 'I-4', 'p-5': 'I-5' }

/** Files que tenen text però no són cap actuació: capçaleres de la taula,
 *  instruccions per a qui l'omple i el peu de pàgina del centre. */
const NO_SON_ACTUACIONS = [
  /^-?\s*Recorda que si copies/i,
  /^Seguiment\s+gener/i,
  /^Grau\s+d.assoliment/i,
  /^Escola Mestre/i,
  /^Valoraci\u00f3 PGAC/i,
  /^Curs:/i,
  /^Nivell:?$/i,
  /^Activitat:/i,
  /^Data:/i,
  /^Objectius?$/i,
  /^Criteris$/i,
  /^(No assolit|Baix|Poc satisfactori|Satisfactori|Bo|Alt|Fet|No fet)$/i,
]

function nivellDelFull(linies) {
  for (const linia of linies.slice(0, 10)) {
    const m = neteja(linia).match(/Nivell\s+(P-?\s?[345]|1r|2n|3r|4t|5è|6è)/i)
    if (!m) continue
    const trobat = m[1].toLowerCase().replace(/\s/g, '')
    return EQUIVALENCIES[trobat] ?? TOTS_ELS_NIVELLS.find((n) => n.toLowerCase() === trobat) ?? null
  }
  return null
}

/** Quin dels tres objectius és aquesta línia, si ho és. */
function objectiuDeLaLinia(linia) {
  const net = neteja(linia).toLowerCase().replace(/^[-–\s]+/, '')
  if (!net) return null
  if (net.startsWith("seguir la línia d'escola")) return 'linia'
  if (net.startsWith('aplicar la metodologia')) return 'metodologia'
  if (net.startsWith('realitzar els projectes')) return 'projectes'
  return null
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{nivells: Object, avisos: string[]}>}
 */
export async function llegeixPlantillaCooperatiu(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const nivells = {}
  const avisos = []

  for (const ws of wb.worksheets) {
    // El primer full és el resum; els que ens interessen diuen quin nivell són.
    const primeres = []
    for (let f = 1; f <= Math.min(ws.rowCount, 10); f++) {
      primeres.push(text(ws.getCell(`B${f}`)) || text(ws.getCell(`A${f}`)))
    }
    const nivell = nivellDelFull(primeres)
    if (!nivell) continue

    const objectius = {}
    let objectiuActual = null

    for (let f = 1; f <= ws.rowCount; f++) {
      const titol = neteja(text(ws.getCell(`B${f}`)))
      if (!titol) continue

      const quin = objectiuDeLaLinia(titol)
      if (quin) { objectiuActual = quin; objectius[quin] = objectius[quin] ?? []; continue }
      if (!objectiuActual) continue
      if (/^Comentaris i propostes/i.test(titol)) { objectiuActual = null; continue }
      if (NO_SON_ACTUACIONS.some((p) => p.test(titol))) continue

      // Tota la resta de files amb text, dins d'un objectiu, són
      // actuacions. Abans es demanava que la casella de seguiment del
      // costat tingués alguna cosa escrita, però en una plantilla en blanc
      // està buida i no se'n detectava ni una.

      const { escala, opcions } = identificaEscala(escalaDeText(titol), 'binaria')
      objectius[objectiuActual].push({
        id: crypto.randomUUID(),
        text: titol,
        gener: '',
        juny: '',
        escala,
        opcions,
      })
    }

    const quantes = Object.values(objectius).reduce((t, a) => t + a.length, 0)
    if (quantes === 0) {
      avisos.push(`${nivell}: no hi he trobat cap actuació.`)
      continue
    }
    nivells[nivell] = objectius
  }

  if (Object.keys(nivells).length === 0) {
    throw new Error(
      "No he trobat cap full de nivell dins d'aquest fitxer. Comprova que és la plantilla " +
      '"Valoració Aprenentatge Cooperatiu" i no el full resum de l\'Eina d\'avaluació.'
    )
  }

  const falten = TOTS_ELS_NIVELLS.filter((n) => !nivells[n])
  if (falten.length > 0) {
    avisos.push(`No hi ha full per a ${falten.join(', ')}: aquests nivells quedaran com estaven.`)
  }

  const ambPropia = Object.values(nivells)
    .flatMap((o) => Object.values(o).flat())
    .filter((a) => a.escala === 'propia').length
  if (ambPropia > 0) {
    avisos.push(`${ambPropia} actuacions tenen una escala que no és cap de les conegudes; s'han desat tal com surten al full.`)
  }

  return { nivells, avisos }
}

/**
 * Posa les actuacions llegides dins de les dades que ja hi ha, sense tocar
 * res del que ja s'hagi valorat en un nivell que la plantilla no porti.
 */
export function aplicaPlantilla(dades, nivells) {
  const valors = { ...dades.valors }
  for (const [nivell, objectius] of Object.entries(nivells)) {
    valors[nivell] = { ...valors[nivell] }
    for (const o of OBJECTIUS_COOPERATIU) {
      valors[nivell][o.id] = {
        ...(valors[nivell][o.id] ?? { gener: '', juny: '' }),
        actuacions: objectius[o.id] ?? [],
      }
    }
  }
  return { ...dades, valors }
}

/** Un resum de què porta la plantilla, per ensenyar-lo abans d'aplicar-la. */
export function resumPlantilla(nivells) {
  return Object.entries(nivells).map(([nivell, objectius]) => ({
    nivell,
    total: Object.values(objectius).reduce((t, a) => t + a.length, 0),
    perObjectiu: OBJECTIUS_COOPERATIU.map((o) => ({
      id: o.id,
      quantes: (objectius[o.id] ?? []).length,
    })),
  }))
}
