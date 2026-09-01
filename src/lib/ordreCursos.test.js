import { describe, it, expect } from 'vitest'

import { comparaCursos } from './ordreCursos'

describe('comparaCursos', () => {
  it('Infantil (I4/I5) va abans que Primària', () => {
    const cursos = ['2n A', 'I4 A', '1r A', 'I5 B', 'I4 B', 'I5 A']
    expect(cursos.sort(comparaCursos)).toEqual(['I4 A', 'I4 B', 'I5 A', 'I5 B', '1r A', '2n A'])
  })

  it('també reconeix la notació P3/P4/P5', () => {
    const cursos = ['1r A', 'P5 A', 'P3 A', 'P4 A']
    expect(cursos.sort(comparaCursos)).toEqual(['P3 A', 'P4 A', 'P5 A', '1r A'])
  })

  it('dins del mateix nivell, ordena per la lletra de classe', () => {
    const cursos = ['3r C', '3r A', '3r B']
    expect(cursos.sort(comparaCursos)).toEqual(['3r A', '3r B', '3r C'])
  })

  it('1r darrere de 6è alfabèticament, però abans pedagògicament', () => {
    const cursos = ['6è A', '1r A']
    expect(cursos.sort(comparaCursos)).toEqual(['1r A', '6è A'])
  })

  it('un nivell no reconegut va al final, no peta', () => {
    const cursos = ['1r A', 'Sense classe']
    expect(cursos.sort(comparaCursos)).toEqual(['1r A', 'Sense classe'])
  })

  it('no peta amb buit o null', () => {
    expect(() => comparaCursos('', null)).not.toThrow()
    expect(() => comparaCursos(undefined, undefined)).not.toThrow()
  })
})
