import { describe, it, expect } from 'vitest'

import {
  NIVELLS_TEBEROSKY, ETAPES_TEBEROSKY, esClasseEI4o5, nivellsBuits,
  comptaNivells, fullResumEI, CAPÇALERA_RESUM_EI, historicEI, fullHistoricEI,
} from './lectoescripturaEI'

describe('esClasseEI4o5', () => {
  it('accepta les classes d\'I4 i I5', () => {
    expect(esClasseEI4o5('I4A')).toBe(true)
    expect(esClasseEI4o5('I5B')).toBe(true)
  })

  it('no accepta I3 ni primària', () => {
    expect(esClasseEI4o5('I3A')).toBe(false)
    expect(esClasseEI4o5('1rA')).toBe(false)
    expect(esClasseEI4o5('6èB')).toBe(false)
  })

  it('no peta amb valors buits', () => {
    expect(esClasseEI4o5('')).toBe(false)
    expect(esClasseEI4o5(null)).toBe(false)
  })
})

describe('comptaNivells', () => {
  const marques = {
    a: { dibuix: true, grafismes_primitius: true },
    b: { dibuix: true },
    c: {},
  }

  it('compta quants alumnes han assolit cada nivell', () => {
    const comptes = comptaNivells(['a', 'b', 'c'], marques)
    expect(comptes.dibuix).toBe(2)
    expect(comptes.grafismes_primitius).toBe(1)
  })

  it('un alumne pot tenir diversos nivells marcats alhora', () => {
    // No és una tria única: als fulls originals cada nivell és una casella
    // independent i es van marcant a mesura que l'infant avança.
    const comptes = comptaNivells(['a'], marques)
    expect(comptes.dibuix + comptes.grafismes_primitius).toBe(2)
  })

  it('dona zero a tots els nivells si no hi ha marques', () => {
    const comptes = comptaNivells(['x'], {})
    expect(Object.values(comptes).every((v) => v === 0)).toBe(true)
  })

  it('inclou tots els nivells de l\'escala, encara que siguin a zero', () => {
    const comptes = comptaNivells([], {})
    expect(Object.keys(comptes)).toHaveLength(NIVELLS_TEBEROSKY.length)
  })
})

describe('nivellsBuits', () => {
  it('dona una casella per nivell, totes desmarcades', () => {
    const buits = nivellsBuits()
    expect(Object.keys(buits)).toHaveLength(NIVELLS_TEBEROSKY.length)
    expect(Object.values(buits).every((v) => v === false)).toBe(true)
  })
})

describe('fullResumEI', () => {
  const perClasse = [
    { classe: 'I4A', total: 20, comptes: { ...Object.fromEntries(NIVELLS_TEBEROSKY.map((n) => [n.id, 0])), dibuix: 12 } },
    { classe: 'I5A', total: 22, comptes: { ...Object.fromEntries(NIVELLS_TEBEROSKY.map((n) => [n.id, 0])), dibuix: 8 } },
  ]

  it('fa una fila per classe, més TOTAL i percentatges', () => {
    const { files } = fullResumEI(perClasse)
    expect(files.slice(1).map((f) => f[0])).toEqual(['I4A', 'I5A', 'TOTAL', '% del centre'])
  })

  it('la capçalera porta una columna per nivell', () => {
    const { files } = fullResumEI(perClasse)
    expect(files[0]).toEqual(CAPÇALERA_RESUM_EI)
    expect(files[0]).toHaveLength(NIVELLS_TEBEROSKY.length + 2)
  })

  it('suma les classes al TOTAL', () => {
    const { files } = fullResumEI(perClasse)
    const total = files.find((f) => f[0] === 'TOTAL')
    expect(total[1]).toBe(42)           // alumnes
    expect(total[2]).toBe(20)           // dibuix: 12 + 8
  })

  it('calcula el percentatge sobre el total d\'alumnes de l\'etapa', () => {
    const { files } = fullResumEI(perClasse)
    const pct = files.find((f) => f[0] === '% del centre')
    expect(pct[2]).toBeCloseTo(47.6, 1) // 20 de 42
  })

  it('no divideix per zero si no hi ha cap alumne', () => {
    const { files } = fullResumEI([{ classe: 'I4A', total: 0, comptes: {} }])
    const pct = files.find((f) => f[0] === '% del centre')
    expect(pct.slice(2).every((v) => v === 0)).toBe(true)
  })

  it('porta les etapes com a grups de columnes, per fusionar-les a l\'exportació', () => {
    const { grups } = fullResumEI(perClasse)
    expect(grups).toHaveLength(ETAPES_TEBEROSKY.length)
    expect(grups.reduce((t, g) => t + g.span, 0)).toBe(NIVELLS_TEBEROSKY.length)
  })

  it('el nom del full cap dins del límit d\'Excel', () => {
    expect(fullResumEI(perClasse).nom.length).toBeLessThanOrEqual(31)
  })
})

describe('historicEI', () => {
  const documents = [
    { cursEscolar: '2024-25', classe: 'I4A', alumnes: { a: { dibuix: true }, b: { dibuix: true, grafismes_primitius: true } } },
    { cursEscolar: '2025-26', classe: 'I5B', alumnes: { c: { dibuix: true } } },
    { cursEscolar: '2025-26', classe: 'I4A', alumnes: { d: {} } },
  ]

  it('posa el curs més recent primer, i dins del curs ordena per classe', () => {
    const files = historicEI(documents)
    expect(files.map((f) => `${f.cursEscolar} ${f.classe}`))
      .toEqual(['2025-26 I4A', '2025-26 I5B', '2024-25 I4A'])
  })

  it('compta els alumnes del propi document, no de la fitxa actual', () => {
    // Els alumnes de fa tres cursos ja no consten com a actius: l'única
    // font possible és el document desat.
    const files = historicEI(documents)
    expect(files.find((f) => f.cursEscolar === '2024-25').ambDades).toBe(2)
  })

  it('recompta els nivells de cada càrrega', () => {
    const files = historicEI(documents)
    const del24 = files.find((f) => f.cursEscolar === '2024-25')
    expect(del24.comptes.dibuix).toBe(2)
    expect(del24.comptes.grafismes_primitius).toBe(1)
  })

  it('descarta els documents sense curs o sense classe', () => {
    expect(historicEI([{ alumnes: {} }, { cursEscolar: '2025-26' }])).toEqual([])
  })

  it('no peta sense documents', () => {
    expect(historicEI([])).toEqual([])
    expect(historicEI(null)).toEqual([])
  })
})

describe('fullHistoricEI', () => {
  it('fa una fila per càrrega, amb curs i classe', () => {
    const files = historicEI([
      { cursEscolar: '2025-26', classe: 'I4A', alumnes: { a: { dibuix: true } } },
    ])
    const { files: taula } = fullHistoricEI(files)
    expect(taula[0].slice(0, 3)).toEqual(['Curs', 'Classe', 'Amb dades'])
    expect(taula[1].slice(0, 3)).toEqual(['2025-26', 'I4A', 1])
  })

  it('la capçalera porta una columna per nivell', () => {
    const { files } = fullHistoricEI([])
    expect(files[0]).toHaveLength(NIVELLS_TEBEROSKY.length + 3)
  })
})
