// Ordre pedagògic de les classes (Infantil → 6è), no alfabètic: "1r"
// hauria de sortir abans que "2n", i "I4"/"I5" abans que "1r" — cosa que
// un simple localeCompare no fa bé. Els fulls que arriben del centre fan
// servir tant "I4"/"I5" com "P4"/"P5" segons el document, així que es
// reconeixen els dos.
const ORDRE_NIVELL = ['i3', 'i4', 'i5', 'p3', 'p4', 'p5', '1r', '2n', '3r', '4t', '5e', '6e']

function normalitzaNivell(s) {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** [índex de nivell (99 si no es reconeix), resta del nom (classe A/B/C)] */
export function clauCurs(curs) {
  const net = (curs ?? '').trim()
  const m = net.match(/^(\S+)\s*(.*)$/)
  if (!m) return [99, '']
  const idx = ORDRE_NIVELL.indexOf(normalitzaNivell(m[1]))
  return [idx === -1 ? 99 : idx, (m[2] ?? '').toUpperCase()]
}

export function comparaCursos(a, b) {
  const [ia, la] = clauCurs(a)
  const [ib, lb] = clauCurs(b)
  return ia - ib || la.localeCompare(lb)
}
