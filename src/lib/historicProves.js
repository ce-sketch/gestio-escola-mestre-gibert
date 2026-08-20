// Històric de resultats de les proves internes (TEE i VL/CL).
//
// D'ON SURTEN AQUESTES DADES
// --------------------------
// Són les pestanyes "Resultats TEE" i "Resultats VLCL" de l'Eina
// d'avaluació PGAC del centre, llegides del full i copiades aquí tal com
// hi són. NO s'han recalculat ni arrodonit: són el registre històric del
// centre i s'han de tractar com a intocables. Si un any surt rar (el
// 19/20 de pandèmia, per exemple), és que al full també hi surt rar.
//
// Els percentatges NO es desen: es calculen a partir dels recomptes, que
// és l'única xifra que no es pot recuperar si es perd.
//
// COM CREIX
// ---------
// Aquest fitxer és el passat, i no s'hi ha de tornar a tocar. El curs en
// marxa NO s'hi afegeix a mà: el mòdul "Històric" el calcula sol a partir
// del que hi ha a Firestore i l'enganxa al final de la sèrie. Quan un curs
// s'acaba i les seves dades ja no canviaran, es pot congelar aquí amb
// "Copia el curs actual per afegir-lo a l'històric" del mateix mòdul.

/** Els quatre nivells de l'escala comuna, en l'ordre del full. */
export const NIVELLS_HISTORIC = [
  { id: 'na', label: 'No Assoliment', curt: 'NA' },
  { id: 'asat', label: 'Assoliment Satisfactòri', curt: 'AS' },
  { id: 'anot', label: 'Assoliment Notable', curt: 'AN' },
  { id: 'aexc', label: 'Assoliment Excel·lent', curt: 'AE' },
]

/**
 * Històric del TEE. `cursos` diu quins nivells entraven al còmput
 * aquell any (no sempre han estat els mateixos: alguns anys hi ha 1r i
 * altres no), i per això dos registres del mateix curs poden conviure.
 */
export const HISTORIC_TEE = [
  { curs: '25/26', trimestre: '1r', cursos: '2- 3-4-5-6', na: 79, asat: 110, anot: 59, aexc: 11, total: 259 },
  { curs: '24/25', trimestre: '1r', cursos: '2- 3-4-5-6', na: 56, asat: 90, anot: 80, aexc: 20, total: 246 },
  { curs: '23/24', trimestre: '1r', cursos: '2- 3-4-5-6', na: 50, asat: 100, anot: 90, aexc: 28, total: 268 },
  { curs: '22/23', trimestre: '1r', cursos: '2- 3-4-5-6', na: 46, asat: 88, anot: 97, aexc: 38, total: 269 },
  { curs: '21/22', trimestre: '1r', cursos: '2- 3-4-5-6', na: 41, asat: 93, anot: 97, aexc: 39, total: 270 },
  { curs: '20/21', trimestre: '1r', cursos: '2- 3-4-5-6', na: 26, asat: 93, anot: 92, aexc: 86, total: 297 },
  { curs: '19/20', trimestre: '1r', cursos: '2- 3-4-5-6', na: 32, asat: 99, anot: 126, aexc: 40, total: 297 },
  { curs: '18/19', trimestre: '1r', cursos: '2- 3-4-5-6', na: 39, asat: 106, anot: 93, aexc: 37, total: 275 },
  { curs: '17/18', trimestre: '1r', cursos: '3-4-5-6', na: 34, asat: 85, anot: 68, aexc: 34, total: 221 },
  { curs: '25/26', trimestre: '3r', cursos: '2- 3-4-5-6', na: 26, asat: 82, anot: 97, aexc: 42, total: null },
  { curs: '24/25', trimestre: '3r', cursos: '2- 3-4-5-6', na: 36, asat: 65, anot: 105, aexc: 42, total: 248 },
  { curs: '23/24', trimestre: '3r', cursos: '2- 3-4-5-6', na: 28, asat: 75, anot: 118, aexc: 50, total: 271 },
  { curs: '23/24', trimestre: '3r', cursos: '1-2- 3-4-5-6', na: 35, asat: 87, anot: 147, aexc: 54, total: 323 },
  { curs: '22/23', trimestre: '3r', cursos: '2- 3-4-5-6', na: 23, asat: 70, anot: 114, aexc: 64, total: 271 },
  { curs: '21/22', trimestre: '3r', cursos: '2- 3-4-5-6', na: 30, asat: 75, anot: 103, aexc: 61, total: 269 },
  { curs: '20/21', trimestre: '3r', cursos: '2- 3-4-5-6', na: 17, asat: 96, anot: 122, aexc: 58, total: 293 },
  { curs: '18/19', trimestre: '3r', cursos: '2- 3-4-5-6', na: 32, asat: 89, anot: 80, aexc: 61, total: 262 },
  { curs: '17/18', trimestre: '3r', cursos: '3-4-5-6', na: 27, asat: 87, anot: 107, aexc: 49, total: 270 },
]

/** Històric de VL i CL. Cada any porta les dues proves per separat. */
export const HISTORIC_VLCL = [
  { curs: '25/26', trimestre: '1r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 172, asat: 21, anot: 27, aexc: 78, total: 298 }, cl: { na: 104, asat: 76, anot: 55, aexc: 18, total: 253 } },
  { curs: '24/25', trimestre: '1r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 167, asat: 29, anot: 27, aexc: 74, total: 249 }, cl: { na: 101, asat: 74, anot: 56, aexc: 17, total: 248 } },
  { curs: '23/24', trimestre: '1r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 133, asat: 23, anot: 27, aexc: 88, total: 271 }, cl: { na: 109, asat: 78, anot: 59, aexc: 24, total: 270 } },
  { curs: '22/23', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 169, asat: 31, anot: 18, aexc: 101, total: 319 }, cl: { na: 108, asat: 84, anot: 62, aexc: 19, total: 273 } },
  { curs: '21/22', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 173, asat: 32, anot: 26, aexc: 89, total: 320 }, cl: { na: 60, asat: 68, anot: 78, aexc: 64, total: 270 } },
  { curs: '20/21', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 146, asat: 38, anot: 41, aexc: 97, total: 322 }, cl: { na: 84, asat: 90, anot: 69, aexc: 30, total: 273 } },
  { curs: '19/20', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 146, asat: 42, anot: 31, aexc: 124, total: 343 }, cl: { na: 79, asat: 99, anot: 77, aexc: 34, total: 289 } },
  { curs: '18/19', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 166, asat: 39, anot: 55, aexc: 92, total: 352 }, cl: { na: 138, asat: 80, anot: 38, aexc: 11, total: 267 } },
  { curs: '17/18', trimestre: '1r', cursos: '1-2-3-4-5-6 VL - 2-3-4-5 CL', vl: { na: null, asat: null, anot: null, aexc: null, total: null }, cl: { na: 49, asat: 76, anot: 82, aexc: 15, total: 222 } },
  { curs: '25/26', trimestre: '3r', cursos: '2-3-4-5-6 VL 2-3-4-5-6 CL', vl: { na: 56, asat: 14, anot: 14, aexc: 164, total: 248 }, cl: { na: 37, asat: 50, anot: 81, aexc: 82, total: 250 } },
  { curs: '24/25', trimestre: '3r', cursos: '2-3-4-5-6 VL 2-3-4-5-6 CL', vl: { na: 50, asat: 8, anot: 11, aexc: 179, total: 248 }, cl: { na: 39, asat: 44, anot: 88, aexc: 77, total: 248 } },
  { curs: '24/25', trimestre: '3r', cursos: '1-2-3-4-5-6 VL -1- 2-3-4-5-6 CL', vl: { na: 65, asat: 18, anot: 21, aexc: 194, total: 298 }, cl: { na: 43, asat: 47, anot: 98, aexc: 110, total: 298 } },
  { curs: '23/24', trimestre: '3r', cursos: '2-3-4-5-6 VL 2-3-4-5-6 CL', vl: { na: 50, asat: 6, anot: 6, aexc: 207, total: 269 }, cl: { na: 47, asat: 72, anot: 92, aexc: 58, total: 269 } },
  { curs: '23/24', trimestre: '3r', cursos: '1-2-3-4-5-6 VL -1- 2-3-4-5-6 CL', vl: { na: 84, asat: 11, anot: 19, aexc: 207, total: 321 }, cl: { na: 61, asat: 76, anot: 98, aexc: 86, total: 321 } },
  { curs: '22/23', trimestre: '3r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 64, asat: 12, anot: 19, aexc: 178, total: 273 }, cl: { na: 54, asat: 73, anot: 93, aexc: 49, total: 269 } },
  { curs: '21/22', trimestre: '3r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 98, asat: 18, anot: 18, aexc: 203, total: 337 }, cl: { na: 30, asat: 71, anot: 97, aexc: 123, total: 321 } },
  { curs: '20/21', trimestre: '3r', cursos: '2-3-4-5-6 VL - 2-3-4-5-6 CL', vl: { na: 80, asat: 15, anot: 9, aexc: 220, total: 324 }, cl: { na: 36, asat: 39, anot: 113, aexc: 132, total: 320 } },
]

// ── Càlculs ─────────────────────────────────────────────────────────────

/** Percentatges d'un registre, calculats a partir dels recomptes. */
export function percentatges(registre, total = registre?.total) {
  const suma = NIVELLS_HISTORIC.reduce((t, n) => t + (Number(registre?.[n.id]) || 0), 0)
  // Si el total apuntat no hi és o no quadra, es fa servir la suma dels
  // recomptes, que és l'única xifra que no es contradiu a si mateixa.
  const base = Number(total) || suma
  if (!base) return Object.fromEntries(NIVELLS_HISTORIC.map((n) => [n.id, null]))
  return Object.fromEntries(
    NIVELLS_HISTORIC.map((n) => [n.id, registre?.[n.id] === null || registre?.[n.id] === undefined
      ? null
      : Math.round((Number(registre[n.id]) / base) * 1000) / 10])
  )
}

/**
 * Files de l'històric on els recomptes no sumen el total que hi ha
 * apuntat. Són incoherències que ja venen del full original: aquí no es
 * corregeixen (seria inventar-se el passat), però es fan visibles perquè
 * es puguin revisar contra el document del centre.
 */
export function avisosHistoric() {
  const avisos = []
  const revisa = (etiqueta, registre) => {
    const suma = NIVELLS_HISTORIC.reduce((t, n) => t + (Number(registre[n.id]) || 0), 0)
    const total = Number(registre.total)
    if (total && suma && Math.abs(suma - total) > 0.5) {
      avisos.push(`${etiqueta}: els recomptes sumen ${suma} però el total apuntat és ${total}.`)
    }
  }
  for (const r of HISTORIC_TEE) revisa(`TEE ${r.curs} ${r.trimestre} trim.`, r)
  for (const r of HISTORIC_VLCL) {
    revisa(`VL ${r.curs} ${r.trimestre} trim.`, r.vl)
    revisa(`CL ${r.curs} ${r.trimestre} trim.`, r.cl)
  }
  return avisos
}

/** Ordena per curs, del més recent al més antic ("25/26" abans que "17/18"). */
export function ordenaPerCurs(files) {
  const any = (c) => {
    const n = Number(String(c).split('/')[0])
    return Number.isNaN(n) ? -1 : (n < 50 ? n + 2000 : n + 1900)
  }
  return [...files].sort((a, b) => any(b.curs) - any(a.curs))
}

/** "2026-27" → "26/27", que és com s'anomenen els cursos a l'històric. */
export function cursCurtDe(cursEscolarId) {
  const m = String(cursEscolarId ?? '').match(/^(\d{2})(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[3]}` : String(cursEscolarId ?? '')
}
