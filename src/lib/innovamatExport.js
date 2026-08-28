// Munta els fulls per exportar l'històric d'Innovamat a Excel i a PDF.
//
// Per què està a part dels components
// -----------------------------------
// Aquí només es decideix QUINES files surten i en quin ordre; qui les
// converteix en un .xlsx o en un PDF és `exportTaula.js`, que ja resol
// la capçalera del centre, les vores i l'ajust de columnes. Separant-ho,
// aquesta part es pot provar amb tests sense obrir cap navegador ni
// generar cap fitxer.
//
// Els percentatges es calculen amb les mateixes funcions que pinten les
// taules a la pantalla (`distribucioPerNivell`, `distribucioCosmos`), i
// no es tornen a calcular aquí: si algun dia canvia el criteri de qui
// compta com a avaluat, canvia en un sol lloc i l'exportació el segueix.

import {
  entradesHistoric, distribucioPerNivell, agrupaPerProva, momentLabel,
  entradesCosmos, distribucioCosmos, evolucioCosmos,
  NIVELLS_COSMOS, MOMENTS_COSMOS,
} from './historicInnovamat'
import { NIVELLS_CONMAT } from './conmatParser'

const NIVELLS_CM = NIVELLS_CONMAT.map((n) => n.label)

/** Formata un percentatge per a full de càlcul: número, no text, perquè
 *  s'hi puguin fer mitjanes i gràfics després. */
const pct = (v) => (v == null ? '' : Number(v))

/** El nivell de primària d'una classe: "3rA" → "3r". Les referències
 *  d'Innovamat es desen per nivell, no per classe. */
const nivellDe = (classe) => String(classe ?? '').replace(/[A-D]$/i, '')

/**
 * Full "ConMat — resum": una fila per curs, moment i classe, amb el
 * repartiment pels quatre nivells i el total.
 *
 * És la vista que es fa servir per comparar cursos entre si, i la que
 * s'assembla més al full de càlcul que el centre ja portava a mà.
 */
export function fullConmatResum(registres) {
  const capcalera = [
    'Curs', 'Moment', 'Classe',
    ...NIVELLS_CM, ...NIVELLS_CM.map((n) => `${n} %`),
    'Avaluats', 'Sense fer la prova', 'Total',
  ]
  const files = [capcalera]

  for (const grup of agrupaPerProva(entradesHistoric(registres))) {
    const classes = [...new Set(grup.entrades.map((e) => e.classe))].sort()
    for (const classe of classes) {
      const d = distribucioPerNivell(grup.entrades.filter((e) => e.classe === classe))
      files.push([
        grup.cursEscolar, momentLabel(grup.moment), classe ?? 'sense classe',
        ...NIVELLS_CM.map((n) => d.files.find((f) => f.nivell === n)?.alumnes ?? 0),
        ...NIVELLS_CM.map((n) => pct(d.files.find((f) => f.nivell === n)?.percentatge)),
        d.total, d.noAvaluats, d.totalGeneral,
      ])
    }
    // Una fila de total per prova, perquè el full es pugui llegir sense
    // haver de sumar les classes a mà.
    const dTot = distribucioPerNivell(grup.entrades)
    files.push([
      grup.cursEscolar, momentLabel(grup.moment), 'TOTAL',
      ...NIVELLS_CM.map((n) => dTot.files.find((f) => f.nivell === n)?.alumnes ?? 0),
      ...NIVELLS_CM.map((n) => pct(dTot.files.find((f) => f.nivell === n)?.percentatge)),
      dTot.total, dTot.noAvaluats, dTot.totalGeneral,
    ])
  }
  return { nom: 'ConMat — resum', files }
}

/**
 * Full "ConMat — comparativa": el centre al costat de les referències
 * d'Innovamat (Catalunya i total de centres), que es copien a mà.
 *
 * Les columnes de referència queden buides si encara no s'han introduït:
 * val més un buit visible que un zero que sembli una dada real.
 */
export function fullConmatComparativa(registres, refs = {}) {
  const files = [['Curs', 'Moment', 'Nivell', 'Franja', 'Centre %', 'Catalunya %', 'Total centres %']]

  for (const grup of agrupaPerProva(entradesHistoric(registres))) {
    const nivells = [...new Set(grup.entrades.map((e) => nivellDe(e.classe)))].filter(Boolean).sort()
    for (const nivell of nivells) {
      const d = distribucioPerNivell(grup.entrades.filter((e) => nivellDe(e.classe) === nivell))
      const cat = refs[`${grup.cursEscolar}__${grup.moment}__${nivell}__catalunya`]
      const tot = refs[`${grup.cursEscolar}__${grup.moment}__${nivell}__total`]
      for (const f of d.files) {
        files.push([
          grup.cursEscolar, momentLabel(grup.moment), nivell, f.nivell,
          pct(f.percentatge), pct(cat?.[f.nivell]), pct(tot?.[f.nivell]),
        ])
      }
    }
  }
  return { nom: 'ConMat — comparativa', files }
}

/** Full "ConMat — per alumne": el detall, per si cal repassar un cas
 *  concret o creuar-ho amb una altra font. */
export function fullConmatAlumnes(registres) {
  const files = [['Curs', 'Moment', 'Classe', 'Alumne', 'Nivell', 'Respostes', 'Preguntes', 'Observacions']]
  for (const e of entradesHistoric(registres)) {
    files.push([
      e.cursEscolar, momentLabel(e.moment), e.classe ?? '', e.nom ?? '',
      e.noAvaluat ? 'No avaluat' : (e.nivell ?? ''),
      e.respostes ?? '', e.preguntes ?? '',
      [
        e.noAvaluat ? 'no va fer la prova' : '',
        e.sensCasar ? "nom de l'informe (ja no consta al centre)" : '',
      ].filter(Boolean).join('; '),
    ])
  }
  return { nom: 'ConMat — per alumne', files }
}

/**
 * Full "COSMOS — resum": el repartiment pels tres nivells de rendiment,
 * per curs, moment i classe.
 *
 * Compte: el COSMOS té TRES nivells i el ConMat QUATRE, i els noms no
 * coincideixen ("Mitjà" contra "Mitjà-baix"/"Mitjà-alt"). Per això va en
 * un full a part i no s'apila sota el del ConMat.
 */
export function fullCosmosResum(registres) {
  const capcalera = [
    'Curs', 'Moment', 'Classe',
    ...NIVELLS_COSMOS, ...NIVELLS_COSMOS.map((n) => `${n} %`),
    'Avaluats', 'Sense fer la prova', 'Total',
  ]
  const files = [capcalera]
  const entrades = entradesCosmos(registres)
  const cursos = [...new Set(entrades.map((e) => e.cursEscolar))].sort().reverse()

  for (const curs of cursos) {
    const delCurs = entrades.filter((e) => e.cursEscolar === curs)
    for (const moment of MOMENTS_COSMOS) {
      const dCurs = distribucioCosmos(delCurs, moment.id)
      // Un moment sense cap resultat no aporta cap fila: si encara no
      // s'ha fet la prova final, no cal omplir el full de zeros.
      if (dCurs.total === 0) continue
      for (const classe of [...new Set(delCurs.map((e) => e.classe))].sort()) {
        const d = distribucioCosmos(delCurs.filter((e) => e.classe === classe), moment.id)
        files.push([
          curs, moment.label, classe ?? 'sense classe',
          ...NIVELLS_COSMOS.map((n) => d.files.find((f) => f.nivell === n)?.alumnes ?? 0),
          ...NIVELLS_COSMOS.map((n) => pct(d.files.find((f) => f.nivell === n)?.percentatge)),
          d.total, d.noAvaluats, d.totalGeneral,
        ])
      }
      files.push([
        curs, moment.label, 'TOTAL',
        ...NIVELLS_COSMOS.map((n) => dCurs.files.find((f) => f.nivell === n)?.alumnes ?? 0),
        ...NIVELLS_COSMOS.map((n) => pct(dCurs.files.find((f) => f.nivell === n)?.percentatge)),
        dCurs.total, dCurs.noAvaluats, dCurs.totalGeneral,
      ])
    }
  }
  return { nom: 'COSMOS — resum', files }
}

/** Full "COSMOS — evolució": quants alumnes canvien de nivell entre la
 *  prova inicial i la final. Aquesta lectura no té equivalent al ConMat,
 *  on les dues proves no es passen sempre al mateix alumnat. */
export function fullCosmosEvolucio(registres) {
  const files = [['Curs', 'Classe', 'Amb les dues proves', 'Milloren', 'Es mantenen', 'Baixen']]
  const entrades = entradesCosmos(registres)
  for (const curs of [...new Set(entrades.map((e) => e.cursEscolar))].sort().reverse()) {
    const delCurs = entrades.filter((e) => e.cursEscolar === curs)
    for (const classe of [...new Set(delCurs.map((e) => e.classe))].sort()) {
      const evo = evolucioCosmos(delCurs.filter((e) => e.classe === classe))
      files.push([curs, classe ?? 'sense classe', evo.ambTotesDues, evo.milloren, evo.mantenen, evo.baixen])
    }
    const evoCurs = evolucioCosmos(delCurs)
    files.push([curs, 'TOTAL', evoCurs.ambTotesDues, evoCurs.milloren, evoCurs.mantenen, evoCurs.baixen])
  }
  return { nom: 'COSMOS — evolució', files }
}

/** Full "COSMOS — per alumne": el detall dels dos moments. */
export function fullCosmosAlumnes(registres) {
  const files = [[
    'Curs', 'Classe', 'Alumne',
    'Rendiment inicial', 'Puntuació inicial', 'Rendiment final', 'Puntuació final',
    'Intervenció', 'Observacions',
  ]]
  for (const e of entradesCosmos(registres)) {
    files.push([
      e.cursEscolar, e.classe ?? '', e.nom ?? '',
      e.inicial ?? '', e.puntuacioInicial ?? '',
      e.final ?? '', e.puntuacioFinal ?? '',
      e.intervencio ?? '',
      [
        e.noAvaluat ? 'no va fer la prova final' : '',
        e.sensCasar ? 'nom del CSV (ja no consta al centre)' : '',
      ].filter(Boolean).join('; '),
    ])
  }
  return { nom: 'COSMOS — per alumne', files }
}

/**
 * El paquet sencer per passar a `exportaExcel` / `exportaPDF`.
 *
 * @param {object[]} registres - la col·lecció "matematiques" sencera
 * @param {object} refs - les referències d'Innovamat, indexades per
 *        `curs__moment__nivell__ambit` (tal com les munta l'Històric)
 * @param {{prova?: 'tot'|'conmat'|'cosmos', detall?: boolean}} opcions
 *        `prova` limita l'exportació a una de les dues; `detall` hi
 *        afegeix els fulls per alumne, que són llargs i no sempre calen.
 */
export function fullsInnovamat(registres, refs = {}, opcions = {}) {
  registres = registres ?? []
  const { prova = 'tot', detall = true } = opcions
  const fulls = []

  // Per ordre de nivell, igual que les pestanyes de l'Històric: el COSMOS
  // és de 1r i 2n, el ConMat de 3r a 6è.
  if (prova !== 'conmat' && entradesCosmos(registres).length > 0) {
    fulls.push(fullCosmosResum(registres))
    fulls.push(fullCosmosEvolucio(registres))
    if (detall) fulls.push(fullCosmosAlumnes(registres))
  }
  if (prova !== 'cosmos' && entradesHistoric(registres).length > 0) {
    fulls.push(fullConmatResum(registres))
    fulls.push(fullConmatComparativa(registres, refs))
    if (detall) fulls.push(fullConmatAlumnes(registres))
  }
  // Un full amb només la capçalera no diu res: es descarta abans
  // d'arribar a l'exportador, que si no generaria pestanyes buides.
  return fulls.filter((f) => f.files.length > 1)
}

/**
 * Full per al "Resum" d'un sol curs i moment — el que es veu a les
 * pestanyes "Resum ConMat" i "Resum COSMOS".
 *
 * Es construeix a partir de les entrades JA filtrades pel component, no
 * de tots els registres: així el fitxer que es baixa conté exactament el
 * que hi ha a la pantalla. Si es calculés aquí un altre cop, un canvi al
 * filtre de la pantalla i un altre aquí es podrien desincronitzar sense
 * que ningú se n'adonés.
 */
export function fullResumCurs(entrades, { prova, nivells, distribucio, moment, curs }) {
  const files = [['Classe', ...nivells, ...nivells.map((n) => `${n} %`), 'Avaluats', 'Sense fer la prova', 'Total']]
  const classes = [...new Set(entrades.map((e) => e.classe).filter(Boolean))].sort()

  const fila = (etiqueta, d) => [
    etiqueta,
    ...nivells.map((n) => d.files.find((f) => f.nivell === n)?.alumnes ?? 0),
    ...nivells.map((n) => pct(d.files.find((f) => f.nivell === n)?.percentatge)),
    d.total, d.noAvaluats, d.totalGeneral,
  ]

  for (const classe of classes) {
    files.push(fila(classe, distribucio(entrades.filter((e) => e.classe === classe))))
  }
  files.push(fila(`${prova} — TOTAL`, distribucio(entrades)))

  return { nom: `${prova} ${curs} · ${moment}`.slice(0, 31), files }
}

/** El nom del fitxer, amb el curs si només n'hi ha un. Sense el curs, un
 *  "innovamat.xlsx" a la carpeta de baixades no diu de què és. */
export function nomFitxerInnovamat(registres, prova = 'tot', extensio = 'xlsx') {
  registres = registres ?? []
  const cursos = [...new Set([
    ...entradesHistoric(registres).map((e) => e.cursEscolar),
    ...entradesCosmos(registres).map((e) => e.cursEscolar),
  ])].sort()
  const etiquetaProva = prova === 'conmat' ? 'conmat' : prova === 'cosmos' ? 'cosmos' : 'innovamat'
  const tros = cursos.length === 0 ? ''
    : cursos.length === 1 ? `-${cursos[0]}`
      : `-${cursos[0]}_a_${cursos[cursos.length - 1]}`
  return `${etiquetaProva}${tros}.${extensio}`
}
