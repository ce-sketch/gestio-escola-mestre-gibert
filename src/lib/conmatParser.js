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
import { clauDeText, paraulesDe } from './text'
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
  return clauDeText(text)
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
export async function llegeixConmat(buffer, nomFitxer = '') {
  const pagines = await textDeLesPagines(buffer)
  const avisos = []

  // ── Portada: classe, moment i nivell ────────────────────────────────
  const portada = (pagines[0] ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const moment = portada.find((l) => /Avaluació\s*(inicial|final)/i.test(l))
    ?? (/final/i.test(nomFitxer) ? 'Avaluació final' : /inici/i.test(nomFitxer) ? 'Avaluació inicial' : null)
  // La classe surt a la portada amb l'ordinal enmig: "3rA", "3rB",
  // "4rtA", "5èB"... Ha de sortir d'aquí i no del nom del fitxer, perquè
  // l'Innovamat anomena igual els informes de les dues classes d'un
  // mateix nivell (només es diferencien pel "(1)" que hi afegeix el
  // Drive). Fiar-se del nom del fitxer faria que la segona classe
  // sobreescrigués la primera.
  const classe = portada
    .map((l) => l.replace(/\s/g, ''))
    .find((l) => /^\d+(r|n|t|rt|è|e)?[A-D]$/i.test(l))
    ?? (nomFitxer.replace(/\s/g, '').match(/(\d+(?:r|n|t|rt|è|e)?[A-D])Prim/i)?.[1] ?? null)
  const curs = portada.find((l) => /^\d+$/.test(l)) ?? null

  // ── Participació: quants alumnes hauria d'haver-hi ──────────────────
  // La taula de participació dona DOS números: els alumnes avaluats a
  // l'inici de curs i els del final ("27 24"). Es tria el del final,
  // perquè és la llista que l'informe fa servir per a tot.
  //
  // Compte: abans es buscava sobre el text amb els espais tallats, i
  // llavors "27 24" es llegia com un sol número, 2724.
  let esperats = null
  for (const pagina of pagines.slice(0, 6)) {
    if (!/Alumnes amb prou informaci[óo] per ser/i.test(pagina)) continue
    // Els dos números van sols en una línia; el número de pàgina també
    // va sol, però és un de sol i no dos.
    for (const linia of pagina.split('\n')) {
      const m = linia.trim().match(/^(\d{1,3})\s+(\d{1,3})$/)
      if (m) { esperats = Number(m[2]); break }
    }
    if (esperats !== null) break
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

  const comparativa = comparativaPerPregunta(pagines)

  return { classe, moment, curs, esperats, alumnes, avisos, comparativa }
}

/**
 * Casa els alumnes de l'informe amb els de la fitxa del centre.
 *
 * @param {Array} delPdf     sortida de llegeixConmat
 * @param {Array} delCentre  { id, nom } de la col·lecció "alumnes"
 */
/** Les paraules d'un nom, normalitzades i ordenades. Serveix per casar
 *  noms escrits en ordre diferent o amb parts de menys. */
export function paraulesDeNom(text) {
  return paraulesDe(text).sort()
}

/** Clau independent de l'ordre de les paraules: "Pol Pérez" i "Pérez Pol"
 *  donen la mateixa. S'usa per identificar els alumnes que no consten al
 *  centre, perquè no se'n creïn dos registres. */
export function clauOrdenadaDeNom(text) {
  return paraulesDeNom(text).join('')
}

/** Quantes lletres s'han de canviar per convertir un text en l'altre.
 *  Serveix per detectar errades d'escriptura d'una lletra, que als
 *  informes de l'Innovamat són freqüents ("Matamoros" per "Matamoro",
 *  "Padrilla" per "Padilla"). */
function distanciaEdicio(a, b) {
  const files = Array.from({ length: b.length + 1 }, (_, i) => [i, ...Array(a.length).fill(0)])
  for (let j = 1; j <= a.length; j++) files[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      files[i][j] = b[i - 1] === a[j - 1]
        ? files[i - 1][j - 1]
        : 1 + Math.min(files[i - 1][j - 1], files[i][j - 1], files[i - 1][j])
    }
  }
  return files[b.length][a.length]
}

/**
 * Dos noms "gairebé iguals": totes les paraules coincideixen tret d'una,
 * i aquesta només es diferencia per una o dues lletres.
 *
 * És el cas real de "Medrano Matamoros Marlon Alexander" (informe) contra
 * "Medrano Matamoro, Marlon Alexander" (fitxa): 3 paraules idèntiques i
 * una amb una lletra de més. Exigir que la resta del nom quadri sencera
 * fa que això sigui segur; amb una sola paraula de coincidència no ho
 * seria gens.
 */
function gairebeIgual(paraulesA, paraulesB) {
  if (paraulesA.length !== paraulesB.length || paraulesA.length < 2) return false
  const soltesA = paraulesA.filter((p) => !paraulesB.includes(p))
  const soltesB = paraulesB.filter((p) => !paraulesA.includes(p))
  if (soltesA.length !== 1 || soltesB.length !== 1) return false
  const [a] = soltesA
  const [b] = soltesB
  // Dues lletres de marge, però només si la paraula és prou llarga.
  const marge = Math.min(a.length, b.length) >= 6 ? 2 : 1
  return distanciaEdicio(a, b) <= marge
}

/**
 * Casa els alumnes llegits del PDF amb els del centre.
 *
 * Els informes de l'Innovamat NO usen sempre el mateix format de nom: uns
 * porten els dos cognoms ("Argelaguet Puig Aina") i altres només el primer
 * ("Abellan Alexandra"). Per això el casament es fa en dues passades:
 *
 *   1. Coincidència exacta de la clau (sense accents ni espais).
 *   2. Si no n'hi ha, coincidència per subconjunt: totes les paraules del
 *      nom del PDF són dins del nom del centre (o a l'inrevés).
 *
 * La segona passada només s'accepta si hi ha UN SOL candidat possible. Si
 * n'hi ha més d'un (per exemple dos germans o dos alumnes amb el mateix
 * cognom i nom), es deixa sense casar a posta: val més deixar-ho a la
 * vista que assignar la nota a qui no toca.
 */
export function casaAmbAlumnes(delPdf, delCentre) {
  const perClau = new Map()
  for (const a of delCentre) perClau.set(claueDeNom(a.nom), a)

  const ambParaules = delCentre.map((a) => ({ alumne: a, paraules: paraulesDeNom(a.nom) }))
  const jaCasats = new Set()

  const casats = []
  const sensCasar = []
  const dubtosos = []

  for (const a of delPdf) {
    const exacte = perClau.get(a.clau)
    if (exacte) {
      casats.push({ ...a, alumneId: exacte.id, nom: exacte.nom })
      jaCasats.add(exacte.id)
      continue
    }

    const delPdfParaules = paraulesDeNom(a.nomPdf ?? a.nom)
    // L'ambigüitat es mira contra TOT l'alumnat del centre, no només
    // contra els que encara no s'han casat. Si no, un nom incomplet com
    // "Ruiz Lozano" (dues germanes) s'acabaria assignant a la germana que
    // quedés lliure, que és precisament el que volem evitar.
    const candidats = delPdfParaules.length < 2 ? [] : ambParaules.filter(({ paraules }) => {
      const pdfDinsCentre = delPdfParaules.every((p) => paraules.includes(p))
      const centreDinsPdf = paraules.every((p) => delPdfParaules.includes(p))
      return pdfDinsCentre || centreDinsPdf
    })

    // Tercera passada: noms gairebé iguals (una errada d'escriptura).
    const quasi = candidats.length > 0 ? [] : ambParaules.filter(({ paraules }) => gairebeIgual(delPdfParaules, paraules))
    const finals = candidats.length > 0 ? candidats : quasi

    if (finals.length === 1 && !jaCasats.has(finals[0].alumne.id)) {
      const { alumne } = finals[0]
      casats.push({ ...a, alumneId: alumne.id, nom: alumne.nom, casatPerAproximacio: true })
      jaCasats.add(alumne.id)
    } else {
      if (finals.length > 1) {
        dubtosos.push({ nom: a.nomPdf ?? a.nom, candidats: finals.map((c) => c.alumne.nom) })
      }
      sensCasar.push(a)
    }
  }
  return { casats, sensCasar, dubtosos }
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

/**
 * La taula de comparativa per pregunta (pàgines finals de l'informe):
 * per a cada contingut avaluat, el % d'encerts de la classe i el % mitjà
 * de tots els centres d'Innovamat.
 *
 * ⚠️ Aquesta és l'ÚNICA comparativa amb Innovamat que es pot llegir del
 * PDF. La de la pàgina 4 (distribució per nivells de la regió i del
 * total) està dins d'un gràfic, com a imatge, i no en surt cap número en
 * extreure el text — aquella s'ha d'introduir a mà.
 */
export function comparativaPerPregunta(pagines) {
  const pla = pagines.join(' ').replace(/\s+/g, ' ')
  const re = /([A-Za-zÀ-ÿ][^0-9]{8,90}?)\s(\d{1,3}\.\d)\s(\d{1,3}\.\d)/g
  const files = []
  let m
  while ((m = re.exec(pla))) {
    const classe = Number(m[2])
    const global = Number(m[3])
    // Els percentatges han d'estar dins de rang; si no, és soroll.
    if (classe > 100 || global > 100) continue
    files.push({ contingut: m[1].trim(), classe, global, diferencia: Math.round((classe - global) * 10) / 10 })
  }
  return files
}
