import { describe, it, expect } from 'vitest'

import {
  analitzaLlista, fusionaValors, totsElsIndicadors, progres, variacio,
  normalitzaBlocs, unitatSuggerida, blocsPerDefecte,
} from './sic'

describe('analitzaLlista', () => {
  it('munta l\'arbre bloc → secció → indicador', () => {
    const { blocs } = analitzaLlista([
      '1.1 Centre: escolarització',
      '1.1.1 E. Infantil: grups del curs',
      '1.1.2 E. Primària: grups del curs',
    ])
    expect(blocs).toHaveLength(1)
    expect(blocs[0].codi).toBe('1')
    expect(blocs[0].seccions[0].titol).toBe('Centre: escolarització')
    expect(blocs[0].seccions[0].indicadors).toHaveLength(2)
  })

  it('posa nom als blocs que el document no encapçala', () => {
    // A la llista real, el "1" i el "3" no surten mai com a línia pròpia:
    // es dedueixen del codi de les seves seccions.
    const { blocs } = analitzaLlista(['1.1 Escolarització', '3.1 Recursos humans'])
    expect(blocs.find((b) => b.codi === '1').titol).toBe('Context')
    expect(blocs.find((b) => b.codi === '3').titol).toBe('Recursos')
  })

  it('fa servir el títol del document quan el bloc sí que hi surt', () => {
    const { blocs } = analitzaLlista(['2 Resultats', '2.1 Àrees instrumentals'])
    expect(blocs[0].titol).toBe('Resultats')
  })

  it('ordena els blocs pel número, no per com hagin aparegut', () => {
    const { blocs } = analitzaLlista(['3.1 Recursos', '1.1 Context', '2 Resultats'])
    expect(blocs.map((b) => b.codi)).toEqual(['1', '2', '3'])
  })

  it('recull les línies sense codi dins de la secció on cauen', () => {
    // Cas real: "TOTAL GRUPS" i "TOTAL ALUMNES" van soltes enmig de l'1.1.
    const { blocs } = analitzaLlista([
      '1.1 Centre: escolarització',
      '1.1.1 E. Infantil: grups del curs',
      'TOTAL GRUPS',
      'TOTAL ALUMNES',
    ])
    const indicadors = blocs[0].seccions[0].indicadors
    expect(indicadors).toHaveLength(3)
    expect(indicadors[1].text).toBe('TOTAL GRUPS')
    expect(indicadors[1].codi).toBe('')
  })

  it('avisa dels codis repetits en comptes de descartar-ne un', () => {
    // Cas real: l'1.1.11 surt dues vegades a la llista del curs passat.
    const { blocs, avisos } = analitzaLlista([
      '1.1 Escolarització',
      '1.1.11 E. Primària: alumnes del curs',
      '1.1.11 E. Primària: alumnes del curs',
    ])
    expect(blocs[0].seccions[0].indicadors).toHaveLength(2)
    expect(avisos.some((a) => /1\.1\.11/.test(a))).toBe(true)
  })

  it('no perd un indicador si la seva secció no s\'ha declarat', () => {
    const { blocs, avisos } = analitzaLlista(['1.5.1 Un indicador orfe'])
    expect(blocs[0].seccions[0].codi).toBe('1.5')
    expect(blocs[0].seccions[0].indicadors).toHaveLength(1)
    expect(avisos.some((a) => /1\.5/.test(a))).toBe(true)
  })

  it('aguanta els espais dobles i el text enganxat al final del títol', () => {
    // "1.10 Centre: mobilitat professorat  pàg4 MEMÒRIA ANUAL."
    const { blocs } = analitzaLlista(['1.10 Centre: mobilitat professorat  pàg4 MEMÒRIA ANUAL.'])
    expect(blocs[0].seccions[0].titol).toBe('Centre: mobilitat professorat pàg4 MEMÒRIA ANUAL.')
  })

  it('descarta les capçaleres de columna sense fer soroll', () => {
    // Un Excel real comença amb "Codi | Indicador | Valor". No són
    // indicadors, però avisar-ne cada vegada tapa els avisos que sí
    // importen.
    const { blocs, avisos } = analitzaLlista(['Codi', 'Indicador', '1.1 Escolarització', '1.1.1 Grups'])
    expect(blocs[0].seccions[0].indicadors).toHaveLength(1)
    expect(avisos).toEqual([])
  })

  it('la llista del curs passat es llegeix sencera', () => {
    const blocs = blocsPerDefecte()
    expect(blocs.map((b) => b.codi)).toEqual(['1', '2', '3'])
    // 17 seccions al bloc 1, 8 al 2 i 4 al 3.
    expect(blocs[0].seccions).toHaveLength(17)
    expect(blocs[1].seccions).toHaveLength(8)
    expect(blocs[2].seccions).toHaveLength(4)
  })
})

describe('unitatSuggerida', () => {
  it('reconeix els índexs', () => {
    expect(unitatSuggerida("Índex d'alumnes de nacionalitat estrangera")).toBe('index')
  })
  it('reconeix les ràtios', () => {
    expect(unitatSuggerida('Recursos humans: ràtio alumnat / professor')).toBe('ratio')
  })
  it('reconeix els recomptes', () => {
    expect(unitatSuggerida('E. Infantil: grups del curs')).toBe('nombre')
    expect(unitatSuggerida('TOTAL ALUMNES')).toBe('nombre')
  })
  it('reconeix els que no són números', () => {
    expect(unitatSuggerida('Grau de complexitat / Nivell socioeconòmic')).toBe('text')
  })
})

describe('fusionaValors', () => {
  const vells = analitzaLlista(['1.1 Escolarització', '1.1.1 Grups', '1.1.2 Alumnes']).blocs
  vells[0].seccions[0].indicadors[0].valor = '12'
  vells[0].seccions[0].indicadors[1].valor = '250'
  vells[0].seccions[0].indicadors[1].unitat = 'nombre'

  it('passa el valor del curs passat a la columna de comparació', () => {
    const nous = analitzaLlista(['1.1 Escolarització', '1.1.1 Grups del curs (redactat nou)']).blocs
    const { blocs } = fusionaValors(nous, vells)
    const indicador = blocs[0].seccions[0].indicadors[0]
    expect(indicador.valorAnterior).toBe('12')
    expect(indicador.valor).toBe('') // el del curs nou, per omplir
  })

  it('casa pel codi encara que hagi canviat la redacció', () => {
    const nous = analitzaLlista(['1.1 Escolarització', '1.1.2 Alumnat del curs']).blocs
    const { blocs, reaprofitats } = fusionaValors(nous, vells)
    expect(reaprofitats).toBe(1)
    expect(blocs[0].seccions[0].indicadors[0].valorAnterior).toBe('250')
  })

  it('respecta la unitat que s\'hagi triat a mà', () => {
    const nous = analitzaLlista(['1.1 Escolarització', '1.1.2 Alumnes']).blocs
    const { blocs } = fusionaValors(nous, vells)
    expect(blocs[0].seccions[0].indicadors[0].unitat).toBe('nombre')
  })

  it('avisa dels indicadors amb valor que ja no surten, sense col·locar-los enlloc', () => {
    const nous = analitzaLlista(['1.1 Escolarització', '1.1.1 Grups']).blocs
    const { perduts, avisos } = fusionaValors(nous, vells)
    expect(perduts).toEqual(['1.1.2'])
    expect(avisos.some((a) => /1\.1\.2/.test(a))).toBe(true)
  })

  it('no avisa dels indicadors que han desaparegut però no tenien valor', () => {
    const buits = analitzaLlista(['1.1 Escolarització', '1.1.1 Grups', '1.1.9 Sense omplir']).blocs
    const nous = analitzaLlista(['1.1 Escolarització', '1.1.1 Grups']).blocs
    const { perduts } = fusionaValors(nous, buits)
    expect(perduts).toEqual([])
  })
})

describe('progres', () => {
  it('compta quants indicadors estan omplerts', () => {
    const blocs = analitzaLlista(['1.1 A', '1.1.1 Un', '1.1.2 Dos', '1.1.3 Tres']).blocs
    blocs[0].seccions[0].indicadors[0].valor = '10'
    const p = progres(blocs)
    expect(p).toMatchObject({ total: 3, omplerts: 1, percentatge: 33 })
  })

  it('no divideix per zero amb la llista buida', () => {
    expect(progres([])).toMatchObject({ total: 0, omplerts: 0, percentatge: 0 })
  })

  it('no compta els espais en blanc com a omplerts', () => {
    const blocs = analitzaLlista(['1.1 A', '1.1.1 Un']).blocs
    blocs[0].seccions[0].indicadors[0].valor = '   '
    expect(progres(blocs).omplerts).toBe(0)
  })
})

describe('variacio', () => {
  it('resta el valor de l\'any passat', () => {
    expect(variacio({ valor: '85', valorAnterior: '80', unitat: 'index' })).toBe(5)
  })

  it('accepta la coma decimal', () => {
    expect(variacio({ valor: '85,5', valorAnterior: '80', unitat: 'index' })).toBe(5.5)
  })

  it('no compara si en falta algun dels dos', () => {
    expect(variacio({ valor: '85', valorAnterior: '', unitat: 'index' })).toBeNull()
    expect(variacio({ valor: '', valorAnterior: '80', unitat: 'index' })).toBeNull()
  })

  it('no compara els indicadors de text', () => {
    expect(variacio({ valor: 'Alta', valorAnterior: 'Mitjana', unitat: 'text' })).toBeNull()
  })
})

describe('normalitzaBlocs', () => {
  it('omple els camps que falten als documents antics', () => {
    const [bloc] = normalitzaBlocs([
      { codi: '1', seccions: [{ codi: '1.1', indicadors: [{ codi: '1.1.1', text: 'Un' }] }] },
    ])
    const indicador = bloc.seccions[0].indicadors[0]
    expect(indicador.valor).toBe('')
    expect(indicador.valorAnterior).toBe('')
    expect(indicador.unitat).toBeTruthy()
    expect(indicador.id).toBeTruthy()
  })

  it('no peta amb un document buit o mal format', () => {
    expect(normalitzaBlocs(null)).toEqual([])
    expect(normalitzaBlocs(undefined)).toEqual([])
  })
})

describe('totsElsIndicadors', () => {
  it('els torna en ordre de lectura', () => {
    const blocs = analitzaLlista(['1.1 A', '1.1.1 Un', '1.2 B', '1.2.1 Dos']).blocs
    expect(totsElsIndicadors(blocs).map((i) => i.text)).toEqual(['Un', 'Dos'])
  })
})
