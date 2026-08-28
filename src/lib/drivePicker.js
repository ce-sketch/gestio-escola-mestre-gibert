// Tria un document del Drive sense haver de baixar-lo i tornar-lo a pujar.
//
// Com funciona
// ------------
// 1. Es demana permís amb el mateix compte de Google amb què ja s'ha entrat
//    a l'app, afegint-hi l'àmbit `drive.file`.
// 2. S'obre el selector de fitxers de Google (el mateix que surt a Gmail
//    quan adjuntes des del Drive).
// 3. Del fitxer triat se'n baixa el contingut en format Excel.
//
// Per què `drive.file` i no `drive.readonly`
// ------------------------------------------
// `drive.file` només dona accés als fitxers que l'usuari tria expressament
// al selector, i prou. És un àmbit "no sensible": Google no demana cap
// verificació de l'aplicació ni ensenya pantalles d'avís. El `readonly`
// donaria accés a tot el Drive i obligaria a passar una revisió de Google.
//
// Cal tenir activat al projecte de Google Cloud (escola-mestre-gibert):
//   · Google Picker API
//   · Google Drive API
// Si no ho estan, el botó avisa amb un missatge clar en comptes de fallar.

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase'

const CLAU_API = 'AIzaSyDcx7taRD_H2N3qeMElMpzTbUWzFP_GV4o'
const NUM_PROJECTE = '161208507339'
const AMBIT = 'https://www.googleapis.com/auth/drive.file'

let gapiCarregat = null

/** Carrega la llibreria del selector de Google, un sol cop. */
function carregaPicker() {
  if (gapiCarregat) return gapiCarregat
  gapiCarregat = new Promise((resol, rebutja) => {
    if (window.google?.picker) return resol()
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('picker', {
        callback: () => resol(),
        onerror: () => rebutja(new Error("No s'ha pogut carregar el selector de Google.")),
      })
    }
    script.onerror = () => rebutja(new Error(
      "No s'ha pogut contactar amb Google. Comprova la connexió, o fes servir el botó de pujar el fitxer."
    ))
    document.head.appendChild(script)
  })
  return gapiCarregat
}

/** Demana permís d'accés al Drive amb el compte que ja té la sessió oberta. */
async function demanaPermis() {
  const proveidor = new GoogleAuthProvider()
  proveidor.addScope(AMBIT)
  proveidor.setCustomParameters({
    hd: 'escolamestregibert.cat',
    login_hint: auth.currentUser?.email ?? '',
  })
  const resultat = await signInWithPopup(auth, proveidor)
  const token = GoogleAuthProvider.credentialFromResult(resultat)?.accessToken
  if (!token) throw new Error("Google no ha donat permís d'accés al Drive.")
  return token
}

/**
 * Obre el selector i retorna el fitxer triat, ja baixat com a ArrayBuffer.
 * Retorna null si l'usuari tanca el selector sense triar res.
 *
 * @returns {Promise<{nom: string, buffer: ArrayBuffer} | null>}
 */
export async function triaDocumentDelDrive(tipus = 'fulls') {
  const fitxers = await triaDocumentsDelDrive(tipus, false)
  return fitxers.length > 0 ? fitxers[0] : null
}

/**
 * Igual, però deixant triar-ne uns quants de cop. Cada fitxer el tria
 * l'usuari expressament, que és el que demana el permís `drive.file`:
 * seleccionar una carpeta sencera voldria accés a toto el Drive i una
 * revisió de Google.
 *
 * @returns {Promise<Array<{nom: string, buffer: ArrayBuffer, mime: string}>>}
 */
export async function triaDocumentsDelDrive(tipus = 'fulls', multiple = true) {
  await carregaPicker()
  const token = await demanaPermis()

  const triats = await new Promise((resol) => {
    // Cada mòdul busca una cosa diferent: els preus i el calendari són
    // documents de text, els informes de l'Innovamat arriben en CSV, i la
    // resta són fulls de càlcul. Un CSV no surt a la vista de fulls de
    // Google, perquè per al Drive és un fitxer qualsevol.
    // Compte amb les vistes DOCUMENTS i SPREADSHEETS: només ensenyen el
    // format PROPI de Google (Docs, Fulls de càlcul de Google), no els
    // fitxers .xlsx/.pdf/.csv de veritat que s'hagin pujat al Drive. Els
    // informes de l'Innovamat són PDF i per això les carpetes sortien
    // buides; el mateix li passava a "fulls" amb un .xlsx real com el de
    // "Nota mitjana d'àrea" — la vista SPREADSHEETS no el mostrava. Per
    // qualsevol format que no sigui nadiu de Google cal demanar-lo per
    // mime type sobre la vista genèrica DOCS.
    const idVista = tipus === 'documents'
      ? window.google.picker.ViewId.DOCUMENTS
      : window.google.picker.ViewId.DOCS
    const vista = new window.google.picker.DocsView(idVista)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
    if (tipus === 'csv') {
      // Els CSV pujats i els fulls de Google, que també es poden exportar
      // a CSV. La resta de fitxers queden fora per no despistar.
      vista.setMimeTypes('text/csv,text/plain,application/vnd.google-apps.spreadsheet')
    }
    if (tipus === 'pdf') {
      vista.setMimeTypes('application/pdf')
    }
    if (tipus === 'fulls') {
      // Tant els fulls natius de Google com un .xlsx/.xls de veritat
      // pujat al Drive (com el de "Nota mitjana d'àrea").
      vista.setMimeTypes([
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ].join(','))
    }

    const constructor = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(CLAU_API)
      .setAppId(NUM_PROJECTE)
      .setTitle(multiple ? 'Tria els documents' : 'Tria el document')
      .setLocale('ca')
      .addView(vista)
      .addView(new window.google.picker.DocsUploadView())
      .setCallback((dades) => {
        if (dades.action === window.google.picker.Action.PICKED) resol(dades.docs ?? [])
        else if (dades.action === window.google.picker.Action.CANCEL) resol([])
      })
    if (multiple) constructor.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    const picker = constructor.build()
    picker.setVisible(true)
  })

  // Es baixen d'un en un a posta: si en van vint, fer-ho tot alhora és
  // una bona manera que Google en talli algun.
  const fitxers = []
  for (const fitxer of triats) {
    const { buffer, mime } = await baixa(fitxer, tipus, token)
    fitxers.push({ nom: fitxer.name, buffer, mime })
  }
  return fitxers
}

/** Els fulls de càlcul de Google s'han d'exportar; els .xlsx pujats es
 *  baixen tal qual. */
async function baixa(fitxer, tipus, token) {
  // Un document de Google no es pot baixar tal qual: s'ha d'exportar. Els
  // fulls, a Excel; els documents de text, a text pla, que és el que
  // esperen els lectors de preus i de calendari.
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const mimeExport = tipus === 'documents' ? 'text/plain'
    : tipus === 'csv' ? 'text/csv'
    : XLSX_MIME
  const esDeGoogle = (fitxer.mimeType ?? '').startsWith('application/vnd.google-apps.')
  const url = esDeGoogle
    ? `https://www.googleapis.com/drive/v3/files/${fitxer.id}/export?mimeType=${encodeURIComponent(mimeExport)}`
    : `https://www.googleapis.com/drive/v3/files/${fitxer.id}?alt=media`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        "Google ha denegat la baixada. Comprova que al projecte de Google Cloud " +
        "hi ha activades la Google Drive API i la Google Picker API."
      )
    }
    throw new Error(`No s'ha pogut baixar el document (codi ${res.status}).`)
  }
  return { buffer: await res.arrayBuffer(), mime: esDeGoogle ? mimeExport : (fitxer.mimeType ?? '') }
}
