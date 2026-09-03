// Lector dels fulls "ESFERA PI" i "ESFERA AD" del document de càrrega
// d'alumnat, per alimentar els indicadors automàtics del SIC (PI i NESE).
//
// D'on surten aquestes dades
// ---------------------------
// El document "LLISTAT ALUMNES CURS … Administrativa" que es descarrega
// d'ESFERA porta, a més del full principal ("ESFERA", que ja llegeix
// `Alumnes.jsx`), dos fulls resum ja agregats per alumne:
//
//   · "ESFERA PI"  — un Sí/No de si l'alumne té Pla Individualitzat,
//                     més el desglossament per àrea.
//   · "ESFERA AD"  — el motiu de NESE en text lliure, un indicador
//                     numèric de NESE, i tres columnes "TIPUS A/B/C NEE"
//                     amb el desglossament per tipus.
//
// Aquests dos fulls es llegeixen amb XLSX.utils.sheet_to_json(full,
// { header: 1, raw: false }), igual que fa `Alumnes.jsx` amb el full
// "ESFERA": el resultat és un array de files, cada fila un array de
// cel·les en l'ordre de columna (A, B, C…), 0-indexat.
//
// ⚠️ Una cosa que cal confirmar abans de fer-los servir per calcular
// els indicadors 1.2/1.3 del SIC: NO és cert que "té motiu de NESE
// escrit" i "té el flag NESE (columna F) a 1" siguin la mateixa cosa.
// Exemple real (curs 2026-27): l'alumna amb IDALU 20816733334 té el
// motiu "Situacions socioeconòmiques i/o socioculturals desafavorides"
// a la columna E, però el flag de la columna F hi surt a 0; en canvi
// "TIPUS B" hi surt a 1. Sembla, doncs, que el flag F respon a un
// criteri més estret que "hi ha algun motiu escrit" (potser exclou
// expressament el motiu socioeconòmic, que ja té el seu propi indicador
// 1.3 al SIC). Per això aquest lector exposa els dos valors per separat
// (`neseMotiu` i `neseFlag`) en lloc de triar-ne un — decidir quin fa
// servir cada indicador (1.2 "necessitats educatives especials" vs 1.3
// "situació socioeconòmica desfavorida") és un pas pendent, no una cosa
// que aquest lector hagi de donar per feta.

/** Treu només els dígits d'un IDALU i el torna com a string, o null si
 *  la cel·la no en porta cap (típicament la fila de capçalera). */
function idaluNet(cel) {
  const net = String(cel ?? '').replace(/[^\d]/g, '')
  return net && /^\d+$/.test(net) ? net : null
}

/** "Sí"/"No" (amb els espais i accents que calgui) → boolean. Qualsevol
 *  altra cosa (buit, "0", "1"…) es tracta com a booleà JS normal, per si
 *  algun full fa servir 0/1 en comptes de Sí/No en alguna columna. */
function siNoOBooleaABoolean(cel) {
  const net = String(cel ?? '').trim().toLowerCase()
  if (net === 'sí' || net === 'si') return true
  if (net === 'no' || net === '') return false
  return Boolean(Number(net))
}

// Columnes del full "ESFERA PI" (0-indexades: la A és buida i per tant
// no compta amb res).
//
// ⚠️ NO es fa servir per al flag general de PI (que ara es llegeix
// directament del full "ESFERA" principal, columna "Curriculum - Afectat
// per un Pl?" — vegeu Alumnes.jsx). Es manté aquí per si mai cal, però
// `llegeixResumPIPerArea()` (més avall) és la font fiable per al
// desglossament per àrea.
const PI_COL_IDALU = 1
const PI_COL_CURS = 4 // la "Curs" llegible (p. ex. "5è A"), no el codi
const PI_COL_PI = 5

/**
 * Llegeix el full "ESFERA PI" i torna un Map IDALU → { curs, pi }.
 *
 * `files` és el resultat de `XLSX.utils.sheet_to_json(full, { header: 1,
 * raw: false })` sobre el full "ESFERA PI".
 */
export function llegeixResumPI(files) {
  const mapa = new Map()
  for (const fila of files ?? []) {
    const idalu = idaluNet(fila?.[PI_COL_IDALU])
    if (!idalu) continue
    const curs = String(fila?.[PI_COL_CURS] ?? '').trim()
    if (!curs) continue
    mapa.set(idalu, { curs, pi: siNoOBooleaABoolean(fila?.[PI_COL_PI]) })
  }
  return mapa
}

// Columnes del full "ESFERA PI (1)" (0-indexades). A diferència
// d'"ESFERA PI", aquest full ve organitzat en blocs per classe (una fila
// de totals de classe, una fila "Identificador de l'alumne/a", i després
// una fila per alumne) però amb les ÀREES SEMPRE EN EL MATEIX ORDRE a
// totes les classes — a "ESFERA PI" cada full de classe font les porta
// en un ordre diferent, així que sumar-les tal qual barrejaria àrees.
// Per això aquest és el full fiable per al desglossament per àrea.
//
// Infantil (I3/I4/I5) té les seves pròpies àrees, a columnes diferents de
// les de Primària — un alumne d'Infantil només té valors reals al bloc
// de columnes d'Infantil, i les de Primària li queden buides (i a
// l'inrevés per Primària). L'"Anglès" es comparteix entre tots dos
// blocs, ja que és la mateixa àrea a efectes pràctics.
//
// ⚠️ El bloc "I3 B" concret d'aquest curs no porta IDALU a les seves
// files (buit al fitxer origen, no un error del lector): aquests ~22
// alumnes es queden sense desglossament per àrea fins que el centre ho
// arregli al full.
const PI_AREA_COL_IDALU = 0
const PI_AREA_COL_NOM = 1
// Un IDALU real en té 11 dígits; les files de totals de classe (p. ex.
// "1 A" a la columna A) també passen el filtre de "només dígits" un cop
// netejades ("1"), així que cal un mínim de llargada per descartar-les.
const PI_AREA_IDALU_LLARGADA_MINIMA = 8

const PI_AREES_COLS_PRIMARIA = [
  { id: 'efisica', col: 2 },
  { id: 'artistica', col: 3 },
  { id: 'matematiques', col: 4 },
  { id: 'castella', col: 5 },
  { id: 'catala', col: 6 },
  { id: 'angles', col: 7 },
  { id: 'religio', col: 8 },
  { id: 'medi', col: 9 },
  { id: 'valors', col: 10 },
]
const PI_AREES_COLS_INFANTIL = [
  { id: 'descobertaEntorn', col: 11 },
  { id: 'comunicacioLlenguatges', col: 12 },
  { id: 'angles', col: 13 }, // la mateixa "angles" que a Primària
  { id: 'descobertaMateix', col: 14 },
]

/** Totes les àrees de PI (Primària + Infantil, sense repetir "Anglès"),
 *  amb l'etiqueta per mostrar a la UI — per a filtres i columnes de
 *  taula. */
export const PI_AREES = [
  { id: 'efisica', label: 'Educació física' },
  { id: 'artistica', label: 'Educació artística' },
  { id: 'matematiques', label: 'Matemàtiques' },
  { id: 'castella', label: 'Llengua castellana' },
  { id: 'catala', label: 'Llengua catalana' },
  { id: 'angles', label: 'Anglès' },
  { id: 'religio', label: 'Religió' },
  { id: 'medi', label: 'Coneixement del medi' },
  { id: 'valors', label: 'Valors socials i cívics' },
  { id: 'descobertaEntorn', label: "Descoberta de l'entorn" },
  { id: 'comunicacioLlenguatges', label: 'Comunicació i llenguatges' },
  { id: 'descobertaMateix', label: "Descoberta d'un mateix i dels altres" },
]

/** "efisica" → "piEfisica", igual que es desa a Firestore des
 *  d'Alumnes.jsx — un sol lloc perquè qualsevol pantalla que necessiti
 *  saber si un alumne té PI en una àrea concreta (per exemple, per
 *  destacar-ho a la graella de notes) faci servir sempre el mateix nom
 *  de camp. */
export function campAreaPI(areaId) {
  return `pi${areaId.charAt(0).toUpperCase()}${areaId.slice(1)}`
}

/**
 * Llegeix el full "ESFERA PI (1)" i torna un Map IDALU → { arees }, amb
 * `arees` un objecte `{ efisica: bool, ..., descobertaEntorn: bool, ... }`
 * — un booleà per cada element de `PI_AREES`.
 *
 * `files` és el resultat de `XLSX.utils.sheet_to_json(full, { header: 1,
 * raw: false })` sobre el full "ESFERA PI (1)".
 */
export function llegeixResumPIPerArea(files) {
  const mapa = new Map()
  for (const fila of files ?? []) {
    const idalu = idaluNet(fila?.[PI_AREA_COL_IDALU])
    const nom = String(fila?.[PI_AREA_COL_NOM] ?? '').trim()
    // Descarta soles les files de totals de classe ("1 A", un IDALU curt
    // un cop netejat) i la fila "Identificador de l'alumne/a" (sense
    // IDALU vàlid).
    if (!idalu || idalu.length < PI_AREA_IDALU_LLARGADA_MINIMA || !nom) continue
    const arees = {}
    // Primer Primària, després Infantil amb OR: un alumne només té
    // valors reals en un dels dos blocs de columnes, l'altre li queda
    // buit — l'OR evita que el bloc buit trepitgi el valor real de
    // l'altre (rellevant sobretot per "angles", compartida entre tots
    // dos).
    for (const { id, col } of PI_AREES_COLS_PRIMARIA) {
      arees[id] = siNoOBooleaABoolean(fila?.[col])
    }
    for (const { id, col } of PI_AREES_COLS_INFANTIL) {
      arees[id] = Boolean(arees[id]) || siNoOBooleaABoolean(fila?.[col])
    }
    mapa.set(idalu, { arees })
  }
  return mapa
}
// Columnes del full "ESFERA AD" (0-indexades). Hi ha DUES columnes que es
// diuen totes dues "NESE" a la capçalera (una amb el motiu en text, l'altra
// amb el flag): cal llegir-les per posició, no pel nom.
const AD_COL_IDALU = 1
const AD_COL_CURS = 3
const AD_COL_NESE_MOTIU = 4
const AD_COL_NESE_FLAG = 5
const AD_COL_TIPUS_A_NEE = 6
const AD_COL_TIPUS_B = 7
const AD_COL_TIPUS_C = 8

// Columnes del full "EE ESFERA", d'un document A PART ("14b. Alumnes
// NESE. Curs actual…"), no del mateix llibre que ESFERA/ESFERA PI/AD.
// Porta el flag de SIEI que no hi ha enlloc més — i que calia distingir
// del "TIPUS A NEE" de l'ESFERA AD: un alumne amb reconeixement de
// necessitats especials pot ser-ho DINS del SIEI o FORA (el propi full
// ho diu literalment: "Tipus A (No SIEI)" com a criteri de detecció),
// i per la llegenda de colors calen els dos per separat.
const SIEI_COL_IDALU = 2 // "ident Alumne"
const SIEI_COL_SIEI = 8 // "SIEI"

/**
 * Llegeix el full "EE ESFERA" i torna un Map IDALU → { siei }.
 *
 * `files` és el resultat de `XLSX.utils.sheet_to_json(full, { header: 1,
 * raw: false })` sobre el full "EE ESFERA".
 */
export function llegeixResumSIEI(files) {
  const mapa = new Map()
  for (const fila of files ?? []) {
    const idalu = idaluNet(fila?.[SIEI_COL_IDALU])
    if (!idalu) continue
    mapa.set(idalu, { siei: siNoOBooleaABoolean(fila?.[SIEI_COL_SIEI]) })
  }
  return mapa
}

/**
 * Llegeix el full "EE ESFERA" i torna un Map IDALU → { ee: true } per a
 * TOTS els alumnes que hi surten llistats — el propi full es diu
 * literalment "ALUMNAT ATÈS A EE", així que sortir-hi ÉS el criteri: no
 * cal mirar cap columna concreta (el SIEI n'és un subconjunt, no un
 * alumne diferent).
 *
 * `files` és el resultat de `XLSX.utils.sheet_to_json(full, { header: 1,
 * raw: false })` sobre el full "EE ESFERA".
 */
export function llegeixResumEE(files) {
  const mapa = new Map()
  for (const fila of files ?? []) {
    const idalu = idaluNet(fila?.[SIEI_COL_IDALU])
    if (!idalu) continue
    mapa.set(idalu, { ee: true })
  }
  return mapa
}

/**
 * Llegeix el full "ESFERA AD" i torna un Map IDALU → { curs, neseMotiu,
 * neseFlag, tipusANee, tipusB, tipusC }.
 *
 * `files` és el resultat de `XLSX.utils.sheet_to_json(full, { header: 1,
 * raw: false })` sobre el full "ESFERA AD".
 */
export function llegeixResumAD(files) {
  const mapa = new Map()
  for (const fila of files ?? []) {
    const idalu = idaluNet(fila?.[AD_COL_IDALU])
    if (!idalu) continue
    const curs = String(fila?.[AD_COL_CURS] ?? '').trim()
    if (!curs) continue
    const neseMotiu = String(fila?.[AD_COL_NESE_MOTIU] ?? '').trim()
    mapa.set(idalu, {
      curs,
      neseMotiu,
      neseFlag: siNoOBooleaABoolean(fila?.[AD_COL_NESE_FLAG]),
      tipusANee: siNoOBooleaABoolean(fila?.[AD_COL_TIPUS_A_NEE]),
      tipusB: siNoOBooleaABoolean(fila?.[AD_COL_TIPUS_B]),
      tipusC: siNoOBooleaABoolean(fila?.[AD_COL_TIPUS_C]),
    })
  }
  return mapa
}
