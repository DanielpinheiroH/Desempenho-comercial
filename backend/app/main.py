from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.pis import router as pis_router
from app.routes.metas import router as metas_router
app = FastAPI(title="Desempenho Comercial")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://desempenho-comercial-nxc1.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(pis_router)
app.include_router(metas_router)

@app.get("/")
def health():
    return {"status": "ok", "message": "API Desempenho Comercial rodando."}