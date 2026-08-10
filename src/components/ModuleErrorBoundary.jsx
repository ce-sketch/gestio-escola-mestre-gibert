import { Component } from 'react'

/**
 * Detecta errors en carregar un mòdul — el cas més freqüent és que s'ha
 * publicat una versió nova de l'app mentre la pestanya ja estava oberta:
 * el navegador busca el fitxer de l'antiga versió, que ja no existeix al
 * servidor, i sense això l'app es quedaria "penjada" en silenci.
 *
 * En comptes d'això, mostrem un avís clar amb un botó per recarregar.
 */
export default class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Error en carregar un mòdul:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="placeholder-box" style={{ borderStyle: 'solid', margin: 40, textAlign: 'center' }}>
          <p style={{ fontWeight: 600 }}>Hi ha una versió nova de l'app disponible</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            Aquesta pestanya estava oberta des d'abans d'una actualització — cal recarregar-la
            un cop per agafar la versió nova. No es perd res del que ja tinguis desat.
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: 16, maxWidth: 200, marginLeft: 'auto', marginRight: 'auto' }}
            onClick={() => window.location.reload()}
          >
            ↻ Recarrega la pàgina
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
