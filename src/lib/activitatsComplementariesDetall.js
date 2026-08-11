// Model de valoració de les activitats complementàries/sortides, fidel a
// les plantilles reals ("Valoració Sortides i Activitats EI/CI/CM/CS"):
// agrupades per cicle, cada activitat es valora amb 10 criteris puntuats
// de 0 a 10 (Poc satisfactori 0 — 10 Molt satisfactori), a més de si es
// repetiria o no i uns aspectes a considerar.

export const CRITERIS_ACTIVITAT = [
  { id: 'data', label: 'Data' },
  { id: 'horari', label: 'Horari' },
  { id: 'itinerari', label: 'Itinerari/activitats' },
  { id: 'organitzacio', label: 'Organització' },
  { id: 'professionals', label: 'Professionals' },
  { id: 'valorPedagogic', label: 'Valor pedagògic' },
  { id: 'coherencia', label: "Coherència amb la programació d'aula" },
  { id: 'autonomia', label: "Afavoreix l'autonomia i l'esperit crític?" },
  { id: 'coneixementEntorn', label: 'Afavoreix el coneixement i respecte per l\'entorn?' },
  { id: 'respostaExpectatives', label: 'Resposta a les expectatives' },
]

export function valoracionsBuides() {
  const v = {}
  for (const c of CRITERIS_ACTIVITAT) v[c.id] = ''
  return v
}

export function activitatBuida(nom = '') {
  return {
    id: crypto.randomUUID(),
    nom,
    nivell: '',
    data: '',
    horari: '',
    preu: '',
    participacio: '',
    contacte: '',
    telefon: '',
    email: '',
    acompanyants: '',
    objectius: '',
    organitzacioText: '',
    valoracions: valoracionsBuides(),
    repetir: '',
    aspectesConsiderar: '',
  }
}

/** Mitjana dels criteris ja puntuats d'una activitat (0-10) — ignora els
 *  que encara estan buits. Retorna null si cap encara té valor. */
export function mitjanaActivitat(activitat) {
  const valors = CRITERIS_ACTIVITAT
    .map((c) => activitat.valoracions?.[c.id])
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map(Number)
  if (valors.length === 0) return null
  return valors.reduce((a, b) => a + b, 0) / valors.length
}

/** "Grau de satisfacció" del cicle sencer: mitjana de totes les activitats
 *  que ja tenen alguna puntuació — igual que al full "Resum" original. */
export function grauSatisfaccioCicle(activitats) {
  const valors = activitats.map(mitjanaActivitat).filter((v) => v !== null)
  if (valors.length === 0) return null
  return (valors.reduce((a, b) => a + b, 0) / valors.length) * 10 // 0-10 -> 0-100%
}

/** % d'activitats que ja tenen alguna valoració introduïda. */
export function percentValorades(activitats) {
  if (activitats.length === 0) return 0
  const valorades = activitats.filter((a) => mitjanaActivitat(a) !== null).length
  return (valorades / activitats.length) * 100
}

/** Total d'activitats marcades "Sí" a "Tornaríeu a fer la sortida?". */
export function totalRepetirSi(activitats) {
  return activitats.filter((a) => a.repetir === 'Sí').length
}
