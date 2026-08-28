import { senseAccents } from './text'
// Lector dels CSV de resultats del COSMOS (Innovamat).
//
// Cada curs, l'Innovamat envia un CSV per classe amb els resultats de la
// prova inicial i la final. La capçalera té aquesta forma:
//
//   Nom, Cognoms, Resultat de la intervenció, Mitjana setmanal de sessions…
//   Data del COSMOS inicial, COSMOS inicial completat, Fiabilitat…,
//   Puntuació habilitats numèriques COSMOS inicial,
//   Rendiment habilitats numèriques COSMOS inicial,
//   Percentil <dimensió> COSMOS inicial, Rendiment <dimensió> COSMOS inicial,
//   … i el mateix bloc repetit per al COSMOS final.
//
// El lector **no dona per fetes ni les dimensions ni el seu ordre**: les
// dedueix de la capçalera. Si l'Innovamat n'afegeix una de nova o li canvia
// el nom, aquí surt igualment i no cal tocar codi.

/** Divideix una línia de CSV respectant les cometes. */
function separaLinia(linia) {
  const camps = []
  let actual = ''
  let dinsCometes = false
  for (let i = 0; i < linia.length; i++) {
    const c = linia[i]
    if (c === '"') {
      if (dinsCometes && linia[i + 1] === '"') { actual += '"'; i++ }
      else dinsCometes = !dinsCometes
    } else if (c === ',' && !dinsCometes) {
      camps.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  camps.push(actual)
  return camps.map((c) => c.trim())
}

/** L'apòstrof tipogràfic i l'espai final que porten alguns encapçalaments. */
const neteja = (t) => String(t ?? '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

/** "fluïdesa aritmètica" → "fluidesa_aritmetica". Sense treure els accents
 *  abans, quedaria "flu_desa_arit_tica" i seria il·legible. */
function aIdentificador(text) {
  return senseAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const MOMENTS = [
  { id: 'inicial', label: 'COSMOS inicial' },
  { id: 'final', label: 'COSMOS final' },
]

/**
 * Llegeix el CSV i en treu els alumnes amb els seus resultats.
 *
 * @param {string} text  el contingut del fitxer
 * @returns {{alumnes: Array, dimensions: Array, avisos: string[]}}
 */
export function llegeixCosmos(text) {
  const linies = String(text).split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linies.length < 2) throw new Error('El fitxer no té cap fila de dades.')

  const capcalera = separaLinia(linies[0]).map(neteja)
  const avisos = []

  const indexDe = (patro) => capcalera.findIndex((c) => patro.test(c))
  const iNom = indexDe(/^nom$/i)
  const iCognoms = indexDe(/^cognoms$/i)
  if (iNom === -1 || iCognoms === -1) {
    throw new Error("No hi ha les columnes \"Nom\" i \"Cognoms\": segur que és un CSV del COSMOS?")
  }

  // ── Quines dimensions hi ha ─────────────────────────────────────────
  // Es dedueixen dels encapçalaments "Percentil <dimensió> COSMOS <moment>".
  const dimensions = []
  for (const columna of capcalera) {
    const m = columna.match(/^Percentil (.+) COSMOS (inicial|final)$/i)
    if (!m) continue
    const nom = m[1].trim()
    if (!dimensions.some((d) => d.nom === nom)) {
      dimensions.push({ id: aIdentificador(nom), nom })
    }
  }
  if (dimensions.length === 0) {
    avisos.push("No he trobat cap columna de percentils: el CSV deu tenir un format diferent del que conec.")
  }

  // ── Els alumnes ─────────────────────────────────────────────────────
  const alumnes = []
  for (let i = 1; i < linies.length; i++) {
    const camps = separaLinia(linies[i])
    const nom = camps[iNom]?.trim()
    const cognoms = camps[iCognoms]?.trim()
    if (!nom && !cognoms) continue

    const valor = (patro) => {
      const idx = capcalera.findIndex((c) => patro.test(c))
      const v = idx === -1 ? '' : (camps[idx] ?? '').trim()
      return v === '' ? null : v
    }
    const numero = (patro) => {
      const v = valor(patro)
      if (v === null) return null
      const n = Number(String(v).replace(',', '.'))
      return Number.isNaN(n) ? null : n
    }

    const moments = {}
    for (const moment of MOMENTS) {
      const sufix = moment.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      moments[moment.id] = {
        data: valor(new RegExp(`^Data del ${sufix}$`, 'i')),
        completat: /^s[íi]$/i.test(valor(new RegExp(`^${sufix} completat$`, 'i')) ?? ''),
        fiabilitat: valor(new RegExp(`^Fiabilitat dels resultats del ${sufix}$`, 'i')),
        puntuacio: numero(new RegExp(`^Puntuació habilitats numèriques ${sufix}$`, 'i')),
        rendiment: valor(new RegExp(`^Rendiment habilitats numèriques ${sufix}$`, 'i')),
        dimensions: Object.fromEntries(dimensions.map((d) => {
          const nomEscapat = d.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return [d.id, {
            percentil: numero(new RegExp(`^Percentil ${nomEscapat} ${sufix}$`, 'i')),
            rendiment: valor(new RegExp(`^Rendiment ${nomEscapat} ${sufix}$`, 'i')),
          }]
        })),
      }
    }

    alumnes.push({
      nom,
      cognoms,
      nomComplet: `${cognoms}, ${nom}`.replace(/^,\s*|,\s*$/g, ''),
      intervencio: valor(/^Resultat de la intervenció$/i),
      sessionsSetmanals: numero(/^Mitjana setmanal de sessions/i),
      // Igual que al ConMat: qui no ha completat la prova final consta
      // igualment al CSV, però amb totes les columnes de resultats
      // buides. Es desa perquè els totals quadrin amb l'Excel del centre,
      // marcat perquè no compti als percentatges de rendiment — un alumne
      // sense resultat no es pot classificar en cap nivell.
      noAvaluat: !moments.final.completat,
      moments,
    })
  }

  const noAvaluats = alumnes.filter((a) => a.noAvaluat)
  if (noAvaluats.length > 0) {
    avisos.push(
      `${noAvaluats.length} alumne${noAvaluats.length === 1 ? '' : 's'} no ${noAvaluats.length === 1 ? 'té' : 'tenen'} `
      + `la prova final completada (${noAvaluats.map((a) => a.nomComplet).join(', ')}). `
      + "Es desaran igualment perquè els totals quadrin amb l'Excel del centre, però no compten als percentatges de rendiment."
    )
  }
  const noFiables = alumnes.filter((a) => /no fiables/i.test(a.moments.final.fiabilitat ?? '')).length
  if (noFiables > 0) {
    avisos.push(`${noFiables} alumnes tenen la prova final marcada com a "resultats no fiables".`)
  }

  return { alumnes, dimensions, avisos }
}

/**
 * Tregui la classe del nom del fitxer: "resultats_cosmos_pre_post_1rA.csv"
 * → "1rA".
 *
 * Aquí sí que ens hi podem fiar, al contrari del ConMat: l'Innovamat
 * anomena igual els PDF de dues classes d'un mateix nivell (només els
 * distingeix el "(1)" del Drive), però als CSV del COSMOS la classe va
 * escrita al nom. Com que el CSV no la porta a dins enlloc, és l'única
 * font que en tenim.
 *
 * Torna `null` si no la reconeix, per no endevinar-la.
 */
export function classeDeNomFitxer(nomFitxer) {
  const net = String(nomFitxer ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/\s/g, '')
  return net.match(/(\d+(?:r|n|t|rt|è|e)?[A-D])$/i)?.[1] ?? null
}

/** L'escala de rendiment que fa servir l'Innovamat, passada a percentatge
 *  per poder-la barrejar amb la resta d'indicadors de l'app. */
export const RENDIMENT = [
  { id: 'baix', label: 'Baix', valor: 33 },
  { id: 'mitja', label: 'Mitjà', valor: 66 },
  { id: 'alt', label: 'Alt', valor: 100 },
]

export function rendimentAPercentatge(text) {
  if (!text) return null
  const net = neteja(text).toLowerCase()
  return RENDIMENT.find((r) => r.label.toLowerCase() === net)?.valor ?? null
}

/**
 * Resum d'una classe: quants alumnes hi ha a cada nivell de rendiment, i
 * com ha evolucionat entre la prova inicial i la final.
 *
 * Els alumnes que no van fer la prova final (`noAvaluat`) no compten al
 * `total` ni als recomptes de rendiment, però es recompten a part
 * (`noAvaluats`). `totalGeneral` és la xifra que ha de quadrar amb
 * l'Excel del centre: avaluats + no avaluats.
 */
export function resumClasse(alumnes) {
  const avaluats = (alumnes ?? []).filter((a) => a && !a.noAvaluat)
  const compta = (moment) => {
    const recompte = { alt: 0, mitja: 0, baix: 0, sense: 0 }
    for (const a of avaluats) {
      const r = neteja(a.moments[moment]?.rendiment ?? '').toLowerCase()
      if (r === 'alt') recompte.alt++
      else if (r === 'mitjà' || r === 'mitja') recompte.mitja++
      else if (r === 'baix') recompte.baix++
      else recompte.sense++
    }
    return recompte
  }

  const ambTotesDues = avaluats.filter(
    (a) => a.moments.inicial?.puntuacio !== null && a.moments.final?.puntuacio !== null
  )
  const milloren = ambTotesDues.filter((a) => a.moments.final.puntuacio > a.moments.inicial.puntuacio).length

  return {
    total: avaluats.length,
    noAvaluats: (alumnes ?? []).length - avaluats.length,
    totalGeneral: (alumnes ?? []).length,
    inicial: compta('inicial'),
    final: compta('final'),
    ambTotesDues: ambTotesDues.length,
    milloren,
    guanyMitja: ambTotesDues.length === 0 ? null : Math.round(
      (ambTotesDues.reduce((t, a) => t + (a.moments.final.puntuacio - a.moments.inicial.puntuacio), 0)
        / ambTotesDues.length) * 100
    ) / 100,
  }
}
