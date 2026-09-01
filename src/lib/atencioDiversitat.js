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

/** El primer criteri de la llegenda que compleix un alumne, o null si no
 *  en compleix cap. */
export function criteriDiversitat(alumne) {
  return LLEGENDA_DIVERSITAT.find((c) => c.compleix(alumne)) ?? null
}

/** El color de fons per a la fila d'un alumne, o null si no en té. */
export function colorDiversitat(alumne) {
  return criteriDiversitat(alumne)?.color ?? null
}
