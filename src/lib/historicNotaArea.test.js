import { describe, it, expect } from 'vitest'

import {
  FRANGES, resumDesDeRegistres, fusionaHistoric, totalCentre,
  percentatgeSuperacio, classesDe, trimestresDe, areesDe, etiquetaArea,
  fullHistoricNotaArea, fullEvolucioNotaArea,
} from './historicNotaArea'

const nota = (alumneId, curs, area, trimestre, valor, extra = {}) => ({
  tipus: 'nota_area', alumneId, curs, area, trimestre, nota: valor,
  cursEscolar: '2026-27', ...extra,
})

describe('resumDesDeRegistres', () => {
  it('reparteix les notes per franja segons la rúbrica', () => {
    // <5 no assoliment, <7 satisfactori, <8,5 notable, la resta excel·lent
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'catala', '1r trimestre', 4),
      nota('b', '3rA', 'catala', '1r trimestre', 6),
      nota('c', '3rA', 'catala', '1r trimestre', 8),
      nota('d', '3rA', 'catala', '1r trimestre', 9),
    ], '2026-27')
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ na: 1, as: 1, an: 1, ae: 1, total: 4 })
  })

  it('només compta la nota vigent de cada alumne', () => {
    // Una correcció posterior substitueix la marca anterior.
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'catala', '1r trimestre', 4, { actualitzatEl: { seconds: 1 } }),
      nota('a', '3rA', 'catala', '1r trimestre', 9, { actualitzatEl: { seconds: 2 } }),
    ], '2026-27')
    expect(files[0].total).toBe(1)
  })

  it('separa per trimestre, àrea i classe', () => {
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'catala', '1r trimestre', 8),
      nota('b', '3rB', 'catala', '1r trimestre', 8),
      nota('c', '3rA', 'angles', '1r trimestre', 8),
      nota('d', '3rA', 'catala', '2n trimestre', 8),
    ], '2026-27')
    expect(files).toHaveLength(4)
  })

  it('deixa fora els registres d\'un altre curs escolar', () => {
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'catala', '1r trimestre', 8, { cursEscolar: '2020-21' }),
    ], '2026-27')
    expect(files).toEqual([])
  })

  it('ignora els registres que no són notes per àrea', () => {
    const files = resumDesDeRegistres([
      { tipus: 'tee', alumneId: 'a', curs: '3rA', cursEscolar: '2026-27' },
    ], '2026-27')
    expect(files).toEqual([])
  })

  it('no peta amb la llista buida', () => {
    expect(resumDesDeRegistres([], '2026-27')).toEqual([])
    expect(resumDesDeRegistres(null, '2026-27')).toEqual([])
  })
})

describe('fusionaHistoric', () => {
  const importat = { cursEscolar: '2023-24', files: [{ trimestre: '1r trimestre', area: 'catala', classe: '1A', na: 1, as: 1, an: 1, ae: 1, total: 4 }] }
  const calculat = { '2026-27': [{ trimestre: '1r trimestre', area: 'catala', classe: '1A', na: 0, as: 0, an: 2, ae: 0, total: 2 }] }

  it('ajunta els cursos importats i els calculats', () => {
    const cursos = fusionaHistoric([importat], calculat)
    expect(cursos.map((c) => c.cursEscolar)).toEqual(['2026-27', '2023-24'])
  })

  it('marca d\'on ve cada curs', () => {
    const cursos = fusionaHistoric([importat], calculat)
    expect(cursos.find((c) => c.cursEscolar === '2023-24').origen).toBe('importat')
    expect(cursos.find((c) => c.cursEscolar === '2026-27').origen).toBe('calculat')
  })

  it('el calculat mana sobre l\'importat del mateix curs', () => {
    // El calculat ve de les notes una per una; l'importat, d'un resum que
    // algú ja havia agregat.
    const cursos = fusionaHistoric(
      [{ cursEscolar: '2026-27', files: [{ area: 'catala', classe: '1A', na: 9, as: 0, an: 0, ae: 0, total: 9 }] }],
      calculat
    )
    expect(cursos).toHaveLength(1)
    expect(cursos[0].origen).toBe('calculat')
    expect(cursos[0].files[0].total).toBe(2)
  })

  it('descarta els documents sense curs o sense files', () => {
    expect(fusionaHistoric([{ files: [] }, { cursEscolar: '2020-21' }], {})).toEqual([])
  })

  it('no peta sense res', () => {
    expect(fusionaHistoric(null, null)).toEqual([])
  })
})

describe('totalCentre', () => {
  const files = [
    { trimestre: '1r trimestre', area: 'catala', classe: '1A', na: 2, as: 1, an: 1, ae: 0, total: 4 },
    { trimestre: '1r trimestre', area: 'catala', classe: '3rA', na: 1, as: 1, an: 2, ae: 1, total: 5 },
    { trimestre: '1r trimestre', area: 'angles', classe: '3rA', na: 0, as: 0, an: 5, ae: 0, total: 5 },
  ]

  it('suma les classes d\'una àrea', () => {
    expect(totalCentre(files, { area: 'catala', trimestre: '1r trimestre' }))
      .toMatchObject({ na: 3, total: 9 })
  })

  it('sap deixar 1r fora', () => {
    // A 1r encara s'està aprenent a llegir i escriure: el centre mira
    // sempre les dues xifres.
    expect(totalCentre(files, { area: 'catala', trimestre: '1r trimestre', sensePrimer: true }))
      .toMatchObject({ na: 1, total: 5 })
  })

  it('no peta sense files', () => {
    expect(totalCentre([], {}).total).toBe(0)
    expect(totalCentre(null, {}).total).toBe(0)
  })
})

describe('percentatgeSuperacio', () => {
  it('compta com a superada tot menys el no assoliment', () => {
    expect(percentatgeSuperacio({ na: 1, as: 1, an: 1, ae: 1, total: 4 })).toBe(75)
  })

  it('torna null si no hi ha cap alumne, en comptes de zero', () => {
    // Un zero diria que no en supera cap, que no és el mateix que no
    // tenir-ne dades.
    expect(percentatgeSuperacio({ na: 0, as: 0, an: 0, ae: 0, total: 0 })).toBeNull()
    expect(percentatgeSuperacio(null)).toBeNull()
  })
})

describe('areesDe i etiquetaArea', () => {
  it('conserva les àrees que ja no existeixen a la graella d\'ara', () => {
    // Els cursos antics separaven medi natural i medi social. Descartar-les
    // faria desaparèixer dades reals sense dir-ho.
    const arees = areesDe([
      { area: 'catala' }, { area: 'medi_natural' }, { area: 'medi_social' },
    ])
    expect(arees.map((a) => a.id)).toContain('medi_natural')
    expect(arees.map((a) => a.id)).toContain('medi_social')
  })

  it('posa primer les àrees d\'ara i després les antigues', () => {
    const arees = areesDe([{ area: 'medi_social' }, { area: 'catala' }])
    expect(arees[0].id).toBe('catala')
  })

  it('etiqueta les antigues perquè es vegi que ho són', () => {
    expect(etiquetaArea('medi_social')).toMatch(/antic/i)
    expect(etiquetaArea('catala')).toBe('Català')
  })

  it('no escriu mai un identificador cru', () => {
    expect(etiquetaArea('una_area_inventada')).toBe('una area inventada')
  })
})

describe('classesDe i trimestresDe', () => {
  it('ordena les classes per nivell', () => {
    expect(classesDe([{ classe: '6èA' }, { classe: '1A' }, { classe: '3rA' }]))
      .toEqual(['1A', '3rA', '6èA'])
  })

  it('ordena els trimestres com al curs, no alfabèticament', () => {
    expect(trimestresDe([{ trimestre: '3r trimestre' }, { trimestre: '1r trimestre' }]))
      .toEqual(['1r trimestre', '3r trimestre'])
  })
})

describe('fullHistoricNotaArea', () => {
  const cursos = [{
    cursEscolar: '2026-27', origen: 'calculat',
    files: [
      { trimestre: '1r trimestre', area: 'catala', classe: '1A', na: 1, as: 1, an: 1, ae: 1, total: 4 },
      { trimestre: '1r trimestre', area: 'catala', classe: '3rA', na: 0, as: 0, an: 2, ae: 0, total: 2 },
    ],
  }]

  it('fa una fila per classe i una de TOTAL', () => {
    const { files } = fullHistoricNotaArea(cursos)
    expect(files.slice(1).map((f) => f[3])).toEqual(['1A', '3rA', 'TOTAL'])
  })

  it('hi porta el percentatge de superació', () => {
    const { files } = fullHistoricNotaArea(cursos)
    const cap = files[0]
    expect(files[1][cap.indexOf('% supera')]).toBe(75)
  })

  it('diu d\'on venen les dades de cada curs', () => {
    const { files } = fullHistoricNotaArea(cursos)
    expect(files[1].at(-1)).toBe('app')
  })

  it('no peta sense cursos', () => {
    expect(fullHistoricNotaArea([]).files).toHaveLength(1)
  })
})

describe('fullEvolucioNotaArea', () => {
  const cursos = [
    { cursEscolar: '2026-27', origen: 'calculat', files: [{ trimestre: '3r trimestre', area: 'catala', classe: '3rA', na: 0, as: 1, an: 1, ae: 0, total: 2 }] },
    { cursEscolar: '2025-26', origen: 'importat', files: [{ trimestre: '3r trimestre', area: 'catala', classe: '3rA', na: 1, as: 1, an: 0, ae: 0, total: 2 }] },
  ]

  it('posa els cursos del més antic al més recent, per llegir l\'evolució', () => {
    const { files } = fullEvolucioNotaArea(cursos)
    expect(files[0]).toEqual(['Àrea', '2025-26', '2026-27'])
  })

  it('dona el percentatge de superació de cada any', () => {
    const { files } = fullEvolucioNotaArea(cursos)
    expect(files[1]).toEqual(['Català', 50, 100])
  })

  it('deixa buit l\'any que no en tingui dades, en comptes de posar-hi zero', () => {
    const { files } = fullEvolucioNotaArea([
      ...cursos,
      { cursEscolar: '2024-25', origen: 'importat', files: [] },
    ])
    expect(files[1]).toContain('')
  })
})

describe('FRANGES', () => {
  it('van de menys a més, com a tots els documents del centre', () => {
    expect(FRANGES.map((f) => f.id)).toEqual(['na', 'as', 'an', 'ae'])
  })
})
