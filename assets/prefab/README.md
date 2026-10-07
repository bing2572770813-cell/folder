# Prefab 目录

entity/ 存放实体定义，tag/ 保留给标签定义。前端不写入此目录；实体写入仍使用 node work/write-prefab.cjs。

实体目录加载优先读取 entity/，再兼容根目录旧 JSON。同一 ID 只加载一次并报告重复定义；tag/ 不作为实体扫描。无效 JSON 隔离，不阻断其他定义。

迁移保持实体 ID 和 tile 配置不变。player_token_ai.json 当前包含用户未提交修改，暂留根目录并通过旧目录兼容加载；不可为了迁移提交用户尚未授权的属性变更。

tag/ 已包含区域、折线、玩家起点、区域入口和区域出口五类定义；接口同时返回 prefabs 和 tags，前端约两秒刷新，独立构建内嵌两类目录。标签使用受控脚本 ID、BaseEntity 列表与属性描述，错误定义隔离。

程序写入标签使用 node work/write-tag-prefab.cjs，不能覆盖已有 ID。标签实例继续保存到旧地图字段，通用属性权限仍待接入。

entity/player_ai.json 为自动生成的可操控玩家定义，受控行为 ID 为 player-controller。behavior.parameters.moveHeight 定义默认最大上移/下降；behavior.state 定义初始过热、冰冻、机制行动次数与已收集钥匙；tile.color 定义 token 颜色。player.cjs 实例化独立状态并在进出游玩/重启时重新读取当前目录定义。Player 的 static.entityType 为 creature，static.placeable 为 false，只能自动生成；可放置的 Player Token 为 item，继续使用 player_token_ai。
behavior.parameters.foldDrop.vertical 和 horizontal 定义折纸落点默认阈值（世界 Y 竖直距离、XZ 水平距离），默认分别为 1 和 0.35；必须大于 0 且不超过 16。前端调试只改变运行实例，重启恢复 prefab 默认值。

实体类型以 static.entityType 标注：terrain（地形）、item（道具）、creature（生物）。现有地形放置为互斥替换：paper_ai 及阻挡实体的 BaseEntity 为 void_ai，指清空后的根基底；其他非阻挡地形的 BaseEntity 仅为 paper_ai，先检查当前纸张再消耗它。道具 BaseEntity 为实际方块 prefab ID 列表，不含虚空；新方块定义加入后，程序应同步更新需要支持它的道具 BaseEntity。更换地形清除该格道具。地形和道具使用同一前端放置入口，由类别和 BaseEntity 决定替换或附着，前端不写 prefab。
