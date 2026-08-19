/**
 * Barems reals de Velocitat i Comprensió Lectora, extrets directament de
 * les fórmules del full "Avaluació lecto-escriptura VL/CL".
 */

import { cicleDe } from './rubricaTEE'

/** La VL/CL es fa a partir de Cicle Inicial: a Educació Infantil encara no
 *  es llegeix amb aquest sentit, i el full oficial no té barem per a I3-I5.
 *  Es reutilitza el mateix criteri que ja distingeix els cicles a TEE
 *  (`cicleDe`), perquè una classe és d'Infantil o no és d'Infantil
 *  independentment de qui ho pregunti. */
export function esClasseAmbLectura(curs) {
  return cicleDe(curs) !== 'EI'
}

// Velocitat Lectora: paraules/minut → nivell lector (equivalent de curs).
// El mateix barem serveix per als tres moments (Inicial, Mitjana, Final).
const LLINDARS_VL = [
  { min: 143, label: 'ESO2' },
  { min: 140, label: 'ESO1' },
  { min: 137, label: 'F6' },
  { min: 134, label: 'M6' },
  { min: 131, label: 'I6' },
  { min: 128, label: 'F5' },
  { min: 125, label: 'M5' },
  { min: 119, label: 'I5' },
  { min: 113, label: 'F4' },
  { min: 107, label: 'M4' },
  { min: 97, label: 'I4' },
  { min: 89, label: 'F3' },
  { min: 83, label: 'M3' },
  { min: 73, label: 'I3' },
  { min: 66, label: 'F2' },
  { min: 59, label: 'M2' },
  { min: 44, label: 'I2' },
  { min: 33, label: 'F1' },
  { min: 24, label: 'M1' },
  { min: 0, label: 'I1' },
]

export function nivellVL(paraulesMinut) {
  if (paraulesMinut === '' || paraulesMinut === null || paraulesMinut === undefined) return null
  const valor = Number(paraulesMinut)
  if (Number.isNaN(valor)) return null
  const trobat = LLINDARS_VL.find((l) => valor >= l.min)
  return trobat?.label ?? null
}

// Comprensió Lectora: nombre de respostes correctes → nivell. ELS LLINDARS
// CANVIEN SEGONS EL CURS (proves diferents, amb diferent nombre de
// preguntes) — verificat contra les llegendes reals de cada full de
// classe. 1r i 2n tenen escales curtes; de 3r a 6è comparteixen la
// mateixa escala (0-24 punts). El centre pot ajustar aquests llindars
// des del mòdul Lectura (es guarden a Firestore); aquests són els valors
// PER DEFECTE.
export const LLINDARS_CL_DEFECTE = {
  grau1: [12, 15, 18],
  grau2: [7, 10, 13],
  grau3a6: [13, 16, 19],
}

function grupLlindar(grau) {
  if (grau === 1) return 'grau1'
  if (grau === 2) return 'grau2'
  return 'grau3a6'
}

export function nivellCL(respostesCorrectes, curs, llindars = LLINDARS_CL_DEFECTE) {
  if (respostesCorrectes === '' || respostesCorrectes === null || respostesCorrectes === undefined) return null
  const valor = Number(respostesCorrectes)
  if (Number.isNaN(valor)) return null

  const grau = grauPrimaria(curs)
  const [llindarBaix, llindarMbaix, llindarMalt] = llindars[grupLlindar(grau)] ?? LLINDARS_CL_DEFECTE.grau3a6

  if (valor < llindarBaix) return 'BAIX'
  if (valor < llindarMbaix) return 'M.BAIX'
  if (valor < llindarMalt) return 'M.ALT'
  return 'ALT'
}

export const MOMENTS_LECTURA = [
  { id: 'inicial', label: 'Avaluació Inicial', teCL: true },
  { id: 'mitjana', label: 'Avaluació Mitjana', teCL: false },
  { id: 'final', label: 'Avaluació Final', teCL: true },
]

// Equivalència aproximada dels nivells de CL a l'escala comuna de 4 bandes,
// per poder-los comparar amb la nota general d'àrea (mòdul "Nota d'àrea").
const CL_A_ESCALA_COMUNA = {
  BAIX: 'no_assoliment',
  'M.BAIX': 'assoliment_satisfactori',
  'M.ALT': 'assoliment_notable',
  ALT: 'assoliment_excel·lent',
}

export function clAEscalaComuna(nivellClLabel) {
  return CL_A_ESCALA_COMUNA[nivellClLabel] ?? null
}

// --- VL a l'escala comuna de 4 bandes ---
//
// Trobat al full "Resum assoliment": es compara el nivell lector de
// l'alumne amb el SEU PROPI CURS, no amb un llindar fix. L'"escala" de
// nivells (I1,M1,F1,I2,...,F6,ESO1,ESO2) recorre les tres franges
// (Inicial/Mitjana/Final) de cada curs; l'alumne queda:
//   - per sota del seu curs (a la franja d'un curs inferior) → No Assoliment
//   - a la franja "Inicial" del seu propi curs → Assoliment Satisfactori
//   - a la franja "Mitjana" del seu propi curs → Assoliment Notable
//   - a la franja "Final" del seu propi curs, o per sobre → Assoliment Excel·lent
//
// A 1r no hi ha "curs inferior" possible, així que en comptes de comparar
// nivells, es fan servir llindars directes sobre les paraules/minut.
const ESCALA_NIVELL_LECTOR = [
  'I1', 'M1', 'F1', 'I2', 'M2', 'F2', 'I3', 'M3', 'F3',
  'I4', 'M4', 'F4', 'I5', 'M5', 'F5', 'I6', 'M6', 'F6', 'ESO1', 'ESO2',
]

/** Dedueix el número de curs de Primària (1-6) a partir del nom de la classe. */
export function grauPrimaria(curs) {
  const m = curs?.trim().match(/^([1-6])/)
  return m ? Number(m[1]) : null
}

export function vlAEscalaComuna(paraulesMinut, nivellLabel, curs) {
  const grau = grauPrimaria(curs)
  if (!grau) return null // Infantil: no aplica (sistema d'etapes d'escriptura a part)

  if (grau === 1) {
    const valor = Number(paraulesMinut)
    if (!Number.isFinite(valor)) return null
    if (valor < 12) return 'no_assoliment'
    if (valor < 15) return 'assoliment_satisfactori'
    if (valor < 19) return 'assoliment_notable'
    return 'assoliment_excel·lent'
  }

  if (!nivellLabel) return null
  const idxAlumne = ESCALA_NIVELL_LECTOR.indexOf(nivellLabel)
  if (idxAlumne === -1) return null // ESO1/ESO2 ja queden coberts com "per sobre" del propi curs

  const idxInicialPropi = ESCALA_NIVELL_LECTOR.indexOf(`I${grau}`)
  const idxMitjanaPropi = idxInicialPropi + 1
  const idxFinalPropi = idxInicialPropi + 2

  if (idxAlumne < idxInicialPropi) return 'no_assoliment'
  if (idxAlumne === idxInicialPropi) return 'assoliment_satisfactori'
  if (idxAlumne === idxMitjanaPropi) return 'assoliment_notable'
  return 'assoliment_excel·lent' // a la franja Final del propi curs, o per sobre
}
