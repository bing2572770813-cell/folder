# Transform 实体基础

产品范围依据 `docs/entity-transform-tree-product-design.md`。当前实现仅为第一单元，尚未接入编辑器或玩家。

`TransformManager` 是空间引用的唯一管理入口。`create`、`setLocal`、`setParent` 在候选状态校验全部父引用、循环和实际占格，成功后提交并通知；失败不修改状态或索引。读取返回独立副本。`at` 返回同一世界格全部 Transform ID，不增加 layer 或 CellStack。

`retain`/`release` 记录实体等外部引用；默认删除拒绝有子节点或外部引用的 Transform。`serialize` 仅输出 ID、parentId、local 和 footprint，临时格索引、监听器和引用表不持久化。加载实体时应重新注册外部引用。

当前局部位置按网格平移合成，dir 按八方向叠加，不旋转子节点偏移或占格；空间旋转语义仍待用户决定。`setParent(id,parentId,true)` 保持世界位置，默认保留局部位置。

变更事件为 `transformChanged`，监听器异常由 `notificationErrors` 返回，不使已提交操作回滚或阻断其他监听器。取消函数支持重复调用。

验证：`npm --prefix work run backend:test`。后续仍需实体、组件、prefab 继承、地图转换、浏览器适配和 player.cjs 交互接入。
