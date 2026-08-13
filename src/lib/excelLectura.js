// Funcions compartides pels lectors de plantilles.
//
// Els tres lectors —PGAC, Valoracions i el del Quadre de comandament— feien
// per separat la mateixa feina de sempre: llegir una cel·la, treure'n el
// text, interpretar l'escala. I com que estaven per triplicat, els errors
// també: el famós `[object Object]` de les cel·les amb enllaç es va
// arreglar en un lector i seguia sortint als altres dos.
//
// Aquí hi ha una sola versió de cada cosa. Si un dia apareix un format de
// cel·la nou, s'arregla en un lloc i queda arreglat als tres.

import { ESCALES } from './escales'

/** L'exceljs pesa gairebé un mega: es carrega només quan de debò cal. */
export async function carregaExcelJS() {
  return (await import('exceljs')).default
}

/**
 * El text d'un valor de cel·la, sigui quin sigui el format que hi hagi.
 *
 * L'exceljs retorna coses molt diferents segons la cel·la:
 *   · text pla o número          → tal qual
 *   · text amb formats barrejats → { richText: [...] }
 *   · fórmula                    → { formula, result }
 *   · enllaç                     → { text, hyperlink }, i el "text" pot ser
 *                                  al seu torn un richText
 *   · error de fórmula           → { error: '#REF!' }
 */
export function valorText(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toLocaleDateString('ca-ES')
  if (typeof v !== 'object') return String(v)
  if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
  if (v.formula !== undefined || v.sharedFormula !== undefined) {
    return v.result === null || v.result === undefined ? '' : valorText(v.result)
  }
  if (v.text !== undefined) return valorText(v.text)
  if (v.error !== undefined) return ''
  return ''
}

/** El text d'una cel·la d'exceljs. */
export const text = (cell) => valorText(cell?.value)

/** El text d'una cel·la, amb els espais sobrers arreglats. */
export const textNet = (cell) => neteja(text(cell))

/** La fórmula d'una cel·la, o cadena buida si no en té. */
export function formula(cell) {
  const v = cell?.value
  if (typeof v !== 'object' || v === null) return ''
  return String(v.formula ?? v.sharedFormula ?? '')
}

export const neteja = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Els pesos dels fulls van de 0 a 1; l'app els fa servir de 0 a 100. */
export const aPercentatge = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 10 : null)

/** El número d'una cel·la, o null si no n'hi ha. */
export function numero(cell) {
  const v = cell?.value
  const n = typeof v === 'object' && v !== null ? v.result : v
  return typeof n === 'number' ? n : null
}

// ── Escales ─────────────────────────────────────────────────────────────

/**
 * Treu l'escala d'una FÓRMULA, com les dels fulls de comissions:
 *   if(F7="no fet", 0%, if(F7="En procés", 50%, if(F7="fet", 100%)))
 *   if(F7=0, 0%, F7=1, 10%, …)
 */
export function escalaDeFormula(f) {
  if (!f) return null
  const parells = [...String(f).matchAll(/=\s*"?([^",()=]+?)"?\s*,\s*(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((m) => ({ label: neteja(m[1]), valor: Number(String(m[2]).replace(',', '.')) }))
    .filter((o) => o.label && !/^[A-Z]+\d+$/.test(o.label) && o.label.length < 30)
  return parells.length >= 2 ? ordena(parells) : null
}

/**
 * Treu l'escala d'un TEXT, com els criteris del PGAC:
 *   "Fet=100% En procés=40% No fet= 0%"
 *   "0 convenis = No assolit / 1 conveni = Bo / 2-3 convenis = Alt"
 */
export function escalaDeText(descripcio) {
  if (!descripcio) return null
  const net = neteja(descripcio).replace(/,(\d)/g, '.$1') // 66,7% → 66.7%

  const parells = [...net.matchAll(/([^=/·,;]+?)\s*=\s*(\d+(?:\.\d+)?)\s*%/g)]
    .map((m) => ({ label: neteja(m[1]).replace(/^[-–·\s]+/, ''), valor: Number(m[2]) }))
    .filter((o) => o.label && o.label.length < 40)
  if (parells.length >= 2) return ordena(parells)

  // Cas sense percentatges escrits: les etiquetes coincideixen amb una
  // escala qualitativa que ja coneixem.
  const coneguda = ESCALES.find((e) =>
    e.opcions.length >= 2 &&
    e.opcions.every((o) => new RegExp(`\\b${escapa(o.label)}\\b`, 'i').test(net)))
  return coneguda ? coneguda.opcions.map((o) => ({ ...o })) : null
}

const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function ordena(opcions) {
  const vistos = new Map()
  for (const o of opcions) if (!vistos.has(o.valor)) vistos.set(o.valor, o)
  return [...vistos.values()].sort((a, b) => a.valor - b.valor)
}

/**
 * Mira si les opcions llegides són una escala del catàleg.
 *
 * Han de coincidir els percentatges I les etiquetes: n'hi ha amb els
 * mateixos números i noms diferents (0/20/40/60/80/100 val tant per a
 * "No assolit…Alt" com per a un recompte de 0 a 5), i canviar-li els noms a
 * qui ho ha escrit seria enganyós. Si no encaixa amb cap, es desa tal com
 * surt al full.
 */
export function identificaEscala(opcions, perDefecte = 'execucio') {
  if (!opcions) return { escala: perDefecte, opcions: null }
  const igual = (a, b) => a.length === b.length &&
    a.every((o, i) => o.valor === b[i].valor && o.label.toLowerCase() === b[i].label.toLowerCase())
  const coneguda = ESCALES.find((e) => igual(e.opcions, opcions))
  return coneguda ? { escala: coneguda.id, opcions: null } : { escala: 'propia', opcions }
}

// ── Cel·les i columnes ──────────────────────────────────────────────────

/**
 * Busca, dins d'un rang de files, la que fa de capçalera d'una taula, i
 * retorna en quina columna hi ha cada títol.
 *
 * No es poden donar per fetes les posicions: les plantilles del centre
 * canvien d'un curs a l'altre i n'hi ha que intercalen columnes (els
 * objectius de recollida de dades, per exemple).
 *
 * @param {object} ws
 * @param {RegExp} ancora   el títol que identifica la capçalera
 * @param {number} finsFila fins on buscar
 * @returns {{fila: number, columnes: Array<{col: number, titol: string}>} | null}
 */
export function trobaCapcalera(ws, ancora, finsFila = 15) {
  for (let f = 1; f <= Math.min(ws.rowCount, finsFila); f++) {
    const fila = ws.getRow(f)
    let hi = false
    const columnes = []
    fila.eachCell({ includeEmpty: false }, (cell, col) => {
      const t = textNet(cell)
      if (!t) return
      columnes.push({ col, titol: t })
      if (ancora.test(t)) hi = true
    })
    if (hi) return { fila: f, columnes }
  }
  return null
}

/** La primera columna la capçalera de la qual encaixa amb el patró. */
export function columnaAmb(columnes, patro) {
  return columnes.find((c) => patro.test(c.titol))?.col ?? null
}
