// ===== Nexora — 分类管理逻辑 =====

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
    renderCategories();
}

function renderCategories() {
    const container = document.getElementById('categoryList');
    const categories = [...new Set(bookmarks.map(b => b.category))];
    
    let html = '';
    categories.forEach(cat => {
        const catBookmarks = bookmarks.filter(b => b.category === cat);
        const subgroups = [...new Set(catBookmarks.map(b => b.subcategory || '其他'))];
        
        html += `
            <div class="category-item">
                <div class="category-header">
                    <div class="category-info">
                        <div class="category-name">${escapeHtml(cat)}</div>
                        <div class="category-meta">${catBookmarks.length} 个书签 · ${subgroups.length} 个分组</div>
                    </div>
                    <div class="category-actions">
                        <button class="btn btn-edit" onclick="editCategory('${escapeHtml(cat)}')">编辑</button>
                        <button class="btn btn-delete" onclick="deleteCategory('${escapeHtml(cat)}')">删除</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color:var(--text-muted)">暂无分类</p>';
}

function showAddCategory() {
    showModal(`
        <h3>添加分类</h3>
        <form onsubmit="addCategory(event)">
            <div class="form-group">
                <label>分类名称</label>
                <input type="text" id="catName" required placeholder="如：工作、生活">
            </div>
            <button type="submit" class="btn btn-primary">添加</button>
        </form>
    `);
}

function editCategory(name) {
    const newName = prompt('修改分类名称:', name);
    if (!newName || newName === name) return;
    
    // 更新所有该分类下的书签
    bookmarks.forEach(b => {
        if (b.category === name) {
            // 需要调用 API 更新
        }
    });
    
    alert('分类重命名功能需要在 API 中实现');
}

async function addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const existing = bookmarks.some(b => b.category === name);
    
    if (existing) {
        alert('分类已存在！');
        return;
    }
    
    await apiRequest('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ name, url: '#', category: name, subcategory: '', desc: '', isPrivate: false })
    });
    closeModal();
    loadAndRender();
}

async function deleteCategory(name) {
    if (!confirm(`确定删除分类 "${name}" 及其所有书签？`)) return;
    
    const toDelete = bookmarks.filter(b => b.category === name);
    for (const bm of toDelete) {
        await apiRequest(`/api/bookmarks/${bm.id}`, { method: 'DELETE' });
    }
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
