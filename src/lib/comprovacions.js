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
import {
  mitjanaObjectiu, mitjanaValoracio, pendentsValoracio, valoracioBuida,
  normalitzaConfigValoracions, nomsActius, suggerimentsComissions,
  afegeixALlista, llistaActivaPerDefecte, agrupaValoracions,
  nomCanonic, mateixNom, nomJaExistent,
} from './valoracions'
import { opcionsDe, ESCALES } from './escales'
import {
  NIVELLS_GRAU, TIPUS_GRUP, festaBuida, normalitzaFesta, grauDeText,
  mitjanaObjectiuGrup, mitjanaGrup, mitjanaGeneralFesta,
} from './festesDetall'
import { objectiuFestaBuit } from './festesDetall'
import { interpretaFullGrupFesta, interpretaPesosFesta } from './festesPlantillaParser'
import { escalaDeFormula, escalaDeText } from './excelLectura'
import { indexAlumne, graellaAbsencies } from './indexAbsencies'
import { primerNom, generaInformeQualitatiu } from './informeQualitatiu'
import { cerca } from './cercaApp'
import { classificaFulls, tipusAmbNom } from './plantillesImport'
import { esClasseAmbLectura } from './rubricaLectura'
import { notaFinalArea, TRIMESTRES } from './notesArea'
import { colorCella } from './matriuColors'
import { interpretaResum, interpretaFullObjectiu } from './comissioTemplateParser'
import { llegeixCosmos, resumClasse, rendimentAPercentatge } from './cosmosParser'
import { claueDeNom, nivellAPercentatge, distribucio, casaAmbAlumnes } from './conmatParser'
import { nomAmbData } from './cursEscolar'
import {
  cooperatiuBuit, grauNivell, grauCicle, grauGlobal, grauObjectiu,
  grauObjectiuNivell, TOTS_ELS_NIVELLS,
} from './aprenentatgeCooperatiu'

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
    'Les dades recollides no alteren el percentatge (el grau es marca a part)',
    50,
    () => {
      const amb = (gener, dades) => ({ id: Math.random().toString(), text: 'a', gener, juny: '', escala: 'execucio50', dades })
      return mitjanaObjectiu({
        id: 'x',
        recullDades: true,
        actuacions: [
          amb(100, { inici: '270', gener: '286', juny: '' }),
          amb('', { inici: 'Fix: 24€ mes', gener: 'Fix: 24€ mes', juny: 'Fix: 24€ mes' }),
        ],
      }, 'gener')
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

  // ── Què surt actiu a cada pestanya ────────────────────────────────────

  proves.push(comprova(
    'Una configuració desada abans de poder triar les mixtes segueix ensenyant-les totes quatre',
    { quantes: 4, actives: 4 },
    () => {
      // Els documents que ja hi ha desats a Firestore no tenen el camp
      // "mixtes": no poden quedar-se amb la pestanya buida.
      const c = normalitzaConfigValoracions({ comissions: [{ nom: 'Comissió TAC', activa: true }] })
      return { quantes: c.mixtes.length, actives: nomsActius(c.mixtes).length }
    }
  ))

  proves.push(comprova(
    'Desactivar una comissió mixta la treu de la llista del professorat',
    ['Comissió Comunicació', 'Jardins. AREP'],
    () => nomsActius(normalitzaConfigValoracions({
      mixtes: [
        { nom: 'Comissió Comunicació', activa: true },
        { nom: 'Comissió Espai de migdia', activa: false },
        { nom: 'Jardins. AREP', activa: true },
      ],
    }).mixtes)
  ))

  proves.push(comprova(
    "Una mixta desactivada tampoc no reapareix suggerida com a comissió normal",
    false,
    () => suggerimentsComissions(
      normalitzaConfigValoracions({
        comissions: [{ nom: 'Comissió TAC', activa: true }],
        mixtes: [{ nom: 'Comissió Espai de migdia', activa: false }],
      }),
      // Encara que ja hi hagi la valoració desada d'aquest curs: totes dues
      // llistes viuen a la mateixa col·lecció.
      ['Comissió Espai de migdia']
    ).includes('Comissió Espai de migdia')
  ))

  proves.push(comprova(
    'Una mixta afegida de nou tampoc no se suggereix a la pestanya de comissions',
    ['Comissió TAC'],
    () => suggerimentsComissions(
      normalitzaConfigValoracions({
        comissions: [{ nom: 'Comissió TAC', activa: true }],
        mixtes: [{ nom: 'Comissió Menjador i AFA', activa: true }],
      }),
      ['Comissió Menjador i AFA']
    )
  ))

  proves.push(comprova(
    'Els cicles no se suggereixen com a comissió, encara que en tinguin de desades',
    ['Comissió TAC'],
    () => suggerimentsComissions(
      normalitzaConfigValoracions({ comissions: [{ nom: 'Comissió TAC', activa: true }], mixtes: [] }),
      ['Cicle Inicial', 'Educació Infantil']
    )
  ))

  proves.push(comprova(
    'Un nom repetit no es duplica a la llista, ni canviant-hi les majúscules',
    1,
    () => {
      let llista = llistaActivaPerDefecte([])
      llista = afegeixALlista(llista, 'Comissió Patis')
      llista = afegeixALlista(llista, '  comissió patis ')
      return llista.length
    }
  ))

  // ── Com s'ordena la llista del Quadre de comandament ──────────────────

  const config3 = normalitzaConfigValoracions({
    mixtes: [{ nom: 'Comissió Comunicació', activa: true }, { nom: 'Jardins. AREP', activa: false }],
  })
  const llistaDesordenada = [
    { id: '1', nom: 'Cicle Mitjà' },
    { id: '2', nom: 'Comissió TAC' },
    { id: '3', nom: 'Educació Infantil' },
    { id: '4', nom: 'Comissió Comunicació' },
    { id: '5', nom: 'Comissió Anglès' },
    { id: '6', nom: 'Cicle Superior' },
    { id: '7', nom: 'Jardins. AREP' },
  ]

  proves.push(comprova(
    'La llista es reparteix en cicles, comissions i mixtes',
    [
      { titol: 'Cicles', noms: ['Educació Infantil', 'Cicle Mitjà', 'Cicle Superior'] },
      { titol: 'Comissions i equips', noms: ['Comissió Anglès', 'Comissió TAC'] },
      { titol: 'Comissions mixtes', noms: ['Comissió Comunicació', 'Jardins. AREP'] },
    ],
    // Els cicles surten en l'ordre de sempre, no per ordre alfabètic; la
    // resta sí. Una mixta desactivada segueix sortint a la seva secció:
    // desactivar-la amaga l'opció als docents, no la valoració ja feta.
    () => agrupaValoracions(llistaDesordenada, config3)
      .map((s) => ({ titol: s.titol, noms: s.valoracions.map((v) => v.nom) }))
  ))

  proves.push(comprova(
    'Les seccions sense res no es dibuixen',
    ['Cicles'],
    () => agrupaValoracions([{ id: '1', nom: 'Cicle Inicial' }], config3).map((s) => s.titol)
  ))

  // ── Noms que són el mateix escrits diferent ───────────────────────────
  // La càrrega massiva del 16 d'agost va crear parelles com "Comissió
  // Anglès" (de la llista de suggeriments) i "Comissió d'anglès" (del full
  // del Drive): com que el nom és l'identificador, en sortien dues.

  proves.push(comprova(
    "«Comissió Anglès» i «Comissió d'anglès» són la mateixa",
    true,
    () => mateixNom('Comissió Anglès', "Comissió d'anglès")
  ))

  proves.push(comprova(
    'També ho són les que només es diferencien per un «de» o per les majúscules',
    [true, true, true],
    () => [
      mateixNom('Comissió de biblioteca', 'Comissió Biblioteca'),
      mateixNom('Comissió de material', 'Comissió Material'),
      mateixNom("Comissió d'Espais", 'Comissió Espais'),
    ]
  ))

  proves.push(comprova(
    'Però dues comissions de debò diferents no es barregen',
    [false, false, false],
    () => [
      mateixNom('Comissió de Transformem els Patis', 'Comissió Patis'),
      mateixNom('Equip LIC', 'Comissió LIC'),
      mateixNom('Comissió Espais', 'Comissió Espai de migdia'),
    ]
  ))

  proves.push(comprova(
    'Un nom buit no es fa igual a res',
    [false, null],
    () => [mateixNom('', ''), nomJaExistent('', ['Comissió TAC'])]
  ))

  proves.push(comprova(
    "En importar es reaprofita el nom que ja hi ha, no se'n crea un de nou",
    'Comissió Anglès',
    () => nomJaExistent("Comissió d'anglès", ['Cicle Inicial', 'Comissió Anglès', 'Comissió TAC'])
  ))

  proves.push(comprova(
    'La forma comparable treu accents, apòstrofs i articles',
    ['comissio angles', 'jardins arep'],
    () => [nomCanonic("Comissió d'Anglès"), nomCanonic('Jardins. AREP')]
  ))

  proves.push(comprova(
    'Una valoració sense nom no fa petar la llista i va a comissions',
    { titol: 'Comissions i equips', quantes: 2 },
    // N'hi ha una de desada per error al Quadre de comandament, sense nom.
    () => {
      const g = agrupaValoracions([{ id: '1', nom: '' }, { id: '2', nom: 'Comissió TAC' }], config3)
      return { titol: g[0].titol, quantes: g[0].valoracions.length }
    }
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
    "El recompte 0-4 de l'AREP val 0 / 25 / 50 / 75 / 100",
    [0, 25, 50, 75, 100],
    () => opcionsDe({ escala: 'recompte4' }).map((o) => o.valor)
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

  proves.push(comprova(
    "La VL/CL no es fa a Educació Infantil, però sí a la resta de classes",
    { i3: false, i5: false, primer: true, sise: true },
    () => ({
      i3: esClasseAmbLectura('I3 A'),
      i5: esClasseAmbLectura('I5'),
      primer: esClasseAmbLectura('1r B'),
      sise: esClasseAmbLectura('6è'),
    })
  ))

  proves.push(comprova(
    'Els colors de la matriu segueixen exactament les franges del full original',
    ['#FF0000', '#FF0000', '#FF9900', '#FF9900', '#4A86E8', '#4A86E8', '#00FF00', '#00FF00'],
    () => [0, 30, 30.1, 60, 60.1, 80, 80.1, 100].map((v) => colorCella(v).bg)
  ))

  proves.push(comprova(
    'Una cel·la sense dades no té color',
    [null, null],
    () => [colorCella(null), colorCella('')]
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
    "Llegeix el recompte de sessions del full de l'AREP",
    [0, 25, 50, 75, 100],
    () => escalaDeFormula('if(F7=0,0%, if(F7=1,25%, if(F7=2,50%, if(F7=3,75%, if(F7=4,100%)))))').map((o) => o.valor)
  ))

  proves.push(comprova(
    'Llegeix una escala de recompte',
    [0, 10, 20, 100],
    () => escalaDeFormula('if(F7=0,0%, F7=1,10%, F7=2,20%, F7=10,100%)').map((o) => o.valor)
  ))

  proves.push(comprova(
    'Llegeix l\'escala del text del criteri del PGAC',
    [0, 40, 100],
    () => escalaDeText('Fet=100% En procés=40% No fet= 0%').map((o) => o.valor)
  ))

  proves.push(comprova(
    "Un text sense escala no s'inventa res",
    null,
    () => escalaDeText('Informe elaborat i lliurat a la direcció')
  ))

  return { titol: 'Lectors de plantilles', proves }
}


// ── Festes ──────────────────────────────────────────────────────────────
// Els números d'aquestes comprovacions surten del full real de la
// Castanyada del curs 2025-26, i s'han verificat un per un contra el que
// diu aquell full.

function grupFestes() {
  const proves = []
  const acts = (graus) => graus.map((g) => ({ id: Math.random().toString(), text: 'a', grau: g }))
  const posa = (festa, grupNom, indexObjectiu, graus) => {
    festa.grups.find((g) => g.nom === grupNom).objectius[indexObjectiu].activitats = acts(graus)
  }

  proves.push(comprova(
    'Els 6 nivells valen 0 / 20 / 40 / 60 / 80 / 100',
    [0, 20, 40, 60, 80, 100],
    () => NIVELLS_GRAU.map((n) => n.valor)
  ))

  proves.push(comprova(
    'Una festa nova neix amb els pesos 30/30/40 dels fulls del centre',
    [30, 30, 40],
    () => festaBuida('Castanyada').grups[0].objectius.map((o) => o.pes)
  ))

  proves.push(comprova(
    'I amb els sis grups: quatre cicles, Equip Directiu i Equip de coordinació al 0%',
    { grups: 6, cicles: 4, pesos: { cicle: 80, coordinacio: 0, directiu: 20 } },
    () => {
      const f = festaBuida('Castanyada')
      return {
        grups: f.grups.length,
        cicles: f.grups.filter((g) => g.tipus === TIPUS_GRUP.CICLE).length,
        pesos: f.pesos,
      }
    }
  ))

  // La Castanyada 25-26, Educació Infantil:
  //   Objectiu 1 → Alt, Alt, Bo        = 93,33%
  //   Objectiu 2 → Alt, Alt, Alt       = 100%
  //   Objectiu 3 → Alt, Alt, Alt       = 100%
  //   amb els pesos 30/30/40           = 98,00%  ← el que diu el full
  const castanyadaEI = () => {
    const festa = festaBuida('Castanyada')
    posa(festa, 'Educació Infantil', 0, [100, 100, 80])
    posa(festa, 'Educació Infantil', 1, [100, 100, 100])
    posa(festa, 'Educació Infantil', 2, [100, 100, 100])
    return festa
  }

  proves.push(comprova(
    'Castanyada 25-26, Infantil, objectiu 1 (Alt/Alt/Bo) dona 93,33%',
    93.33,
    () => {
      const festa = castanyadaEI()
      const objectiu = festa.grups.find((g) => g.nom === 'Educació Infantil').objectius[0]
      return mitjanaObjectiuGrup(festa, 'Educació Infantil', objectiu.id)
    }
  ))

  proves.push(comprova(
    'Castanyada 25-26, Infantil: amb els pesos 30/30/40 dona el 98% del full',
    98,
    () => mitjanaGrup(castanyadaEI(), 'Educació Infantil')
  ))

  // El total de l'objectiu 1 de la festa: mitjana dels 4 cicles al 80% i
  // Equip Directiu al 20%. Al full: 89,33%.
  const castanyadaObjectiu1 = () => {
    const festa = festaBuida('Castanyada')
    // Només l'objectiu 1, i per això li donem tot el pes.
    festa.grups = festa.grups.map((g) => ({ ...g, objectius: [{ ...g.objectius[0], pes: 100 }] }))
    posa(festa, 'Educació Infantil', 0, [100, 100, 80])   // 93,33
    posa(festa, 'Cicle Inicial', 0, [100, 80, 100])       // 93,33
    posa(festa, 'Cicle Mitjà', 0, [100, 80, 80])          // 86,67
    posa(festa, 'Cicle Superior', 0, [100, 100, 40])      // 80,00
    posa(festa, 'Equip Directiu', 0, [80, 100, 100])      // 93,33
    return festa
  }

  proves.push(comprova(
    'Castanyada 25-26: cicles al 80% i equip directiu al 20% donen el 89,33% del full',
    89.33,
    () => mitjanaGeneralFesta(castanyadaObjectiu1())
  ))

  proves.push(comprova(
    "L'Equip de coordinació amb pes 0 no mou el resultat, encara que valori",
    89.33,
    () => {
      const festa = castanyadaObjectiu1()
      posa(festa, 'Equip de coordinació', 0, [0, 0, 0])
      return mitjanaGeneralFesta(festa)
    }
  ))

  proves.push(comprova(
    'I si algun dia la coordinació avalua, el pes hi entra',
    // Cicles 88,33 × 80 + Directiu 93,33 × 20 + Coordinació 20 × 20 → /120
    77.78,
    () => {
      const festa = castanyadaObjectiu1()
      festa.pesos = { ...festa.pesos, coordinacio: 20 }
      posa(festa, 'Equip de coordinació', 0, [20, 20, 20])
      return mitjanaGeneralFesta(festa)
    }
  ))

  proves.push(comprova(
    "Cada grup té els seus objectius: l'Equip Directiu no arrossega els dels cicles",
    { directiu: 60, infantil: 100 },
    () => {
      const festa = festaBuida('Castanyada')
      const directiu = festa.grups.find((g) => g.nom === 'Equip Directiu')
      directiu.objectius = [{ ...objectiuFestaBuit(100), text: "Valorar l'organització de l'exposició", activitats: acts([60, 60]) }]
      posa(festa, 'Educació Infantil', 0, [100])
      festa.grups.find((g) => g.nom === 'Educació Infantil').objectius = [
        { ...festa.grups.find((g) => g.nom === 'Educació Infantil').objectius[0], pes: 100 },
      ]
      return {
        directiu: mitjanaGrup(festa, 'Equip Directiu'),
        infantil: mitjanaGrup(festa, 'Educació Infantil'),
      }
    }
  ))

  proves.push(comprova(
    'Una festa desada amb el model vell es reparteix sola sense perdre res',
    { grups: 6, activitats: 3, mitjana: 93.33 },
    () => {
      const vella = {
        activitat: 'Castanyada',
        data: '',
        objectius: [{ id: 'o1', text: 'Cohesió', pes: 100 }],
        pesCicles: 80,
        pesEquipDirectiu: 20,
        grups: {
          'Educació Infantil': { o1: { activitats: acts([100, 100, 80]), comentaris: 'anava bé' } },
          'Cicle Inicial': { o1: { activitats: [], comentaris: '' } },
          'Cicle Mitjà': { o1: { activitats: [], comentaris: '' } },
          'Cicle Superior': { o1: { activitats: [], comentaris: '' } },
          'Equip Directiu': { o1: { activitats: [], comentaris: '' } },
        },
      }
      const nova = normalitzaFesta(vella)
      return {
        grups: nova.grups.length,
        activitats: nova.grups.find((g) => g.nom === 'Educació Infantil').objectius[0].activitats.length,
        mitjana: Math.round(mitjanaGrup(nova, 'Educació Infantil') * 100) / 100,
      }
    }
  ))

  // ── El lector de plantilles de festa ──────────────────────────────────
  // Reprodueix el full d'un grup tal com és a la Castanyada: el nom del
  // grup sol a dalt, i cada objectiu marcat per "Grau d'assoliment de
  // l'objectiu" amb les seves activitats a sota.
  const fullEI = [
    ['', 'Escola Mestre Enric Gibert i Camins Valoració'],
    ['', '', '', '', '', 'PGAC /', '', 'Curs: 2026-27'],
    ['', 'Educació Infantil', '', '', '', '', 'No assolit'],
    ['', '', '', '', '', '', 'Baix'],
    ['', '-Fomentar la cohesió', "Grau d'assoliment de l'objectiu", '', '', '', 'Poc satisfactori'],
    ['', 'Exposició de carbasses', 'Alt', '100', '%', '', 'Satisfactori'],
    ['', 'Espai compartit', 'Alt', '100', '%', '', 'Bo'],
    ['', "Ball conjunt de tota l'escola", 'Bo', '80', '%', '', 'Alt'],
    ['', '', '', '', '', '', ''],
    ['', '-Elaborar, comunicar i difondre', "Grau d'assoliment de l'objectiu"],
    ['', 'Article publicat a la web', 'No assolit', '0', '%'],
    ['', '', '', '', ''],
    ['', 'Comentaris i propostes de millora'],
    ['', 'Cal començar abans'],
  ]

  proves.push(comprova(
    'Del full de la Castanyada en surten el grup, els seus objectius i els graus',
    {
      nom: 'Educació Infantil',
      objectius: ['Fomentar la cohesió', 'Elaborar, comunicar i difondre'],
      graus: [100, 100, 80],
      comentaris: 'Cal començar abans',
    },
    () => {
      const r = interpretaFullGrupFesta(fullEI)
      return {
        nom: r.nom,
        objectius: r.objectius.map((o) => o.text),
        graus: r.objectius[0].activitats.map((a) => a.grau),
        comentaris: r.comentaris,
      }
    }
  ))

  proves.push(comprova(
    "L'objectiu que al Resum té una falta («Elaboorar») no es perd: cada full es llegeix sol",
    1,
    // Abans les activitats s'emparellaven comparant el text amb el del
    // Resum, i les de l'objectiu 3 es quedaven fora a tots els grups.
    () => interpretaFullGrupFesta(fullEI).objectius[1].activitats.length
  ))

  proves.push(comprova(
    'Els valors del desplegable de la dreta no es colen com a activitats',
    3,
    () => interpretaFullGrupFesta(fullEI).objectius[0].activitats.length
  ))

  proves.push(comprova(
    "El full diu «Comissió de Festes» i a l'app és l'Equip de coordinació",
    'Equip de coordinació',
    () => interpretaFullGrupFesta([
      ['', 'Comissió de Festes'],
      ['', '-Valorar la qualitat del document', "Grau d'assoliment de l'objectiu"],
      ['', "S'ha elaborat a temps", 'Bo', '80', '%'],
    ]).nom
  ))

  proves.push(comprova(
    'Els pesos entre blocs surten dels criteris, amb la falta a «coordnació» inclosa',
    { cicle: 80, coordinacio: 0, directiu: 20 },
    () => interpretaPesosFesta([
      ['', '-Objectiu 1: 30% -Objectiu 2: 30% -Objectiu 3: 40% -Cicles: 80% -Equip de coordnació: 0% -Equip directiu: 20%'],
    ])
  ))

  proves.push(comprova(
    "El text del grau es tradueix a percentatge",
    [0, 40, 100, ''],
    () => [grauDeText('No assolit'), grauDeText('Poc satisfactori'), grauDeText('Alt'), grauDeText('')]
  ))

  return { titol: 'Festes', proves }
}

function grupCooperatiu() {
  const proves = []
  const posa = (d, nivell, vals) => {
    d.valors[nivell].linia.gener = vals[0]
    d.valors[nivell].metodologia.gener = vals[1]
    d.valors[nivell].projectes.gener = vals[2]
    return d
  }

  proves.push(comprova(
    'Els tres objectius pesen 30 / 30 / 40',
    [30, 30, 40],
    () => cooperatiuBuit().objectius.map((o) => o.pes)
  ))

  proves.push(comprova(
    'Els nou nivells van d\'I-3 a 6è',
    ['I-3', 'I-4', 'I-5', '1r', '2n', '3r', '4t', '5è', '6è'],
    () => TOTS_ELS_NIVELLS
  ))

  proves.push(comprova(
    'Tot al 100% dona 100% global',
    100,
    () => {
      const d = cooperatiuBuit()
      TOTS_ELS_NIVELLS.forEach((n) => posa(d, n, [100, 100, 100]))
      return grauGlobal(d, 'gener')
    }
  ))

  proves.push(comprova(
    'Només el tercer objectiu fet en un nivell dona el 40% del seu pes',
    40,
    () => grauNivell(posa(cooperatiuBuit(), 'I-3', [0, 0, 100]), 'I-3', 'gener')
  ))

  proves.push(comprova(
    'Un cicle sencer al 100% aporta el seu 25% al global',
    25,
    () => {
      const d = cooperatiuBuit()
      posa(d, '1r', [100, 100, 100])
      posa(d, '2n', [100, 100, 100])
      return grauGlobal(d, 'gener')
    }
  ))

  proves.push(comprova(
    "El grau del cicle és la mitjana dels seus nivells, no la suma",
    13.33,
    () => grauCicle(posa(cooperatiuBuit(), 'I-3', [0, 0, 100]), 'ei', 'gener')
  ))

  proves.push(comprova(
    "El grau d'un objectiu concret respecta el pes dels cicles",
    80,
    () => {
      const d = cooperatiuBuit()
      TOTS_ELS_NIVELLS.forEach((n) => posa(d, n, [80, 0, 0]))
      return grauObjectiu(d, 'linia', 'gener')
    }
  ))

  // ── Amb actuacions ────────────────────────────────────────────────
  const ambActuacions = (graus) => {
    const d = cooperatiuBuit()
    d.valors['1r'].linia.actuacions = graus.map((g, i) => ({ id: `a${i}`, text: '', gener: g, juny: '' }))
    return d
  }

  proves.push(comprova(
    "Amb actuacions, l'objectiu és la mitjana d'elles i no el número escrit",
    66.67,
    () => Math.round(grauObjectiuNivell(ambActuacions([100, 100, 0]), '1r', 'linia', 'gener') * 100) / 100
  ))

  proves.push(comprova(
    'Una actuació sense valorar compta 0, com als fulls del centre',
    50,
    () => grauObjectiuNivell(ambActuacions([100, '']), '1r', 'linia', 'gener')
  ))

  proves.push(comprova(
    "Sense actuacions, el percentatge escrit segueix valent",
    80,
    () => {
      const d = cooperatiuBuit()
      d.valors['1r'].linia.gener = 80
      return grauObjectiuNivell(d, '1r', 'linia', 'gener')
    }
  ))

  return { titol: 'Aprenentatge cooperatiu', proves }
}


// ── Índex d'absències ───────────────────────────────────────────────────
// Els números surten del full "Assistència" de l'Eina d'avaluació, on un
// alumne amb 31 sessions d'absència sobre 162 té un índex del 19,14%.

function grupAbsencies() {
  const proves = []
  const absencies = (n, estat, prefix = 'x') =>
    Array.from({ length: n }, (_, i) => ({
      alumneId: 'a1', data: `2026-10-${String(i + 1).padStart(2, '0')}`,
      torn: prefix, estat,
    }))

  proves.push(comprova(
    "31 absències sobre 162 sessions donen el 19,14% del full",
    19.14,
    () => Math.round(indexAlumne(absencies(31, 'absent_justificat'), 162).total * 10000) / 100
  ))

  proves.push(comprova(
    "8 absències sense justificar sobre 162 donen el 4,94% del full",
    4.94,
    () => Math.round(indexAlumne(absencies(8, 'absent_injustificat'), 162).injustificades * 10000) / 100
  ))

  proves.push(comprova(
    'Una absència corregida després a present ja no compta',
    0,
    () => indexAlumne([
      { alumneId: 'a', data: '2026-10-01', torn: 'mati', estat: 'absent_injustificat', creatEl: { seconds: 100 } },
      { alumneId: 'a', data: '2026-10-01', torn: 'mati', estat: 'present', creatEl: { seconds: 200 } },
    ], 162).absencies
  ))

  proves.push(comprova(
    'La graella compta els alumnes per sobre de cada llindar',
    { deu: 2, vint: 1 },
    () => {
      const alumnes = [
        { id: '1', nom: 'A', curs: 'I3 A' },
        { id: '2', nom: 'B', curs: 'I3 A' },
        { id: '3', nom: 'C', curs: 'I3 A' },
      ]
      const registres = [
        ...absencies(50, 'absent_justificat').map((r) => ({ ...r, alumneId: '1' })),
        ...absencies(25, 'absent_justificat').map((r) => ({ ...r, alumneId: '2', torn: 'y' })),
        ...absencies(5, 'absent_justificat').map((r) => ({ ...r, alumneId: '3', torn: 'z' })),
      ]
      const g = graellaAbsencies({ alumnes, registres, sessions: 162 })
      return { deu: g.total.llindars[10], vint: g.total.llindars[25] }
    }
  ))

  return { titol: "Índex d'absències", proves }
}


// ── Informe qualitatiu ──────────────────────────────────────────────────

function grupInforme() {
  const proves = []

  proves.push(comprova(
    "De 'Cognom1 Cognom2, Nom' només se n'agafa el nom de fonts",
    ['Aleix', 'Amélie', 'Marc'],
    () => ['Torrades Barrantes, Aleix', 'Gómez Rico, Amélie', 'Marc Puig'].map(primerNom)
  ))

  const informe = (qui = 'Torrades Barrantes, Aleix') => generaInformeQualitatiu({
    nom: qui,
    trimestres: ['1r', '2n', '3r'],
    teePerTrimestre: {
      '1r': { global: 'as', criteris: { coherencia: 'an', presentacio: 'na' } },
      '2n': { global: 'an', criteris: { coherencia: 'ae', presentacio: 'as' } },
      '3r': { global: 'an', criteris: { coherencia: 'ae', ortografia: 'as' } },
    },
    criterisTee: [{ id: 'coherencia' }, { id: 'presentacio' }, { id: 'ortografia' }],
    nivellsCicle: [
      { id: 'ae', label: 'AE', punts: 1 }, { id: 'an', label: 'AN', punts: 2 },
      { id: 'as', label: 'AS', punts: 3 }, { id: 'na', label: 'NA', punts: 4 },
    ],
    momentsLectura: [
      { id: 'inicial', label: 'Avaluació Inicial', teCL: false },
      { id: 'final', label: 'Avaluació Final', teCL: true },
    ],
    lecturaPerMoment: {
      inicial: { vl: 62, nivellVl: 'Baix' },
      final: { vl: 84, nivellVl: 'Mitjà', cl: 6, nivellCl: 'Mitjà' },
    },
  })

  proves.push(comprova(
    "El nom no surt més de dues vegades a tot l'informe",
    true,
    () => (informe().match(/Aleix/g) ?? []).length <= 2
  ))

  proves.push(comprova(
    "Els cognoms no apareixen enlloc de l'informe",
    false,
    () => /Torrades|Barrantes/.test(informe())
  ))

  proves.push(comprova(
    'El mateix alumne genera sempre el mateix text',
    true,
    () => {
      // Generar-lo dues vegades ha de donar el mateix: si el text canviés
      // cada cop que s'obre l'informe, ningú s'hi podria refiar.
      const primera = informe()
      const segona = informe()
      return primera === segona
    }
  ))

  proves.push(comprova(
    'Dotze alumnes amb notes idèntiques donen dotze textos diferents',
    12,
    () => {
      const noms = ['Torrades, Aleix', 'Gómez, Amélie', 'Puig, Bernat', 'Roca, Clara',
        'Vila, Dídac', 'Mas, Elna', 'Serra, Ferran', 'Costa, Gisela',
        'Font, Hug', 'Prat, Irene', 'Sala, Jan', 'Ribas, Laia']
      return new Set(noms.map((n) => informe(n))).size
    }
  ))

  proves.push(comprova(
    "L'article s'apostrofa davant de vocal (a l'avaluació, no a la avaluació)",
    false,
    () => /a la avaluació/i.test(informe())
  ))

  return { titol: 'Informe qualitatiu', proves }
}


// ── Buscador de l'Inici ─────────────────────────────────────────────────

function grupNotesArea() {
  const proves = []

  proves.push(comprova(
    'La final és la mitjana dels tres trimestres quan hi són tots',
    7,
    () => notaFinalArea([6, 7, 8])
  ))

  proves.push(comprova(
    "La final es calcula encara que només hi hagi el 1r trimestre — no cal esperar el 3r com al full original",
    6,
    () => notaFinalArea([6, '', ''])
  ))

  proves.push(comprova(
    'Amb dos trimestres fets, la final és la mitjana només d\'aquests dos',
    7,
    () => notaFinalArea([6, '', 8])
  ))

  proves.push(comprova(
    'Sense cap trimestre encara, la final és buida',
    null,
    () => notaFinalArea(['', '', ''])
  ))

  proves.push(comprova(
    'Són exactament tres trimestres, en ordre',
    ['1r trimestre', '2n trimestre', '3r trimestre'],
    () => TRIMESTRES
  ))

  return { titol: "Notes per àrea", proves }
}

function grupCerca() {
  const proves = []
  const moduls = [
    { id: 'avaluacio', label: 'Avaluació' }, { id: 'documentacio', label: 'Valoracions' },
    { id: 'alumnes', label: 'Alumnes' }, { id: 'assistencia', label: 'Assistència' },
    { id: 'absentisme', label: 'Absentisme' }, { id: 'pgac', label: 'PGAC' },
  ]

  proves.push(comprova(
    'Buscar "castanyada" porta a les festes',
    'documentacio',
    () => cerca('castanyada', moduls)[0]?.modul
  ))

  proves.push(comprova(
    'La cerca de dues paraules troba "Ajuts de menjador"',
    'Ajuts de menjador',
    () => cerca('ajuts menjador', moduls)[0]?.titol
  ))

  proves.push(comprova(
    'Els accents no compten: "avaluacio" troba "Avaluació"',
    true,
    () => cerca('avaluacio', moduls).some((r) => r.modul === 'avaluacio')
  ))

  proves.push(comprova(
    'No es proposa res de mòduls que aquest usuari no pot veure',
    0,
    () => cerca('ajuts', moduls.filter((m) => m.id !== 'alumnes')).length
  ))

  proves.push(comprova(
    'El nom per defecte de la còpia porta data i hora',
    'Còpia del 13/08/2026 a les 22:30',
    () => nomAmbData(new Date(2026, 7, 13, 22, 30))
  ))

  return { titol: "Inici: buscador i còpies", proves }
}


// ── COSMOS (Innovamat) ──────────────────────────────────────────────────

function grupCosmos() {
  const proves = []
  const csv = [
    "Nom,Cognoms,Resultat de la intervenció,Mitjana setmanal de sessions (intervenció),Data del COSMOS inicial,COSMOS inicial completat,Fiabilitat dels resultats del COSMOS inicial,Puntuació habilitats numèriques COSMOS inicial,Rendiment habilitats numèriques COSMOS inicial,Percentil fluïdesa aritmètica COSMOS inicial,Rendiment fluïdesa aritmètica COSMOS inicial,Data del COSMOS final,COSMOS final completat,Fiabilitat dels resultats del COSMOS final,Puntuació habilitats numèriques COSMOS final,Rendiment habilitats numèriques COSMOS final,Percentil fluïdesa aritmètica COSMOS final,Rendiment fluïdesa aritmètica COSMOS final",
    "Alba,Prims,,,2025-10-20,Sí,Resultats fiables,2.68,Alt,98,Alt,2026-05-04,Sí,Resultats fiables,3.00,Alt,99,Alt",
    "Bru,Segon,Èxit,2.5625,2025-10-20,Sí,Resultats fiables,1.14,Mitjà,25,Baix,2026-05-04,Sí,Resultats fiables,1.65,Mitjà,37,Mitjà",
    "Dana,Quart,,,2025-10-20,No,-,,,,,2026-05-04,No,-,,,,",
  ].join('\n')

  proves.push(comprova(
    'Les dimensions es dedueixen de la capçalera, no estan clavades al codi',
    ['fluïdesa aritmètica'],
    () => llegeixCosmos(csv).dimensions.map((d) => d.nom)
  ))

  proves.push(comprova(
    "L'identificador de la dimensió conserva les lletres, sense accents",
    'fluidesa_aritmetica',
    () => llegeixCosmos(csv).dimensions[0].id
  ))

  proves.push(comprova(
    'Un alumne sense la prova feta es marca com a no completada',
    false,
    () => llegeixCosmos(csv).alumnes.find((a) => a.nom === 'Dana').moments.final.completat
  ))

  proves.push(comprova(
    'El nom es guarda com a "Cognoms, Nom", com a la resta de l\'app',
    'Prims, Alba',
    () => llegeixCosmos(csv).alumnes[0].nomComplet
  ))

  proves.push(comprova(
    'El resum compta els alumnes que milloren entre les dues proves',
    { total: 3, ambTotesDues: 2, milloren: 2 },
    () => {
      const r = resumClasse(llegeixCosmos(csv).alumnes)
      return { total: r.total, ambTotesDues: r.ambTotesDues, milloren: r.milloren }
    }
  ))

  proves.push(comprova(
    "L'escala Baix/Mitjà/Alt es pot llegir com a percentatge",
    [33, 66, 100],
    () => ['Baix', 'Mitjà', 'Alt'].map(rendimentAPercentatge)
  ))

  return { titol: 'COSMOS (Innovamat)', proves }
}


// ── ConMat (Innovamat) ──────────────────────────────────────────────────
// El PDF dona els noms enganxats i en ordre invers al de la fitxa d'alumne.
// Casar-los bé és el punt més delicat de tot el lector.

function grupConmat() {
  const proves = []

  proves.push(comprova(
    "Els noms del PDF casen amb els de la fitxa tot i venir enganxats i invertits",
    [true, true, true],
    () => [
      ['AhmedHaniya', 'Ahmed, Haniya'],
      ['AndrésRubioIan', 'Andrés Rubio, Ian'],
      ['GómezRicoAmélie', 'Gómez Rico, Amélie'],
    ].map(([pdf, fitxa]) => claueDeNom(pdf) === claueDeNom(fitxa))
  ))

  proves.push(comprova(
    'Dos alumnes diferents no es confonen entre ells',
    false,
    () => claueDeNom('GarciaPerePau') === claueDeNom('Garcia Pere, Pol')
  ))

  proves.push(comprova(
    "L'escala del ConMat va de 25 en 25",
    [25, 50, 75, 100],
    () => ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt'].map(nivellAPercentatge)
  ))

  proves.push(comprova(
    'Un nivell que no es reconeix no es converteix en cap número',
    null,
    () => nivellAPercentatge('Vés a saber')
  ))

  proves.push(comprova(
    'La distribució de 3rB del curs 25-26 quadra amb el PDF',
    '27 · alt 8 · mitjà-alt 7 · mitjà-baix 4 · baix 8',
    () => {
      const alumnes = [
        ...Array(8).fill({ nivell: 'Alt' }), ...Array(7).fill({ nivell: 'Mitjà-alt' }),
        ...Array(4).fill({ nivell: 'Mitjà-baix' }), ...Array(8).fill({ nivell: 'Baix' }),
      ]
      const d = distribucio(alumnes)
      // En text i no com a objecte: comparar objectes faria dependre la
      // prova de l'ordre de les claus, que no té cap importància.
      return `${d.total} · alt ${d.recompte.alt} · mitjà-alt ${d.recompte.mitja_alt} · mitjà-baix ${d.recompte.mitja_baix} · baix ${d.recompte.baix}`
    }
  ))

  proves.push(comprova(
    "Els alumnes que no casen queden a part i no es desen",
    { casats: 1, sensCasar: 1 },
    () => {
      const r = casaAmbAlumnes(
        [{ nomPdf: 'AhmedHaniya', clau: claueDeNom('AhmedHaniya') },
         { nomPdf: 'AlgúQueNoHiEs', clau: claueDeNom('AlgúQueNoHiEs') }],
        [{ id: 'x1', nom: 'Ahmed, Haniya' }]
      )
      return { casats: r.casats.length, sensCasar: r.sensCasar.length }
    }
  ))

  return { titol: 'ConMat (Innovamat)', proves }
}

// ── Reconeixement de plantilles ─────────────────────────────────────────

function grupReconeixement() {
  const proves = []

  proves.push(comprova(
    "Resum + fulls d'objectiu és una comissió",
    'comissio',
    () => classificaFulls(['Resum', 'Objectiu 1', 'Objectiu 2', 'Objectiu 3'])
  ))

  proves.push(comprova(
    'Resum + fulls de grup és una festa',
    'festa',
    () => classificaFulls(['Resum', 'Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior', 'Equip Directiu'])
  ))

  proves.push(comprova(
    'Un sol full és un cicle, es digui com es digui',
    ['cicle', 'cicle'],
    () => [classificaFulls(['Valoració Cicle Inicial']), classificaFulls(['Full1'])]
  ))

  proves.push(comprova(
    "Un full de cicle que es digui com un grup de festa no es confon amb una festa",
    'cicle',
    // Sense full "Resum" no pot ser una festa, encara que el full es digui
    // "Educació Infantil".
    () => classificaFulls(['Educació Infantil'])
  ))

  proves.push(comprova(
    'Un llibre que no s\'assembla a res queda com a desconegut',
    'desconegut',
    () => classificaFulls(['Dades', 'Gràfics', 'Notes'])
  ))

  proves.push(comprova(
    'Una comissió mixta es reconeix pel nom, no pel document',
    { esMixta: 'mixta', noEsMixta: 'comissio' },
    () => {
      const mixtes = ['Comissió Comunicació', 'Jardins. AREP']
      return {
        esMixta: tipusAmbNom('comissio', 'Comissió Comunicació', { mixtes }),
        noEsMixta: tipusAmbNom('comissio', 'Comissió TAC', { mixtes }),
      }
    }
  ))

  proves.push(comprova(
    'El nom de la mixta es reconeix encara que canviïn les majúscules',
    'mixta',
    () => tipusAmbNom('comissio', '  comissió comunicació ', { mixtes: ['Comissió Comunicació'] })
  ))

  proves.push(comprova(
    'Un nom de cicle mana sobre l\'estructura',
    'cicle',
    () => tipusAmbNom('comissio', 'Cicle Mitjà', { mixtes: [] })
  ))

  // ── Els fulls no comencen a la columna A ──────────────────────────────
  // El Resum d'una comissió té les etiquetes a la columna B i els valors a
  // la D, amb cel·les combinades pel mig. Llegint columnes fixes no en
  // sortia ni el nom ni els objectius, i totes les comissions es quedaven
  // com a "no reconegudes".
  const resumComissio = [
    ['', 'Escola Mestre Enric Gibert i Camins Valoració'],
    ['', '', '', '', '', '', 'PGAC /', 'Curs: 2026-27'],
    ['', '', '', '', '', '', '', ''],
    ['', 'Departament/comissió/servei:', '', 'Comissió TAC'],
    ['', 'Responsable:', '', 'Marta Puig'],
    ['', 'Membres:', '', 'A, B, C'],
    ['', '', '', '', '', '', "Grau d'assoliment gener", "Grau d'assoliment juny"],
    ['', 'Objectiu 1:', 'Potenciar la competència digital.', '', '', '', '0%', '0%'],
    ['', 'Objectiu 2:', 'Actualitzar la web i els blocs.', '', '', '', '0%', '0%'],
  ]

  proves.push(comprova(
    "Del Resum d'una comissió en surten el nom i els objectius encara que comenci a la columna B",
    { nom: 'Comissió TAC', responsable: 'Marta Puig', objectius: 2 },
    () => {
      const r = interpretaResum(resumComissio)
      return { nom: r.nom, responsable: r.responsable, objectius: r.objectius.length }
    }
  ))

  const fullObjectiu = [
    ['', 'Escola Mestre Enric Gibert i Camins Valoració'],
    ['', 'Objectiu 1:', 'Potenciar la competència digital.'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['', 'Actuacions/Activitats', '', "Indicador d'avaluació", '', 'Seguiment gener', '', "Grau d'assoliment juny", '', 'Endreçades'],
    ['', 'Donar a conèixer programes, apps i webs útils.', '', 'Fet(100%)/no fet(0%)', '', 'No fet', '0%', 'No fet', '0%', ''],
    ['', 'Realitzar formacions entre iguals', '', 'Fet(100%)/no fet(0%)', '', 'No fet', '0%', 'No fet', '0%', 'Distribució correcte'],
    ['', '', '', '', '', '', '', '', '', '0'],
    ['', 'Valoració/revisió febrer:'],
    ['', '- Recorda que si copies i enganxes has de fer-ho amb Enganxa amb format'],
  ]

  proves.push(comprova(
    "Les actuacions surten de les columnes de la capçalera, no de les dues primeres",
    {
      quantes: 2,
      primera: 'Donar a conèixer programes, apps i webs útils.',
      indicador: 'Fet(100%)/no fet(0%)',
    },
    () => {
      const a = interpretaFullObjectiu(fullObjectiu)
      return { quantes: a.length, primera: a[0].text, indicador: a[0].indicador }
    }
  ))

  proves.push(comprova(
    "Ni els valors solts dels desplegables de la dreta ni el peu del full es colen com a actuacions",
    false,
    () => interpretaFullObjectiu(fullObjectiu).some((a) => /Endreçades|Distribució|^Valoració|Recorda/.test(a.text))
  ))

  return { titol: 'Reconeixement de plantilles', proves }
}

export function executaComprovacions() {
  return [grupPgac(), grupValoracions(), grupFestes(), grupCooperatiu(), grupAbsencies(), grupInforme(), grupNotesArea(), grupCerca(), grupCosmos(), grupConmat(), grupEscales(), grupLectors(), grupReconeixement()]
}
