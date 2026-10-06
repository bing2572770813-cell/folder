# React 编辑器迁移

用户明确要求 React、组件库支持和现有结构迁移。采用 React 19.3 / Mantine 9.7，主题延续原界面；未更改地图、区域、折线、玩家、纸张规则。依赖已锁定；新增 node_modules 目录不提交。

原 HTML 布局迁入 ui/react 的具名 JSX 组件；editor.html 仅保留 CSS/文档外壳。Tabs、动态实体与图层 checklist、嵌套属性 Inspector、机制说明由 React 管理。Three.js 与 app.js 保持场景/地图兼容适配，固定 ID 和静态 DOM 状态更新仍存在，并未宣称全部游戏状态都改为 React state。

构建与 22 个测试套件通过。新增测试覆盖 React/Mantine 静态壳、唯一 ID、ARIA 关联、隐藏面板预挂载、参数层级、混合值和只读权限。特别使用 keepMountedMode=display-none，避免 Mantine Activity 延迟创建初始化所需的字段。

真实浏览器验证：Tab 点击和方向键导航、End 聚焦后 Space 激活、高度修改与撤销、实体切换/无颜色隐藏、参数折叠、折纸方向、实体图层全选/全部取消、编辑/游玩往返。640px 与 320px 视口的页面 scrollWidth 与 clientWidth 一致；未进行屏幕阅读器及 200% 浏览器缩放验收，不能据此声称完整可访问性。

内嵌游戏及浏览器实际导出的 game.html 均加载为 play，canvas 存在，日志无启动 error。临时验证页关闭并删除；用户下载保留。截图：outputs/react-editor-verification.png。构建约 1.51 MB，React/组件库全部内嵌，无 CDN。
