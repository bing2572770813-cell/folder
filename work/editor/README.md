# 编辑器逻辑模块

此目录存放与 DOM、Three.js 及玩家状态机无关的编辑器操作。

`selection-model.mjs` 负责矩形/稀疏选区、剪贴板和原子粘贴。地图输入采用现有 version:1 合同，仍保留虚空折线、多格实例身份、目标标签合并和隐藏保护。返回新地图的操作不得修改源地图或剪贴板。

兼容入口 `../editor-model.mjs` 转发本模块；新增调用使用目录内模块。现有回归入口为 `node work/test-editor-model.mjs`，完整验证使用 `npm --prefix work test`。

后续工具、Inspector、图层及历史协调在职责明确后迁入此目录；虚空拾取和叠层规则仍须按 architecture.md 先确认，不由本模块猜测。玩家逻辑继续位于 `../player.cjs`。

`history-model.mjs` 提供编辑快照隔离与历史裁剪，保留地图、选区和虚空折线的独立副本。上限仍为 150 条和约 100000 格预算，保留至少一个撤销点。DOM 刷新和手势提交仍由现有适配层协调，玩家历史不迁入此目录。回归入口为 `node work/test-editor-history.mjs`。

visibility-policy.mjs 检查隐藏折线/标签是否被粘贴等批量结果改写；实体删除将折线转为虚空但位置/方向不变时仍允许。标签工具与折线工具还执行独立可见性和 BaseEntity 校验。

debug-state.mjs 将非序列化字段修改保存在独立覆盖表，不进入地图配置或编辑历史。键包含坐标、prefab ID 与实例 ID；导入/新建、进出游玩和重启时清空。可序列化字段通过地图事务写入，保持原编辑撤销。当前通用调试覆盖呈现在 Inspector，扩展行为要通过此覆盖接口读取调试参数，不能直接污染定义。

旧 Inspector 与树节点 JSON 表单共用 primary node.configuration 的有效权限；原生 components 与兼容属性的限制取交集。批量属性的 readable/tempEditable 对每个目标均须满足，事务在全部目标校验通过后提交，拒绝不得增加历史。

单击选区按 canonical world.at 判断实体占用，独立 key 等无 surface 节点仍可选择和复制。真正虚空与独立虚空折线保持原有选区规则。

`node-edit-permissions.mjs` 将旧 Inspector 的 tags/folds 权限与所有实际贡献节点取交集。属性工具提交前检查 canonical 候选中每个已有节点的 components、tags 和自定义 configuration，包含跨格唯一标签清除、区域改名出口重写及钥匙引用更新；全部验证通过后才记录历史。普通放置、删除、粘贴的结构操作仍走各自校验。

兼容适配器仅修改投影中实际变化的 native component 字段；仅改固定区域时不会补齐稀疏 `surface:{}` 的默认高度或 collision。只读高度仍拒绝实际高度修改。
