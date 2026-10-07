# 渲染几何适配
`spatial-batches.mjs` 将普通纸张和地形实例按 16×16 格分块，各块独立计算包围球，由 Three.js 的视锥裁剪决定提交范围。曲面纸张按颜色和同样的空间分块合并缓冲区，保留生成的全部顶点、外壳和三角形所属格。相机变化不重写实例矩阵或几何；折叠拆分与射线拾取沿用原机制。网格和勾线仍使用已有批次，尚未空间分块。
`tag-markers.mjs` 将区域入口和出口按两种共享贴图生成 InstancedMesh，实例保留 cell/nodeId 供拾取使用；升降通过实例矩阵更新高度，不生成新贴图。共享贴图不随单次地图重建销毁。
`fold-motion.mjs` 仅拆分和临时变换可见网格；折痕所在实体沿轴切分三角面，玩家挂在旋转组上。作用范围、落点检测、释放与回弹状态机统一位于 `player.cjs`，不得写入静态地图。`lighting.mjs` 管理会话级光照调试与阴影相机范围。

paper-surface.mjs 保留现有纸张平坦中心、边缘过渡、共享角点、隐藏邻格与法线挤出厚度算法。根 paper-surface.mjs 转发此模块以兼容旧入口。

crease-guides.mjs 生成贴合折痕凹槽的"点线交替"虚线提示：纸张格按变形后的表面法线抬升采样，虚空与其他实体回落到 voidPlane 平面；可用地图工具的"折痕虚线"开关隐藏，折叠动画随纸张一起旋转。

table-scene.mjs 将 Blender 建模的桌游桌以内联几何载入场景（独立 HTML 不依赖外部文件）：桌面顶面对齐当前地图最低纸张底面，桌面始终参与折叠碰撞，关闭桌子只隐藏外观。

目录整理不改变 Three.js 预览效果、折线渲染或游玩侧栏。修改纸张几何需运行 node work/test-paper-surface.mjs 并完成相关视觉回归；新算法先确认。

空闲 pointermove 通过 `core/frame-task.mjs` 合并为每帧一次；拖拽编辑和玩家折纸手势保持即时处理。相机交互开始时取消待执行的悬停与预览，结束后重新计算最后位置。调度器不持有地图、实体或 Three.js 对象。

渲染循环默认不写 `viewport.dataset.frames/render/points`。浏览器性能检查需要这些数据时先调用 `window.foldField.enableDiagnostics(true)`，关闭时调用 `enableDiagnostics(false)`；相机手势期间仍暂停这些周期性诊断。`getState()` 和 `screenPoint(r,c)` 始终可按需读取。
