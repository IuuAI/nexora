# Nexora — 导航中枢

> 科技驱动的书签导航系统
> 
> 仓库: [github.com/IuuAI/nexora](https://github.com/IuuAI/nexora)

一个极具科技感的书签导航系统，支持响应式布局、明暗主题、分类二级分组、加密与公开选择。

## ✨ 特性

- **响应式设计** — 完美适配桌面、平板、手机
- **明暗主题** — 一键切换，自动保存偏好
- **分类管理** — 支持一级分类和二级分类
- **加密/公开** — 敏感书签可加密保护
- **搜索功能** — 实时搜索书签
- **模块化架构** — 页头、主体、页脚分离
- **纯 CSS** — 无框架依赖，轻量快速

## 🗄️ 数据存储

| 部署方式 | 存储方案 |
|----------|----------|
| Docker | SQLite（文件持久化） |
| Cloudflare | D1 Database（Serverless SQL） |

## 🚀 部署方式

### 方式一：Docker 部署（推荐本地使用）

```bash
# 克隆并进入目录
git clone https://github.com/IuuAI/nexora.git
cd nexora

# 启动服务
docker-compose up -d

# 访问 http://localhost:8080
# 管理后台 http://localhost:8080/admin/
# 默认密码: nexora2024
```

**数据持久化：**
- SQLite 数据库文件存储在 Docker volume `nexora-data`
- 可通过 `docker volume ls` 查看
- 备份：`docker run --rm -v nexora-data:/data -v $(pwd):/backup alpine tar czf /backup/nexora-backup.tar.gz -C /data .`

### 方式二：Cloudflare Pages + D1 部署

#### 1. 创建 D1 数据库

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create nexora

# 记录 DATABASE_ID，更新 wrangler.toml
```

#### 2. 运行数据库迁移

```bash
wrangler d1 execute nexora --file=migrations/001_create_bookmarks.sql
```

#### 3. 部署 Worker（API）

```bash
# 更新 wrangler.toml 中的 database_id
wrangler deploy
```

#### 4. 部署 Pages（静态前端）

```bash
# 方法 A: 通过 Cloudflare Dashboard
# 登录 cloudflare.com → Pages → Create a project → Connect to Git
# 选择仓库，输出目录填 `.`，构建命令留空

# 方法 B: 通过 Wrangler
wrangler pages deploy .
```

#### 5. 配置环境变量

在 Cloudflare Dashboard 中为 Pages 设置：
- `NEXTORA_ADMIN_TOKEN` — 管理员 token（用于 API 认证）

## 📁 项目结构

```
nexora/
├── public/
│   └── index.html          # 主页面
├── admin/
│   └── index.html          # 管理控制台
├── assets/
│   ├── css/
│   │   ├── style.css       # 前端样式（含明暗主题变量）
│   │   └── admin.css       # 控制台样式
│   └── js/
│       ├── app.js          # 前端逻辑（API调用）
│       └── admin.js        # 控制台逻辑（CRUD）
├── server.py               # Python Flask API（Docker用）
├── _worker.js              # Cloudflare Worker API（D1用）
├── wrangler.toml           # Cloudflare 配置
├── init_db.py              # SQLite 初始化脚本
├── requirements.txt        # Python 依赖
├── Dockerfile              # Docker 镜像
├── docker-compose.yml      # Docker Compose
├── migrations/
│   └── 001_create_bookmarks.sql  # D1 迁移脚本
└── README.md
```

## 🔧 配置说明

### Docker 部署

修改 `docker-compose.yml`：
```yaml
environment:
  - NEXORA_ADMIN_PASS=your_password    # 管理密码
  - NEXORA_TOKEN_SECRET=your_secret   # Token 密钥
```

### Cloudflare 部署

修改 `wrangler.toml`：
```toml
[d1_databases]
binding = "NEXORA_D1"
database_name = "nexora"
database_id = "your-d1-id"

[vars]
ADMIN_PASSWORD = "nexora2024"
```

## 🛠️ API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/bookmarks` | 获取所有书签 | 仅公开可见 |
| POST | `/api/bookmarks` | 创建书签 | 管理员 |
| PUT | `/api/bookmarks/:id` | 更新书签 | 管理员 |
| DELETE | `/api/bookmarks/:id` | 删除书签 | 管理员 |
| POST | `/api/login` | 管理员登录 | - |

**认证头：** `X-Admin-Token: <token>`

## ⚠️ 注意事项

- Docker 部署：数据存储在 SQLite 文件，定期备份
- Cloudflare 部署：免费额度内 D1 查询次数有限制
- `is_private: true` 仅前端隐藏，不做加密处理
- 生产环境建议启用 HTTPS
