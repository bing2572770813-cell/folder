# 核心基础设施

map-model.mjs 负责地图维度、结构、归一化和旧格式迁移；app.js 只委托调用，不在 DOM 适配中维护第二套校验。map-name.mjs 提供名称与安全文件名，根旧入口保持兼容。

EventBus 提供 on/emit/clear。订阅返回幂等取消函数，监听器新增在下一次广播生效；广播前已取消的订阅不再调用。一个监听器异常不阻断其他通知，emit 返回异常列表，由调用者报告。

map:changed 目前连接现有状态改变后的保存请求，负载为 {map}；它是通知，不执行玩家动作或校验命令，不决定地图是否可导出。现有 120ms 自动保存防抖与错误反馈保留。

本目录不访问 DOM、Three.js、磁盘或玩家状态机。测试为 node work/test-event-bus.mjs。

property-model.mjs 提供 propertySchema 校验、嵌套权限、独立属性修改及地图配置投影。描述以字段名为键，使用 readable/serializable/tempEditable、children、items 与可选 label。父级禁止权限时子级不能开放；内部身份只读。prefab 支持 tile.properties 自定义嵌套值及 propertySchema，放置时保留描述快照。

地图 JSON、本地自动保存与独立游戏导出均调用 serializeMapConfiguration；非序列化字段不进入输出，可序列化字段继续保留。源码/身份结构不能由 Inspector 修改。验证：node work/test-property-model.mjs。
