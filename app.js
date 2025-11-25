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
        if(item.querySelector('.btn-actions-container')) return;

        const container = document.createElement('div');
        container.className = 'btn-actions-container';
        container.style.marginTop = '10px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '5px';

        const btnCart = document.createElement('button');
        btnCart.className = 'btn primary btn-add-cart';
        btnCart.textContent = 'Agregar al Carrito';
        btnCart.style.width = '100%';
        btnCart.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const nombre = item.dataset.nombre || item.querySelector('h3')?.textContent;
            const precio = Number(item.dataset.precio) || 0;
            if(nombre && precio) addToCart({ nombre, precio });
        });
        container.appendChild(btnCart);

        const mpLink = item.dataset.mp; 
        if (mpLink) {
            const btnMP = document.createElement('button');
            btnMP.className = 'btn mp-btn';
            btnMP.textContent = 'Pagar con Mercado Pago';
            btnMP.style.width = '100%';
            btnMP.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(mpLink, '_blank');
            });
            container.appendChild(btnMP);
        }

        if (item.classList.contains('body')) item.appendChild(container); 
        else item.appendChild(container); 
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
   3. CARRUSEL (Esta es la función que faltaba)
   ========================================= */
function initCarousel() {
    if (!isOnPage('entretenimientos')) return;
    
    const track = document.querySelector('.carousel-track');
    const slides = Array.from(document.querySelectorAll('.carousel-slide'));
    const nextButton = document.querySelector('.carousel .next');
    const prevButton = document.querySelector('.carousel .prev');
    const dotsNav = document.querySelector('.carousel-indicators');
    const dots = Array.from(dotsNav.children);

    if (!track || slides.length === 0) return;

    const slideWidth = slides[0].getBoundingClientRect().width;

    // Acomodar slides uno al lado del otro
    const setSlidePosition = (slide, index) => {
        slide.style.left = slideWidth * index + 'px';
    };
    slides.forEach(setSlidePosition);

    const moveToSlide = (track, currentSlide, targetSlide) => {
        track.style.transform = 'translateX(-' + targetSlide.style.left + ')';
        currentSlide.classList.remove('current-slide');
        targetSlide.classList.add('current-slide');
    }

    const updateDots = (currentDot, targetDot) => {
        currentDot.setAttribute('aria-current', 'false');
        targetDot.setAttribute('aria-current', 'true');
    }

    // Next Button
    nextButton.addEventListener('click', e => {
        const currentSlide = track.querySelector('.current-slide') || slides[0];
        let nextSlide = currentSlide.nextElementSibling;
        const currentDot = dotsNav.querySelector('[aria-current="true"]') || dots[0];
        let nextDot = currentDot.nextElementSibling;

        // Loop vuelta al principio
        if (!nextSlide) {
            nextSlide = slides[0];
            nextDot = dots[0];
        }

        moveToSlide(track, currentSlide, nextSlide);
        updateDots(currentDot, nextDot);
    });

    // Prev Button
    prevButton.addEventListener('click', e => {
        const currentSlide = track.querySelector('.current-slide') || slides[0];
        let prevSlide = currentSlide.previousElementSibling;
        const currentDot = dotsNav.querySelector('[aria-current="true"]') || dots[0];
        let prevDot = currentDot.previousElementSibling;

        // Loop vuelta al final
        if (!prevSlide) {
            prevSlide = slides[slides.length - 1];
            prevDot = dots[dots.length - 1];
        }

        moveToSlide(track, currentSlide, prevSlide);
        updateDots(currentDot, prevDot);
    });

    // Dots
    dotsNav.addEventListener('click', e => {
        const targetDot = e.target.closest('button');
        if (!targetDot) return;

        const currentSlide = track.querySelector('.current-slide') || slides[0];
        const currentDot = dotsNav.querySelector('[aria-current="true"]') || dots[0];
        const targetIndex = dots.findIndex(dot => dot === targetDot);
        const targetSlide = slides[targetIndex];

        moveToSlide(track, currentSlide, targetSlide);
        updateDots(currentDot, targetDot);
    });

    // Inicializar clase
    slides[0].classList.add('current-slide');
}

/* =========================================
   4. FUNCIONES UI (Nav, Reveal, etc)
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
    apply(); 
}

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

    const optionsText = 'Elegí una opción:\n1) Tecnología\n2) Celulares\n3) Relojes\n4) Perfumes\n5) Ofertas\n6) Ubicación';
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

    showMenu(); 
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.page = getPageSlug();
    Array.from(document.querySelectorAll('#year')).forEach(el => el.textContent = new Date().getFullYear());

    initNav();
    initReveal();
    initAccordion();
    initGallery();
    initCarousel(); // <--- AHORA SÍ SE INICIA EL CARRUSEL
    injectFloatingCart();
    injectAddButtons();
    initPerfumesSearch();
    initOfertas();
    initContacto();
    initChatbot();
});
/* =========================================
   5. SISTEMA DE DETALLE DE PRODUCTOS
   ========================================= */

// Simulación de Base de Datos
const productosDB = {
    "redmi15c": {
        nombre: "Redmi 15C",
        precio: 319999,
        img: "https://imgs.search.brave.com/Ou3ia0SyiKGjDjulvFR9rn4sYlMUu7DviNnFWj9ssGA/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9odHRw/Mi5tbHN0YXRpYy5j/b20vRF9RX05QXzJY/XzY5NjQ1OC1NTEE5/Njg5MTYxNTUzOF8x/MTIwMjUtVi53ZWJw",
        descripcion: "El Redmi 15C ofrece un rendimiento sólido con su batería de larga duración y pantalla inmersiva. Ideal para el uso diario, fotos nítidas y juegos ligeros.",
        specs: ["Pantalla: 6.74 pulgadas", "Batería: 5000 mAh", "Cámara: 50MP", "Procesador: Helio G85"]
    },
    "redmi14c": {
        nombre: "Redmi 14C",
        precio: 279999,
        img: "https://imgs.search.brave.com/GSbG_YGLSl3fKsdwq7Z4zHs7oqh8WfCSWHvfUY_-L7w/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9odHRw/Mi5tbHN0YXRpYy5j/b20vRF9RX05QXzJY/Xzc0Nzk5NC1NTEE4/MTcwNjk1NDQ5MF8w/MTIwMjUtVi53ZWJw",
        descripcion: "Un clásico renovado. El Redmi 14C equilibra precio y calidad con un diseño elegante y funcionalidades esenciales para mantenerte conectado.",
        specs: ["Pantalla: 6.5 pulgadas", "Batería: 4500 mAh", "Cámara: 13MP Dual", "Memoria: 128GB"]
    },
    "pococ75": {
        nombre: "Poco C75",
        precio: 299999,
        img: "https://images.fravega.com/f500/64c704b931aa59284221070eb6bb9bb4.jpg",
        descripcion: "Potencia tu día con el Poco C75. Diseñado para jóvenes que buscan estilo y velocidad a un precio accesible.",
        specs: ["Pantalla: 90Hz", "Carga Rápida", "Diseño Ultra Fino", "Android 14"]
    }
};

function initDetalle() {
    // Solo ejecutar si estamos en la página de detalle
    if (!location.pathname.includes('detalle.html')) return;

    // 1. Obtener el ID de la URL (ej: ?id=redmi15c)
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    const producto = productosDB[id];
    const container = document.getElementById('detalle-container');

    // 2. Si no existe el producto, mostrar error
    if (!producto) {
        container.innerHTML = "<h2>Producto no encontrado 😢</h2><a href='index.html' class='btn primary'>Volver al inicio</a>";
        return;
    }

    // 3. Rellenar la información en el HTML
    document.getElementById('det-img').src = producto.img;
    document.getElementById('det-titulo').textContent = producto.nombre;
    document.getElementById('det-precio').textContent = `$${producto.precio.toLocaleString('es-AR')}`;
    document.getElementById('det-desc').textContent = producto.descripcion;

    // Rellenar lista de características
    const ul = document.getElementById('det-specs');
    producto.specs.forEach(spec => {
        const li = document.createElement('li');
        li.textContent = spec;
        ul.appendChild(li);
    });

    // Configurar botón de compra
    const btn = document.getElementById('det-btn-add');
    btn.onclick = () => addToCart({ nombre: producto.nombre, precio: producto.precio });
}

// Agregar esto al final del DOMContentLoaded existente en app.js
document.addEventListener('DOMContentLoaded', () => {
    // ... tus otras funciones ...
    initDetalle(); 
});
