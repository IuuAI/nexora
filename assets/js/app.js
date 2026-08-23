// ===== Nexora — 导航中枢前端逻辑 (API版) =====

const API_BASE = window.location.origin;
const THEME_KEY = 'nexora_theme';
const TOKEN_KEY = 'nexora_admin_token';
const CATEGORIES_DATA = {
    work: { icon: '💼', name: '工作' },
    life: { icon: '🏠', name: '生活' },
    tech: { icon: '💻', name: '技术' },
    tools: { icon: '🛠️', name: '工具' },
    social: { icon: '💬', name: '社交' },
    media: { icon: '🎬', name: '娱乐' }
};

let bookmarks = [];
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadBookmarks();
    setupEventListeners();
});

async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['X-Admin-Token'] = token;
    
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            isAdmin = false;
            return { error: 'Unauthorized' };
        }
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        return { error: err.message };
    }
}

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
    });
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            renderCategories(e.target.dataset.filter);
        });
    });
    document.getElementById('searchInput').addEventListener('input', debounce((e) => {
        renderCategories(null, e.target.value);
    }, 300));
    document.getElementById('fabBtn').addEventListener('click', () => {
        window.location.href = '/admin/';
    });
}

async function loadBookmarks() {
    const data = await apiRequest('/api/bookmarks');
    bookmarks = Array.isArray(data) ? data : [];
    renderCategories();
}

function renderCategories(filter = 'all', search = '') {
    const container = document.getElementById('categoriesContainer');
    
    let html = '';
    const categories = Object.keys(CATEGORIES_DATA);
    
    categories.forEach(catKey => {
        if (filter !== 'all' && filter !== catKey) return;
        const catInfo = CATEGORIES_DATA[catKey];
        const catBookmarks = bookmarks.filter(b => b.category === catKey);
        
        if (catBookmarks.length === 0) return;
        
        const subgroups = {};
        catBookmarks.forEach(b => {
            const sub = b.subcategory || '其他';
            if (!subgroups[sub]) subgroups[sub] = [];
            subgroups[sub].push(b);
        });
        
        const filteredSubgroups = {};
        if (search) {
            Object.entries(subgroups).forEach(([sub, items]) => {
                const matched = items.filter(b => 
                    b.name.toLowerCase().includes(search.toLowerCase()) ||
                    b.desc?.toLowerCase().includes(search.toLowerCase())
                );
                if (matched.length > 0) filteredSubgroups[sub] = matched;
            });
            if (Object.keys(filteredSubgroups).length === 0) return;
        }
        
        const displaySubgroups = search ? filteredSubgroups : subgroups;
        
        html += `
            <article class="category-card">
                <header class="category-header">
                    <h2 class="category-title">
                        <span class="category-icon">${catInfo.icon}</span>
                        ${catInfo.name}
                    </h2>
                    <span class="category-count">${catBookmarks.length}</span>
                </header>
                <div class="category-body">
        `;
        
        Object.entries(displaySubgroups).forEach(([subName, items]) => {
            html += `
                <div class="subcategory">
                    <div class="subcategory-header" onclick="this.parentElement.classList.toggle('open')">
                        <span class="subcategory-title">${escapeHtml(subName)}</span>
                        <span class="subcategory-toggle">▼</span>
                    </div>
                    <div class="subcategory-content">
                        <ul class="bookmark-list">
                            ${items.map(b => createBookmarkItem(b)).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
        
        html += '</div></article>';
    });
    
    container.innerHTML = html || '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:40px">暂无书签</p>';
}

function createBookmarkItem(bookmark) {
    try {
        const domain = new URL(bookmark.url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        const isPrivate = bookmark.is_private;
        
        return `
            <li class="bookmark-item">
                <img class="bookmark-favicon" src="${favicon}" alt="" loading="lazy" onerror="this.style.display='none'">
                <div class="bookmark-info">
                    <div class="bookmark-name">${escapeHtml(bookmark.name)}</div>
                    <div class="bookmark-desc">${escapeHtml(bookmark.desc || domain)}</div>
                </div>
                ${isPrivate ? '<span class="bookmark-status private">加密</span>' : '<span class="bookmark-status">公开</span>'}
                <a class="bookmark-link" href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener">↗</a>
            </li>
        `;
    } catch {
        return `<li class="bookmark-item"><span>${escapeHtml(bookmark.name)}</span></li>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
