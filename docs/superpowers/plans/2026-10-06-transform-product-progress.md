# Transform 产品计划实施与验收进度

依据：`docs/entity-transform-tree-product-design.md`。本表记录实际产品实现与验收。

| 需求 | 当前实现与验证 |
| --- | --- |
| FR-01、FR-03–06、FR-14 | canonical TreeDocument；检视页列出完整树与同格节点，提供局部位置、父节点、保持世界位置重挂载和受保护删除。树命令与浏览器 product smoke 验证父子移动、隐藏拒绝、撤销重做。 |
| FR-02 | regionTag 是地图 tile 的固定标签；节点移动、复制和删除不携带或清除源格区域。所有节点格检查 spawn/entry 唯一性和 exitTo 标量冲突，包括没有 surface 的节点。 |
| FR-04、FR-07、FR-09 | 显式叠加开关；每个节点独立绘制 surface/terrain/tag 并带节点拾取 ID。纸张几何仍使用 paperSurface，渲染投影不保存新空间索引。 |
| FR-08 | 受控 prefab 继承、数组替换、子 prefab 递归实例化；native components-only 定义可从磁盘目录/API 进入调色板并实际放置，不生成缺省 surface/collision；继承组件与 children 默认值均保留。 |
| FR-10、FR-11 | player.cjs 统一编排 enter/leave/interact；交互按钮已接入，运行时快照、重启和无效起点组件预检有回归。 |
| FR-12、FR-13 | v1 导入、v2 保存、完整子树与稀疏占格剪贴板、独立 ID、HTML 导出后 file:// 启动；双向权限桥接过滤 legacy/canonical 重复字段。 |

局部 dir 沿父链叠加；当前旋转不旋转子节点坐标偏移或 footprint。JSON 编辑先验证 readable/tempEditable，保留不可见字段；serializable:false 的修改只保存在编辑调试覆盖中，不进入 canonical 地图、历史、剪贴板和导出，并在模式切换、新图与重启时清除。失败的覆盖、擦除和缩图先在候选文档校验，不新增历史记录。

起点投影和保存从真实 spawn 节点同步坐标并保留 dir；所需钥匙 UI、编辑校验和玩家校验共享全节点可收集钥匙查询，包含无 surface 的 key overlay 和混合组件节点。

验证证据：backend 自动回归 80/80、npm test、build；fresh 临时服务 native disk/API/catalog/palette smoke 验证继承 defaults/children 和无伪造 surface/collision，boundary smoke 验证 overlay key 门槛及移动起点后试玩；backend 自动回归、旧编辑器/几何/DOM/独立导出测试；浏览器 product/export/picking smoke 覆盖完整树、节点拾取、叠加、撤销重做、重载和试玩交互。


已提交产品接入：cbe6abc、9488ff4、c0aced2、145317c、5ab70e9、16d5499、5b1a59d；原生目录/调色板、起点与钥匙边界回归已包含在对应功能提交中。

用户明确的语义：region 属于地图 tile。当前实现保持现有方向规则：父链方向相加，不旋转坐标偏移或 footprint。
