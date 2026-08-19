/**
 * Rúbrica real d'Expressió Escrita de l'Escola Mestre Enric Gibert i Camins.
 *
 * La fórmula del "GLOBAL AUTOMÀTIC" s'ha extret directament de les
 * fórmules del full de càlcul (full "Còpia de 1A" i similars, que són
 * les versions no trencades — moltes de les pestanyes "en ús" tenien
 * referències creuades trencades entre classes, exactament el problema
 * que volem evitar amb aquesta app).
 *
 * Per cada criteri, amb el nivell triat (1=millor ... 3 o 4=pitjor):
 *   punts_criteri = (1 - nivell/4 + 0.25) * 10 * pes_criteri
 * GLOBAL AUTOMÀTIC = suma dels punts de tots els criteris (nota de 0 a 10)
 *
 * Aquesta part està verificada i és fiable. El pas de "nota 0-10" a
 * "nivell final AE/AN/AS/NA" NO el vam poder verificar (la fórmula
 * original de conversió anual també estava trencada al full real), així
 * que fem servir uns llindars naturals basats en la mateixa fórmula
 * (quan tots els criteris tenen el mateix nivell, la nota surt
 * exactament 10 / 7,5 / 5 / 2,5 — fem servir els punts mitjos entre
 * aquests valors com a llindars).
 */

export const CICLES = {
  EI: 'Educació Infantil (I5)',
  CI: 'Cicle Inicial (1r-2n)',
  CM: 'Cicle Mitjà (3r-4t)',
  CS: 'Cicle Superior (5è-6è)',
}

/** Dedueix el cicle a partir del nom de la classe (p. ex. "3r A" → CM). */
export function cicleDe(curs) {
  if (!curs) return 'CM'
  const primer = curs.trim()[0]
  if (primer === 'I') return 'EI'
  if (primer === '1' || primer === '2') return 'CI'
  if (primer === '3' || primer === '4') return 'CM'
  if (primer === '5' || primer === '6') return 'CS'
  return 'CM'
}

// Nivells per cicle (1=millor). Infantil fa servir noms propis i, igual
// que Cicle Inicial, només té 3 nivells (sense "No Assoliment").
export const NIVELLS_PER_CICLE = {
  EI: [
    { id: 'expert', label: 'Expert', punts: 1, color: 'var(--green)' },
    { id: 'avancat', label: 'Avançat', punts: 2, color: 'var(--navy)' },
    { id: 'aprenent', label: 'Aprenent', punts: 3, color: 'var(--amber-dark)' },
  ],
  CI: [
    { id: 'ae', label: 'AE', punts: 1, color: 'var(--green)' },
    { id: 'an', label: 'AN', punts: 2, color: 'var(--navy)' },
    { id: 'as', label: 'AS', punts: 3, color: 'var(--amber-dark)' },
  ],
  CM: [
    { id: 'ae', label: 'AE', punts: 1, color: 'var(--green)' },
    { id: 'an', label: 'AN', punts: 2, color: 'var(--navy)' },
    { id: 'as', label: 'AS', punts: 3, color: 'var(--amber-dark)' },
    { id: 'na', label: 'NA', punts: 4, color: 'var(--red)' },
    { id: 'na_zero', label: 'NA (0 pt)', punts: 5, color: 'var(--red)' },
  ],
  CS: [
    { id: 'ae', label: 'AE', punts: 1, color: 'var(--green)' },
    { id: 'an', label: 'AN', punts: 2, color: 'var(--navy)' },
    { id: 'as', label: 'AS', punts: 3, color: 'var(--amber-dark)' },
    { id: 'na', label: 'NA', punts: 4, color: 'var(--red)' },
    { id: 'na_zero', label: 'NA (0 pt)', punts: 5, color: 'var(--red)' },
  ],
}

// Pesos (%) de cada criteri, per cicle — verificats contra el full real
// (Infantil és diferent de la resta de cicles). Aquests són els valors
// PER DEFECTE; el centre els pot editar des del mòdul TEE, i llavors es
// guarden a Firestore (configuracio/pesosTEE) i tenen prioritat sobre
// aquests valors per defecte.
export const PESOS_PER_CICLE_DEFECTE = {
  EI: { coherencia: 0.10, lexic: 0.30, presentacio: 0.10, ortografia: 0.20, morfosintaxis: 0.30 },
  CI: { coherencia: 0.25, lexic: 0.20, presentacio: 0.10, ortografia: 0.20, morfosintaxis: 0.25 },
  CM: { coherencia: 0.25, lexic: 0.20, presentacio: 0.10, ortografia: 0.20, morfosintaxis: 0.25 },
  CS: { coherencia: 0.25, lexic: 0.20, presentacio: 0.10, ortografia: 0.20, morfosintaxis: 0.25 },
}

export const CRITERIS_TEE = [
  { id: 'coherencia', label: 'Coherència' },
  { id: 'lexic', label: 'Lèxic' },
  { id: 'presentacio', label: 'Presentació' },
  { id: 'ortografia', label: 'Ortografia' },
  { id: 'morfosintaxis', label: 'Morfosintaxi' },
]

/** Punts (0-10) d'un sol criteri, seguint la fórmula real del full de càlcul. */
function puntsCriteri(nivellPunts, pes) {
  return (1 - nivellPunts / 4 + 0.25) * 10 * pes
}

/**
 * Calcula la nota GLOBAL AUTOMÀTICA (0-10) sumant els punts ponderats
 * de cada criteri — la mateixa fórmula exacta del full de càlcul.
 * Si no es passen "pesos", fa servir els valors per defecte del cicle.
 */
export function calculaNotaAutomatica(cicle, criterisSeleccionats, pesos = PESOS_PER_CICLE_DEFECTE[cicle]) {
  const nivells = NIVELLS_PER_CICLE[cicle]
  let suma = 0
  let hiHaAlgun = false

  for (const c of CRITERIS_TEE) {
    const nivellId = criterisSeleccionats[c.id]
    if (!nivellId) continue
    const nivell = nivells.find((n) => n.id === nivellId)
    if (!nivell) continue
    suma += puntsCriteri(nivell.punts, pesos[c.id])
    hiHaAlgun = true
  }

  if (!hiHaAlgun) return null
  return Math.round(suma * 10) / 10
}

/** Tradueix la nota 0-10 al nivell qualitatiu del cicle corresponent,
 *  fent servir els punts mitjos naturals de la pròpia fórmula (10/7,5/5/2,5). */
export function nivellDeNota(cicle, nota) {
  if (nota === null || nota === undefined) return null
  const nivells = NIVELLS_PER_CICLE[cicle]
  if (nota >= 8.75) return nivells[0]
  if (nota >= 6.25) return nivells[1]
  if (nota >= 3.75) return nivells[2]
  return nivells[3] ?? nivells[nivells.length - 1]
}

/** Calcula directament el nivell automàtic (combina les dues funcions anteriors). */
export function calculaGlobalAutomatic(cicle, criterisSeleccionats, pesos) {
  const nota = calculaNotaAutomatica(cicle, criterisSeleccionats, pesos)
  if (nota === null) return null
  return nivellDeNota(cicle, nota)
}

// Tradueix qualsevol nivell d'un cicle a l'escala comuna de 4 bandes que fa
// servir la nota general d'àrea, perquè es puguin comparar entre si.
const EQUIVALENCIA_COMU = {
  expert: 'assoliment_excel·lent', ae: 'assoliment_excel·lent',
  avancat: 'assoliment_notable', an: 'assoliment_notable',
  aprenent: 'assoliment_satisfactori', as: 'assoliment_satisfactori',
  na: 'no_assoliment', na_zero: 'no_assoliment',
}

export function aEscalaComuna(nivellId) {
  return EQUIVALENCIA_COMU[nivellId] ?? null
}
