export type AreaComercial =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

export type PiArea = {
  grupo?: string | null
  executivo?: string | null
  perfil_anunciante?: string | null
  sub_perfil_anunciante?: string | null
}

export const AREAS_DJANANE: AreaComercial[] = [
  "gestao-executiva",
  "gdf",
  "estadual",
]

export function normalizarTexto(value?: string | number | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function classificarAreaComercial(item: PiArea): AreaComercial {
  const perfil = normalizarTexto(item.perfil_anunciante)
  const subperfil = normalizarTexto(item.sub_perfil_anunciante)
  const executivo = normalizarTexto(item.executivo)
  const grupo = normalizarTexto(item.grupo)

  if (
    grupo === "federal" ||
    perfil.includes("federal") ||
    subperfil.includes("federal")
  ) {
    return "federal"
  }

  if (
    executivo.includes("gestao executiva") ||
    subperfil.includes("gestao executiva")
  ) {
    return "gestao-executiva"
  }

  if (subperfil.includes("gdf") || subperfil.includes("cldf")) {
    return "gdf"
  }

  if (grupo === "estadual" || perfil.includes("estadual")) {
    return "estadual"
  }

  return "privado"
}

export function nomeAreaComercial(area: AreaComercial) {
  const nomes: Record<AreaComercial, string> = {
    privado: "Comercial Privado",
    "gestao-executiva": "Gestão Executiva",
    estadual: "Governo Estadual",
    federal: "Governo Federal",
    gdf: "GDF / CLDF",
  }

  return nomes[area]
}

export function pertenceAoEscopoDjanane(item: PiArea) {
  return AREAS_DJANANE.includes(classificarAreaComercial(item))
}
