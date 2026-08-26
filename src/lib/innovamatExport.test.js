import { describe, it, expect, vi } from 'vitest'

vi.mock('./carregaLlibreries', () => ({ carregaPdfjs: () => {}, carregaExcelJS: () => {} }))

const {
  fullConmatResum, fullConmatComparativa, fullConmatAlumnes,
  fullCosmosResum, fullCosmosEvolucio, fullCosmosAlumnes,
  fullsInnovamat, nomFitxerInnovamat,
} = await import('./innovamatExport')

// Registres calcats als de Firestore: el ConMat per moment, el COSMOS
// amb els dos moments dins del mateix registre.
const registres = [
  {
    cursEscolar: '2025-26', alumneId: 'a', nom: 'Alfa, Anna',
    conmat: { final: { nivell: 'Alt', classe: '3rA', respostes: 24, preguntes: 24 } },
  },
  {
    cursEscolar: '2025-26', alumneId: 'b', nom: 'Beta, Bru',
    conmat: { final: { nivell: 'Baix', classe: '3rA', respostes: 18, preguntes: 24 } },
  },
  {
    cursEscolar: '2025-26', alumneId: 'c', nom: 'Ceta, Cesc',
    conmat: { final: { nivell: null, classe: '3rA', noAvaluat: true } },
  },
  {
    cursEscolar: '2025-26', alumneId: 'd', nom: 'Delta, Dora',
    cosmos: {
      classe: '1rA',
      moments: {
        inicial: { rendiment: 'Baix', puntuacio: 1 },
        final: { rendiment: 'Alt', puntuacio: 2.5 },
      },
    },
  },
  {
    cursEscolar: '2025-26', alumneId: 'e', nom: 'Eta, Eloi',
    cosmos: {
      classe: '1rA', noAvaluat: true,
      moments: { inicial: {}, final: {} },
    },
  },
]

const refs = {
  '2025-26__final__3r__catalunya': { Baix: 33.9, 'Mitjà-baix': 20.5, 'Mitjà-alt': 25.3, Alt: 20.3 },
}

const capcalera = (full) => full.files[0]
const cos = (full) => full.files.slice(1)

describe('fullConmatResum', () => {
  it('fa una fila per classe i una de total', () => {
    const full = fullConmatResum(registres)
    expect(cos(full).map((f) => f[2])).toEqual(['3rA', 'TOTAL'])
  })

  it('separa els avaluats dels que no van fer la prova', () => {
    const [fila] = cos(fullConmatResum(registres))
    // ...Avaluats, Sense fer la prova, Total
    expect(fila.slice(-3)).toEqual([2, 1, 3])
  })

  it('dona els percentatges com a números, no com a text', () => {
    const [fila] = cos(fullConmatResum(registres))
    const i = capcalera(fullConmatResum(registres)).indexOf('Alt %')
    expect(typeof fila[i]).toBe('number')
    expect(fila[i]).toBe(50) // 1 de 2 avaluats
  })
})

describe('fullConmatComparativa', () => {
  it('posa el centre al costat de la referència, pel nivell de la classe', () => {
    const full = fullConmatComparativa(registres, refs)
    const fila = cos(full).find((f) => f[3] === 'Alt')
    expect(fila[2]).toBe('3r')      // el nivell, tret de "3rA"
    expect(fila[4]).toBe(50)         // centre
    expect(fila[5]).toBe(20.3)       // Catalunya
  })

  it('deixa la referència en blanc si no s\'ha introduït, en comptes de posar-hi zero', () => {
    const full = fullConmatComparativa(registres, {})
    const fila = cos(full).find((f) => f[3] === 'Alt')
    expect(fila[5]).toBe('')
    expect(fila[6]).toBe('')
  })
})

describe('fullConmatAlumnes', () => {
  it('escriu "No avaluat" a qui no va fer la prova', () => {
    const fila = cos(fullConmatAlumnes(registres)).find((f) => f[3] === 'Ceta, Cesc')
    expect(fila[4]).toBe('No avaluat')
    expect(fila[7]).toMatch(/no va fer la prova/)
  })

  it('hi porta les respostes de cada alumne', () => {
    const fila = cos(fullConmatAlumnes(registres)).find((f) => f[3] === 'Beta, Bru')
    expect(fila[5]).toBe(18)
    expect(fila[6]).toBe(24)
  })
})

describe('fullCosmosResum', () => {
  it('fa servir els tres nivells del COSMOS, no els quatre del ConMat', () => {
    const cap = capcalera(fullCosmosResum(registres))
    expect(cap).toContain('Mitjà')
    expect(cap).not.toContain('Mitjà-alt')
  })

  it('no escriu cap fila d\'un moment sense resultats', () => {
    // Aquest joc de dades només té rendiments a inicial i final, però si
    // un curs no tingués la final feta, no hi ha d'haver files de zeros.
    const nomes = [{
      cursEscolar: '2026-27', alumneId: 'z', nom: 'Z',
      cosmos: { classe: '1rB', moments: { inicial: { rendiment: 'Alt' }, final: {} } },
    }]
    const moments = cos(fullCosmosResum(nomes)).map((f) => f[1])
    expect(moments).not.toContain('Final de curs')
  })

  it('compta a part qui no va fer la prova', () => {
    const fila = cos(fullCosmosResum(registres)).find((f) => f[2] === '1rA' && f[1] === 'Final de curs')
    expect(fila.slice(-3)).toEqual([1, 1, 2])
  })
})

describe('fullCosmosEvolucio', () => {
  it('compta qui millora entre la prova inicial i la final', () => {
    const fila = cos(fullCosmosEvolucio(registres)).find((f) => f[1] === '1rA')
    expect(fila[2]).toBe(1) // amb les dues proves
    expect(fila[3]).toBe(1) // milloren
  })
})

describe('fullCosmosAlumnes', () => {
  it('porta els dos moments de cada alumne', () => {
    const fila = cos(fullCosmosAlumnes(registres)).find((f) => f[2] === 'Delta, Dora')
    expect(fila[3]).toBe('Baix')
    expect(fila[5]).toBe('Alt')
  })
})

describe('fullsInnovamat', () => {
  it('munta els sis fulls quan hi ha les dues proves', () => {
    const noms = fullsInnovamat(registres, refs).map((f) => f.nom)
    expect(noms).toHaveLength(6)
    expect(noms.some((n) => /COSMOS/.test(n))).toBe(true)
    expect(noms.some((n) => /ConMat/.test(n))).toBe(true)
  })

  it('posa el COSMOS abans del ConMat, per ordre de nivell', () => {
    // El mateix ordre que les pestanyes de l'Històric: 1r i 2n abans que
    // 3r a 6è. Si els fulls sortissin a l'inrevés, l'Excel no coincidiria
    // amb el que s'ha vist a la pantalla.
    const noms = fullsInnovamat(registres, refs).map((f) => f.nom)
    expect(noms[0]).toMatch(/COSMOS/)
    expect(noms.findIndex((n) => /COSMOS/.test(n)))
      .toBeLessThan(noms.findIndex((n) => /ConMat/.test(n)))
  })

  it('es pot limitar a una sola prova', () => {
    const noms = fullsInnovamat(registres, refs, { prova: 'cosmos' }).map((f) => f.nom)
    expect(noms.every((n) => /COSMOS/.test(n))).toBe(true)
  })

  it('es pot demanar sense el detall per alumne', () => {
    const noms = fullsInnovamat(registres, refs, { detall: false }).map((f) => f.nom)
    expect(noms.some((n) => /per alumne/.test(n))).toBe(false)
  })

  it('no genera cap full si no hi ha dades', () => {
    expect(fullsInnovamat([], {})).toEqual([])
  })

  it('no genera el full d\'una prova que no s\'ha carregat', () => {
    const nomesConmat = registres.filter((r) => r.conmat)
    const noms = fullsInnovamat(nomesConmat, refs).map((f) => f.nom)
    expect(noms.every((n) => /ConMat/.test(n))).toBe(true)
  })
})

describe('nomFitxerInnovamat', () => {
  it('hi posa el curs quan només n\'hi ha un', () => {
    expect(nomFitxerInnovamat(registres, 'tot', 'xlsx')).toBe('innovamat-2025-26.xlsx')
  })

  it('hi posa el rang quan n\'hi ha diversos', () => {
    const varis = [...registres, { cursEscolar: '2023-24', alumneId: 'x', conmat: { final: { nivell: 'Alt' } } }]
    expect(nomFitxerInnovamat(varis, 'conmat', 'pdf')).toBe('conmat-2023-24_a_2025-26.pdf')
  })

  it('no peta sense dades', () => {
    expect(nomFitxerInnovamat([], 'tot', 'xlsx')).toBe('innovamat.xlsx')
  })
})
