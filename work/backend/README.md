# TypeScript 后端

后端服务使用 Fastify + TypeScript，编译输出位于 `backend/dist/`。浏览器端编辑器和玩家逻辑仍由 `app.js`、`player.cjs` 负责；后端不执行 Three.js 或玩家状态机。

## 命令

```powershell
npm --prefix work run backend:build
npm --prefix work run backend:test
npm --prefix work run build
npm --prefix work start
```

默认服务地址为 `http://127.0.0.1:4173`，可用 `FOLD_PORT` 设置端口。`GET /api/prefabs` 每次请求重新读取 `assets/prefab`，返回实体、标签和逐文件错误列表。

`work/server.cjs`、`work/prefab-catalog.cjs` 和写入 CLI 是兼容入口，内部转发到编译后的 TypeScript 模块。修改 `src/` 后需要重新运行 `backend:build`。
