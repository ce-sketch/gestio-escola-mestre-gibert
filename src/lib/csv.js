/** Converteix una llista d'objectes en un text CSV, amb les columnes indicades. */
export function aCsv(files, columnes) {
  const escapa = (valor) => {
    const text = valor === null || valor === undefined ? '' : String(valor)
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const capçalera = columnes.map((c) => escapa(c.etiqueta)).join(',')
  const línies = files.map((fila) => columnes.map((c) => escapa(c.valor(fila))).join(','))
  return [capçalera, ...línies].join('\n')
}

/** Converteix un Timestamp de Firestore (o null) a text llegible. */
export function formataData(timestamp) {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleString('ca-ES')
}
