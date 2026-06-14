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
MEMASTER_USER_ID=<your-user-id>
MEMASTER_AGENT_ID=<your-agent-id>
MEMASTER_SOURCE=<your-editor-or-agent>
MEMASTER_PROJECT=<project-name>
MEMASTER_AREA=<project-area>
```

At least one of `MEMASTER_USER_ID`, `MEMASTER_AGENT_ID`, or `--run-id` must be available for memory scope.

Never commit `.env.local` or any real API key.

## Script

Use the bundled helper:

```bash
python3 scripts/memaster_memory.py doctor
python3 scripts/memaster_memory.py search --query "What are the project conventions?" --top-k 5
python3 scripts/memaster_memory.py add --title "Package manager" --content "This project uses pnpm." --memory-type project_info --tags "项目,规范,包管理"
python3 scripts/memaster_memory.py list --project "my-project"
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
