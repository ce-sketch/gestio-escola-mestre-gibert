// Genera les cartes mensuals de comunicat de sortides amb autocar a la
// Guàrdia Urbana, a partir del mateix document consolidat d'activitats
// complementàries que ja es fa servir a Economia i a Valoracions.
//
// Idea general:
//  1. Es llegeixen les activitats de tots els cicles (activitatsDelCicle,
//     un cop per cicle) i ens quedem només amb les que van amb autocar.
//  2. Es detecten les colònies (empresa encara per determinar) perquè no
//     se'ls posi "Autocars Dumbo" per error.
//  3. Quan la mateixa sortida la fan els dos nivells d'un cicle el mateix
//     dia, es combinen en una sola entrada (alumnat sumat, 2 autocars) en
//     comptes de sortir duplicada.
//  4. Es reparteixen per mes (Setembre a Juny) i, per a cada mes amb
//     alguna sortida, es pot generar una carta en PDF.

import { activitatsDelCicle } from './activitatsComplementariesParser'

export const CICLES = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior']

export const EMPRESA_AUTOCARS_HABITUAL = 'Autocars Dumbo'
export const EMPRESA_PER_DETERMINAR = '(empresa per determinar)'

export const PUNT_TROBADA_DEFECTE =
  'Pg. Fabra i Puig amb Concepción Arenal (davant quiosc de flors aproximadament)'

export const DIRECTOR_DEFECTE = 'Àlvaro Molero Mateos'

const MESOS = [
  { label: 'Setembre', num: 9 }, { label: 'Octubre', num: 10 }, { label: 'Novembre', num: 11 },
  { label: 'Desembre', num: 12 }, { label: 'Gener', num: 1 }, { label: 'Febrer', num: 2 },
  { label: 'Març', num: 3 }, { label: 'Abril', num: 4 }, { label: 'Maig', num: 5 }, { label: 'Juny', num: 6 },
]

function sensAccents(text) {
  return (text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Interpreta el camp "Preu (€)" del document (p. ex. "120", "120€",
 *  "120,50") com a número. Retorna null si no s'hi pot treure cap número. */
function parsePreu(text) {
  const net = (text ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = parseFloat(net)
  return Number.isFinite(n) ? n : null
}

/** Interpreta el camp "Data" del document i en retorna { dia, mes, any }
 *  de la PRIMERA data que hi trobi (format dd/mm/aaaa). Retorna null si
 *  no hi troba cap data amb aquest format. */
function primeraData(text) {
  const m = (text ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return { dia: Number(m[1]), mes: Number(m[2]), any: Number(m[3]) }
}

/** Compta quantes dates amb format dd/mm/aaaa apareixen al text — si n'hi
 *  ha dues o més, s'interpreta que la sortida ocupa més d'un dia. */
function numDatesAlText(text) {
  return ((text ?? '').match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? []).length
}

/**
 * Una activitat es considera "colònies" (empresa encara per determinar,
 * en comptes de Dumbo) si compleix UNA o més d'aquestes condicions:
 *  - el nom conté la paraula "colònies"
 *  - la data ocupa més d'un dia
 *  - el preu supera els 100€
 */
export function esColonia(activitat) {
  if (sensAccents(activitat.nom).includes('coloni')) return true
  if (numDatesAlText(activitat.data) > 1) return true
  const preu = parsePreu(activitat.preu)
  if (preu !== null && preu > 100) return true
  return false
}

function vaAmbAutocar(activitat) {
  return sensAccents(activitat.transport).includes('autocar')
}

/** Nombre d'alumnes actius d'un nivell ("1r", "I3"...), comptant totes
 *  les classes paral·leles (curs "1r A", "1r B"...). */
export function comptaAlumnesDelNivell(alumnesActius, nivell) {
  const objectiu = sensAccents(nivell)
  return alumnesActius.filter((a) => sensAccents(a.curs).split(' ')[0] === objectiu).length
}

/**
 * Llegeix tots els cicles del document i retorna la llista d'activitats
 * amb autocar, ja combinades quan un mateix nom+data es repeteix als dos
 * nivells d'un cicle (tot el cicle plegat: alumnat sumat, 2 autocars).
 */
export function extreuSortidesAutocar(workbook, XLSX, alumnesActius) {
  const totes = CICLES.flatMap((cicle) => activitatsDelCicle(workbook, XLSX, cicle))
  const ambAutocar = totes.filter(vaAmbAutocar)

  // Agrupa per "nom + data": si dues files coincideixen exactament en
  // aquesta clau (típicament els dos nivells d'un mateix cicle fent la
  // mateixa sortida), es fusionen en una sola entrada.
  const grups = new Map()
  for (const act of ambAutocar) {
    const clau = `${sensAccents(act.nom)}__${act.data}`
    if (!grups.has(clau)) grups.set(clau, [])
    grups.get(clau).push(act)
  }

  return [...grups.values()].map((files) => {
    const base = files[0]
    const nivells = files.map((f) => f.nivell)
    const alumnes = nivells.reduce((suma, n) => suma + comptaAlumnesDelNivell(alumnesActius, n), 0)
    return {
      nom: base.nom,
      nivells,
      nivellsText: nivells.join(' i '),
      data: base.data,
      dataInterpretada: primeraData(base.data),
      horari: base.horari,
      lloc: base.lloc,
      alumnes,
      numAutocars: files.length,
      colonia: files.some(esColonia),
    }
  })
}

/** Reparteix les sortides (ja extretes amb extreuSortidesAutocar) pels 10
 *  mesos del curs (Setembre a Juny), en ordre. Els mesos sense cap
 *  sortida amb autocar també surten, amb la llista buida. */
export function agrupaPerMes(sortides, cursEscolarId) {
  const anyInici = Number(cursEscolarId.split('-')[0])
  return MESOS.map(({ label, num }) => {
    const any = num >= 9 ? anyInici : anyInici + 1
    return {
      mesLabel: label,
      any,
      sortides: sortides.filter((s) => s.dataInterpretada?.mes === num && s.dataInterpretada?.any === any),
    }
  })
}

/** Divideix un camp "Horari" tipus "9:00-16:30" o "9:00 a 16:30h" en
 *  sortida i arribada. Si no hi troba dues hores, ho retorna tot com a
 *  "sortida" i deixa "arribada" buida. */
function parteixHorari(text) {
  const hores = (text ?? '').match(/\d{1,2}[:.]\d{2}/g) ?? []
  return { sortida: hores[0] ?? (text ?? ''), arribada: hores[1] ?? '' }
}

/**
 * Genera la carta d'un mes concret (obre una finestra formatada i llança
 * el diàleg d'impressió — triant "Desa com a PDF" com a impressora
 * s'obté un PDF real), amb el mateix format que la carta de mostra que ja
 * s'envia a mà cada mes.
 */
export function generaCartaGUMes(
  mesLabel, any, sortides,
  { puntTrobada = PUNT_TROBADA_DEFECTE, director = DIRECTOR_DEFECTE } = {}
) {
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  const blocsSortides = sortides.map((s) => {
    const { sortida, arribada } = parteixHorari(s.horari)
    const empresa = s.colonia ? EMPRESA_PER_DETERMINAR : EMPRESA_AUTOCARS_HABITUAL
    return `
      <div class="sortida">
        ${s.colonia ? '<p class="avis">⚠ Colònies — revisa l\'empresa de transport abans d\'enviar.</p>' : ''}
        <p><strong>Empresa d'${empresa}</strong></p>
        <p>Data: ${s.data}</p>
        <p>Sortida: ${sortida || '—'}h&emsp;&emsp;Arribada: ${arribada ? arribada + 'h' : '—'}</p>
        <p>Sortida i Arribada: ${puntTrobada}</p>
        <p>Lloc: ${s.lloc || s.nom}</p>
        <p>Núm. alumnes: ${s.alumnes} (${s.nivellsText})</p>
        <p>Nº Autocars: ${s.numAutocars}</p>
      </div>
    `
  }).join('')

  finestra.document.write(`
    <html>
      <head>
        <title>GU — ${mesLabel} ${any}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 20mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
          h1 { font-size: 14px; margin: 30px 0 20px; }
          .capcalera { margin-bottom: 30px; }
          .capcalera p { margin: 0; }
          p { margin: 0 0 8px; }
          .sortida { margin: 16px 0; break-inside: avoid; }
          .avis { color: #B03030; font-weight: 700; }
          .signatura { margin-top: 60px; }
          .signatura p { margin: 0 0 4px; }
        </style>
      </head>
      <body>
        <div class="capcalera">
          <p>Guàrdia Urbana Sant Andreu</p>
          <p>Fax/ 93 256 30 71</p>
        </div>
        <h1>Assumpte: Comunicat de sortides amb autocar – Escola Mestre Enric Gibert i Camins</h1>
        <p>Srs.</p>
        <p>
          Us demanem que la Guàrdia Urbana respecti l'hora de sortida programada amb l'objectiu que
          l'activitat es pugui desenvolupar correctament. És per això que entenem que la revisió que
          han de fer es pugui portar a terme amb anterioritat a aquesta hora que us comuniquem.
        </p>
        <p><strong>Sortides:</strong></p>
        ${blocsSortides}
        <div class="signatura">
          <p>${director}</p>
          <p>Director</p>
          <p>Barcelona, ${new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </body>
    </html>
  `)
  finestra.document.close()
  setTimeout(() => finestra.print(), 350)
}
