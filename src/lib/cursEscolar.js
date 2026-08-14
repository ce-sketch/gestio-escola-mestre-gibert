export function cursEscolarActual() {
  const avui = new Date()
  const any = avui.getMonth() >= 7 ? avui.getFullYear() : avui.getFullYear() - 1
  return `${any}-${(any + 1).toString().slice(2)}`
}

export function cursSeguent(cursId) {
  const [anyIniciStr] = cursId.split('-')
  const any = Number(anyIniciStr) + 1
  return `${any}-${(any + 1).toString().slice(2)}`
}

// Nivells escolars (agrupant les classes A/B d'un mateix curs), en l'ordre
// en què s'han de mostrar. Cada classe (p. ex. "1A", "1B") pertany al
// nivell amb el mateix primer dígit.
export const NIVELLS_ESCOLARS = [
  { id: '1', label: '1r' },
  { id: '2', label: '2n' },
  { id: '3', label: '3r' },
  { id: '4', label: '4t' },
  { id: '5', label: '5è' },
  { id: '6', label: '6è' },
]

/** Retorna el nivell escolar ("1r", "2n"...) a partir del nom de la classe
 *  ("1A", "1B"...). Agrupa totes les classes paral·leles d'un mateix curs. */
export function nivellEscolarDe(curs) {
  if (!curs) return null
  const digit = curs.trim()[0]
  return NIVELLS_ESCOLARS.find((n) => n.id === digit)?.label ?? curs
}

/** El nom que es posa per defecte a una còpia: la data i l'hora d'ara,
 *  perquè es pugui distingir de les altres sense haver-hi de pensar. */
export function nomAmbData(ara = new Date()) {
  const data = ara.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = ara.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })
  return `Còpia del ${data} a les ${hora}`
}
