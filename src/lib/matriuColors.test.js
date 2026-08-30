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
// Còpia de rubricaLectura.js. El `teCL` importa: la Mitjana no té
// comprensió lectora, i per això no en genera fila.
const MOMENTS_LECTURA = [
  { id: 'inicial', label: 'Avaluació Inicial', teCL: true },
  { id: 'mitjana', label: 'Avaluació Mitjana', teCL: false },
  { id: 'final', label: 'Avaluació Final', teCL: true },
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
    // La velocitat i la comprensió van en files separades: a 1r es pot
    // fer la VL al setembre i deixar la CL per al juny.
    expect(titols.filter((t) => t.startsWith('VL —'))).toHaveLength(3)
    // La CL, només als moments que en tenen (la Mitjana no).
    expect(titols.filter((t) => t.startsWith('CL —'))).toHaveLength(2)
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
    { alumneId: '1r-0', cosmos: { classe: '1rA', moments: { final: { rendiment: 'Alt' } } } },
    { alumneId: '2n-0', cosmos: { classe: '2nA', moments: { final: { rendiment: 'Alt' } } } },
    { alumneId: '3r-0', conmat: { final: { classe: '3rA' } } },
    // Un registre sense casar (sense alumneId) no es pot comptar.
    { alumneId: null, conmat: { final: { classe: '3rA' } } },
  ]

  it('el COSMOS només compta a Cicle Inicial', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'COSMOS (1r i 2n) — final')
    expect(cel·la(fila, 'CI')).toBe(25) // 2 de 8
    expect(cel·la(fila, 'CM')).toBeNull()
    expect(cel·la(fila, 'CS')).toBeNull()
  })

  it('el ConMat només compta de 3r en amunt', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'ConMat (3r a 6è) — final')
    expect(cel·la(fila, 'CM')).toBe(25) // 1 de 4
    expect(cel·la(fila, 'CI')).toBeNull()
  })

  it('cada moment compta NOMÉS els seus informes', () => {
    // Abans hi havia una sola fila per prova i es comptava qualsevol
    // registre: una classe que només hagués carregat l'informe d'inici
    // sortia verda a la fila del final, dient que estava feta una prova
    // que no s'havia passat.
    const nomesInici = [{ alumneId: '3r-0', conmat: { inici: { classe: '3rA' } } }]
    const proves_ = proves({ registresMates: nomesInici })
    expect(cel·la(filaDe(proves_, 'ConMat (3r a 6è) — inici'), 'CM')).toBe(25)
    expect(cel·la(filaDe(proves_, 'ConMat (3r a 6è) — final'), 'CM')).toBe(0)
  })

  it('ignora els registres sense alumne casat', () => {
    const fila = filaDe(proves({ registresMates: mates }), 'ConMat (3r a 6è) — final')
    expect(cel·la(fila, 'CM')).toBe(25) // el sense alumneId no hi suma
  })

  it('hi ha una fila per moment de cada prova', () => {
    const titols = proves().map((f) => f.titol)
    expect(titols.filter((t) => t.startsWith('COSMOS'))).toHaveLength(2)
    expect(titols.filter((t) => t.startsWith('ConMat'))).toHaveLength(2)
  })
})

describe('filesProves — l\'alumnat de 1r', () => {
  const tee = (trimestre) => [
    { alumneId: '2n-0', curs: '2nA', trimestre },
    { alumneId: '2n-1', curs: '2nA', trimestre },
    { alumneId: '2n-2', curs: '2nA', trimestre },
    { alumneId: '2n-3', curs: '2nA', trimestre },
  ]

  it('per defecte hi compta: que no passi les proves fins al tercer trimestre es configura', () => {
    // Abans era una regla escrita al codi. Ara és una decisió del centre
    // que es pot canviar sense tocar res, perquè pot canviar d'un any a
    // l'altre. Sense configurar-ho, 1r entra al denominador.
    const fila = filaDe(proves({ teeRegistres: tee(1) }), 'TEE — 1r')
    expect(cel·la(fila, 'CI')).toBe(50) // 4 de 8
  })

  it('desmarcant 1r als dos primers trimestres, el Cicle Inicial pot arribar al 100%', () => {
    const fila = filaDe(
      filesProves(
        { alumnes, teeRegistres: tee(1), configProves: { exclusions: { 'tee__1': ['1rA'] } } },
        { cicleDe, MOMENTS_LECTURA }
      ),
      'TEE — 1r'
    )
    expect(cel·la(fila, 'CI')).toBe(100) // 4 de 4, només 2n
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

describe('filesProves — quines classes passen cada prova', () => {
  const ambConfig = (exclusions, dades = {}) => filesProves(
    { alumnes, ...dades, configProves: { exclusions } },
    { cicleDe, MOMENTS_LECTURA }
  )

  it('Educació Infantil no compta al TEE: no és dels seus nivells', () => {
    // Ja no està escrit al codi: el catàleg diu que el TEE és de
    // primària, i Infantil no hi entra ni al denominador.
    expect(cel·la(filaDe(proves(), 'TEE — 1r'), 'EI')).toBeNull()
  })

  it('una classe desmarcada surt del numerador i del denominador', () => {
    // Ara mateix la lectoescriptura només la passa I5. Amb I4 fora, el
    // 100% s'ha de calcular només sobre I5.
    const docs = [{ classe: 'I5A', alumnes: { 'i5-0': { dibuix: true }, 'i5-1': { dibuix: true } } }]
    const ambI4 = filaDe(proves({ docsLectoescriptura: docs }), 'Lectoescriptura')
    const senseI4 = filaDe(
      ambConfig({ 'lectoescriptura__curs': ['I4A'] }, { docsLectoescriptura: docs }),
      'Lectoescriptura'
    )
    expect(cel·la(ambI4, 'EI')).toBe(25)    // 2 de 8 (I4 + I5)
    expect(cel·la(senseI4, 'EI')).toBe(50)  // 2 de 4 (només I5)
  })

  it('si es desmarquen totes, la casella queda buida i no a zero', () => {
    const fila = filaDe(ambConfig({ 'lectoescriptura__curs': ['I4A', 'I5A'] }), 'Lectoescriptura')
    expect(cel·la(fila, 'EI')).toBeNull()
  })

  it('cada moment es configura per separat', () => {
    // El cas real: a 1r no passen el TEE fins al tercer trimestre.
    const config = { 'tee__1': ['1rA'], 'tee__2': ['1rA'] }
    const tee = [
      { alumneId: '1r-0', curs: '1rA', trimestre: 1 },
      { alumneId: '2n-0', curs: '2nA', trimestre: 1 },
    ]
    const primer = filaDe(ambConfig(config, { teeRegistres: tee }), 'TEE — 1r')
    const tercer = filaDe(ambConfig(config, { teeRegistres: tee }), 'TEE — 3r')
    // Al 1r trimestre, 1r no compta: el denominador és només 2n (4 alumnes).
    expect(cel·la(primer, 'CI')).toBe(25)
    // Al tercer sí que hi compta: 8 alumnes al denominador.
    expect(cel·la(tercer, 'CI')).toBe(0)
  })

  it('sense configuració, les passen totes les que els toca', () => {
    const fila = filaDe(proves(), 'COSMOS')
    expect(cel·la(fila, 'CI')).not.toBeNull()
    expect(cel·la(fila, 'CM')).toBeNull()
  })
})

describe('filesProves — cicles amb classes excloses', () => {
  // El cas que ho motiva: 1r no passa la comprensió lectora al setembre
  // i 2n sí. La cel·la de Cicle Inicial parlarà només de 2n, i sense
  // dir-ho un 100% semblaria que cobreix tot el cicle.
  const config = { exclusions: { lecturaCl__inicial: ['1rA'] } }
  const registres = [
    { alumneId: '2n-0', curs: '2nA', moment: 'inicial', vl: 70, cl: 7 },
    { alumneId: '2n-1', curs: '2nA', moment: 'inicial', vl: 70, cl: 7 },
  ]

  it('diu quines classes del cicle no fan la prova', () => {
    const fila = filaDe(proves({ lecturaRegistres: registres, configProves: config }), 'CL — Avaluació Inicial')
    const ci = fila.columnes.find((c) => c.id === 'CI')
    expect(ci.excloses).toEqual(['1rA'])
  })

  it('la llista queda buida quan el cicle sencer la fa', () => {
    // Així la marca només surt on hi ha alguna cosa a explicar.
    const fila = filaDe(proves({ lecturaRegistres: registres, configProves: config }), 'VL — Avaluació Inicial')
    expect(fila.columnes.find((c) => c.id === 'CI').excloses).toEqual([])
  })

  it('el percentatge segueix sent sobre les classes que sí que la fan', () => {
    const fila = filaDe(proves({ lecturaRegistres: registres, configProves: config }), 'CL — Avaluació Inicial')
    // 2 de 2 alumnes de 2nA: 1rA no entra al denominador.
    expect(cel·la(fila, 'CI')).toBe(50) // 2 de 4 alumnes de 2n
  })

  it('també ho diu quan el cicle sencer queda fora', () => {
    // Aquí la cel·la ja surt buida, però saber QUINES classes són
    // estalvia anar a mirar la configuració.
    const cap = { exclusions: { lecturaCl__inicial: ['1rA', '1rB', '2nA', '2nB'] } }
    const fila = filaDe(proves({ configProves: cap }), 'CL — Avaluació Inicial')
    const ci = fila.columnes.find((c) => c.id === 'CI')
    expect(ci.valor).toBeNull()
    expect(ci.excloses.length).toBeGreaterThan(0)
  })

  it('les classes excloses van ordenades per nivell', () => {
    const cap = { exclusions: { lecturaCl__inicial: ['2nA', '1rA'] } }
    const fila = filaDe(proves({ configProves: cap }), 'CL — Avaluació Inicial')
    expect(fila.columnes.find((c) => c.id === 'CI').excloses).toEqual(['1rA', '2nA'])
  })
})
