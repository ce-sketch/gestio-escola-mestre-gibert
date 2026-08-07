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
  { id: 'plastica', label: 'Plàstica' },
  { id: 'musica', label: 'Música' },
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
}

/** Diu si una àrea s'ha de mostrar per a una classe concreta (p. ex. "5A"). */
export function areaAplicaAClasse(areaId, classe) {
  const restriccio = AREES_NOMES_CURSOS[areaId]
  if (!restriccio) return true
  if (!classe) return true
  return restriccio.includes(classe.trim()[0])
}

export const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']
