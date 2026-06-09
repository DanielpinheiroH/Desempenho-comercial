import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps"
import { scaleLinear } from "d3-scale"

import { api, getToken, getUser } from "../services/api"

const MAPA_BRASIL_GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson"

type MapaBase = "cliente" | "agencia"
type PerfilEstadual = "todos" | "gestao-executiva" | "governo-estadual"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  perfil_anunciante?: string | null
  sub_perfil_anunciante?: string | null
  uf_cliente?: string | null
  uf_agencia?: string | null
  grupo: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

type Meta = {
  executivo: string
  mes: string
  meta: number
}

type MesResumo = {
  mes: string
  ano: string
  mesNumero: number
  total: number
  quantidade: number
  meta: number
}

type AnoResumo = {
  ano: string
  total: number
  meta: number
  quantidade: number
  meses: MesResumo[]
}

type MapaUfResumo = {
  uf: string
  liquido: number
  bruto: number
  pis: number
}

type MapaTooltip = {
  uf: string
  x: number
  y: number
}

type GeographyItem = {
  rsmKey: string
  properties: Record<string, string | number | undefined>
}

const UF_NAME_TO_SIGLA: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function usuarioVeGrupoEstadual(user: any) {
  const grupos = Array.isArray(user?.grupos)
    ? user.grupos.map((grupo: string) => normalizar(grupo))
    : []

  return user?.role === "grupo" && grupos.includes("estadual")
}

function classificarPerfilEstadual(item: Pi) {
  const perfil = normalizar(item.perfil_anunciante)
  const subperfil = normalizar(item.sub_perfil_anunciante)

  if (
    perfil.includes("gestao executiva") ||
    subperfil.includes("gestao executiva")
  ) {
    return "gestao-executiva"
  }

  if (
    perfil.includes("governo estadual") ||
    subperfil.includes("governo estadual") ||
    subperfil.startsWith("gdf -")
  ) {
    return "governo-estadual"
  }

  return null
}

function isAgenciaValida(value?: string | null) {
  const texto = normalizar(value)

  return Boolean(
    texto &&
      texto !== "direto" &&
      texto !== "direta" &&
      texto !== "sem agencia" &&
      texto !== "sem agência" &&
      texto !== "nao informado" &&
      texto !== "não informado"
  )
}

function getAno(mes: string) {
  return mes?.split("/")[1] || "Sem ano"
}

function getMesNumero(mes: string) {
  return Number(mes?.split("/")[0] || 99)
}

function getUfFromGeography(properties: GeographyItem["properties"]) {
  const candidates = [
    properties.sigla,
    properties.uf,
    properties.UF,
    properties.postal,
    properties.abbrev,
  ]

  const sigla = candidates
    .map((item) => String(item || "").trim().toUpperCase())
    .find((item) => /^[A-Z]{2}$/.test(item))

  if (sigla) return sigla

  const name = normalizar(
    String(properties.name || properties.nome || properties.NAME || "")
  )

  return UF_NAME_TO_SIGLA[name] || ""
}

function getUf(item: Pi, baseMapa: MapaBase) {
  const value = baseMapa === "cliente" ? item.uf_cliente : item.uf_agencia
  return String(value || "").trim().toUpperCase()
}

function mesParaReferencia(mes: string) {
  const mesNumero = getMesNumero(mes)
  const ano = getAno(mes)

  return Number(`${ano}${String(mesNumero).padStart(2, "0")}`)
}

function statusMeta(percentual: number) {
  if (percentual >= 100) {
    return {
      label: "Bateu a meta",
      className: "text-emerald-600",
      bar: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
    }
  }

  if (percentual >= 50) {
    return {
      label: "Destravou",
      className: "text-amber-600",
      bar: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700",
    }
  }

  return {
    label: "Ainda não destravou",
    className: "text-red-600",
    bar: "bg-red-600",
    badge: "bg-red-50 text-red-700",
  }
}

export default function DashboardExecutivo() {
  const navigate = useNavigate()
  const user = getUser()
  const executivoAtual = user?.executivo || user?.nome || ""
  const visaoGrupoEstadual = usuarioVeGrupoEstadual(user)
  const escopoLabel = visaoGrupoEstadual
    ? "Gestão Executiva e Governo Estadual"
    : executivoAtual || "este executivo"

  const [dados, setDados] = useState<Pi[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [busca, setBusca] = useState("")
  const [perfilEstadual, setPerfilEstadual] =
    useState<PerfilEstadual>("todos")
  const [loading, setLoading] = useState(true)
  const [anoAberto, setAnoAberto] = useState<string | null>(null)
  const [baseMapa, setBaseMapa] = useState<MapaBase>("cliente")
  const [ufMapaSelecionada, setUfMapaSelecionada] = useState("")
  const [mapaTooltip, setMapaTooltip] = useState<MapaTooltip | null>(null)

  async function carregarDados() {
    try {
      setLoading(true)

      const token = getToken()

      const [pisResponse, metasResponse] = await Promise.all([
        api.get("/api/pis", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        api.get("/api/metas"),
      ])

      setDados(Array.isArray(pisResponse.data) ? pisResponse.data : [])
      setMetas(Array.isArray(metasResponse.data) ? metasResponse.data : [])
    } catch (error) {
      console.error(error)
      setDados([])
      setMetas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const dadosDoEscopo = useMemo(() => {
    if (visaoGrupoEstadual) return dados

    const executivoNorm = normalizar(executivoAtual)

    return dados.filter(
      (item) => normalizar(item.executivo) === executivoNorm
    )
  }, [dados, executivoAtual, visaoGrupoEstadual])

  const resumoPerfisEstaduais = useMemo(() => {
    return dadosDoEscopo.reduce(
      (resumo, item) => {
        const perfil = classificarPerfilEstadual(item)

        if (perfil) resumo[perfil] += 1

        return resumo
      },
      {
        "gestao-executiva": 0,
        "governo-estadual": 0,
      }
    )
  }, [dadosDoEscopo])

  const dadosDoPerfil = useMemo(() => {
    if (!visaoGrupoEstadual || perfilEstadual === "todos") {
      return dadosDoEscopo
    }

    return dadosDoEscopo.filter(
      (item) => classificarPerfilEstadual(item) === perfilEstadual
    )
  }, [dadosDoEscopo, perfilEstadual, visaoGrupoEstadual])

  const metasDoEscopo = useMemo(() => {
    if (visaoGrupoEstadual) {
      const executivosPermitidos = new Set(
        dadosDoPerfil.map((item) => normalizar(item.executivo)).filter(Boolean)
      )

      return metas.filter((item) =>
        executivosPermitidos.has(normalizar(item.executivo))
      )
    }

    const executivoNorm = normalizar(executivoAtual)

    return metas.filter(
      (item) => normalizar(item.executivo) === executivoNorm
    )
  }, [dadosDoPerfil, metas, executivoAtual, visaoGrupoEstadual])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return dadosDoPerfil

    return dadosDoPerfil.filter((item) =>
      normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.grupo,
          item.mes_venda,
        ].join(" ")
      ).includes(termo)
    )
  }, [dadosDoPerfil, busca])

  function metaDoMes(mes: string) {
    return metasDoEscopo
      .filter((meta) => meta.mes === mes)
      .reduce((acc, meta) => acc + Number(meta.meta || 0), 0)
  }

  const faturamentoPorMes = useMemo(() => {
    const mapa = new Map<string, MesResumo>()

    dadosFiltrados.forEach((item) => {
      const mes = item.mes_venda || "Sem mês"

      const atual = mapa.get(mes) || {
        mes,
        ano: getAno(mes),
        mesNumero: getMesNumero(mes),
        total: 0,
        quantidade: 0,
        meta: 0,
      }

      atual.total += Number(item.valor_liquido || 0)
      atual.quantidade += 1

      mapa.set(mes, atual)
    })

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        meta: metaDoMes(item.mes),
      }))
      .sort((a, b) => {
        if (a.ano !== b.ano) return Number(b.ano) - Number(a.ano)
        return a.mesNumero - b.mesNumero
      })
  }, [dadosFiltrados, metasDoEscopo])

  const faturamentoPorAno = useMemo(() => {
    const mapa = new Map<string, AnoResumo>()

    faturamentoPorMes.forEach((mes) => {
      const atual = mapa.get(mes.ano) || {
        ano: mes.ano,
        total: 0,
        meta: 0,
        quantidade: 0,
        meses: [],
      }

      atual.total += mes.total
      atual.meta += mes.meta
      atual.quantidade += mes.quantidade
      atual.meses.push(mes)

      mapa.set(mes.ano, atual)
    })

    return Array.from(mapa.values()).sort(
      (a, b) => Number(b.ano) - Number(a.ano)
    )
  }, [faturamentoPorMes])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const totalPIs = dadosFiltrados.length
  const ticketMedio = totalPIs > 0 ? totalLiquido / totalPIs : 0

  const anunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const agencias = new Set(
    dadosFiltrados
      .map((item) => item.agencia)
      .filter((agencia) => isAgenciaValida(agencia))
  ).size

  const mapaPorUf = useMemo(() => {
    const mapa = new Map<string, MapaUfResumo>()

    dadosFiltrados.forEach((item) => {
      const uf = getUf(item, baseMapa)

      if (!/^[A-Z]{2}$/.test(uf)) return

      const atual = mapa.get(uf) || {
        uf,
        liquido: 0,
        bruto: 0,
        pis: 0,
      }

      atual.liquido += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)
      atual.pis += 1

      mapa.set(uf, atual)
    })

    return mapa
  }, [dadosFiltrados, baseMapa])

  const rankingMapaUf = useMemo(() => {
    return Array.from(mapaPorUf.values()).sort(
      (a, b) => b.liquido - a.liquido
    )
  }, [mapaPorUf])

  const maiorValorMapa = rankingMapaUf[0]?.liquido || 0
  const ufResumoSelecionado = ufMapaSelecionada
    ? mapaPorUf.get(ufMapaSelecionada) || null
    : rankingMapaUf[0] || null
  const ufResumoTooltip = mapaTooltip
    ? mapaPorUf.get(mapaTooltip.uf) || null
    : null

  const corMapaUf = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, Math.max(maiorValorMapa, 1)])
      .range(["#fee2e2", "#dc2626"])
      .clamp(true)
  }, [maiorValorMapa])

  const mesesComMeta = faturamentoPorMes.filter(
    (item) => Number(item.meta || 0) > 0
  )

  const primeiroMesComMeta = [...mesesComMeta].sort(
    (a, b) => mesParaReferencia(a.mes) - mesParaReferencia(b.mes)
  )[0]

  const referenciaMeta = primeiroMesComMeta
    ? mesParaReferencia(primeiroMesComMeta.mes)
    : 0

  const metaTotal = mesesComMeta.reduce(
    (acc, item) => acc + Number(item.meta || 0),
    0
  )

  const realizadoPeriodoMeta = dadosFiltrados
    .filter((item) => mesParaReferencia(item.mes_venda) >= referenciaMeta)
    .reduce((acc, item) => acc + Number(item.valor_liquido || 0), 0)

  const temMeta = mesesComMeta.length > 0
  const percentualMeta = temMeta ? (realizadoPeriodoMeta / metaTotal) * 100 : 0
  const statusGeral = statusMeta(percentualMeta)

  const melhorAno = faturamentoPorAno[0]
  const melhorMes = [...faturamentoPorMes].sort((a, b) => b.total - a.total)[0]

  function abrirMes(mes: string) {
    navigate(`/mes/${encodeURIComponent(mes.replace("/", "-"))}`)
  }

  function alternarAno(ano: string) {
    setAnoAberto((atual) => (atual === ano ? null : ano))
  }

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
            {visaoGrupoEstadual
              ? "Gestão Executiva + Governo Estadual"
              : "Meu perfil comercial"}
          </span>

          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Olá, {user?.nome || "Executivo"}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            {visaoGrupoEstadual
              ? "Acompanhe todos os PIs, faturamento mensal e desempenho dos perfis Gestão Executiva e Governo Estadual."
              : "Acompanhe suas vendas, faturamento mensal, desempenho e PIs vinculados ao seu nome."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/executivo-carteira")}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Ver carteira
            </button>

            <button
              type="button"
              onClick={() => navigate("/busca-pi")}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
            >
              Buscar PI
            </button>
          </div>
        </div>
      </section>

      {visaoGrupoEstadual && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black text-zinc-950">
              Perfil do anunciante
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Visualize os dois perfis juntos ou separadamente.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setPerfilEstadual("todos")}
              className={`min-h-20 rounded-2xl border p-4 text-left transition ${
                perfilEstadual === "todos"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 hover:border-red-300"
              }`}
            >
              <span className="block text-sm font-black">Todos</span>
              <small className="mt-1 block font-semibold text-zinc-500">
                {resumoPerfisEstaduais["gestao-executiva"] +
                  resumoPerfisEstaduais["governo-estadual"]}{" "}
                PIs nos dois perfis
              </small>
            </button>

            <button
              type="button"
              onClick={() => setPerfilEstadual("gestao-executiva")}
              className={`min-h-20 rounded-2xl border p-4 text-left transition ${
                perfilEstadual === "gestao-executiva"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 hover:border-red-300"
              }`}
            >
              <span className="block text-sm font-black">
                Gestão Executiva
              </span>
              <small className="mt-1 block font-semibold text-zinc-500">
                {resumoPerfisEstaduais["gestao-executiva"]} PIs
              </small>
            </button>

            <button
              type="button"
              onClick={() => setPerfilEstadual("governo-estadual")}
              className={`min-h-20 rounded-2xl border p-4 text-left transition ${
                perfilEstadual === "governo-estadual"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-zinc-200 hover:border-red-300"
              }`}
            >
              <span className="block text-sm font-black">
                Governo Estadual
              </span>
              <small className="mt-1 block font-semibold text-zinc-500">
                {resumoPerfisEstaduais["governo-estadual"]} PIs
              </small>
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
          placeholder="Pesquisar por ano, mês, PI, anunciante ou agência..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando dados...
        </div>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-red-600 p-6 text-white shadow-sm">
              <span className="text-sm font-medium text-red-100">
                Total líquido
              </span>

              <strong className="mt-3 block break-words text-3xl font-black leading-tight md:text-4xl">
                {money(totalLiquido)}
              </strong>

              <small className="mt-3 block text-sm text-red-100">
                Receita líquida filtrada
              </small>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <span className="text-sm font-medium text-zinc-500">
                Total bruto
              </span>

              <strong className="mt-3 block break-words text-3xl font-black leading-tight text-zinc-950 md:text-4xl">
                {money(totalBruto)}
              </strong>

              <small className="mt-3 block text-sm text-zinc-400">
                Receita bruta filtrada
              </small>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => navigate("/busca-pi")}
              className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <span className="text-sm text-zinc-500">Total de PIs</span>

              <strong className="mt-2 block text-2xl font-black">
                {totalPIs}
              </strong>

              <small className="text-zinc-400">Clique para abrir</small>
            </button>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Ticket médio</span>

              <strong className="mt-2 block break-words text-xl font-black leading-tight">
                {money(ticketMedio)}
              </strong>

              <small className="text-zinc-400">Média por PI</small>
            </div>

            <button
              type="button"
              onClick={() => navigate("/executivo-carteira")}
              className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <span className="text-sm text-zinc-500">Anunciantes</span>

              <strong className="mt-2 block text-2xl font-black">
                {anunciantes}
              </strong>

              <small className="text-zinc-400">Ver carteira</small>
            </button>

            <button
              type="button"
              onClick={() => navigate("/executivo-carteira")}
              className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <span className="text-sm text-zinc-500">Agências</span>

              <strong className="mt-2 block text-2xl font-black">
                {agencias}
              </strong>

              <small className="text-zinc-400">Sem considerar direto</small>
            </button>
          </section>

          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-zinc-200 p-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-black">
                  {visaoGrupoEstadual
                    ? "Mapa dos perfis estaduais"
                    : "Mapa da minha carteira"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Valores por UF considerando apenas os PIs vinculados a {escopoLabel}.
                </p>
              </div>

              <div className="flex rounded-2xl bg-zinc-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setBaseMapa("cliente")
                    setUfMapaSelecionada("")
                  }}
                  className={`h-10 flex-1 rounded-xl px-4 text-xs font-black transition sm:flex-none ${
                    baseMapa === "cliente"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-white"
                  }`}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBaseMapa("agencia")
                    setUfMapaSelecionada("")
                  }}
                  className={`h-10 flex-1 rounded-xl px-4 text-xs font-black transition sm:flex-none ${
                    baseMapa === "agencia"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-white"
                  }`}
                >
                  Agência
                </button>
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="relative min-h-[440px] bg-zinc-50 p-3 sm:p-5">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    center: [-54, -15],
                    scale: 700,
                  }}
                  className="h-[430px] w-full sm:h-[520px]"
                >
                  <Geographies geography={MAPA_BRASIL_GEO_URL}>
                    {({ geographies }: { geographies: GeographyItem[] }) =>
                      geographies.map((geo) => {
                        const uf = getUfFromGeography(geo.properties)
                        const resumo = mapaPorUf.get(uf)
                        const selecionado = ufMapaSelecionada === uf

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(event) => {
                              setMapaTooltip({
                                uf,
                                x: event.clientX,
                                y: event.clientY,
                              })
                            }}
                            onMouseMove={(event) => {
                              setMapaTooltip((atual) =>
                                atual
                                  ? {
                                      ...atual,
                                      x: event.clientX,
                                      y: event.clientY,
                                    }
                                  : null
                              )
                            }}
                            onMouseLeave={() => setMapaTooltip(null)}
                            onClick={() => setUfMapaSelecionada(uf)}
                            style={{
                              default: {
                                fill: resumo
                                  ? corMapaUf(resumo.liquido)
                                  : "#f4f4f5",
                                stroke: selecionado ? "#18181b" : "#ffffff",
                                strokeWidth: selecionado ? 1.5 : 0.7,
                                outline: "none",
                              },
                              hover: {
                                fill: resumo ? "#b91c1c" : "#e4e4e7",
                                stroke: "#18181b",
                                strokeWidth: 1,
                                cursor: "pointer",
                                outline: "none",
                              },
                              pressed: {
                                fill: "#991b1b",
                                outline: "none",
                              },
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ComposableMap>

                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-sm sm:left-auto sm:w-72">
                  <span className="text-xs font-black text-zinc-500">Menor</span>
                  <div className="h-3 flex-1 rounded-full bg-gradient-to-r from-red-100 to-red-600" />
                  <span className="text-xs font-black text-zinc-500">Maior</span>
                </div>
              </div>

              <aside className="border-t border-zinc-200 p-4 sm:p-5 xl:border-l xl:border-t-0">
                <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3">
                  <span className="text-[10px] font-black uppercase text-red-700">
                    {ufMapaSelecionada ? "Selecionada" : "Maior UF"}
                  </span>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <strong className="text-lg font-black text-zinc-950">
                      {ufResumoSelecionado?.uf || "--"}
                    </strong>
                    <b className="max-w-[160px] break-words text-right text-xs text-zinc-950">
                      {money(ufResumoSelecionado?.liquido || 0)}
                    </b>
                  </div>
                  <small className="text-zinc-500">
                    {ufResumoSelecionado?.pis || 0} PIs
                  </small>
                </div>

                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-zinc-950">Top UFs</h3>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black text-zinc-500">
                    Top {Math.min(rankingMapaUf.length, 6)}
                  </span>
                </div>

                <div className="space-y-2">
                  {rankingMapaUf.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-sm font-semibold text-zinc-500">
                      Nenhuma UF encontrada.
                    </div>
                  ) : (
                    rankingMapaUf.slice(0, 6).map((item, index) => (
                      <button
                        type="button"
                        key={item.uf}
                        onClick={() => setUfMapaSelecionada(item.uf)}
                        className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                          ufMapaSelecionada === item.uf
                            ? "border-red-300 bg-red-50"
                            : "border-zinc-100 hover:border-red-200 hover:bg-red-50"
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-black text-red-600">
                            #{index + 1}
                          </span>
                          <strong className="block text-sm font-black text-zinc-950">
                            {item.uf}
                          </strong>
                        </div>
                        <div className="min-w-0 text-right">
                          <b className="block max-w-[150px] break-words text-xs text-zinc-950">
                            {money(item.liquido)}
                          </b>
                          <small className="text-zinc-400">{item.pis} PIs</small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </aside>
            </div>
          </section>

          {temMeta && (
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">
                    Meta no período cadastrado
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Comparação a partir de{" "}
                    <strong className="text-zinc-800">
                      {primeiroMesComMeta?.mes}
                    </strong>
                    : {money(realizadoPeriodoMeta)} realizado de{" "}
                    {money(metaTotal)}.
                  </p>
                </div>

                <strong
                  className={`text-2xl font-black ${statusGeral.className}`}
                >
                  {percentualMeta.toFixed(1)}% • {statusGeral.label}
                </strong>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${statusGeral.bar}`}
                  style={{
                    width: `${Math.min(percentualMeta, 100)}%`,
                  }}
                />
              </div>
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Faturamento por ano</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Clique em um ano para visualizar os meses em ordem.
                  </p>
                </div>

                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                  {faturamentoPorAno.length} anos
                </span>
              </div>

              <div className="space-y-4">
                {faturamentoPorAno.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                    Nenhum faturamento encontrado.
                  </div>
                ) : (
                  faturamentoPorAno.map((ano) => {
                    const percent =
                      ano.meta > 0 ? (ano.total / ano.meta) * 100 : 0
                    const status = statusMeta(percent)
                    const aberto = anoAberto === ano.ano

                    return (
                      <div
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                        key={ano.ano}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 text-left"
                          onClick={() => alternarAno(ano.ano)}
                        >
                          <div>
                            <strong className="text-2xl font-black">
                              {ano.ano}
                            </strong>
                            <span className="ml-3 text-sm text-zinc-500">
                              {ano.quantidade} PIs
                            </span>
                          </div>

                          <div className="text-right">
                            <b className="block text-lg font-black">
                              {money(ano.total)}
                            </b>

                            {ano.meta > 0 && (
                              <small
                                className={`font-bold ${status.className}`}
                              >
                                {percent.toFixed(1)}% • {status.label}
                              </small>
                            )}
                          </div>
                        </button>

                        {ano.meta > 0 && (
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                            <div
                              className={`h-full rounded-full ${status.bar}`}
                              style={{
                                width: `${Math.min(percent, 100)}%`,
                              }}
                            />
                          </div>
                        )}

                        {aberto && (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {ano.meses
                              .sort((a, b) => a.mesNumero - b.mesNumero)
                              .map((item) => {
                                const monthPercent =
                                  item.meta > 0
                                    ? (item.total / item.meta) * 100
                                    : 0

                                const monthStatus = statusMeta(monthPercent)

                                return (
                                  <button
                                    type="button"
                                    className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-red-300 hover:shadow-sm"
                                    key={item.mes}
                                    onClick={() => abrirMes(item.mes)}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <strong className="block text-lg font-black">
                                          {item.mes}
                                        </strong>
                                        <span className="text-sm text-zinc-500">
                                          {item.quantidade} PIs
                                        </span>
                                      </div>

                                      <b className="text-sm font-black">
                                        {money(item.total)}
                                      </b>
                                    </div>

                                    {item.meta > 0 && (
                                      <>
                                        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                                          <span className="text-zinc-500">
                                            Meta: {money(item.meta)}
                                          </span>

                                          <span
                                            className={`font-bold ${monthStatus.className}`}
                                          >
                                            {monthPercent.toFixed(1)}% •{" "}
                                            {monthStatus.label}
                                          </span>
                                        </div>

                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                                          <div
                                            className={`h-full rounded-full ${monthStatus.bar}`}
                                            style={{
                                              width: `${Math.min(
                                                monthPercent,
                                                100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      </>
                                    )}
                                  </button>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <button
                type="button"
                onClick={() => navigate("/executivo-carteira")}
                className="w-full rounded-3xl bg-zinc-950 p-5 text-left text-white shadow-sm transition hover:bg-red-600"
              >
                <span className="text-sm text-zinc-300">
                  Anunciantes / Agências
                </span>

                <strong className="mt-2 block text-3xl font-black">
                  {anunciantes} / {agencias}
                </strong>

                <p className="mt-2 text-sm text-zinc-300">
                  Sem considerar agência direta.
                </p>
              </button>

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <span className="text-sm text-zinc-500">Melhor ano</span>

                <strong className="mt-2 block text-3xl font-black">
                  {melhorAno?.ano || "-"}
                </strong>

                <p className="mt-2 text-sm text-zinc-500">
                  {melhorAno ? money(melhorAno.total) : "Sem dados"}
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <span className="text-sm text-zinc-500">Melhor mês</span>

                <strong className="mt-2 block text-3xl font-black">
                  {melhorMes?.mes || "-"}
                </strong>

                <p className="mt-2 text-sm text-zinc-500">
                  {melhorMes ? money(melhorMes.total) : "Sem dados"}
                </p>
              </div>
            </aside>
          </section>
        </>
      )}

      {mapaTooltip && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-xl"
          style={{
            left: Math.min(mapaTooltip.x + 14, window.innerWidth - 240),
            top: Math.max(mapaTooltip.y - 28, 12),
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-zinc-400">
                Estado
              </span>
              <strong className="block text-xl font-black text-zinc-950">
                {mapaTooltip.uf || "--"}
              </strong>
            </div>
            <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">
              {baseMapa === "cliente" ? "Cliente" : "Agência"}
            </span>
          </div>

          <div className="mt-3 space-y-1 text-xs font-semibold text-zinc-600">
            <div className="flex justify-between gap-3">
              <span>Líquido</span>
              <b className="text-right text-zinc-950">
                {money(ufResumoTooltip?.liquido || 0)}
              </b>
            </div>
            <div className="flex justify-between gap-3">
              <span>Bruto</span>
              <b className="text-right text-zinc-950">
                {money(ufResumoTooltip?.bruto || 0)}
              </b>
            </div>
            <div className="flex justify-between gap-3">
              <span>PIs</span>
              <b className="text-zinc-950">{ufResumoTooltip?.pis || 0}</b>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
