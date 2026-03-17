"""
Rutas de Categorías — CRUD básico (listar y crear)
"""
from fastapi import APIRouter, Depends

from backend.models import CategoriaCreate, CategoriaOut
from backend import sheets
from backend.auth import get_current_user

router = APIRouter(
    prefix="/api/categorias",
    tags=["Categorías"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[CategoriaOut])
def listar_categorias():
    """Retorna categorías activas."""
    categorias = sheets.get_categorias()
    return [
        CategoriaOut(
            id=str(c["id"]),
            nombre=str(c["nombre"]),
            activo=str(c.get("activo", "TRUE")).upper() == "TRUE",
        )
        for c in categorias
    ]


@router.post("", response_model=CategoriaOut, status_code=201)
def crear_categoria(data: CategoriaCreate):
    """Crea una categoría nueva o reactiva una existente."""
    nueva = sheets.add_categoria(nombre=data.nombre)
    return CategoriaOut(**nueva)
