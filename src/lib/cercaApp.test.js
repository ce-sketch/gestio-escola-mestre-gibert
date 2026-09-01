import { describe, it, expect } from 'vitest'

import { DESTINACIONS, cerca } from './cercaApp'

/**
 * Els ids dels mòduls, copiats del registre del Dashboard.
 *
 * Es repeteixen aquí a posta i no s'importen de Dashboard.jsx: aquell
 * fitxer arrossega tots els mòduls amb `lazy()` i React, i el test
 * hauria de muntar mig navegador per llegir-ne una llista de cadenes.
 *
 * ⚠️ Si algun dia s'afegeix o es reanomena un mòdul, aquesta llista s'ha
 * d'actualitzar. És justament el que ha de petar: una entrada de cerca
 * que apunti a un id que no existeix NO surt mai als resultats i ningú
 * se n'assabenta — que és el que passava amb el "Quadre de comandament",
 * registrat com a `matriu` però buscat com a `matriuGeneral`.
 */
const IDS_MODULS = [
  'inici', 'alumnes', 'atenciodiversitat', 'calendari', 'avaluacio', 'assistencia', 'absentisme',
  'documentacio', 'economia', 'pgac', 'sic', 'matriu', 'backup', 'comprovacions',
]

const modulsDe = (ids) => ids.map((id) => ({ id, label: id }))

describe('DESTINACIONS', () => {
  it('totes apunten a un mòdul que existeix de debò', () => {
    const desconegudes = DESTINACIONS
      .filter((d) => !IDS_MODULS.includes(d.modul))
      .map((d) => `${d.nom} → ${d.modul}`)
    expect(desconegudes).toEqual([])
  })

  it('cap no es queda sense paraules de cerca', () => {
    const buides = DESTINACIONS.filter((d) => !d.paraules?.length).map((d) => d.nom)
    expect(buides).toEqual([])
  })

  it('no hi ha dues entrades amb el mateix nom dins del mateix mòdul', () => {
    const claus = DESTINACIONS.map((d) => `${d.modul}__${d.nom}`)
    expect(claus.length).toBe(new Set(claus).size)
  })
})

describe('cerca', () => {
  const moduls = modulsDe(IDS_MODULS)

  it('troba una destinació per una paraula seva', () => {
    const r = cerca('quadre de comandament', moduls)
    expect(r.some((x) => x.modul === 'matriu')).toBe(true)
  })

  it('no torna res d\'un mòdul que l\'usuari no té permès', () => {
    // El professorat no veu els mòduls d'administració: les seves
    // destinacions tampoc no han de sortir a la cerca.
    const r = cerca('quadre de comandament', modulsDe(['avaluacio', 'assistencia']))
    expect(r).toEqual([])
  })

  it('no distingeix accents ni majúscules', () => {
    expect(cerca('AVALUACIO', moduls).length).toBeGreaterThan(0)
  })

  it('no peta amb una consulta buida', () => {
    expect(Array.isArray(cerca('', moduls))).toBe(true)
  })
})
