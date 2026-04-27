// ========== التهيئة الآمنة ==========
const SB_URL = 'https://dbkjzpoopvmahoflwkdr.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRia2p6cG9vcHZtYWhvZmx3a2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTUxNTAsImV4cCI6MjA5MjE5MTE1MH0.r1o_lNyALA2oTV2smlvg15p1ULSzQct_S7AUsgq-u30';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

const PHONE = "+96899229230";
let currentItemTitle = '';
let currentBoxId = null;
let currentBoxName = '';
let currentBoxPrice = 0;
let currentBoxHasVat = false;

// ========== دوال الأمان المحسنة ==========
function sanitizeHtml(text) {
    if (!text) return '';
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(text, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
            ALLOWED_ATTR: ['class', 'style']
        });
    }
    return String(text).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function secureUrl(url) {
    if (!url) return '';
    let cleanUrl = String(url).trim();
    if (cleanUrl.startsWith('http://')) {
        cleanUrl = cleanUrl.replace('http://', 'https://');
    }
    if (cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:') || cleanUrl.startsWith('/')) {
        return cleanUrl;
    }
    return '';
}

function validateAndSanitizeImageUrl(url) {
    const secured = secureUrl(url);
    if (secured && (secured.startsWith('https://raw.githubusercontent.com') || secured.startsWith('https://dbkjzpoopvmahoflwkdr.supabase.co'))) {
        return secured;
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
        return `${priceText} + V.A.T 5%`;
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
        console.error('JSON Parse Error:', e);
        return { title: 'خطأ في البيانات', desc: '', details: '', img: '', price: '', show_vat_text: false };
    }
}

// ========== دوال رفع الملفات الآمنة ==========
async function uploadImageToStorage(file, folder = 'uploads') {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('نوع الملف غير مدعوم. استخدم JPG, PNG, أو WebP فقط');
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('حجم الملف يتجاوز 5 ميجابايت');
    }
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `${folder}/${safeFileName}`;
    const { error } = await sb.storage.from('Z images').upload(filePath, file);
    if (error) throw error;
    const { data: urlData } = sb.storage.from('Z images').getPublicUrl(filePath);
    return secureUrl(urlData.publicUrl);
}

async function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('#items-tab button[onclick*="uploadImage"]') || event.target;
    const oldText = btn.textContent;
    btn.textContent = 'جاري الرفع...';
    btn.disabled = true;
    try {
        const url = await uploadImageToStorage(file);
        document.getElementById('item-img').value = url;
        btn.textContent = 'تم ✅';
        setTimeout(() => btn.textContent = oldText, 1500);
    } catch(err) { 
        alert('خطأ: ' + err.message); 
        btn.textContent = oldText;
    } finally {
        btn.disabled = false;
    }
}

async function uploadMenuImage(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        const url = await uploadImageToStorage(file, 'menu');
        document.getElementById('menu-img').value = url;
        alert('تم رفع الصورة بنجاح');
    } catch(err) {
        alert('خطأ: ' + err.message);
    }
}

async function uploadBoxImage(input) {
    const file = input.files[0];
    if (!file) return;
    try {
        const url = await uploadImageToStorage(file, 'boxes');
        document.getElementById('box-img').value = url;
        alert('تم رفع الصورة بنجاح');
    } catch(err) {
        alert('خطأ: ' + err.message);
    }
}

// ========== السلايدر ==========
let sliderState = {
    currentSlide: 0,
    totalSlides: 0,
    isDragging: false,
    startPos: 0,
    currentTranslate: 0,
    prevTranslate: 0,
    animationID: 0,
    autoSlideInterval: null,
    containerWidth: 0,
    startY: 0,
    isScrolling: false
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
        sliderState.containerWidth = document.getElementById('main-slider')?.offsetWidth || 0;
        wrapper.innerHTML = data.map((item) => {
            const d = parseValue(item.value);
            const imgUrl = validateAndSanitizeImageUrl(d.img || '');
            const imageContent = imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover" style="background-color:#111;" draggable="false" loading="lazy" alt="slider image">` : `<div class="w-full h-full bg-[#333] flex items-center justify-center"><span class="text-gray-500">لا يوجد صورة</span></div>`;
            return `<div class="w-full h-full shrink-0 relative bg-[#111]" style="flex:0 0 100%;">${imageContent}</div>`;
        }).join('');
        if (dots) dots.innerHTML = data.map((_, i) => `<button onclick="goToSlide(${i})" class="w-2 h-2 rounded-full bg-white/40 hover:bg-white transition-all" aria-label="Slide ${i+1}"></button>`).join('');
        goToSlide(0);
    } catch(err) {
        console.error('Error loading slider:', err);
        if (sliderSection) sliderSection.style.display = 'none';
    }
}

function goToSlide(index) {
    sliderState.currentSlide = index;
    const wrapper = document.getElementById('slider-wrapper');
    if (!wrapper) return;
    const translatePercent = index * -100;
    sliderState.currentTranslate = translatePercent;
    sliderState.prevTranslate = translatePercent;
    wrapper.style.transition = 'transform 0.3s ease-out';
    wrapper.style.transform = `translateX(${translatePercent}%)`;
    document.querySelectorAll('#slider-dots button').forEach((dot, i) => {
        dot.classList.toggle('bg-white', i === index);
        dot.classList.toggle('bg-white/40', i !== index);
    });
}

// ========== تحميل المحتوى ==========
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
                servicesGrid.innerHTML = renderCards(services);
            }
        }
        if (offersGrid) {
            if (offers.length === 0) {
                document.getElementById('offers-section').style.display = 'none';
            } else {
                offersGrid.innerHTML = renderCards(offers);
            }
        }
    } catch(err) {
        console.error('Error loading content:', err);
    }
}

function renderCards(items) {
    return items.map(item => {
        const d = parseValue(item.value);
        const hasPrice = d.price && !isNaN(parseFloat(d.price));
        const priceDisplay = hasPrice ? formatPriceWithVAT(parseFloat(d.price), d.show_vat_text) : '';
        const safeTitle = sanitizeHtml(d.title || '');
        const safeDesc = sanitizeHtml(d.desc || '');
        const safeImg = validateAndSanitizeImageUrl(d.img || '');
        const defaultImg = 'https://placehold.co/600x400/333/666?text=Zaman+Alkhair';
        return `
            <div class="service-card group">
                <img src="${safeImg || defaultImg}" class="card-bg" alt="${safeTitle}" loading="lazy" onerror="this.src='${defaultImg}'">
                <div class="card-overlay"></div>
                <div class="card-content">
                    <div>
                        <h3 class="text-2xl font-bold mb-3 text-white">${safeTitle}</h3>
                        <p class="text-gray-300 text-sm mb-6 font-light line-clamp-2">${safeDesc}</p>
                    </div>
                    <div class="flex items-center justify-between">
                        <button onclick="openModal('${sanitizeHtml(item.id)}')" class="btn-more">التفاصيل <span class="mr-1">‹</span></button>
                        ${hasPrice ? `<div class="text-left"><div class="text-2xl md:text-3xl font-black gold-gradient-text">${sanitizeHtml(priceDisplay)}</div></div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== دوال البوكسات ==========
async function loadBoxesForModal() {
    try {
        const { data, error } = await sb.from('boxes').select('*').order('order_index', { ascending: true });
        if (error || !data || data.length === 0) return [];
        return data;
    } catch(err) {
        console.error('Error loading boxes:', err);
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
    boxesGrid.innerHTML = boxes.map(box => {
        let price = typeof box.price === 'string' ? parseFloat(box.price) : box.price;
        let priceDisplay = formatPriceWithVAT(price, box.show_vat_text);
        let description = box.description || '';
        let details = box.details || '';
        let displayText = description || details;
        const safeId = sanitizeHtml(box.id);
        const safeName = sanitizeHtml(box.name);
        const safeDesc = sanitizeHtml(displayText.substring(0, 100));
        const safePriceDisplay = sanitizeHtml(priceDisplay);
        const safeImg = validateAndSanitizeImageUrl(box.img);
        const defaultImg = 'https://placehold.co/400x300/333/666?text=Box';
        const safeBoxDesc = sanitizeHtml(box.description || '');
        const safeBoxDetails = sanitizeHtml(box.details || '');
        
        return `
            <div onclick="openBoxModal('${safeId}', '${safeName.replace(/'/g, "\\'")}', '${safeBoxDesc.replace(/'/g, "\\'")}', '${safeBoxDetails.replace(/'/g, "\\'")}', '${safeImg || defaultImg}', ${price}, ${box.show_vat_text})" 
                 class="flex flex-row bg-black/40 border border-gold/30 rounded-xl overflow-hidden hover:border-gold transition-all cursor-pointer hover:scale-[1.02] duration-300 mb-4">
                <div class="flex-1 p-4 text-right">
                    <h5 class="text-white font-bold text-lg mb-1">${safeName}</h5>
                    <p class="text-gray-400 text-sm mb-2 line-clamp-2">${safeDesc}</p>
                    <p class="text-gold font-bold text-md mt-2">${safePriceDisplay}</p>
                </div>
                <div class="w-32 h-32 shrink-0">
                    <img src="${safeImg || defaultImg}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='${defaultImg}'" alt="${safeName}">
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('boxesSection').style.display = 'block';
}

function openBoxModal(id, name, description, details, img, price, showVatText) {
    if (document.getElementById('imageZoomModal')) return;
    const safeImg = validateAndSanitizeImageUrl(img);
    if (!safeImg) {
        console.error('لا يوجد رابط صورة صحيح لهذا البوكس');
        return;
    }
    const safeName = sanitizeHtml(name);
    const modal = document.createElement('div');
    modal.id = 'imageZoomModal';
    modal.className = 'fixed inset-0 z-[400] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4';
    modal.style.cursor = 'pointer';
    modal.innerHTML = `
        <div class="relative max-w-4xl w-full" onclick="event.stopPropagation()">
            <button onclick="closeImageModal()" class="absolute -top-12 right-0 w-10 h-10 rounded-full bg-black/70 hover:bg-red-600 text-white text-2xl flex items-center justify-center z-10 transition-all">✕</button>
            <div class="flex items-center justify-center">
                <img src="${safeImg}" class="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl border-2 border-gold/30" alt="${safeName}" loading="lazy" onerror="this.src='https://placehold.co/800x600/333/666?text=خطأ+في+تحميل+الصورة'">
            </div>
        </div>
    `;
    modal.onclick = function(e) {
        if (e.target === modal) closeImageModal();
    };
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
    }
});

async function openModal(id) {
    try {
        const { data } = await sb.from('content').select('*').eq('id', id).single();
        if (!data) return;
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
            if (textDiv) {
                textDiv.style.flex = '1';
                textDiv.style.width = '100%';
            }
            if (priceBox) priceBox.style.display = 'none';
        } else {
            if (imgDiv) imgDiv.style.display = 'block';
            if (textDiv) {
                textDiv.style.flex = '';
                textDiv.style.width = '';
            }
            if (d.price && !isNaN(parseFloat(d.price))) {
                const priceDisplay = formatPriceWithVAT(parseFloat(d.price), d.show_vat_text);
                document.getElementById('newPrice').textContent = sanitizeHtml(priceDisplay);
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
    } catch(err) {
        console.error('Error opening modal:', err);
    }
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
        let msg = `*${currentBoxName}*\n\nمرحباً زمان الخير، أرغب في طلب هذا البوكس.`;
        if (currentBoxPrice > 0) {
            let priceText = formatPriceWithVAT(currentBoxPrice, currentBoxHasVat);
            msg += `\nالسعر: ${priceText}`;
        }
        const whatsappUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
        window.open(whatsappUrl, '_blank');
        closeBoxModal();
    }
};

document.getElementById('detailsModal').onclick = (e) => { if (e.target.id === 'detailsModal') closeModal(); };
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const menuModal = document.getElementById('menuModal');
        const detailsModal = document.getElementById('detailsModal');
        const boxModal = document.getElementById('boxDetailsModal');
        if (menuModal && !menuModal.classList.contains('hidden')) closeMenuModal();
        else if (boxModal && !boxModal.classList.contains('hidden')) closeBoxModal();
        else if (detailsModal && !detailsModal.classList.contains('hidden')) closeModal();
    }
});

document.getElementById('whatsappOrderBtn').onclick = (e) => {
    e.preventDefault();
    let msg = `*${sanitizeHtml(currentItemTitle)}*\n\nمرحباً زمان الخير، أرغب في الاستفسار عن هذا الصنف.`;
    window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

document.addEventListener('DOMContentLoaded', function() {
    const orderNowBtn = document.getElementById('orderNowBtn');
    const orderDropdown = document.getElementById('orderDropdown');
    if (orderNowBtn && orderDropdown) {
        const newBtn = orderNowBtn.cloneNode(true);
        orderNowBtn.parentNode.replaceChild(newBtn, orderNowBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (orderDropdown.style.display === 'block') {
                orderDropdown.style.display = 'none';
            } else {
                orderDropdown.style.display = 'block';
            }
        });
        document.addEventListener('click', function() {
            orderDropdown.style.display = 'none';
        });
        orderDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        orderDropdown.style.display = 'none';
    }
});

const contactBtn = document.getElementById('contactDropdownBtn');
const contactDropdown = document.getElementById('contactDropdown');
if (contactBtn && contactDropdown) {
    contactBtn.addEventListener('click', (e) => { e.stopPropagation(); contactDropdown.classList.toggle('hidden'); });
    contactDropdown.addEventListener('click', (e) => { e.stopPropagation(); });
    document.addEventListener('click', () => { contactDropdown.classList.add('hidden'); });
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

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMobileSidebar(); });
if (closeSidebarBtn) closeSidebarBtn.onclick = closeMobileSidebar;
if (mobileSidebarOverlay) mobileSidebarOverlay.onclick = closeMobileSidebar;

document.querySelectorAll('#mobileSidebar a').forEach(link => {
    link.onclick = (e) => {
        const href = link.getAttribute('href');
        if (link.hasAttribute('onclick')) { closeMobileSidebar(); return; }
        if (href && href.startsWith('#')) {
            e.preventDefault();
            closeMobileSidebar();
            setTimeout(() => { document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }); }, 300);
        } else { closeMobileSidebar(); }
    };
});

let currentMenuImages = [];

function openMenuModal() {
    closeMobileSidebar();
    document.body.style.overflow = 'hidden';
    document.getElementById('menuModal').classList.replace('hidden', 'flex');
    loadMenuImages();
}

async function loadMenuImages() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = `<div class="flex items-center justify-center h-full"><div class="text-gold">⏳ جاري التحميل...</div></div>`;
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
    const safeImages = currentMenuImages.map(item => ({
        image_url: validateAndSanitizeImageUrl(item.image_url),
        id: sanitizeHtml(item.id)
    }));
    container.innerHTML = `
        <div style="position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10000; background:black; padding:8px 16px; border-radius:50px; border:1px solid #C6A664;">
            <a href="./menu.pdf" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #C6A664, #B8941F); color: #000; padding: 10px 24px; border-radius: 40px; font-size: 14px; font-weight: bold; text-decoration: none; box-shadow: 0 4px 15px rgba(198, 166, 100, 0.4); transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.2);" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(198,166,100,0.6)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(198,166,100,0.4)';" onmousedown="this.style.transform='scale(0.98)';">📥 <span>تحميل المنيو PDF</span></a>
        </div>
        <button onclick="closeMenuModal()" style="position:fixed; top:20px; right:20px; z-index:10000; background:black; color:#C6A664; border:1px solid #C6A664; width:40px; height:40px; border-radius:50%; font-size:20px; cursor:pointer;">✕</button>
        <div class="menu-scroll-container" style="height:100vh; overflow-y:scroll; scroll-snap-type:y mandatory;">
            ${safeImages.map((item, idx) => `
                <div class="menu-page" style="height:100vh; scroll-snap-align:start; display:flex; align-items:center; justify-content:center; background:#000;">
                    <img src="${item.image_url}" class="max-w-full max-h-[80vh] object-contain cursor-pointer" style="border:1px solid rgba(198,166,100,0.3);" onclick="zoomMenuImage(this)" loading="lazy" alt="Menu page ${idx+1}">
                    <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:black; padding:4px 12px; border-radius:50px; color:#C6A664; font-size:12px;">${idx+1}/${total}</div>
                </div>
            `).join('')}
        </div>
    `;
}

window.zoomMenuImage = function(img) {
    if (document.getElementById('zoomModal')) return;
    const modal = document.createElement('div');
    modal.id = 'zoomModal';
    modal.className = 'fixed inset-0 z-[300] bg-black/95 flex items-center justify-center';
    modal.innerHTML = `
        <div class="relative max-w-6xl w-full h-full flex items-center justify-center p-4" onclick="event.stopPropagation()">
            <img src="${img.src}" class="max-w-full max-h-[90vh] object-contain" style="transition:transform 0.2s;" id="zoomImg" alt="Zoomed menu">
            <button onclick="document.getElementById('zoomModal').remove()" class="absolute top-5 right-5 w-12 h-12 bg-black/80 hover:bg-red-600 rounded-full text-white text-2xl cursor-pointer">✕</button>
        </div>
    `;
    document.body.appendChild(modal);
    let scale = 1;
    const zoomImg = document.getElementById('zoomImg');
    zoomImg.ondblclick = () => {
        scale = scale === 1 ? 2 : 1;
        zoomImg.style.transform = `scale(${scale})`;
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

function closeMenuModal() {
    document.getElementById('menuModal').classList.replace('flex', 'hidden');
    document.body.style.overflow = 'auto';
    currentMenuImages = [];
}

const footerText = document.getElementById('footerText');
if (footerText) footerText.textContent = `© ${new Date().getFullYear()} ZAMAN ALKHEIR • MUSCAT • OMAN`;

function initSliderEvents() {
    const wrapper = document.getElementById('slider-wrapper');
    if (!wrapper || sliderState.totalSlides <= 1) return;
    let startX = 0;
    let isDragging = false;
    function getX(e) {
        return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    }
    wrapper.addEventListener('touchstart', (e) => {
        startX = getX(e);
        isDragging = true;
        pauseAutoSlide();
    });
    wrapper.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        let endX = e.changedTouches[0].clientX;
        let diff = endX - startX;
        if (diff < -40 && sliderState.currentSlide < sliderState.totalSlides-1) {
            goToSlide(sliderState.currentSlide + 1);
        } else if (diff > 40 && sliderState.currentSlide > 0) {
            goToSlide(sliderState.currentSlide - 1);
        }
        isDragging = false;
        resumeAutoSlide();
    });
    wrapper.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        isDragging = true;
        pauseAutoSlide();
        e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        let endX = e.clientX;
        let diff = endX - startX;
        if (diff < -40 && sliderState.currentSlide < sliderState.totalSlides-1) {
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
    sliderState.autoSlideInterval = setInterval(() => {
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
    sliderState.autoSlideInterval = setInterval(() => {
        let next = (sliderState.currentSlide + 1) % sliderState.totalSlides;
        goToSlide(next);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadSlider().then(() => {
        if (sliderState.totalSlides > 1) {
            initSliderEvents();
            startAutoSlide();
        }
    });
    loadContent();
});

document.querySelectorAll('a[onclick*="openMenuModal"]').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); openMenuModal(); };
});

document.querySelectorAll('a[href="#about-section"]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector('#about-section');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});