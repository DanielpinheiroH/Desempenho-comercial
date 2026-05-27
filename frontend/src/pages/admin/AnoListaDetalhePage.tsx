import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api, getToken } from "../../services/api"

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

export default function AnoListaDetalhePage() {
  const { ano, tipo } = useParams()
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [busca, setBusca] = useState("")

  async function carregarDados() {
    try {
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
  }, [dados, ano, busca])

  const titulo =
    tipo === "anunciantes"
      ? "Anunciantes"
      : tipo === "agencias"
      ? "Agências"
      : "PIs"

  const agrupado = useMemo(() => {
    if (tipo === "pis") return []

    const campo = tipo === "agencias" ? "agencia" : "anunciante"
    const mapa = new Map<string, { nome: string; pis: number; liquido: number; bruto: number }>()

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
    <main className="min-h-screen space-y-6 bg-zinc-100 p-5">
      <section className="rounded-[2rem] bg-zinc-950 p-8 text-white">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
        >
          Voltar
        </button>

        <h1 className="text-4xl font-black">
          {titulo} de {ano}
        </h1>

        <p className="mt-2 text-zinc-300">
          Visualização geral do ano.
        </p>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar PI, anunciante, agência, executivo..."
          className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />
      </section>

      {tipo === "pis" ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-xl font-black">Lista de PIs</h2>

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
                  <tr key={`${item.numero_pi}-${index}`} className="border-b border-zinc-100">
                    <td className="px-4 py-3 font-black text-red-600">{item.numero_pi}</td>
                    <td className="px-4 py-3">{item.mes_venda}</td>
                    <td className="px-4 py-3">{item.executivo}</td>
                    <td className="px-4 py-3">{item.anunciante}</td>
                    <td className="px-4 py-3">{item.agencia}</td>
                    <td className="px-4 py-3 text-right font-black">{money(item.valor_liquido)}</td>
                    <td className="px-4 py-3 text-right font-black">{money(item.valor_bruto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-xl font-black">{titulo}</h2>

          <div className="space-y-3">
            {agrupado.map((item, index) => (
              <div
                key={item.nome}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:flex-row md:items-center"
              >
                <div>
                  <span className="text-xs font-black text-red-600">#{index + 1}</span>
                  <strong className="block text-sm font-black">{item.nome}</strong>
                  <small className="text-zinc-500">{item.pis} PIs</small>
                </div>

                <div className="md:text-right">
                  <b className="block text-sm font-black">{money(item.liquido)}</b>
                  <small className="text-zinc-500">Bruto: {money(item.bruto)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}