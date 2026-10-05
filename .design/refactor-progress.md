# 编辑器重构进度与验证

已实施：core/entities/tags/editor/ui/render/resources 模块边界、选区与配置历史、四 Tab、虚空与实体检视、嵌套属性 Inspector、受控覆盖行为、BaseEntity 附着校验、entity/tag 目录兼容、EventBus、序列化投影及独立调试状态。标签权限与实体权限取交集；虚空折线同样遵守导出权限。前端不回写 prefab。

构建及全部 20 个测试套件通过。浏览器验证四 Tab、方向键/End 导航、编辑/游玩往返、虚空检视、地图名保存、实例高度修改与撤销、独立 HTML 启动。截图见 outputs/editor-tabs-verification.png、outputs/void-inspector-verification.png、outputs/property-inspector-verification.png。

保持原生 UI、Three.js、玩家逻辑集中于 player.cjs、纸张连接/厚度/过渡比例和现有覆盖规则。新叠层仍需确认；新脚本需注册。通用调试覆盖目前由 Inspector 消费，行为扩展需显式接入。app.js 保留场景/DOM 适配。未运行窄屏、200% 缩放或屏幕阅读器验收。

未纳入用户已有的 player_token_ai.json 修改和 paper_render.md。
