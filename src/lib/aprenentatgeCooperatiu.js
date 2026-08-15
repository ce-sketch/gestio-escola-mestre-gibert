// Valoració de l'aprenentatge cooperatiu.
//
// Transcrit del full "APRENENTATGE COOPERATIU" de l'Eina d'avaluació PGAC.
// A diferència de la resta de valoracions, aquesta no va per cicle sinó
// **per nivell**: cada nivell (I-3, I-4, I-5, 1r… 6è) valora els tres
// objectius, i el resultat del cicle surt dels seus nivells.
//
//   objectiu = mitjana de les seves actuacions          (si en té)
//   nivell   = Σ (objectiu% × pes de l'objectiu)      30% / 30% / 40%
//   cicle    = mitjana dels seus nivells
//   global   = Σ (cicle × pes del cicle)              25% cadascun
//
// Dins de cada nivell, cada objectiu pot tenir **actuacions** concretes,
// com les comissions: al document original no són les mateixes a tots els
// nivells (a P-3 l'objectiu 3 en té una i a P-5 en té quatre) i cadascuna
// porta la seva escala. El percentatge de l'objectiu surt de la mitjana de
// les seves actuacions.
//
// Si un objectiu no té actuacions, s'hi escriu el percentatge directament,
// com abans. Així qui no vulgui tant detall pot seguir treballant igual.

/** Els tres objectius, amb el pes que tenen al full original. */
export const OBJECTIUS_COOPERATIU = [
  {
    id: 'linia',
    pes: 30,
    text: "Seguir la línia d'escola per aplicar la metodologia d'aprenentatge cooperatiu.",
  },
  {
    id: 'metodologia',
    pes: 30,
    text: "Aplicar la metodologia d'aprenentatge cooperatiu.",
  },
  {
    id: 'projectes',
    pes: 40,
    text: 'Realitzar els projectes de classe amb metodologia cooperativa.',
  },
]

/** Cicles i els nivells que els formen, amb el pes de cada cicle. */
export const CICLES_COOPERATIU = [
  { id: 'ei', nom: 'Educació Infantil', pes: 25, nivells: ['I-3', 'I-4', 'I-5'] },
  { id: 'ci', nom: 'Cicle Inicial', pes: 25, nivells: ['1r', '2n'] },
  { id: 'cm', nom: 'Cicle Mitjà', pes: 25, nivells: ['3r', '4t'] },
  { id: 'cs', nom: 'Cicle Superior', pes: 25, nivells: ['5è', '6è'] },
]

export const TOTS_ELS_NIVELLS = CICLES_COOPERATIU.flatMap((c) => c.nivells)

/** El nom sencer de cada nivell, tal com encapçala el full del centre. */
export const NOM_LLARG = {
  'I-3': 'Educació Infantil. Nivell I-3',
  'I-4': 'Educació Infantil. Nivell I-4',
  'I-5': 'Educació Infantil. Nivell I-5',
  '1r': 'Educació Primària. Nivell 1r',
  '2n': 'Educació Primària. Nivell 2n',
  '3r': 'Educació Primària. Nivell 3r',
  '4t': 'Educació Primària. Nivell 4t',
  '5è': 'Educació Primària. Nivell 5è',
  '6è': 'Educació Primària. Nivell 6è',
}

/** Estructura buida: un valor per nivell, objectiu i moment. */
export function cooperatiuBuit() {
  const valors = {}
  for (const nivell of TOTS_ELS_NIVELLS) {
    valors[nivell] = {}
    for (const o of OBJECTIUS_COOPERATIU) {
      valors[nivell][o.id] = { gener: '', juny: '', actuacions: [] }
    }
  }
  return {
    objectius: OBJECTIUS_COOPERATIU.map((o) => ({ ...o })),
    cicles: CICLES_COOPERATIU.map((c) => ({ ...c })),
    valors,
    observacions: '',
  }
}

/** Posa al dia una estructura desada: hi afegeix els nivells o objectius
 *  que hi faltin, sense tocar el que ja hi ha. */
export function normalitzaCooperatiu(dades) {
  const base = cooperatiuBuit()
  if (!dades) return base
  const valors = { ...base.valors }
  for (const nivell of TOTS_ELS_NIVELLS) {
    valors[nivell] = { ...base.valors[nivell] }
    for (const o of OBJECTIUS_COOPERATIU) {
      const desat = dades.valors?.[nivell]?.[o.id]
      if (desat) valors[nivell][o.id] = { gener: '', juny: '', actuacions: [], ...desat }
    }
  }
  return {
    objectius: dades.objectius?.length ? dades.objectius : base.objectius,
    cicles: dades.cicles?.length ? dades.cicles : base.cicles,
    valors,
    observacions: dades.observacions ?? '',
  }
}

const num = (v) => {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

const esBuit = (v) => v === '' || v === null || v === undefined

/**
 * Grau d'un objectiu dins d'un nivell.
 *
 * Si té actuacions, és la mitjana de totes (les que no s'han valorat
 * compten 0, com a la resta de l'app i com als fulls del centre). Si no en
 * té, és el percentatge que s'hi ha escrit directament.
 */
export function grauObjectiuNivell(dades, nivell, objectiuId, camp) {
  const dada = dades.valors?.[nivell]?.[objectiuId]
  if (!dada) return 0
  const actuacions = dada.actuacions ?? []
  if (actuacions.length > 0) {
    return actuacions.reduce((t, a) => t + num(a[camp]), 0) / actuacions.length
  }
  return num(dada[camp])
}

/**
 * Grau d'assoliment d'un nivell: la suma dels seus objectius, cadascun pel
 * seu pes. Com a la resta de l'app, el que no s'ha valorat compta 0.
 */
export function grauNivell(dades, nivell, camp) {
  if (!dades.valors?.[nivell]) return 0
  return dades.objectius.reduce(
    (total, o) => total + grauObjectiuNivell(dades, nivell, o.id, camp) * (num(o.pes) / 100),
    0
  )
}

/** Grau d'un cicle: la mitjana dels seus nivells. */
export function grauCicle(dades, cicleId, camp) {
  const cicle = dades.cicles.find((c) => c.id === cicleId)
  if (!cicle || cicle.nivells.length === 0) return 0
  const suma = cicle.nivells.reduce((t, n) => t + grauNivell(dades, n, camp), 0)
  return suma / cicle.nivells.length
}

/** Grau global: la suma dels cicles, cadascun pel seu pes. */
export function grauGlobal(dades, camp) {
  return dades.cicles.reduce(
    (total, c) => total + grauCicle(dades, c.id, camp) * (num(c.pes) / 100),
    0
  )
}

/**
 * Grau global d'UN objectiu concret, com la fila "Objectiu N" de la part de
 * dalt del full: mitjana entre els nivells de cada cicle, i després els
 * cicles pel seu pes.
 */
export function grauObjectiu(dades, objectiuId, camp) {
  return dades.cicles.reduce((total, c) => {
    if (c.nivells.length === 0) return total
    const mitjana = c.nivells.reduce(
      (t, n) => t + grauObjectiuNivell(dades, n, objectiuId, camp), 0
    ) / c.nivells.length
    return total + mitjana * (num(c.pes) / 100)
  }, 0)
}

/** Quantes caselles queden per omplir, per poder-ho dir al costat del
 *  resultat: un 20% al novembre no és un mal resultat. */
export function pendentsCooperatiu(dades, camp) {
  let total = 0
  let valorats = 0
  for (const nivell of TOTS_ELS_NIVELLS) {
    for (const o of dades.objectius) {
      const dada = dades.valors?.[nivell]?.[o.id]
      const actuacions = dada?.actuacions ?? []
      if (actuacions.length > 0) {
        total += actuacions.length
        valorats += actuacions.filter((a) => !esBuit(a[camp])).length
      } else {
        total++
        if (!esBuit(dada?.[camp])) valorats++
      }
    }
  }
  return { total, valorats }
}

/** Una actuació buida, per afegir-ne a mà. */
export function actuacioCooperativaBuida() {
  return { id: crypto.randomUUID(), text: '', gener: '', juny: '', escala: 'execucio50', opcions: null }
}
