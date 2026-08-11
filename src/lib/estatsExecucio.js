// Els 3 estats d'execució tal com surten a la plantilla oficial "Eina
// d'avaluació PGAC": cada indicador es marca com No fet / En procés / Fet,
// i cada estat correspon sempre al mateix percentatge — en comptes
// d'escriure un número a mà cada vegada.
export const ESTATS_EXECUCIO = [
  { id: 'no_fet', label: 'No fet', valor: 0 },
  { id: 'en_proces', label: 'En procés', valor: 40 },
  { id: 'fet', label: 'Fet', valor: 100 },
]

/** Diu quin estat correspon a un valor numèric ja desat (per marcar quin
 *  botó ha de sortir seleccionat) — null si el valor no coincideix amb cap
 *  dels 3 estats estàndard (per exemple, un indicador amb escala pròpia
 *  com "2 Cicles = 66%"). */
export function estatDe(valor) {
  if (valor === '' || valor === null || valor === undefined) return null
  return ESTATS_EXECUCIO.find((e) => e.valor === Number(valor)) ?? null
}
