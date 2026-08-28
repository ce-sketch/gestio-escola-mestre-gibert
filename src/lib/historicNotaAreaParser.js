// Lector dels resums de la graella de notes d'abans de l'app.
//
// Llegeix els DOS formats en què existeixen aquests documents al Drive:
//
//   · **.xlsx** — el full de càlcul original, o un Google Sheet exportat.
//     Els fulls es diuen "Resum 1r Trim.", "Resum 2n trim."…
//   · **.pdf** — la impressió del full. De diversos cursos (22-23, 24-25,
//     25-26) NOMÉS existeix el PDF: el full original no es va guardar.
//     Per això no n'hi ha prou de llegir Excel.
//
// El format que llegeix
// ---------------------
// Cada resum té les àrees en blocs de columnes, un al costat de l'altre.
// Una línia d'encapçalament diu quines àrees hi ha i on comença cadascuna;
// a sota, una fila per classe amb els quatre recomptes i el total:
//
//   català            castellà          anglès
//   NA  AS  AN  AE    NA  AS  AN  AE    NA  AS  AN  AE
//   1A  5  6  15  1  27   1A  5  4  17  1  27   1A  2  16  8  1  27
//
// Per què es treballa amb POSICIONS i no amb ordre
// ------------------------------------------------
// El nombre d'àrees per bloc canvia d'un curs a l'altre (uns anys hi ha
// "Valors", d'altres "reli/valors"; el "science" només el fan alguns
// nivells) i, sobretot, hi ha files on un bloc es queda buit i el següent
// no. Assignar els blocs per ORDRE es trencaria justament en aquestes
// files. Per això cada cel·la porta la seva posició —columna a l'Excel,
// coordenada X al PDF— i cada bloc de recomptes s'assigna a l'àrea que li
// queda més a prop.

import { textNet, numero } from './excelLectura'
import { carregaExcelJS, carregaPdfjs } from './carregaLlibreries'
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

/** El curs escolar que hi hagi escrit a les primeres línies ("Curs: 2023-24"). */
export function cursEscolarDeFull(files) {
  for (const fila of (files ?? []).slice(0, 10)) {
    for (const cell of fila) {
      const m = String(cell ?? '').match(/(\d{4})\s*-\s*(\d{2,4})/)
      if (m) return `${m[1]}-${m[2].slice(-2)}`
    }
  }
  return null
}

/**
 * Llegeix un resum de notes per àrea, en Excel o en PDF.
 *
 * @param {ArrayBuffer} buffer
 * @param {string} [nomFitxer] - només per si el contingut no fos concloent
 * @returns {Promise<{cursEscolar: string|null, files: Array, avisos: string[], format: 'pdf'|'excel'}>}
 */
export async function llegeixResumNotaArea(buffer, nomFitxer = '') {
  return esPdf(buffer) || /\.pdf$/i.test(nomFitxer)
    ? llegeixPdf(buffer)
    : llegeixExcel(buffer)
}

/** Els PDF comencen sempre pels bytes "%PDF". Es mira el CONTINGUT i no
 *  l'extensió: del Drive, un fitxer pot arribar amb el nom canviat. */
export function esPdf(buffer) {
  if (!buffer || buffer.byteLength < 4) return false
  const caps = new Uint8Array(buffer.slice(0, 4))
  return caps[0] === 0x25 && caps[1] === 0x50 && caps[2] === 0x44 && caps[3] === 0x46
}

// ── Excel ──────────────────────────────────────────────────────────────

async function llegeixExcel(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const avisos = []
  const resultat = []
  let cursEscolar = null
  let fullsReconeguts = 0

  for (const ws of wb.worksheets) {
    const trimestre = trimestreDeFull(ws.name)
    if (!trimestre) continue
    fullsReconeguts++

    // Cada fila es converteix a la forma comuna {pos, text, num}: a
    // l'Excel la posició és l'índex de columna.
    const files = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const fila = []
      for (let c = 1; c <= Math.min(row.cellCount || 40, 60); c++) {
        const cell = row.getCell(c)
        const text = textNet(cell)
        if (!text) continue
        fila.push({ pos: c, text, num: numero(cell) })
      }
      files.push(fila)
    })

    cursEscolar = cursEscolar ?? cursEscolarDeFull(files.map((f) => f.map((c) => c.text)))
    const delFull = llegeixFilesAmbPosicions(files, trimestre, avisos)
    if (delFull.length === 0) {
      avisos.push(`Al full "${ws.name}" no hi he trobat cap fila de classe amb recomptes.`)
    } else {
      resultat.push(...delFull)
    }
  }

  // Es mira si s'ha reconegut algun full, no si n'ha sortit alguna fila:
  // un full de resum buit o amb totes les files descartades és una cosa
  // (i ja s'avisa a part), i un fitxer que no és el que toca, una altra.
  if (fullsReconeguts === 0) {
    throw new Error(
      "No hi he trobat cap full de resum. Els fulls s'han de dir \"Resum 1r Trim.\", "
      + '"Resum 2n trim." i "Resum 3r trim.", com als fulls de càlcul del centre. '
      + 'Si el que tens és el PDF del full, puja el PDF directament.'
    )
  }
  if (!cursEscolar) {
    avisos.push('No he trobat el curs escolar dins del full ("Curs: 2023-24"); l\'hauràs d\'escriure a mà.')
  }

  return { cursEscolar, files: resultat, avisos, format: 'excel' }
}

// ── PDF ────────────────────────────────────────────────────────────────

/**
 * Al PDF no hi ha noms de full, així que els trimestres es dedueixen de
 * l'ORDRE de les pàgines de resum.
 *
 * Una pàgina és de resum si porta la capçalera del centre i una línia
 * d'àrees. Les pàgines de cada classe (amb les notes alumne per alumne) i
 * la taula comparativa "1r TRIM · 2n TRIM · 3r TRIM" no la porten, i
 * queden fora soles.
 *
 * Els fitxers del centre en solen tenir QUATRE: els tres trimestres i un
 * resum final. Del quart no se'n fa res —l'app treballa amb tres
 * trimestres— però es diu, per si algun any l'ordre fos un altre.
 */
async function llegeixPdf(buffer) {
  const pdfjs = await carregaPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  const avisos = []
  const paginesResum = []
  let cursEscolar = null

  for (let p = 1; p <= doc.numPages; p++) {
    const files = await filesDeLaPagina(doc, p)
    const plans = files.map((f) => f.map((c) => c.text))
    const teCapcalera = plans.slice(0, 4).some((l) => /Escola|Curs\s*:/i.test(l.join(' ')))
    const teArees = files.some((f) => areesDeLaFila(f).length >= 2)
    if (!teCapcalera || !teArees) continue
    cursEscolar = cursEscolar ?? cursEscolarDeFull(plans)
    paginesResum.push(files)
  }

  if (paginesResum.length === 0) {
    throw new Error(
      'No hi he trobat cap pàgina de resum dins del PDF. Ha de ser la impressió de la graella '
      + '"Nota mitjana d\'àrea", amb els seus fulls de resum per trimestre.'
    )
  }
  if (paginesResum.length > TRIMESTRES.length) {
    avisos.push(
      `El PDF té ${paginesResum.length} pàgines de resum i n'he fet servir les ${TRIMESTRES.length} primeres `
      + "com a 1r, 2n i 3r trimestre. La resta (normalment el resum final) no s'ha desat."
    )
  }

  const resultat = []
  for (const [i, files] of paginesResum.slice(0, TRIMESTRES.length).entries()) {
    const delFull = llegeixFilesAmbPosicions(files, TRIMESTRES[i], avisos)
    if (delFull.length === 0) avisos.push(`A la pàgina de resum ${i + 1} no hi he trobat cap fila de classe.`)
    resultat.push(...delFull)
  }

  if (!cursEscolar) {
    avisos.push('No he trobat el curs escolar dins del PDF ("Curs: 2023-24"); l\'hauràs d\'escriure a mà.')
  }
  avisos.push(
    "Llegit del PDF. Els trimestres s'han deduït de l'ordre de les pàgines de resum "
    + '(la primera és el 1r trimestre); si el fitxer les tingués en un altre ordre, revisa-ho.'
  )

  return { cursEscolar, files: resultat, avisos, format: 'pdf' }
}

/** Les línies d'una pàgina, agrupades per alçada i amb la X de cada tros.
 *  Els trossos d'una mateixa línia s'ordenen d'esquerra a dreta. */
async function filesDeLaPagina(doc, numPagina) {
  const contingut = await (await doc.getPage(numPagina)).getTextContent()
  const linies = new Map()
  for (const item of contingut.items) {
    const text = String(item.str ?? '').trim()
    if (!text) continue
    // S'arrodoneix l'alçada perquè trossos de la mateixa línia que
    // difereixin en dècimes no acabin en línies diferents.
    const y = Math.round(item.transform[5])
    if (!linies.has(y)) linies.set(y, [])
    const num = /^-?\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : null
    linies.get(y).push({ pos: item.transform[4], text, num })
  }
  return [...linies.entries()]
    .sort((a, b) => b[0] - a[0]) // de dalt a baix
    .map(([, trossos]) => trossos.sort((a, b) => a.pos - b.pos))
}

// ── Comú als dos formats ───────────────────────────────────────────────

/**
 * Tregui les files d'un resum, sigui d'on sigui.
 *
 * @param {Array<Array<{pos:number, text:string, num:number|null}>>} files
 */
function llegeixFilesAmbPosicions(files, trimestre, avisos) {
  const resultat = []
  let descartades = 0
  // Les àrees de l'última línia d'encapçalament trobada per sobre.
  let areesActuals = []

  for (const fila of files) {
    const arees = areesDeLaFila(fila)
    if (arees.length > 0) {
      areesActuals = arees
      continue
    }
    if (areesActuals.length === 0) continue

    for (let c = 0; c < fila.length; c++) {
      if (!ES_CLASSE.test(fila[c].text)) continue

      // Els quatre recomptes van just després del codi de classe, i
      // després el total que ja portava el full.
      const nums = []
      for (let d = c + 1; d < Math.min(c + 6, fila.length); d++) {
        if (fila[d].num === null) break
        nums.push(fila[d].num)
      }
      if (nums.length < 4) continue

      const area = areaPerPosicio(areesActuals, fila[c].pos)
      if (!area) continue

      const [na, as, an, ae] = nums
      const total = na + as + an + ae

      // El total del full fa de comprovació.
      //
      // Al PDF, la fila de TOTALS d'un bloc pot quedar a la mateixa
      // alçada que la fila d'una classe d'un altre bloc, i llavors els
      // seus números s'enganxen darrere d'un codi de classe que no és
      // seu. Passa de debò: al curs 25-26, els totals de Science cauen
      // sobre la fila de 5A i li duplicaven el registre de Medi.
      //
      // Quan els números són els que toquen, el cinquè és exactament la
      // suma dels quatre. Si hi és i NO quadra, el que s'ha llegit no és
      // una fila de classe. Si no hi ha cinquè número, s'accepta: hi ha
      // fulls que no porten la columna de total.
      if (nums.length >= 5 && nums[4] !== total) {
        descartades++
        continue
      }
      // Una classe amb tots els recomptes a zero no s'ha omplert: desar-la
      // ompliria l'històric de files buides que semblen dades.
      if (total === 0) continue

      resultat.push({
        trimestre,
        area,
        classe: fila[c].text.replace(/\s+/g, '').toUpperCase(),
        na, as, an, ae, total,
      })
      c += 4
    }
  }

  if (descartades > 0) {
    avisos.push(
      `Al ${trimestre} he descartat ${descartades} lectura${descartades === 1 ? '' : 'es'} on el total `
      + "no quadrava amb la suma: normalment és una fila de totals que al PDF queda a la mateixa "
      + "alçada que una classe. Si trobes que hi falta alguna classe, avisa'm."
    )
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
  for (const cell of fila) {
    const id = AREES_FULL[neteja(cell.text)]
    if (id) trobades.push({ pos: cell.pos, area: id })
  }
  // Amb una sola coincidència no n'hi ha prou: "Valors" o "Medi" poden
  // sortir soltes dins d'una fila que no és d'encapçalament.
  return trobades.length >= 2 ? trobades : []
}

/**
 * L'àrea del bloc on cau una posició: la del títol que li queda més a
 * prop.
 *
 * Es mira la DISTÀNCIA i no "l'últim títol a l'esquerra" perquè al PDF el
 * títol va centrat sobre el seu bloc i, per tant, queda a la dreta del
 * codi de classe. Amb el criteri d'"últim a l'esquerra", la primera
 * columna de cada pàgina es quedava sense àrea.
 */
function areaPerPosicio(arees, pos) {
  let millor = null
  let millorDistancia = Infinity
  for (const a of arees) {
    const d = Math.abs(a.pos - pos)
    if (d < millorDistancia) { millorDistancia = d; millor = a }
  }
  return millor?.area ?? null
}
