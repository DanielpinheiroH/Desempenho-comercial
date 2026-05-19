import { useEffect, useMemo, useState } from "react"

import { api, getToken } from "../services/api"

type Pi = {
  [key: string]: string | number | null | undefined
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  campanha: string
  valor_bruto?: number
  valor_liquido: number
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

function labelCampo(key: string) {
  const labels: Record<string, string> = {
    numero_pi: "PI",
    executivo: "Executivo",
    anunciante: "Anunciante",
    agencia: "Agência",
    grupo: "Grupo",
    campanha: "Campanha",
    produto: "Produto",
    canal: "Canal",
    perfil_anunciante: "Perfil do anunciante",
    sub_perfil_anunciante: "Subperfil do anunciante",
    mes_venda: "Mês da venda",
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

export default function BuscaPI() {
  const [dados, setDados] = useState<Pi[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)

  async function carregarDados() {
    try {
      setLoading(true)

      const token = getToken()

      const response = await api.get("/api/pis", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setDados(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error(error)
      setDados([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(busca)

    if (!termo) return dados

    return dados.filter((item) =>
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
  }, [dados, busca])

  const totalLiquido = dadosFiltrados.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalPIs = dadosFiltrados.length

  const anunciantes = new Set(
    dadosFiltrados.map((item) => item.anunciante).filter(Boolean)
  ).size

  const agencias = new Set(
    dadosFiltrados
      .map((item) => item.agencia)
      .filter((agencia) => isAgenciaValida(agencia))
  ).size

  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span className="mb-3 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
          Consulta comercial
        </span>

        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          Busca de PI
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Consulte PIs, campanhas, anunciantes, agências, grupos e executivos.
          Clique em um PI para visualizar todas as informações.
        </p>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-red-500"
          placeholder="Buscar PI, cliente, campanha, agência, executivo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </section>

      {loading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Carregando PIs...
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-red-600 p-5 text-white shadow-sm">
              <span className="text-sm text-red-100">Valor líquido</span>

              <strong className="mt-2 block break-words text-2xl font-black">
                {money(totalLiquido)}
              </strong>

              <small className="text-red-100">Resultado filtrado</small>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="text-sm text-zinc-500">Total de PIs</span>

              <strong className="mt-2 block text-2xl font-black">
                {totalPIs}
              </strong>

              <small className="text-zinc-400">Registros encontrados</small>
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

              <small className="text-zinc-400">Sem considerar direto</small>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-zinc-950">
                  Resultado da busca
                </h2>

                <p className="text-sm text-zinc-500">
                  {dadosFiltrados.length} PIs encontrados.
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

            {dadosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                <strong className="block text-zinc-950">
                  Nenhum PI encontrado
                </strong>

                <p className="mt-2 text-sm text-zinc-500">
                  Tente pesquisar por outro termo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
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
                    {dadosFiltrados.map((item, index) => (
                      <tr
                        key={`${item.numero_pi}-${index}`}
                        className="cursor-pointer text-sm transition hover:bg-red-50"
                        onClick={() => setPiSelecionado(item)}
                      >
                        <td className="px-3 py-4 font-black text-red-600">
                          {item.numero_pi || "-"}
                        </td>

                        <td className="px-3 py-4 text-zinc-600">
                          {item.executivo || "-"}
                        </td>

                        <td className="px-3 py-4 font-semibold text-zinc-800">
                          {item.anunciante || "-"}
                        </td>

                        <td className="px-3 py-4 text-zinc-600">
                          {item.agencia || "-"}
                        </td>

                        <td className="px-3 py-4 text-zinc-600">
                          {item.campanha || "-"}
                        </td>

                        <td className="px-3 py-4 text-zinc-600">
                          {item.grupo || "-"}
                        </td>

                        <td className="px-3 py-4 text-right font-black text-zinc-950">
                          {money(Number(item.valor_liquido || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
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
                  PI {piSelecionado.numero_pi || "-"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {piSelecionado.anunciante || "-"} •{" "}
                  {piSelecionado.executivo || "-"}
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
              <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-red-600 p-4 text-white">
                  <span className="text-xs font-bold uppercase tracking-wide text-red-100">
                    Valor líquido
                  </span>

                  <strong className="mt-2 block text-xl font-black">
                    {money(Number(piSelecionado.valor_liquido || 0))}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Valor bruto
                  </span>

                  <strong className="mt-2 block text-xl font-black text-zinc-950">
                    {money(Number(piSelecionado.valor_bruto || 0))}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Anunciante
                  </span>

                  <strong className="mt-2 block break-words text-sm font-black text-zinc-950">
                    {piSelecionado.anunciante || "-"}
                  </strong>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Agência
                  </span>

                  <strong className="mt-2 block break-words text-sm font-black text-zinc-950">
                    {piSelecionado.agencia || "-"}
                  </strong>
                </div>
              </div>

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