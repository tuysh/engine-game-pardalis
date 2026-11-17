// Comprueba que un dato que viene de afuera sea un objeto de JSON (`{ ... }`),
// y no una lista, un texto, un número o `null`.

export function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
