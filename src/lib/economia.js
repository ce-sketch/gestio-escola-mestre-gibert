// Constants i càlculs del mòdul "Economia" (aportacions de les famílies),
// basats en la plantilla oficial "Seguiment_Aportacions_Famílies" del
// Departament d'Educació.

export const ENSENYAMENTS = ['Infantil', 'Primària', 'ESO', 'Batxillerat', 'CFGB', 'CFGM', 'CFGS', 'Altres']

// Llista de "curs" genèrica (coincideix amb el full "Llistes" de la
// plantilla oficial) — es combina lliurement amb l'Ensenyament.
export const CURSOS = ['1r', '2n', '3r', '4t', '5è', '6è']

// Els 8 conceptes de la plantilla oficial, amb el mateix ordre i noms.
export const CONCEPTES = [
  { id: 'materialEscolar', label: 'Material escolar' },
  { id: 'activitatsComplementaries', label: 'Activitats complementàries sense pernoctació' },
  { id: 'viatgesColonies', label: 'Viatges/colònies' },
  { id: 'llibresText', label: 'Llibres de text' },
  { id: 'socialitzacioLlibres', label: 'Socialització de llibres' },
  { id: 'serveisInformatics', label: 'Serveis informàtics' },
  { id: 'importsAFA', label: 'Imports a transferir a l\'AFA' },
  { id: 'altresIngressos', label: 'Altres ingressos' },
]

/** Estructura buida d'un concepte (els 4 camps que demana la plantilla). */
export function conceptaBuit() {
  return { importUnitari: '', reduccio: '', cobratAny1: '', cobratAny2: '' }
}

/** Estructura buida d'una fila (Ensenyament + Curs). */
export function filaBuida(ensenyament = '', curs = '') {
  const conceptes = {}
  for (const c of CONCEPTES) conceptes[c.id] = conceptaBuit()
  return { ensenyament, curs, detall: '', numAlumnes: '', conceptes }
}

/** Total d'un concepte per a una fila: Núm.alumnes × Import unitari − Reducció.
 *  Exactament la mateixa fórmula que la plantilla oficial. */
export function totalConcepte(numAlumnes, concepte) {
  const n = Number(numAlumnes) || 0
  const imp = Number(concepte?.importUnitari) || 0
  const red = Number(concepte?.reduccio) || 0
  return n * imp - red
}

/** Total de TOTS els conceptes d'una fila. */
export function totalFila(fila) {
  return CONCEPTES.reduce((acc, c) => acc + totalConcepte(fila.numAlumnes, fila.conceptes[c.id]), 0)
}

/** Suma de "cobrat" (any1+any2) de tots els conceptes d'una fila. */
export function totalCobratFila(fila) {
  return CONCEPTES.reduce((acc, c) => {
    const concepte = fila.conceptes[c.id]
    return acc + (Number(concepte?.cobratAny1) || 0) + (Number(concepte?.cobratAny2) || 0)
  }, 0)
}
