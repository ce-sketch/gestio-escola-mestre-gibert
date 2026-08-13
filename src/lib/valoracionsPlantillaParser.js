// Lector de plantilles de Valoracions (comissions, equips i cicles).
//
// Fa el mateix que el lector del PGAC però per als fulls de valoració del
// centre. La gràcia és que **llegeix l'escala de la fórmula del full**, no
// la suposa: als fulls de comissions "En procés" val 50%, n'hi ha
// d'actuacions binàries i n'hi ha de recompte. Si el curs que ve algú
// canvia aquests números, l'app se n'assabenta sola en pujar el fitxer.
//
// Estructura d'una plantilla de comissió/equip:
//   · full "Resum"      → nom, responsable, membres i la llista d'objectius
//   · full "Objectiu N" → C4 el text de l'objectiu, i de la fila 7 endavant
//                         les actuacions (B text, D indicador, G/I fórmules)
//
// Els fulls de cicle són d'una sola pestanya i no tenen actuacions: cada
// objectiu es valora amb un percentatge directe.

import { ESCALES } from './escales'

const valorText = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return String(v)
  if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
  if (v.formula !== undefined) return ''
  // Les cel·les amb enllaç guarden { text, hyperlink }, i aquell "text" pot
  // ser al seu torn un richText — per això es torna a passar per aquí.
  if (v.text !== undefined) return valorText(v.text)
  return ''
}

const text = (cell) => valorText(cell?.value)

const formula = (cell) => {
  const v = cell?.value
  return typeof v === 'object' && v !== null && v.formula ? String(v.formula) : ''
}

const neteja = (s) => s.replace(/\s+/g, ' ').trim()

/**
 * Treu l'escala d'una fórmula del tipus
 *   if(F7="no fet", 0%, if(F7="En procés", 50%, if(F7="fet", 100%)))
 * o d'una de recompte
 *   if(F7=0, 0%, F7=1, 10%, …)
 */
export function escalaDeFormula(f) {
  if (!f) return null
  const parells = [...f.matchAll(/=\s*"?([^",()=]+?)"?\s*,\s*(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((m) => ({ label: neteja(m[1]), valor: Number(String(m[2]).replace(',', '.')) }))
    .filter((o) => o.label && !/^[A-Z]+\d+$/.test(o.label) && o.label.length < 30)
  if (parells.length < 2) return null

  const vistos = new Map()
  for (const o of parells) if (!vistos.has(o.valor)) vistos.set(o.valor, o)
  return [...vistos.values()].sort((a, b) => a.valor - b.valor)
}

/** Si les opcions coincideixen amb una escala del catàleg, en retorna l'id;
 *  si no, es guarden com a escala pròpia d'aquella actuació. */
function identifica(opcions) {
  if (!opcions) return { escala: 'execucio50', opcions: null }
  // Han de coincidir els percentatges I les etiquetes: hi ha escales del
  // catàleg amb els mateixos números però noms diferents (0/20/40/60/80/100
  // val tant per a "No assolit…Alt" com per a un recompte de 0 a 5), i
  // canviar-li els noms a l'usuari seria enganyós.
  const mateixos = (a, b) => a.length === b.length &&
    a.every((o, i) => o.valor === b[i].valor && o.label.toLowerCase() === b[i].label.toLowerCase())
  const coneguda = ESCALES.find((e) => mateixos(e.opcions, opcions))
  return coneguda ? { escala: coneguda.id, opcions: null } : { escala: 'propia', opcions }
}

// L'exceljs pesa gairebé un mega. Es carrega només quan de debò cal
// (exportar o llegir un fitxer), no en obrir l'app: així la primera càrrega
// no l'arrossega.
async function carregaExcelJS() {
  return (await import('exceljs')).default
}

/**
 * @param {ArrayBuffer} buffer  el .xlsx pujat
 * @returns {Promise<{tipus: string, valoracio: object, avisos: string[]}>}
 */
export async function llegeixPlantillaValoracio(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const fullsObjectiu = wb.worksheets.filter((ws) => /^Objectiu\s*\d+$/i.test(ws.name.trim()))
  if (fullsObjectiu.length > 0) return llegeixComissio(wb, fullsObjectiu)
  return llegeixCicle(wb)
}

// ── Comissions i equips ────────────────────────────────────────────────

function llegeixComissio(wb, fullsObjectiu) {
  const avisos = []
  const resum = wb.getWorksheet('Resum') ?? wb.worksheets[0]

  const camp = (etiqueta) => {
    for (let f = 1; f <= 20; f++) {
      for (let c = 1; c <= 4; c++) {
        const cap = neteja(text(resum.getCell(f, c)))
        if (!new RegExp(etiqueta, 'i').test(cap)) continue
        for (let seg = c + 1; seg <= 8; seg++) {
          const v = neteja(text(resum.getCell(f, seg)))
          // Les etiquetes solen estar en cel·les combinades: llegint la del
          // costat surt el mateix text, i no és el valor que busquem.
          if (v && v !== cap) return v
        }
      }
    }
    return ''
  }

  const nom = camp('Departament/comissió/servei')
  const objectius = []

  // Els fulls van "Objectiu 1", "Objectiu 2"… i cal ordenar-los pel número,
  // que si no el 10 aniria davant del 2.
  const ordenats = [...fullsObjectiu].sort(
    (a, b) => Number(a.name.replace(/\D/g, '')) - Number(b.name.replace(/\D/g, ''))
  )

  for (const ws of ordenats) {
    const titol = neteja(text(ws.getCell('C4'))) || neteja(text(ws.getCell('D4')))
    const actuacions = []

    // ── Mapa de columnes ────────────────────────────────────────────────
    // No es pot donar per fet que sempre siguin les mateixes: els objectius
    // de recollida de dades (per exemple "Enregistrar les dades del SIC")
    // intercalen columnes de text lliure entre les de sempre. Es busquen
    // pel títol de la capçalera.
    let filaCap = null
    const cols = { text: null, indicador: null, dades: {} }

    for (let f = 1; f <= Math.min(ws.rowCount, 15) && filaCap === null; f++) {
      const fila = ws.getRow(f)
      let teActuacions = false
      fila.eachCell({ includeEmpty: false }, (cell, col) => {
        if (/Actuacions?\s*\/?\s*Activitats?/i.test(neteja(text(cell)))) teActuacions = true
      })
      if (!teActuacions) continue
      filaCap = f
      fila.eachCell({ includeEmpty: false }, (cell, col) => {
        const t = neteja(text(cell))
        if (!t) return
        if (/Actuacions?\s*\/?\s*Activitats?/i.test(t)) { if (cols.text === null) cols.text = col; return }
        if (/^Indicador/i.test(t)) { if (cols.indicador === null) cols.indicador = col; return }
        if (/Seguiment|Grau\s*d.assoliment/i.test(t)) return
        // La resta de capçaleres amb text són columnes de dades. Es
        // classifiquen pel moment que anomenen.
        const moment = /inici/i.test(t) ? 'inici' : /juny/i.test(t) ? 'juny' : /gener|febrer/i.test(t) ? 'gener' : null
        if (moment && cols.dades[moment] === undefined) cols.dades[moment] = { col, etiqueta: t }
      })
    }

    if (filaCap === null) {
      avisos.push(`${ws.name}: no hi he trobat la taula d'actuacions.`)
      continue
    }

    const recullDades = Object.keys(cols.dades).length > 0
    if (recullDades) {
      avisos.push(`${ws.name}: té columnes de recollida de dades (${Object.values(cols.dades).map((d) => d.etiqueta.slice(0, 30)).join(' · ')}).`)
    }

    for (let f = filaCap + 1; f <= Math.min(ws.rowCount, filaCap + 40); f++) {
      const fila = ws.getRow(f)
      // La fila de l'AVERAGE tanca la llista d'actuacions
      let esTotal = false
      fila.eachCell({ includeEmpty: false }, (cell) => {
        if (/average/i.test(formula(cell))) esTotal = true
      })
      if (esTotal) break

      const titolAct = neteja(text(fila.getCell(cols.text ?? 2)))
      if (!titolAct) continue
      if (/^Valoració|^Recorda|^Propostes|^Resultat/i.test(titolAct)) break

      // L'escala surt de la primera fórmula de la fila que en tingui una:
      // així no depèn de quina columna ocupi.
      let opcionsEscala = null
      fila.eachCell({ includeEmpty: false }, (cell) => {
        if (opcionsEscala) return
        opcionsEscala = escalaDeFormula(formula(cell))
      })
      const { escala, opcions } = identifica(opcionsEscala)

      const dades = { inici: '', gener: '', juny: '' }
      for (const [moment, info] of Object.entries(cols.dades)) {
        dades[moment] = neteja(text(fila.getCell(info.col)))
      }

      actuacions.push({
        id: crypto.randomUUID(),
        text: titolAct,
        indicador: cols.indicador ? neteja(text(fila.getCell(cols.indicador))) : '',
        gener: '', juny: '',
        escala, opcions,
        dades,
      })
    }

    if (!titol && actuacions.length === 0) continue
    if (actuacions.length === 0) avisos.push(`${ws.name}: cap actuació llegida.`)
    objectius.push({
      id: crypto.randomUUID(),
      text: titol,
      gener: '', juny: '',
      escala: 'execucio50', opcions: null,
      recullDades,
      etiquetesDades: {
        inici: cols.dades.inici?.etiqueta ?? 'Inici de curs',
        gener: cols.dades.gener?.etiqueta ?? 'Gener',
        juny: cols.dades.juny?.etiqueta ?? 'Juny',
      },
      actuacions,
    })
  }

  if (objectius.length === 0) throw new Error("No he pogut llegir cap objectiu d'aquesta plantilla.")

  const ambPropia = objectius.flatMap((o) => o.actuacions).filter((a) => a.escala === 'propia').length
  if (ambPropia > 0) {
    avisos.push(`${ambPropia} actuacions fan servir una escala que no és cap de les conegudes; s'han desat tal com surten al full.`)
  }

  return {
    tipus: 'comissio',
    valoracio: {
      nom,
      responsable: camp('Responsable'),
      membres: camp('Membres'),
      objectius,
    },
    avisos,
  }
}

// ── Cicles (una sola pestanya, sense actuacions) ───────────────────────

function llegeixCicle(wb) {
  const avisos = []
  const ws = wb.worksheets[0]
  const objectius = []

  // Es busca la fila que fa de capçalera dels objectius: la que té "Gener"
  // i "Juny" (o "Febrer") en dues columnes.
  let filaCap = null
  let colGener = null
  let colJuny = null
  for (let f = 1; f <= Math.min(ws.rowCount, 40); f++) {
    for (let c = 1; c <= 12; c++) {
      const t = neteja(text(ws.getCell(f, c))).toLowerCase()
      if (/^(gener|febrer)$/.test(t)) { filaCap = f; colGener = c }
      if (/^juny$/.test(t) && filaCap === f) colJuny = c
    }
    if (filaCap === f && colGener && colJuny) break
    if (filaCap === f && !colJuny) { filaCap = null; colGener = null }
  }

  if (filaCap === null) {
    throw new Error("No he trobat les columnes de Gener i Juny. Comprova que és una plantilla de valoració del centre.")
  }

  for (let f = filaCap + 1; f <= ws.rowCount; f++) {
    const titol = neteja(text(ws.getCell(f, 2))) || neteja(text(ws.getCell(f, 1)))
    if (!titol) continue
    if (/^(valoració|metodologies|avaluació|propostes|grau)/i.test(titol)) break
    objectius.push({
      id: crypto.randomUUID(),
      text: titol,
      gener: '',
      juny: '',
      escala: 'lliure',   // els fulls de cicle van amb percentatge directe
      opcions: null,
      actuacions: [],
    })
  }

  if (objectius.length === 0) throw new Error("No hi he trobat cap objectiu sota la capçalera Gener/Juny.")
  avisos.push("Llegit com a full de cicle: els objectius van amb percentatge lliure i sense actuacions. Si era una comissió, comprova que el fitxer porti els fulls \"Objectiu 1\", \"Objectiu 2\"…")

  return { tipus: 'cicle', valoracio: { objectius }, avisos }
}
