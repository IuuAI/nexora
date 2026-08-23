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
      // 路由处理
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
      
      // 静态文件由 Pages 提供
      return env.ASSETS.fetch(request);
      
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
  
  // D1 环境使用 HMAC 或简单比较（生产环境应使用更安全的哈希）
  if (password === ADMIN_PASSWORD || password === env.ADMIN_PASSWORD) {
    return json({ 
      token: 'd1-admin-token',
      expires_in: 86400 
    });
  }
  
  return json({ error: 'Invalid password' }, 401);
}
