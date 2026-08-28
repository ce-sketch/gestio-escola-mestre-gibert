// Dades i càlculs del mòdul "SIC" (Sistema d'Indicadors de Centre).
//
// Què és
// ------
// Cada curs el centre ha d'omplir una llista d'indicadors numerats
// jeràrquicament, del tipus:
//
//   1 Context                          ← bloc
//   1.1 Centre: escolarització         ← secció
//   1.1.1 E. Infantil: grups del curs  ← indicador (el que s'omple)
//
// Per què no està escrit a pedra
// ------------------------------
// La llista canvia d'un curs a l'altre: el Departament n'afegeix, en treu
// i en canvia la redacció. Per això aquí NO hi ha la llista com a codi
// fix: hi ha la del curs passat com a **punt de partida** i, sobretot, la
// possibilitat de pujar un Excel amb la llista nova (vegeu
// `sicPlantillaParser.js`).
//
// Quan es puja una llista nova, els valors ja introduïts es reaprofiten
// casant-los **pel codi** (l'1.1.1 nou hereta el valor de l'1.1.1 vell).
// Vegeu `fusionaValors()`, que és on hi ha el detall i els paranys.

/** Com es mesura un indicador. Determina què es valida i com es mostra. */
export const UNITATS = [
  { id: 'index', label: 'Índex (%)', sufix: '%' },
  { id: 'nombre', label: 'Nombre', sufix: '' },
  { id: 'ratio', label: 'Ràtio', sufix: '' },
  { id: 'text', label: 'Text', sufix: '' },
]

export const UNITAT_PER_DEFECTE = 'index'

/** Els blocs de primer nivell, amb el nom que se'ls dona al document
 *  oficial. Si un Excel en porta un que no hi és, es fa servir igualment
 *  el títol que hi vingui: aquesta llista només posa nom als que venen
 *  sense (al document, el "1" i el "3" surten sense encapçalament). */
export const TITOLS_BLOC = {
  1: 'Context',
  2: 'Resultats',
  3: 'Recursos',
}

const id = () => crypto.randomUUID()

/** Capçaleres de columna típiques d'un Excel. Surten sempre abans del
 *  primer indicador i no en són cap: es descarten sense avisar. */
const ES_CAPCALERA = /^(codi|indicador|indicadors|descripció|descripcio|valor|valors|resultat|dada|dades|nota|notes|curs|unitat|núm\.?|num\.?|n\.?º)$/i

/**
 * Endevina com es mesura un indicador a partir de com està redactat.
 *
 * No és infal·lible i per això sempre es pot canviar a mà, però encerta
 * la immensa majoria i estalvia haver de triar la unitat un per un en una
 * llista de més de cent indicadors.
 */
export function unitatSuggerida(text) {
  const t = String(text ?? '').toLowerCase()
  // L'ordre importa: "Grau de complexitat / Nivell socioeconòmic" comença
  // per "Grau" i el capturaria la regla dels índexs, quan de fet no és cap
  // número. Els casos concrets van abans que els genèrics.
  if (/tipologia|complexitat|nivell socioeconòmic/.test(t)) return 'text'
  if (/ràtio|ratio/.test(t)) return 'ratio'
  if (/^\s*(índex|index|percentatge|grau|%)/.test(t) || /índex d|percentatge d/.test(t)) return 'index'
  if (/^total\b|grups del curs|alumnes del curs|plans individualitzats|personal de suport/.test(t)) return 'nombre'
  return UNITAT_PER_DEFECTE
}

/** Un indicador buit, llest per omplir. */
export function indicadorBuit(codi = '', text = '') {
  return {
    id: id(),
    codi: String(codi ?? '').trim(),
    text: String(text ?? '').trim(),
    unitat: unitatSuggerida(text),
    valor: '',        // el del curs en marxa
    valorAnterior: '', // el del curs passat, per poder-los comparar
    nota: '',
  }
}

export function seccioBuida(codi = '', titol = '') {
  return { id: id(), codi: String(codi ?? '').trim(), titol: String(titol ?? '').trim(), indicadors: [] }
}

export function blocBuit(codi = '', titol = '') {
  return { id: id(), codi: String(codi ?? '').trim(), titol: String(titol ?? '').trim(), seccions: [] }
}

/**
 * Converteix una llista plana de línies numerades en l'arbre
 * bloc → secció → indicador.
 *
 * És la peça central del mòdul: tant la llista per defecte com la que es
 * puja en Excel passen per aquí, així que qualsevol format que aguanti
 * aquesta funció, l'aguanta tot el mòdul.
 *
 * Casos reals de la llista del curs passat que cal aguantar:
 *   · "1.1 Centre: escolarització"      → secció
 *   · "1.1.1 E. Infantil: grups..."     → indicador
 *   · "2 Resultats"                     → bloc amb títol
 *   · "3.1 Recursos humans: ..."        → secció d'un bloc que mai s'ha
 *                                         declarat (el "3" no hi surt)
 *   · "TOTAL GRUPS"                     → línia sense codi: és un
 *                                         indicador més de la secció on cau
 *   · "1.1.11 ..." dues vegades         → codi repetit; es respecta tal com
 *                                         ve i s'avisa, en comptes de
 *                                         descartar-ne un en silenci
 */
export function analitzaLlista(linies) {
  linies = Array.isArray(linies) ? linies : []
  const avisos = []
  const blocs = []
  const vistos = new Map()

  const blocPerCodi = (codiBloc) => {
    let bloc = blocs.find((b) => b.codi === codiBloc)
    if (!bloc) {
      bloc = blocBuit(codiBloc, TITOLS_BLOC[codiBloc] ?? '')
      blocs.push(bloc)
    }
    return bloc
  }

  let seccioActual = null

  for (const linia of linies) {
    const net = String(linia ?? '').replace(/\s+/g, ' ').trim()
    if (!net) continue

    const m = net.match(/^(\d+(?:\.\d+)*)\s+(.*)$/)

    // ── Línia sense codi ────────────────────────────────────────────
    // "TOTAL GRUPS", "TOTAL ALUMNES". Van soltes enmig d'una secció i
    // formen part d'ella: es desen com un indicador més, sense codi.
    if (!m) {
      if (!seccioActual) {
        // Les capçaleres de columna ("Codi", "Indicador", "Valor") surten
        // sempre abans del primer indicador. Descartar-les és el que
        // toca, però avisar-ne cada vegada només fa soroll.
        if (!ES_CAPCALERA.test(net)) {
          avisos.push(`"${net}" surt abans de cap secció numerada; l'he deixat fora.`)
        }
        continue
      }
      seccioActual.indicadors.push(indicadorBuit('', net))
      continue
    }

    const [, codi, titol] = m
    const parts = codi.split('.')

    if (parts.length === 1) {
      // "2 Resultats" — un bloc amb nom propi.
      const bloc = blocPerCodi(parts[0])
      if (titol) bloc.titol = titol
      seccioActual = null
      continue
    }

    if (parts.length === 2) {
      // "1.1 Centre: escolarització" — una secció.
      const bloc = blocPerCodi(parts[0])
      seccioActual = seccioBuida(codi, titol)
      bloc.seccions.push(seccioActual)
      continue
    }

    // "1.1.1 ..." — un indicador. Si la seva secció no s'ha declarat mai,
    // se'n fabrica una de sense títol perquè l'indicador no es perdi.
    const codiSeccio = parts.slice(0, 2).join('.')
    const bloc = blocPerCodi(parts[0])
    let seccio = bloc.seccions.find((s) => s.codi === codiSeccio)
    if (!seccio) {
      seccio = seccioBuida(codiSeccio, '')
      bloc.seccions.push(seccio)
      avisos.push(`L'indicador ${codi} no tenia cap secció ${codiSeccio} declarada; n'he creat una de sense títol.`)
    }
    seccioActual = seccio

    if (vistos.has(codi)) {
      avisos.push(`El codi ${codi} surt més d'una vegada. Els he desat tots dos; comprova que no en sobri cap.`)
    }
    vistos.set(codi, true)
    seccio.indicadors.push(indicadorBuit(codi, titol))
  }

  // Els blocs, en ordre numèric i no en l'ordre en què hagin aparegut.
  blocs.sort((a, b) => Number(a.codi) - Number(b.codi))
  for (const bloc of blocs) {
    if (!bloc.titol) bloc.titol = TITOLS_BLOC[bloc.codi] ?? `Bloc ${bloc.codi}`
  }

  return { blocs, avisos }
}

/**
 * Reaprofita els valors ja introduïts quan es puja una llista nova.
 *
 * Es casa **pel codi**, no per la posició ni pel text: el Departament en
 * canvia la redacció sovint ("Índex d'alumnes..." → "Índex d'alumnat...")
 * i, en canvi, la numeració es manté d'un curs a l'altre.
 *
 * El que NO es fa, expressament: endevinar. Si un codi ja no hi és, el seu
 * valor no s'arrossega enlloc — es diu quants se n'han perdut perquè es
 * pugui decidir què fer, en comptes de col·locar-lo a l'indicador més
 * semblant i que ningú se n'assabenti.
 *
 * @returns {{blocs, avisos, reaprofitats: number, perduts: string[]}}
 */
export function fusionaValors(blocsNous, blocsVells) {
  blocsNous = (blocsNous ?? []).filter((b) => b && Array.isArray(b.seccions))
  const perCodi = new Map()
  for (const indicador of totsElsIndicadors(blocsVells)) {
    if (!indicador.codi) continue
    if (!perCodi.has(indicador.codi)) perCodi.set(indicador.codi, indicador)
  }

  const usats = new Set()
  let reaprofitats = 0
  const blocs = blocsNous.map((bloc) => ({
    ...bloc,
    seccions: bloc.seccions.map((seccio) => ({
      ...seccio,
      indicadors: seccio.indicadors.map((indicador) => {
        const vell = indicador.codi ? perCodi.get(indicador.codi) : null
        if (!vell) return indicador
        usats.add(indicador.codi)
        const teValor = String(vell.valor ?? '').trim() !== ''
        if (teValor) reaprofitats++
        return {
          ...indicador,
          // El valor del curs passat passa a la columna de comparació, i
          // el del curs en marxa queda buit per tornar-lo a omplir.
          valor: '',
          valorAnterior: teValor ? vell.valor : (vell.valorAnterior ?? ''),
          // La unitat triada a mà s'ha de respectar: si algú va canviar
          // l'1.17.1 a "Text", no li tornem a posar "Índex" cada any.
          unitat: vell.unitat ?? indicador.unitat,
          nota: vell.nota ?? '',
        }
      }),
    })),
  }))

  const perduts = [...perCodi.keys()]
    .filter((codi) => !usats.has(codi))
    .filter((codi) => String(perCodi.get(codi).valor ?? '').trim() !== '')

  const avisos = []
  if (perduts.length > 0) {
    avisos.push(
      `${perduts.length} indicador${perduts.length === 1 ? '' : 's'} que tenien valor ja no surten a la llista nova `
      + `(${perduts.slice(0, 8).join(', ')}${perduts.length > 8 ? '…' : ''}). `
      + 'El seu valor no s\'ha copiat enlloc.'
    )
  }

  return { blocs, avisos, reaprofitats, perduts }
}

/** Tots els indicadors de l'arbre, en ordre de lectura. */
export function totsElsIndicadors(blocs) {
  const llista = []
  for (const bloc of (Array.isArray(blocs) ? blocs : [])) {
    for (const seccio of bloc?.seccions ?? []) {
      for (const indicador of seccio?.indicadors ?? []) llista.push(indicador)
    }
  }
  return llista
}

/** Quants indicadors hi ha i quants estan omplerts — per saber quant
 *  queda per fer sense haver de recórrer tota la pantalla. */
export function progres(blocs) {
  const tots = totsElsIndicadors(blocs)
  const omplerts = tots.filter((i) => String(i.valor ?? '').trim() !== '').length
  return {
    total: tots.length,
    omplerts,
    percentatge: tots.length === 0 ? 0 : Math.round((omplerts / tots.length) * 100),
  }
}

/** El mateix, però d'una secció sola. */
export function progresSeccio(seccio) {
  const tots = seccio?.indicadors ?? []
  const omplerts = tots.filter((i) => String(i.valor ?? '').trim() !== '').length
  return { total: tots.length, omplerts }
}

/**
 * La diferència entre el valor d'aquest curs i el de l'anterior.
 *
 * Torna `null` quan la comparació no vol dir res: si en falta algun dels
 * dos, o si l'indicador és de text (comparar "Alta" amb "Mitjana" com si
 * fossin números no té sentit).
 */
export function variacio(indicador) {
  if (!indicador || indicador.unitat === 'text') return null
  const ara = Number(String(indicador.valor ?? '').replace(',', '.'))
  const abans = Number(String(indicador.valorAnterior ?? '').replace(',', '.'))
  if (!Number.isFinite(ara) || !Number.isFinite(abans)) return null
  if (String(indicador.valor ?? '').trim() === '' || String(indicador.valorAnterior ?? '').trim() === '') return null
  return Math.round((ara - abans) * 100) / 100
}

/**
 * Posa al dia un document vingut de Firestore.
 *
 * Els documents desats abans que existissin camps nous no els porten, i
 * llegir-los sense passar per aquí ompliria la pantalla de `undefined`.
 */
export function normalitzaBlocs(blocs) {
  return (Array.isArray(blocs) ? blocs : []).filter(Boolean).map((bloc) => ({
    id: bloc.id ?? id(),
    codi: String(bloc.codi ?? '').trim(),
    titol: bloc.titol ?? '',
    seccions: (bloc.seccions ?? []).filter(Boolean).map((seccio) => ({
      id: seccio.id ?? id(),
      codi: String(seccio.codi ?? '').trim(),
      titol: seccio.titol ?? '',
      indicadors: (seccio.indicadors ?? []).filter(Boolean).map((i) => ({
        id: i.id ?? id(),
        codi: String(i.codi ?? '').trim(),
        text: i.text ?? '',
        unitat: i.unitat ?? unitatSuggerida(i.text),
        valor: i.valor ?? '',
        valorAnterior: i.valorAnterior ?? '',
        nota: i.nota ?? '',
      })),
    })),
  }))
}

/** La llista del curs 2025-26, tal com la va facilitar el centre. Serveix
 *  de punt de partida la primera vegada que s'obre el mòdul; a partir
 *  d'aquí, o s'edita a mà o es puja la llista nova en Excel. */
export const LLISTA_2025_26 = `
1.1 Centre: escolarització
1.1.1 E. Infantil: grups del curs
1.1.2 E. Infantil: grups del curs
1.1.3 E. Infantil: grups del curs
1.1.4 E. Infantil: alumnes del curs
1.1.5 E. Infantil: alumnes del curs
1.1.6 E. Infantil: alumnes del curs
1.1.7 E. Primària: grups del curs
1.1.8 E. Primària: grups del curs
1.1.9 E. Primària: grups del curs
1.1.10 E. Primària: alumnes del curs
1.1.11 E. Primària: alumnes del curs
1.1.11 E. Primària: alumnes del curs
TOTAL GRUPS
TOTAL ALUMNES
1.2 Centre: necessitats educatives especials.
1.2.1 Educació Infantil: Índex d'alumnes amb necessitats educatives especials (motrius, físiques, psíquiques i sensorials)
1.2.2 Educació Primària: Índex d'alumnes amb necessitats educatives especials (motrius, físiques, psíquiques i sensorials)
1.3 Centre: situació socioeconòmica desfavorida
1.3.1 Educació Infantil: Índex d'alumnes amb necessitats educatives específiques (amb situació socioeconòmica desfavorida)
1.3.2 E. Primària: Índex d'alumnat amb necessitats educatives específiques (amb situació socioeconòmica desfavorida)
1.4 Centre: nova incorporació
1.4.1 Educació Primària: Índex d'alumnes de nova incorporació al sistema educatiu (menys de 2 anys)
1.5 Centre: nacionalitat alumnat
1.5.1 Educació Infantil: Índex d'alumnes de nacionalitat estrangera
1.5.2 Educació Primària: Índex d'alumnat de nacionalitat estrangera
1.6 Centre ajuts material
1.6.1 Índex d'alumnes que gaudeixen d'ajuts per a l'adquisició de llibres de text i material didàctic complementari i informàtic
1.7 Centre: ajuts menjador
1.7.1 Índex d'alumnes que compten amb ajuts menjador. E. Infantil
1.7.2 Índex d'alumnes que compten amb ajuts menjador. E. Primària
1.8 Centre: plans individualitzats E. Primària
1.8.1 Plans individualitzats: cicle inicial
1.8.2 Plans individualitzats: cicle mitjà
1.8.3 Plans individualitzats: cicle superior
1.9 Centre: mobilitat alumnat
1.9.1 Educació Primària: Índex de mobilitat alumnat (altes)
1.9.2 Educació Primària: Índex de mobilitat alumnat (baixes)
1.10 Centre: mobilitat professorat  pàg4 MEMÒRIA ANUAL.
1.10.1 Índex de mobilitat del professorat
1.11 Centre: absències alumnat E. Infantil superior al 10%
1.11.1 Índex d'absències de l'alumnat E. Infantil superior al 10%.
1.12 Centre: absències alumnat E. Primària superior al 10%
1.12.1 Índex d'absències de l'alumnat E. Primària superior al 10%
1.13 Centre: absències alumnat E. Infantil superior al 25%
1.13.1 Índex d'absències de l'alumnat E. Infantil superior al 25%.
1.14 Centre: absències alumnat E. Primària superior al 25%
1.14.1 Índex d'absències de l'alumnat E. Primària superior al 25%
1.15 Centre: absències professorat
1.15.1 Índex d' absències del professorat que no generen substitució
1.16 Centre: demanda
1.16.1 Índex de demanda d'escolarització a EINF3
1.17 Centre: tipologia
1.17.1 Grau de complexitat / Nivell socioeconòmic
2 Resultats
2.1 Índex d'alumnes que superen les àrees instrumentals dels diferents cursos.
2.1.1 Índex d'alumnat que supera les àrees instrumentals de segon curs (cicle inicial).
2.1.2 Índex d'alumnat que supera les àrees instrumentals de segon curs (cicle mitjà).
2.1.3 Índex d'alumnat que supera les àrees instrumentals de segon curs (cicle superior).
2.2 Índex d'alumnes que superen les àrees en acabar el cicle inicial
2.2.1 Llengua catalana i literatura
2.2.2 Llengua castellana i literatura
2.2.3 Llengua estrangera
2.2.4 Matemàtiques
2.2.5 Coneixement del medi natural
2.2.6 Coneixement del medi social i cultural
2.2.7 Educació artística
2.2.8 Educació física
2.2.9 Educació en valors socials i cívics
2.2.10 Religió
2.3 Índex d'alumnes que superen les àrees en acabar el cicle mitjà
2.3.1 Llengua catalana i literatura
2.3.2 Llengua castellana i literatura
2.3.3 Llengua estrangera
2.3.4 Matemàtiques
2.3.5 Coneixement del medi natural
2.3.6 Coneixement del medi social i cultural
2.3.7 Educació artística
2.3.8 Educació física
2.3.9 Educació en valors socials i cívics
2.3.10 Religió
2.4 Índex d'alumnes que superen les àrees en acabar el cicle superior
2.4.1 Llengua catalana i literatura
2.4.2 Llengua castellana i literatura
2.4.3 Llengua estrangera
2.4.4 Matemàtiques
2.4.5 Coneixement del medi natural
2.4.6 Coneixement del medi social i cultural
2.4.7 Educació artística
2.4.8 Educació física
2.4.9 Educació en valors socials i cívics
2.4.10 Religió
2.5 Índex d'alumnes que superen les competències: prova de 6è de primària (franges mitjana-baixa, mitjana-alta i alta)
2.5.1 Competència lingüística: llengua catalana
2.5.2 Competència lingüística: llengua castellana
2.5.3 Competència lingüística: anglès
2.5.4 Competència matemàtica
2.5.5 Competència científica: coneixement del medi natural
2.6 Índex d'alumnes situats a la franja alta de superació de les competències: prova de 6è de primària
2.6.1 Competència lingüística: llengua catalana
2.6.2 Competència lingüística: llengua castellana
2.6.3 Competència lingüística: anglès
2.6.4 Competència matemàtica
2.6.5 Competència científica: coneixement del medi natural
2.7 Índex d'alumnes que participen a les proves de 6è de primària
2.7.1 Competència lingüística: llengua catalana
2.7.2 Competència lingüística: llengua castellana
2.7.3 Competència lingüística: anglès
2.7.4 Competència matemàtica
2.7.5 Competència científica: coneixement del medi natural
2.8 Rendiment acadèmic de l'Educació Primària
2.8.1 Índex elaborat a partir dels resultats de les proves internes i proves externes.
3.1 Recursos humans: ràtio alumnat / professor
3.1.1 Recursos humans: ràtio alumnat / professor
3.2 Recursos humans: ràtio alumnat / grup
3.2.1 Recursos humans: ràtio alumnat / grup
3.3 Recursos humans: personal de suport socioeducatiu
3.3.1 Recursos humans: personal de suport socioeducatiu
3.4 Recursos humans: ràtio personal de suport socioeducatiu per alumnat atès
3.4.1 Recursos humans: ràtio personal de suport socioeducatiu per alumnat atès
`.trim().split('\n')

/** L'arbre d'indicadors per defecte — la llista del curs passat. */
export function blocsPerDefecte() {
  return analitzaLlista(LLISTA_2025_26).blocs
}
