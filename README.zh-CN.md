<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="assets/banner.png" alt="Savant-Code — 多智能体 AI 编程助手" width="850" />

**一款终端原生的 AI 编程助手，在每一次改动进入你的代码库之前都会先进行审计。**

基于 TypeScript/Bun 构建，受 ECHO 协议治理，并针对本地优先的 Ollama 使用场景设计。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.2.2-%23000000?style=flat-square&logo=opentui&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](ECHO.md)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![Release](https://img.shields.io/badge/Release-v0.0.16-%23000000?style=flat-square&logo=semver&logoColor=%2300fbff)](CHANGELOG.md)

</div>

> **v0.0.16** — 检查点与回退（Checkpoint & Rewind）：基于持久化检查点存储的每轮编辑安全网，通过
> `/rewind`（可只恢复代码、只恢复对话、两者都恢复，或分叉会话），外加一轮覆盖所有执行面的仓库级
> 质量大扫除——agent 运行时（fail-closed 工具调用流、Thinker 级联修复）、llm-providers + database
> （防崩溃初始化、rowid 排序、语句缓存）、SDK 实现层 + common（OAuth 限流双重执行修复、zod
> `required` 重新推导）、code-map 与 evals 运行器——以及 ECHO 协议强制（编程原语工具、fail-closed
> 步骤校验）和构建卫生（`bun run clean`，不再产生孤儿 sourcemap）。v0.0.16 的 CommandCode 提供商、
> 首次运行引导与同步的发布元数据一并延续。

---

## 30 秒快速开始

```bash
# 安装 CLI
npm install -g savant-code

# 运行。如果 Ollama 正在运行，它会自动检测并使用。
savant-code
```

_终端演示视频暂未提供；下方落地页与 CLI 源码链接描述了当前已验证的工作流。_

还没有 Ollama？

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh
ollama serve

# Windows: https://ollama.com/download/windows
```

然后再次运行 `savant-code`，或在聊天中输入 `/health` 验证连接。

如果 Ollama 没有运行，请在发送提示词前配置一个托管提供商：

```text
/provider opencode-go
```

你也可以输入 `/provider` 从交互式选择器中选择。将密钥粘贴到遮罩提示框中；它会被全局存储，且永远不会写入
聊天记录。支持的托管提供商包括：

| 提供商 | 命令 | 环境变量 | 说明 |
| --- | --- | --- | --- |
| Ollama | 自动检测 | — | 本地推理；无需 API 密钥 |
| OpenRouter 直连 | `DIRECT_PROVIDER=openrouter` | `OR_MASTER_KEY`、`OPENROUTER_API_KEY` 或 `INFERENCE_API_KEY` | 直连模式；优先使用主密钥、普通密钥，再使用推理密钥 |
| OpenCode Go | `/provider opencode-go` | `OPENCODE_GO_API_KEY` | 默认托管提供商；默认模型为 MiMo 2.5 |
| TokenRouter | `/provider tokenrouter` | `TOKENROUTER_API_KEY` | 多提供商网关 |
| NVIDIA NIM | `/provider nvidia` | `NVIDIA_API_KEY` | NVIDIA 托管推理 |
| CommandCode | `/provider commandcode` | `COMMAND_CODE_API_KEY` | OpenAI 兼容的托管推理 |

密钥持久化在 Windows 的 `C:\Users\<username>\.savant-code\credentials.json` 或 macOS/Linux 的
`~/.savant-code/credentials.json`。环境变量优先于已保存的凭据。自动化时，在启动 Savant-Code 前设置一个提供商密钥：

```powershell
# PowerShell —— 选择一个提供商密钥
$env:OPENCODE_GO_API_KEY = "your-key"
# $env:TOKENROUTER_API_KEY = "your-key"
# $env:NVIDIA_API_KEY = "your-key"
# $env:COMMAND_CODE_API_KEY = "your-key"
savant-code
```

```cmd
:: 命令提示符 —— 选择一个提供商密钥
set OPENCODE_GO_API_KEY=your-key
:: set TOKENROUTER_API_KEY=your-key
:: set NVIDIA_API_KEY=your-key
:: set COMMAND_CODE_API_KEY=your-key
savant-code
```

```bash
# macOS/Linux —— 选择一个提供商密钥
export OPENCODE_GO_API_KEY="your-key"
# export TOKENROUTER_API_KEY="your-key"
# export NVIDIA_API_KEY="your-key"
# export COMMAND_CODE_API_KEY="your-key"
savant-code
```

### OpenRouter 直连模式

如需绕过 Savant Code 后端、将推理直接路由到 OpenRouter，请设置：

```bash
export DIRECT_PROVIDER=openrouter
export INFERENCE_BASE_URL=https://openrouter.ai/api/v1
```

OpenRouter 凭据优先级如下：

1. `OR_MASTER_KEY` —— 通过 OpenRouter `/api/v1/keys` 换取普通密钥。
2. `OPENROUTER_API_KEY` —— 直接使用已有的普通 OpenRouter 密钥。
3. `INFERENCE_API_KEY` —— 使用 SDK 专用推理密钥。

高级 Cloudflare Workers AI 集成使用 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。普通 CLI 用户应使用
`/provider` 或上面的四个提供商专用密钥。请勿创建项目级 `.env` 文件，也不要手动编辑 `credentials.json`。

---

## 概述

Savant-Code 是一个 TypeScript monorepo，用于构建并发布终端原生的 AI 编程助手 **Savant Code** 以及公开的
[`@savant-code/sdk`](https://www.npmjs.com/package/@savant-code/sdk)。CLI 提供多智能体编排、自定义技能、
MCP 工具发现、模式切换（`EDIT` / `ANALYZE` / `SCAFFOLD`）以及本地优先的 Ollama 支持。SDK、agent
运行时、多智能体编排引擎、工具层与 LLM 提供商适配层共享，因此两个产品面从同一套代码发布。

整个项目基于 [ECHO 协议 v0.2.0](ECHO.md) 发布——即治理 Savant 生态的同一套 15 条定律 agent 纪律。每项
改动都要经过 RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE 完美循环状态机，并带有硬性的 10 次迭代
上限与每次通过 10% 的 Levenshtein 改动上限。

---

## 关键技术

| 层            | 技术                             | 版本                                             |
| ------------- | -------------------------------- | ------------------------------------------------ |
| 运行时        | Bun                              | 1.3.14 (engines `>=1.3.11`)                      |
| 语言          | TypeScript                       | 5.5.4 (`strict: true`, `noImplicitReturns: true`) |
| TUI           | OpenTUI + React 19               | `@opentui/core` 0.2.2, `react` ^19.0.0           |
| 状态管理      | Zustand + Immer                  | zustand ^5.0.8, immer ^10.1.3                    |
| 校验          | Zod                              | ^4.2.1                                           |
| LLM SDK       | Vercel AI SDK                    | `ai` ^5.0.52 + `@ai-sdk/anthropic` 2.0.50        |
| MCP           | Model Context Protocol           | `@modelcontextprotocol/sdk` ^1.18.2              |
| 代码解析      | tree-sitter (WASM)               | `@vscode/tree-sitter-wasm` 0.1.4                 |
| HTTP / WS     | ws, node-fetch, 自定义 SDK 客户端 | ws ^8.18.0                                       |
| 包管理器      | Bun workspaces (hoisted)         | `bunfig.toml` `[install] linker = "hoisted"`     |

---

## 功能特性

### CLI（`@savant-code/cli`）

- **多智能体编排** —— 9 个专职智能体通过 ECHO 协议协作：Detective 发现问题，Forge 实现，Verifier
  审计，Recorder 管理 FID，Thinker 推理，Scout 探索，Researcher 调研，Scribe 记录文档。
- **带顺序思维的 Thinker** —— Thinker 智能体通过 `sequentialthinking` 累积栈式推理步骤，收敛到类型化
  非空的 `FinalArtifact`（status/synthesis/payload/metrics/thoughts），绝不返回 null 或空结果。
- **原生工具调用加固** —— 针对不完整/畸形/截断工具调用的 fail-closed 流式边界；占位参数的老旧片段
  替换；在严格 Zod 校验之前对字符串化数字/布尔值的宽松强制转换。
- **工具权限边界** —— 通过 `filterToolSet` 基于严格白名单进行工具供给；受限智能体（Thinker、Scout）
  永远不会收到仅父级可用的工具；执行器授权保持不变。
- **`/init` 命令** —— 生成 `.agents/types/{agent-definition,tools,util-types}.ts` 以及一份入门
  `knowledge.md`。
- **斜杠命令** —— `/new`、`/history`、`/bash`、`/goal`、`/loop`、`/feedback`、`/rewind`、
  `/theme:toggle`、`/login`、`/logout`、`/exit`，以及各智能体专属命令。
- **提供商设置** —— `/provider` 打开交互式下拉选择器，显示所有提供商及其 ✓/✗ 配置状态。选择提供商后可
  输入其 API 密钥（遮罩输入）。密钥存储在本地 `credentials.json`。
- **遥测控制** —— `/telemetry status|enable|disable` 切换远程分析与错误上报。主 CLI 默认开启远程分析，但用户可以
  随时关闭；关闭后本地日志仍然可用。上下文广告是独立设置：主 CLI 默认关闭广告，并可在适用时单独控制。Savant-Free
  是独立的广告支持产品面。
- **`@filename` 与 `@AgentName` 提及** —— 文件与智能体提及，支持行内自动补全。
- **Bash 模式** —— `!command` 或 `/bash` 行内运行 shell 命令（需确认）。
- **权限与沙箱控制** —— `--permission-mode safe|prompt|unsafe` 设置启动策略；
  `/permissions`（别名 `/sandbox`、`/safety`）可在会话中查看或修改策略。  `safe` 自动拒绝高风险工具；由于交互式确认尚未实现，`prompt` 目前也会拒绝高风险工具；`unsafe` 则明确允许高风险工具。
  只有理解命令风险时才使用 `unsafe`。
- **目标循环** —— `/goal` 设置目标条件；`/loop <cadence>` 调度周期性提示执行（例如
  `/loop 5m check build status`）。循环调度器管理节奏、运行次数与收敛检测。
- **结构化规划与审查** —— `/interview` 将不完整的需求整理为结构化规格，`/plan` 创建实现计划，`/review` 打开
  专注的代码审查流程。
- **聊天内验证** —— `/verify` 运行四个受支持的核心工作区类型检查，也可以使用 `/verify sdk`、`/verify common`、
  `/verify agent-runtime` 或 `/verify cli` 指定目标。`/diagnostics` 报告本地进程与资源信息。
- **会话工具** —— `/copy`（别名 `/copy-chat`、`/export`）复制完整对话；`/image`（别名 `/img`、`/attach`）
  在所选提供商支持多模态输入时附加图片。
- **智能体发布** —— `/publish` 为包含必要 publisher 元数据的模板打开智能体发布流程。它需要 Savant Code 后端，
  不能在直接提供商模式下使用。
- **模式切换** —— `EDIT` / `ANALYZE` / `SCAFFOLD` 执行范围模式，可在运行时通过 UI 切换。
- **流式与取消** —— 逐 token 的 SSE 流式输出，支持流中取消、退避重试，以及并行工作的子智能体流式输出。
- **知识文件** —— 项目级 `knowledge.md` 外加每用户主目录知识，自动载入 agent 上下文。
- **技能（Skills）** —— 启动时发现 OpenClaw 格式的 `SKILL.md` 文件，schema 发送给 LLM，作为原生工具使用。
- **MCP 工具** —— 启动时发现 Model Context Protocol 服务器，schema 发布给 LLM API。
- **上下文压缩** —— 4 层渐进式自动压缩：L0（总结旧轮次）、L1（压缩工具结果）、L2（裁剪过期上下文）、
  L3（激进缩减）。在保留关键上下文的同时降低 token 用量。
- **上下文窗口解析** —— 网关模型（例如 `opencode-go/mimo-v2.5`）在运行时从 OpenRouter 目录解析其真实
  上下文长度。
- **通用复制按钮** —— 在整个 TUI 中悬停即可复制代码块、工具输出与文件 diff。
- **网关提供商** —— 通过 `@savant-code/llm-providers` 支持 TokenRouter、NVIDIA NIM、OpenCode Go、
  CommandCode 与 Cloudflare Workers AI。
- **默认模型** —— 通过 OpenCode Go 使用 MiMo 2.5（可通过 `/model` 配置）。
- **主题** —— 亮/暗切换（`/theme:toggle`），Neon Slate 美学。
- **侧栏折叠** —— 右侧栏区块与 FID 卡片默认折叠，首屏渲染更紧凑；点击展开。
- **完整命令面** —— 主要斜杠命令已在下方参考表中列出；高级命令仍可通过注册表与自动补全使用。
- **检查点与回退** —— 每轮一个持久化检查点，记录每个首触文件的编辑前内容（包括子智能体写入）以及对话
  边界；`/rewind` 打开选择器，可恢复**仅代码**、**仅对话**、**两者**，或从更早的一轮**分叉新会话**——无需
  git。保留上限为最近 20 轮，且终端副作用永远不会被回退。

### SDK（`@savant-code/sdk`）

- **`SavantCodeClient` 类** —— 从任何 Node.js / Bun / 浏览器应用运行 agent 的单一入口。
- **流式事件** —— `handleEvent` 回调接收 `RunState` 更新、工具调用、文件 diff 与最终输出。
- **自定义 agent** —— 传入 `agentDefinitions: AgentDefinition[]` 覆盖默认配置。
- **自定义工具** —— 传入 `customToolDefinitions` 扩展工具注册表。
- **取消** —— `AbortSignal` 通过子智能体流传播。
- **检查点 API** —— 持久化检查点存储（`openTurn`、`captureSnapshot`、`closeTurn`、`listTurns`、
  `restoreTurn`、`forkFrom`）从 SDK 重新导出，宿主可以对任何运行做检查点与回退；
  `checkpointDir`/`checkpointTurnId` 运行选项将轮次边界贯穿到子智能体写入。

### Agent 运行时（`@savant-code/agent-runtime`）

- **LLM 无关** —— 调用任何注册到 `@savant-code/llm-providers` 的提供商（OpenAI 兼容聊天、Anthropic 等）。
- **多步循环** —— 模型决定工具 → 工具执行 → 结果反馈 → 重复，直到 `end_turn` 或预算耗尽。
- **工具注册表** —— 内置（`read_files`、`write_file`、`run_terminal_command`、`code_search`、
  `web_search`、`spawn_agents_inline` 等）+ 自定义 + MCP。
- **成本聚合** —— 每次调用的 token 计数与 USD 成本估算在 `RunState` 中呈现。
- **轮次检查点** —— `executeToolCall` 中的写闸门在 `write_file`/`str_replace`/`apply_patch` 分发前捕获
  编辑前内容；子智能体写入通过 spawn 上下文继承父轮次。

### ECHO 协议集成

- **9 个专职智能体** —— Orchestrator、Detective、Forge、Verifier、Recorder、Thinker、Scout、
  Researcher、Scribe
- **FID 约束执行** —— FID 收敛之前绝不写代码
- **完美循环状态机** —— RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE
- **职责分离** —— 写代码的智能体不能验证它
- **15 条定律** —— 4 条不可变流程定律 + 11 条扩展代码定律

---

## 仓库地图

<!-- markdownlint-disable MD013 MD060 -->

| 工作区                    | 包                            | 用途                                                            |
| ------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `agents/`                 | `@savant-code/agents`         | 随 CLI 发布的公开 agent 定义                                    |
| `cli/`                    | `@savant-code/cli`            | CLI 源码——UI、命令、状态、hooks、OpenTUI/React 组件             |
| `common/`                 | `@savant-code/common`         | 共享类型、工具定义、工具函数                                    |
| `evals/`                  | `@savant-code/evals`          | ECHO 原生 benchmark v2 运行器 + 遗留 eval fixtures              |
| `savant-free/`            | `@savant-code/savant-free`    | 私有/预发布的免费广告支持变体；支持本地二进制与 E2E 测试          |
| `packages/agent-runtime/` | `@savant-code/agent-runtime`  | agent 循环、工具执行器、LLM API 集成                            |
| `packages/code-map/`      | `@savant-code/code-map`       | tree-sitter 代码索引、语言检测                                  |
| `packages/database/`      | `@savant-code/database`       | 数据库抽象层                                                     |
| `packages/llm-providers/` | `@savant-code/llm-providers`  | 公开 LLM 提供商适配层                                           |
| `sdk/`                    | `@savant-code/sdk`            | 公开 SDK——`SavantCodeClient`、类型、构建 + 验证脚本             |
| `scripts/tmux/`           | `@savant-code/tmux`           | 交互式测试运行中使用的 tmux CLI 辅助工具                         |

<!-- markdownlint-enable MD013 MD060 -->

---

## 快速上手

### 1. 克隆并安装

```bash
git clone https://github.com/savant0x/savant-code.git
cd savant-code
bun install
```

### 2. 运行 CLI（开发模式）

```bash
# 以开发模式运行 CLI
bun run dev

# 或以指定权限模式运行
bun run dev -- --permission-mode safe
```

### 3. 构建发布产物

```bash
# 构建 SDK
bun run build:sdk

# 从 CLI 工作区构建 CLI 二进制
bun run --cwd=cli build:binary
```

### 4. 使用 SDK

```ts
import { SavantCodeClient } from '@savant-code/sdk'

const client = new SavantCodeClient({
  apiKey: process.env.SAVANT_CODE_API_KEY,
  cwd: '/path/to/your/project',
  onError: (err) => console.error('Savant-Code error:', err.message),
})

const result = await client.run({
  agent: 'savant',
  prompt: 'Add error handling to all API endpoints',
  handleEvent: (event) => console.log('Progress', event),
})
```

### 5. 终端用户安装

```bash
# npm
npm install -g savant-code
```

### 6. 配合本地 Ollama 使用（零 API 密钥）

如果你已安装并运行 [Ollama](https://ollama.com/)，Savant Code 会在首次启动时自动检测，并将推理路由到
你的本地守护进程——无需 API 密钥、无需账号、无需任何提示。

```bash
# 后台启动 Ollama，然后运行 CLI
ollama serve
savant-code
```

在聊天中运行 `/health` 验证 Ollama 连接、可用的本地模型以及当前权限模式。

### 配置托管提供商密钥

如果 Ollama 没有运行，Savant-Code 需要所选网关模型的提供商 API 密钥。可使用交互式选择器，也可以直接选择：

```text
/provider opencode-go
/provider tokenrouter
/provider nvidia
/provider commandcode
```

支持的环境变量是 `OPENCODE_GO_API_KEY`、`TOKENROUTER_API_KEY`、`NVIDIA_API_KEY` 与
`COMMAND_CODE_API_KEY`。密钥提示为遮罩输入，并将密钥全局存储在 Savant-Code 配置的 `credentials.json` 中；不会加入
聊天记录。shell 环境变量优先于已存储的密钥，因此 CI 与托管环境可以不使用本地持久化来配置提供商。高级直接提供商
集成可以使用 `INFERENCE_BASE_URL` 与 `INFERENCE_API_KEY`；OpenRouter 可使用 `OPENROUTER_API_KEY` 或
`SAVANT_CODE_BYOK_OPENROUTER`。

---

## CLI 命令

<!-- markdownlint-disable MD013 MD060 -->

| 命令                              | 作用                            |
| --------------------------------- | ------------------------------- |
| `bun run dev`                     | 以开发模式启动 CLI              |
| `bun run build:sdk`               | 构建 SDK 用于 npm 发布          |
| `bun run --cwd=cli build:binary`  | 从 `cli/` 构建 CLI 二进制       |
| `bun run ci`                      | 构建 SDK 与发布产物             |
| `bun test`                        | 运行测试套件                    |
| `bun x tsc --noEmit`              | 类型检查                        |
| `bun x eslint . --max-warnings 0` | Lint                            |

<!-- markdownlint-enable MD013 MD060 -->

---

## 斜杠命令参考

命令可以使用 `/` 输入；别名显示在括号中。Savant-Free 模式会有意移除付费/后端专属命令，因此可用命令可能有所不同。

| 命令 | 作用 |
| --- | --- |
| `/help`（`/h`、`/?`） | 显示命令帮助与提示 |
| `/new`（`/clear`、`/reset`） | 开始新聊天；可附带文本直接开始第一条提示 |
| `/history`（`/chats`） | 浏览并恢复历史对话 |
| `/copy`（`/export`） | 复制完整对话 |
| `/interview` | 将想法整理为结构化规格 |
| `/plan` | 创建实现计划 |
| `/review` | 审查代码改动 |
| `/goal`（`/g`） | 持续迭代直到可验证目标满足 |
| `/loop`（`/repeat`） | 按周期运行提示；使用 `stop` 或 `status` |
| `/verify`（`/typecheck`） | 运行四个受支持的核心工作区类型检查，可全部运行或指定一个 |
| `/permissions`（`/sandbox`、`/safety`） | 查看或设置 `safe`、`prompt`、`unsafe` 工具策略 |
| `/rewind`（`/undo`、`/checkpoint`） | 恢复之前轮次的文件和/或对话 |
| `/health`（`/status`、`/check`） | 检查 Ollama、提供商模式、模型与权限状态 |
| `/diagnostics`（`/diag`、`/processes`） | 显示本地进程与资源诊断信息 |
| `/provider` | 使用遮罩输入配置托管提供商密钥 |
| `/model` | 选择或切换当前托管模型 |
| `/publish` | 通过 Savant 后端发布智能体模板 |
| `/feedback`（`/bug`、`/report`） | 打开反馈流程 |
| `/telemetry`（`/analytics`） | 查看或修改远程分析同意状态 |
| `/theme:toggle` | 在亮色与暗色主题间切换 |
| `/bash`（`!`） | 运行 shell 命令或进入 Bash 模式 |
| `/image`（`/img`、`/attach`） | 为支持多模态的模型附加图片 |
| `/init` | 创建入门智能体类型与 `knowledge.md` |
| `/login` / `/logout` | 登录或结束当前会话 |
| `/exit`（`/quit`、`/q`） | 退出 CLI |

Savant-Free 还提供 `/end-session` 等免费会话控制和模型选择器；付费/后端专属命令会从该构建中筛除。

---

## ECHO 协议

本项目随附 [ECHO 协议 v0.2.0](ECHO.md)——面向 agent 行为的单一引导文件。

### 核心原则

- **FID 约束执行** —— FID 收敛之前绝不写代码
- **完美循环** —— RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE
- **职责分离** —— 写代码的智能体不能验证它
- **不允许拖延** —— 每个已批准的工作项都必须完成

### 15 条定律

4 条不可变流程定律（Read 0-EOF、Present Before Act、Verify Before Proceed、Call-Graph Reachability）+
11 条扩展代码定律。TypeScript 中 `strict: true`。

### 关键文件

<!-- markdownlint-disable MD060 -->

| 文件                       | 用途                                          |
| -------------------------- | --------------------------------------------- |
| `ECHO.md`                  | 15 条定律 + 完美循环状态机 + FID 生命周期     |
| `ARCHITECTURE.md`          | agent 名册与工具限制                          |
| `protocol.config.yaml`     | 构建命令、质量基准、路径                      |
| `dev/fids/`                | 功能实现文档（FID）                            |
| `dev/session-summaries/`   | 会话审计轨迹                                  |
| `dev/LEARNINGS.md`         | 跨会话经验                                    |

<!-- markdownlint-enable MD060 -->

---

## 配置

| 内容                       | 位置                    | 格式                                    |
| -------------------------- | ----------------------- | --------------------------------------- |
| ECHO 协议运行时配置        | `protocol.config.yaml`  | YAML——语言、命令、质量限制              |
| TypeScript 基础配置        | `tsconfig.json`         | JSON——`strict: true`                    |
| ESLint 配置                | `eslint.config.js`      | Flat config                             |
| Bun 配置                   | `bunfig.toml`           | TOML——`linker: "hoisted"`               |

---

## 验证

```bash
# 构建
bun run build:sdk && bun run ci

# 测试
bun test

# 类型检查
bun x tsc --noEmit

# Lint
bun x eslint . --max-warnings 0

# 格式化
bun x prettier --write .
```

---

## 文档

- [`ECHO.md`](ECHO.md) — 15 条定律 + 完美循环状态机
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — agent 名册与工具限制
- [`protocol.config.yaml`](protocol.config.yaml) — 构建命令、质量基准
- [`CHANGELOG.md`](CHANGELOG.md) — 发布历史
- [`docs/launch/landing/index.html`](docs/launch/landing/index.html) — 公开落地页
- [`dev/LEARNINGS.md`](dev/LEARNINGS.md) — 跨会话经验
- [`dev/session-summaries/`](dev/session-summaries/) — 会话审计轨迹

---

## 许可证

[Apache-2.0](LICENSE) — 完整文本见 [LICENSE](LICENSE)。

---

_Savant-Code 是 Savant-Code agent 框架的公开 TypeScript monorepo。_

**Savant** • 2026
