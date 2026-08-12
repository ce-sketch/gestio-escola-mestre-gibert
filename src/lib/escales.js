// Catàleg d'escales d'avaluació, transcrit de la pestanya "Formúles" del
// document oficial "Eina d'avaluació PGAC". Cada indicador pot fer servir
// una escala diferent: la majoria fan servir "No fet / En procés / Fet",
// però n'hi ha que compten cicles, nivells, actuacions, fases o formacions,
// i cada recompte té la seva pròpia taula de percentatges.
//
// Els percentatges són EXACTAMENT els del document, decimals inclosos
// (16,7 / 33,4 / 66,7 / 83,5). No estan arrodonits a posta.

export const ESCALES = [
  {
    id: 'execucio',
    nom: 'Execució (No fet / En procés / Fet)',
    ajuda: "L'escala normal: la fan servir 104 de les caselles del document.",
    opcions: [
      { id: 'no_fet', label: 'No fet', valor: 0 },
      { id: 'en_proces', label: 'En procés', valor: 40 },
      { id: 'fet', label: 'Fet', valor: 100 },
    ],
  },
  {
    id: 'binaria',
    nom: 'Binària (No fet / Fet)',
    ajuda: "Per als indicadors que o estan fets o no, sense estat intermedi.",
    opcions: [
      { id: 'no_fet', label: 'No fet', valor: 0 },
      { id: 'fet', label: 'Fet', valor: 100 },
    ],
  },
  {
    id: 'qualitativa3',
    nom: 'Qualitativa (No assolit / Bo / Alt)',
    ajuda: "Per exemple: 0 convenis = No assolit, 1 conveni = Bo, 2-3 = Alt.",
    opcions: [
      { id: 'no_assolit', label: 'No assolit', valor: 0 },
      { id: 'bo', label: 'Bo', valor: 60 },
      { id: 'alt', label: 'Alt', valor: 100 },
    ],
  },
  {
    id: 'qualitativa6',
    nom: 'Qualitativa de 6 nivells',
    ajuda: "La de les valoracions de festes. Atenció: el document en dona els noms però no els percentatges — aquests són una interpolació regular i caldria confirmar-los amb un full de festa real.",
    perConfirmar: true,
    opcions: [
      { id: 'no_assolit', label: 'No assolit', valor: 0 },
      { id: 'baix', label: 'Baix', valor: 20 },
      { id: 'poc_satisfactori', label: 'Poc satisfactori', valor: 40 },
      { id: 'satisfactori', label: 'Satisfactori', valor: 60 },
      { id: 'bo', label: 'Bo', valor: 80 },
      { id: 'alt', label: 'Alt', valor: 100 },
    ],
  },
  {
    id: 'nivells7',
    nom: 'Recompte de nivells (de cap a 6)',
    opcions: [
      { id: 'n0', label: 'Cap nivell', valor: 0 },
      { id: 'n1', label: '1 nivell', valor: 16.7 },
      { id: 'n2', label: '2 nivells', valor: 33.4 },
      { id: 'n3', label: '3 nivells', valor: 50 },
      { id: 'n4', label: '4 nivells', valor: 66.7 },
      { id: 'n5', label: '5 nivells', valor: 83.5 },
      { id: 'n6', label: '6 nivells', valor: 100 },
    ],
  },
  {
    id: 'nivells6',
    nom: 'Recompte de nivells (variant curta)',
    opcions: [
      { id: 'n1', label: '1 nivell o cap', valor: 0 },
      { id: 'n2', label: '2 nivells', valor: 25 },
      { id: 'n3', label: '3 nivells', valor: 50 },
      { id: 'n4', label: '4 nivells', valor: 66.7 },
      { id: 'n5', label: '5 nivells', valor: 83.5 },
      { id: 'n6', label: '6 nivells', valor: 100 },
    ],
  },
  {
    id: 'indicadors6',
    nom: "Recompte d'indicadors dins del llindar",
    ajuda: "La que fa servir l'Objectiu 1 per a les competències bàsiques.",
    opcions: [
      { id: 'i1', label: '1 indicador o cap', valor: 0 },
      { id: 'i2', label: '2 indicadors', valor: 25 },
      { id: 'i3', label: '3 indicadors', valor: 50 },
      { id: 'i4', label: '4 indicadors', valor: 66.7 },
      { id: 'i5', label: '5 indicadors', valor: 83.5 },
      { id: 'i6', label: '6 indicadors', valor: 100 },
    ],
  },
  {
    id: 'actuacions5',
    nom: "Recompte d'actuacions (de 0 a 4)",
    opcions: [
      { id: 'a0', label: '0 actuacions', valor: 0 },
      { id: 'a1', label: '1 actuació', valor: 40 },
      { id: 'a2', label: '2 actuacions', valor: 60 },
      { id: 'a3', label: '3 actuacions', valor: 80 },
      { id: 'a4', label: '4 actuacions', valor: 100 },
    ],
  },
  {
    id: 'actuacions6',
    nom: "Recompte d'actuacions (de 0 a 5)",
    opcions: [
      { id: 'a0', label: '0 actuacions', valor: 0 },
      { id: 'a1', label: '1 actuació', valor: 20 },
      { id: 'a2', label: '2 actuacions', valor: 40 },
      { id: 'a3', label: '3 actuacions', valor: 60 },
      { id: 'a4', label: '4 actuacions', valor: 80 },
      { id: 'a5', label: '5 actuacions', valor: 100 },
    ],
  },
  {
    id: 'fases4',
    nom: 'Recompte de fases o actuacions (de 0 a 3)',
    opcions: [
      { id: 'f0', label: '0 fases', valor: 0 },
      { id: 'f1', label: '1 fase', valor: 33 },
      { id: 'f2', label: '2 fases', valor: 66 },
      { id: 'f3', label: '3 fases', valor: 100 },
    ],
  },
  {
    id: 'objectius5',
    nom: "Recompte d'objectius",
    opcions: [
      { id: 'o0', label: '0 objectius', valor: 0 },
      { id: 'o1', label: '1 objectiu', valor: 20 },
      { id: 'o2', label: '2 objectius', valor: 50 },
      { id: 'o3', label: '3 objectius', valor: 80 },
      { id: 'o4', label: '4 o més objectius', valor: 100 },
    ],
  },
  {
    id: 'cicles3',
    nom: 'Recompte de cicles',
    ajuda: "Tal com surt al document, que no hi preveu el cas d'1 cicle.",
    opcions: [
      { id: 'c0', label: '0 cicles', valor: 0 },
      { id: 'c2', label: '2 cicles', valor: 66 },
      { id: 'c3', label: '3 cicles', valor: 100 },
    ],
  },
  {
    id: 'formacions5',
    nom: 'Recompte de formacions',
    opcions: [
      { id: 'f0', label: 'Cap formació', valor: 0 },
      { id: 'f2', label: '2 formacions', valor: 33.4 },
      { id: 'f3', label: '3 formacions', valor: 50 },
      { id: 'f4', label: '4 formacions', valor: 66.7 },
      { id: 'f6', label: '6 formacions', valor: 100 },
    ],
  },
  {
    id: 'cursos5',
    nom: 'Recompte de cursos',
    opcions: [
      { id: 'c1', label: '1 curs o cap', valor: 0 },
      { id: 'c3', label: '3 cursos', valor: 50 },
      { id: 'c4', label: '4 cursos', valor: 66.7 },
      { id: 'c5', label: '5 cursos', valor: 83.5 },
      { id: 'c7', label: '7 cursos', valor: 100 },
    ],
  },
  {
    id: 'execucio50',
    nom: 'Execució amb En procés al 50%',
    ajuda: "La que fan servir els fulls de comissions i equips: allà 'En procés' val 50%, no 40%.",
    opcions: [
      { id: 'no_fet', label: 'No fet', valor: 0 },
      { id: 'en_proces', label: 'En procés', valor: 50 },
      { id: 'fet', label: 'Fet', valor: 100 },
    ],
  },
  {
    id: 'recompte10',
    nom: 'Recompte de 0 a 10 (de 10 en 10)',
    ajuda: 'Surt a la Comissió TAC per comptar elements: 0 = 0%, 5 = 50%, 10 = 100%.',
    opcions: Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, label: String(i), valor: i * 10 })),
  },
  {
    id: 'lliure',
    nom: 'Percentatge lliure (0-100%)',
    ajuda: "La dels fulls de cicle: no hi ha estats, s'escriu directament el percentatge.",
    opcions: [],
  },
]

export const ESCALA_PER_DEFECTE = 'execucio'

/** Les opcions que toquen a un indicador: les de la seva escala del
 *  catàleg, o les seves pròpies si ve d'una plantilla amb una escala que
 *  no és cap de les conegudes. */
export function opcionsDe(element) {
  if (element?.escala === 'lliure') return []
  if (element?.escala === 'propia' && Array.isArray(element.opcions) && element.opcions.length) {
    return element.opcions.map((o, i) => ({ id: o.id ?? `p${i}`, label: o.label, valor: o.valor }))
  }
  return escalaDe(element?.escala).opcions
}

export function escalaDe(id) {
  return ESCALES.find((e) => e.id === id) ?? ESCALES[0]
}

/** Quina opció d'una escala correspon a un valor ja desat — null si el
 *  número no coincideix amb cap (perquè s'ha escrit a mà). */
export function opcioDe(escalaId, valor) {
  if (valor === '' || valor === null || valor === undefined) return null
  const n = Number(valor)
  return escalaDe(escalaId).opcions.find((o) => Math.abs(o.valor - n) < 0.05) ?? null
}
