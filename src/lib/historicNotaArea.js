// L'històric de les notes per àrea: quants alumnes de cada classe hi ha a
// cada franja d'assoliment, curs escolar rere curs escolar.
//
// D'on surten les dades
// ---------------------
// De dues fonts, i el mòdul les tracta igual un cop convertides a la
// mateixa forma:
//
//   · **Calculades** — dels registres de "Notes per àrea" que ja hi ha a
//     Firestore. És el cas dels cursos que s'han portat amb l'app, i el
//     que fa que l'històric s'ampliï SOL cada any: no cal fer res.
//   · **Importades** — dels fulls "Resum" dels Google Sheets d'abans de
//     l'app (22-23, 23-24…). Es pugen una vegada i queden desades.
//
// Quan un curs té les dues, mana la calculada: ve de les notes originals
// i no d'un resum ja agregat.

import { AREES, TRIMESTRES } from './notesArea'
import { redueixVigents, nivellDe } from './avaluacioCatala'

/** Les quatre franges, en l'ordre en què surten a tots els documents del
 *  centre (de menys a més). */
export const FRANGES = [
  { id: 'na', label: 'No Assoliment' },
  { id: 'as', label: 'Assoliment Satisfactòri' },
  { id: 'an', label: 'Assoliment Notable' },
  { id: 'ae', label: 'Assoliment Excel·lent' },
]

/** Les àrees que es resumeixen. Les calculades (Medi global, Artística)
 *  en queden fora: no són una àrea que es qualifiqui, sinó la mitjana de
 *  dues que ja hi surten. */
export const AREES_HISTORIC = AREES.filter((a) => !a.calculada)

const idFranja = (nivellId) => {
  const t = String(nivellId ?? '').toLowerCase()
  if (t.includes('excel')) return 'ae'
  if (t.includes('notable')) return 'an'
  if (t.includes('satisfact')) return 'as'
  if (t.includes('no_assoliment') || t === 'na') return 'na'
  return null
}

const filaBuida = () => ({ na: 0, as: 0, an: 0, ae: 0, total: 0 })

/**
 * Calcula el resum d'un curs escolar a partir dels registres de notes.
 *
 * @param {Array} registres - documents de "avaluacio" amb tipus nota_area
 * @param {string} cursEscolar
 * @returns {Array<{trimestre, area, classe, na, as, an, ae, total}>}
 */
export function resumDesDeRegistres(registres, cursEscolar) {
  const delCurs = (registres ?? []).filter(
    (r) => r.tipus === 'nota_area' && (r.cursEscolar ?? cursEscolar) === cursEscolar)

  // Una nota per alumne, àrea i trimestre: cada correcció afegeix una
  // fila nova a la col·lecció i només val la darrera.
  const vigents = redueixVigents(delCurs, (r) => `${r.alumneId}__${r.area}__${r.trimestre}`)

  const acumulat = new Map()
  for (const r of vigents) {
    // Els registres desen la nota NUMÈRICA; la franja qualitativa surt de
    // `nivellDe()`, els llindars de la qual són configurables al centre.
    // Si algun registre ja portés el nivell fet (formats antics), es
    // respecta.
    const nivell = r.nota !== null && r.nota !== undefined
      ? nivellDe(Number(r.nota))?.id
      : (r.nivell ?? null)
    const franja = idFranja(nivell)
    if (!franja || !r.curs || !r.area || !r.trimestre) continue
    const clau = `${r.trimestre}__${r.area}__${r.curs}`
    if (!acumulat.has(clau)) acumulat.set(clau, filaBuida())
    const fila = acumulat.get(clau)
    fila[franja] += 1
    fila.total += 1
  }

  return [...acumulat.entries()].map(([clau, fila]) => {
    const [trimestre, area, classe] = clau.split('__')
    return { trimestre, area, classe, ...fila }
  })
}

/**
 * Ajunta el que hi ha desat (cursos importats) amb el que es calcula dels
 * registres, i ho ordena.
 *
 * Un curs que tingui les dues fonts es queda amb la calculada: ve de les
 * notes una per una i no d'un resum que algú ja havia agregat.
 */
export function fusionaHistoric(documentsDesats, calculatsPerCurs) {
  const perCurs = new Map()

  for (const doc of documentsDesats ?? []) {
    if (!doc.cursEscolar || !Array.isArray(doc.files)) continue
    perCurs.set(doc.cursEscolar, { cursEscolar: doc.cursEscolar, origen: 'importat', files: doc.files })
  }
  for (const [cursEscolar, files] of Object.entries(calculatsPerCurs ?? {})) {
    if (!files?.length) continue
    perCurs.set(cursEscolar, { cursEscolar, origen: 'calculat', files })
  }

  return [...perCurs.values()].sort((a, b) =>
    String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
}

/**
 * El total del centre d'una àrea i un trimestre, sumant totes les
 * classes. `sensePrimer` deixa 1r fora, com fan els altres resums del
 * centre: a 1r encara s'està aprenent a llegir i escriure.
 */
export function totalCentre(files, { area, trimestre, sensePrimer = false } = {}) {
  const total = filaBuida()
  for (const f of files ?? []) {
    if (area && f.area !== area) continue
    if (trimestre && f.trimestre !== trimestre) continue
    if (sensePrimer && /^1/.test(String(f.classe))) continue
    for (const k of ['na', 'as', 'an', 'ae', 'total']) total[k] += f[k] ?? 0
  }
  return total
}

/**
 * El percentatge d'alumnes que SUPEREN l'àrea (tot menys "No
 * Assoliment"), que és la xifra que es lliura a la memòria i al SIC.
 *
 * Torna null si no hi ha cap alumne: un zero diria que no en supera cap,
 * que no és el mateix que no tenir-ne dades.
 */
export function percentatgeSuperacio(fila) {
  if (!fila || !fila.total) return null
  return Math.round(((fila.total - fila.na) / fila.total) * 1000) / 10
}

/**
 * L'etiqueta d'una àrea.
 *
 * Els cursos antics tenen àrees que avui ja no existeixen ("m. natural" i
 * "m. social" abans d'unificar-se a "Medi"). L'històric les ha de poder
 * mostrar igualment: descartar-les perquè no són a la graella d'ara
 * faria desaparèixer dades reals sense dir-ho.
 */
export function etiquetaArea(id) {
  const coneguda = AREES.find((a) => a.id === id)
  if (coneguda) return coneguda.label
  const antigues = {
    medi_natural: 'Medi natural (antic)',
    medi_social: 'Medi social (antic)',
  }
  return antigues[id] ?? String(id ?? '').replace(/_/g, ' ')
}

/** Les classes que surten a un conjunt de files, ordenades per nivell. */
export function classesDe(files) {
  return [...new Set((files ?? []).map((f) => f.classe).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ca', { numeric: true }))
}

/** Els trimestres que surten a un conjunt de files, en l'ordre del curs. */
export function trimestresDe(files) {
  const hi = new Set((files ?? []).map((f) => f.trimestre))
  return TRIMESTRES.filter((t) => hi.has(t))
}

/** Les àrees que surten a un conjunt de files, en l'ordre de la graella. */
export function areesDe(files) {
  const hi = [...new Set((files ?? []).map((f) => f.area).filter(Boolean))]
  // Primer les de la graella d'ara, en el seu ordre; després les que
  // només surten als cursos antics, per no perdre-les.
  const conegudes = AREES_HISTORIC.filter((a) => hi.includes(a.id))
  const antigues = hi
    .filter((id) => !AREES_HISTORIC.some((a) => a.id === id))
    .sort()
    .map((id) => ({ id, label: etiquetaArea(id) }))
  return [...conegudes, ...antigues]
}

/**
 * El full per exportar: una fila per curs, trimestre, àrea i classe.
 *
 * Va en format llarg (una fila per combinació) i no en taula creuada
 * perquè és el que després es pot filtrar i pivotar en un full de càlcul
 * sense haver de desfer res.
 */
export function fullHistoricNotaArea(cursos) {
  const capcalera = [
    'Curs', 'Trimestre', 'Àrea', 'Classe',
    ...FRANGES.map((f) => f.label), 'Total', '% supera', 'Origen',
  ]
  const files = [capcalera]

  for (const curs of cursos ?? []) {
    for (const trimestre of trimestresDe(curs.files)) {
      for (const area of areesDe(curs.files)) {
        const delGrup = curs.files.filter((f) => f.trimestre === trimestre && f.area === area.id)
        for (const classe of classesDe(delGrup)) {
          const f = delGrup.find((x) => x.classe === classe)
          files.push([
            curs.cursEscolar, trimestre, area.label, classe,
            f.na, f.as, f.an, f.ae, f.total,
            percentatgeSuperacio(f) ?? '',
            curs.origen === 'calculat' ? 'app' : 'importat',
          ])
        }
        const tot = totalCentre(delGrup, {})
        files.push([
          curs.cursEscolar, trimestre, area.label, 'TOTAL',
          tot.na, tot.as, tot.an, tot.ae, tot.total,
          percentatgeSuperacio(tot) ?? '',
          curs.origen === 'calculat' ? 'app' : 'importat',
        ])
      }
    }
  }
  return { nom: 'Històric notes per àrea', files }
}

/**
 * El full d'evolució: una fila per àrea i una columna per curs, amb el
 * percentatge de superació. És la lectura que interessa per a la memòria
 * — si el centre millora o empitjora al llarg dels anys.
 */
export function fullEvolucioNotaArea(cursos, { trimestre = '3r trimestre', sensePrimer = false } = {}) {
  const anys = (cursos ?? []).map((c) => c.cursEscolar).reverse() // del més antic al més recent
  const capcalera = ['Àrea', ...anys]
  const files = [capcalera]

  const totesLesArees = areesDe((cursos ?? []).flatMap((c) => c.files))

  for (const area of totesLesArees) {
    files.push([
      area.label,
      ...anys.map((any) => {
        const curs = cursos.find((c) => c.cursEscolar === any)
        const tot = totalCentre(curs?.files, { area: area.id, trimestre, sensePrimer })
        return percentatgeSuperacio(tot) ?? ''
      }),
    ])
  }
  return { nom: `Evolució (${trimestre})`, files }
}
