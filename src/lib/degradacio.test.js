import { describe, it, expect } from 'vitest'

import * as resumProves from './resumProvesTaules'
import * as historicNotaArea from './historicNotaArea'
import * as innovamatExport from './innovamatExport'
import * as lectoEI from './lectoescripturaEI'
import * as historicInnovamat from './historicInnovamat'
import * as sic from './sic'
import { resumClasse } from './cosmosParser'

/**
 * Un càlcul que peta amb una dada mal formada deixa la pantalla EN BLANC:
 * React desmunta l'arbre sencer i qui l'està fent servir no veu res ni
 * sap per què. En una app d'escola això vol dir una trucada un divendres
 * a la tarda.
 *
 * Aquests casos no són hipotètics: un document de Firestore pot arribar
 * sense un camp perquè es va desar amb una versió anterior de l'app, o
 * perquè una càrrega es va quedar a mitges. La regla és que els càlculs
 * degradin —tornin zero, buit o null— en comptes de rebentar.
 *
 * Si algun dia un d'aquests falla, la solució NO és treure'l del test:
 * és tornar a posar la guarda que s'hagi perdut.
 */
const OPCIONS = { cursos: [], cursEscolarId: '2026-27', trimestre: '1r trimestre' }

const ESCENARIS = [
  // Col·leccions que encara no existeixen o han tornat buides
  ['resumTee sense registres', () => resumProves.resumTee(null, OPCIONS)],
  ['resumCl sense registres', () => resumProves.resumCl(null, OPCIONS)],
  ['resumVl sense registres', () => resumProves.resumVl(null, OPCIONS)],
  ['fullsTee sense registres', () => resumProves.fullsTee(null, OPCIONS)],
  ['fullsLectura sense registres', () => resumProves.fullsLectura(null, OPCIONS)],
  ['totalGlobal sense files', () => resumProves.totalGlobal([], resumProves.COLUMNES_COMUNES, false)],
  ['taulaExportable sense files', () => resumProves.taulaExportable('Classe', [], resumProves.COLUMNES_COMUNES)],

  ['resumDesDeRegistres sense notes', () => historicNotaArea.resumDesDeRegistres(null, '2026-27')],
  ['fusionaHistoric sense res', () => historicNotaArea.fusionaHistoric(null, null)],
  ['fullEvolucio amb un curs sense files', () => historicNotaArea.fullEvolucioNotaArea([{ cursEscolar: 'x' }])],
  ['fullHistoric amb un curs sense files', () => historicNotaArea.fullHistoricNotaArea([{ cursEscolar: 'x' }])],
  ['totalCentre sense files', () => historicNotaArea.totalCentre(null, {})],

  ['fullsInnovamat sense registres', () => innovamatExport.fullsInnovamat(null, {})],
  ['nomFitxerInnovamat sense registres', () => innovamatExport.nomFitxerInnovamat(null)],

  ['fullResumEI amb una classe sense recomptes', () => lectoEI.fullResumEI([{ classe: 'I4A' }])],
  ['fullHistoricEI amb un buit dins', () => lectoEI.fullHistoricEI([null])],
  ['comptaNivells sense document desat', () => lectoEI.comptaNivells(['a'], null)],
  ['historicEI sense documents', () => lectoEI.historicEI(null)],

  ['entradesHistoric sense registres', () => historicInnovamat.entradesHistoric(null)],
  ['entradesCosmos sense registres', () => historicInnovamat.entradesCosmos(null)],
  ['distribucioPerNivell sense entrades', () => historicInnovamat.distribucioPerNivell(null)],
  ['distribucioCosmos sense entrades', () => historicInnovamat.distribucioCosmos(null, 'final')],
  ['evolucioCosmos sense entrades', () => historicInnovamat.evolucioCosmos(null)],
  ['agrupaPerProva sense entrades', () => historicInnovamat.agrupaPerProva(null)],
  ['resumClasse sense alumnes', () => resumClasse(null)],

  ['analitzaLlista sense línies', () => sic.analitzaLlista(null)],
  ['normalitzaBlocs amb un buit dins', () => sic.normalitzaBlocs([null])],
  ['progres amb un bloc buit', () => sic.progres([null])],
  ['totsElsIndicadors sense blocs', () => sic.totsElsIndicadors(null)],
  ['fusionaValors sense blocs', () => sic.fusionaValors(null, null)],
]

describe('degradació amb dades incompletes', () => {
  for (const [nom, fn] of ESCENARIS) {
    it(`no peta: ${nom}`, () => {
      expect(fn).not.toThrow()
    })
  }

  it('i el que tornen segueix sent utilitzable', () => {
    // No n'hi ha prou de no petar: qui ho rep ha de poder-hi treballar
    // sense comprovar-ho tot un altre cop.
    expect(historicInnovamat.entradesHistoric(null)).toEqual([])
    expect(historicNotaArea.fusionaHistoric(null, null)).toEqual([])
    expect(historicInnovamat.distribucioPerNivell(null).total).toBe(0)
    expect(historicNotaArea.totalCentre(null, {}).total).toBe(0)
    expect(sic.progres([null]).total).toBe(0)
    expect(Object.values(lectoEI.comptaNivells(['a'], null)).every((v) => v === 0)).toBe(true)
  })
})
