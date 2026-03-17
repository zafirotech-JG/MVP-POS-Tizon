/**
 * POS Module — Registro de ventas con carrito multi-producto
 * Incluye: carrito, domicilio (+$1000/unidad), pasarela de pago con cambio.
 */

import { API } from "./api.js";
import { showToast, formatCOP } from "./utils.js";

// ── Estado ────────────────────────────────────────────────────────────────
let productos = [];
let carrito = []; // [{id, nombre, precio, cantidad}]
let domicilioActivo = false;
let metodoPagoSeleccionado = "";
let filtroTexto = "";
let filtroCategoria = "";
const DOMICILIO_POR_UNIDAD = 1000;

export function initPOS() {
    bindEventos();
    cargarProductos();
}

// ── Carga productos del backend ────────────────────────────────────────────
async function cargarProductos() {
    const grilla = document.getElementById("grilla-productos");
    if (grilla && (!grilla.children.length || grilla.innerHTML.includes("Cargando"))) {
        grilla.innerHTML = Array(6).fill('<div class="product-card skeleton"><span class="product-name">...</span><span class="product-price">...</span></div>').join('');
    }

    try {
        productos = await API.productos.listar();
        await poblarFiltroCategorias();
        renderGrilla();
    } catch (err) {
        showToast(`Error cargando productos: ${err.message}`, "error");
        if (grilla) grilla.innerHTML = `<p style="color:var(--danger);font-size:0.88rem;grid-column:1/-1">No se pudo cargar el menú</p>`;
    }
}

async function poblarFiltroCategorias() {
    const select = document.getElementById("filtro-categoria-pos");
    if (!select) return;

    let categorias = [];
    try {
        categorias = await API.categorias.listar();
    } catch {
        const unicas = [...new Set(productos.map((p) => (p.categoria || "General").trim()))];
        categorias = unicas.map((nombre, idx) => ({ id: String(idx), nombre }));
    }

    const opciones = categorias
        .map((c) => `<option value="${c.nombre}">${c.nombre}</option>`)
        .join("");
    select.innerHTML = `<option value="">Todas las categorías</option>${opciones}`;
}

// ── Grilla de productos ────────────────────────────────────────────────────
function renderGrilla() {
    const grilla = document.getElementById("grilla-productos");
    if (!grilla) return;

    const texto = filtroTexto.trim().toLowerCase();
    const categoria = filtroCategoria.trim().toLowerCase();
    const filtrados = productos.filter((p) => {
        const coincideTexto = texto ? p.nombre.toLowerCase().includes(texto) : true;
        const categoriaProducto = String(p.categoria || "General").toLowerCase();
        const coincideCategoria = categoria ? categoriaProducto === categoria : true;
        return coincideTexto && coincideCategoria;
    });

    if (productos.length === 0) {
        grilla.innerHTML = `<p style="color:var(--text-muted);font-size:0.88rem;grid-column:1/-1">No hay productos registrados. Agrega uno en Inventario.</p>`;
        return;
    }

    if (filtrados.length === 0) {
        grilla.innerHTML = `<p style="color:var(--text-muted);font-size:0.88rem;grid-column:1/-1">No se encontraron productos con los filtros actuales</p>`;
        return;
    }

    grilla.innerHTML = "";
    filtrados.forEach((p) => {
        const enCarrito = carrito.find(item => item.id === p.id);
        const card = document.createElement("button");
        card.className = "product-card" + (enCarrito ? " added" : "");
        card.type = "button";
        card.dataset.id = p.id;
        card.innerHTML = `
      <span class="product-name">${p.nombre}</span>
      <span class="product-price">${formatCOP(p.precio)}</span>
    `;
        card.addEventListener("click", () => agregarAlCarrito(p));
        grilla.appendChild(card);
    });
}

// ── Carrito: agregar producto ──────────────────────────────────────────────
function agregarAlCarrito(producto) {
    const existente = carrito.find(item => item.id === producto.id);
    if (existente) {
        existente.cantidad++;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            cantidad: 1,
        });
    }

    // Feedback visual en la tarjeta
    const card = document.querySelector(`.product-card[data-id="${producto.id}"]`);
    if (card) {
        card.classList.add("added");
        card.style.transform = "scale(0.93)";
        setTimeout(() => { card.style.transform = ""; }, 150);
    }

    renderCarrito();
    recalcularTotales();
}

// ── Carrito: modificar cantidad ────────────────────────────────────────────
function cambiarCantidad(productoId, delta) {
    const item = carrito.find(i => i.id === productoId);
    if (!item) return;

    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(i => i.id !== productoId);
        // Quitar clase "added" de la tarjeta del catálogo
        const card = document.querySelector(`.product-card[data-id="${productoId}"]`);
        if (card) card.classList.remove("added");
    }

    renderCarrito();
    recalcularTotales();
}

// ── Carrito: vaciar ────────────────────────────────────────────────────────
function vaciarCarrito() {
    carrito = [];
    document.querySelectorAll(".product-card.added").forEach(c => c.classList.remove("added"));
    renderCarrito();
    recalcularTotales();
}

// ── Render del carrito ─────────────────────────────────────────────────────
function renderCarrito() {
    const container = document.getElementById("carrito-items");
    if (!container) return;

    if (carrito.length === 0) {
        container.innerHTML = `
            <div class="carrito-vacio">
                <span class="carrito-vacio-icon">🛒</span>
                <p>Tu carrito está vacío</p>
                <span>Selecciona productos del catálogo</span>
            </div>`;
        return;
    }

    container.innerHTML = carrito.map(item => `
        <div class="carrito-item" data-id="${item.id}">
            <div class="carrito-item-info">
                <div class="carrito-item-nombre">${item.nombre}</div>
                <div class="carrito-item-precio">${formatCOP(item.precio)} c/u</div>
            </div>
            <div class="cart-qty">
                <button type="button" class="${item.cantidad === 1 ? 'btn-remove' : ''}" data-action="minus" data-id="${item.id}">${item.cantidad === 1 ? '🗑' : '−'}</button>
                <span class="cart-qty-val">${item.cantidad}</span>
                <button type="button" data-action="plus" data-id="${item.id}">+</button>
            </div>
            <span class="carrito-item-subtotal">${formatCOP(item.precio * item.cantidad)}</span>
        </div>
    `).join("");

    // Bind qty buttons
    container.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const delta = btn.dataset.action === "plus" ? 1 : -1;
            cambiarCantidad(id, delta);
        });
    });

    // Actualizar badge
    actualizarBadge();
}

// ── Recálculo de totales en tiempo real ────────────────────────────────────
function recalcularTotales() {
    const totalUnidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const domicilio = domicilioActivo ? totalUnidades * DOMICILIO_POR_UNIDAD : 0;
    const total = subtotal + domicilio;

    // Carrito panel
    const elSubtotal = document.getElementById("carrito-subtotal");
    const elDomicilio = document.getElementById("carrito-domicilio");
    const elTotal = document.getElementById("carrito-total");
    const filaDomicilio = document.getElementById("fila-domicilio");
    const btnCobrar = document.getElementById("btn-cobrar");

    if (elSubtotal) elSubtotal.textContent = formatCOP(subtotal);
    if (elDomicilio) elDomicilio.textContent = formatCOP(domicilio);
    if (elTotal) elTotal.textContent = formatCOP(total);

    if (filaDomicilio) {
        filaDomicilio.style.display = domicilioActivo ? "flex" : "none";
    }

    if (btnCobrar) {
        btnCobrar.disabled = carrito.length === 0;
    }

    actualizarBadge();
}

// ── Badge del carrito (mobile) ─────────────────────────────────────────────
function actualizarBadge() {
    const badge = document.getElementById("cart-badge");
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    if (badge) badge.textContent = totalItems;
}

// ── Toggle domicilio ───────────────────────────────────────────────────────
function toggleDomicilio() {
    domicilioActivo = document.getElementById("toggle-domicilio")?.checked || false;
    recalcularTotales();
}

// ── Mobile: abrir/cerrar panel del carrito ─────────────────────────────────
function abrirCarritoMobile() {
    document.getElementById("panel-carrito")?.classList.add("visible");
    document.getElementById("panel-backdrop")?.classList.add("visible");
    document.body.style.overflow = "hidden";
}

function cerrarCarritoMobile() {
    document.getElementById("panel-carrito")?.classList.remove("visible");
    document.getElementById("panel-backdrop")?.classList.remove("visible");
    document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════════════════
// PASARELA DE PAGO (Modal)
// ═══════════════════════════════════════════════════════════════════════════

function abrirModalPago() {
    if (carrito.length === 0) {
        showToast("Agrega productos al carrito primero", "warning");
        return;
    }

    metodoPagoSeleccionado = "";

    // Calcular totales
    const totalUnidades = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    const subtotal = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const domicilio = domicilioActivo ? totalUnidades * DOMICILIO_POR_UNIDAD : 0;
    const total = subtotal + domicilio;

    // Resumen del pedido
    const resumenEl = document.getElementById("pago-resumen-pedido");
    if (resumenEl) {
        resumenEl.innerHTML = carrito.map(item =>
            `<div class="pago-pedido-item">
                <span>${item.nombre} × ${item.cantidad}</span>
                <span>${formatCOP(item.precio * item.cantidad)}</span>
            </div>`
        ).join("");
    }

    // Totales
    document.getElementById("pago-subtotal").textContent = formatCOP(subtotal);

    const filaDom = document.getElementById("pago-fila-domicilio");
    if (filaDom) {
        filaDom.style.display = domicilioActivo ? "flex" : "none";
    }
    document.getElementById("pago-domicilio").textContent = formatCOP(domicilio);
    document.getElementById("pago-total").textContent = formatCOP(total);

    // Reset estado del modal
    document.querySelectorAll("#pago-pills .pago-pill").forEach(p => p.classList.remove("selected"));
    document.getElementById("pago-efectivo-group").style.display = "none";
    document.getElementById("pago-recibido").value = "";
    document.getElementById("pago-cambio-wrap").style.display = "none";
    document.getElementById("btn-registrar-venta").disabled = true;

    // Abrir modal
    document.getElementById("modal-pago")?.classList.add("open");
}

function cerrarModalPago() {
    document.getElementById("modal-pago")?.classList.remove("open");
    metodoPagoSeleccionado = "";
}

function seleccionarMetodoPago(pill) {
    document.querySelectorAll("#pago-pills .pago-pill").forEach(p => p.classList.remove("selected"));
    pill.classList.add("selected");
    metodoPagoSeleccionado = pill.dataset.valor;

    const efectivoGroup = document.getElementById("pago-efectivo-group");
    if (metodoPagoSeleccionado === "Efectivo") {
        efectivoGroup.style.display = "flex";
        document.getElementById("pago-recibido").value = "";
        document.getElementById("pago-cambio-wrap").style.display = "none";
        // Para efectivo, el botón se habilita al ingresar monto suficiente
        document.getElementById("btn-registrar-venta").disabled = true;
    } else {
        efectivoGroup.style.display = "none";
        // Para métodos digitales, habilitar directamente
        document.getElementById("btn-registrar-venta").disabled = false;
    }
}

function calcularCambio() {
    const totalUnidades = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    const subtotal = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const domicilio = domicilioActivo ? totalUnidades * DOMICILIO_POR_UNIDAD : 0;
    const total = subtotal + domicilio;

    const recibido = parseFloat(document.getElementById("pago-recibido")?.value) || 0;
    const cambioWrap = document.getElementById("pago-cambio-wrap");
    const cambioEl = document.getElementById("pago-cambio");
    const btnRegistrar = document.getElementById("btn-registrar-venta");

    if (recibido <= 0) {
        cambioWrap.style.display = "none";
        btnRegistrar.disabled = true;
        return;
    }

    cambioWrap.style.display = "flex";
    const cambio = recibido - total;

    if (cambio >= 0) {
        cambioEl.textContent = formatCOP(cambio);
        cambioWrap.classList.remove("error");
        btnRegistrar.disabled = false;
    } else {
        cambioEl.textContent = `Faltan ${formatCOP(Math.abs(cambio))}`;
        cambioWrap.classList.add("error");
        btnRegistrar.disabled = true;
    }
}

// ── Registrar la venta ─────────────────────────────────────────────────────
async function registrarVenta() {
    if (carrito.length === 0 || !metodoPagoSeleccionado) return;

    const btnRegistrar = document.getElementById("btn-registrar-venta");
    btnRegistrar.disabled = true;
    btnRegistrar.textContent = "Registrando…";

    let exitosos = 0;
    let errores = 0;

    // Registrar cada item del carrito como venta individual
    for (const item of carrito) {
        try {
            await API.ventas.registrar({
                producto_id: item.id,
                cantidad: item.cantidad,
                metodo_pago: metodoPagoSeleccionado,
            });
            exitosos++;
        } catch (err) {
            errores++;
            showToast(`Error registrando ${item.nombre}: ${err.message}`, "error");
        }
    }

    if (exitosos > 0) {
        const totalUnidades = carrito.reduce((sum, i) => sum + i.cantidad, 0);
        const subtotal = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
        const domicilio = domicilioActivo ? totalUnidades * DOMICILIO_POR_UNIDAD : 0;
        const total = subtotal + domicilio;

        showToast(
            `✅ Venta registrada — ${exitosos} producto(s) — ${formatCOP(total)}`,
            "success"
        );

        cerrarModalPago();
        cerrarCarritoMobile();
        vaciarCarrito();

        // Reset domicilio toggle
        domicilioActivo = false;
        const toggle = document.getElementById("toggle-domicilio");
        if (toggle) toggle.checked = false;
        recalcularTotales();
    }

    if (errores > 0 && exitosos === 0) {
        showToast("No se pudo registrar la venta", "error");
    }

    btnRegistrar.disabled = false;
    btnRegistrar.textContent = "✅ Registrar Venta";
}

// ── Bindings ───────────────────────────────────────────────────────────────
function bindEventos() {
    // Búsqueda de productos
    document.getElementById("buscar-producto")?.addEventListener("input", (e) => {
        filtroTexto = e.target.value || "";
        renderGrilla();
    });

    document.getElementById("filtro-categoria-pos")?.addEventListener("change", (e) => {
        filtroCategoria = e.target.value || "";
        renderGrilla();
    });

    // Toggle domicilio
    document.getElementById("toggle-domicilio")?.addEventListener("change", toggleDomicilio);

    // Botón Cobrar
    document.getElementById("btn-cobrar")?.addEventListener("click", abrirModalPago);

    // Vaciar carrito
    document.getElementById("btn-limpiar-carrito")?.addEventListener("click", () => {
        if (carrito.length === 0) return;
        vaciarCarrito();
        showToast("Carrito vaciado", "info");
    });

    // Mobile: abrir/cerrar carrito
    document.getElementById("btn-cart-toggle")?.addEventListener("click", abrirCarritoMobile);
    document.getElementById("btn-cerrar-carrito")?.addEventListener("click", cerrarCarritoMobile);
    document.getElementById("panel-backdrop")?.addEventListener("click", cerrarCarritoMobile);

    // Modal de pago: pills
    document.querySelectorAll("#pago-pills .pago-pill").forEach(pill => {
        pill.addEventListener("click", () => seleccionarMetodoPago(pill));
    });

    // Modal de pago: dinero recibido
    document.getElementById("pago-recibido")?.addEventListener("input", calcularCambio);

    // Modal de pago: registrar / cancelar
    document.getElementById("btn-registrar-venta")?.addEventListener("click", registrarVenta);
    document.getElementById("btn-cancelar-pago")?.addEventListener("click", cerrarModalPago);

    // Cerrar modal de pago con backdrop
    document.getElementById("modal-pago")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-pago") cerrarModalPago();
    });
}
