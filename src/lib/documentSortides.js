// El document consolidat d'activitats complementàries del centre.
//
// El fan servir dos mòduls: Economia (per treure'n els preus de les
// sortides) i Valoracions → Activitats complementàries (per treure'n les
// activitats reals de cada nivell). Abans cada un el tenia pel seu compte i
// calia pujar-lo dues vegades; ara viu aquí i tots dos el poden llegir
// directament del Drive.

export const DOC_SORTIDES_OFICIAL_ID = '1BjWwDFbFqlfjn1DQ-RT1WsO-mkqg9LM_x-f-WxCem08'

export const URL_DOC_SORTIDES = `https://docs.google.com/spreadsheets/d/${DOC_SORTIDES_OFICIAL_ID}/edit`

/**
 * Baixa el document del Drive i el retorna ja llegit.
 * Funciona sense sessió perquè està compartit "Qualsevol amb l'enllaç".
 *
 * @param {object} XLSX  la llibreria, carregada sota demanda per qui crida
 */
export async function descarregaDocumentSortides(XLSX) {
  const url = `https://docs.google.com/spreadsheets/d/${DOC_SORTIDES_OFICIAL_ID}/export?format=xlsx`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `No s'ha pogut llegir el document (codi ${res.status}). Comprova que està compartit ` +
      `com "Qualsevol persona amb l'enllaç" pot veure.`
    )
  }
  return XLSX.read(await res.arrayBuffer(), { type: 'array' })
}
