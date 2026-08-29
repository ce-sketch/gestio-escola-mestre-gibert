import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import { exportaDadesCrues, restauraDades, inspeccionaBackup } from '../../lib/backupDades'
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, serverTimestamp, orderBy, query, limit } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { aCsv, formataData } from '../../lib/csv'
import { comptaDiesLectius } from '../../lib/calendar'
import { calculaIndexos } from '../../lib/absentisme'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { slug } from '../../lib/slug'

const DIES_AVIS = 30

export default function Backup() {
  const [exportant, setExportant] = useState(false)
  const [exportantHistoric, setExportantHistoric] = useState(false)
  const [backupLlegit, setBackupLlegit] = useState(null)   // { nom, dades, contingut }
  const [triades, setTriades] = useState(new Set())
  const [confirmaRestaura2, setConfirmaRestaura2] = useState('')
  const [restaurantZip, setRestaurantZip] = useState(null)
  const [resultatRestaura, setResultatRestaura] = useState(null)
  const [ultimBackup, setUltimBackup] = useState(null)
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [nomVersio, setNomVersio] = useState('')
  const [versions, setVersions] = useState([])
  const [carregantVersions, setCarregantVersions] = useState(true)
  const [confirmaRestaura, setConfirmaRestaura] = useState({}) // { [versioId]: text escrit }
  const [restaurant, setRestaurant] = useState(null)
  const [versioTriadaId, setVersioTriadaId] = useState('')

  useEffect(() => {
    async function carrega() {
      try {
        const snap = await getDoc(doc(db, 'configuracio', 'backup'))
        if (snap.exists()) {
          setUltimBackup(snap.data().ultimBackup?.toDate?.() ?? null)
        }
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut comprovar l'última còpia: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
    carregaVersions()
  }, [])

  async function carregaVersions() {
    setCarregantVersions(true)
    try {
      const snap = await getDocs(query(collection(db, 'versions'), orderBy('creatEl', 'desc'), limit(30)))
      const llista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setVersions(llista)
      // La més recent, seleccionada d'entrada: és la que es voldrà mirar
      // gairebé sempre.
      setVersioTriadaId((actual) => actual || llista[0]?.id || '')
    } catch (err) {
      // Si encara no hi ha cap versió (o falta l'índex), no cal amoïnar l'usuari.
      setVersions([])
    } finally {
      setCarregantVersions(false)
    }
  }

  /** Obre un .zip de còpia i ensenya què hi ha, sense tocar res encara. */
  async function llegeixBackup(fitxer) {
    if (!fitxer) return
    setBackupLlegit(null)
    setResultatRestaura(null)
    setMissatge(null)
    try {
      const zip = await JSZip.loadAsync(fitxer)
      const dades = {}
      for (const [ruta, entrada] of Object.entries(zip.files)) {
        const m = ruta.match(/^dades\/([a-zA-Z]+)\.json$/)
        if (!m || m[1] === 'manifest') continue
        dades[m[1]] = JSON.parse(await entrada.async('string'))
      }
      const contingut = inspeccionaBackup(dades)
      if (contingut.length === 0) {
        setMissatge({
          type: 'error',
          text: "Aquest .zip no porta la carpeta \"dades/\". Deu ser una còpia feta abans que l'app sabés restaurar; d'aquelles només se'n poden llegir els CSV.",
        })
        return
      }
      setBackupLlegit({ nom: fitxer.name, dades, contingut })
      setTriades(new Set(contingut.map((c) => c.id)))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut obrir el fitxer: ${err.message}` })
    }
  }

  async function apliquaRestauracio() {
    if (!backupLlegit) return
    setRestaurantZip('començant')
    setResultatRestaura(null)
    try {
      const resultat = await restauraDades(backupLlegit.dades, {
        nomes: [...triades],
        onProgres: (nom, fets, total) => setRestaurantZip(`${nom}: ${fets} de ${total}`),
      })
      setResultatRestaura(resultat)
      setBackupLlegit(null)
      setConfirmaRestaura2('')
    } catch (err) {
      setMissatge({ type: 'error', text: `La restauració ha fallat: ${err.message}` })
    } finally {
      setRestaurantZip(null)
    }
  }

  async function fesBackup() {
    setExportant(true)
    setMissatge(null)
    try {
      const zip = new JSZip()
      let totalFitxers = 0

      // --- Alumnes: un CSV per classe ---
      const alumnesSnap = await getDocs(collection(db, 'alumnes'))
      const alumnes = alumnesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const alumnesPerClasse = agrupaPer(alumnes, (a) => a.curs || 'sense-classe')
      const carpetaAlumnes = zip.folder('alumnes')
      for (const [curs, llista] of Object.entries(alumnesPerClasse)) {
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        const csv = aCsv(llista, [
          { etiqueta: 'Número', valor: (a) => a.numLlista ?? '' },
          { etiqueta: 'Nom', valor: (a) => a.nom },
          { etiqueta: 'Actiu', valor: (a) => (a.actiu === false ? 'No' : 'Sí') },
          { etiqueta: 'Actualitzat', valor: (a) => formataData(a.actualitzatEl) },
        ])
        carpetaAlumnes.file(`${netejaNom(curs)}.csv`, csv)
        totalFitxers += 1
      }

      // --- Assistència: un CSV per classe ---
      const assistenciaSnap = await getDocs(collection(db, 'assistencia'))
      const assistencia = assistenciaSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const assistenciaPerClasse = agrupaPer(assistencia, (a) => a.curs || 'sense-classe')
      const carpetaAssistencia = zip.folder('assistencia')
      for (const [curs, registres] of Object.entries(assistenciaPerClasse)) {
        registres.sort((a, b) => a.data.localeCompare(b.data) || a.alumneNom.localeCompare(b.alumneNom))
        const csv = aCsv(registres, [
          { etiqueta: 'Data', valor: (r) => r.data },
          { etiqueta: 'Torn', valor: (r) => r.torn },
          { etiqueta: 'Alumne', valor: (r) => r.alumneNom },
          { etiqueta: 'Estat', valor: (r) => r.estat },
          { etiqueta: 'Motiu', valor: (r) => r.motiu ?? '' },
          { etiqueta: 'Marcat per', valor: (r) => r.creatPer ?? '' },
          { etiqueta: 'Marcat el', valor: (r) => formataData(r.creatEl) },
        ])
        carpetaAssistencia.file(`${netejaNom(curs)}.csv`, csv)
        totalFitxers += 1
      }

      // --- Calendari: un fitxer per curs escolar ---
      const calendariSnap = await getDocs(collection(db, 'calendari'))
      const carpetaCalendari = zip.folder('calendari')
      calendariSnap.docs.forEach((d) => {
        const dades = d.data()
        const contingut = JSON.stringify(dades, substituteixTimestamps, 2)
        carpetaCalendari.file(`${netejaNom(d.id)}.json`, contingut)
        totalFitxers += 1
      })

      // --- Avaluació: un CSV per classe (si n'hi ha) ---
      const avaluacioSnap = await getDocs(collection(db, 'avaluacio'))
      if (!avaluacioSnap.empty) {
        const avaluacio = avaluacioSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const avaluacioPerClasse = agrupaPer(avaluacio, (a) => a.curs || 'sense-classe')
        const carpetaAvaluacio = zip.folder('avaluacio')
        for (const [curs, registres] of Object.entries(avaluacioPerClasse)) {
          const csv = aCsv(registres, Object.keys(registres[0] ?? {}).map((k) => ({ etiqueta: k, valor: (r) => r[k] })))
          carpetaAvaluacio.file(`${netejaNom(curs)}.csv`, csv)
          totalFitxers += 1
        }
      }

      // --- Documentació: un CSV general (si n'hi ha) ---
      const documentacioSnap = await getDocs(collection(db, 'documentacio'))
      if (!documentacioSnap.empty) {
        const documentacio = documentacioSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const csv = aCsv(documentacio, Object.keys(documentacio[0] ?? {}).map((k) => ({ etiqueta: k, valor: (r) => r[k] })))
        zip.file('documentacio.csv', csv)
        totalFitxers += 1
      }

      // --- Absentisme: informes ja calculats, per curs escolar, trimestre i classe ---
      const carpetaAbsentisme = zip.folder('absentisme')
      for (const calendariDoc of calendariSnap.docs) {
        const cursEscolarId = calendariDoc.id
        const dadesCalendari = calendariDoc.data()
        const trimestres = dadesCalendari.trimestres ?? []
        const diesNoLectius = dadesCalendari.diesNoLectius ?? []

        for (const trimestre of trimestres) {
          if (!trimestre.inici || !trimestre.fi) continue
          const diesLectius = comptaDiesLectius(trimestre.inici, trimestre.fi, diesNoLectius)
          const carpetaTrimestre = carpetaAbsentisme.folder(`${netejaNom(cursEscolarId)}/${netejaNom(trimestre.nom)}`)

          for (const [curs, alumnesDeLaClasse] of Object.entries(alumnesPerClasse)) {
            const registresClasse = assistencia.filter(
              (r) => r.curs === curs && r.data >= trimestre.inici && r.data <= trimestre.fi
            )
            const indexos = calculaIndexos(alumnesDeLaClasse, registresClasse, diesLectius)
            if (indexos.length === 0) continue
            indexos.sort((a, b) => b.indexInjustificat - a.indexInjustificat)
            const csv = aCsv(indexos, [
              { etiqueta: 'Alumne', valor: (f) => f.alumne.nom },
              { etiqueta: 'Absències', valor: (f) => f.absencies },
              { etiqueta: 'Absències no justif.', valor: (f) => f.absenciesInjust },
              { etiqueta: 'Retards', valor: (f) => f.retards },
              { etiqueta: 'Retards no justif.', valor: (f) => f.retardsInjust },
              { etiqueta: 'Índex absentisme total (%)', valor: (f) => f.indexAbsentisme.toFixed(1) },
              { etiqueta: 'Índex no justificat (%)', valor: (f) => f.indexInjustificat.toFixed(1) },
            ])
            carpetaTrimestre.file(`${netejaNom(curs)}.csv`, csv)
            totalFitxers += 1
          }
        }
      }

      // Les dades en cru, que són les que permeten tornar-les a entrar.
      // Els CSV de sobre són per llegir; això és per restaurar.
      const { dades, comptadors } = await exportaDadesCrues()
      const carpetaDades = zip.folder('dades')
      for (const [nom, documents] of Object.entries(dades)) {
        carpetaDades.file(`${nom}.json`, JSON.stringify(documents, null, 1))
        totalFitxers += 1
      }
      carpetaDades.file('manifest.json', JSON.stringify({
        versio: 1,
        generat: new Date().toISOString(),
        comptadors,
      }, null, 1))

      zip.file(
        'LLEGIU-ME.txt',
        'Còpia de seguretat de l\'Escola Mestre Enric Gibert i Camins\n' +
        `Generada el: ${new Date().toLocaleString('ca-ES')}\n\n` +
        'Aquest fitxer conté dades personals d\'alumnat. Guardeu-lo en un lloc segur ' +
        'i restringit, i esborreu-lo del dispositiu si no és exclusivament vostre.\n\n' +
        'Estructura:\n' +
        '  alumnes/<classe>.csv                          llistat d\'alumnes de cada classe\n' +
        '  assistencia/<classe>.csv                      historial d\'assistència en brut, de cada classe\n' +
        '  absentisme/<curs>/<trimestre>/<classe>.csv     informe d\'absentisme ja calculat, per trimestre\n' +
        '  calendari/<curs>.json                          calendari escolar de cada curs\n' +
        '  avaluacio/<classe>.csv                         notes (si n\'hi ha)\n' +
        '  documentacio.csv                               documentació (si n\'hi ha)\n' +
        '  dades/<col·lecció>.json                        les dades en cru, per poder restaurar\n\n' +
        'Els CSV són per llegir i obrir amb l\'Excel. La carpeta dades/ és la que fa\n' +
        'servir l\'app si un dia has de recuperar aquest backup.\n'
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const enllac = document.createElement('a')
      enllac.href = url
      enllac.download = `backup-escola-mestre-gibert-${new Date().toISOString().slice(0, 10)}.zip`
      enllac.click()
      URL.revokeObjectURL(url)

      await setDoc(doc(db, 'configuracio', 'backup'), { ultimBackup: serverTimestamp() }, { merge: true })
      setUltimBackup(new Date())

      // Desem també una "versió amb nom" dins de Firestore (no només el
      // .zip descarregat), amb una instantània dels alumnes perquè es
      // pugui restaurar més endavant si cal.
      await setDoc(doc(collection(db, 'versions')), {
        nom: nomVersio.trim() || `Còpia del ${new Date().toLocaleDateString('ca-ES')}`,
        cursEscolar: cursEscolarActual(),
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
        comptadors: {
          alumnes: alumnes.length,
          assistencia: assistencia.length,
          avaluacio: avaluacioSnap.size,
        },
        alumnesSnapshot: JSON.stringify(alumnes),
      })
      setNomVersio('')
      await carregaVersions()

      setMissatge({ type: 'ok', text: `Còpia de seguretat descarregada (${totalFitxers} fitxers, organitzats per classe) i versió desada.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut fer la còpia: ${err.message}` })
    } finally {
      setExportant(false)
    }
  }

  /**
   * Baixa l'històric de proves (TEE i VL/CL) en el mateix format que espera
   * el botó "Importa l'històric" de la pestanya Històric.
   *
   * NO substitueix el .zip general: `historicProves` també hi és. Aquest
   * botó existeix perquè el fitxer que en surt es pot tornar a pujar tal
   * qual amb "Importa l'històric", sense haver de passar per la
   * restauració completa — útil per moure l'històric entre entorns o per
   * revisar-lo a part.
   *
   * (El comentari d'abans deia que se n'excloïa per ser l'única col·lecció
   * amb la lectura reservada a l'administrador. Ja no és cert: economia,
   * pgac i sic estan igual i sí que van al .zip. El resultat era que una
   * restauració general no recuperava l'històric, que és justament l'únic
   * que no es pot refer des de l'app.)
   */
  async function exportaHistoric() {
    setExportantHistoric(true)
    setMissatge(null)
    try {
      const [teeSnap, vlclSnap] = await Promise.all([
        getDoc(doc(db, 'historicProves', 'tee')),
        getDoc(doc(db, 'historicProves', 'vlcl')),
      ])
      if (!teeSnap.exists() && !vlclSnap.exists()) {
        setMissatge({ type: 'error', text: "Encara no hi ha cap històric desat a Firestore (la col·lecció és buida)." })
        return
      }
      const teeDades = teeSnap.data() ?? {}
      const vlclDades = vlclSnap.data() ?? {}
      const contingut = {
        tee: { registres: teeDades.registres ?? [] },
        vlcl: { registres: vlclDades.registres ?? [] },
        origen: teeDades.origen ?? vlclDades.origen ?? '',
        llegitEl: teeDades.llegitEl ?? vlclDades.llegitEl ?? '',
      }
      const blob = new Blob([JSON.stringify(contingut, null, 1)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const enllac = document.createElement('a')
      enllac.href = url
      enllac.download = `historic-proves-copia-${new Date().toISOString().slice(0, 10)}.json`
      enllac.click()
      URL.revokeObjectURL(url)
      setMissatge({
        type: 'ok',
        text: `Històric exportat (${contingut.tee.registres.length} registres de TEE, ${contingut.vlcl.registres.length} de VL/CL). Per recuperar-lo: Avaluació → Històric → "📤 Importa l'històric" i tria aquest fitxer.`,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut exportar l'històric: ${err.message}` })
    } finally {
      setExportantHistoric(false)
    }
  }

  async function restauraAlumnes(versio) {
    setRestaurant(versio.id)
    setMissatge(null)
    try {
      const alumnesNous = JSON.parse(versio.alumnesSnapshot)

      // 1) Esborrem els alumnes actuals (per lots de 500, límit de Firestore).
      const actualSnap = await getDocs(collection(db, 'alumnes'))
      for (let i = 0; i < actualSnap.docs.length; i += 500) {
        const batch = writeBatch(db)
        for (const d of actualSnap.docs.slice(i, i + 500)) batch.delete(doc(db, 'alumnes', d.id))
        await batch.commit()
      }

      // 2) Hi tornem a escriure els de la versió (mateix IDALU com a ID de
      // document, així l'historial d'assistència/avaluació es manté enllaçat).
      for (let i = 0; i < alumnesNous.length; i += 500) {
        const batch = writeBatch(db)
        for (const a of alumnesNous.slice(i, i + 500)) {
          const { id, ...dades } = a
          batch.set(doc(db, 'alumnes', id), dades)
        }
        await batch.commit()
      }

      setConfirmaRestaura((prev) => ({ ...prev, [versio.id]: '' }))
      setMissatge({ type: 'ok', text: `Llista d'alumnes restaurada a la versió "${versio.nom}" (${alumnesNous.length} alumnes).` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut restaurar: ${err.message}` })
    } finally {
      setRestaurant(null)
    }
  }

  const versioTriada = versions.find((v) => v.id === versioTriadaId) ?? null
  const dataVersioTriada = versioTriada?.creatEl?.toDate?.() ?? null

  const diesDesDelBackup = ultimBackup
    ? Math.floor((Date.now() - ultimBackup.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const avisAntic = diesDesDelBackup !== null && diesDesDelBackup > DIES_AVIS

  return (
    <div className="module">
      <p className="module-eyebrow">Còpia de seguretat</p>
      <h2>Backup</h2>
      <p className="module-lead">
        Descarrega totes les dades del centre organitzades per temàtica (alumnes,
        assistència, absentisme ja calculat, avaluació, calendari...) dins d'un únic .zip,
        com a còpia de seguretat fora de Firestore. Recomanem fer-ho com a mínim un cop per
        trimestre.
      </p>

      {!carregant && (
        <p className="module-note" style={{ marginTop: 16, fontStyle: 'normal' }}>
          {ultimBackup ? (
            <>
              Última còpia feta el <strong>{ultimBackup.toLocaleDateString('ca-ES')}</strong>
              {avisAntic && (
                <span style={{ color: 'var(--red)' }}> — fa {diesDesDelBackup} dies, ja toca fer-ne una altra.</span>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--amber-dark)' }}>Encara no s'ha fet cap còpia de seguretat.</span>
          )}
        </p>
      )}

      <label className="field" style={{ marginTop: 20, maxWidth: 360 }}>
        <span>Nom d'aquesta còpia (opcional)</span>
        <input
          type="text"
          value={nomVersio}
          onChange={(e) => setNomVersio(e.target.value)}
          placeholder="Per exemple: Abans d'importar el nou Excel"
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
        />
      </label>

      <button className="btn-primary" style={{ marginTop: 12, maxWidth: 280 }} onClick={fesBackup} disabled={exportant}>
        {exportant ? 'Generant còpia…' : '⬇ Descarrega còpia de seguretat (.zip)'}
      </button>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
        <strong>Versions desades ({versions.length})</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Cada vegada que fas una còpia de seguretat, també es desa aquí dins amb el nom que
          li hagis posat. Pots <strong>restaurar la llista d'alumnes</strong> a qualsevol
          d'aquestes versions (per exemple, si una pujada d'Excel va anar malament). L'historial
          d'assistència i avaluació no es toca mai — només queda descarregat al .zip de cada
          còpia, per si mai cal recuperar-lo manualment.
        </p>

        {carregantVersions ? (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>Carregant versions…</p>
        ) : versions.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>Encara no hi ha cap versió desada.</p>
        ) : (
          <>
            <label className="field" style={{ marginTop: 12, maxWidth: 420 }}>
              <span>Tria una versió de l&apos;historial ({versions.length}{versions.length === 30 ? ', les 30 més recents' : ''})</span>
              <select
                value={versioTriadaId}
                onChange={(e) => { setVersioTriadaId(e.target.value); setConfirmaRestaura((prev) => ({ ...prev, [e.target.value]: prev[e.target.value] ?? '' })) }}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                {versions.map((v) => {
                  const data = v.creatEl?.toDate?.()
                  return (
                    <option key={v.id} value={v.id}>
                      {v.nom} — {data ? data.toLocaleDateString('ca-ES') : '—'}
                    </option>
                  )
                })}
              </select>
            </label>

            {versioTriada && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  {dataVersioTriada ? dataVersioTriada.toLocaleString('ca-ES') : '—'} · {versioTriada.creatPer ?? 'desconegut'} ·{' '}
                  {versioTriada.comptadors?.alumnes ?? 0} alumnes, {versioTriada.comptadors?.assistencia ?? 0} marques d&apos;assistència,{' '}
                  {versioTriada.comptadors?.avaluacio ?? 0} notes
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={confirmaRestaura[versioTriada.id] ?? ''}
                    onChange={(e) => setConfirmaRestaura((prev) => ({ ...prev, [versioTriada.id]: e.target.value }))}
                    placeholder="Escriu RESTAURA per confirmar"
                    style={{ border: '1px solid var(--red)', borderRadius: 6, padding: '6px 8px', fontSize: 12, maxWidth: 200 }}
                  />
                  <button
                    type="button"
                    onClick={() => restauraAlumnes(versioTriada)}
                    disabled={(confirmaRestaura[versioTriada.id] ?? '') !== 'RESTAURA' || restaurant === versioTriada.id}
                    style={{
                      background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6,
                      padding: '6px 12px', fontSize: 12, fontWeight: 600,
                      cursor: (confirmaRestaura[versioTriada.id] ?? '') === 'RESTAURA' ? 'pointer' : 'not-allowed',
                      opacity: (confirmaRestaura[versioTriada.id] ?? '') === 'RESTAURA' ? 1 : 0.5,
                    }}
                  >
                    {restaurant === versioTriada.id ? 'Restaurant…' : "Restaura la llista d'alumnes a aquesta versió"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
        <strong>Còpia de l'històric de proves (TEE, VL/CL)</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Aquesta col·lecció és l'única de tota l'app amb la lectura tancada a
          Firestore (només hi arriba <code>ce@escolamestregibert.cat</code>), així que
          no surt al .zip general. A diferència de la còpia de dalt, aquestes dades
          del passat no canvien mai, així que <strong>no cal repetir aquesta
          descàrrega sovint</strong>: n'hi ha prou fent-la un cop i guardant-la en un
          lloc segur. Si mai s'esborrés per error, es recupera pujant aquest mateix
          fitxer des d'<strong>Avaluació → Històric → "📤 Importa l'històric"</strong>.
        </p>
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={exportaHistoric} disabled={exportantHistoric}>
          {exportantHistoric ? 'Exportant…' : '⬇ Descarrega historic-proves.json'}
        </button>
      </div>

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
        <strong>Com queda organitzat el fitxer:</strong>
        <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>
{`alumnes/1r-a.csv, alumnes/1r-b.csv, ...
assistencia/1r-a.csv, assistencia/1r-b.csv, ...
absentisme/2026-27/1r-trimestre/1r-a.csv, ...
calendari/2026-27.json, ...
avaluacio/... (quan hi hagi dades)
documentacio.csv (quan hi hagi dades)`}
        </pre>
      </div>

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
        <strong>Important sobre el fitxer descarregat:</strong> conté dades personals
        d'alumnes. Guarda'l en un lloc segur i restringit (per exemple una carpeta de Drive
        privada del centre), mai en un lloc compartit obertament, i esborra'l del dispositiu
        si l'has descarregat en un ordinador que no és exclusivament teu.
      </div>

      <p className="module-note" style={{ marginTop: 20 }}>
        Aquesta còpia és manual: cal clicar el botó cada vegada. Amb el pla gratuït de
        Firebase que fem servir no és possible programar-la perquè es faci sola de manera
        totalment automàtica — si algun dia interessa fer-ho, caldria passar a un pla de
        pagament de Firebase (Blaze), que igualment surt gratuït fins a un volum d'ús molt
        superior al que tindrà el centre.
      </p>

      {/* ── Recuperar una còpia ─────────────────────────────────────── */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <p className="module-eyebrow" style={{ marginTop: 0 }}>Recuperació</p>
        <h3 style={{ marginTop: 4, fontSize: 18 }}>Carrega una còpia de seguretat</h3>
        <p className="module-lead">
          Obre un .zip d'aquests mateixos i torna a entrar-ne les dades. Primer et dirà què hi ha
          a dins i podràs triar què vols recuperar; no es toca res fins que ho confirmis.
        </p>

        <label
          className="btn-ghost"
          style={{ display: 'inline-block', marginTop: 8, border: '1px solid', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
        >
          📂 Tria el fitxer .zip
          <input
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={(e) => { llegeixBackup(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>

        {backupLlegit && (
          <div className="caixa" style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>{backupLlegit.nom}</strong>
            <p className="nota">Tria què vols recuperar:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {backupLlegit.contingut.map((c) => (
                <li key={c.id} style={{ padding: '4px 0' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={triades.has(c.id)}
                      onChange={(e) => setTriades((prev) => {
                        const nou = new Set(prev)
                        if (e.target.checked) nou.add(c.id)
                        else nou.delete(c.id)
                        return nou
                      })}
                    />
                    <span>
                      {c.nom} — <strong>{c.documents}</strong> registres
                      {!c.sobreescriu && (
                        <span className="nota" style={{ display: 'block', marginTop: 0 }}>
                          Només s'hi afegirà el que falti: l'historial que ja hi ha no es toca.
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <p className="nota nota-avis" style={{ marginTop: 10 }}>
              Les col·leccions sense l'avís de sobre <strong>se substituiran</strong> pel que hi
              hagi al .zip. Si tens dubtes, fes una còpia nova abans de recuperar aquesta.
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={confirmaRestaura2}
                onChange={(e) => setConfirmaRestaura2(e.target.value)}
                placeholder="RECUPERA"
                style={{ border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px', maxWidth: 160 }}
              />
              <button
                type="button"
                onClick={apliquaRestauracio}
                disabled={confirmaRestaura2 !== 'RECUPERA' || triades.size === 0 || restaurantZip !== null}
                className="btn-perill"
              >
                {restaurantZip ? `Recuperant… ${restaurantZip}` : 'Recupera les dades triades'}
              </button>
            </div>
          </div>
        )}

        {resultatRestaura && (
          <div className="caixa" style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>Recuperació acabada</strong>
            <ul style={{ fontSize: 13, marginTop: 8, paddingLeft: 18 }}>
              {Object.entries(resultatRestaura.escrits).map(([col, n]) => (
                <li key={col}>
                  {col}: {n} registres recuperats
                  {resultatRestaura.omesos[col] > 0 && (
                    <span className="nota" style={{ display: 'inline', marginLeft: 6 }}>
                      ({resultatRestaura.omesos[col]} ja hi eren i no s'han tocat)
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {resultatRestaura.errors.length > 0 && (
              <ul style={{ fontSize: 13, color: 'var(--red)', marginTop: 8, paddingLeft: 18 }}>
                {resultatRestaura.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function agrupaPer(llista, claver) {
  const grups = {}
  for (const item of llista) {
    const clau = claver(item)
    if (!grups[clau]) grups[clau] = []
    grups[clau].push(item)
  }
  return grups
}

// És exactament el mateix que slug(): noms de fitxer sense accents.
const netejaNom = slug

function substituteixTimestamps(key, value) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return value
}
