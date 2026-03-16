"""
Tizón V1 — POS MVP para Asadero
FastAPI app principal: configura CORS, monta estáticos, registra rutas.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.routes import auth, productos, ventas, reportes

app = FastAPI(
    title="Tizón V1 — POS API",
    description="Sistema de Punto de Venta para Asadero Colombiano",
    version="1.0.0",
)

# ── CORS ────────────────────────────────────────────────────────────────
# Orígenes permitidos configurables mediante variable de entorno (separados por coma)
cors_origins_str = os.getenv("CORS_ORIGINS", "*")
origins = [origin.strip() for origin in cors_origins_str.split(",")] if cors_origins_str else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rutas API ────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(ventas.router)
app.include_router(reportes.router)

# ── Archivos estáticos (frontend) ────────────────────────────────────────
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Montar /css y /js en sus rutas exactas para que el HTML los encuentre
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")


@app.get("/", include_in_schema=False)
def serve_frontend():
    """Sirve el index.html del frontend."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
