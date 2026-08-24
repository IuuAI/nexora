// ===== Nexora — 站点设置逻辑 =====

const API_BASE = window.location.origin;
const TOKEN_KEY = 'nexora_admin_token';

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadSettings();
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

async function loadSettings() {
    const settings = await apiRequest('/api/settings');
    if (settings.site_name) document.getElementById('siteName').value = settings.site_name;
    if (settings.site_subtitle) document.getElementById('siteSubtitle').value = settings.site_subtitle;
    if (settings.default_theme) document.getElementById('defaultTheme').value = settings.default_theme;
}

async function saveSettings() {
    const siteName = document.getElementById('siteName').value.trim();
    const siteSubtitle = document.getElementById('siteSubtitle').value.trim();
    const newPassword = document.getElementById('adminPassword').value;
    
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
    
    if (newPassword) {
        // 更新密码需要特殊处理，这里简单提示
        alert('密码修改功能请在服务器配置中修改');
    }
    
    alert('设置已保存！');
}

async function saveAppearance() {
    const theme = document.getElementById('defaultTheme').value;
    await apiRequest('/api/settings/default_theme', {
        method: 'PUT',
        body: JSON.stringify({ value: theme })
    });
    alert('外观设置已保存！');
}
