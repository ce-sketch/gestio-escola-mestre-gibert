import { describe, it, expect } from 'vitest'

import {
  notaFinalArea, notaFinalAmbCorreccio, TRIMESTRES, TRIMESTRE_FINAL, AREES,
} from './notesArea'

/** Construeix el lector que espera `notaFinalAmbCorreccio`. */
const lector = (perTrimestre) => (t) => perTrimestre[t] ?? ''

describe('notaFinalArea', () => {
  it('fa la mitjana dels trimestres', () => {
    expect(notaFinalArea([6, 7, 8])).toBe(7)
  })

  it('no espera que hi siguin els tres', () => {
    // Al full original la fórmula no es dispara fins que el 3r trimestre
    // té nota; aquí la final es pot consultar durant el curs.
    expect(notaFinalArea([6, '', ''])).toBe(6)
    expect(notaFinalArea([6, '', 8])).toBe(7)
  })

  it('torna null si no n\'hi ha cap', () => {
    expect(notaFinalArea(['', '', ''])).toBeNull()
    expect(notaFinalArea([])).toBeNull()
    expect(notaFinalArea(null)).toBeNull()
  })

  it('arrodoneix a un decimal', () => {
    expect(notaFinalArea([4, 5, 7])).toBe(5.3)
  })
})

describe('notaFinalAmbCorreccio', () => {
  const trimestres = { [TRIMESTRES[0]]: 4, [TRIMESTRES[1]]: 5, [TRIMESTRES[2]]: 7 }

  it('sense correcció, dona la mitjana', () => {
    expect(notaFinalAmbCorreccio(lector(trimestres))).toBe(5.3)
  })

  it('amb correcció, mana la del mestre', () => {
    // La mitjana aritmètica no sempre reflecteix on ha arribat l'alumne:
    // una remuntada clara al tercer trimestre val més que el 4 del primer.
    expect(notaFinalAmbCorreccio(lector({ ...trimestres, [TRIMESTRE_FINAL]: 7 }))).toBe(7)
  })

  it('una correcció buidada torna a la mitjana', () => {
    expect(notaFinalAmbCorreccio(lector({ ...trimestres, [TRIMESTRE_FINAL]: '' }))).toBe(5.3)
    expect(notaFinalAmbCorreccio(lector({ ...trimestres, [TRIMESTRE_FINAL]: null }))).toBe(5.3)
  })

  it('accepta un 0 com a correcció, que és una nota vàlida', () => {
    // El parany clàssic: amb una comprovació de veritat/falsedat, un 0
    // s'hauria pres per "no n'hi ha cap" i hauria tornat la mitjana.
    expect(notaFinalAmbCorreccio(lector({ ...trimestres, [TRIMESTRE_FINAL]: 0 }))).toBe(0)
  })

  it('ignora una correcció que no és un número', () => {
    expect(notaFinalAmbCorreccio(lector({ ...trimestres, [TRIMESTRE_FINAL]: 'notable' }))).toBe(5.3)
  })

  it('la correcció val encara que no hi hagi cap trimestre', () => {
    // Cas real: un alumne que arriba a mig curs i només se li posa la final.
    expect(notaFinalAmbCorreccio(lector({ [TRIMESTRE_FINAL]: 8 }))).toBe(8)
  })

  it('sense res, torna null', () => {
    expect(notaFinalAmbCorreccio(lector({}))).toBeNull()
  })
})

describe('AREES', () => {
  it('les calculades diuen de quines àrees surten', () => {
    for (const a of AREES.filter((x) => x.calculada)) {
      expect(a.deArees?.length, a.id).toBeGreaterThan(0)
      // I aquelles àrees han d'existir de debò.
      for (const id of a.deArees) {
        expect(AREES.some((x) => x.id === id), `${a.id} → ${id}`).toBe(true)
      }
    }
  })

  it('cap àrea calculada no en depèn d\'una altra de calculada', () => {
    // Si passés, l'ordre de càlcul deixaria de ser evident.
    for (const a of AREES.filter((x) => x.calculada)) {
      for (const id of a.deArees) {
        expect(AREES.find((x) => x.id === id)?.calculada, `${a.id} → ${id}`).toBeFalsy()
      }
    }
  })

  it('no hi ha ids repetits', () => {
    const ids = AREES.map((a) => a.id)
    expect(ids.length).toBe(new Set(ids).size)
  })
})
