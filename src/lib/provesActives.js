// Quines classes passen cada prova, i en quin moment.
//
// El problema que resol
// ---------------------
// Qui passa cada prova no és fix i no es pot deixar escrit al codi:
//
//   · Ara la lectoescriptura només la fa I5, però I4 la pot començar a
//     fer en qualsevol moment.
//   · A 1r no passen les proves fins al tercer trimestre.
//   · Educació Infantil no fa TEE ni VL/CL ni notes per àrea.
//   · Un any concret una classe pot quedar-se sense fer-ne una, per una
//     baixa llarga o pel motiu que sigui.
//
// Sense poder-ho dir, la matriu del PGA marca en vermell coses que no
// s'han de fer, i el vermell deixa de voler dir res.
//
// Es desa per CURS ESCOLAR, perquè és exactament el que canvia d'un any
// a l'altre.
//
// Sobre el vocabulari dels moments
// --------------------------------
// Cada prova té el seu, i NO s'unifiquen perquè no són el mateix:
//
//   · TEE i notes per àrea → "1r/2n/3r trimestre" (qualificació trimestral)
//   · VL/CL               → "Avaluació Inicial/Mitjana/Final" (Eina d'avaluació)
//   · ConMat i COSMOS     → "Inici/Final de curs" (informes d'Innovamat)
//
// Dir-ne "trimestre" a tot faria que el VL/CL i l'Innovamat semblessin
// coses que no són. El que sí que es fa és ensenyar-los sempre amb la
// prova al davant ("TEE — 1r trimestre"), que és el que treu el dubte.
//
// ⚠️ El ConMat fa servir l'id `inici` i el COSMOS `inicial` per a la
// mateixa etiqueta "Inici de curs". És així a les dades ja desades i no
// es toca; el catàleg de sota respecta l'id de cadascun.

import { TRIMESTRES } from './notesArea'
import { MOMENTS_LECTURA } from './rubricaLectura'

/** El nivell d'una classe: "I3", "I4", "I5" o el número de primària. */
export function nivellDeClasse(curs) {
  const c = String(curs ?? '').trim().toUpperCase()
  if (c.startsWith('I')) return c.slice(0, 2)
  const n = Number(c[0])
  return Number.isFinite(n) && n >= 1 && n <= 6 ? String(n) : null
}

const INFANTIL = ['I3', 'I4', 'I5']
const PRIMARIA = ['1', '2', '3', '4', '5', '6']

/**
 * El catàleg de proves.
 *
 * `nivells` diu a quin alumnat s'adreça la prova **per definició** (el
 * COSMOS és de 1r i 2n i no ho serà mai d'una altra cosa). El que es
 * configura per curs és, dins d'aquests, quines classes concretes la
 * passen i en quins moments.
 */
export const PROVES = [
  {
    id: 'lectoescriptura',
    nom: 'Lectoescriptura EI',
    nivells: ['I4', 'I5'],
    // No té moments: es va marcant al llarg del curs.
    moments: [{ id: 'curs', label: 'Durant el curs' }],
  },
  {
    id: 'tee',
    nom: 'TEE (Text Escrit)',
    nivells: PRIMARIA,
    moments: TRIMESTRES.map((t, i) => ({ id: String(i + 1), label: t })),
  },
  {
    id: 'lectura',
    nom: 'Lectura — velocitat (VL)',
    nivells: PRIMARIA,
    moments: MOMENTS_LECTURA.map((m) => ({ id: m.id, label: m.label })),
  },
  {
    // La comprensió va a part de la velocitat perquè no sempre es fan
    // juntes: a 1r, segons com vagi de maduresa el grup, es pot fer la
    // VL al setembre i deixar la CL per al juny. Amb una sola prova per
    // a totes dues no hi havia manera de dir-ho, i o bé es marcava en
    // vermell una cosa que no tocava fer, o calia fer-la igualment.
    //
    // Només l'Avaluació Inicial i la Final: la Mitjana no té CL per
    // definició (vegeu MOMENTS_LECTURA), i oferir-la aquí faria pensar
    // que es pot activar.
    id: 'lecturaCl',
    nom: 'Lectura — comprensió (CL)',
    nivells: PRIMARIA,
    moments: MOMENTS_LECTURA.filter((m) => m.teCL).map((m) => ({ id: m.id, label: m.label })),
  },
  {
    id: 'notaArea',
    nom: 'Notes per àrea',
    nivells: PRIMARIA,
    moments: TRIMESTRES.map((t) => ({ id: t, label: t })),
  },
  {
    id: 'cosmos',
    nom: 'COSMOS (Innovamat)',
    nivells: ['1', '2'],
    moments: [
      { id: 'inicial', label: 'Inici de curs' },
      { id: 'final', label: 'Final de curs' },
    ],
  },
  {
    id: 'conmat',
    nom: 'ConMat (Innovamat)',
    nivells: ['3', '4', '5', '6'],
    // ⚠️ 'inici', no 'inicial': és l'id amb què el ConMat ja té les dades
    // desades. Vegeu la nota de dalt.
    moments: [
      { id: 'inici', label: 'Inici de curs' },
      { id: 'final', label: 'Final de curs' },
    ],
  },
]

export const provaPerId = (id) => PROVES.find((p) => p.id === id) ?? null

/** La clau amb què es desa una exclusió. */
export const clauExclusio = (provaId, momentId) => `${provaId}__${momentId}`

/**
 * Les classes a les quals s'adreça una prova, de totes les del centre.
 * És el filtre "per definició": el COSMOS no sortirà mai a 5è.
 */
export function classesDeLaProva(prova, totesLesClasses) {
  if (!prova) return []
  return (totesLesClasses ?? []).filter((c) => prova.nivells.includes(nivellDeClasse(c)))
}

/**
 * Les classes que passen una prova en un moment concret.
 *
 * Per defecte, **totes** les que li corresponen: una escola que no
 * configuri res ha de veure-ho tot, i la configuració només serveix per
 * treure'n. Així, si un any I4 comença a fer la lectoescriptura, surt
 * sense haver de tocar res.
 */
export function classesActives(config, provaId, momentId, totesLesClasses) {
  const prova = provaPerId(provaId)
  const candidates = classesDeLaProva(prova, totesLesClasses)
  const fora = new Set(config?.exclusions?.[clauExclusio(provaId, momentId)] ?? [])
  return candidates.filter((c) => !fora.has(c))
}

/** Si una classe passa una prova en un moment. */
export function passaLaProva(config, provaId, momentId, classe) {
  return classesActives(config, provaId, momentId, [classe]).length > 0
}

/**
 * Marca o desmarca una classe, i retorna la configuració nova.
 *
 * No modifica la que rep: així qui la crida pot comparar-les i saber si
 * hi ha hagut canvi abans de desar.
 */
export function ambClasse(config, provaId, momentId, classe, laPassa) {
  const clau = clauExclusio(provaId, momentId)
  const actuals = new Set(config?.exclusions?.[clau] ?? [])
  if (laPassa) actuals.delete(classe)
  else actuals.add(classe)

  const exclusions = { ...(config?.exclusions ?? {}) }
  // Una llista buida no es desa: així el document només conté el que
  // s'ha canviat de debò, i es veu d'un cop d'ull.
  if (actuals.size === 0) delete exclusions[clau]
  else exclusions[clau] = [...actuals].sort()

  return { ...(config ?? {}), exclusions }
}

/** El mateix, però per a totes les classes d'un moment alhora. */
export function ambTotesLesClasses(config, provaId, momentId, totesLesClasses, lesPassen) {
  const prova = provaPerId(provaId)
  const candidates = classesDeLaProva(prova, totesLesClasses)
  const exclusions = { ...(config?.exclusions ?? {}) }
  const clau = clauExclusio(provaId, momentId)
  if (lesPassen) delete exclusions[clau]
  else exclusions[clau] = [...candidates].sort()
  return { ...(config ?? {}), exclusions }
}

/**
 * Copia el que estigui marcat d'un moment a un altre de la mateixa prova.
 *
 * Serveix per al cas més freqüent: a 1r no passen les proves fins al
 * tercer trimestre, i marcar-ho moment per moment és repetitiu.
 */
export function copiaMoment(config, provaId, deMoment, aMoment) {
  const exclusions = { ...(config?.exclusions ?? {}) }
  const origen = exclusions[clauExclusio(provaId, deMoment)]
  const desti = clauExclusio(provaId, aMoment)
  if (!origen || origen.length === 0) delete exclusions[desti]
  else exclusions[desti] = [...origen]
  return { ...(config ?? {}), exclusions }
}

/**
 * Un resum del que s'ha configurat, per ensenyar-ho sense haver
 * d'obrir-ho tot: quantes classes queden fora, per prova.
 */
export function resumExclusions(config, totesLesClasses) {
  return PROVES.map((prova) => {
    const candidates = classesDeLaProva(prova, totesLesClasses)
    const fora = new Set()
    for (const moment of prova.moments) {
      for (const c of config?.exclusions?.[clauExclusio(prova.id, moment.id)] ?? []) fora.add(c)
    }
    return {
      prova,
      totalClasses: candidates.length,
      ambExclusions: [...fora].filter((c) => candidates.includes(c)).length,
    }
  })
}

/** Els nivells d'Infantil, per si cal mostrar-los a part. */
export const NIVELLS_INFANTIL = INFANTIL
