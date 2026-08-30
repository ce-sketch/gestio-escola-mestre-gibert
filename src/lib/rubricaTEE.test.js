import { describe, it, expect } from 'vitest'

import {
  CICLES, cicleDe, NIVELLS_PER_CICLE, PESOS_PER_CICLE_DEFECTE, CRITERIS_TEE,
  calculaNotaAutomatica, nivellDeNota, calculaGlobalAutomatic, aEscalaComuna,
} from './rubricaTEE'

/** Tots els criteris al mateix nivell, que és el cas fàcil de comprovar
 *  a mà: la nota ha de sortir exactament al punt d'aquell nivell. */
const totsA = (nivellId) =>
  Object.fromEntries(CRITERIS_TEE.map((c) => [c.id, nivellId]))

describe('cicleDe', () => {
  it('dedueix el cicle del nom de la classe', () => {
    expect(cicleDe('I5 A')).toBe('EI')
    expect(cicleDe('1r A')).toBe('CI')
    expect(cicleDe('2n B')).toBe('CI')
    expect(cicleDe('3r A')).toBe('CM')
    expect(cicleDe('4t B')).toBe('CM')
    expect(cicleDe('5è A')).toBe('CS')
    expect(cicleDe('6è B')).toBe('CS')
  })

  it('aguanta els espais i les formes curtes', () => {
    expect(cicleDe(' 3rA ')).toBe('CM')
    expect(cicleDe('6B')).toBe('CS')
  })

  it('cau a Cicle Mitjà quan no ho sap', () => {
    // És el comportament actual i hi ha pantalles que hi compten: si es
    // canviés a null, caldria revisar-les totes.
    expect(cicleDe('')).toBe('CM')
    expect(cicleDe(null)).toBe('CM')
    expect(cicleDe('X')).toBe('CM')
  })

  it('tots els cicles que retorna tenen nom i nivells', () => {
    for (const c of ['EI', 'CI', 'CM', 'CS']) {
      expect(CICLES[c], c).toBeTruthy()
      expect(NIVELLS_PER_CICLE[c]?.length, c).toBeGreaterThan(0)
    }
  })
})

describe('NIVELLS_PER_CICLE', () => {
  it('Infantil i Cicle Inicial no tenen "No Assoliment"', () => {
    // A aquestes edats encara s'està aprenent a escriure: el full oficial
    // no hi contempla el suspens.
    expect(NIVELLS_PER_CICLE.EI.map((n) => n.id)).not.toContain('na')
    expect(NIVELLS_PER_CICLE.CI.map((n) => n.id)).not.toContain('na')
    expect(NIVELLS_PER_CICLE.CM.map((n) => n.id)).toContain('na')
  })

  it('els punts van d\'1 (millor) en amunt, sense salts', () => {
    for (const [cicle, nivells] of Object.entries(NIVELLS_PER_CICLE)) {
      expect(nivells.map((n) => n.punts), cicle).toEqual(nivells.map((_, i) => i + 1))
    }
  })

  it('cap cicle no repeteix identificadors', () => {
    for (const [cicle, nivells] of Object.entries(NIVELLS_PER_CICLE)) {
      const ids = nivells.map((n) => n.id)
      expect(ids.length, cicle).toBe(new Set(ids).size)
    }
  })

  it('tots els nivells es poden traduir a l\'escala comuna', () => {
    // Si un no s'hi pogués, desapareixeria dels resums i de la matriu
    // sense que ningú se n'adonés.
    for (const [cicle, nivells] of Object.entries(NIVELLS_PER_CICLE)) {
      for (const n of nivells) {
        expect(aEscalaComuna(n.id), `${cicle}/${n.id}`).toBeTruthy()
      }
    }
  })
})

describe('PESOS_PER_CICLE_DEFECTE', () => {
  it('els pesos de cada cicle sumen 1', () => {
    // Si no sumessin 1, la nota no arribaria mai a 10 (o el passaria).
    for (const [cicle, pesos] of Object.entries(PESOS_PER_CICLE_DEFECTE)) {
      const suma = Object.values(pesos).reduce((a, b) => a + b, 0)
      expect(suma, cicle).toBeCloseTo(1, 5)
    }
  })

  it('hi ha un pes per a cada criteri', () => {
    for (const [cicle, pesos] of Object.entries(PESOS_PER_CICLE_DEFECTE)) {
      for (const c of CRITERIS_TEE) {
        expect(pesos[c.id], `${cicle}/${c.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('Infantil pondera diferent de la resta', () => {
    // Està verificat contra el full real: no és cap còpia oblidada.
    expect(PESOS_PER_CICLE_DEFECTE.EI).not.toEqual(PESOS_PER_CICLE_DEFECTE.CM)
  })
})

describe('calculaNotaAutomatica', () => {
  // La fórmula del full és (1 - punts/4 + 0,25) × 10 × pes. Amb tots els
  // criteris al mateix nivell i pesos que sumen 1, la nota surt clavada:
  //   punts 1 → 10 · punts 2 → 7,5 · punts 3 → 5 · punts 4 → 2,5
  it('el millor nivell dona un 10', () => {
    expect(calculaNotaAutomatica('CM', totsA('ae'))).toBe(10)
  })

  it('els nivells intermedis donen els punts mitjos de la fórmula', () => {
    expect(calculaNotaAutomatica('CM', totsA('an'))).toBe(7.5)
    expect(calculaNotaAutomatica('CM', totsA('as'))).toBe(5)
    expect(calculaNotaAutomatica('CM', totsA('na'))).toBe(2.5)
  })

  it('el "NA (0 pt)" dona zero', () => {
    expect(calculaNotaAutomatica('CM', totsA('na_zero'))).toBe(0)
  })

  it('funciona igual a Infantil, amb els seus noms propis', () => {
    expect(calculaNotaAutomatica('EI', totsA('expert'))).toBe(10)
    expect(calculaNotaAutomatica('EI', totsA('aprenent'))).toBe(5)
  })

  it('els criteris sense marcar no compten: la nota surt sobre els marcats', () => {
    // Un criteri a mitges no ha de fer baixar la nota com si fos un zero.
    const nomesUn = { coherencia: 'ae' }
    // Coherència pesa 0,25 a CM → 10 × 0,25 = 2,5
    expect(calculaNotaAutomatica('CM', nomesUn)).toBe(2.5)
  })

  it('torna null si no hi ha cap criteri marcat', () => {
    expect(calculaNotaAutomatica('CM', {})).toBeNull()
  })

  it('ignora un nivell que no existeix al cicle', () => {
    // "na" no existeix a Cicle Inicial: no s'ha de colar per la porta del
    // darrere si arriba d'un registre antic o d'un canvi de classe.
    expect(calculaNotaAutomatica('CI', { coherencia: 'na' })).toBeNull()
  })

  it('accepta pesos personalitzats, que el centre pot editar', () => {
    const pesos = { coherencia: 1, lexic: 0, presentacio: 0, ortografia: 0, morfosintaxis: 0 }
    expect(calculaNotaAutomatica('CM', totsA('ae'), pesos)).toBe(10)
    expect(calculaNotaAutomatica('CM', { lexic: 'ae' }, pesos)).toBeCloseTo(0, 5)
  })

  it('arrodoneix a un decimal', () => {
    const nota = calculaNotaAutomatica('CM', { coherencia: 'ae', lexic: 'an', ortografia: 'as' })
    expect(Number.isInteger(nota * 10)).toBe(true)
  })
})

describe('nivellDeNota', () => {
  it('els llindars coincideixen amb els punts mitjos de la fórmula', () => {
    // 8,75 · 6,25 · 3,75 són els punts mitjos entre 10, 7,5, 5 i 2,5.
    expect(nivellDeNota('CM', 10).id).toBe('ae')
    expect(nivellDeNota('CM', 8.75).id).toBe('ae')
    expect(nivellDeNota('CM', 8.74).id).toBe('an')
    expect(nivellDeNota('CM', 6.25).id).toBe('an')
    expect(nivellDeNota('CM', 6.24).id).toBe('as')
    expect(nivellDeNota('CM', 3.75).id).toBe('as')
    expect(nivellDeNota('CM', 3.74).id).toBe('na')
  })

  it('a Cicle Inicial, la nota més baixa cau al darrer nivell que hi ha', () => {
    // No hi ha "No Assoliment": no pot tornar undefined ni petar.
    expect(nivellDeNota('CI', 0).id).toBe('as')
    expect(nivellDeNota('EI', 0).id).toBe('aprenent')
  })

  it('torna null sense nota', () => {
    expect(nivellDeNota('CM', null)).toBeNull()
    expect(nivellDeNota('CM', undefined)).toBeNull()
  })

  it('el 0 sí que dona nivell: és una nota, no una absència', () => {
    expect(nivellDeNota('CM', 0)).toBeTruthy()
  })
})

describe('calculaGlobalAutomatic', () => {
  it('encadena el càlcul i la traducció a nivell', () => {
    expect(calculaGlobalAutomatic('CM', totsA('an')).id).toBe('an')
  })

  it('el mateix repartiment dona el mateix nivell a tots els cicles que el tenen', () => {
    expect(calculaGlobalAutomatic('CI', totsA('ae')).id).toBe('ae')
    expect(calculaGlobalAutomatic('CS', totsA('ae')).id).toBe('ae')
    expect(calculaGlobalAutomatic('EI', totsA('expert')).id).toBe('expert')
  })

  it('torna null sense criteris', () => {
    expect(calculaGlobalAutomatic('CM', {})).toBeNull()
  })
})

describe('aEscalaComuna', () => {
  it('els noms d\'Infantil i els codis de primària van a la mateixa banda', () => {
    // És el que permet comparar un I5 amb un 6è als resums del centre.
    expect(aEscalaComuna('expert')).toBe(aEscalaComuna('ae'))
    expect(aEscalaComuna('avancat')).toBe(aEscalaComuna('an'))
    expect(aEscalaComuna('aprenent')).toBe(aEscalaComuna('as'))
  })

  it('les dues formes de suspens van a "no assoliment"', () => {
    expect(aEscalaComuna('na')).toBe('no_assoliment')
    expect(aEscalaComuna('na_zero')).toBe('no_assoliment')
  })

  it('torna null si no el reconeix, en comptes d\'endevinar-lo', () => {
    expect(aEscalaComuna('inventat')).toBeNull()
    expect(aEscalaComuna('')).toBeNull()
    expect(aEscalaComuna(null)).toBeNull()
  })
})
