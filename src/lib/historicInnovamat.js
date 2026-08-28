// Històric dels informes d'Innovamat (ConMat).
//
// ⚠️ El problema que resol aquest fitxer
// --------------------------------------
// Fins ara, cada alumne tenia UN SOL registre per curs a la col·lecció
// "matematiques", amb el ConMat desat en un camp pla:
//
//     { cursEscolar: '2025-26', alumneId: 'x', conmat: { nivell, ... } }
//
// Això volia dir que en pujar l'informe de final de curs, S'ESBORRAVA el
// d'inici de curs del mateix alumne. No hi havia històric possible.
//
// Ara el ConMat es desa dins d'un mapa, indexat pel moment de la prova:
//
//     conmat: { inici: { nivell, ... }, final: { nivell, ... } }
//
// Les dues formes conviuen: `momentsConmat()` llegeix indistintament els
// registres antics (plans) i els nous (mapa), de manera que les dades que
// ja hi havia desades no es perden ni cal migrar-les a mà.

import { NIVELLS_CONMAT } from './conmatParser'

/** Els dos moments en què l'Innovamat passa les ConMat cada curs. */
export const MOMENTS = [
  { id: 'inici', label: 'Inici de curs' },
  { id: 'final', label: 'Final de curs' },
]

/** Dedueix l'id del moment ('inici' o 'final') a partir del text que surt
 *  a la portada del PDF ("Avaluació inicial" / "Avaluació final"). Si no
 *  el reconeix, retorna 'inici' — és el cas més freqüent i evita perdre
 *  la lectura, però queda registrat el text original per poder revisar-ho. */
export function momentId(textMoment) {
  return /final/i.test(String(textMoment ?? '')) ? 'final' : 'inici'
}

export function momentLabel(id) {
  return MOMENTS.find((m) => m.id === id)?.label ?? id
}

/**
 * Retorna els moments de ConMat d'un registre d'alumne, en forma de
 * llista, tant si venen del format antic (un sol objecte pla) com del nou
 * (un mapa per moment).
 *
 * @returns {Array<{moment, ...dadesConmat}>}
 */
export function momentsConmat(registre) {
  const c = registre?.conmat
  if (!c) return []
  // Format antic: un únic objecte amb el nivell directament a dins.
  if (c.nivell !== undefined || c.percentatge !== undefined) {
    // Compte amb l'ordre: el `moment` del registre antic és text lliure
    // ("Avaluació final"), i ha d'anar DESPRÉS de l'expansió perquè no
    // sobreescrigui l'id calculat.
    return [{ ...c, moment: momentId(c.moment) }]
  }
  // Format nou: un mapa { inici: {...}, final: {...} }
  //
  // ⚠️ Mateix parany que al format antic (vegeu comentari de dalt): cada
  // objecte de dins del mapa TAMBÉ porta el seu propi camp `moment` amb el
  // text lliure de la portada ("Avaluació final"), perquè `resultat()` a
  // Matematiques.jsx el desa així. Si `moment: m.id` va abans de l'expansió
  // de `c[m.id]`, el text lliure el sobreescriu i l'id normalitzat
  // ('inici'/'final') es perd — que és exactament el que feia que
  // "Evolució del centre" sortís sempre buit: filtrava per l'id i mai hi
  // havia cap entrada que el tingués.
  return MOMENTS
    .filter((m) => c[m.id])
    .map((m) => ({ ...c[m.id], moment: m.id }))
}

/**
 * Aplana tots els registres de "matematiques" en una llista d'entrades
 * d'històric, una per alumne i moment, ordenades de la més recent a la
 * més antiga.
 */
export function entradesHistoric(registres) {
  const entrades = []
  for (const r of registres ?? []) {
    if (r.tipus === 'informe') continue // els registres d'informes carregats no són alumnes
    for (const m of momentsConmat(r)) {
      entrades.push({
        cursEscolar: r.cursEscolar,
        alumneId: r.alumneId ?? null,
        nom: r.nom,
        // Alumnes que no consten com a actius al centre (cursos passats):
        // el nom ve del PDF de l'Innovamat, no de la fitxa d'alumne.
        sensCasar: r.sensCasar === true,
        // Alumnes que consten a l'informe però no van fer la prova: es
        // desen igualment (per quadrar els totals amb l'Excel del centre)
        // amb `nivell: null`, i es distingeixen amb aquest senyalador
        // perquè no se'ls confongui amb un registre antic sense aquesta
        // dada o amb un nivell no reconegut.
        noAvaluat: m.noAvaluat === true,
        moment: m.moment,
        classe: m.classe ?? null,
        nivell: m.nivell ?? null,
        percentatge: m.percentatge ?? null,
        respostes: m.respostes ?? null,
        preguntes: m.preguntes ?? null,
      })
    }
  }
  return entrades.sort((a, b) => {
    const curs = String(b.cursEscolar).localeCompare(String(a.cursEscolar))
    if (curs !== 0) return curs
    if (a.moment !== b.moment) return a.moment === 'final' ? -1 : 1
    return String(a.nom).localeCompare(String(b.nom))
  })
}

/**
 * El resultat de ConMat més recent d'un alumne concret — el que es mostra
 * a l'apartat de matemàtiques de l'informe individual.
 */
export function ultimConmatDe(registres, alumneId) {
  if (!alumneId) return null
  return entradesHistoric(registres).find((e) => e.alumneId === alumneId) ?? null
}

/**
 * El resultat de COSMOS més recent d'un alumne concret. A diferència del
 * ConMat (una avaluació referencial només a partir de 3r), el COSMOS és
 * la prova d'Innovamat per a 1r i 2n: a aquests cursos el ConMat sempre
 * sortirà buit i cal mirar aquí — vegeu `ultimConmatDe`.
 *
 * Un mateix registre ja porta els dos moments a dins (`moments.inicial` i
 * `moments.final`), a diferència del ConMat: no cal cap `momentsConmat`
 * equivalent, només triar el curs escolar més recent que en tingui.
 */
export function ultimCosmosDe(registres, alumneId) {
  if (!alumneId) return null
  const amb = registres.filter((r) => r.alumneId === alumneId && r.cosmos)
  if (amb.length === 0) return null
  amb.sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
  const r = amb[0]
  return { cursEscolar: r.cursEscolar, ...r.cosmos }
}

/**
 * El ConMat d'un alumne EN UN CURS CONCRET.
 *
 * ⚠️ No confondre amb `ultimConmatDe`, que dona el més recent de tots els
 * cursos. A l'informe de l'alumne cal aquesta: allà s'hi tria un curs
 * escolar, i la resta d'apartats (TEE, lectura) ja hi estan filtrats. Amb
 * `ultimConmatDe` hi sortien els resultats de l'any passat com si fossin
 * d'aquest — i com que a 1r i 2n es fa COSMOS i de 3r en amunt ConMat, un
 * alumne de 3r hi veia el COSMOS de quan era a 2n.
 *
 * Si el curs té els dos moments, torna el de final: és el que tanca el
 * curs i el que fa servir l'informe com a resultat de referència.
 */
export function conmatDelCurs(registres, alumneId, cursEscolar) {
  if (!alumneId || !cursEscolar) return null
  return entradesHistoric(registres)
    .find((e) => e.alumneId === alumneId && e.cursEscolar === cursEscolar) ?? null
}

/** El COSMOS d'un alumne en un curs concret. Vegeu `conmatDelCurs`. */
export function cosmosDelCurs(registres, alumneId, cursEscolar) {
  if (!alumneId || !cursEscolar) return null
  return entradesCosmos(registres)
    .find((e) => e.alumneId === alumneId && e.cursEscolar === cursEscolar) ?? null
}

/**
 * Els resultats d'Innovamat d'un alumne de CURSOS ANTERIORS al que es
 * mira, del més recent al més antic.
 *
 * Es mostren a part i clarament etiquetats amb el seu curs: tenen valor
 * per veure l'evolució, però no s'han de barrejar amb els del curs en
 * marxa — que és exactament l'error que hi havia.
 */
export function innovamatAnterior(registres, alumneId, cursEscolar) {
  if (!alumneId || !cursEscolar) return []
  const anteriors = (e) => e.alumneId === alumneId && String(e.cursEscolar) < String(cursEscolar)
  return [
    ...entradesHistoric(registres).filter(anteriors).map((e) => ({ ...e, prova: 'ConMat' })),
    ...entradesCosmos(registres).filter(anteriors).map((e) => ({ ...e, prova: 'COSMOS' })),
  ].sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
}


// El COSMOS es mesura amb tres nivells de rendiment, no amb els quatre
// del ConMat, i cada registre porta els dos moments a dins. Per això té
// les seves pròpies funcions en comptes de reaprofitar les del ConMat:
// barrejar-los faria que les taules sumessin coses que no es poden sumar.

/** Els tres nivells de rendiment del COSMOS, de menys a més. */
export const NIVELLS_COSMOS = ['Baix', 'Mitjà', 'Alt']

/** Els dos moments del COSMOS. Compte: al CSV es diuen "inicial" i
 *  "final", no "inici" i "final" com al ConMat. */
export const MOMENTS_COSMOS = [
  { id: 'inicial', label: 'Inici de curs' },
  { id: 'final', label: 'Final de curs' },
]

/** Normalitza el rendiment del CSV ("Mitjà", "mitja", "MITJÀ") a un dels
 *  tres nivells. Torna null si no el reconeix, per no inventar-se'l. */
export function nivellCosmos(text) {
  const t = String(text ?? '').trim().toLowerCase()
  if (t === 'alt') return 'Alt'
  if (t === 'mitjà' || t === 'mitja') return 'Mitjà'
  if (t === 'baix') return 'Baix'
  return null
}

/**
 * Aplana els registres de COSMOS en una llista d'entrades, una per
 * alumne i curs — l'equivalent de `entradesHistoric()` per al ConMat.
 *
 * Ordenades del curs més recent al més antic.
 */
export function entradesCosmos(registres) {
  const entrades = []
  for (const r of registres ?? []) {
    if (!r.cosmos) continue
    const c = r.cosmos
    entrades.push({
      cursEscolar: r.cursEscolar,
      alumneId: r.alumneId ?? null,
      nom: r.nom ?? null,
      sensCasar: r.sensCasar === true,
      // Vegeu el comentari de `noAvaluat` a `entradesHistoric`: qui no va
      // fer la prova es desa igualment perquè els totals quadrin amb
      // l'Excel, però no compta als percentatges.
      noAvaluat: c.noAvaluat === true,
      classe: c.classe ?? null,
      intervencio: c.intervencio ?? null,
      inicial: nivellCosmos(c.moments?.inicial?.rendiment),
      final: nivellCosmos(c.moments?.final?.rendiment),
      puntuacioInicial: c.moments?.inicial?.puntuacio ?? null,
      puntuacioFinal: c.moments?.final?.puntuacio ?? null,
    })
  }
  entrades.sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
  return entrades
}

/**
 * Reparteix les entrades de COSMOS pels tres nivells de rendiment d'un
 * moment concret ('inicial' o 'final').
 *
 * Com al ConMat, els alumnes sense rendiment en aquell moment no compten
 * al total ni als percentatges, però es recompten a part.
 */
export function distribucioCosmos(entrades, moment = 'final') {
  const avaluats = (entrades ?? []).filter((e) => e[moment] != null)
  const total = avaluats.length
  const files = NIVELLS_COSMOS.map((nivell) => {
    const alumnes = avaluats.filter((e) => e[moment] === nivell).length
    return {
      nivell,
      alumnes,
      percentatge: total > 0 ? Math.round((alumnes / total) * 10000) / 100 : 0,
    }
  })
  return {
    files,
    total,
    noAvaluats: (entrades ?? []).length - total,
    totalGeneral: (entrades ?? []).length,
  }
}

/**
 * Quants alumnes milloren, es mantenen o baixen de nivell entre la prova
 * inicial i la final — la lectura que té sentit al COSMOS, on el mateix
 * alumne fa les dues proves el mateix curs.
 *
 * Només compta els qui tenen els dos rendiments: si en falta un, no es
 * pot dir si ha millorat.
 */
export function evolucioCosmos(entrades) {
  const ambTotesDues = (entrades ?? []).filter((e) => e.inicial != null && e.final != null)
  let milloren = 0
  let mantenen = 0
  let baixen = 0
  for (const e of ambTotesDues) {
    const abans = NIVELLS_COSMOS.indexOf(e.inicial)
    const ara = NIVELLS_COSMOS.indexOf(e.final)
    if (ara > abans) milloren++
    else if (ara === abans) mantenen++
    else baixen++
  }
  return { ambTotesDues: ambTotesDues.length, milloren, mantenen, baixen }
}

/**
 * Reparteix un conjunt d'entrades pels quatre nivells del ConMat i en
 * calcula els percentatges — el mateix càlcul que es feia a mà al full
 * "ConMath Curs actual" (columnes ALUMNES i CENTRE).
 *
 * Els alumnes que no van fer la prova (`nivell: null`, típicament marcats
 * `noAvaluat`) no compten al `total` ni als percentatges — no es poden
 * classificar en cap nivell —, però sí que es desen i es poden mostrar a
 * part amb `noAvaluats`. `totalGeneral` és la xifra que ha de quadrar amb
 * l'Excel del centre (avaluats + no avaluats).
 */
export function distribucioPerNivell(entrades) {
  const avaluats = (entrades ?? []).filter((e) => e?.nivell != null)
  const total = avaluats.length
  const files = NIVELLS_CONMAT.map((n) => {
    const alumnes = avaluats.filter((e) => String(e.nivell ?? '').toLowerCase() === n.label.toLowerCase()).length
    return {
      nivell: n.label,
      alumnes,
      percentatge: total > 0 ? Math.round((alumnes / total) * 10000) / 100 : 0,
    }
  })
  return { files, total, noAvaluats: (entrades ?? []).length - total, totalGeneral: (entrades ?? []).length }
}

/** Agrupa les entrades per curs escolar i moment, per poder-les mostrar
 *  com una taula d'històric amb una secció per prova. */
export function agrupaPerProva(entrades) {
  const grups = new Map()
  for (const e of entrades ?? []) {
    const clau = `${e.cursEscolar}__${e.moment}`
    if (!grups.has(clau)) {
      grups.set(clau, { cursEscolar: e.cursEscolar, moment: e.moment, entrades: [] })
    }
    grups.get(clau).entrades.push(e)
  }
  return [...grups.values()]
}
