# TypeScript 后端

后端服务使用 Fastify + TypeScript，编译输出位于 `backend/dist/`。浏览器端编辑器和玩家逻辑仍由 `app.ts`、`player.cjs` 负责；后端不执行 Three.js 或玩家状态机。

## 模块边界

- `config.ts`：从环境变量和目录根生成配置。
- `app.ts`：组装 Fastify 与路由，可通过 `inject` 测试，不监听端口。
- `server.ts`：`startServer` 监听端口并返回可关闭的服务；`runServer` 作为两个可执行入口共用的启动函数，打印地址并注册退出信号。
- `routes/`：HTTP 协议适配，不负责 prefab 规范化或继承。
- `resources/catalog.ts`：磁盘目录读取、继承解析、逐文件错误隔离与禁止覆盖的写入。
- `resources/static-files.ts`：静态文件读取。路由负责 URL、根目录范围及 MIME；应用可注入读取器验证不同 IO 结果。
- `resources/shared-normalizers.ts`：唯一的旧 ESM 规范化适配入口。输入输出经过运行时 JSON 校验，目录返回明确的 `CatalogDefinition[]`，包含 `version`、`id`、`name`，其余字段为可扩展 JSON。
- `entities/`：浏览器与后端共用的纯实体、Transform、组件和序列化模型；不依赖 Fastify、文件系统或 Three.js。

依赖方向为路由 → 资源服务 → 实体模型；实体模型不反向依赖服务。ESM 适配是当前迁移边界，仍复用已有规范化规则。

## 命令

```powershell
npm --prefix work run backend:build
npm --prefix work run backend:test
npm --prefix work run build
npm --prefix work start
```

默认服务地址为 `http://127.0.0.1:4173`，可用 `FOLD_PORT` 设置端口。`GET /api/prefabs` 每次请求重新读取 `assets/prefab`，返回实体、标签和逐文件错误列表。

目录整体读取失败返回 JSON 500；单个定义损坏仍返回 200，并放入 `errors`。目录接口不支持的请求方法返回 405 和 `Allow: GET`。静态文件不存在或目标为目录返回 404，非法 URL 编码返回 400，超出根目录返回 403，其他文件读取故障返回 JSON 500。

`work/server.cjs`、`work/prefab-catalog.cjs` 和写入 CLI 是兼容入口，内部转发到编译后的 TypeScript 模块。修改 `src/` 后需要重新运行 `backend:build`。

`createApp` 与 `startServer` 不修改进程信号监听器。可执行入口通过 `runServer` 安装 `SIGINT`/`SIGTERM` 处理，重复信号只关闭一次；显式关闭服务或关闭失败时移除监听器。关闭失败报告错误并设置非零退出码。
