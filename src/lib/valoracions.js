// Categories (cicles, comissions i equips) i festes que es valoren cada
// curs, tal com surten al document oficial "Eina d'avaluació PGAC".

export const CATEGORIES_VALORACIO = [
  { id: 'INF', label: 'Educació Infantil' },
  { id: 'CINI', label: 'Cicle Inicial (1r-2n)' },
  { id: 'CMIT', label: 'Cicle Mitjà (3r-4t)' },
  { id: 'CSUP', label: 'Cicle Superior (5è-6è)' },
  { id: 'TAC', label: 'Comissió TAC' },
  { id: 'MATERIAL', label: 'Comissió Material' },
  { id: 'ANGLES', label: 'Comissió Anglès' },
  { id: 'BIB', label: 'Comissió Biblioteca' },
  { id: 'TPATIS', label: 'Comissió Torns de Patis' },
  { id: 'ESPAIS', label: 'Comissió Espais' },
  { id: 'AD', label: 'Equip Atenció a la Diversitat' },
  { id: 'RL', label: 'Equip Riscos Laborals' },
  { id: 'LIC', label: 'Equip LIC (Llengua, Interculturalitat i Cohesió)' },
]

export const FESTES = [
  { id: 'castanyada', label: 'Castanyada' },
  { id: 'nadal', label: 'Nadal' },
  { id: 'carnestoltes', label: 'Carnestoltes' },
  { id: 'mona', label: 'Mona' },
  { id: 'santjordi', label: 'Sant Jordi' },
  { id: 'gimcana', label: 'Gimcana i comiat' },
]

export function valoracioBuida() {
  const festes = {}
  for (const f of FESTES) festes[f.id] = ''
  return { valCicleComissioEquips: '', festes, comentaris: '' }
}
