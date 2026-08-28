// Els resums de TEE, CL i VL: quants alumnes de cada classe hi ha a cada
// franja d'assoliment.
//
// Per què està aquí i no dins de Resum.jsx
// ----------------------------------------
// Aquest càlcul vivia dins del component, barrejat amb `useMemo` i amb la
// pintura de la taula. Això volia dir que "Descàrregues" —el lloc per
// baixar-ho tot de cop— no el podia fer servir, i per això el document
// complet es quedava sense els resums de proves.
//
// Al treure'l aquí, el mateix càlcul alimenta la pantalla i l'exportació,
// i no hi ha manera que se separin: si algun dia canvia el criteri,
// canvia als dos llocs alhora.

import { redueixVigents } from './avaluacioCatala'
import { aEscalaComuna } from './rubricaTEE'
import { MOMENTS_LECTURA, vlAEscalaComuna, grauPrimaria } from './rubricaLectura'

export const COLUMNES_COMUNES = [
  { id: 'no_assoliment', label: 'No Assoliment' },
  { id: 'assoliment_satisfactori', label: 'Ass. Satisfactori' },
  { id: 'assoliment_notable', label: 'Ass. Notable' },
  { id: 'assoliment_excel·lent', label: 'Ass. Excel·lent' },
]

export const COLUMNES_CL = ['BAIX', 'M.BAIX', 'M.ALT', 'ALT']

/** Els identificadors d'una llista de columnes, que tant poden ser
 *  objectes {id,label} com cadenes soltes. */
const idsDe = (columnes) => columnes.map((c) => c.id ?? c)

/**
 * Suma totes les classes.
 *
 * `excloure1r` existeix perquè a 1r encara s'està aprenent a llegir i
 * escriure: el centre mira sempre les dues xifres, amb 1r i sense, i
 * comparar-les diu coses diferents.
 */
export function totalGlobal(files, columnes, excloure1r) {
  const ids = idsDe(columnes)
  const comptadors = Object.fromEntries(ids.map((id) => [id, 0]))
  let total = 0
  for (const f of files) {
    if (excloure1r && grauPrimaria(f.curs) === 1) continue
    for (const id of ids) comptadors[id] += f.comptadors[id] ?? 0
    total += f.total
  }
  return { comptadors, total }
}

/** Passa una taula calculada al format de files que volen `exportaExcel`
 *  i `exportaPDF`, amb les dues files de TOTAL al final. */
export function taulaExportable(capçalera, files, columnes) {
  const ids = idsDe(columnes)
  const labels = columnes.map((c) => c.label ?? c)
  const cos = files.map((f) => [f.curs, ...ids.map((id) => f.comptadors[id]), f.total])
  const ambPrimer = totalGlobal(files, columnes, false)
  const sensePrimer = totalGlobal(files, columnes, true)
  cos.push(['TOTAL (amb 1r)', ...ids.map((id) => ambPrimer.comptadors[id]), ambPrimer.total])
  cos.push(['TOTAL (sense 1r)', ...ids.map((id) => sensePrimer.comptadors[id]), sensePrimer.total])
  return [[capçalera, ...labels, 'Total avaluats'], ...cos]
}

/** El repartiment del TEE d'un trimestre, classe per classe. */
export function resumTee(teeRegistres, { trimestre, cursos, cursEscolarId }) {
  const delTrimestre = (teeRegistres ?? []).filter(
    (r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarId) === cursEscolarId)
  const vigents = redueixVigents(delTrimestre, (r) => `${r.alumneId}-${r.trimestre}`)
  return cursos.map((curs) => {
    const comptadors = Object.fromEntries(idsDe(COLUMNES_COMUNES).map((id) => [id, 0]))
    for (const r of vigents.filter((r) => r.curs === curs)) {
      // Cada cicle té la seva rúbrica: cal passar-ho tot a una escala
      // comuna abans de sumar classes de cicles diferents. `aEscalaComuna`
      // rep NOMÉS l'identificador del nivell, que ja porta el cicle a dins.
      const comu = aEscalaComuna(r.global)
      if (comu) comptadors[comu] += 1
    }
    return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
  })
}

/** El repartiment de la comprensió lectora, per moment. */
export function resumCl(lecturaRegistres, { cursos, cursEscolarId }) {
  return ['inicial', 'final'].map((momentId) => {
    const vigents = redueixVigents(
      (lecturaRegistres ?? []).filter((r) => r.moment === momentId && (r.cursEscolar ?? cursEscolarId) === cursEscolarId),
      (r) => `${r.alumneId}-${momentId}`
    )
    const files = cursos.map((curs) => {
      const comptadors = Object.fromEntries(COLUMNES_CL.map((c) => [c, 0]))
      for (const r of vigents.filter((r) => r.curs === curs && r.nivellCl)) {
        if (comptadors[r.nivellCl] !== undefined) comptadors[r.nivellCl] += 1
      }
      return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
    })
    return { momentId, label: MOMENTS_LECTURA.find((m) => m.id === momentId)?.label, files }
  })
}

/** El repartiment de la velocitat lectora, per moment. */
export function resumVl(lecturaRegistres, { cursos, cursEscolarId }) {
  return MOMENTS_LECTURA.map((moment) => {
    const vigents = redueixVigents(
      (lecturaRegistres ?? []).filter((r) => r.moment === moment.id && (r.cursEscolar ?? cursEscolarId) === cursEscolarId),
      (r) => `${r.alumneId}-${moment.id}`
    )
    const files = cursos.map((curs) => {
      const comptadors = Object.fromEntries(idsDe(COLUMNES_COMUNES).map((id) => [id, 0]))
      for (const r of vigents.filter((r) => r.curs === curs && r.vl !== null && r.vl !== undefined)) {
        // La velocitat es compara amb el que s'espera del propi curs: 80
        // paraules per minut no volen dir el mateix a 2n que a 6è.
        const comu = vlAEscalaComuna(r.vl, r.nivellVl, curs)
        if (comu && comptadors[comu] !== undefined) comptadors[comu] += 1
      }
      return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
    })
    return { moment, files }
  })
}

/** Els fulls del TEE, llestos per exportar. */
export function fullsTee(teeRegistres, opcions) {
  return [{
    nom: `TEE ${opcions.trimestre}`,
    files: taulaExportable('Classe', resumTee(teeRegistres, opcions), COLUMNES_COMUNES),
  }]
}

/** Els fulls de lectura (CL per moment i VL per moment). */
export function fullsLectura(lecturaRegistres, opcions) {
  const fulls = []
  for (const { label, files } of resumCl(lecturaRegistres, opcions)) {
    fulls.push({ nom: `CL ${label}`, files: taulaExportable('Classe', files, COLUMNES_CL) })
  }
  for (const { moment, files } of resumVl(lecturaRegistres, opcions)) {
    fulls.push({ nom: `VL ${moment.label}`, files: taulaExportable('Classe', files, COLUMNES_COMUNES) })
  }
  return fulls
}
