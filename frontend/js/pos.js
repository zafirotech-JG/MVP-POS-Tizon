/**
 * POS Module — Registro de ventas
 * Compatible con: grilla de productos, quantity stepper, payment pills, bottom sheet (mobile).
 */

import { API } from "./api.js";
import { showToast, formatCOP } from "./utils.js";

let productos = [];
let metodoPagoSeleccionado = "";

export function initPOS() {
    bindEventos();
    cargarProductos(); // Llamado asíncrono sin await para no bloquear UI
}

// ── Carga productos del backend ────────────────────────────────────────────
async function cargarProductos() {
    const grilla = document.getElementById("grilla-productos");
    // Mostrar skeletons si la grilla está vacía
    if (grilla && (!grilla.children.length || grilla.innerHTML.includes("Cargando"))) {
        grilla.innerHTML = Array(6).fill('<div class="product-card skeleton"><span class="product-name">...</span><span class="product-price">...</span></div>').join('');
    }

    try {
        productos = await API.productos.listar();
        renderGrilla();
    } catch (err) {
        showToast(`Error cargando productos: ${err.message}`, "error");
        if (grilla) grilla.innerHTML = `<p style="color:var(--danger);font-size:0.88rem;grid-column:1/-1">No se pudo cargar el menú</p>`;
    }
}

// ── Grilla de productos ────────────────────────────────────────────────────
function renderGrilla() {
    const grilla = document.getElementById("grilla-productos");
    if (!grilla) return;

    if (productos.length === 0) {
        grilla.innerHTML = `<p style="color:var(--text-muted);font-size:0.88rem;grid-column:1/-1">No hay productos registrados. Agrega uno en Inventario.</p>`;
        return;
    }

    grilla.innerHTML = "";
    productos.forEach((p) => {
        const card = document.createElement("button");
        card.className = "product-card";
        card.type = "button";
        card.dataset.id = p.id;
        card.dataset.precio = p.precio;
        card.dataset.nombre = p.nombre;
        card.innerHTML = `
      <span class="product-name">${p.nombre}</span>
      <span class="product-price">${formatCOP(p.precio)}</span>
    `;
        card.addEventListener("click", () => seleccionarProducto(p));
        grilla.appendChild(card);
    });
}

// ── Selección de producto ──────────────────────────────────────────────────
function seleccionarProducto(producto) {
    // Marcar tarjeta seleccionada
    document.querySelectorAll(".product-card").forEach((c) => c.classList.remove("selected"));
    const card = document.querySelector(`.product-card[data-id="${producto.id}"]`);
    if (card) card.classList.add("selected");

    // Llenar panel
    document.getElementById("detalle-nombre").textContent = producto.nombre;
    document.getElementById("detalle-precio").textContent = formatCOP(producto.precio);
    document.getElementById("venta-producto-id").value = producto.id;
    document.getElementById("venta-cantidad").value = 1;

    // Reset método de pago
    metodoPagoSeleccionado = "";
    document.getElementById("venta-metodo-pago").value = "";
    document.querySelectorAll(".pago-pill").forEach((p) => p.classList.remove("selected"));

    recalcularTotal();
    abrirPanel();
}

// ── Abrir / cerrar panel ───────────────────────────────────────────────────
function abrirPanel() {
    document.getElementById("panel-venta").classList.add("visible");
    document.getElementById("panel-backdrop").classList.add("visible");
    document.body.style.overflow = "hidden";
}

function cerrarPanel() {
    document.getElementById("panel-venta").classList.remove("visible");
    document.getElementById("panel-backdrop").classList.remove("visible");
    document.body.style.overflow = "";
    document.querySelectorAll(".product-card").forEach((c) => c.classList.remove("selected"));
    metodoPagoSeleccionado = "";
}

// ── Stepper de cantidad ────────────────────────────────────────────────────
function ajustarCantidad(delta) {
    const input = document.getElementById("venta-cantidad");
    const nuevoValor = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
    input.value = nuevoValor;
    recalcularTotal();
}

// ── Recálculo en tiempo real ───────────────────────────────────────────────
function recalcularTotal() {
    const card = document.querySelector(".product-card.selected");
    if (!card) return;
    const precio = parseFloat(card.dataset.precio) || 0;
    const cantidad = parseInt(document.getElementById("venta-cantidad")?.value, 10) || 0;
    document.getElementById("detalle-total").textContent = formatCOP(precio * cantidad);
}

// ── Confirmación y envío ───────────────────────────────────────────────────
async function confirmarVenta() {
    const productoId = document.getElementById("venta-producto-id")?.value;
    const cantidad = parseInt(document.getElementById("venta-cantidad")?.value, 10);
    const metodoPago = metodoPagoSeleccionado;
    const btnConfirmar = document.getElementById("btn-confirmar-venta");

    if (!productoId) {
        showToast("Selecciona un producto primero", "warning");
        return;
    }
    if (!cantidad || cantidad < 1) {
        showToast("La cantidad debe ser al menos 1", "warning");
        return;
    }
    if (!metodoPago) {
        showToast("Selecciona el método de pago", "warning");
        // Animar pills para llamar la atención
        document.getElementById("pago-pills").style.outline = "2px solid var(--accent)";
        setTimeout(() => { document.getElementById("pago-pills").style.outline = ""; }, 1200);
        return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Registrando…";

    try {
        const venta = await API.ventas.registrar({
            producto_id: productoId,
            cantidad,
            metodo_pago: metodoPago,
        });

        showToast(
            `✅ ${venta.producto_nombre} × ${venta.cantidad} — ${formatCOP(venta.total)}`,
            "success"
        );
        cerrarPanel();
    } catch (err) {
        showToast(`Error al registrar: ${err.message}`, "error");
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "✅  Confirmar Venta";
    }
}

// ── Bindings ───────────────────────────────────────────────────────────────
function bindEventos() {
    // Stepper
    document.getElementById("btn-qty-minus")?.addEventListener("click", () => ajustarCantidad(-1));
    document.getElementById("btn-qty-plus")?.addEventListener("click", () => ajustarCantidad(+1));
    document.getElementById("venta-cantidad")?.addEventListener("input", recalcularTotal);

    // Payment pills
    document.querySelectorAll(".pago-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".pago-pill").forEach((p) => p.classList.remove("selected"));
            pill.classList.add("selected");
            metodoPagoSeleccionado = pill.dataset.valor;
            document.getElementById("venta-metodo-pago").value = pill.dataset.valor;
        });
    });

    // Confirm / cancel
    document.getElementById("btn-confirmar-venta")?.addEventListener("click", confirmarVenta);
    document.getElementById("btn-cancelar-venta")?.addEventListener("click", cerrarPanel);

    // Backdrop closes panel (mobile)
    document.getElementById("panel-backdrop")?.addEventListener("click", cerrarPanel);
}
