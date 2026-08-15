// Càrrega de les llibreries pesades sota demanda.
//
// El problema que resol
// ---------------------
// L'app parteix el codi en trossos amb un nom que porta una empremta
// (`xlsx-D_0l8YDs.js`). Quan es desplega una versió nova, aquells noms
// canvien i els antics deixen d'existir al servidor.
//
// Si algú té la pestanya oberta des d'abans del desplegament i llavors
// prem un botó que carrega el `xlsx`, el navegador demana el tros **de la
// versió vella**, que ja no hi és, i falla amb:
//
//   Failed to fetch dynamically imported module: …/assets/xlsx-D_0l8YDs.js
//
// No és cap error del codi ni del fitxer que s'estigui pujant: és una
// pestanya que s'ha quedat enrere. Però el missatge del navegador no ho diu
// enlloc, i qui el llegeix pensa que l'app està trencada.
//
// Aquí es reconeix aquest cas concret i es diu què cal fer: recarregar.

/** Diu si l'error és d'un tros de codi que ja no existeix al servidor. */
function esVersioVella(err) {
  const missatge = String(err?.message ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(missatge)
}

const AVIS = 'Hi ha una versió nova de l\'aplicació i aquesta pestanya s\'ha quedat enrere. '
  + 'Recarrega la pàgina (Ctrl+F5) i torna-ho a provar; no perdràs res del que hagis desat.'

/**
 * Carrega una llibreria i, si falla per una versió vella, ho explica.
 *
 * @param {() => Promise} importa  la funció que fa l'import dinàmic
 * @param {string} nom             per al missatge d'error genèric
 */
async function carrega(importa, nom) {
  try {
    return await importa()
  } catch (err) {
    if (esVersioVella(err)) throw new Error(AVIS)
    throw new Error(`No s'ha pogut carregar ${nom}: ${err.message}`)
  }
}

/** El lector de fulls de càlcul (429 kB). */
export async function carregaXLSX() {
  return carrega(() => import('xlsx'), 'el lector de fitxers Excel')
}

/** L'escriptor de fulls de càlcul (938 kB). */
export async function carregaExcelJS() {
  return carrega(async () => (await import('exceljs')).default, "l'exportador d'Excel")
}

/** El lector de PDF (468 kB). */
export async function carregaPdfjs() {
  return carrega(async () => {
    const pdfjs = await import('pdfjs-dist')
    const { default: WorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = WorkerUrl
    return pdfjs
  }, 'el lector de PDF')
}
