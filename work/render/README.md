# 渲染几何适配

paper-surface.mjs 保留现有纸张平坦中心、边缘过渡、共享角点、隐藏邻格与法线挤出厚度算法。根 paper-surface.mjs 转发此模块以兼容旧入口。

目录整理不改变 Three.js 预览效果、折线渲染或游玩侧栏。修改纸张几何需运行 node work/test-paper-surface.mjs 并完成相关视觉回归；新算法先确认。
