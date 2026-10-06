# TypeScript 后端迁移设计

日期：2026-10-06

状态：已实施

实施提交：`a703e31`、`2a82d76`、`a960228`、`03dd0a8`、`62375f6`、`b088ab5`

## 1. 目标与范围

将当前 Node.js 后端服务迁移到 TypeScript 与 Fastify，同时保持浏览器端运行方式、地图格式和现有接口行为稳定。

本次迁移包含：

- 静态文件服务；
- `/api/prefabs` 资源目录接口；
- 实体和标签 prefab 的读取、校验、重复 ID 检查与程序写入；
- 现有 prefab/tag 写入 CLI 的 TypeScript 实现；
- 构建脚本所需的后端目录读取适配。

本次迁移不包含：

- `work/app.js` 的 TypeScript 化；
- `work/player.cjs` 的迁移或拆分；
- Three.js 渲染逻辑迁移；
- 地图玩法规则改动；
- 引入数据库、账号系统或远程部署平台。

## 2. 现状边界

当前 `work/server.cjs` 使用 Node 原生 HTTP 服务静态输出 `outputs/`，并提供只读的 `/api/prefabs`。`work/resources/prefab-catalog.cjs` 负责磁盘目录扫描、实体/标签归一化、错误隔离和程序写入。构建脚本 `work/build.cjs` 在构建阶段直接读取目录，并将目录内容注入独立 HTML。

地图校验、玩家状态机和编辑器逻辑属于浏览器端及共享规则模块，不应因为后端迁移而转移到 Fastify。尤其是所有玩家状态机和玩家交互逻辑继续集中在 `work/player.cjs`。

## 3. 技术方案

新增 TypeScript 后端目录，建议结构如下：

```text
work/backend/
  src/
    app.ts              # Fastify 实例和插件注册
    server.ts           # 本地启动入口
    config.ts           # 端口、输出目录、资源目录
    routes/
      prefabs.ts        # GET /api/prefabs
      static-files.ts   # outputs 静态文件
    resources/
      prefab-catalog.ts # 目录读取、校验、写入适配
    errors.ts           # 对外错误映射
  tsconfig.json
```

第一阶段可以继续复用现有 `.mjs` 规则模块，通过 TypeScript 边界适配调用；不复制一套实体校验规则。后续若要迁移共享规则，应单独设计 ESM/TypeScript 兼容层和测试切片。

Fastify 负责请求生命周期、路由注册和错误处理；资源目录模块负责文件系统及 prefab 业务；构建脚本仍直接调用资源目录模块，不通过 HTTP 请求自身服务。

## 4. 接口兼容

`GET /api/prefabs` 保持返回现有目录对象结构：实体 prefab、标签 prefab 和逐文件错误列表。响应继续使用 UTF-8 JSON 与 `Cache-Control: no-store`。

非 GET 请求继续返回 405。目录读取失败继续返回 400 级 JSON 错误。单个坏文件或重复 ID 只进入 `errors`，不能阻止其他合法定义加载。

静态文件服务继续限制在 `outputs/` 根目录内，必须拒绝路径穿越；根路径继续返回 `index.html`，不存在文件返回 404。

## 5. 兼容入口与迁移顺序

迁移分为可独立回滚的最小单元：

1. 增加 TypeScript 编译、运行和测试配置，不改变现有入口。
2. 实现 Fastify app 工厂和接口契约测试。
3. 将现有服务启动入口切换到 TypeScript server，并保留旧启动命令兼容适配。
4. 将资源目录读取和写入 CLI 迁移到 TypeScript，保留 `prefab-catalog.cjs`、`write-prefab.cjs`、`write-tag-prefab.cjs` 的兼容入口。
5. 将构建脚本改为调用新的资源目录适配层。
6. 删除旧实现前，完成全量测试、构建、独立 HTML 访问和热读取验证。

每一步都必须保持已有未提交资源定义不被覆盖，也不能把 `docs/`、`outputs/special-tile-requirements.md` 或 `work/theme.mjs` 等既有工作区文件纳入迁移提交。

## 6. 错误与生命周期

Fastify 只负责将已知错误转换为 HTTP 响应；资源模块继续区分目录级失败和单文件失败。启动时验证输出目录和资源目录，运行期间每次 API 请求重新读取目录，以保留当前热刷新行为。

服务关闭时关闭 Fastify 实例，不增加常驻文件监听器。构建过程仍是一次性读取，不依赖服务进程。

## 7. 测试与验收

新增测试覆盖：

- `/api/prefabs` 的正常响应、405、目录错误和逐文件错误隔离；
- 静态文件根路径、404 和路径穿越拒绝；
- 端口配置和服务启动/关闭；
- TypeScript 资源目录适配与旧入口行为一致；
- 写入 CLI 的重复 ID、坏定义和禁止覆盖；
- 资源热读取；
- 构建产物无外部脚本依赖。

迁移完成前必须通过：

```powershell
npm --prefix work test
npm --prefix work run build
```

并验证 `outputs/index.html`、`outputs/game.html`、prefab API 和示范关卡行为。

## 8. 暂不决定的事项

- 是否将整个 `work/` 统一迁移为 TypeScript；
- 是否把地图校验和编辑器共享规则迁入后端包；
- 是否采用 monorepo 或独立 `backend/` 根目录；
- 是否为生产部署增加日志、鉴权、限流和持久化存储。

这些事项不影响第一阶段的本地服务迁移，不能提前引入。
