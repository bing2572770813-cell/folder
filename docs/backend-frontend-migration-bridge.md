# 后端迁移与前端改动桥接文档

编写日期：2026-10-07。依据当前工作区代码核对，供后续开发者接续迁移使用。本文区分已落地实现与建议后续工作；主线程正在继续开发，交接时应重新检查 `git status` 和最新提交。

## 1. 当前迁移结论

项目已经采用 **TypeScript + Fastify**，不需要重新选择框架或另建一套后端。迁移方式是保留旧入口，让入口委托给新实现，同时让浏览器复用不依赖 Node 的 TypeScript 领域模型。

当前 HTTP 服务负责静态页面和 prefab 目录。地图编辑、玩家行动、回合结算在浏览器内运行。目录名 `backend/src/entities` 中的模型也被浏览器打包使用，不能把该目录整体理解为服务器独占代码。

| 模块 | 当前实现 | 迁移状态 |
| --- | --- | --- |
| HTTP 服务 | `work/backend/src/app.ts`、`server.ts` | 已使用 Fastify + TS |
| 配置与静态文件 | `config.ts`、`routes/static-files.ts` | 已迁移 |
| prefab API 与磁盘目录 | `routes/prefabs.ts`、`resources/catalog.ts` | 已迁移；归一化仍调用已有 `.mjs` 模块 |
| Transform、实体与组件 | `work/backend/src/entities/*.ts` | 已建立共享 TS 模型 |
| 后端启动兼容入口 | `work/server.cjs` | 保留，调用编译后的 TS 服务 |
| prefab 兼容入口 | `work/prefab-catalog.cjs`、`work/resources/prefab-catalog.cjs` | 保留，桥接到 TS 目录实现 |
| 地图编辑适配 | `work/entities/tree-document.mjs`、`tree-commands.mjs` | 仍为 JS；使用共享 TS 模型 |
| 玩家与回合引擎 | `work/player.cjs` | 仍为 CommonJS；已接入回合管理器 |
| 前端应用与界面 | `work/app.js`、`work/ui/react/*.jsx` | JS + React/Mantine |
| 渲染 | `work/render/*.mjs` | Three.js；通过适配接口读取实体与运行时 |

旧文档 `docs/typescript-fastify-migration.md` 是初期方案。其 `work/server.ts` 目标路径、`tsx` 开发方式，以及“尚待建立 TransformManager”的阶段说明不能作为当前实现现状。当前后端用 `tsc` 编译，前端用 esbuild 打包，未配置 `tsx` 启动脚本。

## 2. 目录与依赖边界

```text
work/
  server.cjs                     # 兼容启动入口
  backend/
    tsconfig.json                # strict、NodeNext、ES2022
    src/
      app.ts / server.ts / config.ts
      routes/                    # Fastify 路由，仅 Node 使用
      resources/catalog.ts       # 磁盘 IO，仅 Node 使用
      entities/                  # 浏览器与服务端共用的纯模型
    dist/                        # tsc 生成，不能作为修改源文件
    test/                        # 后端和共享模型测试
  entities/
    tree-runtime.mjs             # 浏览器导出共享 TS 模型
    tree-document.mjs            # 规范实体树 → 旧 tiles 视图
    tree-commands.mjs            # 编辑事务与兼容属性更新
  player.cjs                     # 玩家状态机、交互、回合生命周期
  app.js                         # UI/渲染/编辑器适配与事件绑定
  ui/react/                      # React/Mantine 界面
  render/                        # Three.js 表现
  build.cjs / build-support.cjs   # 构建与 TS 源码解析桥接
outputs/
  index.html / game.html          # 构建产物
assets/prefab/                   # prefab 数据来源
```

主要数据通路：

```text
磁盘 prefab → TS catalog → GET /api/prefabs → 前端目录与放置工具
地图 v1/v2 → importTreeMap → TreeDocument / EntityWorld / TransformManager
规范实体树 → tiles 兼容视图 → 现有 UI 与 Three.js 渲染
玩家动作 → player.cjs TurnManager → ComponentRegistry → 运行时与表现
规范实体树 → serializeTreeMap → localStorage / JSON / 独立 HTML 导出
```

浏览器通过 `work/entities/tree-runtime.mjs` 引用 TS 源码；Node 兼容入口使用 `backend/dist`。新增共享逻辑应放在纯模型或纯工具中，不得引入 `node:fs`、Fastify、DOM 或 Three.js。实际浏览器打包测试见 `work/backend/test/browser-models.test.mjs`。

## 3. 必须保持的数据与行为合同

### 地图、空间和配置

- 导入接受 version:1 与 version:2；当前保存使用 version:2 的实体、Transform、固定格标签和元数据。
- `TransformManager` 是空间坐标、父子引用与占格索引的唯一管理者。前端不得维护第二套空间树。
- `EntityWorld` 管理实体配置及独立运行时。运行时、监听器和临时索引不写入地图或 prefab。
- `TreeDocument` 是编辑器规范数据来源；`tiles` 是兼容视图。直接改投影而不更新实体树，会在重建或保存时丢失改动。
- `regionTag` 属于固定 tile，保存在 `cellTags["r,c"]`。同格实体共享区域；移动实体不带走区域。同名区域无需空间连通。
- 每个纸张只占一个 tile；同格最多一个纸张 surface。地形必须由纸张承载，同格最多一个地形；钥匙属于收集物，可与地形共存。
- 导入旧多格纸张时按实际占格拆分；新纸张不再创建多格实例。非纸张实体仍可拥有多格 footprint。
- 权限须在数据层检查：readable、tempEditable、serializable 及嵌套字段权限继续生效。隐藏控件不能代替权限校验。

相关源文件：`entity-model.ts`、`transform-manager.ts`、`entity-world.ts`、`tree-serialization.ts`、`paper-tiles.ts`、`terrain-stacking.ts`。

### HTTP 合同

`GET /api/prefabs` 返回：

```ts
type CatalogResult = {
  prefabs: unknown[];
  tags: unknown[];
  errors: Array<{ file: string; message: string }>;
};
```

保持 `Cache-Control: no-store`。非法单个 prefab 文件进入 `errors`，其他合法项仍可返回；目录读取整体失败返回 HTTP 400 与 `{ error: string }`，已注册的非 GET 方法返回 405。前端保留构建时嵌入目录，并在运行时刷新 `/api/prefabs`；当前编辑模式约每 2 秒刷新一次，独立游戏不启用该周期刷新。

当前没有远程地图编辑、玩家行动或回合结算 API。若后续需要服务端保存或权威模拟，应单独定义请求、版本与运行时快照合同，不应把现有同步模型调用直接替换为 `fetch`。

### 回合与实体事件合同

所有玩家状态机与交互逻辑必须保留在 `work/player.cjs`，这是仓库明确约束。后端 TS 组件负责纯校验和效果计算，不负责计步、动画或区域切换。

- `Trigger.Walk = 'walk'`，`Trigger.Teleport = 'teleport'`；一次实体事件只能携带一个触发原因。
- `enter`、`leave`、`interact` 是事件阶段，独立于 trigger。初始化和原地交互可以不带到达原因。
- `ComponentRegistry.checkEntry` 只做组件校验与进入限制；实际到达使用 `dispatch` 提交返回的 actor/runtime/messages。
- 回合顺序为 `validate → snapshot → leave → action → enter → settle → outcome → present → complete`。
- 行走到区域出口以 `walk` 到达出口，再以 `teleport` 到达目标入口；属于同一回合，只推进一次周期和升降机制。
- `turnsPerLeg` 控制升降每单程的回合数；旧 `durationMs` 导入为默认 3 回合并移除。等待与动画帧不推进升降。
- 无效行动不计回合；处理中或动画未完成时拒绝新行动。逻辑结算失败回滚快照，表现完成标识防止旧动画回调结束新回合。
- 撤销恢复玩家、回合、揭示区域和实体运行时；重开与模式切换重置回合。

## 4. 前端已经配合完成的改动

| 改动 | 入口 | 后续迁移时需保持 |
| --- | --- | --- |
| 共享 TS 模型桥接 | `entities/tree-runtime.mjs` | 模型只保留一份；浏览器包不包含 Node IO |
| 实体树作为地图来源 | `tree-document.mjs`、`app.js` | v1 导入转换、v2 保存、tiles 投影与运行时隔离 |
| 原子编辑与复制粘贴 | `tree-commands.mjs`、`tree-clipboard.mjs` | 失败不部分写入；保留身份和叠加；粘贴创建独立身份 |
| 点击上下文实体树 | `ui/entity-tree-context.mjs`、`TreeInspector.jsx` | 显示被点击实体的相关层级与同格关系，避免全图实体列表 |
| 配置、权限与调试适配 | 属性检视器、`node-edit-permissions.mjs` | 配置变化与临时运行时变化分开，隐藏/只读限制继续生效 |
| terrain 与纸张表现关联 | `render/tree-render.mjs`、`app.js` | 地形替换或移除后重建对应表现，不遗留旧标记 |
| 升降方块整体运动 | `render/lift-block.mjs`、`refreshLiftSurfaces` | 方块本体与附属贴图同步移动，渲染不推进回合 |
| 行走/传送统一入口 | `player.cjs` | `movePlayer`、`teleport`、`testTeleport` 委托 TurnManager |
| 动画与终局 UI 分离 | `app.js` 的 `updateUI` | 结算时确定胜负；`!P.moving` 时展示结果面板 |
| 回合诊断 | `foldField.getState()`、视口 `dataset.state` | 返回回合信息的副本，供验证使用 |
| 旧 DOM 兼容 | `ui/react` | 保留事件绑定所需 ID；Tab 切换保持面板挂载 |
| 独立 HTML 导出 | `build.cjs` 与前端导出适配 | 页面保留运行所需模型、目录与地图，不强制依赖在线服务 |

只迁移后端语言时，前端不需要整体改为 TypeScript。先保持这些适配点的外部接口，再逐模块替换实现。

## 5. 后续迁移步骤与最小提交单位

### A. 补齐混合语言边界类型

优先处理 `resources/catalog.ts` 对 `entities/tile-model.mjs`、`tags/tag-model.mjs` 的动态导入。当前使用局部模块类型与 `@ts-expect-error` 跨过缺失声明边界。

先为实际公开接口补声明，或把对应纯归一化模块迁到共享 TS；保留原 `.mjs` 再导出入口。声明必须匹配真实字段及异常规则，不能仅把所有值改成 `any`。每次迁移一个可独立验证的模块，与其兼容测试一起提交。

### B. 加强目录与 API 类型

在不改变 JSON 结构的前提下，将 `CatalogResult` 中的 `unknown[]` 收窄为已验证的 prefab/tag 输出类型。保留单文件错误隔离、继承解析与静态字段校验；前端目录刷新应继续处理 `prefabs/tags/errors`。

### C. 逐步迁移编辑器纯适配模块

如需继续提高前端类型覆盖，先迁移 `TreeDocument`、树命令等纯模块。保留旧导出名称，避免同时重写 UI 和数据模型。每个提交验证投影、编辑事务、保存往返、同格叠加、隐藏与权限规则。

### D. 整理兼容入口

确认所有调用方，包括构建脚本、测试、导出和 Node 启动，已经使用新入口后，才删除不再需要的 wrapper。仍有调用方的 `server.cjs` 和 prefab wrapper 可以长期保留；不必为了扩展名统一而破坏运行入口。

`player.cjs` 继续承担玩家逻辑。若未来要将该文件迁移为 TS，须先明确变更仓库的文件位置约束，再设计兼容入口；本次桥接文档不改变该约束。

### E. 同步构建与文档

当前后端路径固定为 `backend/src → backend/dist`。共享 TS 源文件依赖 NodeNext `.js` 导入解析，浏览器构建由 `build-support.cjs` 桥接到 `.ts`。迁移目录或模块格式时必须同时调整两条构建通路。

每个可运行功能经过检查后单独 commit，相关文档放在同一个提交。更新前端或共享模型后重新生成 `outputs/index.html`、`outputs/game.html`，不要手改 HTML bundle。用户要求 push 时再推送。

## 6. 运行与验收

在仓库根目录运行：

```powershell
# 首次准备依赖（执行前核对项目锁文件与本地环境）
npm --prefix work ci

# 后端编译与测试
npm --prefix work run backend:build
npm --prefix work run backend:test

# 生成编辑器/独立游戏，再运行前端验证
npm --prefix work run build
npm --prefix work test

# 启动服务；默认 4173，需要时通过环境变量改端口
$env:FOLD_PORT = '4198'
npm --prefix work start
```

上述为接续开发时应执行的命令，本文编写过程未重新运行测试、安装依赖或重启服务。

最低验收范围：

1. API：目录结构、错误隔离、405、缓存头和静态路径边界保持一致。
2. 数据：v1 导入、v2 往返、固定格区域、纸张拆分与叠加校验通过。
3. 编辑：树选择、重挂载、删除、粘贴、撤销/重做和权限限制无回归。
4. 游玩：行走与传送触发可区分，预览不执行到达效果，区域传送只结算一回合。
5. 生命周期：忙碌输入拒绝、失败回滚、终局时序、撤销/重开和旧动画标识失效通过。
6. 表现：升降本体与贴图同步、地形移除无残留，结果面板在动画后出现。
7. 构建：实际浏览器包不带 Node 模块，编辑器和独立 HTML 均能启动。

优先参考测试：`backend/test/api.test.mjs`、`browser-models.test.mjs`、`component-trigger.test.mjs`、`turn-manager.test.mjs`、`player-tree.test.mjs`，以及 `work/test-player.mjs` 和 `work/test-runner.cjs`。若测试文件名称发生变化，按当前文件清单定位对应测试。

## 7. 接续工作快速定位

- 架构及当前规则：`work/GAME_MECHANICS.md`、`work/backend/src/entities/README.md`。
- 产品约束：`docs/entity-transform-tree-product-design.md`。
- 初期迁移背景：`docs/typescript-fastify-migration.md`。
- HTTP 配置与服务：`work/backend/src/config.ts`、`app.ts`、`server.ts`。
- 地图格式迁移：`work/backend/src/entities/tree-serialization.ts`、`legacy-map.ts`、`paper-tiles.ts`。
- 前后端共享入口：`work/entities/tree-runtime.mjs`。
- 前端适配与界面时序：`work/app.js`。
- 回合及所有玩家交互：`work/player.cjs`。

交接时以实际文件、最新提交和测试输出为准。本文只新增迁移说明，不执行后端迁移、不修改前端实现、不提交或推送主线程正在进行的代码。

## 8. 2026-10-07：physical-fold 合入 main 的实现

本节记录实际桥接结果，前述第 7 节末尾的“只新增说明”仅描述原文编写时的工作，不代表本次合并范围。

- 基线：main 的 04778bb 与 codex/physical-fold 的 c057575。保留 Fastify/TS 服务、TransformManager、EntityWorld、固定格区域、纸张单格迁移与 version:2 序列化；不恢复旧 tiles 作为主数据。
- 纸张几何继续接受共享模型投影和 surfaceConnected 能力；升降实体保持独立本体及贴图，刷新高度时同步折痕提示与选中勾线。保留厚度、过渡比例与隐藏邻格规则。
- 接入物理属性 Tab、桌面、折痕虚线、立即选中高亮和源/目标区域勾线、player prefab 默认值及 9×9 边界约束跟随镜头。保留 main 的受控 React modifier、实体树检视与挂载稳定性。
- 物理折叠掉落通过 player.cjs 的 TurnManager.execute，以 fold/teleport 原因结算一次。dropFrom 只作为单次表现输入；不写入地图或 prefab。钥匙、升降、终局、动画完成、失败回滚及撤销沿用同一回合合同，折叠拖拽期间拒绝其他动作。
- 延续已确认的出口规则：目标区域没有入口时，只累计揭示区域，不传送、不产生第二次到达；钥匙门槛继续生效。
- 新增 player-tree 测试覆盖物理掉落的单次回合、teleport 触发、钥匙及升降运行时恢复、失败回滚和无入口揭示。旧四方向实际几何折叠测试仍保留。
- 构建产物由 build.cjs 重建；后端、共享模型和前端测试均需通过，另检查实际浏览器编辑/游玩和独立 HTML。
