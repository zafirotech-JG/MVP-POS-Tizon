"""
Rutas de Reportes — Dashboard y cierre de caja diario
"""
from fastapi import APIRouter, Query, Depends
from datetime import date
from collections import defaultdict

from backend.models import ReporteDia, ReporteProducto, ResumenCaja
from backend import sheets
from backend.auth import get_current_user

router = APIRouter(
    prefix="/api/reportes", 
    tags=["Reportes"],
    dependencies=[Depends(get_current_user)]
)

METODOS_PAGO = ["Efectivo", "Nequi", "Daviplata", "Tarjeta"]


@router.get("/dia", response_model=ReporteDia)
def reporte_del_dia(
    fecha: str = Query(
        default=None,
        description="Fecha en formato YYYY-MM-DD. Por defecto: hoy.",
        examples=["2026-03-04"], # <-- CORRECCIÓN 1: Ahora es una lista
    )
):
    """
    Retorna:
      - Tabla de productos vendidos en el día con cantidades e ingresos.
      - Resumen de caja: total + desglose por método de pago.
    """
    if fecha is None:
        fecha = date.today().isoformat()

    ventas = sheets.get_ventas_por_fecha(fecha)
    
    # CORRECCIÓN 3: Si no hay ventas, aseguramos que sea una lista vacía para que no falle el 'for'
    if not ventas:
        ventas = []

    # ── Tabla de productos ──────────────────────────────────────────────
    agg_productos: dict[str, dict] = defaultdict(lambda: {"cantidad_total": 0, "total_ingresos": 0.0})

    for venta in ventas:
        # CORRECCIÓN 2: Uso seguro de .get() y manejo de celdas vacías de Sheets
        nombre = str(venta.get("producto_nombre", "Producto Desconocido"))
        
        # El 'or 0' hace que si viene un string vacío "", se convierta en 0 antes del int()/float()
        cantidad = int(venta.get("cantidad") or 0)
        total = float(venta.get("total") or 0.0)

        agg_productos[nombre]["cantidad_total"] += cantidad
        agg_productos[nombre]["total_ingresos"] += total

    productos_reporte = [
        ReporteProducto(
            producto_nombre=nombre,
            cantidad_total=datos["cantidad_total"],
            total_ingresos=round(datos["total_ingresos"], 2),
        )
        for nombre, datos in sorted(
            agg_productos.items(),
            key=lambda x: x[1]["total_ingresos"],
            reverse=True,
        )
    ]

    # ── Resumen de caja ─────────────────────────────────────────────────
    totales_metodo = {m: 0.0 for m in METODOS_PAGO}
    total_dia = 0.0

    for venta in ventas:
        metodo = str(venta.get("metodo_pago", ""))
        monto = float(venta.get("total") or 0.0) # Uso seguro contra celdas vacías
        
        total_dia += monto
        if metodo in totales_metodo:
            totales_metodo[metodo] += monto

    resumen = ResumenCaja(
        total_dia=round(total_dia, 2),
        efectivo=round(totales_metodo["Efectivo"], 2),
        nequi=round(totales_metodo["Nequi"], 2),
        daviplata=round(totales_metodo["Daviplata"], 2),
        taraje=round(totales_metodo["Tarjeta"], 2),
    )

    return ReporteDia(
        fecha=fecha,
        productos=productos_reporte,
        resumen_caja=resumen,
    )