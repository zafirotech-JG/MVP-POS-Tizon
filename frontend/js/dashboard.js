/**
 * Dashboard Module — Reportes y cierre de caja diario
 */

import { API } from "./api.js";
import { showToast, formatCOP } from "./utils.js";

export async function initDashboard() {
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById("dashboard-fecha").value = hoy;
    bindEventos();
    await cargarReporte(hoy);
}

async function cargarReporte(fecha) {
    const btnCargar = document.getElementById("btn-cargar-reporte");
    if (btnCargar) { btnCargar.disabled = true; btnCargar.textContent = "Cargando..."; }

    try {
        const reporte = await API.reportes.dia(fecha);
        renderTablaProductos(reporte.productos);
        renderResumenCaja(reporte.resumen_caja);
    } catch (err) {
        showToast(`Error cargando reporte: ${err.message}`, "error");
    } finally {
        if (btnCargar) { btnCargar.disabled = false; btnCargar.textContent = "Cargar"; }
    }
}

function renderTablaProductos(productos) {
    const tbody = document.getElementById("tabla-reporte-body");
    if (!tbody) return;

    if (!productos || productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-cell">Sin ventas para esta fecha</td></tr>`;
        return;
    }

    tbody.innerHTML = productos
        .map(
            (p) => `
      <tr>
        <td>${p.producto_nombre}</td>
        <td class="text-center">${p.cantidad_total}</td>
        <td class="text-right">${formatCOP(p.total_ingresos)}</td>
      </tr>
    `
        )
        .join("");
}

function renderResumenCaja(resumen) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatCOP(val);
    };
    setVal("resumen-total", resumen.total_dia);
    setVal("resumen-efectivo", resumen.efectivo);
    setVal("resumen-nequi", resumen.nequi);
    setVal("resumen-daviplata", resumen.daviplata);
    setVal("resumen-tarjeta", resumen.tarjeta);
}

function bindEventos() {
    document.getElementById("btn-cargar-reporte")?.addEventListener("click", () => {
        const fecha = document.getElementById("dashboard-fecha")?.value;
        if (fecha) cargarReporte(fecha);
    });
}
