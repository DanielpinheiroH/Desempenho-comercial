import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

ENTRADA = BASE_DIR / "metas.txt"
SAIDA = BASE_DIR / "backend" / "data" / "metas.json"


def parse_brl(valor):
    valor = valor.replace("R$", "")
    valor = valor.replace(".", "")
    valor = valor.replace(",", ".")
    valor = valor.strip()

    try:
        return float(valor)
    except:
        return 0.0


def main():
    metas = []

    with open(ENTRADA, "r", encoding="utf-8") as file:
        linhas = file.readlines()

    for linha in linhas:
        linha = linha.strip()

        if not linha:
            continue

        partes = re.split(r"\t+", linha)

        if len(partes) < 3:
            partes = re.split(r"\s{2,}", linha)

        if len(partes) < 3:
            print("Linha ignorada:", linha)
            continue

        executivo = partes[0].strip()
        mes = partes[1].strip()
        meta = parse_brl(partes[2])

        metas.append({
            "executivo": executivo,
            "mes": mes,
            "meta": meta,
        })

    with open(SAIDA, "w", encoding="utf-8") as file:
        json.dump(metas, file, ensure_ascii=False, indent=2)

    print(f"OK! {len(metas)} metas geradas.")
    print(SAIDA)


if __name__ == "__main__":
    main()