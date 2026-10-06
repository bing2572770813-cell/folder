# 实体对象适配

实体数据、占格放置、显示分类与机制纯规则分别位于 tile-model.mjs、placement-model.mjs、visibility-model.mjs、mechanism-rules.mjs。根目录同名旧模块仅转发，保留已有测试和外部调用兼容；新代码使用本目录。机制规则仍由 player.cjs 协调，不在实体模块另建玩家状态机。

cell-entity.mjs 将现有地图格读取为独立检视对象。VoidEntity 完全透明、blocked、placeable=false，具有坐标和虚空折线标记；toJSON 返回 null，兼容 version:1 的空格表示，折线仍由 map.foldCells 保存。

inspectCell 先检查范围与隐藏状态，实体属性以独立副本返回，不能通过检视对象反向修改地图。TreeDocument 保留唯一 canonical EntityWorld，旧格子仅为独立投影视图。tree-commands 提供受保护节点移动、重挂载、删除、组件配置和显式叠加；tree-clipboard 保存完整子树与稀疏占格，粘贴生成独立 ID，区域始终取目标格且不复制唯一起点/入口。行为与组件均通过受控注册表验证。

验证：node work/test-cell-entity.mjs。玩家状态机仍位于 work/player.cjs。

升降组件必须属于单格纸张本体，不能作为独立叠加实体。同格最多一个纸张，因此最多一个升降控制来源。version:2 的 components 是升降配置的唯一来源，configuration.lift 只同步组件快照；删除组件时同时移除快照，导入不得从快照恢复已删除能力。version:1 的旧配置仍由兼容转换提升为组件。

behaviors.mjs 将受控 scriptId、parameters 和 state JSON 恢复为行为对象。当前注册 replace-cell，保持现有覆盖规则；其 placement 返回 replace 操作。新增策略必须先确认语义并在程序注册，不通过 prefab 路径导入代码。BaseEntity 为实体 prefab ID 列表，void_ai 表示透明虚空；显式空列表不允许任何基底，旧定义省略此字段时兼容现有覆盖规则。placeEntity 在所有占格写入前校验基底与行为结果，失败不修改地图。

节点 JSON 编辑遵循 readable/tempEditable/serializable 权限：不可见字段保留，禁止改写只读字段，非持久字段不进入 canonical 地图。子树方向相加，不旋转坐标偏移。

node-permissions.mjs 双向合并 legacy 字段和 canonical 组件的权限，任一来源禁止即禁止；保存同时过滤两份表示。tree-commands 的全格验证也用于树粘贴，纯标签节点仍检查标量冲突与唯一入口。旧高度/区域编辑保留非投影代表的组合组件。

升降纸张的回合推进与占据约束集中在 `player.cjs`，`lift-runtime.mjs` 仅提供兼容导出。`lift.turnsPerLeg` 是走完最低到最高高度的单程回合数（1–100，默认 3）；每次成功行走或传送推进一段，失败动作和空闲帧不推进。玩家占据时只下降，到最低后保持；离开后恢复往返。旧地图的 `durationMs` 导入为默认 3 回合，保存时移除旧字段。编辑投影使用 `lift.initialHeight`，游玩渲染显式读取 runtime 高度，撤销恢复高度和方向，重开恢复初始高度。方块本体是厚度不变的独立网格，升降图案附着其上，两者一起移动，不与相邻纸面形成渐变坡面。回合变化更新方块、边线和地形标记的位置，不重建地图或清除玩家选择。移动动画端点也读取平台当前高度。
