# 实体与标签 Transform 树产品设计

## 1. 产品目标

为地图编辑器和游戏运行时提供统一的实体系统，使实体可以：

- 通过 Transform 父子关系组合；
- 在同一地图格中自然叠加；
- 通过组件获得不同能力；
- 通过标签表达区域、入口、出口和折纸等语义；
- 通过 prefab 继承复用定义；
- 使用静态标记声明默认能力和交互事件；
- 在编辑、保存、导入和游玩过程中保持一致的数据模型。

## 2. 用户价值

### 地图设计者

- 可以把多个实体组合成一个可移动的结构；
- 可以在同一格放置表面、机关、装饰和标签；
- 不需要为每种实体组合创建新的实体类型；
- 修改 prefab 默认值时，已有实例保持独立。

### 开发者

- 只维护一套 Transform 关系；
- 通过组件扩展实体能力；
- 通过 prefab 继承复用配置；
- 通过统一交互入口处理玩家和实体关系。

## 3. 核心概念

| 概念 | 产品含义 |
| --- | --- |
| Entity | 地图中的实体对象 |
| Transform | 实体的位置、方向、占格和父子关系 |
| Component | 实体拥有的能力 |
| Tag | 附着在实体或地图位置上的语义 |
| Prefab | 可复用的实体模板 |
| Static Marker | prefab 的不可变能力声明 |
| Transform Tree | 所有实体空间关系组成的树 |

系统不使用固定 layer 分类。实体是否叠加，由 Transform 计算出的世界坐标决定。

## 4. 用户场景

### 场景 A：组合实体

设计者创建一个机器 prefab，包含底座、火焰和控制面板三个子实体。移动机器根节点时，三个子实体同步移动。

### 场景 B：同格实体

纸面实体和火焰实体投影到同一地图格。系统根据两个节点的组件分别处理可通行性和进入效果。

### 场景 C：标签附着

设计者将出口标签附着到一个可行走实体，配置目标区域和所需钥匙。标签不改变实体的 Transform。

### 场景 D：Prefab 继承

火焰 prefab 继承纸面 prefab 的外观和基础属性，只增加火焰组件与静态事件标记。

## 5. 功能需求

| 编号 | 需求 | 优先级 | 验收标准 |
| --- | --- | --- | --- |
| FR-01 | 实体统一抽象 | P0 | 所有实体使用统一 ID、Transform 和组件接口 |
| FR-02 | 标签统一抽象 | P0 | spawn、entry、exit 属于实体标签，fold 属于节点组件，region 属于 tile |
| FR-03 | Transform 父子树 | P0 | 父节点移动后所有子节点世界位置同步 |
| FR-04 | 同格叠加 | P0 | 多个节点世界坐标相同，不需要额外 layer 或 CellStack |
| FR-05 | 动态 Transform 引用 | P0 | 节点只保存 ID，由 TransformManager 解析父子引用 |
| FR-06 | Transform 重挂载 | P1 | 修改父节点后，子树位置和索引正确更新 |
| FR-07 | 组件组合 | P0 | 一个实体可以同时拥有表面、碰撞、危险和收集能力 |
| FR-08 | Prefab 继承 | P0 | 子 prefab 继承父 prefab 默认配置并可覆盖允许字段 |
| FR-09 | Prefab 静态标记 | P0 | prefab 可声明通行、事件和渲染等静态能力 |
| FR-10 | 运行时状态隔离 | P0 | 一个实例的 frozen、overheat 等状态不影响其他实例 |
| FR-11 | 统一交互入口 | P0 | 玩家进入实体时通过组件处理器获得状态变化 |
| FR-12 | 数据兼容 | P1 | 旧 tile、terrain、tags、folds 可以转换为新模型 |
| FR-13 | 序列化 | P0 | 地图保存 ID 和局部 Transform，不保存对象指针和临时索引 |
| FR-14 | 删除保护 | P1 | 删除节点时检测子节点和外部引用，避免悬空 ID |

## 6. 对象关系

```text
MapRoot
└─ EntityNode
   ├─ Transform
   ├─ Components
   ├─ Tags
   └─ Children
```

实体只保存 `transformId`，Transform 保存 `parentId`：

```js
EntityNode {
  id,
  prefabId,
  transformId,
  components,
  tags
}

TransformNode {
  id,
  parentId,
  local,
  footprint
}
```

## 7. TransformManager

TransformManager 是 Transform 引用的唯一管理入口，负责：

- 创建和查找 Transform；
- 设置和解除父节点；
- 计算世界位置和世界占格；
- 建立临时地图格索引；
- 检测循环引用、非法父节点和越界；
- 删除节点时处理子节点和引用；
- 通知渲染与交互系统刷新。

业务模块不得直接修改 Transform 对象，也不得维护第二套父子或占格逻辑。

## 8. 组件和标签

组件由配置、运行时状态和注册处理器组成：

```text
Component
├─ config
├─ state
└─ handlers
```

初始组件范围：

| 组件 | 作用 |
| --- | --- |
| `surface` | 高度、颜色和纸张属性 |
| `collision` | 是否阻挡、是否可进入 |
| `fire` | 过热效果 |
| `ice` | 冰冻效果 |
| `eruption` | 周期开放效果 |
| `key` | 钥匙收集 |
| `fold` | 折纸线 |
| `tag` | 标签行为 |

标签默认作为节点属性保存；只有需要独立空间位置时才创建虚拟标签节点。

## 9. Prefab 和静态标记

Prefab 是实体默认模板：

```json
{
  "id": "fire_ai",
  "extends": "paper_ai",
  "components": {
    "fire": { "damage": 1 }
  },
  "static": {
    "walkable": false,
    "events": ["enter"]
  }
}
```

静态标记只声明默认能力，运行时不可修改。`frozen`、`overheat`、`collected` 等状态属于实例运行时状态。

继承规则：

- 普通对象递归合并；
- 数组整体替换；
- ID 和父引用不可被 prefab 覆盖；
- 禁止循环继承；
- 实例化后保存合并结果。

## 10. 交互流程

```text
玩家动作
→ TransformManager 计算目标世界格
→ 查询该格的 EntityNode
→ 调用节点组件事件处理器
→ 合并状态变化和提示
→ player.cjs 提交玩家状态
```

第一阶段只支持简单事件：`enter`、`leave`、`interact`。暂不实现事件捕获、冒泡和复杂消息总线。

## 11. 非目标

本阶段不包含：

- ECS 数据布局；
- 多套空间索引；
- 固定 layer 系统；
- 复杂事件捕获和冒泡；
- 运行时动态修改 prefab；
- 自动生成复杂继承树；
- 连续三维物理模拟。

## 12. 成功标准

- 新实体只需创建 prefab 和组件配置，不修改核心玩家逻辑；
- 同格叠加不引入第二套空间数据；
- 父节点移动、重挂载和删除不会产生悬空引用；
- 旧地图可以导入并转换；
- 组件运行时状态彼此隔离；
- `player.cjs` 仍是玩家状态机和玩家交互逻辑的唯一入口。


## 13. 产品落地进度（2026-10-06）

| 需求 | 当前实现与验证 |
| --- | --- |
| FR-01、FR-03–06、FR-14 | canonical TreeDocument；检视页列出完整树与同格节点，提供局部位置、父节点、保持世界位置重挂载和受保护删除。树命令与浏览器 product smoke 验证父子移动、隐藏拒绝、撤销重做。 |
| FR-02 | regionTag 是地图 tile 的固定标签；节点移动、复制和删除不携带或清除源格区域。所有节点格检查 spawn/entry 唯一性和 exitTo 标量冲突，包括没有 surface 的节点。 |
| FR-04、FR-07、FR-09 | 显式叠加开关；每个节点独立绘制 surface/terrain/tag 并带节点拾取 ID。纸张几何仍使用 paperSurface，渲染投影不保存新空间索引。 |
| FR-08 | 受控 prefab 继承、数组替换、子 prefab 递归实例化；native 组件记录可通过树命令实例化，现有 catalog 仍使用带 tile 的定义。 |
| FR-10、FR-11 | player.cjs 统一编排 enter/leave/interact；交互按钮已接入，运行时快照、重启和无效起点组件预检有回归。 |
| FR-12、FR-13 | v1 导入、v2 保存、完整子树与稀疏占格剪贴板、独立 ID、HTML 导出后 file:// 启动；双向权限桥接过滤 legacy/canonical 重复字段。 |

局部 dir 沿父链叠加；当前旋转不旋转子节点坐标偏移或 footprint。JSON 编辑先验证 readable/tempEditable，保留不可见字段；serializable:false 的修改只保存在编辑调试覆盖中，不进入 canonical 地图、历史、剪贴板和导出，并在模式切换、新图与重启时清除。失败的覆盖、擦除和缩图先在候选文档校验，不新增历史记录。

验证证据：backend 自动回归、旧编辑器/几何/DOM/独立导出测试；浏览器 product/export/picking smoke 覆盖完整树、节点拾取、叠加、撤销重做、重载和试玩交互。
