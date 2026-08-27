import { describe, it, expect } from 'vitest'

import {
  COLUMNES_COMUNES, COLUMNES_CL, totalGlobal, taulaExportable,
  resumTee, resumCl, resumVl, fullsTee, fullsLectura,
} from './resumProvesTaules'

const CURSOS = ['1rA', '3rA', '5èA']

const tee = (alumneId, curs, global, trimestre = '1r trimestre') => ({
  tipus: 'tee', alumneId, curs, global, trimestre, cursEscolar: '2026-27',
})

describe('totalGlobal', () => {
  const files = [
    { curs: '1rA', comptadors: { a: 5, b: 1 }, total: 6 },
    { curs: '3rA', comptadors: { a: 2, b: 3 }, total: 5 },
  ]
  const columnes = [{ id: 'a' }, { id: 'b' }]

  it('suma totes les classes', () => {
    expect(totalGlobal(files, columnes, false)).toEqual({ comptadors: { a: 7, b: 4 }, total: 11 })
  })

  it('sap deixar 1r fora del recompte', () => {
    // A 1r encara s'està aprenent a llegir i escriure: el centre mira
    // sempre les dues xifres i comparar-les diu coses diferents.
    expect(totalGlobal(files, columnes, true)).toEqual({ comptadors: { a: 2, b: 3 }, total: 5 })
  })

  it('no peta amb la llista buida', () => {
    expect(totalGlobal([], columnes, false).total).toBe(0)
  })
})

describe('taulaExportable', () => {
  const files = [{ curs: '1rA', comptadors: { a: 2, b: 1 }, total: 3 }]
  const columnes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]

  it('posa la capçalera i les dues files de TOTAL', () => {
    const taula = taulaExportable('Classe', files, columnes)
    expect(taula[0]).toEqual(['Classe', 'A', 'B', 'Total avaluats'])
    expect(taula.at(-2)[0]).toBe('TOTAL (amb 1r)')
    expect(taula.at(-1)[0]).toBe('TOTAL (sense 1r)')
  })

  it('el total sense 1r deixa fora la classe de primer', () => {
    const taula = taulaExportable('Classe', files, columnes)
    expect(taula.at(-1).slice(1)).toEqual([0, 0, 0])
  })

  it('accepta columnes que són cadenes soltes, com les de CL', () => {
    const taula = taulaExportable('Classe', [{ curs: '3rA', comptadors: { BAIX: 1 }, total: 1 }], COLUMNES_CL)
    expect(taula[0]).toEqual(['Classe', ...COLUMNES_CL, 'Total avaluats'])
  })
})

describe('resumTee', () => {
  const opcions = { trimestre: '1r trimestre', cursos: CURSOS, cursEscolarId: '2026-27' }

  it('compta els alumnes de cada classe per franja', () => {
    const files = resumTee([
      tee('a', '3rA', 'avancat'),
      tee('b', '3rA', 'an'),
    ], opcions)
    const fila = files.find((f) => f.curs === '3rA')
    expect(fila.total).toBe(2)
  })

  it('deixa fora els registres d\'un altre trimestre', () => {
    const files = resumTee([tee('a', '3rA', 'avancat', '3r trimestre')], opcions)
    expect(files.find((f) => f.curs === '3rA').total).toBe(0)
  })

  it('deixa fora els registres d\'un altre curs escolar', () => {
    const files = resumTee([{ ...tee('a', '3rA', 'avancat'), cursEscolar: '2020-21' }], opcions)
    expect(files.find((f) => f.curs === '3rA').total).toBe(0)
  })

  it('dona una fila per classe encara que no tinguin dades', () => {
    expect(resumTee([], opcions).map((f) => f.curs)).toEqual(CURSOS)
  })
})

describe('resumCl i resumVl', () => {
  const opcions = { cursos: CURSOS, cursEscolarId: '2026-27' }
  const lectura = (alumneId, curs, moment, camps) => ({
    tipus: 'lectura', alumneId, curs, moment, cursEscolar: '2026-27', ...camps,
  })

  it('la comprensió es reparteix pels quatre trams', () => {
    const resultats = resumCl([lectura('a', '3rA', 'inicial', { nivellCl: 'ALT' })], opcions)
    const inicial = resultats.find((r) => r.momentId === 'inicial')
    expect(inicial.files.find((f) => f.curs === '3rA').comptadors.ALT).toBe(1)
  })

  it('la velocitat es compara amb el que s\'espera del propi curs', () => {
    // El mateix nivell lector no vol dir el mateix a cada curs: "I5" és
    // molt per sobre a 3r i just el propi nivell a 5è. A 1r, en canvi, la
    // rúbrica mira directament les paraules per minut.
    const a3r = resumVl([lectura('a', '3rA', 'inicial', { vl: 90, nivellVl: 'I5' })], opcions)
    const a5e = resumVl([lectura('b', '5èA', 'inicial', { vl: 90, nivellVl: 'I5' })], opcions)
    const fila3r = a3r[0].files.find((f) => f.curs === '3rA')
    const fila5e = a5e[0].files.find((f) => f.curs === '5èA')
    expect(fila3r.total).toBe(1)
    expect(fila5e.total).toBe(1)
    expect(fila3r.comptadors).not.toEqual(fila5e.comptadors)
  })

  it('ignora els registres sense velocitat', () => {
    const resultats = resumVl([lectura('a', '3rA', 'inicial', { vl: null })], opcions)
    expect(resultats[0].files.find((f) => f.curs === '3rA').total).toBe(0)
  })

  it('a 1r la velocitat es mesura en paraules per minut, sense nivell lector', () => {
    const resultats = resumVl([lectura('a', '1rA', 'inicial', { vl: 25 })], opcions)
    expect(resultats[0].files.find((f) => f.curs === '1rA').total).toBe(1)
  })
})

describe('fullsTee i fullsLectura', () => {
  const opcions = { trimestre: '1r trimestre', cursos: CURSOS, cursEscolarId: '2026-27' }

  it('el full del TEE porta el trimestre al nom', () => {
    const [full] = fullsTee([], opcions)
    expect(full.nom).toContain('1r trimestre')
  })

  it('la lectura dona un full per moment de CL i un per moment de VL', () => {
    const fulls = fullsLectura([], { cursos: CURSOS, cursEscolarId: '2026-27' })
    expect(fulls.filter((f) => f.nom.startsWith('CL')).length).toBe(2)
    expect(fulls.filter((f) => f.nom.startsWith('VL')).length).toBeGreaterThan(0)
  })

  it('els noms dels fulls caben dins del límit d\'Excel', () => {
    const fulls = [...fullsTee([], opcions), ...fullsLectura([], opcions)]
    expect(fulls.every((f) => f.nom.length <= 31)).toBe(true)
  })

  it('les columnes comunes són les quatre franges d\'assoliment', () => {
    expect(COLUMNES_COMUNES).toHaveLength(4)
  })
})
