import { describe, it, expect } from 'vitest'

import {
  FRANGES, resumDesDeRegistres, fusionaHistoric, totalCentre,
  percentatgeSuperacio, classesDe, trimestresDe, areesDe, etiquetaArea,
  fullHistoricNotaArea, fullEvolucioNotaArea, MOMENT_FINAL, MOMENTS_HISTORIC,
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
    // Dues files: el trimestre i el moment "Final" (la mitjana).
    const delTrim = files.find((f) => f.trimestre === '1r trimestre')
    expect(delTrim).toMatchObject({ na: 1, as: 1, an: 1, ae: 1, total: 4 })
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
    // 4 combinacions de trimestre + les seves finals (3 grups distints
    // d'àrea/classe: catala-3rA, catala-3rB, angles-3rA).
    expect(files.filter((f) => f.trimestre !== MOMENT_FINAL)).toHaveLength(4)
    expect(files.filter((f) => f.trimestre === MOMENT_FINAL)).toHaveLength(3)
  })

  it('calcula el moment "Final" com la mitjana de l\'alumne, no de les franges', () => {
    // Un alumne amb 4 i 6 té un 5 (satisfactori), no "mig no assoliment
    // i mig satisfactori". La mitjana es fa per alumne i DESPRÉS es
    // classifica.
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'catala', '1r trimestre', 4),
      nota('a', '3rA', 'catala', '3r trimestre', 6),
    ], '2026-27')
    const final = files.find((f) => f.trimestre === MOMENT_FINAL)
    expect(final).toMatchObject({ na: 0, as: 1, an: 0, ae: 0, total: 1 })
  })

  it('la final surt encara que falti algun trimestre', () => {
    const files = resumDesDeRegistres([nota('a', '3rA', 'catala', '1r trimestre', 9)], '2026-27')
    expect(files.find((f) => f.trimestre === MOMENT_FINAL).ae).toBe(1)
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

describe('resumDesDeRegistres — àrees calculades', () => {
  // "Medi (global)" i "Artística" no s'introdueixen mai directament: al
  // full original són la mitjana d'altres dues (Medi+Science,
  // Plàstica+Música). No es poden treure sumant els recomptes de les
  // àrees reals — calen les notes aparellades, alumne per alumne.
  it('calcula Artística com la mitjana de Plàstica i Música', () => {
    const files = resumDesDeRegistres([
      nota('a', '5èA', 'plastica', '1r trimestre', 9),
      nota('a', '5èA', 'musica', '1r trimestre', 7),
    ], '2026-27')
    const art = files.find((f) => f.area === 'artistica')
    expect(art).toBeDefined()
    // Mitjana (9+7)/2 = 8 → Assoliment Notable
    expect(art).toMatchObject({ an: 1, total: 1 })
  })

  it('només compta l\'alumne si té LES DUES notes del mateix trimestre', () => {
    // Com la fórmula original del full: sense Música, no hi ha "GF".
    const files = resumDesDeRegistres([
      nota('a', '5èA', 'plastica', '1r trimestre', 9),
    ], '2026-27')
    expect(files.find((f) => f.area === 'artistica')).toBeUndefined()
  })

  it('no barreja notes de trimestres diferents', () => {
    const files = resumDesDeRegistres([
      nota('a', '5èA', 'plastica', '1r trimestre', 9),
      nota('a', '5èA', 'musica', '2n trimestre', 7),
    ], '2026-27')
    expect(files.find((f) => f.area === 'artistica')).toBeUndefined()
  })

  it('agrupa Medi (global) per separat d\'Artística', () => {
    const files = resumDesDeRegistres([
      nota('a', '3rA', 'medi', '1r trimestre', 6),
      nota('a', '3rA', 'science', '1r trimestre', 6),
      nota('a', '3rA', 'plastica', '1r trimestre', 9),
      nota('a', '3rA', 'musica', '1r trimestre', 9),
    ], '2026-27')
    expect(files.find((f) => f.area === 'medi_global').total).toBe(1)
    expect(files.find((f) => f.area === 'artistica').total).toBe(1)
    // I les àrees reals hi segueixen sent, sense tocar-les.
    expect(files.find((f) => f.area === 'medi').total).toBe(1)
  })

  it('no barreja alumnes ni classes diferents', () => {
    const files = resumDesDeRegistres([
      nota('a', '5èA', 'plastica', '1r trimestre', 2),
      nota('b', '5èA', 'musica', '1r trimestre', 9),
    ], '2026-27')
    expect(files.find((f) => f.area === 'artistica')).toBeUndefined()
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

  it('posa la mitjana final DARRERE dels tres trimestres', () => {
    expect(trimestresDe([{ trimestre: MOMENT_FINAL }, { trimestre: '1r trimestre' }]))
      .toEqual(['1r trimestre', MOMENT_FINAL])
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
    const { files } = fullEvolucioNotaArea(cursos, { trimestre: '3r trimestre' })
    expect(files[0]).toEqual(['Àrea', '2025-26', '2026-27'])
  })

  it('dona el percentatge de superació de cada any', () => {
    const { files } = fullEvolucioNotaArea(cursos, { trimestre: '3r trimestre' })
    expect(files[1]).toEqual(['Català', 50, 100])
  })

  it('per defecte fa servir el moment "Final", que és el que es lliura', () => {
    expect(fullEvolucioNotaArea([]).nom).toMatch(/Final/i)
  })

  it('el moment consta al nom del full, per no confondre\'ls a la memòria', () => {
    const a = fullEvolucioNotaArea([], { trimestre: '1r trimestre' })
    const b = fullEvolucioNotaArea([], { trimestre: '3r trimestre' })
    expect(a.nom).not.toBe(b.nom)
    for (const t of MOMENTS_HISTORIC) {
      const { nom } = fullEvolucioNotaArea([], { trimestre: t })
      expect(nom.length, nom).toBeLessThanOrEqual(31)
      expect(nom).not.toMatch(/\dnr|\drr/)
    }
  })

  it('els noms de full caben al límit d\'Excel per a tots els trimestres', () => {
    for (const trimestre of ['1r trimestre', '2n trimestre', '3r trimestre']) {
      for (const sensePrimer of [false, true]) {
        const { nom } = fullEvolucioNotaArea([], { trimestre, sensePrimer })
        expect(nom.length, nom).toBeLessThanOrEqual(31)
        // I sense ordinals inventats del tipus "2nr".
        expect(nom).not.toMatch(/\dnr|\drr/)
      }
    }
  })

  it('deixa buit l\'any que no en tingui dades, en comptes de posar-hi zero', () => {
    const { files } = fullEvolucioNotaArea([
      ...cursos,
      { cursEscolar: '2024-25', origen: 'importat', files: [] },
    ], { trimestre: '3r trimestre' })
    expect(files[1]).toContain('')
  })
})

describe('FRANGES', () => {
  it('van de menys a més, com a tots els documents del centre', () => {
    expect(FRANGES.map((f) => f.id)).toEqual(['na', 'as', 'an', 'ae'])
  })
})

describe('areesDe — amb les calculades', () => {
  it('inclou Artística i Medi (global) quan hi ha dades', () => {
    const arees = areesDe([
      { area: 'catala' }, { area: 'artistica' }, { area: 'medi_global' },
    ])
    expect(arees.map((a) => a.id)).toEqual(['catala', 'medi_global', 'artistica'])
  })

  it('les etiqueta amb el seu nom real, no "antic"', () => {
    // Al contrari de medi_natural/medi_social, aquestes SÍ que existeixen
    // avui a la graella — no s'han de marcar com a coses d'abans.
    expect(etiquetaArea('artistica')).toBe('Artística')
    expect(etiquetaArea('medi_global')).toBe('Medi (global)')
  })
})

describe('nota final corregida pel mestre', () => {
  // La mitjana aritmètica no sempre reflecteix on ha arribat l'alumne:
  // una remuntada clara al tercer trimestre val més que el 4 del primer.
  // Per això el mestre pot escriure la final, i mana sobre la mitjana.
  const ambCorreccio = [
    nota('a', '3rA', 'catala', '1r trimestre', 4),
    nota('a', '3rA', 'catala', '2n trimestre', 5),
    nota('a', '3rA', 'catala', '3r trimestre', 7),
    // 5,3 de mitjana, però el mestre hi posa un 7.
    { ...nota('a', '3rA', 'catala', 'Final', 7) },
  ]

  it('la final escrita a mà mana sobre la mitjana', () => {
    const files = resumDesDeRegistres(ambCorreccio, '2026-27')
    const final = files.find((f) => f.trimestre === MOMENT_FINAL)
    // 7 és Assoliment Notable; la mitjana (5,3) hauria estat Satisfactori.
    expect(final).toMatchObject({ an: 1, as: 0, total: 1 })
  })

  it('la correcció NO surt com un trimestre més', () => {
    // Si sortís, la taula tindria una columna "Final" al costat del 1r,
    // 2n i 3r, a més del moment "Final (mitjana)".
    const files = resumDesDeRegistres(ambCorreccio, '2026-27')
    expect(files.map((f) => f.trimestre)).not.toContain('Final')
  })

  it('sense correcció, segueix sent la mitjana', () => {
    const files = resumDesDeRegistres(ambCorreccio.slice(0, 3), '2026-27')
    const final = files.find((f) => f.trimestre === MOMENT_FINAL)
    expect(final).toMatchObject({ as: 1, an: 0 })
  })

  it('la correcció compta encara que no hi hagi cap trimestre', () => {
    // Cas real: un alumne que arriba a mig curs i només se li posa la final.
    const files = resumDesDeRegistres([nota('z', '3rA', 'catala', 'Final', 8)], '2026-27')
    expect(files.find((f) => f.trimestre === MOMENT_FINAL).an).toBe(1)
  })

  it('buidar la correcció torna a la mitjana', () => {
    // En buidar-la es desa amb nota buida, que tot el que llegeix aquesta
    // col·lecció tracta com a absent.
    const buidada = [...ambCorreccio.slice(0, 3), { ...nota('a', '3rA', 'catala', 'Final', null) }]
    const files = resumDesDeRegistres(buidada, '2026-27')
    expect(files.find((f) => f.trimestre === MOMENT_FINAL)).toMatchObject({ as: 1 })
  })
})
