// ===== Nexora — 数据管理逻辑 =====

const API_BASE = window.location.origin;
const TOKEN_KEY = 'nexora_admin_token';

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadStats();
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

async function loadStats() {
    const bookmarks = await apiRequest('/api/bookmarks');
    const categories = [...new Set(bookmarks.map(b => b.category))];
    
    document.getElementById('totalBookmarks').textContent = bookmarks.length;
    document.getElementById('totalCategories').textContent = categories.length;
    document.getElementById('privateCount').textContent = bookmarks.filter(b => b.is_private).length;
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

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // 调用导入 API（需要在后端实现）
            const response = await fetch(`${API_BASE}/api/import`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Token': localStorage.getItem(TOKEN_KEY)
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (result.error) {
                alert('导入失败: ' + result.error);
            } else {
                alert('导入成功！');
                window.location.reload();
            }
        } catch (err) {
            alert('文件解析失败: ' + err.message);
        }
    };
    reader.readAsText(file);
}

async function resetAllData() {
    if (!confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有书签和设置将被清除！')) return;
    
    await apiRequest('/api/reset', { method: 'POST' });
    alert('数据已重置');
    window.location.reload();
}
