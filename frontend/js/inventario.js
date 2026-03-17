/**
 * Inventario Module — CRUD de productos
 */

import { API } from "./api.js";
import { showToast, formatCOP } from "./utils.js";

let productoEditandoId = null;
let categorias = [];

export function initInventario() {
    bindEventos();
    cargarCategorias();
    cargarTabla(); // Non-blocking
}

async function cargarCategorias(force = false) {
    try {
        categorias = await API.categorias.listar(force);
        poblarSelectCategoria();
    } catch (err) {
        categorias = [];
        poblarSelectCategoria();
        showToast(`Error cargando categorías: ${err.message}`, "warning");
    }
}

async function cargarTabla() {
    const tbody = document.getElementById("tabla-productos-body");
    if (tbody && (!tbody.children.length || tbody.innerHTML.includes("Cargando"))) {
        tbody.innerHTML = Array(4).fill('<tr class="skeleton"><td>Cargando...</td><td>...</td><td>...</td><td>...</td><td>...</td></tr>').join('');
    }

    try {
        const productos = await API.productos.listar();
        renderTabla(productos);
    } catch (err) {
        showToast(`Error cargando inventario: ${err.message}`, "error");
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty-cell" style="color:var(--danger)">Error al cargar</td></tr>`;
    }
}

function renderTabla(productos) {
    const tbody = document.getElementById("tabla-productos-body");
    if (!tbody) return;
    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No hay productos registrados</td></tr>`;
        return;
    }
    tbody.innerHTML = productos
        .map(
            (p) => `
    <tr>
      <td>${p.nombre}</td>
      <td>${p.categoria || "General"}</td>
      <td>${formatCOP(p.precio)}</td>
      <td class="insumos-cell">${p.insumos || "—"}</td>
      <td class="acciones-cell">
        <button class="btn-icon btn-editar" data-id="${p.id}" 
                data-nombre="${p.nombre}" data-precio="${p.precio}" data-insumos="${p.insumos || ""}" data-categoria="${p.categoria || "General"}">
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
    document.getElementById("form-categoria-nueva").value = "";
    poblarSelectCategoria();
    document.getElementById("form-producto-categoria").value = categorias[0]?.nombre || "";
    toggleNuevaCategoriaInput();
    document.getElementById("modal-producto").classList.add("open");
}

function abrirEdicion(data) {
    productoEditandoId = data.id;
    document.getElementById("modal-titulo").textContent = "Editar Producto";
    document.getElementById("form-producto-nombre").value = data.nombre;
    document.getElementById("form-producto-precio").value = data.precio;
    document.getElementById("form-producto-insumos").value = data.insumos;
    poblarSelectCategoria();
    document.getElementById("form-producto-categoria").value = data.categoria || "General";
    document.getElementById("form-categoria-nueva").value = "";
    toggleNuevaCategoriaInput();
    document.getElementById("modal-producto").classList.add("open");
}

function cerrarModal() {
    document.getElementById("modal-producto").classList.remove("open");
    document.getElementById("form-categoria-nueva-wrap").style.display = "none";
    productoEditandoId = null;
}

function poblarSelectCategoria() {
    const select = document.getElementById("form-producto-categoria");
    if (!select) return;
    const opciones = categorias.map((c) => `<option value="${c.nombre}">${c.nombre}</option>`).join("");
    select.innerHTML = `
      <option value="">Selecciona una categoría</option>
      ${opciones}
      <option value="__nueva__">+ Crear nueva categoría</option>
    `;
}

function toggleNuevaCategoriaInput() {
    const valor = document.getElementById("form-producto-categoria")?.value;
    const wrap = document.getElementById("form-categoria-nueva-wrap");
    if (!wrap) return;
    wrap.style.display = valor === "__nueva__" ? "flex" : "none";
}

async function resolverCategoriaSeleccionada() {
    const categoriaSeleccionada = document.getElementById("form-producto-categoria").value;
    if (categoriaSeleccionada && categoriaSeleccionada !== "__nueva__") return categoriaSeleccionada;

    const nuevaCategoria = document.getElementById("form-categoria-nueva").value.trim();
    if (!nuevaCategoria) {
        showToast("Debes seleccionar o crear una categoría", "warning");
        return null;
    }

    try {
        const creada = await API.categorias.crear({ nombre: nuevaCategoria });
        await cargarCategorias(true);
        return creada.nombre;
    } catch (err) {
        showToast(`Error creando categoría: ${err.message}`, "error");
        return null;
    }
}

async function guardarProducto() {
    const nombre = document.getElementById("form-producto-nombre").value.trim();
    const precio = parseFloat(document.getElementById("form-producto-precio").value);
    const insumos = document.getElementById("form-producto-insumos").value.trim();

    if (!nombre) { showToast("El nombre es requerido", "warning"); return; }
    if (!precio || precio <= 0) { showToast("El precio debe ser mayor a 0", "warning"); return; }
    const categoria = await resolverCategoriaSeleccionada();
    if (!categoria) return;

    try {
        if (productoEditandoId) {
            await API.productos.editar(productoEditandoId, { nombre, precio, insumos, categoria });
            showToast("Producto actualizado ✅", "success");
        } else {
            await API.productos.crear({ nombre, precio, insumos, categoria });
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
    document.getElementById("form-producto-categoria")?.addEventListener("change", toggleNuevaCategoriaInput);
    document.getElementById("modal-producto")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-producto") cerrarModal();
    });
}
