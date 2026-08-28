import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { slug } from '../../../lib/slug'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, esClasseEI4o5, comptaNivells, fullResumEI,
  idConfigEI, esConfigEI, classesQueFanLaProva,
} from '../../../lib/lectoescripturaEI'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

/**
 * Resum de lectoescriptura de tota l'Educació Infantil: una fila per
 * classe amb quants alumnes han assolit cada nivell de l'escala
 * Teberosky.
 *
 * Reprodueix el full "RESUM EI" de l'Eina d'avaluació. La pestanya
 * d'entrada de dades ("Lectoescriptura EI") ja permet baixar-se la
 * graella d'UNA classe; el que faltava era la foto de l'etapa sencera,
 * que és el que es lliura a la memòria del centre.
 *
 * ⚠️ Compte amb el recompte: als fulls originals cada nivell és una
 * casella independent i un alumne pot tenir-ne diverses marcades a
 * mesura que avança. Per això les columnes NO sumen el nombre d'alumnes
 * i els percentatges no sumen 100 — cada columna és "quants alumnes han
 * assolit aquest nivell", no "quants s'hi han classificat".
 */
export default function ResumLectoescripturaEI() {
  const [alumnes, setAlumnes] = useState([])
  const [documents, setDocuments] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [exportant, setExportant] = useState(false)
  const [desantConfig, setDesantConfig] = useState(false)

  const cursEscolarId = cursEscolarActual()

  useEffect(() => {
    async function carrega() {
      setCarregant(true)
      setError(null)
      try {
        const [snapAlumnes, snapDades] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDocs(query(collection(db, 'lectoescripturaEI'), where('cursEscolar', '==', cursEscolarId))),
        ])
        setAlumnes(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
        setDocuments(snapDades.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError(err.message)
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId])

  const config = useMemo(() => documents.find(esConfigEI) ?? null, [documents])
  const totesLesClasses = useMemo(
    () => [...new Set(alumnes.map((a) => a.curs))].filter(esClasseEI4o5).sort(),
    [alumnes]
  )

  /** Marca o desmarca una classe. Es desa de seguida: és un clic i no
   *  té sentit demanar després un botó de desar. */
  async function canviaClasse(classe, laFa) {
    const excloses = new Set(config?.classesExcloses ?? [])
    if (laFa) excloses.delete(classe)
    else excloses.add(classe)
    setDesantConfig(true)
    try {
      await setDoc(doc(db, 'lectoescripturaEI', idConfigEI(cursEscolarId)), {
        tipus: 'config',
        cursEscolar: cursEscolarId,
        classesExcloses: [...excloses],
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
      setDocuments((a) => [
        ...a.filter((d) => !esConfigEI(d)),
        { id: idConfigEI(cursEscolarId), tipus: 'config', cursEscolar: cursEscolarId, classesExcloses: [...excloses] },
      ])
    } catch (err) {
      setError(`No s'ha pogut desar: ${err.message}`)
    } finally {
      setDesantConfig(false)
    }
  }

  const perClasse = useMemo(() => {
    const classes = classesQueFanLaProva(config, totesLesClasses)
    return classes.map((classe) => {
      const ids = alumnes.filter((a) => a.curs === classe).map((a) => a.id)
      const doc = documents.find((d) => d.id === `${cursEscolarId}__${slug(classe)}`)
      return {
        classe,
        total: ids.length,
        comptes: comptaNivells(ids, doc?.alumnes ?? {}),
        teDades: Boolean(doc),
      }
    })
  }, [alumnes, documents, cursEscolarId, config, totesLesClasses])

  const totalAlumnes = perClasse.reduce((t, c) => t + c.total, 0)
  const suma = (nivellId) => perClasse.reduce((t, c) => t + (c.comptes[nivellId] ?? 0), 0)
  const senseDades = perClasse.filter((c) => !c.teDades).map((c) => c.classe)

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const dades = {
        cursEscolarId,
        etiqueta: 'Avaluació',
        subtitol: 'Resum de lectoescriptura · Educació Infantil',
        fulls: [fullResumEI(perClasse)],
      }
      if (format === 'excel') exportaExcel(`resum-lectoescriptura-EI-${cursEscolarId}.xlsx`, dades)
      else exportaPDF('Resum de lectoescriptura — Educació Infantil', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com ha quedat la lectoescriptura d&apos;Educació Infantil (I4 i I5) del curs {cursEscolarId},
        classe per classe. Les marques s&apos;introdueixen a la pestanya &quot;Lectoescriptura
        EI&quot; d&apos;entrada de dades.
      </p>

      {/* Quines classes fan la prova aquest curs. Ara només la passa I5,
          però I4 la pot començar a fer: en comptes de deixar-ho escrit al
          codi, es tria aquí i es desa amb el curs. Una classe desmarcada
          no compta enlloc — ni al resum ni a la matriu del PGA— i per
          tant no surt en vermell com si hi faltessin dades. */}
      {totesLesClasses.length > 0 && (
        <div className="caixa-discreta" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 13 }}>Quines classes passen la prova aquest curs</strong>
          <p className="nota">
            Desmarca les que no la facin: no comptaran ni aquí ni al quadre de comandament.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
            {totesLesClasses.map((classe) => {
              const laFa = !(config?.classesExcloses ?? []).includes(classe)
              return (
                <label key={classe} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={laFa}
                    disabled={desantConfig}
                    onChange={(e) => canviaClasse(classe, e.target.checked)}
                  />
                  {classe}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {perClasse.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Descarrega el resum:</span>
          <button type="button" onClick={() => descarrega('excel')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            {exportant ? 'Generant…' : '⬇ Excel'}
          </button>
          <button type="button" onClick={() => descarrega('pdf')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            ⬇ PDF
          </button>
        </div>
      )}

      {error && <p className="nota nota-error">{error}</p>}
      {carregant && <p className="nota">Carregant…</p>}

      {!carregant && perClasse.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          {totesLesClasses.length === 0
            ? "No consta cap classe d'I4 o I5 amb alumnes actius aquest curs."
            : 'Cap de les classes d\'I4 o I5 no està marcada com a que passi la prova.'}
        </p>
      )}

      {!carregant && senseDades.length > 0 && (
        <p className="nota nota-avis" style={{ marginTop: 12 }}>
          Encara no s&apos;han introduït dades de {senseDades.join(', ')}. Aquestes classes surten
          a zero, però els seus alumnes sí que compten al total.
        </p>
      )}

      {!carregant && perClasse.length > 0 && (
        <>
          <div className="taula-scroll" style={{ marginTop: 16 }}>
            <table className="taula-dades" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Classe</th>
                  <th rowSpan={2} className="num">Alumnes</th>
                  {ETAPES_TEBEROSKY.map((e) => (
                    <th key={e.id} colSpan={e.nivells.length} style={{ textAlign: 'center' }}>{e.titol}</th>
                  ))}
                </tr>
                <tr>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <th key={n.id} className="num" style={{ fontWeight: 400, fontSize: 10 }} title={n.label}>
                      {n.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perClasse.map((c) => (
                  <tr key={c.classe}>
                    <td>{c.classe}</td>
                    <td className="num">{c.total}</td>
                    {NIVELLS_TEBEROSKY.map((n) => (
                      <td key={n.id} className="num">{c.comptes[n.id] || ''}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td className="num">{totalAlumnes}</td>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <td key={n.id} className="num">{suma(n.id) || ''}</td>
                  ))}
                </tr>
                <tr style={{ color: 'var(--ink-soft)' }}>
                  <td>% del centre</td>
                  <td></td>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <td key={n.id} className="num">
                      {totalAlumnes ? `${Math.round((suma(n.id) / totalAlumnes) * 1000) / 10}%` : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 10 }}>
            Cada columna diu quants alumnes han <strong>assolit</strong> aquell nivell, i un mateix
            alumne en pot tenir diversos de marcats. Per això les columnes no sumen el nombre
            d&apos;alumnes ni els percentatges sumen 100.
          </p>
        </>
      )}
    </div>
  )
}
