import { describe, it, expect } from 'vitest'
import {
  anyDelMes, diesLectiusDelMes, estatCasella, indexaRegistres, resumAlumne, MESOS_CURS,
} from './graellaMensual'

describe('anyDelMes', () => {
  it('de setembre a desembre és el primer any del curs', () => {
    expect(anyDelMes(9, '2026-27')).toBe(2026)
    expect(anyDelMes(12, '2026-27')).toBe(2026)
  })
  it('de gener a juny és el segon', () => {
    expect(anyDelMes(1, '2026-27')).toBe(2027)
    expect(anyDelMes(6, '2026-27')).toBe(2027)
  })
})

describe('MESOS_CURS', () => {
  it('no inclou juliol ni agost', () => {
    // Va provocar un error real: el mes per defecte era l'actual (agost),
    // que no existeix al desplegable, i la graella es quedava en blanc.
    const nums = MESOS_CURS.map((m) => m.num)
    expect(nums).not.toContain(7)
    expect(nums).not.toContain(8)
  })
})

describe('diesLectiusDelMes', () => {
  const inici = '2026-09-08'
  const fi = '2027-06-21'

  it('exclou caps de setmana i festius', () => {
    const dies = diesLectiusDelMes(9, 2026, [{ data: '2026-09-11' }], inici, fi)
    const dates = dies.map((d) => d.data)
    expect(dates).not.toContain('2026-09-11') // festiu
    expect(dates).not.toContain('2026-09-12') // dissabte
    expect(dates).not.toContain('2026-09-13') // diumenge
    expect(dates).toContain('2026-09-10')
  })

  it('exclou els dies anteriors a l\'inici del curs', () => {
    // Error real: setembre sortia des del dia 2, abans que comencés el curs.
    const dies = diesLectiusDelMes(9, 2026, [], inici, fi)
    expect(dies[0].data).toBe('2026-09-08')
  })

  it('exclou els dies posteriors al final del curs', () => {
    const dies = diesLectiusDelMes(6, 2027, [], inici, fi)
    expect(dies[dies.length - 1].data).toBe('2027-06-21')
  })

  it('porta el nom del dia de la setmana', () => {
    const dies = diesLectiusDelMes(9, 2026, [], inici, fi)
    expect(dies[0].nomDia).toBe('Dimarts') // 8/9/2026
  })
})

describe('estatCasella', () => {
  const index = indexaRegistres([
    { data: '2026-09-08', alumneId: 'a', torn: 'mati', estat: 'absent_justificat', creatEl: { seconds: 100 } },
    { data: '2026-09-08', alumneId: 'a', torn: 'mati', estat: 'present', creatEl: { seconds: 200 } },
  ])

  it('es queda amb la marca més recent quan hi ha correccions', () => {
    expect(estatCasella(index, '2026-09-08', 'a', 'mati', '2026-09-30')).toBe('present')
  })

  it('un dia passat sense marca es considera present', () => {
    expect(estatCasella(index, '2026-09-09', 'a', 'mati', '2026-09-30')).toBe('present')
  })

  it('un dia futur no es dona per present', () => {
    expect(estatCasella(index, '2026-10-01', 'a', 'mati', '2026-09-30')).toBeNull()
  })
})

describe('resumAlumne', () => {
  it('compta absències i retards per separat', () => {
    const index = indexaRegistres([
      { data: '2026-09-08', alumneId: 'a', torn: 'mati', estat: 'absent_justificat', creatEl: { seconds: 1 } },
      { data: '2026-09-08', alumneId: 'a', torn: 'tarda', estat: 'absent_injustificat', creatEl: { seconds: 1 } },
      { data: '2026-09-09', alumneId: 'a', torn: 'mati', estat: 'retard_justificat', creatEl: { seconds: 1 } },
    ])
    const dies = [{ data: '2026-09-08' }, { data: '2026-09-09' }]
    const r = resumAlumne(index, dies, 'a', '2026-09-30')
    expect(r.absentJustificat).toBe(1)
    expect(r.absentInjustificat).toBe(1)
    expect(r.retardJustificat).toBe(1)
    expect(r.totalAbsencies).toBe(2)
  })
})
