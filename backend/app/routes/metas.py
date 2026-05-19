import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/metas", tags=["Metas"])

BASE_DIR = Path(__file__).resolve().parents[2]
METAS_PATH = BASE_DIR / "data" / "metas.json"


@router.get("")
def listar_metas():
    if not METAS_PATH.exists():
        return []

    with open(METAS_PATH, "r", encoding="utf-8") as file:
        return json.load(file)