"""
Rutas de Productos — CRUD completo
"""
from fastapi import APIRouter, HTTPException
from backend.models import ProductoCreate, ProductoOut
from backend import sheets

router = APIRouter(prefix="/api/productos", tags=["Productos"])


@router.get("/", response_model=list[ProductoOut])
def listar_productos():
    """Retorna todos los productos activos."""
    productos = sheets.get_productos()
    return [
        ProductoOut(
            id=str(p["id"]),
            nombre=str(p["nombre"]),
            precio=float(p["precio"]),
            insumos=str(p.get("insumos", "")),
            activo=str(p.get("activo", "TRUE")).upper() == "TRUE",
        )
        for p in productos
    ]


@router.post("/", response_model=ProductoOut, status_code=201)
def crear_producto(data: ProductoCreate):
    """Crea un nuevo producto en la hoja Productos."""
    nuevo = sheets.add_producto(
        nombre=data.nombre,
        precio=data.precio,
        insumos=data.insumos or "",
    )
    return ProductoOut(**nuevo)


@router.put("/{producto_id}", response_model=ProductoOut)
def editar_producto(producto_id: str, data: ProductoCreate):
    """Edita nombre, precio e insumos de un producto existente."""
    actualizado = sheets.update_producto(
        producto_id=producto_id,
        nombre=data.nombre,
        precio=data.precio,
        insumos=data.insumos or "",
    )
    if not actualizado:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return ProductoOut(**actualizado)


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: str):
    """Soft-delete: marca el producto como inactivo."""
    eliminado = sheets.delete_producto(producto_id)
    if not eliminado:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
