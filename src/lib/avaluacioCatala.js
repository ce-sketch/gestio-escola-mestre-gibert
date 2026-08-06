export const NIVELLS = [
  { id: 'no_assoliment', label: 'No Assoliment', curt: 'NA', color: 'var(--red)', ordre: 0 },
  { id: 'assoliment_satisfactori', label: 'Assoliment Satisfactori', curt: 'AS', color: 'var(--amber-dark)', ordre: 1 },
  { id: 'assoliment_notable', label: 'Assoliment Notable', curt: 'AN', color: 'var(--navy)', ordre: 2 },
  { id: 'assoliment_excel·lent', label: 'Assoliment Excel·lent', curt: 'AE', color: 'var(--green)', ordre: 3 },
]

export function nivellPerId(id) {
  return NIVELLS.find((n) => n.id === id) ?? null
}

/**
 * Tradueix una nota numèrica (0-10) al nivell qualitatiu de 4 bandes.
 * ATENCIÓ: aquests llindars són un punt de partida raonable, no els
 * criteris oficials del centre — ajusta'ls a "Configuració" si calen
 * uns altres.
 */
export function nivellDe(nota) {
  if (nota === null || nota === undefined || Number.isNaN(nota)) return null
  if (nota < 5) return NIVELLS[0]
  if (nota < 7) return NIVELLS[1]
  if (nota < 8.5) return NIVELLS[2]
  return NIVELLS[3]
}

/** Es queda amb el registre més recent per cada combinació de clau (per
 *  exemple alumne+trimestre, o alumne+moment), igual que a Assistència:
 *  una correcció posterior sempre substitueix la marca anterior. */
export function redueixVigents(registres, clauDe) {
  const mapa = new Map()
  for (const r of registres) {
    const clau = clauDe(r)
    const existent = mapa.get(clau)
    if (!existent || (r.creatEl?.seconds ?? 0) > (existent.creatEl?.seconds ?? 0)) {
      mapa.set(clau, r)
    }
  }
  return [...mapa.values()]
}
