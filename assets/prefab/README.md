# Prefab 目录

entity/ 存放实体定义，tag/ 保留给标签定义。前端不写入此目录；实体写入仍使用 node work/write-prefab.cjs。

实体目录加载优先读取 entity/，再兼容根目录旧 JSON。同一 ID 只加载一次并报告重复定义；tag/ 不作为实体扫描。无效 JSON 隔离，不阻断其他定义。

迁移保持实体 ID 和 tile 配置不变。player_token_ai.json 当前包含用户未提交修改，暂留根目录并通过旧目录兼容加载；不可为了迁移提交用户尚未授权的属性变更。

tag/ 已包含区域、折线、玩家起点、区域入口和区域出口五类定义；接口同时返回 prefabs 和 tags，前端约两秒刷新，独立构建内嵌两类目录。标签使用受控脚本 ID、BaseEntity 列表与属性描述，错误定义隔离。

程序写入标签使用 node work/write-tag-prefab.cjs，不能覆盖已有 ID。标签实例继续保存到旧地图字段，通用属性权限仍待接入。

entity/player_ai.json 为自动生成的可操控玩家定义，受控行为 ID 为 player-controller。behavior.parameters.moveHeight 定义默认最大上移/下降；behavior.state 定义初始过热、冰冻、机制行动次数与已收集钥匙；tile.color 定义 token 颜色。player.cjs 实例化独立状态并在进出游玩/重启时重新读取当前目录定义。Player 的 static.entityType 为 creature，static.placeable 为 false，只能自动生成；可放置的 Player Token 为 item，继续使用 player_token_ai。
behavior.parameters.foldDrop.vertical 和 horizontal 定义折纸落点默认阈值（世界 Y 竖直距离、XZ 水平距离），默认分别为 1 和 0.35；必须大于 0 且不超过 16。前端调试只改变运行实例，重启恢复 prefab 默认值。

实体类型以 static.entityType 标注：terrain（地形）、item（道具）、creature（生物）。现有地形放置为互斥替换：paper_ai 及阻挡实体的 BaseEntity 为 void_ai，指清空后的根基底；其他非阻挡地形的 BaseEntity 仅为 paper_ai，先检查当前纸张再消耗它。道具 BaseEntity 为实际方块 prefab ID 列表，不含虚空；新方块定义加入后，程序应同步更新需要支持它的道具 BaseEntity。更换地形清除该格道具。地形和道具使用同一前端放置入口，由类别和 BaseEntity 决定替换或附着，前端不写 prefab。

## 美术模型引用

Prefab 可在顶层配置 `visual`，省略时使用现有外观，`null` 显式禁用继承的模型引用：

```json
{
  "visual": {
    "model": "model/key_ai.fbx",
    "scale": [1, 1, 1],
    "offset": [0, 0, 0],
    "rotation": [0, 0, 0],
    "textures": {"Key_Diffuse.png": "texture/key_ai.png"}
  }
}
```

路径以 `assets/` 为根，仅接受 `model/` 下的 FBX 和 `texture/` 下的 PNG；不接受绝对地址、URL、目录跳转或编码路径。`textures` 将 FBX 中外部贴图的文件名映射到资源路径；模型自带材质保留。三个变换均为 XYZ 数组，默认缩放 `[1,1,1]`、偏移和旋转 `[0,0,0]`；缩放须大于零，旋转使用度。美术坐标约定为 +Y 朝上、-Z 朝前、XZ 原点位于中心、Y 原点位于底部；一个地图格宽为一个世界单位。加载器保留 FBX 中的作者变换，不自动按包围盒拉伸模型。

继承按既有对象合并规则覆盖字段。放置时将解析后的外观快照保存到实体 `configuration.visual`，地图加载不依赖当前目录中的同名 prefab；旧地图 tile 的 `visual` 同样保留。模型外观不定义占格、碰撞或回合规则。
