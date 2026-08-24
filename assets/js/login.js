// ===== Nexora — 登录逻辑 =====

const API_BASE = window.location.origin;
const TOKEN_KEY = 'nexora_admin_token';

document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已登录
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        window.location.href = '/admin/site-settings.html';
    }
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    
    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        
        if (data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            window.location.href = '/admin/site-settings.html';
        } else {
            alert('密码错误！');
        }
    } catch (err) {
        alert('登录失败: ' + err.message);
    }
}
