import { describe, it, expect } from 'vitest'

import {
  esClasseAmbLectura, nivellVL, nivellCL, LLINDARS_CL_DEFECTE, MOMENTS_LECTURA,
  clAEscalaComuna, grauPrimaria, vlAEscalaComuna,
} from './rubricaLectura'

describe('esClasseAmbLectura', () => {
  it('la VL/CL no es fa a Educació Infantil', () => {
    // El full oficial no té barem per a I3-I5: allà encara no es llegeix
    // amb aquest sentit.
    expect(esClasseAmbLectura('I3 A')).toBe(false)
    expect(esClasseAmbLectura('I5 B')).toBe(false)
  })

  it('es fa de 1r a 6è', () => {
    for (const c of ['1r A', '2n B', '3r A', '4t B', '5è A', '6è B']) {
      expect(esClasseAmbLectura(c), c).toBe(true)
    }
  })
})

describe('grauPrimaria', () => {
  it('treu el número de curs del nom de la classe', () => {
    expect(grauPrimaria('1r A')).toBe(1)
    expect(grauPrimaria('6è B')).toBe(6)
    expect(grauPrimaria('4rtA')).toBe(4)
  })

  it('torna null a Infantil i amb valors buits', () => {
    expect(grauPrimaria('I5 A')).toBeNull()
    expect(grauPrimaria('')).toBeNull()
    expect(grauPrimaria(null)).toBeNull()
  })
})

describe('nivellVL', () => {
  it('tradueix les paraules per minut al nivell lector', () => {
    // Llindars del full: 24 → M1, 44 → I2, 73 → I3, 143 → ESO2.
    expect(nivellVL(24)).toBe('M1')
    expect(nivellVL(44)).toBe('I2')
    expect(nivellVL(73)).toBe('I3')
    expect(nivellVL(143)).toBe('ESO2')
  })

  it('just per sota d\'un llindar cau al nivell anterior', () => {
    // El punt on més fàcil és equivocar-se en escriure la taula.
    expect(nivellVL(23)).toBe('I1')
    expect(nivellVL(43)).toBe('F1')
    expect(nivellVL(72)).toBe('F2')
  })

  it('una lectura molt lenta cau al primer nivell, no a null', () => {
    expect(nivellVL(0)).toBe('I1')
    expect(nivellVL(5)).toBe('I1')
  })

  it('una lectura molt ràpida no passa del sostre', () => {
    expect(nivellVL(500)).toBe('ESO2')
  })

  it('torna null sense dada, però NO amb un zero', () => {
    // Un 0 és una mesura (l'alumne no va llegir res), no una absència.
    expect(nivellVL('')).toBeNull()
    expect(nivellVL(null)).toBeNull()
    expect(nivellVL(undefined)).toBeNull()
    expect(nivellVL('no ho sé')).toBeNull()
    expect(nivellVL(0)).toBe('I1')
  })

  it('accepta el número escrit com a text', () => {
    expect(nivellVL('73')).toBe('I3')
  })
})

describe('nivellCL', () => {
  it('1r i 2n tenen llindars propis, diferents de la resta', () => {
    // Els mateixos 10 encerts valen diferent segons el curs: a 2n la
    // prova és més curta (llindars 7/10/13) que a 1r (12/15/18).
    expect(nivellCL(10, '1r A')).toBe('BAIX')
    expect(nivellCL(10, '2n A')).toBe('M.ALT')
    expect(nivellCL(10, '3r A')).toBe('BAIX')
  })

  it('cada grup de cursos té els seus llindars', () => {
    expect(LLINDARS_CL_DEFECTE.grau1).not.toEqual(LLINDARS_CL_DEFECTE.grau2)
    expect(LLINDARS_CL_DEFECTE.grau2).not.toEqual(LLINDARS_CL_DEFECTE.grau3a6)
    // I sempre van de menys a més, o la classificació seria incoherent.
    for (const [nom, l] of Object.entries(LLINDARS_CL_DEFECTE)) {
      expect(l, nom).toEqual([...l].sort((a, b) => a - b))
    }
  })

  it('de 3r a 6è comparteixen llindars', () => {
    for (const c of ['3r A', '4t A', '5è A', '6è A']) {
      expect(nivellCL(13, c), c).toBe('M.BAIX')
    }
  })

  it('els llindars són inclusius per baix, com al full', () => {
    const [baix, mbaix, malt] = LLINDARS_CL_DEFECTE.grau3a6
    expect(nivellCL(baix - 1, '3r A')).toBe('BAIX')
    expect(nivellCL(baix, '3r A')).toBe('M.BAIX')
    expect(nivellCL(mbaix, '3r A')).toBe('M.ALT')
    expect(nivellCL(malt, '3r A')).toBe('ALT')
  })

  it('accepta llindars personalitzats, que el centre pot editar', () => {
    const propis = { ...LLINDARS_CL_DEFECTE, grau3a6: [5, 10, 15] }
    expect(nivellCL(6, '3r A', propis)).toBe('M.BAIX')
    expect(nivellCL(6, '3r A')).toBe('BAIX') // amb els de defecte, no
  })

  it('una classe desconeguda cau als llindars de 3r a 6è', () => {
    expect(nivellCL(13, 'X')).toBe('M.BAIX')
  })

  it('torna null sense dada, però NO amb un zero', () => {
    expect(nivellCL('', '3r A')).toBeNull()
    expect(nivellCL(null, '3r A')).toBeNull()
    expect(nivellCL(0, '3r A')).toBe('BAIX')
  })
})

describe('MOMENTS_LECTURA', () => {
  it('l\'Avaluació Mitjana no té comprensió lectora', () => {
    // Diverses pantalles hi compten per decidir si pinten les columnes
    // de CL i si en generen fila a la matriu.
    expect(MOMENTS_LECTURA.find((m) => m.id === 'mitjana').teCL).toBe(false)
    expect(MOMENTS_LECTURA.filter((m) => m.teCL).map((m) => m.id)).toEqual(['inicial', 'final'])
  })

  it('tots els moments tenen id i etiqueta', () => {
    for (const m of MOMENTS_LECTURA) {
      expect(m.id).toBeTruthy()
      expect(m.label).toBeTruthy()
    }
  })
})

describe('clAEscalaComuna', () => {
  it('tradueix els quatre trams de comprensió', () => {
    expect(clAEscalaComuna('BAIX')).toBe('no_assoliment')
    expect(clAEscalaComuna('M.BAIX')).toBe('assoliment_satisfactori')
    expect(clAEscalaComuna('M.ALT')).toBe('assoliment_notable')
    expect(clAEscalaComuna('ALT')).toBe('assoliment_excel·lent')
  })

  it('tot el que torna nivellCL es pot traduir', () => {
    // Si un tram no s'hi pogués, desapareixeria dels resums sense avisar.
    for (const n of [0, 8, 14, 17, 25]) {
      expect(clAEscalaComuna(nivellCL(n, '3r A')), String(n)).toBeTruthy()
    }
  })

  it('torna null si no el reconeix', () => {
    expect(clAEscalaComuna('MITJÀ')).toBeNull()
    expect(clAEscalaComuna(null)).toBeNull()
  })
})

describe('vlAEscalaComuna', () => {
  // La velocitat NO es compara amb un llindar fix: es mira on queda
  // l'alumne respecte del SEU PROPI curs. Les mateixes paraules per
  // minut són excel·lents a 3r i insuficients a 6è.
  it('a 1r es miren les paraules per minut directament', () => {
    // A 1r no hi ha "curs inferior" possible amb què comparar.
    expect(vlAEscalaComuna(11, null, '1r A')).toBe('no_assoliment')
    expect(vlAEscalaComuna(13, null, '1r A')).toBe('assoliment_satisfactori')
    expect(vlAEscalaComuna(16, null, '1r A')).toBe('assoliment_notable')
    expect(vlAEscalaComuna(25, null, '1r A')).toBe('assoliment_excel·lent')
  })

  it('de 2n en amunt es compara el nivell lector amb el propi curs', () => {
    // Un alumne de 3r amb nivell I3 és just al seu curs; amb F3, al capdamunt.
    expect(vlAEscalaComuna(80, 'I3', '3r A')).toBe('assoliment_satisfactori')
    expect(vlAEscalaComuna(85, 'M3', '3r A')).toBe('assoliment_notable')
    expect(vlAEscalaComuna(90, 'F3', '3r A')).toBe('assoliment_excel·lent')
  })

  it('per sota del propi curs és no assoliment', () => {
    expect(vlAEscalaComuna(60, 'F2', '3r A')).toBe('no_assoliment')
  })

  it('el mateix nivell lector val diferent segons el curs', () => {
    // Això és el moll de l'os: sense això, 6è sortiria sempre pitjor que 3r.
    expect(vlAEscalaComuna(120, 'I5', '3r A')).toBe('assoliment_excel·lent')
    expect(vlAEscalaComuna(120, 'I5', '5è A')).toBe('assoliment_satisfactori')
    expect(vlAEscalaComuna(120, 'I5', '6è A')).toBe('no_assoliment')
  })

  it('molt per sobre del propi curs segueix sent excel·lent', () => {
    expect(vlAEscalaComuna(145, 'ESO2', '3r A')).toBe('assoliment_excel·lent')
  })

  it('a Infantil no aplica', () => {
    expect(vlAEscalaComuna(50, 'I2', 'I5 A')).toBeNull()
  })

  it('sense nivell lector no es pot classificar (de 2n en amunt)', () => {
    expect(vlAEscalaComuna(80, null, '3r A')).toBeNull()
    expect(vlAEscalaComuna(80, '', '3r A')).toBeNull()
  })

  it('un nivell lector desconegut no s\'endevina', () => {
    expect(vlAEscalaComuna(80, 'XX', '3r A')).toBeNull()
  })
})
