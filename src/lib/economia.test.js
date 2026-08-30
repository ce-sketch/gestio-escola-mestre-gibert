import { describe, it, expect } from 'vitest'

import {
  ENSENYAMENTS, CURSOS, CONCEPTES, conceptaBuit, filaBuida,
  totalConcepte, totalFila, totalCobratFila,
} from './economia'

describe('estructures buides', () => {
  it('una fila buida porta tots els conceptes', () => {
    // Si en faltés algun, el formulari no el mostraria i es lliuraria una
    // plantilla incompleta al Departament.
    const fila = filaBuida('Primària', '3r')
    for (const c of CONCEPTES) expect(fila.conceptes[c.id], c.id).toBeTruthy()
  })

  it('els camps buits són cadenes, no zeros', () => {
    // Un 0 al formulari sembla una xifra decidida; el buit diu que encara
    // no s'ha omplert.
    const c = conceptaBuit()
    expect(Object.values(c).every((v) => v === '')).toBe(true)
    expect(filaBuida().numAlumnes).toBe('')
  })

  it('conserva l\'ensenyament i el curs que se li donen', () => {
    const fila = filaBuida('ESO', '1r')
    expect(fila.ensenyament).toBe('ESO')
    expect(fila.curs).toBe('1r')
  })
})

describe('totalConcepte', () => {
  it('aplica la fórmula de la plantilla: alumnes × import − reducció', () => {
    expect(totalConcepte(25, { importUnitari: 10, reduccio: 50 })).toBe(200)
  })

  it('sense reducció, és la multiplicació', () => {
    expect(totalConcepte(25, { importUnitari: 10, reduccio: '' })).toBe(250)
  })

  it('els camps buits compten com a zero, no com a NaN', () => {
    // Un NaN es propagaria a tots els totals de la pàgina.
    expect(totalConcepte('', {})).toBe(0)
    expect(totalConcepte(25, {})).toBe(0)
    expect(totalConcepte(null, null)).toBe(0)
  })

  it('accepta els números escrits com a text, que és com vénen del formulari', () => {
    expect(totalConcepte('25', { importUnitari: '10', reduccio: '50' })).toBe(200)
  })

  it('una reducció més gran que l\'import dona negatiu, no zero', () => {
    // És el que fa el full: amagar-ho taparia un error d'introducció.
    expect(totalConcepte(1, { importUnitari: 10, reduccio: 50 })).toBe(-40)
  })
})

describe('totalFila', () => {
  it('suma tots els conceptes de la fila', () => {
    const fila = filaBuida('Primària', '3r')
    fila.numAlumnes = 10
    fila.conceptes[CONCEPTES[0].id].importUnitari = 5
    fila.conceptes[CONCEPTES[1].id].importUnitari = 3
    expect(totalFila(fila)).toBe(80)
  })

  it('una fila sense res val zero', () => {
    expect(totalFila(filaBuida())).toBe(0)
  })
})

describe('totalCobratFila', () => {
  it('suma els dos anys de cobrament', () => {
    // Les quotes es cobren a cavall de dos anys naturals.
    const fila = filaBuida()
    fila.conceptes[CONCEPTES[0].id].cobratAny1 = 100
    fila.conceptes[CONCEPTES[0].id].cobratAny2 = 50
    expect(totalCobratFila(fila)).toBe(150)
  })

  it('els buits no fan saltar el total', () => {
    expect(totalCobratFila(filaBuida())).toBe(0)
  })
})

describe('catàlegs', () => {
  it('cap concepte no repeteix identificador', () => {
    const ids = CONCEPTES.map((c) => c.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('hi ha ensenyaments i cursos per omplir la plantilla', () => {
    expect(ENSENYAMENTS.length).toBeGreaterThan(0)
    expect(CURSOS).toContain('I3')
    expect(CURSOS).toContain('6è')
  })
})
