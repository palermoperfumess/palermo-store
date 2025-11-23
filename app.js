/* =========================================
   GESTIÓN DEL ALMACENAMIENTO Y UTILIDADES
   ========================================= */
const storage = {
    get(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    del(key) { localStorage.removeItem(key); }
};

function getPageSlug() {
    const file = (location.pathname.split('/').pop() || 'index.html');
    return file.replace('.html', '');
}

function on(type, sel, handler, opts) {
    document.addEventListener(type, (e) => {
        const target = e.target.closest(sel);
        if (target) handler(e, target);
    }, opts);
}

function isOnPage(id) {
    return (document.body.dataset.page === id) || (getPageSlug() === id);
}

/* =========================================
   CARRITO DE COMPRAS (Lógica + WhatsApp)
   ========================================= */
const CART_KEY = 'palermo_cart_v1';
let cart = storage.get(CART_KEY, []);
const PHONE_NUMBER = '5491160065713'; // Tu número

// Guardar carrito
function saveCart() {
    storage.set(CART_KEY, cart);
    updateCartBadge();
}

// Agregar item
function addToCart(product) {
    cart.push(product);
    saveCart();
    showToast(`¡${product.nombre} agregado!`);
}

// Eliminar item (por índice)
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCartModal(); // Re-renderizar si está abierto
}

// Calcular totales y promociones
function getCartTotals() {
    let total = cart.reduce((sum, item) => sum + item.precio, 0);
    let descuento = 0;
    let promoActiva = false;

    // REGLA DE PROMOCIÓN: 10% de descuento si llevas 3 o más productos
    if (cart.length >= 3) {
        descuento = total * 0.10;
        promoActiva = true;
    }

    return {
        subtotal: total,
        descuento: descuento,
        totalFinal: total - descuento,
        promoActiva: promoActiva
    };
}

// Actualizar el numerito rojo del carrito
function updateCartBadge() {
    const badge = document.querySelector('#cart-count');
    if (badge) {
        badge.textContent = cart.length;
        badge.hidden = cart.length === 0;
    }
}

// Inyectar el botón flotante del carrito en el HTML
function injectFloatingCart() {
    const div = document.createElement('div');
    div.innerHTML = `
        <button id="fab-cart" class="fab-cart" aria-label="Ver carrito">
            🛒
            <span id="cart-count" class="cart-count" hidden>0</span>
        </button>
    `;
    document.body.appendChild(div);
    updateCartBadge();
    
    document.getElementById('fab-cart').addEventListener('click', openCartModal);
}

// Inyectar botones de "Agregar" en los productos existentes
function injectAddButtons() {
    // Selecciona tarjetas de productos (.producto y .card en ofertas)
    const items = document.querySelectorAll('.producto, .card[data-precio]');
    
    items.forEach(item => {
        // Verificar si ya tiene botón para no duplicar
        if(item.querySelector('.btn-add-cart')) return;

        const btn = document.createElement('button');
        btn.className = 'btn primary btn-add-cart';
        btn.textContent = 'Agregar al Carrito';
        btn.style.marginTop = '10px';
        btn.style.width = '100%';
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar abrir modal de imagen
            const nombre = item.dataset.nombre || item.querySelector('h3')?.textContent;
            const precio = Number(item.dataset.precio) || 0;
            
            if(nombre && precio) {
                addToCart({ nombre, precio });
            }
        });

        // Insertar botón al final del elemento
        if (item.classList.contains('body')) {
             item.appendChild(btn); // Para estructura .card
        } else {
             item.appendChild(btn); // Para estructura .producto
        }
    });
}

// Mostrar el Carrito (Modal)
function openCartModal() {
    renderCartModal();
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.add('open');
}

function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.remove('open');
}

// Renderizar contenido del carrito
function renderCartModal() {
    let modal = document.getElementById('cart-modal');
    
    // Si no existe el modal, lo creamos
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cart-modal';
        modal.className = 'modal-backdrop cart-backdrop';
        document.body.appendChild(modal);
    }

    const totals = getCartTotals();

    let itemsHtml = '';
    if (cart.length === 0) {
        itemsHtml = '<p class="empty-msg">Tu carrito está vacío.</p>';
    } else {
        itemsHtml = '<ul class="cart-list">';
        cart.forEach((item, index) => {
            itemsHtml += `
                <li class="cart-item">
                    <span>${item.nombre}</span>
                    <div class="cart-actions">
                        <span>$${item.precio}</span>
                        <button onclick="removeFromCart(${index})" class="btn-remove">✕</button>
                    </div>
                </li>`;
        });
        itemsHtml += '</ul>';
    }

    const promoHtml = totals.promoActiva 
        ? `<div class="promo-alert">¡Descuento del 10% aplicado por llevar +3 productos!</div>` 
        : `<div class="promo-hint">Tip: Llevá 3 productos para 10% OFF</div>`;

    modal.innerHTML = `
        <div class="modal cart-window">
            <header>
                <h2>Tu Pedido</h2>
                <button class="btn-icon" onclick="closeCartModal()">✕</button>
            </header>
            <div class="content">
                ${itemsHtml}
                <hr>
                ${promoHtml}
                <div class="cart-summary">
                    <div class="row"><span>Subtotal:</span> <span>$${totals.subtotal}</span></div>
                    <div class="row discount"><span>Descuento:</span> <span>-$${totals.descuento}</span></div>
                    <div class="row total"><span>Total:</span> <span>$${totals.totalFinal}</span></div>
                </div>
                
                ${cart.length > 0 ? `
                <form id="checkout-form" class="checkout-form">
                    <h3>Datos de Envío</h3>
                    <input type="text" id="cx-nombre" placeholder="Nombre y Apellido" required>
                    <input type="text" id="cx-direccion" placeholder="Dirección (Calle y Altura)" required>
                    <div class="row-inputs">
                        <input type="text" id="cx-cp" placeholder="C.P." required>
                        <input type="text" id="cx-localidad" placeholder="Localidad" required>
                    </div>
                    <button type="submit" class="btn primary full-width">Realizar Pedido por WhatsApp</button>
                </form>
                ` : ''}
            </div>
        </div>
    `;

    // Manejar envío del formulario de checkout
    const form = modal.querySelector('#checkout-form');
    if(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            finalizeCheckout(totals);
        });
    }
}

// Finalizar Compra (Enviar a WhatsApp)
function finalizeCheckout(totals) {
    const nombre = document.getElementById('cx-nombre').value;
    const direccion = document.getElementById('cx-direccion').value;
    const cp = document.getElementById('cx-cp').value;
    const localidad = document.getElementById('cx-localidad').value;

    let mensaje = `*¡Hola Palermo Store! Quiero realizar un pedido.*\n\n`;
    mensaje += `*Cliente:* ${nombre}\n`;
    mensaje += `*Dirección:* ${direccion}, ${localidad} (CP: ${cp})\n\n`;
    mensaje += `*PEDIDO:*\n`;
    
    cart.forEach(item => {
        mensaje += `- ${item.nombre} ($${item.precio})\n`;
    });

    mensaje += `\nSubtotal: $${totals.subtotal}`;
    if(totals.promoActiva) mensaje += `\nDescuento: -$${totals.descuento}`;
    mensaje += `\n*TOTAL A PAGAR: $${totals.totalFinal}*`;

    // Abrir WhatsApp
    const url = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    // Opcional: Limpiar carrito después de pedir
    // cart = []; saveCart(); closeCartModal(); updateCartBadge();
}

// Notificación pequeña (Toast)
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

/* =========================================
   FUNCIONES EXISTENTES (Navegación, etc)
   ========================================= */

function initNav() {
    const menu = document.querySelector('.nav-links');
    const burger = document.querySelector('#burger');
    if (!menu || !burger) return;
    burger.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        burger.setAttribute('aria-expanded', open);
    });
    on('click', '.nav-links a', () => {
        if (menu.classList.contains('open')) {
            menu.classList.remove('open');
            burger.setAttribute('aria-expanded', false);
        }
    });
    const path = location.pathname.split('/').pop() || 'index.html';
    Array.from(document.querySelectorAll('.nav-links a')).forEach(a => {
        const href = a.getAttribute('href');
        if (href.endsWith(path)) {
            a.setAttribute('aria-current', 'page');
        }
    });
}

function initReveal() {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (en.isIntersecting) {
                en.target.classList.add('visible');
                io.unobserve(en.target);
            }
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    els.forEach(el => io.observe(el));
}

function initAccordion() {
    if (!isOnPage('servicios')) return;
    on('click', '.accordion-header', (e, btn) => {
        const item = btn.closest('.accordion-item');
        if (!item) return;
        const open = item.hasAttribute('open');
        if (open) item.removeAttribute('open'); else item.setAttribute('open', '');
        const panel = item.querySelector('.accordion-panel');
        btn.setAttribute('aria-expanded', String(!open));
        if (panel) panel.hidden = open;
    });
}

/* =========================================
   CONTACTO A WHATSAPP (Modificado)
   ========================================= */
function initContacto() {
    if (!isOnPage('contacto')) return;
    const form = document.querySelector('#contacto-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const email = document.getElementById('email').value;
        const motivo = document.getElementById('motivo').value;
        const mensajeTexto = document.getElementById('mensaje').value;

        let whatsappMsg = `*Consulta desde la Web*\n\n`;
        whatsappMsg += `*Nombre:* ${nombre}\n`;
        whatsappMsg += `*Email:* ${email}\n`;
        whatsappMsg += `*Motivo:* ${motivo}\n`;
        whatsappMsg += `*Mensaje:* ${mensajeTexto}`;

        const url = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(whatsappMsg)}`;
        window.open(url, '_blank');
        
        form.reset();
    });
}

function initGallery() {
    if (!isOnPage('gastronomia')) return;
    on('click', '.gallery .item', (e, item) => {
        // Verificamos que no se haya clickeado el botón
        if(e.target.classList.contains('btn-add-cart')) return;
        
        const img = item.querySelector('img');
        const caption = item.querySelector('figcaption')?.textContent || '';
        const node = document.createElement('div');
        node.innerHTML = `<img src="${img?.src || ''}" style="width:100%"><h3 style="text-align:center;margin-top:1rem;">${caption}</h3>`;
        
        // Usar el modal simple para galería
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop open';
        backdrop.innerHTML = `<div class="modal"><header><button class="btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button></header><div class="content"></div></div>`;
        backdrop.querySelector('.content').appendChild(node);
        document.body.appendChild(backdrop);
    });
}

function initPerfumesSearch() {
    if (!isOnPage('servicios')) return;

    const inputSearch = document.querySelector('#search-perfume');
    const selectGender = document.querySelector('#filter-genero');
    const inputPrice = document.querySelector('#max-price-perfume');
    const emptyMsg = document.querySelector('#perfumes-empty');
    const cards = Array.from(document.querySelectorAll('#lista-perfumes .producto'));

    function filterPerfumes() {
        const texto = inputSearch.value.toLowerCase().trim();
        const genero = selectGender.value; 
        const precioMax = inputPrice.value ? Number(inputPrice.value) : 9999999;

        let visibles = 0;

        cards.forEach(card => {
            const nombre = (card.dataset.nombre || '').toLowerCase();
            const categoria = card.dataset.categoria || 'unisex';
            const precio = Number(card.dataset.precio) || 0;

            const matchNombre = !texto || nombre.includes(texto);
            let matchGenero = false;
            if (genero === 'todos') matchGenero = true;
            else if (genero === categoria) matchGenero = true;
            else if (categoria === 'unisex' && genero !== 'todos') matchGenero = true;

            const matchPrecio = precio <= precioMax;

            if (matchNombre && matchGenero && matchPrecio) {
                card.style.display = ''; visibles++;
            } else {
                card.style.display = 'none';
            }
        });

        if (emptyMsg) emptyMsg.hidden = visibles > 0;
    }

    if (inputSearch) inputSearch.addEventListener('input', filterPerfumes);
    if (selectGender) selectGender.addEventListener('change', filterPerfumes);
    if (inputPrice) inputPrice.addEventListener('input', filterPerfumes);
}

// Inicialización General
document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.page = getPageSlug();
    Array.from(document.querySelectorAll('#year')).forEach(el => el.textContent = new Date().getFullYear());

    initNav();
    initReveal();
    initAccordion();
    initGallery(); // Galería ahora respeta el botón de compra
    
    // Funcionalidades de E-commerce
    injectFloatingCart(); // Crea el botón flotante
    injectAddButtons();   // Agrega botones a los productos
    initPerfumesSearch();
    initContacto();       // Contacto ahora envía WhatsApp
});