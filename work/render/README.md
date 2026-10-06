# 渲染几何适配
`fold-motion.mjs` 仅拆分和临时变换可见网格；折痕所在实体沿轴切分三角面，玩家挂在旋转组上。作用范围、落点检测、释放与回弹状态机统一位于 `player.cjs`，不得写入静态地图。`lighting.mjs` 管理会话级光照调试与阴影相机范围。

paper-surface.mjs 保留现有纸张平坦中心、边缘过渡、共享角点、隐藏邻格与法线挤出厚度算法。根 paper-surface.mjs 转发此模块以兼容旧入口。

目录整理不改变 Three.js 预览效果、折线渲染或游玩侧栏。修改纸张几何需运行 node work/test-paper-surface.mjs 并完成相关视觉回归；新算法先确认。
