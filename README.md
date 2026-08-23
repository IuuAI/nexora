# Nexora — 导航中枢

一个极具科技感的书签导航系统，支持响应式布局、明暗主题、分类二级分组、加密与公开选择。

## ✨ 特性

- **响应式设计** — 完美适配桌面、平板、手机
- **明暗主题** — 一键切换，自动保存偏好
- **分类管理** — 支持一级分类和二级分类
- **加密/公开** — 敏感书签可加密保护
- **搜索功能** — 实时搜索书签
- **模块化架构** — 页头、主体、页脚分离
- **纯 CSS** — 无框架依赖，轻量快速
- **双部署方式** — Docker / Cloudflare Pages

## 🚀 快速开始

### 方式一：Docker 部署

```bash
git clone <your-repo>
cd nexora
docker-compose up -d
# 访问 http://localhost:8080
```

### 方式二：Cloudflare Pages 部署

1. 推送到 GitHub 仓库
2. 登录 [cloudflare.com](https://cloudflare.com) → Pages → Create a project
3. 选择仓库，输出目录填 `.`（项目根目录）
4. 点击 Deploy

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
│       ├── app.js          # 前端逻辑（搜索/主题/分类渲染）
│       └── admin.js        # 控制台逻辑（CRUD/加密管理）
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## 🔧 配置

- **修改密码**：编辑 `assets/js/admin.js` 中的 `DEFAULT_PASSWORD`
- **添加书签**：访问控制台 `/admin/` 或编辑 `assets/js/app.js` 中的初始数据

## ⚠️ 注意事项

- 数据存储在浏览器 localStorage，清除浏览器数据会丢失
- `isPrivate: true` 仅前端隐藏，不做加密处理
- 生产环境建议启用 HTTPS
