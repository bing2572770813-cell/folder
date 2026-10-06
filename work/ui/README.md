# React 编辑器 UI

前端采用 React 19 + Mantine 9，保留 Three.js 和 JavaScript 游戏逻辑。入口 react-entry.jsx 先同步挂载 EditorShell，再启动 app.js 场景适配；player.cjs 仍集中承载玩家状态与交互。

## 组件边界

react/ 包含 EditorLayout、TopBar、Sidebar、EditorPanel、MapTools、BlockEntities、SelectionClipboard、InspectorPanel、MapProperties、DisplayLayers、PlayPanel、Viewport、StatusBar。controls.jsx 使用 Mantine 按钮、输入框、checkbox、原生选择器、Paper/Box；EditorPanel 使用 Mantine Tabs。PropertyInspector.jsx、catalogs.jsx 管理动态属性、实体预览、实体/区域/钥匙 checklist 与机制说明。

Tab 使用 keepMountedMode="display-none"，保证所有 ID 在初始化时存在，切换不重挂载、丢失选区或折叠状态。Tab 选择通过 fold:editor-tab 通知游戏适配。宽线选区、方块实体/颜色/轮廓参数层级、标签缩略图、折纸方向条件显示保留。

## React 与地图适配

React 创建界面结构并管理 Tab 与动态列表/Inspector 的状态。Three.js canvas 只挂在 Viewport 的稳定宿主中。app.js 暂保留固定 ID 的事件/状态适配以及下拉摘要、地图状态和显示标记更新；不因此将游戏状态复制进 React。静态结构组件 memo 化，不在地图刷新时重建。动态宿主只能由对应 React renderer 写入，清空 Inspector 使用 clearPropertyInspector，禁止在其 React root 上 replaceChildren。

静态放置参数为非受控输入，由适配层验证并提交。Inspector 使用 React 本地草稿，失焦或 Enter 提交，checkbox 立即提交；错误保留输入，权限和批量事务仍由原数据模块检查。

## 样式与构建

MantineProvider 的主题保留纸白/墨绿配色、字号及圆角。Mantine CSS 在现有界面 CSS 之前嵌入，react-editor.css 只处理适配。editor.html 是文档/CSS 外壳，布局唯一来源为 JSX。build.cjs 服务端生成静态预览结构，并将 React、组件库、Three.js、代码和 CSS 内嵌进 outputs/index.html/game.html；没有 CDN 或运行时 UI 构建服务。

Node.js 仍只承担资源服务和构建。执行 npm --prefix work ci、npm --prefix work run build、npm --prefix work test。不要提交 node_modules 新依赖目录；package-lock.json 固定依赖。
