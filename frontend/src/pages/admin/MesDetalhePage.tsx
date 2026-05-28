// ========================================
// src/pages/admin/MesDetalhePage.tsx
// ========================================

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { getPisCached } from "../../services/api"

type Pi = {
  pi_matriz?: string
  numero_pi: string
  anunciante: string
  razao_social_anunciante?: string
  codinome?: string
  cnpj_anunciante?: string
  uf_cliente?: string
  executivo: string
  diretoria?: string
  grupo?: string
  campanha?: string
  agencia?: string
  razao_social_agencia?: string
  cnpj_agencia?: string
  uf_agencia?: string
  data_inicial_veiculacao?: string
  data_final_veiculacao?: string
  mes_venda: string
  mes_inicial_veiculacao?: string
  canal?: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  produto?: string
  valor_bruto: number
  valor_liquido: number
  vencimento?: string
  data_venda?: string
  data_emissao_recebimento_pi?: string
  observacoes?: string
}

type AreaTipo =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

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

function classificarArea(item: Pi): AreaTipo {
  const perfil = normalizar(item.perfil_anunciante)
  const sub = normalizar(item.sub_perfil_anunciante)
  const executivo = normalizar(item.executivo)
  const grupo = normalizar(item.grupo)

  if (
    grupo === "federal" ||
    perfil.includes("federal") ||
    sub.includes("federal")
  ) {
    return "federal"
  }

  if (
    executivo.includes("gestao executiva") ||
    sub.includes("gestao executiva")
  ) {
    return "gestao-executiva"
  }

  if (sub.includes("gdf") || sub.includes("cldf")) {
    return "gdf"
  }

  if (grupo === "estadual" || perfil.includes("estadual")) {
    return "estadual"
  }

  return "privado"
}

function getDiretoria(item: Pi) {
  return (
    item.diretoria ||
    item.grupo ||
    item.perfil_anunciante ||
    "Não informado"
  )
}

function nomeArea(area?: string) {
  const nomes: Record<string, string> = {
    privado: "Comercial Privado",
    "gestao-executiva": "Gestão Executiva",
    estadual: "Comercial Estadual",
    federal: "Comercial Federal",
    gdf: "GDF / CLDF",
  }

  return area ? nomes[area] || area : ""
}

export default function MesDetalhePage() {
  const { mes } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const areaSelecionadaUrl = searchParams.get("area") || ""

  const [dados, setDados] = useState<Pi[]>([])
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)
  const [diretoriaSelecionada, setDiretoriaSelecionada] = useState("")

  async function carregarDados() {
    try {
      const dadosCache = await getPisCached()

      setDados(Array.isArray(dadosCache) ? (dadosCache as Pi[]) : [])
    } catch (error) {
      console.error(error)
      setDados([])
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const mesFormatado = String(mes || "").replace("-", "/")

  const diretorias = useMemo(() => {
    return Array.from(
      new Set(
        dados
          .filter((item) => {
            const bateMes = item.mes_venda === mesFormatado

            const bateArea =
              !areaSelecionadaUrl ||
              classificarArea(item) === areaSelecionadaUrl

            return bateMes && bateArea
          })
          .map((item) => item.diretoria)
          .filter(Boolean)
      )
    ).sort() as string[]
  }, [dados, mesFormatado, areaSelecionadaUrl])

  const dadosMes = useMemo(() => {
    return dados.filter((item) => {
      const bateMes = item.mes_venda === mesFormatado

      const bateDiretoria =
        !diretoriaSelecionada ||
        item.diretoria === diretoriaSelecionada

      const bateArea =
        !areaSelecionadaUrl ||
        classificarArea(item) === areaSelecionadaUrl

      return bateMes && bateDiretoria && bateArea
    })
  }, [
    dados,
    mesFormatado,
    diretoriaSelecionada,
    areaSelecionadaUrl,
  ])

  const totalLiquido = dadosMes.reduce(
    (acc, item) => acc + Number(item.valor_liquido || 0),
    0
  )

  const totalBruto = dadosMes.reduce(
    (acc, item) => acc + Number(item.valor_bruto || 0),
    0
  )

  function selecionarPi(item: Pi) {
    setPiSelecionado(item)

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

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

        <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
          {areaSelecionadaUrl
            ? nomeArea(areaSelecionadaUrl)
            : "Todas as áreas"}
        </span>

        <h1 className="mt-4 text-4xl font-black">
          Mês {mesFormatado}
        </h1>

        <p className="mt-2 text-zinc-300">
          Consolidado completo do mês.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Líquido"
          value={money(totalLiquido)}
        />

        <KpiCard
          label="Bruto"
          value={money(totalBruto)}
        />

        <KpiCard
          label="PIs"
          value={String(dadosMes.length)}
        />
      </section>

      {!areaSelecionadaUrl && (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={diretoriaSelecionada}
              onChange={(event) =>
                setDiretoriaSelecionada(event.target.value)
              }
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            >
              <option value="">
                Todas as diretorias
              </option>

              {diretorias.map((diretoria) => (
                <option
                  key={diretoria}
                  value={diretoria}
                >
                  {diretoria}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setDiretoriaSelecionada("")
              }
              className="h-12 rounded-2xl border border-zinc-200 px-5 text-sm font-black text-zinc-700 transition hover:border-red-500 hover:bg-red-50 hover:text-red-700"
            >
              Limpar filtro
            </button>
          </div>
        </section>
      )}

      {piSelecionado && (
        <section className="rounded-[2rem] border border-red-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                PI selecionado
              </span>

              <h2 className="mt-3 text-3xl font-black text-zinc-950">
                PI {piSelecionado.numero_pi}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Informações completas do PI.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setPiSelecionado(null)
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              Fechar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              label="PI Matriz"
              value={piSelecionado.pi_matriz}
            />

            <InfoCard
              label="Número PI"
              value={piSelecionado.numero_pi}
            />

            <InfoCard
              label="Executivo"
              value={piSelecionado.executivo}
            />

            <InfoCard
              label="Diretoria"
              value={piSelecionado.diretoria}
            />

            <InfoCard
              label="Grupo"
              value={piSelecionado.grupo}
            />

            <InfoCard
              label="Anunciante"
              value={piSelecionado.anunciante}
            />

            <InfoCard
              label="Razão Social Anunciante"
              value={
                piSelecionado.razao_social_anunciante
              }
            />

            <InfoCard
              label="Codinome"
              value={piSelecionado.codinome}
            />

            <InfoCard
              label="CNPJ Anunciante"
              value={piSelecionado.cnpj_anunciante}
            />

            <InfoCard
              label="UF Cliente"
              value={piSelecionado.uf_cliente}
            />

            <InfoCard
              label="Campanha"
              value={piSelecionado.campanha}
            />

            <InfoCard
              label="Agência"
              value={piSelecionado.agencia}
            />

            <InfoCard
              label="Razão Social Agência"
              value={
                piSelecionado.razao_social_agencia
              }
            />

            <InfoCard
              label="CNPJ Agência"
              value={piSelecionado.cnpj_agencia}
            />

            <InfoCard
              label="UF Agência"
              value={piSelecionado.uf_agencia}
            />

            <InfoCard
              label="Data Inicial Veiculação"
              value={
                piSelecionado.data_inicial_veiculacao
              }
            />

            <InfoCard
              label="Data Final Veiculação"
              value={
                piSelecionado.data_final_veiculacao
              }
            />

            <InfoCard
              label="Mês Venda"
              value={piSelecionado.mes_venda}
            />

            <InfoCard
              label="Mês Inicial Veiculação"
              value={
                piSelecionado.mes_inicial_veiculacao
              }
            />

            <InfoCard
              label="Canal"
              value={piSelecionado.canal}
            />

            <InfoCard
              label="Perfil Anunciante"
              value={
                piSelecionado.perfil_anunciante
              }
            />

            <InfoCard
              label="Sub Perfil Anunciante"
              value={
                piSelecionado.sub_perfil_anunciante
              }
            />

            <InfoCard
              label="Produto"
              value={piSelecionado.produto}
            />

            <InfoCard
              label="Valor Bruto"
              value={money(piSelecionado.valor_bruto)}
            />

            <InfoCard
              label="Valor Líquido"
              value={money(
                piSelecionado.valor_liquido
              )}
            />

            <InfoCard
              label="Vencimento"
              value={piSelecionado.vencimento}
            />

            <InfoCard
              label="Data Venda"
              value={piSelecionado.data_venda}
            />

            <InfoCard
              label="Data Emissão/Recebimento PI"
              value={
                piSelecionado.data_emissao_recebimento_pi
              }
            />
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
              Observações
            </span>

            <p className="mt-2 text-sm text-zinc-700">
              {piSelecionado.observacoes ||
                "Sem observações"}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-5 text-xl font-black">
          PIs do mês
        </h2>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-4 py-3">PI</th>
                <th className="px-4 py-3">
                  Executivo
                </th>
                <th className="px-4 py-3">
                  Diretoria
                </th>
                <th className="px-4 py-3">
                  Anunciante
                </th>
                <th className="px-4 py-3">
                  Agência
                </th>
                <th className="px-4 py-3">
                  Líquido
                </th>
                <th className="px-4 py-3">
                  Bruto
                </th>
              </tr>
            </thead>

            <tbody>
              {dadosMes.map((item, index) => (
                <tr
                  key={`${item.numero_pi}-${index}`}
                  onClick={() =>
                    selecionarPi(item)
                  }
                  className="cursor-pointer border-b border-zinc-100 transition hover:bg-red-50"
                >
                  <td className="px-4 py-3">
                    <span className="font-black text-red-600">
                      {item.numero_pi}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {item.executivo}
                  </td>

                  <td className="px-4 py-3 font-semibold text-zinc-700">
                    {getDiretoria(item)}
                  </td>

                  <td className="px-4 py-3">
                    {item.anunciante}
                  </td>

                  <td className="px-4 py-3">
                    {item.agencia || "-"}
                  </td>

                  <td className="px-4 py-3 font-black">
                    {money(item.valor_liquido)}
                  </td>

                  <td className="px-4 py-3 font-black">
                    {money(item.valor_bruto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function KpiCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <span className="text-sm font-bold text-zinc-500">
        {label}
      </span>

      <strong className="mt-2 block break-words text-2xl font-black">
        {value}
      </strong>
    </div>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <span className="block text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </span>

      <strong className="mt-1 block break-words text-sm font-black text-zinc-950">
        {value || "-"}
      </strong>
    </div>
  )
}