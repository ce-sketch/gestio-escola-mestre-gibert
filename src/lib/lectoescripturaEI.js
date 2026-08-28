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
  // Una classe sense document desat encara no té marques: ha de tornar
  // tots els nivells a zero, no petar.
  marquesPerAlumne = marquesPerAlumne ?? {}
  const comptes = Object.fromEntries(NIVELLS_TEBEROSKY.map((n) => [n.id, 0]))
  for (const id of alumnesIds ?? []) {
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
  perClasse = (perClasse ?? []).filter((c) => c && c.comptes)
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

/** L'id del document de configuració d'un curs. No pot xocar amb el
 *  d'una classe: cap classe no es diu "config". */
export const idConfigEI = (cursEscolar) => `${cursEscolar}__config`

/** Si un document de la col·lecció és el de configuració i no una classe. */
export const esConfigEI = (doc) => doc?.tipus === 'config' || /__config$/.test(doc?.id ?? '')

/**
 * L'històric: una fila per curs escolar i classe, a partir dels
 * documents desats de tots els cursos.
 *
 * ⚠️ El total d'alumnes surt del PROPI document, no de la llista
 * d'alumnes actius: els de fa tres cursos ja no hi són. Això vol dir que
 * només s'hi compten els alumnes que tenen alguna casella marcada — que
 * és l'únic que es pot saber mirant enrere, i per això la columna es diu
 * "amb dades" i no "alumnes".
 *
 * @param {Array<{cursEscolar: string, classe: string, alumnes: object}>} documents
 */
export function historicEI(documents) {
  const files = (documents ?? [])
    // El document de configuració no porta classe, així que ja quedaria
    // fora; es descarta expressament perquè es vegi que és a posta.
    .filter((d) => d && !esConfigEI(d) && d.cursEscolar && d.classe)
    .map((d) => {
      const ids = Object.keys(d.alumnes ?? {})
      return {
        cursEscolar: d.cursEscolar,
        classe: d.classe,
        ambDades: ids.length,
        comptes: comptaNivells(ids, d.alumnes ?? {}),
      }
    })

  // Del curs més recent al més antic, i dins de cada curs per classe.
  files.sort((a, b) =>
    String(b.cursEscolar).localeCompare(String(a.cursEscolar))
    || String(a.classe).localeCompare(String(b.classe), 'ca'))
  return files
}

/** Els fulls per exportar l'històric sencer. */
export function fullHistoricEI(files) {
  files = (files ?? []).filter(Boolean)
  const capçalera = ['Curs', 'Classe', 'Amb dades', ...NIVELLS_TEBEROSKY.map((n) => n.label)]
  const cos = files.map((f) => [
    f.cursEscolar, f.classe, f.ambDades,
    ...NIVELLS_TEBEROSKY.map((n) => f.comptes[n.id] ?? 0),
  ])
  return { nom: 'Històric EI', files: [capçalera, ...cos] }
}

// ── Quines classes fan la prova ────────────────────────────────────────
//
// Quines classes passen la lectoescriptura canvia d'un curs a l'altre:
// ara mateix només la fa I5, però I4 la pot començar a fer en qualsevol
// moment. Deixar-ho escrit al codi voldria dir tocar el codi cada cop
// que canviï, i posar-hi totes les classes faria sortir en vermell les
// que no la fan, com si hi faltessin dades.
//
// Per això es desa al mateix lloc que les dades, amb un document de
// configuració per curs, i es tria des de la pantalla de Resum.

/**
 * Les classes que fan la prova aquest curs.
 *
 * Per defecte, TOTES les d'I4 i I5: una escola que comenci a fer-la no ha
 * de configurar res perquè li surti. El document de configuració només
 * serveix per TREURE'N les que no la facin.
 *
 * @param {object|null} config - el document de configuració, si n'hi ha
 * @param {string[]} totesLesClasses - les classes d'I4 i I5 del centre
 */
export function classesQueFanLaProva(config, totesLesClasses) {
  const fora = new Set(config?.classesExcloses ?? [])
  return (totesLesClasses ?? []).filter((c) => esClasseEI4o5(c) && !fora.has(c))
}
