// Valoracions de cicle/comissió/equip, fidels a l'estructura real dels
// fulls de càlcul "Valoració ..." del centre: Responsable, Membres, una
// llista d'Objectius (cada un amb Gener/Juny en %), i opcionalment — pels
// que ho necessitin (comissions/equips) — una llista d'"Actuacions" amb el
// seu propi indicador i percentatges, dins de cada objectiu.

export function actuacioBuida() {
  // Les actuacions de comissions i equips fan servir l'escala dels seus
  // fulls, on "En procés" val 50% (als fulls del PGAC en val 40).
  //
  // "dades" només s'omple als objectius de recollida (per exemple
  // "Enregistrar les dades del SIC"), on el full té columnes de text lliure
  // per a tres moments del curs. No entra mai al càlcul: el percentatge
  // segueix sortint del Fet/No fet, igual que al full original.
  return {
    id: crypto.randomUUID(),
    text: '', indicador: '', gener: '', juny: '',
    escala: 'execucio50', opcions: null,
    dades: { inici: '', gener: '', juny: '' },
  }
}

/** Els tres moments en què es recullen dades, tal com surten als fulls. */
export const MOMENTS_DADES = [
  { id: 'inici', label: 'Inici de curs' },
  { id: 'gener', label: 'Gener' },
  { id: 'juny', label: 'Juny' },
]

export function objectiuBuit() {
  // Els fulls de cicle no tenen estats: s'hi escriu el percentatge directament.
  return {
    id: crypto.randomUUID(), text: '', gener: '', juny: '',
    escala: 'lliure', opcions: null,
    recullDades: false,
    etiquetesDades: { inici: 'Inici de curs', gener: 'Gener', juny: 'Juny' },
    actuacions: [],
  }
}

export function valoracioBuida() {
  return {
    responsable: '',
    membres: '',
    objectius: [objectiuBuit()],
    valoracioRevisio: '',
    valoracioFinal: '',
    metodologies: '',
    propostesMillora: '',
  }
}

// Alguns noms habituals, com a suggeriment ràpid — el camp és de text
// lliure, no un desplegable tancat, perquè cada curs poden variar.
export const CICLES = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior']

export const NOMS_SUGGERITS = [
  'Comissió TAC', 'Comissió Material', 'Comissió Anglès', 'Comissió Biblioteca',
  'Comissió Espais',
  "Equip d'Atenció a la Diversitat", 'Coordinació de Riscos Laborals', 'Equip LIC',
  // L'Equip Directiu no és una comissió, però el seu full té la mateixa
  // estructura (Resum + un full per objectiu), així que va aquí mateix.
  'Equip Directiu',
]

// Comissions mixtes (amb participació de famílies/AFA) — es mostren en un
// botó a part dins de Valoracions, en comptes de barrejar-se amb la resta.
// L'AREP hi va perquè és un projecte amb una entitat de fora de l'escola,
// com les altres tres tenen participació de famílies o de l'AFA.
//
// Això és només el punt de partida: des del Quadre de comandament se'n
// poden activar, desactivar, afegir i treure per a cada curs escolar.
export const NOMS_AFA = [
  'Comissió Comunicació', 'Comissió Espai de migdia',
  'Comissió de Transformem els Patis', 'Jardins. AREP',
]

/**
 * Resultat d'un objectiu, tal com el calculen els fulls originals:
 * `=AVERAGE(...)` de les seves actuacions. Ull amb un detall que canvia molt
 * el número: als fulls, les actuacions vénen pre-omplertes amb "No fet", o
 * sigui que **les que no s'han valorat compten 0**, no s'ignoren. Si
 * s'ignoressin, una comissió amb un sol objectiu fet donaria 100% quan el
 * full real dona 10%.
 */
export function mitjanaObjectiu(objectiu, camp) {
  const actuacions = objectiu.actuacions ?? []
  if (actuacions.length > 0) {
    const suma = actuacions.reduce((total, a) => total + valorNumeric(a[camp]), 0)
    return suma / actuacions.length
  }
  if (objectiu[camp] === '' || objectiu[camp] === null || objectiu[camp] === undefined) return 0
  return Number(objectiu[camp])
}

/** Resultat de la valoració sencera: `=average(...)` de tots els objectius,
 *  comptant també els que encara no s'han valorat. */
export function mitjanaValoracio(valoracio, camp) {
  const objectius = valoracio.objectius ?? []
  if (objectius.length === 0) return null
  const suma = objectius.reduce((total, o) => total + (mitjanaObjectiu(o, camp) ?? 0), 0)
  return suma / objectius.length
}

function valorNumeric(v) {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

function esBuit(v) {
  return v === '' || v === null || v === undefined
}

/** Quantes caselles queden per valorar dins d'un objectiu, per poder-ho dir
 *  al costat del resultat: un 10% a l'octubre no és un mal resultat, és que
 *  encara no toca. */
export function pendentsObjectiu(objectiu, camp) {
  const actuacions = objectiu.actuacions ?? []
  if (actuacions.length > 0) {
    return { total: actuacions.length, valorats: actuacions.filter((a) => !esBuit(a[camp])).length }
  }
  return { total: 1, valorats: esBuit(objectiu[camp]) ? 0 : 1 }
}

/** El mateix, per a tota la valoració. */
export function pendentsValoracio(valoracio, camp) {
  return (valoracio.objectius ?? []).reduce((acc, o) => {
    const p = pendentsObjectiu(o, camp)
    return { total: acc.total + p.total, valorats: acc.valorats + p.valorats }
  }, { total: 0, valorats: 0 })
}

// Festes del curs (es mantenen com a valoració simple i separada).
export const FESTES = [
  { id: 'castanyada', label: 'Castanyada' },
  { id: 'nadal', label: 'Nadal' },
  { id: 'carnestoltes', label: 'Carnestoltes' },
  { id: 'mona', label: 'Mona' },
  { id: 'santjordi', label: 'Sant Jordi' },
  { id: 'gimcana', label: 'Gimcana i comiat' },
]

export function festesBuides() {
  const festes = {}
  for (const f of FESTES) festes[f.id] = ''
  return festes
}

// --- Què està actiu cada curs ----------------------------------------------
// La configuració es desa a Firestore (`valoracionsConfig`, un document per
// curs), però decidir què surt i què no és lògica pura i viu aquí, perquè
// es pugui comprovar des del mòdul "Comprovacions".

export function llistaActivaPerDefecte(noms) {
  return noms.map((nom) => ({ nom, activa: true }))
}

/**
 * Deixa la configuració d'un curs sempre amb la mateixa forma, vingui d'on
 * vingui: d'un document desat, d'un de desat abans que les comissions
 * mixtes es poguessin activar, o de no res encara.
 */
export function normalitzaConfigValoracions(dades) {
  const d = dades ?? {}
  return {
    comissions: d.comissions ?? llistaActivaPerDefecte(NOMS_SUGGERITS),
    // Els documents desats abans d'aquest canvi no porten el camp: llavors
    // surten totes actives, que és exactament com anava fins ara.
    mixtes: d.mixtes ?? llistaActivaPerDefecte(NOMS_AFA),
    festes: (d.festes ?? FESTES.map((f) => ({ id: f.id, activa: true })))
      .map((f) => ({ ...f, label: f.label ?? FESTES.find((x) => x.id === f.id)?.label ?? f.id })),
  }
}

/** Els noms que ha de veure el professorat en una d'aquestes llistes. */
export function nomsActius(llista) {
  return (llista ?? []).filter((c) => c.activa !== false).map((c) => c.nom)
}

/** Afegeix un nom sense repetir-lo (ni canviant-hi les majúscules). */
export function afegeixALlista(llista, nomNou) {
  const nom = (nomNou ?? '').trim()
  if (!nom) return llista
  if (llista.some((c) => c.nom.toLowerCase() === nom.toLowerCase())) return llista
  return [...llista, { nom, activa: true }]
}

/**
 * Suggeriments de la pestanya "Comissions i equips": el que hi ha actiu més
 * el que ja s'ha desat aquest curs, però mai els cicles ni les comissions
 * mixtes — que tenen pestanya pròpia. S'exclouen totes les mixtes, també
 * les desactivades: una mixta apagada no ha de reaparèixer com a comissió
 * normal per la porta del darrere.
 */
export function suggerimentsComissions(config, nomsExistents = []) {
  const mixtes = (config?.mixtes ?? llistaActivaPerDefecte(NOMS_AFA)).map((c) => c.nom)
  const base = config ? nomsActius(config.comissions) : NOMS_SUGGERITS
  return [...new Set([...base, ...nomsExistents])]
    .filter((n) => !CICLES.includes(n) && !mixtes.includes(n))
}

// --- Com s'ordena la llista del Quadre de comandament ----------------------

export const SECCIONS_VALORACIONS = ['Cicles', 'Comissions i equips', 'Comissions mixtes']

const iguals = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/** A quina secció va una valoració, pel seu nom. Igual que a la resta de
 *  l'app: cicle si el nom és un dels quatre, mixta si és a la llista de
 *  mixtes d'aquest curs, i si no, comissió o equip. */
export function seccioDe(nom, config) {
  if (CICLES.some((c) => iguals(c, nom))) return 'Cicles'
  const mixtes = (config?.mixtes ?? llistaActivaPerDefecte(NOMS_AFA)).map((c) => c.nom)
  if (mixtes.some((m) => iguals(m, nom))) return 'Comissions mixtes'
  return 'Comissions i equips'
}

/**
 * Reparteix les valoracions per secció, per no ensenyar-les totes seguides
 * en una llista sola. Els cicles surten en l'ordre de sempre (Infantil,
 * Inicial, Mitjà, Superior) i la resta per ordre alfabètic. Les seccions
 * buides no es dibuixen.
 */
export function agrupaValoracions(valoracions, config) {
  const per = {}
  for (const titol of SECCIONS_VALORACIONS) per[titol] = []
  for (const v of valoracions ?? []) per[seccioDe(v.nom, config)].push(v)

  const ordreCicle = (nom) => {
    const i = CICLES.findIndex((c) => iguals(c, nom))
    return i === -1 ? CICLES.length : i
  }
  per.Cicles.sort((a, b) => ordreCicle(a.nom) - ordreCicle(b.nom))
  for (const titol of ['Comissions i equips', 'Comissions mixtes']) {
    per[titol].sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'ca'))
  }

  return SECCIONS_VALORACIONS
    .map((titol) => ({ titol, valoracions: per[titol] }))
    .filter((s) => s.valoracions.length > 0)
}

// --- Noms que són el mateix escrits diferent -------------------------------
// Els fulls del Drive i la llista de suggeriments no diuen les coses igual:
// "Comissió Anglès" al panell i "Comissió d'anglès" al full. Com que el nom
// és l'identificador de la valoració, cada variant en creava una de nova i
// sortien duplicades.

const PARAULES_BUIDES = ['de', 'del', 'dels', 'd', 'la', 'el', 'els', 'les', 'l', 'i', 'a']

/** Deixa un nom en la seva forma comparable: sense accents, sense
 *  apòstrofs, sense signes i sense articles ni preposicions. */
export function nomCanonic(nom) {
  return (nom ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PARAULES_BUIDES.includes(p))
    .join(' ')
}

export function mateixNom(a, b) {
  const na = nomCanonic(a)
  return na !== '' && na === nomCanonic(b)
}

/** Si aquest nom ja existeix amb una altra manera d'escriure'l, retorna el
 *  que ja hi ha. Serveix per reaprofitar la valoració en comptes de
 *  duplicar-la. */
export function nomJaExistent(nom, nomsExistents = []) {
  return nomsExistents.find((n) => mateixNom(n, nom)) ?? null
}
