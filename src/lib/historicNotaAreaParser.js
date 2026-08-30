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
import { MOMENT_FINAL } from './historicNotaArea'
import { nivellDe } from './avaluacioCatala'

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
  // Un full que es diu "Resum" a seques (sense cap paraula de trimestre)
  // és el resum FINAL del curs: la mateixa Final que altrament caldria
  // reconstruir del full alumne per alumne, però ja agregada per franja
  // i classe — amb el mateix format exacte que els fulls de trimestre.
  //
  // És, a més, més fiable que reconstruir-la quan el llibre reparteix
  // els alumnes en una pestanya per classe (1A, 1B, 2A…): el lector
  // alumne per alumne només mira la PRIMERA que troba i es perdria la
  // resta, mentre que aquest full ja ve amb totes les classes juntes.
  if (t === 'resum') return MOMENT_FINAL
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
  if (esPdf(buffer) || /\.pdf$/i.test(nomFitxer)) return llegeixPdf(buffer)

  const resum = await llegeixExcel(buffer)

  // Si el llibre ja porta un full "Resum" (sense trimestre) amb la Final
  // ja agregada per classe, es fa servir directament: és més fiable que
  // reconstruir-la del full alumne per alumne (vegeu `trimestreDeFull`),
  // i evita duplicar-la si es calculessin totes dues.
  if (resum.files.some((f) => f.trimestre === MOMENT_FINAL)) {
    return resum
  }

  // La nota Final no és als fulls "Resum" —només hi ha recomptes per
  // franja, i d'un recompte no se'n pot recuperar qui era qui—, però sí
  // al full de notes alumne per alumne. Es llegeix a part i s'hi afegeix.
  //
  // Si no hi és, no es para res: els trimestres ja s'han llegit i l'avís
  // ho diu. Un fitxer que només porti els resums segueix sent útil.
  try {
    const finals = await llegeixFinalsPerAlumne(buffer, MOMENT_FINAL)
    return {
      ...resum,
      files: [...resum.files, ...finals.files],
      avisos: [...resum.avisos, ...finals.avisos],
    }
  } catch (err) {
    return {
      ...resum,
      avisos: [...resum.avisos, `No he pogut llegir la nota Final: ${err.message}`],
    }
  }
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
  const paginesAlumnes = []
  let cursEscolar = null

  for (let p = 1; p <= doc.numPages; p++) {
    const files = await filesDeLaPagina(doc, p)
    const plans = files.map((f) => f.map((c) => c.text))

    // Pàgines "alumne per alumne" (una per classe: 1A, 1B…), amb la nota
    // Final de cada àrea. Es miren ABANS que les de resum perquè aquestes
    // també tenen noms d'àrea a la capçalera i, sense el tret distintiu
    // de "Noms", s'hi podrien confondre.
    const filaAlumnes = files.find(esCapcaleraAlumnes)
    if (filaAlumnes) {
      cursEscolar = cursEscolar ?? cursEscolarDeFull(plans)
      paginesAlumnes.push(files)
      continue
    }

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

  // La nota Final: de les pàgines "alumne per alumne" si n'hi ha (una per
  // classe), amb el mateix criteri de posicions que l'Excel — la columna
  // "F" de cada àrea. Si el PDF no en porta cap (només els resums per
  // trimestre), no es calcula: no hi ha manera de recuperar-la d'un
  // recompte ja agregat.
  if (paginesAlumnes.length > 0) {
    const finals = llegeixFinalsAlumnesPdf(paginesAlumnes)
    resultat.push(...finals.files)
    avisos.push(...finals.avisos)
  } else {
    avisos.push(
      "No hi he trobat cap pàgina \"alumne per alumne\" (una per classe, amb columna F) al PDF, "
      + "així que la nota Final no s'ha pogut calcular. Els trimestres sí que s'han llegit."
    )
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

// ── La nota FINAL de les pàgines "alumne per alumne" del PDF ───────────
//
// A diferència de l'Excel (un sol full amb tots els alumnes), el PDF sol
// portar-les repartides en una pàgina per classe: "1A", "1B", "2A"…, amb
// una columna "F" (Final) després de cada àrea. La capçalera hi porta el
// nom de l'àrea seguit de la seva "F", ben separades l'una de l'altra en
// posició horitzontal — el mateix patró de columnes fusionades que
// `grupsAreaDeCapcalera` fa servir a l'Excel, aquí amb coordenades X en
// lloc de columnes de full de càlcul.
//
// Els noms d'àrea de dues paraules ("e. física") poden arribar partits en
// dos trossos de text diferents al PDF (un per cada paraula): per això es
// prova primer amb una paraula sola i, si no encaixa, amb la següent
// enganxada al darrere.
//
// El "GF" (global final de Medi o d'Artística) no porta cap "F" pròpia
// darrere — és ja un valor final, no un bloc de tres trimestres més
// final — i aquí es descarta expressament: l'app ja sap calcular-lo tota
// sola a partir de les àrees que el formen (`calculaAreesCalculades` a
// `historicNotaArea.js`), així que no cal endevinar de quin GF es tracta
// (el de Medi o el d'Artística) mirant només la posició.

/** Les distàncies típiques que s'han vist en fitxers reals: ~2-3px entre
 *  la "F" i el seu número, i >14px entre el número d'una àrea i el de la
 *  següent. Amb 8px hi ha marge de sobres per no confondre'ls. */
const DISTANCIA_MAX_COLUMNA = 8

/** Si una fila és la capçalera d'una pàgina "alumne per alumne": porta
 *  "Noms" (la columna del nom de l'alumne) i almenys dues àrees amb la
 *  seva "F". Cap altra fila del document hi hauria de coincidir. */
function esCapcaleraAlumnes(fila) {
  return fila.some((c) => neteja(c.text) === 'noms') && areesFDeCapcalera(fila).length >= 2
}

/**
 * Les parelles àrea + posició de la seva columna "F", d'una fila de
 * capçalera.
 *
 * @returns {Array<{area: string, pos: number}>}
 */
export function areesFDeCapcalera(fila) {
  const resultat = []
  let pendent = null
  for (let i = 0; i < fila.length; i++) {
    const cel = fila[i]
    if (neteja(cel.text) === 'f') {
      if (pendent) resultat.push({ area: pendent, pos: cel.pos })
      pendent = null
      continue
    }
    let area = AREES_FULL[neteja(cel.text)]
    let consumeixSeguent = false
    if (!area && i + 1 < fila.length) {
      const combinat = AREES_FULL[neteja(`${cel.text} ${fila[i + 1].text}`)]
      if (combinat) { area = combinat; consumeixSeguent = true }
    }
    if (area) {
      pendent = area
      if (consumeixSeguent) i += 1
    } else {
      // Un token que no és ni àrea ni "F" (el "GF", per exemple) tanca
      // qualsevol àrea pendent sense "F" seva: no se li ha d'assignar
      // per error la "F" d'una altra àrea que li quedi a prop.
      pendent = null
    }
  }
  return resultat
}

/**
 * Llegeix la nota Final de les pàgines "alumne per alumne" del PDF.
 *
 * @param {Array<Array<Array<{pos:number, text:string, num:number|null}>>>} paginesFiles
 *   una entrada per pàgina, cadascuna amb les seves files ja agrupades
 *   per `filesDeLaPagina`
 * @returns {{files: Array, avisos: string[]}}
 */
export function llegeixFinalsAlumnesPdf(paginesFiles) {
  const acumulat = new Map() // clau `area__classe` → recompte
  const avisos = []
  let capCapPaginaTrobada = false

  for (const files of paginesFiles) {
    const filaCap = files.find(esCapcaleraAlumnes)
    if (!filaCap) continue
    capCapPaginaTrobada = true
    const arees = areesFDeCapcalera(filaCap)

    for (const fila of files) {
      if (fila.length === 0 || !ES_CLASSE.test(fila[0].text)) continue // no és una fila d'alumne
      const classe = fila[0].text.replace(/\s+/g, '').toUpperCase()
      const numeros = fila.filter((c) => c.num !== null)

      for (const { area, pos } of arees) {
        let millor = null
        let millorDistancia = Infinity
        for (const n of numeros) {
          const d = Math.abs(n.pos - pos)
          if (d < millorDistancia) { millorDistancia = d; millor = n }
        }
        // Sense número prou a prop: l'alumne no té nota en aquesta àrea
        // (per exemple, fa "valors" en lloc de "religió"). No s'inventa.
        if (!millor || millorDistancia > DISTANCIA_MAX_COLUMNA) continue

        const nivell = nivellDe(millor.num)
        if (!nivell) continue
        const franja = idFranjaDeNivell(nivell.id)
        if (!franja) continue

        const clau = `${area}__${classe}`
        if (!acumulat.has(clau)) acumulat.set(clau, { na: 0, as: 0, an: 0, ae: 0, total: 0 })
        const fils = acumulat.get(clau)
        fils[franja] += 1
        fils.total += 1
      }
    }
  }

  if (!capCapPaginaTrobada || acumulat.size === 0) {
    avisos.push(
      "No hi he trobat cap alumne a les pàgines \"alumne per alumne\", així que la nota Final "
      + "no s'ha pogut calcular. Els trimestres sí que s'han llegit."
    )
    return { files: [], avisos }
  }

  const files = [...acumulat.entries()].map(([clau, recompte]) => {
    const [area, classe] = clau.split('__')
    return { trimestre: MOMENT_FINAL, area, classe, ...recompte }
  })

  return { files, avisos }
}


// ── Les notes per alumne, i la nota FINAL ─────────────────────────────
//
// Els fulls "Resum" només donen recomptes agregats per franja, i d'un
// recompte no se'n pot recuperar qui era qui: la nota Final és la mitjana
// de CADA alumne classificada després, no la mitjana de les franges.
//
// Per sort, els mateixos fitxers porten un full amb tots els alumnes i,
// per cada àrea, els tres trimestres i una columna "F" amb la final que
// ja va calcular el centre. D'allà en surt la dada exacta.


/** Els números del full vénen amb coma decimal, i els buits com a "-". */
function nota(cell) {
  const n = numero(cell)
  if (n !== null) return n
  const t = textNet(cell).replace(',', '.')
  if (!t || t === '-' || t === '—') return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}

/**
 * Els grups d'àrea d'una capçalera: tres columnes iguals seguides d'una
 * "F".
 *
 * Aquest patró és el que distingeix les àrees de les columnes de
 * recompte que hi ha més a la dreta del mateix full ("CAT1t, CAT2t,
 * Cat3t, FINAL"): allà les tres primeres NO són iguals entre si, i per
 * això no s'hi confonen.
 *
 * Les cel·les fusionades poden arribar buides segons com s'hagi desat el
 * fitxer, així que abans s'arrossega el valor anterior cap a la dreta.
 */
export function grupsAreaDeCapcalera(textos) {
  const plens = []
  let ultim = ''
  for (const t of textos) {
    const net = String(t ?? '').trim()
    if (net) ultim = net
    plens.push(net || ultim)
  }

  const grups = []
  for (let c = 0; c + 3 < plens.length; c++) {
    const [a, b, d, f] = [plens[c], plens[c + 1], plens[c + 2], plens[c + 3]]
    if (!a || a !== b || b !== d) continue
    if (neteja(f) !== 'f') continue
    const area = AREES_FULL[neteja(a)]
    if (!area) continue
    grups.push({ area, colFinal: c + 3 })
    c += 3
  }
  return grups
}

/**
 * Llegeix el full de notes per alumne i en treu les files de la nota
 * FINAL, ja repartides per franja.
 *
 * @returns {Array<{trimestre, area, classe, na, as, an, ae, total}>}
 */
export async function llegeixFinalsPerAlumne(buffer, momentFinal) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  // clau `area__classe` → recompte
  const acumulat = new Map()
  const avisos = []
  let fullTrobat = null

  for (const ws of wb.worksheets) {
    const files = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const fila = []
      for (let c = 1; c <= Math.min(row.cellCount || 60, 120); c++) fila.push(row.getCell(c))
      files.push(fila)
    })

    // La capçalera és la fila que dona més grups d'àrea.
    let grups = []
    let filaCap = -1
    for (let i = 0; i < Math.min(files.length, 20); i++) {
      const trobats = grupsAreaDeCapcalera(files[i].map((c) => textNet(c)))
      if (trobats.length > grups.length) { grups = trobats; filaCap = i }
    }
    if (grups.length < 3) continue
    fullTrobat = ws.name

    // La columna de classe: la primera que, a les files de sota, tingui
    // codis de classe. Al full real és la primera de totes.
    for (let i = filaCap + 1; i < files.length; i++) {
      const fila = files[i]
      let classe = null
      for (let c = 0; c < Math.min(fila.length, 4); c++) {
        const t = textNet(fila[c]).replace(/\s/g, '').toUpperCase()
        if (ES_CLASSE.test(t)) { classe = t; break }
      }
      if (!classe) continue

      for (const { area, colFinal } of grups) {
        const valor = nota(fila[colFinal])
        if (valor === null) continue
        const nivell = nivellDe(valor)
        if (!nivell) continue
        const franja = idFranjaDeNivell(nivell.id)
        if (!franja) continue
        const clau = `${area}__${classe}`
        if (!acumulat.has(clau)) acumulat.set(clau, { na: 0, as: 0, an: 0, ae: 0, total: 0 })
        const fils = acumulat.get(clau)
        fils[franja] += 1
        fils.total += 1
      }
    }
    break // amb un full de notes n'hi ha prou
  }

  if (acumulat.size === 0) {
    avisos.push(
      "No hi he trobat el full amb les notes alumne per alumne, així que la nota Final "
      + "no s'ha pogut calcular. Els trimestres sí que s'han llegit."
    )
    return { files: [], avisos, full: fullTrobat }
  }

  const files = [...acumulat.entries()].map(([clau, recompte]) => {
    const [area, classe] = clau.split('__')
    return { trimestre: momentFinal, area, classe, ...recompte }
  })
  return { files, avisos, full: fullTrobat }
}

/** Els nivells d'`avaluacioCatala` als identificadors de franja d'aquí. */
function idFranjaDeNivell(nivellId) {
  const t = String(nivellId ?? '')
  if (t.includes('excel')) return 'ae'
  if (t.includes('notable')) return 'an'
  if (t.includes('satisfactori')) return 'as'
  if (t.includes('no_assoliment')) return 'na'
  return null
}
