export default function Inici() {
  const today = new Date().toLocaleDateString('ca-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="module">
      <p className="module-eyebrow">{capitalize(today)}</p>
      <h2>Benvingut/da</h2>
      <p className="module-lead">
        Aquest és el punt de partida de l'eina de gestió del centre. Fes servir el menú per moure't
        entre l'avaluació, l'assistència i la documentació de l'alumnat.
      </p>

      <div className="card-grid">
        <div className="info-card">
          <h3>Avaluació</h3>
          <p>Encara no hi ha dades carregades en aquest mòdul.</p>
        </div>
        <div className="info-card">
          <h3>Assistència</h3>
          <p>Encara no hi ha dades carregades en aquest mòdul.</p>
        </div>
        <div className="info-card">
          <h3>Documentació</h3>
          <p>Encara no hi ha dades carregades en aquest mòdul.</p>
        </div>
      </div>
    </div>
  )
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
