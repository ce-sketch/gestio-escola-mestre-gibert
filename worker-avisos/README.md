# Servei d'enviament de correus (avisos d'absentisme)

Aquesta carpeta conté el codi d'un **Cloudflare Worker** independent de
l'aplicació principal. La seva única feina és rebre una petició de l'app
("envia aquest correu a aquestes persones") i fer-la arribar de debò
mitjançant Resend, un servei d'enviament de correus amb un pla gratuït
més que suficient per a un centre (3.000 correus/mes, 100/dia).

## Per què cal una peça separada

L'app web no pot enviar correus directament: per motius de seguretat, cap
navegador permet fer-ho, i tampoc convé posar la clau del servei de correu
dins del codi de l'app (qualsevol la podria veure). Per això aquesta peça
viu en un lloc apart, protegit, amb la clau secreta guardada de manera
segura.

## Passos per posar-ho en marxa

### 1. Crea un compte a Resend

1. Ves a **resend.com** i registra't (gratuït, no cal targeta de crèdit).
2. Un cop dins, ves a **API Keys** i crea'n una de nova. Copia-la — la
   necessitaràs al pas 4.
3. (Opcional, recomanat més endavant) Verifica el domini
   `escolamestregibert.cat` a Resend perquè els correus surtin d'una
   adreça pròpia en lloc de `onboarding@resend.dev`. Mentre no ho feu,
   els correus funcionaran igualment amb l'adreça per defecte de Resend.

### 2. Crea el Worker a Cloudflare

1. Al tauler de Cloudflare, ves a **Càlcul → Treballadors i pàgines**.
2. Clica **Crea una aplicació** → **Crea un Worker**.
3. Posa-li un nom, per exemple `avisos-escola-mestre-gibert`.
4. Un cop creat, obre l'editor del Worker i **substitueix tot el contingut**
   pel del fitxer `index.js` d'aquesta carpeta.
5. Desa i desplega ("Deploy").

### 3. Configura els secrets del Worker

Dins la configuració del Worker (pestanya "Settings" → "Variables"):

1. Afegeix una variable **secreta** anomenada `RESEND_API_KEY` amb la clau
   que vas copiar de Resend.
2. Afegeix una variable anomenada `REMITENT` amb el correu remitent (per
   exemple `avisos@escolamestregibert.cat` si heu verificat el domini, o
   deixeu-la sense definir per fer servir `onboarding@resend.dev`).
3. Afegeix una variable anomenada `ORIGEN_PERMES` amb l'adreça des d'on
   es publicarà l'app (per exemple `https://gestio-escola.pages.dev`,
   l'adreça que us doni Cloudflare Pages quan la despleguem). Això evita
   que ningú més faci servir el vostre Worker per enviar correus.

### 4. Connecta l'app amb el Worker

1. Un cop desplegat, Cloudflare et donarà una adreça del tipus
   `https://avisos-escola-mestre-gibert.el-teu-usuari.workers.dev`.
2. Obre `src/lib/email.js` dins del projecte de l'app.
3. Enganxa aquesta adreça al camp `WORKER_AVISOS_URL`.
4. Torna a desplegar l'app.

### 5. Prova-ho

Ves al mòdul "Absentisme" de l'app, selecciona un alumne de prova amb el
quadre marcat, i clica "Envia avisos". Hauries de rebre el correu als
destinataris configurats en pocs segons.

## Seguretat

- La clau de Resend **mai** surt del Worker — l'app només parla amb el
  Worker, i el Worker és qui parla amb Resend.
- El Worker rebutja peticions que no vinguin de l'adreça de la vostra app
  (gràcies a `ORIGEN_PERMES`).
