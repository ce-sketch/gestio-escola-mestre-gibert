// Lector dels informes ConMat (Innovamat) en PDF.
//
// ⚠️ Llegiu això abans de tocar-hi res
// ------------------------------------
// Els informes del ConMat arriben **només en PDF**, pensats per imprimir i
// donar a les famílies. Un PDF no és una taula: és text col·locat sobre una
// pàgina. Això vol dir que aquest lector és, per força, més fràgil que els
// d'Excel, i que s'ha triat a consciència **què s'intenta llegir i què no**:
//
//   SÍ  · la classe i el moment (de la portada)
//   SÍ  · el nom de cada alumne, el seu nivell i les preguntes respostes
//   NO  · els resultats per bloc (Numeració, Espai i forma, Mesura…) ni per
//         domini cognitiu: al PDF són GRÀFICS, no dades. No hi ha manera
//         raonable de recuperar-los.
//   NO  · la llista de continguts amb dificultats: el text del PDF ve sense
//         espais ("Identificarpropietatsdelamultiplicació") i separar-lo
//         seria endevinar.
//
// El disseny important: si l'Innovamat canvia el format, aquest lector
// **trobarà zero alumnes** en comptes de retornar números equivocats. Val
// més que falli a la cara que no pas en silenci.
//
// Comprovat contra l'informe de 3r del curs 25-26: 27 alumnes detectats,
// exactament els 27 que declara la pàgina de participació.


import { carregaPdfjs } from './carregaLlibreries'
/** Els quatre nivells del ConMat, amb el seu equivalent en percentatge per
 *  poder-los barrejar amb la resta d'indicadors de l'app. */
export const NIVELLS_CONMAT = [
  { id: 'baix', label: 'Baix', valor: 25 },
  { id: 'mitja_baix', label: 'Mitjà-baix', valor: 50 },
  { id: 'mitja_alt', label: 'Mitjà-alt', valor: 75 },
  { id: 'alt', label: 'Alt', valor: 100 },
]

export function nivellAPercentatge(text) {
  if (!text) return null
  const net = String(text).trim().toLowerCase()
  return NIVELLS_CONMAT.find((n) => n.label.toLowerCase() === net)?.valor ?? null
}

/**
 * Per casar els noms del PDF amb els de la fitxa d'alumne.
 *
 * Al PDF surten enganxats i en ordre invers ("AhmedHaniya"); a l'app,
 * com a "Ahmed, Haniya". Traient espais, comes i accents dels dos costats,
 * les dues formes coincideixen.
 */
export function claueDeNom(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Text pla de cada pàgina del PDF. */
async function textDeLesPagines(buffer) {
  const pdfjs = await carregaPdfjs()
  const document = await pdfjs.getDocument({ data: buffer }).promise
  const pagines = []
  for (let i = 1; i <= document.numPages; i++) {
    const pagina = await document.getPage(i)
    const contingut = await pagina.getTextContent()
    // Cada element du la seva posició; agrupem per línia (coordenada Y)
    // perquè el text quedi en l'ordre en què es llegeix.
    const linies = new Map()
    for (const item of contingut.items) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5])
      if (!linies.has(y)) linies.set(y, [])
      linies.get(y).push({ x: item.transform[4], text: item.str })
    }
    const ordenades = [...linies.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, trossos]) => trossos.sort((a, b) => a.x - b.x).map((t) => t.text).join('').trim())
    pagines.push(ordenades.filter(Boolean).join('\n'))
  }
  return pagines
}

/**
 * Llegeix un informe ConMat.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{classe, moment, curs, alumnes, avisos}>}
 */
export async function llegeixConmat(buffer) {
  const pagines = await textDeLesPagines(buffer)
  const avisos = []

  // ── Portada: classe, moment i nivell ────────────────────────────────
  const portada = (pagines[0] ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const moment = portada.find((l) => /Avaluació\s*(inicial|final)/i.test(l)) ?? null
  const classe = portada.find((l) => /^\d+\s*[A-DaD]$/i.test(l.replace(/\s/g, ''))) ?? null
  const curs = portada.find((l) => /^\d+$/.test(l)) ?? null

  // ── Participació: quants alumnes hauria d'haver-hi ──────────────────
  let esperats = null
  for (const pagina of pagines.slice(0, 6)) {
    const m = pagina.replace(/\s/g, '').match(/Alumnesambprouinformacióperser(\d+)(\d+)?/i)
    if (m) { esperats = Number(m[2] ?? m[1]); break }
  }

  // ── Una pàgina per alumne ───────────────────────────────────────────
  const alumnes = []
  for (let i = 0; i < pagines.length; i++) {
    const text = pagines[i]
    const sensEspais = text.replace(/[ \t]/g, '')
    const nivell = sensEspais.match(/Nivell:([^\n]+)/i)
    if (!nivell) continue

    const nom = (text.split('\n')[0] ?? '').trim()
    if (!nom) continue

    const preguntes = sensEspais.match(/Nombredepreguntesambresposta:([\d]+)\/([\d]+)/i)
    alumnes.push({
      nomPdf: nom,
      clau: claueDeNom(nom),
      nivell: nivell[1].trim(),
      percentatge: nivellAPercentatge(nivell[1].trim()),
      respostes: preguntes ? Number(preguntes[1]) : null,
      preguntes: preguntes ? Number(preguntes[2]) : null,
      pagina: i + 1,
    })
  }

  if (alumnes.length === 0) {
    throw new Error(
      "No he trobat cap alumne dins d'aquest PDF. O no és un informe ConMat, o " +
      "l'Innovamat n'ha canviat el format i el lector s'ha de posar al dia."
    )
  }
  if (esperats !== null && esperats !== alumnes.length) {
    avisos.push(
      `L'informe diu que hi ha ${esperats} alumnes i n'he llegit ${alumnes.length}. ` +
      'Revisa la llista abans de desar-la.'
    )
  }
  const senseNivell = alumnes.filter((a) => a.percentatge === null)
  if (senseNivell.length > 0) {
    avisos.push(`${senseNivell.length} alumnes tenen un nivell que no reconec (${[...new Set(senseNivell.map((a) => a.nivell))].join(', ')}).`)
  }
  avisos.push(
    'Del PDF només se n\'obté el nivell global de cada alumne: els resultats per bloc ' +
    '(Numeració, Espai i forma…) hi són com a gràfics i no es poden llegir.'
  )

  return { classe, moment, curs, esperats, alumnes, avisos }
}

/**
 * Casa els alumnes de l'informe amb els de la fitxa del centre.
 *
 * @param {Array} delPdf     sortida de llegeixConmat
 * @param {Array} delCentre  { id, nom } de la col·lecció "alumnes"
 */
export function casaAmbAlumnes(delPdf, delCentre) {
  const perClau = new Map()
  for (const a of delCentre) perClau.set(claueDeNom(a.nom), a)

  const casats = []
  const sensCasar = []
  for (const a of delPdf) {
    const trobat = perClau.get(a.clau)
    if (trobat) casats.push({ ...a, alumneId: trobat.id, nom: trobat.nom })
    else sensCasar.push(a)
  }
  return { casats, sensCasar }
}

/** Distribució per nivells d'una classe, per a l'avaluació referencial. */
export function distribucio(alumnes) {
  const recompte = Object.fromEntries(NIVELLS_CONMAT.map((n) => [n.id, 0]))
  let sense = 0
  for (const a of alumnes) {
    const nivell = NIVELLS_CONMAT.find((n) => n.label.toLowerCase() === String(a.nivell).toLowerCase())
    if (nivell) recompte[nivell.id]++
    else sense++
  }
  const total = alumnes.length
  return {
    total,
    recompte,
    sense,
    percentatges: Object.fromEntries(
      Object.entries(recompte).map(([k, n]) => [k, total ? Math.round((n / total) * 1000) / 10 : 0])
    ),
  }
}
