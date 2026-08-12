import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { slug } from '../../lib/slug'
import {
  CICLES, NOMS_SUGGERITS, NOMS_AFA, FESTES, valoracioBuida, objectiuBuit, actuacioBuida,
  mitjanaObjectiu, mitjanaValoracio,
} from '../../lib/valoracions'
import { CURS_AMB_PLANTILLA, PLANTILLES_26_27 } from '../../lib/valoracionsPlantilles26_27'
import {
  GRUPS, NIVELLS_GRAU, festaBuida, objectiuFestaBuit, activitatBuida,
  mitjanaObjectiuGrup, mitjanaGrup, mitjanaGeneralFesta,
} from '../../lib/festesDetall'
import { CURS_AMB_PLANTILLA as CURS_FESTES, FESTES_PLANTILLES_26_27, construeixFestaAmbPlantilla } from '../../lib/festesPlantilles26_27'
import { carregaConfigValoracions } from '../../lib/valoracionsConfig'
import { ESCALES, opcionsDe } from '../../lib/escales'
import { llegeixPlantillaValoracio } from '../../lib/valoracionsPlantillaParser'
import {
  CRITERIS_ACTIVITAT, activitatBuida as activitatSortidaBuida, mitjanaActivitat, grauSatisfaccioCicle,
  percentValorades, totalRepetirSi,
} from '../../lib/activitatsComplementariesDetall'
import { activitatsDelCicle } from '../../lib/activitatsComplementariesParser'
import * as XLSX from 'xlsx'

function inputPercent(valor, onChange, onBlur) {
  return (
    <input
      type="number" min={0} max={100}
      value={valor}
      onChange={onChange}
      onBlur={onBlur}
      style={{ width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
    />
  )
}

/** Selector del grau d'una actuació o objectiu. Cada element porta la seva
 *  pròpia escala, perquè els fulls del centre no en fan servir una de sola:
 *  les comissions tenen "En procés" al 50%, els cicles escriuen el
 *  percentatge directament, i n'hi ha de binàries i de recompte.
 *  `onCanvi` rep el valor numèric ja convertit. */
function SelectorEstat({ etiqueta, valor, escala, opcions: opcionsPropies, onCanvi, onCanviEscala }) {
  const element = { escala: escala ?? 'execucio50', opcions: opcionsPropies }
  const opcions = opcionsDe(element)
  const actual = opcions.find((o) => o.valor === Number(valor)) ?? null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 40 }}>{etiqueta}</span>
      {opcions.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onCanvi(o.valor)}
          style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${actual?.id === o.id ? 'var(--navy)' : 'var(--line)'}`,
            background: actual?.id === o.id ? 'var(--navy)' : 'transparent',
            color: actual?.id === o.id ? '#fff' : 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
      <input
        type="number" min={0} max={100}
        value={valor}
        onChange={(e) => onCanvi(e.target.value)}
        title="Percentatge exacte"
        style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
      />
      <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>%</span>
      {onCanviEscala && (
        <select
          value={escala ?? 'execucio50'}
          onChange={(e) => onCanviEscala(e.target.value)}
          title="Escala d'aquesta actuació, tal com surt al full original"
          style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 5px', fontSize: 10, maxWidth: 190 }}
        >
          {(escala === 'propia') && <option value="propia">Escala pròpia del full</option>}
          {ESCALES.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      )}
    </div>
  )
}

export default function Documentacio() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [tipus, setTipus] = useState('cicle') // 'cicle', 'comissio' o 'festa'
  const [nomsExistents, setNomsExistents] = useState([])
  const [nom, setNom] = useState('')
  const [valoracio, setValoracio] = useState(valoracioBuida())
  const [plantilla, setPlantilla] = useState(null)
  const [llegintPlantilla, setLlegintPlantilla] = useState(false)
  const [errorPlantilla, setErrorPlantilla] = useState(null)
  const [carregant, setCarregant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  const [festaId, setFestaId] = useState('')
  const [festa, setFesta] = useState(null)
  const [grupObert, setGrupObert] = useState(GRUPS[0])
  const [configActiva, setConfigActiva] = useState(null)

  const [cicleActivitats, setCicleActivitats] = useState('')
  const [activitats, setActivitats] = useState([])
  const [activitatOberta, setActivitatOberta] = useState(null)
  const [carregantActivitats, setCarregantActivitats] = useState(false)
  const [pujantActivitats, setPujantActivitats] = useState(false)

  useEffect(() => {
    carregaConfigValoracions(cursEscolarId).then(setConfigActiva).catch(() => setConfigActiva(null))
  }, [cursEscolarId])

  useEffect(() => {
    if (tipus === 'activitats' && cicleActivitats) carregaActivitats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipus, cicleActivitats, cursEscolarId])

  async function carregaActivitats() {
    setCarregantActivitats(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__activitats-${slug(cicleActivitats)}`
      const snap = await getDoc(doc(db, 'activitatsComplementariesDetall', id))
      setActivitats(snap.exists() ? (snap.data().activitats ?? []) : [])
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les activitats: ${err.message}` })
    } finally {
      setCarregantActivitats(false)
    }
  }

  async function desaActivitats(activitatsNoves) {
    try {
      const id = `${cursEscolarId}__activitats-${slug(cicleActivitats)}`
      await setDoc(doc(db, 'activitatsComplementariesDetall', id), {
        cicle: cicleActivitats,
        cursEscolar: cursEscolarId,
        activitats: activitatsNoves,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    }
  }

  function actualitzaActivitat(activitatId, canvis) {
    const noves = activitats.map((a) => a.id === activitatId ? { ...a, ...canvis } : a)
    setActivitats(noves)
    return noves
  }

  function actualitzaCriteriActivitat(activitatId, criteriId, valor) {
    const noves = activitats.map((a) => a.id !== activitatId ? a : { ...a, valoracions: { ...a.valoracions, [criteriId]: valor } })
    setActivitats(noves)
    return noves
  }

  /** Puja el document consolidat de sortides (el mateix que Economia) i
   *  n'extreu les activitats reals del cicle triat — sense esborrar cap
   *  valoració que ja s'hagués introduït per a una activitat que coincideixi
   *  de nom. */
  function pujaActivitatsCicle(e) {
    const file = e.target.files?.[0]
    if (!file || !cicleActivitats) return
    setPujantActivitats(true)
    setMissatge(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const trobades = activitatsDelCicle(workbook, XLSX, cicleActivitats)
        if (trobades.length === 0) {
          setMissatge({ type: 'error', text: `No he trobat cap activitat pel cicle "${cicleActivitats}" en aquest Excel.` })
          setPujantActivitats(false)
          return
        }
        const noves = trobades.map((t) => {
          const existent = activitats.find((a) => a.nom === t.nom)
          if (existent) return { ...existent, nivell: t.nivell, data: t.data, horari: t.horari, preu: t.preu }
          const nova = activitatSortidaBuida(t.nom)
          nova.nivell = t.nivell
          nova.data = t.data
          nova.horari = t.horari
          nova.preu = t.preu
          return nova
        })
        setActivitats(noves)
        await desaActivitats(noves)
        setMissatge({ type: 'ok', text: `${noves.length} activitats carregades per a ${cicleActivitats}.` })
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir l'Excel: ${err.message}` })
      } finally {
        setPujantActivitats(false)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setPujantActivitats(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  useEffect(() => {
    carregaNomsExistents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  useEffect(() => {
    if (tipus !== 'festa' && nom.trim()) carregaValoracio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nom, cursEscolarId, tipus])

  useEffect(() => {
    if (tipus === 'festa' && festaId) carregaFesta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festaId, cursEscolarId, tipus])

  async function carregaFesta() {
    setCarregant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__festa-${festaId}`
      const snap = await getDoc(doc(db, 'festesDetall', id))
      if (snap.exists()) {
        setFesta(snap.data().festa)
      } else if (cursEscolarId === CURS_FESTES && FESTES_PLANTILLES_26_27[festaId]) {
        setFesta(construeixFestaAmbPlantilla(FESTES_PLANTILLES_26_27[festaId]))
      } else {
        const label = FESTES.find((f) => f.id === festaId)?.label ?? festaId
        setFesta(festaBuida(label))
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desaFesta(festaNova) {
    setDesant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__festa-${festaId}`
      await setDoc(doc(db, 'festesDetall', id), {
        festa: festaNova,
        cursEscolar: cursEscolarId,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  function actualitzaFesta(canvis) {
    const nova = { ...festa, ...canvis }
    setFesta(nova)
    return nova
  }

  function actualitzaObjectiuFesta(objectiuId, canvis) {
    const nova = { ...festa, objectius: festa.objectius.map((o) => o.id === objectiuId ? { ...o, ...canvis } : o) }
    setFesta(nova)
    return nova
  }

  function afegeixObjectiuFesta() {
    const nouObjectiu = objectiuFestaBuit(0)
    const grups = {}
    for (const g of GRUPS) grups[g] = { ...festa.grups[g], [nouObjectiu.id]: { activitats: [], comentaris: '' } }
    const nova = { ...festa, objectius: [...festa.objectius, nouObjectiu], grups }
    setFesta(nova)
    desaFesta(nova)
  }

  function actualitzaActivitatFesta(grupNom, objectiuId, activitatId, canvis) {
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: festa.grups[grupNom][objectiuId].activitats.map((a) => a.id === activitatId ? { ...a, ...canvis } : a),
          },
        },
      },
    }
    setFesta(nova)
    return nova
  }

  function afegeixActivitatFesta(grupNom, objectiuId) {
    const novaActivitat = activitatBuida()
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: [...festa.grups[grupNom][objectiuId].activitats, novaActivitat],
          },
        },
      },
    }
    setFesta(nova)
    desaFesta(nova)
  }

  function esborraActivitatFesta(grupNom, objectiuId, activitatId) {
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: festa.grups[grupNom][objectiuId].activitats.filter((a) => a.id !== activitatId),
          },
        },
      },
    }
    setFesta(nova)
    desaFesta(nova)
  }

  function actualitzaComentarisGrup(grupNom, objectiuId, comentaris) {
    const nova = {
      ...festa,
      grups: { ...festa.grups, [grupNom]: { ...festa.grups[grupNom], [objectiuId]: { ...festa.grups[grupNom][objectiuId], comentaris } } },
    }
    setFesta(nova)
    return nova
  }

  async function carregaNomsExistents() {
    try {
      const snap = await getDocs(collection(db, 'valoracions'))
      const noms = snap.docs
        .map((d) => d.data())
        .filter((v) => v.cursEscolar === cursEscolarId)
        .map((v) => v.nom)
      setNomsExistents([...new Set(noms)])
    } catch {
      setNomsExistents([])
    }
  }

  async function carregaValoracio() {
    setCarregant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(nom.trim())}`
      const snap = await getDoc(doc(db, 'valoracions', id))
      if (snap.exists()) {
        const dades = snap.data()
        setValoracio({ ...valoracioBuida(), ...dades, objectius: dades.objectius?.length ? dades.objectius : [objectiuBuit()] })
        setFestesValoracio({ ...festesBuides(), ...(dades.festes ?? {}) })
      } else if (cursEscolarId === CURS_AMB_PLANTILLA && PLANTILLES_26_27[nom.trim()]) {
        // Primer cop que s'obre aquest nom en aquest curs concret: comencem
        // amb el text real de la plantilla oficial 2026-27. Qualsevol
        // altre curs, o un nom que no hi surti, comença en blanc.
        setValoracio({ ...valoracioBuida(), ...PLANTILLES_26_27[nom.trim()] })
        setFestesValoracio(festesBuides())
      } else {
        setValoracio(valoracioBuida())
        setFestesValoracio(festesBuides())
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desa(valoracioNova) {
    if (!nom.trim()) return
    setDesant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(nom.trim())}`
      await setDoc(doc(db, 'valoracions', id), {
        ...valoracioNova,
        nom: nom.trim(),
        cursEscolar: cursEscolarId,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
      if (!nomsExistents.includes(nom.trim())) setNomsExistents((prev) => [...prev, nom.trim()])
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  function actualitza(canvis) {
    const nova = { ...valoracio, ...canvis }
    setValoracio(nova)
    return nova
  }

  /** Llegeix una plantilla del centre i n'ensenya el contingut abans de
   *  substituir res. L'escala de cada actuació surt de la fórmula del full,
   *  no se suposa. */
  async function pujaPlantilla(fitxer) {
    if (!fitxer) return
    setLlegintPlantilla(true)
    setErrorPlantilla(null)
    setPlantilla(null)
    try {
      const buffer = await fitxer.arrayBuffer()
      setPlantilla(await llegeixPlantillaValoracio(buffer))
    } catch (err) {
      setErrorPlantilla(err.message)
    } finally {
      setLlegintPlantilla(false)
    }
  }

  function aplicaPlantilla() {
    if (!plantilla) return
    const nova = {
      ...valoracio,
      responsable: plantilla.valoracio.responsable || valoracio.responsable,
      membres: plantilla.valoracio.membres || valoracio.membres,
      objectius: plantilla.valoracio.objectius,
    }
    setValoracio(nova)
    desa(nova)
    setPlantilla(null)
  }

  function actualitzaObjectiu(objectiuId, canvis) {
    const nova = { ...valoracio, objectius: valoracio.objectius.map((o) => o.id === objectiuId ? { ...o, ...canvis } : o) }
    setValoracio(nova)
    return nova
  }

  function actualitzaActuacio(objectiuId, actuacioId, canvis) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : {
        ...o,
        actuacions: o.actuacions.map((a) => a.id === actuacioId ? { ...a, ...canvis } : a),
      }),
    }
    setValoracio(nova)
    return nova
  }

  function afegeixObjectiu() {
    const nova = actualitza({ objectius: [...valoracio.objectius, objectiuBuit()] })
    desa(nova)
  }

  function esborraObjectiu(objectiuId) {
    const nova = actualitza({ objectius: valoracio.objectius.filter((o) => o.id !== objectiuId) })
    desa(nova)
  }

  function afegeixActuacio(objectiuId) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : { ...o, actuacions: [...o.actuacions, actuacioBuida()] }),
    }
    setValoracio(nova)
    desa(nova)
  }

  function esborraActuacio(objectiuId, actuacioId) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : { ...o, actuacions: o.actuacions.filter((a) => a.id !== actuacioId) }),
    }
    setValoracio(nova)
    desa(nova)
  }

  return (
    <div className="module">
      <h2>Valoracions</h2>

      <div style={{ marginTop: 8 }}>
        <p className="module-eyebrow">Mòdul en construcció</p>
        <p className="module-lead">
          Aquí es guardaran també els documents de cada alumne (autoritzacions, informes,
          certificats). Els fitxers s'emmagatzemaran a Cloudflare R2, i cada document quedarà
          enllaçat a l'alumne corresponent sense afectar la resta del mòdul.
        </p>
        <div className="placeholder-box">
          Properament: pujada de documents, categorització per tipus i cerca per alumne.
        </div>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <h3 style={{ marginTop: 4, fontSize: 18 }}>Valoracions</h3>
        <p className="module-lead" style={{ maxWidth: '100%' }}>
          Cicles, comissions i equips, comissions mixtes (amb l'AFA), festes i celebracions, i
          activitats complementàries — tria la pestanya que et correspongui. Mateixa estructura
          que els fulls "Valoració ..." de sempre: Responsable, Membres, Objectius (amb
          Gener/Juny), i — quan calgui — "Actuacions" dins de cada objectiu, cadascuna amb el
          seu indicador d'avaluació. Cada canvi es desa sol.
        </p>

        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ maxWidth: 140 }}>
            <span>Curs escolar</span>
            <input
              type="text"
              value={cursEscolarId}
              onChange={(e) => setCursEscolarId(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setTipus('cicle'); setNom('') }}
            className={tipus === 'cicle' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'cicle' ? { maxWidth: 200 } : { maxWidth: 200, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Cicles
          </button>
          <button
            type="button"
            onClick={() => { setTipus('comissio'); setNom('') }}
            className={tipus === 'comissio' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'comissio' ? { maxWidth: 240 } : { maxWidth: 240, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Comissions i equips
          </button>
          <button
            type="button"
            onClick={() => { setTipus('afa'); setNom('') }}
            className={tipus === 'afa' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'afa' ? { maxWidth: 220 } : { maxWidth: 220, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Comissions mixtes
          </button>
          <button
            type="button"
            onClick={() => { setTipus('festa'); setNom(''); setFestaId('') }}
            className={tipus === 'festa' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'festa' ? { maxWidth: 240 } : { maxWidth: 240, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Festes i celebracions
          </button>
          <button
            type="button"
            onClick={() => { setTipus('activitats'); setNom(''); setCicleActivitats('') }}
            className={tipus === 'activitats' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'activitats' ? { maxWidth: 220 } : { maxWidth: 220, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Activitats complementàries
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {tipus === 'cicle' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Cicle</span>
              <select
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria un cicle…</option>
                {CICLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'afa' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Comissió</span>
              <select
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria una comissió…</option>
                {NOMS_AFA.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'activitats' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Cicle</span>
              <select
                value={cicleActivitats}
                onChange={(e) => setCicleActivitats(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria un cicle…</option>
                {CICLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'comissio' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Nom de la comissió / equip</span>
              <input
                type="text"
                list="noms-valoracio"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="p. ex. Comissió TAC, Equip LIC..."
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
              />
              <datalist id="noms-valoracio">
                {[...new Set([
                  ...(configActiva?.comissions.filter((c) => c.activa).map((c) => c.nom) ?? NOMS_SUGGERITS),
                  ...nomsExistents.filter((n) => !CICLES.includes(n)),
                ])].map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>
          ) : (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Festa</span>
              <select
                value={festaId}
                onChange={(e) => setFestaId(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria una festa…</option>
                {FESTES.filter((f) => configActiva ? configActiva.festes.find((cf) => cf.id === f.id)?.activa !== false : true)
                  .map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
          )}
          {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8, display: 'block' }}>Desant…</span>}
        </div>

        {tipus === 'festa' ? (
          !festaId ? (
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>Tria una festa per començar (o continuar) la valoració.</p>
          ) : carregant || !festa ? (
            <p style={{ marginTop: 16 }}>Carregant…</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label className="field" style={{ maxWidth: 260 }}>
                  <span>Data</span>
                  <input
                    type="text"
                    value={festa.data}
                    onChange={(e) => actualitzaFesta({ data: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    placeholder="p. ex. 23 d'abril de 2027"
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                  />
                </label>
                <div style={{ fontSize: 13 }}>
                  Grau d'assoliment general: <strong>{mitjanaGeneralFesta(festa) !== null ? `${Math.round(mitjanaGeneralFesta(festa))}%` : '—'}</strong>
                </div>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 20 }}>Objectius (amb el seu pes % entre ells)</p>
              {festa.objectius.map((o, oi) => (
                <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 18 }}>{oi + 1}.</span>
                  <textarea
                    value={o.text}
                    onChange={(e) => actualitzaObjectiuFesta(o.id, { text: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    rows={2}
                    placeholder="Text de l'objectiu"
                    style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }}
                  />
                  <label style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    Pes %
                    <input
                      type="number" min={0} max={100}
                      value={o.pes}
                      onChange={(e) => actualitzaObjectiuFesta(o.id, { pes: e.target.value })}
                      onBlur={() => desaFesta(festa)}
                      style={{ display: 'block', width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                    />
                  </label>
                </div>
              ))}
              <button type="button" onClick={afegeixObjectiuFesta} className="btn-ghost" style={{ marginTop: 8, maxWidth: 180, fontSize: 12 }}>
                + Afegeix objectiu
              </button>

              <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <label style={{ fontSize: 12 }}>
                  Pes Cicles %
                  <input
                    type="number" min={0} max={100}
                    value={festa.pesCicles}
                    onChange={(e) => actualitzaFesta({ pesCicles: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ display: 'block', width: 80, marginTop: 2, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Pes Equip Directiu %
                  <input
                    type="number" min={0} max={100}
                    value={festa.pesEquipDirectiu}
                    onChange={(e) => actualitzaFesta({ pesEquipDirectiu: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ display: 'block', width: 80, marginTop: 2, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                  />
                </label>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Desglossament per grup</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {GRUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrupObert(g)}
                    className={grupObert === g ? 'btn-primary' : 'btn-ghost'}
                    style={grupObert === g ? { fontSize: 12, padding: '6px 12px' } : { fontSize: 12, padding: '6px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
                  >
                    {g} {mitjanaGrup(festa, g) !== null ? `(${Math.round(mitjanaGrup(festa, g))}%)` : ''}
                  </button>
                ))}
              </div>

              <div className="placeholder-box" style={{ marginTop: 12 }}>
                {festa.objectius.map((o, oi) => {
                  const bloc = festa.grups[grupObert]?.[o.id] ?? { activitats: [], comentaris: '' }
                  return (
                    <div key={o.id} style={{ marginTop: oi === 0 ? 0 : 16, borderTop: oi === 0 ? 'none' : '1px dashed var(--line)', paddingTop: oi === 0 ? 0 : 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>
                        {oi + 1}. {o.text || '(sense text)'} — {mitjanaObjectiuGrup(festa, grupObert, o.id) !== null ? `${Math.round(mitjanaObjectiuGrup(festa, grupObert, o.id))}%` : '—'}
                      </p>
                      {bloc.activitats.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={a.text}
                            placeholder="Activitat/Indicador"
                            onChange={(e) => actualitzaActivitatFesta(grupObert, o.id, a.id, { text: e.target.value })}
                            onBlur={() => desaFesta(festa)}
                            style={{ flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                          />
                          <select
                            value={a.grau}
                            onChange={(e) => { const nova = actualitzaActivitatFesta(grupObert, o.id, a.id, { grau: e.target.value }); desaFesta(nova) }}
                            style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
                          >
                            <option value="">—</option>
                            {NIVELLS_GRAU.map((n) => <option key={n.id} value={n.valor}>{n.label}</option>)}
                          </select>
                          <button type="button" onClick={() => esborraActivitatFesta(grupObert, o.id, a.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11 }}>✕</button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => afegeixActivitatFesta(grupObert, o.id)}
                        className="btn-ghost"
                        style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', maxWidth: 180 }}
                      >
                        + Afegeix activitat
                      </button>
                      <textarea
                        value={bloc.comentaris}
                        onChange={(e) => actualitzaComentarisGrup(grupObert, o.id, e.target.value)}
                        onBlur={() => desaFesta(festa)}
                        rows={2}
                        placeholder="Comentaris i propostes de millora (opcional)"
                        style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 6, padding: 8, fontFamily: 'inherit', fontSize: 12 }}
                      />
                    </div>
                  )
                })}
              </div>

              {missatge && (
                <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {missatge.text}
                </p>
              )}
            </>
          )
        ) : tipus === 'activitats' ? (
          !cicleActivitats ? (
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
              Tria un cicle per començar (o continuar) la valoració d'activitats complementàries.
            </p>
          ) : carregantActivitats ? (
            <p style={{ marginTop: 16 }}>Carregant…</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex' }}>
                  {pujantActivitats ? 'Llegint el document…' : '📤 Puja el document de sortides (el mateix d\'Economia)'}
                  <input type="file" accept=".xlsx,.xls" onChange={pujaActivitatsCicle} style={{ display: 'none' }} disabled={pujantActivitats} />
                </label>
              </div>
              <p className="module-note" style={{ marginTop: 6 }}>
                Puja el mateix Excel consolidat "Activitats_Complementaries_..._I3_a_6e" que ja
                fas servir a Economia — es llegeixen els fulls dels nivells d'aquest cicle i
                se n'agafen els noms de les activitats reals. Si ja havies valorat alguna
                activitat amb aquest nom, la valoració es manté.
              </p>

              {activitats.length > 0 && (
                <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>Grau de satisfacció: <strong>{grauSatisfaccioCicle(activitats) !== null ? `${Math.round(grauSatisfaccioCicle(activitats))}%` : '—'}</strong></span>
                  <span>% de sortides valorades: <strong>{Math.round(percentValorades(activitats))}%</strong></span>
                  <span>Total de "Sí" (repetir): <strong>{totalRepetirSi(activitats)}</strong></span>
                </div>
              )}

              {missatge && (
                <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {missatge.text}
                </p>
              )}

              <div style={{ marginTop: 16 }}>
                {activitats.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Encara no hi ha cap activitat carregada per a aquest cicle.
                  </p>
                ) : activitats.map((act) => {
                  const oberta = activitatOberta === act.id
                  const mitjana = mitjanaActivitat(act)
                  return (
                    <div key={act.id} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                        onClick={() => setActivitatOberta(oberta ? null : act.id)}
                      >
                        <div>
                          <strong>{act.nom}</strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>
                            {act.nivell} {act.data && `· ${act.data}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <strong>{mitjana !== null ? `${mitjana.toFixed(1)}/10` : '— /10'}</strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {oberta && (
                        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--line)' }}>
                          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
                            {act.horari && `Horari: ${act.horari}`} {act.preu && `· Preu: ${act.preu}`}
                          </p>

                          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Valoració (0-10)</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
                            {CRITERIS_ACTIVITAT.map((c) => (
                              <label key={c.id} style={{ fontSize: 11 }}>
                                {c.label}
                                <input
                                  type="number" min={0} max={10} step={1}
                                  value={act.valoracions[c.id]}
                                  onChange={(e) => actualitzaCriteriActivitat(act.id, c.id, e.target.value)}
                                  onBlur={() => desaActivitats(activitats)}
                                  style={{ display: 'block', width: 70, marginTop: 3, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                                />
                              </label>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ fontSize: 12 }}>
                              Tornaríeu a fer la sortida?
                              <select
                                value={act.repetir}
                                onChange={(e) => { const noves = actualitzaActivitat(act.id, { repetir: e.target.value }); desaActivitats(noves) }}
                                style={{ display: 'block', marginTop: 3, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px' }}
                              >
                                <option value="">—</option>
                                <option value="Sí">Sí</option>
                                <option value="No">No</option>
                              </select>
                            </label>
                          </div>

                          <label style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                            Aspectes a considerar un altre curs
                            <textarea
                              value={act.aspectesConsiderar}
                              onChange={(e) => actualitzaActivitat(act.id, { aspectesConsiderar: e.target.value })}
                              onBlur={() => desaActivitats(activitats)}
                              rows={2}
                              style={{ display: 'block', width: '100%', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, padding: 8, fontFamily: 'inherit', fontSize: 12 }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )
        ) : !nom.trim() ? (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
            Escriu o tria un nom de cicle/comissió/equip per començar (o continuar) la valoració.
          </p>
        ) : carregant ? (
          <p style={{ marginTop: 16 }}>Carregant…</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <span>Responsable</span>
                <input
                  type="text"
                  value={valoracio.responsable}
                  onChange={(e) => actualitza({ responsable: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                />
              </label>
              <label className="field" style={{ flex: 2, minWidth: 220 }}>
                <span>Membres</span>
                <input
                  type="text"
                  value={valoracio.membres}
                  onChange={(e) => actualitza({ membres: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  placeholder="Noms separats per comes"
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
              {['gener', 'juny'].map((camp) => {
                const total = mitjanaValoracio(valoracio, camp)
                const p = pendentsValoracio(valoracio, camp)
                return (
                  <span key={camp}>
                    TOTAL GENERAL — {camp === 'gener' ? 'Gener' : 'Juny'}:{' '}
                    <strong>{total !== null ? `${Math.round(total)}%` : '—'}</strong>
                    {p.total - p.valorats > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        {' '}({p.total - p.valorats} sense valorar, compten 0)
                      </span>
                    )}
                  </span>
                )
              })}
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Objectius</p>
            {valoracio.objectius.map((objectiu, oi) => (
              <div key={objectiu.id} style={{ marginTop: 10, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 20, marginTop: 8 }}>{oi + 1}.</span>
                  <textarea
                    value={objectiu.text}
                    onChange={(e) => actualitzaObjectiu(objectiu.id, { text: e.target.value })}
                    onBlur={() => desa(valoracio)}
                    rows={4}
                    placeholder="Text de l'objectiu"
                    style={{ flex: 1, minWidth: 220, minHeight: 90, border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, lineHeight: 1.4, fontFamily: 'inherit' }}
                  />
                </div>
                {objectiu.actuacions.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, marginLeft: 30 }}>
                    <SelectorEstat
                      etiqueta="Gener"
                      valor={objectiu.gener}
                      escala={objectiu.escala ?? 'lliure'}
                      opcions={objectiu.opcions}
                      onCanvi={(v) => { const nova = actualitzaObjectiu(objectiu.id, { gener: v }); desa(nova) }}
                      onCanviEscala={(e) => { const nova = actualitzaObjectiu(objectiu.id, { escala: e }); desa(nova) }}
                    />
                    <SelectorEstat
                      etiqueta="Juny"
                      valor={objectiu.juny}
                      escala={objectiu.escala ?? 'lliure'}
                      opcions={objectiu.opcions}
                      onCanvi={(v) => { const nova = actualitzaObjectiu(objectiu.id, { juny: v }); desa(nova) }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
                  {objectiu.actuacions.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      TOTAL objectiu — Gener {mitjanaObjectiu(objectiu, 'gener') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'gener'))}%` : '—'} · Juny {mitjanaObjectiu(objectiu, 'juny') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'juny'))}%` : '—'}
                      {pendentsObjectiu(objectiu, 'juny').total - pendentsObjectiu(objectiu, 'juny').valorats > 0 && (
                        <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                          {' '}· {pendentsObjectiu(objectiu, 'juny').total - pendentsObjectiu(objectiu, 'juny').valorats} sense valorar al juny
                        </span>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={() => esborraObjectiu(objectiu.id)} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                    Esborra objectiu
                  </button>
                </div>

                {objectiu.actuacions.map((actuacio) => (
                  <div key={actuacio.id} style={{ marginTop: 8, marginLeft: 28 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={actuacio.text}
                        placeholder="Actuació/Activitat"
                        onChange={(e) => actualitzaActuacio(objectiu.id, actuacio.id, { text: e.target.value })}
                        onBlur={() => desa(valoracio)}
                        style={{ flex: 1, minWidth: 160, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                      />
                      <input
                        type="text"
                        value={actuacio.indicador}
                        placeholder="Indicador d'avaluació"
                        onChange={(e) => actualitzaActuacio(objectiu.id, actuacio.id, { indicador: e.target.value })}
                        onBlur={() => desa(valoracio)}
                        style={{ flex: 1, minWidth: 160, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                      />
                      <button type="button" onClick={() => esborraActuacio(objectiu.id, actuacio.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11 }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      <SelectorEstat
                        etiqueta="Gener"
                        valor={actuacio.gener}
                        escala={actuacio.escala ?? 'execucio50'}
                        opcions={actuacio.opcions}
                        onCanvi={(v) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { gener: v }); desa(nova) }}
                        onCanviEscala={(e) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { escala: e }); desa(nova) }}
                      />
                      <SelectorEstat
                        etiqueta="Juny"
                        valor={actuacio.juny}
                        escala={actuacio.escala ?? 'execucio50'}
                        opcions={actuacio.opcions}
                        onCanvi={(v) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { juny: v }); desa(nova) }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => afegeixActuacio(objectiu.id)}
                  className="btn-ghost"
                  style={{ marginTop: 8, marginLeft: 28, fontSize: 11, padding: '3px 8px', maxWidth: 200 }}
                >
                  + Afegeix actuació (opcional)
                </button>
              </div>
            ))}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <strong style={{ fontSize: 13 }}>Carrega els objectius d'una plantilla</strong>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, maxWidth: '100%' }}>
                Puja el full de valoració del centre i l'app en treu els objectius, les actuacions
                i l'escala de cada una. Des del Google Sheets: Fitxer → Baixa → Microsoft Excel.
              </p>
              <label
                className="btn-ghost"
                style={{ display: 'inline-block', marginTop: 8, color: 'var(--navy)', borderColor: 'var(--navy)', border: '1px solid', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                {llegintPlantilla ? 'Llegint…' : 'Puja la plantilla Excel'}
                <input
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => { pujaPlantilla(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>

              {errorPlantilla && (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{errorPlantilla}</p>
              )}

              {plantilla && (
                <div className="placeholder-box" style={{ marginTop: 12, padding: '12px 14px' }}>
                  <strong style={{ fontSize: 13 }}>
                    {plantilla.valoracio.nom ? `${plantilla.valoracio.nom} — ` : ''}
                    {plantilla.valoracio.objectius.length} objectius
                  </strong>
                  {plantilla.avisos.length > 0 && (
                    <ul style={{ fontSize: 12, color: 'var(--amber-dark)', marginTop: 6, paddingLeft: 18 }}>
                      {plantilla.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                  <ul style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8, paddingLeft: 18, maxHeight: 220, overflowY: 'auto' }}>
                    {plantilla.valoracio.objectius.map((o, i) => (
                      <li key={i}>{o.text || '(sense text)'} — {o.actuacions.length} actuacions</li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>
                    Això substituirà els objectius que hi ha ara en aquesta valoració.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={aplicaPlantilla}
                      style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                    >
                      Carrega-ho
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlantilla(null)}
                      className="btn-ghost"
                      style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 130, fontSize: 13 }}
                    >
                      Cancel·la
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={afegeixObjectiu} className="btn-ghost" style={{ marginTop: 10, color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 180 }}>
              + Afegeix objectiu
            </button>

            <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Valoració / revisió (gener o febrer)
                <textarea
                  value={valoracio.valoracioRevisio}
                  onChange={(e) => actualitza({ valoracioRevisio: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Valoració final (maig/juny)
                <textarea
                  value={valoracio.valoracioFinal}
                  onChange={(e) => actualitza({ valoracioFinal: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Metodologies utilitzades (opcional)
                <textarea
                  value={valoracio.metodologies}
                  onChange={(e) => actualitza({ metodologies: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Propostes de millora (opcional)
                <textarea
                  value={valoracio.propostesMillora}
                  onChange={(e) => actualitza({ propostesMillora: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
            </div>

            {missatge && (
              <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                {missatge.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
