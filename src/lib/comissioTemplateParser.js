// Interpreta un Excel exportat des d'una plantilla "Valoració [Comissió/
// Equip]" (com les que hi ha a les carpetes de plantilles del centre) i en
// construeix la mateixa estructura que fa servir el mòdul de Valoracions:
// nom, responsable, membres, i els objectius amb les seves actuacions —
// llegides del full "Resum" i dels fulls "Objectiu N" que hi hagi.
//
// Sempre es mostra el resultat abans d'aplicar-lo, perquè l'administrador
// el pugui revisar (la redacció exacta de cada plantilla pot variar una
// mica d'un curs a l'altre).

function textCella(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

/** Versió que rep ja les files (array d'arrays) del full "Resum", perquè
 *  qui la crida decideix com llegir l'Excel (amb la llibreria xlsx). */
export function interpretaResum(filesResum) {
  let nom = ''
  let responsable = ''
  let membres = ''
  const objectius = [] // { num, text }

  for (const fila of filesResum) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    if (/^departament\/comiss/i.test(a)) nom = b
    else if (/^responsable:?$/i.test(a)) responsable = b
    else if (/^membres:?$/i.test(a)) membres = b
    else {
      const m = a.match(/^objectiu\s*(\d+):?$/i)
      if (m && b) objectius.push({ num: Number(m[1]), text: b })
    }
  }
  return { nom, responsable, membres, objectius }
}

/** Llegeix les actuacions del full "Objectiu N" corresponent — files amb
 *  columna A = text de l'actuació i columna B = indicador d'avaluació,
 *  ignorant la fila de capçalera i qualsevol fila sense text a la columna A
 *  (sovint hi ha valors solts de llistes desplegables a columnes més enllà). */
export function interpretaFullObjectiu(filesObjectiu) {
  const actuacions = []
  let dinsDeLaTaula = false
  for (const fila of filesObjectiu) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    if (/^actuacions\/activitats$/i.test(a)) { dinsDeLaTaula = true; continue }
    if (!dinsDeLaTaula) continue
    if (!a) continue
    // Files que són en realitat capçaleres repetides o valors solts de
    // desplegables (No fet, Fet, Endreçades...) no tenen sentit com a
    // activitat — les descartem si són massa curtes i sense indicador.
    if (a.length < 4 && !b) continue
    actuacions.push({ text: a, indicador: b })
  }
  return actuacions
}
