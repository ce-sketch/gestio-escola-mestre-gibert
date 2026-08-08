// ============================================================
// CONFIGURACIÓ DE FIREBASE
// ============================================================
// Substitueix els valors de sota per les claus del teu projecte.
// Les trobaràs a: Firebase Console → Configuración del proyecto
// (la roda dentada, a dalt del tot del menú esquerre) →
// pestanya "General" → apartat "Tus apps" → "Configuración del SDK"
//
// Si encara no tens cap "app web" registrada dins el projecte:
// 1. Ves a la Descripció general del projecte a Firebase
// 2. Clica la icona "</>" (Web) per afegir una app web nova
// 3. Posa-li un nom (p. ex. "gestio-web")
// 4. NO cal activar Firebase Hosting (farem servir Cloudflare Pages)
// 5. Copia l'objecte "firebaseConfig" que et mostri i enganxa'l aquí sota
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDcx7taRD_H2N3qeMElMpzTbUWzFP_GV4o",
  authDomain: "escola-mestre-gibert.firebaseapp.com",
  projectId: "escola-mestre-gibert",
  storageBucket: "escola-mestre-gibert.firebasestorage.app",
  messagingSenderId: "161208507339",
  appId: "1:161208507339:web:9f160ed5cf64d427ab344e"
}

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// Proveïdor de Google, restringit al domini del centre perquè només hi
// pugui entrar personal amb un compte @escolamestregibert.cat.
//
// prompt: 'select_account' força que Google mostri sempre el selector de
// compte, encara que ja hi hagi una sessió activa al navegador — sense
// això, si només tens un compte de Google connectat, Google salta
// directament sense preguntar, cosa que fa impossible provar amb un
// compte diferent (per exemple, un compte d'alumnat per comprovar que
// queda bloquejat) sense tancar sessió manualment a accounts.google.com.
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  hd: 'escolamestregibert.cat',
  prompt: 'select_account',
})

// Fem servir initializeFirestore (en lloc de getFirestore) amb detecció
// automàtica de "long polling". Sense això, Firestore pot trigar molt a
// carregar la primera vegada en entorns de xarxa restrictius (StackBlitz,
// wifis d'escola amb filtres, proxys corporatius...), perquè primer prova
// una connexió que aquestes xarxes bloquegen i només després reintenta
// amb el mètode que sí funciona.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
})
