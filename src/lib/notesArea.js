import { normalitza } from './text'
import { paraulesNivell } from './dictatTEE'

// Àrees generals per fer el seguiment de notes de tot el centre, tal com
// apareixen a la graella "Nota mitjana d'àrea" (full "Àrees no superades" i
// fulls "Resum" per trimestre). No totes les àrees s'apliquen a tots els
// cursos (per exemple, "science" només a partir de 3r) — el mòdul permet
// deixar en blanc les que no calguin per a una classe concreta; una
// casella en blanc es tracta igual que a l'Excel: "no avaluat".
export const AREES = [
  { id: 'catala', label: 'Català' },
  { id: 'castella', label: 'Castellà' },
  { id: 'angles', label: 'Anglès' },
  { id: 'matematiques', label: 'Matemàtiques' },
  { id: 'medi', label: 'Medi' },
  { id: 'science', label: 'Science' },
  // No té notes pròpies. Al full, la "GF" de Medi surt de fer primer la
  // mitjana de Medi Natural i Science, i després la mitjana d'això amb
  // Medi Social — però Medi Social no és una àrea pròpia a l'app (es fa
  // servir "Medi" per al conjunt de Natural+Social junts). Per això aquí
  // ens quedem amb el primer pas: la mitjana de Medi i Science, que és
  // exactament la peça que l'app pot calcular amb el que ja té.
  //
  // Només a partir de 3r, com Science (vegeu AREES_NOMES_CURSOS).
  { id: 'medi_global', label: 'Medi (global)', calculada: true, deArees: ['medi', 'science'] },
  { id: 'plastica', label: 'Plàstica' },
  { id: 'musica', label: 'Música' },
  // No té notes pròpies: al full és un títol de grup ("ARTÍSTICA") que la
  // seva columna "GF" calcula fent la mitjana de les Finals de Plàstica i
  // de Música. Aquí és una àrea més a la taula, però no editable — es
  // reconeix per `calculada`.
  { id: 'artistica', label: 'Artística', calculada: true, deArees: ['plastica', 'musica'] },
  { id: 'efisica', label: 'Ed. Física' },
  { id: 'religio', label: 'Religió' },
  { id: 'valors', label: 'Valors' },
]

// Algunes àrees només s'avaluen a determinats cursos (per exemple, "Valors"
// com a àrea diferenciada de Religió només existeix a 5è, segons l'Excel
// de referència). Si una àrea no hi surt en aquest mapa, s'aplica a tots
// els cursos. La clau del mapa és el primer dígit del nom de la classe
// ("5" per a "5A"/"5B").
const AREES_NOMES_CURSOS = {
  valors: ['5'],
  science: ['3', '4', '5', '6'],
  medi_global: ['3', '4', '5', '6'],
}

/** Diu si una àrea s'ha de mostrar per a una classe concreta (p. ex. "5A"). */
export function areaAplicaAClasse(areaId, classe) {
  const restriccio = AREES_NOMES_CURSOS[areaId]
  if (!restriccio) return true
  if (!classe) return true
  return restriccio.includes(classe.trim()[0])
}

export const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']

/**
 * La nota final d'una àrea: la mitjana només dels trimestres on l'alumne
 * ja té nota, no la mitjana forçada dels tres.
 *
 * Al full de càlcul original la fórmula del final només es dispara quan
 * el 3r trimestre ja té nota (`=IF(F3="","",AVERAGE(D3:F3))`), i deixa la
 * cel·la buida durant tot el curs fins llavors. Aquí es fa la mitjana dels
 * trimestres que hi hagi, encara que en falti algun — així la nota final
 * es pot consultar en qualsevol moment del curs, no només al juny.
 *
 * @param {Array<number|''|null|undefined>} notes  els 3 valors, en ordre de trimestre
 */
export function notaFinalArea(notes) {
  const omplertes = (notes ?? []).filter((n) => n !== '' && n !== null && n !== undefined).map(Number)
  if (omplertes.length === 0) return null
  const mitjana = omplertes.reduce((a, b) => a + b, 0) / omplertes.length
  return Math.round(mitjana * 10) / 10
}

// --- Dictat per veu ---

const CURT_A_ID = {
  ae: 'assoliment_excel·lent',
  an: 'assoliment_notable',
  as: 'assoliment_satisfactori',
  na: 'no_assoliment',
}

// Paraules que ha de dir el mestre per referir-se a cada àrea. La clau ha
// de coincidir amb l'id de AREES.
const PARAULES_AREA = {
  catala: ['catala'],
  castella: ['castella'],
  angles: ['angles'],
  matematiques: ['matematiques', 'mates'],
  medi: ['medi'],
  science: ['science'],
  plastica: ['plastica'],
  musica: ['musica'],
  efisica: ['educacio fisica', 'ed fisica', 'efisica', 'gimnastica'],
  religio: ['religio', 'valors'],
}

/**
 * Interpreta un dictat del tipus "Alumne 3 català notable, matemàtiques
 * excel·lent, alumne 7 castellà satisfactori..." — cada alumne pot portar
 * diverses àrees seguides. Retorna { [numLlista]: { [areaId]: nivellId } }.
 */
export function interpretaDictatNotesArea(transcripcio) {
  const text = normalitza(transcripcio)
  const nivellsParaules = paraulesNivell('primaria')

  const marques = [...text.matchAll(/alumne\s+(?:numero\s+)?(\d+)/g)]
  if (marques.length === 0) return {}

  const resultat = {}

  marques.forEach((marca, i) => {
    const numLlista = Number(marca[1])
    const inici = marca.index + marca[0].length
    const fi = i + 1 < marques.length ? marques[i + 1].index : text.length
    const segment = text.slice(inici, fi)

    const notesAlumne = {}

    const posicionsArea = AREES
      .map((a) => {
        const paraules = PARAULES_AREA[a.id] ?? [a.label.toLowerCase()]
        let millorPos = -1
        for (const p of paraules) {
          const idx = segment.indexOf(p)
          if (idx !== -1 && (millorPos === -1 || idx < millorPos)) millorPos = idx
        }
        return { id: a.id, pos: millorPos }
      })
      .filter((a) => a.pos !== -1)
      .sort((a, b) => a.pos - b.pos)

    posicionsArea.forEach((area, idx) => {
      const finsA = idx + 1 < posicionsArea.length ? posicionsArea[idx + 1].pos : segment.length
      const tros = segment.slice(area.pos, finsA)
      for (const [curt, paraules] of Object.entries(nivellsParaules)) {
        if (paraules.some((p) => tros.includes(p))) {
          notesAlumne[area.id] = CURT_A_ID[curt]
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
