import {
  classificarAreaComercial,
  normalizarTexto,
  type AreaComercial,
  type PiArea,
} from "./areasComerciais"

export type PiGestao = PiArea & {
  [key: string]: string | number | null | undefined
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  campanha?: string
  mes_venda: string
  uf_cliente?: string
  valor_bruto: number
  valor_liquido: number
}

export type RankingGestao = {
  nome: string
  liquido: number
  bruto: number
  pis: number
}

export type MesGestao = {
  mes: string
  liquido: number
  bruto: number
  pis: number
}

export function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function getMesAno(value?: string) {
  const [mes, ano] = String(value || "").split("/")
  return { mes, ano }
}

export function mesParaOrdem(value?: string) {
  const { mes, ano } = getMesAno(value)
  return Number(`${ano || "0"}${mes || "0"}`)
}

export function mesCurto(value: string) {
  const nomes: Record<string, string> = {
    "01": "Jan",
    "02": "Fev",
    "03": "Mar",
    "04": "Abr",
    "05": "Mai",
    "06": "Jun",
    "07": "Jul",
    "08": "Ago",
    "09": "Set",
    "10": "Out",
    "11": "Nov",
    "12": "Dez",
  }
  const { mes, ano } = getMesAno(value)
  return `${nomes[mes] || mes}/${String(ano || "").slice(-2)}`
}

export function agenciaValida(value?: string | null) {
  const texto = normalizarTexto(value)
  return Boolean(
    texto &&
      texto !== "direto" &&
      texto !== "direta" &&
      texto !== "agencia direta" &&
      texto !== "sem agencia" &&
      texto !== "nao informado"
  )
}

export function filtrarGestao(
  dados: PiGestao[],
  filtros: {
    ano?: string
    mes?: string
    busca?: string
    area?: AreaComercial | ""
    executivo?: string
  }
) {
  const termo = normalizarTexto(filtros.busca)
  const executivo = normalizarTexto(filtros.executivo)

  return dados.filter((item) => {
    const { ano } = getMesAno(item.mes_venda)
    const bateAno = !filtros.ano || ano === filtros.ano
    const bateMes = !filtros.mes || item.mes_venda === filtros.mes
    const bateArea =
      !filtros.area || classificarAreaComercial(item) === filtros.area
    const bateExecutivo =
      !executivo || normalizarTexto(item.executivo) === executivo
    const bateBusca =
      !termo ||
      normalizarTexto(Object.values(item).join(" ")).includes(termo)

    return bateAno && bateMes && bateArea && bateExecutivo && bateBusca
  })
}

export function criarRanking(
  dados: PiGestao[],
  campo: "executivo" | "anunciante" | "agencia",
  limite = 10
) {
  const mapa = new Map<string, RankingGestao>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim()
    if (!nome || (campo === "agencia" && !agenciaValida(nome))) return

    const atual = mapa.get(nome) || {
      nome,
      liquido: 0,
      bruto: 0,
      pis: 0,
    }
    atual.liquido += Number(item.valor_liquido || 0)
    atual.bruto += Number(item.valor_bruto || 0)
    atual.pis += 1
    mapa.set(nome, atual)
  })

  return Array.from(mapa.values())
    .sort((a, b) => b.liquido - a.liquido)
    .slice(0, limite)
}

export function agruparMeses(dados: PiGestao[]) {
  const mapa = new Map<string, MesGestao>()

  dados.forEach((item) => {
    const mes = item.mes_venda || "Sem mês"
    const atual = mapa.get(mes) || {
      mes,
      liquido: 0,
      bruto: 0,
      pis: 0,
    }
    atual.liquido += Number(item.valor_liquido || 0)
    atual.bruto += Number(item.valor_bruto || 0)
    atual.pis += 1
    mapa.set(mes, atual)
  })

  return Array.from(mapa.values()).sort(
    (a, b) => mesParaOrdem(a.mes) - mesParaOrdem(b.mes)
  )
}
