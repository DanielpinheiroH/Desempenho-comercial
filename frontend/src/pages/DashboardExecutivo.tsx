import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, getToken, getUser } from "../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
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

  const [dados, setDados] = useState<Pi[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)
  const [anoAberto, setAnoAberto] = useState<string | null>(null)

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

  const dadosDoExecutivo = useMemo(() => {
    const executivoNorm = normalizar(executivoAtual)

    return dados.filter(
      (item) => normalizar(item.executivo) === executivoNorm
    )
  }, [dados, executivoAtual])

  const metasDoExecutivo = useMemo(() => {
    const executivoNorm = normalizar(executivoAtual)

    return metas.filter(
      (item) => normalizar(item.executivo) === executivoNorm
    )
  }, [metas, executivoAtual])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return dadosDoExecutivo

    return dadosDoExecutivo.filter((item) =>
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
  }, [dadosDoExecutivo, busca])

  function metaDoMes(mes: string) {
    return metasDoExecutivo
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
  }, [dadosFiltrados, metasDoExecutivo])

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
            Meu perfil comercial
          </span>

          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Olá, {user?.nome || "Executivo"}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Acompanhe suas vendas, faturamento mensal, desempenho e PIs
            vinculados ao seu nome.
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
    </main>
  )
}