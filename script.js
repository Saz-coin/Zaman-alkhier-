const SB_URL = 'https://dbkjzpoopvmahoflwkdr.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRia2p6cG9vcHZtYWhvZmx3a2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTUxNTAsImV4cCI6MjA5MjE5MTE1MH0.r1o_lNyALA2oTV2smlvg15p1ULSzQct_S7AUsgq-u30';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

const PHONE = "+96899229230";
let currentItemTitle = '';
let currentBoxId = null;
let currentBoxName = '';
let currentBoxPrice = 0;
let currentBoxHasVat = false;

function sanitizeHtml(text) {
    if (!text) return '';
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(String(text), {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
            ALLOWED_ATTR: ['class', 'style']
        });
    }
    return String(text).replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#x27;';
        return m;
    });
}

function secureUrl(url) {
    if (!url) return '';
    let cleanUrl = String(url).trim();
    if (cleanUrl.startsWith('http://')) {
        cleanUrl = cleanUrl.replace('http://', 'https://');
    }
    if (cleanUrl.startsWith('https://') || cleanUrl.startsWith('/')) {
        return cleanUrl;
    }
    return '';
}

function validateAndSanitizeImageUrl(url) {
    const secured = secureUrl(url);
    const allowedDomains = [
        'raw.githubusercontent.com',
        'dbkjzpoopvmahoflwkdr.supabase.co',
        'placehold.co'
    ];
    if (secured) {
        try {
            const urlObj = new URL(secured);
            if (allowedDomains.some(d => urlObj.hostname.endsWith(d))) {
                return secured;
            }
        } catch(e) {
            return '';
        }
    }
    return '';
}

function formatOMR(price) {
    let numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numericPrice)) numericPrice = 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'OMR',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(numericPrice);
}

function formatPriceWithVAT(price, showVatText) {
    let priceText = formatOMR(price);
    if (showVatText) {
        return priceText + ' + V.A.T 5%';
    }
    return priceText;
}

function parseValue(value) {
    if (typeof value === 'object' && value !== null) return value;
    if (!value) return { title: '', desc: '', details: '', img: '', price: '', show_vat_text: false };
    try {
        let d = JSON.parse(value);
        if (typeof d === 'string') d = JSON.parse(d);
        return d;
    } catch(e) {
        return { title: '', desc: '', details: '', img: '', price: '', show_vat_text: false };
    }
}

let sliderState = {
    currentSlide: 0,
    totalSlides: 0,
    autoSlideInterval: null
};

async function loadSlider() {
    const sliderSection = document.getElementById('main-slider');
    try {
        const { data, error } = await sb.from('content').select('*').eq('section', 'slider').order('order');
        if (error || !data || data.length === 0) {
            if (sliderSection) sliderSection.style.display = 'none';
            return;
        }
        if (sliderSection) sliderSection.style.display = 'block';
        sliderState.totalSlides = data.length;
        sliderState.currentSlide = 0;
        const wrapper = document.getElementById('slider-wrapper');
        const dots = document.getElementById('slider-dots');
        if (!wrapper) return;
        
        const fragment = document.createDocumentFragment();
        data.forEach((item) => {
            const d = parseValue(item.value);
            const imgUrl = validateAndSanitizeImageUrl(d.img || '');
            const slide = document.createElement('div');
            slide.className = 'w-full h-full shrink-0 relative bg-[#111]';
            slide.style.flex = '0 0 100%';
            if (imgUrl) {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'w-full h-full object-cover';
                img.style.backgroundColor = '#111';
                img.draggable = false;
                img.loading = 'lazy';
                img.alt = 'شريحة';
                slide.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'w-full h-full bg-[#333] flex items-center justify-center';
                placeholder.innerHTML = '<span class="text-gray-500">لا يوجد صورة</span>';
                slide.appendChild(placeholder);
            }
            fragment.appendChild(slide);
        });
        wrapper.innerHTML = '';
        wrapper.appendChild(fragment);
        
        if (dots) {
            dots.innerHTML = '';
            data.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.className = 'w-2 h-2 rounded-full bg-white/40 hover:bg-white transition-all';
                dot.setAttribute('aria-label', 'شريحة ' + (i + 1));
                dot.addEventListener('click', () => goToSlide(i));
                dots.appendChild(dot);
            });
        }
        goToSlide(0);
    } catch(err) {
        if (sliderSection) sliderSection.style.display = 'none';
    }
}

function goToSlide(index) {
    sliderState.currentSlide = index;
    const wrapper = document.getElementById('slider-wrapper');
    if (!wrapper) return;
    const translatePercent = index * -100;
    wrapper.style.transition = 'transform 0.3s ease-out';
    wrapper.style.transform = 'translateX(' + translatePercent + '%)';
    document.querySelectorAll('#slider-dots button').forEach((dot, i) => {
        dot.classList.toggle('bg-white', i === index);
        dot.classList.toggle('bg-white/40', i !== index);
    });
}

async function loadContent() {
    const servicesGrid = document.getElementById('services-grid');
    const offersGrid = document.getElementById('offers-grid');
    try {
        const { data, error } = await sb.from('content').select('*').eq('type', 'item').in('section', ['services', 'offers']).order('order');
        if (error || !data) return;
        const services = data.filter(item => item.section === 'services');
        const offers = data.filter(item => item.section === 'offers');
        if (servicesGrid) {
            if (services.length === 0) {
                document.getElementById('services-section').style.display = 'none';
            } else {
                servicesGrid.innerHTML = '';
                renderCards(services, servicesGrid);
            }
        }
        if (offersGrid) {
            if (offers.length === 0) {
                document.getElementById('offers-section').style.display = 'none';
            } else {
                offersGrid.innerHTML = '';
                renderCards(offers, offersGrid);
            }
        }
    } catch(err) {}
}

function renderCards(items, container) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const d = parseValue(item.value);
        const hasPrice = d.price && !isNaN(parseFloat(d.price));
        const priceDisplay = hasPrice ? formatPriceWithVAT(parseFloat(d.price), d.show_vat_text) : '';
        const safeTitle = sanitizeHtml(d.title || '');
        const safeDesc = sanitizeHtml(d.desc || '');
        const safeImg = validateAndSanitizeImageUrl(d.img || '');
        const defaultImg = 'https://placehold.co/600x400/333/666?text=Zaman+Alkhair';
        const safeId = sanitizeHtml(item.id);
        const safePriceDisplay = sanitizeHtml(priceDisplay);
        
        const card = document.createElement('div');
        card.className = 'service-card group';
        
        const img = document.createElement('img');
        img.src = safeImg || defaultImg;
        img.className = 'card-bg';
        img.alt = safeTitle;
        img.loading = 'lazy';
        img.onerror = function() { this.src = defaultImg; };
        
        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        
        const content = document.createElement('div');
        content.className = 'card-content';
        
        const topDiv = document.createElement('div');
        const h3 = document.createElement('h3');
        h3.className = 'text-2xl font-bold mb-3 text-white';
        h3.textContent = safeTitle;
        const p = document.createElement('p');
        p.className = 'text-gray-300 text-sm mb-6 font-light line-clamp-2';
        p.textContent = safeDesc;
        topDiv.appendChild(h3);
        topDiv.appendChild(p);
        
        const bottomDiv = document.createElement('div');
        bottomDiv.className = 'flex items-center justify-between';
        
        const moreBtn = document.createElement('button');
        moreBtn.className = 'btn-more';
        moreBtn.innerHTML = 'التفاصيل <span class="mr-1">‹</span>';
        moreBtn.addEventListener('click', () => openModal(item.id));
        
        bottomDiv.appendChild(moreBtn);
        
        if (hasPrice) {
            const priceDiv = document.createElement('div');
            priceDiv.className = 'text-left';
            const priceSpan = document.createElement('div');
            priceSpan.className = 'text-2xl md:text-3xl font-black gold-gradient-text';
            priceSpan.textContent = safePriceDisplay;
            priceDiv.appendChild(priceSpan);
            bottomDiv.appendChild(priceDiv);
        }
        
        content.appendChild(topDiv);
        content.appendChild(bottomDiv);
        card.appendChild(img);
        card.appendChild(overlay);
        card.appendChild(content);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

async function loadBoxesForModal() {
    try {
        const { data, error } = await sb.from('boxes').select('*').order('order_index', { ascending: true });
        if (error || !data || data.length === 0) return [];
        return data;
    } catch(err) {
        return [];
    }
}

function renderBoxesInModal(boxes) {
    const boxesGrid = document.getElementById('boxesGrid');
    if (!boxesGrid) return;
    if (boxes.length === 0) {
        document.getElementById('boxesSection').style.display = 'none';
        return;
    }
    boxesGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    boxes.forEach(box => {
        let price = typeof box.price === 'string' ? parseFloat(box.price) : box.price;
        let priceDisplay = formatPriceWithVAT(price, box.show_vat_text);
        let displayText = (box.description || box.details || '').substring(0, 100);
        const safeName = sanitizeHtml(box.name);
        const safeDesc = sanitizeHtml(displayText);
        const safePriceDisplay = sanitizeHtml(priceDisplay);
        const safeImg = validateAndSanitizeImageUrl(box.img);
        const defaultImg = 'https://placehold.co/400x300/333/666?text=Box';
        
        const card = document.createElement('div');
        card.className = 'flex flex-row bg-black/40 border border-gold/30 rounded-xl overflow-hidden hover:border-gold transition-all cursor-pointer hover:scale-[1.02] duration-300 mb-4';
        card.addEventListener('click', () => openBoxModal(box.id, box.name, box.description || '', box.details || '', safeImg || defaultImg, price, box.show_vat_text));
        
        const textDiv = document.createElement('div');
        textDiv.className = 'flex-1 p-4 text-right';
        textDiv.innerHTML = '<h5 class="text-white font-bold text-lg mb-1">' + safeName + '</h5><p class="text-gray-400 text-sm mb-2 line-clamp-2">' + safeDesc + '</p><p class="text-gold font-bold text-md mt-2">' + safePriceDisplay + '</p>';
        
        const imgDiv = document.createElement('div');
        imgDiv.className = 'w-32 h-32 shrink-0';
        const img = document.createElement('img');
        img.src = safeImg || defaultImg;
        img.className = 'w-full h-full object-cover';
        img.loading = 'lazy';
        img.alt = safeName;
        img.onerror = function() { this.src = defaultImg; };
        imgDiv.appendChild(img);
        
        card.appendChild(textDiv);
        card.appendChild(imgDiv);
        fragment.appendChild(card);
    });
    boxesGrid.appendChild(fragment);
    document.getElementById('boxesSection').style.display = 'block';
}

function openBoxModal(id, name, description, details, img, price, showVatText) {
    if (document.getElementById('imageZoomModal')) return;
    const safeImg = validateAndSanitizeImageUrl(img);
    if (!safeImg) return;
    currentBoxId = id;
    currentBoxName = name;
    currentBoxPrice = price;
    currentBoxHasVat = showVatText;
    
    const modal = document.createElement('div');
    modal.id = 'imageZoomModal';
    modal.className = 'fixed inset-0 z-[400] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.cursor = 'pointer';
    
    const innerDiv = document.createElement('div');
    innerDiv.className = 'relative max-w-4xl w-full';
    innerDiv.addEventListener('click', (e) => e.stopPropagation());
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute -top-12 right-0 w-10 h-10 rounded-full bg-black/70 hover:bg-red-600 text-white text-2xl flex items-center justify-center z-10 transition-all';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeImageModal);
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'flex items-center justify-center';
    const zoomImg = document.createElement('img');
    zoomImg.src = safeImg;
    zoomImg.className = 'max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl border-2 border-gold/30';
    zoomImg.alt = sanitizeHtml(name);
    zoomImg.loading = 'lazy';
    zoomImg.onerror = function() { this.src = 'https://placehold.co/800x600/333/666?text=خطأ'; };
    imgContainer.appendChild(zoomImg);
    
    innerDiv.appendChild(closeBtn);
    innerDiv.appendChild(imgContainer);
    modal.appendChild(innerDiv);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeImageModal();
    });
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

window.closeImageModal = function() {
    const modal = document.getElementById('imageZoomModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
        closeBoxModal();
    }
});

async function openModal(id) {
    try {
        const { data, error } = await sb.from('content').select('*').eq('id', id).single();
        if (error || !data) return;
        const d = parseValue(data.value);
        currentItemTitle = d.title || '';
        document.getElementById('modalTitle').textContent = sanitizeHtml(d.title);
        document.getElementById('modalText').textContent = sanitizeHtml(d.details || d.desc || '');
        const safeImg = validateAndSanitizeImageUrl(d.img || '');
        document.getElementById('modalImg').src = safeImg || 'https://placehold.co/800x600/333/666?text=Zaman+Alkhair';
        
        const isBoxesService = d.title && (d.title.includes('بوكس') || d.title.includes('Box') || d.title.includes('box'));
        const modalRow = document.getElementById('modalInnerRow');
        const imgDiv = modalRow ? modalRow.children[0] : null;
        const textDiv = modalRow ? modalRow.children[1] : null;
        const priceBox = document.getElementById('priceBox');
        
        if (isBoxesService) {
            if (imgDiv) imgDiv.style.display = 'none';
            if (textDiv) { textDiv.style.flex = '1'; textDiv.style.width = '100%'; }
            if (priceBox) priceBox.style.display = 'none';
        } else {
            if (imgDiv) imgDiv.style.display = 'block';
            if (textDiv) { textDiv.style.flex = ''; textDiv.style.width = ''; }
            if (d.price && !isNaN(parseFloat(d.price))) {
                document.getElementById('newPrice').textContent = sanitizeHtml(formatPriceWithVAT(parseFloat(d.price), d.show_vat_text));
                if (priceBox) priceBox.style.display = 'block';
            } else {
                if (priceBox) priceBox.style.display = 'none';
            }
        }
        
        if (isBoxesService) {
            const boxes = await loadBoxesForModal();
            if (boxes.length > 0) {
                renderBoxesInModal(boxes);
            } else {
                document.getElementById('boxesSection').style.display = 'none';
            }
        } else {
            document.getElementById('boxesSection').style.display = 'none';
        }
        
        document.body.style.overflow = 'hidden';
        document.getElementById('detailsModal').classList.replace('hidden', 'flex');
    } catch(err) {}
}

function closeModal() {
    document.getElementById('detailsModal').classList.replace('flex', 'hidden');
    document.body.style.overflow = 'auto';
    currentItemTitle = '';
    document.getElementById('boxesSection').style.display = 'none';
}

function closeBoxModal() {
    const boxModal = document.getElementById('boxDetailsModal');
    if (boxModal) boxModal.classList.replace('flex', 'hidden');
    document.body.style.overflow = 'auto';
}

window.orderBoxFromModal = function() {
    if (currentBoxId && currentBoxName) {
        let msg = '*' + currentBoxName + '*\n\nمرحباً زمان الخير، أرغب في طلب هذا البوكس.';
        if (currentBoxPrice > 0) {
            let priceText = formatPriceWithVAT(currentBoxPrice, currentBoxHasVat);
            msg += '\nالسعر: ' + priceText;
        }
        const whatsappUrl = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(msg);
        window.open(whatsappUrl, '_blank', 'noopener');
    }
};

document.getElementById('detailsModal').addEventListener('click', function(e) {
    if (e.target.id === 'detailsModal') closeModal();
});

document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('closeBoxModalBtn').addEventListener('click', closeBoxModal);
document.getElementById('orderBoxBtn').addEventListener('click', window.orderBoxFromModal);

document.getElementById('whatsappOrderBtn').addEventListener('click', function(e) {
    e.preventDefault();
    let msg = '*' + sanitizeHtml(currentItemTitle) + '*\n\nمرحباً زمان الخير، أرغب في الاستفسار عن هذا الصنف.';
    window.open('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
});

document.addEventListener('DOMContentLoaded', function() {
    const orderNowBtn = document.getElementById('orderNowBtn');
    const orderDropdown = document.getElementById('orderDropdown');
    if (orderNowBtn && orderDropdown) {
        orderNowBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            orderDropdown.style.display = orderDropdown.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', function() {
            orderDropdown.style.display = 'none';
        });
        orderDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});

const contactBtn = document.getElementById('contactDropdownBtn');
const contactDropdown = document.getElementById('contactDropdown');
if (contactBtn && contactDropdown) {
    contactBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        contactDropdown.classList.toggle('hidden');
    });
    contactDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    document.addEventListener('click', function() {
        contactDropdown.classList.add('hidden');
    });
}

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileSidebar = document.getElementById('mobileSidebar');
const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openMobileSidebar() {
    if (mobileSidebar) mobileSidebar.classList.add('open');
    if (mobileSidebarOverlay) mobileSidebarOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    if (mobileSidebar) mobileSidebar.classList.remove('open');
    if (mobileSidebarOverlay) mobileSidebarOverlay.classList.remove('open');
    document.body.style.overflow = '';
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', function(e) { e.stopPropagation(); openMobileSidebar(); });
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);

document.querySelectorAll('#mobileSidebar a').forEach(link => {
    link.addEventListener('click', function(e) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            closeMobileSidebar();
            setTimeout(() => {
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        } else {
            closeMobileSidebar();
        }
    });
});

let currentMenuImages = [];

function openMenuModal() {
    closeMobileSidebar();
    document.body.style.overflow = 'hidden';
    document.getElementById('menuModal').classList.replace('hidden', 'flex');
    loadMenuImages();
}

document.getElementById('desktopMenuBtn').addEventListener('click', function(e) {
    e.preventDefault();
    openMenuModal();
});

document.getElementById('mobileMenuBtn2').addEventListener('click', function(e) {
    e.preventDefault();
    openMenuModal();
});

async function loadMenuImages() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '<div class="flex items-center justify-center h-full"><div class="text-gold">⏳ جاري التحميل...</div></div>';
    try {
        const { data, error } = await sb.from('menu').select('*').order('order_index', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-gray-500">📭 لا توجد صور</p></div>';
            return;
        }
        currentMenuImages = data;
        renderMenuBook();
    } catch(err) {
        container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-red-500">❌ خطأ في التحميل</p></div>';
    }
}

function renderMenuBook() {
    const container = document.getElementById('menuContainer');
    const total = currentMenuImages.length;
    const fragment = document.createDocumentFragment();
    
    const topBar = document.createElement('div');
    topBar.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10000; background:black; padding:8px 16px; border-radius:50px; border:1px solid #C6A664;';
    topBar.innerHTML = '<a href="./menu.pdf" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #C6A664, #B8941F); color: #000; padding: 10px 24px; border-radius: 40px; font-size: 14px; font-weight: bold; text-decoration: none; box-shadow: 0 4px 15px rgba(198, 166, 100, 0.4); transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.2);" onmouseover="this.style.transform=\'scale(1.02)\'; this.style.boxShadow=\'0 6px 20px rgba(198,166,100,0.6)\';" onmouseout="this.style.transform=\'scale(1)\'; this.style.boxShadow=\'0 4px 15px rgba(198,166,100,0.4)\';">📥 <span>تحميل المنيو PDF</span></a>';
    fragment.appendChild(topBar);
    
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:fixed; top:20px; right:20px; z-index:10000; background:black; color:#C6A664; border:1px solid #C6A664; width:40px; height:40px; border-radius:50%; font-size:20px; cursor:pointer;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeMenuModal);
    fragment.appendChild(closeBtn);
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'menu-scroll-container';
    scrollContainer.style.cssText = 'height:100vh; overflow-y:scroll; scroll-snap-type:y mandatory;';
    
    currentMenuImages.forEach((item, idx) => {
        const url = validateAndSanitizeImageUrl(item.image_url);
        const page = document.createElement('div');
        page.className = 'menu-page';
        page.style.cssText = 'height:100vh; scroll-snap-align:start; display:flex; align-items:center; justify-content:center; background:#000;';
        
        const img = document.createElement('img');
        img.src = url;
        img.className = 'max-w-full max-h-[80vh] object-contain cursor-pointer';
        img.style.border = '1px solid rgba(198,166,100,0.3)';
        img.loading = 'lazy';
        img.alt = 'صفحة منيو ' + (idx + 1);
        img.addEventListener('click', function() { zoomMenuImage(img); });
        
        const counter = document.createElement('div');
        counter.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:black; padding:4px 12px; border-radius:50px; color:#C6A664; font-size:12px;';
        counter.textContent = (idx + 1) + '/' + total;
        
        page.appendChild(img);
        page.appendChild(counter);
        scrollContainer.appendChild(page);
    });
    fragment.appendChild(scrollContainer);
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

window.zoomMenuImage = function(img) {
    if (document.getElementById('zoomModal')) return;
    const modal = document.createElement('div');
    modal.id = 'zoomModal';
    modal.className = 'fixed inset-0 z-[300] bg-black/95 flex items-center justify-center';
    
    const innerDiv = document.createElement('div');
    innerDiv.className = 'relative max-w-6xl w-full h-full flex items-center justify-center p-4';
    innerDiv.addEventListener('click', function(e) { e.stopPropagation(); });
    
    const zoomImg = document.createElement('img');
    zoomImg.src = img.src;
    zoomImg.className = 'max-w-full max-h-[90vh] object-contain';
    zoomImg.style.transition = 'transform 0.2s';
    zoomImg.id = 'zoomImg';
    zoomImg.alt = 'تكبير المنيو';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-5 right-5 w-12 h-12 bg-black/80 hover:bg-red-600 rounded-full text-white text-2xl cursor-pointer';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { modal.remove(); });
    
    let scale = 1;
    zoomImg.addEventListener('dblclick', function() {
        scale = scale === 1 ? 2 : 1;
        zoomImg.style.transform = 'scale(' + scale + ')';
    });
    
    innerDiv.appendChild(zoomImg);
    innerDiv.appendChild(closeBtn);
    modal.appendChild(innerDiv);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

function closeMenuModal() {
    document.getElementById('menuModal').classList.replace('flex', 'hidden');
    document.body.style.overflow = 'auto';
    currentMenuImages = [];
}

const footerText = document.getElementById('footerText');
if (footerText) footerText.textContent = '© ' + new Date().getFullYear() + ' ZAMAN ALKHEIR • MUSCAT • OMAN';

function initSliderEvents() {
    const wrapper = document.getElementById('slider-wrapper');
    if (!wrapper || sliderState.totalSlides <= 1) return;
    
    let startX = 0;
    let isDragging = false;
    
    function getX(e) {
        return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    }
    
    wrapper.addEventListener('touchstart', function(e) {
        startX = getX(e);
        isDragging = true;
        pauseAutoSlide();
    });
    
    wrapper.addEventListener('touchend', function(e) {
        if (!isDragging) return;
        let endX = e.changedTouches[0].clientX;
        let diff = endX - startX;
        if (diff < -40 && sliderState.currentSlide < sliderState.totalSlides - 1) {
            goToSlide(sliderState.currentSlide + 1);
        } else if (diff > 40 && sliderState.currentSlide > 0) {
            goToSlide(sliderState.currentSlide - 1);
        }
        isDragging = false;
        resumeAutoSlide();
    });
    
    wrapper.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        isDragging = true;
        pauseAutoSlide();
        e.preventDefault();
    });
    
    window.addEventListener('mouseup', function(e) {
        if (!isDragging) return;
        let endX = e.clientX;
        let diff = endX - startX;
        if (diff < -40 && sliderState.currentSlide < sliderState.totalSlides - 1) {
            goToSlide(sliderState.currentSlide + 1);
        } else if (diff > 40 && sliderState.currentSlide > 0) {
            goToSlide(sliderState.currentSlide - 1);
        }
        isDragging = false;
        resumeAutoSlide();
    });
}

function startAutoSlide() {
    if (sliderState.autoSlideInterval) clearInterval(sliderState.autoSlideInterval);
    if (sliderState.totalSlides <= 1) return;
    sliderState.autoSlideInterval = setInterval(function() {
        let next = (sliderState.currentSlide + 1) % sliderState.totalSlides;
        goToSlide(next);
    }, 3000);
}

function pauseAutoSlide() {
    if (sliderState.autoSlideInterval) {
        clearInterval(sliderState.autoSlideInterval);
        sliderState.autoSlideInterval = null;
    }
}

function resumeAutoSlide() {
    if (sliderState.autoSlideInterval) return;
    if (sliderState.totalSlides <= 1) return;
    sliderState.autoSlideInterval = setInterval(function() {
        let next = (sliderState.currentSlide + 1) % sliderState.totalSlides;
        goToSlide(next);
    }, 4000);
}

document.querySelectorAll('a[href="#about-section"]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector('#about-section');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    loadSlider().then(function() {
        if (sliderState.totalSlides > 1) {
            initSliderEvents();
            startAutoSlide();
        }
    });
    loadContent();
});