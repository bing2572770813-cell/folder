# Prefab 目录

entity/ 存放实体定义，tag/ 保留给标签定义。前端不写入此目录；实体写入仍使用 node work/write-prefab.cjs。

实体目录加载优先读取 entity/，再兼容根目录旧 JSON。同一 ID 只加载一次并报告重复定义；tag/ 不作为实体扫描。无效 JSON 隔离，不阻断其他定义。

迁移保持实体 ID 和 tile 配置不变。player_token_ai.json 当前包含用户未提交修改，暂留根目录并通过旧目录兼容加载；不可为了迁移提交用户尚未授权的属性变更。

tag/ 已包含区域、折线、玩家起点、区域入口和区域出口五类定义；接口同时返回 prefabs 和 tags，前端约两秒刷新，独立构建内嵌两类目录。标签使用受控脚本 ID、BaseEntity 列表与属性描述，错误定义隔离。

程序写入标签使用 node work/write-tag-prefab.cjs，不能覆盖已有 ID。标签实例继续保存到旧地图字段，通用属性权限仍待接入。

entity/player_ai.json 为自动生成的可操控玩家定义，受控行为 ID 为 player-controller。behavior.parameters.moveHeight 定义默认最大上移/下降；behavior.state 定义初始过热、冰冻、机制行动次数与已收集钥匙；tile.color 定义 token 颜色。player.cjs 实例化独立状态并在进出游玩/重启时重新读取当前目录定义。手动放置 Player prefab 仅生成普通静态 token，不获得控制权；旧 player_token_ai 继续兼容。
