// Prepara el comunicat mensual de sortides amb autocar a la Guàrdia
// Urbana, a partir del mateix document consolidat d'activitats
// complementàries que ja es fa servir a Economia i a Valoracions.
//
// Per experiència real amb els documents que omplen els mestres, la Data
// i l'Horari són text totalment lliure ("13 de novembre", "Dimarts
// 23/09/2025", "A concretar", "9.15 a 16.20", "Matí"...) — provar
// d'endevinar-los amb una expressió regular seria fràgil i, per a una
// carta oficial a la Guàrdia Urbana, un error de data no és acceptable.
//
// Per això aquest fitxer NOMÉS automatitza el que sí és fiable (detectar
// quines activitats porten autocar, mirant la columna Transport) i deixa
// la resta — mes, horari, alumnat, número d'autocars, empresa — a mans
// de qui ho revisa, amb els valors del document sempre visibles al
// costat com a referència.

import { activitatsDelCicle } from './activitatsComplementariesParser'

export const CICLES = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior']

export const EMPRESA_AUTOCARS_HABITUAL = 'Autocars Dumbo'
export const EMPRESA_PER_DETERMINAR = '(empresa per determinar)'

export const PUNT_TROBADA_DEFECTE =
  'Pg. Fabra i Puig amb Concepción Arenal (davant quiosc de flors aproximadament)'

export const DIRECTOR_DEFECTE = 'Àlvaro Molero Mateos'

export const MESOS_CURS = ['Setembre', 'Octubre', 'Novembre', 'Desembre', 'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny']

function sensAccents(text) {
  return (text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function vaAmbAutocar(activitat) {
  return sensAccents(activitat.transport).includes('autocar')
}

/** Només un indici visual (no una decisió automàtica): si el nom, la
 *  data o el preu del document suggereixen que és una sortida de més
 *  d'un dia (colònies), es marca amb un avís perquè qui ho revisi hi
 *  pari especial atenció — però qui confirma l'empresa és sempre la
 *  persona, mai el codi. */
export function sembleColonia(activitat) {
  if (sensAccents(activitat.nom).includes('coloni')) return true
  if (sensAccents(activitat.descripcio).includes('coloni')) return true
  const dies = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres']
  const text = sensAccents(activitat.data)
  const numDiesSetmana = dies.filter((d) => text.includes(d)).length
  if (numDiesSetmana >= 2) return true // p. ex. "Dijous i divendres 8 i 9 de gener"
  return false
}

/** Nombre d'alumnes actius d'un nivell ("1r", "I3"...), comptant totes
 *  les classes paral·leles (curs "1r A", "1r B"...). Retorna 0 si no en
 *  troba cap — la xifra és sempre editable a la pantalla, per si la
 *  classificació del document (p. ex. "P3" vs "I3") no hi coincideix. */
export function comptaAlumnesDelNivell(alumnesActius, nivell) {
  const objectiu = sensAccents(nivell)
  return alumnesActius.filter((a) => sensAccents(a.curs).split(' ')[0] === objectiu).length
}

/**
 * Llegeix tots els cicles del document i retorna, en pla (una fila per
 * nivell, sense combinar res), totes les activitats que porten autocar
 * — amb totes les dades originals del document tal com hi són escrites,
 * perquè qui ho revisi les tingui de referència.
 */
export function extreuActivitatsAutocar(workbook, XLSX) {
  const files = []
  for (const cicle of CICLES) {
    const activitats = activitatsDelCicle(workbook, XLSX, cicle)
    for (const act of activitats) {
      if (!vaAmbAutocar(act)) continue
      files.push({
        id: `${cicle}__${act.nivell}__${act.nom}__${files.length}`,
        cicle,
        nivell: act.nivell,
        nom: act.nom,
        descripcio: act.descripcio,
        dataText: act.data,
        horariText: act.horari,
        lloc: act.lloc,
        transportText: act.transport,
        preuText: act.preu,
        avisColonia: sembleColonia(act),
      })
    }
  }
  return files
}

/**
 * Construeix el text (editable) de la carta d'un mes, a partir de les
 * sortides ja revisades i confirmades per la persona (amb el mes,
 * l'horari, l'alumnat, el número d'autocars i l'empresa que hagi posat
 * ella mateixa). Retorna un text pla, pensat per posar-se directament a
 * un <textarea> i poder-se editar abans d'imprimir.
 */
export function textCartaGUMes(mesLabel, any, sortidesConfirmades, { puntTrobada = PUNT_TROBADA_DEFECTE, director = DIRECTOR_DEFECTE } = {}) {
  const blocs = sortidesConfirmades.map((s) => [
    `Empresa d'${s.empresa}`,
    `Data: ${s.dataText}`,
    `Sortida: ${s.horariSortida || '—'}h    Arribada: ${s.horariArribada || '—'}h`,
    `Sortida i Arribada: ${puntTrobada}`,
    `Lloc: ${s.lloc || s.nom}`,
    `Núm. alumnes: ${s.alumnes} (${s.nivell})`,
    `Nº Autocars: ${s.numAutocars}`,
  ].join('\n')).join('\n\n')

  const dataAvui = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  return [
    'Guàrdia Urbana Sant Andreu',
    'Fax/ 93 256 30 71',
    '',
    `Assumpte: Comunicat de sortides amb autocar – Escola Mestre Enric Gibert i Camins (${mesLabel} ${any})`,
    '',
    'Srs.',
    '',
    "Us demanem que la Guàrdia Urbana respecti l'hora de sortida programada amb l'objectiu que l'activitat es pugui desenvolupar correctament. És per això que entenem que la revisió que han de fer es pugui portar a terme amb anterioritat a aquesta hora que us comuniquem.",
    '',
    'Sortides:',
    '',
    blocs,
    '',
    director,
    'Director',
    `Barcelona, ${dataAvui}`,
  ].join('\n')
}

/**
 * Obre una finestra formatada amb el text (ja revisat/editat) i llança
 * el diàleg d'impressió — triant "Desa com a PDF" com a impressora
 * s'obté un PDF real. El text és el que hi hagi a la pantalla en aquell
 * moment, per tant reflecteix qualsevol canvi que s'hi hagi fet a mà.
 */
export function obreImpressioCartaGU(mesLabel, any, text) {
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  // Cada paràgraf (separat per línia en blanc) és un <p>; els salts de
  // línia dins d'un mateix paràgraf (p. ex. dins d'un bloc de sortida)
  // es respecten amb <br>.
  const html = text
    .split(/\n{2,}/)
    .map((paragraf) => `<p>${paragraf.split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>`)
    .join('')

  finestra.document.write(`
    <html>
      <head>
        <title>GU — ${mesLabel} ${any}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 20mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; color: #1a1a1a; font-size: 13px; line-height: 1.6; }
          p { margin: 0 0 14px; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `)
  finestra.document.close()
  setTimeout(() => finestra.print(), 350)
}
