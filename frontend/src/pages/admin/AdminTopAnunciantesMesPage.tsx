import { Fragment, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getPisCached } from "../../services/api"

type Pi = {
  numero_pi: string
  executivo: string
  anunciante: string
  agencia: string
  grupo: string
  perfil_anunciante?: string
  sub_perfil_anunciante?: string
  campanha?: string
  produto?: string
  canal?: string
  mes_venda: string
  valor_bruto: number
  valor_liquido: number
}

type AreaTipo =
  | "privado"
  | "gestao-executiva"
  | "estadual"
  | "federal"
  | "gdf"

type RankingItem = {
  nome: string
  pis: number
  bruto: number
  liquido: number
  itens: Pi[]
}

type RankingTipo = "anunciantes" | "agencias"

type Props = {
  tipo?: RankingTipo
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

function getMesRef(mes?: string) {
  const [mm, yyyy] = String(mes || "").split("/")
  return Number(`${yyyy || "0"}${String(mm || "0").padStart(2, "0")}`)
}

function classificarArea(item: Pi): AreaTipo {
  const perfil = normalizar(item.perfil_anunciante)
  const sub = normalizar(item.sub_perfil_anunciante)
  const executivo = normalizar(item.executivo)
  const grupo = normalizar(item.grupo)

  if (grupo === "federal" || perfil.includes("federal") || sub.includes("federal")) {
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

function escapeExcel(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function cellRef(colIndex: number, rowIndex: number) {
  let col = ""
  let n = colIndex

  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col
    n = Math.floor(n / 26) - 1
  }

  return `${col}${rowIndex}`
}

function criarTabelaCrc32() {
  return Array.from({ length: 256 }, (_, index) => {
    let crc = index

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }

    return crc >>> 0
  })
}

const crcTable = criarTabelaCrc32()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff

  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  })

  return (crc ^ 0xffffffff) >>> 0
}

function escreverUint16(output: number[], value: number) {
  output.push(value & 0xff, (value >>> 8) & 0xff)
}

function escreverUint32(output: number[], value: number) {
  output.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  )
}

function criarZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder()
  const output: number[] = []
  const central: number[] = []
  const records: {
    nameBytes: Uint8Array
    data: Uint8Array
    crc: number
    offset: number
  }[] = []

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const checksum = crc32(data)
    const offset = output.length

    escreverUint32(output, 0x04034b50)
    escreverUint16(output, 20)
    escreverUint16(output, 0)
    escreverUint16(output, 0)
    escreverUint16(output, 0)
    escreverUint16(output, 0)
    escreverUint32(output, checksum)
    escreverUint32(output, data.length)
    escreverUint32(output, data.length)
    escreverUint16(output, nameBytes.length)
    escreverUint16(output, 0)
    output.push(...nameBytes, ...data)

    records.push({ nameBytes, data, crc: checksum, offset })
  })

  const centralOffset = output.length

  records.forEach((record) => {
    escreverUint32(central, 0x02014b50)
    escreverUint16(central, 20)
    escreverUint16(central, 20)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint32(central, record.crc)
    escreverUint32(central, record.data.length)
    escreverUint32(central, record.data.length)
    escreverUint16(central, record.nameBytes.length)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint16(central, 0)
    escreverUint32(central, 0)
    escreverUint32(central, record.offset)
    central.push(...record.nameBytes)
  })

  output.push(...central)
  escreverUint32(output, 0x06054b50)
  escreverUint16(output, 0)
  escreverUint16(output, 0)
  escreverUint16(output, records.length)
  escreverUint16(output, records.length)
  escreverUint32(output, central.length)
  escreverUint32(output, centralOffset)
  escreverUint16(output, 0)

  return new Uint8Array(output)
}

function criarXlsx(rows: (string | number)[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1
      const cells = row
        .map((value, colIndex) => {
          const ref = cellRef(colIndex, rowNumber)

          if (typeof value === "number") {
            return `<c r="${ref}"><v>${value}</v></c>`
          }

          return `<c r="${ref}" t="inlineStr"><is><t>${escapeExcel(value)}</t></is></c>`
        })
        .join("")

      return `<row r="${rowNumber}">${cells}</row>`
    })
    .join("")

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Top anunciantes" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="42" customWidth="1"/>
    <col min="2" max="2" width="42" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`,
    },
  ]

  return criarZip(files)
}

export default function AdminTopAnunciantesMesPage({
  tipo = "anunciantes",
}: Props) {
  const navigate = useNavigate()

  const [dados, setDados] = useState<Pi[]>([])
  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState("")
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState<string | null>(null)

  const isAgencias = tipo === "agencias"
  const entidadeLabel = isAgencias ? "agencias" : "anunciantes"
  const entidadeSingular = isAgencias ? "agencia" : "anunciante"
  const campoRanking: keyof Pi = isAgencias ? "agencia" : "anunciante"
  const campoRelacionado: keyof Pi = isAgencias ? "anunciante" : "agencia"
  const titulo = isAgencias ? "Top agencias por mes" : "Top anunciantes por mes"
  const subtitulo = isAgencias
    ? "Selecione um mes, visualize o ranking de maiores agencias e exporte em Excel."
    : "Selecione um mes, visualize o ranking de maiores anunciantes e exporte em Excel."

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

  const dadosPrivado = useMemo(() => {
    return dados.filter((item) => classificarArea(item) === "privado")
  }, [dados])

  const dadosRanking = useMemo(() => {
    if (!isAgencias) return dadosPrivado

    return dadosPrivado.filter((item) => !isAgenciaDireta(item.agencia))
  }, [dadosPrivado, isAgencias])

  const meses = useMemo(() => {
    return Array.from(
      new Set(dadosRanking.map((item) => item.mes_venda).filter(Boolean))
    ).sort((a, b) => getMesRef(b) - getMesRef(a))
  }, [dadosRanking])

  useEffect(() => {
    if (!mesSelecionado && meses.length > 0) {
      setMesSelecionado(meses[0])
    }
  }, [meses, mesSelecionado])

  const ranking = useMemo(() => {
    const termo = normalizar(busca)
    const mapa = new Map<string, RankingItem>()

    dadosRanking
      .filter((item) => item.mes_venda === mesSelecionado)
      .filter((item) => {
        if (!termo) return true

        return normalizar(
          [
            item.numero_pi,
            item.anunciante,
            item.agencia,
            item.executivo,
            item.campanha,
            item.produto,
            item.canal,
          ].join(" ")
        ).includes(termo)
      })
      .forEach((item) => {
        const nome = String(item[campoRanking] || "").trim()
        const anunciante = item.anunciante || "Não informado"

        const chave = nome || anunciante

        const atual = mapa.get(chave) || {
          nome: chave,
          pis: 0,
          bruto: 0,
          liquido: 0,
          itens: [],
        }

        atual.pis += 1
        atual.bruto += Number(item.valor_bruto || 0)
        atual.liquido += Number(item.valor_liquido || 0)
        atual.itens.push(item)

        mapa.set(chave, atual)
      })

    return Array.from(mapa.values()).sort((a, b) => b.liquido - a.liquido)
  }, [dadosRanking, mesSelecionado, busca, campoRanking])

  const totalLiquido = ranking.reduce((acc, item) => acc + item.liquido, 0)
  const totalBruto = ranking.reduce((acc, item) => acc + item.bruto, 0)
  const totalPIs = ranking.reduce((acc, item) => acc + item.pis, 0)

  function alternarEntidade(nome: string) {
    setAberto((atual) => (atual === nome ? null : nome))
  }

  function exportarExcel() {
    const linhas = ranking.slice(0, 25).map((item) => {
      const relacionados = Array.from(
        new Set(
          item.itens
            .map((pi) => String(pi[campoRelacionado] || "").trim())
            .filter(Boolean)
        )
      ).join(", ")

      return [item.nome, relacionados, item.liquido]
    })

    const cabecalho = isAgencias
      ? ["Agencia", "Anunciante", "Valor Liquido"]
      : ["Anunciante", "Agencia", "Valor Liquido"]

    const bytes = criarXlsx([cabecalho, ...linhas])
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = `top-25-${entidadeLabel}-${mesSelecionado.replace("/", "-")}.xlsx`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden space-y-5 bg-zinc-100 text-zinc-950">
      <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] bg-zinc-950 shadow-sm md:rounded-[2rem]">
        <div className="relative isolate min-w-0 p-4 text-white sm:p-6 lg:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.42),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(127,29,29,0.42),transparent_32%)]" />

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-5 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15 sm:w-auto"
          >
            Voltar ao dashboard
          </button>

          <span className="inline-flex max-w-full rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100 sm:text-xs sm:tracking-[0.18em]">
            Comercial Privado
          </span>

          <h1 className="mt-4 max-w-full break-words text-2xl font-black tracking-tight sm:text-3xl md:text-5xl">
            {titulo}
          </h1>

          <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-zinc-300 md:text-base">
            {subtitulo}
          </p>

          <div className="hidden">
          <h1 className="hidden mt-4 max-w-full break-words text-2xl font-black tracking-tight sm:text-3xl md:text-5xl">
            Top anunciantes por mês
          </h1>

          <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-zinc-300 md:text-base">
            Selecione um mês, visualize o ranking de maiores anunciantes e exporte em Excel.
          </p>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label={isAgencias ? "Agencias" : "Anunciantes"} value={String(ranking.length)} />
        <Card label="PIs" value={String(totalPIs)} />
        <Card label="Total bruto" value={money(totalBruto)} dark />
        <Card label="Total líquido" value={money(totalLiquido)} red />
      </section>

      <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm md:rounded-[2rem]">
        <div className="grid min-w-0 gap-3 md:grid-cols-[200px_1fr_auto]">
          <select
            value={mesSelecionado}
            onChange={(event) => {
              setMesSelecionado(event.target.value)
              setAberto(null)
            }}
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          >
            {meses.map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>

          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            placeholder="Buscar anunciante, PI, agencia, executivo..."
          />

          <button
            type="button"
            onClick={exportarExcel}
            disabled={ranking.length === 0}
            className="h-12 w-full rounded-2xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300 md:w-auto"
          >
            Exportar Excel
          </button>
        </div>
      </section>

      {loading ? (
        <EmptyState text="Carregando dados..." />
      ) : ranking.length === 0 ? (
        <EmptyState text={`Nenhum ${entidadeSingular} encontrado para esse mes.`} />
      ) : (
        <section className="w-full max-w-full overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-5">
          <div className="mb-5 min-w-0">
            <h2 className="break-words text-xl font-black">
              Ranking de {mesSelecionado}
            </h2>
            <p className="break-words text-sm text-zinc-500">
              Clique em um {entidadeSingular} para visualizar os PIs relacionados.
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            {ranking.map((item, index) => (
              <RankingMobileCard
                item={item}
                key={`${item.nome}-${index}`}
                aberto={aberto === item.nome}
                posicao={index + 1}
                onToggle={() => alternarEntidade(item.nome)}
              />
            ))}
          </div>

          <div className="hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="w-20 px-3 py-3">Ranking</th>
                  <th className="px-3 py-3">
                    {isAgencias ? "Agencia" : "Anunciante"}
                  </th>
                  <th className="w-24 px-3 py-3 text-right">Qtd PIs</th>
                  <th className="w-40 px-3 py-3 text-right">Valor Bruto</th>
                  <th className="w-40 px-3 py-3 text-right">Valor Líquido</th>
                </tr>
              </thead>

              <tbody>
                {ranking.map((item, index) => {
                  const abertoAtual = aberto === item.nome

                  return (
                    <Fragment key={`${item.nome}-${index}`}>
                      <tr
                        className="cursor-pointer border-b border-zinc-100 transition hover:bg-red-50"
                        onClick={() => alternarEntidade(item.nome)}
                      >
                        <td className="px-3 py-4 font-black text-red-600">
                          #{index + 1}
                        </td>
                        <td className="px-3 py-4">
                          <strong className="block break-words font-black text-zinc-950">
                            {item.nome}
                          </strong>
                          <small className="text-zinc-400">
                            {abertoAtual ? "Ocultar PIs" : "Ver PIs"}
                          </small>
                        </td>
                        <td className="px-3 py-4 text-right font-bold">
                          {item.pis}
                        </td>
                        <td className="px-3 py-4 text-right font-black text-zinc-700">
                          {money(item.bruto)}
                        </td>
                        <td className="px-3 py-4 text-right font-black text-zinc-950">
                          {money(item.liquido)}
                        </td>
                      </tr>

                      {abertoAtual && (
                        <tr key={`${item.nome}-${index}-pis`}>
                          <td colSpan={5} className="border-b border-zinc-100 bg-zinc-50 p-4">
                            <PisTable itens={item.itens} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

function RankingMobileCard({
  item,
  aberto,
  posicao,
  onToggle,
}: {
  item: RankingItem
  aberto: boolean
  posicao: number
  onToggle: () => void
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-w-0 p-4 text-left transition hover:bg-red-50"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-black text-red-600">#{posicao}</span>
            <strong className="mt-1 block break-words text-base font-black text-zinc-950">
              {item.nome}
            </strong>
            <small className="text-zinc-500">{item.pis} PIs</small>
          </div>

          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-red-600">
            {aberto ? "Fechar" : "Abrir"}
          </span>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <MiniInfo label="Valor bruto" value={money(item.bruto)} />
          <MiniInfo label="Valor líquido" value={money(item.liquido)} />
        </div>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-zinc-200 bg-white p-4">
          {item.itens.map((pi, piIndex) => (
            <PiMobileCard pi={pi} key={`${pi.numero_pi}-${piIndex}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function PisTable({ itens }: { itens: Pi[] }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
          <th className="w-28 px-3 py-3">PI</th>
          <th className="px-3 py-3">Agência</th>
          <th className="px-3 py-3">Executivo</th>
          <th className="px-3 py-3">Campanha</th>
          <th className="w-36 px-3 py-3 text-right">Valor Bruto</th>
          <th className="w-36 px-3 py-3 text-right">Valor Líquido</th>
        </tr>
      </thead>

      <tbody>
        {itens.map((pi, piIndex) => (
          <tr key={`${pi.numero_pi}-${piIndex}`} className="border-b border-zinc-100">
            <td className="break-words px-3 py-3 font-black text-red-600">
              {pi.numero_pi || "-"}
            </td>
            <td className="break-words px-3 py-3">{pi.agencia || "-"}</td>
            <td className="break-words px-3 py-3">{pi.executivo || "-"}</td>
            <td className="break-words px-3 py-3">{pi.campanha || "-"}</td>
            <td className="px-3 py-3 text-right font-black text-zinc-700">
              {money(pi.valor_bruto)}
            </td>
            <td className="px-3 py-3 text-right font-black text-zinc-950">
              {money(pi.valor_liquido)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PiMobileCard({ pi }: { pi: Pi }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <strong className="block break-words text-sm font-black text-red-600">
        PI {pi.numero_pi || "-"}
      </strong>

      <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <MiniInfo label="Agência" value={pi.agencia || "-"} />
        <MiniInfo label="Executivo" value={pi.executivo || "-"} />
        <MiniInfo label="Campanha" value={pi.campanha || "-"} />
        <MiniInfo label="Valor bruto" value={money(pi.valor_bruto)} />
        <MiniInfo label="Valor líquido" value={money(pi.valor_liquido)} />
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  dark = false,
  red = false,
}: {
  label: string
  value: string
  dark?: boolean
  red?: boolean
}) {
  const color = red
    ? "border-red-600 bg-red-600 text-white"
    : dark
      ? "border-zinc-950 bg-zinc-950 text-white"
      : "border-zinc-200 bg-white text-zinc-950"

  return (
    <div className={`min-w-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-sm ${color}`}>
      <span className="text-sm font-bold opacity-80">{label}</span>
      <strong className="mt-2 block max-w-full break-words text-xl font-black sm:text-2xl">
        {value}
      </strong>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2">
      <span className="block text-[10px] font-black uppercase text-zinc-400">
        {label}
      </span>
      <strong className="mt-1 block break-words text-xs font-black text-zinc-800">
        {value}
      </strong>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
      {text}
    </div>
  )
}
