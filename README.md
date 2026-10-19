# 订阅管理器

基于 Cloudflare Workers 的私有订阅管理器，支持在线管理 Clash、Singbox 等代理订阅链接。
管理界面面向个人开发自用，使用 [React 19](https://react.dev) + [shadcn/ui](https://ui.shadcn.com)（Base UI、Tailwind CSS 4）构建。采用极简布局，不提供工具提示、引导文案或装饰性面板，通过 Vite 打包后由 Worker 托管。

## 功能特性

- **订阅列表**：桌面表格、手机列表，支持名称 / ID / 地区 / 域名搜索、访问范围筛选、排序与分页；复制直接操作，编辑和删除位于管理菜单
- **页内新建与编辑**：名称 / ID → 订阅链接 → 配置内容 → 可选设置，顶部操作栏提供返回与保存
- **配置编辑**：本地导入 / 下载、JSON 格式化、`⌘/Ctrl + S` 保存
- **编辑保护**：离开草稿时可选择保存后离开、不保存或继续编辑；撤销修改需确认；取消过时的详情请求，401 重新登录保留草稿
- **单地址工作区**：管理界面始终使用 `/`，登录、列表和编辑在页面内切换，不使用 Hash 或前端路由
- **密码登录**：仅需访问密码（`env.PASSWORD`），基于 HMAC 签名 Cookie 的会话，支持退出登录
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
├── router.js             # 路由分发（含 /_health、OPTIONS、/assets/*）
├── handlers/
│   ├── page.js           # GET /            单页应用（公开，登录态由前端判断）
│   ├── auth.js           # /api/login /api/logout /api/session 会话接口
│   ├── assets.js         # /assets/*、/favicon.svg 托管 Vite 构建产物
│   ├── api.js            # /api/subs        CRUD API（需登录）
│   ├── subscription.js   # GET /{id}        公开订阅内容
│   └── robots.js         # GET /robots.txt
├── lib/
│   ├── config.js         # 环境变量集中读取（访问密码）
│   ├── auth.js           # 密码校验（常量时间比较）+ 会话判断
│   ├── session.js        # HMAC 签名的会话 Cookie（密钥由访问密码派生）
│   ├── store.js          # KV 数据访问（内容 + 元数据，兼容旧数据）
│   ├── bots.js           # 爬虫 UA 识别
│   ├── ratelimit.js      # 登录失败限流
│   └── http.js           # 响应、安全响应头与请求体读取
frontend/                 # React + shadcn/ui 源码（Vite 入口）
├── index.html            # 唯一页面入口
├── public/               # 原样拷贝到 dist 根目录的静态资源（站点图标）
└── src/
    ├── main.jsx          # React 挂载入口
    ├── app/              # 会话、工作空间、视图切换与未保存保护
    ├── pages/            # 登录、列表和新建 / 编辑页面
    ├── subscriptions/    # 订阅请求、集合状态、草稿生命周期、表单字段
    ├── components/ui/    # 官方 CLI 安装的 shadcn/ui 组件源码
    ├── lib/utils.js      # cn 工具导出
    └── shared/           # 主题、菜单、确认框、HTTP、下载与快捷键
shared/subscription.js    # 前后端共用的校验、元数据、规范化与内容限制
tests/                    # 后端、前端 API / 模型、状态回归测试
dist/                     # Vite 构建产物（不提交，部署前生成）
```

## 部署步骤

### 1. 安装依赖

```bash
bun install
```

### 2. 创建 KV 命名空间

```bash
bunx wrangler kv namespace create SUB
```

将输出的 `id` 填入 `wrangler.toml` 的 `[[kv_namespaces]]`。

### 3. 配置访问密码

本地开发在被 Git 忽略的 `.dev.vars` 中设置 `PASSWORD`（至少 8 位）：

```dotenv
PASSWORD="your-local-password"
```

生产环境必须使用 Secrets，不要将密码写入 `wrangler.toml` 或提交到仓库。首次部署或从明文配置迁移时，先执行：

```bash
bunx wrangler secret put PASSWORD
```

会话 Cookie 使用 HMAC-SHA256 签名，签名密钥由访问密码派生，无需额外的 `SESSION_SECRET`。

### 4. 本地开发与部署

```bash
bun run dev      # 构建前端并启动本地开发 http://localhost:8787
bun run dev:ui   # 仅监听前端改动（另开终端配合 wrangler dev）
bun run build    # 仅构建前端到 dist/
bun run deploy   # 构建并部署到 Cloudflare Workers
bun run format   # 用 Prettier 统一格式
bun run check    # 测试、格式检查、前端构建、Worker 部署预检（不发布）
bun run test     # 后端、前端 API / 模型与业务状态回归测试
```

前端为 React + shadcn/ui，由 Vite 构建到 `dist/`；Worker 通过 `ASSETS` 绑定托管
`/assets/*`（带长期缓存），`/` 由 Worker 返回构建后的单页 HTML。
修改前端代码后需重新构建（`bun run build`，或 `bun run dev:ui` 监听重建）。

部署后如需自定义域名/路由，在 Cloudflare 控制台为 Worker 添加路由 `example.com/*`。

## 使用说明

1. 访问 `https://example.com`，输入访问密码登录。
2. 在列表中点击「新建订阅」，填写基本信息与配置内容；可选设置通过「访问限制」和「客户端响应」页签切换：
   - **订阅 ID**：字母或数字开头，可含点、下划线、连字符
   - **订阅名称**：显示名称
   - **Content-Type**：可选，返回给客户端的响应类型（默认 `text/plain; charset=utf-8`）
   - **文件名**：可选，`Content-Disposition` 中的文件名（默认 `{id}.yaml`）
   - **地区限制**：可选，逗号分隔的两位国家代码，如 `CN,US`（无效代码会在表单内提示）
   - **域名限制**：可选，允许访问的域名，支持 `*.example.com`
   - **Subscription-Userinfo**：可选，返回给客户端的流量信息头
   - **订阅内容**：粘贴 YAML 或 JSON 格式的订阅配置
3. 保存后订阅链接为 `https://example.com/{id}`。
4. 列表顶部可搜索、筛选、排序、刷新和新建；点击名称编辑，行内直接复制，更多菜单提供编辑和删除。
5. 编辑页在桌面采用内容 / 设置两列布局，手机自动纵向排列；顶部保留返回、撤销和保存操作。保存后留在编辑页，未修改时不重复保存；返回列表保留查询与滚动位置。
6. 离开未保存的草稿时可直接保存后继续，也可不保存或继续编辑。撤销恢复到上次保存的内容，需确认；删除同样需确认。
7. 外观切换和退出登录位于全局顶栏。保存后的订阅链接可在编辑页直接复制。

## 前端设计与导航

- 面向个人开发者，只保留登录、列表和新建 / 编辑页面。不引入侧栏、统计面板和冗长的引导文案。
- 使用官方 `@shadcn` registry 的 Base UI / Nova 默认主题、Geist 本地字体与组件样式，不添加自定义按钮变体或重画皮肤。通过 `Card`、`Table`、`Tabs`、`Field`、`InputGroup`、`AlertDialog` 和 `Toast` 建立布局与层次。
- 无 Tooltip，也不生成原生 `title` 悬浮提示，包括表单标签和分页按钮；不提供字段示例、帮助文案或快捷键提示。仅保留字段名、必要状态、错误反馈与风险确认。
- 列表使用默认卡片承载查询、表格和分页。复制始终可见，删除移入更多菜单，减少误触；空列表可直接新建。
- 编辑器将基本信息与配置放在主列，可选设置和订阅链接位于侧列；校验失败切换到对应页签后聚焦字段。保存错误显示在页面内，草稿不丢失。
- 保留浅色 / 深色 / 跟随系统及减少动态效果支持。字体、图标和资源本地打包，沿用现有 CSP，不使用 CDN。主题偏好键仍为 `sub-manager-theme`。
- 登录、列表、新建与编辑均使用 `/`，界面切换不修改 URL 或浏览器历史。刷新后回到列表；历史 Hash 地址会自动移除片段。公开订阅仍使用 `/{id}`。
- 保存失败保留草稿；离开编辑器取消详情请求；保存期间禁止重复提交与编辑；会话过期后保留编辑器，重新登录继续操作。
- 管理工作空间、列表与编辑器按需加载，空闲时预取代码块，视图切换无需等待。下载仅在用户操作时生成 Blob，避免每次输入都分配大型配置文件。
- 站点图标为本地 SVG（`/favicon.svg`），标签页标题跟随当前视图（订阅列表 / 新建订阅 / 编辑订阅），移动端地址栏颜色跟随主题。
- 保存接口直接返回最终元数据，本地更新列表与编辑器，不立即重读最终一致的 KV；不在响应中回传大段订阅内容。删除成功后也直接更新本地列表。

### 架构约定

- `shared/subscription.js` 为纯业务规则，不依赖 React、HTTP 或 KV。
- Worker 的 `handlers` 负责 HTTP，`lib/store.js` 负责持久化，数据格式与接口保持稳定。
- `subscriptions/api.js` 统一校验订阅响应，集合状态负责加载、写入与本地元数据更新。
- 草稿状态由编辑页独立持有，管理详情请求取消、校验、保存、撤销与文件导入竞态，不再混入列表状态。
- `app/NavigationGuard.jsx` 统一处理工作区视图切换、退出登录与关闭页面的未保存保护，不依赖路由库。

组件规范与示例以 [shadcn/ui Base UI 文档](https://ui.shadcn.com/docs/components)为准。使用 `bunx --bun shadcn@latest docs <component>` 查看组件资料，`bunx --bun shadcn@latest add @shadcn/<component>` 添加组件；已有组件有本地调整时，先用 `--dry-run` / `--diff` 检查，不直接覆盖。

## HTTP API

管理端接口需登录（会话 Cookie）。

| 方法     | 路径             | 说明                            |
| -------- | ---------------- | ------------------------------- |
| `GET`    | `/api/session`   | 查询当前会话是否已登录          |
| `POST`   | `/api/login`     | 密码登录，成功后下发会话 Cookie |
| `POST`   | `/api/logout`    | 退出登录                        |
| `GET`    | `/api/subs`      | 列出全部订阅（不含内容）        |
| `GET`    | `/api/subs/{id}` | 获取单个订阅（含内容）          |
| `POST`   | `/api/subs`      | 新建订阅                        |
| `PUT`    | `/api/subs/{id}` | 更新订阅                        |
| `DELETE` | `/api/subs/{id}` | 删除订阅                        |

登录请求体：

```json
{ "password": "your-password" }
```

新建 / 更新成功响应保留 `ok` 和 `id`，并在 `sub` 中返回服务端保存的元数据（含规范化字段、时间、大小、SHA-256，不含 `content`）。完整内容仍通过详情接口读取。

订阅请求体示例：

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
- 公开订阅默认缓存 1 小时，提供 `ETag` / `Last-Modified`，支持 `If-None-Match` 协商缓存（304）；响应带 `Vary: User-Agent`（爬虫拦截按 UA 判断，边缘缓存仍由 Cloudflare 缓存键决定，拦截为尽力而为）
- 公开订阅按 User-Agent 拦截爬虫/扫描器，放行常见订阅客户端
- 管理端 API 会校验同源（`Origin` / `Sec-Fetch-Site`）与 JSON Content-Type，防止 CSRF
- 登录失败按 IP 限流：默认 15 分钟内最多 20 次失败，超出返回 `429`；可用 `LOGIN_MAX_ATTEMPTS`（设为 `0` 关闭）和 `LOGIN_WINDOW_SECONDS` 调整
- 会话 Cookie 使用 HMAC-SHA256 签名（密钥由访问密码派生），`HttpOnly` + `SameSite=Strict`，生产环境自动加 `Secure`
- 访问密码至少 8 位，未配置或过短时登录接口返回 `503`
- 输入数据会进行安全校验与清洗，React 默认转义输出，配合 CSP 防止 XSS
- 前端和 API 共用字段校验；无效地区 / 域名限制会明确报错，不会静默变为公开访问
- JSON 请求按实际流入的 UTF-8 字节计数（默认 26 MB，登录 4 KB），不能通过省略或伪造 `Content-Length` 绕过限制
- 前端产物位于 `/assets/*`，文件名带内容哈希并设置一年 immutable 缓存；HTML 页面始终 `no-store`
- 订阅 ID 需以字母或数字开头，仅含字母、数字、点、下划线、连字符，且不能使用保留字
- 订阅名称会自动移除 HTML 标签
- 单个订阅内容上限 24MB（KV 单值上限 25MB）
- 兼容旧数据：历史 `{ name, content, regions }` 记录会在读取时转换为统一结构，编辑保存后写入新格式
