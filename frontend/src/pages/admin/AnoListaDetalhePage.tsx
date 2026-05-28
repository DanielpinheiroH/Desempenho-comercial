import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { getPisCached } from "../../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  campanha?: string
  produto?: string
  canal?: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getAno(mes?: string) {
  return String(mes || "").split("/")[1]
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isAgenciaDireta(value?: string | null) {
  const agencia = normalizar(value)

  return (
    agencia === "agencia direta" ||
    agencia === "agencia direto" ||
    agencia === "direto" ||
    agencia === "direta" ||
    agencia.includes("agencia direta")
  )
}

export default function AnoListaDetalhePage() {
  const { ano, tipo } = useParams()
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)

  async function carregarDados() {
    try {
      setLoading(true)

      const dadosCache = await getPisCached()

      setDados(Array.isArray(dadosCache) ? (dadosCache as Pi[]) : [])
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

  const dadosAno = useMemo(() => {
    const termo = normalizar(busca)

    return dados
      .filter((item) => getAno(item.mes_venda) === ano)
      .filter((item) => {
        if (tipo === "agencias" && isAgenciaDireta(item.agencia)) {
          return false
        }

        const texto = normalizar(
          [
            item.numero_pi,
            item.executivo,
            item.anunciante,
            item.agencia,
            item.campanha,
            item.produto,
            item.canal,
            item.mes_venda,
          ].join(" ")
        )

        return !termo || texto.includes(termo)
      })
  }, [dados, ano, busca, tipo])

  const titulo =
    tipo === "anunciantes"
      ? "Anunciantes"
      : tipo === "agencias"
      ? "Agências"
      : "PIs"

  const agrupado = useMemo(() => {
    if (tipo === "pis") return []

    const campo = tipo === "agencias" ? "agencia" : "anunciante"

    const mapa = new Map<
      string,
      {
        nome: string
        pis: number
        liquido: number
        bruto: number
      }
    >()

    dadosAno.forEach((item) => {
      const nome = String(item[campo] || "Não informado")

      const atual = mapa.get(nome) || {
        nome,
        pis: 0,
        liquido: 0,
        bruto: 0,
      }

      atual.pis += 1
      atual.liquido += Number(item.valor_liquido || 0)
      atual.bruto += Number(item.valor_bruto || 0)

      mapa.set(nome, atual)
    })

    return Array.from(mapa.values()).sort((a, b) => b.liquido - a.liquido)
  }, [dadosAno, tipo])

  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 p-5 text-zinc-950">
      <section className="overflow-hidden rounded-[2rem] bg-zinc-950 shadow-sm">
        <div className="relative isolate p-6 text-white md:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-6 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            Voltar
          </button>

          <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
            Visão anual
          </span>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            {titulo} de {ano}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
            Visualização consolidada do ano selecionado.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black">Busca</h2>

          <p className="text-sm text-zinc-500">
            Pesquise por PI, executivo, anunciante, agência, campanha ou produto.
          </p>
        </div>

        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar PI, anunciante, agência, executivo..."
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-[1.5rem] border border-zinc-200 bg-white"
            />
          ))}
        </div>
      ) : tipo === "pis" ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Lista de PIs</h2>

              <p className="text-sm text-zinc-500">
                {dadosAno.length} resultados encontrados
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">PI</th>
                  <th className="px-4 py-3">Mês</th>
                  <th className="px-4 py-3">Executivo</th>
                  <th className="px-4 py-3">Anunciante</th>
                  <th className="px-4 py-3">Agência</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                </tr>
              </thead>

              <tbody>
                {dadosAno.map((item, index) => (
                  <tr
                    key={`${item.numero_pi}-${index}`}
                    className="border-b border-zinc-100 transition hover:bg-red-50"
                  >
                    <td className="px-4 py-3 font-black text-red-600">
                      {item.numero_pi}
                    </td>

                    <td className="px-4 py-3">{item.mes_venda}</td>

                    <td className="px-4 py-3">{item.executivo}</td>

                    <td className="px-4 py-3">{item.anunciante}</td>

                    <td className="px-4 py-3">{item.agencia}</td>

                    <td className="px-4 py-3 text-right font-black">
                      {money(item.valor_liquido)}
                    </td>

                    <td className="px-4 py-3 text-right font-black">
                      {money(item.valor_bruto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">{titulo}</h2>

              <p className="text-sm text-zinc-500">
                {agrupado.length} registros encontrados
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {agrupado.map((item, index) => (
              <div
                key={item.nome}
                className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5 transition hover:border-red-300 hover:bg-white hover:shadow-sm md:flex-row md:items-center"
              >
                <div className="min-w-0">
                  <span className="text-xs font-black text-red-600">
                    #{index + 1}
                  </span>

                  <strong className="mt-1 block break-words text-lg font-black text-zinc-950">
                    {item.nome}
                  </strong>

                  <small className="text-zinc-500">
                    {item.pis} PIs
                  </small>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Líquido
                    </span>

                    <strong className="mt-1 block text-sm font-black text-zinc-950">
                      {money(item.liquido)}
                    </strong>
                  </div>

                  <div className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Bruto
                    </span>

                    <strong className="mt-1 block text-sm font-black text-zinc-700">
                      {money(item.bruto)}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}