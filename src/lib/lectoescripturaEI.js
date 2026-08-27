// Escala Teberosky de lectoescriptura d'Educació Infantil (I4 i I5), tal
// com surt a les pestanyes "I4A", "I4B", "I5A", "I5B" i "RESUM EI" de
// l'Eina d'avaluació.
//
// Es valora un sol cop l'any (maig/juny), no per trimestre — al full
// original la capçalera de cada full de classe ho diu literalment
// ("MAIG/JUNY"). No hi ha una nota ni un nivell final: per cada alumne es
// marca quins dels 18 nivells ja ha assolit, dins de cinc etapes.
//
// No és una tria única per alumne: als fulls originals cada columna és
// una casella independent, i un alumne pot tenir-ne marcades diverses a
// mesura que avança.

export const ETAPES_TEBEROSKY = [
  {
    id: 'presilabic',
    titol: 'Nivell presil·làbic',
    nivells: [
      { id: 'dibuix', label: 'Dibuix', subgrup: 'Símbols' },
      { id: 'grafismes_primitius', label: 'Grafismes primitius', subgrup: 'Símbols' },
      { id: 'escriptures_unigrafiques', label: 'Escriptures unigràfiques', subgrup: 'Símbols' },
      { id: 'repertori_fix_constant', label: 'Repertori fix amb quantitat constant', subgrup: 'Escriptures diferenciades amb predomini de grafies convencionals' },
      { id: 'repertori_fix_variable', label: 'Repertori fix amb quantitat variable', subgrup: 'Escriptures diferenciades amb predomini de grafies convencionals' },
      { id: 'repertori_variable_constant', label: 'Repertori variable amb quantitat constant', subgrup: 'Escriptures diferenciades amb predomini de grafies convencionals' },
      { id: 'repertori_variable_variable', label: 'Repertori variable amb quantitat variable', subgrup: 'Escriptures diferenciades amb predomini de grafies convencionals' },
    ],
  },
  {
    id: 'silabic',
    titol: 'Nivell sil·làbic',
    nivells: [
      { id: 'silabiques_inicials', label: 'Escriptures sil·làbiques inicials sense predomini de VSC' },
      { id: 'silabiques_estrictes', label: 'Escriptures sil·làbiques estrictes amb predomini de VSC' },
    ],
  },
  {
    id: 'silabic_alfabetic',
    titol: 'Nivell sil·làbic alfabètic',
    nivells: [
      { id: 'algun_error_vsc', label: 'Amb algun error en el VSC' },
      { id: 'amb_vsc', label: 'Amb VSC' },
    ],
  },
  {
    id: 'alfabetic',
    titol: 'Nivell alfabètic',
    nivells: [
      { id: 'paraula_omet', label: 'Omet, confon o inverteix alguna grafia', subgrup: 'Paraula' },
      { id: 'paraula_omissio_silabes', label: 'Omissió de grafia en síl·labes inverses i travades', subgrup: 'Paraula' },
      { id: 'paraula_vsc_correcte', label: 'Amb VSC correcte', subgrup: 'Paraula' },
      { id: 'frase_separa_parts', label: 'Separa parts en la frase', subgrup: 'Frase' },
      { id: 'frase_separa_totes', label: 'Separa totes les paraules en la frase', subgrup: 'Frase' },
      { id: 'frase_normes_ortografiques', label: 'Comença a utilitzar normes ortogràfiques', subgrup: 'Frase' },
    ],
  },
  {
    id: 'autocorreccio',
    titol: "S'autocorregeix",
    nivells: [
      { id: 'autocorregeix', label: "S'autocorregeix" },
    ],
  },
]

export const NIVELLS_TEBEROSKY = ETAPES_TEBEROSKY.flatMap((e) => e.nivells.map((n) => ({ ...n, etapa: e.id })))

/** Una classe d'Infantil que fa aquesta prova: només I4 i I5. El document
 *  original no té cap full per a I3 — la lectoescriptura encara no s'hi
 *  avalua amb aquesta escala. */
export function esClasseEI4o5(curs) {
  const c = (curs ?? '').trim().toUpperCase()
  return c.startsWith('I4') || c.startsWith('I5')
}

/** "I4" o "I5" a partir del nom complet de la classe ("I4 A" → "I4"). */
export function nivellEI(curs) {
  const c = (curs ?? '').trim().toUpperCase()
  if (c.startsWith('I4')) return 'I4'
  if (c.startsWith('I5')) return 'I5'
  return null
}

export function nivellsBuits() {
  return Object.fromEntries(NIVELLS_TEBEROSKY.map((n) => [n.id, false]))
}

/**
 * Equivalent a la pestanya "RESUM EI": per a un grup d'alumnes (una
 * classe, o totes les d'un nivell com "I4"), quants tenen marcat cada
 * nivell de l'escala.
 *
 * @param {string[]} alumnesIds
 * @param {Object<string, Object<string, boolean>>} marquesPerAlumne  alumneId -> { nivellId: boolean }
 */
export function comptaNivells(alumnesIds, marquesPerAlumne) {
  const comptes = Object.fromEntries(NIVELLS_TEBEROSKY.map((n) => [n.id, 0]))
  for (const id of alumnesIds) {
    const marcats = marquesPerAlumne[id] ?? {}
    for (const n of NIVELLS_TEBEROSKY) {
      if (marcats[n.id]) comptes[n.id] += 1
    }
  }
  return comptes
}

// ── Per a l'Excel i el PDF ──────────────────────────────────────────────
// Capçalera i grups (una columna per nivell, agrupades per etapa) que fan
// servir tant "exportaExcel" com "exportaPDF" de exportTaula.js.

/** ['Alumne', ...18 noms de nivell], en el mateix ordre que la graella. */
export const CAPÇALERA_EXPORT_EI = ['Alumne', ...NIVELLS_TEBEROSKY.map((n) => n.label)]

/** Una entrada per etapa, amb el seu span — la mateixa fusió que la fila
 *  de dalt de tot de la graella en pantalla ("Nivell presil·làbic", etc.). */
export const GRUPS_EXPORT_EI = ETAPES_TEBEROSKY.map((e) => ({ label: e.titol, span: e.nivells.length }))

/** Una fila per alumne: el nom i una marca ('X') per cada nivell assolit. */
export function filaAlumneExportEI(alumne, marcats) {
  return [alumne.nom, ...NIVELLS_TEBEROSKY.map((n) => (marcats[n.id] ? 'X' : ''))]
}

/**
 * Els fulls per exportar el RESUM de tota l'etapa: una fila per classe
 * amb quants alumnes han assolit cada nivell, més les files de total i
 * de percentatge del centre.
 *
 * Reprodueix el full "RESUM EI" de l'Eina d'avaluació original.
 *
 * Es construeix a partir dels recomptes JA calculats per la pantalla, no
 * de les marques en brut: així el que es baixa és exactament el que s'hi
 * veu, i no hi ha dos càlculs que es puguin desincronitzar.
 *
 * @param {Array<{classe: string, comptes: Object, total: number}>} perClasse
 */
export function fullResumEI(perClasse) {
  const files = [CAPÇALERA_RESUM_EI]

  for (const { classe, comptes, total } of perClasse) {
    files.push([classe, total, ...NIVELLS_TEBEROSKY.map((n) => comptes[n.id] ?? 0)])
  }

  const totalAlumnes = perClasse.reduce((t, c) => t + c.total, 0)
  const sumes = NIVELLS_TEBEROSKY.map((n) =>
    perClasse.reduce((t, c) => t + (c.comptes[n.id] ?? 0), 0))

  files.push(['TOTAL', totalAlumnes, ...sumes])
  files.push([
    '% del centre', '',
    ...sumes.map((v) => (totalAlumnes ? Math.round((v / totalAlumnes) * 1000) / 10 : 0)),
  ])

  return { nom: 'Resum EI', files, grups: GRUPS_RESUM_EI }
}

/** ['Classe', 'Alumnes', ...18 nivells] */
export const CAPÇALERA_RESUM_EI = ['Classe', 'Alumnes', ...NIVELLS_TEBEROSKY.map((n) => n.label)]

/** Les etapes fusionades a sobre de les seves columnes. Les dues primeres
 *  columnes (classe i alumnes) queden fora dels grups: `exportaTaula`
 *  dedueix quantes en són d'índex restant els spans del total. */
export const GRUPS_RESUM_EI = ETAPES_TEBEROSKY.map((e) => ({ label: e.titol, span: e.nivells.length }))
