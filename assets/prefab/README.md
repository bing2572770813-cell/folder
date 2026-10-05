# Prefab 目录

entity/ 存放实体定义，tag/ 保留给标签定义。前端不写入此目录；实体写入仍使用 node work/write-prefab.cjs。

实体目录加载优先读取 entity/，再兼容根目录旧 JSON。同一 ID 只加载一次并报告重复定义；tag/ 不作为实体扫描。无效 JSON 隔离，不阻断其他定义。

迁移保持实体 ID 和 tile 配置不变。player_token_ai.json 当前包含用户未提交修改，暂留根目录并通过旧目录兼容加载；不可为了迁移提交用户尚未授权的属性变更。

tag/ 已包含区域、折线、玩家起点、区域入口和区域出口五类定义；接口同时返回 prefabs 和 tags，前端约两秒刷新，独立构建内嵌两类目录。标签使用受控脚本 ID、BaseEntity 列表与属性描述，错误定义隔离。

程序写入标签使用 node work/write-tag-prefab.cjs，不能覆盖已有 ID。标签实例继续保存到旧地图字段，通用属性权限仍待接入。
