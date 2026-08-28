import { describe, it, expect } from 'vitest'

import { colorCella, filesProves, construeixMatriu, COLUMNES_GRUP } from './matriuColors'

/** El cicle d'una classe, com ho fa l'app. */
const cicleDe = (curs) => {
  const c = String(curs ?? '').trim().toUpperCase()
  if (c.startsWith('I')) return 'EI'
  const grau = Number(c[0])
  if (grau === 1 || grau === 2) return 'CI'
  if (grau === 3 || grau === 4) return 'CM'
  if (grau === 5 || grau === 6) return 'CS'
  return null
}
const MOMENTS_LECTURA = [
  { id: 'inicial', label: 'Avaluació Inicial' },
  { id: 'mitjana', label: 'Avaluació Mitjana' },
  { id: 'final', label: 'Avaluació Final' },
]

/** Un centre petit però amb tots els cicles representats. */
const alumnes = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: `i3-${i}`, curs: 'I3A' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `i4-${i}`, curs: 'I4A' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `i5-${i}`, curs: 'I5A' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `1r-${i}`, curs: '1rA' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `2n-${i}`, curs: '2nA' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `3r-${i}`, curs: '3rA' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `5e-${i}`, curs: '5èA' })),
]

const proves = (extra = {}) => filesProves(
  { alumnes, ...extra }, { cicleDe, MOMENTS_LECTURA }
)
const cel·la = (fila, cicleId) => fila.columnes.find((c) => c.id === cicleId)?.valor
const filaDe = (files, titol) => files.find((f) => f.titol.startsWith(titol))

describe('colorCella', () => {
  it('segueix les franges del full original', () => {
    expect(colorCella(20).bg).toBe('#FF0000')   // ≤30%
    expect(colorCella(45).bg).toBe('#FF9900')   // 30–60%
    expect(colorCella(70).bg).toBe('#4A86E8')   // 60–80%
    expect(colorCella(95).bg).toBe('#00FF00')   // >80%
  })

  it('el límit exacte va a la franja de baix', () => {
    expect(colorCella(30).bg).toBe('#FF0000')
    expect(colorCella(80).bg).toBe('#4A86E8')
  })

  it('sense valor no pinta res', () => {
    // Un buit vol dir "aquest cicle no fa la prova", no "0%".
    expect(colorCella(null)).toBeNull()
    expect(colorCella('')).toBeNull()
    expect(colorCella(undefined)).toBeNull()
  })
})

describe('filesProves — quines entrades hi surten', () => {
  it('hi ha una fila per a cada entrada de dades del centre', () => {
    const titols = proves().map((f) => f.titol)
    expect(titols.some((t) => t.startsWith('Lectoescriptura'))).toBe(true)
    expect(titols.filter((t) => t.startsWith('TEE'))).toHaveLength(3)
    expect(titols.filter((t) => t.startsWith('VL/CL'))).toHaveLength(3)
    expect(titols.filter((t) => t.startsWith('Notes per àrea'))).toHaveLength(3)
    expect(titols.some((t) => t.startsWith('COSMOS'))).toBe(true)
    expect(titols.some((t) => t.startsWith('ConMat'))).toBe(true)
  })

  it('cada fila diu a quin bloc pertany, per poder-les agrupar', () => {
    const blocs = [...new Set(proves().map((f) => f.bloc))]
    expect(blocs).toEqual(['Lectoescriptura (I4 i I5)', 'Llengua catalana', 'Notes per àrea', 'Innovamat'])
  })

  it('totes les files tenen les quatre columnes de cicle', () => {
    for (const f of proves()) {
      expect(f.columnes.map((c) => c.id)).toEqual(COLUMNES_GRUP.map((g) => g.id))
    }
  })
})

describe('filesProves — lectoescriptura EI', () => {
  const docs = [{
    classe: 'I4A',
    alumnes: { 'i4-0': { dibuix: true }, 'i4-1': { dibuix: true } },
  }]

  it('compta només I4 i I5, no I3', () => {
    // 4 d'I4 + 4 d'I5 = 8 que la fan; 2 amb marques → 25%.
    const fila = filaDe(proves({ docsLectoescriptura: docs }), 'Lectoescriptura')
    expect(cel·la(fila, 'EI')).toBe(25)
  })

  it('no compta un alumne amb el document creat però cap casella marcada', () => {
    const buit = [{ classe: 'I4A', alumnes: { 'i4-0': {}, 'i4-1': { dibuix: false } } }]
    const fila = filaDe(proves({ docsLectoescriptura: buit }), 'Lectoescriptura')
    expect(cel·la(fila, 'EI')).toBe(0)
  })

  it('deixa buits els cicles de primària, que no la fan', () => {
    const fila = filaDe(proves({ docsLectoescriptura: docs }), 'Lectoescriptura')
    expect(cel·la(fila, 'CI')).toBeNull()
    expect(cel·la(fila, 'CS')).toBeNull()
  })
})

describe('filesProves — notes per àrea', () => {
  const notes = [
    { alumneId: '3r-0', curs: '3rA', area: 'catala', trimestre: '1r trimestre' },
    { alumneId: '3r-0', curs: '3rA', area: 'angles', trimestre: '1r trimestre' },
    { alumneId: '3r-1', curs: '3rA', area: 'catala', trimestre: '1r trimestre' },
  ]

  it('un alumne amb diverses àrees compta una sola vegada', () => {
    // 2 alumnes de 4 al Cicle Mitjà → 50%, no 75%.
    const fila = filaDe(proves({ notaAreaRegistres: notes }), 'Notes per àrea — 1r')
    expect(cel·la(fila, 'CM')).toBe(50)
  })

  it('separa bé els trimestres', () => {
    const fila = filaDe(proves({ notaAreaRegistres: notes }), 'Notes per àrea — 2n')
    expect(cel·la(fila, 'CM')).toBe(0)
  })

  it('deixa Educació Infantil buida: no té notes per àrea', () => {
    const fila = filaDe(proves({ notaAreaRegistres: notes }), 'Notes per àrea — 1r')
    expect(cel·la(fila, 'EI')).toBeNull()
  })
})

describe('filesProves — Innovamat', () => {
  const mates = [
    { alumneId: '1r-0', cosmos: { classe: '1rA' } },
    { alumneId: '2n-0', cosmos: { classe: '2nA' } },
    { alumneId: '3r-0', conmat: { final: { classe: '3rA' } } },
    // Un registre sense casar (sense alumneId) no es pot comptar.
    { alumneId: null, conmat: { final: { classe: '3rA' } } },
  ]

  it('el COSMOS només compta a Cicle Inicial', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'COSMOS')
    expect(cel·la(fila, 'CI')).toBe(25) // 2 de 8
    expect(cel·la(fila, 'CM')).toBeNull()
    expect(cel·la(fila, 'CS')).toBeNull()
  })

  it('el ConMat només compta de 3r en amunt', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'ConMat')
    expect(cel·la(fila, 'CM')).toBe(25) // 1 de 4
    expect(cel·la(fila, 'CI')).toBeNull()
  })

  it('agafa la classe del moment d\'inici si no hi ha final', () => {
    const nomesInici = [{ alumneId: '3r-0', conmat: { inici: { classe: '3rA' } } }]
    const fila = filaDe(proves({ registresMates: nomesInici }), 'ConMat')
    expect(cel·la(fila, 'CM')).toBe(25)
  })

  it('ignora els registres sense alumne casat', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'ConMat')
    expect(cel·la(fila, 'CM')).toBe(25) // el sense alumneId no hi suma
  })
})

describe('filesProves — l\'alumnat de 1r', () => {
  const tee = (trimestre) => [
    { alumneId: '2n-0', curs: '2nA', trimestre },
    { alumneId: '2n-1', curs: '2nA', trimestre },
    { alumneId: '2n-2', curs: '2nA', trimestre },
    { alumneId: '2n-3', curs: '2nA', trimestre },
  ]

  it('no compta al 1r i 2n trimestre: només 2n de primària fa la prova', () => {
    // Si 1r hi comptés, Cicle Inicial no arribaria mai al 100% i sortiria
    // vermell sense que hi hagués res a corregir.
    const fila = filaDe(proves({ teeRegistres: tee(1) }), 'TEE — 1r')
    expect(cel·la(fila, 'CI')).toBe(100)
  })

  it('sí que compta al tercer trimestre', () => {
    const fila = filaDe(proves({ teeRegistres: tee(3) }), 'TEE — 3r')
    expect(cel·la(fila, 'CI')).toBe(50) // 4 de 8
  })
})

describe('construeixMatriu', () => {
  const helpers = {
    mitjanaValoracio: () => 75,
    grauGlobal: () => 60,
    grauCicle: () => 50,
    CICLES_COOPERATIU: [{ id: 'ci', nom: 'Cicle Inicial' }],
    resultatObjectiu: () => ({ valor: 80 }),
    mitjanaGrup: () => 70,
  }

  it('etiqueta cada fila amb el seu bloc', () => {
    const files = construeixMatriu({
      valoracions: [{ id: 'v1', nom: 'Cicle Inicial' }],
      cooperatiu: {},
      objectiusPgac: [{ titol: 'Objectiu 1' }],
    }, helpers)
    const blocs = [...new Set(files.map((f) => f.bloc))]
    expect(blocs).toContain('Valoracions')
    expect(blocs).toContain('Aprenentatge cooperatiu')
    expect(blocs).toContain('Objectius del PGAC')
  })

  it('sense dades, la fila de cicles hi és però buida', () => {
    // No es descarta: deixar-la amb guions diu "això encara no s'ha
    // valorat", mentre que fer-la desaparèixer amagaria que hi falta.
    const files = construeixMatriu({}, helpers)
    expect(files).toHaveLength(1)
    expect(files[0].columnes.every((c) => c.valor === null)).toBe(true)
  })

  it('no peta amb valors nuls pertot', () => {
    expect(() => construeixMatriu({
      valoracions: null, festesDetall: null, cooperatiu: null, objectiusPgac: null,
    }, helpers)).not.toThrow()
  })
})
