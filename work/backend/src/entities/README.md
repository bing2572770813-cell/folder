# Transform 实体基础

产品范围依据 `docs/entity-transform-tree-product-design.md`。纯模型已接入生产编辑器、玩家、渲染和保存边界；实际 FR 证据见产品进度表。

每个 tile 最多一个 surface 纸张表面，可以叠加其他实体。terrain 是 campfire、ice、fire、eruption 地形，必须在每个实际占格都有纸张承载，同格最多一个地形实体，同一实体也不能同时包含多种地形。key 是收集物，不属于 terrain，可以与地形共存。规则依据 TransformManager 实际占格而非父子关系，隐藏/透明不豁免，掩码空洞不提供承载。旧实体内联地形同样计数；旧版带纸面的地形/钥匙 prefab 叠加到已有纸张时复用承载面，不再创建第二张纸。

导入、导出、组合 prefab 放置、移动、重挂载、组件编辑与粘贴共用校验；违规操作拒绝且保留源文档。移动或删除纸张也不能留下悬空地形。保持世界位置的重挂载不改变叠加关系；同一多格纸张不同格子可分别放地形。

`TransformManager` 是空间引用的唯一管理入口。`create`、`setLocal`、`setParent` 在候选状态校验全部父引用、循环和实际占格，成功后提交并通知；失败不修改状态或索引。读取返回独立副本。`at` 返回同一世界格全部 Transform ID，不增加 layer 或 CellStack。

`retain`/`release` 记录实体等外部引用；默认删除拒绝有子节点或外部引用的 Transform。`serialize` 仅输出 ID、parentId、local 和 footprint，临时格索引、监听器和引用表不持久化。加载实体时应重新注册外部引用。

当前局部位置按网格平移合成，dir 按八方向叠加，不旋转子节点偏移或占格，保持现有方向规则。`setParent(id,parentId,true)` 保持世界位置，默认保留局部位置。

变更事件为 `transformChanged`，监听器异常由 `notificationErrors` 返回，不使已提交操作回滚或阻断其他监听器。取消函数支持重复调用。

验证：`npm --prefix work run backend:test`；生产编辑器与玩家边界的验收记录见产品进度表。

`PrefabRegistry` 提供 JSON 模板继承：递归对象合并、数组替换、缺失父模板和循环拒绝。`instantiate` 从调用方接收实体 ID 与 Transform ID，生成独立配置快照并深冻结静态标记；实例运行时状态不写入 prefab 或实体配置。磁盘目录、API 和编辑器已支持继承及组合子模板；配置编辑和保存遵循 readable、tempEditable、serializable 权限。

`EntityWorld` 管理实体身份、标签配置与隔离的组件运行时状态。空间查询委托 TransformManager；实体注册会 retain Transform 引用，实体移除会 release。删除实体及其 Transform 时若空间删除失败会恢复引用，实体配置不变。序列化不含运行时状态。

`snapshotRuntime` / `restoreRuntime` 为游玩历史提供独立组件状态快照，恢复先校验完整输入再替换状态。Transform 的 `referenceOwners` 返回副本，`assertRemovable` 提供不释放引用的删除预检，供编辑事务保留外部引用保护。

`legacyMapToTree` 提供旧地图转换：每个剩余实体格保留自己的表面、通行、地形和标签配置，同一旧实例的格使用父子引用组合；孔洞不产生节点。虚空折线生成透明不可通行节点。地图名称、起点、出口等旧元数据保存为独立配置。

`ComponentRegistry` 注册受控组件处理器，分发 enter/leave/interact。事件先检查全部组件和进入限制，再返回独立的 actor/runtime/messages 结果；不在处理器中计步、切换区域或提交玩家状态。static.events 限制效果订阅，不禁用碰撞预检；static.walkable=false 阻止进入。

旧地图火焰导入保留显式配置的 damage（含 0），仅缺省时使用 1。

所有实体节点共用标签类型校验，包含无 surface 节点：spawn/entry 为布尔值，exitTo 为非空区域名，requiredKeys 为非空钥匙名列表（可为空列表），名称上限 80 字。导入、配置、放置与粘贴均拒绝非法标签；粘贴在清除起点/入口前先校验源标签。regionTag 只能属于地图格，标量冲突与唯一标签约束保持现有树命令合同。

旧工具在无表面格删除部分折线方向时，更新每个 fold 拥有者，保留各自剩余方向、身份和其他组件；新增方向由首个拥有者接收。

磁盘目录读取与保存使用 EntityWorld 相同的 static 字段校验，并校验继承后的实际字段：render/transparent/walkable/placeable 必须为布尔值，events 为 enter/leave/interact 数组。非法文件按来源路径报告错误，保存失败不会写入文件；未知 static 字段继续保留。

events 数组元素必须是事件名字符串；嵌套数组、对象或数字不能通过字符串转换被接受。

旧 tile 的完整配置（包括自定义 properties 和 propertySchema）在转换后保存在实体 configuration 快照中，避免首次迁移丢失字段。组件配置是新交互接口，configuration 的编辑映射和 serializable 权限过滤已接入生产保存，legacy/canonical 重复字段双向桥接并同时过滤。

`importTreeMap` / `serializeTreeMap` 提供 version:1 转换和 version:2 配置往返，恢复时由 TransformManager / EntityWorld 校验引用和循环。只保存实体配置、局部 Transform 和地图元数据，不保存运行时状态、监听器或临时索引。

持久化调用可传入 `projectProperties` 和 `schemaFor(node)`，复用核心模块的嵌套 serializable 权限，并同时过滤 configuration 及旧字段在组件、标签中的副本。默认无投影的序列化用于完整编辑历史；组件运行时状态始终独立。

区域归属已由用户明确为方格属性。`TreeMap.cellTags["r,c"].regionTag` 保存该格区域；同格实体共享区域，移动 Transform 不移动方格区域。旧 tile 转换时从实体配置移出 regionTag，保存在 cellTags，实体 tags 只保留实体附着标记。

浏览器使用 `work/entities/tree-runtime.mjs` 导出同一份 TS 纯模型。构建插件支持 TS 与 NodeNext 的 .js→.ts 源码解析，并拒绝 Node 内置模块进入浏览器包。后端 tests/browser-models.test.mjs 使用实际构建插件打包并执行纯模型。

`TreeDocument` 为 app.js 的地图配置来源；tiles 是供现有纸张渲染和编辑工具使用的独立兼容投影。编辑以原子事务提交树，保留同格节点、身份、父子引用、运行时和外部引用。导入支持 v1/v2，localStorage、JSON 和独立 HTML 导出保存 v2；编辑撤销/重做使用完整树快照。复制粘贴保存完整实体子树、同格叠加和稀疏占格，生成独立身份，源区域不复制。

`player.cjs` 通过 getEntityWorld 查询同格节点并协调 enter/leave/interact，保留原计步、动画、折纸、邻近篝火与区域规则。游玩历史独立保存组件运行时，撤销恢复，重启清空；钥匙门槛检查同格所有节点。实体选择、层级编辑、重挂载、受保护删除和同格渲染/拾取均已接入编辑器。


磁盘 prefab 目录支持带 tile 的旧定义和仅有 components 的原生定义，继承合并组件、静态属性与 children；API、浏览器 palette 和树放置使用同一归一化结果。原生节点没有显式 surface/collision 时不生成这两个组件。起点兼容坐标从真实 spawn 标签派生；编辑器 requiredKeys 和玩家验证使用全节点可收集钥匙集合。树命令与粘贴均校验无表面节点的标量标签冲突，旧高度/区域编辑保留混合组件。

FR-01–14 的产品实现和验收证据见 docs/superpowers/plans/2026-10-06-transform-product-progress.md。方向沿父链叠加，不旋转子节点偏移或 footprint；regionTag 固定属于 tile。
