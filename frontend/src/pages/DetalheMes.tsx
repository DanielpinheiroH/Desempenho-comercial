import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api, getToken } from "../services/api"

type Pi = {
  [key: string]: string | number | null | undefined
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  mes_venda: string
  campanha?: string
  valor_bruto: number
  valor_liquido: number
}

type Meta = {
  executivo: string
  mes: string
  meta: number
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

function labelCampo(key: string) {
  const labels: Record<string, string> = {
    numero_pi: "PI",
    executivo: "Executivo",
    anunciante: "Anunciante",
    agencia: "Agência",
    grupo: "Grupo",
    mes_venda: "Mês da venda",
    campanha: "Campanha",
    valor_bruto: "Valor bruto",
    valor_liquido: "Valor líquido",
  }

  return labels[key] || key.replaceAll("_", " ")
}

function valorCampo(key: string, value: string | number | null | undefined) {
  if (key.includes("valor")) {
    return money(Number(value || 0))
  }

  return String(value || "-")
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

export default function DetalheMes() {
  const navigate = useNavigate()
  const params = useParams()

  const mesUrl = decodeURIComponent(params.mes || "").replace("-", "/")

  const [dados, setDados] = useState<Pi[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)

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

  const pisDoMes = useMemo(() => {
    return dados.filter((item) => item.mes_venda === mesUrl)
  }, [dados, mesUrl])

  const pisFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return pisDoMes

    return pisDoMes.filter((item) =>
      normalizar(
        [
          item.numero_pi,
          item.executivo,
          item.anunciante,
          item.agencia,
          item.campanha,
          item.grupo,
        ].join(" ")
      ).includes(termo)
    )
  }, [pisDoMes, busca])

  const executivoDoMes = pisDoMes[0]?.executivo || ""

  const totalLiquido = pisFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = pisFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  const anunciantes = new Set(
    pisFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const agencias = new Set(
    pisFiltrados.map((item) => item.agencia).filter(Boolean)
  ).size

  const metaMensal = metas
    .filter(
      (meta) =>
        meta.mes === mesUrl &&
        normalizar(meta.executivo) === normalizar(executivoDoMes)
    )
    .reduce((acc, meta) => acc + Number(meta.meta || 0), 0)

  const percentualMeta =
    metaMensal > 0 ? (totalLiquido / metaMensal) * 100 : 0

  const status = statusMeta(percentualMeta)

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
        >
          ← Voltar
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
              Detalhamento mensal
            </span>

            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              PIs de {mesUrl}
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Meta mensal filtrada por mês e executivo:{" "}
              <strong className="text-zinc-800">
                {executivoDoMes || "Executivo não identificado"}
              </strong>
              .
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-950 p-5 text-white">
            <span className="text-sm text-zinc-400">
              {metaMensal > 0 ? "Atingimento da meta" : "Total líquido"}
            </span>

            <strong className="mt-2 block text-3xl font-black">
              {metaMensal > 0
                ? `${percentualMeta.toFixed(1)}%`
                : money(totalLiquido)}
            </strong>

            <small className="mt-1 block text-zinc-400">
              {metaMensal > 0
                ? `${money(totalLiquido)} realizado de ${money(metaMensal)}`
                : `${pisFiltrados.length} PIs encontrados`}
            </small>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-red-600 p-5 text-white shadow-sm">
          <span className="text-sm text-red-100">Total líquido</span>
          <strong className="mt-2 block text-2xl font-black">
            {money(totalLiquido)}
          </strong>
          <small className="text-red-100">Receita líquida do mês</small>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-zinc-500">Meta mensal</span>
          <strong className="mt-2 block text-2xl font-black">
            {money(metaMensal)}
          </strong>
          <small className="text-zinc-400">
            {executivoDoMes || "Sem executivo no mês"}
          </small>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-zinc-500">Total bruto</span>
          <strong className="mt-2 block text-2xl font-black">
            {money(totalBruto)}
          </strong>
          <small className="text-zinc-400">Receita bruta do mês</small>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-zinc-500">Anunciantes</span>
          <strong className="mt-2 block text-2xl font-black">
            {anunciantes}
          </strong>
          <small className="text-zinc-400">Clientes únicos</small>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-zinc-500">Agências</span>
          <strong className="mt-2 block text-2xl font-black">
            {agencias}
          </strong>
          <small className="text-zinc-400">Agências únicas</small>
        </div>
      </section>

      {metaMensal > 0 && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-zinc-950">
                Atingimento da meta mensal
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {money(totalLiquido)} realizado de {money(metaMensal)} para{" "}
                <strong>{executivoDoMes}</strong>.
              </p>
            </div>

            <strong className={`text-2xl font-black ${status.className}`}>
              {percentualMeta.toFixed(1)}% • {status.label}
            </strong>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${status.bar}`}
              style={{
                width: `${Math.min(percentualMeta, 100)}%`,
              }}
            />
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
          placeholder="Buscar PI, executivo, anunciante, agência, campanha..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando PIs...
        </div>
      ) : (
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-zinc-950">
                PIs encontrados
              </h2>

              <p className="text-sm text-zinc-500">
                {pisFiltrados.length} registros no mês {mesUrl}.
              </p>
            </div>

            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
              >
                Limpar busca
              </button>
            )}
          </div>

          {pisFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
              <strong className="block text-zinc-950">
                Nenhum PI encontrado
              </strong>

              <p className="mt-2 text-sm text-zinc-500">
                Tente limpar a busca ou conferir o mês selecionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="px-3 py-3">PI</th>
                    <th className="px-3 py-3">Executivo</th>
                    <th className="px-3 py-3">Anunciante</th>
                    <th className="px-3 py-3">Agência</th>
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3">Grupo</th>
                    <th className="px-3 py-3 text-right">Valor líquido</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {pisFiltrados.map((pi, index) => (
                    <tr
                      key={`${pi.numero_pi}-${index}`}
                      className="cursor-pointer text-sm transition hover:bg-zinc-50"
                      onClick={() => setPiSelecionado(pi)}
                    >
                      <td className="px-3 py-4 font-black text-zinc-950">
                        {pi.numero_pi || "-"}
                      </td>

                      <td className="px-3 py-4 text-zinc-600">
                        {pi.executivo || "-"}
                      </td>

                      <td className="px-3 py-4 font-semibold text-zinc-800">
                        {pi.anunciante || "-"}
                      </td>

                      <td className="px-3 py-4 text-zinc-600">
                        {pi.agencia || "-"}
                      </td>

                      <td className="px-3 py-4 text-zinc-600">
                        {pi.campanha || "-"}
                      </td>

                      <td className="px-3 py-4 text-zinc-600">
                        {pi.grupo || "-"}
                      </td>

                      <td className="px-3 py-4 text-right font-black text-zinc-950">
                        {money(Number(pi.valor_liquido || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {piSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPiSelecionado(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-6">
              <div>
                <span className="mb-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
                  Detalhes do PI
                </span>

                <h2 className="text-2xl font-black text-zinc-950">
                  PI {piSelecionado.numero_pi}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {piSelecionado.anunciante || "-"} •{" "}
                  {piSelecionado.mes_venda || "-"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPiSelecionado(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-red-500 hover:text-red-600"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(piSelecionado).map(([key, value]) => (
                  <div
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                    key={key}
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">
                      {labelCampo(key)}
                    </span>

                    <strong className="mt-2 block break-words text-sm text-zinc-950">
                      {valorCampo(key, value)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}