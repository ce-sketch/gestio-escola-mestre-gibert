import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, serverTimestamp, orderBy, query, limit } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { aCsv, formataData } from '../../lib/csv'
import { comptaDiesLectius } from '../../lib/calendar'
import { calculaIndexos } from '../../lib/absentisme'
import { cursEscolarActual } from '../../lib/cursEscolar'

const DIES_AVIS = 30

export default function Backup() {
  const [exportant, setExportant] = useState(false)
  const [ultimBackup, setUltimBackup] = useState(null)
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [nomVersio, setNomVersio] = useState('')
  const [versions, setVersions] = useState([])
  const [carregantVersions, setCarregantVersions] = useState(true)
  const [confirmaRestaura, setConfirmaRestaura] = useState({}) // { [versioId]: text escrit }
  const [restaurant, setRestaurant] = useState(null)

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
      setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      // Si encara no hi ha cap versió (o falta l'índex), no cal amoïnar l'usuari.
      setVersions([])
    } finally {
      setCarregantVersions(false)
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
        '  documentacio.csv                               documentació (si n\'hi ha)\n'
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
          <ul className="roster" style={{ marginTop: 12 }}>
            {versions.map((v) => {
              const data = v.creatEl?.toDate?.()
              const confirmText = confirmaRestaura[v.id] ?? ''
              return (
                <li key={v.id} className="roster-row" style={{ display: 'block', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{v.nom}</strong>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {data ? data.toLocaleString('ca-ES') : '—'} · {v.creatPer ?? 'desconegut'} ·{' '}
                        {v.comptadors?.alumnes ?? 0} alumnes, {v.comptadors?.assistencia ?? 0} marques d'assistència,{' '}
                        {v.comptadors?.avaluacio ?? 0} notes
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmaRestaura((prev) => ({ ...prev, [v.id]: e.target.value }))}
                      placeholder="Escriu RESTAURA per confirmar"
                      style={{ border: '1px solid var(--red)', borderRadius: 6, padding: '6px 8px', fontSize: 12, maxWidth: 200 }}
                    />
                    <button
                      type="button"
                      onClick={() => restauraAlumnes(v)}
                      disabled={confirmText !== 'RESTAURA' || restaurant === v.id}
                      style={{
                        background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        cursor: confirmText === 'RESTAURA' ? 'pointer' : 'not-allowed',
                        opacity: confirmText === 'RESTAURA' ? 1 : 0.5,
                      }}
                    >
                      {restaurant === v.id ? 'Restaurant…' : 'Restaura la llista d\'alumnes a aquesta versió'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
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

function netejaNom(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function substituteixTimestamps(key, value) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return value
}
