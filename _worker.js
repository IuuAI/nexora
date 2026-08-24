/** Nexora Cloudflare Worker — D1 + 内联静态文件 */
const ADMIN_PASSWORD = 'nexora2024';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    try {
      if (url.pathname === '/api/bookmarks' && request.method === 'GET') return handleGetBookmarks(env, request);
      if (url.pathname === '/api/bookmarks' && request.method === 'POST') return handleCreateBookmark(env, request);
      if (/^\/api\/bookmarks\/\d+$/.test(url.pathname) && request.method === 'PUT') return handleUpdateBookmark(env, request);
      if (/^\/api\/bookmarks\/\d+$/.test(url.pathname) && request.method === 'DELETE') return handleDeleteBookmark(env, request);
      if (url.pathname === '/api/login' && request.method === 'POST') return handleLogin(env, request);
      if (url.pathname === '/api/settings' && request.method === 'GET') return handleGetSettings(env);
      if (url.pathname.startsWith('/api/settings/') && request.method === 'PUT') return handleUpdateSetting(env, request);
      if (url.pathname === '/api/export' && request.method === 'GET') return handleExport(env);
      if (url.pathname === '/api/reset' && request.method === 'POST') return handleReset(env);
      return serveStatic(url.pathname);
    } catch (err) { return json({ error: err.message }, 500); }
  }
};

// ============ API 处理 ============
function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token' }; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }); }

async function getAdminToken(env, request) {
  const token = request.headers.get('X-Admin-Token');
  const expected = env.ADMIN_TOKEN;
  if (!expected) return null;
  return token === expected ? expected : null;
}

async function handleGetBookmarks(env, request) {
  const isAdmin = await getAdminToken(env, request);
  const sql = isAdmin ? 'SELECT * FROM bookmarks ORDER BY category, subcategory, name' : 'SELECT * FROM bookmarks WHERE is_private = 0 ORDER BY category, subcategory, name';
  const results = await env.NEXORA_D1.prepare(sql).all();
  return json(results.results.map(r => ({ id: r.id, name: r.name, url: r.url, desc: r.desc || '', category: r.category, subcategory: r.subcategory || '', is_private: r.is_private })));
}

async function handleCreateBookmark(env, request) {
  if (!await getAdminToken(env, request)) return json({ error: 'Unauthorized' }, 401);
  const data = await request.json();
  const result = await env.NEXORA_D1.prepare('INSERT INTO bookmarks (name,url,desc,category,subcategory,is_private) VALUES (?, ?, ?, ?, ?, ?)').bind(data.name, data.url, data.desc || '', data.category || 'work', data.subcategory || '', data.isPrivate ? 1 : 0).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function handleUpdateBookmark(env, request) {
  if (!await getAdminToken(env, request)) return json({ error: 'Unauthorized' }, 401);
  const id = parseInt(new URL(request.url).pathname.split('/').pop());
  const data = await request.json();
  await env.NEXORA_D1.prepare('UPDATE bookmarks SET name=?,url=?,desc=?,category=?,subcategory=?,is_private=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.name, data.url, data.desc || '', data.category || 'work', data.subcategory || '', data.isPrivate ? 1 : 0, id).run();
  return json({ message: 'Updated' });
}

async function handleDeleteBookmark(env, request) {
  if (!await getAdminToken(env, request)) return json({ error: 'Unauthorized' }, 401);
  const id = parseInt(new URL(request.url).pathname.split('/').pop());
  await env.NEXORA_D1.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run();
  return json({ message: 'Deleted' });
}

async function handleLogin(env, request) {
  const data = await request.json();
  if (data.password === ADMIN_PASSWORD || data.password === env.ADMIN_PASSWORD) {
    return json({ token: 'nexora-token-' + Date.now(), expires_in: 86400 });
  }
  return json({ error: 'Invalid password' }, 401);
}

async function handleGetSettings(env) {
  const results = await env.NEXORA_D1.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of results.results || []) settings[row.key] = row.value;
  return json(settings);
}

async function handleUpdateSetting(env, request) {
  const key = new URL(request.url).pathname.split('/').pop();
  const data = await request.json();
  await env.NEXORA_D1.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, data.value).run();
  return json({ message: 'Updated' });
}

async function handleExport(env) {
  const bm = await env.NEXORA_D1.prepare('SELECT * FROM bookmarks').all();
  const st = await env.NEXORA_D1.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of (st.results || [])) settings[row.key] = row.value;
  return json({ version: '1.0', exported_at: new Date().toISOString(), site_name: settings.site_name || 'Nexora', bookmarks: bm.results || [], settings });
}

async function handleReset(env) {
  await env.NEXORA_D1.prepare('DELETE FROM bookmarks').run();
  await env.NEXORA_D1.prepare('DELETE FROM settings').run();
  return json({ message: 'Reset complete' });
}

// ============ 静态文件内容 ============
const CSS_STYLE = `:root{--bg:#f5f7fa;--bg2:#fff;--text:#1a1a2e;--text2:#6b7280;--border:#e5e7eb;--accent:#6366f1;--hover:#4f46e5;--card:#fff}[-data-theme="dark"]{--bg:#0f172a;--bg2:#1e293b;--text:#f1f5f9;--text2:#94a3b8;--border:#334155;--accent:#818cf8;--hover:#6366f1}*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column}.header{background:var(--bg2);border-bottom:1px solid var(--border);padding:1rem 2rem;position:sticky;top:0;z-index:100}.header-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:2rem}.logo{display:flex;align-items:center;gap:.5rem;font-size:1.5rem;font-weight:700;color:var(--accent)}.logo-icon{font-size:1.75rem}.nav-links{display:flex;gap:.5rem;flex-wrap:wrap}.nav-item{padding:.5rem 1rem;border-radius:8px;color:var(--text2);text-decoration:none;font-weight:500;transition:all .2s}.nav-item:hover{background:var(--bg);color:var(--text)}.nav-item.active{background:var(--accent);color:#fff}.theme-toggle{background:none;border:1px solid var(--border);border-radius:8px;padding:.5rem;cursor:pointer;color:var(--text2);transition:all .2s}.main{flex:1;max-width:1200px;width:100%;margin:0 auto;padding:2rem}.search-bar{position:relative;max-width:600px;margin:0 auto 2rem}.search-bar input{width:100%;padding:1rem 1rem 1rem 3rem;border:2px solid var(--border);border-radius:12px;background:var(--bg2);color:var(--text);font-size:1rem;transition:all .2s}.search-bar input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,102,241,.1)}.search-icon{position:absolute;left:1rem;top:50%;transform:translateY(-50%);font-size:1.25rem}.categories-container{display:grid;gap:1.5rem}.category-card{background:var(--card);border-radius:16px;border:1px solid var(--border);overflow:hidden;transition:all .3s}.category-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);transform:translateY(-2px)}.category-header{padding:1.25rem 1.5rem;background:linear-gradient(135deg,var(--accent),var(--hover));color:#fff;display:flex;justify-content:space-between;align-items:center}.category-title{font-size:1.25rem;font-weight:600;display:flex;align-items:center;gap:.5rem}.category-count{background:rgba(255,255,255,.2);padding:.25rem .75rem;border-radius:20px;font-size:.85rem}.category-body{padding:1rem}.subcategory{margin-bottom:1rem}.subcategory:last-child{margin-bottom:0}.subcategory-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--bg);border-radius:8px;cursor:pointer;transition:all .2s}.subcategory-header:hover{background:var(--border)}.subcategory-title{font-weight:500}.subcategory-toggle{font-size:.75rem;color:var(--text2);transition:transform .2s}.subcategory.open .subcategory-toggle{transform:rotate(180deg)}.subcategory-content{display:none;padding:.5rem}.subcategory.open .subcategory-content{display:block}.bookmark-list{list-style:none}.bookmark-item{display:flex;align-items:center;gap:1rem;padding:.75rem 1rem;border-radius:8px;transition:all .2s;text-decoration:none;color:inherit}.bookmark-item:hover{background:var(--bg)}.bookmark-favicon{width:24px;height:24px;object-fit:contain}.bookmark-info{flex:1;min-width:0}.bookmark-name{font-weight:500;margin-bottom:.25rem}.bookmark-desc{font-size:.85rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bookmark-status{font-size:.7rem;padding:.2rem .5rem;border-radius:4px;background:var(--bg);color:var(--text2)}.bookmark-status.private{background:#fef3c7;color:#d97706}.bookmark-link{color:var(--accent);text-decoration:none;font-size:1.25rem;opacity:0;transition:opacity .2s}.bookmark-item:hover .bookmark-link{opacity:1}.footer{background:var(--bg2);border-top:1px solid var(--border);padding:1.5rem 2rem;margin-top:auto}.footer-inner{max-width:1200px;margin:0 auto;text-align:center}.footer p{color:var(--text2);font-size:.9rem}.footer-note{font-size:.8rem !important;margin-top:.25rem}.fab-container{position:fixed;bottom:2rem;right:2rem;z-index:1000;display:flex;flex-direction:column;align-items:center;gap:.5rem}.fab-btn{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--hover));color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.5rem;box-shadow:0 4px 12px rgba(99,102,241,.4);transition:all .3s ease}.fab-btn:hover{transform:scale(1.1) rotate(90deg);box-shadow:0 6px 20px rgba(99,102,241,.6)}.fab-menu{display:none;flex-direction:column;align-items:center;gap:.5rem}.fab-item{display:flex;flex-direction:column;align-items:center;gap:.25rem;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:.5rem .75rem;cursor:pointer;transition:all .2s;min-width:60px;font-size:.7rem}.fab-item:hover{background:var(--accent);color:#fff;border-color:var(--accent)}@media(max-width:768px){.header{padding:1rem}.header-inner{flex-wrap:wrap}.nav-links{order:3;width:100%;justify-content:center;margin-top:.5rem}.main{padding:1rem}}`;

const CSS_ADMIN = `:root{--bg:#f5f7fa;--bg2:#fff;--text:#1a1a2e;--text2:#6b7280;--border:#e5e7eb;--accent:#6366f1;--hover:#4f46e5;--danger:#ef4444;--success:#10b981}[-data-theme="dark"]{--bg:#0f172a;--bg2:#1e293b;--text:#f1f5f9;--text2:#94a3b8;--border:#334155;--accent:#818cf8;--hover:#6366f1}*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.admin-header{background:var(--bg2);border-bottom:1px solid var(--border);padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100}.admin-logo{display:flex;align-items:center;gap:1rem}.back-link{color:var(--accent);text-decoration:none;font-weight:600;font-size:1.1rem}.page-title{font-size:1.25rem;font-weight:600}.header-actions{display:flex;gap:.5rem}.admin-main{max-width:1200px;margin:0 auto;padding:2rem}.admin-section{background:var(--bg2);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 2px 4px rgba(0,0,0,.05)}.admin-section h3{margin-bottom:1rem;font-size:1.1rem}.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem}.form-group{margin-bottom:1rem}.form-group label{display:block;margin-bottom:.5rem;font-weight:500;color:var(--text2)}.form-group input,.form-group select{width:100%;padding:.75rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)}.btn{padding:.5rem 1rem;border:none;border-radius:6px;font-size:.9rem;cursor:pointer;transition:all .2s;font-weight:500}.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--hover)}.btn-secondary{background:var(--bg);color:var(--text);border:1px solid var(--border)}.btn-danger{background:var(--danger);color:#fff}.btn-add{background:var(--success);color:#fff}.category-item{border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:.5rem}.category-header{display:flex;justify-content:space-between;align-items:center}.category-info{display:flex;flex-direction:column;gap:.25rem}.category-name{font-weight:600}.category-meta{font-size:.85rem;color:var(--text2)}.category-actions{display:flex;gap:.5rem}.bookmark-row{display:flex;justify-content:space-between;align-items:center;padding:1rem;border:1px solid var(--border);border-radius:8px;margin-bottom:.5rem}.bookmark-data{display:flex;flex-direction:column;gap:.25rem;flex:1}.bookmark-url{font-size:.85rem;color:var(--text2);word-break:break-all}.bookmark-tags{display:flex;gap:.5rem;flex-wrap:wrap}.tag{font-size:.75rem;padding:.2rem .5rem;background:var(--bg);border-radius:4px;color:var(--text2)}.tag.private{background:#fef3c7;color:#d97706}.bookmark-actions{display:flex;gap:.5rem}.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:1000;justify-content:center;align-items:center}.modal.active{display:flex}.modal-content{background:var(--bg2);padding:2rem;border-radius:12px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;position:relative}.modal-close{position:absolute;top:1rem;right:1rem;font-size:1.5rem;cursor:pointer;color:var(--text2)}.login-container{min-height:100vh;display:flex;align-items:center;justify-content:center}.login-card{background:var(--bg2);padding:3rem;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.1);max-width:400px;width:100%;text-align:center}.login-logo .logo-icon{font-size:3rem;color:var(--accent)}.login-logo h1{font-size:2rem;margin:.5rem 0}.login-subtitle{color:var(--text2)}.btn-full{width:100%}.login-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border)}.login-footer a{color:var(--text2);text-decoration:none;font-size:.9rem}@media(max-width:768px){.admin-header{padding:1rem}.admin-main{padding:1rem}.category-header,.bookmark-row{flex-direction:column;align-items:flex-start;gap:1rem}}`;

const JS_APP = `const API_BASE=window.location.origin,THEME_KEY='nexora_theme',TOKEN_KEY='nexora_admin_token',CATEGORIES={work:{icon:'💼',name:'工作'},life:{icon:'🏠',name:'生活'},tech:{icon:'💻',name:'技术'},tools:{icon:'🛠️',name:'工具'},social:{icon:'💬',name:'社交'},media:{icon:'🎬',name:'娱乐'}},bookmarks=[];document.addEventListener('DOMContentLoaded',()=>{initTheme();loadSettings();loadBookmarks();setupEventListeners();checkLoginStatus()});async function apiRequest(endpoint,options={}){try{const headers={'Content-Type':'application/json',...options.headers},token=localStorage.getItem(TOKEN_KEY);token&&(headers['X-Admin-Token']=token);const res=await fetch(API_BASE+endpoint,{...options,headers});if(res.status===401){localStorage.removeItem(TOKEN_KEY);updateFabMenu(false);return{error:'Unauthorized'}}return await res.json()}catch(err){return{error:err.message}}}function initTheme(){const saved=localStorage.getItem(THEME_KEY)||'light';document.documentElement.setAttribute('data-theme',saved);document.getElementById('themeToggle').addEventListener('click',()=>{const current=document.documentElement.getAttribute('data-theme'),next=current==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.setItem(THEME_KEY,next)})}async function loadSettings(){const settings=await apiRequest('/api/settings');if(settings.site_name){document.getElementById('siteTitle').textContent=settings.site_name;document.title=settings.site_name+' — 导航中枢';document.getElementById('siteFooter').textContent=settings.site_name+' &copy; 2026'}if(settings.site_subtitle)document.getElementById('siteSubtitle').textContent=settings.site_subtitle}async function loadBookmarks(){bookmarks=await apiRequest('/api/bookmarks');renderCategories()}function setupEventListeners(){document.querySelectorAll('.nav-item').forEach(item=>{item.addEventListener('click',(e)=>{e.preventDefault();document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));e.target.classList.add('active');renderCategories(e.target.dataset.filter)})});document.getElementById('searchInput').addEventListener('input',debounce((e)=>renderCategories(null,e.target.value),300));document.getElementById('fabBtn').addEventListener('click',()=>{window.location.href='/admin/login.html'})}function renderCategories(filter='all',search=''){const container=document.getElementById('categoriesContainer');let html='';Object.keys(CATEGORIES).forEach(catKey=>{if(filter!=='all'&&filter!==catKey)return;const catInfo=CATEGORIES[catKey],catBookmarks=bookmarks.filter(b=>b.category===catKey);if(catBookmarks.length===0)return;const subgroups={};catBookmarks.forEach(b=>{const sub=b.subcategory||'其他';if(!subgroups[sub])subgroups[sub]=[];subgroups[sub].push(b)});const filteredSubgroups={};if(search){Object.entries(subgroups).forEach(([sub,items])=>{const matched=items.filter(b=>b.name.toLowerCase().includes(search.toLowerCase())||b.desc?.toLowerCase().includes(search.toLowerCase()));if(matched.length>0)filteredSubgroups[sub]=matched});if(Object.keys(filteredSubgroups).length===0)return}const displaySubgroups=search?filteredSubgroups:subgroups;html+='<article class=\"category-card\"><header class=\"category-header\"><h2 class=\"category-title\"><span class=\"category-icon\">'+catInfo.icon+'</span>'+catInfo.name+'</h2><span class=\"category-count\">'+catBookmarks.length+'</span></header><div class=\"category-body\">';Object.entries(displaySubgroups).forEach(([subName,items])=>{html+='<div class=\"subcategory\"><div class=\"subcategory-header\" onclick=\"this.parentElement.classList.toggle(\'open\')\"><span class=\"subcategory-title\">'+escHtml(subName)+'</span><span class=\"subcategory-toggle\">▼</span></div><div class=\"subcategory-content\"><ul class=\"bookmark-list\">'+items.map(b=>createBookmarkItem(b)).join('')+'</ul></div></div>'});html+='</div></article>'});container.innerHTML=html||'<p style=\"text-align:center;color:var(--text2);grid-column:1/-1;padding:40px\">暂无书签</p>'}function createBookmarkItem(b){try{const domain=new URL(b.url).hostname,favicon='https://www.google.com/s2/favicons?domain='+domain+'&sz=64';return '<li class=\"bookmark-item\"><img class=\"bookmark-favicon\" src=\"'+favicon+'\" alt=\"\" loading=\"lazy\" onerror=\"this.style.display=\'none\'\"><div class=\"bookmark-info\"><div class=\"bookmark-name\">'+escHtml(b.name)+'</div><div class=\"bookmark-desc\">'+escHtml(b.desc||domain)+'</div></div>'+((b.is_private)?'<span class=\"bookmark-status private\">加密</span>':'')+('<a class=\"bookmark-link\" href=\"'+escHtml(b.url)+'\" target=\"_blank\" rel=\"noopener\">↗</a></li>')}catch{return '<li class=\"bookmark-item\"><span>'+escHtml(b.name)+'</span></li>'}}function escHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}function debounce(fn,delay){let timer;return function(...args){clearTimeout(timer);timer=setTimeout(()=>fn.apply(this,args),delay)}}function checkLoginStatus(){updateFabMenu(!!localStorage.getItem(TOKEN_KEY))}function updateFabMenu(loggedIn){const fabBtn=document.getElementById('fabBtn'),fabMenu=document.getElementById('fabMenu');if(loggedIn){fabBtn.style.display='none';fabMenu.style.display='flex';document.getElementById('backToHomeBtn').onclick=()=>window.location.href='/';document.getElementById('logoutBtn').onclick=()=>{localStorage.removeItem(TOKEN_KEY);window.location.href='/admin/login.html'}}else{fabBtn.style.display='flex';fabMenu.style.display='none'}}`;

const JS_LOGIN = `const API_BASE=window.location.origin,TOKEN_KEY='nexora_admin_token';document.addEventListener('DOMContentLoaded',()=>{if(localStorage.getItem(TOKEN_KEY)){window.location.href='/admin/site-settings.html';return}document.getElementById('loginForm').addEventListener('submit',handleLogin)});async function handleLogin(e){e.preventDefault();const pwd=document.getElementById('adminPassword').value;try{const res=await fetch(API_BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});const data=await res.json();if(data.token){localStorage.setItem(TOKEN_KEY,data.token);window.location.href='/admin/site-settings.html'}else{alert('密码错误！')}}catch(err){alert('登录失败:'+err.message)}}`;

const HTML_INDEX = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Nexora — 导航中枢</title><style>${CSS_STYLE}</style></head><body><header class="header"><div class="header-inner"><div class="logo"><span class="logo-icon">◈</span><span class="logo-text" id="siteTitle">Nexora</span></div><nav class="nav-links"><a href="#" class="nav-item active" data-filter="all">全部</a><a href="#" class="nav-item" data-filter="work">工作</a><a href="#" class="nav-item" data-filter="life">生活</a><a href="#" class="nav-item" data-filter="tech">技术</a></nav><button class="theme-toggle" id="themeToggle" aria-label="切换主题"><span class="theme-icon sun">☀️</span><span class="theme-icon moon">🌙</span></button></div></header><main class="main"><div class="search-bar"><input type="text" id="searchInput" placeholder="搜索书签..." autocomplete="off"><span class="search-icon">🔍</span></div><div class="categories-container" id="categoriesContainer"></div></main><footer class="footer"><div class="footer-inner"><p id="siteFooter">Nexora &copy; 2026</p><p class="footer-note" id="siteSubtitle">科技驱动的导航中枢</p></div></footer><div class="fab-container" id="fabContainer"><button class="fab-btn" id="fabBtn" title="管理控制台">⚙️</button><div class="fab-menu" id="fabMenu" style="display:none;"><button class="fab-item" id="backToHomeBtn" title="返回首页"><span>🏠</span><span>首页</span></button><button class="fab-item" id="logoutBtn" title="退出登录"><span>🚪</span><span>退出</span></button></div></div><script>${JS_APP}</script></body></html>`;

const HTML_LOGIN = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Nexora — 登录</title><style>${CSS_ADMIN}</style></head><body><div class="login-container"><div class="login-card"><div class="login-logo"><span class="logo-icon">◈</span><h1>Nexora</h1><p class="login-subtitle">管理控制台</p></div><form id="loginForm" class="login-form"><div class="form-group"><label>访问密码</label><input type="password" id="adminPassword" placeholder="请输入管理密码" required autofocus></div><button type="submit" class="btn btn-primary btn-full">登录</button></form><div class="login-footer"><a href="/" class="back-link">← 返回首页</a></div></div></div><script>${JS_LOGIN}</script></body></html>`;

// ============ 静态文件服务 ============
function getFiles() {
  return {
    '/': HTML_INDEX,
    '': HTML_INDEX,
    '/index.html': HTML_INDEX,
    '/admin/login.html': HTML_LOGIN,
    '/assets/css/style.css': CSS_STYLE,
    '/assets/css/admin.css': CSS_ADMIN,
    '/assets/js/app.js': JS_APP,
    '/assets/js/login.js': JS_LOGIN,
  };
}

function serveStatic(pathname) {
  const FILES = getFiles();
  const content = FILES[pathname];
  if (!content) return json({ error: 'Not found', pathname: pathname, keys: Object.keys(FILES), hasSlash: typeof FILES['/'], hasEmpty: typeof FILES[''] }, 404);
  const contentType = pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'application/javascript' : 'text/html';
  return new Response(content, { headers: { 'Content-Type': contentType, ...corsHeaders() } });
}
