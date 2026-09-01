import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'

// Ordre pedagògic de les classes (P3 → 6è), no alfabètic: "1r" hauria de
// sortir abans que "2n" tot i que alfabèticament "1" > cap altra xifra no
// s'hi compara bé amb "P3". Els noms de curs venen tal com els desa
// Alumnes.jsx en pujar el llistat ("P3 A", "5è A"...).
const ORDRE_NIVELL = ['p3', 'p4', 'p5', '1r', '2n', '3r', '4t', '5e', '6e']

function normalitzaNivell(s) {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** [índex de nivell (99 si no es reconeix), resta del nom (classe A/B/C)] */
function clauCurs(curs) {
  const net = (curs ?? '').trim()
  const m = net.match(/^(\S+)\s*(.*)$/)
  if (!m) return [99, '']
  const idx = ORDRE_NIVELL.indexOf(normalitzaNivell(m[1]))
  return [idx === -1 ? 99 : idx, (m[2] ?? '').toUpperCase()]
}

function comparaCursos(a, b) {
  const [ia, la] = clauCurs(a)
  const [ib, lb] = clauCurs(b)
  return ia - ib || la.localeCompare(lb)
}

/**
 * Mòdul "Atenció a la diversitat". Primera versió: només mostra el que ja
 * arriba amb la pujada d'alumnat (Alumnes.jsx, fulls "ESFERA PI" i
 * "ESFERA AD" — vegeu sicAlumnatIndicadors.js). Els indicadors automàtics
 * del SIC i la resta de blocs (mobilitat, absències, ajuts…) són feina
 * pendent, no d'aquesta primera versió.
 */
export default function AtencioDiversitat() {
  const [alumnes, setAlumnes] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    async function carrega() {
      try {
        const snap = await getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true)))
        setAlumnes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  // Alumnes amb PI, per classe i endreçats per cognom dins de cada una
  // (el nom es desa "Cognom, Nom", així que ordenar pel nom tal qual ja
  // ordena per cognom).
  const ambPi = useMemo(() => {
    const perClasse = {}
    for (const a of alumnes) {
      if (!a.pi) continue
      if (!perClasse[a.curs]) perClasse[a.curs] = []
      perClasse[a.curs].push(a)
    }
    for (const llista of Object.values(perClasse)) {
      llista.sort((x, y) => (x.nom ?? '').localeCompare(y.nom ?? '', 'ca'))
    }
    return Object.entries(perClasse).sort(([a], [b]) => comparaCursos(a, b))
  }, [alumnes])

  const totalPi = ambPi.reduce((acc, [, llista]) => acc + llista.length, 0)

  // Qualsevol alumne amb alguna dada de l'ESFERA AD (motiu, flag, o algun
  // dels tres tipus), també per classe i cognom.
  const ambAd = useMemo(() => (
    alumnes
      .filter((a) => a.adMotiu || a.adFlag || a.adTipusA || a.adTipusB || a.adTipusC)
      .sort((a, b) => comparaCursos(a.curs, b.curs) || (a.nom ?? '').localeCompare(b.nom ?? '', 'ca'))
  ), [alumnes])

  if (carregant) return <p>Carregant…</p>

  return (
    <div className="module">
      <p className="module-eyebrow">Atenció a la diversitat</p>
      <h2>Atenció a la diversitat</h2>
      <p className="module-lead">
        Primera versió: de moment només mostra el que ja arriba amb el darrer llistat
        d&apos;alumnat pujat a <strong>Alumnes</strong> (fulls &quot;ESFERA PI&quot; i
        &quot;ESFERA AD&quot;) — qui té Pla Individualitzat, i el detall de NESE. Si algú hi
        falta o hi sobra, és qüestió de tornar a pujar el llistat amb aquests dos fulls.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18 }}>
          Alumnes amb PI <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 14 }}>({totalPi})</span>
        </h3>

        {ambPi.length === 0 ? (
          <p className="nota" style={{ marginTop: 8 }}>
            Cap alumne amb PI. Si n&apos;hi hauria d&apos;haver, comprova que el darrer
            fitxer pujat a Alumnes portava el full &quot;ESFERA PI&quot;.
          </p>
        ) : (
          ambPi.map(([curs, llista]) => (
            <div key={curs} style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {curs} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>({llista.length})</span>
              </p>
              <ul className="roster">
                {llista.map((a) => (
                  <li key={a.id} className="roster-row">
                    <span className="roster-name">{a.nom}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <h3 style={{ fontSize: 18 }}>
          Esfera AD — NESE <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 14 }}>({ambAd.length})</span>
        </h3>
        <p className="nota" style={{ marginTop: 4 }}>
          &quot;NESE&quot; és el flag de la columna F del full (0/1); &quot;Motiu&quot; ve de
          la columna E, en text lliure — no sempre coincideixen (vegeu
          sicAlumnatIndicadors.js).
        </p>

        {ambAd.length === 0 ? (
          <p className="nota" style={{ marginTop: 8 }}>
            Cap alumne amb dades de NESE. Comprova que el darrer fitxer pujat a Alumnes
            portava el full &quot;ESFERA AD&quot;.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Classe</th>
                  <th style={{ padding: '6px 8px' }}>Alumne</th>
                  <th style={{ padding: '6px 8px' }}>Motiu</th>
                  <th style={{ padding: '6px 8px' }}>NESE</th>
                  <th style={{ padding: '6px 8px' }}>Tipus A</th>
                  <th style={{ padding: '6px 8px' }}>Tipus B</th>
                  <th style={{ padding: '6px 8px' }}>Tipus C</th>
                </tr>
              </thead>
              <tbody>
                {ambAd.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>{a.curs}</td>
                    <td style={{ padding: '6px 8px' }}>{a.nom}</td>
                    <td style={{ padding: '6px 8px' }}>{a.adMotiu || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{a.adFlag ? 'Sí' : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{a.adTipusA ? 'Sí' : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{a.adTipusB ? 'Sí' : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{a.adTipusC ? 'Sí' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
