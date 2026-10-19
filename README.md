# 订阅管理器

基于 Cloudflare Workers 的私有订阅管理器，用于托管和分发 Clash、sing-box 等代理订阅。

管理端使用 React 19 + shadcn/ui（Base UI、Tailwind CSS 4），Vite 构建，Worker 托管，数据存储在 Cloudflare KV。单用户、单密码，仅包含登录、列表和编辑。

## 功能

- 订阅搜索、筛选、排序、分页、复制、编辑和删除
- YAML / JSON 在线编辑，支持导入、下载、格式化和 `⌘/Ctrl + S`
- 未保存提醒、保存后离开、撤销和删除确认
- 按国家/地区或请求域名限制访问
- 自定义 `Content-Type`、文件名和 `Subscription-Userinfo`
- `ETag` / `If-None-Match` 304 缓存
- 密码登录、签名会话、登录限流和爬虫拦截
- 管理界面统一使用 `/`，公开订阅使用 `/{id}`

## 快速开始

需要 Bun 1.4+ 和 Cloudflare 账号。

```bash
bun install
bunx wrangler kv namespace create SUB   # 将 id 填入 wrangler.toml
```

本地在 `.dev.vars` 中设置密码：

```dotenv
PASSWORD="your-local-password"
```

```bash
bun run dev   # 本地 http://localhost:8787
```

生产首次部署：

```bash
bunx wrangler secret put PASSWORD
bun run deploy
```

密码至少 8 位；修改密码会使现有会话失效。

## 使用

登录后可在列表中搜索、筛选、排序和复制链接。新建或编辑时：

- 必填：订阅 ID、名称、内容
- 可选：`Content-Type`、文件名、地区限制、域名限制、`Subscription-Userinfo`
- ID 仅限字母、数字、`.`、`_`、`-`，必须以字母或数字开头
- 内容支持 YAML / JSON，最大 24 MB
- 同时设置地区和域名限制时，两者都需匹配

保存后公开链接为 `https://<域名>/{id}`。未保存离开时会提示；保存后继续留在编辑器，返回列表保留搜索和滚动位置。

## 配置

可选变量（`wrangler.toml` 的 `[vars]`）：`LOGIN_MAX_ATTEMPTS`（默认 `20`，`0` 关闭限流）、`LOGIN_WINDOW_SECONDS`（默认 `900` 秒）。自定义域名在 `[[routes]]` 中配置。

## 开发

```bash
bun run dev:ui   # 监听前端构建，另开终端运行 bunx wrangler dev
bun run build    # 构建前端
bun run test     # 运行测试
bun run format   # 格式化代码
bun run check    # 测试、格式、构建与部署预检
```

新增 shadcn/ui 组件：`bunx --bun shadcn@latest add @shadcn/<component>`。

## API

管理接口需要登录：

| 方法     | 路径             | 说明                 |
| -------- | ---------------- | -------------------- |
| `GET`    | `/api/session`   | 查询登录状态         |
| `POST`   | `/api/login`     | 登录                 |
| `POST`   | `/api/logout`    | 退出登录             |
| `GET`    | `/api/subs`      | 订阅列表（不含内容） |
| `GET`    | `/api/subs/{id}` | 获取订阅（含内容）   |
| `POST`   | `/api/subs`      | 新建订阅             |
| `PUT`    | `/api/subs/{id}` | 更新订阅             |
| `DELETE` | `/api/subs/{id}` | 删除订阅             |

登录请求体为 `{ "password": "..." }`；订阅字段与编辑器一致。

公开接口：`GET /{id}`、`GET /_health`、`GET /robots.txt`。

## 项目结构

```text
src/           Worker 入口、路由与接口
frontend/src/  React 管理界面
shared/        前后端共享校验与数据规则
tests/         回归测试
dist/          Vite 构建产物（生成，不提交）
```

## 安全与限制

- 密码至少 8 位，未配置或过短时登录返回 `503`；登录失败默认 15 分钟内 20 次后返回 `429`。
- 管理 API 校验同源与 JSON `Content-Type`；会话 Cookie 使用 HMAC-SHA256 签名，`HttpOnly` + `SameSite=Strict`，生产环境添加 `Secure`。
- 公开订阅未通过地区或域名限制时返回 `403`；设置地区限制的订阅不缓存。
- 公开订阅默认缓存 1 小时，支持 `ETag` / `Last-Modified` 304；爬虫拦截按 User-Agent 进行，属于尽力而为的防护。
- 请求体上限 26 MB，单个订阅内容 24 MB；名称会移除 HTML 标签，全站禁止搜索引擎收录。
