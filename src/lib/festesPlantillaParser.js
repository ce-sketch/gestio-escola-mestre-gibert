// Lector de les plantilles "Valoració [Festa]" del centre.
//
// Com és el full d'un grup (verificat amb la Castanyada)
// ------------------------------------------------------
//   Educació Infantil                    ← nom del grup, sol, a dalt
//   -Fomentar la cohesió…   | Grau d'assoliment de l'objectiu
//   Exposició de carbasses… | No assolit | 0 | %
//   Espai compartit…        | No assolit | 0 | %
//   ...
//   Comentaris i propostes de millora
//
// El grau ve com a **text** al costat de l'activitat ("No assolit", "Bo"…),
// i el número a la columna següent. No hi ha cap fórmula per llegir ni
// l'escala escrita dins del criteri, com passava al cooperatiu.
//
// Dues coses que costen i que expliquen com està escrit això:
//
// 1. **Les columnes no són sempre les mateixes.** Es localitzen pel títol:
//    la cel·la que diu "Grau d'assoliment de l'objectiu" marca la columna
//    del grau, i el text de l'objectiu és a la de la seva esquerra.
//
// 2. **Els objectius de cada grup són els seus.** L'Equip Directiu no té
//    els mateixos que els cicles, i el text tampoc no coincideix paraula per
//    paraula amb el del full Resum (al Resum de la Castanyada hi diu
//    "Elaboorar", amb una o de més). Per això aquí no s'emparella res amb
//    el Resum: cada full es llegeix sencer i sol.

import { grauDeText, NOMS_ALTERNATIUS } from './festesDetall'

const MARCA_OBJECTIU = /grau\s+d.assoliment\s+de\s+l.objectiu/i
const MARCA_COMENTARIS = /^comentaris/i

/** Files que hi ha a tots els fulls i que no són ni el grup ni cap objectiu. */
const SOROLL = [
  /^escola mestre/i,
  /^pgac\s*\/?$/i,
  /^curs:/i,
  /^activitat:/i,
  /^nivell:/i,
  /^data:/i,
  /^-?\s*recorda que si copies/i,
  /^(no assolit|baix|poc satisfactori|satisfactori|bo|alt)$/i,
  /^%$/,
]

function textCella(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

function esSoroll(text) {
  return !text || SOROLL.some((r) => r.test(text))
}

function netejaObjectiu(text) {
  return text.replace(/^-+\s*/, '').trim()
}

/**
 * Llegeix el full d'un grup i en treu el nom, els seus objectius i, dins de
 * cada un, les activitats amb el grau que tinguin marcat.
 *
 * @param {Array<Array>} files  el full ja llegit (array d'arrays)
 * @returns {{nom: string, objectius: Array, comentaris: string}|null}
 */
export function interpretaFullGrupFesta(files) {
  let nom = ''
  const objectius = []
  let actual = null
  let colText = null
  let colGrau = null
  let comentaris = ''
  let dinsDeComentaris = false

  for (const fila of files) {
    const cel·les = (fila ?? []).map(textCella)

    // La marca d'un objectiu nou: la columna on hi ha "Grau d'assoliment de
    // l'objectiu" fixa on són el text i el grau a partir d'ara.
    const idxMarca = cel·les.findIndex((c) => MARCA_OBJECTIU.test(c))
    if (idxMarca > 0) {
      colText = idxMarca - 1
      colGrau = idxMarca
      const text = netejaObjectiu(cel·les[colText] ?? '')
      actual = { text, activitats: [], comentaris: '' }
      objectius.push(actual)
      dinsDeComentaris = false
      continue
    }

    const primer = cel·les.find((c) => c && !esSoroll(c)) ?? ''

    if (MARCA_COMENTARIS.test(primer)) { dinsDeComentaris = true; continue }
    if (dinsDeComentaris) {
      if (primer && !esSoroll(primer)) comentaris = comentaris ? `${comentaris}\n${primer}` : primer
      continue
    }

    // Abans del primer objectiu, l'única cosa que hi ha escrita és el nom
    // del grup.
    if (actual === null) {
      if (!nom && primer && !esSoroll(primer)) nom = primer
      continue
    }

    const text = textCella(fila?.[colText])
    if (!text || esSoroll(text)) continue
    actual.activitats.push({ text, grau: grauDeText(fila?.[colGrau]) })
  }

  if (!nom && objectius.length === 0) return null
  return { nom: NOMS_ALTERNATIUS[nom] ?? nom, objectius, comentaris }
}

/** Els pesos entre grups, escrits al text lliure dels criteris del Resum:
 *  "Cicles: 80% · Equip de coordnació: 0% · Equip directiu: 20%".
 *  Ull amb la falta a "coordnació", que és al document original. */
export function interpretaPesosFesta(filesResum) {
  const tot = (filesResum ?? []).map((f) => (f ?? []).map(textCella).join(' ')).join(' ')
  const busca = (patro, defecte) => {
    const m = tot.match(patro)
    return m ? Number(m[1]) : defecte
  }
  return {
    cicle: busca(/cicles\s*:\s*(\d+)\s*%/i, 80),
    coordinacio: busca(/coord\w*\s*:\s*(\d+)\s*%/i, 0),
    directiu: busca(/equip\s+directiu\s*:\s*(\d+)\s*%/i, 20),
  }
}

/** Els pesos de cada objectiu, també escrits als criteris. */
export function interpretaPesosObjectius(filesResum) {
  const tot = (filesResum ?? []).map((f) => (f ?? []).map(textCella).join(' ')).join(' ')
  const pesos = {}
  for (const m of tot.matchAll(/objectiu\s*(\d+)\s*:\s*(\d+)\s*%/gi)) {
    pesos[Number(m[1])] = Number(m[2])
  }
  return pesos
}

/** Nom de la festa i data, del full Resum. */
export function interpretaCapcaleraFesta(filesResum) {
  let activitat = ''
  let data = ''
  for (const fila of filesResum ?? []) {
    const cel·les = (fila ?? []).map(textCella)
    for (let i = 0; i < cel·les.length - 1; i++) {
      if (/^activitat:?$/i.test(cel·les[i]) && !activitat) activitat = cel·les[i + 1]
      if (/^data:?$/i.test(cel·les[i]) && !data) data = cel·les[i + 1]
    }
  }
  return { activitat, data }
}
