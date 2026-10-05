# 标签定义

区域、钥匙与折线几何纯规则已分别归入 regions.mjs、keys.mjs 和 fold-geometry.mjs，根同名模块转发以兼容旧调用。玩家协调继续留在 player.cjs。

所有标签静态定义保存在 assets/prefab/tag。version:1 定义包含 id、name、BaseEntity ID 列表、behavior（受控 scriptId + parameters/state JSON）及 properties 描述。

当前注册 tag-region、tag-fold、tag-spawn、tag-entry、tag-exit。折线方向与出口钥匙条件属于标签参数，requiredKeys 不作为独立标签。实例数据继续兼容 regionTag、folds/foldCells 和 tags，不引入新的地图版本或折纸规则。

assertTagAttachment 校验目标实体 ID，虚空使用 void_ai。可附着不替代可通行、隐藏、唯一起点/入口或区域约束；调用者必须继续执行既有规则。前端目录只读，写入使用 node work/write-tag-prefab.cjs。
