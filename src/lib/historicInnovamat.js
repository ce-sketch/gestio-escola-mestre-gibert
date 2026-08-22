// Històric dels informes d'Innovamat (ConMat).
//
// ⚠️ El problema que resol aquest fitxer
// --------------------------------------
// Fins ara, cada alumne tenia UN SOL registre per curs a la col·lecció
// "matematiques", amb el ConMat desat en un camp pla:
//
//     { cursEscolar: '2025-26', alumneId: 'x', conmat: { nivell, ... } }
//
// Això volia dir que en pujar l'informe de final de curs, S'ESBORRAVA el
// d'inici de curs del mateix alumne. No hi havia històric possible.
//
// Ara el ConMat es desa dins d'un mapa, indexat pel moment de la prova:
//
//     conmat: { inici: { nivell, ... }, final: { nivell, ... } }
//
// Les dues formes conviuen: `momentsConmat()` llegeix indistintament els
// registres antics (plans) i els nous (mapa), de manera que les dades que
// ja hi havia desades no es perden ni cal migrar-les a mà.

import { NIVELLS_CONMAT } from './conmatParser'

/** Els dos moments en què l'Innovamat passa les ConMat cada curs. */
export const MOMENTS = [
  { id: 'inici', label: 'Inici de curs' },
  { id: 'final', label: 'Final de curs' },
]

/** Dedueix l'id del moment ('inici' o 'final') a partir del text que surt
 *  a la portada del PDF ("Avaluació inicial" / "Avaluació final"). Si no
 *  el reconeix, retorna 'inici' — és el cas més freqüent i evita perdre
 *  la lectura, però queda registrat el text original per poder revisar-ho. */
export function momentId(textMoment) {
  return /final/i.test(String(textMoment ?? '')) ? 'final' : 'inici'
}

export function momentLabel(id) {
  return MOMENTS.find((m) => m.id === id)?.label ?? id
}

/**
 * Retorna els moments de ConMat d'un registre d'alumne, en forma de
 * llista, tant si venen del format antic (un sol objecte pla) com del nou
 * (un mapa per moment).
 *
 * @returns {Array<{moment, ...dadesConmat}>}
 */
export function momentsConmat(registre) {
  const c = registre?.conmat
  if (!c) return []
  // Format antic: un únic objecte amb el nivell directament a dins.
  if (c.nivell !== undefined || c.percentatge !== undefined) {
    return [{ moment: momentId(c.moment), ...c }]
  }
  // Format nou: un mapa { inici: {...}, final: {...} }
  return MOMENTS
    .filter((m) => c[m.id])
    .map((m) => ({ moment: m.id, ...c[m.id] }))
}

/**
 * Aplana tots els registres de "matematiques" en una llista d'entrades
 * d'històric, una per alumne i moment, ordenades de la més recent a la
 * més antiga.
 */
export function entradesHistoric(registres) {
  const entrades = []
  for (const r of registres) {
    if (r.tipus === 'informe') continue // els registres d'informes carregats no són alumnes
    for (const m of momentsConmat(r)) {
      entrades.push({
        cursEscolar: r.cursEscolar,
        alumneId: r.alumneId ?? null,
        nom: r.nom,
        // Alumnes que no consten com a actius al centre (cursos passats):
        // el nom ve del PDF de l'Innovamat, no de la fitxa d'alumne.
        sensCasar: r.sensCasar === true,
        moment: m.moment,
        classe: m.classe ?? null,
        nivell: m.nivell ?? null,
        percentatge: m.percentatge ?? null,
        respostes: m.respostes ?? null,
        preguntes: m.preguntes ?? null,
      })
    }
  }
  return entrades.sort((a, b) => {
    const curs = String(b.cursEscolar).localeCompare(String(a.cursEscolar))
    if (curs !== 0) return curs
    if (a.moment !== b.moment) return a.moment === 'final' ? -1 : 1
    return String(a.nom).localeCompare(String(b.nom))
  })
}

/**
 * El resultat de ConMat més recent d'un alumne concret — el que es mostra
 * a l'apartat de matemàtiques de l'informe individual.
 */
export function ultimConmatDe(registres, alumneId) {
  if (!alumneId) return null
  return entradesHistoric(registres).find((e) => e.alumneId === alumneId) ?? null
}

/**
 * Reparteix un conjunt d'entrades pels quatre nivells del ConMat i en
 * calcula els percentatges — el mateix càlcul que es feia a mà al full
 * "ConMath Curs actual" (columnes ALUMNES i CENTRE).
 */
export function distribucioPerNivell(entrades) {
  const total = entrades.length
  const files = NIVELLS_CONMAT.map((n) => {
    const alumnes = entrades.filter((e) => String(e.nivell ?? '').toLowerCase() === n.label.toLowerCase()).length
    return {
      nivell: n.label,
      alumnes,
      percentatge: total > 0 ? Math.round((alumnes / total) * 10000) / 100 : 0,
    }
  })
  return { files, total }
}

/** Agrupa les entrades per curs escolar i moment, per poder-les mostrar
 *  com una taula d'històric amb una secció per prova. */
export function agrupaPerProva(entrades) {
  const grups = new Map()
  for (const e of entrades) {
    const clau = `${e.cursEscolar}__${e.moment}`
    if (!grups.has(clau)) {
      grups.set(clau, { cursEscolar: e.cursEscolar, moment: e.moment, entrades: [] })
    }
    grups.get(clau).entrades.push(e)
  }
  return [...grups.values()]
}
