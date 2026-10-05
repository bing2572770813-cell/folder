# 编辑器 UI 组件

保持原生 HTML/JavaScript，不引入框架。editor-tabs.mjs 将既有控件搬入四个面板，保留节点身份、事件绑定和字段状态，不重建控件或修改地图。

Tab 使用单一可聚焦按钮、方向键及 Home/End 导航，aria-selected 与面板 hidden 同步。父面板隐藏子控件但不重置 details 的展开状态。dispose 清理导航监听器。

组件仅协调 DOM；地图校验、编辑历史和玩家逻辑不写入此目录。虚空检视等工具行为通过调用方接入。
