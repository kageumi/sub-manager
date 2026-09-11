# 订阅管理器

基于 Cloudflare Workers 的私有订阅管理器，支持在线管理 Clash、Singbox 等代理订阅链接。
管理界面使用 [Material Web](https://github.com/material-components/material-web)（Material Design 3）组件构建。

## 功能特性

- **首页**：Dashboard 入口页，展示公开订阅链接格式（`/{id}`）与管理入口（`/admin`）
- **登录页面**：Material Web 登录界面，基于 HMAC 签名 Cookie 的会话，支持退出登录
- **订阅管理**：添加、编辑、删除订阅，自定义 ID、名称、Content-Type、文件名
- **地区 / 域名限制**：可选只允许特定国家/地区（`request.cf.country`）或特定域名（支持 `*.example.com` 通配）访问
- **客户端增强**：自定义 `Subscription-Userinfo`、`Content-Disposition` 文件名，支持 `ETag` / `If-None-Match` 304 协商缓存
- **爬虫拦截**：公开订阅按 User-Agent 拦截搜索引擎与扫描器，放行常见订阅客户端
- **公开订阅**：订阅链接如 `https://example.com/{id}` 可公开访问
- **REST API**：管理端提供 JSON API，便于自动化管理

## 项目结构

```
src/
├── index.js              # Worker 入口（ES Module 语法）
├── router.js             # 路由分发（含 /_health、OPTIONS）
├── handlers/
│   ├── landing.js        # GET /            首页 / Dashboard 入口（公开）
│   ├── home.js           # GET /admin       管理页面（需登录）
│   ├── login.js          # GET /login       登录页面
│   ├── auth.js           # /api/login /api/logout 会话接口
│   ├── assets.js         # /app.js /login.js /app.css 静态资源
│   ├── api.js            # /api/subs        CRUD API（需登录）
│   ├── subscription.js   # GET /{id}        公开订阅内容
│   ├── font.js           # GET /fonts/...   自托管图标字体
│   └── robots.js         # GET /robots.txt
├── lib/
│   ├── config.js         # 环境变量集中读取（站点名、凭据、密钥）
│   ├── auth.js           # 凭据校验（常量时间比较）+ 会话判断
│   ├── session.js        # HMAC 签名的会话 Cookie
│   ├── store.js          # KV 数据访问（内容 + 元数据，兼容旧数据）
│   ├── metadata.js       # 元数据、国家/域名规范化、sha256
│   ├── template.js       # 极简 {{VAR}} 模板渲染
│   ├── bots.js           # 爬虫 UA 识别
│   ├── validate.js       # 输入校验与清洗
│   └── http.js           # 响应、重定向与安全响应头封装
└── ui/
    ├── home.html         # Material Web 首页 / Dashboard 入口
    ├── index.html        # Material Web 管理界面
    ├── login.html        # Material Web 登录界面
    ├── app.js            # 管理端逻辑（通过 Text 规则内联打包）
    ├── login.js          # 登录端逻辑
    ├── styles.css        # 共享设计令牌与字体
    └── material-symbols.woff2  # Material Symbols 图标字体（按需裁剪的子集）
```

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 KV 命名空间

```bash
npx wrangler kv namespace create SUB
```

将输出的 `id` 填入 `wrangler.toml` 的 `[[kv_namespaces]]`。

### 3. 配置站点与认证

在 `wrangler.toml` 的 `[vars]` 中设置 `SITE_NAME`（首页与登录页显示的名称，建议用不起眼的名字）。`AUTH_USER` / `AUTH_PASS` 仅用于本地开发，生产环境请使用 Secrets：

```bash
npx wrangler secret put AUTH_USER
npx wrangler secret put AUTH_PASS
npx wrangler secret put SESSION_SECRET   # 可选，建议设置随机字符串
```

会话 Cookie 使用 HMAC-SHA256 签名；未设置 `SESSION_SECRET` 时会回退用 `AUTH_USER:AUTH_PASS` 派生密钥。

### 4. 本地开发与部署

```bash
npm run dev      # 本地开发 http://localhost:8787
npm run deploy   # 部署到 Cloudflare Workers
npm run format   # 用 Prettier 统一格式
npm run check    # 构建校验（wrangler --dry-run）
```

部署后如需自定义域名/路由，在 Cloudflare 控制台为 Worker 添加路由 `example.com/*`。

## 使用说明

1. 访问 `https://example.com` 打开首页，点击「打开面板」进入 `/admin`；未登录会先跳转 `/login`。
2. 输入用户名密码登录后进入管理后台 `/admin`。
3. 点击「新建」填写：
   - **订阅 ID**：字母或数字开头，可含点、下划线、连字符
   - **订阅名称**：显示名称
   - **Content-Type**：可选，返回给客户端的响应类型（默认 `text/plain; charset=utf-8`）
   - **文件名**：可选，`Content-Disposition` 中的文件名（默认 `{id}.yaml`）
   - **地区限制**：可选，逗号分隔的两位国家代码，如 `CN,US`
   - **域名限制**：可选，允许访问的域名，支持 `*.example.com`
   - **Subscription-Userinfo**：可选，返回给客户端的流量信息头
   - **订阅内容**：粘贴 YAML 或 JSON 格式的订阅配置
4. 保存后订阅链接为 `https://example.com/{id}`。
5. 在左侧列表中选择订阅可编辑、删除或复制链接；右上角可退出登录。

## HTTP API

管理端接口需登录（会话 Cookie）。

| 方法     | 路径             | 说明                        |
| -------- | ---------------- | --------------------------- |
| `POST`   | `/api/login`     | 登录，成功后下发会话 Cookie |
| `POST`   | `/api/logout`    | 退出登录                    |
| `GET`    | `/api/subs`      | 列出全部订阅（不含内容）    |
| `GET`    | `/api/subs/{id}` | 获取单个订阅（含内容）      |
| `POST`   | `/api/subs`      | 新建订阅                    |
| `PUT`    | `/api/subs/{id}` | 更新订阅                    |
| `DELETE` | `/api/subs/{id}` | 删除订阅                    |

请求体示例：

```json
{
  "id": "sub",
  "name": "Clash 配置",
  "contentType": "text/yaml; charset=utf-8",
  "filename": "clash.yaml",
  "allowedCountries": ["CN", "US"],
  "allowedDomains": ["example.com", "*.foo.com"],
  "subscriptionUserinfo": "upload=0; download=0; total=100; expire=0",
  "content": "proxies:\n  - name: node1\n    ..."
}
```

## 注意事项

- 全站返回 `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex`，`robots.txt` 也禁止收录
- 订阅内容支持 YAML 和 JSON 格式，直接粘贴配置文本
- 地区 / 域名限制未匹配时返回 `403`；设置了地区限制的订阅不缓存，避免跨地区缓存绕过限制
- 公开订阅默认缓存 1 小时，提供 `ETag` / `Last-Modified`，支持 `If-None-Match` 协商缓存（304）
- 公开订阅按 User-Agent 拦截爬虫/扫描器，放行常见订阅客户端
- 管理端 API 会校验同源（`Origin` / `Sec-Fetch-Site`）与 JSON Content-Type，防止 CSRF
- 登录失败按 IP 限流：默认 15 分钟内最多 20 次失败，超出返回 `429`；可用 `LOGIN_MAX_ATTEMPTS`（设为 `0` 关闭）和 `LOGIN_WINDOW_SECONDS` 调整
- 会话 Cookie 使用 HMAC-SHA256 签名，`HttpOnly` + `SameSite=Strict`，生产环境自动加 `Secure`
- 输入数据会进行安全校验与清洗，管理页面通过 CSP 与输出转义防止 XSS
- 订阅 ID 需以字母或数字开头，仅含字母、数字、点、下划线、连字符，且不能使用保留字
- 订阅名称会自动移除 HTML 标签
- 单个订阅内容上限 24MB（KV 单值上限 25MB）
- 兼容旧数据：历史 `{ name, content, regions }` 记录会在读取时自动迁移
