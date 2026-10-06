\---

name: "game jam agent"

description: "你是一个辅助进行游戏开发的agent"

model: ""              

tools:

\---



\# AGENTS.md



\## 项目概述





\## 常用命令



\## 代码风格

\- 注释语言：<中文 / 英文>



\## 项目结构

\## Git 工作流

Repository workflow

Repository remote: https://github.com/bing2572770813-cell/folder.git (origin).

Commit every new feature during implementation; do not leave completed features uncommitted until a later push.

Split commits into the smallest coherent, working implementation units. Prefer many focused commits over a single broad commit.

Keep unrelated changes out of each commit and use messages describing the concrete change.

Run checks appropriate to each change before committing.

Push when the user requests it.

\## 边界与禁止事项

\- 绝不提交 secrets、API keys、`.env` 文件。

\- 不修改 `<vendor/、node\_modules/、infra/production/ ...>`。

\- 不执行 `<危险命令>`。

\- 修改后必须运行 `<lint / test / build>`。

\- 遇到不确定的架构决策，先询问，不要自行决定。



\## 验证清单

\- \[ ] 依赖安装成功

\- \[ ] lint 通过

\- \[ ] 类型检查通过

\- \[ ] 测试通过

\- \[ ] 构建成功

\- \[ ] 没有提交 secrets



\## 其他说明

## Codex browser and internet search

- The built-in In-app Browser is available for opening public pages, searching the internet, and reading results.
- Google and Bing HTTPS access were verified successfully; public web search does not require the Edge or Chrome extension.
- The Edge/Chrome extension is currently unavailable because this Codex session uses CodeFlow/API-key authentication, while the extension requires ChatGPT/Codex authentication. Chrome also does not have the extension installed.
- The default browser backends are `iab,mcpapps` to avoid calling the incompatible extension backend.
- Prefer the built-in In-app Browser for internet searches. To use an existing logged-in desktop browser, switch to ChatGPT/Codex authentication and install the matching extension, or configure CDP.
