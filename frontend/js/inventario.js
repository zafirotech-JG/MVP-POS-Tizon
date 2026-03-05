/**
 * Inventario Module — CRUD de productos
 */

import { API } from "./api.js";
import { showToast, formatCOP } from "./utils.js";

let productoEditandoId = null;

export function initInventario() {
    bindEventos();
    cargarTabla(); // Non-blocking
}

async function cargarTabla() {
    const tbody = document.getElementById("tabla-productos-body");
    if (tbody && (!tbody.children.length || tbody.innerHTML.includes("Cargando"))) {
        tbody.innerHTML = Array(4).fill('<tr class="skeleton"><td>Cargando...</td><td>...</td><td>...</td><td>...</td></tr>').join('');
    }

    try {
        const productos = await API.productos.listar();
        renderTabla(productos);
    } catch (err) {
        showToast(`Error cargando inventario: ${err.message}`, "error");
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="empty-cell" style="color:var(--danger)">Error al cargar</td></tr>`;
    }
}

function renderTabla(productos) {
    const tbody = document.getElementById("tabla-productos-body");
    if (!tbody) return;
    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No hay productos registrados</td></tr>`;
        return;
    }
    tbody.innerHTML = productos
        .map(
            (p) => `
    <tr>
      <td>${p.nombre}</td>
      <td>${formatCOP(p.precio)}</td>
      <td class="insumos-cell">${p.insumos || "—"}</td>
      <td class="acciones-cell">
        <button class="btn-icon btn-editar" data-id="${p.id}" 
                data-nombre="${p.nombre}" data-precio="${p.precio}" data-insumos="${p.insumos || ""}">
          ✏️
        </button>
        <button class="btn-icon btn-eliminar" data-id="${p.id}">🗑️</button>
      </td>
    </tr>
  `
        )
        .join("");

    // Attach handlers
    tbody.querySelectorAll(".btn-editar").forEach((btn) => {
        btn.addEventListener("click", () => abrirEdicion(btn.dataset));
    });
    tbody.querySelectorAll(".btn-eliminar").forEach((btn) => {
        btn.addEventListener("click", () => eliminarProducto(btn.dataset.id));
    });
}

function abrirModal(titulo = "Nuevo Producto") {
    productoEditandoId = null;
    document.getElementById("modal-titulo").textContent = titulo;
    document.getElementById("form-producto-nombre").value = "";
    document.getElementById("form-producto-precio").value = "";
    document.getElementById("form-producto-insumos").value = "";
    document.getElementById("modal-producto").classList.add("open");
}

function abrirEdicion(data) {
    productoEditandoId = data.id;
    document.getElementById("modal-titulo").textContent = "Editar Producto";
    document.getElementById("form-producto-nombre").value = data.nombre;
    document.getElementById("form-producto-precio").value = data.precio;
    document.getElementById("form-producto-insumos").value = data.insumos;
    document.getElementById("modal-producto").classList.add("open");
}

function cerrarModal() {
    document.getElementById("modal-producto").classList.remove("open");
    productoEditandoId = null;
}

async function guardarProducto() {
    const nombre = document.getElementById("form-producto-nombre").value.trim();
    const precio = parseFloat(document.getElementById("form-producto-precio").value);
    const insumos = document.getElementById("form-producto-insumos").value.trim();

    if (!nombre) { showToast("El nombre es requerido", "warning"); return; }
    if (!precio || precio <= 0) { showToast("El precio debe ser mayor a 0", "warning"); return; }

    try {
        if (productoEditandoId) {
            await API.productos.editar(productoEditandoId, { nombre, precio, insumos });
            showToast("Producto actualizado ✅", "success");
        } else {
            await API.productos.crear({ nombre, precio, insumos });
            showToast("Producto creado ✅", "success");
        }
        cerrarModal();
        await cargarTabla();
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }
}

async function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
        await API.productos.eliminar(id);
        showToast("Producto eliminado", "success");
        await cargarTabla();
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }
}

function bindEventos() {
    document.getElementById("btn-nuevo-producto")?.addEventListener("click", () => abrirModal());
    document.getElementById("btn-guardar-producto")?.addEventListener("click", guardarProducto);
    document.getElementById("btn-cancelar-modal")?.addEventListener("click", cerrarModal);
    document.getElementById("modal-producto")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-producto") cerrarModal();
    });
}
