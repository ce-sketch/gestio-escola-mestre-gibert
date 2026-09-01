import { describe, it, expect } from 'vitest'

import { llegeixResumPI, llegeixResumAD, llegeixResumSIEI } from './sicAlumnatIndicadors'

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
