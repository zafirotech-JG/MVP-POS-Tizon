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
        examples="2026-03-04",
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

    # ── Tabla de productos ──────────────────────────────────────────────
    agg_productos: dict[str, dict] = defaultdict(lambda: {"cantidad_total": 0, "total_ingresos": 0.0})

    for venta in ventas:
        nombre = str(venta["producto_nombre"])
        agg_productos[nombre]["cantidad_total"] += int(venta["cantidad"])
        agg_productos[nombre]["total_ingresos"] += float(venta["total"])

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
        monto = float(venta.get("total", 0))
        total_dia += monto
        if metodo in totales_metodo:
            totales_metodo[metodo] += monto

    resumen = ResumenCaja(
        total_dia=round(total_dia, 2),
        efectivo=round(totales_metodo["Efectivo"], 2),
        nequi=round(totales_metodo["Nequi"], 2),
        daviplata=round(totales_metodo["Daviplata"], 2),
        tarjeta=round(totales_metodo["Tarjeta"], 2),
    )

    return ReporteDia(
        fecha=fecha,
        productos=productos_reporte,
        resumen_caja=resumen,
    )
