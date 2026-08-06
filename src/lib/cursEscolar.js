export function cursEscolarActual() {
  const avui = new Date()
  const any = avui.getMonth() >= 7 ? avui.getFullYear() : avui.getFullYear() - 1
  return `${any}-${(any + 1).toString().slice(2)}`
}

export function cursSeguent(cursId) {
  const [anyIniciStr] = cursId.split('-')
  const any = Number(anyIniciStr) + 1
  return `${any}-${(any + 1).toString().slice(2)}`
}
