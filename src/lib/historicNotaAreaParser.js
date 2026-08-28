// Lector dels fulls "Resum" de la graella de notes d'abans de l'app.
//
// El format que llegeix
// ---------------------
// Cada full ("Resum 1r Trim.", "Resum 2n trim."…) té les àrees en blocs
// de columnes, un al costat de l'altre. Una fila d'encapçalament diu
// quines àrees hi ha i on comença cadascuna; a sota, una fila per classe
// amb els quatre recomptes i el total:
//
//   català            castellà          anglès
//   NA  AS  AN  AE    NA  AS  AN  AE    NA  AS  AN  AE
//   1A  5  6  15  1  27   1A  5  4  17  1  27   1A  2  16  8  1  27
//
// Per què no es donen per fetes les columnes
// ------------------------------------------
// El nombre d'àrees per bloc canvia d'un curs a l'altre (uns anys hi ha
// "Valors", d'altres "reli/valors"; el "science" només el fan alguns
// nivells) i les columnes es mouen. Per això el lector busca la fila
// d'àrees, es queda amb la COLUMNA on comença cadascuna, i després
// assigna cada bloc de recomptes a l'àrea que li queda més a l'esquerra.

import { textNet, numero } from './excelLectura'
import { carregaExcelJS } from './carregaLlibreries'
import { TRIMESTRES } from './notesArea'

/** Com s'anomenen les àrees als fulls antics → l'id que fa servir l'app.
 *  Les claus van sense accents ni espais, per comparar-les amb tolerància. */
const AREES_FULL = {
  catala: 'catala',
  castella: 'castella',
  angles: 'angles',
  matematiques: 'matematiques',
  medi: 'medi',
  // Els cursos antics separaven medi natural i medi social; avui és una
  // sola àrea ("medi"). Es desen amb el nom d'aleshores: barrejar-los amb
  // el "medi" d'ara compararia coses que no es van avaluar igual.
  mnatural: 'medi_natural',
  medinatural: 'medi_natural',
  msocial: 'medi_social',
  medisocial: 'medi_social',
  science: 'science',
  plastica: 'plastica',
  musica: 'musica',
  efisica: 'efisica',
  edfisica: 'efisica',
  religio: 'religio',
  valors: 'valors',
  relivalors: 'religio',
  // La columna "GF" (global final) de Medi i d'Artística, quan el full
  // les porta com a bloc propi. Si un curs concret no les té, l'àrea
  // simplement no surt aquell any — no s'inventa.
  artistica: 'artistica',
  mediglobal: 'medi_global',
  medigf: 'medi_global',
}

const neteja = (t) => String(t ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Un codi de classe tal com surt als fulls: "1A", "4tB", "6eC". */
const ES_CLASSE = /^\d{1,2}\s*(r|n|t|rt|è|e)?\s*[A-D]$/i

/** El trimestre que descriu el nom d'un full ("Resum 2n trim." → "2n
 *  trimestre"). Torna null si el full no és de resum. */
export function trimestreDeFull(nomFull) {
  const t = neteja(nomFull)
  if (!t.includes('resum')) return null
  if (t.includes('1r') || t.includes('1er') || t.includes('primer')) return TRIMESTRES[0]
  if (t.includes('2n') || t.includes('segon')) return TRIMESTRES[1]
  if (t.includes('3r') || t.includes('3er') || t.includes('tercer')) return TRIMESTRES[2]
  return null
}

/** El curs escolar que hi hagi escrit al full ("Curs: 2023-24"). */
export function cursEscolarDeFull(files) {
  for (const fila of files.slice(0, 10)) {
    for (const cell of fila) {
      const m = String(cell ?? '').match(/(\d{4})\s*-\s*(\d{2,4})/)
      if (m) return `${m[1]}-${m[2].slice(-2)}`
    }
  }
  return null
}

/**
 * Llegeix un Excel amb els fulls "Resum" i en treu les files de
 * l'històric.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{cursEscolar: string|null, files: Array, avisos: string[]}>}
 */
export async function llegeixResumNotaArea(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const avisos = []
  const resultat = []
  let cursEscolar = null
  let fullsLlegits = 0

  for (const ws of wb.worksheets) {
    const trimestre = trimestreDeFull(ws.name)
    if (!trimestre) continue

    // A memòria: aquests fulls tenen poques files i moltes columnes.
    const files = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const fila = []
      for (let c = 1; c <= Math.min(row.cellCount || 40, 60); c++) fila.push(row.getCell(c))
      files.push(fila)
    })

    cursEscolar = cursEscolar ?? cursEscolarDeFull(files.map((f) => f.map((c) => textNet(c))))
    const delFull = llegeixFullResum(files, trimestre, avisos)
    if (delFull.length === 0) {
      avisos.push(`Al full "${ws.name}" no hi he trobat cap fila de classe amb recomptes.`)
    } else {
      fullsLlegits++
      resultat.push(...delFull)
    }
  }

  if (fullsLlegits === 0) {
    throw new Error(
      "No hi he trobat cap full de resum. Els fulls s'han de dir \"Resum 1r Trim.\", "
      + '"Resum 2n trim." i "Resum 3r trim.", com als fulls de càlcul del centre.'
    )
  }
  if (!cursEscolar) {
    avisos.push('No he trobat el curs escolar dins del full ("Curs: 2023-24"); l\'hauràs d\'escriure a mà.')
  }

  return { cursEscolar, files: resultat, avisos }
}

/** Les files d'un full de resum. */
function llegeixFullResum(files, trimestre, avisos) {
  const resultat = []
  // Columna on comença cada àrea, segons l'última fila d'encapçalament
  // que s'hagi trobat per sobre.
  let areesActuals = []

  for (const fila of files) {
    const arees = areesDeLaFila(fila)
    if (arees.length > 0) {
      areesActuals = arees
      continue
    }
    if (areesActuals.length === 0) continue

    for (let c = 0; c < fila.length; c++) {
      const t = textNet(fila[c])
      if (!ES_CLASSE.test(t)) continue

      // Els quatre recomptes van just després del codi de classe. El
      // cinquè número, si hi és, és el total que ja portava el full: no
      // es fa servir, es recalcula, perquè a alguns fulls no quadra.
      const nums = []
      for (let d = c + 1; d < Math.min(c + 5, fila.length); d++) {
        const n = numero(fila[d])
        if (n === null) break
        nums.push(n)
      }
      if (nums.length < 4) continue

      const area = areaPerColumna(areesActuals, c)
      if (!area) continue

      const [na, as, an, ae] = nums
      const total = na + as + an + ae
      // Una classe amb tots els recomptes a zero no s'ha omplert: desar-la
      // ompliria l'històric de files buides que semblen dades.
      if (total === 0) continue

      resultat.push({
        trimestre,
        area,
        classe: t.replace(/\s+/g, '').toUpperCase(),
        na, as, an, ae, total,
      })
      c += 4
    }
  }

  const repetides = resultat
    .map((f) => `${f.area}__${f.classe}`)
    .filter((clau, i, tots) => tots.indexOf(clau) !== i)
  if (repetides.length > 0) {
    avisos.push(
      `Al ${trimestre} hi ha classes que surten més d'una vegada a la mateixa àrea `
      + `(${[...new Set(repetides)].slice(0, 5).join(', ')}). He desat totes les files; revisa-ho.`
    )
  }

  return resultat
}

/** Si una fila és d'encapçalament d'àrees, on comença cadascuna. */
function areesDeLaFila(fila) {
  const trobades = []
  for (let c = 0; c < fila.length; c++) {
    const id = AREES_FULL[neteja(textNet(fila[c]))]
    if (id) trobades.push({ col: c, area: id })
  }
  // Amb una sola coincidència no n'hi ha prou: "Valors" o "Medi" poden
  // sortir soltes dins d'una fila que no és d'encapçalament.
  return trobades.length >= 2 ? trobades : []
}

/** L'àrea del bloc on cau una columna: la que comença més a prop per
 *  l'esquerra. */
function areaPerColumna(arees, col) {
  let millor = null
  for (const a of arees) {
    if (a.col <= col && (!millor || a.col > millor.col)) millor = a
  }
  return millor?.area ?? null
}
