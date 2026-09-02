import { describe, it, expect } from 'vitest'

import { llegeixResumPI, llegeixResumAD, llegeixResumSIEI, llegeixResumEE, llegeixResumPIPerArea, PI_AREES } from './sicAlumnatIndicadors'

// Files tal com surten de XLSX.utils.sheet_to_json(full, { header: 1,
// raw: false }) sobre el full "ESFERA PI" real (curs 2026-27, mostra).
const CAPCALERA_PI_1 = [
  undefined, 'IDALU', 'Nom', 'Curs ', 'Curs', 'PI', 'TOTAL',
  "Àrea d'Educació física",
]
const CAPCALERA_PI_2 = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, "Data d'inici del PI", 'Data final del PI']
const FILA_PI_SENSE = [undefined, '16411649402', 'Abellán Álvarez, Alexandra', 'EPRILOEM501', '5è A', 'No', 'No', 'No']
const FILA_PI_AMB = [undefined, '18171871375', 'Alva Chavez, Alejandro', 'EPRILOEM302', '3r B', 'Sí', 'Sí', 'Sí']

describe('llegeixResumPI', () => {
  it('llegeix el PI de les files vàlides', () => {
    const mapa = llegeixResumPI([CAPCALERA_PI_1, CAPCALERA_PI_2, FILA_PI_SENSE, FILA_PI_AMB])
    expect(mapa.get('16411649402')).toEqual({ curs: '5è A', pi: false })
    expect(mapa.get('18171871375')).toEqual({ curs: '3r B', pi: true })
  })

  it('ignora les files de capçalera (sense IDALU vàlid)', () => {
    const mapa = llegeixResumPI([CAPCALERA_PI_1, CAPCALERA_PI_2])
    expect(mapa.size).toBe(0)
  })

  it('ignora files sense classe assignada', () => {
    const fila = [undefined, '99999999999', 'Algú Nou', undefined, '', 'No', 'No']
    const mapa = llegeixResumPI([fila])
    expect(mapa.size).toBe(0)
  })

  it('torna un Map buit si no hi ha files', () => {
    expect(llegeixResumPI([]).size).toBe(0)
    expect(llegeixResumPI(undefined).size).toBe(0)
  })
})

// Files reals del full "ESFERA AD". Cal fixar-se que l'IDALU
// 20816733334 té un motiu de NESE escrit però el flag (columna F) és 0
// i, en canvi, "TIPUS B" hi és a 1 — es guarden els tres valors tal com
// vénen, sense intentar fer-los quadrar.
const FILA_AD_SENSE_RES = [undefined, '16411649402', 'Abellán Álvarez, Alexandra', '5è A', undefined, 0, 0, '0', '0']
const FILA_AD_MOTIU_SENSE_FLAG = [undefined, '20816733334', 'Boutakiot , Hafsa', '1r A', 'Situacions socioeconòmiques i/o socioculturals desafavorides', 0, 0, '1', '0']

describe('llegeixResumAD', () => {
  it('llegeix el motiu i el flag de NESE per separat', () => {
    const mapa = llegeixResumAD([FILA_AD_SENSE_RES, FILA_AD_MOTIU_SENSE_FLAG])
    expect(mapa.get('16411649402')).toEqual({
      curs: '5è A', neseMotiu: '', neseFlag: false, tipusANee: false, tipusB: false, tipusC: false,
    })
  })

  it('no assumeix que "té motiu" i "flag a 1" siguin la mateixa cosa', () => {
    const mapa = llegeixResumAD([FILA_AD_MOTIU_SENSE_FLAG])
    const alumne = mapa.get('20816733334')
    expect(alumne.neseMotiu).toBe('Situacions socioeconòmiques i/o socioculturals desafavorides')
    expect(alumne.neseFlag).toBe(false) // el flag NO es dedueix del motiu
    expect(alumne.tipusB).toBe(true)
  })

  it('ignora files sense IDALU o sense classe', () => {
    const capcalera = [undefined, 'IDALU', 'Nom', 'Curs', 'NESE', 'NESE', 'TIPUS A NEE']
    const senseClasse = [undefined, '11111111111', 'Algú', '', undefined, 0, 0]
    const mapa = llegeixResumAD([capcalera, senseClasse])
    expect(mapa.size).toBe(0)
  })

  it('torna un Map buit si no hi ha files', () => {
    expect(llegeixResumAD([]).size).toBe(0)
    expect(llegeixResumAD(undefined).size).toBe(0)
  })
})

// Files reals del full "EE ESFERA" del document "14b. Alumnes NESE.
// Curs actual. Obj 1.xlsx" — un document A PART, no del mateix llibre
// que ESFERA/ESFERA PI/AD. La columna IDALU hi és la C (índex 2) i la
// SIEI la I (índex 8); les dues primeres files reals no porten SIEI
// (cel·la buida), la tercera sí (1).
const FILA_EE_CAPCALERA = ['FF', 'Nº', 'ident Alumne', 'Alumne', 'Nivell', 'Tutors', 'PI', undefined, 'SIEI']
const FILA_EE_SENSE_SIEI = [undefined, '1', '19569942343', 'Ivakhova Mamedova, Milana', '2n A', 'Calenzo Farriols, Noemí', 'No']
const FILA_EE_AMB_SIEI = [undefined, '3', '19101542141', 'Gómez Rico, Amélie', '1r A', 'Soriano Barbeira, Lidia', 'Sí', undefined, '1']

describe('llegeixResumSIEI', () => {
  it('llegeix el flag de SIEI per IDALU', () => {
    const mapa = llegeixResumSIEI([FILA_EE_CAPCALERA, FILA_EE_SENSE_SIEI, FILA_EE_AMB_SIEI])
    expect(mapa.get('19569942343')).toEqual({ siei: false })
    expect(mapa.get('19101542141')).toEqual({ siei: true })
  })

  it('ignora files sense IDALU vàlid', () => {
    const mapa = llegeixResumSIEI([FILA_EE_CAPCALERA])
    expect(mapa.size).toBe(0)
  })

  it('torna un Map buit si no hi ha files', () => {
    expect(llegeixResumSIEI([]).size).toBe(0)
    expect(llegeixResumSIEI(undefined).size).toBe(0)
  })
})

describe('llegeixResumEE', () => {
  it('marca ee:true a tothom que surt llistat, tingui SIEI o no', () => {
    const mapa = llegeixResumEE([FILA_EE_CAPCALERA, FILA_EE_SENSE_SIEI, FILA_EE_AMB_SIEI])
    expect(mapa.get('19569942343')).toEqual({ ee: true }) // sense SIEI, però igualment EE
    expect(mapa.get('19101542141')).toEqual({ ee: true })
  })

  it('ignora files sense IDALU vàlid', () => {
    const mapa = llegeixResumEE([FILA_EE_CAPCALERA])
    expect(mapa.size).toBe(0)
  })

  it('torna un Map buit si no hi ha files', () => {
    expect(llegeixResumEE([]).size).toBe(0)
    expect(llegeixResumEE(undefined).size).toBe(0)
  })
})

// Files reals del full "ESFERA PI (1)": un bloc de classe (la fila de
// totals "1 A", que NO és cap alumne), la fila "Identificador de
// l'alumne/a" (tampoc cap alumne), i dues files d'alumne real — una amb
// totes les àrees a "No" i una amb "efisica" a "Sí".
const FILA_PIAREA_TOTALS_CLASSE = ['1 A', undefined, 8, 4, 28, 31, 32, 19, 0, 10, 0]
const FILA_PIAREA_SUBCAPCALERA = ['Identificador de l’alumne/a', 23, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]
const FILA_PIAREA_SENSE_CAP_AREA = [20821843338, 'Ahmed , Amal Adeel', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', undefined]
const FILA_PIAREA_AMB_EFISICA = [19776792459, 'José Carné, Dana', 'Sí', 'No', 'No', 'No', 'No', 'No', 'No', 'No', undefined]
// Fila real d'un bloc d'Infantil (I4 A): les columnes de Primària (2-10)
// buides, i les d'Infantil (11-14) amb valors — aquest alumne té "Anglès".
const FILA_PIAREA_INFANTIL_AMB_ANGLES = [
  22730684057, 'Álvarez Almirón, Leo', undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, 'No', 'No', 'Sí', 'No',
]
const FILA_PIAREA_INFANTIL_SENSE_CAP_AREA = [
  20134522817, 'Barceló Aledo, Isona', undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, 'No', 'No', 'No', 'No',
]

describe('llegeixResumPIPerArea', () => {
  it('llegeix les 9 àrees de Primària per alumne', () => {
    const mapa = llegeixResumPIPerArea([FILA_PIAREA_SENSE_CAP_AREA, FILA_PIAREA_AMB_EFISICA])
    expect(mapa.get('20821843338').arees).toMatchObject({
      efisica: false, artistica: false, matematiques: false, castella: false,
      catala: false, angles: false, religio: false, medi: false, valors: false,
    })
    expect(mapa.get('19776792459').arees.efisica).toBe(true)
    expect(mapa.get('19776792459').arees.matematiques).toBe(false)
  })

  it('llegeix les àrees pròpies d\'Infantil, a columnes diferents de Primària', () => {
    const mapa = llegeixResumPIPerArea([FILA_PIAREA_INFANTIL_AMB_ANGLES, FILA_PIAREA_INFANTIL_SENSE_CAP_AREA])
    const amb = mapa.get('22730684057').arees
    expect(amb.angles).toBe(true) // ve del bloc d'Infantil, no del de Primària
    expect(amb.descobertaEntorn).toBe(false)
    expect(amb.descobertaMateix).toBe(false)
    expect(amb.efisica).toBe(false) // les columnes de Primària hi eren buides

    const sense = mapa.get('20134522817').arees
    expect(sense.angles).toBe(false)
  })

  it('un alumne de Primària amb Anglès no el perd per l\'OR amb Infantil', () => {
    // Un alumne de Primària té l'Anglès a la columna 7; les columnes
    // d'Infantil (11-14) li queden buides. L'OR entre tots dos blocs no
    // ha de convertir aquest "Sí" real en "No".
    const filaPrimariaAmbAngles = [
      19776792459, 'José Carné, Dana', 'No', 'No', 'No', 'No', 'No', 'Sí', 'No', 'No', undefined,
    ]
    const mapa = llegeixResumPIPerArea([filaPrimariaAmbAngles])
    expect(mapa.get('19776792459').arees.angles).toBe(true)
  })

  it('ignora la fila de totals de classe ("1 A"), que no és cap alumne', () => {
    const mapa = llegeixResumPIPerArea([FILA_PIAREA_TOTALS_CLASSE])
    expect(mapa.size).toBe(0)
  })

  it('ignora la fila "Identificador de l\'alumne/a"', () => {
    const mapa = llegeixResumPIPerArea([FILA_PIAREA_SUBCAPCALERA])
    expect(mapa.size).toBe(0)
  })

  it('un bloc de classe sencer (totals + subcapçalera + alumnes) només compta els alumnes', () => {
    const mapa = llegeixResumPIPerArea([
      FILA_PIAREA_TOTALS_CLASSE, FILA_PIAREA_SUBCAPCALERA,
      FILA_PIAREA_SENSE_CAP_AREA, FILA_PIAREA_AMB_EFISICA,
    ])
    expect(mapa.size).toBe(2)
  })

  it('torna un Map buit si no hi ha files', () => {
    expect(llegeixResumPIPerArea([]).size).toBe(0)
    expect(llegeixResumPIPerArea(undefined).size).toBe(0)
  })
})

describe('PI_AREES', () => {
  it('inclou les 9 àrees de Primària i les 3 pròpies d\'Infantil, sense repetir "Anglès"', () => {
    const ids = PI_AREES.map((a) => a.id)
    expect(ids).toHaveLength(12)
    expect(new Set(ids).size).toBe(12) // cap id repetit
    expect(ids).toContain('angles')
    expect(ids).toContain('descobertaEntorn')
    expect(ids).toContain('comunicacioLlenguatges')
    expect(ids).toContain('descobertaMateix')
  })
})
