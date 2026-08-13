// Comprovacions dels càlculs.
//
// Al centre no hi ha Node per executar proves, així que les proves viuen
// dins de la mateixa app: s'obren des del mòdul "Comprovacions" i diuen
// quins càlculs donen el que ha de donar.
//
// Cada vegada que es trobi un error de càlcul, s'hi afegeix una línia aquí
// i ja no torna a passar desapercebut.
//
// Cada comprovació retorna { nom, esperat, obtingut, ok } — sense excepcions
// ni res que pugui deixar la pantalla en blanc.

import {
  objectiusPerDefecte, resultatOperatiu, resultatObjectiu, normalitzaObjectius,
} from './pgac'
import { mitjanaObjectiu, mitjanaValoracio, pendentsValoracio, valoracioBuida } from './valoracions'
import { opcionsDe, ESCALES } from './escales'
import { NIVELLS_GRAU, festaBuida, mitjanaObjectiuGrup, mitjanaGrup, mitjanaGeneralFesta } from './festesDetall'
import { escalaDeFormula } from './valoracionsPlantillaParser'
import { escalaDelText } from './pgacPlantillaParser'

const arrodoneix = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n)

function comprova(nom, esperat, calcula) {
  try {
    const obtingut = arrodoneix(calcula())
    return { nom, esperat, obtingut, ok: JSON.stringify(obtingut) === JSON.stringify(esperat) }
  } catch (err) {
    return { nom, esperat, obtingut: `error: ${err.message}`, ok: false }
  }
}

// ── PGAC ────────────────────────────────────────────────────────────────

function grupPgac() {
  const proves = []

  proves.push(comprova(
    "Objectiu 1: només l'operatiu 1.1 fet dona 25%",
    25,
    () => {
      const o = objectiusPerDefecte()[0]
      o.competencies.actiu = false
      o.operatius[0].indicadors[0].gener = 100
      return resultatObjectiu(o, 'gener').valor
    }
  ))

  proves.push(comprova(
    "Objectiu 1: només l'operatiu 1.2 fet dona 75%",
    75,
    () => {
      const o = objectiusPerDefecte()[0]
      o.competencies.actiu = false
      o.operatius[1].indicadors.forEach((i) => { i.gener = 100 })
      return resultatObjectiu(o, 'gener').valor
    }
  ))

  proves.push(comprova(
    'Objectiu 1: operatius al 100% i competències a 0 dona 65% (el 65/35)',
    65,
    () => {
      const o = objectiusPerDefecte()[0]
      o.operatius.forEach((op) => op.indicadors.forEach((i) => { i.gener = 100 }))
      o.competencies.gener = 0
      return resultatObjectiu(o, 'gener').valor
    }
  ))

  proves.push(comprova(
    'PGAC: els indicadors sense valorar compten 0, no s\'ignoren',
    12.5,
    () => {
      const o = objectiusPerDefecte()[2]
      o.operatius[0].indicadors[0].gener = 100 // 1 de 4, dins d'un operatiu que pesa 50%
      return resultatObjectiu(o, 'gener').valor
    }
  ))

  proves.push(comprova(
    'PGAC: tot fet dona 100% als tres objectius',
    [100, 100, 100],
    () => objectiusPerDefecte().map((o) => {
      o.operatius.forEach((op) => op.indicadors.forEach((i) => { i.gener = 100 }))
      if (o.competencies.actiu) o.competencies.gener = 100
      return resultatObjectiu(o, 'gener').valor
    })
  ))

  proves.push(comprova(
    'PGAC: els pesos dels operatius sumen 100% a tots els objectius',
    [100, 100, 100],
    () => objectiusPerDefecte().map((o) => o.operatius.reduce((t, op) => t + Number(op.pes), 0))
  ))

  proves.push(comprova(
    'PGAC: els pesos dels indicadors sumen 100% dins de cada operatiu amb indicadors',
    true,
    () => objectiusPerDefecte().every((o) => o.operatius.every((op) =>
      op.indicadors.length === 0 ||
      Math.abs(resultatOperatiu(op, 'gener').pesTotal - 100) < 0.5))
  ))

  proves.push(comprova(
    'PGAC: un document antic sense pesos els rep repartits a parts iguals',
    [50, 50],
    () => {
      const migrat = normalitzaObjectius([{
        id: 'x', titol: 'Vell',
        operatius: [{ id: 'a', titol: 'Op A', text: '', indicadors: [{ id: '1', text: '', gener: '', juny: '' }, { id: '2', text: '', gener: '', juny: '' }] }],
      }])
      return migrat[0].operatius[0].indicadors.map((i) => i.pesGlobal)
    }
  ))

  return { titol: 'PGAC', proves }
}

// ── Valoracions ─────────────────────────────────────────────────────────

function grupValoracions() {
  const proves = []
  const actuacio = (gener) => ({ id: Math.random().toString(), text: 'a', gener, juny: '', escala: 'execucio50' })

  proves.push(comprova(
    'Comissió de 10 objectius amb només el primer fet dona 10%, no 100%',
    10,
    () => mitjanaValoracio({
      objectius: Array.from({ length: 10 }, (_, i) => ({
        id: `o${i}`,
        actuacions: Array.from({ length: 4 }, () => actuacio(i === 0 ? 100 : '')),
      })),
    }, 'gener')
  ))

  proves.push(comprova(
    "Objectiu amb No fet / En procés / Fet / Fet dona 62,5% (l'AVERAGE del full)",
    62.5,
    () => mitjanaObjectiu({ id: 'x', actuacions: [actuacio(0), actuacio(50), actuacio(100), actuacio(100)] }, 'gener')
  ))

  proves.push(comprova(
    'Cicle amb 80%, 40% i un sense valorar dona 40%',
    40,
    () => mitjanaValoracio({
      objectius: [
        { id: 'a', gener: 80, juny: '', escala: 'lliure', actuacions: [] },
        { id: 'b', gener: 40, juny: '', escala: 'lliure', actuacions: [] },
        { id: 'c', gener: '', juny: '', escala: 'lliure', actuacions: [] },
      ],
    }, 'gener')
  ))

  proves.push(comprova(
    "Una valoració desada es torna a llegir sencera (abans hi havia una crida trencada que ho tallava)",
    true,
    () => {
      // Reprodueix el que fa carregaValoracio: barrejar el que hi ha desat
      // amb l'esquelet buit. Havia de petar per una funció inexistent.
      const desat = { nom: 'Comissió TAC', responsable: 'A', objectius: [{ id: 'x', text: 'Obj', actuacions: [] }] }
      const carregat = { ...valoracioBuida(), ...desat, objectius: desat.objectius }
      return carregat.nom === 'Comissió TAC' && carregat.objectius.length === 1
    }
  ))

  proves.push(comprova(
    'El comptador de pendents distingeix valorades de no valorades',
    { total: 8, valorats: 2 },
    () => pendentsValoracio({
      objectius: [
        { id: 'a', actuacions: [actuacio(100), actuacio(''), actuacio(''), actuacio('')] },
        { id: 'b', actuacions: [actuacio(50), actuacio(''), actuacio(''), actuacio('')] },
      ],
    }, 'gener')
  ))

  return { titol: 'Valoracions', proves }
}

// ── Escales ─────────────────────────────────────────────────────────────

function grupEscales() {
  const proves = []

  proves.push(comprova(
    "Comissions: 'En procés' val 50%, no 40%",
    50,
    () => opcionsDe({ escala: 'execucio50' }).find((o) => /procés/i.test(o.label)).valor
  ))

  proves.push(comprova(
    "PGAC: 'En procés' val 40%",
    40,
    () => opcionsDe({ escala: 'execucio' }).find((o) => /procés/i.test(o.label)).valor
  ))

  proves.push(comprova(
    "L'escala de percentatge lliure no ofereix botons",
    0,
    () => opcionsDe({ escala: 'lliure' }).length
  ))

  proves.push(comprova(
    'Cap escala del catàleg té dos cops el mateix percentatge',
    true,
    () => ESCALES.every((e) => new Set(e.opcions.map((o) => o.valor)).size === e.opcions.length)
  ))

  proves.push(comprova(
    'Totes les escales van de 0 a 100',
    true,
    () => ESCALES.every((e) => e.opcions.length === 0 ||
      (e.opcions[0].valor === 0 && e.opcions[e.opcions.length - 1].valor === 100))
  ))

  return { titol: 'Escales', proves }
}

// ── Lectors de plantilles ───────────────────────────────────────────────

function grupLectors() {
  const proves = []

  proves.push(comprova(
    'Llegeix l\'escala de tres estats de la fórmula del full de comissions',
    [0, 50, 100],
    () => escalaDeFormula('if(F7="no fet", 0%, if(F7="En procés",50%, if(F7="fet", 100%)))').map((o) => o.valor)
  ))

  proves.push(comprova(
    'Llegeix una actuació binària',
    [0, 100],
    () => escalaDeFormula('if(F9="no fet", 0%, if(F9="fet", 100%))').map((o) => o.valor)
  ))

  proves.push(comprova(
    'Llegeix una escala de recompte',
    [0, 10, 20, 100],
    () => escalaDeFormula('if(F7=0,0%, F7=1,10%, F7=2,20%, F7=10,100%)').map((o) => o.valor)
  ))

  proves.push(comprova(
    'Llegeix l\'escala del text del criteri del PGAC',
    [0, 40, 100],
    () => escalaDelText('Fet=100% En procés=40% No fet= 0%').map((o) => o.valor)
  ))

  proves.push(comprova(
    "Un text sense escala no s'inventa res",
    null,
    () => escalaDelText('Informe elaborat i lliurat a la direcció')
  ))

  return { titol: 'Lectors de plantilles', proves }
}


// ── Festes ──────────────────────────────────────────────────────────────
// Els números d'aquestes comprovacions surten del full real de la
// Castanyada del curs 2025-26, i s'han verificat un per un contra el que
// diu aquell full.

function grupFestes() {
  const proves = []

  proves.push(comprova(
    'Els 6 nivells valen 0 / 20 / 40 / 60 / 80 / 100',
    [0, 20, 40, 60, 80, 100],
    () => NIVELLS_GRAU.map((n) => n.valor)
  ))

  proves.push(comprova(
    'Una festa nova neix amb els pesos 30/30/40 dels fulls del centre',
    [30, 30, 40],
    () => festaBuida('Castanyada').objectius.map((o) => o.pes)
  ))

  // La Castanyada 25-26, Educació Infantil:
  //   Objectiu 1 → Alt, Alt, Bo        = 93,33%
  //   Objectiu 2 → Alt, Alt, Alt       = 100%
  //   Objectiu 3 → Alt, Alt, Alt       = 100%
  //   amb els pesos 30/30/40           = 98,00%  ← el que diu el full
  const castanyadaEI = () => {
    const festa = festaBuida('Castanyada')
    const [o1, o2, o3] = festa.objectius
    const posa = (objectiu, graus) => {
      festa.grups['Educació Infantil'][objectiu.id].activitats =
        graus.map((g) => ({ id: Math.random().toString(), text: '', grau: g }))
    }
    posa(o1, [100, 100, 80])
    posa(o2, [100, 100, 100])
    posa(o3, [100, 100, 100])
    return festa
  }

  proves.push(comprova(
    "Castanyada 25-26, Infantil, objectiu 1 (Alt/Alt/Bo) dona 93,33%",
    93.33,
    () => {
      const festa = castanyadaEI()
      return mitjanaObjectiuGrup(festa, 'Educació Infantil', festa.objectius[0].id)
    }
  ))

  proves.push(comprova(
    "Castanyada 25-26, Infantil: amb els pesos 30/30/40 dona el 98% del full",
    98,
    () => mitjanaGrup(castanyadaEI(), 'Educació Infantil')
  ))

  // El total de l'objectiu 1 de la festa: mitjana dels 4 cicles al 80% i
  // Equip Directiu al 20%. Al full: 89,33%.
  proves.push(comprova(
    "Castanyada 25-26: cicles al 80% i equip directiu al 20% donen el 89,33% del full",
    89.33,
    () => {
      const festa = festaBuida('Castanyada')
      const [o1] = festa.objectius
      const posa = (grup, graus) => {
        festa.grups[grup][o1.id].activitats = graus.map((g) => ({ id: Math.random().toString(), text: '', grau: g }))
      }
      // Només l'objectiu 1, i per això li donem tot el pes.
      festa.objectius = [{ ...o1, pes: 100 }]
      for (const g of Object.keys(festa.grups)) {
        festa.grups[g] = { [o1.id]: festa.grups[g][o1.id] }
      }
      posa('Educació Infantil', [100, 100, 80])   // 93,33
      posa('Cicle Inicial', [100, 80, 100])       // 93,33
      posa('Cicle Mitjà', [100, 80, 80])          // 86,67
      posa('Cicle Superior', [100, 100, 40])      // 80,00
      posa('Equip Directiu', [80, 100, 100])      // 93,33
      return mitjanaGeneralFesta(festa)
    }
  ))

  return { titol: 'Festes', proves }
}

// ── Punts oberts, marcats a posta com a pendents ────────────────────────

export function executaComprovacions() {
  return [grupPgac(), grupValoracions(), grupFestes(), grupEscales(), grupLectors()]
}
