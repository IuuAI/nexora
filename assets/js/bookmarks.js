// ===== Nexora — 书签管理逻辑 =====

const API_BASE = window.location.origin;
const TOKEN_KEY = 'nexora_admin_token';

let bookmarks = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadAndRender();
});

function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['X-Admin-Token'] = token;
    
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = '/admin/login.html';
            return { error: 'Unauthorized' };
        }
        return await res.json();
    } catch (err) {
        alert('网络错误: ' + err.message);
        return { error: err.message };
    }
}

async function loadAndRender() {
    const data = await apiRequest('/api/bookmarks');
    bookmarks = Array.isArray(data) ? data : [];
    renderBookmarks();
}

function renderBookmarks(filter = '') {
    const container = document.getElementById('bookmarkList');
    let filtered = bookmarks;
    
    if (filter) {
        const term = filter.toLowerCase();
        filtered = bookmarks.filter(b => 
            b.name.toLowerCase().includes(term) ||
            b.url.toLowerCase().includes(term) ||
            b.desc?.toLowerCase().includes(term)
        );
    }
    
    let html = '';
    filtered.forEach((bm, idx) => {
        html += `
            <div class="bookmark-row">
                <div class="bookmark-data">
                    <strong>${escapeHtml(bm.name)}</strong>
                    <div class="bookmark-url">${escapeHtml(bm.url)}</div>
                    <div class="bookmark-tags">
                        <span class="tag">${escapeHtml(bm.category)}</span>
                        <span class="tag">${escapeHtml(bm.subcategory || '其他')}</span>
                        ${bm.is_private ? '<span class="tag private">加密</span>' : ''}
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="btn btn-edit" onclick="editBookmark(${bookmarks.indexOf(bm)})">编辑</button>
                    <button class="btn btn-delete" onclick="deleteBookmark(${bookmarks.indexOf(bm)})">删除</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color:var(--text-muted)">暂无书签</p>';
}

function filterBookmarks(value) {
    renderBookmarks(value);
}

function showAddBookmark() {
    const categories = [...new Set(bookmarks.map(b => b.category))];
    
    showModal(`
        <h3>添加书签</h3>
        <form onsubmit="addBookmark(event)">
            <div class="form-group">
                <label>名称</label>
                <input type="text" id="bmName" required>
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="url" id="bmUrl" required placeholder="https://...">
            </div>
            <div class="form-group">
                <label>描述</label>
                <input type="text" id="bmDesc" placeholder="简短描述">
            </div>
            <div class="form-group">
                <label>分类</label>
                <select id="bmCategory" style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:8px">
                    ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>二级分类</label>
                <input type="text" id="bmSubcategory" placeholder="如：工具、参考">
            </div>
            <div class="form-group">
                <label><input type="checkbox" id="bmPrivate"> 加密（仅管理员可见）</label>
            </div>
            <button type="submit" class="btn btn-primary">添加</button>
        </form>
    `);
}

async function addBookmark(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('bmName').value.trim(),
        url: document.getElementById('bmUrl').value.trim(),
        desc: document.getElementById('bmDesc').value.trim(),
        category: document.getElementById('bmCategory').value,
        subcategory: document.getElementById('bmSubcategory').value.trim(),
        isPrivate: document.getElementById('bmPrivate').checked
    };
    
    await apiRequest('/api/bookmarks', { method: 'POST', body: JSON.stringify(data) });
    closeModal();
    loadAndRender();
}

async function editBookmark(idx) {
    const bm = bookmarks[idx];
    const categories = [...new Set(bookmarks.map(b => b.category))];
    
    showModal(`
        <h3>编辑书签</h3>
        <form onsubmit="saveEditBookmark(${idx}, event)">
            <div class="form-group"><label>名称</label><input type="text" id="editName" value="${escapeHtml(bm.name)}" required></div>
            <div class="form-group"><label>URL</label><input type="url" id="editUrl" value="${escapeHtml(bm.url)}" required></div>
            <div class="form-group"><label>描述</label><input type="text" id="editDesc" value="${escapeHtml(bm.desc || '')}"></div>
            <div class="form-group">
                <label>分类</label>
                <select id="editCategory" style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:8px">
                    ${categories.map(c => `<option value="${escapeHtml(c)}" ${c === bm.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>二级分类</label><input type="text" id="editSub" value="${escapeHtml(bm.subcategory || '')}"></div>
            <div class="form-group"><label><input type="checkbox" id="editPrivate" ${bm.is_private ? 'checked' : ''}> 加密</label></div>
            <button type="submit" class="btn btn-primary">保存</button>
        </form>
    `);
}

async function saveEditBookmark(idx, e) {
    e.preventDefault();
    const bm = bookmarks[idx];
    const data = {
        name: document.getElementById('editName').value.trim(),
        url: document.getElementById('editUrl').value.trim(),
        desc: document.getElementById('editDesc').value.trim(),
        category: document.getElementById('editCategory').value,
        subcategory: document.getElementById('editSub').value.trim(),
        isPrivate: document.getElementById('editPrivate').checked
    };
    
    await apiRequest(`/api/bookmarks/${bm.id}`, { method: 'PUT', body: JSON.stringify(data) });
    closeModal();
    loadAndRender();
}

async function deleteBookmark(idx) {
    if (!confirm('确定删除此书签？')) return;
    await apiRequest(`/api/bookmarks/${bookmarks[idx].id}`, { method: 'DELETE' });
    loadAndRender();
}

function showModal(html) {
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
