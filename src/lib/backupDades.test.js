import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { COL·LECCIONS } from './backupDades'

/**
 * Una col·lecció que no és al backup no es recupera mai.
 *
 * Aquest test llegeix el codi font i busca totes les col·leccions de
 * Firestore que l'app fa servir, comparant-les amb les que el backup
 * inclou. Es fa així —i no amb una llista escrita a mà— perquè el
 * problema real és **oblidar-se'n en afegir-ne una de nova**: una llista
 * a mà s'oblidaria exactament igual.
 *
 * Ja ha passat dues vegades: `matematiques` i `lectoescripturaEI` hi van
 * faltar una temporada, i `historicProves` en va quedar fora perquè un
 * comentari deia que era l'única amb la lectura reservada a
 * l'administrador — cosa que va deixar de ser certa quan s'hi van afegir
 * `economia`, `pgac` i `sic`.
 *
 * Si aquest test falla en afegir una col·lecció nova, la solució és
 * posar-la a COL·LECCIONS, no treure-la d'aquí.
 */
function coleccionsDelCodi() {
  // `__dirname` no existeix als mòduls ES; es reconstrueix de la URL.
  const arrel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const trobades = new Set()

  const recorre = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { recorre(p); continue }
      if (!/\.(js|jsx)$/.test(e.name) || e.name.endsWith('.test.js')) continue
      const codi = fs.readFileSync(p, 'utf8')
      // collection(db, 'nom') i doc(db, 'nom', ...)
      for (const m of codi.matchAll(/\b(?:collection|doc)\(\s*db\s*,\s*'([a-zA-Z·]+)'/g)) {
        trobades.add(m[1])
      }
    }
  }
  recorre(arrel)
  return [...trobades].sort()
}

describe('el backup cobreix tota l\'app', () => {
  const alBackup = new Set(COL·LECCIONS.map((c) => c.id))

  it('no hi ha cap col·lecció que l\'app faci servir i el backup no inclogui', () => {
    const oblidades = coleccionsDelCodi().filter((c) => !alBackup.has(c))
    expect(oblidades, `Falten al backup: ${oblidades.join(', ')}`).toEqual([])
  })

  it('no hi ha col·leccions al backup que ja no es facin servir', () => {
    // Una col·lecció que ja no existeix fa el .zip més gros i confon en
    // llegir-lo. No és greu, però val la pena saber-ho.
    const delCodi = new Set(coleccionsDelCodi())
    const sobreres = [...alBackup].filter((c) => !delCodi.has(c))
    expect(sobreres, `Sobren al backup: ${sobreres.join(', ')}`).toEqual([])
  })

  it('cada col·lecció diu si es pot sobreescriure en restaurar', () => {
    // Els registres que no es modifiquen mai (assistència, avaluació) NO
    // s'han de sobreescriure; la configuració, sí. Deixar-ho sense dir
    // faria que la restauració decidís sola.
    for (const c of COL·LECCIONS) {
      expect(typeof c.sobreescriu, `${c.id} no diu si es sobreescriu`).toBe('boolean')
      expect(c.nom, `${c.id} no té nom llegible`).toBeTruthy()
    }
  })

  it('els identificadors no es repeteixen', () => {
    expect(COL·LECCIONS.length).toBe(alBackup.size)
  })
})
