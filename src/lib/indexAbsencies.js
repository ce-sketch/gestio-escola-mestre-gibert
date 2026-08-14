// Índex d'absències, tal com el calcula el full "Assistència" de l'Eina
// d'avaluació PGAC.
//
// Com ho fa el full
// -----------------
// Per a cada alumne, i per a cada trimestre:
//
//   índex d'absències   = (absències justificades + no justificades)
//                         ─────────────────────────────────────────
//                              dies lectius × 2 sessions
//
//   no justificades     = només les injustificades, sobre el mateix total
//
// I la graella per grup és un simple recompte:
//
//   B6 = COUNTIF(V7:V36 ; ">10%")   ← quants alumnes passen del 10%
//   B7 = COUNTIF(V7:V38 ; ">25%")   ← quants passen del 25%
//   U6 = SUM(B6:T6)                 ← el total de l'escola
//
// Verificat contra el full del centre: 31 sessions d'absència sobre 162
// (81 dies lectius × 2) donen el 19,14% que hi surt.
//
// Diferència amb el full: allà els números arriben per IMPORTRANGE dels
// fulls de cada tutora; aquí surten de la col·lecció "assistencia", que ja
// té cada marca amb alumne, data, torn i estat.

import { comptaDiesLectius } from './calendar'

/** Els dos llindars que demana el SIC (indicadors 1.11 a 1.14). */
export const LLINDARS = [10, 25]

const ES_ABSENCIA = (estat) => estat === 'absent_justificat' || estat === 'absent_injustificat'
const ES_INJUSTIFICADA = (estat) => estat === 'absent_injustificat'
const ES_PUNTUALITAT = (estat) => estat === 'retard_injustificat'

/**
 * Quantes sessions lectives té un trimestre: els dies lectius per dos, que
 * és el que fa servir el full (matí i tarda).
 */
export function sessionsDelTrimestre(trimestre, diesNoLectius) {
  if (!trimestre?.inici || !trimestre?.fi) return 0
  return comptaDiesLectius(trimestre.inici, trimestre.fi, diesNoLectius) * 2
}

/**
 * Índex d'un alumne dins d'un període.
 *
 * @param {Array} registres  marques d'assistència ja filtrades per alumne
 * @param {number} sessions  dies lectius × 2
 */
export function indexAlumne(registres, sessions) {
  if (!sessions) return { total: 0, injustificades: 0, puntualitat: 0, sessions: 0 }
  // Un alumne pot tenir més d'una marca per al mateix dia i torn (una
  // correcció posterior). Ens quedem amb l'última de cada dia+torn, igual
  // que fa el mòdul d'Assistència.
  const vigents = new Map()
  for (const r of registres) {
    const clau = `${r.data}__${r.torn}`
    const previ = vigents.get(clau)
    if (!previ || (r.creatEl?.seconds ?? 0) >= (previ.creatEl?.seconds ?? 0)) vigents.set(clau, r)
  }

  let absencies = 0
  let injustificades = 0
  let puntualitat = 0
  for (const r of vigents.values()) {
    if (ES_ABSENCIA(r.estat)) absencies++
    if (ES_INJUSTIFICADA(r.estat)) injustificades++
    if (ES_PUNTUALITAT(r.estat)) puntualitat++
  }

  return {
    total: absencies / sessions,
    injustificades: injustificades / sessions,
    puntualitat: puntualitat / sessions,
    sessions,
    absencies,
    comptaInjustificades: injustificades,
  }
}

/**
 * La graella de la imatge: per a cada grup, quants alumnes passen de cada
 * llindar, i quin percentatge del grup representen.
 *
 * @returns {{grups: Array, total: object}}
 */
export function graellaAbsencies({ alumnes, registres, sessions, nomesInjustificades = false }) {
  const perAlumne = new Map()
  for (const r of registres) {
    if (!perAlumne.has(r.alumneId)) perAlumne.set(r.alumneId, [])
    perAlumne.get(r.alumneId).push(r)
  }

  const grups = new Map()
  for (const alumne of alumnes) {
    const grup = alumne.curs ?? '(sense grup)'
    if (!grups.has(grup)) grups.set(grup, { grup, alumnes: 0, llindars: {}, quiSupera: {} })
    const fila = grups.get(grup)
    fila.alumnes++

    const idx = indexAlumne(perAlumne.get(alumne.id) ?? [], sessions)
    const valor = nomesInjustificades ? idx.injustificades : idx.total

    for (const llindar of LLINDARS) {
      fila.llindars[llindar] = fila.llindars[llindar] ?? 0
      fila.quiSupera[llindar] = fila.quiSupera[llindar] ?? []
      if (valor * 100 > llindar) {
        fila.llindars[llindar]++
        fila.quiSupera[llindar].push({
          id: alumne.id,
          nom: alumne.nom,
          percentatge: Math.round(valor * 1000) / 10,
        })
      }
    }
  }

  const files = [...grups.values()].sort((a, b) => a.grup.localeCompare(b.grup, 'ca'))
  const total = {
    alumnes: files.reduce((t, f) => t + f.alumnes, 0),
    llindars: {},
  }
  for (const llindar of LLINDARS) {
    total.llindars[llindar] = files.reduce((t, f) => t + (f.llindars[llindar] ?? 0), 0)
  }

  return { grups: files, total }
}

/** El percentatge que representa un recompte dins del seu grup. */
export function percentatgeDelGrup(compte, alumnes) {
  if (!alumnes) return 0
  return Math.round((compte / alumnes) * 1000) / 10
}
