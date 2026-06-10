import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { api, getToken, getUser } from "../services/api"

type BaseMapa = "cliente" | "agencia"

type Pi = {
  numero_pi?: string | null
  uf_cliente?: string | null
  uf_agencia?: string | null
  valor_liquido?: number | string | null
  valor_bruto?: number | string | null
  perfil_anunciante?: string | null
  sub_perfil_anunciante?: string | null
  mes_venda?: string | null
  executivo?: string | null
  anunciante?: string | null
  agencia?: string | null
  campanha?: string | null
  produto?: string | null
  canal?: string | null
}

type RankingItem = {
  nome: string
  liquido: number
  bruto: number
  pis: number
  itens: Pi[]
}

function normalizar(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function onlyNumber(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function getAno(mes?: string | null) {
  const value = String(mes || "").trim()
  const match = value.match(/\b(20\d{2}|19\d{2})\b/)

  if (match) return match[1]

  const partes = value.split("/")
  return partes[1]?.trim() || ""
}

function getMes(mes?: string | null) {
  const value = String(mes || "").trim()
  const partes = value.split("/")

  if (partes[0] && /^\d{1,2}$/.test(partes[0])) {
    return partes[0].padStart(2, "0")
  }

  return ""
}

function getUf(item: Pi, baseMapa: BaseMapa) {
  const value = baseMapa === "cliente" ? item.uf_cliente : item.uf_agencia
  return String(value || "").trim().toUpperCase()
}

function aggregateRanking(dados: Pi[], campo: keyof Pi, limite = 12) {
  const mapa = new Map<string, RankingItem>()

  dados.forEach((item) => {
    const nome = String(item[campo] || "").trim() || "Nao informado"
    const atual = mapa.get(nome) || {
      nome,
      liquido: 0,
      bruto: 0,
      pis: 0,
      itens: [],
    }

    atual.liquido += onlyNumber(item.valor_liquido)
    atual.bruto += onlyNumber(item.valor_bruto)
    atual.pis += 1
    atual.itens.push(item)

    mapa.set(nome, atual)
  })

  return Array.from(mapa.values())
    .sort((a, b) => b.liquido - a.liquido)
    .slice(0, limite)
}

export default function MapaBrasilUfPis() {
  const navigate = useNavigate()
  const user = getUser()
  const executivoAtual = user?.executivo || user?.nome || ""
  const { uf = "" } = useParams()
  const [searchParams] = useSearchParams()
  const baseMapa: BaseMapa =
    searchParams.get("base") === "agencia" ? "agencia" : "cliente"

  const ano = searchParams.get("ano") || ""
  const mes = searchParams.get("mes") || ""
  const perfil = searchParams.get("perfil") || ""
  const subperfil = searchParams.get("subperfil") || ""
  const ufAtual = String(uf || "").toUpperCase()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
  const [piSelecionado, setPiSelecionado] = useState<Pi | null>(null)

  const dadosDoEscopo = useMemo(() => {
    if (user?.role !== "executivo") return dados

    const executivoNormalizado = normalizar(executivoAtual)
    return dados.filter(
      (item) => normalizar(item.executivo) === executivoNormalizado
    )
  }, [dados, executivoAtual, user?.role])

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true)
        setErro("")

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
        setErro("Nao foi possivel carregar os PIs desta UF.")
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const pisDaUf = useMemo(() => {
    return dadosDoEscopo
      .filter((item) => getUf(item, baseMapa) === ufAtual)
      .filter((item) => !ano || getAno(item.mes_venda) === ano)
      .filter((item) => !mes || getMes(item.mes_venda) === mes)
      .filter((item) => !perfil || item.perfil_anunciante === perfil)
      .filter((item) => !subperfil || item.sub_perfil_anunciante === subperfil)
      .sort((a, b) => onlyNumber(b.valor_liquido) - onlyNumber(a.valor_liquido))
  }, [dadosDoEscopo, baseMapa, ufAtual, ano, mes, perfil, subperfil])

  const topAnunciantes = useMemo(
    () => aggregateRanking(pisDaUf, "anunciante"),
    [pisDaUf]
  )
  const topAgencias = useMemo(
    () => aggregateRanking(pisDaUf, "agencia"),
    [pisDaUf]
  )

  const totalLiquido = pisDaUf.reduce(
    (acc, item) => acc + onlyNumber(item.valor_liquido),
    0
  )
  const totalBruto = pisDaUf.reduce(
    (acc, item) => acc + onlyNumber(item.valor_bruto),
    0
  )

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-zinc-100 p-4 text-zinc-950 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-5">
        <section className="overflow-hidden rounded-[1.5rem] bg-zinc-950 text-white shadow-sm md:rounded-[2rem]">
          <div className="p-5 sm:p-7 lg:p-8">
            <button
              type="button"
              onClick={() => navigate("/mapa-brasil")}
              className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
            >
              Voltar ao mapa
            </button>

            <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-100">
              {baseMapa === "cliente" ? "UF do cliente" : "UF da agencia"}
            </span>

            <h1 className="mt-4 break-words text-2xl font-black tracking-tight sm:text-4xl">
              PIs da UF {ufAtual || "--"}
            </h1>
            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-zinc-300 sm:text-base">
              Lista dedicada para abrir todos os PIs desta UF sem pesar a pagina principal do mapa.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="PIs" value={String(pisDaUf.length)} />
          <KpiCard label="Valor liquido" value={money(totalLiquido)} red />
          <KpiCard label="Valor bruto" value={money(totalBruto)} />
          <KpiCard
            label="Base"
            value={baseMapa === "cliente" ? "Cliente" : "Agencia"}
          />
        </section>

        {(ano || mes || perfil || subperfil) && (
          <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 text-sm font-semibold text-zinc-500 shadow-sm md:rounded-[2rem]">
            Filtros herdados: {ano || "todos os anos"} / {mes || "todos os meses"}
            {perfil ? ` / ${perfil}` : ""}
            {subperfil ? ` / ${subperfil}` : ""}
          </section>
        )}

        {loading ? (
          <EmptyState text="Carregando PIs..." />
        ) : erro ? (
          <EmptyState text={erro} />
        ) : (
          <>
            <section className="grid gap-5 xl:grid-cols-2">
              <EntityList
                title="Top anunciantes"
                items={topAnunciantes}
                onPiClick={setPiSelecionado}
              />
              <EntityList
                title="Top agencias"
                items={topAgencias}
                onPiClick={setPiSelecionado}
              />
            </section>

            <PisList itens={pisDaUf} onPiClick={setPiSelecionado} />
          </>
        )}
      </div>

      <PiModal pi={piSelecionado} onClose={() => setPiSelecionado(null)} />
    </main>
  )
}

function EntityList({
  title,
  items,
  onPiClick,
}: {
  title: string
  items: RankingItem[]
  onPiClick: (pi: Pi) => void
}) {
  const [aberto, setAberto] = useState("")

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]">
      <div className="border-b border-zinc-200 p-4 sm:p-5">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Clique em um item para ver todos os PIs relacionados.
        </p>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {items.length === 0 ? (
          <EmptyInline text="Nenhum dado encontrado." />
        ) : (
          items.map((item, index) => {
            const abertoAtual = aberto === item.nome

            return (
              <div
                key={`${title}-${item.nome}-${index}`}
                className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50"
              >
                <button
                  type="button"
                  onClick={() =>
                    setAberto((atual) => (atual === item.nome ? "" : item.nome))
                  }
                  className="flex w-full min-w-0 items-start justify-between gap-3 p-4 text-left transition hover:bg-red-50"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-black text-red-600">
                      #{index + 1}
                    </span>
                    <strong className="block break-words text-sm text-zinc-950">
                      {item.nome}
                    </strong>
                    <small className="text-zinc-400">{item.pis} PIs</small>
                  </div>
                  <div className="shrink-0 text-right">
                    <b className="block max-w-[150px] break-words text-xs text-zinc-950">
                      {money(item.liquido)}
                    </b>
                    <span className="mt-1 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black text-red-700">
                      {abertoAtual ? "Fechar" : "Abrir"}
                    </span>
                  </div>
                </button>

                {abertoAtual && (
                  <div className="border-t border-zinc-200 bg-white p-3">
                    <PisList itens={item.itens} onPiClick={onPiClick} compact />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function PisList({
  itens,
  onPiClick,
  compact = false,
}: {
  itens: Pi[]
  onPiClick: (pi: Pi) => void
  compact?: boolean
}) {
  return (
    <section className={compact ? "" : "overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm md:rounded-[2rem]"}>
      <div className={compact ? "mb-2 flex items-center justify-between gap-3" : "flex items-center justify-between gap-3 border-b border-zinc-200 p-4 sm:p-5"}>
        <div>
          <h2 className={compact ? "text-sm font-black text-zinc-950" : "text-lg font-black text-zinc-950"}>
            Todos os PIs da UF
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-zinc-500">
              Clique em um PI para abrir as informacoes completas.
            </p>
          )}
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-500">
          {itens.length}
        </span>
      </div>

      <div className={compact ? "max-h-[380px] space-y-2 overflow-y-auto pr-1" : "grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3"}>
        {itens.length === 0 ? (
          <EmptyInline text="Nenhum PI encontrado." />
        ) : (
          itens.map((item, index) => (
            <button
              type="button"
              onClick={() => onPiClick(item)}
              key={`${item.numero_pi || "pi"}-${index}`}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-left transition hover:border-red-200 hover:bg-red-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block break-words text-sm font-black text-red-600">
                    PI {item.numero_pi || "-"}
                  </strong>
                  <span className="mt-1 block break-words text-xs font-bold text-zinc-950">
                    {item.anunciante || "Anunciante nao informado"}
                  </span>
                  <small className="block break-words text-zinc-500">
                    {item.agencia || "Agencia nao informada"}
                  </small>
                </div>
                <b className="max-w-[120px] shrink-0 break-words text-right text-xs text-zinc-950">
                  {money(onlyNumber(item.valor_liquido))}
                </b>
              </div>

              <div className="mt-2 grid gap-1 text-[11px] font-semibold text-zinc-500">
                <span className="break-words">
                  Executivo: {item.executivo || "-"}
                </span>
                <span className="break-words">
                  Campanha: {item.campanha || item.produto || "-"}
                </span>
                <span>Mes: {item.mes_venda || "-"}</span>
                <span>Bruto: {money(onlyNumber(item.valor_bruto))}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function PiModal({ pi, onClose }: { pi: Pi | null; onClose: () => void }) {
  if (!pi) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/55 p-3 sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl md:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5">
          <div className="min-w-0">
            <span className="text-xs font-black uppercase text-red-600">
              Detalhes do PI
            </span>
            <h2 className="mt-1 break-words text-2xl font-black text-zinc-950">
              PI {pi.numero_pi || "-"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-zinc-100 px-4 text-xs font-black text-zinc-600 transition hover:bg-red-50 hover:text-red-700"
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <ModalInfo label="Anunciante" value={pi.anunciante || "-"} />
          <ModalInfo label="Agencia" value={pi.agencia || "-"} />
          <ModalInfo label="Executivo" value={pi.executivo || "-"} />
          <ModalInfo label="Mes de venda" value={pi.mes_venda || "-"} />
          <ModalInfo label="Campanha" value={pi.campanha || "-"} />
          <ModalInfo label="Produto" value={pi.produto || "-"} />
          <ModalInfo label="Canal" value={pi.canal || "-"} />
          <ModalInfo label="Perfil" value={pi.perfil_anunciante || "-"} />
          <ModalInfo label="Subperfil" value={pi.sub_perfil_anunciante || "-"} />
          <ModalInfo
            label="UF cliente / agencia"
            value={`${pi.uf_cliente || "-"} / ${pi.uf_agencia || "-"}`}
          />
          <ModalInfo label="Valor bruto" value={money(onlyNumber(pi.valor_bruto))} strong />
          <ModalInfo label="Valor liquido" value={money(onlyNumber(pi.valor_liquido))} strong />
        </div>
      </div>
    </div>
  )
}

function ModalInfo({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
      <span className="block text-[10px] font-black uppercase text-zinc-400">
        {label}
      </span>
      <strong
        className={`mt-1 block break-words text-sm ${
          strong ? "font-black text-red-700" : "font-bold text-zinc-950"
        }`}
      >
        {value}
      </strong>
    </div>
  )
}

function KpiCard({
  label,
  value,
  red = false,
}: {
  label: string
  value: string
  red?: boolean
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${
        red
          ? "border-red-600 bg-red-600 text-white"
          : "border-zinc-200 bg-white text-zinc-950"
      }`}
    >
      <span className={`block text-sm font-bold ${red ? "text-red-100" : "text-zinc-500"}`}>
        {label}
      </span>
      <strong className="mt-2 block break-words text-xl font-black leading-tight sm:text-2xl">
        {value}
      </strong>
    </div>
  )
}

function EmptyInline({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 text-sm font-semibold text-zinc-500">
      {text}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500 shadow-sm md:rounded-[2rem]">
      {text}
    </section>
  )
}
