/* =========================================
   1. UTILIDADES Y ALMACENAMIENTO
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

function textMatch(text, query) { 
    return text.toLowerCase().includes(query.toLowerCase()); 
}

/* =========================================
   2. CARRITO DE COMPRAS (Lógica + WhatsApp)
   ========================================= */
const CART_KEY = 'palermo_cart_v1';
let cart = storage.get(CART_KEY, []);
const PHONE_NUMBER = '5491160065713';

function saveCart() {
    storage.set(CART_KEY, cart);
    updateCartBadge();
}

function addToCart(product) {
    cart.push(product);
    saveCart();
    showToast(`¡${product.nombre} agregado!`);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCartModal(); 
}

function getCartTotals() {
    let total = cart.reduce((sum, item) => sum + item.precio, 0);
    let descuento = 0;
    let promoActiva = false;

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

function updateCartBadge() {
    const badge = document.querySelector('#cart-count');
    if (badge) {
        badge.textContent = cart.length;
        badge.hidden = cart.length === 0;
    }
}

function injectFloatingCart() {
    if (document.getElementById('fab-cart')) return;
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

function injectAddButtons() {
    const items = document.querySelectorAll('.producto, .card[data-precio]');
    items.forEach(item => {
        if(item.querySelector('.btn-add-cart')) return;

        const btn = document.createElement('button');
        btn.className = 'btn primary btn-add-cart';
        btn.textContent = 'Agregar al Carrito';
        btn.style.marginTop = '10px';
        btn.style.width = '100%';
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const nombre = item.dataset.nombre || item.querySelector('h3')?.textContent;
            const precio = Number(item.dataset.precio) || 0;
            if(nombre && precio) {
                addToCart({ nombre, precio });
            }
        });

        if (item.classList.contains('body')) item.appendChild(btn); 
        else item.appendChild(btn); 
    });
}

function openCartModal() {
    renderCartModal();
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.add('open');
}

function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.remove('open');
}

function renderCartModal() {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cart-modal';
        modal.className = 'modal-backdrop cart-backdrop';
        document.body.appendChild(modal);
    }

    const totals = getCartTotals();
    let itemsHtml = cart.length === 0 ? '<p class="empty-msg">Tu carrito está vacío.</p>' : '<ul class="cart-list">';
    
    if (cart.length > 0) {
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

    const form = modal.querySelector('#checkout-form');
    if(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            finalizeCheckout(totals);
        });
    }
}

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

    const url = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

/* =========================================
   3. FUNCIONES UI (Nav, Reveal, Gallery)
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
        if (href.endsWith(path)) a.setAttribute('aria-current', 'page');
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

function initGallery() {
    if (!isOnPage('gastronomia')) return;
    on('click', '.gallery .item', (e, item) => {
        if(e.target.classList.contains('btn-add-cart')) return;
        const img = item.querySelector('img');
        const caption = item.querySelector('figcaption')?.textContent || '';
        const node = document.createElement('div');
        node.innerHTML = `<img src="${img?.src || ''}" style="width:100%"><h3 style="text-align:center;margin-top:1rem;">${caption}</h3>`;
        
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop open';
        backdrop.innerHTML = `<div class="modal"><header><button class="btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button></header><div class="content"></div></div>`;
        backdrop.querySelector('.content').appendChild(node);
        document.body.appendChild(backdrop);
    });
}

/* =========================================
   4. BUSCADORES (PERFUMES Y OFERTAS)
   ========================================= */
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
            let matchGenero = (genero === 'todos') || (genero === categoria) || (categoria === 'unisex' && genero !== 'todos');
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

// ESTA ES LA FUNCIÓN QUE FALTABA PARA LAS OFERTAS
function initOfertas() {
    if (!isOnPage('ofertas')) return;
    const search = document.querySelector('#search-ofertas');
    const min = document.querySelector('#min-precio');
    const max = document.querySelector('#max-precio');
    const empty = document.querySelector('#ofertas-empty');
    const cards = Array.from(document.querySelectorAll('.card[data-precio]'));

    function apply() {
        const q = search?.value.trim() || '';
        const minV = Number(min?.value || 0);
        const maxV = Number(max?.value || 9999999); 
        let visible = 0;
        cards.forEach(card => {
            const precio = Number(card.dataset.precio) || 0;
            const nombre = card.dataset.nombre || '';
            const ok = (!q || textMatch(nombre, q)) && precio >= minV && precio <= maxV;
            card.style.display = ok ? '' : 'none';
            if (ok) visible++;
        });
        if (empty) empty.hidden = visible !== 0;
    }
    
    [search, min, max].forEach(el => el?.addEventListener('input', apply));
    apply(); // Ejecutar al inicio
}

/* =========================================
   5. CONTACTO Y CHATBOT
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

function initChatbot() {
    if (!isOnPage('contacto')) return;
    const win = document.querySelector('#chat-window');
    const form = document.querySelector('#chat-form');
    const input = document.querySelector('#chat-input');
    if (!win || !form || !input) return;

    const optionsText = (
        'Elegí una opción:\n' +
        '1) Tecnología\n' +
        '2) Celulares\n' +
        '3) Relojes\n' +
        '4) Perfumes\n' +
        '5) Ofertas\n' +
        '6) Ubicación'
    );

    const responses = {
        tech: 'Mirá nuestra sección de <a href="locales.html">Tecnología</a>.',
        celulares: 'Encontrá iPhone y Androids en <a href="gastronomia.html">Celulares</a>.',
        relojes: 'Nuestra colección de lujo está en <a href="entretenimientos.html">Relojes</a>.',
        perfumes: 'Fragancias importadas en <a href="servicios.html">Perfumes</a>.',
        ofertas: 'Aprovechá los descuentos en <a href="ofertas.html">Ofertas</a>.',
        location: 'Estamos en Palermo Soho, Buenos Aires. ¡Te esperamos!',
    };

    const mapToKey = (txt) => {
        const t = (txt || '').trim().toLowerCase();
        if (['1', 'tecnologia', 'tech'].includes(t)) return 'tech';
        if (['2', 'celulares', 'iphone'].includes(t)) return 'celulares';
        if (['3', 'relojes', 'watch'].includes(t)) return 'relojes';
        if (['4', 'perfumes', 'vapes'].includes(t)) return 'perfumes';
        if (['5', 'ofertas', 'promo'].includes(t)) return 'ofertas';
        if (['6', 'ubicacion', 'donde'].includes(t)) return 'location';
        return null;
    };

    function addMsg(text, from = 'bot', asHTML = false) {
        const div = document.createElement('div');
        div.className = `chat-msg ${from === 'user' ? 'from-user' : 'from-bot'}`;
        if (asHTML) div.innerHTML = text; else div.textContent = text;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
    }

    function showMenu() {
        addMsg('¡Hola! Soy el asistente de Palermo Store.');
        addMsg(optionsText);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value;
        if (!val.trim()) return;
        addMsg(val, 'user');
        const key = mapToKey(val);
        if (!key) {
            addMsg('Opción no entendida. Probá con el número.');
            addMsg(optionsText);
        } else {
            addMsg(responses[key], 'bot', true);
            addMsg('¿Algo más?');
            addMsg(optionsText);
        }
        input.value = '';
        input.focus();
    });

    showMenu(); // Iniciamos el chat
}

/* =========================================
   6. INICIALIZACIÓN
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.page = getPageSlug();
    Array.from(document.querySelectorAll('#year')).forEach(el => el.textContent = new Date().getFullYear());

    // Inicializar componentes
    initNav();
    initReveal();
    initAccordion();
    initGallery();
    
    // Inicializar E-commerce y Buscadores
    injectFloatingCart();
    injectAddButtons();
    initPerfumesSearch(); // Buscador en Perfumes
    initOfertas();        // Buscador en Ofertas (¡Ahora sí funcionará!)
    initContacto();
    
    // Inicializar Chatbot
    initChatbot();
});
