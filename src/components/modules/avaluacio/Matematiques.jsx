import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { llegeixConmat, casaAmbAlumnes, distribucio, NIVELLS_CONMAT, clauOrdenadaDeNom, paraulesDeNom } from '../../../lib/conmatParser'
import { llegeixCosmos, resumClasse } from '../../../lib/cosmosParser'
import BotoDrive from '../../BotoDrive'
import { momentId, momentLabel, entradesHistoric } from '../../../lib/historicInnovamat'
import { clauDeText } from '../../../lib/text'

/**
 * Avaluació referencial de matemàtiques.
 *
 * Les dades no s'entren a mà: es pugen els informes que envia l'Innovamat.
 *   · ConMat  → PDF, un informe per classe amb el nivell de cada alumne
 *   · COSMOS  → CSV, amb la prova inicial i la final i el detall per dimensió
 *
 * El que se'n desa és el resultat per alumne, que després pot alimentar
 * l'informe individual i el quadre de comandament.
 */
/**
 * Càrrega d'informes d'Innovamat (ConMat i COSMOS).
 *
 * Es fa servir a dos llocs amb comportament lleugerament diferent:
 *   · A "Entrada de dades → Matemàtiques", sense props: sempre el curs
 *     en marxa, amb la taula del que ja hi ha desat.
 *   · A "Històric → Innovamat", amb `cursEscolarFixat`: el curs el mana
 *     la pestanya de l'històric, per poder recuperar cursos passats.
 */
export default function Matematiques({ cursEscolarFixat = null, nomesCarrega = false, onDesat = null }) {
  const [cursEscolarPropi, setCursEscolarPropi] = useState(cursEscolarActual())
  const cursEscolarId = cursEscolarFixat ?? cursEscolarPropi
  const setCursEscolarId = setCursEscolarPropi
  const [alumnes, setAlumnes] = useState([])
  const [llegint, setLlegint] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [conmat, setConmat] = useState(null)
  const [conmats, setConmats] = useState([]) // tots els informes llegits de cop   // { classe, moment, casats, sensCasar, avisos }
  const [cosmos, setCosmos] = useState(null)   // { alumnes, dimensions, avisos }
  const [desats, setDesats] = useState([])

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    try {
      const [snapAlumnes, snapDesats] = await Promise.all([
        getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
        getDocs(query(collection(db, 'matematiques'), where('cursEscolar', '==', cursEscolarId))),
      ])
      setAlumnes(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
      setDesats(snapDesats.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    }
  }

  // ── ConMat (PDF) ────────────────────────────────────────────────────
  /**
   * Llegeix un o diversos informes de ConMat. Es poden pujar de cop tots
   * els d'una mateixa avaluació (inici o final), que és com arriben de
   * l'Innovamat: un PDF per classe. Cada informe es llegeix per separat i
   * es desa amb la seva classe, però es revisen tots junts abans de desar.
   */
  async function pujaConmat(e) {
    const fitxers = [...(e.target.files ?? [])]
    if (fitxers.length === 0) return
    setLlegint(true)
    setMissatge(null)
    setConmat(null)
    const llegits = []
    const errors = []
    for (const fitxer of fitxers) {
      try {
        const resultat = await llegeixConmat(await fitxer.arrayBuffer(), fitxer.name)
        const { casats, sensCasar, dubtosos } = casaAmbAlumnes(resultat.alumnes, alumnes)
        llegits.push({ ...resultat, casats, sensCasar, dubtosos, fitxer: fitxer.name })
      } catch (err) {
        errors.push(`${fitxer.name}: ${err.message}`)
      }
    }
    if (errors.length > 0) {
      setMissatge({ type: 'error', text: `No s'han pogut llegir ${errors.length} informes — ${errors.join(' · ')}` })
    }
    setConmats(llegits)
    setConmat(llegits[0] ?? null)
    setLlegint(false)
  }

  // ── COSMOS (CSV) ────────────────────────────────────────────────────
  async function pujaCosmos(e) {
    const fitxer = e.target.files?.[0]
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setCosmos(null)
    try {
      const resultat = llegeixCosmos(await fitxer.text())
      // El CSV del COSMOS porta el nom a `nomComplet`; el casament el
      // busca a `nom`, així que cal donar-l'hi perquè pugui aplicar també
      // la tolerància de noms incomplets.
      const { casats, sensCasar, dubtosos } = casaAmbAlumnes(
        resultat.alumnes.map((a) => ({ ...a, nom: a.nomComplet, clau: clauDe(a.nomComplet) })),
        alumnes
      )
      setCosmos({ ...resultat, casats, sensCasar, dubtosos, fitxer: fitxer.name })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setLlegint(false)
    }
  }

  const clauDe = clauDeText

  /** Quantes paraules comparteixen dos noms — per suggerir, a cada
   *  alumne sense casar, quins del centre s'hi assemblen més. */
  function semblanca(nomA, nomB) {
    const a = new Set(paraulesDeNom(nomA))
    const b = paraulesDeNom(nomB)
    return b.filter((p) => a.has(p)).length
  }

  /** Assigna a mà un alumne del PDF a una fitxa del centre, quan el
   *  casament automàtic no ho ha pogut resoldre (noms escrits diferent,
   *  errades a l'informe...). */
  function assignaManualment(indexSensCasar, alumneId) {
    if (!alumneId) return
    const alumne = alumnes.find((x) => x.id === alumneId)
    if (!alumne) return
    setConmat((prev) => {
      const delPdf = prev.sensCasar[indexSensCasar]
      const nou = {
        ...prev,
        casats: [...prev.casats, { ...delPdf, alumneId: alumne.id, nom: alumne.nom, assignatAMa: true }],
        sensCasar: prev.sensCasar.filter((_, i) => i !== indexSensCasar),
      }
      setConmats((llista) => llista.map((c) => (c.fitxer === prev.fitxer ? nou : c)))
      return nou
    })
  }

  /**
   * Desa moltes escriptures de cop, en lots.
   *
   * Abans es feia un `setDoc` per alumne dins d'un bucle: amb 8 informes
   * de 25 alumnes això són 200 crides seguides, lentes i que consumeixen
   * quota. Un lot en fa fins a 500 en una sola crida i, a més, és atòmic:
   * o s'escriuen totes o cap, així no queden càrregues a mitges.
   */
  async function escriuEnLots(operacions) {
    // Un lot no pot escriure dues vegades al mateix document: si el mateix
    // identificador surt més d'un cop (dos informes de la mateixa classe,
    // o un alumne sense casar que apareix a inici i a final), es fusionen
    // en una sola operació. Sense això, desar diversos informes alhora
    // peta amb un error de Firestore.
    const perId = new Map()
    for (const op of operacions) {
      const previ = perId.get(op.id)
      perId.set(op.id, previ
        ? { id: op.id, dades: { ...previ.dades, ...op.dades, conmat: { ...previ.dades.conmat, ...op.dades.conmat } } }
        : op)
    }
    const unics = [...perId.values()]

    const MAX = 450 // el límit real és 500; es deixa marge
    for (let i = 0; i < unics.length; i += MAX) {
      const lot = writeBatch(db)
      for (const op of unics.slice(i, i + MAX)) {
        lot.set(doc(db, 'matematiques', op.id), op.dades, { merge: true })
      }
      await lot.commit()
    }
  }

  async function desaConmat() {
    const informes = conmats.length > 0 ? conmats : (conmat ? [conmat] : [])
    if (informes.length === 0) return
    setDesant(true)
    try {
      let totalDesats = 0
      const ops = []
      for (const conmat of informes) {
        // El resultat es desa DINS del moment de la prova ("inici"/"final"),
        // no directament a `conmat`. Així, pujar l'informe de final de curs
        // ja no esborra el d'inici del mateix alumne, i queda històric.
        const idMoment = momentId(conmat.moment)
        const resultat = (a) => ({
          classe: conmat.classe,
          moment: conmat.moment,
          nivell: a.nivell,
          percentatge: a.percentatge,
          respostes: a.respostes,
          preguntes: a.preguntes,
        })

        for (const a of conmat.casats) {
          ops.push({
            id: `${cursEscolarId}__${a.alumneId}`,
            dades: {
              cursEscolar: cursEscolarId,
              alumneId: a.alumneId,
              nom: a.nom,
              conmat: { [idMoment]: resultat(a) },
              actualitzatEl: serverTimestamp(),
              actualitzatPer: auth.currentUser?.email ?? null,
            },
          })
        }

        // Els alumnes que NO casen amb cap alumne actiu del centre
        // (típicament els de cursos passats que ja han marxat) també es
        // desen: si no, cada any que passa l'històric perdria una part de
        // l'alumnat. Es guarden amb el nom tal com surt al PDF i un
        // identificador derivat d'aquest nom, de manera que tornar a pujar
        // el mateix informe els actualitza en comptes de duplicar-los.
        for (const a of (conmat.sensCasar ?? [])) {
          const nomInforme = a.nomPdf ?? a.nom
          const clau = clauOrdenadaDeNom(nomInforme) || clauDe(nomInforme)
          // Sense nom no es pot construir un identificador estable, i
          // Firestore rebutjaria el lot sencer. Val més saltar-se aquest
          // resultat que perdre tota la càrrega.
          if (!clau) continue
          ops.push({
            id: `${cursEscolarId}__pdf__${clau}`,
            dades: {
              cursEscolar: cursEscolarId,
              alumneId: null,
              nom: nomInforme,
              sensCasar: true,
              conmat: { [idMoment]: resultat(a) },
              actualitzatEl: serverTimestamp(),
              actualitzatPer: auth.currentUser?.email ?? null,
            },
          })
        }

        // Registre de l'informe carregat, per poder consultar després què
        // s'ha pujat, quan i qui ho va fer. Va a la mateixa col·lecció amb
        // un `tipus` que el distingeix dels registres d'alumne.
        ops.push({
          id: `informe__${cursEscolarId}__${conmat.classe}__${idMoment}`,
          dades: {
            tipus: 'informe',
            cursEscolar: cursEscolarId,
            classe: conmat.classe,
            moment: idMoment,
            momentText: conmat.moment ?? null,
            alumnesCasats: conmat.casats.length,
            alumnesSenseCasar: conmat.sensCasar?.length ?? 0,
            actualitzatEl: serverTimestamp(),
            actualitzatPer: auth.currentUser?.email ?? null,
          },
        })

        totalDesats += conmat.casats.length + (conmat.sensCasar?.length ?? 0)
      }

      await escriuEnLots(ops)
      setMissatge({
        type: 'ok',
        text: `${totalDesats} resultats de ConMat desats de ${informes.length} informe${informes.length === 1 ? '' : 's'}.`,
      })
      setConmats([])
      setConmat(null)
      carrega()
      onDesat?.()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  async function desaCosmos() {
    if (!cosmos || (!cosmos.casats.length && !cosmos.sensCasar?.length)) return
    setDesant(true)
    try {
      const dadesCosmos = (a) => ({
        intervencio: a.intervencio ?? null,
        sessionsSetmanals: a.sessionsSetmanals ?? null,
        moments: a.moments,
      })
      const ops = cosmos.casats.map((a) => ({
        id: `${cursEscolarId}__${a.alumneId}`,
        dades: {
          cursEscolar: cursEscolarId,
          alumneId: a.alumneId,
          nom: a.nom,
          cosmos: dadesCosmos(a),
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        },
      }))
      // Igual que al ConMat: els que no consten com a alumnes actius del
      // centre també es desen, amb el nom tal com surt al CSV.
      for (const a of (cosmos.sensCasar ?? [])) {
        const clau = clauOrdenadaDeNom(a.nom ?? a.nomComplet) || clauDe(a.nomComplet)
        ops.push({
          id: `${cursEscolarId}__pdf__${clau}`,
          dades: {
            cursEscolar: cursEscolarId,
            alumneId: null,
            nom: a.nom ?? a.nomComplet,
            sensCasar: true,
            cosmos: dadesCosmos(a),
            actualitzatEl: serverTimestamp(),
            actualitzatPer: auth.currentUser?.email ?? null,
          },
        })
      }
      await escriuEnLots(ops)
      const nSenseCosmos = cosmos.sensCasar?.length ?? 0
      setMissatge({
        type: 'ok',
        text: `${cosmos.casats.length + nSenseCosmos} resultats de COSMOS desats`
          + (nSenseCosmos > 0 ? `, dels quals ${nSenseCosmos} amb el nom del CSV perquè no consten com a alumnes actius.` : '.'),
      })
      setCosmos(null)
      carrega()
      onDesat?.()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  const repartiment = useMemo(
    () => (conmat ? distribucio(conmat.alumnes) : null),
    [conmat]
  )
  const resumCosmos = useMemo(
    () => (cosmos ? resumClasse(cosmos.alumnes) : null),
    [cosmos]
  )

  return (
    <div>
      <p className="module-lead">
        Els resultats de matemàtiques no s'entren a mà: es pugen els informes que envia
        l'Innovamat. El <strong>ConMat</strong> es llegeix en PDF (el CSV encara no) i en surt el
        nivell de cada alumne; el <strong>COSMOS</strong> es llegeix en CSV (el PDF encara no) i en
        surt el detall de la prova inicial i la final.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {!cursEscolarFixat && (
          <label className="field" style={{ maxWidth: 140 }}>
            <span>Curs escolar</span>
            <input
              type="text"
              value={cursEscolarId}
              onChange={(e) => setCursEscolarId(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
            />
          </label>
        )}
        {(llegint || desant) && (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {llegint ? 'Llegint el fitxer…' : 'Desant…'}
          </span>
        )}
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      {/* ── ConMat ───────────────────────────────────────────────────── */}
      <div className="caixa" style={{ marginTop: 20 }}>
        <strong style={{ fontSize: 14 }}>ConMat</strong>
        <p className="nota" style={{ maxWidth: '100%' }}>
          L'informe en PDF, un per classe i moment. Pots pujar de cop tots els d'una mateixa avaluació. Se n'obté el <strong>nivell global</strong> de
          cada alumne i les preguntes respostes. Els resultats per bloc (Numeració, Espai i
          forma…) hi són com a gràfics i no es poden llegir.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <BotoDrive
            onFitxer={pujaConmat}
            tipus="pdf"
            etiqueta="Tria els informes del Drive"
            multiple
            onError={(t) => setMissatge({ type: 'error', text: t })}
            disabled={llegint}
          />
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📤 Puja el PDF del ConMat
            <input type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={(e) => { pujaConmat(e); e.target.value = '' }} />
          </label>
          {/* El lector del CSV encara no hi és: cal una mostra real del fitxer
              per saber quines columnes porta, com el del COSMOS. El botó ja
              hi és preparat perquè només calgui connectar-lo. */}
          <label className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}
            title="Encara no llegim el ConMat en CSV: falta una mostra del fitxer per fer el lector.">
            📤 Puja el CSV del ConMat <span style={{ fontSize: 10, marginLeft: 6 }}>(pròximament)</span>
          </label>
        </div>

        {conmat && (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>
              Curs {cursEscolarId} · {conmat.classe ?? 'classe desconeguda'} — {conmat.moment ?? 'moment desconegut'}
              {' '}· {conmat.alumnes.length} alumnes
            </strong>

            {conmat.avisos.map((a, i) => (
              <p key={i} className="nota nota-avis">{a}</p>
            ))}

            <div className="taula-scroll" style={{ marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {NIVELLS_CONMAT.map((n) => (
                      <th key={n.id} style={{ padding: '4px 12px', background: 'var(--sand)' }}>{n.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {NIVELLS_CONMAT.map((n) => (
                      <td key={n.id} style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <strong>{repartiment.recompte[n.id]}</strong>
                        <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                          {' '}({repartiment.percentatges[n.id]}%)
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {conmats.length > 1 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                {conmats.map((c) => (
                  <button
                    key={c.fitxer}
                    type="button"
                    onClick={() => setConmat(c)}
                    style={{
                      border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 12,
                      cursor: 'pointer',
                      background: c.fitxer === conmat.fitxer ? 'var(--ink)' : 'transparent',
                      color: c.fitxer === conmat.fitxer ? '#fff' : 'var(--ink)',
                    }}
                  >
                    {c.classe ?? c.fitxer}
                  </button>
                ))}
              </div>
            )}

            {(conmat.comparativa?.length ?? 0) > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--ink-soft)' }}>
                  Comparativa amb la mitjana d'Innovamat, pregunta per pregunta ({conmat.comparativa.length})
                </summary>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                      <th style={{ padding: '3px 10px 3px 0' }}>Contingut</th>
                      <th style={{ padding: '3px 10px', textAlign: 'right' }}>Classe</th>
                      <th style={{ padding: '3px 10px', textAlign: 'right' }}>Innovamat</th>
                      <th style={{ padding: '3px 10px', textAlign: 'right' }}>Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conmat.comparativa.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '3px 10px 3px 0' }}>{c.contingut}</td>
                        <td style={{ padding: '3px 10px', textAlign: 'right' }}>{c.classe}%</td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: 'var(--ink-soft)' }}>{c.global}%</td>
                        <td style={{
                          padding: '3px 10px', textAlign: 'right', fontWeight: 600,
                          color: c.diferencia >= 0 ? 'var(--green, #2d6a4f)' : 'var(--red, #b03030)',
                        }}>
                          {c.diferencia > 0 ? '+' : ''}{c.diferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            {conmat.casats.some((a) => a.casatPerAproximacio) && (
              <div className="caixa-discreta" style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 12 }}>
                  {conmat.casats.filter((a) => a.casatPerAproximacio).length} alumnes casats pel nom incomplet — revisa'ls
                </strong>
                <p className="nota">
                  El PDF no en portava el nom sencer (per exemple, només un cognom). S'han
                  relacionat amb l'única fitxa possible del centre.
                </p>
                <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 4 }}>
                  {conmat.casats.filter((a) => a.casatPerAproximacio).map((a, i) => (
                    <li key={i}>«{a.nomPdf}» → {a.nom}</li>
                  ))}
                </ul>
              </div>
            )}

            {(conmat.dubtosos?.length ?? 0) > 0 && (
              <div className="caixa-discreta" style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 12, color: 'var(--red, #b03030)' }}>
                  {conmat.dubtosos.length} noms encaixen amb més d'un alumne
                </strong>
                <p className="nota">
                  No s'han casat a posta: assignar-los a l'atzar podria donar la nota a qui no toca.
                  Es desaran amb el nom del PDF.
                </p>
                <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 4 }}>
                  {conmat.dubtosos.map((d, i) => (
                    <li key={i}>«{d.nom}» podria ser: {d.candidats.join(' o ')}</li>
                  ))}
                </ul>
              </div>
            )}

            {conmat.sensCasar.length > 0 && (() => {
              // Si NO ha casat ningú de tot l'informe, no és que els noms
              // estiguin escrits diferent: és una promoció que ja ha
              // marxat (típicament el 6è d'un curs anterior). En aquest
              // cas la llista de desplegables no serveix de res, i val
              // més dir-ho clar i deixar-la plegada.
              const capCasat = conmat.casats.length === 0
              return (
              <div className="caixa-discreta" style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 12 }}>
                  {capCasat
                    ? `Cap dels ${conmat.sensCasar.length} alumnes d'aquest informe consta al centre`
                    : `${conmat.sensCasar.length} alumnes de l'informe no s'han pogut relacionar amb cap fitxa`}
                </strong>
                <p className="nota">
                  {capCasat
                    ? "Sembla una promoció que ja ha deixat l'escola (per exemple, el 6è d'un curs anterior). Els resultats es desaran igualment a l'històric amb el nom de l'informe, i comptaran als percentatges del centre."
                    : "Poden ser alumnes que ja no són al centre, o bé que a l'informe tinguin el nom escrit diferent del de la seva fitxa. Si reconeixes algú, assigna'l amb el desplegable; si no, es desarà igualment amb el nom del PDF."}
                </p>
                {capCasat && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--ink-soft)' }}>
                      Veure'ls igualment i assignar-ne algun
                    </summary>
                    <p className="nota">Només cal si algun d'aquests alumnes encara és al centre.</p>
                  </details>
                )}
                <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 4, display: capCasat ? 'none' : undefined }}>
                  {conmat.sensCasar.map((a, i) => {
                    // Els del centre que més s'assemblen, per si el nom
                    // està escrit diferent a l'informe i no ha casat sol.
                    const suggerits = alumnes
                      .map((al) => ({ al, punts: semblanca(a.nomPdf ?? a.nom, al.nom) }))
                      .sort((x, y) => y.punts - x.punts || x.al.nom.localeCompare(y.al.nom))
                    return (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {a.nomPdf ?? a.nom} — {a.nivell}
                        <select
                          defaultValue=""
                          onChange={(e) => assignaManualment(i, e.target.value)}
                          style={{ marginLeft: 8, border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px', fontSize: 11, maxWidth: 260 }}
                        >
                          <option value="">— assigna'l a un alumne —</option>
                          {suggerits.map(({ al, punts }) => (
                            <option key={al.id} value={al.id}>
                              {al.nom}{punts > 0 ? ` (${punts} coincidències)` : ''}
                            </option>
                          ))}
                        </select>
                      </li>
                    )
                  })}
                </ul>
              </div>
              )
            })()}

            {/* El botó desa TOTS els informes llegits, no només el que
                s'està mirant: per això mira el total, i no si l'informe
                visible té alumnes casats. Abans, obrir una classe on no
                n'hi hagués cap el deixava bloquejat sense explicació. */}
            {(() => {
              const totsElsInformes = conmats.length > 0 ? conmats : [conmat]
              const total = totsElsInformes.reduce((t, c) => t + c.casats.length + (c.sensCasar?.length ?? 0), 0)
              return (
                <>
                  <button
                    type="button"
                    onClick={desaConmat}
                    disabled={desant || total === 0}
                    className="btn-primary"
                    style={{ marginTop: 12, maxWidth: 280 }}
                  >
                    {desant
                      ? 'Desant…'
                      : `Desa els ${total} resultats${conmats.length > 1 ? ` de ${conmats.length} informes` : ''}`}
                  </button>
                  {/* El missatge també aquí: a dalt del mòdul queda fora de
                      pantalla i sembla que el botó no hagi respost. */}
                  {missatge && (
                    <p className={missatge.type === 'error' ? 'nota nota-error' : 'nota'} style={{ marginTop: 8 }}>
                      {missatge.text}
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── COSMOS ───────────────────────────────────────────────────── */}
      <div className="caixa" style={{ marginTop: 18 }}>
        <strong style={{ fontSize: 14 }}>COSMOS</strong>
        <p className="nota" style={{ maxWidth: '100%' }}>
          El CSV amb la prova inicial i la final. Se n'obté la puntuació d'habilitats numèriques,
          el rendiment i el percentil de cada dimensió.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <BotoDrive
            onFitxer={pujaCosmos}
            tipus="csv"
            etiqueta="Tria el CSV del Drive"
            onError={(t) => setMissatge({ type: 'error', text: t })}
            disabled={llegint}
          />
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📤 Puja el CSV del COSMOS
            <input type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => { pujaCosmos(e); e.target.value = '' }} />
          </label>
          {/* Igual que el ConMat en CSV: falta una mostra del PDF per saber
              si és una pàgina per alumne o un resum de classe. */}
          <label className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}
            title="Encara no llegim el COSMOS en PDF: falta una mostra del fitxer per fer el lector.">
            📤 Puja el PDF del COSMOS <span style={{ fontSize: 10, marginLeft: 6 }}>(pròximament)</span>
          </label>
        </div>

        {cosmos && (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>
              {cosmos.alumnes.length} alumnes · {cosmos.dimensions.length} dimensions
            </strong>
            {cosmos.avisos.map((a, i) => (
              <p key={i} className="nota nota-avis">{a}</p>
            ))}
            <p style={{ fontSize: 13, marginTop: 8 }}>
              {resumCosmos.ambTotesDues} alumnes tenen les dues proves, i{' '}
              <strong>{resumCosmos.milloren}</strong> milloren la puntuació
              {resumCosmos.guanyMitja !== null && <> (guany mitjà: {resumCosmos.guanyMitja} punts)</>}.
            </p>
            <p className="nota">
              Dimensions llegides: {cosmos.dimensions.map((d) => d.nom).join(' · ')}
            </p>

            {cosmos.sensCasar.length > 0 && (
              <p className="nota nota-avis">
                {cosmos.sensCasar.length} alumnes del CSV no consten com a alumnes actius del
                centre. Es desaran igualment, amb el nom tal com surt al CSV.
              </p>
            )}

            <button
              type="button"
              onClick={desaCosmos}
              disabled={desant || (cosmos.casats.length + (cosmos.sensCasar?.length ?? 0)) === 0}
              className="btn-primary"
              style={{ marginTop: 12, maxWidth: 280 }}
            >
              Desa els {cosmos.casats.length + (cosmos.sensCasar?.length ?? 0)} resultats
            </button>
          </div>
        )}
      </div>

      {/* ── Què hi ha desat ──────────────────────────────────────────── */}
      {!nomesCarrega && (
      <div style={{ marginTop: 22 }}>
        <strong style={{ fontSize: 14 }}>Resultats desats del curs {cursEscolarId}</strong>
        {desats.length === 0 ? (
          <p className="nota">Encara no hi ha cap resultat desat.</p>
        ) : (
          <div className="taula-scroll" style={{ marginTop: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>Alumne</th>
                  <th style={{ padding: '4px 12px' }}>ConMat</th>
                  <th style={{ padding: '4px 12px' }}>COSMOS inicial</th>
                  <th style={{ padding: '4px 12px' }}>COSMOS final</th>
                </tr>
              </thead>
              <tbody>
                {desats.filter((d) => d.tipus !== 'informe').map((d) => {
                  // El ConMat pot venir en format antic (pla) o nou (per
                  // moment): es mostra sempre el més recent que hi hagi.
                  const ultim = entradesHistoric([d])[0]
                  return (
                    <tr key={d.id}>
                      <td style={{ padding: '4px 12px 4px 0' }}>{d.nom}</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {ultim?.nivell ?? '—'}
                        {ultim && <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}> ({momentLabel(ultim.moment)})</span>}
                      </td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {d.cosmos?.moments?.inicial?.rendiment ?? '—'}
                      </td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {d.cosmos?.moments?.final?.rendiment ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
      )}
    </div>
  )
}
