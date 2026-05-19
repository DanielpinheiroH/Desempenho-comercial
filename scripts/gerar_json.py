import json
import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]

ARQUIVO_XLSB = BASE_DIR / "base.xlsb"
SAIDA_JSON = BASE_DIR / "backend" / "data" / "dados.json"

ABA = "Vendas a partir 2022"


def limpar_texto(valor):
    if pd.isna(valor):
        return ""

    return str(valor).strip()


def limpar_numero_pi(valor):
    texto = limpar_texto(valor)

    if texto.endswith(".0"):
        texto = texto[:-2]

    return re.sub(r"\D", "", texto)


def parse_numero(valor):
    if pd.isna(valor) or valor == "":
        return 0

    if isinstance(valor, (int, float)):
        return float(valor)

    texto = str(valor).strip()
    texto = texto.replace("R$", "")
    texto = texto.replace(" ", "")
    texto = texto.replace(".", "")
    texto = texto.replace(",", ".")

    try:
        return float(texto)
    except ValueError:
        return 0


def excel_date_to_text(valor):
    if pd.isna(valor) or valor == "":
        return ""

    try:
        if isinstance(valor, (int, float)):
            data = pd.to_datetime("1899-12-30") + pd.to_timedelta(valor, unit="D")
        else:
            data = pd.to_datetime(valor, dayfirst=True)

        return data.strftime("%d/%m/%Y")
    except Exception:
        return limpar_texto(valor)


def excel_month_to_text(valor):
    if pd.isna(valor) or valor == "":
        return "Sem mês"

    try:
        if isinstance(valor, (int, float)):
            data = pd.to_datetime("1899-12-30") + pd.to_timedelta(valor, unit="D")
        else:
            data = pd.to_datetime(valor, dayfirst=True)

        return data.strftime("%m/%Y")
    except Exception:
        return limpar_texto(valor)


def normalizar_colunas(df):
    df.columns = [str(col).strip() for col in df.columns]
    return df


def definir_grupo(row):
    diretoria = limpar_texto(row.get("Diretoria")).lower()
    perfil = limpar_texto(row.get("Perfil Anunciante")).lower()
    executivo = limpar_texto(row.get("Executivo")).lower()

    federal = [
        "adreson nava",
        "gabriel moura",
        "luciana cunha",
        "roberta bandeira",
    ]

    estadual = [
        "djanane rodrigues",
        "letícia cerqueira",
        "leticia cerqueira",
        "priscilla arraes",
    ]

    if "federal" in diretoria or executivo in federal:
        return "federal"

    if "estadual" in diretoria or executivo in estadual:
        return "estadual"

    if "público" in perfil or "publico" in perfil:
        return "estadual"

    return "privado"


def main():
    print("Lendo planilha...")

    df = pd.read_excel(
        ARQUIVO_XLSB,
        sheet_name=ABA,
        engine="pyxlsb",
    )

    df = normalizar_colunas(df)

    dados = []

    for _, row in df.iterrows():
        numero_pi = limpar_numero_pi(row.get("PI"))

        if not numero_pi:
            continue

        item = {
            "pi_matriz": limpar_texto(row.get("PI Matriz")),
            "numero_pi": numero_pi,
            "anunciante": limpar_texto(row.get("Nome do Anunciante")),
            "razao_social_anunciante": limpar_texto(row.get("Razão Social do Anunciante")),
            "codinome": limpar_texto(row.get("Codinome")),
            "cnpj_anunciante": limpar_texto(row.get("CNPJ do Anunciante")),
            "uf_cliente": limpar_texto(row.get("UF Cliente")),
            "executivo": limpar_texto(row.get("Executivo")),
            "diretoria": limpar_texto(row.get("Diretoria")),
            "grupo": definir_grupo(row),
            "campanha": limpar_texto(row.get("Nome Campanha")),
            "agencia": limpar_texto(row.get("Nome da Agência")),
            "razao_social_agencia": limpar_texto(row.get("Razão Social Agência")),
            "cnpj_agencia": limpar_texto(row.get("CNPJ Agência")),
            "uf_agencia": limpar_texto(row.get("UF Agência")),
            "data_inicial_veiculacao": excel_date_to_text(row.get("Data  inícial veiculação")),
            "data_final_veiculacao": excel_date_to_text(row.get("Data Final Veiculação")),
            "mes_venda": excel_month_to_text(row.get("Mes da venda")),
            "mes_inicial_veiculacao": excel_month_to_text(row.get("Mês Inicial de Veiculação")),
            "canal": limpar_texto(row.get("Canal")),
            "perfil_anunciante": limpar_texto(row.get("Perfil Anunciante")),
            "sub_perfil_anunciante": limpar_texto(row.get("Sub Perfil Anunciante")),
            "produto": limpar_texto(row.get("Produto")),
            "valor_bruto": parse_numero(row.get("Valor bruto")),
            "valor_liquido": parse_numero(row.get("Valor líquido")),
            "vencimento": excel_date_to_text(row.get("Vencimento")),
            "data_venda": excel_date_to_text(row.get("Data da venda")),
            "data_emissao_recebimento_pi": excel_date_to_text(row.get("Data de emissão/recebimento do PI")),
            "observacoes": limpar_texto(row.get("Observações")),
        }

        dados.append(item)

    SAIDA_JSON.parent.mkdir(parents=True, exist_ok=True)

    with open(SAIDA_JSON, "w", encoding="utf-8") as file:
        json.dump(dados, file, ensure_ascii=False, indent=2)

    print(f"OK! {len(dados)} registros gerados em:")
    print(SAIDA_JSON)


if __name__ == "__main__":
    main()