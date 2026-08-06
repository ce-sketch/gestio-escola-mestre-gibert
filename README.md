# Gestió Escola Mestre Enric Gibert i Camins

Esquelet inicial de l'eina de gestió escolar: login, navegació entre mòduls
(Inici, Avaluació, Assistència, Documentació) i connexió a Firebase.

## 1. Connectar amb el teu projecte Firebase

Obre `src/firebase.js` i substitueix els valors de `firebaseConfig` per
les claus reals del projecte "Escola Mestre Gibert":

1. Firebase Console → icona de la roda dentada → **Configuración del proyecto**
2. Pestanya **General** → apartat **Tus apps**
3. Si encara no hi ha cap app web, clica la icona `</>` per crear-ne una
   (nom suggerit: `gestio-web`; NO cal activar Firebase Hosting)
4. Copia l'objecte `firebaseConfig` i enganxa'l a `src/firebase.js`

## 2. Aplicar les regles de seguretat de Firestore

1. Firebase Console → **Firestore Database** → pestanya **Reglas**
2. Enganxa el contingut del fitxer `firestore.rules` d'aquest projecte
3. Clica **Publicar**

Sense aquest pas, ningú podrà llegir ni escriure dades encara que hagi
iniciat sessió correctament.

## 3. Crear un usuari de prova

1. Firebase Console → **Authentication** → pestanya **Usuarios**
2. Clica **Agregar usuario**
3. Posa un correu i una contrasenya (per exemple, el teu propi correu del centre)

Amb aquest usuari ja podràs iniciar sessió a l'aplicació.

## 4. Provar-ho en local

Necessites [Node.js](https://nodejs.org) instal·lat (versió 18 o superior).

```bash
npm install
npm run dev
```

Obre l'adreça que et mostri la terminal (normalment `http://localhost:5173`).

## 5. Publicar-ho a Cloudflare Pages

```bash
npm run build
```

Això genera una carpeta `dist/` amb l'aplicació ja preparada per publicar.

Després, a Cloudflare:

1. Ves a **Càlcul → Treballadors i pàgines**
2. Clica **Crea una aplicació** → **Pages** → **Carrega una carpeta d'actius directament** (o connecta-ho amb un repositori de GitHub, si en teniu un)
3. Selecciona/arrossega la carpeta `dist/`
4. Publica

Cada vegada que facis canvis al codi, caldrà tornar a fer `npm run build`
i tornar a pujar la carpeta `dist/` (o, si ho connectes amb GitHub, es farà
automàticament amb cada canvi).

## Estructura del projecte

```
src/
  firebase.js              configuració i connexió a Firebase
  App.jsx                  gestiona si l'usuari ha iniciat sessió
  components/
    Login.jsx               pantalla d'inici de sessió
    Dashboard.jsx            menú lateral + contingut del mòdul actiu
    modules/
      Inici.jsx               pantalla de benvinguda
      Avaluacio.jsx           mòdul d'avaluació (placeholder)
      Assistencia.jsx         mòdul d'assistència (funcional, dades d'exemple)
      Documentacio.jsx        mòdul de documentació (placeholder)
firestore.rules            regles de seguretat per copiar a Firebase Console
```

## Com afegir un mòdul nou sense trencar els altres

1. Crea un fitxer nou dins `src/components/modules/` (per exemple `Comunicacio.jsx`)
2. Registra'l a `src/components/Dashboard.jsx`, dins la llista `MODULES`
3. Si necessita desar dades, crea una col·lecció nova a Firestore amb un nom
   propi (per exemple `comunicacio`) — mai reutilitzis una col·lecció d'un
   altre mòdul, per no barrejar dades ni arriscar-te a perdre informació
4. Afegeix les regles de seguretat corresponents a `firestore.rules` i
   torna-les a publicar a Firebase Console

## Pendent (properes sessions)

- Connectar el mòdul d'Assistència a una col·lecció real `alumnes` (ara fa
  servir una llista d'exemple)
- Construir el mòdul d'Avaluació (entrada de notes, historial per alumne)
- Construir el mòdul de Documentació (pujada de fitxers a Cloudflare R2)
- Afegir rols d'usuari (professorat / direcció / secretaria) per limitar
  qui pot veure o editar cada cosa
