import { useState } from 'react'
import { triaDocumentDelDrive, triaDocumentsDelDrive } from '../lib/drivePicker'

/**
 * Botó per agafar un document del Drive sense haver de baixar-lo i
 * tornar-lo a pujar. S'obre el selector de Google i el fitxer triat arriba
 * ja baixat.
 *
 * Es passa el MATEIX gestor que el botó de pujar fitxer del costat: el
 * document baixat es converteix en un File i s'hi crida igual que si
 * l'haguessis triat des de l'ordinador. Així no cal duplicar cap lògica de
 * lectura ni tocar els gestors que ja funcionen.
 *
 * @param {(event: {target: {files: File[], value: string}}) => void} onFitxer
 * @param {(missatge: string) => void} [onError]
 * @param {boolean} [disabled]
 * @param {'fulls'|'documents'|'csv'|'pdf'} [tipus]  què es pot triar al selector
 * @param {string} [etiqueta]
 */
export default function BotoDrive({
  onFitxer, onError, disabled = false, tipus = 'fulls',
  etiqueta = 'Tria un document del Drive', multiple = false,
}) {
  const [obrint, setObrint] = useState(false)

  async function obre() {
    setObrint(true)
    try {
      // Amb `multiple`, el selector deixa marcar diversos fitxers alhora
      // (per exemple, tots els informes d'una mateixa avaluació).
      const tries = multiple
        ? await triaDocumentsDelDrive(tipus, true)
        : [await triaDocumentDelDrive(tipus)].filter(Boolean)
      if (!tries || tries.length === 0) return // ha tancat sense triar res
      const fitxers = tries.map((t) => new File([t.buffer], t.nom, { type: t.mime }))
      await onFitxer({ target: { files: fitxers, value: '' } })
    } catch (err) {
      if (onError) onError(err.message)
      else console.error(err)
    } finally {
      setObrint(false)
    }
  }

  return (
    <button
      type="button"
      onClick={obre}
      disabled={disabled || obrint}
      className="btn-ghost"
      style={{
        // Els colors van aquí a més del CSS: així el botó és llegible
        // encara que el full d'estils desplegat sigui d'abans.
        color: 'var(--navy)', borderColor: 'var(--navy)',
        maxWidth: '100%', textAlign: 'left',
      }}
    >
      {obrint ? 'Obrint el Drive…' : `📁 ${etiqueta}`}
    </button>
  )
}
