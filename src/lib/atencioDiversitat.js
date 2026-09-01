import { useState } from 'react'

// Llegenda de colors d'Atenció a la diversitat, per aplicar-la a les
// pantalles d'entrada de notes (TEE, VL/CL, Lectoescriptura) — que un
// alumne surti destacat no depèn de res que es calculi aquí, sinó
// directament dels camps que ja es desen a cada alumne en pujar el
// llistat (`pi`, `adTipusA`, `adTipusC`) i el SIEI (`siei`, del document
// a part "14b. Alumnes NESE").
//
// Un alumne pot complir més d'un criteri alhora (per exemple, tenir PI i
// ser Nouvingut): com que a la taula només hi cap un color per fila, es
// fa servir l'ordre de la llegenda com a prioritat — el primer criteri
// que compleixi és el que es veu. "TCA" es deixa pendent (encara no se
// sap d'on ha de sortir la dada) i no hi entra.
export const LLEGENDA_DIVERSITAT = [
  { id: 'siei', label: 'Alumnat SIEI', color: '#FF0000', compleix: (a) => Boolean(a?.siei) },
  { id: 'neeA', label: 'Alumnat amb reconeixement NEE A, no SIEI', color: '#C0504D', compleix: (a) => Boolean(a?.adTipusA) && !a?.siei },
  { id: 'pi', label: 'Alumnat amb PI', color: '#FF00FF', compleix: (a) => Boolean(a?.pi) },
  { id: 'nouvingut', label: 'Nouvingut', color: '#00FF00', compleix: (a) => Boolean(a?.adTipusC) },
]

/**
 * El primer criteri de la llegenda que compleix un alumne, o null si no
 * en compleix cap.
 *
 * @param {*} alumne
 * @param {Set<string>|null} actius si es passa, només es tenen en compte
 *   els criteris amb l'id dins d'aquest conjunt — és el que fa que
 *   desactivar una entrada de la llegenda deixi de pintar-la, sense
 *   tocar les dades de l'alumne. `null` (per defecte) vol dir "tots".
 */
export function criteriDiversitat(alumne, actius = null) {
  const criteris = actius ? LLEGENDA_DIVERSITAT.filter((c) => actius.has(c.id)) : LLEGENDA_DIVERSITAT
  return criteris.find((c) => c.compleix(alumne)) ?? null
}

/** El color de fons per a la fila d'un alumne, o null si no en té.
 *  Mateix paràmetre `actius` que `criteriDiversitat`. */
export function colorDiversitat(alumne, actius = null) {
  return criteriDiversitat(alumne, actius)?.color ?? null
}

/** Quins criteris de la llegenda estan actius (es pinten) o no, amb un
 *  `toggle` per activar/desactivar-ne un des del clic a la llegenda.
 *  Tots actius per defecte. Cada pantalla en fa servir la seva pròpia
 *  instància (no és un estat compartit entre TEE/Lectura/Lectoescriptura). */
export function useActiusDiversitat() {
  const [actius, setActius] = useState(() => new Set(LLEGENDA_DIVERSITAT.map((c) => c.id)))
  function toggle(id) {
    setActius((prev) => {
      const nou = new Set(prev)
      if (nou.has(id)) nou.delete(id)
      else nou.add(id)
      return nou
    })
  }
  return { actius, toggle }
}
