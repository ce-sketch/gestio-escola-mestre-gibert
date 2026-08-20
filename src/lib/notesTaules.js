// Construcció de les taules de notes per àrea per als documents que
// s'imprimeixen (annexos de la Memòria Anual).
//
// Per què no es reaprofita la graella de la pantalla
// --------------------------------------------------
// A "Entrada de notes" cada àrea ocupa 4 columnes (1r, 2n, 3r, Final).
// Amb 11 àrees són 44 columnes de números: a la pantalla es pot fer
// desplaçament lateral i va bé, però imprès no es llegeix ni partint-ho
// en dues pàgines — surten números diminuts sense context.
//
// Per a l'annex es gira l'enfocament: **un moment per taula** (una taula
// del 1r trimestre, una del 2n, una del 3r i una de la nota Final), i
// dins de cada taula **una sola columna per àrea**. Passen de 44 columnes
// a 13, que en A4 apaïsat es llegeixen còmodament i tenen l'aspecte d'un
// document oficial.

import { AREES, TRIMESTRES, areaAplicaAClasse, notaFinalArea } from './notesArea'

export const MOMENTS_NOTES = [...TRIMESTRES, 'Final']

/**
 * Les taules d'una classe, una per moment.
 *
 * @param {string} classe                 "1A", "6B"...
 * @param {Array} alumnesClasse           ja ordenats per número de llista
 * @param {Function} notaDe               (alumneId, areaId, trimestre) -> nota o ''
 * @param {Object} opcions
 * @param {string[]} [opcions.moments]    quins moments es volen (per defecte, tots)
 * @returns {Array<{nom: string, files: Array}>}
 */
export function taulesNotesClasse(classe, alumnesClasse, notaDe, { moments = MOMENTS_NOTES } = {}) {
  const areesClasse = AREES.filter((a) => areaAplicaAClasse(a.id, classe))

  const notaFinalDe = (alumneId, area) => (
    area.calculada
      ? notaFinalArea(area.deArees.map((id) => notaFinalArea(TRIMESTRES.map((t) => notaDe(alumneId, id, t)))))
      : notaFinalArea(TRIMESTRES.map((t) => notaDe(alumneId, area.id, t)))
  )

  return moments.map((moment) => {
    const capçalera = ['Núm.', 'Alumne', ...areesClasse.map((a) => a.label)]
    const files = alumnesClasse.map((alumne) => [
      alumne.numLlista ?? '',
      alumne.nom,
      ...areesClasse.map((area) => {
        if (moment === 'Final') return notaFinalDe(alumne.id, area) ?? ''
        // Les àrees calculades (Artística, Medi global) no s'introdueixen
        // per trimestre: només en té sentit la nota final.
        if (area.calculada) return ''
        return notaDe(alumne.id, area.id, moment)
      }),
    ])
    return { nom: `${classe} — ${moment}`, files: [capçalera, ...files] }
  })
}
