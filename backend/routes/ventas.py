"""
Ruta de Ventas — Registro de transacciones POS
"""
from fastapi import APIRouter, HTTPException, Depends
from backend.models import VentaCreate, VentaOut
from backend import sheets
from backend.auth import get_current_user

router = APIRouter(
    prefix="/api/ventas", 
    tags=["Ventas"],
    dependencies=[Depends(get_current_user)]
)


@router.post("/", response_model=VentaOut, status_code=201)
def registrar_venta(data: VentaCreate):
    """
    Registra una venta en la hoja Ventas.

    Lógica:
      1. Busca el producto por ID para obtener nombre y precio actual.
      2. Calcula total = precio_unitario * cantidad.
      3. Persiste la venta con el timestamp y método de pago.
    """
    # 1. Obtener el producto para precio y nombre
    productos = sheets.get_productos()
    producto = next((p for p in productos if str(p["id"]) == data.producto_id), None)

    if not producto:
        raise HTTPException(
            status_code=404,
            detail=f"Producto con id '{data.producto_id}' no encontrado o inactivo",
        )

    precio_unitario = float(producto["precio"])
    producto_nombre = str(producto["nombre"])

    # 2 + 3. Calcular total y persistir
    venta = sheets.add_venta(
        producto_id=data.producto_id,
        producto_nombre=producto_nombre,
        cantidad=data.cantidad,
        precio_unitario=precio_unitario,
        metodo_pago=data.metodo_pago.value,
    )

    return VentaOut(**venta)
