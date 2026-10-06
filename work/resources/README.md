# 资源目录服务

`backend/src/resources/catalog.ts` 是实体/标签磁盘目录与写入的规范入口；`prefab-catalog.cjs` 和根同名文件仅转发。公开 CLI `work/write-prefab.cjs` 和 `work/write-tag-prefab.cjs` 保持兼容。

只读接口返回 prefabs、tags、errors；单文件错误隔离，新写入拒绝重复 ID，实体加载兼容根目录旧文件。前端不写定义。校验模块修改后重启本项目服务，不能关闭其他 Node 进程。

验证：node work/test-prefab-catalog.cjs 和 node work/test-tag-prefab.mjs。

后端服务使用 Fastify + TypeScript。运行 `npm --prefix work run backend:build` 编译资源适配器；运行 `npm --prefix work run backend:test` 验证 API、静态文件、目录热读取和旧入口兼容性。

实体 JSON 可声明 `extends` 引用其他实体 ID。目录先扫描全部定义，再解析继承，因此文件名顺序不影响父引用。普通对象递归合并，数组替换，循环和缺失父定义按文件报告错误；组件配置通过受控注册表校验。API 和构建内置目录输出独立合并快照，程序写入继承定义时保留 extends，热读取时重新解析。components/static 经共享归一化保留，尚需接入实体放置和新树运行时。
