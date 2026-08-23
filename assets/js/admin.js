// ===== Nexora — 管理控制台逻辑 =====

const STORAGE_KEY = 'nexora_data';
const ADMIN_PASS_KEY = 'nexora_admin_pass';
const DEFAULT_PASSWORD = 'nexora2024';

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem(ADMIN_PASS_KEY)) {
        localStorage.setItem(ADMIN_PASS_KEY, hashPassword(DEFAULT_PASSWORD));
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

function handleLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    if (hashPassword(pwd) === localStorage.getItem(ADMIN_PASS_KEY)) {
        localStorage.setItem('nexora_logged_in', 'true');
        showAdminPanel();
    } else {
        alert('密码错误！');
    }
}

function hashPassword(pwd) {
    let hash = 0;
    for (let i = 0; i < pwd.length; i++) {
        const char = pwd.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

function showAdminPanel() {
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    renderCategoryList();
    renderBookmarkList();
}

function renderCategoryList() {
    const container = document.getElementById('categoryList');
    const bookmarks = getBookmarks();
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
    const bookmarks = getBookmarks();
    
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
                        ${bm.isPrivate ? '<span class="tag private">加密</span>' : ''}
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
    const bookmarks = getBookmarks();
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

function addCategory(e) {
    e.preventDefault();
    const bookmarks = getBookmarks();
    const name = document.getElementById('catName').value.trim();
    
    if (bookmarks.some(b => b.category === name)) {
        alert('分类已存在！');
        return;
    }
    
    saveBookmarks([...bookmarks, {
        name: `[分类] ${name}`, url: '#', category: name, subcategory: '', isPrivate: false, desc: ''
    }]);
    closeModal();
    renderCategoryList();
}

function addBookmark(e) {
    e.preventDefault();
    const bookmarks = getBookmarks();
    bookmarks.push({
        name: document.getElementById('bmName').value.trim(),
        url: document.getElementById('bmUrl').value.trim(),
        desc: document.getElementById('bmDesc').value.trim(),
        category: document.getElementById('bmCategory').value,
        subcategory: document.getElementById('bmSubcategory').value.trim(),
        isPrivate: document.getElementById('bmPrivate').checked
    });
    saveBookmarks(bookmarks);
    closeModal();
    renderBookmarkList();
}

function deleteCategory(name) {
    if (!confirm(`确定删除分类 "${name}" 及其所有书签？`)) return;
    saveBookmarks(getBookmarks().filter(b => b.category !== name));
    renderCategoryList();
    renderBookmarkList();
}

function deleteBookmark(idx) {
    if (!confirm('确定删除此书签？')) return;
    const bookmarks = getBookmarks();
    bookmarks.splice(idx, 1);
    saveBookmarks(bookmarks);
    renderBookmarkList();
}

function editBookmark(idx) {
    const bookmarks = getBookmarks();
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
            <div class="form-group"><label><input type="checkbox" id="editPrivate" ${bm.isPrivate ? 'checked' : ''}> 加密</label></div>
            <button type="submit" class="btn btn-primary">保存</button>
        </form>
    `);
}

function saveEditBookmark(idx, e) {
    e.preventDefault();
    const bookmarks = getBookmarks();
    bookmarks[idx] = {
        name: document.getElementById('editName').value.trim(),
        url: document.getElementById('editUrl').value.trim(),
        desc: document.getElementById('editDesc').value.trim(),
        category: document.getElementById('editCategory').value,
        subcategory: document.getElementById('editSub').value.trim(),
        isPrivate: document.getElementById('editPrivate').checked
    };
    saveBookmarks(bookmarks);
    closeModal();
    renderBookmarkList();
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

function getBookmarks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveBookmarks(bookmarks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
