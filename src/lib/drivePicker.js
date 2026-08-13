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
export async function triaDocumentDelDrive() {
  await carregaPicker()
  const token = await demanaPermis()

  const fitxer = await new Promise((resol) => {
    const vista = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)

    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(CLAU_API)
      .setAppId(NUM_PROJECTE)
      .setTitle('Tria el document')
      .setLocale('ca')
      .addView(vista)
      .addView(new window.google.picker.DocsUploadView())
      .setCallback((dades) => {
        if (dades.action === window.google.picker.Action.PICKED) resol(dades.docs[0])
        else if (dades.action === window.google.picker.Action.CANCEL) resol(null)
      })
      .build()
    picker.setVisible(true)
  })

  if (!fitxer) return null
  return { nom: fitxer.name, buffer: await baixa(fitxer, token) }
}

/** Els fulls de càlcul de Google s'han d'exportar; els .xlsx pujats es
 *  baixen tal qual. */
async function baixa(fitxer, token) {
  const esFullDeGoogle = fitxer.mimeType === 'application/vnd.google-apps.spreadsheet'
  const url = esFullDeGoogle
    ? `https://www.googleapis.com/drive/v3/files/${fitxer.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
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
  return res.arrayBuffer()
}
