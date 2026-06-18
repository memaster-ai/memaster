---
name: memaster-memory
description: Use this skill when a coding assistant needs long-term memory for user preferences, project context, architecture decisions, implementation details, debugging history, deployment notes, or design decisions. This skill uses the Memaster Cloud API and can work without MCP.
disable: false
---

# Memaster Memory Skill

## Purpose

Use Memaster as long-term memory for AI editors and coding assistants. This skill is IDE-agnostic and can be used from Claude Code, Cursor, Windsurf, Devin, CodeBuddy, OpenClaw-style agents, or any tool that can run a local script.

Default API endpoint:

```text
https://api.memaster.cn
```

## Required environment

Copy `.env.example` to `.env.local` in this skill directory or set variables in your shell.

```text
MEMASTER_API_KEY=<required>
MEMASTER_BASE_URL=https://api.memaster.cn
MEMASTER_USER_ID=<optional-terminal-user-id>  # optional; pass --user-id when needed
MEMASTER_AGENT_ID=<your-agent-id>
MEMASTER_SOURCE=<your-editor-or-agent>
MEMASTER_PROJECT=<project-name>
MEMASTER_AREA=<project-area>
MEMASTER_SCOPE=<scope>
MEMASTER_INFER=false
MEMASTER_TOP_K=5
MEMASTER_TIMEOUT_SECONDS=20
```

`MEMASTER_USER_ID` is not applied automatically because the API scopes requests by the API Key owner. Pass `--user-id` only when you intentionally want a terminal-user filter. Prefer `MEMASTER_AGENT_ID`, `MEMASTER_PROJECT`, `MEMASTER_AREA`, `MEMASTER_SCOPE`, and `MEMASTER_SOURCE` as safer defaults for filtering and metadata.

Never commit `.env.local` or any real API key.

## Script

Use the bundled helper:

```bash
python3 scripts/memaster_memory.py doctor
python3 scripts/memaster_memory.py search --query "What are the project conventions?" --top-k 5 --project "my-project"
python3 scripts/memaster_memory.py add \
  --title "Memaster dashboard 包管理器" \
  --memory-type project_info --project "my-project" --area "dashboard" \
  --tags "项目,规范,包管理" \
  --content $'Memaster dashboard 包管理器约定：\n1) server-golang/dashboard 默认使用 pnpm，禁止 npm 或 yarn。\n2) 安装依赖必须执行 pnpm install --frozen-lockfile。\n\n备注：CI 在 .github/workflows/dashboard.yml 校验 lockfile 一致性。'
python3 scripts/memaster_memory.py add --infer \
  --title "Extract memories" \
  --memory-type user_preference --project "my-project" --area "profile" \
  --tags "偏好,写入" \
  --content $'用户偏好（跨项目长期生效）：\n1) 偏好简洁的中文回复。\n2) 项目默认使用 pnpm，禁止 npm。'
python3 scripts/memaster_memory.py list --project "my-project"
python3 scripts/memaster_memory.py get --memory-id "memory-id"
python3 scripts/memaster_memory.py update \
  --memory-id "memory-id" \
  --project "my-project" --area "docs" \
  --content $'更新后的主题：\n1) 新事实 1\n2) 新事实 2'
python3 scripts/memaster_memory.py delete --memory-id "memory-id" --yes
```

## Memory content format

写入记忆时使用纯文本编号列表风格，便于人工阅读，避免 markdown 装饰把要点淹没。原则如下：

1) 首行是主题句，名词短语或一句完整描述，可在末尾用括号补充范围或前提，以"："结尾。
2) 正文使用 `1)` `2)` 编号；嵌套要点用 `a.` `b.` `c.`。不要用 `1.` 有序列表语法、不要用 `-` 列表、不要用 `**加粗**` 或 `> 引用`。
3) 段与段之间留空行；同一段内可以是多句话或带嵌套编号的小节。
4) 专有名词、版本号、文件路径、命令、API 名、数字、URL 必须原样保留，不要二次包装成代码块。
5) 整体长度建议小于 2000 字符；过长请先汇总再写入。结尾可以用"适用范围："或"备注："做总结。
6) 不写入对话原文、堆栈、未整理段落，也不写入密钥、token、密码、cookie、证书、原始 .env 值或敏感 PII。

好示例：

```text
全局协作规范（任何会话、任何项目下都需要在开始时加载并严格遵守）：
1) 默认中文回答：除代码、命令、路径、标识符外，默认使用中文回答用户。
2) 依赖安装：默认使用 pnpm，禁止使用 npm；当需要 pnpm install 时只提示用户执行，不自动安装依赖。
3) 后端改动检查顺序（无论改前端还是后端，每次都执行）：
   a. 先检查相关功能在 model 层对应的数据模型表，以及关联的数据模型表。
   b. 再检查 service 层业务逻辑。
   c. 再检查 controller / 接口层，包括接口的输入模型与输出模型。
4) 日志规范：编码时所有 error 必须打印到日志，禁止忽略；关键业务节点（短信发送 / 支付 / 配额扣减 / 登录 / 第三方回调等）必须打印业务日志，便于线上排障。

适用范围：以上规范为长期、跨项目的协作偏好，任何情况下都需要加载，作为默认上下文使用，除非用户在当前对话中显式覆盖。
```

坏示例（不要这样写）：

```text
用户说项目用pnpm  我跑了pnpm install 报错 ERR_INVALID_PACKAGE 然后我换成npm i 又不行 stack: at Module._resolveFilename ...
```

## Memory workflow

### Before starting

1. Search for user preferences relevant to the request.
2. Search for project facts and existing implementation patterns.
3. Search for previous debugging history if the task is a bug fix.
4. Use only memories that clearly match the current task.

### During implementation

1. Search again before creating files or changing central abstractions.
2. Search for similar implementations before writing important functions.
3. Search for architecture decisions before making irreversible choices.
4. If stuck, search for related errors and fixes before guessing.

### Before finishing

1. Save stable implementation details, component relationships, debugging conclusions, deployment notes, or user preferences.
2. Do not save secrets, tokens, passwords, cookies, private keys, certificates, or raw `.env` values.
3. Include useful metadata: `project`, `area`, `scope`, `source`, `memory_type`, and `tags`.
4. Summarize what was validated.

## Metadata guidance

Recommended memory types:

- `project_info`
- `implementation`
- `debug`
- `user_preference`
- `design`
- `deployment`

Recommended metadata:

- `project`: repository, product, or workspace name
- `area`: module or package path
- `scope`: capability or topic
- `service`: default `Memaster`
- `source`: editor or agent, such as `cursor`, `claude-code`, or `windsurf`
- `tags`: short labels for filtering
- `infer`: set `MEMASTER_INFER=true` or pass `--infer` to ask the server to extract durable memories from the input. Use `--no-infer` to disable it for one call.
- `timeout`: set `MEMASTER_TIMEOUT_SECONDS` higher when `infer=true` because LLM extraction can take longer than regular requests.

## Safety policy

Never store:

- API keys, tokens, passwords, cookies, private keys, certificates.
- OAuth/session tokens or authorization headers.
- Connection strings with credentials.
- Sensitive personal or business data.
- One-off logs that have no future value.

If sensitive data appears in the task, store only a redacted pattern or do not store it.

## Failure handling

If memory access fails:

1. State that Memaster memory access failed briefly.
2. Continue using the current workspace and conversation context.
3. Ask the user to configure `MEMASTER_API_KEY` only when memory access is required.
