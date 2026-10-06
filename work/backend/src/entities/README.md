# Transform 实体基础

产品范围依据 `docs/entity-transform-tree-product-design.md`。当前实现仅为第一单元，尚未接入编辑器或玩家。

`TransformManager` 是空间引用的唯一管理入口。`create`、`setLocal`、`setParent` 在候选状态校验全部父引用、循环和实际占格，成功后提交并通知；失败不修改状态或索引。读取返回独立副本。`at` 返回同一世界格全部 Transform ID，不增加 layer 或 CellStack。

`retain`/`release` 记录实体等外部引用；默认删除拒绝有子节点或外部引用的 Transform。`serialize` 仅输出 ID、parentId、local 和 footprint，临时格索引、监听器和引用表不持久化。加载实体时应重新注册外部引用。

当前局部位置按网格平移合成，dir 按八方向叠加，不旋转子节点偏移或占格；空间旋转语义仍待用户决定。`setParent(id,parentId,true)` 保持世界位置，默认保留局部位置。

变更事件为 `transformChanged`，监听器异常由 `notificationErrors` 返回，不使已提交操作回滚或阻断其他监听器。取消函数支持重复调用。

验证：`npm --prefix work run backend:test`。后续仍需实体、组件、prefab 继承、地图转换、浏览器适配和 player.cjs 交互接入。

`PrefabRegistry` 已提供 JSON 模板继承：递归对象合并、数组替换、缺失父模板和循环拒绝。`instantiate` 从调用方接收实体 ID 与 Transform ID，生成独立配置快照并深冻结静态标记；实例运行时状态不写入 prefab 或实体配置。此模块暂未接入磁盘目录或编辑器，组合子模板和字段编辑权限仍需后续接入。

`EntityWorld` 管理实体身份、标签配置与隔离的组件运行时状态。空间查询委托 TransformManager；实体注册会 retain Transform 引用，实体移除会 release。删除实体及其 Transform 时若空间删除失败会恢复引用，实体配置不变。序列化不含运行时状态。

`legacyMapToTree` 提供尚未接入导入 UI 的旧地图转换：每个剩余实体格保留自己的表面、通行、地形和标签配置，同一旧实例的格使用父子引用组合；孔洞不产生节点。虚空折线生成透明不可通行节点。地图名称、起点、出口等旧元数据保存为独立配置。当前只是迁移基础，完整字段权限、复制粘贴、导出往返和 UI 还需接入，不能把此转换器视为生产导入路径已完成。

`ComponentRegistry` 注册受控组件处理器，分发 enter/leave/interact。事件先检查全部组件和进入限制，再返回独立的 actor/runtime/messages 结果；不在处理器中计步、切换区域或提交玩家状态。碰撞、火焰、冰、喷发和钥匙已有基本效果；邻近篝火解冻、完整标签触发和 player.cjs 协调仍需接入。

旧 tile 的完整配置（包括自定义 properties 和 propertySchema）在转换后保存在实体 configuration 快照中，避免首次迁移丢失字段。组件配置是新交互接口，configuration 的编辑映射和序列化权限过滤仍需完成，暂不用于生产保存。

`importTreeMap` / `serializeTreeMap` 提供 version:1 转换和 version:2 基础配置往返，恢复时由 TransformManager / EntityWorld 校验引用和循环。只保存实体配置、局部 Transform 和地图元数据，不保存运行时状态、监听器或临时索引。当前 version:2 是内部迁移合同，未切换编辑器导入/导出 UI；生产输出的 serializable 权限过滤尚未接入。
