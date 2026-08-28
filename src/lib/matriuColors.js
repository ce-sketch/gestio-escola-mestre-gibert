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
// Les files de TEE i VL/CL (Avaluació referencial) no fan servir el
// criteri del full original (que sumava alumnes en un nivell concret,
// "=AV.TEE!H10+H11"), perquè no s'ha confirmat quins nivells hi compten
// com a assolits. Fan servir el criteri que va fixar la direcció:
// **percentatge de participació** — 100% quan tots els alumnes que havien
// de fer la prova l'han feta. Vegeu `filesProves()` més avall.

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
export function construeixMatriu({ valoracions, festesDetall, cooperatiu, objectiusPgac }, helpers) {
  // Els valors per defecte de la desestructuració NO cobreixen un `null`
  // explícit, i un document de Firestore sense el camp encara omplert
  // arriba justament així.
  valoracions = valoracions ?? []
  festesDetall = festesDetall ?? []
  objectiusPgac = objectiusPgac ?? []
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
    bloc: 'Valoracions',
    titol: 'Val. cicle · comissió · equips',
    columnes: columnesGrupIComissions.map((col) => {
      const v = valoracions.find((x) => x.nom === col.nom)
      return { id: col.id, label: col.label, valor: v ? mitjanaValoracio(v, 'juny') : null }
    }),
  })

  // --- Festes (una fila per festa, valor per cicle) -----------------------
  for (const f of festesDetall) {
    files.push({
      bloc: 'Valoracions',
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
        bloc: 'Aprenentatge cooperatiu',
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
        bloc: 'Objectius del PGAC',
        titol: `Objectiu ${oi + 1} — ${camp === 'gener' ? 'Gener' : 'Juny'}`,
        columnes: [{ id: 'valor', label: o.titol || `Objectiu ${oi + 1}`, valor: r.valor }],
      })
    }
  }

  return files
}

/**
 * Files de les proves internes: **percentatge de participació**, no de
 * resultat.
 *
 * El criteri, tal com el va fixar la direcció: la cel·la val 100% quan
 * tots els alumnes que havien de fer la prova l'han feta. És a dir,
 * alumnes amb registre ÷ alumnes que la fan, per cicle.
 *
 * Es fa igual per a TOTES les proves —TEE, VL/CL, lectoescriptura d'EI,
 * notes per àrea i Innovamat— perquè la matriu és un semàfor de "què
 * queda per omplir", no de "com han anat els resultats". Barrejar-hi
 * percentatges de resultat faria que un vermell volgués dir dues coses
 * diferents segons la fila.
 *
 * ⚠️ Cada prova la fa un alumnat diferent, i això s'ha de respectar o la
 * matriu surt vermella sense que hi hagi res a corregir:
 *   · 1r no fa TEE ni VL/CL fins al tercer trimestre.
 *   · Educació Infantil no fa VL/CL ni notes per àrea.
 *   · La lectoescriptura és NOMÉS d'I4 i I5 (ni tan sols I3).
 *   · El COSMOS és de 1r i 2n; el ConMat, de 3r a 6è.
 * Un cicle que no fa una prova es deixa BUIT, no a zero.
 *
 * @param {object[]} alumnes            {id, curs, actiu}
 * @param {object[]} teeRegistres       {alumneId, curs, trimestre}
 * @param {object[]} lecturaRegistres   {alumneId, curs, moment}
 * @param {object[]} notaAreaRegistres  {alumneId, curs, area, trimestre}
 * @param {object[]} docsLectoescriptura documents de lectoescripturaEI
 * @param {object[]} registresMates     documents de matematiques
 */
export function filesProves(dades, { cicleDe, MOMENTS_LECTURA }) {
  // Igual que a `construeixMatriu`: un `null` explícit no el cobreix el
  // valor per defecte de la desestructuració.
  const alumnes = dades?.alumnes ?? []
  const teeRegistres = dades?.teeRegistres ?? []
  const lecturaRegistres = dades?.lecturaRegistres ?? []
  const notaAreaRegistres = dades?.notaAreaRegistres ?? []
  const docsLectoescriptura = dades?.docsLectoescriptura ?? []
  const registresMates = dades?.registresMates ?? []
  const cicleColumnes = COLUMNES_GRUP // EI · CI · CM · CS

  /** Un alumne de 1r de Primària? */
  const esDePrimer = (curs) => String(curs ?? '').trim()[0] === '1'

  /**
   * L'alumnat de 1r **només compta al tercer trimestre**: abans no passa
   * les proves. Si es comptés als altres moments, Cicle Inicial no
   * arribaria mai al 100% i sortiria vermell sense que hi hagués res a
   * corregir.
   */
  function compta(curs, { nomesTercerTrimestre = false, nomesCursos = null }) {
    if (nomesTercerTrimestre && esDePrimer(curs)) return false
    // Algunes proves només les fa una part del cicle: la lectoescriptura,
    // I4 i I5 (no I3); el COSMOS, 1r i 2n. El denominador ha de ser
    // només aquest alumnat.
    if (nomesCursos && !nomesCursos.some((p) => String(curs ?? '').trim().toUpperCase().startsWith(p))) return false
    return true
  }

  /** Alumnes que han de fer la prova en aquest cicle i moment. */
  function denominador(cicleId, opcions) {
    return alumnes.filter((a) => cicleDe(a.curs) === cicleId && compta(a.curs, opcions)).length
  }

  /** Alumnes diferents amb registre (un alumne amb dos registres compta un). */
  function participants(registres, cicleId, opcions) {
    const vistos = new Set()
    for (const r of registres) {
      if (cicleDe(r.curs) !== cicleId) continue
      if (!compta(r.curs, opcions)) continue
      vistos.add(r.alumneId)
    }
    return vistos.size
  }

  function fila(bloc, titol, registres, opcions = {}) {
    const { senseCicles = [] } = opcions
    return {
      bloc,
      titol,
      columnes: cicleColumnes.map((col) => {
        // Un cicle que no fa la prova es deixa buit, no a 0%: si no,
        // sortiria vermell sense que hi hagués res per corregir.
        if (senseCicles.includes(col.id)) return { id: col.id, label: col.label, valor: null }
        const total = denominador(col.id, opcions)
        if (total === 0) return { id: col.id, label: col.label, valor: null }
        return { id: col.id, label: col.label, valor: (participants(registres, col.id, opcions) / total) * 100 }
      }),
    }
  }

  const files = []
  const TRIMESTRES = [{ num: 1, label: '1r trimestre' }, { num: 2, label: '2n trimestre' }, { num: 3, label: '3r trimestre' }]

  // --- Lectoescriptura EI --------------------------------------------------
  // Els documents desen les marques per alumne dins d'un mapa; un alumne
  // "ha fet la prova" si té alguna casella marcada. Es converteixen a la
  // mateixa forma que la resta de registres per no duplicar el càlcul.
  const registresLecto = []
  for (const d of docsLectoescriptura) {
    for (const [alumneId, marques] of Object.entries(d.alumnes ?? {})) {
      if (!marques || Object.values(marques).every((v) => !v)) continue
      registresLecto.push({ alumneId, curs: d.classe })
    }
  }
  files.push(fila('Lectoescriptura (I4 i I5)', 'Lectoescriptura EI', registresLecto, {
    senseCicles: ['CI', 'CM', 'CS'],
    nomesCursos: ['I4', 'I5'],
  }))

  // --- TEE, un per trimestre -----------------------------------------------
  for (const t of TRIMESTRES) {
    files.push(fila('Llengua catalana', `TEE — ${t.label}`,
      teeRegistres.filter((r) => Number(r.trimestre) === t.num),
      { nomesTercerTrimestre: t.num !== 3 }))
  }

  // --- VL/CL, un per moment ------------------------------------------------
  // Educació Infantil no fa VL/CL (el full oficial no té barem per a
  // I3-I5), així que la seva columna queda buida, no a zero.
  for (const m of MOMENTS_LECTURA) {
    files.push(fila('Llengua catalana', `VL/CL — ${m.label}`,
      lecturaRegistres.filter((r) => r.moment === m.id),
      {
        senseCicles: ['EI'],
        // L'Avaluació Final és la del tercer trimestre; a les altres dues,
        // 1r no hi compta.
        nomesTercerTrimestre: m.id !== 'final',
      }))
  }

  // --- Notes per àrea, un per trimestre ------------------------------------
  // Un alumne compta com a avaluat si té QUALSEVOL àrea posada aquell
  // trimestre: exigir-les totes marcaria en vermell una classe on només
  // falta l'especialista de música per passar les seves.
  for (const t of TRIMESTRES) {
    files.push(fila('Notes per àrea', `Notes per àrea — ${t.label}`,
      notaAreaRegistres.filter((r) => r.trimestre === t.label || Number(r.trimestre) === t.num),
      { senseCicles: ['EI'] }))
  }

  // --- Innovamat -----------------------------------------------------------
  // Les dues proves no es passen al mateix alumnat: el COSMOS a 1r i 2n
  // (Cicle Inicial), el ConMat de 3r a 6è (Mitjà i Superior). Cadascuna
  // deixa buits els cicles que no li toquen.
  const ambConmat = registresMates.filter((r) => r.conmat).map((r) => ({
    alumneId: r.alumneId,
    curs: r.conmat?.final?.classe ?? r.conmat?.inici?.classe ?? null,
  })).filter((r) => r.alumneId && r.curs)
  const ambCosmos = registresMates.filter((r) => r.cosmos).map((r) => ({
    alumneId: r.alumneId, curs: r.cosmos?.classe ?? null,
  })).filter((r) => r.alumneId && r.curs)

  files.push(fila('Innovamat', 'COSMOS (1r i 2n)', ambCosmos, { senseCicles: ['EI', 'CM', 'CS'] }))
  files.push(fila('Innovamat', 'ConMat (3r a 6è)', ambConmat, { senseCicles: ['EI', 'CI'] }))

  return files
}

function mitjanaValoracioGrupFesta(festa, grup, { mitjanaGrup }) {
  return mitjanaGrup(festa, grup.nom)
}
