// Reproducció de la pestanya "MATRIU GENERAL" de l'Eina d'avaluació PGAC:
// una graella de resultats amb el mateix codi de colors que el full
// original (les franges i els colors del document surten del seu format
// condicional, comprovat cel·la per cel·la).
//
// Al full original cada cel·la és una fórmula que apunta a una posició fixa
// d'una altra pestanya (p. ex. "=VAL.CICLES!F12"), pròpia de com estan
// muntades les seves files i columnes. Aquí no hi ha cel·les fixes: els
// mateixos números surten cridant els càlculs ja verificats de cada mòdul
// (`mitjanaValoracio`, `mitjanaGeneralFesta`, `grauCicle`, `resultatObjectiu`…),
// aplicats a les mateixes files i columnes que el full.
//
// Les files de TEE i VL/CL (Avaluació referencial) no hi són encara: la
// cel·la del full les calcula sumant alumnes en un nivell concret
// ("=AV.TEE!H10+H11", per exemple), i sense confirmar contra el full quins
// nivells compten com a "assolit" per a cada cicle, posar-hi un número
// seria enganyós.

export const FRANGES = [
  { fins: 0.30, bg: '#FF0000', color: '#fff' },
  { fins: 0.60, bg: '#FF9900', color: '#fff' },
  { fins: 0.80, bg: '#4A86E8', color: '#fff' },
  { fins: Infinity, bg: '#00FF00', color: '#1a1a1a' },
]

/** El color d'una cel·la, seguint exactament les franges del full original
 *  (≤30% / 30,1-60% / 60,1-80% / >80%). Rep un percentatge 0-100. */
export function colorCella(percentatge) {
  if (percentatge === null || percentatge === undefined || percentatge === '') return null
  const fraccio = Number(percentatge) / 100
  return FRANGES.find((f) => fraccio <= f.fins) ?? FRANGES[FRANGES.length - 1]
}

export const COLUMNES_GRUP = [
  { id: 'EI', label: 'Ed. Infantil', nom: 'Educació Infantil' },
  { id: 'CI', label: 'C. Inicial', nom: 'Cicle Inicial' },
  { id: 'CM', label: 'C. Mitjà', nom: 'Cicle Mitjà' },
  { id: 'CS', label: 'C. Superior', nom: 'Cicle Superior' },
]

/**
 * Construeix les files de la matriu a partir de les dades que ja carrega
 * el Quadre de comandament: valoracions (cicles i comissions), festes,
 * cooperatiu i objectius del PGAC.
 *
 * @returns {Array<{titol: string, columnes: Array<{id: string, label: string, valor: number|null}>}>}
 */
export function construeixMatriu({ valoracions = [], festesDetall = [], cooperatiu = null, objectiusPgac = [] }, helpers) {
  const {
    mitjanaValoracio, grauGlobal, grauCicle, CICLES_COOPERATIU, resultatObjectiu,
  } = helpers

  const comissions = valoracions.filter((v) => !COLUMNES_GRUP.some((g) => g.nom === v.nom))
  const columnesGrupIComissions = [
    ...COLUMNES_GRUP,
    ...comissions.map((c) => ({ id: c.id, label: c.nom, nom: c.nom })),
  ]

  const files = []

  // --- Cicles, comissions i equips ---------------------------------------
  files.push({
    titol: 'Val. cicle · comissió · equips',
    columnes: columnesGrupIComissions.map((col) => {
      const v = valoracions.find((x) => x.nom === col.nom)
      return { id: col.id, label: col.label, valor: v ? mitjanaValoracio(v, 'juny') : null }
    }),
  })

  // --- Festes (una fila per festa, valor per cicle) -----------------------
  for (const f of festesDetall) {
    files.push({
      titol: `Val. festa ${f.festa.activitat || f.id}`,
      columnes: COLUMNES_GRUP.map((col) => {
        const grup = f.festa.grups.find((g) => g.nom === col.nom)
        return { id: col.id, label: col.label, valor: grup ? mitjanaValoracioGrupFesta(f.festa, grup, helpers) : null }
      }),
    })
  }

  // --- Aprenentatge cooperatiu (gener i juny) ------------------------------
  if (cooperatiu) {
    for (const camp of ['gener', 'juny']) {
      files.push({
        titol: `Aprenentatge cooperatiu — ${camp === 'gener' ? 'Gener' : 'Juny'}`,
        columnes: [
          { id: 'global', label: 'Global', valor: grauGlobal(cooperatiu, camp) },
          ...CICLES_COOPERATIU.map((c) => ({ id: c.id, label: c.nom, valor: grauCicle(cooperatiu, c.id, camp) })),
        ],
      })
    }
  }

  // --- PGAC: un bloc per objectiu, gener i juny ---------------------------
  for (const [oi, o] of objectiusPgac.entries()) {
    for (const camp of ['gener', 'juny']) {
      const r = resultatObjectiu(o, camp)
      files.push({
        titol: `Objectiu ${oi + 1} — ${camp === 'gener' ? 'Gener' : 'Juny'}`,
        columnes: [{ id: 'valor', label: o.titol || `Objectiu ${oi + 1}`, valor: r.valor }],
      })
    }
  }

  return files
}

function mitjanaValoracioGrupFesta(festa, grup, { mitjanaGrup }) {
  return mitjanaGrup(festa, grup.nom)
}
