import { normalitza } from './text'
import { CRITERIS_TEE } from './rubricaTEE'

const PARAULES_CRITERI = {
  coherencia: ['coherencia'],
  lexic: ['lexic'],
  presentacio: ['presentacio'],
  ortografia: ['ortografia'],
  morfosintaxis: ['morfosintaxi', 'morfosintaxis', 'morfosintactica', 'morfosintactic'],
}

function paraulesNivell(cicle) {
  if (cicle === 'EI') {
    return { expert: ['expert'], avancat: ['avancat'], aprenent: ['aprenent'] }
  }
  return {
    ae: ['excellent', "excel lent", 'excel·lent'],
    an: ['notable'],
    as: ['satisfactori'],
    na: ['no assoliment', 'noassoliment', 'insuficient'],
  }
}

/**
 * Interpreta un dictat del tipus "Alumne 1 notable, alumne 2 excel·lent..."
 * per a mòduls on cada alumne només té UN nivell (no diversos criteris com
 * TEE). Retorna { [numLlista]: nivellId }.
 */
export function interpretaDictatNivellUnic(transcripcio) {
  const text = normalitza(transcripcio)
  const nivellsParaules = paraulesNivell('primaria') // ae/an/as/na (no és EI)
  const CURT_A_ID = {
    ae: 'assoliment_excel·lent',
    an: 'assoliment_notable',
    as: 'assoliment_satisfactori',
    na: 'no_assoliment',
  }

  const marques = [...text.matchAll(/alumne\s+(?:numero\s+)?(\d+)/g)]
  if (marques.length === 0) return {}

  const resultat = {}
  marques.forEach((marca, i) => {
    const numLlista = Number(marca[1])
    const inici = marca.index + marca[0].length
    const fi = i + 1 < marques.length ? marques[i + 1].index : text.length
    const segment = text.slice(inici, fi)

    for (const [curt, paraules] of Object.entries(nivellsParaules)) {
      if (paraules.some((p) => segment.includes(p))) {
        resultat[numLlista] = CURT_A_ID[curt]
        break
      }
    }
  })
  return resultat
}

/**
 * Interpreta un dictat del tipus "Alumne 1 coherència notable lèxic
 * excel·lent... Alumne 2 coherència..." i el converteix en notes
 * estructurades per número de llista (no per nom), perquè el mestre no
 * hagi de dir cap nom en veu alta.
 *
 * Retorna { [numLlista]: { coherencia: 'an', lexic: 'ae', ... } }
 */
export function interpretaDictatTEE(transcripcio, cicle) {
  const text = normalitza(transcripcio)
  const nivellsParaules = paraulesNivell(cicle)

  // Troba totes les posicions "alumne N" al text.
  const marques = [...text.matchAll(/alumne\s+(?:numero\s+)?(\d+)/g)]
  if (marques.length === 0) return {}

  const resultat = {}

  marques.forEach((marca, i) => {
    const numLlista = Number(marca[1])
    const inici = marca.index + marca[0].length
    const fi = i + 1 < marques.length ? marques[i + 1].index : text.length
    const segment = text.slice(inici, fi)

    const notesAlumne = {}

    // Per cada criteri, busca on apareix dins del segment, i quin nivell
    // es diu més a prop just després.
    const posicionsCriteri = CRITERIS_TEE
      .map((c) => {
        const paraules = PARAULES_CRITERI[c.id]
        let millorPos = -1
        for (const p of paraules) {
          const idx = segment.indexOf(p)
          if (idx !== -1 && (millorPos === -1 || idx < millorPos)) millorPos = idx
        }
        return { id: c.id, pos: millorPos }
      })
      .filter((c) => c.pos !== -1)
      .sort((a, b) => a.pos - b.pos)

    posicionsCriteri.forEach((criteri, idx) => {
      const finsA = idx + 1 < posicionsCriteri.length ? posicionsCriteri[idx + 1].pos : segment.length
      const tros = segment.slice(criteri.pos, finsA)
      for (const [nivellId, paraules] of Object.entries(nivellsParaules)) {
        if (paraules.some((p) => tros.includes(p))) {
          notesAlumne[criteri.id] = nivellId
          break
        }
      }
    })

    if (Object.keys(notesAlumne).length > 0) {
      resultat[numLlista] = notesAlumne
    }
  })

  return resultat
}
