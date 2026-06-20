/**
 * 闲小铺 - 前端主逻辑
 * SPA 路由、状态管理、视图渲染
 */

// ==================== 全局状态管理 ====================
const AppState = {
    _user: null,
    _token: null,

    init() {
        const saved = localStorage.getItem('secondhand_user');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this._user = data.user;
                this._token = data.token;
            } catch (e) { /* ignore */ }
        }
    },

    get currentUser() { return this._user; },
    getToken() { return this._token; },
    isLoggedIn() { return !!this._token; },
    isAdmin() { return this._user && this._user.role === 'admin'; },

    setAuth(user, token) {
        this._user = user;
        this._token = token;
        localStorage.setItem('secondhand_user', JSON.stringify({ user, token }));
    },

    logout() {
        this._user = null;
        this._token = null;
        localStorage.removeItem('secondhand_user');
    }
};

// ==================== Toast 提示 ====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✓', error: '✕', warning: '!' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span>${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; }, 2500);
    setTimeout(() => toast.remove(), 2800);
}

// ==================== 工具函数 ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function formatPrice(price) { return Number(price).toFixed(2); }
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ==================== 路由系统 ====================
const router = {
    _current: 'home',

    navigate(view, params = {}) {
        if (this._current === view && !params) return;
        this._current = view;
        this._params = params;
        const hash = '#' + view;
        if (location.hash !== hash) {
            // 使用 pushState 将每次导航压入浏览器历史栈，支持返回键
            history.pushState(null, '', location.pathname + location.search + hash);
        }
        this.render();
    },

    render() {
        updateHeader();
        const isAdmin = AppState.isAdmin();
        // 管理员重定向：禁止访问用户功能页面
        if (isAdmin) {
            const adminBlocked = ['cart', 'orders', 'sellerOrders', 'publish', 'myProducts', 'favorites', 'profile'];
            if (adminBlocked.includes(this._current)) {
                router.navigate('admin');
                return;
            }
        }
        switch (this._current) {
            case 'home': renderHome(); break;
            case 'cart': renderCart(); break;
            case 'orders': renderOrders(); break;
            case 'sellerOrders': renderSellerOrders(); break;
            case 'publish': renderPublish(); break;
            case 'myProducts': renderMyProducts(); break;
            case 'favorites': renderFavorites(); break;
            case 'profile': renderProfile(); break;
            case 'admin': renderAdmin(); break;
            default: renderHome();
        }
        window.scrollTo(0, 0);
    }
};

// ==================== Header 更新 ====================
function updateHeader() {
    const authArea = document.getElementById('authArea');
    const userArea = document.getElementById('userArea');
    const displayName = document.getElementById('displayName');
    const adminLink = document.getElementById('adminLink');
    const cartBadge = document.getElementById('cartBadge');

    $$('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = $(`[data-nav="${router._current}"]`);
    if (activeNav) activeNav.classList.add('active');

    if (AppState.isLoggedIn()) {
        authArea.style.display = 'none';
        userArea.style.display = '';
        displayName.textContent = AppState.currentUser.username;
        adminLink.style.display = AppState.isAdmin() ? '' : 'none';
        const isAdmin = AppState.isAdmin();
        // 管理员隐藏用户功能入口
        const publishNav = document.getElementById('publishNav');
        if (publishNav) publishNav.style.display = isAdmin ? 'none' : '';
        const myProductsLink = document.getElementById('myProductsLink');
        if (myProductsLink) myProductsLink.style.display = isAdmin ? 'none' : '';
        const favoritesLink = document.getElementById('favoritesLink');
        if (favoritesLink) favoritesLink.style.display = isAdmin ? 'none' : '';
        const profileLink = document.getElementById('profileLink');
        if (profileLink) profileLink.style.display = isAdmin ? 'none' : '';
        const sellerOrdersNav = document.getElementById('sellerOrdersNav');
        if (sellerOrdersNav) sellerOrdersNav.style.display = isAdmin ? 'none' : '';
        const ordersNav = document.getElementById('ordersNav');
        if (ordersNav) ordersNav.style.display = isAdmin ? 'none' : '';
        const cartNav = document.getElementById('cartNav');
        if (cartNav) cartNav.style.display = isAdmin ? 'none' : '';
    } else {
        authArea.style.display = '';
        userArea.style.display = 'none';
    }
}

async function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!AppState.isLoggedIn()) { badge.style.display = 'none'; return; }
    try {
        const res = await API.Cart.list();
        const count = res.data ? res.data.length : 0;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { badge.style.display = 'none'; }
}

// ==================== 首页渲染 ====================
let currentPage = 1, currentPageSize = 12;
let currentNameFilter = undefined, currentCategoryFilter = undefined;
let currentMinPrice = undefined, currentMaxPrice = undefined, currentSortBy = undefined;

async function renderHome() {
    currentPage = 1;
    currentNameFilter = undefined;
    currentCategoryFilter = undefined;
    currentMinPrice = undefined;
    currentMaxPrice = undefined;
    currentSortBy = undefined;
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container">
            <div class="hero">
                <h1>发现好物，让闲置焕发新生</h1>
                <p>每一件二手商品都在等待新的主人，来这里找到属于你的宝贝吧</p>
            </div>
            <div class="filter-bar" id="filterBar">
                <div class="filter-toggle" id="filterToggle">
                    <span>筛选与排序</span>
                    <svg class="filter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
                <div class="filter-row" id="filterRow">
                    <div class="filter-group">
                        <label>价格区间</label>
                        <input type="number" id="filterMinPrice" placeholder="最低价" min="0" step="0.01" />
                        <span class="filter-sep">—</span>
                        <input type="number" id="filterMaxPrice" placeholder="最高价" min="0" step="0.01" />
                    </div>
                    <div class="filter-group">
                        <label>排序</label>
                        <select id="filterSortBy">
                            <option value="">最新发布</option>
                            <option value="price_asc">价格从低到高</option>
                            <option value="price_desc">价格从高到低</option>
                            <option value="time_asc">最早发布</option>
                        </select>
                    </div>
                    <button class="btn btn-primary btn-sm" id="filterApplyBtn">筛选</button>
                    <button class="btn btn-outline btn-sm" id="filterResetBtn">重置</button>
                </div>
            </div>
            <div class="category-section" id="categorySection">
                <div class="category-pills" id="categoryPills">
                    <span class="category-pill active" data-cid="">全部</span>
                </div>
            </div>
            <div class="section-header">
                <h2>商品列表</h2>
                <span id="productCount" style="font-size:13px;color:var(--text-muted)"></span>
            </div>
            <div class="product-grid" id="productGrid"></div>
            <div id="paginationArea"></div>
            <div id="loadingArea"></div>
        </div>
    `;

    await loadCategories();
    await loadProducts(1);

    // 绑定筛选事件
    document.getElementById('filterApplyBtn').addEventListener('click', () => {
        currentMinPrice = document.getElementById('filterMinPrice').value || undefined;
        currentMaxPrice = document.getElementById('filterMaxPrice').value || undefined;
        currentSortBy = document.getElementById('filterSortBy').value || undefined;
        currentPage = 1;
        loadProducts(1);
    });

    // 重置筛选条件
    document.getElementById('filterResetBtn').addEventListener('click', () => {
        document.getElementById('filterMinPrice').value = '';
        document.getElementById('filterMaxPrice').value = '';
        document.getElementById('filterSortBy').value = '';
        currentMinPrice = undefined;
        currentMaxPrice = undefined;
        currentSortBy = undefined;
        currentPage = 1;
        loadProducts(1);
    });

    // 移动端筛选折叠切换
    const filterToggle = document.getElementById('filterToggle');
    const filterRow = document.getElementById('filterRow');
    if (filterToggle && filterRow) {
        filterToggle.addEventListener('click', () => {
            filterRow.classList.toggle('expanded');
            filterToggle.classList.toggle('expanded');
        });
    }

    // 给"全部"pill绑定点击事件
    const allPill = document.querySelector('#categoryPills [data-cid=""]');
    if (allPill) {
        allPill.addEventListener('click', () => {
            $$('#categoryPills .category-pill').forEach(p => p.classList.remove('active'));
            allPill.classList.add('active');
            currentCategoryFilter = undefined;
            currentPage = 1;
            loadProducts(1);
        });
    }
}

async function loadCategories() {
    try {
        const res = await API.Category.list();
        const pills = document.getElementById('categoryPills');
        const categories = flattenCategories(res.data || []);
        categories.forEach(cat => {
            const span = document.createElement('span');
            span.className = 'category-pill';
            span.dataset.cid = cat.id;
            span.textContent = cat.name;
            span.addEventListener('click', () => {
                $$('#categoryPills .category-pill').forEach(p => p.classList.remove('active'));
                span.classList.add('active');
                currentCategoryFilter = cat.id;
                currentPage = 1;
                loadProducts(1, cat.id);
            });
            pills.appendChild(span);
        });
    } catch (e) {
        document.getElementById('categorySection').style.display = 'none';
    }
}

function flattenCategories(list, result = []) {
    list.forEach(cat => {
        result.push({ id: cat.id, name: cat.name });
    });
    return result;
}

async function loadProducts(page, categoryId) {
    const grid = document.getElementById('productGrid');
    const paginationArea = document.getElementById('paginationArea');
    const loading = document.getElementById('loadingArea');
    const countEl = document.getElementById('productCount');

    grid.innerHTML = '';
    loading.innerHTML = '<div class="loading">加载中</div>';
    paginationArea.innerHTML = '';

    if (!categoryId && currentCategoryFilter) categoryId = currentCategoryFilter;
    if (page) currentPage = page;
    else page = currentPage;

    const name = currentNameFilter || document.getElementById('searchInput')?.value || undefined;

    try {
        const res = await API.Product.list(name, categoryId, currentMinPrice, currentMaxPrice, currentSortBy, page, currentPageSize);
        const data = res.data || {};
        const products = data.records || [];
        const total = data.total || 0;

        loading.innerHTML = '';
        countEl.textContent = `共 ${total} 件商品`;
        currentNameFilter = name;
        currentCategoryFilter = categoryId;

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h3>暂无商品</h3>
                    <p>换个关键词试试吧</p>
                </div>`;
            return;
        }

        products.forEach(p => {
            grid.appendChild(createProductCard(p));
        });

        // 加载收藏状态
        loadFavStatus();

        // 渲染分页
        const totalPages = Math.ceil(total / currentPageSize);
        if (totalPages > 1) {
            renderPagination(paginationArea, currentPage, totalPages, function (p) {
                loadProducts(p, categoryId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    } catch (e) {
        loading.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
        paginationArea.innerHTML = '';
    }
}

function renderPagination(container, current, total, onClick) {
    let html = '<div class="pagination">';
    html += `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} data-page="${current - 1}">上一页</button>`;

    const pages = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
        pages.push(i);
    }
    if (pages[0] > 1) {
        pages.unshift(1);
        if (pages[1] > 2) pages.splice(1, 0, '...');
    }
    if (pages[pages.length - 1] < total) {
        if (pages[pages.length - 1] < total - 1) pages.push('...');
        pages.push(total);
    }

    pages.forEach(p => {
        if (p === '...') {
            html += '<span class="page-ellipsis">...</span>';
        } else {
            html += `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }
    });

    html += `<button class="page-btn" ${current >= total ? 'disabled' : ''} data-page="${current + 1}">下一页</button>`;
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.disabled) return;
            const p = parseInt(this.dataset.page);
            onClick(p);
        });
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    if (product.status !== 1) card.classList.add('sold-out');
    const conditionText = product.condition || '几乎全新';
    const isMine = AppState.isLoggedIn() && AppState.currentUser.id === product.userId;
    card.innerHTML = `
        <div class="card-img">
            ${product.status !== 1 ? '<div class="card-sold-overlay">已售</div>' : ''}
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
        </div>
        <div class="card-body">
            <div class="card-top-tags">
                <span class="card-condition">${escapeHtml(conditionText)}</span>
            </div>
            <div class="card-title">${escapeHtml(product.name)}</div>
            <div class="card-price"><span class="unit">¥</span>${formatPrice(product.price)}</div>
            <div class="card-footer">
                <span class="card-meta">${formatDate(product.createTime)}</span>
                <span class="card-qty">余量 ${product.remaining != null ? product.remaining : (product.quantity || 1)}</span>
                <div class="card-actions">
                    ${product.status === 1 ? `
                        <button class="btn-fav" title="收藏" data-pid="${product.id}" onclick="event.stopPropagation();handleToggleFav(event, ${product.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                        </button>
                        ${isMine ? '' : `
                        <button class="btn-cart" title="加入购物车" onclick="event.stopPropagation();handleAddToCart(${product.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                        </button>`}
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    // 程序化加载图片，避免 onerror 不可靠
    // 优先取 imageList（多图第一张），兼容 imageUrl
    const images = product.imageList || (product.imageUrl ? [product.imageUrl] : []);
    if (images.length > 0) {
        const cardImg = card.querySelector('.card-img');
        loadImageInto(cardImg, images[0]);
    }

    card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-cart') || e.target.closest('.btn-fav')) return;
        openProductDetail(product.id);
    });

    return card;
}

/** 点击卡片时通过 API 获取完整详情再展示 */
async function openProductDetail(productId) {
    // 关闭已有的详情弹窗
    closeAllDetailModals();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active detail-modal';
    overlay.innerHTML = '<div class="modal" style="max-width:640px"><div class="loading">加载中</div></div>';
    document.body.appendChild(overlay);

    // 将详情页压入浏览器历史栈，支持手机返回键关闭弹窗
    const detailHash = '#detail-' + productId;
    if (location.hash !== detailHash) {
        history.pushState({ detailOpen: true, productId: productId }, '', location.pathname + location.search + detailHash);
    }

    try {
        const res = await API.Product.getById(productId);
        const detail = res.data || {};
        const product = detail.product;
        if (!product) throw new Error('商品信息加载失败');
        const seller = detail.seller || {};
        const sellerProductCount = detail.sellerProductCount || 0;
        renderProductDetail(overlay, product, seller, sellerProductCount);
    } catch (e) {
        overlay.querySelector('.modal').innerHTML = `
            <button class="modal-close">&times;</button>
            <div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeDetailModal(overlay);
    });
}

/** 关闭详情弹窗并恢复路由 */
function closeDetailModal(overlay) {
    overlay.remove();
    // 恢复路由 hash，不触发重复的 history 条目
    if (location.hash.startsWith('#detail-')) {
        history.replaceState(null, '', location.pathname + location.search + '#' + router._current);
    }
}

/** 关闭所有详情弹窗 */
function closeAllDetailModals() {
    document.querySelectorAll('.detail-modal').forEach(el => {
        el.remove();
    });
    if (location.hash.startsWith('#detail-')) {
        history.replaceState(null, '', location.pathname + location.search + '#' + router._current);
    }
}

/** 关闭发布表单弹窗并恢复路由 */
function closePublishForm(overlay) {
    overlay.remove();
    if (location.hash.startsWith('#publish-form')) {
        history.replaceState(null, '', location.pathname + location.search + '#' + router._current);
    }
}

/** 关闭所有发布表单弹窗 */
function closeAllPublishForms() {
    document.querySelectorAll('.publish-form-overlay').forEach(el => {
        el.remove();
    });
    if (location.hash.startsWith('#publish-form')) {
        history.replaceState(null, '', location.pathname + location.search + '#' + router._current);
    }
}

/**
 * 程序化加载图片到容器中。
 * 逻辑：
 *   1. 创建 img 元素，初始隐藏
 *   2. 监听 load 事件 → 调用 img.decode() 等待解码完成
 *   3. 解码成功 → 显示图片；解码失败 → 移除
 *   4. 监听 error 事件 → 移除图片
 * 关键：必须用 decode() 而非仅检查 naturalWidth，
 *       因为 load 触发时 naturalWidth 可能还是 0。
 */
function loadImageInto(container, url) {
    var img = document.createElement('img');
    img.src = url;
    img.style.position = 'relative';
    img.style.zIndex = '1';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'none';

    img.addEventListener('load', function () {
        if (img.decode) {
            img.decode().then(function () {
                img.style.display = '';
            }).catch(function () {
                img.remove();
            });
        } else {
            // 旧浏览器降级：decode 不存在时直接显示
            img.style.display = '';
        }
    });
    img.addEventListener('error', function () {
        img.remove();
    });
    container.appendChild(img);
}

function renderProductDetail(overlay, product, seller, sellerProductCount) {
    const images = product.imageList && product.imageList.length > 0
        ? product.imageList
        : (product.imageUrl ? [product.imageUrl] : []);
    const hasMultipleImages = images.length > 1;

    let imagesHtml = '';
    if (images.length === 0) {
        imagesHtml = `
            <div class="detail-img">
                <svg class="placeholder-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
            </div>`;
    } else {
        imagesHtml = `
            <div class="detail-img-carousel" id="detailCarousel">
                ${hasMultipleImages ? '<button class="carousel-btn carousel-prev" id="carouselPrev">&lsaquo;</button>' : ''}
                <div class="carousel-track" id="carouselTrack">
                    ${images.map((url, i) => `
                        <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
                            <svg class="placeholder-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                            </svg>
                        </div>
                    `).join('')}
                </div>
                ${hasMultipleImages ? '<button class="carousel-btn carousel-next" id="carouselNext">&rsaquo;</button>' : ''}
                ${hasMultipleImages ? `<div class="carousel-dots" id="carouselDots">${images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}</div>` : ''}
            </div>`;
    }

    // 卖家信息块
    let sellerHtml = '';
    if (seller && seller.id) {
        sellerHtml = `
            <div class="detail-seller" id="detailSeller">
                <div class="seller-avatar">
                    ${seller.avatar
                        ? `<img src="${escapeHtml(seller.avatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`
                        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>`}
                </div>
                <div class="seller-info">
                    <div class="seller-name">${escapeHtml(seller.nickname || seller.username)}</div>
                    <div class="seller-count">在售 ${sellerProductCount} 件商品</div>
                </div>
            </div>
            <div class="detail-section">
                <h4>卖家其他在售</h4>
                <div class="seller-products-grid" id="sellerProductsGrid">
                    <div class="loading">加载中</div>
                </div>
            </div>`;
    }

    overlay.querySelector('.modal').innerHTML = `
        <button class="modal-close">&times;</button>
        ${imagesHtml}
        <div class="detail-info">
            <h3>${escapeHtml(product.name)}</h3>
            <div class="detail-price">¥${formatPrice(product.price)}</div>
            <div class="detail-meta">
                <span>成色：<span class="tag tag-info">${escapeHtml(product.condition || '几乎全新')}</span></span>
                <span>浏览：<span class="tag">${product.viewCount || 0} 次</span></span>
                <span>库存：<span class="tag">${product.quantity || 1} 件</span></span>
                <span>余量：<span class="tag ${(product.remaining != null ? product.remaining : 0) <= 0 ? 'tag-danger' : ''}">${product.remaining != null ? product.remaining : (product.quantity || 1)} 件</span></span>
                <span>已售：<span class="tag">${product.soldCount || 0} 件</span></span>
                <span>发布时间：${formatDate(product.createTime)}</span>
                <span>分类ID：${product.categoryId || '-'}</span>
            </div>
            <div class="detail-desc">${escapeHtml(product.description) || '暂无描述'}</div>
            ${sellerHtml}
            ${(() => {
                if (product.status !== 1) {
                    return '<div class="detail-actions"><span class="tag tag-danger" style="padding:10px 20px">该商品已售出</span></div>';
                }
                const isMyProduct = AppState.isLoggedIn() && AppState.currentUser.id === product.userId;
                if (isMyProduct) {
                    return '<div class="detail-actions"><span class="tag tag-info" style="padding:10px 20px">这是我发布的商品</span></div>';
                }
                return `
                <div class="detail-actions">
                    <button class="btn btn-primary" id="detailAddCart">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        加入购物车
                    </button>
                    <button class="btn btn-outline" id="detailFavBtn" data-pid="${product.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span id="detailFavText">收藏</span>
                    </button>
                </div>`;
            })()}
        </div>
    `;

    // 程序化加载所有图片
    if (images.length > 0) {
        const slides = overlay.querySelectorAll('.carousel-slide');
        images.forEach((url, i) => {
            if (slides[i]) loadImageInto(slides[i], url);
        });
    }

    // 轮播逻辑
    let currentSlide = 0;
    function showSlide(index) {
        const allSlides = overlay.querySelectorAll('.carousel-slide');
        const allDots = overlay.querySelectorAll('.dot');
        allSlides.forEach(s => s.classList.remove('active'));
        allDots.forEach(d => d.classList.remove('active'));
        if (allSlides[index]) allSlides[index].classList.add('active');
        if (allDots[index]) allDots[index].classList.add('active');
        currentSlide = index;
    }

    overlay.querySelector('#carouselPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide((currentSlide - 1 + images.length) % images.length);
    });
    overlay.querySelector('#carouselNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide((currentSlide + 1) % images.length);
    });
    overlay.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            showSlide(parseInt(dot.dataset.index));
        });
    });

    overlay.querySelector('.modal-close').addEventListener('click', () => closeDetailModal(overlay));

    const addBtn = overlay.querySelector('#detailAddCart');
    if (addBtn) {
        addBtn.addEventListener('click', () => handleAddToCart(product.id));
    }

    // 收藏按钮逻辑
    const favBtn = overlay.querySelector('#detailFavBtn');
    if (favBtn) {
        checkFavStatus(product.id).then(faved => {
            if (faved) {
                favBtn.classList.add('faved');
                favBtn.querySelector('svg').setAttribute('fill', 'currentColor');
                favBtn.querySelector('#detailFavText').textContent = '已收藏';
            }
        });
        favBtn.addEventListener('click', async () => {
            if (!AppState.isLoggedIn()) {
                showToast('请先登录', 'warning');
                return;
            }
            const svg = favBtn.querySelector('svg');
            const text = favBtn.querySelector('#detailFavText');
            try {
                if (favBtn.classList.contains('faved')) {
                    await API.Favorite.remove(product.id);
                    favBtn.classList.remove('faved');
                    svg.setAttribute('fill', 'none');
                    text.textContent = '收藏';
                    showToast('已取消收藏');
                } else {
                    await API.Favorite.add(product.id);
                    favBtn.classList.add('faved');
                    svg.setAttribute('fill', 'currentColor');
                    text.textContent = '已收藏';
                    showToast('已收藏');
                }
            } catch (e) {
                showToast(e.message, 'error');
            }
        });
    }

    // 加载卖家其他商品
    if (seller && seller.id) {
        loadSellerProducts(seller.id);
    }
}

/** 加载卖家其他在售商品 */
async function loadSellerProducts(sellerId) {
    const grid = document.getElementById('sellerProductsGrid');
    if (!grid) return;
    try {
        const res = await API.Product.sellerProducts(sellerId, 1, 6);
        const data = res.data || {};
        const products = data.records || [];

        if (products.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px">暂无其他商品</p>';
            return;
        }

        grid.innerHTML = products.map(p => {
            const cond = p.condition || '几乎全新';
            const imgs = p.imageList || (p.imageUrl ? [p.imageUrl] : []);
            return `
                <div class="seller-product-mini" onclick="event.stopPropagation();openProductDetail(${p.id})" style="cursor:pointer">
                    <div class="spm-img">
                        ${imgs.length > 0 ? `<img src="${escapeHtml(imgs[0])}" alt="" style="width:100%;height:100%;object-fit:contain" />` : ''}
                    </div>
                    <div class="spm-info">
                        <div class="spm-name">${escapeHtml(p.name)}</div>
                        <div class="spm-meta">
                            <span class="spm-price">¥${formatPrice(p.price)}</span>
                            <span class="spm-condition">${escapeHtml(cond)}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px">加载失败</p>';
    }
}

async function handleAddToCart(productId) {
    if (!AppState.isLoggedIn()) {
        showToast('请先登录', 'warning');
        openModal('loginModal');
        return;
    }
    try {
        await API.Cart.add(productId, 1);
        showToast('已加入购物车');
        updateCartBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/** 收藏/取消收藏切换 */
async function handleToggleFav(event, productId) {
    if (!AppState.isLoggedIn()) {
        showToast('请先登录', 'warning');
        openModal('loginModal');
        return;
    }
    const btn = event.currentTarget;
    const svg = btn.querySelector('svg');
    try {
        if (btn.classList.contains('faved')) {
            await API.Favorite.remove(productId);
            btn.classList.remove('faved');
            svg.setAttribute('fill', 'none');
            showToast('已取消收藏');
        } else {
            await API.Favorite.add(productId);
            btn.classList.add('faved');
            svg.setAttribute('fill', 'currentColor');
            showToast('已收藏');
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

/** 检查单个商品是否已收藏 */
async function checkFavStatus(productId) {
    if (!AppState.isLoggedIn()) return false;
    try {
        const res = await API.Favorite.check(productId);
        return res.data === true;
    } catch (e) { return false; }
}

/** 加载卡片收藏状态 */
async function loadFavStatus() {
    if (!AppState.isLoggedIn()) return;
    try {
        const res = await API.Favorite.list();
        const favs = res.data || [];
        const favProductIds = new Set(favs.map(f => f.product_id));
        document.querySelectorAll('.btn-fav[data-pid]').forEach(btn => {
            const pid = parseInt(btn.dataset.pid);
            if (favProductIds.has(pid)) {
                btn.classList.add('faved');
                btn.querySelector('svg').setAttribute('fill', 'currentColor');
            }
        });
    } catch (e) { /* ignore */ }
}

// ==================== 购物车页面 ====================
async function renderCart() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container cart-page">
            <div class="section-header"><h2>我的购物车</h2></div>
            <div id="cartContent"></div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        document.getElementById('cartContent').innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <h3>请先登录</h3>
                <p>登录后即可查看您的购物车</p>
                <button class="btn btn-primary" onclick="openModal('loginModal')">立即登录</button>
            </div>`;
        return;
    }

    try {
        const res = await API.Cart.list();
        const items = res.data || [];
        renderCartItems(items);
        updateCartBadge();
    } catch (e) {
        document.getElementById('cartContent').innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

function renderCartItems(items) {
    const container = document.getElementById('cartContent');

    if (items.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <h3>购物车是空的</h3>
                <p>快去首页逛逛吧</p>
                <button class="btn btn-primary" onclick="router.navigate('home')">去逛逛</button>
            </div>`;
        return;
    }

    let totalPrice = 0;
    let html = '<div class="cart-list">';

    items.forEach(item => {
        const subtotal = parseFloat(item.subtotal) || (item.price * item.quantity);
        totalPrice += subtotal;
        const statusClass = item.product_status === 1 ? 'active' : 'sold';
        const statusText = item.product_status === 1 ? '在售' : '已售';

        html += `
            <div class="cart-item" data-cart-id="${item.cart_id}">
                <div class="item-img" data-img-url="${escapeHtml(item.image_url || '')}">
                    <svg class="placeholder-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                    </svg>
                </div>
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.product_name)}</div>
                    <div class="item-price">¥${formatPrice(item.price)}</div>
                    <span class="item-status ${statusClass}">${statusText}</span>
                </div>
                <div class="qty-control">
                    <button onclick="changeQty(${item.cart_id}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQty(${item.cart_id}, 1)">+</button>
                </div>
                <div class="item-subtotal">
                    小计 <span class="amount">¥${formatPrice(subtotal)}</span>
                </div>
                <button class="btn-remove" onclick="removeCartItem(${item.cart_id})" title="移除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>`;
    });

    html += `</div>
        <div class="cart-summary">
            <span class="total-label">合计：</span>
            <span class="total-price">¥${formatPrice(totalPrice)}</span>
            <button class="btn btn-primary" id="submitOrderBtn" style="margin-left:20px">提交订单</button>
        </div>`;

    container.innerHTML = html;

    // 程序化加载购物车中的图片
    container.querySelectorAll('.item-img[data-img-url]').forEach(el => {
        const url = el.dataset.imgUrl;
        if (url) loadImageInto(el, url);
    });

    // 提交订单按钮
    const submitBtn = container.querySelector('#submitOrderBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => showSubmitOrderForm());
    }
}

const cartQtyCache = {};
async function changeQty(cartId, delta) {
    const key = cartId;
    if (!cartQtyCache[key]) {
        const span = document.querySelector(`.cart-item[data-cart-id="${cartId}"] .qty-control span`);
        cartQtyCache[key] = parseInt(span.textContent);
    }
    cartQtyCache[key] += delta;
    if (cartQtyCache[key] <= 0) {
        await removeCartItem(cartId);
        return;
    }
    try {
        await API.Cart.updateQuantity(cartId, cartQtyCache[key]);
        await renderCart();
        updateCartBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function removeCartItem(cartId) {
    try {
        await API.Cart.remove(cartId);
        showToast('已从购物车移除');
        delete cartQtyCache[cartId];
    await renderCart();
    updateCartBadge();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function showSubmitOrderForm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width:500px">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">确认订单</h2>
            <form id="submitOrderForm">
                <div class="form-group">
                    <label>收货地址</label>
                    <input type="text" name="address" placeholder="请输入收货地址" required />
                </div>
                <div class="form-group">
                    <label>备注（选填）</label>
                    <textarea name="remark" placeholder="订单备注"></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">确认下单</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#submitOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = { address: formData.get('address'), remark: formData.get('remark') };

        const submitBtn = overlay.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        try {
            const res = await API.Order.submit(data);
            overlay.remove();
            showToast(`下单成功！共生成 ${res.data.orderCount} 个订单`);
            router.navigate('orders');
        } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '确认下单';
        }
    });
}

// ==================== 订单页面（买家） ====================
const ORDER_STATUS_MAP = ['待付款', '已付款', '已发货', '已完成', '已取消'];
const ORDER_STATUS_CLASS = ['warning', 'info', 'primary', 'success', 'danger'];

async function renderOrders() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container orders-page">
            <div class="section-header"><h2>我的订单</h2></div>
            <div class="order-status-filter" id="orderStatusFilter">
                <button class="status-filter-btn active" data-status="">全部</button>
                ${ORDER_STATUS_MAP.map((s, i) => `<button class="status-filter-btn" data-status="${i}">${s}</button>`).join('')}
            </div>
            <div id="orderList"></div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        document.getElementById('orderList').innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                <h3>请先登录</h3><p>登录后即可查看订单</p>
                <button class="btn btn-primary" onclick="openModal('loginModal')">立即登录</button>
            </div>`;
        return;
    }

    // 状态筛选
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadOrders(btn.dataset.status || undefined);
        });
    });

    loadOrders();
}

async function loadOrders(status) {
    const container = document.getElementById('orderList');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.Order.list(status != null ? parseInt(status) : undefined);
        const orders = res.data || [];

        if (orders.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>暂无订单</h3><p>去首页逛逛吧</p></div>`;
            return;
        }

        let html = '<div class="order-list">';
        orders.forEach(order => {
            const st = order.status;
            const statusLabel = ORDER_STATUS_MAP[st] || '未知';
            const statusCls = ORDER_STATUS_CLASS[st] || 'default';
            const items = order.items || [];

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-no">订单号: ${escapeHtml(order.order_no)}</span>
                        <span class="order-status tag tag-${statusCls}">${statusLabel}</span>
                    </div>
                    <div class="order-items">${items.map(item => `
                        <div class="order-item-row">
                            <div class="order-item-img" data-img-url="${escapeHtml(item.product_image || '')}">
                                <svg class="placeholder-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                                </svg>
                            </div>
                            <div class="order-item-info">
                                <span class="order-item-name">${escapeHtml(item.product_name)}</span>
                                <span class="order-item-meta">¥${formatPrice(item.price)} × ${item.quantity}</span>
                            </div>
                        </div>
                    `).join('')}</div>
                    <div class="order-footer">
                        <span class="order-time">${formatDate(order.create_time)}${order.seller_name ? ` · 卖家: ${escapeHtml(order.seller_name)}` : ''}</span>
                        <span class="order-amount">合计: <strong>¥${formatPrice(order.total_amount)}</strong></span>
                        ${st === 0 ? `<button class="btn btn-primary btn-xs" onclick="payOrder(${order.id})" style="margin-right:6px">付款</button><button class="btn btn-outline btn-xs" onclick="cancelOrder(${order.id})">取消订单</button>` : ''}
                        ${st === 2 ? `<button class="btn btn-primary btn-xs" onclick="confirmOrder(${order.id})">确认收货</button>` : ''}
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        // 加载订单商品图片
        container.querySelectorAll('.order-item-img[data-img-url]').forEach(el => {
            const url = el.dataset.imgUrl;
            if (url) loadImageInto(el, url);
        });

    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

async function cancelOrder(orderId) {
    if (!confirm('确定取消该订单吗？')) return;
    try {
        await API.Order.cancel(orderId);
        showToast('订单已取消');
        loadOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function payOrder(orderId) {
    if (!confirm('确认付款？')) return;
    try {
        await API.Order.pay(orderId);
        showToast('付款成功');
        loadOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function confirmOrder(orderId) {
    if (!confirm('确认已收到商品？')) return;
    try {
        await API.Order.confirm(orderId);
        showToast('确认收货成功');
        loadOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 卖家订单页面 ====================
async function renderSellerOrders() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container orders-page">
            <div class="section-header"><h2>卖家订单</h2></div>
            <div class="dash-section" id="sellerDash">
                <div class="loading">加载概览中</div>
            </div>
            <div class="order-status-filter" id="sellerOrderStatusFilter">
                <button class="status-filter-btn active" data-status="">全部</button>
                ${ORDER_STATUS_MAP.map((s, i) => `<button class="status-filter-btn" data-status="${i}">${s}</button>`).join('')}
            </div>
            <div id="sellerOrderList"></div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        document.getElementById('sellerOrderList').innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                <h3>请先登录</h3><p>登录后即可查看卖家订单</p>
                <button class="btn btn-primary" onclick="openModal('loginModal')">立即登录</button>
            </div>`;
        return;
    }

    // 加载概览
    loadSellerOverview();

    document.querySelectorAll('#sellerOrderStatusFilter .status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#sellerOrderStatusFilter .status-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadSellerOrders(btn.dataset.status || undefined);
        });
    });

    loadSellerOrders();
}

async function loadSellerOrders(status) {
    const container = document.getElementById('sellerOrderList');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.Order.sellerList(status != null ? parseInt(status) : undefined);
        const orders = res.data || [];

        if (orders.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>暂无订单</h3><p>还没有买家下单</p></div>`;
            return;
        }

        let html = '<div class="order-list">';
        orders.forEach(order => {
            const st = order.status;
            const statusLabel = ORDER_STATUS_MAP[st] || '未知';
            const statusCls = ORDER_STATUS_CLASS[st] || 'default';
            const items = order.items || [];

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-no">订单号: ${escapeHtml(order.order_no)}</span>
                        <span class="order-status tag tag-${statusCls}">${statusLabel}</span>
                    </div>
                    <div class="order-items">${items.map(item => `
                        <div class="order-item-row">
                            <div class="order-item-img" data-img-url="${escapeHtml(item.product_image || '')}">
                                <svg class="placeholder-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                                </svg>
                            </div>
                            <div class="order-item-info">
                                <span class="order-item-name">${escapeHtml(item.product_name)}</span>
                                <span class="order-item-meta">¥${formatPrice(item.price)} × ${item.quantity}</span>
                            </div>
                        </div>
                    `).join('')}</div>
                    <div class="order-footer">
                        <span class="order-time">${formatDate(order.create_time)}${order.buyer_name ? ` · 买家: ${escapeHtml(order.buyer_name)}` : ''}</span>
                        <span class="order-amount">合计: <strong>¥${formatPrice(order.total_amount)}</strong></span>
                        ${st === 1 ? `<button class="btn btn-primary btn-xs" onclick="shipOrder(${order.id})">发货</button>` : ''}
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.order-item-img[data-img-url]').forEach(el => {
            const url = el.dataset.imgUrl;
            if (url) loadImageInto(el, url);
        });

    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

async function shipOrder(orderId) {
    if (!confirm('确认发货？')) return;
    try {
        await API.Order.ship(orderId);
        showToast('发货成功');
        loadSellerOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 管理后台 - 订单管理 ====================
async function renderAdminOrders(status) {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.Order.adminList(status != null ? parseInt(status) : undefined);
        const orders = res.data || [];

        let html = `
            <div class="admin-toolbar">
                <div class="order-status-filter" id="adminOrderFilter">
                    <button class="status-filter-btn active" data-status="">全部</button>
                    ${ORDER_STATUS_MAP.map((s, i) => i < 4 ? `<button class="status-filter-btn" data-status="${i}">${s}</button>` : '').join('')}
                </div>
            </div>
            <div class="batch-action-bar" id="batchOrderBar" style="display:none">
                <span class="batch-selected-count" id="batchOrderCount">已选 0 项</span>
                <select id="batchOrderStatusSelect" class="batch-status-select">
                    <option value="">批量修改状态...</option>
                    <option value="0">待付款</option>
                    <option value="1">已付款</option>
                    <option value="2">已发货</option>
                    <option value="3">已完成</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="batchUpdateOrderStatus()">应用</button>
                <button class="btn btn-danger btn-sm" onclick="batchDeleteAdminOrders()">批量删除</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th style="width:40px"><input type="checkbox" id="selectAllOrders" title="全选" /></th><th>订单号</th><th>买家</th><th>卖家</th><th>商品数</th><th>金额</th><th>地址</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                    <tbody>${orders.map(o => {
                        const st = o.status;
                        const statusLabel = ORDER_STATUS_MAP[st] || '未知';
                        const statusCls = ORDER_STATUS_CLASS[st] || 'default';
                        return `
                        <tr>
                            <td><input type="checkbox" class="order-checkbox" value="${o.id}" ${st === 4 ? 'disabled' : ''} /></td>
                            <td><span class="order-no-txt" title="${escapeHtml(o.order_no)}">${escapeHtml((o.order_no || '').substring(0, 16))}...</span></td>
                            <td>${escapeHtml(o.buyer_name || '-')}</td>
                            <td>${escapeHtml(o.seller_name || '-')}</td>
                            <td>${o.item_count || 0}</td>
                            <td>¥${formatPrice(o.total_amount)}</td>
                            <td><span title="${escapeHtml(o.address || '')}">${escapeHtml((o.address || '-').substring(0, 10))}${(o.address || '').length > 10 ? '...' : ''}</span></td>
                            <td><span class="tag tag-${statusCls}">${statusLabel}</span></td>
                            <td>${formatDate(o.create_time)}</td>
                            <td class="action-btns">
                                <button class="btn btn-outline btn-xs" onclick="showAdminOrderDetail(${o.id})">详情</button>
                                <button class="btn btn-danger btn-xs" onclick="deleteAdminOrder(${o.id})">删除</button>
                                <select class="order-status-select" id="orderStatusSelect_${o.id}" onchange="changeOrderStatus(${o.id}, this.value)" ${st === 4 || st === 3 ? 'disabled' : ''}>
                                    <option value="">修改状态</option>
                                    <option value="0" ${st === 0 ? 'selected' : ''}>待付款</option>
                                    <option value="1" ${st === 1 ? 'selected' : ''}>已付款</option>
                                    <option value="2" ${st === 2 ? 'selected' : ''}>已发货</option>
                                    <option value="3" ${st === 3 ? 'selected' : ''}>已完成</option>
                                </select>
                            </td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
                ${orders.length === 0 ? '<div class="empty-state"><p>暂无订单数据</p></div>' : ''}
            </div>`;

        container.innerHTML = html;

        // 复选框事件
        setupBatchCheckboxes('selectAllOrders', 'order-checkbox', 'batchOrderBar', 'batchOrderCount');

        // 状态筛选
        document.querySelectorAll('#adminOrderFilter .status-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#adminOrderFilter .status-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const st = btn.dataset.status;
                renderAdminOrders(st || undefined);
            });
        });
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

async function showAdminOrderDetail(orderId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal" style="max-width:500px"><div class="loading">加载中</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());

    try {
        const res = await API.Order.detail(orderId);
        const order = res.data || {};
        const items = order.items || [];
        const st = order.status;
        const statusLabel = ORDER_STATUS_MAP[st] || '未知';
        const statusCls = ORDER_STATUS_CLASS[st] || 'default';

        const modal = overlay.querySelector('.modal');
        modal.innerHTML = `
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">订单详情</h2>
            <div class="order-detail-info">
                <div class="detail-row"><span>订单号</span><span>${escapeHtml(order.orderNo)}</span></div>
                <div class="detail-row"><span>买家</span><span>${escapeHtml(order.buyerName || '-')}</span></div>
                <div class="detail-row"><span>卖家</span><span>${escapeHtml(order.sellerName || '-')}</span></div>
                <div class="detail-row"><span>状态</span><span class="tag tag-${statusCls}">${statusLabel}</span></div>
                <div class="detail-row"><span>金额</span><span class="detail-amount">¥${formatPrice(order.totalAmount)}</span></div>
                <div class="detail-row"><span>地址</span><span>${escapeHtml(order.address || '未填写')}</span></div>
                <div class="detail-row"><span>备注</span><span>${escapeHtml(order.remark || '无')}</span></div>
                <div class="detail-row"><span>时间</span><span>${formatDate(order.createTime)}</span></div>
            </div>
            <div class="order-items-detail">
                <h4>商品明细</h4>
                ${items.map(item => `
                    <div class="order-item-row">
                        <span class="order-item-name">${escapeHtml(item.product_name)}</span>
                        <span>¥${formatPrice(item.price)} × ${item.quantity}</span>
                    </div>
                `).join('')}
            </div>
        `;

        modal.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    } catch (e) {
        overlay.querySelector('.modal').innerHTML = `<button class="modal-close">&times;</button><div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    }
}

async function changeOrderStatus(orderId, newStatus) {
    if (!newStatus) return;
    if (!confirm(`确定修改订单状态为"${ORDER_STATUS_MAP[newStatus]}"吗？`)) {
        document.getElementById(`orderStatusSelect_${orderId}`).value = '';
        return;
    }
    try {
        await API.Order.updateStatus(orderId, parseInt(newStatus));
        showToast('状态更新成功');
        renderAdminOrders();
    } catch (e) {
        showToast(e.message, 'error');
        document.getElementById(`orderStatusSelect_${orderId}`).value = '';
    }
}

async function batchUpdateOrderStatus() {
    const ids = getSelectedIds('order-checkbox');
    if (ids.length === 0) return;
    const newStatus = document.getElementById('batchOrderStatusSelect')?.value;
    if (!newStatus) { showToast('请选择目标状态', 'warning'); return; }
    const label = ORDER_STATUS_MAP[newStatus];
    if (!confirm(`确定将 ${ids.length} 个订单状态改为"${label}"吗？`)) return;
    try {
        await API.Order.batchUpdateStatus(ids, parseInt(newStatus));
        showToast('批量更新成功');
        renderAdminOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteAdminOrder(orderId) {
    if (!confirm('确定删除该订单？')) return;
    if (!confirm('此操作不可恢复！再次确认要删除吗？')) return;
    try {
        await API.Order.delete(orderId);
        showToast('订单已删除');
        renderAdminOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function batchDeleteAdminOrders() {
    const ids = getSelectedIds('order-checkbox');
    if (ids.length === 0) return;
    if (!confirm(`确定删除 ${ids.length} 个订单？`)) return;
    if (!confirm('此操作不可恢复！再次确认要批量删除吗？')) return;
    try {
        await API.Order.batchDelete(ids);
        showToast('批量删除成功');
        renderAdminOrders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 发布商品页面 ====================
function renderPublish() {
    if (!AppState.isLoggedIn()) {
        showLoginPrompt('请先登录后再发布商品');
        return;
    }
    // 显示发布模态框
    showPublishForm();
}

/** 显示发布商品表单模态框 */
function showPublishForm(editProductData) {
    const isEdit = !!editProductData;
    const product = editProductData || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active publish-form-overlay';

    const existingImages = product.imageList || (product.imageUrl ? [product.imageUrl] : []);
    const existingImagesJson = existingImages.length > 0 ? JSON.stringify(existingImages) : '';

    overlay.innerHTML = `
        <div class="modal" style="max-width:560px">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">${isEdit ? '编辑商品' : '发布商品'}</h2>
            <form id="userProductForm">
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" name="name" value="${escapeHtml(product.name || '')}" placeholder="请输入商品名称" required />
                </div>
                <div class="form-group">
                    <label>商品描述</label>
                    <textarea name="description" placeholder="请描述商品详情（选填）" rows="3">${escapeHtml(product.description || '')}</textarea>
                </div>
                <div class="form-inline">
                    <div class="form-group">
                        <label>价格 (¥)</label>
                        <input type="number" name="price" step="0.01" min="0" value="${product.price || ''}" placeholder="0.00" required />
                    </div>
                    <div class="form-group">
                        <label>数量</label>
                        <input type="number" name="quantity" min="1" value="${product.quantity || 1}" placeholder="1" required />
                    </div>
                </div>
                <div class="form-inline">
                    <div class="form-group">
                        <label>成色</label>
                        <select name="condition">
                            <option value="几乎全新" ${product.condition === '几乎全新' || !product.condition ? 'selected' : ''}>几乎全新</option>
                            <option value="全新" ${product.condition === '全新' ? 'selected' : ''}>全新</option>
                            <option value="轻微使用痕迹" ${product.condition === '轻微使用痕迹' ? 'selected' : ''}>轻微使用痕迹</option>
                            <option value="明显使用痕迹" ${product.condition === '明显使用痕迹' ? 'selected' : ''}>明显使用痕迹</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>商品图片</label>
                    <div class="multi-image-area" id="userImageArea">
                        <div class="image-preview-list" id="userImagePreview">
                            ${existingImages.map((url, i) => `
                                <div class="image-preview-item" data-index="${i}">
                                    <img src="${escapeHtml(url)}" alt="预览" />
                                    <button type="button" class="image-item-remove" data-index="${i}">&times;</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="image-add-btn" id="userImageAddBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>添加图片</span>
                        </div>
                    </div>
                    <input type="file" id="userImageInput" accept="image/*" multiple style="display:none" />
                    <input type="hidden" name="imageUrl" id="userImageUrl" value="${escapeHtml(product.imageUrl || '')}" />
                    <input type="hidden" name="images" id="userImages" value="${escapeHtml(existingImagesJson)}" />
                    <span class="upload-hint" id="userUploadHint">${existingImages.length > 0 ? '已有 ' + existingImages.length + ' 张图片' : '最多9张，提交时自动上传'}</span>
                </div>
                <div class="form-group">
                    <label>商品分类</label>
                    <div class="cascade-select" id="userCascadeCategory">
                        <select class="cascade-level" id="userCascadeLevel1">
                            <option value="">请选择分类</option>
                        </select>
                        <input type="hidden" name="categoryId" id="userCategoryHidden" value="${product.categoryId || ''}" />
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block" id="userProductSubmitBtn">${isEdit ? '保存修改' : '发布商品'}</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    // 压入浏览器历史栈，支持手机返回键关闭表单
    const publishHash = '#publish-form' + (isEdit ? '-' + product.id : '');
    if (location.hash !== publishHash) {
        history.pushState({ publishFormOpen: true }, '', location.pathname + location.search + publishHash);
    }

    overlay.querySelector('.modal-close').addEventListener('click', () => closePublishForm(overlay));

    // 初始化级联分类选择器
    initUserCascadeSelector(product.categoryId);

    // 多图选择逻辑
    let userSelectedFiles = [];
    let userCurrentUrls = [...existingImages];

    updateUserPreview();

    function updateUserPreview() {
        const list = overlay.querySelector('#userImagePreview');
        const hint = overlay.querySelector('#userUploadHint');
        const addBtn = overlay.querySelector('#userImageAddBtn');
        list.innerHTML = userCurrentUrls.map((url, i) => `
            <div class="image-preview-item" data-index="${i}">
                <img src="${escapeHtml(url)}" alt="预览" />
                <button type="button" class="image-item-remove" data-index="${i}">&times;</button>
            </div>
        `).join('');

        const total = userCurrentUrls.length;
        hint.textContent = total > 0 ? `已选 ${total} 张图片` : '最多9张，提交时自动上传';
        addBtn.style.display = total >= 9 ? 'none' : '';

        list.querySelectorAll('.image-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (idx < existingImages.length) {
                    userCurrentUrls.splice(idx, 1);
                    existingImages.splice(idx, 1);
                } else {
                    const fileIdx = idx - existingImages.length;
                    if (fileIdx >= 0 && fileIdx < userSelectedFiles.length) {
                        userSelectedFiles.splice(fileIdx, 1);
                        userCurrentUrls.splice(idx, 1);
                    }
                }
                updateUserPreview();
            });
        });
    }

    const fileInput = overlay.querySelector('#userImageInput');
    overlay.querySelector('#userImageAddBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = 9 - userCurrentUrls.length;
        if (remaining <= 0) { showToast('最多上传9张图片', 'warning'); return; }
        const toAdd = files.slice(0, remaining);
        toAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (ev) {
                userCurrentUrls.push(ev.target.result);
                userSelectedFiles.push(file);
                updateUserPreview();
            };
            reader.readAsDataURL(file);
        });
        fileInput.value = '';
    });

    overlay.querySelector('#userProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.price = parseFloat(data.price);
        data.quantity = parseInt(data.quantity) || 1;
        const catVal = document.getElementById('userCategoryHidden').value;
        data.categoryId = catVal ? parseInt(catVal) : null;

        const submitBtn = overlay.querySelector('#userProductSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '上传中...';

        try {
            let finalUrls = [...existingImages];
            if (userSelectedFiles.length > 0) {
                const uploadRes = await API.Upload.images(userSelectedFiles);
                const newUrls = uploadRes.data?.urls || [];
                finalUrls = finalUrls.concat(newUrls);
            }
            data.images = finalUrls.length > 0 ? JSON.stringify(finalUrls) : null;
            data.imageUrl = finalUrls.length > 0 ? finalUrls[0] : null;

            if (isEdit) {
                await API.Product.updateMine(product.id, data);
                showToast('商品已更新');
            } else {
                await API.Product.publish(data);
                showToast('发布成功');
            }
            closePublishForm(overlay);
            router.navigate('myProducts');
        } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = isEdit ? '保存修改' : '发布商品';
        }
    });
}

/** 用户端级联分类选择器 */
async function initUserCascadeSelector(selectedCategoryId) {
    let treeData = [];
    try {
        const res = await API.Category.list();
        treeData = res.data || [];
    } catch (e) { /* ignore */ }

    const catMap = {};
    buildCatMap(treeData, catMap);

    const ancestorPath = [];
    if (selectedCategoryId && catMap[selectedCategoryId]) {
        let cur = catMap[selectedCategoryId];
        while (cur) {
            ancestorPath.unshift(cur);
            cur = cur.parentId ? catMap[cur.parentId] : null;
        }
    }

    const container = document.getElementById('userCascadeCategory');
    const hiddenInput = document.getElementById('userCategoryHidden');

    function renderLevel(level, parentId, selectedId) {
        const oldSelect = container.querySelector(`#userCascadeLevel${level}`);
        if (oldSelect) oldSelect.remove();

        const candidates = getChildren(treeData, parentId);
        if (candidates.length === 0) return;

        const select = document.createElement('select');
        select.className = 'cascade-level';
        select.id = `userCascadeLevel${level}`;
        select.innerHTML = `<option value="">请选择</option>`;
        candidates.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}" ${cat.id === selectedId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
        });

        select.addEventListener('change', function () {
            const val = this.value;
            if (val) {
                hiddenInput.value = val;
                renderLevel(level + 1, val, null);
            } else {
                hiddenInput.value = '';
                for (let l = level + 1; ; l++) {
                    const deeper = container.querySelector(`#userCascadeLevel${l}`);
                    if (!deeper) break;
                    deeper.remove();
                }
            }
        });

        container.appendChild(select);
    }

    if (ancestorPath.length > 0) {
        for (let i = 0; i < ancestorPath.length; i++) {
            const parentId = i === 0 ? 0 : ancestorPath[i - 1].id;
            renderLevel(i + 1, parentId, ancestorPath[i].id);
        }
        hiddenInput.value = selectedCategoryId;
        const lastCat = ancestorPath[ancestorPath.length - 1];
        if (hasChildren(treeData, lastCat.id)) {
            renderLevel(ancestorPath.length + 1, lastCat.id, null);
        }
    } else {
        renderLevel(1, 0, null);
    }
}

// ==================== 我的发布页面 ====================
let _myProductsActiveTab = '1'; // '1'=上架中, '0'=未上架(仓库)

async function renderMyProducts() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container">
            <div class="section-header"><h2>我的发布</h2></div>
            <div class="my-products-tabs">
                <button class="mp-tab active" data-tab="1" id="mpTabActive">上架中</button>
                <button class="mp-tab" data-tab="0" id="mpTabInactive">未上架（仓库）</button>
            </div>
            <div id="myProductsContent"></div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        showLoginPrompt('请先登录');
        return;
    }

    // 标签切换事件
    document.querySelectorAll('.mp-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mp-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _myProductsActiveTab = btn.dataset.tab;
            loadMyProducts();
        });
    });

    loadMyProducts();
}

async function loadSellerOverview() {
    try {
        const res = await API.Product.sellerOverview();
        const d = res.data;
        const el = document.getElementById('sellerDash');
        if (!el) return;
        el.innerHTML = renderOverviewHtml(d);
    } catch (e) {
        // 概览加载失败不影响主功能
    }
}

async function loadMyProducts(page = 1) {
    const container = document.getElementById('myProductsContent');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const status = parseInt(_myProductsActiveTab);
        const res = await API.Product.myList(status, page, 12);
        const data = res.data || {};
        const products = data.records || [];
        const total = data.total || 0;

        if (products.length === 0) {
            const label = _myProductsActiveTab === '1' ? '上架中' : '未上架';
            container.innerHTML = `
                <div class="empty-state">
                    <h3>暂无${label}商品</h3>
                    ${_myProductsActiveTab === '0' ? '<p>下架的商品会出现在这里</p>' : '<p>快去发布你的第一件商品吧</p>'}
                    <button class="btn btn-primary" onclick="router.navigate('publish')">发布商品</button>
                </div>`;
            return;
        }

        let html = '<div class="product-grid">';
        products.forEach(p => {
            const conditionText = p.condition || '几乎全新';
            const stock = p.remaining != null ? p.remaining : (p.quantity || 1);
            const soldCount = p.soldCount || 0;
            // 区分已售罄(quantity=0 && remaining=0) 和 已下架
            const isSoldOut = p.status === 0 && p.quantity <= 0 && p.remaining <= 0;
            const offShelfLabel = isSoldOut ? '已售罄' : '已下架';
            html += `
                <div class="product-card" ${_myProductsActiveTab === '0' ? 'style="opacity:0.7"' : ''}>
                    <div class="card-img">
                        ${_myProductsActiveTab === '0' ? `<div class="card-sold-overlay" style="${isSoldOut ? 'background:rgba(220,38,38,0.75)' : ''}">${offShelfLabel}</div>` : ''}
                        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                        </svg>
                    </div>
                    <div class="card-body">
                        <div class="card-top-tags">
                            <span class="card-status ${isSoldOut ? 'tag-off' : (p.status === 1 ? 'tag-on' : 'tag-off')}">${isSoldOut ? '已售罄' : (p.status === 1 ? '在售' : '已下架')}</span>
                            <span class="card-condition">${escapeHtml(conditionText)}</span>
                        </div>
                        <div class="card-title">${escapeHtml(p.name)}</div>
                        <div class="card-price"><span class="unit">¥</span>${formatPrice(p.price)}</div>
                        <div class="card-footer">
                            <span class="card-meta">库存 ${stock}${soldCount > 0 ? ` / 已售 ${soldCount}` : ''}</span>
                            <div class="card-actions">
                                <button class="btn btn-outline btn-xs" onclick="editMyProduct(${p.id})">编辑</button>
                                <button class="btn btn-outline btn-xs" onclick="toggleMyProduct(${p.id})">${p.status === 1 ? '下架' : '上架'}</button>
                                <button class="btn btn-danger btn-xs" onclick="deleteMyProduct(${p.id})">删除</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        // 加载图片
        products.forEach((p, i) => {
            const images = p.imageList || (p.imageUrl ? [p.imageUrl] : []);
            if (images.length > 0) {
                const cards = container.querySelectorAll('.product-card .card-img');
                if (cards[i]) loadImageInto(cards[i], images[0]);
            }
        });

        // 分页
        const totalPages = Math.ceil(total / 12);
        if (totalPages > 1) {
            const pagDiv = document.createElement('div');
            renderPagination(pagDiv, page, totalPages, loadMyProducts);
            container.appendChild(pagDiv);
        }
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

async function editMyProduct(id) {
    try {
        const res = await API.Product.getById(id);
        const detail = res.data || {};
        showPublishForm(detail.product);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function toggleMyProduct(id) {
    try {
        await API.Product.toggleStatus(id);
        showToast('操作成功');
        loadMyProducts();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteMyProduct(id) {
    if (!confirm('确定删除该商品吗？')) return;
    try {
        await API.Product.deleteMine(id);
        showToast('商品已删除');
        loadMyProducts();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 收藏页面 ====================
let _favCache = {}; // 收藏数据缓存，供点击查看详情使用

async function renderFavorites() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container">
            <div class="section-header"><h2>我的收藏</h2></div>
            <div id="favoritesContent"></div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        showLoginPrompt('请先登录');
        return;
    }

    try {
        const res = await API.Favorite.list();
        const favs = res.data || [];
        const container = document.getElementById('favoritesContent');

        if (favs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>还没有收藏商品</h3>
                    <p>去首页发现喜欢的商品吧</p>
                    <button class="btn btn-primary" onclick="router.navigate('home')">去逛逛</button>
                </div>`;
            return;
        }

        // 缓存数据
        _favCache = {};
        favs.forEach(f => { _favCache[f.product_id] = f; });

        let html = '<div class="product-grid">';
        favs.forEach(f => {
            const conditionText = f.condition || '几乎全新';
            html += `
                <div class="product-card" onclick="showProductDetailFromFav(${f.product_id})">
                    <div class="card-img">
                        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                        </svg>
                    </div>
                    <div class="card-body">
                        <div class="card-top-tags">
                            <span class="card-status ${f.product_status === 1 ? 'tag-on' : 'tag-off'}">${f.product_status === 1 ? '在售' : '已售'}</span>
                            <span class="card-condition">${escapeHtml(conditionText)}</span>
                        </div>
                        <div class="card-title">${escapeHtml(f.product_name)}</div>
                        <div class="card-price"><span class="unit">¥</span>${formatPrice(f.price)}</div>
                        <div class="card-footer">
                            <span class="card-meta">${formatDate(f.product_create_time)}</span>
                            <div class="card-actions">
                                <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();removeFavorite(${f.product_id})">取消收藏</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        // 加载图片
        favs.forEach((f, i) => {
            let imgUrl = f.image_url || '';
            if (f.images) {
                try {
                    const arr = JSON.parse(f.images);
                    if (arr.length > 0) imgUrl = arr[0];
                } catch (e) { /* ignore */ }
            }
            if (imgUrl) {
                const cards = container.querySelectorAll('.product-card .card-img');
                if (cards[i]) loadImageInto(cards[i], imgUrl);
            }
        });
    } catch (e) {
        document.getElementById('favoritesContent').innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

// ==================== 个人中心页面 ====================
async function renderProfile() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="container">
            <div class="section-header"><h2>个人中心</h2></div>
            <div class="profile-card">
                <div class="profile-section">
                    <h3>基本资料</h3>
                    <div class="profile-avatar-row">
                        <div class="profile-avatar-img" id="profileAvatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="avatar-icon">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div>
                            <label class="profile-label">头像</label>
                            <div class="profile-avatar-actions">
                                <button class="btn btn-outline btn-sm" id="avatarUploadBtn">上传头像</button>
                                <input type="file" id="avatarFileInput" accept="image/*" style="display:none" />
                            </div>
                        </div>
                    </div>
                    <form id="profileForm">
                        <div class="form-row-2">
                            <div class="form-group">
                                <label>用户名</label>
                                <input type="text" id="profileUsername" disabled />
                            </div>
                            <div class="form-group">
                                <label>昵称</label>
                                <input type="text" id="profileNickname" placeholder="设置昵称" maxlength="20" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>手机号</label>
                            <input type="text" id="profilePhone" placeholder="绑定手机号" maxlength="11" />
                        </div>
                        <button type="submit" class="btn btn-primary" id="profileSaveBtn">保存修改</button>
                    </form>
                </div>
                <div class="profile-section">
                    <h3>修改密码</h3>
                    <form id="passwordForm">
                        <div class="form-group">
                            <label>原密码</label>
                            <input type="password" id="pwdOld" placeholder="输入原密码" required />
                        </div>
                        <div class="form-group">
                            <label>新密码</label>
                            <input type="password" id="pwdNew" placeholder="至少6位" minlength="6" required />
                        </div>
                        <div class="form-group">
                            <label>确认新密码</label>
                            <input type="password" id="pwdConfirm" placeholder="再次输入新密码" minlength="6" required />
                        </div>
                        <button type="submit" class="btn btn-primary">修改密码</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    if (!AppState.isLoggedIn()) {
        showLoginPrompt('请先登录');
        return;
    }

    // 加载用户信息
    try {
        const res = await API.User.me();
        const user = res.data;
        document.getElementById('profileUsername').value = user.username || '';
        document.getElementById('profileNickname').value = user.nickname || '';
        document.getElementById('profilePhone').value = user.phone || '';

        if (user.avatar) {
            const avatarEl = document.getElementById('profileAvatar');
            avatarEl.innerHTML = `<img src="${escapeHtml(user.avatar)}" alt="头像" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
        }
    } catch (e) {
        showToast(e.message, 'error');
    }

    // 头像上传
    const avatarInput = document.getElementById('avatarFileInput');
    let avatarFile = null;
    document.getElementById('avatarUploadBtn').addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        avatarFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const avatarEl = document.getElementById('profileAvatar');
            avatarEl.innerHTML = `<img src="${ev.target.result}" alt="预览" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
        };
        reader.readAsDataURL(file);
    });

    // 保存个人信息
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            let avatarUrl = null;
            if (avatarFile) {
                const formData = new FormData();
                formData.append('files', avatarFile);
                const token = AppState.getToken();
                const uploadRes = await fetch('/api/upload/images', {
                    method: 'POST',
                    headers: { token },
                    body: formData
                }).then(r => r.json());
                if (uploadRes.code !== 200) throw new Error('头像上传失败');
                const uploadedUrls = uploadRes.data && (uploadRes.data.urls || uploadRes.data);
                avatarUrl = Array.isArray(uploadedUrls) ? uploadedUrls[0] : uploadedUrls;
            }
            const nickname = document.getElementById('profileNickname').value;
            const phone = document.getElementById('profilePhone').value;
            await API.User.updateProfile(nickname || null, phone || null, avatarUrl);
            showToast('保存成功');
            // 更新本地状态
            if (AppState._user) {
                if (nickname) AppState._user.nickname = nickname;
                if (phone) AppState._user.phone = phone;
                if (avatarUrl) AppState._user.avatar = avatarUrl;
                localStorage.setItem('secondhand_user', JSON.stringify({ user: AppState._user, token: AppState.getToken() }));
            }
            avatarFile = null;
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 修改密码
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPwd = document.getElementById('pwdOld').value;
        const newPwd = document.getElementById('pwdNew').value;
        const confirmPwd = document.getElementById('pwdConfirm').value;
        if (newPwd !== confirmPwd) {
            showToast('两次输入的新密码不一致', 'error');
            return;
        }
        if (newPwd.length < 6) {
            showToast('新密码长度不能少于6位', 'error');
            return;
        }
        try {
            await API.User.updatePassword(oldPwd, newPwd);
            showToast('密码修改成功');
            document.getElementById('passwordForm').reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showProductDetailFromFav(productId) {
    openProductDetail(productId);
}

async function removeFavorite(productId) {
    try {
        await API.Favorite.remove(productId);
        showToast('已取消收藏');
        renderFavorites();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 管理后台 ====================
async function renderAdmin() {
    // 本地先快速判断
    if (!AppState.isAdmin()) {
        showLoginPrompt('仅管理员可访问此页面');
        return;
    }

    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="container admin-page"><div class="loading">验证管理员身份...</div></div>';

    // 向服务器验证 token 是否有效
    let tokenValid = false;
    try {
        const res = await API.User.me();
        if (res.data && res.data.role === 'admin') {
            tokenValid = true;
        }
    } catch (e) { /* token 无效 */ }

    if (!tokenValid) {
        AppState.logout();
        updateHeader();
        updateCartBadge();
        main.innerHTML = `
            <div class="container"><div class="empty-state">
                <h3>登录已过期</h3><p>管理员身份验证失败，请重新登录</p>
                <button class="btn btn-primary" onclick="openModal('loginModal')">重新登录</button>
            </div></div>`;
        return;
    }

    main.innerHTML = `
        <div class="container admin-page">
            <div class="section-header"><h2>管理后台</h2></div>
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="overview">概览</button>
                <button class="admin-tab" data-tab="products">商品管理</button>
                <button class="admin-tab" data-tab="orders">订单管理</button>
                <button class="admin-tab" data-tab="users">用户管理</button>
                <button class="admin-tab" data-tab="categories">分类管理</button>
            </div>
            <div id="adminContent">
                <div class="dash-section" id="adminDash">
                    <div class="loading">加载概览中</div>
                </div>
            </div>
        </div>
    `;

    // 加载全局概览
    loadAdminOverview();

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const container = document.getElementById('adminContent');
            switch (tab.dataset.tab) {
                case 'overview':
                    container.innerHTML = '<div class="dash-section" id="adminDash"><div class="loading">加载概览中</div></div>';
                    loadAdminOverview();
                    break;
                case 'products': renderAdminProducts(); break;
                case 'orders': renderAdminOrders(); break;
                case 'users': renderAdminUsers(); break;
                case 'categories': renderAdminCategories(); break;
            }
        });
    });
}

function showLoginPrompt(msg) {
    document.getElementById('mainContent').innerHTML = `
        <div class="container"><div class="empty-state">
            <h3>需要登录</h3><p>${msg}</p>
            <button class="btn btn-primary" onclick="openModal('loginModal')">立即登录</button>
        </div></div>`;
}

async function loadAdminOverview() {
    try {
        const res = await API.Product.adminOverview();
        const d = res.data;
        const el = document.getElementById('adminDash');
        if (!el) return;
        el.innerHTML = renderOverviewHtml(d);
    } catch (e) {
        // 概览加载失败不影响主功能
    }
}

function renderOverviewHtml(d) {
    const n = (v) => v != null ? v : 0;
    const p = (v) => '¥' + formatPrice(v || 0);

    const hasActive = d.active != null;
    const hasUsers = d.users != null;
    const hasMerchants = d.merchants != null;
    const products = d.products || {};
    const orders = d.orders || {};
    const revenue = d.revenue || {};
    const rTotal = revenue.total || {};
    const rToday = revenue.today || {};
    const rWeek = revenue.week || {};

    let statsHtml = '';
    // --- 商品卡片 ---
    statsHtml += `<div class="dash-card"><div class="dash-card-title">商品</div>`;
    statsHtml += `<div class="dash-row"><span>总览</span><b>${n(products.total)}</b></div>`;
    statsHtml += `<div class="dash-row"><span>当日</span><b>${n(products.today)}</b></div>`;
    statsHtml += `<div class="dash-row"><span>7日</span><b>${n(products.week)}</b></div></div>`;

    if (hasActive) {
        statsHtml += `<div class="dash-card"><div class="dash-card-title">状态</div>`;
        statsHtml += `<div class="dash-row"><span class="accent">在售</span><b>${n(d.active)}</b></div>`;
        statsHtml += `<div class="dash-row"><span class="danger">已售罄</span><b>${n(d.soldOut)}</b></div>`;
        statsHtml += `<div class="dash-row"><span>已下架</span><b>${n(d.offShelf)}</b></div></div>`;
    }

    // --- 订单卡片 ---
    statsHtml += `<div class="dash-card"><div class="dash-card-title">订单</div>`;
    statsHtml += `<div class="dash-row"><span>总览</span><b>${n(orders.total)}</b></div>`;
    statsHtml += `<div class="dash-row"><span>当日</span><b>${n(orders.today)}</b></div>`;
    statsHtml += `<div class="dash-row"><span>7日</span><b>${n(orders.week)}</b></div></div>`;

    // --- 用户卡片（仅 admin） ---
    if (hasUsers) {
        const users = d.users || {};
        statsHtml += `<div class="dash-card"><div class="dash-card-title">用户</div>`;
        statsHtml += `<div class="dash-row"><span>总览</span><b>${n(users.total)}</b></div>`;
        statsHtml += `<div class="dash-row"><span>当日</span><b>${n(users.today)}</b></div>`;
        statsHtml += `<div class="dash-row"><span>7日</span><b>${n(users.week)}</b></div></div>`;
    }

    // --- 商户卡片（仅 admin） ---
    if (hasMerchants) {
        const merchants = d.merchants || {};
        statsHtml += `<div class="dash-card"><div class="dash-card-title">商户</div>`;
        statsHtml += `<div class="dash-row"><span>总计</span><b>${n(merchants.total)}</b></div></div>`;
    }

    // --- 收入卡片 ---
    statsHtml += `<div class="dash-card dash-card-wide"><div class="dash-card-title">收入</div>`;
    statsHtml += `<table class="dash-table"><thead><tr><th></th><th>流水</th><th>平台 (10%)</th><th>商户 (90%)</th></tr></thead><tbody>`;
    statsHtml += `<tr><td class="dash-period">总览</td><td class="dash-gmv">${p(rTotal.gmv)}</td><td>${p(rTotal.platform)}</td><td class="dash-merchant">${p(rTotal.merchant)}</td></tr>`;
    statsHtml += `<tr><td class="dash-period">当日</td><td class="dash-gmv">${p(rToday.gmv)}</td><td>${p(rToday.platform)}</td><td class="dash-merchant">${p(rToday.merchant)}</td></tr>`;
    statsHtml += `<tr><td class="dash-period">7日</td><td class="dash-gmv">${p(rWeek.gmv)}</td><td>${p(rWeek.platform)}</td><td class="dash-merchant">${p(rWeek.merchant)}</td></tr>`;
    statsHtml += `</tbody></table></div>`;

    return `<div class="dash-grid">${statsHtml}</div>`;
}

// --- 商品管理 ---
async function renderAdminProducts(name, categoryId) {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.Product.list(name, categoryId, undefined, undefined, undefined, 1, 100);
        const products = (res.data && res.data.records) || [];

        let html = `
            <div class="admin-toolbar">
                <div class="search-box">
                    <input type="text" id="adminProdName" placeholder="搜索商品名称..." value="${escapeHtml(name || '')}" />
                    <button class="btn btn-primary btn-sm" id="adminProdSearch">搜索</button>
                </div>
                <button class="btn btn-primary btn-sm" id="adminProdAdd">+ 新增商品</button>
            </div>
            <div class="batch-action-bar" id="batchProductBar" style="display:none">
                <span class="batch-selected-count" id="batchProductCount">已选 0 项</span>
                <button class="btn btn-success btn-sm" onclick="batchUpdateProductStatus(1)">批量上架</button>
                <button class="btn btn-warning btn-sm" onclick="batchUpdateProductStatus(0)">批量下架</button>
                <button class="btn btn-danger btn-sm" onclick="batchDeleteProducts()">批量删除</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th style="width:40px"><input type="checkbox" id="selectAllProducts" title="全选" /></th><th>ID</th><th>名称</th><th>价格</th><th>已售</th><th>成色</th><th>分类ID</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead>
                    <tbody>${(() => {
                        return products.map(p => {
                            const isSoldOut = p.status === 0 && p.quantity <= 0 && p.remaining <= 0;
                            const statusText = isSoldOut ? '已售罄' : (p.status === 1 ? '在售' : '已下架');
                            return '<tr>' +
                                '<td><input type="checkbox" class="product-checkbox" value="' + p.id + '" /></td>' +
                                '<td>' + p.id + '</td>' +
                                '<td>' + escapeHtml(p.name) + '</td>' +
                                '<td>¥' + formatPrice(p.price) + '</td>' +
                                '<td>' + (p.soldCount || 0) + '</td>' +
                                '<td>' + escapeHtml(p.condition || '几乎全新') + '</td>' +
                                '<td>' + (p.categoryId || '-') + '</td>' +
                                '<td><span class="status-badge ' + (isSoldOut ? 'disabled' : (p.status === 1 ? 'active' : 'disabled')) + '">' + statusText + '</span></td>' +
                                '<td>' + formatDate(p.createTime) + '</td>' +
                                '<td class="action-btns">' +
                                    '<button class="btn btn-outline btn-xs" onclick="showListingHistory(' + p.id + ')">记录</button> ' +
                                    '<button class="btn btn-warning btn-xs" onclick="adminTakeDownProduct(' + p.id + ')">下架</button> ' +
                                    '<button class="btn btn-danger btn-xs" onclick="deleteProduct(' + p.id + ')">删除</button>' +
                                '</td>' +
                            '</tr>';
                        }).join('')
                    })()}</tbody>
                </table>
                ${products.length === 0 ? '<div class="empty-state"><p>暂无商品数据</p></div>' : ''}
            </div>`;

        container.innerHTML = html;

        // 复选框事件
        setupBatchCheckboxes('selectAllProducts', 'product-checkbox', 'batchProductBar', 'batchProductCount');

        document.getElementById('adminProdSearch').addEventListener('click', () => {
            renderAdminProducts(document.getElementById('adminProdName').value);
        });
        document.getElementById('adminProdAdd').addEventListener('click', () => showProductForm());
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

function showProductForm(product = null) {
    const isEdit = !!product;
    const existingImages = product ? (product.imageList && product.imageList.length > 0 ? product.imageList : (product.imageUrl ? [product.imageUrl] : [])) : [];
    const existingImagesJson = JSON.stringify(existingImages);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width:560px">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">${isEdit ? '编辑商品' : '新增商品'}</h2>
            <form id="productForm">
                <div class="form-group">
                    <label>商品名称 *</label>
                    <input type="text" name="name" value="${escapeHtml(product?.name || '')}" required />
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea name="description">${escapeHtml(product?.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>价格 (¥)</label>
                    <input type="number" name="price" step="0.01" value="${product?.price || ''}" required />
                </div>
                <div class="form-group">
                    <label>数量</label>
                    <input type="number" name="quantity" min="1" value="${product?.quantity || 1}" />
                </div>
                <div class="form-group">
                    <label>成色</label>
                    <select name="condition">
                        <option value="几乎全新" ${!product || product.condition === '几乎全新' ? 'selected' : ''}>几乎全新</option>
                        <option value="全新" ${product && product.condition === '全新' ? 'selected' : ''}>全新</option>
                        <option value="轻微使用痕迹" ${product && product.condition === '轻微使用痕迹' ? 'selected' : ''}>轻微使用痕迹</option>
                        <option value="明显使用痕迹" ${product && product.condition === '明显使用痕迹' ? 'selected' : ''}>明显使用痕迹</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>商品图片（支持多张）</label>
                    <div class="multi-image-area" id="multiImageArea">
                        <div class="image-preview-list" id="imagePreviewList">
                            ${existingImages.map((url, i) => `
                                <div class="image-preview-item" data-index="${i}">
                                    <img src="${escapeHtml(url)}" alt="预览" />
                                    <button type="button" class="image-item-remove" data-index="${i}">&times;</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="image-add-btn" id="imageAddBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>添加图片</span>
                        </div>
                    </div>
                    <input type="file" id="imageFileInput" accept="image/*" multiple style="display:none" />
                    <input type="hidden" name="imageUrl" id="imageUrlField" value="${escapeHtml(product?.imageUrl || '')}" />
                    <input type="hidden" name="images" id="imagesField" value="${escapeHtml(existingImagesJson)}" />
                    <span class="upload-hint" id="uploadHint">${existingImages.length > 0 ? '已有 ' + existingImages.length + ' 张图片' : '最多9张，提交时自动上传到OSS'}</span>
                </div>
                <div class="form-group">
                    <label>商品分类</label>
                    <div class="cascade-select" id="cascadeCategory">
                        <select class="cascade-level" id="cascadeLevel1">
                            <option value="">请选择分类</option>
                        </select>
                        <input type="hidden" name="categoryId" id="categoryIdHidden" value="${product?.categoryId || ''}" />
                    </div>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select name="status">
                        <option value="1" ${!product || product.status === 1 ? 'selected' : ''}>在售</option>
                        <option value="0" ${product && product.status === 0 ? 'selected' : ''}>已售</option>
                    </select>
                </div>
                <input type="hidden" name="id" value="${product?.id || ''}" />
                <button type="submit" class="btn btn-primary btn-block" id="productSubmitBtn">${isEdit ? '保存修改' : '新增商品'}</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

    // 初始化级联分类选择器
    initCascadeSelector(product?.categoryId);

    // 多图选择逻辑
    let selectedFiles = []; // 新选择的文件（待上传）
    let currentImageUrls = [...existingImages]; // 已有的URL / 本地预览URL

    updatePreviewList();

    function updatePreviewList() {
        const list = overlay.querySelector('#imagePreviewList');
        const hint = overlay.querySelector('#uploadHint');
        const addBtn = overlay.querySelector('#imageAddBtn');
        list.innerHTML = currentImageUrls.map((url, i) => `
            <div class="image-preview-item" data-index="${i}">
                <img src="${escapeHtml(url)}" alt="预览" />
                <button type="button" class="image-item-remove" data-index="${i}">&times;</button>
            </div>
        `).join('');

        const totalCount = currentImageUrls.length;
        hint.textContent = totalCount > 0 ? `已选 ${totalCount} 张图片` : '最多9张，提交时自动上传到OSS';
        addBtn.style.display = totalCount >= 9 ? 'none' : '';

        // 重新绑定删除按钮
        list.querySelectorAll('.image-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (idx < existingImages.length) {
                    // 移除已有URL
                    currentImageUrls.splice(idx, 1);
                    existingImages.splice(idx, 1);
                } else {
                    const fileIdx = idx - existingImages.length;
                    if (fileIdx >= 0 && fileIdx < selectedFiles.length) {
                        selectedFiles.splice(fileIdx, 1);
                        currentImageUrls.splice(idx, 1);
                    }
                }
                updatePreviewList();
            });
        });
    }

    const fileInput = overlay.querySelector('#imageFileInput');
    overlay.querySelector('#imageAddBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = 9 - currentImageUrls.length;
        if (remaining <= 0) { showToast('最多上传9张图片', 'warning'); return; }
        const toAdd = files.slice(0, remaining);

        toAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (ev) {
                currentImageUrls.push(ev.target.result);
                selectedFiles.push(file);
                updatePreviewList();
            };
            reader.readAsDataURL(file);
        });
        fileInput.value = '';
    });

    overlay.querySelector('#productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.price = parseFloat(data.price);
        data.quantity = parseInt(data.quantity) || 1;
        const catVal = document.getElementById('categoryIdHidden').value;
        data.categoryId = catVal ? parseInt(catVal) : null;
        data.status = parseInt(data.status);

        const submitBtn = overlay.querySelector('#productSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '上传中...';

        try {
            let finalImageUrls = [...existingImages];

            // 上传新选择的文件
            if (selectedFiles.length > 0) {
                const uploadRes = await API.Upload.images(selectedFiles);
                const newUrls = uploadRes.data?.urls || [];
                finalImageUrls = finalImageUrls.concat(newUrls);
            }

            // 设置 images 字段（JSON数组）
            data.images = finalImageUrls.length > 0 ? JSON.stringify(finalImageUrls) : null;
            data.imageUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : null;

            if (isEdit) {
                await API.Product.update(product.id, data);
                showToast('商品已更新');
            } else {
                await API.Product.add(data);
                showToast('商品已新增');
            }
            overlay.remove();
            renderAdminProducts();
        } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = isEdit ? '保存修改' : '新增商品';
        }
    });
}

/** 初始化级联分类选择器 */
async function initCascadeSelector(selectedCategoryId) {
    let treeData = [];
    try {
        const res = await API.Category.list();
        treeData = res.data || [];
    } catch (e) { /* 分类加载失败 */ }

    // 构建 id→分类 映射
    const catMap = {};
    buildCatMap(treeData, catMap);

    // 构建路径：找出 selectedCategoryId 的完整祖先链
    const ancestorPath = [];
    if (selectedCategoryId && catMap[selectedCategoryId]) {
        let cur = catMap[selectedCategoryId];
        while (cur) {
            ancestorPath.unshift(cur);
            cur = cur.parentId ? catMap[cur.parentId] : null;
        }
    }

    const container = document.getElementById('cascadeCategory');
    const hiddenInput = document.getElementById('categoryIdHidden');

    /** 渲染某一级下拉 */
    function renderLevel(level, parentId, selectedId) {
        // 移除旧的下拉
        const oldSelect = container.querySelector(`#cascadeLevel${level}`);
        if (oldSelect) oldSelect.remove();

        const candidates = getChildren(treeData, parentId);
        if (candidates.length === 0) return;

        const select = document.createElement('select');
        select.className = 'cascade-level';
        select.id = `cascadeLevel${level}`;
        select.innerHTML = `<option value="">请选择</option>`;

        candidates.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}" ${cat.id === selectedId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
        });

        select.addEventListener('change', function () {
            const val = this.value;
            if (val) {
                const cat = catMap[val];
                hiddenInput.value = val;
                // 如果有子分类，渲染下一级
                renderLevel(level + 1, val, null);
            } else {
                // 用户清空选择，向上找上一级选中值
                hiddenInput.value = '';
                // 移除更深的层级
                for (let l = level + 1; ; l++) {
                    const deeper = container.querySelector(`#cascadeLevel${l}`);
                    if (!deeper) break;
                    deeper.remove();
                }
            }
        });

        container.appendChild(select);
    }

    // 初始渲染
    if (ancestorPath.length > 0) {
        // 有选中值：逐级渲染路径
        for (let i = 0; i < ancestorPath.length; i++) {
            const parentId = i === 0 ? 0 : ancestorPath[i - 1].id;
            renderLevel(i + 1, parentId, ancestorPath[i].id);
        }
        hiddenInput.value = selectedCategoryId;
        // 如果最后一级有子分类，再渲染一个空选择
        const lastCat = ancestorPath[ancestorPath.length - 1];
        if (hasChildren(treeData, lastCat.id)) {
            renderLevel(ancestorPath.length + 1, lastCat.id, null);
        }
    } else {
        // 无选中值
        renderLevel(1, 0, null);
    }
}

function buildCatMap(list, map) {
    list.forEach(cat => {
        map[cat.id] = { id: cat.id, name: cat.name, parentId: cat.parentId || 0 };
        if (cat.children && cat.children.length > 0) {
            buildCatMap(cat.children, map);
        }
    });
}

function getChildren(list, parentId) {
    // 在扁平的树上找某个parentId的所有子节点
    const result = [];
    function search(nodes) {
        nodes.forEach(cat => {
            if ((cat.parentId || 0) === parentId) {
                result.push(cat);
            }
            if (cat.children && cat.children.length > 0) {
                search(cat.children);
            }
        });
    }
    search(list);
    return result;
}

function hasChildren(list, id) {
    let found = false;
    function search(nodes) {
        nodes.forEach(cat => {
            if ((cat.parentId || 0) === id) found = true;
            if (cat.children && cat.children.length > 0) search(cat.children);
        });
    }
    search(list);
    return found;
}

async function editProduct(id) {
    try {
        const res = await API.Product.getById(id);
        const detail = res.data || {};
        showProductForm(detail.product);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('确定删除该商品吗？')) return;
    try {
        await API.Product.delete(id);
        showToast('商品已删除');
        renderAdminProducts();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function adminTakeDownProduct(id) {
    if (!confirm('确定下架该商品吗？')) return;
    try {
        await API.Product.batchUpdateStatus([id], 0);
        showToast('商品已下架');
        renderAdminProducts();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function showListingHistory(productId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal" style="max-width:500px"><div class="loading">加载中</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());

    try {
        const res = await API.Product.listingHistory(productId);
        const history = res.data || [];
        const modal = overlay.querySelector('.modal');
        modal.innerHTML = `
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">上架历史记录</h2>
            ${history.length === 0 ? '<div class="empty-state"><p>暂无上架记录</p></div>' : `
            <div class="table-container">
                <table>
                    <thead><tr><th>#</th><th>上架时间</th></tr></thead>
                    <tbody>${history.map((h, i) => `
                        <tr><td>${i + 1}</td><td>${formatDate(h.listingTime)} ${formatTime(h.listingTime)}</td></tr>
                    `).join('')}</tbody>
                </table>
            </div>`}
        `;
        modal.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    } catch (e) {
        overlay.querySelector('.modal').innerHTML = `<button class="modal-close">&times;</button><div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    }
}

// ==================== 批量操作辅助函数 ====================
function getSelectedIds(checkboxClass) {
    return [...document.querySelectorAll(`.${checkboxClass}:checked`)].map(cb => parseInt(cb.value));
}

function setupBatchCheckboxes(selectAllId, checkboxClass, barId, counterId) {
    const selectAll = document.getElementById(selectAllId);
    const bar = document.getElementById(barId);
    const counter = document.getElementById(counterId);

    function updateBar() {
        const checked = document.querySelectorAll(`.${checkboxClass}:checked`).length;
        bar.style.display = checked > 0 ? '' : 'none';
        if (counter) counter.textContent = `已选 ${checked} 项`;
    }

    selectAll.addEventListener('change', () => {
        document.querySelectorAll(`.${checkboxClass}`).forEach(cb => {
            cb.checked = selectAll.checked;
        });
        updateBar();
    });

    document.querySelectorAll(`.${checkboxClass}`).forEach(cb => {
        cb.addEventListener('change', updateBar);
    });
}

async function batchUpdateProductStatus(status) {
    const ids = getSelectedIds('product-checkbox');
    if (ids.length === 0) return;
    const label = status === 1 ? '上架' : '下架';
    if (!confirm(`确定批量${label} ${ids.length} 个商品？`)) return;
    try {
        await API.Product.batchUpdateStatus(ids, status);
        showToast(`批量${label}成功`);
        renderAdminProducts(document.getElementById('adminProdName')?.value);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function batchDeleteProducts() {
    const ids = getSelectedIds('product-checkbox');
    if (ids.length === 0) return;
    if (!confirm(`确定批量删除 ${ids.length} 个商品？此操作不可恢复！`)) return;
    try {
        await API.Product.batchDelete(ids);
        showToast('批量删除成功');
        renderAdminProducts(document.getElementById('adminProdName')?.value);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// --- 用户管理 ---
async function renderAdminUsers() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.User.list();
        const users = res.data || [];

        container.innerHTML = `
            <div class="batch-action-bar" id="batchUserBar" style="display:none">
                <span class="batch-selected-count" id="batchUserCount">已选 0 项</span>
                <button class="btn btn-success btn-sm" onclick="batchUpdateUserStatus(1)">批量启用</button>
                <button class="btn btn-danger btn-sm" onclick="batchUpdateUserStatus(0)">批量禁用</button>
                <button class="btn btn-danger btn-sm" onclick="batchDeleteUsers()" style="background:#dc2626">批量删除</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th style="width:40px"><input type="checkbox" id="selectAllUsers" title="全选" /></th><th>头像</th><th>ID</th><th>用户名</th><th>手机号</th><th>角色</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
                    <tbody>${users.map(u => `
                        <tr>
                            <td>${u.role !== 'admin' ? `<input type="checkbox" class="user-checkbox" value="${u.id}" />` : ''}</td>
                            <td>
                                <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--bg-secondary)">
                                    ${u.avatar
                                        ? `<img src="${escapeHtml(u.avatar)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />`
                                        : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="width:24px;height:24px;margin:6px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
                                </div>
                            </td>
                            <td>${u.id}</td>
                            <td>${escapeHtml(u.username)}</td>
                            <td>${escapeHtml(u.phone || '-')}</td>
                            <td><span class="status-badge ${u.role === 'admin' ? 'admin' : ''}">${u.role}</span></td>
                            <td><span class="status-badge ${u.status === 1 ? 'active' : 'disabled'}">${u.status === 1 ? '正常' : '禁用'}</span></td>
                            <td>${formatDate(u.createTime)}</td>
                            <td class="action-btns">
                                ${u.role !== 'admin' ? `
                                    <button class="btn btn-outline btn-xs" onclick="editUser(${u.id})">编辑</button>
                                    <button class="btn btn-danger btn-xs" onclick="disableUser(${u.id}, '${escapeHtml(u.username)}', ${u.status})">${u.status === 1 ? '禁用' : '启用'}</button>
                                    <button class="btn btn-danger btn-xs" onclick="deleteAdminUser(${u.id}, '${escapeHtml(u.username)}')" style="background:#dc2626">删除</button>
                                ` : '<span class="tag tag-primary">管理员</span>'}
                            </td>
                        </tr>`).join('')}</tbody>
                </table>
                ${users.length === 0 ? '<div class="empty-state"><p>暂无用户数据</p></div>' : ''}
            </div>`;

        // 复选框事件
        setupBatchCheckboxes('selectAllUsers', 'user-checkbox', 'batchUserBar', 'batchUserCount');
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
    }
}

function editUser(id) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">编辑用户</h2>
            <form id="editUserForm">
                <div class="form-group">
                    <label>手机号</label>
                    <input type="text" name="phone" placeholder="请输入手机号" />
                </div>
                <input type="hidden" name="id" value="${id}" />
                <button type="submit" class="btn btn-primary btn-block">保存</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#editUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            await API.User.update(id, { phone: formData.get('phone') });
            showToast('用户信息已更新');
            overlay.remove();
            renderAdminUsers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function disableUser(id, username, currentStatus) {
    const action = currentStatus === 1 ? '禁用' : '启用';
    if (!confirm(`确定${action}用户 "${username}" 吗？`)) return;
    try {
        await API.User.disable(id);
        showToast(`${action}成功`);
        renderAdminUsers();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function batchUpdateUserStatus(status) {
    const ids = getSelectedIds('user-checkbox');
    if (ids.length === 0) return;
    const label = status === 1 ? '启用' : '禁用';
    if (!confirm(`确定批量${label} ${ids.length} 个用户？`)) return;
    try {
        await API.User.batchUpdateStatus(ids, status);
        showToast(`批量${label}成功`);
        renderAdminUsers();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteAdminUser(id, username) {
    if (!confirm(`确定永久删除用户 "${username}"？`)) return;
    if (!confirm('此操作不可恢复！该用户的所有数据将被清除。再次确认？')) return;
    try {
        await API.User.deletePermanently(id);
        showToast('用户已删除');
        renderAdminUsers();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function batchDeleteUsers() {
    const ids = getSelectedIds('user-checkbox');
    if (ids.length === 0) return;
    if (!confirm(`确定永久删除 ${ids.length} 个用户？`)) return;
    if (!confirm('此操作不可恢复！这些用户的所有数据将被清除。再次确认？')) return;
    try {
        await API.User.batchDelete(ids);
        showToast('批量删除成功');
        renderAdminUsers();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// --- 分类管理（可折叠树形视图）---
async function renderAdminCategories() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="loading">加载中</div>';

    try {
        const res = await API.Category.adminList();
        const treeData = res.data || [];

        // 构建 id → name 查找表
        const nameMap = {};
        buildNameMap(treeData, nameMap);
        nameMap[0] = '顶级';

        let html = `
            <div class="admin-toolbar">
                <button class="btn btn-primary btn-sm" id="adminCatAdd">+ 新增分类</button>
            </div>`;

        if (treeData.length === 0) {
            html += '<div class="empty-state"><p>暂无分类数据</p></div>';
        } else {
            html += '<div class="tree-table" id="categoryTree">';
            html += buildCategoryTree(treeData, 0, nameMap);
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><h3>加载失败</h3><p>${escapeHtml(e.message)}</p></div>`;
        return;
    }

    document.getElementById('adminCatAdd').addEventListener('click', () => showCategoryForm());
    // 绑定折叠事件
    document.querySelectorAll('.tree-toggle').forEach(btn => {
        btn.addEventListener('click', function () {
            const row = this.closest('.tree-row');
            const id = row.dataset.treeId;
            const children = document.querySelectorAll(`.tree-row[data-tree-parent="${id}"]`);
            const collapsed = row.classList.toggle('collapsed');
            this.textContent = collapsed ? '▸' : '▾';
            children.forEach(c => {
                c.style.display = collapsed ? 'none' : '';
                if (collapsed) {
                    hideAllDescendants(c.dataset.treeId);
                }
            });
        });
    });
}

function hideAllDescendants(parentId) {
    const children = document.querySelectorAll(`.tree-row[data-tree-parent="${parentId}"]`);
    children.forEach(c => {
        c.style.display = 'none';
        const toggle = c.querySelector('.tree-toggle');
        if (toggle) {
            c.classList.add('collapsed');
            toggle.textContent = '▸';
        }
        hideAllDescendants(c.dataset.treeId);
    });
}

function buildNameMap(list, map) {
    list.forEach(cat => {
        map[cat.id] = cat.name;
        if (cat.children && cat.children.length > 0) {
            buildNameMap(cat.children, map);
        }
    });
}

function buildCategoryTree(list, level, nameMap) {
    let html = '';
    list.forEach(cat => {
        const hasChildren = cat.children && cat.children.length > 0;
        const parentName = nameMap[cat.parentId || 0] || String(cat.parentId || '顶级');
        const indent = level * 28;

        html += `
            <div class="tree-row" data-tree-id="${cat.id}" data-tree-parent="${cat.parentId || 0}" data-tree-level="${level}">
                <div class="tree-cell-toggle" style="padding-left:${indent}px">
                    ${hasChildren
                        ? '<button class="tree-toggle">▾</button>'
                        : '<span class="tree-leaf"></span>'}
                </div>
                <div class="tree-cell tree-cell-id">${cat.id}</div>
                <div class="tree-cell tree-cell-name">
                    <span class="tree-name">${escapeHtml(cat.name)}</span>
                    ${hasChildren ? `<span class="tree-child-count">${cat.children.length}个子分类</span>` : ''}
                </div>
                <div class="tree-cell tree-cell-parent">
                    <span class="tag tag-primary">${escapeHtml(parentName)}</span>
                </div>
                <div class="tree-cell tree-cell-actions">
                    <button class="btn btn-outline btn-xs" onclick="editCategory(${cat.id}, '${escapeHtml(cat.name)}', ${cat.parentId || 0})">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteCategory(${cat.id}, '${escapeHtml(cat.name)}')">删除</button>
                </div>
            </div>`;

        if (hasChildren) {
            html += buildCategoryTree(cat.children, level + 1, nameMap);
        }
    });
    return html;
}

function showCategoryForm(category = null) {
    const isEdit = !!category;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal">
            <button class="modal-close">&times;</button>
            <h2 class="modal-title">${isEdit ? '编辑分类' : '新增分类'}</h2>
            <form id="categoryForm">
                <div class="form-group">
                    <label>分类名称 *</label>
                    <input type="text" name="name" value="${escapeHtml(category?.name || '')}" required />
                </div>
                <div class="form-group">
                    <label>父分类ID（0为顶级）</label>
                    <input type="number" name="parentId" value="${category?.parentId || 0}" />
                </div>
                <input type="hidden" name="id" value="${category?.id || ''}" />
                <button type="submit" class="btn btn-primary btn-block">${isEdit ? '保存修改' : '新增分类'}</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = { name: formData.get('name'), parentId: parseInt(formData.get('parentId')) };
        try {
            if (isEdit) {
                await API.Category.update(category.id, data);
                showToast('分类已更新');
            } else {
                await API.Category.add(data);
                showToast('分类已新增');
            }
            overlay.remove();
            renderAdminCategories();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function editCategory(id, name, parentId) {
    showCategoryForm({ id, name, parentId });
}

async function deleteCategory(id, name) {
    if (!confirm(`确定删除分类"${name}"吗？`)) return;
    try {
        await API.Category.delete(id);
        showToast('分类已删除');
        renderAdminCategories();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ==================== 认证相关 ====================
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ==================== 事件绑定 ====================
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
    updateHeader();

    // 导航
    document.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            router.navigate(el.dataset.nav);
            closeMobileNav();
        });
    });

    // 汉堡菜单切换
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navLinks = document.getElementById('navLinks');
    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener('click', () => {
            const isOpen = navLinks.classList.contains('show');
            if (isOpen) {
                closeMobileNav();
            } else {
                navLinks.classList.add('show');
                document.body.classList.add('nav-open');
            }
        });
    }

    // 点击导航菜单外部关闭
    document.addEventListener('click', (e) => {
        if (navLinks && navLinks.classList.contains('show')) {
            if (!navLinks.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)) {
                closeMobileNav();
            }
        }
    });

    // 路由变化时关闭菜单
    window.addEventListener('hashchange', () => closeMobileNav());

    function closeMobileNav() {
        if (navLinks) {
            navLinks.classList.remove('show');
            document.body.classList.remove('nav-open');
        }
    }

    // 搜索
    document.getElementById('searchBtn').addEventListener('click', () => {
        router.navigate('home');
        setTimeout(() => {
            currentNameFilter = document.getElementById('searchInput').value;
            currentPage = 1;
            currentCategoryFilter = undefined;
            $$('#categoryPills .category-pill').forEach(p => p.classList.remove('active'));
            const allPill = document.querySelector('#categoryPills [data-cid=""]');
            if (allPill) allPill.classList.add('active');
            loadProducts(1);
        }, 100);
    });
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            router.navigate('home');
            setTimeout(() => {
                currentNameFilter = document.getElementById('searchInput').value;
                currentPage = 1;
                currentCategoryFilter = undefined;
                $$('#categoryPills .category-pill').forEach(p => p.classList.remove('active'));
                const allPill = document.querySelector('#categoryPills [data-cid=""]');
                if (allPill) allPill.classList.add('active');
                loadProducts(1);
            }, 100);
        }
    });

    // 认证按钮
    document.getElementById('loginBtn').addEventListener('click', (e) => { e.preventDefault(); openModal('loginModal'); });
    document.getElementById('registerBtn').addEventListener('click', (e) => { e.preventDefault(); openModal('registerModal'); });
    document.getElementById('switchToRegister').addEventListener('click', (e) => { e.preventDefault(); closeModal('loginModal'); openModal('registerModal'); });
    document.getElementById('switchToLogin').addEventListener('click', (e) => { e.preventDefault(); closeModal('registerModal'); openModal('loginModal'); });
    document.getElementById('logoutLink').addEventListener('click', (e) => {
        e.preventDefault();
        AppState.logout();
        updateHeader();
        updateCartBadge();
        router.navigate('home');
        showToast('已退出登录');
    });

    // 模态框关闭（仅通过×按钮）
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('active');
        });
    });

    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const res = await API.User.login(formData.get('username'), formData.get('password'));
            AppState.setAuth(res.data, res.data.token);
            closeModal('loginModal');
            updateHeader();
            updateCartBadge();
            router.navigate('home');
            showToast(`欢迎回来，${res.data.username}`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 注册表单
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (formData.get('password').length < 6) {
            showToast('密码至少6位', 'warning');
            return;
        }
        try {
            const res = await API.User.register(
                formData.get('username'),
                formData.get('password'),
                formData.get('phone')
            );
            closeModal('registerModal');
            showToast('注册成功，请登录');
            openModal('loginModal');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Header 滚动阴影
    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        if (window.scrollY > 10) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });

    // 初始路由：从 hash 恢复页面（使用 replaceState 避免产生多余历史记录）
    const hash = location.hash.replace('#', '');
    const validViews = ['home', 'cart', 'orders', 'sellerOrders', 'publish', 'myProducts', 'favorites', 'profile', 'admin'];
    const initialView = validViews.includes(hash) ? hash : 'home';
    router._current = initialView;
    if (location.hash !== '#' + initialView) {
        history.replaceState(null, '', location.pathname + location.search + '#' + initialView);
    }
    router.render();
    updateCartBadge();

    // 浏览器前进/后退时同步路由；程序内 navigate 触发的 hashchange 会被 _current 比对跳过
    window.addEventListener('hashchange', () => {
        const rawHash = location.hash.replace('#', '') || 'home';
        // 回退到非详情页时，关闭详情弹窗
        if (!rawHash.startsWith('detail-')) {
            closeAllDetailModals();
        }
        // 回退到非发布表单页时，关闭发布表单
        if (!rawHash.startsWith('publish-form')) {
            closeAllPublishForms();
        }
        const view = (rawHash.startsWith('detail-') || rawHash.startsWith('publish-form')) ? router._current : rawHash;
        if (router._current === view) return;
        router._current = view;
        router.render();
    });

    // popstate 事件：浏览器前进/后退按钮（部分浏览器不会触发 hashchange）
    window.addEventListener('popstate', () => {
        if (!location.hash.startsWith('#detail-')) {
            closeAllDetailModals();
        }
        if (!location.hash.startsWith('#publish-form')) {
            closeAllPublishForms();
        }
    });
});
