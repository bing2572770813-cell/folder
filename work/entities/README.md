# 实体对象适配

实体数据、占格放置、显示分类与机制纯规则分别位于 tile-model.mjs、placement-model.mjs、visibility-model.mjs、mechanism-rules.mjs。根目录同名旧模块仅转发，保留已有测试和外部调用兼容；新代码使用本目录。机制规则仍由 player.cjs 协调，不在实体模块另建玩家状态机。

cell-entity.mjs 将现有地图格读取为独立检视对象。VoidEntity 完全透明、blocked、placeable=false，具有坐标和虚空折线标记；toJSON 返回 null，兼容 version:1 的空格表示，折线仍由 map.foldCells 保存。

inspectCell 先检查范围与隐藏状态，实体属性以独立副本返回，不能通过检视对象反向修改地图。TreeDocument 保留唯一 canonical EntityWorld，旧格子仅为独立投影视图。tree-commands 提供受保护节点移动、重挂载、删除、组件配置和显式叠加；tree-clipboard 保存完整子树与稀疏占格，粘贴生成独立 ID，区域始终取目标格且不复制唯一起点/入口。行为与组件均通过受控注册表验证。

验证：node work/test-cell-entity.mjs。玩家状态机仍位于 work/player.cjs。

升降组件必须属于单格纸张本体，不能作为独立叠加实体。同格最多一个纸张，因此最多一个升降控制来源。version:2 的 components 是升降配置的唯一来源，configuration.lift 只同步组件快照；删除组件时同时移除快照，导入不得从快照恢复已删除能力。version:1 的旧配置仍由兼容转换提升为组件。

批量钥匙改名由 tree-commands.renameTreeKeys 读取选中格中的全部 key 组件，包括独立叠加钥匙。只有地图中不再存在可收集的旧名钥匙时才更新出口引用；每个钥匙和出口拥有者均检查隐藏及属性权限，整次操作原子提交。

升降方块放置工具中的高度表示 initialHeight，叠层放置不能被 prefab 的重复 lift 默认值覆盖。升降实体检视不提供无效的 surface.height/gradualRate 编辑入口；视口在编辑时报告初始高度，游玩时报告 runtime 当前高度和单程回合数。

高级 JSON 可删除完整的可编辑组件对象，删除递归检查对象内所有字段权限；不能通过删除父对象绕过隐藏或只读子字段。

旧 version:2 中只有 configuration.lift 且仍含 durationMs 的快照允许一次兼容提升；转换后移除 durationMs。新回合配置快照没有独立恢复组件的权限。

纸面连接由 surface.connected 能力控制，兼容视图使用 surfaceConnected，权限双向同步。缺省时可通行的普通纸面连接相邻纸面，阻挡、地形及静态 token 默认保持独立；升降平台始终独立。自定义 prefab 名称不改变表面连接能力。

behaviors.mjs 将受控 scriptId、parameters 和 state JSON 恢复为行为对象。当前注册 replace-cell，保持现有覆盖规则；其 placement 返回 replace 操作。新增策略必须先确认语义并在程序注册，不通过 prefab 路径导入代码。BaseEntity 为实体 prefab ID 列表，void_ai 表示透明虚空；显式空列表不允许任何基底，旧定义省略此字段时兼容现有覆盖规则。placeEntity 在所有占格写入前校验基底与行为结果，失败不修改地图。

节点 JSON 编辑遵循 readable/tempEditable/serializable 权限：不可见字段保留，禁止改写只读字段，非持久字段不进入 canonical 地图。子树方向相加，不旋转坐标偏移。

node-permissions.mjs 双向合并 legacy 字段和 canonical 组件的权限，任一来源禁止即禁止；保存同时过滤两份表示。tree-commands 的全格验证也用于树粘贴，纯标签节点仍检查标量冲突与唯一入口。旧高度/区域编辑保留非投影代表的组合组件。

升降纸张的回合推进与占据约束集中在 `player.cjs`，`lift-runtime.mjs` 仅提供兼容导出。`lift.turnsPerLeg` 是走完最低到最高高度的单程回合数（1–100，默认 3）；每次成功行走或传送推进一段，失败动作和空闲帧不推进。玩家占据时只下降，到最低后保持；离开后恢复往返。旧地图的 `durationMs` 导入为默认 3 回合，保存时移除旧字段。编辑投影使用 `lift.initialHeight`，游玩渲染显式读取 runtime 高度，撤销恢复高度和方向，重开恢复初始高度。方块本体是厚度不变的独立网格，升降图案附着其上，两者一起移动，不与相邻纸面形成渐变坡面。回合变化更新方块、边线和地形标记的位置，不重建地图或清除玩家选择。移动动画端点也读取平台当前高度。

placeCategorizedPrefab 是编辑器统一放置入口：根据 static.entityType 与 BaseEntity 原子检查，地形清空占格后替换，道具保留支持实体并去除兼容 tile 的 surface。拒绝隐藏占格、多格覆盖和间接越界删除；区域固定格数据及标签/折线保留。旧 replaceTreePrefab/placeTreePrefab 仅供旧数据与受控树工具兼容。

placement-preview.mjs 为悬停构造局部文档，包含完整子实体足迹、相关祖先/删除后代、引用和唯一标签拥有者，复用 placeCategorizedPrefab 的正式规则，不复制整张地图。调用者须提供包含隐藏节点的 spawn/entry 占格上下文；上下文随文档更新。预览投影只复制受影响行，源地图保持不变。专项一致性测试已接入默认测试入口。

在 work 中运行 `node bench-placement-preview.mjs` 可比较正式候选构造与局部预览的数据逻辑成本。该比较不代表优化前后或浏览器整体延迟；正式提交、历史与场景重建仍有全量工作，需要另行测量。

TreeDocument.serialize 直接从起点标签拥有者的实际占格派生唯一 spawn，不构造完整显示投影。没有唯一标签格时保留元数据后备值；持久化权限过滤前读取 canonical 标签，避免过滤改变起点派生语义。

编辑器 commitTree 复用变化比较时的旧文档快照作为历史输入，不重复序列化；历史仍使用独立副本。提交过程中不提前刷新 UI，最终由场景更新刷新一次；无变化不写历史、不重建、不通知保存。

节点隐藏检查和统一放置的删除集合通过 Transform 占格索引读取，包含同一 Transform 的全部实体拥有者。有效 footprint 至少有一格，因此可从首个实际占格读取拥有者；区域隐藏检查仍遍历完整实际占格。候选的全局组件、叠层和唯一标签校验保持执行。
