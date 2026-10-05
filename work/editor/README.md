# 编辑器逻辑模块

此目录存放与 DOM、Three.js 及玩家状态机无关的编辑器操作。

`selection-model.mjs` 负责矩形/稀疏选区、剪贴板和原子粘贴。地图输入采用现有 version:1 合同，仍保留虚空折线、多格实例身份、目标标签合并和隐藏保护。返回新地图的操作不得修改源地图或剪贴板。

兼容入口 `../editor-model.mjs` 转发本模块；新增调用使用目录内模块。现有回归入口为 `node work/test-editor-model.mjs`，完整验证使用 `npm --prefix work test`。

后续工具、Inspector、图层及历史协调在职责明确后迁入此目录；虚空拾取和叠层规则仍须按 architecture.md 先确认，不由本模块猜测。玩家逻辑继续位于 `../player.cjs`。

`history-model.mjs` 提供编辑快照隔离与历史裁剪，保留地图、选区和虚空折线的独立副本。上限仍为 150 条和约 100000 格预算，保留至少一个撤销点。DOM 刷新和手势提交仍由现有适配层协调，玩家历史不迁入此目录。回归入口为 `node work/test-editor-history.mjs`。
