import { LLEGENDA_DIVERSITAT } from '../lib/atencioDiversitat'

/**
 * La llegenda de colors d'Atenció a la diversitat, per posar-la a sobre
 * de qualsevol taula d'alumnes que faci servir `colorDiversitat()` per
 * destacar les files (TEE, VL/CL, Lectoescriptura…). Un sol lloc perquè
 * els colors i les etiquetes surtin sempre iguals, siguin quina siguin
 * la pantalla.
 *
 * Cada entrada es pot clicar per activar-la o desactivar-la — quan està
 * desactivada, es veu esvaïda i deixa de pintar-se a la taula (vegeu el
 * paràmetre `actius` de `colorDiversitat`). El component és "controlat":
 * l'estat viu al component que crida `useActiusDiversitat()`, no aquí.
 */
export default function LlegendaDiversitat({ actius, onToggle }) {
  return (
    <div style={{ marginTop: 10, marginBottom: 4 }}>
      <p className="nota" style={{ marginBottom: 6 }}>
        Atenció a la diversitat — clica un color per amagar-lo o tornar-lo a mostrar a la taula:
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        {LLEGENDA_DIVERSITAT.map((c) => {
          const actiu = actius.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              title={actiu ? 'Clica per amagar-ho a la taula' : 'Clica per tornar-ho a mostrar'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                opacity: actiu ? 1 : 0.4, font: 'inherit', color: 'inherit',
              }}
            >
              <span
                style={{
                  width: 14, height: 14, borderRadius: 3, background: c.color,
                  display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)',
                }}
              />
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
