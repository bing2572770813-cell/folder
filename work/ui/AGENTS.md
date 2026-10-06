# UI 组件规则

- 所有编辑器结构写入 React JSX，组件库使用 Mantine。保留兼容 DOM ID 和稳定宿主，避免重复绑定或丢失事件。
- 动态 React root 禁止外部 replaceChildren/textContent；通过 renderer 更新或清空。Three.js 和玩家状态不放进 React 表单状态。
- Tab 保留所有面板挂载，不能使用会延迟创建 ID 或卸载事件目标的默认模式。
- Tab 必须提供正确标签关系、方向键/Home/End、可见焦点和单一 Tab 停靠点。
- 父级隐藏不得重置子级折叠状态，不修改游玩侧栏或 Three.js 渲染。
- 属性显示资格与编辑资格分别处理；隐藏控件不能替代数据层校验。
- 变更控件后运行构建与 DOM/集成测试，并通过浏览器验证点击、键盘、模式往返。
- 图标选择优先复用 SingleSelect_icons/MultiSelect_icons，通过 props 与插槽组合业务组件；父组件不得依赖实体、标签或图层规则。方块实体与方块标签共用单选样式，实体与显示区域共用多选下拉样式。
