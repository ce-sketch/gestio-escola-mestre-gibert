import { grauPrimaria } from './rubricaLectura'

// Ponderació de la qualificació de l'àmbit lingüístic (català i castellà),
// extreta del quadre informatiu que porta cada pestanya de classe del full
// "Nota mitjana d'àrea" del centre (secció "Ponderació qualificació de
// l'àmbit lingüístic"). Canvia per nivell:
//   - 1r: tres períodes diferents, un per trimestre
//   - 2n: dos períodes — el 1r trimestre sol, i 2n+3r junts
//   - 3r a 6è: un sol període per a tot el curs (les tres avaluacions es
//     ponderen igual)
//
// Els percentatges es guarden tal com surten al full (text, no número):
// "Comprensió lectora" no és mai un sol percentatge net, sinó una
// combinació ("30% (CL)+10% lect."), i convertir-ho a número ara mateix
// no aportaria res — la pantalla només l'ha de mostrar, no calcular-la
// (vegeu la nota de dalt de tot sobre el càlcul automàtic, pendent).
//
// ⚠️ De moment estan escrites aquí al codi. Si el centre les canvia,
// caldrà tornar a demanar-me el canvi — encara no hi ha cap pantalla per
// editar-les des de l'app (vegeu la capçalera del fitxer per a la resta
// del pla).
const TAULA_1R = {
  periodes: [
    { id: '1r trimestre', comunicacioOral: '40%', expressioEscrita: '20%', comprensioLectora: '30%' },
    { id: '2n trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30%' },
    { id: '3r trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30% (CL) + 10% lect.' },
  ],
}
const TAULA_2N = {
  periodes: [
    { id: '1r trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30% (CL) + 10% lect.' },
    { id: '2n i 3r trimestre', comunicacioOral: '20%', expressioEscrita: '40%', comprensioLectora: '30% (CL) + 10% lect.' },
  ],
}
// 3r a 6è: mateixos percentatges tots quatre nivells, un sol període.
const TAULA_3R_A_6E = {
  periodes: [
    { id: 'Tot el curs', comunicacioOral: '20%', expressioEscrita: '40%', comprensioLectora: '30% (CL) + 10% lect.' },
  ],
}

/**
 * La taula de ponderació que toca a una classe, segons el seu nivell
 * (1r, 2n, o 3r-6è). Torna `null` per a Infantil o per a un nom de
 * classe no reconegut — allà no hi ha cap taula d'àmbit lingüístic.
 */
export function taulaPonderacioLlengua(curs) {
  const grau = grauPrimaria(curs)
  if (grau === 1) return TAULA_1R
  if (grau === 2) return TAULA_2N
  if (grau >= 3 && grau <= 6) return TAULA_3R_A_6E
  return null
}
