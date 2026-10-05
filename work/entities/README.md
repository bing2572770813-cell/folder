# 实体对象适配

cell-entity.mjs 将现有地图格读取为独立检视对象。VoidEntity 完全透明、blocked、placeable=false，具有坐标和虚空折线标记；toJSON 返回 null，兼容 version:1 的空格表示，折线仍由 map.foldCells 保存。

inspectCell 先检查范围与隐藏状态，实体属性以独立副本返回，不能通过检视对象反向修改地图。行为注册、BaseEntity 和 tag prefab 将作为后续模块实现，当前适配不引入新叠层规则。

验证：node work/test-cell-entity.mjs。玩家状态机仍位于 work/player.cjs。

behaviors.mjs 将受控 scriptId、parameters 和 state JSON 恢复为行为对象。当前注册 replace-cell，保持现有覆盖规则；其 placement 返回 replace 操作。新增策略必须先确认语义并在程序注册，不通过 prefab 路径导入代码。BaseEntity 为实体 prefab ID 列表，void_ai 表示透明虚空；显式空列表不允许任何基底，旧定义省略此字段时兼容现有覆盖规则。placeEntity 在所有占格写入前校验基底与行为结果，失败不修改地图。
