 # 后续架构收敛实施计划

 > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

 **Goal:** 在保持 v2 地图格式和现有游戏行为的前提下，逐步收敛前端、编辑器、实体规则、回合模拟和渲染边界。

 **Architecture:** TreeDocument / EntityWorld 是地图事实来源，网格视图只是编辑器投影；player.cjs 独占玩家状态机和回合生命周期；app.ts 只负责组合 UI、编辑器命令、渲染和运行时接线。

 **Tech Stack:** TypeScript、ESM、Fastify、React/Mantine、Three.js、esbuild、Node test runner。

 **Spec:** work/agent.md、docs/backend-frontend-migration-bridge.md、docs/entity-transform-tree-product-design.md。

 ## Global Constraints

 - 地图持久化只接受 version 2 树结构，不新增旧地图转换路径。
 - 玩家状态机和交互逻辑只能放在 work/player.cjs。
 - TreeDocument / EntityWorld 是实体、Transform、cell tag 的唯一事实来源。
 - 预览、正式放置、运行时校验复用同一领域规则。
 - terrain 是格子上的承载实体；钥匙等道具不当作 terrain。
 - 纸张方块可以跨多个格子，但同一格不能叠多个纸张方块。
 - 每阶段完成后运行适用检查并提交；未经用户要求不推送远端。
 - 不为历史数据保留没有实际消费者的兼容分支；不合规范的数据直接拒绝。

 ## 已完成基线

 - app.js 已迁移为 app.ts。
 - 旧地图转换器、旧纸张迁移器及旧格式测试已删除。
 - 未使用的 react-entry.jsx 和旧声明文件已删除。
 - 编辑器写回已从 applyLegacy 改为 applyProjection。
 - 最新清理提交：551113a。

 ## 阶段 1：前端组合层类型边界

 **目标：** 移除 work/app.ts 的文件级 @ts-nocheck。

 - [ ] 按持久化地图、运行时、界面、调试四类盘点顶层状态。
 - [ ] 为共享数据补充最小类型，优先复用后端类型。
 - [ ] 集中固定 DOM 查询，缺失元素报告具体 ID。
 - [ ] 为 mjs/cjs 导入建立窄桥接声明。
 - [ ] 按初始化、编辑命令、运行模式、渲染循环分段移除 ts-nocheck。
 - [ ] 运行 frontend 检查和完整检查。
 - [ ] 提交：refactor: type editor composition boundary。

 **验收：** app.ts 不再依赖文件级 ts-nocheck。

 ## 阶段 2：编辑器命令与投影

 **目标：** 网格编辑、树编辑、预览和撤销全部经过明确命令入口。

 - [ ] 确认预览和正式放置共用 placement-model 规则。
 - [ ] 将投影写回的尺寸、隐藏区域、Transform 引用和多格校验集中到命令层。
 - [ ] app.ts 只提交命令结果，不直接拼接实体事实。
 - [ ] 增加失败操作源文档不变的回归测试。
 - [ ] 验证撤销、重做、复制粘贴、缩放和保存加载。
 - [ ] 提交：refactor: centralize editor projection commands。

 ## 阶段 3：实体叠加与 terrain 承载

 **目标：** 统一纸张、terrain、道具、标签和 BaseEntity 的叠加约束。

 - [ ] 定义每格最多一个 paper surface owner；多格纸张仍由一个 Transform 表示。
 - [ ] 定义 terrain 必须有承载实体，替换只影响目标承载及合法附着实体。
 - [ ] 明确 item、terrain、tag、void、player-token 的组合关系。
 - [ ] 让预览、树命令和运行时加载共用检查。
 - [ ] 为纸张、terrain、钥匙、标签、多格实体增加正例和拒绝例。
 - [ ] 提交：feat: centralize entity stacking contracts。

 ## 阶段 4：地图和资源命名清理

 **目标：** 删除误导性的旧命名，保留仍有效的资源定义字段。

- [x] v2 地图元数据字段统一为 metadata，不保留旧字段别名或转换逻辑。
- [x] 区分资源定义合同与地图格式兼容；现行 prefab schema 合同继续保留。
- [x] 更新活跃源码、测试夹具、示例地图和 README。
- [x] 完整检查通过，覆盖导入、导出、保存和 HTML 构建。
 - [ ] 提交：refactor: remove obsolete map compatibility naming。

 ## 阶段 5：回合生命周期和动作引擎

 **目标：** 移动、传送、交互和升降方块都通过回合生命周期推进。

 - [ ] 明确互斥动作枚举：move、teleport、interact、restart。
 - [ ] 明确空闲、失败、动画中、暂停是否推进回合；失败动作不得推进。
 - [ ] 升降方块按单程回合数逐段推进，不使用墙钟 duration 决定规则。
 - [ ] 将动作快照、撤销快照和胜负结算绑定到回合提交点。
 - [ ] 验证帧率和动画速度变化不改变结果。
 - [ ] 提交：feat: formalize turn lifecycle。

 ## 阶段 6：编辑器视口一致性

 **目标：** 预览、实体层级、terrain 贴图和可操作范围与实际数据一致。

 - [ ] 选中实体时只显示相关树、附着关系和属性。
 - [ ] 预览显示最终占格、承载关系、terrain 贴图和隐藏限制。
 - [ ] terrain 更改或删除同步刷新贴图、实体树和拾取。
 - [ ] 多格纸张显示单一根节点并标出覆盖格。
 - [ ] 相机拖拽、编辑点击、悬停预览走独立路径。
 - [ ] 运行 browser:check 并查看截图。
 - [ ] 提交：fix: align editor viewport with entity state。

 ## 阶段 7：渲染和编辑性能

 **目标：** 只刷新实际变化范围，避免相机操作重建实体。

 - [ ] 记录同一地图和操作的帧率、主线程耗时基线。
 - [ ] 相机变化只执行 camera pass。
 - [ ] 编辑命令返回受影响格子，渲染按区域增量刷新。
 - [ ] 合并同一 pointer gesture 内的重复通知。
 - [ ] 明确 batch、贴图、实体树缓存的依赖和失效。
 - [ ] 用相同场景重复测量并保存数据。
 - [ ] 提交：perf: reduce editor redraw scope。

 ## 阶段 8：删除过渡桥接

 **目标：** 在模块稳定后删除不再需要的桥接、临时类型和重复适配。

 - [ ] 根据实际消费者删除空桥接声明和重复导出。
 - [ ] 长期维护的领域模块只在有收益时迁移 TypeScript。
 - [ ] 删除未被构建、测试或运行时引用的文件。
 - [ ] 更新 README、迁移文档和 agent.md。
 - [ ] 提交：refactor: remove completed migration scaffolding。

 ## 阶段 9：最终回归和版本收敛

 **目标：** 建立可继续开发的稳定基线。

 - [ ] 用合成 v2 地图覆盖空地图、单格纸张、多格纸张、terrain、道具、传送、移动、升降和隐藏区域。
 - [ ] 验证保存加载、HTML 导出、撤销重做、复制粘贴和运行重启。
 - [ ] 验证非法 v1 地图直接拒绝且当前文档不变。
 - [ ] 运行 npm --prefix work run check。
 - [ ] 运行 npm --prefix work run browser:check。
 - [ ] 检查 git diff --check、暂存差异和生成产物。
 - [ ] 提交最终回归修复；只有用户明确要求时推送。

 ## 阶段依赖

 阶段 1 → 阶段 2 → 阶段 3 → 阶段 4 → 阶段 5 → 阶段 6 → 阶段 7 → 阶段 8 → 阶段 9。

 阶段 5 可在阶段 3 完成后设计，但实现前必须先完成阶段 1、2 的契约。阶段 6 依赖阶段 2、3；阶段 7 依赖阶段 6 的增量刷新接口；阶段 8 必须最后执行。

 ## 每阶段固定检查

 ```
 npm --prefix work run check
 git diff --check
 git diff --cached --check
 git status --short
 ```

