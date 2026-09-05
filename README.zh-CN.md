<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="assets/banner.png" alt="Savant-Code — 多智能体 AI 编程助手" width="850" />

**一款终端原生的 AI 编程助手，在每一次改动进入你的代码库之前都会先进行审计。**

基于 TypeScript/Bun 构建，受 ECHO 协议治理，并针对本地优先的 Ollama 使用场景设计。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.5.3-%23000000?style=flat-square&logo=opentui&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](ECHO.md)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![Release](https://img.shields.io/badge/Release-v0.0.28-%23000000?style=flat-square&logo=semver&logoColor=%2300fbff)](CHANGELOG.md)

</div>

> **v0.0.28** —— 本次发布包含压缩完整性重建（主计划 FID-2026-0824-022 + 子项 -023…-027：
> 保留契约 + 摘要 schema、最小手术算法、证据外溢、已删内容台账）、eval 系统重建 v3
> （主计划 FID-2026-0824-013 + 子项 -014…-019：FSM 对齐、沙箱加固、技能效能引擎、
> 治理语料 + 有界自动评分 + Tier-1 预推送冒烟）、桌面聊天界面 + Auto Drive 仪表盘
> （FID-2026-0820-010）、压缩摘要输出（FID-2026-0828-001），以及 Discord Rich Presence
> 优化（默认启用、硬编码 Savant 客户端 ID、三行活动布局）。完整历史见
> [CHANGELOG.md](CHANGELOG.md)。
>
> **v0.0.27** —— 检查点发布（质量棘轮分解、文档同步、harness 修复）。此前版本内容：优化与自动化计划的实施范围已完成，
> 并由独立审计对 FID-2026-0809-003 至 010 全部签署通过。深度审计主计划
> FID-2026-0811-015 至 021 的 ECHO 合规修复已在自动化级别 3 授权下完成、关闭并归档，
> Nova 独立实施审计已返回 **PASS — implementation approved for closure**。此前未跟踪的 004–014
> 归档样式文件仍被明确视为不受信任的工作树工件，保持不变，等待操作员单独处置。
> 本版本覆盖 fail-closed 凭据/删除扫描、无 shell 发布边界、结构化可复现审计证据、
> 显式开发环境信任、FID 依赖图校验和可度量质量门禁。尚未创建标签、推送、发布或部署。
>
> **性能修复与时间定位（FID-2026-0815-001..013）**：完整的 harness 提速计划 ——
> 逐步提示格式化懒加载、异步 trace 写入器、历史复制削减、异步检查点捕获、单遍压缩、
> 带磁盘缓存的模型目录与异步注册表 I/O、UI 无操作守卫，以及并行的 code-map /
> knowledge-graph 索引（发现项 F-01…F-12）—— 外加三轮后续热路径扫描
> （FID-2026-0815-011..013：每步一次系统提示分词、延迟 trace 序列化、仅 strict 模式的
> `existsSync` 探测、有界读取模式扫描、精简的逐步调试负载，以及不再急切复制完整历史）。
> 同时修复时间定位缺口：`formatCurrentDateTime()` 现在注入正确的当前日期与时间
> （星期 + 时区）并逐步刷新，代理不再从裸日期推导错误的星期。
>
> 此前的统一提供商注册表仍作为历史事实保留；本待发布构建增加漂移检测，但不改变提供商路由。
> **v0.0.21** —— v0.0.20 之后的首次发布：格式化/测试门禁全面生效、ECHO 强制执行层、
> 上下文窗口修正、确定性代码知识图谱，以及对抗式验证 —— ECHO 完美循环新增
> **ADVERSARIAL** 阶段与只读的 **Adversary** 智能体（反驳 Verifier 结论、复核无证据
> PASS、裁决优先），每条裁决绑定 `file:line` 证据规则（`NEEDS-REVIEW` 用于无法取证
> 的项），规范智能体名册扩至 10 个角色，并新增 Savant 设计规范技能。
> 本版还包括令牌优化与 YAGNI 强制（四层上下文压缩、ponytail 技术债账本、可选的
> Caveman 电报式输出、实时上下文计量表）以及 `/contribute` 贡献者提交流程。
> 同一版本还交付了新用户拆解修复（FID-2026-0806-009…015）：每个后端调用的 BYOK
> 门禁、以 OpenRouter 为首选的启动默认值、通过 `--print` 无头模式显示失败、支持循环引用的
> 聊天序列化、品牌清理、需同意的自动更新以及遥测披露。全部 FID 积压已关闭并归档。

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

如果 Ollama 没有运行，请在发送提示词前配置一个托管提供商。CLI **默认以 OpenRouter 启动**（`openrouter/free`
免费层）—— 设置一个密钥即可使用：

```text
/provider openrouter
```

你也可以输入 `/provider` 从交互式选择器中选择。将密钥粘贴到遮罩提示框中；它会被全局存储，且永远不会写入
聊天记录。支持的托管提供商包括：

| 提供商 | 命令 | 环境变量 | 说明 |
| --- | --- | --- | --- |
| Ollama | 自动检测 | — | 本地推理；无需 API 密钥 |
| OpenRouter | `/provider openrouter` 或 `DIRECT_PROVIDER=openrouter` | `OR_MASTER_KEY`、`OPENROUTER_API_KEY` 或 `INFERENCE_API_KEY` | **默认提供商**；免费层（`openrouter/free`）为启动默认；主密钥、普通密钥，再推理密钥的优先级 |
| OpenCode Go | `/provider opencode-go` | `OPENCODE_API_KEY` | 托管网关（OpenCode 共享密钥；旧版 `OPENCODE_GO_API_KEY` 仍兼容） |
| OpenCode Zen | `/provider opencode-zen` | `OPENCODE_API_KEY` | 按量付费网关，70 个模型含免费层（OpenCode 共享密钥） |
| TokenRouter | `/provider tokenrouter` | `TOKENROUTER_API_KEY` | 多提供商网关 |
| TokenHarbor | `/provider tokenharbor` | `TOKENHARBOR_API_KEY` | `https://tokenharbor.ai/v1` 的 OpenAI 兼容网关 |
| NVIDIA NIM | `/provider nvidia` | `NVIDIA_API_KEY` | NVIDIA 托管推理 |
| CommandCode | `/provider commandcode` | `COMMAND_CODE_API_KEY` | OpenAI 兼容的托管推理 |
| Nous Research | `/provider nous` | `NOUS_API_KEY` | OpenAI 兼容的直连推理；Portal OAuth 另行处理 |

密钥持久化在 Windows 的 `C:\Users\<username>\.savant-code\credentials.json` 或 macOS/Linux 的
`~/.savant-code/credentials.json`。环境变量优先于已保存的凭据。自动化时，在启动 Savant-Code 前设置一个提供商密钥：

```powershell
# PowerShell —— 选择一个提供商密钥（OpenRouter 为启动默认）
$env:OPENROUTER_API_KEY = "your-key"
# $env:OPENCODE_API_KEY = "your-key"
# $env:TOKENROUTER_API_KEY = "your-key"
# $env:TOKENHARBOR_API_KEY = "your-key"
# $env:NVIDIA_API_KEY = "your-key"
# $env:COMMAND_CODE_API_KEY = "your-key"
# $env:NOUS_API_KEY = "your-key"
savant-code
```

```cmd
:: 命令提示符 —— 选择一个提供商密钥（OpenRouter 为启动默认）
set OPENROUTER_API_KEY=your-key
:: set OPENCODE_API_KEY=your-key
:: set TOKENROUTER_API_KEY=your-key
:: set TOKENHARBOR_API_KEY=your-key
:: set NVIDIA_API_KEY=your-key
:: set COMMAND_CODE_API_KEY=your-key
:: set NOUS_API_KEY=your-key
savant-code
```

```bash
# macOS/Linux —— 选择一个提供商密钥（OpenRouter 为启动默认）
export OPENROUTER_API_KEY="your-key"
# export OPENCODE_API_KEY="your-key"
# export TOKENROUTER_API_KEY="your-key"
# export TOKENHARBOR_API_KEY="your-key"
# export NVIDIA_API_KEY="your-key"
# export COMMAND_CODE_API_KEY="your-key"
# export NOUS_API_KEY="your-key"
savant-code
```

### OpenRouter 直连模式

OpenRouter 是**默认启动提供商**（免费层 `openrouter/free`）；任何 `openrouter/` 模型路由到
`https://openrouter.ai/api/v1` 并使用解析后的密钥。如需绕过 Savant Code 后端、将推理直接路由到
OpenRouter，请设置：

```bash
export DIRECT_PROVIDER=openrouter
export INFERENCE_BASE_URL=https://openrouter.ai/api/v1
```

OpenRouter 凭据优先级如下：

1. `OR_MASTER_KEY` —— 通过 OpenRouter `/api/v1/keys` 换取普通密钥。
2. `OPENROUTER_API_KEY` —— 直接使用已有的普通 OpenRouter 密钥。
3. `INFERENCE_API_KEY` —— 使用 SDK 专用推理密钥。

高级 Cloudflare Workers AI 集成使用 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。普通 CLI 用户应使用
`/provider` 或上面的提供商专用密钥（包括 Nous Research 的 `NOUS_API_KEY`）。请勿创建项目级 `.env` 文件，也不要手动编辑 `credentials.json`。

---

## 概述

Savant-Code 是一个 TypeScript monorepo，用于构建并发布终端原生的 AI 编程助手 **Savant Code** 以及公开的
[`@savant-code/sdk`](https://www.npmjs.com/package/@savant-code/sdk)。CLI 提供多智能体编排、自定义技能、
MCP 工具发现、模式切换（`HYBRID` / `SCAFFOLD` / `STRICT` / `ANALYZE`）以及本地优先的 Ollama 支持。SDK、agent
运行时、多智能体编排引擎、工具层与 LLM 提供商适配层共享，因此两个产品面从同一套代码发布。

整个项目基于 [ECHO 协议 v0.2.0](ECHO.md) 发布——即治理 Savant 生态的同一套 15 条定律 agent 纪律。每项
改动都要经过 RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE 完美循环状态机，并带有硬性的
10 次迭代上限与每次通过 10% 的 Levenshtein 改动上限。

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

- **多智能体编排** —— 10 个专职智能体通过 ECHO 协议协作：Detective 发现问题，Forge 实现，Verifier
  审计，Adversary 反驳审计，Recorder 管理 FID，Thinker 推理，Scout 探索，Researcher 调研，Scribe
  记录文档。
- **带顺序思维的 Thinker** —— Thinker 智能体通过 `sequentialthinking` 累积栈式推理步骤，收敛到类型化
  非空的 `FinalArtifact`（status/synthesis/payload/metrics/thoughts），绝不返回 null 或空结果。
- **原生工具调用加固** —— 针对不完整/畸形/截断工具调用的 fail-closed 流式边界；占位参数的老旧片段
  替换；在严格 Zod 校验之前对字符串化数字/布尔值的宽松强制转换。
- **工具权限边界** —— 通过 `filterToolSet` 基于严格白名单进行工具供给；受限智能体（Thinker、Scout）
  永远不会收到仅父级可用的工具；执行器授权保持不变。
- **`/init` 命令** —— 生成 `.agents/types/{agent-definition,tools,util-types}.ts` 以及一份入门
  `knowledge.md`。
- **斜杠命令** —— `/new`、`/history`、`/bash`、`/goal`、`/loop`、`/feedback`、`/rewind`、
  `/theme:toggle`、`/design`、`/login`、`/logout`、`/exit`，以及各智能体专属命令。
- **可加载设计系统库** —— 离线 `savant-design-systems` 技能包含 74 个约 2 MB 的预设，支持 `/design list`、
  `/design use`、`/design create`、`/design edit`、`/design import`、草稿恢复与重置。只有当前设计契约会进入
  agent 上下文；自定义系统经过校验、版本化保存，并在 EHEL 写入边界进行检查。详细架构、交互式创建/编辑、
  安全边界、持久化、强制检查与打包证据见
  [设计系统库指南](docs/design/design-system-library.md)。如需实时验证 CLI 可用性、智能体反馈与延迟，请运行
  [设计系统实时测试提示](dev/test-prompts/design-system-live-ux-performance.md)。对于覆盖当前更新全部变更域的完整回归，请运行[v0.0.25 全自动 A–Z 实时测试提示](dev/test-prompts/az-v0.0.25-harness-live-test.md)，结果写入`dev/scratchpad/az-v0.0.25-harness-live-test-report.md`。这些提示及其实时结果均有独立的签核边界。实现已在工作树中关闭；独立的最终文档/实现审查仍在等待中。
- **提供商设置** —— `/provider` 打开交互式下拉选择器，显示所有提供商及其 ✓/✗ 配置状态。选择提供商后可
  输入其 API 密钥（遮罩输入）。密钥存储在本地 `credentials.json`。
- **调研（默认免密钥）** —— `web_search`、`read_docs` 与 `deep_research` 零密钥即可工作：网络搜索回退到
  免密钥的 Qwant + DuckDuckGo 适配，`read_docs` 构建自填充的本地 SQLite docset 缓存（`~/.savant-code/docsets/`，
  7 天 TTL + 免密钥版本感知刷新）。可选 Bring-Your-Own-Key 来源（Serper、Context7、Parallel、Tavily、Exa、
  Firecrawl）通过 `/research-keys <service>`（遮罩输入，保存到 `credentials.json`）或对应的 `*_API_KEY`
  环境变量配置。详见 [features.md](docs/features.md)。
- **遥测控制** —— `/telemetry status|enable|disable` 切换远程分析与错误上报。主 CLI 默认开启远程分析，但用户可以
  随时关闭；关闭后本地日志仍然可用。上下文广告是独立设置：主 CLI 默认关闭广告，并可在适用时单独控制。
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
- **会话工具** —— `/copy`（别名 `/copy-chat`）将完整对话复制到剪贴板；`/export`（别名 `/save`）将对话写入完全自包含的品牌化 HTML 报告；`/image`（别名 `/img`、`/attach`）
  在所选提供商支持多模态输入时附加图片。
- **智能体发布** —— `/publish` 为包含必要 publisher 元数据的模板打开智能体发布流程。它需要 Savant Code 后端，
  不能在直接提供商模式下使用。
- **模式切换** —— `HYBRID` / `SCAFFOLD` / `STRICT` / `ANALYZE` 执行范围模式（带悬停说明），
  可在运行时通过 UI 切换。详见[「执行模式」](#执行模式)中的 STRICT 与 HYBRID 仪式契约。
- **流式与取消** —— 逐 token 的 SSE 流式输出，支持流中取消、退避重试，以及并行工作的子智能体流式输出。
- **知识文件** —— 项目级 `knowledge.md` 外加每用户主目录知识，自动载入 agent 上下文。
- **技能（Skills）** —— 启动时发现 OpenClaw 格式的 `SKILL.md` 文件，schema 发送给 LLM，作为原生工具使用。
- **自我改进式 harness 与智能体自建技能** —— Savant 通过进程内钩子（无提示词合规依赖）机械式捕获自身工具失败，
  将复现模式提升为规范规则与版本化技能，并由操作员信任或拒绝其创作的每一项。`skill_manage`
  （Scribe + Orchestrator）将技能写入 `.quarantine/` 并带磁盘版本管理（`versions/` + `VERSIONS.jsonl`）；
  `/skills list|show|trust|untrust|rollback` 是仅操作员可用的发布边界；`immutable: true` 的技能拒绝一切变更；
  SessionEnd 审查、lessons→skills 草稿、LEARNINGS 退役与演化仪式以
  `bun run session-end:review|lessons:to-skills|learnings:retire|skills:evolve` 运行。完整指南：
  [docs/self-improving-harness.md](docs/self-improving-harness.md)。
- **Auto Drive（`/auto-drive`）** —— 澄清 → 计划 → 批准 → 运行至完成的自主执行：将计划分解为 FID 待办、
  按依赖顺序运行并认证完成（别名 `/auto`、`/drive`、`/autodrive`；无头入口 `savant-code --auto "<goal>"`
  需 `--plan-file` 或 `--approve` 才能 fail-closed 地执行）。详见
  [Auto Drive 蓝图](docs/design/Auto Drive Architecture Blueprint.md)。
- **Discord Rich Presence（`/presence`）** —— 默认启用；将当前智能体、ECHO 阶段、项目名与模型外化到
  Discord Rich Presence，带机械式隐私边界（路径、参数、FID 标题与搜索查询全部脱敏；fail-closed Zod 回退）。
  `/presence status | enable | disable`（别名 `/discord`；客户端 ID 硬编码为 Savant Discord 应用）。
- **MCP 工具** —— 启动时发现 Model Context Protocol 服务器，schema 发布给 LLM API。
- **`deep_research` 工具** —— Researcher 角色的机械式多查询网络研究工具（`question` + 模型提供的
  `queries[]`、`research_depth`、`max_sources`）：最大 3 并发、查询间隔 ≥1 秒、URL 去重、域名评分、引用 +
  gaps + `truncated`/`incomplete` 标志。纯搜索门面，基于 harness 的 web-search API —— 不依赖第二个
  LLM（FID-2026-0804-002）。
- **`github` 基础设施辅助** —— 通过官方远程 HTTP MCP 服务器实现只读 GitHub 集成（PR/issue/CI 审查、
  代码搜索、密钥扫描），支持 `Authorization: Bearer $SAVANT_CODE_GITHUB_TOKEN` 插值
  （FID-2026-0804-003）。
- **`database` 基础设施辅助 + 4 个原生工具** —— 基于 `bun:sqlite` 的 `list_tables`、
  `describe_table`、`execute_query`、`analyze_query`，带适配器强制的安全契约：默认只读、LIMIT 注入、
  SQL 脱敏、破坏性 DDL 拦截、JSON 安全的 BLOB/bigint 转换（FID-2026-0804-004）。
- **Browser-use 参数升级** —— 在浏览器辅助上新增 `viewport`（mobile/tablet/desktop）、`wcag`
  （离线 DOM 遍历无障碍扫描，无 CDN）与 `persistSession`（默认关闭）（FID-2026-0804-005）。
- **自包含 `/export`** —— 将整个对话写入品牌化、完全离线的 HTML 报告（Savant 徽标 + Neon Slate 主题
  + 内联为 base64 的 Font Awesome 图标；零网络请求），支持可折叠的工具/思考行以及逐条消息 / 全部复制
  按钮（FID-2026-0804-007）。
- **代码知识图谱** —— 确定性、增量式、基于 SQLite 的图谱，构建在 `packages/code-map`（tree-sitter）之上，
  带 sha256 差异比对、`IMPORTS`/`CALLS`/`EXTENDS` 边与种子化 Louvain 域聚类。`/graph refresh` 按需重新索引；
  Detective/Scout 通过只读原生工具查询爆炸半径、节点边与域聚类；Verifier 的 Law 4 可达性检查由 harness
  计算并注入其消息历史（零工具契约不变）；`/graph-export` 写出品牌化、完全离线的交互式 HTML 报告，复用
  `/export` 设计系统（FID-2026-0806-002）。
- **ECHO Harness 强制执行层（EHEL）** —— 在工具执行器层面结构化执行全部 15 条 ECHO 定律。写入前门禁在违规
  发生前拦截（Law 1：先读后写、Law 3：先验证后继续、Law 7：先搜索后创建、Law 8：意图日志、20 行阈值的 FID
  Recorder 门禁）。轮次结束批量运行写入后扫描器（Law 5、6、9、10、12、14、15）。轮次结束检查 Law 4 调用图可达性。
  FID 完整性校验器带强制性的未解答问题。模式驱动：**Hybrid** = Law 1-4 拦截 + Law 5-15 建议；**Strict** =
  全部 15 条拦截。只有 2 个智能体拥有写工具（Orchestrator + Recorder）。紧急绕过：智能体请求、用户确认
  （FID-2026-0805-007）。
- **Harness ECHO 合规层** —— 以每次运行的运行时追踪器实现确定性的 Law 1（先读后写）、Law 3（写后验证）
  与机械式 Verifier 判据（10+ 行 / 2+ 文件 / 新 API / 安全敏感 / Forge）：非阻塞 `compliance_warning`
  收据 + 纠正性引导，让运行中的智能体自行修正；当写入触及活动 FID 时升级为始终启用（FID-2026-0804-009）。
- **可读的编辑 diff** —— 编辑块将新增行染成 50% 霓虹绿、删除行染成 50% 霓虹红（与主题背景混合），并在
  复制按钮旁显示 `[-N/+M]` 增删计数器；完整 ECHO Perfection Loop 的触发门槛从 75 行降至 20 行
  （FID-2026-0804-010）。
- **上下文压缩** —— 4 层渐进式自动压缩：L0（总结旧轮次）、L1（压缩工具结果）、L2（裁剪过期上下文）、
  L3（激进缩减）。在保留关键上下文的同时降低 token 用量。
- **上下文窗口解析** —— 网关模型（例如 `opencode-go/mimo-v2.5`）在运行时从 OpenRouter 目录解析其真实
  上下文长度。
- **通用复制按钮** —— 在整个 TUI 中悬停即可复制代码块、工具输出与文件 diff。
- **网关提供商** —— 通过 `@savant-code/llm-providers` 支持 TokenRouter、TokenHarbor、NVIDIA NIM、OpenCode Go、OpenCode Zen、
  CommandCode、Nous Research、KiosAPI 与 Cloudflare Workers AI。Nous Research 使用 OpenAI 兼容直连 API；Portal OAuth
  是独立集成。
- **默认模型** —— 通过 OpenRouter 使用 `openrouter/free`（可通过 `/model` 配置）。
- **无头 / 非交互模式** —— `savant-code --print "<prompt>"` 无需 TUI 即可运行单个提示词，并将最终答案打印到
  stdout。退出码：`0` 成功、`1` 错误或超时、`2` 用法错误。当 stdin 被管道化或环境为 CI 时，CLI 自动进入无头模式并以
  stdin 作为提示词。`SAVANT_CODE_RUN_TIMEOUT_MS`（默认 10 分钟）限制挂起的运行（FID-2026-0806-011）。
- **同意式自动更新** —— 启动器绝不在会话运行中停止进程：新版本会在下次启动时经 y/N 提示后应用。
  `SAVANT_CODE_NO_AUTO_UPDATE=1` 完全退出（FID-2026-0806-014）。
- **主题** —— 亮/暗切换（`/theme:toggle`），Neon Slate 美学。
- **侧栏折叠** —— 右侧栏区块与 FID 卡片默认折叠，首屏渲染更紧凑；点击展开。
- **完整命令面** —— 主要斜杠命令已在下方参考表中列出；高级命令仍可通过注册表与自动补全使用。
- **检查点与回退** —— 每轮一个持久化检查点，记录每个首触文件的编辑前内容（包括子智能体写入）以及对话
  边界；`/rewind` 打开选择器，可恢复**仅代码**、**仅对话**、**两者**，或从更早的一轮**分叉新会话**——无需
  git。保留上限为最近 20 轮，且终端副作用永远不会被回退。

---

## 导出工作流：对话报告与 Code Universe

Savant-Code 有**两个完全独立的导出功能**，它们面向不同的用途并生成不同的 HTML 文件：

| 命令 | 导出内容 | 适用场景 |
| --- | --- | --- |
| `/export`（别名 `/save`） | 当前聊天记录 | 保存或分享智能体会话、工具调用、编辑过程与最终答案 |
| `/graph-export`（别名 `/graph:export`、`/gexport`） | 已索引的代码库与交互式 Code Universe | 探索、演示或分享代码库的离线可视化快照 |

两个报告都是自包含的品牌化 HTML 文件，可以直接通过 `file://` 打开，不需要托管服务、本地 Web 服务器、
项目运行时或运行中的 API 连接。

### `/export`：保存对话

`/export` 是**会话报告**，不是纯文本转储。它会保存当前对话，并包含角色徽标、Neon Slate 设计系统、会话元数据、
用户/Savant/错误行、渲染后的 Markdown、工具输入与输出、嵌套子智能体区块、计划、思考内容、ask-user 问答以及附件说明。
工具与思考内容可以折叠；每条消息都有 **Copy** 按钮，顶部还有 **Expand all**、**Collapse all** 与 **Copy all** 控件。

```text
/export
/save
/export reports/session-review.html
```

`/save` 是别名。不指定路径时，CLI 会创建并重复使用这个单文件轮换输出：

```text
dev/exports/conversation/savant-export.html
```

相对路径以当前工作目录为基准，绝对路径按原样使用。成功后命令会报告消息数量、解析后的输出路径与文件大小；空对话只会
添加系统提示，不会创建文件；文件系统错误会显示在聊天中。

报告 HTML 会对内容进行转义，并且完全自包含。Font Awesome CSS/字体以内联方式嵌入；剪贴板优先使用安全的 Clipboard API，
在 `file://` 限制该 API 时使用兼容回退。报告不会重新运行工具、重新连接提供商，也不会随代码库变化自动更新，而是保存一份静态的
决策轨迹：用户提出了什么、智能体做了什么、哪些文件发生了变化以及最终答案。

![Savant Code 对话导出](assets/export.png)

截图展示了本地报告的品牌化标题、会话元数据、全局展开/折叠/复制控制、对话行、可折叠的执行区块以及逐条消息复制按钮。
每次导出的会话 ID、时间戳、消息数量与内容都会不同。详细的渲染、安全与分享说明请参阅[对话导出指南](docs/code-universe-export.md#conversation-export-export)。

下面的三张图明确属于 `/graph-export`，不是对话报告。

### `/graph-export`：探索离线 Code Universe

`/graph-export` 是**代码库报告**，不是聊天记录。它将本地知识图谱序列化成一个名为 Code Universe 的空间化、
可交互 HTML 代码库浏览器。

先构建或刷新结构索引：

```text
/graph refresh
/graph refresh --full
```

第一次刷新会构建 `.savant/graph.db`；之后的刷新会比较文件哈希，只重新解析变化的文件。该数据库可重新生成、
已被 Git 忽略，也不会被打包进报告。

然后生成报告：

```text
/graph-export
/graph:export
/gexport
/graph-export reports/code-universe.html
```

默认输出是单文件轮换路径 `dev/exports/graph/savant-graph.html`。自定义相对或绝对路径会按指定位置写入。较大的导出过程中，
CLI 会显示索引刷新、图谱序列化、布局、文档嵌入、压缩、HTML 组装与写入等阶段，而不是看起来像卡死。

#### Code Universe 包含的内容

- **Universe 视图：** 基于 Sigma.js/Graphology WebGL 画布展示系统、文件、关系走廊、聚类、环境空间效果与 Savant 角色标记。
- **排名搜索：** 使用导出时生成的索引搜索路径、系统、文件夹与文件；结果显示在搜索框下方，并支持鼠标与键盘选择。
- **层级导航：** 展开系统侧栏中的嵌套文件夹与文件，在中央浏览器打开文件夹，也可以直接选择文件。
- **文档查看器：** 打开嵌入的文本文件、经过验证的栅格图像，或查看明确的不可用/二进制回退状态；导出后不会再从磁盘读取文件。
- **详情与连接：** 查看路径、元数据、聚类、方向、边类型、相关对象以及可复制的完整路径。
- **窗口控制：** 拖动面板，将面板最小化到类似任务栏的停靠条，最大化、恢复或独立关闭面板。
- **文档控制：** 复制文本、切换自动换行、查看方括号中的行/字节元数据、使用面包屑，并在前后相邻文件间移动。
- **离线行为：** Sigma.js、Graphology、字体、图标、品牌资源、图谱数据以及启用的文档载荷都嵌入文件；不需要 CDN 或运行时网络请求。

#### Code Universe 视觉导览

Universe 总览将系统和文件关系变成可导航的地图。选择系统进入其轨道，使用搜索跳转到路径，或展开左侧导航树深入文件夹。

![Savant Code Universe 总览](assets/universe-1.png)

栅格图像会在同一套品牌化查看器中打开。PNG、JPEG、GIF 与 WebP 文件在嵌入前会经过验证；不支持、损坏或不安全的媒体
会显示明确的回退状态，而不会被静默地错误展示。

![Code Universe 图像文档查看器](assets/universe-img.png)

文本文件会以易读的源代码视图打开，并提供路径面包屑、行数与字节元数据、复制、换行控制及相邻文件导航。源文本已嵌入报告，
因此查看器在离线状态下仍然可用。

![Code Universe 文本文档查看器](assets/universe-text.png)

#### 文档与隐私模型

图谱索引保存的是结构元数据——路径、符号、哈希、边类型与聚类——而不是实时服务器或仓库的外部副本。HTML 报告是快照，
代码发生变化后应重新生成。

图谱报告默认嵌入文本文件。你可以提供正数限制以生成更小的文件；二进制内容和不支持的媒体仍会受到格式、签名、路径包含关系
与媒体大小检查的保护。可用控制项包括：

```text
SAVANT_GRAPH_EXPORT_DOCUMENTS=0
SAVANT_GRAPH_EXPORT_NO_PREVIEW=1
SAVANT_GRAPH_EXPORT_PREVIEWS=1
SAVANT_GRAPH_EXPORT_DOCUMENT_LINES=<正整数>
SAVANT_GRAPH_EXPORT_DOCUMENT_BYTES=<正整数>
SAVANT_GRAPH_EXPORT_DOCUMENT_IMAGE_BYTES=<正整数>
SAVANT_GRAPH_EXPORT_TOTAL_TEXT_BYTES=<正整数>
SAVANT_GRAPH_EXPORT_TOTAL_MEDIA_BYTES=<正整数>
```

`SAVANT_GRAPH_EXPORT_DOCUMENTS=0` 会关闭文档正文。预览默认关闭；`SAVANT_GRAPH_EXPORT_PREVIEWS=1` 可为详情面板启用小型预览，
而 `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` 是强制关闭开关。其余变量用于设置每个文件或聚合载荷的正数上限。无法安全读取的文档会被
标记为不可用，而不会替换成具有误导性的内容。

请为对话使用 **`/export`**，为代码库使用 **`/graph-export`**。两者可以配合使用：前者保存推理与实现轨迹，后者保存本次会话
检查过的可视化代码库快照。完整用法、故障排查与离线架构请参阅 [导出工作流指南](docs/code-universe-export.md)。

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

- **10 个专职智能体** —— Orchestrator、Detective、Forge、Verifier、Adversary、Recorder、Thinker、
  Scout、Researcher、Scribe
- **FID 约束执行** —— FID 收敛之前绝不写代码
- **完美循环状态机** —— RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE
- **职责分离** —— 写代码的智能体不能验证它
- **15 条定律** —— 4 条不可变流程定律 + 11 条扩展代码定律

---

## 执行模式

聊天窗口左下角的模式切换器用于设置当前会话的**执行范围**。可在运行时通过 UI 或 `/mode` 斜杠命令切换——
裸命令列出每种模式及其契约，而 `/mode <名称>` 或 `/mode:<名称>` 用于切换（例如 `/mode strict`）；
悬停切换器会显示每种模式的一行说明。

| 模式 | 智能体 | 契约 |
| --- | --- | --- |
| `HYBRID`（默认） | `savant` | 直接、低摩擦地编写，受 harness 约束：以 `warn` 级别产生确定性的 Law 1/3 + Verifier 判据收据，超过 20 行仪式阈值时完整 Perfection Loop 自动升级（FID-2026-0804-009/010）。 |
| `SCAFFOLD` | `savant-scaffold` | 伞形 FID 项目初始化；搭建一次后交还 HYBRID。 |
| `STRICT` | `savant-strict` | **每一次**代码改动都执行完整 ECHO 仪式——每次改动建 FID、Forge 编写、Verifier 审计、Law-4 grep。 |
| `ANALYZE` | `savant-analyze` | 只读：搜索、检查与推理，不写文件。 |

### STRICT 模式：每一次改动都执行完整仪式

`STRICT` 是保证仪式的模式。`HYBRID` *允许*智能体升级到完整循环（并且 harness 在判据满足时*警告*），而
`STRICT` 对每一次代码改动都*要求*它。强制手段是 STRICT 提示词契约本身——harness 合规层会在一旁监视，并在
漏掉某个判据时发出 `warn` 级收据（硬性拦截属于后续工作）。在 STRICT 中，提示词契约对每次改动规定：

1. **Recorder 为改动创建 FID**（`dev/fids/FID-YYYY-MMDD-NNN-{title}.md`），由侧栏的「活动 FID」面板自动跟踪。
2. **RED（Detective）** 分析代码库并收敛改动方案。
3. **GREEN（Forge）** 编写代码——仪式流程中唯一允许写入的智能体。
4. **AUDIT（Verifier）** 双重审计结果：运行测试、检查调用图，并执行 Law-4 可达性 grep（grep 生产入口点，
   证明新接线确实被调用）。
5. **Recorder 归档** FID 并追加 CHANGELOG 条目。

不允许自我验证、不允许跳过阶段：编写代码的智能体不能验证它。纯只读问答（提问、解释、不写文件的分析）即使在
STRICT 下也保持无仪式。

### STRICT 还是 HYBRID：我该用哪个？

| 考量 | `HYBRID` | `STRICT` |
| --- | --- | --- |
| 速度 | 最快——自由编写；超过 20 行时完整循环自动介入 | 较慢——每次改动都要付出完整循环的代价 |
| 摩擦 | 最小——harness 只警告与引导，从不阻塞 | 最大——仪式是强制的，而非可选 |
| 审计轨迹 | 仅升级的改动有 FID | 每次改动一个 FID，附带 CHANGELOG 条目归档 |
| 验证 | `warn` 级 harness 收据 + 超过 20 行时自我升级 | 每次改动都有 Verifier + Law-4 grep |
| 最适合 | 日常构建、探索、原型、快速迭代 | 安全敏感或长期维护的代码、付费 API 面、团队审查、任何需要持久审计轨迹的场景 |

**经验法则：** 如果改动出错会带来损失——认证、支付、迁移、任何要交付给用户的东西——请使用 `STRICT`。
如果是在探索或快速迭代，`HYBRID` 是正确的默认：harness 仍然监视 Law 1/3 与 Verifier 判据，超过 20 行阈值
时完整循环仍然会介入。

---

## 仓库地图

<!-- markdownlint-disable MD013 MD060 -->

| 工作区                    | 包                            | 用途                                                            |
| ------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `agents/`                 | `@savant-code/agents`         | 随 CLI 发布的公开 agent 定义                                    |
| `cli/`                    | `@savant-code/cli`            | CLI 源码——UI、命令、状态、hooks、OpenTUI/React 组件             |
| `common/`                 | `@savant-code/common`         | 共享类型、工具定义、工具函数                                    |
| `evals/`                  | `@savant-code/evals`          | ECHO 原生 benchmark v2 运行器 + 遗留 eval fixtures              |
| `packages/agent-runtime/` | `@savant-code/agent-runtime`  | agent 循环、工具执行器、LLM API 集成                            |
| `packages/code-map/`      | `@savant-code/code-map`       | tree-sitter 代码索引、语言检测                                  |
| `packages/database/`      | `@savant-code/database`       | 数据库抽象层                                                     |
| `packages/knowledge-graph/` | `@savant-code/knowledge-graph` | 确定性代码知识图谱引擎（索引器、查询、聚类、导出序列化器）         |
| `packages/llm-providers/` | `@savant-code/llm-providers`  | 公开 LLM 提供商适配层                                           |
| `sdk/`                    | `@savant-code/sdk`            | 公开 SDK——`SavantCodeClient`、类型、构建 + 验证脚本             |
| `desktop/`                | `@savant-code/desktop`        | Tauri v2 桌面外壳——Rust sidecar 监管器、React 19 渲染器、3D 指挥甲板 |
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

如果 Ollama 没有运行，Savant-Code 需要所选模型的提供商 API 密钥。启动默认是 OpenRouter 免费层
（`openrouter/free`），因此 `/provider openrouter` 是最快的路径。可使用交互式选择器，也可以直接选择：

```text
/provider openrouter
/provider opencode-go
/provider tokenrouter
/provider tokenharbor
/provider nvidia
/provider commandcode
```支持的环境变量是 `OPENROUTER_API_KEY`、`OPENCODE_API_KEY`（OpenCode Go 与 Zen 共享；旧版 `OPENCODE_GO_API_KEY` 仍兼容）、`TOKENROUTER_API_KEY`、`TOKENHARBOR_API_KEY`、
  `NVIDIA_API_KEY` 与 `COMMAND_CODE_API_KEY`。密钥提示为遮罩输入，并将密钥全局存储在 Savant-Code 配置的 `credentials.json` 中；不会加入
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

命令可以使用 `/` 输入；别名显示在括号中。

| 命令 | 作用 |
| --- | --- |
| `/help`（`/h`、`/?`） | 显示命令帮助与提示 |
| `/new`（`/clear`、`/reset`） | 开始新聊天；可附带文本直接开始第一条提示 |
| `/history`（`/chats`） | 浏览并恢复历史对话 |
| `/copy`（`/copy-chat`） | 将完整对话复制到剪贴板 |
| `/export`（`/save`） | 将对话写入自包含的品牌化 HTML 报告 |
| `/graph refresh`（`/graph`） | 重新索引代码知识图谱并显示摘要统计（`--full` 全量重建） |
| `/graph-export`（`/graph:export`） | 将代码知识图谱写入品牌化的交互式离线 HTML 报告 |
| `/interview` | 将想法整理为结构化规格 |
| `/plan` | 创建实现计划 |
| `/review` | 审查代码改动 |
| `/goal`（`/g`） | 持续迭代直到可验证目标满足 |
| `/auto-drive`（`/auto`、`/drive`、`/autodrive`） | 启动或管理 Auto Drive 运行 —— 澄清、计划、批准，然后运行至完成 |
| `/loop`（`/repeat`） | 按周期运行提示；使用 `stop` 或 `status` |
| `/verify`（`/typecheck`） | 运行四个受支持的核心工作区类型检查，可全部运行或指定一个 |
| `/permissions`（`/sandbox`、`/safety`） | 查看或设置 `safe`、`prompt`、`unsafe` 工具策略 |
| `/rewind`（`/undo`、`/checkpoint`） | 恢复之前轮次的文件和/或对话 |
| `/health`（`/status`、`/check`） | 检查 Ollama、提供商模式、模型与权限状态 |
| `/diagnostics`（`/diag`、`/processes`） | 显示本地进程与资源诊断信息 |
| `/provider` | 使用遮罩输入配置托管提供商密钥 |
| `/research-keys`（`/research-key`） | 设置调研 API 密钥（`serper`、`context7`、`parallel`、`tavily`、`exa`、`firecrawl`，遮罩输入） |
| `/presence`（`/discord`） | 查看或更改 Discord Rich Presence：`status`、`enable`、`disable` |
| `/mode` | 列出四种模式及其契约，或切换：`/mode <名称>` 或 `/mode:<名称>` |
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

---

## ECHO 协议

本项目随附 [ECHO 协议 v0.2.0](ECHO.md)——面向 agent 行为的单一引导文件。

### 核心原则

- **FID 约束执行** —— FID 收敛之前绝不写代码
- **完美循环** —— RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE
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

## 隐私与遥测

CLI 默认**开启远程分析与错误报告**（FID-2026-0806-015）。CLI 会发送匿名的使用事件与错误报告，
用于改进产品；这些事件不会包含提示词内容。

- 可随时使用 `/telemetry disable` **关闭**（使用 `/telemetry enable` 重新开启）；
  `/telemetry status` 可查看当前状态。
- 关闭远程分析后，**本地日志仍然可用**。
- **上下文广告是独立设置**：主 CLI 默认关闭广告，并可在适用时单独控制。
- 首次启动会显示一行关于该默认设置的提示；提示只显示一次，之后不会重复。

---

## 文档

- [`ECHO.md`](ECHO.md) — 15 条定律 + 完美循环状态机
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — agent 名册与工具限制
- [`protocol.config.yaml`](protocol.config.yaml) — 构建命令、质量基准
- [`CHANGELOG.md`](CHANGELOG.md) — 发布历史
- [`docs/code-universe-export.md`](docs/code-universe-export.md) — `/export` 对话报告与 `/graph-export` Code Universe 指南
- [`docs/launch/landing/index.html`](docs/launch/landing/index.html) — 公开落地页
- [`dev/LEARNINGS.md`](dev/LEARNINGS.md) — 跨会话经验
- [`dev/session-summaries/`](dev/session-summaries/) — 会话审计轨迹

---

## 许可证

[Apache-2.0](LICENSE) — 完整文本见 [LICENSE](LICENSE)。

---

_Savant-Code 是 Savant-Code agent 框架的公开 TypeScript monorepo。_

**Savant** • 2026
