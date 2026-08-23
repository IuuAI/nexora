// ===== Nexora — 管理控制台逻辑 (API版) =====

const API_BASE = window.location.origin;
const TOKEN_KEY = 'nexora_admin_token';

let bookmarks = [];
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
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
        alert('网络错误，请检查连接');
        return { error: err.message };
    }
}

async function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    
    const result = await apiRequest('/api/bookmarks');
    if (!result.error) {
        isAdmin = true;
        showAdminPanel();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    
    apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password: pwd })
    }).then(res => {
        if (res.token) {
            localStorage.setItem(TOKEN_KEY, res.token);
            isAdmin = true;
            showAdminPanel();
        } else {
            alert('密码错误！');
        }
    });
}

async function showAdminPanel() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAndRenderBookmarks();
    loadSettings();
    refreshBackups();
}

async function loadSettings() {
    const settings = await apiRequest('/api/settings');
    if (settings.site_name) {
        document.getElementById('siteName').value = settings.site_name;
    }
    if (settings.site_subtitle) {
        document.getElementById('siteSubtitle').value = settings.site_subtitle;
    }
}

async function saveSiteSettings() {
    const siteName = document.getElementById('siteName').value.trim();
    const siteSubtitle = document.getElementById('siteSubtitle').value.trim();
    
    if (siteName) {
        await apiRequest('/api/settings/site_name', {
            method: 'PUT',
            body: JSON.stringify({ value: siteName })
        });
    }
    if (siteSubtitle) {
        await apiRequest('/api/settings/site_subtitle', {
            method: 'PUT',
            body: JSON.stringify({ value: siteSubtitle })
        });
    }
    
    alert('设置已保存！刷新页面查看更改。');
}

async function exportData() {
    const data = await apiRequest('/api/export');
    if (data.error) {
        alert('导出失败: ' + data.error);
        return;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function showImportModal() {
    showModal(`
        <h3>导入数据</h3>
        <form onsubmit="importFile(event)">
            <div class="form-group">
                <label>选择 JSON 文件</label>
                <input type="file" id="importFile" accept=".json" required>
            </div>
            <p style="color:var(--text-muted);font-size:12px;margin:10px 0">
                ⚠️ 导入将覆盖所有现有数据，请先导出备份！
            </p>
            <button type="submit" class="btn btn-warning">导入并覆盖</button>
        </form>
    `);
}

async function importFile(e) {
    e.preventDefault();
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const res = await fetch(`${API_BASE}/api/import-file`, {
            method: 'POST',
            headers: { 'X-Admin-Token': token },
            body: formData
        });
        const data = await res.json();
        
        if (data.error) {
            alert('导入失败: ' + data.error);
        } else {
            alert('导入成功！' + data.message);
            closeModal();
            loadAndRenderBookmarks();
        }
    } catch (err) {
        alert('导入失败: ' + err.message);
    }
}

async function createBackup() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '创建中...';
    
    const data = await apiRequest('/api/backup/create', { method: 'POST' });
    
    btn.disabled = false;
    btn.textContent = '💾 创建备份';
    
    if (data.error) {
        alert('创建备份失败: ' + data.error);
    } else {
        alert('备份创建成功！');
        refreshBackups();
    }
}

async function refreshBackups() {
    const data = await apiRequest('/api/backup/list');
    const list = document.getElementById('backupList');
    const count = document.getElementById('backupCount');
    
    if (data.backups && data.backups.length > 0) {
        count.textContent = data.backups.length;
        let html = '';
        data.backups.forEach(b => {
            const sizeKB = (b.size / 1024).toFixed(1);
            html += `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">${escapeHtml(b.filename)}</div>
                        <div class="backup-meta">${sizeKB} KB · ${b.created_at.slice(0,16).replace('T', ' ')}</div>
                    </div>
                    <div class="backup-actions">
                        <a href="/api/backup/download/${encodeURIComponent(b.filename)}" class="btn btn-small">下载</a>
                        <button class="btn btn-small btn-danger" onclick="deleteBackup('${escapeHtml(b.filename)}')">删除</button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } else {
        count.textContent = '0';
        list.innerHTML = '<p style="color:var(--text-muted)">暂无备份</p>';
    }
}

async function deleteBackup(filename) {
    if (!confirm(`确定删除备份 "${filename}"？`)) return;
    await apiRequest(`/api/backup/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    refreshBackups();
}

async function resetAllData() {
    if (!confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有书签和设置将被清除！')) return;
    
    await apiRequest('/api/reset', { method: 'POST' });
    alert('数据已重置');
    loadAndRenderBookmarks();
}

async function loadAndRenderBookmarks() {
    const data = await apiRequest('/api/bookmarks');
    bookmarks = Array.isArray(data) ? data : [];
    renderCategoryList();
    renderBookmarkList();
}

function renderCategoryList() {
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
                        <button class="btn btn-delete" onclick="deleteCategory('${escapeHtml(cat)}')">删除</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color:var(--text-muted)">暂无分类</p>';
}

function renderBookmarkList() {
    const container = document.getElementById('bookmarkList');
    
    let html = '';
    bookmarks.forEach((bm, idx) => {
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
                <button class="btn btn-edit" onclick="editBookmark(${idx})">编辑</button>
                <button class="btn btn-delete" onclick="deleteBookmark(${idx})">删除</button>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color:var(--text-muted)">暂无书签</p>';
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
    loadAndRenderBookmarks();
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
    loadAndRenderBookmarks();
}

async function deleteCategory(name) {
    if (!confirm(`确定删除分类 "${name}" 及其所有书签？`)) return;
    
    const toDelete = bookmarks.filter(b => b.category === name);
    for (const bm of toDelete) {
        await apiRequest(`/api/bookmarks/${bm.id}`, { method: 'DELETE' });
    }
    loadAndRenderBookmarks();
}

async function deleteBookmark(idx) {
    if (!confirm('确定删除此书签？')) return;
    await apiRequest(`/api/bookmarks/${bookmarks[idx].id}`, { method: 'DELETE' });
    loadAndRenderBookmarks();
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
    loadAndRenderBookmarks();
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
