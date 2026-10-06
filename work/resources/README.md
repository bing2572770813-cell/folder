# 资源目录服务

`backend/src/resources/catalog.ts` 是实体/标签磁盘目录与写入的规范入口；`prefab-catalog.cjs` 和根同名文件仅转发。公开 CLI `work/write-prefab.cjs` 和 `work/write-tag-prefab.cjs` 保持兼容。

只读接口返回 prefabs、tags、errors；单文件错误隔离，新写入拒绝重复 ID，实体加载兼容根目录旧文件。前端不写定义。校验模块修改后重启本项目服务，不能关闭其他 Node 进程。

验证：node work/test-prefab-catalog.cjs 和 node work/test-tag-prefab.mjs。

后端服务使用 Fastify + TypeScript。运行 `npm --prefix work run backend:build` 编译资源适配器；运行 `npm --prefix work run backend:test` 验证 API、静态文件、目录热读取和旧入口兼容性。
