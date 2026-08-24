/**
 * Nexora Cloudflare Worker — D1 Database Backend
 * 
 * 部署说明：
 * 1. 创建 D1 数据库: wrangler d1 create nexora
 * 2. 运行迁移: wrangler d1 execute nexora --file=migrations/001_create_bookmarks.sql
 * 3. 绑定到 Workers: wrangler.toml 中配置 d1_databases
 * 4. 部署: wrangler deploy
 */

const ADMIN_PASSWORD = 'nexora2024'; // 从环境变量读取: process.env.ADMIN_PASSWORD

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    
    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, { 
        headers: corsHeaders() 
      });
    }
    
    try {
      // API 路由处理
      if (url.pathname === '/api/bookmarks' && method === 'GET') {
        return handleGetBookmarks(env, request);
      }
      if (url.pathname === '/api/bookmarks' && method === 'POST') {
        return handleCreateBookmark(env, request);
      }
      if (url.pathname.match(/^\/api\/bookmarks\/\d+$/) && method === 'PUT') {
        return handleUpdateBookmark(env, request);
      }
      if (url.pathname.match(/^\/api\/bookmarks\/\d+$/) && method === 'DELETE') {
        return handleDeleteBookmark(env, request);
      }
      if (url.pathname === '/api/login' && method === 'POST') {
        return handleLogin(env, request);
      }
      if (url.pathname === '/api/settings' && method === 'GET') {
        return handleGetSettings(env);
      }
      if (url.pathname.match(/^\/api\/settings\/.+/) && method === 'PUT') {
        return handleUpdateSetting(env, request);
      }
      if (url.pathname === '/api/export' && method === 'GET') {
        return handleExport(env);
      }
      if (url.pathname === '/api/import-file' && method === 'POST') {
        return handleImportFile(env, request);
      }
      if (url.pathname === '/api/backup/create' && method === 'POST') {
        return handleCreateBackup(env);
      }
      if (url.pathname === '/api/backup/list' && method === 'GET') {
        return handleListBackups(env);
      }
      if (url.pathname.match(/^\/api\/backup\/download\/.+/) && method === 'GET') {
        return new Response('备份下载功能需要在本地部署使用', { status: 501 });
      }
      if (url.pathname.match(/^\/api\/backup\/delete\/.+/) && method === 'DELETE') {
        return handleDeleteBackup(env, request);
      }
      if (url.pathname === '/api/reset' && method === 'POST') {
        return handleReset(env);
      }
      
      // 返回 404 给非 API 请求
      return json({ error: 'Not found' }, 404);
      
    } catch (err) {
      console.error('Worker Error:', err);
      return json({ error: err.message }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

async function getAdminToken(env, request) {
  const token = request.headers.get('X-Admin-Token');
  const expected = env.ADMIN_TOKEN;
  if (!expected) return null; // 未设置则不需要认证
  return token === expected ? expected : null;
}

async function handleGetBookmarks(env, request) {
  const isAdmin = await getAdminToken(env, request);
  
  const sql = isAdmin 
    ? 'SELECT * FROM bookmarks ORDER BY category, subcategory, name'
    : 'SELECT * FROM bookmarks WHERE is_private = 0 ORDER BY category, subcategory, name';
  
  const stmt = env.NEXORA_D1.prepare(sql);
  const results = await stmt.all();
  
  return json(results.results.map(r => ({
    id: r.id,
    name: r.name,
    url: r.url,
    desc: r.desc || '',
    category: r.category,
    subcategory: r.subcategory || '',
    is_private: r.is_private,
    created_at: r.created_at,
    updated_at: r.updated_at
  })));
}

async function handleCreateBookmark(env, request) {
  if (!await getAdminToken(env, request)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  
  const data = await request.json();
  const stmt = env.NEXORA_D1.prepare(
    `INSERT INTO bookmarks (name, url, desc, category, subcategory, is_private) 
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  
  const result = await stmt.bind(
    data.name, data.url, data.desc || '', data.category || 'work',
    data.subcategory || '', data.isPrivate ? 1 : 0
  ).run();
  
  return json({ id: result.meta.last_row_id, message: 'Created' }, 201);
}

async function handleUpdateBookmark(env, request) {
  if (!await getAdminToken(env, request)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  
  const id = parseInt(new URL(request.url).pathname.split('/').pop());
  const data = await request.json();
  
  const stmt = env.NEXORA_D1.prepare(
    `UPDATE bookmarks SET name=?, url=?, desc=?, category=?, subcategory=?, is_private=?, 
     updated_at=CURRENT_TIMESTAMP WHERE id=?`
  );
  
  await stmt.bind(
    data.name, data.url, data.desc || '', data.category || 'work',
    data.subcategory || '', data.isPrivate ? 1 : 0, id
  ).run();
  
  return json({ message: 'Updated' });
}

async function handleDeleteBookmark(env, request) {
  if (!await getAdminToken(env, request)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  
  const id = parseInt(new URL(request.url).pathname.split('/').pop());
  const stmt = env.NEXORA_D1.prepare('DELETE FROM bookmarks WHERE id = ?');
  await stmt.bind(id).run();
  
  return json({ message: 'Deleted' });
}

async function handleLogin(env, request) {
  const data = await request.json();
  const password = data.password || '';
  
  // D1 环境使用简单比较（生产环境应使用更安全的哈希）
  if (password === ADMIN_PASSWORD || password === env.ADMIN_PASSWORD) {
    return json({ 
      token: 'd1-admin-token-' + Date.now(),
      expires_in: 86400 
    });
  }
  
  return json({ error: 'Invalid password' }, 401);
}

async function handleGetSettings(env) {
  const stmt = env.NEXORA_D1.prepare('SELECT * FROM settings');
  const results = await stmt.all();
  const settings = {};
  for (const row of results.results || []) {
    settings[row.key] = row.value;
  }
  return json(settings);
}

async function handleUpdateSetting(env, request) {
  const key = new URL(request.url).pathname.split('/').pop();
  const data = await request.json();
  const stmt = env.NEXORA_D1.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  await stmt.bind(key, data.value).run();
  return json({ message: 'Setting updated' });
}

async function handleExport(env) {
  const bookmarksStmt = env.NEXORA_D1.prepare('SELECT * FROM bookmarks ORDER BY category, name');
  const settingsStmt = env.NEXORA_D1.prepare('SELECT * FROM settings');
  
  const bookmarksResult = await bookmarksStmt.all();
  const settingsResult = await settingsStmt.all();
  
  const bookmarks = bookmarksResult.results || [];
  const settings = {};
  for (const row of (settingsResult.results || [])) {
    settings[row.key] = row.value;
  }
  
  return json({
    version: '1.0',
    exported_at: new Date().toISOString(),
    site_name: settings.site_name || 'Nexora',
    bookmarks,
    settings
  });
}

async function handleImportFile(env, request) {
  // D1 环境暂不支持文件上传，返回提示
  return json({ error: '文件导入功能请在本地 Docker 部署使用' }, 501);
}

async function handleCreateBackup(env) {
  return json({ error: '备份功能请在本地 Docker 部署使用' }, 501);
}

async function handleListBackups(env) {
  return json({ backups: [] });
}

async function handleDeleteBackup(env, request) {
  return json({ error: '备份功能请在本地 Docker 部署使用' }, 501);
}

async function handleReset(env) {
  await env.NEXORA_D1.prepare('DELETE FROM bookmarks').run();
  await env.NEXORA_D1.prepare('DELETE FROM settings').run();
  return json({ message: 'Reset complete' });
}
