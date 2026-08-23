// ===== Nexora — 导航中枢前端逻辑 =====

const STORAGE_KEY = 'nexora_data';
const THEME_KEY = 'nexora_theme';
const CATEGORIES_DATA = {
    work: { icon: '💼', name: '工作' },
    life: { icon: '🏠', name: '生活' },
    tech: { icon: '💻', name: '技术' },
    tools: { icon: '🛠️', name: '工具' },
    social: { icon: '💬', name: '社交' },
    media: { icon: '🎬', name: '娱乐' }
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderCategories();
    setupEventListeners();
    loadSampleData();
});

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

function renderCategories(filter = 'all', search = '') {
    const container = document.getElementById('categoriesContainer');
    const bookmarks = getBookmarks();
    
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
    
    container.innerHTML = html || '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:40px">暂无书签，点击右下角 ⚙️ 进入控制台添加</p>';
}

function createBookmarkItem(bookmark) {
    try {
        const domain = new URL(bookmark.url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        const isPrivate = bookmark.isPrivate;
        
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

function getBookmarks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function loadSampleData() {
    if (getBookmarks().length === 0) {
        const sample = [
            { name: "GitHub", url: "https://github.com", desc: "代码托管平台", category: "tech", subcategory: "开发工具", isPrivate: false },
            { name: "Stack Overflow", url: "https://stackoverflow.com", desc: "开发者问答社区", category: "tech", subcategory: "学习资源", isPrivate: false },
            { name: "Vercel", url: "https://vercel.com", desc: "前端部署平台", category: "tech", subcategory: "开发工具", isPrivate: false },
            { name: "Notion", url: "https://notion.so", desc: "笔记与知识管理", category: "work", subcategory: "效率工具", isPrivate: false },
            { name: "Figma", url: "https://figma.com", desc: "协作设计工具", category: "work", subcategory: "设计工具", isPrivate: false },
            { name: "YouTube", url: "https://youtube.com", desc: "视频平台", category: "media", subcategory: "视频", isPrivate: false },
            { name: "网易云音乐", url: "https://music.163.com", desc: "音乐流媒体", category: "media", subcategory: "音乐", isPrivate: false },
            { name: "Bilibili", url: "https://bilibili.com", desc: "视频弹幕网站", category: "media", subcategory: "视频", isPrivate: false },
            { name: "淘宝", url: "https://taobao.com", desc: "购物平台", category: "life", subcategory: "购物", isPrivate: false },
            { name: "百度网盘", url: "https://pan.baidu.com", desc: "云存储服务", category: "life", subcategory: "云存储", isPrivate: false },
            { name: "个人密码库", url: "https://1password.com", desc: "密码管理工具", category: "tools", subcategory: "安全", isPrivate: true },
            { name: "服务器管理后台", url: "https://dashboard.example.com", desc: "内部运维系统", category: "work", subcategory: "运维", isPrivate: true }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
    }
}
